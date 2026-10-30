import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { createPublicClient, createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';

export async function startPreview() {
  const root = resolve('dist');
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.md': 'text/plain' };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (!url.pathname.startsWith('/preview/')) { response.writeHead(404).end(); return; }
    const path = resolve(root, decodeURIComponent(url.pathname.slice('/preview/'.length) || 'index.html'));
    if (!path.startsWith(root + '/')) { response.writeHead(403).end(); return; }
    try { const body = await readFile(path); response.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream' }).end(body); }
    catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/preview/`;
  return { url, close: () => new Promise(resolve => server.close(resolve)) };
}

export async function startTestChain() {
  // A per-run ephemeral local chain. No persisted wallet, key file or account configuration is read.
  const port = 18000 + Math.floor(Math.random() * 20000);
  const process = spawn('anvil', ['--port', String(port), '--chain-id', '11155111', '--hardfork', 'cancun', '--silent'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const rpc = `http://127.0.0.1:${port}`;
  const client = createPublicClient({ chain: sepolia, transport: http(rpc, { retryCount: 0 }), pollingInterval: 50 });
  let error = '';
  process.on('error', e => { error = e.message; });
  process.stderr.on('data', data => { error += data.toString(); });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (error) { process.kill(); throw new Error(`Test chain unavailable: ${error}`); }
    try { await client.getChainId(); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
  }
  if (!ready) { process.kill(); throw new Error('Test chain did not start'); }
  const accounts = await client.request({ method: 'eth_accounts' });
  const wallet = createWalletClient({ account: accounts[0], chain: sepolia, transport: http(rpc) });
  return { rpc, client, wallet, accounts, close: () => process.kill('SIGTERM') };
}

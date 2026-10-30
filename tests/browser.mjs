import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { startPreview, startTestChain } from '../scripts/browser-support.mjs';

const { chromium } = await import(process.argv[2] ?? 'playwright');
const artifact = JSON.parse(await readFile('public/contract/SqueekCompanion.json', 'utf8'));
const preview = await startPreview();
const local = await startTestChain();
const browser = await chromium.launch({ headless: true });
const passed = [];
const errors = [];
await mkdir('test/scratch/interactions', { recursive: true });
const check = (name, condition) => { assert.ok(condition, name); passed.push(name); };
const waitText = (page, text) => page.getByText(text, { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 });

let feed = 'idle';
function statusFixture() {
  const time = new Date(Date.now() - (feed === 'stale' ? 180_000 : 5000)).toISOString();
  return { schemaVersion: 1, revision: `browser-test-${Date.now()}`, measurement: { freshness: feed === 'stale' ? 'stale' : 'online', observedAt: time, receivedAt: time, staleAfterSeconds: 120, provenance: 'hardware', coreStatus: feed === 'active' ? 'ACTIVE' : 'IDLE', rpmMilli: feed === 'long' ? 4_294_967_295 : feed === 'active' ? 84000 : 0 }, builder: { status: 'available', anchor: { blockHeight: feed === 'long' ? '18446744073709551615' : '4135', blockProgress: '35822082' } } };
}

async function context(options = {}, deployment = null) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...options });
  await ctx.route('https://api.squeekchain.com/**', route => feed === 'error' ? route.fulfill({ status: 503, body: 'unavailable' }) : route.fulfill({ json: statusFixture() }));
  await ctx.route('**/deployment.json', route => route.fulfill({ json: deployment ?? { chainId: 11155111, collectionAddress: null, deploymentBlock: null } }));
  for (const url of ['https://ethereum-sepolia-rpc.publicnode.com/**', 'https://rpc.sepolia.org/**']) {
    await ctx.route(url, async route => {
      const response = await fetch(local.rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: route.request().postData() });
      await route.fulfill({ status: 200, contentType: 'application/json', body: await response.text() });
    });
  }
  ctx.on('page', page => {
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().startsWith(preview.url) && response.status() >= 400) errors.push(`Local resource ${response.status()}: ${response.url().replace(preview.url, '')}`); });
  });
  return ctx;
}

async function injectWallet(ctx) {
  await ctx.exposeFunction('testWalletRpc', async ({ method, params = [] }) => {
    const result = await fetch(local.rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    const json = await result.json();
    if (json.error) throw new Error(json.error.message);
    return json.result;
  });
  await ctx.addInitScript(({ account }) => {
    if (!['http:', 'https:'].includes(location.protocol)) return;
    const listeners = new Map();
    let connected = sessionStorage.getItem('test-wallet-connected') === 'true';
    let chain = sessionStorage.getItem('test-wallet-chain') || '0x1';
    let added = sessionStorage.getItem('test-wallet-added') === 'true';
    const emit = (name, value) => { for (const listener of listeners.get(name) ?? []) listener(value); };
    const state = { reject: false, switches: 0, additions: 0, sends: 0 };
    window.__testWallet = state;
    const provider = {
      on: (name, listener) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(listener); },
      removeListener: (name, listener) => listeners.get(name)?.delete(listener),
      request: async ({ method, params }) => {
        if (method === 'eth_requestAccounts') { if (state.reject) throw Object.assign(new Error('User rejected request'), { code: 4001 }); connected = true; sessionStorage.setItem('test-wallet-connected', 'true'); return [account]; }
        if (method === 'eth_accounts') return connected ? [account] : [];
        if (method === 'eth_chainId') return chain;
        if (method === 'wallet_switchEthereumChain') {
          state.switches++;
          if (!added) throw Object.assign(new Error('Unknown chain'), { code: 4902 });
          chain = params[0].chainId; sessionStorage.setItem('test-wallet-chain', chain); emit('chainChanged', chain); return null;
        }
        if (method === 'wallet_addEthereumChain') { state.additions++; added = true; chain = params[0].chainId; sessionStorage.setItem('test-wallet-added', 'true'); sessionStorage.setItem('test-wallet-chain', chain); emit('chainChanged', chain); return null; }
        if (method === 'wallet_requestPermissions') { if (state.reject) throw Object.assign(new Error('User rejected request'), { code: 4001 }); connected = true; sessionStorage.setItem('test-wallet-connected', 'true'); return [{ parentCapability: 'eth_accounts', caveats: [{ type: 'restrictReturnedAccounts', value: [account] }] }]; }
        if (method === 'wallet_getPermissions') return connected ? [{ parentCapability: 'eth_accounts' }] : [];
        if (method === 'wallet_revokePermissions') { connected = false; sessionStorage.removeItem('test-wallet-connected'); return null; }
        if (method === 'eth_sendTransaction') { state.sends++; if (state.reject) throw Object.assign(new Error('User rejected request'), { code: 4001 }); }
        return window.testWalletRpc({ method, params });
      },
    };
    window.ethereum = provider;
    const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info: { uuid: '558ecb3e-4b7c-4f82-8c75-7f6d0ca6c186', name: 'Companion Test Wallet', icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" fill="purple"/></svg>', rdns: 'test.squeek.companion' }, provider } }));
    window.addEventListener('eip6963:requestProvider', announce); announce();
  }, { account: local.accounts[1] });
}

try {
  // Unconfigured production state: useful actions, no fabricated mint or gallery.
  const bare = await context();
  const page = await bare.newPage();
  await page.goto(preview.url);
  await waitText(page, 'Live from Squeekchain');
  const primary = page.getByRole('button', { name: 'Connect to mint', exact: true });
  const box = await primary.boundingBox();
  check('Main connect-to-mint action fits the first 390 × 844 screen', box && box.y + box.height < 844);
  check('No fabricated minted companions before deployment', await page.getByText('The gallery opens with the first mint.').isVisible());
  check('Settled billionths display as 3.6%', await page.getByText('3.6%', { exact: true }).isVisible());
  await page.getByRole('button', { name: 'Preview energetic style' }).click();
  check('Mood preview changes artwork without changing real wheel state', await page.locator('.hero-preview .mood-tag').innerText() === 'Energetic' && await page.locator('.status-stat').first().innerText().then(text => text.includes('Idle')));
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  check('Live control restores real idle mood', await page.locator('.hero-preview .mood-tag').innerText() === 'Resting');
  await primary.click();
  await page.getByRole('dialog').waitFor();
  check('Desktop generic browser wallet and Coinbase Wallet are available', await page.getByRole('button', { name: 'Browser wallet', exact: true }).isVisible() && await page.getByRole('button', { name: 'Coinbase Wallet', exact: true }).isVisible());
  await page.keyboard.press('Escape');
  check('Escape closes native modal and restores focus', !(await page.getByRole('dialog').isVisible()) && await primary.evaluate(el => el === document.activeElement));
  await primary.click();
  await page.mouse.click(3, 3);
  check('Backdrop closes the wallet picker', !(await page.getByRole('dialog').isVisible()));
  await page.getByText('Is it really free?', { exact: true }).focus();
  await page.keyboard.press('Enter');
  check('FAQ works with keyboard', await page.locator('details').first().getAttribute('open') !== null);
  await page.getByRole('button', { name: 'My companions', exact: true }).click();
  check('My companions has a recoverable disconnected empty state', await page.getByRole('button', { name: 'Connect to view yours' }).isVisible());
  for (const width of [320, 390, 720, 960, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    check(`No horizontal overflow at ${width}px`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  feed = 'stale'; await page.getByRole('button', { name: 'Refresh hamster status' }).click();
  await waitText(page, 'Signal is out of date');
  check('Stale readings show unknown wheel activity', await page.locator('.hero-preview .mood-tag').innerText() === 'Awaiting signal');
  feed = 'error'; await page.getByRole('button', { name: 'Refresh hamster status' }).click();
  await waitText(page, 'Feed unavailable');
  check('Failed feed offers retry and never claims idle', await page.getByRole('button', { name: 'Retry feed' }).isVisible() && await page.locator('.hero-preview .mood-tag').innerText() === 'Awaiting signal');
  feed = 'active'; await page.getByRole('button', { name: 'Refresh hamster status' }).click();
  await waitText(page, 'Live from Squeekchain');
  check('Feed recovers and live traits become energetic', await page.locator('.hero-preview .mood-tag').innerText() === 'Energetic');
  feed = 'long'; await page.getByRole('button', { name: 'Refresh hamster status' }).click();
  await page.waitForFunction(() => document.querySelector('.status-stat strong')?.textContent.includes('4,294,967.3'));
  await page.setViewportSize({ width: 320, height: 844 });
  check('Maximum RPM and uint64 block values reflow at 320px', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  feed = 'active';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  check('Reduced motion disables all running CSS animation', await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length === 0));
  await bare.close();

  const phone = await context({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', isMobile: true, hasTouch: true });
  const p = await phone.newPage(); await p.goto(preview.url); await p.getByRole('button', { name: 'Connect to mint' }).click();
  for (const name of ['MetaMask', 'Coinbase Wallet', 'Rabby', 'Phantom']) check(`Phone offers Open in ${name}`, await p.getByRole('link', { name: `Open in ${name}` }).isVisible());
  check('Phone offers Coinbase Smart Wallet without a relay', await p.getByRole('button', { name: 'Coinbase Smart Wallet' }).isVisible());
  await phone.close();

  // Actual bytecode, actual local-EVM mint, EIP-6963 discovery, and network-add fallback.
  const deployTx = await local.wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode, args: [local.accounts[0]] });
  const deploymentReceipt = await local.client.waitForTransactionReceipt({ hash: deployTx });
  const deployed = { chainId: 11155111, collectionAddress: deploymentReceipt.contractAddress, deploymentBlock: String(deploymentReceipt.blockNumber) };
  const connected = await context({}, deployed); await injectWallet(connected);
  const w = await connected.newPage(); await w.goto(preview.url);
  await w.getByRole('button', { name: 'Connect to mint' }).click();
  await w.getByRole('button', { name: 'Companion Test Wallet', exact: true }).waitFor();
  check('EIP-6963 named wallet hides generic browser row', !(await w.getByRole('button', { name: 'Browser wallet', exact: true }).count()));
  await w.evaluate(() => { window.__testWallet.reject = true; });
  await w.getByRole('button', { name: 'Companion Test Wallet', exact: true }).click();
  await waitText(w, 'Request declined in your wallet. You can try again whenever you’re ready.');
  check('Connection rejection stays in the sheet with retry', await w.getByRole('dialog').isVisible());
  await w.evaluate(() => { window.__testWallet.reject = false; });
  await w.getByRole('button', { name: 'Companion Test Wallet', exact: true }).click();
  await w.getByRole('dialog').waitFor({ state: 'hidden' });
  const switchButton = w.locator('.mint-button');
  await switchButton.click();
  await w.getByRole('button', { name: 'Mint a companion', exact: true }).waitFor({ timeout: 15000 });
  const state = await w.evaluate(() => window.__testWallet);
  check('Wrong-chain flow falls back to adding Sepolia and changes network', state.additions === 1 && state.switches >= 1);
  await w.evaluate(() => { window.__testWallet.reject = true; });
  await w.getByRole('button', { name: 'Mint a companion', exact: true }).click();
  await waitText(w, 'Request declined in your wallet. You can try again whenever you’re ready.');
  check('Mint rejection restores the actionable mint button', await w.getByRole('button', { name: 'Mint a companion', exact: true }).isEnabled());
  await w.evaluate(() => { window.__testWallet.reject = false; });
  await w.getByRole('button', { name: 'Mint a companion', exact: true }).click();
  await w.getByRole('button', { name: 'Companion minted', exact: true }).waitFor({ timeout: 20000 });
  check('Real local-EVM mint confirms and disables a second mint', await w.getByRole('button', { name: 'Companion minted', exact: true }).isDisabled());
  await waitText(w, 'Companion #1');
  check('Gallery renders the actual minted token', await w.getByText('Companion #1', { exact: true }).isVisible());
  await w.getByRole('button', { name: 'My companions', exact: true }).click();
  await waitText(w, 'Companion #1');
  check('Ownership gallery filters actual holder records', await w.getByText('Companion #1', { exact: true }).isVisible());
  const owner = await local.client.readContract({ address: deployed.collectionAddress, abi: artifact.abi, functionName: 'ownerOf', args: [1n] });
  check('Minted token belongs to the connected test wallet', owner.toLowerCase() === local.accounts[1].toLowerCase());
  await w.reload();
  await w.getByRole('button', { name: 'Companion minted', exact: true }).waitFor({ timeout: 15000 });
  check('Wallet reconnect and lifetime mint eligibility survive reload', await w.getByRole('button', { name: 'Companion minted', exact: true }).isDisabled());
  await connected.close();

  const operator = await context(); await injectWallet(operator);
  const o = await operator.newPage(); await o.goto(`${preview.url}#launch`);
  const panel = o.locator('.launch-panel');
  await panel.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await o.getByRole('button', { name: 'Companion Test Wallet', exact: true }).click();
  await o.getByRole('dialog').waitFor({ state: 'hidden' });
  await panel.getByRole('button', { name: 'Switch to Sepolia', exact: true }).click();
  await panel.getByRole('button', { name: 'Deploy with connected wallet', exact: true }).click();
  const downloadButton = panel.getByRole('button', { name: 'Download deployment.json', exact: true });
  await downloadButton.waitFor({ timeout: 20000 });
  check('Operator flow deploys the actual contract through the connected wallet', await panel.getByText('Collection deployed', { exact: true }).isVisible());
  const downloadPromise = o.waitForEvent('download'); await downloadButton.click();
  const download = await downloadPromise;
  await download.saveAs('test/scratch/interactions/deployment-download.json');
  const handoff = JSON.parse(await readFile('test/scratch/interactions/deployment-download.json', 'utf8'));
  check('Operator downloads a handoff with real receipt address and block', handoff.chainId === 11155111 && /^0x[0-9a-fA-F]{40}$/.test(handoff.collectionAddress) && BigInt(handoff.deploymentBlock) > 0n);
  const ownerAdmin = await local.client.readContract({ address: handoff.collectionAddress, abi: artifact.abi, functionName: 'owner' });
  check('Deployment assigns ownership to the explicit connected wallet', ownerAdmin.toLowerCase() === local.accounts[1].toLowerCase());
  await panel.getByRole('button', { name: 'Publish current reading', exact: true }).click();
  await waitText(o, 'Current reading published. RPM traits stay fresh for 120 seconds.');
  const published = await local.client.readContract({ address: handoff.collectionAddress, abi: artifact.abi, functionName: 'snapshot' });
  check('Reporter publishes the parsed API measurement through the wallet', published[0] === 84000 && published[1] === true && published[2] > 0n);
  await o.setViewportSize({ width: 320, height: 844 });
  check('Operator tools and full contract address reflow at 320px', await o.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await operator.close();

  if (errors.length) console.error('Collected page errors:', JSON.stringify(errors));
  check('No uncaught scripts or missing local assets during validated flows', errors.length === 0);
  await writeFile('test/scratch/interactions/results.json', JSON.stringify({ passed, errors, limits: ['EIP-6963 provider and network prompts are a test harness; no real wallet extension or physical phone was used.', 'Mint was submitted to an ephemeral Anvil chain with Sepolia chain ID, not public Sepolia.'] }, null, 2));
  console.log(JSON.stringify({ passed: passed.length, checks: passed, errors }, null, 2));
} catch (error) {
  console.error('Validation progress:', JSON.stringify({ checksPassed: passed.length, errors }));
  const pages = browser.contexts().flatMap(c => c.pages());
  const last = pages.at(-1);
  if (last) {
    await last.screenshot({ path: 'test/scratch/interactions/failure.png', fullPage: true });
    console.error('Browser failure state:', JSON.stringify({ passed: passed.length, errors, text: (await last.locator('body').innerText()).slice(0, 3500) }));
  }
  throw error;
} finally { await browser.close(); await preview.close(); local.close(); }

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import solc from 'solc';
import { createPublicClient, createWalletClient, http, keccak256, stringToHex } from 'viem';
import { sepolia } from 'viem/chains';
import { compile } from '../scripts/compile.mjs';

let node, client, wallets, compiled, fixtures, snapshot;
const core = '0x74665dAecA35A2303e767E76a2FF1FB6F93e119f';
let contract;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const revision = keccak256(stringToHex('actual-test-revision'));

before(async () => {
  const port = await new Promise(resolve => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
  node = spawn('anvil', ['--port', String(port), '--chain-id', '11155111', '--hardfork', 'cancun', '--silent'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let startupError = '';
  node.on('error', error => { startupError = error.message; });
  node.stderr.on('data', chunk => { startupError += chunk.toString(); });
  client = createPublicClient({ chain: sepolia, transport: http(`http://127.0.0.1:${port}`, { retryCount: 0 }), pollingInterval: 10 });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (startupError) throw new Error(`Anvil could not start: ${startupError}`);
    try { await client.getChainId(); ready = true; break; } catch { await delay(50); }
  }
  assert.ok(ready, 'Anvil starts within 5 seconds');
  const addresses = await client.request({ method: 'eth_accounts' });
  wallets = addresses.slice(0, 10).map(account => createWalletClient({ account, chain: sepolia, transport: http(`http://127.0.0.1:${port}`, { retryCount: 0 }) }));
  compiled = await compile();
  const source = await readFile('tests/fixtures/Receivers.sol', 'utf8');
  const result = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: { 'Receivers.sol': { content: source } }, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } } })));
  for (const e of result.errors ?? []) if (e.severity === 'error') throw new Error(e.formattedMessage);
  fixtures = result.contracts['Receivers.sol'];
  const tx = await wallets[0].deployContract({ abi: compiled.abi, bytecode: compiled.bytecode, args: [wallets[0].account.address] });
  contract = (await client.waitForTransactionReceipt({ hash: tx })).contractAddress;
  await client.request({ method: 'anvil_setCode', params: [core, `0x${fixtures.MockCore.evm.deployedBytecode.object}`] });
  snapshot = await client.request({ method: 'evm_snapshot' });
});

after(async () => { if (node) node.kill('SIGTERM'); });

const read = (functionName, args = []) => client.readContract({ address: contract, abi: compiled.abi, functionName, args });
async function write(functionName, args = [], wallet = wallets[0], target = contract, abi = compiled.abi) {
  const { request } = await client.simulateContract({ address: target, abi, functionName, args, account: wallet.account });
  const hash = await wallet.writeContract(request);
  assert.equal((await client.waitForTransactionReceipt({ hash })).status, 'success');
  return hash;
}
async function reset() {
  await client.request({ method: 'evm_revert', params: [snapshot] });
  snapshot = await client.request({ method: 'evm_snapshot' });
}
const metadata = async (id = 1n) => JSON.parse(Buffer.from((await read('tokenURI', [id])).split(',')[1], 'base64').toString());
const attr = (json, name) => json.attributes.find(a => a.trait_type === name).value;
async function publish(rpm, spinning, observedAt) {
  const block = await client.getBlock({ blockTag: 'latest' });
  await write('publishStatus', [rpm, spinning, observedAt ?? block.timestamp, revision]);
}

test('SqueekCompanion contract behavior', async t => {
  await t.test('deploys with explicit owner, fixed identity, size limits and ERC-721/4906 interfaces', async () => {
    await reset();
    assert.equal(await read('name'), 'Squeek Companion');
    assert.equal(await read('symbol'), 'SQUEEK');
    assert.equal((await read('owner')).toLowerCase(), wallets[0].account.address.toLowerCase());
    assert.equal(await read('totalSupply'), 0n);
    assert.ok(compiled.runtimeBytes < 24_576 && compiled.initBytes < 49_152);
    for (const id of ['0x80ac58cd', '0x5b5e139f', '0x49064906']) assert.equal(await read('supportsInterface', [id]), true);
    assert.equal(await read('supportsInterface', ['0xffffffff']), false);
  });
  await t.test('free mint establishes ownership and one lifetime allowance', async () => {
    await reset(); await write('mint');
    assert.equal(await read('totalSupply'), 1n);
    assert.equal(await read('balanceOf', [wallets[0].account.address]), 1n);
    assert.equal(await read('hasMinted', [wallets[0].account.address]), true);
    await assert.rejects(write('mint'), /AlreadyMinted/);
  });
  await t.test('transfers do not renew allowance; a recipient may still use their own mint', async () => {
    await reset(); await write('mint');
    await write('transferFrom', [wallets[0].account.address, wallets[1].account.address, 1n]);
    await assert.rejects(write('mint'), /AlreadyMinted/);
    await write('mint', [], wallets[1]);
    assert.equal(await read('balanceOf', [wallets[1].account.address]), 2n);
    assert.equal(await read('totalSupply'), 2n);
  });
  await t.test('ETH payment, missing tokens and zero-recipient transfers revert', async () => {
    await reset();
    await assert.rejects(client.simulateContract({ address: contract, abi: compiled.abi, functionName: 'mint', value: 1n, account: wallets[0].account }));
    await assert.rejects(read('tokenURI', [0n]));
    await assert.rejects(read('tokenURI', [1n]));
    await write('mint');
    await assert.rejects(write('transferFrom', [wallets[0].account.address, '0x0000000000000000000000000000000000000000', 1n]));
  });
  await t.test('safe-mint callback cannot reenter; rejecting callbacks roll back all state', async () => {
    await reset();
    for (const name of ['ReenterReceiver', 'RejectReceiver']) {
      const f = fixtures[name];
      const tx = await wallets[0].deployContract({ abi: f.abi, bytecode: `0x${f.evm.bytecode.object}` });
      const receiver = (await client.waitForTransactionReceipt({ hash: tx })).contractAddress;
      if (name === 'ReenterReceiver') {
        await write('mint', [contract], wallets[0], receiver, f.abi);
        assert.equal(await read('balanceOf', [receiver]), 1n);
      } else {
        await assert.rejects(write('mint', [contract], wallets[0], receiver, f.abi));
        assert.equal(await read('hasMinted', [receiver]), false);
      }
    }
    assert.equal(await read('totalSupply'), 1n);
  });
  await t.test('only designated reporter can publish; only owner can rotate reporter', async () => {
    await reset();
    const timestamp = (await client.getBlock()).timestamp;
    await assert.rejects(write('publishStatus', [0, false, timestamp, revision], wallets[1]), /NotReporter/);
    await assert.rejects(write('setReporter', [wallets[1].account.address], wallets[1]));
    await assert.rejects(write('setReporter', ['0x0000000000000000000000000000000000000000']), /InvalidReporter/);
    await write('setReporter', [wallets[1].account.address]);
    await write('publishStatus', [0, false, timestamp, revision], wallets[1]);
    await assert.rejects(publish(0, false), /NotReporter/);
  });
  await t.test('metadata changes through resting, active and the exact 60 rpm boundary', async () => {
    await reset(); await write('mint');
    for (const [rpm, spinning, expected] of [[0, false, 'Resting'], [59_999, true, 'Active'], [60_000, true, 'Energetic'], [100_000, false, 'Resting']]) {
      await client.request({ method: 'evm_increaseTime', params: [2] }); await client.request({ method: 'evm_mine' });
      await publish(rpm, spinning);
      const json = await metadata();
      assert.equal(attr(json, 'Mood'), expected);
      assert.equal(attr(json, 'Wheel RPM (milli)'), rpm);
      const image = Buffer.from(json.image.split(',')[1], 'base64').toString();
      assert.ok(image.startsWith('<svg') && image.includes(expected));
    }
  });
  await t.test('expired or uninitialized observations are unknown; mint and metadata stay usable', async () => {
    await reset(); await write('mint');
    assert.equal(attr(await metadata(), 'Mood'), 'Signal unavailable');
    await publish(90_000, true);
    await client.request({ method: 'evm_increaseTime', params: [121] }); await client.request({ method: 'evm_mine' });
    const json = await metadata();
    assert.equal(attr(json, 'Mood'), 'Signal unavailable');
    assert.equal(attr(json, 'Wheel state'), 'Unknown');
    await write('mint', [], wallets[1]);
    await write('transferFrom', [wallets[0].account.address, wallets[2].account.address, 1n]);
  });
  await t.test('rejects stale, future, replayed and empty-revision observations', async () => {
    await reset(); const time = (await client.getBlock()).timestamp;
    await assert.rejects(publish(0, false, time - 121n), /InvalidObservation/);
    await assert.rejects(publish(0, false, time + 100n), /InvalidObservation/);
    await assert.rejects(write('publishStatus', [0, false, time, `0x${'0'.repeat(64)}`]), /InvalidObservation/);
    await publish(0, false, time);
    await assert.rejects(publish(0, false, time), /InvalidObservation/);
  });
  await t.test('reads settled block progress live and degrades safely on invalid or reverting Core', async () => {
    await reset(); await write('mint');
    await write('set', [4135n, 35_822_082n, false, false], wallets[0], core, fixtures.MockCore.abi);
    let json = await metadata();
    assert.equal(attr(json, 'Settled Squeek block'), 4135);
    assert.equal(attr(json, 'Block progress (billionths)'), 35_822_082);
    assert.equal(attr(json, 'Core data'), 'Available');
    for (const [h, p, inconsistent, broken] of [[4136n, 1n, true, false], [1n, 1_000_000_000n, false, false], [1n, 0n, false, true]]) {
      await write('set', [h, p, inconsistent, broken], wallets[0], core, fixtures.MockCore.abi);
      json = await metadata();
      assert.equal(attr(json, 'Core data'), 'Unavailable');
      assert.equal(attr(json, 'Settled Squeek block'), 0);
    }
    await write('mint', [], wallets[1]);
  });
  await t.test('two-step ownership transfer changes admin without granting seizure powers', async () => {
    await reset();
    await write('transferOwnership', [wallets[1].account.address]);
    await assert.rejects(write('acceptOwnership', [], wallets[2]));
    await write('acceptOwnership', [], wallets[1]);
    await assert.rejects(write('setReporter', [wallets[2].account.address]));
    await write('setReporter', [wallets[2].account.address], wallets[1]);
  });
  await t.test('seeded action fuzz preserves supply, ownership and lifetime mint limits (two seeds, 160 actions)', async () => {
    for (const seed of [0x51ee1234, 0x713ecafe]) {
      await reset(); let state = seed >>> 0;
      const random = max => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) % max; };
      const minted = new Set(); const owners = new Map();
      for (let step = 0; step < 80; step++) {
        const user = random(8);
        if (random(2) === 0 || !owners.size) {
          if (minted.has(user)) await assert.rejects(write('mint', [], wallets[user]), /AlreadyMinted/);
          else { await write('mint', [], wallets[user]); minted.add(user); owners.set(BigInt(owners.size + 1), user); }
        } else {
          const id = BigInt(random(owners.size) + 1); const to = random(8); const from = owners.get(id);
          await write('transferFrom', [wallets[from].account.address, wallets[to].account.address, id], wallets[from]); owners.set(id, to);
        }
        assert.equal(await read('totalSupply'), BigInt(minted.size));
      }
      let balances = 0n;
      for (let i = 0; i < 8; i++) {
        const expected = [...owners.values()].filter(v => v === i).length;
        assert.equal(await read('balanceOf', [wallets[i].account.address]), BigInt(expected));
        assert.equal(await read('hasMinted', [wallets[i].account.address]), minted.has(i));
        balances += await read('balanceOf', [wallets[i].account.address]);
      }
      assert.equal(balances, await read('totalSupply'));
    }
  });
});

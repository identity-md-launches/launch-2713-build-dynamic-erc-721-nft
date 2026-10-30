import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import solc from 'solc';
import { keccak256 } from 'viem';

export async function compile() {
  const source = await readFile('contracts/SqueekCompanion.sol', 'utf8');
  const input = {
    language: 'Solidity',
    sources: { 'contracts/SqueekCompanion.sol': { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 }, viaIR: true, evmVersion: 'cancun',
      metadata: { bytecodeHash: 'none', appendCBOR: false },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input), {
    import: (path) => {
      try { return { contents: readFileSync(`node_modules/${path}`, 'utf8') }; }
      catch { return { error: `Missing dependency: ${path}. Run npm ci.` }; }
    },
  }));
  for (const error of output.errors ?? []) {
    if (error.severity === 'error') throw new Error(error.formattedMessage);
    console.warn(error.formattedMessage);
  }
  const c = output.contracts['contracts/SqueekCompanion.sol'].SqueekCompanion;
  const runtimeBytes = c.evm.deployedBytecode.object.length / 2;
  const initBytes = c.evm.bytecode.object.length / 2;
  if (runtimeBytes > 24576 || initBytes > 49152) throw new Error('Deployment size limit exceeded');
  return { abi: c.abi, bytecode: `0x${c.evm.bytecode.object}`, runtimeHash: keccak256(`0x${c.evm.deployedBytecode.object}`), runtimeBytes, initBytes, compiler: solc.version() };
}

if (process.argv[1]?.endsWith('/compile.mjs')) {
  const c = await compile();
  await mkdir('src/generated', { recursive: true });
  await mkdir('public/contract', { recursive: true });
  await writeFile('src/generated/companion.json', JSON.stringify(c));
  await writeFile('public/contract/SqueekCompanion.json', JSON.stringify(c, null, 2) + '\n');
  console.log(`Solidity ${c.compiler}; runtime ${c.runtimeBytes} B; initcode ${c.initBytes} B`);
}

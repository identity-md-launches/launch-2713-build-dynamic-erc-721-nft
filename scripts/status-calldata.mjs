import { encodeFunctionData, keccak256, stringToHex } from 'viem';
import { readFile } from 'node:fs/promises';

const abi = JSON.parse(await readFile(new URL('../public/contract/SqueekCompanion.json', import.meta.url))).abi;
const response = await fetch('https://api.squeekchain.com/v1/status', { signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error(`Status API returned HTTP ${response.status}`);
const data = await response.json();
const m = data.measurement;
const now = Date.now();
if (data.schemaVersion !== 1 || !m || m.provenance !== 'hardware' || m.freshness !== 'online'
  || !['ACTIVE', 'IDLE'].includes(m.coreStatus) || !Number.isInteger(m.rpmMilli) || m.rpmMilli < 0 || m.rpmMilli > 4_294_967_295
  || typeof data.revision !== 'string' || !data.revision || !Number.isFinite(Date.parse(m.observedAt))
  || !Number.isFinite(Date.parse(m.receivedAt)) || Date.parse(m.observedAt) > now
  || Date.parse(m.receivedAt) > now || now - Date.parse(m.observedAt) > 90_000 || now - Date.parse(m.receivedAt) > 90_000) {
  throw new Error('Refusing to prepare telemetry: no fresh, valid hardware reading under 90 seconds old.');
}
const observedAt = BigInt(Math.floor(Date.parse(m.observedAt) / 1000));
const args = [m.rpmMilli, m.coreStatus === 'ACTIVE', observedAt, keccak256(stringToHex(data.revision))];
console.log(JSON.stringify({ chainId: 11155111, function: 'publishStatus', source: 'https://api.squeekchain.com/v1/status', observedAt: String(observedAt), calldata: encodeFunctionData({ abi, functionName: 'publishStatus', args }), note: 'Submit to the deployed SqueekCompanion from its designated reporter before the 120-second freshness window expires. This command does not sign or submit.' }, null, 2));

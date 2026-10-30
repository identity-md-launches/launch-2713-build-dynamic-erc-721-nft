import { createConfig, http } from 'wagmi';
import { coinbaseWallet, injected } from 'wagmi/connectors';
import { sepolia } from 'wagmi/chains';
import { createPublicClient, fallback, getAddress, isAddress, type Address } from 'viem';
import contract from '../generated/companion.json';

export const SITE_NAME = 'Squeek Companion';
export const STATUS_URL = 'https://api.squeekchain.com/v1/status';
export const CORE_ADDRESS = '0x74665dAecA35A2303e767E76a2FF1FB6F93e119f' as const;
export const RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
export const chain = { ...sepolia, rpcUrls: { default: { http: [RPC_URL] } } } as const;
export const abi = contract.abi;
export const bytecode = contract.bytecode as `0x${string}`;
export const walletConfig = createConfig({
  chains: [chain],
  multiInjectedProviderDiscovery: true,
  connectors: [injected(), coinbaseWallet({ appName: SITE_NAME })],
  transports: { [sepolia.id]: http(RPC_URL, { timeout: 15_000, retryCount: 1 }) },
});
export const publicClient = createPublicClient({
  chain,
  transport: fallback([http(RPC_URL, { timeout: 12_000, retryCount: 1 }), http('https://rpc.sepolia.org', { timeout: 12_000, retryCount: 1 })]),
});

export type Deployment = { chainId: number; collectionAddress: Address; deploymentBlock: bigint };
export async function loadDeployment(): Promise<Deployment | null> {
  const response = await fetch(new URL('deployment.json', document.baseURI), { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Collection configuration could not be loaded. Refresh to try again.');
  const raw = await response.json();
  if (raw.collectionAddress === null && raw.deploymentBlock === null && raw.chainId === sepolia.id) return null;
  if (raw.chainId !== sepolia.id || !isAddress(raw.collectionAddress)
      || !/^\d+$/.test(String(raw.deploymentBlock)) || BigInt(raw.deploymentBlock) <= 0n
      || /^0x0{40}$/i.test(raw.collectionAddress)) {
    throw new Error('Collection configuration is invalid. Minting is unavailable.');
  }
  return { chainId: raw.chainId, collectionAddress: getAddress(raw.collectionAddress), deploymentBlock: BigInt(raw.deploymentBlock) };
}

export function friendlyError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (/reject|denied|4001/i.test(text)) return 'Request declined in your wallet. You can try again whenever you’re ready.';
  if (/insufficient funds/i.test(text)) return 'You need a little Sepolia test ETH for gas. Add test ETH, then try again.';
  if (/AlreadyMinted/i.test(text)) return 'This wallet has already minted its companion. Check the gallery.';
  if (/not found|no.*provider|not installed/i.test(text)) return 'No browser wallet was found. Install a wallet or choose Coinbase Wallet.';
  if (/chain|network/i.test(text)) return 'Switch your wallet to Sepolia and try again.';
  if (/timeout|fetch|HTTP|network/i.test(text)) return 'The network did not respond. Check your connection and try again.';
  return 'The request could not be completed. Check your wallet and try again.';
}

import { useQuery } from '@tanstack/react-query';
import { keccak256, type Address } from 'viem';
import { abi, loadDeployment, publicClient, STATUS_URL, type Deployment } from './lib/config';
import { parseStatus } from './lib/status';
import contract from './generated/companion.json';

export function useHamster() {
  return useQuery({
    queryKey: ['hamster'],
    queryFn: async () => {
      const response = await fetch(STATUS_URL, { signal: AbortSignal.timeout(10_000), cache: 'no-store' });
      if (!response.ok) throw new Error(`Status feed returned ${response.status}. Please try again.`);
      return parseStatus(await response.json());
    },
    refetchInterval: 15_000, staleTime: 10_000, retry: 1,
  });
}

export function useDeployment() {
  return useQuery({
    queryKey: ['deployment'],
    queryFn: async () => {
      const deployment = await loadDeployment();
      if (!deployment) return null;
      const code = await publicClient.getCode({ address: deployment.collectionAddress });
      if (!code || keccak256(code) !== contract.runtimeHash) {
        throw new Error('The configured collection does not match the reviewed contract. Minting is unavailable.');
      }
      return deployment;
    }, staleTime: Infinity, retry: 1,
  });
}

export function useCollection(deployment: Deployment | null | undefined, address?: Address) {
  return useQuery({
    queryKey: ['collection', deployment?.collectionAddress, address],
    enabled: !!deployment,
    queryFn: async () => {
      if (!deployment) throw new Error('No deployment');
      const blockNumber = await publicClient.getBlockNumber();
      const base = { address: deployment.collectionAddress, abi, blockNumber };
      const [supply, hasMinted] = await Promise.all([
        publicClient.readContract({ ...base, functionName: 'totalSupply' }) as Promise<bigint>,
        address ? publicClient.readContract({ ...base, functionName: 'hasMinted', args: [address] }) as Promise<boolean> : false,
      ]);
      return { supply, hasMinted, blockNumber };
    }, refetchInterval: 15_000, retry: 1,
  });
}

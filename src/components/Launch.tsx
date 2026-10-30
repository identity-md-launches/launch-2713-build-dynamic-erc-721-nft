import { useState } from 'react';
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, CheckCircle2, Download, LoaderCircle, Radio, Rocket, Wallet } from 'lucide-react';
import { keccak256, stringToHex } from 'viem';
import { abi, bytecode, chain, CORE_ADDRESS, friendlyError, publicClient, type Deployment } from '../lib/config';
import { useHamster } from '../hooks';

export default function Launch({ connect, deployment }: { connect: () => void; deployment: Deployment | null }) {
  const { address, chainId, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const hamster = useHamster();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<'deploy' | 'publish' | null>(null);
  const [error, setError] = useState('');
  const [hash, setHash] = useState<string>('');
  const [created, setCreated] = useState<Deployment | null>(null);
  const [published, setPublished] = useState(false);
  const target = created ?? deployment;
  const correctChain = chainId === chain.id;

  async function deploy() {
    if (!walletClient || !address || !correctChain) return;
    setError(''); setPending('deploy'); setHash('');
    try {
      const tx = await walletClient.deployContract({ abi, bytecode, args: [address], account: address, chain });
      setHash(tx);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx, timeout: 180_000 });
      if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error('Deployment failed');
      setCreated({ chainId: chain.id, collectionAddress: receipt.contractAddress, deploymentBlock: receipt.blockNumber });
    } catch (e) { setError(friendlyError(e)); }
    finally { setPending(null); }
  }

  async function publish() {
    if (!walletClient || !address || !target || !correctChain) return;
    setError(''); setPublished(false); setPending('publish');
    try {
      const data = await hamster.refetch();
      if (!data.data?.fresh || data.data.provenance !== 'hardware') throw new Error('No fresh hardware reading');
      const observedAt = BigInt(Math.floor(data.data.observedAt / 1000));
      const args = [data.data.rpmMilli, data.data.spinning, observedAt, keccak256(stringToHex(data.data.revision))];
      const { request } = await publicClient.simulateContract({ address: target.collectionAddress, abi, functionName: 'publishStatus', args, account: address });
      const tx = await walletClient.writeContract(request);
      setHash(tx);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx, timeout: 120_000 });
      if (receipt.status !== 'success') throw new Error('Publish reverted');
      setPublished(true);
      await queryClient.invalidateQueries({ queryKey: ['collection'] });
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      setError(/No fresh hardware/.test(message) ? 'A fresh hardware reading is required. Refresh the feed and try again.' : /NotReporter/.test(message) ? 'Only the collection’s designated reporter can publish readings.' : /InvalidObservation/.test(message) ? 'That reading was already published or has expired. Wait for the next reading and try again.' : friendlyError(e));
    } finally { setPending(null); }
  }

  function downloadConfig() {
    if (!target) return;
    const blob = new Blob([JSON.stringify({ ...target, deploymentBlock: String(target.deploymentBlock) }, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'deployment.json'; a.click(); URL.revokeObjectURL(url);
  }

  return <section className="launch-section"><a href="#mint" className="text-link"><ArrowLeft size={16}/>Back to companions</a><h1>Bring the collection to life.</h1><p className="launch-intro">Collection tools for a wallet-signed Sepolia launch. Your connected wallet becomes the collection owner and first status reporter. Deployment uses test ETH for gas.</p>
    <div className="launch-panel"><Rocket size={30}/><h2>{target ? 'Collection deployed' : 'Ready for Sepolia'}</h2>
      <dl className="launch-facts"><div><dt>Collection</dt><dd>Squeek Companion (SQUEEK)</dd></div><div><dt>Network</dt><dd>Sepolia · 11155111</dd></div><div><dt>Mint rules</dt><dd>Free · one mint per wallet</dd></div><div><dt>SqueekCore</dt><dd><a href={`https://sepolia.etherscan.io/address/${CORE_ADDRESS}`} target="_blank" rel="noreferrer">{CORE_ADDRESS}<ArrowUpRight size={14}/></a></dd></div></dl>
      {target && <p className="contract-address"><a href={`https://sepolia.etherscan.io/address/${target.collectionAddress}`} target="_blank" rel="noreferrer">{target.collectionAddress}<ArrowUpRight size={16}/></a></p>}
      {!isConnected ? <button type="button" className="button primary" onClick={connect}><Wallet size={18}/>Connect wallet</button> : !correctChain ? <button type="button" className="button primary" onClick={() => void switchChainAsync({ chainId: chain.id }).catch(e => setError(friendlyError(e)))}>Switch to Sepolia</button> : !target ? <button type="button" className="button primary" onClick={() => void deploy()} disabled={!!pending || !walletClient}>{pending === 'deploy' ? <LoaderCircle size={18} className="spinner"/> : <Rocket size={18}/>} {pending === 'deploy' ? 'Deploying collection…' : !walletClient ? 'Preparing your wallet…' : 'Deploy with connected wallet'}</button> : <div className="launch-actions"><button type="button" className="button primary" onClick={downloadConfig}><Download size={18}/>Download deployment.json</button><button type="button" className="button secondary" onClick={() => void publish()} disabled={!!pending || !walletClient}>{pending === 'publish' ? <LoaderCircle size={18} className="spinner"/> : <Radio size={18}/>}Publish current reading</button></div>}
      {created && <p className="launch-instruction">Save the downloaded file as <code>public/deployment.json</code>, rebuild, and hand the export to the publisher. This browser’s deployment is not automatically shared with visitors.</p>}
      {published && <p className="success-note" role="status"><CheckCircle2 size={18}/>Current reading published. RPM traits stay fresh for 120 seconds.</p>}
      <p className="inline-error" role="status">{error}</p>
      {hash && <p className="transaction-note"><a href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer">View transaction on Sepolia <ArrowUpRight size={15}/></a></p>}
    </div>
    <div className="launch-detail"><h2>Keep the little heartbeat going</h2><p>The public site reads Squeekchain every 15 seconds. The contract cannot fetch an HTTPS API. To keep portable RPM metadata current, the designated reporter must publish fresh readings before the 120-second expiry. Use the control above for a manual update, or integrate the included calldata script with an authorized transaction signer. Settled block progress is read directly from SqueekCore.</p><p>The owner can rotate the reporter with <code>setReporter(address)</code>. Reporter permissions only affect telemetry; minting and transfers are always available.</p><a href="./contract/SqueekCompanion.json" download className="text-link"><Download size={16}/>Download ABI and deployment bytecode</a></div>
  </section>;
}

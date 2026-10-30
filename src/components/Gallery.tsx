import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, RefreshCw, PawPrint, Wallet } from 'lucide-react';
import type { Address } from 'viem';
import { abi, publicClient, type Deployment } from '../lib/config';
import { MOODS, type Mood } from '../lib/status';
import { CompanionArt } from './CompanionArt';

type Item = { id: bigint; owner: string };
export function Gallery({ deployment, supply, address, mood, connect, configurationError, onRetry }: {
  deployment?: Deployment | null; supply?: bigint; address?: Address; mood: Mood; connect: () => void; configurationError?: string; onRetry: () => void;
}) {
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(0);
  const gallery = useQuery({
    queryKey: ['gallery', deployment?.collectionAddress, supply?.toString(), address, mine, page],
    enabled: !!deployment && supply !== undefined && (!mine || !!address),
    queryFn: async (): Promise<{ items: Item[]; total: bigint }> => {
      if (!deployment || supply === undefined) return { items: [], total: 0n };
      const base = { address: deployment.collectionAddress, abi };
      const blockNumber = await publicClient.getBlockNumber();
      if (mine && address) {
        // ERC-721 balances can include transferred companions. Scan bounded ownership pages,
        // rather than equating hasMinted with current ownership.
        const balance = await publicClient.readContract({ ...base, functionName: 'balanceOf', args: [address], blockNumber }) as bigint;
        if (balance === 0n) return { items: [], total: 0n };
      }
      const last = supply - BigInt(page * 6);
      const ids = Array.from({ length: Number(last > 6n ? 6n : last > 0n ? last : 0n) }, (_, i) => last - BigInt(i));
      const owners = await Promise.all(ids.map(id => publicClient.readContract({ ...base, functionName: 'ownerOf', args: [id], blockNumber }) as Promise<string>));
      return { items: ids.map((id, i) => ({ id, owner: owners[i] })).filter(item => !mine || item.owner.toLowerCase() === address?.toLowerCase()), total: supply };
    }, refetchInterval: 20_000, retry: 1,
  });

  const error = configurationError || (gallery.isError ? 'The collection could not be loaded. Try again in a moment.' : '');
  return <section id="gallery" className="gallery-section section-anchor">
    <div className="section-heading"><div><h2>Good company, onchain.</h2><p className="muted">Every companion follows the same little heartbeat.</p></div><div className="segmented" aria-label="Gallery filters">
      <button type="button" aria-pressed={!mine} onClick={() => { setMine(false); setPage(0); }}>All companions</button>
      <button type="button" aria-pressed={mine} onClick={() => { setMine(true); setPage(0); }}>My companions</button>
    </div></div>
    {error ? <div className="gallery-empty"><RefreshCw size={32}/><h3>Let’s try that again</h3><p>{error}</p><button className="button secondary" onClick={() => { onRetry(); if (deployment) void gallery.refetch(); }} type="button">Retry gallery</button></div>
      : mine && !address ? <div className="gallery-empty"><Wallet size={36}/><h3>A familiar face is waiting</h3><p>Connect your wallet to find your companions.</p><button type="button" className="button secondary" onClick={connect}>Connect to view yours</button></div>
      : !deployment ? <div className="gallery-empty"><div className="empty-paw"><PawPrint size={32}/></div><h3>A little room for everyone</h3><p>The gallery opens with the first mint.<br/>The collection is awaiting its Sepolia launch.</p><a className="text-link" href="#mint">Meet your companion <span aria-hidden="true">↗</span></a></div>
      : gallery.isPending ? <div className="gallery-empty" role="status"><RefreshCw size={28} className="spinner"/><p>Looking for companions…</p></div>
      : <>
        {gallery.data?.items.length ? <div className="gallery-grid">{gallery.data.items.map(item => <article className="nft-card" key={String(item.id)}>
          <div className={`nft-art art-${mood}`}><CompanionArt mood={mood} variant={Number(item.id % 4n)}/><span className={`mood-tag mood-${mood}`}>{MOODS[mood].label}</span></div>
          <div className="nft-details"><h3>Companion #{String(item.id)}</h3><a href={`https://sepolia.etherscan.io/token/${deployment.collectionAddress}?a=${item.id}`} target="_blank" rel="noreferrer" aria-label={`View companion ${item.id} on Sepolia Etherscan`}><ArrowUpRight size={20}/></a></div>
          <p className="muted">Held by <span title={item.owner}>{item.owner.slice(0, 6)}…{item.owner.slice(-4)}</span> · Live view</p>
        </article>)}</div> : <div className="gallery-empty"><PawPrint size={32}/><h3>{mine ? 'No companions on this page' : 'Be the first little face'}</h3><p>{mine ? 'Browse another page for companions held by your wallet.' : 'Mint a companion and start the collection.'}</p></div>}
        {supply !== undefined && supply > 6n && <div className="pagination"><button type="button" className="button secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Newer</button><span>Page {page + 1} of {String((supply + 5n) / 6n)}</span><button type="button" className="button secondary" disabled={BigInt((page + 1) * 6) >= supply} onClick={() => setPage(p => p + 1)}>Older</button></div>}
        <p className="gallery-caption">Artwork and live traits follow the API. Marketplace metadata follows the collection’s published readings.</p>
      </>}
  </section>;
}

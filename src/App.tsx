import { lazy, Suspense, useEffect, useState } from 'react';
import { useAccount, useDisconnect, useSwitchChain, useWalletClient } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { getAddress } from 'viem';
import { ArrowRight, ArrowUpRight, CheckCircle2, ChevronDown, CircleHelp, Heart, LoaderCircle, Moon, PawPrint, Radio, RefreshCw, Sparkles, Wallet, Wind, Zap } from 'lucide-react';
import { abi, chain, friendlyError, publicClient } from './lib/config';
import { moodFor, MOODS, progressText, rpmText, type Mood } from './lib/status';
import { useCollection, useDeployment, useHamster } from './hooks';
import { CompanionArt } from './components/CompanionArt';
import { WalletSheet } from './components/WalletSheet';
import { Gallery } from './components/Gallery';

const Launch = lazy(() => import('./components/Launch'));
type MintState = 'idle' | 'wallet' | 'confirming' | 'success';

function Brand() {
  return <a className="brand" href="#mint" aria-label="Squeek Companion home"><img width="42" height="42" src="./favicon.svg" alt=""/><span>Squeek <span className="brand-light">Companion</span></span></a>;
}

export default function App() {
  const { address, chainId, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();
  const hamster = useHamster();
  const deployment = useDeployment();
  const collection = useCollection(deployment.data, address);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletMenu, setWalletMenu] = useState(false);
  const [previewMood, setPreviewMood] = useState<Mood | null>(null);
  const [mintState, setMintState] = useState<MintState>('idle');
  const [mintError, setMintError] = useState('');
  const [txHash, setTxHash] = useState<string>('');
  const [now, setNow] = useState(Date.now());
  const [launch, setLaunch] = useState(location.hash === '#launch');
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 10_000); return () => clearInterval(timer); }, []);
  useEffect(() => { const update = () => setLaunch(location.hash === '#launch'); addEventListener('hashchange', update); return () => removeEventListener('hashchange', update); }, []);
  useEffect(() => {
    if (!launch && ['#mint', '#gallery', '#how-it-works'].includes(location.hash)) {
      requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' }));
    }
  }, [launch]);
  useEffect(() => { if (!isConnected) setWalletMenu(false); }, [isConnected]);
  const data = hamster.data;
  const fresh = !!data?.fresh && !hamster.isError && now - data.observedAt < data.staleAfterSeconds * 1000;
  const status = data ? { ...data, fresh } : null;
  const mood = moodFor(status);
  const displayedMood = previewMood ?? mood;
  const wrongChain = isConnected && chainId !== chain.id;
  const busy = mintState === 'wallet' || mintState === 'confirming';
  const launched = !!deployment.data;
  const minted = collection.data?.hasMinted === true;
  const connect = () => setWalletOpen(true);

  async function switchNetwork() {
    setMintError('');
    try { await switchChainAsync({ chainId: chain.id }); }
    catch (error) { setMintError(friendlyError(error)); }
  }

  async function mint() {
    if (!isConnected) { connect(); return; }
    if (wrongChain) { await switchNetwork(); return; }
    if (!walletClient || !address || !deployment.data || busy || minted) return;
    setMintError(''); setTxHash(''); setMintState('wallet');
    try {
      const currentChain = await walletClient.getChainId();
      if (currentChain !== chain.id) throw new Error('Wrong chain');
      const { request } = await publicClient.simulateContract({
        address: deployment.data.collectionAddress, abi, functionName: 'mint', account: address,
      });
      const hash = await walletClient.writeContract(request);
      setTxHash(hash); setMintState('confirming');
      const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000 });
      if (receipt.status !== 'success') throw new Error('Mint transaction reverted');
      setMintState('success');
      await queryClient.invalidateQueries({ queryKey: ['collection'] });
      await queryClient.invalidateQueries({ queryKey: ['gallery'] });
    } catch (error) { setMintError(friendlyError(error)); setMintState('idle'); }
  }

  const primaryLabel = !isConnected ? 'Connect to mint' : wrongChain ? switching ? 'Switching network…' : 'Switch to Sepolia'
    : busy ? mintState === 'wallet' ? 'Confirm in your wallet…' : 'Minting your companion…'
    : minted ? 'Companion minted' : !launched ? 'Mint opens after launch' : collection.isPending ? 'Checking your wallet…' : !walletClient ? 'Preparing your wallet…' : 'Mint a companion';
  const primaryDisabled = isConnected && !wrongChain && (busy || minted || !launched || collection.isPending || collection.isError || !walletClient);
  const Icon = displayedMood === 'resting' ? Moon : displayedMood === 'energetic' ? Zap : displayedMood === 'active' ? Wind : Radio;

  return <>
    <a href="#main" className="skip-link">Skip to content</a>
    <header className="site-header page-width"><Brand/><nav aria-label="Main navigation"><a href="#mint" aria-current={!launch ? 'page' : undefined}>Meet your companion</a><a href="#gallery">Gallery</a><a href="#how-it-works">How it works</a></nav>
      <div className="header-end">{isConnected && address ? <div className="account-control"><button type="button" className="account-button" onClick={() => wrongChain ? void switchNetwork() : setWalletMenu(v => !v)} aria-expanded={walletMenu}>{wrongChain ? 'Switch to Sepolia' : `${getAddress(address).slice(0, 6)}…${address.slice(-4)}`}<ChevronDown size={14}/></button>{walletMenu && <button type="button" className="disconnect-button" onClick={() => disconnect()}>Disconnect wallet</button>}</div> : <span className="network-label"><span className="network-diamond" aria-hidden="true"/>Sepolia testnet</span>}</div>
    </header>
    {launch ? <main id="main" className="page-width"><Suspense fallback={<p className="launch-loading">Loading collection tools…</p>}><Launch connect={connect} deployment={deployment.data ?? null}/></Suspense></main> : <main id="main">
      <section id="mint" className="hero page-width section-anchor">
        <div className="hero-copy">
          <h1>A tiny companion.<br/><span>Always in sync.</span></h1>
          <p className="hero-description">A living NFT that follows the real Squeekchain hamster. When it spins, you shine. When it rests, you rest.</p>
          <div className="mint-area">
            <div className="mint-facts"><span><Sparkles size={16}/>Free mint</span><span><PawPrint size={16}/>1 per wallet</span></div>
            <button type="button" className="button primary mint-button" onClick={() => void mint()} disabled={primaryDisabled || switching}>{busy || switching ? <LoaderCircle size={20} className="spinner"/> : minted ? <CheckCircle2 size={20}/> : <Wallet size={20}/>}<span>{primaryLabel}</span>{!busy && !minted && <ArrowRight size={20}/>}</button>
            <p className="mint-note">{minted ? 'Your companion is waiting in the gallery.' : launched ? '0 ETH + Sepolia gas. A little friend, for keeps.' : 'Minting opens after the collection’s Sepolia launch.'}</p>
            {deployment.isError && <p className="inline-error" role="status">{deployment.error.message} <button type="button" className="inline-link" onClick={() => void deployment.refetch()}>Retry</button></p>}
            {collection.isError && <p className="inline-error" role="status">Unable to check mint eligibility. <button type="button" className="inline-link" onClick={() => void collection.refetch()}>Try again</button></p>}
            <p className="inline-error" role="status">{mintError}</p>
            {txHash && <p className="transaction-note" role="status">{mintState === 'success' ? 'Welcome to the little wheel club.' : mintState === 'confirming' ? 'Waiting for Sepolia confirmation.' : 'Check the transaction before retrying.'} <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">View transaction <ArrowUpRight size={14}/></a></p>}
          </div>
          <div className="hero-footnote"><span className="tiny-companion"><Heart size={17}/></span><p>One real hamster.<br/><strong>A whole lot of company.</strong></p></div>
        </div>
        <div className="hero-preview">
          <div className={`art-frame art-${displayedMood}`}>
            <div className="art-topline"><span><span className={`status-dot ${fresh ? 'online' : ''}`}/>{previewMood ? 'Style preview' : fresh ? 'Following the hamster' : 'Waiting for the hamster'}</span><span className="art-edition">Collection preview</span></div>
            <CompanionArt mood={displayedMood}/>
            <div className="art-bottomline"><div><span className="preview-kicker">Your future little friend</span><h2>Squeek Companion</h2></div><span className={`mood-tag mood-${displayedMood}`}><Icon size={14}/>{MOODS[displayedMood].label}</span></div>
          </div>
          <div className="preview-controls"><span>Meet every mood</span><div className="mood-buttons" aria-label="Preview companion styles">{(['resting', 'active', 'energetic'] as Mood[]).map(m => <button type="button" key={m} aria-label={`Preview ${m} style`} aria-pressed={previewMood === m} className={`mood-swatch swatch-${m}`} onClick={() => setPreviewMood(m)}>{m === 'resting' ? <Moon size={16}/> : m === 'active' ? <Wind size={16}/> : <Zap size={16}/>}</button>)}<button type="button" className="live-reset" aria-pressed={previewMood === null} onClick={() => setPreviewMood(null)}><Radio size={14}/>Live</button></div></div>
        </div>
      </section>

      <section className="status-section page-width" aria-labelledby="status-heading">
        <div className="status-intro"><div className="status-icon"><Radio size={23}/></div><div><h2 id="status-heading">The hamster right now</h2><div className="feed-status"><span className={`status-dot ${fresh ? 'online' : ''}`}/><span>{hamster.isPending ? 'Connecting to the wheel…' : hamster.isError ? 'Feed unavailable' : !fresh ? 'Signal is out of date' : data?.provenance !== 'hardware' ? `${data?.provenance} reading` : 'Live from Squeekchain'}</span><button className="refresh-button" type="button" onClick={() => void hamster.refetch()} disabled={hamster.isFetching} aria-label="Refresh hamster status"><RefreshCw size={14} className={hamster.isFetching ? 'spinner' : ''}/></button></div></div></div>
        <div className="status-stat"><span>Wheel speed</span><strong>{fresh && data ? rpmText(data.rpmMilli) : '—'} <small>rpm</small></strong><span>{MOODS[mood].wheel}</span></div>
        <div className="status-stat progress-stat"><span>Next Squeek block</span><strong>{data?.blockHeight !== null && data?.blockHeight !== undefined ? `#${(data.blockHeight + 1n).toLocaleString('en-US')}` : 'Awaiting data'}</strong><div className="progress-row"><progress max="1000000000" value={data?.blockProgress !== null && data?.blockProgress !== undefined ? Number(data.blockProgress) : 0} aria-label="Settled progress to the next Squeek block"/><span>{data?.blockProgress !== null && data?.blockProgress !== undefined ? progressText(data.blockProgress) : 'Unknown'}</span></div></div>
        <div className="status-stat mood-stat"><span>Companion mood</span><strong><span className={`mood-dot dot-${mood}`}/>{MOODS[mood].label}</strong><span>{fresh ? 'All companions are in sync' : 'Waiting for a fresh reading'}</span></div>
        {(hamster.isError || (!fresh && !hamster.isPending)) && <p className="feed-warning">The live feed is unavailable or stale. Last known block data stays visible; wheel activity is unknown. <button type="button" className="inline-link" onClick={() => void hamster.refetch()}>Retry feed</button></p>}
      </section>

      <div className="page-width"><Gallery deployment={deployment.data} supply={collection.data?.supply} address={address} mood={mood} connect={connect} onRetry={() => { void deployment.refetch(); if (deployment.data) void collection.refetch(); }} configurationError={deployment.isError ? deployment.error.message : collection.isError ? 'Unable to read the collection. Please try again.' : undefined}/></div>

      <section id="how-it-works" className="how-section section-anchor"><div className="page-width"><div className="section-heading"><div><h2>A little life onchain.</h2><p className="muted">Same companion. A different kind of day.</p></div><span className="handdrawn-heart" aria-hidden="true"><Heart size={32} strokeWidth={1.2}/></span></div><div className="steps-grid">
        <article><span className="step-icon"><Wallet size={25}/></span><h3>Make a little room</h3><p>Connect your wallet on Sepolia. Mint one companion for free; you only cover testnet gas.</p></article>
        <article><span className="step-icon"><Radio size={25}/></span><h3>Follow the real wheel</h3><p>Real Squeekchain readings shape your companion’s mood, energy, and block progress.</p></article>
        <article><span className="step-icon"><Moon size={25}/></span><h3>Let life happen</h3><p>Fast spins bring a golden burst of energy. Idle moments bring soft colors and sleepy eyes.</p></article>
      </div></div></section>

      <section className="faq-section page-width"><div><h2>Small questions.<br/>{' '}Happy answers.</h2><p className="muted">A few things before you bring one home.</p><a href="https://docs.squeekchain.com/" className="text-link" target="_blank" rel="noreferrer">Explore Squeekchain <ArrowUpRight size={16}/></a></div><div className="faq-list">
        <details><summary>Is it really free?<ChevronDown size={18}/></summary><p>Yes. The mint price is 0 ETH, and each wallet can mint once. You need Sepolia test ETH to cover network gas. Transferring your companion does not reset your wallet’s mint allowance.</p></details>
        <details><summary>What makes my companion change?<ChevronDown size={18}/></summary><p>The real hamster’s wheel speed and activity decide its mood. Idle means resting. An active wheel below 60 rpm means active; at 60 rpm or above it becomes energetic. Settled Squeek block progress changes the progress trait. Every companion shares the hamster’s current mood.</p></details>
        <details><summary>Does it update in my wallet too?<ChevronDown size={18}/></summary><p>The site checks the public status feed every 15 seconds. NFT metadata reads settled block progress from SqueekCore and the last API reading published by the collection’s designated reporter. A reporter must keep publishing for live RPM traits; after 120 seconds a reading is marked unknown. Wallets and marketplaces may cache artwork and need a metadata refresh.</p></details>
        <details><summary>What happens when the hamster rests?<ChevronDown size={18}/></summary><p>Your companion gets cozy with lavender colors and sleepy eyes. A missing or stale feed is shown as “Awaiting signal,” so a lost connection is never mistaken for a nap.</p></details>
        <details><summary>Is this the official Squeekchain collection?<ChevronDown size={18}/></summary><p>Squeek Companion is a separate companion collection built with public Squeekchain data. It does not earn SQK or grant rewards, and it is not the Squeekchain Squeeks collection.</p></details>
      </div></section>
    </main>}
    <footer className="site-footer page-width"><Brand/><span>A little life. A little company.</span><div><a href="https://api.squeekchain.com/v1/status" target="_blank" rel="noreferrer">Data source <ArrowUpRight size={14}/></a>{deployment.data ? <a href={`https://sepolia.etherscan.io/address/${deployment.data.collectionAddress}`} target="_blank" rel="noreferrer">Contract <ArrowUpRight size={14}/></a> : <a href="#launch">Collection launch <ArrowUpRight size={14}/></a>}<a href="#how-it-works" aria-label="How Squeek Companion works"><CircleHelp size={18}/></a></div></footer>
    <WalletSheet open={walletOpen} onClose={() => setWalletOpen(false)}/>
  </>;
}

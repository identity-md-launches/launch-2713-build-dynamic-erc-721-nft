import { useEffect, useRef, useState } from 'react';
import { useConnect, type Connector } from 'wagmi';
import { X, Wallet, ArrowUpRight, LoaderCircle } from 'lucide-react';
import { friendlyError } from '../lib/config';

const COINBASE_MARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" rx="7" fill="#2c5ff6"/><circle cx="14" cy="14" r="10" fill="white"/><rect x="10.5" y="10.5" width="7" height="7" rx="1" fill="#2c5ff6"/></svg>';
const iconURI = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const OPEN_IN = [
  { name: 'MetaMask', icon: './wallets/metamask.svg', href: (url: string) => `https://link.metamask.io/dapp/${url.replace(/^https?:\/\//, '')}` },
  { name: 'Coinbase Wallet', icon: iconURI(COINBASE_MARK), href: (url: string) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}` },
  { name: 'Rabby', icon: './wallets/rabby.svg', href: (url: string) => `https://go.rabby.io/mobile/?_cmd=open-dapp&dapp=${encodeURIComponent(url)}` },
  { name: 'Phantom', icon: './wallets/phantom.svg', href: (url: string) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}` },
];

export function WalletSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { connectors, connectAsync, isPending, variables } = useConnect();
  const [error, setError] = useState('');
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !(window as any).ethereum;
  const named = connectors.some(c => c.type === 'injected' && c.id !== 'injected');
  const listed = [...connectors.filter(c => c.type === 'injected'), ...connectors.filter(c => c.type !== 'injected')]
    .filter(c => !(c.id === 'injected' && named) && (!mobile || c.type !== 'injected'));
  useEffect(() => {
    if (open) { setError(''); dialog.current?.showModal(); }
    else dialog.current?.close();
  }, [open]);

  async function connect(connector: Connector) {
    setError('');
    try { await connectAsync({ connector }); onClose(); }
    catch (e) { setError(friendlyError(e)); }
  }

  return <dialog ref={dialog} className="wallet-sheet" onCancel={onClose} onClose={onClose} onClick={e => { if (e.target === dialog.current) { const r = dialog.current.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }} aria-labelledby="wallet-title">
    <div className="sheet-head"><h2 id="wallet-title">A home for your companion</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Close wallet picker"><X size={20}/></button></div>
    <p className="muted">Connect a wallet to mint on Sepolia.</p>
    <div className="wallet-list">
      {mobile && OPEN_IN.map(wallet => <a className="wallet-row" key={wallet.name} href={wallet.href(location.href)}><img src={wallet.icon} width="28" height="28" alt=""/><span>Open in {wallet.name}</span><ArrowUpRight size={18}/></a>)}
      {listed.map(c => <button key={c.uid} type="button" className="wallet-row" onClick={() => void connect(c)} disabled={isPending}>
        {c.icon ? <img width="28" height="28" src={c.icon} alt=""/> : c.id === 'coinbaseWalletSDK' ? <img width="28" height="28" src={iconURI(COINBASE_MARK)} alt=""/> : <Wallet size={28}/>}
        <span>{c.id === 'injected' ? 'Browser wallet' : c.id === 'coinbaseWalletSDK' ? mobile ? 'Coinbase Smart Wallet' : 'Coinbase Wallet' : c.name}{isPending && variables?.connector === c ? ' · Opening…' : ''}</span>
        {isPending && variables?.connector === c ? <LoaderCircle size={18} className="spinner"/> : <ArrowUpRight size={18}/>}
      </button>)}
    </div>
    <p className="inline-error" role="status">{error}</p>
    <div className="sheet-note"><Wallet size={16}/><span>Connecting never sends a transaction.</span></div>
  </dialog>;
}

import { useId } from 'react';
import type { Mood } from '../lib/status';

export function CompanionArt({ mood = 'resting', variant = 0, className = '' }: { mood?: Mood; variant?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  const resting = mood === 'resting';
  const fast = mood === 'energetic';
  const unknown = mood === 'unknown';
  const fur = ['#d69d68', '#bc967b', '#d5af71', '#b89c89'][variant % 4];
  const furLight = ['#f0c78e', '#e5c6a8', '#f1d399', '#dcc8b7'][variant % 4];
  return <svg className={`companion-art ${className}`} viewBox="0 0 600 510" role="img" aria-label={`An illustrated ${unknown ? 'quiet' : mood} hamster companion ${resting ? 'curled up beside its wheel' : 'with its exercise wheel'}`}>
    <defs>
      <linearGradient id={`${id}-fur`} x1="0" y1="0" x2=".7" y2="1"><stop stopColor={furLight}/><stop offset="1" stopColor={fur}/></linearGradient>
      <linearGradient id={`${id}-belly`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff0d5"/><stop offset="1" stopColor="#f9dcb5"/></linearGradient>
      <pattern id={`${id}-dots`} width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#746888" opacity=".13"/></pattern>
    </defs>
    <rect width="600" height="510" fill={`url(#${id}-dots)`}/>
    <circle cx="315" cy="242" r="177" fill={fast ? '#f4d59c' : mood === 'active' ? '#dbe6ce' : '#e4deed'}/>
    <circle cx="315" cy="242" r="143" fill="none" stroke={fast ? '#dfb875' : '#c7bbd8'} strokeWidth="20"/>
    <circle cx="315" cy="242" r="138" fill="none" stroke="#fff" strokeWidth="2" opacity=".6"/>
    <g stroke={fast ? '#cfaa6f' : '#baaecc'} strokeWidth="8" strokeLinecap="round" opacity=".65">
      <path d="M315 100v32m100 10-23 23m66 77h-32m-11 100-23-23m-77 65v-32m-100-10 23-23m-65-77h32m10-100 23 23"/>
    </g>
    <path d="M315 242v180m-69 0h139" stroke="#b7a9ca" strokeWidth="17" fill="none" strokeLinecap="round"/>
    <circle cx="315" cy="242" r="14" fill="#a99abc"/>
    <ellipse cx="301" cy="433" rx="185" ry="18" fill="#a595b5" opacity=".15"/>
    {!resting && !unknown && <g stroke={fast ? '#aa7a36' : '#93a480'} strokeWidth="5" strokeLinecap="round"><path d="m117 190-23 9m24 15-33 6m398 81 25-10m-29 32 34-5"/>{fast && <path d="m111 112 17-27-2 26h18l-24 31 6-28zm377 78 18-27-4 27h18l-25 30 7-27z" fill="#e9b34e" stroke="none"/>}</g>}
    <g transform={resting ? 'translate(-8 16) rotate(-6 300 320)' : 'translate(0 -4)'}>
      <path d="M232 210c-34-32-54-9-43 22 3 10 14 18 27 21m147-43c34-32 54-9 43 22-3 10-14 18-27 21" fill={fur} stroke="#c89161" strokeWidth="2"/>
      <ellipse cx="209" cy="220" rx="17" ry="22" transform="rotate(-28 209 220)" fill="#d99c97"/>
      <ellipse cx="386" cy="220" rx="17" ry="22" transform="rotate(28 386 220)" fill="#d99c97"/>
      <path d="M183 333c-6-39 11-81 48-107 20-15 44-20 67-20 31 0 62 10 83 33 27 28 42 62 34 103-7 41-44 75-114 75-68 0-111-35-118-84z" fill={`url(#${id}-fur)`}/>
      <path d="M229 284c16-8 32-7 48-1 13 5 29 4 42 0 23-8 46-4 59 16 11 16 11 40 3 59-14 30-42 43-78 43-38 0-72-16-84-47-12-30-8-58 10-70z" fill={`url(#${id}-belly)`}/>
      <path d="M275 209q-6 27-26 38m46-42q-1 20-10 35m29-34q7 22 20 34" stroke="#d29b69" strokeWidth="3" fill="none" opacity=".35"/>
      {resting ? <g fill="none" stroke="#554039" strokeWidth="5" strokeLinecap="round"><path d="M238 296q12 13 26-1m67 0q12 13 26-1"/></g> : <g><ellipse cx="251" cy="289" rx="7" ry="9" fill="#48362f"/><ellipse cx="344" cy="289" rx="7" ry="9" fill="#48362f"/><circle cx="253" cy="286" r="2" fill="#fff"/><circle cx="346" cy="286" r="2" fill="#fff"/></g>}
      <ellipse cx="231" cy="316" rx="17" ry="10" fill="#d89287" opacity=".4"/><ellipse cx="364" cy="316" rx="17" ry="10" fill="#d89287" opacity=".4"/>
      <path d="M288 311q10-8 20 0-2 10-10 11-8-1-10-11" fill="#b97777"/>
      <path d="M298 322v7m-10 0q10 12 20 0" fill="none" stroke="#715148" strokeWidth="2.5" strokeLinecap="round"/>
      <g stroke="#96745f" strokeWidth="1.8" strokeLinecap="round" opacity=".7"><path d="m263 321-41-6m40 13-43 5m112-12 41-7m-40 13 44 6"/></g>
      <ellipse cx="235" cy="397" rx="31" ry="13" fill="#b7825e"/><ellipse cx="359" cy="397" rx="31" ry="13" fill="#b7825e"/>
      <path d="M241 354q-16 17 3 26m112-26q16 17-3 26" stroke="#c18c61" fill="none" strokeWidth="13" strokeLinecap="round"/>
      <path d="M282 364q15-10 31 0l-4 30q-11 8-24-2z" fill="#9d784d"/><path d="m298 359 1 36" stroke="#c6a574" strokeWidth="2"/>
    </g>
    {(resting || unknown) && <g fill="none" stroke="#9383af" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M426 188h16l-15 18h17m2-57h23l-23 25h25m12-70h29l-28 32h30"/></g>}
    <g fill={fast ? '#be8b3b' : '#a395bb'}><path d="m126 323 3 9 9 3-9 3-3 9-3-9-9-3 9-3zm333 56 3 9 9 3-9 3-3 9-3-9-9-3 9-3z"/><circle cx="154" cy="270" r="3"/><circle cx="459" cy="250" r="3"/></g>
    <g transform="translate(454 406) rotate(15)" fill="#a2a67d"><ellipse cx="0" cy="0" rx="7" ry="17" transform="rotate(-30)"/><ellipse cx="16" cy="-7" rx="7" ry="17" transform="rotate(28 16 -7)"/><path d="M7-1v31" fill="none" stroke="#929b6c" strokeWidth="3"/></g>
  </svg>;
}

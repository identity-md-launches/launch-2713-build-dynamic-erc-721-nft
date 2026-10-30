# Squeek Companion

A free ERC-721 companion collection for Sepolia, with a static React mint site and original SVG hamster artwork. The page follows real Squeekchain measurements, offers resting, active and energetic style previews, and reads actual minted companions from the collection.

## Delivery status

The deployable contract, source, locked dependencies and production `dist/` export are included. **No public Sepolia deployment transaction has been submitted by this worker. No hosted frontend URL is claimed.** The network publishes the committed export after review. `public/deployment.json` intentionally has a null collection address and deployment block, so the site says minting opens after launch instead of pointing at an invented address.

The page can connect wallets before deployment. A real deployment can be made through the wallet-signed collection tools at `#launch`, or by the network's deployer using `public/contract/SqueekCompanion.json`. This file includes the ABI, creation bytecode, compiler version, runtime hash and size information. Constructor argument: the actual collection owner's address. The browser deployment supplies the connected wallet explicitly as that argument; the constructor never uses the factory as an implicit owner.

## Install, preview and rebuild

Use Node 22 or newer. Install normal dependencies; no npm registry mirror or vendored package archive is required.

```sh
npm ci
npm run dev
```

Production:

```sh
npm run typecheck
npm run build
npm run preview
```

`build` compiles Solidity with pinned solc 0.8.26, typechecks TypeScript and runs Vite. The resulting `dist/` is the complete static export. Vite uses `base: './'`; assets, fonts, favicon, social card, ABI and deployment configuration are local. There is no backend and no server rewrite requirement. Hash navigation supports static gateway subpaths. Build and contract tests require no external network after dependencies are installed; the live integration check is separate.

The generated `src/generated/companion.json` and `public/contract/SqueekCompanion.json` are rebuilt from the source. Keep both generated artifacts and `dist/` alongside the source and lockfile in the submission. Do not include `node_modules`, local caches or `test/scratch`. See `BUNDLE.md` for the explicit path budget.

## Mint and collection rules

- Mint price: **0 ETH**. The wallet still pays Sepolia network gas.
- One successful mint per wallet, for that wallet's lifetime. Sending the NFT away does not restore eligibility. Receiving an NFT does not consume a mint allowance; a wallet may hold multiple transferred NFTs.
- No artificial supply cap was requested. Token IDs start at 1 and increase with successful mints.
- Standard ERC-721 ownership, approvals and safe transfers. No administrative mint, pause, blacklist, seizure, fees, proxy or upgrade path.
- Owner permissions only manage the API reporter and ownership. Ownership transfer uses OpenZeppelin's two-step acceptance.
- These companions are separate from the official Squeekchain Squeeks collection and do not earn SQK rewards.

## How the dynamic traits work

The UI polls [the status API](https://api.squeekchain.com/v1/status) every 15 seconds. It validates schema version 1 and the measurement fields. `rpmMilli / 1000` gives rpm; explicit `coreStatus` determines activity. An IDLE reading remains resting even if a residual RPM measurement is nonzero. Hardware, simulated, replay and derived provenance are distinguished in the page's status label.

| Valid current reading | Mood and artwork |
| --- | --- |
| IDLE | Resting, lavender palette, closed eyes |
| ACTIVE, below 60 rpm | Active, green palette, open eyes |
| ACTIVE, at least 60 rpm | Energetic, golden palette and energy marks |
| Missing, failed, faulted or expired | Awaiting signal; no claim of sleeping or zero speed |

The site's block display uses the **settled `builder.anchor`**, not optimistic projected progress. A block is 1,000,000,000 block units. No measurement or progress is randomly generated. The preview controls are clearly marked as style previews and do not alter the real status feed or the NFT.

Solidity cannot fetch an HTTPS API. The NFT's portable `tokenURI` therefore combines:

1. **Live settled progress:** reads the pinned Sepolia SqueekCore proxy, `0x74665dAecA35A2303e767E76a2FF1FB6F93e119f`, using its published V3 `state()` tuple. A 50,000 gas call budget and ledger consistency checks keep upstream faults from breaking the collection. `coreAvailable` distinguishes missing data from real zero values.
2. **Reported wheel measurements:** a designated reporter calls `publishStatus(rpmMilli, spinning, observedAt, revisionHash)` from a fresh API reading. Only that reporter can publish. Replay, future, stale and empty-revision inputs revert. The revision hash is an audit pointer, **not a proof of the API signature**; RPM authenticity relies on the reporter.

RPM observations expire after 120 seconds. Uninitialized or expired metadata says `Signal unavailable` and `Wheel state: Unknown`. The last observed numeric RPM and measurement timestamp remain in the metadata as historical fields. On-chain progress stays independently dynamic. JSON metadata and SVG artwork are embedded as Base64 data URIs, with no image server required. Publishing emits ERC-4906 `BatchMetadataUpdate`; independent progress changes and expiry are read-time changes, and marketplaces may require a manual cache refresh.

The gallery renders actual `ownerOf` records, six newest token IDs per page, with live API artwork. “My companions” filters the current page by current ownership; page controls let the visitor inspect older tokens. It does not mistake mint history for current ownership and does not invent an indexed global ownership feed. The “Live view” label distinguishes the site's live artwork from the last published marketplace metadata.

## Wallet connections

The pinned wallet pattern is implemented with wagmi, viem and React Query:

- EIP-6963 discovers browser extensions by name and icon. A generic “Browser wallet” row appears only when no named extension is found.
- Phones can open the page inside MetaMask, Coinbase Wallet, Rabby or Phantom, then connect the injected wallet there.
- Coinbase Wallet supports the SDK and Smart Wallet path without a WalletConnect project ID.
- A native modal provides Escape/backdrop dismissal, focus containment and focus return. Rejections stay beside the relevant control with a retry path.
- Wrong-chain controls switch to Sepolia and fall back to adding the chain. Transactions stay disabled while the signer or eligibility check is loading.

Public RPCs: [PublicNode Sepolia](https://ethereum-sepolia-rpc.publicnode.com) and [Sepolia RPC](https://rpc.sepolia.org). No provider credentials, private keys or environment files are required by the site or included in the export.

## After launch

1. **Deploy on Sepolia.** Review `contracts/SqueekCompanion.sol`. Use the collection tools at `#launch` with a funded Sepolia wallet, or give the ABI and bytecode artifact to the network deployer with the confirmed owner's address. The constructor rejects any chain ID except 11155111. Wallet signatures are requested only after the explicit deploy action.
2. **Set the public deployment handoff.** Obtain the confirmed contract address and block from the transaction receipt. The launch tools download them as `deployment.json`. Save that file as `public/deployment.json`, run `npm run build`, and hand the export to the publisher. The browser's deployment is not automatically shared with other visitors. The page checks the deployed runtime's hash before enabling minting.
3. **Keep reported RPM current.** The initial reporter is the constructor's owner. The owner may call `setReporter(address)` to assign an actual authorized reporter; get that address from the operator who will sign updates. The setter rejects zero and emits `ReporterChanged`. The “Publish current reading” control sends one wallet-signed update. For an automation integration, `npm run status:calldata` fetches a fresh hardware reading and prepares exact calldata without signing or submitting it. Submit from the designated reporter before the 120-second expiry; schedule real updates more frequently than that. **An autonomous signer/keeper is not included or running.** Without one, portable RPM traits expire to unknown; minting and transfers continue working.
4. **Publish the rebuilt export.** Hosting and the final live URL come from the network after review. A public canonical `og:image` URL can be set after the final host is known; this export uses a relative, bundled social image for portability.

No missing address is replaced by zero, a test deployment or a burn address. Browser tests deploy only to an ephemeral local test chain; those receipts never populate the delivered public configuration.

## Checks

```sh
npm run test
npm run typecheck
npm run build
npm run check:bundle
```

Contract tests use Anvil with a fresh ephemeral Cancun chain and solc 0.8.26. They include adversarial callbacks, mint limits, transfers, reporter controls, dynamic metadata, unavailable upstream data and two seeded action sequences. No funded public wallet is needed.

The provided Chromium/Playwright runtime can validate the finished export at a gateway subpath:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright npm run test:browser -- /opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs
IMD_PLAYWRIGHT=/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

The pinned taste probe is a job input and is removed before submission; the application does not depend on it. The browser test manages its own temporary preview and local chain in one foreground process and cleans them up. It uses a test EIP-6963 provider and real contract bytecode on the local EVM, not public Sepolia or a real extension. `npm run test:live` separately checks the current public API and SqueekCore. It needs network access and is intentionally absent from the offline test suite.

Actual results, screenshots, the six-domain review, fixes and limitations are recorded in `VALIDATION.md`. `REVIEW.md` records the worker's contract review; it is not an independent audit. `DESIGN.md` documents the final implementation.

## Decisions made without a follow-up

The prior attempt stopped for a transaction signer. This delivery instead supplies a complete static application, deployable contract and explicit wallet-signed deployment path while leaving the public handoff unconfigured until there is a real receipt. The owner is supplied at deployment. The fast threshold is 60 rpm; no threshold was specified. The collection has no artificial cap; only one mint per wallet was specified. API RPM uses a trusted reporter because a static site and Solidity cannot supply an autonomous HTTPS oracle without a signer. Hosting remains the network's post-review step. None of these choices invents a wallet, deployment or live URL.

## Credits and references

Original companion illustrations are drawn in `src/components/CompanionArt.tsx`; the on-chain renderer is in the contract. DM Sans is bundled locally under the SIL Open Font License (`docs/licenses/dm-sans.txt`). Lucide supplies interface icons. Wallet marks and the RainbowKit license are in `public/wallets/`.

The design workflow follows the pinned Better Interface guide adapted from Jakub Krehel (MIT), with documentation guidance from Paul Bakaus's Impeccable (Apache-2.0). Retained notices and licenses: `docs/licenses/better-interface.txt`.

Technical references: [Squeekchain API](https://docs.squeekchain.com/developers/api/), [SqueekCore V3](https://docs.squeekchain.com/developers/core/), [Rabby's universal-link handler](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/hooks/universalLink.ts), [wagmi injected connector](https://github.com/wevm/wagmi/blob/main/packages/core/src/connectors/injected.ts).

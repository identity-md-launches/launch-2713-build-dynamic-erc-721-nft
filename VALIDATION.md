# Squeek Companion validation

Worker-side evidence, recorded 2026-10-30. These are local observations, not independent verifier certification.

## Scope and completion

**Incomplete for the full public-launch request.** The static application, contract, deployment handoff tooling and local validations are implemented. A public Sepolia deployment, an ongoing reporter operator and the network's hosted URL remain pending. No public deployment address, mint history or hosted URL has been fabricated.

The delivered export is `dist/`. Source, package manifest, lockfile, local assets and generated ABI/bytecode are included. The production handoff remains explicitly unconfigured (`collectionAddress: null`, `deploymentBlock: null`). Connection and preview interactions work before launch; signing a mint waits for a real deployment. The operator route at `#launch` can deploy through a visitor's explicitly connected wallet and download a handoff from the actual receipt.

Consequential choices: 60 rpm is the energetic threshold; IDLE is authoritative over residual RPM; mint allowance is once per wallet for its lifetime; supply has no artificial cap; HTTPS wheel measurements use a designated trusted reporter; settled block progress comes directly from the given SqueekCore proxy. All are explained in README.

## Requirement coverage

| Requirement | Result and evidence |
| --- | --- |
| Squeek Companion ERC-721 on Sepolia | Implemented and exercised on an ephemeral Cancun EVM with chain ID 11155111; public deployment pending |
| Real Squeekchain RPM, idle/spinning and block progress | Live API and on-chain tuple verified; parser handles the actual schema and units |
| Energetic when fast, resting when idle | Contract threshold tests plus live/preview UI checks; stale/fault data is unknown |
| Wallet connection | EIP-6963, mobile app links and Coinbase SDK paths implemented; named injected test provider exercised |
| Free mint, one per wallet | Real local-EVM mint, duplicate rejection, transfer-away and reload checks pass |
| Minted gallery and live traits | Real local token ownership rendered and filtered; API-driven artwork updates; gallery awaits public launch |
| Current hamster status | Live, loading, stale, fault, failed-fetch and recovered states implemented; actual public API works |
| Responsive usable website | Production export at a gateway subpath; 320/390/720/960/1440 reflow checks pass |
| Static export, local assets and lockfile | Present; Vite `base: './'`; hash navigation; no backend or remote required artwork/fonts |
| First-screen product and action at 390px | Observed in saved mobile screenshot and measured by the browser test |
| Title, favicon, description, og:title, og:image | Present; real local 1200×630 social PNG inspected |
| Production build, typecheck, useful interaction validation | Commands and outcomes below |
| Better Interface six domains and DESIGN.md | Consolidated review below; implemented tokens/components documented |
| Public Sepolia deployment and live frontend link | After review/network launch; not claimed by this worker |

## Actual check results

| Command/check | Actual result |
| --- | --- |
| `npm run build` | Exit 0; solc compilation, TypeScript and Vite export pass. Compiler 0.8.26, runtime 10,390 B, initcode 11,428 B. |
| `npm run typecheck` | Exit 0 with no TypeScript diagnostics. |
| `npm run test` | Exit 0; 18 tests pass: 12 contract subtests plus their enclosing test and 5 API/trait tests. Two seeded action sequences execute 160 mint/transfer actions. |
| `PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright npm run test:browser -- /opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs` | Exit 0; 40 interaction checks pass, no uncaught script errors or missing local resources in the validated flows. |
| Pinned `taste.mjs --out test/scratch/taste` with the provided Playwright/Chromium paths | Exit 0; **16/16 checks pass** on the final source/export. Repeated after the mobile FAQ spacing correction. |
| `node scripts/check-live.mjs` | Exit 0; public endpoint answers chain ID 11155111; status schema and SqueekCore V3 tuple decode and ledger identity pass. |
| `npm audit --omit=dev` | Zero reported vulnerabilities at the recorded run. Dependency install audit also reported zero after the pinned `tmp` override. This is an advisory lookup, not a security audit. |
| Additional rendered inspection | Loaded DM Sans Variable font face reports weight range 100–1000. Modal keyboard focus is visibly 2px violet; Escape restores focus. Background page controls never receive focus while the native modal is open. 200% CSS text enlargement at 1440px reflows without horizontal overflow. |

The browser MCP call returned `Transport closed`. The actual screenshots and interactions were performed with the provided Chromium runtime through Playwright, managed inside foreground verification commands. Each verifier starts and stops its own temporary preview; no persistent shell server is required.

Vite reports a chunk-size advisory for the main JavaScript chunk (about 664 kB, 205 kB gzip). The build succeeds. There was no Lighthouse or physical-device performance audit.

### Interaction evidence

The browser suite serves the exact export under `/preview/`, injects a named EIP-6963 test provider, and routes test RPC calls to an ephemeral local Anvil chain. It deploys the actual bundled bytecode, signs through that test provider, mines a real local mint transaction, verifies receipt success and token ownership, and reloads the page to check persisted mint eligibility. It does **not** send a public Sepolia transaction or claim a real extension was tested.

Forty checks cover: first-screen connect control, truthful empty gallery, unit conversion, preview/reset, wallet sheet routes and dismissal, keyboard FAQ, gallery filters, all five widths, stale/failed/recovered feed, maximum uint32 RPM and uint64 block values, reduced motion, four phone app links plus Coinbase Smart Wallet, named-provider discovery, connection rejection, unknown-chain addition, network switch, mint rejection/retry, confirmed mint, duplicate control, actual ownership rendering, reconnect after reload, wallet-signed operator deployment, handoff download, owner assignment and reporter publication.

`docs/evidence/interaction-results.json` retains the actual check names and limitations. Test-only API fixtures and receipt addresses remain in `test/scratch`; they are not production data or deployment configuration. The final source change after the interaction suite was the FAQ's explicit word space, with no transaction or wallet logic change; that copy correction was checked by the subsequent render probe and screenshot.

### Live evidence

At `2026-10-30T09:53:05.516Z`, the actual status endpoint returned a fresh hardware IDLE measurement, 0 rpm, observed at `2026-10-30T09:53:02.749Z`. The direct Core read reported settled height 13,095 and block progress 604,188,187 billionths, with the cumulative-unit identity satisfied. These are a recorded observation, not constants used by the site. API anchor state and direct current Core state can differ because the API is an indexed view. The UI labels and displays the API's settled anchor; NFT metadata reads Core directly.

Sources: [status API](https://api.squeekchain.com/v1/status), [public Sepolia RPC](https://ethereum-sepolia-rpc.publicnode.com), [published Core tuple](https://docs.squeekchain.com/developers/core/), [API units and provenance](https://docs.squeekchain.com/developers/api/).

## Six-domain Better Interface review

| Domain | Coverage | Findings, fixes and limitations |
| --- | --- | --- |
| Accessibility | Checked: native landmarks/buttons/dialog/progress/disclosures, accessible icon labels, keyboard activation, visible modal focus, Escape and backdrop, focus return, reduced motion, baseline targets, 200% text enlargement | Screenshots show a visible focus perimeter. Native modal tab traversal permits browser-chrome stops, but no background page control receives focus. Physical screen-reader, switch-access and native browser 200% zoom sessions were not performed. |
| Layout | Checked: reading order, shared edges, first action at 390, 320/390/720/960/1440 widths, full mobile page, long numeric values and operator addresses | Corrected wrapping for longest data and collapsed mobile FAQ word spacing. Probe finds no horizontal scroll, text overlap, floating-control obstruction or clipped text. RTL and localization are not product variants and were not tested. |
| Writing | Checked: mint/gas labels, clear unlaunched state, dynamic data provenance, API-vs-metadata distinction, wallet rejection/retry, gallery empty/filter states | No fake live counter, wallet balance, minted token or deployed address. Setup lives in the launch route and README. Public deployment and automatic reporter operation are explicitly pending. |
| Typography | Checked: loaded local variable face, 400/600 rendered weights, six sizes per width, heading hierarchy, tabular numbers, wrapping | Probe records one rendered family and two weights; 390px sizes are 13/15/16/20/26/40px, desktop 13/15/16/20/32/60px. Fallback-font failure and non-Latin scripts were not separately tested. |
| Colors | Checked: actual solid text/background pairs, selected/pending/error treatments, mood labels independent of color | Probe passes all measured text pairs. Calculated solid-token ratios: text/page 12.46, muted/page 5.80, primary button 4.91, focus/page 7.32, resting tag 5.94, active tag 4.80, energetic tag 5.02. Detailed SVG/art and backdrop composites are outside those numeric contrast claims. No dark theme is implemented. |
| UI | Checked: button hover/pressed/focus/disabled/loading patterns, native sheet, empty/error states, restrained motion, flat surfaces, local wallet marks | No gradient text, nested cards, border-plus-shadow surfaces or `transition: all`. Reduced-motion check finds no running animations. Animation-panel slow playback and native mobile wallet handoff were not performed. |

### Findings fixed in the delivered source

| Severity | Source | Observed problem | Change and recheck |
| --- | --- | --- | --- |
| Medium | `src/App.tsx:83`, `src/components/Launch.tsx` | After a network switch, an action could be clicked before the signer client was ready, doing nothing. | Disabled preparing-wallet state; real browser network-switch/mint and operator flows pass. |
| Medium | `src/components/Gallery.tsx:41`, `src/App.tsx:128` | Retry did not refresh a failed configuration/eligibility prerequisite. | Retry refreshes the prerequisite queries as well as gallery ownership rows; source review confirms dependency path. |
| Medium | `src/styles.css` (`.status-stat`, `.progress-stat`, `.nft-details`, `.wallet-row`) | Maximum-length dynamic values and provider names needed explicit wrap behavior. | Added minimum-width and wrap rules; browser check passes at 320 with maximum RPM and uint64 height. |
| Medium | `src/components/WalletSheet.tsx:11` | Initial Rabby app URL did not match the vendor's current source handler. | Uses `/mobile/?_cmd=open-dapp&dapp=...`, confirmed against Rabby's public universal-link code; link presence checked, native handoff remains unverified. |
| Low | `src/App.tsx:136` | At 390px the hidden desktop `<br>` joined the FAQ words as “questions.Happy”. Confirmed in the full mobile screenshot. | Added an explicit space; new full mobile screenshot reads “Small questions. Happy answers.” and final probe passes. |

## Retained visual evidence

- `docs/evidence/mobile-390.png`: actual first screen, 390px CSS viewport; the product and primary action are visible.
- `docs/evidence/mobile-full-390.png`: full final mobile page, including status, honest empty gallery, steps, FAQ and footer.
- `docs/evidence/desktop-1440.png`: final desktop first screen.
- `docs/evidence/design-probe.json`: compact actual 16-check result, with no bulky browser dump.
- `docs/evidence/interaction-results.json`: actual forty-check browser result and its test limits.

Additional wallet-focus and phone-sheet screenshots were captured and viewed in `test/scratch/visual/`, which is disposable and intentionally not shipped. The native close button's measured focus outline is `rgb(89, 71, 135) solid 2px`; the focus screenshot was actually viewed. The public social image was also viewed.

## Remaining limitations

- Public minting is unavailable until a real Sepolia deployment is configured and the export is rebuilt/published. The local test receipt is never used as that deployment.
- Portable live RPM metadata requires a running authorized reporter. The worker supplies a wallet-signed manual action and calldata preparation, not a hosted signer. The reporter is trusted; no device-signature verification is claimed.
- Marketplace/wallet artwork caches and native Coinbase/passkey/mobile app authentication were not tested. Current chain progress and telemetry expiry do not themselves emit events; consumers must reread metadata.
- The gallery's ownership filter is per six-token page and explicitly says so when empty; it is not an indexed all-history wallet inventory.
- Browser checks used Chromium, with phone emulation. No physical device, Safari/Firefox, screen-reader, RTL or native browser zoom audit was performed.
- No independent contract audit, Slither or Foundry verification is claimed for this `none`-profile task.

## Bundle inventory

`scripts/check-bundle.mjs` excludes job inputs, Git internals, every dependency/cache directory, logs and disposable scratch checks. It includes the complete source, static export, generated runtime assets and retained evidence. `BUNDLE.md` defines the explicit path allocation and the 8,388,608-byte ceiling.

`npm run check:bundle` exits 0. The complete added bundle is under **2.2 MB**, including **1,003,002 bytes** in `dist/`; 67 deliverable files are counted. No dependency archive, registry cache, `node_modules`, source map or submodule is included.

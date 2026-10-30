# Squeek Companion design system

## Overview

A quiet, friendly collectible page for people meeting a living NFT for the first time. Warm paper, restrained violet controls and an original hamster illustration put the companion ahead of protocol detail. The first mobile screen names the product, explains it and presents the connect-to-mint action. Status, gallery, explanation and questions follow in that order.

The implementation is React, TypeScript and plain CSS. `src/styles.css` is the canonical token and component-style source. `src/App.tsx` owns the page composition; separate components own the artwork, wallet dialog, gallery and launch tools. The visual direction was inferred from the companion brief, not supplied as a requester-approved brand system.

## Colors

Colors are authored in hex. Primitives are defined once in `:root`; semantic tokens map those primitives to UI roles.

| Semantic token | Implemented value | Role |
| --- | --- | --- |
| `--color-page` | `#f8f7f2` | Warm page background |
| `--color-surface` | `#ffffff` | Selected controls, wallet rows, launch surface |
| `--color-text` | `#2d302c` | Headings and primary text |
| `--color-muted` | `#626159` | Supporting copy and data labels |
| `--color-border` | `#e0ded5` | Section divisions and control outlines |
| `--color-subtle` | `#eeede7` | Neutral hover and utility surfaces |
| `--color-accent` | `#7461c7` | Primary button background |
| `--color-accent-hover` | `#6450b1` | Primary button hover |
| `--color-accent-text`, `--color-focus` | `#594787` | Links, violet headline and keyboard focus |
| `--color-accent-soft` | `#eeebf5` | Status-icon surface |
| `--color-success`, `--color-success-bg` | `#4e6944`, `#e8eee2` | Confirmed operation status |
| `--color-warning`, `--color-warning-bg` | `#795c22`, `#f7edd4` | Unavailable or stale feed |
| `--color-error` | `#a13d3d` | Recoverable request errors |

Artwork uses product-specific colors outside the interface ramp. `.art-resting` is lavender `#eee9f3`, `.art-active` is green `#e9efdf`, `.art-energetic` is gold `#f7e8ca`, and `.art-unknown` is neutral `#eeeae5`. Matching text badges name the state; color never carries it alone. Detailed fur, wheel and cheek colors belong to `CompanionArt.tsx` and are not general UI tokens.

Measured solid token pairs: primary text on page 12.46:1, muted text on page 5.80:1, white on the primary button 4.91:1, focus on page 7.32:1. Mood-tag pairs measure 5.94:1 resting, 4.80:1 active and 5.02:1 energetic. The rendered taste probe also checks resolved text backgrounds. It does not establish contrast inside detailed SVG illustrations. There is one light theme; no unused dark theme is promised.

## Typography

The rendered family is **DM Sans Variable**, bundled from `@fontsource-variable/dm-sans` as local WOFF2 with `DM Sans, sans-serif` fallbacks. Only regular 400 and semibold 600 are used in the page. The font license is retained in `docs/licenses/dm-sans.txt`. The unused local `Squeek Serif` declaration is not part of the rendered type system.

The six semantic sizes are `--text-xs` 13px, `--text-sm` 15px, `--text-base` 16px, `--text-lg` 20px, `--text-title` 32px and `--text-display` 60px. At 1190px and below, display becomes 52px; at 720px it becomes 40px and title becomes 26px; at 350px display becomes 36px. These replace scale steps at each width rather than adding simultaneous extra sizes.

Headings use 1.13–1.3 line heights and balanced wrapping. H1 tracking is −0.045em; H2 is −0.03em; small text has natural tracking. Body copy uses 1.5–1.75 line height. Descriptions have bounded measures; IDs and addresses can wrap. Changing numeric values use tabular figures. No small tracked capitals appear above headings. Form input text, if added, must stay at least 16px on mobile.

## Layout

`.page-width` defines shared edges: maximum 1240px, with 56px per-side space at the broad layout. At 1190px, that becomes 36px; at 720px, 20px; at 350px, 16px. Spacing is grouped around 8, 12, 16, 20, 24, 32, 40 and 64px, with smaller optical gaps for icons and badges.

- The desktop hero uses two columns, with the action at the left and the preview at the right. Its gap is 78px, 90px above 1440px, 40px below 1190px and 28px below 960px.
- At 720px it becomes one column, with the mint action before the illustration. Decorative footnote content is removed; the full action remains in the first 390px-wide screen.
- The live-status row starts with four columns, reduces to three at 960px, and becomes an intro plus two data columns at 720px. The redundant mood statistic is hidden in compact layouts; mood stays visible on the artwork.
- Gallery cards use three columns, then two at 720px, then one at 350px. The default unlaunched gallery is an honest empty state. Filters remain visible above it.
- The three explanation steps become a vertical icon-and-copy list at 720px. The FAQ becomes one column; its heading retains a word space when the desktop line break is hidden. Footer links wrap into their own row.
- At 720px, navigation links leave the header to protect the brand and account control. In-page gallery and explanation links remain available below.
- `#launch` is a hash-routed operator page. Returning to a public section restores that section's scroll target after it renders.

Breakpoints at 1190, 960, 720 and 350px follow where these groups need more room. Production reflow is checked at 320, 390, 720, 960 and 1440px. Large block values, RPM values, wallet names and token IDs wrap rather than clipping.

## Elevation & Depth

The page is deliberately flat. Space separates sections; one-pixel neutral rules communicate structural divisions. Artwork uses tonal depth inside the SVG, not CSS card shadows. The gallery empty state and explanation band use gentle neutral fills.

The wallet dialog is the only blocking overlay. Its native modal backdrop uses `#26212977` and 4px blur. `showModal()` makes the rest of the document inert and contains focus. No fixed primary control obscures content.

## Shapes

`--radius-button` is 12px; `--radius-panel` is 24px. Gallery empty states and NFT art use 18px. Segmented controls use a 10px outer radius with 4px padding and 7px inner controls. Mood tags, status markers and circular utility controls use full rounding. The wallet sheet is 24px rounded on desktop and keeps its top corners rounded when bottom-aligned on mobile.

The hamster and wheel have soft geometry, warm fur and a single readable pose. Fine dots and grain are confined to the illustration and do not sit behind reading text.

## Components

| Component/pattern | Source | Use and states |
| --- | --- | --- |
| `Brand` | `src/App.tsx` | Local SVG mark and product name, linked to the mint section; compact two-line lockup on mobile |
| `.button`, `.mint-button` | `src/styles.css`, `src/App.tsx` | One violet primary action; neutral secondary actions; hover, pressed, visible focus, pending, disabled and confirmed states |
| `CompanionArt` | `src/components/CompanionArt.tsx` | `mood` accepts resting, active, energetic or unknown; optional deterministic fur variant; unique SVG IDs avoid cross-card gradient collisions; has a meaningful image label |
| Mood preview | `src/App.tsx` | Three labeled toggle buttons and Live reset; preview mode is explicitly labeled and does not change the data feed |
| Status row | `src/App.tsx`, `src/hooks.ts` | Live/loading/stale/fault/error states, 15-second poll, explicit refresh, native progress element and tabular numbers |
| `WalletSheet` | `src/components/WalletSheet.tsx` | Native dialog; named EIP-6963 wallets, mobile app links and Coinbase path; pending row, rejection message, Escape, backdrop, close control and focus return |
| `Gallery` | `src/components/Gallery.tsx` | All/current-wallet filters, six-token pages, live artwork, ownership records, loading/error/empty states, retry and explorer links |
| FAQ | `src/App.tsx` | Native `details`/`summary` preserves keyboard and disclosure semantics; answers cover gas, reporter cadence and collection identity |
| `Launch` | `src/components/Launch.tsx` | Explicit wallet-signed deploy, confirmed receipt download and reporter update; clear unconfigured and pending states; full addresses wrap |

Lucide is the interface icon family. Icons use `currentColor`; stroke weight follows their text context. Wallet marks are local vendor assets or the pinned Coinbase mark. The 1200×630 social PNG is rendered from the same companion SVG by `scripts/social.mjs`.

All controls have a 2px visible focus perimeter with 4px offset. Focus uses system Highlight in forced colors. Native button targets meet the 24px baseline; wallet rows are at least 56px, primary mint is 56px and standard actions are 48px. Small preview utilities remain at least 32px with spacing. Transitions name their changed properties and last 150ms. A .96 press transform and loading spinners only run when reduced motion is not requested. Reduced motion disables animation and smooth scrolling. No continuous decorative animation or autoplay is used.

## Do's and Don'ts

- Start new sections on `.page-width` edges and use the existing semantic tokens and six-step type scale.
- Keep one filled primary action per task region. Use `.secondary` or `.text-link` for supporting actions.
- Keep failure and unconfigured states explicit. Style previews, mocked test data and unpublished metadata must never appear as real minted/live records.
- Reuse native buttons, dialogs, progress and disclosures. Preserve visible labels and keyboard paths.
- Put protocol setup in the launch tools and documentation, with short relevant explanations beside public mint controls.
- Use state names and icons alongside mood colors. Keep raw API units and decimal-string handling in `src/lib/status.ts`.
- Do not add shadows and borders together, nested decorative cards, a new font, tracked capital labels or an unrelated dark theme.

For an additional page, reuse the header/footer and `.page-width`, choose existing type roles, keep one primary action visible on mobile, then verify its loading, empty, error and success states at the same widths. See `VALIDATION.md` for actual reviewed coverage and unperformed native-device and assistive-technology checks.

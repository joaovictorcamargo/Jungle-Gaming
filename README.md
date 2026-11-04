# KURIO — Jungle Frontend Challenge

React + TypeScript marketplace implementation for the Jungle Gaming frontend challenge. All purchases, wallets and transactions are fictional. There is no blockchain or payment gateway integration.

## Current delivery status

The KURIO identity, Roboto Mono typography, copper/brown palette, original NFT images and responsive catalog are now adapted from the accessible Figma copy. Original image/SVG files are bundled locally in `public/figma` (no expiring remote image URLs). Functional commerce and account flows are retained.

Public demo: https://jungle-nft-joao-challenge.comet-stork-3593.chatgpt.site

Functional desktop/mobile Playwright execution is now available using the bundled Linux browser fallback. Results, reviewed regression references and Lighthouse measurements are documented in `docs/VERIFICATION.md`. Desktop profile/registration remain unverified against their Figma frames because the Starter MCP quota still blocks retrieval. This is not a claim of complete pixel identity. Lighthouse medians: desktop performance 96/96 (home/detail), mobile 71/84; mobile performance is below the target of 90. Accessibility, best practices and SEO meet the specified thresholds.

## Run from a clean checkout

Node.js 22+ (developed on Node 24), npm.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. Service workers and Web Crypto require HTTPS or `localhost`. An arbitrary HTTP hostname will not work. Mocks are enabled by default in development **and production**. Set `VITE_ENABLE_MOCKS=false` only when supplying compatible real endpoints.

```sh
node scripts/test-domain.mjs
npm run typecheck
npm run lint
npm run build
npm run preview
npx playwright install chromium
npm run test:e2e
npm run test:visual -- --update-snapshots # first reviewed baseline only
npm run test:visual                     # subsequent regression check
npm run audit                          # starts its own optimized preview on port 4173
# Linux fallback when the Playwright Chromium CDN is unavailable:
PLAYWRIGHT_PRODUCTION=1 npm run test:ci
npm run audit:ci
```

Playwright starts Vite automatically unless `PLAYWRIGHT_EXTERNAL_SERVER=1`. Set `PLAYWRIGHT_BASE_URL` to use another origin. HTML test output is in `playwright-report/`; failing traces are in `test-results/`. Delivered evidence copies are under `reports/e2e/` and `reports/visual/`. The 16 reference images are in `tests/visual.spec.ts-snapshots/`. The audit writes 12 HTML/JSON reports (2 pages × 2 profiles × 3 runs) plus medians, LCP, CLS and TBT to `reports/lighthouse/`. Set `CHROME_PATH` to an installed Chrome executable if needed. The audit starts/stops its own preview; set `AUDIT_EXTERNAL_SERVER=1` with `AUDIT_ORIGIN` to use an existing server.

## Demo credentials

| User | Email | Password |
| --- | --- | --- |
| Alex | alex@jungle.test | Jungle2026! |
| Sam | sam@jungle.test | Jungle2026! |

Passwords in the simulated database are SHA-256 digests, not plaintext. This browser-only simulation is not production authentication. Alex starts with a fictional Ethereum wallet. A second sample address is `0x2222222222222222222222222222222222222222`. Coupon `JUNGLE10` discounts items by 10% (not the network fee).

## Scenarios and reset

Use **Demo scenarios** at the bottom left. Scenario selection persists across refresh. **Reset all demo data** restores users, catalog, carts, wallets, orders and session and clears pending checkout attempts.

- `standard`: normal successful operation; 18 artworks / 4 categories / 4 artists / 2 pages.
- `empty`: empty catalog result.
- `slow`: 2.2-second network delay and skeletons.
- `out-of-order`: single-character searches take 1.7 seconds, longer searches 100 ms; previous requests are canceled through Axios signals.
- `offline`: network errors; `server-error`: HTTP 503.
- `expired-session`: expire the current session on the next business request. Select standard before signing in again.
- `favorite-error`: favorite mutation fails, exposing optimistic rollback.
- `invalid-coupon`, `expired-coupon`: deterministic coupon rejection.
- `price-change`, `sold-out`: change the first cart item immediately before order creation, emit the Socket.IO update and reject the stale quote.
- `order-timeout`: create an order, settle normally, but delay its response beyond the Axios timeout. **Recover purchase** resubmits the same idempotency key, returning the original order.
- `payment-declined`: terminal payment rejection; cart retained.
- `pending`: keep order pending. Disconnect or refresh; switch back to standard to settle the same order.

Manual event buttons target the selected NFT ID and travel through the real `socket.io-client`. They support price changes, sold-out editions, duplicate/old messages, socket disconnection and session expiry. REST and Socket.IO read the same simulated database. They do not write directly to UI setters or Query cache.

## Project map

- `src/contracts.ts`: transport models and exact ETH decimal conversion.
- `src/mocks/`: shared persisted simulation, REST MSW handlers, Socket.IO protocol binding.
- `src/api.ts`: Axios client, error policy and QueryClient defaults.
- `src/state.tsx`: sessions, cart keys, realtime lifecycle and notices.
- `src/router.tsx`: TanStack route tree, URL search validation and private guards.
- `src/screens/`: discovery, commerce, authentication and account flows.
- `src/components/ui/`: locally owned shadcn-style Button/Dialog components using CVA, Slot and Radix Dialog.
- `tests/`: interface-driven Chromium desktop/mobile flows and visual expectations.
- `scripts/audit.mjs`: repeatable optimized-build Lighthouse runner.

See `ARCHITECTURE.md` and `docs/API.md` for data policies, contracts and limitations.

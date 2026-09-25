# Smart Wallet Shelf handoff

## Purpose

Replace the static tea shelf with a parchment-style Hyperliquid Smart Wallet leaderboard backed by Nansen data.

## Completed

- Server route retrieves and normalizes the top 10 Smart HL Perps Traders by 30-day total PnL.
- In-process snapshot cache coalesces concurrent refreshes, caches for 30 minutes, and serves stale data after refresh failure when available.
- Parchment leaderboard presents rank, wallet, PnL, ROI, and account value with loading, empty, error, retry, and stale states.
- Shelf scene/layout and browser coverage were updated while retaining the Iroh Host panel.

## Remaining work

- Live requests require a valid `NANSEN_API_KEY` and Nansen plan access; tests use a simulated upstream. Verify with a live key in the intended environment.
- Snapshot state is in process memory. Multi-instance deployment would need shared caching/rate coordination; no deployment is recorded.
- Safari and Firefox have not been separately verified.

## Important files / architecture

- `src/app/api/smart-wallet-leaderboard/route.ts`: server endpoint.
- `src/leaderboard/provider.ts`, `model.ts`, `snapshot.ts`: Nansen provider, normalization, and cache.
- `src/ui/SmartWalletShelf.tsx`: leaderboard loading and presentation.
- `src/scene/TeaShelf.tsx`, `TeaRoom.tsx`, `TeaRoomShell.tsx`, `src/app/globals.css`: scene and layout integration.
- `tests/smart-wallet-leaderboard.test.ts`, `tests/smart-wallet-route.test.ts`, `tests/browser/shelf.spec.ts`: unit and browser coverage.

## Validation performed

On restacked Shelf commit `ba0ef78`: `npm run typecheck`, `npm test` (11 files, 66 tests), and `npm run build` passed on 25 September 2026.

## Recommended next steps

1. Verify the leaderboard with a configured live Nansen account and confirm the selected plan includes the endpoint.
2. Decide whether shared cache/rate coordination is needed for the deployment topology.
3. Run browser checks on the supported browser matrix before release.

# Smart Wallet Shelf handoff

## Purpose

Replace the static tea shelf with a parchment-style Hyperliquid Smart Wallet leaderboard backed by Nansen data.

## Completed

- Server route retrieves and normalizes the top 10 Smart HL Perps Traders by 30-day total PnL.
- In-process snapshot cache coalesces concurrent refreshes, caches for 30 minutes, and serves stale data after refresh failure when available.
- Parchment leaderboard presents rank, wallet, PnL, ROI, and account value with loading, empty, error, retry, and stale states.
- The shelf sits farther right and deeper in the room, beyond Iroh in the broad Shelf view. The paper stays rolled in its center bay and aligned with the wall until focus.
- Selecting the Shelf station shows the room first. Clicking the 3D shelf or the accessible **Approach the Shelf** button moves the camera behind Iroh and then closer to the shelf. The paper and readable leaderboard appear only after the camera arrives.
- When WebGL is unavailable, the **Approach the Shelf** button opens the readable leaderboard without camera travel. The leaderboard remains hidden at other stations.

## Remaining work

- Live requests require a valid `NANSEN_API_KEY` and Nansen plan access; tests use a simulated upstream. Verify with a live key in the intended environment.
- Snapshot state is in process memory. Multi-instance deployment would need shared caching/rate coordination; no deployment is recorded.
- Safari and Firefox have not been separately verified.

## Important files / architecture

- `src/app/api/smart-wallet-leaderboard/route.ts`: server endpoint.
- `src/leaderboard/provider.ts`, `model.ts`, `snapshot.ts`: Nansen provider, normalization, and cache.
- `src/ui/SmartWalletShelf.tsx`: leaderboard loading and presentation.
- `src/scene/TeaShelf.tsx`, `TeaRoom.tsx`, `CameraRig.tsx`, `stations.ts`, `src/ui/TeaRoomShell.tsx`, `src/app/globals.css`: scene placement, staged reveal, and camera interaction.
- `tests/smart-wallet-leaderboard.test.ts`, `tests/smart-wallet-route.test.ts`, `tests/browser/shelf.spec.ts`: unit and browser coverage.

## Validation performed

On 26 September 2026 after rebasing on persistent Iroh chat history: `npx prisma generate`, `npm run typecheck`, `npm test` (13 files, 81 tests), `npm run format:check`, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3187 npm run test:e2e` (23 tests), and `npm run build` passed. The Iroh chat-history migration was applied locally before browser tests. The Shelf browser suite covers the broad room view, direct shelf click, camera focus, leaderboard states, and mobile layout.

## Recommended next steps

1. Verify the leaderboard with a configured live Nansen account and confirm the selected plan includes the endpoint.
2. Decide whether shared cache/rate coordination is needed for the deployment topology.
3. Run browser checks on the supported browser matrix before release.

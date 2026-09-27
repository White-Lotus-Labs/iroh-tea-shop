# Iroh's Tea Shop

**Choose a crypto thesis. See whether smart money supports it.**

Iroh's Tea Shop is a 3D tea shop for the Nansen Meridian Buildathon. Open curated market theses, check live Nansen conviction and asset evidence, follow top Hyperliquid traders, and ask Uncle—a host backed by Nansen's Research Agent. Stack: Next.js 16, React 19, React Three Fiber, Prisma/SQLite.

Live demo: <https://iroh-tea-shop.up.railway.app>

![Room from the entrance toward the counter](docs/screenshots/room-wide.webp)
![Thesis Desk with three books](docs/screenshots/thesis-desk.webp)
![Opened thesis with an expanded ticker](docs/screenshots/thesis-open.webp)
![Host chat with Uncle](docs/screenshots/host-uncle.webp)
![Shelf leaderboard of Ten Spirits](docs/screenshots/shelf-leaderboard.webp)

## Quickstart

Requires Node.js **22.12+**, npm, and a modern browser.

```sh
npm ci
cp .env.example .env.local
# Put your key in .env.local: NANSEN_API_KEY=...
# Optional: adjust the per-IP UTC daily Research Agent cap (default 1).
# NANSEN_AGENT_DAILY_LIMIT=1
npm run db:migrate
npm run dev
```

Open <http://127.0.0.1:3000>. Keep `NANSEN_API_KEY` server-side only (never `NEXT_PUBLIC_`). Restart the dev server after editing `.env.local`. If port 3000 is busy: `npm run dev -- --port 3101`.

`npm run db:migrate` is required on every fresh checkout. Each worktree uses its own ignored `prisma/dev.db`. Without migration, session cookies can fail on a missing `Session` table.

## How Nansen drives the logic

| Surface             | Endpoints                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| Host chat           | `agent/fast` (Research Agent, Uncle persona)                                                               |
| Shelf               | `perp-leaderboard` (top 10 Smart HL Perps Traders, 30 days)                                                |
| Thesis deck summary | `tgm/flow-intelligence`, `tgm/position-intelligence`                                                       |
| Ticker detail       | `tgm/who-bought-sold`, `tgm/dex-trades`, `tgm/holders`, `tgm/token-information`, `smart-money/perp-trades` |

**Conviction** (per thesis): measured tickers have a finite smart-money figure from `flow-intelligence` (`smart_trader_net_flow_usd` over 7 days) or, for native assets with a perp, from `position-intelligence` (open smart longs minus shorts—not a 7-day window). Accumulating = positive figure. Level = **strong** if accumulating/measured ≥ 0.75, **building** if ≥ 0.5, **weak** otherwise, **no signal** if none measured.

The three thesis narratives are curated. Conviction seals, asset evidence, the Shelf leaderboard, and Uncle's answers use live Nansen data.

**Caching and credits:** deck summary TTL 10 minutes; ticker detail TTL 15 minutes; stale fallback on refresh failure; concurrency cap 4; one retry; keep-the-better-snapshot when a fresh deck has more ticker errors. Cold deck ≈ 12 credits; one ticker detail up to ≈ 15 credits.

## Stations

1. **Waiting room** — sketchbook intro; enter the tea room to open the dock.
2. **Counter (Thesis Desk)** — three books: Robinhood Chain Tokenization, The Crypto Bull Market, and AI Taking Over the World. Each shows a live Nansen conviction seal. Opening a book shows the thesis and four assets. Rows expand into buyers/sellers, holders, supply not yet circulating, and perpetuals positioning. Actions: Ask Uncle, Share on X, Follow.
3. **Host** — chat with Uncle through the Nansen Research Agent. Guests keep memory for the page; signed-in users get persistent chats.
4. **Shelf** — overview of hanging papers (Ten Spirits cast). **See the top traders** focuses the camera and unrolls the parchment leaderboard of top Smart HL Perps Traders over 30 days. Rank identities are visual cast names, not claims about wallet owners.
5. **Observatorium** — brass orrery; wind it in place (no panel, no market data).

## Architecture

| Folder                              | Role                                                             |
| ----------------------------------- | ---------------------------------------------------------------- |
| `src/thesis/`                       | Thesis catalog, conviction, Nansen deck/detail fetches, fixtures |
| `src/nansen/`                       | Agent SSE client, session helpers, status                        |
| `src/app/api/theses/`               | Deck and ticker detail routes                                    |
| `src/scene/` + `src/scene/props/`   | R3F room, host, shelf papers, interior props                     |
| `src/ui/`                           | Shell, scroll panels, Thesis Deck, Shelf parchment, dock         |
| `src/leaderboard/`                  | Perp leaderboard normalize + process-local cache                 |
| `src/auth/`, `src/iroh/`, `prisma/` | Accounts and Host chat persistence                               |

## Tests

```sh
npm run typecheck
npm test
npm run format:check
npm run build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3101 npm run test:e2e
```

Unit tests cover conviction, thesis routes, Nansen streaming, Shelf data, auth, and motion. Playwright covers Chromium journeys with mocked Nansen responses (`reuseExistingServer` when a local server is already up).

## Known limits

- The Host 3D model is a teammate’s work in progress; visible copy says Uncle while the mesh still resembles Iroh.
- Deployed on Railway at the URL above. SQLite and the in-process caches suit one Node process, not multi-instance hosts without shared storage.
- The Research Agent's per-IP daily call cap is process-local, trusts the deployment proxy's forwarding headers, and resets at midnight UTC or on a server restart.
- Automated Nansen tests mock upstream; live plan entitlements and credits are not asserted in CI.

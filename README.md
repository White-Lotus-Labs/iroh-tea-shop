# Tea After Pour

**Tea After Pour** is a 3D tea shop for the Nansen Meridian Buildathon. A wise tea master, Uncle, hosts the room (code identifiers still say Iroh; visible copy says Uncle). Guests move through a locked scroll dock: Waiting room, Counter (Thesis Desk), Host, Shelf, and Observatorium. Panels are ancient Chinese hanging scrolls, closed by default, with incense-ring halos and ink teasers. Stack: Next.js 16, React 19, React Three Fiber, Prisma/SQLite.

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

**Conviction** (per thesis): measured tickers have a finite 7-day smart money figure (`flow-intelligence` `smart_trader_net_flow_usd`, or for native assets with a perp, `position-intelligence` smart longs minus shorts). Accumulating = positive figure. Level = **strong** if accumulating/measured ≥ 0.75, **steeping** if ≥ 0.5, **weak** otherwise, **unknown** if none measured.

**Caching and credits:** deck summary TTL 10 minutes; ticker detail TTL 15 minutes; stale fallback on refresh failure; concurrency cap 4; one retry; keep-the-better-snapshot when a fresh deck has more ticker errors. Cold deck ≈ 12 credits; one ticker detail up to ≈ 15 credits.

## Stations

1. **Waiting room** — arrive; Begin opens the dock.
2. **Counter (Thesis Desk)** — three 3D books for Robinhood Chain tokenization, Crypto Bullrun, and AI taking over the world. Each shows a live Nansen Conviction seal. Opening a book shows the thesis scroll with 12 tickers. Rows expand into smart money moves, holders, supply not yet circulating, and perps positioning. Actions: Talk to Uncle, Share on X, Follow.
3. **Host** — chat with Uncle through the Nansen Research Agent (Uncle persona). Guests keep memory for the page; signed-in users get persistent chats.
4. **Shelf** — overview of hanging papers (Ten Spirits cast). **Approach the Shelf** (or click the shelf) focuses the camera and unrolls the parchment leaderboard of top 10 Smart HL Perps Traders over 30 days. Rank identities are visual cast names, not claims about wallet owners.
5. **Observatorium** — brass orrery; wind it in place (no panel).

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
- Railway deploy is pending. SQLite and the in-process caches suit one Node process, not multi-instance hosts without shared storage.
- Automated Nansen tests mock upstream; live plan entitlements and credits are not asserted in CI.
- Branch `feature/waiting-room-invitation` is separate work and is not part of this deck PR.

# Tea After Pour

Tea After Pour is a browser-based tea room for examining a written crypto thesis. Its waiting area, counter, tea table, host (Iroh), and Shelf form one guided scene. The thesis review is a **synthetic PASS A demonstration**. Iroh's research chat and the Shelf leaderboard are separate, live Nansen integrations when a server-side API key is configured.

The app starts at the **Counter**. Guests can use the room, demo review, Iroh chat, and Shelf without an account. Signing in adds persistent Iroh chat history.

## What is implemented

- **Thesis review:** Write 80–6,000 characters, confirm a symbol, and choose a 6-hour, 24-hour, or 7-day window. **Load sample** supplies the prepared ETH thesis. Only that exact text with ETH and 24 hours receives fixed synthetic evidence (`DEMO-E-01`); other valid inputs return an explicit unassessed result. The tea table shows **Noticed / Cut / One Breath** and an evidence drawer when evidence exists. The review uses an abortable, delayed `MockReviewAdapter`, not Nansen or an AI model.
- **Room and navigation:** A React Three Fiber scene contains two connected rooms, a tea ritual, a seated 3D host, and a right-wall shelf. Station buttons move an authored camera between locations. Local orbit is constrained; there is no free walking, pan, or zoom. A static fallback appears if WebGL is unavailable or lost. The current UI follows the operating system's reduced-motion preference.
- **Iroh:** The Host panel streams answers from Nansen Research Agent through `/api/nansen-agent`. It shows tool activity and supports follow-up questions, retry, and Stop. Guests keep conversations in the current page's memory. Signed-in users can create chats, view history, switch chats, and restore messages after reload.
- **Shelf:** Selecting Shelf first shows it in the room. Clicking the shelf or **Approach the Shelf** starts the camera focus; the illustrated parchment leaderboard appears after arrival. It presents the top ten Nansen-ranked wallets as one large Iroh card and a 3 × 3 White Lotus grid. Character names and portraits are fixed _visual identities by rank_, not claims about the wallets' real owners. PnL, ROI, account value, and available short Nansen labels come from live wallet entries. Missing numeric values show a dash. The panel handles loading, empty, error, retry, and stale-data states.
- **Accounts:** Optional nickname/password registration and login. Signed-in chat history belongs to the account; thesis reviews and Shelf results are not saved per account.

## Stack and code layout

Next.js 16 App Router, React 19, TypeScript, React Three Fiber/Three.js/drei, Prisma 6 with SQLite, Vitest, and Playwright. Scene textures and Shelf artwork are bundled under `public/images/`; no remote artwork or fonts are required.

- `src/app/`: pages, global styles, and server API routes.
- `src/ui/`: the station shell, HTML panels, auth UI, Iroh chat, and Shelf parchment.
- `src/scene/`: room geometry, host, shelf, camera rig, and motion.
- `src/shared/contracts.ts`, `src/fixtures/`, `src/review/`: review contracts, the synthetic ETH fixture, and review request lifecycle.
- `src/auth/`, `src/iroh/`, `prisma/`: account/session handling and user-owned chat storage.
- `src/nansen/`: streamed-event decoding and client chat state.
- `src/leaderboard/`: Nansen leaderboard request, normalization, formatting, and process-local snapshot cache.
- `tests/`: unit and route tests; `tests/browser/`: Chromium journeys with mocked provider responses.

The HTML shell owns station, form, and reveal state. The 3D scene is loaded dynamically in the browser. `ReviewSession` owns the demo request independently of camera movement; Iroh and Shelf use their own server routes and do not feed the thesis review.

## Local setup

Requires Node.js **22.12 or newer**, npm, and a modern browser. The lockfile pins dependency versions.

```sh
npm ci
cp .env.example .env.local
# Set NANSEN_API_KEY in .env.local to enable live Iroh and Shelf data.
npm run db:migrate
npm run dev
```

Open <http://127.0.0.1:3000>. `NANSEN_API_KEY` is the only application environment variable shown in `.env.example`. It stays on the server; do not use a `NEXT_PUBLIC_` prefix. The demo review works without a key, while Iroh and Shelf show configuration errors. Restart the dev server after changing `.env.local`. Live access also depends on the Nansen account's plan and credits.

**Run `npm run db:migrate` for every fresh checkout or after pulling schema changes.** The Prisma datasource is fixed to the ignored `prisma/dev.db` SQLite file; each worktree has its own local database. `npm ci` generates the Prisma client, and `db:migrate` creates the `User`, `Session`, `Chat`, and `Message` tables. A missing migration can cause a `Session` table error when opening the page with a session cookie. The database is not committed.

If port 3000 is occupied, use `npm run dev -- --port 3001` and open that port instead.

## Nansen integrations

**Iroh research:** `POST /api/nansen-agent` validates questions of up to 6,000 characters, calls `https://api.nansen.ai/api/v1/agent/fast` with the server-side key, and forwards a server-sent event stream. It times out upstream after 90 seconds and returns safe errors for invalid requests, unavailable access, credits, rate limits, and interrupted streams. A guest conversation ID is held only in browser memory. For a signed-in chat, the server verifies ownership, stores the user question and answer, and saves Nansen's `conversation_id`. When Nansen returns no ID, up to four recent completed exchanges are included as bounded context for a follow-up. Stop aborts the browser request and cancels upstream work where possible. There is no local mock answer when Nansen is unavailable.

**Shelf leaderboard:** `GET /api/smart-wallet-leaderboard` calls Nansen's `POST /api/v1/perp-leaderboard` for the last 30 UTC days, filtering `Smart HL Perps Trader`, ordering by `total_pnl` descending, and requesting ten rows with `premium_labels: false`. The route normalizes addresses, labels, PnL, ROI, and account value; it never exposes the API key. A 30-minute snapshot is shared within one Node process and coalesces simultaneous refreshes. If a refresh fails after a successful fetch, the last real snapshot can be shown with a stale warning; without a prior snapshot, the UI shows a safe error. Referral-code labels are shortened to the referred nickname (for example, `santochan`), `HL Perps Whale` becomes `Whale`, and address-only entries have no subtitle. The ten White Lotus names are presentation labels assigned by rank.

The thesis review makes **no Nansen request**. Its prepared evidence is an invented twelve-wallet ETH example timestamped **22 September 2026, 18:00 UTC**; it is not current market data.

## Auth and data storage

Nicknames use 3–24 ASCII letters, numbers, underscores, or hyphens and are unique without regard to case. Passwords need at least eight characters and are limited to 72 UTF-8 bytes; bcrypt hashes them with cost 12. A random session token is stored only as a SHA-256 hash in SQLite. The `tea_session` cookie is HttpOnly, SameSite Lax, lasts up to 30 days, and is Secure in production. Logout revokes its database row.

Auth routes are `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, and `GET /api/auth/me`. Signed-in chat routes are `GET`/`POST /api/iroh/chats` and `GET /api/iroh/chats/[chatId]`; they check the session and chat owner. Chat messages and Nansen conversation IDs are stored in SQLite. Guest chat, thesis input/results, and the browser's last Shelf snapshot are only in memory. The server Shelf cache is also in memory, shared by requests to the same process but not across workers or restarts.

## Current limits and unfinished work

- **PASS A review only:** There is no live thesis evidence retrieval, claim extraction, grounded review rules, live symbol resolution, or saved thesis history. Arbitrary theses are explicitly unassessed.
- **Shelf framing on current `main`:** At commit `feac523`, a shared CSS transform pushes the focused scroll upward and clips its top. [PR #9](https://github.com/White-Lotus-Labs/iroh-tea-shop/pull/9) contains a focused CSS fix, but it is not merged into this documented `main` state. The in-app result still needs visual confirmation after that fix.
- **Removed visible controls:** The current shell has no Reset view button, manual motion selector, or Cancel review button, although the camera reset hook and review cancellation logic remain in code. Reduced motion follows the OS setting.
- **Deployment and provider verification:** SQLite and the in-process leaderboard cache suit local development or one persistent server process. Multi-instance hosting needs shared storage/cache and operational setup. Automated Nansen tests mock upstream responses; live access, plan entitlements, and production deployment have not been verified by this repository's tests.
- **Browser coverage:** Playwright targets Chromium. Safari, Firefox, GPU performance, and all responsive/WebGL combinations have not been separately certified. The room is guided, not freely walkable; it has no voice, lip sync, or physics simulation.

## Run checks and production mode

```sh
npm run typecheck
npm test
npm run format:check
npm run build
npm start
```

The repository contains Vitest tests for review, auth, Iroh, Nansen streaming, Shelf data, and camera motion. Browser tests cover account flows, room journeys, Iroh, Shelf, motion, mobile, and fallback behavior with mocked provider responses. To run them locally:

```sh
npm run db:migrate
npx playwright install chromium
npm run test:e2e
```

Playwright starts or reuses a dev server at `http://127.0.0.1:3000`. Set `PLAYWRIGHT_BASE_URL` to use a different local port. A real Nansen key is not needed for mocked tests.

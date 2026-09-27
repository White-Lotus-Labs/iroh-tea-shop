# How the tea shop works

**Updated:** 28 September 2026

This is a guide to the app as it is, written so a person can read it without already knowing the code.

The live site is <https://iroh-tea-shop.up.railway.app>. Setup steps are in the [README](../README.md).

## The visit

You arrive in a waiting room that looks like a sketchbook. Entering the tea room opens a dock with four stops.

**Counter.** Three books the team wrote:

- Robinhood Chain Tokenization (NetNet, Mushroom, Arbitrum, Uniswap)
- The Crypto Bull Market (Bitcoin, Ether, Hyperliquid, Solana)
- AI Taking Over the World (Venice, SanDisk, NVIDIA, Micron)

Each book shows a conviction seal. The seal is a summary of smart-money numbers, not a promise that the thesis is right. Open a book to read the essay. Open an asset to see the evidence we saved: who has been buying and selling, holders, how much supply is not circulating yet, and perp positioning when that asset trades as a perp.

**Host.** Uncle answers in a chat. He uses Nansen's Research Agent. This part is live. Sending a message calls Nansen at that moment. Guests keep the thread until they reload. If you sign in, your chats are kept in the database and you can reopen them.

**Shelf.** Ten spirits stand in for the wallets on a saved Nansen leaderboard. The scroll has four boards: Perps Traders, Smart Wallets, and Whales (accounts worth $10M or more) on Hyperliquid, and Meme Traders. The default sort is 30-day PnL. Rank 1 is open by default. Clicking another rank opens it in place with realized and unrealized PnL, 30-day volume, trade count, and its three largest open positions. That detail comes back with the same leaderboard call, so it adds no Nansen requests. The names (Azure Dragon, Vermilion Phoenix, and the rest) are illustrations. They are not claims about who owns the wallet. Clicking through opens that address in Nansen's profiler.

Meme Traders uses Nansen's Smart Money PnL leaderboard on 18 chains, with Solana and EVM wallets in one list. Nansen has no meme filter, so the app keeps a wallet when at least half of its top-token profit is memecoins. Majors, staked and wrapped tokens, tokenized stocks, and the PUMP token do not count. The board sorts by realized PnL or by average trade ROI. Its cards show win rate, chains, tokens traded, and top tokens in place of account value, volume, and open positions. Every row ranks on its own wallet's leaderboard numbers. When a named person also trades on the other chain group (Solana or EVM), the row is marked Entity, and its card adds Nansen's entity total across all their wallets and chains. The entity's other wallets drop out, so one person shows once.

**Observatorium.** A brass orrery you can wind. It is not connected to market data.

You can look around the 3D room, walk the camera between stops, and pour tea. If the browser cannot run WebGL, the written panels still work.

## Where the numbers come from

Nansen is the only market source. The app never invents a conviction number or a trader row when Nansen did not return one. Empty and failed sections say so.

Visitors do not trigger the deck, the asset pages, or the shelf. Those are saved in SQLite (`NansenSnapshot` rows) and served from there.

The server fills that table when it starts, then checks every hour. Fast readings refresh hourly: the thesis seals and each asset page's buyers, sellers, recent trades, and perp book (57 requests). Slow readings refresh every 4 hours: holders and token info, and every Shelf board. A full fill is up to 103 Nansen requests: 12 for the thesis seals, 67 for the twelve asset pages, 15 for the Hyperliquid boards, and up to 9 for Meme Traders (one leaderboard call and up to 8 entity lookups). A restart skips rows that are not due. The README has the split. Solana skips the spot endpoints. If a fill fails, the last good row stays on screen and can be marked stale.

Until the first fill finishes, the desk and the shelf say the readings are still being saved.

Uncle is the exception. His route is `POST /api/nansen-agent`, which calls `agent/fast`. That is one live request per message. The default limit is one message per IP per UTC day (`NANSEN_AGENT_DAILY_LIMIT`). Chat text for signed-in people is stored. The Nansen call is not replaced by the hourly save, because every question is different.

The API key lives only on the server (`NANSEN_API_KEY`). The browser never sees it.

## Accounts

Sign-in is optional. A nickname and a password create a user and a session cookie. Passwords are hashed. The session token stored in the database is a hash, not the cookie itself. Guests can use the room and talk to Uncle without an account. Their chat is not kept after they leave.

## What is stored in SQLite

One SQLite file on a single Node process. Locally that file is `prisma/dev.db` (`DATABASE_URL=file:./dev.db`). On Railway the web service sets `DATABASE_URL=file:/data/dev.db` and mounts a volume at `/data`. The separate SQLite web service cannot share that file.

- users and sessions
- Uncle's chats and messages, for signed-in people
- saved Nansen readings (the deck, each asset page, the shelf)

Railway runs migrations before the server starts. A new checkout needs `npm run db:migrate` before sign-in or the hourly save can write.

## What you can ignore

`docs/handoff/` and some older notes describe earlier shapes of the product, including a time when the thesis review was fake sample data and the site was not deployed. That is not the current app. The README and this file are the ones to trust.

Visual scores, the perf budget, and the Nansen request-manager note are still useful if you are changing the scene or the rate limits. The request manager paces the hourly save and Uncle's live calls. It does not decide what gets saved.

## Honest limits

- Several server copies would each keep their own SQLite file and each run their own refresh schedule. Ship one web process.
- Uncle's daily cap resets if that process restarts.
- The 3D host is still being finished. The copy says Uncle.
- Tests use a fake Nansen. They check that pages read the database and that the hourly save is the thing that calls out. They do not check a live Nansen plan or a credit balance.

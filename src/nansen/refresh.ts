import type { PrismaClient } from '@prisma/client';
import { NansenError } from './client';
import { leaderboardRefreshTargets } from '../leaderboard/boards';
import { fetchMemePool, rankMeme } from '../leaderboard/meme';
import type { SmartWalletLeaderboardEntry } from '../leaderboard/model';
import { fetchNansenLeaderboard } from '../leaderboard/provider';
import { THESES } from '../thesis/deck';
import {
  DECK_CACHE_KEY,
  SUMMARY_CONCURRENCY,
  detailCacheKey,
  loadDeckSnapshot,
  loadTickerDetail,
  mapPool,
  preferExistingDeck,
} from '../thesis/nansen';
import type { ThesisId } from '../thesis/types';
import {
  markNansenSnapshotStale,
  readNansenSnapshot,
  writeNansenSnapshot,
} from './snapshot-store';

export type RefreshReport = {
  skipped: 'no-key' | null;
  saved: string[];
  kept: string[];
  missing: string[];
};

type Job = {
  key: string;
  load: () => Promise<object>;
  preferExisting?: typeof preferExistingDeck;
};

function errorMessage(error: unknown): string {
  if (error instanceof NansenError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Nansen is temporarily unavailable.';
}

async function refreshOne(
  database: PrismaClient,
  job: Job,
  now: number,
): Promise<'saved' | 'kept' | 'missing'> {
  const existing = await readNansenSnapshot(database, job.key, now);
  try {
    const fresh = await job.load();
    if (existing && job.preferExisting) {
      const reason = job.preferExisting(
        fresh as unknown as Parameters<typeof preferExistingDeck>[0],
        existing as unknown as Parameters<typeof preferExistingDeck>[1],
      );
      if (reason) {
        await markNansenSnapshotStale(database, job.key, reason, now);
        return 'kept';
      }
    }
    await writeNansenSnapshot(database, job.key, fresh, now);
    return 'saved';
  } catch (error) {
    const message = errorMessage(error);
    if (existing) {
      await markNansenSnapshotStale(database, job.key, message, now);
      return 'kept';
    }
    console.error(`Nansen refresh missed ${job.key}: ${message}`);
    return 'missing';
  }
}

function jobsFor(
  apiKey: string,
  now: number,
): { first: Job[]; details: Job[] } {
  const deck: Job = {
    key: DECK_CACHE_KEY,
    load: () => loadDeckSnapshot(apiKey),
    preferExisting: preferExistingDeck,
  };
  // Both meme sorts rank the same pool, so the first meme job fetches it once.
  let memePool: Promise<SmartWalletLeaderboardEntry[]> | undefined;
  const pool = () => (memePool ??= fetchMemePool(apiKey, now));
  const leaderboards: Job[] = leaderboardRefreshTargets().map(
    ({ board, metric, key }) => ({
      key,
      load: async () => ({
        entries:
          board === 'meme'
            ? rankMeme(await pool(), metric)
            : await fetchNansenLeaderboard(apiKey, now, fetch, board, metric),
      }),
    }),
  );
  const details: Job[] = THESES.flatMap((thesis) =>
    thesis.tickers.map((ticker) => ({
      key: detailCacheKey(thesis.id, ticker.symbol),
      load: async () => {
        const detail = await loadTickerDetail(
          thesis.id as ThesisId,
          ticker.symbol,
          apiKey,
          now,
        );
        if (!detail) throw new NansenError('Unknown thesis or symbol.', 404);
        return detail;
      },
    })),
  );
  return { first: [deck, ...leaderboards], details };
}

/**
 * Ask Nansen for the deck, the Shelf, and every known ticker, then save the
 * answers. A failed refresh keeps the previous row when one exists.
 */
export async function refreshSavedNansenData(
  database: PrismaClient,
  apiKey: string = process.env.NANSEN_API_KEY ?? '',
  now: number = Date.now(),
): Promise<RefreshReport> {
  const report: RefreshReport = {
    skipped: null,
    saved: [],
    kept: [],
    missing: [],
  };
  if (!apiKey.trim()) {
    report.skipped = 'no-key';
    return report;
  }
  const { first, details } = jobsFor(apiKey, now);
  for (const job of first) {
    report[await refreshOne(database, job, now)].push(job.key);
  }
  const detailResults = await mapPool(details, SUMMARY_CONCURRENCY, (job) =>
    refreshOne(database, job, now).then((outcome) => ({
      outcome,
      key: job.key,
    })),
  );
  for (const result of detailResults) report[result.outcome].push(result.key);
  return report;
}

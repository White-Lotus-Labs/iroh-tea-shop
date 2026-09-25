import type {
  SmartWalletLeaderboardEntry,
  SmartWalletLeaderboardSnapshot,
} from './model';
import { LeaderboardError } from './provider';

export const SNAPSHOT_TTL_MS = 30 * 60 * 1000;
export const LEADERBOARD_CACHE_KEY =
  'smart-wallet-leaderboard:hyperliquid:smart-hl-perps-trader:30d:total-pnl-desc:top-10';

/** One server process owns the snapshot and all simultaneous refreshes for this configuration. */
export function createSnapshotService(
  load: () => Promise<SmartWalletLeaderboardEntry[]>,
  now: () => number = Date.now,
) {
  let snapshot: SmartWalletLeaderboardSnapshot | null = null;
  let inFlight: Promise<SmartWalletLeaderboardSnapshot> | null = null;
  let retryAt = 0;
  let lastError: LeaderboardError | null = null;

  async function get(): Promise<SmartWalletLeaderboardSnapshot> {
    if (snapshot && now() < Date.parse(snapshot.expiresAt)) return snapshot;
    if (inFlight) return inFlight;
    if (now() < retryAt) {
      if (snapshot)
        return { ...snapshot, stale: true, refreshError: lastError?.message };
      throw (
        lastError ??
        new LeaderboardError(
          'Smart Wallet leaderboard is temporarily unavailable.',
          502,
        )
      );
    }
    inFlight = (async () => {
      try {
        const entries = await load();
        const fetched = now();
        snapshot = {
          entries,
          fetchedAt: new Date(fetched).toISOString(),
          expiresAt: new Date(fetched + SNAPSHOT_TTL_MS).toISOString(),
          source: 'nansen',
          stale: false,
        };
        lastError = null;
        retryAt = 0;
        return snapshot;
      } catch (error) {
        lastError =
          error instanceof LeaderboardError
            ? error
            : new LeaderboardError(
                'Smart Wallet leaderboard is temporarily unavailable.',
                502,
              );
        retryAt = now() + Math.max(60_000, lastError.retryAfterMs);
        if (snapshot)
          return { ...snapshot, stale: true, refreshError: lastError.message };
        throw lastError;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  return { get };
}

const services = new Map<string, ReturnType<typeof createSnapshotService>>();

/** Configuration identity prevents a future leaderboard variant from reusing this snapshot. */
export function getSnapshotService(
  key: string,
  load: () => Promise<SmartWalletLeaderboardEntry[]>,
) {
  let service = services.get(key);
  if (!service) {
    service = createSnapshotService(load);
    services.set(key, service);
  }
  return service;
}

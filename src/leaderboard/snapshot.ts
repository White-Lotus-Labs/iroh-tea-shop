// Page routes read SQLite (src/nansen/refresh.ts). This helper is the
// in-process coalescing cache its unit tests still pin down.
import { NansenError } from '../nansen/client';
import { LeaderboardError } from './provider';

export const SNAPSHOT_TTL_MS = 30 * 60 * 1000;
export { DEFAULT_LEADERBOARD_CACHE_KEY as LEADERBOARD_CACHE_KEY } from './boards';

type SnapshotMeta = {
  fetchedAt: string;
  expiresAt: string;
  source: 'nansen';
  stale: boolean;
  refreshError?: string;
};

export type SnapshotPreferExisting<V extends object> = (
  fresh: V,
  existing: V & SnapshotMeta,
) => string | null;

/** One server process owns the snapshot and all simultaneous refreshes for this key. */
export function createSnapshotService<V extends object>(
  load: () => Promise<V>,
  ttlMs: number = SNAPSHOT_TTL_MS,
  now: () => number = Date.now,
  preferExisting?: SnapshotPreferExisting<V>,
) {
  let snapshot: (V & SnapshotMeta) | null = null;
  let inFlight: Promise<V & SnapshotMeta> | null = null;
  let retryAt = 0;
  let lastError: NansenError | null = null;

  async function get(): Promise<V & SnapshotMeta> {
    if (snapshot && now() < Date.parse(snapshot.expiresAt)) return snapshot;
    if (inFlight) return inFlight;
    if (now() < retryAt) {
      if (snapshot)
        return { ...snapshot, stale: true, refreshError: lastError?.message };
      throw (
        lastError ?? new NansenError('Nansen is temporarily unavailable.', 502)
      );
    }
    inFlight = (async () => {
      try {
        const value = await load();
        if (snapshot && preferExisting) {
          const refreshError = preferExisting(value, snapshot);
          if (refreshError) {
            lastError = new NansenError(refreshError, 502);
            retryAt = now() + 60_000;
            return { ...snapshot, stale: true, refreshError };
          }
        }
        const fetched = now();
        snapshot = {
          ...value,
          fetchedAt: new Date(fetched).toISOString(),
          expiresAt: new Date(fetched + ttlMs).toISOString(),
          source: 'nansen',
          stale: false,
        };
        lastError = null;
        retryAt = 0;
        return snapshot;
      } catch (error) {
        lastError =
          error instanceof NansenError
            ? error
            : new NansenError('Nansen is temporarily unavailable.', 502);
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

const services = new Map<string, { get: () => Promise<unknown> }>();

/** Configuration identity prevents a future variant from reusing this snapshot. */
export function getSnapshotService<V extends object>(
  key: string,
  load: () => Promise<V>,
  ttlMs: number = SNAPSHOT_TTL_MS,
  preferExisting?: SnapshotPreferExisting<V>,
) {
  let service = services.get(key) as
    | ReturnType<typeof createSnapshotService<V>>
    | undefined;
  if (!service) {
    service = createSnapshotService(load, ttlMs, Date.now, preferExisting);
    services.set(key, service);
  }
  return service;
}

/** Kept so leaderboard failures still surface LeaderboardError in routes. */
export function asLeaderboardError(error: unknown): LeaderboardError {
  if (error instanceof LeaderboardError) return error;
  if (error instanceof NansenError)
    return new LeaderboardError(
      error.status === 502
        ? 'Smart Wallet leaderboard is temporarily unavailable.'
        : error.message,
      error.status,
      error.retryAfterMs,
    );
  return new LeaderboardError(
    'Smart Wallet leaderboard is temporarily unavailable.',
    502,
  );
}

import type { PrismaClient } from '@prisma/client';

/** How long a saved reading stays fresh before the screen may call it stale. */
export const NANSEN_REFRESH_MS = 60 * 60 * 1000;

export const NANSEN_WARMING_MESSAGE =
  'Market readings are still being saved. The shop updates them about once an hour.';

export type SnapshotMeta = {
  fetchedAt: string;
  expiresAt: string;
  source: 'nansen';
  stale: boolean;
  refreshError?: string;
};

const META_KEYS = [
  'fetchedAt',
  'expiresAt',
  'source',
  'stale',
  'refreshError',
] as const;

export function stripSnapshotMeta<T extends object>(value: T): T {
  const copy: Record<string, unknown> = {
    ...(value as Record<string, unknown>),
  };
  for (const key of META_KEYS) delete copy[key];
  return copy as T;
}

export async function readNansenSnapshot<T extends object>(
  database: PrismaClient,
  key: string,
  now: number = Date.now(),
): Promise<(T & SnapshotMeta) | null> {
  const row = await database.nansenSnapshot.findUnique({ where: { key } });
  if (!row) return null;
  let payload: T;
  try {
    const parsed: unknown = JSON.parse(row.payload);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return null;
    payload = parsed as T;
  } catch {
    return null;
  }
  const fetchedAtMs = row.fetchedAt.getTime();
  const overdue = now >= fetchedAtMs + NANSEN_REFRESH_MS;
  const refreshError =
    row.refreshError ??
    (overdue ? 'This reading is older than an hour.' : undefined);
  return {
    ...payload,
    fetchedAt: row.fetchedAt.toISOString(),
    expiresAt: new Date(fetchedAtMs + NANSEN_REFRESH_MS).toISOString(),
    source: 'nansen',
    stale: row.stale || overdue,
    ...(refreshError ? { refreshError } : {}),
  };
}

export async function writeNansenSnapshot<T extends object>(
  database: PrismaClient,
  key: string,
  value: T,
  now: number,
): Promise<T & SnapshotMeta> {
  const payload = JSON.stringify(stripSnapshotMeta(value));
  const fetchedAt = new Date(now);
  await database.nansenSnapshot.upsert({
    where: { key },
    create: {
      key,
      payload,
      fetchedAt,
      stale: false,
      refreshError: null,
    },
    update: {
      payload,
      fetchedAt,
      stale: false,
      refreshError: null,
    },
  });
  const saved = await readNansenSnapshot<T>(database, key, now);
  if (!saved) throw new Error('Saved Nansen reading could not be read back.');
  return saved;
}

export async function markNansenSnapshotStale<T extends object>(
  database: PrismaClient,
  key: string,
  refreshError: string,
  now: number = Date.now(),
): Promise<(T & SnapshotMeta) | null> {
  await database.nansenSnapshot.update({
    where: { key },
    data: { stale: true, refreshError },
  });
  return readNansenSnapshot<T>(database, key, now);
}

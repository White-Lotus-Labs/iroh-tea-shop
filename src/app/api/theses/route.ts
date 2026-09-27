import { NansenError } from '../../../nansen/client';
import { nansenAvailabilityFromEnv } from '../../../nansen/availability';
import {
  getSnapshotService,
} from '../../../leaderboard/snapshot';
import {
  DECK_CACHE_KEY,
  DECK_TTL_MS,
  loadDeckSnapshot,
} from '../../../thesis/nansen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'cache-control': 'no-store' };

function deckService() {
  const key = process.env.NANSEN_API_KEY ?? '';
  return getSnapshotService(
    DECK_CACHE_KEY,
    () => loadDeckSnapshot(key),
    DECK_TTL_MS,
  );
}

export async function GET() {
  if (nansenAvailabilityFromEnv(process.env.NANSEN_API_KEY) === 'unavailable')
    return Response.json(
      { error: 'Nansen is not configured.' },
      { status: 503, headers },
    );
  try {
    const snapshot = await deckService().get();
    return Response.json(snapshot, { headers });
  } catch (error) {
    const safe =
      error instanceof NansenError
        ? error
        : new NansenError('Nansen is temporarily unavailable.', 502);
    return Response.json(
      { error: safe.message },
      { status: safe.status, headers },
    );
  }
}

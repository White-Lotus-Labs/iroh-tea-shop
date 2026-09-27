import { db } from '../../../auth/db';
import {
  boardCacheKey,
  parseBoard,
  parseMetric,
} from '../../../leaderboard/boards';
import { jsonSavedReading } from '../../../nansen/saved-reading';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request?: Request) {
  const params = request ? new URL(request.url).searchParams : null;
  return jsonSavedReading(
    db,
    boardCacheKey(
      parseBoard(params?.get('board') ?? null),
      parseMetric(params?.get('metric') ?? null),
    ),
    'Nansen API is not configured.',
  );
}

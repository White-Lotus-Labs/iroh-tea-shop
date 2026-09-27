import { db } from '../../../auth/db';
import { LEADERBOARD_CACHE_KEY } from '../../../leaderboard/snapshot';
import { jsonSavedReading } from '../../../nansen/saved-reading';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return jsonSavedReading(
    db,
    LEADERBOARD_CACHE_KEY,
    'Nansen API is not configured.',
  );
}

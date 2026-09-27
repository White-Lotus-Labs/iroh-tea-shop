import { fetchNansenLeaderboard } from '../../../leaderboard/provider';
import {
  asLeaderboardError,
  getSnapshotService,
  LEADERBOARD_CACHE_KEY,
} from '../../../leaderboard/snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const service = getSnapshotService(LEADERBOARD_CACHE_KEY, async () => ({
  entries: await fetchNansenLeaderboard(
    process.env.NANSEN_API_KEY ?? '',
    Date.now(),
  ),
}));
const headers = { 'cache-control': 'no-store' };

export async function GET() {
  try {
    return Response.json(await service.get(), { headers });
  } catch (error) {
    const safe = asLeaderboardError(error);
    return Response.json(
      { error: safe.message },
      { status: safe.status, headers },
    );
  }
}

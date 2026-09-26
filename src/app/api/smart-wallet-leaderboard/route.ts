import {
  fetchNansenLeaderboard,
  LeaderboardError,
} from '../../../leaderboard/provider';
import {
  getSnapshotService,
  LEADERBOARD_CACHE_KEY,
} from '../../../leaderboard/snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const service = getSnapshotService(LEADERBOARD_CACHE_KEY, () =>
  fetchNansenLeaderboard(process.env.NANSEN_API_KEY ?? '', Date.now()),
);
const headers = { 'cache-control': 'no-store' };

export async function GET() {
  try {
    return Response.json(await service.get(), { headers });
  } catch (error) {
    const safe =
      error instanceof LeaderboardError
        ? error
        : new LeaderboardError(
            'Smart Wallet leaderboard is temporarily unavailable.',
            502,
          );
    return Response.json(
      { error: safe.message },
      { status: safe.status, headers },
    );
  }
}

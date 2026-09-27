import { NansenError } from '../../../../../nansen/client';
import { nansenAvailabilityFromEnv } from '../../../../../nansen/availability';
import { getSnapshotService } from '../../../../../leaderboard/snapshot';
import { findThesis, findTicker } from '../../../../../thesis/deck';
import {
  DETAIL_TTL_MS,
  detailCacheKey,
  loadTickerDetail,
} from '../../../../../thesis/nansen';
import type { ThesisId, TickerDetail } from '../../../../../thesis/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'cache-control': 'no-store' };

type RouteContext = { params: Promise<{ thesisId: string; symbol: string }> };

export async function GET(_request: Request, context: RouteContext) {
  if (nansenAvailabilityFromEnv(process.env.NANSEN_API_KEY) === 'unavailable')
    return Response.json(
      { error: 'Nansen is not configured.' },
      { status: 503, headers },
    );

  const { thesisId, symbol } = await context.params;
  const thesis = findThesis(thesisId);
  const ticker = findTicker(thesisId, symbol);
  if (!thesis || !ticker)
    return Response.json(
      { error: 'Unknown thesis or symbol.' },
      { status: 404, headers },
    );

  const apiKey = process.env.NANSEN_API_KEY ?? '';
  const cacheKey = detailCacheKey(thesis.id, ticker.symbol);
  const service = getSnapshotService(
    cacheKey,
    async () => {
      const detail = await loadTickerDetail(
        thesis.id as ThesisId,
        ticker.symbol,
        apiKey,
      );
      if (!detail) throw new NansenError('Unknown thesis or symbol.', 404);
      return {
        thesisId: detail.thesisId,
        symbol: detail.symbol,
        movements: detail.movements,
        holders: detail.holders,
        supply: detail.supply,
        perps: detail.perps,
      };
    },
    DETAIL_TTL_MS,
  );

  try {
    const snapshot = await service.get();
    const body: TickerDetail = {
      thesisId: snapshot.thesisId,
      symbol: snapshot.symbol,
      fetchedAt: snapshot.fetchedAt,
      stale: snapshot.stale,
      movements: snapshot.movements,
      holders: snapshot.holders,
      supply: snapshot.supply,
      perps: snapshot.perps,
    };
    return Response.json(body, { headers });
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

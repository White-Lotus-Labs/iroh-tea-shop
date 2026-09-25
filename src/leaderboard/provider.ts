import {
  normalizeLeaderboard,
  type SmartWalletLeaderboardEntry,
} from './model';

const ENDPOINT = 'https://api.nansen.ai/api/v1/perp-leaderboard';

export class LeaderboardError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfterMs = 0,
  ) {
    super(message);
  }
}

function safeError(status: number, retryAfterMs: number): LeaderboardError {
  if (status === 401)
    return new LeaderboardError(
      'Nansen authentication failed.',
      401,
      retryAfterMs,
    );
  if (status === 402)
    return new LeaderboardError(
      'Nansen API credits are unavailable.',
      402,
      retryAfterMs,
    );
  if (status === 403)
    return new LeaderboardError(
      'Nansen API access is unavailable for this plan.',
      403,
      retryAfterMs,
    );
  if (status === 429)
    return new LeaderboardError(
      'Too many requests. Please try again shortly.',
      429,
      retryAfterMs,
    );
  return new LeaderboardError(
    'Smart Wallet leaderboard is temporarily unavailable.',
    502,
    retryAfterMs,
  );
}

function retryAfter(response: Response, now: number): number {
  const value = response.headers.get('retry-after');
  if (!value) return 0;
  if (/^\d{1,6}$/.test(value)) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}

export async function fetchNansenLeaderboard(
  key: string,
  now: number,
  fetcher: typeof fetch = fetch,
): Promise<SmartWalletLeaderboardEntry[]> {
  if (!key.trim())
    throw new LeaderboardError('Nansen API is not configured.', 503);
  const body = {
    date: {
      from: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      to: new Date(now).toISOString().slice(0, 10),
    },
    pagination: { page: 1, per_page: 10 },
    filters: { include_smart_money_labels: ['Smart HL Perps Trader'] },
    premium_labels: false,
    order_by: [{ field: 'total_pnl', direction: 'DESC' }],
  };
  let response: Response;
  try {
    response = await fetcher(ENDPOINT, {
      method: 'POST',
      headers: { apikey: key, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
  } catch {
    throw new LeaderboardError(
      'Smart Wallet leaderboard is temporarily unavailable.',
      502,
    );
  }
  if (!response.ok) throw safeError(response.status, retryAfter(response, now));
  try {
    return normalizeLeaderboard(await response.json());
  } catch {
    throw new LeaderboardError('Nansen returned an invalid leaderboard.', 502);
  }
}

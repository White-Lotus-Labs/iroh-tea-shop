import { NansenError } from '../nansen/client';
import { managedNansenPost } from '../nansen/managed-client';
import { NansenManagerError } from '../nansen/request-manager';
import {
  boardQuery,
  type LeaderboardBoard,
  type LeaderboardMetric,
} from './boards';
import {
  normalizeLeaderboard,
  type SmartWalletLeaderboardEntry,
} from './model';

export class LeaderboardError extends NansenError {}

export async function fetchNansenLeaderboard(
  key: string,
  now: number,
  fetcher: typeof fetch = fetch,
  board: LeaderboardBoard = 'perps',
  metric: LeaderboardMetric = 'wins',
): Promise<SmartWalletLeaderboardEntry[]> {
  if (!key.trim())
    throw new LeaderboardError('Nansen API is not configured.', 503);
  const { filters, order_by, premium_labels } = boardQuery(board, metric);
  const body = {
    date: {
      from: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      to: new Date(now).toISOString().slice(0, 10),
    },
    pagination: { page: 1, per_page: 10 },
    filters,
    premium_labels,
    order_by,
  };
  try {
    const payload = await managedNansenPost(
      'perp-leaderboard',
      body,
      key,
      fetcher,
    );
    return normalizeLeaderboard(payload);
  } catch (error) {
    if (error instanceof NansenManagerError)
      throw new LeaderboardError(error.message, error.status);
    if (error instanceof NansenError) {
      throw new LeaderboardError(
        error.status === 502
          ? 'Smart Wallet leaderboard is temporarily unavailable.'
          : error.message,
        error.status,
        error.retryAfterMs,
      );
    }
    throw new LeaderboardError(
      'Smart Wallet leaderboard is temporarily unavailable.',
      502,
    );
  }
}

import { leaderboardRefreshTargets } from '../leaderboard/boards';
import { memeCallPlan } from '../leaderboard/meme';
import { THESES } from '../thesis/deck';
import type { Ticker } from '../thesis/types';

export type PlannedNansenCall = {
  surface: 'deck' | 'ticker-detail' | 'leaderboard';
  endpoint: string;
  thesisId: string | null;
  symbol: string | null;
};

function deckEndpoint(ticker: Ticker): string {
  return ticker.assetClass === 'native' && ticker.perp
    ? 'tgm/position-intelligence'
    : 'tgm/flow-intelligence';
}

/** Spot calls skipped for Solana. Perp calls only when the ticker has a perp. */
function detailEndpoints(ticker: Ticker): string[] {
  const endpoints: string[] = [];
  if (ticker.token && ticker.token.chain !== 'solana') {
    endpoints.push(
      'tgm/who-bought-sold',
      'tgm/who-bought-sold',
      'tgm/dex-trades',
      'tgm/holders',
      'tgm/token-information',
    );
  }
  if (ticker.perp) {
    endpoints.push('tgm/position-intelligence', 'smart-money/perp-trades');
  }
  return endpoints;
}

/**
 * Every Nansen request the hourly save is expected to make, derived from the
 * thesis catalog and the same rules as the fetchers.
 */
export function nansenCallPlan(): {
  deck: PlannedNansenCall[];
  details: PlannedNansenCall[];
  leaderboard: PlannedNansenCall[];
  background: PlannedNansenCall[];
  backgroundCount: number;
  uncleEndpoint: 'agent/fast';
} {
  const deck = THESES.flatMap((thesis) =>
    thesis.tickers.map((ticker) => ({
      surface: 'deck' as const,
      endpoint: deckEndpoint(ticker),
      thesisId: thesis.id,
      symbol: ticker.symbol,
    })),
  );
  const details = THESES.flatMap((thesis) =>
    thesis.tickers.flatMap((ticker) =>
      detailEndpoints(ticker).map((endpoint) => ({
        surface: 'ticker-detail' as const,
        endpoint,
        thesisId: thesis.id,
        symbol: ticker.symbol,
      })),
    ),
  );
  // One perp-leaderboard call per Hyperliquid target, then the meme pool and its entity lookups.
  const leaderboard: PlannedNansenCall[] = [
    ...leaderboardRefreshTargets()
      .filter((target) => target.board !== 'meme')
      .map(() => 'perp-leaderboard'),
    ...memeCallPlan(),
  ].map((endpoint) => ({
    surface: 'leaderboard' as const,
    endpoint,
    thesisId: null,
    symbol: null,
  }));
  const background = [...deck, ...details, ...leaderboard];
  return {
    deck,
    details,
    leaderboard,
    background,
    backgroundCount: background.length,
    uncleEndpoint: 'agent/fast',
  };
}

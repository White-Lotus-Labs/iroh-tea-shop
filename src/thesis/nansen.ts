import { nansenPost, NansenError } from '../nansen/client';
import { computeConviction } from './conviction';
import { THESES, findThesis, findTicker } from './deck';
import type {
  DeckSnapshot,
  HolderRow,
  PerpBook,
  Section,
  SmartTrade,
  SupplyGap,
  Ticker,
  TickerDetail,
  TickerSignal,
  ThesisId,
  ThesisSummary,
  WalletMove,
} from './types';

export const DECK_CACHE_KEY = 'thesis-deck:v1';
export const DECK_TTL_MS = 10 * 60 * 1000;
export const DETAIL_TTL_MS = 15 * 60 * 1000;

const SMART_MONEY_LABELS = [
  'Smart Trader',
  '30D Smart Trader',
  '90D Smart Trader',
  '180D Smart Trader',
  'Fund',
] as const;

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function dataRows(payload: unknown): Record<string, unknown>[] {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('data' in payload) ||
    !Array.isArray((payload as { data: unknown }).data)
  )
    return [];
  return (payload as { data: unknown[] }).data.filter(
    (row): row is Record<string, unknown> =>
      !!row && typeof row === 'object' && !Array.isArray(row),
  );
}

function dataObject(payload: unknown): Record<string, unknown> | null {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('data' in payload) ||
    !(payload as { data: unknown }).data ||
    typeof (payload as { data: unknown }).data !== 'object' ||
    Array.isArray((payload as { data: unknown }).data)
  )
    return null;
  return (payload as { data: Record<string, unknown> }).data;
}

function last7Days(now: number) {
  return {
    from: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
    to: new Date(now).toISOString(),
  };
}

function isSolana(ticker: Ticker) {
  return ticker.token?.chain === 'solana';
}

function usesPositionSignal(ticker: Ticker) {
  return ticker.assetClass === 'native' && !!ticker.perp;
}

export function normalizeFlowSignal(
  symbol: string,
  payload: unknown,
): TickerSignal {
  const row = dataRows(payload)[0];
  if (!row) {
    return {
      symbol,
      status: 'empty',
      source: 'flow-intelligence',
      smartMoneyNetFlowUsd: null,
      whaleNetFlowUsd: null,
      exchangeNetFlowUsd: null,
      smartMoneyWallets: null,
    };
  }
  const smartMoneyNetFlowUsd = numberOrNull(row.smart_trader_net_flow_usd);
  return {
    symbol,
    status: smartMoneyNetFlowUsd === null ? 'empty' : 'ok',
    source: 'flow-intelligence',
    smartMoneyNetFlowUsd,
    whaleNetFlowUsd: numberOrNull(row.whale_net_flow_usd),
    exchangeNetFlowUsd: numberOrNull(row.exchange_net_flow_usd),
    smartMoneyWallets: numberOrNull(row.smart_trader_wallet_count),
  };
}

export function normalizePositionSignal(
  symbol: string,
  payload: unknown,
): TickerSignal {
  const row = dataRows(payload)[0];
  if (!row) {
    return {
      symbol,
      status: 'empty',
      source: 'position-intelligence',
      smartMoneyNetFlowUsd: null,
      whaleNetFlowUsd: null,
      exchangeNetFlowUsd: null,
      smartMoneyWallets: null,
    };
  }
  const longs = numberOrNull(row.smart_trader_longs_usd);
  const shorts = numberOrNull(row.smart_trader_shorts_usd);
  const smartMoneyNetFlowUsd =
    longs === null || shorts === null ? null : longs - shorts;
  return {
    symbol,
    status: smartMoneyNetFlowUsd === null ? 'empty' : 'ok',
    source: 'position-intelligence',
    smartMoneyNetFlowUsd,
    whaleNetFlowUsd: null,
    exchangeNetFlowUsd: null,
    smartMoneyWallets: numberOrNull(row.smart_trader_wallet_count),
  };
}

export function normalizeWalletMoves(payload: unknown): WalletMove[] {
  return dataRows(payload)
    .map((row) => {
      const address = stringOrNull(row.address);
      if (!address) return null;
      return {
        address,
        label: stringOrNull(row.address_label),
        boughtUsd: numberOrNull(row.bought_volume_usd),
        soldUsd: numberOrNull(row.sold_volume_usd),
      };
    })
    .filter((row): row is WalletMove => row !== null)
    .slice(0, 5);
}

export function normalizeDexTrades(payload: unknown): SmartTrade[] {
  return dataRows(payload)
    .map((row) => {
      const trader = stringOrNull(row.trader_address);
      const actionRaw = stringOrNull(row.action)?.toUpperCase();
      if (!trader || (actionRaw !== 'BUY' && actionRaw !== 'SELL')) return null;
      return {
        trader,
        label: stringOrNull(row.trader_address_label),
        action: actionRaw === 'BUY' ? ('buy' as const) : ('sell' as const),
        valueUsd: numberOrNull(row.estimated_value_usd),
        at: stringOrNull(row.block_timestamp),
        txHash: stringOrNull(row.transaction_hash),
      };
    })
    .filter((row): row is SmartTrade => row !== null)
    .slice(0, 5);
}

export function normalizeHolders(payload: unknown): HolderRow[] {
  return dataRows(payload)
    .map((row) => {
      const address = stringOrNull(row.address);
      if (!address) return null;
      const ownership = numberOrNull(row.ownership_percentage);
      return {
        address,
        label: stringOrNull(row.address_label),
        valueUsd: numberOrNull(row.value_usd),
        ownershipPct: ownership === null ? null : ownership * 100,
        // Nansen returns absolute 7d balance change; contract field is change7dPct.
        change7dPct: numberOrNull(row.balance_change_7d),
      };
    })
    .filter((row): row is HolderRow => row !== null)
    .slice(0, 5);
}

export function normalizeSupply(payload: unknown): SupplyGap | null {
  const data = dataObject(payload);
  if (!data) return null;
  const details =
    data.token_details &&
    typeof data.token_details === 'object' &&
    !Array.isArray(data.token_details)
      ? (data.token_details as Record<string, unknown>)
      : null;
  if (!details) return null;
  const circulating = numberOrNull(details.circulating_supply);
  const total = numberOrNull(details.total_supply);
  const notCirculatingPct =
    circulating === null || total === null || total <= 0
      ? null
      : Math.max(0, Math.min(100, ((total - circulating) / total) * 100));
  if (circulating === null && total === null) return null;
  return { circulating, total, notCirculatingPct };
}

export function normalizeTotalHolders(payload: unknown): number | null {
  const data = dataObject(payload);
  if (!data) return null;
  const metrics =
    data.spot_metrics &&
    typeof data.spot_metrics === 'object' &&
    !Array.isArray(data.spot_metrics)
      ? (data.spot_metrics as Record<string, unknown>)
      : null;
  return metrics ? numberOrNull(metrics.total_holders) : null;
}

export function normalizePerpBook(
  positionPayload: unknown,
  tradesPayload: unknown,
): PerpBook {
  const row = dataRows(positionPayload)[0];
  const recent = dataRows(tradesPayload)
    .map((trade) => {
      const trader = stringOrNull(trade.trader_address);
      const sideRaw = stringOrNull(trade.side)?.toLowerCase();
      if (!trader || (sideRaw !== 'long' && sideRaw !== 'short')) return null;
      return {
        trader,
        label: stringOrNull(trade.trader_address_label),
        side: sideRaw as 'long' | 'short',
        action: stringOrNull(trade.action) ?? '',
        valueUsd: numberOrNull(trade.value_usd),
        at: stringOrNull(trade.block_timestamp),
      };
    })
    .filter(
      (
        trade,
      ): trade is PerpBook['recent'][number] => trade !== null,
    )
    .slice(0, 5);
  return {
    smartLongUsd: row ? numberOrNull(row.smart_trader_longs_usd) : null,
    smartShortUsd: row ? numberOrNull(row.smart_trader_shorts_usd) : null,
    recent,
  };
}

function errorSignal(
  symbol: string,
  source: TickerSignal['source'],
): TickerSignal {
  return {
    symbol,
    status: 'error',
    source,
    smartMoneyNetFlowUsd: null,
    whaleNetFlowUsd: null,
    exchangeNetFlowUsd: null,
    smartMoneyWallets: null,
  };
}

async function fetchTickerSignal(
  ticker: Ticker,
  apiKey: string,
): Promise<TickerSignal> {
  if (usesPositionSignal(ticker)) {
    try {
      const payload = await nansenPost(
        'tgm/position-intelligence',
        { token_address: ticker.perp },
        apiKey,
      );
      return normalizePositionSignal(ticker.symbol, payload);
    } catch {
      return errorSignal(ticker.symbol, 'position-intelligence');
    }
  }
  if (!ticker.token) return errorSignal(ticker.symbol, 'flow-intelligence');
  try {
    const payload = await nansenPost(
      'tgm/flow-intelligence',
      {
        chain: ticker.token.chain,
        token_address: ticker.token.address,
        timeframe: '7d',
      },
      apiKey,
    );
    return normalizeFlowSignal(ticker.symbol, payload);
  } catch {
    return errorSignal(ticker.symbol, 'flow-intelligence');
  }
}

export async function loadDeckSnapshot(apiKey: string): Promise<{
  theses: ThesisSummary[];
}> {
  const theses: ThesisSummary[] = [];
  for (const thesis of THESES) {
    const tickers = await Promise.all(
      thesis.tickers.map((ticker) => fetchTickerSignal(ticker, apiKey)),
    );
    theses.push({
      id: thesis.id,
      conviction: computeConviction(tickers),
      tickers,
    });
  }
  return { theses };
}

function unavailable(reason: string): Section<never> {
  return { status: 'unavailable', reason };
}

async function settled<T>(promise: Promise<T>): Promise<
  | { ok: true; value: T }
  | { ok: false; error: NansenError }
> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof NansenError
          ? error
          : new NansenError('Nansen is temporarily unavailable.', 502),
    };
  }
}

async function loadMovements(
  ticker: Ticker,
  apiKey: string,
  now: number,
): Promise<TickerDetail['movements']> {
  if (!ticker.token || isSolana(ticker)) return { status: 'not-applicable' };
  const date = last7Days(now);
  const base = {
    chain: ticker.token.chain,
    token_address: ticker.token.address,
    date,
    pagination: { page: 1, per_page: 10 },
  };
  const filters = { include_smart_money_labels: [...SMART_MONEY_LABELS] };
  const [buy, sell, dex] = await Promise.all([
    settled(
      nansenPost(
        'tgm/who-bought-sold',
        { ...base, buy_or_sell: 'BUY', filters },
        apiKey,
      ),
    ),
    settled(
      nansenPost(
        'tgm/who-bought-sold',
        { ...base, buy_or_sell: 'SELL', filters },
        apiKey,
      ),
    ),
    settled(
      nansenPost(
        'tgm/dex-trades',
        { ...base, only_smart_money: true },
        apiKey,
      ),
    ),
  ]);
  if (!buy.ok && !sell.ok && !dex.ok)
    return unavailable('Smart money movements are temporarily unavailable.');
  const buyers = buy.ok ? normalizeWalletMoves(buy.value) : [];
  const sellers = sell.ok ? normalizeWalletMoves(sell.value) : [];
  const recent = dex.ok ? normalizeDexTrades(dex.value) : [];
  if (buyers.length === 0 && sellers.length === 0 && recent.length === 0)
    return { status: 'empty' };
  return { status: 'ok', data: { buyers, sellers, recent } };
}

function buildHoldersSection(
  holdersResult:
    | { ok: true; value: unknown }
    | { ok: false; error: NansenError }
    | null,
  infoResult:
    | { ok: true; value: unknown }
    | { ok: false; error: NansenError }
    | null,
): TickerDetail['holders'] {
  if (holdersResult === null) return { status: 'not-applicable' };
  if (!holdersResult.ok && (!infoResult || !infoResult.ok))
    return unavailable('Holder data is temporarily unavailable.');
  const smartMoney = holdersResult.ok
    ? normalizeHolders(holdersResult.value)
    : [];
  const totalHolders =
    infoResult && infoResult.ok
      ? normalizeTotalHolders(infoResult.value)
      : null;
  if (smartMoney.length === 0 && totalHolders === null)
    return { status: 'empty' };
  return { status: 'ok', data: { totalHolders, smartMoney } };
}

function buildSupplySection(
  ticker: Ticker,
  infoResult:
    | { ok: true; value: unknown }
    | { ok: false; error: NansenError }
    | null,
): TickerDetail['supply'] {
  if (
    !ticker.token ||
    isSolana(ticker) ||
    ticker.assetClass === 'stock' ||
    ticker.assetClass === 'native'
  )
    return { status: 'not-applicable' };
  if (!infoResult)
    return unavailable('Supply data is temporarily unavailable.');
  if (!infoResult.ok)
    return unavailable('Supply data is temporarily unavailable.');
  const data = normalizeSupply(infoResult.value);
  if (!data) return { status: 'empty' };
  return { status: 'ok', data };
}

async function loadPerps(
  ticker: Ticker,
  apiKey: string,
): Promise<TickerDetail['perps']> {
  if (!ticker.perp) return { status: 'not-applicable' };
  const [position, trades] = await Promise.all([
    settled(
      nansenPost(
        'tgm/position-intelligence',
        { token_address: ticker.perp },
        apiKey,
      ),
    ),
    settled(
      nansenPost(
        'smart-money/perp-trades',
        {
          filters: { token_symbol: ticker.perp },
          lookback_hours: 24,
          pagination: { page: 1, per_page: 10 },
        },
        apiKey,
      ),
    ),
  ]);
  if (!position.ok && !trades.ok)
    return unavailable('Perp data is temporarily unavailable.');
  const data = normalizePerpBook(
    position.ok ? position.value : { data: [] },
    trades.ok ? trades.value : { data: [] },
  );
  if (
    data.smartLongUsd === null &&
    data.smartShortUsd === null &&
    data.recent.length === 0
  )
    return { status: 'empty' };
  return { status: 'ok', data };
}

export async function loadTickerDetail(
  thesisId: ThesisId,
  symbol: string,
  apiKey: string,
  now: number = Date.now(),
): Promise<TickerDetail | null> {
  const thesis = findThesis(thesisId);
  const ticker = findTicker(thesisId, symbol);
  if (!thesis || !ticker) return null;

  const needsSpotMeta = !!ticker.token && !isSolana(ticker);

  const [movements, holdersResult, infoResult, perps] = await Promise.all([
    loadMovements(ticker, apiKey, now),
    needsSpotMeta
      ? settled(
          nansenPost(
            'tgm/holders',
            {
              chain: ticker.token!.chain,
              token_address: ticker.token!.address,
              label_type: 'smart_money',
              filters: {
                include_smart_money_labels: [...SMART_MONEY_LABELS],
              },
              pagination: { page: 1, per_page: 10 },
            },
            apiKey,
          ),
        )
      : Promise.resolve(null),
    needsSpotMeta
      ? settled(
          nansenPost(
            'tgm/token-information',
            {
              chain: ticker.token!.chain,
              token_address: ticker.token!.address,
              timeframe: '7d',
            },
            apiKey,
          ),
        )
      : Promise.resolve(null),
    loadPerps(ticker, apiKey),
  ]);

  return {
    thesisId: thesis.id,
    symbol: ticker.symbol,
    fetchedAt: new Date(now).toISOString(),
    stale: false,
    movements,
    holders: buildHoldersSection(holdersResult, infoResult),
    supply: buildSupplySection(ticker, infoResult),
    perps,
  };
}

export function detailCacheKey(thesisId: string, symbol: string) {
  return `thesis-detail:${thesisId}:${symbol.toUpperCase()}`;
}

export type { DeckSnapshot };

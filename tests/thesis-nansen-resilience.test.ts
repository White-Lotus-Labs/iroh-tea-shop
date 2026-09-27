import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createSnapshotService } from '../src/leaderboard/snapshot';
import { NansenError } from '../src/nansen/client';
import {
  countErroredTickers,
  loadDeckSnapshot,
  mapPool,
  preferExistingDeck,
  withNansenRetry,
} from '../src/thesis/nansen';
import type { ThesisSummary } from '../src/thesis/types';

beforeEach(() => {
  vi.stubEnv('NANSEN_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('withNansenRetry', () => {
  test('retries once after a short backoff on 429', async () => {
    const waits: number[] = [];
    let attempts = 0;
    const result = await withNansenRetry(
      async () => {
        attempts += 1;
        if (attempts === 1)
          throw new NansenError('Too many requests.', 429, 1_200);
        return 'ok';
      },
      async (ms) => {
        waits.push(ms);
      },
    );
    expect(result).toBe('ok');
    expect(attempts).toBe(2);
    expect(waits).toEqual([1_200]);
  });

  test('caps Retry-After at 3 seconds and retries on 5xx', async () => {
    const waits: number[] = [];
    let attempts = 0;
    await withNansenRetry(
      async () => {
        attempts += 1;
        if (attempts === 1)
          throw new NansenError('upstream', 503, 10_000);
        return true;
      },
      async (ms) => {
        waits.push(ms);
      },
    );
    expect(attempts).toBe(2);
    expect(waits).toEqual([3_000]);
  });

  test('uses 600ms backoff when Retry-After is absent', async () => {
    const waits: number[] = [];
    let attempts = 0;
    await withNansenRetry(
      async () => {
        attempts += 1;
        if (attempts === 1) throw new NansenError('timeout', 502);
        return true;
      },
      async (ms) => {
        waits.push(ms);
      },
    );
    expect(waits).toEqual([600]);
  });

  test('does not retry auth failures', async () => {
    let attempts = 0;
    await expect(
      withNansenRetry(async () => {
        attempts += 1;
        throw new NansenError('Nansen authentication failed.', 401);
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(attempts).toBe(1);
  });
});

describe('mapPool concurrency', () => {
  test('never runs more than the concurrency cap at once', async () => {
    let inFlight = 0;
    let peak = 0;
    const started: number[] = [];
    await mapPool([1, 2, 3, 4, 5, 6, 7, 8], 4, async (item) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      started.push(item);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight -= 1;
      return item * 2;
    });
    expect(peak).toBeLessThanOrEqual(4);
    expect(started).toHaveLength(8);
  });
});

describe('preferExistingDeck', () => {
  const ok = (symbol: string) => ({
    symbol,
    status: 'ok' as const,
    source: 'flow-intelligence' as const,
    smartMoneyNetFlowUsd: 1,
    whaleNetFlowUsd: null,
    exchangeNetFlowUsd: null,
    smartMoneyWallets: 1,
  });
  const err = (symbol: string) => ({
    symbol,
    status: 'error' as const,
    source: 'flow-intelligence' as const,
    smartMoneyNetFlowUsd: null,
    whaleNetFlowUsd: null,
    exchangeNetFlowUsd: null,
    smartMoneyWallets: null,
  });

  test('keeps the cached snapshot when a refresh is worse', () => {
    const existing: ThesisSummary[] = [
      {
        id: 'ai',
        conviction: {
          level: 'strong',
          accumulating: 1,
          measured: 1,
          netFlowUsd: 1,
        },
        tickers: [ok('VVV'), ok('NVDA')],
      },
    ];
    const fresh: ThesisSummary[] = [
      {
        id: 'ai',
        conviction: {
          level: 'unknown',
          accumulating: 0,
          measured: 0,
          netFlowUsd: 0,
        },
        tickers: [err('VVV'), err('NVDA')],
      },
    ];
    expect(countErroredTickers(fresh)).toBe(2);
    expect(countErroredTickers(existing)).toBe(0);
    expect(preferExistingDeck({ theses: fresh }, { theses: existing })).toMatch(
      /more ticker errors/,
    );
  });

  test('createSnapshotService keeps the better cached deck marked stale', async () => {
    let now = Date.parse('2026-09-27T12:00:00Z');
    let wave = 0;
    const load = vi.fn(async () => {
      wave += 1;
      if (wave === 1)
        return {
          theses: [
            {
              id: 'ai' as const,
              conviction: {
                level: 'strong' as const,
                accumulating: 1,
                measured: 1,
                netFlowUsd: 1,
              },
              tickers: [ok('VVV')],
            },
          ],
        };
      return {
        theses: [
          {
            id: 'ai' as const,
            conviction: {
              level: 'unknown' as const,
              accumulating: 0,
              measured: 0,
              netFlowUsd: 0,
            },
            tickers: [err('VVV')],
          },
        ],
      };
    });
    const service = createSnapshotService(
      load,
      10 * 60_000,
      () => now,
      preferExistingDeck,
    );
    const first = await service.get();
    expect(first.stale).toBe(false);
    expect(countErroredTickers(first.theses)).toBe(0);
    now += 10 * 60_000;
    const kept = await service.get();
    expect(kept.stale).toBe(true);
    expect(kept.refreshError).toMatch(/more ticker errors/);
    expect(kept.fetchedAt).toBe(first.fetchedAt);
    expect(countErroredTickers(kept.theses)).toBe(0);
  });
});

describe('loadDeckSnapshot resilience', () => {
  test('retries a failing ticker once and caps concurrent upstream calls', async () => {
    let inFlight = 0;
    let peak = 0;
    const attempts = new Map<string, number>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        const path = String(url);
        attempts.set(path, (attempts.get(path) ?? 0) + 1);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        if (
          path.includes('flow-intelligence') &&
          (attempts.get(path) ?? 0) === 1
        ) {
          return new Response('rate', {
            status: 429,
            headers: { 'retry-after': '1' },
          });
        }
        if (path.includes('position-intelligence')) {
          return Response.json({
            data: [
              {
                smart_trader_longs_usd: 5,
                smart_trader_shorts_usd: 1,
                smart_trader_wallet_count: 2,
              },
            ],
          });
        }
        return Response.json({
          data: [
            {
              smart_trader_net_flow_usd: 10,
              whale_net_flow_usd: 1,
              exchange_net_flow_usd: -1,
              smart_trader_wallet_count: 2,
            },
          ],
        });
      }),
    );

    const deck = await loadDeckSnapshot('test-key', {
      concurrency: 4,
      wait: async () => undefined,
    });
    expect(peak).toBeLessThanOrEqual(4);
    expect(deck.theses).toHaveLength(3);
    expect(
      deck.theses.every((thesis) =>
        thesis.tickers.every((ticker) => ticker.status === 'ok'),
      ),
    ).toBe(true);
    expect(
      [...attempts.values()].some((count) => count >= 2),
    ).toBe(true);
  });
});

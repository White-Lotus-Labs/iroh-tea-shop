import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createSnapshotService } from '../src/leaderboard/snapshot';
import { THESES } from '../src/thesis/deck';

const flowOk = {
  data: [
    {
      smart_trader_net_flow_usd: 1000,
      whale_net_flow_usd: 100,
      exchange_net_flow_usd: -50,
      smart_trader_wallet_count: 3,
    },
  ],
};

const positionOk = {
  data: [
    {
      smart_trader_longs_usd: 5000,
      smart_trader_shorts_usd: 2000,
      smart_trader_total_usd: 7000,
    },
  ],
};

function mockNansen(handler: (path: string, body: unknown) => unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url).replace('https://api.nansen.ai/api/v1/', '');
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      try {
        return Response.json(handler(path, body));
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('HTTP:'))
          return new Response('fail', {
            status: Number(error.message.slice(5)),
          });
        throw error;
      }
    }),
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NANSEN_API_KEY', 'server-only-secret');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('GET /api/theses', () => {
  test('returns a deck snapshot and keeps the key server-side', async () => {
    mockNansen((path, body) => {
      if (path === 'tgm/position-intelligence') return positionOk;
      if (path === 'tgm/flow-intelligence') return flowOk;
      throw new Error(`unexpected ${path} ${JSON.stringify(body)}`);
    });
    const { GET } = await import('../src/app/api/theses/route');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body.source).toBe('nansen');
    expect(body.stale).toBe(false);
    expect(body.theses).toHaveLength(3);
    expect(body.theses[0].tickers).toHaveLength(4);
    expect(JSON.stringify(body)).not.toContain('server-only-secret');
    const symbols = body.theses.flatMap(
      (thesis: { tickers: { symbol: string }[] }) =>
        thesis.tickers.map((ticker) => ticker.symbol),
    );
    expect(symbols).toContain('BTC');
    expect(symbols).toContain('SHROOM');
  });

  test('keeps the deck when one ticker upstream fails', async () => {
    mockNansen((path, body) => {
      const record = body as { token_address?: string };
      if (
        path === 'tgm/flow-intelligence' &&
        record.token_address === '0xCA9c78Dd337A67F6e0077F65F5E9218719d30eDf'
      )
        throw new Error('HTTP:502');
      if (path === 'tgm/position-intelligence') return positionOk;
      if (path === 'tgm/flow-intelligence') return flowOk;
      throw new Error(`unexpected ${path}`);
    });
    const { GET } = await import('../src/app/api/theses/route');
    const body = await (await GET()).json();
    const net = body.theses
      .find((thesis: { id: string }) => thesis.id === 'robinhood')
      .tickers.find((ticker: { symbol: string }) => ticker.symbol === 'NET');
    expect(net.status).toBe('error');
    expect(
      body.theses[0].tickers.some((t: { status: string }) => t.status === 'ok'),
    ).toBe(true);
  });

  test('returns 503 when Nansen is not configured', async () => {
    vi.stubEnv('NANSEN_API_KEY', '');
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const { GET } = await import('../src/app/api/theses/route');
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Nansen is not configured.',
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  test('serves a stale deck when refresh fails after a good snapshot', async () => {
    let now = Date.parse('2026-09-27T12:00:00Z');
    let fail = false;
    const load = vi.fn(async () => {
      if (fail) throw new Error('offline');
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
            tickers: [],
          },
        ],
      };
    });
    const service = createSnapshotService(load, 10 * 60_000, () => now);
    const first = await service.get();
    fail = true;
    now += 10 * 60_000;
    const stale = await service.get();
    expect(stale.stale).toBe(true);
    expect(stale.refreshError).toBeTruthy();
    expect(stale.fetchedAt).toBe(first.fetchedAt);
  });
});

describe('GET /api/theses/[thesisId]/[symbol]', () => {
  test('returns 404 for unknown ids without calling Nansen', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const { GET } = await import(
      '../src/app/api/theses/[thesisId]/[symbol]/route'
    );
    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ thesisId: 'nope', symbol: 'BTC' }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'Unknown thesis or symbol.',
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  test('returns ticker detail with section statuses for a crypto ticker', async () => {
    mockNansen((path) => {
      if (path === 'tgm/who-bought-sold')
        return {
          data: [
            {
              address: '0xabc',
              address_label: 'Smart Trader',
              bought_volume_usd: 10,
              sold_volume_usd: 0,
            },
          ],
        };
      if (path === 'tgm/dex-trades')
        return {
          data: [
            {
              trader_address: '0xabc',
              trader_address_label: 'Smart Trader',
              action: 'BUY',
              estimated_value_usd: 10,
              block_timestamp: '2026-09-26T00:00:00Z',
              transaction_hash: '0x1',
            },
          ],
        };
      if (path === 'tgm/holders')
        return {
          data: [
            {
              address: '0xabc',
              address_label: 'Fund',
              value_usd: 100,
              ownership_percentage: 0.01,
              balance_change_7d: 1,
            },
          ],
        };
      if (path === 'tgm/token-information')
        return {
          data: {
            token_details: {
              circulating_supply: 50,
              total_supply: 100,
            },
            spot_metrics: { total_holders: 9 },
          },
        };
      if (path === 'tgm/position-intelligence') return positionOk;
      if (path === 'smart-money/perp-trades') return { data: [] };
      throw new Error(`unexpected ${path}`);
    });
    const { GET } = await import(
      '../src/app/api/theses/[thesisId]/[symbol]/route'
    );
    const ticker = THESES[0].tickers.find((row) => row.symbol === 'ARB')!;
    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ thesisId: 'robinhood', symbol: ticker.symbol }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.symbol).toBe('ARB');
    expect(body.movements.status).toBe('ok');
    expect(body.holders.status).toBe('ok');
    expect(body.supply.status).toBe('ok');
    expect(body.perps.status).toBe('ok');
  });

  test('marks solana spot sections not-applicable without calling them', async () => {
    const called: string[] = [];
    mockNansen((path) => {
      called.push(path);
      if (path === 'tgm/position-intelligence') return positionOk;
      if (path === 'smart-money/perp-trades') return { data: [] };
      throw new Error(`unexpected ${path}`);
    });
    const { GET } = await import(
      '../src/app/api/theses/[thesisId]/[symbol]/route'
    );
    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ thesisId: 'bullrun', symbol: 'SOL' }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.movements.status).toBe('not-applicable');
    expect(body.holders.status).toBe('not-applicable');
    expect(body.supply.status).toBe('not-applicable');
    expect(body.perps.status).toBe('ok');
    expect(called.every((path) => !path.includes('who-bought-sold'))).toBe(
      true,
    );
    expect(called.every((path) => !path.includes('holders'))).toBe(true);
  });
});

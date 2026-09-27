import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { boardCacheKey } from '../src/leaderboard/boards';
import { memeCallPlan } from '../src/leaderboard/meme';
import { nansenCallPlan } from '../src/nansen/call-plan';
import { NANSEN_REFRESH_MS } from '../src/nansen/snapshot-store';
import { openTempDb } from './temp-sqlite';

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

const memeBoard = JSON.parse(
  readFileSync(
    'tests/fixtures/nansen/smart-money-pnl-leaderboard.json',
    'utf8',
  ),
) as unknown;
const ogleSummary = JSON.parse(
  readFileSync(
    'tests/fixtures/nansen/profiler-pnl-summary__entity-ogle.json',
    'utf8',
  ),
) as unknown;
const MEME_KEYS = [boardCacheKey('meme', 'wins'), boardCacheKey('meme', 'roi')];

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
  vi.stubEnv('NANSEN_REQUEST_STARTS_PER_SECOND', '1000');
  vi.stubEnv('NANSEN_REQUEST_START_BURST', '1000');
  vi.stubEnv('NANSEN_GLOBAL_MAX_CONCURRENT', '32');
  vi.stubEnv('NANSEN_NORMAL_MAX_QUEUE', '200');
  vi.stubEnv('NANSEN_JSON_MAX_RETRIES', '0');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Nansen call plan', () => {
  test('counts the background save and leaves Uncle out of it', () => {
    const plan = nansenCallPlan();
    expect(plan.deck).toHaveLength(12);
    expect(plan.leaderboard).toHaveLength(24);
    expect(plan.leaderboard[0]).toEqual({
      surface: 'leaderboard',
      endpoint: 'perp-leaderboard',
      thesisId: null,
      symbol: null,
    });
    expect(plan.leaderboard.slice(15).map((call) => call.endpoint)).toEqual(
      memeCallPlan(),
    );
    expect(memeCallPlan()).toHaveLength(9);
    expect(plan.details).toHaveLength(67);
    expect(plan.backgroundCount).toBe(103);
    expect(plan.uncleEndpoint).toBe('agent/fast');
    expect(NANSEN_REFRESH_MS).toBe(60 * 60 * 1000);
    const readme = readFileSync('README.md', 'utf8');
    expect(readme).toContain('103 Nansen requests');
    expect(readme).toContain('agent/fast');
  });
});

describe('saved Nansen readings', () => {
  test('a refresh asks Nansen once per planned call and a second read does not', async () => {
    const temp = openTempDb();
    const called: string[] = [];
    mockNansen((path, body) => {
      called.push(path);
      if (path === 'tgm/token-information')
        return {
          data: {
            token_details: { circulating_supply: 50, total_supply: 100 },
            spot_metrics: { total_holders: 9 },
          },
        };
      if (path === 'perp-leaderboard')
        return {
          data: [
            {
              trader_address: `0x${'a'.repeat(40)}`,
              trader_address_label: 'Observed Trader',
              total_pnl: 10,
              roi: 0.1,
              account_value: 20,
            },
          ],
        };
      if (path === 'tgm/position-intelligence') return positionOk;
      if (path === 'tgm/flow-intelligence') return flowOk;
      // The fixture has more than 8 entity rows in its top 20, so the lookups hit the cap.
      if (path === 'smart-money/pnl-leaderboard') return memeBoard;
      if (path === 'profiler/address/pnl-summary')
        return (body as { entity_name: string }).entity_name === 'ogle'
          ? ogleSummary
          : { traded_times: 0, top5_tokens: [] };
      return { data: [] };
    });
    try {
      const { refreshSavedNansenData } = await import('../src/nansen/refresh');
      const { readNansenSnapshot } = await import(
        '../src/nansen/snapshot-store'
      );
      const { DECK_CACHE_KEY } = await import('../src/thesis/nansen');
      const { LEADERBOARD_CACHE_KEY } = await import(
        '../src/leaderboard/snapshot'
      );
      const now = Date.parse('2026-09-27T12:00:00Z');
      const report = await refreshSavedNansenData(
        temp.db,
        'server-only-secret',
        now,
      );
      expect(report.missing).toEqual([]);
      expect(report.saved).toHaveLength(30);
      expect(report.saved).toEqual(expect.arrayContaining(MEME_KEYS));
      expect(called).toHaveLength(nansenCallPlan().backgroundCount);
      expect(
        called.filter((path) => path === 'smart-money/pnl-leaderboard'),
      ).toHaveLength(1);
      const before = called.length;
      const deck = await readNansenSnapshot(temp.db, DECK_CACHE_KEY, now);
      const board = await readNansenSnapshot<{ entries: unknown[] }>(
        temp.db,
        LEADERBOARD_CACHE_KEY,
        now,
      );
      expect(deck?.source).toBe('nansen');
      expect(deck?.stale).toBe(false);
      expect(board?.entries).toHaveLength(1);
      const meme = await readNansenSnapshot<{
        entries: { rank: number; entity?: string }[];
      }>(temp.db, MEME_KEYS[0]!, now);
      expect(meme?.entries.map((entry) => entry.rank)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      ]);
      expect(meme?.entries[5]?.entity).toBe('ogle');
      expect(called).toHaveLength(before);
      expect(JSON.stringify(deck)).not.toContain('server-only-secret');
    } finally {
      await temp.close();
    }
  });

  test('keeps the previous row when a later refresh fails', async () => {
    const temp = openTempDb();
    let failBoard = false;
    mockNansen((path) => {
      if (path === 'perp-leaderboard') {
        if (failBoard) throw new Error('HTTP:502');
        return {
          data: [
            {
              trader_address: `0x${'b'.repeat(40)}`,
              trader_address_label: 'First Trader',
              total_pnl: 10,
              roi: 0.1,
              account_value: 20,
            },
          ],
        };
      }
      if (path === 'tgm/position-intelligence') return positionOk;
      if (path === 'tgm/flow-intelligence') return flowOk;
      if (path === 'tgm/token-information') return { data: {} };
      return { data: [] };
    });
    try {
      const { refreshSavedNansenData } = await import('../src/nansen/refresh');
      const { readNansenSnapshot } = await import(
        '../src/nansen/snapshot-store'
      );
      const { LEADERBOARD_CACHE_KEY } = await import(
        '../src/leaderboard/snapshot'
      );
      const now = Date.parse('2026-09-27T12:00:00Z');
      await refreshSavedNansenData(temp.db, 'key', now);
      failBoard = true;
      const again = await refreshSavedNansenData(
        temp.db,
        'key',
        now + NANSEN_REFRESH_MS,
      );
      expect(again.kept).toContain(LEADERBOARD_CACHE_KEY);
      const board = await readNansenSnapshot<{
        entries: { displayName: string }[];
      }>(temp.db, LEADERBOARD_CACHE_KEY, now + NANSEN_REFRESH_MS);
      expect(board?.stale).toBe(true);
      expect(board?.entries[0]?.displayName).toBe('First Trader');
      expect(board?.fetchedAt).toBe('2026-09-27T12:00:00.000Z');
    } finally {
      await temp.close();
    }
  });

  test('a failed meme leaderboard keeps both meme rows and marks them stale', async () => {
    const temp = openTempDb();
    let failMeme = false;
    mockNansen((path) => {
      if (path === 'smart-money/pnl-leaderboard') {
        if (failMeme) throw new Error('HTTP:502');
        return memeBoard;
      }
      if (path === 'tgm/position-intelligence') return positionOk;
      if (path === 'tgm/flow-intelligence') return flowOk;
      if (path === 'tgm/token-information') return { data: {} };
      return { data: [] };
    });
    try {
      const { refreshSavedNansenData } = await import('../src/nansen/refresh');
      const { readNansenSnapshot } = await import(
        '../src/nansen/snapshot-store'
      );
      const now = Date.parse('2026-09-27T12:00:00Z');
      await refreshSavedNansenData(temp.db, 'key', now);
      failMeme = true;
      const later = now + NANSEN_REFRESH_MS;
      const again = await refreshSavedNansenData(temp.db, 'key', later);
      expect(again.kept).toEqual(MEME_KEYS);
      for (const key of MEME_KEYS) {
        const board = await readNansenSnapshot<{ entries: unknown[] }>(
          temp.db,
          key,
          later,
        );
        expect(board?.stale).toBe(true);
        expect(board?.entries).toHaveLength(10);
        expect(board?.fetchedAt).toBe('2026-09-27T12:00:00.000Z');
      }
    } finally {
      await temp.close();
    }
  });

  test('does not call Nansen when the key is missing', async () => {
    const temp = openTempDb();
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    try {
      const { refreshSavedNansenData } = await import('../src/nansen/refresh');
      const report = await refreshSavedNansenData(temp.db, '');
      expect(report.skipped).toBe('no-key');
      expect(upstream).not.toHaveBeenCalled();
    } finally {
      await temp.close();
    }
  });
});

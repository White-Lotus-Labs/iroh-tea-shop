import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  normalizeLeaderboard,
  formatMoney,
  formatRoi,
} from '../src/leaderboard/model';
import { fetchNansenLeaderboard } from '../src/leaderboard/provider';
import { createSnapshotService, SNAPSHOT_TTL_MS } from '../src/leaderboard/snapshot';

const address = (n: number) => `0x${n.toString(16).padStart(40, '0')}`;
const row = (n: number, overrides: Record<string, unknown> = {}) => ({
  trader_address: address(n),
  trader_address_label: n === 1 ? 'Alpha Trader' : null,
  total_pnl: 1_000_000 - n * 1000,
  roi: 0.274,
  account_value: 4_600_000,
  ...overrides,
});

describe('Nansen leaderboard provider', () => {
  afterEach(() => vi.restoreAllMocks());

  test('requests the real endpoint with server auth and the 30-day Smart HL query', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ data: [row(1)] }));
    const now = Date.parse('2026-09-25T12:34:00Z');
    const entries = await fetchNansenLeaderboard('private-key', now, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.nansen.ai/api/v1/perp-leaderboard');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      apikey: 'private-key',
      'content-type': 'application/json',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      date: { from: '2026-08-26', to: '2026-09-25' },
      pagination: { page: 1, per_page: 10 },
      filters: { include_smart_money_labels: ['Smart HL Perps Trader'] },
      premium_labels: false,
      order_by: [{ field: 'total_pnl', direction: 'DESC' }],
    });
    expect(entries[0]).toMatchObject({ rank: 1, displayName: 'Alpha Trader' });
  });

  test('normalizes Top 10, address fallback, missing values and fractional ROI', () => {
    const records = Array.from({ length: 12 }, (_, i) => row(i + 1));
    records[1] = row(2, {
      trader_address_label: 'Smart HL Perps Trader',
      total_pnl: null,
      roi: -0.082,
      account_value: null,
    });
    const entries = normalizeLeaderboard({ data: records });
    expect(entries).toHaveLength(10);
    expect(entries.map((entry) => entry.rank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(entries[0].displayName).toBe('Alpha Trader');
    expect(entries[1].displayName).toBe('0x0000...0002');
    expect(entries[1]).toMatchObject({
      pnl: null,
      roi: -0.082,
      accountValue: null,
    });
    expect(formatMoney(1_820_000, true)).toBe('+$1.82M');
    expect(formatMoney(-482_000, true)).toBe('-$482K');
    expect(formatMoney(4_600_000)).toBe('$4.60M');
    expect(formatMoney(null)).toBe('—');
    expect(formatRoi(0.274)).toBe('+27.4%');
    expect(formatRoi(-0.082)).toBe('-8.2%');
    expect(formatRoi(null)).toBe('—');
    expect(normalizeLeaderboard({ data: [] })).toEqual([]);
  });

  test('reports safe errors for absent key and failed Nansen calls', async () => {
    const fetcher = vi.fn();
    await expect(
      fetchNansenLeaderboard('', Date.now(), fetcher),
    ).rejects.toMatchObject({
      message: 'Nansen API is not configured.',
      status: 503,
    });
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockResolvedValue(
      new Response('secret upstream body', {
        status: 429,
        headers: { 'retry-after': '120' },
      }),
    );
    await expect(
      fetchNansenLeaderboard('key', Date.now(), fetcher),
    ).rejects.toMatchObject({
      message: 'Too many requests. Please try again shortly.',
      status: 429,
      retryAfterMs: 120_000,
    });
  });
});

describe('30-minute server snapshot', () => {
  let now: number;
  beforeEach(() => {
    now = Date.parse('2026-09-25T12:00:00Z');
  });

  test('serves the same snapshot on repeat route-equivalent requests and refreshes only after expiry', async () => {
    type Payload = { entries: ReturnType<typeof normalizeLeaderboard> };
    const load = vi
      .fn<() => Promise<Payload>>()
      .mockResolvedValueOnce({
        entries: [normalizeLeaderboard({ data: [row(1)] })[0]],
      })
      .mockResolvedValueOnce({
        entries: [normalizeLeaderboard({ data: [row(2)] })[0]],
      });
    const service = createSnapshotService(load, SNAPSHOT_TTL_MS, () => now);
    const first = await service.get();
    expect(first.expiresAt).toBe('2026-09-25T12:30:00.000Z');
    now += 20 * 60_000;
    expect(await service.get()).toEqual(first);
    expect(await service.get()).toEqual(first);
    expect(load).toHaveBeenCalledTimes(1);
    now += 10 * 60_000;
    const second = await service.get();
    expect(load).toHaveBeenCalledTimes(2);
    expect(second.entries[0].address).toBe(address(2));
  });

  test('coalesces concurrent requests and marks a previous real snapshot stale on failure', async () => {
    type Payload = { entries: ReturnType<typeof normalizeLeaderboard> };
    let release!: (value: Payload) => void;
    const load = vi
      .fn<() => Promise<Payload>>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error('provider offline'));
    const service = createSnapshotService(load, SNAPSHOT_TTL_MS, () => now);
    const pending = [service.get(), service.get(), service.get()];
    expect(load).toHaveBeenCalledTimes(1);
    release({ entries: normalizeLeaderboard({ data: [row(1)] }) });
    const snapshots = await Promise.all(pending);
    expect(snapshots[0]).toEqual(snapshots[1]);
    now += 30 * 60_000;
    const stale = await service.get();
    expect(stale).toMatchObject({ stale: true, source: 'nansen' });
    expect(stale.fetchedAt).toBe(snapshots[0].fetchedAt);
    expect(load).toHaveBeenCalledTimes(2);
    expect(await service.get()).toEqual(stale);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

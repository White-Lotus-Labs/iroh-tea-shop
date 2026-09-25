import { beforeEach, afterEach, expect, test, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NANSEN_API_KEY', 'server-only-secret');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test('GET keeps the key server-side and reuses the same real snapshot on another request', async () => {
  const upstream = vi.fn().mockResolvedValue(
    Response.json({
      data: [
        {
          trader_address: `0x${'1'.repeat(40)}`,
          trader_address_label: 'Observed Trader',
          total_pnl: 4200,
          roi: 0.12,
          account_value: null,
        },
      ],
    }),
  );
  vi.stubGlobal('fetch', upstream);
  const { GET } = await import('../src/app/api/smart-wallet-leaderboard/route');
  const first = await GET();
  const second = await GET();
  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(upstream).toHaveBeenCalledTimes(1);
  const body = await first.text();
  expect(await second.text()).toBe(body);
  expect(body).not.toContain('server-only-secret');
  expect(first.headers.get('cache-control')).toBe('no-store');
});

test('GET returns a safe error when no key exists and never calls Nansen', async () => {
  vi.stubEnv('NANSEN_API_KEY', '');
  const upstream = vi.fn();
  vi.stubGlobal('fetch', upstream);
  const { GET } = await import('../src/app/api/smart-wallet-leaderboard/route');
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    error: 'Nansen API is not configured.',
  });
  expect(upstream).not.toHaveBeenCalled();
});

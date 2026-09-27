import { describe, expect, it } from 'vitest';
import {
  clientIpFromRequest,
  createAgentDailyCap,
  DEFAULT_AGENT_DAILY_LIMIT,
} from '../src/nansen/agent-cap';

describe('Nansen Research Agent daily cap', () => {
  it('defaults to one call per IP', () => {
    expect(DEFAULT_AGENT_DAILY_LIMIT).toBe(1);
  });

  it('rejects calls after the limit and resets at midnight UTC', () => {
    const cap = createAgentDailyCap();
    const beforeMidnight = Date.UTC(2026, 8, 27, 23, 59, 59);

    expect(cap.claim('203.0.113.10', beforeMidnight, '1')).toMatchObject({
      allowed: true,
      limit: 1,
      remaining: 0,
    });
    expect(cap.claim('203.0.113.10', beforeMidnight, '1')).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 1,
    });
    expect(
      cap.claim('203.0.113.10', beforeMidnight + 1_000, '1'),
    ).toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });

  it('tracks each IP independently', () => {
    const cap = createAgentDailyCap();
    const now = Date.UTC(2026, 8, 27, 12);

    expect(cap.claim('203.0.113.10', now, '1').allowed).toBe(true);
    expect(cap.claim('203.0.113.10', now, '1').allowed).toBe(false);
    expect(cap.claim('203.0.113.11', now, '1')).toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });

  it('allows zero to turn the Research Agent off', () => {
    expect(
      createAgentDailyCap().claim('203.0.113.10', Date.now(), '0').allowed,
    ).toBe(false);
  });

  it('refunds a claim within the same UTC day only', () => {
    const cap = createAgentDailyCap();
    const now = Date.UTC(2026, 8, 27, 23, 59, 59);

    expect(cap.claim('203.0.113.10', now, '1').allowed).toBe(true);
    cap.refund('203.0.113.10', now);
    cap.refund('203.0.113.10', now);
    expect(cap.claim('203.0.113.10', now, '1').allowed).toBe(true);
    expect(cap.claim('203.0.113.10', now, '1').allowed).toBe(false);
    cap.refund('203.0.113.10', now + 2_000);
    expect(cap.claim('203.0.113.10', now, '1').allowed).toBe(false);
  });

  it('takes the first valid forwarded IP and ignores invalid values', () => {
    expect(
      clientIpFromRequest(
        new Request('http://localhost', {
          headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
        }),
      ),
    ).toBe('203.0.113.10');
    expect(
      clientIpFromRequest(
        new Request('http://localhost', {
          headers: {
            'x-forwarded-for': 'not-an-ip',
            'x-real-ip': '2001:db8::1',
          },
        }),
      ),
    ).toBe('2001:db8::1');
  });
});

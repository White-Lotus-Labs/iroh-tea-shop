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

    const first = cap.claim('203.0.113.10', now, '1');
    expect(first.allowed).toBe(true);
    cap.refund('203.0.113.10', first, now);
    cap.refund('203.0.113.10', first, now);
    const second = cap.claim('203.0.113.10', now, '1');
    expect(second.allowed).toBe(true);
    expect(cap.claim('203.0.113.10', now, '1').allowed).toBe(false);
    cap.refund('203.0.113.10', second, now + 2_000);
    expect(cap.claim('203.0.113.10', now, '1').allowed).toBe(false);
  });

  it('does not refund a claim from before a reset', () => {
    const cap = createAgentDailyCap();
    const now = Date.UTC(2026, 8, 27, 23, 59, 50);
    const late = cap.claim('203.0.113.10', now, '1');
    const tomorrow = now + 20_000;
    expect(cap.claim('203.0.113.10', tomorrow, '1').allowed).toBe(true);
    cap.refund('203.0.113.10', late, tomorrow + 10_000);
    expect(cap.claim('203.0.113.10', tomorrow, '1').allowed).toBe(false);
  });

  it('trusts X-Real-IP, then the last forwarded hop, and ignores invalid values', () => {
    const ip = (headers: Record<string, string>) =>
      clientIpFromRequest(new Request('http://localhost', { headers }));
    // A client can put anything first in X-Forwarded-For; the proxy appends.
    expect(ip({ 'x-forwarded-for': '198.51.100.7, 203.0.113.10' })).toBe(
      '203.0.113.10',
    );
    expect(
      ip({ 'x-forwarded-for': '198.51.100.7', 'x-real-ip': '203.0.113.10' }),
    ).toBe('203.0.113.10');
    expect(
      ip({ 'x-forwarded-for': 'not-an-ip', 'x-real-ip': 'not-an-ip' }),
    ).toBe('unknown-client');
    expect(ip({})).toBe('unknown-client');
  });

  it('counts an IPv6 visitor by /64 and an IPv4-mapped address as IPv4', () => {
    const ip = (value: string) =>
      clientIpFromRequest(
        new Request('http://localhost', { headers: { 'x-real-ip': value } }),
      );
    expect(ip('2001:db8:0:1::1')).toBe('2001:db8:0:1::/64');
    expect(ip('2001:0db8:0000:0001:ffff:ffff:ffff:ffff')).toBe(
      '2001:db8:0:1::/64',
    );
    expect(ip('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(ip('::1')).toBe('0:0:0:0::/64');
    expect(ip('::ffff:203.0.113.10')).toBe('203.0.113.10');
  });
});

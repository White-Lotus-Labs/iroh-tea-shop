import { isIP } from 'node:net';

export const DEFAULT_AGENT_DAILY_LIMIT = 1;
const UNKNOWN_CLIENT = 'unknown-client';

export type AgentCapClaim = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

function configuredLimit(value: string | undefined) {
  if (value === undefined || value.trim() === '')
    return DEFAULT_AGENT_DAILY_LIMIT;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_AGENT_DAILY_LIMIT;
}

function utcDay(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

function nextUtcDay(now: number) {
  const date = new Date(now);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  );
}

/** Process-local guard for the expensive Research Agent endpoint. */
export function createAgentDailyCap() {
  let day = '';
  let limit = -1;
  const usedByClient = new Map<string, number>();

  return {
    claim(
      clientIp: string,
      now: number = Date.now(),
      configured: string | undefined = process.env.NANSEN_AGENT_DAILY_LIMIT,
    ): AgentCapClaim {
      const currentDay = utcDay(now);
      const currentLimit = configuredLimit(configured);
      if (day !== currentDay || limit !== currentLimit) {
        day = currentDay;
        limit = currentLimit;
        usedByClient.clear();
      }

      const resetAt = nextUtcDay(now);
      const used = usedByClient.get(clientIp) ?? 0;
      const allowed = used < limit;
      const nextUsed = allowed ? used + 1 : used;
      if (allowed) usedByClient.set(clientIp, nextUsed);
      return {
        allowed,
        limit,
        remaining: Math.max(0, limit - nextUsed),
        resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    },
    /** Give a claim back when Nansen never answered. Never crosses a reset. */
    refund(clientIp: string, now: number = Date.now()) {
      if (day !== utcDay(now)) return;
      const used = usedByClient.get(clientIp) ?? 0;
      if (used > 1) usedByClient.set(clientIp, used - 1);
      else usedByClient.delete(clientIp);
    },
  };
}

export const agentDailyCap = createAgentDailyCap();

/** Trust the deployment proxy headers; never use an unvalidated value as a key. */
export function clientIpFromRequest(request: Request) {
  const forwarded = request.headers
    .get('x-forwarded-for')
    ?.split(',', 1)[0]
    ?.trim();
  if (forwarded && isIP(forwarded)) return forwarded;

  const realIp = request.headers.get('x-real-ip')?.trim();
  return realIp && isIP(realIp) ? realIp : UNKNOWN_CLIENT;
}

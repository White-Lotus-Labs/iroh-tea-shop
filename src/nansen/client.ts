const BASE = 'https://api.nansen.ai/api/v1';

export class NansenError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfterMs = 0,
  ) {
    super(message);
  }
}

function safeError(status: number, retryAfterMs: number): NansenError {
  if (status === 401)
    return new NansenError('Nansen authentication failed.', 401, retryAfterMs);
  if (status === 402)
    return new NansenError(
      'Nansen API credits are unavailable.',
      402,
      retryAfterMs,
    );
  if (status === 403)
    return new NansenError(
      'Nansen API access is unavailable for this plan.',
      403,
      retryAfterMs,
    );
  if (status === 429)
    return new NansenError(
      'Too many requests. Please try again shortly.',
      429,
      retryAfterMs,
    );
  return new NansenError(
    'Nansen is temporarily unavailable.',
    502,
    retryAfterMs,
  );
}

function retryAfter(response: Response, now: number): number {
  const value = response.headers.get('retry-after');
  if (!value) return 0;
  if (/^\d{1,6}$/.test(value)) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}

export async function nansenPost<T = unknown>(
  path: string,
  body: unknown,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  if (!apiKey.trim())
    throw new NansenError('Nansen API is not configured.', 503);
  let response: Response;
  try {
    response = await fetcher(`${BASE}/${path}`, {
      method: 'POST',
      headers: { apikey: apiKey, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
  } catch {
    throw new NansenError('Nansen is temporarily unavailable.', 502);
  }
  if (!response.ok)
    throw safeError(response.status, retryAfter(response, Date.now()));
  try {
    return (await response.json()) as T;
  } catch {
    throw new NansenError('Nansen returned an invalid response.', 502);
  }
}

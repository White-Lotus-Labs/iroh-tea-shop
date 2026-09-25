import {
  AgentEvent,
  encodeEvent,
  SseDecoder,
  validConversationId,
} from '../../../nansen/sse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENDPOINT = 'https://api.nansen.ai/api/v1/agent/fast';
const MAX_TEXT = 6000;
const TIMEOUT_MS = 90_000;

function jsonError(status: number, error: string, retryAfter?: string | null) {
  const headers = new Headers({ 'cache-control': 'no-store' });
  if (retryAfter && /^(\d{1,6}|[A-Za-z]{3}, .+ GMT)$/.test(retryAfter))
    headers.set('retry-after', retryAfter);
  return Response.json({ error }, { status, headers });
}

function upstreamMessage(status: number) {
  if (status === 401) return 'Nansen authentication failed.';
  if (status === 402) return 'Nansen Research Agent credits are unavailable.';
  if (status === 403)
    return 'Nansen Research Agent access is unavailable for this plan.';
  if (status === 429) return 'Too many requests. Try again shortly.';
  if (status === 400 || status === 422)
    return 'Nansen could not accept this question.';
  return 'Nansen Research Agent is temporarily unavailable.';
}

async function hasCreditError(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return false;
  const decoder = new TextDecoder();
  let sample = '';
  try {
    while (sample.length < 4096) {
      const chunk = await reader.read();
      if (chunk.done) break;
      sample += decoder.decode(chunk.value, { stream: true });
    }
  } catch {
    return false;
  } finally {
    await reader.cancel().catch(() => {});
  }
  return /CREDIT|EXHAUST|INSUFFICIENT_BALANCE/i.test(sample);
}

function streamError(event: AgentEvent): AgentEvent {
  if (event.type !== 'error') return event;
  const status = event.status_code ?? 502;
  const creditError =
    (status === 402 || status === 403) &&
    /CREDIT|EXHAUST|INSUFFICIENT_BALANCE/i.test(event.error);
  return {
    type: 'error',
    error: upstreamMessage(creditError ? 402 : status),
    status_code: status,
  };
}

export async function POST(request: Request) {
  if (Number(request.headers.get('content-length')) > 16_000)
    return jsonError(413, 'Your question is too long.');
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 16_000)
      return jsonError(413, 'Your question is too long.');
    body = JSON.parse(raw);
  } catch {
    return jsonError(400, 'Invalid question.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return jsonError(400, 'Invalid question.');
  const value = body as Record<string, unknown>;
  if (
    Object.keys(value).some(
      (key) => !['text', 'conversation_id'].includes(key),
    ) ||
    typeof value.text !== 'string' ||
    !value.text.trim() ||
    value.text.trim().length > MAX_TEXT ||
    (value.conversation_id !== undefined &&
      !validConversationId(value.conversation_id))
  )
    return jsonError(400, 'Invalid question or conversation.');

  const key = process.env.NANSEN_API_KEY?.trim();
  if (!key) return jsonError(503, 'Nansen Research Agent is not configured.');

  const upstreamController = new AbortController();
  const onAbort = () => upstreamController.abort();
  request.signal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => upstreamController.abort(), TIMEOUT_MS);
  let upstream: Response;
  try {
    upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        apikey: key,
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify({
        text: value.text.trim(),
        ...(value.conversation_id
          ? { conversation_id: value.conversation_id }
          : {}),
      }),
      signal: upstreamController.signal,
      cache: 'no-store',
    });
  } catch {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', onAbort);
    return jsonError(502, 'Nansen Research Agent is temporarily unavailable.');
  }
  if (!upstream.ok) {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', onAbort);
    const creditError =
      (upstream.status === 402 || upstream.status === 403) &&
      (await hasCreditError(upstream));
    return jsonError(
      upstream.status,
      creditError ? upstreamMessage(402) : upstreamMessage(upstream.status),
      upstream.headers.get('retry-after'),
    );
  }
  if (
    !upstream.body ||
    !upstream.headers.get('content-type')?.includes('text/event-stream')
  ) {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', onAbort);
    upstreamController.abort();
    return jsonError(502, 'Nansen Research Agent returned an invalid stream.');
  }

  const reader = upstream.body.getReader();
  const bodyStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const text = new TextDecoder();
      const parser = new SseDecoder();
      let finished = false;
      let done = false;
      let upstreamError = false;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          parser.feed(text.decode(chunk.value, { stream: true }), (parsed) => {
            if (done || upstreamError) return;
            const event = streamError(parsed);
            if (event.type === 'finish') finished = true;
            if (event.type === 'done') done = true;
            if (event.type === 'error') upstreamError = true;
            controller.enqueue(encodeEvent(event));
          });
          if (done || upstreamError) break;
        }
        if (!upstreamError) parser.end();
        if (!finished && !upstreamError && !upstreamController.signal.aborted)
          controller.enqueue(
            encodeEvent({
              type: 'error',
              error: 'The research connection was interrupted. You can retry.',
            }),
          );
      } catch {
        if (!upstreamController.signal.aborted && !upstreamError)
          controller.enqueue(
            encodeEvent({
              type: 'error',
              error: 'The research connection was interrupted. You can retry.',
            }),
          );
      } finally {
        clearTimeout(timer);
        request.signal.removeEventListener('abort', onAbort);
        await reader.cancel().catch(() => {});
        try {
          controller.close();
        } catch {
          /* The browser already cancelled. */
        }
      }
    },
    cancel() {
      upstreamController.abort();
      clearTimeout(timer);
      request.signal.removeEventListener('abort', onAbort);
    },
  });
  return new Response(bodyStream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}

import {
  AgentEvent,
  encodeEvent,
  SseDecoder,
  validConversationId,
} from '../../../nansen/sse';
import {
  ChatNotFoundError,
  prepareResearchRequest,
} from '../../../iroh/history';
import { SESSION_COOKIE } from '../../../auth/cookie';
import {
  agentDailyCap,
  clientIpFromRequest,
  type AgentCapClaim,
} from '../../../nansen/agent-cap';
import {
  MAX_QUESTION_LENGTH,
  MAX_RESEARCH_TEXT_LENGTH,
  QUESTION_TOO_LONG_MESSAGE,
} from '../../../nansen/limits';
import { withUnclePersona } from '../../../nansen/uncle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENDPOINT = 'https://api.nansen.ai/api/v1/agent/fast';
const TIMEOUT_MS = 90_000;

function jsonError(
  status: number,
  error: string,
  retryAfter?: string | null,
  code?: string,
) {
  const headers = new Headers({ 'cache-control': 'no-store' });
  if (retryAfter && /^(\d{1,6}|[A-Za-z]{3}, .+ GMT)$/.test(retryAfter))
    headers.set('retry-after', retryAfter);
  return Response.json(
    { error, ...(code ? { code } : {}) },
    { status, headers },
  );
}

function capError(claim: AgentCapClaim) {
  const response = jsonError(
    429,
    'One cup for today, my friend. If you’d like to keep exploring, Nansen has more research waiting for you.',
    String(claim.retryAfterSeconds),
    'nansen_agent_daily_limit',
  );
  response.headers.set('x-ratelimit-limit', String(claim.limit));
  response.headers.set('x-ratelimit-remaining', String(claim.remaining));
  response.headers.set(
    'x-ratelimit-reset',
    String(Math.ceil(claim.resetAt / 1000)),
  );
  return response;
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
    return jsonError(413, QUESTION_TOO_LONG_MESSAGE);
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 16_000) return jsonError(413, QUESTION_TOO_LONG_MESSAGE);
    body = JSON.parse(raw);
  } catch {
    return jsonError(400, 'Invalid question.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return jsonError(400, 'Invalid question.');
  const value = body as Record<string, unknown>;
  if (
    Object.keys(value).some(
      (key) => !['text', 'question', 'conversation_id', 'chatId'].includes(key),
    ) ||
    typeof value.text !== 'string' ||
    !value.text.trim() ||
    value.text.trim().length > MAX_RESEARCH_TEXT_LENGTH ||
    (value.question !== undefined &&
      (typeof value.question !== 'string' || !value.question.trim())) ||
    (value.conversation_id !== undefined &&
      !validConversationId(value.conversation_id)) ||
    (value.chatId !== undefined &&
      (typeof value.chatId !== 'string' ||
        value.chatId.length > 200 ||
        !value.chatId))
  )
    return jsonError(400, 'Invalid question or conversation.');

  const question = (value.question ?? value.text) as string;
  if (question.trim().length > MAX_QUESTION_LENGTH)
    return jsonError(413, QUESTION_TOO_LONG_MESSAGE);

  const key = process.env.NANSEN_API_KEY?.trim();
  if (!key) return jsonError(503, 'Nansen Research Agent is not configured.');

  let text = value.text.trim();
  let conversationId = value.conversation_id as string | undefined;
  let persisted: { userId: string; chatId: string } | null = null;
  let authenticated:
    | { db: Awaited<typeof import('../../../auth/db')>['db']; userId: string }
    | undefined;
  const hasSessionCookie = request.headers
    .get('cookie')
    ?.split(';')
    .some((part) => part.trim().startsWith(`${SESSION_COOKIE}=`));
  if (value.chatId !== undefined || hasSessionCookie) {
    const [{ db }, { userFromRequest }, { getChat }] = await Promise.all([
      import('../../../auth/db'),
      import('../../../iroh/request-user'),
      import('../../../iroh/history'),
    ]);
    const user = await userFromRequest(db, request);
    if (!user) return jsonError(401, 'Sign in to continue this chat.');
    if (typeof value.chatId !== 'string' || conversationId)
      return jsonError(400, 'Choose a chat before asking Iroh.');
    if (!(await getChat(db, user.id, value.chatId)))
      return jsonError(404, 'Chat not found.');
    authenticated = { db, userId: user.id };
  }

  const cap = agentDailyCap.claim(clientIpFromRequest(request));
  if (!cap.allowed) return capError(cap);

  if (authenticated && typeof value.chatId === 'string') {
    try {
      const prepared = await prepareResearchRequest(
        authenticated.db,
        authenticated.userId,
        value.chatId,
        question.trim(),
      );
      text = prepared.text;
      conversationId = prepared.conversationId ?? undefined;
      persisted = { userId: authenticated.userId, chatId: value.chatId };
    } catch (error) {
      if (error instanceof ChatNotFoundError)
        return jsonError(404, 'Chat not found.');
      throw error;
    }
  }

  const upstreamController = new AbortController();
  const onAbort = () => upstreamController.abort();
  request.signal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => upstreamController.abort(), TIMEOUT_MS);
  const upstreamText = conversationId ? text : withUnclePersona(text);
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
        text: upstreamText,
        ...(conversationId ? { conversation_id: conversationId } : {}),
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
      let answer = '';
      let returnedConversationId: string | null = null;
      const forward = (parsed: AgentEvent) => {
        if (done || upstreamError) return;
        const event = streamError(parsed);
        if (event.type === 'delta') answer += event.text;
        if (event.type === 'finish') {
          finished = true;
          returnedConversationId = event.conversation_id;
        }
        if (event.type === 'done') {
          done = true;
          return;
        }
        if (event.type === 'error') upstreamError = true;
        controller.enqueue(encodeEvent(event));
      };
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          parser.feed(text.decode(chunk.value, { stream: true }), forward);
          if (done || upstreamError) break;
        }
        if (!upstreamError) parser.end(forward);
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
        let saveFailed = false;
        if (persisted) {
          try {
            const { db } = await import('../../../auth/db');
            const { appendAssistantMessage, setConversationId } = await import(
              '../../../iroh/history'
            );
            if (answer.trim())
              await appendAssistantMessage(
                db,
                persisted.userId,
                persisted.chatId,
                answer,
                finished ? 'complete' : 'stopped',
              );
            if (finished)
              await setConversationId(
                db,
                persisted.userId,
                persisted.chatId,
                returnedConversationId,
              );
          } catch {
            saveFailed = true;
          }
        }
        try {
          if (saveFailed && !upstreamError)
            controller.enqueue(
              encodeEvent({
                type: 'error',
                error: 'The answer could not be saved. You can retry.',
              }),
            );
          else if (done && !upstreamError)
            controller.enqueue(encodeEvent({ type: 'done' }));
        } catch {
          /* The browser already cancelled. */
        }
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
      'x-ratelimit-limit': String(cap.limit),
      'x-ratelimit-remaining': String(cap.remaining),
      'x-ratelimit-reset': String(Math.ceil(cap.resetAt / 1000)),
    },
  });
}

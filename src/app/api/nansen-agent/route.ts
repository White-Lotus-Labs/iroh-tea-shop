import {
  AgentEvent,
  encodeEvent,
  SseDecoder,
  validConversationId,
} from '../../../nansen/sse';
import {
  ChatNotFoundError,
  getChat,
  prepareAdmittedResearchRequest,
  rollbackUnstartedResearchRequest,
} from '../../../iroh/history';
import { claimChatTurn } from '../../../iroh/turn-guard';
import { SESSION_COOKIE } from '../../../auth/cookie';
import { withUnclePersona } from '../../../nansen/uncle';
import { parseRetryAfter } from '../../../nansen/client';
import {
  nansenRequestManager,
  NansenManagerError,
} from '../../../nansen/request-manager';

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
      (key) => !['text', 'conversation_id', 'chatId'].includes(key),
    ) ||
    typeof value.text !== 'string' ||
    !value.text.trim() ||
    value.text.trim().length > MAX_TEXT ||
    (value.conversation_id !== undefined &&
      !validConversationId(value.conversation_id)) ||
    (value.chatId !== undefined &&
      (typeof value.chatId !== 'string' ||
        value.chatId.length > 200 ||
        !value.chatId))
  )
    return jsonError(400, 'Invalid question or conversation.');

  const key = process.env.NANSEN_API_KEY?.trim();
  if (!key) return jsonError(503, 'Nansen Research Agent is not configured.');

  let text = value.text.trim();
  let conversationId = value.conversation_id as string | undefined;
  let persisted: { userId: string; chatId: string } | null = null;
  let releaseTurn: (() => void) | null = null;
  let db: typeof import('../../../auth/db').db | null = null;
  const hasSessionCookie = request.headers
    .get('cookie')
    ?.split(';')
    .some((part) => part.trim().startsWith(`${SESSION_COOKIE}=`));
  if (value.chatId !== undefined || hasSessionCookie) {
    const [{ db: database }, { userFromRequest }] = await Promise.all([
      import('../../../auth/db'),
      import('../../../iroh/request-user'),
    ]);
    db = database;
    const user = await userFromRequest(database, request);
    if (!user) return jsonError(401, 'Sign in to continue this chat.');
    if (typeof value.chatId !== 'string' || conversationId)
      return jsonError(400, 'Choose a chat before asking Iroh.');
    if (!(await getChat(database, user.id, value.chatId)))
      return jsonError(404, 'Chat not found.');
    releaseTurn = claimChatTurn(value.chatId);
    if (!releaseTurn)
      return jsonError(409, 'Another question is active in this chat.');
    persisted = { userId: user.id, chatId: value.chatId };
  }

  let lease;
  try {
    lease = await nansenRequestManager.acquireIroh(request.signal);
  } catch (error) {
    releaseTurn?.();
    if (error instanceof NansenManagerError)
      return jsonError(error.status, error.message);
    if (request.signal.aborted) return jsonError(499, 'Question cancelled.');
    throw error;
  }

  if (persisted && db) {
    try {
      if (lease.signal.aborted)
        throw new DOMException('Cancelled', 'AbortError');
      const prepared = await prepareAdmittedResearchRequest(
        db,
        persisted.userId,
        persisted.chatId,
        text,
        lease.signal,
      );
      text = prepared.text;
      conversationId = prepared.conversationId ?? undefined;
      if (lease.signal.aborted) {
        await rollbackUnstartedResearchRequest(
          db,
          persisted.userId,
          persisted.chatId,
          prepared.userMessageId,
          prepared.previousTitle,
        );
        throw new DOMException('Cancelled', 'AbortError');
      }
    } catch (error) {
      lease.release();
      releaseTurn?.();
      if (error instanceof ChatNotFoundError)
        return jsonError(404, 'Chat not found.');
      if (lease.signal.aborted) return jsonError(499, 'Question cancelled.');
      throw error;
    }
  }

  const upstreamController = new AbortController();
  const onAbort = () => upstreamController.abort();
  lease.signal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => upstreamController.abort(), TIMEOUT_MS);
  const upstreamText = conversationId ? text : withUnclePersona(text);
  let upstream: Response;
  try {
    if (lease.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
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
    lease.signal.removeEventListener('abort', onAbort);
    lease.release();
    releaseTurn?.();
    return jsonError(502, 'Nansen Research Agent is temporarily unavailable.');
  }
  if (!upstream.ok) {
    if (upstream.status === 429)
      lease.noteRateLimit(parseRetryAfter(upstream.headers.get('retry-after')));
    const creditError =
      (upstream.status === 402 || upstream.status === 403) &&
      (await hasCreditError(upstream));
    clearTimeout(timer);
    lease.signal.removeEventListener('abort', onAbort);
    lease.release();
    releaseTurn?.();
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
    lease.signal.removeEventListener('abort', onAbort);
    upstreamController.abort();
    lease.release();
    releaseTurn?.();
    return jsonError(502, 'Nansen Research Agent returned an invalid stream.');
  }

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = upstream.body.getReader();
  } catch {
    clearTimeout(timer);
    lease.signal.removeEventListener('abort', onAbort);
    upstreamController.abort();
    lease.release();
    releaseTurn?.();
    return jsonError(502, 'Nansen Research Agent returned an invalid stream.');
  }
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
        if (event.type === 'error' && event.status_code === 429)
          lease.noteRateLimit(1000);
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
        lease.release();
        clearTimeout(timer);
        lease.signal.removeEventListener('abort', onAbort);
        await reader.cancel().catch(() => {});
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
        releaseTurn?.();
        try {
          controller.close();
        } catch {
          /* The browser already cancelled. */
        }
      }
    },
    cancel() {
      upstreamController.abort();
      void reader.cancel().catch(() => {});
      lease.release();
      clearTimeout(timer);
      lease.signal.removeEventListener('abort', onAbort);
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

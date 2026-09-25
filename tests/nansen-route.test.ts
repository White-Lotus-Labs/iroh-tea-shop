import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../src/app/api/nansen-agent/route';

const request = (body: unknown) =>
  new Request('http://localhost/api/nansen-agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NANSEN_API_KEY;
});

describe('Nansen agent route', () => {
  it('requires a configured key without making an upstream call', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const response = await POST(request({ text: 'hello' }));
    expect(response.status).toBe(503);
    expect(await response.text()).toContain('not configured');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('posts only validated text to fast mode with a server-side key and streams deltas', async () => {
    process.env.NANSEN_API_KEY = 'test-only-secret';
    const fetch = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode('data: {"type":"delta","text":"Hel'),
              );
              controller.enqueue(
                new TextEncoder().encode(
                  'lo"}\n\ndata: {"type":"finish","conversation_id":"conv_1"}\n\ndata: [DONE]\n\n',
                ),
              );
              controller.close();
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    );
    vi.stubGlobal('fetch', fetch);
    const response = await POST(request({ text: 'hello' }));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(
      'https://api.nansen.ai/api/v1/agent/fast',
    );
    const init = fetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ text: 'hello' });
    expect(new Headers(init.headers).get('apikey')).toBe('test-only-secret');
    expect(await response.text()).toContain('"text":"Hello"');
    expect(await request({ text: 'x' }).text()).not.toContain(
      'test-only-secret',
    );
  });

  it('includes conversation_id only for follow-ups', async () => {
    process.env.NANSEN_API_KEY = 'test-only-secret';
    const fetch = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(
          'data: {"type":"finish","conversation_id":"conv_2"}\n\ndata: [DONE]\n\n',
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    );
    vi.stubGlobal('fetch', fetch);
    await POST(request({ text: 'follow up', conversation_id: 'conv_1' }));
    expect(
      JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string),
    ).toEqual({ text: 'follow up', conversation_id: 'conv_1' });
  });

  it.each([
    [401, 'authentication failed'],
    [402, 'credits'],
    [403, 'access'],
    [429, 'Too many requests'],
    [504, 'temporarily unavailable'],
  ])('maps upstream HTTP %i to a safe error', async (status, message) => {
    process.env.NANSEN_API_KEY = 'test-only-secret';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('{"error":"secret details"}', {
            status,
            headers: { 'retry-after': '12' },
          }),
      ),
    );
    const response = await POST(request({ text: 'hello' }));
    expect(response.status).toBe(status);
    expect(await response.text()).toContain(message);
    expect(response.headers.get('retry-after')).toBe('12');
  });

  it('rejects empty, overlong, and malformed requests before fetch', async () => {
    process.env.NANSEN_API_KEY = 'test-only-secret';
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    for (const body of [
      { text: '' },
      { text: 'x'.repeat(6001) },
      { text: 'hi', conversation_id: { id: 1 } },
      { text: 'hi', url: 'https://evil.example' },
    ]) {
      expect((await POST(request(body))).status).toBe(400);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves a delta before malformed SSE in the same network chunk', async () => {
    process.env.NANSEN_API_KEY = 'test-only-secret';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            'data: {"type":"delta","text":"Kept"}\n\ndata: {broken}\n\n',
            { headers: { 'content-type': 'text/event-stream' } },
          ),
      ),
    );
    const response = await POST(request({ text: 'hello' }));
    const output = await response.text();
    expect(output).toContain('"text":"Kept"');
    expect(output).toContain('connection was interrupted');
  });

  it('emits a single safe SSE error even if upstream sends sensitive text', async () => {
    process.env.NANSEN_API_KEY = 'test-only-secret';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            'data: {"type":"error","error":"secret details","status_code":402}\n\ndata: [DONE]\n\n',
            { headers: { 'content-type': 'text/event-stream' } },
          ),
      ),
    );
    const response = await POST(request({ text: 'hello' }));
    const output = await response.text();
    expect(output).toContain('credits are unavailable');
    expect(output).not.toContain('secret details');
    expect(output.match(/"type":"error"/g)).toHaveLength(1);
  });

  it('cancels the Nansen request when the browser cancels its stream', async () => {
    process.env.NANSEN_API_KEY = 'test-only-secret';
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        signal = init.signal as AbortSignal;
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  'data: {"type":"delta","text":"Partial"}\n\n',
                ),
              );
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        );
      }),
    );
    const response = await POST(request({ text: 'hello' }));
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();
    expect(signal?.aborted).toBe(true);
  });

  it('recognizes exhausted credits even when Nansen returns 403', async () => {
    process.env.NANSEN_API_KEY = 'test-only-secret';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            '{"error":{"code":"CREDITS_EXHAUSTED","message":"private"}}',
            { status: 403 },
          ),
      ),
    );
    const response = await POST(request({ text: 'hello' }));
    expect(await response.text()).toContain('credits are unavailable');
  });

  it('keeps opaque conversation IDs as JSON rather than constraining Nansen to one ID format', async () => {
    process.env.NANSEN_API_KEY = 'test-only-secret';
    const fetch = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(
          'data: {"type":"finish","conversation_id":"conv/2026.09"}\n\ndata: [DONE]\n\n',
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    );
    vi.stubGlobal('fetch', fetch);
    const response = await POST(
      request({ text: 'follow-up', conversation_id: 'conv/2026.09' }),
    );
    expect(response.status).toBe(200);
    expect(
      JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string),
    ).toEqual({ text: 'follow-up', conversation_id: 'conv/2026.09' });
  });

  it('recognizes a credit error inside a streamed Nansen event', async () => {
    process.env.NANSEN_API_KEY = 'test-only-secret';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            'data: {"type":"error","error":"CREDITS_EXHAUSTED","status_code":403}\n\n',
            { headers: { 'content-type': 'text/event-stream' } },
          ),
      ),
    );
    const response = await POST(request({ text: 'hello' }));
    expect(await response.text()).toContain('credits are unavailable');
  });
});

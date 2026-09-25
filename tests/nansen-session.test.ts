import { describe, expect, it, vi } from 'vitest';
import { IrohSession } from '../src/nansen/session';

function sse(parts: string[]) {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const part of parts)
          controller.enqueue(new TextEncoder().encode(part));
        controller.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

describe('Iroh client session', () => {
  it('streams the first answer and sends a follow-up with the returned conversation ID', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        sse([
          'data: {"type":"delta","text":"First"}\n\ndata: {"type":"finish","conversation_id":"conv_1"}\n\ndata: [DONE]\n\n',
        ]),
      )
      .mockResolvedValueOnce(
        sse([
          'data: {"type":"tool_call","name":"holdings"}\n\ndata: {"type":"delta","text":"Second"}\n\ndata: {"type":"finish","conversation_id":"conv_2"}\n\ndata: [DONE]\n\n',
        ]),
      );
    const session = new IrohSession(fetcher);
    await session.send('What is ETH doing?');
    expect(session.getSnapshot().messages.map((m) => m.content)).toEqual([
      'What is ETH doing?',
      'First',
    ]);
    expect(session.getSnapshot().conversationId).toBe('conv_1');
    await session.send('And HYPE?');
    expect(
      JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string),
    ).toEqual({ text: 'What is ETH doing?' });
    expect(
      JSON.parse((fetcher.mock.calls[1][1] as RequestInit).body as string),
    ).toEqual({ text: 'And HYPE?', conversation_id: 'conv_1' });
    expect(session.getSnapshot().conversationId).toBe('conv_2');
    expect(session.getSnapshot().messages.at(-1)?.content).toBe('Second');
    expect(session.getSnapshot().currentTool).toBe(null);
  });

  it('stops an active stream and preserves partial text', async () => {
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const fetcher = vi.fn(async () => sse([]));
    fetcher.mockImplementationOnce(
      async () =>
        new Response(
          new ReadableStream({
            start(c) {
              controller = c;
              c.enqueue(
                new TextEncoder().encode(
                  'data: {"type":"delta","text":"Partial"}\n\n',
                ),
              );
            },
            cancel() {
              controller.close();
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    );
    const session = new IrohSession(fetcher);
    const pending = session.send('question');
    await vi.waitFor(() =>
      expect(session.getSnapshot().messages.at(-1)?.content).toBe('Partial'),
    );
    session.stop();
    await pending;
    expect(session.getSnapshot().messages.at(-1)?.status).toBe('stopped');
    expect(session.getSnapshot().isStreaming).toBe(false);
  });

  it('reset clears the ID and messages and blocks duplicate send', async () => {
    let resolve!: (value: Response) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    const session = new IrohSession(fetcher);
    const pending = session.send('one');
    expect(session.send('two')).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
    session.reset();
    resolve(
      sse([
        'data: {"type":"finish","conversation_id":"old"}\n\ndata: [DONE]\n\n',
      ]),
    );
    await pending;
    expect(session.getSnapshot().messages).toEqual([]);
    expect(session.getSnapshot().conversationId).toBe(null);
  });

  it('keeps the question and exposes a retryable error for HTTP failures', async () => {
    const session = new IrohSession(async () =>
      Response.json(
        { error: 'Nansen authentication failed.' },
        { status: 401 },
      ),
    );
    await session.send('question');
    expect(session.getSnapshot().error).toContain('authentication failed');
    expect(session.getSnapshot().messages[0].content).toBe('question');
    expect(session.getSnapshot().messages.at(-1)?.status).toBe('error');
  });

  it('shows a safe error for a browser network failure', async () => {
    const session = new IrohSession(async () => {
      throw new Error('internal stack and secret details');
    });
    await session.send('question');
    expect(session.getSnapshot().error).toBe(
      'The research connection was interrupted. You can retry.',
    );
  });

  it('preserves partial answer before a malformed SSE event', async () => {
    const session = new IrohSession(async () =>
      sse(['data: {"type":"delta","text":"Kept"}\n\ndata: {broken}\n\n']),
    );
    await session.send('question');
    expect(session.getSnapshot().messages.at(-1)?.content).toBe('Kept');
    expect(session.getSnapshot().error).toContain('interrupted');
  });
});

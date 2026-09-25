import { SseDecoder } from './sse';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'complete' | 'streaming' | 'stopped' | 'error';
}

export interface ChatSnapshot {
  messages: ChatMessage[];
  conversationId: string | null;
  isStreaming: boolean;
  currentTool: string | null;
  error: string | null;
  lastQuestion: string | null;
}

const initial = (): ChatSnapshot => ({
  messages: [],
  conversationId: null,
  isStreaming: false,
  currentTool: null,
  error: null,
  lastQuestion: null,
});

class ChatError extends Error {}

export class IrohSession {
  private state = initial();
  private listeners = new Set<() => void>();
  private active: AbortController | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private generation = 0;

  constructor(private fetcher: typeof fetch = (...args) => fetch(...args)) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private update(patch: Partial<ChatSnapshot>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private updateMessage(id: string, patch: Partial<ChatMessage>) {
    this.update({
      messages: this.state.messages.map((message) =>
        message.id === id ? { ...message, ...patch } : message,
      ),
    });
  }

  send(question: string): Promise<void> | false {
    const text = question.trim();
    if (this.active || !text || text.length > 6000) return false;
    const owner = ++this.generation;
    const abort = new AbortController();
    this.active = abort;
    const assistantId = crypto.randomUUID();
    this.update({
      messages: [
        ...this.state.messages,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: text,
          status: 'complete',
        },
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          status: 'streaming',
        },
      ],
      isStreaming: true,
      currentTool: null,
      error: null,
      lastQuestion: text,
    });
    return this.run(text, assistantId, owner, abort);
  }

  private async run(
    text: string,
    assistantId: string,
    owner: number,
    abort: AbortController,
  ) {
    const current = () => owner === this.generation && this.active === abort;
    let finished = false;
    try {
      const response = await this.fetcher('/api/nansen-agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text,
          ...(this.state.conversationId
            ? { conversation_id: this.state.conversationId }
            : {}),
        }),
        signal: abort.signal,
      });
      if (!current()) return;
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: unknown;
        };
        throw new ChatError(
          typeof data.error === 'string'
            ? data.error
            : 'Nansen Research Agent is temporarily unavailable.',
        );
      }
      if (!response.body)
        throw new ChatError(
          'The research connection was interrupted. You can retry.',
        );
      const reader = response.body.getReader();
      this.reader = reader;
      const decoder = new TextDecoder();
      const parser = new SseDecoder();
      let done = false;
      const consume = (event: ReturnType<SseDecoder['feed']>[number]) => {
        if (done) return;
        if (event.type === 'delta') {
          const old = this.state.messages.find(
            (message) => message.id === assistantId,
          );
          this.updateMessage(assistantId, {
            content: (old?.content ?? '') + event.text,
          });
        } else if (event.type === 'tool_call') {
          this.update({ currentTool: event.name.slice(0, 80) });
        } else if (event.type === 'finish') {
          finished = true;
          if (event.conversation_id)
            this.update({ conversationId: event.conversation_id });
        } else if (event.type === 'error') {
          throw new ChatError(event.error);
        } else if (event.type === 'done') {
          done = true;
        }
      };
      while (current() && !done) {
        const part = await reader.read();
        if (!current()) return;
        if (part.done) break;
        parser.feed(decoder.decode(part.value, { stream: true }), consume);
      }
      if (!current()) return;
      parser.end(consume);
      if (!finished)
        throw new ChatError(
          'The research connection was interrupted. You can retry.',
        );
      this.updateMessage(assistantId, { status: 'complete' });
      this.update({ currentTool: null, isStreaming: false });
    } catch (error) {
      if (!current()) return;
      const message =
        error instanceof ChatError
          ? error.message
          : 'The research connection was interrupted. You can retry.';
      this.updateMessage(assistantId, { status: 'error' });
      this.update({ error: message, currentTool: null, isStreaming: false });
    } finally {
      if (current()) {
        this.active = null;
        this.reader = null;
      }
    }
  }

  stop() {
    if (!this.active) return;
    this.generation++;
    this.active.abort();
    void this.reader?.cancel().catch(() => {});
    this.active = null;
    this.reader = null;
    const last = this.state.messages.at(-1);
    if (last?.role === 'assistant' && last.status === 'streaming')
      this.updateMessage(last.id, { status: 'stopped' });
    this.update({ isStreaming: false, currentTool: null });
  }

  reset() {
    this.stop();
    this.update(initial());
  }
}

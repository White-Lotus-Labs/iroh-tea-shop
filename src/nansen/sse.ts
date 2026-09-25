export type AgentEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool_call'; name: string }
  | { type: 'finish'; conversation_id: string }
  | { type: 'error'; error: string; status_code?: number }
  | { type: 'done' };

export function validConversationId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 200 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

export class SseDecoder {
  private pending = '';

  feed(chunk: string, onEvent?: (event: AgentEvent) => void): AgentEvent[] {
    this.pending += chunk;
    if (this.pending.length > 1_000_000) throw new Error('SSE frame too large');
    const events: AgentEvent[] = [];
    const emit = (event: AgentEvent) => {
      events.push(event);
      onEvent?.(event);
    };
    let match: RegExpExecArray | null;
    while ((match = /\r?\n\r?\n/.exec(this.pending))) {
      const frame = this.pending.slice(0, match.index);
      this.pending = this.pending.slice(match.index + match[0].length);
      const data = frame
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!data) continue;
      if (data === '[DONE]') {
        emit({ type: 'done' });
        continue;
      }
      let value: unknown;
      try {
        value = JSON.parse(data);
      } catch {
        throw new Error('Malformed SSE payload');
      }
      if (!value || typeof value !== 'object' || !('type' in value))
        throw new Error('Malformed SSE event');
      const event = value as Record<string, unknown>;
      if (event.type === 'delta' && typeof event.text === 'string')
        emit({ type: 'delta', text: event.text });
      else if (event.type === 'tool_call' && typeof event.name === 'string')
        emit({ type: 'tool_call', name: event.name });
      else if (
        event.type === 'finish' &&
        validConversationId(event.conversation_id)
      )
        emit({ type: 'finish', conversation_id: event.conversation_id });
      else if (event.type === 'error' && typeof event.error === 'string')
        emit({
          type: 'error',
          error: event.error,
          status_code:
            typeof event.status_code === 'number'
              ? event.status_code
              : undefined,
        });
      else throw new Error('Malformed SSE event');
    }
    return events;
  }

  end() {
    if (this.pending.trim()) throw new Error('Incomplete SSE frame');
  }
}

export function encodeEvent(event: AgentEvent): Uint8Array {
  return new TextEncoder().encode(
    `data: ${event.type === 'done' ? '[DONE]' : JSON.stringify(event)}\n\n`,
  );
}

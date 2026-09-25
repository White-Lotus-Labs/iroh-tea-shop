'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { IrohSession } from '../nansen/session';
import { IrohMessage } from './IrohMessage';

export function IrohChat({
  session,
  onClose,
}: {
  session: IrohSession;
  onClose: () => void;
}) {
  const chat = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [chat.messages.at(-1)?.content, chat.error]);
  const send = () => {
    if (session.send(draft)) setDraft('');
  };
  const reset = () => {
    session.reset();
    setDraft('');
    input.current?.focus();
  };
  return (
    <div className="iroh-chat">
      <header className="iroh-chat-head">
        <div>
          <div className="eyebrow">03 / THE HOST · RESEARCH</div>
          <h1>Ask Iroh</h1>
          <p>Powered by Nansen Research Agent · Fast mode</p>
        </div>
        <div className="iroh-chat-actions">
          <button type="button" onClick={reset} aria-label="New conversation">
            New conversation
          </button>
          <button type="button" onClick={onClose} aria-label="Close Iroh chat">
            Close
          </button>
        </div>
      </header>
      <div
        className="iroh-transcript"
        role="log"
        aria-label="Iroh conversation"
        aria-live="polite"
      >
        {chat.messages.length === 0 && (
          <div className="iroh-greeting">
            <span className="iroh-seal" aria-hidden="true">
              茶
            </span>
            <p className="iroh-greeting-title">
              Let us look at what the evidence shows.
            </p>
            <p>
              Ask a question about on-chain activity. I’ll consult Nansen
              Research Agent and bring its answer here.
            </p>
          </div>
        )}
        {chat.messages.map((message) => (
          <article
            className={`iroh-message is-${message.role}`}
            key={message.id}
          >
            <div className="iroh-speaker">
              {message.role === 'user' ? 'You' : 'Iroh'}
            </div>
            {message.content ? (
              <IrohMessage content={message.content} />
            ) : message.status === 'streaming' ? (
              <p className="iroh-waiting">Waiting for Nansen…</p>
            ) : null}
            {message.status === 'stopped' && (
              <small>Stopped · partial answer</small>
            )}
          </article>
        ))}
        {chat.isStreaming && (
          <p className="iroh-activity" role="status">
            {chat.currentTool
              ? `Researching with Nansen: ${chat.currentTool}`
              : 'Iroh is consulting Nansen…'}
          </p>
        )}
        {chat.error && (
          <div className="iroh-error" role="alert">
            <p>{chat.error}</p>
            <button
              type="button"
              onClick={() =>
                chat.lastQuestion && session.send(chat.lastQuestion)
              }
            >
              Retry question
            </button>
          </div>
        )}
        <div ref={bottom} />
      </div>
      <form
        className="iroh-compose"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <label htmlFor="iroh-question" className="sr-only">
          Ask Iroh a research question
        </label>
        <textarea
          id="iroh-question"
          ref={input}
          value={draft}
          maxLength={6000}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              send();
            }
          }}
          placeholder="Ask what the on-chain evidence shows…"
          rows={2}
          disabled={chat.isStreaming}
        />
        <div className="iroh-compose-bottom">
          <span>Enter to send · Shift+Enter for a new line</span>
          {chat.isStreaming ? (
            <button
              type="button"
              className="primary"
              onClick={() => session.stop()}
              aria-label="Stop generation"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              className="primary"
              disabled={!draft.trim()}
              aria-label="Send question"
            >
              Send <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

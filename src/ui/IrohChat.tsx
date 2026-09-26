'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { IrohSession, type ChatMessage } from '../nansen/session';
import type { PublicUser } from '../auth/service';
import { IrohMessage } from './IrohMessage';

type ChatSummary = { id: string; title: string; updatedAt: string };
type SavedMessage = Pick<ChatMessage, 'role' | 'content' | 'status'> & {
  id: number;
};

export function IrohChat({
  session,
  user,
}: {
  session: IrohSession;
  user: PublicUser | null;
}) {
  const chat = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const [draft, setDraft] = useState('');
  const [history, setHistory] = useState<ChatSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(Boolean(user));
  const loadGeneration = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const refreshHistory = async () => {
    if (!user) return;
    const response = await fetch('/api/iroh/chats', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load your chats.');
    const data = (await response.json()) as { chats: ChatSummary[] };
    setHistory(data.chats);
  };

  const openChat = async (chatId: string) => {
    const generation = ++loadGeneration.current;
    session.stop();
    setHistoryError(null);
    const response = await fetch(
      `/api/iroh/chats/${encodeURIComponent(chatId)}`,
      { cache: 'no-store' },
    );
    if (!response.ok) throw new Error('Could not open this chat.');
    const data = (await response.json()) as {
      chat: {
        id: string;
        nansenConversationId: string | null;
        messages: SavedMessage[];
      };
    };
    if (generation !== loadGeneration.current) return;
    session.restore(
      data.chat.id,
      data.chat.messages.map((message) => ({
        id: String(message.id),
        role: message.role,
        content: message.content,
        status: message.status,
      })),
      data.chat.nansenConversationId,
    );
    setSelectedId(chatId);
    setDraft('');
    input.current?.focus();
  };

  const newChat = async () => {
    if (!user) {
      session.reset();
      setDraft('');
      input.current?.focus();
      return;
    }
    ++loadGeneration.current;
    session.stop();
    setHistoryError(null);
    try {
      const response = await fetch('/api/iroh/chats', { method: 'POST' });
      if (!response.ok) throw new Error('Could not create a chat.');
      const data = (await response.json()) as { chat: ChatSummary };
      session.restore(data.chat.id, [], null);
      setSelectedId(data.chat.id);
      setHistory((current) => [data.chat, ...current]);
      setDraft('');
      input.current?.focus();
    } catch (error) {
      setHistoryOpen(true);
      setHistoryError(
        error instanceof Error ? error.message : 'Could not create a chat.',
      );
    }
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const initialize = async () => {
      try {
        const response = await fetch('/api/iroh/chats', { cache: 'no-store' });
        if (!response.ok) throw new Error('Could not load your chats.');
        const data = (await response.json()) as { chats: ChatSummary[] };
        if (cancelled) return;
        setHistory(data.chats);
        const current = session.getSnapshot().chatId;
        const target =
          current && data.chats.some((chat) => chat.id === current)
            ? current
            : data.chats[0]?.id;
        if (target) {
          setSelectedId(target);
          if (current !== target) await openChat(target);
        } else {
          const created = await fetch('/api/iroh/chats', { method: 'POST' });
          if (!created.ok) throw new Error('Could not create a chat.');
          const result = (await created.json()) as { chat: ChatSummary };
          if (cancelled) return;
          session.restore(result.chat.id, [], null);
          setSelectedId(result.chat.id);
          setHistory([result.chat]);
        }
      } catch (error) {
        if (!cancelled) {
          setHistoryOpen(true);
          setHistoryError(
            error instanceof Error
              ? error.message
              : 'Could not load your chats.',
          );
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };
    void initialize();
    return () => {
      cancelled = true;
      ++loadGeneration.current;
    };
  }, [session, user?.id]);

  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [chat.messages.at(-1)?.content, chat.error]);
  const send = () => {
    const pending = session.send(draft);
    if (pending) {
      setDraft('');
      void pending.then(() => refreshHistory().catch(() => {}));
    }
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
          {user && (
            <button
              type="button"
              aria-controls="iroh-history"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen((open) => !open)}
            >
              {historyOpen ? 'Hide history' : 'Chat history'}
            </button>
          )}
          <button
            type="button"
            onClick={() => void newChat()}
            disabled={historyLoading}
            aria-label={user ? 'Start new chat' : 'New conversation'}
          >
            {user ? 'New Chat' : 'New conversation'}
          </button>
        </div>
      </header>
      <div
        className={`iroh-chat-body${historyOpen && user ? ' has-history' : ''}`}
      >
        {user && (
          <aside
            id="iroh-history"
            className="iroh-history"
            aria-label="Chat history"
            hidden={!historyOpen}
          >
            <div className="iroh-history-label">YOUR CHATS</div>
            {historyLoading && <p>Loading chats…</p>}
            {historyError && <p role="alert">{historyError}</p>}
            {history.map((item) => (
              <button
                type="button"
                key={item.id}
                className={item.id === selectedId ? 'is-selected' : ''}
                aria-current={item.id === selectedId ? 'page' : undefined}
                onClick={() =>
                  void openChat(item.id).catch((error) =>
                    setHistoryError(error.message),
                  )
                }
              >
                {item.title}
              </button>
            ))}
          </aside>
        )}
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
          disabled={
            chat.isStreaming ||
            historyLoading ||
            (Boolean(user) && !chat.chatId)
          }
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
              disabled={
                !draft.trim() ||
                historyLoading ||
                (Boolean(user) && !chat.chatId)
              }
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

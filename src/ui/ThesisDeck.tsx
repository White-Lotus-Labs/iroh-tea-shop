'use client';
import { Cormorant_Garamond } from 'next/font/google';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { flushSync } from 'react-dom';
import { formatMoney } from '../leaderboard/model';
import type { NansenAvailability } from '../nansen/availability';
import { THESES } from '../thesis/deck';
import type {
  ConvictionLevel,
  DeckSnapshot,
  Thesis,
  ThesisId,
  ThesisSummary,
} from '../thesis/types';
import {
  LEVEL_GLYPH,
  LEVEL_LABEL,
  accumulatingLine,
  formatRelative,
  readFollowed,
  toggleFollowed,
  type DeckState,
} from './deckModel';
import { ThesisScroll } from './ThesisScroll';
import './styles/deck.css';

export interface ThesisDeckProps {
  nansen: NansenAvailability;
  reduced: boolean;
  initialThesis: ThesisId | null;
  onOpenThesis: (id: ThesisId, conviction: ConvictionLevel | null) => void;
  onCloseThesis: () => void;
  onTalkToUncle: (draft: string) => void;
}

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

const MORPH_NAME = 'thesis-art';
const OWN_THESIS_DRAFT =
  'Here is my own thesis. Help me test it against smart money data:\n\n';

// The ?thesis= deep link opens its scroll once per page load, not on every
// panel reopen.
let deepLinkConsumed = false;

function withViewTransition(
  reduced: boolean,
  update: () => void,
  done?: () => void,
) {
  if (reduced || typeof document.startViewTransition !== 'function') {
    update();
    done?.();
    return;
  }
  const root = document.documentElement;
  root.classList.add('thesis-vt');
  const transition = document.startViewTransition(() => flushSync(update));
  void transition.finished.finally(() => {
    root.classList.remove('thesis-vt');
    done?.();
  });
}

function summaryFor(deck: DeckState, id: ThesisId): ThesisSummary | null {
  return deck.status === 'ready'
    ? (deck.snapshot.theses.find((t) => t.id === id) ?? null)
    : null;
}

export function ThesisDeck({
  nansen,
  reduced,
  initialThesis,
  onOpenThesis,
  onCloseThesis,
  onTalkToUncle,
}: ThesisDeckProps) {
  const [deck, setDeck] = useState<DeckState>({ status: 'loading' });
  const [openId, setOpenId] = useState<ThesisId | null>(null);
  const [followed, setFollowed] = useState<ThesisId[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const books = useRef<Partial<Record<ThesisId, HTMLButtonElement | null>>>({});
  const covers = useRef<Partial<Record<ThesisId, HTMLElement | null>>>({});
  const openRef = useRef<ThesisId | null>(null);
  openRef.current = openId;

  useEffect(() => {
    if (nansen === 'unavailable') {
      setDeck({ status: 'offline', reason: 'Nansen is not configured.' });
      return;
    }
    const controller = new AbortController();
    setDeck({ status: 'loading' });
    fetch('/api/theses', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (response.ok) {
          const snapshot = (await response.json()) as DeckSnapshot;
          setDeck({ status: 'ready', snapshot });
          return;
        }
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setDeck({
          status: 'offline',
          reason:
            response.status === 503
              ? 'Nansen is not configured.'
              : (body?.error ?? 'Nansen is unavailable right now.'),
        });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setDeck({
            status: 'offline',
            reason: 'Nansen is unavailable right now.',
          });
      });
    return () => controller.abort();
  }, [nansen]);

  useEffect(() => {
    setFollowed(readFollowed(window.localStorage));
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(
    () => () => {
      if (openRef.current) onCloseThesis();
    },
    [onCloseThesis],
  );

  const open = useCallback(
    (id: ThesisId) => {
      if (openRef.current) return;
      const cover = covers.current[id];
      if (cover && !reduced) cover.style.viewTransitionName = MORPH_NAME;
      withViewTransition(reduced, () => {
        if (cover) cover.style.viewTransitionName = '';
        setOpenId(id);
      });
      onOpenThesis(id, summaryFor(deck, id)?.conviction.level ?? null);
    },
    [deck, onOpenThesis, reduced],
  );

  const close = useCallback(() => {
    const id = openRef.current;
    if (!id) return;
    const cover = covers.current[id];
    withViewTransition(
      reduced,
      () => {
        setOpenId(null);
        if (cover && !reduced) cover.style.viewTransitionName = MORPH_NAME;
        books.current[id]?.focus({ preventScroll: true });
      },
      () => {
        if (cover) cover.style.viewTransitionName = '';
      },
    );
    onCloseThesis();
  }, [onCloseThesis, reduced]);

  useEffect(() => {
    if (deepLinkConsumed || !initialThesis || deck.status === 'loading') return;
    deepLinkConsumed = true;
    open(initialThesis);
  }, [deck.status, initialThesis, open]);

  const onToggleFollow = useCallback((id: ThesisId) => {
    setFollowed(toggleFollowed(window.localStorage, id));
  }, []);

  const openThesis = THESES.find((t) => t.id === openId) ?? null;

  return (
    <div
      className={`thesis-deck ${display.variable}`}
      data-reduced={reduced ? 'true' : 'false'}
    >
      <header className="deck-head">
        <h1 className="deck-title">
          Thesis Desk
          <span className="deck-kicker">three scrolls</span>
        </h1>
        <DeckStatus deck={deck} now={now} />
      </header>

      <div className="deck-stage">
        <p className="deck-word" aria-hidden="true">
          Theses
        </p>
        <ul className="deck-books" aria-label="Thesis scrolls">
          {THESES.map((thesis, index) => (
            <li key={thesis.id} className="deck-slot" data-slot={index}>
              <ThesisBook
                thesis={thesis}
                deck={deck}
                summary={summaryFor(deck, thesis.id)}
                followed={followed.includes(thesis.id)}
                reduced={reduced}
                hidden={openId === thesis.id}
                buttonRef={(node) => {
                  books.current[thesis.id] = node;
                }}
                coverRef={(node) => {
                  covers.current[thesis.id] = node;
                }}
                onOpen={() => open(thesis.id)}
              />
            </li>
          ))}
        </ul>
      </div>

      <footer className="deck-foot">
        <p className="deck-hint">
          Pick a scroll to read the thesis and the smart money behind it.
        </p>
        <button
          type="button"
          className="deck-discuss"
          onClick={() => onTalkToUncle(OWN_THESIS_DRAFT)}
        >
          <span className="deck-discuss-seal" aria-hidden="true">
            茶
          </span>
          Discuss your own thesis with Uncle
        </button>
      </footer>

      {openThesis && (
        <ThesisScroll
          thesis={openThesis}
          summary={summaryFor(deck, openThesis.id)}
          deck={deck}
          reduced={reduced}
          now={now}
          followed={followed.includes(openThesis.id)}
          fontClass={display.variable}
          morphName={reduced ? undefined : MORPH_NAME}
          onToggleFollow={() => onToggleFollow(openThesis.id)}
          onClose={close}
          onTalkToUncle={onTalkToUncle}
        />
      )}
    </div>
  );
}

function DeckStatus({ deck, now }: { deck: DeckState; now: number }) {
  if (deck.status === 'loading')
    return (
      <p className="deck-status" data-state="loading" role="status">
        <span className="deck-status-dot" aria-hidden="true" />
        Reading Nansen…
      </p>
    );
  if (deck.status === 'offline')
    return (
      <p className="deck-status" data-state="offline" role="status">
        <span className="deck-status-dot" aria-hidden="true" />
        Offline · {deck.reason}
      </p>
    );
  return (
    <p className="deck-status" data-state="live">
      <span className="deck-status-dot" aria-hidden="true" />
      Live · Nansen · updated {formatRelative(deck.snapshot.fetchedAt, now)}
      {deck.snapshot.stale && <span className="deck-stale">Stale</span>}
    </p>
  );
}

function sealWords(
  thesis: Thesis,
  deck: DeckState,
  summary: ThesisSummary | null,
): string {
  if (deck.status === 'loading') return 'Conviction loading.';
  if (!summary) return 'Conviction offline.';
  const { conviction } = summary;
  return `Conviction ${LEVEL_LABEL[conviction.level]}, ${accumulatingLine(conviction, thesis.tickers.length)}, net 7-day smart money flow ${formatMoney(conviction.netFlowUsd, true)}.`;
}

function ThesisBook({
  thesis,
  deck,
  summary,
  followed,
  reduced,
  hidden,
  buttonRef,
  coverRef,
  onOpen,
}: {
  thesis: Thesis;
  deck: DeckState;
  summary: ThesisSummary | null;
  followed: boolean;
  reduced: boolean;
  hidden: boolean;
  buttonRef: (node: HTMLButtonElement | null) => void;
  coverRef: (node: HTMLElement | null) => void;
  onOpen: () => void;
}) {
  const frame = useRef(0);
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (reduced || event.pointerType === 'touch') return;
    const el = event.currentTarget;
    const { clientX, clientY } = event;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const box = el.getBoundingClientRect();
      const px = Math.min(
        0.5,
        Math.max(-0.5, (clientX - box.left) / box.width - 0.5),
      );
      const py = Math.min(
        0.5,
        Math.max(-0.5, (clientY - box.top) / box.height - 0.5),
      );
      el.style.setProperty('--px', px.toFixed(3));
      el.style.setProperty('--py', py.toFixed(3));
    });
  };
  const onPointerLeave = (event: PointerEvent<HTMLButtonElement>) => {
    cancelAnimationFrame(frame.current);
    event.currentTarget.style.removeProperty('--px');
    event.currentTarget.style.removeProperty('--py');
  };
  const style = {
    '--book': thesis.colors.primary,
    '--book-accent': thesis.colors.accent,
    '--book-ink': thesis.colors.ink,
    '--chars': thesis.title.length,
  } as CSSProperties;
  const level = summary?.conviction.level ?? null;

  return (
    <button
      ref={buttonRef}
      type="button"
      className="deck-book"
      data-thesis={thesis.id}
      data-open={hidden ? 'true' : undefined}
      style={style}
      aria-label={`Open ${thesis.title}. Scroll ${thesis.numeral}: ${thesis.subtitle}. ${sealWords(thesis, deck, summary)}${followed ? ' Following.' : ''}`}
      onClick={onOpen}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <span className="book-frame" aria-hidden="true">
        <span className="book-contact" />
        <span className="book-pose">
          <span className="book-tilt">
            <span className="book-shadow" />
            <span className="book-back" />
            <span className="book-pages" />
            <span className="book-top" />
            <span className="book-spine">
              <span className="book-spine-band" />
              <span className="book-spine-title">{thesis.title}</span>
              <span className="book-spine-numeral">{thesis.numeral}</span>
              <span className="book-spine-band" />
            </span>
            <span className="book-cover" ref={coverRef}>
              <img
                className="book-art"
                src={thesis.image}
                alt=""
                width={900}
                height={1200}
                draggable={false}
              />
              <span className="book-copy">
                <span className="book-kicker">Scroll · {thesis.numeral}</span>
                <span className="book-name">{thesis.title}</span>
                <span className="book-sub">{thesis.subtitle}</span>
              </span>
              <span className="book-hinge" />
              <span className="book-sheen" />
              {followed && (
                <span className="book-stamp" title="Following">
                  追
                </span>
              )}
            </span>
          </span>
        </span>
      </span>
      <span className="book-plaque" aria-hidden="true">
        {deck.status === 'loading' ? (
          <>
            <span className="plaque-seal" data-level="loading" />
            <span className="plaque-text">
              <span className="plaque-shimmer" />
              <span className="plaque-shimmer plaque-shimmer--short" />
            </span>
          </>
        ) : summary && level ? (
          <>
            <span className="plaque-seal" data-level={level}>
              {LEVEL_GLYPH[level]}
            </span>
            <span className="plaque-text">
              <span className="plaque-level">{LEVEL_LABEL[level]}</span>
              <span className="plaque-meta">
                {accumulatingLine(summary.conviction, thesis.tickers.length)}
              </span>
              <span className="plaque-flow">
                {formatMoney(summary.conviction.netFlowUsd, true)} net · 7d
              </span>
            </span>
          </>
        ) : (
          <>
            <span className="plaque-seal" data-level="offline">
              —
            </span>
            <span className="plaque-text">
              <span className="plaque-level">Offline</span>
              <span className="plaque-meta">Seal returns with Nansen</span>
            </span>
          </>
        )}
      </span>
    </button>
  );
}

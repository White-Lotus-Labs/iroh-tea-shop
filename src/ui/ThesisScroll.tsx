'use client';
import dynamic from 'next/dynamic';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { formatMoney } from '../leaderboard/model';
import type { Thesis, ThesisSummary } from '../thesis/types';
import {
  LEVEL_GLYPH,
  LEVEL_LABEL,
  buildUncleDraft,
  convictionSentence,
  formatRelative,
  shareText,
  thesisLink,
  xIntentUrl,
  type DeckState,
} from './deckModel';
import { ThesisLeaf } from './ThesisLeaf';

const CrossBeam = dynamic(
  () => import('../shaders/cross-beam/ConfigurableCrossBeamBackground.jsx'),
  { ssr: false },
);

export interface ThesisScrollProps {
  thesis: Thesis;
  summary: ThesisSummary | null;
  deck: DeckState;
  reduced: boolean;
  now: number;
  followed: boolean;
  fontClass: string;
  morphName: string | undefined;
  onToggleFollow: () => void;
  onClose: () => void;
  onTalkToUncle: (draft: string) => void;
}

const FOCUSABLE =
  'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

function LeafIcon() {
  return (
    <svg viewBox="0 0 24 32" aria-hidden="true">
      <path d="M12 1C5 8 2.5 14 2.5 19.5 2.5 25.3 6.8 30 12 30s9.5-4.7 9.5-10.5C21.5 14 19 8 12 1Z" />
      <path className="vein" d="M12 6v24M12 14l-4-3M12 19l5-4M12 24l-5-4" />
    </svg>
  );
}

function Meter({
  thesis,
  summary,
  deck,
}: {
  thesis: Thesis;
  summary: ThesisSummary | null;
  deck: DeckState;
}) {
  if (deck.status === 'loading')
    return (
      <div className="scroll-meter ink" style={{ '--i': 4 } as CSSProperties}>
        <span className="meter-seal" data-level="loading" aria-hidden="true" />
        <div className="meter-copy" role="status">
          <span className="plaque-shimmer" />
          <span className="plaque-shimmer plaque-shimmer--short" />
          <span className="sr-only">Reading conviction from Nansen…</span>
        </div>
      </div>
    );
  if (!summary)
    return (
      <div className="scroll-meter ink" style={{ '--i': 4 } as CSSProperties}>
        <span className="meter-seal" data-level="offline" aria-hidden="true">
          —
        </span>
        <div className="meter-copy">
          <p className="meter-level">Conviction offline</p>
          <p className="meter-line">
            {deck.status === 'offline' ? deck.reason : 'No reading yet.'} The
            thesis still reads; the live seal returns when Nansen answers.
          </p>
        </div>
      </div>
    );
  const { conviction } = summary;
  return (
    <div
      className="scroll-meter ink"
      data-level={conviction.level}
      style={{ '--i': 4 } as CSSProperties}
    >
      <span
        className="meter-seal"
        data-level={conviction.level}
        aria-hidden="true"
      >
        {LEVEL_GLYPH[conviction.level]}
      </span>
      <div className="meter-copy">
        <p className="meter-level">
          {LEVEL_LABEL[conviction.level]} conviction
          <span className="meter-flow">
            {formatMoney(conviction.netFlowUsd, true)} net · 7 days
          </span>
        </p>
        <ol className="meter-leaves" aria-label="Accumulation by leaf">
          {thesis.tickers.map((ticker) => {
            const signal = summary.tickers.find(
              (s) => s.symbol === ticker.symbol,
            );
            const flow =
              signal?.status === 'ok' ? signal.smartMoneyNetFlowUsd : null;
            const state = flow === null ? 'none' : flow > 0 ? 'up' : 'down';
            return (
              <li
                key={ticker.symbol}
                data-state={state}
                aria-label={`${ticker.symbol}: ${state === 'up' ? 'accumulating' : state === 'down' ? 'distributing' : 'no data'}`}
              >
                <LeafIcon />
                <span>{ticker.symbol}</span>
              </li>
            );
          })}
        </ol>
        <p className="meter-line">
          {convictionSentence(conviction, thesis.tickers.length)}.
        </p>
      </div>
    </div>
  );
}

export function ThesisScroll({
  thesis,
  summary,
  deck,
  reduced,
  now,
  followed,
  fontClass,
  morphName,
  onToggleFollow,
  onClose,
  onTalkToUncle,
}: ThesisScrollProps) {
  const titleId = useId();
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [origin, setOrigin] = useState('');
  const [canShare, setCanShare] = useState(false);
  const [toast, setToast] = useState('');
  const [stampKey, setStampKey] = useState(0);

  useEffect(() => {
    setHost(document.body);
    setOrigin(window.location.origin);
    setCanShare(typeof navigator.share === 'function');
  }, []);

  useEffect(() => {
    if (host) closeButton.current?.focus({ preventScroll: true });
  }, [host]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Capture phase: keep the shell from closing the whole Counter panel.
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const trapTab = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab' || !dialog.current) return;
    const items = [
      ...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    ].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const link = origin ? thesisLink(origin, thesis.id) : '';
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setToast('Link copied.');
    } catch {
      setToast('Copy failed. The link is in the address bar.');
    }
  };
  const nativeShare = async () => {
    try {
      await navigator.share({
        title: thesis.title,
        text: shareText(thesis, summary),
        url: link,
      });
    } catch {
      /* The person closed the share sheet. */
    }
  };
  const follow = () => {
    onToggleFollow();
    if (!followed) setStampKey((k) => k + 1);
    setToast(followed ? 'No longer following.' : 'Following this thesis.');
  };

  const offline = deck.status === 'offline';
  const style = {
    '--book': thesis.colors.primary,
    '--book-accent': thesis.colors.accent,
    '--book-ink': thesis.colors.ink,
    '--hue': thesis.hue,
  } as CSSProperties;

  if (!host) return null;
  return createPortal(
    <div
      className={`scroll-layer ${fontClass}`}
      data-reduced={reduced ? 'true' : 'false'}
      style={style}
    >
      <div className="scroll-veil" aria-hidden="true" onClick={onClose} />
      {!reduced && (
        <div className="scroll-glow" aria-hidden="true">
          <CrossBeam variant="ring" hue={0} speed={0.6} />
          <span className="scroll-glow-tint" />
        </div>
      )}
      <section
        ref={dialog}
        className="thesis-scroll"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapTab}
      >
        <div className="scroll-rod scroll-rod--top" aria-hidden="true">
          <i />
        </div>
        <div className="scroll-sheet">
          <button
            ref={closeButton}
            type="button"
            className="scroll-close"
            aria-label="Close scroll"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
          <div className="scroll-paper">
            <div className="scroll-grid">
              <figure
                className="scroll-art"
                style={{ viewTransitionName: morphName }}
              >
                <img
                  src={thesis.image}
                  alt={`${thesis.spirit}, the spirit of this thesis`}
                  width={900}
                  height={1200}
                />
                {followed && (
                  <span
                    key={stampKey}
                    className="scroll-stamp"
                    aria-hidden="true"
                  >
                    追
                  </span>
                )}
                <figcaption
                  className="ink"
                  style={{ '--i': 1 } as CSSProperties}
                >
                  {thesis.spirit}
                </figcaption>
              </figure>

              <div className="scroll-text">
                <p
                  className="scroll-kicker ink"
                  style={{ '--i': 0 } as CSSProperties}
                >
                  Scroll · {thesis.numeral} · Thesis
                </p>
                <h2
                  id={titleId}
                  className="scroll-title ink"
                  style={{ '--i': 1 } as CSSProperties}
                >
                  {thesis.title}
                </h2>
                <p
                  className="scroll-sub ink"
                  style={{ '--i': 2 } as CSSProperties}
                >
                  {thesis.subtitle}
                </p>
                <p
                  className="scroll-body ink"
                  style={{ '--i': 3 } as CSSProperties}
                >
                  {thesis.body}
                </p>

                <Meter thesis={thesis} summary={summary} deck={deck} />

                <p
                  className="scroll-live ink"
                  style={{ '--i': 5 } as CSSProperties}
                >
                  {deck.status === 'ready' ? (
                    <>
                      <span className="leaf-live-dot" aria-hidden="true" />
                      Live · Nansen · updated{' '}
                      {formatRelative(deck.snapshot.fetchedAt, now)}
                      {deck.snapshot.stale && (
                        <span className="deck-stale">Stale</span>
                      )}
                    </>
                  ) : deck.status === 'loading' ? (
                    'Reading Nansen…'
                  ) : (
                    `Offline · ${deck.reason}`
                  )}
                </p>
              </div>

              <section
                className="scroll-leaves ink"
                aria-labelledby={`${titleId}-leaves`}
                style={{ '--i': 6 } as CSSProperties}
              >
                <h3 id={`${titleId}-leaves`} className="scroll-section-title">
                  Four leaves in the pot
                </h3>
                <ul className="leaf-list-root">
                  {thesis.tickers.map((ticker) => (
                    <ThesisLeaf
                      key={ticker.symbol}
                      thesisId={thesis.id}
                      ticker={ticker}
                      signal={summary?.tickers.find(
                        (s) => s.symbol === ticker.symbol,
                      )}
                      offline={offline}
                      now={now}
                    />
                  ))}
                </ul>
              </section>

              <div
                className="scroll-actions ink"
                role="group"
                aria-label="Thesis actions"
                style={{ '--i': 7 } as CSSProperties}
              >
                <button
                  type="button"
                  className="scroll-action scroll-action--primary"
                  onClick={() =>
                    onTalkToUncle(buildUncleDraft(thesis, summary))
                  }
                >
                  Talk to Uncle
                </button>
                <a
                  className="scroll-action"
                  href={
                    origin ? xIntentUrl(thesis, summary, origin) : undefined
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Share the thesis on X
                </a>
                <button
                  type="button"
                  className="scroll-action"
                  onClick={copyLink}
                >
                  Copy link
                </button>
                {canShare && (
                  <button
                    type="button"
                    className="scroll-action"
                    onClick={nativeShare}
                  >
                    Share…
                  </button>
                )}
                <button
                  type="button"
                  className="scroll-action scroll-action--seal"
                  aria-pressed={followed}
                  onClick={follow}
                >
                  <span className="scroll-action-seal" aria-hidden="true">
                    追
                  </span>
                  {followed ? 'Following the thesis' : 'Follow the thesis'}
                </button>
              </div>
              <p className="scroll-toast" role="status" aria-live="polite">
                {toast}
              </p>
            </div>
          </div>
        </div>
        <div className="scroll-rod scroll-rod--bottom" aria-hidden="true">
          <i />
        </div>
      </section>
    </div>,
    host,
  );
}

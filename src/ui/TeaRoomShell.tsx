'use client';
import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type {
  InterrogationResult,
  MotionPreference,
  ReviewAdapter,
  ReviewCard,
  Station,
} from '../shared/contracts';
import type { SceneMood } from '../scene/motion/dynamics';
import { STATIONS } from '../scene/stations';
import { MockReviewAdapter } from '../review/mock-adapter';
import { ReviewSession } from '../review/session';
import { SAMPLE_THESIS } from '../fixtures/eth-demo';
import { ThesisPanel } from './ThesisPanel';
import { ResultScroll } from './ResultScroll';
import { ShareCard } from './ShareCard';
import { EvidenceDrawer } from './EvidenceDrawer';
const TeaRoom = dynamic(() => import('../scene/TeaRoom'), {
  ssr: false,
  loading: () => (
    <div className="scene-fallback">
      <p>Lighting the room…</p>
    </div>
  ),
});
const defaultAdapter = new MockReviewAdapter();
export default function TeaRoomShell({
  adapter = defaultAdapter,
}: {
  adapter?: ReviewAdapter;
}) {
  const [session] = useState(() => new ReviewSession(adapter));
  const data = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const [station, setStation] = useState<Station>('Entrance');
  const [thesis, setThesis] = useState('');
  const [symbol, setSymbol] = useState('ETH');
  const [hours, setHours] = useState<6 | 24 | 168>(24);
  const [motion, setMotion] = useState<MotionPreference>('system');
  const [systemReduced, setSystemReduced] = useState<boolean | null>(null);
  const [typing, setTyping] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [card, setCard] = useState<ReviewCard | null>(null);
  const arrived = useRef(false);
  const panel = useRef<HTMLElement>(null);
  const reduced =
    motion === 'reduce' || (motion === 'system' && (systemReduced ?? true));
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setSystemReduced(media.matches);
    const change = () => setSystemReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (arrived.current || systemReduced === null) return;
    const timer = setTimeout(
      () => {
        if (arrived.current) return;
        arrived.current = true;
        setStation('Counter');
      },
      reduced ? 0 : 3200,
    );
    return () => clearTimeout(timer);
  }, [reduced, systemReduced]);
  useEffect(() => () => session.cancel(), [session]);
  const navigate = useCallback((next: Station) => {
    arrived.current = true;
    setStation(next);
    setTyping(false);
    setEvidenceOpen(false);
  }, []);
  const onInterrogation = (result: InterrogationResult) => {
    setCard(result.card);
    navigate('TeaTable');
  };
  useEffect(() => {
    if (station === 'TeaTable' && data.result) panel.current?.focus();
  }, [station, data.result]);
  const showCard = (next: ReviewCard) => {
    setCard(next);
    navigate('Shelf');
  };
  const onPour = async () => {
    if (data.activeRequestId) return;
    try {
      const result = await session.onPour({
        thesis,
        symbol,
        lookbackHours: hours,
        mode: 'demo',
        requestId: crypto.randomUUID(),
      });
      onInterrogation(result);
    } catch {
      /* Session exposes retryable errors; cancelled requests never navigate. */
    }
  };
  const onSample = () => {
    setThesis(SAMPLE_THESIS);
    setSymbol('ETH');
    setHours(24);
  };
  const active = STATIONS.find((s) => s.id === station)!;
  const mood: SceneMood =
    data.workflowState === 'error'
      ? 'error'
      : data.workflowState === 'fetching'
        ? 'pouring'
        : station === 'Shelf' && data.result
          ? 'card'
          : (data.result?.findings[0]?.verdict ?? 'waiting');
  const busy = data.workflowState === 'fetching';
  return (
    <main
      className="app-shell"
      data-motion={reduced ? 'reduce' : 'full'}
      data-mood={mood}
    >
      <header className="topbar">
        <a href="#main-panel" className="brand">
          <span className="brand-mark" aria-hidden="true">
            ◒
          </span>
          <span>
            Tea After Pour<small>A QUIET ROOM FOR A FINISHED THESIS</small>
          </span>
        </a>
        <span className="demo-label">
          <span aria-hidden="true">●</span> DEMO DATA{' '}
          <small>NO LIVE CONNECTION</small>
        </span>
      </header>
      <div className="room-layout">
        <section
          className="room-stage"
          aria-label="Guided three-dimensional tea room"
        >
          <TeaRoom
            station={station}
            onNavigate={navigate}
            reduced={reduced}
            resetKey={resetKey}
            typing={typing}
            reading={evidenceOpen}
            mood={mood}
            requestKey={data.activeRequestId ?? data.result?.requestId ?? null}
          />
          <div className="scene-caption">
            <span className="eyebrow">
              THE ROOM / {active.label.toUpperCase()}
            </span>
            <p>
              {station === 'Counter'
                ? 'Bring the thought. We’ll put the kettle on.'
                : station === 'TeaTable'
                  ? 'An observation is a beginning, not a verdict.'
                  : station === 'AvatarSeat'
                    ? 'There is room to change your mind.'
                    : station === 'Shelf'
                      ? 'Keep the question. Leave the certainty.'
                      : 'Come in. There is no hurry.'}
            </p>
          </div>
          <div className="scene-controls">
            <button onClick={() => setResetKey((v) => v + 1)}>
              ↺ Reset view
            </button>
            <label>
              <span className="sr-only">Motion preference</span>
              <select
                aria-label="Motion preference"
                value={motion}
                onChange={(e) => setMotion(e.target.value as MotionPreference)}
              >
                <option value="system">Motion: system</option>
                <option value="reduce">Reduce motion</option>
                <option value="full">Full motion</option>
              </select>
            </label>
          </div>
        </section>
        <section
          key={station}
          className="reading-panel"
          id="main-panel"
          ref={panel}
          tabIndex={-1}
          aria-label={active.label}
          onFocusCapture={(e) =>
            setTyping(
              e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                e.target instanceof HTMLSelectElement,
            )
          }
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setTyping(false);
          }}
        >
          {station === 'Entrance' && (
            <div className="arrival">
              <div className="eyebrow">WELCOME / TAKE YOUR TIME</div>
              <h1>
                A quiet room.
                <br />A clearer thought.
              </h1>
              <p className="intro">
                Bring the reasoning you have already written. Notice what it
                holds, and what it asks you to assume.
              </p>
              <button className="primary" onClick={() => navigate('Counter')}>
                Skip to counter <span aria-hidden="true">→</span>
              </button>
              <p className="field-note">
                We’ll meet you at the counter in a moment.
              </p>
            </div>
          )}
          {station === 'Counter' && (
            <ThesisPanel
              thesis={thesis}
              symbol={symbol}
              hours={hours}
              onThesis={setThesis}
              onSymbol={setSymbol}
              onHours={setHours}
              onPour={onPour}
              onSample={onSample}
              busy={busy}
              error={data.error}
            />
          )}
          {station === 'TeaTable' &&
            (data.result ? (
              <ResultScroll
                result={data.result}
                onEvidence={() => setEvidenceOpen(true)}
                onReflect={() => navigate('AvatarSeat')}
                onCard={() => showCard(data.result!.card)}
              />
            ) : (
              <EmptyStation
                title="A place for the evidence."
                text="Your review will arrive here after you pour a thesis at the counter."
                onCounter={() => navigate('Counter')}
              />
            ))}
          {station === 'AvatarSeat' && (
            <>
              <div className="eyebrow">03 / THE HOST · ONE BREATH</div>
              <h1>
                One breath
                <br />
                before you go.
              </h1>
              <div className="host-question">
                <span aria-hidden="true">“</span>
                <p>
                  {data.result?.card.oneBreath ??
                    'What would help you see the difference between what you observed and what you inferred?'}
                </p>
              </div>
              <p className="intro">
                No answer is owed to the room.
                <br />
                The question is yours to carry.
              </p>
              <p className="host-signature">YOUR TEA HOST</p>
              {data.result ? (
                <button
                  className="primary"
                  onClick={() => showCard(data.result!.card)}
                >
                  Keep this reflection <span aria-hidden="true">→</span>
                </button>
              ) : (
                <button className="primary" onClick={() => navigate('Counter')}>
                  Bring a thesis
                </button>
              )}
            </>
          )}
          {station === 'Shelf' &&
            (card && data.result ? (
              <ShareCard card={card} onAgain={() => navigate('Counter')} />
            ) : (
              <EmptyStation
                title="A shelf for clearer thoughts."
                text="Pour a thesis first. Your noticed / cut / one breath card will be waiting here."
                onCounter={() => navigate('Counter')}
              />
            ))}
        </section>
      </div>
      <div className="status-line" role="status">
        <span>
          {busy
            ? 'Steeping the synthetic sample…'
            : data.workflowState === 'error'
              ? 'The pour needs another try. Your thesis is preserved.'
              : data.result
                ? 'Demo review ready · no provider contacted'
                : 'A private pause · your writing stays in memory'}
        </span>
        {busy && (
          <button
            onClick={() => {
              session.cancel();
              setCard(null);
            }}
          >
            Cancel review
          </button>
        )}
        <span className="status-tail">
          ONLY THE EVIDENCE IS MOCKED. THE PAUSE IS YOURS.
        </span>
      </div>
      <nav className="station-nav" aria-label="Tea room stations">
        {STATIONS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => navigate(s.id)}
            aria-current={s.id === station ? 'step' : undefined}
          >
            <span className="station-number">0{i + 1}</span>
            <span>
              {s.label}
              <small>{s.purpose}</small>
            </span>
            <span className="station-dot" aria-hidden="true">
              {s.id === station ? '●' : '○'}
            </span>
          </button>
        ))}
      </nav>
      <footer className="app-footer">
        <span>
          AI reviews the tea after I poured it. It does not pick the leaf.
        </span>
        <span>PASS A / A SYNTHETIC REHEARSAL</span>
      </footer>
      {evidenceOpen && data.result?.evidence[0] && (
        <EvidenceDrawer
          evidence={data.result.evidence[0]}
          finding={data.result.findings[0]}
          onClose={() => setEvidenceOpen(false)}
        />
      )}
    </main>
  );
}
function EmptyStation({
  title,
  text,
  onCounter,
}: {
  title: string;
  text: string;
  onCounter: () => void;
}) {
  return (
    <>
      <div className="eyebrow">THE ROOM IS READY</div>
      <h1>{title}</h1>
      <p className="intro">{text}</p>
      <button className="primary" onClick={onCounter}>
        Return to counter <span aria-hidden="true">→</span>
      </button>
    </>
  );
}

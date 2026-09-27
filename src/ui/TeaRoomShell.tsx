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
  MotionPreference,
  ReviewAdapter,
  Station,
} from '../shared/contracts';
import { validateInput } from '../shared/contracts';
import type { SceneMood } from '../scene/motion/dynamics';
import type { IrohActivity } from '../scene/TeaHost3D';
import { STATIONS } from '../scene/stations';
import { MockReviewAdapter } from '../review/mock-adapter';
import { ReviewSession } from '../review/session';
import { SAMPLE_THESIS } from '../fixtures/eth-demo';
import { ThesisPanel } from './ThesisPanel';
import { ResultScroll } from './ResultScroll';
import { AccountMenu } from './AccountMenu';
import type { PublicUser } from '../auth/service';
import { SmartWalletShelf } from './SmartWalletShelf';
import { EvidenceDrawer } from './EvidenceDrawer';
import {
  isNansenAvailability,
  type NansenAvailability,
} from '../nansen/availability';
import { IrohSession } from '../nansen/session';
import { IrohChat } from './IrohChat';
import { SceneLoader } from './SceneLoader';

// SceneLoader covers the stage while the scene chunk downloads.
const TeaRoom = dynamic(() => import('../scene/TeaRoom'), {
  ssr: false,
  loading: () => <div className="scene-fallback" />,
});
const defaultAdapter = new MockReviewAdapter();
export default function TeaRoomShell({
  adapter = defaultAdapter,
  user,
  nansen: initialNansen,
}: {
  adapter?: ReviewAdapter;
  user: PublicUser | null;
  nansen: NansenAvailability;
}) {
  const [session] = useState(() => new ReviewSession(adapter));
  const [irohSession] = useState(() => new IrohSession());
  const [nansen, setNansen] = useState(initialNansen);
  const [irohActivity, setIrohActivity] = useState<IrohActivity>('idle');
  const data = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const [station, setStation] = useState<Station>('Entrance');
  const [cameraAt, setCameraAt] = useState<Station | null>(null);
  const [shelfFocused, setShelfFocused] = useState(false);
  const [thesis, setThesis] = useState('');
  const [symbol, setSymbol] = useState('ETH');
  const [hours, setHours] = useState<6 | 24 | 168>(24);
  const [motion, setMotion] = useState<MotionPreference>('system');
  const [systemReduced, setSystemReduced] = useState<boolean | null>(null);
  const [typing, setTyping] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => station === 'Entrance');
  const [readingReady, setReadingReady] = useState(true);
  const [sceneAvailable, setSceneAvailable] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetProgress, setAssetProgress] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const onReveal = useCallback(() => setRevealed(true), []);
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
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/nansen-status', {
          cache: 'no-store',
        });
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (!body || typeof body !== 'object' || !('nansen' in body)) return;
        if (!isNansenAvailability(body.nansen) || cancelled) return;
        setNansen(body.nansen);
      } catch {
        /* Keep the server-rendered availability. */
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => () => session.cancel(), [session]);
  useEffect(() => () => irohSession.stop(), [irohSession]);
  useEffect(
    () =>
      irohSession.subscribe(() => {
        const chat = irohSession.getSnapshot();
        const next: IrohActivity = chat.isStreaming
          ? chat.currentTool || !chat.messages.at(-1)?.content
            ? 'researching'
            : 'responding'
          : chat.error
            ? 'error'
            : 'idle';
        setIrohActivity((current) => (current === next ? current : next));
      }),
    [irohSession],
  );
  const navigate = useCallback(
    (next: Station) => {
      setCameraAt(null);
      setShelfFocused(false);
      setStation(next);
      setReadingReady(true);
      setTyping(false);
      setEvidenceOpen(false);
      setPanelOpen(sceneFailed || next === 'Entrance');
    },
    [sceneFailed],
  );
  const focusShelf = useCallback(() => {
    if (shelfFocused) return;
    setCameraAt(null);
    setShelfFocused(true);
    setStation('Shelf');
    setReadingReady(true);
    setTyping(false);
    setEvidenceOpen(false);
    setPanelOpen(true);
  }, [shelfFocused]);
  const openPanel = useCallback(() => {
    if (station === 'Shelf') {
      setCameraAt(null);
      setShelfFocused(true);
    }
    setPanelOpen(true);
  }, [station]);
  const closePanel = useCallback(() => {
    setTyping(false);
    setPanelOpen(false);
  }, []);
  const onCameraArrive = useCallback((at: Station) => {
    setCameraAt(at);
    if (at === 'TeaTable') setReadingReady(true);
  }, []);
  const onSceneAvailability = useCallback((available: boolean) => {
    setSceneAvailable(available);
    setSceneFailed(!available);
    if (!available) {
      setReadingReady(true);
      setPanelOpen(true);
    }
  }, []);
  const onLoadProgress = useCallback((active: boolean, progress: number) => {
    setAssetsLoading(active);
    setAssetProgress((current) => Math.max(current, progress));
  }, []);
  const sceneSettled = sceneFailed || (sceneAvailable && !assetsLoading);
  useEffect(() => {
    if (sceneReady) return;
    // Wait for loading to stay quiet briefly; never hold the room past 20s.
    const timer = window.setTimeout(
      () => setSceneReady(true),
      sceneSettled ? 450 : 20000,
    );
    return () => window.clearTimeout(timer);
  }, [sceneSettled, sceneReady]);
  const loaderProgress = sceneAvailable ? 15 + assetProgress * 0.85 : 6;
  useEffect(() => {
    if (station === 'TeaTable' && data.result) panel.current?.focus();
  }, [station, data.result]);
  const onPour = async () => {
    if (data.activeRequestId) return;
    const input = {
      thesis,
      symbol,
      lookbackHours: hours,
      mode: 'demo' as const,
      requestId: crypto.randomUUID(),
    };
    try {
      validateInput(input);
    } catch {
      try {
        await session.onPour(input);
      } catch {
        /* Validation message is in the session snapshot. */
      }
      return;
    }
    navigate('TeaTable');
    setReadingReady(reduced || !sceneAvailable);
    try {
      await session.onPour(input);
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
        : (data.result?.findings[0]?.verdict ?? 'waiting');
  const busy = data.workflowState === 'fetching';
  const shelfOpen =
    station === 'Shelf' &&
    shelfFocused &&
    (cameraAt === 'Shelf' || sceneFailed);
  const shelfView =
    station === 'Shelf'
      ? shelfOpen
        ? 'open'
        : shelfFocused
          ? 'focusing'
          : 'browse'
      : undefined;
  const canApproachShelf =
    station === 'Shelf' &&
    !shelfFocused &&
    (cameraAt === 'Shelf' || sceneFailed);
  const isEntrance = station === 'Entrance';
  return (
    <main
      className="app-shell"
      data-station={station}
      data-motion={reduced ? 'reduce' : 'full'}
      data-mood={mood}
      data-nansen={nansen}
      data-iroh-activity={irohActivity}
      data-camera-at={cameraAt ?? undefined}
      data-shelf-view={shelfView}
      aria-busy={!revealed}
    >
      <SceneLoader
        ready={sceneReady}
        progress={loaderProgress}
        reduced={reduced}
        onReveal={onReveal}
      />
      <header className="topbar">
        <a href="#main-panel" className="brand">
          <span className="brand-mark" aria-hidden="true">
            ◒
          </span>
          <span className="brand-text">
            Tea After Pour
            <small>A QUIET ROOM FOR A FINISHED THESIS</small>
          </span>
        </a>

        <div className="topbar-right">
          <div className="status-indicator">
            <button className="status-icon" aria-label="Data source status">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle
                  cx="8"
                  cy="8"
                  r="6.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
                <path
                  d="M8 7.2V11"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
                <circle cx="8" cy="5" r="0.8" fill="currentColor" />
              </svg>
            </button>

            <div className="status-popup" role="tooltip">
              <div className="status-row">
                <span className="status-label">Thesis</span>
                <span className="status-value demo">Demo data</span>
              </div>

              <div className="status-row">
                <span className="status-label">Iroh</span>
                <span
                  className={
                    nansen === 'configured'
                      ? 'status-value live'
                      : 'status-value'
                  }
                >
                  {nansen === 'configured'
                    ? 'Live · Nansen Research'
                    : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          <AccountMenu user={user} />
        </div>
      </header>

      <div className="room-layout">
        <section
          className="room-stage"
          aria-label="Guided three-dimensional tea room"
        >
          <TeaRoom
            station={station}
            reduced={reduced}
            resetKey={resetKey}
            typing={typing}
            reading={evidenceOpen}
            allowTravelWhileTyping={station === 'AvatarSeat'}
            mood={isEntrance ? 'waiting' : mood}
            requestKey={data.activeRequestId ?? data.result?.requestId ?? null}
            irohActivity={irohActivity}
            onArrive={onCameraArrive}
            onAvailabilityChange={onSceneAvailability}
            onLoadProgress={onLoadProgress}
            onShelfSelect={focusShelf}
            shelfFocused={shelfFocused}
            shelfRevealed={shelfOpen}
            menuClosed={!isEntrance && !panelOpen}
            onMenuOpen={openPanel}
          />

          {canApproachShelf && (
            <button
              type="button"
              className="shelf-approach"
              aria-label="Approach the Shelf"
              onClick={focusShelf}
            >
              <span>THE SHELF</span>
              Approach the Shelf <span aria-hidden="true">↗</span>
            </button>
          )}

          {!isEntrance && !panelOpen && (
            <button type="button" className="sr-only" onClick={openPanel}>
              Open {active.label} menu
            </button>
          )}
        </section>

        {isEntrance ? (
          <div className="entrance-hero">
            <div className="entrance-hero-content">
              <span className="entrance-hero-mark" aria-hidden="true">
                ◒
              </span>
              <div className="eyebrow">WELCOME / TAKE YOUR TIME</div>
              <h1>
                A quiet room.
                <br />
                <em>A clearer thought.</em>
              </h1>
              <span className="entrance-hero-rule" aria-hidden="true" />
              <p className="intro">
                Bring the reasoning you have already written. Notice what it
                holds, and what it asks you to assume.
              </p>
              <button
                type="button"
                className="primary entrance-hero-cta"
                onClick={() => navigate('Counter')}
              >
                <span>Begin</span>
                <span className="entrance-hero-cta-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            </div>
          </div>
        ) : (
          <section
            key={station}
            className={`reading-panel${station === 'TeaTable' && (busy || !readingReady) ? ' is-steeping' : ''}${panelOpen ? '' : ' is-closed'}`}
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
            <button
              type="button"
              className="panel-close"
              aria-label={`Close ${active.label} menu`}
              onClick={closePanel}
            >
              <span aria-hidden="true">×</span>
              <span className="sr-only">Close menu</span>
            </button>
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
              (data.result && readingReady ? (
                <ResultScroll
                  result={data.result}
                  onEvidence={() => setEvidenceOpen(true)}
                  onChat={() => navigate('AvatarSeat')}
                  onCard={() => navigate('Shelf')}
                />
              ) : busy || !readingReady ? (
                <div className="steeping-content" role="status">
                  <div className="eyebrow">02 / THE TEA ROOM</div>
                  <h1>The tea is steeping.</h1>
                  <p>Settle at the table while the review arrives.</p>
                </div>
              ) : (
                <EmptyStation
                  title={
                    data.error
                      ? 'The pour needs another try.'
                      : 'A place for the evidence.'
                  }
                  text={
                    data.error ??
                    'Your review will arrive here after you pour a thesis at the counter.'
                  }
                  onCounter={() => navigate('Counter')}
                />
              ))}
            {station === 'AvatarSeat' && (
              <IrohChat session={irohSession} user={user} nansen={nansen} />
            )}
            {shelfOpen && <SmartWalletShelf nansen={nansen} />}
          </section>
        )}
      </div>

      {station !== 'Entrance' && (
        <nav className="station-nav is-expanded" aria-label="Tea room stations">
          <div className="station-list" role="list">
            {STATIONS.map((s, i) => {
              const isActive = s.id === station;
              return (
                <button
                  key={s.id}
                  className={`station-item ${isActive ? 'active' : ''}`}
                  onClick={() => navigate(s.id)}
                  aria-current={isActive ? 'step' : undefined}
                  role="listitem"
                >
                  <span className="station-number">0{i + 1}</span>
                  <span className="station-text">
                    {s.label}
                    <small>{s.purpose}</small>
                  </span>
                  <span className="station-dot" aria-hidden="true">
                    {isActive ? '●' : '○'}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

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

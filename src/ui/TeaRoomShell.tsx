'use client';
import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { MotionPreference, Station } from '../shared/contracts';
import type { SceneMood } from '../scene/motion/dynamics';
import type { IrohActivity } from '../scene/TeaHost3D';
import { STATIONS } from '../scene/stations';
import { AccountMenu } from './AccountMenu';
import type { PublicUser } from '../auth/service';
import { SmartWalletShelf } from './SmartWalletShelf';
import {
  isNansenAvailability,
  type NansenAvailability,
} from '../nansen/availability';
import { IrohSession } from '../nansen/session';
import { IrohChat } from './IrohChat';
import { SceneLoader } from './SceneLoader';
import { StationDock } from './StationDock';
import { ThesisDeck } from './ThesisDeck';
import type { ConvictionLevel, ThesisId } from '../thesis/types';
import { convictionToMood } from './convictionMood';

// SceneLoader covers the stage while the scene chunk downloads.
const TeaRoom = dynamic(() => import('../scene/TeaRoom'), {
  ssr: false,
  loading: () => <div className="scene-fallback" />,
});

const THESIS_IDS: ThesisId[] = ['robinhood', 'bullrun', 'ai'];

export default function TeaRoomShell({
  user,
  nansen: initialNansen,
}: {
  user: PublicUser | null;
  nansen: NansenAvailability;
}) {
  const [irohSession] = useState(() => new IrohSession());
  const [nansen, setNansen] = useState(initialNansen);
  const [irohActivity, setIrohActivity] = useState<IrohActivity>('idle');
  const [station, setStation] = useState<Station>('Entrance');
  const [cameraAt, setCameraAt] = useState<Station | null>(null);
  const [shelfFocused, setShelfFocused] = useState(false);
  const [motion] = useState<MotionPreference>('system');
  const [systemReduced, setSystemReduced] = useState<boolean | null>(null);
  const [resetKey] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pour, setPour] = useState<{ key: string | null; mood: SceneMood }>({
    key: null,
    mood: 'waiting',
  });
  const [initialThesis, setInitialThesis] = useState<ThesisId | null>(null);
  const [uncleDraft, setUncleDraft] = useState<{
    text: string;
    key: number;
  } | null>(null);
  const [sceneAvailable, setSceneAvailable] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetProgress, setAssetProgress] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const onReveal = useCallback(() => setRevealed(true), []);
  const panel = useRef<HTMLElement>(null);
  const openHint = useRef<HTMLButtonElement>(null);
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
    const raw = new URLSearchParams(window.location.search).get('thesis');
    if (!raw || !THESIS_IDS.includes(raw as ThesisId)) return;
    setInitialThesis(raw as ThesisId);
    setStation('Counter');
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
  const navigate = useCallback((next: Station) => {
    setCameraAt(null);
    setShelfFocused(false);
    setStation(next);
    setPanelOpen(false);
  }, []);
  const focusShelf = useCallback(() => {
    if (shelfFocused) return;
    setCameraAt(null);
    setShelfFocused(true);
    setStation('Shelf');
    setPanelOpen(true);
  }, [shelfFocused]);
  const openPanel = useCallback(() => {
    setPanelOpen(true);
    queueMicrotask(() => panel.current?.focus());
  }, []);
  const closePanel = useCallback(() => {
    setPanelOpen(false);
    queueMicrotask(() => openHint.current?.focus());
  }, []);
  const onCameraArrive = useCallback((at: Station) => {
    setCameraAt(at);
  }, []);
  const onSceneAvailability = useCallback((available: boolean) => {
    setSceneAvailable(available);
    setSceneFailed(!available);
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
    if (!panelOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (station !== 'Counter' && station !== 'AvatarSeat') return;
      event.preventDefault();
      closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen, station, closePanel]);
  const onOpenThesis = useCallback(
    (id: ThesisId, conviction: ConvictionLevel | null) => {
      setPour({
        key: `thesis:${id}:${Date.now()}`,
        mood: convictionToMood(conviction),
      });
    },
    [],
  );
  const onCloseThesis = useCallback(() => {
    setPour((current) => ({ ...current, mood: 'waiting' }));
  }, []);
  const onTalkToUncle = useCallback((text: string) => {
    setUncleDraft({ text, key: Date.now() });
    setCameraAt(null);
    setShelfFocused(false);
    setStation('AvatarSeat');
    setPanelOpen(true);
    queueMicrotask(() => panel.current?.focus());
  }, []);
  const active = STATIONS.find((s) => s.id === station)!;
  const isEntrance = station === 'Entrance';
  const mood: SceneMood = isEntrance ? 'waiting' : pour.mood;
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
  const cameraSettled = cameraAt === station || sceneFailed;
  const panelStation =
    station === 'Counter'
      ? 'Counter'
      : station === 'AvatarSeat'
        ? 'Host'
        : null;
  const showOpenHint =
    Boolean(panelStation) && !panelOpen && !isEntrance && cameraSettled;
  const showPanel =
    !isEntrance &&
    panelOpen &&
    (station === 'Counter' ||
      station === 'AvatarSeat' ||
      (station === 'Shelf' && shelfOpen));
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
                <span className="status-label">Uncle</span>
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
            typing={false}
            reading={false}
            allowTravelWhileTyping={station === 'AvatarSeat'}
            mood={mood}
            requestKey={pour.key}
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

          {showOpenHint && panelStation && (
            <button
              ref={openHint}
              type="button"
              className="panel-open-hint"
              aria-label={`Open ${panelStation}`}
              onClick={openPanel}
            >
              Open {panelStation}
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
          showPanel && (
            <section
              key={station}
              className="reading-panel"
              id="main-panel"
              ref={panel}
              tabIndex={-1}
              aria-label={active.label}
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
                <ThesisDeck
                  nansen={nansen}
                  reduced={reduced}
                  initialThesis={initialThesis}
                  onOpenThesis={onOpenThesis}
                  onCloseThesis={onCloseThesis}
                  onTalkToUncle={onTalkToUncle}
                />
              )}
              {station === 'AvatarSeat' && (
                <IrohChat
                  session={irohSession}
                  user={user}
                  nansen={nansen}
                  draft={uncleDraft}
                />
              )}
              {shelfOpen && <SmartWalletShelf nansen={nansen} />}
            </section>
          )
        )}
      </div>

      {!isEntrance && (
        <StationDock
          station={station}
          reduced={reduced}
          onNavigate={navigate}
        />
      )}
    </main>
  );
}

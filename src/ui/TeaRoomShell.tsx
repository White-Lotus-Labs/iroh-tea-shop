'use client';
import dynamic from 'next/dynamic';
import { flushSync } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MotionPreference, Station } from '../shared/contracts';
import type { SceneMood } from '../scene/motion/dynamics';
import type { IrohActivity } from '../scene/TeaHost3D';
import { RECENTER_EVENT, STATIONS } from '../scene/stations';
import { AccountMenu } from './AccountMenu';
import type { PublicUser } from '../auth/service';
import { SmartWalletShelf } from './SmartWalletShelf';
import {
  isNansenAvailability,
  type NansenAvailability,
} from '../nansen/availability';
import { IrohSession } from '../nansen/session';
import { StationDock } from './StationDock';
import type { ConvictionLevel, ThesisId } from '../thesis/types';
import { convictionToMood } from './convictionMood';
import { InkLine, STATION_TEASERS } from './stationTeasers';
import { WaitingRoom } from './waiting-room/WaitingRoom';
import { whenBookRests } from './waiting-room/bookMotion';
import { WaitingVersions } from './waiting-room/Versions';
import { MusicToggle } from './MusicToggle';
import { roomTextures, SHELF_POSTERS } from './roomTextures';
import { lightExperience } from '../scene/lightExperience';
import { paintSurfaces } from '../scene/paintSurfaces';

// Scene / deck / chat stay out of the first paint; idle preloads warm them.
const loadTeaRoom = () => import('../scene/TeaRoom');
const loadThesisDeck = () =>
  import('./ThesisDeck').then((m) => ({ default: m.ThesisDeck }));
const loadIrohChat = () =>
  import('./IrohChat').then((m) => ({ default: m.IrohChat }));

// Textures download while three.js parses and the room builds, instead of
// after; the scene then reads them from the HTTP cache.
const warmTeaRoom = () => {
  void paintSurfaces();
  return loadTeaRoom().then(() => {
    for (const src of roomTextures(lightExperience())) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.fetchPriority = 'low';
      img.src = src;
    }
  });
};

// The sketchbook plays first. Each heavy step of the room (parsing three.js,
// then mounting and compiling the scene) waits for the book to rest, so no
// step lands in a page turn. The guest is reading; a slow load is fine.
const TeaRoom = dynamic(
  () =>
    whenBookRests()
      .then(loadTeaRoom)
      .then((room) => whenBookRests().then(() => room)),
  {
    ssr: false,
    loading: () => <div className="scene-fallback" />,
  },
);
const ThesisDeck = dynamic(loadThesisDeck, {
  loading: () => null,
});
const IrohChat = dynamic(loadIrohChat, {
  loading: () => null,
});

function idlePreload(load: () => Promise<unknown>) {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(() => {
      void load();
    });
    return () => window.cancelIdleCallback(handle);
  }
  const timer = window.setTimeout(() => {
    void load();
  }, 200);
  return () => window.clearTimeout(timer);
}

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
  const [selectedThesis, setSelectedThesis] = useState<ThesisId | null>(null);
  const [uncleDraft, setUncleDraft] = useState<{
    text: string;
    key: number;
  } | null>(null);
  const [sceneAvailable, setSceneAvailable] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetProgress, setAssetProgress] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [staged, setStaged] = useState(false);
  const onStaged = useCallback(() => setStaged(true), []);
  // Set once the guest is past the Entrance (the Enter button or a deep link);
  // it loads the rigged host. Never unset, or the host would vanish.
  const [revealed, setRevealed] = useState(false);
  if (!revealed && station !== 'Entrance') setRevealed(true);
  // Warm the 3D room behind the sketchbook once it rests.
  useEffect(() => void whenBookRests().then(warmTeaRoom), []);
  // Warm the shelf posters and the Counter / Host panels once the room is ready to enter.
  useEffect(() => {
    if (!sceneReady) return;
    return idlePreload(() => {
      // The scroll seals and watermark use the CJK face, which is not
      // preloaded; fetch its glyph slices now so a first scroll does not swap.
      const cjk = getComputedStyle(document.documentElement)
        .getPropertyValue('--font-cjk-face')
        .trim();
      if (cjk)
        document.fonts.load(`600 20px ${cjk}`, '茶禅签师卷星').catch(() => {});
      for (const src of SHELF_POSTERS) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = src;
      }
      return Promise.all([loadThesisDeck(), loadIrohChat()]);
    });
  }, [sceneReady]);
  useEffect(() => {
    if (!revealed) return;
    const prefetch = () => {
      for (const id of THESIS_IDS) {
        const img = new Image();
        img.src = `/images/theses/${id}-600w.webp`;
      }
    };
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(prefetch);
      return () => window.cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(prefetch, 1);
    return () => window.clearTimeout(timer);
  }, [revealed]);
  const panel = useRef<HTMLElement>(null);
  const openHint = useRef<HTMLButtonElement>(null);
  // Deep link opens the Counter panel once after the camera arrives.
  const deepLinkOpenOnce = useRef(false);
  const focusHintOnArrive = useRef(false);
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
    deepLinkOpenOnce.current = true;
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
  const navigate = useCallback(
    (next: Station) => {
      // Re-clicking Counter closes the desk and returns this camera pose.
      // cameraAt stays set so the open hint does not wait for a new arrival.
      if (next === station) {
        if (next === 'Counter') {
          setPanelOpen(false);
          window.dispatchEvent(new Event(RECENTER_EVENT));
        }
        return;
      }
      setCameraAt(null);
      setShelfFocused(false);
      setStation(next);
      setPanelOpen(false);
    },
    [station],
  );
  const focusShelf = useCallback(() => {
    if (shelfFocused) {
      setPanelOpen(true);
      queueMicrotask(() => panel.current?.focus());
      return;
    }
    const alreadyAtShelf =
      station === 'Shelf' && (cameraAt === 'Shelf' || sceneFailed);
    if (!alreadyAtShelf) setCameraAt(null);
    setShelfFocused(true);
    setStation('Shelf');
    setPanelOpen(true);
  }, [shelfFocused, station, cameraAt, sceneFailed]);
  const openPanel = useCallback(() => {
    if (station === 'Shelf') {
      if (cameraAt !== 'Shelf' && !sceneFailed) setCameraAt(null);
      setShelfFocused(true);
    }
    setPanelOpen(true);
    queueMicrotask(() => panel.current?.focus());
  }, [station, cameraAt, sceneFailed]);
  useEffect(() => {
    if (!deepLinkOpenOnce.current) return;
    if (station !== 'Counter') return;
    if (cameraAt !== 'Counter' && !sceneFailed) return;
    deepLinkOpenOnce.current = false;
    setPanelOpen(true);
  }, [station, cameraAt, sceneFailed]);
  const closePanel = useCallback(() => {
    const paper = panel.current;
    const finish = () => {
      // Keep focus where the user moved it (e.g. a dock click mid roll-up).
      const active = document.activeElement;
      const refocus =
        !active || active === document.body || Boolean(paper?.contains(active));
      flushSync(() => setPanelOpen(false));
      if (refocus) openHint.current?.focus();
    };
    if (reduced || !paper || paper.classList.contains('is-rolling-up'))
      return finish();
    // Let the scroll roll up to its top rod before it unmounts.
    paper.classList.add('is-rolling-up');
    window.setTimeout(finish, 380);
  }, [reduced]);
  const onCameraArrive = useCallback((at: Station) => {
    setCameraAt(at);
  }, []);
  const onSceneAvailability = useCallback((available: boolean) => {
    setSceneAvailable(available);
    setSceneFailed(!available);
  }, []);
  const onLoadProgress = useCallback((active: boolean, progress: number) => {
    setAssetsLoading(active);
    // Every loaded texture reports; tenths keep that from re-rendering the
    // shell on each one. The pour eases between steps anyway.
    const step = Math.floor(progress / 10) * 10;
    setAssetProgress((current) => Math.max(current, step));
  }, []);
  const sceneSettled =
    sceneFailed || (sceneAvailable && staged && !assetsLoading);
  useEffect(() => {
    if (sceneReady) return;
    // Wait for loading to stay quiet briefly; never hold the room past 30s.
    const timer = window.setTimeout(
      () => setSceneReady(true),
      sceneSettled ? 450 : 30000,
    );
    return () => window.clearTimeout(timer);
  }, [sceneSettled, sceneReady]);
  const loaderProgress = sceneAvailable ? 15 + assetProgress * 0.85 : 6;
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Keep a half-typed question to Uncle.
      const target = event.target as HTMLTextAreaElement | null;
      if (target?.tagName === 'TEXTAREA' && target.value) return;
      event.preventDefault();
      closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen, closePanel]);
  const onOpenThesis = useCallback(
    (id: ThesisId, conviction: ConvictionLevel | null) => {
      setSelectedThesis(id);
      setPour({
        key: `thesis:${id}:${Date.now()}`,
        mood: convictionToMood(conviction),
      });
    },
    [],
  );
  const onCloseThesis = useCallback(() => {
    setSelectedThesis(null);
    setPour((current) => ({ ...current, mood: 'waiting' }));
  }, []);
  const openThesisDesk = useCallback(() => {
    setSelectedThesis(null);
    if (station === 'Counter') {
      setPanelOpen(true);
      queueMicrotask(() => panel.current?.focus());
      return;
    }
    navigate('Counter');
    deepLinkOpenOnce.current = true;
  }, [station, navigate]);
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
  // After a close the camera keeps its Shelf pose; this button reopens it.
  const canApproachShelf =
    station === 'Shelf' &&
    !(shelfFocused && panelOpen) &&
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
  // After Enter, focus would drop to <body> as the waiting room unmounts.
  useEffect(() => {
    if (!showOpenHint || !focusHintOnArrive.current) return;
    focusHintOnArrive.current = false;
    const current = document.activeElement;
    if (
      !current ||
      current === document.body ||
      current.closest('.waiting-room')
    )
      openHint.current?.focus({ preventScroll: true });
  }, [showOpenHint]);
  const teaser = STATION_TEASERS[station];
  useEffect(() => {
    if (shelfOpen) panel.current?.focus({ preventScroll: true });
  }, [shelfOpen]);
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
      aria-busy={!sceneReady}
    >
      <WaitingRoom
        open={isEntrance}
        ready={sceneReady}
        progress={loaderProgress}
        reduced={reduced}
        onEnter={() => {
          focusHintOnArrive.current = true;
          navigate('Counter');
        }}
      >
        <WaitingVersions reduced={reduced} />
      </WaitingRoom>
      <header className="topbar" inert={isEntrance || undefined}>
        <a href="#main-panel" className="brand">
          <span className="brand-mark" aria-hidden="true">
            ◒
          </span>
          <span className="brand-text">
            Iroh&apos;s Tea Shop
            <small>NANSEN-POWERED CRYPTO RESEARCH</small>
          </span>
        </a>

        <div className="topbar-right">
          <MusicToggle floating={isEntrance} />
          <div className="status-indicator">
            <button
              className="status-icon"
              aria-label="Data source status"
              aria-describedby="status-popup"
            >
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

            <div className="status-popup" id="status-popup" role="tooltip">
              <div className="status-row">
                <span className="status-label">Thesis</span>
                <span
                  className={
                    nansen === 'configured'
                      ? 'status-value live'
                      : 'status-value'
                  }
                >
                  {nansen === 'configured' ? 'Saved hourly' : 'Offline'}
                </span>
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

      <div className="room-layout" inert={isEntrance || undefined}>
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
            onThesisPick={openThesisDesk}
            onNavigate={navigate}
            onStaged={onStaged}
            hostModel={revealed}
          />

          {!isEntrance && sceneAvailable && (
            <button
              type="button"
              className="recenter-view"
              aria-label="Recenter view"
              title="Recenter view"
              onClick={() => window.dispatchEvent(new Event(RECENTER_EVENT))}
            >
              <span aria-hidden="true">◎</span>
            </button>
          )}

          {canApproachShelf && (
            <button
              ref={openHint}
              type="button"
              className="panel-open-hint shelf-approach"
              aria-label={STATION_TEASERS.Shelf!.cta!.join(' ')}
              onClick={focusShelf}
            >
              <span className="panel-open-hint-seal" aria-hidden="true">
                {STATION_TEASERS.Shelf!.glyph}
              </span>
              <span className="panel-open-hint-body" aria-hidden="true">
                <span className="panel-open-hint-title">
                  {STATION_TEASERS.Shelf!.cta![0]}{' '}
                  <em>{STATION_TEASERS.Shelf!.cta![1]}</em>
                </span>
              </span>
            </button>
          )}

          {showOpenHint && panelStation && teaser?.cta && (
            <button
              ref={openHint}
              key={panelStation}
              type="button"
              className="panel-open-hint"
              aria-label={teaser.cta.join(' ')}
              aria-describedby="panel-open-teaser"
              onClick={openPanel}
            >
              <span className="panel-open-hint-seal" aria-hidden="true">
                {teaser.glyph}
              </span>
              <span className="panel-open-hint-body" aria-hidden="true">
                <span className="panel-open-hint-title">
                  {teaser.cta[0]} <em>{teaser.cta[1]}</em>
                </span>
                <InkLine
                  text={teaser.text}
                  className="panel-open-hint-teaser"
                />
              </span>
              <span id="panel-open-teaser" className="sr-only">
                {teaser.text}
              </span>
            </button>
          )}
        </section>

        {showPanel && (
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
            <span
              className="scroll-ornament"
              aria-hidden="true"
              data-seal={teaser?.glyph ?? '茶'}
            />
            {station === 'Counter' && (
              <ThesisDeck
                nansen={nansen}
                reduced={reduced}
                initialThesis={initialThesis}
                selectedThesis={selectedThesis}
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

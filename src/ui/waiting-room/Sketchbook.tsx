'use client';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import dynamic from 'next/dynamic';
import {
  currentMotionBudget,
  FULL_STRIPS,
  noteMotionBudget,
  petalCountFor,
  resolveMotionBudget,
  riffleDuration,
  stripsFor,
  useMotionBudget,
} from '../motionBudget';
import { LotusMark } from './LotusMark';
import type { PetalArea } from './SakuraPetals';
import {
  SKETCH_IMAGES,
  SKETCH_PAGES,
  SPREAD_TITLES,
  sketchPreloadUrl,
} from './sketchbookPages';
import { bakePageShot, getPageShot, idle, pageShotKey } from './pageSnapshot';
import { usePetalCanvas } from './usePetalCanvas';
import './Sketchbook.css';

// Page curl after the Meng To sketchbook: a leaf is a chain of nested strips
// whose tangent sweeps through an arc, so paper bends instead of pivoting.
// Strip count comes from the motion budget (18, or 16 on a light machine).
const BETA = 0.6;
const TILT_X = 3.5;
const TILT_Y = 6;
const DEG = 180 / Math.PI;
// Phones, portrait tablets, and phones on their side read one page better than
// a small spread. Matches the single rules in Sketchbook.css.
const SINGLE_QUERY =
  '(max-width: 720px), (max-aspect-ratio: 4/5), (max-height: 500px)';
// A handful of petals between the book and the eye, soft with depth of field.
const NEAR_PETALS: PetalArea = { x: 12, y: 9, near: 9, far: 5 };

const PetalCanvas = dynamic(
  () => import('./SakuraPetals').then((m) => m.PetalCanvas),
  { ssr: false },
);

type Mode = 'spread' | 'single';
type Dir = 'next' | 'prev';
type Turn = { dir: Dir; from: number; to: number };
type Spring = {
  target: number;
  v: number;
  k: number;
  c: number;
  done: () => void;
  /** A riffle keeps a fixed tempo on the wall clock, even when frames drop. */
  tween?: { from: number; dur: number; t0: number };
};
type Drag = {
  x0: number;
  w: number;
  side: number;
  moved: number;
  dir: Dir | null;
  vel: number;
  at: number;
};

/** Which pages sit under the leaf, and which faces the leaf carries. */
function leafOf(mode: Mode, turn: Turn) {
  const { dir, from, to } = turn;
  if (mode === 'single')
    return dir === 'next'
      ? { cls: 'single', under: [to], front: from, reversed: false }
      : { cls: 'single', under: [from], front: to, reversed: true };
  return dir === 'next'
    ? {
        cls: 'next',
        under: [2 * from, 2 * to + 1],
        front: 2 * from + 1,
        back: 2 * to,
        reversed: false,
      }
    : {
        cls: 'prev',
        under: [2 * to, 2 * from + 1],
        front: 2 * from,
        back: 2 * to + 1,
        reversed: false,
      };
}

const PageView = memo(function PageView({
  index,
  side,
  live,
}: {
  index: number;
  side: 'left' | 'right';
  live: boolean;
}) {
  return (
    <div
      className={`sb-page is-${side}`}
      data-index={index}
      inert={!live || undefined}
      aria-hidden={!live || undefined}
    >
      {SKETCH_PAGES[index].render(live)}
    </div>
  );
});

/** The side a page sits on when it lies flat, so its shot matches it. */
function sideOf(mode: Mode, index: number): 'left' | 'right' {
  return mode === 'spread' && index % 2 === 0 ? 'left' : 'right';
}

/** Every page, hidden, for the snapshot baker to draw from. */
const Baker = memo(function Baker({
  mode,
  bind,
}: {
  mode: Mode;
  bind: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div ref={bind} className="sb-baker" hidden>
      {SKETCH_PAGES.map((page, i) => (
        <PageView
          key={page.key}
          index={i}
          side={sideOf(mode, i)}
          live={false}
        />
      ))}
    </div>
  );
});

function Leaf({
  cls,
  front,
  back,
  mode,
  strips,
  frontShot,
  backShot,
  bind,
}: {
  cls: string;
  front: number;
  back?: number;
  mode: Mode;
  strips: number;
  frontShot?: string;
  backShot?: string;
  bind: (i: number) => (el: HTMLDivElement | null) => void;
}) {
  // prev leaves hang from the gutter's left edge, so their faces swap sides.
  const frontSide = cls === 'prev' ? 'left' : 'right';
  const backSide = cls === 'prev' ? 'right' : 'left';
  const shotFaces = Boolean(frontShot);
  let chain: ReactNode = null;
  for (let i = strips - 1; i >= 0; i--)
    chain = (
      <div
        key={i}
        ref={bind(i)}
        className={`strip${i === strips - 1 ? ' edge' : ''}`}
        style={{ '--i': i } as CSSProperties}
      >
        <div className="face front">
          <div
            className={`face-page as-${frontSide}${frontShot ? ' is-shot' : ''}`}
            style={
              frontShot ? { backgroundImage: `url(${frontShot})` } : undefined
            }
          >
            {frontShot ? null : (
              <PageView
                index={front}
                side={mode === 'single' ? 'right' : frontSide}
                live={false}
              />
            )}
          </div>
          <span className="sh" />
          <span className="gl" />
        </div>
        <div className="face back">
          <div
            className={`face-page as-${backSide}${backShot ? ' is-shot' : ''}`}
            style={
              backShot ? { backgroundImage: `url(${backShot})` } : undefined
            }
          >
            {back === undefined ? (
              <div className="sb-page is-left sb-verso" />
            ) : backShot ? null : (
              <PageView index={back} side={backSide} live={false} />
            )}
          </div>
          <span className="sh" />
          <span className="gl" />
        </div>
        {chain}
      </div>
    );
  return (
    <div
      className={`curl ${cls}`}
      data-shot={shotFaces ? 'on' : undefined}
      aria-hidden="true"
    >
      {chain}
    </div>
  );
}

type Phase = 'shut' | 'opening' | 'open';

function pageWidth(bookEl: HTMLElement | null, mode: Mode): number {
  const w = bookEl?.clientWidth ?? 0;
  return mode === 'spread' ? w / 2 : w;
}

function shotsForLeaf(
  mode: Mode,
  turn: Turn,
  bookEl: HTMLElement | null,
): { front?: string; back?: string } {
  const leaf = leafOf(mode, turn);
  const width = pageWidth(bookEl, mode);
  const take = (index: number) =>
    getPageShot(pageShotKey(index, sideOf(mode, index), width));
  return {
    front: take(leaf.front),
    back: leaf.back === undefined ? undefined : take(leaf.back),
  };
}

/** The front cover, bent with the same strip curl as a page. */
function Cover({
  strips,
  bind,
}: {
  strips: number;
  bind: (i: number) => (el: HTMLDivElement | null) => void;
}) {
  let chain: ReactNode = null;
  for (let i = strips - 1; i >= 0; i--)
    chain = (
      <div
        key={i}
        ref={bind(i)}
        className={`strip${i === strips - 1 ? ' edge' : ''}`}
        style={{ '--i': i } as CSSProperties}
      >
        <div className="face front">
          <div className="sb-lid-face">
            <div className="sb-cloth">
              <LotusMark />
              <p className="sb-cloth-studio">White Lotus Labs</p>
              <p className="sb-cloth-name">Iroh&apos;s Tea Shop</p>
            </div>
          </div>
          <span className="sh" />
          <span className="gl" />
        </div>
        <div className="face back">
          <div className="sb-lid-face">
            <div className="sb-endpaper">
              <LotusMark variant="sketch" />
              <p>the seal, drawn once</p>
            </div>
          </div>
          <span className="sh" />
          <span className="gl" />
        </div>
        {chain}
      </div>
    );
  return (
    <div className="curl single" aria-hidden="true">
      {chain}
    </div>
  );
}

export function Sketchbook({ reduced }: { reduced: boolean }) {
  const [mode, setMode] = useState<Mode>('spread');
  const budget = useMotionBudget();
  const petals = usePetalCanvas();
  const [view, setView] = useState(0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [turned, setTurned] = useState(false);
  const [phase, setPhase] = useState<Phase>('open');
  const stage = useRef<HTMLDivElement>(null);
  const book = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const lid = useRef<HTMLDivElement>(null);
  const index = useRef<HTMLElement>(null);
  const strips = useRef<(HTMLDivElement | null)[]>([]);
  const lidStrips = useRef<(HTMLDivElement | null)[]>([]);
  const stripLock = useRef(FULL_STRIPS);
  const shotLock = useRef<{ front?: string; back?: string }>({});
  const [pageW, setPageW] = useState(0);
  const bakeDone = useRef(false);
  const baker = useRef<HTMLDivElement | null>(null);
  const stripsRef = useRef(FULL_STRIPS);
  const kickRef = useRef<() => void>(() => {});
  const bounds = useRef({ left: 0, top: 0, width: 0, height: 0, at: 0 });
  const progress = useRef(0);
  const openP = useRef(0);
  const spring = useRef<Spring | null>(null);
  const openSpring = useRef<Spring | null>(null);
  const drag = useRef<Drag | null>(null);
  const auto = useRef(true);
  const tilt = useRef({ rx: 0, ry: 0, tx: 0, ty: 0 });
  const live = useRef({ mode, view, turn, reduced, phase });
  live.current = { mode, view, turn, reduced, phase };

  const count =
    mode === 'spread' ? SKETCH_PAGES.length / 2 : SKETCH_PAGES.length;
  const stripCount = turn ? stripLock.current : stripsFor(budget);
  const leafShots = turn ? shotLock.current : {};
  stripsRef.current = stripCount;
  const bind = useCallback(
    (i: number) => (el: HTMLDivElement | null) => {
      strips.current[i] = el;
    },
    [],
  );
  const bindBaker = useCallback((el: HTMLDivElement | null) => {
    baker.current = el;
  }, []);
  const bindLid = useCallback(
    (i: number) => (el: HTMLDivElement | null) => {
      lidStrips.current[i] = el;
    },
    [],
  );

  const paintCover = useCallback(() => {
    const t = openP.current;
    const reveal = Math.max(0, Math.min(1, (t - 0.34) / 0.4));
    root.current?.style.setProperty('--open', t.toFixed(4));
    root.current?.style.setProperty('--reveal', reveal.toFixed(4));
    if (reveal > 0.01) root.current?.setAttribute('data-pages', 'show');
    const el = lid.current;
    if (!el) return;
    const beta = BETA * Math.sin(Math.PI * t);
    const tt = Math.PI * t + beta;
    const td = (2 * beta) / stripsRef.current;
    el.style.setProperty('--tt', `${(tt * DEG).toFixed(2)}deg`);
    el.style.setProperty('--td', `${(td * DEG).toFixed(3)}deg`);
    el.style.setProperty('--shade', Math.sin(Math.PI * t).toFixed(3));
    lidStrips.current.forEach((strip, i) => {
      if (!strip) return;
      const l1 = Math.abs(Math.cos(tt - i * td));
      const l2 = Math.abs(Math.cos(tt - (i + 1) * td));
      strip.style.setProperty('--lit', l1.toFixed(3));
      strip.style.setProperty('--a1', ((1 - l1) * 0.62).toFixed(3));
      strip.style.setProperty('--a2', ((1 - l2) * 0.62).toFixed(3));
    });
  }, []);

  const paint = useCallback(() => {
    const el = stage.current;
    const { mode, turn } = live.current;
    if (!el || !turn) return;
    const p = progress.current;
    const t = leafOf(mode, turn).reversed ? 1 - p : p;
    const beta = BETA * Math.sin(Math.PI * t);
    const tt = Math.PI * t + beta;
    const td = (2 * beta) / stripsRef.current;
    el.style.setProperty('--tt', `${(tt * DEG).toFixed(2)}deg`);
    el.style.setProperty('--td', `${(td * DEG).toFixed(3)}deg`);
    el.style.setProperty('--shade', Math.sin(Math.PI * t).toFixed(3));
    strips.current.forEach((strip, i) => {
      if (!strip) return;
      const l1 = Math.abs(Math.cos(tt - i * td));
      const l2 = Math.abs(Math.cos(tt - (i + 1) * td));
      strip.style.setProperty('--lit', l1.toFixed(3));
      strip.style.setProperty('--a1', ((1 - l1) * 0.62).toFixed(3));
      strip.style.setProperty('--a2', ((1 - l2) * 0.62).toFixed(3));
    });
  }, []);

  useLayoutEffect(() => {
    if (turn) paint();
    else stage.current?.style.setProperty('--shade', '0');
  }, [turn, mode, paint]);

  useLayoutEffect(() => {
    if (phase !== 'open') paintCover();
  }, [phase, paintCover]);

  useEffect(() => {
    const media = window.matchMedia(SINGLE_QUERY);
    const apply = () => {
      const next: Mode = media.matches ? 'single' : 'spread';
      if (next === live.current.mode) return;
      spring.current = null;
      setTurn(null);
      setView((v) => (next === 'single' ? v * 2 : Math.floor(v / 2)));
      setMode(next);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const el = book.current;
    if (!el) return;
    const size = () => {
      stage.current?.style.setProperty('--bw', `${el.clientWidth}px`);
      setPageW(pageWidth(el, live.current.mode));
      const rect = el.getBoundingClientRect();
      bounds.current = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        at: performance.now(),
      };
    };
    size();
    const observer = new ResizeObserver(size);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // One page per idle slot, so the bake never holds up the intro or a drag.
  useEffect(() => {
    const height = book.current?.clientHeight ?? 0;
    const pages = baker.current?.querySelectorAll<HTMLElement>('.sb-page');
    if (phase === 'shut' || pageW < 8 || !pages) return;
    let cancel = false;
    bakeDone.current = false;
    void (async () => {
      for (const [n, page] of [...pages].entries()) {
        const index = Number(page.dataset.index);
        const key = pageShotKey(index, sideOf(mode, index), pageW);
        if (!getPageShot(key)) {
          await idle();
          if (cancel) return;
          await bakePageShot(page, key, pageW, height, sketchPreloadUrl);
          if (cancel) return;
        }
        root.current?.setAttribute('data-bake', String(n + 1));
      }
      bakeDone.current = true;
    })();
    return () => {
      cancel = true;
    };
  }, [phase, mode, pageW]);

  const settle = useCallback(() => {
    const s = spring.current;
    if (!s) return;
    spring.current = null;
    progress.current = s.target;
    s.done();
  }, []);

  const finishOpen = useCallback(() => {
    if (live.current.phase === 'open') return;
    openSpring.current = null;
    openP.current = 1;
    live.current.phase = 'open';
    root.current?.style.setProperty('--open', '1');
    root.current?.style.setProperty('--reveal', '1');
    root.current?.setAttribute('data-pages', 'show');
    setPhase('open');
  }, []);

  const begin = useCallback(
    (dir: Dir, quiet = false, wrap = false) => {
      finishOpen();
      settle();
      const { view, mode } = live.current;
      const total =
        mode === 'spread' ? SKETCH_PAGES.length / 2 : SKETCH_PAGES.length;
      const adjacent = dir === 'next' ? view + 1 : view - 1;
      const to = wrap ? (adjacent + total) % total : adjacent;
      if (to < 0 || to >= total) return false;
      progress.current = 0;
      const budgetNow = currentMotionBudget();
      stripLock.current = stripsFor(budgetNow);
      const next = { dir, from: view, to };
      shotLock.current = shotsForLeaf(mode, next, book.current);
      live.current.turn = next;
      setTurn(next);
      if (!quiet) setTurned(true);
      return true;
    },
    [finishOpen, settle],
  );

  const release = useCallback(
    (complete: boolean, dur = 0, then?: () => void) => {
      const turn = live.current.turn;
      if (!turn) return;
      const done = () => {
        if (complete) {
          live.current.view = turn.to;
          setView(turn.to);
        }
        live.current.turn = null;
        setTurn(null);
        then?.();
      };
      if (live.current.reduced) {
        progress.current = complete ? 1 : 0;
        done();
        return;
      }
      // A light machine often misses the 60fps the spring assumes, so a slow
      // frame stretches the curl. A short wall-clock tween still finishes.
      const light = currentMotionBudget() === 'light';
      const tweenDur = dur || (light ? (complete ? 0.22 : 0.16) : 0);
      spring.current = tweenDur
        ? {
            target: dur ? 1 : complete ? 1 : 0,
            v: 0,
            k: 0,
            c: 0,
            done,
            tween: { from: progress.current, dur: tweenDur, t0: -1 },
          }
        : complete
          ? { target: 1, v: 0, k: 170, c: 26, done }
          : { target: 0, v: 0, k: 150, c: 24, done };
      kickRef.current();
    },
    [],
  );

  const step = useCallback(
    (dir: Dir) => {
      if (begin(dir)) release(true);
    },
    [begin, release],
  );

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const frameTimes: number[] = [];
    const tiltMoving = () => {
      const tl = tilt.current;
      return Math.abs(tl.tx - tl.rx) + Math.abs(tl.ty - tl.ry) > 0.001;
    };
    const working = () =>
      spring.current !== null || openSpring.current !== null || tiltMoving();
    const tick = (now: number) => {
      raf = 0;
      if (document.hidden) return;
      const raw = last === 0 ? 0.016 : (now - last) / 1000;
      const dt = Math.min(0.032, raw);
      last = now;
      const s = spring.current;
      if (s?.tween) {
        const tw = s.tween;
        if (tw.t0 < 0) tw.t0 = now;
        const k = Math.min(1, (now - tw.t0) / 1000 / tw.dur);
        progress.current = tw.from + (s.target - tw.from) * k;
        if (k >= 1) {
          spring.current = null;
          paint();
          s.done();
        } else paint();
      } else if (s) {
        s.v += (-s.k * (progress.current - s.target) - s.c * s.v) * dt;
        progress.current += s.v * dt;
        if (
          Math.abs(progress.current - s.target) < 0.002 &&
          Math.abs(s.v) < 0.02
        ) {
          spring.current = null;
          progress.current = s.target;
          paint();
          s.done();
        } else paint();
      }
      const os = openSpring.current;
      if (os) {
        os.v += (-os.k * (openP.current - os.target) - os.c * os.v) * dt;
        openP.current += os.v * dt;
        if (
          openP.current > 0.42 ||
          (Math.abs(openP.current - os.target) < 0.02 && Math.abs(os.v) < 0.15)
        ) {
          openSpring.current = null;
          openP.current = os.target;
          paintCover();
          os.done();
        } else paintCover();
      }
      const tl = tilt.current;
      const dx = tl.tx - tl.rx;
      const dy = tl.ty - tl.ry;
      if (Math.abs(dx) + Math.abs(dy) > 0.001) {
        tl.rx += dx * 0.12;
        tl.ry += dy * 0.12;
        stage.current?.style.setProperty('--rx', `${tl.rx.toFixed(2)}deg`);
        stage.current?.style.setProperty('--ry', `${tl.ry.toFixed(2)}deg`);
      }
      // A single heavy commit is normal. Latch light only when the curl
      // itself is staying under ~30fps.
      if (live.current.turn && raw > 0 && raw < 0.5) {
        frameTimes.push(raw);
        if (frameTimes.length > 8) frameTimes.shift();
        if (frameTimes.length >= 6) {
          const sorted = [...frameTimes].sort((a, b) => a - b);
          const median = sorted[Math.floor((sorted.length - 1) / 2)];
          if (median > 0.034) noteMotionBudget('light');
        }
      }
      if (raf === 0 && working()) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (raf !== 0 || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    kickRef.current = kick;
    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      if (working()) kick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      kickRef.current = () => {};
    };
  }, [paint, paintCover]);

  useEffect(() => {
    if (reduced) return;
    const lean = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || drag.current) return;
      if (currentMotionBudget() === 'light') return;
      const cached = bounds.current;
      if (!cached.width || performance.now() - cached.at > 250) {
        const rect = book.current?.getBoundingClientRect();
        if (!rect?.width) return;
        bounds.current = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          at: performance.now(),
        };
      }
      const r = bounds.current;
      const nx = Math.max(
        -1,
        Math.min(
          1,
          (event.clientX - (r.left + r.width / 2)) / (r.width * 0.62),
        ),
      );
      const ny = Math.max(
        -1,
        Math.min(
          1,
          (event.clientY - (r.top + r.height / 2)) / (r.height * 0.9),
        ),
      );
      tilt.current.tx = -ny * TILT_X;
      tilt.current.ty = nx * TILT_Y;
      kickRef.current();
    };
    const rest = () => {
      tilt.current.tx = 0;
      tilt.current.ty = 0;
      kickRef.current();
    };
    window.addEventListener('pointermove', lean, { passive: true });
    document.documentElement.addEventListener('pointerleave', rest);
    return () => {
      window.removeEventListener('pointermove', lean);
      document.documentElement.removeEventListener('pointerleave', rest);
    };
  }, [reduced]);

  // The Meng To riffle: every leaf flips forward once, fastest mid-run, and
  // the last leaf wraps the book back to the first spread. It never turns
  // back. A click, a drag, or a key stops it.
  useEffect(() => {
    if (reduced) return;
    const skip =
      '(prefers-reduced-motion: reduce), (max-width: 640px), (pointer: coarse)';
    if (window.matchMedia(skip).matches) return;
    let cancel = false;
    const el = root.current;
    const end = () => el?.removeAttribute('data-riffle');
    const shown = el?.innerHTML ?? '';
    const pictures = Promise.all(
      SKETCH_IMAGES.filter((src) => !shown.includes(src)).map((src) => {
        const img = new Image();
        img.src = sketchPreloadUrl(src);
        return img.decode().catch(() => {});
      }),
    );
    const cap = new Promise((resolve) => window.setTimeout(resolve, 2500));
    const start = window.setTimeout(async () => {
      await Promise.race([
        resolveMotionBudget(),
        new Promise((resolve) => window.setTimeout(resolve, 600)),
      ]);
      await Promise.race([pictures, cap]);
      await Promise.race([
        new Promise<void>((resolve) => {
          const tick = () => {
            if (cancel || bakeDone.current) return resolve();
            window.setTimeout(tick, 40);
          };
          tick();
        }),
        new Promise<void>((resolve) => window.setTimeout(resolve, 4000)),
      ]);
      if (cancel || !auto.current || live.current.turn) return;
      const steps =
        live.current.mode === 'spread'
          ? SKETCH_PAGES.length / 2
          : SKETCH_PAGES.length;
      let r = 0;
      const flip = () => {
        if (cancel || !auto.current || r >= steps) return end();
        const bell = Math.sin(Math.PI * (r / (steps - 1)));
        el?.setAttribute('data-riffle', bell > 0.55 ? 'fast' : 'on');
        if (!begin('next', true, true)) return end();
        r++;
        release(true, riffleDuration(bell, currentMotionBudget()), flip);
      };
      flip();
    }, 1100);
    return () => {
      cancel = true;
      window.clearTimeout(start);
      end();
    };
  }, [reduced, begin, release]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable]')) return;
      event.preventDefault();
      auto.current = false;
      step(event.key === 'ArrowRight' ? 'next' : 'prev');
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [step]);

  // Arrow keys turn pages from anywhere; a focus ring left on an old chip
  // would mark a spread that is no longer shown.
  useEffect(() => {
    const nav = index.current;
    if (nav?.contains(document.activeElement))
      nav.querySelector<HTMLElement>('[aria-current]')?.focus();
  }, [view]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || live.current.phase !== 'open') return;
    auto.current = false;
    if ((event.target as HTMLElement).closest('a, button')) return;
    const r = book.current?.getBoundingClientRect();
    if (!r) return;
    settle();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      x0: event.clientX,
      w: r.width,
      side: (event.clientX - r.left) / r.width,
      moved: 0,
      dir: null,
      vel: 0,
      at: performance.now(),
    };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.x0;
    d.moved = Math.max(d.moved, Math.abs(dx));
    if (!d.dir) {
      if (Math.abs(dx) < 6) return;
      const dir: Dir =
        live.current.mode === 'spread'
          ? d.side > 0.5
            ? 'next'
            : 'prev'
          : dx < 0
            ? 'next'
            : 'prev';
      if (!begin(dir)) {
        drag.current = null;
        return;
      }
      d.dir = dir;
    }
    const reach = d.w * (live.current.mode === 'spread' ? 0.62 : 0.85);
    const next = Math.max(
      0,
      Math.min(1, (d.dir === 'next' ? -dx : dx) / reach),
    );
    const now = performance.now();
    d.vel = (next - progress.current) / Math.max(0.001, (now - d.at) / 1000);
    d.at = now;
    progress.current = next;
    paint();
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.dir) {
      if (d.moved < 6)
        step(
          d.side > (live.current.mode === 'spread' ? 0.5 : 0.4)
            ? 'next'
            : 'prev',
        );
      return;
    }
    release(progress.current > 0.42 || d.vel > 1.1);
  };

  const leaf = turn ? leafOf(mode, turn) : null;
  const shown = view;
  const spreadTitle =
    SPREAD_TITLES[mode === 'spread' ? shown : Math.floor(shown / 2)];
  const place = `${spreadTitle}, ${mode === 'spread' ? 'spread' : 'page'} ${shown + 1} of ${count}`;
  const open = phase === 'open';
  return (
    <div
      ref={root}
      className="sb"
      data-mode={mode}
      data-open={phase}
      data-budget={budget}
    >
      <svg className="sb-defs" aria-hidden="true" focusable="false">
        <filter id="sb-blur-1">
          <feGaussianBlur stdDeviation="4 0" />
        </filter>
        <filter id="sb-blur-2">
          <feGaussianBlur stdDeviation="11 0" />
        </filter>
      </svg>
      <div className="sb-stage">
        <button
          type="button"
          className="sb-arrow is-prev"
          aria-label="Previous page"
          disabled={view === 0 && !turn}
          onClick={() => {
            auto.current = false;
            step('prev');
          }}
        >
          <svg viewBox="0 0 10 20" aria-hidden="true">
            <polyline points="8,2 2,10 8,18" />
          </svg>
        </button>
        <div
          ref={stage}
          className="sb-3d"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="sb-tilt">
            <span className="sb-cast" aria-hidden="true" />
            <div
              ref={book}
              className="sb-book"
              style={{ '--strips': stripCount } as CSSProperties}
              role="group"
              aria-roledescription="sketchbook"
              aria-label={open ? place : "Closed sketchbook, Iroh's Tea Shop"}
            >
              <span className="sb-cover" aria-hidden="true" />
              {mode === 'spread' ? (
                <>
                  <div className="sb-half is-left">
                    <PageView
                      index={leaf ? leaf.under[0] : 2 * view}
                      side="left"
                      live={open && !turn}
                    />
                    <span className="gutter-shade" aria-hidden="true" />
                  </div>
                  <div className="sb-half is-right">
                    <PageView
                      index={leaf ? leaf.under[1] : 2 * view + 1}
                      side="right"
                      live={open && !turn}
                    />
                    <span className="gutter-shade" aria-hidden="true" />
                  </div>
                </>
              ) : (
                <div className="sb-half is-right">
                  <PageView
                    index={leaf ? leaf.under[0] : view}
                    side="right"
                    live={open && !turn}
                  />
                  <span className="gutter-shade" aria-hidden="true" />
                </div>
              )}
              {phase !== 'open' && (
                <div ref={lid} className="sb-lid">
                  <span className="sb-lid-edge" aria-hidden="true" />
                  <Cover strips={stripCount} bind={bindLid} />
                </div>
              )}
              {leaf && (
                <Leaf
                  key={`${turn!.dir}-${turn!.from}-${stripCount}`}
                  cls={leaf.cls}
                  front={leaf.front}
                  back={'back' in leaf ? leaf.back : undefined}
                  mode={mode}
                  strips={stripCount}
                  frontShot={leafShots.front}
                  backShot={leafShots.back}
                  bind={bind}
                />
              )}
              <Baker mode={mode} bind={bindBaker} />
            </div>
          </div>
        </div>
        <button
          type="button"
          className="sb-arrow is-next"
          aria-label="Next page"
          disabled={view === count - 1 && !turn}
          onClick={() => {
            auto.current = false;
            step('next');
          }}
        >
          <svg viewBox="0 0 10 20" aria-hidden="true">
            <polyline points="2,2 8,10 2,18" />
          </svg>
        </button>
      </div>
      <nav ref={index} className="sb-index" aria-label="Sketchbook pages">
        {SPREAD_TITLES.map((title, i) => {
          const target = mode === 'spread' ? i : i * 2;
          const current =
            mode === 'spread' ? shown === i : Math.floor(shown / 2) === i;
          return (
            <button
              key={title}
              type="button"
              aria-current={current ? 'page' : undefined}
              onClick={() => {
                auto.current = false;
                if (current) return;
                const { view } = live.current;
                if (Math.abs(target - view) === 1)
                  step(target > view ? 'next' : 'prev');
                else {
                  settle();
                  setTurn(null);
                  setView(target);
                }
              }}
            >
              {title}
            </button>
          );
        })}
      </nav>
      {petals && (
        <PetalCanvas
          className="sb-front-petals"
          count={petalCountFor(9, budget)}
          size={1.4}
          seed={0x2c1f}
          area={NEAR_PETALS}
          reduced={reduced}
          light={budget === 'light'}
        />
      )}
      <p className={`sb-hint${turned ? ' is-gone' : ''}`} aria-hidden="true">
        <span className="on-mouse">Drag a page to turn · or use ← →</span>
        <span className="on-touch">Swipe the page to turn</span>
      </p>
    </div>
  );
}

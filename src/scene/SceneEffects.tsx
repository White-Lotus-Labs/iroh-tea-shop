import {
  startTransition,
  Suspense,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useFrame, useThree, type RootState } from '@react-three/fiber';
import {
  type Group,
  type Material,
  type Mesh,
  type Object3D,
  type ShaderMaterial,
} from 'three';
import { Atmosphere } from './props/Atmosphere';

/** Fog and shafts stay on the first frame. Reflections, AO, and bloom arrive
 *  with ScenePolish after the guest steps inside, so the entrance does not
 *  download or compile them. */
export function SceneLighting({ reduced }: { reduced: boolean }) {
  return (
    <>
      <fogExp2 attach="fog" args={['#5c3c26', 0.045]} />
      <Atmosphere reduced={reduced} />
    </>
  );
}

type Fade = {
  material: Material;
  opacity: number;
  transparent: boolean;
  forceSinglePass: boolean;
};
const FADE_SECONDS = 0.6;

function collectFades(root: Object3D) {
  const fades = new Map<Material, Fade>();
  root.traverse((object) => {
    const material = (object as Mesh).material;
    for (const m of Array.isArray(material) ? material : [material]) {
      if (!m || (m as ShaderMaterial).isShaderMaterial) continue;
      fades.set(m, {
        material: m,
        opacity: m.opacity,
        transparent: m.transparent,
        forceSinglePass: m.forceSinglePass,
      });
    }
  });
  return [...fades.values()];
}

// `transparent` is part of three's program key, and a transparent double-sided
// material draws in two passes with `side` swapped, so fading needs its own
// variants. Single-pass keeps that to one extra program per opaque recipe.
function hide(fade: Fade) {
  const m = fade.material;
  if (!fade.transparent) m.transparent = m.forceSinglePass = true;
  m.opacity = 0;
}

function show(fade: Fade) {
  const m = fade.material;
  m.opacity = fade.opacity;
  m.transparent = fade.transparent;
  m.forceSinglePass = fade.forceSinglePass;
  if (!fade.transparent) m.needsUpdate = true;
}

// A driver that never reports ready must not leave the room frozen.
const settle = (work: Promise<unknown>) =>
  Promise.race([
    work,
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]).catch(() => undefined);

/**
 * Mounts `children` one frame after the shell, in a transition so React can slice the
 * work. Its priority-1 frame slot keeps R3F from rendering until the composer (inside
 * `children`) takes over, so no program is ever built for the unused on-screen variant.
 * Once every child has resolved, with the frame loop paused, it runs `precompile` for
 * the final look and again for the fade, then fades the new detail in.
 */
export function Staged({
  children,
  reduced,
  precompile,
}: {
  children: ReactNode;
  reduced: boolean;
  precompile: (state: RootState) => Promise<unknown>;
}) {
  const [mounted, setMounted] = useState(false);
  const group = useRef<Group>(null);
  const requested = useRef(false);
  const fades = useRef<Fade[] | null>(null);
  const progress = useRef(-1);
  const get = useThree((state) => state.get);
  const compile = useRef(precompile);
  compile.current = precompile;
  const reveal = useCallback(() => {
    const list = (fades.current ??= collectFades(group.current!));
    const { setFrameloop } = get();
    setFrameloop('never');
    let live = true;
    // Deferred: Strict Mode's rehearsal unmount disposes materials, and a compile already
    // polling them would throw. The cleanup cancels the start instead.
    const start = setTimeout(async () => {
      list.forEach(show);
      await settle(compile.current(get()));
      if (!live) return;
      list.forEach(hide);
      await settle(compile.current(get()));
      if (!live) return;
      setFrameloop('always');
      progress.current = 0;
    });
    return () => {
      live = false;
      clearTimeout(start);
      setFrameloop('always');
    };
  }, [get]);
  useFrame((_, delta) => {
    if (!mounted) {
      if (!requested.current) startTransition(() => setMounted(true));
      requested.current = true;
      return;
    }
    if (progress.current < 0) return;
    const t = (progress.current = reduced
      ? 1
      : Math.min(1, progress.current + delta / FADE_SECONDS));
    const eased = t * t * (3 - 2 * t);
    for (const fade of fades.current!)
      fade.material.opacity = fade.opacity * eased;
    if (t === 1) {
      fades.current!.forEach(show);
      progress.current = -1;
    }
  }, 1);
  return (
    <Suspense fallback={null}>
      <group ref={group}>{mounted && children}</group>
      {mounted && <OnCommit run={reveal} />}
    </Suspense>
  );
}

/** Runs after its Suspense siblings commit, i.e. once every lazy child has resolved. */
function OnCommit({ run }: { run: () => () => void }) {
  useLayoutEffect(run, [run]);
  return null;
}

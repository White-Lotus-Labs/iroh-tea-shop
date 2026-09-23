import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, Sprite, SpriteMaterial } from 'three';
import { useEffect } from 'react';
import { createRandom, damp } from './motion/dynamics';
/** Nine soft billboards, no simulation engine, shadow pass, or additional loop. */
export function Steam({
  active,
  reduced,
}: {
  active: boolean;
  reduced: boolean;
}) {
  const sprites = useRef<(Sprite | null)[]>([]);
  const life = useRef({ time: 0, energy: 0 });
  const particles = useMemo(() => {
    const random = createRandom(449);
    return Array.from({ length: 9 }, () => ({
      phase: random(),
      speed: 0.13 + random() * 0.055,
      spread: 0.06 + random() * 0.08,
      size: 0.07 + random() * 0.055,
      seed: random() * 20,
    }));
  }, []);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,244,220,.7)');
    gradient.addColorStop(0.35, 'rgba(255,244,220,.28)');
    gradient.addColorStop(1, 'rgba(255,244,220,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return new CanvasTexture(canvas);
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05),
      state = life.current;
    state.energy = damp(state.energy, active ? 1 : 0, active ? 3.5 : 1.5, dt);
    if (!reduced) state.time += dt;
    particles.forEach((p, index) => {
      const sprite = sprites.current[index];
      if (!sprite) return;
      const phase = (p.phase + state.time * p.speed) % 1;
      const t = state.time + p.seed;
      sprite.position.set(
        Math.sin(t * 0.71 + phase * 5) * p.spread * phase,
        0.91 + phase * 0.6,
        -0.3 + Math.sin(t * 0.47 + phase * 3) * 0.035 * phase,
      );
      sprite.scale.setScalar(p.size * (0.7 + phase * 1.8));
      (sprite.material as SpriteMaterial).opacity = reduced
        ? 0
        : Math.sin(Math.PI * phase) ** 1.5 * (0.16 + state.energy * 0.1);
    });
  });
  return (
    <group name="tea-steam" visible={!reduced}>
      {particles.map((_, i) => (
        <sprite
          key={i}
          ref={(node) => {
            sprites.current[i] = node;
          }}
        >
          <spriteMaterial
            map={texture}
            transparent
            depthWrite={false}
            opacity={0}
            toneMapped={false}
          />
        </sprite>
      ))}
    </group>
  );
}

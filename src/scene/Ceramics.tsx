import { useMemo } from 'react';
import { Vector2 } from 'three';
import type { Point } from './stations';
import { useSurfaceMaps } from './Surfaces';
/** A continuous cross-section includes the lip and inner wall, rather than a solid cylinder. */
export function Cup({
  position,
  color = '#72775d',
}: {
  position: Point;
  color?: string;
}) {
  const profile = useMemo(
    () => [
      new Vector2(0.065, -0.066),
      new Vector2(0.073, -0.059),
      new Vector2(0.081, -0.038),
      new Vector2(0.096, 0.033),
      new Vector2(0.104, 0.063),
      new Vector2(0.103, 0.07),
      new Vector2(0.097, 0.073),
      new Vector2(0.092, 0.065),
      new Vector2(0.086, 0.026),
      new Vector2(0.067, -0.045),
      new Vector2(0.01, -0.05),
    ],
    [],
  );
  const mottle = useSurfaceMaps('paper').color;
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[profile, 40]} />
        <meshPhysicalMaterial
          color={color}
          map={mottle}
          roughness={0.36}
          clearcoat={0.85}
          clearcoatRoughness={0.08}
        />
      </mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.087, 40]} />
        <meshPhysicalMaterial
          color="#6b3510"
          roughness={0.12}
          clearcoat={1}
          clearcoatRoughness={0.02}
        />
      </mesh>
      <mesh position={[0, -0.062, 0]}>
        <cylinderGeometry args={[0.064, 0.064, 0.013, 32]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    </group>
  );
}

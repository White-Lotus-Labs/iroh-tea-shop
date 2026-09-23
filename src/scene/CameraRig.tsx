import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';
import { Vector3 } from 'three';
import type { Station } from '../shared/contracts';
import { STATIONS } from './stations';
export function CameraRig({
  station,
  reduced,
  resetKey,
  typing,
}: {
  station: Station;
  reduced: boolean;
  resetKey: number;
  typing: boolean;
}) {
  const { camera } = useThree();
  const controls = useRef<OrbitImpl>(null);
  const transition = useRef<{
    from: Vector3;
    fromTarget: Vector3;
    to: Vector3;
    target: Vector3;
    elapsed: number;
  } | null>(null);
  const angles = useRef({ azimuth: 0, polar: Math.PI / 2, distance: 3 });
  useEffect(() => {
    const anchor = STATIONS.find((s) => s.id === station)!;
    const to = new Vector3(...anchor.position),
      target = new Vector3(...anchor.target);
    const offset = to.clone().sub(target);
    angles.current = {
      azimuth: Math.atan2(offset.x, offset.z),
      polar: Math.acos(offset.y / offset.length()),
      distance: offset.length(),
    };
    transition.current = {
      from: camera.position.clone(),
      fromTarget: controls.current?.target.clone() ?? new Vector3(0, 1, -1),
      to,
      target,
      elapsed: 0,
    };
    if (controls.current) controls.current.enabled = false;
  }, [station, resetKey, camera, reduced]);
  useFrame((_, delta) => {
    const c = controls.current,
      t = transition.current;
    if (!c) return;
    const a = angles.current;
    c.minAzimuthAngle = a.azimuth - 0.16;
    c.maxAzimuthAngle = a.azimuth + 0.16;
    c.minPolarAngle = a.polar - 0.08;
    c.maxPolarAngle = a.polar + 0.08;
    c.minDistance = a.distance;
    c.maxDistance = a.distance;
    if (t && !typing) {
      t.elapsed += Math.min(delta, 0.05);
      const progress = reduced ? 1 : Math.min(1, t.elapsed / 1.2);
      const eased = progress * progress * (3 - 2 * progress);
      camera.position.lerpVectors(t.from, t.to, eased);
      c.target.lerpVectors(t.fromTarget, t.target, eased);
      camera.lookAt(c.target);
      if (progress === 1) {
        transition.current = null;
        c.update();
      }
    }
    c.enabled = !transition.current && !typing;
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableZoom={false}
      enableDamping={!reduced}
      dampingFactor={0.12}
      rotateSpeed={0.3}
      target={[0, 1, -1]}
    />
  );
}

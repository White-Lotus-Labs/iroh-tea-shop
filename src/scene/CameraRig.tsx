import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';
import { Vector3 } from 'three';
import type { Station } from '../shared/contracts';
import { STATIONS } from './stations';
import { CameraTravel, damp } from './motion/dynamics';
export function CameraRig({
  station,
  reduced,
  resetKey,
  typing,
  reading = false,
}: {
  station: Station;
  reduced: boolean;
  resetKey: number;
  typing: boolean;
  reading?: boolean;
}) {
  const { camera } = useThree();
  const controls = useRef<OrbitImpl>(null);
  const travel = useRef<CameraTravel | null>(null);
  const idle = useRef({
    time: 0,
    gain: 0,
    dragging: false,
    position: new Vector3(),
    target: new Vector3(),
  });
  const angles = useRef({ azimuth: 0, polar: Math.PI / 2, distance: 3 });
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const anchor = STATIONS.find((s) => s.id === station)!;
    const to = new Vector3(...anchor.position),
      target = new Vector3(...anchor.target),
      offset = to.clone().sub(target);
    angles.current = {
      azimuth: Math.atan2(offset.x, offset.z),
      polar: Math.acos(offset.y / offset.length()),
      distance: offset.length(),
    };
    if (!travel.current)
      travel.current = new CameraTravel(camera.position, c.target);
    // Capture the actual visible frame, including any local orbit, before retargeting.
    travel.current.position.copy(camera.position);
    travel.current.target.copy(c.target);
    travel.current.retarget(to, target);
    c.enabled = false;
    idle.current.gain = 0;
    c.enableDamping = false;
    c.update();
    camera.position.copy(travel.current.position);
    c.target.copy(travel.current.target);
  }, [station, resetKey, camera]);
  // drei updates orbit at priority -1. Remove last frame's decorative offsets first,
  // then apply this frame's offsets after orbit, so drift never accumulates.
  useFrame(() => {
    const c = controls.current;
    if (!c) return;
    camera.position.sub(idle.current.position);
    c.target.sub(idle.current.target);
    idle.current.position.set(0, 0, 0);
    idle.current.target.set(0, 0, 0);
  }, -2);
  useFrame((_, delta) => {
    const c = controls.current,
      t = travel.current;
    if (!c || !t) return;
    const dt = Math.min(delta, 0.05),
      a = angles.current,
      i = idle.current;
    if (t.active) {
      if (reduced) t.finish();
      else if (!typing && !reading) t.step(dt);
      camera.position.copy(t.position);
      c.target.copy(t.target);
      if (!t.active) {
        c.minAzimuthAngle = a.azimuth - 0.16;
        c.maxAzimuthAngle = a.azimuth + 0.16;
        c.minPolarAngle = a.polar - 0.08;
        c.maxPolarAngle = a.polar + 0.08;
        c.minDistance = a.distance;
        c.maxDistance = a.distance;
        // Clear residual orbit damping so a drag cannot kick the new station frame.
        c.enableDamping = false;
        c.update();
        c.enableDamping = !reduced;
      }
    } else if (!reduced && !typing && !reading) {
      i.time += dt;
      i.gain = damp(i.gain, i.dragging ? 0 : 1, 3, dt);
      const g = i.gain;
      i.position.set(
        Math.sin(i.time * 0.43) * 0.0012 * g,
        Math.sin(i.time * 0.91) * 0.002 * g,
        0,
      );
      i.target.set(
        Math.sin(i.time * 0.37 + 1) * 0.0008 * g,
        Math.sin(i.time * 0.67) * 0.0007 * g,
        0,
      );
      camera.position.add(i.position);
      c.target.add(i.target);
    }
    c.enabled = !t.active && !typing && !reading;
    camera.lookAt(c.target);
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableZoom={false}
      enableDamping={!reduced}
      dampingFactor={0.14}
      rotateSpeed={0.3}
      onStart={() => {
        idle.current.dragging = true;
      }}
      onEnd={() => {
        idle.current.dragging = false;
      }}
      target={[0, 1, -1]}
    />
  );
}

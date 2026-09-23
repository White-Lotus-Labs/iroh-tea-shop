import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import type { Station } from '../shared/contracts';
import { STATIONS } from './stations';
import {
  blinkClosure,
  createRandom,
  damp,
  nextBlinkDelay,
  type SceneMood,
} from './motion/dynamics';
export function TeaHost({
  station,
  mood,
  reduced,
}: {
  station: Station;
  mood: SceneMood;
  reduced: boolean;
}) {
  const torso = useRef<Group>(null),
    head = useRef<Group>(null),
    eyes = useRef<Group>(null),
    hands = useRef<Group>(null);
  const state = useMemo(
    () => ({
      time: 0,
      cueAt: 0,
      blinkAt: 4.1,
      nextBlink: 4.1,
      double: false,
      nextGaze: 7.8,
      nextPosture: 12.3,
      yaw: 0,
      pitch: 0,
      posture: 0,
      rng: createRandom(7183),
    }),
    [],
  );
  useEffect(() => {
    state.cueAt = state.time;
  }, [station, mood, state]);
  useFrame((_, delta) => {
    if (!head.current || !torso.current || !eyes.current || !hands.current)
      return;
    const dt = Math.min(delta, 0.05);
    if (reduced) {
      head.current.rotation.set(0, 0, 0);
      torso.current.rotation.set(0, 0, 0);
      torso.current.scale.y = 1;
      hands.current.position.y = 0;
      eyes.current.scale.y = 1;
      return;
    }
    state.time += dt;
    const t = state.time,
      age = t - state.cueAt;
    if (t >= state.nextGaze) {
      state.yaw = (state.rng() - 0.5) * 0.055;
      state.pitch = (state.rng() - 0.5) * 0.025;
      state.nextGaze = t + 7 + state.rng() * 9;
    }
    if (t >= state.nextPosture) {
      state.posture = (state.rng() - 0.5) * 0.017;
      state.nextPosture = t + 11 + state.rng() * 12;
    }
    if (t >= state.nextBlink) {
      state.blinkAt = t;
      if (!state.double && state.rng() < 0.16) {
        state.double = true;
        state.nextBlink = t + 0.38;
      } else {
        state.double = false;
        state.nextBlink = t + nextBlinkDelay(state.rng);
      }
    }
    eyes.current.scale.y = 1 - 0.96 * blinkClosure(t - state.blinkAt);
    const anchor = STATIONS.find((s) => s.id === station)!;
    const guestYaw = Math.max(
      -0.28,
      Math.min(
        0.18,
        Math.atan2(anchor.position[0] - 2, anchor.position[2] + 0.8),
      ),
    );
    const pour = mood === 'pouring';
    // Attention changes only on a station/workflow event, never by tracking orbit.
    const nod =
      (station === 'AvatarSeat'
        ? 0.028
        : mood === 'challenged'
          ? 0.022
          : 0.009) * Math.exp(-(((age - 0.65) / 0.42) ** 2));
    head.current.rotation.y = damp(
      head.current.rotation.y,
      (pour ? -0.31 : guestYaw * 0.5) + state.yaw,
      2.5,
      dt,
    );
    head.current.rotation.x = damp(
      head.current.rotation.x,
      (pour ? 0.09 : 0) + state.pitch + nod,
      3.2,
      dt,
    );
    head.current.rotation.z = damp(
      head.current.rotation.z,
      (mood === 'challenged' && age < 2 ? 0.016 : 0) + state.posture * 0.5,
      2,
      dt,
    );
    const breathing =
      (Math.sin(t * 0.99) + 0.18 * Math.sin(t * 0.41 + 1.7)) * 0.0035;
    const pause = mood === 'challenged' && age < 1.2 ? 0.45 : 1;
    torso.current.scale.y = 1 + breathing * pause;
    torso.current.rotation.z = damp(
      torso.current.rotation.z,
      state.posture,
      1.2,
      dt,
    );
    hands.current.position.y = Math.sin(t * 0.79 + 0.9) * 0.0018;
  });
  return (
    <group position={[2, 0, -0.8]} name="tea-host">
      <mesh position={[0, 0.17, 0]} scale={[0.8, 0.2, 0.65]}>
        <sphereGeometry args={[1, 24, 12]} />
        <meshStandardMaterial color="#697558" roughness={1} />
      </mesh>
      <group ref={torso} position={[0, 0.22, 0]}>
        <mesh position={[0, 0.43, 0]}>
          <coneGeometry args={[0.47, 1, 24]} />
          <meshStandardMaterial color="#706346" roughness={1} />
        </mesh>
        <group ref={head} position={[0, 0.9, 0]}>
          <mesh position={[0, 0.17, 0]}>
            <sphereGeometry args={[0.25, 24, 16]} />
            <meshStandardMaterial color="#d8af86" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.27, -0.06]} scale={[1, 1, 0.9]}>
            <sphereGeometry args={[0.25, 20, 12]} />
            <meshStandardMaterial color="#ded4bd" roughness={1} />
          </mesh>
          <mesh position={[0, 0.18, 0.105]} scale={[1, 0.9, 0.65]}>
            <sphereGeometry args={[0.215, 20, 12]} />
            <meshStandardMaterial color="#d8af86" roughness={1} />
          </mesh>
          <mesh position={[0, -0.02, 0.18]} rotation={[0.12, 0, Math.PI]}>
            <coneGeometry args={[0.16, 0.29, 20]} />
            <meshStandardMaterial color="#ded4bd" roughness={1} />
          </mesh>
          <group ref={eyes} position={[0, 0.2, 0.24]}>
            {[-1, 1].map((side) => (
              <mesh
                key={side}
                position={[side * 0.075, 0, 0]}
                scale={[1, 0.3, 0.5]}
              >
                <sphereGeometry args={[0.023, 12, 8]} />
                <meshStandardMaterial color="#413728" />
              </mesh>
            ))}
          </group>
        </group>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * 0.29, 0.54, 0.16]}
            rotation={[0, 0, side * 0.5]}
          >
            <capsuleGeometry args={[0.12, 0.36, 6, 12]} />
            <meshStandardMaterial color="#706346" roughness={1} />
          </mesh>
        ))}
        <group ref={hands}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.22, 0.38, 0.3]}>
              <sphereGeometry args={[0.105, 16, 10]} />
              <meshStandardMaterial color="#d8af86" roughness={1} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

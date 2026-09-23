import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Quaternion,
  Vector3,
} from 'three';
import { damp, pourPose, type SceneMood } from './motion/dynamics';
import { Steam } from './Steam';
/** A short ceremonial tip rotates about the teapot's foot rim, keeping its
 * support point on the table. Completion/cancellation never delays the result. */
export function TeaRitual({
  mood,
  reduced,
  requestKey,
}: {
  mood: SceneMood;
  reduced: boolean;
  requestKey: string | null;
}) {
  const pot = useRef<Group>(null),
    stream = useRef<Mesh>(null),
    ceramic = useRef<MeshStandardMaterial>(null);
  const motion = useRef({ age: 2, tilt: 0, stream: 0, active: false });
  const points = useRef({
    spout: new Vector3(),
    unit: new Vector3(),
    cup: new Vector3(0.4, 0.75, -0.12),
    direction: new Vector3(),
    up: new Vector3(0, 1, 0),
    rotation: new Quaternion(),
  });
  useEffect(() => {
    if (mood === 'pouring') {
      motion.current.age = 0;
      motion.current.active = true;
    } else motion.current.active = false;
  }, [mood, requestKey]);
  useFrame((_, delta) => {
    const m = motion.current,
      dt = Math.min(delta, 0.05);
    m.age += dt;
    const pose =
      m.active && !reduced ? pourPose(m.age) : { tilt: 0, stream: 0 };
    // A faster critically damped recovery handles early result/error/cancellation.
    m.tilt = damp(m.tilt, pose.tilt, 18, dt);
    m.stream = damp(m.stream, pose.stream, 22, dt);
    if (reduced) {
      m.tilt = 0;
      m.stream = 0;
    }
    if (pot.current) pot.current.rotation.z = -m.tilt;
    if (ceramic.current)
      ceramic.current.emissiveIntensity = damp(
        ceramic.current.emissiveIntensity,
        mood === 'pouring' ? 0.13 : 0.025,
        4,
        dt,
      );
    if (stream.current && pot.current) {
      const p = points.current;
      p.spout.set(0.156, 0.303, 0);
      pot.current.localToWorld(p.spout);
      p.direction.copy(p.cup).sub(p.spout);
      stream.current.position.copy(p.spout).addScaledVector(p.direction, 0.5);
      stream.current.quaternion.copy(
        p.rotation.setFromUnitVectors(
          p.up,
          p.unit.copy(p.direction).normalize(),
        ),
      );
      stream.current.scale.set(m.stream, p.direction.length(), m.stream);
      stream.current.visible = m.stream > 0.03 && !reduced;
    }
  });
  return (
    <>
      <group position={[0, 0.61, -0.3]} rotation={[0, -0.423, 0]}>
        <group ref={pot} position={[0.13, 0, 0]} name="pouring-teapot">
          <group position={[-0.13, 0.15, 0]}>
            <mesh position={[0, -0.13, 0]}>
              <cylinderGeometry args={[0.13, 0.13, 0.04, 24]} />
              <meshStandardMaterial color="#626a48" roughness={0.8} />
            </mesh>
            <mesh scale={[1, 0.8, 1]}>
              <sphereGeometry args={[0.19, 24, 16]} />
              <meshStandardMaterial
                ref={ceramic}
                color="#626a48"
                emissive="#b07839"
                emissiveIntensity={0.025}
                roughness={0.7}
              />
            </mesh>
            <mesh position={[0, 0.18, 0]}>
              <sphereGeometry args={[0.045, 12, 8]} />
              <meshStandardMaterial color="#626a48" />
            </mesh>
            <mesh position={[0.2, 0.07, 0]} rotation={[0, 0, -0.8]}>
              <coneGeometry args={[0.065, 0.24, 16]} />
              <meshStandardMaterial color="#626a48" />
            </mesh>
            <mesh position={[-0.18, 0.03, 0]}>
              <torusGeometry args={[0.105, 0.022, 8, 20]} />
              <meshStandardMaterial color="#626a48" roughness={0.7} />
            </mesh>
          </group>
        </group>
      </group>
      <mesh ref={stream} visible={false}>
        <cylinderGeometry args={[0.008, 0.006, 1, 8]} />
        <meshBasicMaterial
          color="#c49a51"
          transparent
          opacity={0.65}
          depthWrite={false}
        />
      </mesh>
      <Steam active={mood === 'pouring'} reduced={reduced} />
    </>
  );
}
export function LanternLight({
  mood,
  reduced,
}: {
  mood: SceneMood;
  reduced: boolean;
}) {
  const light = useRef<PointLight>(null),
    motion = useRef({ time: 0, warmth: 0 });
  useFrame((_, delta) => {
    const m = motion.current,
      dt = Math.min(delta, 0.05);
    m.time += reduced ? 0 : dt;
    m.warmth = damp(
      m.warmth,
      mood === 'pouring' ? 1 : mood === 'card' ? 0.3 : 0,
      2,
      dt,
    );
    if (light.current)
      light.current.intensity =
        15 +
        m.warmth * 0.65 +
        (reduced
          ? 0
          : Math.sin(m.time * 0.73) * 0.07 +
            Math.sin(m.time * 0.29 + 2) * 0.035);
  });
  return (
    <pointLight
      ref={light}
      position={[2.6, 2.7, -1.8]}
      intensity={15}
      distance={7}
      color="#ffc36d"
    />
  );
}
export function ShelfPlacement({
  active,
  reduced,
  children,
}: {
  active: boolean;
  reduced: boolean;
  children: React.ReactNode;
}) {
  const group = useRef<Group>(null),
    amount = useRef(active ? 0 : 1);
  useEffect(() => {
    if (active) amount.current = 0;
  }, [active]);
  useFrame((_, delta) => {
    amount.current = reduced
      ? 1
      : damp(amount.current, 1, 13, Math.min(delta, 0.05));
    if (group.current) {
      group.current.position.y = active ? -0.025 * (1 - amount.current) : 0;
      group.current.position.z = active ? 0.025 * (1 - amount.current) : 0;
      group.current.rotation.x = active ? -0.035 * (1 - amount.current) : 0;
    }
  });
  return (
    <group position={[2.65, 2.26, -2.54]}>
      <group ref={group}>{children}</group>
    </group>
  );
}

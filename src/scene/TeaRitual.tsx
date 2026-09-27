import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Quaternion,
  Vector3,
  CatmullRomCurve3,
} from 'three';
import { ContactShadows } from '@react-three/drei';
import { damp, pourPose, type SceneMood } from './motion/dynamics';
import { Steam } from './Steam';
import { PaperLantern } from './TeaArchitecture';
import { useSurfaceMaps } from './Surfaces';
import type { Point } from './stations';

const STEAM: {
  origin: Point;
  count: number;
  strength: number;
  rise: number;
}[] = [
  { origin: [0, 0.93, -2.48], count: 10, strength: 0.85, rise: 0.56 },
  { origin: [0.33, 0.91, -2.33], count: 6, strength: 0.55, rise: 0.4 },
  { origin: [-0.58, 0.72, -2.18], count: 8, strength: 0.7, rise: 0.46 },
  { origin: [0.58, 0.72, -2.34], count: 8, strength: 0.7, rise: 0.46 },
];
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
  const glaze = {
    map: useSurfaceMaps('paper').color,
    roughness: 0.34,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
  };
  const motion = useRef({ age: 2, tilt: 0, stream: 0, active: false });
  const points = useRef({
    spout: new Vector3(),
    unit: new Vector3(),
    cup: new Vector3(0.58, 0.75, -2.34),
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
      p.spout.set(0.23, 0.308, 0);
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
      <group position={[0, 0.6, -2.48]} rotation={[0, -0.423, 0]}>
        <group ref={pot} position={[0.13, 0, 0]} name="pouring-teapot">
          <group position={[-0.13, 0.15, 0]}>
            <mesh position={[0, -0.12, 0]} castShadow>
              <cylinderGeometry args={[0.125, 0.12, 0.035, 32]} />
              <meshPhysicalMaterial color="#424a32" {...glaze} />
            </mesh>
            <mesh scale={[1.2, 0.78, 1.1]} castShadow receiveShadow>
              <sphereGeometry args={[0.19, 40, 24]} />
              <meshPhysicalMaterial
                ref={ceramic}
                color="#475235"
                emissive="#b07839"
                emissiveIntensity={0.025}
                {...glaze}
              />
            </mesh>
            <mesh position={[0, 0.137, 0]} castShadow>
              <cylinderGeometry args={[0.11, 0.12, 0.026, 32]} />
              <meshPhysicalMaterial color="#37422f" {...glaze} />
            </mesh>
            <mesh position={[0, 0.178, 0]} castShadow>
              <sphereGeometry args={[0.037, 20, 12]} />
              <meshPhysicalMaterial color="#38432f" {...glaze} />
            </mesh>
            <mesh castShadow>
              <tubeGeometry
                args={[
                  new CatmullRomCurve3([
                    new Vector3(0.16, 0.05, 0),
                    new Vector3(0.25, 0.05, 0),
                    new Vector3(0.31, 0.105, 0),
                    new Vector3(0.36, 0.158, 0),
                  ]),
                  20,
                  0.035,
                  10,
                  false,
                ]}
              />
              <meshPhysicalMaterial color="#475235" {...glaze} />
            </mesh>
            <mesh position={[-0.195, 0.012, 0]} castShadow>
              <torusGeometry args={[0.108, 0.026, 12, 28]} />
              <meshPhysicalMaterial color="#465038" {...glaze} />
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
      {STEAM.map((source) => (
        <Steam
          key={source.origin.join()}
          {...source}
          active={mood === 'pouring'}
          reduced={reduced}
        />
      ))}
      <ContactShadows
        position={[0, 0.6135, -2.41]}
        scale={[2.5, 1.3]}
        far={0.32}
        blur={1.4}
        opacity={0.75}
        resolution={512}
        frames={reduced ? 1 : Infinity}
        color="#140b06"
      />
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
        6.5 +
        m.warmth * 0.65 +
        (reduced
          ? 0
          : Math.sin(m.time * 0.73) * 0.07 +
            Math.sin(m.time * 0.29 + 2) * 0.035);
  });
  return (
    <group position={[2.35, 2.72, -3.15]}>
      <PaperLantern position={[0, 0, 0]} drop={0.78} radius={0.15} />
      <pointLight ref={light} intensity={6.5} distance={7} color="#ffc36d" />
    </group>
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
    <group position={[2.96, 1.51, -3.96]} rotation={[0, -Math.PI / 2, 0]}>
      <group ref={group} visible={active}>
        {children}
      </group>
    </group>
  );
}

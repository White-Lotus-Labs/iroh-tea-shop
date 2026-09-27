import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { ContactShadows } from '@react-three/drei';
import { damp } from './motion/dynamics';
import type { Point } from './stations';
import { useSurfaceMaps } from './Surfaces';
import { merge, paint, place, useBuilt } from './props/craft';

const POSITION: Point = [-2.85, 0, -3.15];
const SCALE = 1.55;
/** Height of the pedestal on the tripod floor stand. */
const STAND_Y = 0.38;
/** The sun sits at this height in the pedestal frame. */
const SUN_Y = 0.329;

const BRASS = '#d9b36e';
const BRONZE = '#6a4a2c';
/** Quarter turn about x: lays a torus or ring flat around the vertical axis. */
const FLAT: Point = [Math.PI / 2, 0, 0];
const ACROSS: Point = [0, 0, Math.PI / 2];

/** A gear: a solid disc with its perimeter teeth, as one geometry. */
function cogGeometry(radius: number, teeth: number, thickness: number) {
  const toothDepth = 0.007,
    toothWidth = 0.005;
  return merge([
    new CylinderGeometry(radius, radius, thickness, Math.max(24, teeth)),
    ...Array.from({ length: teeth }, (_, i) => {
      const angle = (i / teeth) * Math.PI * 2,
        r = radius + toothDepth * 0.25;
      return place(
        new BoxGeometry(toothWidth, thickness, toothDepth),
        [Math.cos(angle) * r, 0, Math.sin(angle) * r],
        [0, -angle, 0],
      );
    }),
  ]);
}

function Cog({
  radius,
  teeth,
  thickness,
  color,
}: {
  radius: number;
  teeth: number;
  thickness: number;
  color: string;
}) {
  const geometry = useBuilt(() => cogGeometry(radius, teeth, thickness));
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} metalness={0.85} roughness={0.28} />
    </mesh>
  );
}

type Arm = {
  collar: number;
  rod: [radius: number, length: number];
  weight: [x: number, radius: number];
  riser: [radius: number, length: number];
};
/** Collar, cranked rod, counterweight and riser of one planet arm, in the arm's frame. */
function armParts({ collar, rod, weight, riser }: Arm) {
  return [
    paint(new CylinderGeometry(collar, collar, 0.012, 20), BRASS),
    paint(
      place(
        new CylinderGeometry(rod[0], rod[0], rod[1], 8),
        [rod[1] / 2, 0, 0],
        ACROSS,
      ),
      BRASS,
    ),
    paint(
      place(new SphereGeometry(weight[1], 12, 10), [weight[0], 0, 0]),
      BRONZE,
    ),
    paint(
      place(new CylinderGeometry(riser[0], riser[0], riser[1], 8), [
        rod[1],
        riser[1] / 2,
        0,
      ]),
      BRASS,
    ),
  ];
}

const ARMS = {
  mercury: {
    collar: 0.021,
    rod: [0.0018, 0.068],
    weight: [-0.022, 0.0055],
    riser: [0.0016, 0.032],
  },
  venus: {
    collar: 0.0205,
    rod: [0.002, 0.104],
    weight: [-0.026, 0.0065],
    riser: [0.0018, 0.044],
  },
  earth: {
    collar: 0.02,
    rod: [0.0022, 0.148],
    weight: [-0.032, 0.0075],
    riser: [0.002, 0.05],
  },
  mars: {
    collar: 0.0195,
    rod: [0.0022, 0.194],
    weight: [-0.038, 0.008],
    riser: [0.0018, 0.048],
  },
  jupiter: {
    collar: 0.019,
    rod: [0.0025, 0.244],
    weight: [-0.046, 0.0095],
    riser: [0.0022, 0.052],
  },
  saturn: {
    collar: 0.0185,
    rod: [0.0026, 0.298],
    weight: [-0.052, 0.0105],
    riser: [0.0024, 0.056],
  },
} satisfies Record<string, Arm>;

/**
 * Every static part in the pedestal frame, merged by material: brass and bronze share one
 * vertex-coloured metal mesh. Moving parts get one metal mesh per rotating group.
 */
function buildOrrery() {
  const metal: BufferGeometry[] = [],
    gold: BufferGeometry[] = [],
    wood: BufferGeometry[] = [],
    marks: BufferGeometry[] = [];
  const brass = (g: BufferGeometry, p: Point, r?: Point) =>
    metal.push(paint(place(g, p, r), BRASS));
  const bronze = (g: BufferGeometry, p: Point, r?: Point) =>
    metal.push(paint(place(g, p, r), BRONZE));
  const shine = (g: BufferGeometry, p: Point, r?: Point) =>
    gold.push(place(g, p, r));
  const timber = (g: BufferGeometry, p: Point) => wood.push(place(g, p));

  // Tripod floor stand, lowered from the room frame into the pedestal frame.
  const y0 = -STAND_Y;
  for (const angle of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
    const c = Math.cos(angle),
      s = Math.sin(angle);
    const leg = new CatmullRomCurve3([
      new Vector3(0, 0.24, 0),
      new Vector3(c * 0.09, 0.2, s * 0.09),
      new Vector3(c * 0.19, 0.08, s * 0.19),
      new Vector3(c * 0.23, 0.012, s * 0.23),
    ]);
    bronze(new TubeGeometry(leg, 16, 0.011, 8, false), [0, y0, 0]);
    brass(new SphereGeometry(0.016, 16, 12), [c * 0.23, y0 + 0.012, s * 0.23]);
    shine(new SphereGeometry(0.008, 12, 10), [c * 0.09, y0 + 0.2, s * 0.09]);
  }
  timber(new CylinderGeometry(0.042, 0.058, 0.18, 24), [0, y0 + 0.11, 0]);
  brass(new TorusGeometry(0.044, 0.006, 12, 24), [0, y0 + 0.2, 0], FLAT);
  timber(new CylinderGeometry(0.034, 0.042, 0.16, 24), [0, y0 + 0.28, 0]);
  brass(new CylinderGeometry(0.065, 0.038, 0.04, 24), [0, y0 + 0.36, 0]);
  shine(new TorusGeometry(0.066, 0.0055, 12, 24), [0, y0 + 0.38, 0], FLAT);

  // Bun feet, stepped plinth with inlaid trim rings, and the dial plate.
  for (const [fx, fz] of [
    [0.12, 0.12],
    [-0.12, 0.12],
    [0.12, -0.12],
    [-0.12, -0.12],
  ]) {
    bronze(new SphereGeometry(0.014, 16, 12), [fx, 0.009, fz]);
    brass(new CylinderGeometry(0.011, 0.013, 0.004, 16), [fx, 0.002, fz]);
  }
  timber(new CylinderGeometry(0.158, 0.168, 0.024, 36), [0, 0.021, 0]);
  brass(new TorusGeometry(0.155, 0.0032, 12, 36), [0, 0.033, 0], FLAT);
  timber(new CylinderGeometry(0.138, 0.146, 0.02, 36), [0, 0.043, 0]);
  brass(new TorusGeometry(0.136, 0.0028, 12, 36), [0, 0.053, 0], FLAT);
  brass(new CylinderGeometry(0.132, 0.132, 0.003, 44), [0, 0.0545, 0]);
  for (const [count, radius, size, color] of [
    [12, 0.106, [0.022, 0.0018, 0.0022], '#4a361c'],
    [24, 0.118, [0.008, 0.0012, 0.0014], '#5e4523'],
  ] as const)
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      marks.push(
        paint(
          place(
            new BoxGeometry(...size),
            [Math.cos(angle) * radius, 0.0565, Math.sin(angle) * radius],
            [0, -angle, 0],
          ),
          color,
        ),
      );
    }

  // Fluted spindle column, pinion axles and the winding key's bracket.
  brass(new CylinderGeometry(0.028, 0.042, 0.028, 20), [0, 0.07, 0]);
  shine(new TorusGeometry(0.026, 0.0035, 12, 20), [0, 0.086, 0], FLAT);
  brass(new CylinderGeometry(0.015, 0.017, 0.18, 20), [0, 0.176, 0]);
  shine(new CylinderGeometry(0.025, 0.018, 0.018, 20), [0, 0.271, 0]);
  brass(new CylinderGeometry(0.005, 0.005, 0.07, 12), [-0.076, 0.091, 0.032]);
  bronze(new SphereGeometry(0.0065, 12, 10), [-0.076, 0.128, 0.032]);
  brass(
    new CylinderGeometry(0.0045, 0.0045, 0.076, 12),
    [0.068, 0.094, -0.042],
  );
  bronze(new SphereGeometry(0.006, 12, 10), [0.068, 0.134, -0.042]);
  brass(
    new CylinderGeometry(0.012, 0.015, 0.014, 16),
    [0.144, 0.032, 0],
    ACROSS,
  );
  brass(
    new CylinderGeometry(0.0045, 0.0045, 0.024, 12),
    [0.156, 0.032, 0],
    ACROSS,
  );

  // Armillary hoops: the vertical meridian and the tilted equator with its brace.
  const tilt: Point = [0.41, 0, 0.15];
  brass(new TorusGeometry(0.26, 0.0036, 12, 54), [0, 0.24, 0]);
  brass(new TorusGeometry(0.245, 0.0032, 12, 54), [0, 0.24, 0], tilt);
  brass(new CylinderGeometry(0.002, 0.002, 0.49, 8), [0, 0.24, 0], tilt);
  shine(new ConeGeometry(0.01, 0.032, 16), [0, 0.5, 0]);
  brass(new SphereGeometry(0.006, 12, 12), [0, 0.516, 0]);
  brass(new SphereGeometry(0.008, 12, 12), [0, -0.02, 0]);

  // Sun collar and corona rays; the sun globe itself turns.
  shine(new CylinderGeometry(0.016, 0.022, 0.024, 20), [0, 0.29, 0]);
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2,
      r = 0.035;
    return new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(
          Math.cos(a) * r * 0.85,
          SUN_Y - 0.01,
          Math.sin(a) * r * 0.85,
        ),
        new Vector3(
          Math.cos(a + 0.15) * r * 1.55,
          SUN_Y + 0.022,
          Math.sin(a + 0.15) * r * 1.55,
        ),
        new Vector3(
          Math.cos(a + 0.35) * r * 0.95,
          SUN_Y - 0.005,
          Math.sin(a + 0.35) * r * 0.95,
        ),
      ]),
      12,
      0.0016,
      5,
      false,
    );
  });

  // Plaque on the plinth front; its face is lit on hover, so it stays separate.
  brass(new BoxGeometry(0.072, 0.018, 0.003), [0, 0.022, 0.166], [0.32, 0, 0]);

  // Rotating parts, each in its own group's frame.
  const gimbal: Point = [0.41, 0, 0];
  const earthAt: Point = [0.148, 0.05, 0];
  const jupiterAt: Point = [0.244, 0.052, 0];
  const parts = {
    metal: merge(metal),
    gold: merge(gold),
    wood: merge(wood),
    marks: merge(marks),
    rays: merge(rays),
    crank: merge([
      paint(place(new BoxGeometry(0.005, 0.044, 0.007), [0, 0.018, 0]), BRASS),
      paint(place(new SphereGeometry(0.005, 12, 10), [0, 0.036, 0.028]), BRASS),
    ]),
    mercury: merge(armParts(ARMS.mercury)),
    venus: merge(armParts(ARMS.venus)),
    earth: merge([
      ...armParts(ARMS.earth),
      paint(
        place(new TorusGeometry(0.021, 0.0018, 10, 28), earthAt, gimbal),
        BRASS,
      ),
      paint(
        place(new CylinderGeometry(0.0012, 0.0012, 0.046, 8), earthAt, gimbal),
        BRASS,
      ),
    ]),
    moon: merge([
      paint(new CylinderGeometry(0.006, 0.006, 0.003, 12), BRASS),
      paint(
        place(
          new CylinderGeometry(0.001, 0.001, 0.032, 6),
          [0.016, 0, 0],
          ACROSS,
        ),
        BRASS,
      ),
    ]),
    mars: merge(armParts(ARMS.mars)),
    jupiter: merge([
      ...armParts(ARMS.jupiter),
      paint(
        place(new TorusGeometry(0.023, 0.0016, 8, 28), jupiterAt, FLAT),
        BRASS,
      ),
      paint(
        place(new TorusGeometry(0.034, 0.0008, 6, 28), jupiterAt, [
          Math.PI / 2 + 0.2,
          0,
          0,
        ]),
        BRASS,
      ),
      paint(
        place(new SphereGeometry(0.0028, 10, 8), [
          jupiterAt[0] - 0.025,
          jupiterAt[1] - 0.005,
          0.022,
        ]),
        BRASS,
      ),
    ]),
    saturn: merge(armParts(ARMS.saturn)),
    saturnRings: merge([
      paint(
        place(
          new RingGeometry(0.025, 0.044, 36),
          [0, 0, 0],
          [-Math.PI / 2, 0, 0],
        ),
        '#c7a456',
      ),
      paint(
        place(
          new RingGeometry(0.046, 0.048, 36),
          [0, 0, 0],
          [-Math.PI / 2, 0, 0],
        ),
        '#ecd28d',
      ),
    ]),
  };
  return {
    ...parts,
    dispose() {
      Object.values(parts).forEach((geometry) => geometry.dispose());
    },
  };
}

/** The sun's glow, mounted with the room's lights so the light count never changes. */
export function OrreryLight() {
  return (
    <pointLight
      position={[POSITION[0], (STAND_Y + SUN_Y) * SCALE, POSITION[2]]}
      color="#ffdf94"
      intensity={1.35}
      distance={1.85}
      decay={2}
    />
  );
}

/**
 * A museum-grade mechanical planetary system (orrery) on a tripod floor stand, for Uncle
 * Iroh's tea room. Clicking winds it up; the arms, gears, crank and globes keep turning.
 */
export function MechanicalPlanetarySystem({
  reduced = false,
}: {
  reduced?: boolean;
}) {
  const speedRef = useRef(1);
  const [hovered, setHovered] = useState(false);

  const crankRef = useRef<Group>(null);
  const driveGearRef = useRef<Group>(null);
  const pinion1Ref = useRef<Group>(null);
  const pinion2Ref = useRef<Group>(null);
  const intermediateGearRef = useRef<Group>(null);
  const mercuryArmRef = useRef<Group>(null);
  const venusArmRef = useRef<Group>(null);
  const earthArmRef = useRef<Group>(null);
  const earthGlobeRef = useRef<Mesh>(null);
  const moonSubArmRef = useRef<Group>(null);
  const marsArmRef = useRef<Group>(null);
  const jupiterArmRef = useRef<Group>(null);
  const saturnArmRef = useRef<Group>(null);
  const saturnGlobeRef = useRef<Group>(null);
  const sunGlobeRef = useRef<Mesh>(null);

  const angles = useRef({
    mercury: 0.8,
    venus: 2.1,
    earth: 3.5,
    moon: 0.2,
    mars: 1.2,
    jupiter: 4.8,
    saturn: 0.4,
    sun: 0,
    crank: 0,
    driveGear: 0,
    pinion1: 0,
    pinion2: 0,
    earthSpin: 0,
  });

  const onWindUp = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (reduced) return;
    // Spring tension release: a burst that damps back to the nominal speed.
    speedRef.current = 4.8;
  };

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const targetSpeed = reduced ? 0.06 : 1.0;
    speedRef.current = damp(speedRef.current, targetSpeed, 1.35, dt);
    const s = speedRef.current;
    const a = angles.current;

    // Orbital angles follow astronomical ratios.
    a.mercury += dt * 1.95 * s;
    a.venus += dt * 0.98 * s;
    a.earth += dt * 0.62 * s;
    a.moon += dt * 6.8 * s;
    a.mars += dt * 0.38 * s;
    a.jupiter += dt * 0.18 * s;
    a.saturn += dt * 0.09 * s;

    a.driveGear += dt * 0.62 * s;
    a.pinion1 -= dt * 1.24 * s; // 2:1 counter-rotation
    a.pinion2 -= dt * 1.68 * s; // 2.7:1 counter-rotation
    a.crank += dt * 2.1 * s;
    a.earthSpin += dt * 2.5 * s;
    a.sun += dt * 0.15 * s;

    if (mercuryArmRef.current) mercuryArmRef.current.rotation.y = a.mercury;
    if (venusArmRef.current) venusArmRef.current.rotation.y = a.venus;
    if (earthArmRef.current) earthArmRef.current.rotation.y = a.earth;
    if (earthGlobeRef.current) earthGlobeRef.current.rotation.y = a.earthSpin;
    if (moonSubArmRef.current) moonSubArmRef.current.rotation.y = a.moon;
    if (marsArmRef.current) marsArmRef.current.rotation.y = a.mars;
    if (jupiterArmRef.current) jupiterArmRef.current.rotation.y = a.jupiter;
    if (saturnArmRef.current) saturnArmRef.current.rotation.y = a.saturn;
    if (saturnGlobeRef.current)
      saturnGlobeRef.current.rotation.y = a.saturn * 1.8;
    if (sunGlobeRef.current) sunGlobeRef.current.rotation.y = a.sun;

    if (driveGearRef.current) driveGearRef.current.rotation.y = a.driveGear;
    if (pinion1Ref.current) pinion1Ref.current.rotation.y = a.pinion1;
    if (pinion2Ref.current) pinion2Ref.current.rotation.y = a.pinion2;
    if (intermediateGearRef.current)
      intermediateGearRef.current.rotation.y = a.pinion1 * 0.75;
    if (crankRef.current) crankRef.current.rotation.z = -a.crank;
  });

  const built = useBuilt(buildOrrery);
  const wear = useSurfaceMaps('plaster').rough;
  const metalMat = useMemo(
    () =>
      new MeshStandardMaterial({
        vertexColors: true,
        metalness: 1,
        roughness: 0.45,
        roughnessMap: wear,
      }),
    [wear],
  );
  const polishedGoldMat = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: '#f2cf86',
        metalness: 1,
        roughness: 0.2,
        clearcoat: 0.4,
        clearcoatRoughness: 0.12,
      }),
    [],
  );
  const woodBaseMat = useMemo(
    () => new MeshStandardMaterial({ color: '#2b1a10', roughness: 0.7 }),
    [],
  );
  useEffect(
    () => () =>
      [metalMat, polishedGoldMat, woodBaseMat].forEach((m) => m.dispose()),
    [metalMat, polishedGoldMat, woodBaseMat],
  );
  const metal = (geometry: BufferGeometry) => (
    <mesh geometry={geometry} material={metalMat} castShadow receiveShadow />
  );

  return (
    <group
      position={POSITION}
      scale={SCALE}
      name="mechanical-planetary-system"
      onClick={onWindUp}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = '';
      }}
    >
      <ContactShadows
        position={[0, 0.004, 0]}
        scale={1}
        far={0.9}
        blur={2.2}
        opacity={0.7}
        resolution={256}
        frames={1}
        color="#140b06"
      />
      <group position={[0, STAND_Y, 0]}>
        {metal(built.metal)}
        <mesh
          geometry={built.gold}
          material={polishedGoldMat}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={built.wood}
          material={woodBaseMat}
          castShadow
          receiveShadow
        />
        <mesh geometry={built.marks}>
          <meshStandardMaterial vertexColors roughness={0.55} />
        </mesh>
        <mesh geometry={built.rays} castShadow>
          <meshStandardMaterial
            color="#f7cb4d"
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, 0.0561, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.088, 0.126, 44]} />
          <meshStandardMaterial
            color={hovered ? '#ffe58f' : '#b89035'}
            roughness={0.4}
            metalness={0.8}
            side={DoubleSide}
          />
        </mesh>
        <group position={[0, 0.022, 0.166]} rotation={[0.32, 0, 0]}>
          <mesh position={[0, 0, 0.002]}>
            <boxGeometry args={[0.066, 0.013, 0.001]} />
            <meshStandardMaterial
              color={hovered ? '#fff3c2' : '#ebd07f'}
              roughness={0.3}
              metalness={0.7}
            />
          </mesh>
        </group>

        {/* Clockwork train */}
        <group ref={driveGearRef} position={[0, 0.088, 0]}>
          <Cog radius={0.062} teeth={28} thickness={0.0055} color="#d9b243" />
        </group>
        <group ref={pinion1Ref} position={[-0.076, 0.088, 0.032]}>
          <Cog radius={0.026} teeth={14} thickness={0.005} color="#b88f32" />
        </group>
        <group ref={pinion2Ref} position={[0.068, 0.088, -0.042]}>
          <Cog radius={0.021} teeth={11} thickness={0.0048} color="#c99b36" />
        </group>
        <group ref={intermediateGearRef} position={[0, 0.104, 0]}>
          <Cog radius={0.044} teeth={20} thickness={0.0045} color="#cf9f3b" />
        </group>
        <group ref={crankRef} position={[0.168, 0.032, 0]}>
          {metal(built.crank)}
          <mesh castShadow material={polishedGoldMat}>
            <sphereGeometry args={[0.007, 12, 12]} />
          </mesh>
          <mesh
            position={[0, 0.036, 0.014]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
            material={woodBaseMat}
          >
            <cylinderGeometry args={[0.0055, 0.0075, 0.026, 12]} />
          </mesh>
        </group>

        <mesh
          ref={sunGlobeRef}
          position={[0, SUN_Y, 0]}
          castShadow
          receiveShadow
          material={polishedGoldMat}
        >
          <sphereGeometry args={[0.035, 32, 24]} />
        </mesh>

        {/* Planet arms */}
        <group ref={mercuryArmRef} position={[0, 0.138, 0]}>
          {metal(built.mercury)}
          <mesh position={[0.068, 0.032, 0]} castShadow receiveShadow>
            <sphereGeometry args={[0.0075, 16, 12]} />
            <meshStandardMaterial
              color="#7a7268"
              roughness={0.58}
              metalness={0.4}
            />
          </mesh>
        </group>
        <group ref={venusArmRef} position={[0, 0.16, 0]}>
          {metal(built.venus)}
          <mesh position={[0.104, 0.044, 0]} castShadow receiveShadow>
            <sphereGeometry args={[0.012, 20, 16]} />
            <meshPhysicalMaterial
              color="#edd19a"
              roughness={0.24}
              metalness={0.18}
              clearcoat={0.5}
              clearcoatRoughness={0.2}
            />
          </mesh>
        </group>
        <group ref={earthArmRef} position={[0, 0.184, 0]}>
          {metal(built.earth)}
          <group position={[0.148, 0.05, 0]}>
            <mesh
              ref={earthGlobeRef}
              rotation={[0.41, 0, 0]}
              castShadow
              receiveShadow
            >
              <sphereGeometry args={[0.0145, 24, 18]} />
              <meshStandardMaterial
                color="#286991"
                roughness={0.38}
                metalness={0.12}
              />
            </mesh>
            <group ref={moonSubArmRef} position={[0, -0.006, 0]}>
              {metal(built.moon)}
              <mesh position={[0.032, 0.006, 0]} castShadow receiveShadow>
                <sphereGeometry args={[0.0048, 14, 10]} />
                <meshStandardMaterial
                  color="#e5e4de"
                  roughness={0.52}
                  metalness={0.1}
                />
              </mesh>
            </group>
          </group>
        </group>
        <group ref={marsArmRef} position={[0, 0.208, 0]}>
          {metal(built.mars)}
          <mesh position={[0.194, 0.048, 0]} castShadow receiveShadow>
            <sphereGeometry args={[0.0105, 18, 14]} />
            <meshStandardMaterial
              color="#b54829"
              roughness={0.5}
              metalness={0.15}
            />
          </mesh>
        </group>
        <group ref={jupiterArmRef} position={[0, 0.232, 0]}>
          {metal(built.jupiter)}
          <group position={[0.244, 0.052, 0]}>
            <mesh castShadow receiveShadow>
              <sphereGeometry args={[0.022, 28, 20]} />
              <meshStandardMaterial
                color="#ce9653"
                roughness={0.35}
                metalness={0.12}
              />
            </mesh>
            <mesh
              position={[0.034, 0.007, 0]}
              castShadow
              material={polishedGoldMat}
            >
              <sphereGeometry args={[0.0032, 10, 8]} />
            </mesh>
          </group>
        </group>
        <group ref={saturnArmRef} position={[0, 0.256, 0]}>
          {metal(built.saturn)}
          <group
            ref={saturnGlobeRef}
            position={[0.298, 0.056, 0]}
            rotation={[0.47, 0, 0.2]}
          >
            <mesh castShadow receiveShadow>
              <sphereGeometry args={[0.018, 24, 18]} />
              <meshStandardMaterial
                color="#e0c686"
                roughness={0.32}
                metalness={0.16}
              />
            </mesh>
            <mesh geometry={built.saturnRings} castShadow receiveShadow>
              <meshStandardMaterial
                vertexColors
                metalness={0.76}
                roughness={0.26}
                side={DoubleSide}
              />
            </mesh>
          </group>
        </group>

        {hovered && (
          <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.138, 0.146, 36]} />
            <meshBasicMaterial color="#ffe184" transparent opacity={0.65} />
          </mesh>
        )}
      </group>
    </group>
  );
}

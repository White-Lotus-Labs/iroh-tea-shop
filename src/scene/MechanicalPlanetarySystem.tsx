import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Group,
  Mesh,
  InstancedMesh,
  Object3D,
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  TorusGeometry,
  RingGeometry,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
  DoubleSide,
  Vector3,
  CatmullRomCurve3,
} from 'three';
import { ContactShadows } from '@react-three/drei';
import { damp } from './motion/dynamics';
import { useSurfaceMaps } from './Surfaces';

/**
 * A decorative gear wheel with a solid hub, radial cut-out spokes, an outer rim,
 * and instanced perimeter teeth for optimal rendering performance.
 */
function CogWheel({
  radius,
  teeth,
  thickness = 0.006,
  spokes = 4,
  toothDepth = 0.007,
  toothWidth = 0.005,
  color = '#d4af37',
  metalness = 0.85,
  roughness = 0.28,
}: {
  radius: number;
  teeth: number;
  thickness?: number;
  spokes?: number;
  toothDepth?: number;
  toothWidth?: number;
  color?: string;
  metalness?: number;
  roughness?: number;
}) {
  const instancedRef = useRef<InstancedMesh>(null);
  const toothGeo = useMemo(
    () => new BoxGeometry(toothWidth, thickness, toothDepth),
    [toothWidth, thickness, toothDepth],
  );
  const gearMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color,
        metalness,
        roughness,
      }),
    [color, metalness, roughness],
  );

  useEffect(() => {
    if (!instancedRef.current) return;
    const dummy = new Object3D();
    for (let i = 0; i < teeth; i++) {
      const angle = (i / teeth) * Math.PI * 2;
      dummy.position.set(
        Math.cos(angle) * (radius + toothDepth * 0.25),
        0,
        Math.sin(angle) * (radius + toothDepth * 0.25),
      );
      dummy.rotation.set(0, -angle, 0);
      dummy.updateMatrix();
      instancedRef.current.setMatrixAt(i, dummy.matrix);
    }
    instancedRef.current.instanceMatrix.needsUpdate = true;
  }, [teeth, radius, toothDepth]);

  useEffect(() => {
    return () => {
      toothGeo.dispose();
      gearMat.dispose();
    };
  }, [toothGeo, gearMat]);

  const hubRadius = radius * 0.26;
  const rimInnerRadius = radius * 0.82;

  return (
    <group>
      {/* Central Hub */}
      <mesh castShadow receiveShadow material={gearMat}>
        <cylinderGeometry args={[hubRadius, hubRadius, thickness, 20]} />
      </mesh>
      {/* Outer Rim */}
      <mesh castShadow receiveShadow material={gearMat}>
        <cylinderGeometry
          args={[radius, radius, thickness, Math.max(24, teeth)]}
        />
      </mesh>
      {/* Radial Spokes */}
      {Array.from({ length: spokes }).map((_, idx) => {
        const spokeAngle = (idx / spokes) * Math.PI;
        return (
          <mesh
            key={idx}
            rotation={[0, spokeAngle, 0]}
            castShadow
            material={gearMat}
          >
            <boxGeometry
              args={[rimInnerRadius * 2, thickness * 0.9, toothWidth * 1.4]}
            />
          </mesh>
        );
      })}
      {/* Perimeter Teeth */}
      <instancedMesh
        ref={instancedRef}
        args={[toothGeo, gearMat, teeth]}
        castShadow
        receiveShadow
      />
    </group>
  );
}

/**
 * Procedural solar flare arc for the Sun's coronal crown.
 */
function SolarFlare({
  angle,
  height,
  radius,
  color,
}: {
  angle: number;
  height: number;
  radius: number;
  color: string;
}) {
  const curve = useMemo(() => {
    const x0 = Math.cos(angle) * (radius * 0.85);
    const z0 = Math.sin(angle) * (radius * 0.85);
    const xMid = Math.cos(angle + 0.15) * (radius * 1.55);
    const zMid = Math.sin(angle + 0.15) * (radius * 1.55);
    const x1 = Math.cos(angle + 0.35) * (radius * 0.95);
    const z1 = Math.sin(angle + 0.35) * (radius * 0.95);
    return new CatmullRomCurve3([
      new Vector3(x0, height - 0.01, z0),
      new Vector3(xMid, height + 0.022, zMid),
      new Vector3(x1, height - 0.005, z1),
    ]);
  }, [angle, height, radius]);

  return (
    <mesh castShadow>
      <tubeGeometry args={[curve, 12, 0.0016, 5, false]} />
      <meshStandardMaterial color={color} metalness={0.9} roughness={0.2} />
    </mesh>
  );
}

/**
 * Authentic antique tripod stand and turned classical baluster column
 * for floor-standing planetary observatory models.
 */
function FloorStand({
  brassMat,
  darkBronzeMat,
  woodBaseMat,
  polishedGoldMat,
}: {
  brassMat: MeshStandardMaterial;
  darkBronzeMat: MeshStandardMaterial;
  woodBaseMat: MeshStandardMaterial;
  polishedGoldMat: MeshPhysicalMaterial;
}) {
  const legCurves = useMemo(() => {
    return [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((angle) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return {
        angle,
        footPos: [cos * 0.23, 0.012, sin * 0.23] as [number, number, number],
        curve: new CatmullRomCurve3([
          new Vector3(0, 0.24, 0),
          new Vector3(cos * 0.09, 0.2, sin * 0.09),
          new Vector3(cos * 0.19, 0.08, sin * 0.19),
          new Vector3(cos * 0.23, 0.012, sin * 0.23),
        ]),
      };
    });
  }, []);

  return (
    <group name="orrery-floor-stand">
      {/* 3 Arched Cabriole Tripod Legs */}
      {legCurves.map(({ angle, footPos, curve }, idx) => (
        <group key={idx}>
          <mesh castShadow material={darkBronzeMat}>
            <tubeGeometry args={[curve, 16, 0.011, 8, false]} />
          </mesh>
          {/* Pad Foot at Floor */}
          <mesh position={footPos} castShadow material={brassMat}>
            <sphereGeometry args={[0.016, 16, 12]} />
          </mesh>
          {/* Decorative brass knee scroll */}
          <mesh
            position={[Math.cos(angle) * 0.09, 0.2, Math.sin(angle) * 0.09]}
            castShadow
            material={polishedGoldMat}
          >
            <sphereGeometry args={[0.008, 12, 10]} />
          </mesh>
        </group>
      ))}

      {/* Central Baluster Column */}
      <mesh position={[0, 0.11, 0]} castShadow material={woodBaseMat}>
        <cylinderGeometry args={[0.042, 0.058, 0.18, 24]} />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow material={brassMat}>
        <torusGeometry args={[0.044, 0.006, 12, 24]} />
      </mesh>
      <mesh position={[0, 0.28, 0]} castShadow material={woodBaseMat}>
        <cylinderGeometry args={[0.034, 0.042, 0.16, 24]} />
      </mesh>
      <mesh position={[0, 0.36, 0]} castShadow material={brassMat}>
        <cylinderGeometry args={[0.065, 0.038, 0.04, 24]} />
      </mesh>
      <mesh position={[0, 0.38, 0]} castShadow material={polishedGoldMat}>
        <torusGeometry args={[0.066, 0.0055, 12, 24]} />
      </mesh>
    </group>
  );
}

/**
 * A museum-grade mechanical planetary system (orrery) designed for Uncle Iroh's tea room.
 * Supports both tabletop placement and grand floor-standing tripod configuration.
 */
export function MechanicalPlanetarySystem({
  position = [-2.85, 0, -3.15],
  scale = 1.55,
  reduced = false,
  floorStand = true,
}: {
  position?: [number, number, number];
  scale?: number;
  reduced?: boolean;
  floorStand?: boolean;
}) {
  // Kinetic state
  const speedRef = useRef(1);
  const [hovered, setHovered] = useState(false);
  const [windupMessage, setWindupMessage] = useState(false);

  // Animated sub-groups
  const crankRef = useRef<Group>(null);
  const driveGearRef = useRef<Group>(null);
  const pinion1Ref = useRef<Group>(null);
  const pinion2Ref = useRef<Group>(null);
  const intermediateGearRef = useRef<Group>(null);

  // Planetary arms
  const mercuryArmRef = useRef<Group>(null);
  const venusArmRef = useRef<Group>(null);
  const earthArmRef = useRef<Group>(null);
  const earthGlobeRef = useRef<Group>(null);
  const moonSubArmRef = useRef<Group>(null);
  const marsArmRef = useRef<Group>(null);
  const jupiterArmRef = useRef<Group>(null);
  const saturnArmRef = useRef<Group>(null);
  const saturnGlobeRef = useRef<Group>(null);
  const sunGlobeRef = useRef<Group>(null);

  // Rotational angles
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
    // Add rotational burst impulse (spring tension release)
    speedRef.current = 4.8;
    setWindupMessage(true);
    setTimeout(() => setWindupMessage(false), 3800);
  };

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const targetSpeed = reduced ? 0.06 : 1.0;
    // Smoothly damp speed back to nominal
    speedRef.current = damp(speedRef.current, targetSpeed, 1.35, dt);
    const s = speedRef.current;
    const a = angles.current;

    // Advance orbital angles according to astronomical ratios
    a.mercury += dt * 1.95 * s;
    a.venus += dt * 0.98 * s;
    a.earth += dt * 0.62 * s;
    a.moon += dt * 6.8 * s;
    a.mars += dt * 0.38 * s;
    a.jupiter += dt * 0.18 * s;
    a.saturn += dt * 0.09 * s;

    // Clockwork gear rotations
    a.driveGear += dt * 0.62 * s;
    a.pinion1 -= dt * 1.24 * s; // 2:1 counter-rotation
    a.pinion2 -= dt * 1.68 * s; // 2.7:1 counter-rotation
    a.crank += dt * 2.1 * s;
    a.earthSpin += dt * 2.5 * s;
    a.sun += dt * 0.15 * s;

    // Apply rotations
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

  // Reusable materials
  const wear = useSurfaceMaps('plaster').rough;
  const brassMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#d9b36e',
        metalness: 1,
        roughness: 0.42,
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

  const darkBronzeMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#6a4a2c',
        metalness: 1,
        roughness: 0.5,
        roughnessMap: wear,
      }),
    [wear],
  );

  const woodBaseMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#2b1a10',
        roughness: 0.7,
      }),
    [],
  );

  const standY = floorStand ? 0.38 : 0;

  return (
    <group
      position={position}
      scale={scale}
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
      {floorStand && (
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
      )}
      {/* Optional Antique Mahogany & Brass Tripod Floor Stand */}
      {floorStand && (
        <FloorStand
          brassMat={brassMat}
          darkBronzeMat={darkBronzeMat}
          woodBaseMat={woodBaseMat}
          polishedGoldMat={polishedGoldMat}
        />
      )}

      <group position={[0, standY, 0]}>
        {/* ============================================================== */}
        {/* 1. THE PEDESTAL BASE & STAND                                   */}
        {/* ============================================================== */}

        {/* 4 Cast-brass bun feet */}
        {[
          [0.12, 0.12],
          [-0.12, 0.12],
          [0.12, -0.12],
          [-0.12, -0.12],
        ].map(([fx, fz], idx) => (
          <group key={idx} position={[fx, 0.009, fz]}>
            <mesh castShadow receiveShadow material={darkBronzeMat}>
              <sphereGeometry args={[0.014, 16, 12]} />
            </mesh>
            <mesh position={[0, -0.007, 0]} material={brassMat}>
              <cylinderGeometry args={[0.011, 0.013, 0.004, 16]} />
            </mesh>
          </group>
        ))}

        {/* Stepped dark rosewood pedestal tiers */}
        <mesh
          position={[0, 0.021, 0]}
          castShadow
          receiveShadow
          material={woodBaseMat}
        >
          <cylinderGeometry args={[0.158, 0.168, 0.024, 36]} />
        </mesh>
        {/* Inlaid brass trim ring */}
        <mesh position={[0, 0.033, 0]} castShadow material={brassMat}>
          <torusGeometry args={[0.155, 0.0032, 12, 36]} />
        </mesh>
        {/* Second stepped plinth */}
        <mesh
          position={[0, 0.043, 0]}
          castShadow
          receiveShadow
          material={woodBaseMat}
        >
          <cylinderGeometry args={[0.138, 0.146, 0.02, 36]} />
        </mesh>
        <mesh position={[0, 0.053, 0]} castShadow material={brassMat}>
          <torusGeometry args={[0.136, 0.0028, 12, 36]} />
        </mesh>

        {/* Engraved Astrological / Zodiac Brass Dial Plate */}
        <group position={[0, 0.0545, 0]}>
          <mesh receiveShadow castShadow material={brassMat}>
            <cylinderGeometry args={[0.132, 0.132, 0.003, 44]} />
          </mesh>
          {/* Subtle engraved dial rings */}
          <mesh position={[0, 0.0016, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.088, 0.126, 44]} />
            <meshStandardMaterial
              color={hovered ? '#ffe58f' : '#b89035'}
              roughness={0.4}
              metalness={0.8}
              side={DoubleSide}
            />
          </mesh>
          {/* 12 Celestial Zodiac / Month divisions */}
          {Array.from({ length: 12 }).map((_, idx) => {
            const angle = (idx / 12) * Math.PI * 2;
            return (
              <mesh
                key={idx}
                position={[
                  Math.cos(angle) * 0.106,
                  0.002,
                  Math.sin(angle) * 0.106,
                ]}
                rotation={[0, -angle, 0]}
                castShadow
              >
                <boxGeometry args={[0.022, 0.0018, 0.0022]} />
                <meshStandardMaterial color="#4a361c" roughness={0.5} />
              </mesh>
            );
          })}
          {/* 24 Intermediate degree division notches */}
          {Array.from({ length: 24 }).map((_, idx) => {
            const angle = (idx / 24) * Math.PI * 2;
            return (
              <mesh
                key={idx}
                position={[
                  Math.cos(angle) * 0.118,
                  0.002,
                  Math.sin(angle) * 0.118,
                ]}
                rotation={[0, -angle, 0]}
              >
                <boxGeometry args={[0.008, 0.0012, 0.0014]} />
                <meshStandardMaterial color="#5e4523" roughness={0.6} />
              </mesh>
            );
          })}
        </group>

        {/* ============================================================== */}
        {/* 2. THE MECHANICAL CLOCKWORK TRAIN & GEARS                      */}
        {/* ============================================================== */}

        {/* Main Center Fluted Brass Spindle Column */}
        <group position={[0, 0.056, 0]}>
          {/* Fluted base pedestal collar */}
          <mesh position={[0, 0.014, 0]} castShadow material={brassMat}>
            <cylinderGeometry args={[0.028, 0.042, 0.028, 20]} />
          </mesh>
          {/* Turned rings */}
          <mesh position={[0, 0.03, 0]} castShadow material={polishedGoldMat}>
            <torusGeometry args={[0.026, 0.0035, 12, 20]} />
          </mesh>
          {/* Main central column */}
          <mesh position={[0, 0.12, 0]} castShadow material={brassMat}>
            <cylinderGeometry args={[0.015, 0.017, 0.18, 20]} />
          </mesh>
          {/* Upper capital collar */}
          <mesh position={[0, 0.215, 0]} castShadow material={polishedGoldMat}>
            <cylinderGeometry args={[0.025, 0.018, 0.018, 20]} />
          </mesh>
        </group>

        {/* Primary Lower Drive Gear (Driven by central mechanism) */}
        <group ref={driveGearRef} position={[0, 0.088, 0]}>
          <CogWheel
            radius={0.062}
            teeth={28}
            thickness={0.0055}
            color="#d9b243"
            spokes={4}
          />
        </group>

        {/* Meshed Secondary Pinion Gear 1 (Counter-rotates on offset brass axle) */}
        <group position={[-0.076, 0.056, 0.032]}>
          {/* Support axle post */}
          <mesh position={[0, 0.035, 0]} castShadow material={brassMat}>
            <cylinderGeometry args={[0.005, 0.005, 0.07, 12]} />
          </mesh>
          <mesh position={[0, 0.072, 0]} castShadow material={darkBronzeMat}>
            <sphereGeometry args={[0.0065, 12, 10]} />
          </mesh>
          {/* Pinion cog */}
          <group ref={pinion1Ref} position={[0, 0.032, 0]}>
            <CogWheel
              radius={0.026}
              teeth={14}
              thickness={0.005}
              color="#b88f32"
              spokes={3}
            />
          </group>
        </group>

        {/* Meshed Secondary Pinion Gear 2 (Higher ratio idler cog) */}
        <group position={[0.068, 0.056, -0.042]}>
          {/* Support axle post */}
          <mesh position={[0, 0.038, 0]} castShadow material={brassMat}>
            <cylinderGeometry args={[0.0045, 0.0045, 0.076, 12]} />
          </mesh>
          <mesh position={[0, 0.078, 0]} castShadow material={darkBronzeMat}>
            <sphereGeometry args={[0.006, 12, 10]} />
          </mesh>
          {/* Pinion cog */}
          <group ref={pinion2Ref} position={[0, 0.032, 0]}>
            <CogWheel
              radius={0.021}
              teeth={11}
              thickness={0.0048}
              color="#c99b36"
              spokes={3}
            />
          </group>
        </group>

        {/* Intermediate escapement cog tiered above the main gear */}
        <group ref={intermediateGearRef} position={[0, 0.104, 0]}>
          <CogWheel
            radius={0.044}
            teeth={20}
            thickness={0.0045}
            color="#cf9f3b"
            spokes={4}
          />
        </group>

        {/* Side Winding Key / Crank Mechanism on the Wooden Base */}
        <group position={[0.144, 0.032, 0]}>
          {/* Brass escutcheon bracket */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow material={brassMat}>
            <cylinderGeometry args={[0.012, 0.015, 0.014, 16]} />
          </mesh>
          {/* Horizontal winding spindle */}
          <mesh
            position={[0.012, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
            material={brassMat}
          >
            <cylinderGeometry args={[0.0045, 0.0045, 0.024, 12]} />
          </mesh>
          {/* Turning crank arm */}
          <group ref={crankRef} position={[0.024, 0, 0]}>
            <mesh position={[0, 0.018, 0]} castShadow material={brassMat}>
              <boxGeometry args={[0.005, 0.044, 0.007]} />
            </mesh>
            <mesh castShadow material={polishedGoldMat}>
              <sphereGeometry args={[0.007, 12, 12]} />
            </mesh>
            {/* Crank turned rosewood knob */}
            <group position={[0, 0.036, 0.014]}>
              <mesh
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
                material={woodBaseMat}
              >
                <cylinderGeometry args={[0.0055, 0.0075, 0.026, 12]} />
              </mesh>
              <mesh position={[0, 0, 0.014]} castShadow material={brassMat}>
                <sphereGeometry args={[0.005, 12, 10]} />
              </mesh>
            </group>
          </group>
        </group>

        {/* ============================================================== */}
        {/* 3. ARMILLARY CELESTIAL MERIDIAN HOOPS & GIMBALS                */}
        {/* ============================================================== */}
        <group position={[0, 0.24, 0]}>
          {/* Outer Vertical Celestial Meridian Hoop */}
          <mesh castShadow material={brassMat}>
            <torusGeometry args={[0.26, 0.0036, 12, 54]} />
          </mesh>
          {/* Tilted Celestial Equator Hoop (tilted at 23.5° obliquity of the ecliptic) */}
          <group rotation={[0.41, 0, 0.15]}>
            <mesh castShadow material={brassMat}>
              <torusGeometry args={[0.245, 0.0032, 12, 54]} />
            </mesh>
            {/* Cardinal cross braces */}
            <mesh castShadow material={brassMat}>
              <cylinderGeometry args={[0.002, 0.002, 0.49, 8]} />
            </mesh>
            <mesh rotation={[0, Math.PI / 2, 0]} castShadow material={brassMat}>
              <cylinderGeometry args={[0.002, 0.002, 0.49, 8]} />
            </mesh>
          </group>
          {/* North Celestial Pole turned brass finial */}
          <mesh position={[0, 0.26, 0]} castShadow material={polishedGoldMat}>
            <coneGeometry args={[0.01, 0.032, 16]} />
          </mesh>
          <mesh position={[0, 0.276, 0]} castShadow material={brassMat}>
            <sphereGeometry args={[0.006, 12, 12]} />
          </mesh>
          {/* South Celestial Pole support bracket */}
          <mesh position={[0, -0.26, 0]} castShadow material={brassMat}>
            <sphereGeometry args={[0.008, 12, 12]} />
          </mesh>
        </group>

        {/* ============================================================== */}
        {/* 4. THE CENTRAL SUN & SOLAR CORONA                               */}
        {/* ============================================================== */}
        <group position={[0, 0.275, 0]}>
          {/* Turned Solar Finial Pillar Collar */}
          <mesh position={[0, 0.015, 0]} castShadow material={polishedGoldMat}>
            <cylinderGeometry args={[0.016, 0.022, 0.024, 20]} />
          </mesh>
          {/* Sun Sphere with radiant warm metallic glow */}
          <mesh
            ref={sunGlobeRef}
            position={[0, 0.054, 0]}
            castShadow
            receiveShadow
            material={polishedGoldMat}
          >
            <sphereGeometry args={[0.035, 32, 24]} />
          </mesh>

          {/* Radiating Curved Brass Solar Corona Rays */}
          {Array.from({ length: 8 }).map((_, idx) => (
            <SolarFlare
              key={idx}
              angle={(idx / 8) * Math.PI * 2}
              height={0.054}
              radius={0.035}
              color="#f7cb4d"
            />
          ))}

          {/* Soft, warm celestial illumination emanating from the Sun */}
          <pointLight
            position={[0, 0.054, 0]}
            color="#ffdf94"
            intensity={1.35}
            distance={1.85}
            decay={2}
          />
        </group>

        {/* ============================================================== */}
        {/* 5. PLANETARY ARMATURES & CELESTIAL BODIES                      */}
        {/* ============================================================== */}

        {/* --- TIER 1: MERCURY --- */}
        {/* Arm Radius: 0.068m, Height: 0.138m */}
        <group ref={mercuryArmRef} position={[0, 0.138, 0]}>
          {/* Sleeve collar */}
          <mesh castShadow material={brassMat}>
            <cylinderGeometry args={[0.021, 0.021, 0.012, 20]} />
          </mesh>
          {/* Horizontal cranked rod */}
          <mesh
            position={[0.034, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
            material={brassMat}
          >
            <cylinderGeometry args={[0.0018, 0.0018, 0.068, 8]} />
          </mesh>
          {/* Counterweight */}
          <mesh position={[-0.022, 0, 0]} castShadow material={darkBronzeMat}>
            <sphereGeometry args={[0.0055, 12, 10]} />
          </mesh>
          {/* Vertical riser stem */}
          <mesh position={[0.068, 0.016, 0]} castShadow material={brassMat}>
            <cylinderGeometry args={[0.0016, 0.0016, 0.032, 8]} />
          </mesh>
          {/* Mercury Globe: Slate-burnished cratered bronze */}
          <mesh position={[0.068, 0.032, 0]} castShadow receiveShadow>
            <sphereGeometry args={[0.0075, 16, 12]} />
            <meshStandardMaterial
              color="#7a7268"
              roughness={0.58}
              metalness={0.4}
            />
          </mesh>
        </group>

        {/* --- TIER 2: VENUS --- */}
        {/* Arm Radius: 0.104m, Height: 0.160m */}
        <group ref={venusArmRef} position={[0, 0.16, 0]}>
          <mesh castShadow material={brassMat}>
            <cylinderGeometry args={[0.0205, 0.0205, 0.012, 20]} />
          </mesh>
          <mesh
            position={[0.052, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
            material={brassMat}
          >
            <cylinderGeometry args={[0.002, 0.002, 0.104, 8]} />
          </mesh>
          <mesh position={[-0.026, 0, 0]} castShadow material={darkBronzeMat}>
            <sphereGeometry args={[0.0065, 12, 10]} />
          </mesh>
          <mesh position={[0.104, 0.022, 0]} castShadow material={brassMat}>
            <cylinderGeometry args={[0.0018, 0.0018, 0.044, 8]} />
          </mesh>
          {/* Venus Globe: Luminous creamy golden-amber pearlescent */}
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

        {/* --- TIER 3: EARTH & THE MOON --- */}
        {/* Arm Radius: 0.148m, Height: 0.184m */}
        <group ref={earthArmRef} position={[0, 0.184, 0]}>
          <mesh castShadow material={brassMat}>
            <cylinderGeometry args={[0.02, 0.02, 0.012, 20]} />
          </mesh>
          <mesh
            position={[0.074, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
            material={brassMat}
          >
            <cylinderGeometry args={[0.0022, 0.0022, 0.148, 8]} />
          </mesh>
          <mesh position={[-0.032, 0, 0]} castShadow material={darkBronzeMat}>
            <sphereGeometry args={[0.0075, 12, 10]} />
          </mesh>
          <mesh position={[0.148, 0.025, 0]} castShadow material={brassMat}>
            <cylinderGeometry args={[0.002, 0.002, 0.05, 8]} />
          </mesh>

          {/* Earth Assembly mounted with 23.5° axial tilt */}
          <group position={[0.148, 0.05, 0]}>
            {/* Brass Gimbal Ring (Axial Tilt Cradle) */}
            <group rotation={[0.41, 0, 0]}>
              <mesh castShadow material={brassMat}>
                <torusGeometry args={[0.021, 0.0018, 10, 28]} />
              </mesh>
              {/* Polar Axis Spindle */}
              <mesh castShadow material={brassMat}>
                <cylinderGeometry args={[0.0012, 0.0012, 0.046, 8]} />
              </mesh>
              {/* Rotating Earth Globe: Deep lapis-lazuli azure */}
              <mesh ref={earthGlobeRef} castShadow receiveShadow>
                <sphereGeometry args={[0.0145, 24, 18]} />
                <meshStandardMaterial
                  color="#286991"
                  roughness={0.38}
                  metalness={0.12}
                />
              </mesh>
            </group>

            {/* Moon Sub-Arm: Revolves around Earth on geared satellite post */}
            <group ref={moonSubArmRef} position={[0, -0.006, 0]}>
              {/* Miniature satellite gear */}
              <mesh castShadow material={brassMat}>
                <cylinderGeometry args={[0.006, 0.006, 0.003, 12]} />
              </mesh>
              <mesh
                position={[0.016, 0, 0]}
                rotation={[0, 0, Math.PI / 2]}
                castShadow
                material={brassMat}
              >
                <cylinderGeometry args={[0.001, 0.001, 0.032, 6]} />
              </mesh>
              {/* The Moon: Silvery pearl bead */}
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

        {/* --- TIER 4: MARS --- */}
        {/* Arm Radius: 0.194m, Height: 0.208m */}
        <group ref={marsArmRef} position={[0, 0.208, 0]}>
          <mesh castShadow material={brassMat}>
            <cylinderGeometry args={[0.0195, 0.0195, 0.012, 20]} />
          </mesh>
          <mesh
            position={[0.097, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
            material={brassMat}
          >
            <cylinderGeometry args={[0.0022, 0.0022, 0.194, 8]} />
          </mesh>
          <mesh position={[-0.038, 0, 0]} castShadow material={darkBronzeMat}>
            <sphereGeometry args={[0.008, 12, 10]} />
          </mesh>
          <mesh position={[0.194, 0.024, 0]} castShadow material={brassMat}>
            <cylinderGeometry args={[0.0018, 0.0018, 0.048, 8]} />
          </mesh>
          {/* Mars Globe: Rust-red carnelian sphere */}
          <mesh position={[0.194, 0.048, 0]} castShadow receiveShadow>
            <sphereGeometry args={[0.0105, 18, 14]} />
            <meshStandardMaterial
              color="#b54829"
              roughness={0.5}
              metalness={0.15}
            />
          </mesh>
        </group>

        {/* --- TIER 5: JUPITER --- */}
        {/* Arm Radius: 0.244m, Height: 0.232m */}
        <group ref={jupiterArmRef} position={[0, 0.232, 0]}>
          <mesh castShadow material={brassMat}>
            <cylinderGeometry args={[0.019, 0.019, 0.012, 20]} />
          </mesh>
          <mesh
            position={[0.122, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
            material={brassMat}
          >
            <cylinderGeometry args={[0.0025, 0.0025, 0.244, 8]} />
          </mesh>
          <mesh position={[-0.046, 0, 0]} castShadow material={darkBronzeMat}>
            <sphereGeometry args={[0.0095, 12, 10]} />
          </mesh>
          <mesh position={[0.244, 0.026, 0]} castShadow material={brassMat}>
            <cylinderGeometry args={[0.0022, 0.0022, 0.052, 8]} />
          </mesh>
          {/* Jupiter Assembly: Banded ochre sphere with equatorial brass girdle and moonlets */}
          <group position={[0.244, 0.052, 0]}>
            <mesh castShadow receiveShadow>
              <sphereGeometry args={[0.022, 28, 20]} />
              <meshStandardMaterial
                color="#ce9653"
                roughness={0.35}
                metalness={0.12}
              />
            </mesh>
            {/* Equatorial brass band */}
            <mesh castShadow material={brassMat}>
              <torusGeometry args={[0.023, 0.0016, 8, 28]} />
            </mesh>
            {/* Wire ring for Galilean moons Io & Europa */}
            <mesh rotation={[0.2, 0, 0]} material={brassMat}>
              <torusGeometry args={[0.034, 0.0008, 6, 28]} />
            </mesh>
            <mesh
              position={[0.034, 0.007, 0]}
              castShadow
              material={polishedGoldMat}
            >
              <sphereGeometry args={[0.0032, 10, 8]} />
            </mesh>
            <mesh
              position={[-0.025, -0.005, 0.022]}
              castShadow
              material={brassMat}
            >
              <sphereGeometry args={[0.0028, 10, 8]} />
            </mesh>
          </group>
        </group>

        {/* --- TIER 6: SATURN --- */}
        {/* Arm Radius: 0.298m, Height: 0.256m */}
        <group ref={saturnArmRef} position={[0, 0.256, 0]}>
          <mesh castShadow material={brassMat}>
            <cylinderGeometry args={[0.0185, 0.0185, 0.012, 20]} />
          </mesh>
          <mesh
            position={[0.149, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
            material={brassMat}
          >
            <cylinderGeometry args={[0.0026, 0.0026, 0.298, 8]} />
          </mesh>
          <mesh position={[-0.052, 0, 0]} castShadow material={darkBronzeMat}>
            <sphereGeometry args={[0.0105, 12, 10]} />
          </mesh>
          <mesh position={[0.298, 0.028, 0]} castShadow material={brassMat}>
            <cylinderGeometry args={[0.0024, 0.0024, 0.056, 8]} />
          </mesh>
          {/* Saturn Assembly: Golden globe with tilted concentric brass rings */}
          <group position={[0.298, 0.056, 0]}>
            <group ref={saturnGlobeRef} rotation={[0.47, 0, 0.2]}>
              <mesh castShadow receiveShadow>
                <sphereGeometry args={[0.018, 24, 18]} />
                <meshStandardMaterial
                  color="#e0c686"
                  roughness={0.32}
                  metalness={0.16}
                />
              </mesh>
              {/* Concentric planetary rings */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <ringGeometry args={[0.025, 0.044, 36]} />
                <meshStandardMaterial
                  color="#c7a456"
                  metalness={0.72}
                  roughness={0.28}
                  side={DoubleSide}
                />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow>
                <ringGeometry args={[0.046, 0.048, 36]} />
                <meshStandardMaterial
                  color="#ecd28d"
                  metalness={0.8}
                  roughness={0.24}
                  side={DoubleSide}
                />
              </mesh>
            </group>
          </group>
        </group>

        {/* ============================================================== */}
        {/* 6. ENGRAVED BRASS PLAQUE ON TABLE PEDESTAL                     */}
        {/* ============================================================== */}
        <group position={[0, 0.022, 0.166]} rotation={[0.32, 0, 0]}>
          <mesh castShadow material={brassMat}>
            <boxGeometry args={[0.072, 0.018, 0.003]} />
          </mesh>
          <mesh position={[0, 0, 0.002]}>
            <boxGeometry args={[0.066, 0.013, 0.001]} />
            <meshStandardMaterial
              color={hovered ? '#fff3c2' : '#ebd07f'}
              roughness={0.3}
              metalness={0.7}
            />
          </mesh>
        </group>

        {/* Floating subtle pulse ring on hover */}
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

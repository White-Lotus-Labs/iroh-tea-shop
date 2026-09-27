import { Suspense, useMemo, useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import {
  DoubleSide,
  Group,
  LinearSRGBColorSpace,
  PlaneGeometry,
  SRGBColorSpace,
  Vector2,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { IrohModel } from './IrohModel';
import type { IrohActivity } from './irohMotion';

export type { IrohActivity };

type Point = [number, number, number];

export const IROH_DEFAULT_POSITION: Point = [0, 0, -3.62];
export const IROH_DEFAULT_ROTATION: Point = [0, 0, 0];

/**
 * Sculpted relief for torso, lap, teacup, skull, nose, beard, and topknot.
 * Both diorama layers share this one surface: any depth gap between them
 * parallaxes the head layer off the head painted on the body at side angles.
 */
function curvedDioramaGeometry() {
  const geometry = new PlaneGeometry(1.46, 1.95, 64, 64);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const nx = x / 0.73;
    const ny = y / 0.975;
    const wrap = Math.max(0, 1 - nx * nx);
    const edgeFade = wrap * Math.max(0, 1 - ny * ny);
    const torso =
      Math.exp(-((nx / 0.65) ** 2 + ((ny + 0.1) / 0.4) ** 2)) * 0.08;
    const lap = Math.exp(-((nx / 0.8) ** 2 + ((ny + 0.6) / 0.35) ** 2)) * 0.05;
    const cup =
      Math.exp(-((nx / 0.22) ** 2 + ((ny + 0.05) / 0.15) ** 2)) * 0.045;
    const skull =
      Math.exp(-((nx / 0.32) ** 2 + ((ny - 0.72) / 0.22) ** 2)) * 0.04;
    const nose =
      Math.exp(-((nx / 0.08) ** 2 + ((ny - 0.7) / 0.06) ** 2)) * 0.035;
    const beard =
      Math.exp(-((nx / 0.22) ** 2 + ((ny - 0.58) / 0.1) ** 2)) * 0.025;
    const topknot =
      Math.exp(-((nx / 0.12) ** 2 + ((ny - 0.88) / 0.08) ** 2)) * 0.015;
    const body = (0.02 * wrap + torso + lap + cup) * (0.3 + 0.7 * edgeFade);
    const head = (skull + nose + beard + topknot) * (0.4 + 0.6 * edgeFade);
    pos.setZ(i, body + head);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The body art also paints the head. Cut it where the head layer is opaque;
 * keep it under the head's soft collar fade so the robe stays solid there.
 */
export function hideBodyHead(headMap: Texture) {
  return (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.headMap = { value: headMap };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D headMap;',
      )
      .replace(
        '#include <alphatest_fragment>',
        'diffuseColor.a *= step(texture2D(headMap, vMapUv).a, 0.99);\n#include <alphatest_fragment>',
      );
  };
}

/**
 * Uncle Iroh on his cushion. Before the visitor steps inside he is the
 * painted diorama; with `model` the sculpted, rigged host loads behind it and
 * takes over once ready.
 */
export function TeaHost3D({
  reduced,
  activity = 'idle',
  model = false,
  position = IROH_DEFAULT_POSITION,
  rotation = IROH_DEFAULT_ROTATION,
  lit = false,
  onActivate,
}: {
  reduced: boolean;
  activity?: IrohActivity;
  model?: boolean;
  position?: Point;
  rotation?: Point;
  lit?: boolean;
  onActivate?: () => void;
}) {
  const [modelReady, setModelReady] = useState(false);
  return (
    <group position={position} rotation={rotation} name="tea-host-3d">
      {/* Floor cushion grounding Uncle Iroh to the tatami mat */}
      <mesh
        position={[0, 0.045, 0.02]}
        scale={[0.78, 0.065, 0.52]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[1, 1, 1, 32]} />
        <meshStandardMaterial color="#414a30" roughness={0.94} />
      </mesh>
      <mesh
        position={[0, 0.085, 0.02]}
        scale={[0.72, 0.045, 0.46]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[1, 1, 1, 32]} />
        <meshStandardMaterial color="#555a3c" roughness={0.92} />
      </mesh>
      {/* Stays put in the tree: remounting it mid room-compile disposes materials being polled. */}
      {!modelReady && <IrohDiorama reduced={reduced} activity={activity} />}
      {model && (
        <Suspense fallback={null}>
          <IrohModel
            reduced={reduced}
            activity={activity}
            lit={lit}
            onActivate={onActivate}
            onReady={() => setModelReady(true)}
          />
        </Suspense>
      )}
    </group>
  );
}

/**
 * A layered 2.5D illustrated diorama of Uncle Iroh.
 * Integrates hand-painted anime/Ghibli art direction with physical 3D curvature,
 * neck-pivoted parallax animation, and dynamic scene lighting response.
 */
function IrohDiorama({
  reduced,
  activity,
}: {
  reduced: boolean;
  activity: IrohActivity;
}) {
  const bodyTexture = useTexture('/images/tea-host-diorama-body.5c7c91.webp');
  const bodyNormal = useTexture(
    '/images/tea-host-diorama-body-normal.07c541.webp',
  );
  const headTexture = useTexture('/images/tea-host-diorama-head.47063b.webp');
  const headNormal = useTexture(
    '/images/tea-host-diorama-head-normal.79d02a.webp',
  );
  bodyTexture.colorSpace = SRGBColorSpace;
  headTexture.colorSpace = SRGBColorSpace;
  bodyNormal.colorSpace = LinearSRGBColorSpace;
  headNormal.colorSpace = LinearSRGBColorSpace;

  const bodyNormalScale = useMemo(() => new Vector2(0.85, 0.85), []);
  const headNormalScale = useMemo(() => new Vector2(0.9, 0.9), []);

  const dioramaGeom = useMemo(curvedDioramaGeometry, []);
  const maskBodyHead = useMemo(() => hideBodyHead(headTexture), [headTexture]);

  useEffect(() => () => dioramaGeom.dispose(), [dioramaGeom]);

  const bodyRef = useRef<Group>(null);
  const headGroupRef = useRef<Group>(null);

  useFrame(({ clock }, delta) => {
    const time = clock.elapsedTime;
    const breath = reduced ? 0 : Math.sin(time * 0.74);

    if (bodyRef.current) {
      bodyRef.current.scale.y = 1 + breath * 0.003;
    }

    if (headGroupRef.current) {
      // Gentle breathing bob and tilt
      const breathTilt = reduced ? 0 : Math.sin(time * 0.38) * 0.012;
      const thoughtfulTilt = reduced
        ? 0
        : activity === 'researching'
          ? -0.045
          : activity === 'responding'
            ? 0.025
            : 0;
      const thoughtfulTurn = reduced
        ? 0
        : activity === 'researching'
          ? -0.035
          : activity === 'responding'
            ? 0.02
            : 0;

      const targetX = thoughtfulTilt + breathTilt * 0.5;
      const targetY = thoughtfulTurn;
      const targetZ = breathTilt;

      headGroupRef.current.rotation.x +=
        (targetX - headGroupRef.current.rotation.x) * Math.min(1, delta * 2.5);
      headGroupRef.current.rotation.y +=
        (targetY - headGroupRef.current.rotation.y) * Math.min(1, delta * 2.2);
      headGroupRef.current.rotation.z +=
        (targetZ - headGroupRef.current.rotation.z) * Math.min(1, delta * 2.0);
    }
  });

  return (
    /* Layered Illustrated Diorama with Sculpted 3D Relief */
    <group ref={bodyRef} position={[0, 0.975, 0]}>
      {/* Layer 1: Seated Body, Kimono, Lap, and Steaming Teacup */}
      <mesh geometry={dioramaGeom} castShadow receiveShadow>
        <meshStandardMaterial
          map={bodyTexture}
          normalMap={bodyNormal}
          normalScale={bodyNormalScale}
          alphaTest={0.5}
          roughness={0.88}
          metalness={0.02}
          side={DoubleSide}
          onBeforeCompile={maskBodyHead}
        />
      </mesh>

      {/* Layer 2: Expressive Head with Neck Pivot Point */}
      {/* Neck pivot is around y = 0.50 in local coordinates (height ~1.48m from floor) */}
      <group position={[0, 0.5, 0]}>
        <group ref={headGroupRef}>
          <mesh geometry={dioramaGeom} position={[0, -0.5, 0]} castShadow>
            <meshStandardMaterial
              map={headTexture}
              normalMap={headNormal}
              normalScale={headNormalScale}
              transparent
              alphaTest={0.02}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-4}
              roughness={0.88}
              metalness={0.02}
              side={DoubleSide}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

import {
  BufferGeometry,
  CatmullRomCurve3,
  PlaneGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { SurfaceMaterial } from '../Surfaces';
import type { Point } from '../stations';
import { merge, place, useBuilt } from './craft';
import { BambooPot, Bonsai } from './Plants';

const CUSHION = { w: 0.74, d: 0.8, seam: 0.036, top: 0.052, bottom: 0.032 };

/** Pinched outline: sides bow out a little, corners draw in. */
const outline = (u: number, v: number): [number, number] => [
  (u * CUSHION.w * (1 + 0.03 * (1 - v * v))) / 2,
  (v * CUSHION.d * (1 + 0.03 * (1 - u * u))) / 2,
];
const puff = (s: number) => (1 - Math.min(1, Math.abs(s)) ** 4) ** 0.32;

/** One stuffed face; `up` picks the top (tufted, fuller) or the floor side. */
function panel(up: boolean) {
  const geometry = new PlaneGeometry(2, 2, 48, 48);
  geometry.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
  const p = geometry.attributes.position,
    uv = geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i),
      v = p.getZ(i),
      [x, z] = outline(u, v),
      r2 = u * u + v * v,
      body = puff(u) * puff(v),
      y = up
        ? CUSHION.seam +
          CUSHION.top * body -
          0.024 * Math.exp(-r2 / 0.014) +
          0.0025 *
            Math.sin(8 * Math.atan2(v, u)) *
            Math.sqrt(r2) *
            Math.exp(-r2 / 0.09)
        : CUSHION.seam - CUSHION.bottom * body;
    p.setXYZ(i, x, Math.max(0.002, y), z);
    uv.setXY(i, x / 0.35, z / 0.35);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function buildCushion() {
  const ring = Array.from({ length: 96 }, (_, i) => {
    const a = (i / 96) * Math.PI * 2,
      c = Math.cos(a),
      s = Math.sin(a),
      k = Math.max(Math.abs(c), Math.abs(s)),
      [x, z] = outline(c / k, s / k);
    return new Vector3(x, CUSHION.seam, z);
  });
  const tuftY = CUSHION.seam + CUSHION.top - 0.022;
  const strands: BufferGeometry[] = [0.5, 2.07, 3.64, 5.21].map((a) =>
    place(
      new TubeGeometry(
        new CatmullRomCurve3([
          new Vector3(0, 0.004, 0),
          new Vector3(Math.cos(a) * 0.018, 0.002, Math.sin(a) * 0.018),
          new Vector3(Math.cos(a) * 0.034, -0.001, Math.sin(a) * 0.034),
        ]),
        6,
        0.0032,
        5,
      ),
      [0, tuftY, 0],
    ),
  );
  return {
    body: merge([panel(true), panel(false)]),
    piping: new TubeGeometry(
      new CatmullRomCurve3(ring, true),
      192,
      0.0075,
      6,
      true,
    ),
    tuft: merge([
      ...strands,
      place(new SphereGeometry(0.009, 10, 8), [0, tuftY + 0.004, 0]),
    ]),
    dispose() {
      this.body.dispose();
      this.piping.dispose();
      this.tuft.dispose();
    },
  };
}

/** A zabuton: stuffed top and floor panels, piped seam and a centre tuft tie. */
function Cushion({ position }: { position: Point }) {
  const built = useBuilt(buildCushion);
  return (
    <group position={position} rotation={[0, 0.18, 0]}>
      <mesh geometry={built.body} castShadow receiveShadow>
        <SurfaceMaterial surface="cloth" color="#3f4a37" />
      </mesh>
      <mesh geometry={built.piping} castShadow>
        <SurfaceMaterial surface="cloth" color="#28301f" />
      </mesh>
      <mesh geometry={built.tuft} castShadow>
        <SurfaceMaterial surface="cloth" color="#cbb98e" />
      </mesh>
    </group>
  );
}

/** Loose props in the tea chamber: cushions, plants and small objects. */
export function ChamberDressing() {
  return (
    <group>
      <Cushion position={[-0.76, 0.053, -0.93]} />
      <Bonsai position={[-1.3, 0, -5.75]} seed={3} stand turn={0.1} />
    </group>
  );
}

/** Loose props in the waiting room. */
export function WaitingDressing() {
  return (
    <group>
      <BambooPot position={[3.35, 0, 4.0]} />
    </group>
  );
}

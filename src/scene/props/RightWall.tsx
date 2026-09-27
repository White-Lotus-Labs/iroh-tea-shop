import { Solid } from '../Surfaces';
import { ShojiWindow } from './Shoji';

const timber = '#3a2419';
const face = 4.005;
const from = -6.18;
const to = 3.23;
const length = to - from;
const center = (from + to) / 2;
const at = (depth: number) => face - depth;
const win = { z0: -1.3, z1: 0.9, y0: 0.99, y1: 2.86 };
const jamb = -1.445;
const post = 0.985;

/** The right chamber wall: rails and wainscot framing a lit two-panel shoji window. */
export function RightWall() {
  const winZ = (win.z0 + win.z1) / 2;
  const casing = post - 0.085 - jamb;
  const casingZ = (jamb + post - 0.085) / 2;
  return (
    <group name="right-wall">
      <Solid
        position={[3.91, 1.85, post]}
        size={[0.17, 3.7, 0.17]}
        color={timber}
        cast={false}
      />
      <Solid
        position={[at(0.07), (win.y0 + win.y1) / 2, (jamb + win.z0) / 2]}
        size={[0.14, win.y1 - win.y0 + 0.1, win.z0 - jamb]}
        color={timber}
        cast={false}
      />
      <Solid
        position={[at(0.1), win.y0 - 0.02, casingZ]}
        size={[0.2, 0.04, casing]}
        color="#4a2e1d"
        clearcoat={0.25}
        cast={false}
      />
      {[0.03, 0.06].map((depth) => (
        <Solid
          key={depth}
          position={[at(depth), win.y0 + 0.001, casingZ]}
          size={[0.012, 0.004, casing - 0.02]}
          color="#1a100a"
          cast={false}
        />
      ))}
      <Solid
        position={[at(0.07), win.y1 + 0.045, casingZ]}
        size={[0.14, 0.09, casing]}
        color={timber}
        cast={false}
      />
      <ShojiWindow
        position={[at(0.075), (win.y0 + win.y1) / 2, winZ]}
        rotation={-Math.PI / 2}
        width={win.z1 - win.z0}
        height={win.y1 - win.y0}
        cols={3}
        rows={6}
        glow={0.8}
        seed={17}
      />
      {[
        [from, jamb],
        [post + 0.085, to],
      ].map(([a, b]) => (
        <Solid
          key={a}
          position={[at(0.045), 2.32, (a + b) / 2]}
          size={[0.09, 0.12, b - a]}
          color={timber}
          cast={false}
        />
      ))}
      <Solid
        position={[at(0.035), 3.3, center]}
        size={[0.07, 0.07, length]}
        color={timber}
        cast={false}
      />
      <Solid
        position={[at(0.02), 0.47, center]}
        size={[0.04, 0.94, length]}
        color="#4a2e1d"
        cast={false}
      />
      <Solid
        position={[at(0.04), 0.96, center]}
        size={[0.07, 0.05, length]}
        color={timber}
        cast={false}
      />
      <Solid
        position={[at(0.04), 0.035, center]}
        size={[0.07, 0.07, length]}
        color={timber}
        cast={false}
      />
      {[0.33, 0.64].map((y) => (
        <Solid
          key={y}
          position={[at(0.041), y, center]}
          size={[0.004, 0.006, length]}
          color="#1f140d"
          cast={false}
        />
      ))}
    </group>
  );
}

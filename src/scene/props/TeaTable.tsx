import { Cup } from '../Ceramics';
import { Solid } from '../Surfaces';

/** The host's low tea table, its runner and the two guest cups. */
export function TeaTable() {
  return (
    <group>
      <Solid
        position={[0, 0.575, -2.41]}
        size={[2.58, 0.07, 1.37]}
        color="#5b3522"
        clearcoat={0.55}
      />
      <Solid
        position={[0, 0.505, -2.41]}
        size={[2.3, 0.07, 1.15]}
        color="#3a2216"
      />
      {[-1.04, 1.04].flatMap((x) =>
        [-0.51, 0.51].map((z) => (
          <Solid
            key={`${x}${z}`}
            position={[x, 0.27, -2.41 + z]}
            size={[0.14, 0.47, 0.16]}
            color="#3a2419"
          />
        )),
      )}
      <Solid
        position={[0, 0.6115, -2.36]}
        size={[2.05, 0.003, 0.36]}
        color="#bba98a"
        surface="cloth"
      />
      <Cup position={[-0.58, 0.68, -2.18]} color="#828069" />
      <Cup position={[0.58, 0.68, -2.34]} color="#a9a18a" />
    </group>
  );
}

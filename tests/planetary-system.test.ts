import { describe, expect, it } from 'vitest';
import { damp } from '../src/scene/motion/dynamics';
import {
  ARM_HEIGHTS,
  ARMS,
  BASE_Y,
  BASE_TRIM_RINGS,
  CRANK_AXLE_Y,
  CRANK_HANDLE_X,
  ECCENTRICITIES,
  LAPLACE_RESONANCE,
  ORBITAL_SPEEDS,
  SUN_Y,
  keplerianVelocity,
} from '../src/scene/MechanicalPlanetarySystem';

describe('mechanical planetary system (orrery)', () => {
  it('maintains astronomical hierarchy in orbital speeds', () => {
    expect(ORBITAL_SPEEDS.mercury).toBeGreaterThan(ORBITAL_SPEEDS.venus);
    expect(ORBITAL_SPEEDS.venus).toBeGreaterThan(ORBITAL_SPEEDS.earth);
    expect(ORBITAL_SPEEDS.earth).toBeGreaterThan(ORBITAL_SPEEDS.mars);
    expect(ORBITAL_SPEEDS.mars).toBeGreaterThan(ORBITAL_SPEEDS.jupiter);
    expect(ORBITAL_SPEEDS.jupiter).toBeGreaterThan(ORBITAL_SPEEDS.saturn);
  });

  it('calculates proper counter-rotating gear ratios', () => {
    const driveGearTeeth = 28;
    const pinion1Teeth = 14;
    const pinion2Teeth = 11;

    const ratio1 = driveGearTeeth / pinion1Teeth;
    const ratio2 = driveGearTeeth / pinion2Teeth;

    expect(ratio1).toBe(2.0); // Exact 2:1 reduction
    expect(ratio2).toBeCloseTo(2.545, 2);
  });

  it('damps wind-up impulse back to nominal velocity', () => {
    let speed = 4.8; // Wind-up burst
    const targetSpeed = 1.0;
    const dt = 1 / 60;

    for (let frame = 0; frame < 120; frame++) {
      speed = damp(speed, targetSpeed, 1.35, dt);
    }

    // After 2 seconds (120 frames at 60fps), speed should have settled close to nominal 1.0
    expect(speed).toBeLessThan(1.3);
    expect(speed).toBeGreaterThanOrEqual(1.0);
  });

  it('modulates orbital speed via Keplerian eccentricity (faster at perihelion)', () => {
    // Mercury has the highest eccentricity in the classical system (~0.2056)
    const perihelionSpeed = keplerianVelocity(
      ORBITAL_SPEEDS.mercury,
      ECCENTRICITIES.mercury,
      0, // θ = 0 (perihelion)
    );
    const aphelionSpeed = keplerianVelocity(
      ORBITAL_SPEEDS.mercury,
      ECCENTRICITIES.mercury,
      Math.PI, // θ = π (aphelion)
    );

    expect(perihelionSpeed).toBeGreaterThan(ORBITAL_SPEEDS.mercury);
    expect(aphelionSpeed).toBeLessThan(ORBITAL_SPEEDS.mercury);
    expect(perihelionSpeed).toBeGreaterThan(aphelionSpeed);

    // Mean velocity across full revolution preserves nominal speed
    const samples = 120;
    let sum = 0;
    for (let i = 0; i < samples; i++) {
      const theta = (i / samples) * Math.PI * 2;
      sum += keplerianVelocity(
        ORBITAL_SPEEDS.mercury,
        ECCENTRICITIES.mercury,
        theta,
      );
    }
    const meanSpeed = sum / samples;
    expect(meanSpeed).toBeCloseTo(ORBITAL_SPEEDS.mercury, 4);
  });

  it('exhibits exact 4:2:1 Laplace orbital resonance for Galilean moons', () => {
    const ioRatio = LAPLACE_RESONANCE.io / LAPLACE_RESONANCE.europa;
    const europaRatio = LAPLACE_RESONANCE.europa / LAPLACE_RESONANCE.ganymede;

    expect(ioRatio).toBe(2.0);
    expect(europaRatio).toBe(2.0);
  });

  it('nests concentric coaxial brass sleeves in descending order', () => {
    const planets = [
      'mercury',
      'venus',
      'earth',
      'mars',
      'jupiter',
      'saturn',
    ] as const;
    for (let i = 0; i < planets.length - 1; i++) {
      const lower = ARMS[planets[i]];
      const upper = ARMS[planets[i + 1]];
      // Lower tier sleeve radius must be strictly greater than upper tier sleeve radius
      expect(lower.sleeve[0]).toBeGreaterThan(upper.sleeve[0]);
      // Upper tier sleeve must fit inside lower tier collar
      expect(upper.sleeve[0]).toBeLessThan(lower.collar);
    }
  });

  it('stands on the ground next to the left wall, further toward host', () => {
    const scale = 1.55;
    const orreryPosition = [-3.28, 0, -3.15];
    const standHeight = 0.38 * scale;
    const mechanismHeight = (0.42 + BASE_Y) * scale; // Plinth to Sun apex
    const totalApexY = orreryPosition[1] + standHeight + mechanismHeight;
    const outerSaturnRadius = 0.32 * scale;

    // Boundary constants from TeaArchitecture.tsx
    const tableMinX = -2.58 / 2; // -1.29
    const leftWallBeamX = -3.98 + 0.17 / 2; // -3.895
    const tableCenterZ = -2.41;
    const hostZ = -3.62;

    // Verify resting on the ground
    expect(orreryPosition[1]).toBe(0);

    // Verify placed to the left of the table and clear of the left wall
    expect(orreryPosition[0]).toBeLessThan(tableMinX);
    expect(orreryPosition[0] - outerSaturnRadius).toBeGreaterThan(
      leftWallBeamX,
    );

    // Verify positioned further toward the host than table center
    expect(orreryPosition[2]).toBeLessThan(tableCenterZ);
    expect(orreryPosition[2]).toBeGreaterThan(hostZ);

    // Verify top apex stays comfortably below minimum camera travel plane (1.4m)
    expect(totalApexY).toBeLessThan(1.4);
    expect(totalApexY).toBeGreaterThan(1.0);
  });

  it('aligns winding crank axle and handle with horizontal drive arbor', () => {
    // Horizontal axle emerges along X at [0.144, CRANK_AXLE_Y, 0].
    const axleOrigin = [0.144, CRANK_AXLE_Y, 0];
    const crankPosition = [CRANK_HANDLE_X, CRANK_AXLE_Y, 0];
    const handleOffset = [0.019, 0.038, 0]; // Extends outward along +X

    expect(crankPosition[1]).toBe(axleOrigin[1]);
    expect(crankPosition[2]).toBe(axleOrigin[2]);
    expect(crankPosition[0]).toBeGreaterThan(axleOrigin[0]);
    // Handle grip points outwards away from plinth (+X)
    expect(handleOffset[0]).toBeGreaterThan(0);
  });

  it('uses only a bottom and top trim ring, with the crank outside both', () => {
    expect(BASE_TRIM_RINGS).toHaveLength(2);
    expect(BASE_TRIM_RINGS[0].y).toBeLessThan(BASE_TRIM_RINGS[1].y);

    const outerBottomRing = BASE_TRIM_RINGS[0].radius + BASE_TRIM_RINGS[0].tube;
    expect(CRANK_HANDLE_X - outerBottomRing).toBeGreaterThan(0.03);
  });

  it('clears the tabletop throughout full 360-degree rotation of the winding crank', () => {
    const handleRadius = 0.038;
    const handleSleeveRadius = 0.0068;
    const lowestHandleY = CRANK_AXLE_Y - handleRadius - handleSleeveRadius;
    // Tabletop surface sits at y = 0 in the pedestal frame; handle must rotate with clearance
    expect(lowestHandleY).toBeGreaterThan(0.015);
  });

  it('aligns all planet globes to the same horizontal ecliptic plane (Sun center)', () => {
    const planets = [
      'mercury',
      'venus',
      'earth',
      'mars',
      'jupiter',
      'saturn',
    ] as const;

    for (const planet of planets) {
      const armBaseY = ARM_HEIGHTS[planet];
      const riserHeight = ARMS[planet].riser[1];
      const totalPlanetY = armBaseY + riserHeight;

      // Every planet must reach exactly SUN_Y in the pedestal frame
      expect(totalPlanetY).toBeCloseTo(SUN_Y, 5);
    }
  });
});

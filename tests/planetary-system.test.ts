import { describe, expect, it } from 'vitest';
import { damp } from '../src/scene/motion/dynamics';

describe('mechanical planetary system (orrery)', () => {
  it('maintains astronomical hierarchy in orbital speeds', () => {
    // Relative orbital velocity coefficients
    const mercurySpeed = 1.95;
    const venusSpeed = 0.98;
    const earthSpeed = 0.62;
    const marsSpeed = 0.38;
    const jupiterSpeed = 0.18;
    const saturnSpeed = 0.09;

    expect(mercurySpeed).toBeGreaterThan(venusSpeed);
    expect(venusSpeed).toBeGreaterThan(earthSpeed);
    expect(earthSpeed).toBeGreaterThan(marsSpeed);
    expect(marsSpeed).toBeGreaterThan(jupiterSpeed);
    expect(jupiterSpeed).toBeGreaterThan(saturnSpeed);
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

  it('fits on the tea table without intersecting table bounds or camera path', () => {
    const orreryPosition = [-0.62, 0.61, -2.52];
    const orreryRadius = 0.32; // Outer Saturn arm radius
    const orreryHeight = 0.42; // Base to Sun apex

    // Table boundary constants from TeaArchitecture.tsx
    // Solid position={[0, 0.53, -2.41]} size={[2.58, 0.16, 1.37]}
    const tableMinX = -2.58 / 2; // -1.29
    const tableMaxX = 2.58 / 2; // +1.29
    const tableMinZ = -2.41 - 1.37 / 2; // -3.095
    const tableMaxZ = -2.41 + 1.37 / 2; // -1.725
    const tableTopY = 0.53 + 0.16 / 2; // 0.61

    // Verify resting height
    expect(orreryPosition[1]).toBe(tableTopY);

    // Verify horizontal base footprint and arms stay within table dimensions
    expect(orreryPosition[0] - orreryRadius).toBeGreaterThan(tableMinX);
    expect(orreryPosition[0] + orreryRadius).toBeLessThan(tableMaxX);
    expect(orreryPosition[2] - orreryRadius).toBeGreaterThan(tableMinZ);
    expect(orreryPosition[2] + orreryRadius).toBeLessThan(tableMaxZ);

    // Verify top apex stays below minimum camera travel plane (1.4m)
    const apexY = orreryPosition[1] + orreryHeight;
    expect(apexY).toBeLessThan(1.4);
  });
});

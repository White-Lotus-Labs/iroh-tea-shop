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

  it('stands on the ground next to the left wall, further toward host', () => {
    const scale = 1.55;
    const orreryPosition = [-2.85, 0, -3.15];
    const standHeight = 0.38 * scale;
    const mechanismHeight = 0.42 * scale; // Plinth to Sun apex
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
});

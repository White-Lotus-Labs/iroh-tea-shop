import { describe, expect, it } from 'vitest';
import {
  Bone,
  Group,
  ShaderLib,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import {
  actionAt,
  sample,
  sampleNumber,
  solveTwoBone,
} from '../src/scene/irohMotion';
import { patchHairShell, patchHostBody } from '../src/scene/IrohModel';

function arm() {
  const root = new Group();
  const upper = new Bone();
  const lower = new Bone();
  const end = new Bone();
  lower.position.set(0, -0.4, 0);
  end.position.set(0, -0.35, 0);
  root.add(upper);
  upper.add(lower);
  lower.add(end);
  root.updateMatrixWorld(true);
  return { upper, lower, end };
}

describe('Iroh motion', () => {
  it('lands the wrist on a reachable target with the elbow toward the pole', () => {
    const { upper, lower, end } = arm();
    const target = new Vector3(0.3, -0.25, 0.35);
    const pole = new Vector3(0, -0.3, -1);
    solveTwoBone(upper, lower, end, target, pole);
    expect(end.getWorldPosition(new Vector3()).distanceTo(target)).toBeLessThan(
      1e-3,
    );
    const along = target.clone().normalize();
    const elbow = lower.getWorldPosition(new Vector3());
    const off = (p: Vector3) => p.clone().addScaledVector(along, -p.dot(along));
    expect(off(elbow).dot(off(pole))).toBeGreaterThan(0);
  });

  it('reaches straight toward a target that is too far', () => {
    const { upper, lower, end } = arm();
    const target = new Vector3(2, 0, 0);
    solveTwoBone(upper, lower, end, target, new Vector3(0, -1, 0));
    const tip = end.getWorldPosition(new Vector3());
    expect(tip.length()).toBeCloseTo(0.75, 2);
    expect(tip.normalize().dot(target.normalize())).toBeGreaterThan(0.999);
  });

  it('eases between keys and holds the last one', () => {
    expect(sample('sip', 'cup', 0)).toMatchObject({
      from: 'rest',
      to: 'sip',
      mix: 0,
    });
    expect(sample('sip', 'cup', 0.8)?.mix).toBeCloseTo(0.5, 5);
    expect(sampleNumber('sip', 'lids', 1.6)).toBeCloseTo(0.55, 5);
    expect(sample('sip', 'cup', 99)).toMatchObject({
      from: 'rest',
      to: 'rest',
    });
    expect(sample('nod', 'cup', 1)).toBeUndefined();
  });

  it('shakes his head once on an error, then settles', () => {
    expect(actionAt('error', 0)).toBe('shake');
    for (let n = 1; n < 30; n++) expect(actionAt('error', n)).not.toBe('shake');
    expect(actionAt('researching', 0)).toBe('pour');
  });

  it('finds every shader hook it patches', () => {
    const body = {
      uniforms: {},
      vertexShader: ShaderLib.physical.vertexShader,
      fragmentShader: ShaderLib.physical.fragmentShader,
    } as unknown as WebGLProgramParametersWithUniforms;
    patchHostBody({})(body);
    expect(body.fragmentShader).toContain('irohEye( 1');
    expect(body.fragmentShader).toContain('float wrap = 0.45 * vMask.r;');
    const shell = {
      uniforms: {},
      vertexShader: ShaderLib.standard.vertexShader,
      fragmentShader: ShaderLib.standard.fragmentShader,
    } as unknown as WebGLProgramParametersWithUniforms;
    patchHairShell({})(shell);
    expect(shell.vertexShader).toContain('shell * shellLength');
  });
});

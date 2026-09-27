import { describe, expect, it } from 'vitest';
import {
  ShaderChunk,
  ShaderLib,
  Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { hideBodyHead } from '../src/scene/TeaHost3D';

describe('host diorama', () => {
  it('cuts the painted head out of the body layer', () => {
    const head = new Texture();
    const shader = {
      uniforms: {},
      fragmentShader: ShaderLib.standard.fragmentShader,
    } as unknown as WebGLProgramParametersWithUniforms;
    hideBodyHead(head)(shader);
    expect(shader.uniforms.headMap.value).toBe(head);
    expect(shader.fragmentShader).toContain('uniform sampler2D headMap;');
    expect(shader.fragmentShader).toContain(
      'diffuseColor.a *= step(texture2D(headMap, vMapUv).a, 0.99);\n#include <alphatest_fragment>',
    );
    expect(ShaderChunk.map_fragment).toContain('vMapUv');
  });
});

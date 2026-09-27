import { useEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import {
  HalfFloatType,
  Vector2,
  WebGLRenderTarget,
  type Material,
  type Object3D,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { lightExperience } from './lightExperience';

/** Display-referred grade after tone mapping: split tone, soft contrast, vignette, grain. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    aspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float aspect;
    varying vec2 vUv;
    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      vec3 c = source.rgb;
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c *= mix(vec3(0.94, 0.985, 1.04), vec3(1.035, 1.0, 0.94), smoothstep(0.05, 0.6, luma));
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);
      c = mix(vec3(luma), c, 1.06);
      vec2 d = (vUv - 0.5) * vec2(aspect, 1.0);
      c *= 1.0 - 0.32 * smoothstep(0.42, 1.15, length(d));
      float n = fract(sin(dot(gl_FragCoord.xy + fract(time) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - 0.5) * 0.018;
      gl_FragColor = vec4(c, source.a);
    }`,
};

/** Sprites and see-through effects must not write into the AO depth/normal buffer. */
class SceneAOPass extends GTAOPass {
  declare _visibilityCache: Object3D[];
  _overrideVisibility() {
    this.scene.traverse((object) => {
      const material = (object as { material?: Material }).material;
      const see =
        (object as { isSprite?: boolean }).isSprite ||
        (object as { isPoints?: boolean }).isPoints ||
        (object as { isLine?: boolean }).isLine ||
        (material && !Array.isArray(material) && material.transparent);
      if (see && object.visible) {
        object.visible = false;
        this._visibilityCache.push(object);
      }
    });
  }
}

function Composer({
  reduced,
  ao,
  msaa,
  bloom,
}: {
  reduced: boolean;
  ao: boolean;
  msaa: number;
  bloom: boolean;
}) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const pipeline = useMemo(() => {
    const target = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      samples: 4,
    });
    const composer = new EffectComposer(gl, target);
    const occlusion = new SceneAOPass(scene, camera, 1, 1);
    occlusion.updateGtaoMaterial({
      radius: 0.32,
      distanceExponent: 1.4,
      thickness: 1.2,
      scale: 1,
      samples: 12,
    });
    occlusion.updatePdMaterial({ radius: 6, rings: 2, samples: 12 });
    occlusion.blendIntensity = 0.85;
    const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.28, 0.5, 1.6);
    const grade = new ShaderPass(GradeShader);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(occlusion);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.addPass(grade);
    return { composer, occlusion, grade, bloom };
  }, [gl, scene, camera]);
  useEffect(() => () => pipeline.composer.dispose(), [pipeline]);
  useEffect(() => {
    const { composer, occlusion, grade } = pipeline;
    composer.setPixelRatio(dpr);
    composer.setSize(size.width, size.height);
    // ponytail: half-res AO; the denoise pass hides the upsample. Drop it entirely on slow GPUs.
    occlusion.setSize(
      Math.ceil((size.width * dpr) / 2),
      Math.ceil((size.height * dpr) / 2),
    );
    grade.uniforms.aspect.value = size.width / size.height;
  }, [pipeline, size, dpr]);
  useEffect(() => {
    pipeline.occlusion.enabled = ao;
    pipeline.bloom.enabled = bloom;
  }, [pipeline, ao, bloom]);
  useEffect(() => {
    const { composer } = pipeline;
    if (composer.renderTarget1.samples === msaa) return;
    const target = composer.renderTarget1.clone();
    target.samples = msaa;
    composer.reset(target);
  }, [pipeline, msaa]);
  useFrame((_, delta) => {
    if (!reduced) pipeline.grade.uniforms.time.value += delta;
    pipeline.composer.render(delta);
  }, 1);
  return null;
}

/** Quality rungs, cheapest first. Sustained low fps steps down: AO, then MSAA, then DPR toward 1. */
const LADDER = [
  { ao: false, msaa: 0, dpr: 1 },
  { ao: false, msaa: 0, dpr: 1.25 },
  { ao: false, msaa: 0, dpr: 1.5 },
  { ao: false, msaa: 4, dpr: 1.5 },
  { ao: true, msaa: 4, dpr: 1.5 },
];

function openingTier() {
  // Phones and save-data start on the cheapest rung. Desktop skips AO until
  // the frame rate proves it can climb.
  return lightExperience() ? 0 : 3;
}

export function ScenePolish({ reduced }: { reduced: boolean }) {
  const setDpr = useThree((state) => state.setDpr);
  const [tier, setTier] = useState(openingTier);
  const capped = lightExperience();
  const ceiling = capped ? 2 : LADDER.length - 1;
  const rung = LADDER[tier] ?? LADDER[0];
  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio || 1, rung.dpr));
  }, [rung, setDpr]);
  return (
    <>
      <PerformanceMonitor
        flipflops={3}
        onDecline={() => setTier((current) => Math.max(0, current - 1))}
        onIncline={() => setTier((current) => Math.min(ceiling, current + 1))}
        onFallback={() => setTier(0)}
      />
      <Composer
        reduced={reduced}
        ao={rung.ao}
        msaa={rung.msaa}
        bloom={!capped && tier > 0}
      />
    </>
  );
}

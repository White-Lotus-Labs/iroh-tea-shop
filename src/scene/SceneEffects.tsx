import { useEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Environment,
  Lightformer,
  PerformanceMonitor,
} from '@react-three/drei';
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
import { Atmosphere } from './props/Atmosphere';

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

function Composer({ reduced, ao }: { reduced: boolean; ao: boolean }) {
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
    return { composer, occlusion, grade };
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
  }, [pipeline, ao]);
  useFrame((_, delta) => {
    if (!reduced) pipeline.grade.uniforms.time.value += delta;
    pipeline.composer.render(delta);
  }, 1);
  return null;
}

/** Procedural room reflections: warm window and doorway panels, dim timber above and below. */
function RoomEnvironment() {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={0.55}>
      <color attach="background" args={['#140d09']} />
      <Lightformer
        form="rect"
        color="#ff9a5c"
        intensity={3.2}
        position={[-3.1, 1.2, -6]}
        scale={[1.8, 2.6, 1]}
      />
      <Lightformer
        form="rect"
        color="#ffd9a3"
        intensity={2.4}
        position={[-0.4, 1.9, -6]}
        scale={[2.2, 2.8, 1]}
      />
      <Lightformer
        form="rect"
        color="#ffd7a0"
        intensity={2}
        position={[4, 2.1, -0.3]}
        scale={[2, 2.4, 1]}
      />
      <Lightformer
        form="circle"
        color="#ffc070"
        intensity={9}
        position={[2.3, 2.72, -3.1]}
        scale={0.5}
      />
      <Lightformer
        form="circle"
        color="#ffc070"
        intensity={9}
        position={[-1.05, 2.45, -2.6]}
        scale={0.55}
      />
      <Lightformer
        form="rect"
        color="#ffcf96"
        intensity={0.7}
        position={[0, 1.6, 8]}
        scale={[3.5, 3, 1]}
      />
      <Lightformer
        form="rect"
        color="#5a3b25"
        intensity={0.35}
        position={[0, 4, -1.5]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[8, 10, 1]}
      />
      <Lightformer
        form="rect"
        color="#7a4c2c"
        intensity={0.4}
        position={[0, -1.2, -1.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[8, 10, 1]}
      />
      <Lightformer
        form="rect"
        color="#4a3222"
        intensity={0.3}
        position={[-4.5, 1.8, -1.5]}
        scale={[10, 3.7, 1]}
      />
    </Environment>
  );
}

export function SceneEffects({ reduced }: { reduced: boolean }) {
  const setDpr = useThree((state) => state.setDpr);
  // 2: AO + full dpr, 1: no AO, 0: no AO at 1x.
  const [tier, setTier] = useState(2);
  useEffect(() => {
    const device = window.devicePixelRatio || 1;
    setDpr(tier === 0 ? 1 : Math.min(device, tier === 1 ? 1.25 : 1.5));
  }, [tier, setDpr]);
  return (
    <>
      <PerformanceMonitor
        flipflops={3}
        onDecline={() => setTier((current) => Math.max(0, current - 1))}
        onIncline={() => setTier((current) => Math.min(2, current + 1))}
        onFallback={() => setTier(0)}
      />
      <fogExp2 attach="fog" args={['#5c3c26', 0.045]} />
      <RoomEnvironment />
      <Atmosphere reduced={reduced} />
      <Composer reduced={reduced} ao={tier === 2} />
    </>
  );
}

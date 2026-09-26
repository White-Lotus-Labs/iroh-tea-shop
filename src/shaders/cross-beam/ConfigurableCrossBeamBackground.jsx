import { useEffect, useRef } from "react";
import { ATMOSPHERE_FRAGMENT, BEAM_FRAGMENT, GLYPH_FRAGMENT, VERTEX_SHADER } from "./crossBeamShaders";
import "./CrossBeamBackground.css";

// Hero "beam glyph diffuse" background, hand-written in WebGL2.
//
// The scene is three cross-fading light beams that get randomly diffused, run
// through an ordered blue-noise dither, dusted with a drifting voronoi star
// field, and finally re-sampled on a 1/200 glyph grid. Those eight conceptual
// stages fuse into three render passes, since only the diffuse and the glyph
// grid actually need to read neighbouring pixels:
//
//   A  beams          -> texture A   (pure ALU, no reads)
//   B  diffuse + dither + wisps -> texture B   (23 taps + 1 fetch, then pointwise)
//   C  glyph grid     -> screen      (3 taps)
//
// Stage boundaries that were separate 8-bit render targets are reproduced with
// an explicit quantize(), so fusing does not brighten the saturated beam core
// or shift which side of a dither level a pixel lands on.

const BLUE_NOISE_SRC = new URL("./blue-noise-128.png", import.meta.url).href;

// Shader-time per wall-clock second. The layer speeds these come from (0.25 and
// 0.56) were applied once per frame at a nominal 60fps, so driving them off
// elapsed time instead keeps the same pace without slowing down under load.
const BEAM_TIME_RATE = 0.25 * 60;
const WISP_TIME_RATE = 0.56 * 60;

// The beams fade in from nothing on first paint.
const APPEAR_MS = 1000;
const BEAM_THICKNESS = [0.28, 0.16, 0.16];

// Grain controls, in CSS pixels. They get multiplied by the render scale, so a
// 2x display renders the same texture with crisper edges rather than a finer
// one that the browser would just average away on the way to the screen.
const GLYPH_CELL_CSS = 4; // halftone dot pitch
const NOISE_CELL_CSS = 1; // blue-noise texel size
const DITHER_STEP = 0.11; // quantisation step the dither breaks up
const GLYPH_AMOUNT = 0.45; // how much halftone is blended over the scene

// Pointer interaction. MAX_RIPPLES must match the #define in the shader.
const MAX_RIPPLES = 4;
const RIPPLE_LIFE_S = 2.6; // must outlast the shader's exp(-age * 1.15) decay
const POINTER_FOLLOW = 9; // exponential catch-up rate, per second
const POINTER_FADE = 5; // how fast presence eases in/out
const POINTER_MARGIN = 120; // px of slack outside the hero that still counts as "near"

// Which figure the beam pass draws. The value is the shader's uShape, so the
// order has to match the SHAPE_* defines in crossBeamShaders.js.
export const CROSS_BEAM_SHAPES = Object.freeze({
  cross: 0,
  ring: 1,
  frame: 2,
  x: 3,
});

/** @type {Readonly<{ variant: keyof typeof CROSS_BEAM_SHAPES, speed: number, beamWidth: number, dither: number, glyphSize: number, glyphAmount: number, noiseScale: number, hue: number }>} */
export const CROSS_BEAM_DEFAULTS = Object.freeze({
  variant: "cross",
  speed: 1,
  beamWidth: 1,
  dither: DITHER_STEP,
  glyphSize: GLYPH_CELL_CSS,
  glyphAmount: GLYPH_AMOUNT,
  noiseScale: NOISE_CELL_CSS,
  hue: 0,
});

const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

const easeInOutQuart = (t) => (t < 0.5 ? 8.0 * t * t * t * t : 1.0 - 8.0 * (1.0 - t) ** 4);

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Hero beam shader failed to compile: ${log}`);
  }
  return shader;
}

function createProgram(gl, fragmentSource) {
  const program = gl.createProgram();
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Hero beam program failed to link: ${log}`);
  }
  return program;
}

function createTarget(gl, width, height) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { texture, framebuffer };
}

/**
 * @param {{
 *   variant?: "cross" | "ring" | "frame" | "x",
 *   speed?: number,
 *   beamWidth?: number,
 *   dither?: number,
 *   glyphSize?: number,
 *   glyphAmount?: number,
 *   noiseScale?: number,
 *   hue?: number,
 *   className?: string,
 * }} props
 */
const ConfigurableCrossBeamBackground = ({
  variant = CROSS_BEAM_DEFAULTS.variant,
  speed = CROSS_BEAM_DEFAULTS.speed,
  beamWidth = CROSS_BEAM_DEFAULTS.beamWidth,
  dither = CROSS_BEAM_DEFAULTS.dither,
  glyphSize = CROSS_BEAM_DEFAULTS.glyphSize,
  glyphAmount = CROSS_BEAM_DEFAULTS.glyphAmount,
  noiseScale = CROSS_BEAM_DEFAULTS.noiseScale,
  hue = CROSS_BEAM_DEFAULTS.hue,
  className = "",
}) => {
  const mountRef = useRef(null);
  const canvasRef = useRef(null);
  const settingsRef = useRef(CROSS_BEAM_DEFAULTS);
  settingsRef.current = {
    shape: CROSS_BEAM_SHAPES[variant] ?? CROSS_BEAM_SHAPES[CROSS_BEAM_DEFAULTS.variant],
    speed: clamp(speed, 0, 2, CROSS_BEAM_DEFAULTS.speed),
    beamWidth: clamp(beamWidth, 0.4, 2, CROSS_BEAM_DEFAULTS.beamWidth),
    dither: clamp(dither, 0.03, 0.25, CROSS_BEAM_DEFAULTS.dither),
    glyphSize: clamp(glyphSize, 2, 8, CROSS_BEAM_DEFAULTS.glyphSize),
    glyphAmount: clamp(glyphAmount, 0, 1, CROSS_BEAM_DEFAULTS.glyphAmount),
    noiseScale: clamp(noiseScale, 0.5, 4, CROSS_BEAM_DEFAULTS.noiseScale),
    hue: clamp(hue, -180, 180, CROSS_BEAM_DEFAULTS.hue),
  };

  useEffect(() => {
    const mount = mountRef.current;
    const canvas = canvasRef.current;
    if (!mount || !canvas || typeof window === "undefined") return undefined;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      mount.dataset.webglState = "unavailable";
      return undefined;
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    // Render above CSS resolution so the halftone edges stay crisp. Capped at
    // 1.5x — measured side by side, 2x is indistinguishable once the browser
    // has scaled it back down, and costs ~60% more fragment work.
    const dpr = window.devicePixelRatio || 1;
    const maxScale = isCoarsePointer ? 1.25 : 1.5;
    let renderScale = Math.min(dpr, maxScale);
    const frameInterval = 1000 / (isCoarsePointer ? 24 : 30);

    let programs = null;
    let targets = [];
    let blueNoise = null;
    let vao = null;
    let width = 0;
    let height = 0;
    let rafId = 0;
    let isVisible = false;
    let isDisposed = false;
    let startTime = 0;
    let lastFrameTime = 0;
    let lastElapsed = 0;
    let budgetSamples = 0;
    let budgetMisses = 0;

    // Pointer state. `target` is where the cursor actually is, `x`/`y` chase it
    // so the chaos patch glides instead of snapping between throttled frames.
    const pointer = {
      targetX: 0.5,
      targetY: 0.5,
      x: 0.5,
      y: 0.5,
      targetAmount: 0,
      amount: 0,
    };
    const ripples = []; // { x, y, bornMs }
    const rippleBuffer = new Float32Array(MAX_RIPPLES * 3);
    // A zeroed slot reads as a live ripple at uv (0, 0) with age 0, which bends
    // the bottom-left corner of the very first static frame — that frame is
    // drawn before stepPointer has ever run, so seed every slot idle.
    for (let i = 0; i < MAX_RIPPLES; i += 1) rippleBuffer[i * 3 + 2] = -1;

    const setAnimationActive = (active) => {
      canvas.dataset.animationActive = active ? "true" : "false";
    };

    try {
      programs = {
        beam: createProgram(gl, BEAM_FRAGMENT),
        atmosphere: createProgram(gl, ATMOSPHERE_FRAGMENT),
        glyph: createProgram(gl, GLYPH_FRAGMENT),
      };
    } catch (error) {
      mount.dataset.webglState = "error";
      if (import.meta.env.DEV) console.warn(error);
      return undefined;
    }

    const uniforms = {
      beam: {
        thickness: gl.getUniformLocation(programs.beam, "uThickness"),
        time: gl.getUniformLocation(programs.beam, "uTime"),
        shape: gl.getUniformLocation(programs.beam, "uShape"),
      },
      atmosphere: {
        scene: gl.getUniformLocation(programs.atmosphere, "uScene"),
        blueNoise: gl.getUniformLocation(programs.atmosphere, "uBlueNoise"),
        resolution: gl.getUniformLocation(programs.atmosphere, "uResolution"),
        time: gl.getUniformLocation(programs.atmosphere, "uTime"),
        noiseScale: gl.getUniformLocation(programs.atmosphere, "uNoiseScale"),
        ditherStep: gl.getUniformLocation(programs.atmosphere, "uDitherStep"),
      },
      glyph: {
        scene: gl.getUniformLocation(programs.glyph, "uScene"),
        resolution: gl.getUniformLocation(programs.glyph, "uResolution"),
        gridSize: gl.getUniformLocation(programs.glyph, "uGridSize"),
        glyphAmount: gl.getUniformLocation(programs.glyph, "uGlyphAmount"),
      },
    };

    // Shared pointer uniforms live in the prelude, so every program declares
    // them. A program that optimises one out returns null and is skipped.
    const pointerUniforms = Object.fromEntries(
      Object.entries(programs).map(([name, program]) => [
        name,
        {
          aspect: gl.getUniformLocation(program, "uAspect"),
          pointer: gl.getUniformLocation(program, "uPointer"),
          pointerAmount: gl.getUniformLocation(program, "uPointerAmount"),
          chaosTime: gl.getUniformLocation(program, "uChaosTime"),
          ripples: gl.getUniformLocation(program, "uRipples[0]"),
        },
      ]),
    );

    // The vertex shader builds its own triangle from gl_VertexID, but WebGL2
    // still needs a bound VAO to draw.
    vao = gl.createVertexArray();
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    // A flat mid-grey stands in until the real noise decodes, so the very first
    // frames dither evenly instead of flashing an unquantized image.
    blueNoise = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, blueNoise);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    const noiseImage = new Image();
    noiseImage.decoding = "async";
    noiseImage.onload = () => {
      if (isDisposed || gl.isContextLost()) return;
      gl.bindTexture(gl.TEXTURE_2D, blueNoise);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, noiseImage);
      if (!rafId) renderStaticFrame();
    };
    noiseImage.src = BLUE_NOISE_SRC;

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(rect.width * renderScale));
      const nextHeight = Math.max(1, Math.round(rect.height * renderScale));
      if (nextWidth === width && nextHeight === height) return false;
      width = nextWidth;
      height = nextHeight;
      canvas.width = width;
      canvas.height = height;
      targets.forEach((target) => {
        gl.deleteTexture(target.texture);
        gl.deleteFramebuffer(target.framebuffer);
      });
      targets = [createTarget(gl, width, height), createTarget(gl, width, height)];
      return true;
    };

    // Advance the smoothed pointer and expire finished ripples. Frame-rate
    // independent so the glide feels the same at 24 and 30fps.
    const stepPointer = (deltaS, nowMs) => {
      const follow = 1 - Math.exp(-POINTER_FOLLOW * deltaS);
      pointer.x += (pointer.targetX - pointer.x) * follow;
      pointer.y += (pointer.targetY - pointer.y) * follow;
      pointer.amount += (pointer.targetAmount - pointer.amount) * (1 - Math.exp(-POINTER_FADE * deltaS));

      for (let i = ripples.length - 1; i >= 0; i -= 1) {
        if ((nowMs - ripples[i].bornMs) / 1000 > RIPPLE_LIFE_S) ripples.splice(i, 1);
      }
      rippleBuffer.fill(0);
      for (let i = 0; i < MAX_RIPPLES; i += 1) {
        const ripple = ripples[i];
        rippleBuffer[i * 3] = ripple ? ripple.x : 0;
        rippleBuffer[i * 3 + 1] = ripple ? ripple.y : 0;
        rippleBuffer[i * 3 + 2] = ripple ? (nowMs - ripple.bornMs) / 1000 : -1;
      }
    };

    const uploadPointer = (name, seconds) => {
      const slots = pointerUniforms[name];
      if (slots.aspect) gl.uniform2f(slots.aspect, width / height, 1);
      if (slots.pointer) gl.uniform2f(slots.pointer, pointer.x, pointer.y);
      if (slots.pointerAmount) gl.uniform1f(slots.pointerAmount, pointer.amount);
      if (slots.chaosTime) gl.uniform1f(slots.chaosTime, seconds);
      if (slots.ripples) gl.uniform3fv(slots.ripples, rippleBuffer);
    };

    const renderFrame = (elapsedMs) => {
      if (!targets.length) return;
      const appear = easeInOutQuart(Math.min(1, elapsedMs / APPEAR_MS));
      const seconds = elapsedMs / 1000;
      const settings = settingsRef.current;

      gl.bindVertexArray(vao);
      gl.viewport(0, 0, width, height);

      // Pass A — beams.
      gl.useProgram(programs.beam);
      uploadPointer("beam", seconds * settings.speed);
      gl.uniform3f(
        uniforms.beam.thickness,
        BEAM_THICKNESS[0] * appear * settings.beamWidth,
        BEAM_THICKNESS[1] * appear * settings.beamWidth,
        BEAM_THICKNESS[2] * appear * settings.beamWidth,
      );
      gl.uniform1f(uniforms.beam.time, seconds * BEAM_TIME_RATE * settings.speed);
      gl.uniform1i(uniforms.beam.shape, settings.shape);
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets[0].framebuffer);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Pass B — diffuse, dither, wisps.
      gl.useProgram(programs.atmosphere);
      uploadPointer("atmosphere", seconds * settings.speed);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets[0].texture);
      gl.uniform1i(uniforms.atmosphere.scene, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, blueNoise);
      gl.uniform1i(uniforms.atmosphere.blueNoise, 1);
      gl.uniform2f(uniforms.atmosphere.resolution, width, height);
      gl.uniform1f(uniforms.atmosphere.time, seconds * WISP_TIME_RATE * settings.speed);
      gl.uniform1f(uniforms.atmosphere.noiseScale, settings.noiseScale * renderScale);
      gl.uniform1f(uniforms.atmosphere.ditherStep, settings.dither);
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets[1].framebuffer);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Pass C — halftone grid, straight to the canvas. uGridSize is a fraction
      // of the frame height, so derive it from the wanted cell size in pixels.
      gl.useProgram(programs.glyph);
      uploadPointer("glyph", seconds * settings.speed);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets[1].texture);
      gl.uniform1i(uniforms.glyph.scene, 0);
      gl.uniform2f(uniforms.glyph.resolution, width, height);
      gl.uniform1f(uniforms.glyph.gridSize, (settings.glyphSize * renderScale) / height);
      gl.uniform1f(uniforms.glyph.glyphAmount, settings.glyphAmount);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    // One-shot safety valve for GPUs slower than anything available to test on:
    // if we are persistently missing the frame budget, drop to CSS resolution
    // and stop measuring. Only ever steps down, so it cannot oscillate.
    const checkBudget = (now) => {
      if (renderScale <= 1 || budgetSamples < 0) return;
      if (now - startTime < 2000) return; // ignore start-up jank
      budgetSamples += 1;
      if (now - lastFrameTime > frameInterval * 1.8) budgetMisses += 1;
      if (budgetSamples < 45) return;
      if (budgetMisses > budgetSamples * 0.4) {
        renderScale = 1;
        width = 0; // force resize() to rebuild at the new scale
        resize();
      }
      budgetSamples = -1; // done deciding, either way
    };

    const tick = (now) => {
      if (isDisposed) return;
      rafId = window.requestAnimationFrame(tick);
      if (now - lastFrameTime < frameInterval) return;
      checkBudget(now);
      const deltaS = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, 0.1) : 1 / 60;
      lastFrameTime = now;
      lastElapsed = now - startTime;
      stepPointer(deltaS, now);
      renderFrame(lastElapsed);
    };

    const stop = () => {
      if (!rafId) return;
      window.cancelAnimationFrame(rafId);
      rafId = 0;
      setAnimationActive(false);
    };

    const renderStaticFrame = () => {
      if (isDisposed || gl.isContextLost()) return;
      // Reduced motion still gets the artwork, just frozen past its intro.
      renderFrame(Math.max(lastElapsed, APPEAR_MS));
      setAnimationActive(false);
    };

    const syncPlayback = () => {
      const shouldRun = !isDisposed && isVisible && !document.hidden && !gl.isContextLost();
      if (!shouldRun) {
        stop();
        return;
      }
      if (reducedMotionQuery.matches) {
        stop();
        renderStaticFrame();
        return;
      }
      if (rafId) return;
      // Resume where the scene left off rather than restarting the intro.
      startTime = performance.now() - lastElapsed;
      lastFrameTime = 0;
      setAnimationActive(true);
      rafId = window.requestAnimationFrame(tick);
    };

    const onVisibilityChange = () => syncPlayback();
    const onContextLost = (event) => {
      event.preventDefault();
      stop();
      mount.dataset.webglState = "lost";
    };

    // The hero is pointer-events: none so it never steals clicks from the copy
    // sitting on top of it, which also means it never receives pointer events.
    // Listen on the window instead and map into the mount's box.
    const pointerUvFromEvent = (event) => {
      const rect = mount.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      return {
        x: (event.clientX - rect.left) / rect.width,
        // uv is y-up; clientY is y-down.
        y: 1 - (event.clientY - rect.top) / rect.height,
        near:
          event.clientX >= rect.left - POINTER_MARGIN &&
          event.clientX <= rect.right + POINTER_MARGIN &&
          event.clientY >= rect.top - POINTER_MARGIN &&
          event.clientY <= rect.bottom + POINTER_MARGIN,
      };
    };

    const onPointerMove = (event) => {
      if (event.pointerType === "touch") return; // no hover to track
      if (reducedMotionQuery.matches) return;
      const uv = pointerUvFromEvent(event);
      if (!uv) return;
      pointer.targetX = uv.x;
      pointer.targetY = uv.y;
      pointer.targetAmount = uv.near ? 1 : 0;
    };

    const onPointerLeave = () => {
      pointer.targetAmount = 0;
    };

    const onPointerDown = (event) => {
      // The reduced-motion path renders one frozen frame, so a ripple would
      // stick mid-expansion instead of playing out. Skip it entirely.
      if (reducedMotionQuery.matches) return;
      const uv = pointerUvFromEvent(event);
      if (!uv || !uv.near) return;
      // Snap the pull to the press so the ripple starts from where it landed.
      pointer.targetX = uv.x;
      pointer.targetY = uv.y;
      if (event.pointerType !== "touch") pointer.targetAmount = 1;
      ripples.push({ x: uv.x, y: uv.y, bornMs: performance.now() });
      if (ripples.length > MAX_RIPPLES) ripples.shift();
      // A press while parked offscreen would otherwise never be drawn.
      syncPlayback();
    };

    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        isVisible = entries.some((entry) => entry.isIntersecting);
        syncPlayback();
      },
      { threshold: 0.01 },
    );
    const resizeObserver = new ResizeObserver(() => {
      if (resize() && !rafId) renderStaticFrame();
    });

    resize();
    const initialBounds = mount.getBoundingClientRect();
    isVisible = initialBounds.bottom > 0 && initialBounds.top < window.innerHeight;
    visibilityObserver.observe(mount);
    resizeObserver.observe(mount);
    document.addEventListener("visibilitychange", onVisibilityChange);
    reducedMotionQuery.addEventListener?.("change", syncPlayback);
    canvas.addEventListener("webglcontextlost", onContextLost);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    setAnimationActive(false);
    syncPlayback();

    return () => {
      isDisposed = true;
      stop();
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotionQuery.removeEventListener?.("change", syncPlayback);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerleave", onPointerLeave);
      noiseImage.onload = null;
      targets.forEach((target) => {
        gl.deleteTexture(target.texture);
        gl.deleteFramebuffer(target.framebuffer);
      });
      if (blueNoise) gl.deleteTexture(blueNoise);
      if (vao) gl.deleteVertexArray(vao);
      Object.values(programs).forEach((program) => gl.deleteProgram(program));
      // Deliberately no WEBGL_lose_context here: getContext() on this canvas
      // would keep returning the dead context, so a remount (StrictMode's
      // double-invoke, or a route change back) could never compile again.
      delete canvas.dataset.animationActive;
      delete mount.dataset.webglState;
    };
  }, []);

  return (
    <div ref={mountRef} className={`threeui-mount ${className}`.trim()} aria-hidden="true">
      <canvas ref={canvasRef} className="cross-beam-canvas" style={{ filter: `hue-rotate(${settingsRef.current.hue}deg)` }} />
    </div>
  );
};

export default ConfigurableCrossBeamBackground;

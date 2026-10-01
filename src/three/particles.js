/**
 * The drifting particle cloud behind the hero.
 *
 * PERFORMANCE MODEL
 * -----------------
 * This is ONE `THREE.Points` object = ONE draw call, regardless of whether
 * it holds 300 particles or 30,000. All of the motion happens on the GPU in
 * the vertex shader: the CPU's only per-frame job is to write three floats
 * (time + pointer x/y) into uniforms. There is no per-particle JavaScript,
 * no attribute re-upload, and no garbage generated in the loop.
 *
 * CUSTOMISING
 * -----------
 * Every tunable is in ./config.js under `particles`. The one thing worth
 * editing *here* is the `flow()` function in the vertex shader — that single
 * function defines the entire character of the movement. Swap it for a
 * different field and the whole scene changes personality.
 */

import {
  AdditiveBlending,
  NormalBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
  Vector2,
} from 'three';

import { CONFIG } from './config.js';

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uAmplitude;
  uniform float uScale;
  uniform float uRadius;
  uniform vec2  uPointer;
  uniform float uRepel;

  attribute float aScale;
  attribute float aSeed;

  varying float vRadial;
  varying float vTwinkle;

  /**
   * The flow field.
   * ---------------
   * A cheap divergence-light trig field. Every axis is driven by the OTHER
   * two axes, which is what stops the result looking like a grid of sine
   * waves and makes it read as organic drift instead.
   *
   * This is deliberately not simplex noise: three sin/cos pairs cost a
   * fraction of a noise lookup and, for slow ambient motion at this scale,
   * are visually indistinguishable.
   */
  vec3 flow(vec3 p, float t) {
    return vec3(
      sin(p.y * 1.10 + t)        * cos(p.z * 0.90 - t * 0.60),
      sin(p.z * 1.30 - t * 0.80) * cos(p.x * 1.00 + t * 0.40),
      sin(p.x * 0.90 + t * 0.70) * cos(p.y * 1.20 - t * 0.50)
    );
  }

  void main() {
    vec3 pos = position;

    // Normalised distance from the centre of the cloud, used for colouring.
    vRadial = clamp(length(pos) / uRadius, 0.0, 1.0);

    // --- Ambient drift ---------------------------------------------------
    pos += flow(pos * uScale, uTime + aSeed * 6.2831) * uAmplitude;

    // --- Cursor repulsion ------------------------------------------------
    // Particles ease out of the way of the pointer. The falloff is smooth,
    // so the bubble has no visible edge.
    if (uRepel > 0.0) {
      vec2 toPointer = pos.xy - uPointer;
      float dist = length(toPointer);
      float influence = 1.0 - smoothstep(0.0, uRepel, dist);
      pos.xy += normalize(toPointer + 1e-5) * influence * uRepel * 0.55;
      pos.z  += influence * 0.35;
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Perspective-correct point size: distant particles shrink.
    gl_PointSize = uSize * aScale * uPixelRatio * (1.0 / max(-mvPosition.z, 0.001));

    // A slow, per-particle brightness shimmer. Sold as "twinkle", actually
    // just an out-of-phase sine — but it is what keeps the field alive when
    // the pointer is idle.
    vTwinkle = 0.55 + 0.45 * sin(uTime * 1.4 + aSeed * 40.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColorInner;
  uniform vec3 uColorOuter;

  varying float vRadial;
  varying float vTwinkle;

  void main() {
    // Turn the square point sprite into a soft round dot. Cheaper and
    // sharper than sampling a texture, and there is no asset to load.
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.06, d);
    if (alpha < 0.01) discard;

    vec3 color = mix(uColorInner, uColorOuter, smoothstep(0.15, 1.0, vRadial));

    // Fade the outermost particles so the cloud has no hard boundary.
    float edgeFade = 1.0 - smoothstep(0.72, 1.0, vRadial);

    gl_FragColor = vec4(color, alpha * vTwinkle * edgeFade * 0.9);
  }
`;

/**
 * @param {object} opts
 * @param {number} opts.count      Particle count (already scaled for device).
 * @param {number} opts.pixelRatio Clamped device pixel ratio.
 */
export function createParticles({ count, pixelRatio }) {
  const { particles, palette } = CONFIG;

  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const seeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Seed points inside a sphere. The cube-root on the radius gives a
    // uniform volumetric distribution; without it everything clumps at the
    // centre and the cloud looks like a ball of fluff.
    const r = particles.radius * Math.cbrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const sinPhi = Math.sin(phi);

    positions[i * 3 + 0] = r * sinPhi * Math.cos(theta);
    positions[i * 3 + 1] = r * sinPhi * Math.sin(theta) * 0.75; // flatten Y
    positions[i * 3 + 2] = r * Math.cos(phi);

    // Squaring biases toward small particles, leaving a few big ones to
    // read as foreground. A flat random() looks uniform and lifeless.
    scales[i] = 0.35 + Math.random() ** 2 * 1.5;
    seeds[i] = Math.random();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aScale', new BufferAttribute(scales, 1));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
  // We animate entirely in the shader, so Three's automatic bounding sphere
  // would be wrong anyway. Setting it manually skips a per-frame recompute
  // and stops the cloud being frustum-culled mid-drift.
  geometry.boundingSphere = null;
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius = particles.radius * 2;

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,      // soft sprites must not occlude each other
    // See CONFIG.theme: additive glows on a dark page, but is invisible on
    // a light one, where normal alpha blending is the only option.
    blending: CONFIG.theme === 'light' ? NormalBlending : AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: particles.size },
      uPixelRatio: { value: pixelRatio },
      uAmplitude: { value: particles.flowAmplitude },
      uScale: { value: particles.flowScale },
      uRadius: { value: particles.radius },
      uPointer: { value: new Vector2(0, 0) },
      uRepel: { value: particles.cursorRepel },
      uColorInner: { value: new Color(palette.inner) },
      uColorOuter: { value: new Color(palette.outer) },
    },
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;

  return {
    object: points,

    /**
     * @param {number} elapsed Total seconds since start.
     * @param {number} dt      Clamped delta in seconds.
     * @param {object} pointer Smoothed pointer state.
     */
    update(elapsed, dt, pointer) {
      material.uniforms.uTime.value = elapsed * particles.flowSpeed * 8.0;
      material.uniforms.uPointer.value.set(pointer.worldX, pointer.worldY);
      points.rotation.y += particles.spin * dt;
    },

    setPixelRatio(ratio) {
      material.uniforms.uPixelRatio.value = ratio;
    },

    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

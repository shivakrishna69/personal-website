/**
 * The faceted "core" object floating at the centre of the hero.
 *
 * Two meshes sharing one geometry:
 *   1. a solid shell shaded with a fresnel rim (bright at grazing angles,
 *      transparent face-on — the classic "energy shield" read), and
 *   2. a wireframe cage at a slightly larger scale, which is what actually
 *      sells the object as faceted rather than as a blurry blob.
 *
 * Both use `flatShading`-style normals derived in the vertex shader, so the
 * facets stay crisp while the surface breathes.
 *
 * Set `core.enabled: false` in ./config.js to drop this entirely — it is the
 * second-cheapest thing to cut after particle count.
 */

import {
  AdditiveBlending,
  NormalBlending,
  BackSide,
  Color,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
} from 'three';

import { CONFIG } from './config.js';

/** See CONFIG.theme — additive is unusable on a light background. */
const BLENDING = CONFIG.theme === 'light' ? NormalBlending : AdditiveBlending;

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWobble;

  varying vec3 vNormalView;
  varying vec3 vPositionView;
  varying float vWave;

  void main() {
    // Breathe the surface along its own normals. Because the icosahedron is
    // low-poly, this reads as the whole object flexing rather than as a
    // rippling texture.
    float wave =
      sin(position.x * 2.1 + uTime * 0.9) *
      cos(position.y * 1.8 - uTime * 0.7) *
      sin(position.z * 2.4 + uTime * 0.5);

    vWave = wave;
    vec3 displaced = position + normal * wave * uWobble;

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    vPositionView = mvPosition.xyz;
    vNormalView = normalize(normalMatrix * normal);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform vec3  uRim;
  uniform float uOpacity;

  varying vec3 vNormalView;
  varying vec3 vPositionView;
  varying float vWave;

  void main() {
    vec3 viewDir = normalize(-vPositionView);

    // Fresnel: 0 when looking straight at a face, 1 at the silhouette.
    float fresnel = 1.0 - clamp(dot(viewDir, normalize(vNormalView)), 0.0, 1.0);
    fresnel = pow(fresnel, 2.4);

    // Body colour shifts with the breathing wave so the object never sits
    // at one flat hue.
    vec3 body = mix(uColorA, uColorB, 0.5 + 0.5 * vWave);
    vec3 color = mix(body, uRim, fresnel);

    // Mostly transparent through the middle, bright at the edges.
    float alpha = (0.12 + fresnel * 0.95) * uOpacity;

    gl_FragColor = vec4(color, alpha);
  }
`;

export function createCore() {
  const { core, palette } = CONFIG;
  const group = new Group();

  const geometry = new IcosahedronGeometry(core.radius, core.detail);

  const shellMaterial = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: BLENDING,
    uniforms: {
      uTime: { value: 0 },
      uWobble: { value: core.wobble },
      uColorA: { value: new Color(palette.inner) },
      uColorB: { value: new Color(palette.outer) },
      uRim: { value: new Color(palette.rim) },
      uOpacity: { value: core.opacity },
    },
  });

  const shell = new Mesh(geometry, shellMaterial);
  group.add(shell);

  // A second pass rendered from the inside gives the shell volume — you see
  // the far wall glowing through the near one.
  const innerMaterial = shellMaterial.clone();
  innerMaterial.side = BackSide;
  innerMaterial.uniforms.uOpacity.value = core.opacity * 0.45;
  const inner = new Mesh(geometry, innerMaterial);
  group.add(inner);

  // The wireframe cage. MeshBasicMaterial is used deliberately: it needs no
  // lighting, so the whole scene can run without a single Light object.
  const wireMaterial = new MeshBasicMaterial({
    color: new Color(palette.rim),
    wireframe: true,
    transparent: true,
    opacity: core.wireOpacity,
    depthWrite: false,
    blending: BLENDING,
  });
  const wire = new Mesh(geometry, wireMaterial);
  wire.scale.setScalar(1.32);
  group.add(wire);

  return {
    object: group,

    update(elapsed, dt, pointer) {
      shellMaterial.uniforms.uTime.value = elapsed;
      innerMaterial.uniforms.uTime.value = elapsed;

      // Idle spin, plus a lean toward the cursor. The pointer values are
      // already smoothed upstream, so this needs no easing of its own.
      const lean = CONFIG.pointer.rotationInfluence;
      group.rotation.y += core.spin * dt;
      group.rotation.x = pointer.y * lean;
      group.rotation.z = pointer.x * lean * 0.4;

      // Counter-rotate the cage so the two layers shear against each other.
      wire.rotation.y -= core.spin * 2.1 * dt;
      wire.rotation.x += core.spin * 0.8 * dt;
    },

    dispose() {
      geometry.dispose();
      shellMaterial.dispose();
      innerMaterial.dispose();
      wireMaterial.dispose();
    },
  };
}

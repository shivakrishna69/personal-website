/**
 * =============================================================================
 *  3D CANVAS — CONTROL PANEL
 * =============================================================================
 *  Everything you are likely to want to tweak about the hero's WebGL scene
 *  lives in this one file. Nothing here needs a rebuild to reason about:
 *  change a number, save, and Vite hot-reloads the scene.
 *
 *  QUICK RECIPES
 *  -------------
 *  • "Too busy"          → drop `particles.count` to ~1600 and
 *                          `particles.flowAmplitude` to ~0.18.
 *  • "Too slow on my
 *     laptop"            → drop `particles.count`, set
 *                          `renderer.maxPixelRatio` to 1.25, and set
 *                          `core.enabled` to false.
 *  • "Different brand
 *     colours"           → edit `palette`. These are the ONLY colours the 3D
 *                          layer knows about; keep them in sync with the
 *                          --color-accent* tokens in src/styles/main.css.
 *  • "Mouse feels laggy" → raise `pointer.damping` (higher = snappier).
 *                          `Infinity` would be instant-but-jittery; 6–10 is
 *                          the sweet spot for "smooth but responsive".
 *  • "Mouse feels twitchy"→ lower `pointer.damping` to ~3.5.
 *  • "I want it bigger /
 *     closer"            → lower `camera.distance` or raise `camera.fov`.
 *
 *  A NOTE ON UNITS
 *  ---------------
 *  All motion values are expressed *per second*, not per frame. The render
 *  loop multiplies them by delta-time, so the animation runs at exactly the
 *  same speed on a 60Hz laptop and a 144Hz monitor.
 * =============================================================================
 */

export const CONFIG = {
  /* ---------------------------------------------------------------------
   * PALETTE — hex values consumed by the shaders.
   * ------------------------------------------------------------------- */
  palette: {
    /** Particles nearest the centre of the cloud. */
    inner: '#5b46d9',
    /** Particles at the outer edge of the cloud. */
    outer: '#0d8ba6',
    /** Rim light on the central object. */
    rim: '#a83bc4',
  },

  /**
   * THEME — 'light' or 'dark'.
   *
   * This is not cosmetic; it changes the BLENDING MODE of every material.
   *
   *   dark  → additive blending. Overlapping particles add up to white,
   *           which is what produces the glow on a near-black page.
   *   light → normal alpha blending. Additive on a white page is invisible:
   *           white + anything is still white, so the whole scene vanishes.
   *
   * If you switch this, also swap `palette` above (light needs the darker,
   * higher-contrast hues; dark needs bright ones) and the --color-accent*
   * tokens in src/styles/main.css.
   */
  theme: 'light',

  /* ---------------------------------------------------------------------
   * CAMERA
   * ------------------------------------------------------------------- */
  camera: {
    fov: 42,
    near: 0.1,
    far: 100,
    /** Distance from origin on Z. Smaller = the scene fills more screen. */
    distance: 9,
    /** How far (in world units) the camera drifts with the pointer. */
    parallax: 1.15,
    /** Extra parallax applied on the Y axis as you scroll the hero away. */
    scrollDrift: 2.2,
  },

  /* ---------------------------------------------------------------------
   * POINTER — the smoothing model.
   *
   * We never assign the raw mouse position to the camera. Instead the raw
   * value becomes a *target*, and the actual value eases toward it every
   * frame with a frame-rate-independent exponential decay:
   *
   *     current += (target - current) * (1 - exp(-damping * dt))
   *
   * That is what makes the movement feel liquid rather than either
   * stuttery (raw) or laggy (naive lerp with a fixed alpha).
   * ------------------------------------------------------------------- */
  pointer: {
    /** Higher = follows the cursor more closely. Try 3 (dreamy) to 12 (tight). */
    damping: 6.5,
    /** Multiplier on how much the central object rotates toward the cursor. */
    rotationInfluence: 0.32,
  },

  /* ---------------------------------------------------------------------
   * PARTICLE FIELD — the drifting star cloud.
   * Rendered as a single THREE.Points draw call with a custom shader, so
   * 3,200 particles cost roughly the same as 32 would.
   * ------------------------------------------------------------------- */
  particles: {
    /** Particle count. The single biggest performance lever in the scene. */
    count: 2600,
    /** Radius of the spherical volume they are seeded into. */
    radius: 7.5,
    /** Base point size in pixels (scaled by distance in the vertex shader). */
    size: 8.5,
    /** Strength of the flow-field displacement. 0 = a frozen sphere. */
    flowAmplitude: 0.34,
    /** Spatial frequency of the flow field. Higher = tighter, noisier curls. */
    flowScale: 0.55,
    /** Speed of the drift, in radians/second. */
    flowSpeed: 0.12,
    /** Constant Y-axis spin of the whole cloud, radians/second. */
    spin: 0.035,
    /** Radius (in world units) of the cursor's repulsion bubble. 0 disables. */
    cursorRepel: 1.9,
  },

  /* ---------------------------------------------------------------------
   * CORE — the faceted object at the centre of the hero.
   * ------------------------------------------------------------------- */
  core: {
    /** Set to false to ship only the particle field (cheapest option). */
    enabled: true,
    /** Icosahedron subdivision. 0 = 20 faces, 3 = 1,280. Keep low: the
     *  facets are the point of the look. */
    detail: 1,
    radius: 1.65,
    /** Idle rotation, radians/second, applied on top of pointer rotation. */
    spin: 0.16,
    /** Vertex displacement amount — makes it breathe rather than sit still. */
    wobble: 0.12,
    /** Opacity of the solid fresnel shell. */
    opacity: 0.4,
    /** Opacity of the wireframe cage drawn just outside it. */
    wireOpacity: 0.22,
  },

  /* ---------------------------------------------------------------------
   * RENDERER
   * ------------------------------------------------------------------- */
  renderer: {
    /**
     * Retina screens report devicePixelRatio 2–3. Rendering a full-screen
     * WebGL scene at 3x costs ~9x the fragments of 1x for a difference
     * almost nobody can see on a soft particle field. Clamping is the
     * single highest-value performance decision in the whole scene.
     */
    maxPixelRatio: 1.75,
    /** MSAA. Auto-disabled below on high-DPR screens where it is redundant. */
    antialias: true,
    /** Global opacity of the canvas element itself. */
    opacity: 0.85,
  },

  /* ---------------------------------------------------------------------
   * PERFORMANCE GUARDS
   * ------------------------------------------------------------------- */
  performance: {
    /**
     * Below this viewport width the scene halves its particle count and
     * drops the core object. Phones get the atmosphere without the battery
     * drain.
     */
    mobileBreakpoint: 768,
    /** Particle-count multiplier applied below that breakpoint. */
    mobileParticleScale: 0.45,
    /**
     * If the measured frame time stays above this (ms) for a sustained
     * stretch, the scene degrades itself once: pixel ratio drops to 1.
     * 22ms ≈ below 45fps.
     */
    degradeFrameMs: 22,
    /** How many consecutive slow frames before degrading. */
    degradeAfterFrames: 90,
  },
};

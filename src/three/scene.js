/**
 * =============================================================================
 *  SCENE BOOTSTRAP
 * =============================================================================
 *  Owns the renderer, the camera, the render loop, and the lifecycle of every
 *  3D object. Nothing outside this module talks to Three.js directly.
 *
 *  The loop is built around four rules that keep it smooth:
 *
 *  1. DELTA-TIME EVERYWHERE. Motion is per-second, never per-frame, so the
 *     scene runs identically at 60Hz and 144Hz.
 *  2. CLAMP THE DELTA. After a tab switch or a long task the browser hands
 *     you a delta of several seconds. Un-clamped, that teleports the whole
 *     scene. We cap it at 50ms.
 *  3. NEVER RENDER WHAT NOBODY SEES. An IntersectionObserver stops the loop
 *     the moment the canvas scrolls out of view, and `visibilitychange`
 *     stops it when the tab is hidden. On a long portfolio page that is most
 *     of the session.
 *  4. NO ALLOCATION IN THE LOOP. Every vector and colour is created once at
 *     setup. Allocating inside `tick()` hands the GC work 60 times a second,
 *     which is exactly what produces the periodic stutter people describe as
 *     "the 3D is laggy".
 * =============================================================================
 */

import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';

import { CONFIG } from './config.js';
import { createCore } from './core.js';
import { createParticles } from './particles.js';
import { createPointer } from './pointer.js';

/** Feature-detect WebGL so we can fail soft instead of throwing. */
function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch {
    return false;
  }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {{ dispose: () => void } | null} null when WebGL is unavailable —
 *          the CSS gradient backdrop alone still looks intentional.
 */
export function initScene(canvas) {
  if (!canvas || !supportsWebGL()) return null;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.innerWidth < CONFIG.performance.mobileBreakpoint;

  // ---- Renderer -----------------------------------------------------------
  let pixelRatio = Math.min(window.devicePixelRatio || 1, CONFIG.renderer.maxPixelRatio);

  const renderer = new WebGLRenderer({
    canvas,
    // A transparent canvas lets the CSS gradient wash show through, which is
    // what gives the scene its depth without any post-processing.
    alpha: true,
    // MSAA is redundant once you are rendering above ~1.5x, and it is not
    // free. Spend the budget on resolution instead.
    antialias: CONFIG.renderer.antialias && pixelRatio < 1.5,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
  });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  // ---- Scene & camera -----------------------------------------------------
  const scene = new Scene();

  const camera = new PerspectiveCamera(
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    CONFIG.camera.near,
    CONFIG.camera.far,
  );
  camera.position.set(0, 0, CONFIG.camera.distance);

  // ---- Objects ------------------------------------------------------------
  const particleCount = Math.round(
    CONFIG.particles.count * (isMobile ? CONFIG.performance.mobileParticleScale : 1),
  );

  const objects = [];

  const particles = createParticles({ count: particleCount, pixelRatio });
  scene.add(particles.object);
  objects.push(particles);

  // The core is the more expensive of the two (three meshes, two shader
  // passes), so phones skip it.
  let core = null;
  if (CONFIG.core.enabled && !isMobile) {
    core = createCore();
    scene.add(core.object);
    objects.push(core);
  }

  const pointer = createPointer(window);

  // ---- Resize -------------------------------------------------------------
  // Debounced via rAF: a window drag fires `resize` dozens of times per
  // second and each one would otherwise reallocate the drawing buffer.
  let resizeFrame = 0;
  function onResize() {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    });
  }
  window.addEventListener('resize', onResize, { passive: true });

  // ---- Visibility gating --------------------------------------------------
  let inView = true;
  let tabVisible = !document.hidden;
  let running = false;
  let rafId = 0;
  let lastTime = 0;
  let elapsed = 0;
  /** Cached so we only touch the DOM when the value actually changes. */
  let lastOpacity = -1;

  // ---- Hero-only visibility ------------------------------------------------
  // The canvas is `position: fixed`, so the IntersectionObserver further down
  // can never pause it: a fixed element always intersects the viewport. Left
  // alone the scene shows through every section beneath the hero, which is
  // what makes body copy and tech tags hard to read over it.
  //
  // This deliberately lives OUTSIDE the render loop. Under
  // prefers-reduced-motion the loop never starts, and a fade that only ran
  // inside tick() would leave the artwork at full strength across the whole
  // page for exactly the users least able to tolerate it.
  let fadeFrame = 0;
  function syncOpacity() {
    const progress = Math.min(window.scrollY / (window.innerHeight || 1), 1);
    // Squared, so the scene clears the content faster than a linear ramp.
    const next = CONFIG.renderer.opacity * Math.max(0, 1 - progress * progress);
    if (Math.abs(next - lastOpacity) < 0.002) return;
    lastOpacity = next;
    canvas.style.opacity = next.toFixed(3);
  }

  function onFadeScroll() {
    if (fadeFrame) return;
    fadeFrame = requestAnimationFrame(() => {
      fadeFrame = 0;
      syncOpacity();
    });
  }

  window.addEventListener('scroll', onFadeScroll, { passive: true });
  window.addEventListener('resize', onFadeScroll, { passive: true });
  syncOpacity();

  const observer = new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      syncRunning();
    },
    { threshold: 0 },
  );
  observer.observe(canvas);

  function onVisibility() {
    tabVisible = !document.hidden;
    syncRunning();
  }
  document.addEventListener('visibilitychange', onVisibility);

  function syncRunning() {
    const shouldRun = inView && tabVisible && !prefersReducedMotion;
    if (shouldRun === running) return;
    running = shouldRun;
    if (running) {
      lastTime = performance.now();
      rafId = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  // ---- Adaptive degradation ----------------------------------------------
  // If the device simply cannot keep up, drop resolution once rather than
  // letting the whole page stutter. This fires at most a single time.
  let slowFrames = 0;
  let hasDegraded = false;

  function monitor(frameMs) {
    if (hasDegraded) return;
    slowFrames = frameMs > CONFIG.performance.degradeFrameMs ? slowFrames + 1 : 0;
    if (slowFrames < CONFIG.performance.degradeAfterFrames) return;

    hasDegraded = true;
    pixelRatio = 1;
    renderer.setPixelRatio(pixelRatio);
    particles.setPixelRatio(pixelRatio);
  }

  // ---- Render loop --------------------------------------------------------
  function tick(now) {
    rafId = requestAnimationFrame(tick);

    const frameMs = now - lastTime;
    lastTime = now;

    // Rule 2: clamp. 50ms ≈ 20fps; anything slower is treated as 20fps so a
    // stall never teleports the animation.
    const dt = Math.min(frameMs, 50) / 1000;
    elapsed += dt;

    pointer.update(dt);

    // Fully faded out below the hero: keep the rAF alive so it resumes
    // instantly on scroll-up, but skip the draw call entirely. On a long
    // page this is most of the session, and it is the single biggest
    // saving in the whole scene.
    if (lastOpacity <= 0.001) return;

    // Camera parallax. Assigning directly (rather than easing here) is safe
    // because `pointer.x/y` are already smoothed.
    camera.position.x = pointer.x * CONFIG.camera.parallax;
    camera.position.y =
      pointer.y * CONFIG.camera.parallax * 0.65 - pointer.scroll * CONFIG.camera.scrollDrift;
    camera.lookAt(0, 0, 0);

    for (let i = 0; i < objects.length; i++) {
      objects[i].update(elapsed, dt, pointer);
    }

    renderer.render(scene, camera);
    monitor(frameMs);
  }

  // ---- First paint --------------------------------------------------------
  if (prefersReducedMotion) {
    // Honour the preference but still show the artwork: render one static
    // frame so the hero is not an empty rectangle.
    pointer.update(0.016);
    for (const object of objects) object.update(0, 0, pointer);
    renderer.render(scene, camera);
  } else {
    syncRunning();
  }

  // ---- Fade in ------------------------------------------------------------
  // The canvas starts at opacity 0 (set by a class in the markup) so there is
  // never a flash of an empty rectangle while the chunk downloads.
  //
  // Both the starting and ending opacity must be *observed* by the style
  // engine in separate frames, otherwise the browser coalesces them into a
  // single computed value and the transition never runs. Hence the rAF: it
  // guarantees the 0 has been committed before the target value lands.
  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity 1.4s var(--ease-out-expo)';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      canvas.style.opacity = String(CONFIG.renderer.opacity);
    });
  });

  // ---- Teardown -----------------------------------------------------------
  return {
    dispose() {
      cancelAnimationFrame(rafId);
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      observer.disconnect();
      if (fadeFrame) cancelAnimationFrame(fadeFrame);
      window.removeEventListener('scroll', onFadeScroll);
      window.removeEventListener('resize', onFadeScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      pointer.dispose();
      for (const object of objects) object.dispose();
      if (core) scene.remove(core.object);
      scene.remove(particles.object);
      renderer.dispose();
    },
  };
}

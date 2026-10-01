/**
 * Application entry point.
 *
 * Responsibilities, in order:
 *   1. Pull in the stylesheet (Vite extracts and minifies it at build time).
 *   2. Start the lightweight DOM interactions immediately — these are what
 *      the page needs in order to feel responsive on first paint.
 *   3. Defer the 3D scene. Three.js is ~150KB gzipped and it is decoration,
 *      not content, so it is dynamically imported *after* the browser is
 *      idle. The hero renders, reads, and is fully interactive before a
 *      single byte of WebGL code is parsed.
 */

import './styles/main.css';

import { initCursor } from './ui/cursor.js';
import { initExperience } from './ui/experience.js';
import { initFilter } from './ui/filter.js';
import { initMagnetic } from './ui/magnetic.js';
import { initCopyEmail, initNav } from './ui/nav.js';
import { initReveal } from './ui/reveal.js';
import { initTilt } from './ui/tilt.js';

/* -------------------------------------------------------------------------
 * 1. Immediate: DOM interactions
 * ---------------------------------------------------------------------- */
const teardowns = [
  // initExperience runs first: it writes the year/month figures into the DOM
  // before the reveal observer measures anything, so no layout shifts once
  // the numbers land.
  initExperience(),
  initNav(),
  initFilter(),
  initCursor(),
  initReveal(),
  initTilt(),
  initMagnetic(),
  initCopyEmail(),
];

// Set the footer year from the clock rather than hard-coding it.
const yearEl = document.querySelector('[data-year]');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

/* -------------------------------------------------------------------------
 * 2. Deferred: the WebGL hero
 * ---------------------------------------------------------------------- */
const canvas = document.querySelector('#webgl');

/**
 * `requestIdleCallback` waits for a genuine gap in the main thread. Safari
 * still lacks it, so fall back to a short timeout — either way the scene
 * loads after first contentful paint, never before it.
 */
const whenIdle = (fn) =>
  'requestIdleCallback' in window
    ? window.requestIdleCallback(fn, { timeout: 1200 })
    : setTimeout(fn, 260);

if (canvas) {
  whenIdle(async () => {
    try {
      const { initScene } = await import('./three/scene.js');
      const scene = initScene(canvas);

      if (scene) {
        teardowns.push(scene.dispose);
        // The scene owns its own fade-in (it is the only thing that knows
        // when it is actually ready to be looked at); we just drop the
        // utility class that was holding the canvas at zero.
        canvas.classList.remove('opacity-0');
      }
    } catch (error) {
      // A failed 3D layer must never take the page down with it. The CSS
      // gradient backdrop is a complete design on its own.
      console.warn('[portfolio] 3D scene unavailable, continuing without it.', error);
    }
  });
}

/* -------------------------------------------------------------------------
 * 3. Hot-module-replacement hygiene (dev only)
 * ---------------------------------------------------------------------- */
// Without this, every save would stack another render loop and another set of
// listeners on top of the last one, and the page would slowly grind to a halt.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const teardown of teardowns) teardown?.();
  });
}

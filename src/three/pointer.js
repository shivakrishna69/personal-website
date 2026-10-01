/**
 * Pointer tracker with frame-rate-independent smoothing.
 *
 * WHY THIS EXISTS
 * ---------------
 * Feeding raw `mousemove` coordinates straight into a 3D transform produces
 * motion that is technically instant but *feels* cheap: it jitters, it stops
 * dead, and it snaps between the sparse samples the OS actually delivers.
 * The common fix — `current += (target - current) * 0.1` — is worse in a
 * different way: the 0.1 is per *frame*, so the easing runs twice as fast on
 * a 120Hz display as on a 60Hz one, and it visibly lags on slow frames.
 *
 * The model below eases with an exponential decay integrated over real
 * elapsed time, so the perceived responsiveness is identical on every
 * refresh rate and unaffected by frame drops:
 *
 *     alpha   = 1 - exp(-damping * dt)
 *     current = current + (target - current) * alpha
 *
 * Listeners are passive and do nothing but store two floats, so they never
 * block scrolling and never enter the render path.
 */

import { CONFIG } from './config.js';

export function createPointer(element) {
  const state = {
    /** Raw target, normalised to -1..1 with (0,0) at the element's centre. */
    targetX: 0,
    targetY: 0,
    /** Smoothed values — this is what the scene should read. */
    x: 0,
    y: 0,
    /** Smoothed values in world-ish space, used for the repulsion bubble. */
    worldX: 0,
    worldY: 0,
    /** 0 at the top of the page, 1 once the hero is fully scrolled away. */
    scroll: 0,
    /** True while a touch gesture is driving the values. */
    isTouch: false,
  };

  function setFromClient(clientX, clientY) {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    state.targetX = (clientX / w) * 2 - 1;
    state.targetY = -((clientY / h) * 2 - 1);
  }

  const onPointerMove = (event) => {
    state.isTouch = event.pointerType === 'touch';
    // Touch already scrolls the page; letting it also drive parallax makes
    // the scene feel like it is fighting the user's finger.
    if (state.isTouch) return;
    setFromClient(event.clientX, event.clientY);
  };

  // When the cursor leaves the window, ease back to rest rather than freezing
  // wherever it happened to exit.
  const onPointerLeave = () => {
    state.targetX = 0;
    state.targetY = 0;
  };

  const onScroll = () => {
    const h = window.innerHeight || 1;
    state.scroll = Math.min(window.scrollY / h, 1);
  };

  element.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerleave', onPointerLeave, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /** Called once per rendered frame with the clamped delta in seconds. */
  state.update = (dt) => {
    const alpha = 1 - Math.exp(-CONFIG.pointer.damping * dt);
    state.x += (state.targetX - state.x) * alpha;
    state.y += (state.targetY - state.y) * alpha;
    // Rough projection of the cursor onto the z=0 plane, good enough for a
    // repulsion field and far cheaper than an actual Raycaster every frame.
    const reach = CONFIG.camera.distance * 0.42;
    state.worldX = state.x * reach * (window.innerWidth / window.innerHeight);
    state.worldY = state.y * reach;
  };

  state.dispose = () => {
    element.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerleave', onPointerLeave);
    window.removeEventListener('scroll', onScroll);
  };

  return state;
}

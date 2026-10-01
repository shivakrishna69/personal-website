/**
 * Magnetic buttons: elements marked `data-magnetic` drift toward the cursor
 * as it approaches, then spring back on exit.
 *
 * This is the micro-interaction that does the most work per line of code —
 * it makes a button feel like a physical object rather than a rectangle.
 *
 * Kept honest by two constraints:
 *   • Pull is capped at a few pixels. A button that follows the cursor across
 *     the screen is a toy; one that leans is a product.
 *   • The listener lives on the element, not the window, and the rect is
 *     measured on enter. Nothing runs while the cursor is elsewhere.
 */

const PULL = 0.28;   // fraction of the distance from centre to cursor
const MAX_PX = 14;   // hard cap on displacement

export function initMagnetic(selector = '[data-magnetic]') {
  const els = Array.from(document.querySelectorAll(selector));
  if (!els.length) return () => {};

  const fine = window.matchMedia('(pointer: fine)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduced) return () => {};

  const cleanups = [];

  for (const el of els) {
    let rect = null;
    let frame = 0;
    let cx = 0;
    let cy = 0;

    // The label moves further than the button itself. That tiny parallax is
    // what separates this from a plain translate.
    const label = el.querySelector('[data-magnetic-label]');

    const apply = () => {
      frame = 0;
      if (!rect) return;

      const dx = cx - (rect.left + rect.width / 2);
      const dy = cy - (rect.top + rect.height / 2);

      const x = Math.max(-MAX_PX, Math.min(MAX_PX, dx * PULL));
      const y = Math.max(-MAX_PX, Math.min(MAX_PX, dy * PULL));

      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      if (label) {
        label.style.transform = `translate3d(${(x * 0.35).toFixed(2)}px, ${(y * 0.35).toFixed(2)}px, 0)`;
      }
    };

    const onEnter = () => {
      rect = el.getBoundingClientRect();
      el.style.transition = 'transform 0.15s var(--ease-smooth), box-shadow 0.5s var(--ease-out-expo)';
    };

    const onMove = (event) => {
      cx = event.clientX;
      cy = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      rect = null;
      // A longer, springier easing on the way out sells the "release".
      el.style.transition = 'transform 0.7s var(--ease-out-expo), box-shadow 0.5s var(--ease-out-expo)';
      el.style.transform = '';
      if (label) label.style.transform = '';
    };

    el.addEventListener('pointerenter', onEnter, { passive: true });
    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', onLeave, { passive: true });

    cleanups.push(() => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.style.transform = '';
      el.style.transition = '';
    });
  }

  return () => cleanups.forEach((fn) => fn());
}

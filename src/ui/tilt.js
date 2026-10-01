/**
 * 3D card tilt.
 *
 * The JS here does as little as possible: it converts the pointer position
 * into four CSS custom properties (`--rx`, `--ry`, `--mx`, `--my`) and stops.
 * All of the actual visual work — the perspective transform and the spotlight
 * gradient — is declared once in main.css. That split matters:
 *
 *   • Writing a custom property that only feeds `transform` and `background`
 *     keeps the change on the compositor. No layout, no repaint of siblings.
 *   • Reads and writes are batched into a rAF callback, so we never trigger a
 *     synchronous style recalculation in the middle of a pointermove burst
 *     (the classic layout-thrash that makes tilt effects feel gummy).
 *   • `getBoundingClientRect()` is called on enter and invalidated on scroll,
 *     not called per move. That single change is usually the difference
 *     between a smooth tilt and a janky one.
 */

const MAX_TILT_DEG = 9; // Beyond ~10° the perspective distortion looks cheap.

export function initTilt(selector = '[data-tilt]') {
  const cards = Array.from(document.querySelectorAll(selector));
  if (!cards.length) return () => {};

  // Tilt is a pointer affordance. On touch there is no hover state to
  // respond to, and a transform that only fires on tap reads as a bug.
  const fine = window.matchMedia('(pointer: fine)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduced) return () => {};

  const cleanups = [];

  for (const card of cards) {
    let rect = null;
    let frame = 0;
    let pendingX = 0;
    let pendingY = 0;

    // Per-card override, e.g. data-tilt="4" for a calmer feature card.
    const strength = Number(card.dataset.tilt) || MAX_TILT_DEG;

    const apply = () => {
      frame = 0;
      if (!rect) return;

      // -0.5 .. 0.5 across each axis, with (0,0) at the card's centre.
      const px = (pendingX - rect.left) / rect.width - 0.5;
      const py = (pendingY - rect.top) / rect.height - 0.5;

      card.style.setProperty('--ry', `${(px * strength).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${(-py * strength).toFixed(2)}deg`);
      card.style.setProperty('--mx', `${((px + 0.5) * 100).toFixed(1)}%`);
      card.style.setProperty('--my', `${((py + 0.5) * 100).toFixed(1)}%`);
    };

    const onEnter = (event) => {
      rect = card.getBoundingClientRect();
      // Drop the transform transition while tracking so the card sits exactly
      // under the cursor instead of trailing it.
      card.classList.add('is-tilting');
      pendingX = event.clientX;
      pendingY = event.clientY;
      apply();
    };

    const onMove = (event) => {
      pendingX = event.clientX;
      pendingY = event.clientY;
      if (frame) return;          // coalesce every move within one frame
      frame = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      // Restoring the transition lets the card ease back to flat.
      card.classList.remove('is-tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
      rect = null;
    };

    // The cached rect goes stale the moment the page scrolls underneath the
    // cursor, so re-measure lazily instead of on every move.
    const onScroll = () => {
      if (rect) rect = card.getBoundingClientRect();
    };

    card.addEventListener('pointerenter', onEnter, { passive: true });
    card.addEventListener('pointermove', onMove, { passive: true });
    card.addEventListener('pointerleave', onLeave, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    cleanups.push(() => {
      if (frame) cancelAnimationFrame(frame);
      card.removeEventListener('pointerenter', onEnter);
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
    });
  }

  return () => cleanups.forEach((fn) => fn());
}

/**
 * Custom cursor: a hard dot that tracks exactly, plus a ring that trails it
 * with the same exponential smoothing used by the 3D scene.
 *
 * The contrast between the two is the whole effect — the dot proves the
 * cursor is precise, the ring supplies the weight. Both are positioned with
 * `translate3d` inside a single rAF loop, so this costs one composited layer
 * and no layout work at all.
 *
 * Elements opt into the enlarged "hover" ring with `data-cursor="hover"`.
 */

const RING_DAMPING = 14; // higher = the ring hugs the dot more tightly

export function initCursor() {
  // Pointer-fine only: a custom cursor on a touch device is a floating
  // artefact that never matches the finger.
  const fine = window.matchMedia('(pointer: fine)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduced) return () => {};

  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  dot.setAttribute('aria-hidden', 'true');
  ring.setAttribute('aria-hidden', 'true');
  document.body.append(dot, ring);

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let ringX = targetX;
  let ringY = targetY;
  let visible = false;
  let last = performance.now();
  let rafId = 0;

  const onMove = (event) => {
    targetX = event.clientX;
    targetY = event.clientY;
    if (!visible) {
      visible = true;
      // Snap the ring on first appearance so it does not fly in from centre.
      ringX = targetX;
      ringY = targetY;
      dot.style.opacity = '1';
      ring.style.opacity = '1';
    }
  };

  const onLeave = () => {
    visible = false;
    dot.style.opacity = '0';
    ring.style.opacity = '0';
  };

  // Delegated hover detection: one listener for the document instead of one
  // per interactive element, and it keeps working for anything added later.
  const onOver = (event) => {
    const hit = event.target.closest?.('[data-cursor="hover"], a, button');
    ring.classList.toggle('is-hovering', Boolean(hit));
  };

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(now - last, 50) / 1000;
    last = now;

    const alpha = 1 - Math.exp(-RING_DAMPING * dt);
    ringX += (targetX - ringX) * alpha;
    ringY += (targetY - ringY) * alpha;

    dot.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
    ring.style.transform = `translate3d(${ringX.toFixed(2)}px, ${ringY.toFixed(2)}px, 0)`;
  }

  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave, { passive: true });
  document.addEventListener('pointerover', onOver, { passive: true });
  rafId = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('pointerover', onOver);
    dot.remove();
    ring.remove();
  };
}

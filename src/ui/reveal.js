/**
 * Scroll-triggered reveals.
 *
 * One IntersectionObserver for the whole document rather than one per
 * element, and each element is unobserved the instant it has played. A
 * portfolio with 60 revealing elements therefore costs exactly one observer
 * and zero scroll listeners.
 *
 * Usage in markup:
 *   <div data-reveal>…</div>                     immediate
 *   <div data-reveal data-reveal-delay="120">…   delayed 120ms
 *   <ul data-reveal-group="90">                  auto-staggers its children
 */

export function initReveal() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Assign stagger delays declaratively before observing, so the CSS can own
  // the timing and JS never has to run a per-item timer.
  for (const group of document.querySelectorAll('[data-reveal-group]')) {
    const step = Number(group.dataset.revealGroup) || 80;
    const items = group.querySelectorAll('[data-reveal]');
    items.forEach((item, index) => {
      if (!item.dataset.revealDelay) {
        item.style.setProperty('--reveal-delay', `${index * step}ms`);
      }
    });
  }

  for (const el of document.querySelectorAll('[data-reveal-delay]')) {
    el.style.setProperty('--reveal-delay', `${el.dataset.revealDelay}ms`);
  }

  const targets = document.querySelectorAll('[data-reveal]');

  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        // Reveals are one-shot: stop watching immediately so the observer's
        // work shrinks as the user scrolls.
        observer.unobserve(entry.target);
      }
    },
    {
      // Fire slightly before the element reaches the fold, so content is
      // already settled by the time it is properly on screen.
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.08,
    },
  );

  targets.forEach((el) => observer.observe(el));

  return () => observer.disconnect();
}

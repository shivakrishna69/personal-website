/**
 * Navigation behaviour:
 *   • scroll-spy that marks the active section (IntersectionObserver, no
 *     scroll handler doing getBoundingClientRect on every tick),
 *   • the nav bar condensing once you leave the hero,
 *   • the mobile drawer, with focus and Escape handling,
 *   • a scroll-progress bar driven by one composited scaleX.
 */

export function initNav() {
  const header = document.querySelector('[data-nav]');
  const links = Array.from(document.querySelectorAll('[data-nav-link]'));
  const sections = links
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);
  const toggle = document.querySelector('[data-nav-toggle]');
  const drawer = document.querySelector('[data-nav-drawer]');
  const progress = document.querySelector('[data-scroll-progress]');

  const cleanups = [];

  /* ---- Scroll-spy ------------------------------------------------------ */
  if (sections.length && 'IntersectionObserver' in window) {
    // A band across the middle of the viewport: whichever section occupies
    // it is "current". This avoids the flicker you get when two sections are
    // both partly visible at the top of the screen.
    const spy = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = `#${entry.target.id}`;
          for (const link of links) {
            link.setAttribute('aria-current', String(link.getAttribute('href') === id));
          }
        }
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 },
    );
    sections.forEach((section) => spy.observe(section));
    cleanups.push(() => spy.disconnect());
  }

  /* ---- Condensed header + progress bar --------------------------------- */
  // Both derive from scrollY, so they share a single rAF-coalesced handler.
  let frame = 0;
  const onScroll = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const y = window.scrollY;

      if (header) header.classList.toggle('is-condensed', y > 40);

      if (progress) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = max > 0 ? Math.min(y / max, 1) : 0;
        progress.style.transform = `scaleX(${ratio.toFixed(4)})`;
      }
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  cleanups.push(() => {
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener('scroll', onScroll);
  });

  /* ---- Mobile drawer ---------------------------------------------------- */
  if (toggle && drawer) {
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      drawer.classList.toggle('pointer-events-none', !open);
      drawer.classList.toggle('opacity-0', !open);
      drawer.classList.toggle('-translate-y-3', !open);
      drawer.setAttribute('aria-hidden', String(!open));
      // Lock the page behind the drawer so the background does not scroll.
      document.body.style.overflow = open ? 'hidden' : '';
    };

    const onToggle = () => setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    const onKey = (event) => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    };
    // Any nav link inside the drawer closes it before the scroll begins.
    const onDrawerClick = (event) => {
      if (event.target.closest('a')) setOpen(false);
    };

    toggle.addEventListener('click', onToggle);
    document.addEventListener('keydown', onKey);
    drawer.addEventListener('click', onDrawerClick);
    setOpen(false);

    cleanups.push(() => {
      toggle.removeEventListener('click', onToggle);
      document.removeEventListener('keydown', onKey);
      drawer.removeEventListener('click', onDrawerClick);
      document.body.style.overflow = '';
    });
  }

  return () => cleanups.forEach((fn) => fn());
}

/**
 * Click-to-copy for the contact email, with inline confirmation.
 * Falls back silently to the plain `mailto:` behaviour if the Clipboard API
 * is unavailable or blocked (it requires a secure context).
 */
export function initCopyEmail() {
  const buttons = Array.from(document.querySelectorAll('[data-copy]'));
  if (!buttons.length) return () => {};

  const timers = new Map();

  const onClick = async (event) => {
    const button = event.currentTarget;
    const value = button.dataset.copy;
    if (!navigator.clipboard?.writeText) return;

    event.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return; // permission denied — leave the link to do its job
    }

    const label = button.querySelector('[data-copy-label]') || button;
    const original = label.dataset.original ?? label.textContent;
    label.dataset.original = original;
    label.textContent = 'Copied to clipboard';
    button.classList.add('is-copied');

    clearTimeout(timers.get(button));
    timers.set(
      button,
      setTimeout(() => {
        label.textContent = original;
        button.classList.remove('is-copied');
      }, 1800),
    );
  };

  buttons.forEach((button) => button.addEventListener('click', onClick));

  return () => {
    buttons.forEach((button) => button.removeEventListener('click', onClick));
    timers.forEach((id) => clearTimeout(id));
  };
}

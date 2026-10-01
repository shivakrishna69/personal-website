/**
 * Category filter for the AI/ML lab grid.
 *
 * DESIGN NOTES
 * ------------
 * • Built as a real tablist (roles, aria-selected, arrow-key roving focus) so
 *   it is operable from the keyboard and announced correctly. A row of divs
 *   with click handlers is the usual shortcut here, and it is unusable with a
 *   screen reader.
 * • Filtering toggles `hidden` rather than rebuilding the DOM. Every card is
 *   in the markup from the start, which means the content is crawlable and
 *   readable with JS disabled — important on a page a recruiter might open
 *   through a corporate proxy.
 * • The count of visible cards is announced via a live region, so keyboard
 *   and screen-reader users get the same feedback sighted users get from
 *   watching the grid reflow.
 *
 * Markup contract:
 *   <div data-filter-root>
 *     <div role="tablist">
 *       <button data-filter="all" aria-selected="true">…</button>
 *       <button data-filter="rag">…</button>
 *     </div>
 *     <div data-filter-count aria-live="polite"></div>
 *     <article data-category="rag agentic">…</article>
 *   </div>
 *
 * `data-category` is a space-separated list, so one project can live in
 * several categories at once.
 */

export function initFilter(rootSelector = '[data-filter-root]') {
  const root = document.querySelector(rootSelector);
  if (!root) return () => {};

  const buttons = Array.from(root.querySelectorAll('[data-filter]'));
  const cards = Array.from(root.querySelectorAll('[data-category]'));
  const countEl = root.querySelector('[data-filter-count]');
  if (!buttons.length || !cards.length) return () => {};

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The first apply() runs before the reveal observer has seen anything. If it
  // forced `is-visible` on, every lab card would be painted immediately and
  // the scroll reveal would never fire. So the initial pass only sets up
  // visibility and counts — the entry animation is reserved for real filter
  // changes the user makes.
  let initial = true;

  function apply(key) {
    let visible = 0;

    for (const card of cards) {
      const categories = (card.dataset.category || '').split(/\s+/);
      const show = key === 'all' || categories.includes(key);

      // `hidden` (not display:none in a class) keeps the element out of the
      // accessibility tree as well as out of the layout.
      card.hidden = !show;

      if (show) {
        visible += 1;
        if (!reduced && !initial) {
          // Re-trigger the entry animation so the surviving cards animate in
          // rather than snapping. Reading offsetWidth forces the style flush
          // that makes the class re-add actually restart the transition.
          card.classList.remove('is-visible');
          void card.offsetWidth;
          card.classList.add('is-visible');
        }
      }
    }

    for (const button of buttons) {
      const selected = button.dataset.filter === key;
      button.setAttribute('aria-selected', String(selected));
      // Roving tabindex: only the selected tab is in the tab order.
      button.tabIndex = selected ? 0 : -1;
    }

    if (countEl) {
      countEl.textContent = `${visible} project${visible === 1 ? '' : 's'}`;
    }
  }

  const onClick = (event) => {
    const button = event.target.closest('[data-filter]');
    if (button) apply(button.dataset.filter);
  };

  // Left/Right (and Home/End) move between tabs, per the WAI-ARIA tabs pattern.
  const onKeydown = (event) => {
    const index = buttons.indexOf(document.activeElement);
    if (index === -1) return;

    const keys = {
      ArrowRight: (index + 1) % buttons.length,
      ArrowLeft: (index - 1 + buttons.length) % buttons.length,
      Home: 0,
      End: buttons.length - 1,
    };

    const next = keys[event.key];
    if (next === undefined) return;

    event.preventDefault();
    buttons[next].focus();
    apply(buttons[next].dataset.filter);
  };

  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKeydown);

  apply('all');
  initial = false;

  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('keydown', onKeydown);
  };
}

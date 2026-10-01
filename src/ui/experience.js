/**
 * Live experience counter.
 *
 * WHY THIS EXISTS
 * ---------------
 * A portfolio that hard-codes "3+ years" is wrong within a few months and
 * quietly ages badly — recruiters do notice a stale number. This derives the
 * figure from one start date, so the page is correct forever with no edits.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  THE ONLY THING YOU EVER EDIT IS `CAREER_START` BELOW.               │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Markup contract — any element can opt in:
 *
 *   <span data-experience="years">          → "3"
 *   <span data-experience="months">         → "4"
 *   <span data-experience="long">           → "3 years 4 months"
 *   <span data-experience="short">          → "3.4 yrs"
 *   <span data-experience="years-plus">     → "3+"
 *
 * Every value is computed calendar-accurately (not by dividing days by
 * 365.25), so "4 months" always flips on the correct day of the month.
 */

/** Career start — month is 0-indexed, so 4 = May. */
export const CAREER_START = new Date(2023, 4, 1);

/**
 * Whole years and leftover months between two dates.
 * Borrowing a month when the day-of-month has not yet been reached is what
 * makes this calendar-accurate rather than an approximation.
 */
export function elapsedSince(start, now = new Date()) {
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();

  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months };
}

function format(kind, { years, months }) {
  switch (kind) {
    case 'years':
      return String(years);
    case 'months':
      return String(months);
    case 'years-plus':
      return `${years}+`;
    case 'short':
      return `${years}.${months} yrs`;
    case 'long': {
      const y = `${years} year${years === 1 ? '' : 's'}`;
      if (!months) return y;
      return `${y} ${months} month${months === 1 ? '' : 's'}`;
    }
    default:
      return String(years);
  }
}

export function initExperience(start = CAREER_START) {
  const nodes = document.querySelectorAll('[data-experience]');
  if (!nodes.length) return () => {};

  const elapsed = elapsedSince(start);

  for (const node of nodes) {
    node.textContent = format(node.dataset.experience, elapsed);
  }

  // Also fill in the start year wherever it is referenced, so the experience
  // timeline can never drift out of sync with the counter above it.
  for (const node of document.querySelectorAll('[data-career-start-year]')) {
    node.textContent = String(start.getFullYear());
  }

  return () => {};
}

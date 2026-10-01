# A. Shiva Krishna — Gen AI Developer Portfolio

A light-mode portfolio built with **Vite**, **Tailwind CSS v4** and **Three.js**.
Zero UI frameworks, zero animation libraries — the motion is hand-rolled so nothing
runs that you did not ask for.

---

## Run it locally

```bash
npm install
```

```bash
npm run dev
```

Vite opens `http://localhost:5173` automatically. Edits to any file hot-reload,
including the shaders.

**Production build:**

```bash
npm run build
```

**Preview the built output exactly as it will ship:**

```bash
npm run preview
```

Requires Node 18+ (built and tested on Node 22).

---

## Project structure

```
index.html              All markup. Sections are delimited by banner comments.
src/
  main.js               Entry point. Boots the UI, then lazy-loads the 3D scene.
  styles/main.css       Design tokens (@theme) + component classes.
  three/
    config.js           ← THE 3D CONTROL PANEL. Start here.
    scene.js            Renderer, camera, render loop, lifecycle.
    particles.js        GPU particle field (1 draw call).
    core.js             Faceted centre object with fresnel shading.
    pointer.js          Smoothed pointer tracking.
  ui/
    tilt.js             3D card tilt + cursor spotlight.
    magnetic.js         Magnetic buttons.
    reveal.js           Scroll-triggered reveals.
    cursor.js           Custom dot + trailing ring cursor.
    nav.js              Scroll-spy, condensing nav, drawer, copy-to-clipboard.
    experience.js       ← EDIT CAREER_START HERE. Live experience counter.
    filter.js           Accessible category filter for the AI Lab grid.
```

---

## Customising the 3D canvas

**Everything you are likely to change lives in [`src/three/config.js`](src/three/config.js).**
It is heavily commented, and every value is documented with what it does and
what a sensible range looks like. The headline knobs:

| Want to… | Change |
| --- | --- |
| Switch light ↔ dark | `theme` (also swap `palette` + the CSS tokens) |
| Re-colour the scene | `palette.inner` / `.outer` / `.rim` |
| Make it calmer | Lower `particles.count` and `particles.flowAmplitude` |
| Make the mouse feel tighter | Raise `pointer.damping` (6–10 is the sweet spot) |
| Make the mouse feel dreamier | Lower `pointer.damping` to ~3.5 |
| Zoom in | Lower `camera.distance` |
| Squeeze more performance | `renderer.maxPixelRatio: 1.25`, `core.enabled: false` |

Keep `palette` in sync with the `--color-accent*` tokens in
[`src/styles/main.css`](src/styles/main.css) — those are the CSS side of the
same three hues.

### The canvas only lives in the hero

`#webgl` is `position: fixed`, which means the IntersectionObserver that
pauses the render loop can never fire for it - a fixed element always
intersects the viewport. Left alone, the particle field renders for the whole
length of the page and shows through every section beneath the hero, which is
what makes body copy and tech tags hard to read over it.

`scene.js` therefore fades the canvas out across the first viewport height
(squared, so it clears the content quickly) and skips the draw call entirely
once it is invisible. On a long page that is most of the session, and it is
the single biggest performance saving in the scene.

That fade lives in a scroll listener, **not** in the render loop, and this is
deliberate: under `prefers-reduced-motion` the loop never starts, so a fade
inside `tick()` would leave the artwork at full strength across the whole page
for exactly the users least able to tolerate it.

### Light vs dark: `theme` is not cosmetic

`CONFIG.theme` changes the **blending mode** of every material in the scene:

- `dark` → additive blending. Overlapping particles sum toward white, which
  is what produces the glow on a near-black page.
- `light` → normal alpha blending. Additive on a white page is invisible —
  white plus anything is still white, so the entire scene disappears.

The site currently ships `theme: 'light'`. If you switch it back to `dark`,
you must also swap `palette` (light needs darker, higher-contrast hues) and
the `--color-*` tokens in `src/styles/main.css`, or the result will be
unreadable in one direction or the other.

To change the *character* of the drift rather than its intensity, edit the
`flow()` function in the vertex shader in
[`src/three/particles.js`](src/three/particles.js). That one function defines
the entire personality of the movement.

---

## Customising the design

All visual decisions route through the `@theme` block at the top of
`src/styles/main.css` — colours, the fluid type ramp, radii, shadows, and
easing curves. Change a token there and it propagates everywhere, because
Tailwind v4 generates its utilities from those same variables
(`--color-accent` → `text-accent`, `bg-accent`, `border-accent`, …).

To swap in your own Figma variables, replace the values in that one block.

**Adding a project:** copy any `<article>` inside `#work` in `index.html`,
swap the `<img>`, and set the two hue custom properties on `.card-media`:

```html
<div class="card-media aspect-[16/10] rounded-[1.1rem]"
     style="--hue-a: #34d399; --hue-b: #22d3ee;">
```

Those two hues drive a soft-light wash over the screenshot, which is what makes
six thumbnails with completely different palettes read as one grid. Pick them
from the screenshot's own dominant colours. Keep `width`/`height` on the
`<img>` so the browser reserves the space and nothing shifts as it loads.

---

## How it stays fast

- **The 3D layer is deferred.** Three.js is code-split into its own chunk and
  dynamically imported on `requestIdleCallback`. The page is readable and
  interactive before a byte of WebGL is parsed. Shell: ~3 kB gzipped.
- **One draw call for 3,200 particles.** All motion happens in the vertex
  shader; the CPU writes three floats per frame and nothing else.
- **Nothing renders off-screen.** An IntersectionObserver stops the render loop
  when the canvas scrolls away, and `visibilitychange` stops it on tab blur.
- **Delta-time everywhere, clamped at 50 ms.** Identical speed at 60 Hz and
  144 Hz, and a stall never teleports the animation.
- **Pixel ratio capped at 1.75**, with a one-shot degrade to 1.0 if frame times
  stay above 22 ms.
- **Mobile gets a lighter scene** — 45% of the particles, no centre object.
- **No allocation inside the render loop**, so the GC never stutters it.
- **DOM effects only ever write compositor-safe properties.** Tilt writes four
  CSS custom properties that feed `transform` and `background`; rects are
  cached on pointer-enter rather than measured per move.

## Accessibility

- `prefers-reduced-motion` is honoured throughout: the 3D scene renders a
  single static frame, and tilt, magnetic buttons, the custom cursor and scroll
  reveals all disable themselves.
- Tilt, magnetic buttons and the custom cursor are gated behind
  `(pointer: fine)`, so touch devices are unaffected.
- Skip link, visible focus rings, `aria-current` on the active nav item,
  labelled controls, and Escape-to-close on the mobile drawer.
- If WebGL is unavailable or the scene throws, the page continues with its CSS
  gradient backdrop — the failure is invisible.

---

## Content

### The experience counter — the only date you maintain

`src/ui/experience.js` exports one constant:

```js
export const CAREER_START = new Date(2023, 4, 1);   // month is 0-indexed: 4 = May
```

Every experience figure on the page derives from it at runtime, so nothing
ever goes stale. Opt any element in with a `data-experience` attribute:

| Attribute | Renders |
| --- | --- |
| `data-experience="years"` | `3` |
| `data-experience="months"` | `4` |
| `data-experience="long"` | `3 years 4 months` |
| `data-experience="short"` | `3.4 yrs` |
| `data-experience="years-plus"` | `3+` |
| `data-career-start-year` | `2023` |

The maths is calendar-accurate (it borrows a month when the day-of-month has
not been reached yet), not days ÷ 365.25.

**Change `CAREER_START` if May 2023 is wrong** — it was set so the page reads
"3 years 4 months" today. Note this conflicts with the old Wix site, which
listed the Suzva role as starting in 2022.

### Page structure

| Section | Contents |
| --- | --- |
| Hero | Role, live experience counter, stats |
| About | Bio, capability meters, grouped tech stack |
| Experience | Suzva role + the AI project work built alongside it |
| Work | Aivonis (architecture panel), Vivontic, Tributoo, Foerderverein SCN, Tablify |
| Project lab | 25 filterable personal AI project cards |
| Earlier work | The six live client sites from the UX/UI years |
| Contact | Phone, LinkedIn, résumé |

### Adding a lab project

Copy an `<article class="lab-card">`, bump the index, and set one or more
space-separated categories:

```html
<article class="lab-card" data-category="agentic llm" data-reveal>
```

Valid categories: `agentic` `llm` `nlp` `dl` `cv`. A project can belong to
several — the counts in the filter tabs update automatically. The filter is a
real WAI-ARIA tablist (arrow-key navigation, roving tabindex, live count
announcement), and it toggles `hidden` rather than rebuilding the DOM, so all
25 projects stay in the markup and remain crawlable with JavaScript disabled.

### Production project panels

Aivonis, Tributoo, Tablify and Vivontic are private codebases, so instead of
screenshots they use an architecture panel (`.arch-layer`) and gradient
monograms (`.monogram`). Layers in the Aivonis panel are ordered top-down along
the request path.

### Assets

```
public/
  shiva-krishna-resume.pdf        Linked from the hero and contact
  images/
    shiva-portrait.jpg            Hero portrait
    adept-tech-services.png       adepttechservices.com
    neutronest.png                neutronest.com
    on-demand-testing.png         on-demandtesting.com
    appify.jpg                    Appi-fy (Figma prototype)
    insuraksha.png                insuraksha.com
    lifestyle-platform.png        Lifestyle membership concept
    vivontic.jpg                  vivontic.com
    tributoo.jpg                  tributoo.com
```

All card images are 1400x875 (16:10). To swap one, drop a replacement at the
same path and same ratio - no markup change needed.

### Two cards still need screenshots

`Aivonis` and `Foerderverein SC Niederhausen` currently render a monogram /
architecture panel because no image could be obtained: aivonis.com blocks
automated requests (403), and the club site exposes no usable hero image.

To add them, save a 1400x875 capture as:

```
public/images/aivonis.jpg
public/images/foerderverein-scn.jpg
```

then replace that card's monogram block in `index.html` with the
`.card-media` block used by the Vivontic and Tributoo cards - both are marked
with a comment saying exactly this.

---

## Open questions

1. **Email address.** Still none anywhere — the contact section uses phone and
   LinkedIn only. Add one and it can be wired in with click-to-copy.
2. **Tablify** still has a placeholder description and no screenshot - it is
   now the weakest card on the page. It needs: what the product does, your
   specific contribution, and a capture.
3. **Vivontic and Tributoo use each site's own brand imagery**, pulled from
   their `og:image` tags - not captures of the interface you built. They look
   good, but a stock team photo does not evidence your work. Real UI captures
   would be stronger.
4. **Résumé is out of date** — the PDF in `public/` is the old UX/UI one
   pulled from Wix. It should be replaced with a Gen AI version.
5. **Capability percentages** are self-assessed. Some engineering recruiters
   read percentage bars on technical skills as a yellow flag; consider
   swapping them for the grouped tech-stack tags alone.
6. **The 25 lab projects have no links.** They are framed as personal work
   built on your own datasets and code — which is much stronger than
   coursework, but only if it is verifiable. Public GitHub repos (or even
   one repo with 25 folders) would let a recruiter confirm the claim.

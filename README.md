# Aurelia Residences — Aurelia House

A cinematic, single-page site for a fictional private waterfront residence, built to make one
thing easy: **request a private viewing**.

Dark editorial system, one type scale, an interactive 3D model of the house, drawings that match
that model, and a short enquiry form. No marketplace clutter, no popups, no countdowns, no fake
social proof.

> **Concept project created for demonstration purposes.** Aurelia Residences, Aurelia House and
> every name, date, drawing and travel time on the page are illustrative placeholders, not an offer.

---

## Run it

```bash
npm run dev          # static server on http://localhost:5173
```

The site is plain HTML, CSS and ES modules — any static host works, and `npm run dev` is only a
convenience (it binds `0.0.0.0` so previews and other devices can reach it).

```bash
npm install          # once — jsdom, for the test suite only
npm test             # 59 headless checks: scene, model controller, page behaviour, a11y
npm run build        # regenerate the inline floor plans in index.html
```

There is no bundler and no runtime dependency: `assets/vendor/three.module.min.js` is the only
library, and it is loaded lazily.

---

## Structure

```
index.html                     the page; floor plans are inlined between build markers
assets/css/main.css            the whole design system
assets/js/main.js              page behaviour, progressive enhancement, form
assets/js/experience.js        the 3D model: geometry, lighting, camera, markers
assets/js/site-config.js       every editable placeholder in one place
assets/vendor/                 three.js + self-hosted woff2 subsets (Cormorant Garamond, Inter)
assets/img/                    art-directed stills, WebP + JPEG, 760/1376/1920 widths
tools/serve.mjs                development server
tools/build.mjs                regenerates the floor plans inside index.html
tools/build-floorplans.mjs     the drawings themselves, generated from the same grid as the 3D model
tools/tests/run.mjs            headless test suite
```

## Editing the content

Everything bracketed in the markup is editable from **`assets/js/site-config.js`** — studio,
developer, completion and release dates, email, phone, WhatsApp, Instagram and the four travel
times. The page ships with working demo values and stays complete if that file is never touched
or if JavaScript is off.

Two things to change before any real deployment:

1. **`site-config.js`** — replace `[STUDIO NAME]`, `[DEVELOPER NAME]`, `[DATE]` and the travel
   times with verified facts, or leave the brackets visible.
2. **`index.html` head** — `canonical`, `og:url`, `og:image` and the structured data all point at
   `https://aurelia-residences.example/aurelia-house/`. Point them at your domain. The structured
   data deliberately contains only supplied property facts (rooms, bathrooms, floor size, address,
   plot, availability).

## Replacing the imagery

The stills here were generated for the demo and are delivered at 1920 × 1080 (hero), 1376 × 768
(interiors, gallery) and 928 × 1152 (story panels) in WebP with JPEG fallbacks, plus a 1200 × 630
social card. They are deliberately sized for the web rather than for print: dropping true 8K
photography in at these paths would multiply the page weight for no visible gain, since no element
renders wider than 1920 CSS pixels.

To use real photography, drop new files at the same names and widths and keep the `srcset` order:

```
assets/img/hero-1920.webp / hero-1920.jpg        hero, 16:9
assets/img/hero-1400.webp / hero-1400.jpg        hero, mobile crop
assets/img/gallery-<name>-1376 / -760.webp|jpg    six gallery frames, 16:9
assets/img/story-<light|flow|privacy>-928 / -520  three portrait panels, 4:5
assets/img/og-aurelia-house.jpg                  1200 × 630 social card
```

Regenerate with ImageMagick along the lines of:

```bash
convert source.jpg -resize 1920x1080^ -gravity center -extent 1920x1080 -quality 82 -strip hero-1920.webp
```

## The 3D experience

The house is built procedurally at runtime — primitives, analytic materials and a generated sky
gradient — so the model adds no download beyond three.js itself (~700 KB, loaded only when the
section is scrolled into view).

* Drag to rotate, pinch or scroll to zoom, with damping on every camera move.
* Reset view, auto rotate, and a level selector for **ground**, **upper** and **roof terrace**.
* Four markers (Arrival Court, Open Living Pavilion, Infinity Pool, Private Garden Suite) that
  project their own 3D anchors to screen space and open the side panel.
* Mobile drops the pixel ratio, the antialiasing and part of the shadow map, and keeps the level
  buttons and markers rather than adding camera gimmicks.

The drawings and the model share one coordinate system, so a room on the plan is the room in the
model. Edit either `tools/build-floorplans.mjs` (plan grid, in plan units) or `assets/js/experience.js`
(in metres) and run `npm run build` to regenerate the plans.

```
metres.x = (planX - 565) * 0.045
metres.z = (planY - 340) * 0.045
```

## Using this as a landing page for paid traffic

Any real-estate advertising landing page should carry one action. The header already reduces to a
single CTA below 1024 px, and the sticky mobile bar repeats "Request a Viewing" throughout. For a
dedicated campaign page, delete the four `<li>` items inside `.nav__list` (and the matching list in
`#mobile-nav`) and leave the header wordmark, the `Enquire` button and the sticky bar. Every section
keeps its own route to `#enquire`, so the page still works with the navigation gone.

## Graceful failure

* **No WebGL, no network for three.js, or a lost context** — the static preview stays, the model
  tools disable themselves, and the gallery and every call to action remain in place.
* **No JavaScript** — the page is complete and readable: no preloader lock, all copy present, all
  images present, the form falls back to native HTML validation.
* **`prefers-reduced-motion`** — auto rotation, parallax, reveals and smooth scrolling all stop.

## Accessibility

Skip link, semantic landmarks, one `h1`, ordered headings, visible focus rings on every control,
labelled markers and model controls, arrow-key camera control with a written description, a polite
live region that announces selections, tab semantics on the floor plans, a focus-trapped lightbox
with arrow-key navigation, and body text that meets WCAG AA contrast against the near-black canvas.
The form validates in the browser, moves focus to the first problem, and describes each error.

## Performance

* Hero image is preloaded as WebP with `srcset`/`sizes`; everything below the fold is lazy-loaded
  and wrapped in a low-quality placeholder.
* Fonts are two self-hosted woff2 subsets, preloaded, with `font-display: swap`.
* The 3D module initialises only when its section approaches the viewport, and pauses when the tab
  is hidden or the section scrolls away.
* Total page weight, first view: roughly 0.6 MB including fonts and the hero.

## Testing

`npm test` runs the suites in `tools/tests/run.mjs` against `index.html` in jsdom with a stubbed
renderer: the procedural model is checked for valid geometry and a sane triangle budget, the 3D
controller for its public API, marker projection, level switching and disposal, and the page for
navigation, floor-plan interaction, gallery, form validation, fallbacks, structure and metadata.
Because jsdom has no WebGL, the suite also proves the "3D unavailable" path rather than assuming it.

## Licence and credits

Photography and text are generated for this demonstration. three.js is MIT licensed; Cormorant
Garamond and Inter are SIL Open Font License.

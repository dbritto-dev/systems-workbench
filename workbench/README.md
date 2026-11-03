# Workbench layer

Shared pieces for the systems lessons, on top of the Anatomy isometric kit (vendored in `vendor-anatomy/`, MIT).

```
workbench/
  kit.mjs        Anatomy iso-kit re-exported + sphereOf + faceRectY, faceRectX
  parts.mjs      basePlate, rulerStrip, labelPlate, and the shared machine parts (below)
  digits.mjs     the stroke font for counter wheels (used by parts.mjs and by src/runtime/wb.ts)
  styles.mjs     the lesson page stylesheet (served to the site as virtual:workbench.css)
  i18n.mjs       t(en, es) for words painted on the machine
  collection/    lessons.json (the registry), card images, the card-image script
  vendor-anatomy/  the kit (lathe.mjs and tube.mjs import from here too)

The parts gallery (every part in light and dark, live) is an Astro page: src/pages/workbench/parts-gallery.astro.
```

## A lesson

Lessons live in `src/lessons/<slug>/`; see `src/lessons/README.md` for the four files and the shared helpers. A
figure (`figure.ts`) builds on this layer: `import * as k from "../../../workbench/kit.mjs"` and parts from
`parts.mjs`.

## Parts

Before drawing something a lesson needs, check `parts.mjs` and the parts gallery (build and serve the site, then
open `/systems-workbench/workbench/parts-gallery/`). If a part is missing and another lesson could use it, add it here rather than in the lesson,
with an example in the gallery. Every part takes the projection first and world units, and returns SVG;
the caller keeps the painter's order. Faces: `"y"` is the face of constant y (text reads along +x), `"x"` the face
of constant x (reads along -y), `"top"` lies on a top face.

```js
import { digitCounter, person, figurine, dial, meter, card, plaque, sign, pennant, lamp, keyPart, faceText, faceRect, variants, litFill, LIT_FILL_CSS } from "../../workbench/parts.mjs";

digitCounter(P, { x: -15, y: 20, z: 6, count: 4, w: 9, h: 13, name: "balance", value: 40 })  // wheels on a face, in a housing (pad: n or [across, below, above])
person(P, [x, y, 0], { scale: 0.8, hat: "cap", holding: "slip", slipText: "40", lit })        // hat: cap | brim; holding: tray | clipboard | slip | key
figurine(P, [x, y, 0], { scale: 0.7, lit })                                                     // small, for crowds and queues
dial(P, { x, y, r: 9, ticks: 60, every: 5, label: "ms", name: "watch", value: 0.25 })          // on top of a drum; from/span for a part-turn
meter(P, { x, y, z: 6, r: 8, zone: 0.8, name: "load", value: 0.3 })                           // half-round, on a face, optional red zone
card(P, { x, y, z, w: 8, h: 11, text: "A7", sub: "try 2", clip: true, lit })                  // ticket, slip, tag
plaque(P, { x, y, z, w: 12, d: 8, text: "3" })                                                 // lying on a top face
sign(P, { x, y, z: 8, w: 20, h: 7, text: "OPEN", lit, posts: false })                          // on posts or on a wall
pennant(P, { x, y, z: 12, height: 10, lit })                                                   // flag on a pole
lamp(P, [x, y, z], { r: 3, lit });  keyPart(P, [x, y, z], { scale: 1.5 })
faceText(P, [x, y, z], "v11", { face: "y", size: 3, anchor: "middle", attr: "data-version" })
variants("waiter-2", { idle: person(P, at), carry: person(P, at, { holding: "tray" }) }, "idle")
```

Live (in the lesson script, `svg` is the figure's svg element):

```js
const balance = WB.counter(svg, "balance", P); balance.set(41);   // redraws only the wheels that changed
WB.dial(svg, "watch", P).set(0.5);  WB.meter(svg, "load", P).set(0.9);
WB.pose(svg, "waiter-2", "carry");
```

**Lit fill (opt-in).** In light theme the kit's lit accent is a white top with a darker outline, which is easy to miss
on small tokens. `litFill(svg)` marks lit solids to fill with the lit colour (black in light, white in dark); add
`LIT_FILL_CSS` to the lesson's `css`. Text on such a part uses `tone: "on-lit"`. See the last row of the gallery.

## Checking a change

Build and serve the site, then `node tools/site-check.cjs` (every lesson in both languages) and look at
`/systems-workbench/workbench/parts-gallery/` for the parts themselves.

## The collection page

The collection is an Astro page (`src/pages/[...lang]/index.astro`); it reads `collection/lessons.json`:

1. Add the lesson to `collection/lessons.json` (number, slug, area, `blurb` and `blurb_es`: the card subtitles, at most about 120 characters so they fit three lines on a phone). New lessons have no `html` (that field is the old standalone URL some lessons redirect from).
2. Shoot the running machine into `collection/previews/<slug>-light.webp` and `-dark.webp`: build and serve the site (`pnpm build && pnpm preview`), then `CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm previews <slug>` (`SITE=` for another address). `normalize.cjs` fits every shot onto the same 1200×800 canvas, trimmed and centred, so all cards share one 3:2 image.
3. `pnpm build`: the card, search and both languages pick it up.

# Workbench layer

Shared pieces for the systems lessons, on top of the Anatomy isometric kit (vendored in `vendor-anatomy/`, MIT).

```
workbench/
  kit.mjs        Anatomy iso-kit re-exported + kitScript + sphereOf + faceRectY, faceRectX
  parts.mjs      basePlate, rulerStrip, labelPlate, and the shared machine parts (below)
  digits.mjs     the stroke font for counter wheels (used by parts.mjs and, inlined, by client.js)
  parts-gallery.mjs → parts-gallery.html   every part in light and dark, live
  page.mjs       the page template: CSS, theme switch, seg/speedSeg/actions/panel, figurePlate,
                 experiments + questions markup, renderPage/writePage, inlineModule
  client.js      browser helpers under one global, WB: loop, pressSeg, onSegments, experiments,
                 counter, dial, meter, pose, digitsOf, faceRectY, faceRectX, still
  vendor-anatomy/  the kit (lathe.mjs and tube.mjs import from here too)
```

## A lesson

```
<lesson>/
  sim.js       the model, shared by the figure and the experiments (seeded)
  figure.mjs   geometry; import * as k from "<rel>/workbench/kit.mjs"; parts from parts.mjs
  build.mjs    content + live script; writePage({...})
```

`build.mjs` supplies: `title`, `eyebrow`, `lede`, `machine: { intro, figure, panel }`, `predict: { intro, experiments }`,
`explain: { questions }`, `css` (figure-specific only) and `script` (live code). Everything else comes from the template.

Experiments are `{ id, title, change, question, options, answer, why, watch? }`. In the live script:

```js
const clock = WB.loop({ stage, step: (dt) => { advance(dt * speed); paint(); }, onPause: (on) => { … } });
WB.onSegments((name, value) => { … WB.pressSeg(name, value); });
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => { … } });
```

`RUNS[id]()` returns `{ verdict, bars: [[label, share 0..1, text, isAfter?], …] }`.

## Parts

Before drawing something a lesson needs, check `parts.mjs` (and `node parts-gallery.mjs`, then open
`parts-gallery.html`). If a part is missing and another lesson could use it, add it here rather than in the lesson,
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

`compare.js` (scratchpad) diffs a rebuilt page against `workbench-baseline/`: figure SVG, full-page screenshots
in light and dark (pixel count), page text, experiment results, console errors, and that the theme switch,
×0.5 speed and animation still work.

## The collection page

`collection/` builds the Systems Workbench catalogue:

1. Add the lesson to `collection/lessons.json` (number, slug, area, built page, published link, and an optional `blurb`: the card subtitle, at most about 120 characters so it fits three lines on a phone; without it the lesson's lede is used).
2. `node collection/extract.mjs` reads every listed page into `catalog.json` (title, machine, summary, experiments).
3. Screenshot the running machine into `collection/previews/<slug>-light.webp` and `-dark.webp` with `node collection/previews.cjs [slug]` (needs `playwright` and `sharp`). `normalize.cjs` fits every shot onto the same 1200×800 canvas, trimmed and centred, so all cards share one 3:2 image.
4. `node collection/build.mjs` writes `collection/index.html`; publish it with the `previews/` files.

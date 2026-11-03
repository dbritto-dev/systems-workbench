# Lessons

Each lesson is a folder here, `src/lessons/<slug>/`:

| File | Runs | What it is |
|---|---|---|
| `sim.ts` | build + browser | The seeded model. Experiments run it at build time; the live code runs it in the browser. |
| `figure.ts` | build | The machine, drawn with the Anatomy kit and `workbench/parts.mjs` into an SVG string. |
| `page.ts` | build | `export default defineLesson({...})`: text in English and Spanish, plate, stats, controls, experiments with their results (`withResults(EXPERIMENTS, RUNS)`: each card's verdict and bars, worked out from `sim.ts`), questions, CSS, and `data` for the live code. |
| `live.ts` | browser | `export default function mount(data, root)`: the animation, and the answers to the controls. Loaded when the machine comes into view. |

Some lessons add a fifth file for drawing both the figure and the live code need (`figure.ts` is build-only: it
imports Node modules), e.g. `breaker/blade.ts`, `throttle/paths.ts`, `concurrency/parts.ts`.

## The page's elements, and how live code uses them

Every page is built from custom elements in `src/elements/`; the Astro components render their markup and the
elements give it behaviour. `root`, the `<wb-lesson>`, is all a lesson's live code talks to:

```js
export default function mount({ P, G }, root) {
  const { stage, svg } = root.figure;              // <wb-figure>: the stage and the machine's SVG
  const say = (text) => root.figure.say(text);     // the readout corner
  root.stat("done", 12);                           // the <wb-stat key="done"> in <wb-stats>
  root.controls.showFor("lookups");                // <wb-controls>: show the rows for one group
  root.on("change", (name, value) => { … });       // a <wb-seg> option was clicked (pressed for you)
  root.press("speed", 3);                          // press an option without an event
  const actions = { burst: () => { … } };
  root.on("action", (name) => actions[name]?.());  // a <wb-actions> button
  root.on("watch", (settings, id) => { … });       // an experiment's "Watch it on the machine"
  const pause = playPause(root);                   // Pause button and Space on the stage
  const loop = WB.loop({ stage, step, onPause: pause.onPause });
  pause.bind(loop);
}
```

The cards (`<wb-experiment>`) run without the lesson's code: their results come from the build. Each control in
`page.ts` is a `<wb-control>` row: a segment (`seg`; `multiple: true` switches options on and off independently),
buttons (`actions`) or a text box (`input`, read with `root.$('[data-input="name"]')`). Look up anything else with
`root.$(selector)` / `root.$$(selector)`, never `document`.

## Shared code: import it, don't copy it

| Need | Import |
|---|---|
| Seeded random numbers | `rng`, `xorshift32`, `rngMixed`, `lcg`, `mulberry32`, `normal`, `exponential` from `src/lib/random` |
| String hashes | `fnv1a(text, basis?)`, `fmix32(h)` (murmur3 finaliser) from `src/lib/random` |
| Averages, percentiles | `mean`, `meanBy`, `averageOver(seeds, fn)`, `percentile` (sorted[floor(q·(n−1))]), `rankQuantile` / `rankQuantileSorted` (sorted[floor(q·n)], the rule most lessons' numbers use), `upperMedian`, `clamp` from `src/lib/stats` |
| Easing | `lerp`, `lerpVec`, `approach`, `smoothstep`, `easeInOutQuad`, `easeInOutCubic` from `src/lib/tween` |
| Number text | `one`, `n0`, `int` (thousands separators), `pct`, `pctTenths` (one decimal under 10%), `oneUnder10`, `secs`, `secs1`, `secs2`, `msFromSecs`, `msOrSecs`, `millis` (a value in ms) from `src/lib/format` |
| A route in x, y | `polylineLength`, `pointAlong` (clamped) from `src/lib/geometry` |
| Event queue of a discrete-event model | `minHeap(less)` from `src/lib/events` |
| Debounce a handler (UI code) | `debounce(fn, wait, { maxWait })` from `src/lib/timing`, with `.flush()` / `.cancel()` |
| Drawing shorthands (build) | `const { S, L, D, at, seg, text, faceY, top, rawText } = shorthand(P)` from `src/lib/draw` (`rawText`: the face-text markup some figures must keep byte for byte; new figures use `text`) |
| Loop, counters (`set`, `setClamped`), dials, meters, `place(el, P, point)`, `L`/`T` | `src/runtime/wb` |
| Show/hide, text, a path's `d`, lit accent, Play/Pause | `show`, `setText`, `setD`, `setLit`, `playPause(root)` from `src/runtime/dom` |
| Readout, stats, segments, buttons, experiment cards | the elements, through `root` (above) |
| Experiment results | `withResults(EXPERIMENTS, RUNS)` from `src/lessons/types` (in `page.ts`) |
| The panel's primary button | `{ actions: [["go", t("Go", "Ir"), { primary: true }], …] }` in `page.ts` (drawn as `.btn.primary`) |
| Kit geometry in the browser (`iso`, `pathOf`, `translateAlong`, `depthOf`, …) | `workbench/vendor-anatomy/kit/iso-kit.mjs` (tree-shaken) |
| Bilingual text | `t(en, es)` from `src/i18n` |

If two lessons need the same helper and it isn't listed, add it to `src/lib` or `src/runtime` rather than to a lesson.
If a lesson's `page.ts` and `live.ts` need the same helper, export it from that lesson's `sim.ts`.

## Checking a change

`pnpm build && pnpm preview`, then `node tools/site-check.cjs [base-url] <slug>…`: the live code runs, every experiment gives a
verdict, nothing is left in the other language, no console errors, and the page fits a 390 px phone. Look at the
running machine yourself in light and dark too. Every lesson was ported from a standalone page and checked against
it (same figure, controls and experiment verdicts in both languages); the history of each port is in git.

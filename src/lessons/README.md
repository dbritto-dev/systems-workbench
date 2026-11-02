# Lessons

Each lesson is a folder here, `src/lessons/<slug>/`:

| File | Runs | What it is |
|---|---|---|
| `sim.ts` | build + browser | The seeded model. Experiments run it at build time; the live code runs it in the browser. |
| `figure.ts` | build | The machine, drawn with the Anatomy kit and `workbench/parts.mjs` into an SVG string. |
| `page.ts` | build | `export default defineLesson({...})`: text in English and Spanish, plate, stats, controls, experiments, questions, CSS, and `data` for the live code. |
| `live.ts` | browser | `export default function mount(data)`: the animation, the controls and the experiment cards. Loaded when the machine comes into view. |

`queues` is the reference port; all eight Fundamentals lessons are ported. Lessons not yet here still live in `lessons/<slug>/` (one `build.mjs` each)
and reach the site through `tools/export-lessons.mjs`.

## Shared code: import it, don't copy it

| Need | Import |
|---|---|
| Seeded random numbers | `rng`, `xorshift32`, `rngMixed`, `lcg`, `normal`, `exponential` from `src/lib/random` |
| Averages, percentiles | `mean`, `meanBy`, `averageOver(seeds, fn)`, `percentile`, `clamp` from `src/lib/stats` |
| Easing | `lerp`, `lerpVec`, `approach`, `smoothstep`, `easeInOutQuad`, `easeInOutCubic` from `src/lib/tween` |
| Number text | `one`, `n0`, `int` (thousands separators), `pct`, `secs` from `src/lib/format` |
| Drawing shorthands (build) | `const { S, L, D, at } = shorthand(P)` from `src/lib/draw` |
| Loop, counters (`set`, `setClamped`), dials, meters, `place(el, P, point)`, segments, experiment cards, `L`/`T` | `src/runtime/wb` |
| Readout, stats strip, show/hide, text, lit accent, action buttons, Play/Pause | `readout`, `stats`, `show`, `setText`, `setLit`, `act`, `pauseControls` from `src/runtime/dom` |
| Kit geometry in the browser (`iso`, `pathOf`, `translateAlong`, `depthOf`, …) | `workbench/vendor-anatomy/kit/iso-kit.mjs` (tree-shaken) |
| Bilingual text | `t(en, es)` from `src/i18n` |

If two lessons need the same helper and it isn't listed, add it to `src/lib` or `src/runtime` rather than to a lesson.

## Porting a lesson from `lessons/<slug>/`

1. `sim.js` → `sim.ts`: replace the local `rng`/`makeRng`, `mean`/`avg` and friends with the shared ones. Keep the
   exact algorithm: `rng` (signed shift) and `xorshift32` (unsigned) are different generators.
2. `figure.mjs` → `figure.ts`: import paths `../../../workbench/…`; `const { S, L, D, at } = shorthand(P)`.
3. `build.mjs` → `page.ts`: content as-is; `figurePlate()` becomes `machine.plate` (`stage` attributes as an object,
   the stage's aria-label as `label`); `panel()` becomes `machine.stats` / `machine.controls` / `machine.note` (a control can take `for` and `hidden` to show one group at a time);
   the JSON constants the live string interpolated become `data`.
4. The live string → `live.ts`: its body inside `mount({ ...data })`, with imports instead of the inlined sim and
   kit, `readout()`, `stats()`, `act()`, `pauseControls()` instead of local copies. Pages carry one language, so
   drop `WB.onLang(...)` handlers.
5. Check it against the original, then delete `lessons/<slug>/` (its old URL keeps redirecting: the `html` field in
   `workbench/collection/lessons.json` is that old path):
   `pnpm build && pnpm preview`, then `node tools/port-check.cjs <slug>` (same figure, controls and experiment
   verdicts in both languages) and `node tools/site-check.cjs <slug>`.

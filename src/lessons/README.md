# Lessons

Each lesson is a folder here, `src/lessons/<slug>/`:

| File | Runs | What it is |
|---|---|---|
| `sim.ts` | build + browser | The seeded model. Experiments run it at build time; the live code runs it in the browser. |
| `figure.ts` | build | The machine, drawn with the Anatomy kit and `workbench/parts.mjs` into an SVG string. |
| `page.ts` | build | `export default defineLesson({...})`: text in English and Spanish, plate, stats, controls, experiments, questions, CSS, and `data` for the live code. |
| `live.ts` | browser | `export default function mount(data)`: the animation, the controls and the experiment cards. Loaded when the machine comes into view. |

Some lessons add a fifth file for drawing both the figure and the live code need (`figure.ts` is build-only: it
imports Node modules), e.g. `breaker/blade.ts`, `throttle/paths.ts`, `concurrency/parts.ts`.

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

## Checking a change

`pnpm build && pnpm preview`, then `node tools/site-check.cjs <slug>`: the live code runs, every experiment gives a
verdict, nothing is left in the other language, no console errors, and the page fits a 390 px phone. Look at the
running machine yourself in light and dark too. Every lesson was ported from a standalone page and checked against
it (same figure, controls and experiment verdicts in both languages); the history of each port is in git.

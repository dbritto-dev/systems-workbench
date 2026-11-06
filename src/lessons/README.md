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
| Focus ring, motion timings, target sizes, disabled look (CSS) | the `--ux-*` tokens and rules in `src/styles/ux.css` (on every page; see "UX foundation") |
| Did the last input come from the keyboard or a pointer? | `modality()`, `showsFocusRing(el)`, `isTextEntry(el)` from `src/runtime/modality` (`<html data-ux-modality>`) |
| Tell a screen reader something changed | `announce(text, "polite" \| "assertive")`, `announcer({ replace })`, `clearAnnouncements()` from `src/runtime/announce` |
| One Tab stop and arrow keys for a group or toolbar, with the "← → to navigate" hint | `roving(group, { items, orientation, wrap, current, select, skip, hint })` from `src/runtime/roving` |

If two lessons need the same helper and it isn't listed, add it to `src/lib` or `src/runtime` rather than to a lesson.
If a lesson's `page.ts` and `live.ts` need the same helper, export it from that lesson's `sim.ts`.

## UX foundation

Components behave like Astryx's (Meta's design system) and keep our look. Build them on these, never on numbers or
listeners of their own:

- **Focus ring** (`ux.css`): every `:focus-visible` element gets a 2px solid ring in our ink, 3px outside
  (`--ux-focus-width`, `--ux-focus-style`, `--ux-focus-color`, `--ux-focus-offset`). It is written as longhands at zero
  specificity: change one part (`--ux-focus-offset` where there's no room, never the `outline` shorthand). The error
  variant (`data-ux-ring="error"` on a destructive button, or `aria-invalid="true"`) rings in `--ux-focus-color-error`.
  One focus move shows one ring: a wrapper that paints the ring for a hidden input uses
  `:has(> input:focus-visible)` (not `:focus-within`) and sets `outline-style: none` on the input. Inside a box that
  clips (`overflow`), draw the ring inside instead (`outline-offset: calc(-1 * var(--ux-focus-width))`).
- **Modality** (`runtime/modality.ts`): `<html data-ux-modality="keyboard|pointer">`, rendered as `keyboard` and kept
  by a script in the head (pointerdown → pointer; a keydown without Meta, Alt or Ctrl → keyboard). After a pointer
  press `ux.css` hides the ring on a programmatic focus (focus returned to a trigger, a dialog's first control), except
  on text fields. A ring painted some other way checks `:root:not([data-ux-modality="pointer"])`, or
  `showsFocusRing(el)` in script.
- **Motion** (`ux.css`): `--ux-duration-fast` (175ms; hover, press, colour), `-medium` (410ms; entrances, exits, a
  fill), `-slow` (975ms; continuous movement), each with `-min` / `-max`, and `--ux-duration-exit`; easings
  `--ux-ease-standard` (decelerate; also `-entrance`, `-move`) and `--ux-ease-exit`. Animate only `transform` and
  `opacity`. Under `prefers-reduced-motion: reduce` every CSS transition and animation finishes at once; a component
  may opt back into an opacity-only cross-fade on a coarse pointer (`--ux-rm-fade-duration`, `--ux-rm-fade-ease`,
  `!important`). Live code checks `still` from `src/runtime/wb`.
- **Targets** (`ux.css`): at least `--ux-target-min` (24px); control heights `--ux-size-sm` / `-md` / `-lg` (28, 32,
  36px). `class="ux-hit"` grows the tappable area toward `--ux-target-touch` (44px) on a coarse pointer without
  growing what's drawn, at most `--ux-hit-gap-block` / `--ux-hit-gap-inline` per side (half the gap to the nearest
  target; 0 by default). It uses the element's `::after` and makes it `position: relative`.
- **Disabled** (`ux.css`): `aria-disabled="true"`, never the native `disabled` (the control keeps its Tab stop, its
  focus and its ring). It paints at `--ux-disabled-opacity` (0.5), once for a disabled group. Write hover and press
  rules for enabled controls only: `:where(:not([aria-disabled="true"])):hover`. Script refuses the activation.
- **Announcements** (`runtime/announce.ts`): one polite (`role="status"`) and one assertive (`role="alert"`) region per
  page, mounted empty, `aria-atomic`, visually hidden; inside the topmost open modal `<dialog>` while one is open. A
  write clears the region, sets the text on the next frame (same-frame messages joined, a repeat kept once) and
  clears it 2s later. Polite unless it's an error or time-critical. One owner per message: what an element already
  shows on screen with a live role isn't announced again, and nothing present at load is announced. An owner from
  `announcer({ replace: true })` withdraws its previous message if it hasn't been read yet (result counts).
- **Roving focus** (`runtime/roving.ts`), for a composite control only (radiogroup, segmented control, tablist,
  toolbar); independent controls (chips, a row of buttons) stay one Tab stop each. One Tab stop: the selected member
  (`current`), else the first enabled one. ← → follow the rendered direction (swapped under RTL, checked at key time)
  and wrap, ↑ ↓ with `orientation: "vertical"`, Home and End; disabled and hidden members are skipped. `select` makes
  selection follow focus; Tab-in never changes the value. A caller's keydown on a member runs first and can
  `preventDefault()`. The arrow-key hint shows once per group (or once per page for groups sharing `hint: "name"`) on
  keyboard entry from outside, and goes on the first arrow, on leaving, or after 3s. Set the tabindex by script only,
  so without JavaScript every member stays reachable.

## Machine conventions

Rules every machine follows, so the set reads as one:

- **Lit** marks what the lesson wants you to follow right now: the thing in play, or the failure the lesson is
  about. Each lesson picks one of those roles, and the plate's first key lists every part that can light. Show other
  states another way: a pose, a sign's text, a raised or lowered arm, an unlit lamp. In particular, don't light
  actors (a person syncing, a recovery clerk) when lit means "something wrong".
- **Watch it on the machine** shows the experiment's outcome within about 10 s of the press. Use a faster speed, a
  warm-up (negative times) or a jump of the model clock to get there. The Watch stages the same settings the
  verdict uses.
- **Counters show what the stats show:** the same definition, rounding and unit. Show a fraction with a decimal point
  inside one housing (see `passwords/figure.ts`, `dot`), never between two housings. A counter's caption names
  what it counts in the panel's words.
- **The readout describes the picture now.** Drop a message as soon as the state behind it is gone; say what the
  current step is from its start. Singular and plural agree ("1 ack", "2 acks").
- **A label sits directly in front of, or on, the part it names.** On iso faces that stand back from their parts
  (tubes, bars, sockets), put the label on the top face in front of each part.
- **When a line or tray can't draw everything,** show the rest as a "+N" tag where it is cut off.
- **Gates** draw their arm in both states: raised when open, lowered when closed.
- **Lamps** sit on a housing, a sign or a board, never alone on a post: a ball on a post reads as a person.
- **The figure's aria label** places parts where they are drawn.

## Checking a change

`pnpm build && pnpm preview`, then `node tools/site-check.cjs [base-url] <slug>…`: the live code runs, every experiment gives a
verdict, nothing is left in the other language, no console errors, and the page fits a 390 px phone. Look at the
running machine yourself in light and dark too. Every lesson was ported from a standalone page and checked against
it (same figure, controls and experiment verdicts in both languages); the history of each port is in git.

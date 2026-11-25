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

The page's controls are [astryx-astro](https://dbritto-dev.github.io/astryx-astro/)'s components (Meta's Astryx in
Astro) drawn in our look (`src/styles/astryx-workbench.css`); `src/components/lesson/` renders them, and the custom
elements in `src/elements/` wrap them in the lesson API. `root`, the `<wb-lesson>`, is all a lesson's live code talks
to:

```js
export default function mount({ P, G }, root) {
  const { stage, svg } = root.figure;              // <wb-figure>: the stage and the machine's SVG
  const say = (text) => root.figure.say(text);     // the readout corner
  root.stat("done", 12);                           // the <wb-stat key="done"> in <wb-stats>
  root.controls.showFor("lookups");                // <wb-controls>: show the rows for one group
  root.on("change", (name, value) => { … });       // a <wb-seg> option was chosen (selected for you)
  root.press("speed", 3);                          // select an option (or set a stepper) without an event
  root.num("kg")?.value;                           // a <wb-num> stepper's value
  root.disable("flip", true, L("Blue is rebuilding", "Azul se está reconstruyendo"));  // never btn.disabled
  root.relabel("flip", L("Flip to blue", "Cambiar a azul"));  // never btn.textContent
  const actions = { burst: () => { … } };
  root.on("action", (name) => actions[name]?.());  // a <wb-actions> button
  root.on("watch", (settings, id) => { … });       // an experiment's "Watch it on the machine"
  root.focusOn("retries");                         // phone lens: show a region in the close-up (null: follow what is lit)
  const pause = playPause(root);                   // Pause toggle (aria-pressed) and Space on the stage
  const loop = WB.loop({ stage, step, onPause: pause.onPause });
  pause.bind(loop);
}
```

The cards (`<wb-experiment>`) run without the lesson's code: their results come from the build. Each control in
`page.ts` is a `<wb-control>` row: a segment (`seg`; `multiple: true` switches options on and off independently),
buttons (`actions`), a text box (`input`, read with `root.$('[data-input="name"]')`) or number steppers (`nums`: one
`<wb-num>` per value, each sending `change` with its name and the new value as text; `root.press(name, v)` sets one
without an event and `root.disable(name, on, reason)` disables it). Look up anything else with
`root.$(selector)` / `root.$$(selector)`, never `document`.

What they are and how they behave (Astryx's behaviour, our look):

| `page.ts` | Component | Behaviour |
|---|---|---|
| `seg` | SegmentedControl in `<wb-seg>` | radiogroup, one Tab stop, ← → / Home / End select, sliding selected surface, "← → to navigate" hint; choosing the selected option again sends nothing |
| `seg` + `multiple: true` | ToggleButtonGroup (`type="multiple"`) of ToggleButtons | each option its own Tab stop, `aria-pressed` |
| `speed` | SegmentedControl | as `seg` |
| `actions` | Buttons in `<wb-actions>` (an HStack); `primary: true` is the primary variant | separate Tab stops; `pause` is a ToggleButton that keeps its label |
| `input` | TextInput (its `<input>` has `data-input`) | the row's label is the field's |
| `nums` | per value a `<wb-num>`: a − Button, the value (`role="spinbutton"`) and a + Button | the spinbutton is the one Tab stop (↑ ↓ one step, Page Up / Page Down two, Home / End the ends; `aria-valuetext` is the value as shown, sign included); the Buttons are pointer and screen-reader targets (`tabindex="-1"`, as in the APG spinbutton), 36px tall, grown toward 44px on a coarse pointer (`ux-hit`); at an end, that end's Button is disabled the focusable way |
| experiments | Card; predictions are SelectableCards (radio); Run and Watch are Buttons; result bars are ProgressBars | one Tab stop for the predictions, the whole card clickable, Enter selects; Run is disabled with its reason (Tooltip) until one is picked; the verdict is said through `announce()` |
| questions | Collapsible (a `<details>` copy in `<noscript>`) | each its own Tab stop |

A `nums` row: `{ nums: [[name, label, value, own?], …], label, min, max, step, digits? }`. `min`, `max`, `step` and
`digits` (the decimals shown) apply to every stepper in the row; `own` (`{ min?, max?, step?, digits? }`, typed in
`src/lessons/types.ts`) overrides them for one stepper, e.g. a 10 kg setting in steps of 0.5 beside whole-number ones.
Values are rounded to `digits` and kept within `min`…`max`.

Disable a control with `root.disable(name, on, reason?)` (aria-disabled: it keeps its Tab stop, and the reason shows
as an Astryx Tooltip on hover, keyboard focus or a tap), never with the native `disabled`. Relabel a button with
`root.relabel(name, text)`: an Astryx Button's label is a span beside its spinner and live region, so
`button.textContent = …` would wipe them. A press before the live code has loaded is kept and sent again after
`mount()`; the action button shows Astryx's loading state (`aria-busy`, a spinner after 310 ms) until then.

## The phone lens

At 560 px and below (a phone) a figure would be the desktop drawing shrunk to under half, its words 2 to 3 px tall. So
there the plate shows, in reading order, the whole machine small (the **overview**, with a thin frame over what the
close-up shows), the regions' control if the lesson has regions, and the **close-up**: the stage itself, cropping the
machine 2 to 3 times larger, at the scale where the smallest word on it reads at 12 px or more (`src/lib/lens.ts`).
Every lesson gets it from `components/lesson/FigurePlate.astro`, `src/elements/wb-figure.ts` and `LENS_CSS` in
`workbench/styles.mjs`; the desktop is unchanged.

- **One machine.** The close-up is the machine's own `<svg>` (the stage keeps its label, focus and Space-to-pause),
  drawn wider and shifted inside the stage, which crops it. The live code draws one machine and needs no change. The
  overview is a still copy (`aria-hidden`, no ids), taken again every 5 s and shortly after a control, an action or a
  Watch, when the browser is idle: a map that catches up, never copied per frame. (A `<use>` of the machine was tried
  first: Chromium re-copies the whole machine into it after every change the live code makes, about 2.4 ms a frame on
  the parcel office, with frames of 75 ms at 4× CPU slowdown.)
- **Where it looks.** By default it follows what is lit (`[data-lit]`, drawn): all of it if it fits, else what lit up
  most recently, until it goes out. It moves only when that leaves the middle of the view, at most once every 1.2 s,
  and eases there over `--ux-duration-medium` (jumps under reduced motion): one `left`/`top` write per frame, only
  while it moves (a `transform` on the `<svg>` made Chromium repaint all of it on every frame).
- **Regions.** A lesson may name parts of its figure in `plate.regions` (two to four):
  `{ id, label: t(en, es), box: [x, y, w, h] }`, the box in viewBox units; `screenBox(P, points, pad)` from
  `workbench/kit.mjs` makes one from world points, e.g. `k.screenBox(P, k.boxCorners(DESK, 0, 30))`. They show as an
  Astryx SegmentedControl above the close-up, "Follow" first (one Tab stop, ← →); choosing one centres the close-up on
  it until "Follow" is chosen again. A region must fit the close-up, about 285 × 285 units on a 700-wide figure whose
  words are 11 px on the desktop (`tools/text-size.cjs` says when one doesn't), and the labels must fit one line at
  390 px in Spanish (three regions of one word, or four short ones). Live code moves the close-up with
  `root.focusOn(id)` (the control follows) and back to following what is lit with `root.focusOn(null)`; on a desktop
  the call only sets what the lens will show.
- **Opting out.** `plate.lens: false`, for a lesson that draws its own phone figure (neuron).
- **Cost** (Chromium, 390 px, the live code running): 20 to 45 ms of main thread a second more than the shrunk figure
  on the parcel office and the count room, none on the event loop; frames stay at 60 fps at 4× CPU slowdown. It
  stops while the plate is off screen.

## Text on the machine

Words and digits painted on a machine come out at **11 px or more on a desktop** (the 732 px stage) and so at 12 px or
more in the phone close-up. Size them with `workbench/kit.mjs`: `textSize(P, 11.2, { width: WIDTH })` (face `"y"`;
`face: "x"`, `face: "top"`, `along: "y"` as for `faceText`) and `wheelHeight(P, 11.2, { width: WIDTH })` for a
digit counter's wheels; they follow the figure's scale, so a layout change keeps them right. When the words don't fit,
move them (onto the plate in front of the part), shorten them, or drop a label that repeats a stat in the stats strip.
`node tools/text-size.cjs [base-url] [slug…]` reports each lesson's smallest and median text at 1100 px and in the
close-up, and fails for the lessons it lists as migrated (`MIGRATED`); `tools/site-check.cjs` runs it too, as a
problem for migrated lessons and a warning for the others. Add a lesson to `MIGRATED` once it passes.

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
| The panel's primary button | `{ actions: [["go", t("Go", "Ir"), { primary: true }], …] }` in `page.ts` (an Astryx Button, variant `primary`) |
| Face-text size and counter-wheel height for 11 px on a desktop, a lens region's box (build) | `textSize`, `wheelHeight`, `screenBox` from `workbench/kit.mjs` |
| Kit geometry in the browser (`iso`, `pathOf`, `translateAlong`, `depthOf`, …) | `workbench/vendor-anatomy/kit/iso-kit.mjs` (tree-shaken) |
| Bilingual text | `t(en, es)` from `src/i18n` |
| Focus ring, motion timings, target sizes, disabled look (CSS) | the `--ux-*` tokens and rules in `src/styles/ux.css` (on every page; see "UX foundation") |
| Did the last input come from the keyboard or a pointer? | `modality()`, `showsFocusRing(el)`, `isTextEntry(el)` from `src/runtime/modality` (Astryx's `<html data-astryx-modality>`) |
| Tell a screen reader something changed | `announce(text, "polite" \| "assertive")`, `announcer({ replace })`, `clearAnnouncements()` from `src/runtime/announce` (astryx-astro's live regions) |
| One Tab stop and arrow keys for a group or toolbar, with the "← → to navigate" hint | an Astryx component that has them (SegmentedControl, TabList, Toolbar), or `data-astryx-roving` from `astryx-astro/elements/runtime/roving` |

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
- **Modality** (`runtime/modality.ts`): Astryx's `<html data-astryx-modality="keyboard|pointer|virtual">`, rendered as
  `keyboard` and kept by one tracker that the head starts before the first paint and astryx-astro's components share
  (pointerdown → pointer; a keydown without Meta, Alt or Ctrl → keyboard; a screen reader's click → virtual). Unless
  it is keyboard, `ux.css` hides the ring on a programmatic focus (focus returned to a trigger, a dialog's first
  control), except on text fields. A ring painted some other way checks `:root[data-astryx-modality="keyboard"]`, or
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
- **Components**: astryx-astro's, imported by path (`astryx-astro/components/<Dir>/<Name>.astro`), with their own
  keyboard, focus, hover, press, tooltip and hint behaviour; never add listeners of our own for what a component
  already does. Their look is `src/styles/astryx-workbench.css` (tokens first, then one section per component, in the
  `astryx-theme` layer); a rule for one place (a card's padding, the bars' row) goes in that place's CSS
  (`workbench/styles.mjs` for the lesson page). Their Spanish strings are overridden in `src/i18n/astryx.ts` where
  `workbench/I18N.md` rules Astryx's es-ES out.
- **Announcements** (`runtime/announce.ts`, over astryx-astro's `elements/runtime/announce`): one polite and one
  assertive region per page, created empty, `aria-atomic`, visually hidden; inside the topmost open modal `<dialog>`
  while one is open. A write clears the region, sets the text on the next frame (same-frame messages joined, a repeat kept once) and
  clears it 2s later. Polite unless it's an error or time-critical. One owner per message: what an element already
  shows on screen with a live role isn't announced again, and nothing present at load is announced. An owner from
  `announcer({ replace: true })` withdraws its previous message if it hasn't been read yet (result counts).
- **Roving focus**: Astryx's (its SegmentedControl, TabList and Toolbar, or `data-astryx-roving` from
  `astryx-astro/elements/runtime/roving` for a composite of our own), for a composite control only (radiogroup,
  segmented control, tablist, toolbar, single-choice chips like the collection's area filters); independent controls
  (multi-select chips, a row of unrelated buttons) stay one Tab stop each. One Tab stop: the selected member, else
  the first enabled one. ← → follow the rendered direction (swapped under RTL), Home and End; disabled and hidden
  members are skipped. Selection follows focus within the group; Tab-in never changes the value. The "← → to
  navigate" hint shows once per control on keyboard entry from outside, and goes on the first arrow, on leaving, or
  after 3s. Without JavaScript the control still shows its state; links and native controls still work.

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

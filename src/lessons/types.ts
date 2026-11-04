// What a lesson is made of. Each lesson folder (src/lessons/<slug>/) has:
//
//   sim.ts    the seeded model, shared by the page (experiment results at build time) and the live code
//   figure.ts the machine, drawn at build time (SVG)
//   page.ts   export default defineLesson({...}): text in both languages, the figure, panel, experiments with their
//             results (withResults), questions, and `data` for the live code
//   live.ts   export default function mount(data, root): the animation and the answers to the controls, run in the
//             browser; root is the page's <wb-lesson> (src/elements/wb-lesson.ts)
//
// Text is bilingual: { en, es } pairs (or a plain string when both read the same). Pages show one language.
import type { Bi } from "../i18n";

export type { Bi };

/** A control under the figure: a <wb-control> row. `for` puts it in a group, so the live code can show one group at a
 *  time (root.controls.showFor(group)); `hidden` starts it hidden. An action with `{ primary: true }` is drawn as the panel's primary button (.btn.primary). */
export type Control = (
  | { seg: string; label: Bi; options: [value: string | number, label: Bi][]; value: string | number; /** Options switch on and off independently; value: the ones on at first, space-separated. */ multiple?: boolean }
  | { speed: true; options?: [value: number, label: string][]; value?: number }
  | { actions: [act: string, label: Bi, opts?: { primary?: boolean }][]; label: Bi }
  /** A text box: <input data-input="name">; live code listens to it with root.$('[data-input="name"]'). */
  | { input: string; label: Bi; placeholder?: Bi; aria?: Bi; maxLength?: number }
) & { for?: string; hidden?: boolean };

export interface Plate {
  fig?: Bi;
  /** The machine's name, shown in the plate's corner and on the lesson's card. */
  title: Bi;
  hint?: Bi;
  readout?: Bi;
  keys?: { mark: string; label: Bi }[];
  caption?: Bi;
  /** Attributes on the focusable stage that holds the SVG (the live code finds it by one of them). */
  stage: Record<string, string>;
  /** What the figure is, for screen readers. */
  label: Bi;
}

export interface Experiment {
  id: string;
  title: Bi;
  change: Bi;
  question: Bi;
  options: Bi[];
  /** Index of the option that the model bears out. The card shuffles the options on every page load, so write them in
   *  any order and keep them about the same length. */
  answer: number;
  why: Bi;
  /** Whatever the live code needs to put the figure in this experiment's state ("Watch it on the machine"): sent
   *  to it with the "watch" event. */
  watch?: unknown;
  /** The result, worked out at build time from the model: the verdict and the bars the card shows after a run.
   *  Attach it with withResults(); the card needs no lesson code to run. */
  result?: ExperimentResult;
}

/** One result bar: label, share of the track (0–1), the value text, and whether it's the "after" bar (accented). */
export type ResultBar = [label: Bi, share: number, text: Bi, after?: boolean];
/** An experiment's result: a verdict and bars, or bars in titled groups. */
export type ExperimentResult = { verdict: Bi; bars: ResultBar[] } | { verdict: Bi; groups: { title: Bi; bars: ResultBar[] }[] };

export interface LessonDef<Data = Record<string, unknown>> {
  title: Bi;
  eyebrow: Bi;
  lede: Bi;
  machine: {
    intro: Bi;
    plate: Plate;
    svg: string;
    stats: [key: string, label: Bi, initial?: Bi][];
    controls: Control[];
    note?: Bi;
  };
  predict: { intro: Bi; experiments: Experiment[] };
  explain: { intro?: Bi; questions: [question: Bi, answer: Bi][] };
  footer?: Bi;
  /** Figure-specific CSS. */
  css?: string;
  /** Lit solids fill (black in light, white in dark). Default true. */
  litFill?: boolean;
  /** Build-time values for live.ts (geometry, precomputed results). Serialised into the page as JSON. */
  data: Data;
}

/** Attach each experiment's build-time result: runs[id]() gives the verdict and bars its card shows after a run. */
export const withResults = <E extends Experiment>(list: E[], runs: Record<string, () => ExperimentResult>): E[] =>
  list.map((e) => (runs[e.id] ? { ...e, result: runs[e.id]() } : e));

export const defineLesson = <Data extends Record<string, unknown>>(def: LessonDef<Data>) => def;

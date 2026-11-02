// What a lesson is made of. Each lesson folder (src/lessons/<slug>/) has:
//
//   sim.ts    the seeded model, shared by the page (experiment results at build time) and the live code
//   figure.ts the machine, drawn at build time (SVG)
//   page.ts   export default defineLesson({...}): text in both languages, the figure, panel, experiments, questions,
//             and `data` for the live code
//   live.ts   export default function mount(data): the animation and controls, run in the browser
//
// Text is bilingual: { en, es } pairs (or a plain string when both read the same). Pages show one language.
import type { Bi } from "../i18n";

export type { Bi };

/** A control under the figure. `for` tags it (data-for) so the live code can show one group at a time;
 *  `hidden` starts it hidden. */
export type Control = (
  | { seg: string; label: Bi; options: [value: string | number, label: Bi][]; value: string | number }
  | { speed: true; options?: [value: number, label: string][]; value?: number }
  | { actions: [act: string, label: Bi][]; label: Bi }
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
  /** Index of the option that the model bears out. */
  answer: number;
  why: Bi;
  /** Whatever the live code needs to put the figure in this experiment's state ("Watch it in the figure"). */
  watch?: unknown;
}

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

export const defineLesson = <Data extends Record<string, unknown>>(def: LessonDef<Data>) => def;

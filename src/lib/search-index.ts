// The search index: one record per lesson with every searchable text in both languages. Built at build time
// (pages/search-index.json.ts) and fetched by the collection page only when someone searches or opens a preview.
import { AREA_NAMES } from "../i18n/ui";
import { allLessons, blurbOf, conceptOf, ledeOf, machineOf, type Lesson } from "./lessons";

type Bi = string | { en: string; es: string };
export interface SearchDoc {
  n: number;
  slug: string;
  area: Bi;
  title: Bi;
  concept: Bi;
  machine: Bi;
  blurb: Bi;
  lede: Bi;
  exps: { title: Bi; change: Bi; question: Bi }[];
  qs: Bi[];
}

const text = (v: Bi): Bi => {
  const strip = (s: string) => s.replace(/<[^>]+>/g, "");
  return typeof v === "string" ? strip(v) : { en: strip(v.en), es: strip(v.es) };
};

export const toSearchDoc = (l: Lesson): SearchDoc => ({
  n: l.n,
  slug: l.slug,
  area: AREA_NAMES[l.area],
  title: text(l.page.title),
  concept: conceptOf(l),
  machine: machineOf(l),
  blurb: blurbOf(l),
  lede: ledeOf(l),
  exps: l.page.predict.experiments.map((e) => ({ title: e.title, change: e.change, question: e.question })),
  qs: l.page.explain.questions.map(([q]) => q),
});

export const searchIndex = async () => (await allLessons()).map(toSearchDoc);

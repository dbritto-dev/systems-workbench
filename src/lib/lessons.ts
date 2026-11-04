// Lesson data in the shape pages use: sorted, with the bits every page needs worked out once.
import { getCollection, type CollectionEntry } from "astro:content";
import { pick, isBi, type Bi, type Locale } from "../i18n";
import type { LessonDef } from "../lessons/types";

type Entry = CollectionEntry<"lessons">["data"];

/** A lesson's page, with defaults filled in. */
export interface Page {
  title: Bi; eyebrow: Bi; lede: Bi;
  machine: { intro: Bi };
  predict: LessonDef["predict"];
  explain: { intro: Bi | null; questions: LessonDef["explain"]["questions"] };
  footer: Bi | null; css: string; litFill: boolean;
}
/** A lesson: its registry entry, its definition (src/lessons/<slug>/page.ts) and its page with defaults. */
export type Lesson = Entry & { def: LessonDef; page: Page };

const DEFS = import.meta.glob<{ default: LessonDef }>("/src/lessons/*/page.ts", { eager: true });

const pageOf = (def: LessonDef): Page => ({
  title: def.title, eyebrow: def.eyebrow, lede: def.lede,
  machine: { intro: def.machine.intro },
  predict: def.predict,
  explain: { intro: def.explain.intro ?? null, questions: def.explain.questions },
  footer: def.footer ?? null, css: def.css ?? "", litFill: def.litFill ?? true,
});

export async function allLessons(): Promise<Lesson[]> {
  return (await getCollection("lessons"))
    .map(({ data }) => {
      const def = DEFS[`/src/lessons/${data.slug}/page.ts`]?.default;
      if (!def) throw new Error(`lessons.json lists "${data.slug}" but src/lessons/${data.slug}/page.ts doesn't exist`);
      return { ...data, def, page: pageOf(def) };
    })
    .sort((a, b) => a.n - b.n);
}

/** The lessons to show under "Related lessons": the ones this lesson lists in the registry plus the ones that list it,
 *  in lesson order. A link is written once, on either side. An unknown slug fails the build. */
export function relatedOf(lesson: Lesson, all: Lesson[]): Lesson[] {
  const bySlug = new Map(all.map((l) => [l.slug, l]));
  for (const l of all) for (const s of l.related ?? []) if (!bySlug.has(s)) throw new Error(`lessons.json: "${l.slug}" lists unknown related lesson "${s}"`);
  const slugs = new Set([...(lesson.related ?? []), ...all.filter((l) => l.related?.includes(lesson.slug)).map((l) => l.slug)]);
  slugs.delete(lesson.slug);
  return all.filter((l) => slugs.has(l.slug));
}

export const two = (n: number) => String(n).padStart(2, "0");
const lastPart = (s: string) => s.split("·").pop()!.trim();
const stripTags = (s: string) => s.replace(/<[^>]+>/g, "");

/** "Queues" from the eyebrow "Systems lesson 33 · Queues". */
export const conceptOf = (l: Lesson): Bi => (isBi(l.page.eyebrow) ? { en: lastPart(l.page.eyebrow.en), es: lastPart(l.page.eyebrow.es) } : lastPart(l.page.eyebrow));

/** The machine's name: the figure plate's title. */
export const machineOf = (l: Lesson): Bi => l.def.machine.plate.title;

/** The lede's first sentence(s) up to "This lesson…", for cards. */
export function ledeOf(l: Lesson): Bi {
  const cut = (s: string) => stripTags(s).split(/\s+(?:This lesson|Esta lección)\b/)[0].trim();
  return isBi(l.page.lede) ? { en: cut(l.page.lede.en), es: cut(l.page.lede.es) } : cut(l.page.lede);
}

/** The card blurb: the registry's short lines, falling back to the lede's first sentences in English. */
export const blurbOf = (l: Lesson): Bi => ({ en: l.blurb ?? pick(ledeOf(l), "en"), es: l.blurb_es });

/** Plain text of a bilingual value in one locale (no tags). */
export const plain = (v: Bi, locale: Locale) => stripTags(pick(v, locale));

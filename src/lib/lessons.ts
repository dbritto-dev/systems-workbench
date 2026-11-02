// Lesson data in the shape pages use: sorted, with the bits every page needs worked out once.
import { getCollection, type CollectionEntry } from "astro:content";
import { pick, isBi, type Bi, type Locale } from "../i18n";
import type { LessonDef } from "../lessons/types";

type Entry = CollectionEntry<"lessons">["data"];
type LegacyPage = NonNullable<Entry["page"]>;
/** A lesson's page: from src/lessons/<slug>/page.ts when ported (native), else exported from its build.mjs. */
export type Page = Omit<LegacyPage, "predict"> & { predict: { intro: Bi; experiments: (LegacyPage["predict"]["experiments"][number] & { answer?: number })[] }; native?: LessonDef };
export type Lesson = Omit<Entry, "page"> & { page: Page };

const NATIVE = import.meta.glob<{ default: LessonDef }>("/src/lessons/*/page.ts", { eager: true });
const nativeOf = (slug: string) => NATIVE[`/src/lessons/${slug}/page.ts`]?.default;

function pageOf(def: LessonDef): Page {
  return {
    legacyFile: "",
    title: def.title, eyebrow: def.eyebrow, lede: def.lede,
    machine: { intro: def.machine.intro, figure: "", panel: "" },
    predict: def.predict,
    explain: { intro: def.explain.intro ?? null, questions: def.explain.questions },
    footer: def.footer ?? null, css: def.css ?? "", litFill: def.litFill ?? true,
    native: def,
  };
}

export async function allLessons(): Promise<Lesson[]> {
  return (await getCollection("lessons"))
    .map(({ data }) => {
      const def = nativeOf(data.slug);
      if (!def && !data.page) throw new Error(`No page for ${data.slug}`);
      return { ...data, page: def ? pageOf(def) : (data.page as Page) };
    })
    .sort((a, b) => a.n - b.n);
}

export const two = (n: number) => String(n).padStart(2, "0");
const lastPart = (s: string) => s.split("·").pop()!.trim();
const stripTags = (s: string) => s.replace(/<[^>]+>/g, "");

/** "Queues" from the eyebrow "Systems lesson 33 · Queues". */
export const conceptOf = (l: Lesson): Bi => (isBi(l.page.eyebrow) ? { en: lastPart(l.page.eyebrow.en), es: lastPart(l.page.eyebrow.es) } : lastPart(l.page.eyebrow));

/** The machine's name, from the figure plate's title corner. */
export function machineOf(l: Lesson): Bi {
  if (l.page.native) return l.page.native.machine.plate.title;
  const m = l.page.machine.figure.match(/data-corner="title">([\s\S]*?)<\/span>(?=<span class="iso-plate-corner")/);
  if (!m) return "";
  const one = (lang: "en" | "es") => stripTags(m[1].replace(new RegExp(`<span data-l="${lang === "en" ? "es" : "en"}"[^>]*>[\\s\\S]*?</span>`, "g"), "")).trim();
  const en = one("en"), es = one("es");
  return en === es ? en : { en, es };
}

/** The lede's first sentence(s) up to "This lesson…", for cards. */
export function ledeOf(l: Lesson): Bi {
  const cut = (s: string) => stripTags(s).split(/\s+(?:This lesson|Esta lección)\b/)[0].trim();
  return isBi(l.page.lede) ? { en: cut(l.page.lede.en), es: cut(l.page.lede.es) } : cut(l.page.lede);
}

/** The card blurb: the registry's short line when there is one, otherwise the lede. */
export function blurbOf(l: Lesson): Bi {
  const lede = ledeOf(l);
  if (l.blurb_es) return { en: l.blurb ?? pick(lede, "en"), es: l.blurb_es };
  return l.blurb ?? lede;
}

/** Plain text of a bilingual value in one locale (no tags). */
export const plain = (v: Bi, locale: Locale) => stripTags(pick(v, locale));

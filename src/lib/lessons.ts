// Lesson data in the shape pages use: sorted, with the bits every page needs worked out once.
import { getCollection, type CollectionEntry } from "astro:content";
import { pick, isBi, type Bi, type Locale } from "../i18n";

export type Lesson = CollectionEntry<"lessons">["data"];

export async function allLessons(): Promise<Lesson[]> {
  return (await getCollection("lessons")).map((e) => e.data).sort((a, b) => a.n - b.n);
}

export const two = (n: number) => String(n).padStart(2, "0");
const lastPart = (s: string) => s.split("·").pop()!.trim();
const stripTags = (s: string) => s.replace(/<[^>]+>/g, "");

/** "Queues" from the eyebrow "Systems lesson 33 · Queues". */
export const conceptOf = (l: Lesson): Bi => (isBi(l.page.eyebrow) ? { en: lastPart(l.page.eyebrow.en), es: lastPart(l.page.eyebrow.es) } : lastPart(l.page.eyebrow));

/** The machine's name, from the figure plate's title corner. */
export function machineOf(l: Lesson): Bi {
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

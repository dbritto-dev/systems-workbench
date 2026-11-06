// The search index (every lesson's text, both languages), fetched once per page the first time something needs it:
// a search, an arrival with ?q=, or a preview. Shared by <lesson-collection> and <lesson-preview>.
import type { SearchDoc } from "../lib/search-index";

const cache = new Map<string, Promise<SearchDoc[]>>();

export function loadIndex(url: string): Promise<SearchDoc[]> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then((r) => r.json() as Promise<SearchDoc[]>);
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

export type Locale = "en" | "es";
export type Bi = string | { en: string; es: string };
export const two = (n: number) => String(n).padStart(2, "0");
export const picker = (locale: Locale) => ({
  L: (v: Bi) => (typeof v === "string" ? v : v[locale]),
  T: (en: string, es: string) => (locale === "es" ? es : en),
});

/** Sent by <lesson-collection> when a card's Preview button is pressed; <lesson-preview> opens on it, and hands focus
 *  back to the opener when it closes. */
export const PREVIEW_EVENT = "lesson-preview";
export type PreviewDetail = { card: HTMLElement; opener?: HTMLElement };

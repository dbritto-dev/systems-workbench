// Languages for the site. Content from the lesson builders arrives as { en, es } pairs (or plain strings that read
// the same in both); a page renders one language, picked with pick(). UI strings live in ui.ts.
export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export type Bi<T = string> = T | { en: T; es: T };
export const isBi = <T>(v: Bi<T> | null | undefined): v is { en: T; es: T } =>
  v != null && typeof v === "object" && "en" in (v as object) && "es" in (v as object);
export const pick = <T>(v: Bi<T>, locale: Locale): T => (isBi(v) ? v[locale] : v);

/** The locale a [...lang] route param stands for: undefined is English, "es" is Spanish. */
export const localeOf = (param: string | undefined): Locale => (param === "es" ? "es" : "en");
/** getStaticPaths entries for a [...lang] route: one per locale. */
export const langParams = () => LOCALES.map((l) => ({ lang: l === DEFAULT_LOCALE ? undefined : l }));

/** A site path for a locale, with the base path: href("es", "lessons/cache/") → /systems-workbench/es/lessons/cache/ */
export function href(locale: Locale, path = ""): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  const prefix = locale === DEFAULT_LOCALE ? "" : `${locale}/`;
  return base + prefix + path.replace(/^\//, "");
}

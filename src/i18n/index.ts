// Languages for the site. Content from the lesson builders arrives as { en, es } pairs (or plain strings that read
// the same in both); a page renders one language, picked with pick(). UI strings live in ui.ts.
export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export type Bi<T = string> = T | { en: T; es: T };
export const isBi = <T>(v: Bi<T> | null | undefined): v is { en: T; es: T } =>
  v != null && typeof v === "object" && "en" in (v as object) && "es" in (v as object);
export const pick = <T>(v: Bi<T>, locale: Locale): T => (isBi(v) ? v[locale] : v);

/** getStaticPaths entries for a [...lang] route: one per locale (English has no prefix). Astro.currentLocale then
 *  tells the page which one it is, and getRelativeLocaleUrl() from astro:i18n builds links. */
export const langParams = () => LOCALES.map((l) => ({ lang: l === DEFAULT_LOCALE ? undefined : l }));

/** A bilingual value: t("The machine", "La máquina"). */
export const t = (en: string, es: string) => ({ en, es });

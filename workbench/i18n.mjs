// Bilingual values for the drawing layer: t("DONE", "HECHOS") is { en, es }. Parts that print words on the machine
// (faceText and everything built on it) draw both languages as <g data-l="en"> / <g data-l="es">; the site keeps the
// page's language (src/i18n/localize.ts), and LANG_CSS hides the other one if both are ever on a page.
export const t = (en, es) => ({ en, es });
export const isT = (v) => v != null && typeof v === "object" && "en" in v && "es" in v;

export const LANG_CSS = `
:root:not([data-lang="es"]) [data-l="es"],:root[data-lang="es"] [data-l="en"]{display:none!important}
`;

// The lesson builders produce bilingual HTML: both languages side by side as <span data-l="en">…</span>
// <span data-l="es">…</span> (or <g data-l="…"> in SVG), and aria-labels with data-aria-en / data-aria-es.
// A page here shows one language, so localize() drops the other language's elements and settles every aria-label.
// The markup comes from our own generators and is well formed, so a small tag scanner is enough.
import type { Locale } from "./index";

const TAG = /<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;

export function localize(html: string, locale: Locale): string {
  const other = locale === "en" ? "es" : "en";
  const drop = `data-l="${other}"`;
  let out = "";
  let at = 0;
  let skipping: { name: string; depth: number } | null = null;
  TAG.lastIndex = 0;
  for (let m: RegExpExecArray | null; (m = TAG.exec(html)); ) {
    const [whole, close, name, attrs, selfClose] = m;
    if (skipping) {
      if (name === skipping.name && !selfClose) skipping.depth += close ? -1 : 1;
      if (skipping.depth === 0) { skipping = null; at = m.index + whole.length; }
      continue;
    }
    if (!close && attrs.includes(drop)) {
      out += html.slice(at, m.index);
      if (selfClose) at = m.index + whole.length;
      else skipping = { name, depth: 1 };
      continue;
    }
  }
  out += skipping ? "" : html.slice(at);
  return settleAria(out, locale);
}

// aria-label="EN" data-aria-en="EN" data-aria-es="ES"  →  aria-label="<locale's text>"
function settleAria(html: string, locale: Locale): string {
  return html.replace(/aria-label="[^"]*" data-aria-en="([^"]*)" data-aria-es="([^"]*)"/g, (_, en, es) => `aria-label="${locale === "es" ? es : en}"`);
}

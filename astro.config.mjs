// Systems Workbench site. Static output for GitHub Pages at https://dbritto-dev.github.io/systems-workbench/.
// English lives at the root (/lessons/cache/), Spanish under /es/ (/es/lessons/cache/).
import { defineConfig, fontProviders } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { readFileSync } from "node:fs";
import { LESSON_CSS, TOKENS_CSS } from "./workbench/styles.mjs";

// The lesson stylesheet and the colour tokens are built from the Anatomy kit and the shared parts (one source of
// truth); pages import them as virtual:workbench.css and virtual:tokens.css.
const STYLES = { "virtual:workbench.css": LESSON_CSS, "virtual:tokens.css": TOKENS_CSS };
const workbenchStyles = () => ({
  name: "workbench-styles",
  resolveId: (id) => (id in STYLES ? id : undefined),
  load: (id) => (id in STYLES ? STYLES[id]() : undefined),
});

const site = "https://dbritto-dev.github.io";
const base = "/systems-workbench";
const lessons = JSON.parse(readFileSync("./workbench/collection/lessons.json", "utf8"));

// Type: Montserrat for headings, Source Sans 3 for text, Inconsolata for labels, numbers and readouts (a pairing from
// Figma's Google Fonts guide). Astro's Fonts API self-hosts them from the @fontsource packages' Latin files (which
// cover Spanish): no third-party request, metric-matched fallbacks, preloads from <Font> in layouts/Base.astro.
const face = (pkg, file, weight, style = "normal") => ({ src: [`@fontsource/${pkg}/files/${file}-latin-${weight}-${style}.woff2`], weight, style });
const FONTS = [
  { name: "Montserrat", cssVariable: "--font-heading", fallbacks: ["ui-sans-serif", "system-ui", "sans-serif"],
    variants: [600, 700].map((w) => face("montserrat", "montserrat", w)) },
  { name: "Source Sans 3", cssVariable: "--font-body", fallbacks: ["ui-sans-serif", "system-ui", "sans-serif"],
    variants: [face("source-sans-3", "source-sans-3", 400), face("source-sans-3", "source-sans-3", 400, "italic"), face("source-sans-3", "source-sans-3", 600)] },
  { name: "Inconsolata", cssVariable: "--font-mono", fallbacks: ["ui-monospace", "monospace"],
    variants: [400, 500, 600].map((w) => face("inconsolata", "inconsolata", w)) },
].map(({ variants, ...f }) => ({ ...f, provider: fontProviders.local(), options: { variants } }));

export default defineConfig({
  site,
  base,
  trailingSlash: "always",
  output: "static",
  fonts: FONTS,
  build: { format: "directory" },
  i18n: {
    locales: ["en", "es"],
    defaultLocale: "en",
    routing: { prefixDefaultLocale: false },
  },
  // Lesson links are fetched on hover, so opening one is near-instant.
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
  // Old standalone lesson URLs (lessons/cache/cache-workbench.html) forward to the lesson's page.
  redirects: {
    ...Object.fromEntries(lessons.filter((l) => l.html).map((l) => [`/${l.html}`, `${base}/lessons/${l.slug}/`])),
    "/workbench/parts-gallery.html": `${base}/workbench/parts-gallery/`,
  },
  integrations: [sitemap({ i18n: { defaultLocale: "en", locales: { en: "en", es: "es" } } })],
  // The lessons' model and figure code (lessons/, workbench/) sits outside src/.
  vite: { plugins: [workbenchStyles()], server: { fs: { allow: ["."] } } },
});

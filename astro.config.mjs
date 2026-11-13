// Systems Workbench site. Static output for Cloudflare Pages at https://systems-workbench.pages.dev/
// (.github/workflows/deploy.yml).
// English lives at the root (/lessons/cache/), Spanish under /es/ (/es/lessons/cache/).
import { defineConfig, fontProviders } from "astro/config";
import sitemap from "@astrojs/sitemap";
import astryx from "astryx-astro/integration";
import { readFileSync, writeFileSync } from "node:fs";
import { LESSON_CSS, TOKENS_CSS } from "./workbench/styles.mjs";

// The lesson stylesheet and the colour tokens are built from the Anatomy kit and the shared parts (one source of
// truth); pages import them as virtual:workbench.css and virtual:tokens.css.
const STYLES = { "virtual:workbench.css": LESSON_CSS, "virtual:tokens.css": TOKENS_CSS };
const workbenchStyles = () => ({
  name: "workbench-styles",
  resolveId: (id) => (id in STYLES ? id : undefined),
  load: (id) => (id in STYLES ? STYLES[id]() : undefined),
});

// Where the site is served: the root of SITE_URL. The default is the Cloudflare Pages address; the deploy workflow
// passes the real one (a custom domain, or a pages.dev name with a suffix). BASE_PATH serves it under a sub-path
// instead (e.g. /systems-workbench, as on GitHub Pages before); every link and asset URL follows it.
const site = process.env.SITE_URL || "https://systems-workbench.pages.dev";
const base = (process.env.BASE_PATH || "").replace(/\/+$/, "");
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

const REDIRECTS = {
  ...Object.fromEntries(lessons.filter((l) => l.html).map((l) => [`/${l.html}`, `${base}/lessons/${l.slug}/`])),
  "/workbench/parts-gallery.html": `${base}/workbench/parts-gallery/`,
};
// Cloudflare Pages reads redirects from dist/_redirects and applies them before serving any file. Astro's forwarding
// pages for these URLs are folders (lessons/cache/cache-workbench.html/index.html), which Pages wouldn't find at the
// old .html address, so the rules are what keeps old links working there.
const cloudflareRedirects = () => ({
  name: "cloudflare-redirects",
  hooks: {
    "astro:build:done": ({ dir }) => {
      const rules = Object.entries(REDIRECTS).map(([from, to]) => `${base}${from} ${to} 301`);
      writeFileSync(new URL("_redirects", dir), rules.join("\n") + "\n");
    },
  },
});

export default defineConfig({
  site,
  base: base || "/",
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
  // Old standalone lesson URLs (lessons/cache/cache-workbench.html) forward to the lesson's page: Astro writes a page
  // there that forwards, and cloudflareRedirects() lists them for Cloudflare Pages, which answers with a real 301.
  redirects: REDIRECTS,
  // astryx-astro: Astryx's components ported to Astro (layouts/Base.astro, styles/astryx-workbench.css).
  integrations: [astryx(), sitemap({ i18n: { defaultLocale: "en", locales: { en: "en", es: "es" } } }), cloudflareRedirects()],
  // The lessons' model and figure code (lessons/, workbench/) sits outside src/.
  vite: { plugins: [workbenchStyles()], server: { fs: { allow: ["."] } } },
});

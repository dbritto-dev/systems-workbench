// Systems Workbench site. Static output for GitHub Pages at https://dbritto-dev.github.io/systems-workbench/.
// English lives at the root (/lessons/cache/), Spanish under /es/ (/es/lessons/cache/).
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { readFileSync } from "node:fs";

const site = "https://dbritto-dev.github.io";
const base = "/systems-workbench";
const lessons = JSON.parse(readFileSync("./workbench/collection/lessons.json", "utf8"));

export default defineConfig({
  site,
  base,
  trailingSlash: "always",
  output: "static",
  build: { format: "directory" },
  i18n: {
    locales: ["en", "es"],
    defaultLocale: "en",
    routing: { prefixDefaultLocale: false },
  },
  // Lesson links are fetched on hover, so opening one is near-instant.
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
  // Old standalone lesson URLs (lessons/cache/cache-workbench.html) forward to the lesson's page.
  redirects: Object.fromEntries(lessons.map((l) => [`/${l.html}`, `${base}/lessons/${l.slug}/`])),
  integrations: [sitemap({ i18n: { defaultLocale: "en", locales: { en: "en", es: "es" } } })],
  // The lessons' model and figure code (lessons/, workbench/) sits outside src/.
  vite: { server: { fs: { allow: ["."] } } },
});

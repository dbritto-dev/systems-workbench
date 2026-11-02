// Systems Workbench site. Static output for GitHub Pages at https://dbritto-dev.github.io/systems-workbench/.
// English lives at the root (/lessons/cache/), Spanish under /es/ (/es/lessons/cache/).
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://dbritto-dev.github.io",
  base: "/systems-workbench",
  trailingSlash: "always",
  output: "static",
  build: { format: "directory" },
  i18n: {
    locales: ["en", "es"],
    defaultLocale: "en",
    routing: { prefixDefaultLocale: false },
  },
  // The lessons' model and figure code (lessons/, workbench/) sits outside src/.
  vite: { server: { fs: { allow: ["."] } } },
});

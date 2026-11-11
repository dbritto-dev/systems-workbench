// Tells astryx-astro's server components which theme is active (data-astryx-theme="workbench" on <html>, in
// layouts/Base.astro; styles/astryx-workbench.css) and gives them our Spanish strings (i18n/astryx.ts). The
// components take the page's language from Astro's i18n routing. The site is static: this runs once per page, at
// build time.
import { defineMiddleware } from "astro:middleware";
import { ASTRYX_OVERRIDES } from "./i18n/astryx";

export const onRequest = defineMiddleware((ctx, next) => {
  ctx.locals.astryxTheme = "workbench";
  ctx.locals.astryxOverrides = ASTRYX_OVERRIDES;
  return next();
});

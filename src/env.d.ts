// What src/middleware.ts puts on Astro.locals for astryx-astro's components.
declare namespace App {
  interface Locals {
    astryxTheme?: string;
    astryxOverrides?: Record<string, Record<string, string>>;
  }
}

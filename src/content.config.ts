// One collection, "lessons": the registry (workbench/collection/lessons.json: number, slug, area, card blurbs).
// A lesson ported to the site (src/lessons/<slug>/page.ts) brings its own page; lib/lessons.ts joins it in.
// A lesson not yet ported has page data that tools/export-lessons.mjs collects from its build.mjs into
// src/generated/lessons/<slug>.json. Text fields are bilingual { en, es } pairs (or plain strings that read the same).
import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { readFileSync, existsSync } from "node:fs";

const bi = z.union([z.string(), z.object({ en: z.string(), es: z.string() })]);
const AREAS = ["Fundamentals", "Data", "Concurrency", "Messaging", "Distributed", "Traffic", "Resilience", "Delivery", "Observability", "Frontend", "Search"] as const;

const lessons = defineCollection({
  loader: async () => {
    const registry = JSON.parse(readFileSync("workbench/collection/lessons.json", "utf8")) as Array<Record<string, unknown> & { slug: string }>;
    return registry.map((entry) => {
      if (existsSync(`src/lessons/${entry.slug}/page.ts`)) return { id: entry.slug, ...entry, page: null };
      const file = `src/generated/lessons/${entry.slug}.json`;
      if (!existsSync(file)) throw new Error(`Missing ${file}. Run: node tools/export-lessons.mjs`);
      return { id: entry.slug, ...entry, page: JSON.parse(readFileSync(file, "utf8")) };
    });
  },
  schema: z.object({
    n: z.number().int().positive(),
    slug: z.string(),
    area: z.enum(AREAS),
    blurb: z.string().optional(),
    blurb_es: z.string().optional(),
    page: z.object({
      legacyFile: z.string(),
      title: bi,
      eyebrow: bi,
      lede: bi,
      machine: z.object({ intro: bi, figure: z.string(), panel: z.string() }),
      predict: z.object({
        intro: bi,
        experiments: z.array(z.object({ id: z.string(), title: bi, change: bi, question: bi, options: z.array(bi).min(2), why: bi })),
      }),
      explain: z.object({ intro: bi.nullable(), questions: z.array(z.tuple([bi, bi])) }),
      footer: bi.nullable(),
      css: z.string(),
      litFill: z.boolean(),
    }).nullable(),
  }),
});

export const collections = { lessons };

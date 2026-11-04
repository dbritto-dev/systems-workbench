// One collection, "lessons": the registry (workbench/collection/lessons.json): number, slug, area, the card blurbs,
// `related`, the lessons to link at the end of the page, and, for lessons that started as standalone pages, `html`, the old URL (kept so it redirects). Each lesson's page is defined in
// src/lessons/<slug>/page.ts; lib/lessons.ts joins the two.
import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { file } from "astro/loaders";

const AREAS = ["Fundamentals", "Data", "Concurrency", "Messaging", "Distributed", "Traffic", "Resilience", "Delivery", "Observability", "Frontend", "Search"] as const;

const lessons = defineCollection({
  loader: file("workbench/collection/lessons.json", { parser: (text) => JSON.parse(text).map((l: { slug: string }) => ({ id: l.slug, ...l })) }),
  schema: z.object({
    n: z.number().int().positive(),
    slug: z.string(),
    area: z.enum(AREAS),
    html: z.string().optional(),
    blurb: z.string().optional(),
    blurb_es: z.string(),
    /** Slugs of lessons to link under "Related lessons". Links are shown both ways, so list each pair once. */
    related: z.array(z.string()).optional(),
  }),
});

export const collections = { lessons };

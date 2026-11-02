// Reads each built lesson listed in lessons.json and writes catalog.json: title, machine, lede, experiments, questions.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../../", import.meta.url)); // repo root; lesson paths in lessons.json are relative to it
const lessons = JSON.parse(readFileSync(new URL("./lessons.json", import.meta.url), "utf8"));
// A lesson page may carry both languages as <span data-l="en">…</span><span data-l="es">…</span>.
// bi() returns { en, es } when the two differ, or one string when the page has a single language.
const pick = (html, lang) => html.replace(lang === "en" ? /<span data-l="es"[^>]*>[\s\S]*?<\/span>/g : /<span data-l="en"[^>]*>[\s\S]*?<\/span>/g, "");
const bi = (html, f = (x) => x) => { const en = f(strip(pick(html, "en"))), es = f(strip(pick(html, "es"))); return en === es ? en : { en, es }; };
const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
for (const l of lessons) {
  const h = readFileSync(ROOT + l.html, "utf8");
  l.title = bi(h.match(/<h1>([\s\S]*?)<\/h1>/)[1]);
  l.eyebrow = bi(h.match(/<header>\s*<div class="eyebrow">([\s\S]*?)<\/div>/)[1]);
  l.lede = bi(h.match(/<p class="lede">([\s\S]*?)<\/p>/)[1], (x) => x.split(/\s+(?:This lesson|Esta lección)\b/)[0].trim());
  l.blurb = l.blurb_es && l.blurb ? { en: l.blurb, es: l.blurb_es } : (l.blurb || l.lede);
  l.machine = bi(h.match(/data-corner="title">([\s\S]*?)<\/span>(?=<span class="iso-plate-corner")/)[1]);
  l.exps = [...h.matchAll(/<article class="exp"[\s\S]*?<h3>([\s\S]*?)<\/h3>[\s\S]*?<div class="exp-change">([\s\S]*?)<\/div>\s*<div class="exp-q">([\s\S]*?)<\/div>/g)]
    .map((m) => ({ title: bi(m[1], (x) => x.replace(/^\d+\.\s*/, "")), change: bi(m[2]), question: bi(m[3]) }));
  l.questions = (h.match(/<details>/g) || []).length;
}
writeFileSync(new URL("./catalog.json", import.meta.url), JSON.stringify(lessons, null, 1));
console.log("catalog:", lessons.length, "lessons");

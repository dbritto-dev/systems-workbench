// Reads each built lesson listed in lessons.json and writes catalog.json: title, machine, lede, experiments, questions.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../../", import.meta.url)); // repo root; lesson paths in lessons.json are relative to it
const lessons = JSON.parse(readFileSync(new URL("./lessons.json", import.meta.url), "utf8"));
const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
for (const l of lessons) {
  const h = readFileSync(ROOT + l.html, "utf8");
  l.title = strip(h.match(/<h1>([\s\S]*?)<\/h1>/)[1]);
  l.eyebrow = strip(h.match(/<header>\s*<div class="eyebrow">([\s\S]*?)<\/div>/)[1]);
  l.lede = strip(h.match(/<p class="lede">([\s\S]*?)<\/p>/)[1]).split(/\s+This lesson\b/)[0].trim();
  l.blurb = l.blurb || l.lede;
  l.machine = strip(h.match(/data-corner="title">([\s\S]*?)<\/span>/)[1]);
  l.exps = [...h.matchAll(/<article class="exp"[\s\S]*?<h3>([\s\S]*?)<\/h3>[\s\S]*?<div class="exp-change">([\s\S]*?)<\/div>\s*<div class="exp-q">([\s\S]*?)<\/div>/g)]
    .map((m) => ({ title: strip(m[1]).replace(/^\d+\.\s*/, ""), change: strip(m[2]), question: strip(m[3]) }));
  l.questions = (h.match(/<details>/g) || []).length;
}
writeFileSync(new URL("./catalog.json", import.meta.url), JSON.stringify(lessons, null, 1));
console.log("catalog:", lessons.length, "lessons");

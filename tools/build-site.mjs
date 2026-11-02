// Assembles the GitHub Pages site in _site/ (or the folder given): the catalogue as index.html, every built
// lesson page, the catalogue previews and the parts gallery. Uses only what is committed; no rebuild of lessons.
// node tools/build-site.mjs [outDir]
import { mkdirSync, rmSync, copyFileSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname, resolve } from "node:path";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = resolve(process.argv[2] ?? join(ROOT, "_site"));
const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to); };

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const lessons = JSON.parse(readFileSync(join(ROOT, "workbench/collection/lessons.json"), "utf8"));
for (const l of lessons) {
  if (!existsSync(join(ROOT, l.html))) throw new Error(`missing lesson page: ${l.html}`);
  copy(join(ROOT, l.html), join(OUT, l.html));
}
for (const f of readdirSync(join(ROOT, "workbench/collection/previews"))) copy(join(ROOT, "workbench/collection/previews", f), join(OUT, "previews", f));
copy(join(ROOT, "workbench/parts-gallery.html"), join(OUT, "workbench/parts-gallery.html"));
execFileSync(process.execPath, [join(ROOT, "workbench/collection/build.mjs"), "--pages", join(OUT, "index.html")], { stdio: "inherit" });
writeFileSync(join(OUT, ".nojekyll"), "");
console.log(`site: ${lessons.length} lessons → ${OUT}`);

// Checks a lesson ported to src/lessons/<slug>/ against its standalone page (lessons/<slug>/*-workbench.html):
// the same figure (still frame SVG), the same panel controls, and the same experiment verdicts and bars, in English
// and Spanish. Serve the built site first (pnpm preview), then:
//   CHROMIUM_PATH=/opt/pw-browsers/chromium node tools/port-check.cjs <slug> [<slug> ...]
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const lessons = require("../workbench/collection/lessons.json");
const BASE = process.env.SITE || "http://localhost:4321/systems-workbench/";
const ROOT = path.join(__dirname, "..");

// Drop the other language's elements, as the site does (src/i18n/localize.ts).
function localize(html, lang) {
  const drop = `data-l="${lang === "en" ? "es" : "en"}"`;
  const TAG = /<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let out = "", at = 0, skip = null, m;
  while ((m = TAG.exec(html))) {
    const [whole, close, name, attrs, self] = m;
    if (skip) { if (name === skip.name && !self) skip.depth += close ? -1 : 1; if (!skip.depth) { skip = null; at = m.index + whole.length; } continue; }
    if (!close && attrs.includes(drop)) { out += html.slice(at, m.index); if (self) at = m.index + whole.length; else skip = { name, depth: 1 }; }
  }
  out += skip ? "" : html.slice(at);
  return out.replace(/aria-label="[^"]*" data-aria-en="([^"]*)" data-aria-es="([^"]*)"/g, (_, en, es) => `aria-label="${lang === "es" ? es : en}"`);
}
const svgOf = (html) => { const i = html.indexOf("<svg", html.indexOf('class="iso-stage"')); return html.slice(i, html.indexOf("</svg>", i) + 6); };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  let problems = 0;
  const fail = (msg) => { problems++; console.log("  ✗ " + msg); };
  for (const slug of process.argv.slice(2)) {
    const l = lessons.find((x) => x.slug === slug);
    const legacyFile = path.join(ROOT, l.html);
    const legacyHtml = fs.readFileSync(legacyFile, "utf8");
    for (const lang of ["en", "es"]) {
      console.log(`${slug} ${lang}`);
      const siteHtml = fs.readFileSync(path.join(ROOT, "dist", lang === "es" ? "es" : "", "lessons", slug, "index.html"), "utf8");
      const a = localize(svgOf(legacyHtml), lang), b = svgOf(siteHtml);
      if (a !== b) fail(`figure differs (${a.length} vs ${b.length} chars)`); else console.log(`  ✓ figure identical (${b.length} chars)`);
      const run = async (url) => {
        const page = await (await browser.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(url);
        await page.waitForTimeout(1500);
        const controls = await page.$$eval("[data-set], [data-act]", (els) => els.map((e) => `${e.dataset.set || "act"}=${e.dataset.value || e.dataset.act}:${e.innerText.trim()}:${e.getAttribute("aria-pressed")}`));
        const stats = await page.$$eval("[data-s]", (els) => els.map((e) => e.dataset.s + ":" + e.nextElementSibling.innerText.trim()));
        const out = [];
        for (const card of await page.$$("[data-exp]")) {
          const n = (await card.$$("[data-choice]")).length;
          await (await card.$(`[data-choice="${n - 1}"]`)).click();
          await (await card.$("[data-run]")).click();
          await page.waitForTimeout(150);
          out.push(await card.evaluate((c) => ({ verdict: c.querySelector("[data-outcome]").textContent, bars: [...c.querySelectorAll(".bar")].map((b) => b.textContent + " " + b.querySelector(".fill").style.width) })));
        }
        await page.waitForTimeout(900);
        for (const [i, card] of (await page.$$("[data-exp]")).entries()) out[i].widths = await card.$$eval(".fill", (fs) => fs.map((f) => f.style.width));
        await page.context().close();
        return { errors, controls, stats, out };
      };
      const old = await run(`file://${legacyFile}?lang=${lang}`);
      const now = await run(`${BASE}${lang === "es" ? "es/" : ""}lessons/${slug}/`);
      if (now.errors.length) fail("errors on the site: " + now.errors.join(" | "));
      if (JSON.stringify(old.controls) !== JSON.stringify(now.controls)) fail("controls differ:\n    " + old.controls.join(" ") + "\n    " + now.controls.join(" "));
      else console.log(`  ✓ ${now.controls.length} controls identical`);
      if (JSON.stringify(old.stats) !== JSON.stringify(now.stats)) fail("stat labels differ");
      old.out.forEach((o, i) => {
        const n = now.out[i] || {};
        if (o.verdict !== n.verdict) fail(`experiment ${i + 1} verdict differs:\n    ${o.verdict}\n    ${n.verdict}`);
        if (JSON.stringify(o.widths) !== JSON.stringify(n.widths) || o.bars.length !== (n.bars || []).length) fail(`experiment ${i + 1} bars differ`);
      });
      if (old.out.every((o, i) => now.out[i] && o.verdict === now.out[i].verdict)) console.log(`  ✓ ${old.out.length} verdicts identical`);
    }
  }
  await browser.close();
  console.log(problems ? `\n${problems} problem(s)` : "\nport matches the standalone page");
  process.exit(problems ? 1 : 0);
})();

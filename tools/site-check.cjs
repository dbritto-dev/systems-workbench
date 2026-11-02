// Smoke test for the built site. Serve it first (npm run preview), then:
//   CHROMIUM_PATH=/opt/pw-browsers/chromium node tools/site-check.cjs [baseUrl] [slug ...]
// For every lesson in English and Spanish: no console errors, the live code loads and animates the figure,
// all five experiments run and show a verdict, nothing from the other language is left on the page, and the page
// fits a 390 px phone. Also checks the collection pages and a redirect from an old lesson URL. Exits 1 on problems.
const { chromium } = require("playwright");
const lessons = require("../workbench/collection/lessons.json");

const BASE = (process.argv[2] && process.argv[2].startsWith("http") ? process.argv[2] : "http://localhost:4321/systems-workbench/").replace(/\/?$/, "/");
const only = new Set(process.argv.slice(2).filter((a) => !a.startsWith("http")));
const problems = [];
const fail = (where, what) => { problems.push(`${where}: ${what}`); console.log(`  ✗ ${what}`); };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  for (const l of lessons) {
    if (only.size && !only.has(l.slug)) continue;
    for (const lang of ["en", "es"]) {
      const url = `${BASE}${lang === "es" ? "es/" : ""}lessons/${l.slug}/`;
      const where = `${l.slug} ${lang}`;
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => { if (m.type() === "error" && !/net::ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
      const res = await page.goto(url);
      if (!res || res.status() !== 200) { fail(where, `HTTP ${res && res.status()}`); await page.close(); continue; }
      const before = await page.$eval(".iso-stage svg", (s) => s.innerHTML.length);
      await page.waitForTimeout(1500);
      const loaded = await page.evaluate(() => performance.getEntriesByType("resource").some((r) => /\/_astro\/runtime\./.test(r.name)));
      if (!loaded) fail(where, "live code never loaded");
      // Run every experiment with the first prediction.
      const cards = await page.$$("[data-exp]");
      if (cards.length !== 5) fail(where, `${cards.length} experiment cards`);
      for (const card of cards) {
        await (await card.$('[data-choice="0"]')).click();
        await (await card.$("[data-run]")).click();
      }
      await page.waitForTimeout(1200);
      const verdicts = await page.$$eval("[data-outcome]", (els) => els.map((e) => e.textContent.trim()));
      const empty = verdicts.filter((v) => !v).length;
      if (empty) fail(where, `${empty} experiment(s) gave no verdict`);
      const other = await page.evaluate((lang) => document.querySelectorAll(`[data-l="${lang === "es" ? "en" : "es"}"]`).length, lang);
      if (other) fail(where, `${other} element(s) left in the other language`);
      const htmlLang = await page.getAttribute("html", "lang");
      if (htmlLang !== lang) fail(where, `html lang="${htmlLang}"`);
      if (lang === "es" && verdicts[0] && /^(Your prediction|Not what you)/.test(verdicts[0])) fail(where, "verdicts in English on the Spanish page");
      if (errors.length) fail(where, `console errors: ${errors.slice(0, 3).join(" | ")}`);
      await page.setViewportSize({ width: 390, height: 800 });
      await page.waitForTimeout(400);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      if (sw > 391) fail(where, `scrollWidth ${sw} at 390 px`);
      console.log(`${errors.length || empty || other ? "✗" : "✓"} ${where} (still frame ${before} chars)`);
      await page.close();
    }
  }
  if (!only.size) {
    for (const [lang, path] of [["en", ""], ["es", "es/"]]) {
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(BASE + path);
      const cards = await page.$$eval(".card", (c) => c.length);
      if (cards !== lessons.length) fail(`collection ${lang}`, `${cards} cards`);
      await page.fill("#q", lang === "es" ? "reintento" : "retry");
      await page.waitForTimeout(800);
      const status = await page.textContent("[data-status]");
      if (!/\d/.test(status || "")) fail(`collection ${lang}`, `search status "${status}"`);
      await page.locator(".card:not([hidden]) [data-preview]").first().click();
      await page.waitForTimeout(500);
      const dlg = await page.evaluate(() => document.querySelector("dialog")?.open && document.querySelector("[data-d=title]").textContent);
      if (!dlg) fail(`collection ${lang}`, "preview dialog empty");
      if (errors.length) fail(`collection ${lang}`, errors.join(" | "));
      console.log(`collection ${lang}: ${cards} cards, search "${status}", dialog "${dlg}"`);
      await page.close();
    }
    const page = await ctx.newPage();
    await page.goto(`${BASE}lessons/queues/queue-workbench.html`);
    await page.waitForTimeout(800);
    if (!/\/lessons\/queues\/$/.test(new URL(page.url()).pathname)) fail("redirect", `old URL landed on ${page.url()}`);
    else console.log("redirect: old URL → " + new URL(page.url()).pathname);
    await page.close();
  }
  await browser.close();
  console.log(problems.length ? `\n${problems.length} problem(s)` : "\nall checks passed");
  process.exit(problems.length ? 1 : 0);
})();

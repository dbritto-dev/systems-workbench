// Smoke test for the built site. Serve it first (npm run preview), then:
//   CHROMIUM_PATH=/opt/pw-browsers/chromium node tools/site-check.cjs [baseUrl] [slug ...]   (slugs: separate or a,b,c)
// For every lesson in English and Spanish: no console errors, the live code loads and animates the figure,
// every one-of-N control (the theme switch too) has one selected option holding the Tab stop, all five experiments run (a prediction card,
// then Run) and show a verdict, nothing from the other language is left on the page, and the page fits a 390 px phone. Also checks the collection pages and a redirect from an old lesson URL. Exits 1 on problems.
const { chromium } = require("playwright");
const lessons = require("../workbench/collection/lessons.json");

const isUrl = (a) => /^https?:\/\//.test(a);
const BASE = (process.argv.slice(2).find(isUrl) || "http://localhost:4321/systems-workbench/").replace(/\/?$/, "/");
const only = new Set(process.argv.slice(2).filter((a) => !isUrl(a)).flatMap((a) => a.split(",")).filter(Boolean));
const unknown = [...only].filter((s) => !lessons.some((l) => l.slug === s));
if (unknown.length) { console.error(`unknown lesson(s): ${unknown.join(", ")}`); process.exit(1); }
const problems = [];
// The site chrome (in the page): the top navigation is a TopNav (lessons), the language links mark this page, and the
// theme switch (a SegmentedControl) shows one selected segment holding the group's one Tab stop. "" when all is well.
const chromeState = () => {
  const out = [];
  if (document.querySelector(".page") && !document.querySelector("header .astryx-top-nav")) out.push("no TopNav");
  const cur = document.querySelectorAll('.switches a[data-lang-link][aria-current="page"]');
  if (cur.length !== 1 || cur[0].getAttribute("hreflang") !== document.documentElement.lang) out.push(`${cur.length} current language links`);
  const segs = [...document.querySelectorAll('.switches ax-segmented-control [role="radio"]')];
  const on = segs.filter((b) => b.getAttribute("aria-checked") === "true"), stops = segs.filter((b) => b.getAttribute("tabindex") === "0");
  if (segs.length !== 3 || on.length !== 1 || stops.length !== 1 || on[0] !== stops[0]) out.push(`theme switch: ${on.length} selected, ${stops.length} Tab stops`);
  return out.join(", ");
};
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
      // The live code writes the readout as soon as it runs; the static page says "starting" / "iniciando".
      const loaded = await page.waitForFunction(() => !/^(starting|iniciando)$/.test(document.querySelector("[data-readout]").textContent.trim()), null, { timeout: 6000 }).then(() => true, () => false);
      if (!loaded) fail(where, "live code never ran (readout still at its initial text)");
      // Every one-of-N control (a radiogroup) shows one selected option, and that option is the group's Tab stop.
      const groups = await page.$$eval('wb-seg[role="radiogroup"]', (gs) => gs.map((g) => {
        const on = g.querySelectorAll('[role="radio"][aria-checked="true"]');
        const stop = g.querySelectorAll('[role="radio"][tabindex="0"]');
        return on.length === 1 && stop.length === 1 && stop[0] === on[0] ? "" : `${g.getAttribute("name")}: ${on.length} selected, ${stop.length} Tab stops`;
      }).filter(Boolean));
      if (groups.length) fail(where, `segments: ${groups.join("; ")}`);
      const chrome = await page.evaluate(chromeState);
      if (chrome) fail(where, chrome);
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
      const chrome = await page.evaluate(chromeState);
      if (chrome) fail(`collection ${lang}`, chrome);
      // Power search: free text previews results; "area traffic" + Enter makes an Area token.
      await page.click(".ps-input");
      await page.keyboard.type(lang === "es" ? "reintento" : "retry");
      await page.waitForTimeout(800);
      const status = await page.textContent(".ps-count");
      if (!/\d/.test(status || "")) fail(`collection ${lang}`, `search count "${status}"`);
      await page.fill(".ps-input", "");
      await page.keyboard.type(lang === "es" ? "área tráfico" : "area traffic");
      await page.waitForTimeout(300);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      const token = await page.textContent(".ps-token-edit").catch(() => "");
      const areas = await page.$$eval(".card:not([hidden])", (c) => [...new Set(c.map((x) => x.dataset.area))]);
      if (!token || areas.length !== 1 || areas[0] !== "Traffic") fail(`collection ${lang}`, `area token "${token}" → ${areas.join(",")}`);
      await page.keyboard.press("Escape");
      await page.locator(".card:not([hidden]) [data-preview]").first().click();
      await page.waitForTimeout(500);
      const dlg = await page.evaluate(() => document.querySelector("dialog")?.open && document.querySelector("[data-d=title]").textContent);
      if (!dlg) fail(`collection ${lang}`, "preview dialog empty");
      if (errors.length) fail(`collection ${lang}`, errors.join(" | "));
      console.log(`collection ${lang}: ${cards} cards, search "${status}", token "${token}", dialog "${dlg}"`);
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

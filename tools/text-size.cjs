// How large the words and digits painted on each machine come out. Serve the built site first, then:
//   CHROMIUM_PATH=/opt/pw-browsers/chromium node tools/text-size.cjs [baseUrl] [slug ...]   (slugs: separate or a,b,c)
// Per lesson (English page): the face text (<text> in the figure) and the counter digits, at 1100 px (desktop) and in
// the phone lens's close-up at 390 px (or the figure itself, for a lesson without the lens). Also flags a lens region
// bigger than the close-up. Sizes are px: a text is
// its font-size × the scale of its transform along the baseline (as workbench/kit.mjs textSize() sizes it); a digit is
// its height / 0.72 (DIGIT_EM: the font-size whose digits stand as tall). Hidden text (another state's) counts at
// desktop only when drawn; in the close-up every text the figure holds counts, since the lens can show any of it.
// Two floors on the desktop: FULL lessons were drawn for 11 px; every other lesson is held to 9 px, which the lens's
// close-up (at most 3× the whole figure's scale) still brings to 12 px on a phone. Exits 1 if a lesson's smallest text or
// digit is under its floor on the desktop or under 12 px in the close-up, or a region doesn't fit the close-up; a lesson
// in PENDING (not yet through the text pass) only gets a warning. tools/site-check.cjs runs the same measurement.
const FULL = ["queues", "eventloop", "rrf", "hybrid"];
const PENDING = [];
const MIN = { desk: 11, light: 9, close: 12 };
const floorOf = (slug) => (FULL.includes(slug) ? MIN.desk : MIN.light);
const held = (slug) => !PENDING.includes(slug);
const DIGIT_EM = 0.72;

/** In the page: sizes in viewBox units of every face text and counter digit in the machine, and px per unit. */
function inPage(digitEm) {
  const svg = document.querySelector(".iso-stage svg");
  // Drawn at all? (checkVisibility() says yes for an SVG element under display:none in Chromium; a box says no.)
  const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 || r.height > 0; };
  const texts = [], digits = [];
  for (const svgEl of document.querySelectorAll(".iso-stage svg")) {
    if (!svgEl.getBoundingClientRect().width) continue;   // a figure drawn for the other screen size (neuron)
    const px = svgEl.getScreenCTM().a;
    // An element's scale in the figure's viewBox units (getCTM would include the viewBox's own scaling).
    const scaleOf = (el) => { const m = el.getScreenCTM(); return m ? Math.hypot(m.a, m.b) / px : null; };
    for (const t of svgEl.querySelectorAll("text")) {
      const txt = (t.textContent || "").trim();
      if (!txt) continue;
      // A text that isn't drawn (display:none on it or above it): Chromium's CTM for it is null or leaves out its own
      // transform, so take its own transform times its parent's scale (1 when the parent isn't drawn either).
      const own = () => { const m = t.transform.baseVal.consolidate()?.matrix; return m ? Math.hypot(m.a, m.b) : 1; };
      const s = shown(t) ? scaleOf(t) : own() * (shown(t.parentElement) ? scaleOf(t.parentElement) ?? 1 : 1);
      const vb = parseFloat(getComputedStyle(t).fontSize) * s;
      texts.push({ txt, vb, px, shown: shown(t) });
    }
    for (const w of svgEl.querySelectorAll(".wb-counter path.wb-wheel")) {
      const n = (w.getAttribute("d").match(/-?[\d.]+/g) || []).map(Number);
      if (n.length < 8) continue;
      // faceRect: corners (0,0) (w,0) (w,h) (0,h) on the face; the first and last differ only in height, straight up.
      const h = Math.abs(n[7] - n[1]) * (scaleOf(w) ?? 1);
      digits.push({ txt: w.closest(".wb-counter").dataset.counter, vb: (0.68 * h) / digitEm, px, shown: shown(w) });
    }
  }
  // On a phone with the lens on, the stage is the close-up: the machine's <svg> drawn at the close-up's scale.
  const plate = document.querySelector(".iso-plate[data-lens]");
  const lensOn = !!plate && getComputedStyle(plate.querySelector(".iso-lens")).display !== "none";
  const stage = document.querySelector(".iso-stage");
  const close = lensOn ? stage.querySelector("svg").getScreenCTM().a : null;
  const regions = JSON.parse(plate?.dataset.lens || "{}").regions || [];
  return { texts, digits, close, view: close ? [stage.clientWidth / close, stage.clientHeight / close] : null, regions };
}

const stats = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? { n: s.length, min: s[0], med: s[Math.floor(s.length / 2)] } : null; };
const f = (v) => (v == null ? "  –  " : v.toFixed(1).padStart(5));

/** Desktop (the page at 1100 px): the drawn texts and digits. */
async function measureDesk(page) {
  const r = await page.evaluate(inPage, DIGIT_EM);
  const all = [...r.texts, ...r.digits].filter((x) => x.shown);
  return { text: stats(r.texts.filter((x) => x.shown).map((x) => x.vb * x.px)), digits: stats(r.digits.filter((x) => x.shown).map((x) => x.vb * x.px)),
    smallest: all.sort((a, b) => a.vb * a.px - b.vb * b.px).slice(0, 3).map((x) => `${x.txt} ${(x.vb * x.px).toFixed(1)}`) };
}
/** Phone (the page at 390 px): every text and digit at the close-up's scale; regions that don't fit the close-up. */
async function measureClose(page) {
  await page.evaluate(() => document.querySelector(".iso-stage").scrollIntoView());
  await page.waitForTimeout(300);
  const r = await page.evaluate(inPage, DIGIT_EM);
  const at = (x) => x.vb * (r.close ?? x.px);
  const pool = r.close ? [...r.texts, ...r.digits] : [...r.texts, ...r.digits].filter((x) => x.shown);
  const tight = r.view ? r.regions.filter((g) => g.box[2] > r.view[0] + 0.5 || g.box[3] > r.view[1] + 0.5).map((g) => g.id) : [];
  return { lens: !!r.close, all: stats(pool.map(at)), smallest: pool.sort((a, b) => at(a) - at(b)).slice(0, 3).map((x) => `${x.txt} ${at(x).toFixed(1)}`), tight };
}
/** What's wrong for a lesson held to the minimum ("" when nothing). */
function verdict(desk, close, slug) {
  const out = [];
  const dmin = Math.min(desk.text?.min ?? Infinity, desk.digits?.min ?? Infinity), floor = floorOf(slug);
  if (dmin < floor) out.push(`desktop text ${dmin.toFixed(1)} px < ${floor} (${desk.smallest.join(", ")})`);
  if (close.all && close.all.min < MIN.close) out.push(`close-up text ${close.all.min.toFixed(1)} px < ${MIN.close} (${close.smallest.join(", ")})`);
  if (close.tight.length) out.push(`region(s) bigger than the close-up: ${close.tight.join(", ")}`);
  return out.join("; ");
}

module.exports = { FULL, PENDING, MIN, floorOf, held, measureDesk, measureClose, verdict };

if (require.main === module) {
  const { chromium } = require("playwright");
  const lessons = require("../workbench/collection/lessons.json");
  const isUrl = (a) => /^https?:\/\//.test(a);
  const BASE = (process.argv.slice(2).find(isUrl) || "http://localhost:4321/").replace(/\/?$/, "/");
  const only = new Set(process.argv.slice(2).filter((a) => !isUrl(a)).flatMap((a) => a.split(",")).filter(Boolean));
  (async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    let failed = 0;
    console.log("lesson            desk text min  med | digits min | close-up min  med | lens");
    for (const l of lessons) {
      if (only.size && !only.has(l.slug)) continue;
      await page.setViewportSize({ width: 1100, height: 900 });
      await page.goto(`${BASE}lessons/${l.slug}/`);
      await page.evaluate(() => document.querySelector(".iso-stage").scrollIntoView());
      await page.waitForTimeout(1500);
      const desk = await measureDesk(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(500);
      const close = await measureClose(page);
      const migrated = held(l.slug);
      const bad = verdict(desk, close, l.slug);
      if (migrated && bad) failed++;
      console.log(`${(FULL.includes(l.slug) ? "* " : migrated ? "  " : "? ") + l.slug.padEnd(16)} ${f(desk.text?.min)} ${f(desk.text?.med)}   |   ${f(desk.digits?.min)}    |   ${f(close.all?.min)} ${f(close.all?.med)}   | ${close.lens ? "yes" : "no "}${bad ? (migrated ? "  ✗ " : "  · ") + bad : ""}`);
    }
    await browser.close();
    console.log(`\n* drawn for ${MIN.desk} px on the desktop; the rest held to ${MIN.light} px; ${MIN.close} px in the close-up; ? pending (a warning)${failed ? `. ${failed} under` : ". All held lessons pass"}`);
    process.exit(failed ? 1 : 0);
  })();
}

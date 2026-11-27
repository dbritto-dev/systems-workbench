// Words painted on a machine that run into each other. Serve the built site first, then:
//   CHROMIUM_PATH=/opt/pw-browsers/chromium node tools/text-overlap.cjs [baseUrl] [slug ...]   (slugs: separate or a,b,c)
// For each lesson, in English and Spanish at 1100 px: every drawn <text> in the figure as the box its capitals and
// digits fill (from the baseline up 0.72 em, down 0.04 em, along the text's own baseline, so a turned caption is a
// turned box), and every pair of boxes that overlap by more than GAP px (default 0.5; GAP=-1.5 also lists words less
// than 1.5 px apart, which takes in the two lines of most two-line captions). Not counted: a text mostly hidden behind
// a solid drawn after it, and words on things the live code has moved (in a group whose transform isn't the
// identity), which pass each other on purpose. The figure is checked a moment after it first draws. Exits 1 if any
// lesson has a pair.
const GAP = Number(process.env.GAP ?? 0.5);

/** In the page: the overlapping pairs of words in the machine, as "a × b (n px)". */
function inPage(gap) {
  const svg = document.querySelector(".iso-stage svg");
  if (!svg) return [];
  const drawn = (el) => { const r = el.getBoundingClientRect(); return (r.width > 0 || r.height > 0) && !el.closest("[data-off]"); };
  const faded = (el) => { for (let e = el; e && e !== svg; e = e.parentElement) if (parseFloat(getComputedStyle(e).opacity) < 0.05) return true; return false; };
  const opaque = (el) => el instanceof SVGGeometryElement && !el.classList.contains("iso-halo") && getComputedStyle(el).fill !== "none";
  // Words on something the live code moves (a ticket, a puck, a card in flight) sit in a group it translates: those
  // pile up and pass each other on purpose, so only the words fixed to the machine are checked.
  const moved = (e) => { const m = e.transform?.baseVal.consolidate()?.matrix; return !!m && (Math.abs(m.e) > 0.01 || Math.abs(m.f) > 0.01 || Math.abs(m.a - 1) > 0.001 || Math.abs(m.d - 1) > 0.001); };
  const moving = (el) => { for (let e = el.parentElement; e && e !== svg; e = e.parentElement) if (moved(e)) return true; return false; };
  const boxes = [];
  for (const t of svg.querySelectorAll("text")) {
    const s = (t.textContent || "").trim();
    if (!s || !drawn(t) || faded(t) || moving(t)) continue;
    const bb = t.getBBox(), m = t.getScreenCTM();
    if (!m || !bb.width) continue;
    const fs = parseFloat(t.getAttribute("font-size")) || parseFloat(getComputedStyle(t).fontSize);
    const base = t.y.baseVal.length ? t.y.baseVal[0].value : 0;
    const quad = [[bb.x, base - 0.72 * fs], [bb.x + bb.width, base - 0.72 * fs], [bb.x + bb.width, base + 0.04 * fs], [bb.x, base + 0.04 * fs]]
      .map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
    // Hidden behind something drawn after it? Sample the box; covered at two of five places means it is mostly out of sight.
    const at = (u, v) => { const [a, b, , d] = quad; return [a[0] + (b[0] - a[0]) * u + (d[0] - a[0]) * v, a[1] + (b[1] - a[1]) * u + (d[1] - a[1]) * v]; };
    let covered = 0;
    const samples = [[0.5, 0.5], [0.2, 0.3], [0.8, 0.3], [0.2, 0.7], [0.8, 0.7]];
    for (const [u, v] of samples) {
      const [x, y] = at(u, v);
      if (document.elementsFromPoint(x, y).some((e) => e !== t && opaque(e) && svg.contains(e) && t.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING && !(t.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_CONTAINED_BY))) covered++;
    }
    if (covered >= 2) continue;
    boxes.push({ s, quad });
  }
  // Separating axes: how far two convex quads overlap (negative: the gap between them).
  const axes = (Q) => Q.map((p, i) => { const q = Q[(i + 1) % Q.length]; return [q[1] - p[1], p[0] - q[0]]; });
  const span = (Q, a) => { const v = Q.map((p) => p[0] * a[0] + p[1] * a[1]); return [Math.min(...v), Math.max(...v)]; };
  const depth = (A, B) => {
    let min = Infinity;
    for (const a of [...axes(A), ...axes(B)]) {
      const n = Math.hypot(a[0], a[1]);
      if (!n) continue;
      const u = [a[0] / n, a[1] / n], [a0, a1] = span(A, u), [b0, b1] = span(B, u);
      min = Math.min(min, Math.min(a1, b1) - Math.max(a0, b0));
    }
    return min;
  };
  const out = new Set();
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const d = depth(boxes[i].quad, boxes[j].quad);
    if (d > gap) out.add(`${boxes[i].s} × ${boxes[j].s} (${d.toFixed(1)} px)`);
  }
  return [...out];
}

module.exports = { inPage, GAP };

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
    for (const l of lessons) {
      if (only.size && !only.has(l.slug)) continue;
      const found = [];
      for (const lang of ["", "es/"]) {
        await page.goto(`${BASE}${lang}lessons/${l.slug}/`);
        await page.evaluate(() => document.querySelector(".iso-stage")?.scrollIntoView());
        await page.waitForTimeout(1500);
        for (const pair of await page.evaluate(inPage, GAP)) found.push(`${lang ? "es" : "en"}  ${pair}`);
      }
      if (found.length) failed++;
      console.log(`${found.length ? "✗" : "✓"} ${l.slug}${found.length ? "\n    " + found.join("\n    ") : ""}`);
    }
    await browser.close();
    console.log(failed ? `\n${failed} lesson(s) with words running into each other` : "\nno words run into each other");
    process.exit(failed ? 1 : 0);
  })();
}

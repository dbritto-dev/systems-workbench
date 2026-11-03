// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// The critical rendering path: one page load, millisecond by millisecond. Seeded, shared by the live figure and the
// experiments. Nothing here schedules a paint or a shift on purpose: the network delivers bytes, the parser reads the
// HTML in order, the main thread runs one thing at a time, and a frame is drawn whenever something changed and nothing
// blocks rendering. First paint, LCP and CLS are whatever that produces.
//
// The page: a 400 × 720 px phone viewport over a long article. In the first screen, a header, a headline, the hero
// image (the largest element), a paragraph, an ad slot and two more paragraphs; far below, three more images.
//
// The network: one shared downlink. A request costs a round trip (and a new connection three more), then its bytes
// flow. Downloads in flight split the bandwidth evenly within the most urgent priority that has bytes flowing; the less
// urgent ones wait (HTTP/2 prioritisation, simplified; the levels follow Chrome's defaults):
//   0 highest: the HTML, a stylesheet in the head, the font
//   1 high:    a classic script in the head, the hero when preloaded with fetchpriority=high, an image a layout found
//              inside the viewport (browsers raise those)
//   2 low:     async and defer scripts, other images, the ad, the rest of the CSS when the critical part is inlined
//
// The parser reads tokens as their bytes arrive. A resource referenced in the HTML is requested as soon as its tag's
// bytes are in (the preload scanner looks ahead even while the parser is stuck); the font only when a layout first
// needs it (or at its preload tag); a lazy image only when a layout finds it near the viewport.
//
// The main thread runs one task at a time: parsing, the stylesheet, scripts and rendering (style, layout and paint).
// It renders when something changed, rendering isn't blocked (the stylesheets in the head are in, the body has
// started) and no task is running. Images decode off the main thread.
//
// cfg:
//   css      "link"   one stylesheet linked in the head: render-blocking
//            "inline" the critical rules in a <style> in the head; the full stylesheet loads without blocking
//   js       "head"   classic <script src> in the head: blocks the parser (and waits for the stylesheet first)
//            "async"  downloads alongside, runs as soon as it arrives, interrupting the parser if need be
//            "defer"  downloads alongside, runs after the parser finishes, in order, before DOMContentLoaded
//   font     "block" | "swap" | "optional": font-display of the web font all text uses
//   preloadFont, preloadHero (the hero preload carries fetchpriority=high)
//   lazyHero, lazyBelow: loading="lazy" on the hero, on the three images far below
//   sizeImg  width and height on the images, so their box is reserved before they load
//   sizeAd   a min-height on the ad slot
//   matchFont fallback font metrics matched to the web font (size-adjust, ascent-override…)
//   warm     a repeat visit: everything but the HTML comes from the HTTP cache

import { mulberry32 } from "../../lib/random";
import { averageOver } from "../../lib/stats";

export const VIEW = { w: 400, h: 720 };
// Network, ms and KB. A downlink of 200 KB/s is about 1.6 Mbit/s, a slow mobile connection.
export const NET = { rtt: 150, setup: 3, kbPerMs: 0.2, server: 200, jitter: 0.15 };
// Main-thread costs, ms (decode runs off the main thread).
export const CPU = { parsePerKB: 0.5, cssPerKB: 0.8, app: 300, ad: 60, insert: 5, layout: 30, paint: 15, decode: 25 };
// font-display: how long text stays invisible once the font is first needed, and whether a late font still swaps in.
export const FONT = { block: { block: 3000, swap: true }, swap: { block: 0, swap: true }, optional: { block: 100, swap: false } };
export const LAZY_MARGIN = 1250;          // px below the viewport within which a lazy image starts loading
export const YIELD = 50;                  // ms the parser runs before it lets a frame through
export const RUN_MS = 9000;
export const SIZES = { html: 22, critical: 8, css: 60, app: 100, font: 40, hero: 120, img: 80, adjs: 30, ad: 40 };
export const IMAGES = ["hero", "img2", "img3", "img4"];

// The page, top to bottom. Text heights with the fallback font, then with the web font (it sets wider, so lines wrap
// more). Images 400 × 250 px; the ad slot 260 px tall. The article runs on far below the first screen: 15 paragraphs,
// then the other three images between more paragraphs, beyond the distance where a lazy image would start loading.
const para = (id) => ({ id, kind: "text", fb: 110, web: 132 });
export const FIRST_SCREEN = [
  { id: "header", kind: "box", h: 56 },
  { id: "h1", kind: "text", fb: 72, web: 108 },
  { id: "hero", kind: "img", h: 250, res: "hero" },
  para("p1"),
  { id: "ad", kind: "ad", h: 260 },
  para("p2"),
  para("p3"),
];
export const ELEMENTS = [
  ...FIRST_SCREEN,
  ...Array.from({ length: 15 }, (_, i) => para("m" + i)),
  { id: "img2", kind: "img", h: 250, res: "img2" },
  ...Array.from({ length: 4 }, (_, i) => para("n" + i)),
  { id: "img3", kind: "img", h: 250, res: "img3" },
  ...Array.from({ length: 4 }, (_, i) => para("o" + i)),
  { id: "img4", kind: "img", h: 250, res: "img4" },
];
const BY_ID = Object.fromEntries(ELEMENTS.map((e) => [e.id, e]));

// The HTML as tokens in document order; kb is each token's share of the document, end where its bytes end.
export function tokensFor(cfg) {
  const out = [{ id: "meta", kb: 1 }];
  if (cfg.css === "inline") out.push({ id: "style", kb: SIZES.critical }, { id: "cssRest", kb: 0.2, res: "css" });
  else out.push({ id: "css", kb: 0.2, res: "css" });
  if (cfg.preloadFont) out.push({ id: "preFont", kb: 0.2, res: "font" });
  if (cfg.preloadHero) out.push({ id: "preHero", kb: 0.2, res: "hero" });
  out.push({ id: "app", kb: 0.2, res: "app" }, { id: "adjs", kb: 0.2, res: "adjs" }, { id: "head", kb: 0.3 });
  const kbOf = { box: 1.5, text: 0.6, img: 0.3, ad: 0.2 };
  for (const e of ELEMENTS) out.push({ id: e.id, kb: e.id === "h1" ? 0.4 : kbOf[e.kind], el: e.id, res: e.kind === "img" ? e.res : undefined });
  out.push({ id: "end", kb: 1.3 });
  let at = 0;
  for (const t of out) { at += t.kb; t.end = at; t.arrive = null; t.parsedAt = null; }
  return out;
}

export const DEFAULTS = { css: "link", js: "head", font: "block", preloadFont: false, preloadHero: false, lazyHero: false, lazyBelow: false, sizeImg: false, sizeAd: false, matchFont: false, warm: false };

export function makeLoad(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rnd = mulberry32(seed);
  const jit = () => 1 - NET.jitter + 2 * NET.jitter * rnd();
  const rtt = NET.rtt * jit(), bw = NET.kbPerMs * jit(), server = NET.server * jit();
  const fd = FONT[cfg.font];
  const tokens = tokensFor(cfg);
  const log = [];
  const say = (t, type, info = {}) => log.push({ t, type, ...info });
  const timers = [];
  const after = (at, fn) => timers.push({ at, fn });

  // ---------- the network ----------
  const origins = { site: { readyAt: NET.setup * rtt }, ads: { readyAt: null } };
  const R = {};
  const res = (name, kb, prio, origin = "site") => (R[name] = { name, kb, prio, origin, reqAt: null, fbAt: null, got: 0, doneAt: null, boostAt: null, cache: false, why: null, samples: [] });
  res("html", tokens[tokens.length - 1].end, 0);
  res("css", SIZES.css, cfg.css === "link" ? 0 : 2);
  res("app", SIZES.app, cfg.js === "head" ? 1 : 2);
  res("adjs", SIZES.adjs, 2, "ads");
  res("font", SIZES.font, 0);
  res("hero", SIZES.hero, cfg.preloadHero ? 1 : 2);
  for (const n of ["img2", "img3", "img4"]) res(n, SIZES.img, 2);
  res("ad", SIZES.ad, 2, "ads");

  function request(name, t, why) {
    const r = R[name];
    if (r.reqAt !== null) return;
    r.reqAt = t; r.why = why;
    say(t, "request", { res: name, why });
    if (cfg.warm && name !== "html") {
      // from the HTTP cache: no network at all
      r.cache = true; r.fbAt = t; r.got = r.kb; r.doneAt = t;
      onDone(name, t);
      return;
    }
    const o = origins[r.origin];
    if (o.readyAt === null) o.readyAt = t + NET.setup * rtt;
    r.fbAt = Math.max(t, o.readyAt) + rtt + (name === "html" ? server : 0);
  }

  // ---------- the document ----------
  let parsed = 0;                      // tokens parsed
  let parserWait = null;               // { since } while stuck at a classic script
  let parserBlocked = 0;               // ms the parser spent stuck
  let parseDone = null, dcl = null, loadEvt = null;
  const dom = new Set();               // elements inserted
  const decoded = new Set();           // images ready to paint
  let adIn = false;
  let cssReady = false;                // render-blocking styles in (link: parsed; inline: the <style> parsed)
  let cssFull = false;                 // the whole stylesheet applied
  let appRan = null, appDone = null, adRan = null, deferQueued = false;
  // the font
  let fontUse = null;                  // when a layout first needed it: its display timeline starts here
  let fontLocked = false;              // optional: missed its window, so the fallback stays for this page view
  const fontLoaded = () => R.font.doneAt !== null;
  function fontState(t) {
    if (fontUse === null) return "invisible";
    if (fontLoaded() && !fontLocked) return "web";
    if (t < fontUse + fd.block) return "invisible";
    return "fallback";
  }

  // ---------- the main thread ----------
  let task = null;                     // { kind, t0, t1, label, fn, snap }
  const tasks = [];                    // queued: { kind, cost, fn, label }
  const work = [];                     // what the main thread did: { kind, t0, t1, label }
  let dirty = false, firstLayout = null, lastFrame = -Infinity, bodyAt = Infinity;
  const frames = [];                   // { t, els: [{ id, top, h, show, kind }], font, shift }
  const shifts = [];                   // { t, score }
  const lcp = { t: null, id: null, area: 0 };
  const painted = new Set();           // elements whose content has painted once (LCP candidates)
  let fontFrame = "invisible";
  const queue = (kind, cost, fn, label) => tasks.push({ kind, cost, fn, label });
  const allowed = () => cssReady && dom.has("header");

  function layout(t) {
    const fs = fontState(t);
    const textH = (e) => (fs === "web" || cfg.matchFont ? e.web : e.fb);
    let y = 0;
    const els = [];
    for (const e of ELEMENTS) {
      if (!dom.has(e.id)) continue;
      let h, show;
      if (e.kind === "box") { h = e.h; show = true; }
      else if (e.kind === "text") { h = textH(e); show = fs !== "invisible"; }
      else if (e.kind === "img") { const ok = decoded.has(e.res); h = ok || cfg.sizeImg ? e.h : 0; show = ok; }
      else { h = adIn || cfg.sizeAd ? e.h : 0; show = adIn; }
      els.push({ id: e.id, top: y, h, show, kind: e.kind });
      y += h;
    }
    return { els, font: fs };
  }

  function renderStart(t) {
    if (firstLayout === null) {
      firstLayout = t;
      say(t, "firstLayout");
      // the text needs the font now: its display timeline starts, and it's fetched if nobody asked for it yet
      fontUse = t;
      request("font", t, "layout");
      if (fd.block > 0) after(t + fd.block, (tt) => {
        if (!fontLoaded() && !fd.swap) { fontLocked = true; say(tt, "fontLocked"); }
        else if (!fontLoaded()) say(tt, "fontTimeout");
        dirty = true;
      });
      else if (!fontLoaded() && !fd.swap) fontLocked = true;
    }
    const snap = layout(t);
    // Every layout knows where the images are: a lazy one near the viewport is requested now, and an image inside
    // the viewport is raised to high priority.
    for (const e of snap.els) {
      if (e.kind !== "img") continue;
      const name = BY_ID[e.id].res, r = R[name];
      const lazy = name === "hero" ? cfg.lazyHero : cfg.lazyBelow;
      if (lazy && e.top < VIEW.h + LAZY_MARGIN) request(name, t, "lazy");
      if (e.top < VIEW.h && r.prio > 1 && r.doneAt === null) { r.prio = 1; r.boostAt = t; say(t, "boost", { res: name }); }
    }
    return snap;
  }

  function commit(t, snap) {
    const prev = frames.length ? frames[frames.length - 1] : null;
    let score = 0;
    if (prev) {
      // Layout shift: elements with visible content in both frames, in the viewport in either, whose top moved.
      // score = impact fraction (the union of their old and new boxes, as a share of the viewport) × distance
      // fraction (the largest move over the viewport's larger side). Every box spans the viewport's width.
      const before = new Map(prev.els.map((e) => [e.id, e]));
      const inView = (top, h) => top < VIEW.h && top + h > 0;
      const spans = [];
      let dist = 0;
      for (const e of snap.els) {
        const b = before.get(e.id);
        if (!b || !b.show || !e.show || b.top === e.top) continue;
        if (!inView(b.top, b.h) && !inView(e.top, e.h)) continue;
        spans.push([b.top, b.top + b.h], [e.top, e.top + e.h]);
        dist = Math.max(dist, Math.abs(e.top - b.top));
      }
      if (spans.length) {
        const clip = spans.map(([a, z]) => [Math.max(0, a), Math.min(VIEW.h, z)]).filter(([a, z]) => z > a).sort((p, q) => p[0] - q[0]);
        let area = 0, cur = null;
        for (const s of clip) {
          if (!cur || s[0] > cur[1]) { if (cur) area += cur[1] - cur[0]; cur = [...s]; }
          else cur[1] = Math.max(cur[1], s[1]);
        }
        if (cur) area += cur[1] - cur[0];
        const big = Math.max(VIEW.w, VIEW.h);
        score = (area / VIEW.h) * (Math.min(dist, big) / big);
        if (score > 0) { shifts.push({ t, score }); say(t, "shift", { score, dist }); }
      }
    }
    // LCP: the largest image or text block painted so far, its area inside the viewport when it first paints.
    for (const e of snap.els) {
      if (!e.show || e.kind === "box" || e.kind === "ad" || painted.has(e.id)) continue;
      painted.add(e.id);
      const vis = Math.max(0, Math.min(VIEW.h, e.top + e.h) - Math.max(0, e.top)) * VIEW.w;
      if (vis > lcp.area) { lcp.area = vis; lcp.t = t; lcp.id = e.id; say(t, "lcp", { el: e.id }); }
    }
    if (snap.font !== fontFrame) { say(t, "font", { state: snap.font }); fontFrame = snap.font; }
    frames.push({ t, els: snap.els, font: snap.font, shift: score });
    if (frames.length === 1) say(t, "firstPaint");
  }

  function parseNext(t) {
    // the next token, if its bytes are in and the parser isn't stuck
    if (parsed >= tokens.length || parserWait) return null;
    const tk = tokens[parsed];
    if (tk.arrive === null) return null;
    if (tk.id === "app" && cfg.js === "head") {
      // a classic script: stop until it's downloaded and the stylesheets above it are in, then run it
      parserWait = { since: t };
      say(t, "parserBlocked");
      return null;
    }
    const cost = tk.id === "style" ? CPU.cssPerKB * tk.kb : CPU.parsePerKB * tk.kb;
    return { kind: tk.id === "style" ? "css" : "parse", cost, label: tk.id, fn: (tt) => {
      parsed++; tk.parsedAt = tt;
      if (tk.id === "style") { cssReady = true; say(tt, "criticalCss"); }
      if (tk.el) { dom.add(tk.el); dirty = true; if (tk.el === "header") { bodyAt = tt; say(tt, "body"); } }
      if (parsed === tokens.length) { parseDone = tt; say(tt, "parseDone"); }
    } };
  }

  // The preload scanner: request what the HTML that has arrived references (not lazy images, not fonts in CSS).
  function scan(t) {
    for (const tk of tokens) {
      if (tk.end > R.html.got + 1e-9) break;
      if (tk.arrive === null) tk.arrive = t;
      if (!tk.res || R[tk.res].reqAt !== null) continue;
      if (tk.el && ((tk.res === "hero" && cfg.lazyHero) || (tk.res !== "hero" && cfg.lazyBelow))) continue;
      request(tk.res, t, tk.id === "preFont" || tk.id === "preHero" ? "preload" : "html");
    }
  }

  function onDone(name, t) {
    say(t, "done", { res: name });
    if (name === "css") queue("css", CPU.cssPerKB * R.css.kb, (tt) => {
      if (cfg.css === "link") { cssReady = true; say(tt, "cssReady"); }
      cssFull = true; dirty = true;
    }, "css");
    else if (name === "app" && cfg.js === "async") queue("script", CPU.app, (tt) => { appDone = tt; say(tt, "appDone"); }, "app");
    else if (name === "adjs") queue("script", CPU.ad, (tt) => { adRan = tt; request("ad", tt, "adjs"); }, "adjs");
    else if (name === "ad") after(t + CPU.decode, () => queue("script", CPU.insert, (tt) => { adIn = true; dirty = true; say(tt, "adIn"); }, "adIn"));
    else if (IMAGES.includes(name)) after(t + CPU.decode, (tt) => { decoded.add(name); dirty = true; say(tt, "decoded", { res: name }); });
    else if (name === "font") dirty = true;
  }

  // ---------- run ----------
  request("html", 0, "nav");
  const all = Object.values(R);
  let t = 0;
  for (; t <= RUN_MS; t++) {
    // the network: this millisecond's bytes
    const active = all.filter((r) => r.fbAt !== null && r.fbAt <= t && r.doneAt === null);
    if (active.length) {
      const top = Math.min(...active.map((r) => r.prio));
      const flowing = active.filter((r) => r.prio === top);
      for (const r of flowing) {
        r.got = Math.min(r.kb, r.got + bw / flowing.length);
        if (r.got >= r.kb - 1e-9) { r.got = r.kb; r.doneAt = t; onDone(r.name, t); }
      }
    }
    if (t % 10 === 0) for (const r of all) r.samples.push(r.got / r.kb);
    scan(t);
    for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= t) timers.splice(i, 1)[0].fn(t);
    // a classic script the parser stopped at: runs once it's downloaded and the stylesheet above it is in
    if (parserWait && !task && R.app.doneAt !== null && (cfg.css !== "link" || cssReady)) {
      const since = parserWait.since;
      task = { kind: "script", t0: t, t1: t + CPU.app, label: "app", fn: (tt) => { parserBlocked += tt - since; parserWait = null; tokens[parsed].parsedAt = tt; parsed++; appDone = tt; say(tt, "appDone"); } };
      appRan = t;
      say(t, "appRun", { how: "head" });
    }
    // defer: once parsing is done and it's downloaded, after the stylesheets, before DOMContentLoaded
    if (cfg.js === "defer" && !deferQueued && parseDone !== null && R.app.doneAt !== null && cssReady && (cfg.css !== "link" || cssFull)) {
      deferQueued = true;
      queue("script", CPU.app, (tt) => { appDone = tt; say(tt, "appDone"); }, "app");
    }
    // the main thread
    if (task && t >= task.t1) {
      task.fn(t);
      work.push({ kind: task.kind, t0: task.t0, t1: task.t1, label: task.label });
      if (task.kind === "render") { commit(t, task.snap); lastFrame = t; }
      task = null;
    }
    if (!task) {
      // Render when something changed and nothing blocks it; a parser with more HTML ready keeps going first, but
      // yields after YIELD ms so the page can show what it has.
      const p = parseNext(t);
      if (dirty && allowed() && (!p || t - Math.max(lastFrame, bodyAt) >= YIELD)) {
        dirty = false;
        task = { kind: "render", t0: t, t1: t + CPU.layout + CPU.paint, label: "render", snap: renderStart(t), fn: () => {} };
      } else if (tasks.length) {
        const q = tasks.shift();
        if (q.label === "app") { appRan = t; say(t, "appRun", { how: cfg.js }); }
        if (q.label === "adjs") say(t, "adRun");
        task = { kind: q.kind, t0: t, t1: t + q.cost, label: q.label, fn: q.fn };
      } else if (p) task = { kind: p.kind, t0: t, t1: t + p.cost, label: p.label, fn: p.fn };
    }
    if (dcl === null && parseDone !== null && (cfg.js !== "defer" || appDone !== null)) { dcl = t; say(t, "dcl"); }
    if (loadEvt === null && dcl !== null && !task && !tasks.length && !dirty
      && all.every((r) => r.reqAt === null || (r.doneAt !== null && (!IMAGES.includes(r.name) || decoded.has(r.name))))
      && (R.ad.reqAt === null || adIn) && (cfg.js !== "async" || appDone !== null)) {
      loadEvt = t; say(t, "load");
    }
    if (loadEvt !== null && t > loadEvt + 600 && !timers.length) break;
  }

  // CLS: the largest burst of shifts (a session window: shifts less than 1 s apart, 5 s at most).
  let cls = 0, win = 0, winStart = -Infinity, last = -Infinity;
  for (const s of shifts) {
    if (s.t - last > 1000 || s.t - winStart > 5000) { win = 0; winStart = s.t; }
    win += s.score; last = s.t;
    s.window = win;
    cls = Math.max(cls, win);
  }
  const textFrame = frames.find((f) => f.font !== "invisible");
  return {
    cfg, tokens, R, log, work, frames, shifts, rtt, bw,
    firstPaint: frames.length ? frames[0].t : null, textAt: textFrame ? textFrame.t : null, lcp: lcp.t, lcpId: lcp.id, cls,
    parserBlocked, appRan, appDone, adRan, dcl, load: loadEvt, parseDone, fontUse, fontLocked,
    kb: all.reduce((a, r) => a + (r.cache ? 0 : r.got), 0),
    end: t,
  };
}

// ---------- experiments: headless loads, averaged over seeds ----------
export const SEEDS = [3, 7, 11, 19, 23, 29, 42, 57];
const pick = (m) => ({ fp: m.firstPaint, text: m.textAt ?? RUN_MS, lcp: m.lcp ?? RUN_MS, cls: m.cls, blocked: m.parserBlocked, app: m.appRan ?? RUN_MS, dcl: m.dcl ?? RUN_MS, kb: m.kb });
export const measure = (cfg) => averageOver(SEEDS, (seed) => pick(makeLoad(cfg, seed)));

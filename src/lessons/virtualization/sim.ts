// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// List virtualization (windowing): a long list in a scrolling viewport, frame by frame. Seeded and deterministic,
// shared by the live figure and the experiments. Times are milliseconds, distances CSS pixels.
//
// Each frame (1/60 s):
//   1. the reader's gesture moves the scroll position. The browser scrolls on the compositor, so the frame shows
//      the new position at once, with whatever rows the DOM held after the last main-thread pass;
//   2. any part of the viewport no row covers is blank (a windowed list's rows exist only around the last range it
//      rendered; content-visibility rows outside the laid-out zone have not been painted);
//   3. if the main thread is free, it runs a pass for the new position: the scroll handler works out the range,
//      mounts the rows that came in, unmounts the ones that left, and the browser lays them out. Its result shows
//      from the next frame on, and a pass that takes longer than a frame keeps the next ones from running.
//
// cfg:
//   mode      "full"    every row in the DOM, rendered once up front; scrolling is the compositor's alone
//             "window"  only the rows in the viewport plus `overscan` rows each side are in the DOM
//             "cv"      every row in the DOM with content-visibility: auto; the browser lays out and paints only the
//                       rows within CV_MARGIN of the viewport and skips the rest
//   n         rows in the list
//   overscan  extra rows rendered above and below the viewport ("window")
//   heights   "fixed" (every row ROW px) or "variable" (rows of KINDS px; a row's height is known only once it has
//             been rendered, until then the list assumes `estimate`)
//   estimate  px assumed for a row not measured yet
//   anchor    true: when rows above the one at the top of the viewport change height, move the scroll position by
//             the same amount so the content stays put (what scroll anchoring does)
//   gesture   "read" (a screen at a time, mostly down), "fling" (hard flings), "jump" (drag the scrollbar somewhere,
//             read a screen down, then scroll back up three)
//
// Costs are the model's, not measurements: COST.create to create and style a row's elements, COST.layout to lay it
// out and paint it, COST.pass for one render pass of a framework or virtualizer, COST.scroll for a scroll handler that
// runs but changes nothing. Real numbers depend on the device, the framework and what a row holds.

import { rngMixed } from "../../lib/random";
import { averageOver } from "../../lib/stats";

export const FRAME = 1000 / 60;
export const VIEW = 480;
export const ROW = 48;
export const NODES = 6;                                   // elements per row: the row, avatar, two lines, a button and its icon
export const COST = { create: 0.03, layout: 0.02, unmount: 0.004, pass: 0.4, scroll: 0.15 };
export const KINDS = [48, 72, 96, 120, 216];              // variable rows: one to four lines of text, or a picture
export const KIND_P = [0.4, 0.3, 0.12, 0.08, 0.1];
export const MEAN_H = KINDS.reduce((s, h, i) => s + h * KIND_P[i], 0);
export const EST_LOW = 48;
export const EST_MEAN = Math.round(MEAN_H);
export const MATCH_SHARE = 0.004;                         // rows that contain the word the reader searches for
export const matchCount = (n) => Math.max(1, Math.round(n * MATCH_SHARE));
export const MATCHES = matchCount(10000);
export const CV_MARGIN = VIEW;                            // content-visibility: laid out within one screen of the viewport
export const FLING = [7, 11];                             // a hard fling starts at 7 to 11 px/ms (7,000 to 11,000 px/s)
export const SEEDS = [3, 5, 7, 11, 13, 17, 19, 23];
export const DEFAULTS = { mode: "window", n: 10000, overscan: 3, heights: "fixed", estimate: EST_LOW, anchor: false, gesture: "read" };

// Prefix sums of row heights (a Fenwick tree): the offset of row i and the row at a pixel, in O(log n).
function heightsTree(n, h0) {
  const tree = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) { tree[i] += h0(i - 1); const j = i + (i & -i); if (j <= n) tree[j] += tree[i]; }
  let top = 1; while (top * 2 <= n) top *= 2;
  let total = 0; for (let i = 0; i < n; i++) total += h0(i);
  return {
    get total() { return total; },
    add(i, d) { total += d; for (i++; i <= n; i += i & -i) tree[i] += d; },
    offset(i) { let s = 0; for (; i > 0; i -= i & -i) s += tree[i]; return s; },
    rowAt(px) {
      if (px <= 0) return 0;
      let pos = 0, rem = px;
      for (let step = top; step > 0; step >>= 1) if (pos + step <= n && tree[pos + step] <= rem) { pos += step; rem -= tree[pos]; }
      return Math.min(n - 1, pos);
    },
  };
}

// The reader: a queue of phases, refilled from the gesture's script. Each frame returns how the scroll position moves.
function makeReader(kind, rnd) {
  const queue = [];
  const refill = () => {
    if (kind === "fling") {
      for (const dir of [1, 1, -1]) {
        queue.push({ type: "fling", v0: dir * (FLING[0] + (FLING[1] - FLING[0]) * rnd()), tau: 300 + 100 * rnd() });
        queue.push({ type: "pause", ms: 500 + 300 * rnd() });
      }
    } else if (kind === "jump") {
      const v = 1.2 + 0.6 * rnd();
      queue.push({ type: "to", frac: 0.15 + 0.7 * rnd() }, { type: "pause", ms: 500 });
      queue.push({ type: "move", v, dist: VIEW }, { type: "pause", ms: 400 });
      queue.push({ type: "move", v: -v, dist: 3 * VIEW }, { type: "pause", ms: 600 });
    } else {
      for (let k = 0; k < 3; k++) queue.push({ type: "move", v: 1.2 + 0.6 * rnd(), dist: VIEW }, { type: "pause", ms: 400 + 400 * rnd() });
      queue.push({ type: "move", v: -(1.2 + 0.6 * rnd()), dist: VIEW }, { type: "pause", ms: 400 + 400 * rnd() });
    }
  };
  let cur = null, age = 0, done = 0;
  return {
    get busy() { return cur; },
    // Put phases in front of the script (the live code's buttons), dropping the one in progress.
    inject(phases) { queue.unshift(...phases); cur = null; },
    next(dt) {
      if (!cur) { if (!queue.length) refill(); cur = queue.shift(); age = 0; done = 0; }
      const p = cur;
      age += dt;
      let out = { d: 0, phase: p };
      if (p.type === "pause") { if (age >= p.ms) cur = null; }
      else if (p.type === "to") { out = { to: p.frac, phase: p }; cur = null; }
      else if (p.type === "move") {
        let d = p.v * dt;
        if (Math.abs(done + d) >= p.dist) { d = Math.sign(p.v) * (p.dist - Math.abs(done)); cur = null; }
        done += Math.abs(d); out = { d, phase: p };
      } else if (p.type === "fling") {
        const v = p.v0 * Math.exp(-age / p.tau);
        if (Math.abs(v) < 0.05) cur = null;
        out = { d: v * dt, v, phase: p };
      }
      return out;
    },
  };
}

export function makeList(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const { n, mode } = cfg;
  const variable = cfg.heights === "variable";
  const rnd = rngMixed(seed), pickRnd = rngMixed(seed * 7919 + 1);
  const kind = new Uint8Array(n);
  if (variable) for (let i = 0; i < n; i++) { let u = rnd(), k = 0; while (k < KINDS.length - 1 && u >= KIND_P[k]) { u -= KIND_P[k]; k++; } kind[i] = k; }
  const trueH = (i) => (variable ? KINDS[kind[i]] : ROW);
  const est = variable ? cfg.estimate : ROW;
  const known = new Uint8Array(n);
  const tree = heightsTree(n, () => est);
  const measure = (i) => { if (!known[i]) { known[i] = 1; const d = trueH(i) - est; if (d) tree.add(i, d); } };
  const matchSet = new Set();
  while (matchSet.size < matchCount(n)) matchSet.add(Math.floor(pickRnd() * n));
  const matches = [...matchSet].sort((a, b) => a - b);
  const reader = makeReader(cfg.gesture, rngMixed(seed * 104729 + 3));

  let t = 0, s = 0, ready = false, busyUntil = 0, passS = -1, dirTag = "down";
  let r0 = 0, r1 = -1;                    // rows in the DOM ("window") or laid out ("cv"); "full": all of them
  const maxS = () => Math.max(0, tree.total - VIEW);
  const st = { flings: 0, flingsBlank: 0, flingBlankFrames: 0, frames: 0, moving: 0, blankFrames: 0, blankPx: 0, scrollFrames: 0, scriptMs: 0, rowsSum: 0, jumps: 0, jumpPx: 0,
    tag: { down: { jumps: 0, jumpPx: 0, px: 0 }, up: { jumps: 0, jumpPx: 0, px: 0 }, land: { jumps: 0, jumpPx: 0, px: 0 } } };
  const frame = { blank: [], jump: 0, mainMs: 0, moving: false, passed: false, mounted: 0, loading: true, d: 0, above: [], fling: false };

  function rangeFor(sp) {
    if (mode === "cv") return [tree.rowAt(Math.max(0, sp - CV_MARGIN)), tree.rowAt(sp + VIEW + CV_MARGIN - 1)];
    return [Math.max(0, tree.rowAt(sp) - cfg.overscan), Math.min(n - 1, tree.rowAt(sp + VIEW - 1) + cfg.overscan)];
  }
  // One main-thread pass at scroll position s: returns its cost in ms.
  function pass(first = false) {
    const a = tree.rowAt(s), y0 = tree.offset(a) - s;
    let [q0, q1] = rangeFor(s);
    // Mount (or lay out) what came in, measuring each new row; then the range again with the new heights.
    let mounts = 0, unmounts = 0;
    const take = (lo, hi) => { for (let i = lo; i <= hi; i++) if (i < r0 || i > r1) { mounts++; if (i < a && !known[i]) frame.above.push(i); measure(i); } };
    take(q0, q1);
    const [p0, p1] = rangeFor(s);
    if (p0 < q0 || p1 > q1) { take(Math.min(p0, q0), Math.max(p1, q1)); q0 = Math.min(p0, q0); q1 = Math.max(p1, q1); }
    for (let i = r0; i <= r1; i++) if (i < q0 || i > q1) unmounts++;
    const changed = q0 !== r0 || q1 !== r1;
    r0 = q0; r1 = q1;
    // Rows above the anchor row changed height: the content under the viewport moves, unless the scroll position
    // moves with it.
    const shift = tree.offset(a) - s - y0;
    let jump = 0;
    if (Math.abs(shift) > 0.01) { if (cfg.anchor) s = Math.min(maxS(), Math.max(0, s + shift)); else jump = Math.abs(shift); }
    passS = s;
    frame.mounted = mounts;
    if (mode === "cv") return { cost: (first ? COST.pass + n * COST.create : 0) + mounts * COST.layout, jump };
    return { cost: (first || changed ? COST.pass : 0) + (first ? 0 : COST.scroll) + mounts * (COST.create + COST.layout) + unmounts * COST.unmount, jump };
  }

  // The first render: build the DOM for position 0. Nothing is on screen until it is done.
  let firstMs;
  if (mode === "full") {
    for (let i = 0; i < n; i++) measure(i);
    r0 = 0; r1 = n - 1;
    firstMs = COST.pass + n * (COST.create + COST.layout);
  } else firstMs = pass(true).cost;
  const rowsInDom = () => (mode === "window" ? r1 - r0 + 1 : n);
  const laidOut = () => (mode === "full" ? n : r1 - r0 + 1);

  function blankAt() {
    if (mode === "full") return [];
    const out = [], top = tree.offset(r0), end = tree.offset(r1 + 1);
    if (top > s) out.push([0, Math.min(VIEW, top - s)]);
    if (end < s + VIEW) out.push([Math.max(0, end - s), VIEW]);
    return out;
  }

  function step() {
    frame.jump = 0; frame.passed = false; frame.mounted = 0; frame.above = [];
    if (!ready) {
      t += FRAME;
      frame.blank = [[0, VIEW]]; frame.mainMs = FRAME; frame.loading = true; frame.d = 0;
      if (t >= firstMs) { ready = true; busyUntil = t - FRAME; }
      return;
    }
    frame.loading = false;
    // 1. the main thread, during the last frame: if it was free and the scroll position moved, the scroll handler
    //    ran a pass for that position. Its rows (and any jump it caused) are what this frame shows.
    frame.mainMs = 0;
    if (mode !== "full" && t - FRAME >= busyUntil && s !== passS) {
      const { cost, jump } = pass();
      frame.passed = true; frame.mainMs = Math.min(FRAME, cost); busyUntil = t - FRAME + cost;
      if (mode === "window") { st.scrollFrames++; st.scriptMs += cost; }
      if (jump > 0.5) { frame.jump = jump; st.jumps++; st.jumpPx += jump; st.tag[dirTag].jumps++; st.tag[dirTag].jumpPx += jump; }
    } else if (t - FRAME < busyUntil) frame.mainMs = Math.min(FRAME, busyUntil - (t - FRAME));
    // 2. the gesture moves the scroll position; the compositor shows the new position at once
    const g = reader.next(FRAME), s0 = s;
    frame.d = 0;
    if (g.to !== undefined) { s = g.to * maxS(); dirTag = "land"; }
    else if (g.d) { s = Math.min(maxS(), Math.max(0, s + g.d)); if (s !== s0) dirTag = g.d > 0 ? "down" : "up"; st.tag[dirTag].px += Math.abs(s - s0); frame.d = s - s0; }
    frame.moving = s !== s0;
    // 3. what this frame shows: the new position over the rows the DOM holds
    frame.blank = blankAt();
    const blankPx = frame.blank.reduce((a, [b0, b1]) => a + b1 - b0, 0);
    st.frames++; st.rowsSum += rowsInDom();
    if (frame.moving) st.moving++;
    if (blankPx > 0.5) { st.blankFrames++; st.blankPx += blankPx; }
    const ph = g.phase;
    if (ph && ph.type === "fling") {
      if (!ph.counted) { ph.counted = true; st.flings++; }
      if (blankPx > 0.5) { st.flingBlankFrames++; if (!ph.flashed) { ph.flashed = true; st.flingsBlank++; } }
    }
    frame.fling = !!(ph && ph.type === "fling");
    t += FRAME;
  }

  // Ctrl+F: the browser searches the DOM. The next match in it after the top of the viewport, scrolled into view.
  function find() {
    const inDom = matches.filter((i) => mode !== "window" || (i >= r0 && i <= r1));
    const nextRow = inDom.find((i) => tree.offset(i) > s + 1) ?? inDom[0];
    if (nextRow === undefined) return { found: 0, row: -1 };
    if (mode === "full" || mode === "cv") {
      const to = Math.min(maxS(), Math.max(0, tree.offset(nextRow) - VIEW / 2 + trueH(nextRow) / 2));
      reader.inject([{ type: "pause", ms: 1200 }]);
      s = to; dirTag = "land";
    }
    return { found: inDom.length, row: nextRow };
  }

  return {
    cfg, n, matches, kind, known,
    step,
    find,
    // the live code's buttons
    fling() { reader.inject([{ type: "fling", v0: s > maxS() * 0.9 ? -9 : 9, tau: 350 }, { type: "pause", ms: 800 }]); },
    jumpTo(frac) { reader.inject([{ type: "to", frac }, { type: "pause", ms: 800 }]); },
    offset: (i) => tree.offset(i),
    height: (i) => (known[i] ? trueH(i) : est),
    rowAt: (px) => tree.rowAt(px),
    isMatch: (i) => matchSet.has(i),
    inDom: (i) => mode !== "window" || (i >= r0 && i <= r1),
    laid: (i) => mode === "full" || (i >= r0 && i <= r1),
    foundNow: () => matches.filter((i) => mode !== "window" || (i >= r0 && i <= r1)).length,
    get t() { return t; },
    get s() { return s; },
    get total() { return tree.total; },
    get maxS() { return maxS(); },
    get range() { return [r0, r1]; },
    get ready() { return ready; },
    get firstMs() { return firstMs; },
    get rowsInDom() { return rowsInDom(); },
    get laidOut() { return laidOut(); },
    get dirTag() { return dirTag; },
    frame, st,
  };
}

// ---------- measurements for the experiments ----------
function run(cfg, seed, ms) { const m = makeList(cfg, seed); while (m.t < ms) m.step(); return m; }

// First render and a window resize (every laid-out row laid out again), for a list of n rows.
function costs(cfg) {
  const m = makeList(cfg, 1);
  return { first: m.firstMs, rows: m.rowsInDom, nodes: m.rowsInDom * NODES, resize: m.laidOut * COST.layout };
}
export function lengthRun() {
  return {
    full1k: costs({ mode: "full", n: 1000 }), full10k: costs({ mode: "full", n: 10000 }),
    win1k: costs({ mode: "window", n: 1000 }), win10k: costs({ mode: "window", n: 10000 }),
  };
}

// Hard flings with overscan 0, 3 and 10: how often a moving frame shows blank rows, and how much.
export function overscanRun() {
  return [0, 3, 10].map((overscan) => averageOver(SEEDS, (seed) => {
    const m = run({ mode: "window", gesture: "fling", overscan }, seed, 20000);
    return { flingsBlank: m.st.flingsBlank / Math.max(1, m.st.flings), framesPerFling: m.st.flingBlankFrames / Math.max(1, m.st.flings), blankPx: m.st.blankPx / Math.max(1, m.st.blankFrames), rows: m.st.rowsSum / m.st.frames, flings: m.st.flings };
  }));
}

// Variable heights after a scrollbar jump: jumps per screen scrolled down and up, and their size, for a low estimate,
// the mean as the estimate, and a low estimate with the scroll position corrected.
export function heightRun() {
  const cases = [{ estimate: EST_LOW, anchor: false }, { estimate: EST_MEAN, anchor: false }, { estimate: EST_LOW, anchor: true }];
  return cases.map((c) => averageOver(SEEDS, (seed) => {
    const m = run({ mode: "window", heights: "variable", gesture: "jump", overscan: 3, ...c }, seed, 30000);
    const per = (tag) => m.st.tag[tag].jumps / Math.max(1, m.st.tag[tag].px / VIEW);
    return { down: per("down"), up: per("up"), upPx: m.st.tag.up.jumpPx / Math.max(1, m.st.tag.up.jumps), allJumps: m.st.jumps };
  }));
}

// Ctrl+F at positions all over the list: how many of the MATCHES rows are in the DOM to be found.
export function findRun() {
  return ["full", "cv", "window"].map((mode) => averageOver(SEEDS, (seed) => {
    const m = makeList({ mode, gesture: "jump" }, seed);
    let sum = 0, k = 0;
    while (m.t < 30000) { m.step(); if (m.ready && m.st.frames % 30 === 0) { sum += m.foundNow(); k++; } }
    return { found: sum / Math.max(1, k), first: m.firstMs, rows: m.rowsInDom };
  }));
}

// A short list (100 rows) read top to bottom: full list vs windowed.
export const SMALL_MS = 20000;
export function smallRun() {
  return ["full", "window"].map((mode) => averageOver(SEEDS, (seed) => {
    const m = run({ mode, n: 100, gesture: "read" }, seed, SMALL_MS);
    return { first: m.firstMs, perFrame: m.st.scriptMs / Math.max(1, m.st.scrollFrames), scriptMs: m.st.scriptMs, rows: m.st.rowsSum / m.st.frames };
  }));
}

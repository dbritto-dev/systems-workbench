// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// Layout thrashing: one frame of the browser's main thread, op by op. Seeded, shared by the live figure and the
// experiments. Times are milliseconds of main-thread time.
//
// Every frame a handler goes through a list of `items` and, for each, reads its height (offsetHeight) and writes a
// new value. The browser keeps two dirty marks and does the work they stand for as late as it can:
//   a write     marks style dirty; a geometry write (height) also marks layout dirty and the laid-out boxes for repaint;
//               a colour write marks only that item for repaint; a transform write (an element on its own layer,
//               will-change: transform) marks only the composite step
//   a read      needs up-to-date geometry: if style is dirty it recalculates style, and if layout is dirty it lays out
//               now, before the read returns. That is a forced (synchronous) layout.
//   frame end   the rendering steps: style if dirty, layout if dirty, paint if anything was marked, composite.
// Nothing here counts layouts on purpose: how many happen is whatever the order of reads and writes leaves dirty.
//
// cfg:
//   pattern  "inplace"  each item: read, then write (read, write, read, write…)
//            "batched"  all reads, then all writes
//            "rafWrite" each item reads in the handler and defers its write to a requestAnimationFrame callback
//            "rafBoth"  each item defers both its read and its write to a requestAnimationFrame callback
//   prop     "height" (layout), "color" (background-color: paint only), "transform" (composite only)
//   items    how many items the handler touches
//   dom      boxes on the page
//   contain  the list has contain: strict, so a change inside it is laid out (and repainted) inside it

import { mulberry32 } from "../../lib/random";
import { averageOver } from "../../lib/stats";

export const BUDGET = 1000 / 60;         // one frame at 60 Hz, ms
// Model costs, ms. A layout pays for every box in its scope: the whole page, or the contained list.
export const COST = {
  op: 0.004,                              // one read or one write in JavaScript
  styleBase: 0.02, styleEach: 0.003,      // style recalculation: fixed part + per changed element
  layoutBase: 0.1, layoutBox: 0.002,      // layout: fixed part + per box in scope
  paintBase: 0.3, paintBox: 0.0005,       // paint: fixed part + per box repainted
  composite: 0.25,
};
export const JITTER = 0.15;               // each cost varies ±15% from one run to the next
export const PER_ITEM = 4;                // boxes in one list item
export const LIST_BASE = 20;              // the list's own boxes
export const listBoxes = (items) => LIST_BASE + PER_ITEM * items;
export const DEFAULTS = { pattern: "inplace", prop: "height", items: 40, dom: 2000, contain: false };

// The handler's reads and writes, in the order they run: the task (the event handler), then the rAF callbacks.
// `stray`: one more read, of the first item, after half of the writes (some other code measuring at the wrong time).
export function opsFor(pattern, items, stray = false) {
  const task = [], raf = [];
  for (let i = 0; i < items; i++) {
    if (pattern === "inplace") task.push({ k: "r", i }, { k: "w", i });
    else if (pattern === "rafBoth") raf.push({ k: "r", i }, { k: "w", i });
    else task.push({ k: "r", i });
  }
  if (pattern === "batched") for (let i = 0; i < items; i++) task.push({ k: "w", i });
  if (pattern === "rafWrite") for (let i = 0; i < items; i++) raf.push({ k: "w", i });
  if (stray) {
    const list = raf.some((o) => o.k === "w") ? raf : task;
    let seen = 0, at = list.length;
    for (let n = 0; n < list.length; n++) if (list[n].k === "w" && ++seen === Math.ceil(items / 2)) { at = n + 1; break; }
    list.splice(at, 0, { k: "r", i: 0, stray: true });
  }
  return { task, raf };
}

export function makeRunner(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rnd = mulberry32(seed);
  const jit = () => 1 - JITTER + 2 * JITTER * rnd();
  const scope = cfg.contain ? listBoxes(cfg.items) : cfg.dom;

  // One frame starting at `start`: returns its segments (what the main thread did, in order) and totals.
  function frame(start, { stray = false } = {}) {
    const segs = [];
    let t = start;
    const push = (kind, dur, info = {}) => { segs.push({ kind, t0: t, dur, ...info }); t += dur; };
    let styleDirty = 0, layoutDirty = false, paintBoxes = 0, compositeDirty = false;
    const st = { layouts: 0, forced: 0, recalcs: 0, js: 0, style: 0, layout: 0, paint: 0, composite: 0, painted: 0 };

    // Bring style and layout up to date: at a read (forced) or at the end of the frame.
    function flush(forced, op) {
      if (styleDirty) {
        const d = (COST.styleBase + COST.styleEach * styleDirty) * jit();
        push("style", d, { forced, item: op ? op.i : -1, changed: styleDirty });
        st.style += d; st.recalcs++; styleDirty = 0;
      }
      if (layoutDirty) {
        const d = (COST.layoutBase + COST.layoutBox * scope) * jit();
        st.layouts++; if (forced) st.forced++;
        push("layout", d, { forced, item: op ? op.i : -1, boxes: scope, n: st.layouts, stray: !!(op && op.stray) });
        st.layout += d; layoutDirty = false;
      }
    }
    function run(op, phase) {
      const d = COST.op * jit();
      st.js += d;
      if (op.k === "w") {
        push("write", d, { item: op.i, phase });
        styleDirty++;
        if (cfg.prop === "height") { layoutDirty = true; paintBoxes = Math.max(paintBoxes, scope); }
        else if (cfg.prop === "color") paintBoxes += PER_ITEM;
        else compositeDirty = true;
      } else {
        push("read", d, { item: op.i, phase, stray: !!op.stray });
        flush(true, op);
      }
    }
    const ops = opsFor(cfg.pattern, cfg.items, stray);
    for (const op of ops.task) run(op, "task");
    for (const op of ops.raf) run(op, "raf");
    // The rendering steps.
    flush(false, null);
    if (paintBoxes) {
      const d = (COST.paintBase + COST.paintBox * paintBoxes) * jit();
      push("paint", d, { boxes: paintBoxes }); st.paint += d; st.painted = paintBoxes;
    }
    const dc = COST.composite * jit();
    push("composite", dc, { layer: compositeDirty }); st.composite += dc;
    const end = t;
    // The next frame starts at the first vsync after this one is done.
    const next = Math.max(start + BUDGET, Math.ceil((end - 1e-9) / BUDGET) * BUDGET);
    return { start, end, next, total: end - start, segs, ...st, ops };
  }
  return { cfg, scope, frame };
}

// ---------- experiments: headless runs, averaged over seeds ----------
export const SEEDS = [3, 7, 11, 19, 23, 42];
export const FRAMES = 30;

// Run `frames` frames back to back and average per frame. interval: ms from one frame to the next (vsync-aligned).
export function measure(cfgIn, seed = 1, frames = FRAMES) {
  const r = makeRunner(cfgIn, seed);
  const sum = { layouts: 0, forced: 0, recalcs: 0, total: 0, layout: 0, paint: 0, style: 0, js: 0, interval: 0, over: 0, painted: 0 };
  let t = 0;
  for (let f = 0; f < frames; f++) {
    const fr = r.frame(t);
    for (const k of ["layouts", "forced", "recalcs", "total", "layout", "paint", "style", "js", "painted"]) sum[k] += fr[k];
    sum.interval += fr.next - t;
    if (fr.total > BUDGET) sum.over++;
    t = fr.next;
  }
  const out = {};
  for (const k of Object.keys(sum)) out[k] = sum[k] / frames;
  out.fps = 1000 / out.interval;
  out.boxes = r.scope;
  return out;
}
export const averaged = (cfg) => averageOver(SEEDS, (seed) => measure(cfg, seed));

// 1. Read, write, read, write… vs all reads then all writes.
export function thrashRun() {
  const base = { prop: "height", items: 40, dom: 2000 };
  return { inplace: averaged({ ...base, pattern: "inplace" }), batched: averaged({ ...base, pattern: "batched" }) };
}
// 2. How the cost grows: 10 → 40 items, then a page 4× bigger.
export const SCALE = [[10, 2000], [40, 2000], [40, 8000]];
export function scaleRun() {
  const run = (pattern) => SCALE.map(([items, dom]) => averaged({ pattern, prop: "height", items, dom }));
  return { inplace: run("inplace"), batched: run("batched") };
}
// 3. The same interleaved loop writing height, background-color or transform.
export function propRun() {
  const base = { pattern: "inplace", items: 40, dom: 2000 };
  return { height: averaged({ ...base, prop: "height" }), color: averaged({ ...base, prop: "color" }), transform: averaged({ ...base, prop: "transform" }) };
}
// 4. Independent components: in place, writes deferred to rAF, both deferred to rAF.
export function rafRun() {
  const base = { prop: "height", items: 40, dom: 2000 };
  return { inplace: averaged({ ...base, pattern: "inplace" }), rafWrite: averaged({ ...base, pattern: "rafWrite" }), rafBoth: averaged({ ...base, pattern: "rafBoth" }) };
}
// 5. A big page: contain: strict on the list, with the interleaved loop; batching for comparison.
export function containRun() {
  const base = { prop: "height", items: 40, dom: 8000 };
  return {
    open: averaged({ ...base, pattern: "inplace" }),
    contained: averaged({ ...base, pattern: "inplace", contain: true }),
    batched: averaged({ ...base, pattern: "batched" }),
    both: averaged({ ...base, pattern: "batched", contain: true }),
  };
}

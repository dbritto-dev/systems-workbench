// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// One page's main thread and its compositor, frame by frame. Seeded and event-driven; shared by the live figure and
// the experiments. Times are milliseconds of page time.
//
// The display refreshes at `hz`: a vsync tick every 1000 / hz ms. At a tick the page asks for a frame if it needs
// one (a requestAnimationFrame loop is running, a CSS animation of a layout property is running, or a timer or a
// click changed something since the last frame). The main thread runs that frame as soon as it is free: input
// handlers first, then the frame, then other tasks in arrival order. A frame is the pipeline
//   JS (rAF callbacks) → style → layout → paint
// on the main thread, then composite on the compositor thread; it reaches the screen at the first tick after the
// compositor is done. A tick that shows no new picture of the animation is a missed (dropped) frame.
//
// cfg:
//   hz       60 | 120
//   driver   "raf"    requestAnimationFrame: one callback per frame, its position from the frame's timestamp
//            "timer"  setTimeout(step, 16), re-armed at the end of each step; position from the time it ran
//            "css"    a CSS animation: sampled by the main thread each frame, or by the compositor alone when it
//                     animates transform
//            "none"   nothing animates
//   prop     "transform" (composite only) | "left" (style, layout and paint every frame)
//   work     "none" | "long" (a 200 ms task every second) | "chunk50" | "chunk5" (the same work in chunks that
//            yield to the browser between them)
//   clicks   clicks per second (Poisson), and/or script: [t, …] click times
//   jobs     extra job start times (the live "run a task" button)

import { rng } from "../../lib/random";

export const STEP = 16;                       // setTimeout(step, 16)
export const JOB = { size: 250, every: 1000, first: 300 };
export const CHUNK = { none: 0, long: 0, chunk50: 50, chunk5: 5 };
// What each piece of work costs on this page, in ms (each draw varies ±10%).
export const COST = {
  js: 1.2,                                    // the animation callback: compute the position, write one style
  style: { transform: 0.6, left: 2 },         // recalculate style for the moving element (left: a big page reflows)
  layout: { transform: 0, left: 6 },
  paint: { transform: 0, left: 3 },
  handler: 6,                                 // the click handler
  click: { style: 0.6, layout: 1.2, paint: 0.8 },  // the frame work the click's change adds (the button turns pressed)
  composite: 1.2,                             // compositor thread, per frame
};
export const TIMER_LATE = 1;                  // a timer fires up to 1 ms after it is due, when the thread is free
export const STAGES = ["task", "input", "js", "style", "layout", "paint"];

export function makePage(cfgIn = {}, seed = 1) {
  const cfg = { hz: 60, driver: "raf", prop: "transform", work: "none", clicks: 0, script: [], jobs: [], ...cfgIn };
  const random = rng(seed * 2654435761 + 7);
  const jitter = (x) => x * (0.9 + 0.2 * random());
  const P = 1000 / cfg.hz;
  const chunk = CHUNK[cfg.work] ?? 0;
  const anim = cfg.driver !== "none";
  const compositorOnly = cfg.driver === "css" && cfg.prop === "transform";

  let t = 0;
  // the record the live figure draws and the experiments measure
  const blocks = [];        // main-thread work: { kind, start, end, ia (interaction id or -1), frame (id or -1) }
  const ticks = [];         // { t, fresh, frame (id presented or -1), comp (compositor drew alone) }
  const frames = [];        // { id, v (vsync time), start, end, done, present, state, ias: [] }
  const clicks = [];        // interactions: { id, t, start, end, present }
  const jobs = [];          // { t, start, end }
  // main thread
  let busyUntil = 0, inMain = null;   // what the main thread is doing until busyUntil
  const inputQ = [], taskQ = [];      // taskQ: { ready, kind: "timer" | "chunk", job, left }
  let frameDue = false, animDirty = false, clickDirty = [], lastTick = 0;
  let compFree = 0;
  const presenting = [];              // frames waiting for their tick
  let shown = -Infinity;              // the animation state on screen
  let lastUpdate = -Infinity;         // timer driver: when the position was last computed
  let busy = 0;
  // arrivals
  let nextTick = 0;
  let timerDue = cfg.driver === "timer" ? 0 : Infinity;
  const expo = (rate) => -Math.log(1 - random()) * 1000 / rate;
  let nextClick = cfg.clicks > 0 ? expo(cfg.clicks) : Infinity;
  const script = [...cfg.script].sort((a, b) => a - b);
  const jobTimes = [...cfg.jobs].sort((a, b) => a - b);
  let nextPeriodic = cfg.work !== "none" ? JOB.first : Infinity;

  const needsFrame = () => (anim && (cfg.driver === "raf" || (cfg.driver === "css" && cfg.prop === "left"))) || animDirty || clickDirty.length > 0;

  function block(kind, start, dur, extra = {}) {
    const b = { kind, start, end: start + dur, ia: -1, frame: -1, ...extra };
    blocks.push(b);
    busy += dur;
    return b.end;
  }

  function runFrame(s) {
    const id = frames.length;
    const f = { id, v: lastTick, start: s, end: s, done: 0, present: 0, state: null, ias: clickDirty.map((c) => c.id) };
    let at = s;
    const moving = anim && !compositorOnly && (cfg.driver !== "timer" || animDirty);
    const left = cfg.prop === "left";
    if (cfg.driver === "raf") at = block("js", at, jitter(COST.js), { frame: id });
    const parts = { style: 0, layout: 0, paint: 0 };
    if (moving) { parts.style += COST.style[cfg.prop]; parts.layout += COST.layout[cfg.prop]; parts.paint += COST.paint[cfg.prop]; }
    if (f.ias.length) { parts.style += COST.click.style; parts.layout += COST.click.layout; parts.paint += COST.click.paint; }
    for (const k of ["style", "layout", "paint"]) if (parts[k] > 0) at = block(k, at, jitter(parts[k]), { frame: id, ia: f.ias.length ? f.ias[0] : -1 });
    f.end = at;
    // what this frame shows of the animation
    if (cfg.driver === "raf" || (cfg.driver === "css" && left)) f.state = lastTick;
    else if (cfg.driver === "timer") f.state = lastUpdate;
    f.done = Math.max(f.end, compFree) + COST.composite;
    compFree = f.done;
    f.present = Math.ceil((f.done - 1e-9) / P) * P;
    frames.push(f);
    presenting.push(f);
    animDirty = false; clickDirty = []; frameDue = false;
    inMain = { kind: "frame", frame: f };
    busyUntil = at;
  }

  function dispatch() {
    if (t < busyUntil) return;
    inMain = null;
    if (inputQ.length) {
      const c = inputQ.shift();
      c.start = t;
      busyUntil = block("input", t, jitter(COST.handler), { ia: c.id });
      c.end = busyUntil;
      clickDirty.push(c);
      inMain = { kind: "input", click: c };
      return;
    }
    if (frameDue && needsFrame()) { runFrame(t); return; }
    frameDue = false;
    if (taskQ.length && taskQ[0].ready <= t) {
      const task = taskQ.shift();
      if (task.kind === "timer") {
        const end = block("js", t, jitter(COST.js));
        lastUpdate = t; animDirty = true;
        timerDue = end + STEP + TIMER_LATE * random();
        busyUntil = end;
        inMain = { kind: "timer" };
      } else {
        const job = task.job, n = chunk > 0 ? Math.min(chunk, task.left) : task.left;
        if (job.start === null) job.start = t;
        const end = block("task", t, n, { job: job.id });
        busyUntil = end;
        if (task.left - n > 1e-9) queue({ ready: end, kind: "chunk", job, left: task.left - n });
        else job.end = end;
        inMain = { kind: "task", job };
      }
    }
  }
  const queue = (task) => { let i = taskQ.length; while (i > 0 && taskQ[i - 1].ready > task.ready) i--; taskQ.splice(i, 0, task); };

  function tick(at) {
    lastTick = at;
    let frame = -1, fresh = false, comp = false;
    while (presenting.length && presenting[0].present <= at + 1e-9) {
      const f = presenting.shift();
      frame = f.id;
      if (f.state !== null && f.state > shown) { shown = f.state; fresh = true; }
      for (const id of f.ias) if (clicks[id].present === null) clicks[id].present = at;
    }
    if (compositorOnly) { shown = at; fresh = true; comp = true; }
    ticks.push({ t: at, fresh: anim && fresh, frame, comp });
    if (needsFrame()) frameDue = true;
  }

  function startJob(at) {
    const job = { id: jobs.length, t: at, start: null, end: null };
    jobs.push(job);
    queue({ ready: at, kind: "chunk", job, left: JOB.size });
  }
  function addClick(at) {
    const c = { id: clicks.length, t: at, start: null, end: null, present: null };
    clicks.push(c);
    inputQ.push(c);
    return c;
  }

  function runTo(T) {
    for (let guard = 0; guard < 1e7; guard++) {
      const tc = Math.min(nextClick, script.length ? script[0] : Infinity);
      const tj = Math.min(nextPeriodic, jobTimes.length ? jobTimes[0] : Infinity);
      const tm = busyUntil > t ? busyUntil : Infinity;
      const tq = taskQ.length && busyUntil <= t ? Math.max(t, taskQ[0].ready) : Infinity;
      const next = Math.min(nextTick, tc, tj, timerDue, tm, tq);
      if (next > T) break;
      t = next;
      // everything due at this instant first (the vsync before the main thread picks its next work), then dispatch
      if (t === nextTick) { tick(t); nextTick = (Math.round(t / P) + 1) * P; }
      if (t === tc) {
        if (script.length && script[0] === t) script.shift(); else nextClick = t + expo(cfg.clicks);
        addClick(t);
      }
      if (t === tj) {
        if (jobTimes.length && jobTimes[0] === t) jobTimes.shift(); else nextPeriodic = t + JOB.every;
        startJob(t);
      }
      if (t === timerDue) { queue({ ready: t, kind: "timer" }); timerDue = Infinity; }
      dispatch();
    }
    t = T;
  }

  // What the main thread is doing at time `at` (≤ the model's time): the block under way, or null.
  function activity(at) {
    for (let i = blocks.length - 1; i >= 0 && i >= blocks.length - 40; i--) { const b = blocks[i]; if (b.start <= at && at < b.end) return b; }
    return null;
  }
  // Drop records older than `before` (the live figure keeps a few hundred ms).
  function prune(before) {
    const cut = (arr, endOf) => { let n = 0; while (n < arr.length - 1 && endOf(arr[n]) < before) n++; if (n) arr.splice(0, n); };
    cut(blocks, (b) => b.end); cut(ticks, (k) => k.t);
  }

  return {
    cfg, P, blocks, ticks, frames, clicks, jobs, runTo, activity, prune,
    click: (at) => { runTo(at); const c = addClick(at); dispatch(); return c; },
    job: (at) => { runTo(at); startJob(at); dispatch(); },
    get t() { return t; },
    get busy() { return busy; },
    get waiting() { return inputQ.length; },
    get shown() { return shown; },
  };
}

// ---------- measuring a run ----------
// INP for one visit: the slowest interaction, ignoring the single highest for every 50 interactions.
export function inpOf(latencies) {
  if (!latencies.length) return 0;
  const s = [...latencies].sort((a, b) => b - a);
  return s[Math.min(s.length - 1, Math.floor(latencies.length / 50))];
}
export const latencyOf = (c) => (c.present === null ? null : c.present - c.t);

// Run one page for `ms` and summarise it. Ticks in the first 100 ms are left out (the animation is starting).
export function measure(cfg, seed = 1, ms = 10000) {
  const m = makePage(cfg, seed);
  m.runTo(ms);
  const counted = m.ticks.filter((k) => k.t >= 100);
  const missed = counted.filter((k) => !k.fresh).length;
  // frames missed while a job ran: ticks between a job's start and the end of its last chunk
  const inJob = (k) => m.jobs.some((j) => j.end !== null && k.t > j.t && k.t <= j.end);
  const jobTicks = counted.filter(inJob);
  const done = m.jobs.filter((j) => j.end !== null);
  const lat = m.clicks.map(latencyOf).filter((x) => x !== null);
  const tasks = m.blocks.filter((b) => b.kind === "task");
  // timer driver: positions computed but never shown (overwritten before a frame painted them)
  const painted = new Set(m.frames.map((f) => f.state));
  const updates = m.blocks.filter((b) => b.kind === "js" && b.frame < 0 && b.start >= 100);
  const wasted = updates.filter((b) => !painted.has(b.start)).length;
  const seconds = (ms - 100) / 1000;
  return {
    ticks: counted.length,
    missed, missedShare: missed / Math.max(1, counted.length),
    fps: (counted.length - missed) / seconds,
    jobs: done.length,
    missedPerJob: done.length ? jobTicks.filter((k) => !k.fresh).length / done.length : 0,
    jobMs: done.length ? done.reduce((s, j) => s + (j.end - j.t), 0) / done.length : 0,
    clicks: lat.length, inp: inpOf(lat), meanLatency: lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : 0,
    longestTask: tasks.reduce((a, b) => Math.max(a, b.end - b.start), 0),
    updatesPerSec: updates.length / seconds, wastedPerSec: wasted / seconds,
    busyShare: m.busy / ms,
  };
}

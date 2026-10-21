// One model of a single-threaded event loop, shared by the figure and the experiments.
// Time is in milliseconds of loop time. One operator (the call stack) runs one thing at a time:
// first every microtask in the tray, then a frame if one is due, then the next macrotask on the conveyor.

export const FRAME_MS = 16;          // the heartbeat lamp should blink this often
export const CYCLE_MS = 500;         // every cycle: one CPU job (if any) and, if on, one promise flood
export const TIMER_EVERY = 100;      // the app arms one setTimeout this often
export const IO_EVERY = 50;          // one I/O read is handed to the helpers this often
export const IO_MS = [20, 40];       // a helper takes this long for one read
export const HELPERS = 4;            // background thread pool size
export const CHUNK_MS = 5;           // a chunked CPU job yields after this much work
export const FLOOD = { count: 400, each: 0.5 };   // a promise chain: 400 callbacks of 0.5 ms
export const STEP = 0.25;            // simulation resolution

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// cfg: { job: ms of CPU work per cycle (0 = none), chunk: bool, flood: bool, worker: bool, delay: setTimeout delay ms }
export function createLoop(cfg, seed = 7) {
  const L = {
    _r: rng(seed),
    cfg: { job: 50, chunk: false, flood: false, worker: false, delay: 10, ...cfg },
    t: 0, nextSeq: 1,
    running: null,               // { kind, label, left, total, done, id }
    macro: [], micro: [], timers: [],
    helpers: Array.from({ length: HELPERS }, () => null),
    ioWaiting: [],               // reads waiting for a free helper
    worker: null,                // { left, total, jobId }
    nextFrame: FRAME_MS, lastFrame: 0, frames: 0, flash: 0,
    nextTimer: 0, nextIo: 0, nextCycle: 0,
    log: [],                     // events for experiments: { t, what, ... }
    stats: null,
  };
  resetStats(L);
  return L;
}

export function resetStats(L) {
  L.stats = { since: L.t, busy: 0, timers: 0, lateSum: 0, lateMax: 0, lastLate: 0, gapMax: 0, ioDone: 0, ioWaitSum: 0, ioWaitMax: 0, jobs: 0, lastJob: 0, jobSum: 0, microMax: 0, macroMax: 0, order: [] };
  L.lastFrame = L.t;
}

const task = (L, kind, label, ms, done, extra = {}) => ({ id: L.nextSeq++, kind, label, left: ms, total: ms, done, ...extra });

function armTimer(L, delay, label = "setTimeout", onRun) {
  L.timers.push({ id: L.nextSeq++, due: L.t + delay, set: L.t, label, onRun });
}

function startCpuJob(L) {
  const total = L.cfg.job;
  if (!total) return;
  const begun = L.t;
  const finish = () => { const d = L.t - begun; L.stats.jobs++; L.stats.lastJob = d; L.stats.jobSum += d; L.log.push({ t: L.t, what: "job-done", took: d }); };
  if (L.cfg.worker) {
    L.macro.push(task(L, "cpu", "post to worker", 0.5, () => { L.worker = { left: total, total, done: () => L.macro.push(task(L, "io", "worker result", 1, finish)) }; }));
    return;
  }
  if (!L.cfg.chunk) { L.macro.push(task(L, "cpu", "CPU job", total, finish)); return; }
  let left = total;
  const chunk = () => task(L, "cpu", "CPU chunk", Math.min(CHUNK_MS, left), () => { left -= Math.min(CHUNK_MS, left); if (left > 1e-9) L.macro.push(chunk()); else finish(); });
  L.macro.push(chunk());
}

function startFlood(L) {
  if (!L.cfg.flood) return;
  let n = 0;
  const next = () => task(L, "promise", "promise.then", FLOOD.each, () => { if (++n < FLOOD.count) L.micro.push(next()); });
  L.macro.push(task(L, "io", "start promise chain", 0.5, () => L.micro.push(next())));
}

function submitIo(L) {
  const read = { id: L.nextSeq++, queued: L.t, ms: IO_MS[0] + random(L) * (IO_MS[1] - IO_MS[0]) };
  L.ioWaiting.push(read);
}
const random = (L) => L._r();

// Advance the loop by dt ms (in STEP pieces).
export function advance(L, dt) {
  let left = dt;
  while (left > 1e-9) {
    const step = Math.min(STEP, left);
    tick(L, step);
    left -= step;
  }
}

function tick(L, step) {
  const t = L.t;
  // Scheduled work arriving from outside the loop.
  if (t >= L.nextCycle) { startCpuJob(L); startFlood(L); L.nextCycle += CYCLE_MS; }
  if (t >= L.nextTimer) { armTimer(L, L.cfg.delay); L.nextTimer += TIMER_EVERY; }
  if (t >= L.nextIo) { submitIo(L); L.nextIo += IO_EVERY; }
  // Timers whose time has come move to the conveyor.
  for (let i = 0; i < L.timers.length; i++) {
    const tm = L.timers[i];
    if (tm.due <= t + 1e-9) {
      L.timers.splice(i--, 1);
      L.macro.push(task(L, "timer", tm.label, 0.5, tm.onRun || (() => {}), { due: tm.due, set: tm.set }));
    }
  }
  // Helpers (thread pool) do the reads in the background and drop the callback on the conveyor.
  for (let h = 0; h < L.helpers.length; h++) {
    const job = L.helpers[h];
    if (job) {
      job.left -= step;
      if (job.left <= 0) { L.helpers[h] = null; const doneAt = L.t; L.macro.push(task(L, "io", "I/O callback", 1, () => {}, { ready: doneAt })); }
    }
    if (!L.helpers[h] && L.ioWaiting.length) { const r = L.ioWaiting.shift(); L.helpers[h] = { ...r, left: r.ms, total: r.ms }; }
  }
  if (L.worker) { L.worker.left -= step; if (L.worker.left <= 0) { const w = L.worker; L.worker = null; w.done(); } }
  // The operator.
  if (!L.running) pick(L);
  if (L.running) {
    L.stats.busy += step;
    L.running.left -= step;
    if (L.running.left <= 1e-9) { const r = L.running; L.running = null; r.done && r.done(); }
  }
  L.stats.microMax = Math.max(L.stats.microMax, L.micro.length);
  L.stats.macroMax = Math.max(L.stats.macroMax, L.macro.length);
  L.t = t + step;
  if (L.flash > 0) L.flash -= step;
}

function pick(L) {
  if (L.micro.length) { L.running = L.micro.shift(); return; }
  if (L.t >= L.nextFrame) {
    const gap = L.t - L.lastFrame;
    L.stats.gapMax = Math.max(L.stats.gapMax, gap);
    L.lastFrame = L.t; L.frames++; L.flash = 4;
    while (L.nextFrame <= L.t) L.nextFrame += FRAME_MS;
    L.running = task(L, "frame", "frame", 0.5, () => {});
    return;
  }
  if (!L.macro.length) return;
  const next = L.macro.shift();
  if (next.kind === "timer") {
    const late = L.t - next.due;
    L.stats.timers++; L.stats.lateSum += late; L.stats.lastLate = late; L.stats.lateMax = Math.max(L.stats.lateMax, late);
    L.log.push({ t: L.t, what: "timer", late });
  }
  if (next.ready !== undefined) {
    const w = L.t - next.ready;
    L.stats.ioDone++; L.stats.ioWaitSum += w; L.stats.ioWaitMax = Math.max(L.stats.ioWaitMax, w);
  }
  L.running = next;
}

// ---------- headless runs for the experiments ----------
export function measure(cfg, { ms = 3000, warm = 500, seeds = [3, 5, 7, 11] } = {}) {
  const runs = seeds.map((seed) => {
    const L = createLoop(cfg, seed);
    advance(L, warm);
    resetStats(L);
    advance(L, ms);
    const s = L.stats;
    return {
      busy: s.busy / ms,
      lateMax: s.lateMax, lateAvg: s.timers ? s.lateSum / s.timers : 0,
      gapMax: s.gapMax, frames: L.frames,
      ioWaitAvg: s.ioDone ? s.ioWaitSum / s.ioDone : 0, ioWaitMax: s.ioWaitMax,
      jobAvg: s.jobs ? s.jobSum / s.jobs : 0,
    };
  });
  const mean = (k) => runs.reduce((a, r) => a + r[k], 0) / runs.length;
  return Object.fromEntries(Object.keys(runs[0]).map((k) => [k, mean(k)]));
}

// The order puzzle: one script that logs, queues a promise callback and arms setTimeout(0), run on an idle loop.
export function orderPuzzle() {
  const L = createLoop({ job: 0, flood: false, delay: 1e9 });
  L.nextTimer = 1e12; L.nextIo = 1e12; L.nextCycle = 1e12; L.nextFrame = 1e12;
  const order = [];
  L.macro.push(task(L, "io", "script", 1, () => {
    armTimer(L, 0, "setTimeout 0", () => order.push("setTimeout(0) callback"));
    L.micro.push(task(L, "promise", "promise.then", 0.5, () => order.push("Promise.then callback")));
    order.push("console.log in the script");
  }));
  advance(L, 10);
  return order;
}

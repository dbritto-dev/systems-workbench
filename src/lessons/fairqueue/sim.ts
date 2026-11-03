// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// A dispatch desk: four tenants (A, B, C and D, the batch tenant) put jobs into their own lanes, and one worker takes
// one job at a time. The scheduler decides which lane goes next. Event-driven and seeded, shared by the live figure
// and the experiments. Times are seconds of figure time; the worker does about one job a second.
//
// cfg:
//   sched    "fifo"  one line: the oldest ticket, whatever its lane
//            "rr"    round robin over the lanes that have work, `weights[i]` jobs per turn
//            "fair"  fair by work (deficit round robin): each turn adds QUANTUM × weight seconds of credit to the lane,
//                    and the lane may run jobs while their work fits its credit
//            "prio"  strict priority: A, B and C share the high lane (oldest first); D only runs when it is empty
//            "slots" fixed slots: every tenant owns `weights[i]` slots in a fixed cycle; an empty lane's slot is kept
//                    for it and the worker idles through it (reserved capacity, not work-conserving)
//   weights  [A, B, C, D] turns or credit per round (rr, fair, slots)
//   sizes    [A, B, C, D] mean work of a job, in multiples of SERVICE (each job 0.5..1.5 × that)
//   rates    [A, B, C, D] steady arrivals per second (Poisson)
//   spike    { from, to, rate }: A, B and C each send `rate` per second between `from` and `to`
//   script   [[t, tenant, n], …]: n jobs dropped into a lane at once at time t (a batch job)

import { rng } from "../../lib/random";
import { averageOver, rankQuantile } from "../../lib/stats";

export const NAMES = "ABCD";
export const N = 4;
export const SERVICE = 1;                 // mean seconds of work per job: the worker does about 1 job/s
export const SLOT = 1;                    // fixed slots: an empty lane's slot keeps the worker idle this long
export const QUANTUM = 1;                 // fair by work: seconds of credit a lane gets per turn (× its weight)
export const BASE_RATES = [0.1, 0.1, 0.1, 0.05];
export const HIGH = [true, true, true, false];
export const DEFAULTS = { sched: "fifo", weights: [1, 1, 1, 1], sizes: [1, 1, 1, 1], rates: BASE_RATES, spike: null, script: [] };

export function makeDesk(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const random = rng(seed);
  const expo = (rate) => (rate > 0 ? -Math.log(1 - random()) / rate : Infinity);
  let t = 0, nextId = 1;
  const lanes = Array.from({ length: N }, () => []);
  const done = [];                          // finished jobs: { id, tenant, born, start, end, size, batch }
  const idles = [];                         // fixed slots kept idle: { lane, start, end, waiting }
  const st = { arrived: 0, done: 0, busy: 0, idle: 0, idleWithWork: 0, busyBy: [0, 0, 0, 0] };
  const log = [];                           // what the live figure narrates: { t, type, … }
  let current = null;                       // { job, start, end } or { idle: lane, start, end }
  const script = [...cfg.script].sort((a, b) => a[0] - b[0]);
  // scheduler state
  let rrAt = 0, rrLeft = cfg.weights[0];
  let drrAt = 0, drrFresh = true;
  const credit = [0, 0, 0, 0];
  let slotAt = N - 1, slotLeft = 0;

  const rateOf = (i, at) => (cfg.spike && HIGH[i] && at >= cfg.spike.from && at < cfg.spike.to ? cfg.spike.rate : cfg.rates[i]);
  const nextArr = Array.from({ length: N }, (_, i) => expo(rateOf(i, 0)));
  const bounds = cfg.spike ? [cfg.spike.from, cfg.spike.to].filter((b) => b > 0) : [];

  function arrive(i, at, batch = false) {
    const job = { id: nextId++, tenant: i, born: at, size: SERVICE * cfg.sizes[i] * (0.5 + random()), batch };
    lanes[i].push(job);
    st.arrived++;
    return job;
  }
  const any = () => lanes.some((l) => l.length);
  const take = (i) => lanes[i].shift();

  function choose() {
    if (!any()) return null;
    const w = cfg.weights;
    if (cfg.sched === "fifo") {
      let best = -1;
      for (let i = 0; i < N; i++) if (lanes[i].length && (best < 0 || lanes[i][0].id < lanes[best][0].id)) best = i;
      return { job: take(best) };
    }
    if (cfg.sched === "prio") {
      let best = -1;
      for (const high of [true, false]) {
        for (let i = 0; i < N; i++) if (HIGH[i] === high && lanes[i].length && (best < 0 || lanes[i][0].id < lanes[best][0].id)) best = i;
        if (best >= 0) break;
      }
      return { job: take(best) };
    }
    if (cfg.sched === "rr") {
      for (let k = 0; k < 2 * N + 1; k++) {
        if (lanes[rrAt].length && rrLeft > 0) { rrLeft--; return { job: take(rrAt) }; }
        rrAt = (rrAt + 1) % N; rrLeft = w[rrAt];
      }
      return null;
    }
    if (cfg.sched === "fair") {
      for (let k = 0; k < 4000; k++) {
        const lane = lanes[drrAt];
        if (!lane.length) { credit[drrAt] = 0; drrAt = (drrAt + 1) % N; drrFresh = true; continue; }
        if (drrFresh) { credit[drrAt] += QUANTUM * w[drrAt]; drrFresh = false; }
        if (lane[0].size <= credit[drrAt] + 1e-9) { credit[drrAt] -= lane[0].size; return { job: take(drrAt) }; }
        drrAt = (drrAt + 1) % N; drrFresh = true;
      }
      return null;
    }
    // fixed slots
    if (slotLeft <= 0) { slotAt = (slotAt + 1) % N; slotLeft = w[slotAt]; }
    slotLeft--;
    return lanes[slotAt].length ? { job: take(slotAt) } : { idle: slotAt };
  }

  function startNext(at) {
    if (current) return;
    const c = choose();
    if (!c) return;
    if (c.job) {
      current = { job: c.job, start: at, end: at + c.job.size };
      log.push({ t: at, type: "start", job: c.job });
    } else {
      current = { idle: c.idle, start: at, end: at + SLOT, waiting: any() };
      log.push({ t: at, type: "idle", lane: c.idle, waiting: current.waiting });
    }
  }

  function account(from, to) {
    if (to <= from) return;
    if (current && current.job) { st.busy += to - from; st.busyBy[current.job.tenant] += to - from; }
    else { st.idle += to - from; if (current && current.waiting) st.idleWithWork += to - from; }
  }

  function runTo(until) {
    for (let guard = 0; guard < 1e6; guard++) {
      let next = until, kind = null, who = -1;
      for (let i = 0; i < N; i++) if (nextArr[i] < next) { next = nextArr[i]; kind = "arrive"; who = i; }
      if (current && current.end < next) { next = current.end; kind = "end"; }
      if (script.length && script[0][0] < next) { next = script[0][0]; kind = "script"; }
      for (const b of bounds) if (b > t && b < next) { next = b; kind = "bound"; }
      if (!kind) break;
      account(t, next);
      t = next;
      if (kind === "arrive") {
        const job = arrive(who, t);
        log.push({ t, type: "arrive", job });
        nextArr[who] = t + expo(rateOf(who, t));
      } else if (kind === "end") {
        if (current.job) {
          const { job, start, end } = current;
          done.push({ id: job.id, tenant: job.tenant, born: job.born, start, end, size: job.size, batch: job.batch });
          st.done++;
          log.push({ t, type: "finish", job });
        } else {
          idles.push({ lane: current.idle, start: current.start, end: current.end, waiting: current.waiting });
        }
        current = null;
      } else if (kind === "script") {
        const [, tenant, n] = script.shift();
        drop(t, tenant, n, true);
      } else if (kind === "bound") {
        // the arrival rate changed: Poisson arrivals are memoryless, so draw each lane's next arrival afresh
        for (let i = 0; i < N; i++) if (HIGH[i]) nextArr[i] = t + expo(rateOf(i, t));
        log.push({ t, type: t < cfg.spike.to ? "spike" : "calm", secs: cfg.spike.to - cfg.spike.from, rate: cfg.spike.rate });
      }
      startNext(t);
    }
    account(t, until);
    t = until;
    startNext(t);
  }

  // A batch job: n jobs dropped into one lane at once.
  function drop(at, tenant, n, scripted = false) {
    if (!scripted) runTo(at);
    const jobs = [];
    for (let k = 0; k < n; k++) jobs.push(arrive(tenant, at, true));
    log.push({ t: at, type: "batch", tenant, n });
    startNext(at);
    return jobs;
  }
  // A spike from A, B and C, starting now, for `secs` seconds (live).
  function spikeNow(at, secs, rate) {
    runTo(at);
    cfg.spike = { from: at, to: at + secs, rate };
    bounds.length = 0; bounds.push(at + secs);
    for (let i = 0; i < N; i++) if (HIGH[i]) nextArr[i] = at + expo(rateOf(i, at));
    log.push({ t: at, type: "spike", secs, rate });
  }

  return {
    cfg, lanes, done, idles, st, log, credit, runTo, drop, spikeNow,
    get t() { return t; },
    get current() { return current; },
  };
}

// ---------- measuring a run ----------
// Seconds the worker spent on `tenant`'s jobs between from and to (finished jobs plus the one in hand).
export function busyIn(m, tenant, from, to) {
  let s = 0;
  const add = (a, b) => { const lo = Math.max(a, from), hi = Math.min(b, to); if (hi > lo) s += hi - lo; };
  for (const j of m.done) if (j.tenant === tenant) add(j.start, j.end);
  const c = m.current;
  if (c && c.job && c.job.tenant === tenant) add(c.start, Math.min(c.end, m.t));
  return s;
}
export const waitOf = (j) => j.start - j.born;
const maxOf = (xs) => xs.reduce((a, b) => Math.max(a, b), 0);
// When the last job of a tenant's batch finished, counted from the drop.
const batchDone = (m, tenant, at) => maxOf(m.done.filter((j) => j.tenant === tenant && j.batch).map((j) => j.end)) - at;

// ---------- experiments: headless runs, averaged over seeds ----------
const SEEDS = [11, 23, 37, 41, 59, 67, 73, 89];
const avg = (fn) => averageOver(SEEDS, fn);

// 1. D's batch of 40 lands on a shared FIFO line vs per-tenant lanes served round robin.
export const BATCH = 40;
export function noisyRun() {
  const calm = avg((seed) => {
    const m = makeDesk({ sched: "fifo" }, seed); m.runTo(600);
    return { p95: rankQuantile(m.done.filter((j) => j.tenant < 3).map(waitOf), 0.95) };
  });
  const run = (sched) => avg((seed) => {
    const m = makeDesk({ sched, script: [[20, 3, BATCH]] }, seed); m.runTo(400);
    const small = m.done.filter((j) => j.tenant < 3 && j.born >= 20 && j.born < 80).map(waitOf);
    const total = m.done.filter((j) => j.born < 80);
    return { max: maxOf(small), p95: rankQuantile(small, 0.95), batch: batchDone(m, 3, 20), last: maxOf(total.map((j) => j.end)) - 20 };
  });
  return { calm, fifo: run("fifo"), rr: run("rr") };
}

// 2. Everyone drops 20 at once and D's jobs are 4× the work: round robin vs fair by work.
export function bigRun() {
  const run = (sched) => avg((seed) => {
    const m = makeDesk({ sched, sizes: [1, 1, 1, 4], script: [[5, 0, 20], [5, 1, 20], [5, 2, 20], [5, 3, 20]] }, seed); m.runTo(600);
    const abc = [0, 1, 2].map((i) => batchDone(m, i, 5));
    const until = 5 + Math.min(...abc);                    // all four lanes have work until the first of A, B, C is through
    return { share: busyIn(m, 3, 5, until) / (until - 5), abc: abc.reduce((a, b) => a + b, 0) / 3, d: batchDone(m, 3, 5) };
  });
  return { rr: run("rr"), fair: run("fair") };
}

// 3. A and D both drop 30 at once: equal weights vs A weighted 3 (fair by work).
export function weightRun() {
  const run = (weights) => avg((seed) => {
    const m = makeDesk({ sched: "fair", weights, script: [[5, 0, 30], [5, 3, 30]] }, seed); m.runTo(600);
    const a = batchDone(m, 0, 5), d = batchDone(m, 3, 5);
    return { a, d, shareA: busyIn(m, 0, 5, 5 + a) / a, shareD: busyIn(m, 3, 5, 5 + a) / a };
  });
  return { equal: run([1, 1, 1, 1]), heavy: run([3, 1, 1, 1]) };
}

// 4. D has 20 batch jobs waiting when A, B and C spike to 0.5/s each (150% of the worker) for 40 s.
export const SPIKE = { from: 20, to: 60, rate: 0.5 };
export function prioRun() {
  const run = (sched) => avg((seed) => {
    const m = makeDesk({ sched, spike: SPIKE, script: [[10, 3, 20]] }, seed); m.runTo(600);
    const high = m.done.filter((j) => j.tenant < 3 && j.born >= SPIKE.from && j.born < SPIKE.to).map(waitOf);
    return {
      dStarted: m.done.filter((j) => j.tenant === 3 && j.start >= SPIKE.from && j.start < SPIKE.to).length,
      dShare: busyIn(m, 3, SPIKE.from, SPIKE.to) / (SPIKE.to - SPIKE.from),
      dMax: maxOf(m.done.filter((j) => j.tenant === 3).map(waitOf)), hiP95: rankQuantile(high, 0.95),
    };
  });
  return { prio: run("prio"), rr: run("rr") };
}

// 5. D's batch of 40 again: round robin (work-conserving) vs fixed slots (each tenant's quarter kept for it).
export function slotRun() {
  const run = (sched) => avg((seed) => {
    const m = makeDesk({ sched, script: [[20, 3, BATCH]] }, seed); m.runTo(800);
    const end = 20 + batchDone(m, 3, 20);
    let idle = 0;
    for (const s of m.idles) if (s.waiting) { const lo = Math.max(s.start, 20), hi = Math.min(s.end, end); if (hi > lo) idle += hi - lo; }
    const small = m.done.filter((j) => j.tenant < 3 && j.born >= 20 && j.born < end).map(waitOf);
    return { batch: end - 20, idle: idle / (end - 20), p95: rankQuantile(small, 0.95) };
  });
  return { rr: run("rr"), slots: run("slots") };
}

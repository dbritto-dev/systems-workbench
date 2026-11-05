// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// A service floor with an autoscaler. Customers (requests) join one line; each worker (a pod) serves one at a time.
// A controller reads the workers' average CPU (or how busy they are) every 15 s and asks for more or fewer workers,
// the way the Kubernetes Horizontal Pod Autoscaler does: desired = ceil(current × reading / target), a 10% tolerance,
// scale-up at most double (or +4) per check, and scale-down only to the highest recommendation of the last `window`
// seconds. A new worker takes `startup` seconds before it serves anyone. A customer who waits `PATIENCE` s in the line
// gives up: an error. Time-stepped (dt = 0.05 s) and seeded, shared by the live figure and the experiments.
//
// cfg:
//   traffic   "steady" | "spike" | "wave" | "bursts" | "launch" (requests a second over time, see rateAt)
//   target    the controller's target reading, 0..1 (CPU utilization relative to the pod's CPU request)
//   window    scale-down stabilization window, seconds
//   startup   seconds from "pod created" to "ready", each pod 0.85..1.15 × that
//   minR, maxR  replica bounds; floor: [from, to, min] raises minReplicas for a time (a scheduled floor)
//   metric    "cpu" (share of time the worker computes) | "busy" (share of time it holds a request: in-flight)
//   db        false: requests are CPU work (1 s each, 0.5..1.5 s); true: 0.25 s of CPU, then a database query
//             (0.75 s at a quiet database) on a database that slows down past KNEE queries at once
//   spikeAt, spikeFor, peak, base   the spike's timing and the two rates

import { xorshift32 } from "../../lib/random";
import { averageOver, rankQuantile } from "../../lib/stats";

export const DT = 0.05;
export const SYNC = 15;            // seconds between controller checks (the HPA's default sync period)
export const READ_WINDOW = 30;     // the controller's reading is the average over the last 30 s (illustrative)
export const TOLERANCE = 0.1;      // no change while the reading is within 10% of the target
export const PATIENCE = 5;         // seconds a customer waits in line before giving up
export const MAX_R = 12;           // desks on the floor = maxReplicas
export const KNEE = 3;             // queries the database runs at full speed at once
export const ALPHA = 0.1;          // past the knee, each extra query slows every query by this much more
export const CPU_APP = 1, CPU_DB = 0.25, QUERY = 0.75;

export const DEFAULTS = {
  traffic: "spike", base: 3, peak: 7, spikeAt: 60, spikeFor: 240, period: 720,
  target: 0.6, window: 300, startup: 45, minR: 2, maxR: MAX_R, floor: null, metric: "cpu", db: false, start: null,
};

// How much slower each query runs with k at once: processor sharing past the knee, plus contention (lesson 29).
export const slowdown = (k) => (k <= KNEE ? 1 : (k / KNEE) * (1 + ALPHA * (k - KNEE)));

export function rateAt(cfg, t, extra = null) {
  let r;
  const { base, peak } = cfg;
  if (cfg.traffic === "steady") r = base;
  else if (cfg.traffic === "wave") r = (base + peak) / 2 - ((peak - base) / 2) * Math.cos((2 * Math.PI * t) / cfg.period);
  else if (cfg.traffic === "bursts") r = Math.floor(t / 120) % 2 === 0 ? 6 : 2;
  else {
    // a spike (live: once every `period` seconds) or a one-off launch
    const u = cfg.traffic === "spike" && cfg.period ? t % cfg.period : t;
    r = u >= cfg.spikeAt && u < cfg.spikeAt + cfg.spikeFor ? peak : base;
  }
  if (extra && t >= extra.from && t < extra.to) r = Math.max(r, extra.rate);
  return r;
}

export function makeFloor(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rnd = xorshift32(seed);
  const jit = () => 0.5 + rnd();
  let t = 0, nextId = 1, nextPod = 1, extra = null;
  const line = [];                         // waiting customers, oldest first: { id, born }
  const pods = [];                         // { id, slot, state: "starting" | "ready" | "draining", born, readyAt, req, cpu, busy, hist }
  const slots = Array(cfg.maxR).fill(null);
  const recs = [];                         // controller recommendations: [t, desired]
  const log = [];                          // what the live figure narrates and animates
  const st = { arrived: 0, served: 0, timedOut: 0, started: 0, stopped: 0, ups: 0, downs: 0, podSecs: 0, waits: [], lat: [], desired: 0, reading: 0, lastCheck: -1, queries: 0, slow: 1 };
  const phase = (rnd() * SYNC);            // the first check lands somewhere in the first 15 s

  const minAt = (at) => (cfg.floor && at >= cfg.floor[0] && at < cfg.floor[1] ? Math.max(cfg.minR, cfg.floor[2]) : cfg.minR);
  const live = () => pods.filter((p) => p.state !== "draining");

  function addPod(at, ready = false) {
    const slot = slots.indexOf(null);
    const p = { id: nextPod++, slot, state: ready ? "ready" : "starting", born: at, readyAt: ready ? at : at + cfg.startup * (0.85 + 0.3 * rnd()), req: null, cpu: 0, busy: 0, hist: [] };
    if (slot >= 0) slots[slot] = p; else p.slot = -1;
    pods.push(p);
    if (!ready) { st.started++; log.push({ t: at, type: "start", pod: p.id, slot: p.slot }); }
    return p;
  }
  function removePod(p, at) {
    // a pod that is still starting goes at once; a ready one finishes the customer at its desk first
    if (p.state === "starting" || !p.req) { gone(p, at); return; }
    p.state = "draining";
    log.push({ t: at, type: "drain", pod: p.id, slot: p.slot });
  }
  function gone(p, at) {
    pods.splice(pods.indexOf(p), 1);
    if (p.slot >= 0) slots[p.slot] = null;
    st.stopped++;
    log.push({ t: at, type: "stop", pod: p.id, slot: p.slot });
    // a pod waiting for a desk takes the freed one
    const waiting = pods.find((q) => q.slot < 0);
    if (waiting) { waiting.slot = slots.indexOf(null); slots[waiting.slot] = waiting; }
  }

  const start = cfg.start ?? Math.max(cfg.minR, Math.ceil(rateAt(cfg, 0) * (cfg.db ? CPU_DB : CPU_APP) / cfg.target));
  for (let i = 0; i < Math.min(start, cfg.maxR); i++) addPod(0, true);

  // ---------- the controller ----------
  function reading(p, at) {
    // average share of the last READ_WINDOW seconds (or since it became ready) spent computing / holding a request
    const since = Math.max(p.readyAt, at - READ_WINDOW);
    const span = at - since;
    if (span < 1) return null;
    const h = p.hist;
    let i = h.length - 1;
    while (i > 0 && h[i - 1][0] >= since - 1e-9) i--;
    const [t0, c0, b0] = h[i] || [at, p.cpu, p.busy];
    const dt = at - t0;
    if (dt < 1) return null;
    return (cfg.metric === "busy" ? p.busy - b0 : p.cpu - c0) / dt;
  }

  function check(at) {
    const cur = live();
    const n = cur.length;
    const readings = cur.map((p) => (p.state === "ready" ? reading(p, at) : null));
    const ready = readings.filter((r) => r !== null);
    st.lastCheck = at;
    if (!ready.length) { st.reading = 0; recs.push([at, n]); return; }
    const avg = ready.reduce((a, b) => a + b, 0) / ready.length;
    st.reading = avg;
    let ratio = avg / cfg.target;
    let desired = n;
    if (Math.abs(ratio - 1) > TOLERANCE) {
      if (ratio > 1 && ready.length < n) {
        // scaling up with pods not ready yet: count them at 0, which damps the step (as the HPA does)
        ratio = ready.reduce((a, b) => a + b, 0) / (n * cfg.target);
        desired = ratio > 1 + TOLERANCE ? Math.ceil(ratio * n) : n;
      } else desired = Math.ceil(ratio * n);
    }
    desired = Math.min(desired, Math.max(2 * n, n + 4));     // default scale-up policy: double, or +4, per 15 s
    desired = Math.max(minAt(at), Math.min(cfg.maxR, desired));
    recs.push([at, desired]);
    while (recs.length && recs[0][0] < at - Math.max(cfg.window, 0) - 1e-9) recs.shift();
    // stabilization: scale up at once; scale down only to the highest recommendation within the window
    let down = desired;
    for (const [rt, d] of recs) if (rt >= at - cfg.window - 1e-9 && d > down) down = d;
    let final = n;
    if (desired > n) final = desired;
    else if (down < n) final = down;
    if (final < minAt(at)) final = minAt(at);
    st.desired = final;
    log.push({ t: at, type: "check", reading: avg, desired: final, was: n });
    if (final > n) {
      for (let i = n; i < final; i++) addPod(at);
      st.ups++;
      log.push({ t: at, type: "up", from: n, to: final, reading: avg });
    } else if (final < n) {
      // the newest go first: pods still starting, then the most recently ready
      const order = [...cur].sort((a, b) => (a.state === "starting") - (b.state === "starting") || a.born - b.born);
      for (let i = 0; i < n - final; i++) removePod(order[order.length - 1 - i], at);
      st.downs++;
      log.push({ t: at, type: "down", from: n, to: final, reading: avg });
    }
  }

  // ---------- one step ----------
  function poisson(lam) {
    if (lam <= 0) return 0;
    const L = Math.exp(-lam);
    let k = 0, p = 1;
    for (;;) { p *= rnd(); if (p <= L) return k; k++; }
  }

  let nextSnap = 1, nextCheck = phase;
  function step() {
    const at = t + DT;
    // arrivals
    const n = poisson(rateAt(cfg, t, extra) * DT);
    for (let i = 0; i < n; i++) { line.push({ id: nextId++, born: t + rnd() * DT }); st.arrived++; }
    // the database: queries in progress slow each other down past the knee
    let k = 0;
    if (cfg.db) for (const p of pods) if (p.req && p.req.phase === "db") k++;
    const sl = slowdown(k);
    st.queries = k; st.slow = sl;
    // work
    for (const p of pods) {
      if (p.state === "starting") continue;
      const r = p.req;
      if (!r) continue;
      p.busy += DT;
      if (r.phase === "cpu") {
        p.cpu += DT; r.cpu -= DT;
        if (r.cpu <= 0) r.phase = r.q > 0 ? "db" : "done";
      } else if (r.phase === "db") {
        r.q -= DT / sl;
        if (r.q <= 0) r.phase = "done";
      }
      if (r.phase === "done") {
        st.served++; st.lat.push([r.born, at - r.born]);
        log.push({ t: at, type: "done", id: r.id, pod: p.id, slot: p.slot });
        p.req = null;
        if (p.state === "draining") gone(p, at);
      }
    }
    // pods that finished starting
    for (const p of pods) if (p.state === "starting" && p.readyAt <= at && p.slot >= 0) { p.state = "ready"; p.hist = [[at, p.cpu, p.busy]]; log.push({ t: at, type: "ready", pod: p.id, slot: p.slot }); }
    // customers who waited too long give up
    while (line.length && at - line[0].born > PATIENCE) { const c = line.shift(); st.timedOut++; log.push({ t: at, type: "timeout", id: c.id, born: c.born }); }
    // free workers take the next customer (the least recently busy first, like a least-connections balancer)
    for (const p of pods) {
      if (p.state !== "ready" || p.req || !line.length) continue;
      const c = line.shift();
      st.waits.push([c.born, at - c.born]);
      p.req = { id: c.id, born: c.born, phase: "cpu", cpu: (cfg.db ? CPU_DB : CPU_APP) * jit(), q: cfg.db ? QUERY * jit() : 0 };
      log.push({ t: at, type: "take", id: c.id, pod: p.id, slot: p.slot });
    }
    st.podSecs += pods.length * DT;
    t = at;
    if (t >= nextSnap - 1e-9) {
      for (const p of pods) if (p.state === "ready") { p.hist.push([t, p.cpu, p.busy]); if (p.hist.length > READ_WINDOW + 3) p.hist.shift(); }
      nextSnap += 1;
    }
    if (t >= nextCheck - 1e-9) { check(t); nextCheck += SYNC; }
  }

  function runTo(until) { while (t < until - 1e-9) step(); }

  return {
    cfg, line, pods, slots, log, st, runTo,
    get t() { return t; },
    get nextCheck() { return nextCheck; },
    rate: () => rateAt(cfg, t, extra),
    minAt,
    readingOf: (p) => (p.state === "ready" ? reading(p, t) : null),
    // live: a spike from now on, on top of the traffic shape
    spikeNow(secs, rate) { extra = { from: t, to: t + secs, rate }; log.push({ t, type: "spike", secs, rate }); },
    get extra() { return extra; },
  };
}

// ---------- measuring a run ----------
const within = (xs, a, b) => xs.filter(([born]) => born >= a && born < b);
export function windowStats(m, a, b) {
  const lat = within(m.st.lat, a, b).map(([, v]) => v);
  const arrived = lat.length + m.log.filter((e) => e.type === "timeout" && e.born >= a && e.born < b).length;
  const timedOut = m.log.filter((e) => e.type === "timeout" && e.born >= a && e.born < b).length;
  return { arrived, timedOut, share: arrived ? timedOut / arrived : 0, p95: rankQuantile(lat, 0.95) };
}
// Seconds from `a` until the first 30 s stretch with no customer giving up.
export function recovery(m, a, b) {
  const outs = m.log.filter((e) => e.type === "timeout" && e.t >= a && e.t < b).map((e) => e.t);
  if (!outs.length) return 0;
  let last = a;
  for (const x of outs) { if (x - last >= 30 && last > a) break; last = x; }
  return last - a;
}

// ---------- experiments: headless runs averaged over seeds ----------
export const SEEDS = [11, 23, 37, 41, 59, 67, 73, 89, 97, 101, 113, 127];
const avg = (fn) => averageOver(SEEDS, fn);
export const SPIKE = { at: 300, for: 300, base: 3, peak: 7 };
const spikeCfg = (o) => ({ traffic: "launch", base: SPIKE.base, peak: SPIKE.peak, spikeAt: SPIKE.at, spikeFor: SPIKE.for, ...o });

function spikeRun(o) {
  return avg((seed) => {
    const m = makeFloor(spikeCfg(o), seed);
    let peakPods = 0, readyAt60 = 0, before = 0;
    for (let s = 1; s <= SPIKE.at + SPIKE.for + 60; s++) {
      m.runTo(s);
      if (s === SPIKE.at) before = m.pods.length;
      if (s === SPIKE.at + 60) readyAt60 = m.pods.filter((p) => p.state === "ready").length;
      peakPods = Math.max(peakPods, m.pods.length);
    }
    const w = windowStats(m, SPIKE.at, SPIKE.at + SPIKE.for);
    return { errors: w.timedOut, arrived: w.arrived, share: w.share, p95: w.p95, recover: recovery(m, SPIKE.at, SPIKE.at + SPIKE.for), readyAt60, peakPods, before, podMin: m.st.podSecs / 60 };
  });
}

// 1. A spike from 3 to 7 a second: workers ready in 10 s vs in 120 s.
export function startupRun() {
  return { fast: spikeRun({ startup: 10 }), slow: spikeRun({ startup: 120 }) };
}

// 2. The same spike, startup 45 s: target 60% vs 90%.
export function targetRun() {
  return { t60: spikeRun({ startup: 45, target: 0.6 }), t90: spikeRun({ startup: 45, target: 0.9 }) };
}

// 3. Traffic that swings every 2 minutes (6/s, then 2/s) for 30 minutes: scale-down window 0 s vs 300 s.
export const BURSTS = { secs: 1800 };
export function flapRun() {
  const run = (window) => avg((seed) => {
    const m = makeFloor({ traffic: "bursts", startup: 45, window, start: 10 }, seed);
    m.runTo(BURSTS.secs);
    const w = windowStats(m, 240, BURSTS.secs);
    return { started: m.st.started, ups: m.st.ups, downs: m.st.downs, errors: w.timedOut, arrived: w.arrived, share: w.share, podMin: m.st.podSecs / 60 };
  });
  return { w0: run(0), w300: run(300) };
}

// 4. The same spike at a known time (a launch), startup 120 s: minReplicas 2 all along vs a floor of 8 from 3 minutes
// before the launch until 5 minutes after it ends.
export const FLOOR = { from: SPIKE.at - 180, to: SPIKE.at + SPIKE.for + 300, min: 8, startup: 120 };
export function floorRun() {
  const run = (floor) => avg((seed) => {
    const m = makeFloor(spikeCfg({ startup: FLOOR.startup, floor }), seed);
    m.runTo(FLOOR.to + 300);
    const w = windowStats(m, SPIKE.at, SPIKE.at + SPIKE.for);
    return { errors: w.timedOut, arrived: w.arrived, share: w.share, p95: w.p95, podMin: m.st.podSecs / 60 };
  });
  return { none: run(null), floor: run([FLOOR.from, FLOOR.to, FLOOR.min]) };
}

// 5. The database is the bottleneck: the same spike (3 → 5 a second), scale on CPU vs on busy workers; min 4.
export const DBRUN = { peak: 5, minR: 4, startup: 45 };
export function dbRun() {
  const run = (metric) => avg((seed) => {
    const m = makeFloor(spikeCfg({ db: true, peak: DBRUN.peak, minR: DBRUN.minR, startup: DBRUN.startup, metric }), seed);
    let pods = 0, slow = 0, n = 0, served = 0;
    for (let s = 1; s <= SPIKE.at + SPIKE.for; s++) {
      const before = m.st.served;
      m.runTo(s);
      if (s > SPIKE.at + 120) { pods += m.pods.length; slow += m.st.slow; served += m.st.served - before; n++; }
    }
    const w = windowStats(m, SPIKE.at, SPIKE.at + SPIKE.for);
    return { errors: w.timedOut, arrived: w.arrived, share: w.share, p95: w.p95, pods: pods / n, slow: slow / n, tput: served / n, podMin: m.st.podSecs / 60 };
  });
  return { cpu: run("cpu"), busy: run("busy") };
}

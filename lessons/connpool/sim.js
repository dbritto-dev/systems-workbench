// Shared model for the figure and the experiments: app instances borrowing database connections. Times in seconds.
// One request = one transaction: get a connection, (maybe call an external API), run its queries, give the connection back.
export const DB = {
  unit: 0.010,        // a typical request's queries take 10 ms on an otherwise quiet database
  knee: 8,            // up to 2 × 4 cores of queries run at full speed (they also wait on disk)
  alpha: 0.02,        // past the knee, every extra active query slows everyone (locks, context switches, cache)
  maxConn: 60,        // max_connections
};
export const CONNECT = 0.030;       // TCP + TLS + auth before a new connection can be used
export const CONNECT_WORK = 0.25;   // and the database spends 2.5 ms starting a backend for it
export const POOLER_CONNECT = 0.002;
export const POOLER_SERVERS = 20;   // server connections a shared pooler (PgBouncer) keeps to the database
export const ACQUIRE_TIMEOUT = 1.0; // a request gives up after waiting this long for a connection
export const API = 0.200;           // an external API call
export const RETRY = 1.0;           // a pool that was refused tries again after this long
export const MAX_POOL = 20;
export const MAX_INSTANCES = 4;

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// Throughput of the database (in request-units per second) with k queries active at once.
export function capacity(k) {
  if (k <= 0) return 0;
  const full = DB.knee / DB.unit;
  return k <= DB.knee ? k / DB.unit : full / (1 + DB.alpha * (k - DB.knee));
}
// How much slower each query runs than on a quiet database.
export const slowdown = (k) => (k <= DB.knee ? 1 : (k / DB.knee) * (1 + DB.alpha * (k - DB.knee)));

// cfg: { instances, pool (0 = a new connection per request), rate (requests/s per instance),
//        api: "none" | "before" | "inside", leak (0 or 1 in N), pooler (bool), stagger (s between instance starts) }
export function makeSim(cfg, seed = 7) {
  const random = rng(seed);
  const sim = {
    cfg, now: 0,
    instances: [], conns: [], dbOpen: 0, active: 0,
    pooler: { busy: 0, queue: [] },
    served: 0, timeouts: 0, refused: 0, arrived: 0,
    done: [],           // [t, latency, wait] for served requests
    fails: [],          // [t, inst, kind]
    refusals: [],       // [t, inst] connection attempts the database turned away
  };
  let nextId = 1, seq = 0;
  const heap = [];
  const push = (t, fn) => { heap.push([t, seq++, fn]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (less(heap[i], heap[p])) { [heap[i], heap[p]] = [heap[p], heap[i]]; i = p; } else break; } };
  const less = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && less(heap[l], heap[m])) m = l; if (r < heap.length && less(heap[r], heap[m])) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };

  // The database: processor sharing between active jobs, slower past the knee.
  const jobs = [];
  const dbJob = (work, done) => { jobs.push({ rem: work, done }); sim.active = jobs.length; };
  function advanceDb(dt) {
    if (!jobs.length || dt <= 0) return;
    const r = capacity(jobs.length) / jobs.length;
    for (const j of jobs) j.rem -= r * dt;
  }
  function nextDbDone() {
    if (!jobs.length) return Infinity;
    const r = capacity(jobs.length) / jobs.length;
    let m = Infinity; for (const j of jobs) m = Math.min(m, j.rem);
    return sim.now + Math.max(0, m) / r;
  }
  function finishDbJobs() {
    const doneNow = [];
    for (let i = jobs.length - 1; i >= 0; i--) if (jobs[i].rem <= 1e-9) { doneNow.push(jobs[i]); jobs.splice(i, 1); }
    sim.active = jobs.length;
    doneNow.reverse().forEach((j) => j.done());
  }

  const exp = (rate) => -Math.log(1 - random()) / rate;
  const queryWork = () => 0.5 + random();

  // ---- instances and their pools ----
  function addInstance(t) {
    const i = sim.instances.length;
    const inst = { i, on: true, startAt: t, waiters: [], backoff: -1, served: 0, failed: 0, slots: Array(MAX_POOL).fill(null) };
    sim.instances.push(inst);
    push(t, () => { if (!inst.on) return; if (cfg.pool > 0) fill(inst); push(sim.now + exp(cfg.rate), () => arrive(inst)); });
    return inst;
  }
  const ownConns = (inst) => sim.conns.filter((c) => c.inst === inst.i && c.state !== "closed");
  function freeSlot(inst) { const s = inst.slots.indexOf(null); return s; }

  function newConn(inst, req = null) {
    const slot = freeSlot(inst);
    const c = { id: nextId++, inst: inst.i, slot, state: "connecting", since: sim.now, req, server: false, permit: false };
    if (slot >= 0) inst.slots[slot] = c.id;
    sim.conns.push(c);
    if (cfg.pooler) push(sim.now + POOLER_CONNECT, () => connected(c));
    else push(sim.now + CONNECT, () => {
      if (c.state === "closed") return;
      if (sim.dbOpen >= DB.maxConn) { refuse(c); return; }
      sim.dbOpen++; c.permit = true;
      dbJob(CONNECT_WORK, () => connected(c));
    });
    return c;
  }
  function refuse(c) {
    const inst = sim.instances[c.inst];
    sim.refusals.push([sim.now, c.inst]);
    close(c);
    if (c.req) fail(c.req, "refused");
    else if (inst.on) { inst.backoff = sim.now + RETRY; push(inst.backoff, () => fill(inst)); }
  }
  function close(c) {
    if (c.state === "closed") return;
    if (c.permit) { sim.dbOpen--; c.permit = false; }
    c.state = "closed"; c.since = sim.now;
    const inst = sim.instances[c.inst];
    if (c.slot >= 0 && inst.slots[c.slot] === c.id) inst.slots[c.slot] = null;
  }
  function connected(c) {
    if (c.state === "closed") return;
    const inst = sim.instances[c.inst];
    if (!inst.on) { close(c); return; }
    if (c.req) { startTx(c, c.req); return; }   // a connection opened for one request (no pool)
    c.state = "idle"; c.since = sim.now;
    dispatch(inst);
  }
  // A fixed-size pool: it opens connections until it holds `pool` of them (leaked ones still count).
  function fill(inst) {
    if (!inst.on || cfg.pool <= 0 || sim.now < inst.backoff - 1e-9) return;
    let have = ownConns(inst).length;
    while (have < cfg.pool) { newConn(inst); have++; }
  }

  // ---- requests ----
  function arrive(inst) {
    if (!inst.on) return;
    push(sim.now + exp(cfg.rate), () => arrive(inst));
    sim.arrived++;
    const req = { t0: sim.now, inst: inst.i, waitFrom: sim.now, state: "new" };
    if (cfg.api === "before") { req.state = "api"; push(sim.now + API, () => want(req)); }
    else want(req);
  }
  function want(req) {
    const inst = sim.instances[req.inst];
    if (!inst.on) return;
    req.waitFrom = sim.now;
    if (cfg.pool <= 0) { req.state = "connecting"; newConn(inst, req); return; }
    req.state = "waiting";
    inst.waiters.push(req);
    push(sim.now + ACQUIRE_TIMEOUT, () => { if (req.state === "waiting") { inst.waiters.splice(inst.waiters.indexOf(req), 1); fail(req, "timeout"); } });
    dispatch(inst);
  }
  function dispatch(inst) {
    while (inst.waiters.length) {
      const c = sim.conns.find((x) => x.inst === inst.i && x.state === "idle");
      if (!c) { fill(inst); return; }
      const req = inst.waiters.shift();
      startTx(c, req);
    }
  }
  function startTx(c, req) {
    req.state = "tx"; req.wait = sim.now - req.waitFrom;
    c.req = req; c.since = sim.now;
    if (cfg.pooler) { c.state = "gate"; sim.pooler.queue.push(c); poolerDispatch(); return; }
    work(c);
  }
  function poolerDispatch() {
    while (sim.pooler.queue.length && sim.pooler.busy < POOLER_SERVERS) {
      const c = sim.pooler.queue.shift();
      if (c.state !== "gate") continue;
      sim.pooler.busy++; c.server = true;
      work(c);
    }
  }
  function work(c) {
    if (cfg.api === "inside") { c.state = "api"; c.since = sim.now; push(sim.now + API, () => query(c)); }
    else query(c);
  }
  function query(c) {
    if (c.state === "closed") return;
    c.state = "query"; c.since = sim.now;
    dbJob(queryWork(), () => finish(c));
  }
  function finish(c) {
    const req = c.req, inst = sim.instances[c.inst];
    sim.served++; inst.served++;
    sim.done.push([sim.now, sim.now - req.t0, req.wait || 0]);
    req.state = "done"; c.req = null;
    if (c.server) { c.server = false; sim.pooler.busy--; poolerDispatch(); }
    if (c.state === "closed") return;
    if (cfg.pool <= 0) { close(c); return; }
    if (cfg.leak > 0 && random() < 1 / cfg.leak) { c.state = "leaked"; c.since = sim.now; dispatch(inst); return; }
    c.state = "idle"; c.since = sim.now;
    dispatch(inst);
  }
  function fail(req, kind) {
    req.state = "failed";
    if (kind === "timeout") sim.timeouts++; else sim.refused++;
    sim.instances[req.inst].failed++;
    sim.fails.push([sim.now, req.inst, kind]);
  }

  // ---- scaling ----
  sim.scaleTo = (n, t = sim.now) => {
    const on = sim.instances.filter((x) => x.on).length;
    if (n > on) {
      // reuse switched-off slots first, so hotels keep their places
      let k = 0;
      for (const inst of sim.instances) if (!inst.on && on + k < n) { inst.on = true; inst.backoff = -1; inst.waiters = []; inst.slots.fill(null); const at = t + k * (cfg.stagger || 0); k++; push(at, () => { if (!inst.on) return; if (cfg.pool > 0) fill(inst); push(sim.now + exp(cfg.rate), () => arrive(inst)); }); }
      while (on + k < n) { addInstance(t + k * (cfg.stagger || 0)); k++; }
    } else if (n < on) {
      sim.instances.filter((x) => x.on).slice(n).forEach((inst) => {
        inst.on = false; inst.waiters.forEach((r) => { r.state = "gone"; }); inst.waiters = [];
        sim.conns.filter((c) => c.inst === inst.i).forEach((c) => { if (c.server) { c.server = false; sim.pooler.busy--; } close(c); });
        sim.pooler.queue = sim.pooler.queue.filter((c) => c.inst !== inst.i);
      });
      poolerDispatch();
    }
  };
  // With a pooler, it holds its server connections from the start.
  if (cfg.pooler) sim.dbOpen = POOLER_SERVERS;
  for (let i = 0; i < cfg.instances; i++) addInstance(i * (cfg.stagger || 0));

  sim.runTo = (t) => {
    for (;;) {
      const te = heap.length ? heap[0][0] : Infinity;
      const td = nextDbDone();
      const next = Math.min(te, td);
      if (next > t) { advanceDb(t - sim.now); sim.now = t; break; }
      advanceDb(next - sim.now); sim.now = next;
      if (td <= te) { for (const j of jobs) if (j.rem < 1e-7) j.rem = 0; finishDbJobs(); }
      else pop()[2]();
    }
    // keep the event lists short in long live runs
    if (!cfg.live) return;
    if (sim.done.length > 4000) sim.done.splice(0, sim.done.length - 2000);
    if (sim.fails.length > 4000) sim.fails.splice(0, sim.fails.length - 2000);
    if (sim.refusals.length > 400) sim.refusals.splice(0, sim.refusals.length - 200);
    if (sim.conns.length > 600) sim.conns = sim.conns.filter((c) => c.state !== "closed" || sim.now - c.since < 2);
  };
  sim.waiting = () => sim.instances.reduce((s, x) => s + (x.on ? x.waiters.length : 0), 0);
  sim.leaked = () => sim.conns.filter((c) => c.state === "leaked").length;
  return sim;
}

// ---------- experiments: the same model, headless, averaged over seeds ----------
const pctile = (xs, p) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// Run one configuration; measure from `from` to `to` (seconds).
export function measure(cfg, { from = 2, to = 12, seed = 1, until } = {}) {
  const sim = makeSim(cfg, seed);
  if (until) until(sim);
  let busySum = 0, openSum = 0, samples = 0, peakActive = 0;
  for (let t = from; t <= to + 1e-9; t += 0.05) {
    sim.runTo(t);
    if (t > from) { busySum += sim.active; openSum += sim.dbOpen; samples++; peakActive = Math.max(peakActive, sim.active); }
  }
  const done = sim.done.filter((d) => d[0] >= from && d[0] <= to);
  const fails = sim.fails.filter((f) => f[0] >= from && f[0] <= to);
  const lat = done.map((d) => d[1]);
  return {
    served: done.length / (to - from),
    failed: fails.length / (to - from),
    failShare: fails.length / Math.max(1, done.length + fails.length),
    p50: pctile(lat, 0.5), p95: pctile(lat, 0.95),
    wait: mean(done.map((d) => d[2])),
    active: busySum / Math.max(1, samples), open: openSum / Math.max(1, samples), peakActive,
    sim,
  };
}
export function averaged(cfg, opts = {}, seeds = 6) {
  const runs = Array.from({ length: seeds }, (_, s) => measure(cfg, { ...opts, seed: 11 + s * 7 }));
  const keys = ["served", "failed", "failShare", "p50", "p95", "wait", "active", "open", "peakActive"];
  const out = Object.fromEntries(keys.map((k) => [k, mean(runs.map((r) => r[k]))]));
  out.runs = runs;
  return out;
}

export function noPoolVsPool() {
  const base = { instances: 2, rate: 60, api: "none", leak: 0, pooler: false };
  return { none: averaged({ ...base, pool: 0 }), pooled: averaged({ ...base, pool: 10 }) };
}
export function poolSizes() {
  const base = { instances: 2, rate: 500, api: "none", leak: 0, pooler: false };
  return [5, 10, 20].map((pool) => ({ pool, ...averaged({ ...base, pool }, { from: 3, to: 13 }) }));
}
export function leakRun() {
  const cfg = { instances: 2, pool: 10, rate: 60, api: "none", leak: 500, pooler: false };
  const runs = [11, 18, 25, 32, 39, 46].map((seed) => {
    const sim = makeSim(cfg, seed);
    let stoppedAt = -1;
    for (let t = 1; t <= 300; t += 1) {
      sim.runTo(t);
      if (stoppedAt < 0 && sim.instances.every((x) => sim.conns.filter((c) => c.inst === x.i && c.state === "leaked").length >= cfg.pool)) stoppedAt = t;
    }
    const firstMinute = sim.fails.filter((f) => f[0] <= 60).length;
    return { stoppedAt: stoppedAt < 0 ? 300 : stoppedAt, failShare: sim.timeouts / Math.max(1, sim.arrived), firstMinute, leaked: sim.leaked(), active: sim.active };
  });
  return { stoppedAt: mean(runs.map((r) => r.stoppedAt)), failShare: mean(runs.map((r) => r.failShare)), firstMinute: mean(runs.map((r) => r.firstMinute)), leaked: mean(runs.map((r) => r.leaked)) };
}
export function apiInside() {
  const base = { instances: 2, pool: 10, rate: 60, leak: 0, pooler: false };
  return { before: averaged({ ...base, api: "before" }, { from: 3, to: 15 }), inside: averaged({ ...base, api: "inside" }, { from: 3, to: 15 }) };
}
export function scaleOut() {
  const base = { pool: 20, rate: 60, api: "none", leak: 0, stagger: 0.5 };
  const scaled = (pooler) => averaged({ ...base, instances: 2, pooler }, { from: 6, to: 16, until: (sim) => { sim.runTo(2); sim.scaleTo(4); } });
  const direct = scaled(false), pooled = scaled(true);
  const lastShare = (r) => mean(r.runs.map((x) => { const inst = x.sim.instances[3]; return inst.failed / Math.max(1, inst.served + inst.failed); }));
  return { direct, pooled, lastDirect: lastShare(direct), lastPooled: lastShare(pooled) };
}

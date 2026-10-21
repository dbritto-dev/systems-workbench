// Shared model for the figure and the experiments: a pool of workers calling a supplier,
// optionally through a timeout, retries and a circuit breaker. Times are in seconds of figure time.
export const STEP = 0.05;
export const BASE = {
  workers: 6, queue: 4, rate: 3, supplierShare: 0.7, localTime: 0.4,
  healthyTime: 0.6, sickTime: 6, cap: 15, recoverHold: 2, fastTime: 0.05,
  cause: "healthy", timeout: 0, breaker: false, threshold: 5, cooldown: 5, retries: 0, backoff: false,
};
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const freshCounts = () => ({ arrived: 0, localArrived: 0, served: 0, servedLocal: 0, servedSupplier: 0, failedFast: 0, failedSlow: 0, dropped: 0, localDropped: 0, attempts: 0, loadArea: 0, time: 0, latencies: [], supplierLatencies: [] });

export function createSim(options = {}, seed = 1) {
  const cfg = { ...BASE, ...options };
  const random = rng(seed);
  const s = {
    t: 0, cfg, queue: [], calls: [], events: [],
    workers: Array.from({ length: cfg.workers }, () => ({ req: null, phase: "idle", until: 0, call: null, deadline: Infinity, callStart: 0, probe: false })),
    breaker: { state: "closed", failures: 0, openUntil: 0, openedAt: 0, probe: false, opens: 0 },
    supplier: { recovering: false, calmSince: null },
    counts: freshCounts(), watchFrom: null, recoveredAt: null,
  };
  const b = s.breaker;
  const sick = () => cfg.cause !== "healthy" || s.supplier.recovering;
  const emit = (kind, worker) => { s.events.push({ kind, worker, t: s.t }); if (s.events.length > 200) s.events.shift(); };

  function open() { b.state = "open"; b.openedAt = s.t; b.openUntil = s.t + cfg.cooldown; b.failures = 0; b.probe = false; b.opens++; emit("open"); }
  function result(w, ok) {
    if (!cfg.breaker) return;
    if (b.state === "half" && w.probe) { w.probe = false; b.probe = false; if (ok) { b.state = "closed"; b.failures = 0; emit("close"); } else open(); return; }
    if (b.state === "closed") { if (ok) b.failures = 0; else if (++b.failures >= cfg.threshold) open(); }
  }
  function begin(w, req) { w.req = req; w.phase = "local"; w.until = s.t + cfg.localTime * (0.8 + 0.4 * random()); }
  function finish(w, kind) {
    const c = s.counts, req = w.req, latency = s.t - req.arrived;
    if (kind === "ok") { c.served++; if (req.needs) c.servedSupplier++; else c.servedLocal++; }
    else if (kind === "fast") c.failedFast++;
    else c.failedSlow++;
    c.latencies.push(latency); if (req.needs) c.supplierLatencies.push(latency);
    emit(kind, s.workers.indexOf(w));
    w.req = null; w.phase = "idle"; w.call = null; w.probe = false; w.deadline = Infinity;
  }
  function fastFail(w) { w.phase = "fast"; w.until = s.t + cfg.fastTime; w.call = null; }
  function attempt(w) {
    if (cfg.breaker) {
      if (b.state === "open") { if (s.t >= b.openUntil) { b.state = "half"; b.probe = false; emit("half"); } else return fastFail(w); }
      if (b.state === "half") { if (b.probe) return fastFail(w); b.probe = true; w.probe = true; }
    }
    w.req.attempts++; s.counts.attempts++;
    const ill = sick();
    const call = { start: s.t, endAt: s.t + (ill ? cfg.sickTime : cfg.healthyTime) * (0.85 + 0.3 * random()), ok: !ill || cfg.cause === "slow" };
    s.calls.push(call);
    w.call = call; w.phase = "call"; w.callStart = s.t; w.deadline = cfg.timeout ? s.t + cfg.timeout : Infinity;
  }
  function retryOr(w, kind) {
    w.call = null;
    if (w.req.attempts <= cfg.retries) {
      if (cfg.backoff) { w.phase = "backoff"; w.until = s.t + 0.5 * 2 ** (w.req.attempts - 1) * (0.5 + random()); }
      else attempt(w);
    } else finish(w, kind);
  }
  function advance(w) {
    if (w.phase === "local" && s.t >= w.until) return w.req.needs ? attempt(w) : finish(w, "ok");
    if (w.phase === "fast" && s.t >= w.until) return finish(w, "fast");
    if (w.phase === "backoff" && s.t >= w.until) return attempt(w);
    if (w.phase === "call") {
      const c = w.call;
      if (c.endAt <= s.t) {
        result(w, c.ok);
        if (c.ok) { if (s.watchFrom !== null && s.recoveredAt === null) s.recoveredAt = s.t; return finish(w, "ok"); }
        return retryOr(w, "error");
      }
      if (s.t >= w.deadline) { c.abandoned = true; result(w, false); return retryOr(w, "timeout"); }
    }
  }

  function step(dt = STEP) {
    s.t += dt;
    s.calls = s.calls.filter((c) => c.endAt > s.t);
    const load = s.calls.length;
    const sup = s.supplier;
    if (cfg.cause !== "healthy") { sup.recovering = true; sup.calmSince = null; }
    else {
      if (!sup.recovering && load > cfg.cap) sup.recovering = true;
      if (sup.recovering) {
        if (load <= cfg.cap) { if (sup.calmSince === null) sup.calmSince = s.t; if (s.t - sup.calmSince >= cfg.recoverHold) { sup.recovering = false; sup.calmSince = null; } }
        else sup.calmSince = null;
      }
    }
    if (random() < cfg.rate * dt) {
      const req = { arrived: s.t, needs: random() < cfg.supplierShare, attempts: 0 };
      s.counts.arrived++; if (!req.needs) s.counts.localArrived++;
      const free = s.workers.find((w) => !w.req);
      if (free) begin(free, req);
      else if (s.queue.length < cfg.queue) s.queue.push(req);
      else { s.counts.dropped++; if (!req.needs) s.counts.localDropped++; emit("drop"); }
    }
    for (const w of s.workers) if (w.req) advance(w);
    for (const w of s.workers) if (!w.req && s.queue.length) begin(w, s.queue.shift());
    s.counts.loadArea += s.calls.length * dt; s.counts.time += dt;
  }

  function set(key, value) {
    cfg[key] = value;
    if (key === "breaker" && !value) Object.assign(b, { state: "closed", failures: 0, probe: false });
    if (key === "cause" && value === "healthy" && s.watchFrom === null) { s.watchFrom = s.t; s.recoveredAt = null; }
    if (key === "cause" && value !== "healthy") { s.watchFrom = null; s.recoveredAt = null; }
  }
  return { s, cfg, step, set, sick, load: () => s.calls.length, resetCounts: () => { s.counts = freshCounts(); } };
}

export function pct(list, q) { if (!list.length) return 0; const a = [...list].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; }
export const p95 = (list) => pct(list, 0.95);

// One scripted run. events: [{ at, cause }]. Counts are measured from `from` to `seconds`.
export function runScenario({ options = {}, seconds = 60, from = 10, events = [], seed = 1 }) {
  const sim = createSim(options, seed);
  const pending = [...events].sort((a, b) => a.at - b.at);
  let fixAt = null;
  while (sim.s.t < seconds) {
    while (pending.length && pending[0].at <= sim.s.t) { const e = pending.shift(); sim.set("cause", e.cause); if (e.cause === "healthy") fixAt = sim.s.t; }
    if (Math.abs(sim.s.t - from) < STEP / 2) sim.resetCounts();
    sim.step(STEP);
  }
  const c = sim.s.counts;
  return {
    served: c.served / Math.max(1, c.arrived), localServed: Math.min(1, c.servedLocal / Math.max(1, c.localArrived)),
    dropped: c.dropped / Math.max(1, c.arrived), failedFast: c.failedFast / Math.max(1, c.arrived), failedSlow: c.failedSlow / Math.max(1, c.arrived),
    p95: p95(c.latencies), p95Supplier: p95(c.supplierLatencies), p50Supplier: pct(c.supplierLatencies, 0.5), load: c.loadArea / Math.max(STEP, c.time),
    recovery: fixAt === null ? null : sim.s.recoveredAt === null ? Infinity : sim.s.recoveredAt - fixAt,
    opens: sim.s.breaker.opens,
  };
}
export function averageScenario(spec, seeds = [3, 5, 7, 11, 13, 17, 19, 23]) {
  const runs = seeds.map((seed) => runScenario({ ...spec, seed }));
  const mean = (k) => runs.reduce((a, r) => a + r[k], 0) / runs.length;
  const finite = runs.map((r) => r.recovery).filter((x) => x !== null && Number.isFinite(x));
  return {
    served: mean("served"), localServed: mean("localServed"), dropped: mean("dropped"), failedFast: mean("failedFast"), failedSlow: mean("failedSlow"),
    p95: mean("p95"), p95Supplier: mean("p95Supplier"), p50Supplier: mean("p50Supplier"), load: mean("load"), opens: mean("opens"),
    recovery: finite.length ? finite.reduce((a, x) => a + x, 0) / finite.length : null, recovered: finite.length, runs: runs.length,
  };
}

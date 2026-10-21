// Rolling deploy model shared by the live figure and the headless experiments.
// Times are in seconds of figure time. Geometry along the row (x) lives here too,
// so the crane in the figure moves exactly as the model says.
export const RD = {
  SLOTS: 8,          // 6 bays in normal use + 2 spare positions for surge
  R: 6,              // desired replicas
  CRANE: 2.4,        // one crane job: fetch + install, or pull + discard
  WARM: 6,           // seconds a new module needs before it can serve
  SERVICE: 2.0,      // mean service time per request (exponential)
  QUEUE_MAX: 10,     // a bay with this many waiting turns new requests away
  USERS: 20,         // distinct users, for the data-format experiment
  LOAD: { normal: 1.4, high: 2.0 }, // requests per second (6 bays serve 3.0/s)
  BIN_X: -125,
  SUPPLY_X: -97,
  slotX: (i) => -60 + 28 * i,
};

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export function createSim({ seed = 1, load = "high", unavail = 1, surge = 0, probe = true, keep = Infinity } = {}) {
  const random = rng(seed);
  const exp = (mean) => -mean * Math.log(1 - random());
  const S = {
    t: 0,
    cfg: { load, unavail, surge, probe },
    target: 1,                  // latest version asked for
    quality: { 1: "good" },
    formatOf: { 1: 1 },         // data format each version writes and reads
    userFormat: new Array(RD.USERS).fill(1),
    bays: Array.from({ length: RD.SLOTS }, (_, i) => ({
      i, module: i < RD.R ? { version: 1, bad: false, format: 1, installedAt: -100, warmAt: -100 } : null,
      reserved: false, terminating: false, queue: [], busy: null, busyUntil: Infinity,
    })),
    crane: { x: RD.SUPPLY_X, job: null },
    rollout: null,
    lastRollout: null,
    nextArrival: 0,
    nextId: 1,
    records: [],                // { t0, latency } or { t0, error }
    events: [],                 // for the figure: route / fail / start / done / job
    peakBays: RD.R,
  };
  S.nextArrival = exp(1 / RD.LOAD[load]);

  const effUnavail = () => (S.cfg.unavail === 0 && S.cfg.surge === 0 ? 1 : S.cfg.unavail);
  const isNew = (b) => b.reserved || (b.module && b.module.version === S.target);
  const healthy = (b) => !!b.module && !b.terminating && S.t >= b.module.warmAt && !b.module.bad;
  const ready = (b) => !!b.module && !b.terminating && (S.cfg.probe ? healthy(b) : true);
  const emit = (e) => { S.events.push(e); };
  const record = (r) => { S.records.push(r); if (S.records.length > keep) S.records.splice(0, S.records.length - keep); };

  function startService(b) {
    if (b.busy || !b.queue.length) return;
    b.busy = b.queue.shift();
    b.busyUntil = S.t + exp(RD.SERVICE);
    emit({ type: "start", id: b.busy.id, bay: b.i });
  }

  function route(req) {
    const candidates = S.bays.filter(ready);
    if (!candidates.length) { record({ t0: req.t0, error: "none" }); emit({ type: "fail", id: req.id, bay: null, why: "none" }); return; }
    let best = null, bestLoad = Infinity;
    for (const b of candidates) {
      const l = b.queue.length + (b.busy ? 1 : 0) + random() * 0.5;
      if (l < bestLoad) { bestLoad = l; best = b; }
    }
    let why = null;
    if (!healthy(best)) why = best.module.bad && S.t >= best.module.warmAt ? "broken" : "starting";
    else if (best.module.format < S.userFormat[req.user]) why = "format";
    else if (best.queue.length >= RD.QUEUE_MAX) why = "full";
    if (why) { record({ t0: req.t0, error: why }); emit({ type: "fail", id: req.id, bay: best.i, why }); return; }
    S.userFormat[req.user] = Math.max(S.userFormat[req.user], best.module.format);
    best.queue.push(req);
    emit({ type: "route", id: req.id, bay: best.i });
    startService(best);
  }

  function arrive() {
    const req = { id: S.nextId++, t0: S.t, user: Math.floor(random() * RD.USERS) };
    route(req);
    S.nextArrival = S.t + exp(1 / RD.LOAD[S.cfg.load]);
  }

  function finishService(b) {
    const req = b.busy;
    b.busy = null; b.busyUntil = Infinity;
    record({ t0: req.t0, latency: S.t - req.t0 });
    emit({ type: "done", id: req.id, bay: b.i });
    startService(b);
  }

  function startJob(type, b) {
    S.crane.job = { type, bay: b.i, t0: S.t, dur: RD.CRANE, fromX: S.crane.x, version: type === "install" ? S.target : b.module.version };
    if (type === "install") b.reserved = true;
    else {
      b.terminating = true;
      const moved = [...(b.busy ? [b.busy] : []), ...b.queue];
      b.busy = null; b.busyUntil = Infinity; b.queue = [];
      moved.forEach((req) => route(req)); // the distributor resends what the bay was holding
    }
    emit({ type: "job", job: S.crane.job });
    const live = S.bays.filter((x) => x.module || x.reserved).length;
    S.peakBays = Math.max(S.peakBays, live);
  }

  function finishJob() {
    const job = S.crane.job, b = S.bays[job.bay];
    if (job.type === "install") {
      b.reserved = false;
      b.module = { version: job.version, bad: S.quality[job.version] === "bad", format: S.formatOf[job.version], installedAt: S.t, warmAt: S.t + RD.WARM };
      S.crane.x = RD.slotX(b.i);
    } else {
      b.module = null; b.terminating = false;
      S.crane.x = RD.BIN_X;
    }
    S.crane.job = null;
  }

  function control() {
    if (!S.rollout || S.rollout.end !== null || S.crane.job) return;
    const live = S.bays.filter((b) => (b.module || b.reserved) && !b.terminating);
    const newAll = live.filter(isNew).length;
    const old = live.filter((b) => !isNew(b));
    const avail = S.bays.filter(ready).length;
    if (!old.length && newAll >= RD.R && live.filter(isNew).every((b) => ready(b))) { S.rollout.end = S.t; S.lastRollout = S.rollout; return; }
    if (newAll < RD.R && live.length < RD.R + S.cfg.surge) {
      const slot = S.bays.find((b) => !b.module && !b.reserved && !b.terminating);
      if (slot) { startJob("install", slot); return; }
    }
    if (old.length) {
      const victim = old.find(ready) || old[0];
      if (avail - (ready(victim) ? 1 : 0) >= RD.R - effUnavail()) startJob("remove", victim);
    }
  }

  function nextEventTime() {
    let next = S.nextArrival;
    for (const b of S.bays) {
      if (b.busyUntil < next) next = b.busyUntil;
      if (b.module && b.module.warmAt > S.t && b.module.warmAt < next) next = b.module.warmAt;
    }
    if (S.crane.job) next = Math.min(next, S.crane.job.t0 + S.crane.job.dur);
    return next;
  }

  function step(dt) {
    const end = S.t + dt;
    for (let guard = 0; guard < 10000; guard++) {
      const next = nextEventTime();
      if (next > end) break;
      S.t = next;
      if (S.crane.job && S.crane.job.t0 + S.crane.job.dur <= S.t) finishJob();
      for (const b of S.bays) if (b.busyUntil <= S.t) finishService(b);
      if (S.nextArrival <= S.t) arrive();
      control();
    }
    S.t = end;
    control();
  }

  function startRollout(quality = "good") {
    if (S.rollout && S.rollout.end === null) return false;
    const prev = S.target;
    S.target = prev + 1;
    S.quality[S.target] = quality;
    S.formatOf[S.target] = quality === "incompatible" ? S.formatOf[prev] + 1 : S.formatOf[prev];
    S.rollout = { version: S.target, quality, start: S.t, end: null };
    control();
    return true;
  }

  return { S, step, startRollout, healthy, ready, isNew, effUnavail };
}

export function measure(records, from, to) {
  const inWindow = records.filter((r) => r.t0 >= from && r.t0 < to);
  const ok = inWindow.filter((r) => r.latency !== undefined).map((r) => r.latency).sort((a, b) => a - b);
  const errors = inWindow.filter((r) => r.error);
  const p95 = ok.length ? ok[Math.min(ok.length - 1, Math.floor(0.95 * ok.length))] : 0;
  const why = {};
  errors.forEach((e) => { why[e.error] = (why[e.error] || 0) + 1; });
  return { requests: inWindow.length, served: ok.length, errors: errors.length, errorRate: inWindow.length ? errors.length / inWindow.length : 0, p95, why };
}

// One rollout from a warmed-up steady state; numbers are for requests arriving during the window.
export function runRollout({ seed = 1, load = "high", unavail = 1, surge = 0, probe = true, quality = "good", warm = 40, window = 110, deploy = true, full = false } = {}) {
  const sim = createSim({ seed, load, unavail, surge, probe });
  for (let t = 0; t < warm; t += 0.5) sim.step(0.5);
  if (deploy) sim.startRollout(quality);
  const T0 = sim.S.t;
  for (let t = 0; t < window; t += 0.5) sim.step(0.5);
  const r = sim.S.rollout;
  // Measure while the rollout runs, plus one warm-up after it (bays may still be starting),
  // or the whole window if it never finishes or `full` is asked for.
  const until = !full && r && r.end !== null ? Math.min(T0 + window, r.end + RD.WARM) : T0 + window;
  const m = measure(sim.S.records, T0, until);
  const newBays = sim.S.bays.filter((b) => b.module && b.module.version === sim.S.target).length;
  const readyNew = sim.S.bays.filter((b) => b.module && b.module.version === sim.S.target && sim.ready(b)).length;
  const oldServing = sim.S.bays.filter((b) => b.module && b.module.version !== sim.S.target && sim.ready(b)).length;
  return { ...m, rolloutTime: r && r.end !== null ? r.end - r.start : null, newBays, readyNew, oldServing, peakBays: sim.S.peakBays };
}

export function averageRollout(options, seeds = [3, 5, 7, 11, 13, 17, 19, 23]) {
  const runs = seeds.map((seed) => runRollout({ ...options, seed }));
  const mean = (f) => runs.reduce((s, r) => s + f(r), 0) / runs.length;
  const done = runs.filter((r) => r.rolloutTime !== null);
  return {
    runs,
    p95: mean((r) => r.p95),
    errorRate: mean((r) => r.errorRate),
    errors: mean((r) => r.errors),
    requests: mean((r) => r.requests),
    rolloutTime: done.length === runs.length ? mean((r) => r.rolloutTime) : null,
    finished: done.length,
    newBays: mean((r) => r.newBays),
    readyNew: mean((r) => r.readyNew),
    oldServing: mean((r) => r.oldServing),
    peakBays: Math.max(...runs.map((r) => r.peakBays)),
    why: runs.reduce((acc, r) => { for (const k in r.why) acc[k] = (acc[k] || 0) + r.why[k] / runs.length; return acc; }, {}),
  };
}

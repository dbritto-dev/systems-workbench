// One cook, several pans. Each dish alternates active steps (stirring: the cook must be there)
// and waits (simmering: the pan needs nobody). The figure and the experiments both run this model.
export const DT = 0.01;
export const STEPS = 3;

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// A dish of `active` seconds of cook time, split into STEPS stirring steps with simmers between them.
// waitShare is the share of the dish's own time spent simmering.
export function makeDish(active, waitShare, steps = STEPS) {
  const a = active / steps;
  const w = steps > 1 && waitShare > 0 ? (waitShare * active) / ((1 - waitShare) * (steps - 1)) : 0;
  const phases = [];
  for (let i = 0; i < steps; i++) {
    const last = phases[phases.length - 1];
    if (last && last.kind === "active") last.t += a;
    else phases.push({ kind: "active", t: a });
    if (i < steps - 1 && w > 0) phases.push({ kind: "wait", t: w });
  }
  return { active, phases };
}

// options: pans, waitShare, active, policy ("seq" | "wait" | "rr"), slice, switchCost, stockpot,
// mode ("continuous" refills a pan when its dish is done, "batch" leaves it empty), dishes (batch: [{active, waitShare}]), seed.
export function createKitchen(o) {
  const opt = { pans: 4, waitShare: 0.6, active: 3, policy: "wait", slice: 1, switchCost: 0.3, stockpot: false, mode: "continuous", seed: 1, ...o };
  const K = { opt, now: 0, random: rng(opt.seed), pans: [], cook: { at: null, mode: "idle", target: null, from: null, left: 0, sliceUsed: 0, job: null, jobServed: -1 }, done: [], time: { cooking: 0, switching: 0, idle: 0 }, switches: 0 };
  const count = opt.mode === "batch" ? opt.dishes.length : opt.pans;
  for (let i = 0; i < count; i++) K.pans.push(freshPan(K, i, 0));
  return K;
}

function recipe(K, index) {
  const o = K.opt;
  if (o.mode === "batch") return o.dishes[index];
  if (o.stockpot && index === 0) return { active: o.active * 4, waitShare: o.waitShare };
  const spread = 0.8 + 0.4 * K.random();
  return { active: o.active * spread, waitShare: o.waitShare };
}

function freshPan(K, index, now) {
  const r = recipe(K, index);
  const dish = makeDish(r.active, r.waitShare);
  return { index, dish, phase: 0, left: dish.phases[0].t, readyAt: now, started: now, state: "active", served: 0 };
}

const kindOf = (pan) => (pan.state === "done" ? "done" : pan.dish.phases[pan.phase].kind);
export const isReady = (K, pan) => kindOf(pan) === "active" && !(K.cook.mode === "work" && K.cook.at === pan.index);

function nextPhase(K, pan) {
  pan.phase++;
  if (pan.phase >= pan.dish.phases.length) {
    K.done.push({ pan: pan.index, start: pan.started, end: K.now, active: pan.dish.active });
    if (K.opt.mode === "continuous") {
      const served = pan.served + 1;
      Object.assign(pan, freshPan(K, pan.index, K.now), { served });
    } else {
      pan.state = "done";
    }
    return;
  }
  pan.left = pan.dish.phases[pan.phase].t;
  if (pan.dish.phases[pan.phase].kind === "active") pan.readyAt = K.now;
}

function moveTo(K, index) {
  const c = K.cook;
  c.sliceUsed = 0;
  if (c.at === index) { c.mode = "work"; return; }
  K.switches++;
  if (K.opt.switchCost <= 0) { c.from = c.at; c.at = index; c.mode = "work"; return; }
  c.mode = "switch"; c.target = index; c.left = K.opt.switchCost;
}

function pickReady(K, exclude = null) {
  let best = null;
  for (const pan of K.pans) {
    if (pan.index === exclude || !isReady(K, pan)) continue;
    if (!best || pan.readyAt < best.readyAt || (pan.readyAt === best.readyAt && pan.index < best.index)) best = pan;
  }
  return best;
}

function decide(K) {
  const c = K.cook;
  const policy = K.opt.policy;
  if (policy === "seq") {
    let job = c.job != null ? K.pans[c.job] : null;
    if (!job || job.state === "done" || job.served !== c.jobServed) {
      const open = K.pans.filter((p) => p.state !== "done");
      if (!open.length) { c.mode = "idle"; c.job = null; return; }
      job = open.reduce((a, b) => (b.started < a.started || (b.started === a.started && b.index < a.index) ? b : a));
      c.job = job.index; c.jobServed = job.served;
    }
    if (c.at !== job.index) { moveTo(K, job.index); return; }
    c.mode = kindOf(job) === "active" ? "work" : "hold";
    return;
  }
  const here = c.at !== null ? K.pans[c.at] : null;
  if (c.mode === "work" && here && kindOf(here) === "active") {
    if (policy === "rr" && c.sliceUsed >= K.opt.slice - 1e-9) {
      const other = pickReady(K, c.at);
      if (other) { here.readyAt = K.now; moveTo(K, other.index); }
      else c.sliceUsed = 0;
    }
    return;
  }
  const next = pickReady(K, null);
  if (!next) { c.mode = "idle"; return; }
  moveTo(K, next.index);
}

export function step(K, dt = DT) {
  const c = K.cook;
  for (const pan of K.pans) {
    if (pan.state === "done" || kindOf(pan) !== "wait") continue;
    pan.left -= dt;
    if (pan.left <= 1e-9) nextPhase(K, pan);
  }
  if (c.mode === "switch") {
    K.time.switching += dt;
    c.left -= dt;
    if (c.left <= 1e-9) { c.from = c.at; c.at = c.target; c.target = null; c.mode = "work"; c.sliceUsed = 0; }
  } else if (c.mode === "work" && kindOf(K.pans[c.at]) === "active") {
    const pan = K.pans[c.at];
    K.time.cooking += dt;
    pan.left -= dt;
    c.sliceUsed += dt;
    if (pan.left <= 1e-9) {
      const before = pan.served;
      nextPhase(K, pan);
      if (pan.served !== before || pan.state === "done" || kindOf(pan) !== "active") c.mode = "idle";
    }
  } else {
    K.time.idle += dt;
  }
  K.now += dt;
  if (c.mode !== "switch") decide(K);
}

export function stats(K) {
  const total = K.time.cooking + K.time.switching + K.time.idle || 1;
  const times = K.done.map((d) => d.end - d.start);
  return {
    done: K.done.length,
    perMinute: K.now > 0 ? (60 * K.done.length) / K.now : 0,
    avgTime: times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0,
    cooking: K.time.cooking / total,
    switching: K.time.switching / total,
    idle: K.time.idle / total,
  };
}

// Batch: run until every dish is served. Returns total time, each dish's finish time and the cook's time split.
export function runBatch(options, limit = 600) {
  const K = createKitchen({ ...options, mode: "batch" });
  while (K.pans.some((p) => p.state !== "done") && K.now < limit) step(K);
  const finish = K.pans.map((p) => (K.done.find((d) => d.pan === p.index) || { end: Infinity }).end);
  return { total: K.now, finish, ...stats(K) };
}

// Continuous: keep every pan busy for `seconds`, averaged over seeds.
export function runSteady(options, seconds = 600, seeds = [1, 2, 3, 4]) {
  const runs = seeds.map((seed) => {
    const K = createKitchen({ ...options, mode: "continuous", seed });
    while (K.now < seconds) step(K);
    return stats(K);
  });
  const mean = (f) => runs.reduce((s, r) => s + f(r), 0) / runs.length;
  return { perMinute: mean((r) => r.perMinute), avgTime: mean((r) => r.avgTime), cooking: mean((r) => r.cooking), switching: mean((r) => r.switching), idle: mean((r) => r.idle) };
}

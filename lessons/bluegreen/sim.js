// Blue-green deploy model, shared by the live figure and the headless experiments.
// Times are in seconds of figure time. Requests enter on the infeed, are routed at the gate to
// whichever side is live at that moment, ride a lane to that side's queue, and are served by one
// of its workers. Each side has its own cache (a hit share that grows with every miss).
export const BASE = {
  rate: 5,          // requests per second
  workers: 3,       // workers per side
  hitTime: 0.3,     // service time on a cache hit
  missTime: 1.2,    // service time on a miss
  failTime: 0.15,   // a request that hits a broken schema fails fast
  infeed: 0.8,      // seconds on the infeed belt before the gate
  lane: 0.5,        // seconds on the lane from gate to queue
  queueCap: 10,     // a full queue turns new requests away
  warmFill: 0.85,   // hit share of a warm cache
  learn: 0.05,      // each miss closes this share of the gap to a full cache
  badError: 0.4,    // share of requests a bad release fails
  detect: 15,       // seconds from a bad flip until the alarm makes someone roll back
  redeploy: 60,     // seconds to redeploy one server in a rolling rollback
};

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function makeSide(name, version, fill, workers) {
  return { name, version, fill, queue: [], workers: Array.from({ length: workers }, () => ({ job: null, version })), busyTime: 0 };
}

export function createWorld(options = {}) {
  const o = { ...BASE, release: "good", warm: true, draining: true, migration: "compatible", seed: 7, ...options };
  const random = rng(o.seed);
  const w = {
    o, random, t: 0, id: 0, live: "blue", schema: 1,
    sides: { blue: makeSide("blue", "v1", o.warmFill, o.workers), green: makeSide("green", "v2", o.warm ? o.warmFill : 0, o.workers) },
    active: [], log: [], flips: [],
    stats: { ok: 0, error: 0, dropped: 0, turned: 0 },
  };
  w.nextArrival = -Math.log(1 - random()) / o.rate;
  return w;
}

// Re-deploy the idle green side with the current settings (new code, cache warm or cold).
export function prepareGreen(w) {
  const g = w.sides.green;
  if (w.live === "green") return false;
  g.fill = w.o.warm ? w.o.warmFill : 0;
  g.version = "v2";
  g.workers.forEach((k) => { k.version = "v2"; });
  return true;
}

function finish(w, job, outcome) {
  job.stage = "done"; job.outcome = outcome; job.doneAt = w.t;
  w.stats[outcome]++;
  w.log.push(job);
}

// Send all new traffic to the other side. Without draining, everything already routed to the old
// side (on its lane, in its queue, being served) is cut off.
export function flip(w) {
  const old = w.live;
  w.live = old === "blue" ? "green" : "blue";
  if (w.live === "green" && w.schema === 1) w.schema = 2; // green's migration runs as it goes live
  w.flips.push({ at: w.t, to: w.live });
  if (!w.o.draining) {
    const side = w.sides[old];
    for (const job of w.active) if (job.side === old && job.stage !== "infeed") finish(w, job, "dropped");
    side.queue = [];
    side.workers.forEach((k) => { k.job = null; });
    w.active = w.active.filter((job) => job.stage !== "done");
  }
  return w.live;
}

function startJob(w, side, worker, job) {
  const o = w.o;
  const hit = w.random() < side.fill;
  if (!hit) side.fill += (1 - side.fill) * o.learn;
  const v = worker.version;
  const schemaBroken = v === "v1" && w.schema === 2 && o.migration === "breaking";
  const badCode = v === "v2" && o.release === "bad" && w.random() < o.badError;
  job.stage = "service"; job.worker = side.workers.indexOf(worker); job.hit = hit; job.version = v;
  job.fails = schemaBroken || badCode;
  job.startAt = w.t;
  job.endAt = w.t + (schemaBroken ? o.failTime : hit ? o.hitTime : o.missTime);
  worker.job = job;
}

export function step(w, dt) {
  const o = w.o;
  w.t += dt;
  while (w.nextArrival <= w.t) {
    const born = w.nextArrival;
    w.active.push({ id: ++w.id, born, gateAt: born + o.infeed, queueAt: born + o.infeed + o.lane, stage: "infeed", side: null });
    w.nextArrival += -Math.log(1 - w.random()) / o.rate;
  }
  for (const job of w.active) {
    if (job.stage === "infeed" && w.t >= job.gateAt) { job.side = w.live; job.stage = "lane"; }
    if (job.stage === "lane" && w.t >= job.queueAt) {
      const side = w.sides[job.side];
      if (side.queue.length >= o.queueCap) finish(w, job, "turned");
      else { job.stage = "queue"; side.queue.push(job); }
    }
  }
  for (const name of ["blue", "green"]) {
    const side = w.sides[name];
    for (const worker of side.workers) {
      if (worker.job && w.t >= worker.job.endAt) { finish(w, worker.job, worker.job.fails ? "error" : "ok"); worker.job = null; }
      if (!worker.job && side.queue.length) startJob(w, side, worker, side.queue.shift());
      if (worker.job) side.busyTime += dt;
    }
  }
  w.active = w.active.filter((job) => job.stage !== "done");
}

// A scripted deploy for the experiments: flip to green at flipAt; if rollback is set, roll back
// o.detect seconds later either by flipping the gate ("flip") or by redeploying green's servers
// to the old version one at a time ("rolling").
export function runScenario({ until = 120, flipAt = 30, rollback = null, dt = 0.02, onStep, ...options } = {}) {
  const w = createWorld(options);
  let flipped = false, rolledAt = null, reverted = 0;
  while (w.t < until) {
    step(w, dt);
    if (!flipped && w.t >= flipAt) { flip(w); flipped = true; }
    if (rollback && flipped && rolledAt === null && w.t >= flipAt + w.o.detect) {
      rolledAt = w.t;
      if (rollback === "flip") flip(w);
    }
    if (rollback === "rolling" && rolledAt !== null) {
      while (reverted < w.o.workers && w.t >= rolledAt + w.o.redeploy * (reverted + 1)) {
        w.sides.green.workers[reverted].version = "v1"; reverted++;
      }
    }
    if (onStep) onStep(w);
  }
  w.rolledAt = rolledAt;
  return w;
}

export const p95 = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(0.95 * sorted.length))];
};
const SEEDS = [3, 5, 7, 11, 13, 17];
export const mean = (list) => list.reduce((s, x) => s + x, 0) / list.length;
export const overSeeds = (f) => mean(SEEDS.map(f));

// Experiment measurements, each averaged over the seeds.
export const EXP = {
  rollback() {
    const recovery = (mode, until) => overSeeds((seed) => {
      const w = runScenario({ seed, release: "bad", rollback: mode, until });
      const errs = w.log.filter((j) => j.outcome !== "ok" && j.born >= 30);
      return errs.length ? Math.max(...errs.map((j) => j.doneAt)) - 30 : 0;
    });
    const errors = (mode, until) => overSeeds((seed) => runScenario({ seed, release: "bad", rollback: mode, until }).log.filter((j) => j.outcome !== "ok").length);
    return { flip: recovery("flip", 120), rolling: recovery("rolling", 300), flipErrors: errors("flip", 120), rollingErrors: errors("rolling", 300) };
  },
  cost() {
    const busy = overSeeds((seed) => {
      let blue0 = 0, green0 = 0;
      const w = runScenario({ seed, until: 150, onStep: (x) => { if (Math.abs(x.t - 40) < 0.011) { blue0 = x.sides.blue.busyTime; green0 = x.sides.green.busyTime; } } });
      w.idle = (w.sides.blue.busyTime - blue0) / (110 * w.o.workers);
      w.livePart = (w.sides.green.busyTime - green0) / (110 * w.o.workers);
      return w.idle;
    });
    const live = overSeeds((seed) => {
      let green0 = 0;
      const w = runScenario({ seed, until: 150, onStep: (x) => { if (Math.abs(x.t - 40) < 0.011) green0 = x.sides.green.busyTime; } });
      return (w.sides.green.busyTime - green0) / (110 * w.o.workers);
    });
    return { idleBusy: busy, liveBusy: live, blueGreenServers: 2 * BASE.workers, rollingServers: BASE.workers + 1, normal: BASE.workers };
  },
  cold() {
    const measure = (warm) => {
      const p = overSeeds((seed) => p95(runScenario({ seed, warm, until: 90 }).log.filter((j) => j.outcome === "ok" && j.born >= 30 && j.born < 60).map((j) => j.doneAt - j.born)));
      const before = overSeeds((seed) => p95(runScenario({ seed, warm, until: 90 }).log.filter((j) => j.outcome === "ok" && j.born >= 5 && j.born < 30).map((j) => j.doneAt - j.born)));
      const turned = overSeeds((seed) => runScenario({ seed, warm, until: 90 }).log.filter((j) => j.outcome === "turned").length);
      return { p95: p, before, turned };
    };
    return { warm: measure(true), cold: measure(false) };
  },
  drain() {
    const dropped = (draining) => overSeeds((seed) => runScenario({ seed, draining, until: 60 }).log.filter((j) => j.outcome === "dropped").length);
    return { off: dropped(false), on: dropped(true) };
  },
  migration() {
    const share = (migration) => overSeeds((seed) => {
      const w = runScenario({ seed, release: "bad", rollback: "flip", migration, until: 90 });
      const after = w.log.filter((j) => j.born >= 50 && j.born < 80);
      return after.filter((j) => j.outcome !== "ok").length / Math.max(1, after.length);
    });
    return { compatible: share("compatible"), breaking: share("breaking") };
  },
};

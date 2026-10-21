// Shared model for the figure and the experiments: a cache in front of a slow store, and what happens
// when hot entries expire. Times in seconds. Event-driven and seeded, so every run can be repeated.
//
// Keys are trays in the display case. A request for a key is a hit while the key is fresh. A miss sends
// an order to the oven (the database): the oven has a fixed number of shelves (connections); orders
// beyond that wait on the rack, first come first served. Bake time is the recompute time.
//
// mode: "all"    every miss sends its own order (duplicates pile up while the first one bakes)
//       "single" one order per key; other misses wait for it (request coalescing / single-flight)
//       "stale"  serve the expired loaf at once and refresh it with one background order (stale-while-revalidate)
// jitter: 0 for equal expiry; 0.2 for ±20 % on every TTL.
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export const LIVE = { weights: [0.36, 0.2, 0.15, 0.12, 0.1, 0.07], shelves: 4 };

// cfg: { weights, rate, ttl, bake, shelves, mode, jitter }
export function makeSim(cfg, seed = 7) {
  const random = rng(seed);
  const K = cfg.weights.length;
  const total = cfg.weights.reduce((a, b) => a + b, 0);
  const cum = []; cfg.weights.reduce((a, w, i) => (cum[i] = a + w / total), 0);
  const pick = () => { const r = random(); for (let i = 0; i < K; i++) if (r < cum[i]) return i; return K - 1; };
  const ttlOf = () => cfg.ttl * (cfg.jitter ? 1 - cfg.jitter + 2 * cfg.jitter * random() : 1);
  const bakeOf = () => cfg.bake * (0.9 + 0.2 * random());

  const sim = {
    cfg, now: 0,
    // Every key starts cached at t = 0, as after a deploy that warmed the cache in one go.
    keys: Array.from({ length: K }, () => ({ has: true, exp: ttlOf(), jobs: 0, waiters: [], bakedAt: 0 })),
    oven: [],      // { key, dup, begin, end, owner }
    rack: [],      // { key, dup, queued, owner }
    stats: { requests: 0, hits: 0, stale: 0, waited: 0, orders: 0, dups: 0, waitSum: 0, maxWait: 0, peakLoad: 0, expiries: 0 },
    perSecond: [],  // orders sent in each whole second
    waits: [],      // every wait (misses only), for percentiles
    log: [],        // recent { t, kind, key } for the figure
  };
  let nextArrival = -Math.log(1 - random()) / cfg.rate;
  const waiting = new Set();   // requests currently waiting: { t0, key }

  const load = () => sim.oven.length + sim.rack.length;
  function order(key, t, owner) {
    const k = sim.keys[key];
    const job = { key, dup: k.jobs > 0, owner };
    k.jobs++;
    sim.stats.orders++; if (job.dup) sim.stats.dups++;
    const s = Math.floor(t); sim.perSecond[s] = (sim.perSecond[s] || 0) + 1;
    if (sim.oven.length < cfg.shelves) { job.begin = t; job.end = t + bakeOf(); sim.oven.push(job); }
    else { job.queued = t; sim.rack.push(job); }
    sim.stats.peakLoad = Math.max(sim.stats.peakLoad, load());
    return job;
  }
  function release(req, t) {
    const w = t - req.t0;
    sim.stats.waited++; sim.stats.waitSum += w; sim.stats.maxWait = Math.max(sim.stats.maxWait, w);
    sim.waits.push(w);
    waiting.delete(req);
  }
  function arrive(t) {
    const key = pick(), k = sim.keys[key];
    sim.stats.requests++;
    if (k.has && t < k.exp) { sim.stats.hits++; return; }
    if (k.has && t >= k.exp && !k.counted) { k.counted = true; sim.stats.expiries++; }
    if (cfg.mode === "stale" && k.has) {
      sim.stats.stale++;
      if (k.jobs === 0) order(key, t, null);
      return;
    }
    const req = { t0: t, key };
    waiting.add(req);
    if (cfg.mode === "all") { order(key, t, req); return; }
    k.waiters.push(req);
    if (k.jobs === 0) order(key, t, null);
  }
  function finish(job, t) {
    sim.oven.splice(sim.oven.indexOf(job), 1);
    const k = sim.keys[job.key];
    k.jobs--; k.has = true; k.exp = t + ttlOf(); k.bakedAt = t; k.counted = false;
    if (job.owner) release(job.owner, t);
    if (cfg.mode !== "all") { for (const r of k.waiters) release(r, t); k.waiters = []; }
    const next = sim.rack.shift();
    if (next) { next.begin = t; next.end = t + bakeOf(); sim.oven.push(next); }
  }

  sim.runTo = (T) => {
    for (;;) {
      let job = null;
      for (const j of sim.oven) if (!job || j.end < job.end) job = j;
      const tJob = job ? job.end : Infinity;
      const t = Math.min(nextArrival, tJob);
      if (t > T) break;
      if (t === tJob) finish(job, t);
      else { arrive(t); nextArrival = t - Math.log(1 - random()) / cfg.rate; }
    }
    sim.now = T;
  };
  sim.waiting = () => [...waiting];
  sim.load = load;
  sim.expireAll = (t) => { for (const k of sim.keys) if (k.has) k.exp = Math.min(k.exp, t); };
  return sim;
}

// ---------- experiments (headless, same model) ----------
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pctile = (xs, p) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const SEEDS = [3, 7, 11, 19, 23, 31];
function over(cfg, until, measure) {
  return SEEDS.map((seed) => { const s = makeSim(cfg, seed); s.runTo(until); return measure(s); });
}
const mean = (rows, key) => avg(rows.map((r) => r[key]));
function summary(rows) { const out = {}; for (const key of Object.keys(rows[0])) out[key] = mean(rows, key); return out; }

// A deploy fills 50 keys at once with a 30 s TTL; 500 requests a second spread evenly; 8 shelves, 0.2 s bake.
const DEPLOY = { weights: Array(50).fill(1), rate: 500, ttl: 30, bake: 0.2, shelves: 8, mode: "all", jitter: 0 };
export function deployRun(jitter) {
  return summary(over({ ...DEPLOY, jitter }, 70, (s) => ({
    peak: Math.max(...s.perSecond.filter(Boolean)),
    orders: s.stats.orders,
    dups: s.stats.dups,
    maxWait: s.stats.maxWait,
    p99: pctile(s.waits.concat(Array(s.stats.hits).fill(0)), 0.99),
    capacity: DEPLOY.shelves / DEPLOY.bake,
  })));
}

// One hot key at 500 requests a second, 10 s TTL, 8 shelves.
const HOT = { weights: [1], rate: 500, ttl: 10, bake: 0.2, shelves: 8, mode: "all", jitter: 0 };
export function hotRun(mode, bake = HOT.bake, rate = HOT.rate) {
  return summary(over({ ...HOT, mode, bake, rate }, 61, (s) => {
    const cycles = Math.max(1, s.stats.expiries);
    return {
      perExpiry: s.stats.orders / cycles,
      waitedPerExpiry: s.stats.waited / cycles,
      stalePerExpiry: s.stats.stale / cycles,
      maxWait: s.stats.maxWait,
      meanWait: s.stats.waited ? s.stats.waitSum / s.stats.waited : 0,
      peakLoad: s.stats.peakLoad,
    };
  }));
}

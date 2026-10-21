// Feature flags: one model for the figure and the experiments. Time is in seconds.
export const USERS = 200;          // user ids 0..199
export const STAFF = 10;           // ids 0..9 are internal staff
export const SERVERS = 4;
export const RATE = 8;             // requests per second, spread over servers round-robin
export const BUG_RATE = 0.25;      // share of new-version requests that fail when the feature is buggy
export const ROLLBACK = { pipeline: 90, perServer: 30 }; // redeploying the old build: pipeline, then one server at a time

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// Stable 0..99 bucket for a user and a flag (salt), like hashing "flag:user" in a real flag SDK.
export function bucket(user, salt) {
  let h = (user + 1) * 2654435761 ^ (salt + 7) * 40503;
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) % 100;
}

// cfg: { on, pct, sticky, staffFirst, ttl, buggy, flags }
export function makeSim(cfg, seed = 1) {
  const random = rng(seed);
  const flag = { on: cfg.on !== false, pct: cfg.pct ?? 50, sticky: cfg.sticky !== false, staffFirst: !!cfg.staffFirst };
  const ttl = cfg.ttl ?? 5;
  const servers = Array.from({ length: SERVERS }, (_, i) => {
    const offset = random() * ttl;
    return { i, cache: { ...flag }, fetchedAt: offset - ttl, nextFetch: offset, codeHasFeature: true, rolledBackAt: Infinity };
  });
  return {
    t: 0, ttl, buggy: !!cfg.buggy, flags: cfg.flags ?? 1, flag, servers, random,
    nextArrival: -Math.log(1 - random()) / RATE, rr: 0,
    seen: new Map(),        // user -> bit 1 old, bit 2 new
    combos: new Set(),
    stats: { requests: 0, newCount: 0, errors: 0, customerErrors: 0, staffErrors: 0, afterOff: 0, firstError: null, offAt: null, lastNewAfterOff: null },
    log: [],                // recent requests for the figure: { t, user, server, isNew, error, stale }
    keepLog: !!cfg.keepLog,
    onRequest: null, onFetch: null,
  };
}

export function setFlag(sim, patch) {
  const wasOn = sim.flag.on;
  Object.assign(sim.flag, patch);
  if (wasOn && !sim.flag.on) sim.stats.offAt = sim.t;
  if (!wasOn && sim.flag.on) sim.stats.offAt = null;
}

export function rollback(sim) {
  sim.servers.forEach((s, i) => { s.rolledBackAt = sim.t + ROLLBACK.pipeline + ROLLBACK.perServer * (i + 1); });
}

export function decide(flag, user) {
  if (!flag.on) return false;
  if (flag.staffFirst) return user < STAFF;
  return null;
}

function evaluate(sim, server, user) {
  if (!server.codeHasFeature) return false;
  const f = server.cache;
  const forced = decide(f, user);
  if (forced !== null) return forced;
  const roll = f.sticky ? bucket(user, 0) : Math.floor(sim.random() * 100);
  return roll < f.pct;
}

export function step(sim, dt) {
  const end = sim.t + dt;
  for (;;) {
    let next = sim.nextArrival, kind = "req";
    for (const s of sim.servers) if (s.nextFetch < next) { next = s.nextFetch; kind = s; }
    for (const s of sim.servers) if (s.rolledBackAt < next && s.codeHasFeature) { next = s.rolledBackAt; kind = { rollback: s }; }
    if (next > end) break;
    sim.t = next;
    if (kind === "req") request(sim);
    else if (kind.rollback) kind.rollback.codeHasFeature = false;
    else { kind.cache = { ...sim.flag }; kind.fetchedAt = sim.t; kind.nextFetch = sim.t + sim.ttl; sim.onFetch && sim.onFetch(kind); }
  }
  sim.t = end;
}

function request(sim) {
  const user = Math.floor(sim.random() * USERS);
  const server = sim.servers[sim.rr++ % SERVERS];
  const isNew = evaluate(sim, server, user);
  const error = isNew && sim.buggy && sim.random() < BUG_RATE;
  const stale = isNew && !sim.flag.on;
  const st = sim.stats;
  st.requests++;
  if (isNew) st.newCount++;
  if (error) { st.errors++; if (user < STAFF) st.staffErrors++; else st.customerErrors++; if (st.firstError === null) st.firstError = sim.t; }
  if (stale) { st.afterOff++; st.lastNewAfterOff = sim.t; }
  sim.seen.set(user, (sim.seen.get(user) || 0) | (isNew ? 2 : 1));
  let combo = isNew ? 1 : 0;
  for (let f = 1; f < sim.flags; f++) if (bucket(user, f * 31) < 50) combo |= 1 << f;
  sim.combos.add(combo);
  const r = { t: sim.t, user, server: server.i, isNew, error, stale };
  if (sim.keepLog) sim.log.push(r);
  sim.onRequest && sim.onRequest(r);
  sim.nextArrival = sim.t - Math.log(1 - sim.random()) / RATE;
}

export const flippers = (sim) => { let n = 0; for (const v of sim.seen.values()) if (v === 3) n++; return n; };
export const repeatUsers = (sim) => sim.seen.size;

// ---------- headless experiments ----------
const SEEDS = [3, 5, 7, 11, 13, 17, 19, 23];
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// 1. A buggy feature at 50%: at t = 30 someone notices. Kill switch vs redeploying the old build.
export function killVsRollback() {
  const run = (how) => SEEDS.map((seed) => {
    const s = makeSim({ pct: 50, sticky: true, ttl: 5, buggy: true }, seed);
    step(s, 30);
    const before = s.stats.errors;
    if (how === "kill") setFlag(s, { on: false }); else rollback(s);
    let stopped = null;
    s.onRequest = (r) => { if (r.isNew) stopped = r.t; };
    step(s, 300);
    return { errors: s.stats.errors - before, stopAfter: (stopped ?? 30) - 30 };
  });
  const k = run("kill"), r = run("rollback");
  return { kill: { errors: mean(k.map((x) => x.errors)), stop: Math.max(...k.map((x) => x.stopAfter)) },
           rollback: { errors: mean(r.map((x) => x.errors)), stop: Math.max(...r.map((x) => x.stopAfter)) } };
}

// 2. 30% rollout for 2 minutes: users who saw both versions.
export function stickiness() {
  const run = (sticky) => SEEDS.map((seed) => { const s = makeSim({ pct: 30, sticky, ttl: 5 }, seed); step(s, 120); return { flip: flippers(s), users: repeatUsers(s) }; });
  const a = run(false), b = run(true);
  return { random: mean(a.map((x) => x.flip)), sticky: mean(b.map((x) => x.flip)), users: mean(a.map((x) => x.users)) };
}

// 3. Flip off at t = 30: how long servers keep serving the new version, per cache refresh interval.
export function staleness(ttl) {
  const runs = SEEDS.map((seed) => {
    const s = makeSim({ pct: 100, sticky: true, ttl }, seed);
    step(s, 30);
    setFlag(s, { on: false });
    step(s, ttl + 10);
    return { last: (s.stats.lastNewAfterOff ?? 30) - 30, served: s.stats.afterOff };
  });
  return { worst: Math.max(...runs.map((r) => r.last)), avg: mean(runs.map((r) => r.last)), served: mean(runs.map((r) => r.served)) };
}

// 4. Flag debt: distinct combinations of flags that real users hit in 2 minutes.
export function combos(flags) {
  const runs = SEEDS.map((seed) => { const s = makeSim({ pct: 50, sticky: true, ttl: 5, flags }, seed); step(s, 120); return { live: s.combos.size, users: s.seen.size }; });
  return { live: mean(runs.map((r) => r.live)), possible: 2 ** flags, users: mean(runs.map((r) => r.users)) };
}

// 5. A buggy feature for 60 s: staff first vs 10% of everyone. Who meets the bug?
export function targeting() {
  const run = (staffFirst) => SEEDS.map((seed) => { const s = makeSim({ pct: 10, sticky: true, ttl: 5, buggy: true, staffFirst }, seed); step(s, 60); return s.stats; });
  const a = run(true), b = run(false);
  const firstOf = (xs) => mean(xs.map((x) => x.firstError ?? 60));
  return { staff: { customers: mean(a.map((x) => x.customerErrors)), staff: mean(a.map((x) => x.staffErrors)), first: firstOf(a) },
           everyone: { customers: mean(b.map((x) => x.customerErrors)), staff: mean(b.map((x) => x.staffErrors)), first: firstOf(b) } };
}

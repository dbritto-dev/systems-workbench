// @ts-nocheck: model code ported as-is; shared helpers come from src/lib.
import { rng, exponential } from "../../lib/random";
import { averageOver, rankQuantile } from "../../lib/stats";

// Shared model for the figure and the experiments: a sorting station with a dispatcher in front of
// up to five counters. Times are in seconds of figure time.
export const SERVICE = 3;          // mean seconds a normal counter spends on an average parcel
export const TRANSFER = 0.6;       // seconds from the dispatcher to the counter's lane
export const SLOW = 3;             // a slow counter takes this many times longer
export const MAX = 5;
export const USERS = 20;
const expo = exponential;

// opts: { servers, algorithm: "rr"|"lc"|"random", rate, slow (index or -1), check (s), sticky, sizes: "even"|"uneven", heavy (bool) }
export function createStation(opts, seed = 1) {
  const random = rng(seed);
  const st = {
    o: { servers: 4, algorithm: "rr", rate: 0.9, slow: -1, check: 10, sticky: false, sizes: "even", heavy: false, ...opts },
    now: 0, nextArrival: 0, nextCheck: 0, pointer: 0, id: 0,
    servers: Array.from({ length: MAX }, (_, i) => ({ index: i, alive: true, healthy: true, queue: [], current: null, busy: 0, served: 0 })),
    jobs: [], done: [], errors: 0, failed: [], events: [],
  };
  st.nextArrival = expo(random, 1 / st.o.rate);
  st.nextCheck = st.o.check;
  const present = (s) => s.index < st.o.servers;
  const outstanding = (s) => st.jobs.filter((j) => j.server === s.index && (j.state === "transit" || j.state === "queued" || j.state === "service")).length;
  function sizeOf() {
    if (st.o.sizes === "uneven") return random() < 0.1 ? SERVICE * 5.5 : SERVICE * 0.5;
    return expo(random, SERVICE);
  }
  function userOf() {
    if (!st.o.heavy) return Math.floor(random() * USERS);
    const r = random();
    if (r < 0.2) return 0;
    if (r < 0.4) return 4;
    const light = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    return light[Math.floor(random() * light.length)];
  }
  function choose(user) {
    const pool = st.servers.filter((s) => present(s) && s.healthy);
    if (!pool.length) return null;
    if (st.o.sticky) {
      const want = st.servers[user % st.o.servers];
      if (want.healthy) return want;
    }
    if (st.o.algorithm === "random") return pool[Math.floor(random() * pool.length)];
    if (st.o.algorithm === "lc") {
      let best = null, bestN = Infinity;
      for (let k = 0; k < pool.length; k++) {
        const s = pool[(st.pointer + k) % pool.length], n = outstanding(s);
        if (n < bestN) { best = s; bestN = n; }
      }
      st.pointer = (st.pointer + 1) % Math.max(1, pool.length);
      return best;
    }
    // round robin over present counters the balancer believes are healthy
    for (let k = 0; k < MAX; k++) {
      const s = st.servers[(st.pointer + k) % MAX];
      if (present(s) && s.healthy) { st.pointer = (s.index + 1) % MAX; return s; }
    }
    return null;
  }
  function fail(job, at) { job.state = "error"; job.end = at; st.errors++; st.failed.push(job); st.events.push({ type: "error", job }); }
  function startNext(s, at) {
    if (s.current || !s.queue.length || !s.alive) return;
    const job = s.queue.shift();
    job.state = "service"; job.start = at;
    job.end = at + job.size * (st.o.slow === s.index ? SLOW : 1);
    s.current = job;
    st.events.push({ type: "start", job });
  }
  // Advance the model to time `to`, processing every event in order.
  function step(to) {
    for (let guard = 0; guard < 100000; guard++) {
      let t = Infinity, kind = null, who = null;
      if (st.nextArrival < t) { t = st.nextArrival; kind = "arrive"; }
      if (st.nextCheck < t) { t = st.nextCheck; kind = "check"; }
      for (const j of st.jobs) if (j.state === "transit" && j.reach < t) { t = j.reach; kind = "reach"; who = j; }
      for (const s of st.servers) if (s.current && s.current.end < t) { t = s.current.end; kind = "finish"; who = s; }
      if (t > to) break;
      for (const s of st.servers) if (s.current || s.queue.length) {} // placeholder for clarity
      // utilisation: accumulate busy time up to t
      for (const s of st.servers) if (s.current) s.busy += t - st.now;
      st.now = t;
      if (kind === "arrive") {
        const user = userOf();
        const job = { id: ++st.id, user, size: sizeOf(), arrive: t, state: "transit", server: -1 };
        const s = choose(user);
        if (!s) { fail(job, t); } else { job.server = s.index; job.reach = t + TRANSFER; st.jobs.push(job); st.events.push({ type: "dispatch", job }); }
        st.nextArrival = t + expo(random, 1 / st.o.rate);
      } else if (kind === "check") {
        for (const s of st.servers) s.healthy = s.alive;
        st.events.push({ type: "check" });
        st.nextCheck = t + st.o.check;
      } else if (kind === "reach") {
        const s = st.servers[who.server];
        if (!s.alive) fail(who, t); else { who.state = "queued"; s.queue.push(who); startNext(s, t); }
      } else if (kind === "finish") {
        const job = who.current; job.state = "done"; who.current = null; who.served++;
        st.done.push(job); st.events.push({ type: "finish", job });
        startNext(who, t);
      }
      st.jobs = st.jobs.filter((j) => j.state === "transit" || j.state === "queued" || j.state === "service");
    }
    for (const s of st.servers) if (s.current) s.busy += to - st.now;
    st.now = to;
  }
  function kill(index) {
    const s = st.servers[index]; if (!s.alive) return;
    s.alive = false;
    if (s.current) { fail(s.current, st.now); s.current = null; }
    for (const job of s.queue) fail(job, st.now);
    s.queue = [];
    st.jobs = st.jobs.filter((j) => j.state === "transit" || j.state === "queued" || j.state === "service");
  }
  function restart(index) { st.servers[index].alive = true; }
  function set(changes) {
    Object.assign(st.o, changes);
    if ("check" in changes) st.nextCheck = Math.min(st.nextCheck, st.now + st.o.check);
    if ("rate" in changes) st.nextArrival = Math.min(st.nextArrival, st.now + expo(random, 1 / st.o.rate));
    for (const s of st.servers) if (s.index < st.o.servers) startNext(s, st.now);
  }
  return { st, step, kill, restart, set };
}

// Run one headless trial. `at` events: [{ t, do: "kill", index }]
export function runHeadless(opts, { seconds = 1200, warm = 120, seed = 1, events = [] } = {}) {
  const m = createStation(opts, seed);
  const pending = [...events].sort((a, b) => a.t - b.t);
  let t = 0;
  m.step(warm);
  for (const s of m.st.servers) s.busy = 0;
  const startDone = m.st.done.length, startErr = m.st.errors;
  t = warm;
  for (const e of pending) { m.step(warm + e.t); if (e.do === "kill") m.kill(e.index); }
  m.step(warm + seconds);
  const done = m.st.done.slice(startDone).filter((j) => j.arrive >= warm);
  const times = done.map((j) => j.end - j.arrive);
  const util = m.st.servers.slice(0, m.st.o.servers).map((s) => s.busy / seconds);
  return { served: done.length, errors: m.st.errors - startErr, p50: rankQuantile(times, 0.5), p95: rankQuantile(times, 0.95), util, stuck: m.st.jobs.length };
}

export function average(opts, run = {}, seeds = [3, 5, 7, 11, 13, 17]) {
  return averageOver(seeds, (seed) => {
    const r = runHeadless(opts, { ...run, seed });
    return { p50: r.p50, p95: r.p95, errors: r.errors, served: r.served, busiest: Math.max(...r.util), quietest: Math.min(...r.util) };
  });
}

// ---------- the experiments (computed at build time; the page used to run them in the browser on click) ----------
const RUN = { seconds: 600 };
const avg = (o) => average(o, RUN);
// Failed parcels when counter 2 crashes at a random moment, averaged over 40 seeds.
function crashErrors(check) {
  let sum = 0, n = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const t = 20 + ((seed * 7.31) % 30);
    sum += runHeadless({ servers: 4, rate: 0.9, check }, { seconds: 120, seed, events: [{ t, do: "kill", index: 1 }] }).errors; n++;
  }
  return sum / n;
}
export function experimentResults() {
  const pick = ({ p50, p95, busiest, quietest }) => ({ p50, p95, busiest, quietest });
  const uneven = { servers: 4, rate: 0.9, sizes: "uneven" }, heavy = { servers: 4, rate: 0.9, heavy: true };
  const base = pick(avg({ servers: 4, rate: 0.9 }));
  return {
    add: { a: pick(avg({ servers: 3, rate: 0.9 })), b: base },
    slow: { a: base, b: pick(avg({ servers: 4, rate: 0.9, slow: 0 })), c: pick(avg({ servers: 4, rate: 0.9, slow: 0, algorithm: "lc" })) },
    uneven: { r: pick(avg({ ...uneven, algorithm: "random" })), a: pick(avg(uneven)), b: pick(avg({ ...uneven, algorithm: "lc" })) },
    crash: { e30: crashErrors(30), e10: crashErrors(10), e2: crashErrors(2) },
    sticky: { a: pick(avg(heavy)), b: pick(avg({ ...heavy, sticky: true })) },
  };
}

// @ts-nocheck: model code ported as-is; shared helpers come from src/lib.
// Shared model for the figure and the experiments. Times in seconds.
import { rng } from "../../lib/random";
import { averageOver } from "../../lib/stats";

export const CLIENTS = 3;
export const TRAVEL = 0.6;          // a ticket's ride from the client to the gate (figure only)
export const RETRY_NOW = 0.25;      // an impatient client tries again after this long
export const MAX_ATTEMPTS = 40;

// One limiter: token bucket (refills continuously) or fixed window (full again at every boundary).
export function makeLimiter(kind, capacity, rate, window) {
  return { kind, capacity, rate, window, tokens: capacity, last: 0, used: 0, windowStart: 0 };
}
function settle(l, t) {
  if (l.kind === "bucket") { l.tokens = Math.min(l.capacity, l.tokens + (t - l.last) * l.rate); l.last = t; }
  else { const start = Math.floor(t / l.window) * l.window; if (start !== l.windowStart) { l.windowStart = start; l.used = 0; } }
}
export function tryTake(l, t) {
  settle(l, t);
  if (l.kind === "bucket") { if (l.tokens >= 1) { l.tokens -= 1; return { ok: true }; } return { ok: false, retryAfter: (1 - l.tokens) / l.rate }; }
  const limit = Math.round(l.rate * l.window);
  if (l.used < limit) { l.used += 1; return { ok: true }; }
  return { ok: false, retryAfter: l.windowStart + l.window - t };
}
export function levelOf(l, t) {
  const c = { ...l }; settle(c, t);
  return c.kind === "bucket" ? c.tokens : Math.round(c.rate * c.window) - c.used;
}

// cfg: { rate, capacity, algorithm: "bucket"|"window", window, mode: "global"|"client", noisy, behaviour: "now"|"after", instances, demand: [r0,r1,r2], noisyRate, script }
export function makeSim(cfg, seed = 7) {
  const random = rng(seed);
  const share = cfg.mode === "client" ? CLIENTS : 1;
  const cap = cfg.mode === "client" ? Math.max(1, Math.ceil(cfg.capacity / CLIENTS)) : cfg.capacity;
  const rate = cfg.rate / share;
  const limiters = [];
  for (let i = 0; i < cfg.instances; i++) limiters.push(Array.from({ length: share }, () => makeLimiter(cfg.algorithm, cap, rate, cfg.window || 2)));
  const demand = (cfg.demand || [1.5, 1.5, 1.5]).map((r, i) => (i === 2 && cfg.noisy ? cfg.noisyRate || 9 : r));
  const queue = []; // { t, client, attempt, born }
  const push = (e) => { let i = queue.length; while (i > 0 && queue[i - 1].t > e.t) i--; queue.splice(i, 0, e); };
  if (cfg.script) cfg.script.forEach(([t, client]) => push({ t, client, attempt: 1, born: t }));
  if (!cfg.script || cfg.background) demand.forEach((r, client) => { if (r > 0) push({ t: -Math.log(1 - random()) / r, client, attempt: 1, born: 0, fresh: true }); });
  let rr = 0;
  const sim = { cfg, limiters, demand, now: 0, log: [] };
  sim.add = (t, client) => push({ t, client, attempt: 1, born: t });
  sim.runTo = (T, onDecision) => {
    while (queue.length && queue[0].t <= T) {
      const e = queue.shift();
      sim.now = e.t;
      if (e.fresh) { const r = demand[e.client]; push({ t: e.t - Math.log(1 - random()) / r, client: e.client, attempt: 1, born: e.t, fresh: true }); e.born = e.t; }
      const instance = cfg.instances > 1 ? rr++ % cfg.instances : 0;
      const l = limiters[instance][cfg.mode === "client" ? e.client : 0];
      const res = tryTake(l, e.t);
      const d = { t: e.t, client: e.client, instance, attempt: e.attempt, ok: res.ok, born: e.born, level: levelOf(l, e.t) };
      sim.log.push(d);
      onDecision && onDecision(d);
      if (!res.ok && cfg.retry !== false && e.attempt < MAX_ATTEMPTS) {
        const wait = cfg.behaviour === "now" ? RETRY_NOW : res.retryAfter + random() * 1.5;
        push({ t: e.t + wait, client: e.client, attempt: e.attempt + 1, born: e.born });
      }
    }
    sim.now = T;
  };
  return sim;
}

export function summarize(log, from, to) {
  const span = log.filter((d) => d.t >= from && d.t < to);
  const ok = span.filter((d) => d.ok);
  let peak = 0;
  for (let i = 0, j = 0; i < ok.length; i++) { while (ok[i].t - ok[j].t > 1) j++; peak = Math.max(peak, i - j + 1); }
  const quiet = span.filter((d) => d.client !== 2);
  return {
    attempts: span.length, allowed: ok.length, rejected: span.length - ok.length,
    perMinute: (ok.length / (to - from)) * 60, peakPerSecond: peak,
    quietRejected: quiet.length ? quiet.filter((d) => !d.ok).length / quiet.length : 0,
    noisyAllowed: ok.filter((d) => d.client === 2).length,
  };
}

export function average(cfg, { from = 0, to = 60, seeds = [3, 5, 7, 11, 13, 17] } = {}) {
  return averageOver(seeds, (seed) => { const s = makeSim(cfg, seed); s.runTo(to); return summarize(s.log, from, to); });
}

// ---------- experiments (run at build time; the page shows the results) ----------
export const BASE = { rate: 4, capacity: 8, algorithm: "bucket", window: 2, mode: "global", noisy: false, noisyRate: 8, behaviour: "after", instances: 1, demand: [1, 1, 1] };
function burstThrough(capacity) {
  // A quiet bucket, then 20 requests at once: how many pass in that first instant?
  const script = Array.from({ length: 20 }, (_, i) => [10 + i * 0.005, 0]);
  const s = makeSim({ ...BASE, capacity, script, retry: false }, 1); s.runTo(10.2);
  return s.log.filter((d) => d.ok && d.attempt === 1).length;
}
function boundary(algorithm) {
  const script = [];
  for (let i = 0; i < 16; i++) script.push([1.8 + i * 0.012, 0]);
  for (let i = 0; i < 16; i++) script.push([2.02 + i * 0.012, 0]);
  const s = makeSim({ ...BASE, algorithm, script, retry: false }, 1); s.runTo(2.25);
  return s.log.filter((d) => d.ok && d.attempt === 1).length;
}
// Clients A and B's requests (not attempts: a rejected request retries, and its retries are the same request): the
// share that got through within 1 s of being sent, and the share turned away on their first try. Requests sent in the
// last 10 s are left out, so every one counted had time to get through.
function quietRequests(cfg) {
  let sent = 0, quick = 0, firstNo = 0;
  for (const seed of [3, 5, 7, 11, 13, 17]) {
    const s = makeSim(cfg, seed); s.runTo(60);
    const reqs = new Map();
    for (const d of s.log) {
      if (d.client === 2 || d.born >= 50) continue;
      const key = d.client + ":" + d.born;
      if (!reqs.has(key)) reqs.set(key, { born: d.born, first: null, ok: null });
      const r = reqs.get(key);
      if (d.attempt === 1) r.first = d.ok;
      if (d.ok && r.ok === null) r.ok = d.t;
    }
    for (const r of reqs.values()) { sent++; if (r.ok !== null && r.ok - r.born <= 1) quick++; if (r.first === false) firstNo++; }
  }
  return { quick: quick / sent, firstNo: firstNo / sent };
}
function retryRun(behaviour) {
  const script = Array.from({ length: 30 }, (_, i) => [5 + i * 0.01, 0]);
  let rejected = 0; const seeds = [3, 5, 7, 11, 13, 17];
  for (const seed of seeds) { const s = makeSim({ ...BASE, script, background: true, behaviour }, seed); s.runTo(60); rejected += s.log.filter((d) => !d.ok).length; }
  return rejected / seeds.length;
}
export function experimentResults() {
  const heavy = { ...BASE, demand: [2.5, 2.5, 2.5] };
  const noisy = { ...BASE, noisy: true, rate: 6, capacity: 12 };
  return {
    size: { a: average({ ...heavy, capacity: 8 }), b: average({ ...heavy, capacity: 16 }), b8: burstThrough(8), b16: burstThrough(16) },
    window: { w: boundary("window"), b: boundary("bucket") },
    noisy: { g: quietRequests({ ...noisy, mode: "global" }), p: quietRequests({ ...noisy, mode: "client" }), gNoRetry: quietRequests({ ...noisy, mode: "global", retry: false }) },
    retry: { now: retryRun("now"), after: retryRun("after") },
    instances: { one: average({ ...heavy, instances: 1 }), two: average({ ...heavy, instances: 2 }) },
  };
}

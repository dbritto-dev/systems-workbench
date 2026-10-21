// Shared model for the figure and the experiments. Times in seconds.
export const CLIENTS = 3;
export const TRAVEL = 0.6;          // a ticket's ride from the client to the gate (figure only)
export const RETRY_NOW = 0.25;      // an impatient client tries again after this long
export const MAX_ATTEMPTS = 40;
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

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
  const runs = seeds.map((seed) => { const s = makeSim(cfg, seed); s.runTo(to); return summarize(s.log, from, to); });
  const out = {};
  for (const key of Object.keys(runs[0])) out[key] = runs.reduce((a, r) => a + r[key], 0) / runs.length;
  return out;
}

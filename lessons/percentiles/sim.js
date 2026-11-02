// Shared model for the figure and the experiments: how long requests take, and what percentiles say about it.
//   A backend call usually takes about 10 ms (log-normal, median 10 ms). A small share of calls are slow: they hit
//   a stall (a GC pause, a retransmit, a busy disk) and take 0.4 to 1.2 s instead.
//   A user request fans out to N backends in parallel and is done only when the slowest one answers.
//   A hedge sends a second copy of a call that is still out after a delay, to another host, and keeps whichever
//   answer comes first.
// Plain functions, no imports: the page inlines this file and the experiments run it at build time.

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function normal(r) { const u = Math.max(1e-12, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export const HOSTS = 10;          // backend hosts the calls spread over
export const SLOW_MS = 100;       // a user request over this counts as "slow" in the readouts
export const STALL = [400, 1200]; // how long a stalled call takes, ms

// One backend call, in ms. share: the chance this call stalls.
export function callMs(r, share) {
  let ms = 10 * Math.exp(0.3 * normal(r));
  if (r() < share) ms = STALL[0] + (STALL[1] - STALL[0]) * r();
  return ms;
}

// One user request at time t (seconds). It calls `fanout` backends in parallel and waits for the slowest.
//   share: stall chance per call (a number, or a function of the host)
//   hedgeAt: ms after which a call still out is sent again to another host (null: no hedging)
//   gc: { host, from, until } a stop-the-world pause on one host: calls that reach it in [from, until) wait it out
export function userRequest(r, { fanout = 1, share = 0.01, hedgeAt = null, t = 0, gc = null }) {
  const shareOf = typeof share === "function" ? share : () => share;
  const calls = [];
  let ms = 0, extra = 0, stalled = 0;
  for (let i = 0; i < fanout; i++) {
    const host = fanout >= HOSTS ? i % HOSTS : Math.floor(r() * HOSTS);
    let a = callMs(r, shareOf(host));
    if (gc && host === gc.host && t >= gc.from && t < gc.until) a += (gc.until - t) * 1000;
    if (hedgeAt !== null && a > hedgeAt) {
      extra++;
      const other = (host + 1 + Math.floor(r() * (HOSTS - 1))) % HOSTS;
      a = Math.min(a, hedgeAt + callMs(r, shareOf(other)));
    }
    if (a > SLOW_MS) stalled++;
    calls.push({ host, ms: a });
    if (a > ms) ms = a;
  }
  return { ms, calls, extra, stalled };
}

// Percentiles by nearest rank: p99 is the value 99% of requests are at or below.
export function pct(sorted, p) { return sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))] : 0; }
export function summary(values) {
  const s = Float64Array.from(values).sort();
  const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  return { n: values.length, mean, p50: pct(s, 50), p90: pct(s, 90), p95: pct(s, 95), p99: pct(s, 99), p999: pct(s, 99.9), max: s[s.length - 1] || 0, slow: values.filter((v) => v > SLOW_MS).length / (values.length || 1) };
}

// Histogram bins, ms (log-spaced, like most latency dashboards). Bin i holds edges[i] ≤ ms < edges[i + 1].
export const EDGES = [0, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, Infinity];
export function binOf(ms) { let i = 0; while (ms >= EDGES[i + 1]) i++; return i; }
// Where a latency sits along the bins, as a bin index with a fraction (for the markers), on the same log scale.
export function binPos(ms) {
  const i = binOf(ms);
  if (i === 0) return Math.max(0, ms / 5);
  if (EDGES[i + 1] === Infinity) return i + Math.min(0.9, Math.log(ms / EDGES[i]) / Math.log(2));
  return i + Math.log(ms / EDGES[i]) / Math.log(EDGES[i + 1] / EDGES[i]);
}

// Many user requests in a row.
export function run({ n = 20000, seed = 1, rate = 400, ...cfg }) {
  const r = rng(seed), ms = [];
  let extra = 0, calls = 0, anyStall = 0;
  for (let i = 0; i < n; i++) {
    const q = userRequest(r, { ...cfg, t: i / rate });
    ms.push(q.ms); extra += q.extra; calls += q.calls.length; if (q.stalled) anyStall++;
  }
  return { ...summary(ms), extraShare: extra / calls, anyStall: anyStall / n };
}

// ---------- the five experiments ----------
const SEEDS = [11, 23, 37, 41, 53, 67, 71, 89];
const avg = (list, f) => list.reduce((s, x) => s + f(x), 0) / list.length;
const over = (f) => { const runs = SEEDS.map(f); return Object.fromEntries(Object.keys(runs[0]).map((k) => [k, avg(runs, (x) => x[k])])); };

// 1. One call in 50 stalls. Which of mean, p50 and p99 notices?
export function tailRun() {
  return { none: over((seed) => run({ seed, share: 0 })), tail: over((seed) => run({ seed, share: 0.02 })) };
}
// 2. Every backend stalls one call in 100. Fan out to 1, 10, 100 of them.
export function fanoutRun() {
  const at = (fanout) => over((seed) => run({ seed, fanout, share: 0.01, n: fanout >= 100 ? 4000 : 20000 }));
  return { one: at(1), ten: at(10), hundred: at(100), formula: [1, 10, 100].map((n) => 1 - Math.pow(0.99, n)) };
}
// 3. Ten hosts, one of them bad. Average the hosts' p99s, or merge the hosts' requests and take the p99 once.
export function mergeRun() {
  return over((seed) => {
    const r = rng(seed), per = Array.from({ length: HOSTS }, () => []);
    for (let h = 0; h < HOSTS; h++) for (let i = 0; i < 5000; i++) per[h].push(callMs(r, h === 0 ? 0.15 : 0.002));
    const p99s = per.map((v) => summary(v).p99);
    return { avgP99: p99s.reduce((a, b) => a + b, 0) / HOSTS, maxP99: Math.max(...p99s), goodP99: p99s.slice(1).reduce((a, b) => a + b, 0) / (HOSTS - 1), fleetP99: summary(per.flat()).p99 };
  });
}
// 4. Fan-out to 10, one call in 100 stalls. Hedge any call still out after the backends' p95.
export function hedgeAtP95() { const r = rng(5), v = []; for (let i = 0; i < 50000; i++) v.push(callMs(r, 0.01)); return summary(v).p95; }
export function hedgeRun() {
  const at = hedgeAtP95();
  return { at, plain: over((seed) => run({ seed, fanout: 10, share: 0.01 })), hedged: over((seed) => run({ seed, fanout: 10, share: 0.01, hedgeAt: at })) };
}
// 5. One server, 400 requests a second for a minute. At 30 s it stops for a 1-second garbage-collection pause.
export function gcRun() {
  const base = { n: 24000, rate: 400, fanout: 1, share: 0 };
  const one = (gc) => over((seed) => {
    const r = rng(seed), ms = [];
    for (let i = 0; i < base.n; i++) { const t = i / base.rate; let a = callMs(r, 0); if (gc && t >= 30 && t < 31) a += (31 - t) * 1000; ms.push(a); }
    return summary(ms);
  });
  return { calm: one(false), pause: one(true) };
}

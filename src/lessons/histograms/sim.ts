// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// Three hosts behind a load balancer, each timing its requests. Every host keeps two things about the last minute:
// its own p99 (what a summary reports) and a histogram, a count per latency bucket. The dashboard can average the
// hosts' p99s, take the largest, or add the bucket counts and read the p99 off the merged histogram the way
// Prometheus's histogram_quantile() does. The model also keeps every request, so it knows the exact fleet p99.
// Seeded and browser-safe, shared by the live figure and the experiments.
//
// cfg:
//   share    the share of requests the load balancer sends to host C (A and B split the rest evenly)
//   slow     host C is slow: its latencies are SLOW_X times a healthy host's
//   buckets  "fine" | "coarse" | "short": the histogram's bucket upper bounds (ms), plus +Inf
//
// Latencies are illustrative and round: a healthy host's requests are log-normal around 40 ms (its p99 is about
// 145 ms); a slow host's are eight times that.

import { rng, normal } from "../../lib/random";
import { averageOver, rankQuantileSorted } from "../../lib/stats";

export const HOSTS = ["A", "B", "C"];
export const RATE = 200;                    // requests a second across the fleet
export const WINDOW = 60;                   // seconds of history every host keeps (a one-minute rate window)
export const MEDIAN = 40, SIGMA = 0.55;     // a healthy host: log-normal, median 40 ms
export const SLOW_X = 8;                    // a slow host: every request takes eight times as long
export const SLO = 300;                     // the latency objective: 99% of requests under 300 ms
export const LAYOUTS = {
  fine: [50, 100, 150, 200, 300, 500, 1000, 2500],
  coarse: [100, 500, 2500],
  short: [25, 50, 100, 150, 250],
};
export const SHARES = { "33": 1 / 3, "5": 1 / 20, "1": 1 / 100 };

export const DEFAULTS = { share: 1 / 100, slow: true, buckets: "fine" };

// ---------- one request ----------
// Host for a request: C with probability `share`, otherwise A or B evenly.
export function pickHost(r, share) {
  const u = r();
  if (u < share) return 2;
  return u < share + (1 - share) / 2 ? 0 : 1;
}
export function latency(r, slow) {
  return MEDIAN * Math.exp(SIGMA * normal(r)) * (slow ? SLOW_X : 1);
}

// ---------- the dashboard's arithmetic ----------
// Bucket index of a latency: the first upper bound it fits under (le, "less or equal"), or the +Inf bucket.
export function bucketOf(ms, edges) {
  for (let i = 0; i < edges.length; i++) if (ms <= edges[i]) return i;
  return edges.length;
}
// Prometheus histogram_quantile() on classic buckets: find the bucket holding rank q·total and interpolate linearly
// inside it, assuming its requests are spread evenly. The lowest bucket starts at 0. A rank in the +Inf bucket
// returns the highest finite upper bound.
// The bucket that holds rank q·total (the one histogramQuantile interpolates in, or +Inf).
export function rankBucket(q, counts) {
  const total = counts.reduce((a, b) => a + b, 0), rank = q * total;
  let cum = 0;
  for (let i = 0; i < counts.length; i++) { cum += counts[i]; if (cum >= rank && counts[i] > 0) return i; }
  return counts.length - 1;
}
export function histogramQuantile(q, counts, edges) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  const rank = q * total;
  let cum = 0;
  for (let i = 0; i < counts.length; i++) {
    const before = cum;
    cum += counts[i];
    if (cum >= rank && counts[i] > 0) {
      if (i === edges.length) return edges[edges.length - 1];
      const lo = i === 0 ? 0 : edges[i - 1], hi = edges[i];
      return lo + (hi - lo) * (rank - before) / counts[i];
    }
  }
  return edges[edges.length - 1];
}
// The share of requests at or under `ms`, from bucket counts: exact when `ms` is a bucket edge, otherwise
// interpolated linearly inside the bucket it falls in (what histogram_fraction() does).
export function histogramFraction(ms, counts, edges) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return 1;
  let below = 0;
  for (let i = 0; i < counts.length; i++) {
    const lo = i === 0 ? 0 : edges[i - 1], hi = i < edges.length ? edges[i] : Infinity;
    if (ms >= hi) { below += counts[i]; continue; }
    if (ms > lo && hi !== Infinity) below += counts[i] * (ms - lo) / (hi - lo);
    break;
  }
  return below / total;
}
// The share at or under the nearest bucket edges below and above `ms`: what a query on one bucket series can say.
export function edgeShares(ms, counts, edges) {
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  let lo = 0, hi = 0, cum = 0, loEdge = 0, hiEdge = Infinity;
  for (let i = 0; i < edges.length; i++) {
    cum += counts[i];
    if (edges[i] <= ms) { lo = cum; loEdge = edges[i]; }
    if (edges[i] >= ms && hiEdge === Infinity) { hi = cum; hiEdge = edges[i]; }
  }
  if (hiEdge === Infinity) hi = total;
  return { lo: lo / total, hi: hi / total, loEdge, hiEdge };
}

// Everything the dashboard can say about one window: per host, its p99 and bucket counts; for the fleet, the
// average and the largest of the hosts' p99s, the p99 read off the merged buckets, and the exact p99.
// `byHost`: three arrays of latencies, each sorted ascending.
export function summarize(byHost, edges) {
  const counts = byHost.map((xs) => { const c = Array(edges.length + 1).fill(0); for (const ms of xs) c[bucketOf(ms, edges)]++; return c; });
  const merged = counts[0].map((_, i) => counts[0][i] + counts[1][i] + counts[2][i]);
  const p99s = byHost.map((xs) => rankQuantileSorted(xs, 0.99));
  const live = byHost.map((xs) => xs.length > 0);
  const reported = p99s.filter((_, i) => live[i]);
  const all = mergeSorted(byHost);
  const exact = rankQuantileSorted(all, 0.99);
  const est = histogramQuantile(0.99, merged, edges);
  const b = rankBucket(0.99, merged);
  const underExact = all.length ? countAtOrBelow(all, SLO) / all.length : 1;
  return {
    n: all.length, ns: byHost.map((xs) => xs.length),
    counts, merged, p99s,
    avg: reported.length ? reported.reduce((a, x) => a + x, 0) / reported.length : 0,
    max: reported.length ? Math.max(...reported) : 0,
    est, exact,
    estBucket: b, exactBucket: bucketOf(exact, edges),
    bucketLo: b === 0 ? 0 : edges[b - 1], bucketHi: b < edges.length ? edges[b] : Infinity,
    hostBuckets: p99s.map((x) => bucketOf(x, edges)),
    underExact,
    underBuckets: histogramFraction(SLO, merged, edges),
    edge: edgeShares(SLO, merged, edges),
    sloEdge: edges.includes(SLO),
  };
}
function countAtOrBelow(sorted, v) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] <= v) lo = m + 1; else hi = m; }
  return lo;
}
function mergeSorted(lists) {
  const out = [];
  for (const xs of lists) for (const x of xs) out.push(x);
  return out.sort((a, b) => a - b);
}

// ---------- the live fleet: a stream of requests and a one-minute window per host ----------
// spike: { until } makes host C slow until that time (the panel's "Slow C for 10 s").
export function makeFleet(cfgIn, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const r = rng(seed);
  let t = 0, next = 0, id = 0;
  const win = [[], [], []];          // per host: { t, ms } in arrival order
  const recent = [];                 // the newest requests, for the figure's chips
  let spikeUntil = -1;
  function one(at) {
    const h = pickHost(r, cfg.share);
    const slow = h === 2 && (cfg.slow || at < spikeUntil);
    const req = { id: ++id, t: at, host: h, ms: latency(r, slow) };
    win[h].push(req);
    recent.push(req);
    if (recent.length > 64) recent.shift();
    return req;
  }
  function runTo(until) {
    while (next <= until) { one(next); next += -Math.log(1 - r()) / RATE; }
    t = until;
    for (const w of win) { let k = 0; while (k < w.length && w[k].t < t - WINDOW) k++; if (k) w.splice(0, k); }
  }
  return {
    cfg, win, recent,
    get t() { return t; },
    runTo,
    spike(secs) { spikeUntil = t + secs; },
    get spiking() { return t < spikeUntil; },
    summary() { return summarize(win.map((w) => w.map((q) => q.ms).sort((a, b) => a - b)), LAYOUTS[cfg.buckets]); },
  };
}

// ---------- experiments: one minute of traffic, averaged over seeds ----------
export const SEEDS = [11, 23, 37, 41, 59, 67, 73, 89];
function minute(cfg, seed) {
  const f = makeFleet(cfg, seed);
  f.runTo(WINDOW);
  return f.summary();
}
const run = (cfg) => averageOver(SEEDS, (seed) => {
  const s = minute(cfg, seed);
  return {
    pA: s.p99s[0], pB: s.p99s[1], pC: s.p99s[2], avg: s.avg, max: s.max, est: s.est, exact: s.exact,
    nC: s.ns[2], n: s.n, sameBucket: s.estBucket === s.exactBucket ? 1 : 0, err: Math.abs(s.est - s.exact), width: s.bucketHi - s.bucketLo,
    lo: s.bucketLo, hi: s.bucketHi,
    underExact: s.underExact, underBuckets: s.underBuckets, edgeLo: s.edge.lo, edgeHi: s.edge.hi,
    overExact: s.n * (1 - s.underExact),
  };
});

// 1. C is slow and serves 1 request in 100: the average of the three p99s vs the exact fleet p99.
export function avgRun() { return { slow: run({ share: 1 / 100, slow: true, buckets: "fine" }) }; }
// 2. Three healthy hosts, even traffic: the case where averaging seems to work.
export function evenRun() { return { even: run({ share: 1 / 3, slow: false, buckets: "fine" }) }; }
// 3. The same fleet as 1, read off the merged buckets instead.
export function mergeRun() { return { slow: run({ share: 1 / 100, slow: true, buckets: "fine" }) }; }
// 4. The SLO (99% under 300 ms) from fine buckets with an edge at 300 ms vs coarse buckets without one.
export function sloRun() { return { fine: run({ share: 1 / 100, slow: true, buckets: "fine" }), coarse: run({ share: 1 / 100, slow: true, buckets: "coarse" }) }; }
// 5. Buckets that stop at 250 ms, with C slow and serving 1 in 20.
export function topRun() { return { short: run({ share: 1 / 20, slow: true, buckets: "short" }), fine: run({ share: 1 / 20, slow: true, buckets: "fine" }) }; }

// Shared model for the figure and the experiments: one web service emits a request counter metric
// (one time series per distinct combination of label values) and a trace per request, which a sampler
// keeps or drops. The live machine runs a few requests a second; the experiments use 100 a second.
export const METHODS = [["GET", 0.7], ["POST", 0.3]];
// [template, share of traffic, has an id in the path]
export const ROUTES = [["/products/{id}", 0.3, true], ["/search", 0.18, false], ["/cart", 0.12, false], ["/orders/{id}", 0.1, true],
  ["/users/{id}", 0.08, true], ["/checkout", 0.08, false], ["/login", 0.07, false], ["/health", 0.07, false]];
export const OK_STATUS = [["200", 0.86], ["201", 0.06], ["404", 0.05], ["400", 0.03]];   // an error is a 500
export const USERS = 10000;             // active users in an hour
export const ID_SPACE = 1000000;        // product, order and user ids that can appear in a raw path
export const BYTES_PER_SERIES = 3072;   // ≈ memory one active series costs in a Prometheus-style store
export const LIVE_RATE = 8;             // requests per second in the live machine
export const LIVE_SLOW = 0.03;          // share of slow requests in the live machine
export const TAIL_BASE = 0.01;          // tail sampler: share of ordinary traces it keeps
export const HEAD = { all: 1, head10: 0.1, head1: 0.01, tail: 1 };

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const pick = (random, table) => { let u = random(); for (const row of table) { if ((u -= row[1]) < 0) return row; } return table[table.length - 1]; };

export const labelNames = (labels) => ["method", "route", ...(labels === "base" ? [] : ["status"]), ...(labels === "user" ? ["user_id"] : [])];

// Live model. cfg: { labels: "base" | "status" | "user", route: "template" | "raw", sampling: "all" | "head10" | "head1" | "tail", errorRate, rate }
export function makeLive(cfg, seed = 7) {
  const random = rng(seed);
  const index = new Map();
  const reqs = [];
  let next = 0;
  function one(t) {
    const [method] = pick(random, METHODS);
    const [template, , hasId] = pick(random, ROUTES);
    const err = random() < cfg.errorRate;
    const slow = !err && random() < LIVE_SLOW;
    const status = err ? "500" : pick(random, OK_STATUS)[0];
    const path = cfg.route === "raw" && hasId ? template.replace("{id}", String(1 + Math.floor(random() * ID_SPACE))) : template;
    const user = 1 + Math.floor(random() * USERS);
    const parts = [method, path];
    if (cfg.labels !== "base") parts.push(status);
    if (cfg.labels === "user") parts.push("u" + user);
    const key = parts.join(" ");
    let idx = index.get(key), first = false;
    if (idx === undefined) { idx = index.size; index.set(key, idx); first = true; }
    const headKeep = random() < HEAD[cfg.sampling];
    const tailKeep = cfg.sampling === "tail" ? (err || slow || random() < TAIL_BASE) : true;
    reqs.push({ n: reqs.length, t, key, idx, first, err, slow, headKeep, kept: headKeep && tailKeep });
  }
  return {
    cfg, reqs, index,
    runTo(t) { while (next <= t) { one(next); next += -Math.log(1 - random()) / cfg.rate; } },
  };
}

// Expected number of distinct series after n requests (exact expectation, no sampling noise).
export function expectedSeries({ labels, route, errorRate = 0.001 }, n) {
  const statuses = labels === "base" ? [["*", 1]] : [...OK_STATUS.map(([s, w]) => [s, w * (1 - errorRate)]), ["500", errorRate]];
  let total = 0;
  for (const [, pm] of METHODS) for (const [, pr, hasId] of ROUTES) for (const [, ps] of statuses) {
    let groups = 1;
    if (route === "raw" && hasId) groups *= ID_SPACE;
    if (labels === "user") groups *= USERS;
    const q = (pm * pr * ps) / groups;
    total += groups * (1 - Math.exp(n * Math.log1p(-q)));
  }
  return total;
}
export const seriesBytes = (series) => series * BYTES_PER_SERIES;

// One hour of traces at `rate` per second through a sampler (seeded Monte Carlo).
// mode: "head" (keep `head` of all, decided at the start) or "tail" (keep every error and slow trace + `base` of the rest).
// `rare` is a share of requests hit by one specific rare bug (they are errors too).
export function sampleHour({ mode, head = 0.01, base = TAIL_BASE, errorRate = 0.001, slow = 0.005, rare = 0.0001, rate = 100, seconds = 3600 }, seed = 1) {
  const random = rng(seed);
  const n = rate * seconds;
  // Visit only the requests that matter: the gap to the next hit of a chance p is geometric.
  const hits = (p, count, each = () => {}) => { let k = 0; if (p <= 0) return 0; for (let i = -1; ; ) { i += 1 + Math.floor(Math.log(1 - random()) / Math.log1p(-p)); if (i >= count) return k; k++; each(); } };
  const out = { requests: n, errors: 0, errorsKept: 0, rare: 0, rareKept: 0, kept: 0 };
  hits(errorRate, n, () => {
    const isRare = random() < rare / errorRate;
    const keep = mode === "head" ? random() < head : true;
    out.errors++; if (isRare) out.rare++;
    if (keep) { out.errorsKept++; out.kept++; if (isRare) out.rareKept++; }
  });
  const ordinary = n - out.errors;
  if (mode === "head") out.kept += hits(head, ordinary);
  else { const slowCount = hits(slow, ordinary); out.kept += slowCount + hits(base, ordinary - slowCount); }
  return out;
}
export function sampleHours(opts, hours) {
  return Array.from({ length: hours }, (_, h) => sampleHour(opts, 11 + h * 7919));
}

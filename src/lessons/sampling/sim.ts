// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// A trace archive: every request passes through three services, A (the edge), B (orders) and C (payments), and each
// service writes one span. A sampler decides which spans are kept: at the start of the request (head sampling: each
// service on its own, or every service following the edge's decision, parent-based) or at a collector once the spans
// have arrived (tail sampling: keep errors, slow traces and a share of the rest). Kept spans are filed by trace in the
// archive. Seeded and shared by the live figure and the experiments. Times are seconds; the numbers are illustrative.
//
// A request: A starts at t0 and calls B (a quick lookup), then C (the payment: sometimes slow, sometimes failing);
// A ends just after C. Each span is exported when it ends and reaches the collector after an export delay (batching),
// so B's span arrives first and A's last.
//
// cfg:
//   mode     "own"    head sampling, every service draws its own random number against its rate
//            "parent" head sampling, the edge decides and B and C follow the sampled flag it passes on (ParentBased)
//            "tail"   every span is recorded and sent to a collector, which decides per trace
//   keep     head: the edge's (and, on their own, every service's) rate; tail: the share of ordinary traces kept
//   pay      C's own sampler rate, or null for the same as the others (ignored under "parent": C always has a parent)
//   wait     tail: seconds a collector waits after a trace's first span before it decides (decision wait)
//   coll     tail: "one" collector, or two fed "rr" (spans spread evenly, whatever their trace) or "trace" (by trace id)
//   err      share of requests that fail at C;  slow  share whose call to C is slow (4 to 12 s)
import { rng } from "../../lib/random";
import { averageOver } from "../../lib/stats";

export const NAMES = ["A", "B", "C"];
export const SLOW_T = 3;               // tail rule: keep a trace that took at least this long (s); ordinary ones take 1 to 2.5 s
export const ERR = 0.005, SLOW = 0.01; // the experiments' traffic: 0.5% fail, 1% slow
export const LIVE_ERR = 0.05, LIVE_SLOW = 0.05, LIVE_RATE = 1.2;   // the machine shows ten times more, so you see them
export const DEFAULTS = { mode: "tail", keep: 0.1, pay: null, wait: 15, coll: "one", err: ERR, slow: SLOW, rate: 100 };

const U = (r, a, b) => a + (b - a) * r();

// One request and its three spans, with every time it will need. u stands for the trace id's randomness: a
// probabilistic rule that hashes the trace id gives the same answer wherever it runs.
export function makeTrace(r, id, t0, cfg) {
  const err = r() < cfg.err, slow = r() < cfg.slow, u = r();
  const bS = t0 + 0.05, bE = bS + U(r, 0.4, 0.8);
  const cS = bE + 0.05, cE = cS + (slow ? U(r, 4, 12) : U(r, 0.5, 1.5));
  const aE = cE + 0.05;
  const spans = [
    { svc: 0, start: t0, end: aE },
    { svc: 1, start: bS, end: bE },
    { svc: 2, start: cS, end: cE, err },
  ];
  for (const s of spans) s.arrive = s.end + U(r, 0.2, 1.5);
  // collectors: one; two fed span by span whatever the trace (round robin); or two chosen by trace id
  const byId = Math.floor(u * 1048576) % 2;
  for (const s of spans) s.coll = cfg.coll === "one" ? 0 : cfg.coll === "trace" ? byId : r() < 0.5 ? 0 : 1;
  const tr = { id, t0, err, slow, u, spans };
  decide(tr, cfg, r);
  return tr;
}

// Which spans are kept, when each is decided, and what each kept trace stands for.
function decide(tr, cfg, r) {
  const { spans } = tr;
  tr.parts = [];
  if (cfg.mode === "own") {
    for (const s of spans) {
      s.p = s.svc === 2 && cfg.pay != null ? cfg.pay : cfg.keep;
      s.kept = s.recorded = r() < s.p;
      s.decided = s.arrive;
    }
  } else if (cfg.mode === "parent") {
    // the edge's root sampler decides from the trace id; B and C read the sampled flag from the incoming context
    const on = tr.u < cfg.keep;
    for (const s of spans) { s.p = cfg.keep; s.kept = s.recorded = on; s.decided = s.arrive; }
    tr.flag = on;
  } else {
    for (const s of spans) s.recorded = true;
    for (let c = 0; c < 2; c++) {
      let first = Infinity, n = 0;
      for (const s of spans) if (s.coll === c) { n++; if (s.arrive < first) first = s.arrive; }
      if (!n) continue;
      const at = first + cfg.wait;
      let seen = 0, err = false, lo = Infinity, hi = -Infinity;
      for (const s of spans) if (s.coll === c && s.arrive <= at) { seen++; if (s.err) err = true; if (s.start < lo) lo = s.start; if (s.end > hi) hi = s.end; }
      const why = err ? "error" : hi - lo >= SLOW_T ? "slow" : tr.u < cfg.keep ? "base" : "drop";
      const part = { coll: c, first, at, why, keep: why !== "drop", seen, late: n - seen };
      tr.parts.push(part);
      // a span that arrives after the decision follows it (the collector still remembers the trace)
      for (const s of spans) if (s.coll === c) { s.kept = part.keep; s.p = why === "base" ? cfg.keep : 1; s.decided = s.arrive > at ? s.arrive : at; s.part = part; }
    }
  }
  tr.keptN = (spans[0].kept ? 1 : 0) + (spans[1].kept ? 1 : 0) + (spans[2].kept ? 1 : 0);
  tr.whole = tr.keptN === 3;
  tr.broken = tr.keptN > 0 && tr.keptN < 3;
  tr.settle = Math.max(spans[0].decided, spans[1].decided, spans[2].decided);
  // what the trace counts for on a dashboard: C's span carries the outcome, so weight by the chance it was kept
  const c = spans[2];
  tr.weight = c.kept ? 1 / c.p : 0;
}

// The live machine: requests arrive at random; traces are generated as the clock passes them.
export function makeLab(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const r = rng(seed);
  let t = 0, nextId = 1, nextAt = -Math.log(1 - r()) / cfg.rate;
  const traces = [];                     // recent traces, oldest first
  const st = { sent: 0, kept: 0, whole: 0, broken: 0, dropped: 0, err: 0, errKept: 0, errWhole: 0, slow: 0, slowKept: 0, slowWhole: 0, cTraces: 0, cErr: 0, wSum: 0, wErr: 0 };
  const settled = [];
  let settleAt = 0;
  function add(at, extra) {
    const tr = makeTrace(r, nextId++, at, { ...cfg, ...extra });
    traces.push(tr);
    return tr;
  }
  function count(tr) {
    st.sent++;
    if (tr.keptN) st.kept++; else st.dropped++;
    if (tr.whole) st.whole++;
    if (tr.broken) st.broken++;
    if (tr.err) { st.err++; if (tr.spans[2].kept) st.errKept++; if (tr.whole) st.errWhole++; }
    if (tr.slow) { st.slow++; if (tr.keptN) st.slowKept++; if (tr.whole) st.slowWhole++; }
    if (tr.spans[2].kept) { st.cTraces++; if (tr.err) st.cErr++; st.wSum += tr.weight; if (tr.err) st.wErr += tr.weight; }
  }
  function runTo(until) {
    while (nextAt <= until) { add(nextAt); nextAt += -Math.log(1 - r()) / cfg.rate; }
    t = until;
    // count each trace once it has settled (every span filed or dropped)
    for (let i = settleAt; i < traces.length; i++) {
      const tr = traces[i];
      if (!tr.counted && tr.settle <= t) { tr.counted = true; count(tr); }
    }
    while (settleAt < traces.length && traces[settleAt].counted) settleAt++;
    // forget traces long gone
    const cut = traces.findIndex((tr) => !(tr.counted && tr.settle < t - 20));
    if (cut > 200) { traces.splice(0, cut); settleAt -= cut; }
  }
  // one request now, failing or slow (the panel's buttons)
  function inject(at, kind) {
    runTo(at);
    return add(at, kind === "err" ? { err: 1, slow: 0 } : { err: 0, slow: 1 });
  }
  // traces held in collector memory right now (one per collector part waiting for its decision)
  const held = () => traces.reduce((n, tr) => n + tr.parts.filter((p) => p.first <= t && t < p.at).length, 0);
  return { cfg, traces, st, settled, runTo, inject, held, get t() { return t; } };
}

// ---------- experiments: headless runs, averaged over seeds ----------
// 100 requests a second for 20 minutes per seed: 120,000 traces, about 600 failing and 1,200 slow.
export const RATE = 100, SECS = 1200;
const SEEDS = [11, 23, 37, 41, 59, 67, 73, 89];
const avg = (fn) => averageOver(SEEDS, fn);

const memo = new Map();
function run(cfg, seed) {
  const key = JSON.stringify(cfg) + "/" + seed;
  if (!memo.has(key)) memo.set(key, runOnce(cfg, seed));
  return memo.get(key);
}
function runOnce(cfg, seed) {
  const c = { ...DEFAULTS, ...cfg };
  const r = rng(seed);
  const n = RATE * SECS;
  const o = { n, kept: 0, whole: 0, broken: 0, spans: 0, err: 0, errC: 0, errWhole: 0, slow: 0, slowKept: 0, slowWhole: 0, cT: 0, cErr: 0, wSum: 0, wErr: 0, heldSecs: 0 };
  for (let i = 0; i < n; i++) {
    const tr = makeTrace(r, i + 1, i / RATE, c);
    if (tr.keptN) o.kept++;
    if (tr.whole) o.whole++;
    if (tr.broken) o.broken++;
    o.spans += tr.keptN;
    if (tr.err) { o.err++; if (tr.spans[2].kept) o.errC++; if (tr.whole) o.errWhole++; }
    if (tr.slow) { o.slow++; if (tr.keptN) o.slowKept++; if (tr.whole) o.slowWhole++; }
    if (tr.spans[2].kept) { o.cT++; if (tr.err) o.cErr++; o.wSum += tr.weight; if (tr.err) o.wErr += tr.weight; }
    for (const p of tr.parts) o.heldSecs += p.at - p.first;
  }
  o.held = o.heldSecs / SECS;                  // traces held in collector memory on average (Little's law)
  return o;
}
const share = (a, b) => (b ? a / b : 0);

// 1. Every service keeps 10% on its own vs the edge decides and the others follow.
export function coinsRun() {
  const one = (mode) => avg((seed) => {
    const o = run({ mode, keep: 0.1 }, seed);
    return { wholeShare: share(o.whole, o.kept), spanShare: o.spans / (3 * o.n), kept: o.kept / o.n };
  });
  return { own: one("own"), parent: one("parent") };
}

// 2. Payments sets its own sampler to 100%; the edge keeps 1%.
export function raiseRun() {
  const one = (cfg) => avg((seed) => {
    const o = run({ mode: cfg.mode, keep: 0.01, wait: 15, pay: cfg.pay ?? null }, seed);
    return { errC: share(o.errC, o.err), errWhole: share(o.errWhole, o.err), err: o.err };
  });
  return { before: one({ mode: "parent", pay: null }), parent: one({ mode: "parent", pay: 1 }), own: one({ mode: "own", pay: 1 }), tail: one({ mode: "tail" }) };
}

// 3. Tail sampling with a 5 s decision wait vs 15 s; slow requests take 4 to 12 s.
export function waitRun() {
  const one = (wait) => avg((seed) => {
    const o = run({ mode: "tail", keep: 0.01, wait, pay: null }, seed);
    return { slowWhole: share(o.slowWhole, o.slow), errWhole: share(o.errWhole, o.err), held: o.held };
  });
  return { short: one(5), long: one(15) };
}

// 4. Two collectors: spans spread evenly vs routed by trace id.
export function splitRun() {
  const one = (coll) => avg((seed) => {
    const o = run({ mode: "tail", keep: 0.01, wait: 15, coll }, seed);
    return { errWhole: share(o.errWhole, o.err), errC: share(o.errC, o.err), brokenShare: share(o.broken, o.kept) };
  });
  return { rr: one("rr"), trace: one("trace") };
}

// 5. The error rate a dashboard reads off the archive: counting traces vs weighting each by 1 / its keep chance.
export function weightRun() {
  return avg((seed) => {
    const o = run({ mode: "tail", keep: 0.01, wait: 15, pay: null }, seed);
    return { truth: o.err / o.n, raw: share(o.cErr, o.cT), weighted: share(o.wErr, o.wSum), kept: o.kept / o.n };
  });
}

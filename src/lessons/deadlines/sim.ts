// @ts-nocheck: model code in the lessons' plain style; shared helpers come from src/lib.
// A chain of three services: client → gateway → service → database. Event-driven and seeded, shared by the live
// figure and the experiments. Times are in seconds.
//
// Every hop has a fixed number of workers and a first-come-first-served line. A worker takes a call, does the hop's
// own work, then (gateway and service) calls the next hop and stays held while it waits for the answer, as a
// thread-per-request server does. The database runs the query and answers.
//
// cfg:
//   mode     "fixed": each caller has its own timeout and gives up alone; nobody downstream is told.
//            "deadline": the client's deadline travels with the call; a hop drops or refuses a call that has too
//            little time left, and every hop stops the moment the deadline passes.
//   client   the client's timeout, in seconds (in "deadline" mode, the deadline is sent at + client)
//   inner    "short": the gateway waits 0.9× and the service 0.75× the client's timeout for the next hop;
//            "long": 2.5× and 5× (inner timeouts longer than the outer one)
//   db       "ok" | "stall": 1 query in 20 hangs for 4–8 s | "slow": every query takes 5× longer
//   gw       "fast" | "slow": the gateway spends an extra 0–1.8 s on its own step before calling on
//   refuse   in "deadline" mode, refuse a call with less time left than the hop usually needs (NEED)
//   rate     requests per second (Poisson)
import { rng, normal } from "../../lib/random";
import { minHeap } from "../../lib/events";
import { averageOver, rankQuantile } from "../../lib/stats";

export const HOPS = 3;                       // 0 gateway, 1 service, 2 database
export const WORKERS = [10, 10, 6];
export const NET = 0.02;                     // one way, between two hops
export const RATE = 5;
export const NEED = [0.4, 0.35, 0.25];       // about what each hop and everything after it usually takes
export const STALL = { p: 1 / 20, min: 4, max: 8 };
export const SLOW = 5;
export const GW_SLOW = 1.8;
export const INNER = { short: [0.9, 0.75], long: [2.5, 5] };
export const DB_MEDIAN = 0.25, DB_SIGMA = 0.6, SVC_MEDIAN = 0.08, SVC_SIGMA = 0.4;
export const DEFAULTS = { mode: "fixed", client: 2, inner: "short", db: "ok", gw: "fast", refuse: true, rate: RATE };

/** Queries a second the database can finish with every worker busy (mean query time from the lognormal). */
export const dbCapacity = (slow = 1) => WORKERS[2] / (DB_MEDIAN * Math.exp((DB_SIGMA * DB_SIGMA) / 2) * slow);

/** The gateway's and the service's own timeouts for the call they make, in seconds. */
export const innerTimeouts = (cfg) => INNER[cfg.inner].map((f) => Math.round(f * cfg.client * 100) / 100);

export function makeChain(cfgIn, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const r = rng(seed);
  const timeouts = innerTimeouts(cfg);
  const deadline = cfg.mode === "deadline";
  const heap = minHeap((a, b) => a.t < b.t || (a.t === b.t && a.n < b.n));
  let n = 0, now = 0, nextCall = 1, nextReq = 1, stallNext = 0;
  const at = (t, type, x) => heap.push({ t, n: n++, type, x });
  const hops = WORKERS.map((k, h) => ({ h, slots: Array(k).fill(null), queue: [] }));
  const reqs = [];                 // every request still in sight of the figure (trimmed by the live code)
  const replies = new Set();       // calls whose answer is on its way back up
  const log = [];
  const st = {
    sent: 0, ok: 0, late: 0, error: 0, refused: 0, dropped: 0, hopTimeouts: 0,
    work: [0, 0, 0], waste: [0, 0, 0],
    dbStarted: 0, dbStartedGone: 0, dbStartedShort: 0, dbOk: 0, dbOkUseless: 0, dbCut: 0,
    times: [],                    // [sent at, outcome, seconds until the client had its outcome]
  };

  // Each request draws its own work up front, so the same seed gives the same requests in every mode.
  function draws() {
    const gw = 0.02 + 0.04 * r() + (cfg.gw === "slow" ? GW_SLOW * r() : 0);
    const svc = SVC_MEDIAN * Math.exp(SVC_SIGMA * normal(r));
    let db = DB_MEDIAN * Math.exp(DB_SIGMA * normal(r));
    const u = r(), len = STALL.min + (STALL.max - STALL.min) * r();
    if (cfg.db === "slow") db *= SLOW;
    const stall = cfg.db === "stall" && u < STALL.p;
    if (stall) db = len;
    return { work: [gw, svc, db], stall };
  }

  function send() {
    const d = draws();
    const req = { id: nextReq++, born: now, deadline: now + cfg.client, work: d.work, stall: d.stall, outcome: null, doneAt: null, calls: [], dbOk: false, slot: -1 };
    if (stallNext > 0) { req.work[2] = STALL.min + (STALL.max - STALL.min) / 2; req.stall = true; stallNext--; }
    reqs.push(req); st.sent++;
    const c = call(req, 0, null);
    at(now + cfg.client, "clientTimeout", req);
    log.push({ t: now, type: "send", req });
    return c;
  }

  function call(req, h, parent) {
    const c = { id: nextCall++, req, h, parent, state: "transit", sentAt: now, start: -1, slot: -1, child: null, end: -1, result: null };
    req.calls.push(c);
    at(now + NET, "reach", c);
    return c;
  }

  function pump(h) {
    const hop = hops[h];
    for (;;) {
      const slot = hop.slots.indexOf(null);
      if (slot < 0 || !hop.queue.length) return;
      const c = hop.queue.shift(), req = c.req, left = req.deadline - now;
      if (deadline && cfg.refuse && left < NEED[h]) {
        c.state = "refused"; c.end = now; st.refused++;
        log.push({ t: now, type: "refuse", req, h, left });
        reply(c, "refused");
        continue;
      }
      c.state = "work"; c.start = now; c.slot = slot; hop.slots[slot] = c;
      if (h === 2) {
        st.dbStarted++;
        if (req.doneAt !== null) st.dbStartedGone++;
        else if (left < NEED[2]) st.dbStartedShort++;
      }
      at(now + req.work[h], "workDone", c);
    }
  }

  // A worker lets go of a call: count its time, and the part of it after the client already had its outcome.
  function free(c) {
    if (c.slot < 0) return;
    const hop = hops[c.h], req = c.req, held = now - c.start;
    hop.slots[c.slot] = null; c.slot = -1;
    st.work[c.h] += held;
    if (req.doneAt !== null && req.doneAt < now) st.waste[c.h] += now - Math.max(c.start, req.doneAt);
  }

  function respond(c, result) {
    free(c);
    c.state = "done"; c.end = now; c.result = result;
    if (c.h === 2 && result === "ok") {
      c.req.dbOk = true; st.dbOk++;
      if (c.req.doneAt !== null) { st.dbOkUseless++; log.push({ t: now, type: "dbLate", req: c.req, after: now - c.req.doneAt }); }
    }
    reply(c, result);
    pump(c.h);
  }

  function reply(c, result) {
    c.replyAt = now + NET; c.result = result;
    replies.add(c);
    at(now + NET, "reply", c);
  }

  function settle(req, outcome) {
    req.outcome = outcome; req.doneAt = now;
    st[outcome]++;
    st.times.push([req.born, outcome, now - req.born]);
    log.push({ t: now, type: outcome, req, working: req.calls.filter((c) => c.state === "work" || c.state === "wait" || c.state === "queued" || c.state === "transit").length });
  }

  // Deadline mode: the deadline has passed, so every hop stops working on this request at once.
  function cancelAll(req) {
    const touched = new Set();
    for (const c of req.calls) {
      if (c.state === "queued") { const q = hops[c.h].queue; q.splice(q.indexOf(c), 1); st.dropped++; c.state = "cancelled"; c.end = now; }
      else if (c.state === "transit") { c.state = "cancelled"; c.end = now; }
      else if (c.state === "work" || c.state === "wait") {
        if (c.h === 2 && c.state === "work") st.dbCut++;
        free(c); c.state = "cancelled"; c.end = now; touched.add(c.h);
      }
    }
    for (const c of req.calls) replies.delete(c);
    for (const h of touched) pump(h);
  }

  function handle(e) {
    const c = e.x;
    if (e.type === "arrival") { send(); at(now + -Math.log(1 - r()) / cfg.rate, "arrival"); }
    else if (e.type === "reach") {
      if (c.state !== "transit") return;
      c.state = "queued"; c.queuedAt = now; hops[c.h].queue.push(c); pump(c.h);
    } else if (e.type === "workDone") {
      if (c.state !== "work") return;
      if (c.h === 2) { respond(c, "ok"); return; }
      c.state = "wait";
      c.child = call(c.req, c.h + 1, c);
      if (!deadline) at(now + timeouts[c.h], "hopTimeout", c);
    } else if (e.type === "hopTimeout") {
      if (c.state !== "wait") return;
      st.hopTimeouts++;
      log.push({ t: now, type: "hopTimeout", req: c.req, h: c.h, after: timeouts[c.h] });
      respond(c, "timeout");
    } else if (e.type === "reply") {
      if (!replies.has(c)) return;
      replies.delete(c);
      const p = c.parent, req = c.req;
      if (!p) { if (req.outcome === null) settle(req, c.result === "ok" ? "ok" : "error"); return; }
      if (p.state === "wait" && p.child === c) respond(p, c.result);
    } else if (e.type === "clientTimeout") {
      if (c.outcome !== null) return;
      settle(c, "late");
      if (deadline) cancelAll(c);
    }
  }

  at(-Math.log(1 - r()) / cfg.rate, "arrival");

  function runTo(T) {
    while (heap.size && heap.peek().t <= T) { const e = heap.pop(); now = e.t; handle(e); }
    now = T;
  }

  /** Worker-seconds spent after the client already had its outcome, at hop h, including work still under way. */
  function wasteNow(h) {
    let w = st.waste[h];
    for (const c of hops[h].slots) if (c && c.req.doneAt !== null) w += now - Math.max(c.start, c.req.doneAt);
    return w;
  }

  return {
    cfg, hops, reqs, replies, log, st, timeouts, runTo, wasteNow,
    get now() { return now; },
    stallNext() { stallNext++; },
  };
}

// ---------- experiments: headless runs averaged over seeds ----------
export const SEEDS = [3, 5, 7, 11, 13, 17];
export const RUN = 120;

/** One run's summary, counting requests sent between `from` and `to`. */
export function summarize(m, from, to) {
  const span = m.st.times.filter(([born]) => born >= from && born < to);
  const ok = span.filter(([, o]) => o === "ok").length;
  const secs = to - from;
  const work = m.st.work.reduce((a, b) => a + b, 0);
  const waste = m.st.waste.reduce((a, b) => a + b, 0);
  return {
    sent: span.length, ok: ok / Math.max(1, span.length), goodput: ok / secs,
    late: span.filter(([, o]) => o === "late").length / Math.max(1, span.length),
    error: span.filter(([, o]) => o === "error").length / Math.max(1, span.length),
    wasteGw: m.st.waste[0] / (m.now / 60), wasteSvc: m.st.waste[1] / (m.now / 60), wasteDb: m.st.waste[2] / (m.now / 60),
    waste: waste / (m.now / 60), dbWasteShare: m.st.waste[2] / Math.max(1e-9, m.st.work[2]), wasteShare: waste / Math.max(1e-9, work),
    dbStarted: m.st.dbStarted, dbUseless: (m.st.dbStarted - m.st.ok) / Math.max(1, m.st.dbStarted), dbUselessPerMin: (m.st.dbStarted - m.st.ok) / (m.now / 60), refusedPerMin: m.st.refused / (m.now / 60),
    dbStartedShort: m.st.dbStartedShort + m.st.dbStartedGone, dbOkUseless: m.st.dbOkUseless, refused: m.st.refused, dropped: m.st.dropped,
    stalls: m.reqs.filter((q) => q.stall && q.born >= from && q.born < to).length,
    errorTime: (() => { const e = span.filter(([, o]) => o === "error").map(([, , s]) => s); return e.length ? e.reduce((a, b) => a + b, 0) / e.length : 0; })(),
  };
}

export function run(cfg, { from = 10, to = RUN, seed = 1 } = {}) {
  const m = makeChain(cfg, seed);
  let peak = 0;                              // the longest the database's line got while we counted
  m.runTo(from);
  for (let t = from; t <= to; t += 0.25) { m.runTo(t); peak = Math.max(peak, m.hops[2].queue.length); }
  const queue = m.hops[2].queue.length;     // the database's line at the end of the run
  m.runTo(to + 15);           // let the last requests finish (or be abandoned) before counting
  return { ...summarize(m, from, to), queue, peak };
}
export const average = (cfg, opts = {}) => averageOver(SEEDS, (seed) => run(cfg, { ...opts, seed }));

/** End-to-end latency of a healthy chain with no timeouts in the way: the median, p99 and p99.9. */
export function healthyLatency() {
  const all = [];
  for (const seed of SEEDS) {
    const m = makeChain({ mode: "fixed", client: 60, inner: "short", db: "ok", gw: "fast" }, seed);
    m.runTo(RUN + 30);
    for (const [born, o, s] of m.st.times) if (born >= 10 && born < RUN && o === "ok") all.push(s);
  }
  return { p50: rankQuantile(all, 0.5), p99: rankQuantile(all, 0.99), p999: rankQuantile(all, 0.999), n: all.length };
}

export const BASE = { mode: "fixed", client: 2, inner: "short", db: "ok", gw: "fast" };
export function experimentResults() {
  const stall = { ...BASE, db: "stall" };
  return {
    wasted: { fixed: average(stall), deadline: average({ ...stall, mode: "deadline" }) },
    order: { short: average(stall), long: average({ ...stall, inner: "long" }) },
    slow: { fixed: average({ ...BASE, db: "slow" }), deadline: average({ ...BASE, db: "slow", mode: "deadline" }), healthy: average(BASE) },
    budget: { fixed: average({ ...BASE, gw: "slow" }), deadline: average({ ...BASE, gw: "slow", mode: "deadline" }) },
    pct: { lat: healthyLatency(), one: average({ ...BASE, mode: "deadline", client: 1 }), two: average({ ...BASE, mode: "deadline", client: 2 }) },
  };
}

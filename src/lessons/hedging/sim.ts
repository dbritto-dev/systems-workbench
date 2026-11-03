// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// Hedged requests: a kitchen pass in front of five cooks (replicas). Times are in milliseconds.
//
//   A client (the pass) sends each request (a ticket) to one replica picked at random. Each replica is one worker with a
//   first-in, first-out queue. A request needs about 10 ms of work wherever it runs; a heavy one needs 15 times that,
//   on any replica (the slowness is in the request). Now and then a replica stalls for 40 to 120 ms (a GC pause, a
//   noisy neighbour): it does no work at all, so the request it holds and everything queued behind it wait (the
//   slowness is in the replica). Messages between the client and the replicas, and between replicas, take NET ms.
//
//   mode "hedge": a request still unanswered after `delay` ms gets one copy, sent to a different replica. The first
//                answer wins. With `cancel`, the client then cancels the other copy: it leaves the queue, or stops if
//                it has started. Without it, the loser runs to the end and its answer is thrown away.
//   mode "tied":  every request goes to two replicas at once (the second 2 × NET later), each copy tagged with the
//                other. When one copy starts, its replica tells the other to drop its copy if it hasn't started yet.
//   budget:      hedges may use at most this share of requests (a token bucket: each request earns `budget` of a
//                token, a hedge spends one, the bucket holds BUCKET).
//
// Everything the lesson shows comes from this model: the live figure runs it, and the experiments run it at build time.
import { rng, normal, exponential } from "../../lib/random";
import { minHeap } from "../../lib/events";
import { averageOver, rankQuantile } from "../../lib/stats";

export const REPLICAS = 5;
export const WORK = 10;               // mean ms of work for a normal request
export const SPREAD = 0.25;           // log-normal spread of a normal request's work
export const HEAVY_X = 15;            // a heavy request needs this many times the work
export const NET = 1;                 // ms one way, client ↔ replica and replica ↔ replica
export const STALL_EVERY = 8000;      // mean ms between stalls of one replica
export const STALL = [40, 120];       // a stall lasts this long, ms
export const BUCKET = 10;             // hedge budget: tokens the bucket holds
export const TIED_GAP = 2 * NET;      // tied requests: the second copy leaves this much after the first

export const DEFAULTS = { load: 0.5, stalls: true, heavy: 0, mode: "off", delay: 20, cancel: false, budget: 0 };

// The arrival rate (requests per ms) that keeps the replicas `load` busy with normal requests only.
export const rateFor = (load) => (load * REPLICAS) / WORK;

export function makeKitchen(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const r = rng(seed);
  let seq = 0;
  const heap = minHeap((a, b) => a.t < b.t || (a.t === b.t && a.n < b.n));
  const at = (t, type, x = {}) => heap.push({ t, n: seq++, type, ...x });

  const replicas = Array.from({ length: REPLICAS }, (_, i) => ({
    i, queue: [], cur: null, runFrom: 0, ver: 0, stalled: false, stalledUntil: -1, stallFrom: -1, work: 0, wasted: 0, served: 0,
  }));
  const k = {
    cfg, now: 0, nextId: 1, live: new Map(), done: [], tokens: BUCKET,
    replicas, log: [], keepLog: false,
    // totals
    requests: 0, copies: 0, hedges: 0, skipped: 0, work: 0, wasted: 0, cancelled: 0, abortedWork: 0,
  };
  const note = (e) => { if (k.keepLog) k.log.push(e); };

  const workOf = (heavy) => (heavy ? HEAVY_X * WORK : WORK * Math.exp(SPREAD * normal(r) - (SPREAD * SPREAD) / 2));
  const pick = (not = -1) => { if (not < 0) return Math.floor(r() * REPLICAS); const j = Math.floor(r() * (REPLICAS - 1)); return j >= not ? j + 1 : j; };

  // ---------- the client ----------
  function arrive(t, extra = {}) {
    const heavy = extra.heavy ?? r() < cfg.heavy;
    const q = { id: k.nextId++, born: t, heavy, work: workOf(heavy), copies: [], answered: -1, winner: null, hedged: false };
    k.live.set(q.id, q); k.requests++;
    if (k.cfg.budget) k.tokens = Math.min(BUCKET, k.tokens + k.cfg.budget);
    const first = send(q, t, pick());
    if (k.cfg.mode === "tied") {
      const second = send(q, t + TIED_GAP, pick(first.server));
      first.twin = second; second.twin = first; q.hedged = true; k.hedges++;
    } else if (k.cfg.mode === "hedge") at(t + k.cfg.delay, "hedge", { q });
    note({ t, type: "arrive", q });
    return q;
  }
  function send(q, t, server) {
    const c = { q, n: q.copies.length, server, sent: t, reach: t + NET, state: "transit", left: q.work, did: 0, start: -1, end: -1, dropped: false };
    q.copies.push(c); k.copies++;
    at(c.reach, "reach", { c });
    return c;
  }
  function hedge(t, q) {
    if (q.answered >= 0 || q.copies.length > 1) return;
    if (k.cfg.budget) {
      if (k.tokens < 1) { k.skipped++; note({ t, type: "skip", q }); return; }
      k.tokens -= 1;
    }
    const c = send(q, t, pick(q.copies[0].server));
    q.hedged = true; k.hedges++;
    note({ t, type: "hedge", c });
  }
  function answer(t, c) {
    const q = c.q;
    if (q.answered >= 0) {                  // a loser's answer: nobody wants it, so its work was wasted
      k.wasted += c.did; replicas[c.server].wasted += c.did;
      note({ t, type: "late", c });
      return;
    }
    q.answered = t; q.winner = c;
    k.live.delete(q.id); k.done.push(q);
    note({ t, type: "answer", c });
    if (k.cfg.cancel) for (const o of q.copies) if (o !== c && o.state !== "done" && o.state !== "gone") at(t + NET, "cancel", { c: o, any: true });
  }

  // ---------- the replicas ----------
  function startNext(s, t) {
    if (s.cur || s.stalled) return;
    while (s.queue.length) {
      const c = s.queue.shift();
      if (c.state !== "queued") continue;
      c.state = "run"; c.start = t; s.cur = c; s.runFrom = t;
      at(t + c.left, "finish", { s, c, ver: ++s.ver });
      note({ t, type: "start", c });
      // Tied: tell the twin's replica to drop its copy if it hasn't started.
      if (c.twin && c.twin.state !== "done" && c.twin.state !== "gone") at(t + NET, "cancel", { c: c.twin, any: false });
      return;
    }
  }
  function settle(s, t) { if (s.cur && !s.stalled) { const d = t - s.runFrom; s.cur.left -= d; s.cur.did += d; s.runFrom = t; } }
  function finish(t, s, c) {
    settle(s, t);
    c.state = "done"; c.end = t; c.left = 0; s.cur = null; s.served++;
    s.work += c.did; k.work += c.did;
    note({ t, type: "finish", c, late: c.q.answered >= 0 });
    at(t + NET, "answer", { c });
    startNext(s, t);
  }
  function cancel(t, c, any) {
    if (c.state === "transit") { c.dropped = true; return; }
    if (c.state === "queued") {
      c.state = "gone"; k.cancelled++;
      const s = replicas[c.server]; s.queue.splice(s.queue.indexOf(c), 1);
      note({ t, type: "cancel", c, from: "queue" });
      return;
    }
    if (c.state === "run" && any) {
      const s = replicas[c.server];
      settle(s, t);
      c.state = "gone"; c.end = t; s.cur = null; s.ver++; k.cancelled++;
      s.work += c.did; s.wasted += c.did; k.work += c.did; k.wasted += c.did; k.abortedWork += c.did;
      note({ t, type: "cancel", c, from: "run" });
      startNext(s, t);
    }
  }
  function reach(t, c) {
    if (c.dropped) { c.state = "gone"; k.cancelled++; note({ t, type: "drop", c }); return; }
    c.state = "queued";
    const s = replicas[c.server];
    s.queue.push(c);
    note({ t, type: "queue", c });
    startNext(s, t);
  }
  function stall(t, s, dur) {
    if (s.stalled) return;
    settle(s, t);
    s.stalled = true; s.stallFrom = t; s.stalledUntil = t + dur; s.ver++;
    at(t + dur, "unstall", { s });
    note({ t, type: "stall", s, dur });
  }
  function unstall(t, s) {
    if (!s.stalled || t < s.stalledUntil) return;
    s.stalled = false; s.runFrom = t;
    if (s.cur) at(t + s.cur.left, "finish", { s, c: s.cur, ver: ++s.ver });
    note({ t, type: "unstall", s });
    startNext(s, t);
  }

  // ---------- the clock ----------
  let nextArrival = exponential(r, 1 / rateFor(cfg.load));
  if (cfg.stalls) for (const s of replicas) at(exponential(r, STALL_EVERY), "stall", { s, auto: true });
  function runTo(T) {
    for (;;) {
      const e = heap.peek();
      const tA = nextArrival;
      if ((!e || e.t > T) && tA > T) break;
      if (tA <= (e ? e.t : Infinity)) {
        k.now = tA; arrive(tA);
        nextArrival = tA + exponential(r, 1 / rateFor(k.cfg.load));
        continue;
      }
      heap.pop();
      k.now = e.t;
      if (e.type === "reach") reach(e.t, e.c);
      else if (e.type === "finish") { if (e.ver === e.s.ver && e.s.cur === e.c) finish(e.t, e.s, e.c); }
      else if (e.type === "answer") answer(e.t, e.c);
      else if (e.type === "hedge") hedge(e.t, e.q);
      else if (e.type === "cancel") cancel(e.t, e.c, e.any);
      else if (e.type === "stall") {
        if (k.cfg.stalls) stall(e.t, e.s, STALL[0] + (STALL[1] - STALL[0]) * r());
        if (e.auto) at(e.t + exponential(r, STALL_EVERY), "stall", { s: e.s, auto: true });
      }
      else if (e.type === "unstall") unstall(e.t, e.s);
    }
    k.now = T;
  }
  k.runTo = runTo;
  k.stall = (i, dur = 100) => stall(k.now, replicas[i], dur);
  k.set = (changes) => {
    const rate = k.cfg.load;
    Object.assign(k.cfg, changes);
    if (k.cfg.load !== rate) nextArrival = k.now + exponential(r, 1 / rateFor(k.cfg.load));
  };
  return k;
}

// ---------- measuring ----------
// Run `ms` of traffic after `warm` ms of warm-up; latency of every request born after the warm-up, from when the client
// created it to when its first answer arrived.
export function measure(cfg, seed, { ms = 60000, warm = 3000 } = {}) {
  const k = makeKitchen(cfg, seed);
  k.runTo(warm);
  const w0 = k.work, x0 = k.wasted, h0 = k.hedges, q0 = k.requests, s0 = k.skipped;
  const from = k.done.length;
  k.runTo(warm + ms);
  const lat = [], heavy = [], light = [], plain = [];
  for (const q of k.done.slice(from)) if (q.born >= warm) {
    const ms = q.answered - q.born;
    lat.push(ms); (q.heavy ? heavy : light).push(ms);
    if (!q.hedged) plain.push(ms);
  }
  let open = 0;
  for (const q of k.live.values()) if (q.born >= warm && q.born < warm + ms - 2000) open++;
  const requests = k.requests - q0, work = k.work - w0, wasted = k.wasted - x0;
  return {
    p50: rankQuantile(lat, 0.5), p95: rankQuantile(lat, 0.95), p99: rankQuantile(lat, 0.99), p999: rankQuantile(lat, 0.999),
    heavyP50: rankQuantile(heavy, 0.5), lightP99: rankQuantile(light, 0.99),   // heavy requests' median; the others' p99
    plainP99: rankQuantile(plain, 0.99),                                         // p99 of requests that never got a copy
    copies: (k.hedges - h0) / requests,             // share of requests that got a second copy (tied: all)
    extra: wasted / Math.max(1e-9, work - wasted),  // work spent on losers, as a share of the useful work
    busy: work / (REPLICAS * ms),                   // how busy the replicas were
    skipped: (k.skipped - s0) / requests,
    stuck: open,                                    // requests still unanswered 2 s after they were born
  };
}

export const SEEDS = [3, 7, 11, 19, 23, 31];
const memo = new Map();
export function average(cfg, run) {
  const c = { ...DEFAULTS, ...cfg };
  if (c.mode !== "hedge") { c.delay = 0; c.budget = 0; }   // settings that change nothing share a run
  const key = JSON.stringify([c, run]);
  if (!memo.has(key)) memo.set(key, averageOver(SEEDS, (seed) => measure(cfg, seed, run)));
  return memo.get(key);
}

// The hedge delay the lesson calls "the p95": the p95 latency of the healthy kitchen (stalls on, no hedging), averaged.
export const p95Delay = () => Math.round(average({ ...DEFAULTS }).p95);

// ---------- the five experiments (run at build time) ----------
export function experimentResults(P95 = p95Delay()) {
  const base = { ...DEFAULTS, delay: P95 };
  const hedged = { ...base, mode: "hedge" }, cancelled = { ...hedged, cancel: true };
  return {
    P95,
    // 1. Hedge sooner: after the p95 vs after 1 ms; the loser runs to the end.
    soon: { off: average(base), p95: average(hedged), now: average({ ...hedged, delay: 1 }) },
    // 2. Cancel the loser.
    cancel: { keep: average(hedged), cancel: average(cancelled) },
    // 3. The slowness is in the request: no stalls, 1 request in 50 is heavy.
    heavy: { off: average({ ...base, stalls: false, heavy: 0.02 }), on: average({ ...cancelled, stalls: false, heavy: 0.02 }) },
    // 4. A load spike to 90% busy, the hedge delay still at the healthy p95: no budget vs a 5% budget.
    budget: { off: average({ ...base, load: 0.9 }), on: average({ ...cancelled, load: 0.9 }), capped: average({ ...cancelled, load: 0.9, budget: 0.05 }) },
    // 5. Tied requests vs a hedge at the p95.
    tied: { off: average(base), hedge: average(cancelled), tied: average({ ...base, mode: "tied", cancel: true }) },
  };
}

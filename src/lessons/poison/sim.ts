// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// One ordered partition and the worker that reads it. Event-driven and seeded, shared by the live figure and the
// experiments. Times are seconds; the numbers are illustrative and round (a real consumer handles a message in
// milliseconds, so think of every time here as scaled up together).
//
// Messages arrive on one line (a Kafka partition, an SQS FIFO message group): each carries a customer key (A–D) and
// that customer's version number (the producer counts 1, 2, 3… per customer). The worker reads the line in order and
// only moves on, committing its offset, once the message at the head is done with. Every message is a call to a
// downstream service that stores each customer's record (the latest version it was sent).
//
// A call fails when the message is malformed (it fails every time: a permanent error), when downstream is down (an
// outage), or at random while downstream is flaky. Failed calls come back fast.
//
// cfg:
//   rate      messages arriving per second (Poisson)
//   flaky     chance a call fails for no lasting reason (a timeout, a 503)
//   bad       chance a new message is malformed
//   attempts  attempts before a message goes to the dead-letter queue (Infinity: retry forever)
//   mode      "inplace" the head is retried where it is, after a backoff: nothing behind it moves meanwhile
//             "topic"   a failed message is moved to a retry topic with a delay and the line moves on; a retry worker
//                       takes it again when its delay is up
//   parse     "retry"   a malformed message is retried like any other failure
//             "dlq"     it is recognised as permanent and goes to the dead-letter queue on the first failure
//   stale     "apply"   the handler writes whatever version it gets
//             "skip"    it checks versions and skips an update older than the record
//   script    [{ t, type: "poison" | "outage" | "redrive", secs? }] things that happen at set times

import { rng } from "../../lib/random";
import { averageOver } from "../../lib/stats";

export const SERVICE = [0.6, 0.8];          // a call that works: 0.6 to 1.4 s, 1 s on average
export const FAIL_SECS = 0.3;               // a call that fails comes back in 0.3 s
export const BACKOFF = { base: 1, cap: 16 };// wait 1 s after the first failure, doubling up to 16 s
export const OUTAGE = 30;                   // seconds downstream is down after "outage"
export const KEYS = 4;
export const DEFAULTS = { rate: 0.6, flaky: 0, bad: 0, attempts: 3, mode: "inplace", parse: "retry", stale: "apply", script: [] };

/** Seconds to wait after the k-th failed attempt (k = 1, 2, …). */
export const backoff = (k) => Math.min(BACKOFF.cap, BACKOFF.base * 2 ** (k - 1));
/** How long a message can keep failing before attempt n starts: the sum of the waits before it. */
export const window = (n) => { let s = 0; for (let k = 1; k < n; k++) s += backoff(k); return s; };

export function makeSim(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rArr = rng(seed * 2654435761 + 11), rSvc = rng(seed * 40503 + 7);
  let t = 0, nextId = 1;
  let nextArrival = cfg.rate > 0 ? -Math.log(1 - rArr()) / cfg.rate : Infinity;
  const script = [...cfg.script].sort((a, b) => a.t - b.t);

  const line = [];                                  // the partition from the committed offset on: head first
  const shelf = [];                                 // the retry topic: { m, due }
  const dlq = [];                                   // the dead-letter queue
  const downs = [];                                 // outages: [from, to]
  const records = Array.from({ length: KEYS }, () => ({ v: 0, max: 0, backAt: -99, wrote: -99 }));
  const sent = Array(KEYS).fill(0);                 // the producer's last version per customer
  const worker = { m: null, phase: "idle", end: 0, ok: false, why: "", started: 0, retry: false };
  const rworker = { m: null, phase: "idle", end: 0, ok: false, why: "", started: 0, retry: true };
  const log = [];
  const st = { arrived: 0, done: 0, attempts: 0, retries: 0, dead: 0, deadGood: 0, deadBad: 0, stale: 0, skipped: 0, gaps: 0, redriven: 0, redriveOld: 0, maxLag: 0, maxWait: 0, doneAfter: [] };

  const isDown = (at) => downs.some(([a, b]) => at >= a && at < b);
  const downUntil = (at) => { let u = -1; for (const [a, b] of downs) if (at >= a && at < b) u = Math.max(u, b); return u; };

  function arrive(at, extra = {}) {
    const key = Math.floor(rArr() * KEYS), badDraw = rArr();
    const k = extra.key ?? key;
    const m = { id: nextId++, key: k, v: ++sent[k], bad: extra.bad ?? badDraw < cfg.bad, born: at, tries: 0, redriven: false };
    st.arrived++;
    line.push(m);
    if (line.length > st.maxLag) st.maxLag = line.length;
    if (m.bad) log.push({ t: at, type: "badIn", m });
    return m;
  }

  function start(w, m, at) {
    m.tries++; st.attempts++; if (m.tries > 1) st.retries++;
    const svc = SERVICE[0] + SERVICE[1] * rSvc(), flake = rSvc();
    let why = "";
    if (m.bad) why = "parse";
    else if (isDown(at)) why = "down";
    else if (flake < cfg.flaky) why = "flaky";
    w.m = m; w.phase = "work"; w.started = at; w.ok = !why; w.why = why;
    w.end = at + (why ? FAIL_SECS : svc);
  }

  function apply(m, at, by) {
    const r = records[m.key];
    st.done++;
    st.doneAfter.push([at, m.key]);
    // older than the newest version this record has ever held: the customer's later update got here first
    if (m.v < r.max) {
      if (m.redriven) st.redriveOld++;
      if (cfg.stale === "skip") { st.skipped++; log.push({ t: at, type: "skip", m, had: r.v, by }); return; }
      st.stale++; log.push({ t: at, type: "back", m, had: r.v, by });
      r.v = m.v; r.backAt = at; r.wrote = at;
      return;
    }
    if (m.v > r.max + 1) { st.gaps++; log.push({ t: at, type: "gap", m, had: r.v, by }); }
    else log.push({ t: at, type: "ok", m, by });
    r.v = m.v; r.max = m.v; r.wrote = at;
  }

  function toDead(m, at, why) {
    st.dead++; if (m.bad) st.deadBad++; else st.deadGood++;
    dlq.push(m);
    log.push({ t: at, type: "dead", m, why });
  }

  function finish(w) {
    const at = w.end, m = w.m;
    if (w.ok) {
      apply(m, at, w.retry ? "retry" : "main");
      if (!w.retry) line.shift();
      w.m = null; w.phase = "idle";
      return;
    }
    log.push({ t: at, type: "fail", m, why: w.why, retry: w.retry });
    const permanent = w.why === "parse";
    if ((permanent && cfg.parse === "dlq") || m.tries >= cfg.attempts) {
      toDead(m, at, permanent && cfg.parse === "dlq" ? "permanent" : "attempts");
      if (!w.retry) line.shift();
      w.m = null; w.phase = "idle";
      return;
    }
    const wait = backoff(m.tries);
    if (cfg.mode === "inplace" && !w.retry) {
      w.phase = "wait"; w.end = at + wait;
      log.push({ t: at, type: "wait", m, wait });
      return;
    }
    // retry topic: park it on the shelf with its delay; the line commits past it and moves on
    shelf.push({ m, due: at + wait, since: at });
    log.push({ t: at, type: "shelf", m, wait });
    if (!w.retry) line.shift();
    w.m = null; w.phase = "idle";
  }

  function dispatch(at) {
    if (worker.phase === "idle" && line.length) start(worker, line[0], at);
    if (rworker.phase === "idle" && shelf.length) {
      let best = -1;
      for (let i = 0; i < shelf.length; i++) if (shelf[i].due <= at && (best < 0 || shelf[i].due < shelf[best].due)) best = i;
      if (best >= 0) { const { m } = shelf.splice(best, 1)[0]; start(rworker, m, at); }
    }
  }

  function redrive(at) {
    const n = dlq.length;
    for (const m of dlq.splice(0)) { m.tries = 0; m.redriven = true; m.born = at; st.redriven++; line.push(m); }
    if (line.length > st.maxLag) st.maxLag = line.length;
    log.push({ t: at, type: "redrive", n });
    return n;
  }
  function outage(at, secs = OUTAGE) { downs.push([at, at + secs]); log.push({ t: at, type: "down", secs }); }
  function poison(at, key = 0) { const m = arrive(at, { bad: true, key }); return m; }

  function next() {
    let when = nextArrival, what = "arrive", who = null;
    if (script.length && script[0].t < when) { when = script[0].t; what = "script"; }
    for (const w of [worker, rworker]) if (w.phase !== "idle" && w.end < when) { when = w.end; what = "worker"; who = w; }
    if (rworker.phase === "idle") for (const s of shelf) if (s.due < when) { when = s.due; what = "due"; }
    for (const [, b] of downs) if (b > t && b < when) { when = b; what = "up"; }
    return { when, what, who };
  }

  function runTo(until) {
    for (;;) {
      const e = next();
      if (e.when > until) break;
      t = e.when;
      if (e.what === "arrive") { arrive(t); nextArrival = t - Math.log(1 - rArr()) / cfg.rate; }
      else if (e.what === "script") {
        const s = script.shift();
        if (s.type === "poison") poison(t, s.key ?? 0);
        else if (s.type === "outage") outage(t, s.secs ?? OUTAGE);
        else if (s.type === "redrive") redrive(t);
      } else if (e.what === "worker") {
        const w = e.who;
        if (w.phase === "wait") start(w, w.m, t);
        else finish(w);
      } else if (e.what === "up") log.push({ t, type: "up" });
      dispatch(t);
      if (line.length && t - line[0].born > st.maxWait) st.maxWait = t - line[0].born;
    }
    t = until;
    dispatch(t);
    if (line.length && t - line[0].born > st.maxWait) st.maxWait = t - line[0].born;
  }

  return {
    cfg, line, shelf, dlq, records, sent, worker, rworker, log, st, runTo,
    redrive: (at) => { runTo(at); const n = redrive(at); dispatch(at); return n; },
    outage: (at, secs) => { runTo(at); outage(at, secs); },
    poison: (at, key = 0) => { runTo(at); const m = poison(at, key); dispatch(at); return m; },
    get t() { return t; },
    isDown: () => isDown(t),
    downUntil: () => downUntil(t),
    oldestWait: () => (line.length ? t - line[0].born : 0),
  };
}

// ---------- experiments: headless runs averaged over seeds ----------
export const SEEDS = [3, 7, 11, 19, 23, 31, 43, 59];
const avg = (fn) => averageOver(SEEDS, fn);
const run = (cfg, seed, secs) => { const m = makeSim(cfg, seed); m.runTo(secs); return m; };

// 1. One malformed message for customer A at 20 s: retry forever in place vs 3 attempts. Two minutes later.
export const FOREVER = { at: 20, end: 140 };
export function foreverRun() {
  const one = (attempts) => avg((seed) => {
    const m = run({ attempts, script: [{ t: FOREVER.at, type: "poison", key: 0 }] }, seed, FOREVER.end);
    const others = m.st.doneAfter.filter(([at, key]) => at > FOREVER.at + 5 && key !== 0).length;
    return { lag: m.line.length, wait: m.oldestWait(), others, dead: m.st.dead, attempts: m.st.attempts - m.st.done };
  });
  return { forever: one(Infinity), three: one(3) };
}

// 2. Downstream is down for 30 s, 3 attempts: what lands in the DLQ.
export const OUT = { at: 30, end: 150 };
export function outageRun() {
  return avg((seed) => {
    const m = makeSim({ attempts: 3, script: [{ t: OUT.at, type: "outage" }] }, seed);
    m.runTo(OUT.at);
    const before = m.st.arrived;
    m.runTo(OUT.at + OUTAGE);
    const during = m.st.arrived - before;
    m.runTo(OUT.end);
    return { good: m.st.deadGood, bad: m.st.deadBad, during, maxLag: m.st.maxLag, lag: m.line.length, gaps: m.st.gaps };
  });
}

// 3. Six minutes with a 30 s outage at 1 min and a malformed message at 3 min: 3 attempts, 8 attempts, 8 attempts
//    with malformed messages sent straight to the DLQ.
export const BUDGET = { end: 360, outage: 60, bad: [180] };
export function budgetRun() {
  const script = [{ t: BUDGET.outage, type: "outage" }, ...BUDGET.bad.map((t) => ({ t, type: "poison", key: 0 }))];
  const one = (attempts, parse) => avg((seed) => {
    const m = makeSim({ attempts, parse, script }, seed);
    let outWait = 0, badWait = 0, outLag = 0, badLag = 0;
    for (let at = 0.5; at <= BUDGET.end; at += 0.5) {
      m.runTo(at);
      const w = m.oldestWait(), n = m.line.length;
      if (at < BUDGET.bad[0]) { outWait = Math.max(outWait, w); outLag = Math.max(outLag, n); }
      else { badWait = Math.max(badWait, w); badLag = Math.max(badLag, n); }
    }
    return { good: m.st.deadGood, bad: m.st.deadBad, outWait, badWait, outLag, badLag };
  });
  return { three: one(3, "retry"), eight: one(8, "retry"), split: one(8, "dlq") };
}

// 4. Downstream fails 1 call in 5 at random, 0.8 messages a second: retry in place vs a retry topic. Five minutes.
export const TOPIC = { rate: 0.8, flaky: 0.2, end: 300 };
export function topicRun() {
  const one = (mode) => avg((seed) => {
    const m = makeSim({ rate: TOPIC.rate, flaky: TOPIC.flaky, attempts: 3, mode }, seed);
    m.runTo(TOPIC.end - 60);
    const before = m.line.length;
    m.runTo(TOPIC.end);
    return { before, lag: m.line.length, maxWait: m.st.maxWait, stale: m.st.stale, dead: m.st.dead, done: m.st.done };
  });
  return { inplace: one("inplace"), topic: one("topic") };
}

// 5. After the outage of experiment 2, redrive the DLQ at 2 min: apply every version vs skip older ones.
export const REDRIVE = { outage: 30, at: 120, look: 10, end: 200 };
export function redriveRun() {
  const one = (stale) => avg((seed) => {
    const m = makeSim({ attempts: 3, stale, script: [{ t: REDRIVE.outage, type: "outage" }, { t: REDRIVE.at, type: "redrive" }] }, seed);
    m.runTo(REDRIVE.at + REDRIVE.look);
    const behind = m.records.filter((r) => r.v < r.max).length;
    m.runTo(REDRIVE.end);
    return { redriven: m.st.redriven, old: m.st.redriveOld, stale: m.st.stale, skipped: m.st.skipped, behind };
  });
  return { apply: one("apply"), skip: one("skip") };
}

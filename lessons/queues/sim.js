// A work queue: producers append parcels at the back, clerks take them from the front.
// Event-driven and seeded, shared by the live figure and the experiments.
//
// cfg:
//   rate       parcels per second arriving (Poisson)
//   clerks     how many consumers (1..4)
//   service    mean seconds of work per parcel (each one 0.5..1.5 × mean)
//   crash      chance a clerk collapses during an attempt (half during the work, half after it, before the stamp)
//   ackFirst   stamp the ack when the parcel is picked up, not after the work
//   dedupe     the handler remembers parcel ids: a repeat does no harm
//   poison     chance a new parcel can never be processed (the handler always fails)
//   maxTries   attempts before a parcel goes to the dead-letter cage (Infinity = retry forever)
//   visibility seconds a taken parcel stays hidden before it reappears if nobody stamped it
//   order      "any" (free clerks take the next parcel) | "strict" (one parcel out at a time, global order)
//              | "key" (one parcel out per customer key; a clerk may reach past a blocked key)
//   keys       customer keys (A, B, C, D)
//   cap        lane capacity; a parcel that doesn't fit is turned away (Infinity = no limit)
//   recover    seconds a collapsed clerk is down

export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export const DEFAULTS = { rate: 0.8, clerks: 3, service: 3, crash: 0.1, ackFirst: false, dedupe: false, poison: 0.02, maxTries: 3, visibility: 6, order: "any", keys: 4, cap: Infinity, recover: 3 };

export function makeQueue(cfgIn, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rnd = makeRng(seed);
  const exp = (rate) => -Math.log(1 - rnd()) / rate;
  let t = 0, nextId = 1;
  let nextArrival = cfg.rate > 0 ? exp(cfg.rate) : Infinity;
  const queue = [];                  // parcels waiting, front first
  const hold = [];                   // { p, visibleAt }: taken, not stamped, hidden until the timeout
  const clerks = Array.from({ length: cfg.clerks }, (_, i) => ({ i, p: null, start: 0, end: 0, fate: "ok", downUntil: -1 }));
  const dead = [], rejected = [], log = [];
  const doneIds = new Set();
  const out = new Set();             // keys with a parcel out (being worked or hidden)
  const st = { arrived: 0, done: 0, executions: 0, twice: 0, harmful: 0, redelivered: 0, lost: 0, rejectedN: 0, deadN: 0, poisonTries: 0, maxLen: 0, waits: [], waitSum: 0, waitN: 0, maxWait: 0 };

  const keyOf = () => Math.floor(rnd() * cfg.keys);
  const svcOf = (p) => (p.slow ? p.slow : cfg.service * (0.5 + rnd()));

  function enqueue(p, front = false) {
    if (front) queue.unshift(p); else queue.push(p);
    if (queue.length > st.maxLen) st.maxLen = queue.length;
  }

  function arrive(at, extra = {}) {
    const p = { id: nextId++, key: keyOf(), poison: rnd() < cfg.poison, born: at, tries: 0, picked: -1, ...extra };
    st.arrived++;
    enqueue(p);
    log.push({ t: at, type: "arrive", id: p.id });
    dispatch(at);
    while (queue.length > cfg.cap) {
      const r = queue.pop();
      st.rejectedN++; rejected.push({ p: r, t: at });
      log.push({ t: at, type: "reject", id: r.id });
    }
    return p;
  }

  function pickIndex() {
    if (!queue.length) return -1;
    if (cfg.order === "any") return 0;
    if (cfg.order === "strict") return out.size || hold.length || clerks.some((c) => c.p) ? -1 : 0;
    for (let i = 0; i < queue.length; i++) if (!out.has(queue[i].key)) return i;
    return -1;
  }

  function dispatch(at) {
    for (const c of clerks) {
      if (c.p || c.downUntil > at) continue;
      const i = pickIndex();
      if (i < 0) return;
      const p = queue.splice(i, 1)[0];
      p.tries++;
      if (p.picked < 0) {
        p.picked = at;
        const w = at - p.born;
        st.waitSum += w; st.waitN++; if (w > st.maxWait) st.maxWait = w;
        st.waits.push([at, w, p.key, p.id]);
      }
      if (p.tries > 1) st.redelivered++;
      if (p.poison) st.poisonTries++;
      c.p = p; c.start = at; c.end = at + svcOf(p);
      c.fate = p.poison ? "fail" : rnd() < cfg.crash ? (rnd() < 0.5 ? "crash-during" : "crash-after") : "ok";
      if (cfg.ackFirst) { c.acked = true; log.push({ t: at, type: "ack", id: p.id, clerk: c.i }); } else c.acked = false;
      out.add(p.key);
      log.push({ t: at, type: "take", id: p.id, clerk: c.i });
    }
  }

  function workDone(p) {
    st.executions++;
    if (doneIds.has(p.id)) { st.twice++; if (!cfg.dedupe) st.harmful++; }
    else { doneIds.add(p.id); st.done++; }
  }

  function release(p) { out.delete(p.key); }

  function finish(c) {
    const at = c.end, p = c.p, fate = c.fate;
    c.p = null;
    if (fate === "ok") {
      workDone(p);
      if (!c.acked) log.push({ t: at, type: "ack", id: p.id, clerk: c.i });
      release(p);
    } else if (fate === "crash-after" || fate === "crash-during") {
      if (fate === "crash-after") workDone(p);
      c.downUntil = at + cfg.recover;
      log.push({ t: at, type: "crash", id: p.id, clerk: c.i, after: fate === "crash-after" });
      if (c.acked) {
        if (fate === "crash-during") { st.lost++; log.push({ t: at, type: "lost", id: p.id }); }
        release(p);
      } else hide(p, at);
    } else {
      log.push({ t: at, type: "fail", id: p.id, clerk: c.i });
      if (c.acked) release(p); else hide(p, at);
    }
  }

  function hide(p, at) {
    if (p.tries >= cfg.maxTries) {
      st.deadN++; dead.push(p); release(p);
      log.push({ t: at, type: "dead", id: p.id });
      return;
    }
    hold.push({ p, visibleAt: at + cfg.visibility, since: at });
    log.push({ t: at, type: "hide", id: p.id });
  }

  function step() {
    // The earliest of: an arrival, a clerk finishing, a clerk getting up, a hidden parcel reappearing.
    let when = nextArrival, what = "arrive", who = null;
    for (const c of clerks) {
      if (c.p && c.end < when) { when = c.end; what = "finish"; who = c; }
      if (!c.p && c.downUntil > t && c.downUntil < when) { when = c.downUntil; what = "up"; who = c; }
    }
    for (const h of hold) if (h.visibleAt < when) { when = h.visibleAt; what = "show"; who = h; }
    return { when, what, who };
  }

  function runTo(until) {
    for (;;) {
      const e = step();
      if (e.when > until) break;
      t = e.when;
      if (e.what === "arrive") { arrive(t); nextArrival = t + exp(cfg.rate); }
      else if (e.what === "finish") finish(e.who);
      else if (e.what === "show") {
        hold.splice(hold.indexOf(e.who), 1);
        release(e.who.p);
        enqueue(e.who.p, true);
        log.push({ t, type: "show", id: e.who.p.id });
      }
      dispatch(t);
    }
    t = until;
    dispatch(t);
  }

  // A burst of parcels dropped in at once (a batch job, a retry wave).
  function burst(at, n) { runTo(at); for (let i = 0; i < n; i++) arrive(at); }
  // One parcel that takes `secs` to process, for customer `key`.
  function slowOne(at, secs, key = 0) { runTo(at); return arrive(at, { slow: secs, key, poison: false }); }

  return {
    cfg, queue, hold, clerks, dead, rejected, log, st, runTo, burst, slowOne,
    get t() { return t; },
    oldestWait() { return queue.length ? t - Math.min(...queue.map((p) => p.born)) : 0; },
  };
}

// ---------- experiments: headless runs averaged over seeds ----------
const SEEDS = [11, 23, 37, 41, 59, 67, 73, 89];
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
function avg(fn) {
  const rs = SEEDS.map(fn);
  const keys = Object.keys(rs[0]);
  return Object.fromEntries(keys.map((key) => [key, mean(rs.map((r) => r[key]))]));
}

// 1. Arrivals just above what the clerks can do: 10/s against 9/s, for 5 minutes (and 8/s for contrast).
export function overload() {
  const run = (rate) => avg((seed) => {
    const m = makeQueue({ rate, clerks: 3, service: 1 / 3, crash: 0, poison: 0 }, seed);
    m.runTo(300);
    return { len: m.queue.length, wait: m.oldestWait(), done: m.st.done };
  });
  return { under: run(8), over: run(10) };
}

// 2. A burst of 200 on a quiet 5/s stream, with a queue vs with nowhere to wait.
export function burstRun() {
  const run = (cap) => avg((seed) => {
    const m = makeQueue({ rate: 5, clerks: 3, service: 1 / 3, crash: 0, poison: 0, cap }, seed);
    m.runTo(10);
    const before = m.st.rejectedN;
    m.burst(10, 200);
    const turned = m.st.rejectedN - before;
    m.runTo(10.001);
    const peak = m.queue.length;
    let drained = NaN;
    for (let s = 11; s <= 200; s += 0.5) { m.runTo(s); if (m.queue.length <= 3) { drained = s - 10; break; } }
    m.runTo(200);
    return { peak, drained, rejected: turned, done: m.st.done, maxWait: m.st.maxWait };
  });
  return { queued: run(Infinity), none: run(0) };
}

// 3. Clerks collapse 1 time in 10: stamp after the work vs stamp first, and an idempotent handler.
export function crashRun() {
  const run = (ackFirst, dedupe) => avg((seed) => {
    const m = makeQueue({ rate: 0.8, clerks: 3, service: 3, crash: 0.1, poison: 0, ackFirst, dedupe, maxTries: Infinity }, seed);
    m.runTo(300);
    m.cfg.rate = 0;
    m.runTo(360);
    return { arrived: m.st.arrived, done: m.st.done, twice: m.st.twice, harmful: m.st.harmful, lost: m.st.lost };
  });
  return { after: run(false, false), first: run(true, false), idem: run(false, true) };
}

// 4. One parcel in 50 can never be processed: retry forever vs 3 tries then the dead-letter cage.
export function poisonRun() {
  const run = (maxTries) => avg((seed) => {
    const m = makeQueue({ rate: 2, clerks: 4, service: 1.5, crash: 0, poison: 0.02, maxTries, visibility: 6 }, seed);
    m.runTo(300);
    return { len: m.queue.length, wait: m.oldestWait(), done: m.st.done, poisonTries: m.st.poisonTries, dead: m.st.deadN };
  });
  return { forever: run(Infinity), dlq: run(3) };
}

// 5. One 30 s parcel for customer A: one global order vs one order per customer.
export function holRun() {
  const run = (order) => avg((seed) => {
    const m = makeQueue({ rate: 1.5, clerks: 3, service: 0.4, crash: 0, poison: 0, order, keys: 4 }, seed);
    m.runTo(10);
    m.slowOne(10, 30, 0);
    m.runTo(90);
    const others = m.st.waits.filter(([at, , key]) => at >= 10 && key !== 0).map(([, w]) => w);
    const sameKey = m.st.waits.filter(([at, , key]) => at >= 10 && key === 0).map(([, w]) => w);
    return { others: Math.max(0, ...others), same: Math.max(0, ...sameKey), peak: m.st.maxLen };
  });
  return { strict: run("strict"), key: run("key") };
}

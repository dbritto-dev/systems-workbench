// Idempotency keys: customers pay at a counter over a lossy line, and retry when no reply comes back.
// The server can remember each key's result (and hold an in-progress marker) so a retry is answered
// from the stored receipt instead of charging the card again. Seeded and deterministic; shared by the
// live figure and the headless experiments.

export const CUSTOMERS = 4;
export const REQ_TIME = 0.8;          // request travel, customer → counter
export const REP_TIME = 0.8;          // reply travel, counter → customer
export const PROC = [1.2, 2.4];       // charging the card takes this long
export const MAX_TRIES = 5;
export const TIMEOUTS = { patient: 5, impatient: 1 };
export const BACKOFF = { patient: 1, impatient: 0.5 };
export const LIFETIMES = { long: 86400, short: 8 };
export const THINK = [1, 3];          // time between a customer's purchases
export const AMOUNTS = [12, 18, 25, 40, 55, 70];
export const SLOTS = 30;              // pigeonholes on the key rack (the live figure shows the newest keys)

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// cfg: { keys: "off" | "store" | "lock", lifetime: "long" | "short", loss: 0..1, timeout: "patient" | "impatient", drift: 0..1 }
export function makeSim(cfg, seed = 1) {
  const rand = rng(seed);
  const between = ([a, b]) => a + rand() * (b - a);
  const keys = cfg.keys !== "off", lock = cfg.keys === "lock";
  const ttl = LIFETIMES[cfg.lifetime || "long"];
  const timeout = TIMEOUTS[cfg.timeout || "patient"], backoff = BACKOFF[cfg.timeout || "patient"];

  let now = 0, seq = 0;
  const queue = [];                         // { t, fn } sorted by t
  const at = (t, fn) => { let i = queue.length; while (i > 0 && queue[i - 1].t > t) i--; queue.splice(i, 0, { t, fn, n: seq++ }); };

  const store = new Map();                  // key → { state: "progress" | "done", amount, expires, slot, t }
  const slotOwner = Array(SLOTS).fill(null);
  let nextSlot = 0;
  const purchases = [];                     // { id, client, key, amount, first, tries, done, outcome, charges, amounts }
  const trips = [];                         // for drawing: { kind, client, sent, arrive, lost, status, replay }
  const working = [];                       // charges in progress: { client, key, start, end }
  const log = [];                           // { t, type, ... }
  const customers = Array.from({ length: CUSTOMERS }, (_, c) => ({ c, current: null, n: 0 }));
  const S = { purchases: 0, charges: 0, extra: 0, replays: 0, conflicts: 0, rejected: 0, lost: 0, gaveUp: 0, expiredHits: 0, wrongAmount: 0 };

  function slotFor(key) {
    const e = store.get(key);
    if (e && e.slot != null) return e.slot;
    const s = nextSlot++ % SLOTS;
    slotOwner[s] = key;
    return s;
  }

  function startPurchase(cu, t) {
    if (cu.current) return;                 // already paying; the next purchase is scheduled when this one ends
    const p = { id: purchases.length, client: cu.c, key: "k" + cu.c + "-" + (++cu.n), amount: AMOUNTS[Math.floor(rand() * AMOUNTS.length)], first: t, tries: 0, latest: 0, answered: {}, done: false, outcome: null, charges: 0, charged: [] };
    purchases.push(p); cu.current = p; S.purchases++;
    send(p, t);
  }

  function finish(p, t, outcome) {
    if (p.done) return;
    p.done = true; p.outcome = outcome; p.end = t;
    const cu = customers[p.client];
    if (cu.current === p) { cu.current = null; at(t + between(THINK), (tt) => startPurchase(cu, tt)); }
  }

  function send(p, t, { again = false } = {}) {
    if (p.done) return;
    if (p.tries > 0 && !again && rand() < (cfg.drift || 0)) p.amount = p.amount + 5;   // a buggy client recomputes the total on retry
    const n = ++p.tries; p.latest = n;
    const req = { p, n, amount: p.amount, sent: t };
    trips.push({ kind: "req", client: p.client, sent: t, arrive: t + REQ_TIME, try: n, key: p.key });
    log.push({ t, type: "send", client: p.client, key: p.key, try: n, amount: p.amount });
    at(t + REQ_TIME, (tt) => arrive(req, tt));
    at(t + timeout, (tt) => {               // no answer in time: back off and try again, or give up
      if (p.done || p.answered[n] || p.latest !== n) return;
      if (p.tries >= MAX_TRIES) { S.gaveUp++; finish(p, tt, "gave up"); return; }
      at(tt + backoff * 2 ** (n - 1), (t2) => send(p, t2));
    });
  }

  function reply(req, t, status) {
    const lost = rand() < (cfg.loss || 0);
    if (lost) { S.lost++; log.push({ t, type: "lost", key: req.p.key, client: req.p.client, status }); }
    trips.push({ kind: "rep", client: req.p.client, sent: t, arrive: t + REP_TIME, lost, status, try: req.n, key: req.p.key });
    if (lost) return;
    at(t + REP_TIME, (tt) => {
      const p = req.p;
      p.answered[req.n] = true;
      if (p.done) return;
      if (status === "ok" || status === "replay") finish(p, tt, "paid");
      else if (status === "422") finish(p, tt, "rejected");
      else if (status === "409" && p.latest === req.n) at(tt + backoff * 2 ** (req.n - 1), (t2) => send(p, t2));
    });
  }

  function arrive(req, t) {
    const key = req.p.key;
    if (keys) {
      let e = store.get(key);
      if (e && e.state === "done" && t > e.expires) { store.delete(key); if (slotOwner[e.slot] === key) slotOwner[e.slot] = null; S.expiredHits++; e = null; log.push({ t, type: "expired", key }); }
      if (e && e.state === "done") {
        if (e.amount !== req.amount) { S.rejected++; log.push({ t, type: "422", key, slot: e.slot }); return reply(req, t, "422"); }
        S.replays++; log.push({ t, type: "replay", key, slot: e.slot });
        return reply(req, t, "replay");
      }
      if (e && e.state === "progress") { S.conflicts++; log.push({ t, type: "409", key, slot: e.slot }); return reply(req, t, "409"); }
      if (lock) { const slot = slotFor(key); store.set(key, { state: "progress", slot, t }); }
    }
    charge(req, t);
  }

  function charge(req, t) {
    const end = t + between(PROC);
    const job = { client: req.p.client, key: req.p.key, start: t, end, try: req.n };
    working.push(job);
    at(end, (tt) => {
      working.splice(working.indexOf(job), 1);
      const p = req.p;
      p.charges++; p.charged.push(req.amount); S.charges++;
      if (p.charges > 1) S.extra++;
      if (p.charges > 1 && p.charged[0] !== req.amount) S.wrongAmount++;
      log.push({ t: tt, type: "charge", key: p.key, client: p.client, n: p.charges });
      if (keys) { const slot = slotFor(p.key); store.set(p.key, { state: "done", amount: req.amount, expires: tt + ttl, slot, t: tt }); }
      reply(req, tt, "ok");
    });
  }

  customers.forEach((cu) => at(between([0.2, 3]), (t) => startPurchase(cu, t)));

  return {
    cfg, customers, purchases, trips, working, store, slotOwner, log, stats: S,
    get now() { return now; },
    runTo(t) { while (queue.length && queue[0].t <= t) { const e = queue.shift(); now = e.t; e.fn(e.t); } now = t; },
    // The customer double-clicks Pay: the same request goes out twice at once.
    doubleClick(c, t) {
      const cu = customers[c];
      if (!cu.current) startPurchase(cu, t);
      const p = cu.current;
      send(p, t, { again: true });
    },
    // The rack as it stands at time t: one entry per pigeonhole.
    rack(t) {
      return slotOwner.map((key) => {
        if (!key) return null;
        const e = store.get(key);
        if (!e) return null;
        if (e.state === "done" && t > e.expires) return { key, state: "expired" };
        return { key, state: e.state, age: e.state === "done" ? (t - e.t) / ttl : 0 };
      });
    },
    charged() { return purchases.filter((p) => p.charges > 0).length; },
  };
}

// ---------- headless runs for the experiments ----------
export function runScenario(cfg, { duration = 180, seeds = 8 } = {}) {
  const sum = { purchases: 0, settled: 0, charges: 0, extra: 0, doubled: 0, replays: 0, conflicts: 0, rejected: 0, lost: 0, gaveUp: 0, expiredHits: 0, wrongAmount: 0, retries: 0 };
  for (let s = 0; s < seeds; s++) {
    const m = makeSim(cfg, 1000 + s * 7919);
    m.runTo(duration);
    const done = m.purchases.filter((p) => p.done);
    sum.purchases += done.length;
    sum.settled += done.filter((p) => p.outcome === "paid").length;
    sum.doubled += done.filter((p) => p.charges > 1).length;
    sum.retries += done.reduce((a, p) => a + p.tries - 1, 0);
    for (const k of ["charges", "extra", "replays", "conflicts", "rejected", "lost", "gaveUp", "expiredHits", "wrongAmount"]) sum[k] += m.stats[k];
  }
  for (const k in sum) sum[k] /= seeds;
  return sum;
}

// The customer double-clicks Pay on every purchase: two identical requests leave together.
export function doubleClickRun(cfg, { purchases = 40, seeds = 8 } = {}) {
  let charged = 0, twice = 0, conflicts = 0;
  for (let s = 0; s < seeds; s++) {
    const m = makeSim({ ...cfg, loss: 0 }, 5000 + s * 104729);
    let t = 0, n = 0;
    while (n < purchases) {
      t += 0.05; m.runTo(t);
      const cu = m.customers[0];
      if (cu.current && cu.current.tries === 1 && !cu.current.dbl) { cu.current.dbl = true; m.doubleClick(0, t); n++; }
    }
    m.runTo(t + 30);
    const ps = m.purchases.filter((p) => p.client === 0 && p.dbl);
    charged += ps.length; twice += ps.filter((p) => p.charges > 1).length; conflicts += m.stats.conflicts;
  }
  return { purchases: charged / seeds, twice: twice / seeds, conflicts: conflicts / seeds };
}

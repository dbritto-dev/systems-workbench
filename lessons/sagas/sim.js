// Shared model for the figure and the experiments: trips booked across five services with no shared transaction.
// A trip folder visits the counters in order. If a step fails, a saga runs the undo (compensation) of every
// earlier step, newest first. Times in seconds. Positions are slot numbers: -1 = the door, 0..4 = counters, 5 = exit.
export const ORDERS = {
  standard: ["F", "H", "C", "P", "M"],
  mailFirst: ["M", "F", "H", "C", "P"],
  payFirst: ["P", "F", "H", "C", "M"],
};
export const NAMES = { F: "flight", H: "hotel", C: "car", P: "payment", M: "confirmation email" };
export const BOARDED = { F: true, H: true, C: true };
export const T = { DOOR: 0.7, HOP: 0.6, DROP: 0.35, COURIER: 0.3, COMP: 0.7, BACKOFF: 0.9, STAY: 14 };
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// cfg: { style: "orch"|"choreo"|"none", order, undo: "none"|"retry"|"idem", decline, lost, rate, slots, stopAt }
export function makeSim(cfg = {}, seed = 7) {
  const c = { style: "orch", order: "standard", undo: "idem", decline: 0.2, lost: 0, rate: 0.3, slots: 8, stay: T.STAY, stopAt: Infinity, ...cfg };
  const order = ORDERS[c.order];
  const saga = c.style !== "none";
  const orch = c.style === "orch";
  const random = rng(seed);
  const queue = [];
  const at = (t, fn) => { let i = queue.length; queue.push(null); while (i > 0 && queue[i - 1].t > t) { queue[i] = queue[i - 1]; i--; } queue[i] = { t, fn }; };

  const hooks = { F: Array(c.slots).fill(null), H: Array(c.slots).fill(null), C: Array(c.slots).fill(null) };
  const sim = {
    cfg: c, order, now: 0,
    trips: [],      // { id, t0, keys: [[t, slot, lane]], marks: [[t, +1|-1]], outcome, outcomeAt, compAt, mailed }
    tags: [],       // { svc, hook, trip, from, to }
    receipts: [],   // { trip, from, to }
    letters: [],    // { trip, t }
    couriers: [],   // { from, to, slot, dir: "out"|"back" }
    turned: [],     // { t, svc, holders: [trip ids] } customers turned away because a board was full
    doubles: [],    // { t, svc } an undo that ran twice
    forceDecline: 0,
  };
  let nextId = 0;

  const done = (trip, t, outcome) => { trip.outcome = outcome; trip.outcomeAt = t; };
  const key = (trip, t, slot, lane) => trip.keys.push([t, slot, lane]);
  const mark = (trip, t, d) => trip.marks.push([t, d]);

  function arrive(t) {
    if (t > c.stopAt) return;
    const trip = { id: nextId++, t0: t, keys: [], marks: [], outcome: null, outcomeAt: Infinity, compAt: Infinity, mailed: -1, tags: {}, receipt: null, steps: 0 };
    sim.trips.push(trip);
    key(trip, t, -1, "f");
    at(t + T.DOOR, (te) => atSlot(trip, 0, te));
    at(t - Math.log(1 - random()) / c.rate, arrive);
  }

  function atSlot(trip, i, t) {
    key(trip, t, i, "f");
    const start = t + (orch ? T.COURIER : 0);
    if (orch) sim.couriers.push({ from: t, to: start, slot: i, dir: "out" });
    at(start + 0.8 + 0.5 * random(), (te) => finishStep(trip, i, te));
  }

  function finishStep(trip, i, t) {
    const svc = order[i];
    let ok = true, reason = "";
    if (BOARDED[svc]) {
      const hook = hooks[svc].indexOf(null);
      if (hook < 0) { ok = false; reason = "sold"; }
      else { const tag = { svc, hook, trip: trip.id, from: t, to: Infinity }; hooks[svc][hook] = tag; sim.tags.push(tag); trip.tags[svc] = tag; }
    } else if (svc === "P") {
      if (sim.forceDecline > 0 || random() < c.decline) { if (sim.forceDecline > 0) sim.forceDecline--; ok = false; reason = "declined"; }
      else { trip.receipt = { trip: trip.id, from: t, to: Infinity }; sim.receipts.push(trip.receipt); }
    } else {
      trip.mailed = t; sim.letters.push({ trip: trip.id, t });
    }
    if (!ok) return fail(trip, i, t, reason);
    trip.steps++;
    mark(trip, t, 1);
    const next = t + (orch ? T.COURIER : 0);
    if (orch) sim.couriers.push({ from: t, to: next, slot: i, dir: "back" });
    key(trip, next, i, "f");
    if (i === order.length - 1) {
      const out = next + T.DOOR;
      key(trip, out, 5, "f");
      at(out, (te) => {
        done(trip, te, "done");
        at(te + c.stay, () => { for (const tag of Object.values(trip.tags)) release(tag, te + c.stay); if (trip.receipt && trip.receipt.to === Infinity) trip.receipt.to = te + c.stay; });
      });
    } else at(next + T.HOP, (te) => atSlot(trip, i + 1, te));
  }

  function release(tag, t) {
    if (tag.to !== Infinity) return;
    tag.to = t;
    if (hooks[tag.svc][tag.hook] === tag) hooks[tag.svc][tag.hook] = null;
  }

  function fail(trip, i, t, reason) {
    if (reason === "sold") sim.turned.push({ t, svc: order[i], trip: trip.id, holders: hooks[order[i]].filter(Boolean).map((tag) => tag.trip) });
    trip.failAt = t; trip.failReason = reason; trip.failSlot = i;
    key(trip, t, i, "f");
    if (trip.steps === 0) {                 // nothing booked yet: the customer simply leaves
      key(trip, t + T.DROP, i, "r");
      const out = t + T.DROP + T.HOP * (i + 1);
      key(trip, out, -1, "r");
      at(out, (te) => done(trip, te, "away"));
      return;
    }
    if (!saga) { key(trip, t + T.DROP, i, "s"); done(trip, t, "stuck"); return; }
    trip.compAt = t;
    key(trip, t + T.DROP, i, "r");
    at(t + T.DROP + T.HOP, (te) => compensateAt(trip, i - 1, te));
  }

  function compensateAt(trip, k, t) {
    key(trip, t, k, "r");
    const start = t + (orch ? T.COURIER : 0);
    if (orch) sim.couriers.push({ from: t, to: start, slot: k, dir: "out" });
    attempt(trip, k, start, false);
  }

  // One try at undoing step k. The request can be lost (not executed) or its reply can be lost (executed, unknown).
  function attempt(trip, k, t, executedBefore) {
    at(t + T.COMP, (te) => {
      const svc = order[k];
      if (svc === "M") return undone(trip, k, te);          // a sent email can't be recalled; the saga moves on
      const lost = random() < c.lost;
      const executes = !lost || random() < 0.5;
      let executed = executedBefore;
      if (executes) {
        if (executedBefore && c.undo === "idem") { /* same idempotency key: the service recognises it and does nothing */ }
        else if (executedBefore) undoAgain(svc, trip, te);
        else { undoOnce(svc, trip, te); executed = true; }
      }
      if (!lost) return undone(trip, k, te);
      if (c.undo === "none") { key(trip, te + T.DROP, k, "s"); return done(trip, te, "stuck"); }
      at(te + T.BACKOFF, (tr) => attempt(trip, k, tr, executed));
    });
  }

  function undoOnce(svc, trip, t) {
    if (BOARDED[svc]) release(trip.tags[svc], t);
    else if (svc === "P" && trip.receipt) trip.receipt.to = t;
  }
  // A non-idempotent undo that runs a second time: it releases someone else's booking, or refunds twice.
  function undoAgain(svc, trip, t) {
    sim.doubles.push({ t, svc, trip: trip.id });
    if (BOARDED[svc]) { const other = hooks[svc].filter(Boolean).pop(); if (other) { release(other, t); other.wrongly = t; } }
  }

  function undone(trip, k, t) {
    mark(trip, t, -1);
    const next = t + (orch ? T.COURIER : 0);
    if (orch) sim.couriers.push({ from: t, to: next, slot: k, dir: "back" });
    key(trip, next, k, "r");
    if (k > 0) { at(next + T.HOP, (te) => compensateAt(trip, k - 1, te)); return; }
    const out = next + T.HOP;
    key(trip, out, -1, "r");
    at(out, (te) => done(trip, te, "undone"));
  }

  at(0.05, arrive);

  sim.runTo = (t) => {
    while (queue.length && queue[0].t <= t) { const e = queue.shift(); sim.now = e.t; e.fn(e.t); }
    sim.now = t;
  };
  sim.declineNext = () => { sim.forceDecline++; };

  // Counts at time t (for the live figure) or at the end (experiments).
  sim.count = (t = sim.now) => {
    const r = { done: 0, undone: 0, stuck: 0, away: 0, wrongMail: 0, active: 0, turned: 0, doubles: 0, orphans: 0, started: 0 };
    for (const trip of sim.trips) {
      if (trip.t0 > t) continue;
      r.started++;
      if (trip.outcomeAt <= t) { r[trip.outcome]++; if (trip.mailed >= 0 && trip.outcome !== "done") r.wrongMail++; }
      else r.active++;
    }
    for (const x of sim.turned) if (x.t <= t) r.turned++;
    for (const x of sim.doubles) if (x.t <= t) r.doubles++;
    const stuckIds = new Set(sim.trips.filter((tr) => tr.outcome === "stuck" && tr.outcomeAt <= t).map((tr) => tr.id));
    for (const tag of sim.tags) if (tag.from <= t && tag.to > t && stuckIds.has(tag.trip)) r.orphans++;
    for (const rc of sim.receipts) if (rc.from <= t && rc.to > t && stuckIds.has(rc.trip)) r.orphans++;
    return r;
  };
  return sim;
}

// Where a trip's folder is at time t: { slot (float), lane, steps done, undoing }.
export function folderAt(trip, t) {
  const keys = trip.keys;
  if (!keys.length || t < keys[0][0]) return null;
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1][0] <= t) i++;
  const a = keys[i], b = keys[i + 1];
  let slot = a[1], lane = a[2], drop = 0;
  if (b && b[0] > a[0]) {
    const p = (t - a[0]) / (b[0] - a[0]);
    slot = a[1] + (b[1] - a[1]) * p;
    if (a[2] !== b[2]) { lane = b[2]; drop = 1 - p; } // moving between lanes: blend from the old lane
  }
  let steps = 0;
  for (const [mt, d] of trip.marks) if (mt <= t) steps += d;
  return { slot, lane, from: drop ? a[2] : lane, blend: drop, steps, undoing: t >= trip.compAt && t < trip.outcomeAt, stuck: trip.outcome === "stuck" && t >= trip.outcomeAt };
}

// ---------- experiments (averaged over seeds) ----------
const SEEDS = [11, 23, 37, 41, 59, 61, 73, 89];
export function runScenario(cfg, duration = 180) {
  const sum = {};
  let n = 0;
  for (const seed of SEEDS) {
    const sim = makeSim({ ...cfg, stopAt: duration }, seed);
    sim.runTo(duration + 60);
    const r = sim.count(duration + 60);
    r.times = 0; r.timeN = 0;
    for (const trip of sim.trips) if (trip.outcome === "done") { r.times += trip.outcomeAt - trip.t0; r.timeN++; }
    r.wrongTurned = 0;
    const final = new Map(sim.trips.map((tr) => [tr.id, tr.outcome]));
    for (const x of sim.turned) if (x.holders.some((id) => final.get(id) === "undone" || final.get(id) === "stuck")) r.wrongTurned++;
    r.tripTime = r.timeN ? r.times / r.timeN : 0;
    const f = findCost(sim, duration); r.findAsks = f.asks; r.findMissed = f.missed;
    for (const [k, v] of Object.entries(r)) if (typeof v === "number") sum[k] = (sum[k] || 0) + v;
    n++;
  }
  for (const k of Object.keys(sum)) sum[k] /= n;
  return sum;
}

// A support agent looks for a trip in progress. With an orchestrator: one look at the checklist.
// Without: ask the counters in line order until one has the folder; a folder between counters is missed (5 asks, not found).
function findCost(sim, duration) {
  let asks = 0, missed = 0, samples = 0;
  for (let t = 5; t < duration; t += 0.5) {
    for (const trip of sim.trips) {
      if (trip.t0 > t || trip.outcomeAt <= t) continue;
      const f = folderAt(trip, t);
      if (!f || f.lane !== "f" || f.slot < 0) continue;
      samples++;
      if (sim.cfg.style === "orch") { asks += 1; continue; }
      const at = Math.abs(f.slot - Math.round(f.slot)) < 0.01 ? Math.round(f.slot) : -1;
      if (at < 0) { asks += 5; missed++; } else asks += at + 1;
    }
  }
  return { asks: samples ? asks / samples : 0, missed: samples ? missed / samples : 0 };
}

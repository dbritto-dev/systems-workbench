// @ts-nocheck: model code in the lessons' plain-JS style; shared helpers come from src/lib.
// A takeaway kitchen past its capacity. Customers come in at the door and order; each order is a slip that waits on
// the rail until one of three cooks takes it. A customer waits PATIENCE seconds for the dish, then leaves, and
// nobody tells the kitchen: a slip whose customer has gone still gets cooked, and the dish goes in the bin.
// Throughput is dishes cooked; goodput is dishes handed over in time. Event-driven and seeded, shared by the live
// figure and the experiments. Times are seconds of figure time.
//
// cfg:
//   load    demand as a share of what the kitchen cooks at the normal pace (1 = exactly full)
//   dish    mean seconds a cook spends on a dish (each one 0.5–1.5 × this)
//   policy  "all"   every customer is let in and every slip goes on the rail (an unbounded queue)
//           "rail"  the rail holds HOOKS slips; the rest wait on the order desk until a hook frees up (a bounded
//                   queue with nobody upstream told: the waiting just moves to the desk)
//           "door"  the rail holds HOOKS slips; while it is full the door turns new customers away (the limit
//                   pushed upstream to the edge: admission control)
//           "codel" every slip goes on the rail, but a cook throws away slips that waited too long (CoDel-style:
//                   TARGET while a standing queue persists, INTERVAL otherwise)
//   order   "fifo"  cooks take the oldest slip
//           "alifo" adaptive LIFO: the oldest slip, except while a standing queue persists, then the newest
import { rng } from "../../lib/random";
import { averageOver } from "../../lib/stats";

export const COOKS = 3;
export const DISH = 2;                    // normal mean seconds per dish
export const CAPACITY = COOKS / DISH;     // dishes a second at the normal pace
export const PATIENCE = 8;                // a customer waits this long for the dish
export const HOOKS = 6;                   // the rail's limit for "rail" and "door"
export const TARGET = 1;                  // CoDel-style wait limit while the queue stands
export const INTERVAL = 4;                // a standing queue: not empty for this long; also the wait limit otherwise
export const LIVE_WARM = 40;              // the machine opens each run this many seconds in

export const DEFAULTS = { load: 1.5, dish: DISH, policy: "all", order: "fifo" };

export function makeKitchen(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rnd = rng(seed);
  const exp = (rate) => -Math.log(1 - rnd()) / rate;
  let t = 0, nextId = 1, lastEmpty = 0;
  let nextArrival = cfg.load > 0 ? exp(cfg.load * CAPACITY) : Infinity;
  const front = [];                       // slips waiting on the order desk ("rail" only), oldest first
  const rail = [];                        // slips waiting on the rail, oldest first
  const cooks = Array.from({ length: COOKS }, (_, i) => ({ i, r: null, start: 0, end: Infinity }));
  const all = [];                         // every request, in arrival order
  const log = [];                         // { t, type, r, ... } for the figure
  const st = { arrived: 0, cooked: 0, inTime: 0, late: 0, turned: 0, dropped: 0, maxWaiting: 0, maxFront: 0 };

  const waiting = () => front.length + rail.length;
  // A standing queue: slips have been waiting without a break for INTERVAL seconds.
  const standing = () => waiting() > 0 && t - lastEmpty >= INTERVAL;
  const touch = () => { if (waiting() === 0) lastEmpty = t; };

  function arrive(extra = {}) {
    const r = { id: nextId++, born: t, deadline: t + PATIENCE, state: "", end: Infinity, ...extra };
    st.arrived++;
    all.push(r);
    if (cfg.policy === "door" && rail.length >= HOOKS) {
      r.state = "turned"; r.end = t; st.turned++;
      log.push({ t, type: "turned", r });
      return r;
    }
    if (cfg.policy === "rail" && rail.length >= HOOKS) { r.state = "front"; front.push(r); }
    else { r.state = "rail"; rail.push(r); }
    log.push({ t, type: "arrive", r });
    return r;
  }

  // CoDel-style: before taking a slip, throw away every slip that has waited longer than the limit. The limit is
  // short while a standing queue persists and long otherwise, so a normal burst still gets served.
  function sweep() {
    const limit = standing() ? TARGET : INTERVAL;
    for (let i = rail.length - 1; i >= 0; i--) {
      const r = rail[i];
      if (t - r.born > limit) {
        rail.splice(i, 1);
        r.state = "dropped"; r.end = t; st.dropped++;
        log.push({ t, type: "dropped", r });
      }
    }
  }

  function pick() {
    if (cfg.policy === "codel") sweep();
    if (!rail.length) return null;
    const lifo = cfg.order === "alifo" && standing();
    const r = lifo ? rail.pop() : rail.shift();
    r.lifo = lifo;
    if (front.length) { const f = front.shift(); f.state = "rail"; rail.push(f); log.push({ t, type: "hook", r: f }); }
    return r;
  }

  function dispatch() {
    for (const c of cooks) {
      if (c.r) continue;
      const r = pick();
      if (!r) break;
      c.r = r; c.start = t; c.end = t + cfg.dish * (0.5 + rnd());
      r.state = "cooking"; r.cook = c.i; r.taken = t;
      log.push({ t, type: "take", r, cook: c.i, lifo: r.lifo });
    }
  }

  function finish(c) {
    const r = c.r;
    c.r = null; c.end = Infinity;
    r.end = t; st.cooked++;
    if (t <= r.deadline) { r.state = "served"; st.inTime++; } else { r.state = "late"; st.late++; }
    log.push({ t, type: r.state, r, cook: c.i });
  }

  function settle() {
    dispatch();
    touch();
    const w = waiting();
    if (w > st.maxWaiting) st.maxWaiting = w;
    if (front.length > st.maxFront) st.maxFront = front.length;
  }

  function runTo(until) {
    for (;;) {
      let when = nextArrival, who = null;
      for (const c of cooks) if (c.r && c.end < when) { when = c.end; who = c; }
      if (when > until) break;
      t = when;
      touch();
      if (who) finish(who);
      else { arrive(); nextArrival = t + exp(cfg.load * CAPACITY); }
      settle();
    }
    t = until;
    touch();
  }

  // A rush: n customers through the door at once (a retry wave, a push notification, a cron job).
  function rush(n) {
    touch();
    const out = [];
    for (let i = 0; i < n; i++) out.push(arrive({ rush: true }));
    settle();
    return out;
  }

  return {
    cfg, front, rail, cooks, all, log, st, runTo, rush,
    get t() { return t; },
    get standing() { return standing(); },
    get sinceEmpty() { return waiting() ? t - lastEmpty : 0; },
    waiting,
    oldestWait() { const xs = [...front, ...rail]; return xs.length ? t - Math.min(...xs.map((r) => r.born)) : 0; },
  };
}

// ---------- measuring a run ----------
// Over [from, to): dishes cooked and dishes handed over in time per minute (by when the dish was done), and what
// became of the customers who arrived in that span.
export function measure(m, from, to) {
  const mins = (to - from) / 60;
  let cooked = 0, inTime = 0;
  for (const r of m.all) if (r.end >= from && r.end < to && (r.state === "served" || r.state === "late")) { cooked++; if (r.state === "served") inTime++; }
  const came = m.all.filter((r) => r.born >= from && r.born < to);
  const n = came.length || 1;
  const share = (state) => came.filter((r) => r.state === state).length / n;
  const noes = came.filter((r) => r.state === "turned" || r.state === "dropped");
  const toNo = noes.length ? noes.reduce((a, r) => a + (r.end - r.born), 0) / noes.length : 0;
  const late = came.filter((r) => r.state === "late").length;
  return {
    cookedMin: cooked / mins, inTimeMin: inTime / mins, wastedShare: cooked ? (cooked - inTime) / cooked : 0,
    arrived: came.length, served: share("served"), turned: share("turned"), dropped: share("dropped"), late,
    missed: came.length - came.filter((r) => r.state === "served").length, toNo,
  };
}

// ---------- experiments: headless runs averaged over seeds ----------
export const SEEDS = [3, 5, 7, 11, 13, 17];
const avg = (fn) => averageOver(SEEDS, fn);
const WARM = 60, SPAN = 120;

function steady(cfg) {
  return avg((seed) => {
    const m = makeKitchen(cfg, seed);
    m.runTo(WARM + SPAN);
    const r = measure(m, WARM, WARM + SPAN);
    return { ...r, waiting: m.waiting(), front: m.front.length, rail: m.rail.length, oldest: m.oldestWait() };
  });
}

// 1. Demand 80% → 150%, accept everyone, oldest slip first.
export function overloadRun() {
  return { under: steady({ load: 0.8, policy: "all" }), over: steady({ load: 1.5, policy: "all" }) };
}

// 2. 150%: accept everyone vs a limit of HOOKS waiting, enforced at the door.
export function doorRun() {
  return { all: steady({ load: 1.5, policy: "all" }), door: steady({ load: 1.5, policy: "door" }) };
}

// 3. 150%: limit only the rail (the desk keeps the rest) vs the same limit at the door.
export function railRun() {
  return { all: steady({ load: 1.5, policy: "all" }), rail: steady({ load: 1.5, policy: "rail" }), door: steady({ load: 1.5, policy: "door" }) };
}

// 4. Every dish takes twice as long (a slow supplier), demand 120%: the door limit vs dropping stale slips.
export function slowRun() {
  const slow = { load: 1.2, dish: 2 * DISH };
  return { normalDoor: steady({ load: 1.2, policy: "door" }), door: steady({ ...slow, policy: "door" }), codel: steady({ ...slow, policy: "codel" }) };
}

// 5. A rush of 30 at once on a normal 80% day, accept everyone: oldest first vs adaptive LIFO, over the next minute.
export const RUSH = 30;
export function rushRun() {
  const run = (cfg) => avg((seed) => {
    const m = makeKitchen({ load: 0.8, policy: "all", ...cfg }, seed);
    m.runTo(WARM);
    const crowd = m.rush(RUSH);
    m.runTo(WARM + 60);
    const r = measure(m, WARM, WARM + 60);
    const rushServed = crowd.filter((x) => x.state === "served").length;
    // Everyone else who walked in during that minute.
    const others = m.all.filter((x) => !x.rush && x.born >= WARM && x.born < WARM + 60);
    const othersServed = others.filter((x) => x.state === "served").length / (others.length || 1);
    m.runTo(WARM + 180);
    return { missed: r.missed, rushServed, othersServed, cookedMin: r.cookedMin, inTimeMin: r.inTimeMin };
  });
  return { fifo: run({ order: "fifo" }), alifo: run({ order: "alifo" }), both: run({ order: "alifo", policy: "codel" }) };
}

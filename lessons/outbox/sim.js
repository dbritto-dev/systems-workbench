// Shared model for the figure and the experiments: an order service that must record each order in its
// database (the ledger) AND tell the warehouse (a letter). Times are seconds of figure time.
//   dual:     write the ledger, then walk the letter to the postbox. A failure in between loses the letter.
//   pubfirst: post the letter, then write the ledger. A failed write leaves a phantom: shipped, never ordered.
//   outbox:   write the ledger card and the letter into the outbox drawer in one transaction; a relay later
//             carries pending letters to the postbox and only then marks them sent (at-least-once).
export const T = { WRITE: 0.5, WALK: 1.0, POST: 0.25, DOWN: 2.5, RAIL: 1.6, R_WALK: 1.0, R_POST: 0.2, R_EACH: 0.12, MARK: 0.3 };
export const RATE = 0.25;      // orders per second arriving at the clerk
export const BATCH = 6;        // letters the relay carries in one trip

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// cfg: { mode, rate, crash (chance the clerk fails between the two writes), relayCrash (chance the relay fails after posting,
//        before marking), dedupe, poll (s between relay checks) }
export function makeSim(cfg, seed = 7) {
  const random = rng(seed);
  const rate = cfg.rate ?? RATE;
  const events = [];
  const push = (t, fn) => { let i = events.length; while (i > 0 && events[i - 1].t > t) i--; events.splice(i, 0, { t, fn }); };
  const sim = {
    cfg, now: 0, nextId: 1,
    inbox: [],                   // orders waiting for the clerk
    ledger: new Set(),           // committed orders
    pending: [],                 // outbox rows not yet marked sent (order ids, in commit order)
    committedAt: {}, firstArrival: {}, shipCount: {}, seen: new Set(),
    rail: [],                    // letters on the rail: { id, t0, t1 }
    dropped: [],                 // letters dropped on the floor: { id, t, x (0..1 along the clerk's walk) }
    binned: 0,                   // ledger cards that never committed (failed writes or rolled-back transactions)
    stats: { orders: 0, shipped: 0, lost: 0, phantom: 0, dupShipped: 0, caught: 0, failed: 0, sent: 0, relayCrashes: 0 },
    delays: [],
    clerk: { seg: { kind: "idle", t0: 0, t1: 0 }, carrying: false, forceCrash: false },
    relay: { seg: { kind: "idle", t0: 0, t1: 0 }, batch: [], nextCheck: cfg.poll ?? 2 },
    flashes: { commit: -9, fail: -9, spike: -9, catch: -9, post: -9, mark: -9 },
    crashNext() { sim.clerk.forceCrash = true; },
    runTo(t) {
      while (events.length && events[0].t <= t) { const e = events.shift(); sim.now = e.t; e.fn(e.t); }
      sim.now = t;
    },
  };
  const S = sim.stats;
  const fails = (p) => { if (sim.clerk.forceCrash) { sim.clerk.forceCrash = false; return true; } return random() < p; };

  // Orders arrive at random.
  const stopAt = cfg.stopAt ?? Infinity;
  const arrive = (t) => { sim.inbox.push({ id: sim.nextId++, t }); if (sim.clerk.seg.kind === "idle") nextOrder(t); const next = t - Math.log(1 - random()) / rate; if (next < stopAt) push(next, arrive); };
  if (rate > 0) push(-Math.log(1 - random()) / rate, arrive);

  // The clerk works through the inbox one order at a time; `steps` run in sequence.
  function run(actor, steps, t, done) {
    if (!steps.length) { actor.seg = { kind: "idle", t0: t, t1: t }; done(t); return; }
    const [step, ...rest] = steps;
    const dur = step.cut != null ? step.dur * step.cut : step.dur;
    actor.seg = { kind: step.kind, t0: t, t1: t + dur, from: step.from, to: step.to, cut: step.cut, id: step.id, n: step.n };
    if (step.start) step.start(t);
    push(t + dur, (te) => { const stop = step.end ? step.end(te) : false; run(actor, stop ? stop : rest, te, done); });
  }
  const clerkDone = (t) => { sim.clerk.carrying = false; if (sim.inbox.length) nextOrder(t); };
  const down = (where, onUp) => [{ kind: "down", dur: T.DOWN, from: where.from, to: where.to, cut: where.cut, end: onUp }, { kind: "respawn", dur: 0.01 }];

  function letterToRail(id, t) {
    S.sent++;
    sim.rail.push({ id, t0: t, t1: t + T.RAIL });
    push(t + T.RAIL, (ta) => arriveAtWarehouse(id, ta));
  }
  function arriveAtWarehouse(id, t) {
    sim.rail = sim.rail.filter((l) => l.t1 > t);
    if (sim.firstArrival[id] == null) { sim.firstArrival[id] = t; if (sim.committedAt[id] != null) sim.delays.push(t - sim.committedAt[id]); }
    if (cfg.dedupe && sim.seen.has(id)) { S.caught++; sim.flashes.catch = t; return; }
    sim.seen.add(id);
    sim.shipCount[id] = (sim.shipCount[id] || 0) + 1;
    S.shipped++;
    if (sim.shipCount[id] > 1) S.dupShipped++;
    sim.flashes.spike = t;
  }
  function commit(id, t) {
    sim.ledger.add(id); S.orders++; sim.committedAt[id] = t; sim.flashes.commit = t;
    if (sim.firstArrival[id] != null) sim.delays.push(0);
  }

  function nextOrder(t) {
    const o = sim.inbox.shift();
    const id = o.id, c = sim.clerk;
    const crash = cfg.crash || 0;
    let steps;
    if (cfg.mode === "dual") {
      const dies = fails(crash), cut = dies ? 0.25 + 0.6 * random() : null;
      steps = [
        { kind: "write", dur: T.WRITE, id, end: (te) => { commit(id, te); c.carrying = true; } },
        { kind: "walk", dur: T.WALK, from: "home", to: "post", id, cut,
          end: (te) => { if (!dies) return false; c.carrying = false; S.lost++; sim.dropped.push({ id, t: te, x: cut }); return down({ from: "home", to: "post", cut }, null); } },
        { kind: "post", dur: T.POST, id, end: (te) => { c.carrying = false; letterToRail(id, te); sim.flashes.post = te; } },
        { kind: "walk", dur: T.WALK, from: "post", to: "home" },
      ];
    } else if (cfg.mode === "pubfirst") {
      const dies = fails(crash);
      steps = [
        { kind: "walk", dur: T.WALK, from: "home", to: "post", id, start: () => { c.carrying = true; } },
        { kind: "post", dur: T.POST, id, end: (te) => { c.carrying = false; letterToRail(id, te); sim.flashes.post = te; } },
        { kind: "walk", dur: T.WALK, from: "post", to: "home" },
        { kind: "write", dur: T.WRITE, id, cut: dies ? 0.6 : null,
          end: (te) => { if (!dies) { commit(id, te); return false; } sim.binned++; S.failed++; S.phantom++; sim.flashes.fail = te; return down({ from: "home", to: "home" }, null); } },
      ];
    } else {
      const dies = fails(crash);
      steps = [
        { kind: "write", dur: T.WRITE, id, cut: dies ? 0.6 : null,
          end: (te) => {
            if (dies) { sim.binned++; S.failed++; sim.flashes.fail = te; return down({ from: "home", to: "home" }, null); }
            commit(id, te); sim.pending.push(id); return false;
          } },
      ];
    }
    run(c, steps, t, clerkDone);
  }

  // The relay: every `poll` seconds while idle, carry pending letters to the postbox, come back, mark them sent.
  if (cfg.mode === "outbox") {
    const poll = cfg.poll ?? 2;   // fixed for a run
    const r = sim.relay;
    const check = (t) => {
      if (!sim.pending.length) { r.nextCheck = t + poll; push(t + poll, check); return; }
      r.batch = sim.pending.slice(0, BATCH);
      const batch = r.batch.slice();
      const dies = random() < (cfg.relayCrash || 0);
      const steps = [
        { kind: "walk", dur: T.R_WALK, from: "rhome", to: "rpost", n: batch.length },
        { kind: "post", dur: T.R_POST + T.R_EACH * batch.length, n: batch.length,
          start: (ts) => { batch.forEach((id, j) => push(ts + T.R_EACH * (j + 1), (tl) => letterToRail(id, tl))); sim.flashes.post = ts; },
          end: (te) => { if (!dies) return false; S.relayCrashes++; r.batch = []; return down({ from: "rpost", to: "rpost" }, null); } },
        { kind: "walk", dur: T.R_WALK, from: "rpost", to: "rhome" },
        { kind: "mark", dur: T.MARK, end: (te) => { sim.pending = sim.pending.filter((id) => !batch.includes(id)); r.batch = []; sim.flashes.mark = te; } },
      ];
      run(r, steps, t, (te) => { r.nextCheck = te + poll; push(te + poll, check); });
    };
    push(poll, check);
  }
  return sim;
}

// ---------- experiments: each averaged over seeded runs ----------
const SEEDS = [3, 7, 11, 19, 23, 29, 31, 37];
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pctl = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
export function runFor(cfg, seconds = 600) {
  const out = SEEDS.map((seed) => { const s = makeSim({ ...cfg, stopAt: seconds }, seed); s.runTo(seconds + 60); return s; });
  const avg = (f) => out.reduce((sum, s) => sum + f(s), 0) / out.length;
  const delays = out.flatMap((s) => s.delays);
  return {
    orders: avg((s) => s.stats.orders), shipped: avg((s) => s.stats.shipped), lost: avg((s) => s.stats.lost), phantom: avg((s) => s.stats.phantom),
    dupShipped: avg((s) => s.stats.dupShipped), caught: avg((s) => s.stats.caught), failed: avg((s) => s.stats.failed), sent: avg((s) => s.stats.sent),
    relayCrashes: avg((s) => s.stats.relayCrashes), median: median(delays), p95: pctl(delays, 0.95),
  };
}
// runFor stops taking orders at `seconds`, then runs a minute more so every letter in flight lands.

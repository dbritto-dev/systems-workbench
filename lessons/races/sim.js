// Shared model for the figure and the experiments: clerks updating one shared record. Times in seconds.
export const WALK = 0.45;      // stand ↔ desk
export const READ = 0.25;      // reading the card / checking the board
export const WRITE = 0.25;     // writing the card / pinning a seat
export const SEATS = 24;       // 4 rows × 6 on the booking board
export const PICK = 4;
export const BUSY_GAP = 1.5;   // mean seconds between a clerk's customers when the office is busy
export const QUIET_GAP = 30;   // … and when it is quiet (a test run, a dev laptop)         // customers pick among the first few free seats (the front rows go first)
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// cfg: { clerks, think, protection: "none"|"lock"|"cas"|"atomic", scenario: "deposits"|"booking", traffic: "busy"|"quiet", quota }
// Each clerk walks through phases; every phase has a start t0 and an end t1. "queue" waits for the key (t1 = Infinity).
export function makeSim(cfg, seed = 7) {
  const random = rng(seed);
  const sim = {
    cfg, now: 0,
    card: { value: 0, version: 0 },
    seats: Array.from({ length: SEATS }, () => []),
    key: { holder: -1, queue: [] },
    stats: { done: 0, lost: 0, retries: 0, doubles: 0, booked: 0, failed: 0, firstDone: -1, lastDone: 0, waitSum: 0 },
    events: [],
    clerks: [],
  };
  const booking = cfg.scenario === "booking";
  const thinkTime = () => cfg.think * (0.6 + 0.8 * random());
  const gap = () => -Math.log(1 - random()) * (cfg.traffic === "quiet" ? QUIET_GAP : BUSY_GAP);
  const say = (t, clerk, kind, extra = {}) => sim.events.push({ t, clerk, kind, ...extra });

  for (let i = 0; i < cfg.clerks; i++) {
    sim.clerks.push({ i, phase: "idle", t0: 0, t1: random() * (cfg.traffic === "quiet" ? QUIET_GAP : BUSY_GAP), slip: null, seat: -1, made: 0, retries: 0, lit: -1 });
  }
  const go = (c, phase, t, dur) => { c.phase = phase; c.t0 = t; c.t1 = t + dur; };
  const quotaLeft = (c) => cfg.quota === undefined || c.made < cfg.quota;
  const freeSeats = () => sim.seats.map((s, n) => (s.length ? -1 : n)).filter((n) => n >= 0);

  function startJob(c, t) {
    if (!quotaLeft(c)) { go(c, "done", t, Infinity); return; }
    c.jobStart = t;
    if (booking && !freeSeats().length) { go(c, "idle", t, 0.5); return; }
    if (cfg.protection === "atomic" && !booking) { go(c, "think", t, thinkTime()); c.slip = null; c.pre = true; return; }
    c.pre = false;
    go(c, "toStand", t, WALK);
  }
  function wantKey() { return cfg.protection === "lock"; }
  function grantKey(c, t) { sim.key.holder = c.i; go(c, "read", t, READ); say(t, c.i, "key"); }
  function releaseKey(t) {
    sim.key.holder = -1;
    const next = sim.key.queue.shift();
    if (next !== undefined) grantKey(sim.clerks[next], t);
  }
  function finishJob(c, t) {
    sim.stats.done++; c.made++; sim.stats.waitSum += t - c.jobStart;
    if (sim.stats.firstDone < 0) sim.stats.firstDone = t;
    sim.stats.lastDone = t;
  }

  function transition(c) {
    const t = c.t1;
    switch (c.phase) {
      case "idle": startJob(c, t); break;
      case "think":
        if (c.pre) { go(c, "toStand", t, WALK); break; }
        go(c, "toStand2", t, WALK); break;
      case "toStand":
        if (c.pre) { go(c, "write", t, WRITE); break; }
        if (wantKey()) {
          if (sim.key.holder < 0) grantKey(c, t);
          else { sim.key.queue.push(c.i); go(c, "queue", t, Infinity); }
          break;
        }
        go(c, "read", t, READ); break;
      case "read":
        if (booking) {
          const free = freeSeats();
          if (!free.length) { c.seat = -1; c.slip = null; if (wantKey()) releaseKey(t); go(c, "toDesk", t, WALK); c.empty = true; break; }
          c.seat = free[Math.floor(random() * Math.min(PICK, free.length))];
          c.slip = { seat: c.seat };
        } else c.slip = { value: sim.card.value, version: sim.card.version };
        c.empty = false;
        go(c, "toDesk1", t, WALK); break;
      case "toDesk1": go(c, "think", t, thinkTime()); break;
      case "toStand2": go(c, "write", t, WRITE); break;
      case "write": {
        if (booking) {
          const seat = sim.seats[c.seat];
          const guarded = cfg.protection !== "none";
          if (seat.length && guarded) {
            c.retries++; sim.stats.retries++; sim.stats.failed++;
            say(t, c.i, "taken", { seat: c.seat });
            go(c, "read", t, READ); break;
          }
          seat.push(c.i);
          if (seat.length === 2) { sim.stats.doubles++; c.lit = t; say(t, c.i, "double", { seat: c.seat }); }
          else say(t, c.i, "booked", { seat: c.seat });
          sim.stats.booked++;
          finishJob(c, t);
        } else if (cfg.protection === "atomic") {
          sim.card.value += 1; sim.card.version += 1;
          finishJob(c, t); say(t, c.i, "added");
        } else if (cfg.protection === "cas" && c.slip.version !== sim.card.version) {
          c.retries++; sim.stats.retries++;
          say(t, c.i, "stale", { saw: c.slip.version, now: sim.card.version });
          go(c, "read", t, READ); break;
        } else {
          const overwritten = sim.card.version - c.slip.version;
          sim.card.value = c.slip.value + 1; sim.card.version += 1;
          finishJob(c, t);
          sim.stats.lost = sim.stats.done - sim.card.value;
          if (overwritten > 0) { c.lit = t; say(t, c.i, "lost", { overwritten }); }
          else say(t, c.i, "wrote");
        }
        if (wantKey()) releaseKey(t);
        go(c, "toDesk", t, WALK); break;
      }
      case "toDesk": c.slip = null; go(c, "idle", t, gap()); break;
    }
  }

  sim.runTo = (T) => {
    for (;;) {
      let next = null;
      for (const c of sim.clerks) if (c.t1 <= T && (!next || c.t1 < next.t1)) next = c;
      if (!next) break;
      sim.now = next.t1;
      transition(next);
    }
    sim.now = T;
  };
  sim.boardFull = () => booking && freeSeats().length === 0 && sim.clerks.every((c) => c.phase === "idle" || c.phase === "done" || c.phase === "toDesk");
  sim.clearBoard = () => { sim.seats.forEach((s) => (s.length = 0)); };
  return sim;
}

// Run until every clerk finished its quota (or the board is full) and report.
export function runQuota(cfg, seed) {
  const s = makeSim(cfg, seed);
  let T = 0;
  while (T < 20000) {
    T += 5; s.runTo(T);
    if (cfg.scenario === "booking" ? s.clerks.every((c) => c.phase === "done" || (c.phase === "idle" && !s.seats.some((x) => !x.length))) : s.clerks.every((c) => c.phase === "done")) break;
  }
  const span = Math.max(1e-6, s.stats.lastDone);
  return { ...s.stats, value: s.card.value, perMinute: (s.stats.done / span) * 60, seconds: span, doubleSeats: s.seats.filter((x) => x.length > 1).length, wait: s.stats.done ? s.stats.waitSum / s.stats.done : 0 };
}

export function average(cfg, seeds = [3, 5, 7, 11, 13, 17, 19, 23]) {
  const runs = seeds.map((seed) => runQuota(cfg, seed));
  const mean = (k) => runs.reduce((a, r) => a + r[k], 0) / runs.length;
  return { done: mean("done"), lost: mean("lost"), retries: mean("retries"), perMinute: mean("perMinute"), wait: mean("wait"), doubleSeats: mean("doubleSeats"), booked: mean("booked"), runs };
}

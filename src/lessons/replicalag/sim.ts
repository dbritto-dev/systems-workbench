// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// A leader and two followers with log-shipping replication. Event-driven and seeded, shared by the live figure and
// the experiments. Times are seconds of real time (the figure plays them in slow motion). The numbers are
// illustrative and round: chosen so lag is visible, in the range a busy replica or one a zone away can show.
//
// The leader takes every write and gives it the next log sequence number (LSN). Each follower receives the log in
// order over its own link (network) and replays it in order, one entry at a time (apply). A follower's state is
// "everything up to LSN n": it only moves forward. Its lag is the age of the oldest write it hasn't applied yet.
//
// Users browse: they read a page (a query) every so often, sometimes twice in quick succession, and now and then
// save something; right after a save comes the read-back, the next request, which shows them what they saved.
// One user is "you": the figure follows your writes and reads.
//
// cfg:
//   route   where reads go: "leader" | "any" (a random follower, a load balancer) | "sticky" (each user always the
//           same follower) | "window" (the leader for WINDOW s after the user's own write, else any follower)
//           | "token" (the client keeps the highest LSN it has written or seen; a follower that has applied it
//           serves the read, else the leader)
//   commit  when the leader answers a write: "async" (once it's in the leader's log) | "semi" (once one follower
//           has received it: semi-synchronous) | "sync" (once both followers have applied it)
//   b       follower B: "healthy" | "slow" (a slower link and slower replay) | "stalled" (B still receives the log
//           and serves reads, but has stopped replaying it)
//   burst   batch-import bursts: [{ at, rate, dur }] extra writes per second, with no reads

import { rng } from "../../lib/random";
import { minHeap } from "../../lib/events";
import { averageOver, rankQuantile, mean } from "../../lib/stats";

export const LOCAL = 0.005;                                   // the leader's own commit (its log write), 5 ms
export const NET = { healthy: [0.03, 0.03], slow: [0.2, 0.2] };    // one way, leader ↔ follower: 30–60 ms, slow 200–400 ms
export const APPLY = { healthy: 0.01, slow: 0.025 };         // replaying one write: 10 ms (100/s), slow 25 ms (40/s)
export const USERS = 30;
export const OTHERS = 20;                                     // writes a second from everyone else (other users, services)
export const GAP = 2;                                         // mean seconds between a user's page views
export const PWRITE = 0.25;                                   // a quarter of actions are saves
export const QUICK = { share: 0.5, gap: [0.1, 0.4] };         // half the reads are followed by another 100–500 ms later
export const BACK = [0.02, 0.18];                              // the read-back comes 20–200 ms after the save returns
export const WINDOW = 1;                                       // "window": read from the leader for 1 s after a write
export const BURST = { rate: 200, dur: 2 };                    // a batch job: 200 extra writes a second for 2 s
export const YOU = 0;
export const YOU_GAP = [0.25, 0.25];                         // your next look: 250–500 ms later
export const YOU_PAUSE = [0.6, 0.6];                        // then a pause of 0.6–1.2 s before your next save
export const DEFAULTS = { route: "any", commit: "async", b: "healthy", burst: [] };

export function makeSim(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rBg = rng(seed * 1103515245 + 12345), rAct = rng(seed * 2654435761 + 17), rNet = rng(seed * 40503 + 101), rRoute = rng(seed * 69069 + 7), rYou = rng(seed * 7919 + 3);
  const events = minHeap((a, b) => a.t < b.t || (a.t === b.t && a.n < b.n));
  let n = 0, now = 0;
  const at = (t, k, x) => events.push({ t, k, x, n: n++ });

  // Follower 0 is A, follower 1 is B.
  const kind = ["healthy", cfg.b === "slow" ? "slow" : "healthy"];
  const F = [0, 1].map((i) => ({ i, net: NET[kind[i]], apply: APPLY[kind[i]], stalled: i === 1 && cfg.b === "stalled", lastArrive: 0, lastEnd: 0, applied: 0, received: 0 }));
  const writes = [];            // { lsn, t, user, you, batch, f: [{ arrive, start, end }], ret }
  const log = [];               // what the live figure narrates (your writes and reads, bursts)
  const users = Array.from({ length: USERS }, (_, i) => ({ i, lastLSN: 0, lastRet: -Infinity, seen: 0, waiting: false, gen: 0 }));
  const st = { backs: 0, backMiss: 0, reads: 0, ownReads: 0, ownMiss: 0, mono: 0, onLeader: 0, commits: [], commitAt: [], waiting: 0, trace: [], quick: 0, quickBack: 0, backsAt: [0, 0, 0], backMissAt: [0, 0, 0], reads_t: [] };
  const draw = (r) => r();

  // ---------- writes ----------
  function write(t, user, batch = false) {
    const lsn = writes.length + 1;
    const w = { lsn, t, user: user ? user.i : -1, you: user && user.i === YOU, batch, f: [], ret: Infinity };
    // the same draws whatever the settings, so runs that differ in one setting see the same dice
    const u = [draw(rNet), draw(rNet), draw(rNet), draw(rNet)];
    const acks = [];
    for (const f of F) {
      const [a, b] = f.net;
      const arrive = Math.max(f.lastArrive, t + LOCAL + a + b * u[f.i * 2]);
      const start = Math.max(arrive, f.lastEnd);
      const end = f.stalled ? Infinity : start + f.apply;
      f.lastArrive = arrive; f.lastEnd = end;
      const back = a + b * u[f.i * 2 + 1];
      w.f.push({ arrive, start, end });
      acks.push({ received: arrive + back, applied: end + back });
    }
    w.ret = cfg.commit === "semi" ? Math.max(t + LOCAL, Math.min(acks[0].received, acks[1].received))
      : cfg.commit === "sync" ? Math.max(acks[0].applied, acks[1].applied)
      : t + LOCAL;
    writes.push(w);
    if (user) {
      user.waiting = true;
      if (w.ret < Infinity) at(w.ret, "ret", { user, w, gen: user.gen });
      else st.waiting++;
    }
    if (w.you) log.push({ t, type: "write", w });
    return w;
  }

  // ---------- where a follower is ----------
  function appliedAt(f, t) {
    while (f.applied < writes.length && writes[f.applied].f[f.i].end <= t) f.applied++;
    return f.applied;
  }
  /** The writes that have reached follower f by time t (it receives them in log order). */
  function receivedAt(f, t) {
    while (f.received < writes.length && writes[f.received].f[f.i].arrive <= t) f.received++;
    return f.received;
  }
  function lagAt(f, t) {
    const a = appliedAt(f, t);
    return a < writes.length && writes[a].t <= t ? t - writes[a].t : 0;
  }

  // ---------- reads ----------
  function pickFollower(user) {
    const r = draw(rRoute);
    if (cfg.route === "sticky") return (user.i + 1) % 2;   // you (user 0) read from B
    return r < 0.5 ? 0 : 1;
  }
  function read(t, user, isBack, quick = false) {
    let node = pickFollower(user);
    if (cfg.route === "leader") node = "L";
    else if (cfg.route === "window" && t - user.lastRet < WINDOW) node = "L";
    else if (cfg.route === "token") {
      const tok = Math.max(user.lastLSN, user.seen);
      if (appliedAt(F[node], t) < tok) node = appliedAt(F[1 - node], t) >= tok ? 1 - node : "L";
    }
    const got = node === "L" ? writes.length : appliedAt(F[node], t);
    const miss = got < user.lastLSN, back = got < user.seen;
    st.reads++;
    if (node === "L") st.onLeader++;
    if (user.lastLSN > 0) { st.ownReads++; if (miss) st.ownMiss++; if (cfg.trace) st.trace.push(miss ? -t : t); }
    if (isBack) { st.backs++; if (miss) st.backMiss++; const k = node === "L" ? 2 : node; st.backsAt[k]++; if (miss) st.backMissAt[k]++; }
    if (cfg.trace) st.reads_t.push(node === "L" ? -t : t);
    if (back) st.mono++;
    if (quick) { st.quick++; if (back) st.quickBack++; }
    if (user.i === YOU) log.push({ t, type: "read", node, got, wrote: user.lastLSN, seen: user.seen, miss, backInTime: back, isBack });
    user.seen = Math.max(user.seen, got);
    return { node, got, miss, back };
  }

  // ---------- users ----------
  function nextGap(user, afterRead) {
    if (afterRead && draw(rAct) < QUICK.share) { user.quickNext = true; return QUICK.gap[0] + QUICK.gap[1] * draw(rAct); }
    draw(rAct);
    return -Math.log(1 - draw(rAct)) * GAP;
  }
  function onAct(t, { user, gen }) {
    if (gen !== user.gen || user.waiting) return;
    if (user.i === YOU) return youAct(t);
    if (draw(rAct) < PWRITE) { user.quickNext = false; write(t, user); return; }
    read(t, user, false, user.quickNext);
    user.quickNext = false;
    at(t + nextGap(user, true), "act", { user, gen: user.gen });
  }
  function onRet(t, { user, w, gen }) {
    st.commits.push(w.ret - w.t); st.commitAt.push(t);
    if (w.you) log.push({ t, type: "ret", w });
    if (gen !== user.gen) return;
    user.waiting = false;
    user.lastLSN = w.lsn; user.lastRet = t;
    const backAt = t + BACK[0] + BACK[1] * (user.i === YOU ? rYou() : draw(rAct));
    at(backAt, "back", { user, gen: user.gen });
  }
  function onBack(t, { user, gen }) {
    if (gen !== user.gen) return;
    read(t, user, true);
    if (user.i === YOU) { you.step = 1; at(t + YOU_GAP[0] + YOU_GAP[1] * rYou(), "act", { user, gen }); return; }
    at(t + nextGap(user, true), "act", { user, gen });
  }

  // You: save, read back, look twice more, pause, again.
  const you = { step: 0 };
  function youAct(t) {
    const user = users[YOU];
    if (you.step === 0) { write(t, user); return; }
    read(t, user, false, true);
    if (you.step < 2) { you.step++; at(t + YOU_GAP[0] + YOU_GAP[1] * rYou(), "act", { user, gen: user.gen }); return; }
    you.step = 0;
    at(t + YOU_PAUSE[0] + YOU_PAUSE[1] * rYou(), "act", { user, gen: user.gen });
  }

  at(-Math.log(1 - rBg()) / OTHERS, "bg");
  for (const user of users) at(user.i === YOU ? 0.4 : draw(rAct) * GAP, "act", { user, gen: 0 });

  // ---------- bursts ----------
  function scheduleBurst(t0, rate = BURST.rate, dur = BURST.dur) {
    const b = { at: t0, end: t0 + dur, first: 0, last: 0 };
    bursts.push(b);
    at(t0, "burstStart", b);
    for (let k = 0; k < rate * dur; k++) at(t0 + (k + 0.5) / rate, "bw", b);
    at(t0 + dur, "burstEnd", b);
    return b;
  }
  const bursts = [];
  for (const b of cfg.burst) scheduleBurst(b.at, b.rate, b.dur);

  function step(e) {
    now = e.t;
    if (e.k === "act") onAct(e.t, e.x);
    else if (e.k === "ret") onRet(e.t, e.x);
    else if (e.k === "back") onBack(e.t, e.x);
    else if (e.k === "bg") { write(e.t, null); at(e.t - Math.log(1 - rBg()) / OTHERS, "bg"); }
    else if (e.k === "bw") { const w = write(e.t, null, true); if (!e.x.first) e.x.first = w.lsn; e.x.last = w.lsn; }
    else if (e.k === "burstStart") log.push({ t: e.t, type: "burstStart" });
    else if (e.k === "burstEnd") log.push({ t: e.t, type: "burstEnd" });
    else if (e.k === "sample") e.x(e.t);
  }
  function runTo(T) {
    for (;;) {
      const e = events.peek();
      if (!e || e.t > T) break;
      events.pop();
      step(e);
    }
    now = T;
  }

  return {
    cfg, F, writes, users, log, st, bursts,
    runTo, appliedAt, receivedAt, lagAt,
    /** Sample something every dt seconds of model time (headless runs). */
    every(dt, fn, from = 0, to = Infinity) { for (let t = from; t <= to; t += dt) at(t, "sample", fn); },
    /** You save now (the visitor's button), unless your last save is still waiting for its commit. */
    save(t) {
      runTo(t);
      const user = users[YOU];
      if (user.waiting) return false;
      user.gen++; you.step = 0;
      write(t, user);
      return true;
    },
    burst(t) { runTo(t); return scheduleBurst(t); },
    get now() { return now; },
    get leaderLSN() { return writes.length; },
  };
}

// ---------- the leader crashes ----------
// The leader dies at time T. Whatever hadn't reached a follower by then never will (it was in the dead leader's
// memory or on the wire). The follower that has received the most of the log is promoted (pick: "best"), or the
// other one ("other"); before it takes writes it replays everything it received, so its replay backlog isn't lost,
// only the writes it never received. Those are lost; the ones whose client had already been told "saved" were
// acknowledged writes. Works on a model that has been run to T or past it: it reads the timeline, so the same run can
// be crashed at many moments.
const upTo = (ws, t, key) => { let lo = 0, hi = ws.length; while (lo < hi) { const m = (lo + hi) >> 1; if (key(ws[m]) <= t) lo = m + 1; else hi = m; } return lo; };
export function failoverAt(m, T, pick = "best") {
  const ws = m.writes, n = upTo(ws, T, (w) => w.t);
  const recv = [0, 1].map((i) => Math.min(n, upTo(ws, T, (w) => w.f[i].arrive)));
  const applied = [0, 1].map((i) => Math.min(recv[i], upTo(ws, T, (w) => w.f[i].end)));
  const best = recv[1] > recv[0] ? 1 : 0, p = pick === "best" ? best : 1 - best;
  const lost = ws.slice(recv[p], n), acked = lost.filter((w) => w.ret <= T);
  return { T, n, recv, applied, p, lost, acked, unacked: lost.length - acked.length };
}

// ---------- experiments: headless runs, averaged over seeds ----------
export const SEEDS = [3, 7, 11, 19, 23, 31, 43, 59];
export const RUN_SECS = 600;
const avg = (fn) => averageOver(SEEDS, fn);
const run = (cfg, seed, secs = RUN_SECS) => { const m = makeSim(cfg, seed); m.runTo(secs); return m; };
const backMiss = (m) => m.st.backMiss / Math.max(1, m.st.backs);
const monoShare = (m) => m.st.mono / Math.max(1, m.st.reads);
const leaderShare = (m) => m.st.onLeader / Math.max(1, m.st.reads);
const quickBack = (m) => m.st.quickBack / Math.max(1, m.st.quick);
/** How long after its commit each write was applied on follower f (the replication delay), mean and p99. */
const delay = (m, f) => { const xs = m.writes.filter((w) => w.f[f].end < Infinity && w.t > 5).map((w) => w.f[f].end - w.t); return { mean: mean(xs), p99: rankQuantile(xs, 0.99) }; };

// 1. Reads move from the leader to the followers: read-backs that miss the user's own save.
export function moveRun() {
  const one = (route) => avg((seed) => { const m = run({ route }, seed), d = delay(m, 0); return { miss: backMiss(m), delay: d.mean, p99: d.p99, own: m.st.ownMiss / Math.max(1, m.st.ownReads) }; });
  return { leader: one("leader"), any: one("any") };
}

// 2. Follower B falls behind: does sticking each user to one follower help read-backs? And reading from the leader
// after a write. Also: a quick second read that shows less than the read just before it (went back).
export function rywRun() {
  const one = (route) => avg((seed) => { const m = run({ route, b: "slow" }, seed), s = m.st; return { miss: backMiss(m), quick: quickBack(m), all: monoShare(m), leader: leaderShare(m), missA: s.backMissAt[0] / Math.max(1, s.backsAt[0]), missB: s.backMissAt[1] / Math.max(1, s.backsAt[1]), delayA: delay(m, 0).mean, delayB: delay(m, 1).mean }; });
  return { any: one("any"), sticky: one("sticky"), window: one("window"), token: one("token") };
}

// 5. One slow follower (B): the commit waits for nothing, for any one follower to receive the write, or for both to
// apply it.
export function slowRun() {
  const one = (commit) => avg((seed) => {
    const m = run({ route: "any", b: "slow", commit }, seed);
    return { miss: backMiss(m), p50: rankQuantile(m.st.commits, 0.5), p99: rankQuantile(m.st.commits, 0.99) };
  });
  return { async: one("async"), semi: one("semi"), sync: one("sync") };
}

// 4. The leader crashes during a write burst (the schedule of experiment 3, below), B slow: CRASHES moments drawn at
// random inside each burst, and as many between bursts. The same run is crashed at every moment
// (failoverAt reads the timeline), and the most caught-up follower is promoted, or, for semi-sync, the other one.
export const CRASHES = 4;
export function loseRun() {
  const one = (commit) => avg((seed) => {
    const m = makeSim({ route: "any", commit, b: "slow", burst: BURSTS }, seed);
    m.runTo(RUN_SECS);
    const r = rng(seed * 31 + 5), inB = [], quiet = [];
    for (const b of BURSTS) for (let k = 0; k < CRASHES; k++) { inB.push(b.at + b.dur * r()); quiet.push(b.at + BURST_EVERY / 2 + 10 * r()); }
    const best = inB.map((T) => failoverAt(m, T)), other = inB.map((T) => failoverAt(m, T, "other")), calm = quiet.map((T) => failoverAt(m, T));
    return {
      acked: mean(best.map((f) => f.acked.length)), unacked: mean(best.map((f) => f.unacked)),
      ackedOther: mean(other.map((f) => f.acked.length)),
      calm: mean(calm.map((f) => f.acked.length)),
      // the replay backlog of the promoted follower at the crash: received, not yet applied (it isn't lost)
      backlog: mean(best.map((f) => f.recv[f.p] - f.applied[f.p])),
      p50: rankQuantile(m.st.commits, 0.5),
    };
  });
  return { async: one("async"), semi: one("semi"), sync: one("sync") };
}

// 3. A batch job writes 200 extra a second for 2 s, every 60 s: how far follower A falls behind, how long it takes
// to catch up, and the reads that miss the user's own save during it, with the 1 s leader window and with the token.
export const BURST_EVERY = 60;
const BURSTS = Array.from({ length: Math.floor((RUN_SECS - 20) / BURST_EVERY) }, (_, i) => ({ at: 20 + i * BURST_EVERY, rate: BURST.rate, dur: BURST.dur }));
export function burstRun() {
  const one = (route) => avg((seed) => {
    const m = makeSim({ route, burst: BURSTS, trace: true }, seed);
    const peaks = BURSTS.map(() => 0), peakAt = BURSTS.map(() => 0), base = [];
    let over = 0;
    m.every(0.01, (t) => {
      const lag = m.lagAt(m.F[0], t);
      const k = BURSTS.findIndex((b) => t >= b.at && t < b.at + 15);
      if (k >= 0) { if (lag > peaks[k]) { peaks[k] = lag; peakAt[k] = t - BURSTS[k].at - BURSTS[k].dur; } if (lag > WINDOW) over += 0.01; } else base.push(lag);
    }, 5, RUN_SECS);
    m.runTo(RUN_SECS);
    // during the 15 s from each burst's start: reads by users who have saved something, and those that miss it
    const inBurst = (t) => BURSTS.some((b) => t >= b.at && t < b.at + 15);
    const during = m.st.trace.filter((x) => inBurst(Math.abs(x)));
    const ownIn = during.length, missIn = during.filter((x) => x < 0).length;
    const drain = m.bursts.map((b) => m.writes[b.last - 1].f[0].end - b.end);
    const readsIn = m.st.reads_t.filter((x) => inBurst(Math.abs(x))), leaderIn = readsIn.filter((x) => x < 0).length;
    const leaderAll = m.st.reads_t.filter((x) => x < 0).length;
    const rate = m.writes.filter((w) => !w.batch && w.t > 5).length / (RUN_SECS - 5);
    return { peak: mean(peaks), peakAfter: mean(peakAt), over: over / BURSTS.length, base: mean(base), drain: mean(drain), miss: missIn / Math.max(1, ownIn), missN: missIn / BURSTS.length, leader: leaderShare(m), leaderInBursts: leaderIn / Math.max(1, leaderAll), quick: quickBack(m), rate };
  });
  return { window: one("window"), token: one("token") };
}

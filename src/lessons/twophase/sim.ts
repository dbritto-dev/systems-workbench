// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// Two-phase commit between one coordinator and three participants, A, B and C. Event-driven and seeded, shared by the
// live figure and the experiments. Times are seconds of real time (the figure plays them in slow motion).
//
// Every distributed transaction updates one hot row at each participant (a stock count, a balance): the same row that
// the participant's own local requests read and update. A transaction runs in three round trips:
//   work      the coordinator sends WORK to all three; each participant takes its row lock (waiting in line behind
//             whoever holds it), does the work and answers DONE. The lock is held from here to the end.
//   phase 1   once all three are DONE, the coordinator sends PREPARE. A participant writes a prepare record to its own
//             log (a forced write) and votes YES, or votes NO and rolls back at once. After a YES it has promised to
//             commit if told to, so it can't decide on its own any more: it keeps the lock and waits.
//   phase 2   with three YES votes the coordinator writes COMMIT to its log (the commit point; a forced write), then
//             sends COMMIT; on a NO it sends ABORT (presumed abort: nothing is logged for an abort). Each participant
//             applies the decision, releases its row lock and answers ACK.
// Links between two nodes are FIFO and take the same time every trip, so all participants see transactions in the same
// order and the row locks never deadlock.
//
// Failures:
//   crash     the coordinator crashes at a chosen point of a transaction and is back after OUTAGE s. Messages sent to
//             it meanwhile are lost; new transactions wait at its door. It remembers only what its log holds
//             ("log": the decision is forced to disk before it is sent; "memory": the decision lives in memory only).
//   unvoted   a participant that is DONE but has not voted may give up on its own: after UNPREPARED s without a
//             PREPARE it rolls back and releases the row (it never promised anything).
//   in doubt  a participant that voted YES and hears nothing for DOUBT s asks the coordinator again every RETRY s.
//             A coordinator that has no record of the transaction answers ABORT (presumed abort). With "ask the
//             others" on, it also asks the other two participants: one that knows the outcome, voted NO, or hasn't
//             voted yet (it then rolls back and answers ABORT) can settle it; one that is in doubt too can't.
//
// cfg:
//   rate      distributed transactions a second (Poisson)
//   local     local requests a second at each participant (Poisson), each holding the row LOCAL_HOLD s
//   net       "near" | "far": one-way time of every message
//   b         "normal" | "slow" (B's work takes SLOW_WORK) | "no" (B votes NO on a share NO_SHARE of transactions)
//   log       "log" | "memory"
//   doubt     "wait" (ask the coordinator only) | "peers" (ask the other participants too)
//   crash     null, or { point: "before" | "voted" | "midsend", first, every }: crash at that point of the first
//             transaction to reach it after each of the times first, first + every, …
//              before   all three are DONE, before PREPARE is sent
//              voted    the first vote has come in, before the decision
//              midsend  COMMIT has been sent to A only
//   trace     keep every message and a narration log (the live figure); off for the experiments

import { rngMixed } from "../../lib/random";
import { minHeap } from "../../lib/events";
import { averageOver, mean } from "../../lib/stats";

export const NAMES = ["A", "B", "C"];
export const COORD = -1;
export const NET = { near: 0.005, far: 0.04 };   // one-way message time: nearby services vs another region
export const WORK = 0.01;                        // each participant's work: 5 to 15 ms
export const SLOW_WORK = 0.05;                   // a slow B: 40 to 60 ms
export const FORCE = 0.002;                      // a forced log write (fsync)
export const LOCAL_HOLD = 0.002;                 // a local request holds the row 2 ms
export const OUTAGE = 0.5;                       // the coordinator is down this long after a crash
export const UNPREPARED = { near: 0.1, far: 0.2 };   // a participant that hasn't voted gives up after this long
export const DOUBT = { near: 0.03, far: 0.12 };       // a participant that voted YES starts asking after this long
export const RETRY = 0.1;                        // and asks again this often
export const NO_SHARE = 0.2;                     // B votes NO on this share of transactions
export const DEFAULTS = { rate: 10, local: 10, net: "near", b: "normal", log: "log", doubt: "wait", crash: null, trace: false };

export function makeSim(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const net = NET[cfg.net] ?? NET.near;
  const unprepared = UNPREPARED[cfg.net] ?? UNPREPARED.near, doubtAfter = DOUBT[cfg.net] ?? DOUBT.near;
  const rArr = rngMixed(seed * 31 + 7), rWork = rngMixed(seed * 131 + 3), rVote = rngMixed(seed * 977 + 11);
  const rLoc = [0, 1, 2].map((i) => rngMixed(seed * 7919 + 101 * (i + 1)));
  const events = minHeap((a, b) => a.t < b.t || (a.t === b.t && a.n < b.n));
  let n = 0, now = 0;
  const at = (t, k, x) => events.push({ t, k, x, n: n++ });
  const trace = !!cfg.trace;
  const msgs = [], log = [];
  const note = (e) => { if (trace) log.push(e); };

  // ---------- the coordinator ----------
  const coord = {
    up: true, downAt: -1, upAt: 0, crashes: 0,
    txns: new Map(),       // what it knows: id -> { id, done, votes, decision, logged, acks, sentTo }
    door: [],              // transactions that arrived while it was down
    record: null,          // the last decision it wrote (or holds in memory): { id, decision }
  };
  // ---------- the participants ----------
  const parts = [0, 1, 2].map((i) => ({ i, holder: null, queue: [], branches: new Map(), waiting: 0 }));
  // every transaction, for the figure and the stats: { id, born, started, outcome: [null,null,null], ended }
  const all = [];
  const st = { started: 0, committed: 0, aborted: 0, split: 0, holds: [[], [], []], localWaits: [[], [], []], localServed: [0, 0, 0], unilateral: 0, crashRecs: [], ends: [] };

  let crashArmed = null;          // { point } once a crash time has passed
  let manualArm = null;           // the live figure's "Crash the coordinator"
  if (cfg.crash) at(cfg.crash.first, "arm", null);

  // ---------- messages ----------
  function send(from, to, kind, txn, value) {
    const m = { from, to, kind, txn, value, sent: now, arrive: now + net };
    if (trace) msgs.push(m);
    at(m.arrive, "msg", m);
    return m;
  }

  // ---------- transactions ----------
  function arrive() {
    const tx = { id: all.length + 1, born: now, started: null, outcome: [null, null, null], ended: null, split: false };
    all.push(tx);
    if (!coord.up) { coord.door.push(tx); note({ t: now, type: "door", tx }); return; }
    start(tx);
  }
  function start(tx) {
    tx.started = now; st.started++;
    coord.txns.set(tx.id, { id: tx.id, done: 0, votes: [null, null, null], decision: null, logged: false, acks: 0, acked: [false, false, false] });
    for (let i = 0; i < 3; i++) send(COORD, i, "work", tx.id);
    note({ t: now, type: "start", tx });
  }

  // a crash point: crash here if one is armed for this point
  function crashHere(point, id) {
    const arm = manualArm && manualArm.point === point ? manualArm : crashArmed && crashArmed.point === point ? crashArmed : null;
    if (!arm || !coord.up) return false;
    if (arm === manualArm) manualArm = null; else crashArmed = null;
    crash(point, id);
    return true;
  }
  function crash(point, id) {
    coord.up = false; coord.downAt = now; coord.upAt = now + OUTAGE; coord.crashes++;
    // What survives is what the log holds: decisions forced to disk (log mode). Everything else is forgotten.
    for (const [k, c] of coord.txns) if (!(cfg.log === "log" && c.logged)) coord.txns.delete(k);
    if (cfg.log !== "log") coord.record = null;
    const rec = { t: now, point, id, upAt: coord.upAt, served: st.localServed.reduce((a, b) => a + b, 0), peakWait: 0, resolved: [null, null, null], locked: [null, null, null] };
    // branches of this transaction that had already settled (a NO voter)
    for (const p of parts) { const b = p.branches.get(id); if (b && b.endedAt !== undefined) { rec.resolved[p.i] = b.endedAt; rec.locked[p.i] = b.heldFor; } }
    st.crashRecs.push(rec);
    at(coord.upAt, "recover", null);
    note({ t: now, type: "crash", point, id });
  }
  function recover() {
    coord.up = true;
    const rec = st.crashRecs[st.crashRecs.length - 1];
    if (rec) rec.servedDuring = st.localServed.reduce((a, b) => a + b, 0) - rec.served;
    note({ t: now, type: "recover", resend: [...coord.txns.values()].filter((c) => c.decision).length });
    // Re-send every logged decision that isn't fully acknowledged.
    for (const c of coord.txns.values()) if (c.decision) for (let i = 0; i < 3; i++) if (!c.acked[i]) send(COORD, i, "decision", c.id, c.decision);
    for (const tx of coord.door.splice(0)) start(tx);
  }

  function decide(c, decision) {
    c.decision = decision;
    if (decision === "commit" && cfg.log === "log") {
      // force the COMMIT record first: that write is the commit point
      at(now + FORCE, "logged", c);
      note({ t: now, type: "forcing", id: c.id });
    } else {
      c.logged = cfg.log === "log" && decision === "commit";
      // the log holds commits only (presumed abort); a memory-only coordinator remembers its last decision either way
      if (cfg.log !== "log") coord.record = { id: c.id, decision };
      sendDecision(c);
    }
  }
  function sendDecision(c) {
    note({ t: now, type: "decide", id: c.id, decision: c.decision });
    if (c.decision === "commit") {
      send(COORD, 0, "decision", c.id, c.decision);
      if (crashHere("midsend", c.id)) return;
      send(COORD, 1, "decision", c.id, c.decision);
      send(COORD, 2, "decision", c.id, c.decision);
    } else for (let i = 0; i < 3; i++) if (c.votes[i] !== "no") send(COORD, i, "decision", c.id, c.decision);
  }

  function coordGets(m) {
    if (!coord.up) { note({ t: now, type: "lost", m }); return; }
    const c = coord.txns.get(m.txn);
    if (m.kind === "inquire") {
      // presumed abort: no record of it means it never committed
      if (!c) send(COORD, m.from, "answer", m.txn, "abort");
      else if (c.decision && (c.logged || cfg.log !== "log" || c.decision === "abort")) send(COORD, m.from, "answer", m.txn, c.decision);
      return;
    }
    if (!c) return;                                   // a transaction it no longer remembers
    if (m.kind === "done") {
      c.done++;
      if (c.done === 3) {
        if (crashHere("before", c.id)) return;
        for (let i = 0; i < 3; i++) send(COORD, i, "prepare", c.id);
        note({ t: now, type: "prepare", id: c.id });
      }
    } else if (m.kind === "vote") {
      if (c.decision) return;
      if (c.votes.every((v) => v === null) && crashHere("voted", c.id)) return;
      c.votes[m.from] = m.value;
      if (m.value === "no") decide(c, "abort");
      else if (c.votes.every((v) => v === "yes")) decide(c, "commit");
    } else if (m.kind === "ack") {
      if (c.acked[m.from]) return;
      c.acked[m.from] = true; c.acks++;
      if (c.acks === 3 || (c.decision === "abort" && c.acked.every((a, i) => a || c.votes[i] === "no"))) coord.txns.delete(c.id);
    }
  }

  // ---------- participants ----------
  const branchOf = (p, id) => {
    let b = p.branches.get(id);
    if (!b) { b = { id, state: "new", lockedAt: null, doubt: false, asked: 0 }; p.branches.set(id, b); }
    return b;
  };
  function request(p, req) {
    if (p.holder === null && !p.queue.length) grant(p, req);
    else { p.queue.push(req); if (req.kind === "local") p.waiting++; }
  }
  function grant(p, req) {
    p.holder = req;
    if (req.kind === "local") {
      st.localWaits[p.i].push([now, now - req.born]);
      at(now + LOCAL_HOLD, "localDone", p);
    } else {
      const b = req.b;
      b.state = "working"; b.lockedAt = now;
      const slow = p.i === 1 && cfg.b === "slow";
      const w = slow ? SLOW_WORK * (0.8 + 0.4 * rWork()) : WORK * (0.5 + rWork());
      at(now + w, "workDone", { p, b });
      note({ t: now, type: "lock", i: p.i, id: b.id });
    }
  }
  function release(p) {
    p.holder = null;
    while (p.queue.length) {
      const req = p.queue.shift();
      if (req.kind === "local") p.waiting--;
      if (req.kind === "txn" && req.b.state !== "queued") continue;   // rolled back while it waited in line
      grant(p, req);
      return;
    }
  }
  function finish(p, b, outcome, why) {
    const held = b.lockedAt !== null && p.holder && p.holder.b === b;
    b.state = outcome === "commit" ? "committed" : "aborted";
    b.doubt = false; b.endedAt = now; b.heldFor = b.lockedAt === null ? 0 : now - b.lockedAt;
    if (held) { st.holds[p.i].push([now, now - b.lockedAt, b.id]); release(p); }
    const tx = all[b.id - 1];
    tx.outcome[p.i] = outcome;
    // crash bookkeeping: how long the crashed transaction's rows stayed locked
    for (const r of st.crashRecs) if (r.id === b.id && r.resolved[p.i] === null) { r.resolved[p.i] = now; r.locked[p.i] = b.lockedAt === null ? 0 : now - b.lockedAt; }
    if (tx.outcome.every((o) => o !== null)) {
      tx.ended = now;
      const c = tx.outcome.filter((o) => o === "commit").length;
      if (c === 3) st.committed++, st.ends.push(now);
      else if (c === 0) st.aborted++;
      else { st.split++; tx.split = true; note({ t: now, type: "split", id: b.id, outcome: [...tx.outcome] }); }
    }
    note({ t: now, type: outcome, i: p.i, id: b.id, why, held: b.heldFor });
  }

  function partGets(p, m) {
    if (m.from !== COORD) return peerGets(p, m);
    const b = branchOf(p, m.txn);
    if (m.kind === "work") {
      if (b.state !== "new") return;                   // rolled back before the work arrived
      b.state = "queued";
      request(p, { kind: "txn", b });
    } else if (m.kind === "prepare") {
      if (b.state === "aborted") { send(p.i, COORD, "vote", b.id, "no"); return; }
      if (b.state !== "done") return;
      if (p.i === 1 && cfg.b === "no" && rVote() < NO_SHARE) {
        note({ t: now, type: "voteNo", i: p.i, id: b.id });
        finish(p, b, "abort", "no");
        send(p.i, COORD, "vote", b.id, "no");
        return;
      }
      b.state = "forcing";
      at(now + FORCE, "prepared", { p, b });
    } else if (m.kind === "decision" || m.kind === "answer") {
      if (b.state === "committed" || b.state === "aborted") { if (m.kind === "decision") send(p.i, COORD, "ack", b.id); return; }
      if (b.state === "prepared" || b.state === "done" || b.state === "forcing" || b.state === "queued" || b.state === "working") {
        if (m.value === "commit" && b.state !== "prepared") return;   // can't happen: commit needs its YES
        finish(p, b, m.value, m.kind === "answer" ? "answer" : "decision");
        send(p.i, COORD, "ack", b.id);
      }
    }
  }
  function peerGets(p, m) {
    const b = branchOf(p, m.txn);
    if (m.kind === "ask") {
      if (b.state === "committed") send(p.i, m.from, "reply", b.id, "commit");
      else if (b.state === "aborted") send(p.i, m.from, "reply", b.id, "abort");
      else if (b.state === "prepared" || b.state === "forcing") send(p.i, m.from, "reply", b.id, "unknown");
      else {
        // it hasn't voted: it may still say no, so it rolls back and says so
        st.unilateral++;
        finish(p, b, "abort", "peer");
        send(p.i, m.from, "reply", b.id, "abort");
      }
    } else if (m.kind === "reply") {
      if (b.state !== "prepared" || m.value === "unknown") return;
      finish(p, b, m.value, "peer:" + m.from);
      send(p.i, COORD, "ack", b.id);
    }
  }

  function step(e) {
    now = e.t;
    switch (e.k) {
      case "arrive": arrive(); at(now - Math.log(1 - rArr()) / cfg.rate, "arrive"); break;
      case "local": {
        const p = parts[e.x];
        request(p, { kind: "local", born: now });
        at(now - Math.log(1 - rLoc[e.x]()) / cfg.local, "local", e.x);
        break;
      }
      case "localDone": { const p = e.x; st.localServed[p.i]++; release(p); break; }
      case "msg": e.x.to === COORD ? coordGets(e.x) : partGets(parts[e.x.to], e.x); break;
      case "workDone": {
        const { p, b } = e.x;
        if (b.state !== "working") break;
        b.state = "done"; b.doneAt = now;
        send(p.i, COORD, "done", b.id);
        at(now + unprepared, "unprepared", e.x);
        break;
      }
      case "unprepared": {
        const { p, b } = e.x;
        if (b.state !== "done") break;
        st.unilateral++;
        finish(p, b, "abort", "timeout");
        break;
      }
      case "prepared": {
        const { p, b } = e.x;
        if (b.state !== "forcing") break;
        b.state = "prepared"; b.votedAt = now;
        send(p.i, COORD, "vote", b.id, "yes");
        at(now + doubtAfter, "doubt", e.x);
        break;
      }
      case "doubt": {
        const { p, b } = e.x;
        if (b.state !== "prepared") break;
        if (!b.doubt) note({ t: now, type: "doubt", i: p.i, id: b.id });
        b.doubt = true; b.asked++;
        send(p.i, COORD, "inquire", b.id);
        if (cfg.doubt === "peers") for (let j = 0; j < 3; j++) if (j !== p.i) send(p.i, j, "ask", b.id);
        at(now + RETRY, "doubt", e.x);
        break;
      }
      case "logged": {
        const c = e.x;
        if (!coord.up || coord.txns.get(c.id) !== c) break;   // crashed during the write: it never happened
        c.logged = true;
        coord.record = { id: c.id, decision: "commit" };
        sendDecision(c);
        break;
      }
      case "arm": crashArmed = { point: cfg.crash.point }; at(now + cfg.crash.every, "arm", null); break;
      case "recover": recover(); break;
    }
    // the most customers waiting at one counter during the current outage
    if (!coord.up && st.crashRecs.length) {
      const r = st.crashRecs[st.crashRecs.length - 1];
      for (const p of parts) if (p.waiting > r.peakWait) r.peakWait = p.waiting;
    }
  }

  at(-Math.log(1 - rArr()) / cfg.rate, "arrive");
  for (let i = 0; i < 3; i++) at(-Math.log(1 - rLoc[i]()) / cfg.local, "local", i);

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
    cfg, coord, parts, all, st, msgs, log, runTo,
    get now() { return now; },
    /** The live figure's "Crash the coordinator": crash at that point of the next transaction to reach it. */
    arm(point) { manualArm = { point }; },
    get armed() { return manualArm; },
    /** Transactions started and not yet over. */
    inFlight() { let k = 0; for (const x of all) if (x.ended === null) k++; return k; },
  };
}

// ---------- experiments: headless runs, averaged over seeds ----------
export const SEEDS = [3, 7, 11, 19, 23, 31, 43, 59];
export const RUN = 60;                 // seconds of each run
export const CRASH = { first: 2, every: 5 };
const avg = (fn) => averageOver(SEEDS, fn);
const done = (cfg, seed, secs = RUN) => { const m = makeSim(cfg, seed); m.runTo(secs); return m; };
const holdsOf = (m, i, from = 5) => m.st.holds[i].filter(([t]) => t >= from).map(([, h]) => h);
const waitsOf = (m, i, from = 5) => m.st.localWaits[i].filter(([t]) => t >= from).map(([, w]) => w);
const crashRecs = (m) => m.st.crashRecs.filter((r) => r.resolved.every((x) => x !== null));

// 1. The coordinator crashes before PREPARE vs while the votes come in: how long the crashed transaction's rows stay
// locked, and what happens to the local requests at the counters meanwhile.
export function crashRun() {
  const one = (point) => avg((seed) => {
    const m = done({ crash: { point, ...CRASH } }, seed);
    const recs = crashRecs(m);
    return {
      locked: mean(recs.map((r) => mean(r.locked))),
      peak: mean(recs.map((r) => r.peakWait)),
      served: mean(recs.map((r) => r.servedDuring ?? 0)) / 3,
      crashes: recs.length,
      committed: recs.filter((r) => m.all[r.id - 1].outcome.every((o) => o === "commit")).length / Math.max(1, recs.length),
    };
  });
  return { before: one("before"), voted: one("voted") };
}

// 2. B's work slows from 10 ms to 50 ms: how long A holds its row per transaction, and what A's local requests wait.
export function slowRun() {
  const one = (b) => avg((seed) => {
    const m = done({ b }, seed);
    return { holdA: mean(holdsOf(m, 0)), holdB: mean(holdsOf(m, 1)), holdC: mean(holdsOf(m, 2)), waitA: mean(waitsOf(m, 0)), unilateral: m.st.unilateral };
  });
  return { normal: one("normal"), slow: one("slow") };
}

// 3. Every participant moves from 5 ms away to 40 ms away: commits a second on the hot rows.
export function farRun() {
  const one = (net) => avg((seed) => {
    const m = done({ net }, seed);
    const commits = m.st.ends.filter((t) => t >= 10).length / (RUN - 10);
    return { perSec: commits, holdA: mean(holdsOf(m, 0)), inFlight: m.inFlight(), unilateral: m.st.unilateral };
  });
  return { near: one("near"), far: one("far") };
}

// 4. The coordinator crashes after sending COMMIT to A only: decision forced to its log first vs kept in memory.
export function logRun() {
  const one = (log) => avg((seed) => {
    const m = done({ log, crash: { point: "midsend", ...CRASH } }, seed);
    const recs = crashRecs(m);
    const outs = recs.map((r) => m.all[r.id - 1].outcome);
    return {
      crashes: recs.length,
      allCommit: outs.filter((o) => o.every((x) => x === "commit")).length,
      split: outs.filter((o) => o.includes("commit") && o.includes("abort")).length,
      lockedBC: mean(recs.map((r) => (r.locked[1] + r.locked[2]) / 2)),
    };
  });
  return { log: one("log"), memory: one("memory") };
}

// 5. B votes NO one time in five; the coordinator crashes while the votes come in. In doubt: wait for the coordinator
// vs ask the other participants too. Share of crashes whose rows stayed locked until the coordinator was back.
export function peersRun() {
  const one = (doubt) => avg((seed) => {
    const m = done({ b: "no", doubt, crash: { point: "voted", ...CRASH } }, seed);
    const recs = crashRecs(m);
    // blocked: some participant was still holding its row, in doubt, when the coordinator came back
    const blocked = recs.filter((r) => r.resolved.some((x) => x >= r.upAt)).length;
    const bNo = recs.filter((r) => r.resolved[1] !== null && r.resolved[1] <= r.t).length;
    return { crashes: recs.length, blocked: blocked / Math.max(1, recs.length), lockedA: mean(recs.map((r) => r.locked[0])), bNo: bNo / Math.max(1, recs.length) };
  });
  return { wait: one("wait"), peers: one("peers") };
}

// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// Five replicas of one record and the coordinator in front of them. Event-driven and seeded, shared by the live figure
// and the experiments. Times are milliseconds of real time (the figure plays them a few hundred times slower).
//
// Every replica holds the record's version number. A write gets the next version from the coordinator, goes to every
// live replica, and the coordinator answers OK after W acks. A read asks R live replicas, picked at random, and returns
// the highest version among their replies. A replica acks a write once it has applied it, and answers a read with the
// version it holds at that moment. Nothing is lost on the way; what varies is how long each message takes:
//
//   network     every leg, coordinator ↔ replica, takes NET (0.4–1.2 ms)
//   work        a replica takes PROC (0.3–1.0 ms) to handle a message
//   repl        "steady"  that's all
//               "busy"    a third of the writes wait BUSY.extra (3–15 ms) more at a replica before it applies them (a
//                         backlog of writes to apply); reads are answered at once from what the replica holds
//               "slow"    replica E applies every write SLOW_E ms late (a sick replica: a failing disk, a backlog)
//   down        0–3 replicas down (E, then D, then C). The coordinator knows (its failure detector says so): a write
//               or a read that can't get W or R live replicas fails at once, without being sent
//   repair      "off"     the read returns the highest version and leaves the replicas as they are
//               "on"      blocking read repair: when the replies disagree, the coordinator writes the highest version to
//                         the replicas that replied with an older one, and answers only once they have acked
//   readers     "one"     a writer writes, reads its write back as soon as it's acknowledged, waits THINK, writes again
//               "many"    the same, plus other clients reading the record at random moments (every READ_GAP ms on
//                         average)
//
// A read is STALE when it returns a version older than the newest write acknowledged before the read began. It goes
// BACKWARDS when it returns a version older than a read that had already returned before it began.

import { rng } from "../../lib/random";
import { minHeap } from "../../lib/events";
import { averageOver, rankQuantile, mean } from "../../lib/stats";

export const N = 5;
export const NAMES = ["A", "B", "C", "D", "E"];
export const NET = [0.4, 0.8];                 // one network leg: 0.4 to 1.2 ms
export const PROC = [0.3, 0.7];                // a replica's work on a message: 0.3 to 1.0 ms
export const BUSY = { share: 1 / 3, extra: [3, 12] };   // "busy": a third of writes wait 3 to 15 ms more
export const SLOW_E = 12;                      // "slow": replica E applies every write 12 ms late
export const GAP_RB = 0.3;                     // the writer reads back 0.3 ms after the OK
export const THINK = [2, 3];                   // and writes again 2 to 5 ms after that read
export const READ_GAP = 2;                     // "many": another client reads every 2 ms on average
export const DEFAULTS = { R: 2, W: 2, down: 0, repl: "busy", repair: "off", readers: "one" };

export const isDown = (i, down) => i >= N - down;

export function makeSim(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const R = Number(cfg.R), W = Number(cfg.W), down = Number(cfg.down);
  const rNet = rng(seed * 2654435761 + 11), rWork = rng(seed * 40503 + 97), rPick = rng(seed * 69069 + 5), rLoad = rng(seed * 22695477 + 3);
  const events = minHeap((a, b) => a.t < b.t || (a.t === b.t && a.n < b.n));
  let n = 0, now = 0;
  const at = (t, k, x) => events.push({ t, k, x, n: n++ });

  const reps = NAMES.map((name, i) => ({ i, name, version: 0, down: isDown(i, down) }));
  const live = reps.filter((r) => !r.down).map((r) => r.i);
  const ops = [];            // every write and read: { id, kind, who, t, ... }
  const msgs = [];           // every message, for the figure: { op, kind: "w" | "r" | "fix", rep, sent, arrive, served, done, v }
  const log = [];            // what the live figure narrates
  const st = { okW: 0, failW: 0, reads: 0, failR: 0, stale: 0, back: 0, repairs: 0, rb: 0, rbStale: 0 };
  const lat = { w: [], r: [] };
  let seq = 0;               // the newest version the coordinator has handed out
  let lastOk = 0;            // the newest version acknowledged to a client
  let maxRead = 0;           // the highest version any finished read has returned

  const net = () => NET[0] + NET[1] * rNet();
  const work = () => PROC[0] + PROC[1] * rWork();
  // How late a replica applies a write: drawn for every write message, so every setting sees the same dice.
  function applyDelay(i) {
    const p = rLoad(), x = rLoad();
    if (cfg.repl === "busy" && p < BUSY.share) return BUSY.extra[0] + BUSY.extra[1] * x;
    if (cfg.repl === "slow" && i === N - 1) return SLOW_E;
    return 0;
  }

  // ---------- writes ----------
  function write(t, who) {
    const op = { id: ops.length, kind: "write", who, t, need: W, acks: 0, status: "flight", msgs: [] };
    ops.push(op);
    if (live.length < W) {
      op.status = "failed"; op.doneAt = t; st.failW++;
      log.push({ t, type: "wUnavailable", op });
      at(t, "opDone", op);
      return op;
    }
    op.v = ++seq;
    for (const i of live) sendMut(t, op, i, op.v, "w");
    log.push({ t, type: "wSent", op });
    return op;
  }
  function sendMut(t, op, i, v, kind) {
    const out = net(), wk = work(), late = applyDelay(i), back = net();
    const m = { id: msgs.length, op, kind, rep: i, sent: t, arrive: t + out, served: t + out + wk + late, done: t + out + wk + late + back, v, late: late > 0 };
    msgs.push(m); op.msgs.push(m);
    at(m.served, "apply", m); at(m.done, "ack", m);
    return m;
  }
  function onApply(t, m) {
    const r = reps[m.rep];
    if (m.v > r.version) { r.version = m.v; m.applied = true; }
    if (m.kind === "w" && m.late) log.push({ t, type: "lateApply", m });
  }
  function onAck(t, m) {
    const op = m.op;
    if (m.kind === "fix") return onFixAck(t, m);
    op.acks++;
    if (op.status === "flight" && op.acks >= op.need) {
      op.status = "ok"; op.doneAt = t; st.okW++;
      lat.w.push(t - op.t);
      if (op.v > lastOk) lastOk = op.v;
      log.push({ t, type: "wOk", op });
      at(t, "opDone", op);
    }
  }

  // ---------- reads ----------
  function read(t, who) {
    const op = { id: ops.length, kind: "read", who, t, need: R, replies: [], status: "flight", msgs: [], okBefore: lastOk, seenBefore: maxRead };
    ops.push(op);
    if (live.length < R) {
      op.status = "failed"; op.doneAt = t; st.failR++;
      log.push({ t, type: "rUnavailable", op });
      at(t, "opDone", op);
      return op;
    }
    // R distinct live replicas, at random
    const pool = [...live];
    for (let k = 0; k < R; k++) {
      const j = k + Math.floor(rPick() * (pool.length - k));
      [pool[k], pool[j]] = [pool[j], pool[k]];
    }
    op.asked = pool.slice(0, R).sort((a, b) => a - b);
    for (const i of op.asked) {
      const out = net(), wk = work(), back = net();
      const m = { id: msgs.length, op, kind: "r", rep: i, sent: t, arrive: t + out, served: t + out + wk, done: t + out + wk + back, v: null };
      msgs.push(m); op.msgs.push(m);
      at(m.served, "serve", m); at(m.done, "reply", m);
    }
    log.push({ t, type: "rSent", op });
    return op;
  }
  function onServe(t, m) { m.v = reps[m.rep].version; }
  function onReply(t, m) {
    const op = m.op;
    op.replies.push(m);
    if (op.replies.length < op.need) return;
    op.result = Math.max(...op.replies.map((x) => x.v));
    const old = op.replies.filter((x) => x.v < op.result);
    if (cfg.repair === "on" && old.length) {
      op.status = "repairing"; op.fixing = old.length;
      st.repairs += old.length;
      for (const x of old) sendMut(t, op, x.rep, op.result, "fix");
      log.push({ t, type: "repair", op, old });
      return;
    }
    finishRead(t, op);
  }
  function onFixAck(t, m) {
    const op = m.op;
    if (--op.fixing === 0) finishRead(t, op);
  }
  function finishRead(t, op) {
    op.status = "ok"; op.doneAt = t;
    st.reads++;
    lat.r.push(t - op.t);
    op.stale = op.result < op.okBefore;
    op.backwards = op.result < op.seenBefore;
    if (op.stale) st.stale++;
    if (op.backwards) st.back++;
    if (op.who === "writer") { st.rb++; if (op.stale) st.rbStale++; }
    if (op.result > maxRead) maxRead = op.result;
    log.push({ t, type: "rDone", op });
    at(t, "opDone", op);
  }

  // ---------- the clients ----------
  function onOpDone(t, op) {
    if (op.who !== "writer") return;
    if (op.kind === "write") at(t + GAP_RB, "readback", op);
    else at(t + THINK[0] + THINK[1] * rPick(), "write");
  }
  at(0.6, "write");
  if (cfg.readers === "many") at(1 + READ_GAP * -Math.log(1 - rPick()), "otherRead");

  function step(e) {
    now = e.t;
    const t = e.t;
    switch (e.k) {
      case "write": write(t, "writer"); break;
      case "readback": { const op = read(t, "writer"); op.after = e.x; break; }
      case "otherRead": read(t, "reader"); at(t + READ_GAP * -Math.log(1 - rPick()), "otherRead"); break;
      case "apply": onApply(t, e.x); break;
      case "ack": onAck(t, e.x); break;
      case "serve": onServe(t, e.x); break;
      case "reply": onReply(t, e.x); break;
      case "opDone": onOpDone(t, e.x); break;
    }
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
    cfg, reps, ops, msgs, log, st, lat,
    runTo,
    /** A write or a read from the visitor, now. */
    visitor(kind, t) { runTo(t); return kind === "write" ? write(t, "visitor") : read(t, "visitor"); },
    get now() { return now; },
    get lastOk() { return lastOk; },
    get seq() { return seq; },
    get live() { return live; },
  };
}

// ---------- experiments: headless runs, averaged over seeds ----------
export const SEEDS = [3, 7, 11, 19, 23, 31, 43, 59];
export const RUN_MS = 20000;          // twenty seconds of traffic per seed
const avg = (fn) => averageOver(SEEDS, fn);
const run = (cfg, seed, ms = RUN_MS) => { const m = makeSim(cfg, seed); m.runTo(ms); return m; };
const share = (a, b) => (b ? a / b : 0);

// What one setting gives, averaged over the seeds.
export function measure(cfg) {
  return avg((seed) => {
    const m = run(cfg, seed);
    const s = m.st, writes = s.okW + s.failW, reads = s.reads + s.failR;
    return {
      rbStale: share(s.rbStale, s.rb), stale: share(s.stale, s.reads), back: share(s.back, s.reads),
      failW: share(s.failW, writes), failR: share(s.failR, reads),
      w50: rankQuantile(m.lat.w, 0.5), w99: rankQuantile(m.lat.w, 0.99),
      r50: rankQuantile(m.lat.r, 0.5), r99: rankQuantile(m.lat.r, 0.99), rMean: mean(m.lat.r),
      repairs: share(s.repairs, s.reads), reads: s.reads, rb: s.rb,
    };
  });
}

// 1. Every replica healthy, a third of writes applied late: R = W = 1 against R = W = 3. The writer's read-backs.
export function oneRun() {
  return { one: measure({ R: 1, W: 1, repl: "busy" }), quorum: measure({ R: 3, W: 3, repl: "busy" }) };
}
// 2. Overlap, not majority: R = 2 with W = 2, W = 3 (R + W = N) and R = W = 3.
export function overlapRun() {
  return { w2: measure({ R: 2, W: 2, repl: "busy" }), w3: measure({ R: 2, W: 3, repl: "busy" }), r3: measure({ R: 3, W: 3, repl: "busy" }) };
}
// 3. Replicas down: R = W = 3 with one, two and three down, and W = 5 (with R = 1) with one down.
export function downRun() {
  const q = (down) => measure({ R: 3, W: 3, down, repl: "busy" });
  return { q1: q(1), q2: q(2), q3: q(3), all1: measure({ R: 1, W: 5, down: 1, repl: "busy" }), all0: measure({ R: 1, W: 5, down: 0, repl: "busy" }) };
}
// 4. One slow replica: write latency at W = 3 and W = 5, against the same with every replica steady.
export function slowRun() {
  return {
    q: measure({ R: 3, W: 3, repl: "slow" }), all: measure({ R: 1, W: 5, repl: "slow" }),
    qSteady: measure({ R: 3, W: 3, repl: "steady" }), allSteady: measure({ R: 1, W: 5, repl: "steady" }),
  };
}
// 5. R = W = 3, other clients reading while writes are in flight: read repair off and on.
export function backRun() {
  return { off: measure({ R: 3, W: 3, repl: "busy", readers: "many", repair: "off" }), on: measure({ R: 3, W: 3, repl: "busy", readers: "many", repair: "on" }) };
}

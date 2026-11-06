// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// A sender, a queue, three workers, a ledger (the database) and a mail service (the outside world). Event-driven and
// seeded, shared by the live figure and the experiments. Times are seconds.
//
// The sender turns each order into a message and sends it to the queue; the queue stores it and replies. If the reply
// is lost, the sender can't tell whether the message arrived, so after RETRY s it sends it again: a second message for
// the same order, with a new message id. A free worker receives the message at the front of the queue; the queue hides
// it for the visibility timeout (VT). The worker does the work, mails the customer a letter, writes the order in the
// ledger and acks (deletes the message). If the message isn't acked before its timeout runs out, it becomes visible
// again and the next free worker receives it, whether or not the first one is still working on it. A worker can crash
// at any moment of an attempt; it is back DOWN s later. Each step takes effect when it ends.
//
// cfg:
//   ack      "first" ack on receipt, then work, letter, ledger (at most once)
//            "after" work, letter, ledger, then ack (at least once)
//            "txn"   work, letter, then one transaction: the ledger entry and the ack commit together, and the commit
//                    fails if the message was already acked by another holder (the "exactly-once" mode of a broker that
//                    commits the consumer's position with its writes)
//   vt       visibility timeout, s; heartbeat: the worker extends it every HB s while it works
//   crash    chance an attempt ends with the worker crashing, at a uniformly random moment of the attempt
//   lostAck  chance the queue's reply to the sender is lost (the message is stored all the same)
//   dedupe   "off" | "msg" (remember message ids) | "order" (remember order ids): checked before the work, and the id is
//            recorded in the same transaction as the ledger entry, so a second entry for a remembered id is refused
//   key      the letter carries the order id as an idempotency key; the mail service drops a repeat

import { rng } from "../../lib/random";
import { minHeap } from "../../lib/events";
import { averageOver } from "../../lib/stats";

export const WORKERS = 3;
export const RATE = 0.25;                   // orders a second
export const WORK = [1, 2];                 // ordinary work: 1–3 s
export const SLOW_SHARE = 0.1;              // one order in 10 is slow
export const SLOW = [12, 18];               // slow work: 12–30 s (the same order is just as slow every time)
export const LETTER = [0.8, 0.8];           // calling the mail service: 0.8–1.6 s
export const LEDGER = [0.3, 0.3];           // the ledger write: 0.3–0.6 s
export const ACK = [0.2, 0.2];              // the ack: 0.2–0.4 s
export const CHECK = 0.2;                   // looking an id up in the dedupe table
export const HB = 3;                        // heartbeat interval
export const RETRY = 3;                     // the sender resends after 3 s without a reply
export const SEND = 0.15;                   // sender to queue
export const DOWN = 6;                      // a crashed worker is back after 6 s
export const DEFAULTS = { ack: "after", vt: 10, heartbeat: false, crash: 0.1, lostAck: 0, dedupe: "off", key: false, rate: RATE };

export function makeSim(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const VT = Number(cfg.vt);
  const rArr = rng(seed * 2654435761 + 17), rJob = rng(seed * 40503 + 101), rCrash = rng(seed * 69069 + 7), rNet = rng(seed * 1103515245 + 12345);
  const ev = minHeap((a, b) => a.t < b.t || (a.t === b.t && a.n < b.n));
  let n = 0, now = 0, nextOrder = 1, nextMid = 1, nextAtt = 1, arrivals = cfg.rate > 0, crashNext = false;
  const at = (t, k, x) => ev.push({ t, k, x, n: n++ });
  const span = ([a, b], r) => a + b * r();

  const orders = [];
  const visible = [];                       // messages waiting to be received, front first
  const inflight = new Set();               // messages received and hidden, not yet acked
  const seen = new Set();                   // the dedupe table, kept with the ledger
  const keys = new Set();                   // the mail service's idempotency keys
  const workers = Array.from({ length: WORKERS }, (_, i) => ({ i, att: null, downUntil: -1, crashes: 0 }));
  const st = { inLedger: 0, orders: 0, sends: 0, resent: 0, stored: 0, receives: 0, again: 0, entries: 0, ledgerTwice: 0, ledgerThrice: 0, letters: 0, lettersTwice: 0, dropped: 0,
    lost: 0, skipped: 0, refused: 0, fenced: 0, crashes: 0, recoverSum: 0, recoverN: 0, busy: 0, copyBusy: 0 };
  const log = [];
  const say = (t, type, x = {}) => log.push({ t, type, ...x });

  // ---------- the sender ----------
  function newOrder(t, extra = {}) {
    const slow = extra.slow ?? rArr() < SLOW_SHARE;
    const o = { id: nextOrder++, born: t, slow, base: slow ? span(SLOW, rArr) : span(WORK, rArr), ledger: 0, letters: 0, receives: 0, copies: 0, open: 0, lostDone: false, loseNext: !!extra.loseAck };
    orders.push(o);
    st.orders++;
    send(t, o, false);
    say(t, "order", { o });
    return o;
  }
  function send(t, o, again) {
    st.sends++;
    if (again) { st.resent++; say(t, "resend", { o }); }
    const lose = o.loseNext || rNet() < cfg.lostAck;
    o.loseNext = false;
    at(t + SEND, "stored", { o, lose, again });
  }
  function stored(t, o, lose, again) {
    const m = { mid: nextMid++, o, acked: false, receives: 0, visibleAt: t, holder: null, born: t, resent: again, lastRecv: 0, crashAt: null };
    o.copies++; o.open++;
    st.stored++;
    visible.push(m);
    say(t, "stored", { m, lose });
    if (lose) at(t + RETRY - SEND, "retry", { o });
    dispatch(t);
  }

  // ---------- the queue ----------
  function ackMsg(t, m, w) {
    if (m.acked) return false;
    m.acked = true; m.ackedBy = w;
    inflight.delete(m);
    const i = visible.indexOf(m);
    if (i >= 0) visible.splice(i, 1);
    close(t, m.o);
    say(t, "acked", { m, w });
    return true;
  }
  // an order is lost once nothing can still write it: every copy acked, no attempt still running, no ledger entry
  function close(t, o) {
    o.open--;
    if (o.open === 0 && o.ledger === 0 && !o.lostDone) { o.lostDone = true; st.lost++; say(t, "lost", { o }); }
  }
  function show(t, m, recv) {
    if (m.acked || m.lastRecv !== recv || m.visibleAt > t + 1e-9) return;
    inflight.delete(m);
    visible.unshift(m);
    say(t, "shown", { m, held: !!m.holder, holder: m.holder ? m.holder.i : -1 });   // who still has it, as of now
    dispatch(t);
  }

  // ---------- the workers ----------
  function dispatch(t) {
    for (const w of workers) {
      if (w.att || w.downUntil > t || !visible.length) continue;
      receive(t, w, visible.shift());
    }
  }
  function receive(t, w, m) {
    m.receives++; m.o.receives++; st.receives++;
    if (m.o.receives === 2) st.again++;
    if (cfg.ack !== "first") inflight.add(m);
    if (m.crashAt !== null) { st.recoverSum += t - m.crashAt; st.recoverN++; m.crashAt = null; }
    m.lastRecv = m.receives;
    m.visibleAt = t + VT;
    m.holder = w;
    m.o.open++;
    const o = m.o;
    // the steps of this attempt, each with when it ends
    const steps = [];
    let end = t;
    const add = (name, d) => { end += d; steps.push({ name, end }); };
    const dedupeKey = cfg.dedupe === "msg" ? "m" + m.mid : cfg.dedupe === "order" ? "o" + o.id : null;
    const skip = dedupeKey !== null && seen.has(dedupeKey);
    if (cfg.ack === "first") add("ack", span(ACK, rJob));
    if (dedupeKey !== null) add("check", CHECK);
    if (!skip) {
      add("work", o.base * (0.9 + 0.2 * rJob()));
      add("letter", span(LETTER, rJob));
      if (cfg.ack === "txn") add("commit", span(LEDGER, rJob) + span(ACK, rJob));
      else add("ledger", span(LEDGER, rJob));
    }
    if (cfg.ack === "after" || (cfg.ack === "txn" && skip)) add("ack", span(ACK, rJob));
    const att = { id: nextAtt++, w, m, o, start: t, steps, k: 0, end, skip, dedupeKey, recv: m.receives, copy: o.receives > 1, crashAt: null, done: false, crashedAfter: null };
    if (rCrash() < cfg.crash) att.crashAt = t + rCrash() * (end - t);
    w.att = att;
    at(steps[0].end, "step", { att });
    if (att.crashAt !== null) at(att.crashAt, "crash", { att });
    if (cfg.ack !== "first") {
      at(m.visibleAt, "show", { m, recv: m.receives });
      if (cfg.heartbeat) at(t + HB, "beat", { att });
    }
    say(t, "receive", { m, w, copy: att.copy, skip });
  }
  function onStep(t, att) {
    if (att.done) return;
    const s = att.steps[att.k], { m, o, w } = att;
    switch (s.name) {
      case "ack":
        ackMsg(t, m, w);
        break;
      case "check":
        if (att.skip) { st.skipped++; say(t, "skip", { m, w }); }
        break;
      case "letter":
        if (cfg.key && keys.has(o.id)) { st.dropped++; say(t, "dropped", { m, w }); if (crashNext) { crashNext = false; at(t + 0.05, "crash", { att }); } break; }
        keys.add(o.id);
        o.letters++; st.letters++;
        if (o.letters === 2) st.lettersTwice++;
        say(t, "letter", { m, w, n: o.letters });
        if (crashNext) { crashNext = false; at(t + 0.05, "crash", { att }); }
        break;
      case "ledger":
        if (att.dedupeKey !== null && seen.has(att.dedupeKey)) { st.refused++; say(t, "refused", { m, w }); break; }
        write(t, att);
        break;
      case "commit":
        if (m.acked) { st.fenced++; say(t, "fenced", { m, w }); break; }
        if (att.dedupeKey !== null && seen.has(att.dedupeKey)) { st.refused++; ackMsg(t, m, w); break; }
        write(t, att);
        ackMsg(t, m, w);
        break;
    }
    att.k++;
    if (att.k < att.steps.length) at(att.steps[att.k].end, "step", { att });
    else finish(t, att);
  }
  function write(t, att) {
    const o = att.o;
    if (att.dedupeKey !== null) seen.add(att.dedupeKey);
    o.ledger++; st.entries++;
    if (o.ledger === 1) st.inLedger++;
    if (o.ledger === 2) st.ledgerTwice++;
    if (o.ledger === 3) st.ledgerThrice++;
    say(t, "ledger", { m: att.m, w: att.w, n: o.ledger });
  }
  function finish(t, att) {
    att.done = true;
    const w = att.w;
    st.busy += t - att.start; if (att.copy) st.copyBusy += t - att.start;
    if (att.m.holder === w) att.m.holder = null;
    w.att = null;
    close(t, att.o);
    say(t, "done", { m: att.m, w });
    dispatch(t);
  }
  function crash(t, att) {
    if (att.done) return;
    att.done = true;
    const w = att.w, m = att.m;
    st.crashes++; w.crashes++;
    st.busy += t - att.start; if (att.copy) st.copyBusy += t - att.start;
    att.crashedAfter = att.k > 0 ? att.steps[att.k - 1].name : null;
    if (m.holder === w) m.holder = null;
    if (!m.acked && m.lastRecv === att.recv) m.crashAt = t;
    w.att = null;
    w.downUntil = t + DOWN;
    at(t + DOWN, "up", { w });
    say(t, "crash", { m, w, after: att.crashedAfter });
    close(t, att.o);
  }
  function beat(t, att) {
    if (att.done) return;
    const m = att.m;
    if (!m.acked && m.lastRecv === att.recv) { m.visibleAt = t + VT; at(m.visibleAt, "show", { m, recv: m.lastRecv }); }
    at(t + HB, "beat", { att });
  }

  let nextArrival = arrivals ? -Math.log(1 - rArr()) / cfg.rate : Infinity;
  if (arrivals) at(nextArrival, "arrive", {});

  function step(e) {
    const t = e.t, x = e.x;
    now = t;
    switch (e.k) {
      case "arrive":
        if (!arrivals) break;
        newOrder(t);
        at(t - Math.log(1 - rArr()) / cfg.rate, "arrive", {});
        break;
      case "stored": stored(t, x.o, x.lose, x.again); break;
      case "retry": send(t, x.o, true); break;
      case "step": onStep(t, x.att); break;
      case "crash": crash(t, x.att); break;
      case "show": show(t, x.m, x.recv); break;
      case "beat": beat(t, x.att); break;
      case "up": dispatch(t); say(t, "up", { w: x.w }); break;
    }
  }
  function runTo(T) {
    for (;;) {
      const e = ev.peek();
      if (!e || e.t > T) break;
      ev.pop();
      step(e);
    }
    now = T;
  }

  return {
    cfg, orders, visible, inflight, workers, st, log, runTo, seen, keys,
    get now() { return now; },
    stopArrivals() { arrivals = false; },
    /** A slow order (`secs` of work), sent now. */
    slowOrder(secs = 26) { const o = newOrder(now, { slow: true }); o.base = secs; return o; },
    /** The next order the sender sends: the queue's reply to it is lost. */
    loseNextAck() { const o = newOrder(now, { loseAck: true }); return o; },
    /** The next worker to finish mailing a letter crashes right after it, before the ledger entry and the ack. */
    crashAfterLetter() { crashNext = true; },
  };
}

// ---------- experiments: headless runs averaged over seeds ----------
export const SEEDS = [3, 7, 11, 19, 23, 31, 43, 59];
export const RUN_SECS = 3600;
const avg = (fn) => averageOver(SEEDS, fn);

export function measure(cfg) {
  return avg((seed) => {
    const m = makeSim(cfg, seed);
    m.runTo(RUN_SECS);
    m.stopArrivals();
    m.runTo(RUN_SECS + 600);
    const k = 1000 / Math.max(1, m.st.orders);
    const per = (x) => x * k;
    const workSecs = WORKERS * RUN_SECS;
    return {
      orders: m.st.orders,
      ledgerTwice: per(m.st.ledgerTwice), ledgerThrice: per(m.st.ledgerThrice),
      lettersTwice: per(m.st.lettersTwice), lost: per(m.st.lost),
      again: per(m.st.again), receivesPer: m.st.receives / Math.max(1, m.st.orders),
      resent: per(m.st.resent), dropped: per(m.st.dropped), crashes: per(m.st.crashes),
      recover: m.st.recoverN ? m.st.recoverSum / m.st.recoverN : 0,
      copyShare: m.st.copyBusy / Math.max(1e-9, m.st.busy), busy: m.st.busy / workSecs,
      slow: per(m.orders.filter((o) => o.slow).length),
    };
  });
}

const BASE = { ack: "after", vt: 60, heartbeat: false, crash: 0, lostAck: 0, dedupe: "off", key: false };
// 1. Slow orders and a visibility timeout shorter than their work, nothing crashes.
export const slowRun = () => ({ long: measure(BASE), short: measure({ ...BASE, vt: 10 }) });
// 2. Workers crash: a long timeout vs a short one with a heartbeat.
export const beatRun = () => ({ long: measure({ ...BASE, crash: 0.1 }), beat: measure({ ...BASE, crash: 0.1, vt: 10, heartbeat: true }) });
// 3. Lost replies to the sender: dedupe on the message id vs the order id.
export const senderRun = () => {
  const b = { ...BASE, crash: 0.1, lostAck: 0.1 };
  return { off: measure(b), msg: measure({ ...b, dedupe: "msg" }), order: measure({ ...b, dedupe: "order" }) };
};
// 4. The ledger entry and the ack in one transaction.
export const txnRun = () => ({ after: measure({ ...BASE, crash: 0.1 }), txn: measure({ ...BASE, crash: 0.1, ack: "txn" }) });
// 5. Every source of repeats on, dedupe by order id: a plain letter vs a letter with a key.
export const keyRun = () => {
  const b = { ...BASE, vt: 10, crash: 0.1, lostAck: 0.1, dedupe: "order" };
  return { plain: measure(b), keyed: measure({ ...b, key: true }) };
};

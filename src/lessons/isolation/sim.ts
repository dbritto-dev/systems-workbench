// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// A records office: clerks (or doctors) run transactions against shared rows in a database that keeps versions (MVCC),
// the way PostgreSQL does. Event-driven and seeded, shared by the live figure and the experiments. Times are seconds of
// app time (the figure plays them in slow motion); the numbers are illustrative and round.
//
// Every row keeps its committed versions, each stamped with the time it committed. A transaction's reads see:
//   rc   READ COMMITTED: every statement sees the latest committed version at the moment it starts
//   rr   REPEATABLE READ (PostgreSQL: snapshot isolation): every statement sees the snapshot taken at the
//        transaction's first statement
//   ser  SERIALIZABLE (PostgreSQL: serializable snapshot isolation, SSI): the same snapshot, plus a check at COMMIT
//        for the read/write pattern that no serial order could produce
// Writes take a row lock held to COMMIT or ROLLBACK; a second writer queues behind it. When the lock comes free:
//   rc   the waiting UPDATE goes on against the newest committed version (an atomic x = x + 10 adds to it; a value the
//        app worked out from an earlier read is written as it is)
//   rr, ser  if the row was changed after the snapshot, the transaction fails: "could not serialize access due to
//        concurrent update", SQLSTATE 40001. SELECT … FOR UPDATE takes the same lock and follows the same rules.
// The app retries a failed transaction from the start, with a new snapshot, after a short pause.
//
// Two scenarios:
//   deposits  each clerk adds 10 to one account: SELECT the balance, do some app work, UPDATE, COMMIT.
//             write: "rmw"    UPDATE … SET balance = <what I read + 10>
//                    "atomic" UPDATE … SET balance = balance + 10 (the read still comes first, to show the customer)
//                    "lock"   SELECT … FOR UPDATE, then SET balance = <what I read + 10>
//   rota      a ward rota with one row per doctor; rule: at least one doctor on call. Each night every doctor starts
//             on call and asks to go off: count who is on call, do some app work, and go off only if two or more are.
//             check: "plain" a plain SELECT of the rota · "lock" SELECT … FOR UPDATE of the on-call rows
//
// The SSI check is a simplification of PostgreSQL's (Cahill, Röhm and Fekete's dangerous structure, checked at COMMIT
// over the rows each transaction read and wrote): T commits unless some concurrent Tin read a row T wrote while T read a
// row that an already-committed Tout wrote after T's snapshot (or T read a row that a committed P wrote, and P had
// read a row that an even earlier committed Tout wrote). PostgreSQL also checks earlier and coarser (pages, whole
// tables), so it can abort a little more often than this.

import { rng } from "../../lib/random";
import { minHeap } from "../../lib/events";
import { averageOver } from "../../lib/stats";

export const WORK = [0.25, 0.3];      // app work between the read and the write: 250 to 550 ms
export const TAIL = 0.04;             // from the UPDATE to COMMIT: 40 ms
export const IDLE = [0.3, 1.2];       // a clerk's gap between deposits: 0.3 to 1.5 s
export const BACKOFF = [0.03, 0.06];  // the pause before a retry: 30 to 90 ms
export const NIGHT = { window: 1.6, gap: 0.5 };   // each doctor asks within 1.6 s of the night starting
export const DEPOSIT = 10;
export const START = 100;
export const NAMES = "ABCD";
export const DEFAULTS = { scenario: "deposits", level: "rc", write: "rmw", check: "plain", people: 2, per: Infinity };

const latest = (row) => row.versions[row.versions.length - 1];
function visible(row, at) {
  for (let i = row.versions.length - 1; i >= 0; i--) if (row.versions[i].t <= at) return row.versions[i];
  return row.versions[0];
}
const meets = (reads, writes) => { for (const r of reads) if (writes.has(r)) return true; return false; };

export function makeSim(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rota = cfg.scenario === "rota";
  const n = Math.max(2, Math.min(4, Number(cfg.people)));
  const R = rng(seed * 2654435761 + 97);
  const events = minHeap((a, b) => a.t < b.t || (a.t === b.t && a.n < b.n));
  let seq = 0, now = 0, ids = 0;
  const at = (t, k, x) => events.push({ t, k, x, n: seq++ });

  const rows = {};
  const rowNames = rota ? NAMES.slice(0, n).split("") : ["acct"];
  for (const r of rowNames) rows[r] = { name: r, versions: [{ v: rota ? true : START, t: -1, by: null }], lock: null, queue: [] };

  const clerks = Array.from({ length: n }, (_, i) => ({ i, phase: "idle", txn: null, read: null, done: 0, tries: 0, reqStart: 0, nightDone: true }));
  const stats = { commits: 0, made: 0, lost: 0, aborts: 0, abortsUpdate: 0, abortsSsi: 0, waits: 0, waitTime: 0, reqTime: 0, reqs: 0, nights: 0, broken: 0, overlap: 0, stays: 0 };
  const log = [];
  const attempts = [];          // every attempt, for the figure's timeline: { id, i, t0, t1, end, waits, marks }
  const hist = [];              // transactions the SSI check looks at
  let night = null;             // { n, t0, firsts: [[t0, t1] per doctor] }

  // ---------- transactions ----------
  function script() {
    if (rota) return [{ op: "readAll", lock: cfg.check === "lock" }, { op: "work" }, { op: "off" }, { op: "tail" }, { op: "commit" }];
    if (cfg.write === "lock") return [{ op: "read", lock: true }, { op: "work" }, { op: "write", how: "literal" }, { op: "tail" }, { op: "commit" }];
    return [{ op: "read" }, { op: "work" }, { op: "write", how: cfg.write === "atomic" ? "add" : "literal" }, { op: "tail" }, { op: "commit" }];
  }
  function begin(t, c) {
    const txn = { id: ++ids, i: c.i, try: c.tries, ops: script(), step: 0, snap: null, reads: new Set(), writes: new Map(), state: "run", commitT: null, waitStart: 0, ctx: {}, locks: new Set() };
    const a = { id: txn.id, i: c.i, t0: t, t1: null, end: null, waits: [], marks: [] };
    txn.a = a; attempts.push(a);
    c.txn = txn; c.read = null;
    hist.push(txn);
    log.push({ t, i: c.i, type: "begin", try: c.tries });
    advance(t, txn);
  }
  const mark = (txn, t, kind, text) => txn.a.marks.push({ t, kind, text });
  // rr, ser: the snapshot is taken at the transaction's first statement (as in PostgreSQL), not at BEGIN.
  function snapshot(txn, t) { if (cfg.level !== "rc" && txn.snap === null) txn.snap = t; }
  // What a plain read sees: the newest committed version (rc), or the snapshot's (rr, ser).
  const see = (txn, row) => (cfg.level === "rc" ? latest(row) : visible(row, txn.snap)).v;
  // After the lock: did someone commit a change to the row after this transaction's snapshot?
  const changed = (txn, row) => cfg.level !== "rc" && latest(row).t > txn.snap;

  function acquire(t, txn, row) {
    if (row.lock === txn) return true;
    if (row.lock === null) { row.lock = txn; txn.locks.add(row); return true; }
    if (!row.queue.includes(txn)) {
      row.queue.push(txn); txn.state = "wait"; txn.waitStart = t; stats.waits++;
      txn.a.waits.push([t, null]);
      clerks[txn.i].phase = "wait";
      log.push({ t, i: txn.i, type: "wait", row: row.name, holder: row.lock.i });
    }
    return false;
  }
  function release(t, txn) {
    for (const row of txn.locks) {
      row.lock = null;
      while (row.queue.length) {
        const next = row.queue.shift();
        if (next.state !== "wait") continue;
        row.lock = next; next.locks.add(row); next.state = "run";
        stats.waitTime += t - next.waitStart;
        const w = next.a.waits[next.a.waits.length - 1]; if (w) w[1] = t;
        log.push({ t, i: next.i, type: "granted", row: row.name });
        at(t, "resume", next);
        break;
      }
    }
    txn.locks.clear();
  }

  function advance(t, txn) {
    const c = clerks[txn.i];
    while (txn.state === "run") {
      const op = txn.ops[txn.step], x = txn.ctx;
      if (op.op === "read") {
        snapshot(txn, t);
        const row = rows.acct;
        if (op.lock) {
          c.phase = "select";
          if (!acquire(t, txn, row)) return;
          if (changed(txn, row)) return abort(t, txn, "update");
          x.read = latest(row).v;
        } else x.read = see(txn, row);
        txn.reads.add("acct");
        c.read = x.read; c.phase = "select";
        mark(txn, t, "read", String(x.read));
        log.push({ t, i: txn.i, type: "read", v: x.read, lock: !!op.lock });
        txn.step++;
      } else if (op.op === "readAll") {
        snapshot(txn, t);
        c.phase = "select";
        if (!x.cands) {
          // the statement finds the on-call rows in its snapshot (rc: as of now) and, with FOR UPDATE, locks them in order
          const vis = rowNames.filter((r) => (cfg.level === "rc" ? latest(rows[r]) : visible(rows[r], txn.snap)).v);
          for (const r of rowNames) txn.reads.add(r);
          x.cands = vis; x.idx = 0; x.count = op.lock ? 0 : vis.length;
          if (!op.lock) x.idx = vis.length;
        }
        while (x.idx < x.cands.length) {
          const row = rows[x.cands[x.idx]];
          if (!acquire(t, txn, row)) return;
          if (changed(txn, row)) return abort(t, txn, "update");
          // rc: once the lock is granted the row is checked again against its newest version
          if (latest(row).v) x.count++;
          x.idx++;
        }
        c.read = x.count; c.phase = "select";
        mark(txn, t, "read", String(x.count));
        log.push({ t, i: txn.i, type: "readAll", count: x.count, lock: !!op.lock });
        txn.step++;
      } else if (op.op === "work") {
        c.phase = "work";
        txn.step++;
        at(t + WORK[0] + WORK[1] * R(), "resume", txn);
        return;
      } else if (op.op === "write") {
        snapshot(txn, t);
        const row = rows.acct;
        c.phase = "update";
        if (!acquire(t, txn, row)) return;
        if (changed(txn, row)) return abort(t, txn, "update");
        const base = cfg.level === "rc" ? latest(row).v : visible(row, txn.snap).v;
        const v = op.how === "add" ? base + DEPOSIT : x.read + DEPOSIT;
        txn.writes.set("acct", v); x.wrote = v;
        mark(txn, t, "write", String(v));
        log.push({ t, i: txn.i, type: "write", v, how: op.how });
        txn.step++;
      } else if (op.op === "off") {
        const me = NAMES[txn.i];
        if (x.count >= 2) {
          const row = rows[me];
          c.phase = "update";
          if (!acquire(t, txn, row)) return;
          if (changed(txn, row)) return abort(t, txn, "update");
          txn.writes.set(me, false); x.off = true;
          mark(txn, t, "write", "OFF");
          log.push({ t, i: txn.i, type: "off", count: x.count });
        } else {
          x.stay = true;
          log.push({ t, i: txn.i, type: "stay", count: x.count });
        }
        txn.step++;
      } else if (op.op === "tail") {
        txn.step++;
        at(t + TAIL, "resume", txn);
        return;
      } else if (op.op === "commit") {
        return commit(t, txn);
      }
    }
  }

  // ---------- SSI: rw-antidependencies among concurrent transactions ----------
  // X →rw Y: X read a row Y wrote, and X's snapshot doesn't include Y's write; the two overlap in time.
  function rw(X, Y, t) {
    if (X === Y || X.state === "aborted" || Y.state === "aborted" || X.snap === null || Y.snap === null) return false;
    if (Y.snap >= (X.commitT ?? t) || X.snap >= (Y.commitT ?? t)) return false;
    if (Y.commitT !== null && Y.commitT <= X.snap) return false;
    return meets(X.reads, Y.writes);
  }
  function dangerous(t, T) {
    const done = hist.filter((y) => y.state === "done");
    const live = hist.filter((y) => y !== T && y.state !== "aborted");
    // T as the pivot: someone read what T wrote, and T read what a committed transaction wrote
    if (live.some((y) => rw(y, T, t)) && done.some((y) => rw(T, y, t))) return true;
    // T read what a committed P wrote, and P read what an earlier committed transaction wrote
    return done.some((p) => rw(T, p, t) && done.some((o) => o.commitT < p.commitT && rw(p, o, t)));
  }

  function commit(t, txn) {
    const c = clerks[txn.i];
    if (cfg.level === "ser" && dangerous(t, txn)) return abort(t, txn, "ssi");
    txn.state = "done"; txn.commitT = t;
    let lost = 0;
    for (const [name, v] of txn.writes) {
      const row = rows[name], prev = latest(row);
      if (!rota) lost = (prev.v + DEPOSIT - v) / DEPOSIT;
      row.versions.push({ v, t, by: txn.id });
      if (row.versions.length > 64) row.versions.splice(1, row.versions.length - 48);
    }
    release(t, txn);
    stats.commits++;
    txn.a.t1 = t; txn.a.end = "commit";
    if (lost > 0) { stats.lost += lost; txn.a.lost = lost; }
    if (lost > 0) for (const m of txn.a.marks) if (m.kind === "write") m.kind = "lost";
    mark(txn, t, "commit", "");
    log.push({ t, i: txn.i, type: "commit", lost, off: !!txn.ctx.off, stay: !!txn.ctx.stay });
    c.phase = "idle"; c.txn = null; c.tries = 0;
    stats.reqs++; stats.reqTime += t - c.reqStart;
    if (rota) { if (txn.ctx.stay) stats.stays++; c.nightDone = true; nightCheck(t); }
    else { stats.made++; c.done++; if (c.done < cfg.per) at(t + IDLE[0] + IDLE[1] * R(), "begin", c); }
    prune(t);
  }
  function abort(t, txn, why) {
    const c = clerks[txn.i];
    txn.state = "aborted";
    for (const row of Object.values(rows)) { const k = row.queue.indexOf(txn); if (k >= 0) row.queue.splice(k, 1); }
    const w = txn.a.waits[txn.a.waits.length - 1]; if (w && w[1] === null) { w[1] = t; stats.waitTime += t - txn.waitStart; }
    release(t, txn);
    stats.aborts++; if (why === "ssi") stats.abortsSsi++; else stats.abortsUpdate++;
    txn.a.t1 = t; txn.a.end = "abort"; txn.a.why = why;
    mark(txn, t, "abort", "");
    log.push({ t, i: txn.i, type: "abort", why });
    c.phase = "rollback"; c.txn = null; c.tries++;
    at(t + BACKOFF[0] + BACKOFF[1] * R(), "retry", c);
  }
  function prune(t) {
    if (hist.length < 120) return;
    const active = hist.filter((y) => y.state !== "done" && y.state !== "aborted");
    const floor = Math.min(t, ...active.map((y) => y.snap ?? t)) - 5;
    for (let i = hist.length - 1; i >= 0; i--) if (hist[i].state === "aborted" || (hist[i].commitT !== null && hist[i].commitT < floor)) hist.splice(i, 1);
  }

  // ---------- nights (rota) ----------
  function startNight(t) {
    night = { n: stats.nights + 1, t0: t };
    for (const r of rowNames) rows[r].versions.push({ v: true, t, by: null });
    log.push({ t, type: "night", n: night.n });
    for (const c of clerks) { c.nightDone = false; c.read = null; at(t + NIGHT.window * R(), "begin", c); }
  }
  function nightCheck(t) {
    if (!clerks.every((c) => c.nightDone)) return;
    const on = rowNames.filter((r) => latest(rows[r]).v).length;
    stats.nights++;
    // did any two doctors' first attempts overlap in time this night?
    const firsts = attempts.filter((a) => a.t0 >= night.t0 && a.first).map((a) => [a.t0, a.t1 ?? t]);
    if (firsts.some(([a0, a1], j) => firsts.some(([b0, b1], k) => k !== j && a0 < b1 && b0 < a1))) stats.overlap++;
    if (on === 0) stats.broken++;
    log.push({ t, type: "nightEnd", on, n: night.n });
    night.end = t; night.on = on;
    if (stats.nights < cfg.per) at(t + NIGHT.gap, "night");
  }

  // ---------- the loop ----------
  function step(e) {
    now = e.t;
    if (e.k === "begin") { const c = e.x; c.reqStart = e.t; c.tries = 0; begin(e.t, c); clerks[c.i].txn.a.first = true; }
    else if (e.k === "retry") begin(e.t, e.x);
    else if (e.k === "resume") { if (e.x.state === "run") advance(e.t, e.x); }
    else if (e.k === "night") startNight(e.t);
  }
  if (rota) at(0.3, "night");
  else for (const c of clerks) at(0.2 + IDLE[1] * R(), "begin", c);

  function runTo(T) {
    for (;;) {
      const e = events.peek();
      if (!e || e.t > T) break;
      events.pop();
      step(e);
    }
    now = T;
  }
  function runAll(limit = 1e5) {
    for (;;) { const e = events.pop(); if (!e || e.t > limit) break; step(e); }
  }

  return {
    cfg, rows, rowNames, clerks, stats, log, attempts,
    runTo, runAll,
    get now() { return now; },
    get night() { return night; },
    balance: () => (rota ? null : latest(rows.acct).v),
    onCall: () => rowNames.filter((r) => latest(rows[r]).v).length,
    lockOf: (name) => (rows[name].lock ? rows[name].lock.i : -1),
    trim(before) { let k = 0; while (k < attempts.length - 40 && attempts[k].t1 !== null && attempts[k].t1 < before) k++; if (k) attempts.splice(0, k); if (log.length > 4000) log.splice(0, log.length - 2000); },
  };
}

// ---------- experiments: headless runs, averaged over seeds ----------
export const SEEDS = [3, 7, 11, 19, 23, 31, 43, 59];
export const PER = 100;       // deposits per clerk
export const NIGHTS = 200;    // nights per run
const avg = (fn) => averageOver(SEEDS, fn);

export function deposits(cfg) {
  return avg((seed) => {
    const m = makeSim({ scenario: "deposits", per: PER, ...cfg }, seed);
    m.runAll();
    const s = m.stats;
    return { made: s.made, lost: s.lost, lostShare: s.lost / s.made, aborts: (100 * s.aborts) / s.made, waits: (100 * s.waits) / s.made, wait: s.waitTime / Math.max(1, s.waits), time: s.reqTime / s.reqs, balance: m.balance() };
  });
}
export function nights(cfg) {
  return avg((seed) => {
    const m = makeSim({ scenario: "rota", per: NIGHTS, ...cfg }, seed);
    m.runAll();
    const s = m.stats;
    return { broken: s.broken / s.nights, overlap: s.overlap / s.nights, aborts: (100 * s.aborts) / s.reqs, ssi: (100 * s.abortsSsi) / s.reqs, waits: (100 * s.waits) / s.reqs, time: s.reqTime / s.reqs };
  });
}

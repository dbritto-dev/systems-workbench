// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// A database, its backups, and what a restore brings back. Seeded and shared by the live figure and the experiments.
// Times are minutes of real time (day 1 starts at 0, 00:00); the figure plays them in time-lapse. The numbers are
// illustrative and round.
//
// The leader takes named writes, W1, W2…, about RATE a minute. Each write goes to the replica within a second or two
// (lesson 60, Replication Lag) and into the open segment of the write-ahead log (lesson 66, Write-Ahead Log).
// Archiving: every SEG minutes (PostgreSQL's archive_timeout), the open segment closes if it holds any write and is
// uploaded to the log archive, where it lands UPLOAD seconds later. "off": nothing is archived. "gap": one segment,
// the first to close after gapAt, never lands (an upload that reported success, or a file a lifecycle rule removed).
// "drill": the same gap, and a restore drill every DRILL minutes restores the latest snapshot on a spare machine and
// replays the archive; if it runs into the gap, a fresh snapshot is taken at once.
//
// Snapshots (base backups): one every `snap` minutes from midnight. Taking one reads the whole database and takes
// about BACKUP minutes; it holds every write up to its end (the log written meanwhile is part of it) and lands on the
// backup shelf then.
//
// A restore at time `at` aims for a target time: it takes the newest snapshot on the shelf that ends no later than
// the target, copies it back (about COPY minutes), then replays archived segments in order, from the one that holds
// the first write after the snapshot, up to the target. It stops early at a segment that is missing or hadn't landed
// by `at`. Replay runs REPLAY_X times faster than the log was written. What it brings back is every write up to the
// snapshot plus every write it replayed; a write before the target that it doesn't have is LOST.
//
// The bad DELETE (deleteAt): one write that removes every row of the orders table, about a quarter of all rows. The
// replica applies it a second or two later, like any other write.

import { rng } from "../../lib/random";
import { averageOver, mean } from "../../lib/stats";

export const DAY = 1440;
export const RATE = 3;                        // writes a minute: one every 20 s on average
export const SEG = 1;                         // a segment closes every minute (archive_timeout = 60 s)
export const UPLOAD = [5 / 60, 10 / 60];       // and lands in the archive 5–15 s later
export const BACKUP = 10;                     // taking a snapshot: about 10 min (100 GB)
export const COPY = 10;                       // copying it back: about 10 min
export const REPLAY_X = 10;                   // an hour of log replays in about 6 min
export const DB_GB = 100;
export const LOG_GB_DAY = 10;                 // log written a day
export const KEEP_DAYS = 7;                   // backups kept: any moment of the last 7 days can be restored
export const LEADER_MBPS = 100;               // copying a new replica from the leader, throttled to 100 MB/s
export const LAG = [0.5 / 60, 1.5 / 60];       // the replica applies a write 0.5–2 s after the leader
export const NOTICE = 10;                     // someone notices the bad DELETE 10 min later
export const ORDERS = 0.25;                   // a quarter of writes add or change an order
export const ROWS = 80000;                    // rows already in the database when the run starts
export const DRILL = 360, DRILL_AT = 120;     // drills at 02:00, 08:00, 14:00, 20:00
export const DEFAULTS = { snap: 360, archive: "on", gapAt: null, deleteAt: null };

/** A time of day as "14:05" (minutes; any day). */
export const clockText = (t) => {
  const m = ((Math.floor(t + 1e-9) % DAY) + DAY) % DAY;
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
};
/** A span of minutes as text: "35 s", "13 min", "2 h 16 min" (the same in English and Spanish). */
export const dur = (m) => {
  if (m < 1) return Math.round(m * 60) + " s";
  if (m < 59.5) return Math.round(m) + " min";
  let h = Math.floor(m / 60), r = Math.round(m - 60 * h);
  if (r === 60) { h++; r = 0; }
  return r ? h + " h " + String(r).padStart(2, "0") + " min" : h + " h";
};
/** Backup storage for a schedule (GB): every snapshot within the retention window, one older to restore its start
 *  from, and the archived log for the window. */
export function storageGB(snap, archive = true) {
  const kept = Math.floor((KEEP_DAYS * DAY) / snap) + 1;
  return { kept, gb: kept * DB_GB + (archive ? KEEP_DAYS * LOG_GB_DAY : 0) };
}
const LOG_GB_MIN = LOG_GB_DAY / DAY;

// opts: start (minutes; the run's first moment, with a snapshot of everything before it), span, zero and nAtZero (the
// first write after `zero` is W<nAtZero>; earlier ones count down from it), s0 (the first snapshot's number)
export function makeSim(cfgIn = {}, seed = 1, opts = {}) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const start = opts.start ?? -DAY, span = opts.span ?? 3 * DAY, end = start + span;
  const zero = opts.zero ?? start, nAtZero = opts.nAtZero ?? 1, s0 = opts.s0 ?? 1;
  const rW = rng(seed * 2654435761 + 7), rT = rng(seed * 40503 + 19), rL = rng(seed * 7919 + 11);
  const rU = rng(seed * 69069 + 3), rB = rng(seed * 1103515245 + 12345);
  const archived = cfg.archive !== "off";
  const gapAt = cfg.archive === "gap" || cfg.archive === "drill" ? cfg.gapAt ?? start + 20 : null;

  // ---------- writes ----------
  const writes = [];
  for (let t = start; ;) {
    t += -Math.log(1 - rW()) / RATE;
    if (t > end) break;
    writes.push({ t, orders: rT() < ORDERS, lag: LAG[0] + LAG[1] * rL() });
  }
  if (cfg.deleteAt !== null) {
    // the DELETE draws nothing, so every write before and after it is the same as in a run without it
    let i = 0;
    while (i < writes.length && writes[i].t < cfg.deleteAt) i++;
    writes.splice(i, 0, { t: cfg.deleteAt, del: true, orders: false, lag: LAG[0] + LAG[1] / 2 });
  }
  const first = writes.findIndex((w) => w.t > zero);
  writes.forEach((w, i) => { w.i = i; w.n = nAtZero + i - (first < 0 ? writes.length : first); });
  /** How many writes happened at or before t. */
  function countTo(t) {
    let lo = 0, hi = writes.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (writes[m].t <= t) lo = m + 1; else hi = m; }
    return lo;
  }

  // ---------- segments ----------
  const segs = [];
  {
    let i = 0, open = start;
    for (let tick = Math.floor(start / SEG) * SEG + SEG; tick <= end + SEG; tick += SEG) {
      const up = UPLOAD[0] + UPLOAD[1] * rU();    // drawn every tick, so one extra write doesn't shift the others
      const from = i;
      while (i < writes.length && writes[i].t <= tick) i++;
      if (i === from) continue;
      const g = { k: segs.length, i0: from, i1: i - 1, open, close: tick, lands: archived ? tick + up : Infinity, missing: false, del: false };
      for (let j = from; j < i; j++) { writes[j].seg = g.k; if (writes[j].del) g.del = true; }
      if (gapAt !== null && !segs.some((s) => s.missing) && tick > gapAt) { g.missing = true; g.lands = Infinity; }
      segs.push(g);
      open = tick;
    }
  }
  const gapSeg = segs.find((g) => g.missing) || null;

  // ---------- snapshots ----------
  const snaps = [{ s: start, e: start, up: countTo(start) - 1, copy: COPY, extra: true }];
  const snapAt = (s, extra = false) => {
    const e = s + BACKUP * (0.9 + 0.2 * rB()), copy = COPY * (0.9 + 0.2 * rB());
    return { s, e, up: countTo(e) - 1, copy, extra };
  };
  for (let s = Math.floor(start / cfg.snap) * cfg.snap + cfg.snap; s <= end; s += cfg.snap) snaps.push(snapAt(s));
  const sortSnaps = () => { snaps.sort((a, b) => a.e - b.e); snaps.forEach((x, j) => { x.name = "S" + (s0 + j); }); };
  sortSnaps();

  // ---------- restore ----------
  // method "log": the snapshot plus the archived log; "snap": the snapshot alone
  function restore(target, at = target, method = "log") {
    let snap = snaps[0];
    for (const x of snaps) if (x.e <= at && x.e <= target) snap = x; else if (x.e > at) break;
    let up = snap.up, point = snap.e, stop = "snapshot";
    const replayed = [];
    if (method === "log" && archived) {
      const next = writes[up + 1];
      if (!next || next.t > target) { stop = "target"; point = target; }
      else {
        stop = "end";
        for (let k = next.seg; k < segs.length; k++) {
          const g = segs[k];
          if (g.missing) { stop = "gap"; break; }
          if (g.lands > at) break;
          replayed.push(g);
          let j = g.i0;
          while (j <= g.i1 && writes[j].t <= target) j++;
          up = Math.max(up, j - 1);
          if (j <= g.i1 || g.close >= target) { stop = "target"; point = target; break; }
          point = g.close;
        }
      }
    }
    const before = countTo(target);
    const lostN = Math.max(0, before - 1 - up);
    const replay = Math.max(0, Math.min(point, target) - snap.e) / REPLAY_X;
    return {
      target, at, snap, up, upW: writes[up] || null, point, stop, replayed, lostN,
      lostMin: lostN ? target - point : 0,
      firstMissing: lostN ? writes[up + 1] : null,
      copy: snap.copy, replay, total: snap.copy + replay,
      hasDelete: writes.some((w, j) => w.del && j <= up),
    };
  }

  // ---------- drills ----------
  const drills = [];
  if (cfg.archive === "drill") {
    for (let d = Math.floor((start - DRILL_AT) / DRILL) * DRILL + DRILL_AT + DRILL; d <= end; d += DRILL) {
      if (d <= start) continue;
      const r = restore(d, d);
      const drill = { at: d, r, found: r.stop === "gap", done: d + r.total };
      drills.push(drill);
      if (drill.found && !snaps.some((x) => x.extra && x.s >= gapSeg.close)) {
        snaps.push(snapAt(drill.done, true));
        sortSnaps();
      }
    }
  }

  // ---------- the replica ----------
  /** The writes the replica holds at time t (a count from the start). */
  function replicaAt(t) {
    let j = countTo(t);
    while (j > 0 && writes[j - 1].t + writes[j - 1].lag > t) j--;
    return j;
  }

  // ---------- a new replica ----------
  // From the leader: copy the whole database from it (throttled), then stream the log written meanwhile from it.
  function seedFromLeader(at) {
    const copy = ((DB_GB * 1024) / LEADER_MBPS / 60) * (0.9 + 0.2 * jitter(at));
    const ready = copy + copy / REPLAY_X;
    return { from: "leader", at, copy, total: ready, leaderGB: DB_GB + (copy + copy / REPLAY_X) * LOG_GB_MIN, upW: writes[countTo(at + ready) - 1] };
  }
  // From the shelf: restore the latest snapshot and replay the archive, again for whatever landed meanwhile, then
  // stream the last bit (since the newest archived segment) from the leader.
  function seedFromShelf(at) {
    const r = restore(at, at);
    let t = at + r.total, point = r.point;
    for (let pass = 0; pass < 6; pass++) {
      const more = restore(t, t);
      if (more.point <= point + 1e-9) break;
      t += (more.point - point) / REPLAY_X;
      point = more.point;
    }
    const tail = Math.max(0, t - point);
    const total = t + tail / REPLAY_X - at;
    return { from: "shelf", at, r, copy: r.copy, total, leaderGB: (tail + tail / REPLAY_X) * LOG_GB_MIN, upW: writes[countTo(at + total) - 1] };
  }
  const jitter = (t) => { const x = Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453; return x - Math.floor(x); };

  // ---------- the bad DELETE ----------
  // The rows it removes: every orders row there at deleteAt. A restored copy brings back those it holds.
  function ordersRows(up) {
    let n = ROWS * ORDERS;
    for (let j = 0; j <= up && j < writes.length; j++) if (writes[j].orders && writes[j].t < cfg.deleteAt) n++;
    return n;
  }
  /** What a restore or a promoted replica gives back after the bad DELETE: the share of its rows, and the writes made
   *  before it that are missing. */
  function afterDelete(r) {
    const D = cfg.deleteAt, before = countTo(D - 1e-9);
    const all = ordersRows(before - 1);
    return { rowsBack: r.hasDelete ? 0 : ordersRows(Math.min(r.up, before - 1)) / all, missing: Math.max(0, before - 1 - r.up) };
  }
  function promote(at) {
    const j = replicaAt(at);
    return { promoted: true, up: j - 1, hasDelete: writes.slice(0, j).some((w) => w.del) };
  }

  return { cfg, start, end, writes, segs, snaps, drills, gapSeg, countTo, restore, replicaAt, seedFromLeader, seedFromShelf, afterDelete, promote, storage: storageGB(cfg.snap, archived) };
}

// ---------- experiments: headless runs, averaged over seeds ----------
export const SEEDS = [3, 7, 11, 19, 23, 31, 43, 59];
export const SAMPLES = 40;                    // moments per seed, at random over day 1
const avg = (fn) => averageOver(SEEDS, fn);
const moments = (seed, n = SAMPLES, from = 0, to = DAY) => { const r = rng(seed * 97 + 13); return Array.from({ length: n }, () => from + (to - from) * r()); };

// 1. A bad DELETE at 14:05, noticed at 14:15. Nightly snapshot, log archived.
export const DELETE_AT = 14 * 60 + 5;
export function deleteRun() {
  return avg((seed) => {
    const m = makeSim({ snap: DAY, archive: "on", deleteAt: DELETE_AT }, seed);
    const at = DELETE_AT + NOTICE, target = DELETE_AT - 1 / 60;
    const snap = m.restore(target, at, "snap"), pitr = m.restore(target, at, "log"), rep = m.promote(at);
    const a = m.afterDelete(snap), b = m.afterDelete(pitr), c = m.afterDelete(rep);
    const after = m.countTo(at) - m.countTo(DELETE_AT);
    return { snapRows: a.rowsBack, snapMissing: a.missing, snapMin: snap.total, pitrRows: b.rowsBack, pitrMissing: b.missing, pitrMin: pitr.total, repRows: c.rowsBack, repMissing: c.missing, after, replay: pitr.replay };
  });
}

// 2 and 3. The database and its replica are lost at a random moment; restore the latest you can.
function lossRun(snap, archive) {
  return avg((seed) => {
    const m = makeSim({ snap, archive }, seed);
    const rs = moments(seed).map((F) => m.restore(F, F));
    return {
      lostSec: mean(rs.map((r) => r.lostMin * 60)), lostMin: mean(rs.map((r) => r.lostMin)), maxLostMin: Math.max(...rs.map((r) => r.lostMin)),
      lostN: mean(rs.map((r) => r.lostN)), total: mean(rs.map((r) => r.total)), maxTotal: Math.max(...rs.map((r) => r.total)),
      tb: m.storage.gb / 1000, kept: m.storage.kept,
    };
  });
}
export function intervalRun() { return { hourly: lossRun(60, "on"), six: lossRun(360, "on"), daily: lossRun(DAY, "on") }; }
export function noArchiveRun() { return { hourly: lossRun(60, "off"), six: lossRun(360, "off"), daily: lossRun(DAY, "off") }; }

// 4. A new replica at a random moment: copied from the leader, or from the shelf. Snapshots every 6 h (and hourly).
export function seedRun() {
  const one = (snap) => avg((seed) => {
    const m = makeSim({ snap, archive: "on" }, seed);
    const Fs = moments(seed);
    const L = Fs.map((F) => m.seedFromLeader(F)), S = Fs.map((F) => m.seedFromShelf(F));
    return { leaderMin: mean(L.map((x) => x.total)), leaderGB: mean(L.map((x) => x.leaderGB)), shelfMin: mean(S.map((x) => x.total)), shelfGB: mean(S.map((x) => x.leaderGB)), shelfMax: Math.max(...S.map((x) => x.total)) };
  });
  return { six: one(360), hourly: one(60) };
}

// 5. One segment goes missing at a random moment of day 1; the database is lost at a random moment of the next 24 h.
// Nightly snapshots. No drill vs a drill every 6 h.
export function gapRun() {
  const one = (archive) => avg((seed) => {
    const r = rng(seed * 131 + 5);
    let lost = 0, stopped = 0, maxLost = 0, found = 0, lostN = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const G = DAY * r(), F = G + DAY * r();
      const m = makeSim({ snap: DAY, archive, gapAt: G }, seed);
      const res = m.restore(F, F);
      lost += res.lostMin / SAMPLES; lostN += res.lostN / SAMPLES; maxLost = Math.max(maxLost, res.lostMin);
      if (res.stop === "gap") stopped += 1 / SAMPLES;
      if (m.drills.some((d) => d.found && d.done <= F)) found += 1 / SAMPLES;
    }
    return { lost, lostN, stopped, maxLost, found };
  });
  return { none: one("gap"), drill: one("drill"), whole: lossRun(DAY, "on") };
}

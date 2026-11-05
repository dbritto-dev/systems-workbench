// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// A database with a write-ahead log, its clients, and what a crash leaves behind. Event-driven and seeded, shared by
// the live figure and the experiments. Times are milliseconds of real time (the figure plays them about a hundred
// times slower).
//
// The database keeps six pages, A to F, in memory. Each client runs one transaction at a time: it works for WORK ms,
// then commits an update to one page, picked at random, and waits for the database's OK before it thinks (THINK ms
// on average) and starts the next one. A commit updates the page in memory at once (the page is now dirty: newer
// than its copy on disk) and appends a record, numbered in order (its LSN), to the log. Where the record goes next,
// and when the client gets its OK, is the commit setting:
//
//   each    the record is written and flushed to disk (fsync, FSYNC ms) before the OK, one commit per flush, one
//           flush at a time: a commit queues behind every commit ahead of it
//   group   the same, but one flush carries every record waiting when it starts (group commit); commits that arrive
//           during a flush wait for the next one
//   write   the record is written to the operating system's cache (write(), no fsync) and the OK goes out at once;
//           the database flushes the log once every OS_FLUSH ms (like InnoDB's innodb_flush_log_at_trx_commit = 2)
//   async   the OK goes out at once and the record stays in the database's own log buffer; a log writer writes and
//           flushes the buffer every WRITER ms (like PostgreSQL's synchronous_commit = off)
//
// Log "off": no log at all; a commit updates the page in memory and the OK goes out at once.
//
// A checkpoint starts every CKPT records (commits, without a log): it notes the current end of the log (the redo
// point), makes sure the log is on disk up to there (the write-ahead rule: a page never reaches disk before the log
// records that changed it), then writes every dirty page, as it was at the redo point, PAGE_W ms each. Once all are
// written, the checkpoint is complete: recovery can start at its redo point, and the log before it can be recycled.
//
// A crash at time T:
//   process   the database process dies (kill -9, an out-of-memory kill): its memory is gone (log buffer, pages in
//             memory), but whatever it had handed to the operating system is still there and reaches disk
//   power     the machine loses power: the operating system's cache is gone too; only what was flushed survives
// Recovery replays every surviving log record after the redo point of the last complete checkpoint, REPLAY ms each,
// onto the pages on disk. Without a log there is nothing to replay: the pages on disk are all there is.
// An acknowledged commit is LOST when the client got its OK and the commit isn't in the recovered database.

import { rng } from "../../lib/random";
import { minHeap } from "../../lib/events";
import { averageOver, rankQuantile } from "../../lib/stats";

export const PAGES = 6;
export const PAGE_NAMES = ["A", "B", "C", "D", "E", "F"];
export const FSYNC = 2;            // one flush of the log to disk (fsync): 2 ms
export const WORK = 0.2;           // a transaction's work before it commits: 0.2 ms
export const THINK = 4;            // a client's pause between transactions: 4 ms on average
export const OS_FLUSH = 1000;      // "write": the log is flushed once a second
export const WRITER = 200;         // "async": the log writer runs every 200 ms (PostgreSQL's wal_writer_delay)
export const PAGE_W = 0.5;         // writing one page at a checkpoint: 0.5 ms
export const REPLAY = 0.05;        // replaying one log record in recovery: 0.05 ms (20,000 a second)
export const DEFAULTS = { log: "on", commit: "group", ckpt: 1000, clients: 4 };

export function makeSim(cfgIn = {}, seed = 1, init = null) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const logOn = cfg.log === "on", mode = cfg.commit, CKPT = Number(cfg.ckpt), C = Number(cfg.clients);
  const rThink = rng(seed * 2654435761 + 7), rPage = rng(seed * 40503 + 19);
  const events = minHeap((a, b) => a.t < b.t || (a.t === b.t && a.n < b.n));
  let n = 0, now = 0;
  const at = (t, k, x) => events.push({ t, k, x, n: n++ });

  const base = init ? [...init] : Array(PAGES).fill(0);
  const mem = [...base];          // page versions in memory
  const disk = [...base];         // page versions on disk
  const recs = [];                // every commit, in LSN order: { lsn, page, client, at, ack, os, disk, paged }
  const byPage = Array.from({ length: PAGES }, () => []), pagedTo = Array(PAGES).fill(0);
  const log = [];                 // what the live figure narrates
  const st = { acked: 0, fsyncs: 0, flushed: 0, pageWrites: 0, ckpts: 0, paged: 0 };
  const lat = [];                 // commit → OK, per acknowledged commit: [ackTime, ms]
  let lsnTop = 0, osLsn = 0, diskLsn = 0, flushing = null, tickDue = false, forceTo = 0;
  const waiting = [];
  let ck = null, lastStart = 0, redoDone = 0;   // the checkpoint in progress, the redo point of the last one started / completed
  const ckpts = [];                              // completed checkpoints: { start, redo, done, pages }
  const think = () => -THINK * Math.log(1 - rThink());

  // ---------- clients and commits ----------
  function ok(r, t) {
    r.ack = t; st.acked++;
    lat.push([t, t - r.at]);
    at(t + think(), "txn", r.client);
  }
  function apply(t, c) {
    const p = Math.floor(rPage() * PAGES);
    const r = { lsn: ++lsnTop, page: p, client: c, at: t, ack: Infinity, os: Infinity, disk: Infinity, paged: Infinity };
    recs.push(r); byPage[p].push(r);
    mem[p]++;
    if (!logOn || mode === "async") ok(r, t);
    else if (mode === "write") { r.os = t; osLsn = r.lsn; ok(r, t); }
    else { waiting.push(r); kick(t); }
    if (!ck && lsnTop - lastStart >= CKPT) startCkpt(t);
  }

  // ---------- the log on its way to disk ----------
  function kick(t) {
    if (!logOn || flushing) return;
    let want = 0;
    if (mode === "each" && waiting.length) want = waiting[0].lsn;
    if (mode === "group" && waiting.length) want = lsnTop;
    if (tickDue || forceTo > diskLsn) want = Math.max(want, mode === "write" ? osLsn : lsnTop);
    if (want <= diskLsn) { tickDue = false; return; }
    tickDue = false;
    for (let l = osLsn + 1; l <= want; l++) recs[l - 1].os = t;
    osLsn = Math.max(osLsn, want);
    const end = t + FSYNC;
    for (let l = diskLsn + 1; l <= want; l++) recs[l - 1].disk = end;
    flushing = { from: diskLsn, to: want, start: t, end };
    st.fsyncs++;
    log.push({ t, type: "flush", from: diskLsn, to: want });
    at(end, "flushed", flushing);
  }
  function flushed(t, f) {
    st.flushed += f.to - diskLsn;
    diskLsn = f.to; flushing = null;
    while (waiting.length && waiting[0].lsn <= diskLsn) ok(waiting.shift(), t);
    if (ck && ck.phase === "wal" && diskLsn >= ck.redo) writePages(t);
    kick(t);
  }

  // ---------- checkpoints ----------
  function startCkpt(t) {
    ck = { start: t, redo: lsnTop, snap: [...mem], phase: "wal", pages: [] };
    lastStart = lsnTop;
    log.push({ t, type: "ckptStart", redo: ck.redo });
    if (logOn && diskLsn < ck.redo) {
      // the write-ahead rule: the log must be on disk up to the redo point before any page is written
      if (mode !== "each") forceTo = ck.redo;
      kick(t);
    } else writePages(t);
  }
  function writePages(t) {
    ck.phase = "pages";
    const dirty = [];
    for (let p = 0; p < PAGES; p++) if (ck.snap[p] > disk[p]) dirty.push(p);
    dirty.forEach((p, i) => at(t + (i + 1) * PAGE_W, "pageDone", { p, v: ck.snap[p], redo: ck.redo, i }));
    ck.pages = dirty;
    ck.writeStart = t;
    at(t + dirty.length * PAGE_W, "ckptDone", ck);
  }
  function pageDone(t, { p, v, redo }) {
    disk[p] = Math.max(disk[p], v);
    st.pageWrites++;
    const list = byPage[p];
    while (pagedTo[p] < list.length && list[pagedTo[p]].lsn <= redo) { list[pagedTo[p]].paged = t; pagedTo[p]++; st.paged++; }
  }
  function ckptDone(t, c) {
    c.done = t; redoDone = c.redo;
    ckpts.push({ start: c.start, redo: c.redo, done: t, pages: c.pages.length });
    st.ckpts++;
    log.push({ t, type: "ckptDone", redo: c.redo, pages: c.pages.length });
    ck = null;
    if (lsnTop - lastStart >= CKPT) startCkpt(t);
  }

  // ---------- timers ----------
  if (logOn && mode === "write") at(OS_FLUSH, "tick");
  if (logOn && mode === "async") at(WRITER, "tick");
  for (let c = 0; c < C; c++) at(think() * 0.5, "txn", c);

  function step(e) {
    now = e.t;
    const t = e.t;
    switch (e.k) {
      case "txn": at(t + WORK, "apply", e.x); break;
      case "apply": apply(t, e.x); break;
      case "flushed": flushed(t, e.x); break;
      case "tick": tickDue = true; kick(t); at(t + (mode === "write" ? OS_FLUSH : WRITER), "tick"); break;
      case "pageDone": pageDone(t, e.x); break;
      case "ckptDone": ckptDone(t, e.x); break;
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

  // What a crash at time T leaves: the acknowledged commits lost, the log replayed, the recovered pages.
  function crash(T, kind) {
    let acked = 0, lost = 0, oldest = Infinity, replay = 0;
    let redo = 0;
    for (const c of ckpts) if (c.done <= T) redo = c.redo;
    const pages = [...base];
    for (const r of recs) {
      if (r.at > T) break;
      const kept = logOn ? (kind === "process" ? r.os <= T : r.disk <= T) : r.paged <= T;
      if (r.ack <= T) { acked++; if (!kept) { lost++; if (r.ack < oldest) oldest = r.ack; } }
      if (kept) { pages[r.page]++; if (logOn && r.lsn > redo) replay++; }
    }
    return { T, kind, acked, lost, window: lost ? T - oldest : 0, replay, replayMs: replay * REPLAY, redo, pages };
  }

  return {
    cfg, recs, log, st, lat, mem, disk, base, ckpts, waiting,
    runTo, crash,
    get now() { return now; },
    get lsnTop() { return lsnTop; },
    get osLsn() { return osLsn; },
    get diskLsn() { return diskLsn; },
    get flushing() { return flushing; },
    get ck() { return ck; },
    get redoDone() { return redoDone; },
    get onDisk() { return logOn ? diskLsn : st.paged; },
  };
}

// ---------- experiments: headless runs, averaged over seeds ----------
export const SEEDS = [3, 7, 11, 19, 23, 31, 43, 59];
export const RUN_MS = 40000;          // forty seconds of traffic per seed
export const CRASHES = 20;            // crash moments per seed, at random in the last thirty seconds
const WARM = 10000;
const avg = (fn) => averageOver(SEEDS, fn);

const cache = new Map();
export function measure(cfg) {
  const key = JSON.stringify({ ...DEFAULTS, ...cfg });
  if (!cache.has(key)) cache.set(key, measureOnce(cfg));
  return cache.get(key);
}
function measureOnce(cfg) {
  return avg((seed) => {
    const m = makeSim(cfg, seed);
    m.runTo(RUN_MS);
    const pick = rng(seed * 69069 + 1);
    const out = { lostP: 0, lostK: 0, winP: 0, winK: 0, maxWinP: 0, maxWinK: 0, replay: 0, replayMs: 0, maxReplayMs: 0, anyLostP: 0 };
    for (let i = 0; i < CRASHES; i++) {
      const T = WARM + (RUN_MS - WARM) * pick();
      const p = m.crash(T, "power"), k = m.crash(T, "process");
      out.lostP += p.lost / CRASHES; out.lostK += k.lost / CRASHES;
      out.winP += p.window / CRASHES; out.winK += k.window / CRASHES;
      out.maxWinP = Math.max(out.maxWinP, p.window); out.maxWinK = Math.max(out.maxWinK, k.window);
      out.replay += p.replay / CRASHES; out.replayMs += p.replayMs / CRASHES;
      out.maxReplayMs = Math.max(out.maxReplayMs, p.replayMs);
      out.anyLostP += (p.lost > 0 ? 1 : 0) / CRASHES;
    }
    const after = m.lat.filter(([t]) => t >= WARM).map(([, x]) => x);
    const acks = after.length, secs = (RUN_MS - WARM) / 1000;
    return {
      ...out,
      rate: acks / secs,
      p50: rankQuantile(after, 0.5), p99: rankQuantile(after, 0.99),
      perFlush: m.st.fsyncs ? m.st.flushed / m.st.fsyncs : 0,
      fsyncRate: m.st.fsyncs / (RUN_MS / 1000),
      pagesPer1000: (1000 * m.st.pageWrites) / Math.max(1, m.lsnTop),
      ckptRate: m.st.ckpts / (RUN_MS / 1000),
    };
  });
}

// 1. No log: the OK goes out once the page is updated in memory; pages reach disk at each checkpoint.
export function noLogRun() {
  return { off: measure({ log: "off", ckpt: 1000 }), on: measure({ log: "on", commit: "group", ckpt: 1000 }) };
}
// 2. OK after write(), before fsync: a process crash against a power cut.
export function writeRun() {
  return { write: measure({ commit: "write" }), group: measure({ commit: "group" }) };
}
// 3. Sixteen clients: one fsync per commit against group commit; one client for the latency baseline.
export function groupRun() {
  return { each: measure({ commit: "each", clients: 16 }), group: measure({ commit: "group", clients: 16 }), one: measure({ commit: "group", clients: 1 }) };
}
// 4. Checkpoint every 1,000 records against every 10,000.
export function ckptRun() {
  return { short: measure({ ckpt: 1000 }), long: measure({ ckpt: 10000 }), tiny: measure({ ckpt: 100 }) };
}
// 5. Asynchronous commit against group commit, power cut.
export function asyncRun() {
  return { async: measure({ commit: "async" }), group: measure({ commit: "group" }) };
}

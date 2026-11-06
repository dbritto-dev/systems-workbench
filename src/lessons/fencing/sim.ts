// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// A lock service with leases, three workers and one record in a vault. Event-driven and seeded, shared by the live
// figure and the experiments. Times are seconds.
//
// Each worker loops: ask the key office for the key (a lease with a TTL and a token, the next number), read the record
// at the vault, work on it, then write it back and hand the key in. A live holder renews its lease every third of the
// TTL. A worker can pause (a stop-the-world GC, a VM pause, a swapped-out process): while paused it does nothing, its
// renewals don't happen, and its lease can run out. The key office then hands the key to the next worker in line,
// while the paused one still believes it holds it. When it wakes, it carries on where it stopped.
//
// The vault keeps the record and its version. A write whose worker read an older version than the one stored now
// overwrites an update it never saw: a lost update, counted as an overwrite. Nothing in the model forbids it: it
// happens only when two workers act as holders at once.
//
// cfg:
//   pauses   "none" | "short" (0.1–0.8 s) | "long" (one pause in four lasts 3–28 s)
//   ttl      lease TTL, seconds
//   check    the worker checks its lease (renewed in time, still valid) after the work, before it sends the write
//   fence    "off"    the vault ignores tokens
//            "writes" the vault refuses a write whose token is lower than the highest it has seen on a write
//            "all"    every call (read and write) carries the token; the vault refuses any lower than the highest seen
//   crashes  a holder crashes in one job in CRASH_EVERY (down for DOWN s): its lease stays until it runs out

import { rng } from "../../lib/random";
import { minHeap } from "../../lib/events";
import { averageOver } from "../../lib/stats";

export const N = 3;                        // workers A, B, C
export const NET = [0.08, 0.08];           // one-way message: 80–160 ms
export const WORK = [1.6, 0.8];            // the work on the record: 1.6–2.4 s
export const UPLOAD = [0.3, 0.3];          // sending the write: 0.3–0.6 s, and it lands when the last byte does
export const REST = [0.4, 0.8];            // between jobs
export const PAUSE_EVERY = 40;             // mean seconds between pauses, per worker
export const SHORT = [0.1, 0.7];           // a short pause: 0.1–0.8 s
export const LONG = { share: 0.25, len: [3, 25] };  // "long": one pause in four lasts 3–28 s
export const CRASH_EVERY = 50;             // with crashes on, a holder crashes in one job in 50
export const DOWN = 20;                    // a crashed worker is back after 20 s
export const DEFAULTS = { pauses: "long", ttl: 10, check: false, fence: "off", crashes: false };

const IN_JOB = new Set(["key", "readWait", "readReply", "work", "upload", "writeReply"]);
const CPU = new Set(["rest", "work", "upload"]);

export function makeSim(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const TTL = Number(cfg.ttl);
  const rNet = rng(seed * 2654435761 + 17), rJob = rng(seed * 40503 + 101), rPause = rng(seed * 69069 + 7), rCrash = rng(seed * 1103515245 + 12345);
  const ev = minHeap((a, b) => a.t < b.t || (a.t === b.t && a.n < b.n));
  let n = 0, now = 0;
  const at = (t, k, x) => ev.push({ t, k, x, n: n++ });
  const net = () => NET[0] + NET[1] * rNet();
  const span = ([a, b], r) => a + b * r();

  // the key office: one lease at a time, a line of workers waiting for it, the last token handed out
  const lock = { lease: null, last: 0, queue: [], two: 0, idle: 0, grants: 0, expired: 0 };
  // the vault: the record's version and the highest token it has seen
  const vault = { version: 0, seen: 0, over: 0, rejected: 0, staleLanded: 0 };
  const st = { stopped: 0, jobs: 0, crashes: 0, pauses: 0, longPauses: 0 };
  const log = [];
  const msgs = [];          // every message the figure draws: key handovers, reads, writes, with their times and fates

  const workers = Array.from({ length: N }, (_, i) => ({
    i, phase: "rest", due: 0, gen: 0, token: 0, localExp: 0, readVer: -1, pausedUntil: -1, down: false,
    reply: null, freezeNext: null, msg: null, job: 0,
  }));

  function schedule(w, t) {
    w.due = t; w.gen++;
    if (t < Infinity) at(t, "due", { w, gen: w.gen });
  }
  const paused = (w, t) => w.pausedUntil > t;
  const inJob = (w) => IN_JOB.has(w.phase);
  const holds = (w) => lock.lease && lock.lease.w === w && lock.lease.token === w.token;

  // ---------- the key office ----------
  function grant(t) {
    if (lock.lease || !lock.queue.length) return;
    const w = lock.queue.shift();
    const token = ++lock.last;
    lock.grants++;
    // someone else still in a job, alive, who never learned its lease ran out: two workers now act as holders
    // (counted once per lost lease, however many grants it sleeps through)
    const zombie = workers.find((o) => o !== w && !o.down && inJob(o) && o.token && o.token < token && o.token === o.heldToken);
    if (zombie && zombie.counted !== zombie.token) { zombie.counted = zombie.token; lock.two++; log.push({ t, type: "two", w, old: zombie, token }); }
    lock.lease = { token, w, granted: t, expires: t + TTL, crashAt: null };
    w.token = token; w.heldToken = token; w.localExp = t + TTL;
    const arrive = t + net();
    msgs.push({ kind: "key", w: w.i, token, sent: t, done: arrive });
    w.phase = "key";
    schedule(w, Math.max(arrive, w.pausedUntil));
    at(t + TTL / 3, "renew", { w, token });
    at(t + TTL, "expire", { token });
    log.push({ t, type: "grant", w, token });
  }
  function release(t, w) {
    if (holds(w)) { lock.lease = null; log.push({ t, type: "release", w, token: w.token }); grant(t); }
  }
  function renew(t, w, token) {
    if (w.token !== token || w.heldToken !== token) return;
    if (w.down) return;
    if (paused(w, t)) { w.renewDue = true; return; }
    w.renewDue = false;
    if (lock.lease && lock.lease.token === token && t < lock.lease.expires) {
      lock.lease.expires = t + TTL; w.localExp = t + TTL;
      at(t + TTL / 3, "renew", { w, token });
      at(t + TTL, "expire", { token });
    } else {
      // the renewal fails: the worker now knows its lease is gone (a careful worker checks this before writing)
      w.localExp = Math.min(w.localExp, t);
      log.push({ t, type: "renewFailed", w, token });
    }
  }
  function expire(t, token) {
    const l = lock.lease;
    if (!l || l.token !== token || l.expires > t + 1e-9) return;
    lock.expired++;
    if (l.crashAt !== null) lock.idle += t - l.crashAt;
    log.push({ t, type: "expire", w: l.w, token, crashed: l.crashAt !== null });
    lock.lease = null;
    grant(t);
  }

  // ---------- a worker's steps ----------
  function abandon(t, w, why) {
    w.heldToken = 0;
    w.phase = "rest";
    schedule(w, t + span(REST, rJob));
    log.push({ t, type: why, w, token: w.token });
  }
  function onDue(t, w) {
    switch (w.phase) {
      case "rest":
        w.phase = "want";
        lock.queue.push(w);
        schedule(w, Infinity);
        log.push({ t, type: "want", w });
        grant(t);
        break;
      case "key": {
        // the key arrived: send the read, with the token
        w.job++;
        if (cfg.crashes && rCrash() < 1 / CRASH_EVERY) at(t + 2.6 * rCrash(), "crash", { w, job: w.job });
        const land = t + net(), back = land + net();
        const m = { kind: "read", w: w.i, token: w.token, sent: t, land, done: back, fate: "flight" };
        msgs.push(m);
        w.phase = "readWait";
        schedule(w, Infinity);
        at(land, "read", { w, m });
        log.push({ t, type: "read", w, token: w.token });
        break;
      }
      case "readReply":
        if (w.reply.refused) { abandon(t, w, "readRefusedSeen"); break; }
        w.readVer = w.reply.version;
        w.phase = "work";
        schedule(w, t + span(WORK, rJob));
        break;
      case "work":
        if (cfg.check && t >= w.localExp) { st.stopped++; abandon(t, w, "stopped"); break; }
        w.phase = "upload";
        const u = span(UPLOAD, rJob);
        w.msg = { kind: "write", w: w.i, token: w.token, sent: t, land: null, done: null, fate: "flight", ver: w.readVer, U: u, stops: [] };
        msgs.push(w.msg);
        schedule(w, t + u);
        log.push({ t, type: "write", w, token: w.token, checked: cfg.check });
        if (w.freezeNext) {
          // a staged pause as the write starts (right after the check, when the check is on): it lasts until the
          // lease has run out, and a little more
          const extra = w.freezeNext.extra; w.freezeNext = null;
          const left = holds(w) ? lock.lease.expires - t : 0;
          pause(t, w, Math.max(0.5, left + extra), true);
        }
        break;
      case "upload": {
        // the last byte lands: the vault takes the write or refuses it
        const m = w.msg; m.land = t;
        const stale = !holds(w);
        let refused = false;
        if (cfg.fence !== "off" && w.token < vault.seen) refused = true;
        if (refused) { vault.rejected++; m.fate = "refused"; log.push({ t, type: "refused", w, token: w.token, seen: vault.seen }); }
        else {
          if (cfg.fence !== "off") vault.seen = Math.max(vault.seen, w.token);
          if (w.readVer !== vault.version) { vault.over++; m.fate = "over"; log.push({ t, type: "over", w, token: w.token, read: w.readVer, version: vault.version, stale }); }
          else { m.fate = "ok"; log.push({ t, type: "landed", w, token: w.token, stale, version: vault.version + 1 }); }
          if (stale) vault.staleLanded++;
          vault.version++;
          st.jobs++;
        }
        m.stale = stale;
        m.done = t + net();
        w.reply = { refused };
        w.phase = "writeReply";
        schedule(w, Math.max(m.done, w.pausedUntil));
        break;
      }
      case "writeReply":
        if (w.reply.refused) { abandon(t, w, "writeRefusedSeen"); break; }
        w.heldToken = 0;
        w.phase = "rest";
        schedule(w, t + span(REST, rJob));
        release(t, w);
        break;
      case "down":
        w.down = false;
        w.phase = "rest";
        schedule(w, t + span(REST, rJob));
        log.push({ t, type: "up", w });
        break;
    }
  }
  function onRead(t, w, m) {
    // a read lands at the vault
    if (w.down) { m.fate = "lost"; return; }
    let refused = false;
    if (cfg.fence === "all") {
      if (w.token < vault.seen) refused = true;
      else vault.seen = Math.max(vault.seen, w.token);
    }
    m.stale = !holds(w);
    if (refused) { vault.rejected++; m.fate = "refused"; log.push({ t, type: "readRefused", w, token: w.token, seen: vault.seen }); }
    else { m.fate = "ok"; m.version = vault.version; }
    w.reply = { refused, version: vault.version };
    w.phase = "readReply";
    schedule(w, Math.max(m.done, w.pausedUntil));
  }

  // ---------- pauses and crashes ----------
  function pause(t, w, d, staged = false) {
    if (w.down || paused(w, t)) return;
    st.pauses++; if (d > 2) st.longPauses++;
    w.pausedUntil = t + d;
    if (w.phase === "upload" && w.msg) w.msg.stops.push([t, t + d]);
    if (w.due < Infinity) schedule(w, CPU.has(w.phase) ? w.due + d : Math.max(w.due, t + d));
    at(t + d, "wake", { w });
    log.push({ t, type: "pause", w, d, holding: holds(w), staged });
  }
  function drawPause() {
    if (cfg.pauses === "long" && rPause() < LONG.share) return span(LONG.len, rPause);
    return span(SHORT, rPause);
  }
  function onPauseTick(t, w) {
    at(t - Math.log(1 - rPause()) * PAUSE_EVERY, "pauseTick", { w });
    if (cfg.pauses === "none") return;
    pause(t, w, drawPause());
  }
  function crash(t, w) {
    if (w.down || !inJob(w)) return;
    st.crashes++;
    if (holds(w)) lock.lease.crashAt = t;
    if (w.msg && w.msg.fate === "flight" && w.phase === "upload") { w.msg.fate = "lost"; w.msg.lostAt = t; }
    w.down = true; w.pausedUntil = -1; w.heldToken = 0;
    w.phase = "down";
    schedule(w, t + DOWN);
    log.push({ t, type: "crash", w, token: w.token });
  }

  for (const w of workers) { schedule(w, 0.2 + 0.5 * w.i); if (cfg.pauses !== "none") at(-Math.log(1 - rPause()) * PAUSE_EVERY, "pauseTick", { w }); }

  function step(e) {
    const t = e.t, x = e.x;
    now = t;
    switch (e.k) {
      case "due": if (x.gen === x.w.gen) onDue(t, x.w); break;
      case "read": onRead(t, x.w, x.m); break;
      case "renew": renew(t, x.w, x.token); break;
      case "expire": expire(t, x.token); break;
      case "wake": if (x.w.renewDue) renew(t, x.w, x.w.token); log.push({ t, type: "wake", w: x.w, holding: holds(x.w) }); break;
      case "pauseTick": onPauseTick(t, x.w); break;
      case "crash": if (x.job === x.w.job) crash(t, x.w); break;
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
    cfg, lock, vault, st, workers, log, msgs, runTo,
    get now() { return now; },
    /** Pause the holder (or the next worker to get the key) as its next write starts, right after its check when the
     *  check is on, until its lease has run out and a little longer: the staged version of the pause the lesson is
     *  about. */
    freezeAtWrite(extra = 1) {
      const w = lock.lease ? lock.lease.w : lock.queue[0] || workers[0];
      if (w && !w.down) w.freezeNext = { extra };
      return w;
    },
    /** Crash the holder now. */
    crashHolder() {
      const w = lock.lease && lock.lease.w;
      if (w && inJob(w)) { crash(now, w); return w; }
      return null;
    },
  };
}

// ---------- experiments: headless runs averaged over seeds ----------
export const SEEDS = [3, 7, 11, 19, 23, 31, 43, 59];
export const RUN_SECS = 3600;
const avg = (fn) => averageOver(SEEDS, fn);

function measure(cfg) {
  return avg((seed) => {
    const m = makeSim(cfg, seed);
    m.runTo(RUN_SECS);
    const jobs = Math.max(1, m.st.jobs);
    return {
      jobs: m.st.jobs, perMin: m.st.jobs / (RUN_SECS / 60),
      over: (1000 * m.vault.over) / jobs, overN: m.vault.over,
      rejected: (1000 * m.vault.rejected) / jobs, rejectedN: m.vault.rejected,
      stopped: (1000 * m.st.stopped) / jobs, stoppedN: m.st.stopped,
      two: m.lock.two, stale: m.vault.staleLanded,
      idlePerCrash: m.st.crashes ? m.lock.idle / m.st.crashes : 0, crashes: m.st.crashes,
    };
  });
}

const BASE = { pauses: "long", ttl: 10, check: false, fence: "off", crashes: false };
// 1. Pauses that stay short vs pauses that sometimes outlast the lease.
export const pauseRun = () => ({ short: measure({ ...BASE, pauses: "short" }), long: measure(BASE) });
// 2. Check the lease before sending the write.
export const checkRun = () => ({ none: measure(BASE), check: measure({ ...BASE, check: true }) });
// 3. Fencing tokens on every call.
export const fenceRun = () => ({ none: measure(BASE), fence: measure({ ...BASE, fence: "all" }) });
// 4. A longer lease, with holders that sometimes crash.
export const ttlRun = () => ({ ten: measure({ ...BASE, crashes: true }), sixty: measure({ ...BASE, crashes: true, ttl: 60 }) });
// 5. Tokens on writes only vs on every call.
export const writesRun = () => ({ writes: measure({ ...BASE, fence: "writes" }), all: measure({ ...BASE, fence: "all" }), none: measure(BASE) });

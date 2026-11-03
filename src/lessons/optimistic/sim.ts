// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// A like button, its server, and the requests between them. Event-driven and seeded, shared by the live figure and
// the experiments. Times are seconds of real time (the figure plays them in slow motion).
//
// The user taps a like button. Every save is a request that sets the value (PUT liked = true/false). A request walks
// out to the server (network), waits there (work, sometimes a slow path), is written or refused at the end of the work
// (the commit), and its answer walks back. Requests run in parallel, so answers and even writes can land out of order.
// The client decides what the screen shows:
//
// cfg:
//   ui      "pess"     pessimistic: the screen changes only when the server says yes; the button is disabled
//                      (taps ignored) while a save is in flight
//           "opt"      optimistic: the screen changes on the tap; the answer reconciles it later
//   onFail  "rollback" put back the value the screen had before the tap (the snapshot) and tell the user
//           "none"     do nothing (no error handler): the screen keeps the value the server refused
//   order   "all"      every answer sets the screen to the value in the answer
//           "latest"   only the answer to the newest request counts; older answers are ignored
//           "serial"   one request in flight: taps meanwhile only change the screen; when the answer comes back,
//                      send the value the user wants now if it differs (the intended final state)
//   reads   "off"      no background refetch
//           "poll"     refetch every POLL s; a read's answer sets the screen whenever it lands
//           "guard"    the same polls, but a save cancels reads in flight, no poll starts while a save is in flight,
//                      and one fresh read goes out when the last save settles
//   fail    share of saves the server refuses
//   server  "steady" | "tail" (one request in eight takes a slow path at the server)
//   taps    "single" one tap at a time · "double" a quick second tap undoes the first · "mixed" some of each, closer
//                     together (the live machine's default)

import { rng } from "../../lib/random";
import { minHeap } from "../../lib/events";
import { averageOver, rankQuantile, mean } from "../../lib/stats";

export const OUT = [0.1, 0.06];          // network, client → server: 100 to 160 ms
export const BACK = [0.1, 0.06];         // network, server → client
export const WORK = [0.03, 0.05];        // the server's work: 30 to 80 ms
export const SLOW = { share: 1 / 8, extra: [0.6, 0.8] };   // the slow path: 0.6 to 1.4 s more
export const POLL = 1;                   // a background refetch every second
export const GAP = { single: [1.6, 0.8], double: [1.8, 0.8], mixed: [0.6, 0.8] };   // seconds between bursts
export const DOUBLE = [0.08, 0.12];      // the second tap of a double, 80 to 200 ms after the first
export const STEP = [0.3, 1.2];          // the user's next step (scroll on, open the next screen) after a tap
export const DOUBLE_SHARE = 0.3;         // "mixed": a share of the bursts are double taps
export const DEFAULTS = { ui: "opt", onFail: "rollback", order: "all", reads: "off", fail: 0, server: "tail", taps: "single", poll: POLL };

// One request's legs. Always the same number of draws, so a steady and a slow-tail run see the same dice.
function legs(r, tail) {
  const out = OUT[0] + OUT[1] * r(), back = BACK[0] + BACK[1] * r();
  let work = WORK[0] + WORK[1] * r();
  const slow = r(), extra = r();
  if (tail && slow < SLOW.share) work += SLOW.extra[0] + SLOW.extra[1] * extra;
  return { out, work, back };
}

export function makeSim(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const tail = cfg.server === "tail";
  const rTap = rng(seed * 2654435761 + 17), rLeg = rng(seed * 40503 + 101), rRead = rng(seed * 69069 + 7);
  const events = minHeap((a, b) => a.t < b.t || (a.t === b.t && a.n < b.n));
  let n = 0, now = 0;
  const at = (t, k, x) => events.push({ t, k, x, n: n++ });

  const server = { value: false, writes: 0, refused: 0 };
  const client = { screen: false, intent: false, saving: false, toastAt: -9, toasts: 0, rolled: 0, late: 0, ignored: 0, cancelled: 0, stale: 0, ignoredTaps: 0 };
  const taps = [];          // { i, t, value, shownAt, step, d, fail, req, ignored }
  const reqs = [];          // every request, set or get, for the figure: times of each leg and what became of it
  const inflight = [];      // set requests whose answer hasn't come back
  const reads = [];         // get requests in flight
  const log = [];           // what the live figure narrates
  const settles = [];       // each moment the last save in flight came back: { t, screen, intent, server }
  const falses = [];        // failed saves: how long the screen kept the value the server refused (from the tap)
  const backs = [];         // times the screen was set to a value the server no longer held
  let latestSent = -1, openFalse = null, saves = 0;
  const inSync = { wrong: 0 };   // seconds at rest (no save in flight) with screen ≠ server

  // ---------- the tap script ----------
  let scriptAt = 0.6;
  function nextBurst() {
    const g = GAP[cfg.taps] || GAP.single;
    const t0 = scriptAt;
    const dbl = cfg.taps === "double" || (cfg.taps === "mixed" && rTap() < DOUBLE_SHARE);
    const second = DOUBLE[0] + DOUBLE[1] * rTap();
    at(t0, "tap", { script: true });
    if (dbl) at(t0 + second, "tap", { script: true });
    scriptAt = t0 + g[0] + g[1] * rTap();
    at(scriptAt - 1e-6, "script");
  }
  nextBurst();
  if (cfg.reads !== "off") at(0.3, "poll");

  // ---------- requests ----------
  function sendSet(t, value, tap, prev) {
    const d = tap.d;
    const r = { id: reqs.length, n: ++saves, kind: "set", value, prev, tap: tap.i, sent: t, arrive: t + d.out, commit: t + d.out + d.work, done: t + d.out + d.work + d.back, fail: tap.fail, slow: d.work > 0.5, fate: "flight" };
    tap.used = true;
    reqs.push(r); inflight.push(r); latestSent = r.id;
    at(r.commit, "commit", r); at(r.done, "done", r);
    log.push({ t, type: "send", r });
    return r;
  }
  function sendGet(t, why) {
    const d = legs(rRead, tail);
    const r = { id: reqs.length, kind: "get", sent: t, arrive: t + d.out, commit: t + d.out + d.work, done: t + d.out + d.work + d.back, value: null, slow: d.work > 0.5, fate: "flight", why };
    reqs.push(r); reads.push(r);
    at(r.commit, "commit", r); at(r.done, "done", r);
    return r;
  }

  // The screen changes: note it when the new value is one the server no longer holds.
  function show(t, value, cause, r) {
    if (client.screen === value) return;
    client.screen = value;
    if (value !== server.value) { client.stale++; backs.push({ t, cause }); log.push({ t, type: "stale", cause, r }); }
  }
  function toast(t) { client.toastAt = t; client.toasts++; }

  function onTap(t, x) {
    const tap = { i: taps.length, t, d: legs(rLeg, tail), fail: rTap() < cfg.fail, step: STEP[0] + STEP[1] * rTap(), shownAt: null, live: !x.script };
    taps.push(tap);
    if (cfg.ui === "pess") {
      if (inflight.length) { tap.ignored = true; client.ignoredTaps++; log.push({ t, type: "disabled", tap }); return; }
      tap.value = !client.screen; client.intent = tap.value; client.saving = true;
      tap.req = sendSet(t, tap.value, tap, client.screen);
      log.push({ t, type: "tap", tap });
      return;
    }
    const prev = client.screen;
    tap.value = !client.screen; client.intent = tap.value; client.screen = tap.value; tap.shownAt = t;
    if (cfg.reads === "guard") for (const g of reads) if (g.fate === "flight") { g.fate = "cancelled"; g.cancelledAt = t; client.cancelled++; log.push({ t, type: "cancel", r: g }); }
    if (cfg.order === "serial" && inflight.length) { tap.queued = true; log.push({ t, type: "queued", tap }); return; }
    tap.req = sendSet(t, tap.value, tap, prev);
    log.push({ t, type: "tap", tap });
  }

  function onCommit(t, r) {
    if (r.kind === "get") { r.value = server.value; return; }
    if (r.fail) { server.refused++; r.refused = true; log.push({ t, type: "refused", r }); return; }
    const was = server.value;
    server.value = r.value; server.writes++;
    r.wrote = true; r.over = was !== r.value;
    log.push({ t, type: "write", r });
  }

  function settle(t) {
    settles.push({ t, screen: client.screen, intent: client.intent, server: server.value });
    log.push({ t, type: "settle" });
    if (cfg.reads === "guard") sendGet(t, "settle");
  }

  function onDone(t, r) {
    if (r.kind === "get") {
      reads.splice(reads.indexOf(r), 1);
      if (r.fate === "cancelled") return;
      r.fate = "applied";
      const before = client.screen;
      show(t, r.value, "read", r);
      if (before !== client.screen) log.push({ t, type: "readChanged", r });
      return;
    }
    inflight.splice(inflight.indexOf(r), 1);
    const tap = taps[r.tap];
    if (cfg.ui === "pess") {
      client.saving = false;
      if (r.fail) { r.fate = "failed"; toast(t); log.push({ t, type: "notSaved", r }); }
      else { r.fate = "applied"; show(t, r.value, "answer", r); tap.shownAt = t; }
    } else if (cfg.order === "latest" && r.id !== latestSent) {
      r.fate = "ignored"; client.ignored++;
      log.push({ t, type: "ignored", r });
    } else if (cfg.order === "serial") {
      if (!r.fail) {
        r.fate = "applied";
        if (client.intent !== r.value) {
          const last = taps[taps.length - 1];
          const next = sendSet(t, client.intent, last.used ? { ...last, d: legs(rLeg, tail), fail: rTap() < cfg.fail } : last, client.screen);
          next.followUp = true;
          log.push({ t, type: "followUp", r, next });
        } else show(t, r.value, "answer", r);
      } else if (client.intent === r.value) {
        // the user still wants what was refused: back to what the server has
        r.fate = "failed";
        if (cfg.onFail === "rollback") { r.told = true; client.rolled++; toast(t); show(t, server.value, "rollback", r); log.push({ t, type: "rollback", r }); }
        else log.push({ t, type: "failSilent", r });
      } else { r.fate = "failed"; r.moot = true; log.push({ t, type: "failMoot", r }); }
    } else if (r.fail) {
      r.fate = "failed";
      if (cfg.onFail === "rollback") { r.told = true; client.rolled++; toast(t); show(t, r.prev, "rollback", r); log.push({ t, type: "rollback", r }); }
      else log.push({ t, type: "failSilent", r });
    } else {
      r.fate = "applied";
      const before = client.screen;
      show(t, r.value, "answer", r);
      if (before !== client.screen) log.push({ t, type: "answerChanged", r });
    }
    // a failed save the screen had shown as done: was the user told, and had they already moved on?
    if (r.fail && cfg.ui === "opt" && r.fate === "failed" && !r.moot) {
      if (!r.told || tap.t + tap.step < t) client.late++;
      if (client.screen !== server.value) openFalse = openFalse || { start: tap.t };
      else falses.push(t - tap.t);
    }
    if (!inflight.length) settle(t);
  }

  function onPoll(t) {
    at(t + cfg.poll, "poll");
    if (cfg.reads === "guard" && inflight.length) { log.push({ t, type: "pollSkipped" }); return; }
    sendGet(t, "poll");
  }

  function step(e) {
    const t = e.t;
    // seconds at rest with screen ≠ server
    if (!inflight.length && client.screen !== server.value) inSync.wrong += t - now;
    now = t;
    if (e.k === "tap") onTap(t, e.x);
    else if (e.k === "script") nextBurst();
    else if (e.k === "commit") onCommit(t, e.x);
    else if (e.k === "done") onDone(t, e.x);
    else if (e.k === "poll") onPoll(t);
    if (openFalse && client.screen === server.value && !inflight.length) { falses.push(t - openFalse.start); openFalse = null; }
  }

  function runTo(T) {
    for (;;) {
      const e = events.peek();
      if (!e || e.t > T) break;
      events.pop();
      step(e);
    }
    if (!inflight.length && client.screen !== server.value) inSync.wrong += T - now;
    now = T;
  }

  return {
    cfg, server, client, taps, reqs, log, settles, falses, backs,
    runTo,
    /** A tap from the visitor, now. */
    tap(t, double = false) { runTo(t); at(t, "tap", {}); if (double) at(t + DOUBLE[0] + DOUBLE[1] * 0.5, "tap", {}); runTo(t); },
    get now() { return now; },
    get inflight() { return inflight; },
    get reads() { return reads; },
    get outOfSync() { return inSync.wrong; },
  };
}

// ---------- experiments: headless runs, averaged over seeds ----------
export const SEEDS = [3, 7, 11, 19, 23, 31, 43, 59];
export const RUN_SECS = 900;
const avg = (fn) => averageOver(SEEDS, fn);
const run = (cfg, seed, secs = RUN_SECS) => { const m = makeSim(cfg, seed); m.runTo(secs); return m; };
const share = (xs, f) => (xs.length ? xs.filter(f).length / xs.length : 0);

// 1. Pessimistic vs optimistic: from the tap to the screen showing it, for saves that succeed.
export function waitRun() {
  const pess = avg((seed) => {
    const m = run({ ui: "pess", server: "tail" }, seed);
    const w = m.taps.filter((x) => x.shownAt !== null).map((x) => x.shownAt - x.t);
    return { p50: rankQuantile(w, 0.5), p95: rankQuantile(w, 0.95), max: Math.max(...w) };
  });
  const opt = avg((seed) => {
    const m = run({ ui: "opt", server: "tail" }, seed);
    const w = m.taps.filter((x) => x.shownAt !== null).map((x) => x.shownAt - x.t);
    return { p50: rankQuantile(w, 0.5), p95: rankQuantile(w, 0.95) };
  });
  return { pess, opt };
}

// 2. 10% of saves fail: roll back and tell the user, or no error handler. No refetch.
export const FAIL = 0.1;
export function failRun() {
  const one = (onFail) => avg((seed) => {
    const m = run({ ui: "opt", onFail, fail: FAIL, server: "tail" }, seed);
    const fails = m.reqs.filter((r) => r.kind === "set" && r.fail && r.fate === "failed" && !r.moot).length;
    return { mean: mean(m.falses), p50: rankQuantile(m.falses, 0.5), p95: rankQuantile(m.falses, 0.95), told: m.client.rolled / Math.max(1, fails), fails };
  });
  return { rollback: one("rollback"), none: one("none") };
}

// 3. Double taps (like, then unlike 80-200 ms later) with a slow tail: what the screen and the server settle on.
export function raceRun() {
  const one = (order) => avg((seed) => {
    const m = run({ ui: "opt", order, taps: "double", server: "tail" }, seed);
    const s = m.settles;
    return {
      screen: share(s, (x) => x.screen !== x.intent), server: share(s, (x) => x.server !== x.intent),
      silent: share(s, (x) => x.screen !== x.server), settles: s.length,
      reqs: m.reqs.filter((r) => r.kind === "set").length / Math.max(1, m.taps.length),
    };
  });
  return { all: one("all"), latest: one("latest"), serial: one("serial") };
}

// 4. A refetch every second while saves are in flight: let reads land, or cancel and hold them during a save.
export function refetchRun() {
  const one = (reads) => avg((seed) => {
    const m = run({ ui: "opt", reads, taps: "single", server: "steady" }, seed);
    const taps = m.taps.length;
    const back = m.backs.filter((b) => b.cause === "read").length;
    return { per100: (100 * back) / Math.max(1, taps), reads: m.reqs.filter((r) => r.kind === "get").length / (RUN_SECS / 60), cancelled: m.reqs.filter((r) => r.fate === "cancelled").length };
  });
  return { poll: one("poll"), guard: one("guard") };
}

// 5. 10% of saves fail and the user moves on 0.3 to 1.5 s after each tap: failures they moved on before hearing about.
export function lateRun() {
  const one = (cfg) => avg((seed) => {
    const m = run({ fail: FAIL, ...cfg }, seed);
    const fails = m.reqs.filter((r) => r.kind === "set" && r.fail && r.fate === "failed" && !r.moot).length;
    return { late: m.client.late / Math.max(1, fails) };
  });
  return { steady: one({ ui: "opt", server: "steady" }), tail: one({ ui: "opt", server: "tail" }), pess: one({ ui: "pess", server: "tail" }) };
}

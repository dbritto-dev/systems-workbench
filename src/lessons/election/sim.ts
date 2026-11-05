// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// Five towers that elect a leader, Raft-style. Event-driven and seeded, shared by the live figure and the experiments.
// Times are seconds of real time (the figure plays them in slow motion); the numbers are round and illustrative.
//
// Every tower keeps a term (a number that only goes up), the term it voted in, and a log of writes. A leader sends
// heartbeats (AppendEntries, carrying any log entries a follower lacks) every HEARTBEAT. A follower that hears nothing
// from a leader for its election timeout starts an election: it moves to the next term, votes for itself and asks the
// others. A tower grants one vote per term, and only to a candidate whose log is at least as up to date as its own.
// Any message with a higher term makes the receiver adopt that term and step down to follower.
//
// Clients send writes to a tower they can reach; a follower passes the write to the leader it knows. A write is
// acknowledged (acked) when the leader commits it, and fails if the client hears nothing within CLIENT_TIMEOUT.
//
// cfg:
//   rule      "majority"  Raft: a candidate needs votes from a majority to lead, and a leader commits an entry once a
//                         majority of towers hold it
//             "takeover"  the rule people reach for: a tower that misses heartbeats takes over at once (no votes), and
//                         a leader commits once every tower it can still reach holds the entry
//   timeouts  "random"    each election timeout is drawn from ELECTION (150–300 ms)
//             "fixed"     every tower uses FIXED (200 ms); timers still fire up to NOISE late (scheduling)
//   n         3 (towers A, C, E) · 4 (A, B, D, E) · 5 (A–E)
//   prevote   false | true: before starting an election, a tower asks whether the others would vote for it (Raft's
//             Pre-Vote); they say yes only if they haven't heard a leader for ELECTION[0] and its log is up to date.
//             Only a majority of yeses lets it move to a new term.
//
// The network: "whole", "cut" (A B | C D E: the fence between B and C), or "solo" (E fenced off on its own).
// Messages across a fence are dropped; a crashed tower sends nothing and drops what it gets.

import { rng } from "../../lib/random";
import { minHeap } from "../../lib/events";
import { averageOver, rankQuantile, mean } from "../../lib/stats";

export const LETTERS = ["A", "B", "C", "D", "E"];
export const MEMBERS = { 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4] };
export const DELAY = [0.01, 0.01];        // one way, 10 to 20 ms
export const HEARTBEAT = 0.05;            // a leader's heartbeat every 50 ms
export const ELECTION = [0.15, 0.15];     // random election timeout, 150 to 300 ms
export const FIXED = 0.2;                 // the fixed timeout
export const NOISE = 0.002;               // a timer fires up to 2 ms late
export const RATE = 20;                   // client writes per second
export const CLIENT_TIMEOUT = 0.5;        // a client gives up on a write after 500 ms
export const REACH = 0.15;                // "takeover" leader: a follower counts as reachable if it answered within this
export const DEFAULTS = { rule: "majority", timeouts: "random", n: 5, prevote: false, rate: RATE };

const SIDE = { whole: [0, 0, 0, 0, 0], cut: [0, 0, 1, 1, 1], solo: [0, 0, 0, 0, 1] };

export function makeSim(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const ids = MEMBERS[cfg.n];
  const majority = Math.floor(ids.length / 2) + 1;
  const rNet = rng(seed * 2654435761 + 11), rTimer = rng(seed * 40503 + 97), rClient = rng(seed * 69069 + 5);
  const events = minHeap((a, b) => a.t < b.t || (a.t === b.t && a.n < b.n));
  let n = 0, now = 0;
  const at = (t, k, x) => events.push({ t, k, x, n: n++ });
  let net = "whole";
  const side = (i) => SIDE[net][i];

  const nodes = LETTERS.map((letter, i) => ({
    i, letter, on: ids.includes(i), down: false,
    state: "follower", term: 1, voted: null, leader: null, log: [], commit: 0,
    timerAt: 0, timerLen: 0, gen: 0, hbGen: 0,
    votes: new Set(), pre: new Set(), preTerm: 0,
    next: {}, match: {}, heard: {}, lastLeader: 0, since: 0,
  }));
  const live = () => ids.map((i) => nodes[i]).filter((x) => !x.down);
  const msgs = [];          // every message, for the figure: from, to (-1, -2: the client groups), kind, sent, arrive, fate
  const writes = [];        // client writes: { w, t, entry, fate: "flight" | "acked" | "failed", at }
  const log = [];           // what the live figure narrates
  const stats = { acked: 0, failed: 0, lost: 0, dropped: 0, elections: 0, splits: 0, leaderTerms: new Set(), splitTerms: new Set() };
  const terms = { started: new Set(), won: new Map() };   // term → winner
  const leaderLog = [];     // { t, i, term } every time a tower becomes leader

  // ---------- timers ----------
  const timeoutLen = () => (cfg.timeouts === "fixed" ? FIXED : ELECTION[0] + ELECTION[1] * rTimer()) + NOISE * rTimer();
  function resetTimer(x, t) {
    x.gen++;
    x.timerLen = timeoutLen();
    x.timerAt = t + x.timerLen;
    x.since = t;
    at(x.timerAt, "timer", { i: x.i, gen: x.gen });
  }
  function startHeartbeats(x, t) {
    x.hbGen++;
    at(t, "hb", { i: x.i, gen: x.hbGen });
  }

  // ---------- the network ----------
  function send(t, from, to, kind, body = {}) {
    const d = DELAY[0] + DELAY[1] * rNet();
    const m = { id: msgs.length, from, to, kind, sent: t, arrive: t + d, fate: "flight", net, ...body };
    const fs = from < 0 ? null : side(from), ts = to < 0 ? null : side(to);
    if (fs !== null && ts !== null && fs !== ts) m.cutAtSend = true;
    msgs.push(m);
    at(m.arrive, "msg", m);
    return m;
  }
  function deliverable(m) {
    if (m.cutAtSend) return false;
    if (m.from >= 0 && m.to >= 0 && side(m.from) !== side(m.to)) return false;
    if (m.to >= 0 && nodes[m.to].down) return false;
    return true;
  }

  // ---------- roles ----------
  const lastTerm = (x) => (x.log.length ? x.log[x.log.length - 1].term : 0);
  const upToDate = (x, lt, li) => lt > lastTerm(x) || (lt === lastTerm(x) && li >= x.log.length);

  function adopt(x, t, term, why) {
    // a higher term: step down to follower
    const was = x.state;
    x.term = term; x.voted = null; x.leader = null;
    if (was !== "follower") {
      x.state = "follower";
      x.hbGen++;
      if (was === "leader") log.push({ t, type: "stepdown", i: x.i, term, why });
      resetTimer(x, t);
    }
  }

  function becomeLeader(x, t) {
    x.state = "leader"; x.leader = x.i;
    x.hbGen++;
    for (const j of ids) { x.next[j] = x.log.length + 1; x.match[j] = j === x.i ? x.log.length : 0; x.heard[j] = t; }
    terms.won.set(x.term, x.i);
    leaderLog.push({ t, i: x.i, term: x.term });
    log.push({ t, type: cfg.rule === "takeover" ? "takeover" : "elected", i: x.i, term: x.term, votes: x.votes.size });
    startHeartbeats(x, t);
  }

  function startElection(x, t) {
    x.term++; x.state = "candidate"; x.voted = x.i; x.leader = null;
    x.votes = new Set([x.i]);
    stats.elections++;
    terms.started.add(x.term);
    resetTimer(x, t);
    if (cfg.rule === "takeover") { becomeLeader(x, t); return; }
    log.push({ t, type: "candidate", i: x.i, term: x.term });
    if (x.votes.size >= majority) { becomeLeader(x, t); return; }
    for (const j of ids) if (j !== x.i) send(t, x.i, j, "rv", { term: x.term, lt: lastTerm(x), li: x.log.length });
  }

  function onTimer(x, t) {
    if (x.state === "leader") return;
    // an election that ran out its timer without a winner
    if (x.state === "candidate" && !terms.won.has(x.term) && !stats.splitTerms.has(x.term)) {
      stats.splitTerms.add(x.term); stats.splits++;
      log.push({ t, type: "split", i: x.i, term: x.term });
    }
    if (cfg.prevote && cfg.rule === "majority") {
      x.pre = new Set([x.i]); x.preTerm = x.term + 1;
      resetTimer(x, t);
      log.push({ t, type: "prevote", i: x.i, term: x.term + 1 });
      for (const j of ids) if (j !== x.i) send(t, x.i, j, "pv", { term: x.term + 1, lt: lastTerm(x), li: x.log.length });
      return;
    }
    startElection(x, t);
  }

  function onHeartbeat(x, t) {
    if (x.state !== "leader" || x.down) return;
    for (const j of ids) {
      if (j === x.i) continue;
      const prev = x.next[j] - 1;
      send(t, x.i, j, "ae", { term: x.term, prev, prevTerm: prev > 0 ? x.log[prev - 1].term : 0, entries: x.log.slice(prev, prev + 64), commit: x.commit });
    }
    at(t + HEARTBEAT, "hb", { i: x.i, gen: x.hbGen });
  }

  // ---------- the log ----------
  function commitTo(x, t, k) {
    if (k <= x.commit) return;
    for (let idx = x.commit; idx < k; idx++) {
      const e = x.log[idx];
      if (x.state === "leader" && e.write && e.write.fate === "flight") {
        e.write.fate = "acked"; e.write.at = t; e.acked = true; e.by = x.i; stats.acked++;
        log.push({ t, type: "ack", i: x.i, w: e.write.w });
      }
    }
    x.commit = k;
  }
  function leaderCommit(x, t) {
    if (cfg.rule === "takeover") {
      // every tower it can still reach must hold the entry
      let k = x.log.length;
      for (const j of ids) if (j !== x.i && t - x.heard[j] <= REACH) k = Math.min(k, x.match[j]);
      commitTo(x, t, k);
      return;
    }
    const sorted = ids.map((j) => (j === x.i ? x.log.length : x.match[j])).sort((a, b) => b - a);
    const k = sorted[majority - 1];
    if (k > x.commit && x.log[k - 1].term === x.term) commitTo(x, t, k);
  }
  function truncate(x, t, from, incoming) {
    const gone = x.log.splice(from);
    let lost = 0, dropped = 0;
    for (const e of gone) {
      if (incoming.includes(e)) continue;
      if (e.acked) { if (!e.lost) { e.lost = true; stats.lost++; lost++; } }
      else if (!e.droppedOnce) { e.droppedOnce = true; stats.dropped++; dropped++; }
    }
    if (x.commit > x.log.length) x.commit = x.log.length;
    if (lost || dropped) log.push({ t, type: "truncate", i: x.i, lost, dropped });
  }

  // ---------- messages ----------
  function onMsg(m, t) {
    if (!deliverable(m)) { m.fate = "dropped"; return; }
    m.fate = "delivered";
    if (m.to < 0) return;
    const x = nodes[m.to];
    if (m.kind === "req") return onWrite(x, t, m.write);
    if (m.kind === "fwd") {
      if (x.state === "leader") return append(x, t, m.write);
      return failWrite(m.write, t, "noLeader");
    }
    if (m.kind === "pv") {
      const heardRecently = x.state === "leader" || t - x.lastLeader < ELECTION[0];
      const ok = m.term > x.term && !heardRecently && upToDate(x, m.lt, m.li);
      send(t, x.i, m.from, "pvr", { term: x.term, ok, ask: m.term });
      return;
    }
    if (m.kind === "pvr") {
      const c = x;
      if (m.term > c.term) { adopt(c, t, m.term, "higher"); return; }
      if (c.state === "leader" || c.preTerm !== m.ask || c.preTerm !== c.term + 1 || !m.ok) return;
      c.pre.add(m.from);
      if (c.pre.size >= majority) { c.pre = new Set(); c.preTerm = 0; startElection(c, t); }
      return;
    }
    if (m.term > x.term) adopt(x, t, m.term, m.kind === "rv" ? "vote" : "higher");
    if (m.kind === "rv") {
      const grant = m.term === x.term && (x.voted === null || x.voted === m.from) && upToDate(x, m.lt, m.li);
      if (grant) { x.voted = m.from; resetTimer(x, t); }
      send(t, x.i, m.from, "rvr", { term: x.term, granted: grant });
      if (!grant && m.term === x.term && !upToDate(x, m.lt, m.li)) log.push({ t, type: "behind", i: x.i, c: m.from, term: m.term });
      return;
    }
    if (m.kind === "rvr") {
      if (x.state !== "candidate" || m.term !== x.term || !m.granted) return;
      x.votes.add(m.from);
      if (x.votes.size >= majority) becomeLeader(x, t);
      return;
    }
    if (m.kind === "ae") {
      if (m.term < x.term) { send(t, x.i, m.from, "aer", { term: x.term, ok: false, len: x.log.length }); return; }
      if (cfg.rule === "takeover" && x.state === "leader") {
        // two leaders of the same term: the lower letter keeps it
        if (m.from > x.i) { send(t, x.i, m.from, "aer", { term: x.term, ok: false, len: x.log.length, rival: true }); return; }
        x.state = "follower"; x.hbGen++;
        log.push({ t, type: "stepdown", i: x.i, term: x.term, why: "rival" });
      }
      if (x.state === "candidate") x.state = "follower";
      // "takeover": a follower already following another leader of this term keeps the lower letter
      if (cfg.rule === "takeover" && x.leader !== null && x.leader !== m.from && m.from > x.leader) {
        send(t, x.i, m.from, "aer", { term: x.term, ok: false, len: x.log.length, rival: true });
        return;
      }
      x.leader = m.from; x.lastLeader = t;
      resetTimer(x, t);
      if (m.prev > x.log.length || (m.prev > 0 && x.log[m.prev - 1].term !== m.prevTerm)) {
        send(t, x.i, m.from, "aer", { term: x.term, ok: false, len: Math.min(x.log.length, m.prev - 1) });
        return;
      }
      let idx = m.prev;
      for (const e of m.entries) {
        // entries are shared objects, so a different object at this index is a conflicting entry
        if (idx < x.log.length && x.log[idx] !== e) truncate(x, t, idx, m.entries);
        if (idx >= x.log.length) x.log.push(e);
        idx++;
      }
      commitTo(x, t, Math.min(m.commit, m.prev + m.entries.length));
      send(t, x.i, m.from, "aer", { term: x.term, ok: true, match: m.prev + m.entries.length });
      return;
    }
    if (m.kind === "aer") {
      if (x.state !== "leader" || m.term !== x.term) return;
      x.heard[m.from] = t;
      if (m.rival) return;
      if (m.ok) { x.match[m.from] = Math.max(x.match[m.from], m.match); x.next[m.from] = x.match[m.from] + 1; leaderCommit(x, t); }
      else x.next[m.from] = Math.max(1, Math.min(x.next[m.from] - 1, m.len + 1));
    }
  }

  // ---------- clients ----------
  function newWrite(t) {
    at(t + -Math.log(1 - rClient()) / cfg.rate, "write");
    const reach = live().filter((x) => net !== "solo" || side(x.i) === 0);
    const pick = rClient();
    if (!reach.length) return;
    const x = reach[Math.floor(pick * reach.length)];
    const w = { w: writes.length + 1, t, entry: null, fate: "flight", to: x.i, zone: side(x.i) };
    writes.push(w);
    at(t + CLIENT_TIMEOUT, "clientTimeout", w);
    send(t, side(x.i) === 0 ? -1 : -2, x.i, "req", { write: w });
  }
  function onWrite(x, t, w) {
    if (x.state === "leader") return append(x, t, w);
    if (x.leader !== null && x.state === "follower") { send(t, x.i, x.leader, "fwd", { write: w }); return; }
    failWrite(w, t, "noLeader");
  }
  function append(x, t, w) {
    if (w.fate !== "flight") return;
    const e = { term: x.term, write: w };
    w.entry = e; w.leader = x.i; w.term = x.term;
    x.log.push(e);
    x.match[x.i] = x.log.length;
    if (cfg.rule === "takeover") leaderCommit(x, t);
    else if (majority === 1) leaderCommit(x, t);
  }
  function failWrite(w, t, why) {
    if (w.fate !== "flight") return;
    w.fate = "failed"; w.at = t; w.why = why; stats.failed++;
    log.push({ t, type: "fail", w: w.w, why, leader: w.leader, term: w.term });
  }

  // ---------- the loop ----------
  function step(e) {
    now = e.t;
    const t = e.t;
    if (e.k === "msg") onMsg(e.x, t);
    else if (e.k === "timer") { const x = nodes[e.x.i]; if (!x.down && e.x.gen === x.gen) onTimer(x, t); }
    else if (e.k === "hb") { const x = nodes[e.x.i]; if (!x.down && e.x.gen === x.hbGen) onHeartbeat(x, t); }
    else if (e.k === "write") newWrite(t);
    else if (e.k === "clientTimeout") failWrite(e.x, t, e.x.entry ? "uncommitted" : "unreachable");
    else if (e.k === "do") e.x(t);
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

  // ---------- the start: the cluster has been running; A leads term 1 ----------
  for (const i of ids) {
    const x = nodes[i];
    if (i === 0) { x.votes = new Set(ids); becomeLeaderQuiet(x); }
    else { x.leader = 0; x.voted = 0; resetTimer(x, 0); x.lastLeader = 0; }
  }
  function becomeLeaderQuiet(x) {
    x.state = "leader"; x.leader = x.i;
    for (const j of ids) { x.next[j] = 1; x.match[j] = 0; x.heard[j] = 0; }
    terms.won.set(1, x.i); terms.started.add(1);
    leaderLog.push({ t: 0, i: x.i, term: 1 });
    startHeartbeats(x, 0);
  }
  at(0.02, "write");

  const api = {
    cfg, nodes, ids, majority, msgs, writes, log, stats, terms, leaderLog,
    runTo,
    get now() { return now; },
    get net() { return net; },
    /** Change the network now: "whole", "cut" or "solo". */
    setNet(mode, t = now) { runTo(t); if (net === mode) return; const was = net; net = mode; log.push({ t, type: "net", mode, was }); },
    /** Crash a tower now; it keeps its term, vote and log (Raft keeps them on disk). */
    crash(i, t = now) {
      runTo(t);
      const x = nodes[i];
      if (!x.on || x.down) return;
      x.down = true; x.gen++; x.hbGen++;
      log.push({ t, type: "crash", i, wasLeader: x.state === "leader", term: x.term });
      x.state = "follower"; x.leader = null;
    },
    restart(i, t = now) {
      runTo(t);
      const x = nodes[i];
      if (!x.on || !x.down) return;
      x.down = false; x.state = "follower"; x.leader = null;
      resetTimer(x, t);
      log.push({ t, type: "restart", i, term: x.term });
    },
    /** Run fn(t) at model time t. */
    schedule(t, fn) { at(t, "do", fn); },
    leaders() { return ids.filter((i) => !nodes[i].down && nodes[i].state === "leader"); },
    /** The leader of the highest term among live towers, or -1. */
    topLeader() { let best = -1; for (const i of api.leaders()) if (best < 0 || nodes[i].term > nodes[best].term) best = i; return best; },
  };
  return api;
}

// ---------- experiments: headless runs, averaged over seeds ----------
export const SEEDS = [3, 7, 11, 19, 23, 31, 43, 59];
const avg = (fn) => averageOver(SEEDS, fn);
const inWindow = (w, a, b) => w.t >= a && w.t < b;

// 1 and 2. Cut A B | C D E for CUT seconds with A leading: who acks, and what the heal throws away.
export const CUT = { at: 1, len: 2, after: 2 };
export function cutRun(rule) {
  return avg((seed) => {
    const m = makeSim({ rule }, seed);
    const t0 = CUT.at, t1 = CUT.at + CUT.len;
    m.setNet("cut", t0);
    let aLeads = 0;
    m.schedule(t1 - 1e-6, () => { aLeads = m.nodes[0].state === "leader" ? 1 : 0; });
    m.setNet("whole", t1);
    // the first leader on the C D E side after the cut
    m.runTo(t1 + CUT.after);
    const first = m.leaderLog.find((l) => l.t >= t0 && l.i >= 2);
    const cutWrites = m.writes.filter((w) => inWindow(w, t0, t1));
    // acknowledged during the cut, by the side of the leader that acked them
    const ackedBy = (sideOf) => m.writes.filter((w) => w.fate === "acked" && w.at >= t0 && w.at < t1 && sideOf(w.entry.by)).length;
    const left = ackedBy((i) => i < 2), right = ackedBy((i) => i >= 2);
    // two towers acting as leaders that each still acked writes during the cut
    return {
      failover: first ? first.t - t0 : CUT.len,
      left, right, lost: m.stats.lost, dropped: m.stats.dropped,
      leftShare: cutWrites.filter((w) => w.zone === 0).length / Math.max(1, cutWrites.length),
      writes: cutWrites.length,
      failedShare: cutWrites.filter((w) => w.fate === "failed").length / Math.max(1, cutWrites.length),
      aLeads, aTerm: 1,
    };
  });
}

// 3. The leader crashes: time to a new leader, and terms tried per failover, random vs fixed timeouts.
export const FAILOVERS = 25;
export const GIVE_UP = 10;               // stop waiting for a leader after 10 s
export function failoverRun(timeouts) {
  const all = [], rounds = [];
  for (const seed of SEEDS) for (let k = 0; k < FAILOVERS; k++) {
    // a fresh cluster per failover, the crash landing at a different point between heartbeats each time
    const m = makeSim({ timeouts, rate: 5 }, seed * 1000 + k + 1);
    const t = 0.4 + (k * 0.0137) % HEARTBEAT;
    const before = m.terms.started.size;
    m.crash(0, t);
    let got = null, u = t;
    while (!got && u < t + GIVE_UP) { u += 0.005; m.runTo(u); got = m.leaderLog.find((l) => l.t > t) || null; }
    all.push(got ? got.t - t : GIVE_UP);
    rounds.push(m.terms.started.size - before);
  }
  return {
    mean: mean(all), p50: rankQuantile(all, 0.5), p95: rankQuantile(all, 0.95), max: Math.max(...all),
    rounds: mean(rounds), gaveUp: all.filter((x) => x >= GIVE_UP).length / all.length, count: all.length,
    under1: all.filter((x) => x < 1).length / all.length,
  };
}

// 4. Towers down, or the network cut in two: share of writes acked, for 3, 4 and 5 towers.
export function sizeRun(nTowers, downCount, cut = false) {
  return avg((seed) => {
    const m = makeSim({ n: nTowers }, seed);
    // crash followers from the far end: E first, then D (or C)
    const order = m.ids.filter((i) => i !== 0).reverse();
    for (let k = 0; k < downCount; k++) m.crash(order[k], 0.5);
    if (cut) m.setNet("cut", 0.5);
    m.runTo(3.5);
    const ws = m.writes.filter((w) => inWindow(w, 1, 3));
    const acked = ws.filter((w) => w.fate === "acked");
    const lat = acked.map((w) => w.at - w.t);
    return { acked: acked.length / Math.max(1, ws.length), lat: lat.length ? rankQuantile(lat, 0.5) : 0 };
  });
}

// 5. E fenced off alone for SOLO.len seconds, then back: what its return does to the cluster, with and without pre-vote.
export const SOLO = { at: 0.5, len: 2, after: 2 };
export function soloRun(prevote) {
  return avg((seed) => {
    const m = makeSim({ prevote }, seed);
    const t0 = SOLO.at, t1 = SOLO.at + SOLO.len;
    m.setNet("solo", t0);
    m.runTo(t1);
    const eTerm = m.nodes[4].term, others = Math.max(...[0, 1, 2, 3].map((i) => m.nodes[i].term));
    const leadersBefore = m.leaderLog.length, electionsBefore = m.stats.elections;
    m.setNet("whole", t1);
    // time after the heal with no leader among A–D
    let gap = 0, u = t1;
    const dt = 0.002;
    while (u < t1 + SOLO.after) {
      u += dt; m.runTo(u);
      if (!m.leaders().some((i) => i !== 4)) gap += dt;
    }
    const after = m.writes.filter((w) => inWindow(w, t1, t1 + 1));
    return {
      eTerm, others, ahead: eTerm - others,
      newLeaders: m.leaderLog.length - leadersBefore, elections: m.stats.elections - electionsBefore,
      gap, failed: after.filter((w) => w.fate === "failed").length,
      eWon: m.leaderLog.slice(leadersBefore).some((l) => l.i === 4) ? 1 : 0,
    };
  });
}

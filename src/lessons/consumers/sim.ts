// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// A consumer group reading a topic of six partitions (lanes), with the group coordinator handing the lanes out.
// Event-driven and seeded, shared by the live figure and the experiments. Times are seconds.
//
// The model follows Kafka's classic group protocol, scaled down so a rebalance can be watched:
//   - records arrive on each lane at random (Poisson), spread evenly over the lanes (no hot key);
//   - a worker (consumer) owns some lanes; it polls a batch of up to `batch` records from them, round-robin, works
//     them one at a time, and commits the batch's offsets at its next poll (lag = records not yet committed);
//   - a rebalance starts when a worker joins, leaves, or is dropped. Every member joins it at its next poll (so the
//     round waits for the slowest batch in progress), then the coordinator takes `sync` seconds to hand out lanes;
//   - eager: a member drops all its lanes when it joins the round, so every lane stops until the hand-out; lanes are
//     handed out in contiguous ranges (the range assignor);
//   - cooperative: members keep their lanes and keep working; the hand-out keeps every lane where it was if it can
//     (sticky) and gives unowned lanes away at once; a lane that must change hands is revoked by its owner at its next
//     poll and handed to its new owner in a second round;
//   - a worker that stops cleanly leaves the group at once (a dynamic member) or, with a static id, stays in it until
//     its session timeout runs out; one that restarts within the timeout gets its lanes back with no rebalance;
//   - a crashed worker sends nothing: the coordinator drops it when its session timeout (`session`) runs out;
//   - a worker whose batch runs longer than the poll limit (`pollLimit`, Kafka's max.poll.interval.ms) leaves the
//     group; it finishes the batch anyway, its commit fails (another worker redoes those records), and it rejoins.
//     The same limit is the rebalance timeout: a member that hasn't joined a round by then is dropped.
//
// cfg:
//   rate       records per second arriving, all lanes together
//   workers    workers running at the start (1..6)
//   service    mean seconds of work per record (each one 0.5..1.5 × mean), times `slow`
//   batch      records per poll (max.poll.records)
//   protocol   "eager" | "coop"
//   members    "dynamic" | "static"
//   session    session timeout, seconds
//   pollLimit  poll limit and rebalance timeout, seconds
//   sync       seconds the coordinator takes to hand out lanes once everyone has joined
//   restart    seconds a restarting worker is down
//   idle       seconds between polls of a worker with nothing to do

import { rngMixed } from "../../lib/random";
import { averageOver } from "../../lib/stats";

export const LANES = 6;
export const SLOTS = 6;
export const DEFAULTS = { rate: 6, workers: 3, service: 1 / 3, slow: 1, batch: 10, protocol: "eager", members: "dynamic", session: 45, pollLimit: 10, sync: 1, restart: 8, idle: 0.2 };

// Lanes handed out in contiguous ranges, the first members taking one extra (Kafka's range assignor).
export function rangeAssign(members, lanes = LANES) {
  const out = new Array(lanes).fill(null), n = members.length;
  if (!n) return out;
  const per = Math.floor(lanes / n), extra = lanes % n;
  let l = 0;
  members.forEach((m, i) => { for (let k = 0; k < per + (i < extra ? 1 : 0); k++) out[l++] = m; });
  return out;
}

// Balanced and sticky: every member ends with ⌊P/n⌋ or ⌈P/n⌉ lanes, keeping as many of the lanes it already owns as it
// can (the idea of Kafka's cooperative sticky assignor). owners[l] is the current owner or null.
export function stickyAssign(owners, members, lanes = LANES) {
  const out = new Array(lanes).fill(null), n = members.length;
  if (!n) return out;
  const base = Math.floor(lanes / n), extra = lanes % n;
  const owned = new Map(members.map((m) => [m, []]));
  owners.forEach((o, l) => { if (owned.has(o)) owned.get(o).push(l); });
  const order = [...members].sort((a, b) => owned.get(b).length - owned.get(a).length || a - b);
  const quota = new Map(order.map((m, i) => [m, base + (i < extra ? 1 : 0)]));
  const free = [];
  for (const m of members) owned.get(m).forEach((l, i) => { if (i < quota.get(m)) out[l] = m; else free.push(l); });
  owners.forEach((o, l) => { if (!owned.has(o)) free.push(l); });
  free.sort((a, b) => a - b);
  for (const m of [...members].sort((a, b) => a - b)) {
    let have = out.filter((x) => x === m).length;
    while (have < quota.get(m) && free.length) { out[free.shift()] = m; have++; }
  }
  return out;
}

export function makeGroup(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rArr = rngMixed(seed * 9973 + 1), rSvc = rngMixed(seed * 7919 + 2);
  const exp = (rate) => -Math.log(1 - rArr()) / rate;
  let t = 0;
  const perLane = cfg.rate / LANES;
  // A lane: the log end, the committed offset, the next record its owner will work (what the lane still shows), the
  // fetch position, and each record's arrival time and how many times it has been worked.
  const lanes = Array.from({ length: LANES }, (_, i) => ({ i, end: 0, committed: 0, next: 0, pos: 0, owner: null, born: [], worked: [], nextArrival: exp(perLane), stopped: true, stopSince: 0, everStopped: false, longest: 0 }));
  const slots = Array.from({ length: SLOTS }, (_, i) => ({ i, state: "off", inGroup: false, joined: false, waiting: false, kicked: false, leaving: null, batch: [], bi: 0, cur: null, recEnd: Infinity, nextPoll: Infinity, lastPoll: 0, uncommitted: [], revoke: new Set(), lastHb: 0, upAt: Infinity, since: 0 }));
  // The coordinator: stable, or a round in progress (joining, then syncing), and in a cooperative rebalance the round.
  const co = { state: "stable", round: 1, roundStart: 0, deadline: Infinity, syncAt: Infinity, again: false, generation: 0, rebalances: 0, rounds: 0, rebalanceSince: 0, busySecs: 0, lastReason: "" };
  const st = { produced: 0, worked: 0, duplicates: 0, committedN: 0, kicks: 0, expiries: 0, laneSecs: 0, maxWait: 0, waits: 0, waitN: 0, failedCommits: 0 };
  const log = [];
  const script = [];   // [{ at, fn }], sorted
  let markAt = 0;

  const svc = () => cfg.service * cfg.slow * (0.5 + rSvc());
  const groupMembers = () => slots.filter((s) => s.inGroup).map((s) => s.i);
  const say = (type, extra = {}) => log.push({ t, type, ...extra });

  // ---------- lanes being read or not ----------
  function laneStopped(l) {
    if (l.owner === null) return true;
    return slots[l.owner].state !== "up";
  }
  function refreshStops() {
    for (const l of lanes) {
      const s = laneStopped(l);
      if (s === l.stopped) continue;
      if (s) { l.stopSince = t; if (t >= markAt) l.everStopped = true; }
      else { const from = Math.max(l.stopSince, markAt); if (t > from) l.longest = Math.max(l.longest, t - from); }
      l.stopped = s;
    }
  }
  function release(l) { l.owner = null; l.pos = l.committed; l.next = l.committed; }
  function give(l, m) { l.owner = m; l.pos = l.committed; l.next = l.committed; }

  // ---------- the coordinator ----------
  function startRebalance(reason) {
    co.lastReason = reason;
    if (co.state === "stable") {
      co.state = "joining"; co.round = 1; co.roundStart = t; co.deadline = t + cfg.pollLimit;
      co.rebalances++; co.rounds++; co.rebalanceSince = t;
      for (const s of slots) if (s.inGroup) s.joined = false;
      say("rebalance", { reason });
      for (const s of slots) if (s.inGroup && s.state === "up" && !s.batch.length && !s.waiting) s.nextPoll = Math.min(s.nextPoll, t + 0.05);
    } else if (co.state === "syncing") co.again = true;
    checkBarrier();
  }
  function checkBarrier() {
    if (co.state !== "joining") return;
    if (slots.some((s) => s.inGroup && !s.joined)) return;
    co.state = "syncing"; co.syncAt = t + cfg.sync; co.deadline = Infinity;
  }
  // Members that haven't joined the round by the rebalance timeout are dropped from the group.
  function roundTimeout() {
    for (const s of slots) if (s.inGroup && !s.joined) drop(s, "timeout");
    co.deadline = Infinity;
    checkBarrier();
  }
  function sync() {
    co.syncAt = Infinity; co.generation++;
    const members = slots.filter((s) => s.inGroup && s.joined).map((s) => s.i);
    if (cfg.protocol === "eager") {
      const plan = rangeAssign(members);
      lanes.forEach((l, i) => give(l, plan[i]));
      finishRebalance();
      for (const s of slots) if (s.inGroup && s.waiting) { s.waiting = false; fetch(s); }
      return;
    }
    const plan = stickyAssign(lanes.map((l) => l.owner), members);
    let moves = 0;
    lanes.forEach((l, i) => {
      if (l.owner === null) { if (plan[i] !== null) give(l, plan[i]); }
      else if (plan[i] !== l.owner) { slots[l.owner].revoke.add(i); moves++; }
    });
    if (co.round === 1 && moves) {
      say("revoke", { lanes: lanes.filter((l) => l.owner !== null && slots[l.owner].revoke.has(l.i)).map((l) => l.i) });
      co.state = "joining"; co.round = 2; co.rounds++; co.roundStart = t; co.deadline = t + cfg.pollLimit;
      for (const s of slots) if (s.inGroup) s.joined = false;
      for (const s of slots) if (s.inGroup && s.state === "up" && !s.batch.length) s.nextPoll = Math.min(s.nextPoll, t + 0.05);
      checkBarrier();
      return;
    }
    for (const s of slots) s.revoke.clear();
    finishRebalance();
  }
  function finishRebalance() {
    co.state = "stable"; co.busySecs += t - co.rebalanceSince;
    say("assigned", { owners: lanes.map((l) => l.owner), generation: co.generation });
    if (co.again) { co.again = false; startRebalance("again"); }
  }

  // ---------- members ----------
  function joinGroup(s) {
    s.inGroup = true; s.joined = false;
    if (co.state === "stable") startRebalance("join");
    else if (co.state === "syncing") co.again = true;
    if (co.state === "joining") { s.joined = true; if (cfg.protocol === "eager") s.waiting = true; checkBarrier(); }
  }
  // Leave the group (or be dropped from it): its lanes go back to the coordinator.
  function drop(s, why) {
    s.inGroup = false; s.joined = false; s.waiting = false; s.revoke.clear();
    for (const l of lanes) if (l.owner === s.i) release(l);
    if (why === "kick" || why === "timeout") {
      if (s.state === "up" && s.batch.length) { s.kicked = true; st.kicks++; }
      say("kick", { slot: s.i, why });
    } else if (why === "expired") { st.expiries++; say("expired", { slot: s.i }); }
    startRebalance(why);
  }
  function startWorker(s) {
    s.state = "up"; s.kicked = false; s.leaving = null; s.batch = []; s.bi = 0; s.cur = null; s.recEnd = Infinity; s.uncommitted = []; s.revoke.clear();
    s.lastPoll = t; s.since = t; s.upAt = Infinity; s.waiting = false;
    if (cfg.members === "static" && s.inGroup) {
      // a static member back within its session: same lanes, no rebalance
      say("back", { slot: s.i });
      for (const l of lanes) if (l.owner === s.i) { l.pos = l.committed; l.next = l.committed; }
      if (co.state === "joining" && !s.joined) { s.joined = true; if (cfg.protocol === "eager") { revokeAll(s); s.waiting = true; } checkBarrier(); }
      if (!s.waiting) fetch(s);
      return;
    }
    say("start", { slot: s.i });
    joinGroup(s);
    if (!s.waiting) fetch(s);
  }
  function revokeAll(s) { for (const l of lanes) if (l.owner === s.i) release(l); }
  function commit(s) {
    for (const [li, off] of s.uncommitted) {
      const l = lanes[li];
      if (l.owner === s.i && off + 1 > l.committed) { st.committedN += off + 1 - l.committed; l.committed = off + 1; }
    }
    s.uncommitted = [];
  }
  function fetch(s) {
    s.batch = []; s.bi = 0; s.cur = null; s.recEnd = Infinity; s.nextPoll = Infinity;
    const mine = lanes.filter((l) => l.owner === s.i);
    let more = true;
    while (s.batch.length < cfg.batch && more) {
      more = false;
      for (const l of mine) if (l.pos < l.end && s.batch.length < cfg.batch) { s.batch.push([l.i, l.pos++]); more = true; }
    }
    if (!s.batch.length) { s.nextPoll = t + cfg.idle; return; }
    begin(s);
  }
  function begin(s) {
    s.cur = s.batch[s.bi];
    const l = lanes[s.cur[0]];
    if (l.owner === s.i && l.next <= s.cur[1]) l.next = s.cur[1] + 1;
    s.recEnd = t + svc();
  }
  function poll(s) {
    s.lastPoll = t; s.batch = []; s.bi = 0; s.cur = null; s.recEnd = Infinity; s.nextPoll = Infinity;
    if (s.kicked) {
      // out of the group while it worked: the commit fails; another worker redoes these records
      s.kicked = false;
      if (s.uncommitted.length) { st.failedCommits += s.uncommitted.length; say("failed", { slot: s.i, n: s.uncommitted.length }); }
      s.uncommitted = [];
      joinGroup(s);
      if (!s.waiting) fetch(s);
      return;
    }
    commit(s);
    if (s.leaving) {
      const kind = s.leaving; s.leaving = null;
      say(kind === "restart" ? "restart" : "stop", { slot: s.i });
      s.state = kind === "restart" ? "down" : "off"; s.upAt = kind === "restart" ? t + cfg.restart : Infinity; s.lastHb = t;
      if (cfg.members === "dynamic") drop(s, "leave");
      refreshStops();
      return;
    }
    if (co.state === "joining" && s.inGroup && !s.joined) {
      s.joined = true;
      if (cfg.protocol === "eager") { revokeAll(s); s.waiting = true; }
      else if (s.revoke.size) { for (const li of s.revoke) release(lanes[li]); s.revoke.clear(); }
      checkBarrier();
    }
    if (s.waiting) return;
    fetch(s);
  }
  function workDone(s) {
    const [li, off] = s.cur, l = lanes[li];
    l.worked[off] = (l.worked[off] || 0) + 1;
    st.worked++;
    if (l.worked[off] > 1) { if (t >= markAt) st.duplicates++; }
    else if (l.born[off] >= markAt) { const w = t - l.born[off]; st.waits += w; st.waitN++; if (w > st.maxWait) st.maxWait = w; }
    s.uncommitted.push(s.cur);
    s.bi++;
    if (s.bi < s.batch.length) begin(s); else poll(s);
  }

  // ---------- the clock ----------
  function nextEvent() {
    let when = Infinity, what = null, who = null;
    const take = (w, k, x) => { if (w < when) { when = w; what = k; who = x; } };
    for (const l of lanes) take(l.nextArrival, "arrive", l);
    for (const s of slots) {
      if (s.state === "up") {
        take(s.recEnd, "work", s);
        take(s.nextPoll, "poll", s);
        if (s.inGroup && s.batch.length) take(s.lastPoll + cfg.pollLimit, "kick", s);
      }
      if (s.state === "down") take(s.upAt, "up", s);
      if ((s.state === "crashed" || s.state === "down" || s.state === "off") && s.inGroup) take(s.lastHb + cfg.session, "expire", s);
    }
    take(co.syncAt, "sync", null);
    take(co.deadline, "deadline", null);
    if (script.length) take(script[0].at, "script", null);
    return { when, what, who };
  }
  function runTo(until) {
    for (;;) {
      const e = nextEvent();
      if (e.when > until) break;
      advance(e.when);
      if (e.what === "arrive") { const l = e.who; l.born[l.end++] = t; st.produced++; l.nextArrival = t + exp(perLane); }
      else if (e.what === "work") workDone(e.who);
      else if (e.what === "poll") poll(e.who);
      else if (e.what === "kick") drop(e.who, "kick");
      else if (e.what === "up") startWorker(e.who);
      else if (e.what === "expire") drop(e.who, "expired");
      else if (e.what === "sync") sync();
      else if (e.what === "deadline") roundTimeout();
      else if (e.what === "script") script.shift().fn();
      refreshStops();
    }
    advance(until);
  }
  function advance(to) {
    if (to > t) {
      const from = Math.max(t, markAt);
      if (to > from) st.laneSecs += (to - from) * lanes.filter((l) => l.stopped).length;
      t = to;
    }
  }
  const at = (when, fn) => { script.push({ at: when, fn }); script.sort((a, b) => a.at - b.at); };

  // ---------- what a reader (or an experiment) can do ----------
  const upInGroup = () => slots.filter((s) => s.state === "up" && s.inGroup && !s.leaving);
  function addWorker() {
    const s = slots.find((x) => x.state === "off" && !x.inGroup) || slots.find((x) => x.state === "crashed" && !x.inGroup);
    if (!s) return null;
    startWorker(s); refreshStops(); return s.i;
  }
  function removeWorker() {
    const s = upInGroup().pop();
    if (!s) return null;
    s.leaving = "stop"; return s.i;
  }
  function restartWorker(i) { const s = slots[i]; if (s.state !== "up") return null; s.leaving = "restart"; return i; }
  function crash(i) {
    const s = i === undefined ? upInGroup()[0] : slots[i];
    if (!s || s.state !== "up") return null;
    s.state = "crashed"; s.lastHb = t; s.batch = []; s.cur = null; s.recEnd = Infinity; s.nextPoll = Infinity; s.uncommitted = []; s.leaving = null; s.kicked = false;
    if (!s.inGroup) { refreshStops(); return s.i; }
    say("crash", { slot: s.i });
    refreshStops();
    return s.i;
  }
  // Restart every running worker, one at a time, `gap` seconds apart (a deploy).
  function rolling(gap = 20) {
    const list = slots.filter((s) => s.state === "up").map((s) => s.i);
    list.forEach((i, k) => at(t + k * gap, () => restartWorker(i)));
    return list.length;
  }
  function mark() {
    markAt = t;
    st.laneSecs = 0; st.duplicates = 0; st.maxWait = 0; st.waits = 0; st.waitN = 0;
    co.busySecs = 0;
    const r0 = co.rebalances, c0 = st.committedN, k0 = st.kicks;
    for (const l of lanes) { l.everStopped = l.stopped; l.longest = 0; if (l.stopped) l.stopSince = t; }
    return { rebalances: r0, committed: c0, kicks: k0 };
  }
  // The longest stop of each lane so far in the window, counting a stop still going on.
  const longestStops = () => lanes.map((l) => Math.max(l.longest, l.stopped ? t - Math.max(l.stopSince, markAt) : 0));

  // The first workers start together and join one rebalance (as a broker's initial rebalance delay arranges).
  for (let i = 0; i < Math.min(SLOTS, cfg.workers); i++) { const s = slots[i]; s.state = "up"; s.inGroup = true; s.lastPoll = 0; s.nextPoll = 0; }
  startRebalance("start");
  refreshStops();

  return {
    cfg, lanes, slots, co, st, log, runTo, at, addWorker, removeWorker, restartWorker, crash, rolling, mark, longestStops,
    get t() { return t; },
    lag: () => lanes.reduce((a, l) => a + l.end - l.committed, 0),
  };
}

// ---------- experiments: headless runs averaged over seeds ----------
const SEEDS = [11, 23, 37, 41, 59, 67, 73, 89];
const avg = (fn) => averageOver(SEEDS, fn);

// 1. Six lanes, 12 records a second, a worker does about 3 a second: 3, 4 or 6 workers, for two minutes.
export const UNEVEN = { rate: 12, secs: 120 };
export function unevenRun() {
  const run = (workers) => avg((seed) => {
    const m = makeGroup({ rate: UNEVEN.rate, workers }, seed);
    m.runTo(UNEVEN.secs);
    const lag = m.lanes.map((l) => l.end - l.committed);
    const out = { total: lag.reduce((a, b) => a + b, 0), done: m.st.committedN / UNEVEN.secs };
    lag.forEach((x, i) => { out["l" + i] = x; });
    return out;
  });
  return { three: run(3), four: run(4), six: run(6) };
}

// 2. Three workers keeping up with 6 records a second; a fourth joins at 30 s. Eager vs cooperative.
export const JOIN = { at: 30, window: 30 };
export function joinRun() {
  const run = (protocol) => avg((seed) => {
    const m = makeGroup({ rate: 6, workers: 3, protocol }, seed);
    m.runTo(JOIN.at);
    m.mark();
    m.addWorker();
    m.runTo(JOIN.at + JOIN.window);
    const stops = m.longestStops();
    return { lanes: m.lanes.filter((l) => l.everStopped).length, laneSecs: m.st.laneSecs, longest: Math.max(...stops), busy: m.co.busySecs, rounds: m.co.rounds, maxWait: m.st.maxWait };
  });
  return { eager: run("eager"), coop: run("coop") };
}

// 3. The work gets 4× slower (a slow downstream): batches of 10 now take about 13 s. Poll limit 10 s vs 60 s.
export const STORM = { slow: 4, secs: 120 };
export function stormRun() {
  const run = (pollLimit) => avg((seed) => {
    const m = makeGroup({ rate: 6, workers: 3, slow: STORM.slow, pollLimit }, seed);
    m.runTo(2);
    const s0 = m.mark();
    m.runTo(STORM.secs);
    return { committed: m.st.committedN - s0.committed, duplicates: m.st.duplicates, rebalances: m.co.rebalances - s0.rebalances, kicks: m.st.kicks - s0.kicks, worked: m.st.worked, lag: m.lag() };
  });
  return { short: run(10), long: run(60) };
}

// 4. A deploy: four workers restarted one at a time, 20 s apart, each down 8 s. Dynamic members vs static ids.
export const DEPLOY = { at: 20, gap: 20, workers: 4, until: 110 };
export function deployRun() {
  const run = (members) => avg((seed) => {
    const m = makeGroup({ rate: 6, workers: DEPLOY.workers, members }, seed);
    m.runTo(DEPLOY.at);
    const r0 = m.mark().rebalances;
    m.rolling(DEPLOY.gap);
    m.runTo(DEPLOY.until);
    const stops = m.longestStops();
    return { rebalances: m.co.rebalances - r0, laneSecs: m.st.laneSecs, longest: Math.max(...stops), maxWait: m.st.maxWait, duplicates: m.st.duplicates };
  });
  return { dynamic: run("dynamic"), static: run("static") };
}

// 5. Worker 2 crashes at 20 s without a word (kill -9, a lost machine). Session timeout 45 s (Kafka's default) vs 10 s.
export const CRASH = { at: 20, slot: 1, until: 100 };
export function crashRun() {
  const run = (session) => avg((seed) => {
    const m = makeGroup({ rate: 6, workers: 3, session }, seed);
    m.runTo(CRASH.at);
    m.mark();
    const mine = m.lanes.filter((l) => l.owner === CRASH.slot).map((l) => l.i);
    m.crash(CRASH.slot);
    let peak = 0;
    for (let s = CRASH.at; s <= CRASH.until; s += 0.5) { m.runTo(s); peak = Math.max(peak, mine.reduce((a, i) => a + m.lanes[i].end - m.lanes[i].committed, 0)); }
    const stops = m.longestStops();
    return { unread: Math.max(...mine.map((i) => stops[i])), peak, maxWait: m.st.maxWait, duplicates: m.st.duplicates, others: Math.max(0, ...stops.filter((_, i) => !mine.includes(i))) };
  });
  return { long: run(45), short: run(10) };
}

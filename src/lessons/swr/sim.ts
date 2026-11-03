// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// A client data cache with stale-while-revalidate, in the browser tab of one user. Event-driven and seeded, shared by
// the live figure and the experiments. Times are seconds.
//
// The server holds four resources (todos, stats, user 1, user 2), each with a version number that goes up when
// someone else edits it (or when this user saves an edit). The app shows components ("tiles") on the screen; each
// tile wants one resource and reads it through a query key. The cache keeps one entry per key:
//   data        { res, v }: which resource and version it holds (null until the first answer)
//   updatedAt   when that data arrived; it is stale once now - updatedAt >= staleTime, or after an invalidation
//   fetch       the request in flight for this key, if any; another fetch for the key joins it (deduplication)
//   observers   the tiles that use the key; with none left, the entry is dropped gcTime later
// The rules follow TanStack Query v5's defaults: cached data shows at once; stale data is refetched in the background
// when a tile using it mounts, when the window regains focus and when the network comes back; nothing else refetches.
//
// cfg:
//   staleTime   seconds data counts as fresh (0: stale as soon as it arrives)
//   gcTime      seconds an unused entry is kept
//   shared      true: one cache shared by all tiles; false: every tile fetches for itself on mount (fetch in useEffect)
//   keyBug      the user tiles use the key ["user"] (the id is missing) instead of ["user", id]
//   invalidate  after a save, mark the entries for that resource stale and refetch the ones in use
//   header      a header avatar (user 1) stays mounted on every page
//   editEvery   mean seconds between other people's edits, per resource (Poisson)
//   script      [[t, action, arg], ...]: goto page · leave · back · offline · online · edit res
//   auto        a simulated user browses the app (the live figure): pages, leaving the tab, saving edits

import { rng } from "../../lib/random";
import { averageOver } from "../../lib/stats";
import { minHeap } from "../../lib/events";

export const RES = ["todos", "stats", "user1", "user2"];
export const SLOTS = 10;
// Pages: the tiles each one mounts (after the header avatar, when there is one). The feed mounts ten avatars one
// after another as the list renders, `stagger` seconds apart.
export const PAGES = {
  todos: { path: "/todos", tiles: ["todos", "todos", "stats"] },
  user1: { path: "/users/1", tiles: ["user1", "user1"] },
  user2: { path: "/users/2", tiles: ["user2", "user2"] },
  feed: { path: "/feed", tiles: Array(SLOTS).fill("user1"), stagger: 0.3 },
};
export const HEADER = "user1";
export const DEFAULTS = { staleTime: 0, gcTime: 300, shared: true, keyBug: false, invalidate: true, header: true, editEvery: 20, script: [], auto: false };
export const LATENCY = { min: 0.35, mean: 0.45, max: 3 };   // a round trip: 0.35 s + exponential (mean 0.45 s), at most 3 s

export const keyOf = (res, keyBug) => (res.startsWith("user") ? (keyBug ? "user" : "user," + res.slice(4)) : res);

export function makeApp(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const latR = rng(seed * 7919 + 13), editR = rng(seed * 104729 + 7), userR = rng(seed * 31 + 3);
  let t = 0, seq = 0, nextUid = 1, nextReq = 1;
  const server = Object.fromEntries(RES.map((r) => [r, 1]));
  const entries = new Map();                // key -> entry
  const tiles = new Array(SLOTS).fill(null);  // slot -> { uid, res, key, slot, mountedAt }
  const flights = [];                       // requests on the wire: { id, kind, key, res, t0, tServer, tDone, v, cancelled }
  const paused = [];                        // requests waiting for the network
  const log = [];                           // for the live readout: { t, type, ... }
  const st = { requests: 0, saves: 0, mounts: 0, spinners: 0, joined: 0, gcs: 0, time: { loading: 0, wrong: 0, old: 0, current: 0 } };
  const q = minHeap((a, b) => a.t < b.t || (a.t === b.t && a.seq < b.seq));
  const at = (time, type, arg) => q.push({ t: time, seq: seq++, type, arg });
  let page = null, focused = true, online = true, gotoToken = 0;

  const latency = () => Math.min(LATENCY.max, LATENCY.min - Math.log(1 - latR()) * LATENCY.mean);
  const isStale = (e) => !e.data || e.invalid || t - e.updatedAt >= cfg.staleTime;

  // ---------- requests ----------
  function send(kind, key, res) {
    const lat = latency();
    const r = { id: nextReq++, kind, key, res, t0: t, lat, tServer: t + lat / 2, tDone: t + lat, v: null, cancelled: false };
    if (kind === "fetch") st.requests++; else st.saves++;
    if (!online) { r.paused = true; paused.push(r); return r; }
    launch(r);
    return r;
  }
  function launch(r) {
    r.paused = false; r.t0 = t; r.tServer = t + r.lat / 2; r.tDone = t + r.lat;
    flights.push(r);
    at(r.tServer, "server", r);
    at(r.tDone, "done", r);
  }
  function fetchEntry(e, res, why, cancel = false) {
    if (e.fetch && !cancel) { st.joined++; return false; }
    if (e.fetch) e.fetch.cancelled = true;
    e.fetch = send("fetch", e.key, res);
    log.push({ t, type: "fetch", key: e.key, res, why, background: !!e.data });
    return true;
  }

  // ---------- tiles ----------
  function entryOf(key) {
    let e = entries.get(key);
    if (!e) { e = { key, data: null, updatedAt: -Infinity, fetch: null, observers: new Set(), gcAt: null, invalid: false, lastRes: null }; entries.set(key, e); }
    return e;
  }
  function mount(slot, res) {
    const uid = nextUid++;
    const key = cfg.shared ? keyOf(res, cfg.keyBug) : res + "#" + uid;
    const tile = { uid, res, key, slot, mountedAt: t };
    tiles[slot] = tile;
    const e = entryOf(key);
    e.observers.add(tile); e.gcAt = null; e.lastRes = res;
    st.mounts++;
    if (!e.data) {
      st.spinners++;
      const sent = fetchEntry(e, res, "mount");
      if (!sent) log.push({ t, type: "join", key, res, slot });
    } else if (isStale(e)) fetchEntry(e, res, "mount");
    else log.push({ t, type: "fresh", key, res, slot });
  }
  function unmount(slot) {
    const tile = tiles[slot];
    if (!tile) return;
    tiles[slot] = null;
    const e = entries.get(tile.key);
    if (!e) return;
    e.observers.delete(tile);
    if (e.observers.size) return;
    if (!cfg.shared) { if (e.fetch) e.fetch.cancelled = true; entries.delete(e.key); return; }
    scheduleGc(e);
  }
  function scheduleGc(e) {
    if (e.fetch) return;                      // a fetch in flight keeps it; gc is scheduled again when it lands
    e.gcAt = t + cfg.gcTime;
    at(e.gcAt, "gc", e);
  }

  function goto(name) {
    const p = PAGES[name];
    const first = cfg.header && name !== "feed" ? 1 : 0;
    // the header avatar stays mounted across pages; everything else is replaced
    for (let s = 0; s < SLOTS; s++) if (!(first && s === 0 && tiles[0] && tiles[0].res === HEADER)) unmount(s);
    if (first && !tiles[0]) mount(0, HEADER);
    page = name;
    const token = ++gotoToken;
    log.push({ t, type: "goto", page: name });
    p.tiles.forEach((res, i) => {
      if (p.stagger) at(t + i * p.stagger, "mount", { slot: first + i, res, token });
      else mount(first + i, res);
    });
  }

  // ---------- the tab and the network ----------
  function refetchActive(why) {
    for (const e of entries.values()) if (e.observers.size && isStale(e)) fetchEntry(e, e.lastRes, why);
  }
  function leave() { if (!focused) return false; focused = false; log.push({ t, type: "leave" }); return true; }
  function back() { if (focused) return false; focused = true; log.push({ t, type: "back" }); if (cfg.shared) refetchActive("focus"); return true; }
  function offline() { if (!online) return false; online = false; log.push({ t, type: "offline" }); return true; }
  function reconnect() {
    if (online) return false;
    online = true; log.push({ t, type: "online", waiting: paused.length });
    for (const r of paused.splice(0)) if (!r.cancelled) launch(r);
    if (cfg.shared) refetchActive("reconnect");
    return true;
  }
  function edit(res) { const r = send("save", keyOf(res, cfg.keyBug), res); log.push({ t, type: "save", res }); return r; }

  // ---------- what each tile shows ----------
  function show(tile) {
    const e = entries.get(tile.key);
    if (!e || !e.data) return { state: "loading" };
    if (e.data.res !== tile.res) return { state: "wrong", res: e.data.res, v: e.data.v };
    return { state: e.data.v < server[tile.res] ? "old" : "current", res: e.data.res, v: e.data.v };
  }
  function account(dt) {
    if (dt <= 0) return;
    for (const tile of tiles) if (tile) st.time[show(tile).state] += dt;
  }

  // ---------- events ----------
  function handle(ev) {
    const { type, arg } = ev;
    if (type === "others") {
      server[arg]++;
      log.push({ t, type: "others", res: arg, v: server[arg] });
      at(t - Math.log(1 - editR()) * cfg.editEvery, "others", arg);
    } else if (type === "server") {
      const r = arg;
      if (r.kind === "save") { server[r.res]++; r.mine = server[r.res]; }
      r.v = server[r.res];
    } else if (type === "done") {
      const r = arg;
      flights.splice(flights.indexOf(r), 1);
      if (r.kind === "save") {
        log.push({ t, type: "saved", res: r.res, v: r.mine });
        if (cfg.invalidate && cfg.shared) {
          for (const e of entries.values()) if (e.data && e.data.res === r.res || e.key === keyOf(r.res, cfg.keyBug)) {
            e.invalid = true;
            if (e.observers.size) fetchEntry(e, e.lastRes, "invalidate", true);
          }
        }
        return;
      }
      if (r.cancelled) return;
      const e = entries.get(r.key);
      if (!e || e.fetch !== r) return;
      const was = e.data;
      e.data = { res: r.res, v: r.v }; e.updatedAt = t; e.fetch = null; e.invalid = false;
      log.push({ t, type: "answer", key: r.key, res: r.res, v: r.v, was, users: e.observers.size });
      if (!e.observers.size) scheduleGc(e);
    } else if (type === "gc") {
      const e = arg;
      if (entries.get(e.key) === e && !e.observers.size && !e.fetch && e.gcAt === t) {
        entries.delete(e.key); st.gcs++;
        log.push({ t, type: "gc", key: e.key, data: e.data });
      }
    } else if (type === "mount") {
      if (arg.token === gotoToken) mount(arg.slot, arg.res);
    } else if (type === "user") {
      const [, action, a] = arg;
      if (action === "goto") goto(a);
      else if (action === "leave") leave();
      else if (action === "back") back();
      else if (action === "offline") offline();
      else if (action === "online") reconnect();
      else if (action === "edit") edit(a);
    } else if (type === "auto") autoStep(arg);
  }

  // ---------- the simulated user (live figure) ----------
  const CYCLE = ["todos", "user1", "todos", "user2"];
  let cycleAt = 0, awayUntil = -1;
  const between = (a, b) => a + (b - a) * userR();
  function autoStep(what) {
    if (what === "nav") {
      if (!focused) { at(Math.max(t, awayUntil) + between(3, 6), "auto", "nav"); return; }
      cycleAt = (cycleAt + 1) % CYCLE.length;
      goto(CYCLE[cycleAt]);
      const dwell = between(6, 11);
      at(t + dwell, "auto", "nav");
      if (CYCLE[cycleAt] === "todos" && userR() < 0.4) at(t + between(1.5, dwell - 2), "auto", "edit");
    } else if (what === "edit") {
      if (page === "todos" && focused) edit("todos");
    } else if (what === "leave") {
      if (leave()) { awayUntil = t + between(14, 26); at(awayUntil, "auto", "back"); }
      at(t + between(45, 75), "auto", "leave");
    } else if (what === "back") back();
  }

  // ---------- running ----------
  function runTo(until) {
    for (let guard = 0; guard < 1e6; guard++) {
      const ev = q.peek();
      if (!ev || ev.t > until) break;
      q.pop();
      account(ev.t - t);
      t = ev.t;
      handle(ev);
    }
    account(until - t);
    t = until;
  }

  // start: other people's edits, the script, the simulated user
  for (const r of RES) at(-Math.log(1 - editR()) * cfg.editEvery, "others", r);
  for (const s of cfg.script) at(s[0], "user", s);
  if (cfg.auto) { goto(CYCLE[0]); at(between(6, 11), "auto", "nav"); at(between(30, 50), "auto", "leave"); }

  // Live actions: the visitor's buttons. Each runs the model to `now` first.
  const live = {
    leave(now, secs) { runTo(now); if (!leave()) return false; awayUntil = now + secs; at(now + secs, "user", [now + secs, "back"]); return true; },
    offline(now, secs) { runTo(now); if (!offline()) return false; at(now + secs, "user", [now + secs, "online"]); return true; },
    edit(now, res = "todos") { runTo(now); return edit(res); },
  };

  return {
    cfg, server, entries, tiles, flights, paused, log, st, runTo, show, isStale, live,
    get t() { return t; },
    get page() { return page; },
    get focused() { return focused; },
    get online() { return online; },
  };
}

// ---------- measuring runs ----------
const SEEDS = [11, 23, 37, 41, 59, 67, 73, 89];
const avg = (fn) => averageOver(SEEDS, fn);
const STEP = 0.01;
const tilesNow = (m) => m.tiles.filter(Boolean);

// The share of tile-time each state took between from and to.
function shares(m, from, to) {
  m.runTo(from);
  const a = { ...m.st.time };
  m.runTo(to);
  const total = Object.keys(a).reduce((s, k) => s + m.st.time[k] - a[k], 0) || 1;
  return Object.fromEntries(Object.keys(a).map((k) => [k, (m.st.time[k] - a[k]) / total]));
}
// Seconds after `from` until every tile in `pick` shows `ok`, stepping the model; `cap` if it never does.
function until(m, from, cap, pick, ok) {
  for (let x = from; x <= from + cap + 1e-9; x += STEP) {
    m.runTo(x);
    if (tilesNow(m).filter(pick).every((tile) => ok(tile, m.show(tile)))) return x - from;
  }
  return cap;
}

// 1. Away from the tab for a minute while others edit; back. staleTime 0 vs 5 min (refetch on focus is on).
export const AWAY = { at: 10, secs: 60, watch: 60 };
export function awayRun() {
  const run = (staleTime) => avg((seed) => {
    const back = AWAY.at + AWAY.secs;
    const m = makeApp({ staleTime, script: [[0, "goto", "todos"], [AWAY.at, "leave"], [back, "back"]] }, seed);
    m.runTo(back - 1e-6);
    const target = Object.fromEntries(tilesNow(m).map((tile) => [tile.uid, m.server[tile.res]]));
    const behind = tilesNow(m).reduce((s, tile) => s + (m.server[tile.res] - m.show(tile).v), 0) / tilesNow(m).length;
    const sent = m.st.requests;
    m.runTo(back);
    const requests = m.st.requests - sent;
    const catchUp = until(m, back, AWAY.watch, () => true, (tile, s) => s.v >= target[tile.uid]);
    return { behind, catchUp, requests, caught: catchUp < AWAY.watch ? 1 : 0 };
  });
  return { zero: run(0), five: run(300) };
}

// 2. Ten avatars of the same user mount one after another as a list renders.
export function dedupeRun() {
  const run = (cfg) => avg((seed) => {
    const m = makeApp({ header: false, ...cfg, script: [[0, "goto", "feed"]] }, seed);
    m.runTo(10);
    return { requests: m.st.requests, spinners: m.st.spinners };
  });
  return { own: run({ shared: false }), zero: run({ staleTime: 0 }), thirty: run({ staleTime: 30 }) };
}

// 3. Leave the list for 20 s and come back. staleTime 30 s; gcTime 10 s vs 5 min.
export const GC = { leave: 8, back: 28 };
export function gcRun() {
  const run = (gcTime) => avg((seed) => {
    const m = makeApp({ staleTime: 30, gcTime, script: [[0, "goto", "todos"], [GC.leave, "goto", "user1"], [GC.back, "goto", "todos"]] }, seed);
    m.runTo(GC.back - 1e-6);
    const sent = m.st.requests;
    const spin = until(m, GC.back, 10, (tile) => tile.res !== "user1", (tile, s) => s.state !== "loading");
    m.runTo(GC.back + 5);
    return { spinner: spin, requests: m.st.requests - sent, gcs: m.st.gcs };
  });
  return { short: run(10), long: run(300) };
}

// 4. Flip between the profiles of user 1 and user 2 every 3 to 6 s for a minute, the header avatar (user 1) on top.
export const FLIP = { secs: 60, dwell: [3, 6] };
export function keyRun() {
  const run = (keyBug, staleTime) => avg((seed) => {
    const r = rng(seed * 977 + 1), script = [[0, "goto", "user1"]];
    for (let x = 0, n = 1; x < FLIP.secs; n++) { x += FLIP.dwell[0] + (FLIP.dwell[1] - FLIP.dwell[0]) * r(); script.push([x, "goto", n % 2 ? "user2" : "user1"]); }
    const m = makeApp({ keyBug, staleTime, script }, seed);
    const prof = { wrong: 0, all: 0 }, head = { wrong: 0, all: 0 };
    for (let x = STEP; x <= FLIP.secs; x += STEP) {
      m.runTo(x);
      for (const tile of tilesNow(m)) {
        const c = tile.slot === 0 ? head : prof, s = m.show(tile);
        c.all++; if (s.state === "wrong") c.wrong++;
      }
    }
    return { profile: prof.wrong / prof.all, header: head.wrong / head.all, requests: m.st.requests };
  });
  return { fixed: run(false, 30), bug: run(true, 30), bugZero: run(true, 0) };
}

// 5. Save an edit to a todo at 5 s; the user switches to another tab at 20 s and comes back at 40 s. staleTime 30 s.
export const SAVE = { at: 5, leave: 20, back: 40, watch: 60 };
export function saveRun() {
  const run = (invalidate, staleTime) => avg((seed) => {
    const m = makeApp({ staleTime, invalidate, script: [[0, "goto", "todos"], [SAVE.at, "edit", "todos"], [SAVE.leave, "leave"], [SAVE.back, "back"]] }, seed);
    m.runTo(SAVE.at);
    let mine = null;
    const seen = until(m, SAVE.at, SAVE.watch, (tile) => tile.res === "todos", (tile, s) => {
      if (mine === null) { const saved = m.log.find((e) => e.type === "saved"); if (saved) mine = saved.v; }
      return mine !== null && s.v >= mine;
    });
    return { seen };
  });
  return { none: run(false, 30), inval: run(true, 30), noneZero: run(false, 0) };
}

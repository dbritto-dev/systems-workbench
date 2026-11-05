// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// A service with 15 request workers (threads) and three endpoints, each calling its own dependency:
// search → the search engine, checkout → payments, profile → the profile store. Event-driven and seeded, shared by
// the live figure and the experiments. Times are seconds; the numbers are illustrative and round.
//
// A request takes a free worker (or waits at the door, 8 places, and gives up after the 3 s deadline), then needs a
// place in its dependency's compartment to make the call: the bulkhead is a cap on calls in flight per dependency.
// The worker is held for the whole call, as in a thread-per-request server.
//
// cfg:
//   search   "healthy"  every call takes TIMES[0] (each 0.5..1.5 × the mean)
//            "slow"     every search call takes SLOW × as long
//            "hang"     half the search calls (the ones that reach the bad replica of two) hang HANG s, then answer
//   pool     "shared"   no compartments: any request may use any worker
//            "split"    5 places per dependency: the compartments add up to the 15 workers
//            "caps"     8 places per dependency: caps that add up to more than the pool, so a busy one can borrow
//   full     "reject"   a request that finds its compartment full is turned away at once (its worker is free again)
//            "queue"    it queues for a place, keeping its worker while it waits
//   timeout  seconds after which a search call is cut off (0: none)
//   rush     multiplier on checkout traffic (1: normal, 4: a rush)

import { rng } from "../../lib/random";
import { averageOver } from "../../lib/stats";
import { minHeap } from "../../lib/events";

export const KINDS = 3;                       // 0 search, 1 checkout, 2 profile
export const WORKERS = 15;
export const AREA = 5;                        // berths drawn per compartment (the figure: 3 × 5 = the 15 workers)
export const RATES = [2, 1, 2];               // requests per second
export const TIMES = [0.6, 1, 0.4];           // mean seconds per call when healthy
export const DEADLINE = 3;                    // the caller gives up after this
export const HANG = 30;                       // a call to the bad replica hangs this long
export const SLOW = 3;
export const DOOR = 6;                        // places to wait for a worker
export const CAPS = { shared: Infinity, split: 5, caps: 8 };
export const DEFAULTS = { search: "hang", pool: "split", full: "reject", timeout: 0, rush: 1 };

export function makeHold(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const random = rng(seed);
  const expo = (rate) => -Math.log(1 - random()) / rate;
  const cap = CAPS[cfg.pool];
  let t = 0, nextId = 1, seq = 0;
  const workers = Array.from({ length: WORKERS }, (_, i) => ({ i, req: null }));
  const inFlight = [0, 0, 0];
  const queues = [[], [], []];                // requests queued for a place, each on a worker
  const door = [];                            // requests waiting for a worker
  const resolved = [];                        // { t, kind, outcome } (the live code keeps the last 30 s)
  const log = [];                             // what the live figure narrates
  const st = { arrived: [0, 0, 0], busyArea: 0, time: 0 };
  const all = [];                             // every request, when cfg.keep (the experiments)
  const heap = minHeap((a, b) => a.t < b.t || (a.t === b.t && a.seq < b.seq));
  const push = (e) => { e.seq = seq++; heap.push(e); };
  const rateOf = (k) => RATES[k] * (k === 1 ? cfg.rush : 1);
  for (let k = 0; k < KINDS; k++) push({ t: expo(rateOf(k)), type: "arrive", kind: k });

  const areaOf = (w) => Math.floor(w.i / AREA);
  // Outcomes: ok (answered within the deadline), late (answered after it), timeout (cut off), turned (compartment
  // full), door (no place to wait for a worker), gaveup (waited at the door past the deadline).
  function resolve(r, outcome) {
    r.outcome = outcome; r.doneAt = t;
    resolved.push({ t, id: r.id, kind: r.kind, outcome, born: r.born });   // the live code trims it
    if (outcome === "turned" || outcome === "door") log.push({ t, type: outcome, kind: r.kind, id: r.id });
  }

  // Which worker a request sits on doesn't change any outcome (the workers are identical), so the model keeps each
  // kind's calls on its own compartment's berths when it can: the figure then shows a compartment's calls inside it,
  // and anything else (calls past a compartment's five, queued requests) on the berths left over.
  function own(r, w) { return areaOf(w) === r.kind && r.state === "call"; }
  function seat(r, w) {
    if (areaOf(w) !== r.kind) {
      const v = workers.find((x) => areaOf(x) === r.kind && x.req && !own(x.req, x));
      if (v) { const o = v.req; o.worker = w; w.req = o; r.worker = v; v.req = r; return; }
    }
    r.worker = w; w.req = r;
  }
  const freeIn = (k) => workers.find((w) => !w.req && areaOf(w) === k) || workers.find((w) => !w.req);

  function callTime(k) {
    let d = TIMES[k] * (0.5 + random()), hung = false;
    if (k === 0 && cfg.search === "slow") d *= SLOW;
    if (k === 0 && cfg.search === "hang" && random() < 0.5) { d = HANG * (0.95 + 0.1 * random()); hung = true; }
    return { d, hung };
  }
  function startCall(r) {
    r.state = "call"; r.start = t;
    inFlight[r.kind]++;
    const { d, hung } = callTime(r.kind);
    r.hung = hung;
    const cut = r.kind === 0 && cfg.timeout > 0 && d > cfg.timeout;
    r.end = t + (cut ? cfg.timeout : d); r.cut = cut;
    // the seat may have been chosen while the request was queued: move the call onto its own compartment if a berth is free
    if (areaOf(r.worker) !== r.kind) {
      const f = workers.find((w) => !w.req && areaOf(w) === r.kind);
      if (f) { r.worker.req = null; r.worker = f; f.req = r; }
    }
    push({ t: r.end, type: "end", req: r });
  }
  function admit(r) {
    if (inFlight[r.kind] < cap) return startCall(r);
    if (cfg.full === "reject") { const w = r.worker; w.req = null; r.worker = null; resolve(r, "turned"); return pull(w); }
    r.state = "queued"; r.queuedAt = t;
    queues[r.kind].push(r);
    log.push({ t, type: "queued", kind: r.kind, id: r.id });
  }
  // A worker just came free: it takes the next request waiting at the door.
  function pull(w) {
    while (!w.req && door.length) {
      const r = door.shift();
      if (r.outcome) continue;
      r.state = "seated";
      seat(r, w);
      admit(r);
    }
  }
  function arrive(k) {
    const r = { id: nextId++, kind: k, born: t, state: "door", worker: null };
    st.arrived[k]++;
    if (cfg.keep) all.push(r);
    const w = freeIn(k);
    if (w) { r.state = "seated"; seat(r, w); admit(r); return; }
    if (door.length < DOOR) { door.push(r); push({ t: t + DEADLINE, type: "giveup", req: r }); return; }
    resolve(r, "door");
  }
  function end(r) {
    inFlight[r.kind]--;
    const answered = !r.cut;
    resolve(r, !answered ? "timeout" : t - r.born <= DEADLINE + 1e-9 ? "ok" : "late");
    const w = r.worker;
    w.req = null; r.worker = null;
    const q = queues[r.kind].shift();
    if (q) {
      // the queued request takes the place; its call runs on this berth, and the worker it held is free again
      const old = q.worker; old.req = null;
      q.worker = w; w.req = q;
      startCall(q);
      return pull(old);
    }
    pull(w);
  }

  function runTo(until) {
    for (;;) {
      const e = heap.peek();
      if (!e || e.t > until) break;
      heap.pop();
      const busy = workers.reduce((a, w) => a + (w.req ? 1 : 0), 0);
      st.busyArea += busy * (e.t - t); st.time += e.t - t;
      t = e.t;
      if (e.type === "arrive") { arrive(e.kind); push({ t: t + expo(rateOf(e.kind)), type: "arrive", kind: e.kind }); }
      else if (e.type === "end") end(e.req);
      else if (e.type === "giveup") {
        const r = e.req;
        if (r.state === "door" && !r.outcome) { door.splice(door.indexOf(r), 1); resolve(r, "gaveup"); }
      }
    }
    const busy = workers.reduce((a, w) => a + (w.req ? 1 : 0), 0);
    st.busyArea += busy * (until - t); st.time += until - t;
    t = until;
  }

  return {
    cfg, cap, workers, inFlight, queues, door, resolved, log, st, all, runTo,
    get t() { return t; },
    busy: () => workers.filter((w) => w.req).length,
  };
}

// ---------- experiments: headless runs, averaged over seeds ----------
const SEEDS = [11, 23, 37, 41, 59, 67, 73, 89];
export const FROM = 30, TO = 150;             // measure two minutes, after a 30 s warm-up

// Shares of the requests that arrived in the window, per kind: answered in time, and turned away (compartment full,
// no place at the door, or gave up waiting for a worker).
export function measure(cfg, seed) {
  const m = makeHold({ ...cfg, keep: true }, seed);
  const busy0 = () => m.st.busyArea;
  m.runTo(FROM);
  const area0 = busy0(), time0 = m.st.time;
  m.runTo(TO);
  const busyMean = (m.st.busyArea - area0) / (m.st.time - time0);
  m.runTo(TO + HANG + 5);
  const out = { busy: busyMean };
  for (let k = 0; k < KINDS; k++) {
    const rs = m.all.filter((r) => r.kind === k && r.born >= FROM && r.born < TO);   // anything unresolved: not answered
    const c = (o) => rs.filter((r) => r.outcome === o).length / Math.max(1, rs.length);
    out["ok" + k] = c("ok");
    out["turned" + k] = c("turned");
    out["away" + k] = c("turned") + c("door") + c("gaveup");
    out["late" + k] = c("late") + c("timeout");
  }
  return out;
}
const avg = (cfg) => averageOver(SEEDS, (seed) => measure(cfg, seed));

// 1. Half of search's calls hang: one shared pool vs a compartment per dependency.
export const hangRun = () => ({ shared: avg({ search: "hang", pool: "shared" }), split: avg({ search: "hang", pool: "split" }), healthy: avg({ search: "healthy", pool: "split" }) });
// 2. Search three times slower, still inside the deadline: compartments of 5 vs one shared pool.
export const slowRun = () => ({ split: avg({ search: "slow", pool: "split" }), shared: avg({ search: "slow", pool: "shared" }), healthy: avg({ search: "healthy", pool: "split" }) });
// 3. Half of search's calls hang, compartments of 5: turn away at once vs queue for a place.
export const queueRun = () => ({ reject: avg({ search: "hang", pool: "split", full: "reject" }), queue: avg({ search: "hang", pool: "split", full: "queue" }), shared: avg({ search: "hang", pool: "shared" }) });
// 4. Checkout traffic ×4, search healthy: one shared pool vs compartments of 5 (and caps of 8, in a rush and in a hang).
export const rushRun = () => ({
  shared: avg({ search: "healthy", pool: "shared", rush: 4 }), split: avg({ search: "healthy", pool: "split", rush: 4 }),
  caps: avg({ search: "healthy", pool: "caps", rush: 4 }), capsHang: avg({ search: "hang", pool: "caps" }),
});
// 5. Half of search's calls hang, compartments of 5: no timeout vs a 1 s timeout on search calls.
export const timeoutRun = () => ({ none: avg({ search: "hang", pool: "split" }), cut: avg({ search: "hang", pool: "split", timeout: 1 }) });

// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// GitOps reconcile: git holds the desired state, the cluster runs the live state, and a reconciler (an Argo CD-style
// application controller) makes the second match the first. Seeded and stepped (0.25 s), shared by the live figure
// and the experiments.
//
// What the model holds:
//   git         commits, each a full desired state: web { image, replicas | null }, config limit, worker present
//   reconciler  the revision it last read from git (it reads on a timer, 120 s + up to 60 s of jitter, or when a
//               webhook arrives); it compares that desired state with the live state continuously (it watches the
//               cluster) and syncs:
//                 · automatically once per new revision it reads (automated sync),
//                 · when the live state drifts, only with self-heal on: the first time right away, then with an
//                   exponential backoff between repeated self-heals (2 s, ×3 each time, up to 300 s; it resets once
//                   the app has stayed in sync for 330 s or a new revision is synced),
//                 · when someone presses Sync.
//               A sync walks to every resource that differs and applies git's value; with prune on it also deletes
//               a resource git no longer has. With prune off such a resource is left running and the app stays
//               OutOfSync, but that alone doesn't trigger a sync.
//   cluster     a Deployment (web) with pods that take `startup` seconds to get ready and roll with maxSurge 25%
//               (rounded up) and maxUnavailable 25% (rounded down); a config value; an old worker that runs a job
//               every 10 s while it exists; and an HPA that every 15 s sets web's replicas to keep pods near 70%
//               busy (10% tolerance, scale-down stabilised over 300 s, 2 to 6 pods).
//   traffic     requests per second; each ready pod serves 10. What the ready pods can't serve fails, and so does
//               1 request in 5 served by a bad build.
// Times are illustrative and round, except the Argo CD and HPA defaults named above.

import { xorshift32 } from "../../lib/random";
import { averageOver, mean } from "../../lib/stats";

export const DT = 0.25;
export const POLL = { base: 120, jitter: 60 };   // Argo CD's default: timeout.reconciliation 120 s + 60 s jitter
export const HOOK_DELAY = 1;                      // a git webhook reaching the reconciler
export const DETECT = 3;                          // the watch noticing a live change and re-comparing
export const HEAL = { first: 2, factor: 3, cap: 300, cooldown: 330 };
export const HPA = { period: 15, target: 0.7, tolerance: 0.1, down: 300, min: 2, max: 6 };
export const STARTUP = 10;                        // a pod's start until it's ready
export const CAP = 10;                            // requests per second one ready pod serves
export const LOAD = { normal: 20, high: 40 };
export const BAD_FAIL = 0.2;
export const JOB_EVERY = 10;
export const LIMIT = { git: 20, hotfix: 40 };
export const WALK = 40;                           // the reconciler's walking speed, units a second

// Where the reconciler stands in its aisle (x), shared with the figure: home in front of its desk, the git office,
// and the back of each resource it manages.
export const STOPS = { home: 0, git: -96, web: -80, config: -6, worker: 42 };
const RESOURCES = ["web", "config", "worker"];

export const DEFAULTS = { selfHeal: true, prune: true, poll: "poll", replicas: "hpa", traffic: "normal", auto: false, image: 7, badImages: [] as number[], prevImage: 6 };

export function makeSim(cfgIn = {}, seed = 1, script = []) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rnd = xorshift32(seed);
  const uni = (a, b) => a + (b - a) * rnd();
  let t = 0, podId = 0;
  const log = [];
  const st = { failed: 0, served: 0, syncs: 0, undone: 0, cuts: 0, started: 0, jobs: 0, orphanJobs: 0, outFor: 0 };
  const bad = new Set(cfg.badImages);

  // ---------- git ----------
  // Two commits to start with: the release before this one, and this one (so a revert has something to go back to).
  const spec0 = { image: cfg.image, replicas: cfg.replicas === "git" ? 3 : null, config: LIMIT.git, worker: true };
  const git = [{ rev: 40, at: -900, spec: { ...spec0, image: cfg.prevImage }, what: "start" }, { rev: 41, at: -300, spec: spec0, what: "start" }];
  const head = () => git[git.length - 1];
  function commit(change, what) {
    const spec = { ...head().spec, ...change };
    git.push({ rev: head().rev + 1, at: t, spec, what });
    if (cfg.poll === "hook") R.hookAt = Math.min(R.hookAt, t + HOOK_DELAY);
    log.push({ t, type: "commit", rev: head().rev, idx: git.length - 1, what, spec });
  }

  // ---------- the cluster ----------
  const live = { image: cfg.image, replicas: 3, config: LIMIT.git, worker: true, history: [cfg.prevImage, cfg.image] };
  const edited = new Set();          // fields a person changed by hand since git's value was last applied
  const pods = [];
  const startPod = (image, ready = false) => { pods.push({ id: ++podId, image, born: t, ready: ready ? t : t + STARTUP }); if (!ready) st.started++; };
  for (let i = 0; i < 3; i++) startPod(cfg.image, true);
  const isReady = (p) => t >= p.ready;
  function removePod(p) { pods.splice(pods.indexOf(p), 1); }
  // Prefer the unready, then the newest (what a ReplicaSet scale-down picks first).
  const victim = (list) => [...list].sort((a, b) => (isReady(a) - isReady(b)) || (b.born - a.born))[0];
  function deployment() {
    const want = live.replicas, img = live.image;
    const surge = Math.max(1, Math.ceil(want * 0.25)), unavail = Math.floor(want * 0.25);
    const cur = () => pods.filter((p) => p.image === img), old = () => pods.filter((p) => p.image !== img);
    if (!old().length) {
      while (pods.length < want) startPod(img);
      while (pods.length > want) removePod(victim(pods));
      return;
    }
    // a rollout: old pods still starting go at once; new pods start up to the surge limit; a ready old pod goes
    // whenever enough pods stay ready without it
    for (const p of old()) if (!isReady(p)) removePod(p);
    while (cur().length > want) removePod(victim(cur()));
    while (cur().length < want && pods.length < want + surge) startPod(img);
    for (const p of old()) { if (pods.filter(isReady).length - 1 >= want - unavail) removePod(p); else break; }
  }

  // ---------- the HPA ----------
  let load = LOAD[cfg.traffic];
  const H = { next: uni(0, HPA.period), recs: [], wants: 3 };
  function hpa() {
    if (t < H.next) return;
    H.next += HPA.period;
    const current = live.replicas;
    let want = Math.max(HPA.min, Math.min(HPA.max, Math.ceil(load / (CAP * HPA.target))));
    if (Math.abs(want / current - 1) <= HPA.tolerance) want = current;
    H.recs.push([t, want]);
    while (H.recs.length && H.recs[0][0] < t - HPA.down) H.recs.shift();
    if (want < current) want = Math.max(...H.recs.map(([, w]) => w));   // scale-down stabilisation: the highest recent wish
    H.wants = want;
    if (want !== current) { live.replicas = want; edited.add("replicas"); log.push({ t, type: "hpa", from: current, to: want }); }
  }

  // ---------- the reconciler ----------
  const R = { has: 1, synced: 1, nextCheck: uni(0, POLL.base + POLL.jitter), hookAt: Infinity, task: null, heal: 0, lastOpEnd: -Infinity, inSyncSince: 0, driftAt: null, manual: false, readAt: [-900, -300], waitLogged: false };
  const desired = () => git[R.has].spec;
  function diff() {
    const d = desired(), out = [];
    if (live.image !== d.image || (d.replicas !== null && live.replicas !== d.replicas)) out.push("web");
    if (live.config !== d.config) out.push("config");
    if (d.worker && !live.worker) out.push("worker");
    if (!d.worker && live.worker) out.push("prune");
    return out;
  }
  const pathLen = (pts) => pts.slice(1).reduce((a, x, i) => a + Math.abs(x - pts[i]), 0);
  function startFetch(why) {
    const legs = Math.abs(STOPS.git - STOPS.home) / WALK;
    R.task = { kind: "fetch", why, start: t, mid: t + legs, end: t + 2 * legs, read: false };
    R.nextCheck = t + POLL.base + uni(0, POLL.jitter);
    if (why === "hook") R.hookAt = Infinity;
    log.push({ t, type: "fetch", why });
  }
  function startSync(targets, why) {
    const names = targets.map((n) => (n === "prune" ? "worker" : n));
    const xs = [...new Set(names)].map((n) => STOPS[n]).sort((a, b) => a - b);
    const pts = [STOPS.home, ...xs, STOPS.home];
    const stops = [];
    let along = 0;
    for (let i = 1; i < pts.length - 1; i++) { along += Math.abs(pts[i] - pts[i - 1]); stops.push({ x: pts[i], at: t + along / WALK, done: false }); }
    R.task = { kind: "sync", why, start: t, end: t + pathLen(pts) / WALK, pts, stops, rev: R.has, targets };
    if (why === "heal") R.heal++;
    if (why === "auto") { R.heal = 0; }
    R.manual = false; R.waitLogged = false;
    st.syncs++;
    log.push({ t, type: "sync", why, targets: [...targets], rev: git[R.has].rev });
  }
  // A sync reaching a resource: git's value goes back on it.
  function applyAt(x, task) {
    const d = git[task.rev].spec;
    if (x === STOPS.web) {
      const was = { image: live.image, replicas: live.replicas };
      if (live.image !== d.image) { live.image = d.image; live.history.push(d.image); }
      if (d.replicas !== null && live.replicas !== d.replicas) { if (d.replicas < live.replicas) st.cuts++; live.replicas = d.replicas; }
      if (was.image !== live.image || was.replicas !== live.replicas) {
        if (edited.has("image") || edited.has("replicas")) st.undone++;   // any sync that overwrites a live edit
        log.push({ t, type: "apply", what: "web", from: was, to: { image: live.image, replicas: live.replicas }, why: task.why });
      }
      edited.delete("image"); edited.delete("replicas");
    } else if (x === STOPS.config && live.config !== d.config) {
      if (edited.has("config")) { st.undone++; log.push({ t, type: "hotfixGone", from: live.config, to: d.config, why: task.why }); }
      else log.push({ t, type: "apply", what: "config", from: live.config, to: d.config, why: task.why });
      live.config = d.config; edited.delete("config");
    } else if (x === STOPS.worker) {
      if (!d.worker && live.worker && (cfg.prune || task.targets.includes("prune"))) { live.worker = false; log.push({ t, type: "pruned" }); }
      else if (d.worker && !live.worker) { live.worker = true; log.push({ t, type: "apply", what: "worker", why: task.why }); }
    }
  }
  function reconciler() {
    const k = R.task;
    if (k && k.kind === "fetch" && !k.read && t >= k.mid) {
      k.read = true;
      const before = R.has;
      R.has = git.length - 1;
      for (let i = before + 1; i <= R.has; i++) R.readAt[i] ??= t;
      log.push({ t, type: "read", rev: head().rev, fresh: R.has !== before });
    }
    if (k && k.kind === "sync") for (const s of k.stops) if (!s.done && t >= s.at) { s.done = true; applyAt(s.x, k); }
    if (k && t >= k.end) {
      if (k.kind === "sync") { R.lastOpEnd = t; R.synced = Math.max(R.synced, k.rev); }
      R.task = null;
      log.push({ t, type: k.kind === "sync" ? "home" : "back" });
    }
    const d = diff();
    if (d.length) st.outFor += DT;
    if (d.length) R.inSyncSince = null; else R.inSyncSince ??= t;
    if (R.inSyncSince !== null && t - R.inSyncSince >= HEAL.cooldown) R.heal = 0;
    if (R.task) return;
    if (t >= R.hookAt) return startFetch("hook");
    if (t >= R.nextCheck) return startFetch("poll");
    const act = d.filter((x) => x !== "prune" || cfg.prune);
    if (!act.length) {
      R.driftAt = null;
      if (R.manual) { R.manual = false; log.push({ t, type: "nothing" }); }
      if (R.has !== R.synced && !d.length) R.synced = R.has;
      return;
    }
    if (R.driftAt === null) R.driftAt = t;
    if (R.manual) return startSync(act, "manual");
    if (R.has !== R.synced) return startSync(act, "auto");
    if (!cfg.selfHeal || t - R.driftAt < DETECT) return;
    const wait = R.heal === 0 ? 0 : Math.min(HEAL.cap, HEAL.first * HEAL.factor ** (R.heal - 1));
    if (t >= R.lastOpEnd + wait) startSync(act, "heal");
    else if (!R.waitLogged) { R.waitLogged = true; log.push({ t, type: "backoff", until: R.lastOpEnd + wait }); }
  }

  // ---------- people and events ----------
  const actions = {
    release(o = {}) { const image = head().spec.image % 9 + 1; if (o.bad) bad.add(image); commit({ image }, "release"); },
    revert() { const prev = git.length > 1 ? git[git.length - 2].spec.image : head().spec.image; commit({ image: prev }, "revert"); },
    removeWorker() { commit({ worker: false }, "remove"); },
    setReplicas(o) { if (head().spec.replicas !== o.replicas) commit({ replicas: o.replicas }, "replicas"); },
    restoreWorker() { commit({ worker: true }, "restore"); },
    hotfix() { const v = live.config === LIMIT.hotfix ? LIMIT.git : LIMIT.hotfix; log.push({ t, type: "hotfix", from: live.config, to: v }); live.config = v; edited.add("config"); },
    undo() {
      const h = live.history, prev = h.length > 1 ? h[h.length - 2] : live.image;
      log.push({ t, type: "undo", from: live.image, to: prev });
      live.image = prev; h.push(prev); edited.add("image");
    },
    traffic(o) { load = LOAD[o.level]; log.push({ t, type: "traffic", level: o.level }); },
    sync() { R.manual = true; log.push({ t, type: "syncAsked" }); },
  };
  const queue = [...script].sort((a, b) => a.at - b.at);
  // Background life for the live machine: releases now and then, and an engineer who hotfixes the config.
  const auto = cfg.auto ? { release: uni(60, 150), hotfix: uni(25, 50) } : null;

  function traffic() {
    const ready = pods.filter(isReady);
    const capacity = ready.length * CAP;
    const served = Math.min(load, capacity);
    const badShare = ready.length ? ready.filter((p) => bad.has(p.image)).length / ready.length : 0;
    st.served += served * DT;
    st.failed += ((load - served) + served * badShare * BAD_FAIL) * DT;
  }
  function worker() {
    if (!live.worker) return;
    st.jobs += DT / JOB_EVERY;
    if (!head().spec.worker) st.orphanJobs += DT / JOB_EVERY;
  }

  function stepOnce() {
    while (queue.length && queue[0].at <= t + 1e-9) { const e = queue.shift(); actions[e.type](e); }
    if (auto) {
      if (t >= auto.release) { actions.release(); auto.release = t + uni(150, 330); }
      if (t >= auto.hotfix) { actions.hotfix(); auto.hotfix = t + uni(150, 300); }
    }
    hpa();
    deployment();
    traffic();
    worker();
    reconciler();
    t += DT;
  }
  function runTo(until) { while (t < until - 1e-9) stepOnce(); }

  return {
    cfg, git, live, pods, st, log, R, H, bad, actions, runTo, head, desired, diff,
    get t() { return t; },
    get load() { return load; },
    isReady,
    /** Where the reconciler is, as an x in its aisle, and whether it's carrying out a sync. */
    walker(now = t) {
      const k = R.task;
      if (!k) return { x: STOPS.home, syncing: false, fetching: false };
      if (k.kind === "fetch") {
        const u = Math.min(1, Math.max(0, (now - k.start) / (k.end - k.start)));
        const x = u < 0.5 ? STOPS.home + (STOPS.git - STOPS.home) * u * 2 : STOPS.git + (STOPS.home - STOPS.git) * (u - 0.5) * 2;
        return { x, syncing: false, fetching: true };
      }
      let left = Math.max(0, now - k.start) * WALK, x = k.pts[0];
      for (let i = 1; i < k.pts.length; i++) {
        const seg = Math.abs(k.pts[i] - k.pts[i - 1]);
        if (left <= seg) { x = k.pts[i - 1] + Math.sign(k.pts[i] - k.pts[i - 1]) * left; break; }
        left -= seg; x = k.pts[i];
      }
      return { x, syncing: true, fetching: false };
    },
  };
}

// ---------- experiments: headless runs averaged over seeds ----------
const SEEDS = [11, 23, 37, 41, 59, 67, 73, 89];
const avg = (fn) => averageOver(SEEDS, fn);

// 1. An engineer hotfixes the config in the cluster at 1 min; a teammate merges an unrelated release 10 minutes
//    later. How long does the hotfix last, with self-heal on and off?
export const HOTFIX = { at: 60, release: 660, until: 1500 };
export function hotfixRun() {
  const run = (selfHeal) => avg((seed) => {
    const m = makeSim({ selfHeal }, seed, [{ at: HOTFIX.at, type: "hotfix" }, { at: HOTFIX.release, type: "release" }]);
    m.runTo(HOTFIX.until);
    const gone = m.log.find((e) => e.type === "hotfixGone");
    return { life: gone ? gone.t - HOTFIX.at : HOTFIX.until - HOTFIX.at, out: m.st.outFor, bySync: gone && gone.why === "auto" ? 1 : 0, afterRelease: gone ? gone.t - HOTFIX.release : NaN };
  });
  return { on: run(true), off: run(false) };
}

// 2. Eight merges at random moments: time until the reconciler reads each one and until every pod runs it.
export const MERGES = { n: 8, gap: 420 };
export function pollRun() {
  const run = (poll) => {
    const reads = [], lives = [];
    for (const seed of SEEDS) {
      const r = xorshift32(seed * 7 + 1);
      const at = Array.from({ length: MERGES.n }, (_, i) => 90 + i * MERGES.gap + r() * 200);
      const m = makeSim({ poll }, seed, at.map((a) => ({ at: a, type: "release" })));
      const done = new Array(at.length).fill(null);
      for (let s = 0; s < at[at.length - 1] + 400; s += 1) {
        m.runTo(s);
        at.forEach((a, i) => {
          if (done[i] !== null || m.git.length < i + 3) return;
          const img = m.git[i + 2].spec.image;
          if (m.pods.length && m.pods.every((p) => p.image === img && m.isReady(p))) done[i] = m.t - a;
        });
      }
      at.forEach((a, i) => { reads.push(m.R.readAt[i + 2] - a); lives.push(done[i]); });
    }
    return { read: mean(reads), readMax: Math.max(...reads), live: mean(lives), liveMax: Math.max(...lives) };
  };
  return { poll: run("poll"), hook: run("hook") };
}

// 3. A 10-minute traffic spike (twice the normal load) with replicas: 3 in git vs left to the HPA. Self-heal on.
export const SPIKE = { from: 60, to: 660 };
export function hpaRun() {
  const run = (replicas) => avg((seed) => {
    const m = makeSim({ replicas }, seed, [{ at: SPIKE.from, type: "traffic", level: "high" }, { at: SPIKE.to, type: "traffic", level: "normal" }]);
    m.runTo(SPIKE.from);
    const f0 = m.st.failed, s0 = m.st.started;
    let atWish = 0, n = 0;
    for (let s = SPIKE.from; s < SPIKE.to; s += 1) { m.runTo(s + 1); n++; if (m.pods.filter(m.isReady).length >= m.H.wants) atWish++; }
    return { failed: m.st.failed - f0, cuts: m.st.cuts, started: m.st.started - s0, share: atWish / n };
  });
  return { git: run("git"), hpa: run("hpa") };
}

// 4. The old worker is removed from git at 1 min. Prune off vs on; self-heal on in both. Watched for 30 minutes.
export const PRUNE = { at: 60, until: 60 + 1800 };
export function pruneRun() {
  const run = (prune) => avg((seed) => {
    const m = makeSim({ prune }, seed, [{ at: PRUNE.at, type: "removeWorker" }]);
    m.runTo(PRUNE.until);
    const gone = m.log.find((e) => e.type === "pruned");
    return { running: m.live.worker ? 1 : 0, after: gone ? gone.t - PRUNE.at : PRUNE.until - PRUNE.at, jobs: m.st.orphanJobs, out: m.st.outFor };
  });
  return { off: run(false), on: run(true) };
}

// 5. Release 8 is live and fails 1 request in 5. At 30 s someone rolls back: kubectl rollout undo in the cluster,
//    or git revert. Self-heal on. Failed requests over the next 10 minutes.
export const ROLLBACK = { at: 30, span: 600 };
export function rollbackRun() {
  const run = (how) => avg((seed) => {
    const m = makeSim({ image: 8, prevImage: 7, badImages: [8] }, seed, [{ at: ROLLBACK.at, type: how }]);
    m.runTo(ROLLBACK.at);
    const f0 = m.st.failed;
    let fixedAt = null;
    for (let s = ROLLBACK.at; s < ROLLBACK.at + ROLLBACK.span; s += 1) {
      m.runTo(s + 1);
      const good = m.pods.length && m.pods.every((p) => p.image === 7 && m.isReady(p));
      if (good && fixedAt === null) fixedAt = m.t - ROLLBACK.at;
      if (!good) fixedAt = null;
    }
    const undoneIn = (() => { const u = m.log.find((e) => e.type === "apply" && e.what === "web" && e.why === "heal"); return u ? u.t - ROLLBACK.at : NaN; })();
    return { failed: m.st.failed - f0, fixed: fixedAt === null ? 0 : 1, fixedAt: fixedAt === null ? ROLLBACK.span : fixedAt, undoneIn, v7: m.live.image === 7 ? 1 : 0 };
  });
  return { undo: run("undo"), revert: run("revert") };
}

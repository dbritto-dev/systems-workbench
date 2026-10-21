// Shared model for the figure and the experiments: a grow-only counter kept by several nodes in a
// sequentially consistent key/value store (like Maelstrom's seq-kv). Times are seconds of figure time.
export const LATENCY = 0.25;       // one-way courier time between a branch and the register
export const JITTER = 0.08;        // ± on every trip
export const STALE_MAX = 0.6;      // a plain read may be served from a state up to this old (never older than what the node has already seen)
export const REFRESH = 1.0;        // each node re-reads the counter this often to answer its clients
export const NODE_NAMES = ["A", "B", "C"];

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// cfg: { approach: "shared" | "cas" | "g", nodes: 2 | 3, rate (adds/s per node), stopAt (no adds after), partitions: [[from, to]] cutting the last node,
//        script: [[t, node]] extra adds, background: false to use only the script, refresh: false to skip periodic reads }
export function makeSim(cfg, seed = 7) {
  const random = rng(seed);
  const n = cfg.nodes;
  const far = n - 1;
  const cuts = cfg.partitions || [];
  const queue = [];
  const push = (e) => { let i = queue.length; while (i > 0 && queue[i - 1].t > e.t) i--; queue.splice(i, 0, e); };
  const history = { counter: [[0, 0]] };
  for (let i = 0; i < n; i++) history["slot" + i] = [[0, 0]];
  const valueAt = (key, t) => { const h = history[key]; let v = 0; for (let i = 0; i < h.length && h[i][0] <= t; i++) v = h[i][1]; return v; };
  const current = (key) => history[key][history[key].length - 1][1];
  const nodes = Array.from({ length: n }, (_, i) => ({ i, local: 0, others: 0, view: 0, seen: 0, lastUp: 0, lastDown: 0 }));
  const sim = {
    cfg, nodes, history, now: 0, added: 0, applied: 0, completed: 0, retries: 0, messages: 0, addMessages: 0,
    log: [], trips: [], reads: [], stamps: [],
    total: () => sim.added,
    stored: () => (cfg.approach === "g" ? nodes.reduce((s, x) => s + current("slot" + x.i), 0) : current("counter")),
    lost: () => (cfg.approach === "shared" ? Math.max(0, sim.completed - current("counter")) : 0),
    cutAt: (t) => cuts.some(([a, b]) => t >= a && t < b),
  };
  const heal = (t) => { for (const [a, b] of cuts) if (t >= a && t < b) return b; return t; };
  sim.held = [];
  const trip = () => LATENCY + (random() * 2 - 1) * JITTER;

  // A message from node i to the register (up) or back (down). Links are FIFO; a cut holds messages until it heals.
  function send(i, dir, t, payload) {
    const node = nodes[i];
    const start = i === far ? heal(t) : t;
    if (start === Infinity) { sim.held.push({ i, dir, t, payload }); return; }
    if (payload.purpose === "add") sim.addMessages++;
    let arrive = start + trip();
    if (dir === "up") { arrive = Math.max(arrive, node.lastUp + 0.01); node.lastUp = arrive; }
    else { arrive = Math.max(arrive, node.lastDown + 0.01); node.lastDown = arrive; }
    sim.messages++;
    sim.trips.push({ node: i, dir, sent: t, start, arrive, kind: payload.kind, ok: payload.ok });
    push({ t: arrive, type: dir === "up" ? "atKV" : "atNode", node: i, ...payload });
  }
  function readAt(i, t) {
    const node = nodes[i];
    const ts = Math.max(node.seen, t - random() * STALE_MAX);
    node.seen = Math.max(node.seen, ts);
    return ts;
  }

  function startAdd(i, t) {
    sim.added++;
    sim.log.push({ t, type: "add", node: i });
    if (cfg.approach === "g") {
      const node = nodes[i];
      node.local++;
      node.view = node.others + node.local;
      send(i, "up", t, { kind: "write", value: node.local, purpose: "add" });
    } else {
      send(i, "up", t, { kind: "read", purpose: "add", tries: 0 });
    }
  }

  function atKV(e) {
    const t = e.t, node = nodes[e.node];
    if (e.kind === "read") {
      const ts = readAt(e.node, t);
      const value = cfg.approach === "g"
        ? nodes.map((x) => (x.i === e.node ? 0 : valueAt("slot" + x.i, ts)))
        : valueAt("counter", ts);
      sim.reads.push({ t, node: e.node, ts, stale: t - ts });
      send(e.node, "down", t, { kind: "value", purpose: e.purpose, value, tries: e.tries, asked: e.asked });
    } else if (e.kind === "write") {
      if (cfg.approach === "g") history["slot" + e.node].push([t, e.value]);
      else { history.counter.push([t, e.value]); sim.applied++; }
      node.seen = t;
      send(e.node, "down", t, { kind: "ack", purpose: e.purpose });
    } else if (e.kind === "cas") {
      const ok = current("counter") === e.from;
      sim.stamps.push({ t, node: e.node, ok });
      if (ok) { history.counter.push([t, e.to]); sim.applied++; }
      node.seen = t;
      send(e.node, "down", t, { kind: ok ? "ack" : "fail", ok, purpose: "add", tries: e.tries, from: e.from });
    }
  }

  function atNode(e) {
    const t = e.t, node = nodes[e.node];
    if (e.kind === "value" && e.purpose === "refresh") {
      if (cfg.approach === "g") { node.others = e.value.reduce((s, v) => s + v, 0); node.view = node.others + node.local; }
      else node.view = e.value;
      sim.log.push({ t, type: "view", node: e.node, value: node.view, asked: e.asked });
    } else if (e.kind === "value" && e.purpose === "add") {
      if (cfg.approach === "shared") send(e.node, "up", t, { kind: "write", value: e.value + 1, purpose: "add" });
      else send(e.node, "up", t, { kind: "cas", from: e.value, to: e.value + 1, tries: e.tries });
    } else if (e.kind === "fail") {
      sim.retries++;
      send(e.node, "up", t, { kind: "read", purpose: "add", tries: e.tries + 1 });
    } else if (e.kind === "ack" && e.purpose === "add") {
      sim.completed++;
      sim.log.push({ t, type: "done", node: e.node });
    }
  }

  if (cfg.background !== false && cfg.rate > 0) for (let i = 0; i < n; i++) push({ t: -Math.log(1 - random()) / cfg.rate, type: "add", node: i, fresh: true });
  (cfg.script || []).forEach(([t, i]) => push({ t, type: "add", node: i }));
  if (cfg.refresh !== false) for (let i = 0; i < n; i++) push({ t: REFRESH * (0.3 + 0.7 * i / n), type: "refresh", node: i });

  sim.add = (t, i) => push({ t, type: "add", node: i });
  sim.cut = (t) => { cuts.push([t, Infinity]); };
  sim.healAt = (t) => {
    for (const c of cuts) if (c[1] === Infinity) c[1] = t;
    const held = sim.held; sim.held = [];
    held.forEach((h) => send(h.i, h.dir, Math.max(t, h.t), h.payload));
  };
  sim.readNow = (t, i, tag) => send(i, "up", t, { kind: "read", purpose: "refresh", asked: tag });
  sim.runTo = (T) => {
    while (queue.length && queue[0].t <= T) {
      const e = queue.shift();
      sim.now = e.t;
      if (e.type === "add") {
        if (cfg.stopAt === undefined || e.t < cfg.stopAt) {
          startAdd(e.node, e.t);
          if (e.fresh) push({ t: e.t - Math.log(1 - random()) / cfg.rate, type: "add", node: e.node, fresh: true });
        }
      } else if (e.type === "refresh") {
        sim.readNow(e.t, e.node, "tick");
        push({ t: e.t + REFRESH, type: "refresh", node: e.node });
      } else if (e.type === "atKV") atKV(e);
      else atNode(e);
    }
    sim.now = T;
  };
  return sim;
}

// When does every node's view equal the true total for good (after adds stop)? Returns seconds after `from`, or null.
export function convergeTime(sim, from) {
  const want = sim.added;
  const n = sim.nodes.length;
  let agreedAt = null;
  const views = new Array(n).fill(null);
  for (const e of sim.log) {
    if (e.type !== "view") continue;
    views[e.node] = e.value;
    const all = views.every((v) => v === want);
    if (all && agreedAt === null) agreedAt = e.t;
    if (!all) agreedAt = null;
  }
  return agreedAt === null ? null : Math.max(0, agreedAt - from);
}

export function averageOver(fn, seeds = [3, 5, 7, 11, 13, 17, 19, 23]) {
  const runs = seeds.map((s) => fn(s));
  const keys = Object.keys(runs[0]);
  const out = {};
  for (const key of keys) out[key] = runs.reduce((s, r) => s + (r[key] ?? 0), 0) / runs.length;
  out.runs = runs;
  return out;
}

// ---------- the five experiments (used by the page and by the build's own check) ----------
const SEEDS = [3, 5, 7, 11, 13, 17, 19, 23];
const run = (cfg, T, seed) => { const s = makeSim(cfg, seed); s.runTo(T); return s; };

export function lostAdds() {
  return averageOver((seed) => { const s = run({ approach: "shared", nodes: 3, rate: 0.3, stopAt: 60 }, 90, seed); return { added: s.added, stored: s.stored(), lost: 1 - s.stored() / s.added }; }, SEEDS);
}
export function casCost(rate) {
  return averageOver((seed) => { const s = run({ approach: "cas", nodes: 3, rate, stopAt: 60 }, 240, seed); return { added: s.added, stored: s.stored(), exact: s.stored() === s.added ? 1 : 0, retries: s.retries / s.added, msgs: s.addMessages / s.added }; }, SEEDS);
}
export function slotCost(rate) {
  return averageOver((seed) => { const s = run({ approach: "g", nodes: 3, rate, stopAt: 60 }, 90, seed); return { added: s.added, stored: s.stored(), exact: s.stored() === s.added ? 1 : 0, retries: s.retries / s.added, msgs: s.addMessages / s.added }; }, SEEDS);
}
// Cut the far branch (C) off from 20 s to 35 s; adds stop when it heals. Views are sampled every 0.25 s.
export function partitionRun() {
  return averageOver((seed) => {
    const s = makeSim({ approach: "g", nodes: 3, rate: 0.3, stopAt: 35, partitions: [[20, 35]] }, seed);
    const behind = [0, 0, 0];
    for (let t = 20; t < 35; t += 0.25) {
      s.runTo(t);
      s.nodes.forEach((x, i) => { behind[i] = Math.max(behind[i], s.added - x.view); });
    }
    s.runTo(70);
    return { farBehind: behind[2], nearBehind: Math.max(behind[0], behind[1]), converge: convergeTime(s, 35) ?? 99, exact: s.stored() === s.added ? 1 : 0 };
  }, SEEDS);
}
// B adds; as soon as B's add is acknowledged, A and B each read once.
export function readAfterAdd() {
  return averageOver((seed) => {
    const s = makeSim({ approach: "cas", nodes: 3, rate: 0, background: false, refresh: false }, seed);
    const trials = 20;
    for (let k = 0; k < trials; k++) {
      s.add(5 * k + 1, 1);
      s.runTo(5 * k + 3);
      const done = s.log.filter((e) => e.type === "done" && e.node === 1).pop();
      s.readNow(done.t + 0.05, 0, "A" + k);
      s.readNow(done.t + 0.05, 1, "B" + k);
      s.runTo(5 * k + 4.9);
    }
    const seen = (who) => s.log.filter((e) => e.type === "view" && e.asked && e.asked[0] === who && e.value >= Number(e.asked.slice(1)) + 1).length / trials;
    return { other: seen("A"), own: seen("B") };
  }, SEEDS);
}

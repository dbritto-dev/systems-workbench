// Broadcast network model, shared by the figure and the experiments.
// 25 nodes on a 5×5 board. Every value a client sends to one node must reach every node.
// Messages between nodes take HOP seconds. Time is in seconds.
export const COLS = 5;
export const N = COLS * COLS;
export const HOP = 0.1;
export const RETRY_AFTER = 0.3;
export const PARTITION_COL = 2;          // columns 0–1 | 2–4 when the network is cut
export const TOPOLOGIES = ["direct", "grid", "ring", "hubs", "star"];
export const HUBS = [6, 8, 16, 18];      // cells (1,1) (3,1) (1,3) (3,3)
export const CENTER = 12;

export const cellOf = (i) => [i % COLS, Math.floor(i / COLS)];
export const sideOf = (i) => (cellOf(i)[0] < PARTITION_COL ? 0 : 1);

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// The ring visits the board in a snake; the last node closes the loop back to the first.
export const RING = Array.from({ length: N }, (_, k) => { const row = Math.floor(k / COLS), c = k % COLS; return row * COLS + (row % 2 ? COLS - 1 - c : c); });

// Each hub serves the leaves around it: five each, and the centre goes to the first hub.
const OWNER = { 6: [0, 1, 2, 5, 7, 12], 8: [3, 4, 9, 13, 14], 16: [10, 11, 15, 20, 21], 18: [17, 19, 22, 23, 24] };
export function hubOwner() {
  const owner = new Array(N).fill(-1);
  for (const h of HUBS) { owner[h] = h; for (const leaf of OWNER[h]) owner[leaf] = h; }
  return owner;
}

// Undirected edges of each topology. "direct" has no relays: the receiving node sends to everyone.
export function edgesOf(topology) {
  const E = [];
  if (topology === "direct") { for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) E.push([a, b]); }
  if (topology === "grid") for (let i = 0; i < N; i++) { const [x, y] = cellOf(i); if (x < COLS - 1) E.push([i, i + 1]); if (y < COLS - 1) E.push([i, i + COLS]); }
  if (topology === "ring") for (let k = 0; k < N; k++) E.push([RING[k], RING[(k + 1) % N]]);
  if (topology === "hubs") {
    const owner = hubOwner();
    for (let i = 0; i < N; i++) if (!HUBS.includes(i)) E.push([owner[i], i]);
    for (let a = 0; a < HUBS.length; a++) for (let b = a + 1; b < HUBS.length; b++) E.push([HUBS[a], HUBS[b]]);
  }
  if (topology === "star") for (let i = 0; i < N; i++) if (i !== CENTER) E.push([CENTER, i]);
  return E;
}
export function neighborsOf(topology) {
  const nb = Array.from({ length: N }, () => []);
  for (const [a, b] of edgesOf(topology)) { nb[a].push(b); nb[b].push(a); }
  return nb;
}
export const hubsOf = (topology) => (topology === "hubs" ? HUBS : topology === "star" ? [CENTER] : []);

// A min-heap of timed events.
function heap() {
  const a = [];
  const up = (i) => { while (i > 0) { const p = (i - 1) >> 1; if (a[p].t <= a[i].t) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } };
  const down = (i) => { for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l].t < a[m].t) m = l; if (r < a.length && a[r].t < a[m].t) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } };
  return {
    push(e) { a.push(e); up(a.length - 1); },
    pop() { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; down(0); } return top; },
    peek() { return a[0]; },
    get size() { return a.length; },
  };
}

// cfg: { topology, batch (s, 0 = off), retries, forward: "new" | "every", rate (values/s), seed, maxInFlight }
// hooks: { send(msg), deliver(msg), drop(msg), learn(node, value) } for the figure.
export function createNet(cfg, hooks = {}) {
  const random = rng(cfg.seed || 1);
  const nb = neighborsOf(cfg.topology);
  const relay = cfg.topology !== "direct";
  const q = heap();
  const seen = Array.from({ length: N }, () => new Set());
  const pending = Array.from({ length: N }, () => new Map());
  const dead = new Set();
  const ops = [];
  const outstanding = new Map();
  let t = 0, nextOp = 0, msgId = 0, inFlight = 0, partition = false, stopOps = Infinity;
  const stats = { msgs: 0, dropped: 0, overload: 0 };

  const aliveCount = () => N - dead.size;
  const blocked = (a, b) => partition && sideOf(a) !== sideOf(b);
  const schedule = (e) => q.push(e);
  const nextGap = () => -Math.log(1 - random()) / cfg.rate;
  if (cfg.rate > 0) nextOp = nextGap();
  if (cfg.batch > 0) for (let i = 0; i < N; i++) schedule({ t: random() * cfg.batch, kind: "flush", node: i });

  function send(from, to, values, kind = "b", reply = null) {
    if (cfg.maxInFlight && inFlight >= cfg.maxInFlight) { stats.overload++; return; }
    const msg = { id: ++msgId, from, to, values, kind, sent: t, at: t + HOP, reply };
    stats.msgs++;
    if (cfg.retries && kind === "b") { outstanding.set(msg.id, msg); schedule({ t: t + RETRY_AFTER, kind: "retry", id: msg.id }); }
    if (blocked(from, to) || dead.has(from)) { stats.dropped++; hooks.drop && hooks.drop(msg); return msg; }
    inFlight++;
    schedule({ t: msg.at, kind: "deliver", msg });
    hooks.send && hooks.send(msg);
    return msg;
  }
  function forward(node, values, except) {
    const hubToHub = cfg.topology === "hubs" && HUBS.includes(node) && HUBS.includes(except);
    for (const peer of nb[node]) {
      if (peer === except) continue;
      if (hubToHub && HUBS.includes(peer)) continue;
      if (cfg.batch > 0) { const list = pending[node].get(peer) || []; list.push(...values); pending[node].set(peer, list); }
      else send(node, peer, values);
    }
  }
  function learn(node, values, from) {
    const fresh = [];
    for (const v of values) {
      if (!seen[node].has(v)) {
        seen[node].add(v); fresh.push(v);
        const op = ops[v];
        if (op && !op.done) { op.have++; if (op.have >= op.target) { op.done = t; } }
        hooks.learn && hooks.learn(node, v);
      }
    }
    const out = cfg.forward === "every" ? values : fresh;
    const relays = relay || from === null;
    if (out.length && relays) forward(node, out, from);
  }
  function clientOp(origin) {
    const id = ops.length;
    const op = { id, origin, t0: t, have: 0, target: aliveCount(), done: 0 };
    ops.push(op);
    if (!dead.has(origin)) learn(origin, [id], null);
    return op;
  }
  function handle(e) {
    t = e.t;
    if (e.kind === "deliver") {
      const m = e.msg; inFlight--;
      if (dead.has(m.to) || blocked(m.from, m.to)) { stats.dropped++; hooks.drop && hooks.drop(m); return; }
      hooks.deliver && hooks.deliver(m);
      if (m.kind === "ack") { outstanding.delete(m.reply); return; }
      if (cfg.retries) send(m.to, m.from, [], "ack", m.id);
      learn(m.to, m.values, m.from);
    } else if (e.kind === "retry") {
      const m = outstanding.get(e.id);
      if (!m) return;
      outstanding.delete(e.id);
      if (!dead.has(m.from)) send(m.from, m.to, m.values, "b");
    } else if (e.kind === "flush") {
      for (const [peer, list] of pending[e.node]) if (list.length) send(e.node, peer, [...new Set(list)]);
      pending[e.node].clear();
      schedule({ t: t + cfg.batch, kind: "flush", node: e.node });
    }
  }
  function runTo(until) {
    for (;;) {
      const next = q.peek();
      const opDue = nextOp > 0 && nextOp <= until && nextOp < stopOps;
      if (opDue && (!next || nextOp <= next.t)) {
        t = nextOp;
        const alive = [...Array(N).keys()].filter((i) => !dead.has(i));
        clientOp(alive[Math.floor(random() * alive.length)]);
        nextOp = t + nextGap();
        continue;
      }
      if (!next || next.t > until) break;
      handle(q.pop());
    }
    t = Math.max(t, until);
  }
  return {
    runTo,
    get t() { return t; },
    ops, stats, seen, dead, nb,
    get inFlight() { return inFlight; },
    get partition() { return partition; },
    setPartition(on) { partition = on; },
    kill(node) { dead.add(node); },
    revive(node) { dead.delete(node); },
    stopAt(time) { stopOps = time; },
    sendValue(origin) { return clientOp(origin); },
  };
}

// Summary of a finished run: messages per value, latency until every live node has it, values that never got everywhere.
export function summarize(net, from = 0, to = Infinity) {
  const ops = net.ops.filter((o) => o.t0 >= from && o.t0 < to);
  const lat = ops.filter((o) => o.done).map((o) => o.done - o.t0).sort((a, b) => a - b);
  const q = (p) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] : NaN);
  return {
    values: ops.length,
    msgsPerOp: net.ops.length ? net.stats.msgs / net.ops.length : 0,
    median: q(0.5),
    max: lat.length ? lat[lat.length - 1] : NaN,
    delivered: ops.length ? lat.length / ops.length : 1,
    reach: ops.length ? ops.reduce((s, o) => s + Math.min(o.have, o.target) / o.target, 0) / ops.length : 1,
  };
}

// The challenge's run: values at `rate` for `duration` seconds, then time to settle.
export function runScenario({ topology = "grid", batch = 0, retries = false, forward = "new", rate = 100, duration = 20, settle = 5, seed = 7, partition = null, kill = [] } = {}) {
  const net = createNet({ topology, batch, retries, forward, rate, seed, maxInFlight: 200000 });
  kill.forEach((n) => net.kill(n));
  net.stopAt(duration);
  if (partition) { net.runTo(partition[0]); net.setPartition(true); net.runTo(partition[1]); net.setPartition(false); }
  net.runTo(duration + settle);
  return summarize(net);
}

export function average(options, seeds = [3, 5, 7]) {
  const runs = seeds.map((seed) => runScenario({ ...options, seed }));
  const mean = (f) => runs.reduce((s, r) => s + f(r), 0) / runs.length;
  return { msgsPerOp: mean((r) => r.msgsPerOp), median: mean((r) => r.median), max: Math.max(...runs.map((r) => r.max)), delivered: mean((r) => r.delivered), reach: mean((r) => r.reach), values: mean((r) => r.values) };
}

// One value with nothing else going on: how many messages does it cause in the first `window` seconds?
export function oneValue({ topology = "grid", forward = "new", origin = CENTER, window = 1, cap = 60000 } = {}) {
  const net = createNet({ topology, batch: 0, retries: false, forward, rate: 0, seed: 1, maxInFlight: cap });
  net.sendValue(origin);
  net.runTo(window);
  return { msgs: net.stats.msgs, overload: net.stats.overload, have: net.ops[0].have };
}

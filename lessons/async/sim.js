// Shared model for the figure and the experiments: a restaurant pass.
// One CPU core (the waiters' hands), a kitchen with a fixed number of burners (the dependency),
// and orders that each need a little CPU, one I/O call (cooking) and a little CPU to deliver.
// Times are in milliseconds of simulated time.
export const DEFAULTS = {
  mode: "async",      // "blocking": threads that wait at the window; "async": one waiter, a ticket rail and a bell
  threads: 4,         // blocking threads
  n: 20,              // orders in the batch
  cpu: 2,             // CPU to take the order (before the I/O call)
  cpuAfter: 1,        // CPU to deliver it (after the I/O call)
  io: 200,            // time the kitchen needs once a burner is free
  burners: 32,        // the kitchen's capacity
  timeout: 2000,      // a call fails if it is not back this long after it was sent
  gather: "gather",   // async: "gather" starts them all, "sequential" awaits one by one
  limit: 0,           // async: at most this many orders in flight at once (0 = no limit)
  block: 0,           // a synchronous file read inside the handler, in ms (0 = none)
  jitter: 0.1,        // cooking time varies ±10%
  seed: 1,
};

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export function createSim(options) {
  const o = { ...DEFAULTS, ...options };
  const random = rng(o.seed * 7919 + 13);
  let now = 0, seq = 0;
  const heap = [];
  const push = (t, fn) => {
    heap.push({ t, s: seq++, fn });
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p].t < heap[i].t || (heap[p].t === heap[i].t && heap[p].s < heap[i].s)) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last; let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; const lt = (a, b) => heap[a].t < heap[b].t || (heap[a].t === heap[b].t && heap[a].s < heap[b].s); if (l < heap.length && lt(l, m)) m = l; if (r < heap.length && lt(r, m)) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; }
    }
    return top;
  };

  const orders = Array.from({ length: o.n }, (_, id) => ({ id, state: "pending", thread: -1, sentAt: 0, readyAt: 0, doneAt: 0, failed: false, burner: -1 }));
  const st = { done: 0, failed: 0, maxInFlight: 0, coreBusy: 0, bellWaits: [], latencies: [], bells: 0, lastBell: -1 };

  // The core: one pair of hands. Tasks run one at a time, first come first served, never interrupted.
  const ready = [];
  let core = null;
  const runCore = () => {
    if (core || !ready.length) return;
    core = ready.shift();
    core.startAt = now;
    if (core.onStart) core.onStart();
    push(now + core.dur, () => { const t = core; core = null; st.coreBusy += t.dur; t.then(); runCore(); });
  };
  const onCore = (task) => { ready.push(task); runCore(); };

  // The kitchen: burners and a queue in front of them.
  const burners = new Array(o.burners).fill(null);
  const queue = [];
  const inKitchen = () => burners.filter(Boolean).length + queue.length;
  const startCooking = () => {
    for (let b = 0; b < burners.length && queue.length; b++) {
      if (burners[b]) continue;
      const order = queue.shift();
      burners[b] = order; order.burner = b; order.state = order.failed ? "lost" : "cooking";
      const cook = o.io * (1 + o.jitter * (2 * random() - 1));
      push(now + cook, () => { burners[b] = null; order.burner = -1; if (!order.failed) back(order, true); startCooking(); });
    }
  };
  const send = (order, done) => {
    order.sentAt = now; order.state = "queued"; order.back = done;
    queue.push(order);
    st.maxInFlight = Math.max(st.maxInFlight, inKitchen());
    push(now + o.timeout, () => {
      if (order.state === "queued" || order.state === "cooking") {
        order.failed = true;
        const q = queue.indexOf(order);
        if (q >= 0) queue.splice(q, 1);
        back(order, false);
      }
    });
    startCooking();
  };
  const back = (order, ok) => {
    order.readyAt = now;
    order.state = ok ? "ready" : "timedout";
    if (ok) { st.bells++; st.lastBell = now; }
    order.back(ok);
  };
  const finish = (order, ok) => {
    order.doneAt = now; order.state = ok ? "done" : "failed";
    if (ok) st.done++; else st.failed++;
    st.latencies.push(now);
  };

  // Blocking threads: each takes an order, works, then stands at the window until the dish is back.
  const threads = [];
  let nextOrder = 0;
  const threadNext = (t) => {
    const th = threads[t];
    if (nextOrder >= o.n) { th.state = "idle"; th.order = null; return; }
    const order = orders[nextOrder++];
    th.order = order; order.thread = t; th.state = "queued-cpu"; order.state = "taking";
    onCore({ dur: o.cpu, owner: order.id, kind: "cpu", thread: t, onStart: () => { th.state = "cpu"; }, then: () => {
      const sendIt = () => { th.state = "waiting"; send(order, (ok) => {
        th.state = "queued-cpu";
        const bellAt = now;
        onCore({ dur: o.cpuAfter, owner: order.id, kind: ok ? "deliver" : "error", thread: t, onStart: () => { th.state = ok ? "deliver" : "error"; if (ok) st.bellWaits.push(now - bellAt); }, then: () => { finish(order, ok); threadNext(t); } });
      }); };
      if (o.block > 0) { th.state = "reading"; push(now + o.block, sendIt); } else sendIt();
    } });
  };

  // Async: one waiter. A synchronous read inside the handler holds the waiter's hands too.
  let inFlight = 0, started = 0;
  const limit = o.limit > 0 ? o.limit : Infinity;
  const startOrder = () => {
    const order = orders[started++];
    inFlight++; order.state = "taking";
    onCore({ dur: o.cpu + o.block, owner: order.id, kind: "cpu", split: o.cpu, then: () => {
      send(order, (ok) => {
        const bellAt = now;
        onCore({ dur: o.cpuAfter, owner: order.id, kind: ok ? "deliver" : "error", onStart: () => { if (ok) st.bellWaits.push(now - bellAt); }, then: () => {
          finish(order, ok); inFlight--; launch();
        } });
      });
    } });
  };
  const launch = () => {
    if (o.gather === "sequential") { if (inFlight === 0 && started < o.n) startOrder(); return; }
    while (started < o.n && inFlight < limit) startOrder();
  };

  if (o.mode === "blocking") { for (let t = 0; t < o.threads; t++) threads.push({ state: "idle", order: null }); for (let t = 0; t < o.threads; t++) threadNext(t); }
  else launch();

  const complete = () => st.done + st.failed >= o.n;
  return {
    o, orders, threads, burners, queue, st,
    get now() { return now; },
    get core() { return core; },
    get ready() { return ready; },
    get inFlight() { return o.mode === "async" ? inFlight : threads.filter((t) => t.order && t.state !== "idle").length; },
    complete,
    // Run every event up to time t (ms).
    advance(t) { while (heap.length && heap[0].t <= t) { const e = pop(); now = e.t; e.fn(); } now = Math.max(now, t); },
    runToEnd() { let guard = 0; while (heap.length && guard++ < 5e6) { const e = pop(); now = e.t; e.fn(); } return this.metrics(); },
    metrics() {
      const sorted = (a) => [...a].sort((x, y) => x - y);
      const pct = (a, p) => { if (!a.length) return 0; const s = sorted(a); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
      const total = st.latencies.length ? Math.max(...st.latencies) : now;
      return {
        total, done: st.done, failed: st.failed,
        throughput: total > 0 ? (st.done / total) * 1000 : 0,
        p95: pct(st.latencies, 0.95),
        bellP95: pct(st.bellWaits, 0.95),
        maxInFlight: st.maxInFlight,
        busy: total > 0 ? st.coreBusy / total : 0,
      };
    },
  };
}

// Average a configuration over several seeds.
export function measure(options, seeds = [1, 2, 3, 4, 5, 6]) {
  const runs = seeds.map((seed) => createSim({ ...options, seed }).runToEnd());
  const mean = (k) => runs.reduce((s, r) => s + r[k], 0) / runs.length;
  return { total: mean("total"), done: mean("done"), failed: mean("failed"), throughput: mean("throughput"), p95: mean("p95"), bellP95: mean("bellP95"), maxInFlight: mean("maxInFlight"), busy: mean("busy") };
}

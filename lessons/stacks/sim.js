// Shared model for the figure and the experiments: three places a stack (last in, first out) shows up.
//   1. The call stack: each call pushes a frame, each return pops one; too deep and it overflows.
//   2. Undo and redo: two stacks; undo moves the top edit to redo, a new edit empties redo.
//   3. A busy server that takes the newest waiting request first (a stack) or the oldest (a queue).
// Plain functions, no imports: the page inlines this file and the experiments run it in the browser.

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// ---------- 1. The call stack ----------
// A small tree for the depth-first walk: node -> children.
export const TREE = { 1: [2, 3], 2: [4, 5], 3: [6, 7], 4: [], 5: [], 6: [], 7: [] };

// The operations a program performs on the call stack, in order.
//   { op: "push", label } · { op: "pop", label, ret } · { op: "step", label } (loop: same frame, new value)
//   { op: "overflow", depth } (the next push did not fit; the program stops and the stack is thrown away)
// program: "sum" (recursive sum(n) = n + sum(n - 1), sum(1) = 1), "loop" (the same sum with a for loop),
//          "walk" (depth-first walk of TREE, one call per node).
export function callOps(program, n, limit) {
  const ops = [];
  let depth = 0, max = 0, overflow = false;
  const push = (label) => {
    if (overflow) return false;
    if (depth >= limit) { overflow = true; ops.push({ op: "overflow", depth: depth + 1, label }); return false; }
    depth++; max = Math.max(max, depth); ops.push({ op: "push", label, depth }); return true;
  };
  const pop = (label, ret) => { depth--; ops.push({ op: "pop", label, ret, depth }); };
  if (program === "loop") {
    push("sum " + n);
    let total = 0;
    for (let i = 1; i <= n; i++) { total += i; ops.push({ op: "step", label: "i=" + i, total }); }
    pop("sum " + n, total);
  } else if (program === "walk") {
    const visit = (node) => {
      if (!push("walk " + node)) return false;
      ops.push({ op: "visit", node });
      for (const child of TREE[node]) if (!visit(child)) return false;
      pop("walk " + node, node);
      return true;
    };
    visit(1);
  } else {
    // Recursive sum written as a loop over an explicit list of pending calls, so huge n can't overflow *this* code.
    const pending = [];
    for (let k = n; k >= 1; k--) { if (!push("sum " + k)) break; pending.push(k); }
    if (!overflow) { let ret = 0; while (pending.length) { const k = pending.pop(); ret += k; pop("sum " + k, ret); } }
  }
  return { ops, max, overflow, result: overflow ? null : ops.filter((o) => o.op === "pop").map((o) => o.ret).pop() };
}

// The visit order of TREE using a stack (depth first) or a queue (breadth first), without recursion.
export function walkOrder(kind) {
  const order = [], pending = [1];
  while (pending.length) {
    const node = kind === "stack" ? pending.pop() : pending.shift();
    order.push(node);
    const kids = TREE[node];
    if (kind === "stack") for (let i = kids.length - 1; i >= 0; i--) pending.push(kids[i]);
    else pending.push(...kids);
  }
  return order;
}

// ---------- 2. Undo and redo ----------
// The document is the list of edits applied. undo and redo are stacks of edits (top = end of the array).
export function makeEditor() {
  const ed = { doc: [], undo: [], redo: [], dropped: 0, log: [] };
  ed.type = (ch) => {
    ed.doc.push(ch); ed.undo.push(ch);
    const cleared = ed.redo.length; ed.dropped += cleared; ed.redo = [];
    ed.log.push({ op: "type", ch, cleared });
    return { op: "type", ch, cleared };
  };
  ed.undoOne = () => {
    if (!ed.undo.length) return null;
    const ch = ed.undo.pop(); ed.doc.pop(); ed.redo.push(ch);
    ed.log.push({ op: "undo", ch });
    return { op: "undo", ch };
  };
  ed.redoOne = () => {
    if (!ed.redo.length) return null;
    const ch = ed.redo.pop(); ed.doc.push(ch); ed.undo.push(ch);
    ed.log.push({ op: "redo", ch });
    return { op: "redo", ch };
  };
  return ed;
}

// ---------- 3. A busy server: newest first (stack) or oldest first (queue) ----------
// One worker; requests arrive at random (Poisson) at load × capacity per second; each takes 1/capacity on
// average (0.5–1.5×). A client gives up after `timeout` seconds; the server doesn't know, so a request
// finished after its deadline is wasted work. order: "lifo" takes the newest waiting request, "fifo" the oldest.
export const CAPACITY = 10;    // requests per second the worker can finish
export const TIMEOUT = 1;      // seconds a client waits before giving up
export function makeServer({ order = "lifo", load = 1.2, capacity = CAPACITY, timeout = TIMEOUT }, seed = 7) {
  const random = rng(seed);
  const gap = () => -Math.log(1 - random()) / (load * capacity);
  const work = () => (0.5 + random()) / capacity;
  let id = 0;
  const sv = {
    order, now: 0, waiting: [], busy: null, nextArrival: gap(),
    arrived: 0, onTime: 0, late: 0, gaveUp: 0, done: [], events: [],
    setOrder(o) { sv.order = o; },
    oldest() { return sv.waiting.length ? sv.now - sv.waiting[0].t : 0; },
    stale() { return sv.waiting.filter((r) => sv.now - r.t > timeout).length; },
  };
  const take = () => (sv.order === "lifo" ? sv.waiting.pop() : sv.waiting.shift());
  const start = (t) => {
    if (sv.busy || !sv.waiting.length) return;
    const r = take();
    sv.busy = { ...r, start: t, end: t + work() };
    sv.events.push({ t, type: "start", id: r.id });
  };
  sv.runTo = (until) => {
    while (true) {
      const tEnd = sv.busy ? sv.busy.end : Infinity;
      const t = Math.min(tEnd, sv.nextArrival);
      if (t > until) break;
      sv.now = t;
      if (tEnd <= sv.nextArrival) {
        const r = sv.busy; sv.busy = null;
        const ok = r.end - r.t <= timeout;
        if (ok) sv.onTime++; else sv.late++;
        sv.done.push({ id: r.id, t: r.t, start: r.start, end: r.end, ok });
        sv.events.push({ t, type: "done", id: r.id, ok });
        start(t);
      } else {
        const r = { id: ++id, t };
        sv.arrived++;
        sv.waiting.push(r);
        sv.events.push({ t, type: "arrive", id: r.id });
        sv.nextArrival = t + gap();
        start(t);
      }
    }
    sv.now = until;
  };
  return sv;
}

// Run a server for `seconds` and summarise. Requests still waiting at the end that are already past their
// deadline count as timed out; younger ones are left out of the shares.
export function serverRun(order, load, seconds = 60, seed = 7) {
  const sv = makeServer({ order, load }, seed);
  sv.runTo(seconds);
  const pastDeadline = sv.waiting.filter((r) => seconds - r.t > TIMEOUT).length;
  const decided = sv.onTime + sv.late + pastDeadline;
  const waits = sv.done.map((r) => r.end - r.t).sort((a, b) => a - b);
  const p = (q) => (waits.length ? waits[Math.min(waits.length - 1, Math.floor(q * waits.length))] : 0);
  return { onTimeShare: decided ? sv.onTime / decided : 1, onTime: sv.onTime, late: sv.late, pastDeadline, waiting: sv.waiting.length, oldest: sv.oldest(), p50: p(0.5), p99: p(0.99), arrived: sv.arrived };
}

export function averageOf(runs) {
  const keys = Object.keys(runs[0]);
  return Object.fromEntries(keys.map((key) => [key, runs.reduce((s, r) => s + r[key], 0) / runs.length]));
}

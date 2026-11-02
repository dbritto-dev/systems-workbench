// @ts-nocheck: model code ported as-is; shared helpers come from src/lib.
// Shared model for the figure and the experiments: a priority queue kept as a binary heap.
//   A heap is an array read as a tree: the item at i has children at 2i+1 and 2i+2, and no child beats its parent.
//   So the best item is always at index 0. Push: append at the end and swap up while it beats its parent (sift up).
//   Pop: take index 0, move the last item to the top and swap it down with its better child (sift down).
//   A clinic uses it: jobs (patients) arrive with a priority 1–9 (1 most urgent); one desk serves the best waiting job.
// Shared by the page (experiment results at build time) and the live code.

import { rng } from "../../lib/random";
import { sum, averageOver } from "../../lib/stats";

// ---------- the heap ----------
// Items carry a key (lower is served first). With stable: true, equal keys are ordered by a sequence number taken on
// push (arrival order); without it, the heap only compares keys and ties come out in whatever order the swaps leave.
// push and pop return the swaps they made, as [from, to] index pairs, so the figure can replay them.
export function makeHeap({ stable = true } = {}) {
  const a = [];
  let seq = 0;
  const h = { a, stable, swaps: 0 };
  const before = (x, y) => x.key < y.key || (h.stable && x.key === y.key && x.seq < y.seq);
  const swap = (i, j, out) => { const t = a[i]; a[i] = a[j]; a[j] = t; out.push([i, j]); h.swaps++; };
  h.push = (item) => {
    item.seq = seq++;
    a.push(item);
    const swaps = [];
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (!before(a[i], a[p])) break; swap(i, p, swaps); i = p; }
    return { op: "push", item, swaps, at: i };
  };
  h.pop = () => {
    if (!a.length) return null;
    const top = a[0], last = a.pop();
    const swaps = [];
    if (a.length) {
      a[0] = last;
      let i = 0;
      while (true) {
        const l = 2 * i + 1, r = l + 1;
        let b = i;
        if (l < a.length && before(a[l], a[b])) b = l;
        if (r < a.length && before(a[r], a[b])) b = r;
        if (b === i) break;
        swap(i, b, swaps); i = b;
      }
    }
    return { op: "pop", item: top, moved: a.length ? last : null, swaps };
  };
  h.peek = () => a[0];
  h.size = () => a.length;
  return h;
}

// ---------- the clinic ----------
// Three classes of job. Urgent ones draw a priority 1–3, soon 4–6, routine 7–9.
export const CLASSES = [
  { id: "urgent", lo: 1, hi: 3 },
  { id: "soon", lo: 4, hi: 6 },
  { id: "routine", lo: 7, hi: 9 },
];
export const MIX = [0.2, 0.3, 0.5];      // share of arrivals in each class
export const AGING = 15;                // aging: one priority level gained per 15 s waited
// The key the heap orders by.
//   priority: the job's priority.   fifo: arrival time (a plain queue is a heap keyed by arrival).
//   aging: priority + arrival / AGING. Every waiting job ages at the same rate, so "priority minus time waited"
//          orders jobs the same way as this fixed key, and the heap never needs reordering.
export const keyOf = (policy, job, aging = AGING) => (policy === "fifo" ? job.t : policy === "aging" ? job.p + job.t / aging : job.p);

// One desk; jobs arrive at random (Poisson) at `load` jobs per second and take 1 s on average (exponential).
// The desk always takes the best job in the heap and finishes it before taking another (no preemption).
export function makeClinic({ policy = "priority", load = 0.9, mix = MIX, stable = true, aging = AGING } = {}, seed = 7) {
  const random = rng(seed);
  const gap = () => -Math.log(1 - random()) / load;
  const work = () => -Math.log(1 - random());
  const cls = () => { const u = random(); let s = 0; for (let c = 0; c < mix.length; c++) { s += mix[c]; if (u < s) return c; } return mix.length - 1; };
  const heap = makeHeap({ stable });
  let id = 0;
  const c = {
    policy, heap, now: 0, busy: null, nextArrival: gap(),
    arrived: [0, 0, 0], served: [0, 0, 0], waitSum: [0, 0, 0], waitMax: [0, 0, 0], waits: [[], [], []],
    lastSwaps: 0, ops: 0, swapSum: 0,
  };
  const take = (t, events) => {
    if (c.busy || !heap.size()) return;
    const r = heap.pop();
    c.ops++; c.swapSum += r.swaps.length; c.lastSwaps = r.swaps.length;
    const j = r.item, w = t - j.t;
    c.served[j.c]++; c.waitSum[j.c] += w; c.waitMax[j.c] = Math.max(c.waitMax[j.c], w); c.waits[j.c].push(w);
    c.busy = { ...j, start: t, end: t + work() };
    if (events) events.push({ t, ...r });
  };
  // Advance to `until`, processing every event on the way. events (optional) collects heap operations in order.
  c.runTo = (until, events) => {
    while (true) {
      const tEnd = c.busy ? c.busy.end : Infinity;
      const t = Math.min(tEnd, c.nextArrival);
      if (t > until) break;
      c.now = t;
      if (tEnd <= c.nextArrival) { c.busy = null; take(t, events); }
      else {
        const k = cls(), p = CLASSES[k].lo + Math.floor(random() * 3);
        const job = { id: ++id, c: k, p, t };
        job.key = keyOf(c.policy, job, aging);
        const r = heap.push(job);
        c.ops++; c.swapSum += r.swaps.length; c.lastSwaps = r.swaps.length;
        c.arrived[k]++;
        if (events) events.push({ t, ...r });
        c.nextArrival = t + gap();
        take(t, events);
      }
    }
    c.now = until;
  };
  // Advance to the next event, or to `until` if none comes first. Returns that event's heap operations.
  c.step = (until) => {
    const tEnd = c.busy ? c.busy.end : Infinity;
    const t = Math.min(tEnd, c.nextArrival);
    if (t > until) { c.now = until; return []; }
    const events = [];
    c.runTo(t, events);
    return events;
  };
  // Add a job by hand (the figure's buttons).
  c.add = (k, p = CLASSES[k].lo) => {
    const job = { id: ++id, c: k, p, t: c.now };
    job.key = keyOf(c.policy, job, aging);
    const r = heap.push(job);
    c.ops++; c.swapSum += r.swaps.length; c.lastSwaps = r.swaps.length;
    c.arrived[k]++;
    const events = [{ t: c.now, ...r }];
    take(c.now, events);
    return events;
  };
  c.oldest = (k) => heap.a.reduce((m, j) => (k == null || j.c === k ? Math.max(m, c.now - j.t) : m), 0);
  c.avgWait = (k) => (c.served[k] ? c.waitSum[k] / c.served[k] : 0);
  return c;
}

// Run a clinic for `seconds` and summarise. Waits are time in the heap before the desk takes the job.
export function clinicRun(opts, seconds, seed) {
  const c = makeClinic(opts, seed);
  c.runTo(seconds);
  const all = sum(c.waitSum) / Math.max(1, sum(c.served));
  return {
    urgent: c.avgWait(0), soon: c.avgWait(1), routine: c.avgWait(2), all,
    oldestRoutine: Math.max(c.oldest(2), c.waitMax[2]),
    routineServed: c.served[2] / Math.max(1, c.arrived[2]),
    waiting: c.heap.size(),
  };
}
// The clinic runs averaged over seeds (every field of clinicRun's summary).
export const clinicAverage = (opts, seconds, seeds) => averageOver(seeds, (s) => clinicRun(opts, seconds, s));

// ---------- growth: a heap against a sorted list ----------
// Fill a heap with n random keys, then push and pop `trials` more, counting swaps per operation.
// A sorted array keeps the same order by inserting in place: count the items that shift to make room.
export function growth(n, trials = 400, seed = 3) {
  const random = rng(seed);
  const h = makeHeap({ stable: false });
  // Build with Floyd's method (fast, no swap counting), then measure single operations.
  for (let i = 0; i < n; i++) h.a.push({ key: random(), seq: i });
  for (let i = (n >> 1) - 1; i >= 0; i--) {
    let j = i;
    while (true) { const l = 2 * j + 1, r = l + 1; let b = j; if (l < n && h.a[l].key < h.a[b].key) b = l; if (r < n && h.a[r].key < h.a[b].key) b = r; if (b === j) break; const t = h.a[j]; h.a[j] = h.a[b]; h.a[b] = t; j = b; }
  }
  let pushSwaps = 0, popSwaps = 0, worstPush = 0, shifts = 0;
  // pushes in a row (each lands in a fresh leaf), then pops in a row
  for (let i = 0; i < trials; i++) { const p = h.push({ key: random() }); pushSwaps += p.swaps.length; worstPush = Math.max(worstPush, p.swaps.length); }
  for (let i = 0; i < trials; i++) popSwaps += h.pop().swaps.length;
  // a sorted list (best first) of n keys spread evenly: a new random key lands at position key × n,
  // and every item after it shifts one place
  for (let i = 0; i < trials; i++) shifts += n - Math.floor(random() * n);
  return { n, levels: Math.ceil(Math.log2(n + 1)), push: pushSwaps / trials, pop: popSwaps / trials, worstPush, shifts: shifts / trials };
}

// ---------- top k from a stream ----------
// Keep the k largest of a stream of scores in a min-heap of size k: its root is the smallest of the best k so far,
// the bar a new score has to clear. Most scores fail one comparison with the root and are dropped.
export function topK(n = 100000, k = 10, seed = 5) {
  const random = rng(seed);
  const h = makeHeap({ stable: false });
  let comparisons = 0, replaced = 0;
  const all = [];
  for (let i = 0; i < n; i++) {
    const score = Math.round(random() * 1e6);
    all.push(score);
    if (h.size() < k) { h.push({ key: score }); continue; }
    comparisons++;
    if (score > h.peek().key) {
      replaced++;
      const before = h.swaps;
      h.pop(); h.push({ key: score });
      comparisons += 2 * (h.swaps - before) + 2;     // about two comparisons per level moved
    }
  }
  const best = h.a.map((x) => x.key).sort((a, b) => b - a);
  const sorted = all.slice().sort((a, b) => b - a).slice(0, k);
  return { n, k, kept: h.size(), replaced, comparisons, sortComparisons: Math.round(n * Math.log2(n)), same: best.join() === sorted.join(), best };
}

// ---------- ties ----------
// A fixed script: six jobs A–F of equal priority 5 arrive in that order among urgent (1) and routine (8) jobs,
// with the desk taking a job now and then. Returns the order A–F are served, with and without a sequence number.
export const TIE_SCRIPT = ["8", "A", "B", "1", "C", "serve", "D", "8", "E", "serve", "F", "1", "8", "serve", "serve", "serve", "serve", "serve", "serve", "serve", "serve", "serve", "serve"];
export function tieOrder(stable) {
  const h = makeHeap({ stable });
  const order = [];
  for (const s of TIE_SCRIPT) {
    if (s === "serve") { const r = h.pop(); if (r && /[A-F]/.test(r.item.name)) order.push(r.item.name); }
    else if (/[A-F]/.test(s)) h.push({ key: 5, name: s });
    else h.push({ key: Number(s), name: s });
  }
  while (h.size()) { const r = h.pop(); if (/[A-F]/.test(r.item.name)) order.push(r.item.name); }
  return order;
}

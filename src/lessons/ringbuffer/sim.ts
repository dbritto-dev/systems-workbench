// @ts-nocheck: model code ported as-is; shared helpers come from src/lib.
// A ring buffer: a fixed array of `cap` slots, a writer and a reader that both walk round it.
// Event-driven and seeded, shared by the live figure and the experiments.
//
// Every item carries a sequence number (seq), and lives in slot seq % cap. The writer's next seq is w,
// the reader's next seq is r, so the fill is w − r. What happens when the writer reaches a full ring is the policy:
//   "overwrite"  write anyway, over the oldest unread item (it is lost; the writer never waits)
//   "drop"       refuse the new item (it is lost, at the producer, which knows it)
//   "block"      the producer waits with the item until the reader frees a slot (nothing lost, the producer stalls)
// With "overwrite" a reader that falls more than a lap behind finds a newer item in its slot.
//   check: true   it compares the item's seq with the one it expected, counts the gap and jumps to the oldest item
//   check: false  it reads whatever is there and carries on: the gap is silent
//
// cfg:
//   cap        slots in the ring
//   rate       items per second arriving at the producer (Poisson; 0 = only injected items)
//   even       arrivals evenly spaced instead of Poisson
//   policy     "overwrite" | "drop" | "block"
//   check      the reader checks sequence numbers (matters for "overwrite")
//   overhead   seconds of fixed cost per read operation (waking up, a lock, a system call)
//   per        seconds of work per item read
//   batch      a read operation takes every item available (up to maxBatch), not just one
//   maxBatch   the most items one batched read takes

import { xorshift32 } from "../../lib/random";
import { averageOver } from "../../lib/stats";

export const DEFAULTS = { cap: 16, rate: 3, even: false, policy: "overwrite", check: true, overhead: 0.15, per: 0.1, batch: false, maxBatch: 64 };

export function makeRing(cfgIn, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rnd = xorshift32(seed);
  const gap = () => (cfg.even ? 1 / cfg.rate : -Math.log(1 - rnd()) / cfg.rate);
  let t = 0, nextSeq = 0;
  let nextArrival = cfg.rate > 0 ? gap() : Infinity;
  const slots = Array.from({ length: cfg.cap }, () => null);   // { seq, born, read }
  const backlog = [];            // items the blocked producer holds, oldest first
  const log = [];                // { t, type, seq, ... } for the figure
  let w = 0, r = 0;              // writer's next seq, reader's next seq (what the reader believes)
  const reader = { busyUntil: -1, hand: [], pausedUntil: -1 };
  let stallFrom = -1;
  const st = { arrived: 0, written: 0, read: 0, overwritten: 0, dropped: 0, gapsSeen: 0, silent: 0, twice: 0, stall: 0,
    maxFill: 0, maxLag: 0, ops: 0, opItems: 0, busy: 0, waitSum: 0, waitN: 0, maxBacklog: 0 };

  const fill = () => Math.min(cfg.cap, w - r);
  const full = () => w - r >= cfg.cap;

  // Put one item in the ring (the producer already has it).
  function write(item, at) {
    const i = w % cfg.cap, old = slots[i];
    if (old && !old.read) { st.overwritten++; old.lost = true; log.push({ t: at, type: "overwrite", seq: old.seq, by: w, slot: i, item: old }); }
    item.seq = w; item.slot = i; item.wrote = at;
    slots[i] = item; w++; st.written++;
    log.push({ t: at, type: "write", seq: item.seq, slot: i, item });
    st.maxFill = Math.max(st.maxFill, fill());
    st.maxLag = Math.max(st.maxLag, w - r);
  }

  function arrive(at) {
    const item = { id: nextSeq++, born: at, read: false };
    st.arrived++;
    if (backlog.length || (full() && cfg.policy === "block")) {
      backlog.push(item);
      st.maxBacklog = Math.max(st.maxBacklog, backlog.length);
      if (stallFrom < 0) stallFrom = at;
      log.push({ t: at, type: "wait", id: item.id, item });
    } else if (full() && cfg.policy === "drop") {
      st.dropped++; item.lost = true;
      log.push({ t: at, type: "drop", id: item.id, item });
    } else write(item, at);
    startRead(at);
  }

  // The blocked producer writes as soon as there is room.
  function unblock(at) {
    while (backlog.length && !full()) write(backlog.shift(), at);
    if (!backlog.length && stallFrom >= 0) { st.stall += at - stallFrom; stallFrom = -1; }
  }

  // The reader claims the next item(s) when it is free; it is busy for overhead + per × items.
  function startRead(at) {
    if (reader.busyUntil > at || reader.pausedUntil > at || w <= r) return;
    const want = cfg.batch ? Math.min(cfg.maxBatch, w - r) : 1;
    const hand = [];
    while (hand.length < want && r < w) {
      let item = slots[r % cfg.cap];
      if (item.seq !== r) {
        // lapped: the slot holds a newer item than the one expected
        if (cfg.check) {
          const oldest = w - cfg.cap;
          st.gapsSeen += oldest - r;
          log.push({ t: at, type: "gap", from: r, to: oldest });
          r = oldest;
          item = slots[r % cfg.cap];
        } else { st.silent++; log.push({ t: at, type: "silent", expected: r, found: item.seq }); }
      }
      if (item.read) st.twice++;
      item.read = true;
      hand.push(item);
      st.waitSum += at - item.born; st.waitN++;
      r++;
    }
    st.read += hand.length; st.ops++; st.opItems += hand.length;
    const dur = cfg.overhead + cfg.per * hand.length;
    st.busy += dur;
    reader.hand = hand; reader.busyUntil = at + dur;
    log.push({ t: at, type: "read", seqs: hand.map((x) => x.seq), slot: (r - 1) % cfg.cap });
    unblock(at);
  }

  function runTo(until) {
    for (;;) {
      const done = reader.busyUntil > t ? reader.busyUntil : Infinity;
      const wake = reader.pausedUntil > t ? reader.pausedUntil : Infinity;
      const when = Math.min(nextArrival, done, wake);
      if (when > until) break;
      t = when;
      if (when === nextArrival) { arrive(t); nextArrival = cfg.rate > 0 ? t + gap() : Infinity; }
      if (when === done) { reader.hand = []; log.push({ t, type: "done" }); }
      startRead(t);
    }
    t = until;
    startRead(t);
  }

  return {
    cfg, slots, backlog, reader, log, st, runTo,
    get t() { return t; }, get w() { return w; }, get r() { return r; },
    fill, full,
    lost() { return st.overwritten + st.dropped; },
    stalled() { return st.stall + (stallFrom >= 0 ? t - stallFrom : 0); },
    // n items arriving at once (a burst), or one at a time from a script
    inject(at, n = 1) { runTo(at); for (let i = 0; i < n; i++) arrive(at); },
    pauseReader(at, secs) { runTo(at); reader.pausedUntil = Math.max(reader.pausedUntil, at + secs); },
    setRate(rate) { cfg.rate = rate; nextArrival = rate > 0 ? t + gap() : Infinity; },
  };
}

// ---------- experiments: headless runs (averaged over seeds where arrivals are random) ----------
const SEEDS = [11, 23, 37, 41, 59, 67, 73, 89];
const avg = (fn) => averageOver(SEEDS, fn);

// 1. A burst of 40 into a ring of 16, under each policy. Steady 2/s, a reader that does 4/s.
//    lostFrom / lostTo: which of the 40 were lost (1 = the first of the burst).
export function burstRun() {
  const run = (policy) => {
    const m = makeRing({ cap: 16, rate: 2, even: true, policy, overhead: 0.15, per: 0.1 }, 1);
    m.runTo(10);
    const before = m.lost(), first = m.st.arrived + 1;
    m.inject(10, 40);
    const lost = m.log.filter((e) => e.t === 10 && (e.type === "overwrite" || e.type === "drop")).map((e) => e.item.id + 1 - first + 1);
    let empty = NaN;
    for (let s = 10.25; s <= 60; s += 0.25) { m.runTo(s); if (!m.backlog.length && m.fill() <= 1) { empty = s - 10; break; } }
    m.runTo(60);
    return { lost: m.lost() - before, lostFrom: lost.length ? Math.min(...lost) : 0, lostTo: lost.length ? Math.max(...lost) : 0, stall: m.stalled(), empty, held: m.st.maxBacklog };
  };
  return { overwrite: run("overwrite"), drop: run("drop"), block: run("block") };
}

// 2. A reader that is too slow (6/s against 10/s) on an overwriting ring of 16, for 60 s:
//    with and without checking sequence numbers.
export function lapRun() {
  const run = (check) => avg((seed) => {
    const m = makeRing({ cap: 16, rate: 10, policy: "overwrite", check, overhead: 0.0667, per: 0.1 }, seed);
    m.runTo(60);
    return { written: m.st.written, read: m.st.read, lost: m.st.overwritten, seen: m.st.gapsSeen, silent: m.st.silent, twice: m.st.twice };
  });
  return { naive: run(false), checked: run(true) };
}

// 3. Sizing: a 2-second burst at 100/s while the reader does 40/s. Which capacity loses nothing?
export function sizeRun() {
  const run = (cap) => {
    const m = makeRing({ cap, rate: 0, policy: "drop", overhead: 0, per: 0.025 }, 1);
    for (let i = 0; i < 200; i++) m.inject(1 + i * 0.01, 1);
    m.runTo(20);
    return { peak: m.st.maxFill, lost: m.st.dropped, cap };
  };
  return { c64: run(64), c128: run(128), c256: run(256) };
}

// 4. A producer at 8/s against a reader at 5/s for 60 s, ring of 16: block vs overwrite.
export function blockRun() {
  const run = (policy) => avg((seed) => {
    const m = makeRing({ cap: 16, rate: 8, policy, overhead: 0.1, per: 0.1 }, seed);
    m.runTo(60);
    return { written: m.st.written, read: m.st.read, lost: m.lost(), stall: m.stalled(), backlog: m.backlog.length, wait: m.backlog.length ? 60 - m.backlog[0].born : 0 };
  });
  return { block: run("block"), overwrite: run("overwrite") };
}

// 5. 60 items a second, a reader with 20 ms fixed cost per read and 5 ms per item: one at a time vs batches.
export function batchRun() {
  const run = (batch) => avg((seed) => {
    const m = makeRing({ cap: 64, rate: 60, policy: "drop", overhead: 0.02, per: 0.005, batch }, seed);
    m.runTo(60);
    return { arrived: m.st.arrived, read: m.st.read, lost: m.st.dropped, perOp: m.st.opItems / Math.max(1, m.st.ops), busy: m.st.busy / 60, wait: m.st.waitSum / Math.max(1, m.st.waitN) };
  });
  return { one: run(false), batch: run(true) };
}

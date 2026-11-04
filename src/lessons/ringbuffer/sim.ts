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
//   producers  1, or 2 producers sharing the ring, each getting half of `rate`
//   claim      with 2 producers, how a producer takes a slot; it stores the item `window` seconds after reading the
//              write counter (on a CPU that's nanoseconds, but at millions of writes a second the race is as real):
//                "racy"    i = w; ...; slots[i % cap] = item; w = i + 1. Two producers that read w inside the same
//                          window write the same slot: the first item is overwritten unread and w goes up by one.
//                "atomic"  i = fetch-and-add(w, 1): each producer gets its own slot at once, stores the item after the
//                          window and publishes it; the reader waits until the slot it needs is published.
//   window     seconds between reading the write counter and storing the item

import { xorshift32 } from "../../lib/random";
import { averageOver } from "../../lib/stats";

export const DEFAULTS = { cap: 16, rate: 3, even: false, policy: "overwrite", check: true, overhead: 0.15, per: 0.1, batch: false, maxBatch: 64, producers: 1, claim: "racy", window: 0.1 };

export function makeRing(cfgIn, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rnd = xorshift32(seed);
  const two = () => cfg.producers === 2;
  const gap = () => { const rate = two() ? cfg.rate / 2 : cfg.rate; return cfg.even ? 1 / rate : -Math.log(1 - rnd()) / rate; };
  let t = 0, nextSeq = 0;
  let nextArrival = cfg.rate > 0 ? gap() : Infinity;
  let nextArrival2 = cfg.rate > 0 && two() ? gap() : Infinity;   // the second producer's stream
  const pending = [];            // two producers: { at, item, i } stores waiting for the end of their window
  const slots = Array.from({ length: cfg.cap }, () => null);   // { seq, born, read }
  const backlog = [];            // items the blocked producer holds, oldest first
  const log = [];                // { t, type, seq, ... } for the figure
  let w = 0, r = 0;              // writer's next seq, reader's next seq (what the reader believes)
  const reader = { busyUntil: -1, hand: [], pausedUntil: -1 };
  let stallFrom = -1;
  const st = { arrived: 0, written: 0, read: 0, distinct: 0, overwritten: 0, dropped: 0, clobbered: 0, gapsSeen: 0, silent: 0, twice: 0, stall: 0,
    maxFill: 0, maxLag: 0, ops: 0, opItems: 0, busy: 0, waitSum: 0, waitN: 0, maxBacklog: 0 };

  const fill = () => Math.max(0, Math.min(cfg.cap, w - r));
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

  // Two producers: claim a slot now, store the item when the window ends.
  function claim(item, at) {
    if (cfg.claim === "atomic") { const i = w++; item.claimed = i; pending.push({ at: at + cfg.window, item, i }); }
    else { item.claimed = w; pending.push({ at: at + cfg.window, item, i: w }); }
    log.push({ t: at, type: "claim", id: item.id, i: pending[pending.length - 1].i, prod: item.prod, item });
  }
  function store(p, at) {
    pending.splice(pending.indexOf(p), 1);
    const { item, i } = p, s = i % cfg.cap, old = slots[s];
    if (old && !old.read && !old.lost) {
      old.lost = true;
      if (old.seq === i) { st.clobbered++; log.push({ t: at, type: "clobber", seq: i, slot: s, item: old, by: item.prod }); }
      else { st.overwritten++; log.push({ t: at, type: "overwrite", seq: old.seq, by: i, slot: s, item: old, behind: old.seq < r }); }
    }
    item.seq = i; item.slot = s; item.wrote = at; item.published = true;
    slots[s] = item; st.written++;
    if (cfg.claim !== "atomic") w = i + 1;           // the plain store: it may undo the other producer's advance
    log.push({ t: at, type: "write", seq: i, slot: s, item });
    st.maxFill = Math.max(st.maxFill, fill());
  }

  function arrive(at, prod = 0) {
    const item = { id: nextSeq++, born: at, read: false, prod };
    st.arrived++;
    if (two()) { claim(item, at); return; }
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
      if (two()) {
        // atomic: wait until slot r is published; racy: read whatever the slot holds
        if (cfg.claim === "atomic" && (!item || item.seq !== r || !item.published)) break;
        if (!item) break;
      } else if (item.seq !== r) {
        // lapped: the slot holds a newer item than the one expected
        if (cfg.check) {
          const oldest = w - cfg.cap;
          st.gapsSeen += oldest - r;
          log.push({ t: at, type: "gap", from: r, to: oldest });
          r = oldest;
          item = slots[r % cfg.cap];
        } else { st.silent++; log.push({ t: at, type: "silent", expected: r, found: item.seq }); }
      }
      if (item.read) st.twice++; else st.distinct++;
      item.read = true;
      hand.push(item);
      st.waitSum += at - item.born; st.waitN++;
      r++;
    }
    if (!hand.length) return;
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
      let next = null;
      for (const p of pending) if (!next || p.at < next.at) next = p;
      const when = Math.min(nextArrival, nextArrival2, done, wake, next ? next.at : Infinity);
      if (when > until) break;
      t = when;
      if (next && when === next.at) store(next, t);
      else if (when === nextArrival) { arrive(t, 0); nextArrival = cfg.rate > 0 ? t + gap() : Infinity; }
      else if (when === nextArrival2) { arrive(t, 1); nextArrival2 = cfg.rate > 0 && two() ? t + gap() : Infinity; }
      if (when === done) { reader.hand = []; log.push({ t, type: "done" }); }
      startRead(t);
    }
    t = until;
    startRead(t);
  }

  return {
    cfg, slots, backlog, pending, reader, log, st, runTo,
    get t() { return t; }, get w() { return w; }, get r() { return r; },
    fill, full,
    lost() { return st.overwritten + st.dropped + st.clobbered; },
    stalled() { return st.stall + (stallFrom >= 0 ? t - stallFrom : 0); },
    // n items arriving at once (a burst), or one at a time from a script
    inject(at, n = 1) { runTo(at); for (let i = 0; i < n; i++) arrive(at); },
    pauseReader(at, secs) { runTo(at); reader.pausedUntil = Math.max(reader.pausedUntil, at + secs); },
    setRate(rate) { cfg.rate = rate; nextArrival = rate > 0 ? t + gap() : Infinity; nextArrival2 = rate > 0 && two() ? t + gap() : Infinity; },
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

// 4. Two producers, 3 items a second each, share a ring of 16; the reader reads in batches and keeps up. Each producer
//    stores its item 0.1 s after reading the write counter. Plain read-then-store vs fetch-and-add, 60 s, then the
//    producers stop and the reader drains the ring. Lost: items that arrived but never reached the reader.
export const RACE = { cap: 16, rate: 6, producers: 2, window: 0.1, policy: "overwrite", check: false, overhead: 0.15, per: 0.1, batch: true, maxBatch: 16 };
export function raceRun() {
  const run = (claim) => avg((seed) => {
    const m = makeRing({ ...RACE, claim }, seed);
    m.runTo(60);
    m.setRate(0);
    m.runTo(70);
    return { arrived: m.st.arrived, reached: m.st.distinct, lost: m.st.arrived - m.st.distinct, clobbered: m.st.clobbered, overwritten: m.st.overwritten, twice: m.st.twice };
  });
  return { racy: run("racy"), atomic: run("atomic") };
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

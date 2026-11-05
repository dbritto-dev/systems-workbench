// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// Two storage engines fed the same writes: a B-tree that updates pages in place and an LSM tree (memtable, sorted
// runs, compaction). Time-stepped and seeded, shared by the live figure and the experiments.
//
// The data: KEYS live records of about 100 bytes, PER_PAGE to a 4 KB page. Live keys are the even numbers 0, 2, 4…;
// odd numbers are keys that were never written (lookups for missing keys use them). Every write updates one live
// key, chosen uniformly, so the data set keeps its size and the space each engine uses can be compared with it.
//
// Each engine has its own disk that moves DISK pages a second, read or written, in order or not (roughly how an SSD
// behaves; on a spinning disk the B-tree's random pages would cost far more). The writes spend it: the B-tree's page
// reads and writes, the LSM tree's log, flushes and compaction. Reads are counted (pages and files per read) but not
// charged to it, so a read-heavy moment never starves the writes. Memory holds the B-tree's upper levels and the LSM
// tree's memtable, file indexes and Bloom filters; data pages always come from disk.
//
//   B-tree  a write reads its leaf page, changes one record and writes the whole page back, plus a log record (WAL).
//           A point read reads one leaf; a range read reads the leaves that hold the range.
//   LSM     a write appends a log record and goes into the memtable; a full memtable is flushed as a sorted file
//           to L0. Compaction, in the background with whatever disk time is left, merges files down:
//           leveled  L0 (files overlap) → L1 (200 records) → L2 (2,000) → L3 (the rest), each level one sorted run
//                    split into files; one file at a time is merged into the overlapping files of the next level.
//           tiered   sorted runs of similar size are merged together once there are four of them (size-tiered).
//           A point read checks the memtable, then every run newest first until it finds the key; with Bloom
//           filters it skips the runs whose filter says no. A range read must look in every run.
//           With 20 L0 files writes are slowed, with 36 they stop until compaction catches up (RocksDB's defaults).
//
// cfg:
//   rate        writes per second offered to both engines (they queue when an engine can't keep up)
//   reads       "hit" (keys that exist) | "miss" (keys never written) | "range" (100 keys in order)
//   readRate    reads per second, the same stream to both engines
//   bloom       Bloom filters on the LSM tree's runs (10 bits a key)
//   compaction  "leveled" | "tiered"
//   burst       { at, len, rate }: the offered rate for len seconds from at

import { rng, fmix32 } from "../../lib/random";
import { averageOver, mean } from "../../lib/stats";

export const KEYS = 20000;
export const PER_PAGE = 40;
export const MEM = 50;
export const DISK = 400;
export const L0_TRIGGER = 4, L0_SLOW = 20, L0_STOP = 36;
export const SLOW_RATE = 100;
export const TARGET = [0, 200, 2000];
export const LEVELS = 3;
export const FILE = 50;
export const BLOOM_BITS = 10, BLOOM_K = 7;
export const TIER_MIN = 4;
export const RANGE = 100;
export const DT = 0.05;
export const DEFAULTS = { rate: 60, reads: "hit", readRate: 20, bloom: false, compaction: "leveled", burst: null };

// ---------- sorted int arrays ----------
function lowerBound(a, x) { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < x) lo = m + 1; else hi = m; } return lo; }
function upperBound(a, x) { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= x) lo = m + 1; else hi = m; } return lo; }
const has = (a, x) => { const i = lowerBound(a, x); return i < a.length && a[i] === x; };
/** The sorted union of several sorted arrays (each key once: the newest version replaces the older ones). */
export function union(parts) {
  let n = 0;
  for (const p of parts) n += p.length;
  const all = new Int32Array(n);
  let o = 0;
  for (const p of parts) { all.set(p, o); o += p.length; }
  all.sort();
  let w = 0;
  for (let i = 0; i < n; i++) if (i === 0 || all[i] !== all[i - 1]) all[w++] = all[i];
  return all.slice(0, w);
}
const concat3 = (a, b, c) => { const out = new Int32Array(a.length + b.length + c.length); out.set(a, 0); out.set(b, a.length); out.set(c, a.length + b.length); return out; };

// ---------- Bloom filters ----------
// A filter per run, BLOOM_BITS bits a key and BLOOM_K hashes (double hashing over murmur3's finaliser). Bits are only
// ever set: a level that loses keys keeps their bits (more false positives, never a false negative) until it has
// changed enough that the filter is rebuilt, as rewriting its files would.
function bloomFor(keys, cap = keys.length) {
  const m = Math.max(64, BLOOM_BITS * Math.max(cap, 1));
  const b = { m, bits: new Uint32Array(Math.ceil(m / 32)), stale: 0, n: 0 };
  for (let i = 0; i < keys.length; i++) bloomAdd(b, keys[i]);
  return b;
}
function bloomAdd(b, key) {
  const h1 = fmix32((key ^ 0x5bd1e995) >>> 0), h2 = (fmix32((h1 ^ 0x27d4eb2f) >>> 0) | 1) >>> 0;
  for (let i = 0; i < BLOOM_K; i++) { const j = ((h1 + Math.imul(i, h2)) >>> 0) % b.m; b.bits[j >>> 5] |= 1 << (j & 31); }
  b.n++;
}
function bloomMaybe(b, key) {
  const h1 = fmix32((key ^ 0x5bd1e995) >>> 0), h2 = (fmix32((h1 ^ 0x27d4eb2f) >>> 0) | 1) >>> 0;
  for (let i = 0; i < BLOOM_K; i++) { const j = ((h1 + Math.imul(i, h2)) >>> 0) % b.m; if (!(b.bits[j >>> 5] & (1 << (j & 31)))) return false; }
  return true;
}

// Pages a range read [lo, hi] costs in one sorted run (blocks of PER_PAGE records; the index is in memory, so a run
// whose keys all lie below lo costs nothing, and a seek that lands between two keys still reads one block).
function rangePages(a, lo, hi) {
  if (!a.length) return 0;
  const i = lowerBound(a, lo);
  if (i >= a.length) return 0;
  const j = upperBound(a, hi) - 1;
  if (j < i) return 1;
  return Math.floor(j / PER_PAGE) - Math.floor(i / PER_PAGE) + 1;
}

// Writes waiting for an engine, oldest first: [key, offered at].
function fifo() {
  let a = [], head = 0;
  return {
    get length() { return a.length - head; },
    push(x) { a.push(x); },
    shift() { const x = a[head++]; if (head > 4096 && head * 2 > a.length) { a = a.slice(head); head = 0; } return x; },
    oldest() { return head < a.length ? a[head][1] : null; },
  };
}

// ---------- the B-tree ----------
export function makeBtree(r) {
  // Load the live keys in random order with real page splits, so pages end up as full as random inserts leave them.
  const order = Array.from({ length: KEYS }, (_, i) => 2 * i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const leaves = [[order[0]]], firsts = [order[0]];
  const leafOf = (key) => Math.max(0, upperBound(firsts, key) - 1);
  for (let n = 1; n < order.length; n++) {
    const key = order[n], li = leafOf(key), leaf = leaves[li];
    leaf.splice(upperBound(leaf, key), 0, key);
    firsts[li] = leaf[0];
    if (leaf.length > PER_PAGE) {
      const right = leaf.splice(leaf.length >> 1);
      leaves.splice(li + 1, 0, right); firsts.splice(li + 1, 0, right[0]);
    }
  }
  const st = { writes: 0, written: 0, pagesWritten: 0, pagesRead: 0, reads: 0, readPages: 0, readFiles: 0 };
  const queue = fifo();
  let credit = 0, used = 0, waitedMax = 0;
  const recent = [];           // the leaves written lately, for the figure: [leaf index, time, key]
  const WRITE_COST = 2 + 1 / PER_PAGE;
  return {
    st, leaves, queue, recent,
    leafOf,
    get pages() { return leaves.length; },
    get space() { return (leaves.length * PER_PAGE) / KEYS; },
    get used() { return used; },
    get waitedMax() { return waitedMax; },
    offer(key, t) { queue.push([key, t]); },
    probe(kind, key) {
      const pages = kind === "range" ? leafOf(key + 2 * (RANGE - 1)) - leafOf(key) + 1 : 1;
      return { pages, files: pages, leaf: leafOf(key) };
    },
    read(kind, key) {
      const { pages } = this.probe(kind, key);
      st.reads++; st.readPages += pages; st.readFiles += pages; st.pagesRead += pages;
      return { pages, files: pages };
    },
    tick(t, dt) {
      credit = Math.min(credit + DISK * dt, DISK * dt * 2);
      let n = 0;
      while (queue.length && credit >= WRITE_COST) {
        const [key, at] = queue.shift();
        const li = leafOf(key);
        credit -= WRITE_COST; used += WRITE_COST;
        st.writes++; st.pagesRead++; st.pagesWritten++; st.written += PER_PAGE + 1;   // the page, plus its log record
        waitedMax = Math.max(waitedMax, t - at);
        if (n++ < 40) recent.push([li, t, key]);
      }
      while (recent.length && recent[0][1] < t - 0.6) recent.shift();
    },
    takeUsed() { const u = used; used = 0; return u; },
  };
}

// ---------- the LSM tree ----------
let RUN_ID = 1;
const run = (keys, t, bloom) => ({ id: RUN_ID++, keys, born: t, bloom: bloom ? bloomFor(keys) : null });

export function makeLsm(cfg, r) {
  const tiered = cfg.compaction === "tiered";
  const all = Int32Array.from({ length: KEYS }, (_, i) => 2 * i);
  const sample = (n) => { const s = new Set(); while (s.size < n) s.add(2 * Math.floor(r() * KEYS)); return Int32Array.from([...s]).sort(); };
  let mem = new Set(), memPuts = 0;
  // Leveled: l0 runs (newest first) and levels 1..LEVELS. Tiered: runs (newest first). Both start compacted, with
  // L1 and L2 near their targets so the first minutes look like a tree that has been running for a while.
  const l0 = [];
  const lv = [null, { keys: sample(150), bloom: null, id: RUN_ID++ }, { keys: sample(1800), bloom: null, id: RUN_ID++ }, { keys: all, bloom: null, id: RUN_ID++ }];
  const runs = tiered ? [run(all, 0, cfg.bloom)] : [];
  if (cfg.bloom) for (let i = 1; i <= LEVELS; i++) lv[i].bloom = bloomFor(lv[i].keys, Math.max(lv[i].keys.length, TARGET[i] || 0));
  const cursor = [0, 0, 0, 0];
  const st = { writes: 0, written: 0, wal: 0, flushed: 0, compacted: 0, compactIn: 0, pagesRead: 0, reads: 0, readPages: 0, readFiles: 0, slowTime: 0, stopTime: 0, jobs: 0, trivial: 0 };
  const queue = fifo();
  const log = [];
  let credit = 0, used = 0, job = null, slowCredit = 0, waitedMax = 0, stall = "off";

  function flush(t) {
    const keys = Int32Array.from([...mem]).sort();
    mem = new Set(); memPuts = 0;
    const rn = run(keys, t, cfg.bloom);
    const cost = keys.length / PER_PAGE;
    credit -= cost; used += cost;
    st.flushed += keys.length; st.written += keys.length;
    if (tiered) runs.unshift(rn); else l0.unshift(rn);
    log.push({ t, type: "flush", run: rn });
  }

  // ----- choosing the next compaction -----
  function pickLeveled() {
    let best = null, score = 1;
    const s0 = l0.length / L0_TRIGGER;
    if (s0 >= score) { best = 0; score = s0; }
    for (let i = 1; i < LEVELS; i++) { const s = lv[i].keys.length / TARGET[i]; if (s > score) { best = i; score = s; } }
    if (best === null) return null;
    if (best === 0) {
      const inputs = l0.slice();
      const parts = inputs.map((x) => x.keys);
      let lo = Infinity, hi = -Infinity;
      for (const p of parts) if (p.length) { lo = Math.min(lo, p[0]); hi = Math.max(hi, p[p.length - 1]); }
      const L1 = lv[1].keys, a = lowerBound(L1, lo), b = upperBound(L1, hi);
      const out = union([...parts, L1.subarray(a, b)]);
      const inN = parts.reduce((s, p) => s + p.length, 0) + (b - a);
      return { kind: "l0", from: 0, to: 1, inputs, a, b, out, inN, cost: (inN + out.length) / PER_PAGE, done: 0 };
    }
    const i = best, Li = lv[i].keys, Lj = lv[i + 1].keys;
    let s = lowerBound(Li, cursor[i]);
    if (s >= Li.length) s = 0;
    const e = Math.min(Li.length, s + FILE);
    const chunk = Li.subarray(s, e), lo = chunk[0], hi = chunk[chunk.length - 1];
    let a = lowerBound(Lj, lo), b = upperBound(Lj, hi);
    if (b > a) { a = Math.floor(a / FILE) * FILE; b = Math.min(Lj.length, Math.ceil(b / FILE) * FILE); }   // whole files of the next level
    const trivial = b === a;
    const out = trivial ? chunk.slice() : union([chunk, Lj.subarray(a, b)]);
    const inN = trivial ? 0 : chunk.length + (b - a);
    return { kind: "lv", from: i, to: i + 1, s, e, a, b, out, inN, trivial, hiKey: hi, cost: trivial ? 0 : (inN + out.length) / PER_PAGE, done: 0 };
  }
  function pickTiered() {
    const sorted = runs.slice().sort((x, y) => x.keys.length - y.keys.length);
    const buckets = [];
    for (const rn of sorted) {
      const n = rn.keys.length, bk = buckets.find((b) => n >= 0.5 * b.avg && n <= 1.5 * b.avg);
      if (bk) { bk.runs.push(rn); bk.avg = bk.runs.reduce((s, x) => s + x.keys.length, 0) / bk.runs.length; }
      else buckets.push({ runs: [rn], avg: n });
    }
    const bk = buckets.find((b) => b.runs.length >= TIER_MIN);
    if (!bk) return null;
    const inputs = bk.runs.slice(0, 32);
    const out = union(inputs.map((x) => x.keys));
    const inN = inputs.reduce((s, x) => s + x.keys.length, 0);
    return { kind: "tier", inputs, out, inN, cost: (inN + out.length) / PER_PAGE, done: 0 };
  }

  function finish(t) {
    const j = job;
    job = null;
    st.jobs++;
    if (j.trivial) st.trivial++;
    else { st.compacted += j.out.length; st.written += j.out.length; st.compactIn += j.inN; st.pagesRead += j.inN / PER_PAGE; }
    if (j.kind === "tier") {
      const ids = new Set(j.inputs.map((x) => x.id));
      const at = runs.findIndex((x) => ids.has(x.id));
      const rest = runs.filter((x) => !ids.has(x.id));
      const rn = run(j.out, t, cfg.bloom);
      rest.splice(Math.min(at, rest.length), 0, rn);
      runs.length = 0; runs.push(...rest);
      j.result = rn;
    } else {
      const to = lv[j.to], old = to.keys;
      to.keys = concat3(old.subarray(0, j.a), j.out, old.subarray(j.b));
      const added = j.out.length - (j.b - j.a);
      if (to.bloom) { for (let n = 0; n < j.out.length; n++) bloomAdd(to.bloom, j.out[n]); to.bloom.stale += Math.max(0, -added); }
      if (j.kind === "l0") {
        const ids = new Set(j.inputs.map((x) => x.id));
        for (let n = l0.length - 1; n >= 0; n--) if (ids.has(l0[n].id)) l0.splice(n, 1);
      } else {
        const fr = lv[j.from], k = fr.keys;
        fr.keys = concat3(k.subarray(0, j.s), k.subarray(j.e), new Int32Array(0));
        if (fr.bloom) fr.bloom.stale += j.e - j.s;
        cursor[j.from] = j.hiKey + 1;
      }
      // a filter that has lost or gained a fifth of its keys since it was built is rebuilt
      for (const L of [lv[j.to], lv[j.from]]) if (L && L.bloom && (L.bloom.stale > 0.2 * L.keys.length || L.bloom.n > 1.6 * L.keys.length + 64)) L.bloom = bloomFor(L.keys, Math.max(L.keys.length, TARGET[lv.indexOf(L)] || 0));
    }
    log.push({ t, type: "done", job: j });
  }

  function admit(t, dt) {
    const n0 = tiered ? 0 : l0.length;
    const was = stall;
    stall = n0 >= L0_STOP ? "stop" : n0 >= L0_SLOW ? "slow" : "off";
    if (stall !== was) log.push({ t, type: "stall", stall, was });
    if (stall === "stop") { st.stopTime += dt; return 0; }
    if (stall === "slow") { st.slowTime += dt; slowCredit = Math.min(slowCredit + SLOW_RATE * dt, SLOW_RATE * dt * 2); return Math.floor(slowCredit); }
    slowCredit = 0;
    return Infinity;
  }

  function lookupPoint(key) {
    let files = 0, pages = 0;
    if (mem.has(key)) return { files, pages, at: "mem" };
    const look = (x) => {
      if (!x.keys.length || key < x.keys[0] || key > x.keys[x.keys.length - 1]) return false;
      files++;
      if (x.bloom && !bloomMaybe(x.bloom, key)) return false;
      pages++;
      return has(x.keys, key);
    };
    if (tiered) { for (let i = 0; i < runs.length; i++) if (look(runs[i])) return { files, pages, at: runs[i].id }; }
    else {
      for (let i = 0; i < l0.length; i++) if (look(l0[i])) return { files, pages, at: l0[i].id };
      for (let i = 1; i <= LEVELS; i++) if (look(lv[i])) return { files, pages, at: lv[i].id };
    }
    return { files, pages, at: null };
  }
  function lookupRange(key) {
    const lo = key, hi = key + 2 * (RANGE - 1);
    let files = 0, pages = 0;
    const each = (x) => { const p = rangePages(x.keys, lo, hi); if (x.keys.length) files++; pages += p; };
    if (tiered) runs.forEach(each);
    else { l0.forEach(each); for (let i = 1; i <= LEVELS; i++) each(lv[i]); }
    return { files, pages, at: null };
  }

  return {
    cfg, st, queue, log, l0, lv, runs, tiered,
    get mem() { return mem; },
    get memFill() { return memPuts / MEM; },
    get job() { return job; },
    get stall() { return stall; },
    get used() { return used; },
    get waitedMax() { return waitedMax; },
    get space() {
      let n = mem.size;
      if (tiered) for (const x of runs) n += x.keys.length;
      else { for (const x of l0) n += x.keys.length; for (let i = 1; i <= LEVELS; i++) n += lv[i].keys.length; }
      return n / KEYS;
    },
    get runCount() { return tiered ? runs.length : l0.length + lv.slice(1).filter((x) => x.keys.length).length; },
    offer(key, t) { queue.push([key, t]); },
    probe(kind, key) { return kind === "range" ? lookupRange(key) : lookupPoint(key); },
    read(kind, key) {
      const res = kind === "range" ? lookupRange(key) : lookupPoint(key);
      st.reads++; st.readPages += res.pages; st.readFiles += res.files; st.pagesRead += res.pages;
      return res;
    },
    tick(t, dt) {
      credit = Math.min(credit + DISK * dt, DISK * dt * 2);
      let room = admit(t, dt);
      while (queue.length && room > 0) {
        const [key, at] = queue.shift();
        room--; if (stall === "slow") slowCredit--;
        credit -= 1 / PER_PAGE; used += 1 / PER_PAGE;
        st.writes++; st.wal++; st.written++;
        waitedMax = Math.max(waitedMax, t - at);
        mem.add(key); memPuts++;
        if (memPuts >= MEM) { flush(t); if (admit(t, 0) === 0) break; }
      }
      // compaction gets the disk time that is left, one job after another
      for (let n = 0; n < 64; n++) {
        if (!job) { job = tiered ? pickTiered() : pickLeveled(); if (!job) break; log.push({ t, type: "start", job }); }
        if (credit <= 0 && job.cost > job.done) break;
        const step = Math.min(Math.max(credit, 0), job.cost - job.done);
        job.done += step; credit -= step; used += step;
        if (job.done >= job.cost - 1e-9) finish(t); else break;
      }
    },
    takeUsed() { const u = used; used = 0; return u; },
  };
}

/** How long a run of n records is drawn on a shelf of length len (log scale: each level is ten times the last). */
export const runLen = (n, len) => Math.max(2.2, Math.min(1, (Math.log10(Math.max(n, 20)) - 1.2) / (Math.log10(25000) - 1.2)) * len);

// ---------- both engines, the same writes and reads ----------
export function makeRooms(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rLoad = rng(seed * 2654435761 + 11), rKey = rng(seed * 40503 + 7), rRead = rng(seed * 69069 + 3);
  const bt = makeBtree(rLoad);
  const lsm = makeLsm(cfg, rLoad);
  let t = 0, wAcc = 0, rAcc = 0, offered = 0;
  const reads = { bt: [], lsm: [] };       // the latest reads: { pages, files }
  const busy = { bt: 0, lsm: 0 };          // share of the disk used, smoothed
  const rateAt = (time) => (cfg.burst && time >= cfg.burst.at && time < cfg.burst.at + cfg.burst.len ? cfg.burst.rate : cfg.rate);
  function step(dt) {
    wAcc += rateAt(t) * dt;
    while (wAcc >= 1) { wAcc -= 1; const key = 2 * Math.floor(rKey() * KEYS); bt.offer(key, t); lsm.offer(key, t); offered++; }
    rAcc += cfg.readRate * dt;
    while (rAcc >= 1) {
      rAcc -= 1;
      const live = cfg.reads === "range" ? 2 * Math.floor(rRead() * (KEYS - RANGE)) : 2 * Math.floor(rRead() * KEYS);
      const key = cfg.reads === "miss" ? live + 1 : live;
      const a = bt.read(cfg.reads, key), b = lsm.read(cfg.reads, key);
      reads.bt.push(a); reads.lsm.push(b);
      if (reads.bt.length > 200) { reads.bt.shift(); reads.lsm.shift(); }
    }
    bt.tick(t, dt); lsm.tick(t, dt);
    const f = 1 - Math.exp(-dt / 0.8);
    busy.bt += (Math.min(1.2, bt.takeUsed() / (DISK * dt)) - busy.bt) * f;
    busy.lsm += (Math.min(1.2, lsm.takeUsed() / (DISK * dt)) - busy.lsm) * f;
    t += dt;
  }
  return {
    cfg, bt, lsm, reads, busy,
    get t() { return t; },
    get offered() { return offered; },
    rateAt,
    runTo(T, dt = DT) { while (t < T - 1e-9) step(Math.min(dt, T - t)); },
    step,
    /** Drop `n` writes in at once (the live machine's burst button). */
    burst(n) { for (let i = 0; i < n; i++) { const key = 2 * Math.floor(rKey() * KEYS); bt.offer(key, t); lsm.offer(key, t); offered++; } },
  };
}

// ---------- experiments: headless runs, averaged over seeds ----------
export const SEEDS = [3, 7, 11, 19, 23, 31, 43, 59];
const avg = (fn) => averageOver(SEEDS, fn);
const snap = (m) => ({ bt: { ...m.bt.st }, lsm: { ...m.lsm.st } });
const amp = (a, b) => (b.written - a.written) / Math.max(1, b.writes - a.writes);

// Measurement probes: lookups that cost no disk time, so measuring doesn't change the run. Every probe uses one key
// drawn for both engines.
function probes(m, r, n, kind) {
  let pb = 0, pl = 0, fl = 0;
  for (let i = 0; i < n; i++) {
    const live = kind === "range" ? 2 * Math.floor(r() * (KEYS - RANGE)) : 2 * Math.floor(r() * KEYS);
    const key = kind === "miss" ? live + 1 : live;
    pb += m.bt.probe(kind, key).pages;
    const x = m.lsm.probe(kind, key);
    pl += x.pages; fl += x.files;
  }
  return { pb, pl, fl };
}

/** A steady workload: warm up, then measure write amplification, space and lookups (probes every 5 s) over a window.
 *  Bloom filters on: a probe's files are the runs it had to consult (each one a page read without filters), its pages
 *  the pages it read with them. */
export function steady(cfg, seed, { warm = 120, secs = 600, kinds = ["hit"] } = {}) {
  const m = makeRooms({ readRate: 5, bloom: true, ...cfg }, seed);
  const r = rng(seed * 7919 + 5);
  m.runTo(warm);
  const s0 = snap(m);
  let spaceB = 0, spaceL = 0, peakL = 0, n = 0, runs = 0;
  const acc = Object.fromEntries(kinds.map((k) => [k, { pb: 0, pl: 0, fl: 0, n: 0 }]));
  for (let T = warm + 5; T <= warm + secs + 1e-9; T += 5) {
    m.runTo(T);
    spaceB += m.bt.space; spaceL += m.lsm.space; peakL = Math.max(peakL, m.lsm.space); runs += m.lsm.runCount; n++;
    for (const k of kinds) { const p = probes(m, r, 40, k), a = acc[k]; a.pb += p.pb; a.pl += p.pl; a.fl += p.fl; a.n += 40; }
  }
  const s1 = snap(m);
  const reads = Object.fromEntries(kinds.map((k) => { const a = acc[k]; return [k, { b: a.pb / a.n, l: a.pl / a.n, files: a.fl / a.n }]; }));
  const writes = s1.lsm.writes - s0.lsm.writes;
  return {
    waB: amp(s0.bt, s1.bt), waL: amp(s0.lsm, s1.lsm),
    spaceB: spaceB / n, spaceL: spaceL / n, peakL, runs: runs / n, reads,
    // disk pages moved (read or written) per write, and the most writes a second each disk could take at that rate
    costB: 2 + 1 / PER_PAGE,
    costL: ((s1.lsm.written - s0.lsm.written) + (s1.lsm.compactIn - s0.lsm.compactIn)) / PER_PAGE / Math.max(1, writes),
  };
}

// 1-3. One steady leveled run per seed: 100 random updates a second (both engines keep up), point and range lookups.
export function baseRun() {
  return avg((seed) => {
    const r = steady({ rate: 100 }, seed, { kinds: ["hit", "miss", "range"] });
    const { hit, miss, range } = r.reads;
    return {
      waB: r.waB, waL: r.waL, maxB: DISK / r.costB, maxL: DISK / r.costL, spaceB: r.spaceB, spaceL: r.spaceL,
      hitB: hit.b, hitFiles: hit.files, hitBloom: hit.l, missB: miss.b, missFiles: miss.files, missBloom: miss.l,
      rangeB: range.b, rangeL: range.l, rangeFiles: range.files,
    };
  });
}

// 4. A write burst: a minute at BURST.rate from a steady BURST.base a second. Reads of keys that exist, no filters.
export const BURST = { at: 60, len: 60, rate: 1000, base: 100 };
const AFTER = 600;
export function burstRun() {
  return avg((seed) => {
    const m = makeRooms({ rate: BURST.base, readRate: 20, reads: "hit", bloom: false, burst: { at: BURST.at, len: BURST.len, rate: BURST.rate } }, seed);
    m.runTo(BURST.at);
    const before = m.lsm.st.readFiles / Math.max(1, m.lsm.st.reads);
    const end = BURST.at + BURST.len;
    let peakL0 = 0, peakFiles = 0, fullSpeed = -1, peakQL = 0, endQB = 0, caughtUp = AFTER, drainB = AFTER;
    for (let T = BURST.at + 1; T <= end + AFTER + 1e-9; T += 1) {
      const fr = m.lsm.st.readFiles, rr = m.lsm.st.reads;
      m.runTo(T);
      peakL0 = Math.max(peakL0, m.lsm.l0.length);
      peakFiles = Math.max(peakFiles, (m.lsm.st.readFiles - fr) / Math.max(1, m.lsm.st.reads - rr));
      if (fullSpeed < 0 && m.lsm.st.slowTime + m.lsm.st.stopTime > 0) fullSpeed = T - 1 - BURST.at;
      if (T <= end) peakQL = Math.max(peakQL, m.lsm.queue.length);
      if (Math.abs(T - end) < 1e-6) endQB = m.bt.queue.length;
      if (T > end && caughtUp === AFTER && m.lsm.l0.length < L0_TRIGGER && !m.lsm.queue.length && m.lsm.lv[1].keys.length <= TARGET[1] && m.lsm.lv[2].keys.length <= TARGET[2]) caughtUp = T - end;
      if (T > end && drainB === AFTER && !m.bt.queue.length) drainB = T - end;
    }
    return { before, peakL0, peakFiles, fullSpeed: fullSpeed < 0 ? BURST.len : fullSpeed, slow: m.lsm.st.slowTime, stop: m.lsm.st.stopTime, peakQL, endQB, caughtUp, drainB, waitB: m.bt.waitedMax, waitL: m.lsm.waitedMax };
  });
}

// 5. Leveled vs tiered compaction, the same updates: write amplification, space, runs consulted per point read.
export function tierRun() {
  const one = (compaction) => avg((seed) => { const r = steady({ rate: 100, compaction }, seed, { warm: 300, secs: 1200 }); return { wa: r.waL, space: r.spaceL, peak: r.peakL, files: r.reads.hit.files, runs: r.runs }; });
  return { leveled: one("leveled"), tiered: one("tiered") };
}

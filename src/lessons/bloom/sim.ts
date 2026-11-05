// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// A Bloom filter: m positions (pegs) and k hash functions. Adding a key raises the k pegs its hashes pick; a lookup
// checks them: any peg down means "no, never added", all up means "maybe": go and look in the archive. A counting
// filter keeps a small counter per position (rings on a spindle) so a key can be taken out again.
// Seeded and browser-safe, shared by the live figure and the experiments (which run the same filter, bigger).
import { fmix32, xorshift32 } from "../../lib/random";
import { averageOver } from "../../lib/stats";

/** The counting filter's counters are 4 bits wide, the usual choice: they stop at 15 and a full one never goes down. */
export const CAP = 15;

/** The k positions a key's hashes pick (a position can come up twice). One 32-bit hash seeds k derived ones. */
export function positions(key, k, m, salt = 0) {
  const base = fmix32((Math.imul(key, 0x9e3779b1) ^ salt) >>> 0);
  const out = new Array(k);
  for (let i = 0; i < k; i++) out[i] = fmix32((base + Math.imul(i + 1, 0x85ebca6b)) >>> 0) % m;
  return out;
}

export function makeFilter(m, k, { counting = false, salt = 0x2545f491 } = {}) {
  const c = new Uint8Array(m);
  let up = 0;
  const hashAt = (base, i) => fmix32((base + Math.imul(i + 1, 0x85ebca6b)) >>> 0) % m;
  const baseOf = (key) => fmix32((Math.imul(key, 0x9e3779b1) ^ salt) >>> 0);
  return {
    m, k, counting, counts: c,
    get up() { return up; },
    pos: (key) => positions(key, k, m, salt),
    add(key) {
      const b = baseOf(key);
      for (let i = 0; i < k; i++) {
        const p = hashAt(b, i);
        if (c[p] === 0) up++;
        c[p] = counting ? Math.min(CAP, c[p] + 1) : 1;
      }
    },
    /** A lookup: false means the key was never added (unless a delete pulled one of its pegs down). */
    has(key) {
      const b = baseOf(key);
      for (let i = 0; i < k; i++) if (c[hashAt(b, i)] === 0) return false;
      return true;
    },
    /** Delete. Plain filter: pull every one of the key's pegs down, whoever else raised it. Counting filter: take one
     *  ring off each (a counter stuck at 15 stays). */
    remove(key) {
      const b = baseOf(key);
      for (let i = 0; i < k; i++) {
        const p = hashAt(b, i);
        if (c[p] === 0) continue;
        if (!counting) c[p] = 0;
        else if (c[p] < CAP) c[p]--;
        if (c[p] === 0) up--;
      }
    },
  };
}

/** The textbook estimate of the false-positive rate: (1 − e^(−kn/m))^k. The experiments measure; this is for comparison. */
export const formula = (k, n, m) => (1 - Math.exp((-k * n) / m)) ** k;
/** The number of hashes that minimises the estimate: (m/n)·ln 2. */
export const bestK = (m, n) => (m / n) * Math.LN2;

// ---------- the live machine: one operation at a time ----------
// cfg: m (pegs), bpk (pegs per key: the board is planned for m / bpk keys), k (hashes), keys ("planned" | "double"),
// deletes ("none" | "clear": pull the pegs down | "count": counting rings). With deletes on, every REPLACE_EVERY lookups
// one stored key is deleted and a new one added, so the archive keeps the same number of keys.
export const M_LIVE = 80;
export const REPLACE_EVERY = 4;
export const PRESENT_SHARE = 0.3;              // share of lookups for keys that are in the archive
export const DUR = { add: 1.3, no: 1.25, maybe: 2.1, del: 1.25 };   // seconds each operation takes on the machine
export const DRAWERS = 6;

export function makeLive(cfgIn, seed = 1) {
  const cfg = { m: M_LIVE, bpk: 5, k: 3, keys: "planned", deletes: "none", ...cfgIn };
  const rnd = xorshift32(seed);
  const f = makeFilter(cfg.m, cfg.k, { counting: cfg.deletes === "count" });
  const planned = Math.round(cfg.m / cfg.bpk);
  let target = cfg.keys === "double" ? 2 * planned : planned;
  const present = [];                            // keys in the archive
  const used = new Set();
  const forced = [];
  let looksSince = 0, pendingAdd = 0;
  const st = { keys: 0, up: 0, looks: 0, absent: 0, fp: 0, present: 0, fn: 0, saidNo: 0, found: 0, trips: 0, adds: 0, dels: 0 };

  function fresh() {
    for (;;) { const key = 1000 + Math.floor(rnd() * 9000); if (!used.has(key)) { used.add(key); return key; } }
  }
  const snapshot = () => ({ ...st, keys: present.length, up: f.up });
  const beforeAt = (pos) => pos.map((p) => f.counts[p]);
  const distinctOf = (pos) => new Set(pos).size;

  function add(key = fresh()) {
    const pos = f.pos(key), before = beforeAt(pos);
    f.add(key);
    present.push(key);
    st.adds++;
    return { type: "add", key, pos, distinct: distinctOf(pos), before, after: beforeAt(pos), drawer: key % DRAWERS, dur: DUR.add, st: snapshot() };
  }
  function del() {
    const i = Math.floor(rnd() * present.length), key = present[i];
    const pos = f.pos(key), before = beforeAt(pos);
    f.remove(key);
    present.splice(i, 1);
    st.dels++;
    return { type: "del", key, pos, distinct: distinctOf(pos), before, after: beforeAt(pos), drawer: key % DRAWERS, dur: DUR.del, st: snapshot() };
  }
  function look(wantPresent) {
    const inArchive = wantPresent && present.length > 0;
    const key = inArchive ? present[Math.floor(rnd() * present.length)] : fresh();
    const pos = f.pos(key), before = beforeAt(pos);
    const maybe = f.has(key);
    st.looks++;
    if (inArchive) st.present++; else st.absent++;
    if (!maybe) { st.saidNo++; if (inArchive) st.fn++; }
    else { st.trips++; if (inArchive) st.found++; else st.fp++; }
    const down = new Set(pos.filter((p) => f.counts[p] === 0)).size;    // distinct pegs that are down
    return { type: "look", key, pos, distinct: distinctOf(pos), before, after: before, inArchive, maybe, fp: maybe && !inArchive, fn: !maybe && inArchive, down, drawer: key % DRAWERS, dur: maybe ? DUR.maybe : DUR.no, st: snapshot() };
  }

  function next() {
    if (forced.length) {
      const w = forced.shift();
      if (w === "add") { target++; return add(); }
      return look(true);
    }
    if (pendingAdd > 0 || present.length < target) { pendingAdd = Math.max(0, pendingAdd - 1); return add(); }
    if (cfg.deletes !== "none" && looksSince >= REPLACE_EVERY && present.length) { looksSince = 0; pendingAdd = 1; return del(); }
    looksSince++;
    return look(rnd() < PRESENT_SHARE);
  }
  /** Add keys without showing them: the run opens with the board almost filled. */
  function prefill(count) { for (let i = 0; i < count && present.length < target; i++) add(); }

  return {
    cfg, f, present, st, next, prefill, snapshot,
    get planned() { return planned; },
    get target() { return target; },
    force(what) { forced.push(what); },
  };
}

// ---------- experiments: the same filter at a bigger scale, averaged over seeds ----------
const SEEDS = [11, 23, 37, 41, 59, 67, 73, 89];
const avg = (fn) => averageOver(SEEDS, fn);
export const N = 1000;                          // keys in the archive

function keyMaker(seed) {
  const r = xorshift32(seed * 2654435761 >>> 0 || 7);
  const used = new Set();
  return () => { for (;;) { const key = 1 + Math.floor(r() * 2147483646); if (!used.has(key)) { used.add(key); return key; } } };
}
function build(seed, m, k, n, counting = false) {
  const f = makeFilter(m, k, { counting, salt: fmix32(seed ^ 0x51ed27) });
  const newKey = keyMaker(seed);
  const keys = [];
  for (let i = 0; i < n; i++) { const key = newKey(); f.add(key); keys.push(key); }
  return { f, keys, newKey };
}
/** Share of `count` never-added keys the filter answers "maybe" for. */
function fpRate(f, newKey, count) {
  let fp = 0;
  for (let i = 0; i < count; i++) if (f.has(newKey())) fp++;
  return fp / count;
}

// 1. Lookups for keys that aren't there: 1,000 keys, 10 pegs per key, 7 hashes; 10,000 lookups of new keys.
export const PAYS = { bpk: 10, k: 7, looks: 10000 };
export function paysRun() {
  return avg((seed) => {
    const { f, keys, newKey } = build(seed, PAYS.bpk * N, PAYS.k, N);
    const fp = fpRate(f, newKey, PAYS.looks) * PAYS.looks;
    const fn = keys.filter((key) => !f.has(key)).length;
    return { fp, rate: fp / PAYS.looks, fn, up: f.up / f.m };
  });
}

// 2. More hashes on the same board: 10 pegs per key, k = 1, 3, 7, 20.
export const HASHES = { bpk: 10, ks: [1, 3, 7, 20], looks: 40000 };
export function hashesRun() {
  return HASHES.ks.map((k) => ({ k, ...avg((seed) => {
    const { f, newKey } = build(seed, HASHES.bpk * N, k, N);
    return { rate: fpRate(f, newKey, HASHES.looks), up: f.up / f.m };
  }) }));
}

// 3. Twice the memory: 5, 10 and 20 pegs per key, each with its best whole number of hashes.
export const MEMORY = { sizes: [[5, 3], [10, 7], [20, 14]], looks: 400000 };
export function memoryRun() {
  return MEMORY.sizes.map(([bpk, k]) => ({ bpk, k, ...avg((seed) => {
    const { f, newKey } = build(seed, bpk * N, k, N);
    return { rate: fpRate(f, newKey, MEMORY.looks), up: f.up / f.m };
  }) }));
}

// 4. Past the plan: a board sized for 1,000 keys (10 pegs per key, 7 hashes) given 1,000, 1,500 and 2,000.
export const OVER = { bpk: 10, k: 7, ns: [1000, 1500, 2000], looks: 40000 };
export function overRun() {
  return OVER.ns.map((n) => ({ n, ...avg((seed) => {
    const { f, newKey } = build(seed, OVER.bpk * N, OVER.k, n);
    return { rate: fpRate(f, newKey, OVER.looks), up: f.up / f.m };
  }) }));
}

// 5. Deletes: 1,000 keys, then 500 replaced one at a time (delete a stored key, add a new one). Pulling the deleted
// key's pegs down vs a counting filter.
export const DELETES = { bpk: 10, k: 7, replace: 500, looks: 40000 };
export function deletesRun() {
  const run = (counting) => avg((seed) => {
    const { f, keys, newKey } = build(seed, DELETES.bpk * N, DELETES.k, N, counting);
    const r = xorshift32(seed + 99);
    for (let j = 0; j < DELETES.replace; j++) {
      const i = Math.floor(r() * keys.length);
      f.remove(keys[i]);
      keys[i] = newKey();
      f.add(keys[i]);
    }
    const fn = keys.filter((key) => !f.has(key)).length;
    return { fn, fnShare: fn / keys.length, rate: fpRate(f, newKey, DELETES.looks), up: f.up / f.m };
  });
  return { clear: run(false), count: run(true) };
}

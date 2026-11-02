// Shared model for the figure and the experiments: a hash table.
//   A hash function turns a key into a big number; the number modulo the bucket count picks a bucket.
//   Two keys can land in the same bucket (a collision). Two ways to cope:
//     chaining: each bucket holds a list (a chain); a lookup walks the chain comparing keys.
//     linear probing (open addressing): one key per slot; a key whose slot is taken tries the next one.
//   The load factor (keys ÷ buckets) sets how long chains and probe runs get, so the table grows (doubles
//   and rehashes every key) when it passes a limit.
// Plain functions, no imports: the page inlines this file and the experiments run it in the browser.

// xorshift32; the seed is scrambled first so neighbouring seeds don't start with similar numbers.
export function rng(seed) { let s = Math.imul((seed >>> 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// ---------- hash functions ----------
// FNV-1a over the key's characters, then a finaliser (murmur3 fmix32) so every bit of the key moves the low bits.
//   "seeded": the start value mixes in a per-process secret, so outsiders can't predict where keys land.
//   "fixed":  the same function with no secret: anyone can compute it.
//   "weak":   reads only the first 4 characters, so "user:1047" and "user:9310" hash the same.
export const WEAK_CHARS = 4;
export function hashOf(key, kind = "seeded", seed = 0) {
  const text = kind === "weak" ? key.slice(0, WEAK_CHARS) : key;
  let h = (2166136261 ^ (kind === "seeded" ? Math.imul(seed | 0, 0x9e3779b1) : 0)) >>> 0;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}

// Keys: user ids "user:1000" … "user:9999", distinct, in a seeded random order.
export function userKeys(n, seed = 1) {
  const random = rng(seed), seen = new Set(), out = [];
  while (out.length < n) { const id = 1000 + Math.floor(random() * 9000); if (!seen.has(id)) { seen.add(id); out.push("user:" + id); } }
  return out;
}

// Crafted keys: someone who knows the fixed hash searches for keys whose hash ends in the same 11 bits, so they share
// a bucket in every table up to 2,048 buckets (and in any smaller power of two). Against a seeded hash they're ordinary.
export const ATTACK_BITS = 11;
export function attackKeys(n, seed = 1) {
  const mask = (1 << ATTACK_BITS) - 1, out = [];
  const random = rng(seed);
  const target = hashOf("user:0000", "fixed") & mask;
  let i = Math.floor(random() * 1e6);
  while (out.length < n) { const key = "user:" + (i++).toString(36); if ((hashOf(key, "fixed") & mask) === target) out.push(key); }
  return out;
}

// ---------- the table ----------
// mode: "chain" or "probe". grow: resize when the next key would push the load factor past maxLoad.
// growBy: "double" (×2) or a number of buckets to add. seed: the secret for the "seeded" hash.
// insert(key) and lookup(key) return a trace the figure animates: { key, home, path, probes, ... }.
//   probes = keys compared (chaining) or slots checked (probing) before the key was placed or found.
export function makeTable({ mode = "chain", hash = "seeded", grow = true, m = 8, maxLoad = 0.75, growBy = "double", seed = 1 } = {}) {
  const t = { mode, hash, grow, m, maxLoad, seed, n: 0, moved: 0, resizes: 0, work: 0, slots: null, keys: [] };
  const fresh = (size) => (mode === "chain" ? Array.from({ length: size }, () => []) : new Array(size).fill(null));
  t.slots = fresh(m);
  t.home = (key) => hashOf(key, hash, seed) % t.m;
  const place = (key) => {
    const home = t.home(key);
    if (mode === "chain") { t.slots[home].push(key); return; }
    let i = home;
    while (t.slots[i] !== null) i = (i + 1) % t.m;
    t.slots[i] = key;
  };
  t.resize = (size) => {
    const from = t.m;
    t.m = size; t.slots = fresh(size);
    t.keys.forEach(place);
    t.moved += t.n; t.resizes++; t.work += t.n;
    return { from, to: size, moved: t.n };
  };
  const nextSize = () => (growBy === "double" ? t.m * 2 : t.m + growBy);
  t.wouldResize = () => grow && (t.n + 1) / t.m > maxLoad;
  t.insert = (key) => {
    const resized = t.wouldResize() ? t.resize(nextSize()) : null;
    const home = t.home(key);
    if (mode === "chain") {
      const chain = t.slots[home];
      const probes = chain.length;                       // compare with every key already in the chain (no duplicates)
      if (chain.includes(key)) return { key, home, path: [home], probes, dup: true, resized };
      chain.push(key);
      t.n++; t.keys.push(key); t.work += probes + 1;
      return { key, home, path: [home], probes, at: chain.length - 1, resized };
    }
    if (t.n >= t.m) return { key, home, path: [], probes: 0, full: true, resized };
    const path = [home];
    let i = home;
    while (t.slots[i] !== null) { if (t.slots[i] === key) return { key, home, path, probes: path.length, dup: true, resized }; i = (i + 1) % t.m; path.push(i); }
    t.slots[i] = key;
    t.n++; t.keys.push(key); t.work += path.length;
    return { key, home, path, probes: path.length, at: i, resized };
  };
  t.lookup = (key) => {
    const home = t.home(key);
    if (mode === "chain") {
      const chain = t.slots[home], at = chain.indexOf(key);
      return { key, home, path: [home], probes: at < 0 ? chain.length : at + 1, at, found: at >= 0 };
    }
    const path = [home];
    let i = home;
    for (let steps = 0; steps < t.m; steps++) {
      if (t.slots[i] === null) return { key, home, path, probes: path.length, found: false };
      if (t.slots[i] === key) return { key, home, path, probes: path.length, at: i, found: true };
      i = (i + 1) % t.m; path.push(i);
    }
    return { key, home, path, probes: path.length, found: false };
  };
  // Summary: average and worst probes to find each stored key, longest chain (or longest run of full slots),
  // how many buckets hold anything, and the average cost of looking up a key that isn't there.
  t.stats = () => {
    let sum = 0, worst = 0, longest = 0, used = 0, miss = 0;
    if (mode === "chain") {
      t.slots.forEach((c) => { if (c.length) used++; longest = Math.max(longest, c.length); c.forEach((_, j) => { sum += j + 1; worst = Math.max(worst, j + 1); }); miss += c.length; });
      miss /= t.m;
    } else {
      t.keys.forEach((key) => { const p = t.lookup(key).probes; sum += p; worst = Math.max(worst, p); });
      used = t.n;
      // runs of full slots (wrapping round the end)
      const start = t.slots.indexOf(null);
      if (start < 0) longest = t.m;
      else { let run = 0; for (let k = 1; k <= t.m; k++) { const i = (start + k) % t.m; if (t.slots[i] !== null) { run++; longest = Math.max(longest, run); } else run = 0; } }
      // a missing key costs the run from its home slot up to and including the next empty slot
      for (let h = 0; h < t.m; h++) { let i = h, p = 1; while (t.slots[i] !== null && p <= t.m) { i = (i + 1) % t.m; p++; } miss += p; }
      miss /= t.m;
    }
    return { n: t.n, m: t.m, load: t.n / t.m, avg: t.n ? sum / t.n : 0, worst, longest, used, miss, moved: t.moved, resizes: t.resizes, work: t.work };
  };
  return t;
}

// Fill a table with keys and summarise it; also the most expensive single insert (peak) and the biggest resize.
export function fill(options, keys) {
  const t = makeTable(options);
  let peak = 0, peakAt = 0, biggest = 0;
  keys.forEach((key, i) => {
    const r = t.insert(key);
    const cost = r.probes + (r.resized ? r.resized.moved : 0);
    if (cost > peak) { peak = cost; peakAt = i + 1; }
    if (r.resized) biggest = Math.max(biggest, r.resized.moved);
  });
  return { ...t.stats(), peak, peakAt, biggest, perInsert: t.work / keys.length, table: t };
}

// Shared model for the figure and the experiments. Times are in seconds of figure time.
export const TIMING = { press: 0.15, hit: 0.3, leg: 0.7, drawer: 0.3, transfer: 0.35, place: 0.3, gap: 0.25 };
export const HIT_TIME = TIMING.press + TIMING.hit + TIMING.gap;
export const MISS_TIME = TIMING.press + TIMING.leg * 2 + TIMING.drawer + TIMING.transfer + TIMING.place + TIMING.gap;
export const RECORDS = 40;
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function pickRecord(random, traffic) {
  return traffic === "even" ? 1 + Math.floor(random() * RECORDS) : 1 + Math.floor(RECORDS * Math.pow(random(), 5));
}
// Cache: Map record -> { version, expires, used }. Archive: versions.
export function makeCache(slots) { return { slots, cards: new Map() }; }
export function lookup(cache, record, now) {
  const card = cache.cards.get(record);
  if (card && card.expires <= now) { cache.cards.delete(record); return null; }
  if (card) card.used = now;
  return card || null;
}
export function store(cache, record, version, now, ttl) {
  let evicted = null;
  if (!cache.cards.has(record) && cache.cards.size >= cache.slots) {
    for (const [r, c] of cache.cards) if (c.expires <= now) cache.cards.delete(r);
    if (cache.cards.size >= cache.slots) {
      let oldest = null;
      for (const [r, c] of cache.cards) if (!oldest || c.used < oldest[1].used) oldest = [r, c];
      evicted = oldest[0]; cache.cards.delete(evicted);
    }
  }
  cache.cards.set(record, { version, expires: now + ttl, used: now });
  return evicted;
}
// Run n requests headless. events: [{ at: requestIndex, do: "flush" | "change" }]
// Average several seeded runs so one lucky sequence does not decide an experiment.
export function average(options, seeds = [3, 5, 7, 11, 13, 17]) {
  const runs = seeds.map((seed) => runHeadless({ ...options, seed }));
  const mean = (f) => runs.reduce((s, r) => s + f(r), 0) / runs.length;
  return { hitRate: mean((r) => r.hitRate), avgTime: mean((r) => r.avgTime), stale: mean((r) => r.stale), runs };
}
export function runHeadless({ ttl = 30, slots = 12, traffic = "popular", invalidate = false, n = 3000, seed = 7, events = [], warm = 0 }) {
  const random = rng(seed); const cache = makeCache(slots); const versions = new Array(RECORDS + 1).fill(1);
  let now = 0; const log = [];
  for (let i = 0; i < n + warm; i++) {
    for (const e of events) if (e.at === i - warm) {
      if (e.do === "flush") cache.cards.clear();
      if (e.do === "change") { versions[e.record] += 1; if (invalidate) cache.cards.delete(e.record); }
    }
    const record = pickRecord(random, traffic);
    const card = lookup(cache, record, now);
    let hit = !!card, stale = false, time;
    if (card) { stale = card.version < versions[record]; time = HIT_TIME; }
    else { time = MISS_TIME; store(cache, record, versions[record], now + MISS_TIME - TIMING.gap, ttl); }
    now += time;
    if (i >= warm) log.push({ record, hit, stale, time });
  }
  const hits = log.filter((r) => r.hit).length;
  return { log, hits, n: log.length, hitRate: hits / log.length, avgTime: log.reduce((s, r) => s + r.time, 0) / log.length, stale: log.filter((r) => r.stale).length };
}

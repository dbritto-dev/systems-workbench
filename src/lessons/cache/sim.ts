// @ts-nocheck: model code ported as-is; shared helpers come from src/lib.
// Shared model for the figure and the experiments. Times are in seconds of figure time.
import { rng } from "../../lib/random";
import { averageOver, meanBy } from "../../lib/stats";

export const TIMING = { press: 0.15, hit: 0.3, leg: 0.7, drawer: 0.3, transfer: 0.35, place: 0.3, gap: 0.25 };
export const HIT_TIME = TIMING.press + TIMING.hit + TIMING.gap;
export const MISS_TIME = TIMING.press + TIMING.leg * 2 + TIMING.drawer + TIMING.transfer + TIMING.place + TIMING.gap;
export const RECORDS = 40;
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
  return averageOver(seeds, (seed) => { const r = runHeadless({ ...options, seed }); return { hitRate: r.hitRate, avgTime: r.avgTime, stale: r.stale }; });
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
  return { log, hits, n: log.length, hitRate: hits / log.length, avgTime: meanBy(log, (r) => r.time), stale: log.filter((r) => r.stale).length };
}

// ---------- the experiments (computed at build time; the page used to run them in the browser on click) ----------
const SEEDS = [3, 5, 7, 11, 13, 17];
const avg = (o) => average({ warm: 300, n: 1500, ...o }, SEEDS);
// The average request time over requests from..to (after the warm-up), averaged over 120 seeds.
function windowWait(o, from, to) {
  return averageOver(Array.from({ length: 120 }, (_, i) => i + 1), (seed) => {
    const r = runHeadless({ ttl: 60, warm: 300, n: to, seed, ...o });
    return { w: r.log.slice(from, to).reduce((a, x) => a + x.time, 0) / (to - from) };
  }).w;
}
// Of the rack's reads of #1 right after #1 changes, the share that served the old version (120 seeds).
function staleShare(invalidate) {
  let stale = 0, reads = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const r = runHeadless({ ttl: 60, warm: 300, n: 30, seed, invalidate, events: [{ at: 0, do: "change", record: 1 }] });
    const l = r.log.filter((x) => x.record === 1 && x.hit); reads += l.length; stale += l.filter((x) => x.stale).length;
  }
  return reads ? stale / reads : 0;
}
export function experimentResults() {
  const base = avg({ ttl: 60 });
  const pick = ({ hitRate, avgTime }) => ({ hitRate, avgTime });
  return {
    base: pick(base),
    ttl: pick(avg({ ttl: 6 })),
    size: pick(avg({ ttl: 60, slots: 4 })),
    even: pick(avg({ ttl: 60, traffic: "even" })),
    flush: { warm: windowWait({}, 0, 10), first: windowWait({ events: [{ at: 0, do: "flush" }] }, 0, 10), later: windowWait({ events: [{ at: 0, do: "flush" }] }, 10, 30) },
    stale: { off: staleShare(false), on: staleShare(true) },
  };
}

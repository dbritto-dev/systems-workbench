// @ts-nocheck: model code ported as-is; shared helpers come from src/lib.
// Shared model for the figure and the experiments: how long work takes depending on where its data lives.
// Every operation is a trip from the CPU to a "station" (a cache, memory, a drive, another machine) and back.
// The latencies are the classic orders of magnitude from "Latency numbers every programmer should know"
// (Jeff Dean and Peter Norvig, as collected by Jonas Bonér, ~2012 values). Real hardware varies, often by a lot;
// what holds is the gap between levels: each step out costs one to three orders of magnitude.
// Shared by the page (experiment results at build time) and the live code.
import { rng, normal } from "../../lib/random";

// The stations, nearest first. ns: one trip there and back. jitter: spread of one trip (lognormal sigma).
export const STATIONS = [
  { id: "l1", ns: 0.5, jitter: 0.02 },          // L1 cache reference
  { id: "l2", ns: 7, jitter: 0.05 },            // L2 cache reference
  { id: "ram", ns: 100, jitter: 0.08 },         // main memory reference
  { id: "ssd", ns: 150e3, jitter: 0.25 },       // read 4 KB at random from an SSD
  { id: "dc", ns: 500e3, jitter: 0.3 },         // round trip to another machine in the same datacenter
  { id: "disk", ns: 10e6, jitter: 0.3 },        // disk seek (a spinning drive moving its head)
  { id: "wan", ns: 150e6, jitter: 0.06 },       // round trip California → Netherlands → California
];
export const STATION = Object.fromEntries(STATIONS.map((s) => [s.id, s]));
// Other rows of the same table the jobs use.
export const MB_RAM_SEQ = 250e3;     // read 1 MB sequentially from memory
export const MB_SSD_SEQ = 1e6;       // read 1 MB sequentially from an SSD
export const MB_DISK_SEQ = 20e6;     // read 1 MB sequentially from a spinning disk
export const KB_NET = 10e3;          // send 1 KB over a 1 Gbps network

// A mean-preserving lognormal factor from a gaussian draw (Box–Muller; rng never returns 0, so normal() draws the
// same numbers the original redraw-on-zero gaussian did).
const spread = (r, sigma) => (sigma ? Math.exp(sigma * normal(r) - (sigma * sigma) / 2) : 1);

// A job is a list of legs: `count` trips to `station`, each taking `each` ns on average (more than the station's own
// latency when the trip also carries data), `wide` of them in flight at once (a leg in waves of `wide` waits for
// the slowest of each wave). `note` names the leg for the readout.
export const JOBS = {
  lookups: { hows: ["ram", "dc", "wan"], legs: (how) => [{ station: how, count: 100, each: STATION[how].ns, note: "lookup" }] },
  read: {
    hows: ["ssd-seq", "ssd-rand", "disk-seq", "disk-rand"],
    legs: (how) => {
      const [dev, pat] = how.split("-");
      if (pat === "seq") return [
        ...(dev === "disk" ? [{ station: "disk", count: 1, each: STATION.disk.ns, note: "seek" }] : []),
        { station: dev, count: 100, each: dev === "disk" ? MB_DISK_SEQ : MB_SSD_SEQ, note: "mb" },
      ];
      return [{ station: dev, count: 25600, each: STATION[dev].ns, note: "block" }];   // 100 MB in 4 KB pieces
    },
  },
  sum: {
    hows: ["array", "list"],
    legs: (how) => how === "array"
      // 1 million 4-byte numbers = 4 MB, streamed: the prefetcher fetches the next lines while the CPU adds these
      ? [{ station: "ram", count: 62500, each: (4 * MB_RAM_SEQ) / 62500, note: "line", stream: true }]
      // 1 million nodes scattered in memory: each address is in the node before, so every fetch waits for the last
      : [{ station: "ram", count: 1e6, each: STATION.ram.ns, note: "node" }],
  },
  batch: {
    hows: ["one", "ten", "batch"],
    legs: (how) => how === "one" ? [{ station: "wan", count: 100, each: STATION.wan.ns + KB_NET, note: "call" }]
      : how === "ten" ? [{ station: "wan", count: 100, wide: 10, each: STATION.wan.ns + KB_NET, note: "call" }]
      : [{ station: "wan", count: 1, each: STATION.wan.ns + 100 * KB_NET, note: "batch" }],
  },
  // One transfer overseas on a connection that's already open and at full speed: one round trip to ask, then the
  // bytes stream at 1 Gbps (10 µs a KB). Slow start on a fresh connection would add round trips; this leaves it out.
  send: {
    hows: ["kb", "mb", "gb"],
    legs: (how) => {
      const kb = how === "kb" ? 1 : how === "mb" ? 10e3 : 1e6;   // 1 KB, 10 MB, 1 GB
      return [{ station: "wan", count: 1, each: STATION.wan.ns, note: "trip" }, { station: "wan", count: 1, each: kb * KB_NET, note: "send" }];
    },
  },
  page: {
    hows: ["primary", "replica", "cache"],
    legs: (how) => [{ station: how === "primary" ? "wan" : how === "replica" ? "dc" : "ram", count: 20, each: STATION[how === "primary" ? "wan" : how === "replica" ? "dc" : "ram"].ns, note: "read" }],
  },
};

// Run a job once. Returns the total in ns, the time per station, and the trips per leg (with their sampled
// durations for the first trips, which the figure animates).
export function runJob(job, how, seed = 1, keep = 40) {
  const r = rng(seed);
  const legs = JOBS[job].legs(how);
  const by = Object.fromEntries(STATIONS.map((s) => [s.id, 0]));
  let total = 0, trips = 0;
  const shown = [], legTotals = [];
  for (const leg of legs) {
    const sigma = leg.stream ? 0.02 : STATION[leg.station].jitter;
    const wide = leg.wide || 1;
    let legTotal = 0;
    for (let i = 0; i < leg.count; i += wide) {
      let wave = 0;
      for (let j = 0; j < wide && i + j < leg.count; j++) wave = Math.max(wave, leg.each * spread(r, sigma));
      legTotal += wave;
      if (shown.length < keep) shown.push({ station: leg.station, ns: wave, note: leg.note, wide: Math.min(wide, leg.count - i) });
    }
    by[leg.station] += legTotal;
    legTotals.push(legTotal);
    total += legTotal;
    trips += leg.count;
  }
  return { total, by, trips, legs: legs.map((l, i) => ({ station: l.station, count: l.count, each: l.each, wide: l.wide || 1, note: l.note, total: legTotals[i] })), shown };
}

// The same job averaged over seeds (the experiments use 8).
export function avgJob(job, how, seeds = 8) {
  let total = 0;
  const by = Object.fromEntries(STATIONS.map((s) => [s.id, 0]));
  let trips = 0;
  for (let s = 1; s <= seeds; s++) {
    const o = runJob(job, how, s * 7919, 0);
    total += o.total / seeds; trips = o.trips;
    for (const k in by) by[k] += o.by[k] / seeds;
  }
  return { total, by, trips };
}

// Human scale: stretch time so an L1 hit (0.5 ns) takes one second, i.e. multiply by 2 billion.
// Returns [value, unit] with unit one of s, min, h, d, mo, y.
export function human(ns) {
  const s = ns * 2;   // ns × 2e9 / 1e9 seconds
  const units = [["y", 365.25 * 86400], ["mo", 30.44 * 86400], ["d", 86400], ["h", 3600], ["min", 60], ["s", 1]];
  for (const [u, size] of units) if (s >= size) return [s / size, u];
  return [s, "s"];
}

// A duration in ns, with three significant figures in the unit that fits: 0.5 → "0.50 ns", 120000 → "120 µs".
const sig = (v) => (v === 0 ? "0" : v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
export function fmt(ns) {
  if (ns < 999.5) return sig(ns) + " ns";
  if (ns < 999.5e3) return sig(ns / 1e3) + " µs";
  if (ns < 999.5e6) return sig(ns / 1e6) + " ms";
  return sig(ns / 1e9) + " s";
}

// ---------- experiments: computed once at build time from the same model ----------
export function chattyRun() { return { ram: avgJob("lookups", "ram"), dc: avgJob("lookups", "dc"), wan: avgJob("lookups", "wan") }; }
export function readRun() { return Object.fromEntries(JOBS.read.hows.map((h) => [h, avgJob("read", h)])); }
export function sumRun() { return { array: avgJob("sum", "array"), list: avgJob("sum", "list") }; }
export function batchRun() { return { one: avgJob("batch", "one"), ten: avgJob("batch", "ten"), batch: avgJob("batch", "batch") }; }
export function pageRun() { return { primary: avgJob("page", "primary"), replica: avgJob("page", "replica"), cache: avgJob("page", "cache") }; }
// The send job, split into the round trip and the time spent sending the bytes.
export function sendRun() {
  const one = (how) => {
    let trip = 0, send = 0;
    for (let s = 1; s <= 8; s++) { const o = runJob("send", how, s * 7919, 0); trip += o.legs[0].total / 8; send += o.legs[1].total / 8; }
    return { trip, send, total: trip + send };
  };
  return { kb: one("kb"), mb: one("mb"), gb: one("gb") };
}

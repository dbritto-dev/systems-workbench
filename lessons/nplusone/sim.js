// Shared model for the figure and the experiments: one page of an orders list, loaded four ways.
// Times are milliseconds of model time. Every query is a round trip: half the network trip out,
// the database's work, half the trip back plus the time to ship the bytes, plus a little app overhead.
export const RTT = { host: 0.2, zone: 1, region: 10 };          // round-trip time to the database, ms
export const DIST_NAMES = { host: "same host", zone: "same zone", region: "other zone" };
export const BYTES = { order: 800, item: 120, product: 300 };    // bytes per row of each table
export const SERVER = { base: 0.15, perRow: 0.002 };             // database time per query, ms
export const BANDWIDTH = 60000;                                  // bytes per ms on the wire (about 480 Mbit/s)
export const APP = 0.03;                                         // app overhead per query (driver, ORM), ms
export const POOL = 5;                                           // connections used by "N+1, 5 at once"

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// cfg: { mode: "n1" | "par" | "batch" | "join", rows, items (per order), nested (also each item's product), dist: "host" | "zone" | "region" }
// Returns the page as a list of trips (queries) with their timings, when each row on the page is complete,
// and totals. Each trip: { q, lane, kind, row, rows, bytes, t0, arrive, done, back }.
export function planPage(cfg, seed = 7) {
  const random = rng(seed);
  const rtt = RTT[cfg.dist];
  const { rows, items, nested } = cfg;
  const trips = [];
  const fillAt = new Array(rows).fill(0);
  const lanes = cfg.mode === "par" ? POOL : 1;
  const free = new Array(lanes).fill(0);

  // One query on a lane, starting no earlier than `ready`.
  function query(kind, row, nRows, bytes, ready, lane = 0) {
    const r = rtt * (0.9 + 0.35 * random());
    const t0 = Math.max(ready, free[lane]);
    const arrive = t0 + r / 2;
    const done = arrive + SERVER.base + SERVER.perRow * nRows;
    const back = done + r / 2 + bytes / BANDWIDTH;
    const trip = { q: trips.length, lane, kind, row, rows: nRows, bytes, t0, arrive, done, back };
    trips.push(trip);
    free[lane] = back + APP;
    return trip;
  }

  let listAt;
  if (cfg.mode === "join") {
    // One query: every order joined to every item (and product). Each result row repeats the order's columns.
    const per = BYTES.order + BYTES.item + (nested ? BYTES.product : 0);
    const t = query("join", -1, rows * items, rows * items * per, 0);
    listAt = t.back;
    fillAt.fill(t.back);
  } else {
    const list = query("list", -1, rows, rows * BYTES.order, 0);
    listAt = list.back;
    if (cfg.mode === "batch") {
      // WHERE order_id IN (...all ids on the page...), then WHERE id IN (...all product ids...).
      let t = query("items", -1, rows * items, rows * items * BYTES.item, list.back + APP);
      if (nested) t = query("products", -1, rows * items, rows * items * BYTES.product, t.back + APP);
      fillAt.fill(t.back);
    } else {
      // One query per order for its items, then (nested) one query per item for its product.
      // "par" runs them on a pool of connections: each job takes the lane that frees up first.
      const jobs = [];
      for (let r = 0; r < rows; r++) jobs.push({ kind: "items", row: r, ready: list.back + APP });
      const pending = new Array(rows).fill(nested ? items : 0);
      while (jobs.length) {
        let j = 0;
        if (lanes > 1) for (let i = 1; i < jobs.length; i++) if (jobs[i].ready < jobs[j].ready) j = i;
        const job = jobs.splice(j, 1)[0];
        let lane = 0;
        for (let l = 1; l < lanes; l++) if (free[l] < free[lane]) lane = l;
        const bytes = job.kind === "items" ? items * BYTES.item : BYTES.product;
        const t = query(job.kind, job.row, job.kind === "items" ? items : 1, bytes, job.ready, lane);
        if (job.kind === "items") {
          if (nested) for (let i = 0; i < items; i++) jobs.splice(lanes > 1 ? jobs.length : i, 0, { kind: "products", row: job.row, ready: t.back + APP });
          else fillAt[job.row] = t.back;
        } else if (--pending[job.row] === 0) fillAt[job.row] = t.back;
      }
    }
  }
  const end = Math.max(...trips.map((t) => t.back)) + APP;
  const bytes = trips.reduce((s, t) => s + t.bytes, 0);
  return { cfg, trips, fillAt, listAt, end, queries: trips.length, bytes, lanes };
}

// Averages over seeded pages, for the experiments.
export function average(cfg, seeds = 8) {
  let time = 0, queries = 0, bytes = 0;
  for (let s = 1; s <= seeds; s++) { const p = planPage(cfg, s * 7919); time += p.end; queries += p.queries; bytes += p.bytes; }
  return { time: time / seeds, queries: queries / seeds, bytes: bytes / seeds };
}

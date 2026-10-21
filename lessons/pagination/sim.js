// Offset vs cursor pagination over a table ordered newest first (created_at DESC, id DESC).
// One model for the figure and the experiments: a reader fetches pages while rows are inserted at the front
// and deleted from the region being paged. Every query sees the table as it is when the query runs.
export const SEEK = 14;         // rows of work for an index seek (about log2 of a 16k-row table)

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// cfg: { mode: "offset" | "cursor", pageSize, pages, rows0, batch, insertRate, deleteRate, keyUnique, think, stepTime, startAt, firstPage }
// firstPage > 1 jumps there: offset asks for that page directly, cursor has to walk every page before it.
export function makeRun(cfg, seed = 1) {
  const random = rng(seed);
  const wait = (rate) => (rate > 0 ? -Math.log(1 - random()) / rate : Infinity);
  const N = cfg.pageSize;
  const rows = [];
  for (let id = cfg.rows0; id >= 1; id--) rows.push({ id, ts: Math.floor((id - 1) / (cfg.batch || 1)) });
  let nextId = cfg.rows0 + 1;
  let maxTs = rows.length ? rows[0].ts : 0;
  const startMax = cfg.rows0;
  const seen = new Map();
  const deleted = new Set();
  let nextInsert = (cfg.startAt || 0) + wait(cfg.insertRate);
  let nextDelete = (cfg.startAt || 0) + wait(cfg.deleteRate);
  let nextQuery = cfg.startAt || 0;
  const firstPage = cfg.firstPage || 1;
  const lastPage = firstPage - 1 + cfg.pages;
  let page = cfg.mode === "offset" ? firstPage - 1 : 0, cursor = null, done = false, minSeen = Infinity;
  const totals = { rowsRead: 0, roundTrips: 0, duplicates: 0, inserts: 0, deletes: 0 };

  function missingNow() {
    if (minSeen === Infinity) return 0;
    let n = 0;
    for (let id = minSeen; id <= startMax; id++) if (!seen.has(id) && !deleted.has(id)) n++;
    return n;
  }

  function insert(t, on) {
    const row = { id: nextId++, ts: ++maxTs };
    rows.unshift(row);
    totals.inserts++;
    on && on({ type: "insert", t, id: row.id, ts: row.ts });
  }

  function remove(t, on) {
    const window = Math.min(rows.length, N * cfg.pages);
    if (!window) return;
    const index = Math.floor(random() * window);
    const [row] = rows.splice(index, 1);
    deleted.add(row.id);
    totals.deletes++;
    on && on({ type: "delete", t, id: row.id, index });
  }

  function query(t, on) {
    page++;
    let start, cost;
    if (cfg.mode === "offset") {
      start = (page - 1) * N;
      cost = Math.min(rows.length, start + N);
    } else {
      start = 0;
      if (cursor) {
        start = rows.findIndex((r) => (cfg.keyUnique ? r.ts < cursor.ts || (r.ts === cursor.ts && r.id < cursor.id) : r.ts < cursor.ts));
        if (start < 0) start = rows.length;
      }
      cost = (cursor ? SEEK : 0) + Math.min(N, rows.length - start);
    }
    const list = rows.slice(start, start + N);
    if (cfg.mode === "cursor" && list.length) { const last = list[list.length - 1]; cursor = { ts: last.ts, id: last.id }; }
    const dups = [];
    for (const r of list) {
      if (seen.has(r.id)) { dups.push(r.id); totals.duplicates++; }
      seen.set(r.id, (seen.get(r.id) || 0) + 1);
      if (r.id <= startMax) minSeen = Math.min(minSeen, r.id);
    }
    totals.rowsRead += cost;
    totals.roundTrips++;
    const duration = cost * cfg.stepTime;
    const walking = page < firstPage;
    const event = { type: "query", t, page, ids: list.map((r) => r.id), startIndex: start, skipped: cfg.mode === "offset" ? start : 0, cost, duration, dups, walking, missing: missingNow(), cursor: cursor && { ...cursor } };
    on && on(event);
    nextQuery = t + duration + (walking ? 0.15 : cfg.think);
    if (page >= lastPage || !list.length) done = true;
  }

  // Process every event up to time T, in time order.
  function advanceTo(T, on) {
    for (;;) {
      const tq = done ? Infinity : nextQuery;
      const t = Math.min(nextInsert, nextDelete, tq);
      if (t > T || t === Infinity) return;
      if (t === nextInsert) { insert(t, on); nextInsert = t + wait(cfg.insertRate); }
      else if (t === nextDelete) { remove(t, on); nextDelete = t + wait(cfg.deleteRate); }
      else query(t, on);
    }
  }

  function runToEnd() { while (!done) advanceTo(nextQuery, null); return summary(); }
  function summary() { return { ...totals, missing: missingNow(), pages: page }; }

  return { rows, advanceTo, runToEnd, summary, get done() { return done; }, get page() { return page; }, get cursor() { return cursor; }, get nextQuery() { return nextQuery; }, seen };
}

// Experiments: averaged over several seeded readers.
export function average(cfg, seeds = [3, 5, 7, 11, 13, 17, 19, 23]) {
  const runs = seeds.map((seed) => makeRun(cfg, seed).runToEnd());
  const mean = (k) => runs.reduce((s, r) => s + r[k], 0) / runs.length;
  return { duplicates: mean("duplicates"), missing: mean("missing"), rowsRead: mean("rowsRead"), roundTrips: mean("roundTrips"), inserts: mean("inserts"), deletes: mean("deletes") };
}

// Rows of work and round trips to fetch one page deep in a large table.
export function pageCost(mode, pageNo, pageSize) {
  return mode === "offset" ? (pageNo - 1) * pageSize + pageSize : (pageNo > 1 ? SEEK : 0) + pageSize;
}
export function jumpCost(mode, pageNo, pageSize) {
  if (mode === "offset") return { rows: pageNo * pageSize, trips: 1 };
  let rows = 0;
  for (let p = 1; p <= pageNo; p++) rows += pageCost("cursor", p, pageSize);
  return { rows, trips: pageNo };
}

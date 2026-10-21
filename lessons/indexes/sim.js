// The cost model shared by the figure and the experiments. Times are model milliseconds.
// Rows live 100 to a page. Reading the next page of a full scan is sequential (cheap);
// every catalogue level, catalogue leaf page and trip to a shelf is a random page read.
export const SEQ = 0.1;
export const RAND = 0.4;
export const ROWS_PER_PAGE = 100;
export const FANOUT = 100;
export const AUTHORS = 2000;
export const YEARS = 76;
export const LOAN_SHARE = 0.4;
export const ROW_OPTIONS = [1000, 10000, 100000];

export const INDEXES = [
  { id: "isbn", cols: ["isbn"], covers: [], label: "ISBN" },
  { id: "author", cols: ["author"], covers: [], label: "Author" },
  { id: "authorYear", cols: ["author", "year"], covers: [], label: "Author, year" },
  { id: "loan", cols: ["loan"], covers: [], label: "On loan" },
  { id: "authorTitle", cols: ["author"], covers: ["title"], label: "Author + title" },
];

export const QUERIES = {
  isbn: { filters: ["isbn"], wants: "row", label: "ISBN = 978-0-441-…" },
  author: { filters: ["author"], wants: "row", label: "author = Le Guin" },
  year: { filters: ["year"], wants: "row", label: "year = 1969" },
  authorYear: { filters: ["author", "year"], wants: "row", label: "author = Le Guin and year = 1969" },
  loan: { filters: ["loan"], wants: "row", label: "on loan = yes" },
  titles: { filters: ["author"], wants: "title", label: "titles by Le Guin" },
};

export function matchesFor(cols, rows) {
  const key = [...cols].sort().join("+");
  if (key === "isbn") return 1;
  if (key === "author") return Math.max(1, Math.round(rows / AUTHORS));
  if (key === "year") return Math.max(1, Math.round(rows / YEARS));
  if (key === "author+year") return Math.max(1, Math.round(rows / AUTHORS / YEARS));
  if (key === "loan") return Math.round(rows * LOAN_SHARE);
  return rows;
}

export const levels = (rows) => Math.max(1, Math.ceil(Math.log(rows) / Math.log(FANOUT) - 1e-9));
export const scanPages = (rows) => Math.ceil(rows / ROWS_PER_PAGE);
export const scanCost = (rows) => scanPages(rows) * SEQ;

// The leading columns of an index that the query filters on. An index is usable only if its first column is filtered.
export function prefixOf(index, query) {
  const prefix = [];
  for (const col of index.cols) { if (query.filters.includes(col)) prefix.push(col); else break; }
  return prefix;
}

export function covers(index, query) {
  return query.wants === "title" && index.covers.includes("title");
}

export function indexPlan(index, query, rows) {
  const prefix = prefixOf(index, query);
  if (!prefix.length) return null;
  const found = matchesFor(prefix, rows);
  const drawerReads = levels(rows) + Math.max(0, Math.ceil(found / FANOUT) - 1);
  const shelfTrips = covers(index, query) ? 0 : found;
  return { kind: covers(index, query) ? "covering" : "index", index: index.id, found, drawerReads, shelfTrips, reads: drawerReads + shelfTrips, cost: (drawerReads + shelfTrips) * RAND };
}

export function plans(queryId, rows, on) {
  const query = QUERIES[queryId];
  const all = [{ kind: "scan", index: null, found: matchesFor(query.filters, rows), drawerReads: 0, shelfTrips: 0, reads: scanPages(rows), cost: scanCost(rows) }];
  for (const index of INDEXES) if (on.includes(index.id)) { const p = indexPlan(index, query, rows); if (p) all.push(p); }
  return all;
}

// The planner takes the cheapest plan; a tie goes to the scan.
export function choose(queryId, rows, on) {
  const all = plans(queryId, rows, on);
  return all.reduce((best, p) => (p.cost < best.cost - 1e-9 ? p : best), all[0]);
}

// Adding a book: write it to a shelf page, then file one card in every catalogue (walk down its levels, write the leaf).
export const insertReads = (rows, indexCount) => 1 + indexCount * (levels(rows) + 1);
export const insertCost = (rows, indexCount) => insertReads(rows, indexCount) * RAND;

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

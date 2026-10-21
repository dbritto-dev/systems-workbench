// Systems lesson 11 · Database indexes. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, P, GEOMETRY, needleAt } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "grow",
    title: "The table grows ten times",
    change: "10,000 → 100,000 rows · query ISBN = … · a catalogue on ISBN",
    question: "A full scan gets about 10× slower. How much slower does the lookup through the ISBN catalogue get?",
    options: ["About 10× slower too", "Barely slower: one more drawer level", "It gets faster, the catalogue has more cards to choose from"],
    answer: 1,
    why: "A catalogue is a tree: each drawer level narrows the search 100 ways. 10,000 cards need 2 levels and 100,000 need 3, so the lookup only grows by one drawer read. A scan has no shortcut: ten times the rows is ten times the pages.",
    watch: { rows: 100000, query: "isbn", on: ["isbn"], writes: false },
  },
  {
    id: "writes",
    title: "A third catalogue",
    change: "100,000 rows · catalogues: ISBN → ISBN, author, author + year · adding books",
    question: "You add two more catalogues so more queries are fast. What happens to adding a new book?",
    options: ["Nothing: catalogues only matter when you read", "It gets slower: the new book needs a card filed in every catalogue", "It gets faster: the catalogues say where to shelve it"],
    answer: 1,
    why: "Every catalogue has to stay in sync with the shelves, so every insert walks down each catalogue and files a card, and every update to an indexed column moves one. Indexes are paid for on every write, whether or not anyone runs the queries they help.",
    watch: { rows: 100000, query: "isbn", on: ["isbn", "author", "authorYear"], writes: true },
  },
  {
    id: "prefix",
    title: "The wrong end of a composite",
    change: "100,000 rows · one catalogue sorted by author, then year · query: year = 1969",
    question: "The catalogue holds year on every card. What does the librarian do for a year-only search?",
    options: ["Use the catalogue: year is on the cards", "Walk every shelf: the cards are sorted by author first", "Use the catalogue, but read only half of it"],
    answer: 1,
    why: "A composite index is sorted by its first column, then by the second within each first. Cards for 1969 are spread across every author, so there is no place to jump to. It helps queries on author, or author and year, but not year alone: the leftmost-prefix rule.",
    watch: { rows: 100000, query: "year", on: ["authorYear"], writes: false },
  },
  {
    id: "selective",
    title: "An index on a yes/no column",
    change: "100,000 rows · a catalogue on 'on loan' · 4 in 10 books are on loan",
    question: "You ask for every book that is on loan. What does the planner choose?",
    options: ["The catalogue: an index always beats a scan", "A full scan: 40,000 separate shelf trips would cost far more", "It refuses: the query matches too many rows"],
    answer: 1,
    why: "An index pays one random trip to the shelf per matching row. When a large share of rows match, those trips cost far more than reading every page in order. Planners estimate this and pick the scan. Indexes pay off on selective filters: few rows out of many.",
    watch: { rows: 100000, query: "loan", on: ["loan"], writes: false },
  },
  {
    id: "covering",
    title: "The title is on the card",
    change: "100,000 rows · titles by one author · catalogue on author → catalogue on author that also carries the title",
    question: "How much does it help when the card already carries the title?",
    options: ["A little: the trolley still visits the shelves", "A lot: no trips to the shelves at all", "Not at all: it still reads the same cards"],
    answer: 1,
    why: "A plain index finds the 50 matching cards in a few drawer reads, then makes 50 trips to the shelves to read each title. When the card carries everything the query needs, the answer comes straight from the catalogue: an index-only scan. The price is a bigger catalogue that every write must also update.",
    watch: { rows: 100000, query: "titles", on: ["author"], writes: false, then: ["authorTitle"] },
  },
];

const QUESTIONS = [
  ["A table grows from 1 million to 100 million rows. Why does a lookup by primary key barely slow down while a full scan gets 100 times slower?",
    "The index is a B-tree: each level narrows the search by its fan-out (hundreds of keys per page), so the number of levels grows with the logarithm of the row count: maybe 3 levels become 4. A scan has to read every page, so its cost grows in direct proportion to the table."],
  ["A write-heavy table already has eight indexes. What do you check before adding a ninth?",
    "Every insert, and every update that touches an indexed column, writes to every index, so writes slow down and the indexes take memory and disk. Check which queries the new index serves and how often, and whether an existing index could be extended instead. Find indexes nobody uses (in Postgres, idx_scan = 0 in pg_stat_user_indexes) and drop them."],
  ["You have an index on (author, year). Which of these can use it: author = ?, author = ? AND year = ?, year = ?, author = ? ORDER BY year?",
    "All except year = ? alone. A composite index is sorted by its first column, then the next, so it serves any query that fixes a leftmost prefix, and it can also return rows already ordered by the next column. For year alone you need a separate index on year, or one that starts with year."],
  ["The database ignores your index on status, which has four values. Why, and what would help?",
    "Each value matches about a quarter of the table, and an index scan pays one random page read per matching row, so a sequential scan is cheaper and the planner picks it. If you only ever query a rare value (status = 'failed'), a partial index on just those rows is small and selective."],
  ["What is a covering index, and what does it cost?",
    "An index that holds every column a query reads, so the database answers from the index without visiting the table (an index-only scan; in Postgres, INCLUDE adds non-key columns). It costs a larger index and more work on every write, so use it for hot queries, not by default."],
  ["How do you check whether a query uses an index, and whether that is the right plan?",
    "Run EXPLAIN (ANALYZE, BUFFERS) on it. Look for Seq Scan versus Index Scan or Index Only Scan, compare estimated and actual rows (bad estimates lead to bad plans), and look at the pages read. Then test with realistic data volumes: a plan on a small dev table can differ from production."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Library",
  keys: [
    { mark: "lit", label: "The card being read, the numbered bookcase it points to, and the route and book" },
    { mark: "raised", label: "Bookcases 1–8: the table, books in the order they arrived" },
    { mark: "flat", label: "Catalogue cabinets: one per index, the column engraved on the lid, cards sorted in the open drawer" },
  ],
  caption:
    "The trolley either walks past every bookcase (a full scan: 0.1 ms per page of 100 books) or opens a catalogue drawer and goes straight to the shelf (0.4 ms per drawer level or shelf trip). The counter beside the shelves tallies books checked, drawer reads, shelf trips or cards filed. The stopwatch shows the time the reading takes, one turn per 10 ms; the machine runs 1,000 times slower than the model, and the walks between areas are not counted.",
  stage: 'data-library aria-label="Library simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const CAT_LABELS = [["isbn", "ISBN"], ["author", "Author"], ["authorYear", "Author, year"], ["loan", "On loan"], ["authorTitle", "Author + title"]];
const controls = panel({
  stats: [["rows", "Rows", "10,000"], ["plan", "Plan", "–"], ["time", "Query time", "–"], ["reads", "Pages read", "–"], ["insert", "Add a book", "–"], ["cats", "Catalogues", "1"]],
  controls: [
    seg("rows", "Rows", [[1000, "1,000"], [10000, "10,000"], [100000, "100,000"]], 10000),
    seg("query", "Query", [["isbn", "ISBN"], ["author", "Author"], ["year", "Year"], ["authorYear", "Author + year"], ["loan", "On loan"], ["titles", "Titles by author"]], "isbn"),
    `<div class="control"><span>Catalogues (indexes)</span><div class="seg" role="group" aria-label="Catalogues">${CAT_LABELS.map(([v, t]) => `<button type="button" data-set="idx" data-value="${v}" aria-pressed="${v === "isbn"}">${t}</button>`).join("")}</div></div>`,
    seg("writes", "New books arriving", [["false", "Off"], ["true", "On"]], "false"),
    speedSeg(),
    actions("Do something", [["restart", "Restart"], ["pause", "Pause"]]),
  ],
});

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, options, watch }) => ({ id, answer, options, watch })))};
const needleAt = ${needleAt.toString().replace(/k\.lineOnTop/g, "lineOnTop")};
const DIAL = G.DIAL;
const SCALE = 1;

const stage = document.querySelector("[data-library]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const qa = (s) => [...svg.querySelectorAll(s)];
const readout = document.querySelector("[data-readout]");
const trolleyEl = q("[data-trolley]"), fly = q("[data-fly]"), needle = q("[data-needle]"), newBook = q("[data-newbook]");
const onShelfEl = q("[data-onshelf]"), routeEl = q("[data-route]"), backSlot = q("[data-back]"), frontSlot = q("[data-front]");
const countLabel = q("[data-count-label]"), countEl = q("[data-count]");
const lamp = q("[data-lamp] .iso-solid");
const cabEls = G.CABS.map((_, i) => qa('[data-cab="' + i + '"]'));
const cardEls = G.CABS.map((_, i) => q('[data-card="' + i + '"]'));
const drawerEls = G.CABS.map((_, i) => q('[data-drawer="' + i + '"] .iso-solid'));
const tagEls = G.CASES.map((_, i) => q('[data-tag="' + i + '"]'));
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));

const cfg = { rows: 10000, query: "isbn", on: ["isbn"], writes: false, speed: 1 };
let random = rng(7);
let pos = [G.HOME[0], G.HOME[1]], inBack = false;
let steps = [], current = null, watchMs = 0, readsShown = 0;
let lastQuery = null, lastInsert = null, carrying = false;

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const fmtMs = (ms) => (ms >= 1000 ? (ms / 1000).toFixed(1) + " s" : ms >= 10 ? ms.toFixed(0) + " ms" : ms.toFixed(1) + " ms");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const planName = (p) => (p.kind === "scan" ? "Full scan" : p.kind === "covering" ? "Index only" : "Index + lookups");
const indexLabel = (id) => INDEXES.find((x) => x.id === id).label;

// The trolley and the book it carries are drawn behind the cabinets when they are back by the shelves.
function setTrolley(p) {
  pos = p;
  const back = p[1] < -20;
  if (back !== inBack) { (back ? backSlot : frontSlot).append(trolleyEl, fly); inBack = back; }
  trolleyEl.setAttribute("transform", translateAlong(P, [p[0], p[1], 0]));
  if (carrying) flyAt(basket());
}
function setLamp(on) { lamp.toggleAttribute("data-lit", on); }
function flyAt(p, opacity = 1) { fly.setAttribute("transform", translateAlong(P, p)); fly.style.opacity = String(opacity); }
function setNeedle(ms) { needle.setAttribute("d", needleAt(ms / 10)); }
function setCount(label, value) { if (countLabel.textContent !== label) countLabel.textContent = label; const v = String(value); if (countEl.textContent !== v) countEl.textContent = v; }
function setDrawerLit(i, on) { drawerEls[i].toggleAttribute("data-lit", on); }
function setCard(i, on, text, rise = 1) {
  const el = cardEls[i];
  el.style.display = on ? "" : "none";
  if (!on) return;
  if (text !== undefined) el.querySelector("text").textContent = text;
  el.setAttribute("transform", translateAlong(P, [0, 0, rise * G.TRAY.rise]));
}
function setTag(c, on) {
  const el = tagEls[c];
  el.querySelector(".iso-solid").toggleAttribute("data-lit", on);
  el.querySelector("text").setAttribute("data-tone", on ? "lit" : "mid");
}
function clearTags() { G.CASES.forEach((_, c) => setTag(c, false)); }
function onShelf(spot) {
  onShelfEl.style.display = spot ? "" : "none";
  if (spot) onShelfEl.setAttribute("transform", translateAlong(P, [spot.x, G.CASE.y0 + 8, spot.level]));
}
function setRoute(points) {
  routeEl.setAttribute("d", points ? pathOf(points.map((p) => iso([p[0], p[1], 0.3], P))) : "");
}

function route(from, to) {
  const front = (p) => p[1] > 0;
  if (front(from) === front(to)) return [from, to];
  return [from, [G.AISLE_X, from[1]], [G.AISLE_X, to[1]], to];
}
// The pointer: from the drawer face, along the trolley's way, to the foot of the numbered bookcase.
function routeTo(from, spot, cab) {
  const pts = route(from, [spot.x, G.SHELF_LANE_Y]);
  if (cab) pts.unshift([cab.cx, G.CAB_FRONT + G.TRAY.out + 1]);
  pts.push([spot.x, G.CASE.y0 + G.CASE.d + 1]);
  return pts;
}
// The route is worked out when the walk starts, from wherever the trolley is by then.
function travel(to) {
  let pts = [], lens = [], total = 0;
  steps.push({
    dur: 0.12,
    begin() {
      pts = route(pos, to); lens = []; total = 0;
      for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lens.push(l); total += l; }
      this.dur = Math.max(0.12, total / 240 + 0.1 * (pts.length - 2));
    },
    run(t) {
      if (total < 0.5) return;
      let d = ease(t) * total, i = 0;
      while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i++; }
      const u = lens[i] ? Math.min(1, d / lens[i]) : 1;
      setTrolley([lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)]);
    },
  });
}
// A clocked step: the stopwatch and the page counter advance with it.
function reading(ms, pages, run, begin, done) {
  let base = 0, baseReads = 0;
  steps.push({ dur: ms * SCALE, begin: () => { base = watchMs; baseReads = readsShown; setLamp(true); begin && begin(); }, run: (t) => { watchMs = base + ms * t; readsShown = baseReads + Math.round(pages * t); setNeedle(watchMs); showLive(); run && run(t); }, done: () => { setLamp(false); done && done(); } });
}
function call(fn) { steps.push({ dur: 0, done: fn }); }

const shelfSpot = () => { const c = Math.floor(random() * G.CASES.length); const level = G.LEVELS[Math.floor(random() * G.LEVELS.length)]; return { c, x: G.CASES[c].cx, level }; };
const basket = () => [pos[0] - 3, pos[1], 14];
function clearScene() {
  clearTags(); setRoute(null); onShelf(null);
  G.CABS.forEach((_, i) => { setCard(i, false); setDrawerLit(i, false); });
}

function runQuery() {
  const plan = choose(cfg.query, cfg.rows, cfg.on);
  const query = QUERIES[cfg.query];
  call(() => { watchMs = 0; readsShown = 0; setNeedle(0); fly.style.opacity = "0"; clearScene(); setCount(plan.kind === "scan" ? "BOOKS CHECKED" : "DRAWER READS", 0); say(query.label + " · " + planName(plan).toLowerCase() + (plan.index ? " on " + indexLabel(plan.index).toLowerCase() : "")); });
  if (plan.kind === "scan") {
    const xs = G.CASES.map((c) => c.cx), x0 = G.CASES[0].x0 - 6;
    travel([x0, G.SHELF_LANE_Y]);
    reading(plan.cost, plan.reads, (t) => {
      const n = xs.length, at = Math.min(n - 1, Math.floor(t * n)), f = t * n - at;
      setTrolley([lerp(at === 0 ? x0 : xs[at - 1], xs[at], ease(Math.min(1, f / 0.3))), G.SHELF_LANE_Y]);
      G.CASES.forEach((_, c) => setTag(c, c === at && t < 1));
      setCount("BOOKS CHECKED", Math.round(cfg.rows * t).toLocaleString());
    }, () => say(query.label + " · checking every book on every shelf · " + plan.reads.toLocaleString() + " pages"), () => { clearTags(); carrying = true; flyAt(basket()); });
  } else {
    const i = G.CABS.findIndex((c) => c.id === plan.index), cab = G.CABS[i];
    const covering = plan.kind === "covering";
    const first = shelfSpot();
    travel([cab.cx, G.CAB_STOP_Y]);
    reading(plan.drawerReads * RAND, plan.drawerReads, (t) => { setCard(i, true, undefined, ease(t)); setCount("DRAWER READS", Math.round(plan.drawerReads * t)); },
      () => { setDrawerLit(i, true); setCard(i, true, covering ? "+ TITLE" : "SHELF " + (first.c + 1), 0); say(query.label + " · " + indexLabel(plan.index).toLowerCase() + " catalogue · " + plan.drawerReads + " drawer reads"); },
      () => { setDrawerLit(i, false); if (!covering) { setTag(first.c, true); onShelf(first); setRoute(routeTo(pos, first, cab)); say(query.label + " · the card says shelf " + (first.c + 1)); } });
    if (plan.shelfTrips) {
      travel([first.x, G.SHELF_LANE_Y]);
      for (let n = 0; n < plan.shelfTrips; n++) {
        let from, spot;
        reading(RAND, 1, (t) => {
          setTrolley([lerp(from[0], spot.x, ease(Math.min(1, t * 1.6))), G.SHELF_LANE_Y]);
          if (t > 0.62) { onShelf(null); const u = (t - 0.62) / 0.38; flyAt([spot.x, lerp(G.CASE.y0 + 8, G.SHELF_LANE_Y, ease(u)), lerp(spot.level, 14, ease(u))]); }
        }, () => {
          carrying = false; from = [...pos]; spot = n === 0 ? first : shelfSpot();
          setCard(i, true, "SHELF " + (spot.c + 1)); clearTags(); setTag(spot.c, true); onShelf(spot);
          if (n > 0) setRoute(routeTo(pos, spot));
          setCount("SHELF TRIPS", (n + 1) + " / " + plan.shelfTrips);
          say(query.label + " · card " + (n + 1) + " of " + plan.shelfTrips + " → shelf " + (spot.c + 1));
        }, () => { carrying = true; flyAt(basket()); setRoute(null); });
      }
      call(() => clearTags());
    } else {
      call(() => { setCount("SHELF TRIPS", 0); say(query.label + " · the title is on the card: no shelf trips"); });
      steps.push({ dur: 0.8 });
    }
  }
  travel([G.HOME[0], G.HOME[1]]);
  call(() => { lastQuery = { plan, ms: plan.cost }; carrying = false; fly.style.opacity = "0"; clearScene(); showStats(); say(query.label + " · " + fmtMs(plan.cost) + " · " + plan.reads.toLocaleString() + " pages"); });
  steps.push({ dur: 0.6 });
}

function runInsert() {
  const on = INDEXES.filter((x) => cfg.on.includes(x.id));
  const per = levels(cfg.rows) + 1;
  const last = G.CASES.length - 1, shelf = { c: last, x: G.CASES[last].cx, level: G.LEVELS[3] };
  call(() => { watchMs = 0; readsShown = 0; setNeedle(0); clearScene(); newBook.style.display = ""; setCount("CARDS FILED", "0 / " + on.length); say("a new book · a card to file in " + on.length + (on.length === 1 ? " catalogue" : " catalogues")); });
  steps.push({ dur: 0.3, done: () => { newBook.style.display = "none"; carrying = true; flyAt(basket()); } });
  on.forEach((index, n) => {
    const i = G.CABS.findIndex((c) => c.id === index.id);
    travel([G.CABS[i].cx, G.CAB_STOP_Y]);
    reading(per * RAND, per, (t) => setCard(i, true, undefined, 1 - ease(t)),
      () => { setDrawerLit(i, true); setCard(i, true, "SHELF " + (last + 1), 1); say("a new book · filing its card in the " + index.label.toLowerCase() + " catalogue · " + per + " page reads and writes"); },
      () => { setDrawerLit(i, false); setCard(i, false); setCount("CARDS FILED", (n + 1) + " / " + on.length); });
  });
  call(() => { setTag(last, true); setRoute(routeTo(pos, shelf)); });
  travel([shelf.x, G.SHELF_LANE_Y]);
  reading(RAND, 1, (t) => flyAt([pos[0], lerp(pos[1], G.CASE.y0 + 8, ease(t)), lerp(14, shelf.level, ease(t))], 1 - Math.max(0, t - 0.8) * 5), () => { carrying = false; say("a new book · shelved on shelf " + (last + 1)); }, () => { setRoute(null); onShelf(shelf); });
  travel([G.HOME[0], G.HOME[1]]);
  call(() => { lastInsert = { ms: insertCost(cfg.rows, on.length) }; carrying = false; fly.style.opacity = "0"; clearScene(); showStats(); say("a new book · " + fmtMs(lastInsert.ms) + " · " + insertReads(cfg.rows, on.length) + " page writes"); });
  steps.push({ dur: 0.6 });
}

let turn = 0;
function next() { if (cfg.writes && turn % 2 === 1) runInsert(); else runQuery(); turn++; }

function advance(dt) {
  let left = dt, guard = 0;
  while (left > 1e-9 && guard++ < 400) {
    if (!current) {
      current = steps.shift();
      if (!current) { next(); continue; }
      current.elapsed = 0; current.begin && current.begin();
      if (current.dur === 0) { const c = current; current = null; c.run && c.run(1); c.done && c.done(); continue; }
    }
    const use = Math.min(current.dur - current.elapsed, left);
    current.elapsed += use; left -= use;
    current.run && current.run(Math.min(1, current.elapsed / current.dur));
    if (current.elapsed >= current.dur - 1e-9) { const c = current; current = null; c.done && c.done(); }
  }
}

function showLive() {
  statEls.time.textContent = fmtMs(watchMs);
  statEls.reads.textContent = readsShown.toLocaleString();
}
function showStats() {
  statEls.rows.textContent = cfg.rows.toLocaleString();
  statEls.cats.textContent = String(cfg.on.length);
  const plan = choose(cfg.query, cfg.rows, cfg.on);
  statEls.plan.textContent = planName(plan);
  if (lastQuery) { statEls.time.textContent = fmtMs(lastQuery.ms); statEls.reads.textContent = lastQuery.plan.reads.toLocaleString(); }
  statEls.insert.textContent = cfg.writes ? fmtMs(insertCost(cfg.rows, cfg.on.length)) : "–";
}

function applyCatalogues() {
  G.CABS.forEach((c, i) => { cabEls[i].forEach((el) => { el.style.display = cfg.on.includes(c.id) ? "" : "none"; }); });
  document.querySelectorAll('[data-set="idx"]').forEach((b) => b.setAttribute("aria-pressed", String(cfg.on.includes(b.dataset.value))));
}
function restart() {
  steps = []; current = null; turn = 0; watchMs = 0; readsShown = 0; lastQuery = null; lastInsert = null;
  random = rng(7); carrying = false; fly.style.opacity = "0"; newBook.style.display = "none"; setLamp(false);
  clearScene(); setCount("BOOKS CHECKED", 0);
  setTrolley([G.HOME[0], G.HOME[1]]); setNeedle(0);
  statEls.time.textContent = "–"; statEls.reads.textContent = "–";
  showStats();
}
function set(name, raw) {
  if (name === "rows") { cfg.rows = Number(raw); WB.pressSeg(name, raw); }
  if (name === "query") { cfg.query = raw; WB.pressSeg(name, raw); }
  if (name === "writes") { cfg.writes = raw === "true" || raw === true; WB.pressSeg(name, String(cfg.writes)); }
  if (name === "speed") { cfg.speed = Number(raw); WB.pressSeg(name, raw); return; }
  if (name === "idx") { cfg.on = cfg.on.includes(raw) ? cfg.on.filter((x) => x !== raw) : [...cfg.on, raw]; applyCatalogues(); }
  restart();
}

const pauseBtn = document.querySelector('[data-act="pause"]');
const clock = WB.loop({ stage, step: (dt) => advance(dt * cfg.speed), onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });
clock.setPaused(clock.paused);
WB.onSegments(set);
document.querySelector('[data-act="restart"]').addEventListener("click", restart);
pauseBtn.addEventListener("click", () => clock.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); clock.toggle(); } });

// ---------- experiments ----------
const share = (v, top) => Math.max(0.01, Math.min(1, v / top));
const RUNS = {
  grow: () => {
    const s1 = scanCost(10000), s2 = scanCost(100000), i1 = choose("isbn", 10000, ["isbn"]).cost, i2 = choose("isbn", 100000, ["isbn"]).cost;
    return { verdict: "Scan " + fmtMs(s1) + " → " + fmtMs(s2) + " (×" + (s2 / s1).toFixed(0) + "). Catalogue " + fmtMs(i1) + " → " + fmtMs(i2) + ": " + levels(10000) + " → " + levels(100000) + " drawer levels.", bars: [["Scan, 10,000", share(s1, s2), fmtMs(s1)], ["Scan, 100,000", 1, fmtMs(s2)], ["Index, 10,000", share(i1, s2), fmtMs(i1)], ["Index, 100,000", share(i2, s2), fmtMs(i2), true]] };
  },
  writes: () => {
    const a = insertCost(100000, 1), b = insertCost(100000, 3);
    return { verdict: "Adding a book " + fmtMs(a) + " → " + fmtMs(b) + " (" + insertReads(100000, 1) + " → " + insertReads(100000, 3) + " page writes): " + Math.round(1000 / a) + " → " + Math.round(1000 / b) + " books a second.", bars: [["No catalogue", share(insertCost(100000, 0), b), fmtMs(insertCost(100000, 0))], ["1 catalogue", share(a, b), fmtMs(a)], ["3 catalogues", 1, fmtMs(b), true]] };
  },
  prefix: () => {
    const year = choose("year", 100000, ["authorYear"]), both = choose("authorYear", 100000, ["authorYear"]), author = choose("author", 100000, ["authorYear"]);
    return { verdict: "Year only: " + planName(year).toLowerCase() + ", " + fmtMs(year.cost) + ". Author + year: " + fmtMs(both.cost) + ". Author only still uses it: " + fmtMs(author.cost) + ".", bars: [["Author + year", share(both.cost, 100), fmtMs(both.cost)], ["Author only", share(author.cost, 100), fmtMs(author.cost)], ["Year only (scan)", share(year.cost, 100), fmtMs(year.cost), true]] };
  },
  selective: () => {
    const all = plans("loan", 100000, ["loan"]), scan = all.find((p) => p.kind === "scan"), index = all.find((p) => p.kind !== "scan");
    return { verdict: "The planner picks the scan: " + fmtMs(scan.cost) + " against " + fmtMs(index.cost) + " through the catalogue (" + index.shelfTrips.toLocaleString() + " shelf trips).", bars: [["Full scan (chosen)", share(scan.cost, index.cost), fmtMs(scan.cost), true], ["Via the catalogue", 1, fmtMs(index.cost)]] };
  },
  covering: () => {
    const plain = choose("titles", 100000, ["author"]), cover = choose("titles", 100000, ["authorTitle"]);
    return { verdict: "Titles by one author: " + fmtMs(plain.cost) + " → " + fmtMs(cover.cost) + " (" + plain.shelfTrips + " shelf trips → none), " + (plain.cost / cover.cost).toFixed(0) + "× faster.", bars: [["Author catalogue", 1, fmtMs(plain.cost)], ["Author + title", share(cover.cost, plain.cost), fmtMs(cover.cost), true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  cfg.rows = w.rows; cfg.query = w.query; cfg.on = [...(w.then || w.on)]; cfg.writes = w.writes;
  WB.pressSeg("rows", cfg.rows); WB.pressSeg("query", cfg.query); WB.pressSeg("writes", String(cfg.writes));
  if (cfg.rows >= 100000 && cfg.speed < 8) { cfg.speed = 8; WB.pressSeg("speed", 8); }
  applyCatalogues(); restart();
  if (clock.paused) clock.setPaused(false);
} });

applyCatalogues(); showStats(); setNeedle(0);
`;

const size = writePage(new URL("./index-workbench.html", import.meta.url), {
  title: "Index Workbench",
  eyebrow: "Systems lesson 11 · Database indexes",
  lede: "An index is a second, sorted copy of a few columns that points back to the rows. It turns read-everything into look-it-up, and every write pays to keep it current. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
  machine: { intro: "The bookcases are the table, books in the order they arrived. Each catalogue cabinet is an index on one column. Pick a query and turn catalogues on or off: the trolley either walks every shelf, or reads a card in a drawer that names a shelf number and goes straight to that bookcase.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Times come from the same cost model the machine runs on: a page of 100 books read in order costs 0.1 ms, a random page (a drawer level or a trip to a shelf) 0.4 ms, and a catalogue page holds 100 cards.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css: '.iso-face-text[data-tone="lit"]{fill:var(--anatomy-lit)}\n[data-count],[data-count-label]{font-variant-numeric:tabular-nums}',
  script: live,
});
console.log("wrote index-workbench.html", (size / 1024).toFixed(0) + " KB");

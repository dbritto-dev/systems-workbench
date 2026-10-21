// Systems lesson 27 · N+1 queries. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, pickerSvg, cargoSvg, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));
const digits = inlineModule(new URL("./digits.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "distance",
    title: "The database moves away",
    change: "N+1 · 20 orders, 5 items each · database on the same host (0.2 ms round trip) → in another zone (10 ms)",
    question: "The page runs the same 21 queries and fetches the same 28 KB. How long does it take now?",
    options: ["About the same: the data hasn't changed", "About 10 ms longer: one extra round trip", "Over 200 ms: every one of the 21 queries pays the trip"],
    answer: 2,
    why: "Each query waits for a full round trip before the next one starts, so the page costs about 21 × the round trip. On your laptop the trip is a fraction of a millisecond and the N+1 hides; in production, with the database a zone away, the same code is twenty times slower. The bytes barely matter: the trips do.",
    watch: { mode: "n1", rows: 20, items: 5, nested: "off", dist: "region" },
  },
  {
    id: "rows",
    title: "A bigger page",
    change: "Database in another zone · orders per page 20 → 50 · N+1 vs batched (one IN query for all the items)",
    question: "How does the page time change for each?",
    options: ["Both get about 2.5× slower", "N+1 gets about 2.5× slower; batched barely moves", "Batched gets slower too, because its one query is bigger"],
    answer: 1,
    why: "N+1 runs one query per order, so its trips, and its time, grow with the page: 21 trips become 51. The batched page always runs two queries (the orders, then every item WHERE order_id IN (...)), whatever the page size. Its second query returns more rows, but shipping a few more kilobytes costs far less than thirty more round trips.",
    watch: { mode: "n1", rows: 50, items: 5, nested: "off", dist: "region" },
  },
  {
    id: "nested",
    title: "One more level",
    change: "N+1 · 20 orders, 5 items each · the page now also shows each item's product, loaded the same lazy way",
    question: "How many queries does one page run now?",
    options: ["22: one more query for the products", "41: one more per order", "121: one per order, plus one per item"],
    answer: 2,
    why: "Lazy loading nests: 1 query for the orders, 20 for their items, then one for each of the 100 items' products. That is N + N×M + 1. With the database in another zone the page now takes over a second. Batching each level keeps it at 3 queries: orders, items IN (...), products IN (...).",
    watch: { mode: "n1", rows: 20, items: 5, nested: "on", dist: "region" },
  },
  {
    id: "join",
    title: "JOIN or batch?",
    change: "Database in another zone · 50 orders with 50 items each · one JOIN (orders × items) vs two batched queries",
    question: "Which loads the page faster?",
    options: ["The JOIN: one round trip always wins", "Batching: the JOIN repeats every order's columns on each of its 2,500 rows, so it ships far more data", "The same: the same data comes back either way"],
    answer: 1,
    why: "A JOIN returns one row per order-item pair, and each of those rows carries the whole order again. With 50 items per order that is 2,500 copies of 800-byte orders: over 2 MB instead of about 340 KB, so the wire time outweighs the round trip it saved. With few children per order (5, say) the JOIN wins. For one-to-many with many children, batch; for one-to-one or few, join.",
    watch: { mode: "join", rows: 50, items: 50, nested: "off", dist: "region" },
  },
  {
    id: "parallel",
    title: "Fire them all at once",
    change: "Database in another zone · 20 orders · the 20 item queries run 5 at a time on a connection pool, instead of one by one",
    question: "Compared with batching the items into one query…",
    options: ["Just as good: the page is as fast as the batched one", "Faster than one by one, still slower than batching, and the database still runs 21 queries for every page", "Slower than one by one, because of the pool"],
    answer: 1,
    why: "Running the queries in parallel hides some of the waiting: four waves of five trips instead of twenty in a row. But the page still needs those waves, it holds five connections while it runs, and the database still parses, plans and runs 21 queries per page instead of 2. At a few hundred pages a second that is thousands of extra queries a second. Batching fixes the cause; parallelism only hides the latency.",
    watch: { mode: "par", rows: 20, items: 5, nested: "off", dist: "region" },
  },
];

const QUESTIONS = [
  ["Your list page is fast on your laptop and slow in staging. The query log shows the same SELECT many times with different ids. What is going on?",
    "An N+1: one query for the list, then one per row for its related data. Locally each round trip costs a fraction of a millisecond, so 51 queries feel free; in staging the database is a network hop away and the page pays the round trip 51 times, one after another."],
  ["How would you catch N+1s before production?",
    "Count queries per request: turn on ORM query logging, look at the span list in your APM or tracing (a long ladder of identical spans is the signature), and add tests that assert the query count for key endpoints so it can't silently grow with the data."],
  ["Why does an ORM make N+1 so easy to write?",
    "Lazy relations look like plain attributes. `order.items` inside a loop or a template reads like a field access, but each first access runs a query. The code that triggers the queries (often a view or serializer) is far from the code that loaded the list."],
  ["JOIN, or a second query with IN (...)? How do you choose?",
    "A JOIN (eager load in one query) is great for one-to-one or a few children: one round trip, little repetition. For one-to-many with many children, the JOIN repeats the parent's columns on every child row and can multiply rows across several relations, so a separate IN (...) query per relation (prefetch) ships far less. Both are a constant number of queries per page."],
  ["In a GraphQL API every field resolver loads its own data. How does DataLoader prevent N+1 there?",
    "Resolvers ask the loader for one key each; the loader waits until the current tick ends, collects every key requested, and runs one batched query (WHERE id IN (...)). It also caches per request, so the same key is fetched once. N resolver calls become one query per relation per level."],
  ["Paging the list limits the damage. Why is it not a fix?",
    "A page of 20 bounds the queries to 21 instead of thousands, but the cost still grows with page size and nesting, and every page still pays 21 round trips. The goal is a constant number of queries per request, independent of how many rows are on the page."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Warehouse picker",
  keys: [
    { mark: "lit", label: "Data on its way back; an order just completed; the warehouse serving" },
    { mark: "raised", label: "Order tickets and their boxes, the picker, the warehouse" },
    { mark: "flat", label: "The aisle: the network between the app and the database" },
  ],
  caption:
    "The packing table is the app; the warehouse at the end of the aisle is the database, standing on the same host, in the same zone or in another zone. Every query is one trip: out with a slip (one id, or a list of ids for a batch), back with a box sized by the data in it. The first trip brings the order tickets; a box lands on a ticket when that order's items have arrived. The counters on the table's front count the queries and the milliseconds of this page; the stopwatch hand turns once every 250 ms, and the crate fills with the bytes fetched (marked at 10 KB, 100 KB and 1 MB).",
  stage: 'data-warehouse-stage aria-label="N+1 queries simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">The machine runs 100× slower than real time: one millisecond of the page takes a tenth of a second here. Changing a setting starts a new page.</p>`;
const controls = panel({
  stats: [["queries", "Queries this page"], ["time", "Page time"], ["last", "Last full page", "–"], ["bytes", "Data this page"], ["perpage", "Queries per page"], ["pages", "Pages served"]],
  controls: [
    seg("mode", "Loading", [["n1", "N+1"], ["par", "N+1, 5 at once"], ["batch", "Batch (IN)"], ["join", "JOIN"]], "n1"),
    seg("rows", "Orders per page", [[10, "10"], [20, "20"], [50, "50"]], 20),
    seg("items", "Items per order", [[1, "1"], [5, "5"], [50, "50"]], 5),
    seg("nested", "Each item's product", [["off", "Not shown"], ["on", "Shown too"]], "off"),
    seg("dist", "Database", [["host", "Same host · 0.2 ms"], ["zone", "Same zone · 1 ms"], ["region", "Other zone · 10 ms"]], "region"),
    speedSeg(),
    actions("Do something", [["reset", "Start over"], ["pause", "Pause"]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
.cw{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.7}
.dg{fill:none;stroke:var(--anatomy-strong);stroke-width:1.15;stroke-linecap:round;stroke-linejoin:round}
.hand{fill:none;stroke:var(--anatomy-strong);stroke-width:1.4;stroke-linecap:round}
[data-slot][data-off]{display:none}
`;

// ---------- live code ----------
const live = `
${sim}
${digits}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const PICKER_SVG = ${JSON.stringify(pickerSvg())};
const CARGO_SVG = ${JSON.stringify(cargoSvg())};
const MS_PER_S = 10;        // model milliseconds per second on screen, at ×1
const HOLD = 15;            // model ms the finished page stays up before the next one
const LIT_MS = 5;           // a box stays lit this long after its order completes

const stage = document.querySelector("[data-warehouse-stage]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const NS = "http://www.w3.org/2000/svg";
const house = q("[data-warehouse]");
const lampOn = q('[data-lamp="on"]'), lampOff = q('[data-lamp="off"]');
const hand = q("[data-hand]");
const fillG = q("[data-fill]");
const layer = q("[data-pickers]");
const slots = Array.from({ length: G.SLOT.max }, (_, i) => { const g = q('[data-slot="' + i + '"]'); return { g, ticket: g.querySelector("[data-ticket]"), box: g.querySelector("[data-box]"), lit: g.querySelector("[data-box-lit]"), state: "" }; });
const origin = iso([0, 0, 0], P);
const pickers = Array.from({ length: 5 }, (_, i) => {
  const g = document.createElementNS(NS, "g");
  g.innerHTML = '<g data-body>' + PICKER_SVG + '</g><g data-cargo style="display:none">' + CARGO_SVG + '</g>';
  layer.appendChild(g);
  return { g, body: g.firstElementChild, cargo: g.lastElementChild, one: g.querySelector('[data-slip="one"]'), list: g.querySelector('[data-slip="list"]'), depth: 0 };
});

function counter(name) { const c = G.COUNTERS[name]; const cells = counterCells(c); return { c, cells, els: cells.map((_, j) => q('[data-digit="' + name + '-' + j + '"]')), shown: [] }; }
const dials = { trips: counter("trips"), ms: counter("ms") };
function show(dial, v) {
  digitsOf(Math.min(v, 10 ** dial.c.count - 1), dial.c.count).forEach((d, j) => { if (dial.shown[j] !== d) { dial.shown[j] = d; dial.els[j].setAttribute("d", digitPath(iso, P, dial.cells[j], d)); } });
}

const fillCache = new Map();
function fillMarkup(step) {
  if (!fillCache.has(step)) {
    const C = G.CRATE, level = step / 60;
    fillCache.set(step, level <= 0 ? "" : solidSvg(slabOf({ x: C.x + C.wall + 0.4, y: C.y + C.wall + 0.4, w: C.w - 2 * C.wall - 0.8, d: C.d - 2 * C.wall - 0.8, r: 0.4 }, G.TABLE_H + 0.8, level * (C.h - 1.6), P, 2), { tone: "hi", crease: "lo", lit: true }));
  }
  return fillCache.get(step);
}
const crateLevel = (bytes) => Math.max(0, Math.min(1, Math.log10(Math.max(1, bytes) / 1000) / 4));
const cargoScale = (bytes) => Math.max(1, Math.min(2.6, 1 + 0.4 * Math.log10(Math.max(1, bytes) / 1000)));
const fmt = (ms) => ms < 10 ? ms.toFixed(1) : String(Math.round(ms));
const kb = (b) => b < 1e6 ? (b / 1000).toFixed(b < 1e4 ? 1 : 0) + " KB" : (b / 1e6).toFixed(2) + " MB";

const cfg = { mode: "n1", rows: 20, items: 5, nested: false, dist: "region", speed: 1 };
let plan, clock, byLane, ptr, starts, backs, done, pages = 0, lastMs = null, fillStep = -1;
let seed = (Date.now() % 1e6) + 1;

function newPage(warm) {
  plan = planPage({ mode: cfg.mode, rows: cfg.rows, items: cfg.items, nested: cfg.nested, dist: cfg.dist }, seed++);
  byLane = Array.from({ length: plan.lanes }, (_, l) => plan.trips.filter((t) => t.lane === l).sort((a, b) => a.t0 - b.t0));
  ptr = byLane.map(() => 0);
  starts = plan.trips.map((t) => t.t0).sort((a, b) => a - b);
  backs = plan.trips.map((t) => [t.back, t.bytes]).sort((a, b) => a[0] - b[0]);
  done = false;
  clock = warm ? plan.end * 0.42 : 0;
  slots.forEach((s, i) => s.g.toggleAttribute("data-off", i >= cfg.rows));
  house.setAttribute("transform", translateAlong(P, [G.STOPS[cfg.dist] - G.STOPS.host, 0, 0]));
  pickers.forEach((p, i) => { p.g.style.display = i < plan.lanes ? "" : "none"; });
}
function restart() { pages = 0; lastMs = null; newPage(true); paint(); }

function setVis(el, on) { const v = on ? "" : "none"; if (el.style.display !== v) el.style.display = v; }

function paint() {
  const t = Math.min(clock, plan.end);
  const whx = G.STOPS[cfg.dist] + G.SERVE_GAP;
  let serving = false, lead = null;
  const placed = [];
  for (let l = 0; l < plan.lanes; l++) {
    const list = byLane[l];
    while (ptr[l] < list.length && list[ptr[l]].back <= t) ptr[l]++;
    const tr = ptr[l] < list.length && list[ptr[l]].t0 <= t ? list[ptr[l]] : null;
    const y = G.LANES[l];
    let x = G.PARK_X, phase = "idle";
    if (tr) {
      if (t < tr.arrive) { phase = "out"; x = G.PARK_X + (whx - G.PARK_X) * (t - tr.t0) / (tr.arrive - tr.t0); }
      else if (t < tr.done) { phase = "serve"; x = whx; serving = true; }
      else { phase = "back"; x = whx + (G.PARK_X - whx) * (t - tr.done) / (tr.back - tr.done); }
    }
    if (l === 0) lead = { tr, phase };
    const p = pickers[l];
    p.body.setAttribute("transform", translateAlong(P, [x, y, 0]));
    const many = tr && (tr.kind === "join" || (cfg.mode === "batch" && tr.kind !== "list"));
    setVis(p.one, (phase === "out" || phase === "serve") && !many);
    setVis(p.list, (phase === "out" || phase === "serve") && many);
    setVis(p.cargo, phase === "back");
    if (phase === "back") {
      const s = cargoScale(tr.bytes);
      p.cargo.setAttribute("transform", translateAlong(P, [x + 3.4 * G.PICKER_SCALE + 3.1 * s, y, 5 * G.PICKER_SCALE]) + " translate(" + origin[0] + " " + origin[1] + ") scale(" + s.toFixed(3) + ") translate(" + (-origin[0]) + " " + (-origin[1]) + ")");
    }
    p.depth = depthOf([x, y, 0], P);
    placed.push(p);
  }
  // Pickers further back are drawn first.
  placed.sort((a, b) => a.depth - b.depth);
  if (placed.some((p, i) => layer.children[i] !== p.g)) placed.forEach((p) => layer.appendChild(p.g));
  setVis(lampOn, serving); setVis(lampOff, !serving);

  // Tickets and boxes.
  for (let i = 0; i < cfg.rows; i++) {
    const s = slots[i], f = plan.fillAt[i];
    const state = t >= f ? (t - f < LIT_MS && clock < plan.end + LIT_MS ? "lit" : "box") : t >= plan.listAt ? "ticket" : "";
    if (state === s.state) continue;
    s.state = state;
    setVis(s.ticket, state !== "");
    setVis(s.box, state === "box");
    setVis(s.lit, state === "lit");
  }

  // Counters, stopwatch, crate.
  let started = 0; while (started < starts.length && starts[started] <= t) started++;
  let bytes = 0; for (const [b, n] of backs) { if (b > t) break; bytes += n; }
  show(dials.trips, started);
  show(dials.ms, Math.floor(t));
  const a = 2 * Math.PI * (t % G.WATCH_MS) / G.WATCH_MS, W = G.WATCH, len = W.r - 2.2;
  const c = iso([W.x, W.y, W.z], P), tip = iso([W.x + Math.sin(a) * len, W.y - Math.cos(a) * len, W.z], P);
  hand.setAttribute("d", "M" + c[0].toFixed(1) + " " + c[1].toFixed(1) + "L" + tip[0].toFixed(1) + " " + tip[1].toFixed(1));
  const step = Math.round(crateLevel(bytes) * 60);
  if (step !== fillStep) { fillStep = step; fillG.innerHTML = fillMarkup(step); }

  // Readout and stats.
  const modeName = { n1: "N+1", par: "N+1, 5 at once", batch: "batched", join: "JOIN" }[cfg.mode];
  if (clock >= plan.end) say("page done in " + fmt(plan.end) + " ms · " + plan.queries + (plan.queries === 1 ? " query" : " queries"));
  else if (lead && lead.tr) {
    const what = lead.phase === "out" ? "walking to the warehouse" : lead.phase === "serve" ? "waiting at the counter" : "carrying " + kb(lead.tr.bytes) + " back";
    say(modeName + " · query " + (lead.tr.q + 1) + " of " + plan.queries + " · " + what);
  } else say(modeName + " · " + started + " of " + plan.queries + " queries sent");
  stat("queries", started + " of " + plan.queries);
  stat("time", fmt(t) + " ms");
  stat("last", lastMs === null ? "–" : fmt(lastMs) + " ms");
  stat("bytes", kb(bytes));
  stat("perpage", plan.queries);
  stat("pages", pages);
}
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(key, value) { const el = statEls[key]; const text = String(value); if (el && el.textContent !== text) el.textContent = text; }

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => {
  if (!plan) return;
  clock += dt * cfg.speed * MS_PER_S;
  if (!done && clock >= plan.end) { done = true; pages++; lastMs = plan.end; }
  if (clock >= plan.end + HOLD) newPage(false);
  paint();
}, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });

function set(name, raw, quiet) {
  if (name === "speed") { cfg.speed = Number(raw); WB.pressSeg(name, raw); return; }
  if (name === "mode") cfg.mode = raw;
  if (name === "rows") cfg.rows = Number(raw);
  if (name === "items") cfg.items = Number(raw);
  if (name === "nested") cfg.nested = raw === "on";
  if (name === "dist") cfg.dist = raw;
  WB.pressSeg(name, raw);
  if (!quiet) restart();
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="reset"]').addEventListener("click", () => restart());
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const one = (x) => x < 10 ? x.toFixed(1) : String(Math.round(x));
const base = { mode: "n1", rows: 20, items: 5, nested: false, dist: "region" };
const RUNS = {
  distance: () => {
    const h = average({ ...base, dist: "host" }), z = average({ ...base, dist: "zone" }), r = average(base);
    return { verdict: "Same 21 queries and " + kb(r.bytes) + " each time: " + one(h.time) + " ms on the same host, " + one(z.time) + " ms in the same zone, " + one(r.time) + " ms in another zone.",
      bars: [["Same host", h.time / r.time, one(h.time) + " ms"], ["Same zone", z.time / r.time, one(z.time) + " ms"], ["Other zone", 1, one(r.time) + " ms", true]] };
  },
  rows: () => {
    const n20 = average(base), n50 = average({ ...base, rows: 50 }), b20 = average({ ...base, mode: "batch" }), b50 = average({ ...base, mode: "batch", rows: 50 }), top = n50.time;
    return { verdict: "N+1: " + one(n20.time) + " → " + one(n50.time) + " ms (" + n20.queries + " → " + n50.queries + " queries). Batched: " + one(b20.time) + " → " + one(b50.time) + " ms, 2 queries both times.",
      bars: [["N+1, 20 orders", n20.time / top, one(n20.time) + " ms"], ["N+1, 50 orders", 1, one(n50.time) + " ms", true], ["Batched, 20 orders", b20.time / top, one(b20.time) + " ms"], ["Batched, 50 orders", b50.time / top, one(b50.time) + " ms", true]] };
  },
  nested: () => {
    const flat = average(base), deep = average({ ...base, nested: true }), batch = average({ ...base, nested: true, mode: "batch" }), top = deep.time;
    return { verdict: "With products: " + deep.queries + " queries and " + one(deep.time) + " ms per page (it was " + flat.queries + " queries, " + one(flat.time) + " ms). Batched per level: " + batch.queries + " queries, " + one(batch.time) + " ms.",
      bars: [["N+1, orders and items", flat.time / top, flat.queries + " queries · " + one(flat.time) + " ms"], ["N+1, with products", 1, deep.queries + " queries · " + one(deep.time) + " ms", true], ["Batched, with products", batch.time / top, batch.queries + " queries · " + one(batch.time) + " ms"]] };
  },
  join: () => {
    const big = { ...base, rows: 50, items: 50 };
    const j = average({ ...big, mode: "join" }), b = average({ ...big, mode: "batch" });
    const js = average({ ...base, mode: "join" }), bs = average({ ...base, mode: "batch" });
    const top = Math.max(j.time, b.time);
    return { verdict: "50 × 50: the JOIN ships " + kb(j.bytes) + " in " + one(j.time) + " ms; batching ships " + kb(b.bytes) + " in " + one(b.time) + " ms. With 20 orders of 5 items the JOIN wins instead: " + one(js.time) + " ms vs " + one(bs.time) + " ms.",
      bars: [["JOIN, 1 query", j.time / top, one(j.time) + " ms · " + kb(j.bytes)], ["Batched, 2 queries", b.time / top, one(b.time) + " ms · " + kb(b.bytes), true]] };
  },
  parallel: () => {
    const n = average(base), p = average({ ...base, mode: "par" }), b = average({ ...base, mode: "batch" }), top = n.time;
    return { verdict: "One by one: " + one(n.time) + " ms. Five at a time: " + one(p.time) + " ms. Batched: " + one(b.time) + " ms. Queries per page: " + n.queries + ", " + p.queries + " and " + b.queries + ": at 200 pages a second that is " + (p.queries * 200).toLocaleString("en") + " vs " + (b.queries * 200) + " queries a second.",
      bars: [["One by one", 1, one(n.time) + " ms · " + n.queries + " queries"], ["5 at once", p.time / top, one(p.time) + " ms · " + p.queries + " queries", true], ["Batched", b.time / top, one(b.time) + " ms · " + b.queries + " queries"]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  for (const key of ["mode", "rows", "items", "nested", "dist"]) set(key, String(w[key]), true);
  restart();
  if (loop.paused) loop.setPaused(false);
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./n-plus-one-workbench.html", import.meta.url), {
  title: "N+1 Query Workbench",
  eyebrow: "Systems lesson 27 · N+1 queries",
  lede: "A list page runs one query for the list, then one more for each row's related data: N + 1 queries where 2 would do. Each is a round trip, so the page costs the number of rows times the distance to the database. This lesson shows it as a warehouse picker: watch the trips, predict what makes them worse, then explain it back.",
  machine: { intro: "One page of orders is loaded into the packing table. Count the trips, watch the milliseconds, then move the warehouse closer or further, add orders, and switch between N+1, five at once, batching and a JOIN.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded pages.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: `Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson: round trips, database time and wire time per query, with a little jitter.`,
  css,
  script: live,
});
console.log("wrote n-plus-one-workbench.html", (size / 1024).toFixed(0) + " KB");

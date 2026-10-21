// Systems lesson 29 · Connection pooling. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, cabSvg, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));
const digits = inlineModule(new URL("./digits.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "nopool",
    title: "A new connection for every request",
    change: "No pool · each request opens its own connection, uses it once and closes it · 2 instances, 60 requests/s each",
    question: "The queries take about 10 ms. How long does a typical request take now?",
    options: ["About the same: 10 ms", "About 40 ms, four times longer", "Seconds: the database refuses most of them"],
    answer: 1,
    why: "Before a new connection can run anything it needs a TCP handshake, TLS and authentication, and the database starts a fresh backend for it: about 30 ms here. The query still takes 10 ms, so setup costs three times the useful work on every single request. A pool pays that once and then reuses the connection thousands of times.",
    watch: { pool: 0, instances: 2, rate: 60, api: "none", leak: 0, pooler: "off" },
  },
  {
    id: "size",
    title: "A bigger pool",
    change: "2 instances at 500 requests/s each, more than the database can serve · pool per instance 5 → 10 → 20 (up to 10, 20 or 40 queries at once)",
    question: "Which pool size gets the most requests served per second?",
    options: ["20: more connections, more throughput", "10: somewhere in the middle", "5: the smallest"],
    answer: 2,
    why: "The database does its best work with only a few queries at once, about twice its cores. Past that, extra queries add no capacity; they fight over CPU, locks and cache and slow every query down. With 40 connections each query takes 8 times longer and fewer finish per second. When demand exceeds capacity, a small pool keeps the excess waiting in the app, where waiting is cheap, instead of inside the database.",
    watch: { pool: 20, instances: 2, rate: 500, api: "none", leak: 0, pooler: "off" },
  },
  {
    id: "leak",
    title: "One code path forgets to give it back",
    change: "1 request in 500 returns early without releasing its connection · 2 instances, pool 10, 60 requests/s each, for 5 minutes (Watch uses 1 in 50 at ×8, so the lots fill while you look)",
    question: "What do you see over those 5 minutes?",
    options: ["About 1 request in 500 fails; the rest are fine", "Fine for a minute or so, then nearly every request times out", "The database runs out of memory and restarts"],
    answer: 1,
    why: "A leaked connection is still checked out, so the pool can neither use it nor replace it. At 60 requests a second the tenth leak comes after about 5,000 requests, and from then on every request waits its full second and times out, while the database sits idle holding 20 connections that do nothing. It passes every short test. Release connections in a finally block (or with try-with-resources / using), and turn on the pool's leak detection.",
    watch: { pool: 10, instances: 2, rate: 60, api: "none", leak: 50, pooler: "off", speed: 8 },
  },
  {
    id: "api",
    title: "An API call inside the transaction",
    change: "Each request calls an external API (200 ms) while holding its connection, instead of before taking one · 2 instances, pool 10, 60 requests/s each",
    question: "The database runs exactly the same queries. What happens?",
    options: ["Nothing: the database isn't any busier", "Requests get 200 ms slower, and that's all", "Requests start timing out waiting for a connection, while the database sits mostly idle"],
    answer: 2,
    why: "A connection is busy for as long as someone holds it, not only while a query runs. 60 requests a second, each holding one for 210 ms, need about 12.6 connections at once; the pool has 10. The wait queue grows until requests time out, yet the database runs about one query at a time. Do slow outside work before or after the transaction, never inside it.",
    watch: { pool: 10, instances: 2, rate: 60, api: "inside", leak: 0, pooler: "off" },
  },
  {
    id: "scale",
    title: "Scale out for a busy day",
    change: "Pool 20 per instance, the database allows 60 connections · scale from 2 to 4 instances · then the same through a pooler that keeps 20 server connections",
    question: "Connecting directly, what happens when the extra instances start?",
    options: ["All four share the load fine", "The fourth gets no connections at all and fails every request", "The database slows down, but every request succeeds"],
    answer: 1,
    why: "Each instance opens its full pool of 20 at start-up. Three instances already hold all 60 connections the database allows, so the fourth is refused every time it tries: its rank stays empty and all its requests fail, a quarter of all traffic. Autoscaling multiplies pools. A pooler such as PgBouncer lets many cheap client connections share a few server connections, so the database only ever sees 20.",
    watch: { pool: 20, instances: 2, rate: 60, api: "none", leak: 0, pooler: "off", scaleTo: 4 },
  },
];

const QUESTIONS = [
  ["Why is opening a database connection per request slow, and what exactly does a pool save?",
    "A new connection needs a TCP handshake, a TLS handshake and authentication (several network round trips), and the database starts a backend process or thread and allocates memory for it. That often costs more than the query. A pool opens connections once and lends them out, so each request only pays for its queries."],
  ["Your service handles 300 requests a second and each holds a connection for 20 ms. How many connections does it need, and why not just configure 200?",
    "Little's law: 300 × 0.020 = 6 connections busy on average; add headroom for bursts, so perhaps 10–15. Not 200: under load, more connections means more concurrent queries in the database, which past roughly twice its cores slows every query down, and every connection costs database memory even when idle."],
  ["Why can a bigger pool make a busy system slower?",
    "The database has a fixed amount of CPU, disk and lock capacity. Beyond a few active queries per core, extra queries don't add throughput; they add context switching, lock and cache contention. A smaller pool keeps the excess queued in the application, where waiting costs almost nothing, and the database stays at its most efficient level."],
  ["A service runs fine for an hour after each deploy, then every request fails with 'timed out waiting for a connection'. The database looks idle. What do you suspect, and how do you confirm it?",
    "A connection leak: some code path never returns its connection. Confirm with pool metrics (active = maximum while throughput is near zero), pg_stat_activity showing sessions idle or 'idle in transaction' for a long time, and the pool's leak-detection log, which prints the stack trace of who borrowed it. Fix with finally / try-with-resources / using."],
  ["Why shouldn't you call an external API inside a database transaction?",
    "The connection, and any locks the transaction holds, stay taken for the whole call. The pool runs out long before the database is busy, other requests time out, and a slow or hanging API now blocks your database work too. Fetch what you need before the transaction, or record the intent and call the API after commit (for example with an outbox)."],
  ["You run 30 pods with a pool of 10 each against a database with max_connections = 200. What happens, and what are your options?",
    "30 × 10 = 300 connections wanted, 200 allowed: the last pods to start can't get connections and fail. Options: smaller pools per pod; a pooler such as PgBouncer in transaction mode so pods share a small set of server connections; or raising max_connections carefully, since each connection costs database memory. Count pods × pool size against the limit whenever you autoscale."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Taxi rank",
  keys: [
    { mark: "lit", label: "A cab with a passenger: a connection lent to a request; a lit booth lamp: new cabs refused" },
    { mark: "raised", label: "Hotels, cabs, booths, the terminal: instances, connections, connection setup, the database" },
    { mark: "flat", label: "Ranks, roads, lay-bys, the fenced lots and the terminal kerb" },
  ],
  caption:
    "Each hotel is an app instance and its rank is its connection pool; the counter over its door is how many passengers are waiting for a cab. A new cab must stop at the booth at the end of its road to register, and every cab that exists fills one cell on the terminal's permit board, which has 60. A cab at the kerb is a query running; the roof gauge shows how much slower each query runs as the kerb fills. Cabs in a lay-by are held while their passenger makes an outside call; cabs in the fenced lot behind a hotel were never given back. A lit booth lamp means the terminal is turning that hotel's new cabs away: it has no permits left. Through a pooler, the lamps beside the board are its 20 shared server connections.",
  stage: 'data-rank-stage aria-label="Connection pool simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">The machine runs 20 times slower than real time. Changing the number of instances scales out or in while it runs; every other setting starts the run again.</p>`;
const controls = panel({
  stats: [["served", "Served per second"], ["p95", "p95 response"], ["waiting", "Waiting for a cab"], ["failed", "Failed requests"], ["open", "Connections open", "– / 60"], ["slow", "Time per query", "×1.0"]],
  controls: [
    seg("pool", "Pool per instance", [[0, "None"], [5, "5"], [10, "10"], [20, "20"]], 10),
    seg("instances", "Instances", [[1, "1"], [2, "2"], [3, "3"], [4, "4"]], 3),
    seg("rate", "Traffic per instance", [[30, "30/s"], [60, "60/s"], [120, "120/s"], [250, "250/s"], [500, "500/s"]], 120),
    seg("api", "External API call", [["none", "None"], ["before", "Before the transaction"], ["inside", "Inside it"]], "none"),
    seg("leak", "Leak", [[0, "None"], [500, "1 in 500"], [50, "1 in 50"]], 0),
    seg("pooler", "Database access", [["off", "Direct"], ["on", "Through a pooler"]], "off"),
    speedSeg(),
    actions("Do something", [["reset", "Start over"], ["pause", "Pause"]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
.cw{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.6}
.dg{fill:none;stroke:var(--anatomy-strong);stroke-width:1.15;stroke-linecap:round;stroke-linejoin:round}
.dg[data-size=l]{stroke-width:1.5}
.dg[data-size=m]{stroke-width:.95}
.pm{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.5}
.pm[data-used]{fill:var(--anatomy-strong);stroke:var(--anatomy-strong)}
.needle{fill:none;stroke:var(--anatomy-strong);stroke-width:1.6;stroke-linecap:round}
[data-col][data-off]{display:none}
`;

// ---------- live code ----------
const live = `
${sim}
${digits}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const CAB_SVG = ${JSON.stringify(cabSvg())};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const SLOW = 20;          // the machine runs 20× slower than real time
const WARM = 1.5;         // each run starts this far in, so the first frame already shows a working rank
const NS = "http://www.w3.org/2000/svg";
const rankSlot = (cx, s) => [cx + G.RANK.dx + (s % G.RANK.cols) * G.RANK.sx, G.RANK.y + Math.floor(s / G.RANK.cols) * G.RANK.sy];

const stage = document.querySelector("[data-rank-stage]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const kerbLayer = q("[data-kerbcabs]");
const cols = G.COLS.map((cx, j) => ({
  cx, rx: cx + G.ROAD.dx, g: q('[data-col="' + j + '"]'), plot: q('[data-plot="' + j + '"]'),
  road: q('[data-roadcabs="' + j + '"]'), rank: q('[data-rankcabs="' + j + '"]'),
  people: Array.from({ length: G.PEOPLE.max }, (_, n) => q('[data-person="' + j + '-' + n + '"]')),
  slots: Array.from({ length: 20 }, (_, s) => q('[data-rankslot="' + j + '-' + s + '"]')),
  lamp: q('[data-booth-lamp="' + j + '"] .iso-solid'),
}));
const permits = [...svg.querySelectorAll("[data-permit]")];
const poolerPanel = q("[data-pooler-panel]");
const lamps = Array.from({ length: 20 }, (_, n) => q('[data-lamp="' + n + '"] .iso-solid'));
const needle = q("[data-needle]");

function counter(name, c) { const cells = counterCells(c); return { c, cells, els: cells.map((_, j) => q('[data-digit="' + name + '-' + j + '"]')), shown: [] }; }
const dials = { open: counter("open", G.COUNTERS.open), wait: G.COUNTERS.wait.map((c, j) => counter("wait" + j, c)) };
function show(dial, v) { digitsOf(v, dial.c.count).forEach((d, j) => { if (dial.shown[j] !== d) { dial.shown[j] = d; dial.els[j].setAttribute("d", digitPath(iso, P, dial.cells[j], d)); } }); }

const cfg = { pool: 10, instances: 3, rate: 120, api: "none", leak: 0, pooler: "off", speed: 1 };
let model, tokens = new Map(), bays = new Map(), snap = true, shownPermits = -1;
let seed = (Date.now() % 1e6) + 1;

function restart() {
  model = makeSim({ instances: cfg.instances, pool: cfg.pool, rate: cfg.rate, api: cfg.api, leak: cfg.leak, pooler: cfg.pooler === "on", stagger: 0.25, live: true }, seed++);
  model.runTo(WARM);
  for (const t of tokens.values()) t.g.remove();
  tokens.clear(); bays.clear(); snap = true;
  poolerPanel.style.display = cfg.pooler === "on" ? "" : "none";
  paint(0);
}

// Where each cab should be. Regions: the rank (in front), the road (between) and the kerb (at the terminal).
const region = (y) => (y > G.RANK_EDGE ? 0 : y < G.KERB_EDGE ? 2 : 1);
const bayAt = (n) => [G.BAY_X0 + (n % G.BAYS_PER_ROW) * G.BAY_STEP, G.BAY_ROWS[Math.floor(n / G.BAYS_PER_ROW)]];
function takeBay(id, rx) {
  if (bays.has(id)) return bays.get(id);
  const used = new Set(bays.values());
  let best = -1, bestCost = Infinity;
  for (let n = 0; n < 2 * G.BAYS_PER_ROW; n++) {
    if (used.has(n)) continue;
    const [x, y] = bayAt(n), cost = Math.abs(x - (rx - 7)) + (y === G.BAY_ROWS[0] ? 1.5 : 0);   // left of the road end, clear of the booth
    if (cost < bestCost) { bestCost = cost; best = n; }
  }
  if (best >= 0) bays.set(id, best);
  return best;
}
// A trip to the kerb (a query) or to the booth (a new connection) is shorter in the model than the drive
// on screen, so once a cab is sent there it finishes the trip and waits a moment before following the model.
const DWELL = 0.35;
function targets() {
  const out = new Map();
  const counts = cols.map(() => ({ stack: 0, layby: 0, lot: 0 }));
  const live = model.conns.filter((c) => c.state !== "closed" || (tokens.get(c.id) || {}).sticky).sort((a, b) => a.since - b.since);
  for (const id of [...bays.keys()]) { const c = model.conns.find((x) => x.id === id); const t = tokens.get(id); if ((!c || c.state !== "query") && !(t && t.sticky && t.sticky.bay === bays.get(id))) bays.delete(id); }
  for (const c of live) {
    const col = cols[c.inst], n = counts[c.inst];
    if (!col) continue;
    const t = tokens.get(c.id);
    let x, y, sticky = null;
    if (c.state === "query") { const b = takeBay(c.id, col.rx); if (b < 0) continue; [x, y] = bayAt(b); sticky = { x, y, bay: b }; }
    else if (c.state === "connecting") { const s = Math.min(n.stack++, G.STACK.max - 1); x = col.rx; y = G.STACK.y + s * G.STACK.step; sticky = { x, y }; }
    else if (t && t.sticky) { x = t.sticky.x; y = t.sticky.y; if (t.sticky.bay === undefined) n.stack++; }
    else if (c.state === "idle") { if (c.slot < 0) continue; [x, y] = rankSlot(col.cx, c.slot); }
    else if (c.state === "gate") { const s = Math.min(n.stack++, G.STACK.max - 1); x = col.rx; y = G.STACK.y + s * G.STACK.step; }
    else if (c.state === "api") { const s = Math.min(n.layby++, G.LAYBY.max - 1); x = col.cx + G.LAYBY.dx; y = G.LAYBY.y + s * G.LAYBY.step; }
    else if (c.state === "leaked") { const s = n.lot++; if (s >= G.LOT.cols * G.LOT.rows) continue; x = col.cx + G.LOT.dx + (s % G.LOT.cols) * G.LOT.sx; y = G.LOT.y + Math.floor(s / G.LOT.cols) * G.LOT.sy; }
    else if (c.state === "closed") continue;
    else continue;
    out.set(c.id, { x, y, col, sticky, lit: !!c.req || !!(t && t.sticky && t.sticky.lit), spawn: c.slot >= 0 && cfg.pool > 0 ? rankSlot(col.cx, c.slot) : [col.rx, G.RANK_EDGE - 0.4] });
  }
  return out;
}
function nextPoint(x, y, tx, ty, rx) {
  const a = region(y), b = region(ty);
  if (a === b) return [tx, ty];
  if (a === 0) return [rx, G.RANK_EDGE - 0.4];
  if (a === 2) return Math.abs(x - rx) > 0.05 ? [rx, y] : [rx, G.KERB_EDGE + 0.4];
  if (Math.abs(x - rx) > 0.05) return [rx, y];
  return b === 2 ? [rx, ty] : [rx, G.RANK_EDGE + 0.4];
}
function move(t, tx, ty, rx, dist) {
  for (let i = 0; i < 6 && dist > 1e-6; i++) {
    const [px, py] = nextPoint(t.x, t.y, tx, ty, rx);
    const dx = px - t.x, dy = py - t.y, len = Math.hypot(dx, dy);
    if (len <= dist) { t.x = px; t.y = py; dist -= len; if (px === tx && py === ty) break; }
    else { t.x += (dx / len) * dist; t.y += (dy / len) * dist; dist = 0; }
  }
}

let wallNow = 0;
function paint(wallDt) {
  wallNow += wallDt;
  // Cabs.
  const want = targets();
  for (const [id, t] of tokens) if (!want.has(id)) { t.g.remove(); tokens.delete(id); }
  const dist = wallDt * 320 * Math.sqrt(cfg.speed);
  const layers = new Map();
  for (const [id, w] of want) {
    let t = tokens.get(id);
    if (!t) {
      const g = document.createElementNS(NS, "g"); g.innerHTML = CAB_SVG;
      const [sx, sy] = snap ? [w.x, w.y] : w.spawn;
      t = { g, solid: g.firstElementChild, pax: g.querySelector("[data-pax]"), x: sx, y: sy, layer: null, lit: null };
      tokens.set(id, t);
    }
    if (w.sticky && !t.sticky) t.sticky = { ...w.sticky, lit: w.lit, at: -1 };
    if (snap) { t.x = w.x; t.y = w.y; t.sticky = null; } else move(t, w.x, w.y, w.col.rx, dist);
    if (t.sticky && Math.abs(t.x - t.sticky.x) + Math.abs(t.y - t.sticky.y) < 0.01) {
      if (t.sticky.at < 0) t.sticky.at = wallNow;
      else if (wallNow - t.sticky.at > DWELL) t.sticky = null;
    }
    t.g.setAttribute("transform", translateAlong(P, [t.x, t.y, 0]));
    if (t.lit !== w.lit) { t.lit = w.lit; t.solid.toggleAttribute("data-lit", w.lit); t.pax.style.display = w.lit ? "" : "none"; }
    const r = region(t.y), layer = r === 2 ? kerbLayer : r === 1 ? w.col.road : w.col.rank;
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer).push(t);
  }
  // Within each layer, draw far cabs first.
  for (const [layer, list] of layers) {
    list.sort((a, b) => depthOf([a.x, a.y, 0], P) - depthOf([b.x, b.y, 0], P));
    let prev = null;
    for (const t of list) { if (t.g.parentNode !== layer || t.g.previousSibling !== prev) layer.insertBefore(t.g, prev ? prev.nextSibling : layer.firstChild); prev = t.g; }
  }
  snap = false;

  // Hotels: which are running, their rank slots, waiting passengers and the counter over the door.
  const recent = (cfg.speed / SLOW) * 0.8;
  cols.forEach((col, j) => {
    const inst = model.instances[j], on = !!(inst && inst.on);
    col.g.toggleAttribute("data-off", !on);
    col.plot.style.display = on ? "none" : "";
    if (!on) return;
    col.slots.forEach((s, n) => { s.style.display = n < cfg.pool ? "" : "none"; });
    const waiting = inst.waiters.length;
    col.people.forEach((p, n) => { p.style.display = n < waiting ? "" : "none"; });
    show(dials.wait[j], Math.min(99, waiting));
    let refusedAt = -9; for (let i = model.refusals.length - 1; i >= 0; i--) if (model.refusals[i][1] === j) { refusedAt = model.refusals[i][0]; break; }
    col.lamp.toggleAttribute("data-lit", model.now - refusedAt < Math.max(recent, RETRY));   // lit while this hotel is being turned away
  });

  // The terminal: permit board, open counter, pooler lamps, gauge.
  const open = model.dbOpen;
  if (open !== shownPermits) { shownPermits = open; permits.forEach((p, n) => p.toggleAttribute("data-used", n < open)); }
  show(dials.open, open);
  if (cfg.pooler === "on") lamps.forEach((l, n) => l.toggleAttribute("data-lit", n < model.pooler.busy));
  const slow = slowdown(model.active);
  const frac = Math.max(0, Math.min(1, Math.log2(slow) / 5));
  const a = G.NEEDLE_SPAN[0] + frac * (G.NEEDLE_SPAN[1] - G.NEEDLE_SPAN[0]);
  const g = G.GAUGE, tip = iso([g.x + Math.sin(a) * (g.r - 1.6), g.y - Math.cos(a) * (g.r - 1.6), g.z], P), tail = iso([g.x - Math.sin(a) * 1.6, g.y + Math.cos(a) * 1.6, g.z], P);
  needle.setAttribute("d", "M" + tail[0].toFixed(1) + " " + tail[1].toFixed(1) + "L" + tip[0].toFixed(1) + " " + tip[1].toFixed(1));

  // Stats and readout.
  const since = Math.max(0.001, Math.min(1, model.now));
  const lastSecond = model.done.filter((d) => d[0] > model.now - since);
  const lat = lastSecond.map((d) => d[1]).sort((x, y) => x - y);
  const p95 = lat.length ? lat[Math.min(lat.length - 1, Math.floor(0.95 * lat.length))] : 0;
  const waiting = model.waiting(), leaked = model.leaked();
  stat("served", Math.round(lastSecond.length / since));
  stat("p95", lat.length ? (p95 < 1 ? Math.round(p95 * 1000) + " ms" : p95.toFixed(2) + " s") : "–");
  stat("waiting", waiting);
  stat("failed", (model.timeouts + model.refused) + (model.refused ? " (" + model.refused + " refused)" : ""));
  stat("open", open + " / 60");
  stat("slow", "×" + slow.toFixed(1));
  say(model.active + " at the kerb · " + waiting + " waiting" + (leaked ? " · " + leaked + " never returned" : "") + " · " + open + " of 60 permits" + (clock && clock.paused ? " · paused" : ""));
}
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(key, value) { const el = statEls[key]; const text = String(value); if (el && el.textContent !== text) el.textContent = text; }

const pauseBtn = document.querySelector('[data-act="pause"]');
let clock = null;
clock = WB.loop({ stage, step: (dt) => { model.runTo(model.now + (dt * cfg.speed) / SLOW); paint(dt); }, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (model) paint(0); } });

function set(name, raw, quiet) {
  WB.pressSeg(name, raw);
  if (name === "speed") { cfg.speed = Number(raw); return; }
  if (name === "instances") { cfg.instances = Number(raw); if (!quiet) { model.scaleTo(cfg.instances); paint(0); } return; }
  if (name === "pool" || name === "rate" || name === "leak") cfg[name] = Number(raw); else cfg[name] = raw;
  if (!quiet) restart();
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="reset"]').addEventListener("click", () => restart());
pauseBtn.addEventListener("click", () => clock.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); clock.toggle(); } });

// ---------- experiments ----------
const ms = (s) => (s < 1 ? Math.round(s * 1000) + " ms" : s.toFixed(2) + " s");
const pct = (x) => Math.round(100 * x) + "%";
let scaleTimer = null;
const RUNS = {
  nopool: () => {
    const r = noPoolVsPool(), top = Math.max(r.none.p50, r.pooled.p50);
    return { verdict: "Typical request: " + ms(r.none.p50) + " opening a connection each time, " + ms(r.pooled.p50) + " with a pool of 10, " + (r.none.p50 / r.pooled.p50).toFixed(1) + " times longer, for the same queries.",
      bars: [["Pool of 10", r.pooled.p50 / top, ms(r.pooled.p50)], ["New connection each time", r.none.p50 / top, ms(r.none.p50), true]] };
  },
  size: () => {
    const rs = poolSizes(), top = Math.max(...rs.map((r) => r.served));
    return { verdict: rs.map((r) => "pool " + r.pool + ": " + Math.round(r.served) + " served/s, each query ×" + slowdown(r.active).toFixed(1) + " slower").join(" · ") + ". The rest of the 1,000 requests a second time out waiting.",
      bars: rs.map((r, i) => ["Pool " + r.pool + " per instance (" + r.pool * 2 + " at once)", r.served / top, Math.round(r.served) + "/s", i > 0]) };
  },
  leak: () => {
    const r = leakRun();
    return { verdict: "Fine at first (" + Math.round(r.firstMinute) + " failures in the first minute), then all 20 connections were leaked after about " + Math.round(r.stoppedAt) + " s and every request timed out. Over 5 minutes, " + pct(r.failShare) + " of requests failed.",
      bars: [["Served normally until", r.stoppedAt / 300, Math.round(r.stoppedAt) + " s of 300"], ["Requests failed over 5 min", r.failShare, pct(r.failShare), true]] };
  },
  api: () => {
    const r = apiInside();
    return { verdict: "API call before the transaction: " + pct(r.before.failShare) + " failed, typical response " + ms(r.before.p50) + ". Inside it: " + pct(r.inside.failShare) + " failed and the typical response was " + ms(r.inside.p50) + ", with the database running about " + r.inside.active.toFixed(1) + " query at a time.",
      bars: [["Failed, API before", r.before.failShare, pct(r.before.failShare)], ["Failed, API inside", r.inside.failShare, pct(r.inside.failShare), true], ["Database queries at once, inside", Math.min(1, r.inside.active / 8), r.inside.active.toFixed(1) + " of 8 it can run at full speed"]] };
  },
  scale: () => {
    const r = scaleOut();
    return { verdict: "Directly: " + Math.round(r.direct.open) + " of 60 connections taken, the fourth instance failed " + pct(r.lastDirect) + " of its requests (" + pct(r.direct.failShare) + " of all traffic). Through the pooler: " + Math.round(r.pooled.open) + " server connections, " + pct(r.pooled.failShare) + " failed.",
      bars: [["Failed, direct", r.direct.failShare, pct(r.direct.failShare), true], ["Fourth instance failing, direct", r.lastDirect, pct(r.lastDirect), true], ["Failed, through a pooler", r.pooled.failShare, pct(r.pooled.failShare)]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  clearTimeout(scaleTimer);
  for (const key of ["pool", "instances", "rate", "api", "leak", "pooler"]) set(key, String(w[key]), true);
  set("speed", String(w.speed || 1), true);
  restart();
  if (clock.paused) clock.setPaused(false);
  if (w.scaleTo) scaleTimer = setTimeout(() => set("instances", String(w.scaleTo)), 4000);
} });

clock.setPaused(clock.paused);
restart();
`;

const size = writePage(new URL("./connection-pool-workbench.html", import.meta.url), {
  title: "Connection Pool Workbench",
  eyebrow: "Systems lesson 29 · Connection pooling",
  lede: "Opening a database connection is slow, and a database can only hold so many. A pool keeps a few open and lends them out; most connection trouble comes from sizing it, holding a connection too long or never giving it back. This lesson builds a pool as a taxi rank: watch it work, predict what breaks it, then explain it back.",
  machine: { intro: "Each hotel is an app instance with its own rank of cabs, its connection pool. A passenger takes a cab to the terminal (the database) and back; a cab at the kerb is a query running. Every cab that exists holds one of the terminal's 60 permits. Try no pool, a bigger pool, an API call inside the transaction, a leak, and scaling out to four hotels.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, run at full speed and averaged over six seeded runs.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote connection-pool-workbench.html", (size / 1024).toFixed(0) + " KB");

// Systems lesson 12 · Pagination. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, folderSvg, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "deep",
    title: "A deep page",
    change: "20,000 rows, 20 per page · page 1 vs page 500",
    question: "How much more work is page 500 than page 1?",
    options: ["About the same for both: the database jumps to the page", "Offset does about 500× the work; cursor stays about the same", "Both get slower, cursor a little less"],
    answer: 1,
    why: "OFFSET 9980 doesn't jump anywhere: the database finds the first 9,980 rows in order and throws them away before returning 20. The work grows with the page number. A cursor (WHERE (created_at, id) < (last values) ORDER BY … LIMIT 20) seeks straight into the index at the last row and reads 20, so page 500 costs what page 2 costs.",
    watch: { mode: "offset", pageSize: 4, inserts: "off", deletes: "off", key: "unique" },
  },
  {
    id: "inserts",
    title: "New rows while you page",
    change: "Offset paging, 10 pages of 20, newest first · about one new row per second while the reader pauses 2 s between pages",
    question: "What does the reader see?",
    options: ["Exactly the rows that were there, once each", "Some rows twice", "Some rows go missing"],
    answer: 1,
    why: "Every new row lands at the front and pushes everything one place back. The next OFFSET then starts that many places too early, so the last rows of the previous page show up again. A cursor asks for rows older than the last one it saw, so new rows at the front don't move its starting point.",
    watch: { mode: "offset", pageSize: 4, inserts: "fast", deletes: "off", key: "unique" },
  },
  {
    id: "deletes",
    title: "Rows deleted while you page",
    change: "Offset paging, 10 pages of 20 · about one row deleted per second from the rows being paged",
    question: "Now rows disappear from pages already read. What does the reader miss?",
    options: ["Only the deleted rows", "Also some rows that were never deleted", "Nothing: deletes only shorten the last page"],
    answer: 1,
    why: "A delete in a page you've already read pulls every later row one place forward, so the next OFFSET starts one row too late and silently skips a row that still exists. Nobody gets an error; the row just never appears. A cursor continues after the last row it saw, wherever that row now sits.",
    watch: { mode: "offset", pageSize: 4, inserts: "off", deletes: "on", key: "unique" },
  },
  {
    id: "ties",
    title: "A cursor on created_at alone",
    change: "Cursor paging, 10 pages of 20 · rows are imported three per second, so created_at has ties · cursor key created_at vs (created_at, id)",
    question: "With WHERE created_at < :last, what happens at page boundaries?",
    options: ["Nothing: timestamps are close enough to unique", "Rows that share the last row's timestamp get skipped", "Rows get repeated on the next page"],
    answer: 1,
    why: "When a page ends in the middle of a second, the other rows from that same second are not older than the last one shown, so WHERE created_at < :last skips them. Changing < to <= repeats them instead. The fix is a unique cursor: order by (created_at, id) and compare the pair, with an index on both columns.",
    watch: { mode: "cursor", pageSize: 4, inserts: "off", deletes: "off", key: "time" },
  },
  {
    id: "jump",
    title: "Jump to page 37",
    change: "20 per page · a user clicks page 37 directly",
    question: "How does each kind of pagination get there?",
    options: ["Cursor jumps there faster than offset", "Offset asks for it in one query; cursor has to walk all 37 pages", "Neither can jump; both walk"],
    answer: 1,
    why: "A cursor only knows where the last page ended, so there is no cursor for page 37 until you've fetched pages 1 to 36. Offset can compute it: OFFSET 720. That's the trade: offset gives page numbers but gets slower and drifts as data changes; cursors are fast and stable but only go next and previous. Infinite scroll and APIs suit cursors; numbered pages over small or stable data suit offset.",
    watch: { mode: "cursor", pageSize: 4, inserts: "off", deletes: "off", key: "unique", jump: true },
  },
];

const QUESTIONS = [
  ["What does OFFSET 10000 LIMIT 20 make the database do?",
    "Read the first 10,020 rows in sort order (through the index or a sort) and throw away 10,000 of them. The cost grows with the offset, so deep pages get slow and use more I/O even though the result is the same 20 rows."],
  ["Write the WHERE clause for the next page of a feed ordered by created_at DESC, id DESC, and the index it needs.",
    "WHERE (created_at, id) < (:last_created_at, :last_id) ORDER BY created_at DESC, id DESC LIMIT 20, with an index on (created_at, id). Where row-value comparison isn't supported: created_at < :t OR (created_at = :t AND id < :id)."],
  ["A user reports seeing the same item twice while scrolling a busy feed, and support can't reproduce it. What's your first guess?",
    "Offset pagination over data that changes: new items arrived between page requests and pushed earlier items onto the next page. Deletes cause the opposite, silently skipped items. Moving to a cursor fixes both."],
  ["Why is a cursor on created_at alone a bug, and when does it show up?",
    "created_at isn't unique. When a page ends partway through rows with the same timestamp (bulk imports, coarse clocks, high write rates), the rest of them are skipped (with <) or repeated (with <=). Add a unique tiebreaker such as id to the order and the cursor."],
  ["Product wants numbered pages with a page picker. When is offset pagination fine?",
    "When the data is small or changes rarely (an admin table, search results capped at a few hundred), and users rarely go deep. Otherwise cap the page depth, or show next/previous with a cursor and offer search or filters instead of page 400."],
  ["What should a cursor in an API response look like?",
    "Opaque to the client: an encoded token (for example base64 of the last created_at and id), returned as next_cursor and passed back as a parameter. Clients shouldn't build or parse it, so you can change the sort or the key later without breaking them."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Filing machine",
  keys: [
    { mark: "lit", label: "The reading head and the folder it is reading" },
    { mark: "raised", label: "Folders, newest at the left; same tab position = same created_at second" },
    { mark: "flat", label: "Dial: rows the current query has read" },
  ],
  caption:
    "The reader fetches one page at a time. In offset mode it starts from the newest folder every time and steps past every folder it skips; the dial counts each one. In cursor mode the clip marks where the last page ended and the carriage seeks straight there. New folders come in at the left and push the rest along. A folder read a second time has a dark tab; a folder that should have been shown and wasn't stands up out of the row.",
  stage: 'data-office aria-label="Pagination simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const controls = panel({
  stats: [["page", "Page"], ["rows", "Rows read"], ["trips", "Queries"], ["dups", "Shown twice"], ["missing", "Never shown"], ["pass", "Reader"]],
  controls: [
    seg("mode", "Pagination", [["offset", "Offset"], ["cursor", "Cursor"]], "offset"),
    seg("pageSize", "Page size", [[4, "4"], [8, "8"]], 4),
    seg("inserts", "New rows", [["off", "None"], ["slow", "Some"], ["fast", "Many"]], "slow"),
    seg("deletes", "Deletes", [["off", "None"], ["on", "Some"]], "off"),
    seg("key", "Cursor key", [["unique", "(created_at, id)"], ["time", "created_at only"]], "unique"),
    speedSeg(),
    actions("Do something", [["jump", "Jump to page 4"], ["reset", "Start over"], ["pause", "Pause"]]),
  ],
});

const css = `
.folder .tab>.iso-top{transition:fill .3s}
.folder[data-seen="1"] .tab>.iso-top{fill:var(--anatomy-lo)}
.folder[data-seen="2"] .tab>.iso-top,.folder[data-seen="2"] .tab>.iso-shade{fill:var(--anatomy-hi)}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const FOLDER_SVG = ${JSON.stringify([0, 1, 2].map((t) => folderSvg(t)))};
const RATES = { off: 0, slow: 0.15, fast: 0.4 };
const NS = "http://www.w3.org/2000/svg";

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const folderBox = q("[data-folders]"), clipEl = q("[data-clip]"), carriage = q("[data-carriage]"), needle = q("[data-needle]");
const headSolid = q("[data-head] .iso-solid");
const slotX = (i) => G.SLOT_X0 + i * G.SLOT_W;
const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

const cfg = { mode: "offset", pageSize: 4, inserts: "slow", deletes: "off", key: "unique", speed: 1 };
let run, clock, pass = 0, current = null, gapUntil = 0, headX = slotX(0), tally = 0, jumping = false;
const els = new Map();
let seed = (Date.now() % 1e6) + 1;

function runCfg(extra = {}) {
  return { mode: cfg.mode, pageSize: cfg.pageSize, pages: Math.floor(28 / cfg.pageSize), rows0: 60, batch: 3, insertRate: RATES[cfg.inserts], deleteRate: cfg.deletes === "on" ? 0.25 : 0, keyUnique: cfg.key === "unique", think: 1.4, stepTime: 0.09, startAt: 0.8, ...extra };
}

function folderEl(id, ts) {
  let f = els.get(id);
  if (f) return f;
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", "folder");
  const inner = document.createElementNS(NS, "g");
  inner.innerHTML = FOLDER_SVG[ts % 3];
  g.appendChild(inner);
  f = { id, g, inner, body: inner.querySelector(".body"), x: null, lift: 0, liftTo: 0, opacity: 1, gone: false };
  els.set(id, f);
  return f;
}

function restart(extra = {}) {
  run = makeRun(runCfg(extra), seed++);
  clock = 0; current = null; gapUntil = 0; tally = 0;
  pass++;
  els.forEach((f) => f.g.remove()); els.clear();
  run.rows.forEach((r, i) => { if (i < G.SLOTS + 2) { const f = folderEl(r.id, r.ts); f.x = slotX(Math.min(i, G.SLOTS)); } });
  reorder();
  stats = { rows: 0, trips: 0, dups: 0, missing: 0, page: 0, lastMissing: 0 };
  showStats();
}

function reorder() {
  run.rows.forEach((r, i) => {
    if (i >= G.SLOTS + 2) return;
    const f = folderEl(r.id, r.ts);
    if (f.x === null) { f.x = slotX(0) - G.SLOT_W; f.opacity = 0; }
    folderBox.appendChild(f.g);
  });
}

let stats;
function onEvent(e) {
  if (e.type === "insert") { reorder(); say("new row #" + e.id + " filed at the front"); }
  else if (e.type === "delete") { const f = els.get(e.id); if (f) { f.gone = true; f.liftTo = 14; } reorder(); say("row #" + e.id + " deleted"); }
  else if (e.type === "query") {
    current = { ...e, marked: 0 };
    tally = 0;
    stats.trips++; stats.page = e.page;
    say((cfg.mode === "offset" ? "page " + e.page + " · OFFSET " + e.skipped + " LIMIT " + cfg.pageSize : e.walking ? "walking · page " + e.page + " after the clip" : "page " + e.page + " · rows after the clip"));
  }
}

// Where the head is during the current query, as a slot position.
function headTarget(u) {
  const e = current, readStart = e.cost - e.ids.length;
  const done = u * e.cost;
  const pos = (n) => { const id = e.ids[Math.max(0, Math.min(e.ids.length - 1, n))]; const i = run.rows.findIndex((r) => r.id === id); return i < 0 ? e.startIndex + n : i; };
  if (done < readStart) {
    if (cfg.mode === "offset") return done;
    return null;
  }
  return pos(Math.floor(done - readStart));
}

function finishPage() {
  const e = current;
  e.ids.forEach((id) => { const f = els.get(id); if (f) { f.g.setAttribute("data-seen", String(Math.min(2, run.seen.get(id) || 1))); f.body.removeAttribute("data-lit"); } });
  stats.rows += e.cost; stats.dups += e.dups.length; stats.missing = e.missing;
  run.rows.forEach((r) => { const f = els.get(r.id); if (f) f.liftTo = 0; });
  // Rows that should have been shown by now but weren't stand up.
  const startMax = 60;
  let minSeen = Infinity; run.seen.forEach((_, id) => { if (id <= startMax) minSeen = Math.min(minSeen, id); });
  run.rows.forEach((r) => { if (r.id >= minSeen && r.id <= startMax && !run.seen.has(r.id)) { const f = els.get(r.id); if (f) f.liftTo = 5; } });
  if (e.dups.length) say("page " + e.page + " · " + e.dups.length + " shown again: #" + e.dups.join(", #"));
  else if (e.missing > stats.lastMissing) say("page " + e.page + " · skipped " + (e.missing - stats.lastMissing) + (cfg.mode === "cursor" ? " (same second as the clip)" : " (rows moved forward)"));
  stats.lastMissing = e.missing;
  showStats();
  current = null;
}

function step(dt) {
  const s = dt * cfg.speed;
  clock += s;
  run.advanceTo(clock, onEvent);
  if (current) {
    const u = Math.min(1, (clock - current.t) / current.duration);
    const target = headTarget(u);
    const readStart = current.cost - current.ids.length, done = u * current.cost;
    tally = Math.min(current.cost, done);
    if (target === null) {
      // Cursor seek: glide from where it is to the clip.
      const to = slotX(Math.min(G.SLOTS - 1, current.startIndex));
      headX += (to - headX) * Math.min(1, s / 0.12);
    } else headX = slotX(Math.min(G.SLOTS - 1, target));
    current.ids.forEach((id, n) => { const f = els.get(id); if (f) f.body.toggleAttribute("data-lit", done >= readStart + n && done < readStart + n + 1.5); });
    headSolid.toggleAttribute("data-lit", done >= readStart);
    if (u >= 1) finishPage();
  } else {
    headSolid.removeAttribute("data-lit");
    if (run.done && !gapUntil) gapUntil = clock + 3.5;
    if (gapUntil && clock > gapUntil) { if (jumping) { jumping = false; } restart(); say("a new reader starts at page 1"); }
  }
  paint(s);
}

function paint(s) {
  const k2 = 1 - Math.exp(-s / 0.14);
  const alive = new Set(run.rows.map((r) => r.id));
  run.rows.forEach((r, i) => {
    const f = els.get(r.id); if (!f) return;
    const tx = i < G.SLOTS ? slotX(i) : G.BIN_X;
    f.x += (tx - f.x) * k2;
    f.opacity += ((i < G.SLOTS ? 1 : 0) - f.opacity) * k2;
  });
  els.forEach((f, id) => {
    if (!alive.has(id)) { f.liftTo = 16; f.opacity -= s / 0.5; if (f.opacity <= 0) { f.g.remove(); els.delete(id); return; } }
    f.lift += (f.liftTo - f.lift) * k2;
    f.g.setAttribute("transform", translateAlong(P, [f.x, 0, 0]));
    f.inner.setAttribute("transform", f.lift > 0.05 ? translateAlong(P, [0, 0, f.lift]) : "");
    f.g.style.opacity = String(Math.max(0, Math.min(1, f.opacity)));
  });
  carriage.setAttribute("transform", translateAlong(P, [headX, 0, 0]));
  needle.setAttribute("d", needleAt(headX, tally / 20));
  const c = run.cursor;
  if (cfg.mode === "cursor" && c) {
    const i = run.rows.findIndex((r) => (cfg.key === "unique" ? r.ts < c.ts || (r.ts === c.ts && r.id < c.id) : r.ts < c.ts));
    const x = i > 0 && i <= G.SLOTS ? slotX(i - 1) : null;
    clipEl.style.display = x === null ? "none" : "";
    if (x !== null) clipEl.setAttribute("transform", translateAlong(P, [x, 0, 0]));
  } else clipEl.style.display = "none";
}

function needleAt(cx, turn) {
  const a = turn * Math.PI * 2, x = cx + G.DIAL.dx, y = G.DIAL.y, r = G.DIAL.r;
  return lineOnTop([x - Math.sin(a) * 0.9, y + Math.cos(a) * 0.9], [x + Math.sin(a) * (r - 1.2), y - Math.cos(a) * (r - 1.2)], G.DIAL.z + 0.1, P);
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function showStats() {
  statEls.page.textContent = stats.page || "–";
  statEls.rows.textContent = stats.rows;
  statEls.trips.textContent = stats.trips;
  statEls.dups.textContent = stats.dups;
  statEls.missing.textContent = stats.missing;
  statEls.pass.textContent = "#" + pass;
}

// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });
function set(name, raw, quiet) {
  cfg[name] = name === "pageSize" || name === "speed" ? Number(raw) : raw;
  WB.pressSeg(name, raw);
  if (name !== "speed" && !quiet) { restart(); say("settings applied · a new reader starts"); }
}
function jump() {
  jumping = true;
  restart({ firstPage: 4, pages: 1, insertRate: 0, deleteRate: 0 });
  say(cfg.mode === "offset" ? "jump to page 4 · one query, OFFSET " + 3 * cfg.pageSize : "jump to page 4 · a cursor has to walk pages 1 to 3 first");
  if (loop.paused) loop.setPaused(false);
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="jump"]').addEventListener("click", jump);
document.querySelector('[data-act="reset"]').addEventListener("click", () => { restart(); say("started over"); });
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const BIG = { pageSize: 20, pages: 10, rows0: 2000, batch: 1, insertRate: 0, deleteRate: 0, keyUnique: true, think: 2, stepTime: 0.0005 };
const fmt = (n) => Math.round(n).toLocaleString("en-US");
function lastCost(mode, pageNo) {
  let cost = 0;
  makeRun({ ...BIG, rows0: 20000, mode, firstPage: pageNo, pages: 1 }, 1).advanceTo(1e9, (e) => { if (e.type === "query") cost = e.cost; });
  return cost;
}
function walk(mode, pageNo) {
  const r = makeRun({ ...BIG, mode, firstPage: pageNo, pages: 1 }, 1).runToEnd();
  return { rows: r.rowsRead, trips: r.roundTrips };
}
const RUNS = {
  deep: () => {
    const o1 = lastCost("offset", 1), o500 = lastCost("offset", 500), c1 = lastCost("cursor", 1), c500 = lastCost("cursor", 500);
    return { verdict: "Rows read for page 1 → page 500: offset " + fmt(o1) + " → " + fmt(o500) + " (" + Math.round(o500 / o1) + "×); cursor " + fmt(c1) + " → " + fmt(c500) + ".",
      bars: [["Offset, page 1", o1 / o500, fmt(o1)], ["Offset, page 500", 1, fmt(o500), true], ["Cursor, page 1", c1 / o500, fmt(c1)], ["Cursor, page 500", c500 / o500, fmt(c500)]] };
  },
  inserts: () => {
    const o = average({ ...BIG, mode: "offset", insertRate: 1 }), c = average({ ...BIG, mode: "cursor", insertRate: 1 }), top = Math.max(o.duplicates, 1);
    return { verdict: "Over 10 pages, with about " + Math.round(o.inserts) + " new rows arriving: offset showed " + o.duplicates.toFixed(1) + " rows twice, cursor " + c.duplicates.toFixed(1) + ".",
      bars: [["Offset", o.duplicates / top, o.duplicates.toFixed(1) + " twice", true], ["Cursor", c.duplicates / top, c.duplicates.toFixed(1) + " twice"]] };
  },
  deletes: () => {
    const o = average({ ...BIG, mode: "offset", deleteRate: 1 }), c = average({ ...BIG, mode: "cursor", deleteRate: 1 }), top = Math.max(o.missing, 1);
    return { verdict: "With about " + Math.round(o.deletes) + " deletes, offset never showed " + o.missing.toFixed(1) + " rows that still exist; cursor missed " + c.missing.toFixed(1) + ".",
      bars: [["Offset", o.missing / top, o.missing.toFixed(1) + " missed", true], ["Cursor", c.missing / top, c.missing.toFixed(1) + " missed"]] };
  },
  ties: () => {
    const t = average({ ...BIG, mode: "cursor", batch: 3, keyUnique: false }), u = average({ ...BIG, mode: "cursor", batch: 3, keyUnique: true }), top = Math.max(t.missing, 1);
    return { verdict: "Over 10 pages (200 rows): " + t.missing.toFixed(0) + " rows skipped with created_at alone, " + u.missing.toFixed(0) + " with (created_at, id).",
      bars: [["created_at only", t.missing / top, t.missing.toFixed(0) + " skipped", true], ["(created_at, id)", u.missing / top, u.missing.toFixed(0) + " skipped"]] };
  },
  jump: () => {
    const o = walk("offset", 37), c = walk("cursor", 37), topR = Math.max(o.rows, c.rows), topT = Math.max(o.trips, c.trips);
    return { verdict: "Offset: " + o.trips + " query reading " + fmt(o.rows) + " rows. Cursor: " + c.trips + " queries reading " + fmt(c.rows) + " rows in all.",
      bars: [["Offset, queries", o.trips / topT, String(o.trips)], ["Cursor, queries", c.trips / topT, String(c.trips), true], ["Offset, rows", o.rows / topR, fmt(o.rows)], ["Cursor, rows", c.rows / topR, fmt(c.rows), true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  for (const name of ["mode", "pageSize", "inserts", "deletes", "key"]) set(name, String(w[name]), true);
  if (w.jump) jump(); else restart();
  if (loop.paused) loop.setPaused(false);
  say("watching: " + exp.title.toLowerCase());
} });

restart();
loop.setPaused(loop.paused);
`;

const size = writePage(new URL("./pagination-workbench.html", import.meta.url), {
  title: "Pagination Workbench",
  eyebrow: "Systems lesson 12 · Pagination",
  lede: "Every list API has to hand data out a page at a time, and the way it remembers where the last page ended decides how fast deep pages are and whether rows get shown twice or never. This lesson builds offset and cursor pagination three ways: watch a machine do it, predict what breaks it, then explain it back.",
  machine: { intro: "The rail is the table, newest folder at the left. Watch the offset reader step past more folders on every page, switch to a cursor, then add new rows or deletes and watch what the reader sees.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, on a 2,000-row table (20,000 for the deep page), averaged over eight seeded readers where timing is random.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote pagination-workbench.html", (size / 1024).toFixed(0) + " KB");

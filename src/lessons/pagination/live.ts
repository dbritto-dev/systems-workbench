// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The filing machine in the browser: runs a reader against the model, slides folders and the carriage to where the
// model has them, wires the controls and the experiment cards. mount() gets the build-time data from page.ts
// (geometry, folder drawings, experiment ids and titles).
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats as statsStrip, act, pauseControls } from "../../runtime/dom";
import { int as fmt } from "../../lib/format";
import { makeRun, average, needlePath } from "./sim";

export default function mount({ P, G, FOLDER_SVG, EXPERIMENTS }) {
  const RATES = { off: 0, slow: 0.15, fast: 0.4 };
  const NS = "http://www.w3.org/2000/svg";

  const stage = document.querySelector("[data-office]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const write = readout();
  const say = (msg) => write(L(msg));
  const folderBox = q("[data-folders]"), clipEl = q("[data-clip]"), carriage = q("[data-carriage]"), needle = q("[data-needle]");
  const headSolid = q("[data-head] .iso-solid");
  const slotX = (i) => G.SLOT_X0 + i * G.SLOT_W;
  const needleAt = (cx, turn) => needlePath(G.DIAL, P, cx, turn);

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
    if (e.type === "insert") { reorder(); say(T("new row #" + e.id + " filed at the front", "fila nueva #" + e.id + " archivada al frente")); }
    else if (e.type === "delete") { const f = els.get(e.id); if (f) { f.gone = true; f.liftTo = 14; } reorder(); say(T("row #" + e.id + " deleted", "fila #" + e.id + " borrada")); }
    else if (e.type === "query") {
      current = { ...e, marked: 0 };
      tally = 0;
      stats.trips++; stats.page = e.page;
      say(cfg.mode === "offset" ? T("page " + e.page + " · OFFSET " + e.skipped + " LIMIT " + cfg.pageSize, "página " + e.page + " · OFFSET " + e.skipped + " LIMIT " + cfg.pageSize)
        : e.walking ? T("walking · page " + e.page + " after the clip", "recorriendo · página " + e.page + " después del clip") : T("page " + e.page + " · rows after the clip", "página " + e.page + " · filas después del clip"));
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
    if (e.dups.length) say(T("page " + e.page + " · " + e.dups.length + " shown again: #" + e.dups.join(", #"), "página " + e.page + " · " + e.dups.length + " mostradas otra vez: #" + e.dups.join(", #")));
    else if (e.missing > stats.lastMissing) say(T("page " + e.page + " · skipped " + (e.missing - stats.lastMissing) + (cfg.mode === "cursor" ? " (same second as the clip)" : " (rows moved forward)"),
      "página " + e.page + " · se saltaron " + (e.missing - stats.lastMissing) + (cfg.mode === "cursor" ? " (mismo segundo que el clip)" : " (las filas se corrieron hacia adelante)")));
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
      if (gapUntil && clock > gapUntil) { if (jumping) { jumping = false; } restart(); say(T("a new reader starts at page 1", "un lector nuevo empieza en la página 1")); }
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

  const stat = statsStrip();
  function showStats() {
    stat("page", stats.page || "–");
    stat("rows", stats.rows);
    stat("trips", stats.trips);
    stat("dups", stats.dups);
    stat("missing", stats.missing);
    stat("pass", "#" + pass);
  }

  // ---------- controls ----------
  const pause = pauseControls(stage, say);
  const loop = WB.loop({ stage, step, onPause: pause.onPause });
  pause.bind(loop);
  function set(name, raw, quiet) {
    cfg[name] = name === "pageSize" || name === "speed" ? Number(raw) : raw;
    WB.pressSeg(name, raw);
    if (name !== "speed" && !quiet) { restart(); say(T("settings applied · a new reader starts", "ajustes aplicados · empieza un lector nuevo")); }
  }
  function jump() {
    jumping = true;
    restart({ firstPage: 4, pages: 1, insertRate: 0, deleteRate: 0 });
    say(cfg.mode === "offset" ? T("jump to page 4 · one query, OFFSET " + 3 * cfg.pageSize, "salto a la página 4 · una consulta, OFFSET " + 3 * cfg.pageSize) : T("jump to page 4 · a cursor has to walk pages 1 to 3 first", "salto a la página 4 · un cursor primero tiene que recorrer las páginas 1 a 3"));
    if (loop.paused) loop.setPaused(false);
  }
  WB.onSegments((name, value) => set(name, value));
  act("jump").addEventListener("click", jump);
  act("reset").addEventListener("click", () => { restart(); say(T("started over", "empezó de nuevo")); });

  // ---------- experiments ----------
  const BIG = { pageSize: 20, pages: 10, rows0: 2000, batch: 1, insertRate: 0, deleteRate: 0, keyUnique: true, think: 2, stepTime: 0.0005 };
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
      return { verdict: T("Rows read for page 1 → page 500: offset " + fmt(o1) + " → " + fmt(o500) + " (" + Math.round(o500 / o1) + "×); cursor " + fmt(c1) + " → " + fmt(c500) + ".",
          "Filas leídas de la página 1 → la página 500: offset " + fmt(o1) + " → " + fmt(o500) + " (" + Math.round(o500 / o1) + "×); cursor " + fmt(c1) + " → " + fmt(c500) + "."),
        bars: [[T("Offset, page 1", "Offset, página 1"), o1 / o500, fmt(o1)], [T("Offset, page 500", "Offset, página 500"), 1, fmt(o500), true], [T("Cursor, page 1", "Cursor, página 1"), c1 / o500, fmt(c1)], [T("Cursor, page 500", "Cursor, página 500"), c500 / o500, fmt(c500)]] };
    },
    inserts: () => {
      const o = average({ ...BIG, mode: "offset", insertRate: 1 }), c = average({ ...BIG, mode: "cursor", insertRate: 1 }), top = Math.max(o.duplicates, 1);
      return { verdict: T("Over 10 pages, with about " + Math.round(o.inserts) + " new rows arriving: offset showed " + o.duplicates.toFixed(1) + " rows twice, cursor " + c.duplicates.toFixed(1) + ".",
          "En 10 páginas, con unas " + Math.round(o.inserts) + " filas nuevas llegando: offset mostró " + o.duplicates.toFixed(1) + " filas dos veces, cursor " + c.duplicates.toFixed(1) + "."),
        bars: [["Offset", o.duplicates / top, T(o.duplicates.toFixed(1) + " twice", o.duplicates.toFixed(1) + " dos veces"), true], ["Cursor", c.duplicates / top, T(c.duplicates.toFixed(1) + " twice", c.duplicates.toFixed(1) + " dos veces")]] };
    },
    deletes: () => {
      const o = average({ ...BIG, mode: "offset", deleteRate: 1 }), c = average({ ...BIG, mode: "cursor", deleteRate: 1 }), top = Math.max(o.missing, 1);
      return { verdict: T("With about " + Math.round(o.deletes) + " deletes, offset never showed " + o.missing.toFixed(1) + " rows that still exist; cursor missed " + c.missing.toFixed(1) + ".",
          "Con unos " + Math.round(o.deletes) + " borrados, offset nunca mostró " + o.missing.toFixed(1) + " filas que todavía existen; cursor se perdió " + c.missing.toFixed(1) + "."),
        bars: [["Offset", o.missing / top, T(o.missing.toFixed(1) + " missed", o.missing.toFixed(1) + " perdidas"), true], ["Cursor", c.missing / top, T(c.missing.toFixed(1) + " missed", c.missing.toFixed(1) + " perdidas")]] };
    },
    ties: () => {
      const t = average({ ...BIG, mode: "cursor", batch: 3, keyUnique: false }), u = average({ ...BIG, mode: "cursor", batch: 3, keyUnique: true }), top = Math.max(t.missing, 1);
      return { verdict: T("Over 10 pages (200 rows): " + t.missing.toFixed(0) + " rows skipped with created_at alone, " + u.missing.toFixed(0) + " with (created_at, id).",
          "En 10 páginas (200 filas): " + t.missing.toFixed(0) + " filas saltadas con solo created_at, " + u.missing.toFixed(0) + " con (created_at, id)."),
        bars: [[T("created_at only", "solo created_at"), t.missing / top, T(t.missing.toFixed(0) + " skipped", t.missing.toFixed(0) + " saltadas"), true], ["(created_at, id)", u.missing / top, T(u.missing.toFixed(0) + " skipped", u.missing.toFixed(0) + " saltadas")]] };
    },
    jump: () => {
      const o = walk("offset", 37), c = walk("cursor", 37), topR = Math.max(o.rows, c.rows), topT = Math.max(o.trips, c.trips);
      return { verdict: T("Offset: " + o.trips + " query reading " + fmt(o.rows) + " rows. Cursor: " + c.trips + " queries reading " + fmt(c.rows) + " rows in all.",
          "Offset: " + o.trips + " consulta que lee " + fmt(o.rows) + " filas. Cursor: " + c.trips + " consultas que leen " + fmt(c.rows) + " filas en total."),
        bars: [[T("Offset, queries", "Offset, consultas"), o.trips / topT, String(o.trips)], [T("Cursor, queries", "Cursor, consultas"), c.trips / topT, String(c.trips), true], [T("Offset, rows", "Offset, filas"), o.rows / topR, fmt(o.rows)], [T("Cursor, rows", "Cursor, filas"), c.rows / topR, fmt(c.rows), true]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    for (const name of ["mode", "pageSize", "inserts", "deletes", "key"]) set(name, String(w[name]), true);
    if (w.jump) jump(); else restart();
    if (loop.paused) loop.setPaused(false);
    say(T("watching: " + exp.title.en.toLowerCase(), "mirando: " + exp.title.es.toLowerCase()));
  } });

  restart();
  loop.setPaused(loop.paused);
}

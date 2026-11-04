// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The filing machine in the browser: runs a reader against the model, slides folders and the carriage to where the
// model has them, and answers the controls. mount() gets the build-time data from page.ts (geometry, folder
// drawings, the experiments' titles) and root, the <wb-lesson>.
import { translateAlong, iso } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { playPause } from "../../runtime/dom";
import { makeRun, needlePath } from "./sim";

export default function mount({ P, G, FOLDER_SVG, TITLES }, root) {
  const RATES = { off: 0, slow: 0.15, fast: 0.4 };
  const NS = "http://www.w3.org/2000/svg";

  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (msg) => root.figure.say(L(msg));
  const folderBox = q("[data-folders]"), clipEl = q("[data-clip]"), carriage = q("[data-carriage]"), needle = q("[data-needle]");
  const headSolid = q("[data-head] .iso-solid");
  const slotX = (i) => G.SLOT_X0 + i * G.SLOT_W;
  const needleAt = (cx, turn) => needlePath(G.DIAL, P, cx, turn);

  const cfg = { mode: "offset", pageSize: 4, inserts: "slow", deletes: "off", key: "unique", speed: 1 };
  let run, clock, pass = 0, current = null, gapUntil = 0, headX = slotX(0), tally = 0, jumping = false;
  const els = new Map();
  let seed = (Date.now() % 1e6) + 1;

  // Phones: crop the figure to the left end of the rail (hopper, card index and the first slots) so folders, tabs and
  // the clip are big enough to see, and keep the reader inside that window with fewer pages per pass.
  const narrowQ = matchMedia("(max-width: 600px)");
  const FULL_BOX = svg.getAttribute("viewBox");
  const NARROW_BOX = (() => {
    const pts = [[G.FEED_X - 16, -18, 36], [G.FEED_X - 16, 50, -17], [slotX(G.NARROW_SLOTS) + 4, 52, 0], [slotX(G.NARROW_SLOTS) + 4, -12, G.READER.beamZ + 4]].map((p) => iso(p, P));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), pad = 8;
    const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
    return [x0, y0, Math.max(...xs) + pad - x0, Math.max(...ys) + pad - y0].map((v) => v.toFixed(1)).join(" ");
  })();
  let narrow = narrowQ.matches;
  const crop = () => svg.setAttribute("viewBox", narrow ? NARROW_BOX : FULL_BOX);
  narrowQ.addEventListener("change", (e) => { narrow = e.matches; crop(); restart(); });
  crop();

  function runCfg(extra = {}) {
    return { mode: cfg.mode, pageSize: cfg.pageSize, pages: Math.floor((narrow ? 16 : 28) / cfg.pageSize), rows0: 60, batch: 3, insertRate: RATES[cfg.inserts], deleteRate: cfg.deletes === "on" ? 0.25 : 0, keyUnique: cfg.key === "unique", think: 1.4, stepTime: 0.09, startAt: 0.8, ...extra };
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
      // The readout carries the rows-read count, which the carriage dial is too small to show on a phone.
      const reads = T(" · reads " + e.cost + (e.cost === 1 ? " row" : " rows"), " · lee " + e.cost + (e.cost === 1 ? " fila" : " filas"));
      const head = cfg.mode === "offset" ? T("page " + e.page + " · OFFSET " + e.skipped + " LIMIT " + cfg.pageSize, "página " + e.page + " · OFFSET " + e.skipped + " LIMIT " + cfg.pageSize)
        : e.walking ? T("walking · page " + e.page + " after the clip", "recorriendo · página " + e.page + " después del clip") : T("page " + e.page + " · rows after the clip", "página " + e.page + " · filas después del clip");
      say(T(head.en + reads.en, head.es + reads.es));
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

  const stat = (key, value) => root.stat(key, value);
  function showStats() {
    stat("page", stats.page || "–");
    stat("rows", stats.rows);
    stat("trips", stats.trips);
    stat("dups", stats.dups);
    stat("missing", stats.missing);
    stat("pass", "#" + pass);
  }

  // ---------- controls ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage, step, onPause: pause.onPause });
  pause.bind(loop);
  function set(name, raw, quiet) {
    cfg[name] = name === "pageSize" || name === "speed" ? Number(raw) : raw;
    root.press(name, raw);
    if (name !== "speed" && !quiet) { restart(); say(T("settings applied · a new reader starts", "ajustes aplicados · empieza un lector nuevo")); }
  }
  function jump() {
    jumping = true;
    restart({ firstPage: 4, pages: 1, insertRate: 0, deleteRate: 0 });
    say(cfg.mode === "offset" ? T("jump to page 4 · one query, OFFSET " + 3 * cfg.pageSize, "salto a la página 4 · una consulta, OFFSET " + 3 * cfg.pageSize) : T("jump to page 4 · a cursor has to walk pages 1 to 3 first", "salto a la página 4 · un cursor primero tiene que recorrer las páginas 1 a 3"));
    if (loop.paused) loop.setPaused(false);
  }
  root.on("change", (name, value) => set(name, value));
  const actions = {
    jump,
    reset: () => { restart(); say(T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w, id) => {
    for (const name of ["mode", "pageSize", "inserts", "deletes", "key"]) set(name, String(w[name]), true);
    if (w.jump) jump(); else restart();
    if (loop.paused) loop.setPaused(false);
    const title = TITLES[id];
    say(T("watching: " + title.en.toLowerCase(), "mirando: " + title.es.toLowerCase()));
  });

  restart();
  loop.setPaused(loop.paused);
}

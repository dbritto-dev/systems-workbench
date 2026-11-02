// Systems lesson 12 · Pagination. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule, t } from "../../workbench/page.mjs";
import { buildFigure, folderSvg, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "deep",
    title: t("A deep page", "Una página profunda"),
    change: t("20,000 rows, 20 per page · page 1 vs page 500", "20,000 filas, 20 por página · página 1 vs página 500"),
    question: t("How much more work is page 500 than page 1?", "¿Cuánto más trabajo es la página 500 que la página 1?"),
    options: [t("About the same for both: the database jumps to the page", "Más o menos lo mismo para las dos: la base de datos salta a la página"), t("Offset does about 500× the work; cursor stays about the same", "Offset hace unas 500× el trabajo; cursor se queda más o menos igual"), t("Both get slower, cursor a little less", "Las dos se vuelven más lentas, cursor un poco menos")],
    answer: 1,
    why: t("OFFSET 9980 doesn't jump anywhere: the database finds the first 9,980 rows in order and throws them away before returning 20. The work grows with the page number. A cursor (WHERE (created_at, id) < (last values) ORDER BY … LIMIT 20) seeks straight into the index at the last row and reads 20, so page 500 costs what page 2 costs.", "OFFSET 9980 no salta a ningún lado: la base de datos encuentra las primeras 9,980 filas en orden y las descarta antes de devolver 20. El trabajo crece con el número de página. Un cursor (WHERE (created_at, id) < (últimos valores) ORDER BY … LIMIT 20) va directo en el índice a la última fila y lee 20, así que la página 500 cuesta lo mismo que la página 2."),
    watch: { mode: "offset", pageSize: 4, inserts: "off", deletes: "off", key: "unique" },
  },
  {
    id: "inserts",
    title: t("New rows while you page", "Filas nuevas mientras paginas"),
    change: t("Offset paging, 10 pages of 20, newest first · about one new row per second while the reader pauses 2 s between pages", "Paginación con offset, 10 páginas de 20, las más nuevas primero · más o menos una fila nueva por segundo mientras el lector hace una pausa de 2 s entre páginas"),
    question: t("What does the reader see?", "¿Qué ve el lector?"),
    options: [t("Exactly the rows that were there, once each", "Exactamente las filas que había, una vez cada una"), t("Some rows twice", "Algunas filas dos veces"), t("Some rows go missing", "Faltan algunas filas")],
    answer: 1,
    why: t("Every new row lands at the front and pushes everything one place back. The next OFFSET then starts that many places too early, so the last rows of the previous page show up again. A cursor asks for rows older than the last one it saw, so new rows at the front don't move its starting point.", "Cada fila nueva cae al frente y empuja todo un lugar hacia atrás. Entonces el siguiente OFFSET empieza esa misma cantidad de lugares demasiado pronto, y las últimas filas de la página anterior vuelven a aparecer. Un cursor pide filas más viejas que la última que vio, así que las filas nuevas al frente no mueven su punto de partida."),
    watch: { mode: "offset", pageSize: 4, inserts: "fast", deletes: "off", key: "unique" },
  },
  {
    id: "deletes",
    title: t("Rows deleted while you page", "Filas borradas mientras paginas"),
    change: t("Offset paging, 10 pages of 20 · about one row deleted per second from the rows being paged", "Paginación con offset, 10 páginas de 20 · más o menos una fila borrada por segundo de las filas que se están paginando"),
    question: t("Now rows disappear from pages already read. What does the reader miss?", "Ahora desaparecen filas de páginas ya leídas. ¿Qué se pierde el lector?"),
    options: [t("Only the deleted rows", "Solo las filas borradas"), t("Also some rows that were never deleted", "También algunas filas que nunca se borraron"), t("Nothing: deletes only shorten the last page", "Nada: los borrados solo acortan la última página")],
    answer: 1,
    why: t("A delete in a page you've already read pulls every later row one place forward, so the next OFFSET starts one row too late and silently skips a row that still exists. Nobody gets an error; the row just never appears. A cursor continues after the last row it saw, wherever that row now sits.", "Un borrado en una página que ya leíste jala todas las filas siguientes un lugar hacia adelante, así que el siguiente OFFSET empieza una fila demasiado tarde y se salta en silencio una fila que todavía existe. Nadie recibe un error; la fila simplemente nunca aparece. Un cursor sigue después de la última fila que vio, esté donde esté ahora esa fila."),
    watch: { mode: "offset", pageSize: 4, inserts: "off", deletes: "on", key: "unique" },
  },
  {
    id: "ties",
    title: t("A cursor on created_at alone", "Un cursor solo sobre created_at"),
    change: t("Cursor paging, 10 pages of 20 · rows are imported three per second, so created_at has ties · cursor key created_at vs (created_at, id)", "Paginación con cursor, 10 páginas de 20 · las filas se importan de tres en tres por segundo, así que created_at tiene empates · clave del cursor created_at vs (created_at, id)"),
    question: t("With WHERE created_at < :last, what happens at page boundaries?", "Con WHERE created_at < :last, ¿qué pasa en los bordes de página?"),
    options: [t("Nothing: timestamps are close enough to unique", "Nada: los timestamps son casi únicos"), t("Rows that share the last row's timestamp get skipped", "Se saltan las filas que comparten el timestamp de la última fila"), t("Rows get repeated on the next page", "Las filas se repiten en la página siguiente")],
    answer: 1,
    why: t("When a page ends in the middle of a second, the other rows from that same second are not older than the last one shown, so WHERE created_at < :last skips them. Changing < to <= repeats them instead. The fix is a unique cursor: order by (created_at, id) and compare the pair, with an index on both columns.", "Cuando una página termina a mitad de un segundo, las otras filas de ese mismo segundo no son más viejas que la última que se mostró, así que WHERE created_at < :last se las salta. Cambiar < por <= las repite en su lugar. La solución es un cursor único: ordenar por (created_at, id) y comparar el par, con un índice sobre las dos columnas."),
    watch: { mode: "cursor", pageSize: 4, inserts: "off", deletes: "off", key: "time" },
  },
  {
    id: "jump",
    title: t("Jump to page 37", "Salta a la página 37"),
    change: t("20 per page · a user clicks page 37 directly", "20 por página · un usuario hace clic directo en la página 37"),
    question: t("How does each kind of pagination get there?", "¿Cómo llega ahí cada tipo de paginación?"),
    options: [t("Cursor jumps there faster than offset", "Cursor salta ahí más rápido que offset"), t("Offset asks for it in one query; cursor has to walk all 37 pages", "Offset la pide en una consulta; cursor tiene que recorrer las 37 páginas"), t("Neither can jump; both walk", "Ninguna puede saltar; las dos recorren")],
    answer: 1,
    why: t("A cursor only knows where the last page ended, so there is no cursor for page 37 until you've fetched pages 1 to 36. Offset can compute it: OFFSET 720. That's the trade: offset gives page numbers but gets slower and drifts as data changes; cursors are fast and stable but only go next and previous. Infinite scroll and APIs suit cursors; numbered pages over small or stable data suit offset.", "Un cursor solo sabe dónde terminó la última página, así que no hay cursor para la página 37 hasta que hayas traído las páginas 1 a 36. Offset la puede calcular: OFFSET 720. Ese es el intercambio: offset da números de página pero se vuelve más lento y se desfasa cuando cambian los datos; los cursores son rápidos y estables pero solo van a la siguiente y a la anterior. El scroll infinito y las APIs encajan con cursores; las páginas numeradas sobre datos pequeños o estables encajan con offset."),
    watch: { mode: "cursor", pageSize: 4, inserts: "off", deletes: "off", key: "unique", jump: true },
  },
];

const QUESTIONS = [
  [t("What does OFFSET 10000 LIMIT 20 make the database do?", "¿Qué le hace hacer OFFSET 10000 LIMIT 20 a la base de datos?"),
    t("Read the first 10,020 rows in sort order (through the index or a sort) and throw away 10,000 of them. The cost grows with the offset, so deep pages get slow and use more I/O even though the result is the same 20 rows.", "Leer las primeras 10,020 filas en el orden pedido (con el índice o con un ordenamiento) y descartar 10,000. El costo crece con el offset, así que las páginas profundas se vuelven lentas y usan más E/S aunque el resultado sean las mismas 20 filas.")],
  [t("Write the WHERE clause for the next page of a feed ordered by created_at DESC, id DESC, and the index it needs.", "Escribe la cláusula WHERE para la página siguiente de un feed ordenado por created_at DESC, id DESC, y el índice que necesita."),
    t("WHERE (created_at, id) < (:last_created_at, :last_id) ORDER BY created_at DESC, id DESC LIMIT 20, with an index on (created_at, id). Where row-value comparison isn't supported: created_at < :t OR (created_at = :t AND id < :id).", "WHERE (created_at, id) < (:last_created_at, :last_id) ORDER BY created_at DESC, id DESC LIMIT 20, con un índice sobre (created_at, id). Donde no se puede comparar tuplas de valores: created_at < :t OR (created_at = :t AND id < :id).")],
  [t("A user reports seeing the same item twice while scrolling a busy feed, and support can't reproduce it. What's your first guess?", "Un usuario reporta que vio el mismo elemento dos veces al hacer scroll en un feed con mucho movimiento, y soporte no lo puede reproducir. ¿Cuál es tu primera sospecha?"),
    t("Offset pagination over data that changes: new items arrived between page requests and pushed earlier items onto the next page. Deletes cause the opposite, silently skipped items. Moving to a cursor fixes both.", "Paginación con offset sobre datos que cambian: llegaron elementos nuevos entre una petición de página y otra y empujaron elementos anteriores a la página siguiente. Los borrados causan lo contrario, elementos saltados en silencio. Pasar a un cursor arregla las dos cosas.")],
  [t("Why is a cursor on created_at alone a bug, and when does it show up?", "¿Por qué un cursor solo sobre created_at es un bug, y cuándo aparece?"),
    t("created_at isn't unique. When a page ends partway through rows with the same timestamp (bulk imports, coarse clocks, high write rates), the rest of them are skipped (with <) or repeated (with <=). Add a unique tiebreaker such as id to the order and the cursor.", "created_at no es único. Cuando una página termina a mitad de filas con el mismo timestamp (importaciones masivas, relojes de baja resolución, muchas escrituras por segundo), el resto se salta (con <) o se repite (con <=). Agrega un desempate único, como id, al orden y al cursor.")],
  [t("Product wants numbered pages with a page picker. When is offset pagination fine?", "Producto quiere páginas numeradas con un selector de página. ¿Cuándo está bien la paginación con offset?"),
    t("When the data is small or changes rarely (an admin table, search results capped at a few hundred), and users rarely go deep. Otherwise cap the page depth, or show next/previous with a cursor and offer search or filters instead of page 400.", "Cuando los datos son pocos o cambian rara vez (una tabla de administración, resultados de búsqueda limitados a unos cientos), y los usuarios casi nunca llegan lejos. Si no, limita la profundidad de página, o muestra siguiente/anterior con un cursor y ofrece búsqueda o filtros en lugar de la página 400.")],
  [t("What should a cursor in an API response look like?", "¿Cómo debería verse un cursor en la respuesta de una API?"),
    t("Opaque to the client: an encoded token (for example base64 of the last created_at and id), returned as next_cursor and passed back as a parameter. Clients shouldn't build or parse it, so you can change the sort or the key later without breaking them.", "Opaco para el cliente: un token codificado (por ejemplo, base64 del último created_at e id), devuelto como next_cursor y enviado de vuelta como parámetro. Los clientes no deberían construirlo ni interpretarlo, así puedes cambiar el orden o la clave después sin romperlos.")],
];

// ---------- page ----------
const figure = figurePlate({
  title: t("Filing machine", "Archivador"),
  keys: [
    { mark: "lit", label: t("The reading head and the folder it is reading", "El cabezal de lectura y la carpeta que está leyendo") },
    { mark: "raised", label: t("Folders, newest at the left; same tab position = same created_at second", "Carpetas, la más nueva a la izquierda; misma posición de pestaña = mismo segundo de created_at") },
    { mark: "flat", label: t("Dial: rows the current query has read", "Dial: filas que leyó la consulta actual") },
  ],
  caption:
    t("The reader fetches one page at a time. In offset mode it starts from the newest folder every time and steps past every folder it skips; the dial counts each one. In cursor mode the clip marks where the last page ended and the carriage seeks straight there. New folders come in at the left and push the rest along. A folder read a second time has a dark tab; a folder that should have been shown and wasn't stands up out of the row.", "El lector trae una página a la vez. En modo offset empieza cada vez desde la carpeta más nueva y pasa por cada carpeta que se salta; el dial cuenta cada una. En modo cursor el clip marca dónde terminó la última página y el carro va directo ahí. Las carpetas nuevas entran por la izquierda y empujan al resto. Una carpeta leída por segunda vez tiene la pestaña oscura; una carpeta que debió mostrarse y no se mostró sobresale de la fila."),
  stage: "data-office",
  stageLabel: t("Pagination simulation. Space pauses or resumes.", "Simulación de paginación. La barra espaciadora pausa o reanuda."),
  svg: buildFigure(),
});

const controls = panel({
  stats: [["page", t("Page", "Página")], ["rows", t("Rows read", "Filas leídas")], ["trips", t("Queries", "Consultas")], ["dups", t("Shown twice", "Mostradas dos veces")], ["missing", t("Never shown", "Nunca mostradas")], ["pass", t("Reader", "Lector")]],
  controls: [
    seg("mode", t("Pagination", "Paginación"), [["offset", "Offset"], ["cursor", "Cursor"]], "offset"),
    seg("pageSize", t("Page size", "Tamaño de página"), [[4, "4"], [8, "8"]], 4),
    seg("inserts", t("New rows", "Filas nuevas"), [["off", t("None", "Ninguna")], ["slow", t("Some", "Algunas")], ["fast", t("Many", "Muchas")]], "slow"),
    seg("deletes", t("Deletes", "Filas borradas"), [["off", t("None", "Ninguna")], ["on", t("Some", "Algunas")]], "off"),
    seg("key", t("Cursor key", "Clave del cursor"), [["unique", "(created_at, id)"], ["time", t("created_at only", "solo created_at")]], "unique"),
    speedSeg(),
    actions(t("Do something", "Haz algo"), [["jump", t("Jump to page 4", "Saltar a la página 4")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]]),
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
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, title, answer, watch }) => ({ id, title, answer, watch })))};
const FOLDER_SVG = ${JSON.stringify([0, 1, 2].map((t) => folderSvg(t)))};
const RATES = { off: 0, slow: 0.15, fast: 0.4 };
const NS = "http://www.w3.org/2000/svg";

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const { T, L } = WB;
// Readouts are kept as { en, es } so a language switch can redraw the last one.
let lastSay = "";
const say = (msg) => { lastSay = msg; const text = L(msg); if (readout.textContent !== text) readout.textContent = text; };
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
const loop = WB.loop({ stage, step, onPause: (on) => { pauseBtn.textContent = on ? L("Play", "Reanudar") : L("Pause", "Pausa"); if (on) say(T("paused", "en pausa")); } });
WB.onLang(() => { pauseBtn.textContent = loop.paused ? L("Play", "Reanudar") : L("Pause", "Pausa"); say(lastSay); });
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
document.querySelector('[data-act="jump"]').addEventListener("click", jump);
document.querySelector('[data-act="reset"]').addEventListener("click", () => { restart(); say(T("started over", "empezó de nuevo")); });
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
`;

const size = writePage(new URL("./pagination-workbench.html", import.meta.url), {
  title: t("Pagination Workbench", "Banco de trabajo: paginación"),
  eyebrow: t("Systems lesson 12 · Pagination", "Lección de sistemas 12 · Paginación"),
  lede: t("Every list API has to hand data out a page at a time, and the way it remembers where the last page ended decides how fast deep pages are and whether rows get shown twice or never. This lesson builds offset and cursor pagination three ways: watch a machine do it, predict what breaks it, then explain it back.", "Toda API de listados tiene que entregar los datos de a una página, y la forma en que recuerda dónde terminó la última página decide qué tan rápidas son las páginas profundas y si algunas filas se muestran dos veces o nunca. Esta lección arma la paginación con offset y con cursor de tres formas: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: { intro: t("The rail is the table, newest folder at the left. Watch the offset reader step past more folders on every page, switch to a cursor, then add new rows or deletes and watch what the reader sees.", "El riel es la tabla, con la carpeta más nueva a la izquierda. Mira cómo el lector con offset pasa por más carpetas en cada página, cambia a un cursor, y después agrega filas nuevas o borrados y mira qué ve el lector."), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, on a 2,000-row table (20,000 for the deep page), averaged over eight seeded readers where timing is random.", "Cada experimento cambia una sola cosa. Elige qué esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, sobre una tabla de 2,000 filas (20,000 para la página profunda), promediados sobre ocho lectores con semilla fija cuando los tiempos son aleatorios."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote pagination-workbench.html", (size / 1024).toFixed(0) + " KB");

// @ts-nocheck: content ported as-is
// Systems lesson 12 · Pagination: a filing machine that hands out a table one page at a time, by offset or by cursor.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { int as fmt } from "../../lib/format";
import { buildFigure, folderSvg, P, GEOMETRY } from "./figure";
import { makeRun, average } from "./sim";

// What each card shows after a run, worked out from the same model as the machine (sim.ts).
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
    return { verdict: t("Rows read for page 1 → page 500: offset " + fmt(o1) + " → " + fmt(o500) + " (" + Math.round(o500 / o1) + "×); cursor " + fmt(c1) + " → " + fmt(c500) + ".",
        "Filas leídas de la página 1 → la página 500: offset " + fmt(o1) + " → " + fmt(o500) + " (" + Math.round(o500 / o1) + "×); cursor " + fmt(c1) + " → " + fmt(c500) + "."),
      bars: [[t("Offset, page 1", "Offset, página 1"), o1 / o500, fmt(o1)], [t("Offset, page 500", "Offset, página 500"), 1, fmt(o500), true], [t("Cursor, page 1", "Cursor, página 1"), c1 / o500, fmt(c1)], [t("Cursor, page 500", "Cursor, página 500"), c500 / o500, fmt(c500)]] };
  },
  inserts: () => {
    const o = average({ ...BIG, mode: "offset", insertRate: 1 }), c = average({ ...BIG, mode: "cursor", insertRate: 1 }), top = Math.max(o.duplicates, 1);
    return { verdict: t("Over 10 pages, with about " + Math.round(o.inserts) + " new rows arriving: offset showed " + o.duplicates.toFixed(1) + " rows twice, cursor " + c.duplicates.toFixed(1) + ".",
        "En 10 páginas, con unas " + Math.round(o.inserts) + " filas nuevas llegando: offset mostró " + o.duplicates.toFixed(1) + " filas dos veces, cursor " + c.duplicates.toFixed(1) + "."),
      bars: [["Offset", o.duplicates / top, t(o.duplicates.toFixed(1) + " twice", o.duplicates.toFixed(1) + " dos veces"), true], ["Cursor", c.duplicates / top, t(c.duplicates.toFixed(1) + " twice", c.duplicates.toFixed(1) + " dos veces")]] };
  },
  deletes: () => {
    const o = average({ ...BIG, mode: "offset", deleteRate: 1 }), c = average({ ...BIG, mode: "cursor", deleteRate: 1 }), top = Math.max(o.missing, 1);
    return { verdict: t("With about " + Math.round(o.deletes) + " deletes, offset never showed " + o.missing.toFixed(1) + " rows that still exist; cursor missed " + c.missing.toFixed(1) + ".",
        "Con unos " + Math.round(o.deletes) + " borrados, offset nunca mostró " + o.missing.toFixed(1) + " filas que todavía existen; cursor se perdió " + c.missing.toFixed(1) + "."),
      bars: [["Offset", o.missing / top, t(o.missing.toFixed(1) + " missed", o.missing.toFixed(1) + " perdidas"), true], ["Cursor", c.missing / top, t(c.missing.toFixed(1) + " missed", c.missing.toFixed(1) + " perdidas")]] };
  },
  ties: () => {
    const tie = average({ ...BIG, mode: "cursor", batch: 3, keyUnique: false }), u = average({ ...BIG, mode: "cursor", batch: 3, keyUnique: true }), top = Math.max(tie.missing, 1);
    return { verdict: t("Over 10 pages (200 rows): " + tie.missing.toFixed(0) + " rows skipped with created_at alone, " + u.missing.toFixed(0) + " with (created_at, id).",
        "En 10 páginas (200 filas): " + tie.missing.toFixed(0) + " filas saltadas con solo created_at, " + u.missing.toFixed(0) + " con (created_at, id)."),
      bars: [[t("created_at only", "solo created_at"), tie.missing / top, t(tie.missing.toFixed(0) + " skipped", tie.missing.toFixed(0) + " saltadas"), true], ["(created_at, id)", u.missing / top, t(u.missing.toFixed(0) + " skipped", u.missing.toFixed(0) + " saltadas")]] };
  },
  jump: () => {
    const o = walk("offset", 37), c = walk("cursor", 37), topR = Math.max(o.rows, c.rows), topT = Math.max(o.trips, c.trips);
    return { verdict: t("Offset: " + o.trips + " query reading " + fmt(o.rows) + " rows. Cursor: " + c.trips + " queries reading " + fmt(c.rows) + " rows in all.",
        "Offset: " + o.trips + " consulta que lee " + fmt(o.rows) + " filas. Cursor: " + c.trips + " consultas que leen " + fmt(c.rows) + " filas en total."),
      bars: [[t("Offset, queries", "Offset, consultas"), o.trips / topT, String(o.trips)], [t("Cursor, queries", "Cursor, consultas"), c.trips / topT, String(c.trips), true], [t("Offset, rows", "Offset, filas"), o.rows / topR, fmt(o.rows)], [t("Cursor, rows", "Cursor, filas"), c.rows / topR, fmt(c.rows), true]] };
  },
};

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

export default defineLesson({
  title: t("Pagination Workbench", "Banco de trabajo: paginación"),
  eyebrow: t("Systems lesson 12 · Pagination", "Lección de sistemas 12 · Paginación"),
  lede: t("Every list API has to hand data out a page at a time, and the way it remembers where the last page ended decides how fast deep pages are and whether rows get shown twice or never. This lesson builds offset and cursor pagination three ways: watch a machine do it, predict what breaks it, then explain it back.", "Toda API de listados tiene que entregar los datos de a una página, y la forma en que recuerda dónde terminó la última página decide qué tan rápidas son las páginas profundas y si algunas filas se muestran dos veces o nunca. Esta lección arma la paginación con offset y con cursor de tres formas: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: {
    intro: t("The rail is the table, newest folder at the left. Watch the offset reader step past more folders on every page, switch to a cursor, then add new rows or deletes and watch what the reader sees.", "El riel es la tabla, con la carpeta más nueva a la izquierda. Mira cómo el lector con offset pasa por más carpetas en cada página, cambia a un cursor, y después agrega filas nuevas o borrados y mira qué ve el lector."),
    plate: {
      title: t("Filing machine", "Archivador"),
      keys: [
        { mark: "lit", label: t("The reading head and the folder it is reading", "El cabezal de lectura y la carpeta que está leyendo") },
        { mark: "raised", label: t("Folders, newest at the left; same tab position = same created_at second", "Carpetas, la más nueva a la izquierda; misma posición de pestaña = mismo segundo de created_at") },
        { mark: "flat", label: t("Dial: rows the current query has read", "Dial: filas que leyó la consulta actual") },
      ],
      caption:
        t("The reader fetches one page at a time. In offset mode it starts from the newest folder every time and steps past every folder it skips; the dial counts each one. In cursor mode the clip marks where the last page ended and the carriage seeks straight there. New folders come in at the left and push the rest along. A folder read a second time has a dark tab; a folder that should have been shown and wasn't stands up out of the row.", "El lector trae una página a la vez. En modo offset empieza cada vez desde la carpeta más nueva y pasa por cada carpeta que se salta; el dial cuenta cada una. En modo cursor el clip marca dónde terminó la última página y el carro va directo ahí. Las carpetas nuevas entran por la izquierda y empujan al resto. Una carpeta leída por segunda vez tiene la pestaña oscura; una carpeta que debió mostrarse y no se mostró sobresale de la fila."),
      stage: { "data-office": "" },
      label: t("Pagination simulation. Space pauses or resumes.", "Simulación de paginación. La barra espaciadora pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["page", t("Page", "Página")], ["rows", t("Rows read", "Filas leídas")], ["trips", t("Queries", "Consultas")], ["dups", t("Shown twice", "Mostradas dos veces")], ["missing", t("Never shown", "Nunca mostradas")], ["pass", t("Reader", "Lector")]],
    controls: [
      { seg: "mode", label: t("Pagination", "Paginación"), options: [["offset", "Offset"], ["cursor", "Cursor"]], value: "offset" },
      { seg: "pageSize", label: t("Page size", "Tamaño de página"), options: [[4, "4"], [8, "8"]], value: 4 },
      { seg: "inserts", label: t("New rows", "Filas nuevas"), options: [["off", t("None", "Ninguna")], ["slow", t("Some", "Algunas")], ["fast", t("Many", "Muchas")]], value: "slow" },
      { seg: "deletes", label: t("Deletes", "Filas borradas"), options: [["off", t("None", "Ninguna")], ["on", t("Some", "Algunas")]], value: "off" },
      { seg: "key", label: t("Cursor key", "Clave del cursor"), options: [["unique", "(created_at, id)"], ["time", t("created_at only", "solo created_at")]], value: "unique" },
      { speed: true },
      { actions: [["jump", t("Jump to page 4", "Saltar a la página 4")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, on a 2,000-row table (20,000 for the deep page), averaged over eight seeded readers where timing is random.", "Cada experimento cambia una sola cosa. Elige qué esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, sobre una tabla de 2,000 filas (20,000 para la página profunda), promediados sobre ocho lectores con semilla fija cuando los tiempos son aleatorios."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  css: `
.folder .tab>.iso-top{transition:fill .3s}
.folder[data-seen="1"] .tab>.iso-top{fill:var(--anatomy-lo)}
.folder[data-seen="2"] .tab>.iso-top,.folder[data-seen="2"] .tab>.iso-shade{fill:var(--anatomy-hi)}
`,
  data: {
    P,
    G: GEOMETRY,
    FOLDER_SVG: [0, 1, 2].map((tab) => folderSvg(tab)),
    // The Watch handler names the experiment in the readout.
    TITLES: Object.fromEntries(EXPERIMENTS.map(({ id, title }) => [id, title])),
  },
});

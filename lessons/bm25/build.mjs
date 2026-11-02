// Systems lesson 35 · BM25. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule, t } from "../../workbench/page.mjs";
import { buildFigure, P, GEOMETRY } from "./figure.mjs";
import { rareRun, stuffRun, lengthRun, exactRun, stopRun } from "./sim.js";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- results (computed once here from the same model the page runs) ----------
const R = { rare: rareRun(), stuff: stuffRun(), length: lengthRun(), exact: exactRun(), stop: stopRun() };
const f2 = (x) => x.toFixed(2);
const f1 = (x) => x.toFixed(1);

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "rare",
    title: t("A common word against a rare one", "Una palabra común contra una rara"),
    change: t("Query “the printer” · D35, the office guide, says “the” " + R.rare.guideThe + " times and never “printer” · D06, a printer checklist, says “printer” once",
      "Consulta “the printer” · D35, la guía de la oficina, dice “the” " + R.rare.guideThe + " veces y nunca “printer” · D06, una lista de verificación de impresoras, dice “printer” una vez"),
    question: t("Which of the two ranks higher?", "¿Cuál de los dos queda más arriba?"),
    options: [t("D35: " + R.rare.guideThe + " matches beat one", "D35: " + R.rare.guideThe + " coincidencias le ganan a una"), t("D06, by far: “the” is in every document, so it weighs almost nothing", "D06, por mucho: “the” está en todos los documentos, así que casi no pesa"), t("They tie: each matches one query term", "Empatan: cada uno coincide con un término de la consulta")],
    answer: 1,
    why: t("IDF is about how many documents a term appears in. “the” is in all " + R.rare.N + ", so its IDF is " + f2(R.rare.idfThe) + "; “printer” is in " + R.rare.dfPrinter + ", so its IDF is " + f2(R.rare.idfPrinter) + ", about 140 times heavier. Repeating a feather " + R.rare.guideThe + " times still gives a feather. On the bench, “the” is a weight you can barely see, and D35's pan gets a disc too thin to read.",
      "El IDF depende de en cuántos documentos aparece un término. “the” está en los " + R.rare.N + ", así que su IDF es " + f2(R.rare.idfThe) + "; “printer” está en " + R.rare.dfPrinter + ", así que su IDF es " + f2(R.rare.idfPrinter) + ", unas 140 veces más pesado. Repetir una pluma " + R.rare.guideThe + " veces sigue dando una pluma. En el banco, “the” es una pesa que apenas se ve, y el platillo de D35 recibe un disco demasiado delgado para leerse."),
    watch: { q: "the printer", k1: "1.2", b: "0.75" },
  },
  {
    id: "stuff",
    title: t("Keyword stuffing", "Relleno de palabras clave (keyword stuffing)"),
    change: t("D16 (“Cheap flights to Lisbon …”) repeats “cheap” 20 times instead of once · query “cheap flights” · k1 = 1.2, b = 0.75",
      "D16 (“Cheap flights to Lisbon …”) repite “cheap” 20 veces en vez de una · consulta “cheap flights” · k1 = 1.2, b = 0.75"),
    question: t("How much bigger does the “cheap” part of D16's score get?", "¿Cuánto crece la parte de “cheap” en el puntaje de D16?"),
    options: [t("About 20 times bigger", "Unas 20 veces"), t("About " + f1(R.stuff.k12[5].s / R.stuff.k12[0].s) + " times, and the last few repeats add almost nothing", "Unas " + f1(R.stuff.k12[5].s / R.stuff.k12[0].s) + " veces, y las últimas repeticiones casi no suman"), t("Not at all: only the first occurrence counts", "Nada: solo cuenta la primera aparición")],
    answer: 1,
    why: t("BM25 bends term frequency toward a ceiling of IDF × (k1 + 1): with k1 = 1.2 the “cheap” part goes " + f2(R.stuff.k12[0].s) + " → " + f2(R.stuff.k12[3].s) + " at 5 repeats → " + f2(R.stuff.k12[5].s) + " at 20, against a ceiling of " + f2(R.stuff.cap12) + ". Each repeat also makes D16 longer, which costs it a little more. k1 = 0 ignores repeats entirely (only presence counts); k1 = 3 lets them count for longer (" + f2(R.stuff.k3[5].s) + " at 20). Raw term frequency, as in plain TF-IDF, would have gone up 20×.",
      "BM25 curva la frecuencia del término hacia un techo de IDF × (k1 + 1): con k1 = 1.2 la parte de “cheap” pasa de " + f2(R.stuff.k12[0].s) + " a " + f2(R.stuff.k12[3].s) + " con 5 repeticiones y a " + f2(R.stuff.k12[5].s) + " con 20, frente a un techo de " + f2(R.stuff.cap12) + ". Cada repetición además alarga D16, lo que le cuesta un poco más. k1 = 0 ignora por completo las repeticiones (solo cuenta la presencia); k1 = 3 las deja contar por más tiempo (" + f2(R.stuff.k3[5].s) + " con 20). La frecuencia cruda, como en TF-IDF simple, habría subido 20×."),
    watch: { q: "cheap flights", k1: "1.2", b: "0.75", stuff: true },
  },
  {
    id: "length",
    title: t("A short and a long document", "Un documento corto y uno largo"),
    change: t("Query “kernel panic” · D03 (" + R.length.lenShort + " words) and D36 (" + R.length.lenLong + " words) each say “kernel” once and “panic” once · the average document is " + f1(R.length.avg) + " words · b = 0.75",
      "Consulta “kernel panic” · D03 (" + R.length.lenShort + " palabras) y D36 (" + R.length.lenLong + " palabras) dicen “kernel” una vez y “panic” una vez · el documento promedio tiene " + f1(R.length.avg) + " palabras · b = 0.75"),
    question: t("How do their scores compare?", "¿Cómo se comparan sus puntajes?"),
    options: [t("The same: identical matches", "Igual: las coincidencias son idénticas"), t("D03 scores about " + f1(R.length.b75.ratio) + " times as much as D36", "D03 suma unas " + f1(R.length.b75.ratio) + " veces lo que suma D36"), t("D36 scores more: it has more text about the topic", "D36 suma más: tiene más texto sobre el tema")],
    answer: 1,
    why: t("A match in a short document says more about what the document is about than the same match lost in a long one. b decides how much length counts: with b = 0 both score " + f2(R.length.b0.short) + "; with b = 0.75 D03 scores " + f2(R.length.b75.short) + " and D36 " + f2(R.length.b75.long) + "; with b = 1 the gap grows to " + f1(R.length.b1.ratio) + "×. On the bench, look at the LEN gauges: the needle stands at the middle for an average length.",
      "Una coincidencia en un documento corto dice más sobre de qué trata que la misma coincidencia perdida en uno largo. b decide cuánto cuenta la longitud: con b = 0 ambos suman " + f2(R.length.b0.short) + "; con b = 0.75 D03 suma " + f2(R.length.b75.short) + " y D36 " + f2(R.length.b75.long) + "; con b = 1 la diferencia crece a " + f1(R.length.b1.ratio) + "×. En el banco, mira los medidores LONG: la aguja queda en el medio para una longitud promedio."),
    watch: { q: "kernel panic", k1: "1.2", b: "0.75" },
  },
  {
    id: "exact",
    title: t("An error code, and the same problem in other words", "Un código de error, y el mismo problema con otras palabras"),
    change: t("D08 is the article about ERR_CONNECTION_RESET · query 1: “ERR_CONNECTION_RESET” · query 2: “browser keeps dropping the link to the website”",
      "D08 es el artículo sobre ERR_CONNECTION_RESET · consulta 1: “ERR_CONNECTION_RESET” · consulta 2: “browser keeps dropping the link to the website”"),
    question: t("Where does D08 rank for each query?", "¿En qué puesto queda D08 en cada consulta?"),
    options: [t("First for both", "Primero en las dos"), t("First for the code, by a wide margin; " + R.exact.paraRank + "th for the description, below articles that share “link” or “website”", "Primero con el código, con mucha ventaja; puesto " + R.exact.paraRank + " con la descripción, debajo de artículos que comparten “link” o “website”"), t("Low for the code: a single word is not enough evidence", "Abajo con el código: una sola palabra no es evidencia suficiente")],
    answer: 1,
    why: t("The code is one rare token that appears in exactly one document, so D08 scores " + f2(R.exact.codeScore) + " and everything else 0: exact identifiers, product numbers and error strings are what BM25 is best at. The description shares no word with D08 except “the”, so D08 scores " + f2(R.exact.paraScore) + " and the top result is " + R.exact.paraTop + ", which matched “" + R.exact.paraTopTerms.filter((w) => w !== "the").join("”, “") + "”. BM25 matches words, not meaning: that vocabulary gap is what semantic search (lesson 36) closes, and why hybrid search (lesson 38) runs both.",
      "El código es un único token raro que aparece en exactamente un documento, así que D08 suma " + f2(R.exact.codeScore) + " y todos los demás 0: identificadores exactos, números de producto y cadenas de error son lo que BM25 mejor hace. La descripción no comparte ninguna palabra con D08 salvo “the”, así que D08 suma " + f2(R.exact.paraScore) + " y el primer resultado es " + R.exact.paraTop + ", que coincidió con “" + R.exact.paraTopTerms.filter((w) => w !== "the").join("”, “") + "”. BM25 compara palabras, no significados: esa brecha de vocabulario es la que cierra la búsqueda semántica (lección 36), y por eso la búsqueda híbrida (lección 38) usa las dos."),
    watch: { q: "browser keeps dropping the link to the website", k1: "1.2", b: "0.75" },
  },
  {
    id: "stop",
    title: t("Adding “the” to the query", "Agregar “the” a la consulta"),
    change: t("Query “kernel panic” → “the kernel panic” · no stop-word list", "Consulta “kernel panic” → “the kernel panic” · sin lista de palabras vacías (stop words)"),
    question: t("What happens to the top five?", "¿Qué pasa con los cinco primeros?"),
    options: [t("Documents with lots of “the” move up", "Suben los documentos con mucho “the”"), t("Nothing: same five in the same order; the top score rises by " + f2(R.stop.gain), "Nada: los mismos cinco en el mismo orden; el puntaje más alto sube " + f2(R.stop.gain)), t("Every score roughly halves, because the query got longer", "Todos los puntajes bajan más o menos a la mitad, porque la consulta se alargó")],
    answer: 1,
    why: t("BM25 needs no stop-word list for this: “the” is in all " + R.stop.N + " documents, so its IDF is " + f2(R.stop.idfThe) + " against " + f2(R.stop.idfKernel) + " for “kernel”. Words in the middle are another matter: “on” is in 15 of 36 documents and still adds about 0.9 a match. Stop-word lists still help an index's size and speed, and matter more for short fields.",
      "BM25 no necesita una lista de palabras vacías para esto: “the” está en los " + R.stop.N + " documentos, así que su IDF es " + f2(R.stop.idfThe) + " frente a " + f2(R.stop.idfKernel) + " de “kernel”. Las palabras de frecuencia media son otra historia: “on” está en 15 de 36 documentos y aun así suma cerca de 0.9 por coincidencia. Las listas de palabras vacías siguen ayudando al tamaño y la velocidad de un índice, y pesan más en campos cortos."),
    watch: { q: "the kernel panic", k1: "1.2", b: "0.75" },
  },
];

const QUESTIONS = [
  [t("Why does a rare query term count for more than a common one?", "¿Por qué un término raro de la consulta cuenta más que uno común?"),
    t("BM25 weights every term by its inverse document frequency, IDF = ln(1 + (N − n + 0.5)/(n + 0.5)), where n is how many of the N documents contain it. A term in one document out of 36 gets about 3.2; a term in all of them gets almost 0. Matching a rare term is strong evidence a document is about the query; matching a word every document has is no evidence at all.", "BM25 pondera cada término por su frecuencia inversa de documento (inverse document frequency, IDF), IDF = ln(1 + (N − n + 0.5)/(n + 0.5)), donde n es cuántos de los N documentos lo contienen. Un término que está en un documento de 36 obtiene cerca de 3.2; uno que está en todos, casi 0. Coincidir con un término raro es evidencia fuerte de que un documento trata de la consulta; coincidir con una palabra que tienen todos los documentos no es evidencia de nada.")],
  [t("What does k1 control, and why does BM25 stop rewarding repetition?", "¿Qué controla k1, y por qué BM25 deja de premiar la repetición?"),
    t("k1 sets how fast term frequency saturates. A term's part is IDF × tf(k1+1)/(tf + k1·…), which climbs fast for the first few occurrences and then flattens toward IDF × (k1+1). k1 = 0 counts only presence; higher k1 lets repeats count longer. Typical values are 1.2 to 2.0. It's why stuffing a page with a keyword stops paying: the 20th repeat adds almost nothing.", "k1 fija qué tan rápido se satura la frecuencia del término. La parte de un término es IDF × tf(k1+1)/(tf + k1·…), que sube rápido en las primeras apariciones y luego se aplana hacia IDF × (k1+1). k1 = 0 cuenta solo la presencia; un k1 más alto deja que las repeticiones cuenten por más tiempo. Los valores típicos van de 1.2 a 2.0. Por eso rellenar una página con una palabra clave deja de rendir: la repetición número 20 casi no suma.")],
  [t("What does b do, and when would you lower it?", "¿Qué hace b, y cuándo conviene bajarlo?"),
    t("b (0 to 1, usually 0.75) scales term frequency by the document's length against the average, so a match in a short document counts more than the same match in a long one. b = 0 ignores length. Lower b when length doesn't mean a document is less focused (a field of uniformly short titles, or long documents that really are about one thing); raise it when long documents tend to mention everything.", "b (de 0 a 1, normalmente 0.75) escala la frecuencia del término según la longitud del documento frente al promedio, así que una coincidencia en un documento corto cuenta más que la misma coincidencia en uno largo. b = 0 ignora la longitud. Baja b cuando la longitud no significa que un documento esté menos enfocado (un campo de títulos todos cortos, o documentos largos que de verdad tratan de una sola cosa); súbelo cuando los documentos largos tienden a mencionar de todo.")],
  [t("Why is BM25 so good at error codes, SKUs and names, and so bad at “my browser keeps dropping the connection”?", "¿Por qué BM25 es tan bueno con códigos de error, SKU y nombres, y tan malo con “mi navegador pierde la conexión a cada rato”?"),
    t("It matches exact tokens and gives a rare token a huge weight, so a code that appears in one document ranks it first. But a query that describes the problem in other words shares no tokens with the right document and scores it near zero. Stemming, synonym lists and query expansion narrow the gap a little; semantic (embedding) search closes it, and hybrid search combines both.", "Compara tokens exactos y le da un peso enorme a un token raro, así que un código que aparece en un solo documento lo pone primero. Pero una consulta que describe el problema con otras palabras no comparte tokens con el documento correcto y le da casi cero. La reducción a la raíz (stemming), las listas de sinónimos y la expansión de consultas acortan un poco la brecha; la búsqueda semántica (con embeddings) la cierra, y la búsqueda híbrida combina las dos.")],
  [t("Do you need a stop-word list with BM25? What else in the text pipeline changes the scores?", "¿Necesitas una lista de palabras vacías (stop words) con BM25? ¿Qué más del procesamiento del texto cambia los puntajes?"),
    t("Not for ranking: IDF already makes words like “the” nearly weightless, though mid-frequency words (“on”, “to”) still add a little. Stop-word lists mostly save index space. What matters more is tokenisation and normalisation: whether ERR_CONNECTION_RESET stays one token or splits into three, lowercasing, accents, and stemming (“printers” vs “printer”). Index and query must be processed the same way.", "Para el ranking, no: el IDF ya deja casi sin peso a palabras como “the”, aunque las de frecuencia media (“on”, “to”) todavía suman algo. Las listas de palabras vacías sobre todo ahorran espacio en el índice. Importan más la tokenización y la normalización: si ERR_CONNECTION_RESET queda como un token o se parte en tres, las minúsculas, los acentos y la reducción a la raíz (“printers” frente a “printer”). El índice y la consulta se tienen que procesar de la misma forma.")],
  [t("Your search engine says one result scored 12.4 and another query's best scored 3.1. Is the first one a better match?", "Tu buscador dice que un resultado sacó 12.4 y que el mejor de otra consulta sacó 3.1. ¿El primero es una mejor coincidencia?"),
    t("You can't tell. BM25 scores depend on the query's terms, their IDFs and the corpus, so they are only comparable within one query on one index. That's why systems that merge BM25 with another ranker (for example vector search) usually combine ranks, not raw scores: Reciprocal Rank Fusion (lesson 37). Elasticsearch, OpenSearch and Lucene use BM25 with k1 = 1.2 and b = 0.75 as their default similarity.", "No se puede saber. Los puntajes de BM25 dependen de los términos de la consulta, de sus IDF y del corpus, así que solo se pueden comparar dentro de una misma consulta sobre un mismo índice. Por eso los sistemas que combinan BM25 con otro ranker (por ejemplo, búsqueda vectorial) suelen combinar posiciones, no puntajes crudos: Reciprocal Rank Fusion (RRF, lección 37). Elasticsearch, OpenSearch y Lucene usan BM25 con k1 = 1.2 y b = 0.75 como similitud por defecto.")],
];

// ---------- page ----------
const figure = figurePlate({
  title: t("Assay bench", "Banco de ensayo"),
  keys: [
    { mark: "lit", label: t("The weight being placed, and its discs falling; the winning pan", "La pesa que se coloca y sus discos cayendo; el platillo ganador") },
    { mark: "raised", label: t("A weight per query term, bigger for rarer terms; a disc per matched term in each pan", "Una pesa por término de la consulta, más grande cuanto más raro; un disco por término coincidente en cada platillo") },
    { mark: "flat", label: t("Scales: rank, document, score wheels, length gauge", "Balanzas: puesto, documento, ruedas del puntaje, medidor de longitud") },
  ],
  caption: t(
    "Each query term stands on the rack as a weight sized by its IDF: a term found in few documents is a big weight, a word found everywhere a sliver. The five scales hold the five best documents, best on the left. For every term a document contains, a disc the size of that term's weight goes into its pan, and the disc's thickness is what the term adds to the score: repeats make it thicker, but less and less; a long document gets a thinner disc. The stack is the score, read on the wheels; the LEN gauge's needle stands at the middle for a document of average length.",
    "Cada término de la consulta está en el estante como una pesa del tamaño de su IDF: un término que aparece en pocos documentos es una pesa grande, y una palabra que está en todas partes, una lámina. Las cinco balanzas tienen los cinco mejores documentos, el mejor a la izquierda. Por cada término que contiene un documento, cae en su platillo un disco del tamaño de la pesa de ese término, y el grosor del disco es lo que el término suma al puntaje: las repeticiones lo engrosan, pero cada vez menos; un documento largo recibe un disco más delgado. La pila es el puntaje, que se lee en las ruedas; la aguja del medidor LONG queda en el medio para un documento de longitud promedio.",
  ),
  stage: "data-bench",
  stageLabel: t("BM25 scoring simulation. Space pauses or resumes.", "Simulación del puntaje BM25. Espacio pausa o reanuda."),
  svg: buildFigure(),
});

const RESULTS_BOX = `<div class="bm-results" data-results aria-live="polite"></div>`;
const controls = panel({
  stats: [["terms", t("Query terms", "Términos de la consulta")], ["matched", t("Documents matched", "Documentos con coincidencia")], ["top", t("Top score", "Puntaje más alto")], ["topdoc", t("Top document", "Mejor documento")]],
  controls: [
    seg("q", t("Query", "Consulta"), [["panic", "kernel panic on boot"], ["code", "ERR_CONNECTION_RESET"], ["printer", "printer offline"], ["para", t("paraphrase", "paráfrasis")], ["the", "the kernel panic"], ["cheap", "cheap flights"]], "panic"),
    seg("k1", t("k1 (repeats)", "k1 (repeticiones)"), [["0", "0"], ["1.2", "1.2"], ["2", "2"], ["3", "3"]], "1.2"),
    seg("b", t("b (length)", "b (longitud)"), [["0", "0"], ["0.75", "0.75"], ["1", "1"]], "0.75"),
    speedSeg(),
    actions(t("Do something", "Haz algo"), [["stuff", t("Stuff “cheap” ×20 into D16", "Rellenar D16 con “cheap” ×20")], ["again", t("Weigh again", "Pesar de nuevo")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]]),
  ],
}).replace(/<\/div>$/, "  " + RESULTS_BOX + "\n</div>");

const css = `
.bm-results{padding:4px 12px 14px;display:grid;gap:6px;font-size:13.5px}
.bm-results .row{display:grid;grid-template-columns:2.2em 3.2em minmax(0,1fr) auto;gap:4px 10px;align-items:baseline;padding:6px 0;border-top:1px solid var(--anatomy-faint)}
.bm-results .row:first-child{border-top:0}
.bm-results .rk{font:600 12px/1.4 var(--mono,ui-monospace,monospace);color:var(--anatomy-strong)}
.bm-results .id{font:500 12px/1.4 var(--mono,ui-monospace,monospace);color:var(--anatomy-muted)}
.bm-results .tx{min-width:0;color:var(--anatomy-text)}
.bm-results .sc{font:600 12px/1.4 var(--mono,ui-monospace,monospace);color:var(--anatomy-strong);text-align:right}
.bm-results .parts{grid-column:3/5;font:500 11px/1.5 var(--mono,ui-monospace,monospace);color:var(--anatomy-muted)}
.bm-results mark{background:none;color:var(--anatomy-strong);font-weight:700;text-decoration:underline;text-underline-offset:2px}
.bm-results .none{color:var(--anatomy-muted);font-style:italic}
.bm-results .head{font:500 11px/1.4 var(--mono,ui-monospace,monospace);letter-spacing:.06em;text-transform:uppercase;color:var(--anatomy-muted)}
@media (max-width:560px){.bm-results .row{grid-template-columns:2em 3em minmax(0,1fr)}.bm-results .sc{grid-column:3;text-align:left}}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const RESULTS = ${JSON.stringify(R)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};

const tr = WB.L, T = WB.T;   // L is taken by lineSvg below
const stage = document.querySelector("[data-bench]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const resultsEl = document.querySelector("[data-results]");
const weightsEl = q("[data-weights]"), assayer = q("[data-assayer]");
const queryEl = q("[data-query]"), corpusEl = q("[data-corpus]");
const stacks = [0, 1, 2, 3, 4].map((i) => q('[data-stack="' + i + '"]'));
const pans = [0, 1, 2, 3, 4].map((i) => q('[data-pan="' + i + '"] .iso-solid'));
const docEls = [0, 1, 2, 3, 4].map((i) => q('[data-doc="' + i + '"]'));
const intC = [0, 1, 2, 3, 4].map((i) => WB.counter(svg, "si" + i, P));
const fracC = [0, 1, 2, 3, 4].map((i) => WB.counter(svg, "sf" + i, P));
const lenM = [0, 1, 2, 3, 4].map((i) => WB.meter(svg, "len" + i, P));
const QUERY_OF = Object.fromEntries(QUERIES);
const TOUR = ["panic", "code", "printer", "para", "the"];

// ---------- drawing helpers (the kit is inlined on the page) ----------
const S = (paths, style) => solidSvg(paths, style);
const L = (d, style) => lineSvg(d, style);
const text = (xyz, t, size, tone, anchor = "middle") => faceTextSvg(sideMatrix([xyz[0], xyz[1]], xyz[2], P, "left"), t, { size, tone, anchor });
const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const radiusOf = (idf) => 2.4 + 1.55 * Math.min(idf, 4.4);
const DISC = 2.2;   // disc thickness per point of score

// ---------- state ----------
const cfg = { qid: "panic", q: QUERY_OF.panic, k1: 1.2, b: 0.75, speed: 1, stuff: false, tour: true };
const T_CLEAR = 0.8, T_TERM = 1.4, T_HOLD = 3.6;
let ix, plan, t, slots, total;

function indexFor(stuff) {
  if (!stuff) return makeIndex(DOCS);
  return makeIndex(DOCS.map(([id, tx]) => id === "D16" ? [id, "Cheap " + "cheap ".repeat(19) + tx.slice(6)] : [id, tx]));
}
let IX_PLAIN = indexFor(false), IX_STUFF = null;

function start(at = 0) {
  ix = cfg.stuff ? (IX_STUFF ||= indexFor(true)) : IX_PLAIN;
  plan = rank(ix, cfg.q, cfg.k1, cfg.b);
  plan.top = plan.rows.filter((r) => r.score > 0).slice(0, 5);
  const n = plan.terms.length;
  const [x0, x1] = G.SHELF_X, step = (x1 - x0) / n;
  slots = plan.terms.map((term, j) => ({ ...term, x: x0 + step * (j + 0.5), r: Math.min(radiusOf(term.idf), step / 2 - 2.4), w: step }));
  total = T_CLEAR + n * T_TERM + T_HOLD;
  t = at;
  queryEl.textContent = cfg.q;
  queryEl.setAttribute("font-size", cfg.q.length > 34 ? 3 : cfg.q.length > 26 ? 3.6 : 4.4);
  drawRack(-1);
  for (let i = 0; i < 5; i++) {
    const row = plan.top[i];
    docEls[i].textContent = row ? row.id : "—";
    lenM[i].set(row ? Math.min(1, row.len / (2 * ix.avg)) : 0);
  }
  words();
  paint();
}

// everything printed in words, redrawn when the reader switches language
function words() {
  corpusEl.textContent = tr(ix.N + " documents · average " + ix.avg.toFixed(1) + " words · k1 " + cfg.k1 + " · b " + cfg.b + (cfg.stuff ? " · D16 stuffed" : ""),
    ix.N + " documentos · promedio " + ix.avg.toFixed(1) + " palabras · k1 " + cfg.k1 + " · b " + cfg.b + (cfg.stuff ? " · D16 rellenado" : ""));
  drawResults();
  const matched = plan.rows.filter((r) => r.score > 0).length;
  stat("terms", plan.terms.length);
  stat("matched", tr(matched + " of " + ix.N, matched + " de " + ix.N));
  stat("top", plan.top[0] ? plan.top[0].score.toFixed(2) : "0");
  stat("topdoc", plan.top[0] ? plan.top[0].id : tr("none", "ninguno"));
}

function drawRack(active) {
  const out = [];
  slots.forEach((s, j) => {
    const h = 1.2 + s.idf * 1.5;
    out.push(L(ring(s.x, G.SLOT_Y, s.r + 0.8, G.SHELF_TOP, P, 32), { tone: "faint" }));
    out.push(S(cylinder(s.x, G.SLOT_Y, s.r, G.SHELF_TOP, h, P, 36, 0.2), { tone: "hi", crease: "lo", lit: j === active }));
    out.push(S(cylinder(s.x, G.SLOT_Y, Math.min(1.3, s.r * 0.45), G.SHELF_TOP + h, 1.6, P, 16), { tone: "mid", crease: "none" }));
    const size = Math.max(1.5, Math.min(3, (s.w - 2) / (s.term.length * 0.62)));
    out.push(text([s.x, G.SHELF_FRONT, 5.4], s.term, size, "hi"));
    out.push(text([s.x, G.SHELF_FRONT, 1.7], "idf " + s.idf.toFixed(2), Math.min(2.1, size), "mid"));
    if (j > 0) out.push(L(segment([s.x - s.w / 2, G.SHELF_FRONT, 1], [s.x - s.w / 2, G.SHELF_FRONT, G.SHELF_TOP - 1], P), { tone: "faint" }));
  });
  weightsEl.innerHTML = out.join("");
  weightsEl.dataset.active = String(active);
}

function drawResults() {
  const terms = new Set(plan.terms.map((x) => x.term));
  const mark = (tx) => escapeHtml(tx).replace(/[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*/g, (w) => terms.has(w.toLowerCase()) ? "<mark>" + w + "</mark>" : w);
  const head = '<div class="head">' + tr("Top five for “" + escapeHtml(cfg.q) + "”, with each term’s part of the score", "Los cinco primeros para “" + escapeHtml(cfg.q) + "”, con lo que aporta cada término") + '</div>';
  if (!plan.top.length) { resultsEl.innerHTML = head + '<div class="none">' + tr("No document contains any of the query’s words.", "Ningún documento contiene alguna de las palabras de la consulta.") + '</div>'; return; }
  resultsEl.innerHTML = head + plan.top.map((r, i) => {
    const tx = r.id === "D16" && cfg.stuff ? "Cheap cheap cheap … (×20) " + r.text.slice(6) : r.text;
    const parts = r.parts.filter((p) => p.tf).map((p) => p.term + " ×" + p.tf + " → " + p.score.toFixed(2)).join(" · ");
    return '<div class="row"><span class="rk">#' + (i + 1) + '</span><span class="id">' + r.id + '</span><span class="tx">' + mark(tx) + '</span><span class="sc">' + r.score.toFixed(2) + '</span><span class="parts">' + escapeHtml(parts) + ' · ' + r.len + tr(" words", " palabras") + '</span></div>';
  }).join("");
}

// ---------- the weighing, as a function of time ----------
const easeIn = (x) => x * x;
const clamp = (x) => Math.max(0, Math.min(1, x));
let shownActive = null, shownKey = "";
function paint() {
  const n = slots.length;
  const tt = t - T_CLEAR;
  const active = tt < 0 ? -1 : Math.min(n - 1, Math.floor(tt / T_TERM));
  const done = tt < 0 ? 0 : Math.min(n, Math.floor(tt / T_TERM + 0.0001));
  const inTerm = tt < 0 ? 0 : tt - active * T_TERM;
  const holding = tt >= n * T_TERM;
  const drop = holding ? 1 : clamp((inTerm - 0.35) / 0.7);
  const live = holding ? -1 : active;
  if (shownActive !== live) { shownActive = live; drawRack(live); }

  // the assayer walks to the weight being placed
  const tx = live >= 0 ? slots[live].x : (holding ? slots[n - 1].x : slots[0].x);
  const walk = live >= 0 ? clamp(inTerm / 0.35) : 1;
  const from = live > 0 ? slots[live - 1].x : slots[0].x;
  const x = from + (tx - from) * (1 - (1 - walk) ** 2);
  assayer.setAttribute("transform", translateAlong(P, [x - G.SLOT0, 0, 0]));

  // stacks: every term already placed, plus the one falling
  const fade = tt < 0 ? clamp(-tt / T_CLEAR) : 1;
  const key = [active, Math.round(drop * 40), holding, Math.round(fade * 20)].join();
  if (key !== shownKey) {
    shownKey = key;
    for (let i = 0; i < 5; i++) {
      const row = plan.top[i];
      const out = [];
      let z = G.STACK_Z, sum = 0;
      if (row && tt >= 0) {
        for (let j = 0; j <= Math.min(active, n - 1); j++) {
          const p = row.parts[j];
          if (!p.tf || p.score <= 0) continue;
          const h = Math.max(0.5, p.score * DISC);
          const falling = j === active && !holding;
          const lift = falling ? (1 - easeIn(drop)) * 18 : 0;
          if (falling && drop <= 0) continue;
          const s = slots[j];
          const svgDisc = S(cylinder(G.CX[i], G.CY, s.r, z + lift, h, P, 36, 0.15), { tone: "hi", crease: "lo", lit: falling || (j === active && inTerm < T_TERM) && !holding });
          const label = h >= 2.6 ? text([G.CX[i], G.CY + s.r, z + lift + h / 2 - 0.9], "×" + p.tf, Math.min(2.6, h * 0.62), falling ? "on-lit" : "hi") : "";
          out.push('<g class="wb-lit-group"' + (falling ? ' style="opacity:' + Math.min(1, drop * 3).toFixed(2) + '"' : "") + ">" + svgDisc + label + "</g>");
          z += h;
          if (!falling || drop >= 1) sum += p.score;
        }
      }
      stacks[i].innerHTML = out.join("");
      stacks[i].style.opacity = tt < 0 ? String(1 - fade) : "";
      const shown = tt < 0 ? 0 : sum;
      const tenths = Math.round(Math.min(99.9, shown) * 10);
      intC[i].set(Math.floor(tenths / 10)); fracC[i].set(tenths % 10);
    }
  }
  pans.forEach((p, i) => p.toggleAttribute("data-lit", holding && i === 0 && !!plan.top[0]));

  if (tt < 0) say(tr("clearing the pans · next query: “" + cfg.q + "”", "vaciando los platillos · siguiente consulta: “" + cfg.q + "”"));
  else if (!holding) {
    const s = slots[active], hits = plan.top.filter((r) => r.parts[active].tf).length;
    const all = plan.rows.filter((r) => r.parts[active].tf).length;
    say(tr("weighing “" + s.term + "” · idf " + s.idf.toFixed(2) + " · in " + all + " of " + ix.N + " documents" + (hits ? " · " + hits + " of the top five" : ""),
      "pesando “" + s.term + "” · idf " + s.idf.toFixed(2) + " · en " + all + " de " + ix.N + " documentos" + (hits ? " · " + hits + " de los cinco primeros" : "")));
  } else say(plan.top[0] ? tr("ranked · " + plan.top[0].id + " first with " + plan.top[0].score.toFixed(2), "ordenado · " + plan.top[0].id + " primero con " + plan.top[0].score.toFixed(2)) : tr("ranked · no document matched", "ordenado · ningún documento coincidió"));
}
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(key, value) { const el = statEls[key]; const tx = String(value); if (el && el.textContent !== tx) el.textContent = tx; }

const pauseBtn = document.querySelector('[data-act="pause"]');
const stuffBtn = document.querySelector('[data-act="stuff"]');
const loop = WB.loop({ stage, step: (dt) => {
  t += dt * cfg.speed;
  if (t >= total) {
    if (cfg.tour) { const k = (TOUR.indexOf(cfg.qid) + 1) % TOUR.length; setQuery(TOUR[k], true); }
    start(0);
  } else paint();
}, onPause: (on) => { pauseBtn.textContent = on ? tr("Play", "Reanudar") : tr("Pause", "Pausa"); if (on) say(tr("paused", "en pausa")); } });

function setQuery(id, fromTour) {
  cfg.qid = id; cfg.q = QUERY_OF[id] || id;
  if (!fromTour) cfg.tour = false;
  WB.pressSeg("q", QUERY_OF[id] ? id : "");
}
function set(name, raw) {
  WB.pressSeg(name, raw);
  if (name === "speed") { cfg.speed = Number(raw); return; }
  if (name === "q") { setQuery(raw); start(0); return; }
  cfg[name] = Number(raw);
  cfg.tour = false;
  start(0);
}
WB.onSegments((name, value) => set(name, value));
function stuffLabel() { stuffBtn.textContent = cfg.stuff ? tr("Un-stuff D16", "Quitar el relleno de D16") : tr("Stuff “cheap” ×20 into D16", "Rellenar D16 con “cheap” ×20"); }
function setStuff(on) { cfg.stuff = on; stuffLabel(); }
stuffBtn.addEventListener("click", () => { setStuff(!cfg.stuff); cfg.tour = false; if (!cfg.stuff || cfg.qid === "cheap") start(0); else { setQuery("cheap"); start(0); } if (loop.paused) loop.setPaused(false); });
document.querySelector('[data-act="again"]').addEventListener("click", () => { start(0); if (loop.paused) loop.setPaused(false); });
document.querySelector('[data-act="reset"]').addEventListener("click", () => { setStuff(false); cfg.k1 = 1.2; cfg.b = 0.75; WB.pressSeg("k1", "1.2"); WB.pressSeg("b", "0.75"); cfg.tour = true; setQuery("panic", true); start(WARM); });
pauseBtn.addEventListener("click", () => loop.toggle());
WB.onLang(() => {
  pauseBtn.textContent = loop.paused ? tr("Play", "Reanudar") : tr("Pause", "Pausa");
  stuffLabel(); words(); paint();
  if (loop.paused) say(tr("paused", "en pausa"));
});
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments (numbers computed from the same model) ----------
const n2 = (x) => x.toFixed(2);
const RUNS = {
  rare: () => {
    const r = RESULTS.rare, top = r.idfPrinter;
    return { verdict: T("IDF of “the” (in all " + r.N + " documents): " + n2(r.idfThe) + ". IDF of “printer” (in " + r.dfPrinter + "): " + n2(r.idfPrinter) + ". D35 scored " + n2(r.guideScore) + " with " + r.guideThe + " matches and ranked " + r.guideRank + "th; D06 scored " + n2(r.d06Score) + " and ranked " + r.d06Rank + "rd.",
        "IDF de “the” (en los " + r.N + " documentos): " + n2(r.idfThe) + ". IDF de “printer” (en " + r.dfPrinter + "): " + n2(r.idfPrinter) + ". D35 sumó " + n2(r.guideScore) + " con " + r.guideThe + " coincidencias y quedó en el puesto " + r.guideRank + "; D06 sumó " + n2(r.d06Score) + " y quedó en el puesto " + r.d06Rank + "."),
      bars: [[T("IDF of “the”", "IDF de “the”"), r.idfThe / top, n2(r.idfThe)], [T("IDF of “printer”", "IDF de “printer”"), 1, n2(r.idfPrinter), true], [T("D35 score (17 × “the”)", "Puntaje de D35 (17 × “the”)"), r.guideScore / r.d06Score, n2(r.guideScore)], [T("D06 score (1 × “printer”)", "Puntaje de D06 (1 × “printer”)"), 1, n2(r.d06Score), true]] };
  },
  stuff: () => {
    const s = RESULTS.stuff, top = s.k3[5].s;
    const at = (c, n) => c.find((p) => p.n === n).s;
    return { verdict: T("With k1 = 1.2 the “cheap” part went " + n2(at(s.k12, 1)) + " (once) → " + n2(at(s.k12, 5)) + " (5 times) → " + n2(at(s.k12, 20)) + " (20 times): " + (at(s.k12, 20) / at(s.k12, 1)).toFixed(1) + "×, against a ceiling of " + n2(s.cap12) + ". With k1 = 0 it stayed " + n2(at(s.k0, 20)) + "; with k1 = 3 it reached " + n2(at(s.k3, 20)) + ".",
        "Con k1 = 1.2 la parte de “cheap” pasó de " + n2(at(s.k12, 1)) + " (una vez) a " + n2(at(s.k12, 5)) + " (5 veces) y a " + n2(at(s.k12, 20)) + " (20 veces): " + (at(s.k12, 20) / at(s.k12, 1)).toFixed(1) + "×, frente a un techo de " + n2(s.cap12) + ". Con k1 = 0 se quedó en " + n2(at(s.k0, 20)) + "; con k1 = 3 llegó a " + n2(at(s.k3, 20)) + "."),
      bars: [[T("k1 1.2, once", "k1 1.2, una vez"), at(s.k12, 1) / top, n2(at(s.k12, 1))], [T("k1 1.2, 5 times", "k1 1.2, 5 veces"), at(s.k12, 5) / top, n2(at(s.k12, 5))], [T("k1 1.2, 20 times", "k1 1.2, 20 veces"), at(s.k12, 20) / top, n2(at(s.k12, 20)), true], [T("k1 0, 20 times", "k1 0, 20 veces"), at(s.k0, 20) / top, n2(at(s.k0, 20))], [T("k1 3, 20 times", "k1 3, 20 veces"), at(s.k3, 20) / top, n2(at(s.k3, 20))]] };
  },
  length: () => {
    const l = RESULTS.length, top = l.b1.short;
    return { verdict: T("b = 0: both " + n2(l.b0.short) + ". b = 0.75: D03 " + n2(l.b75.short) + ", D36 " + n2(l.b75.long) + " (" + l.b75.ratio.toFixed(1) + "×). b = 1: D03 " + n2(l.b1.short) + ", D36 " + n2(l.b1.long) + " (" + l.b1.ratio.toFixed(1) + "×).",
        "b = 0: ambos " + n2(l.b0.short) + ". b = 0.75: D03 " + n2(l.b75.short) + ", D36 " + n2(l.b75.long) + " (" + l.b75.ratio.toFixed(1) + "×). b = 1: D03 " + n2(l.b1.short) + ", D36 " + n2(l.b1.long) + " (" + l.b1.ratio.toFixed(1) + "×)."),
      bars: [[T("D03, " + l.lenShort + " words, b 0.75", "D03, " + l.lenShort + " palabras, b 0.75"), l.b75.short / top, n2(l.b75.short), true], [T("D36, " + l.lenLong + " words, b 0.75", "D36, " + l.lenLong + " palabras, b 0.75"), l.b75.long / top, n2(l.b75.long), true], [T("Either, b 0", "Cualquiera, b 0"), l.b0.short / top, n2(l.b0.short)], ["D36, b 1", l.b1.long / top, n2(l.b1.long)]] };
  },
  exact: () => {
    const e = RESULTS.exact, top = Math.max(e.codeScore, e.paraTopScore);
    return { verdict: T("“ERR_CONNECTION_RESET”: D08 ranked " + e.codeRank + "st with " + n2(e.codeScore) + "; the next document scored " + n2(e.codeNext) + ". The description: D08 ranked " + e.paraRank + "th with " + n2(e.paraScore) + " (it shares only “" + e.paraShared.join("”, “") + "”); " + e.paraTop + " came first with " + n2(e.paraTopScore) + ".",
        "“ERR_CONNECTION_RESET”: D08 quedó en el puesto " + e.codeRank + " con " + n2(e.codeScore) + "; el documento siguiente sumó " + n2(e.codeNext) + ". La descripción: D08 quedó en el puesto " + e.paraRank + " con " + n2(e.paraScore) + " (solo comparte “" + e.paraShared.join("”, “") + "”); " + e.paraTop + " quedó primero con " + n2(e.paraTopScore) + "."),
      bars: [[T("D08, error code query", "D08, consulta con el código de error"), e.codeScore / top, n2(e.codeScore), true], [T("D08, description query", "D08, consulta con la descripción"), e.paraScore / top, n2(e.paraScore), true], [T(e.paraTop + " (wrong), description query", e.paraTop + " (incorrecto), consulta con la descripción"), e.paraTopScore / top, n2(e.paraTopScore)]] };
  },
  stop: () => {
    const s = RESULTS.stop;
    return { verdict: T("Top five with and without “the”: " + (s.same ? "identical" : "different") + " (" + s.order.join(", ") + "). Top score " + n2(s.topA) + " → " + n2(s.topB) + ". IDF of “the”: " + n2(s.idfThe) + "; of “kernel”: " + n2(s.idfKernel) + ".",
        "Los cinco primeros con y sin “the”: " + (s.same ? "idénticos" : "distintos") + " (" + s.order.join(", ") + "). Puntaje más alto " + n2(s.topA) + " → " + n2(s.topB) + ". IDF de “the”: " + n2(s.idfThe) + "; de “kernel”: " + n2(s.idfKernel) + "."),
      bars: [[T("Top score, “kernel panic”", "Puntaje más alto, “kernel panic”"), s.topA / s.topB, n2(s.topA)], [T("Top score, “the kernel panic”", "Puntaje más alto, “the kernel panic”"), 1, n2(s.topB), true], [T("IDF of “the”", "IDF de “the”"), s.idfThe / s.idfKernel, n2(s.idfThe)], [T("IDF of “kernel”", "IDF de “kernel”"), 1, n2(s.idfKernel)]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  cfg.tour = false;
  setStuff(!!w.stuff);
  cfg.k1 = Number(w.k1); cfg.b = Number(w.b); WB.pressSeg("k1", w.k1); WB.pressSeg("b", w.b);
  const id = Object.keys(QUERY_OF).find((k) => QUERY_OF[k] === w.q);
  if (id) setQuery(id); else { cfg.qid = w.q; cfg.q = w.q; WB.pressSeg("q", ""); }
  start(0);
  if (loop.paused) loop.setPaused(false);
} });

// the first frame: a minute's worth of weighing already under way, the third term falling into the pans
const WARM = T_CLEAR + 2 * T_TERM + 0.85;
loop.setPaused(loop.paused);
start(WARM);
`;

const size = writePage(new URL("./bm25-workbench.html", import.meta.url), {
  title: t("BM25 Workbench", "Banco de trabajo: BM25"),
  eyebrow: t("Systems lesson 35 · BM25", "Lección de sistemas 35 · BM25"),
  lede: t("BM25 is the ranking behind most keyword search: it adds up, for every query word a document contains, how rare the word is, how often the document uses it (with diminishing returns) and how long the document is. It's fast, needs no training and is unbeatable on exact codes and names, but it only matches words, not meaning. This lesson weighs documents on an assay bench: watch a machine do it, predict what changes the ranking, then explain it back.",
    "BM25 es el ranking detrás de la mayoría de las búsquedas por palabras clave: suma, por cada palabra de la consulta que contiene un documento, qué tan rara es, cuántas veces la usa el documento (con rendimientos decrecientes) y qué tan largo es el documento. Es rápido, no necesita entrenamiento y es imbatible con códigos y nombres exactos, pero solo compara palabras, no significados. Esta lección pesa documentos en un banco de ensayo: mira cómo lo hace una máquina, predice qué cambia el ranking y después explícalo."),
  machine: { intro: t("The query's words stand on the rack as weights: a word found in few documents is a big weight, a word found everywhere a sliver. The assayer places them one at a time, and each of the five best documents gets a disc in its pan for every query word it contains. The disc's thickness is what that word adds to the score, so the stack is the score. Try the queries, k1 (how much repeats count) and b (how much length counts), and stuff a keyword into D16.",
    "Las palabras de la consulta están en el estante como pesas: una palabra que aparece en pocos documentos es una pesa grande, y una que está en todas partes, una lámina. El ensayador las coloca una por una, y cada uno de los cinco mejores documentos recibe un disco en su platillo por cada palabra de la consulta que contiene. El grosor del disco es lo que esa palabra suma al puntaje, así que la pila es el puntaje. Prueba las consultas, k1 (cuánto cuentan las repeticiones) y b (cuánto cuenta la longitud), y rellena D16 con una palabra clave. Los documentos de ejemplo y las consultas están en inglés para que las cifras coincidan con el modelo."), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same BM25 code as the machine, on the same 36 documents.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo código BM25 que la máquina, sobre los mismos 36 documentos."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). BM25 as in Robertson and Zaragoza, “The Probabilistic Relevance Framework: BM25 and Beyond” (2009), with the IDF used by Lucene. Simulation written for this lesson.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). BM25 según Robertson y Zaragoza, “The Probabilistic Relevance Framework: BM25 and Beyond” (2009), con el IDF que usa Lucene. Simulación escrita para esta lección.`),
  css,
  script: live,
});
console.log("wrote bm25-workbench.html", (size / 1024).toFixed(0) + " KB");

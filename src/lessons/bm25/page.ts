// @ts-nocheck: content ported as-is
// Systems lesson 35 · BM25: documents weighed on an assay bench.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { buildFigure, P, GEOMETRY } from "./figure";
import { rareRun, stuffRun, lengthRun, exactRun, stopRun } from "./sim";

// ---------- results (computed once here from the same model the page runs) ----------
const R = { rare: rareRun(), stuff: stuffRun(), length: lengthRun(), exact: exactRun(), stop: stopRun() };
// toFixed, not src/lib/format's one(): one() rounds first, which can differ on a half (the text must not change).
const f2 = (x) => x.toFixed(2);
const f1 = (x) => x.toFixed(1);
// English ordinals for ranks: 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st, 22nd.
const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");

// What each card shows after a run.
const RUNS = {
  rare: () => {
    const r = R.rare, top = r.idfPrinter;
    return { verdict: t("IDF of “the” (in all " + r.N + " documents): " + f2(r.idfThe) + ". IDF of “printer” (in " + r.dfPrinter + "): " + f2(r.idfPrinter) + ". D35 scored " + f2(r.guideScore) + " with " + r.guideThe + " matches and ranked " + ord(r.guideRank) + "; D06 scored " + f2(r.d06Score) + " and ranked " + ord(r.d06Rank) + ".",
        "IDF de “the” (en los " + r.N + " documentos): " + f2(r.idfThe) + ". IDF de “printer” (en " + r.dfPrinter + "): " + f2(r.idfPrinter) + ". D35 sumó " + f2(r.guideScore) + " con " + r.guideThe + " coincidencias y quedó en el puesto " + r.guideRank + "; D06 sumó " + f2(r.d06Score) + " y quedó en el puesto " + r.d06Rank + "."),
      bars: [[t("IDF of “the”", "IDF de “the”"), r.idfThe / top, f2(r.idfThe)], [t("IDF of “printer”", "IDF de “printer”"), 1, f2(r.idfPrinter), true], [t("D35 score (17 × “the”)", "Puntaje de D35 (17 × “the”)"), r.guideScore / r.d06Score, f2(r.guideScore)], [t("D06 score (1 × “printer”)", "Puntaje de D06 (1 × “printer”)"), 1, f2(r.d06Score), true]] };
  },
  stuff: () => {
    const s = R.stuff, top = s.k3[5].s;
    const at = (c, n) => c.find((p) => p.n === n).s;
    return { verdict: t("With k1 = 1.2 the “cheap” part went " + f2(at(s.k12, 1)) + " (once) → " + f2(at(s.k12, 5)) + " (5 times) → " + f2(at(s.k12, 20)) + " (20 times): " + (at(s.k12, 20) / at(s.k12, 1)).toFixed(1) + "×, against a ceiling of " + f2(s.cap12) + ". With k1 = 0 it stayed " + f2(at(s.k0, 20)) + "; with k1 = 3 it reached " + f2(at(s.k3, 20)) + ".",
        "Con k1 = 1.2 la parte de “cheap” pasó de " + f2(at(s.k12, 1)) + " (una vez) a " + f2(at(s.k12, 5)) + " (5 veces) y a " + f2(at(s.k12, 20)) + " (20 veces): " + (at(s.k12, 20) / at(s.k12, 1)).toFixed(1) + "×, frente a un techo de " + f2(s.cap12) + ". Con k1 = 0 se quedó en " + f2(at(s.k0, 20)) + "; con k1 = 3 llegó a " + f2(at(s.k3, 20)) + "."),
      bars: [[t("k1 1.2, once", "k1 1.2, una vez"), at(s.k12, 1) / top, f2(at(s.k12, 1))], [t("k1 1.2, 5 times", "k1 1.2, 5 veces"), at(s.k12, 5) / top, f2(at(s.k12, 5))], [t("k1 1.2, 20 times", "k1 1.2, 20 veces"), at(s.k12, 20) / top, f2(at(s.k12, 20)), true], [t("k1 0, 20 times", "k1 0, 20 veces"), at(s.k0, 20) / top, f2(at(s.k0, 20))], [t("k1 3, 20 times", "k1 3, 20 veces"), at(s.k3, 20) / top, f2(at(s.k3, 20))]] };
  },
  length: () => {
    const l = R.length, top = l.b1.short;
    return { verdict: t("b = 0: both " + f2(l.b0.short) + ". b = 0.75: D03 " + f2(l.b75.short) + ", D36 " + f2(l.b75.long) + " (" + l.b75.ratio.toFixed(1) + "×). b = 1: D03 " + f2(l.b1.short) + ", D36 " + f2(l.b1.long) + " (" + l.b1.ratio.toFixed(1) + "×).",
        "b = 0: ambos " + f2(l.b0.short) + ". b = 0.75: D03 " + f2(l.b75.short) + ", D36 " + f2(l.b75.long) + " (" + l.b75.ratio.toFixed(1) + "×). b = 1: D03 " + f2(l.b1.short) + ", D36 " + f2(l.b1.long) + " (" + l.b1.ratio.toFixed(1) + "×)."),
      bars: [[t("D03, " + l.lenShort + " words, b 0.75", "D03, " + l.lenShort + " palabras, b 0.75"), l.b75.short / top, f2(l.b75.short), true], [t("D36, " + l.lenLong + " words, b 0.75", "D36, " + l.lenLong + " palabras, b 0.75"), l.b75.long / top, f2(l.b75.long), true], [t("Either, b 0", "Cualquiera, b 0"), l.b0.short / top, f2(l.b0.short)], ["D36, b 1", l.b1.long / top, f2(l.b1.long)]] };
  },
  exact: () => {
    const e = R.exact, top = Math.max(e.codeScore, e.paraTopScore);
    return { verdict: t("“ERR_CONNECTION_RESET”: D08 ranked " + ord(e.codeRank) + " with " + f2(e.codeScore) + "; the next document scored " + f2(e.codeNext) + ". The description: D08 ranked " + ord(e.paraRank) + " with " + f2(e.paraScore) + " (it shares only “" + e.paraShared.join("”, “") + "”); " + e.paraTop + " came first with " + f2(e.paraTopScore) + ".",
        "“ERR_CONNECTION_RESET”: D08 quedó en el puesto " + e.codeRank + " con " + f2(e.codeScore) + "; el documento siguiente sumó " + f2(e.codeNext) + ". La descripción: D08 quedó en el puesto " + e.paraRank + " con " + f2(e.paraScore) + " (solo comparte “" + e.paraShared.join("”, “") + "”); " + e.paraTop + " quedó primero con " + f2(e.paraTopScore) + "."),
      bars: [[t("D08, error code query", "D08, consulta con el código de error"), e.codeScore / top, f2(e.codeScore), true], [t("D08, description query", "D08, consulta con la descripción"), e.paraScore / top, f2(e.paraScore), true], [t(e.paraTop + " (wrong), description query", e.paraTop + " (incorrecto), consulta con la descripción"), e.paraTopScore / top, f2(e.paraTopScore)]] };
  },
  stop: () => {
    const s = R.stop;
    return { verdict: t("Top five with and without “the”: " + (s.same ? "identical" : "different") + " (" + s.order.join(", ") + "). Top score " + f2(s.topA) + " → " + f2(s.topB) + ". IDF of “the”: " + f2(s.idfThe) + "; of “kernel”: " + f2(s.idfKernel) + ".",
        "Los cinco primeros con y sin “the”: " + (s.same ? "idénticos" : "distintos") + " (" + s.order.join(", ") + "). Puntaje más alto " + f2(s.topA) + " → " + f2(s.topB) + ". IDF de “the”: " + f2(s.idfThe) + "; de “kernel”: " + f2(s.idfKernel) + "."),
      bars: [[t("Top score, “kernel panic”", "Puntaje más alto, “kernel panic”"), s.topA / s.topB, f2(s.topA)], [t("Top score, “the kernel panic”", "Puntaje más alto, “the kernel panic”"), 1, f2(s.topB), true], [t("IDF of “the”", "IDF de “the”"), s.idfThe / s.idfKernel, f2(s.idfThe)], [t("IDF of “kernel”", "IDF de “kernel”"), 1, f2(s.idfKernel)]] };
  },
};

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "rare",
    title: t("A common word against a rare one", "Una palabra común contra una rara"),
    change: t("Query “the printer” · D35, the office guide, says “the” " + R.rare.guideThe + " times and never “printer” (it says “printers”, which doesn't match: no stemming) · D06, a printer checklist, says “printer” once",
      "Consulta “the printer” · D35, la guía de la oficina, dice “the” " + R.rare.guideThe + " veces y nunca “printer” (dice “printers”, que no coincide: no hay reducción a la raíz) · D06, una lista de verificación de impresoras, dice “printer” una vez"),
    question: t("Which of the two ranks higher?", "¿Cuál de los dos queda más arriba?"),
    options: [t("D35: " + R.rare.guideThe + " matches beat one", "D35: " + R.rare.guideThe + " coincidencias le ganan a una"), t("D06: one rare match beats them all", "D06: una coincidencia rara les gana a todas"), t("Neither: they tie on one term each", "Ninguno: empatan con un término cada uno")],
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
    options: [t("About 20 times bigger", "Unas 20 veces más grande"), t("About " + f1(R.stuff.k12[5].s / R.stuff.k12[0].s) + " times bigger", "Unas " + f1(R.stuff.k12[5].s / R.stuff.k12[0].s) + " veces más grande"), t("About 5 times bigger", "Unas 5 veces más grande")],
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
    options: [t("They score the same", "Suman lo mismo"), t("D03 scores about " + f1(R.length.b75.ratio) + " times as much", "D03 suma unas " + f1(R.length.b75.ratio) + " veces más"), t("D36 scores about 1.5 times as much", "D36 suma unas 1.5 veces más")],
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
    options: [t("Rank 1 for both queries", "Puesto 1 en las dos consultas"), t("Rank 1 for the code, rank " + R.exact.paraRank + " for the description", "Puesto 1 con el código, puesto " + R.exact.paraRank + " con la descripción"), t("Rank 1 for the description, top five for the code", "Puesto 1 con la descripción, entre los cinco primeros con el código")],
    answer: 1,
    why: t("The code is one rare token that appears in exactly one document, so D08 scores " + f2(R.exact.codeScore) + " and everything else 0: exact identifiers, product numbers and error strings are what BM25 is best at. The description shares no word with D08 except “the”, so D08 scores " + f2(R.exact.paraScore) + " and the top result is " + R.exact.paraTop + ", which matched “" + R.exact.paraTopTerms.filter((w) => w !== "the").join("”, “") + "”, and D08 ends up at rank " + R.exact.paraRank + ", below every article that shares more of the query's words. BM25 matches words, not meaning: that vocabulary gap is what semantic search (lesson 36) closes, and why hybrid search (lesson 38) runs both.",
      "El código es un único token raro que aparece en exactamente un documento, así que D08 suma " + f2(R.exact.codeScore) + " y todos los demás 0: identificadores exactos, números de producto y cadenas de error son lo que BM25 mejor hace. La descripción no comparte ninguna palabra con D08 salvo “the”, así que D08 suma " + f2(R.exact.paraScore) + " y el primer resultado es " + R.exact.paraTop + ", que coincidió con “" + R.exact.paraTopTerms.filter((w) => w !== "the").join("”, “") + "”, y D08 termina en el puesto " + R.exact.paraRank + ", debajo de todos los artículos que comparten más palabras de la consulta. BM25 compara palabras, no significados: esa brecha de vocabulario es la que cierra la búsqueda semántica (lección 36), y por eso la búsqueda híbrida (lección 38) usa las dos."),
    watch: { q: "browser keeps dropping the link to the website", k1: "1.2", b: "0.75" },
  },
  {
    id: "stop",
    title: t("Adding “the” to the query", "Agregar “the” a la consulta"),
    change: t("Query “kernel panic” → “the kernel panic” · no stop-word list", "Consulta “kernel panic” → “the kernel panic” · sin lista de palabras vacías (stop words)"),
    question: t("What happens to the top five?", "¿Qué pasa con los cinco primeros?"),
    options: [t("Documents with many “the” move up", "Suben los documentos con mucho “the”"), t("Same five, same order, scores barely move", "Los mismos cinco, en el mismo orden, casi sin cambios"), t("Same five, but every score roughly halves", "Los mismos cinco, pero cada puntaje baja a la mitad")],
    answer: 1,
    why: t("BM25 needs no stop-word list for this: “the” is in all " + R.stop.N + " documents, so its IDF is " + f2(R.stop.idfThe) + " against " + f2(R.stop.idfKernel) + " for “kernel”, and the top score rises by only " + f2(R.stop.gain) + ". Scores are sums, not averages, so a longer query never divides them. Words in the middle are another matter: “on” is in 15 of 36 documents and still adds about 0.9 a match. Stop-word lists still help an index's size and speed, and matter more for short fields.",
      "BM25 no necesita una lista de palabras vacías para esto: “the” está en los " + R.stop.N + " documentos, así que su IDF es " + f2(R.stop.idfThe) + " frente a " + f2(R.stop.idfKernel) + " de “kernel”, y el puntaje más alto sube apenas " + f2(R.stop.gain) + ". Los puntajes son sumas, no promedios, así que alargar la consulta nunca los divide. Las palabras de frecuencia media son otra historia: “on” está en 15 de 36 documentos y aun así suma cerca de 0.9 por coincidencia. Las listas de palabras vacías siguen ayudando al tamaño y la velocidad de un índice, y pesan más en campos cortos."),
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

export default defineLesson({
  title: t("BM25 Workbench", "Banco de trabajo: BM25"),
  eyebrow: t("Systems lesson 35 · BM25", "Lección de sistemas 35 · BM25"),
  lede: t("BM25 is the ranking behind most keyword search: it adds up, for every query word a document contains, how rare the word is, how often the document uses it (with diminishing returns) and how long the document is. It's fast, needs no training and is unbeatable on exact codes and names, but it only matches words, not meaning. This lesson weighs documents on an assay bench: watch a machine do it, predict what changes the ranking, then explain it back.",
    "BM25 es el ranking detrás de la mayoría de las búsquedas por palabras clave: suma, por cada palabra de la consulta que contiene un documento, qué tan rara es, cuántas veces la usa el documento (con rendimientos decrecientes) y qué tan largo es el documento. Es rápido, no necesita entrenamiento y es imbatible con códigos y nombres exactos, pero solo compara palabras, no significados. Esta lección pesa documentos en un banco de ensayo: mira cómo lo hace una máquina, predice qué cambia el ranking y después explícalo."),
  machine: {
    intro: t("The query's words stand on the rack as weights: a word found in few documents is a big weight, a word found everywhere a sliver. The assayer places them one at a time, and each of the five best documents gets a disc in its pan for every query word it contains. The disc's thickness is what that word adds to the score, so the stack is the score. Try the queries, k1 (how much repeats count) and b (how much length counts), and stuff a keyword into D16.",
      "Las palabras de la consulta están en el estante como pesas: una palabra que aparece en pocos documentos es una pesa grande, y una que está en todas partes, una lámina. El ensayador las coloca una por una, y cada uno de los cinco mejores documentos recibe un disco en su platillo por cada palabra de la consulta que contiene. El grosor del disco es lo que esa palabra suma al puntaje, así que la pila es el puntaje. Prueba las consultas, k1 (cuánto cuentan las repeticiones) y b (cuánto cuenta la longitud), y rellena D16 con una palabra clave. Los documentos de ejemplo y las consultas están en inglés para que las cifras coincidan con el modelo."),
    plate: {
      title: t("Assay bench", "Banco de ensayo"),
      keys: [
        { mark: "lit", label: t("The weight being placed, and its discs falling; the winning pan", "La pesa que se coloca y sus discos cayendo; el platillo ganador") },
        { mark: "raised", label: t("A weight per query term, bigger for rarer terms; a disc per matched term in each pan", "Una pesa por término de la consulta, más grande cuanto más raro; un disco por término coincidente en cada platillo") },
        { mark: "flat", label: t("Scales: rank, document, score wheels, length gauge", "Balanzas: puesto, documento, ruedas del puntaje, medidor de longitud") },
      ],
      caption: t(
        "Each query term stands on the rack as a weight sized by its IDF: a term found in few documents is a big weight, a word found everywhere a sliver. The five scales hold the five best documents, best on the left. For every term a document contains, a disc the size of that term's weight goes into its pan, and the disc's thickness is what the term adds to the score: repeats make it thicker, but less and less, and the mark on a disc (×1, ×2…) is how many times the document uses the term; a long document gets a thinner disc. The stack is the score, read on the wheels; the LEN gauge's needle stands at the middle for a document of average length.",
        "Cada término de la consulta está en el estante como una pesa del tamaño de su IDF: un término que aparece en pocos documentos es una pesa grande, y una palabra que está en todas partes, una lámina. Las cinco balanzas tienen los cinco mejores documentos, el mejor a la izquierda. Por cada término que contiene un documento, cae en su platillo un disco del tamaño de la pesa de ese término, y el grosor del disco es lo que el término suma al puntaje: las repeticiones lo engrosan, pero cada vez menos, y la marca del disco (×1, ×2…) es cuántas veces el documento usa el término; un documento largo recibe un disco más delgado. La pila es el puntaje, que se lee en las ruedas; la aguja del medidor LONG queda en el medio para un documento de longitud promedio.",
      ),
      stage: { "data-bench": "" },
      label: t("BM25 scoring simulation. Space pauses or resumes.", "Simulación del puntaje BM25. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["terms", t("Query terms", "Términos de la consulta")], ["matched", t("Documents matched", "Documentos con coincidencia")], ["top", t("Top score", "Puntaje más alto")], ["topdoc", t("Top document", "Mejor documento")]],
    controls: [
      { seg: "q", label: t("Query", "Consulta"), options: [["panic", "kernel panic on boot"], ["code", "ERR_CONNECTION_RESET"], ["printer", "printer offline after update"], ["para", t("paraphrase", "paráfrasis")], ["the", "the kernel panic"], ["cheap", "cheap flights"]], value: "panic" },
      { seg: "k1", label: t("k1 (repeats)", "k1 (repeticiones)"), options: [["0", "0"], ["1.2", "1.2"], ["2", "2"], ["3", "3"]], value: "1.2" },
      { seg: "b", label: t("b (length)", "b (longitud)"), options: [["0", "0"], ["0.75", "0.75"], ["1", "1"]], value: "0.75" },
      { speed: true },
      { actions: [["stuff", t("Stuff “cheap” ×20 into D16", "Rellenar D16 con “cheap” ×20")], ["again", t("Weigh again", "Pesar de nuevo")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    // The top-five results list goes under the controls; Panel has no slot for it, so live.ts adds it.
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same BM25 code as the machine, on the same 36 documents.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo código BM25 que la máquina, sobre los mismos 36 documentos."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). BM25 as in Robertson and Zaragoza, “The Probabilistic Relevance Framework: BM25 and Beyond” (2009), with the IDF used by Lucene. Simulation written for this lesson.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). BM25 según Robertson y Zaragoza, “The Probabilistic Relevance Framework: BM25 and Beyond” (2009), con el IDF que usa Lucene. Simulación escrita para esta lección.`),
  css: `
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
`,
  data: {
    P,
    G: GEOMETRY,
  },
});

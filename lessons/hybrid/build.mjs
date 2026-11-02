// Systems lesson 38 · Hybrid search. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule, t, tx } from "../../workbench/page.mjs";
import { buildFigure, tileSvg, P, GEOMETRY } from "./figure.mjs";
import { experimentResults, LATENCY } from "./sim.js";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- results (computed here from the same model the page runs) ----------
const R = experimentResults();
const by = (o) => `exact IDs ${o.exact}%, paraphrases ${o.paraphrase}%, mixed ${o.mixed}%`;
const byEs = (o) => `IDs exactos ${o.exact}%, paráfrasis ${o.paraphrase}%, mixtas ${o.mixed}%`;
const best = (key) => R.alpha.reduce((b, a) => (a[key] > b[key] ? a : b));
const bestAlphas = (key, to = " to ") => { const top = Math.max(...R.alpha.map((a) => a[key])); const hit = R.alpha.filter((a) => a[key] === top).map((a) => a.alpha); return hit.length > 1 ? hit[0] + to + hit[hit.length - 1] : String(hit[0]); };

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "lanes",
    title: t("One lane or both", "Un carril o los dos"),
    change: t("Keyword lane only (BM25) vs meaning lane only (embeddings) vs both, merged with reciprocal rank fusion · 30 queries of each kind · is the wanted article in the top 10?", "Solo el carril de palabras clave (BM25), solo el carril de significado (embeddings) o los dos, fusionados con fusión de rango recíproco (RRF) · 30 consultas de cada tipo · ¿el artículo buscado está en el top 10?"),
    question: t("Which setup finds the right article for all three kinds of query?", "¿Qué configuración encuentra el artículo correcto para los tres tipos de consulta?"),
    options: [t("The keyword lane: exact words are the safest bet", "El carril de palabras clave: las palabras exactas son la apuesta más segura"), t("The meaning lane: embeddings understand all three", "El carril de significado: los embeddings entienden los tres"), t("Neither alone: each lane misses a different kind, and only the merged lists cover all three", "Ninguno solo: cada carril falla en un tipo distinto, y solo las listas fusionadas cubren los tres")],
    answer: 2,
    why: t(`Keyword only: ${by(R.three.lexical)}. Meaning only: ${by(R.three.semantic)}. Both, merged: ${by(R.three.hybrid)}. BM25 matches exact tokens, so a pasted error code or part number lands first, but a customer who writes "money back" never matches an article that says "refund". The embedding puts synonyms together, but an identifier or a product name means nothing to it, so it can't tell E-4072 from E-4073 or one product's article from another's. A mixed query needs both at once: the product name from the keyword lane and the meaning from the other.`, `Solo palabras clave: ${byEs(R.three.lexical)}. Solo significado: ${byEs(R.three.semantic)}. Los dos, fusionados: ${byEs(R.three.hybrid)}. BM25 compara tokens exactos, así que un código de error o un número de pieza pegado queda primero, pero un cliente que escribe "money back" nunca coincide con un artículo que dice "refund". El embedding junta los sinónimos, pero un identificador o un nombre de producto no significa nada para él, así que no distingue E-4072 de E-4073 ni el artículo de un producto del de otro. Una consulta mixta necesita las dos cosas a la vez: el nombre del producto del carril de palabras clave y el significado del otro.`),
    watch: { qtype: "all", lanes: "both", fusion: "rrf", depth: "20", rerank: "off" },
  },
  {
    id: "fusion",
    title: t("Adding the scores as they are", "Sumar los puntajes tal como vienen"),
    change: t("Merge by a weighted sum, α = 0.5, of the raw scores (BM25 runs from 0 to about 20, cosine from 0 to 1) vs the same sum after min-max scaling each list to 0..1 vs reciprocal rank fusion", "Fusionar con una suma ponderada, α = 0.5, de los puntajes crudos (BM25 va de 0 a unos 20, el coseno de 0 a 1), con la misma suma después de escalar cada lista a 0..1 con min-max, o con fusión de rango recíproco"),
    question: t("With raw scores, what happens to paraphrase queries?", "Con puntajes crudos, ¿qué pasa con las consultas de paráfrasis?"),
    options: [t("Nothing: α = 0.5 already gives both lanes half the say", "Nada: α = 0.5 ya les da a los dos carriles la mitad del voto"), t("BM25's bigger numbers swamp the cosines, so paraphrases do little better than keyword search alone", "Los números más grandes de BM25 aplastan a los cosenos, así que a las paráfrasis les va apenas mejor que con la búsqueda por palabras clave sola"), t("They improve: bigger scores carry more information", "Mejoran: los puntajes más grandes llevan más información")],
    answer: 1,
    why: t(`Raw sum: ${by(R.fusion.raw)}. Min-max scaled: ${by(R.fusion.minmax)}. Reciprocal rank fusion: ${by(R.fusion.rrf)}. The two scores live on different scales, so an unscaled sum lets whichever is numerically bigger decide, and α no longer means what it says. Scale each list first (min-max or z-scores), or merge by rank, which ignores the scores altogether. RRF needs no tuning and is the safe default; it gives both lanes the same vote, so on paraphrases the keyword lane's near-misses take a few seats that a tuned weighted sum keeps for the meaning lane.`, `Suma cruda: ${byEs(R.fusion.raw)}. Escalada con min-max: ${byEs(R.fusion.minmax)}. Fusión de rango recíproco: ${byEs(R.fusion.rrf)}. Los dos puntajes viven en escalas distintas, así que una suma sin escalar deja que decida el que sea numéricamente más grande, y α deja de significar lo que dice. Escala primero cada lista (min-max o z-scores), o fusiona por puesto, que ignora por completo los puntajes. RRF no necesita ajuste y es la opción segura por defecto; les da el mismo voto a los dos carriles, así que en las paráfrasis los casi aciertos del carril de palabras clave ocupan algunos lugares que una suma ponderada ajustada reserva para el carril de significado.`),
    watch: { qtype: "paraphrase", lanes: "both", fusion: "raw", alpha: "0.5", depth: "20", rerank: "off" },
  },
  {
    id: "alpha",
    title: t("Turning the balance", "Girar el balance"),
    change: t("Min-max weighted sum with α = 0, 0.3, 0.5, 0.7 and 1 (0 = keywords only, 1 = meaning only) · recall@10 for each kind of query", "Suma ponderada con min-max, con α = 0, 0.3, 0.5, 0.7 y 1 (0 = solo palabras clave, 1 = solo significado) · recall@10 para cada tipo de consulta"),
    question: t("Which α is best?", "¿Qué α es el mejor?"),
    options: [t("0.5, whatever the queries: equal weight is fair", "0.5, sean cuales sean las consultas: el mismo peso es lo justo"), t("It depends on the queries: identifiers want weight on keywords, paraphrases on meaning, and the best overall α depends on your mix", "Depende de las consultas: los identificadores quieren peso en las palabras clave, las paráfrasis en el significado, y el mejor α general depende de tu mezcla"), t("1: meaning beats keywords", "1: el significado les gana a las palabras clave")],
    answer: 1,
    why: t(R.alpha.map((a) => `α ${a.alpha}: ${by(a)}`).join(". ") + `. Best for exact IDs: α ${bestAlphas("exact")}; for paraphrases: α ${bestAlphas("paraphrase")}; for mixed: α ${bestAlphas("mixed")}; over all 90: α ${bestAlphas("all")} (${best("all").all}%). The ends are just the single lanes. Tune α on a labelled sample of your own queries, and retune when the mix changes.`, R.alpha.map((a) => `α ${a.alpha}: ${byEs(a)}`).join(". ") + `. Mejor para IDs exactos: α ${bestAlphas("exact", " a ")}; para paráfrasis: α ${bestAlphas("paraphrase", " a ")}; para mixtas: α ${bestAlphas("mixed", " a ")}; sobre las 90: α ${bestAlphas("all", " a ")} (${best("all").all}%). Los extremos son solo los carriles por separado. Ajusta α con una muestra etiquetada de tus propias consultas, y vuelve a ajustarlo cuando cambie la mezcla.`),
    watch: { qtype: "all", lanes: "both", fusion: "minmax", alpha: "0.5", depth: "20", rerank: "off" },
  },
  {
    id: "depth",
    title: t("How deep each lane looks", "Qué tan profundo mira cada carril"),
    change: t("Each lane hands over its top 5, 20 or 100 candidates · merged with RRF · a reranker re-reads up to 100 of them · is a wanted article in the top 10?", "Cada carril entrega sus 5, 20 o 100 mejores candidatos · fusionados con RRF · un reranker relee hasta 100 de ellos · ¿un artículo buscado está en el top 10?"),
    question: t("What does looking deeper buy?", "¿Qué ganas mirando más profundo?"),
    options: [t("Nothing: the right article is always at the top of one lane", "Nada: el artículo correcto siempre está arriba en algún carril"), t("Too shallow and the right article never reaches the merge; past a point, more depth only adds reranking time", "Si es muy poco profundo, el artículo correcto nunca llega a la fusión; pasado cierto punto, más profundidad solo agrega tiempo de reranking"), t("Deeper is always better and costs nothing: retrieval is cheap", "Más profundo siempre es mejor y no cuesta nada: recuperar es barato")],
    answer: 1,
    why: t(R.depth.map((d) => `Depth ${d.depth}: the wanted articles reach the merge ${d.pool}% of the time, ${d.all}% end up in the top 10, ${d.ms} ms per query`).join(". ") + ". Merging and reranking can only reorder what the lanes handed over: an article that one lane ranked 8th and the other missed is gone at depth 5. Once the right articles are reliably in the pool, more depth only buys reranking time. Measure where that point is for your own queries.", R.depth.map((d) => `Profundidad ${d.depth}: los artículos buscados llegan a la fusión el ${d.pool}% de las veces, el ${d.all}% termina en el top 10, ${d.ms} ms por consulta`).join(". ") + ". La fusión y el reranking solo pueden reordenar lo que entregaron los carriles: un artículo que un carril puso en el puesto 8 y el otro no encontró desaparece con profundidad 5. Una vez que los artículos correctos están siempre entre los candidatos, más profundidad solo compra tiempo de reranking. Mide dónde está ese punto para tus propias consultas."),
    watch: { qtype: "mixed", lanes: "both", fusion: "rrf", depth: "5", rerank: "on" },
  },
  {
    id: "rerank",
    title: t("A reranker over the top 100", "Un reranker sobre los primeros 100"),
    change: t(`RRF over each lane's top 100 · then a cross-encoder reads the query and each of the top 100 together and rescores them (${LATENCY.perRerank} ms a candidate) · is the wanted article in the top 5?`, `RRF sobre los 100 mejores de cada carril · después un cross-encoder lee la consulta junto con cada uno de los primeros 100 y les vuelve a poner puntaje (${LATENCY.perRerank} ms por candidato) · ¿el artículo buscado está en el top 5?`),
    question: t("What does the reranker change?", "¿Qué cambia el reranker?"),
    options: [t("It finds articles neither lane retrieved", "Encuentra artículos que ningún carril recuperó"), t(`It puts the right ones on top more often, but not always, and adds about ${Math.round(R.rerank.on.ms - R.rerank.off.ms)} ms a query`, `Pone los correctos arriba más seguido, pero no siempre, y agrega unos ${Math.round(R.rerank.on.ms - R.rerank.off.ms)} ms por consulta`), t("Little, and it costs nothing", "Poco, y no cuesta nada")],
    answer: 1,
    why: t(`Without: ${by(R.rerank.off)} in the top 5, ${R.rerank.off.ms} ms. With: ${by(R.rerank.on)}, ${R.rerank.on.ms} ms. The two lanes score the query and an article separately, from a word count or two vectors; a cross-encoder reads them side by side, so it sees the product name, the identifier and the meaning at once. It is still a model and still makes mistakes, and it is too slow to run over a whole corpus, so it reorders a shortlist: it can't find what the lanes missed, and its cost grows with how many candidates it reads.`, `Sin él: ${byEs(R.rerank.off)} en el top 5, ${R.rerank.off.ms} ms. Con él: ${byEs(R.rerank.on)}, ${R.rerank.on.ms} ms. Los dos carriles puntúan la consulta y un artículo por separado, a partir de un conteo de palabras o de dos vectores; un cross-encoder los lee lado a lado, así que ve el nombre del producto, el identificador y el significado a la vez. Sigue siendo un modelo y sigue cometiendo errores, y es demasiado lento para correrlo sobre todo un corpus, así que reordena una lista corta: no puede encontrar lo que los carriles no encontraron, y su costo crece con la cantidad de candidatos que lee.`),
    watch: { qtype: "all", lanes: "both", fusion: "rrf", depth: "100", rerank: "on" },
  },
];

const QUESTIONS = [
  [t("A customer pastes \"E-4072\" into search, another types \"my money back for a cracked parcel\". Why does one retriever handle the first and miss the second, and the other the opposite?", "Un cliente pega \"E-4072\" en la búsqueda y otro escribe \"my money back for a cracked parcel\". ¿Por qué un recuperador (retriever) resuelve el primero y falla con el segundo, y el otro al revés?"),
    t("BM25 scores exact tokens, weighted by how rare they are: an identifier is rare, so the one article that contains it wins. But it has no idea that money back means refund or cracked means damaged. An embedding model puts words with similar meaning close together, so the paraphrase lands near the refund articles, but an identifier or a product name carries little learned meaning, so every error-code article looks about the same to it.", "BM25 puntúa tokens exactos, ponderados según qué tan raros son: un identificador es raro, así que gana el único artículo que lo contiene. Pero no tiene idea de que money back significa refund ni de que cracked significa damaged. Un modelo de embeddings pone cerca las palabras con significado parecido, así que la paráfrasis cae cerca de los artículos de reembolsos, pero un identificador o un nombre de producto tiene poco significado aprendido, así que para él todos los artículos de códigos de error se ven más o menos iguales.")],
  [t("You merge BM25 and vector results with a weighted sum and α seems to do nothing. What is probably wrong?", "Fusionas los resultados de BM25 y de vectores con una suma ponderada y α parece no hacer nada. ¿Qué es lo más probable que esté mal?"),
    t("The scores are on different scales: BM25 runs from 0 to tens, cosine from -1 to 1. Unscaled, the bigger numbers decide and α barely matters. Normalise each list first (min-max to 0..1, or z-scores), or use reciprocal rank fusion, which only looks at ranks: 1 / (60 + rank) from each list, summed.", "Los puntajes están en escalas distintas: BM25 va de 0 a decenas, el coseno de -1 a 1. Sin escalar, deciden los números más grandes y α casi no importa. Normaliza primero cada lista (min-max a 0..1, o z-scores), o usa fusión de rango recíproco, que solo mira los puestos: 1 / (60 + puesto) de cada lista, sumados.")],
  [t("How would you choose α, or decide between RRF and a weighted sum?", "¿Cómo elegirías α, o cómo decidirías entre RRF y una suma ponderada?"),
    t("Build a labelled set of real queries and the articles that should come back, broken down by kind, and measure recall@k or nDCG for each setting. RRF is a good default with nothing to tune. A weighted sum can beat it once tuned, but its best α depends on your query mix, so retune when the mix changes; some systems pick α per query, from how many identifiers the query contains.", "Arma un conjunto etiquetado de consultas reales y los artículos que deberían volver, separados por tipo, y mide recall@k o nDCG para cada configuración. RRF es un buen valor por defecto, sin nada que ajustar. Una suma ponderada puede superarlo una vez ajustada, pero su mejor α depende de tu mezcla de consultas, así que vuelve a ajustarlo cuando cambie la mezcla; algunos sistemas eligen α por consulta, según cuántos identificadores contiene.")],
  [t("With plain RRF, hybrid scored a little below the meaning lane alone on paraphrase queries. Why can merging cost a few points on one kind of query, and what can you do?", "Con RRF simple, la búsqueda híbrida sacó un poco menos que el carril de significado solo en las consultas de paráfrasis. ¿Por qué fusionar puede costar algunos puntos en un tipo de consulta, y qué puedes hacer?"),
    t("Fusion gives seats in the top k to whatever either list ranks well. On a paraphrase the keyword lane is the weaker one, and its top results include near-misses that share a word or two; plain RRF gives them the same vote as the meaning lane's results. Weight the lists (weighted RRF, or a tuned α), cap the weaker list's depth, or let a reranker reorder the merged list. Overall, hybrid still comes out ahead because it fixes the other lane's much bigger misses.", "La fusión les da lugares en el top k a los resultados que cualquiera de las dos listas ponga bien. En una paráfrasis, el carril de palabras clave es el más débil, y sus primeros resultados incluyen casi aciertos que comparten una o dos palabras; RRF simple les da el mismo voto que a los resultados del carril de significado. Pondera las listas (RRF ponderado, o un α ajustado), limita la profundidad de la lista más débil, o deja que un reranker reordene la lista fusionada. En general, la híbrida sigue saliendo adelante porque corrige las fallas mucho más grandes del otro carril.")],
  [t("Why rerank only the top 100 or so, and why can't a reranker fix a bad retrieval stage?", "¿Por qué hacer reranking solo de los primeros 100 o algo así, y por qué un reranker no puede arreglar una mala etapa de recuperación?"),
    t("A cross-encoder reads the query and each candidate together, which is accurate but costs a model call per candidate, far too slow for every document. So retrieval is the recall stage (get the right documents into the shortlist cheaply) and reranking the precision stage (put them in the right order). Anything retrieval left out never reaches the reranker, so depth per lane sets the ceiling.", "Un cross-encoder lee la consulta y cada candidato juntos, lo que es preciso pero cuesta una llamada al modelo por candidato, demasiado lento para todos los documentos. Así que la recuperación es la etapa de recall (meter los documentos correctos en la lista corta a bajo costo) y el reranking es la etapa de precisión (ponerlos en el orden correcto). Lo que la recuperación dejó afuera nunca llega al reranker, así que la profundidad por carril pone el techo.")],
  [t("Where does this show up in real systems?", "¿Dónde aparece esto en sistemas reales?"),
    t("Retrieval for RAG and site search: Elasticsearch and OpenSearch can combine a BM25 query with a kNN query and merge by RRF or normalised scores; Weaviate's hybrid search has an alpha (1 = pure vector); Postgres can pair full-text search with pgvector and merge in SQL. The design questions are the same as here: which lanes, how to merge, how deep, and whether a reranker is worth its latency.", "En la recuperación para RAG y en la búsqueda de sitios: Elasticsearch y OpenSearch pueden combinar una consulta BM25 con una consulta kNN y fusionar por RRF o con puntajes normalizados; la búsqueda híbrida de Weaviate tiene un alpha (1 = vector puro); Postgres puede combinar búsqueda de texto completo con pgvector y fusionar en SQL. Las preguntas de diseño son las mismas que aquí: qué carriles, cómo fusionar, con qué profundidad y si un reranker vale su latencia.")],
];

// ---------- page ----------
const figure = figurePlate({
  title: t("Sorting plant", "Planta clasificadora"),
  keys: [
    { mark: "lit", label: t("The article the query wants, wherever it ranks; the inspector while reranking", "El artículo que busca la consulta, en el puesto que esté; el inspector mientras hace reranking") },
    { mark: "raised", label: t("Numbered article tiles in ranked slots: 1 at the left", "Bloques numerados de artículos en lugares ordenados: el 1 a la izquierda") },
    { mark: "flat", label: t("Two lanes: keywords (raised, back) and meaning (front)", "Dos carriles: palabras clave (elevado, atrás) y significado (adelante)") },
  ],
  caption: t(
    "The query on the board goes down both lanes. The back lane sieves articles through holes cut to the query's exact words and racks the ten best BM25 matches; the front lane's magnet pulls articles by meaning and racks the ten nearest. The filled tile is the article the query wants (for a paraphrase, which names no product, every product's article on exactly that subject counts). The counter at the end of each rack shows where that lane ranked it (000: the lane didn't find it). Both lists pour into the merge hopper: tokens for reciprocal rank fusion, or a balance beam tilted by α for a weighted sum. With reranking on, the inspector re-reads the top candidates before they go to the results shelf. The scoreboard shows how often the wanted articles land in the top 10 for each kind of query, and the time per query.",
    "La consulta del tablero baja por los dos carriles. El carril de atrás cierne los artículos por agujeros cortados a la medida de las palabras exactas de la consulta y pone en su estante las diez mejores coincidencias de BM25; el imán del carril de adelante atrae los artículos por significado y pone en su estante los diez más cercanos. El bloque relleno es el artículo que busca la consulta (en una paráfrasis, que no nombra ningún producto, cuenta el artículo de cualquier producto sobre exactamente ese tema). El contador al final de cada estante muestra en qué puesto lo puso ese carril (000: el carril no lo encontró). Las dos listas caen en la tolva de fusión: fichas para la fusión de rango recíproco, o una balanza inclinada según α para una suma ponderada. Con el reranking activado, el inspector relee los primeros candidatos antes de que pasen al estante de resultados. El marcador muestra con qué frecuencia los artículos buscados quedan en el top 10 para cada tipo de consulta, y el tiempo por consulta.",
  ),
  stage: "data-plant",
  stageLabel: t("Hybrid search simulation. Space pauses or resumes.", "Simulación de búsqueda híbrida. Espacio pausa o reanuda."),
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">${tx(t(`A help centre of 240 articles (16 products × 15 topics) and 90 labelled queries. Times are a model: BM25 ${LATENCY.lexical} ms and the vector search ${LATENCY.semantic} ms, run side by side, ${LATENCY.fuse} ms to merge, ${LATENCY.perRerank} ms per candidate the reranker reads. α only applies to the weighted sums.`, `Un centro de ayuda de 240 artículos (16 productos × 15 temas) y 90 consultas etiquetadas. Los tiempos son un modelo: BM25 ${LATENCY.lexical} ms y la búsqueda vectorial ${LATENCY.semantic} ms, en paralelo, ${LATENCY.fuse} ms para fusionar, ${LATENCY.perRerank} ms por cada candidato que lee el reranker. α solo se aplica a las sumas ponderadas.`))}</p>`;
const controls = panel({
  stats: [["query", t("Query", "Consulta")], ["ra", t("Keyword lane", "Carril de palabras clave")], ["rb", t("Meaning lane", "Carril de significado")], ["rf", t("Result", "Resultado")], ["recall", t("Top-10 recall, this kind", "Recall en el top 10, este tipo")], ["ms", t("Time", "Tiempo")]],
  controls: [
    seg("qtype", t("Queries", "Consultas"), [["all", t("All", "Todas")], ["exact", t("Exact IDs", "IDs exactos")], ["paraphrase", t("Paraphrases", "Paráfrasis")], ["mixed", t("Mixed", "Mixtas")]], "all"),
    seg("lanes", t("Lanes", "Carriles"), [["both", t("Both", "Ambos")], ["lex", t("Keywords only", "Solo palabras clave")], ["sem", t("Meaning only", "Solo significado")]], "both"),
    seg("fusion", t("Merge", "Fusión"), [["rrf", "RRF"], ["minmax", t("Weighted, scaled", "Ponderada, escalada")], ["raw", t("Weighted, raw", "Ponderada, cruda")]], "rrf"),
    seg("alpha", t("α (meaning's weight)", "α (peso del significado)"), [["0", "0"], ["0.3", "0.3"], ["0.5", "0.5"], ["0.7", "0.7"], ["1", "1"]], "0.5"),
    seg("depth", t("Depth per lane", "Profundidad por carril"), [["5", "5"], ["20", "20"], ["100", "100"]], "20"),
    seg("rerank", t("Rerank", "Reranking"), [["off", t("Off", "No")], ["on", t("Top 100", "Primeros 100")]], "off"),
    speedSeg(),
    actions(t("Do something", "Haz algo"), [["next", t("Next query", "Siguiente consulta")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
.iso-stage [data-slot] text,.iso-stage [data-reading] text{pointer-events:none}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const RESULTS = ${JSON.stringify(R)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, title, answer, watch }) => ({ id, title, answer, watch })))};
const START = 85;                 // "Puffin parcel slow": keywords rank it 7th, meaning 3rd, the merge 1st

const { L: tr, T } = WB;
const KIND_ES = { exact: "exacta", paraphrase: "paráfrasis", mixed: "mixta" };                 // "exacta: …" in the Query stat
const QUERY_ES = { exact: "consulta exacta", paraphrase: "consulta de paráfrasis", mixed: "consulta mixta" };
const stage = document.querySelector("[data-plant]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const E = makeEngine(11);
const slot = (id) => { const g = q('[data-slot="' + id + '"]'); return { g, body: g.querySelector("[data-body]"), num: g.querySelector("[data-num]"), shown: null }; };
const tiles = { a: [], b: [], f: [] };
for (let i = 0; i < G.SLOTS; i++) for (const k of ["a", "b", "f"]) tiles[k].push(slot(k + i));
const reading = (() => { const g = q("[data-reading]"); return { g, body: g.querySelector("[data-body]"), num: g.querySelector("[data-num]") }; })();
const querySign = q("[data-query]"), sieveText = q("[data-sieve]"), fuseText = q("[data-fuse]"), closed = q("[data-closed]");
const counters = Object.fromEntries(["ranka", "rankb", "reread", "rexact", "rparaphrase", "rmixed", "ms"].map((n) => [n, WB.counter(svg, n, P)]));
const latDial = WB.dial(svg, "lat", P);
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(key, value) { const el = statEls[key]; const text = String(value); if (el && el.textContent !== text) el.textContent = text; }
const setText = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };

const cfg = { qtype: "all", lanes: "both", fusion: "rrf", alpha: "0.5", depth: "20", rerank: "off", speed: 1 };
const engCfg = () => ({ lexical: cfg.lanes !== "sem", semantic: cfg.lanes !== "lex", fusion: cfg.fusion, alpha: Number(cfg.alpha), depth: Number(cfg.depth), rerank: cfg.rerank === "on" });
let scores = null, order = [], at = 0, cur = null, t = 0;

function rescore() {
  const r = E.evaluate(engCfg(), 10);
  scores = r;
  counters.rexact.set(Math.round(r.exact.recall * 100)); counters.rparaphrase.set(Math.round(r.paraphrase.recall * 100)); counters.rmixed.set(Math.round(r.mixed.recall * 100));
}
function queue() {
  const byType = (t) => E.queries.filter((x) => x.type === t);
  if (cfg.qtype !== "all") return byType(cfg.qtype).map((x) => x.id);
  const [a, b, c] = ["mixed", "exact", "paraphrase"].map(byType);
  const out = [];
  for (let i = 0; i < 30; i++) out.push(a[i].id, b[i].id, c[i].id);
  return out;
}
function begin(id, startAt = 0) {
  const query = E.queries[id];
  const res = E.search(query, engCfg());
  const L = E.lists(query);
  const rankA = cfg.lanes === "sem" ? 0 : (L.lex[query.target] > 0 ? L.lexRank.indexOf(query.target) + 1 : 0);
  const rankB = cfg.lanes === "lex" ? 0 : L.semRank.indexOf(query.target) + 1;
  const rf = res.final.indexOf(query.target) + 1;
  const rel = new Set(query.rel);
  const rr = res.reranked ? 0.6 + 1.4 * Math.min(1, res.reranked / 100) : 0;
  cur = { query, res, rankA, rankB, rf, rel, rr, shelf0: 3 + rr };
  t = startAt;
  const terms = tokens(query.words);
  cur.terms = terms;
  setText(querySign, query.text);
  words();
  paint();
}
function next() { at = (at + 1) % order.length; begin(order[at]); }
function restart(startAt = 0, first) {
  rescore();
  order = queue();
  const want = first ? START : order[0];
  at = Math.max(0, order.indexOf(want));
  WB.pose(svg, "fusion", cfg.fusion === "rrf" || cfg.lanes !== "both" ? "rrf" : "a" + cfg.alpha);
  closed.style.display = cfg.rerank === "on" ? "none" : "";
  begin(order[at], startAt);
}

// the words on the sieve and the hopper, redrawn when the reader switches language
function words() {
  setText(sieveText, cfg.lanes === "sem" ? tr("lane off", "carril apagado") : cur.terms.join(" · "));
  setText(fuseText, cfg.lanes !== "both" ? tr("ONE LANE", "UN CARRIL") : cfg.fusion === "rrf" ? "RRF" : (cfg.fusion === "raw" ? tr("RAW ", "CRUDO ") : "α ") + cfg.alpha);
}

function dress(tile, docId) {
  const key = docId === null ? null : docId + (cur.rel.has(docId) ? "*" : "");
  if (tile.shown === key) return;
  tile.shown = key;
  if (docId === null) { tile.g.style.display = "none"; return; }
  tile.g.style.display = "";
  setText(tile.num, String(E.docs[docId].n));
  tile.body.toggleAttribute("data-lit", cur.rel.has(docId));
}
function drop(tile, k) {   // a tile settles into its slot over its first 0.25 s
  const lift = Math.max(0, 1 - k / 0.25);
  tile.g.style.opacity = String(Math.min(1, k / 0.12));
  const base = tile.g.dataset.base || (tile.g.dataset.base = tile.g.getAttribute("transform"));
  tile.g.setAttribute("transform", lift > 0 ? base + " " + translateAlong(P, [0, 0, 6 * lift]) : base);
}

function paint() {
  const c = cur, r = c.res;
  const fillAt = (i) => 0.5 + 0.18 * i;
  for (const [lane, list] of [["a", r.lexTop], ["b", r.semTop]]) {
    tiles[lane].forEach((tile, i) => {
      const k = t - fillAt(i);
      const id = k >= 0 && i < list.length ? list[i] : null;
      dress(tile, id);
      if (id !== null) drop(tile, k);
    });
  }
  const laneDone = t >= fillAt(9) + 0.25;
  counters.ranka.set(laneDone ? Math.min(999, c.rankA) : 0); counters.rankb.set(laneDone ? Math.min(999, c.rankB) : 0);
  // reranking: the inspector re-reads the head of the merged list
  const rrK = c.rr ? (t - 3) / c.rr : -1;
  const reading_ = c.rr && rrK >= 0 && rrK < 1;
  WB.pose(svg, "inspector", cfg.rerank !== "on" ? "off" : reading_ ? "lit" : "on");
  if (reading_) {
    const n = Math.floor(rrK * r.reranked);
    const id = r.final[Math.min(r.final.length - 1, n % Math.min(r.final.length, 100))];
    reading.g.style.display = "";
    setText(reading.num, String(E.docs[id].n));
    reading.body.toggleAttribute("data-lit", c.rel.has(id));
  } else reading.g.style.display = "none";
  const rrDone = Math.max(0, Math.min(1, rrK));
  counters.reread.set(Math.round(rrDone * r.reranked));
  latDial.set(Math.min(1, (t >= 3 ? (Math.max(0, Math.min(1, (t - 2.6) / 0.4)) * (r.ms - r.reranked * LATENCY.perRerank) + rrDone * r.reranked * LATENCY.perRerank) : 0) / 300));
  tiles.f.forEach((tile, i) => {
    const k = t - (c.shelf0 + 0.14 * i);
    const id = k >= 0 && i < r.final.length ? r.final[i] : null;
    dress(tile, id);
    if (id !== null) drop(tile, k);
  });
  const done = t >= c.shelf0 + 0.14 * 9 + 0.25;
  counters.ms.set(done ? Math.round(r.ms) : 0);
  const show = (x) => (x ? "#" + x : tr("not found", "no encontrado")), off = tr("off", "apagado");
  stat("query", tr(c.query.type, KIND_ES[c.query.type]) + ": " + c.query.text);
  stat("ra", cfg.lanes === "sem" ? off : laneDone ? show(c.rankA) : "…");
  stat("rb", cfg.lanes === "lex" ? off : laneDone ? show(c.rankB) : "…");
  stat("rf", done ? show(c.rf) + (c.rel.size > 1 ? tr(" (" + c.rel.size + " articles count)", " (cuentan " + c.rel.size + " artículos)") : "") : "…");
  stat("recall", scores ? Math.round(scores[c.query.type].recall * 100) + "%" : "");
  stat("ms", done ? Math.round(r.ms) + " ms" : "…");
  const head = '"' + c.query.text + '"';
  const ra = cfg.lanes === "sem" ? off : show(c.rankA), rb = cfg.lanes === "lex" ? off : show(c.rankB);
  if (t < 0.5) say(tr(c.query.type + " query " + head + " · down both lanes", QUERY_ES[c.query.type] + " " + head + " · por los dos carriles"));
  else if (!laneDone) say(head + tr(" · lanes filling their racks", " · los carriles llenan sus estantes"));
  else if (t < 3) say(head + tr(" · keywords " + ra + " · meaning " + rb + " · merging", " · palabras clave " + ra + " · significado " + rb + " · fusionando"));
  else if (reading_) say(head + tr(" · reranker re-reading " + r.reranked + " candidates", " · el reranker relee " + r.reranked + " candidatos"));
  else say(head + tr(" · keywords " + ra + " · meaning " + rb + " · result " + show(c.rf), " · palabras clave " + ra + " · significado " + rb + " · resultado " + show(c.rf)));
}

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => { t += dt * cfg.speed; if (t > cur.shelf0 + 1.6 + 2.6) next(); else paint(); }, onPause: (on) => { pauseBtn.textContent = on ? tr("Play", "Reanudar") : tr("Pause", "Pausa"); if (on) say(tr("paused", "en pausa")); } });
WB.onLang(() => {
  pauseBtn.textContent = loop.paused ? tr("Play", "Reanudar") : tr("Pause", "Pausa");
  if (cur) { words(); paint(); }
  if (loop.paused) say(tr("paused", "en pausa"));
});

function set(name, raw, quiet) {
  WB.pressSeg(name, raw);
  if (name === "speed") { cfg.speed = Number(raw); return; }
  cfg[name] = raw;
  if (!quiet) restart();
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="next"]').addEventListener("click", () => { next(); if (loop.paused) loop.setPaused(false); });
document.querySelector('[data-act="reset"]').addEventListener("click", () => restart());
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments (same model: 90 labelled queries on each of five generated help centres) ----------
const kinds = (o, after) => [["Exact IDs", o.exact / 100, o.exact + "%", after], ["Paraphrases", o.paraphrase / 100, o.paraphrase + "%", after], ["Mixed", o.mixed / 100, o.mixed + "%", after]];
const RUNS = {
  lanes: () => { const { lexical, semantic, hybrid } = RESULTS.three;
    const trio = (o) => o.exact + " / " + o.paraphrase + " / " + o.mixed + "%";
    return { verdict: T("Keyword lane: " + trio(lexical) + " (exact / paraphrase / mixed). Meaning lane: " + trio(semantic) + ". Both, merged: " + trio(hybrid) + ".",
        "Carril de palabras clave: " + trio(lexical) + " (exactas / paráfrasis / mixtas). Carril de significado: " + trio(semantic) + ". Los dos, fusionados: " + trio(hybrid) + "."),
      bars: [[T("Keywords: exact IDs", "Palabras clave: IDs exactos"), lexical.exact / 100, lexical.exact + "%"], [T("Keywords: paraphrases", "Palabras clave: paráfrasis"), lexical.paraphrase / 100, lexical.paraphrase + "%"], [T("Meaning: exact IDs", "Significado: IDs exactos"), semantic.exact / 100, semantic.exact + "%"], [T("Meaning: paraphrases", "Significado: paráfrasis"), semantic.paraphrase / 100, semantic.paraphrase + "%"], [T("Both: exact IDs", "Ambos: IDs exactos"), hybrid.exact / 100, hybrid.exact + "%", true], [T("Both: paraphrases", "Ambos: paráfrasis"), hybrid.paraphrase / 100, hybrid.paraphrase + "%", true], [T("Both: mixed (keywords " + lexical.mixed + "%, meaning " + semantic.mixed + "%)", "Ambos: mixtas (palabras clave " + lexical.mixed + "%, significado " + semantic.mixed + "%)"), hybrid.mixed / 100, hybrid.mixed + "%", true]] }; },
  fusion: () => { const { raw, minmax, rrf } = RESULTS.fusion;
    return { verdict: T("Paraphrases in the top 10: raw sum " + raw.paraphrase + "%, scaled sum " + minmax.paraphrase + "%, RRF " + rrf.paraphrase + "%. Over all 90 queries: " + raw.all + "%, " + minmax.all + "%, " + rrf.all + "%. The keyword lane alone gets " + RESULTS.three.lexical.paraphrase + "% of paraphrases.",
        "Paráfrasis en el top 10: suma cruda " + raw.paraphrase + "%, suma escalada " + minmax.paraphrase + "%, RRF " + rrf.paraphrase + "%. Sobre las 90 consultas: " + raw.all + "%, " + minmax.all + "%, " + rrf.all + "%. El carril de palabras clave solo consigue el " + RESULTS.three.lexical.paraphrase + "% de las paráfrasis."),
      bars: [[T("Paraphrases, raw sum", "Paráfrasis, suma cruda"), raw.paraphrase / 100, raw.paraphrase + "%", true], [T("Paraphrases, scaled sum", "Paráfrasis, suma escalada"), minmax.paraphrase / 100, minmax.paraphrase + "%"], [T("Paraphrases, RRF", "Paráfrasis, RRF"), rrf.paraphrase / 100, rrf.paraphrase + "%"], [T("All queries, raw sum", "Todas las consultas, suma cruda"), raw.all / 100, raw.all + "%", true], [T("All queries, scaled sum", "Todas las consultas, suma escalada"), minmax.all / 100, minmax.all + "%"], [T("All queries, RRF", "Todas las consultas, RRF"), rrf.all / 100, rrf.all + "%"]] }; },
  alpha: () => { const A = RESULTS.alpha; const top = (k) => A.reduce((b, a) => (a[k] > b[k] ? a : b));
    const span = (k, to = " to ") => { const m = top(k)[k]; const h = A.filter((a) => a[k] === m).map((a) => a.alpha); return h.length > 1 ? h[0] + to + h[h.length - 1] : String(h[0]); };
    return { verdict: T("Best α for exact IDs " + span("exact") + ", for paraphrases " + span("paraphrase") + ", for mixed " + span("mixed") + "; over all 90 queries α " + span("all") + " (" + top("all").all + "%). α 0 and α 1 are just the two lanes alone.",
        "Mejor α para IDs exactos " + span("exact", " a ") + ", para paráfrasis " + span("paraphrase", " a ") + ", para mixtas " + span("mixed", " a ") + "; sobre las 90 consultas, α " + span("all", " a ") + " (" + top("all").all + "%). α 0 y α 1 son solo los dos carriles por separado."),
      bars: A.map((a) => [T("α " + a.alpha + ": exact " + a.exact + " · para " + a.paraphrase + " · mixed " + a.mixed, "α " + a.alpha + ": exactas " + a.exact + " · paráf. " + a.paraphrase + " · mixtas " + a.mixed), a.all / 100, a.all + "%", a.alpha === top("all").alpha]) }; },
  depth: () => { const D = RESULTS.depth;
    return { verdict: T(D.map((d) => "Depth " + d.depth + ": " + d.pool + "% reach the merge, " + d.all + "% in the top 10, " + d.ms + " ms").join(". ") + ".",
        D.map((d) => "Profundidad " + d.depth + ": el " + d.pool + "% llega a la fusión, el " + d.all + "% al top 10, " + d.ms + " ms").join(". ") + "."),
      bars: D.flatMap((d) => [[T("Depth " + d.depth + ": in the top 10", "Profundidad " + d.depth + ": en el top 10"), d.all / 100, d.all + "%", d.depth !== 10], [T("Depth " + d.depth + ": time (of 300 ms)", "Profundidad " + d.depth + ": tiempo (de 300 ms)"), Math.min(1, d.ms / 300), d.ms + " ms"]]) }; },
  rerank: () => { const { off, on } = RESULTS.rerank;
    return { verdict: T("In the top 5 without reranking: " + off.all + "% (" + off.exact + " / " + off.paraphrase + " / " + off.mixed + "), " + off.ms + " ms. With the reranker over the top 100: " + on.all + "% (" + on.exact + " / " + on.paraphrase + " / " + on.mixed + "), " + on.ms + " ms.",
        "En el top 5 sin reranking: " + off.all + "% (" + off.exact + " / " + off.paraphrase + " / " + off.mixed + "), " + off.ms + " ms. Con el reranker sobre los primeros 100: " + on.all + "% (" + on.exact + " / " + on.paraphrase + " / " + on.mixed + "), " + on.ms + " ms."),
      bars: [[T("Top 5, no rerank", "Top 5, sin reranking"), off.all / 100, off.all + "%"], [T("Top 5, reranked", "Top 5, con reranking"), on.all / 100, on.all + "%", true], [T("Time, no rerank (of 300 ms)", "Tiempo, sin reranking (de 300 ms)"), off.ms / 300, off.ms + " ms"], [T("Time, reranked (of 300 ms)", "Tiempo, con reranking (de 300 ms)"), on.ms / 300, on.ms + " ms", true]] }; },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  for (const key of ["qtype", "lanes", "fusion", "alpha", "depth", "rerank"]) if (w[key] !== undefined) set(key, w[key], true);
  restart();
  if (loop.paused) loop.setPaused(false);
} });

loop.setPaused(loop.paused);
restart(4.7, true);
`;

const size = writePage(new URL("./hybrid-search-workbench.html", import.meta.url), {
  title: t("Hybrid Search Workbench", "Banco de trabajo: búsqueda híbrida"),
  eyebrow: t("Systems lesson 38 · Hybrid search", "Lección de sistemas 38 · Búsqueda híbrida"),
  lede: t("Hybrid search runs a keyword retriever and a meaning retriever on the same query and merges what they find. Each one misses a different kind of query, so the merged list catches both, if the merge is done right. This lesson runs a two-lane sorting plant over a help centre: watch it, predict what changes the results, then explain it back.",
    "La búsqueda híbrida corre un recuperador por palabras clave y otro por significado sobre la misma consulta y fusiona lo que encuentran. Cada uno falla en un tipo distinto de consulta, así que la lista fusionada atrapa los dos, si la fusión se hace bien. Esta lección pone a funcionar una planta clasificadora de dos carriles sobre un centro de ayuda: mírala, predice qué cambia los resultados y después explícalo."),
  machine: { intro: t("Each query goes down both lanes. The keyword lane (BM25) sieves articles by the query's exact words; the meaning lane (embeddings) pulls them by similarity. Their racks pour into the merge hopper, an optional reranker re-reads the top candidates, and the best ten land on the results shelf. The filled tile is the article the query wants. Try the three kinds of query, a single lane, the merge method, α, the depth and the reranker.",
    "Cada consulta baja por los dos carriles. El carril de palabras clave (BM25) cierne los artículos por las palabras exactas de la consulta; el carril de significado (embeddings) los atrae por similitud. Sus estantes caen en la tolva de fusión, un reranker opcional relee los primeros candidatos y los diez mejores llegan al estante de resultados. El bloque relleno es el artículo que busca la consulta. Prueba los tres tipos de consulta, un solo carril, el método de fusión, α, la profundidad y el reranker. Los artículos y las consultas están en inglés para que las cifras coincidan con el modelo."), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine: 90 labelled queries on each of five generated help centres, averaged.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina: 90 consultas etiquetadas sobre cada uno de cinco centros de ayuda generados, en promedio."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson: real BM25, a toy embedding and a modelled reranker over a made-up help centre.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección: BM25 real, un embedding de juguete y un reranker modelado sobre un centro de ayuda inventado.`),
  css,
  script: live,
});
console.log("wrote hybrid-search-workbench.html", (size / 1024).toFixed(0) + " KB");

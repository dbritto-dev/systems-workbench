// @ts-nocheck: content ported as-is
// Systems lesson 39 · Contextual retrieval: a print shop that indexes reports and answers questions from the index.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { int } from "../../lib/format";
import { buildFigure, cardSvg, P, GEOMETRY } from "./figure";
import { makeCorpus, buildIndex, retrieve, contextCost, POOL, expEmbeddings, expBm25, expRerank, expTopK, expCost } from "./sim";

const POST = `<a href="https://www.anthropic.com/engineering/contextual-retrieval" target="_blank" rel="noopener">Introducing Contextual Retrieval</a>`;

// Experiment results, computed at build time from the same model the page shows (6 seeded corpora each). They take
// a while, so RESULTS_CACHE=<file> keeps them between builds.
const CACHE = process.env.RESULTS_CACHE;
const R = CACHE && existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : { emb: expEmbeddings(), bm25: expBm25(), rerank: expRerank(), topk: expTopK(), cost: expCost() };
if (CACHE && !existsSync(CACHE)) writeFileSync(CACHE, JSON.stringify(R));

// ---------- the machine's own run: one corpus, every question, every setting ----------
const SEED = 7;
const corpus = makeCorpus(SEED);
const idx = { plain: buildIndex(corpus, false), ctx: buildIndex(corpus, true) };
const RANKS = {};
for (const ctx of [0, 1]) for (const bm25 of [0, 1]) for (const rerank of [0, 1]) {
  RANKS[`${ctx}${bm25}${rerank}`] = corpus.questions.map((q, i) => { const r = retrieve(idx[ctx ? "ctx" : "plain"], q, { bm25: !!bm25, rerank: !!rerank, k: 20, seed: SEED + i }); return [r.firstRank, r.finalRank]; });
}
// a fixed shuffle so the questions don't arrive company by company
const ORDER = corpus.questions.map((_, i) => i);
{ let a = 99; const rnd = () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; }; for (let i = ORDER.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ORDER[i], ORDER[j]] = [ORDER[j], ORDER[i]]; } }
const QS = ORDER.map((i) => { const q = corpus.questions[i], c = corpus.chunks[q.gold]; return { i, label: q.label.replace(/ (\w+) QUARTER OF/, "").replace("FIRST QUARTER OF", "Q1"), text: q.text, chunk: c.text, context: c.context }; });
const DOCS = [...new Set(corpus.chunks.map((c) => c.doc))].map((d) => d.toUpperCase().replace(" MANUAL", " MANUAL"));
const COST = { on: contextCost({ caching: true }), off: contextCost({ caching: false }) };

const pct = (x) => (x < 10 ? x.toFixed(1) : x.toFixed(0)) + "%";
const usd = (x) => "$" + x.toFixed(2);

// What each card shows after a run.
const pc = (x) => x.toFixed(1) + "%";
const of30 = (x) => Math.min(1, x / 30);
const RUNS = {
  emb: () => { const r = R.emb, fewer = Math.round(100 * (1 - r.ctx / r.plain)); return { verdict: t("Plain chunks: " + pc(r.plain) + " of questions missed. With the context stamped on: " + pc(r.ctx) + ", " + fewer + "% fewer, but some are still missed.",
      "Fragmentos sin contexto: " + pc(r.plain) + " de las preguntas falladas. Con el contexto estampado: " + pc(r.ctx) + ", un " + fewer + "% menos, pero todavía se fallan algunas."),
    bars: [[t("Missed, plain chunks", "Falladas, fragmentos sin contexto"), of30(r.plain), pc(r.plain)], [t("Missed, chunks with context", "Falladas, fragmentos con contexto"), of30(r.ctx), pc(r.ctx), true]] }; },
  bm25: () => { const r = R.bm25; return { verdict: t("Meaning only, with context: " + pc(r.ctx) + " missed. Meaning + BM25 on the same stamped cards: " + pc(r.both) + ". The same two searches on plain cards: " + pc(r.plainBoth) + ".",
      "Solo significado, con contexto: " + pc(r.ctx) + " falladas. Significado + BM25 sobre las mismas tarjetas estampadas: " + pc(r.both) + ". Las mismas dos búsquedas sobre tarjetas sin contexto: " + pc(r.plainBoth) + "."),
    bars: [[t("Meaning only, context", "Solo significado, con contexto"), of30(r.ctx), pc(r.ctx)], [t("Meaning + BM25, context", "Significado + BM25, con contexto"), of30(r.both), pc(r.both), true], [t("Meaning + BM25, plain", "Significado + BM25, sin contexto"), of30(r.plainBoth), pc(r.plainBoth)]] }; },
  rerank: () => { const r = R.rerank; return { verdict: t("Without reranking: " + pc(r.both) + " missed. Fetch 150, rerank, keep 20: " + pc(r.reranked) + ". Reranking plain cards instead: " + pc(r.plainReranked) + ": with nothing to tell the look-alikes apart, it only reshuffles them. Overall, from plain chunks: " + pc(r.plain) + " → " + pc(r.reranked) + ".",
      "Sin reranking: " + pc(r.both) + " falladas. Traer 150, hacer reranking y quedarse con 20: " + pc(r.reranked) + ". Con reranking sobre tarjetas sin contexto: " + pc(r.plainReranked) + ": sin nada que distinga a los parecidos, solo los vuelve a mezclar. En total, desde fragmentos sin contexto: " + pc(r.plain) + " → " + pc(r.reranked) + "."),
    bars: [[t("Plain, meaning only", "Sin contexto, solo significado"), of30(r.plain), pc(r.plain)], [t("Context, meaning + BM25", "Con contexto, significado + BM25"), of30(r.both), pc(r.both)], [t("…and reranked", "…y con reranking"), of30(r.reranked), pc(r.reranked), true], [t("Plain, meaning + BM25, reranked", "Sin contexto, significado + BM25, con reranking"), of30(r.plainReranked), pc(r.plainReranked)]] }; },
  topk: () => { const r = R.topk, top = Math.max(r.k5, 0.1); return { verdict: t("Passing on 5: " + pc(r.k5) + " missed. 10: " + pc(r.k10) + ". 20: " + pc(r.k20) + ".", "Pasando 5: " + pc(r.k5) + " falladas. 10: " + pc(r.k10) + ". 20: " + pc(r.k20) + "."),
    bars: [[t("Missed, top 5", "Falladas, top 5"), r.k5 / top, pc(r.k5)], [t("Missed, top 10", "Falladas, top 10"), r.k10 / top, pc(r.k10)], [t("Missed, top 20", "Falladas, top 20"), r.k20 / top, pc(r.k20), true]] }; },
  cost: () => { const r = R.cost; return { verdict: t("Without caching: $" + r.uncached.toFixed(2) + " per million document tokens. With caching: $" + r.cached.toFixed(2) + " (the post's estimate: $1.02). This corpus stands for " + Math.round(r.corpusTokens / 1000) + "k tokens, well over the ~200k you could just put in the prompt; one company's filings (" + Math.round(r.oneCompany / 1000) + "k) would fit.",
      "Sin caché: $" + r.uncached.toFixed(2) + " por millón de tokens de documento. Con caché: $" + r.cached.toFixed(2) + " (la estimación del artículo: $1.02). Este corpus representa " + Math.round(r.corpusTokens / 1000) + "k tokens, mucho más que los ~200k que podrías poner directamente en el prompt; los informes de una sola empresa (" + Math.round(r.oneCompany / 1000) + "k) sí cabrían."),
    bars: [[t("Cost without caching ($0–4)", "Costo sin caché ($0–4)"), r.uncached / 4, "$" + r.uncached.toFixed(2)], [t("Cost with caching ($0–4)", "Costo con caché ($0–4)"), r.cached / 4, "$" + r.cached.toFixed(2), true], [t("This corpus (of 1.5M tokens)", "Este corpus (de 1.5M tokens)"), Math.min(1, r.corpusTokens / 1.5e6), Math.round(r.corpusTokens / 1000) + "k"], [t("Prompt budget to skip retrieval", "Presupuesto del prompt para omitir la recuperación"), r.budget / 1.5e6, "200k"]] }; },
};

const EXPERIMENTS = [
  {
    id: "emb",
    title: t("Stamp the context on every card", "Estampar el contexto en cada tarjeta"),
    change: t("Search by meaning only (embeddings) · plain chunk cards → cards with the context header stamped on before they are embedded · top 20 passed on", "Búsqueda solo por significado (embeddings) · tarjetas de fragmentos sin contexto → tarjetas con el encabezado de contexto estampado antes de calcular su embedding · se pasan los 20 primeros"),
    question: t("What happens to the share of questions whose answer chunk isn't among the 20 passed on?", "¿Qué pasa con la proporción de preguntas cuyo fragmento con la respuesta no está entre los 20 que se pasan?"),
    options: [t("Nothing: the chunk's own words haven't changed", "Nada: las palabras del fragmento no cambiaron"), t("It drops by a third or more, but plenty are still missed", "Baja un tercio o más, pero todavía se fallan bastantes"), t("It drops to almost nothing", "Baja casi a cero")],
    answer: 1,
    why: t(`A plain chunk like "The company's revenue grew by 3% over the previous quarter." reads the same in every filing that reports revenue (about 64 here), so a question about Acme's second quarter matches all of them about equally; a chunk about a recall or a lawsuit is rarer, so it is usually found anyway. The stamped header names the company and quarter, and the embedding now leans toward the right chunk. Only leans: embeddings carry names weakly (to an embedding one company looks a lot like another) and pay little attention to exact codes, so some questions still miss. The post measured the same direction on real data: Contextual Embeddings cut the top-20 failure rate by 35%, from 5.7% to 3.7%.`, `Un fragmento sin contexto como "The company's revenue grew by 3% over the previous quarter." se lee igual en cada informe que reporta ingresos (unos 64 aquí), así que una pregunta sobre el segundo trimestre de Acme coincide con todos más o menos por igual; un fragmento sobre un retiro de producto o una demanda es más raro, así que por lo general se encuentra de todos modos. El encabezado estampado nombra la empresa y el trimestre, y ahora el embedding se inclina hacia el fragmento correcto. Solo se inclina: los embeddings retienen mal los nombres (para un embedding, una empresa se parece mucho a otra) y prestan poca atención a los códigos exactos, así que algunas preguntas siguen fallando. El artículo midió la misma dirección con datos reales: Contextual Embeddings redujo la tasa de fallas en el top 20 un 35%, de 5.7% a 3.7%.`),
    watch: { ctx: "plain", search: "emb", rerank: "off", k: "20", cache: "on" },
  },
  {
    id: "bm25",
    title: t("Search the words as well", "Buscar también por palabras"),
    change: t("Cards with context · meaning only → meaning plus a BM25 keyword index of the same stamped cards, the two rankings merged by reciprocal rank fusion", "Tarjetas con contexto · solo significado → significado más un índice de palabras clave BM25 de las mismas tarjetas estampadas, con los dos rankings fusionados por fusión de rango recíproco"),
    question: t("Adding a keyword index to the meaning search: what happens to the failures?", "Al agregar un índice de palabras clave a la búsqueda por significado, ¿qué pasa con las fallas?"),
    options: [t("Nothing: the meaning search already found the right topic", "Nada: la búsqueda por significado ya encontraba el tema correcto"), t("Another clear step down, because the header's names now match the question word for word", "Otro escalón claro hacia abajo, porque los nombres del encabezado ahora coinciden palabra por palabra con la pregunta"), t("Almost all the remaining failures go away", "Desaparecen casi todas las fallas restantes")],
    answer: 1,
    why: t(`BM25 rewards exact, rare words: "Acme", "2023", a product name. With the context stamped on, every Acme chunk now carries "Acme", so the keyword index can pick Acme's chunk out of the look-alikes, which the embedding could only lean toward. It can't help when the question says "ACM" or "the second quarter" and the header says "Acme Corp" and "Q2": exact words only. The meaning search still covers paraphrases ("sales rise" for "revenue grew"), and rank fusion (here weighted 0.8 meaning, 0.2 keywords) keeps what either list puts near the top. On plain chunks the company name appears only on the cover, so BM25 has nothing to match and changes almost nothing. The post: Contextual Embeddings plus Contextual BM25 cut the failure rate by 49% (5.7% → 2.9%).`, `BM25 premia las palabras exactas y raras: "Acme", "2023", un nombre de producto. Con el contexto estampado, cada fragmento de Acme ahora lleva "Acme", así que el índice de palabras clave puede distinguir el fragmento de Acme entre los parecidos, cuando el embedding solo podía inclinarse hacia él. No sirve cuando la pregunta dice "ACM" o "the second quarter" y el encabezado dice "Acme Corp" y "Q2": solo palabras exactas. La búsqueda por significado sigue cubriendo las paráfrasis ("sales rise" por "revenue grew"), y la fusión de rankings (aquí con peso 0.8 para el significado y 0.2 para las palabras clave) conserva lo que cualquiera de las dos listas ponga arriba. En fragmentos sin contexto, el nombre de la empresa aparece solo en la portada, así que BM25 no tiene con qué coincidir y casi no cambia nada. El artículo: Contextual Embeddings más Contextual BM25 redujeron la tasa de fallas un 49% (5.7% → 2.9%).`),
    watch: { ctx: "ctx", search: "both", rerank: "off", k: "20", cache: "on" },
  },
  {
    id: "rerank",
    title: t("Rerank 150, keep 20", "Reranking de 150, quedarse con 20"),
    change: t("Context, meaning and BM25 · pass the top 20 straight on → fetch the top 150, let a reranker that reads question and chunk together reorder them, pass its top 20 on", "Contexto, significado y BM25 · pasar los 20 primeros directamente → traer los 150 primeros, dejar que un reranker que lee la pregunta y el fragmento juntos los reordene, y pasar sus 20 primeros"),
    question: t("What does the reranker change?", "¿Qué cambia el reranker?"),
    options: [t("Nothing: the answer is either in the first 20 or it isn't", "Nada: la respuesta está entre los 20 primeros o no está"), t("It rescues answers that were found but ranked 21st to 150th, so failures drop again", "Rescata respuestas que se encontraron pero quedaron entre los puestos 21 y 150, así que las fallas bajan otra vez"), t("It finds answers that weren't in the 150 at all", "Encuentra respuestas que no estaban entre los 150")],
    answer: 1,
    why: t(`First-stage search is fast and rough; a reranker is slower but reads the question and the whole chunk (with its context) together, so it can put the right chunk first even when it came back 60th. It can only reorder what it is given, though: an answer outside the 150 stays missed, and on plain chunks it has nothing to tell the look-alikes apart with, so it just reshuffles them. The post retrieved 150, reranked with Cohere's reranker and kept 20: failures fell by 67% overall (5.7% → 1.9%). The cost is a little latency and money per query.`, `La búsqueda de primera etapa es rápida y aproximada; un reranker es más lento, pero lee la pregunta y el fragmento completo (con su contexto) juntos, así que puede poner primero el fragmento correcto aunque haya vuelto en el puesto 60. Pero solo puede reordenar lo que recibe: una respuesta fuera de los 150 sigue fallada, y en fragmentos sin contexto no tiene con qué distinguir a los parecidos, así que solo los vuelve a mezclar. El artículo recuperó 150, hizo reranking con el reranker de Cohere y se quedó con 20: las fallas bajaron un 67% en total (5.7% → 1.9%). El costo es un poco de latencia y de dinero por consulta.`),
    watch: { ctx: "ctx", search: "both", rerank: "on", k: "20", cache: "on" },
  },
  {
    id: "topk",
    title: t("How many chunks to pass on", "Cuántos fragmentos pasar"),
    change: t("The full pipeline (context, meaning + BM25, reranked) · pass on the top 5 / 10 / 20 chunks", "El pipeline completo (contexto, significado + BM25, con reranking) · pasar los 5 / 10 / 20 primeros fragmentos"),
    question: t("Which passes the answer to the model most often?", "¿Con cuál le llega la respuesta al modelo más seguido?"),
    options: [t("5: fewer, better chunks", "5: menos fragmentos, pero mejores"), t("20: more chances that the answer is among them", "20: más posibilidades de que la respuesta esté entre ellos"), t("No difference once the results are reranked", "No hay diferencia una vez que los resultados pasan por el reranking")],
    answer: 1,
    why: t(`Even after reranking, the right chunk is sometimes 6th or 12th, so a short list drops it. Twenty chunks of 800 tokens is still a small prompt for a modern model. The post tried 5, 10 and 20 and found 20 worked best. Past that, more chunks cost tokens and can bury the answer among near-misses, so measure on your own questions.`, `Incluso después del reranking, el fragmento correcto a veces queda en el puesto 6 o 12, así que una lista corta lo deja afuera. Veinte fragmentos de 800 tokens siguen siendo un prompt chico para un modelo moderno. El artículo probó 5, 10 y 20 y encontró que 20 funcionaba mejor. Más allá de eso, más fragmentos cuestan tokens y pueden enterrar la respuesta entre casi aciertos, así que mide con tus propias preguntas.`),
    watch: { ctx: "ctx", search: "both", rerank: "on", k: "5", cache: "on" },
  },
  {
    id: "cost",
    title: t("What the context costs, and when to skip all this", "Lo que cuesta el contexto, y cuándo saltarse todo esto"),
    change: t("Writing a 100-token context for every 800-token chunk of 8k-token documents, with Claude 3 Haiku at list prices · without vs with prompt caching of the document", "Escribir un contexto de 100 tokens para cada fragmento de 800 tokens de documentos de 8k tokens, con Claude 3 Haiku a precio de lista · sin y con caché de prompts (prompt caching) del documento"),
    question: t("Roughly what does contextualising a million tokens of documents cost with prompt caching, and when don't you need retrieval at all?", "Con caché de prompts, ¿cuánto cuesta más o menos contextualizar un millón de tokens de documentos, y cuándo no necesitas recuperación en absoluto?"),
    options: [t("About $1 (around three times that without caching); skip retrieval if the whole knowledge base fits in about 200,000 tokens", "Alrededor de $1 (unas tres veces más sin caché); omite la recuperación si toda la base de conocimiento cabe en unos 200,000 tokens"), t("About $30, so only worth it for small corpora", "Alrededor de $30, así que solo vale la pena para corpus chicos"), t("Caching can't help, because every chunk is different", "La caché no sirve, porque cada fragmento es distinto")],
    answer: 0,
    why: t(`Each chunk's call sends the whole document plus the chunk. Without caching you pay for the full document again for every chunk; with caching the document is written to the cache once and read cheaply for the rest. The post estimates $1.02 per million document tokens with caching, a one-time cost at indexing. If the whole knowledge base is under about 200,000 tokens (about 500 pages), the post's advice is to skip retrieval and put all of it in the prompt, with prompt caching to keep that cheap. This lesson's corpus stands for well over 200,000 tokens; one company's filings would fit.`, `La llamada de cada fragmento envía el documento completo más el fragmento. Sin caché pagas el documento completo otra vez por cada fragmento; con caché el documento se escribe en la caché una vez y se lee barato para el resto. El artículo estima $1.02 por millón de tokens de documento con caché, un costo único al indexar. Si toda la base de conocimiento tiene menos de unos 200,000 tokens (unas 500 páginas), el consejo del artículo es omitir la recuperación y ponerla toda en el prompt, con caché de prompts para que siga siendo barato. El corpus de esta lección representa mucho más de 200,000 tokens; los informes de una sola empresa cabrían.`),
    watch: { ctx: "ctx", search: "both", rerank: "on", k: "20", cache: "off" },
  },
];

const QUESTIONS = [
  [t("Why does chunking lose information, and what exactly does Contextual Retrieval add?", "¿Por qué fragmentar hace perder información, y qué agrega exactamente Contextual Retrieval?"),
    t("A chunk is cut out of its document, so whatever the document said once, up front (which company, which quarter, which product), is missing from most chunks. Contextual Retrieval asks an LLM, given the whole document and one chunk, for a short chunk-specific context (usually 50 to 100 tokens), and prepends it to the chunk before the chunk is embedded and before it is added to the BM25 index. The chunk shown to the model at answer time can be the same text.", "Un fragmento se recorta de su documento, así que lo que el documento dijo una sola vez, al principio (qué empresa, qué trimestre, qué producto), falta en la mayoría de los fragmentos. Contextual Retrieval le pide a un LLM, con el documento completo y un fragmento, un contexto corto específico de ese fragmento (normalmente de 50 a 100 tokens), y lo antepone al fragmento antes de calcular su embedding y antes de agregarlo al índice BM25. El fragmento que se le muestra al modelo al responder puede ser el mismo texto.")],
  [t("Why do embeddings alone struggle with \"Acme's revenue in Q2 2023\", and why does BM25 help?", "¿Por qué a los embeddings solos les cuesta \"los ingresos de Acme en el Q2 2023\", y por qué ayuda BM25?"),
    t("Embeddings capture meaning, which is great for paraphrases, but they blur exact identifiers: one company name, quarter or error code looks much like another. BM25 scores exact words, weighting rare ones heavily, so it pins down \"Acme\" or \"TS-999\". Once the context has put those names into every chunk, the keyword index can use them. Combining both, with rank fusion, gets meaning and exact matches.", "Los embeddings capturan el significado, lo que es excelente para las paráfrasis, pero desdibujan los identificadores exactos: un nombre de empresa, un trimestre o un código de error se parece mucho a otro. BM25 puntúa palabras exactas y les da mucho peso a las raras, así que fija \"Acme\" o \"TS-999\". Una vez que el contexto puso esos nombres en cada fragmento, el índice de palabras clave puede usarlos. Combinar los dos, con fusión de rankings, da significado y coincidencias exactas.")],
  [t("What is reranking, and why retrieve 150 to keep 20?", "¿Qué es el reranking, y por qué recuperar 150 para quedarse con 20?"),
    t("The first stage scores the query against every chunk separately (precomputed vectors, an inverted index), which is fast but rough. A reranker reads the query and each candidate together, which is more accurate but far too slow to run on everything. So you retrieve generously (150) for recall, rerank, and keep the best 20 for the prompt. It can only reorder candidates: whatever the first stage missed stays missed.", "La primera etapa puntúa la consulta contra cada fragmento por separado (vectores precalculados, un índice invertido), lo que es rápido pero aproximado. Un reranker lee la consulta y cada candidato juntos, lo que es más preciso pero demasiado lento para correrlo sobre todo. Así que recuperas con generosidad (150) para el recall, haces reranking y te quedas con los 20 mejores para el prompt. Solo puede reordenar candidatos: lo que la primera etapa no encontró sigue sin encontrarse.")],
  [t("How does prompt caching make contextualisation cheap?", "¿Cómo hace la caché de prompts que contextualizar sea barato?"),
    t("Every chunk of a document needs a call that includes the whole document. Cache the document after the first chunk's call, and the other calls read it from the cache at a fraction of the input price. The post estimates about $1.02 per million document tokens, paid once when you index.", "Cada fragmento de un documento necesita una llamada que incluye el documento completo. Guarda el documento en caché después de la llamada del primer fragmento, y las demás llamadas lo leen de la caché a una fracción del precio de entrada. El artículo estima unos $1.02 por millón de tokens de documento, que se pagan una sola vez al indexar.")],
  [t("When would you not build any of this?", "¿Cuándo no construirías nada de esto?"),
    t("When the knowledge base is small: under about 200,000 tokens (roughly 500 pages) you can put all of it in the prompt and use prompt caching, with no chunking, no index and no retrieval failures. Retrieval earns its complexity when the corpus is too big for the context window or too costly to resend.", "Cuando la base de conocimiento es chica: con menos de unos 200,000 tokens (más o menos 500 páginas) puedes ponerla toda en el prompt y usar caché de prompts, sin fragmentar, sin índice y sin fallas de recuperación. La recuperación justifica su complejidad cuando el corpus es demasiado grande para la ventana de contexto o demasiado caro para reenviarlo.")],
  [t("How would you measure whether Contextual Retrieval helps on your own data?", "¿Cómo medirías si Contextual Retrieval ayuda con tus propios datos?"),
    t("Build a set of real questions with the chunk (or chunks) that answer each. Measure the failure rate at your top-K: the share of questions whose answer isn't among the chunks you pass on. Change one thing at a time (context, BM25, reranking, K, the embedding model, the context prompt) and compare on the same set. Look at the misses: they tell you whether the problem is ambiguity, wording or ranking.", "Arma un conjunto de preguntas reales con el fragmento (o los fragmentos) que responde cada una. Mide la tasa de fallas en tu top-K: la proporción de preguntas cuya respuesta no está entre los fragmentos que pasas. Cambia una cosa a la vez (contexto, BM25, reranking, K, el modelo de embeddings, el prompt de contexto) y compara sobre el mismo conjunto. Mira las fallas: te dicen si el problema es la ambigüedad, la redacción o el ranking.")],
];

export default defineLesson({
  title: t("Contextual Retrieval Workbench", "Banco de trabajo: recuperación contextual"),
  eyebrow: t("Systems lesson 39 · Contextual retrieval", "Lección de sistemas 39 · Recuperación contextual"),
  lede: t(`Cut a document into chunks and most chunks forget whose document they came from: "the company's revenue grew by 3%" could be any company, any quarter. Contextual Retrieval has an LLM read the whole document and write a short context for each chunk, prepended before the chunk is embedded and indexed for keywords. This lesson runs it as a print shop: watch a machine do it, predict what each step buys, then explain it back.`,
    `Corta un documento en fragmentos y la mayoría de los fragmentos olvida de qué documento vino: "the company's revenue grew by 3%" podría ser cualquier empresa, cualquier trimestre. Contextual Retrieval (recuperación contextual) hace que un LLM lea el documento completo y escriba un contexto corto para cada fragmento, que se antepone antes de calcular el embedding del fragmento y de indexarlo por palabras clave. Esta lección lo pone a funcionar como una imprenta: mira cómo lo hace una máquina, predice qué aporta cada paso y después explícalo.`),
  machine: {
    intro: t(`Reports are cut into chunk cards; a press that reads the whole report stamps each card with its context; the cards are filed by meaning and by keyword. Each question pulls candidates into the rack, an inspector reranks them, and the tray is what the model gets. Switch the context, the keyword index, the reranker and the number passed on, and watch the misses. The technique and the published numbers are from Anthropic's ${POST} (September 2024).`,
      `Los informes se cortan en tarjetas de fragmentos; una prensa que lee el informe completo estampa en cada tarjeta su contexto; las tarjetas se archivan por significado y por palabras clave. Cada pregunta trae candidatos al estante, un inspector les hace reranking, y la bandeja es lo que recibe el modelo. Cambia el contexto, el índice de palabras clave, el reranker y la cantidad que se pasa, y mira las fallas. La técnica y las cifras publicadas son del artículo de Anthropic ${POST} (septiembre de 2024). Los documentos y las preguntas de ejemplo están en inglés para que las cifras coincidan con el modelo.`),
    plate: {
      title: t("Print shop", "Imprenta"),
      keys: [
        { mark: "lit", label: t("The answer chunk; a cabinet being searched; the miss lamp", "El fragmento con la respuesta; un gabinete en búsqueda; la lámpara de falla") },
        { mark: "raised", label: t("Chunk cards: the dark strip at one end is the stamped context", "Tarjetas de fragmentos: la franja oscura en un extremo es el contexto estampado") },
        { mark: "flat", label: t("The belt from the guillotine past the context press to the cabinets", "La cinta que va de la guillotina, pasando por la prensa de contexto, a los gabinetes") },
      ],
      caption: t(
        "Reports are cut into chunk cards at the guillotine; the cover, which says whose report it is, stays behind. The context press reads the whole report open on its head and stamps a header strip on each card; switch context off and the cards go through blank. The cards are filed in WORDS (the BM25 index) and MEANING (the embedding map). For each question, search returns candidates into the rack, best on the left (the first 150 when reranking, otherwise only as many as are passed on); the inspector reranks them into the tray that goes to the model. The lit card is the chunk that answers the question: its bin shows how high search ranked it, its place in the tray where it ended up. If it isn't in the tray, the miss lamp lights.",
        "Los informes se cortan en tarjetas de fragmentos en la guillotina; la portada, que dice de quién es el informe, queda atrás. La prensa de contexto lee el informe completo abierto sobre su cabezal y estampa una franja de encabezado en cada tarjeta; si apagas el contexto, las tarjetas pasan en blanco. Las tarjetas se archivan en PALABRAS (el índice BM25) y SIGNIFICADO (el mapa de embeddings). Para cada pregunta, la búsqueda devuelve candidatos al estante, el mejor a la izquierda (los 150 primeros con reranking; si no, solo tantos como se pasan); el inspector les hace reranking hacia la bandeja que va al modelo. La tarjeta encendida es el fragmento que responde la pregunta: su casillero muestra qué tan arriba la puso la búsqueda, y su lugar en la bandeja, dónde terminó. Si no está en la bandeja, se enciende la lámpara de falla.",
      ),
      stage: { "data-shop": "" },
      label: t("Contextual retrieval simulation. Space pauses or resumes.", "Simulación de recuperación contextual. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["asked", t("Asked", "Preguntas")], ["missed", t("Missed", "Falladas")], ["rate", t("Failure rate", "Tasa de fallas")], ["rank", t("Answer's rank", "Puesto de la respuesta")], ["passed", t("Passed on", "Se pasan")], ["cost", t("Context cost", "Costo del contexto")]],
    controls: [
      { seg: "ctx", label: t("Chunks", "Fragmentos"), options: [["plain", t("Plain", "Sin contexto")], ["ctx", t("With context", "Con contexto")]], value: "ctx" },
      { seg: "search", label: t("Search", "Búsqueda"), options: [["emb", t("Meaning only", "Solo significado")], ["both", t("Meaning + BM25", "Significado + BM25")]], value: "both" },
      { seg: "rerank", label: t("Rerank", "Reranking"), options: [["off", t("Off", "No")], ["on", t("Top 150 → K", "Primeros 150 → K")]], value: "on" },
      { seg: "k", label: t("Pass on (K)", "Pasar (K)"), options: [["5", "5"], ["10", "10"], ["20", "20"]], value: "20" },
      { seg: "cache", label: t("Prompt caching", "Caché de prompts"), options: [["on", t("On", "Sí")], ["off", t("Off", "No")]], value: "on" },
      { speed: true },
      { actions: [["next", t("Next question", "Siguiente pregunta")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t(`The corpus is synthetic: 128 quarterly filings from 16 companies over two years and 8 product manuals, cut into ${int(corpus.chunks.length)} chunks. Only a filing's cover names its company and quarter; standard figures read alike across filings, events are rarer. One question per filing and four per manual (${corpus.questions.length} in all), some paraphrased, some using a ticker or "the second quarter". Compare the direction and size of each step, not the exact rates.`, `El corpus es sintético: 128 informes trimestrales de 16 empresas a lo largo de dos años y 8 manuales de producto, cortados en ${int(corpus.chunks.length)} fragmentos. Solo la portada de un informe nombra su empresa y su trimestre; las cifras estándar se leen igual en todos los informes, y los eventos son más raros. Una pregunta por informe y cuatro por manual (${corpus.questions.length} en total), algunas parafraseadas, otras con un ticker o "the second quarter". Compara la dirección y el tamaño de cada paso, no las tasas exactas.`),
  },
  predict: { intro: t(`Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from this lesson's model (real BM25, a toy embedding, a simple reranker) over six seeded corpora; the post's measured numbers on real data are in each explanation.`, `Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del modelo de esta lección (BM25 real, un embedding de juguete, un reranker simple) sobre seis corpus con semilla fija; las cifras que midió el artículo con datos reales están en cada explicación.`), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Technique and published results: ${POST}, Anthropic, 2024. Simulation written for this lesson.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Técnica y resultados publicados: ${POST}, Anthropic, 2024. Simulación escrita para esta lección.`),
  css: `
.iso-stage [data-layer] text{pointer-events:none}
.iso-stage [data-strip] .iso-solid>.iso-fill,.iso-stage [data-strip] .iso-solid>.iso-top,.iso-stage [data-strip] .iso-solid>.iso-shade{fill:color-mix(in srgb,var(--anatomy-strong) 52%,var(--anatomy-page))}
`,
  data: {
    P,
    G: GEOMETRY,
    CARD_SVG: cardSvg(),
    RANKS,
    QS: QS.map(({ i, label, text }) => ({ i, label, text })),
    DOCS,
    COST,
    POOL,
    CHUNKS: corpus.chunks.length,
  },
});

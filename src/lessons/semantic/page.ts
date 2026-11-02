// @ts-nocheck: content ported as-is
// Systems lesson 36 · Semantic search: a help centre laid out as a star map.
import { t } from "../../i18n";
import { defineLesson } from "../types";
import { int } from "../../lib/format";
import { buildFigure, studSvg, lampSvg, armSvg, beadSvg, labelSvg, P, GEOMETRY } from "./figure";
import { paraphraseRun, codeRun, chunkRun, annRun, thresholdRun, QUERIES } from "./sim";

// Experiment results, computed at build time from the same model the page runs.
const R = { para: paraphraseRun(), code: codeRun(), chunk: chunkRun(), ann: annRun(), thr: thresholdRun() };

const EXPERIMENTS = [
  {
    id: "para",
    title: t("Same meaning, no shared words", "El mismo significado, sin palabras en común"),
    change: t(`Query "my card was charged twice" · the help centre says "Seeing the same transaction two times on your statement is usually a pending authorisation."`, `Consulta "my card was charged twice" · el centro de ayuda dice "Seeing the same transaction two times on your statement is usually a pending authorisation."`),
    question: t("The two sentences share no words. Where does that chunk rank?", "Las dos oraciones no comparten ninguna palabra. ¿En qué puesto queda ese fragmento?"),
    options: [t("Nowhere near the top: there's nothing to match on", "Muy lejos del principio: no hay nada con qué coincidir"), t("First: the meaning is the same", "Primero: el significado es el mismo"), t("Somewhere in the top 10, behind sentences that mention cards", "En algún lugar entre los 10 primeros, detrás de oraciones que mencionan tarjetas")],
    answer: 1,
    why: t(`"Charged" and "transaction" both land near payments, "twice" and "two times" both near duplicates, so the two vectors point the same way although no word repeats. That is what embeddings buy you over keyword search: paraphrases, synonyms and other people's vocabulary still match. The next results are other payment sentences, close in meaning but not about duplicates.`, `"Charged" y "transaction" caen cerca de los pagos, "twice" y "two times" cerca de los duplicados, así que los dos vectores apuntan en la misma dirección aunque no se repita ninguna palabra. Eso es lo que ganas con los embeddings frente a la búsqueda por palabras clave: las paráfrasis, los sinónimos y el vocabulario de otras personas siguen coincidiendo. Los resultados siguientes son otras oraciones sobre pagos, cercanas en significado pero que no hablan de duplicados.`),
    watch: { q: "twice", k: "3", size: "sentence", search: "exact", cut: "0" },
  },
  {
    id: "code",
    title: t("An exact error code", "Un código de error exacto"),
    change: t(`Query "ERR-4012" · one sentence in the help centre explains exactly that code`, `Consulta "ERR-4012" · una oración del centro de ayuda explica exactamente ese código`),
    question: t("Is the sentence about ERR-4012 the top result?", "¿La oración sobre ERR-4012 es el primer resultado?"),
    options: [t("No: generic sentences about errors rank above it", "No: quedan por encima oraciones genéricas sobre errores"), t("Yes: it's the only chunk with that code", "Sí: es el único fragmento con ese código"), t("It isn't found at all", "No aparece en absoluto")],
    answer: 0,
    why: t(`The model has no meaning for "4012": it is a rare token that only nudges the vector a little, while "ERR" points strongly at errors in general. So the query lands on "we show an error message with a short code" and other error text, and the one sentence that names the code also talks about webhooks and secrets, which pulls its vector away. Exact identifiers, SKUs, names and numbers are where keyword search (BM25) wins, and the reason hybrid search exists.`, `El modelo no tiene un significado para "4012": es un token raro que apenas mueve el vector, mientras que "ERR" apunta con fuerza a los errores en general. Así que la consulta cae sobre "we show an error message with a short code" y otros textos de error, y la única oración que nombra el código también habla de webhooks y secretos, lo que aleja su vector. Los identificadores exactos, los SKU, los nombres y los números son donde gana la búsqueda por palabras clave (BM25), y la razón de que exista la búsqueda híbrida.`),
    watch: { q: "err", k: "5", size: "sentence", search: "exact", cut: "0" },
  },
  {
    id: "chunk",
    title: t("How big is a chunk?", "¿Qué tan grande es un fragmento?"),
    change: t("14 help-centre questions · top 3 chunks each · chunks of one sentence vs one section (heading and its sentences) vs a whole document", "14 preguntas del centro de ayuda · los 3 mejores fragmentos de cada una · fragmentos de una oración, de una sección (un encabezado y sus oraciones) o de un documento completo"),
    question: t("Which size hands the model a usable answer most cheaply?", "¿Qué tamaño le da al modelo una respuesta útil al menor costo?"),
    options: [t("Single sentences: the smallest chunk is the most precise", "Oraciones sueltas: el fragmento más chico es el más preciso"), t("Whole documents: they never miss", "Documentos completos: nunca fallan"), t("Sections: nearly every answer, at a third of the words of whole documents", "Secciones: casi todas las respuestas, con un tercio de las palabras de los documentos completos")],
    answer: 2,
    why: t(`A sentence alone can lose what it is about: "It usually takes 5 to 7 business days" is retrieved for the refund question, but without the sentence before it the model can't know what takes 5 to 7 days. Whole documents found every answer here only because each search handed over almost a third of this tiny help centre; real documents run to thousands of words, mix topics into one averaged vector, and don't fit many to a prompt. A section-sized chunk keeps its own context and stays specific.`, `Una oración sola puede perder de qué habla: "It usually takes 5 to 7 business days" aparece para la pregunta del reembolso, pero sin la oración anterior el modelo no puede saber qué tarda de 5 a 7 días. Los documentos completos encontraron todas las respuestas aquí solo porque cada búsqueda entregaba casi un tercio de este centro de ayuda diminuto; los documentos reales tienen miles de palabras, mezclan temas en un solo vector promediado y no caben muchos en un prompt. Un fragmento del tamaño de una sección conserva su propio contexto y sigue siendo específico.`),
    watch: { q: "refund", k: "3", size: "section", search: "exact", cut: "0" },
  },
  {
    id: "ann",
    title: t("Search the graph instead of everything", "Buscar en el grafo en lugar de en todo"),
    change: t(`${int(R.ann.N)} chunks · 200 queries · top 10 · compare against every chunk vs a graph index searched with a beam of 10, 40 or 160`, `${int(R.ann.N)} fragmentos · 200 consultas · 10 primeros · comparar con cada fragmento o con un índice de grafo recorrido con un haz (beam) de 10, 40 o 160`),
    question: t("With a beam of 10, how many of the true 10 nearest does the graph find?", "Con un haz de 10, ¿cuántos de los 10 vecinos más cercanos reales encuentra el grafo?"),
    options: [t("All 10: it's the same nearest-neighbour search, just faster", "Los 10: es la misma búsqueda de vecinos más cercanos, solo que más rápida"), t("Fewer: it compares a few dozen chunks and stops in the right neighbourhood but not always at the nearest", "Menos: compara unas pocas decenas de fragmentos y se detiene en el vecindario correcto, pero no siempre en los más cercanos"), t("None: graphs only work on exact matches", "Ninguno: los grafos solo sirven para coincidencias exactas")],
    answer: 1,
    why: t(`Comparing against every vector is exact but costs one comparison per chunk per query. A graph index (HNSW is the usual one) links each chunk to its near neighbours and hops toward the query, so it looks at a small fraction of the collection. It can stop in a good-but-not-best spot, so recall depends on how wide the search is: the beam (ef) trades comparisons for recall. Production systems tune it until recall is high enough, and measure it against an exact search.`, `Comparar con cada vector es exacto, pero cuesta una comparación por fragmento y por consulta. Un índice de grafo (el habitual es HNSW) une cada fragmento con sus vecinos cercanos y salta hacia la consulta, así que mira una fracción pequeña de la colección. Puede detenerse en un lugar bueno pero no el mejor, así que el recall depende de qué tan amplia sea la búsqueda: el haz (ef) cambia comparaciones por recall. Los sistemas en producción lo ajustan hasta que el recall es suficientemente alto, y lo miden contra una búsqueda exacta.`),
    watch: { q: "phone", k: "3", size: "section", search: "narrow", cut: "0" },
  },
  {
    id: "thr",
    title: t("Keep only results above 0.80", "Quedarse solo con los resultados por encima de 0.80"),
    change: t("A fixed cutoff · five queries: one word, a vague one, one the help centre can't answer, two specific questions", "Un umbral fijo · cinco consultas: una palabra, una vaga, una que el centro de ayuda no puede responder, dos preguntas específicas"),
    question: t("What does one fixed cutoff do across these queries?", "¿Qué hace un único umbral fijo con estas consultas?"),
    options: [t("It misbehaves both ways: a relevant query keeps nothing, an unanswerable one keeps confident-looking junk", "Falla para los dos lados: una consulta relevante no conserva nada, y una sin respuesta conserva basura que parece confiable"), t("It keeps the good results and drops the junk for every query", "Conserva los buenos resultados y descarta la basura en todas las consultas"), t("Nothing: every similarity above 0.80 is a good match", "Nada: toda similitud por encima de 0.80 es una buena coincidencia")],
    answer: 0,
    why: t(`A cosine similarity says which chunks are closest to this query, not how good the match is in absolute terms. Short queries, vague ones and long ones land at different heights, and a query about something the help centre doesn't cover still has nearest neighbours, sometimes close ones. Use the ranking (top k), then a reranker or a relative rule (within some distance of the best), and test cutoffs on real queries instead of trusting one number.`, `Una similitud coseno dice qué fragmentos están más cerca de esta consulta, no qué tan buena es la coincidencia en términos absolutos. Las consultas cortas, las vagas y las largas quedan a distintas alturas, y una consulta sobre algo que el centro de ayuda no cubre igual tiene vecinos más cercanos, a veces bastante cercanos. Usa el ranking (top k), después un reranker o una regla relativa (a cierta distancia del mejor), y prueba los umbrales con consultas reales en lugar de confiar en un solo número.`),
    watch: { q: "pets", k: "5", size: "sentence", search: "exact", cut: "0.8" },
  },
];

const QUESTIONS = [
  [t("What does an embedding model turn a chunk into, and why does that make paraphrases match?", "¿En qué convierte un modelo de embeddings a un fragmento, y por qué eso hace que las paráfrasis coincidan?"),
    t("A list of numbers, a vector, placed so that texts with similar meaning point in similar directions. The query is embedded the same way and the closest chunks by cosine similarity win, so \"charged twice\" and \"duplicate payment\" match without sharing a word.", "En una lista de números, un vector, ubicado de modo que los textos con significado parecido apunten en direcciones parecidas. La consulta se convierte de la misma forma y ganan los fragmentos más cercanos por similitud coseno, así que \"me cobraron dos veces\" y \"pago duplicado\" coinciden sin compartir ninguna palabra.")],
  [t("Your support search can't find the article for the order number a customer pasted. Why, and what do you add?", "La búsqueda de tu soporte no encuentra el artículo del número de pedido que pegó un cliente. ¿Por qué, y qué agregas?"),
    t("Identifiers, codes, names and numbers carry little meaning for an embedding model, so the query vector lands near generic text and the exact match ranks low. Keyword search (BM25) is built for exact tokens; run both and fuse the lists (hybrid search), or route identifier-looking queries to keyword search.", "Los identificadores, códigos, nombres y números tienen poco significado para un modelo de embeddings, así que el vector de la consulta cae cerca de texto genérico y la coincidencia exacta queda abajo. La búsqueda por palabras clave (BM25) está hecha para tokens exactos; corre las dos y fusiona las listas (búsqueda híbrida), o manda las consultas que parecen identificadores a la búsqueda por palabras clave.")],
  [t("How do you pick a chunk size?", "¿Cómo eliges el tamaño de un fragmento?"),
    t("Small enough that one chunk is about one thing (a big chunk's vector averages its topics and wastes the prompt), big enough to carry its own context (a lone sentence like \"This cannot be undone\" is useless). Sections or a few hundred tokens with headings kept, sometimes with overlap, is a common start; then measure on real questions.", "Lo bastante chico para que un fragmento trate de una sola cosa (el vector de un fragmento grande promedia sus temas y desperdicia el prompt), y lo bastante grande para llevar su propio contexto (una oración suelta como \"Esto no se puede deshacer\" no sirve). Un punto de partida común son secciones o unos cientos de tokens conservando los encabezados, a veces con solapamiento (overlap); después, mide con preguntas reales.")],
  [t("What does an approximate index like HNSW trade, and how would you know it's good enough?", "¿Qué sacrifica un índice aproximado como HNSW, y cómo sabrías si es suficientemente bueno?"),
    t("It hops through a graph of near neighbours instead of comparing against every vector, so it is far faster but can miss some true nearest neighbours. The search width (ef) trades comparisons for recall. Measure recall@k against an exact search on a sample of real queries and raise ef until it is high enough.", "Salta por un grafo de vecinos cercanos en lugar de comparar con cada vector, así que es mucho más rápido, pero puede perderse algunos de los vecinos más cercanos reales. El ancho de la búsqueda (ef) cambia comparaciones por recall. Mide el recall@k contra una búsqueda exacta sobre una muestra de consultas reales y sube ef hasta que sea suficientemente alto.")],
  [t("Why is a fixed similarity threshold like 0.8 a bad filter?", "¿Por qué un umbral de similitud fijo como 0.8 es un mal filtro?"),
    t("Cosine scores aren't calibrated: their range shifts with the model, the query's length and wording, and the collection. A good match for one query can score below a bad match for another, and an unanswerable query still has close-looking neighbours. Rank, then rerank or apply a relative cutoff, and check on real queries.", "Los puntajes coseno no están calibrados: su rango cambia con el modelo, con el largo y la redacción de la consulta y con la colección. Una buena coincidencia para una consulta puede sacar menos que una mala para otra, y una consulta sin respuesta igual tiene vecinos que parecen cercanos. Ordena, después aplica un reranker o un umbral relativo, y verifica con consultas reales.")],
  [t("Why doesn't the map on the table show the real distances?", "¿Por qué el mapa de la mesa no muestra las distancias reales?"),
    t("Each chunk is a point in a space with dozens of dimensions here and hundreds or thousands in real models. Squashing it onto a flat map keeps neighbourhoods roughly but bends distances, so two studs can look close and not be. The search always uses the real vectors; the map is only a picture.", "Cada fragmento es un punto en un espacio con decenas de dimensiones aquí, y cientos o miles en los modelos reales. Aplastarlo sobre un mapa plano conserva los vecindarios a grandes rasgos pero deforma las distancias, así que dos pernos pueden parecer cercanos sin serlo. La búsqueda siempre usa los vectores reales; el mapa es solo una imagen.")],
];

export default defineLesson({
  title: t("Semantic Search Workbench", "Banco de trabajo: búsqueda semántica"),
  eyebrow: t("Systems lesson 36 · Semantic search", "Lección de sistemas 36 · Búsqueda semántica"),
  lede: t("Semantic search finds text by meaning instead of by matching words. An embedding model turns every chunk of your documents into a vector, the query into another, and the chunks pointing the same way as the query come back first. This lesson lays a help centre out as a star map: watch a query find its neighbours, predict where meaning-matching fails, then explain it back.",
    "La búsqueda semántica encuentra texto por su significado en lugar de buscar palabras que coincidan. Un modelo de embeddings convierte cada fragmento (chunk) de tus documentos en un vector, y la consulta en otro, y vuelven primero los fragmentos que apuntan en la misma dirección que la consulta. Esta lección despliega un centro de ayuda como un mapa estelar: mira cómo una consulta encuentra a sus vecinos, predice dónde falla la búsqueda por significado y después explícalo."),
  machine: {
    intro: t("Each stud is a chunk of the help centre, placed so that chunks with similar meaning sit together. Each query lamp stands among its nearest chunks; strings mark the k nearest, and the rack lists them with their cosine similarity. Try the error-code query, bigger chunks, the graph index and the 0.80 cutoff.",
      "Cada perno es un fragmento del centro de ayuda, ubicado de modo que los fragmentos con significado parecido queden juntos. La lámpara de cada consulta se para entre sus fragmentos más cercanos; los hilos marcan los k más cercanos, y el estante los lista con su similitud coseno. Prueba la consulta del código de error, fragmentos más grandes, el índice de grafo y el umbral de 0.80. El centro de ayuda y las consultas están en inglés para que las cifras coincidan con el modelo."),
    plate: {
      title: t("Star-map table", "Mesa del mapa estelar"),
      keys: [
        { mark: "lit", label: t("The k nearest chunks with their rank; the query lamp; the sweep arm or the graph probe", "Los k fragmentos más cercanos con su puesto; la lámpara de la consulta; el brazo de barrido o la sonda del grafo") },
        { mark: "raised", label: t("Chunks as studs, placed by meaning; bigger chunks are bigger studs", "Fragmentos como pernos, ubicados por significado; los fragmentos más grandes son pernos más grandes") },
        { mark: "flat", label: t("The map, with each constellation named after its topic", "El mapa, con cada constelación nombrada según su tema") },
      ],
      caption: t(
        "Every chunk of a small help centre is a stud on the map, placed by a flat picture of its vector, so chunks with similar meaning cluster into named constellations. The query's lamp stands among the chunks it is closest to, and strings run to the k nearest, which light and show their rank. In the rack the same chunks stand in rank order with their cosine similarity on the counters. Searching every chunk sweeps an arm across the map and the console counts every comparison; with the graph index a bead hops along the links from one entry stud instead, and a dashed ring marks a true neighbour it missed. The map bends distances; the ranking always uses the real vectors.",
        "Cada fragmento de un pequeño centro de ayuda es un perno en el mapa, ubicado según una imagen plana de su vector, así que los fragmentos con significado parecido se agrupan en constelaciones con nombre. La lámpara de la consulta se para entre los fragmentos más cercanos, y unos hilos van hasta los k más cercanos, que se encienden y muestran su puesto. En el estante, los mismos fragmentos están en orden de puesto con su similitud coseno en los contadores. Buscar en cada fragmento barre el mapa con un brazo y la consola cuenta cada comparación; con el índice de grafo, en cambio, una bolita salta por los enlaces desde un perno de entrada, y un anillo punteado marca un vecino real que se le escapó. El mapa deforma las distancias; el ranking siempre usa los vectores reales.",
      ),
      stage: { "data-starmap": "" },
      label: t("Semantic search simulation. Space pauses or resumes.", "Simulación de búsqueda semántica. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["query", t("Query", "Consulta")], ["top", t("Top result", "Primer resultado")], ["sim", t("Similarity", "Similitud")], ["compared", t("Compared", "Comparados")], ["kept", t("Kept", "Conservados")], ["recall", t("True nearest found", "Vecinos reales hallados")]],
    controls: [
      { seg: "q", label: t("Query", "Consulta"), options: QUERIES.map((q) => [q.id, q.text.length > 26 ? q.text.slice(0, 24) + "…" : q.text]), value: "twice" },
      { seg: "k", label: t("Results (k)", "Resultados (k)"), options: [["1", "1"], ["3", "3"], ["5", "5"]], value: "3" },
      { seg: "size", label: t("Chunk", "Fragmento"), options: [["sentence", t("Sentence", "Oración")], ["section", t("Section", "Sección")], ["doc", t("Whole document", "Documento completo")]], value: "sentence" },
      { seg: "search", label: t("Search", "Búsqueda"), options: [["exact", t("Every chunk", "Cada fragmento")], ["narrow", t("Graph, narrow", "Grafo, estrecho")], ["wide", t("Graph, wide", "Grafo, amplio")]], value: "exact" },
      { seg: "cut", label: t("Cutoff", "Umbral"), options: [["0", t("None", "Ninguno")], ["0.8", "0.80"]], value: "0" },
      { speed: true },
      { actions: [["next", t("Next query", "Siguiente consulta")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("The embedding here is a small hand-built model (16 meaning axes, hashed rare words) so every number on the page is computed, not scripted. Real models use hundreds of dimensions learned from text.", "El embedding de esta página es un modelo pequeño hecho a mano (16 ejes de significado, palabras raras con hash), así que cada número de la página se calcula, no está escrito a mano. Los modelos reales usan cientos de dimensiones aprendidas del texto."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same embedding and the same search as the machine.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo embedding y la misma búsqueda que la máquina."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Toy embedding model and help centre written for this lesson.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Modelo de embeddings de juguete y centro de ayuda escritos para esta lección.`),
  css: `
.iso-stage [data-layer] text{pointer-events:none}
[data-layer="links"] path{opacity:.7}
`,
  data: {
    P,
    G: GEOMETRY,
    STUD: { sentence: studSvg("sentence"), section: studSvg("section"), doc: studSvg("doc") },
    LAMP_SVG: lampSvg(), ARM_SVG: armSvg(), BEAD_SVG: beadSvg(), LABEL_SVG: labelSvg(),
    RESULTS: R,
    EXPERIMENTS: EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })),
  },
});

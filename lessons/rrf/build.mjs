// Systems lesson 37 · Reciprocal rank fusion. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule, t, tx } from "../../workbench/page.mjs";
import { buildFigure, clerkSvg, flightSvg, P, GEOMETRY } from "./figure.mjs";
import { QUERY, expScales, expAgreement, expK, expNoisy, expDepth } from "./sim.js";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- results (computed once here from the same model the page runs) ----------
const R = { scales: expScales(), agree: expAgreement(), k: expK(), noisy: expNoisy(), depth: expDepth() };

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "scales",
    title: t("Add the raw scores, or fuse the ranks", "Sumar los puntajes crudos, o fusionar los puestos"),
    change: t("Keyword scores run from about 4 to 30, meaning scores (cosine similarity) from 0.2 to 0.9 · top 20 from each · raw sum vs RRF with k = 60 · 40 queries, 10 relevant documents each", "Los puntajes por palabras clave van más o menos de 4 a 30, y los de significado (similitud coseno), de 0.2 a 0.9 · top 20 de cada uno · suma cruda frente a RRF con k = 60 · 40 consultas, 10 documentos relevantes cada una"),
    question: t("How many relevant documents does each put in the top 10?", "¿Cuántos documentos relevantes pone cada uno en el top 10?"),
    options: [t("About the same: the raw sum even keeps more information than the ranks do", "Más o menos los mismos: la suma cruda hasta conserva más información que los puestos"), t("The raw sum is barely better than keyword search alone; RRF beats both rankers", "La suma cruda apenas mejora a la búsqueda por palabras clave sola; RRF les gana a los dos rankers"), t("The raw sum wins: a big score means a confident judge", "Gana la suma cruda: un puntaje alto indica un juez seguro")],
    answer: 1,
    why: t("A keyword score of 20 and a cosine of 0.8 are on different scales, so adding them is just keyword search with a little noise: the meaning ranker can move a document by less than one keyword point. RRF throws the scores away and keeps only each ranker's order, so both rankers count equally and documents that either one finds well can reach the top. Normalising the scores first (min-max, z-scores) helps, but it depends on what else came back for that query; ranks need no calibration.", "Un puntaje de palabras clave de 20 y un coseno de 0.8 están en escalas distintas, así que sumarlos es solo búsqueda por palabras clave con un poco de ruido: el ranker de significado puede mover un documento menos de un punto de palabras clave. RRF descarta los puntajes y se queda solo con el orden de cada ranker, así que los dos rankers cuentan igual y los documentos que cualquiera de los dos encuentra bien pueden llegar arriba. Normalizar primero los puntajes (min-max, z-scores) ayuda, pero depende de qué más volvió para esa consulta; los puestos no necesitan calibración."),
    watch: { mode: "raw", k: 60, judges: 2, weight: 1, depth: 8 },
  },
  {
    id: "agree",
    title: t("Two good ranks or one first place", "Dos buenos puestos o un primer lugar"),
    change: t(`The figure's query, top 8 from each ballot, k = 60 · D1 is 3rd for keyword and 4th for meaning · D2 is 1st for keyword and not on the meaning ballot at all`, `La consulta de la figura, top 8 de cada boleta, k = 60 · D1 está en el puesto 3 en palabras clave y en el 4 en significado · D2 está en el puesto 1 en palabras clave y ni siquiera aparece en la boleta de significado`),
    question: t("Which document finishes higher?", "¿Qué documento termina más arriba?"),
    options: [t("D2: a first place beats anything", "D2: un primer lugar le gana a cualquier cosa"), t("D1, with almost twice D2's score", "D1, con casi el doble del puntaje de D2"), t("They tie: each had one strong vote", "Empatan: cada uno tuvo un voto fuerte")],
    answer: 1,
    why: t("With k = 60 a first place is worth 1/61 and a 3rd or 4th place nearly as much (1/63, 1/64), so a document both rankers like collects two nearly full votes, while a document only one ranker likes collects one. That is the point of fusion: agreement between rankers that look at a document differently is strong evidence. D2 (\"Reset your login password\") is a typical keyword false positive: it shares the words but not the question.", "Con k = 60 un primer lugar vale 1/61, y un puesto 3 o 4 casi lo mismo (1/63, 1/64), así que un documento que les gusta a los dos rankers junta dos votos casi completos, mientras que uno que le gusta a un solo ranker junta uno. Ese es el sentido de la fusión: que coincidan rankers que miran un documento de formas distintas es evidencia fuerte. D2 (\"Reset your login password\") es un falso positivo típico de las palabras clave: comparte las palabras, pero no la pregunta."),
    watch: { mode: "rrf", k: 60, judges: 2, weight: 1, depth: 8 },
  },
  {
    id: "k",
    title: t("Turning k", "Girar k"),
    change: t("The same two ballots · k = 1, 60, 1000 · and the average over 40 queries", "Las mismas dos boletas · k = 1, 60, 1000 · y el promedio sobre 40 consultas"),
    question: t("What happens to the top five at k = 1?", "¿Qué pasa con los cinco primeros con k = 1?"),
    options: [t("Nothing: k only rescales every score", "Nada: k solo reescala todos los puntajes"), t("The single first places jump to the top: D2 and D5 lead, and a relevant document drops out of the five", "Los primeros lugares sueltos saltan arriba: D2 y D5 encabezan, y un documento relevante sale de los cinco"), t("Ranks stop mattering, so the order turns random", "Los puestos dejan de importar, así que el orden se vuelve aleatorio")],
    answer: 1,
    why: t("k sets how much the top of each list dominates. A first place is worth (k + 10) / (k + 1) times a 10th place: 5.5× at k = 1, 1.15× at k = 60, 1.01× at k = 1000. Small k rewards whatever any one ranker put first; large k mostly counts how many lists a document is on. 60, from the original paper, sits between and holds up well across collections, which is why it is the default nearly everywhere.", "k fija cuánto domina la parte de arriba de cada lista. Un primer lugar vale (k + 10) / (k + 1) veces un décimo puesto: 5.5× con k = 1, 1.15× con k = 60, 1.01× con k = 1000. Un k chico premia lo que sea que un ranker haya puesto primero; un k grande cuenta sobre todo en cuántas listas está un documento. 60, del artículo original, queda en el medio y funciona bien en distintas colecciones, por eso es el valor por defecto casi en todas partes."),
    watch: { mode: "rrf", k: 1, judges: 2, weight: 1, depth: 8 },
  },
  {
    id: "noisy",
    title: t("A third judge who knows nothing about the query", "Un tercer juez que no sabe nada de la consulta"),
    change: t("Add a clicks ranker (overall popularity, unrelated to this query) · equal weight, then weight 0.3 · 40 queries, top 20 from each", "Agrega un ranker de clics (popularidad general, sin relación con esta consulta) · mismo peso, después peso 0.3 · 40 consultas, top 20 de cada uno"),
    question: t("With the clicks judge at full weight, what happens?", "Con el juez de clics a peso completo, ¿qué pasa?"),
    options: [t("Results improve: more judges, more evidence", "Los resultados mejoran: más jueces, más evidencia"), t("Popular but irrelevant documents climb into the top results; at weight 0.3 most of the damage is gone", "Documentos populares pero irrelevantes suben a los primeros resultados; con peso 0.3 desaparece la mayor parte del daño"), t("Nothing: RRF ignores a judge that disagrees with the others", "Nada: RRF ignora a un juez que no está de acuerdo con los demás")],
    answer: 1,
    why: t("RRF gives every list the same say, so a list that ranks by something else entirely adds votes for the wrong documents, and a popular document that one other ranker also likes (like D2 here) jumps to first place. Weighted RRF (w / (k + rank)) lets you keep a signal you want as a tie-breaker without letting it outvote the rankers that understand the query. Tune the weights on queries whose right answers you know.", "RRF les da a todas las listas la misma voz, así que una lista que ordena por algo totalmente distinto suma votos para los documentos equivocados, y un documento popular que además le gusta a otro ranker (como D2 aquí) salta al primer lugar. RRF ponderado (w / (k + puesto)) te deja conservar una señal que quieres como desempate sin que les gane en votos a los rankers que entienden la consulta. Ajusta los pesos con consultas cuyas respuestas correctas conoces."),
    watch: { mode: "rrf", k: 60, judges: 3, weight: 1, depth: 8 },
  },
  {
    id: "depth",
    title: t("How deep each list goes", "Qué tan profunda es cada lista"),
    change: t("Each ranker returns its top 10 vs its top 100 before fusing · k = 60 · 40 queries, 10 relevant documents each", "Cada ranker devuelve su top 10 o su top 100 antes de fusionar · k = 60 · 40 consultas, 10 documentos relevantes cada una"),
    question: t("How many relevant documents reach the fused top 10?", "¿Cuántos documentos relevantes llegan al top 10 fusionado?"),
    options: [t("The same: anything below 10th place adds too little to matter", "Los mismos: lo que queda por debajo del décimo puesto suma demasiado poco para importar"), t("More with 100: documents both rankers place in their teens outscore a single first place", "Más con 100: los documentos que los dos rankers ponen cerca del puesto 15 superan a un primer lugar solitario"), t("Fewer with 100: the extra documents only add noise", "Menos con 100: los documentos extra solo agregan ruido")],
    answer: 1,
    why: t("Below the cut a document gets nothing, however well it was ranked by the other list. With deeper lists, a document both rankers put around 15th collects two votes of about 1/75, more than any single first place (1/61). One deep vote on its own is still small (a 40th place is worth 1/100), so deeper lists rescue agreement, not stragglers. The cost is fetching and scoring more candidates from each index; 50 to 100 per list is common before fusing, and a reranker then sorts the top 20 or so.", "Por debajo del corte un documento no recibe nada, por bien que lo haya puesto la otra lista. Con listas más profundas, un documento que los dos rankers ponen cerca del puesto 15 junta dos votos de alrededor de 1/75, más que cualquier primer lugar solitario (1/61). Un voto profundo por sí solo sigue siendo poco (un puesto 40 vale 1/100), así que las listas profundas rescatan la coincidencia, no a los rezagados. El costo es traer y puntuar más candidatos de cada índice; es común tomar de 50 a 100 por lista antes de fusionar, y después un reranker ordena los primeros 20 o algo así."),
    watch: { mode: "rrf", k: 60, judges: 2, weight: 1, depth: 3 },
  },
];

const QUESTIONS = [
  [t("Why can't you add a BM25 score and a cosine similarity and sort by the sum?", "¿Por qué no puedes sumar un puntaje BM25 y una similitud coseno y ordenar por la suma?"),
    t("They're on different scales with different shapes: BM25 is unbounded and depends on the query's length and the collection's word statistics, while cosine similarities from an embedding model crowd into a narrow band. The sum is decided by whichever has the bigger spread, so it is mostly one ranker. Normalising (min-max, z-scores) depends on what else came back for that query and is thrown off by outliers. RRF uses only the order, so there is nothing to calibrate.", "Están en escalas distintas y con formas distintas: BM25 no tiene tope y depende del largo de la consulta y de las estadísticas de palabras de la colección, mientras que las similitudes coseno de un modelo de embeddings se amontonan en una franja estrecha. La suma la decide el que tenga mayor dispersión, así que es casi un solo ranker. Normalizar (min-max, z-scores) depende de qué más volvió para esa consulta y se desajusta con los valores atípicos. RRF usa solo el orden, así que no hay nada que calibrar.")],
  [t("Write the RRF formula and score a document ranked 2nd by one list and 5th by another, with k = 60.", "Escribe la fórmula de RRF y calcula el puntaje de un documento que una lista pone en el puesto 2 y otra en el 5, con k = 60."),
    t("score(d) = Σ over lists of 1 / (k + rank of d in that list); a list that doesn't contain d adds nothing. Here 1/62 + 1/65 ≈ 0.01613 + 0.01538 = 0.03151, almost twice a single first place (1/61 ≈ 0.01639).", "puntaje(d) = Σ sobre las listas de 1 / (k + puesto de d en esa lista); una lista que no contiene d no suma nada. Aquí 1/62 + 1/65 ≈ 0.01613 + 0.01538 = 0.03151, casi el doble de un primer lugar solitario (1/61 ≈ 0.01639).")],
  [t("What does k do, and why is 60 the usual value?", "¿Qué hace k, y por qué 60 es el valor habitual?"),
    t("It controls how top-heavy the fusion is: a first place is worth (k + 10)/(k + 1) times a 10th. Small k lets one ranker's first place win; large k mostly counts how many lists include a document. Cormack, Clarke and Büttcher found 60 worked well across their collections, and it is robust enough that most systems never tune it.", "Controla cuánto pesa la parte de arriba en la fusión: un primer lugar vale (k + 10)/(k + 1) veces un décimo. Un k chico deja que gane el primer lugar de un solo ranker; un k grande cuenta sobre todo en cuántas listas aparece un documento. Cormack, Clarke y Büttcher encontraron que 60 funcionaba bien en sus colecciones, y es lo bastante robusto como para que la mayoría de los sistemas nunca lo ajusten.")],
  [t("When would you weight one ranker less, and how?", "¿Cuándo le darías menos peso a un ranker, y cómo?"),
    t("When it is weaker, noisier or measures something other than relevance to the query: popularity, recency, a small fine-tuned model you don't trust yet, or keyword search on queries that are mostly natural language. Weighted RRF uses w / (k + rank). Pick the weights on a set of queries whose right answers you know, not by feel.", "Cuando es más débil, más ruidoso o mide algo distinto de la relevancia para la consulta: popularidad, recencia, un modelo chico ajustado (fine-tuned) en el que todavía no confías, o búsqueda por palabras clave para consultas que son mayormente lenguaje natural. RRF ponderado usa w / (k + puesto). Elige los pesos con un conjunto de consultas cuyas respuestas correctas conoces, no a ojo.")],
  [t("What does RRF throw away, and when might a score-based fusion be better?", "¿Qué descarta RRF, y cuándo podría ser mejor una fusión basada en puntajes?"),
    t("The size of the gaps: a document that wins by a mile and one that wins by a hair look the same. If your scores are calibrated (comparable probabilities) or you have labelled queries to tune a normalised weighted sum, a score-based combination can edge out RRF. RRF is the strong default because it needs no calibration and no training data.", "El tamaño de las diferencias: un documento que gana por mucho y uno que gana por poco se ven igual. Si tus puntajes están calibrados (probabilidades comparables) o tienes consultas etiquetadas para ajustar una suma ponderada normalizada, una combinación basada en puntajes puede superar por poco a RRF. RRF es la opción por defecto sólida porque no necesita calibración ni datos de entrenamiento.")],
  [t("How deep should each list be before fusing, and what does depth cost?", "¿Qué tan profunda debe ser cada lista antes de fusionar, y cuánto cuesta la profundidad?"),
    t("Deep enough that documents both rankers like but neither ranks near the top can still meet: with k = 60, two votes in the teens outscore one first place. Common practice is the top 50 to 100 from each index, fused, then a reranker or a cutoff of 20 or so. Deeper lists cost latency and compute on every query, and past a point add only single deep votes that never reach the top.", "Lo bastante para que los documentos que les gustan a los dos rankers, pero que ninguno pone cerca de arriba, todavía puedan encontrarse: con k = 60, dos votos cerca del puesto 15 superan a un primer lugar. Lo habitual es tomar los primeros 50 a 100 de cada índice, fusionarlos y después aplicar un reranker o un corte en 20 o algo así. Las listas más profundas cuestan latencia y cómputo en cada consulta, y pasado cierto punto solo agregan votos profundos sueltos que nunca llegan arriba.")],
];

// ---------- page ----------
const figure = figurePlate({
  title: t("Count room", "Sala de conteo"),
  keys: [
    { mark: "lit", label: t("The vote being counted: its card, the token on the tray and the first place on the standings", "El voto que se está contando: su tarjeta, la ficha en camino y el primer lugar en las posiciones") },
    { mark: "raised", label: t("Tokens in each tube: one per vote, as tall as that vote's share, shaded by judge", "Fichas en cada tubo: una por voto, tan alta como la parte de ese voto, sombreada según el juez") },
    { mark: "flat", label: t("Ballots: each judge's documents in rank order, with the score it gave on the right", "Boletas: los documentos de cada juez en orden de puesto, con el puntaje que les dio a la derecha") },
  ],
  caption: t(
    "Each judge ranks the same documents for the query: keyword (BM25-style word matching), meaning (embedding similarity) and clicks (popularity). The clerk counts rank by rank: for every card on a ballot, a token goes into that document's tube, as tall as 1 / (k + rank). The counters show points, where a first place is worth 100 (the RRF score × 100 (k + 1)), so the order is the RRF order. Pennants mark the documents that really answer the question: a tall one for a full answer, a short one for a partial one. Switch to raw scores to see what adding the judges' own numbers does; turn k on the dial to see the tokens grow or shrink.",
    "Cada juez ordena los mismos documentos para la consulta: palabras clave (coincidencia de palabras al estilo BM25), significado (similitud de embeddings) y clics (popularidad). El escrutador cuenta puesto por puesto: por cada tarjeta de una boleta, cae una ficha en el tubo de ese documento, tan alta como 1 / (k + puesto). Los contadores muestran puntos, donde un primer lugar vale 100 (el puntaje RRF × 100 (k + 1)), así que el orden es el de RRF. Los banderines marcan los documentos que de verdad responden la pregunta: uno alto para una respuesta completa, uno bajo para una parcial. Cambia a puntajes crudos para ver qué pasa al sumar los números de los propios jueces; gira k en el dial para ver cómo crecen o se achican las fichas.",
  ),
  stage: "data-count",
  stageLabel: t("Rank fusion simulation. Space pauses or resumes.", "Simulación de fusión de rankings. Espacio pausa o reanuda."),
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">${tx(t(`Query: “${QUERY.text}”. Changing a setting starts the count again.`, `Consulta: “${QUERY.text}”. Cambiar un ajuste vuelve a empezar el conteo.`))}</p>`;
const controls = panel({
  stats: [["counted", t("Votes counted", "Votos contados")], ["leader", t("Leader", "Líder")], ["score", t("Leader's score", "Puntaje del líder")], ["rel", t("Relevant in top 5", "Relevantes en el top 5")], ["first", t("1st place worth", "Valor del 1.er lugar")], ["eighth", t("8th vs 1st", "8.º frente a 1.º")]],
  controls: [
    seg("mode", t("Add up", "Sumar"), [["rrf", t("Ranks: 1/(k + rank)", "Puestos: 1/(k + puesto)")], ["raw", t("Raw scores", "Puntajes crudos")]], "rrf"),
    seg("k", "k", [[1, "1"], [10, "10"], [60, "60"], [1000, "1000"]], 60),
    seg("judges", t("Judges", "Jueces"), [[2, t("Keyword + meaning", "Palabras clave + significado")], [3, t("+ clicks", "+ clics")]], 2),
    seg("weight", t("Clicks weight", "Peso de clics"), [[1, "×1"], [0.3, "×0.3"]], 1),
    seg("depth", t("Ballot depth", "Profundidad de la boleta"), [[3, t("Top 3", "Primeros 3")], [5, t("Top 5", "Primeros 5")], [8, t("Top 8", "Primeros 8")]], 8),
    speedSeg(),
    actions(t("Do something", "Haz algo"), [["finish", t("Finish the count", "Terminar el conteo")], ["reset", t("Count again", "Contar de nuevo")], ["pause", t("Pause", "Pausa")]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
[data-judge][data-off]{opacity:.22}
[data-slot][data-hidden]{display:none}
[data-card][data-counted]{opacity:.35}
.iso-stage [data-layer] text{pointer-events:none}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const CLERK_SVG = ${JSON.stringify(clerkSvg())};
const FLIGHT_SVG = ${JSON.stringify(flightSvg())};
const RESULTS = ${JSON.stringify(R)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};

const { L: tr, T } = WB;
const NAME_ES = { keyword: "PALABRAS", meaning: "SIGNIFICADO", clicks: "CLICS" };            // as on the ballot boards
const LIST_ES = { keyword: "palabras clave", meaning: "significado", clicks: "clics" };
const stage = document.querySelector("[data-count]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const NS = "http://www.w3.org/2000/svg";

// the clerk: a pooled group moved with translateAlong
const clerk = document.createElementNS(NS, "g");
clerk.innerHTML = CLERK_SVG;
q('[data-layer="clerk"]').appendChild(clerk);
const flight = document.createElementNS(NS, "g");
flight.innerHTML = FLIGHT_SVG;
q('[data-layer="flight"]').appendChild(flight);

const counters = Object.fromEntries(G.DOC_IDS.map((id) => [id, WB.counter(svg, "pts-" + id, P)]));
const stacks = Object.fromEntries(G.DOC_IDS.map((id) => [id, q('[data-stack="' + id + '"]')]));
const caps = Object.fromEntries(G.DOC_IDS.map((id) => [id, q('[data-cap="' + id + '"]')]));
const kDial = WB.dial(svg, "k", P);
const judgeEl = Object.fromEntries(JUDGES.map((j) => [j, q('[data-judge="' + j + '"]')]));
const weightText = Object.fromEntries(JUDGES.map((j) => [j, q('[data-weight="' + j + '"]')]));
const modeSolid = q("[data-mode] .iso-solid"), modeText = q("[data-mode-text]");
const places = [1, 2, 3, 4, 5].map((p) => ({ solid: q('[data-place="' + p + '"] .iso-solid'), id: q('[data-place-id="' + p + '"]'), pts: q('[data-place-pts="' + p + '"]') }));
const cardEl = (j, r) => q('[data-card="' + j + "-" + r + '"]');
const cardSolid = (j, r) => q('[data-card="' + j + "-" + r + '"] .iso-solid');

const cfg = { mode: "rrf", k: 60, judges: 2, weight: 1, depth: 8, speed: 1 };
const WALK = 120, PICK = 0.35, FLY = 0.85, HOLD = 5;
let plan, clock, shown = {};

function use() { return cfg.judges === 3 ? JUDGES : JUDGES.slice(0, 2); }
function weightOf(j) { return j === "clicks" ? cfg.weight : 1; }

// the schedule: walk to the ballot, pick the card, fly the token to its tube
function makePlan() {
  const votes = countOrder(QUERY.lists, { depth: cfg.depth, use: use() }).map((v) => ({ ...v, w: weightOf(v.list), pts: pointsOf(v, { k: cfg.k, mode: cfg.mode, w: weightOf(v.list) }), add: cfg.mode === "raw" ? weightOf(v.list) * v.raw : rrfShare(v.rank, cfg.k, weightOf(v.list)) }));
  let t = 0, pos = G.AT.home;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  for (const v of votes) {
    const ballot = G.AT.ballot[v.list];
    v.t0 = t; v.from = pos; v.ballot = ballot;
    v.t1 = t + dist(pos, ballot) / WALK; v.t2 = v.t1 + PICK; v.t4 = v.t2 + FLY;
    v.src = G.CARD_AT[v.list + v.rank];
    v.dst = [G.TUBE_X[G.DOC_IDS.indexOf(v.id)], G.TUBE_Y, 0];
    t = v.t4; pos = ballot;
  }
  return { votes, end: t };
}

function restart(at) {
  plan = makePlan();
  clock = at ?? plan.end * 0.55;
  shown = {};
  for (const j of JUDGES) {
    judgeEl[j].toggleAttribute("data-off", !use().includes(j));
    for (let r = 1; r <= G.SLOTS; r++) q('[data-slot="' + j + "-" + r + '"]').toggleAttribute("data-hidden", r > cfg.depth);
  }
  modeSolid.toggleAttribute("data-lit", cfg.mode === "raw");
  plaques();
  kDial.set(Math.log10(cfg.k) / 3);
  paint();
}

// the words on the weight and mode plaques, redrawn when the reader switches language
function plaques() {
  for (const j of JUDGES) weightText[j].textContent = use().includes(j) ? "×" + weightOf(j) : tr("off", "fuera");
  modeText.textContent = cfg.mode === "raw" ? tr("raw scores added", "puntajes sumados") : tr("1 / (k + rank)", "1 / (k + puesto)");
}

const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 0];
const fmtScore = (x) => cfg.mode === "raw" ? x.toFixed(1) : x.toFixed(5);

function tokenSvg(tx, z, h, tone, lit) {
  return solidSvg(cylinder(tx, G.TUBE_Y, G.COL.r, z, Math.max(0.35, h), P, 24, Math.min(0.3, h / 4)), { tone, crease: "lo", lit });
}

function paint() {
  const votes = plan.votes;
  const t = Math.min(clock, plan.end);
  const done = votes.filter((v) => v.t4 <= t);
  const cur = votes.find((v) => v.t4 > t) || null;
  const perDone = {};
  for (const v of done) perDone[v.id] = (perDone[v.id] || 0) + v.pts;

  // the clerk walks the ballots; once a card is picked, its token flies in an arc to the tube
  let pos = G.AT.home;
  if (cur) pos = t < cur.t1 ? lerp(cur.from, cur.ballot, (t - cur.t0) / Math.max(1e-6, cur.t1 - cur.t0)) : cur.ballot;
  else if (votes.length) pos = votes[votes.length - 1].ballot;
  clerk.setAttribute("transform", translateAlong(P, pos));
  if (cur && t >= cur.t2) {
    const f = Math.min(1, (t - cur.t2) / FLY), e = f * f * (3 - 2 * f);
    const stackTop = G.COL.z0 + Math.min(G.COL.top - G.COL.z0, (perDone[cur.id] || 0) * G.SCALE);
    const x = cur.src[0] + (cur.dst[0] - cur.src[0]) * e, y = cur.src[1] + (cur.dst[1] - cur.src[1]) * e;
    const z = cur.src[2] + (stackTop - cur.src[2]) * e + Math.sin(Math.PI * f) * 26;
    flight.setAttribute("transform", translateAlong(P, [x, y, z]));
    flight.style.display = "";
  } else flight.style.display = "none";

  // ballot cards: counted ones fade, the one in hand is lit
  for (const j of JUDGES) for (let r = 1; r <= G.SLOTS; r++) {
    const counted = done.some((v) => v.list === j && v.rank === r);
    const now = cur && cur.list === j && cur.rank === r && t >= cur.t1;
    const key = j + r, state = now ? "lit" : counted ? "done" : "wait";
    if (shown[key] !== state) { shown[key] = state; cardEl(j, r).toggleAttribute("data-counted", state === "done"); cardSolid(j, r).toggleAttribute("data-lit", state === "lit"); }
  }

  // tubes: one token per counted vote, newest lit for a moment
  const per = Object.fromEntries(G.DOC_IDS.map((id) => [id, []]));
  for (const v of done) per[v.id].push(v);
  for (const id of G.DOC_IDS) {
    const vs = per[id], last = vs[vs.length - 1];
    const fresh = last && t - last.t4 < 0.8;
    const key = "s" + id, sig = vs.length + (fresh ? "*" : "") + cfg.mode + cfg.k;
    if (shown[key] === sig) continue;
    shown[key] = sig;
    const tx = G.TUBE_X[G.DOC_IDS.indexOf(id)];
    let z = G.COL.z0, html = "", over = false;
    vs.forEach((v, n) => {
      let h = v.pts * G.SCALE;
      if (z + h > G.COL.top) { h = G.COL.top - z; over = true; }
      if (h > 0.05) html += tokenSvg(tx, z, h, G.JUDGE_TONE[v.list], fresh && n === vs.length - 1);
      z += h;
    });
    stacks[id].innerHTML = html;
    caps[id].style.display = over ? "" : "none";
    counters[id].set(Math.round(vs.reduce((a, v) => a + v.pts, 0)));
  }

  // standings over what has been counted so far
  const tally = new Map();
  for (const v of done) { const e = tally.get(v.id) || { id: v.id, score: 0, pts: 0, best: 99 }; e.score += v.add; e.pts += v.pts; e.best = Math.min(e.best, v.rank); tally.set(v.id, e); }
  const order = [...tally.values()].sort((a, b) => b.score - a.score || a.best - b.best || Number(a.id.slice(1)) - Number(b.id.slice(1)));
  places.forEach((p, i) => {
    const e = order[i], txt = e ? e.id : "–", pts = e ? Math.round(e.pts) + " pts" : "";
    if (p.id.textContent !== txt) p.id.textContent = txt;
    if (p.pts.textContent !== pts) p.pts.textContent = pts;
    p.solid.toggleAttribute("data-lit", i === 0 && !!e);
  });

  // stats and readout
  stat("counted", done.length + " / " + votes.length);
  stat("leader", order[0] ? order[0].id : "–");
  stat("score", order[0] ? fmtScore(order[0].score) : "–");
  stat("rel", order.slice(0, 5).filter((e) => QUERY.docs[e.id].rel > 0).length + tr(" of ", " de ") + Math.min(5, order.length));
  stat("first", cfg.mode === "raw" ? tr("its own score", "su propio puntaje") : "1/" + (cfg.k + 1) + " = " + (1 / (cfg.k + 1)).toFixed(4));
  stat("eighth", cfg.mode === "raw" ? "–" : Math.round(100 * (cfg.k + 1) / (cfg.k + 8)) + "%");
  if (cur && t >= cur.t1) {
    const name = tr(cur.list.toUpperCase(), NAME_ES[cur.list]);
    const rawShown = cur.list === "meaning" ? cur.raw.toFixed(2) : cur.raw;
    const share = (cur.w !== 1 ? cur.w + " × " : "") + "1/(" + cfg.k + " + " + cur.rank + ") = " + cur.add.toFixed(5);
    const worth = cfg.mode === "raw" ? tr("adds its raw score " + rawShown, "suma su puntaje crudo " + rawShown) : tr("adds ", "suma ") + share;
    say(name + " #" + cur.rank + " · " + cur.id + " “" + QUERY.docs[cur.id].title + "” · " + worth);
  } else if (!cur) say(tr("count done · " + (order[0] ? order[0].id + " leads with " + fmtScore(order[0].score) : "") + " · counting again shortly",
    "conteo terminado · " + (order[0] ? order[0].id + " lidera con " + fmtScore(order[0].score) : "") + " · se vuelve a contar en un momento"));
  else say(tr("walking to the " + cur.list + " ballot for rank " + cur.rank, "caminando a la boleta de " + LIST_ES[cur.list] + " para el puesto " + cur.rank));
}
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(key, value) { const el = statEls[key]; const text = String(value); if (el && el.textContent !== text) el.textContent = text; }

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; if (clock > plan.end + HOLD) restart(0); else paint(); }, onPause: (on) => { pauseBtn.textContent = on ? tr("Play", "Reanudar") : tr("Pause", "Pausa"); if (on) say(tr("paused", "en pausa")); } });
WB.onLang(() => {
  pauseBtn.textContent = loop.paused ? tr("Play", "Reanudar") : tr("Pause", "Pausa");
  if (plan) { plaques(); paint(); }
  if (loop.paused) say(tr("paused", "en pausa"));
});

function set(name, raw, quiet) {
  WB.pressSeg(name, raw);
  if (name === "speed") { cfg.speed = Number(raw); return; }
  cfg[name] = ["k", "judges", "weight", "depth"].includes(name) ? Number(raw) : raw;
  if (!quiet) restart(0);
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="finish"]').addEventListener("click", () => { clock = plan.end; paint(); });
document.querySelector('[data-act="reset"]').addEventListener("click", () => { restart(0); if (loop.paused) loop.setPaused(false); });
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments (numbers computed from the same model at build time) ----------
const f1 = (x) => x.toFixed(1), f5 = (x) => x.toFixed(5);
const RUNS = {
  scales: () => {
    const s = RESULTS.scales;
    return { verdict: T("Relevant documents in the top 10, averaged over 40 queries: raw sum " + f1(s.raw) + ", keyword alone " + f1(s.kwOnly) + ", meaning alone " + f1(s.meOnly) + ", RRF " + f1(s.rrf) + ". " + f1(s.sameAsKeyword) + " of the raw sum's top 10 were simply the keyword top 10. On the figure's query the raw sum's top 5 is " + s.figure.raw.join(" ") + " (" + s.figure.rawHits + " relevant); RRF's is " + s.figure.rrf.join(" ") + " (" + s.figure.rrfHits + " relevant).",
        "Documentos relevantes en el top 10, en promedio sobre 40 consultas: suma cruda " + f1(s.raw) + ", solo palabras clave " + f1(s.kwOnly) + ", solo significado " + f1(s.meOnly) + ", RRF " + f1(s.rrf) + ". " + f1(s.sameAsKeyword) + " de los 10 primeros de la suma cruda eran simplemente los 10 primeros de palabras clave. En la consulta de la figura, el top 5 de la suma cruda es " + s.figure.raw.join(" ") + " (" + s.figure.rawHits + " relevantes); el de RRF es " + s.figure.rrf.join(" ") + " (" + s.figure.rrfHits + " relevantes)."),
      bars: [[T("Keyword alone", "Solo palabras clave"), s.kwOnly / 10, f1(s.kwOnly)], [T("Meaning alone", "Solo significado"), s.meOnly / 10, f1(s.meOnly)], [T("Raw score sum", "Suma de puntajes crudos"), s.raw / 10, f1(s.raw), true], ["RRF, k = 60", s.rrf / 10, f1(s.rrf), true]] };
  },
  agree: () => {
    const a = RESULTS.agree;
    return { verdict: T("D1 (3rd and 4th): 1/63 + 1/64 = " + f5(a.d1) + ", 1st place. D2 (1st, one ballot only): 1/61 = " + f5(a.d2) + ", " + a.d2Place + "th place, tied with D5, the meaning ballot's first. D1 scores " + a.ratio.toFixed(2) + "× D2.",
        "D1 (puestos 3 y 4): 1/63 + 1/64 = " + f5(a.d1) + ", primer lugar. D2 (puesto 1, en una sola boleta): 1/61 = " + f5(a.d2) + ", puesto " + a.d2Place + ", empatado con D5, el primero de la boleta de significado. D1 suma " + a.ratio.toFixed(2) + "× lo de D2."),
      bars: [[T("D1: 3rd + 4th", "D1: puestos 3 + 4"), a.d1 / 0.0328, f5(a.d1), true], [T("D2: 1st on one ballot", "D2: puesto 1 en una boleta"), a.d2 / 0.0328, f5(a.d2)], [T("Most possible from two ballots (2 × 1/61)", "Máximo posible con dos boletas (2 × 1/61)"), 2 / 61 / 0.0328, f5(2 / 61)]] };
  },
  k: () => {
    const K = RESULTS.k;
    return { verdict: T("Top 5 at k = 1: " + K.fig[1].top.join(" ") + " (" + K.fig[1].hits + " relevant). At k = 60: " + K.fig[60].top.join(" ") + " (" + K.fig[60].hits + "). At k = 1000: " + K.fig[1000].top.join(" ") + " (" + K.fig[1000].hits + "). Over 40 queries, relevant in the top 10: " + f1(K.avg[1]) + " / " + f1(K.avg[60]) + " / " + f1(K.avg[1000]) + ". A first place is worth " + K.firstVsTenth[1].toFixed(1) + "× a 10th at k = 1, " + K.firstVsTenth[60].toFixed(2) + "× at 60 and " + K.firstVsTenth[1000].toFixed(3) + "× at 1000.",
        "Top 5 con k = 1: " + K.fig[1].top.join(" ") + " (" + K.fig[1].hits + " relevantes). Con k = 60: " + K.fig[60].top.join(" ") + " (" + K.fig[60].hits + "). Con k = 1000: " + K.fig[1000].top.join(" ") + " (" + K.fig[1000].hits + "). En 40 consultas, relevantes en el top 10: " + f1(K.avg[1]) + " / " + f1(K.avg[60]) + " / " + f1(K.avg[1000]) + ". Un primer lugar vale " + K.firstVsTenth[1].toFixed(1) + "× un décimo puesto con k = 1, " + K.firstVsTenth[60].toFixed(2) + "× con 60 y " + K.firstVsTenth[1000].toFixed(3) + "× con 1000."),
      bars: [[T("k = 1, relevant in top 10", "k = 1, relevantes en el top 10"), K.avg[1] / 10, f1(K.avg[1]), true], ["k = 60", K.avg[60] / 10, f1(K.avg[60])], ["k = 1000", K.avg[1000] / 10, f1(K.avg[1000])]] };
  },
  noisy: () => {
    const n = RESULTS.noisy;
    return { verdict: T("Relevant documents in the top 10, over 40 queries: two judges " + f1(n.two) + ", plus clicks at full weight " + f1(n.three) + ", plus clicks at 0.3 " + f1(n.weighted) + ". On the figure's query the top 5 goes from " + n.fig.two + " relevant to " + n.fig.three.hits + " (" + n.fig.three.top.join(" ") + ") with clicks at full weight, and back to " + n.fig.weighted.hits + " (" + n.fig.weighted.top.join(" ") + ") at 0.3.",
        "Documentos relevantes en el top 10, en 40 consultas: dos jueces " + f1(n.two) + ", más clics a peso completo " + f1(n.three) + ", más clics con 0.3 " + f1(n.weighted) + ". En la consulta de la figura, el top 5 pasa de " + n.fig.two + " relevantes a " + n.fig.three.hits + " (" + n.fig.three.top.join(" ") + ") con clics a peso completo, y vuelve a " + n.fig.weighted.hits + " (" + n.fig.weighted.top.join(" ") + ") con 0.3."),
      bars: [[T("Keyword + meaning", "Palabras clave + significado"), n.two / 10, f1(n.two)], [T("+ clicks, weight 1", "+ clics, peso 1"), n.three / 10, f1(n.three), true], [T("+ clicks, weight 0.3", "+ clics, peso 0.3"), n.weighted / 10, f1(n.weighted), true]] };
  },
  depth: () => {
    const d = RESULTS.depth, ex = d.example;
    return { verdict: T("Relevant documents in the fused top 10: " + f1(d.shallow) + " with top-10 lists, " + f1(d.deep) + " with top-100 lists; " + f1(d.rescued) + " per query were on neither top-10 list. For example, a document ranked " + ex.ranks.join(" and ") + " scored " + f5(ex.score) + " and finished " + ex.place + (ex.place === 1 ? "st" : ex.place === 2 ? "nd" : ex.place === 3 ? "rd" : "th") + ", ahead of any single first place (" + f5(d.single1) + "). A lone 40th place is worth " + f5(d.single40) + ".",
        "Documentos relevantes en el top 10 fusionado: " + f1(d.shallow) + " con listas de 10, " + f1(d.deep) + " con listas de 100; " + f1(d.rescued) + " por consulta no estaban en ninguna de las dos listas de 10. Por ejemplo, un documento en los puestos " + ex.ranks.join(" y ") + " sumó " + f5(ex.score) + " y terminó en el puesto " + ex.place + ", por delante de cualquier primer lugar solitario (" + f5(d.single1) + "). Un puesto 40 solitario vale " + f5(d.single40) + "."),
      bars: [[T("Top 10 from each", "Los 10 primeros de cada una"), d.shallow / 10, f1(d.shallow)], [T("Top 100 from each", "Los 100 primeros de cada una"), d.deep / 10, f1(d.deep), true], [T("Two votes in the teens (example)", "Dos votos cerca del puesto 15 (ejemplo)"), ex.score / 0.0328, f5(ex.score), true], [T("One first place", "Un primer lugar"), d.single1 / 0.0328, f5(d.single1)]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  for (const name of ["mode", "k", "judges", "weight", "depth"]) set(name, String(w[name]), true);
  restart(0);
  if (loop.paused) loop.setPaused(false);
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./rrf-workbench.html", import.meta.url), {
  title: t("Rank Fusion Workbench", "Banco de trabajo: fusión de rankings"),
  eyebrow: t("Systems lesson 37 · Reciprocal rank fusion", "Lección de sistemas 37 · Fusión de rango recíproco"),
  lede: t("Hybrid search asks several rankers the same question and has to merge their answers, but their scores can't be compared: a keyword score of 20 and a cosine similarity of 0.8 mean nothing side by side. Reciprocal rank fusion ignores the scores and adds up 1 / (k + rank) from every list. This lesson turns it into a count room: watch the votes go in, predict what changes the result, then explain it back.",
    "La búsqueda híbrida les hace la misma pregunta a varios rankers y tiene que combinar sus respuestas, pero sus puntajes no se pueden comparar: un puntaje de palabras clave de 20 y una similitud coseno de 0.8 no significan nada uno al lado del otro. La fusión de rango recíproco (reciprocal rank fusion, RRF) ignora los puntajes y suma 1 / (k + puesto) de cada lista. Esta lección la convierte en una sala de conteo: mira cómo entran los votos, predice qué cambia el resultado y después explícalo."),
  machine: { intro: t("Three judges have ranked the same fourteen documents for one query. The clerk counts rank by rank: each card on a ballot puts a token in that document's tube, as tall as 1 / (k + rank), and the standings board shows the leaders so far. Pennants mark the documents that really answer the question. Try raw scores instead of ranks, turn k, add the clicks judge, and cut the ballots short.",
    "Tres jueces ordenaron los mismos catorce documentos para una consulta. El escrutador cuenta puesto por puesto: cada tarjeta de una boleta pone una ficha en el tubo de ese documento, tan alta como 1 / (k + puesto), y el tablero de posiciones muestra a los líderes hasta el momento. Los banderines marcan los documentos que de verdad responden la pregunta. Prueba los puntajes crudos en lugar de los puestos, gira k, agrega el juez de clics y acorta las boletas. La consulta y los documentos están en inglés para que las cifras coincidan con el modelo."), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same fusion code as the machine: the figure's query, and an average over 40 seeded queries with 300 documents each.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo código de fusión que la máquina: la consulta de la figura y un promedio sobre 40 consultas con semilla fija, de 300 documentos cada una."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: t(`RRF: Cormack, Clarke &amp; Büttcher, “Reciprocal rank fusion outperforms Condorcet and individual rank learning methods”, SIGIR 2009. Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson.`,
    `RRF: Cormack, Clarke &amp; Büttcher, “Reciprocal rank fusion outperforms Condorcet and individual rank learning methods”, SIGIR 2009. Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección.`),
  css,
  script: live,
});
console.log("wrote rrf-workbench.html", (size / 1024).toFixed(0) + " KB");

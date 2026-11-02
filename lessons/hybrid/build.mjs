// Systems lesson 38 · Hybrid search. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, tileSvg, P, GEOMETRY } from "./figure.mjs";
import { experimentResults, LATENCY } from "./sim.js";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- results (computed here from the same model the page runs) ----------
const R = experimentResults();
const by = (o) => `exact IDs ${o.exact}%, paraphrases ${o.paraphrase}%, mixed ${o.mixed}%`;
const best = (key) => R.alpha.reduce((b, a) => (a[key] > b[key] ? a : b));
const bestAlphas = (key) => { const top = Math.max(...R.alpha.map((a) => a[key])); const hit = R.alpha.filter((a) => a[key] === top).map((a) => a.alpha); return hit.length > 1 ? hit[0] + " to " + hit[hit.length - 1] : String(hit[0]); };

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "lanes",
    title: "One lane or both",
    change: "Keyword lane only (BM25) vs meaning lane only (embeddings) vs both, merged with reciprocal rank fusion · 30 queries of each kind · is the wanted article in the top 10?",
    question: "Which setup finds the right article for all three kinds of query?",
    options: ["The keyword lane: exact words are the safest bet", "The meaning lane: embeddings understand all three", "Neither alone: each lane misses a different kind, and only the merged lists cover all three"],
    answer: 2,
    why: `Keyword only: ${by(R.three.lexical)}. Meaning only: ${by(R.three.semantic)}. Both, merged: ${by(R.three.hybrid)}. BM25 matches exact tokens, so a pasted error code or part number lands first, but a customer who writes "money back" never matches an article that says "refund". The embedding puts synonyms together, but an identifier or a product name means nothing to it, so it can't tell E-4072 from E-4073 or one product's article from another's. A mixed query needs both at once: the product name from the keyword lane and the meaning from the other.`,
    watch: { qtype: "all", lanes: "both", fusion: "rrf", depth: "20", rerank: "off" },
  },
  {
    id: "fusion",
    title: "Adding the scores as they are",
    change: "Merge by a weighted sum, α = 0.5, of the raw scores (BM25 runs from 0 to about 20, cosine from 0 to 1) vs the same sum after min-max scaling each list to 0..1 vs reciprocal rank fusion",
    question: "With raw scores, what happens to paraphrase queries?",
    options: ["Nothing: α = 0.5 already gives both lanes half the say", "BM25's bigger numbers swamp the cosines, so paraphrases do little better than keyword search alone", "They improve: bigger scores carry more information"],
    answer: 1,
    why: `Raw sum: ${by(R.fusion.raw)}. Min-max scaled: ${by(R.fusion.minmax)}. Reciprocal rank fusion: ${by(R.fusion.rrf)}. The two scores live on different scales, so an unscaled sum lets whichever is numerically bigger decide, and α no longer means what it says. Scale each list first (min-max or z-scores), or merge by rank, which ignores the scores altogether. RRF needs no tuning and is the safe default; it gives both lanes the same vote, so on paraphrases the keyword lane's near-misses take a few seats that a tuned weighted sum keeps for the meaning lane.`,
    watch: { qtype: "paraphrase", lanes: "both", fusion: "raw", alpha: "0.5", depth: "20", rerank: "off" },
  },
  {
    id: "alpha",
    title: "Turning the balance",
    change: "Min-max weighted sum with α = 0, 0.3, 0.5, 0.7 and 1 (0 = keywords only, 1 = meaning only) · recall@10 for each kind of query",
    question: "Which α is best?",
    options: ["0.5, whatever the queries: equal weight is fair", "It depends on the queries: identifiers want weight on keywords, paraphrases on meaning, and the best overall α depends on your mix", "1: meaning beats keywords"],
    answer: 1,
    why: R.alpha.map((a) => `α ${a.alpha}: ${by(a)}`).join(". ") + `. Best for exact IDs: α ${bestAlphas("exact")}; for paraphrases: α ${bestAlphas("paraphrase")}; for mixed: α ${bestAlphas("mixed")}; over all 90: α ${bestAlphas("all")} (${best("all").all}%). The ends are just the single lanes. Tune α on a labelled sample of your own queries, and retune when the mix changes.`,
    watch: { qtype: "all", lanes: "both", fusion: "minmax", alpha: "0.5", depth: "20", rerank: "off" },
  },
  {
    id: "depth",
    title: "How deep each lane looks",
    change: "Each lane hands over its top 5, 20 or 100 candidates · merged with RRF · a reranker re-reads up to 100 of them · is a wanted article in the top 10?",
    question: "What does looking deeper buy?",
    options: ["Nothing: the right article is always at the top of one lane", "Too shallow and the right article never reaches the merge; past a point, more depth only adds reranking time", "Deeper is always better and costs nothing: retrieval is cheap"],
    answer: 1,
    why: R.depth.map((d) => `Depth ${d.depth}: the wanted articles reach the merge ${d.pool}% of the time, ${d.all}% end up in the top 10, ${d.ms} ms per query`).join(". ") + ". Merging and reranking can only reorder what the lanes handed over: an article that one lane ranked 8th and the other missed is gone at depth 5. Once the right articles are reliably in the pool, more depth only buys reranking time. Measure where that point is for your own queries.",
    watch: { qtype: "mixed", lanes: "both", fusion: "rrf", depth: "5", rerank: "on" },
  },
  {
    id: "rerank",
    title: "A reranker over the top 100",
    change: `RRF over each lane's top 100 · then a cross-encoder reads the query and each of the top 100 together and rescores them (${LATENCY.perRerank} ms a candidate) · is the wanted article in the top 5?`,
    question: "What does the reranker change?",
    options: ["It finds articles neither lane retrieved", `It puts the right ones on top more often, but not always, and adds about ${Math.round(R.rerank.on.ms - R.rerank.off.ms)} ms a query`, "Little, and it costs nothing"],
    answer: 1,
    why: `Without: ${by(R.rerank.off)} in the top 5, ${R.rerank.off.ms} ms. With: ${by(R.rerank.on)}, ${R.rerank.on.ms} ms. The two lanes score the query and an article separately, from a word count or two vectors; a cross-encoder reads them side by side, so it sees the product name, the identifier and the meaning at once. It is still a model and still makes mistakes, and it is too slow to run over a whole corpus, so it reorders a shortlist: it can't find what the lanes missed, and its cost grows with how many candidates it reads.`,
    watch: { qtype: "all", lanes: "both", fusion: "rrf", depth: "100", rerank: "on" },
  },
];

const QUESTIONS = [
  ["A customer pastes \"E-4072\" into search, another types \"my money back for a cracked parcel\". Why does one retriever handle the first and miss the second, and the other the opposite?",
    "BM25 scores exact tokens, weighted by how rare they are: an identifier is rare, so the one article that contains it wins. But it has no idea that money back means refund or cracked means damaged. An embedding model puts words with similar meaning close together, so the paraphrase lands near the refund articles, but an identifier or a product name carries little learned meaning, so every error-code article looks about the same to it."],
  ["You merge BM25 and vector results with a weighted sum and α seems to do nothing. What is probably wrong?",
    "The scores are on different scales: BM25 runs from 0 to tens, cosine from -1 to 1. Unscaled, the bigger numbers decide and α barely matters. Normalise each list first (min-max to 0..1, or z-scores), or use reciprocal rank fusion, which only looks at ranks: 1 / (60 + rank) from each list, summed."],
  ["How would you choose α, or decide between RRF and a weighted sum?",
    "Build a labelled set of real queries and the articles that should come back, broken down by kind, and measure recall@k or nDCG for each setting. RRF is a good default with nothing to tune. A weighted sum can beat it once tuned, but its best α depends on your query mix, so retune when the mix changes; some systems pick α per query, from how many identifiers the query contains."],
  ["With plain RRF, hybrid scored a little below the meaning lane alone on paraphrase queries. Why can merging cost a few points on one kind of query, and what can you do?",
    "Fusion gives seats in the top k to whatever either list ranks well. On a paraphrase the keyword lane is the weaker one, and its top results include near-misses that share a word or two; plain RRF gives them the same vote as the meaning lane's results. Weight the lists (weighted RRF, or a tuned α), cap the weaker list's depth, or let a reranker reorder the merged list. Overall, hybrid still comes out ahead because it fixes the other lane's much bigger misses."],
  ["Why rerank only the top 100 or so, and why can't a reranker fix a bad retrieval stage?",
    "A cross-encoder reads the query and each candidate together, which is accurate but costs a model call per candidate, far too slow for every document. So retrieval is the recall stage (get the right documents into the shortlist cheaply) and reranking the precision stage (put them in the right order). Anything retrieval left out never reaches the reranker, so depth per lane sets the ceiling."],
  ["Where does this show up in real systems?",
    "Retrieval for RAG and site search: Elasticsearch and OpenSearch can combine a BM25 query with a kNN query and merge by RRF or normalised scores; Weaviate's hybrid search has an alpha (1 = pure vector); Postgres can pair full-text search with pgvector and merge in SQL. The design questions are the same as here: which lanes, how to merge, how deep, and whether a reranker is worth its latency."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Sorting plant",
  keys: [
    { mark: "lit", label: "The article the query wants, wherever it ranks; the inspector while reranking" },
    { mark: "raised", label: "Numbered article tiles in ranked slots: 1 at the left" },
    { mark: "flat", label: "Two lanes: keywords (raised, back) and meaning (front)" },
  ],
  caption:
    "The query on the board goes down both lanes. The back lane sieves articles through holes cut to the query's exact words and racks the ten best BM25 matches; the front lane's magnet pulls articles by meaning and racks the ten nearest. The filled tile is the article the query wants (for a paraphrase, which names no product, every product's article on exactly that subject counts). The counter at the end of each rack shows where that lane ranked it (000: the lane didn't find it). Both lists pour into the merge hopper: tokens for reciprocal rank fusion, or a balance beam tilted by α for a weighted sum. With reranking on, the inspector re-reads the top candidates before they go to the results shelf. The scoreboard shows how often the wanted articles land in the top 10 for each kind of query, and the time per query.",
  stage: 'data-plant aria-label="Hybrid search simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">A help centre of 240 articles (16 products × 15 topics) and 90 labelled queries. Times are a model: BM25 ${LATENCY.lexical} ms and the vector search ${LATENCY.semantic} ms, run side by side, ${LATENCY.fuse} ms to merge, ${LATENCY.perRerank} ms per candidate the reranker reads. α only applies to the weighted sums.</p>`;
const controls = panel({
  stats: [["query", "Query"], ["ra", "Keyword lane"], ["rb", "Meaning lane"], ["rf", "Result"], ["recall", "Top-10 recall, this kind"], ["ms", "Time"]],
  controls: [
    seg("qtype", "Queries", [["all", "All"], ["exact", "Exact IDs"], ["paraphrase", "Paraphrases"], ["mixed", "Mixed"]], "all"),
    seg("lanes", "Lanes", [["both", "Both"], ["lex", "Keywords only"], ["sem", "Meaning only"]], "both"),
    seg("fusion", "Merge", [["rrf", "RRF"], ["minmax", "Weighted, scaled"], ["raw", "Weighted, raw"]], "rrf"),
    seg("alpha", "α (meaning's weight)", [["0", "0"], ["0.3", "0.3"], ["0.5", "0.5"], ["0.7", "0.7"], ["1", "1"]], "0.5"),
    seg("depth", "Depth per lane", [["5", "5"], ["20", "20"], ["100", "100"]], "20"),
    seg("rerank", "Rerank", [["off", "Off"], ["on", "Top 100"]], "off"),
    speedSeg(),
    actions("Do something", [["next", "Next query"], ["reset", "Start over"], ["pause", "Pause"]]),
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
  setText(querySign, query.text);
  setText(sieveText, cfg.lanes === "sem" ? "lane off" : terms.join(" · "));
  paint();
}
function next() { at = (at + 1) % order.length; begin(order[at]); }
function restart(startAt = 0, first) {
  rescore();
  order = queue();
  const want = first ? START : order[0];
  at = Math.max(0, order.indexOf(want));
  WB.pose(svg, "fusion", cfg.fusion === "rrf" || cfg.lanes !== "both" ? "rrf" : "a" + cfg.alpha);
  setText(fuseText, cfg.lanes !== "both" ? "ONE LANE" : cfg.fusion === "rrf" ? "RRF" : (cfg.fusion === "raw" ? "RAW " : "α ") + cfg.alpha);
  closed.style.display = cfg.rerank === "on" ? "none" : "";
  begin(order[at], startAt);
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
  const show = (x) => (x ? "#" + x : "not found");
  stat("query", c.query.type + ": " + c.query.text);
  stat("ra", cfg.lanes === "sem" ? "off" : laneDone ? show(c.rankA) : "…");
  stat("rb", cfg.lanes === "lex" ? "off" : laneDone ? show(c.rankB) : "…");
  stat("rf", done ? show(c.rf) + (c.rel.size > 1 ? " (" + c.rel.size + " articles count)" : "") : "…");
  stat("recall", scores ? Math.round(scores[c.query.type].recall * 100) + "%" : "");
  stat("ms", done ? Math.round(r.ms) + " ms" : "…");
  const head = '"' + c.query.text + '"';
  if (t < 0.5) say(c.query.type + " query " + head + " · down both lanes");
  else if (!laneDone) say(head + " · lanes filling their racks");
  else if (t < 3) say(head + " · keywords " + (cfg.lanes === "sem" ? "off" : show(c.rankA)) + " · meaning " + (cfg.lanes === "lex" ? "off" : show(c.rankB)) + " · merging");
  else if (reading_) say(head + " · reranker re-reading " + r.reranked + " candidates");
  else say(head + " · keywords " + (cfg.lanes === "sem" ? "off" : show(c.rankA)) + " · meaning " + (cfg.lanes === "lex" ? "off" : show(c.rankB)) + " · result " + show(c.rf));
}

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => { t += dt * cfg.speed; if (t > cur.shelf0 + 1.6 + 2.6) next(); else paint(); }, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });

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
    return { verdict: "Keyword lane: " + lexical.exact + " / " + lexical.paraphrase + " / " + lexical.mixed + "% (exact / paraphrase / mixed). Meaning lane: " + semantic.exact + " / " + semantic.paraphrase + " / " + semantic.mixed + "%. Both, merged: " + hybrid.exact + " / " + hybrid.paraphrase + " / " + hybrid.mixed + "%.",
      bars: [["Keywords: exact IDs", lexical.exact / 100, lexical.exact + "%"], ["Keywords: paraphrases", lexical.paraphrase / 100, lexical.paraphrase + "%"], ["Meaning: exact IDs", semantic.exact / 100, semantic.exact + "%"], ["Meaning: paraphrases", semantic.paraphrase / 100, semantic.paraphrase + "%"], ["Both: exact IDs", hybrid.exact / 100, hybrid.exact + "%", true], ["Both: paraphrases", hybrid.paraphrase / 100, hybrid.paraphrase + "%", true], ["Both: mixed (keywords " + lexical.mixed + "%, meaning " + semantic.mixed + "%)", hybrid.mixed / 100, hybrid.mixed + "%", true]] }; },
  fusion: () => { const { raw, minmax, rrf } = RESULTS.fusion;
    return { verdict: "Paraphrases in the top 10: raw sum " + raw.paraphrase + "%, scaled sum " + minmax.paraphrase + "%, RRF " + rrf.paraphrase + "%. Over all 90 queries: " + raw.all + "%, " + minmax.all + "%, " + rrf.all + "%. The keyword lane alone gets " + RESULTS.three.lexical.paraphrase + "% of paraphrases.",
      bars: [["Paraphrases, raw sum", raw.paraphrase / 100, raw.paraphrase + "%", true], ["Paraphrases, scaled sum", minmax.paraphrase / 100, minmax.paraphrase + "%"], ["Paraphrases, RRF", rrf.paraphrase / 100, rrf.paraphrase + "%"], ["All queries, raw sum", raw.all / 100, raw.all + "%", true], ["All queries, scaled sum", minmax.all / 100, minmax.all + "%"], ["All queries, RRF", rrf.all / 100, rrf.all + "%"]] }; },
  alpha: () => { const A = RESULTS.alpha; const top = (k) => A.reduce((b, a) => (a[k] > b[k] ? a : b));
    const span = (k) => { const m = top(k)[k]; const h = A.filter((a) => a[k] === m).map((a) => a.alpha); return h.length > 1 ? h[0] + " to " + h[h.length - 1] : String(h[0]); };
    return { verdict: "Best α for exact IDs " + span("exact") + ", for paraphrases " + span("paraphrase") + ", for mixed " + span("mixed") + "; over all 90 queries α " + span("all") + " (" + top("all").all + "%). α 0 and α 1 are just the two lanes alone.",
      bars: A.map((a) => ["α " + a.alpha + ": exact " + a.exact + " · para " + a.paraphrase + " · mixed " + a.mixed, a.all / 100, a.all + "%", a.alpha === top("all").alpha]) }; },
  depth: () => { const D = RESULTS.depth;
    return { verdict: D.map((d) => "Depth " + d.depth + ": " + d.pool + "% reach the merge, " + d.all + "% in the top 10, " + d.ms + " ms").join(". ") + ".",
      bars: D.flatMap((d) => [["Depth " + d.depth + ": in the top 10", d.all / 100, d.all + "%", d.depth !== 10], ["Depth " + d.depth + ": time (of 300 ms)", Math.min(1, d.ms / 300), d.ms + " ms"]]) }; },
  rerank: () => { const { off, on } = RESULTS.rerank;
    return { verdict: "In the top 5 without reranking: " + off.all + "% (" + off.exact + " / " + off.paraphrase + " / " + off.mixed + "), " + off.ms + " ms. With the reranker over the top 100: " + on.all + "% (" + on.exact + " / " + on.paraphrase + " / " + on.mixed + "), " + on.ms + " ms.",
      bars: [["Top 5, no rerank", off.all / 100, off.all + "%"], ["Top 5, reranked", on.all / 100, on.all + "%", true], ["Time, no rerank (of 300 ms)", off.ms / 300, off.ms + " ms"], ["Time, reranked (of 300 ms)", on.ms / 300, on.ms + " ms", true]] }; },
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
  title: "Hybrid Search Workbench",
  eyebrow: "Systems lesson 38 · Hybrid search",
  lede: "Hybrid search runs a keyword retriever and a meaning retriever on the same query and merges what they find. Each one misses a different kind of query, so the merged list catches both, if the merge is done right. This lesson runs a two-lane sorting plant over a help centre: watch it, predict what changes the results, then explain it back.",
  machine: { intro: "Each query goes down both lanes. The keyword lane (BM25) sieves articles by the query's exact words; the meaning lane (embeddings) pulls them by similarity. Their racks pour into the merge hopper, an optional reranker re-reads the top candidates, and the best ten land on the results shelf. The filled tile is the article the query wants. Try the three kinds of query, a single lane, the merge method, α, the depth and the reranker.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine: 90 labelled queries on each of five generated help centres, averaged.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: `Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson: real BM25, a toy embedding and a modelled reranker over a made-up help centre.`,
  css,
  script: live,
});
console.log("wrote hybrid-search-workbench.html", (size / 1024).toFixed(0) + " KB");

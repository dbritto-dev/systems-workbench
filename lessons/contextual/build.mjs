// Systems lesson 39 · Contextual retrieval. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, cardSvg, bookletSvg, P, GEOMETRY } from "./figure.mjs";
import { makeCorpus, buildIndex, retrieve, contextCost, POOL, expEmbeddings, expBm25, expRerank, expTopK, expCost } from "./sim.js";

const POST = `<a href="https://www.anthropic.com/engineering/contextual-retrieval" target="_blank" rel="noopener">Introducing Contextual Retrieval</a>`;

// ---------- results (computed once here from the same model the page shows; 6 seeded corpora each) ----------
import { readFileSync, writeFileSync, existsSync } from "node:fs";
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

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "emb",
    title: "Stamp the context on every card",
    change: "Search by meaning only (embeddings) · plain chunk cards → cards with the context header stamped on before they are embedded · top 20 passed on",
    question: "What happens to the share of questions whose answer chunk isn't among the 20 passed on?",
    options: ["Nothing: the chunk's own words haven't changed", "It drops by a third or more, but plenty are still missed", "It drops to almost nothing"],
    answer: 1,
    why: `A plain chunk like "The company's revenue grew by 3% over the previous quarter." reads the same in every filing that reports revenue (about 64 here), so a question about Acme's second quarter matches all of them about equally; a chunk about a recall or a lawsuit is rarer, so it is usually found anyway. The stamped header names the company and quarter, and the embedding now leans toward the right chunk. Only leans: embeddings carry names weakly (to an embedding one company looks a lot like another) and pay little attention to exact codes, so some questions still miss. The post measured the same direction on real data: Contextual Embeddings cut the top-20 failure rate by 35%, from 5.7% to 3.7%.`,
    watch: { ctx: "plain", search: "emb", rerank: "off", k: "20", cache: "on" },
  },
  {
    id: "bm25",
    title: "Search the words as well",
    change: "Cards with context · meaning only → meaning plus a BM25 keyword index of the same stamped cards, the two rankings merged by reciprocal rank fusion",
    question: "Adding a keyword index to the meaning search: what happens to the failures?",
    options: ["Nothing: the meaning search already found the right topic", "Another clear step down, because the header's names now match the question word for word", "Almost all the remaining failures go away"],
    answer: 1,
    why: `BM25 rewards exact, rare words: "Acme", "2023", a product name. With the context stamped on, every Acme chunk now carries "Acme", so the keyword index can pick Acme's chunk out of the look-alikes, which the embedding could only lean toward. It can't help when the question says "ACM" or "the second quarter" and the header says "Acme Corp" and "Q2": exact words only. The meaning search still covers paraphrases ("sales rise" for "revenue grew"), and rank fusion (here weighted 0.8 meaning, 0.2 keywords) keeps what either list puts near the top. On plain chunks the company name appears only on the cover, so BM25 has nothing to match and changes almost nothing. The post: Contextual Embeddings plus Contextual BM25 cut the failure rate by 49% (5.7% → 2.9%).`,
    watch: { ctx: "ctx", search: "both", rerank: "off", k: "20", cache: "on" },
  },
  {
    id: "rerank",
    title: "Rerank 150, keep 20",
    change: "Context, meaning and BM25 · pass the top 20 straight on → fetch the top 150, let a reranker that reads question and chunk together reorder them, pass its top 20 on",
    question: "What does the reranker change?",
    options: ["Nothing: the answer is either in the first 20 or it isn't", "It rescues answers that were found but ranked 21st to 150th, so failures drop again", "It finds answers that weren't in the 150 at all"],
    answer: 1,
    why: `First-stage search is fast and rough; a reranker is slower but reads the question and the whole chunk (with its context) together, so it can put the right chunk first even when it came back 60th. It can only reorder what it is given, though: an answer outside the 150 stays missed, and on plain chunks it has nothing to tell the look-alikes apart with, so it just reshuffles them. The post retrieved 150, reranked with Cohere's reranker and kept 20: failures fell by 67% overall (5.7% → 1.9%). The cost is a little latency and money per query.`,
    watch: { ctx: "ctx", search: "both", rerank: "on", k: "20", cache: "on" },
  },
  {
    id: "topk",
    title: "How many chunks to pass on",
    change: "The full pipeline (context, meaning + BM25, reranked) · pass on the top 5 / 10 / 20 chunks",
    question: "Which passes the answer to the model most often?",
    options: ["5: fewer, better chunks", "20: more chances that the answer is among them", "No difference once the results are reranked"],
    answer: 1,
    why: `Even after reranking, the right chunk is sometimes 6th or 12th, so a short list drops it. Twenty chunks of 800 tokens is still a small prompt for a modern model. The post tried 5, 10 and 20 and found 20 worked best. Past that, more chunks cost tokens and can bury the answer among near-misses, so measure on your own questions.`,
    watch: { ctx: "ctx", search: "both", rerank: "on", k: "5", cache: "on" },
  },
  {
    id: "cost",
    title: "What the context costs, and when to skip all this",
    change: "Writing a 100-token context for every 800-token chunk of 8k-token documents, with Claude 3 Haiku at list prices · without vs with prompt caching of the document",
    question: "Roughly what does contextualising a million tokens of documents cost with prompt caching, and when don't you need retrieval at all?",
    options: ["About $1 (around three times that without caching); skip retrieval if the whole knowledge base fits in about 200,000 tokens", "About $30, so only worth it for small corpora", "Caching can't help, because every chunk is different"],
    answer: 0,
    why: `Each chunk's call sends the whole document plus the chunk. Without caching you pay for the full document again for every chunk; with caching the document is written to the cache once and read cheaply for the rest. The post estimates $1.02 per million document tokens with caching, a one-time cost at indexing. If the whole knowledge base is under about 200,000 tokens (about 500 pages), the post's advice is to skip retrieval and put all of it in the prompt, with prompt caching to keep that cheap. This lesson's corpus stands for well over 200,000 tokens; one company's filings would fit.`,
    watch: { ctx: "ctx", search: "both", rerank: "on", k: "20", cache: "off" },
  },
];

const QUESTIONS = [
  ["Why does chunking lose information, and what exactly does Contextual Retrieval add?",
    "A chunk is cut out of its document, so whatever the document said once, up front (which company, which quarter, which product), is missing from most chunks. Contextual Retrieval asks an LLM, given the whole document and one chunk, for a short chunk-specific context (usually 50 to 100 tokens), and prepends it to the chunk before the chunk is embedded and before it is added to the BM25 index. The chunk shown to the model at answer time can be the same text."],
  ["Why do embeddings alone struggle with \"Acme's revenue in Q2 2023\", and why does BM25 help?",
    "Embeddings capture meaning, which is great for paraphrases, but they blur exact identifiers: one company name, quarter or error code looks much like another. BM25 scores exact words, weighting rare ones heavily, so it pins down \"Acme\" or \"TS-999\". Once the context has put those names into every chunk, the keyword index can use them. Combining both, with rank fusion, gets meaning and exact matches."],
  ["What is reranking, and why retrieve 150 to keep 20?",
    "The first stage scores the query against every chunk separately (precomputed vectors, an inverted index), which is fast but rough. A reranker reads the query and each candidate together, which is more accurate but far too slow to run on everything. So you retrieve generously (150) for recall, rerank, and keep the best 20 for the prompt. It can only reorder candidates: whatever the first stage missed stays missed."],
  ["How does prompt caching make contextualisation cheap?",
    "Every chunk of a document needs a call that includes the whole document. Cache the document after the first chunk's call, and the other calls read it from the cache at a fraction of the input price. The post estimates about $1.02 per million document tokens, paid once when you index."],
  ["When would you not build any of this?",
    "When the knowledge base is small: under about 200,000 tokens (roughly 500 pages) you can put all of it in the prompt and use prompt caching, with no chunking, no index and no retrieval failures. Retrieval earns its complexity when the corpus is too big for the context window or too costly to resend."],
  ["How would you measure whether Contextual Retrieval helps on your own data?",
    "Build a set of real questions with the chunk (or chunks) that answer each. Measure the failure rate at your top-K: the share of questions whose answer isn't among the chunks you pass on. Change one thing at a time (context, BM25, reranking, K, the embedding model, the context prompt) and compare on the same set. Look at the misses: they tell you whether the problem is ambiguity, wording or ranking."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Print shop",
  keys: [
    { mark: "lit", label: "The answer chunk; a cabinet being searched; the miss lamp" },
    { mark: "raised", label: "Chunk cards: the dark strip at one end is the stamped context" },
    { mark: "flat", label: "The belt from the guillotine past the context press to the cabinets" },
  ],
  caption:
    "Reports are cut into chunk cards at the guillotine; the cover, which says whose report it is, stays behind. The context press reads the whole report open on its head and stamps a header strip on each card; switch context off and the cards go through blank. The cards are filed in WORDS (the BM25 index) and MEANING (the embedding map). For each question, search returns candidates into the rack, best on the left (the first 150 when reranking, otherwise only as many as are passed on); the inspector reranks them into the tray that goes to the model. The lit card is the chunk that answers the question: its bin shows how high search ranked it, its place in the tray where it ended up. If it isn't in the tray, the miss lamp lights.",
  stage: 'data-shop aria-label="Contextual retrieval simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">The corpus is synthetic: 128 quarterly filings from 16 companies over two years and 8 product manuals, cut into ${corpus.chunks.length.toLocaleString("en")} chunks. Only a filing's cover names its company and quarter; standard figures read alike across filings, events are rarer. One question per filing and four per manual (${corpus.questions.length} in all), some paraphrased, some using a ticker or "the second quarter". Compare the direction and size of each step, not the exact rates.</p>`;
const controls = panel({
  stats: [["asked", "Asked"], ["missed", "Missed"], ["rate", "Failure rate"], ["rank", "Answer's rank"], ["passed", "Passed on"], ["cost", "Context cost"]],
  controls: [
    seg("ctx", "Chunks", [["plain", "Plain"], ["ctx", "With context"]], "ctx"),
    seg("search", "Search", [["emb", "Meaning only"], ["both", "Meaning + BM25"]], "both"),
    seg("rerank", "Rerank", [["off", "Off"], ["on", "Top 150 → K"]], "on"),
    seg("k", "Pass on (K)", [["5", "5"], ["10", "10"], ["20", "20"]], "20"),
    seg("cache", "Prompt caching", [["on", "On"], ["off", "Off"]], "on"),
    speedSeg(),
    actions("Do something", [["next", "Next question"], ["reset", "Start over"], ["pause", "Pause"]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
.iso-stage [data-layer] text{pointer-events:none}
.iso-stage [data-strip] .iso-solid>.iso-fill,.iso-stage [data-strip] .iso-solid>.iso-top,.iso-stage [data-strip] .iso-solid>.iso-shade{fill:color-mix(in srgb,var(--anatomy-strong) 52%,var(--anatomy-page))}
`;

// ---------- live code ----------
const live = `
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const CARD_SVG = ${JSON.stringify(cardSvg())};
const RANKS = ${JSON.stringify(RANKS)};
const QS = ${JSON.stringify(QS.map(({ i, label, text }) => ({ i, label, text })))};
const DOCS = ${JSON.stringify(DOCS)};
const COST = ${JSON.stringify(COST)};
const POOL = ${POOL};
const RESULTS = ${JSON.stringify(R)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};

const stage = document.querySelector("[data-shop]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const qa = (s) => [...svg.querySelectorAll(s)];
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const NS = "http://www.w3.org/2000/svg";
const layers = { belt: q('[data-layer="belt"]'), rack: q('[data-layer="rack"]'), tray: q('[data-layer="tray"]') };
const counters = Object.fromEntries(["pooled", "rank", "k", "asked", "missed"].map((n) => [n, WB.counter(svg, n, P)]));
const costMeter = WB.meter(svg, "cost", P), failMeter = WB.meter(svg, "failrate", P);
const blade = q("[data-blade]"), ram = q("[data-ram]"), reading = q("[data-reading]"), pressOff = q("[data-press-off]");
const bins = qa("[data-bin]");
const question = q("[data-question]");
const cover = { stack: q("[data-cover-stack]"), cut: q("[data-cover-cut]"), read: q("[data-cover-read]"), read2: q("[data-cover-read2]") };
const wordsBand = q('[data-off-band="words"]'), rerankBand = q('[data-off-band="rerank"]');
const setText = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };

function makeCard() {
  const g = document.createElementNS(NS, "g");
  g.innerHTML = CARD_SVG;
  return { g, body: g.querySelector("[data-body]"), strip: g.querySelector("[data-strip]"), lit: null, stripOn: null };
}
function dress(c, lit, strip) {
  if (c.lit !== lit) { c.lit = lit; c.body.toggleAttribute("data-lit", lit); }
  if (c.stripOn !== strip) { c.stripOn = strip; c.strip.style.display = strip ? "" : "none"; }
}
// the tray's 20 places, and the answer card in the rack
const slots = G.SLOT.map((pos) => { const c = makeCard(); c.g.setAttribute("transform", translateAlong(P, pos)); c.g.style.display = "none"; layers.tray.appendChild(c.g); return c; });
const marker = makeCard(); marker.g.style.display = "none"; layers.rack.appendChild(marker.g); dress(marker, true, false);

// ---------- the indexing line: booklets cut into cards that ride the belt past the press ----------
const belt = [], spare = [];
const SPACING = 0.62, SPEED = 15, PER_DOC = 8;
let spawnClock = 0, cardNo = 0;
function docName(n) { return DOCS[Math.floor(n / PER_DOC) % DOCS.length]; }
function splitName(name) { const parts = name.split(" "); return parts.length === 3 ? [parts[0], parts[1] + " " + parts[2]] : [parts[0], "MANUAL"]; }
function spawn(x) {
  const c = spare.pop() || makeCard();
  c.x = x; layers.belt.appendChild(c.g); belt.push(c); cardNo++;
}
function stepBelt(dt) {
  spawnClock += dt;
  while (spawnClock >= SPACING) { spawnClock -= SPACING; spawn(G.BELT_X0 + spawnClock * SPEED); }
  for (let i = belt.length - 1; i >= 0; i--) {
    const c = belt[i];
    c.x += dt * SPEED;
    if (c.x > G.BELT_X1) { c.g.remove(); spare.push(c); belt.splice(i, 1); continue; }
    c.g.setAttribute("transform", translateAlong(P, [c.x, G.BELT_Y, G.BELT_Z]));
    dress(c, false, cfg.ctx === "ctx" && c.x > G.PRESS_X + 1);
    const fade = Math.min(1, (G.BELT_X1 - c.x) / 8);
    c.g.style.opacity = fade < 1 ? String(fade) : "";
  }
  // the blade comes down as each card is cut; the ram stamps as each card passes under it
  const cut = spawnClock / SPACING, bladeDown = cut < 0.25 ? Math.sin(Math.PI * cut / 0.25) : 0;
  blade.setAttribute("transform", bladeDown ? translateAlong(P, [0, 0, -(G.BLADE.z1 - G.BLADE.z0) * bladeDown]) : "");
  let stamp = 0;
  if (cfg.ctx === "ctx") for (const c of belt) { const d = Math.abs(c.x - G.PRESS_X); if (d < 2.4) stamp = Math.max(stamp, Math.cos((d / 2.4) * Math.PI / 2)); }
  ram.setAttribute("transform", stamp ? translateAlong(P, [0, 0, -(G.RAM.z1 - G.RAM.z0) * 0.55 * stamp]) : "");
  const cutting = docName(cardNo), next = docName(cardNo + PER_DOC);
  setText(cover.cut, cutting.split(" ").slice(0, 2).join(" ")); setText(cover.stack, next.split(" ").slice(0, 2).join(" "));
  const [a, b] = splitName(cutting); setText(cover.read, a); setText(cover.read2, b);
}

// ---------- questions ----------
const cfg = { ctx: "ctx", search: "both", rerank: "on", k: "20", cache: "on", speed: 1 };
const T = 4.8;              // seconds per question at ×1
const WARM = 40;            // each run opens with 40 questions already answered
let qi, phase, asked, missed, lastMissed, ranks;
const key = () => (cfg.ctx === "ctx" ? 1 : 0) + "" + (cfg.search === "both" ? 1 : 0) + (cfg.rerank === "on" ? 1 : 0);
const K = () => Number(cfg.k);
function outcome(n) {
  const [first, fin] = ranks[QS[n % QS.length].i];
  const k = K(), rer = cfg.rerank === "on";
  const finalRank = rer ? fin : first;
  return { first, finalRank, rer, found: finalRank >= 0 && finalRank < k, inPool: first < (rer ? POOL : k) };
}
function restart() {
  ranks = RANKS[key()];
  asked = 0; missed = 0;
  for (let n = 0; n < WARM; n++) { asked++; if (!outcome(n).found) missed++; }
  qi = WARM; phase = 0.55; lastMissed = false;
  wordsBand.style.display = cfg.search === "both" ? "none" : "";
  rerankBand.style.display = cfg.rerank === "on" ? "none" : "";
  WB.pose(svg, "inspector", cfg.rerank === "on" ? "on" : "off");
  const ctxOn = cfg.ctx === "ctx";
  reading.style.display = ctxOn ? "" : "none"; pressOff.style.display = ctxOn ? "none" : "";
  for (const c of belt) dress(c, false, ctxOn && c.x > G.PRESS_X + 1);
  counters.k.set(K());
  paint();
}
const ordinal = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");
function paint() {
  const cur = QS[qi % QS.length], o = outcome(qi), k = K();
  const label = cur.label;
  setText(question, label);
  question.setAttribute("font-size", label.length <= 18 ? 2.8 : label.length <= 22 ? 2.4 : 2.1);
  const fetching = phase < 0.4;
  WB.pose(svg, "lamp-map", fetching ? "on" : "off");
  WB.pose(svg, "lamp-words", fetching && cfg.search === "both" ? "on" : "off");
  // the rack: candidates arrive bin by bin
  const pooled = o.rer ? POOL : k;
  const binsTotal = Math.ceil(pooled / 10);
  const shownBins = Math.max(0, Math.min(binsTotal, Math.ceil(((phase - 0.1) / 0.3) * binsTotal)));
  bins.forEach((b, i) => { const on = i < shownBins; if ((b.style.display !== "none") !== on) b.style.display = on ? "" : "none"; });
  counters.pooled.set(Math.min(pooled, shownBins * 10));
  const markerBin = o.first >= 0 && o.first < pooled ? Math.floor(o.first / 10) : -1;
  const showMarker = markerBin >= 0 && markerBin < shownBins && (phase < 0.4 || !o.found || o.rer);
  marker.g.style.display = showMarker ? "" : "none";
  if (showMarker) { marker.g.setAttribute("transform", translateAlong(P, [G.BIN_X[markerBin], G.BIN_Y, G.BIN_Z + 4.2])); dress(marker, true, cfg.ctx === "ctx"); }
  // the tray: the inspector (or search itself) passes the best k on, one by one
  const filled = phase < 0.4 ? 0 : Math.min(k, Math.ceil(((phase - 0.4) / 0.32) * k));
  const ctxOn = cfg.ctx === "ctx";
  slots.forEach((c, i) => { const on = i < filled; c.g.style.display = on ? "" : "none"; if (on) dress(c, o.found && i === o.finalRank, ctxOn); });
  // the answer's rank: where search put it, then where it ended up
  const shownRank = phase < 0.4 ? o.first : o.finalRank;
  counters.rank.set(shownRank >= 0 ? Math.min(9999, shownRank + 1) : 9999);
  // the score, counted once the tray is full
  const done = phase >= 0.75;
  const a = asked + (done ? 1 : 0), m = missed + (done && !o.found ? 1 : 0);
  counters.asked.set(a); counters.missed.set(m);
  failMeter.set(a ? Math.min(1, m / a / 0.4) : 0);
  WB.pose(svg, "miss", (done && !o.found) || (!done && lastMissed && phase < 0.1) ? "on" : "off");
  const cost = cfg.ctx === "ctx" ? COST[cfg.cache] : 0;
  costMeter.set(cost / 4);
  stat("asked", a); stat("missed", m); stat("rate", a ? (100 * m / a).toFixed(1) + "%" : "–");
  stat("rank", o.first < 0 ? "–" : o.rer ? ordinal(o.first + 1) + " → " + (o.finalRank >= 0 ? ordinal(o.finalRank + 1) : "not in the 150") : ordinal(o.first + 1));
  stat("passed", k + " chunks"); stat("cost", cfg.ctx === "ctx" ? "$" + cost.toFixed(2) + " per M tokens" : "none");
  // the readout
  const where = o.first < 0 ? "not found" : "search ranked it " + ordinal(o.first + 1) + " of ${corpus.chunks.length}";
  let text;
  if (phase < 0.4) text = "\\u201c" + cur.text + "\\u201d · " + where;
  else if (!o.found) text = (o.rer && !o.inPool ? "the answer wasn't in the first 150" : "the answer came " + ordinal((o.rer ? o.finalRank : o.first) + 1)) + " · not among the " + k + " passed on · missed";
  else text = (o.rer ? "reranked to " + ordinal(o.finalRank + 1) : "ranked " + ordinal(o.first + 1)) + " · in the " + k + " passed on to the model";
  say(text);
}
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(name, value) { const el = statEls[name]; const t = String(value); if (el && el.textContent !== t) el.textContent = t; }

function nextQuestion() {
  const o = outcome(qi);
  asked++; if (!o.found) missed++;
  lastMissed = !o.found;
  qi++; phase = 0;
}
const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => {
  const d = dt * cfg.speed;
  stepBelt(d);
  phase += d / T;
  if (phase >= 1) nextQuestion();
  paint();
}, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });

function set(name, raw, quiet) {
  WB.pressSeg(name, raw);
  if (name === "speed") { cfg.speed = Number(raw); return; }
  cfg[name] = raw;
  if (name === "cache") { paint(); return; }
  if (!quiet) restart();
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="next"]').addEventListener("click", () => { if (phase < 0.75) phase = 0.75; else nextQuestion(); paint(); });
document.querySelector('[data-act="reset"]').addEventListener("click", () => restart());
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments (computed at build time from the same model, 6 seeded corpora) ----------
const pc = (x) => x.toFixed(1) + "%";
const of30 = (x) => Math.min(1, x / 30);
const RUNS = {
  emb: () => { const r = RESULTS.emb; return { verdict: "Plain chunks: " + pc(r.plain) + " of questions missed. With the context stamped on: " + pc(r.ctx) + ", " + Math.round(100 * (1 - r.ctx / r.plain)) + "% fewer, but some are still missed.",
    bars: [["Missed, plain chunks", of30(r.plain), pc(r.plain)], ["Missed, chunks with context", of30(r.ctx), pc(r.ctx), true]] }; },
  bm25: () => { const r = RESULTS.bm25; return { verdict: "Meaning only, with context: " + pc(r.ctx) + " missed. Meaning + BM25 on the same stamped cards: " + pc(r.both) + ". The same two searches on plain cards: " + pc(r.plainBoth) + ".",
    bars: [["Meaning only, context", of30(r.ctx), pc(r.ctx)], ["Meaning + BM25, context", of30(r.both), pc(r.both), true], ["Meaning + BM25, plain", of30(r.plainBoth), pc(r.plainBoth)]] }; },
  rerank: () => { const r = RESULTS.rerank; return { verdict: "Without reranking: " + pc(r.both) + " missed. Fetch 150, rerank, keep 20: " + pc(r.reranked) + ". Reranking plain cards instead: " + pc(r.plainReranked) + ": with nothing to tell the look-alikes apart, it only reshuffles them. Overall, from plain chunks: " + pc(r.plain) + " → " + pc(r.reranked) + ".",
    bars: [["Plain, meaning only", of30(r.plain), pc(r.plain)], ["Context, meaning + BM25", of30(r.both), pc(r.both)], ["…and reranked", of30(r.reranked), pc(r.reranked), true], ["Plain, meaning + BM25, reranked", of30(r.plainReranked), pc(r.plainReranked)]] }; },
  topk: () => { const r = RESULTS.topk, top = Math.max(r.k5, 0.1); return { verdict: "Passing on 5: " + pc(r.k5) + " missed. 10: " + pc(r.k10) + ". 20: " + pc(r.k20) + ".",
    bars: [["Missed, top 5", r.k5 / top, pc(r.k5)], ["Missed, top 10", r.k10 / top, pc(r.k10)], ["Missed, top 20", r.k20 / top, pc(r.k20), true]] }; },
  cost: () => { const r = RESULTS.cost; return { verdict: "Without caching: $" + r.uncached.toFixed(2) + " per million document tokens. With caching: $" + r.cached.toFixed(2) + " (the post's estimate: $1.02). This corpus stands for " + Math.round(r.corpusTokens / 1000) + "k tokens, well over the ~200k you could just put in the prompt; one company's filings (" + Math.round(r.oneCompany / 1000) + "k) would fit.",
    bars: [["Cost without caching ($0–4)", r.uncached / 4, "$" + r.uncached.toFixed(2)], ["Cost with caching ($0–4)", r.cached / 4, "$" + r.cached.toFixed(2), true], ["This corpus (of 1.5M tokens)", Math.min(1, r.corpusTokens / 1.5e6), Math.round(r.corpusTokens / 1000) + "k"], ["Prompt budget to skip retrieval", r.budget / 1.5e6, "200k"]] }; },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  for (const n of ["ctx", "search", "rerank", "k", "cache"]) set(n, w[n], true);
  restart();
  if (loop.paused) loop.setPaused(false);
} });

for (let i = 0; i < 120; i++) stepBelt(0.1);
loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./contextual-retrieval-workbench.html", import.meta.url), {
  title: "Contextual Retrieval Workbench",
  eyebrow: "Systems lesson 39 · Contextual retrieval",
  lede: `Cut a document into chunks and most chunks forget whose document they came from: "the company's revenue grew by 3%" could be any company, any quarter. Contextual Retrieval has an LLM read the whole document and write a short context for each chunk, prepended before the chunk is embedded and indexed for keywords. This lesson runs it as a print shop: watch a machine do it, predict what each step buys, then explain it back.`,
  machine: { intro: `Reports are cut into chunk cards; a press that reads the whole report stamps each card with its context; the cards are filed by meaning and by keyword. Each question pulls candidates into the rack, an inspector reranks them, and the tray is what the model gets. Switch the context, the keyword index, the reranker and the number passed on, and watch the misses. The technique and the published numbers are from Anthropic's ${POST} (September 2024).`, figure, panel: controls },
  predict: { intro: `Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from this lesson's model (real BM25, a toy embedding, a simple reranker) over six seeded corpora; the post's measured numbers on real data are in each explanation.`, experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: `Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Technique and published results: ${POST}, Anthropic, 2024. Simulation written for this lesson.`,
  css,
  script: live,
});
console.log("wrote contextual-retrieval-workbench.html", (size / 1024).toFixed(0) + " KB");

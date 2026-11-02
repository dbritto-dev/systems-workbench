// Systems lesson 36 · Semantic search. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, studSvg, lampSvg, armSvg, beadSvg, labelSvg, P, GEOMETRY } from "./figure.mjs";
import { paraphraseRun, codeRun, chunkRun, annRun, thresholdRun, QUERIES } from "./sim.js";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- results (computed here from the same model the page runs) ----------
const R = { para: paraphraseRun(), code: codeRun(), chunk: chunkRun(), ann: annRun(), thr: thresholdRun() };
const pct = (x) => Math.round(x * 100) + "%";
const two = (x) => x.toFixed(2);

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "para",
    title: "Same meaning, no shared words",
    change: `Query "my card was charged twice" · the help centre says "Seeing the same transaction two times on your statement is usually a pending authorisation."`,
    question: "The two sentences share no words. Where does that chunk rank?",
    options: ["Nowhere near the top: there's nothing to match on", "First: the meaning is the same", "Somewhere in the top 10, behind sentences that mention cards"],
    answer: 1,
    why: `"Charged" and "transaction" both land near payments, "twice" and "two times" both near duplicates, so the two vectors point the same way although no word repeats. That is what embeddings buy you over keyword search: paraphrases, synonyms and other people's vocabulary still match. The next results are other payment sentences, close in meaning but not about duplicates.`,
    watch: { q: "twice", k: "3", size: "sentence", search: "exact", cut: "0" },
  },
  {
    id: "code",
    title: "An exact error code",
    change: `Query "ERR-4012" · one sentence in the help centre explains exactly that code`,
    question: "Is the sentence about ERR-4012 the top result?",
    options: ["No: generic sentences about errors rank above it", "Yes: it's the only chunk with that code", "It isn't found at all"],
    answer: 0,
    why: `The model has no meaning for "4012": it is a rare token that only nudges the vector a little, while "ERR" points strongly at errors in general. So the query lands on "we show an error message with a short code" and other error text, and the one sentence that names the code also talks about webhooks and secrets, which pulls its vector away. Exact identifiers, SKUs, names and numbers are where keyword search (BM25) wins, and the reason hybrid search exists.`,
    watch: { q: "err", k: "5", size: "sentence", search: "exact", cut: "0" },
  },
  {
    id: "chunk",
    title: "How big is a chunk?",
    change: "14 help-centre questions · top 3 chunks each · chunks of one sentence vs one section (heading and its sentences) vs a whole document",
    question: "Which size hands the model a usable answer most cheaply?",
    options: ["Single sentences: the smallest chunk is the most precise", "Whole documents: they never miss", "Sections: nearly every answer, at a third of the words of whole documents"],
    answer: 2,
    why: `A sentence alone can lose what it is about: "It usually takes 5 to 7 business days" is retrieved for the refund question, but without the sentence before it the model can't know what takes 5 to 7 days. Whole documents found every answer here only because each search handed over almost a third of this tiny help centre; real documents run to thousands of words, mix topics into one averaged vector, and don't fit many to a prompt. A section-sized chunk keeps its own context and stays specific.`,
    watch: { q: "refund", k: "3", size: "section", search: "exact", cut: "0" },
  },
  {
    id: "ann",
    title: "Search the graph instead of everything",
    change: `${R.ann.N.toLocaleString("en-US")} chunks · 200 queries · top 10 · compare against every chunk vs a graph index searched with a beam of 10, 40 or 160`,
    question: "With a beam of 10, how many of the true 10 nearest does the graph find?",
    options: ["All 10: it's the same nearest-neighbour search, just faster", "Fewer: it compares a few dozen chunks and stops in the right neighbourhood but not always at the nearest", "None: graphs only work on exact matches"],
    answer: 1,
    why: `Comparing against every vector is exact but costs one comparison per chunk per query. A graph index (HNSW is the usual one) links each chunk to its near neighbours and hops toward the query, so it looks at a small fraction of the collection. It can stop in a good-but-not-best spot, so recall depends on how wide the search is: the beam (ef) trades comparisons for recall. Production systems tune it until recall is high enough, and measure it against an exact search.`,
    watch: { q: "phone", k: "3", size: "section", search: "narrow", cut: "0" },
  },
  {
    id: "thr",
    title: "Keep only results above 0.80",
    change: "A fixed cutoff · five queries: one word, a vague one, one the help centre can't answer, two specific questions",
    question: "What does one fixed cutoff do across these queries?",
    options: ["It misbehaves both ways: a relevant query keeps nothing, an unanswerable one keeps confident-looking junk", "It keeps the good results and drops the junk for every query", "Nothing: every similarity above 0.80 is a good match"],
    answer: 0,
    why: `A cosine similarity says which chunks are closest to this query, not how good the match is in absolute terms. Short queries, vague ones and long ones land at different heights, and a query about something the help centre doesn't cover still has nearest neighbours, sometimes close ones. Use the ranking (top k), then a reranker or a relative rule (within some distance of the best), and test cutoffs on real queries instead of trusting one number.`,
    watch: { q: "pets", k: "5", size: "sentence", search: "exact", cut: "0.8" },
  },
];

const QUESTIONS = [
  ["What does an embedding model turn a chunk into, and why does that make paraphrases match?",
    "A list of numbers, a vector, placed so that texts with similar meaning point in similar directions. The query is embedded the same way and the closest chunks by cosine similarity win, so \"charged twice\" and \"duplicate payment\" match without sharing a word."],
  ["Your support search can't find the article for the order number a customer pasted. Why, and what do you add?",
    "Identifiers, codes, names and numbers carry little meaning for an embedding model, so the query vector lands near generic text and the exact match ranks low. Keyword search (BM25) is built for exact tokens; run both and fuse the lists (hybrid search), or route identifier-looking queries to keyword search."],
  ["How do you pick a chunk size?",
    "Small enough that one chunk is about one thing (a big chunk's vector averages its topics and wastes the prompt), big enough to carry its own context (a lone sentence like \"This cannot be undone\" is useless). Sections or a few hundred tokens with headings kept, sometimes with overlap, is a common start; then measure on real questions."],
  ["What does an approximate index like HNSW trade, and how would you know it's good enough?",
    "It hops through a graph of near neighbours instead of comparing against every vector, so it is far faster but can miss some true nearest neighbours. The search width (ef) trades comparisons for recall. Measure recall@k against an exact search on a sample of real queries and raise ef until it is high enough."],
  ["Why is a fixed similarity threshold like 0.8 a bad filter?",
    "Cosine scores aren't calibrated: their range shifts with the model, the query's length and wording, and the collection. A good match for one query can score below a bad match for another, and an unanswerable query still has close-looking neighbours. Rank, then rerank or apply a relative cutoff, and check on real queries."],
  ["Why doesn't the map on the table show the real distances?",
    "Each chunk is a point in a space with dozens of dimensions here and hundreds or thousands in real models. Squashing it onto a flat map keeps neighbourhoods roughly but bends distances, so two studs can look close and not be. The search always uses the real vectors; the map is only a picture."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Star-map table",
  keys: [
    { mark: "lit", label: "The k nearest chunks with their rank; the query lamp; the sweep arm or the graph probe" },
    { mark: "raised", label: "Chunks as studs, placed by meaning; bigger chunks are bigger studs" },
    { mark: "flat", label: "The map, with each constellation named after its topic" },
  ],
  caption:
    "Every chunk of a small help centre is a stud on the map, placed by a flat picture of its vector, so chunks with similar meaning cluster into named constellations. The query's lamp stands among the chunks it is closest to, and strings run to the k nearest, which light and show their rank. In the rack the same chunks stand in rank order with their cosine similarity on the counters. Searching every chunk sweeps an arm across the map and the console counts every comparison; with the graph index a bead hops along the links from one entry stud instead, and a dashed ring marks a true neighbour it missed. The map bends distances; the ranking always uses the real vectors.",
  stage: 'data-starmap aria-label="Semantic search simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">The embedding here is a small hand-built model (16 meaning axes, hashed rare words) so every number on the page is computed, not scripted. Real models use hundreds of dimensions learned from text.</p>`;
const controls = panel({
  stats: [["query", "Query"], ["top", "Top result"], ["sim", "Similarity"], ["compared", "Compared"], ["kept", "Kept"], ["recall", "True nearest found"]],
  controls: [
    seg("q", "Query", QUERIES.map((q) => [q.id, q.text.length > 26 ? q.text.slice(0, 24) + "…" : q.text]), "twice"),
    seg("k", "Results (k)", [["1", "1"], ["3", "3"], ["5", "5"]], "3"),
    seg("size", "Chunk", [["sentence", "Sentence"], ["section", "Section"], ["doc", "Whole document"]], "sentence"),
    seg("search", "Search", [["exact", "Every chunk"], ["narrow", "Graph, narrow"], ["wide", "Graph, wide"]], "exact"),
    seg("cut", "Cutoff", [["0", "None"], ["0.8", "0.80"]], "0"),
    speedSeg(),
    actions("Do something", [["next", "Next query"], ["pause", "Pause"]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
.iso-stage [data-layer] text{pointer-events:none}
[data-layer="links"] path{opacity:.7}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const STUD = ${JSON.stringify({ sentence: studSvg("sentence"), section: studSvg("section"), doc: studSvg("doc") })};
const LAMP_SVG = ${JSON.stringify(lampSvg())}, ARM_SVG = ${JSON.stringify(armSvg())}, BEAD_SVG = ${JSON.stringify(beadSvg())}, LABEL_SVG = ${JSON.stringify(labelSvg())};
const RESULTS = ${JSON.stringify(R)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};

const stage = document.querySelector("[data-starmap]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const NS = "http://www.w3.org/2000/svg";
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const layer = (n) => q('[data-layer="' + n + '"]');
const L = { links: layer("links"), labels: layer("labels"), rings: layer("rings"), pins: layer("pins"), probe: layer("probe"), strings: layer("strings") };
const make = (html) => { const g = document.createElementNS(NS, "g"); g.innerHTML = html; return g; };
const counters = { compared: WB.counter(svg, "compared", P), total: WB.counter(svg, "total", P), sims: [0, 1, 2, 3, 4].map((i) => WB.counter(svg, "sim" + i, P)) };
const queryText = q("[data-query]");
const slots = [0, 1, 2, 3, 4].map((i) => ({ card: q('[data-card="' + i + '"]'), body: q('[data-card="' + i + '"] .iso-solid'), text: q('[data-card-text="' + i + '"]'), cut: q('[data-cut="' + i + '"]'), lid: q('[data-lid="' + i + '"]'), simbox: q('[data-simbox="' + i + '"]'), rank: q('[data-rank="' + i + '"]') }));

// ---------- the collection at each chunk size: chunks, map positions, graph ----------
const cache = {};
function collection(size) {
  if (cache[size]) return cache[size];
  const ch = chunk(size), pos = layout(ch, G.FIELD, { gap: size === "doc" ? 17 : size === "section" ? 12 : 9 });
  const links = makeGraph(ch.map((c) => c.vec), 3, 7, 0);
  return (cache[size] = { size, ch, pos, links });
}

const lamp = make(LAMP_SVG), lampHead = lamp.querySelector("[data-head]");
const arm = make(ARM_SVG), bead = make(BEAD_SVG), pathEl = make("");
let pins = [], COL = null;

function build(size) {
  COL = collection(size);
  for (const k of ["links", "labels", "rings", "pins", "probe", "strings"]) L[k].innerHTML = "";
  pins = COL.ch.map((c, i) => {
    const g = make(STUD[size]);
    g.setAttribute("transform", translateAlong(P, [COL.pos[i][0], COL.pos[i][1], 0]));
    return { g, body: g.querySelector("[data-body]"), rank: g.querySelector("[data-rank]"), depth: depthOf([COL.pos[i][0], COL.pos[i][1], 0], P) };
  });
  // links of the graph index, drawn once per size
  const seen = new Set(), d = [];
  COL.links.forEach((ls, i) => ls.forEach((j) => { const key = i < j ? i + "-" + j : j + "-" + i; if (seen.has(key)) return; seen.add(key); d.push(segment([COL.pos[i][0], COL.pos[i][1], G.MAP_H], [COL.pos[j][0], COL.pos[j][1], G.MAP_H], P)); }));
  L.links.innerHTML = lineSvg(d.join(""), { tone: "lo", dotted: true });
  // constellation names: the topics that lead at least two chunks, printed beside their cluster where
  // no stud and no other name sits
  const groups = {}, r = G.PIN[size].r, placed = [];
  COL.ch.forEach((c, i) => (groups[c.topic] ||= []).push(i));
  const F = G.FIELD, LS = G.LABEL_SIZE;
  const clash = (cx, cy, w) => {
    const x0 = cx - w / 2 - 1, x1 = cx + w / 2 + 1, y0 = cy - LS - 0.6, y1 = cy + 1;
    let bad = 0;
    if (x0 < F.x + 2 || x1 > F.x + F.w - 2 || y0 < F.y + 2 || y1 > F.y + F.d - 2) bad += 100;
    // a stud covers its own footprint and, on screen, the strip of map just behind it
    for (const p of COL.pos) for (const [ox, oy] of [[0, 0], [-1.5, -2.5], [-3, -5]]) { const px = p[0] + ox, py = p[1] + oy, nx = Math.max(x0, Math.min(px, x1)), ny = Math.max(y0, Math.min(py, y1)); if (Math.hypot(px - nx, py - ny) < r + 0.8) { bad += 10; break; } }
    for (const b of placed) if (x0 < b[1] && x1 > b[0] && y0 < b[3] && y1 > b[2]) bad += 50;
    return [bad, [x0, x1, y0, y1]];
  };
  Object.entries(groups).sort((a, b) => b[1].length - a[1].length).forEach(([t, idx]) => {
    if (idx.length < 2 && size !== "doc") return;
    const xs = idx.map((i) => COL.pos[i][0]), ys = idx.map((i) => COL.pos[i][1]);
    const cx = xs.reduce((a, b) => a + b, 0) / idx.length, cy = ys.reduce((a, b) => a + b, 0) / idx.length;
    const w = CONCEPTS[t].length * LS * 0.62;
    const cands = [[cx, Math.max(...ys) + r + LS + 1.2], [cx, Math.min(...ys) - r - 1.4], [Math.min(...xs) - r - w / 2 - 1.5, cy + LS / 2], [Math.max(...xs) + r + w / 2 + 1.5, cy + LS / 2]];
    for (const dy of [4, 8]) cands.push([cx, Math.max(...ys) + r + LS + 1.2 + dy], [cx, Math.min(...ys) - r - 1.4 - dy]);
    let best = null;
    for (const [x, y] of cands) { const [bad, box] = clash(x, y, w); if (!best || bad < best[0]) best = [bad, x, y, box]; }
    if (best[0] >= 50) return;
    placed.push(best[3]);
    const g = make(LABEL_SVG);
    g.querySelector("[data-label]").textContent = CONCEPTS[t];
    g.setAttribute("transform", translateAlong(P, [best[1], best[2], 0]));
    L.labels.appendChild(g);
  });
  counters.total.set(COL.ch.length);
}

// ---------- one search ----------
const cfg = { q: "twice", k: 3, size: "sentence", search: "exact", cut: 0, speed: 1 };
const MOVE = 0.9, STEP = 0.06, HOLD = 5.5;
let run = null, clock = 0, lampAt = null;

function plan() {
  const query = QUERIES.find((x) => x.id === cfg.q), qv = embed(query.text);
  const ex = exact(qv, COL.ch, COL.ch.length).hits;
  let res, order, hops = [];
  if (cfg.search === "exact") { res = ex.slice(0, cfg.k); order = COL.ch.map((_, i) => i).sort((a, b) => COL.pos[a][0] - COL.pos[b][0]); }
  else { const r = graphSearch(qv, COL.ch.map((c) => c.vec), COL.links, { ef: cfg.search === "wide" ? cfg.k * 4 : cfg.k, k: cfg.k, entry: 0 }); res = r.hits; order = r.order; hops = r.hops; }
  const truth = ex.slice(0, cfg.k).map((h) => h.i);
  // the lamp stands among its three nearest, nudged off any stud
  const w = ex.slice(0, 3).map((h) => [h.i, Math.pow(Math.max(h.s, 0.01), 6)]), ws = w.reduce((s, [, x]) => s + x, 0);
  let at = [w.reduce((s, [i, x]) => s + COL.pos[i][0] * x, 0) / ws, w.reduce((s, [i, x]) => s + COL.pos[i][1] * x, 0) / ws];
  for (let it = 0; it < 30; it++) for (const p of COL.pos) { const dx = at[0] - p[0], dy = at[1] - p[1], d = Math.hypot(dx, dy) || 0.01, min = G.PIN[cfg.size].r + 4.5; if (d < min) { at[0] += dx / d * (min - d) * 0.6; at[1] += dy / d * (min - d) * 0.6; } }
  return { query, qv, res, order, hops, truth, at, from: lampAt || at, t0: clock, searchEnd: MOVE + order.length * STEP };
}

function start(fresh) {
  if (fresh) build(cfg.size);
  run = plan();
  queryText.textContent = run.query.text;
  L.strings.innerHTML = ""; L.rings.innerHTML = ""; L.probe.innerHTML = "";
  pathEl.innerHTML = ""; L.links.appendChild(pathEl);
  if (cfg.search === "exact") L.probe.appendChild(arm); else L.probe.appendChild(bead);
  L.links.style.display = cfg.search === "exact" ? "none" : "";
  run.shown = false;
}

function setLit(el, on) { if (el && el.hasAttribute("data-lit") !== on) el.toggleAttribute("data-lit", on); }

function paint() {
  const t = clock - run.t0;
  // lamp glides to the query's place
  const f = Math.min(1, t / MOVE), e = f * f * (3 - 2 * f);
  lampAt = [run.from[0] + (run.at[0] - run.from[0]) * e, run.from[1] + (run.at[1] - run.from[1]) * e];
  lamp.setAttribute("transform", translateAlong(P, [lampAt[0], lampAt[1], 0]));
  // the search: compared so far, the arm or the bead
  const n = run.order.length, done = Math.max(0, Math.min(n, Math.floor((t - MOVE) / STEP) + 1));
  const searching = t >= MOVE && t < run.searchEnd, finished = t >= run.searchEnd;
  const flash = new Set();
  if (t >= MOVE) {
    if (cfg.search === "exact") {
      const x0 = G.FIELD.x, x1 = G.FIELD.x + G.FIELD.w, ax = x0 + (x1 - x0) * Math.min(1, (t - MOVE) / (n * STEP));
      arm.setAttribute("transform", translateAlong(P, [ax, 0, 0]));
      arm.style.display = finished ? "none" : "";
      run.order.forEach((i) => { if (Math.abs(COL.pos[i][0] - ax) < 5 && !finished) flash.add(i); });
    } else {
      const step = Math.min(n - 1, Math.max(0, (t - MOVE) / STEP)), i = Math.floor(step), frac = step - i;
      const a = i === 0 ? run.order[0] : run.hops[i - 1][0], b = i === 0 ? run.order[0] : run.hops[i - 1][1];
      const pa = COL.pos[a], pb = COL.pos[b];
      bead.setAttribute("transform", translateAlong(P, [pa[0] + (pb[0] - pa[0]) * frac, pa[1] + (pb[1] - pa[1]) * frac, 0]));
      bead.style.display = finished ? "none" : "";
      if (!finished) flash.add(b);
      const upto = finished ? run.hops.length : i;
      if (run.drawn !== upto) { run.drawn = upto; pathEl.innerHTML = lineSvg(run.hops.slice(0, upto).map(([a2, b2]) => segment([COL.pos[a2][0], COL.pos[a2][1], G.MAP_H + 0.1], [COL.pos[b2][0], COL.pos[b2][1], G.MAP_H + 0.1], P)).join(""), { tone: "hi" }); }
    }
  } else { arm.style.display = "none"; bead.style.display = "none"; }
  counters.compared.set(t < MOVE ? 0 : done);

  // results once the search is over
  const kept = finished ? run.res.filter((h) => h.s >= cfg.cut) : [];
  const keptSet = new Map(kept.map((h, r) => [h.i, run.res.indexOf(h) + 1]));
  pins.forEach((p, i) => {
    setLit(p.body, flash.has(i) || keptSet.has(i));
    const r = keptSet.get(i); const txt = r ? String(r) : "";
    if (p.rank.textContent !== txt) p.rank.textContent = txt;
  });
  setLit(lampHead, finished);
  if (finished && !run.shown) {
    run.shown = true;
    const top = G.LAMP_TOP;
    L.strings.innerHTML = lineSvg(kept.map((h) => segment([run.at[0], run.at[1], top], [COL.pos[h.i][0], COL.pos[h.i][1], G.MAP_H + G.PIN[cfg.size].h], P)).join(""), { tone: "hi" });
    const missed = run.truth.filter((i) => !run.res.some((h) => h.i === i));
    L.rings.innerHTML = missed.map((i) => lineSvg(ring(COL.pos[i][0], COL.pos[i][1], G.PIN[cfg.size].r + 2.4, G.MAP_H, P), { tone: "hi", dashed: true })).join("");
  }
  if (!finished && run.shown) { run.shown = false; L.strings.innerHTML = ""; L.rings.innerHTML = ""; }
  // the rack
  slots.forEach((s, r) => {
    const used = r < cfg.k;
    s.lid.style.display = used ? "none" : "";
    s.simbox.style.display = used ? "" : "none";
    s.rank.style.opacity = used ? "" : "0";
    const h = finished && used ? run.res[r] : null;
    s.card.style.display = h && h.s >= cfg.cut ? "" : "none";
    s.cut.style.display = h && h.s < cfg.cut ? "" : "none";
    if (h) { const id = COL.ch[h.i].id; if (s.text.textContent !== id) s.text.textContent = id; setLit(s.body, r === 0 && h.s >= cfg.cut); }
    counters.sims[r].set(h ? Math.min(99, Math.round(h.s * 100)) : 0);
  });
  // pins and lamp in depth order
  const items = pins.map((p) => [p.depth, p.g]).concat([[depthOf([lampAt[0], lampAt[1], 0], P) + 0.001, lamp]]).sort((a, b) => a[0] - b[0]);
  let ok = L.pins.childNodes.length === items.length;
  if (ok) items.forEach(([, g], i) => { if (L.pins.childNodes[i] !== g) ok = false; });
  if (!ok) items.forEach(([, g]) => L.pins.appendChild(g));

  // stats and readout
  const best = run.res[0], found = run.truth.filter((i) => run.res.some((h) => h.i === i)).length;
  stat("query", "\\u201c" + run.query.text + "\\u201d");
  stat("top", finished ? COL.ch[best.i].id + " \\u00b7 " + COL.ch[best.i].text : "searching");
  stat("sim", finished ? best.s.toFixed(2) : "-");
  stat("compared", (t < MOVE ? 0 : done) + " of " + COL.ch.length);
  stat("kept", finished ? kept.length + " of " + cfg.k + (cfg.cut ? " (cutoff " + cfg.cut.toFixed(2) + ")" : "") : "-");
  stat("recall", finished ? found + " of " + cfg.k : "-");
  if (t < MOVE) say("embedding the query \\u00b7 \\u201c" + run.query.text + "\\u201d");
  else if (searching) say((cfg.search === "exact" ? "comparing with every chunk \\u00b7 " : "hopping through the graph \\u00b7 ") + done + " of " + COL.ch.length + " compared");
  else if (cfg.cut && kept.length < cfg.k) say(kept.length + " of " + cfg.k + " above the cutoff \\u00b7 best " + best.s.toFixed(2));
  else say("top " + COL.ch[best.i].id + " \\u00b7 " + best.s.toFixed(2) + " \\u00b7 " + n + " compared" + (found < cfg.k ? " \\u00b7 missed " + (cfg.k - found) + " true neighbour" + (cfg.k - found > 1 ? "s" : "") : ""));
  if (t > run.searchEnd + HOLD) { next(); }
}
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(key, value) { const el = statEls[key]; const text = String(value); if (el && el.textContent !== text) el.textContent = text; }

function next() {
  const i = QUERIES.findIndex((x) => x.id === cfg.q);
  cfg.q = QUERIES[(i + 1) % QUERIES.length].id; WB.pressSeg("q", cfg.q);
  start(false);
}

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; paint(); }, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });

function set(name, raw, quiet) {
  WB.pressSeg(name, raw);
  if (name === "speed") { cfg.speed = Number(raw); return; }
  cfg[name] = name === "k" || name === "cut" ? Number(raw) : raw;
  if (quiet) return;
  start(name === "size");
  if (loop.paused) { clock = run.t0 + run.searchEnd + 0.01; paint(); }
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="next"]').addEventListener("click", () => { next(); if (loop.paused) { clock = run.t0 + run.searchEnd + 0.01; paint(); } });
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments (computed from the same model) ----------
const n0 = (x) => String(Math.round(x));
const RUNS = {
  para: () => {
    const p = RESULTS.para;
    return { verdict: "Rank " + p.rank + ": \\u201c" + p.text + "\\u201d at " + p.sim.toFixed(2) + ", with " + p.shared + " words in common. Next: " + p.hits.slice(1, 4).map((h) => h.id + " " + h.s.toFixed(2)).join(", ") + ", other payment sentences.",
      bars: p.hits.slice(0, 4).map((h, i) => [h.id + (i === 0 ? " (duplicate charges)" : ""), h.s, h.s.toFixed(2), i === 0]) };
  },
  code: () => {
    const c = RESULTS.code;
    return { verdict: "The sentence that explains ERR-4012 came " + c.rank + "th at " + c.targetSim.toFixed(2) + ". Above it: " + c.hits.slice(0, 2).map((h) => "\\u201c" + h.text + "\\u201d " + h.s.toFixed(2)).join(" and ") + ".",
      bars: c.hits.map((h) => [h.id + (h.id === "E3.1" ? " (the ERR-4012 sentence)" : ""), h.s, h.s.toFixed(2), h.id === "E3.1"]) };
  },
  chunk: () => {
    const c = RESULTS.chunk, s = c.sentence, m = c.section, d = c.doc;
    return { verdict: "Sentences: " + s.found + " of " + s.of + " usable (" + s.ctxLost + " found without the sentence that says what it's about), " + n0(s.words) + " words handed over. Sections: " + m.found + " of " + m.of + ", " + n0(m.words) + " words. Whole documents: " + d.found + " of " + d.of + ", but " + n0(d.words) + " words, " + Math.round(d.share * 100) + "% of the whole help centre, every time.",
      bars: [["Usable answers, sentence", s.found / s.of, s.found + "/" + s.of], ["Usable answers, section", m.found / m.of, m.found + "/" + m.of, true], ["Usable answers, whole doc", d.found / d.of, d.found + "/" + d.of],
        ["Words handed over, sentence", s.words / 160, n0(s.words)], ["Words handed over, section", m.words / 160, n0(m.words), true], ["Words handed over, whole doc", d.words / 160, n0(d.words)]] };
  },
  ann: () => {
    const a = RESULTS.ann, N = a.N;
    return { verdict: "Every chunk: " + N.toLocaleString("en-US") + " comparisons, all 10 found. Graph, beam 10: " + n0(a.ef10.compared) + " comparisons, " + Math.round(a.ef10.recall * 100) + "% of the true 10. Beam 40: " + n0(a.ef40.compared) + ", " + Math.round(a.ef40.recall * 100) + "%. Beam 160: " + n0(a.ef160.compared) + ", " + Math.round(a.ef160.recall * 100) + "%.",
      bars: [["Recall@10, beam 10", a.ef10.recall, Math.round(a.ef10.recall * 100) + "%", true], ["Recall@10, beam 40", a.ef40.recall, Math.round(a.ef40.recall * 100) + "%"], ["Recall@10, beam 160", a.ef160.recall, Math.round(a.ef160.recall * 100) + "%"],
        ["Comparisons, beam 10", a.ef10.compared / N, n0(a.ef10.compared)], ["Comparisons, beam 160", a.ef160.compared / N, n0(a.ef160.compared)], ["Comparisons, every chunk", 1, N.toLocaleString("en-US")]] };
  },
  thr: () => {
    const rows = RESULTS.thr;
    const line = (r) => "\\u201c" + r.text + "\\u201d: " + r.kept + " kept" + (r.kept ? " (" + r.good + " relevant)" : "") + ", best " + r.top.toFixed(2);
    return { verdict: rows.map(line).join(" \\u00b7 ") + ".",
      bars: rows.map((r) => [r.text.length > 34 ? r.text.slice(0, 32) + "\\u2026" : r.text, Math.min(1, r.kept / 5), r.kept + " kept, " + r.junk + " junk" + (r.gold && !r.good ? ", answer dropped" : ""), r.junk > 0 || (r.gold > 0 && r.good === 0)]) };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch, sizeChanged = w.size !== cfg.size;
  set("q", w.q, true); set("k", w.k, true); set("size", w.size, true); set("search", w.search, true); set("cut", w.cut, true);
  start(sizeChanged || !COL);
  if (loop.paused) loop.setPaused(false);
} });

// first frame: the first query already answered, so a still page shows a finished search
build(cfg.size);
start(false);
clock = run.searchEnd + 0.4;
loop.setPaused(loop.paused);
paint();
`;

const size = writePage(new URL("./semantic-search-workbench.html", import.meta.url), {
  title: "Semantic Search Workbench",
  eyebrow: "Systems lesson 36 · Semantic search",
  lede: "Semantic search finds text by meaning instead of by matching words. An embedding model turns every chunk of your documents into a vector, the query into another, and the chunks pointing the same way as the query come back first. This lesson lays a help centre out as a star map: watch a query find its neighbours, predict where meaning-matching fails, then explain it back.",
  machine: { intro: "Each stud is a chunk of the help centre, placed so that chunks with similar meaning sit together. Each query lamp stands among its nearest chunks; strings mark the k nearest, and the rack lists them with their cosine similarity. Try the error-code query, bigger chunks, the graph index and the 0.80 cutoff.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same embedding and the same search as the machine.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: `Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Toy embedding model and help centre written for this lesson.`,
  css,
  script: live,
});
console.log("wrote semantic-search-workbench.html", (size / 1024).toFixed(0) + " KB");

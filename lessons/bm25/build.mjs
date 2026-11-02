// Systems lesson 35 · BM25. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
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
    title: "A common word against a rare one",
    change: "Query “the printer” · D35, the office guide, says “the” " + R.rare.guideThe + " times and never “printer” · D06, a printer checklist, says “printer” once",
    question: "Which of the two ranks higher?",
    options: ["D35: " + R.rare.guideThe + " matches beat one", "D06, by far: “the” is in every document, so it weighs almost nothing", "They tie: each matches one query term"],
    answer: 1,
    why: "IDF is about how many documents a term appears in. “the” is in all " + R.rare.N + ", so its IDF is " + f2(R.rare.idfThe) + "; “printer” is in " + R.rare.dfPrinter + ", so its IDF is " + f2(R.rare.idfPrinter) + ", about 140 times heavier. Repeating a feather " + R.rare.guideThe + " times still gives a feather. On the bench, “the” is a weight you can barely see, and D35's pan gets a disc too thin to read.",
    watch: { q: "the printer", k1: "1.2", b: "0.75" },
  },
  {
    id: "stuff",
    title: "Keyword stuffing",
    change: "D16 (“Cheap flights to Lisbon …”) repeats “cheap” 20 times instead of once · query “cheap flights” · k1 = 1.2, b = 0.75",
    question: "How much bigger does the “cheap” part of D16's score get?",
    options: ["About 20 times bigger", "About " + f1(R.stuff.k12[5].s / R.stuff.k12[0].s) + " times, and the last few repeats add almost nothing", "Not at all: only the first occurrence counts"],
    answer: 1,
    why: "BM25 bends term frequency toward a ceiling of IDF × (k1 + 1): with k1 = 1.2 the “cheap” part goes " + f2(R.stuff.k12[0].s) + " → " + f2(R.stuff.k12[3].s) + " at 5 repeats → " + f2(R.stuff.k12[5].s) + " at 20, against a ceiling of " + f2(R.stuff.cap12) + ". Each repeat also makes D16 longer, which costs it a little more. k1 = 0 ignores repeats entirely (only presence counts); k1 = 3 lets them count for longer (" + f2(R.stuff.k3[5].s) + " at 20). Raw term frequency, as in plain TF-IDF, would have gone up 20×.",
    watch: { q: "cheap flights", k1: "1.2", b: "0.75", stuff: true },
  },
  {
    id: "length",
    title: "A short and a long document",
    change: "Query “kernel panic” · D03 (" + R.length.lenShort + " words) and D36 (" + R.length.lenLong + " words) each say “kernel” once and “panic” once · the average document is " + f1(R.length.avg) + " words · b = 0.75",
    question: "How do their scores compare?",
    options: ["The same: identical matches", "D03 scores about " + f1(R.length.b75.ratio) + " times as much as D36", "D36 scores more: it has more text about the topic"],
    answer: 1,
    why: "A match in a short document says more about what the document is about than the same match lost in a long one. b decides how much length counts: with b = 0 both score " + f2(R.length.b0.short) + "; with b = 0.75 D03 scores " + f2(R.length.b75.short) + " and D36 " + f2(R.length.b75.long) + "; with b = 1 the gap grows to " + f1(R.length.b1.ratio) + "×. On the bench, look at the LEN gauges: the needle stands at the middle for an average length.",
    watch: { q: "kernel panic", k1: "1.2", b: "0.75" },
  },
  {
    id: "exact",
    title: "An error code, and the same problem in other words",
    change: "D08 is the article about ERR_CONNECTION_RESET · query 1: “ERR_CONNECTION_RESET” · query 2: “browser keeps dropping the link to the website”",
    question: "Where does D08 rank for each query?",
    options: ["First for both", "First for the code, by a wide margin; " + R.exact.paraRank + "th for the description, below articles that share “link” or “website”", "Low for the code: a single word is not enough evidence"],
    answer: 1,
    why: "The code is one rare token that appears in exactly one document, so D08 scores " + f2(R.exact.codeScore) + " and everything else 0: exact identifiers, product numbers and error strings are what BM25 is best at. The description shares no word with D08 except “the”, so D08 scores " + f2(R.exact.paraScore) + " and the top result is " + R.exact.paraTop + ", which matched “" + R.exact.paraTopTerms.filter((t) => t !== "the").join("”, “") + "”. BM25 matches words, not meaning: that vocabulary gap is what semantic search (lesson 36) closes, and why hybrid search (lesson 38) runs both.",
    watch: { q: "browser keeps dropping the link to the website", k1: "1.2", b: "0.75" },
  },
  {
    id: "stop",
    title: "Adding “the” to the query",
    change: "Query “kernel panic” → “the kernel panic” · no stop-word list",
    question: "What happens to the top five?",
    options: ["Documents with lots of “the” move up", "Nothing: same five in the same order; the top score rises by " + f2(R.stop.gain), "Every score roughly halves, because the query got longer"],
    answer: 1,
    why: "BM25 needs no stop-word list for this: “the” is in all " + R.stop.N + " documents, so its IDF is " + f2(R.stop.idfThe) + " against " + f2(R.stop.idfKernel) + " for “kernel”. Words in the middle are another matter: “on” is in 15 of 36 documents and still adds about 0.9 a match. Stop-word lists still help an index's size and speed, and matter more for short fields.",
    watch: { q: "the kernel panic", k1: "1.2", b: "0.75" },
  },
];

const QUESTIONS = [
  ["Why does a rare query term count for more than a common one?",
    "BM25 weights every term by its inverse document frequency, IDF = ln(1 + (N − n + 0.5)/(n + 0.5)), where n is how many of the N documents contain it. A term in one document out of 36 gets about 3.2; a term in all of them gets almost 0. Matching a rare term is strong evidence a document is about the query; matching a word every document has is no evidence at all."],
  ["What does k1 control, and why does BM25 stop rewarding repetition?",
    "k1 sets how fast term frequency saturates. A term's part is IDF × tf(k1+1)/(tf + k1·…), which climbs fast for the first few occurrences and then flattens toward IDF × (k1+1). k1 = 0 counts only presence; higher k1 lets repeats count longer. Typical values are 1.2 to 2.0. It's why stuffing a page with a keyword stops paying: the 20th repeat adds almost nothing."],
  ["What does b do, and when would you lower it?",
    "b (0 to 1, usually 0.75) scales term frequency by the document's length against the average, so a match in a short document counts more than the same match in a long one. b = 0 ignores length. Lower b when length doesn't mean a document is less focused (a field of uniformly short titles, or long documents that really are about one thing); raise it when long documents tend to mention everything."],
  ["Why is BM25 so good at error codes, SKUs and names, and so bad at “my browser keeps dropping the connection”?",
    "It matches exact tokens and gives a rare token a huge weight, so a code that appears in one document ranks it first. But a query that describes the problem in other words shares no tokens with the right document and scores it near zero. Stemming, synonym lists and query expansion narrow the gap a little; semantic (embedding) search closes it, and hybrid search combines both."],
  ["Do you need a stop-word list with BM25? What else in the text pipeline changes the scores?",
    "Not for ranking: IDF already makes words like “the” nearly weightless, though mid-frequency words (“on”, “to”) still add a little. Stop-word lists mostly save index space. What matters more is tokenisation and normalisation: whether ERR_CONNECTION_RESET stays one token or splits into three, lowercasing, accents, and stemming (“printers” vs “printer”). Index and query must be processed the same way."],
  ["Your search engine says one result scored 12.4 and another query's best scored 3.1. Is the first one a better match?",
    "You can't tell. BM25 scores depend on the query's terms, their IDFs and the corpus, so they are only comparable within one query on one index. That's why systems that merge BM25 with another ranker (for example vector search) usually combine ranks, not raw scores: Reciprocal Rank Fusion (lesson 37). Elasticsearch, OpenSearch and Lucene use BM25 with k1 = 1.2 and b = 0.75 as their default similarity."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Assay bench",
  keys: [
    { mark: "lit", label: "The weight being placed, and its discs falling; the winning pan" },
    { mark: "raised", label: "A weight per query term, bigger for rarer terms; a disc per matched term in each pan" },
    { mark: "flat", label: "Scales: rank, document, score wheels, length gauge" },
  ],
  caption:
    "Each query term stands on the rack as a weight sized by its IDF: a term found in few documents is a big weight, a word found everywhere a sliver. The five scales hold the five best documents, best on the left. For every term a document contains, a disc the size of that term's weight goes into its pan, and the disc's thickness is what the term adds to the score: repeats make it thicker, but less and less; a long document gets a thinner disc. The stack is the score, read on the wheels; the LEN gauge's needle stands at the middle for a document of average length.",
  stage: 'data-bench aria-label="BM25 scoring simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const RESULTS_BOX = `<div class="bm-results" data-results aria-live="polite"></div>`;
const controls = panel({
  stats: [["terms", "Query terms"], ["matched", "Documents matched"], ["top", "Top score"], ["topdoc", "Top document"]],
  controls: [
    seg("q", "Query", [["panic", "kernel panic on boot"], ["code", "ERR_CONNECTION_RESET"], ["printer", "printer offline"], ["para", "paraphrase"], ["the", "the kernel panic"], ["cheap", "cheap flights"]], "panic"),
    seg("k1", "k1 (repeats)", [["0", "0"], ["1.2", "1.2"], ["2", "2"], ["3", "3"]], "1.2"),
    seg("b", "b (length)", [["0", "0"], ["0.75", "0.75"], ["1", "1"]], "0.75"),
    speedSeg(),
    actions("Do something", [["stuff", "Stuff “cheap” ×20 into D16"], ["again", "Weigh again"], ["reset", "Start over"], ["pause", "Pause"]]),
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
  corpusEl.textContent = ix.N + " documents · average " + ix.avg.toFixed(1) + " words · k1 " + cfg.k1 + " · b " + cfg.b + (cfg.stuff ? " · D16 stuffed" : "");
  drawRack(-1);
  for (let i = 0; i < 5; i++) {
    const row = plan.top[i];
    docEls[i].textContent = row ? row.id : "—";
    lenM[i].set(row ? Math.min(1, row.len / (2 * ix.avg)) : 0);
  }
  drawResults();
  stat("terms", n);
  stat("matched", plan.rows.filter((r) => r.score > 0).length + " of " + ix.N);
  stat("top", plan.top[0] ? plan.top[0].score.toFixed(2) : "0");
  stat("topdoc", plan.top[0] ? plan.top[0].id : "none");
  paint();
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
  const head = '<div class="head">Top five for “' + escapeHtml(cfg.q) + '”, with each term’s part of the score</div>';
  if (!plan.top.length) { resultsEl.innerHTML = head + '<div class="none">No document contains any of the query’s words.</div>'; return; }
  resultsEl.innerHTML = head + plan.top.map((r, i) => {
    const tx = r.id === "D16" && cfg.stuff ? "Cheap cheap cheap … (×20) " + r.text.slice(6) : r.text;
    const parts = r.parts.filter((p) => p.tf).map((p) => p.term + " ×" + p.tf + " → " + p.score.toFixed(2)).join(" · ");
    return '<div class="row"><span class="rk">#' + (i + 1) + '</span><span class="id">' + r.id + '</span><span class="tx">' + mark(tx) + '</span><span class="sc">' + r.score.toFixed(2) + '</span><span class="parts">' + escapeHtml(parts) + ' · ' + r.len + ' words</span></div>';
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

  if (tt < 0) say("clearing the pans · next query: “" + cfg.q + "”");
  else if (!holding) {
    const s = slots[active], hits = plan.top.filter((r) => r.parts[active].tf).length;
    const all = plan.rows.filter((r) => r.parts[active].tf).length;
    say("weighing “" + s.term + "” · idf " + s.idf.toFixed(2) + " · in " + all + " of " + ix.N + " documents" + (hits ? " · " + hits + " of the top five" : ""));
  } else say(plan.top[0] ? "ranked · " + plan.top[0].id + " first with " + plan.top[0].score.toFixed(2) : "ranked · no document matched");
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
}, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });

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
function setStuff(on) { cfg.stuff = on; stuffBtn.textContent = on ? "Un-stuff D16" : "Stuff “cheap” ×20 into D16"; }
stuffBtn.addEventListener("click", () => { setStuff(!cfg.stuff); cfg.tour = false; if (!cfg.stuff || cfg.qid === "cheap") start(0); else { setQuery("cheap"); start(0); } if (loop.paused) loop.setPaused(false); });
document.querySelector('[data-act="again"]').addEventListener("click", () => { start(0); if (loop.paused) loop.setPaused(false); });
document.querySelector('[data-act="reset"]').addEventListener("click", () => { setStuff(false); cfg.k1 = 1.2; cfg.b = 0.75; WB.pressSeg("k1", "1.2"); WB.pressSeg("b", "0.75"); cfg.tour = true; setQuery("panic", true); start(WARM); });
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments (numbers computed from the same model) ----------
const n2 = (x) => x.toFixed(2);
const RUNS = {
  rare: () => {
    const r = RESULTS.rare, top = r.idfPrinter;
    return { verdict: "IDF of “the” (in all " + r.N + " documents): " + n2(r.idfThe) + ". IDF of “printer” (in " + r.dfPrinter + "): " + n2(r.idfPrinter) + ". D35 scored " + n2(r.guideScore) + " with " + r.guideThe + " matches and ranked " + r.guideRank + "th; D06 scored " + n2(r.d06Score) + " and ranked " + r.d06Rank + "rd.",
      bars: [["IDF of “the”", r.idfThe / top, n2(r.idfThe)], ["IDF of “printer”", 1, n2(r.idfPrinter), true], ["D35 score (17 × “the”)", r.guideScore / r.d06Score, n2(r.guideScore)], ["D06 score (1 × “printer”)", 1, n2(r.d06Score), true]] };
  },
  stuff: () => {
    const s = RESULTS.stuff, top = s.k3[5].s;
    const at = (c, n) => c.find((p) => p.n === n).s;
    return { verdict: "With k1 = 1.2 the “cheap” part went " + n2(at(s.k12, 1)) + " (once) → " + n2(at(s.k12, 5)) + " (5 times) → " + n2(at(s.k12, 20)) + " (20 times): " + (at(s.k12, 20) / at(s.k12, 1)).toFixed(1) + "×, against a ceiling of " + n2(s.cap12) + ". With k1 = 0 it stayed " + n2(at(s.k0, 20)) + "; with k1 = 3 it reached " + n2(at(s.k3, 20)) + ".",
      bars: [["k1 1.2, once", at(s.k12, 1) / top, n2(at(s.k12, 1))], ["k1 1.2, 5 times", at(s.k12, 5) / top, n2(at(s.k12, 5))], ["k1 1.2, 20 times", at(s.k12, 20) / top, n2(at(s.k12, 20)), true], ["k1 0, 20 times", at(s.k0, 20) / top, n2(at(s.k0, 20))], ["k1 3, 20 times", at(s.k3, 20) / top, n2(at(s.k3, 20))]] };
  },
  length: () => {
    const l = RESULTS.length, top = l.b1.short;
    return { verdict: "b = 0: both " + n2(l.b0.short) + ". b = 0.75: D03 " + n2(l.b75.short) + ", D36 " + n2(l.b75.long) + " (" + l.b75.ratio.toFixed(1) + "×). b = 1: D03 " + n2(l.b1.short) + ", D36 " + n2(l.b1.long) + " (" + l.b1.ratio.toFixed(1) + "×).",
      bars: [["D03, " + l.lenShort + " words, b 0.75", l.b75.short / top, n2(l.b75.short), true], ["D36, " + l.lenLong + " words, b 0.75", l.b75.long / top, n2(l.b75.long), true], ["Either, b 0", l.b0.short / top, n2(l.b0.short)], ["D36, b 1", l.b1.long / top, n2(l.b1.long)]] };
  },
  exact: () => {
    const e = RESULTS.exact, top = Math.max(e.codeScore, e.paraTopScore);
    return { verdict: "“ERR_CONNECTION_RESET”: D08 ranked " + e.codeRank + "st with " + n2(e.codeScore) + "; the next document scored " + n2(e.codeNext) + ". The description: D08 ranked " + e.paraRank + "th with " + n2(e.paraScore) + " (it shares only “" + e.paraShared.join("”, “") + "”); " + e.paraTop + " came first with " + n2(e.paraTopScore) + ".",
      bars: [["D08, error code query", e.codeScore / top, n2(e.codeScore), true], ["D08, description query", e.paraScore / top, n2(e.paraScore), true], [e.paraTop + " (wrong), description query", e.paraTopScore / top, n2(e.paraTopScore)]] };
  },
  stop: () => {
    const s = RESULTS.stop;
    return { verdict: "Top five with and without “the”: " + (s.same ? "identical" : "different") + " (" + s.order.join(", ") + "). Top score " + n2(s.topA) + " → " + n2(s.topB) + ". IDF of “the”: " + n2(s.idfThe) + "; of “kernel”: " + n2(s.idfKernel) + ".",
      bars: [["Top score, “kernel panic”", s.topA / s.topB, n2(s.topA)], ["Top score, “the kernel panic”", 1, n2(s.topB), true], ["IDF of “the”", s.idfThe / s.idfKernel, n2(s.idfThe)], ["IDF of “kernel”", 1, n2(s.idfKernel)]] };
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
  title: "BM25 Workbench",
  eyebrow: "Systems lesson 35 · BM25",
  lede: "BM25 is the ranking behind most keyword search: it adds up, for every query word a document contains, how rare the word is, how often the document uses it (with diminishing returns) and how long the document is. It's fast, needs no training and is unbeatable on exact codes and names, but it only matches words, not meaning. This lesson weighs documents on an assay bench: watch a machine do it, predict what changes the ranking, then explain it back.",
  machine: { intro: "The query's words stand on the rack as weights: a word found in few documents is a big weight, a word found everywhere a sliver. The assayer places them one at a time, and each of the five best documents gets a disc in its pan for every query word it contains. The disc's thickness is what that word adds to the score, so the stack is the score. Try the queries, k1 (how much repeats count) and b (how much length counts), and stuff a keyword into D16.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same BM25 code as the machine, on the same 36 documents.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: `Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). BM25 as in Robertson and Zaragoza, “The Probabilistic Relevance Framework: BM25 and Beyond” (2009), with the IDF used by Lucene. Simulation written for this lesson.`,
  css,
  script: live,
});
console.log("wrote bm25-workbench.html", (size / 1024).toFixed(0) + " KB");

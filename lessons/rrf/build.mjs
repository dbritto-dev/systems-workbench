// Systems lesson 37 · Reciprocal rank fusion. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, clerkSvg, flightSvg, P, GEOMETRY } from "./figure.mjs";
import { QUERY, expScales, expAgreement, expK, expNoisy, expDepth } from "./sim.js";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- results (computed once here from the same model the page runs) ----------
const R = { scales: expScales(), agree: expAgreement(), k: expK(), noisy: expNoisy(), depth: expDepth() };

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "scales",
    title: "Add the raw scores, or fuse the ranks",
    change: "Keyword scores run from about 4 to 30, meaning scores (cosine similarity) from 0.2 to 0.9 · top 20 from each · raw sum vs RRF with k = 60 · 40 queries, 10 relevant documents each",
    question: "How many relevant documents does each put in the top 10?",
    options: ["About the same: the raw sum even keeps more information than the ranks do", "The raw sum is barely better than keyword search alone; RRF beats both rankers", "The raw sum wins: a big score means a confident judge"],
    answer: 1,
    why: "A keyword score of 20 and a cosine of 0.8 are on different scales, so adding them is just keyword search with a little noise: the meaning ranker can move a document by less than one keyword point. RRF throws the scores away and keeps only each ranker's order, so both rankers count equally and documents that either one finds well can reach the top. Normalising the scores first (min-max, z-scores) helps, but it depends on what else came back for that query; ranks need no calibration.",
    watch: { mode: "raw", k: 60, judges: 2, weight: 1, depth: 8 },
  },
  {
    id: "agree",
    title: "Two good ranks or one first place",
    change: `The figure's query, top 8 from each ballot, k = 60 · D1 is 3rd for keyword and 4th for meaning · D2 is 1st for keyword and not on the meaning ballot at all`,
    question: "Which document finishes higher?",
    options: ["D2: a first place beats anything", "D1, with almost twice D2's score", "They tie: each had one strong vote"],
    answer: 1,
    why: "With k = 60 a first place is worth 1/61 and a 3rd or 4th place nearly as much (1/63, 1/64), so a document both rankers like collects two nearly full votes, while a document only one ranker likes collects one. That is the point of fusion: agreement between rankers that look at a document differently is strong evidence. D2 (\"Reset your login password\") is a typical keyword false positive: it shares the words but not the question.",
    watch: { mode: "rrf", k: 60, judges: 2, weight: 1, depth: 8 },
  },
  {
    id: "k",
    title: "Turning k",
    change: "The same two ballots · k = 1, 60, 1000 · and the average over 40 queries",
    question: "What happens to the top five at k = 1?",
    options: ["Nothing: k only rescales every score", "The single first places jump to the top: D2 and D5 lead, and a relevant document drops out of the five", "Ranks stop mattering, so the order turns random"],
    answer: 1,
    why: "k sets how much the top of each list dominates. A first place is worth (k + 10) / (k + 1) times a 10th place: 5.5× at k = 1, 1.15× at k = 60, 1.01× at k = 1000. Small k rewards whatever any one ranker put first; large k mostly counts how many lists a document is on. 60, from the original paper, sits between and holds up well across collections, which is why it is the default nearly everywhere.",
    watch: { mode: "rrf", k: 1, judges: 2, weight: 1, depth: 8 },
  },
  {
    id: "noisy",
    title: "A third judge who knows nothing about the query",
    change: "Add a clicks ranker (overall popularity, unrelated to this query) · equal weight, then weight 0.3 · 40 queries, top 20 from each",
    question: "With the clicks judge at full weight, what happens?",
    options: ["Results improve: more judges, more evidence", "Popular but irrelevant documents climb into the top results; at weight 0.3 most of the damage is gone", "Nothing: RRF ignores a judge that disagrees with the others"],
    answer: 1,
    why: "RRF gives every list the same say, so a list that ranks by something else entirely adds votes for the wrong documents, and a popular document that one other ranker also likes (like D2 here) jumps to first place. Weighted RRF (w / (k + rank)) lets you keep a signal you want as a tie-breaker without letting it outvote the rankers that understand the query. Tune the weights on queries whose right answers you know.",
    watch: { mode: "rrf", k: 60, judges: 3, weight: 1, depth: 8 },
  },
  {
    id: "depth",
    title: "How deep each list goes",
    change: "Each ranker returns its top 10 vs its top 100 before fusing · k = 60 · 40 queries, 10 relevant documents each",
    question: "How many relevant documents reach the fused top 10?",
    options: ["The same: anything below 10th place adds too little to matter", "More with 100: documents both rankers place in their teens outscore a single first place", "Fewer with 100: the extra documents only add noise"],
    answer: 1,
    why: "Below the cut a document gets nothing, however well it was ranked by the other list. With deeper lists, a document both rankers put around 15th collects two votes of about 1/75, more than any single first place (1/61). One deep vote on its own is still small (a 40th place is worth 1/100), so deeper lists rescue agreement, not stragglers. The cost is fetching and scoring more candidates from each index; 50 to 100 per list is common before fusing, and a reranker then sorts the top 20 or so.",
    watch: { mode: "rrf", k: 60, judges: 2, weight: 1, depth: 3 },
  },
];

const QUESTIONS = [
  ["Why can't you add a BM25 score and a cosine similarity and sort by the sum?",
    "They're on different scales with different shapes: BM25 is unbounded and depends on the query's length and the collection's word statistics, while cosine similarities from an embedding model crowd into a narrow band. The sum is decided by whichever has the bigger spread, so it is mostly one ranker. Normalising (min-max, z-scores) depends on what else came back for that query and is thrown off by outliers. RRF uses only the order, so there is nothing to calibrate."],
  ["Write the RRF formula and score a document ranked 2nd by one list and 5th by another, with k = 60.",
    "score(d) = Σ over lists of 1 / (k + rank of d in that list); a list that doesn't contain d adds nothing. Here 1/62 + 1/65 ≈ 0.01613 + 0.01538 = 0.03151, almost twice a single first place (1/61 ≈ 0.01639)."],
  ["What does k do, and why is 60 the usual value?",
    "It controls how top-heavy the fusion is: a first place is worth (k + 10)/(k + 1) times a 10th. Small k lets one ranker's first place win; large k mostly counts how many lists include a document. Cormack, Clarke and Büttcher found 60 worked well across their collections, and it is robust enough that most systems never tune it."],
  ["When would you weight one ranker less, and how?",
    "When it is weaker, noisier or measures something other than relevance to the query: popularity, recency, a small fine-tuned model you don't trust yet, or keyword search on queries that are mostly natural language. Weighted RRF uses w / (k + rank). Pick the weights on a set of queries whose right answers you know, not by feel."],
  ["What does RRF throw away, and when might a score-based fusion be better?",
    "The size of the gaps: a document that wins by a mile and one that wins by a hair look the same. If your scores are calibrated (comparable probabilities) or you have labelled queries to tune a normalised weighted sum, a score-based combination can edge out RRF. RRF is the strong default because it needs no calibration and no training data."],
  ["How deep should each list be before fusing, and what does depth cost?",
    "Deep enough that documents both rankers like but neither ranks near the top can still meet: with k = 60, two votes in the teens outscore one first place. Common practice is the top 50 to 100 from each index, fused, then a reranker or a cutoff of 20 or so. Deeper lists cost latency and compute on every query, and past a point add only single deep votes that never reach the top."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Count room",
  keys: [
    { mark: "lit", label: "The vote being counted: its card, the token on the tray and the first place on the standings" },
    { mark: "raised", label: "Tokens in each tube: one per vote, as tall as that vote's share, shaded by judge" },
    { mark: "flat", label: "Ballots: each judge's documents in rank order, with the score it gave on the right" },
  ],
  caption:
    "Each judge ranks the same documents for the query: keyword (BM25-style word matching), meaning (embedding similarity) and clicks (popularity). The clerk counts rank by rank: for every card on a ballot, a token goes into that document's tube, as tall as 1 / (k + rank). The counters show points, where a first place is worth 100 (the RRF score × 100 (k + 1)), so the order is the RRF order. Pennants mark the documents that really answer the question: a tall one for a full answer, a short one for a partial one. Switch to raw scores to see what adding the judges' own numbers does; turn k on the dial to see the tokens grow or shrink.",
  stage: 'data-count aria-label="Rank fusion simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">Query: “${QUERY.text}”. Changing a setting starts the count again.</p>`;
const controls = panel({
  stats: [["counted", "Votes counted"], ["leader", "Leader"], ["score", "Leader's score"], ["rel", "Relevant in top 5"], ["first", "1st place worth"], ["eighth", "8th vs 1st"]],
  controls: [
    seg("mode", "Add up", [["rrf", "Ranks: 1/(k + rank)"], ["raw", "Raw scores"]], "rrf"),
    seg("k", "k", [[1, "1"], [10, "10"], [60, "60"], [1000, "1000"]], 60),
    seg("judges", "Judges", [[2, "Keyword + meaning"], [3, "+ clicks"]], 2),
    seg("weight", "Clicks weight", [[1, "×1"], [0.3, "×0.3"]], 1),
    seg("depth", "Ballot depth", [[3, "Top 3"], [5, "Top 5"], [8, "Top 8"]], 8),
    speedSeg(),
    actions("Do something", [["finish", "Finish the count"], ["reset", "Count again"], ["pause", "Pause"]]),
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
    weightText[j].textContent = use().includes(j) ? "×" + weightOf(j) : "off";
    for (let r = 1; r <= G.SLOTS; r++) q('[data-slot="' + j + "-" + r + '"]').toggleAttribute("data-hidden", r > cfg.depth);
  }
  modeSolid.toggleAttribute("data-lit", cfg.mode === "raw");
  modeText.textContent = cfg.mode === "raw" ? "raw scores added" : "1 / (k + rank)";
  kDial.set(Math.log10(cfg.k) / 3);
  paint();
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
  stat("rel", order.slice(0, 5).filter((e) => QUERY.docs[e.id].rel > 0).length + " of " + Math.min(5, order.length));
  stat("first", cfg.mode === "raw" ? "its own score" : "1/" + (cfg.k + 1) + " = " + (1 / (cfg.k + 1)).toFixed(4));
  stat("eighth", cfg.mode === "raw" ? "–" : Math.round(100 * (cfg.k + 1) / (cfg.k + 8)) + "%");
  if (cur && t >= cur.t1) {
    const name = cur.list.toUpperCase();
    const worth = cfg.mode === "raw" ? "adds its raw score " + (cur.list === "meaning" ? cur.raw.toFixed(2) : cur.raw) : "adds " + (cur.w !== 1 ? cur.w + " × " : "") + "1/(" + cfg.k + " + " + cur.rank + ") = " + cur.add.toFixed(5);
    say(name + " #" + cur.rank + " · " + cur.id + " “" + QUERY.docs[cur.id].title + "” · " + worth);
  } else if (!cur) say("count done · " + (order[0] ? order[0].id + " leads with " + fmtScore(order[0].score) : "") + " · counting again shortly");
  else say("walking to the " + cur.list + " ballot for rank " + cur.rank);
}
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(key, value) { const el = statEls[key]; const text = String(value); if (el && el.textContent !== text) el.textContent = text; }

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; if (clock > plan.end + HOLD) restart(0); else paint(); }, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });

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
    return { verdict: "Relevant documents in the top 10, averaged over 40 queries: raw sum " + f1(s.raw) + ", keyword alone " + f1(s.kwOnly) + ", meaning alone " + f1(s.meOnly) + ", RRF " + f1(s.rrf) + ". " + f1(s.sameAsKeyword) + " of the raw sum's top 10 were simply the keyword top 10. On the figure's query the raw sum's top 5 is " + s.figure.raw.join(" ") + " (" + s.figure.rawHits + " relevant); RRF's is " + s.figure.rrf.join(" ") + " (" + s.figure.rrfHits + " relevant).",
      bars: [["Keyword alone", s.kwOnly / 10, f1(s.kwOnly)], ["Meaning alone", s.meOnly / 10, f1(s.meOnly)], ["Raw score sum", s.raw / 10, f1(s.raw), true], ["RRF, k = 60", s.rrf / 10, f1(s.rrf), true]] };
  },
  agree: () => {
    const a = RESULTS.agree;
    return { verdict: "D1 (3rd and 4th): 1/63 + 1/64 = " + f5(a.d1) + ", 1st place. D2 (1st, one ballot only): 1/61 = " + f5(a.d2) + ", " + a.d2Place + "th place, tied with D5, the meaning ballot's first. D1 scores " + a.ratio.toFixed(2) + "× D2.",
      bars: [["D1: 3rd + 4th", a.d1 / 0.0328, f5(a.d1), true], ["D2: 1st on one ballot", a.d2 / 0.0328, f5(a.d2)], ["Most possible from two ballots (2 × 1/61)", 2 / 61 / 0.0328, f5(2 / 61)]] };
  },
  k: () => {
    const K = RESULTS.k;
    return { verdict: "Top 5 at k = 1: " + K.fig[1].top.join(" ") + " (" + K.fig[1].hits + " relevant). At k = 60: " + K.fig[60].top.join(" ") + " (" + K.fig[60].hits + "). At k = 1000: " + K.fig[1000].top.join(" ") + " (" + K.fig[1000].hits + "). Over 40 queries, relevant in the top 10: " + f1(K.avg[1]) + " / " + f1(K.avg[60]) + " / " + f1(K.avg[1000]) + ". A first place is worth " + K.firstVsTenth[1].toFixed(1) + "× a 10th at k = 1, " + K.firstVsTenth[60].toFixed(2) + "× at 60 and " + K.firstVsTenth[1000].toFixed(3) + "× at 1000.",
      bars: [["k = 1, relevant in top 10", K.avg[1] / 10, f1(K.avg[1]), true], ["k = 60", K.avg[60] / 10, f1(K.avg[60])], ["k = 1000", K.avg[1000] / 10, f1(K.avg[1000])]] };
  },
  noisy: () => {
    const n = RESULTS.noisy;
    return { verdict: "Relevant documents in the top 10, over 40 queries: two judges " + f1(n.two) + ", plus clicks at full weight " + f1(n.three) + ", plus clicks at 0.3 " + f1(n.weighted) + ". On the figure's query the top 5 goes from " + n.fig.two + " relevant to " + n.fig.three.hits + " (" + n.fig.three.top.join(" ") + ") with clicks at full weight, and back to " + n.fig.weighted.hits + " (" + n.fig.weighted.top.join(" ") + ") at 0.3.",
      bars: [["Keyword + meaning", n.two / 10, f1(n.two)], ["+ clicks, weight 1", n.three / 10, f1(n.three), true], ["+ clicks, weight 0.3", n.weighted / 10, f1(n.weighted), true]] };
  },
  depth: () => {
    const d = RESULTS.depth, ex = d.example;
    return { verdict: "Relevant documents in the fused top 10: " + f1(d.shallow) + " with top-10 lists, " + f1(d.deep) + " with top-100 lists; " + f1(d.rescued) + " per query were on neither top-10 list. For example, a document ranked " + ex.ranks.join(" and ") + " scored " + f5(ex.score) + " and finished " + ex.place + (ex.place === 1 ? "st" : ex.place === 2 ? "nd" : ex.place === 3 ? "rd" : "th") + ", ahead of any single first place (" + f5(d.single1) + "). A lone 40th place is worth " + f5(d.single40) + ".",
      bars: [["Top 10 from each", d.shallow / 10, f1(d.shallow)], ["Top 100 from each", d.deep / 10, f1(d.deep), true], ["Two votes in the teens (example)", ex.score / 0.0328, f5(ex.score), true], ["One first place", d.single1 / 0.0328, f5(d.single1)]] };
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
  title: "Rank Fusion Workbench",
  eyebrow: "Systems lesson 37 · Reciprocal rank fusion",
  lede: "Hybrid search asks several rankers the same question and has to merge their answers, but their scores can't be compared: a keyword score of 20 and a cosine similarity of 0.8 mean nothing side by side. Reciprocal rank fusion ignores the scores and adds up 1 / (k + rank) from every list. This lesson turns it into a count room: watch the votes go in, predict what changes the result, then explain it back.",
  machine: { intro: "Three judges have ranked the same fourteen documents for one query. The clerk counts rank by rank: each card on a ballot puts a token in that document's tube, as tall as 1 / (k + rank), and the standings board shows the leaders so far. Pennants mark the documents that really answer the question. Try raw scores instead of ranks, turn k, add the clicks judge, and cut the ballots short.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same fusion code as the machine: the figure's query, and an average over 40 seeded queries with 300 documents each.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: `RRF: Cormack, Clarke &amp; Büttcher, “Reciprocal rank fusion outperforms Condorcet and individual rank learning methods”, SIGIR 2009. Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson.`,
  css,
  script: live,
});
console.log("wrote rrf-workbench.html", (size / 1024).toFixed(0) + " KB");

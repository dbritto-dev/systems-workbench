// Reciprocal rank fusion: merge several ranked lists into one.
// Shared by the live figure and the experiments. No randomness in the fusion itself; the experiments
// average over seeded synthetic queries.
//
// RRF (Cormack, Clarke & Büttcher, SIGIR 2009): score(d) = Σ over lists of w / (k + rank of d in that list),
// k = 60 by default. A document missing from a list gets nothing from it.

export const K_DEFAULT = 60;

// The query the figure counts: one search, three judges (rankers), fourteen documents.
// rel: 2 answers the question, 1 helps, 0 doesn't.
export const QUERY = {
  text: "reset two-factor login after losing my phone",
  docs: {
    D1: { title: "Reset two-factor on a new phone", rel: 2 },
    D2: { title: "Reset your login password", rel: 0 },
    D3: { title: "Lost phone? Sign in with a backup code", rel: 2 },
    D4: { title: "Two-factor login error codes", rel: 0 },
    D5: { title: "Recover your account when the authenticator is gone", rel: 2 },
    D6: { title: "Set up an authenticator app", rel: 1 },
    D7: { title: "Change the phone number for login codes", rel: 1 },
    D8: { title: "Login page outage, 12 May", rel: 0 },
    D9: { title: "Phone plans and pricing", rel: 0 },
    D10: { title: "Trusted devices: remove a lost phone", rel: 1 },
    D11: { title: "Security checklist for new accounts", rel: 0 },
    D12: { title: "Contact support to regain access", rel: 1 },
    D13: { title: "Why we require two-factor login", rel: 0 },
    D14: { title: "Can't sign in? Start here", rel: 1 },
  },
  // Each judge's ballot, best first, with the score it gave.
  lists: {
    keyword: [["D2", 24.6], ["D4", 21.9], ["D1", 19.4], ["D7", 17.2], ["D13", 15.8], ["D9", 12.1], ["D8", 10.7], ["D3", 9.3], ["D10", 8.0], ["D11", 6.4]],
    meaning: [["D5", 0.86], ["D3", 0.83], ["D12", 0.79], ["D1", 0.77], ["D10", 0.74], ["D6", 0.71], ["D7", 0.66], ["D14", 0.63], ["D4", 0.58], ["D2", 0.55]],
    clicks: [["D9", 912], ["D8", 655], ["D2", 540], ["D11", 388], ["D14", 301], ["D13", 244], ["D6", 190], ["D4", 152], ["D1", 133], ["D3", 98]],
  },
};
export const JUDGES = ["keyword", "meaning", "clicks"];

// One vote's share of the fused score.
export const rrfShare = (rank, k = K_DEFAULT, w = 1) => w / (k + rank);

// Fuse lists. lists: { name: [[id, score], ...] } best first. opts: { k, weights: {name: w}, depth, mode: "rrf" | "raw", use: [names] }.
// Returns [{ id, score, votes: [{ list, rank, raw, add }] }] best first; ties broken by best single rank, then id.
export function fuse(lists, { k = K_DEFAULT, weights = {}, depth = Infinity, mode = "rrf", use = Object.keys(lists) } = {}) {
  const acc = new Map();
  for (const name of use) {
    const list = lists[name] || [];
    const w = weights[name] ?? 1;
    list.slice(0, depth).forEach(([id, raw], i) => {
      const rank = i + 1;
      const add = mode === "raw" ? w * raw : rrfShare(rank, k, w);
      const e = acc.get(id) || { id, score: 0, votes: [], best: Infinity };
      e.score += add;
      e.best = Math.min(e.best, rank);
      e.votes.push({ list: name, rank, raw, add });
      acc.set(id, e);
    });
  }
  return [...acc.values()].sort((a, b) => b.score - a.score || a.best - b.best || num(a.id) - num(b.id));
}
const num = (id) => Number(String(id).replace(/\D/g, "")) || 0;

// The order the clerk counts in: rank 1 of every judge, then rank 2 of every judge, and so on.
export function countOrder(lists, { depth = 8, use = JUDGES.slice(0, 2) } = {}) {
  const out = [];
  for (let r = 1; r <= depth; r++) for (const name of use) { const e = lists[name][r - 1]; if (e) out.push({ list: name, rank: r, id: e[0], raw: e[1] }); }
  return out;
}

// Points on the figure: the RRF score scaled so a first place counts 100 (100 × w × (k + 1) / (k + rank)).
// Raw mode: the raw score × 10. Same order as the fused scores, readable on a counter.
export const pointsOf = (vote, { k = K_DEFAULT, mode = "rrf", w = 1 }) =>
  mode === "raw" ? vote.raw * 10 * w : 100 * w * (k + 1) / (k + vote.rank);

// ---------------------------------------------------------------------------------------------
// Synthetic queries for the experiments: 300 documents, 10 of them relevant.
// Every document has a lexical match (shares the query's words) and a semantic match (means the same thing).
//   relevant: high meaning; half use the query's words, half paraphrase it
//   traps: 20 irrelevant documents that share the words; 20 that are about something nearby
// keyword ranker: BM25-like score 4..30 from the lexical match, only documents that contain a query word
// meaning ranker: cosine 0.2..0.9 from the semantic match
// clicks ranker: popularity, unrelated to this query
// ---------------------------------------------------------------------------------------------
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function gauss(rnd) { const u = 1 - rnd(), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export function synthQuery(seed, n = 300) {
  const rnd = makeRng(seed * 7919 + 13);
  const docs = [];
  for (let i = 0; i < n; i++) {
    let rel = 0, lex, sem;
    if (i < 10) {
      rel = 1;
      const kind = i % 3;               // 0: exact terms (codes, names), 1: paraphrase, 2: both
      lex = kind === 1 ? 0.04 + 0.25 * rnd() : 0.55 + 0.4 * rnd();
      sem = kind === 0 ? 0.35 + 0.3 * rnd() : 0.6 + 0.35 * rnd();
    } else if (i < 30) {                // shares the words, not the meaning
      lex = 0.5 + 0.45 * rnd(); sem = 0.15 + 0.35 * rnd();
    } else if (i < 55) {                // nearby topic: means something close, different words
      lex = 0.03 + 0.3 * rnd(); sem = 0.5 + 0.4 * rnd();
    } else {
      lex = rnd() < 0.5 ? 0 : 0.5 * rnd() ** 2; sem = 0.05 + 0.5 * rnd() ** 1.5;
    }
    docs.push({ id: "d" + i, rel, lex, sem, pop: Math.exp(gauss(rnd) * 0.9) * 120 });
  }
  const keyword = docs.filter((d) => d.lex > 0.02).map((d) => [d.id, Math.max(0.5, 4 + 26 * d.lex ** 1.2 + gauss(rnd) * 2.2)]);
  const meaning = docs.map((d) => [d.id, Math.min(0.97, 0.2 + 0.7 * d.sem + gauss(rnd) * 0.05)]);
  const clicks = docs.map((d) => [d.id, Math.round(d.pop)]);
  const byScore = (a, b) => b[1] - a[1];
  return { docs: Object.fromEntries(docs.map((d) => [d.id, d])), lists: { keyword: keyword.sort(byScore), meaning: meaning.sort(byScore), clicks: clicks.sort(byScore) } };
}

// How many relevant documents in the top n.
export const hits = (fused, docs, n) => fused.slice(0, n).filter((e) => (docs[e.id]?.rel ?? 0) > 0).length;

export const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const avgOver = (fn) => mean(SEEDS.map((s) => fn(synthQuery(s))));

// 1. Different scales: add the raw scores, or fuse the ranks.
export function expScales() {
  const opts = { depth: 20, use: ["keyword", "meaning"] };
  const raw = avgOver((q) => hits(fuse(q.lists, { ...opts, mode: "raw" }), q.docs, 10));
  const rrf = avgOver((q) => hits(fuse(q.lists, { ...opts, mode: "rrf" }), q.docs, 10));
  const kwOnly = avgOver((q) => hits(fuse(q.lists, { ...opts, use: ["keyword"] }), q.docs, 10));
  const meOnly = avgOver((q) => hits(fuse(q.lists, { ...opts, use: ["meaning"] }), q.docs, 10));
  // how much of the raw top 10 is just the keyword top 10
  const sameAsKeyword = avgOver((q) => {
    const top = new Set(fuse(q.lists, { ...opts, mode: "raw" }).slice(0, 10).map((e) => e.id));
    return q.lists.keyword.slice(0, 10).filter(([id]) => top.has(id)).length;
  });
  // the figure's query
  const fq = (mode) => fuse(QUERY.lists, { depth: 8, use: ["keyword", "meaning"], mode });
  return { raw, rrf, kwOnly, meOnly, sameAsKeyword, figure: { raw: fq("raw").slice(0, 5).map((e) => e.id), rrf: fq("rrf").slice(0, 5).map((e) => e.id), rawHits: hits(fq("raw"), QUERY.docs, 5), rrfHits: hits(fq("rrf"), QUERY.docs, 5) } };
}

// 2. Agreement vs a single first place, on the figure's query (depth 8).
export function expAgreement() {
  const f = fuse(QUERY.lists, { depth: 8, use: ["keyword", "meaning"] });
  const d1 = f.find((e) => e.id === "D1"), d2 = f.find((e) => e.id === "D2");
  return { d1: d1.score, d2: d2.score, d1Votes: d1.votes.map((v) => v.rank), d2Votes: d2.votes.map((v) => v.rank), d1Place: f.indexOf(d1) + 1, d2Place: f.indexOf(d2) + 1, ratio: d1.score / d2.score };
}

// 3. k: how top-heavy the fusion is.
export function expK() {
  const ks = [1, 60, 1000];
  const fig = Object.fromEntries(ks.map((k) => { const f = fuse(QUERY.lists, { k, depth: 8, use: ["keyword", "meaning"] }); return [k, { top: f.slice(0, 5).map((e) => e.id), hits: hits(f, QUERY.docs, 5) }]; }));
  const avg = Object.fromEntries(ks.map((k) => [k, avgOver((q) => hits(fuse(q.lists, { k, depth: 20, use: ["keyword", "meaning"] }), q.docs, 10))]));
  // how much a first place outweighs a 10th place, per k
  const firstVsTenth = Object.fromEntries(ks.map((k) => [k, (k + 10) / (k + 1)]));
  return { fig, avg, firstVsTenth };
}

// 4. A third ranker that knows nothing about the query.
export function expNoisy() {
  const base = { depth: 20 };
  const two = avgOver((q) => hits(fuse(q.lists, { ...base, use: ["keyword", "meaning"] }), q.docs, 10));
  const three = avgOver((q) => hits(fuse(q.lists, { ...base, use: JUDGES }), q.docs, 10));
  const weighted = avgOver((q) => hits(fuse(q.lists, { ...base, use: JUDGES, weights: { clicks: 0.3 } }), q.docs, 10));
  const fig = (w) => { const f = fuse(QUERY.lists, { depth: 8, use: JUDGES, weights: { clicks: w } }); return { top: f.slice(0, 5).map((e) => e.id), hits: hits(f, QUERY.docs, 5) }; };
  return { two, three, weighted, fig: { two: hits(fuse(QUERY.lists, { depth: 8, use: ["keyword", "meaning"] }), QUERY.docs, 5), three: fig(1), weighted: fig(0.3) } };
}

// 5. How deep each list goes: top 10 vs top 100 from each ranker.
export function expDepth() {
  const use = ["keyword", "meaning"];
  const shallow = avgOver((q) => hits(fuse(q.lists, { depth: 10, use }), q.docs, 10));
  const deep = avgOver((q) => hits(fuse(q.lists, { depth: 100, use }), q.docs, 10));
  // relevant documents in the deep top 10 that the shallow lists couldn't see at all
  const rescued = avgOver((q) => {
    const seen = new Set([...q.lists.keyword.slice(0, 10), ...q.lists.meaning.slice(0, 10)].map(([id]) => id));
    return fuse(q.lists, { depth: 100, use }).slice(0, 10).filter((e) => q.docs[e.id].rel > 0 && !seen.has(e.id)).length;
  });
  // an example: the best-placed rescued document across the seeds, and what one deep single vote is worth
  let example = null;
  for (const s of SEEDS) {
    const q = synthQuery(s);
    const seen = new Set([...q.lists.keyword.slice(0, 10), ...q.lists.meaning.slice(0, 10)].map(([id]) => id));
    const f = fuse(q.lists, { depth: 100, use });
    const i = f.slice(0, 10).findIndex((e) => q.docs[e.id].rel > 0 && !seen.has(e.id) && e.votes.length === 2);
    if (i >= 0) { const e = f[i]; example = { place: i + 1, ranks: e.votes.map((v) => v.rank), score: e.score }; break; }
  }
  return { shallow, deep, rescued, example, single40: rrfShare(40), single1: rrfShare(1) };
}

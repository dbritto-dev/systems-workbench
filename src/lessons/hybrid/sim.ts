// @ts-nocheck: model code ported as-is; shared helpers come from src/lib.
// Hybrid search over a small help-centre corpus, shared by the live figure and the experiments.
//
// Corpus: 16 products × 15 articles = 240 documents. Every article is about two topics (a pair of concepts such as
// refund + damage) plus a minor third one, names its product, and half of them quote an exact identifier (an error
// code like E-4072 or a part number like SKU-31907). Writers use the "doc" words for a concept (refund, damaged);
// customers often use other words for the same thing (money, cracked).
//
// Two retrievers over the same corpus:
//   lexical   real BM25 (k1 = 1.2, b = 0.75) over the tokens: exact words only, rare tokens weigh most.
//   semantic  a toy embedding: every word that names a concept points along that concept's axis (synonyms share an
//             axis, each with a little word-specific noise); identifiers and product names have no meaning to the
//             model, so they map to a weak generic direction plus noise. Cosine similarity, exact nearest neighbours.
//
// Fusion of the two candidate lists (each cut to `depth`):
//   rrf       reciprocal rank fusion, score = Σ 1 / (60 + rank)
//   minmax    α · semantic + (1 − α) · lexical, each list's scores min-max normalised to 0..1 first
//   raw       α · cosine + (1 − α) · BM25 with no normalisation
// Optional rerank: a cross-encoder reads the query and each of the top 100 fused candidates together and rescores
// them; modelled as one that sees exact identifiers, product names and meaning at once, at 2.2 ms a candidate.
//
// Queries (30 of each type, each with its labelled relevant documents):
//   exact       an identifier plus one word ("E-4072 firmware"): one relevant article
//   paraphrase  the customer's own words for an article's two topics ("money back cracked parcel"): every article on
//               that pair of topics, in any product, is relevant
//   mixed       a product name plus the customer's words ("Kestrel money back cracked"): the one article for that
//               product on those topics

import { xorshift32 } from "../../lib/random";
import { mean, meanBy } from "../../lib/stats";

export const makeRng = xorshift32;

export const CONCEPTS = [
  ["refund", ["refund", "reimbursement"], ["money", "repay"]],
  ["damage", ["damaged", "broken"], ["cracked", "smashed"]],
  ["shipping", ["shipment", "delivery"], ["parcel", "courier"]],
  ["delay", ["delayed", "late"], ["waiting", "slow"]],
  ["password", ["password", "credentials"], ["passcode", "pin"]],
  ["login", ["login", "authentication"], ["access", "locked"]],
  ["invoice", ["invoice", "receipt"], ["bill", "statement"]],
  ["charge", ["charge", "payment"], ["paid", "card"]],
  ["cancel", ["cancel", "terminate"], ["stop", "quit"]],
  ["subscription", ["subscription", "plan"], ["monthly", "renewal"]],
  ["battery", ["battery", "charging"], ["power", "drains"]],
  ["screen", ["screen", "display"], ["monitor", "flicker"]],
  ["startup", ["startup", "boot"], ["launch", "turn-on"]],
  ["crash", ["crash", "fault"], ["freezes", "stuck"]],
  ["update", ["update", "firmware"], ["version", "patch"]],
  ["warranty", ["warranty", "guarantee"], ["coverage", "repair"]],
];
const C = CONCEPTS.length;
export const PRODUCTS = ["Kestrel", "Osprey", "Merlin", "Falcon", "Harrier", "Kite", "Swift", "Wren", "Heron", "Plover", "Avocet", "Dunlin", "Gannet", "Tern", "Puffin", "Linnet"];
const FILLER = ["the", "for", "and", "how", "to", "your", "a", "of", "is", "with", "this", "if", "on", "steps", "when", "you"];
// The topic pairs the help centre writes about: each product has an article on 15 of these 20 pairs.
export const PAIRS = [[0, 1], [0, 3], [2, 3], [1, 2], [4, 5], [5, 13], [6, 7], [7, 8], [8, 9], [9, 6], [10, 12], [11, 13], [12, 13], [14, 13], [14, 12], [15, 1], [15, 10], [11, 15], [7, 0], [4, 9]];

// Knobs for the corpus and the modelled reranker (the scoring maths has none).
export const TUNE = { customer: 0.35, overlap: 0.6, nameAmp: 0.3, codeAmp: 0.5, rerankNoise: 1.1, minorBonus: 1 };

// ---------- corpus ----------
export function buildCorpus(seed = 11) {
  const rnd = makeRng(seed);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const docs = [];
  let codeN = 0;
  for (let p = 0; p < PRODUCTS.length; p++) {
    const pairs = PAIRS.map((_, i) => i).sort(() => rnd() - 0.5).slice(0, 15);
    for (const pi of pairs) {
      const [a, b] = PAIRS[pi];
      let minor = Math.floor(rnd() * C);
      if (minor === a || minor === b) minor = (minor + 5) % C;
      const words = [PRODUCTS[p], PRODUCTS[p]];                 // named in the title and again in the text
      for (const c of [a, b, a, b]) words.push(pick(CONCEPTS[c][1]));
      words.push(pick(CONCEPTS[minor][1]), pick(CONCEPTS[minor][1]));   // the article's own angle on the pair
      for (const c of [a, b, minor]) if (rnd() < TUNE.customer) words.push(pick(CONCEPTS[c][2]));   // writers often use the customer's words too
      let code = null;
      if (rnd() < 0.5) {
        const hw = [10, 11, 12, 13, 14].includes(a) || [10, 11, 12, 13, 14].includes(b);
        code = hw ? "E-" + (4000 + ((codeN * 137 + 61) % 5000)) : "SKU-" + (30000 + ((codeN * 7919 + 211) % 60000));
        codeN++;
        words.push(code);
      }
      for (let i = 0; i < 8; i++) words.push(pick(FILLER));
      docs.push({ id: docs.length, n: docs.length + 1, product: p, pair: pi, a, b, minor, code, words });
    }
  }
  return docs;
}

// ---------- tokens and BM25 ----------
// Lower-cased words with stopwords removed, as a search engine's analyzer does; identifiers stay whole.
export const STOPWORDS = new Set([...FILLER, "my", "help"]);
export const tokens = (words) => words.map((w) => w.toLowerCase()).filter((w) => !STOPWORDS.has(w));

export function makeBM25(docs, { k1 = 1.2, b = 0.75 } = {}) {
  const tf = docs.map((d) => { const m = new Map(); for (const t of tokens(d.words)) m.set(t, (m.get(t) || 0) + 1); return m; });
  const len = docs.map((d) => d.words.length);
  const avg = mean(len);
  const df = new Map();
  for (const m of tf) for (const t of m.keys()) df.set(t, (df.get(t) || 0) + 1);
  const N = docs.length;
  const idf = (t) => { const n = df.get(t) || 0; return Math.log(1 + (N - n + 0.5) / (n + 0.5)); };
  return {
    score(qWords) {
      const q = [...new Set(tokens(qWords))];
      return docs.map((_, i) => {
        let s = 0;
        for (const t of q) {
          const f = tf[i].get(t) || 0;
          if (f) s += idf(t) * (f * (k1 + 1)) / (f + k1 * (1 - b + (b * len[i]) / avg));
        }
        return s;
      });
    },
    idf,
  };
}

// ---------- the toy embedding ----------
const HASH = 12;
const DIM = C + 1 + HASH;
function hash(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const conceptOf = new Map();
CONCEPTS.forEach(([, doc, user], c) => { for (const w of doc) conceptOf.set(w.toLowerCase(), c); for (const w of user) conceptOf.set(w.toLowerCase(), c); });
const productSet = new Set(PRODUCTS.map((p) => p.toLowerCase()));
const fillerSet = new Set(FILLER);

export function wordVector(word) {
  const w = word.toLowerCase();
  const v = new Float64Array(DIM);
  const r = makeRng(hash(w) || 1);
  const noise = (scale) => { for (let i = 0; i < DIM; i++) v[i] += (r() - 0.5) * 2 * scale; };
  if (fillerSet.has(w)) return v;
  if (conceptOf.has(w)) { v[conceptOf.get(w)] = 1; noise(0.16); return v; }
  if (productSet.has(w) || /^(e|sku)-\d+$/.test(w)) {          // names and identifiers: little meaning the model learned
    v[C] = 0.35;                                                // a weak "this is some name or code" direction
    const amp = productSet.has(w) ? TUNE.nameAmp : TUNE.codeAmp;  // plus a faint trace of the token itself (its sub-word pieces)
    for (let i = C + 1; i < DIM; i++) v[i] += (r() - 0.5) * amp * 2;
    return v;
  }
  noise(0.2);
  return v;
}
export function embed(words, weights) {
  const v = new Float64Array(DIM);
  words.forEach((w, i) => { const wv = wordVector(w); const k = weights ? weights[i] : 1; for (let j = 0; j < DIM; j++) v[j] += k * wv[j]; });
  let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1;
  for (let j = 0; j < DIM; j++) v[j] /= n;
  return v;
}
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

// ---------- queries ----------
export function buildQueries(docs, seed = 5) {
  const rnd = makeRng(seed);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const qs = [];
  const coded = docs.filter((d) => d.code);
  const used = new Set();
  const take = (pool) => { for (let k = 0; k < 500; k++) { const d = pick(pool); if (!used.has(d.id)) { used.add(d.id); return d; } } return pick(pool); };
  for (let i = 0; i < 30; i++) {                                  // an identifier pasted with one word of context
    const d = take(coded);
    const c = rnd() < 0.5 ? d.a : d.b;
    qs.push({ type: "exact", words: [d.code, pick([...CONCEPTS[c][1], ...CONCEPTS[c][2]])], rel: [d.id], target: d.id });
  }
  for (let i = 0; i < 30; i++) {                                  // the customer's own words, no product, no identifier
    const d = take(docs);
    const said = (c) => (rnd() < TUNE.overlap ? pick(CONCEPTS[c][1]) : pick(CONCEPTS[c][2]));   // now and then the customer happens to use the article's word
    const words = [said(d.a), said(d.b), said(d.minor), pick(["my", "the", "help"])];
    const rel = docs.filter((x) => x.pair === d.pair && x.minor === d.minor).map((x) => x.id);   // every product's article on exactly this subject answers it
    qs.push({ type: "paraphrase", words, rel, target: d.id });
  }
  for (let i = 0; i < 30; i++) {                                  // a product name plus the customer's words
    const d = take(docs);
    const [b1, b2] = rnd() < 0.5 ? CONCEPTS[d.b][2] : [...CONCEPTS[d.b][2]].reverse();
    const words = [PRODUCTS[d.product], pick(CONCEPTS[d.a][2]), b1];
    if (rnd() < 0.4) words.push(b2);
    qs.push({ type: "mixed", words, rel: [d.id], target: d.id });
  }
  qs.forEach((q, i) => { q.id = i; q.text = q.words.join(" "); });
  return qs;
}

// ---------- the search engine ----------
export const DEFAULTS = { lexical: true, semantic: true, fusion: "rrf", alpha: 0.5, depth: 20, rerank: false, rerankN: 100, k: 60 };
export const LATENCY = { lexical: 4, semantic: 9, fuse: 1, perRerank: 2.2 };

export function makeEngine(seed = 11) {
  const docs = buildCorpus(seed);
  const bm25 = makeBM25(docs);
  const vecs = docs.map((d) => embed(d.words));
  const queries = buildQueries(docs);
  const order = (scores) => scores.map((s, i) => [s, i]).sort((x, y) => y[0] - x[0] || x[1] - y[1]).map(([, i]) => i);

  function lists(q) {
    if (q._lists) return q._lists;
    const lex = bm25.score(q.words);
    const qv = embed(q.words);
    const sem = vecs.map((v) => dot(qv, v));
    q._lists = { lex, sem, lexRank: order(lex), semRank: order(sem) };
    return q._lists;
  }

  // the cross-encoder: reads query and article together, so exact tokens, product names and meaning all count
  function rerankScore(q, d) {
    const qt = new Set(tokens(q.words)), dt = new Set(tokens(d.words));
    let s = 0;
    for (const t of qt) if (dt.has(t) && /^(e|sku)-\d+$/.test(t)) s += 2.5;
    if (qt.has(PRODUCTS[d.product].toLowerCase())) s += 1.8;
    const qc = new Set(q.words.map((w) => conceptOf.get(w.toLowerCase())).filter((c) => c !== undefined));
    if (qc.has(d.a)) s += 1; if (qc.has(d.b)) s += 1; if (qc.has(d.minor)) s += TUNE.minorBonus;
    for (const t of qt) if (dt.has(t) && conceptOf.has(t)) s += 0.25;
    const r = makeRng(hash(q.text + "|" + d.id));
    return s + (r() - 0.5) * 2 * TUNE.rerankNoise;
  }

  function search(q, cfgIn = {}) {
    const cfg = { ...DEFAULTS, ...cfgIn };
    const L = lists(q);
    const lexTop = cfg.lexical ? L.lexRank.slice(0, cfg.depth).filter((i) => L.lex[i] > 0) : [];
    const semTop = cfg.semantic ? L.semRank.slice(0, cfg.depth) : [];
    const pool = [...new Set([...lexTop, ...semTop])];
    const fused = new Map();
    if (cfg.fusion === "rrf" || !(cfg.lexical && cfg.semantic)) {
      lexTop.forEach((i, r) => fused.set(i, (fused.get(i) || 0) + 1 / (cfg.k + r + 1)));
      semTop.forEach((i, r) => fused.set(i, (fused.get(i) || 0) + 1 / (cfg.k + r + 1)));
    } else {
      const norm = (idx, scores) => {
        if (cfg.fusion === "raw") return new Map(idx.map((i) => [i, scores[i]]));
        const v = idx.map((i) => scores[i]); const lo = Math.min(...v), hi = Math.max(...v);
        return new Map(idx.map((i) => [i, hi > lo ? (scores[i] - lo) / (hi - lo) : 1]));
      };
      const ln = norm(lexTop, L.lex), sn = norm(semTop, L.sem);
      for (const i of pool) fused.set(i, cfg.alpha * (sn.get(i) || 0) + (1 - cfg.alpha) * (ln.get(i) || 0));
    }
    let final = [...fused.entries()].sort((x, y) => y[1] - x[1] || x[0] - y[0]).map(([i]) => i);
    let reranked = 0;
    if (cfg.rerank) {
      const head = final.slice(0, cfg.rerankN);
      reranked = head.length;
      const rs = new Map(head.map((i) => [i, rerankScore(q, docs[i])]));
      final = [...head].sort((x, y) => rs.get(y) - rs.get(x) || x - y).concat(final.slice(cfg.rerankN));
    }
    const ms = (cfg.lexical && cfg.semantic ? Math.max(LATENCY.lexical, LATENCY.semantic) + LATENCY.fuse : cfg.lexical ? LATENCY.lexical : LATENCY.semantic) + reranked * LATENCY.perRerank;
    return { lexTop, semTop, pool, final, ms, reranked };
  }

  const rankOf = (list, id) => { const r = list.indexOf(id); return r < 0 ? null : r + 1; };
  // hit rate: is a wanted article in the top k?
  function recallAt(q, list, k) {
    const top = new Set(list.slice(0, k));
    return q.rel.some((i) => top.has(i)) ? 1 : 0;
  }
  function evaluate(cfg, k = 10, types = ["exact", "paraphrase", "mixed"]) {
    const out = {};
    for (const t of types) {
      const qs = queries.filter((q) => q.type === t);
      let rec = 0, pool = 0, ms = 0;
      for (const q of qs) { const r = search(q, cfg); rec += recallAt(q, r.final, k); pool += q.rel.some((i) => r.pool.includes(i)) ? 1 : 0; ms += r.ms; }
      out[t] = { recall: rec / qs.length, pool: pool / qs.length, ms: ms / qs.length };
    }
    const all = types.map((t) => out[t]);
    out.all = { recall: meanBy(all, (x) => x.recall), pool: meanBy(all, (x) => x.pool), ms: meanBy(all, (x) => x.ms) };
    return out;
  }
  return { docs, queries, search, lists, evaluate, rankOf, recallAt, rerankScore };
}

// ---------- the five experiments ----------
export const DEPTHS = [5, 20, 100];
const pct = (x) => Math.round(x * 100);
export const SEEDS = [11, 12, 13, 14, 15];
export function experimentResults() {
  const engines = SEEDS.map((s) => makeEngine(s));
  const by = (cfg, k) => {
    const rs = engines.map((E) => E.evaluate(cfg, k));
    const mean = (f) => meanBy(rs, f);
    return { exact: pct(mean((r) => r.exact.recall)), paraphrase: pct(mean((r) => r.paraphrase.recall)), mixed: pct(mean((r) => r.mixed.recall)), all: pct(mean((r) => r.all.recall)), pool: pct(mean((r) => r.all.pool)), ms: Math.round(mean((r) => r.all.ms) * 10) / 10 };
  };
  return {
    three: { lexical: by({ semantic: false }), semantic: by({ lexical: false }), hybrid: by({ fusion: "rrf" }) },
    fusion: { raw: by({ fusion: "raw", alpha: 0.5 }), minmax: by({ fusion: "minmax", alpha: 0.5 }), rrf: by({ fusion: "rrf" }) },
    alpha: [0, 0.3, 0.5, 0.7, 1].map((a) => ({ alpha: a, ...by({ fusion: "minmax", alpha: a }) })),
    depth: DEPTHS.map((d) => ({ depth: d, ...by({ fusion: "rrf", depth: d, rerank: true }) })),
    rerank: { off: by({ fusion: "rrf", depth: 100 }, 5), on: by({ fusion: "rrf", depth: 100, rerank: true }, 5) },
  };
}

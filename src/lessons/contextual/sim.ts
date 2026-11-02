// @ts-nocheck: model code ported as-is; shared helpers come from src/lib.
// Contextual retrieval, modelled end to end on a small synthetic corpus.
//   documents: quarterly filings (16 companies × 8 quarters) and user manuals (8 products);
//   chunks: each filing has a cover (the only chunk naming the company and quarter), three of six standard
//           figures (worded alike in every filing that reports them) and two rarer events; manuals share sections;
//   questions: one per filing (mostly about its events) and four per manual; people paraphrase, use tickers and
//              say "the second quarter";
//   context: a short, chunk-specific header (what an LLM would write after reading the whole document),
//            prepended before embedding and before BM25 indexing;
//   retrieval: a toy embedding (synonyms share a meaning; names carry only a little), real BM25, weighted rank
//              fusion of the two, and a reranker that reads query and chunk together.
// Every number on the page comes from here, worked out at build time.
import { meanBy } from "../../lib/stats";

export function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];
const hashOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export const COMPANIES = ["Acme", "Borealis", "Cobalt", "Dunmore", "Everline", "Fairhaven", "Granite", "Halcyon", "Ironwood", "Juniper", "Kestrel", "Lumen", "Meridian", "Nordwell", "Osprey", "Pellham"];
export const TICKER = Object.fromEntries(COMPANIES.map((c) => [c, c.slice(0, 3).toUpperCase()]));
export const YEARS = [2022, 2023];
export const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
export const PRODUCTS = ["Nimbus", "Orion", "Pico", "Quill", "Rook", "Sable", "Tern", "Umbra"];
const PARTIES = ["Zephyr", "Marlow", "Brightwater", "Calder", "Oakridge", "Vantage", "Solace", "Tidewell", "Larkspur", "Northgate", "Redfern", "Ashby", "Westmere", "Pinecrest", "Holloway", "Corvid", "Dovetail", "Elmstead", "Foxglove", "Glenmoor", "Harrow", "Islay", "Jarrow", "Kilnsey"];
const REGIONS = ["Brazil", "Vietnam", "Poland", "Mexico", "Kenya", "Chile", "Turkey", "Malaysia", "Ireland", "Morocco", "Peru", "Thailand"];
const UNITS = ["lighting", "medical", "packaging", "software", "aerospace", "logistics"];

export const CHUNK_TOKENS = 800;      // each chunk stands for a real 800-token chunk
export const DOC_TOKENS = 8000;       // and each document for an 8k-token document (the post's cost assumptions)

// ---------- the corpus ----------
// Each filing: a cover (the only chunk that names the company and quarter), three of the six standard figures
// (worded the same in every filing that reports them) and two things that happened that quarter (worded the
// same in every filing where they happened, but much rarer). Only the cover says whose filing it is.
const FIGURES = [
  { topic: "revenue", text: (f) => `The company's revenue ${f.up ? "grew" : "fell"} by ${f.rev}% over the previous quarter.`, prev: (f) => `the previous quarter's revenue was $${f.prevRev} million` },
  { topic: "margin", text: (f) => `Operating margin was ${f.margin}% as cost of goods ${f.up ? "eased" : "rose"}.`, prev: (f) => `the previous quarter's operating margin was ${f.margin + (f.up ? -2 : 2)}%` },
  { topic: "headcount", text: (f) => `Headcount ended the quarter at ${f.heads} employees.`, prev: (f) => `the previous quarter's headcount was ${f.heads - 40} employees` },
  { topic: "cash", text: (f) => `Cash and equivalents stood at $${f.cash} million at quarter end.`, prev: (f) => `cash at the previous quarter end was $${f.cash + 25} million` },
  { topic: "outlook", text: (f) => `Management expects demand to ${f.up ? "strengthen" : "soften"} next quarter.`, prev: () => `the outlook section of the report` },
  { topic: "buyback", text: (f) => `The board approved a share repurchase of $${f.buyback} million.`, prev: () => `the capital return section of the report` },
];
const EVENTS = [
  { topic: "factory", text: (e) => `The company opened a new factory in ${e.region}.`, ask: [(e) => `${e.who} new factory ${e.region}`, (e) => `Where did ${e.who} build its new plant?`] },
  { topic: "recall", text: (e) => `A product recall affected ${e.n} thousand units.`, ask: [(e) => `${e.who} product recall units`, (e) => `How many items did ${e.who} have to take back from customers?`] },
  { topic: "lawsuit", text: (e) => `A lawsuit brought by ${e.party} was settled for $${e.x} million.`, ask: [(e) => `${e.who} lawsuit ${e.party} settled`, (e) => `How much did ${e.who} pay to end the legal dispute?`] },
  { topic: "strike", text: (e) => `A labour strike stopped production for ${e.n} days.`, ask: [(e) => `${e.who} labour strike production days`, (e) => `How long did ${e.who} workers walk out?`] },
  { topic: "launch", text: (e) => `The company launched ${e.n} new products this quarter.`, ask: [(e) => `${e.who} launched new products`, (e) => `How many offerings did ${e.who} introduce?`] },
  { topic: "ceo", text: () => `A new chief executive took office during the quarter.`, ask: [(e) => `${e.who} new chief executive took office`, (e) => `When did ${e.who} change its CEO?`] },
  { topic: "dividend", text: (e) => `The board raised the dividend to $${e.cents / 100} per share.`, ask: [(e) => `${e.who} raised dividend per share`, (e) => `How much does ${e.who} pay shareholders as a payout?`] },
  { topic: "bonds", text: (e) => `The company issued $${e.x} million of bonds due 2030.`, ask: [(e) => `${e.who} issued bonds due 2030`, (e) => `How much did ${e.who} borrow from investors?`] },
  { topic: "cyber", text: (e) => `A cyber attack disrupted billing systems for ${e.n} days.`, ask: [(e) => `${e.who} cyber attack billing systems`, (e) => `Was ${e.who} hacked?`] },
  { topic: "flood", text: (e) => `Flooding at the ${e.region} warehouse destroyed inventory.`, ask: [(e) => `${e.who} flooding warehouse ${e.region}`, (e) => `Did ${e.who} lose stock to bad weather?`] },
  { topic: "layoffs", text: (e) => `The company cut ${e.n * 10} jobs in a restructuring.`, ask: [(e) => `${e.who} cut jobs restructuring`, (e) => `Did ${e.who} lay people off?`] },
  { topic: "tax", text: (e) => `A one-time tax bill of $${e.x} million reduced earnings.`, ask: [(e) => `${e.who} one-time tax bill`, (e) => `What did the tax authority cost ${e.who}?`] },
  { topic: "fx", text: (e) => `Currency swings reduced reported results by ${e.n % 9 + 1}%.`, ask: [(e) => `${e.who} currency swings reduced results`, (e) => `How did exchange rates hurt ${e.who}?`] },
  { topic: "partner", text: (e) => `The company signed a partnership with ${e.party}.`, ask: [(e) => `${e.who} signed partnership ${e.party}`, (e) => `Who did ${e.who} team up with?`] },
  { topic: "spinoff", text: (e) => `The board approved a spin-off of the ${e.unit} division.`, ask: [(e) => `${e.who} spin-off ${e.unit} division`, (e) => `Which business is ${e.who} separating out?`] },
  { topic: "audit", text: () => `Auditors flagged a weakness in internal controls.`, ask: [(e) => `${e.who} auditors internal controls weakness`, (e) => `Did ${e.who}'s accountants find problems?`] },
];
// Manual chunks (6 per manual): every manual has the same sections.
const MANUAL = [
  { topic: "intro", text: (m) => `${m.name} user manual. Read this guide before using your ${m.name}.` },
  { topic: "reset", text: (m) => `Resetting the device: hold the power button for ${m.hold} seconds until the light blinks.` },
  { topic: "warranty", text: (m) => `Warranty: the device is covered for ${m.years} years from the date of purchase.` },
  { topic: "battery", text: (m) => `Battery: a full charge lasts about ${m.hours} hours of normal use.` },
  { topic: "pairing", text: (m) => `Pairing: open the app, choose Add device and enter code ${m.code}.` },
  { topic: "cleaning", text: (m) => `Cleaning: wipe with a dry cloth and do not use ${m.solvent}.` },
];

// Questions: the exact words a chunk uses, or a paraphrase (the same meaning in other words). People name a
// company or its ticker, and a quarter as "Q2" or "the second quarter".
const SPOKEN = { Q1: "first quarter of", Q2: "second quarter of", Q3: "third quarter of", Q4: "fourth quarter of" };
const ASK = {
  revenue: [(f) => `${f.who} revenue grew previous quarter ${f.q} ${f.year}`, (f) => `How much did ${f.who} sales rise in ${f.q} ${f.year}?`],
  margin: [(f) => `${f.who} operating margin ${f.q} ${f.year}`, (f) => `What was ${f.who}'s profitability in ${f.q} ${f.year}?`],
  headcount: [(f) => `${f.who} headcount employees ${f.q} ${f.year}`, (f) => `How many staff did ${f.who} have at the end of ${f.q} ${f.year}?`],
  cash: [(f) => `${f.who} cash and equivalents ${f.q} ${f.year}`, (f) => `How much money did ${f.who} hold in the bank after ${f.q} ${f.year}?`],
  outlook: [(f) => `${f.who} expects demand next quarter ${f.q} ${f.year}`, (f) => `What did ${f.who} forecast for sales after ${f.q} ${f.year}?`],
  buyback: [(f) => `${f.who} share repurchase ${f.q} ${f.year}`, (f) => `How big was ${f.who}'s stock buyback in ${f.q} ${f.year}?`],
  reset: [(m) => `${m.name} resetting the device power button`, (m) => `How do I restart my ${m.name}?`],
  warranty: [(m) => `${m.name} warranty years`, (m) => `How long is the ${m.name} guarantee?`],
  battery: [(m) => `${m.name} battery full charge hours`, (m) => `How long does the ${m.name} run on one charge?`],
  pairing: [(m) => `${m.name} pairing code app`, (m) => `How do I connect the ${m.name} to my phone?`],
};
const SHORT = { revenue: "sales", margin: "margin", headcount: "staff", cash: "cash", outlook: "outlook", buyback: "buyback", reset: "reset", warranty: "warranty", battery: "battery", pairing: "pairing" };
const EVENT_SHORT = { factory: "NEW FACTORY", recall: "RECALL", lawsuit: "LAWSUIT", strike: "STRIKE", launch: "LAUNCHES", ceo: "NEW CEO", dividend: "DIVIDEND", bonds: "BONDS", cyber: "CYBER ATTACK", flood: "FLOOD", layoffs: "JOB CUTS", tax: "TAX BILL", fx: "CURRENCY HIT", partner: "PARTNER", spinoff: "SPIN-OFF", audit: "AUDIT FLAG" };
export const MIX = { figure: 0.3, ticker: 0.55, spoken: 0.5, paraphrase: 0.5 };

function shuffled(r, list) { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function makeCorpus(seed) {
  const r = rngOf(seed);
  const chunks = [], questions = [];
  for (const co of COMPANIES) for (const year of YEARS) for (const q of QUARTERS) {
    const f = { co, q, year, up: r() < 0.6, rev: 1 + Math.floor(r() * 9), prevRev: 120 + Math.floor(r() * 400), margin: 8 + Math.floor(r() * 18), heads: 400 + Math.floor(r() * 2600), cash: 50 + Math.floor(r() * 600), buyback: 10 + 5 * Math.floor(r() * 30) };
    const doc = `${co} ${q} ${year}`;
    const where = `an SEC filing on ${co} Corp's performance in ${q} ${year}`;
    chunks.push({ id: chunks.length, doc, kind: "filing", topic: "cover", text: `${co} Corp quarterly report for ${q} ${year}. This filing covers results for the quarter.`, context: `This chunk is the cover of ${co} Corp's quarterly report for ${q} ${year}.` });
    const ids = {};
    for (const c of shuffled(r, FIGURES).slice(0, 3)) {
      ids[c.topic] = chunks.length;
      chunks.push({ id: chunks.length, doc, kind: "filing", topic: c.topic, text: c.text(f), context: `This chunk is from ${where}; ${c.prev(f)}.` });
    }
    const events = shuffled(r, EVENTS).slice(0, 2).map((ev) => ({ ev, e: { region: pick(r, REGIONS), party: pick(r, PARTIES), unit: pick(r, UNITS), n: 2 + Math.floor(r() * 40), x: 5 + Math.floor(r() * 200), cents: 10 + Math.floor(r() * 90) } }));
    for (const { ev, e } of events) {
      ids[ev.topic] = chunks.length;
      chunks.push({ id: chunks.length, doc, kind: "filing", topic: ev.topic, text: ev.text(e), context: `This chunk is from ${where}; it reports a ${ev.topic === "fx" ? "currency" : ev.topic} event that quarter.` });
    }
    // one question per filing: sometimes about one of its standard figures, usually about one of its events
    const who = r() < MIX.ticker ? TICKER[co] : co;
    const style = r() < MIX.paraphrase ? 1 : 0;
    if (r() < MIX.figure) {
      const topic = pick(r, Object.keys(ids).filter((t) => SHORT[t]));
      const asked = { ...f, who, q: r() < MIX.spoken ? SPOKEN[q] : q };
      questions.push({ text: ASK[topic][style](asked), gold: ids[topic], doc, topic, paraphrase: style === 1, label: `${who.toUpperCase()} ${SHORT[topic].toUpperCase()} ${q} ${year}` });
    } else {
      const { ev, e } = pick(r, events);
      questions.push({ text: ev.ask[style]({ ...e, who }), gold: ids[ev.topic], doc, topic: ev.topic, paraphrase: style === 1, label: `${who.toUpperCase()} ${EVENT_SHORT[ev.topic]}` });
    }
  }
  for (const name of PRODUCTS) {
    const m = { name, hold: 5 + Math.floor(r() * 20), years: 1 + Math.floor(r() * 4), hours: 6 + Math.floor(r() * 30), code: 1000 + Math.floor(r() * 9000), solvent: pick(r, ["solvents", "alcohol", "bleach"]) };
    const doc = `${name} manual`;
    const ids = {};
    MANUAL.forEach((c) => {
      ids[c.topic] = chunks.length;
      const context = c.topic === "intro" ? `This chunk is the opening page of the ${name} user manual.` : `This chunk is from the ${name} user manual, in the section on ${c.topic}.`;
      chunks.push({ id: chunks.length, doc, kind: "manual", topic: c.topic, text: c.text(m), context });
    });
    for (const topic of ["reset", "warranty", "battery", "pairing"]) {
      const style = r() < 0.5 ? 0 : 1;
      questions.push({ text: ASK[topic][style](m), gold: ids[topic], doc, topic, paraphrase: style === 1, label: `${name.toUpperCase()} ${SHORT[topic].toUpperCase()}` });
    }
  }
  return { chunks, questions };
}

// ---------- words ----------
const STOP = new Set("a an and are as at be by did do does for from how i in is it its my of on one or the this to was what with your after before end long until use using much many big".split(" "));
export const tokens = (s) => s.toLowerCase().replace(/'s\b/g, "").split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));

// Synonyms share one meaning in the embedding (and only there: BM25 sees the words).
const MEANING = {
  revenue: "revenue", sales: "revenue", turnover: "revenue",
  grew: "up", rise: "up", rose: "up", increase: "up", strengthen: "up",
  fell: "down", soften: "down", declined: "down",
  operating: "margin", margin: "margin", profitability: "margin", profit: "margin",
  headcount: "staff", employees: "staff", staff: "staff", workforce: "staff",
  cash: "cash", money: "cash", bank: "cash", equivalents: "cash", hold: "cash",
  expects: "outlook", forecast: "outlook", outlook: "outlook", demand: "outlook", next: "outlook",
  share: "buyback", repurchase: "buyback", buyback: "buyback", stock: "buyback",
  acquisition: "deal", buy: "deal", pay: "deal", acquisitions: "deal", completed: "deal",
  resetting: "reset", reset: "reset", restart: "reset", reboot: "reset", power: "reset", button: "reset",
  warranty: "warranty", guarantee: "warranty", covered: "warranty", years: "warranty",
  battery: "battery", charge: "battery", run: "battery", lasts: "battery", hours: "battery",
  pairing: "pair", connect: "pair", phone: "pair", app: "pair", code: "pair", add: "pair",
  cleaning: "clean", wipe: "clean", cloth: "clean",
  quarterly: "report", report: "report", filing: "report", sec: "report", performance: "report", results: "report", cover: "report", section: "report",
  manual: "manual", guide: "manual", user: "manual", opening: "manual", page: "manual", device: "manual",
  quarter: "quarter", previous: "quarter",
  factory: "factory", plant: "factory", build: "factory", opened: "factory",
  recall: "recall", back: "recall", items: "units", units: "units", customers: "recall",
  lawsuit: "lawsuit", legal: "lawsuit", dispute: "lawsuit", settled: "settle", brought: "lawsuit",
  labour: "labour", workers: "labour", strike: "strike", walk: "strike", out: "strike", production: "strike",
  launched: "launch", introduce: "launch", products: "launch", offerings: "launch", new: "new",
  chief: "ceo", executive: "ceo", ceo: "ceo", took: "ceo", office: "ceo", change: "ceo",
  dividend: "dividend", shareholders: "dividend", payout: "dividend", raised: "dividend",
  bonds: "debt", borrow: "debt", investors: "debt", issued: "debt", due: "debt",
  cyber: "cyber", attack: "cyber", hacked: "cyber", billing: "cyber", systems: "cyber",
  flooding: "flood", weather: "flood", bad: "flood", warehouse: "flood", lose: "flood", inventory: "stock", destroyed: "flood",
  cut: "layoff", jobs: "layoff", lay: "layoff", people: "layoff", restructuring: "layoff",
  tax: "tax", authority: "tax", bill: "tax", earnings: "tax", reduced: "reduce",
  currency: "fx", exchange: "fx", rates: "fx", swings: "fx", hurt: "reduce",
  partnership: "partner", team: "partner", signed: "partner",
  spin: "spinoff", separating: "spinoff", division: "spinoff", business: "spinoff",
  auditors: "audit", accountants: "audit", internal: "audit", controls: "audit", weakness: "audit", flagged: "audit", problems: "audit", find: "audit",
};
const meaningOf = (w) => (MEANING[w] ? "#" + MEANING[w] : w);
const CLASS = new Map();
COMPANIES.forEach((c) => CLASS.set(c.toLowerCase(), "company"));
PRODUCTS.forEach((p) => CLASS.set(p.toLowerCase(), "product"));
PARTIES.forEach((t) => CLASS.set(t.toLowerCase(), "target"));
UNITS.forEach((t) => CLASS.set(t, "unit"));
const TICK_OF = Object.fromEntries(COMPANIES.map((c) => [TICKER[c].toLowerCase(), c.toLowerCase()]));
REGIONS.forEach((t) => CLASS.set(t.toLowerCase(), "place"));
QUARTERS.forEach((q) => CLASS.set(q.toLowerCase(), "qtr"));
CLASS.set("corp", "corp"); YEARS.forEach((y) => CLASS.set(String(y), "year"));
const QTR_ALIAS = { first: "q1", second: "q2", third: "q3", fourth: "q4" };
const alias = (w) => QTR_ALIAS[w] || TICK_OF[w] || w;
const isEntity = (w) => ["company", "product", "target", "qtr", "place", "unit", "year"].includes(CLASS.get(w));

// ---------- a toy embedding ----------
// Each meaning is a fixed random direction. A name is mostly its class (any company looks a lot like any other
// company to an embedding) plus a little of itself; numbers barely register. That is the behaviour that matters:
// embeddings match paraphrases well and exact names and codes poorly.
export const DIM = 64;
const dirCache = new Map();
function dirOf(key) {
  let v = dirCache.get(key);
  if (v) return v;
  const r = rngOf(hashOf(key));
  v = new Float64Array(DIM);
  let n = 0;
  for (let i = 0; i < DIM; i++) { const u = Math.max(1e-9, r()), w = r(); v[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w); n += v[i] * v[i]; }
  n = Math.sqrt(n);
  for (let i = 0; i < DIM; i++) v[i] /= n;
  dirCache.set(key, v);
  return v;
}
const OWN = { company: 0.2, product: 0.5, target: 0.5, unit: 0.5, qtr: 0.24, place: 0.5, corp: 0, year: 0.2 };
function wordVector(word) {
  const w = alias(word);
  const cls = CLASS.get(w);
  if (cls) {
    const own = OWN[cls], base = dirOf("class:" + cls), self = dirOf("word:" + w);
    return { v: base.map((x, i) => x * Math.sqrt(1 - own * own) + self[i] * own), weight: cls === "corp" ? 0.3 : 0.75 };
  }
  if (/^\d+$/.test(w)) return { v: dirOf("num:" + w), weight: 0.22 };
  const m = MEANING[w];
  return { v: dirOf("m:" + meaningOf(w)), weight: m === "report" || m === "manual" || m === "quarter" ? 0.45 : 1 };
}
export function embed(text) {
  const out = new Float64Array(DIM);
  for (const w of tokens(text)) { const { v, weight } = wordVector(w); for (let i = 0; i < DIM; i++) out[i] += v[i] * weight; }
  let n = 0;
  for (let i = 0; i < DIM; i++) n += out[i] * out[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < DIM; i++) out[i] /= n;
  return out;
}
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

// ---------- BM25 ----------
export function bm25Index(docs, k1 = 1.2, b = 0.75) {
  const toks = docs.map(tokens);
  const avg = meanBy(toks, (t) => t.length);
  const df = new Map();
  toks.forEach((t) => new Set(t).forEach((w) => df.set(w, (df.get(w) || 0) + 1)));
  const N = docs.length;
  const idf = (w) => { const n = df.get(w) || 0; return Math.log(1 + (N - n + 0.5) / (n + 0.5)); };
  const tf = toks.map((t) => { const m = new Map(); t.forEach((w) => m.set(w, (m.get(w) || 0) + 1)); return m; });
  return {
    score(query) {
      const q = [...new Set(tokens(query))];
      return tf.map((m, i) => q.reduce((s, w) => { const f = m.get(w) || 0; return f ? s + idf(w) * (f * (k1 + 1)) / (f + k1 * (1 - b + b * toks[i].length / avg)) : s; }, 0));
    },
  };
}

// ---------- ranking ----------
const rankOf = (scores) => scores.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map((x) => x[1]);
// Reciprocal rank fusion (k = 60): each list contributes weight / (60 + rank); scores themselves are never compared.
export const FUSE_WEIGHTS = [0.8, 0.2];   // meaning, keywords
export function fuse(lists, weights = lists.map(() => 1), k = 60) {
  const s = new Map();
  lists.forEach((list, j) => list.forEach((id, i) => s.set(id, (s.get(id) || 0) + weights[j] / (k + i + 1))));
  return [...s.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map((x) => x[0]);
}
// The reranker reads the query and the whole chunk (with its context, if it has one) together: it judges whether
// the chunk is about what was asked, and, when it is, whether the names match exactly (it knows tickers and
// "the second quarter"). Like any model it makes small mistakes (the noise term).
function rerankScore(qText, cText, r) {
  const qt = tokens(qText).map(alias), ct = new Set(tokens(cText));
  const cm = new Set([...ct].map(meaningOf));
  const content = qt.filter((w) => !CLASS.has(w) && !/^\d+$/.test(w) && MEANING[w] !== "report" && MEANING[w] !== "manual");
  const meaning = content.length ? content.filter((w) => cm.has(meaningOf(w))).length / content.length : 0;
  const names = qt.filter(isEntity);
  const exact = names.length ? names.filter((w) => ct.has(w)).length / names.length : 0;
  const u = Math.max(1e-9, r()), v = r();
  return meaning * (0.55 + 0.45 * exact) + 0.12 * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const POOL = 150;   // chunks retrieved before reranking (the post: top 150, then keep 20)

// Build the indexes for one corpus and one way of chunking (plain or with context).
export function buildIndex(corpus, contextual) {
  const textOf = (c) => (contextual ? c.context + " " + c.text : c.text);
  const docs = corpus.chunks.map(textOf);
  return { contextual, docs, vectors: docs.map(embed), bm25: bm25Index(docs) };
}

// Retrieve for one question: returns where the answer chunk landed at every stage.
export function retrieve(index, question, { bm25 = false, rerank = false, k = 20, seed = 1 } = {}) {
  const qv = embed(question.text);
  const byMeaning = rankOf(index.vectors.map((v) => dot(v, qv)));
  let first = byMeaning;
  if (bm25) {
    // BM25 returns only the chunks that share a word with the query; fusion uses that list as it is
    const scores = index.bm25.score(question.text);
    first = fuse([byMeaning, rankOf(scores).filter((i) => scores[i] > 0)], FUSE_WEIGHTS);
  }
  const firstRank = first.indexOf(question.gold);
  let final = first;
  if (rerank) {
    const r = rngOf(seed ^ (question.gold * 2654435761));
    const pool = first.slice(0, POOL);
    const scored = pool.map((id) => [rerankScore(question.text, index.docs[id], r), id]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    final = scored.map((x) => x[1]);
  }
  const finalRank = final.indexOf(question.gold);   // -1: not in the reranked pool
  return { firstRank, inPool: firstRank >= 0 && firstRank < POOL, finalRank, found: finalRank >= 0 && finalRank < k, top: final.slice(0, k) };
}

// Run every question for a setting; failure rate = share of questions whose answer chunk is not in the top k.
export function evaluate(corpus, index, opts) {
  let failed = 0;
  const rows = corpus.questions.map((q, i) => { const res = retrieve(index, q, { ...opts, seed: (opts.seed || 1) + i }); if (!res.found) failed++; return res; });
  return { failed, asked: corpus.questions.length, rate: failed / corpus.questions.length, rows };
}

// ---------- cost of writing the context (the post's assumptions, Claude 3 Haiku list prices) ----------
export const PRICE = { input: 0.25, output: 1.25, cacheWrite: 0.3, cacheRead: 0.03 };   // $ per million tokens
export function contextCost({ caching = true, docTokens = DOC_TOKENS, chunkTokens = CHUNK_TOKENS, instructions = 50, context = 100 } = {}) {
  const chunks = docTokens / chunkTokens;            // calls per document
  const docs = 1e6 / docTokens;                      // documents per million document tokens
  const out = chunks * context * PRICE.output;
  const fresh = chunks * (instructions + chunkTokens) * PRICE.input;
  const docPart = caching ? docTokens * PRICE.cacheWrite + (chunks - 1) * docTokens * PRICE.cacheRead : chunks * docTokens * PRICE.input;
  return (docs * (out + fresh + docPart)) / 1e6;     // $ per million document tokens
}
export const corpusTokens = (corpus) => corpus.chunks.length * CHUNK_TOKENS;

// ---------- the five experiments, averaged over seeds ----------
const SEEDS = [7, 11, 23, 31, 47, 59];
function average(make) {
  const sum = {};
  for (const s of SEEDS) { const r = make(s); for (const key in r) sum[key] = (sum[key] || 0) + r[key] / SEEDS.length; }
  return sum;
}
const cache = new Map();
function indexesOf(seed) {
  if (!cache.has(seed)) { const corpus = makeCorpus(seed); cache.set(seed, { corpus, plain: buildIndex(corpus, false), ctx: buildIndex(corpus, true) }); }
  return cache.get(seed);
}
const fail = (seed, which, opts) => { const x = indexesOf(seed); return evaluate(x.corpus, x[which], { ...opts, seed }).rate * 100; };

export function expEmbeddings() {
  return average((s) => ({ plain: fail(s, "plain", {}), ctx: fail(s, "ctx", {}) }));
}
export function expBm25() {
  return average((s) => ({ ctx: fail(s, "ctx", {}), both: fail(s, "ctx", { bm25: true }), plainBoth: fail(s, "plain", { bm25: true }) }));
}
export function expRerank() {
  return average((s) => ({ plain: fail(s, "plain", {}), both: fail(s, "ctx", { bm25: true }), reranked: fail(s, "ctx", { bm25: true, rerank: true }), plainReranked: fail(s, "plain", { bm25: true, rerank: true }) }));
}
export function expTopK() {
  return average((s) => ({ k5: fail(s, "ctx", { bm25: true, rerank: true, k: 5 }), k10: fail(s, "ctx", { bm25: true, rerank: true, k: 10 }), k20: fail(s, "ctx", { bm25: true, rerank: true, k: 20 }) }));
}
export function expCost() {
  const x = indexesOf(SEEDS[0]);
  const one = x.corpus.chunks.filter((c) => c.doc.startsWith("Acme ")).length * CHUNK_TOKENS;
  return { cached: contextCost({ caching: true }), uncached: contextCost({ caching: false }), corpusTokens: corpusTokens(x.corpus), oneCompany: one, budget: 200000 };
}

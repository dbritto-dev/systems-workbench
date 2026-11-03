// @ts-nocheck: model code ported as-is; shared helpers come from src/lib.
// Semantic search over a small help centre, with a toy embedding model that really computes.
// Shared by the live figure and the experiments; everything is seeded and deterministic.
//
// The embedding: every known word adds weight to one or more of 16 meaning axes (billing, refund,
// login, shipping, error, ...) plus a small word-specific wobble, so synonyms land close together but
// not on top of each other. Words the model has no meaning for (product names, codes, numbers) only
// get a hashed bucket in 24 "surface" dimensions, which is why exact identifiers come out blurry.
// A shared "generic" axis gives every text some similarity to every other, as real models do
// (cosine between unrelated texts is around 0.2-0.3, not 0).

import { meanBy } from "../../lib/stats";
import { fnv1a } from "../../lib/random";

export const CONCEPTS = ["PAYMENTS", "DUPLICATES", "REFUNDS", "TIME", "SIGN-IN", "SECURITY", "SHIPPING", "ERRORS", "API", "EXPORTS", "PLANS", "INVOICES", "ACCOUNT", "MOBILE", "ALERTS", "SUPPORT"];
const C = CONCEPTS.length, H = 24, DIM = C + H + 1, GENERIC = 0.62;

const LEX = (() => {
  const L = {};
  const add = (c, words, w = 1) => words.split(" ").forEach((x) => { (L[x] ||= {})[c] = w; });
  add(0, "charge charged charges billed bill billing payment payments pay paid card cards transaction transactions checkout purchase money paypal amount method bank transfer hold pending authorisation authorization");
  add(1, "twice duplicate duplicated double", 1.6);
  add(1, "same extra repeated two times again");
  add(2, "refund refunds refunded reimburse back return returned prorated partial");
  add(3, "days hours hour minutes long takes take until week soon immediately period expires valid date time");
  add(4, "login log sign signing password reset forgot locked attempts link");
  add(5, "security secure two-factor authentication codes backup lost secret signature hacked suspicious authenticator rotate");
  add(6, "ship ships shipping delivery deliver deliveries package parcel tracking courier arrive arrives express standard countries pets");
  add(7, "error errors err fail failed fails failing wrong problem broken declines declined issue goes");
  add(8, "api webhook webhooks endpoint request requests keys key developers developer http server event calls rate limits");
  add(9, "export exports csv download report reports spreadsheet file schedule scheduled data");
  add(10, "subscription plan plans cancel cancelled cancelling upgrade upgrades downgrade renewal annual trial stop");
  add(11, "invoice invoices receipt receipts tax vat statement pdf");
  add(12, "account profile name address delete deleting deleted removes undone undo change close");
  add(13, "app mobile phone iphone android push");
  add(14, "notifications notification alert emailed email message hear notify");
  add(15, "help support contact agent chat ticket");
  L.email = { 12: 0.5, 14: 0.6 };
  L.code = { 5: 0.6, 7: 0.6 };
  L.lost = { 5: 0.7, 12: 0.3 };
  L.statement = { 11: 0.7, 0: 0.5 };
  L.deliveries = { 6: 0.8, 8: 0.2 };
  return L;
})();
const STOP = new Set("a an the and or of to in on at by for from is are was were be been it its this that these those i my me you your we our us can do does did how what when where why which who will would should could if with as not no yes any all there here up out about after before before into than then so very just get gets got has have had use using under one show shows other usually most also more".split(" "));

function hash(s, mod) { return fnv1a(s) % mod; }
function wobble(word, axis) { return ((hash(word + "|" + axis, 1000) / 1000) - 0.5) * 0.3; }
const stems = (w) => [w, w.replace(/ies$/, "y"), w.replace(/es$/, ""), w.replace(/s$/, ""), w.replace(/ed$/, ""), w.replace(/ing$/, ""), w.replace(/d$/, "")];

export function tokens(text) {
  return text.toLowerCase().split(/[^a-z0-9-]+/)
    .flatMap((t) => (t === "two-factor" ? [t] : t.startsWith("err-") ? ["err", t.slice(4)] : t.split("-")))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export function embed(text) {
  const v = new Array(DIM).fill(0);
  for (const t of tokens(text)) {
    const key = stems(t).find((s) => LEX[s]);
    if (key) {
      for (const [c, w] of Object.entries(LEX[key])) v[+c] += w;
      for (let c = 0; c < C; c++) v[c] += wobble(key, c) * 0.5;
      v[C + hash(key, H)] += 0.18;
    } else {
      v[C + hash(t, H)] += /^\d+$/.test(t) ? 0.45 : 0.7;
    }
  }
  let n = Math.hypot(...v);
  if (n === 0) n = 1;
  v[DIM - 1] = GENERIC * n;
  n = Math.hypot(...v);
  return v.map((x) => x / n);
}
export const cosine = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
export const dominant = (v) => { let best = 0; for (let c = 1; c < C; c++) if (v[c] > v[best]) best = c; return best; };

// ---------- the help centre: 10 documents, each in sections of one to three sentences ----------
export const DOCS = [
  { id: "A", title: "Payments and charges", sections: [
    ["Duplicate charges", ["Seeing the same transaction two times on your statement is usually a pending authorisation.", "The extra hold drops off by itself within a few days.", "If both stay after a week, contact support and we refund one."]],
    ["Failed payments", ["A payment can fail when the card is expired or the bank declines it.", "We retry a failed payment three times before pausing the plan."]],
    ["Payment methods", ["You can pay by card, bank transfer or PayPal.", "Change the default payment method under Billing."]] ] },
  { id: "B", title: "Refunds", sections: [
    ["Requesting a refund", ["Refunds go back to the original card used for the purchase.", "It usually takes 5 to 7 business days."]],
    ["Partial refunds", ["Partial refunds are available for annual plans cancelled within 30 days.", "The amount is prorated by the days left."]] ] },
  { id: "C", title: "Signing in", sections: [
    ["Forgotten password", ["Use Forgot password on the sign-in page to get a reset link.", "The link expires after one hour."]],
    ["Locked accounts", ["After ten wrong attempts the account is locked for 30 minutes."]],
    ["Two-factor", ["Turn on two-factor authentication in Security settings.", "Lost your phone? Use one of your backup codes."]] ] },
  { id: "D", title: "Shipping", sections: [
    ["Delivery times", ["Standard delivery takes 3 to 5 business days.", "Express arrives the next day if ordered before noon."]],
    ["Tracking", ["Every package gets a tracking number by email when it ships."]],
    ["Where we ship", ["We ship to the US, Canada, the UK and the EU.", "Other countries are not supported yet."]] ] },
  { id: "E", title: "Errors", sections: [
    ["Error messages", ["When something goes wrong we show an error message with a short code.", "Most errors clear if you refresh and try again."]],
    ["Checkout errors", ["A checkout error usually means the payment failed, so check the card details."]],
    ["ERR-4012", ["ERR-4012 means the webhook signature did not match your signing secret.", "Rotate the secret in the dashboard and update your server."]] ] },
  { id: "F", title: "API and webhooks", sections: [
    ["API keys", ["Create API keys under Developers and keep secret keys on your server."]],
    ["Webhooks", ["Webhooks send an HTTP request to your endpoint when an event happens.", "We retry failed deliveries for up to three days."]],
    ["Rate limits", ["The API allows 100 requests per second per key."]] ] },
  { id: "G", title: "Exports and reports", sections: [
    ["CSV exports", ["Export transactions as a CSV file from the Reports page.", "Large exports are emailed to you when they finish."]],
    ["Scheduled reports", ["Schedule a weekly report to arrive every Monday."]] ] },
  { id: "H", title: "Subscriptions", sections: [
    ["Changing plan", ["Upgrade or downgrade your plan at any time from Billing.", "Upgrades take effect immediately and are prorated."]],
    ["Cancelling", ["Cancel your subscription before the renewal date to avoid the next charge.", "Your account stays active until the end of the period."]] ] },
  { id: "I", title: "Invoices and tax", sections: [
    ["Invoices", ["An invoice is emailed after every payment.", "Download past invoices as PDF from Billing."]],
    ["Tax", ["Add your VAT number to show it on future invoices."]] ] },
  { id: "J", title: "Your account", sections: [
    ["Profile", ["Change your name, email and address in Profile."]],
    ["Deleting your account", ["Deleting your account removes all your data after 30 days.", "This cannot be undone."]],
    ["Mobile app", ["The mobile app works on iPhone and Android.", "Turn on push notifications to hear about payments."]] ] },
];

// Chunks at three sizes. A sentence chunk is only the sentence; a section chunk carries its heading;
// a whole-document chunk is everything in the document.
export function chunk(size) {
  const out = [];
  DOCS.forEach((doc) => {
    if (size === "doc") {
      const text = doc.title + ". " + doc.sections.map(([h, ps]) => h + ". " + ps.join(" ")).join(" ");
      out.push({ id: doc.id, doc: doc.id, text, title: doc.title, parts: doc.sections.flatMap((s, si) => s[1].map((_, pi) => doc.id + (si + 1) + "." + (pi + 1))) });
    } else doc.sections.forEach(([head, ps], si) => {
      if (size === "section") out.push({ id: doc.id + (si + 1), doc: doc.id, text: head + ". " + ps.join(" "), title: head, parts: ps.map((_, pi) => doc.id + (si + 1) + "." + (pi + 1)) });
      else ps.forEach((p, pi) => out.push({ id: doc.id + (si + 1) + "." + (pi + 1), doc: doc.id, text: p, title: head, parts: [doc.id + (si + 1) + "." + (pi + 1)] }));
    });
  });
  for (const c of out) { c.vec = embed(c.text); c.words = c.text.split(/\s+/).length; c.topic = dominant(c.vec); }
  return out;
}

// ---------- search ----------
export function exact(qv, chunks, k) {
  const scored = chunks.map((c, i) => ({ i, s: cosine(qv, c.vec) })).sort((a, b) => b.s - a.s);
  return { hits: scored.slice(0, k), compared: chunks.length, order: chunks.map((_, i) => i) };
}

// A navigable small-world graph (one layer of HNSW): every point links to its m nearest by vector,
// links kept both ways, plus one long link per point so a search can cross between clusters.
export function makeGraph(vecs, m = 4, seed = 7, long = 1) {
  const n = vecs.length, links = vecs.map(() => new Set());
  for (let i = 0; i < n; i++) {
    const near = [];
    for (let j = 0; j < n; j++) if (j !== i) near.push([cosine(vecs[i], vecs[j]), j]);
    near.sort((a, b) => b[0] - a[0]);
    for (const [, j] of near.slice(0, m)) { links[i].add(j); links[j].add(i); }
  }
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let r = 0; r < long; r++) for (let i = 0; i < n; i++) { const j = Math.floor(rnd() * n); if (j !== i) { links[i].add(j); links[j].add(i); } }
  // join any islands to the rest through their closest pair, so every point can be reached
  for (;;) {
    const comp = new Array(n).fill(-1), stack = [0]; comp[0] = 0;
    while (stack.length) { const a = stack.pop(); for (const b of links[a]) if (comp[b] < 0) { comp[b] = 0; stack.push(b); } }
    if (comp.every((c) => c === 0)) break;
    let best = [-Infinity, 0, 0];
    for (let i = 0; i < n; i++) if (comp[i] === 0) for (let j = 0; j < n; j++) if (comp[j] < 0) { const s = cosine(vecs[i], vecs[j]); if (s > best[0]) best = [s, i, j]; }
    links[best[1]].add(best[2]); links[best[2]].add(best[1]);
  }
  return links.map((l) => [...l]);
}

// Beam search from a fixed entry point: keep the ef best found so far, expand the closest unexpanded
// candidate, stop when no candidate can beat the worst kept. Returns the top k, every point it
// compared (in order) and the hops it made, for the figure.
export function graphSearch(qv, vecs, links, { ef = 8, k = 5, entry = 0 } = {}) {
  const sim = (i) => cosine(qv, vecs[i]);
  const seen = new Set([entry]), compared = [entry], hops = [];
  let cand = [[sim(entry), entry]], best = [[sim(entry), entry]];
  while (cand.length) {
    cand.sort((a, b) => b[0] - a[0]);
    const [cs, c] = cand.shift();
    const worst = best.length >= ef ? best[best.length - 1][0] : -Infinity;
    if (cs < worst) break;
    for (const j of links[c]) {
      if (seen.has(j)) continue;
      seen.add(j); compared.push(j); hops.push([c, j]);
      const sj = sim(j);
      if (best.length < ef || sj > best[best.length - 1][0]) {
        cand.push([sj, j]); best.push([sj, j]); best.sort((a, b) => b[0] - a[0]);
        if (best.length > ef) best.pop();
      }
    }
  }
  return { hits: best.slice(0, k).map(([s, i]) => ({ i, s })), compared: compared.length, order: compared, hops };
}

// ---------- the map: a flat picture of a 41-dimensional space ----------
// Classical scaling (stress majorisation, SMACOF) on the distances between unit vectors, started
// from the first two principal directions, then scaled into the map and nudged apart so studs
// don't sit on each other. Ranking never uses this picture, only the true cosine.
export function layout(chunks, box, { gap = 7, seed = 3 } = {}) {
  const n = chunks.length, V = chunks.map((c) => c.vec);
  const D = V.map((a) => V.map((b) => Math.sqrt(Math.max(0, 2 - 2 * cosine(a, b)))));
  const mean = V[0].map((_, d) => meanBy(V, (v) => v[d]));
  const X0 = V.map((v) => v.map((x, d) => x - mean[d]));
  const pc = (avoid) => {
    let p = V[0].map((_, d) => Math.sin(d * 1.7 + seed + (avoid ? 2 : 0)));
    for (let it = 0; it < 60; it++) {
      const q = p.map(() => 0);
      for (const x of X0) { const t = x.reduce((s, xi, d) => s + xi * p[d], 0); x.forEach((xi, d) => (q[d] += t * xi)); }
      if (avoid) { const t = q.reduce((s, qi, d) => s + qi * avoid[d], 0); q.forEach((_, d) => (q[d] -= t * avoid[d])); }
      const nq = Math.hypot(...q) || 1; p = q.map((x) => x / nq);
    }
    return p;
  };
  const p1 = pc(null), p2 = pc(p1);
  let X = X0.map((x) => [x.reduce((s, xi, d) => s + xi * p1[d], 0), x.reduce((s, xi, d) => s + xi * p2[d], 0)]);
  for (let it = 0; it < 150; it++) {
    const Y = X.map(() => [0, 0]);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dx = X[i][0] - X[j][0], dy = X[i][1] - X[j][1], dij = Math.hypot(dx, dy) || 1e-9, b = D[i][j] / dij;
      Y[i][0] += b * (X[i][0] - X[j][0]) + X[j][0]; Y[i][1] += b * (X[i][1] - X[j][1]) + X[j][1];
    }
    X = Y.map(([x, y]) => [x / n, y / n]);
  }
  const xs = X.map((p) => p[0]), ys = X.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const sx = (box.w - 2 * box.pad) / (x1 - x0 || 1), sy = (box.d - 2 * box.pad) / (y1 - y0 || 1);
  let P = X.map(([x, y]) => [box.x + box.pad + (x - x0) * sx, box.y + box.pad + (y - y0) * sy]);
  for (let it = 0; it < 80; it++) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1], d = Math.hypot(dx, dy) || 0.01;
      if (d < gap) { const push = (gap - d) / 2, ux = dx / d, uy = dy / d; P[i][0] -= ux * push; P[i][1] -= uy * push; P[j][0] += ux * push; P[j][1] += uy * push; }
    }
    P = P.map(([x, y]) => [Math.min(box.x + box.w - box.pad / 2, Math.max(box.x + box.pad / 2, x)), Math.min(box.y + box.d - box.pad / 2, Math.max(box.y + box.pad / 2, y))]);
  }
  return P;
}

// ---------- the queries the figure and the experiments use ----------
export const QUERIES = [
  { id: "twice", text: "my card was charged twice", gold: ["A1.1", "A1.2", "A1.3"] },
  { id: "refund", text: "how long until my refund shows up", gold: ["B1.2"] },
  { id: "err", text: "ERR-4012", gold: ["E3.1"] },
  { id: "pets", text: "do you ship pets", gold: [] },
  { id: "phone", text: "lost my phone and can't log in", gold: ["C3.2"] },
];
export const QUESTIONS = [
  ["how long until my refund shows up", ["B1.2"]],
  ["how long is the password reset link valid", ["C1.2"]],
  ["my card was charged twice", ["A1.1", "A1.2", "A1.3"]],
  ["can I undo deleting my account", ["J2.2"]],
  ["do you deliver to Australia", ["D3.2"]],
  ["what does ERR-4012 mean", ["E3.1"]],
  ["how many API calls can I make", ["F3.1"]],
  ["where do I download my receipts", ["I1.2"]],
  ["will I be charged after I cancel", ["H2.1"]],
  ["when does express shipping arrive", ["D1.2"]],
  ["how do I get a csv of my payments", ["G1.1"]],
  ["I lost my phone and can't log in", ["C3.2"]],
  ["the payment keeps failing at checkout", ["E2.1", "A2.1"]],
  ["how long is my account locked", ["C2.1"]],
];
export const rankOf = (hits, chunks, gold) => { const i = hits.findIndex((h) => chunks[h.i].parts.some((p) => gold.includes(p))); return i < 0 ? null : i + 1; };

// ---------- experiments ----------
export function paraphraseRun() {
  const ch = chunk("sentence"), q = QUERIES[0], qv = embed(q.text);
  const r = exact(qv, ch, 5);
  const shared = tokens(q.text).filter((t) => tokens(ch[r.hits[0].i].text).includes(t));
  return { top: ch[r.hits[0].i].id, text: ch[r.hits[0].i].text, sim: r.hits[0].s, shared: shared.length, rank: rankOf(r.hits, ch, q.gold),
    hits: r.hits.map((h) => ({ id: ch[h.i].id, s: h.s })) };
}

export function codeRun() {
  const ch = chunk("sentence"), qv = embed("ERR-4012");
  const r = exact(qv, ch, 10);
  const target = r.hits.findIndex((h) => ch[h.i].id === "E3.1");
  const all = exact(qv, ch, ch.length).hits;
  return { hits: r.hits.slice(0, 5).map((h) => ({ id: ch[h.i].id, s: h.s, text: ch[h.i].text })), rank: all.findIndex((h) => ch[h.i].id === "E3.1") + 1, targetSim: all.find((h) => ch[h.i].id === "E3.1").s };
}

// A sentence that only makes sense next to its neighbour ("It usually takes 5 to 7 business days.")
// is no use on its own: the model reading it can't tell what takes 5 to 7 days.
export const NEEDS = { "B1.2": "B1.1", "C1.2": "C1.1", "J2.2": "J2.1", "D3.2": "D3.1", "B2.2": "B2.1", "H2.2": "H2.1" };

// Top 3 chunks at each size: is a usable answer in what was handed over, how many words did that
// cost, and how well did the chunk holding the answer score?
export function chunkRun(k = 3) {
  const out = {}, corpus = chunk("doc").reduce((s, c) => s + c.words, 0);
  for (const size of ["sentence", "section", "doc"]) {
    const ch = chunk(size);
    let found = 0, words = 0, ctxLost = 0, goldSim = 0;
    const miss = [];
    for (const [text, gold] of QUESTIONS) {
      const qv = embed(text), take = exact(qv, ch, k).hits;
      words += take.reduce((s, h) => s + ch[h.i].words, 0);
      const have = new Set(take.flatMap((h) => ch[h.i].parts));
      const there = gold.filter((g) => have.has(g));
      const holder = ch.filter((c) => c.parts.some((p) => gold.includes(p))).map((c) => cosine(qv, c.vec));
      goldSim += Math.max(...holder);
      if (there.some((g) => !NEEDS[g] || have.has(NEEDS[g]))) found++;
      else { if (there.length) ctxLost++; miss.push(text + (there.length ? " (found, without its context)" : "")); }
    }
    const n = QUESTIONS.length;
    out[size] = { found, of: n, ctxLost, words: words / n, share: words / n / corpus, goldSim: goldSim / n, miss, chunks: ch.length, avgWords: ch.reduce((s, c) => s + c.words, 0) / ch.length };
  }
  out.corpus = corpus;
  return out;
}

// A bigger synthetic collection for the index: 3000 chunks made of 1-3 topics each, 200 queries.
export function synthetic(n, seed) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const vecs = [];
  for (let i = 0; i < n; i++) {
    const v = new Array(DIM).fill(0), topics = 1 + Math.floor(rnd() * 3);
    for (let t = 0; t < topics; t++) v[Math.floor(rnd() * C)] += 0.5 + rnd();
    for (let d = 0; d < C; d++) v[d] += (rnd() - 0.5) * 0.35;
    for (let d = C; d < C + H; d++) v[d] += (rnd() - 0.5) * 0.25;
    let nn = Math.hypot(...v); v[DIM - 1] = GENERIC * nn; nn = Math.hypot(...v);
    vecs.push(v.map((x) => x / nn));
  }
  return vecs;
}
export function annRun() {
  const N = 3000, vecs = synthetic(N, 11), queries = synthetic(200, 97), links = makeGraph(vecs, 6, 5);
  const truth = queries.map((q) => exact(q, vecs.map((vec) => ({ vec })), 10).hits.map((h) => h.i));
  const out = { N, exact: { recall: 1, compared: N } };
  for (const ef of [10, 40, 160]) {
    let rec = 0, cmp = 0;
    queries.forEach((q, qi) => { const r = graphSearch(q, vecs, links, { ef, k: 10, entry: 0 }); rec += r.hits.filter((h) => truth[qi].includes(h.i)).length / 10; cmp += r.compared; });
    out["ef" + ef] = { recall: rec / queries.length, compared: cmp / queries.length };
  }
  return out;
}

export const THRESHOLD_QUERIES = [
  ["refund", ["B1.1", "B1.2", "B2.1", "B2.2"]],
  ["do you ship pets", []],
  ["help", []],
  ["how long is the password reset link valid", ["C1.2"]],
  ["will I still be charged if I cancel my subscription", ["H2.1"]],
];
export function thresholdRun(cut = 0.8) {
  const ch = chunk("sentence");
  return THRESHOLD_QUERIES.map(([text, gold]) => {
    const ranked = exact(embed(text), ch, ch.length).hits;
    const kept = ranked.filter((h) => h.s >= cut);
    const good = kept.filter((h) => ch[h.i].parts.some((p) => gold.includes(p))).length;
    const bestGold = ranked.find((h) => ch[h.i].parts.some((p) => gold.includes(p)));
    return { text, kept: kept.length, good, junk: kept.length - good, top: ranked[0].s, top1: ch[ranked[0].i].id, gold: gold.length, goldSim: bestGold ? bestGold.s : null };
  });
}

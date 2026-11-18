// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// Two desks answer the same tickets. The writing desk is a generative model: it reads the ticket, then writes its
// answer one token after another, and a parser checks that what it wrote is one of the options; a reply that isn't
// goes back to be written again. The sorting desk is a decision model: it reads the ticket once and scores every
// option in the same pass, and the highest score takes the ticket. Seeded and shared by the live figure and the
// experiments. Times are seconds.
//
// The constants are illustrative and round, not measurements of any product:
//   writing desk   READ_W to read the ticket and start (time to first token), then TOKEN a token (50 a second)
//   sorting desk   READ_S for its one pass, plus a little per question and per option
// How TypeSafe's Jev works inside isn't published; this desk is the general mechanism: score a fixed set of options
// in one pass and return a probability for each.
//
// cfg:
//   options    4 | 12 | 64 queues to route to (counting always has 8: 0 to 6, and 7+)
//   format     the writing desk's reply: "label" (the bare label) | "json" (a JSON object) | "reason" (a few
//              sentences of reasoning, then the label, in JSON)
//   output     "free" (free text, parsed afterwards) | "constrained" (decoding limited to the schema's options)
//   questions  1 | 3 | 6 questions about each ticket
//   task       "route" (which queue) | "count" (how many of the order's lines are flagged)
//   unlisted   "none" (every ticket's queue is on the list) | "some" (OFF of tickets belong to a queue that isn't)
//              | "guard" (the same, with a NONE OF THESE option, and the sorting desk sends anything under FLOOR to
//              human review)
//
// What a reader gets out of a ticket. Routing: the right option's evidence M (about MU, varies by ticket), the
// others none; each reading adds unit noise to every option, so a reader sometimes picks a wrong one, more often
// with more options. The sorting desk's probabilities are softmax(BETA · score), calibrated on tickets whose queue
// is on the list. A ticket off the list looks like one listed queue (evidence MU_L) and, when NONE OF THESE is an
// option, like "none" (MU_N). Counting: one pass sees the count with an error that grows with the order's length
// (COUNT_SD a line); writing the reasoning first checks the lines one at a time (LINE_ERR each).
//
// Invalid replies (free text only): per answer NEAR · (1 + options/8), a near-miss label ("QUEUE 7" for Q7) or one
// that isn't on the list; per reply BREAK, malformed JSON or no clean answer after the reasoning. Constrained
// decoding allows neither. A rejected reply is written again, up to MAX_TRIES times.

import { rng, normal } from "../../lib/random";
import { averageOver, rankQuantile, mean } from "../../lib/stats";

export const READ_W = 0.4;          // s: the writing desk reads the ticket and starts writing
export const TOKEN = 0.02;          // s a token: 50 tokens a second
export const READ_S = 0.15;         // s: the sorting desk's one pass
export const PER_Q = 0.005;         // s per extra question in that pass
export const PER_OPT = 0.0002;      // s per option
export const SPREAD = 0.25, TOK_SPREAD = 0.1;   // call-to-call variation (log-normal σ)
export const LABEL_TOK = [2, 3];    // a label: 2–3 tokens
export const JSON_CALL = 4, JSON_PER = 6;       // JSON: braces once, a key and quotes per answer
export const REASON_TOK = [60, 140]; // reasoning before each routing answer: 60–140 tokens
export const LINE_TOK = 10, COUNT_TOK = 15;     // counting, reasoning first: 10 tokens a line, 15 to sum up
export const NEAR = 0.004, BREAK = { label: 0, json: 0.01, reason: 0.02 }, REASON_NEAR = 1.5;
export const MAX_TRIES = 3;
export const MU = 3.5, SD_M = 0.8, BETA = 3.5, BOOST = 0.5;
export const OFF = 0.1, MU_L = 2.6, MU_N = 3, FLOOR = 0.6, CONFIDENT = 0.8;
export const LINES = [4, 12], FLAG = 0.3, COUNT_SD = 0.09, LINE_ERR = 0.01, COUNT_OPTS = 8;
export const SHOWN = 8;             // bins the sorting desk shows
export const DEFAULTS = { options: 12, format: "json", output: "free", questions: 1, task: "route", unlisted: "none" };

const ln = (r, s) => Math.exp(s * normal(r));
const between = (r, [a, b]) => a + Math.floor(r() * (b - a + 1));
const nOptions = (cfg) => (cfg.task === "count" ? COUNT_OPTS : Number(cfg.options));
const hasNone = (cfg) => cfg.task === "route" && cfg.unlisted === "guard";
export const NONE = -1;
/** The text of option j: Q1…Q64, 0…6 and 7+ for counting; NONE has no fixed text (the page's language). */
export const labelOf = (cfg, j) => (j === NONE ? "" : cfg.task === "count" ? (j >= COUNT_OPTS - 1 ? COUNT_OPTS - 1 + "+" : String(j)) : "Q" + (j + 1));

// the standard normal CDF (Abramowitz–Stegun 7.1.26)
function phi(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** What the ticket is: the same draws whatever the settings, so runs that differ in one setting see the same tickets. */
function content(cfg, r) {
  const K = nOptions(cfg);
  const t = { y: Math.floor(r() * K), offU: r(), M: Math.max(0.5, MU + SD_M * normal(r)), ML: Math.max(0.5, MU_L + SD_M * normal(r)), MN: Math.max(0.5, MU_N + SD_M * normal(r)) };
  t.off = cfg.task === "route" && cfg.unlisted !== "none" && t.offU < OFF;
  t.n = between(r, LINES);
  const flags = Array.from({ length: LINES[1] }, () => r() < FLAG);
  t.count = flags.slice(0, t.n).filter(Boolean).length;
  t.truth = cfg.task === "count" ? Math.min(t.count, COUNT_OPTS - 1) : t.off ? NONE : t.y;
  return t;
}

/** One reading of a routing ticket: a score for each option (and for NONE when it's an option). */
function scores(cfg, t, r, boost = 0) {
  const K = nOptions(cfg), z = [];
  for (let j = 0; j < K; j++) z.push(normal(r) + (j === t.y ? (t.off ? t.ML : t.M + boost) : 0));
  const zn = normal(r) + (t.off ? t.MN : 0);
  return { z, zn: hasNone(cfg) ? zn : null };
}
const argmax = (xs) => xs.reduce((b, x, i) => (x > xs[b] ? i : b), 0);

/** One pass over a counting ticket: the probability of each count, centred on what the pass saw. */
function countProbs(t, r) {
  const s = COUNT_SD * t.n, seen = t.count + s * normal(r);
  return Array.from({ length: COUNT_OPTS }, (_, j) => {
    const lo = j === 0 ? 0 : phi((j - 0.5 - seen) / s), hi = j === COUNT_OPTS - 1 ? 1 : phi((j + 0.5 - seen) / s);
    return Math.max(0, hi - lo);
  });
}

/** The sorting desk: one pass, a probability for every option, the top one takes the ticket. */
function sortTicket(cfg, t, r) {
  const K = nOptions(cfg), Q = Number(cfg.questions);
  const time = READ_S * ln(r, SPREAD) + PER_Q * (Q - 1) + PER_OPT * (K + (hasNone(cfg) ? 1 : 0));
  let probs, noneP = null;
  if (cfg.task === "count") probs = countProbs(t, r);
  else {
    const { z, zn } = scores(cfg, t, r);
    const all = zn === null ? z : [...z, zn];
    const m = Math.max(...all), e = all.map((x) => Math.exp(BETA * (x - m))), s = e.reduce((a, b) => a + b, 0);
    probs = e.slice(0, K).map((x) => x / s);
    if (zn !== null) noneP = e[K] / s;
  }
  let pick = argmax(probs), conf = probs[pick];
  if (noneP !== null && noneP > conf) { pick = NONE; conf = noneP; }
  const review = cfg.unlisted === "guard" && cfg.task === "route" && (pick === NONE || conf < FLOOR);
  const wrong = !review && pick !== t.truth;
  return { time, probs, noneP, pick, conf, review, wrong };
}

/** One reply from the writing desk: what it picked, how many tokens of each kind, whether the parser takes it. */
function writeOnce(cfg, t, r) {
  const K = nOptions(cfg), Q = Number(cfg.questions), fmt = cfg.format;
  const read = READ_W * ln(r, SPREAD), tok = TOKEN * ln(r, TOK_SPREAD);
  // its answer to the ticket's question (the first; the others only count for tokens and the parser)
  let pick;
  if (cfg.task === "count") {
    if (fmt === "reason") pick = r() < (1 - LINE_ERR) ** t.n ? t.count : Math.max(0, t.count + (r() < 0.5 ? -1 : 1));
    else pick = Math.round(t.count + COUNT_SD * t.n * normal(r));
    pick = Math.max(0, Math.min(COUNT_OPTS - 1, pick));
  } else {
    const { z, zn } = scores(cfg, t, r, fmt === "reason" ? BOOST : 0);
    pick = argmax(z);
    if (zn !== null && zn > z[pick]) pick = NONE;
  }
  let reason = 0, wrap = fmt === "label" ? 0 : JSON_CALL, label = 0, bad = null;
  const nearP = NEAR * (1 + K / 8) * (fmt === "reason" ? REASON_NEAR : 1);
  for (let q = 0; q < Q; q++) {
    reason += fmt !== "reason" ? 0 : cfg.task === "count" ? LINE_TOK * t.n + COUNT_TOK : between(r, REASON_TOK);
    label += between(r, LABEL_TOK);
    wrap += fmt === "label" ? (q ? 1 : 0) : JSON_PER;
    const u = r();
    if (cfg.output === "free" && !bad && u < nearP) bad = { kind: u < nearP / 2 ? "near" : "outside", q };
  }
  const u = r();
  if (cfg.output === "free" && !bad && u < BREAK[fmt]) bad = { kind: "broken", q: 0 };
  const tokens = reason + wrap + label;
  return { read, tok, reason, wrap, label, tokens, time: read + tokens * tok, pick, bad };
}

/** The writing desk: replies until the parser takes one, or MAX_TRIES. */
function writeTicket(cfg, t, r) {
  const tries = [];
  for (let k = 0; k < MAX_TRIES; k++) { const a = writeOnce(cfg, t, r); tries.push(a); if (!a.bad) break; }
  const last = tries[tries.length - 1];
  const gaveUp = !!last.bad;
  return {
    tries, time: tries.reduce((s, a) => s + a.time, 0), tokens: tries.reduce((s, a) => s + a.tokens, 0),
    writing: tries.reduce((s, a) => s + a.tokens * a.tok, 0), rejected: tries.filter((a) => a.bad).length,
    gaveUp, pick: last.pick, wrong: !gaveUp && last.pick !== t.truth,
  };
}

/** Ticket i of a stream: what it is, and what each desk does with it. */
export function makeTicket(cfgIn, seed, i) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const base = (seed * 1000003 + i * 7919) >>> 0;
  const t = content(cfg, rng(base + 11));
  return { i, cfg, t, write: writeTicket(cfg, t, rng(base * 3 + 7)), sort: sortTicket(cfg, t, rng(base * 5 + 3)) };
}

/** A call per question instead of one reply with every answer: Q calls side by side, each one question. */
export function separateCalls(cfgIn, seed, i) {
  const cfg = { ...DEFAULTS, ...cfgIn }, Q = Number(cfg.questions);
  const base = (seed * 1000003 + i * 7919) >>> 0;
  const t = content(cfg, rng(base + 11));
  const one = { ...cfg, questions: 1 };
  const calls = Array.from({ length: Q }, (_, q) => writeTicket(one, t, rng(base * 3 + 7 + q * 104729)));
  return { time: Math.max(...calls.map((c) => c.time)), calls: calls.reduce((s, c) => s + c.tries.length, 0) };
}

/** The sorting desk's bins for one ticket: up to SHOWN options, the highest probabilities in option order, and
 *  NONE last when it's an option; `more` counts the rest. */
export function binsOf(tk) {
  const { probs, noneP } = tk.sort, K = probs.length, room = SHOWN - (noneP === null ? 0 : 1);
  let idx = probs.map((p, j) => j);
  if (K > room) idx = idx.sort((a, b) => probs[b] - probs[a]).slice(0, room).sort((a, b) => a - b);
  const bins = idx.map((j) => ({ j, p: probs[j] }));
  if (noneP !== null) bins.push({ j: NONE, p: noneP });
  return { bins, more: K - idx.length };
}

// ---------- experiments: headless runs, averaged over seeds ----------
export const SEEDS = [3, 7, 11, 19, 23, 31, 43, 59];
export const TICKETS = 2000;
function stream(cfg, seed, n = TICKETS) { return Array.from({ length: n }, (_, i) => makeTicket(cfg, seed, i)); }
const avg = (fn) => averageOver(SEEDS, fn);
const p = (xs, q) => rankQuantile(xs, q);
function desks(cfg) {
  return avg((seed) => {
    const ts = stream(cfg, seed), W = ts.map((x) => x.write), S = ts.map((x) => x.sort);
    return {
      w50: p(W.map((w) => w.time), 0.5), w99: p(W.map((w) => w.time), 0.99), s50: p(S.map((s) => s.time), 0.5), s99: p(S.map((s) => s.time), 0.99),
      writeShare: mean(W.map((w) => w.writing / w.time)), tokens: mean(W.map((w) => w.tokens)), readW: mean(W.map((w) => w.tries[0].read)),
      rejected: (1000 * W.reduce((s, w) => s + w.rejected, 0)) / ts.length, retried: W.filter((w) => w.rejected).length / ts.length,
      wWrong: W.filter((w) => w.wrong).length / ts.length, sWrong: S.filter((s) => s.wrong).length / ts.length,
    };
  });
}

// 1. Latency of one decision: 12 queues, one question; bare label, JSON, reasoning first (free text), the sorting desk.
export function latencyRun() {
  const base = { options: 12, output: "free", questions: 1, task: "route", unlisted: "none" };
  return { label: desks({ ...base, format: "label" }), json: desks({ ...base, format: "json" }), reason: desks({ ...base, format: "reason" }) };
}

// 2. Invalid answers: JSON with 12 queues, free text vs constrained decoding; and free text with 64 queues.
export function invalidRun() {
  const base = { options: 12, format: "json", questions: 1, task: "route", unlisted: "none" };
  return { free: desks({ ...base, output: "free" }), strict: desks({ ...base, output: "constrained" }), free64: desks({ ...base, output: "free", options: 64 }) };
}

// 3. Valid but wrong: a tenth of tickets belong to a queue that isn't on the list. Forced choice vs NONE OF THESE
// plus a confidence floor.
export function offListRun() {
  const one = (unlisted) => avg((seed) => {
    const ts = stream({ options: 12, format: "json", output: "constrained", questions: 1, task: "route", unlisted }, seed);
    const off = ts.filter((x) => x.t.off), on = ts.filter((x) => !x.t.off);
    const per = (xs, f) => (1000 * xs.filter(f).length) / ts.length;
    return {
      offShare: off.length / ts.length,
      offWrong: per(off, (x) => x.sort.wrong), offSure: per(off, (x) => x.sort.wrong && x.sort.conf >= CONFIDENT),
      offReview: per(off, (x) => x.sort.review), onReview: per(on, (x) => x.sort.review), onWrong: per(on, (x) => x.sort.wrong),
      offWrongShare: off.filter((x) => x.sort.wrong).length / Math.max(1, off.length),
      offSureShare: off.filter((x) => x.sort.wrong && x.sort.conf >= CONFIDENT).length / Math.max(1, off.length),
      offConf: mean(off.map((x) => x.sort.conf)), onConf: mean(on.map((x) => x.sort.conf)),
      wOffWrong: per(off, (x) => x.write.wrong),
    };
  });
  return { forced: one("some"), guard: one("guard") };
}

// 4. Many questions about one ticket: 1, 3 and 6, JSON with 12 options, free text.
export function questionsRun() {
  const one = (questions) => {
    const cfg = { options: 12, format: "json", output: "free", questions, task: "route", unlisted: "none" };
    const d = desks(cfg);
    const sep = avg((seed) => {
      const xs = Array.from({ length: TICKETS }, (_, i) => separateCalls(cfg, seed, i));
      return { t50: p(xs.map((x) => x.time), 0.5), t99: p(xs.map((x) => x.time), 0.99), calls: mean(xs.map((x) => x.calls)) };
    });
    return { ...d, sep50: sep.t50, sep99: sep.t99, sepCalls: sep.calls };
  };
  return { q1: one(1), q3: one(3), q6: one(6) };
}

// 5. When to generate: count the flagged lines of an order (4 to 12 lines). Sorting desk vs a writer giving the bare
// label vs a writer that reasons first.
export function countRun() {
  const base = { output: "constrained", questions: 1, task: "count", unlisted: "none", options: 12 };
  const acc = (format) => avg((seed) => {
    const ts = stream({ ...base, format }, seed);
    const long = ts.filter((x) => x.t.n >= 10), short = ts.filter((x) => x.t.n <= 6);
    const ok = (xs, f) => xs.filter(f).length / Math.max(1, xs.length);
    return {
      w: ok(ts, (x) => !x.write.wrong), s: ok(ts, (x) => !x.sort.wrong), wLong: ok(long, (x) => !x.write.wrong), sLong: ok(long, (x) => !x.sort.wrong),
      wShort: ok(short, (x) => !x.write.wrong), sShort: ok(short, (x) => !x.sort.wrong),
      w50: p(ts.map((x) => x.write.time), 0.5), w99: p(ts.map((x) => x.write.time), 0.99), s50: p(ts.map((x) => x.sort.time), 0.5),
      sConf: mean(ts.map((x) => x.sort.conf)), sConfWrong: mean(ts.filter((x) => x.sort.wrong).map((x) => x.sort.conf)),
    };
  });
  return { label: acc("label"), reason: acc("reason") };
}

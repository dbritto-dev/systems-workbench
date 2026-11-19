// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// One artificial neuron with two inputs: z = w1·x1 + w2·x2 + b, then an activation (a step: yes when z > 0; or a
// sigmoid: 1 / (1 + e^-z), how sure it is of yes). The line z = 0 splits the input plane in two. Seeded, shared by the
// live figure and the experiments.
//
// Tasks: the logic rules AND, OR, NAND and XOR on inputs 0 and 1, and "loans": 40 made-up applicants, monthly income
// in dollars and debt ratio (debt payments over income), approved or declined. The decisions follow a straight-line
// rule loosely, so a few applicants near it went the other way, as real decisions do.
//
// Training goes through the examples in a shuffled order, one at a time, each epoch:
//   perceptron  Rosenblatt's rule: if the step's answer is wrong, add rate × (target − answer) × input to each weight
//               (and rate × (target − answer) to the bias); if it's right, do nothing. One nudge per mistake.
//   gradient    follow the slope of the error (cross-entropy) through the activation: add rate × (target − p) × input,
//               where p is the sigmoid's output. Through a step the slope is zero (it is flat on both sides of the
//               jump), so the nudge is zero.
// Inputs for the loans: raw (dollars and a ratio) or normalised (each centred on its mean and divided by its
// standard deviation). Starting weights and bias are drawn evenly from −0.5 to 0.5.

import { rng } from "../../lib/random";
import { averageOver } from "../../lib/stats";

export const TASKS = ["and", "or", "nand", "xor", "loans"];
export const LOGIC = {
  and: [0, 0, 0, 1],
  or: [0, 1, 1, 1],
  nand: [1, 1, 1, 0],
  xor: [0, 1, 1, 0],
};
const CORNERS = [[0, 0], [1, 0], [0, 1], [1, 1]];
export const N_LOANS = 40;
export const INCOME = [1500, 9500];   // monthly income, dollars
export const DEBT = [0.05, 0.75];     // debt ratio
export const RATE = { perceptron: 1, gradient: 0.1 };
export const EPOCHS = { logic: 100, loans: 200 };

// ---------- the board: every task drawn on the unit square ----------
// logic: 0 and 1 sit at a quarter and three quarters, so the origin (0, 0) is on the board; loans: income 1,000 to
// 10,000 across, debt ratio 0 to 0.8 deep.
export function boardOf(task) {
  if (task === "loans") return { x0: 1000, x1: 10000, y0: 0, y1: 0.8 };
  return { x0: -0.5, x1: 1.5, y0: -0.5, y1: 1.5 };
}
export const toBoard = (bd, [x, y]) => [(x - bd.x0) / (bd.x1 - bd.x0), (y - bd.y0) / (bd.y1 - bd.y0)];
export const fromBoard = (bd, [u, v]) => [bd.x0 + u * (bd.x1 - bd.x0), bd.y0 + v * (bd.y1 - bd.y0)];

/** The examples of a task: raw inputs, target (1 yes, 0 no), and where they sit on the board. */
export function makeData(task, seed = 1) {
  const bd = boardOf(task);
  let pts;
  if (task !== "loans") pts = CORNERS.map((x, i) => ({ x, y: LOGIC[task][i] }));
  else {
    const r = rng(seed * 2654435761 + 97);
    pts = [];
    for (let i = 0; i < N_LOANS; i++) {
      const inc = Math.round((INCOME[0] + (INCOME[1] - INCOME[0]) * r()) / 50) * 50;
      const debt = Math.round((DEBT[0] + (DEBT[1] - DEBT[0]) * r()) * 100) / 100;
      // the lender's rule, loosely followed: approve when income is high for the debt carried
      const [u, v] = toBoard(bd, [inc, debt]);
      const score = (u - 0.42) - 0.75 * (v - 0.5);
      const y = r() < 1 / (1 + Math.exp(-score / 0.08)) ? 1 : 0;
      pts.push({ x: [inc, debt], y });
    }
  }
  pts.forEach((p) => { p.at = toBoard(bd, p.x); });
  // normalising: centre each input on its mean, divide by its standard deviation
  const mu = [0, 1].map((j) => pts.reduce((a, p) => a + p.x[j], 0) / pts.length);
  const sd = [0, 1].map((j) => Math.sqrt(pts.reduce((a, p) => a + (p.x[j] - mu[j]) ** 2, 0) / pts.length) || 1);
  return { task, bd, pts, mu, sd };
}

export const sigmoid = (z) => 1 / (1 + Math.exp(-z));
export const stepOf = (z) => (z > 0 ? 1 : 0);

/** A neuron and its trainer. cfg: { task, act: "step" | "sigmoid", rule: "perceptron" | "gradient", bias: bool,
 *  inputs: "raw" | "norm", rate? }. */
export function makeNeuron(cfg, seed = 1, data = makeData(cfg.task, seed)) {
  const r = rng(seed * 40503 + 17);
  const norm = cfg.task === "loans" && cfg.inputs === "norm";
  const feed = (x) => (norm ? [(x[0] - data.mu[0]) / data.sd[0], (x[1] - data.mu[1]) / data.sd[1]] : x);
  const n = {
    cfg, data, feed,
    w: [r() - 0.5, r() - 0.5],
    b: cfg.bias ? r() - 0.5 : 0,
    rate: cfg.rate ?? RATE[cfg.rule],
    epoch: 0, seen: 0, nudges: 0, mistakes: 0, order: [], at: 0, epochMistakes: 0, settled: false, best: 0,
  };
  const zOf = (x) => { const f = feed(x); return n.w[0] * f[0] + n.w[1] * f[1] + n.b; };
  n.z = zOf;
  /** The answer for raw inputs x: z, what the activation reports, and the yes/no decision. */
  n.answer = (x) => { const z = zOf(x); return { z, out: cfg.act === "sigmoid" ? sigmoid(z) : stepOf(z), yes: z > 0 }; };
  n.accuracy = () => data.pts.reduce((a, p) => a + ((zOf(p.x) > 0 ? 1 : 0) === p.y ? 1 : 0), 0) / data.pts.length;
  /** Side of the line at a board point (true: yes). */
  n.sideAt = (u, v) => zOf(fromBoard(data.bd, [u, v])) > 0;
  function shuffle() {
    n.order = data.pts.map((_, i) => i);
    for (let i = n.order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [n.order[i], n.order[j]] = [n.order[j], n.order[i]]; }
    n.at = 0;
  }
  shuffle();
  /** Train on the next example: returns what happened. */
  n.step = () => {
    const i = n.order[n.at], p = data.pts[i], f = feed(p.x);
    const z = zOf(p.x), yes = z > 0 ? 1 : 0;
    const mistake = yes !== p.y;
    let g = 0;
    if (cfg.rule === "perceptron") g = p.y - yes;
    else if (cfg.act === "sigmoid") g = p.y - sigmoid(z);
    // gradient through a step: the slope is zero, so g stays 0
    const d = [n.rate * g * f[0], n.rate * g * f[1], cfg.bias ? n.rate * g : 0];
    n.w[0] += d[0]; n.w[1] += d[1]; n.b += d[2];
    const moved = d[0] !== 0 || d[1] !== 0 || d[2] !== 0;
    if (moved) n.nudges++;
    if (mistake) { n.mistakes++; n.epochMistakes++; }
    n.seen++;
    n.at++;
    let epochEnd = false;
    if (n.at >= n.order.length) {
      epochEnd = true;
      n.epoch++;
      // settled: a whole epoch without a mistake (the perceptron stops changing for good then)
      if (n.epochMistakes === 0 && cfg.rule === "perceptron") n.settled = true;
      n.lastEpochMistakes = n.epochMistakes;
      n.epochMistakes = 0;
      shuffle();
    }
    n.best = Math.max(n.best, n.accuracy());
    return { i, z, out: cfg.act === "sigmoid" ? sigmoid(z) : yes, yes, mistake, moved, d, epochEnd };
  };
  n.best = n.accuracy();
  n.runEpoch = () => { let e; do e = n.step(); while (!e.epochEnd); };
  return n;
}

// ---------- the line on the board ----------
const GRID = 50;
/** Which side each point of a 50 × 50 grid over the board is on. */
export function sides(n) {
  const out = new Uint8Array(GRID * GRID);
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) out[i * GRID + j] = n.sideAt((i + 0.5) / GRID, (j + 0.5) / GRID) ? 1 : 0;
  return out;
}
/** The share of the board that changed sides between two snapshots: how far the line moved. */
export function swept(a, b) { let c = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) c++; return c / a.length; }

/** The most examples any straight line gets right (exhaustive over directions); through: only lines through the
 *  inputs' origin (no bias), where a point on the line counts as "no". */
export function bestLine(data, { through = false, feedOrigin = [0, 0] } = {}) {
  const pts = data.pts;
  let best = 0;
  for (let k = 0; k < 1440; k++) {
    const a = (Math.PI * 2 * k) / 1440, c = Math.cos(a), s = Math.sin(a);
    const pr = pts.map((p) => ({ v: c * (p.x[0] - feedOrigin[0]) / data.sd[0] + s * (p.x[1] - feedOrigin[1]) / data.sd[1], y: p.y }));
    if (through) {
      // yes when the projection is above 0, exactly as z > 0
      best = Math.max(best, pr.reduce((acc, q) => acc + (((Math.abs(q.v) < 1e-12 ? 0 : q.v) > 0 ? 1 : 0) === q.y ? 1 : 0), 0));
      continue;
    }
    const vs = [...new Set(pr.map((q) => q.v))].sort((x, y) => x - y);
    const cuts = [vs[0] - 1, ...vs.slice(1).map((v, i) => (v + vs[i]) / 2), vs[vs.length - 1] + 1];
    for (const t of cuts) best = Math.max(best, pr.reduce((acc, q) => acc + ((q.v > t ? 1 : 0) === q.y ? 1 : 0), 0));
  }
  return best / pts.length;
}

// ---------- experiments: headless runs averaged over seeds ----------
export const SEEDS = [11, 23, 37, 41, 59, 67, 73, 89];
const avg = (fn) => averageOver(SEEDS, fn);
const cfgOf = (o) => ({ task: "and", act: "step", rule: "perceptron", bias: true, inputs: "norm", ...o });

/** Train for `epochs` epochs (or until settled); measures the end state. tail: epochs at the end to measure the
 *  line's movement over. */
export function train(cfg, seed, epochs, tail = 20) {
  const n = makeNeuron(cfg, seed);
  let settledAt = 0;
  const moves = [];
  let prev = sides(n);
  for (let e = 0; e < epochs; e++) {
    n.runEpoch();
    if (e >= epochs - tail) { const s = sides(n); moves.push(swept(prev, s)); prev = s; } else if (e === epochs - tail - 1) prev = sides(n);
    if (n.settled && !settledAt) settledAt = n.epoch;
  }
  return { n, final: n.accuracy(), best: n.best, settled: n.settled ? 1 : 0, settledAt, move: moves.reduce((a, b) => a + b, 0) / Math.max(1, moves.length), nudges: n.nudges };
}

// 1 and 2. The four logic rules, perceptron with a step, with the bias and without.
export function rulesRun(bias) {
  const out = {};
  for (const task of ["and", "or", "nand", "xor"]) {
    out[task] = avg((seed) => {
      const r = train(cfgOf({ task, bias }), seed, EPOCHS.logic);
      return { final: r.final, best: r.best, settled: r.settled, settledAt: r.settledAt };
    });
    // epochs to settle, over the runs that settled
    const at = SEEDS.map((seed) => train(cfgOf({ task, bias }), seed, EPOCHS.logic).settledAt).filter((x) => x > 0);
    out[task].epochs = at.length ? at.reduce((a, b) => a + b, 0) / at.length : 0;
    out[task].line = bestLine(makeData(task), { through: !bias });
  }
  return out;
}

// 3. Gradient training through a step vs through a sigmoid, on AND; and what each reports for a point just across a
// line. The fixed neuron for the point: w = (1, 1), b = −1.5 (an AND line); the point (0.7, 0.7) gives z = −0.1.
export const PROBE = { w: [1, 1], b: -1.5, x: [0.7, 0.7] };
export function slopeRun() {
  const run = (act) => avg((seed) => {
    const n0 = makeNeuron(cfgOf({ act, rule: "gradient" }), seed);
    const start = n0.accuracy();
    const r = train(cfgOf({ act, rule: "gradient" }), seed, EPOCHS.logic);
    return { start, final: r.final, nudges: r.nudges, seen: r.n.seen };
  });
  const z = PROBE.w[0] * PROBE.x[0] + PROBE.w[1] * PROBE.x[1] + PROBE.b;
  const s = sigmoid(z);
  return { step: run("step"), sigmoid: run("sigmoid"), z, stepOut: stepOf(z), sigOut: s, sigSlope: s * (1 - s) };
}

// 4. Noisy loans, normalised inputs: perceptron (step) vs sigmoid by gradient, 200 epochs each.
export function noiseRun() {
  const run = (act, rule) => avg((seed) => {
    const r = train(cfgOf({ task: "loans", act, rule }), seed, EPOCHS.loans, 50);
    return { final: r.final, move: r.move, best: bestLine(r.n.data) };
  });
  const slow = avg((seed) => { const r = train(cfgOf({ task: "loans", rate: RATE.perceptron / 10 }), seed, EPOCHS.loans, 50); return { final: r.final, move: r.move }; });
  return { perceptron: run("step", "perceptron"), gradient: run("sigmoid", "gradient"), slow };
}

// 5. Loans, sigmoid by gradient: raw inputs vs normalised. Converged: the error training follows (cross-entropy,
// averaged over the examples) is within CLOSE of the lowest any line reaches on these examples, for 10 epochs
// running; `at` is the first of those epochs.
export const CLOSE = 0.02;
export const SCALE_EPOCHS = 300;
const xent = (p, y) => -(y ? Math.log(Math.max(p, 1e-12)) : Math.log(Math.max(1 - p, 1e-12)));
export const lossOf = (n) => n.data.pts.reduce((a, q) => a + xent(sigmoid(n.z(q.x)), q.y), 0) / n.data.pts.length;
/** The lowest average cross-entropy any line reaches (Newton's method on the normalised inputs; the raw inputs reach
 *  the same lines, so the same lowest error). */
export function lowestLoss(data) {
  const X = data.pts.map((q) => [(q.x[0] - data.mu[0]) / data.sd[0], (q.x[1] - data.mu[1]) / data.sd[1], 1]);
  let w = [0, 0, 0];
  for (let it = 0; it < 60; it++) {
    const g = [0, 0, 0], H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    X.forEach((x, i) => {
      const p = sigmoid(x[0] * w[0] + x[1] * w[1] + x[2] * w[2]), e = p - data.pts[i].y, v = p * (1 - p);
      for (let a = 0; a < 3; a++) { g[a] += e * x[a]; for (let b = 0; b < 3; b++) H[a][b] += v * x[a] * x[b]; }
    });
    for (let a = 0; a < 3; a++) H[a][a] += 1e-9;
    w = w.map((v, a) => v - solve3(H, g)[a]);
  }
  return X.reduce((a, x, i) => a + xent(sigmoid(x[0] * w[0] + x[1] * w[1] + x[2] * w[2]), data.pts[i].y), 0) / X.length;
}
function solve3(A, b) {
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A);
  return [0, 1, 2].map((c) => det(A.map((row, r) => row.map((v, k) => (k === c ? b[r] : v)))) / D);
}
export function settleRun(cfg, seed, epochs = SCALE_EPOCHS) {
  const n = makeNeuron(cfg, seed);
  const low = lowestLoss(n.data);
  let prev = sides(n), calm = 0, at = 0;
  const moves = [];
  for (let e = 0; e < epochs; e++) {
    n.runEpoch();
    const s = sides(n);
    moves.push(swept(prev, s));
    prev = s;
    calm = lossOf(n) <= low + CLOSE ? calm + 1 : 0;
    if (calm >= 10 && !at) at = n.epoch - 9;
  }
  const tail = moves.slice(-50);
  return { n, at, settled: at ? 1 : 0, final: n.accuracy(), move: tail.reduce((a, b) => a + b, 0) / tail.length, loss: lossOf(n), low };
}
export function scaleRun() {
  const run = (inputs, rate) => avg((seed) => {
    const r = settleRun(cfgOf({ task: "loans", act: "sigmoid", rule: "gradient", inputs, rate }), seed);
    return { at: r.at || SCALE_EPOCHS, settled: r.settled, final: r.final, move: r.move, loss: r.loss, low: r.low };
  });
  return { norm: run("norm"), raw: run("raw"), rawSlow: run("raw", RATE.gradient / 1e7) };
}

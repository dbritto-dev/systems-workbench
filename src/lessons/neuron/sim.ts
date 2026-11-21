// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// Systems lesson 85 · Neuron: one artificial neuron doing a real AI job: sort an animal into CAT or DOG from two clues.
//   - how heavy it is, read in tens of kg (22 kg is 2.2: the same size of number as the ears, see SCALE below);
//   - its ears: POINTY = 0, FLOPPY = 1.
// It has three settings, one per kicker on the board: how much every 10 kg counts, how much floppy ears count, and a
// starting lean (the bias). score = lean + 10 kg setting × tens of kg + ears setting × (1 if floppy). Above 0 → DOG;
// 0 or less → CAT. AI people call the first two settings weights; the lesson says "how much it counts" so the word
// doesn't clash with how heavy the animal is.
//
// Learning (Rosenblatt's perceptron rule, rate 1): the animals come down the board in a shuffled order each round;
// after a wrong sort, each setting moves by its clue toward the right answer: 10 kg by the animal's tens of kg, ears
// by 1 if its ears were floppy (0 if pointy), the lean by 1. Up if it should have been DOG, down if CAT. A right sort
// changes nothing. The settings start at 0.
//
// Numbers are kept exact: the 10 kg setting is stored in tenths (w10) and scores in hundredths, so 0 is exactly 0.
//
// The animals (illustrative round numbers inside real ranges: PetMD, house cats 8–12 lb (3.6–5.4 kg), Maine Coon males
// 12–20+ lb; AKC breed weight chart, Chihuahua up to 6 lb (2.7 kg), Shih Tzu 9–16 lb (4–7 kg), Shiba Inu 17–23 lb
// (8–10 kg), Cocker Spaniel 20–30 lb (9–14 kg), Siberian Husky 35–60 lb (16–27 kg)).

import { rng } from "../../lib/random";

/** id: [kind, kg, floppy ears]. kind 1 = DOG, 0 = CAT. */
export const ANIMALS = {
  cat3: [0, 3, 0],        // a small cat
  cat4: [0, 4, 0],        // a house cat
  cat5: [0, 5, 0],        // a house cat
  cat6: [0, 6, 0],        // a big house cat
  shihtzu: [1, 5, 1],     // a small floppy-eared dog (Shih Tzu)
  shiba: [1, 8, 0],       // a fox-like pointy-eared dog (Shiba Inu)
  cocker: [1, 12, 1],     // a spaniel (Cocker Spaniel)
  husky: [1, 22, 0],      // a husky
  chihuahua: [1, 2, 0],   // a tiny pointy-eared dog (Chihuahua): looks like a cat on both clues
  mainecoon: [0, 9, 0],   // a big fluffy cat (Maine Coon): heavier than the Shiba
};
/** easy: one straight cut sorts it, but only with both clues and a starting lean. hard: two more animals that no
 *  straight cut can put on the right side together with the rest. */
export const SETS = {
  easy: ["cat3", "cat4", "cat5", "cat6", "shihtzu", "shiba", "cocker", "husky"],
  hard: ["cat3", "cat4", "cat5", "cat6", "shihtzu", "shiba", "cocker", "husky", "chihuahua", "mainecoon"],
};
export const RANGE = { kg: { min: -5, max: 5, step: 0.5 }, ears: { min: -5, max: 5, step: 1 }, lean: { min: -5, max: 5, step: 1 } };
export const ROUNDS = 100;
export const SCALE = 10;                                    // the neuron reads weight in tens of kg

export const kindOf = (id) => ANIMALS[id][0];
/** Score in hundredths: settings { w10: the 10 kg setting in tenths, ears, lean }, the lean used or not. */
export const score100 = (d, id, lean = true) => { const [, kg, fl] = ANIMALS[id]; return d.w10 * kg + 100 * (d.ears * fl + (lean ? d.lean : 0)); };
export const sortsDog = (s100) => s100 > 0;
export const rightOf = (d, set, lean = true) => SETS[set].reduce((a, id) => a + ((sortsDog(score100(d, id, lean)) ? 1 : 0) === kindOf(id) ? 1 : 0), 0);

/** A neuron and its trainer. cfg: { set, lean: bool }; start: { w10, ears, lean }. */
export function makeNeuron(cfg, seed = 1, start = { w10: 0, ears: 0, lean: 0 }) {
  const r = rng(seed * 40503 + 17);
  const ids = SETS[cfg.set];
  const n = { cfg, d: { ...start, lean: cfg.lean ? start.lean : 0 }, round: 0, seen: 0, mistakes: 0, roundMistakes: 0, order: [], at: 0, settled: false, settledAt: 0, mistakesToSettle: 0, peak: { kg: 0, ears: 0, lean: 0 } };
  n.right = () => rightOf(n.d, cfg.set, cfg.lean);
  function shuffle() {
    n.order = ids.map((_, i) => i);
    for (let i = n.order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [n.order[i], n.order[j]] = [n.order[j], n.order[i]]; }
    n.at = 0;
  }
  shuffle();
  /** One animal: sort it, and nudge the settings if it went into the wrong pen. Returns what happened. */
  n.step = () => {
    const id = ids[n.order[n.at]], [kind, kg, fl] = ANIMALS[id];
    const s = score100(n.d, id, cfg.lean), got = sortsDog(s) ? 1 : 0, err = kind - got;  // +1: should be DOG, −1: CAT
    const nudge = { w10: err * kg, ears: err * fl, lean: cfg.lean ? err : 0 };
    n.d.w10 += nudge.w10; n.d.ears += nudge.ears; n.d.lean += nudge.lean;
    n.peak.kg = Math.max(n.peak.kg, Math.abs(n.d.w10) / 10); n.peak.ears = Math.max(n.peak.ears, Math.abs(n.d.ears)); n.peak.lean = Math.max(n.peak.lean, Math.abs(n.d.lean));
    if (err) { n.mistakes++; n.roundMistakes++; }
    n.seen++; n.at++;
    let roundEnd = false;
    if (n.at >= ids.length) {
      roundEnd = true; n.round++;
      if (n.roundMistakes === 0 && !n.settled) { n.settled = true; n.settledAt = n.round; n.mistakesToSettle = n.mistakes; }
      n.roundMistakes = 0;
      shuffle();
    }
    return { id, kind, kg, fl, s, got, err, nudge, roundEnd };
  };
  n.runRound = () => { let e; do e = n.step(); while (!e.roundEnd); };
  return n;
}

// ---------- the best one straight cut can do ----------
/** The most animals of a set any setting sorts right, using: the weight clue, the ears clue, the lean (each on or off).
 *  Exact for these sets: every direction in the (tens of kg, ears) plane at ¼° steps, and every place to cut along it
 *  (between two animals, or past all of them); without the lean the cut must pass through 0. */
export function bestCut(set, { kg = true, ears = true, lean = true } = {}) {
  const ids = SETS[set];
  let best = 0;
  // quarter degrees; weight only: 0° and 180°; ears only: 90° and 270°
  const qs = kg && ears ? Array.from({ length: 1440 }, (_, q) => q) : kg ? [0, 720] : ears ? [360, 1080] : [0];
  for (const q of qs) {
    const a = (q / 4) * (Math.PI / 180), dk = kg ? Math.cos(a) : 0, de = ears ? Math.sin(a) : 0;
    const p = ids.map((id) => dk * (ANIMALS[id][1] / SCALE) + de * ANIMALS[id][2]);
    const cuts = lean ? [-Infinity, ...[...new Set(p)].sort((x, y) => x - y).map((v, i, s) => (i + 1 < s.length ? (v + s[i + 1]) / 2 : Infinity))] : [0];
    for (const c of cuts) {
      const right = ids.reduce((acc, id, i) => acc + ((p[i] - c > 1e-12 ? 1 : 0) === kindOf(id) ? 1 : 0), 0);
      best = Math.max(best, right);
    }
  }
  return best;
}

/** Every setting the three steppers reach (10 kg in its steps, ears and lean whole): how many sort the set
 *  perfectly, the best, and the settings that work. */
export function handRun(set = "easy", lean = true) {
  const vals = (D) => { const out = []; for (let v = D.min; v <= D.max + 1e-9; v += D.step) out.push(Math.round(v * 10)); return out; };
  const ks = vals(RANGE.kg), es = vals(RANGE.ears).map((v) => v / 10), ls = lean ? vals(RANGE.lean).map((v) => v / 10) : [0];
  let all = 0, best = 0, n = 0;
  const works = [];
  for (const w10 of ks) for (const ears of es) for (const l of ls) {
    const right = rightOf({ w10, ears, lean: l }, set, lean);
    n++; best = Math.max(best, right);
    if (right === SETS[set].length) { all++; works.push([w10 / 10, ears, l]); }
  }
  return { all, best, settings: n, works };
}

// ---------- training: headless runs from 0, over seeds (each seed its own shuffled order) ----------
export const SEEDS = [11, 23, 37, 41, 59, 67, 73, 89];
export function trainRun(set, lean = true, seed = 1, rounds = ROUNDS) {
  const n = makeNeuron({ set, lean }, seed);
  let lastTen = 0;
  for (let k = 0; k < rounds; k++) { const m0 = n.mistakes; n.runRound(); if (k >= rounds - 10) lastTen += n.mistakes - m0; }
  return { settled: n.settled ? 1 : 0, settledAt: n.settledAt, mistakesToSettle: n.mistakesToSettle, mistakes: n.mistakes, right: n.right(), lastTen, peak: n.peak, d: { ...n.d } };
}
export function learnRun(set, lean = true) {
  const runs = SEEDS.map((s) => trainRun(set, lean, s));
  const ok = runs.filter((r) => r.settled);
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  return {
    runs,
    settled: ok.length / runs.length,
    rounds: mean(ok.map((r) => r.settledAt)),
    roundsMax: ok.length ? Math.max(...ok.map((r) => r.settledAt)) : 0,
    mistakes: mean(ok.map((r) => r.mistakesToSettle)),
    mistakesMin: ok.length ? Math.min(...ok.map((r) => r.mistakesToSettle)) : 0,
    mistakesMax: ok.length ? Math.max(...ok.map((r) => r.mistakesToSettle)) : 0,
    allMistakes: mean(runs.map((r) => r.mistakes)),
    lastTen: mean(runs.map((r) => r.lastTen)),
    right: mean(runs.map((r) => r.right)),
    rightMin: Math.min(...runs.map((r) => r.right)),
    peak: { kg: Math.max(...runs.map((r) => r.peak.kg)), ears: Math.max(...runs.map((r) => r.peak.ears)), lean: Math.max(...runs.map((r) => r.peak.lean)) },
  };
}
/** The same training, but with the weight read in plain kg (22, not 2.2): the "same size of units" note. */
export function unscaledRun(set = "easy") {
  const runs = SEEDS.map((seed) => {
    const r = rng(seed * 40503 + 17), ids = SETS[set];
    let w = 0, e = 0, b = 0, mistakes = 0, settledAt = 0;
    for (let round = 1; round <= 2000 && !settledAt; round++) {
      const order = ids.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      let m = 0;
      for (const i of order) { const [kind, kg, fl] = ANIMALS[ids[i]]; const got = w * kg + e * fl + b > 0 ? 1 : 0, err = kind - got; if (err) { w += err * kg; e += err * fl; b += err; m++; mistakes++; } }
      if (!m) settledAt = round;
    }
    return { mistakes, settledAt, w, e, b };
  });
  return { runs, mistakes: runs.reduce((a, r) => a + r.mistakes, 0) / runs.length };
}

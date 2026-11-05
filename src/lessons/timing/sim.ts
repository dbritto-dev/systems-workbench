// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// A combination checker you can watch: the lesson's model of a timing leak and the fix for it.
//
// The checker holds a secret of DIALS digits (0-9). A guess is compared dial by dial:
//   compare "early"  stops at the first wrong dial, so a guess with a longer right prefix takes longer;
//   compare "const"  always looks at every dial (constant time), so every guess of the right length takes the same.
// Each look at one dial costs STEP time units on top of a fixed BASE. What the stopwatch reads is that cost plus
// noise (normal, sd = noise) plus, if set, a random delay (uniform 0..delay) the checker adds on purpose.
// The units are illustrative and round: one STEP stands for the few nanoseconds one more byte of comparison takes,
// noise for network and scheduling jitter many times larger. Only the ratios matter to the lesson.
//
// The listener in the model learns the secret one dial at a time: for the next dial it tries each digit `samples`
// times, averages the readings, and keeps the digit with the slowest mean. This is the classic textbook illustration
// of why early-exit comparison leaks; it runs only against this simulated checker.
import { rngMixed, normal } from "../../lib/random";
import { mean } from "../../lib/stats";

export const DIALS = 4;
export const DIGITS = 10;
export const BASE = 100;           // fixed cost of handling one guess
export const STEP = 1;             // cost of looking at one more dial
export const BRUTE = DIGITS ** DIALS;

export const DEFAULTS = { compare: "early", noise: 4, samples: 320, delay: 0, dials: DIALS };

// The cost of one comparison, before noise: how many dials the checker looked at.
export function looks(secret, guess, compare) {
  if (compare === "const") return secret.length;
  let i = 0;
  while (i < secret.length && guess[i] === secret[i]) i++;
  return Math.min(secret.length, i + 1);
}

export function makeChecker(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rnd = rngMixed(seed);
  const gauss = () => normal(rnd);
  const secret = Array.from({ length: cfg.dials }, () => Math.floor(rnd() * DIGITS));
  let readings = 0;
  function time(guess) {
    readings++;
    const cost = BASE + STEP * looks(secret, guess, cfg.compare);
    const jitter = cfg.noise * gauss();
    const pad = cfg.delay > 0 ? rnd() * cfg.delay : 0;
    return cost + jitter + pad;
  }
  const opens = (guess) => guess.every((d, i) => d === secret[i]);
  return { cfg, secret, time, opens, get readings() { return readings; } };
}

// The listener: recover one dial at a time from averaged readings. Returns the digits it settled on and whether
// each was right, so the live code can narrate it and experiments can score it.
export function listen(checker, samples) {
  const known = [];
  const steps = [];
  const n = checker.secret.length;
  for (let d = 0; d < n; d++) {
    // The last dial leaves no timing trace (right or wrong, the checker looks at every dial), so it is found the
    // plain way: try its ten digits and see which one opens. Ten tries, not ten thousand.
    if (d === n - 1) {
      let pick = 0;
      for (let v = 0; v < DIGITS; v++) { checker.time([...known, v]); if (checker.opens([...known, v])) { pick = v; break; } }
      known.push(pick);
      steps.push({ dial: d, means: null, pick, right: pick === checker.secret[d] });
      break;
    }
    const means = [];
    for (let v = 0; v < DIGITS; v++) {
      const guess = [...known, v, ...Array(n - d - 1).fill(0)];
      const r = [];
      for (let s = 0; s < samples; s++) r.push(checker.time(guess));
      means.push(mean(r));
    }
    let best = 0;
    for (let v = 1; v < DIGITS; v++) if (means[v] > means[best]) best = v;
    known.push(best);
    steps.push({ dial: d, means, pick: best, right: best === checker.secret[d] });
  }
  return { known, steps, opened: checker.opens(known), readings: checker.readings };
}

// ---------- experiments: headless runs averaged over seeds ----------
export const RUN_COUNT = 200;
const SEEDS = Array.from({ length: RUN_COUNT }, (_, i) => 7 + 13 * i);

function runs(cfg, samples) {
  const rs = SEEDS.map((seed) => listen(makeChecker(cfg, seed), samples));
  return { rate: mean(rs.map((r) => (r.opened ? 1 : 0))), readings: mean(rs.map((r) => r.readings)) };
}
const successRate = (cfg, samples) => runs(cfg, samples).rate;

// 1. Brute force vs listening to an early-exit checker. Brute force finds the secret after half the combinations on
// average.
// The same listener at 4 dials and at 8: its readings grow by one dial's worth per dial, brute force by ×10 per dial.
export function bruteRun() {
  const samples = DEFAULTS.samples;
  const at = (dials) => { const r = runs({ compare: "early", dials }, samples); return { dials, brute: DIGITS ** dials / 2, listen: r.readings, rate: r.rate }; };
  return { four: at(4), eight: at(8), samples };
}
// 2. More noise needs more samples: success vs samples at three noise levels.
export const NOISES = [2, 4, 8];
export const SAMPLE_STEPS = [20, 80, 320, 1280];
export function noiseRun() {
  return NOISES.map((noise) => ({ noise, rows: SAMPLE_STEPS.map((samples) => ({ samples, rate: successRate({ compare: "early", noise }, samples) })) }));
}
// 3. Constant-time compare removes the signal.
export function constRun() {
  const samples = 320;
  return { early: successRate({ compare: "early" }, samples), cons: successRate({ compare: "const" }, samples), chance: CHANCE, samples };
}
// With no signal, the listener's three timed picks are blind guesses (1 in 10 each); the last dial is tried by hand,
// so a run opens the lock by luck about 1 time in 1,000.
export const CHANCE = 1 / DIGITS ** (DIALS - 1);
// 5. The length leak. A checker that compares raw inputs returns at once when the lengths differ, so the stopwatch
// shows which guessed length is the secret's (only the right length goes on to compare dials). Hashing both sides to
// a fixed-length digest first (an HMAC) makes every guess the same length, and that tell goes away.
export const LENGTHS = [2, 3, 4, 5, 6, 7];
export function lengthRun(samples = 20) {
  const found = (mode) => mean(SEEDS.map((seed) => {
    const c = makeChecker({ compare: "const" }, seed);
    const rnd = rngMixed(seed * 31 + 5);
    const reading = (len) => {
      // raw: a wrong length costs only BASE; the right length also compares every dial.
      // fixed: both sides become a digest of the same length, so every guess compares the same number of dials.
      const cost = BASE + (mode === "fixed" || len === DIALS ? STEP * DIALS : 0);
      return cost + c.cfg.noise * normal(rnd);
    };
    let best = LENGTHS[0], top = -Infinity;
    for (const len of LENGTHS) {
      const m = mean(Array.from({ length: samples }, () => reading(len)));
      if (m > top) { top = m; best = len; }
    }
    return best === DIALS ? 1 : 0;
  }));
  return { raw: found("raw"), fixed: found("fixed"), chance: 1 / LENGTHS.length, samples };
}

// 4. A random delay only adds noise: it averages out with more samples.
export const DELAY = 40;
export const MANY = 2560;
export function delayRun() {
  return {
    none: successRate({ compare: "early", delay: 0 }, 320),
    delayFew: successRate({ compare: "early", delay: DELAY }, 320),
    delayMany: successRate({ compare: "early", delay: DELAY }, MANY),
    cons: successRate({ compare: "const", delay: 0 }, MANY),
  };
}

// ---------- the live machine: the same listener, one reading at a time ----------
// probe "dials": learn the secret dial by dial, as listen() does. probe "length": time guesses of each length in
// LENGTHS against the checker, comparing raw inputs (input "raw": a wrong length returns at once) or fixed-length
// digests of both sides (input "digest": every guess compares the same number of dials).
// next() takes one reading and returns what happened, for the figure and the readout.
export function makeLive(cfgIn = {}, seed = 1) {
  const cfg = { probe: "dials", input: "raw", ...DEFAULTS, ...cfgIn };
  const checker = makeChecker(cfg, seed);
  const rnd = rngMixed(seed * 31 + 5);
  const n = checker.secret.length;
  const cols = cfg.probe === "length" ? LENGTHS.length : DIGITS;
  const st = { dial: 0, col: 0, sample: 0, sums: Array(cols).fill(0), counts: Array(cols).fill(0), known: [], readings: 0, done: false, opened: false, pick: -1, lenPick: -1, last: 0, looked: 0 };
  const lengthCost = (len) => BASE + (cfg.input === "digest" || len === n ? STEP * n : 0);
  function guessFor(col) { return [...st.known, col, ...Array(n - st.dial - 1).fill(0)]; }
  function next() {
    if (st.done) return { type: "idle" };
    st.readings++;
    if (cfg.probe === "length") {
      const len = LENGTHS[st.col];
      const r = lengthCost(len) + cfg.noise * normal(rnd) + (cfg.delay > 0 ? rnd() * cfg.delay : 0);
      st.last = r; st.looked = cfg.input === "digest" || len === n ? n : 0;
      st.sums[st.col] += r; st.counts[st.col]++;
      const ev = { type: "reading", col: st.col, value: r };
      if (++st.sample >= cfg.samples) {
        st.sample = 0;
        if (++st.col >= cols) {
          const means = st.sums.map((s, i) => s / st.counts[i]);
          let best = 0; for (let i = 1; i < cols; i++) if (means[i] > means[best]) best = i;
          st.lenPick = LENGTHS[best]; st.done = true; st.opened = LENGTHS[best] === n;
          return { ...ev, type: "lengthPick", pick: LENGTHS[best], right: LENGTHS[best] === n, means };
        }
      }
      return ev;
    }
    // the last dial: try its digits until one opens
    if (st.dial === n - 1) {
      const guess = [...st.known, st.col];
      const r = checker.time(guess);
      st.last = r; st.looked = looks(checker.secret, guess, cfg.compare);
      if (checker.opens(guess)) { st.known.push(st.col); st.done = true; st.opened = true; return { type: "opened", col: st.col, value: r }; }
      if (++st.col >= DIGITS) { st.known.push(0); st.done = true; st.opened = false; return { type: "failed", value: r }; }
      return { type: "try", col: st.col - 1, value: r };
    }
    const guess = guessFor(st.col);
    const r = checker.time(guess);
    st.last = r; st.looked = looks(checker.secret, guess, cfg.compare);
    st.sums[st.col] += r; st.counts[st.col]++;
    const ev = { type: "reading", col: st.col, value: r };
    if (++st.sample >= cfg.samples) {
      st.sample = 0;
      if (++st.col >= DIGITS) {
        const means = st.sums.map((s, i) => s / st.counts[i]);
        let best = 0; for (let i = 1; i < DIGITS; i++) if (means[i] > means[best]) best = i;
        const right = best === checker.secret[st.dial];
        st.known.push(best); st.pick = best;
        const out = { ...ev, type: "pick", dial: st.dial, pick: best, right, means };
        st.dial++; st.col = 0; st.sums = Array(DIGITS).fill(0); st.counts = Array(DIGITS).fill(0);
        return out;
      }
    }
    return ev;
  }
  return { cfg, st, next, secret: checker.secret, cols, n };
}

// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The weighing station and the decision board in the browser. Training takes one example per tick of the speed
// control: the riders show its inputs, the beam tilts by the sum, the meter shows the output, and if training nudges
// the weights, the riders slide and the ruler moves on the board. At slow speeds each example is shown first with the
// weights it was weighed with, then with the nudged ones; at fast speeds the machine shows the latest state.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T, still } from "../../runtime/wb";
import { setText, setD, show, playPause } from "../../runtime/dom";
import { makeNeuron, makeData, sides, swept, lossOf, lowestLoss, fromBoard, EPOCHS, SCALE_EPOCHS, CLOSE } from "./sim";
import { beamPaths, tiltOf, riderAt, LANES, PIVOT, BEAM, BX, BY, clip, chord, SQUARE, rulerSvg, onBoard } from "./draw";

const HOLD = 6000;       // ms the machine rests on a finished run before it starts over
const BAND = 2.2;        // the sigmoid's band: z = ±2.2, where it says 0.1 and 0.9

export default function mount({ P, TOK, RING }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const stat = (key, value) => root.stat(key, value);
  const NS = "http://www.w3.org/2000/svg";
  const layers = Object.fromEntries(["yes", "band", "tokens", "ruler", "front", "ring", "riders"].map((n) => [n, q(`[data-layer="${n}"]`)]));
  const beamEls = Object.fromEntries([...svg.querySelectorAll("[data-beam] [data-d]")].map((el) => [el.getAttribute("data-d"), el]));
  const riders = Object.fromEntries(["x1", "x2", "b"].map((n) => { const g = q(`[data-rider="${n}"]`); return [n, { g, value: g.querySelector("[data-rider-value]") }]; }));
  const C = Object.fromEntries(["right", "epoch", "nudges", "outI", "outF"].map((n) => [n, WB.counter(svg, n, P)]));
  const needle = WB.meter(svg, "out", P);
  const actWord = q("[data-act-word]"), ofWord = q("[data-of]");
  const axes = { logic: q('[data-axes="logic"]'), loans: q('[data-axes="loans"]') };

  const cfg = { task: "and", act: "step", rule: "perceptron", bias: "on", inputs: "norm", speed: 2 };
  let n, seed = 3, tokens = [], ring = null, cur = null, slot = 0, acc = 0;
  let training = !still.matches, ended = null, epochSides = null, lastMoved = null, calm = 0, low = 0, cap = EPOCHS.logic;
  const disp = { w: [0, 0], b: 0, tilt: 0, out: 0 };
  const loans = () => cfg.task === "loans";
  const neuronCfg = () => ({ task: cfg.task, act: cfg.act, rule: cfg.rule, bias: cfg.bias === "on", inputs: cfg.inputs });

  // ---------- numbers in words ----------
  const sig2 = (v) => { const a = Math.abs(v); const s = a === 0 ? "0" : a >= 100 ? Math.round(a).toLocaleString("en") : a >= 0.01 ? a.toFixed(2) : String(+a.toPrecision(2)); return (v < 0 && s !== "0" ? "−" : "") + s; };
  const money = (x) => "$" + Math.round(x).toLocaleString("en");
  /** What a rider shows: the input the neuron multiplies (normalised inputs as the neuron sees them). */
  function riderText(x, j) {
    if (!loans()) return String(x[j]);
    if (cfg.inputs === "raw") return j === 0 ? Math.round(x[0]).toLocaleString("en") : x[1].toFixed(2);
    const v = n.feed(x)[j];
    return (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1);
  }
  const inputsText = (x) => (loans()
    ? T(money(x[0]) + ", debt " + x[1].toFixed(2), money(x[0]) + ", deuda " + x[1].toFixed(2))
    : T("x1 " + x[0] + ", x2 " + x[1], "x1 " + x[0] + ", x2 " + x[1]));
  const target = (y) => (loans() ? (y ? T("was approved", "fue aprobado") : T("was declined", "fue rechazado")) : (y ? T("should be yes", "debía ser sí") : T("should be no", "debía ser no")));
  const yesNo = (y) => (loans() ? (y ? T("approve", "aprobar") : T("decline", "rechazar")) : (y ? T("yes", "sí") : T("no", "no")));

  // ---------- a run ----------
  function start(newSeed = true) {
    if (newSeed) seed = (seed * 7 + 3) % 9973 + 1;
    n = makeNeuron(neuronCfg(), seed, makeData(cfg.task, 11));
    cap = loans() ? SCALE_EPOCHS : EPOCHS.logic;
    low = loans() && cfg.act === "sigmoid" && cfg.rule === "gradient" ? lowestLoss(n.data) : 0;
    disp.w = [...n.w]; disp.b = n.b; disp.tilt = 0; disp.out = 0;
    cur = null; slot = 0; acc = 0; ended = null; calm = 0; lastMoved = null; moves = [];
    epochSides = sides(n);
    buildTokens();
    show(axes.logic, !loans()); show(axes.loans, loans());
    setText(actWord, cfg.act === "step" ? L("STEP", "ESCALÓN") : L("SIGMOID", "SIGMOIDE"));
    setText(ofWord, L("OF " + n.data.pts.length, "DE " + n.data.pts.length));
    show(riders.b.g, cfg.bias === "on");
    root.controls.showFor(loans() ? "loans" : "logic");
    root.relabel("train", training ? L("Stop", "Detener") : L("Train", "Entrenar"));
    counters();
    paint(1);
    root.figure.say(L(startText()));
  }
  const TASK = { and: T("AND", "AND"), or: T("OR", "OR"), nand: T("NAND", "NAND"), xor: T("XOR", "XOR"), loans: T("the loans", "los préstamos") };
  const startText = () => {
    const task = TASK[cfg.task];
    if (cfg.rule === "gradient" && cfg.act === "step") return T(task.en + " · gradient training through a step", task.es + " · entrenamiento por gradiente a través de un escalón");
    return training ? T("training " + task.en + " from random starting weights", "entrenando " + task.es + " desde pesos iniciales al azar")
      : T(task.en + " · random starting weights · press Train", task.es + " · pesos iniciales al azar · toca Entrenar");
  };
  function buildTokens() {
    layers.tokens.replaceChildren(); layers.front.replaceChildren(); layers.ring.replaceChildren();
    const size = loans() ? "loans" : "logic";
    tokens = n.data.pts.map((p) => {
      const g = document.createElementNS(NS, "g");
      g.innerHTML = TOK[size][p.y ? "yes" : "no"];
      const at = [BX(p.at[0]), BY(p.at[1]), 0];
      g.setAttribute("transform", translateAlong(P, at));
      return { g, p, at, depth: depthOf(at, P), body: g.querySelector(".iso-solid"), lit: null, front: null };
    }).sort((a, b) => a.depth - b.depth);
    tokens.forEach((tk) => layers.tokens.appendChild(tk.g));
    ring = document.createElementNS(NS, "g");
    ring.innerHTML = RING[size];
    ring.style.display = "none";
    layers.ring.appendChild(ring);
  }

  // ---------- one example ----------
  function step() {
    const before = { w: [...n.w], b: n.b };
    const e = n.step();
    cur = { ...e, before, after: { w: [...n.w], b: n.b }, p: n.data.pts[e.i] };
    slot = 0;
    if (e.epochEnd) endOfEpoch();
    counters();
    return e;
  }
  // the share of the board the line swept in each recent epoch; the machine shows their average over the last 10
  let moves = [];
  const movedAvg = () => moves.reduce((x, y) => x + y, 0) / Math.max(1, moves.length);
  const movedPct = () => { const m = movedAvg(); return m > 0 && m < 0.01 ? "<1%" : Math.round(100 * m) + "%"; };
  function endOfEpoch() {
    const s = sides(n);
    lastMoved = swept(epochSides, s);
    epochSides = s;
    moves.push(lastMoved); if (moves.length > 10) moves.shift();
    stat("moved", movedPct());
    const N = n.data.pts.length;
    if (cfg.rule === "perceptron" && n.settled) return finish(T("settled after " + n.epoch + (n.epoch === 1 ? " epoch" : " epochs") + ": a whole epoch without a mistake", "se asentó tras " + n.epoch + (n.epoch === 1 ? " época" : " épocas") + ": una época entera sin errores"));
    const flat = cfg.rule === "gradient" && cfg.act === "step";
    if (flat && n.epoch >= cap) return finish(T(n.epoch + " epochs and not one nudge: the step's slope is 0 · " + rightText().en, n.epoch + " épocas y ni un ajuste: la pendiente del escalón es 0 · " + rightText().es));
    if (low) {
      calm = lossOf(n) <= low + CLOSE ? calm + 1 : 0;
      if (calm >= 10) return finish(T("converged at epoch " + (n.epoch - 9) + ": the error is within " + CLOSE + " of the lowest any line reaches · " + rightText().en, "convergió en la época " + (n.epoch - 9) + ": el error está a menos de " + CLOSE + " del mínimo que alcanza una línea · " + rightText().es));
    }
    if (cfg.rule === "gradient" && cfg.act === "sigmoid" && !loans() && n.lastEpochMistakes === 0 && lastMoved < 0.01) return finish(T("at rest after " + n.epoch + " epochs: every example right, and the line moved under 1% of the board last epoch", "en reposo tras " + n.epoch + " épocas: todos los ejemplos bien, y la línea movió menos del 1% del tablero en la última época"));
    if (n.epoch >= cap) {
      const best = Math.round(n.best * N);
      const mistakes = n.lastEpochMistakes === 1 ? T("1 mistake", "1 error") : T(n.lastEpochMistakes + " mistakes", n.lastEpochMistakes + " errores");
      if (cfg.rule === "perceptron" && !loans()) return finish(T(n.epoch + " epochs, never settled · " + mistakes.en + " in the last one · best so far " + best + " of " + N, n.epoch + " épocas, nunca se asentó · " + mistakes.es + " en la última · lo mejor hasta ahora " + best + " de " + N));
      if (cfg.rule === "perceptron") return finish(T(n.epoch + " epochs, never settled · line moved " + movedPct() + " of the board per epoch · best so far " + best + " of " + N, n.epoch + " épocas, nunca se asentó · la línea movió el " + movedPct() + " del tablero por época · lo mejor: " + best + " de " + N));
      return finish(T(n.epoch + " epochs, never converged · line moved " + movedPct() + " of the board per epoch · " + rightText().en, n.epoch + " épocas, nunca convergió · la línea movió el " + movedPct() + " del tablero por época · " + rightText().es));
    }
    if (cfg.speed > 2) {
      const tail = flat ? T("0 nudges: the step's slope is 0", "0 ajustes: la pendiente del escalón es 0") : T("line moved " + movedPct() + " of the board per epoch", "la línea movió el " + movedPct() + " del tablero por época");
      root.figure.say(L(T("epoch " + n.epoch + " · " + rightText().en + " · " + tail.en, "época " + n.epoch + " · " + rightText().es + " · " + tail.es)));
    }
  }
  function finish(text) {
    ended = { text, until: performance.now() + HOLD, auto: training };
    training = false;
    root.relabel("train", L("Train", "Entrenar"));
    root.figure.say(L(text));
  }
  const rightCount = () => Math.round(n.accuracy() * n.data.pts.length);
  const rightText = () => { const k = rightCount(), N = n.data.pts.length; return T(k + " of " + N + " right", k + " de " + N + " acertados"); };
  function counters() {
    const k = rightCount(), N = n.data.pts.length;
    C.right.setClamped(k); C.epoch.setClamped(n.epoch); C.nudges.setClamped(n.nudges);
    stat("right", k + " / " + N + " · " + Math.round((100 * k) / N) + "%");
    stat("best", Math.round(n.best * N) + " / " + N);
    stat("epoch", String(n.epoch));
    stat("nudges", n.nudges.toLocaleString("en"));
    stat("weights", sig2(n.w[0]) + " · " + sig2(n.w[1]) + (cfg.bias === "on" ? " · " + sig2(n.b) : " · –"));
    if (lastMoved === null) stat("moved", "–");
  }
  function narrateExample() {
    const e = cur, p = e.p;
    const says = cfg.act === "sigmoid" ? T(e.out.toFixed(2) + " (" + yesNo(e.yes).en + ")", e.out.toFixed(2) + " (" + yesNo(e.yes).es + ")") : yesNo(e.yes);
    const head = T(inputsText(p.x).en + " → " + says.en, inputsText(p.x).es + " → " + says.es);
    let tail;
    if (cfg.rule === "perceptron") tail = e.mistake ? T(target(p.y).en + " · nudge", target(p.y).es + " · ajuste") : T("right · no change", "bien · sin cambio");
    else if (cfg.act === "step") tail = e.mistake ? T("wrong, but the step's slope is 0: no nudge", "mal, pero la pendiente del escalón es 0: sin ajuste") : T("right · slope 0, no nudge", "bien · pendiente 0, sin ajuste");
    else { const g = Math.abs(p.y - e.out); tail = T((e.mistake ? "wrong" : "right") + " · nudge × " + g.toFixed(2), (e.mistake ? "mal" : "bien") + " · ajuste × " + g.toFixed(2)); }
    root.figure.say(L(head.en + " · " + tail.en, head.es + " · " + tail.es));
  }

  // ---------- painting ----------
  /** z as a function of board coordinates (A u + B v + C) for weights w, b. */
  function lineOf(w, b) {
    const z = (u, v) => { const f = n.feed(fromBoard(n.data.bd, [u, v])); return w[0] * f[0] + w[1] * f[1] + b; };
    const Cc = z(0, 0);
    return { A: z(1, 0) - Cc, B: z(0, 1) - Cc, C: Cc };
  }
  let rulerKey = "", yesKey = "";
  function paint(f) {
    // ease the shown weights toward the target: the ones the example was weighed with, then the nudged ones
    const animated = cfg.speed <= 8 && cur;
    const tgt = cur ? (animated && slot < 0.5 ? cur.before : cur.after) : { w: n.w, b: n.b };
    disp.w[0] += (tgt.w[0] - disp.w[0]) * f; disp.w[1] += (tgt.w[1] - disp.w[1]) * f; disp.b += (tgt.b - disp.b) * f;
    // beam and meter: the example being weighed (with the weights it was weighed with)
    const zNow = cur ? cur.z : 0, outNow = cur ? cur.out : (cfg.act === "sigmoid" ? 0.5 : 0);
    disp.tilt += (tiltOf(zNow) - disp.tilt) * f;
    disp.out = cfg.act === "step" ? outNow : disp.out + (outNow - disp.out) * f;     // a step flips at once
    const bp = beamPaths(P, disp.tilt);
    for (const key in beamEls) setD(beamEls[key], bp[key]);
    needle.set(disp.out);
    const hundredths = Math.round(disp.out * 100);
    C.outI.set(Math.floor(hundredths / 100)); C.outF.set(hundredths % 100);
    // riders: at their weights, on the tilted beam, front ones drawn last
    const ws = { x1: disp.w[0], x2: disp.w[1], b: disp.b };
    const placed = Object.keys(riders).map((name) => {
      const lane = LANES[name], to = riderAt(ws[name], lane, disp.tilt), base = [lane, PIVOT.y, PIVOT.z + BEAM.h];
      riders[name].g.setAttribute("transform", translateAlong(P, [to[0] - base[0], to[1] - base[1], to[2] - base[2]]));
      return { name, depth: depthOf(to, P) };
    }).sort((a, b) => a.depth - b.depth);
    const kids = [...layers.riders.children];
    if (placed.some((r, i) => riders[r.name].g !== kids[i])) placed.forEach((r) => layers.riders.appendChild(riders[r.name].g));
    if (cur) { setText(riders.x1.value, riderText(cur.p.x, 0)); setText(riders.x2.value, riderText(cur.p.x, 1)); }
    // the board: the yes side, the sigmoid's band, the ruler, mistakes lit
    const { A, B, C: Cc } = lineOf(disp.w, disp.b);
    const poly = clip(SQUARE, A, B, Cc, 1);
    const yk = poly.map((p) => p[0].toFixed(3) + "," + p[1].toFixed(3)).join(" ");
    if (yk !== yesKey) {
      yesKey = yk;
      layers.yes.innerHTML = poly.length >= 3 ? `<path class="nr-yes" d="${onBoard(P, poly, true)}"/>` : "";
      const bands = cfg.act === "sigmoid" ? [chord(A, B, Cc, BAND), chord(A, B, Cc, -BAND)].filter(Boolean).map((s) => onBoard(P, s)).join("") : "";
      layers.band.innerHTML = bands ? `<path class="iso-line" data-tone="mid" data-dashed="" d="${bands}"/>` : "";
      const seg = chord(A, B, Cc, 0);
      const rk = seg ? seg.flat().map((v) => v.toFixed(3)).join(",") : "";
      if (rk !== rulerKey) { rulerKey = rk; layers.ruler.innerHTML = rulerSvg(P, seg); }
      // a token on the viewer's side of the ruler is drawn over it
      const view = [Math.cos((50 * Math.PI) / 180), Math.sin((50 * Math.PI) / 180)];
      for (const tk of tokens) {
        const [u, v] = tk.p.at;
        // world gradient of the line function: d/dx = A / FIELD.w, d/dy = −B / FIELD.d (v grows toward −y)
        const facing = A * view[0] - B * view[1];
        const front = !!seg && (A * u + B * v + Cc) * facing > 0;
        if (tk.front !== front) { tk.front = front; (front ? layers.front : layers.tokens).appendChild(tk.g); }
      }
      for (const lay of [layers.tokens, layers.front]) {
        const list = tokens.filter((tk) => tk.g.parentNode === lay);
        const ch = [...lay.children];
        if (list.some((tk, i) => tk.g !== ch[i])) list.forEach((tk) => lay.appendChild(tk.g));
      }
    }
    for (const tk of tokens) {
      const [u, v] = tk.p.at;
      const wrong = ((A * u + B * v + Cc > 0) ? 1 : 0) !== tk.p.y;
      if (tk.lit !== wrong) { tk.lit = wrong; tk.body.toggleAttribute("data-lit", wrong); tk.body.toggleAttribute("data-lit-fill", wrong); }
    }
    if (cur) {
      ring.style.display = "";
      ring.setAttribute("transform", translateAlong(P, [BX(cur.p.at[0]), BY(cur.p.at[1]), 0]));
    } else ring.style.display = "none";
  }

  // ---------- the loop ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    if (ended && ended.auto && performance.now() > ended.until) { training = true; start(); }
    if (training && !ended) {
      acc += dt * cfg.speed;
      let k = 0;
      while (acc >= 1 && k < 60 && !ended) {
        acc -= 1; k++;
        step();
        if (cfg.speed <= 2) narrateExample();
      }
    }
    slot = Math.min(1, slot + dt * Math.max(1, cfg.speed));
    const f = still.matches ? 1 : 1 - Math.exp(-dt * (cfg.speed <= 8 ? 12 : 30));
    paint(f);
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw) {
    root.press(name, raw);
    cfg[name] = name === "speed" ? Number(raw) : String(raw);
  }
  root.on("change", (name, value) => {
    set(name, value);
    if (name === "speed") return;
    start(false);
  });
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    train: () => {
      if (ended) start(false);
      training = !training;
      if (ended) ended = null;
      root.relabel("train", training ? L("Stop", "Detener") : L("Train", "Entrenar"));
      root.figure.say(training ? L("training", "entrenando") : L("stopped · press Train or One example", "detenido · toca Entrenar o Un ejemplo"));
      wake();
    },
    one: () => {
      if (ended) start(false);
      training = false; ended = null;
      root.relabel("train", L("Train", "Entrenar"));
      step(); narrateExample(); slot = 0;
      wake();
    },
    reset: () => { start(true); wake(); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  // warm: epochs trained at once before the machine shows the run; cap: the epoch the run stops at.
  root.on("watch", (w) => {
    for (const key of ["task", "act", "rule", "bias", "inputs", "speed"]) if (w[key] !== undefined) set(key, w[key]);
    training = true;
    start(false);
    if (w.cap) cap = w.cap;
    for (let e = 0; e < (w.warm || 0); e++) {
      n.runEpoch();
      if (e >= w.warm - 11) { const s = sides(n); if (e >= w.warm - 10) { lastMoved = swept(epochSides, s); moves.push(lastMoved); } epochSides = s; }
    }
    if (w.warm) {
      stat("moved", movedPct());
      disp.w = [...n.w]; disp.b = n.b; counters();
      root.figure.say(L(T(w.warm + " epochs trained at once · watching the next ones", w.warm + " épocas entrenadas de golpe · mirando las siguientes")));
    }
    wake();
  });

  loop.setPaused(loop.paused);
  start(false);
}

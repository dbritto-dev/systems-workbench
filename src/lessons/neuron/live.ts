// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The rolling board in the browser. By hand (the steppers, the animal set, the lean switch) every animal is sorted
// again at once: all their paths show faint, the first one sorted wrong in bold. Train sends the animals down the board
// one at a time with the perceptron rule from sim.ts: an animal rolls down the middle line, each kicker that applies
// pushes it sideways by its share as it passes (its arm runs out), and it rolls past the divider into a pen. After a
// wrong sort it lights up in the wrong pen, the signs show the notch each kicker moves and the dashed outline the push
// it would get now; then the kickers move. A run stops once a whole round is right; one that goes REST_AFTER rounds
// without that rests and starts over from 0. Watch plays an experiment: its hand settings (one every 2 s), then
// training, faster. Reduced motion: no rolling, each animal is drawn where it lands.
import * as WB from "../../runtime/wb";
import { L } from "../../runtime/wb";
import { playPause } from "../../runtime/dom";
import { localize } from "../../i18n/localize";
import { easeInOutQuad } from "../../lib/tween";
import { buildFigure, rollSvg, readState, pushesOf, firesOn, START, NAMES, KIND, sgn, scoreText } from "./board";
import { makeNeuron, ANIMALS, SETS } from "./sim";

const PACE = { roll: 1.5, hold: 1.4, gap: 0.3, round: 1.2, rest: 3.5 };   // page seconds at Train's own speed
const REST_AFTER = 12;                                                      // rounds without a clean one before a rest
const LAYOUTS = ["desk", "phone"];

export default function mount(data, root) {
  const lang = WB.lang();
  const st = structuredClone(START);
  let n = null, e = null, seed = 1, pace = 1, stage = "idle", clock = 0, oneOnly = false, learned = false, rested = false;
  let watchTimer = 0;
  const svgs = () => LAYOUTS.map((l) => [l, root.$(`svg.nr-${l}`)]).filter(([, el]) => el);
  const dur = (k) => PACE[k] * pace;

  // ---------- drawing ----------
  function paint(f = 1) {
    for (const [layout, el] of svgs()) {
      const svg = localize(buildFigure(st, layout, f), lang);
      el.setAttribute("viewBox", svg.match(/viewBox="([^"]*)"/)[1]);
      el.innerHTML = svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>"));
    }
    const rd = readState(st);
    root.stat("right", rd.sorted ? `${rd.right} / ${rd.sorted}` : "–");
    root.stat("rounds", st.mode === "hand" ? "–" : String(st.round));
    root.stat("mistakes", st.mode === "hand" ? "–" : String(st.mistakes));
    say(rd);
  }
  /** Only the moving layer: the kickers' arms, the bold path and the animal rolling, f of its way. */
  function paintRoll(f) {
    for (const [layout, el] of svgs()) {
      const g = el.querySelector('[data-layer="roll"]');
      if (g) g.innerHTML = localize(rollSvg(st, layout, f), lang);
    }
  }

  // ---------- the readout: the picture now ----------
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // who it is, its kg, and its ears (unless its name already says)
  const who = (id) => {
    const [, kg, fl] = ANIMALS[id], en = NAMES[id].en, es = NAMES[id].es;
    return { en: `${cap(en)}, ${kg} kg${/ear/.test(en) ? "" : `, ${fl ? "floppy" : "pointy"} ears`}`, es: `${cap(es)}, ${kg} kg${/oreja/.test(es) ? "" : `, orejas ${fl ? "caídas" : "paradas"}`}` };
  };
  // a push as the readout writes it: as few decimals as it needs (a 6 kg animal at +1.6: 0.96)
  const num = (v) => String(Math.abs(Math.round(v * 100) / 100));
  const sum = (id) => {
    const p = pushesOf(st.d, id, st.lean).map((v, i) => (firesOn(i, id, st.lean) ? v : 0)).slice(st.lean ? 0 : 1);
    const total = Math.round(p.reduce((a, b) => a + b, 0) * 100);
    return `${p[0] < 0 ? "−" : ""}${num(p[0])} ${p.slice(1).map((v) => `${v < 0 ? "−" : "+"} ${num(v)}`).join(" ")} = ${scoreText(total)}`;
  };
  function say(rd = readState(st)) {
    const S = (en, es) => root.figure.say(L(en, es));
    const zero = (a) => a.s === 0;
    if (learned) return S(`Learned: a whole round right, after ${st.mistakes} ${st.mistakes === 1 ? "mistake" : "mistakes"}. The kickers stay at ${sgn(st.d.lean)}, ${sgn(st.d.w10 / 10, 1)} and ${sgn(st.d.ears)}.`,
      `Aprendido: una vuelta entera bien, tras ${st.mistakes} ${st.mistakes === 1 ? "error" : "errores"}. Los empujadores quedan en ${sgn(st.d.lean)}, ${sgn(st.d.w10 / 10, 1)} y ${sgn(st.d.ears)}.`);
    if (stage === "rest") return S(`${REST_AFTER} rounds, and never one all right: one straight cut can't sort these. Starting over from 0.`,
      `${REST_AFTER} vueltas y ninguna entera bien: un solo corte recto no separa estos animales. Empieza de nuevo desde 0.`);
    if (st.mode === "hand") {
      const a = rd.cur, n8 = rd.all.length;
      if (!a) return S(`All ${n8} right: every dog ends on the DOG side, every cat on the CAT side.`, `Los ${n8} bien: todos los perros terminan del lado PERRO y todos los gatos del lado GATO.`);
      return S(`${rd.right} of ${n8} right. In bold, the first one wrong, ${who(a.id).en.toLowerCase()}: ${sum(a.id)}, ${zero(a) ? "on the line (counts as CAT)" : a.got ? "DOG side" : "CAT side"}.`,
        `${rd.right} de ${n8} bien. En negrita, el primero mal, ${who(a.id).es.toLowerCase()}: ${sum(a.id)}, ${zero(a) ? "sobre la línea (cuenta como GATO)" : a.got ? "lado PERRO" : "lado GATO"}.`);
    }
    if (stage === "round") return S(`Round ${st.round} done: ${rd.right} of ${rd.sorted} right. Next round, in a new order.`, `Vuelta ${st.round} terminada: ${rd.right} de ${rd.sorted} bien. Sigue otra vuelta, en otro orden.`);
    const a = rd.cur;
    if (!a) return S(`Round ${st.round}: ${rd.right} of ${rd.sorted} right so far.`, `Vuelta ${st.round}: ${rd.right} de ${rd.sorted} bien hasta ahora.`);
    if (st.phase !== "correct") return S(`Round ${st.round}. ${who(a.id).en}: ${sum(a.id)}, ${zero(a) ? "on the line (counts as CAT)" : a.got ? "DOG side" : "CAT side"}.`,
      `Vuelta ${st.round}. ${who(a.id).es}: ${sum(a.id)}, ${zero(a) ? "sobre la línea (cuenta como GATO)" : a.got ? "lado PERRO" : "lado GATO"}.`);
    const moves = [[st.nudge.lean, "lean", "tendencia", 0], [st.nudge.w10 / 10, "10 kg", "10 kg", 1], [st.nudge.ears, "ears", "orejas", 0]].filter(([d]) => d);
    const list = (k) => moves.map((m) => `${m[k]} ${sgn(m[0], m[3])}`).join(", ");
    S(`Wrong: it's a ${KIND[a.kind].en.toLowerCase()} in the ${a.got ? "DOG" : "CAT"} pen. The kickers move a notch toward ${KIND[a.kind].en}: ${list(1)}.`,
      `Error: es un ${KIND[a.kind].es.toLowerCase()} en el corral ${a.got ? "PERRO" : "GATO"}. Los empujadores se mueven hacia ${KIND[a.kind].es}: ${list(2)}.`);
  }

  // ---------- training ----------
  const upcoming = () => n.order.slice(n.at).map((i) => SETS[st.set][i]);
  const pressSteppers = () => { root.press("kg", st.d.w10 / 10); root.press("ears", st.d.ears); root.press("lean", st.d.lean); };
  function begin() {
    n = makeNeuron({ set: st.set, lean: st.lean }, seed, { ...st.d });
    seed = (seed * 7 + 3) % 997 + 1;
    Object.assign(st, { mode: "train", round: 1, mistakes: 0, sorted: [], cur: null, phase: null, nudge: null });
    learned = false; rested = false;
    next();
  }
  /** The next animal leaves the queue and starts to roll. */
  function next() {
    const before = { ...n.d };
    e = n.step();
    Object.assign(st, { cur: e.id, d: before, phase: "roll", nudge: e.err ? { ...e.nudge } : null, queue: upcoming() });
    stage = "roll"; clock = 0;
    paint(WB.still.matches ? 1 : 0);
  }
  /** It reaches its pen. */
  function land() {
    if (e.err) {
      st.phase = "correct"; st.mistakes = n.mistakes; stage = "hold";
    } else {
      st.sorted.push([e.id, e.got]); Object.assign(st, { cur: null, phase: null, nudge: null }); stage = "gap";
    }
    clock = 0; paint();
  }
  /** After a mistake: the kickers move their notch. */
  function click() {
    st.sorted.push([e.id, e.got]);
    Object.assign(st, { cur: null, phase: null, nudge: null, d: { ...n.d } });
    pressSteppers();
    stage = "gap"; clock = 0; paint();
  }
  /** After an animal: the next one, the end of a round, a rest, or done. */
  function after() {
    if (e.roundEnd) {
      if (n.settled) { learned = true; st.queue = []; stop(); paint(); return; }
      stage = "round"; clock = 0; st.queue = upcoming(); paint(); return;
    }
    if (oneOnly) { stage = "idle"; stop(false); paint(); return; }
    next();
  }
  function newRound() {
    if (n.round >= REST_AFTER && !rested) { stage = "rest"; clock = 0; rested = true; paint(); return; }
    st.sorted = []; st.round = n.round + 1;
    if (oneOnly) { stage = "idle"; stop(false); paint(); return; }
    next();
  }
  function restart() {
    st.d = { w10: 0, ears: 0, lean: 0 }; pressSteppers();
    begin();
  }
  function step(dt) {
    if (stage === "idle") return;
    clock += dt;
    if (stage === "roll") {
      const f = Math.min(1, clock / dur("roll"));
      if (!WB.still.matches) paintRoll(easeInOutQuad(f));
      if (f >= 1) land();
    } else if (stage === "hold") { if (clock >= dur("hold")) click(); }
    else if (stage === "gap") { if (clock >= dur("gap")) after(); }
    else if (stage === "round") { if (clock >= dur("round")) newRound(); }
    else if (stage === "rest") { if (clock >= PACE.rest) restart(); }
  }

  // ---------- controls ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage: root.figure.stage, step, onPause: pause.onPause });
  pause.bind(loop);
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const running = () => stage !== "idle";
  /** Stop training (the animal in play finishes where it was going first), or, toHand, leave it for the hand setting. */
  function stop(toHand = false) {
    if (!toHand && stage === "roll") land();
    if (!toHand && stage === "hold") click();
    stage = "idle"; oneOnly = false;
    root.relabel("train", L("Train", "Entrenar"));
    if (toHand) { n = null; e = null; learned = false; Object.assign(st, { mode: "hand", cur: null, phase: null, nudge: null, sorted: [], queue: [], round: 0, mistakes: 0 }); }
  }
  /** Go on from where a stopped run is (a new run if there's none, or it has learned). */
  function resume() {
    if (st.mode !== "train" || !n || learned) return begin();
    if (e?.roundEnd && st.sorted.length >= SETS[st.set].length) return newRound();
    next();
  }
  function train(p = 1) {
    pace = p; oneOnly = false;
    root.relabel("train", L("Stop", "Detener"));
    wake();
    if (stage === "idle") resume();
  }
  const endWatch = () => { clearInterval(watchTimer); clearTimeout(watchTimer); watchTimer = 0; };
  const leanReason = L("The starting lean is taken away", "La tendencia inicial está quitada");

  root.on("change", (name, value) => {
    endWatch();
    if (name === "kg") st.d.w10 = Math.round(+value * 10);
    else if (name === "ears") st.d.ears = +value;
    else if (name === "lean") st.d.lean = +value;
    else if (name === "set") st.set = value;
    else if (name === "use") { st.lean = value === "on"; if (!st.lean) { st.d.lean = 0; root.press("lean", 0); } root.disable("lean", !st.lean, leanReason); }
    stop(true); paint();
  });
  root.on("action", (name) => {
    if (name === "pause") return;
    endWatch();
    if (name === "train") { if (running() && !oneOnly) { stop(); paint(); } else if (!running()) train(); else if (oneOnly) { oneOnly = false; root.relabel("train", L("Stop", "Detener")); } }
    else if (name === "one") {
      if (running()) return;
      wake(); pace = 1; oneOnly = true;
      resume();
    } else if (name === "reset") { st.d = { w10: 0, ears: 0, lean: 0 }; pressSteppers(); stop(true); paint(); }
  });
  // Watch: an experiment's settings { set, lean: "on" | "off", hand: [[10 kg, ears, lean], …], train, pace, seed, hold }:
  // the hand settings one every 2 s (a single one for `hold` ms), then training at `pace` (1: Train's own speed).
  root.on("watch", (w) => {
    endWatch(); stop(true);
    st.set = w.set; root.press("set", w.set);
    st.lean = w.lean !== "off"; root.press("use", st.lean ? "on" : "off"); root.disable("lean", !st.lean, leanReason);
    const path = w.hand?.length ? w.hand : [[0, 0, 0]];
    let i = 0;
    const set = () => { const [kg, ears, lean] = path[i]; st.d = { w10: Math.round(kg * 10), ears, lean: st.lean ? lean : 0 }; pressSteppers(); stop(true); paint(); };
    set();
    if (w.seed) seed = w.seed;
    wake();
    const go = () => { endWatch(); if (w.train) train(w.pace ?? 1); };
    if (path.length === 1) { watchTimer = setTimeout(go, w.hold ?? 700); return; }
    watchTimer = setInterval(() => {
      if (loop.paused) return;
      if (++i < path.length) return set();
      go();
    }, 2000);
  });
  paint();
}

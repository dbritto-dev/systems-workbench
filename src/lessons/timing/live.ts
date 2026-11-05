// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The combination checker in the browser: runs the listener one reading at a time, turns the stopwatch, lights the
// dials each check looked at, raises the tally bars to the average reading per digit, and lays down a card for each
// dial the listener settles on. mount() gets the build-time data from page.ts and root, the <wb-lesson>.
import { slabOf, solidSvg } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, setLit, playPause } from "../../runtime/dom";
import { clamp } from "../../lib/stats";
import { int } from "../../lib/format";
import { makeLive } from "./sim";

export default function mount({ P, G, LENGTHS, DIALS, BASE, STEP }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const counters = Object.fromEntries(["guess", "runs", "opened", "readI", "readF", "readings", "dial", "samples"].map((n) => [n, WB.counter(svg, n, P)]));
  const watch = WB.dial(svg, "watch", P);
  const lamps = qa("[data-look]");
  const openLamp = q("[data-open]");
  const modes = { early: q('[data-mode="early"]'), const: q('[data-mode="const"]') };
  const bars = G.BAR_X.map((_, i) => q(`[data-bar="${i}"]`));
  const labels = G.BAR_X.map((_, i) => q(`[data-col="${i}"]`));
  const caps = { dials: q('[data-cap="dials"]'), length: q('[data-cap="length"]') };
  const cards = G.CARD_X.map((_, i) => q(`[data-card="${i}"]`));
  const cardText = G.CARD_X.map((_, i) => q(`[data-card-text="${i}"]`));
  const RATE = 30;                                   // readings per second at 1×

  const cfg = { compare: "early", noise: 4, samples: 320, delay: 0, probe: "dials", input: "raw", speed: 16 };
  let model, seed = 3, runs = 0, opened = 0, budget = 0, hold = 0, after = null, lastSay = 0;
  const shownH = [];

  function restart(keepTally) {
    if (!keepTally) { runs = 0; opened = 0; }
    model = makeLive({ compare: cfg.compare, noise: Number(cfg.noise), samples: Number(cfg.samples), delay: Number(cfg.delay), probe: cfg.probe, input: cfg.input }, seed);
    seed = (seed * 7 + 5) % 9973 + 1;
    budget = 0; hold = 0; after = null;
    const length = cfg.probe === "length";
    show(caps.dials, !length); show(caps.length, length);
    labels.forEach((el, i) => { const on = !length || i < LENGTHS.length; show(el, on); show(bars[i], on); setText(el, length ? (i < LENGTHS.length ? LENGTHS[i] : "") : i); });
    cards.forEach((c) => show(c, false));
    setLit(modes.early, cfg.compare === "early"); setLit(modes.const, cfg.compare === "const");
    setLit(openLamp, false);
    root.controls.showFor(cfg.probe);
    shownH.length = 0;
    paint();
    showStats();
  }

  // ---------- the bars ----------
  // A bar rises one step for each unit its average stands above the cost of a wrong guess at this dial.
  const SCALE = { dials: 7, length: 4.5 };
  function refCost() {
    const pad = Number(cfg.delay) / 2;
    if (cfg.probe === "length") return BASE + pad;
    const dial = Math.min(model.st.dial, DIALS - 1);
    return BASE + STEP * (cfg.compare === "early" ? dial + 1 : DIALS) + pad;
  }
  function barHeight(i) {
    // while a pick is shown, the means of the dial just decided (the model has already moved on)
    if (after && after.sums) {
      const dial = model.st.dial - 1, pad = Number(cfg.delay) / 2;
      const ref = BASE + STEP * (cfg.compare === "early" ? dial + 1 : DIALS) + pad;
      return clamp(3 + SCALE.dials * (after.sums[i] - ref), G.BAR.min, G.BAR.max);
    }
    const c = model.st.counts[i];
    if (!c) return G.BAR.min;
    const m = model.st.sums[i] / c;
    return clamp(3 + SCALE[cfg.probe] * (m - refCost()), G.BAR.min, G.BAR.max);
  }
  function drawBar(i, h) {
    const q4 = Math.round(h * 4) / 4;
    if (shownH[i] === q4) return;
    shownH[i] = q4;
    const x = G.BAR_X[i];
    bars[i].innerHTML = solidSvg(slabOf({ x: x - G.BAR.w / 2, y: G.BAR.y - G.BAR.d / 2, w: G.BAR.w, d: G.BAR.d, r: 0.5 }, G.BAR.base, q4, P, 2, 0.3), { tone: "hi", crease: "lo" });
  }

  // ---------- painting ----------
  let litCol = -1;
  function paint() {
    const st = model.st, length = cfg.probe === "length";
    const cols = length ? LENGTHS.length : G.BAR_X.length;
    const lastDial = !length && st.dial >= DIALS - 1;
    for (let i = 0; i < cols; i++) drawBar(i, lastDial && !after ? G.BAR.min : barHeight(i));
    const col = after ? after.col : st.done ? -1 : lastDial ? -1 : st.col;
    bars.forEach((b, i) => setLit(b, i === col));
    litCol = col;
    lamps.forEach((l, i) => setLit(l, i < st.looked));
    // the guess on the wheels
    let guess;
    if (length) guess = Array(DIALS).fill(0);
    else if (st.done) guess = st.known.slice(0, DIALS);
    else guess = [...st.known, st.col, ...Array(Math.max(0, DIALS - st.known.length - 1)).fill(0)].slice(0, DIALS);
    counters.guess.set(Number(guess.join("")));
    const r = clamp(st.last, 0, 999.9);
    counters.readI.setClamped(Math.floor(r));
    counters.readF.set(Math.floor((r * 10) % 10));
    watch.set(clamp((st.last - (BASE - 20)) / 80));
    counters.readings.setClamped(st.readings);
    counters.dial.set(length ? 0 : Math.min(st.dial + 1, DIALS));
    counters.samples.setClamped(lastDial ? 0 : st.sample);
    counters.runs.setClamped(runs);
    counters.opened.setClamped(opened);
    st.known.forEach((d, i) => { if (i < DIALS) { show(cards[i], true); setText(cardText[i], d); } });
  }

  // ---------- narration ----------
  const say = (text) => root.figure.say(L(text));
  function narrateProgress() {
    const now = performance.now();
    if (now - lastSay < 300) return;
    lastSay = now;
    const st = model.st;
    if (cfg.probe === "length") {
      const len = LENGTHS[Math.min(st.col, LENGTHS.length - 1)];
      say(T("length probe · timing guesses " + len + " dials long · " + st.sample + " of " + cfg.samples, "prueba de longitud · midiendo intentos de " + len + " diales · " + st.sample + " de " + cfg.samples));
    } else if (st.dial >= DIALS - 1) {
      say(T("dial " + DIALS + " leaves no timing trace · trying its digits by hand", "el dial " + DIALS + " no deja rastro de tiempo · probando sus dígitos a mano"));
    } else {
      say(T("dial " + (st.dial + 1) + " · timing digit " + st.col + " · " + st.sample + " of " + cfg.samples + " readings", "dial " + (st.dial + 1) + " · midiendo el dígito " + st.col + " · " + st.sample + " de " + cfg.samples + " lecturas"));
    }
  }
  function onEvent(ev) {
    const st = model.st;
    if (ev.type === "pick") {
      const level = cfg.compare === "const";
      const right = ev.right;
      if (level) say(right ? T("dial " + (ev.dial + 1) + " · bars level · kept " + ev.pick + ", right by luck", "dial " + (ev.dial + 1) + " · barras parejas · fijó " + ev.pick + ", bien por suerte")
        : T("dial " + (ev.dial + 1) + " · bars level · kept " + ev.pick + ", a blind guess", "dial " + (ev.dial + 1) + " · barras parejas · fijó " + ev.pick + ", a ciegas"));
      else say(right ? T("dial " + (ev.dial + 1) + " · slowest average: " + ev.pick + " · right", "dial " + (ev.dial + 1) + " · promedio más lento: " + ev.pick + " · correcto")
        : T("dial " + (ev.dial + 1) + " · slowest average: " + ev.pick + " · wrong, noise won", "dial " + (ev.dial + 1) + " · promedio más lento: " + ev.pick + " · equivocado, ganó el ruido"));
      after = { col: ev.pick, sums: [...ev.means] };
      hold = 0.9;
      lastSay = performance.now() + 900;
      return true;
    }
    if (ev.type === "opened") {
      runs++; opened++;
      setLit(openLamp, true);
      say(T("opened in " + int(st.readings) + " readings · brute force takes " + int(10 ** DIALS / 2) + " tries on average", "abrió en " + int(st.readings) + " lecturas · la fuerza bruta tarda " + int(10 ** DIALS / 2) + " intentos en promedio"));
      hold = 2.6; after = { col: -1, end: true };
      lastSay = performance.now() + 2600;
      return true;
    }
    if (ev.type === "failed") {
      runs++;
      say(T("not opened · an earlier dial was wrong · next secret", "no abrió · un dial anterior estaba mal · siguiente secreto"));
      hold = 2.6; after = { col: -1, end: true };
      lastSay = performance.now() + 2600;
      return true;
    }
    if (ev.type === "lengthPick") {
      runs++; if (ev.right) opened++;
      say(ev.right ? T("longest average: length " + ev.pick + " · the secret's length, found", "promedio más largo: longitud " + ev.pick + " · la del secreto, encontrada")
        : T("bars level · picked length " + ev.pick + " · a blind guess", "barras parejas · eligió la longitud " + ev.pick + " · a ciegas"));
      hold = 2.6; after = { col: LENGTHS.indexOf(ev.pick), end: true };
      lastSay = performance.now() + 2600;
      return true;
    }
    return false;
  }

  // ---------- stats ----------
  function showStats() {
    const st = model.st;
    root.stat("readings", int(st.readings));
    root.stat("dial", cfg.probe === "length" ? "–" : Math.min(st.dial + 1, DIALS) + " / " + DIALS);
    root.stat("opened", opened + " / " + runs);
    root.stat("last", st.readings ? st.last.toFixed(1) : "–");
  }

  // ---------- the loop ----------
  let statTimer = 0;
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    if (hold > 0) {
      hold -= dt;
      if (hold <= 0) {
        const end = after && after.end;
        after = null;
        if (end) restart(true);
      }
    } else {
      budget += dt * RATE * Number(cfg.speed);
      let n = Math.min(Math.floor(budget), 6000);
      budget -= n;
      while (n-- > 0) { const ev = model.next(); if (onEvent(ev)) { budget = 0; break; } }
      if (hold <= 0) narrateProgress();
    }
    paint();
    statTimer += dt; if (statTimer > 0.2) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = String(raw);
    if (!quiet) { restart(false); say(T("settings applied · new secret", "ajustes aplicados · secreto nuevo")); }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    secret: () => { restart(true); say(T("new secret", "secreto nuevo")); wake(); },
    reset: () => { restart(false); say(T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const key of ["compare", "noise", "samples", "delay", "probe", "input"]) set(key, w[key], true);
    set("speed", w.speed ?? 16, true);
    restart(false);
    wake();
  });

  loop.setPaused(loop.paused);
  restart(false);
}

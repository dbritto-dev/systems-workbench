// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The race track in the browser: slides each lane's finish post to its step count, runs the carriages along the
// log-scale track, wires the controls and the experiment cards. mount() gets the build-time data from page.ts
// (geometry, the step counts per n, the experiment results).
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats, act, pauseControls } from "../../runtime/dom";
import { compact } from "./sim";

export default function mount({ P, TRACK, DECADES, LANE_LABEL, STEPS, R, FIRST_CLOCK, EXPERIMENTS }) {
  const KEYS = ["1", "log", "n", "nlog", "n2"];

  const stage = document.querySelector("[data-bigo]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const say = readout();
  const xOf = (steps) => TRACK.x0 + (Math.log10(Math.max(1, steps)) / DECADES) * (TRACK.x1 - TRACK.x0);
  const num = (v) => Math.round(v).toLocaleString("en");
  const setText = (el, s) => { if (el.textContent !== s) el.textContent = s; };
  const stat = stats();
  // Seconds as a short duration. Units are the same in both languages except days.
  const dur = (s) => {
    const f = (v) => (v < 10 ? v.toFixed(1).replace(/\.0$/, "") : Math.round(v).toLocaleString("en"));
    if (s < 1e-6) return f(s * 1e9) + " ns";
    if (s < 1e-3) return f(s * 1e6) + " µs";
    if (s < 1) return f(s * 1e3) + " ms";
    if (s < 120) return f(s) + " s";
    if (s < 7200) return f(s / 60) + " min";
    if (s < 172800) return f(s / 3600) + " h";
    return L(f(s / 86400) + " days", f(s / 86400) + " días");
  };

  const cars = [0, 1, 2, 3, 4].map((i) => ({ g: q('[data-car="' + i + '"]'), label: q('[data-car-text="' + i + '"]') }));
  const posts = [0, 1, 2, 3, 4].map((i) => q('[data-post="' + i + '"]'));
  const nlogSign = q("[data-nlog-sign]");
  const nText = q("[data-n-text]"), costText = q("[data-cost-text]");
  const clock = WB.dial(svg, "clock", P);
  const COST_LABEL = { "1e-9": "1 ns", "1e-7": "100 ns", "1e-3": "1 ms" };

  const cfg = { n: 1000, cost: "1e-9", constant: 1, speed: 1 };
  const RATE = 1.1;          // decades of the clock per second at speed ×1
  const HOLD = 2.6;          // seconds to show the finished race before it starts again
  let race, loop;
  const steps = () => KEYS.map((k, i) => STEPS[cfg.n][k] * (i === 3 ? cfg.constant : 1));
  function restart(atClock = 1) {
    const s = steps();
    race = { steps: s, logT: Math.log10(atClock), end: Math.log10(Math.max(...s)), hold: 0, msg: null };
    posts.forEach((p, i) => p.setAttribute("transform", translateAlong(P, [xOf(s[i]), 0, 0])));
    setText(nlogSign, LANE_LABEL[3] + (cfg.constant === 1 ? "" : " ×" + cfg.constant));
    setText(nText, "n = " + num(cfg.n));
    setText(costText, COST_LABEL[cfg.cost]);
    const c = Number(cfg.cost);
    stat("tn", dur(s[2] * c)); stat("tnlog", dur(s[3] * c)); stat("tn2", dur(s[4] * c));
    const r = s[4] / s[3];
    stat("vs", "×" + (r >= 10 ? num(r) : r >= 0.1 ? r.toFixed(1) : r.toFixed(2)));
    paint();
  }
  function paint() {
    const tNow = 10 ** Math.min(race.logT, race.end);
    race.steps.forEach((s, i) => {
      const done = Math.min(tNow, s);
      cars[i].g.setAttribute("transform", translateAlong(P, [xOf(done), 0, 0]));
      setText(cars[i].label, compact(Math.floor(done)));
      const running = tNow < s;
      cars[i].g.querySelectorAll(".iso-solid").forEach((el) => el.toggleAttribute("data-lit", running));
    });
    clock.set(Math.min(1, Math.log10(tNow) / DECADES));
    stat("clock", num(Math.floor(tNow)));
    stat("clockTime", dur(Math.floor(tNow) * Number(cfg.cost)));
    // Narrate the slowest lane still running, or the result once every lane is done.
    const running = race.steps.map((s, i) => [s, i]).filter(([s]) => s > tNow);
    if (running.length) {
      const [s, i] = running.reduce((a, b) => (b[0] > a[0] ? b : a));
      const left = running.length;
      race.msg = T(LANE_LABEL[i] + " running · " + compact(Math.floor(tNow)) + " of " + compact(s) + " steps · " + (5 - left) + " of 5 lanes done",
        LANE_LABEL[i] + " en carrera · " + compact(Math.floor(tNow)) + " de " + compact(s) + " pasos · " + (5 - left) + " de 5 carriles listos");
    } else {
      const slow = race.steps.indexOf(Math.max(...race.steps));
      race.msg = T("all lanes done · slowest " + LANE_LABEL[slow] + ", " + num(race.steps[slow]) + " steps = " + dur(race.steps[slow] * Number(cfg.cost)),
        "todos los carriles listos · el más lento, " + LANE_LABEL[slow] + ", " + num(race.steps[slow]) + " pasos = " + dur(race.steps[slow] * Number(cfg.cost)));
    }
    if (!loop || !loop.paused) say(L(race.msg));
  }
  function step(dt) {
    if (race.logT >= race.end) {
      race.hold += dt;
      if (race.hold > HOLD) restart();
      return;
    }
    race.logT = Math.min(race.end, race.logT + dt * RATE);
    paint();
  }

  const pause = pauseControls(stage, say);
  loop = WB.loop({ stage, step: (dt) => step(dt * cfg.speed), onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    WB.pressSeg(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    if (name === "n") cfg.n = Number(raw);
    if (name === "constant") cfg.constant = Number(raw);
    if (name === "cost") { cfg.cost = raw; const keep = race.logT; restart(10 ** keep); race.logT = keep; paint(); return; }
    if (!quiet) restart();
  }
  WB.onSegments((name, value) => set(name, value));
  act("reset").addEventListener("click", () => { restart(); if (loop.paused) loop.setPaused(false); });

  // ---------- experiments (numbers computed at build time by running sim.ts) ----------
  const x2 = (v) => "×" + v.toFixed(2);
  const RUNS = {
    double: () => {
      const a = R.DOUBLE.a, b = R.DOUBLE.b;
      const parts = KEYS.map((k, i) => LANE_LABEL[i] + " " + num(a[k]) + " → " + num(b[k]));
      return { verdict: T("Steps at n = 1,000 → 2,000: " + parts.join(", ") + ".", "Pasos con n = 1,000 → 2,000: " + parts.join(", ") + "."),
        bars: KEYS.map((k, i) => [LANE_LABEL[i], b[k] / a[k] / 4, x2(b[k] / a[k]), i === 4]) };
    },
    small: () => {
      const s = R.SMALL, i16 = s.s16.insertion, m16 = s.s16.merge, i1k = s.s1000.insertion, m1k = s.s1000.merge;
      return { verdict: T("n = 16: insertion sort " + num(i16) + " units, merge sort " + num(m16) + " (" + (m16 / i16).toFixed(1) + "× more). In this model they cross near n = " + s.cross + "; at n = 1,000 merge sort does " + (i1k / m1k).toFixed(0) + "× less work.",
          "n = 16: insertion sort " + num(i16) + " unidades, merge sort " + num(m16) + " (" + (m16 / i16).toFixed(1) + "× más). En este modelo se cruzan cerca de n = " + s.cross + "; con n = 1,000 merge sort hace " + (i1k / m1k).toFixed(0) + "× menos trabajo."),
        bars: [[T("n = 16, insertion sort", "n = 16, insertion sort"), i16 / Math.max(i16, m16), num(i16), true], [T("n = 16, merge sort", "n = 16, merge sort"), m16 / Math.max(i16, m16), num(m16)],
          [T("n = 1,000, insertion sort", "n = 1,000, insertion sort"), i1k / Math.max(i1k, m1k), num(i1k)], [T("n = 1,000, merge sort", "n = 1,000, merge sort"), m1k / Math.max(i1k, m1k), num(m1k), true]] };
    },
    hidden: () => {
      const h = R.HIDDEN, big = h[10000], small = h[1000];
      return { verdict: T("10,000 orders: array " + num(big.arr) + " steps, Set " + num(big.set) + " (" + num(big.arr / big.set) + "× less). With 1,000 orders: " + num(small.arr) + " vs " + num(small.set) + ". Ten times the data made the array version " + Math.round(big.arr / small.arr) + "× slower and the Set version " + Math.round(big.set / small.set) + "×.",
          "10,000 pedidos: array " + num(big.arr) + " pasos, Set " + num(big.set) + " (" + num(big.arr / big.set) + "× menos). Con 1,000 pedidos: " + num(small.arr) + " contra " + num(small.set) + ". Diez veces más datos volvieron la versión con array " + Math.round(big.arr / small.arr) + "× más lenta y la del Set " + Math.round(big.set / small.set) + "×."),
        bars: [[T("10,000 · list.includes()", "10,000 · list.includes()"), 1, num(big.arr)], [T("10,000 · Set", "10,000 · Set"), big.set / big.arr, num(big.set), true], [T("1,000 · list.includes()", "1,000 · list.includes()"), small.arr / big.arr, num(small.arr)], [T("1,000 · Set", "1,000 · Set"), small.set / big.arr, num(small.set), true]] };
    },
    amortise: () => {
      const a = R.AMORT;
      const row = (q) => { const r = a.qs[q]; const m = Math.max(r.scan, r.sortThen); return [[T(num(q) + (q === 1 ? " lookup, scan" : " lookups, scan"), num(q) + (q === 1 ? " búsqueda, recorrer" : " búsquedas, recorrer")), r.scan / m, num(r.scan)], [T(num(q) + (q === 1 ? " lookup, sort first" : " lookups, sort first"), num(q) + (q === 1 ? " búsqueda, ordenar antes" : " búsquedas, ordenar antes")), r.sortThen / m, num(r.sortThen), true]]; };
      const one = a.qs[1], k = a.qs[1000];
      return { verdict: T("Sorting costs " + num(one.sortCost) + " steps up front. 1 lookup: scanning " + num(one.scan) + " vs " + num(one.sortThen) + ". Sorting first wins from " + a.even + " lookups on; at 1,000 lookups it's " + num(k.scan) + " vs " + num(k.sortThen) + ".",
          "Ordenar cuesta " + num(one.sortCost) + " pasos de entrada. 1 búsqueda: recorrer " + num(one.scan) + " contra " + num(one.sortThen) + ". Ordenar primero gana desde " + a.even + " búsquedas; con 1,000 búsquedas son " + num(k.scan) + " contra " + num(k.sortThen) + "."),
        bars: [...row(1), ...row(100), ...row(1000)] };
    },
    best: () => {
      const b = R.BEST, m = b.reversed;
      return { verdict: T("Already sorted: " + num(b.sorted) + " steps. Shuffled: " + num(b.random) + ". Reversed: " + num(b.reversed) + ". Same code, same n, a " + num(b.reversed / b.sorted) + "× spread.",
          "Ya ordenados: " + num(b.sorted) + " pasos. Mezclados: " + num(b.random) + ". Invertidos: " + num(b.reversed) + ". El mismo código, el mismo n, una diferencia de " + num(b.reversed / b.sorted) + "×."),
        bars: [[T("Already sorted", "Ya ordenados"), b.sorted / m, num(b.sorted), true], [T("Shuffled", "Mezclados"), b.random / m, num(b.random)], [T("Reversed", "Invertidos"), 1, num(b.reversed)]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    set("n", String(w.n), true); set("constant", String(w.constant), true);
    restart();
    if (loop.paused) loop.setPaused(false);
  } });

  loop.setPaused(loop.paused);
  restart(FIRST_CLOCK);
}

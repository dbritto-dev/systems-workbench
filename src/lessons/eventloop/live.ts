// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The event loop in the browser: runs the model, shows each queue's tokens, the operator's task and its frames, the
// lamp, the gate and the timer dial, and wires the controls and the experiment cards. mount() gets the build-time
// data from page.ts (geometry, slot counts, experiment results).
import { iso, lineOnTop } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L as tr, T } from "../../runtime/wb";
import { readout, stats, show, act, pauseControls, setD } from "../../runtime/dom";
import { createLoop, advance, resetStats, task, armTimer } from "./sim";
import { millis } from "../../lib/format";

export default function mount({ P, G, SLOTS, RESULTS, EXPERIMENTS }) {
  const MS_PER_SECOND = 40;
  // Task labels come from the model in English; code names stay as they are.
  const LABEL_ES = { "post to worker": "enviar al worker", "worker result": "resultado del worker", "CPU job": "trabajo de CPU", "CPU chunk": "trozo de CPU", "start promise chain": "iniciar cadena de promesas", "I/O callback": "callback de E/S", "frame": "cuadro",
    "setTimeout(0) callback": "callback de setTimeout(0)", "Promise.then callback": "callback de Promise.then", "console.log in the script": "console.log en el script" };
  const lbl = (s) => (WB.lang() === "es" && LABEL_ES[s]) || s;

  const stage = document.querySelector("[data-loop]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const say = readout();
  const stat = stats();
  const slotEls = {};
  svg.querySelectorAll("[data-slot]").forEach((el) => { slotEls[el.dataset.slot] = el; });
  const setKind = (name, kind) => { const el = slotEls[name], v = kind || ""; if (el.dataset.kind !== v) el.dataset.kind = v; };
  const frameEls = [...svg.querySelectorAll("[data-frame]")];
  const needle = q("[data-needle]");
  const dueEls = [...svg.querySelectorAll("[data-due]")];
  const deskBar = q("[data-desk-bar]"), workerBar = q("[data-worker-bar]"), cover = q("[data-worker-cover]");
  const helperBars = [...svg.querySelectorAll("[data-helper-bar]")];
  const bar = (b, share) => share > 0.01 ? WB.faceRectY(P, b.x0, b.x0 + (b.x1 - b.x0) * Math.min(1, share), b.y, b.z0, b.z1) : "";

  const cfg = { job: 50, chunk: false, flood: false, worker: false, delay: 10, speed: 1 };
  let loop = createLoop(cfg, 7);
  let puzzle = null;
  loop.nextFrame = 0;
  // A representative moment for the first frame: the operator 30 ms into a CPU job, two promise callbacks
  // waiting in the tray (so the gate is down), mixed work on the conveyor, timers armed, helpers reading.
  (function seed(L) {
    advance(L, 520);
    L.micro.push(task(L, "promise", "promise.then", 0.5, () => {}), task(L, "promise", "promise.then", 0.5, () => {}));
    L.macro.push(task(L, "io", "I/O callback", 1, () => {}), task(L, "cpu", "CPU job", 20, () => {}), task(L, "timer", "setTimeout", 0.5, () => {}, { due: L.t, set: L.t }));
    armTimer(L, 45, "setTimeout 45"); armTimer(L, 80, "setTimeout 80");
    L.helpers.forEach((h, i) => { if (!h && i < 3) L.helpers[i] = { id: L.nextSeq++, queued: L.t, ms: 30, left: 12 + i * 7, total: 30 }; });
    resetStats(L);
  })(loop);

  const stackDepth = (r) => !r ? 0 : r.kind === "cpu" ? 3 : r.kind === "promise" ? 2 : 1;

  function paint() {
    const L = loop;
    for (let i = 0; i < SLOTS.belt; i++) setKind("c" + i, L.macro[i] && L.macro[i].kind);
    for (let i = 0; i < SLOTS.micro; i++) setKind("m" + i, L.micro[i] ? "promise" : "");
    const timers = [...L.timers].sort((a, b) => a.due - b.due);
    for (let i = 0; i < SLOTS.timers; i++) setKind("t" + i, timers[i] ? "timer" : "");
    L.helpers.forEach((h, i) => { setKind("h" + i, h ? "io" : ""); setD(helperBars[i], h ? bar(G.helperBars[i], 1 - h.left / h.total) : ""); });
    setKind("w", L.worker ? "cpu" : "");
    setD(workerBar, L.worker ? bar(G.workerBar, 1 - L.worker.left / L.worker.total) : "");
    cover.toggleAttribute("data-off", !!L.cfg.worker);
    const r = L.running;
    setKind("run", r && r.kind);
    setD(deskBar, r && r.total > 2 ? bar(G.DESK_STRIP, 1 - r.left / r.total) : "");
    const depth = stackDepth(r);
    frameEls.forEach((el, i) => show(el, i < depth));
    svg.toggleAttribute("data-flash", L.flash > 0);
    svg.toggleAttribute("data-gate", L.micro.length > 0 || !!(L.running && L.running.kind === "promise"));
    const D = G.dial, hand = (turn, r0, r1) => { const a = turn * Math.PI * 2; return [[D.x - Math.sin(a) * r0, D.y + Math.cos(a) * r0], [D.x + Math.sin(a) * r1, D.y - Math.cos(a) * r1]]; };
    const [n0, n1] = hand((L.t % 100) / 100, 2.4, D.r - 3.2);
    setD(needle, lineOnTop(n0, n1, D.z + 0.2, P));
    dueEls.forEach((el, i) => {
      const tm = timers[i];
      if (!tm) { show(el, false); return; }
      const [, p] = hand((tm.due % 100) / 100, 0, D.r - 5.2), [x, y] = iso([p[0], p[1], D.z], P);
      el.setAttribute("cx", x.toFixed(1)); el.setAttribute("cy", y.toFixed(1)); el.style.display = "";
    });
    showStats();
    if (puzzle && puzzle.order.length) {
      say(puzzle.order.map((x, i) => (i + 1) + ". " + lbl(x)).join(" · "));
      if (puzzle.order.length === 3 && L.t > puzzle.until) puzzle = null;
    } else if (!puzzle) {
      if (WB.lang() === "es") {
        const waiting = L.macro.length + " en la cinta · " + L.micro.length + " en la bandeja";
        say(r ? lbl(r.label) + (r.total > 2 ? " · quedan " + Math.ceil(r.left) + " ms" : "") + " · " + waiting : "inactivo · " + waiting);
      } else {
        const waiting = L.macro.length + " on the conveyor · " + L.micro.length + " in the tray";
        say(r ? r.label + (r.total > 2 ? " · " + Math.ceil(r.left) + " ms left" : "") + " · " + waiting : "idle · " + waiting);
      }
    } else say(tr(puzzle.msg));
  }

  function showStats() {
    const s = loop.stats, span = loop.t - s.since;
    stat("busy", span > 20 ? Math.round((100 * s.busy) / span) + "%" : "–");
    stat("late", s.timers ? millis(s.lateMax) : "–");
    stat("gap", span > 40 ? millis(Math.max(s.gapMax, loop.t - loop.lastFrame)) : "–");
    stat("io", s.ioDone ? millis(s.ioWaitSum / s.ioDone) : "–");
    stat("job", s.jobs ? millis(s.lastJob) : "–");
    stat("queue", String(loop.macro.length + loop.micro.length));
  }

  function runPuzzle() {
    const L = loop;
    const order = [];
    puzzle = { order, until: L.t + 60, msg: T("script queued at the front of the conveyor", "script encolado al frente de la cinta") };
    L.macro.unshift(task(L, "io", "script", 3, () => {
      armTimer(L, 0, "setTimeout 0", () => order.push("setTimeout(0) callback"));
      L.micro.unshift(task(L, "promise", "promise.then", 1, () => order.push("Promise.then callback")));
      order.push("console.log in the script");
    }));
    say(tr(puzzle.msg));
  }

  const pause = pauseControls(stage, say);
  const clock = WB.loop({ stage, step: (dt) => { advance(loop, dt * cfg.speed * MS_PER_SECOND); paint(); }, onPause: pause.onPause });
  clock.setPaused(clock.paused);
  function resetCounts() { resetStats(loop); showStats(); }
  function set(name, raw) {
    if (name === "speed") cfg.speed = Number(raw);
    else if (name === "job" || name === "delay") { cfg[name] = Number(raw); loop.cfg[name] = Number(raw); if (name === "job") loop.nextCycle = Math.min(loop.nextCycle, loop.t + 20); resetCounts(); }
    else { cfg[name] = raw === "true" || raw === true; loop.cfg[name] = cfg[name]; if (name === "flood" && cfg.flood) loop.nextCycle = Math.min(loop.nextCycle, loop.t + 20); resetCounts(); }
    WB.pressSeg(name, raw);
  }
  WB.onSegments(set);
  act("reset").addEventListener("click", resetCounts);
  act("puzzle").addEventListener("click", () => { runPuzzle(); if (clock.paused) clock.setPaused(false); });
  pause.bind(clock);

  // ---------- experiments (numbers computed from the same model at build time) ----------
  const RUNS = {
    long: () => {
      const { a, b } = RESULTS.long;
      const top = Math.max(a.lateMax, b.lateMax, a.gapMax, b.gapMax) * 1.05;
      return { verdict: T("With the 200 ms job, the 10 ms timer ran up to " + millis(b.lateMax) + " late (" + millis(a.lateMax) + " without it), and the longest gap between frames grew from " + millis(a.gapMax) + " to " + millis(b.gapMax) + ".",
          "Con el trabajo de 200 ms, el temporizador de 10 ms se ejecutó hasta " + millis(b.lateMax) + " tarde (" + millis(a.lateMax) + " sin él), y el mayor hueco entre cuadros creció de " + millis(a.gapMax) + " a " + millis(b.gapMax) + "."),
        bars: [[T("Timer late, no job", "Retraso de timer, sin trabajo"), a.lateMax / top, millis(a.lateMax)], [T("Timer late, 200 ms job", "Retraso de timer, trabajo de 200 ms"), b.lateMax / top, millis(b.lateMax), true], [T("Frame gap, no job", "Hueco entre cuadros, sin trabajo"), a.gapMax / top, millis(a.gapMax)], [T("Frame gap, 200 ms job", "Hueco entre cuadros, trabajo de 200 ms"), b.gapMax / top, millis(b.gapMax), true]] };
    },
    order: () => {
      const o = RESULTS.order, es = o.map((x) => LABEL_ES[x] || x);
      return { verdict: T("The order was: " + o.join(", then ") + ".", "El orden fue: " + es.join(", luego ") + "."),
        bars: o.map((x, i) => [(i + 1) + ". " + x.split(" ")[0], 1 - i / 3, T(["1st", "2nd", "3rd"][i], ["1.º", "2.º", "3.º"][i]), i === 0]) };
    },
    flood: () => {
      const { a, b } = RESULTS.flood;
      const top = Math.max(a.ioWaitMax, b.ioWaitMax, a.gapMax, b.gapMax) * 1.05;
      return { verdict: T("While the chain ran, I/O callbacks waited up to " + millis(b.ioWaitMax) + " (" + millis(a.ioWaitMax) + " without it), and the longest gap between frames was " + millis(b.gapMax) + ".",
          "Mientras corría la cadena, los callbacks de E/S esperaron hasta " + millis(b.ioWaitMax) + " (" + millis(a.ioWaitMax) + " sin ella), y el mayor hueco entre cuadros fue de " + millis(b.gapMax) + "."),
        bars: [[T("I/O wait, no chain", "Espera de E/S, sin cadena"), a.ioWaitMax / top, millis(a.ioWaitMax)], [T("I/O wait, promise chain", "Espera de E/S, cadena de promesas"), b.ioWaitMax / top, millis(b.ioWaitMax), true], [T("Frame gap, no chain", "Hueco entre cuadros, sin cadena"), a.gapMax / top, millis(a.gapMax)], [T("Frame gap, promise chain", "Hueco entre cuadros, cadena de promesas"), b.gapMax / top, millis(b.gapMax), true]] };
    },
    chunk: () => {
      const { a, b } = RESULTS.chunk;
      const gt = Math.max(a.gapMax, b.gapMax) * 1.05, jt = Math.max(a.jobAvg, b.jobAvg) * 1.05;
      return { verdict: T("In 5 ms chunks, the longest frame gap fell from " + millis(a.gapMax) + " to " + millis(b.gapMax) + ", and the job took " + millis(b.jobAvg) + " instead of " + millis(a.jobAvg) + ".",
          "En trozos de 5 ms, el mayor hueco entre cuadros bajó de " + millis(a.gapMax) + " a " + millis(b.gapMax) + ", y el trabajo tardó " + millis(b.jobAvg) + " en vez de " + millis(a.jobAvg) + "."),
        bars: [[T("Frame gap, one block", "Hueco entre cuadros, un bloque"), a.gapMax / gt, millis(a.gapMax)], [T("Frame gap, chunked", "Hueco entre cuadros, en trozos"), b.gapMax / gt, millis(b.gapMax), true], [T("Job time, one block", "Tiempo del trabajo, un bloque"), a.jobAvg / jt, millis(a.jobAvg)], [T("Job time, chunked", "Tiempo del trabajo, en trozos"), b.jobAvg / jt, millis(b.jobAvg), true]] };
    },
    worker: () => {
      const { a, b } = RESULTS.worker;
      const gt = Math.max(a.gapMax, b.gapMax) * 1.05, jt = Math.max(a.jobAvg, b.jobAvg) * 1.05;
      return { verdict: T("With a worker, the longest frame gap was " + millis(b.gapMax) + " (" + millis(a.gapMax) + " on the main thread), and the job took " + millis(b.jobAvg) + " instead of " + millis(a.jobAvg) + ".",
          "Con un worker, el mayor hueco entre cuadros fue de " + millis(b.gapMax) + " (" + millis(a.gapMax) + " en el hilo principal), y el trabajo tardó " + millis(b.jobAvg) + " en vez de " + millis(a.jobAvg) + "."),
        bars: [[T("Frame gap, main thread", "Hueco entre cuadros, hilo principal"), a.gapMax / gt, millis(a.gapMax)], [T("Frame gap, worker", "Hueco entre cuadros, worker"), b.gapMax / gt, millis(b.gapMax), true], [T("Job time, main thread", "Tiempo del trabajo, hilo principal"), a.jobAvg / jt, millis(a.jobAvg)], [T("Job time, worker", "Tiempo del trabajo, worker"), b.jobAvg / jt, millis(b.jobAvg), true]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    if (w.puzzle) { set("job", 0); set("flood", "false"); set("worker", "false"); set("chunk", "false"); setTimeout(runPuzzle, 800); }
    else for (const k of ["job", "chunk", "worker", "flood", "delay"]) set(k, String(w[k]));
    if (cfg.speed > 1) set("speed", 1);
    if (clock.paused) clock.setPaused(false);
  } });

  paint();
}

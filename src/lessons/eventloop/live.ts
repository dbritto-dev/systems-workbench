// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The event loop in the browser: runs the model, shows each queue's tokens, the operator's task and its frames, the
// lamp, the gate and the timer dial, and answers the controls. mount() gets the build-time data from page.ts
// (geometry, slot counts) and root, the <wb-lesson>.
import { iso, lineOnTop } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L as tr, T } from "../../runtime/wb";
import { show, setD, playPause } from "../../runtime/dom";
import { createLoop, advance, resetStats, task, armTimer, LABEL_ES } from "./sim";
import { millis } from "../../lib/format";

export default function mount({ P, G, SLOTS }, root) {
  const MS_PER_SECOND = 40;
  const lbl = (s) => (WB.lang() === "es" && LABEL_ES[s]) || s;
  // The order puzzle's readout uses the code names alone, so the three steps fit on a phone.
  const SHORT = { "console.log in the script": "console.log", "Promise.then callback": "Promise.then", "setTimeout(0) callback": "setTimeout(0)" };

  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const stat = (key, value) => root.stat(key, value);
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
      say(puzzle.order.map((x, i) => (i + 1) + ". " + (SHORT[x] || lbl(x))).join(" · "));
      if (puzzle.order.length === 3 && L.t > puzzle.until) puzzle = null;
    } else if (!puzzle) {
      if (WB.lang() === "es") {
        const waiting = L.macro.length + " en la cinta · " + L.micro.length + " en la bandeja";
        say(r ? lbl(r.label) + (r.total > 2 ? " · quedan " + Math.ceil(r.left) + " ms" : "") + " · " + waiting : (L.macro.length || L.micro.length ? "toma la siguiente tarea · " : "inactivo · ") + waiting);
      } else {
        const waiting = L.macro.length + " on the conveyor · " + L.micro.length + " in the tray";
        say(r ? r.label + (r.total > 2 ? " · " + Math.ceil(r.left) + " ms left" : "") + " · " + waiting : (L.macro.length || L.micro.length ? "taking the next task · " : "idle · ") + waiting);
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

  const pause = playPause(root);
  const clock = WB.loop({ stage, step: (dt) => { advance(loop, dt * cfg.speed * MS_PER_SECOND); paint(); }, onPause: pause.onPause });
  clock.setPaused(clock.paused);
  function resetCounts() { resetStats(loop); showStats(); }
  function set(name, raw) {
    if (name === "speed") cfg.speed = Number(raw);
    else if (name === "job" || name === "delay") { cfg[name] = Number(raw); loop.cfg[name] = Number(raw); if (name === "job") loop.nextCycle = Math.min(loop.nextCycle, loop.t + 20); resetCounts(); }
    else { cfg[name] = raw === "true" || raw === true; loop.cfg[name] = cfg[name]; if (name === "flood" && cfg.flood) loop.nextCycle = Math.min(loop.nextCycle, loop.t + 20); resetCounts(); }
    root.press(name, raw);
  }
  root.on("change", (name, value) => set(name, value));
  const actions = { reset: resetCounts, puzzle: () => { runPuzzle(); if (clock.paused) clock.setPaused(false); } };
  root.on("action", (name) => actions[name]?.());
  pause.bind(clock);

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    if (w.puzzle) { set("job", 0); set("flood", "false"); set("worker", "false"); set("chunk", "false"); setTimeout(runPuzzle, 800); }
    else for (const k of ["job", "chunk", "worker", "flood", "delay"]) set(k, String(w[k]));
    if (cfg.speed > 1) set("speed", 1);
    if (clock.paused) clock.setPaused(false);
  });

  paint();
}

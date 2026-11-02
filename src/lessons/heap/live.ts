// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The triage room in the browser: runs the clinic, replays each heap operation on the figure one move at a time,
// wires the controls and the experiment cards. mount() gets the build-time data from page.ts (geometry, results).
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats, show, act, pauseControls } from "../../runtime/dom";
import { smoothstep } from "../../lib/tween";
import { pct } from "../../lib/format";
import { makeClinic } from "./sim";

export default function mount({ P, NODES, CELLS, IN_PAD, OUT_PAD, COUNTERS, SLOTS, FIRST, RAIL_Y, R, EXPERIMENTS }) {
  const stage = document.querySelector("[data-heap]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const say = readout();
  const ease = smoothstep;
  const setText = (el, s) => { s = String(s); if (el.textContent !== s) el.textContent = s; };
  const setLit = (g, on) => g.querySelectorAll(".iso-solid").forEach((s) => s.toggleAttribute("data-lit", on));
  const place = (el, p) => el.setAttribute("transform", translateAlong(P, p));

  const dials = Object.fromEntries(Object.keys(COUNTERS).map((n) => [n, WB.counter(svg, n, P)]));
  const wheel = (name, v) => dials[name].set(Math.max(0, Math.min(Math.floor(v), 10 ** COUNTERS[name].count - 1)));
  const stat = stats();

  const nodes = Array.from({ length: SLOTS }, (_, i) => ({ g: q('[data-node="' + i + '"]'), label: q('[data-node-label="' + i + '"]') }));
  const cells = Array.from({ length: SLOTS }, (_, i) => ({ g: q('[data-cell="' + i + '"]'), label: q('[data-cell-label="' + i + '"]') }));
  const fly = { a: { g: q('[data-fly="a"]'), label: q('[data-fly-label="a"]') }, b: { g: q('[data-fly="b"]'), label: q('[data-fly-label="b"]') } };
  const served = { g: q("[data-served]"), label: q("[data-served-label]") };
  const more = { g: q("[data-more]"), label: q("[data-more-label]") };
  const at = (i) => (i < SLOTS ? [NODES[i].x, NODES[i].y, NODES[i].z] : [CELLS[SLOTS - 1].x + 9, RAIL_Y + 3, 0]);
  const IN = [IN_PAD.x, IN_PAD.y, IN_PAD.z], OUT = [OUT_PAD.x, OUT_PAD.y, OUT_PAD.z];

  const cfg = { policy: "priority", ties: "any", load: 0.9, speed: 1 };
  const TS = 0.6;          // model seconds per figure second, while nothing is moving
  const STEP = 0.42;       // seconds per move on the figure
  let c, disp, steps, cur, msg, seed = 21, lastSwaps = FIRST.swaps, moving = new Set();

  // What the figure shows: disp[i] is the priority drawn at heap index i, replayed one move at a time behind the model.
  function paint() {
    for (let i = 0; i < SLOTS; i++) {
      const v = disp[i];
      show(nodes[i].g, v != null && !moving.has(i)); show(cells[i].g, v != null);
      if (v != null) { setText(nodes[i].label, v); setText(cells[i].label, v); }
    }
    const extra = Math.max(0, disp.length - SLOTS);
    show(more.g, extra > 0); setText(more.label, "+" + extra);
  }
  function restart() {
    c = makeClinic({ policy: cfg.policy, load: cfg.load, stable: cfg.ties === "seq" }, seed++);
    c.runTo(20);
    while (c.heap.size() < 9 && c.now < 400) c.runTo(c.now + 1);   // start with a busy room
    disp = c.heap.a.map((j) => j.p);
    steps = []; cur = null; moving = new Set(); cells.forEach((x) => setLit(x.g, false)); msg = T("the desk always takes the top job", "el mostrador siempre toma el trabajo de arriba");
    show(fly.a.g, false); show(fly.b.g, false); show(served.g, false);
    paint(); numbers(0);
  }
  // Turn the model's heap operations into moves for the figure.
  function enqueue(events) {
    for (const e of events) {
      const n = e.swaps.length, s = n === 1 ? "" : "s";
      if (e.op === "push") {
        steps.push({ kind: "arrive", v: e.item.p, swaps: n,
          msg: cfg.policy === "fifo"
            ? T("arrives: priority " + e.item.p + " · keyed by arrival, it stays at the end", "llega: prioridad " + e.item.p + " · la clave es la llegada, queda al final")
            : T("arrives: priority " + e.item.p + " · " + n + " swap" + s + " up", "llega: prioridad " + e.item.p + " · " + n + " intercambio" + s + " hacia arriba") });
      } else {
        const w = Math.max(0, c.now - e.item.t);
        steps.push({ kind: "serve", v: e.item.p, swaps: n,
          msg: T("served: priority " + e.item.p + ", waited " + w.toFixed(1) + " s · " + n + " swap" + s + " down", "atendido: prioridad " + e.item.p + ", esperó " + w.toFixed(1) + " s · " + n + " intercambio" + s + " hacia abajo") });
        if (e.moved) steps.push({ kind: "lift" });
      }
      for (const [i, j] of e.swaps) steps.push({ kind: "swap", i, j });
    }
  }
  // Start a move: set up flyers and hide the tokens they stand for.
  function begin(s) {
    s.t = 0;
    if (s.kind === "arrive") {
      s.to = disp.length; disp.push(null); s.from = IN; s.dest = at(s.to);
      setText(fly.a.label, s.v); show(fly.a.g, true); msg = s.msg; lastSwaps = s.swaps;
    } else if (s.kind === "serve") {
      s.from = at(0); s.dest = OUT; setText(fly.a.label, disp[0]); show(fly.a.g, true);
      disp[0] = null; show(served.g, false); msg = s.msg; lastSwaps = s.swaps;
    } else if (s.kind === "lift") {
      s.fromIdx = disp.length - 1; s.from = at(s.fromIdx); s.dest = at(0); s.v = disp[s.fromIdx];
      disp.pop(); setText(fly.a.label, s.v); show(fly.a.g, true);
    } else if (s.kind === "swap") {
      s.va = disp[s.i]; s.vb = disp[s.j];
      const vis = s.i < SLOTS || s.j < SLOTS;
      s.d = vis ? STEP : 0;
      if (vis) {
        setText(fly.a.label, s.va); setText(fly.b.label, s.vb); show(fly.a.g, true); show(fly.b.g, true);
        moving = new Set([s.i, s.j]);   // the tokens fly; their array cells stay put, lit, until the swap lands
        [s.i, s.j].forEach((x) => x < SLOTS && setLit(cells[x].g, true));
      }
    }
    if (s.d == null) s.d = STEP;
    paint();
  }
  function arc(from, to, p, lift = 7) {
    const e = ease(p);
    return [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, from[2] + (to[2] - from[2]) * e + lift * Math.sin(Math.PI * e)];
  }
  function finish(s) {
    if (s.kind === "arrive") disp[s.to] = s.v;
    if (s.kind === "serve") { setText(served.label, fly.a.label.textContent); show(served.g, true); }
    if (s.kind === "lift") disp[0] = s.v;
    if (s.kind === "swap") { disp[s.i] = s.vb; disp[s.j] = s.va; moving = new Set(); cells.forEach((x) => setLit(x.g, false)); }
    show(fly.a.g, false); show(fly.b.g, false);
    paint();
  }
  function animate(dt) {
    cur.t += dt;
    const p = Math.min(1, cur.d ? cur.t / cur.d : 1);
    if (cur.kind === "swap") {
      if (cur.d) { place(fly.a.g, arc(at(cur.i), at(cur.j), p, 4)); place(fly.b.g, arc(at(cur.j), at(cur.i), p, -2)); }
    } else place(fly.a.g, arc(cur.from, cur.dest, p, cur.kind === "lift" ? 10 : 8));
    if (p >= 1) { finish(cur); cur = null; }
  }
  function numbers() {
    wheel("waiting", c.heap.size()); wheel("swaps", lastSwaps); wheel("oldest", c.oldest(2));
    stat("swaps", lastSwaps);
    stat("avgSwaps", c.ops ? (c.swapSum / c.ops).toFixed(2) : "–");
    stat("waiting", c.heap.size());
    stat("urgent", c.served[0] ? c.avgWait(0).toFixed(1) + " s" : "–");
    stat("routine", c.served[2] ? c.avgWait(2).toFixed(1) + " s" : "–");
    stat("oldest", c.oldest(2).toFixed(0) + " s");
  }

  const pause = pauseControls(stage, say);
  const loop = WB.loop({
    stage,
    step: (dt) => {
      let d = dt * cfg.speed;
      // Replay queued moves first; the model's clock waits for the figure to catch up.
      for (let guard = 0; d > 1e-6 && guard < 60; guard++) {
        if (cur || steps.length) {
          if (!cur) { cur = steps.shift(); begin(cur); }
          const use = Math.min(d, Math.max(0, cur.d - cur.t));
          animate(use); d -= use;
          if (cur) break;
        } else {
          const ev = c.step(c.now + d * TS);
          if (!ev.length) break;
          enqueue(ev);
        }
      }
      if (c.heap.size() > 60) restart();
      say(L(msg)); numbers();
    },
    onPause: pause.onPause,
  });
  pause.bind(loop);

  function set(name, raw, quiet) {
    WB.pressSeg(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    if (name === "load") cfg.load = Number(raw); else cfg[name] = raw;
    if (!quiet) restart();
  }
  WB.onSegments((name, value) => set(name, value));
  act("urgent").addEventListener("click", () => { enqueue(c.add(0, 1)); if (loop.paused) loop.setPaused(false); });
  act("routine").addEventListener("click", () => { enqueue(c.add(2, 9)); if (loop.paused) loop.setPaused(false); });
  act("reset").addEventListener("click", restart);

  // ---------- experiments ----------
  const s1 = (x) => x.toFixed(1) + " s";
  const n0 = (x) => Math.round(x).toLocaleString("en");   // thousands separators, unlike the shared n0
  const RUNS = {
    order: () => {
      const f = R.order.fifo, p = R.order.prio, top = Math.max(f.routine, p.routine);
      return { verdict: T("Arrival order: urgent " + s1(f.urgent) + ", routine " + s1(f.routine) + ", all jobs " + s1(f.all) + ". Priority: urgent " + s1(p.urgent) + ", routine " + s1(p.routine) + ", all jobs " + s1(p.all) + ".",
          "Por llegada: urgentes " + s1(f.urgent) + ", de rutina " + s1(f.routine) + ", todos " + s1(f.all) + ". Por prioridad: urgentes " + s1(p.urgent) + ", de rutina " + s1(p.routine) + ", todos " + s1(p.all) + "."),
        bars: [[T("Urgent, arrival order", "Urgentes, por llegada"), f.urgent / top, s1(f.urgent)], [T("Urgent, priority", "Urgentes, por prioridad"), p.urgent / top, s1(p.urgent), true],
          [T("Routine, arrival order", "De rutina, por llegada"), f.routine / top, s1(f.routine)], [T("Routine, priority", "De rutina, por prioridad"), p.routine / top, s1(p.routine), true],
          [T("All jobs, arrival order", "Todos, por llegada"), f.all / top, s1(f.all)], [T("All jobs, priority", "Todos, por prioridad"), p.all / top, s1(p.all), true]] };
    },
    starve: () => {
      const p = R.starve.prio, a = R.starve.aging;
      return { verdict: T("Strict priority: the oldest routine job waited " + n0(p.oldestRoutine) + " s of the 600, and only " + pct(p.routineServed) + " of routine jobs were served. Aging: oldest " + n0(a.oldestRoutine) + " s, " + pct(a.routineServed) + " served; urgent jobs' average wait went from " + s1(p.urgent) + " to " + s1(a.urgent) + ".",
          "Prioridad estricta: el trabajo de rutina más antiguo esperó " + n0(p.oldestRoutine) + " s de los 600, y solo se atendió el " + pct(p.routineServed) + " de los de rutina. Aging: el más antiguo, " + n0(a.oldestRoutine) + " s, y se atendió el " + pct(a.routineServed) + "; la espera promedio de los urgentes pasó de " + s1(p.urgent) + " a " + s1(a.urgent) + "."),
        bars: [[T("Oldest routine wait, strict", "Rutina más antigua, estricta"), p.oldestRoutine / 600, n0(p.oldestRoutine) + " s"], [T("Oldest routine wait, aging", "Rutina más antigua, aging"), a.oldestRoutine / 600, n0(a.oldestRoutine) + " s", true],
          [T("Urgent average wait, strict", "Urgentes en promedio, estricta"), p.urgent / 600, s1(p.urgent)], [T("Urgent average wait, aging", "Urgentes en promedio, aging"), a.urgent / 600, s1(a.urgent), true]] };
    },
    grow: () => {
      const a = R.grow.small, b = R.grow.big;
      return { verdict: T("Serving the top: " + a.pop.toFixed(1) + " swaps at 1,000 jobs (" + a.levels + " levels), " + b.pop.toFixed(1) + " at 1,000,000 (" + b.levels + " levels). A new job climbed " + a.push.toFixed(1) + " and " + b.push.toFixed(1) + " levels on average. A sorted list shifts " + n0(a.shifts) + " and " + n0(b.shifts) + " items per insert.",
          "Atender el de arriba: " + a.pop.toFixed(1) + " intercambios con 1,000 trabajos (" + a.levels + " niveles), " + b.pop.toFixed(1) + " con 1,000,000 (" + b.levels + " niveles). Un trabajo nuevo subió " + a.push.toFixed(1) + " y " + b.push.toFixed(1) + " niveles en promedio. Una lista ordenada desplaza " + n0(a.shifts) + " y " + n0(b.shifts) + " elementos por inserción."),
        bars: [[T("Heap, serve, 1,000", "Heap, atender, 1,000"), a.pop / b.levels, a.pop.toFixed(1)], [T("Heap, serve, 1,000,000", "Heap, atender, 1,000,000"), b.pop / b.levels, b.pop.toFixed(1), true],
          [T("Sorted list, insert, 1,000", "Lista ordenada, insertar, 1,000"), a.shifts / b.shifts, n0(a.shifts)], [T("Sorted list, insert, 1,000,000", "Lista ordenada, insertar, 1,000,000"), 1, n0(b.shifts), true]] };
    },
    topk: () => {
      const r = R.topk;
      return { verdict: T("A min-heap of " + r.k + " kept the ten best of " + n0(r.n) + " scores: the root was replaced " + r.replaced + " times, about " + n0(r.comparisons) + " comparisons in all, same top ten as sorting everything (about " + n0(r.sortComparisons) + " comparisons, and all " + n0(r.n) + " scores in memory).",
          "Un min-heap de " + r.k + " guardó los diez mejores de " + n0(r.n) + " puntajes: la raíz se reemplazó " + r.replaced + " veces, unas " + n0(r.comparisons) + " comparaciones en total, los mismos diez que ordenando todo (unas " + n0(r.sortComparisons) + " comparaciones, y los " + n0(r.n) + " puntajes en memoria)."),
        bars: [[T("Comparisons, min-heap of 10", "Comparaciones, min-heap de 10"), r.comparisons / r.sortComparisons, n0(r.comparisons), true], [T("Comparisons, sort all", "Comparaciones, ordenar todo"), 1, n0(r.sortComparisons)],
          [T("Items kept, min-heap", "Elementos guardados, min-heap"), r.k / r.n, String(r.k), true], [T("Items kept, sort all", "Elementos guardados, ordenar todo"), 1, n0(r.n)]] };
    },
    ties: () => {
      const a = R.ties.plain.join(", "), b = R.ties.seq.join(", ");
      return { verdict: T("Priority only: " + a + ". Priority, then arrival number: " + b + ".", "Solo prioridad: " + a + ". Prioridad y después número de llegada: " + b + "."),
        bars: [[T("Priority only", "Solo prioridad"), 1, a], [T("Priority + arrival number", "Prioridad + número de llegada"), 1, b, true]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    set("policy", w.policy, true); set("ties", w.ties, true); set("load", String(w.load), true);
    restart();
    if (loop.paused) loop.setPaused(false);
  } });

  loop.setPaused(loop.paused);
  restart();
}

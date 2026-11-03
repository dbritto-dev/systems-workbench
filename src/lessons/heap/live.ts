// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The triage room in the browser: runs the clinic, replays each heap operation on the figure one move at a time,
// and answers the controls. mount() gets the build-time data from page.ts (geometry) and root, the <wb-lesson>.
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, playPause, setText, setLit } from "../../runtime/dom";
import { smoothstep } from "../../lib/tween";
import { secs1 } from "../../lib/format";
import { makeClinic } from "./sim";

export default function mount({ P, NODES, CELLS, IN_PAD, OUT_PAD, COUNTERS, SLOTS, FIRST, RAIL_Y }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const ease = smoothstep;

  const dials = Object.fromEntries(Object.keys(COUNTERS).map((n) => [n, WB.counter(svg, n, P)]));
  const stat = (key, value) => root.stat(key, value);

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
      if (cur.d) { WB.place(fly.a.g, P, arc(at(cur.i), at(cur.j), p, 4)); WB.place(fly.b.g, P, arc(at(cur.j), at(cur.i), p, -2)); }
    } else WB.place(fly.a.g, P, arc(cur.from, cur.dest, p, cur.kind === "lift" ? 10 : 8));
    if (p >= 1) { finish(cur); cur = null; }
  }
  function numbers() {
    dials.waiting.setClamped(c.heap.size()); dials.swaps.setClamped(lastSwaps); dials.oldest.setClamped(c.oldest(2));
    stat("swaps", lastSwaps);
    stat("avgSwaps", c.ops ? (c.swapSum / c.ops).toFixed(2) : "–");
    stat("waiting", c.heap.size());
    stat("urgent", c.served[0] ? secs1(c.avgWait(0)) : "–");
    stat("routine", c.served[2] ? secs1(c.avgWait(2)) : "–");
    stat("oldest", c.oldest(2).toFixed(0) + " s");
  }

  const pause = playPause(root);
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
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    if (name === "load") cfg.load = Number(raw); else cfg[name] = raw;
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));
  const actions = {
    urgent: () => { enqueue(c.add(0, 1)); if (loop.paused) loop.setPaused(false); },
    routine: () => { enqueue(c.add(2, 9)); if (loop.paused) loop.setPaused(false); },
    reset: () => restart(),
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    set("policy", w.policy, true); set("ties", w.ties, true); set("load", String(w.load), true);
    restart();
    if (loop.paused) loop.setPaused(false);
  });

  loop.setPaused(loop.paused);
  restart();
}

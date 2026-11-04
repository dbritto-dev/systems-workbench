// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The branch tally in the browser: runs the model, moves couriers along the tracks, turns the counter wheels,
// presses the plungers and the stamp, drops the barrier, and answers the controls. mount() gets the build-time data
// from page.ts (geometry, the courier drawing) and root, the <wb-lesson>.
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L } from "../../runtime/wb";
import { show as display, playPause } from "../../runtime/dom";
import { makeSim } from "./sim";

export default function mount({ P, G, PUCK_SVG }, root) {
  const POOL = 48;

  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const stat = (key, value) => root.stat(key, value);
  const NS = "http://www.w3.org/2000/svg";
  const layer = q("[data-couriers]");
  const branches = [0, 1, 2].map((i) => q('[data-branch="' + i + '"]'));
  const routes = [0, 1, 2].map((i) => q('[data-route="' + i + '"]'));
  const barriers = [0, 1, 2].map((i) => ({ g: q('[data-barrier="' + i + '"]'), up: q('[data-barrier="' + i + '"] [data-arm="up"]'), down: q('[data-barrier="' + i + '"] [data-arm="down"]') }));
  const plungers = [0, 1, 2].map((i) => ({ g: q('[data-plunger="' + i + '"]'), solid: q('[data-plunger="' + i + '"] .iso-solid') }));
  const stamp = q("[data-stamp]");
  const slips = Array.from({ length: G.SLIPS }, (_, s) => ({ g: q('[data-slip="' + s + '"]'), solid: q('[data-slip="' + s + '"] .iso-solid') }));
  const unitEls = { main: q('[data-unit="main"]'), cas: q('[data-unit="cas"]'), slot: [0, 1, 2].map((i) => q('[data-unit="slot' + i + '"]')) };

  // Counters: the shared digit-wheel counters; WB.counter redraws a wheel only when its digit changes.
  const counter = (name) => WB.counter(svg, name, P);
  const dials = { main: counter("main"), slot: [0, 1, 2].map((i) => counter("slot" + i)), view: [0, 1, 2].map((i) => counter("view" + i)), tally: [0, 1, 2].map((i) => counter("tally" + i)) };
  const show = (dial, v) => dial.set(v);

  const pool = Array.from({ length: POOL }, () => { const g = document.createElementNS(NS, "g"); g.innerHTML = PUCK_SVG; g.style.display = "none"; layer.appendChild(g); return { g, solid: g.firstElementChild }; });

  const cfg = { approach: "shared", nodes: 3, rate: 0.3, speed: 1 };
  let model, clock, tripAt, logAt, stampAt, active, lastAdd, lastStamp, cut, tallies;
  const WARM = 12;   // each run starts a few seconds in, so the first frame already shows counts and couriers
  let seed = (Date.now() % 1e6) + 1;

  function restart() {
    model = makeSim({ approach: cfg.approach, nodes: cfg.nodes, rate: cfg.rate, partitions: [] }, seed++);
    clock = cfg.rate > 0 ? WARM : 0; tripAt = 0; logAt = 0; stampAt = 0; active = []; lastAdd = [-9, -9, -9]; lastStamp = { t: -9, ok: true }; cut = false; tallies = [0, 0, 0];
    model.runTo(clock);
    root.press("partition", "off");
    branches.forEach((el, i) => el.toggleAttribute("data-off", i >= cfg.nodes));
    routes.forEach((el, i) => el.toggleAttribute("data-off", i >= cfg.nodes));
    barriers.forEach((b, i) => display(b.g, i === cfg.nodes - 1));
    display(unitEls.main, cfg.approach !== "g");
    display(unitEls.cas, cfg.approach === "cas");
    unitEls.slot.forEach((el, i) => display(el, cfg.approach === "g" && i < cfg.nodes));
    paint(0);
  }

  function setCut(on) {
    if (on === cut) return;
    cut = on;
    if (on) model.cut(clock); else model.healAt(clock);
    root.press("partition", on ? "on" : "off");
  }

  function lastValue(key) { const h = model.history[key]; return h[h.length - 1][1]; }

  function paint(dt) {
    // Couriers on the tracks.
    while (tripAt < model.trips.length) active.push(model.trips[tripAt++]);
    active = active.filter((tr) => tr.arrive > clock);
    let used = 0;
    const place = (x, y, lit) => {
      if (used >= POOL) return;
      const p = pool[used++];
      p.g.style.display = "";
      p.g.setAttribute("transform", translateAlong(P, [x, y, 0]));
      p.solid.toggleAttribute("data-lit", lit);
    };
    const far = cfg.nodes - 1, span = G.BRANCH_Y - G.REG_Y;
    for (const tr of active) {
      const x = G.XS[tr.node] + (tr.dir === "up" ? -G.LANE : G.LANE);
      if (clock < tr.start) { if (tr.sent <= clock) place(x, tr.dir === "up" ? G.BARRIER_Y + 5 : G.BARRIER_Y - 5, tr.dir === "up"); continue; }
      if (tr.sent > clock) continue;
      const p = Math.max(0, Math.min(1, (clock - tr.start) / (tr.arrive - tr.start)));
      place(x, tr.dir === "up" ? G.BRANCH_Y - p * span : G.REG_Y + p * span, tr.dir === "up");
    }
    let upHeld = 0, downHeld = 0;
    for (const h of model.held) {
      if (h.dir === "up") place(G.XS[far] - G.LANE, G.BARRIER_Y + 5 + 5.2 * Math.min(3, upHeld++), true);
      else place(G.XS[far] + G.LANE, G.BARRIER_Y - 5 - 5.2 * Math.min(3, downHeld++), false);
    }
    for (let i = used; i < POOL; i++) pool[i].g.style.display = "none";

    // Plungers, the stamp and its spindle, the barrier.
    for (; logAt < model.log.length; logAt++) { const e = model.log[logAt]; if (e.type === "add") { lastAdd[e.node] = e.t; tallies[e.node]++; } }
    for (; stampAt < model.stamps.length; stampAt++) lastStamp = model.stamps[stampAt];
    plungers.forEach((p, i) => { const on = clock - lastAdd[i] < 0.35; p.solid.toggleAttribute("data-lit", on); p.g.setAttribute("transform", on ? translateAlong(P, [0, 0, -1.2]) : ""); });
    const press = clock - lastStamp.t < 0.3 ? Math.sin(Math.PI * (clock - lastStamp.t) / 0.3) : 0;
    stamp.setAttribute("transform", press ? translateAlong(P, [0, 0, -3.5 * press]) : "");
    const shownSlips = Math.min(G.SLIPS, model.retries), freshReject = !lastStamp.ok && clock - lastStamp.t < 0.6;
    slips.forEach((s, k) => { display(s.g, k < shownSlips); s.solid.toggleAttribute("data-lit", freshReject && k === shownSlips - 1); });
    const b = barriers[far];
    display(b.up, !cut); display(b.down, cut);

    // The counter wheels.
    if (cfg.approach !== "g") show(dials.main, lastValue("counter"));
    else for (let i = 0; i < cfg.nodes; i++) show(dials.slot[i], lastValue("slot" + i));
    for (let i = 0; i < cfg.nodes; i++) { show(dials.view[i], model.nodes[i].view); show(dials.tally[i], tallies[i]); }

    // Readout and stats.
    const views = model.nodes.map((n) => n.view);
    const behind = model.added - Math.min(...views);
    const name = ["A", "B", "C"][far], held = model.held.length;
    say(cut ? L(name + " cut off · " + held + " waiting at the barrier", name + " aislada · " + held + " esperando en la barrera")
      : (cfg.approach === "shared" ? L("read, add, write", "leer, sumar, escribir") : cfg.approach === "cas" ? "compare-and-swap" : L("one slot each", "una casilla cada una")) + " · " + L(model.added + " adds made · register " + model.stored(), model.added + " sumas hechas · registro " + model.stored()));
    stat("total", model.added);
    stat("stored", model.stored());
    stat("lost", cfg.approach === "shared" ? model.lost() : 0);
    stat("retries", model.retries);
    stat("reads", views.join(" · "));
    stat("agree", behind === 0 ? L("yes", "sí") : L("behind " + behind, "faltan " + behind));
  }

  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(dt * cfg.speed); }, onPause: pause.onPause });

  function set(name, raw, quiet) {
    if (name === "speed") { cfg.speed = Number(raw); root.press(name, raw); return; }
    if (name === "partition") { setCut(raw === "on"); return; }
    if (name === "approach") cfg.approach = raw;
    if (name === "nodes") cfg.nodes = Number(raw);
    if (name === "rate") cfg.rate = Number(raw);
    root.press(name, raw);
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));
  const actions = { addA: () => { model.add(clock, 0); if (loop.paused) loop.setPaused(false); }, reset: () => restart() };
  root.on("action", (name) => actions[name]?.());
  pause.bind(loop);

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w, id) => {
    set("approach", w.approach, true); set("nodes", String(w.nodes), true); set("rate", String(w.rate), true);
    restart();
    if (loop.paused) loop.setPaused(false);
    if (w.partition) { setTimeout(() => setCut(true), 3000); setTimeout(() => setCut(false), 18000); }
    if (id === "seq") say(L("watch A's display lag B's for a moment after each add", "mira cómo la pantalla de A se atrasa respecto de la de B un momento después de cada suma"));
  });

  loop.setPaused(loop.paused);
  restart();
}

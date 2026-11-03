// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The branch tally in the browser: runs the model, moves couriers along the tracks, turns the counter wheels,
// presses the plungers and the stamp, drops the barrier, and wires the controls and the experiment cards.
// mount() gets the build-time data from page.ts (geometry, the courier drawing, experiment results).
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats, show as display, act, pauseControls } from "../../runtime/dom";
import { pct, one } from "../../lib/format";
import { makeSim } from "./sim";

export default function mount({ P, G, PUCK_SVG, RESULTS, EXPERIMENTS }) {
  const POOL = 48;

  const stage = document.querySelector("[data-office]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const say = readout();
  const stat = stats();
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
    WB.pressSeg("partition", "off");
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
    WB.pressSeg("partition", on ? "on" : "off");
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
      : (cfg.approach === "shared" ? L("read, add, write", "leer, sumar, escribir") : cfg.approach === "cas" ? "compare-and-swap" : L("one slot each", "una casilla cada una")) + " · " + L("total", "total") + " " + model.added);
    stat("total", model.added);
    stat("stored", model.stored());
    stat("lost", cfg.approach === "shared" ? model.lost() : 0);
    stat("retries", model.retries);
    stat("reads", views.join(" · "));
    stat("agree", behind === 0 ? L("yes", "sí") : L("behind " + behind, "faltan " + behind));
  }

  const pause = pauseControls(stage, say);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(dt * cfg.speed); }, onPause: pause.onPause });

  function set(name, raw, quiet) {
    if (name === "speed") { cfg.speed = Number(raw); WB.pressSeg(name, raw); return; }
    if (name === "partition") { setCut(raw === "on"); return; }
    if (name === "approach") cfg.approach = raw;
    if (name === "nodes") cfg.nodes = Number(raw);
    if (name === "rate") cfg.rate = Number(raw);
    WB.pressSeg(name, raw);
    if (!quiet) restart();
  }
  WB.onSegments((name, value) => set(name, value));
  act("addA").addEventListener("click", () => { model.add(clock, 0); if (loop.paused) loop.setPaused(false); });
  act("reset").addEventListener("click", () => restart());
  pause.bind(loop);

  // ---------- experiments (numbers computed from the same model at build time) ----------
  const RUNS = {
    lost: () => {
      const r = RESULTS.lost;
      const A = Math.round(r.added), S = Math.round(r.stored);
      return { verdict: T("Of " + A + " adds, the register ended at " + S + ": " + pct(r.lost) + " were lost, with no error anywhere.",
          "De " + A + " sumas, el registro terminó en " + S + ": se perdió el " + pct(r.lost) + ", sin ningún error en ninguna parte."),
        bars: [[T("Adds made", "Sumas hechas"), 1, String(A)], [T("In the register", "En el registro"), r.stored / r.added, String(S), true], [T("Lost", "Perdidas"), r.lost, pct(r.lost), true]] };
    },
    cas: () => {
      const { slow, heavy } = RESULTS.cas, top = Math.max(slow.retries, heavy.retries);
      const a = Math.round(slow.stored), b = Math.round(slow.added), c = Math.round(heavy.stored), d = Math.round(heavy.added);
      return { verdict: T("Exact both times (" + a + " of " + b + ", " + c + " of " + d + "). Retries per add: " + one(slow.retries) + " at 0.1/s, " + one(heavy.retries) + " at 0.6/s; courier trips per add: " + one(slow.msgs) + " → " + one(heavy.msgs) + ".",
          "Exacto las dos veces (" + a + " de " + b + ", " + c + " de " + d + "). Reintentos por suma: " + one(slow.retries) + " a 0.1/s, " + one(heavy.retries) + " a 0.6/s; viajes de mensajero por suma: " + one(slow.msgs) + " → " + one(heavy.msgs) + "."),
        bars: [[T("Retries, 0.1/s", "Reintentos, 0.1/s"), slow.retries / top, one(slow.retries)], [T("Retries, 0.6/s", "Reintentos, 0.6/s"), heavy.retries / top, one(heavy.retries), true]] };
    },
    slots: () => {
      const { g, c } = RESULTS.slots, top = Math.max(g.msgs, c.msgs);
      const a = Math.round(g.stored), b = Math.round(g.added);
      return { verdict: T("One slot each: " + a + " of " + b + " counted, " + one(g.retries) + " retries, " + one(g.msgs) + " courier trips per add. Compare-and-swap at the same rate: " + one(c.retries) + " retries and " + one(c.msgs) + " trips per add.",
          "Una casilla cada una: " + a + " de " + b + " contadas, " + one(g.retries) + " reintentos, " + one(g.msgs) + " viajes de mensajero por suma. Compare-and-swap al mismo ritmo: " + one(c.retries) + " reintentos y " + one(c.msgs) + " viajes por suma."),
        bars: [[T("Trips per add, CAS", "Viajes por suma, CAS"), c.msgs / top, one(c.msgs)], [T("Trips per add, slots", "Viajes por suma, casillas"), g.msgs / top, one(g.msgs), true]] };
    },
    partition: () => {
      const r = RESULTS.partition, top = Math.max(r.farBehind, r.nearBehind, 1);
      return { verdict: T("During the 15 s cut, C's total was up to " + one(r.farBehind) + " adds behind and A and B's up to " + one(r.nearBehind) + ". " + one(r.converge) + " s after healing, every branch agreed on the exact total" + (r.exact === 1 ? "; nothing was lost." : "."),
          "Durante el corte de 15 s, el total de C llegó a estar " + one(r.farBehind) + " sumas atrasado y el de A y B hasta " + one(r.nearBehind) + ". " + one(r.converge) + " s después de restablecerse, todas las sucursales coincidían en el total exacto" + (r.exact === 1 ? "; no se perdió nada." : ".")),
        bars: [[T("C behind, at worst", "C atrasada, en el peor caso"), r.farBehind / top, T(one(r.farBehind) + " adds", one(r.farBehind) + " sumas"), true], [T("A, B behind, at worst", "A, B atrasadas, en el peor caso"), r.nearBehind / top, T(one(r.nearBehind) + " adds", one(r.nearBehind) + " sumas")], [T("Agree after healing (of the 15 s cut)", "Coinciden tras restablecerse (del corte de 15 s)"), Math.min(1, r.converge / 15), one(r.converge) + " s"]] };
    },
    seq: () => {
      const r = RESULTS.seq;
      return { verdict: T("B's own read showed its add " + pct(r.own) + " of the time; A's read showed it " + pct(r.other) + " of the time.",
          "La propia lectura de B mostró su suma el " + pct(r.own) + " de las veces; la lectura de A la mostró el " + pct(r.other) + " de las veces."),
        bars: [[T("B reads its own add", "B lee su propia suma"), r.own, pct(r.own)], [T("A reads B's add", "A lee la suma de B"), r.other, pct(r.other), true]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    set("approach", w.approach, true); set("nodes", String(w.nodes), true); set("rate", String(w.rate), true);
    restart();
    if (loop.paused) loop.setPaused(false);
    if (w.partition) { setTimeout(() => setCut(true), 3000); setTimeout(() => setCut(false), 18000); }
    if (exp.id === "seq") say(L("watch A's display lag B's for a moment after each add", "mira cómo la pantalla de A se atrasa respecto de la de B un momento después de cada suma"));
  } });

  loop.setPaused(loop.paused);
  restart();
}

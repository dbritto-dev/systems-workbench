// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The warehouse in the browser: plays one planned page of trips at a time (pickers walk out, wait, carry the data
// back), fills tickets, counters, stopwatch and crate, and answers the controls. mount() gets the build-time data
// from page.ts (geometry, picker and cargo drawings) and root, the <wb-lesson>.
import { iso, depthOf, translateAlong, solidSvg, slabOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import { digitPath, counterCells, digitsOf } from "../../../workbench/digits.mjs";
import * as WB from "../../runtime/wb";
import { L } from "../../runtime/wb";
import { show as setVis, playPause } from "../../runtime/dom";
import { oneUnder10, millis } from "../../lib/format";
import { planPage, crateLevel, kb } from "./sim";

export default function mount({ P, G, PICKER_SVG, CARGO_SVG }, root) {
  const MS_PER_S = 10;        // model milliseconds per second on screen, at ×1
  const HOLD = 15;            // model ms the finished page stays up before the next one
  const LIT_MS = 5;           // a box stays lit this long after its order completes

  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const stat = (key, value) => root.stat(key, value);
  const NS = "http://www.w3.org/2000/svg";
  const house = q("[data-warehouse]");
  const lampOn = q('[data-lamp="on"]'), lampOff = q('[data-lamp="off"]');
  const hand = q("[data-hand]");
  const fillG = q("[data-fill]");
  const layer = q("[data-pickers]");
  const slots = Array.from({ length: G.SLOT.max }, (_, i) => { const g = q('[data-slot="' + i + '"]'); return { g, ticket: g.querySelector("[data-ticket]"), box: g.querySelector("[data-box]"), lit: g.querySelector("[data-box-lit]"), state: "" }; });
  const origin = iso([0, 0, 0], P);
  const pickers = Array.from({ length: 5 }, (_, i) => {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = '<g data-body>' + PICKER_SVG + '</g><g data-cargo style="display:none">' + CARGO_SVG + '</g>';
    layer.appendChild(g);
    return { g, body: g.firstElementChild, cargo: g.lastElementChild, one: g.querySelector('[data-slip="one"]'), list: g.querySelector('[data-slip="list"]'), depth: 0 };
  });

  // The counters on the table's front are drawn by the figure itself (not parts' digitCounter), so they are redrawn here.
  function counter(name) { const c = G.COUNTERS[name]; const cells = counterCells(c); return { c, cells, els: cells.map((_, j) => q('[data-digit="' + name + '-' + j + '"]')), shown: [] }; }
  const dials = { trips: counter("trips"), ms: counter("ms") };
  function show(dial, v) {
    digitsOf(Math.min(v, 10 ** dial.c.count - 1), dial.c.count).forEach((d, j) => { if (dial.shown[j] !== d) { dial.shown[j] = d; dial.els[j].setAttribute("d", digitPath(iso, P, dial.cells[j], d)); } });
  }

  const fillCache = new Map();
  function fillMarkup(step) {
    if (!fillCache.has(step)) {
      const C = G.CRATE, level = step / 60;
      fillCache.set(step, level <= 0 ? "" : solidSvg(slabOf({ x: C.x + C.wall + 0.4, y: C.y + C.wall + 0.4, w: C.w - 2 * C.wall - 0.8, d: C.d - 2 * C.wall - 0.8, r: 0.4 }, G.TABLE_H + 0.8, level * (C.h - 1.6), P, 2), { tone: "hi", crease: "lo", lit: true }));
    }
    return fillCache.get(step);
  }
  const cargoScale = (bytes) => Math.max(1, Math.min(2.6, 1 + 0.4 * Math.log10(Math.max(1, bytes) / 1000)));

  const cfg = { mode: "n1", rows: 20, items: 5, nested: false, dist: "region", speed: 1 };
  let plan, clock, byLane, ptr, starts, backs, done, pages = 0, lastMs = null, fillStep = -1;
  let seed = (Date.now() % 1e6) + 1;

  function newPage(warm) {
    plan = planPage({ mode: cfg.mode, rows: cfg.rows, items: cfg.items, nested: cfg.nested, dist: cfg.dist }, seed++);
    byLane = Array.from({ length: plan.lanes }, (_, l) => plan.trips.filter((t) => t.lane === l).sort((a, b) => a.t0 - b.t0));
    ptr = byLane.map(() => 0);
    starts = plan.trips.map((t) => t.t0).sort((a, b) => a - b);
    backs = plan.trips.map((t) => [t.back, t.bytes]).sort((a, b) => a[0] - b[0]);
    done = false;
    clock = warm ? plan.end * 0.42 : 0;
    slots.forEach((s, i) => s.g.toggleAttribute("data-off", i >= cfg.rows));
    house.setAttribute("transform", translateAlong(P, [G.STOPS[cfg.dist] - G.STOPS.host, 0, 0]));
    pickers.forEach((p, i) => { p.g.style.display = i < plan.lanes ? "" : "none"; });
  }
  function restart() { pages = 0; lastMs = null; newPage(true); paint(); }

  function paint() {
    const t = Math.min(clock, plan.end);
    const whx = G.STOPS[cfg.dist] + G.SERVE_GAP;
    let serving = false, lead = null;
    const placed = [];
    for (let l = 0; l < plan.lanes; l++) {
      const list = byLane[l];
      while (ptr[l] < list.length && list[ptr[l]].back <= t) ptr[l]++;
      const tr = ptr[l] < list.length && list[ptr[l]].t0 <= t ? list[ptr[l]] : null;
      const y = G.LANES[l];
      let x = G.PARK_X, phase = "idle";
      if (tr) {
        if (t < tr.arrive) { phase = "out"; x = G.PARK_X + (whx - G.PARK_X) * (t - tr.t0) / (tr.arrive - tr.t0); }
        else if (t < tr.done) { phase = "serve"; x = whx; serving = true; }
        else { phase = "back"; x = whx + (G.PARK_X - whx) * (t - tr.done) / (tr.back - tr.done); }
      }
      if (l === 0) lead = { tr, phase };
      const p = pickers[l];
      p.body.setAttribute("transform", translateAlong(P, [x, y, 0]));
      const many = tr && (tr.kind === "join" || (cfg.mode === "batch" && tr.kind !== "list"));
      setVis(p.one, (phase === "out" || phase === "serve") && !many);
      setVis(p.list, (phase === "out" || phase === "serve") && many);
      setVis(p.cargo, phase === "back");
      if (phase === "back") {
        const s = cargoScale(tr.bytes);
        p.cargo.setAttribute("transform", translateAlong(P, [x + 3.4 * G.PICKER_SCALE + 3.1 * s, y, 5 * G.PICKER_SCALE]) + " translate(" + origin[0] + " " + origin[1] + ") scale(" + s.toFixed(3) + ") translate(" + (-origin[0]) + " " + (-origin[1]) + ")");
      }
      p.depth = depthOf([x, y, 0], P);
      placed.push(p);
    }
    // Pickers further back are drawn first.
    placed.sort((a, b) => a.depth - b.depth);
    if (placed.some((p, i) => layer.children[i] !== p.g)) placed.forEach((p) => layer.appendChild(p.g));
    setVis(lampOn, serving); setVis(lampOff, !serving);

    // Tickets and boxes.
    for (let i = 0; i < cfg.rows; i++) {
      const s = slots[i], f = plan.fillAt[i];
      const state = t >= f ? (t - f < LIT_MS && clock < plan.end + LIT_MS ? "lit" : "box") : t >= plan.listAt ? "ticket" : "";
      if (state === s.state) continue;
      s.state = state;
      setVis(s.ticket, state !== "");
      setVis(s.box, state === "box");
      setVis(s.lit, state === "lit");
    }

    // Counters, stopwatch, crate.
    let started = 0; while (started < starts.length && starts[started] <= t) started++;
    let bytes = 0; for (const [b, n] of backs) { if (b > t) break; bytes += n; }
    show(dials.trips, started);
    show(dials.ms, Math.floor(t));
    const a = 2 * Math.PI * (t % G.WATCH_MS) / G.WATCH_MS, W = G.WATCH, len = W.r - 2.2;
    const c = iso([W.x, W.y, W.z], P), tip = iso([W.x + Math.sin(a) * len, W.y - Math.cos(a) * len, W.z], P);
    hand.setAttribute("d", "M" + c[0].toFixed(1) + " " + c[1].toFixed(1) + "L" + tip[0].toFixed(1) + " " + tip[1].toFixed(1));
    const step = Math.round(crateLevel(bytes) * 60);
    if (step !== fillStep) { fillStep = step; fillG.innerHTML = fillMarkup(step); }

    // Readout and stats.
    const modeName = L({ n1: "N+1", par: "N+1, 5 at once", batch: "batched", join: "JOIN" }[cfg.mode], { n1: "N+1", par: "N+1, 5 a la vez", batch: "por lotes", join: "JOIN" }[cfg.mode]);
    if (clock >= plan.end) say(L("page done in " + oneUnder10(plan.end) + " ms · " + plan.queries + (plan.queries === 1 ? " query" : " queries"),
      "página lista en " + oneUnder10(plan.end) + " ms · " + plan.queries + (plan.queries === 1 ? " consulta" : " consultas")));
    else if (lead && lead.tr) {
      const what = lead.phase === "out" ? L("walking to the warehouse", "caminando al almacén") : lead.phase === "serve" ? L("waiting at the counter", "esperando en el mostrador") : L("carrying " + kb(lead.tr.bytes) + " back", "trayendo " + kb(lead.tr.bytes) + " de vuelta");
      say(modeName + L(" · query " + (lead.tr.q + 1) + " of " + plan.queries + " · ", " · consulta " + (lead.tr.q + 1) + " de " + plan.queries + " · ") + what);
    } else say(modeName + L(" · " + started + " of " + plan.queries + " queries sent", " · " + started + " de " + plan.queries + " consultas enviadas"));
    stat("queries", started + L(" of ", " de ") + plan.queries);
    stat("time", millis(t));
    stat("last", lastMs === null ? "–" : millis(lastMs));
    stat("bytes", kb(bytes));
    stat("perpage", plan.queries);
    stat("pages", pages);
  }

  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    if (!plan) return;
    clock += dt * cfg.speed * MS_PER_S;
    if (!done && clock >= plan.end) { done = true; pages++; lastMs = plan.end; }
    if (clock >= plan.end + HOLD) newPage(false);
    paint();
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    if (name === "speed") { cfg.speed = Number(raw); root.press(name, raw); return; }
    if (name === "mode") cfg.mode = raw;
    if (name === "rows") cfg.rows = Number(raw);
    if (name === "items") cfg.items = Number(raw);
    if (name === "nested") cfg.nested = raw === "on";
    if (name === "dist") cfg.dist = raw;
    root.press(name, raw);
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));
  const actions = { reset: () => restart() };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const key of ["mode", "rows", "items", "nested", "dist"]) set(key, String(w[key]), true);
    restart();
    if (loop.paused) loop.setPaused(false);
  });

  loop.setPaused(loop.paused);
  restart();
}

// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The warehouse in the browser: plays one planned page of trips at a time (pickers walk out, wait, carry the data
// back), fills tickets, counters, stopwatch and crate, and wires the controls and the experiment cards. mount() gets
// the build-time data from page.ts (geometry, picker and cargo drawings, experiment ids).
import { iso, depthOf, translateAlong, solidSvg, slabOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import { digitPath, counterCells, digitsOf } from "../../../workbench/digits.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats, show as setVis, act, pauseControls } from "../../runtime/dom";
import { int } from "../../lib/format";
import { planPage, average, crateLevel } from "./sim";

export default function mount({ P, G, PICKER_SVG, CARGO_SVG, EXPERIMENTS }) {
  const MS_PER_S = 10;        // model milliseconds per second on screen, at ×1
  const HOLD = 15;            // model ms the finished page stays up before the next one
  const LIT_MS = 5;           // a box stays lit this long after its order completes

  const stage = document.querySelector("[data-warehouse-stage]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const say = readout();
  const stat = stats();
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
  const fmt = (ms) => ms < 10 ? ms.toFixed(1) : String(Math.round(ms));
  const kb = (b) => b < 1e6 ? (b / 1000).toFixed(b < 1e4 ? 1 : 0) + " KB" : (b / 1e6).toFixed(2) + " MB";

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
    if (clock >= plan.end) say(L("page done in " + fmt(plan.end) + " ms · " + plan.queries + (plan.queries === 1 ? " query" : " queries"),
      "página lista en " + fmt(plan.end) + " ms · " + plan.queries + (plan.queries === 1 ? " consulta" : " consultas")));
    else if (lead && lead.tr) {
      const what = lead.phase === "out" ? L("walking to the warehouse", "caminando al almacén") : lead.phase === "serve" ? L("waiting at the counter", "esperando en el mostrador") : L("carrying " + kb(lead.tr.bytes) + " back", "trayendo " + kb(lead.tr.bytes) + " de vuelta");
      say(modeName + L(" · query " + (lead.tr.q + 1) + " of " + plan.queries + " · ", " · consulta " + (lead.tr.q + 1) + " de " + plan.queries + " · ") + what);
    } else say(modeName + L(" · " + started + " of " + plan.queries + " queries sent", " · " + started + " de " + plan.queries + " consultas enviadas"));
    stat("queries", started + L(" of ", " de ") + plan.queries);
    stat("time", fmt(t) + " ms");
    stat("last", lastMs === null ? "–" : fmt(lastMs) + " ms");
    stat("bytes", kb(bytes));
    stat("perpage", plan.queries);
    stat("pages", pages);
  }

  const pause = pauseControls(stage, say);
  const loop = WB.loop({ stage, step: (dt) => {
    if (!plan) return;
    clock += dt * cfg.speed * MS_PER_S;
    if (!done && clock >= plan.end) { done = true; pages++; lastMs = plan.end; }
    if (clock >= plan.end + HOLD) newPage(false);
    paint();
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    if (name === "speed") { cfg.speed = Number(raw); WB.pressSeg(name, raw); return; }
    if (name === "mode") cfg.mode = raw;
    if (name === "rows") cfg.rows = Number(raw);
    if (name === "items") cfg.items = Number(raw);
    if (name === "nested") cfg.nested = raw === "on";
    if (name === "dist") cfg.dist = raw;
    WB.pressSeg(name, raw);
    if (!quiet) restart();
  }
  WB.onSegments((name, value) => set(name, value));
  act("reset").addEventListener("click", () => restart());

  // ---------- experiments ----------
  const one = fmt;
  const base = { mode: "n1", rows: 20, items: 5, nested: false, dist: "region" };
  const RUNS = {
    distance: () => {
      const h = average({ ...base, dist: "host" }), z = average({ ...base, dist: "zone" }), r = average(base);
      return { verdict: T("Same 21 queries and " + kb(r.bytes) + " each time: " + one(h.time) + " ms on the same host, " + one(z.time) + " ms in the same zone, " + one(r.time) + " ms in another zone.",
          "Las mismas 21 consultas y " + kb(r.bytes) + " cada vez: " + one(h.time) + " ms en el mismo host, " + one(z.time) + " ms en la misma zona, " + one(r.time) + " ms en otra zona."),
        bars: [[T("Same host", "Mismo host"), h.time / r.time, one(h.time) + " ms"], [T("Same zone", "Misma zona"), z.time / r.time, one(z.time) + " ms"], [T("Other zone", "Otra zona"), 1, one(r.time) + " ms", true]] };
    },
    rows: () => {
      const n20 = average(base), n50 = average({ ...base, rows: 50 }), b20 = average({ ...base, mode: "batch" }), b50 = average({ ...base, mode: "batch", rows: 50 }), top = n50.time;
      return { verdict: T("N+1: " + one(n20.time) + " → " + one(n50.time) + " ms (" + n20.queries + " → " + n50.queries + " queries). Batched: " + one(b20.time) + " → " + one(b50.time) + " ms, 2 queries both times.",
          "N+1: " + one(n20.time) + " → " + one(n50.time) + " ms (" + n20.queries + " → " + n50.queries + " consultas). Por lotes: " + one(b20.time) + " → " + one(b50.time) + " ms, 2 consultas las dos veces."),
        bars: [[T("N+1, 20 orders", "N+1, 20 pedidos"), n20.time / top, one(n20.time) + " ms"], [T("N+1, 50 orders", "N+1, 50 pedidos"), 1, one(n50.time) + " ms", true], [T("Batched, 20 orders", "Por lotes, 20 pedidos"), b20.time / top, one(b20.time) + " ms"], [T("Batched, 50 orders", "Por lotes, 50 pedidos"), b50.time / top, one(b50.time) + " ms", true]] };
    },
    nested: () => {
      const flat = average(base), deep = average({ ...base, nested: true }), batch = average({ ...base, nested: true, mode: "batch" }), top = deep.time;
      return { verdict: T("With products: " + deep.queries + " queries and " + one(deep.time) + " ms per page (it was " + flat.queries + " queries, " + one(flat.time) + " ms). Batched per level: " + batch.queries + " queries, " + one(batch.time) + " ms.",
          "Con productos: " + deep.queries + " consultas y " + one(deep.time) + " ms por página (antes eran " + flat.queries + " consultas, " + one(flat.time) + " ms). Por lotes en cada nivel: " + batch.queries + " consultas, " + one(batch.time) + " ms."),
        bars: [[T("N+1, orders and items", "N+1, pedidos y artículos"), flat.time / top, T(flat.queries + " queries · " + one(flat.time) + " ms", flat.queries + " consultas · " + one(flat.time) + " ms")], [T("N+1, with products", "N+1, con productos"), 1, T(deep.queries + " queries · " + one(deep.time) + " ms", deep.queries + " consultas · " + one(deep.time) + " ms"), true], [T("Batched, with products", "Por lotes, con productos"), batch.time / top, T(batch.queries + " queries · " + one(batch.time) + " ms", batch.queries + " consultas · " + one(batch.time) + " ms")]] };
    },
    join: () => {
      const big = { ...base, rows: 50, items: 50 };
      const j = average({ ...big, mode: "join" }), b = average({ ...big, mode: "batch" });
      const js = average({ ...base, mode: "join" }), bs = average({ ...base, mode: "batch" });
      const top = Math.max(j.time, b.time);
      return { verdict: T("50 × 50: the JOIN ships " + kb(j.bytes) + " in " + one(j.time) + " ms; batching ships " + kb(b.bytes) + " in " + one(b.time) + " ms. With 20 orders of 5 items the JOIN wins instead: " + one(js.time) + " ms vs " + one(bs.time) + " ms.",
          "50 × 50: el JOIN envía " + kb(j.bytes) + " en " + one(j.time) + " ms; por lotes se envían " + kb(b.bytes) + " en " + one(b.time) + " ms. Con 20 pedidos de 5 artículos, en cambio, gana el JOIN: " + one(js.time) + " ms vs " + one(bs.time) + " ms."),
        bars: [[T("JOIN, 1 query", "JOIN, 1 consulta"), j.time / top, one(j.time) + " ms · " + kb(j.bytes)], [T("Batched, 2 queries", "Por lotes, 2 consultas"), b.time / top, one(b.time) + " ms · " + kb(b.bytes), true]] };
    },
    parallel: () => {
      const n = average(base), p = average({ ...base, mode: "par" }), b = average({ ...base, mode: "batch" }), top = n.time;
      return { verdict: T("One by one: " + one(n.time) + " ms. Five at a time: " + one(p.time) + " ms. Batched: " + one(b.time) + " ms. Queries per page: " + n.queries + ", " + p.queries + " and " + b.queries + ": at 200 pages a second that is " + int(p.queries * 200) + " vs " + (b.queries * 200) + " queries a second.",
          "Una por una: " + one(n.time) + " ms. Cinco a la vez: " + one(p.time) + " ms. Por lotes: " + one(b.time) + " ms. Consultas por página: " + n.queries + ", " + p.queries + " y " + b.queries + ": a 200 páginas por segundo eso son " + int(p.queries * 200) + " vs " + (b.queries * 200) + " consultas por segundo."),
        bars: [[T("One by one", "Una por una"), 1, T(one(n.time) + " ms · " + n.queries + " queries", one(n.time) + " ms · " + n.queries + " consultas")], [T("5 at once", "5 a la vez"), p.time / top, T(one(p.time) + " ms · " + p.queries + " queries", one(p.time) + " ms · " + p.queries + " consultas"), true], [T("Batched", "Por lotes"), b.time / top, T(one(b.time) + " ms · " + b.queries + " queries", one(b.time) + " ms · " + b.queries + " consultas")]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    for (const key of ["mode", "rows", "items", "nested", "dist"]) set(key, String(w[key]), true);
    restart();
    if (loop.paused) loop.setPaused(false);
  } });

  loop.setPaused(loop.paused);
  restart();
}

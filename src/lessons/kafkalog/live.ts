// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The rail yard in the browser: runs the log model, slides cars along their tracks, moves the bookmark gantries and
// the cabins' wires, and wires the controls and the experiment cards. mount() gets the build-time data from page.ts
// (projection, geometry, the car drawing, experiment results).
import { iso, translateAlong, wireSvg } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats, setText, act, pauseControls } from "../../runtime/dom";
import { makeSim } from "./sim";

export default function mount({ P, G, CAR_SVG, RESULTS, EXPERIMENTS }) {
  const NS = "http://www.w3.org/2000/svg";
  const stage = document.querySelector("[data-office]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const sayText = readout();
  const say = (v) => sayText(L(v));
  const tracks = G.TRACK_Y.map((_, i) => q('[data-track="' + i + '"]'));
  const carLayers = G.TRACK_Y.map((_, i) => q('[data-cars="' + i + '"]'));
  const bookmarks = G.TRACK_Y.map((_, i) => q('[data-bookmark="' + i + '"]'));
  const flags = bookmarks.map((b) => b.querySelector("[data-flag]"));
  const flagNums = bookmarks.map((b) => b.querySelector("[data-num]"));
  const lagBoxes = G.TRACK_Y.map((_, i) => q('[data-shed-lag="' + i + '"]'));
  const lagNums = lagBoxes.map((b) => b.querySelector("[data-lag]"));
  const WARM = 20;
  const cabins = G.CABIN_X.map((_, i) => q('[data-cabin="' + i + '"]'));
  const lamps = cabins.map((c) => c.querySelector("[data-lamp] .iso-solid"));
  const shutters = cabins.map((c) => c.querySelector("[data-shutter]"));
  const cables = q("[data-cables]");
  const traverser = q("[data-traverser]");
  const incomingLayer = q("[data-incoming]");

  function makeCar(parent) {
    const g = document.createElementNS(NS, "g"); g.innerHTML = CAR_SVG; parent.appendChild(g);
    const solids = g.querySelectorAll(".iso-solid");
    return { g, box: solids[1], num: g.querySelector("[data-num]"), stamp: g.querySelector("[data-stamp]"), keys: [...g.querySelectorAll("[data-key]")], shownKey: -1, shownOffset: -1, shown: true };
  }
  const pools = carLayers.map((layer) => Array.from({ length: G.WINDOW }, () => makeCar(layer)));
  const incoming = G.TRACK_Y.map(() => makeCar(incomingLayer));

  const cfg = { partitions: 3, consumers: 3, keying: "key", commit: "after", rate: 4, retention: 0, speed: 1 };
  let sim, endShown, travY, seed = (Date.now() % 1e6) + 1, script = [], note = null, seenEvents = 0;

  function restart() {
    sim = makeSim({ ...cfg }, seed++);
    sim.runTo(WARM);   // open on a yard already in use
    endShown = G.TRACK_Y.map((_, p) => (sim.logs[p] ? sim.logs[p].records.length : 0));
    travY = G.TRACK_Y[sim.lastProduced ? sim.lastProduced.p : 1];
    script = []; note = null; seenEvents = 0;
    tracks.forEach((t, i) => t.toggleAttribute("data-off", i >= cfg.partitions));
    lagBoxes.forEach((b, i) => (b.style.display = i >= cfg.partitions ? "none" : ""));
    cabins.forEach((c, i) => c.toggleAttribute("data-off", i >= cfg.consumers));
    showStats(); paint();
  }

  function setCar(car, x, y, rec, lit) {
    car.g.style.display = ""; car.shown = true;
    car.g.setAttribute("transform", translateAlong(P, [x, y, 0]));
    if (car.shownKey !== rec.key) { car.keys.forEach((el, n) => (el.style.display = n === rec.key ? "" : "none")); car.shownKey = rec.key; }
    if (car.shownOffset !== rec.offset) { car.num.textContent = rec.offset; car.shownOffset = rec.offset; }
    car.stamp.style.display = rec.reads > 0 ? "" : "none";
    car.box.toggleAttribute("data-lit", lit);
  }
  function hideCar(car) { if (car.shown) { car.g.style.display = "none"; car.shown = false; } }

  function paint() {
    const reading = new Set(sim.consumers.filter((c) => c.current).map((c) => c.current.p + ":" + c.current.offset));
    let wires = "";
    for (let p = 0; p < G.TRACK_Y.length; p++) {
      const pool = pools[p], inc = incoming[p];
      if (p >= cfg.partitions) { pool.forEach(hideCar); hideCar(inc); continue; }
      const y = G.TRACK_Y[p], log = sim.logs[p], end = log.records.length, e = endShown[p];
      const xOf = (o) => G.TAIL_X - (e - 1 - o) * G.SPACING;
      const first = Math.max(log.start, Math.ceil(e - 1 - (G.TAIL_X - (G.SHED_X + G.CAR.w / 2)) / G.SPACING));
      let n = 0;
      hideCar(inc);
      for (let o = first; o < end && n < pool.length; o++) {
        const x = xOf(o), rec = log.records[o];
        const lit = reading.has(p + ":" + o);
        if (x > G.TAIL_X + 6) { setCar(inc, x, y, rec, lit); continue; }
        setCar(pool[n++], x, y, rec, lit);
      }
      for (; n < pool.length; n++) hideCar(pool[n]);
      // Bookmark post: between the last committed car and the next one.
      setText(flagNums[p], sim.committed[p]);
      setText(lagNums[p], Math.min(999, sim.lag(p)));
      const minX = G.SHED_X + 3;
      const bx = xOf(sim.committed[p]) - G.SPACING / 2;
      const clamped = bx < minX;
      const postX = Math.min(G.TAIL_X + G.SPACING / 2, Math.max(minX, bx));
      bookmarks[p].setAttribute("transform", translateAlong(P, [postX, 0, 0]));
      flags[p].style.display = clamped ? "none" : "";
      // Overhead wire from the owning cabin's mast to the gantry.
      const owner = sim.consumers.findIndex((c) => c.parts.includes(p));
      if (owner >= 0) {
        const from = iso([G.CABIN_X[owner] + G.MAST.dx, G.CABIN.y + G.MAST.dy, G.MAST.top], P);
        wires += wireSvg(from, iso([postX, y + G.GANTRY.half, G.GANTRY.h], P), { tone: "lo", size: 0.8 });
      }
    }
    cables.innerHTML = wires;
    sim.consumers.forEach((c, i) => {
      lamps[i].toggleAttribute("data-lit", !!c.current && c.down === 0);
      shutters[i].style.display = c.down > 0 ? "" : "none";
    });
    traverser.setAttribute("transform", translateAlong(P, [0, travY, 0]));
  }

  const stat = stats();
  function showStats() {
    stat("produced", sim.produced);
    stat("processed", sim.processed);
    stat("lag", sim.totalLag());
    stat("duplicates", sim.duplicates);
    stat("lost", sim.lost());
    stat("order", sim.firstReads ? Math.round(100 * sim.outOfOrder / sim.firstReads) + "%" : "–");
  }

  let statTimer = 0;
  function advance(dt) {
    sim.step(dt);
    while (script.length && script[0].at <= sim.t) script.shift().run();
    const k = 1 - Math.exp(-dt / 0.2);
    for (let p = 0; p < cfg.partitions; p++) endShown[p] += (sim.logs[p].records.length - endShown[p]) * k;
    if (sim.lastProduced) travY += (G.TRACK_Y[sim.lastProduced.p] - travY) * (1 - Math.exp(-dt / 0.12));
    for (; seenEvents < sim.events.length; seenEvents++) {
      const ev = sim.events[seenEvents];
      if (ev.type === "crash") note = { until: sim.t + 2, text: T("consumer " + (ev.consumer + 1) + " crashed · restarts from its bookmarks", "el consumidor " + (ev.consumer + 1) + " se cayó · reinicia desde sus marcadores") };
      if (ev.type === "restart") note = { until: sim.t + 2, text: cfg.commit === "after"
        ? T("consumer " + (ev.consumer + 1) + " back · rereads since the last commit", "el consumidor " + (ev.consumer + 1) + " volvió · relee desde el último commit")
        : T("consumer " + (ev.consumer + 1) + " back · skips what it had committed", "el consumidor " + (ev.consumer + 1) + " volvió · se salta lo que ya había confirmado") };
      if (ev.type === "rewind") note = { until: sim.t + 3, text: T("bookmarks rewound to the oldest kept record · rebuilding", "marcadores rebobinados al registro más antiguo guardado · reconstruyendo") };
    }
    statTimer += dt;
    if (statTimer > 0.2) { statTimer = 0; showStats(); }
    sayStatus();
  }
  function sayStatus() {
    if (note && sim.t < note.until) say(note.text);
    else {
      const idle = sim.idle();
      say(T(cfg.partitions + " tracks · " + cfg.consumers + " consumers" + (idle ? " (" + idle + " idle)" : "") + " · lag " + sim.totalLag(),
        cfg.partitions + " vías · " + cfg.consumers + " consumidores" + (idle ? " (" + idle + " inactivos)" : "") + " · lag " + sim.totalLag()));
    }
  }

  const pause = pauseControls(stage, say);
  const loop = WB.loop({ stage, step: (dt) => { advance(dt * cfg.speed); paint(); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    if (name === "speed") { cfg.speed = Number(raw); WB.pressSeg(name, raw); return; }
    if (name in cfg) cfg[name] = ["keying", "commit"].includes(name) ? raw : Number(raw);
    WB.pressSeg(name, raw);
    if (!quiet) restart();
  }
  WB.onSegments((name, value) => set(name, value));
  act("crash").addEventListener("click", () => { sim.requestCrash(0); if (loop.paused) loop.setPaused(false); });
  act("rewind").addEventListener("click", () => { sim.rewind(); if (loop.paused) loop.setPaused(false); });
  act("reset").addEventListener("click", () => restart());

  // ---------- experiments (results computed at build time from the same model) ----------
  const RUNS = Object.fromEntries(Object.keys(RESULTS).map((id) => [id, () => RESULTS[id]]));
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    for (const name of ["partitions", "consumers", "keying", "commit", "rate", "retention"]) set(name, String(w[name]), true);
    restart();
    if (w.crashes) for (let t = sim.t + 3; t < sim.t + 600; t += 10) script.push({ at: t, run: () => sim.requestCrash(0) });
    if (w.rewindAt) script.push({ at: sim.t + w.rewindAt, run: () => sim.rewind() });
    if (loop.paused) loop.setPaused(false);
  } });

  loop.setPaused(loop.paused);
  restart();
}

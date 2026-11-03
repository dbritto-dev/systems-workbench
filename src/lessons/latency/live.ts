// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The courier depot in the browser: plans each job from the model, walks the courier along the road, and answers the
// controls. mount() gets the build-time data from page.ts (geometry, courier) and root, the <wb-lesson>.
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { playPause } from "../../runtime/dom";
import { int, oneUnder10 } from "../../lib/format";
import { STATIONS, runJob, human, fmt } from "./sim";

export default function mount({ P, G, COURIER_SVG, DEFAULT_HOW }, root) {
  const { stage, svg } = root.figure;
  const say = (text) => root.figure.say(text);
  const layer = svg.querySelector('[data-layer="courier"]');
  layer.innerHTML = COURIER_SVG;
  const courier = layer.firstElementChild;
  const totalSign = svg.querySelector("[data-total]"), humanSign = svg.querySelector("[data-human]");
  const meters = Object.fromEntries(STATIONS.map((s) => [s.id, WB.meter(svg, "share-" + s.id, P)]));
  const stat = (key, value) => root.stat(key, value);

  const NAME = { l1: T("L1 cache", "caché L1"), l2: T("L2 cache", "caché L2"), ram: T("memory", "memoria"), ssd: T("SSD", "SSD"), dc: T("same datacenter", "mismo centro de datos"), disk: T("disk", "disco"), wan: T("other continent", "otro continente") };
  const SHORT = { l1: "L1", l2: "L2", ram: "RAM", ssd: "SSD", dc: T("same DC", "mismo DC"), disk: T("disk", "disco"), wan: T("overseas", "lejos") };
  const UNITS = { s: T("S", "S"), min: T("MIN", "MIN"), h: T("H", "H"), d: T("DAYS", "DÍAS"), mo: T("MONTHS", "MESES"), y: T("YEARS", "AÑOS") };
  const humanText = (ns) => { const [v, u] = human(ns); return oneUnder10(v) + " " + L(UNITS[u]); };

  const cfg = { job: "lookups", how: { ...DEFAULT_HOW }, speed: 1 };
  const SPEED = 230;   // world units a second on screen: a trip to the other continent and back takes about 2 s
  const MAXA = 20;     // trips animated per leg; beyond that each one shown stands for several real ones
  let run, trips, idx, phase, ph, done, doneAt, seed = 11;

  function plan() {
    const r = runJob(cfg.job, cfg.how[cfg.job], seed, 0);
    seed = (seed * 48271) % 2147483647;
    const list = [];
    r.legs.forEach((leg) => {
      const waves = Math.ceil(leg.count / leg.wide);
      const n = Math.min(waves, MAXA);
      for (let i = 0; i < n; i++) list.push({ station: leg.station, ns: leg.total / n, count: leg.count / n, rep: waves / n, wide: leg.wide, each: leg.each });
    });
    return { r, list };
  }
  function restart() {
    run = plan();
    trips = { ns: 0, count: 0, by: Object.fromEntries(STATIONS.map((s) => [s.id, 0])) };
    idx = 0; phase = "out"; ph = 0; done = false;
    paint();
  }
  function tripLen(st) { return G.SPOTS[st] - G.DEPOT_X; }
  function step(dt) {
    if (done) { doneAt += dt; if (doneAt > 3) restart(); paint(); return; }
    const trip = run.list[idx];
    const len = tripLen(trip.station);
    ph += dt * cfg.speed;
    const out = len / SPEED, dwell = 0.18, back = len / SPEED;
    if (phase === "out" && ph >= out) { phase = "dwell"; ph -= out; }
    if (phase === "dwell" && ph >= dwell) { phase = "back"; ph -= dwell; }
    if (phase === "back" && ph >= back) {
      trips.ns += trip.ns; trips.count += trip.count; trips.by[trip.station] += trip.ns;
      idx++; phase = "out"; ph = 0;
      if (idx >= run.list.length) { done = true; doneAt = 0; trips.ns = run.r.total; trips.count = run.r.trips; trips.by = { ...run.r.by }; }
    }
    paint();
  }
  function courierX() {
    if (done) return G.DEPOT_X;
    const trip = run.list[idx], len = tripLen(trip.station);
    if (phase === "out") return G.DEPOT_X + Math.min(len, ph * SPEED);
    if (phase === "dwell") return G.DEPOT_X + len;
    return G.DEPOT_X + Math.max(0, len - ph * SPEED);
  }
  function paint() {
    courier.setAttribute("transform", translateAlong(P, [courierX(), G.ROAD_Y, G.ROAD_Z]));
    courier.style.opacity = done ? "0.35" : "";
    const total = trips.ns;
    STATIONS.forEach((s) => meters[s.id].set(total > 0 ? trips.by[s.id] / total : 0));
    totalSign.textContent = fmt(total);
    const trip = run.list[Math.min(idx, run.list.length - 1)];
    humanSign.textContent = humanText(trip.each);
    let top = null;
    for (const s of STATIONS) if (!top || trips.by[s.id] > trips.by[top]) top = s.id;
    stat("total", fmt(total)); stat("trips", int(trips.count)); stat("per", fmt(trip.each)); stat("human", humanText(trip.each).toLowerCase());
    stat("where", total > 0 ? L(SHORT[top]) : "–"); stat("share", total > 0 ? Math.round((100 * trips.by[top]) / total) + "%" : "–");
    if (done) { say(L("done · " + int(run.r.trips) + " trips · " + fmt(run.r.total) + " · " + Math.round((100 * run.r.by[top]) / run.r.total) + "% at " + NAME[top].en,
      "listo · " + int(run.r.trips) + " viajes · " + fmt(run.r.total) + " · " + Math.round((100 * run.r.by[top]) / run.r.total) + "% en " + NAME[top].es)); return; }
    const n = run.list.length, wide = trip.wide > 1 ? L(" · " + trip.wide + " calls in flight", " · " + trip.wide + " llamadas en curso") : "";
    const rep = trip.rep > 1 ? L(" · each trip shown stands for " + int(trip.rep), " · cada viaje que ves representa " + int(trip.rep)) : "";
    say(L("trip " + (idx + 1) + " of " + n + " · " + NAME[trip.station].en, "viaje " + (idx + 1) + " de " + n + " · " + NAME[trip.station].es) + wide + rep + " · " + fmt(total));
  }

  const pause = playPause(root);
  const loop = WB.loop({ stage, step, onPause: pause.onPause });
  pause.bind(loop);

  const showJob = (job) => root.controls.showFor(job);
  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    if (name === "job") { cfg.job = raw; showJob(raw); }
    else if (name.startsWith("how-")) cfg.how[name.slice(4)] = raw;
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));
  const actions = { reset: () => { restart(); if (loop.paused) loop.setPaused(false); } };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    set("job", w.job, true); set("how-" + w.job, w.how, true); set("speed", w.speed);
    restart();
    if (loop.paused) loop.setPaused(false);
  });

  loop.setPaused(loop.paused);
  restart();
  for (let i = 0; i < 300; i++) step(1 / 60);   // open a few trips in, so the first frame already shows a job under way
}

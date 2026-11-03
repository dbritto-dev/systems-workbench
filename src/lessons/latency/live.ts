// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The courier depot in the browser: plans each job from the model, walks the courier along the road, wires the
// controls and the experiment cards. mount() gets the build-time data from page.ts (geometry, courier, results).
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats, act, pauseControls } from "../../runtime/dom";
import { int, oneUnder10 } from "../../lib/format";
import { STATIONS, runJob, human } from "./sim";

export default function mount({ P, G, COURIER_SVG, RESULTS, EXPERIMENTS, DEFAULT_HOW }) {
  const stage = document.querySelector("[data-depot]");
  const svg = stage.querySelector("svg");
  const say = readout();
  const layer = svg.querySelector('[data-layer="courier"]');
  layer.innerHTML = COURIER_SVG;
  const courier = layer.firstElementChild;
  const totalSign = svg.querySelector("[data-total]"), humanSign = svg.querySelector("[data-human]");
  const meters = Object.fromEntries(STATIONS.map((s) => [s.id, WB.meter(svg, "share-" + s.id, P)]));
  const stat = stats();

  const NAME = { l1: T("L1 cache", "caché L1"), l2: T("L2 cache", "caché L2"), ram: T("memory", "memoria"), ssd: T("SSD", "SSD"), dc: T("same datacenter", "mismo centro de datos"), disk: T("disk", "disco"), wan: T("other continent", "otro continente") };
  const SHORT = { l1: "L1", l2: "L2", ram: "RAM", ssd: "SSD", dc: T("same DC", "mismo DC"), disk: T("disk", "disco"), wan: T("overseas", "lejos") };
  const UNITS = { s: T("S", "S"), min: T("MIN", "MIN"), h: T("H", "H"), d: T("DAYS", "DÍAS"), mo: T("MONTHS", "MESES"), y: T("YEARS", "AÑOS") };
  const sig = (v) => (v === 0 ? "0" : v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
  function fmt(ns) {
    if (ns < 999.5) return sig(ns) + " ns";
    if (ns < 999.5e3) return sig(ns / 1e3) + " µs";
    if (ns < 999.5e6) return sig(ns / 1e6) + " ms";
    return sig(ns / 1e9) + " s";
  }
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

  const pause = pauseControls(stage, say);
  const loop = WB.loop({ stage, step, onPause: pause.onPause });
  pause.bind(loop);

  function showJob(job) { document.querySelectorAll("[data-for]").forEach((el) => { el.hidden = el.dataset.for !== job; }); }
  function set(name, raw, quiet) {
    WB.pressSeg(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    if (name === "job") { cfg.job = raw; showJob(raw); }
    else if (name.startsWith("how-")) cfg.how[name.slice(4)] = raw;
    if (!quiet) restart();
  }
  WB.onSegments((name, value) => set(name, value));
  act("reset").addEventListener("click", () => { restart(); if (loop.paused) loop.setPaused(false); });

  // ---------- experiments (numbers computed from the same model, 8 seeds each) ----------
  const x = (a, b) => int(a / b) + "×";
  const RUNS = {
    chatty: () => {
      const { ram, dc } = RESULTS.chatty;
      return { verdict: T("In memory: " + fmt(ram.total) + " for all 100. Over the network: " + fmt(dc.total) + ", about " + x(dc.total, ram.total) + " longer. The lookups are the same; the trips are not.",
          "En memoria: " + fmt(ram.total) + " para las 100. Por la red: " + fmt(dc.total) + ", unas " + x(dc.total, ram.total) + " más. Las consultas son las mismas; los viajes no."),
        bars: [[T("In memory", "En memoria"), ram.total / dc.total, fmt(ram.total)], [T("Cache service, same DC", "Servicio de caché, mismo DC"), 1, fmt(dc.total), true]] };
    },
    read: () => {
      const r = RESULTS.read, top = r["ssd-rand"].total;
      return { verdict: T("SSD at random: " + fmt(r["ssd-rand"].total) + ". Disk in order: " + fmt(r["disk-seq"].total) + ". SSD in order: " + fmt(r["ssd-seq"].total) + ". Disk at random: " + fmt(r["disk-rand"].total) + ", off the chart.",
          "SSD al azar: " + fmt(r["ssd-rand"].total) + ". Disco en orden: " + fmt(r["disk-seq"].total) + ". SSD en orden: " + fmt(r["ssd-seq"].total) + ". Disco al azar: " + fmt(r["disk-rand"].total) + ", fuera de la escala."),
        bars: [[T("SSD, random 4 KB", "SSD, 4 KB al azar"), r["ssd-rand"].total / top, fmt(r["ssd-rand"].total)], [T("Disk, in order", "Disco, en orden"), r["disk-seq"].total / top, fmt(r["disk-seq"].total), true], [T("SSD, in order", "SSD, en orden"), r["ssd-seq"].total / top, fmt(r["ssd-seq"].total)], [T("Disk, random 4 KB (off the chart)", "Disco, 4 KB al azar (fuera de escala)"), 1, fmt(r["disk-rand"].total)]] };
    },
    sum: () => {
      const { array, list } = RESULTS.sum;
      return { verdict: T("Array: " + fmt(array.total) + ". Linked list: " + fmt(list.total) + ", about " + x(list.total, array.total) + " slower for the same million additions.",
          "Arreglo: " + fmt(array.total) + ". Lista enlazada: " + fmt(list.total) + ", unas " + x(list.total, array.total) + " más lenta para el mismo millón de sumas."),
        bars: [[T("Array", "Arreglo"), array.total / list.total, fmt(array.total)], [T("Linked list", "Lista enlazada"), 1, fmt(list.total), true]] };
    },
    batch: () => {
      const { one, ten, batch } = RESULTS.batch;
      return { verdict: T("One at a time: " + fmt(one.total) + ". Ten at a time: " + fmt(ten.total) + ". One batch: " + fmt(batch.total) + ", about " + x(one.total, batch.total) + " faster than one at a time.",
          "Una a la vez: " + fmt(one.total) + ". Diez a la vez: " + fmt(ten.total) + ". Un lote: " + fmt(batch.total) + ", unas " + x(one.total, batch.total) + " más rápido que de a una."),
        bars: [[T("One at a time", "Una a la vez"), 1, fmt(one.total), true], [T("10 at a time", "10 a la vez"), ten.total / one.total, fmt(ten.total)], [T("One batch", "Un solo lote"), batch.total / one.total, fmt(batch.total)]] };
    },
    page: () => {
      const { primary, replica, cache } = RESULTS.page;
      return { verdict: T("Primary overseas: " + fmt(primary.total) + ". Replica in the same datacenter: " + fmt(replica.total) + ", about " + x(primary.total, replica.total) + " faster. Cache in memory: " + fmt(cache.total) + ".",
          "Primaria lejana: " + fmt(primary.total) + ". Réplica en el mismo centro de datos: " + fmt(replica.total) + ", unas " + x(primary.total, replica.total) + " más rápida. Caché en memoria: " + fmt(cache.total) + "."),
        bars: [[T("Primary, overseas", "Primaria, lejana"), 1, fmt(primary.total)], [T("Replica, same DC", "Réplica, mismo DC"), replica.total / primary.total, fmt(replica.total), true], [T("Cache in memory", "Caché en memoria"), cache.total / primary.total, fmt(cache.total)]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    set("job", w.job, true); set("how-" + w.job, w.how, true); set("speed", w.speed);
    restart();
    if (loop.paused) loop.setPaused(false);
  } });

  loop.setPaused(loop.paused);
  restart();
  for (let i = 0; i < 300; i++) step(1 / 60);   // open a few trips in, so the first frame already shows a job under way
}

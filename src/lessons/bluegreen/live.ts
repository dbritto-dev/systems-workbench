// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The two press lines in the browser: runs the blue-green model, moves requests along the infeed, the lanes and the
// belts, presses, fills the cache trays, swings the gate arm, wires the controls and the experiment cards. mount()
// gets the build-time data from page.ts (geometry, experiment results).
import { translateAlong, extrude, cylinder, solidSvg } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats, act, pauseControls } from "../../runtime/dom";
import { lerp, lerpVec as lerp3, easeInOutCubic as ease } from "../../lib/tween";
import { clamp as clamp01 } from "../../lib/stats";
import { pct } from "../../lib/format";
import { createWorld, prepareGreen, flip, step, p95 } from "./sim";

export default function mount({ P, G, RESULTS, EXPERIMENTS }) {
  // The gate's arm, as figure.ts draws it (GATE_R is 15 there).
  function gateArm(angle, lit) {
    const [cx, cy] = G.GATE;
    const u = [Math.cos(angle), Math.sin(angle)], n = [-u[1], u[0]];
    const pt = (r, s) => [cx + u[0] * r + n[0] * s, cy + u[1] * r + n[1] * s];
    const ring = [pt(-3, -2.2), pt(11, -2.2), pt(12.5, 0), pt(11, 2.2), pt(-3, 2.2)];
    return solidSvg(extrude(ring, G.BELT_Z, 3, P, { convex: true, bevel: 0.3 }), { tone: "hi", crease: "lo", lit })
      + solidSvg(cylinder(cx, cy, 3, G.BELT_Z, 5.5, P, 20, 0.3), { tone: "mid" });
  }
  const SIDE = { blue: T("blue", "azul"), green: T("green", "verde") };

  const stage = document.querySelector("[data-office]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const say = readout();
  const stat = stats();
  const layers = { blue: q('[data-layer="blue"]'), green: q('[data-layer="green"]'), mid: q('[data-layer="mid"]') };
  const items = [...svg.querySelectorAll("[data-item]")];
  const heads = { blue: [0, 1, 2].map((i) => q('[data-head="blue-' + i + '"]')), green: [0, 1, 2].map((i) => q('[data-head="green-' + i + '"]')) };
  const cards = { blue: [...q('[data-cache="blue"]').children], green: [...q('[data-cache="green"]').children] };
  const lamps = { blue: q('[data-lamp="blue"] .iso-solid'), green: q('[data-lamp="green"] .iso-solid') };
  const armEl = q("[data-arm]"), schemaEl = q("[data-schema]");
  const settings = { release: "good", warm: "on", draining: "on", migration: "compatible" };
  let speed = 1;
  let w, vis, slotOf, free, script, armAngle, latencies, incident, lastErrors, note;

  function start() {
    w = createWorld({ seed: (Date.now() % 1e6) + 1, release: settings.release, warm: settings.warm === "on", draining: settings.draining === "on", migration: settings.migration });
    vis = new Map(); slotOf = new Map(); free = items.map((_, i) => i).reverse(); script = [];
    armAngle = G.LANE_ANGLE.blue; latencies = []; incident = null; lastErrors = 0; note = null;
    items.forEach((el) => { el.style.display = "none"; });
    armEl.innerHTML = gateArm(armAngle, false);
    updateFlipButton(); paint(0);
  }

  function targetOf(job) {
    const o = w.o, t = w.t;
    if (job.stage === "infeed") return [lerp(G.INFEED.from, G.GATE[0], clamp01((t - job.born) / o.infeed)), 0, G.BELT_Z];
    const ys = G.LINES[job.side];
    if (job.stage === "lane") return lerp3([G.GATE[0], G.GATE[1], G.BELT_Z], [G.LANE_END_X + 2, ys, G.BELT_Z], clamp01((t - job.gateAt) / o.lane));
    if (job.stage === "queue") {
      const i = w.sides[job.side].queue.indexOf(job);
      return i < G.QUEUE.shown ? [G.QUEUE.x0 - i * G.QUEUE.gap, ys, G.BELT_Z] : null;
    }
    if (job.stage === "service") return [G.STATIONS[job.worker], ys, G.BELT_Z];
    return null;
  }

  // Where a finished request goes: served to the outfeed tray, errors into the reject bin.
  function exitOf(job, from, age) {
    const ys = G.LINES[job.side] || 0;
    if (job.outcome === "ok") { const f = clamp01(age / 0.5); return { p: lerp3(from, [G.OUTFEED.x, ys, G.BELT_Z + 3], ease(f)), alpha: age < 0.5 ? 1 : 1 - clamp01((age - 0.5) / 0.3) }; }
    const bin = [G.BIN.x, ys + G.BIN.dy, G.BELT_Z + 9], inBin = [G.BIN.x, ys + G.BIN.dy, G.BELT_Z + 1];
    if (age < 0.45) { const f = ease(clamp01(age / 0.45)); return { p: [lerp(from[0], bin[0], f), lerp(from[1], bin[1], f), lerp(from[2], bin[2], f) + 6 * Math.sin(Math.PI * f)], alpha: 1 }; }
    return { p: lerp3(bin, inBin, clamp01((age - 0.45) / 0.2)), alpha: 1 - clamp01((age - 0.65) / 0.25) };
  }

  function paint(realDt) {
    const t = w.t, follow = 1 - Math.exp(-realDt * Math.max(1, speed) / 0.1);
    const shown = new Set();
    const place = (job, p, alpha) => {
      let slot = slotOf.get(job.id);
      if (slot === undefined) { if (!free.length) return; slot = free.pop(); slotOf.set(job.id, slot); }
      shown.add(job.id);
      const el = items[slot];
      const layer = job.side ? layers[job.side] : layers.mid;
      if (el.parentNode !== layer) layer.appendChild(el);
      el.style.display = "";
      el.style.opacity = alpha < 1 ? String(Math.max(0, alpha)) : "";
      el.setAttribute("transform", translateAlong(P, p));
      el.firstElementChild.toggleAttribute("data-lit", job.side === "green");
    };
    for (const job of w.active) {
      const target = targetOf(job);
      let v = vis.get(job.id);
      if (!target) { if (v) v.hidden = true; continue; }
      if (!v || job.stage === "infeed" || job.stage === "lane") { v = { p: target }; vis.set(job.id, v); }
      else v.p = lerp3(v.p, target, follow);
      v.hidden = false;
      place(job, v.p, 1);
    }
    for (let i = w.log.length - 1; i >= 0; i--) {
      const job = w.log[i];
      const age = t - job.doneAt;
      if (age > 0.9) break;
      const v = vis.get(job.id);
      const from = v ? v.p : [G.LANE_END_X + 2, G.LINES[job.side] || 0, G.BELT_Z];
      if (!v) vis.set(job.id, { p: from });
      if (!job.exitFrom) job.exitFrom = from;
      if (job.outcome === "turned") { place(job, job.exitFrom, 1 - clamp01(age / 0.6)); continue; }
      const e = exitOf(job, job.exitFrom, age);
      place(job, e.p, e.alpha);
    }
    for (const [id, slot] of slotOf) if (!shown.has(id)) { items[slot].style.display = "none"; slotOf.delete(id); free.push(slot); vis.delete(id); }
    for (const name of ["blue", "green"]) {
      const side = w.sides[name];
      side.workers.forEach((worker, i) => {
        const job = worker.job;
        const f = job ? clamp01((t - job.startAt) / (job.endAt - job.startAt)) : 0;
        const dz = job ? (G.HEAD.press - G.HEAD.rest) * Math.sin(Math.PI * f) : 0;
        heads[name][i].setAttribute("transform", dz ? translateAlong(P, [0, 0, dz]) : "");
      });
      const n = Math.round(side.fill * 10);
      cards[name].forEach((card, i) => { card.style.display = i < n ? "" : "none"; });
      lamps[name].toggleAttribute("data-lit", w.live === name);
    }
    const target = G.LANE_ANGLE[w.live];
    if (Math.abs(target - armAngle) > 0.002) {
      armAngle = lerp(armAngle, target, 1 - Math.exp(-realDt * Math.max(1, speed) / 0.12));
      if (Math.abs(target - armAngle) < 0.002) armAngle = target;
      armEl.innerHTML = gateArm(armAngle, w.live === "green");
    }
    const schema = L("SCHEMA v", "ESQUEMA v") + w.schema;
    if (schemaEl.textContent !== schema) schemaEl.textContent = schema;
    showStats();
  }

  let seenLog = 0;
  function showStats() {
    for (; seenLog < w.log.length; seenLog++) { const j = w.log[seenLog]; if (j.outcome === "ok") { latencies.push(j.doneAt - j.born); if (latencies.length > 300) latencies.shift(); } }
    const errors = w.stats.error + w.stats.dropped + w.stats.turned;
    if (errors > lastErrors) {
      if (!incident || w.t - incident.last > 10) incident = { start: w.t, last: w.t };
      incident.last = w.t; lastErrors = errors;
    }
    stat("served", w.stats.ok);
    stat("errors", errors);
    stat("p95", latencies.length ? p95(latencies).toFixed(1) + " s" : "–");
    stat("recover", !incident ? "–" : w.t - incident.last < 10 ? L("ongoing", "en curso") : Math.max(1, Math.round(incident.last - incident.start)) + " s");
    const busy = w.sides.blue.workers.filter((x) => x.job).length + w.sides.green.workers.filter((x) => x.job).length;
    stat("running", "6 · " + busy + L(" busy", " ocupados"));
    if (note && w.t < note.until) say(L(note.text));
    else {
      const side = w.sides[w.live];
      say(L(SIDE[w.live].en + " live · queue " + side.queue.length + " · " + busy + " of 6 presses busy",
        SIDE[w.live].es + " en vivo · cola " + side.queue.length + " · " + busy + " de 6 prensas ocupadas"));
    }
  }
  function tell(text) { note = { text, until: w.t + 3 }; say(L(text)); }

  function doFlip() {
    const from = w.live;
    const migrating = w.live === "blue" && w.schema === 1;
    const to = flip(w);
    let en = "flipped to " + SIDE[to].en, es = "cambio a " + SIDE[to].es;
    if (migrating) { en += " · migration ran, schema v2"; es += " · se ejecutó la migración, esquema v2"; }
    if (w.o.draining) { en += " · " + SIDE[from].en + " draining"; es += " · " + SIDE[from].es + " drenando"; }
    else { en += " · " + SIDE[from].en + " cut off"; es += " · " + SIDE[from].es + " cortado"; }
    tell(T(en, es));
    updateFlipButton();
  }
  const flipBtn = act("flip"), redeployBtn = act("redeploy");
  function updateFlipButton() { flipBtn.textContent = w.live === "blue" ? L("Flip to green", "Cambiar a verde") : L("Flip to blue", "Cambiar a azul"); redeployBtn.disabled = w.live === "green"; }
  const redeployed = () => w.o.warm ? T("green redeployed · cache warmed", "verde redesplegado · caché precalentada") : T("green redeployed · cache empty", "verde redesplegado · caché vacía");

  function advance(dt) {
    let left = dt;
    while (left > 1e-9) {
      const d = Math.min(0.02, left); left -= d;
      step(w, d);
      while (script.length && w.t >= script[0][0]) { const [, act] = script.shift(); if (act === "flip") doFlip(); }
    }
    if (w.log.length > 4000) { const cut = w.log.length - 2000; w.log.splice(0, cut); seenLog = Math.max(0, seenLog - cut); }
  }

  const pause = pauseControls(stage, say);
  const clock = WB.loop({ stage, step: (dt) => { advance(dt * speed); paint(dt); }, onPause: pause.onPause });
  pause.bind(clock);
  const pressSeg = WB.pressSeg;
  function set(name, value) {
    if (name === "speed") speed = Number(value);
    else {
      settings[name] = value;
      if (name === "release") w.o.release = value;
      if (name === "draining") w.o.draining = value === "on";
      if (name === "migration") w.o.migration = value;
      if (name === "warm") { w.o.warm = value === "on"; if (prepareGreen(w)) tell(redeployed()); }
    }
    pressSeg(name, value);
  }
  WB.onSegments(set);
  flipBtn.addEventListener("click", () => { doFlip(); if (clock.paused) clock.setPaused(false); });
  redeployBtn.addEventListener("click", () => { if (prepareGreen(w)) tell(redeployed()); });
  act("reset").addEventListener("click", () => { start(); seenLog = 0; tell(T("started over · blue live", "reinicio · azul en vivo")); });

  // ---------- experiments (numbers computed at build time from the same model) ----------
  const secs = (x) => x.toFixed(1) + " s";
  const RUNS = {
    rollback: () => { const r = RESULTS.rollback, top = r.rolling * 1.05; return {
      verdict: T("Errors stopped " + Math.round(r.flip) + " s after the bad flip with blue-green (15 s of it waiting for the alarm), against " + Math.round(r.rolling) + " s with a rolling redeploy. Failed requests: " + Math.round(r.flipErrors) + " against " + Math.round(r.rollingErrors) + ".",
        "Con azul-verde, los errores pararon " + Math.round(r.flip) + " s después del cambio malo (15 s de eso esperando la alarma), contra " + Math.round(r.rolling) + " s con un redespliegue gradual. Solicitudes fallidas: " + Math.round(r.flipErrors) + " contra " + Math.round(r.rollingErrors) + "."),
      bars: [[T("Flip back", "Volver atrás"), r.flip / top, Math.round(r.flip) + " s", true], [T("Rolling redeploy", "Redespliegue gradual"), r.rolling / top, Math.round(r.rolling) + " s"]] }; },
    cost: () => { const r = RESULTS.cost, top = r.blueGreenServers; return {
      verdict: T("Blue-green runs " + r.blueGreenServers + " servers to serve the work of " + r.normal + "; a rolling deploy runs " + r.rollingServers + ". After the flip, the idle side was busy " + pct(r.idleBusy) + " of the time, the live side " + pct(r.liveBusy) + ".",
        "Azul-verde mantiene " + r.blueGreenServers + " servidores para atender el trabajo de " + r.normal + "; un despliegue gradual mantiene " + r.rollingServers + ". Después del cambio, el lado inactivo estuvo ocupado el " + pct(r.idleBusy) + " del tiempo, y el lado en vivo el " + pct(r.liveBusy) + "."),
      bars: [[T("Normal", "Normal"), r.normal / top, String(r.normal)], [T("Rolling", "Gradual"), r.rollingServers / top, String(r.rollingServers)], [T("Blue-green", "Azul-verde"), r.blueGreenServers / top, String(r.blueGreenServers), true]] }; },
    cold: () => { const r = RESULTS.cold, top = Math.max(r.cold.p95, r.warm.p95) * 1.1; return {
      verdict: T("In the 30 s after the flip, p95 latency was " + secs(r.warm.p95) + " with a warm green and " + secs(r.cold.p95) + " with a cold one, and the cold flip turned away about " + Math.round(r.cold.turned) + " requests (warm: " + Math.round(r.warm.turned) + ").",
        "En los 30 s después del cambio, la latencia p95 fue de " + secs(r.warm.p95) + " con un verde precalentado y de " + secs(r.cold.p95) + " con uno frío, y el cambio en frío rechazó unas " + Math.round(r.cold.turned) + " solicitudes (precalentado: " + Math.round(r.warm.turned) + ")."),
      bars: [[T("Before the flip", "Antes del cambio"), r.warm.before / top, secs(r.warm.before)], [T("Warm green", "Verde precalentado"), r.warm.p95 / top, secs(r.warm.p95)], [T("Cold green", "Verde frío"), r.cold.p95 / top, secs(r.cold.p95), true]] }; },
    drain: () => { const r = RESULTS.drain, top = Math.max(r.off, 1) * 1.1; return {
      verdict: T("Without draining, about " + r.off.toFixed(1) + " requests failed at each flip. With draining: " + Math.round(r.on) + ".",
        "Sin drenado, fallaron unas " + r.off.toFixed(1) + " solicitudes en cada cambio. Con drenado: " + Math.round(r.on) + "."),
      bars: [[T("Draining off", "Sin drenado"), r.off / top, r.off.toFixed(1), true], [T("Draining on", "Con drenado"), r.on / top, String(Math.round(r.on))]] }; },
    migration: () => { const r = RESULTS.migration; return {
      verdict: T("After the rollback, blue failed " + pct(r.breaking) + " of requests with the breaking migration, and " + pct(r.compatible) + " with a compatible one.",
        "Después del rollback, azul hizo fallar el " + pct(r.breaking) + " de las solicitudes con la migración incompatible, y el " + pct(r.compatible) + " con una compatible."),
      bars: [[T("Breaking", "Incompatible"), r.breaking, pct(r.breaking), true], [T("Compatible", "Compatible"), r.compatible, pct(r.compatible)]] }; },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const wt = exp.watch;
    for (const name of ["release", "warm", "draining", "migration"]) { settings[name] = wt[name]; pressSeg(name, wt[name]); }
    start(); seenLog = 0;
    script = wt.script.map(([at, act]) => [w.t + at, act]);
    const title = EXPERIMENTS.find((e) => e.id === exp.id).title;
    tell(T("watching: " + title.en, "observando: " + title.es));
    if (clock.paused) clock.setPaused(false);
  } });

  start();
  clock.setPaused(clock.paused);
}

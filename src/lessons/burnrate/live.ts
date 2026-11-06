// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The error-budget tank in the browser: runs the model minute by minute, plots the static alarm's 5-minute rate,
// drains the tank, drips the failures, swings the burn-rate meters and lights whatever is firing.
import { iso, pathOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L } from "../../runtime/wb";
import { playPause, setD } from "../../runtime/dom";
import { rng } from "../../lib/random";
import { makeSim, TIERS, FAULTS, BUDGET, DAY, HOUR, RPM, STATIC } from "./sim";
import { waterSvg } from "./water";

export default function mount({ P, G }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const say = (text) => root.figure.say(text);
  const stat = (key, value) => root.stat(key, value);
  const counters = Object.fromEntries(["staticPages", "day", "left", "pages", "tickets"].map((n) => [n, WB.counter(svg, n, P)]));
  const clock = WB.dial(svg, "clock", P);
  const meters = TIERS.map((_, i) => ({ long: WB.meter(svg, "long" + i, P), short: WB.meter(svg, "short" + i, P) }));
  const trace = q("[data-trace]"), water = q("[data-water]"), drops = q('[data-layer="drops"]');

  const cfg = { fault: "none", blips: "on", static: "0", windows: "multi", speed: 60 };
  const WARM = 2 * DAY;            // each run opens two days in, so the recorder has a day to show
  let model, now, logAt, note, seed = 5, shownLeft = -1, poses = {};

  function restart({ outage = 0 } = {}) {
    model = makeSim({ blips: cfg.blips === "on", staticFor: Number(cfg.static), multi: cfg.windows === "multi" }, seed);
    seed = (Date.now() % 1e6) + 1;
    model.runTo(WARM);
    if (cfg.fault !== "none") model.setFault(FAULTS[cfg.fault]);
    if (outage) model.addFault(FAULTS.outage, outage);
    now = WARM; logAt = model.log.length; note = null; shownLeft = -1;
    for (const d of liveDrops) d.el.remove();
    for (const key of Object.keys(litAt)) delete litAt[key];
    liveDrops.length = 0;
    paint(0);
  }

  // ---------- notes for the readout, from the model's log ----------
  const pctOf = (x) => (x >= 0.1 ? Math.round(100 * x) + "%" : x >= 0.01 ? (100 * x).toFixed(1) + "%" : (100 * x).toFixed(2) + "%");
  // a rate just past the 1% line, with enough decimals that it doesn't print as 1.0%
  const pctOver = (x, line) => { let d = 1; while (d < 3 && Number((100 * x).toFixed(d)) <= 100 * line) d++; return (100 * x).toFixed(d) + "%"; };
  const TIER_EN = ["14.4× over 1 h", "6× over 6 h", "1× over 3 days"], TIER_ES = ["14.4× en 1 h", "6× en 6 h", "1× en 3 días"];
  const SHORT_EN = ["5 min", "30 min", "6 h"], SHORT_ES = SHORT_EN;
  function scanLog() {
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt], multi = model.cfg.multi;
      let text = null, rank = 1;
      if (e.type === "blip") text = L("blip: " + pctOf(e.rate) + " of requests failing for " + e.mins + " min", "pico: falla el " + pctOf(e.rate) + " de las solicitudes durante " + e.mins + " min");
      if (e.type === "static") { rank = 2; const r = pctOver(model.ratio(STATIC.window, e.t + 1), STATIC.threshold); text = L("static alarm pages: 5-min error rate " + r + ", over 1%", "la alarma fija avisa: tasa de error de 5 min " + r + ", sobre 1%"); }
      if (e.type === "page") { rank = 3; text = L("burn-rate page: " + TIER_EN[e.tier] + (multi ? " and over " + SHORT_EN[e.tier] : "") + " · " + pctOf(model.used(e.t + 1)) + " of the budget spent",
        "aviso por tasa de consumo: " + TIER_ES[e.tier] + (multi ? " y en " + SHORT_ES[e.tier] : "") + " · gastado el " + pctOf(model.used(e.t + 1)) + " del presupuesto"); }
      if (e.type === "page-off") { rank = 2; text = L("burn-rate page clears", "el aviso por tasa de consumo se cierra"); }
      if (e.type === "ticket") { rank = 3; text = L("ticket: " + TIER_EN[2] + (multi ? " and over 6 h" : "") + " · " + pctOf(model.used(e.t + 1)) + " of the budget spent", "ticket: " + TIER_ES[2] + (multi ? " y en 6 h" : "") + " · gastado el " + pctOf(model.used(e.t + 1)) + " del presupuesto"); }
      if (text && (!note || rank >= note.rank || performance.now() - note.at > 1200)) note = { text, rank, at: performance.now() };
    }
  }

  // ---------- the recorder: the 5-minute rate over the last 24 hours, one point per 6 minutes (the bin's peak) ----------
  const C = G.CHART, BIN = 6, BINS = (C.hours * HOUR) / BIN;
  const at = (x, z) => iso([x, C.y, z], P);
  function drawTrace() {
    const t = model.t, pts = [];
    for (let b = 0; b < BINS; b++) {
      const end = t - (BINS - 1 - b) * BIN;
      let peak = 0;
      for (let m = Math.max(1, end - BIN + 1); m <= end; m++) peak = Math.max(peak, model.ratio(STATIC.window, m));
      const x = C.x0 + ((C.x1 - C.x0) * (b + 0.5)) / BINS;
      pts.push(at(x, C.z0 + (C.z1 - C.z0) * Math.min(1, peak / C.max)));
    }
    setD(trace, pathOf(pts));
  }

  // ---------- drops from the spout: more failures, more drops (capped) ----------
  const liveDrops = [], jitter = rng(9);
  let dropDebt = 0;
  function drip(dt) {
    const failsPerSec = model.rate.length ? model.rate[model.rate.length - 1] * RPM * cfg.speed : 0;
    dropDebt += dt * Math.min(14, 0.4 * Math.sqrt(failsPerSec));
    while (dropDebt >= 1 && liveDrops.length < 24) {
      dropDebt -= 1;
      const el = document.createElementNS(NS, "circle");
      el.setAttribute("class", "br-drop");
      el.setAttribute("r", String(1.1 * P.scale));
      drops.appendChild(el);
      liveDrops.push({ el, age: 0, dx: (jitter() - 0.5) * 0.8 });
    }
    if (dropDebt > 1) dropDebt = 1;
    const [sx, sy, sz] = G.SPOUT;
    for (let i = liveDrops.length - 1; i >= 0; i--) {
      const d = liveDrops[i];
      d.age += dt;
      const z = sz - 0.5 - 40 * d.age * d.age;
      if (z <= 0.9) { d.el.remove(); liveDrops.splice(i, 1); continue; }
      const [x, y] = iso([sx + d.dx, sy + 0.6, z], P);
      d.el.setAttribute("cx", x.toFixed(1)); d.el.setAttribute("cy", y.toFixed(1));
    }
  }

  function pose(name, key) { if (poses[name] !== key) { poses[name] = key; WB.pose(svg, name, key); } }
  // An alarm can fire for a single model minute, a few hundredths of a second at 6 h/s: each lamp and the pager stay
  // lit 2.6 s of page time after they were last on, as long as the readout keeps the alarm's message.
  const HOLD = 2600, litAt = {};
  function held(name, on) { const w = performance.now(); if (on) litAt[name] = w; return on || w - (litAt[name] ?? -1e9) < HOLD; }

  function paint(dt) {
    scanLog();
    const st = model.st, t = model.t;
    drawTrace();
    drip(dt);
    const left = 1 - model.used();
    if (Math.abs(left - shownLeft) > 0.002) { shownLeft = left; water.innerHTML = waterSvg(P, G.GLASS, left); }
    TIERS.forEach((tier, i) => {
      meters[i].long.set(model.burn(tier.long) / (2 * tier.burn));
      meters[i].short.set(model.burn(tier.short) / (2 * tier.burn));
      pose("lamp-tier" + i, held("tier" + i, st.tiers[i]) ? "on" : "off");
    });
    pose("lamp-static", held("static", st.staticOn) ? "on" : "off");
    pose("engineer", held("engineer", st.staticOn || st.page) ? "paged" : "idle");
    const day = Math.floor(t / DAY), mins = t % DAY;
    clock.set(mins / DAY);
    counters.staticPages.setClamped(st.staticPages); counters.pages.setClamped(st.pages); counters.tickets.setClamped(st.tickets);
    counters.day.setClamped(day); counters.left.setClamped(Math.round(100 * Math.max(0, left)));
    stat("day", day + " · " + String(Math.floor(mins / 60)).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0"));
    stat("left", left >= 0 ? Math.round(100 * left) + "%" : L("0% (" + Math.round(-100 * left) + "% over)", "0% (" + Math.round(-100 * left) + "% de más)"));
    stat("burn", model.burn(HOUR).toFixed(1) + "×");
    stat("staticPages", st.staticPages); stat("pages", st.pages); stat("tickets", st.tickets);
    if (note && performance.now() - note.at < 2600) say(note.text);
    else {
      const r5 = model.ratio(STATIC.window);
      say(L("day " + day + " · " + pctOf(r5) + " failing (5 min) · burn " + model.burn(HOUR).toFixed(1) + "× (1 h) · budget left " + Math.round(100 * Math.max(0, left)) + "%",
        "día " + day + " · falla el " + pctOf(r5) + " (5 min) · consumo " + model.burn(HOUR).toFixed(1) + "× (1 h) · presupuesto restante " + Math.round(100 * Math.max(0, left)) + "%"));
    }
  }

  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => { now += dt * cfg.speed; model.runTo(Math.floor(now)); paint(dt); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = String(raw);
    if (name === "fault") { model.setFault(FAULTS[cfg.fault]); return; }
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    blip: () => { if (model.blipNow()) wake(); },
    outage: () => { model.addFault(FAULTS.outage, 10); note = { text: L("a bad deploy: every request fails for 10 minutes", "un despliegue malo: fallan todas las solicitudes durante 10 minutos"), rank: 3, at: performance.now() }; wake(); },
    reset: () => restart(),
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const k of ["blips", "static", "windows", "fault"]) set(k, w[k], true);
    set("speed", String(w.speed));
    restart({ outage: w.outage || 0 });
    if (w.outage) note = { text: L("a bad deploy: every request fails for " + w.outage + " minutes", "un despliegue malo: fallan todas las solicitudes durante " + w.outage + " minutos"), rank: 3, at: performance.now() };
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

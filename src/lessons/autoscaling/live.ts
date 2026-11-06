// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The service floor in the browser: runs the model, eases customers and workers toward where it has them, turns the
// autoscaler's dials and counters, and answers the controls. mount() gets the build-time data from page.ts.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { playPause, show, setText } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { makeFloor, SYNC, MAX_R } from "./sim";

export default function mount({ P, G, CUST_SVG, WALKER_SVG, DESK_WORKER_SVG, NEWCOMER_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const say = (text) => root.figure.say(text);
  const NS = "http://www.w3.org/2000/svg";
  const layers = { back: q('[data-layer="back"]'), row0: q('[data-layer="row0"]'), row1: q('[data-layer="row1"]'), row2: q('[data-layer="row2"]') };
  const idx = Array.from({ length: MAX_R }, (_, i) => i);
  const plots = idx.map((i) => q('[data-plot="' + i + '"]'));
  const desks = idx.map((i) => q('[data-desk="' + i + '"]'));
  const workers = idx.map((i) => q('[data-worker="' + i + '"]'));
  const newcomers = idx.map((i) => q('[data-new="' + i + '"]'));
  const deskMeters = idx.map((i) => WB.meter(svg, "m" + i, P));
  const counters = Object.fromEntries(["waiting", "gaveup", "ready", "starting", "wanted", "queries", "served"].map((n) => [n, WB.counter(svg, n, P)]));
  const readDial = WB.dial(svg, "reading", P), checkDial = WB.dial(svg, "check", P), slowMeter = WB.meter(svg, "slow", P);
  const targets = qa("[data-target]"), words = qa("[data-metric-word]");
  const gaveBox = q('[data-counter="gaveup"] .iso-solid');
  const moreText = q("[data-more]"), dbOn = q('[data-db="on"]'), dbOff = q('[data-db="off"]');
  // each desk's worker and newcomer: one drawing each, placed at the desk
  idx.forEach((i) => {
    workers[i].innerHTML = DESK_WORKER_SVG; workers[i].setAttribute("transform", translateAlong(P, G.WORKER[i]));
    newcomers[i].innerHTML = NEWCOMER_SVG; newcomers[i].setAttribute("transform", translateAlong(P, G.SIDE[i]));
  });
  const slips = idx.map((i) => workers[i].querySelector("[data-slip]"));
  const poses = idx.map(() => "");

  // where a moving thing is drawn: behind the desks of the first row whose desks are not behind it
  function layerFor(y) {
    let r = -1;
    for (let k = 0; k < G.ROWS.length; k++) if (y >= G.ROWS[k] - G.DESK_D - 0.5) r = k;
    return r < 0 ? "back" : "row" + r;
  }

  // ---------- pooled moving elements: customers and workers walking home ----------
  const free = { cust: [], walker: [] };
  function makeEl(kind) {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = kind === "cust" ? CUST_SVG : WALKER_SVG;
    return { g, kind, bodies: [...g.querySelectorAll("[data-body]")], lit: false };
  }
  const recs = new Map();        // key -> { el, pos, target, layer, leaving, until, fadeIn }
  function take(kind) { return free[kind].pop() || makeEl(kind); }
  function drop(key) { const r = recs.get(key); r.el.g.remove(); r.el.g.style.opacity = ""; setLitEl(r.el, false); free[r.el.kind].push(r.el); recs.delete(key); }
  function setLitEl(el, on) {
    if (el.lit === on) return;
    el.lit = on;
    for (const b of el.bodies) { b.toggleAttribute("data-lit", on); b.toggleAttribute("data-lit-fill", on); }
  }

  const cfg = { traffic: "spike", startup: "45", target: "0.6", window: "300", min: "2", metric: "cpu", db: "app", speed: 1 };
  const WARM = 90;     // the first frame shows the floor half a minute into a spike
  let model, clock, logAt, lastEvent, note, lastScale, lastGaveUp, seed = 5, prevSlot, prevState;

  function modelCfg() {
    const db = cfg.db === "db";
    return { traffic: cfg.traffic, target: Number(cfg.target), window: Number(cfg.window), startup: Number(cfg.startup), minR: Number(cfg.min), metric: cfg.metric, db, peak: db ? 5 : 7 };
  }

  function restart(warm = WARM) {
    for (const key of [...recs.keys()]) drop(key);
    model = makeFloor(modelCfg(), seed);
    seed = (Date.now() % 1e6) + 1;
    clock = warm; logAt = 0; lastEvent = new Map(); note = null; lastScale = -9; lastGaveUp = -9;
    model.runTo(clock);
    logAt = model.log.length;
    prevSlot = model.slots.map((p) => (p ? p.id : 0));
    prevState = model.slots.map((p) => (p ? p.state : null));
    targets.forEach((el) => show(el, el.getAttribute("data-target") === String(Number(cfg.target))));
    words.forEach((el) => show(el, el.getAttribute("data-metric-word") === cfg.metric));
    show(dbOn, cfg.db === "db"); show(dbOff, cfg.db !== "db");
    paint(0, true);
  }

  const pctOf = (x) => Math.round(100 * x) + "%";
  const metricName = () => (cfg.metric === "busy" ? T("busy", "ocupados") : T("CPU", "CPU"));
  function scanLog() {
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt];
      if (e.id !== undefined) lastEvent.set(e.id, e.type);
      if (e.type === "timeout") lastGaveUp = e.t;
      if (e.type === "up" || e.type === "down") {
        lastScale = e.t;
        const m = L(metricName());
        note = { t: e.t, text: e.type === "up"
          ? T("check: " + m + " " + pctOf(e.reading) + " vs target " + pctOf(Number(cfg.target)) + " → wants " + e.to + " (had " + e.from + ") · new ones start", "revisión: " + m + " " + pctOf(e.reading) + " vs objetivo " + pctOf(Number(cfg.target)) + " → desea " + e.to + " (había " + e.from + ") · los nuevos arrancan")
          : T("check: " + m + " " + pctOf(e.reading) + " → down to " + e.to + " (had " + e.from + ")", "revisión: " + m + " " + pctOf(e.reading) + " → baja a " + e.to + " (había " + e.from + ")") };
      }
      if (e.type === "check" && e.desired === e.was && e.reading < Number(cfg.target) * 0.9 && e.was > model.minAt(e.t) && Number(cfg.window) > 0 && (!note || e.t - note.t > 6)) {
        note = { t: e.t, text: T("check: " + L(metricName()) + " " + pctOf(e.reading) + " · the window keeps " + e.was + " (most wanted in the last " + cfg.window + " s)", "revisión: " + L(metricName()) + " " + pctOf(e.reading) + " · la ventana mantiene " + e.was + " (el máximo deseado en los últimos " + cfg.window + " s)") };
      }
      if (e.type === "spike") note = { t: e.t, text: T("spike: " + e.rate + " customers a second for " + e.secs / 60 + " minutes", "pico: " + e.rate + " clientes por segundo durante " + e.secs / 60 + " minutos") };
    }
  }

  const ease = lerp;
  function place(key, kind, pos, lit, fromEntry) {
    let r = recs.get(key);
    if (!r) {
      r = { el: take(kind), pos: fromEntry ? [...G.ENTRY] : [...pos], layer: null, fadeIn: fromEntry ? performance.now() : 0 };
      recs.set(key, r);
    }
    r.target = pos; r.leaving = false; r.seen = true;
    setLitEl(r.el, lit);
    return r;
  }

  function paint(dt, snap) {
    scanLog();
    const now = performance.now();
    for (const r of recs.values()) r.seen = false;
    // the line: the first LINE slots, and "+N" on the gate for the rest
    const line = model.line;
    setText(moreText, line.length > G.LINE.length ? "+" + (line.length - G.LINE.length) : "");
    for (let i = 0; i < Math.min(line.length, G.LINE.length); i++) {
      const c = line[i];
      place("c" + c.id, "cust", G.LINE[i], false, clock - c.born < 1.5 && !snap);
    }
    // customers at desks
    for (const p of model.pods) if (p.req && p.slot >= 0) place("c" + p.req.id, "cust", G.SEAT[p.slot], false, false);
    // workers sent home: walk from their desk to the staff room
    model.slots.forEach((p, i) => {
      const id = p ? p.id : 0;
      if (prevSlot[i] && prevSlot[i] !== id && !snap) {
        const r = place("w" + prevSlot[i], "walker", G.STAFF, false, false);
        r.pos = [...(prevState[i] === "starting" ? G.SIDE[i] : G.WORKER[i])]; r.leaving = true; r.until = now + 1600; r.walk = true;
      }
      prevSlot[i] = id; prevState[i] = p ? p.state : null;
    });
    // customers who left the model's view: out through the exit if served, gone in place (lit) if they gave up
    for (const [key, r] of recs) {
      if (r.seen) continue;
      if (!r.leaving) {
        r.leaving = true;
        if (r.el.kind === "cust" && lastEvent.get(Number(key.slice(1))) === "timeout") { r.until = now + 1100; r.target = [r.pos[0] - 3, r.pos[1], r.pos[2]]; setLitEl(r.el, true); }
        else { r.until = now + 900; r.target = [G.EXIT_X, Math.max(G.EXIT_Y[0], Math.min(G.EXIT_Y[1], r.pos[1])), 0]; }
      }
      if (snap || now > r.until) drop(key);
    }

    // move everything toward its target
    const f = snap ? 1 : 1 - Math.exp(-dt * (cfg.speed > 3 ? 14 : 8));
    const byLayer = { back: [], row0: [], row1: [], row2: [] };
    for (const r of recs.values()) {
      const [tx, ty, tz] = r.target;
      const k = r.walk ? 1 - Math.exp(-dt * 2.2) : f;
      r.pos[0] = ease(r.pos[0], tx, k); r.pos[1] = ease(r.pos[1], ty, k); r.pos[2] = ease(r.pos[2], tz, k);
      r.el.g.setAttribute("transform", translateAlong(P, r.pos));
      let o = 1;
      if (r.leaving) o = Math.max(0, Math.min(1, (r.until - now) / 500));
      if (r.fadeIn) o = Math.min(o, Math.max(0, (now - r.fadeIn) / 400));
      r.el.g.style.opacity = o < 1 ? String(o) : "";
      const layer = layerFor(r.pos[1]);
      if (r.layer !== layer) { r.layer = layer; layers[layer].appendChild(r.el.g); }
      byLayer[layer].push(r);
    }
    // painter's order inside each layer: far first
    for (const [name, list] of Object.entries(byLayer)) {
      if (list.length < 2) continue;
      list.sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P));
      let prev = null, inOrder = true;
      for (const r of list) { if (prev && r.el.g.previousElementSibling !== prev) { inOrder = false; break; } prev = r.el.g; }
      if (!inOrder) for (const r of list) layers[name].appendChild(r.el.g);
    }

    // desks and workers
    let ready = 0, starting = 0, sum = 0, n = 0;
    for (const p of model.pods) { if (p.state === "starting") starting++; else if (p.state !== "draining") ready++; }
    idx.forEach((i) => {
      const p = model.slots[i];
      show(plots[i], !p);
      show(desks[i], !!p);
      show(newcomers[i], !!p && p.state === "starting");
      show(workers[i], !!p && p.state !== "starting");
      if (p && p.state !== "starting") {
        const pose = p.req && p.req.phase === "db" ? "db" : "ready";
        if (poses[i] !== pose) { poses[i] = pose; show(slips[i], pose === "db"); }
        const rd = model.readingOf(p);
        deskMeters[i].set(rd ?? 0);
        if (rd !== null && p.state === "ready") { sum += rd; n++; }
      } else deskMeters[i].set(0);
    });
    const reading = n ? sum / n : 0;
    readDial.set(reading);
    checkDial.set(Math.max(0, Math.min(1, (model.nextCheck - clock) / SYNC)));
    const out = clock - lastGaveUp < 2;
    if (gaveBox) { gaveBox.toggleAttribute("data-lit", out); gaveBox.toggleAttribute("data-lit-fill", out); }
    const st = model.st;
    slowMeter.set((st.slow - 1) / (G.SLOW_MAX - 1));

    // counters, stats, readout
    const wanted = st.desired || model.pods.filter((p) => p.state !== "draining").length;
    counters.waiting.setClamped(line.length); counters.gaveup.setClamped(st.timedOut); counters.served.setClamped(st.served);
    counters.ready.set(ready); counters.starting.set(starting); counters.wanted.set(wanted); counters.queries.set(st.queries);
    stat("pods", ready + " / " + starting);
    stat("wanted", wanted);
    stat("reading", L(metricName()) + " " + pctOf(reading));
    stat("waiting", line.length);
    stat("gaveup", st.timedOut);
    stat("podmin", Math.round(st.podSecs / 60));
    if (note && clock - note.t < 4) say(L(note.text));
    else {
      const rate = model.rate();
      const first = model.pods.filter((p) => p.state === "starting").reduce((a, p) => Math.min(a, p.readyAt - clock), Infinity);
      const tail = starting ? L(" · first ready in " + Math.max(0, Math.ceil(first)) + " s", " · el primero listo en " + Math.max(0, Math.ceil(first)) + " s") : "";
      say(L(rate.toFixed(1) + " a second · " + ready + " ready, " + starting + " starting · " + line.length + " waiting" + tail,
        rate.toFixed(1) + " por segundo · " + ready + " listos, " + starting + " arrancando · " + line.length + " en espera" + tail));
    }
  }
  const stat = (key, value) => root.stat(key, value);

  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(dt); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = String(raw);
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));
  const actions = {
    spike: () => { model.spikeNow(180, cfg.db === "db" ? 5 : 7); scanLog(); if (loop.paused) loop.setPaused(false); },
    reset: () => restart(),
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const name of ["traffic", "startup", "target", "window", "min", "metric", "db"]) set(name, w[name], true);
    set("speed", String(w.speed || 1));
    // start inside the action: 15 s into the spike, or 10 s into a lull of the swings, so the outcome shows within seconds
    restart(w.traffic === "bursts" ? 130 : 75);
    if (loop.paused) loop.setPaused(false);
  });

  loop.setPaused(loop.paused);
  restart();
}

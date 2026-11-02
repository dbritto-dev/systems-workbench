// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The railway junction in the browser: runs the deploy model, sends its orders down the tracks as trains, moves the
// lever, the pusher and the console needles, wires the controls and the experiment cards. mount() gets the
// build-time data from page.ts (geometry, experiment results).
import { translateAlong, lineOnTop } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats, act, pauseControls } from "../../runtime/dom";
import { easeInOutCubic as ease } from "../../lib/tween";
import { pct as pctOf } from "../../lib/format";
import { rng } from "../../lib/random";
import { INTERVAL, RULES, newDeploy, canaryFailures, canaryRate, hitCount, decide, advance, lengthOf as pathLength, pointAt as pathPoint } from "./sim";

export default function mount({ P, G, RESULTS, EXPERIMENTS }) {
  const LEN = { old: pathLength(G.PATHS.old), new: pathLength(G.PATHS.new) };
  const DERAIL_S = pathLength([[-170, 0], [-104, 0], [-64, G.NEW_Y]]) + (G.DERAIL_X + 64);
  const SPEED = 62, HEADWAY = 31;

  const stage = document.querySelector("[data-office]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const say = readout();
  const stat = stats();
  const layers = { old: q('[data-layer="old"]'), new: q('[data-layer="new"]') };
  const pools = { old: [...layers.old.querySelectorAll("[data-train]")], new: [...layers.new.querySelectorAll("[data-train]")] };
  pools.new.forEach((el) => el.querySelectorAll(".iso-solid").forEach((s) => s.setAttribute("data-lit", "")));
  const handle = q("[data-handle]"), pusher = q("[data-pusher]"), pusherSolid = pusher.querySelector(".iso-solid");
  const needles = { old: q('[data-needle="old"]'), new: q('[data-needle="new"]'), timer: q('[data-needle="timer"]') }, thresholdTick = q("[data-threshold]");

  const cfg = { pct: 5, build: "good", auto: "on", rule: "normal", routing: "random", check: "errors", speed: 1 };
  let random = rng(Date.now() % 1e6 + 1);
  let d = null;
  let waiting = [], trains = [], handleX = 0, pusherX = G.PUSHER_PARK, push = null, promoteAt = null;
  const notchX = (pct) => -140 + Math.max(0, G.NOTCHES.indexOf(pct)) * 17;
  const DECISION = { watching: T("watching", "observando"), "rolled back": T("rolled back", "revertida"), promoted: T("promoted", "promovida") };

  function deploy() {
    d = newDeploy({ pct: cfg.pct, build: cfg.build, auto: cfg.auto === "on", rule: cfg.rule, routing: cfg.routing, check: cfg.check });
    waiting = []; promoteAt = null;
    push = null; pusherX = G.PUSHER_PARK; pusherSolid.removeAttribute("data-lit");
    handleX = notchX(d.pct);
    draw(); showStats();
  }

  function spawn(r) { if (waiting.length < 6) waiting.push(r); }
  function launch() {
    if (!waiting.length) return;
    const lastOnMain = trains.filter((t) => t.s < 90).reduce((m, t) => Math.min(m, t.s), Infinity);
    if (lastOnMain < HEADWAY) return;
    const r = waiting.shift();
    const track = r.canary ? "new" : "old";
    const el = pools[track].find((e) => !e.dataset.busy);
    if (!el) return;
    el.dataset.busy = "1";
    el.querySelector("[data-crate]").style.display = r.wrong ? "none" : "";
    trains.push({ el, track, s: 0, failed: r.failed, off: 0, gone: 0 });
  }
  function moveTrains(dt) {
    for (const t of trains) {
      const end = LEN[t.track] - 10;
      if (t.failed && t.s >= DERAIL_S) { t.off = Math.min(1, t.off + dt / 0.9); }
      else if (t.s >= end) { t.gone = Math.min(1, t.gone + dt / 0.5); }
      else t.s = Math.min(end, t.s + SPEED * dt);
      const [x, y] = pathPoint(G.PATHS[t.track], t.s);
      const e = ease(t.off);
      t.el.setAttribute("transform", translateAlong(P, [x, y + 13 * e, -2 * e]));
      const fadeIn = Math.min(1, t.s / 10);
      t.el.style.opacity = String(Math.max(0, fadeIn * (1 - t.off) * (1 - t.gone)));
    }
    trains = trains.filter((t) => { const done = t.off >= 1 || t.gone >= 1; if (done) { delete t.el.dataset.busy; t.el.style.opacity = "0"; } return !done; });
  }

  function onEvent(kind) {
    if (kind === "rolled back") { push = { phase: 0, t: 0 }; pusherSolid.setAttribute("data-lit", ""); WB.pressSeg("pct", 0); }
  }

  function advanceAll(dt) {
    advance(d, dt, random, spawn, onEvent);
    if (promoteAt !== null && d.t >= promoteAt && d.decision === "watching") { decide(d, "promoted"); WB.pressSeg("pct", 100); }
    launch();
    moveTrains(dt);
  }

  function animateLever(dtReal) {
    const target = notchX(d.pct);
    if (push) {
      push.t += dtReal;
      if (push.phase === 0) { pusherX += (handleX + 8 - pusherX) * Math.min(1, dtReal / 0.12); if (Math.abs(pusherX - (handleX + 8)) < 0.3 || push.t > 0.8) { push.phase = 1; push.t = 0; push.from = handleX; } }
      else { const k = ease(Math.min(1, push.t / 0.9)); handleX = push.from + (target - push.from) * k; pusherX = handleX + 8; if (push.t >= 0.9) push.phase = 2; }
    } else {
      handleX += (target - handleX) * Math.min(1, dtReal / 0.15);
      pusherX += (G.PUSHER_PARK - pusherX) * Math.min(1, dtReal / 0.15);
    }
    handle.setAttribute("transform", translateAlong(P, [handleX, 0, 0]));
    pusher.setAttribute("transform", translateAlong(P, [pusherX, 0, 0]));
  }

  const angleFor = (rate) => G.SWEEP.from + G.SWEEP.span * Math.min(1, rate / 0.02);
  const needle = (c, a, len) => lineOnTop([c[0] - Math.sin(a) * 1.8, c[1] + Math.cos(a) * 1.8], [c[0] + Math.sin(a) * len, c[1] - Math.cos(a) * len], G.DIAL_TOP + 0.2, P);
  function draw() {
    const oldRate = d.old.req ? d.old.err / d.old.req : 0;
    needles.old.setAttribute("d", needle(G.DIALS.old, angleFor(oldRate), G.DIAL_R - 3));
    needles.new.setAttribute("d", needle(G.DIALS.new, angleFor(canaryRate(d)), G.DIAL_R - 3));
    const ta = angleFor(RULES[cfg.rule].threshold), c = G.DIALS.new, r0 = G.DIAL_R - 3.6, r1 = G.DIAL_R - 1.7;
    thresholdTick.setAttribute("d", lineOnTop([c[0] + Math.sin(ta) * r0, c[1] - Math.cos(ta) * r0], [c[0] + Math.sin(ta) * r1, c[1] - Math.cos(ta) * r1], G.DIAL_TOP + 0.2, P));
    const tc = ((d.t % INTERVAL) / INTERVAL) * Math.PI * 2;
    needles.timer.setAttribute("d", needle(G.DIALS.timer, tc, G.DIAL_R - 3));
  }

  const pctText = (x) => (100 * x).toFixed(x < 0.1 ? 1 : 0) + "%";
  function showStats() {
    stat("old", d.old.req + " · " + d.old.err);
    stat("new", d.nw.req + " · " + d.nw.err);
    stat("wrong", d.nw.wrong);
    stat("hit", hitCount(d));
    stat("mixed", d.mixed);
    stat("decision", L(DECISION[d.decision] || d.decision));
    const fails = canaryFailures(d);
    const left = Math.ceil(INTERVAL - (d.t % INTERVAL));
    let text;
    if (d.decision === "rolled back") text = T("rolled back · " + fails + " failures in " + d.nw.req + " canary orders", "revertida · " + fails + " fallos en " + d.nw.req + " pedidos canario");
    else if (d.decision === "promoted") text = T("promoted · every order on the new build", "promovida · todos los pedidos en la versión nueva");
    else if (promoteAt !== null && d.decision === "watching" && d.pct > 0) text = T("canary " + d.pct + "% · " + fails + " failed, " + d.nw.wrong + " wrong prices · promote in " + Math.max(0, Math.ceil(promoteAt - d.t)) + " s", "canario " + d.pct + "% · " + fails + " fallidos, " + d.nw.wrong + " precios erróneos · se promueve en " + Math.max(0, Math.ceil(promoteAt - d.t)) + " s");
    else if (d.pct === 0) text = T("canary at 0% · nothing to watch", "canario en 0% · nada que vigilar");
    else text = T("canary " + d.pct + "% · " + fails + " of " + d.nw.req + " failed (" + pctText(canaryRate(d)) + ") · check in " + left + " s" + (d.auto ? "" : " · arm off"), "canario " + d.pct + "% · " + fails + " de " + d.nw.req + " fallidos (" + pctText(canaryRate(d)) + ") · revisión en " + left + " s" + (d.auto ? "" : " · brazo apagado"));
    say(L(text));
  }

  // ---------- controls ----------
  const pause = pauseControls(stage, say);
  const clock = WB.loop({
    stage,
    step: (dt) => {
      const sim = dt * cfg.speed, steps = Math.ceil(sim / 0.05);
      for (let i = 0; i < steps; i++) advanceAll(sim / steps);
      animateLever(dt); draw(); showStats();
    },
    onPause: pause.onPause,
  });
  pause.bind(clock);
  const pressSeg = WB.pressSeg;
  function set(name, raw) {
    if (name === "speed") { cfg.speed = Number(raw); pressSeg(name, raw); return; }
    cfg[name] = name === "pct" ? Number(raw) : raw;
    pressSeg(name, raw);
    if (name === "pct") {
      if (d.decision !== "watching") deploy();
      else { d.pct = cfg.pct; push = null; pusherSolid.removeAttribute("data-lit"); }
      return;
    }
    if (name === "build" || name === "routing") { deploy(); return; }
    if (name === "auto") d.auto = raw === "on";
    if (name === "rule") d.rule = raw;
    if (name === "check") d.check = raw;
    draw(); showStats();
  }
  WB.onSegments(set);
  act("promote").addEventListener("click", () => { decide(d, "promoted"); push = null; pressSeg("pct", 100); showStats(); });
  act("rollback").addEventListener("click", () => { if (d.decision === "watching") { decide(d, "rolled back"); onEvent("rolled back"); showStats(); } });
  act("reset").addEventListener("click", () => { if (cfg.pct === 0) { cfg.pct = 5; pressSeg("pct", 5); } deploy(); });

  // ---------- experiments (numbers computed at build time from the same model) ----------
  const minutes = (s) => (s >= 5400 ? (s / 3600).toFixed(1) + " h" : Math.round(s / 60) + " min");
  const RUNS = {
    blast: () => {
      const { a, b } = RESULTS.blast, top = Math.max(a.hit, b.hit) * 1.1;
      return { verdict: T("Failed orders before rollback: " + a.hit.toFixed(1) + " at 25% (caught in " + minutes(a.time) + "), " + b.hit.toFixed(1) + " at 1% (caught in " + minutes(b.time) + ").", "Pedidos fallidos antes de la reversión: " + a.hit.toFixed(1) + " con 25% (detectada en " + minutes(a.time) + "), " + b.hit.toFixed(1) + " con 1% (detectada en " + minutes(b.time) + ")."), bars: [[T("25% canary", "Canario 25%"), a.hit / top, a.hit.toFixed(1)], [T("1% canary", "Canario 1%"), b.hit / top, b.hit.toFixed(1), true]] };
    },
    rare: () => {
      const { a, b } = RESULTS.rare, top = Math.max(a, b) * 1.1;
      return { verdict: T("Time until the arm rolls it back: " + minutes(a) + " at 10%, " + minutes(b) + " at 1%. A 30-minute bake would have promoted it either way.", "Tiempo hasta que el brazo la revierte: " + minutes(a) + " con 10%, " + minutes(b) + " con 1%. Con 30 minutos de observación se habría promovido en ambos casos."), bars: [[T("10% canary", "Canario 10%"), a / top, minutes(a)], [T("1% canary", "Canario 1%"), b / top, minutes(b), true], [T("30-minute bake", "Observación de 30 min"), 1800 / top, "30 min"]] };
    },
    tight: () => {
      const { a, b } = RESULTS.tight;
      return { verdict: T("A good build was rolled back in " + pctOf(b) + " of deploys with the tight rule, " + pctOf(a) + " with the normal one.", "Una versión buena se revirtió en el " + pctOf(b) + " de los despliegues con la regla estricta y en el " + pctOf(a) + " con la estándar."), bars: [[T("Normal rule", "Regla estándar"), a, pctOf(a)], [T("Tight rule", "Regla estricta"), b, pctOf(b), true]] };
    },
    sticky: () => {
      const { a, b } = RESULTS.sticky;
      return { verdict: T(pctOf(a) + " of users saw both versions with per-request routing, " + pctOf(b) + " with per-user routing.", "El " + pctOf(a) + " de los usuarios vio ambas versiones con enrutamiento por solicitud y el " + pctOf(b) + " con enrutamiento por usuario."), bars: [[T("Per request", "Por solicitud"), a, pctOf(a), true], [T("Per user", "Por usuario"), b, pctOf(b)]] };
    },
    silent: () => {
      const { a, b } = RESULTS.silent, top = Math.max(a.n, b.n) * 1.05;
      return { verdict: T("Watching failures only: " + Math.round(a.n) + " wrong-price orders, promoted in " + pctOf(a.promoted) + " of runs. Watching prices too: " + Math.round(b.n) + ", rolled back within minutes.", "Vigilando solo fallos: " + Math.round(a.n) + " pedidos con precio erróneo, promovida en el " + pctOf(a.promoted) + " de las ejecuciones. Vigilando también los precios: " + Math.round(b.n) + ", revertida en minutos."), bars: [[T("Failures only", "Solo fallos"), a.n / top, String(Math.round(a.n)), true], [T("Failures + prices", "Fallos + precios"), b.n / top, String(Math.round(b.n))]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    for (const name of ["pct", "build", "auto", "rule", "routing", "check", "speed"]) { cfg[name] = name === "pct" || name === "speed" ? Number(w[name]) : w[name]; pressSeg(name, w[name]); }
    deploy();
    if (exp.id === "silent") promoteAt = 1800;
    if (clock.paused) clock.setPaused(false);
  } });

  deploy(); clock.setPaused(clock.paused);
}

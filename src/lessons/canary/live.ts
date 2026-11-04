// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The railway junction in the browser: runs the deploy model, sends its orders down the tracks as trains, moves the
// lever, the pusher and the console needles, and answers the controls. mount() gets the build-time data from
// page.ts (geometry) and root, the <wb-lesson>.
import { translateAlong, lineOnTop } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { playPause } from "../../runtime/dom";
import { easeInOutCubic as ease } from "../../lib/tween";
import { pctTenths } from "../../lib/format";
import { rng } from "../../lib/random";
import { INTERVAL, RULES, newDeploy, canaryFailures, canaryRate, hitCount, decide, advance } from "./sim";
import { polylineLength, pointAlong } from "../../lib/geometry";

export default function mount({ P, G }, root) {
  const LEN = { old: polylineLength(G.PATHS.old), new: polylineLength(G.PATHS.new) };
  const DERAIL_S = polylineLength([[-170, 0], [-104, 0], [-64, G.NEW_Y]]) + (G.DERAIL_X + 64);
  const SPEED = 62, HEADWAY = 31;

  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const stat = (key, value) => root.stat(key, value);
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
      const [x, y] = pointAlong(G.PATHS[t.track], t.s);
      const e = ease(t.off);
      t.el.setAttribute("transform", translateAlong(P, [x, y + 13 * e, -2 * e]));
      const fadeIn = Math.min(1, t.s / 10);
      t.el.style.opacity = String(Math.max(0, fadeIn * (1 - t.off) * (1 - t.gone)));
    }
    trains = trains.filter((t) => { const done = t.off >= 1 || t.gone >= 1; if (done) { delete t.el.dataset.busy; t.el.style.opacity = "0"; } return !done; });
  }

  function onEvent(kind) {
    if (kind === "rolled back") { push = { phase: 0, t: 0 }; pusherSolid.setAttribute("data-lit", ""); root.press("pct", 0); }
  }

  function advanceAll(dt) {
    advance(d, dt, random, spawn, onEvent);
    if (promoteAt !== null && d.t >= promoteAt && d.decision === "watching") { decide(d, "promoted"); root.press("pct", 100); }
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
    else text = T("canary " + d.pct + "% · " + fails + " of " + d.nw.req + " failed (" + pctTenths(canaryRate(d)) + ") · check in " + left + " s" + (d.auto ? "" : " · arm off"), "canario " + d.pct + "% · fallidos: " + fails + " de " + d.nw.req + " (" + pctTenths(canaryRate(d)) + ") · revisión en " + left + " s" + (d.auto ? "" : " · brazo apagado"));
    say(L(text));
  }

  // ---------- controls ----------
  const pause = playPause(root);
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
  function set(name, raw) {
    if (name === "speed") { cfg.speed = Number(raw); root.press(name, raw); return; }
    cfg[name] = name === "pct" ? Number(raw) : raw;
    root.press(name, raw);
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
  root.on("change", (name, value) => set(name, value));
  const actions = {
    promote: () => { decide(d, "promoted"); push = null; root.press("pct", 100); showStats(); },
    rollback: () => { if (d.decision === "watching") { decide(d, "rolled back"); onEvent("rolled back"); showStats(); } },
    reset: () => { if (cfg.pct === 0) { cfg.pct = 5; root.press("pct", 5); } deploy(); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w, id) => {
    for (const name of ["pct", "build", "auto", "rule", "routing", "check", "speed"]) { cfg[name] = name === "pct" || name === "speed" ? Number(w[name]) : w[name]; root.press(name, w[name]); }
    deploy();
    if (id === "silent" || id === "auto") promoteAt = 1800;
    if (clock.paused) clock.setPaused(false);
  });

  deploy(); clock.setPaused(clock.paused);
}

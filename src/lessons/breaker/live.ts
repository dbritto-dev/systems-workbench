// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The switchboard in the browser: steps the model, moves the cords, blade, shutter, dials and gauge, wires the
// controls and the experiment cards. mount() gets the build-time data from page.ts (geometry, results).
import { lineOnTop, translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats, act, pauseControls } from "../../runtime/dom";
import { pct as percent } from "../../lib/format";
import { rankQuantile } from "../../lib/stats";
import { createSim, STEP, WINDOW } from "./sim";
import { bladeSvg } from "./blade";

export default function mount({ P, G, RESULTS, EXPERIMENTS }) {
  const stage = document.querySelector("[data-office]");
  const svg = stage.querySelector("svg");
  const q = (sel) => svg.querySelector(sel);
  const say = readout();
  const ops = G.OPS.map((_, i) => q('[data-op="' + i + '"]'));
  const needles = G.OPS.map((_, i) => q('[data-needle="' + i + '"]'));
  const lamps = G.LAMPS.map((_, i) => q('[data-lamp="' + i + '"]'));
  const overflowLamp = q("[data-overflow]"), shutter = q("[data-shutter]"), blade = q("[data-blade]");
  const failNeedle = q("[data-fail-needle]"), coolNeedle = q("[data-cool-needle]");
  const trunkIn = q("[data-trunk-in]"), trunkOut = q("[data-trunk-out]"), gauge = q("[data-gauge]"), knobPath = q("[data-knob]");

  let machine = createSim({}, (Date.now() % 1e6) + 1);
  let speed = 1, carry = 0, bladeAngle = 0, bladeDrawn = null, shutterLift = G.SHUTTER.lift;
  let scheduled = [];
  const pops = new Array(G.OPS.length).fill(-1);
  const lastCall = new Array(G.OPS.length).fill(-1), replug = new Array(G.OPS.length).fill(-1);
  let lastDrop = -1;

  function needleD(c, r, z, turn, tail = 1.8) { const a = turn * Math.PI * 2; return lineOnTop([c[0] - Math.sin(a) * tail, c[1] + Math.cos(a) * tail], [c[0] + Math.sin(a) * (r - 1.8), c[1] - Math.cos(a) * (r - 1.8)], z + 0.2, P); }
  function knobD(share) { const [x, y] = G.KNOB.c, r = G.KNOB.r, a = -Math.PI * 0.75 + share * Math.PI * 1.5; return lineOnTop([x + Math.sin(a) * 1.2, y - Math.cos(a) * 1.2], [x + Math.sin(a) * (r - 0.8), y - Math.cos(a) * (r - 0.8)], G.KNOB.z + G.KNOB.h + 0.1, P); }

  function advance(dt) {
    carry += dt;
    while (carry >= STEP) {
      carry -= STEP; machine.step(STEP);
      while (scheduled.length && scheduled[0].at <= machine.s.t) scheduled.shift().fn();
    }
    for (const e of machine.s.events) {
      if (e.kind === "fast" && e.worker >= 0 && e.t > machine.s.t - 0.35) pops[e.worker] = e.t;
      if (e.kind === "drop" && e.t > lastDrop) lastDrop = e.t;
    }
  }

  const ANGLES = G.BLADE.angles;

  function paint() {
    const s = machine.s, cfg = machine.cfg, t = s.t;
    let waiting = 0;
    s.workers.forEach((w, i) => {
      const onLine = w.phase === "call";
      if (onLine) {
        waiting++;
        if (lastCall[i] >= 0 && w.callStart !== lastCall[i] && w.callStart - lastCall[i] > 0.01) replug[i] = t;
        lastCall[i] = w.callStart;
      } else lastCall[i] = -1;
      let state = "rest";
      if (pops[i] >= 0 && t - pops[i] < 0.35) state = "bounce";
      else if (onLine) state = replug[i] >= 0 && t - replug[i] < 0.18 ? "rest" : "trunk";
      else if (w.phase === "local" && w.req && w.req.attempts === 0) state = "local";
      if (ops[i].dataset.state !== state) ops[i].dataset.state = state;
      needles[i].setAttribute("d", needleD([G.OPS[i].cx, G.DIAL.y], G.DIAL.r, G.DIAL.z, onLine ? (t - w.callStart) / 8 : 0));
    });
    lamps.forEach((el, i) => el.toggleAttribute("data-on", i < s.queue.length));
    overflowLamp.toggleAttribute("data-on", lastDrop >= 0 && t - lastDrop < 0.4);
    const b = s.breaker, state = cfg.breaker ? b.state : "closed";
    const target = ANGLES[state];
    bladeAngle += (target - bladeAngle) * (WB.still.matches ? 1 : 0.18);
    if (Math.abs(target - bladeAngle) < 0.2) bladeAngle = target;
    const shown = Math.round(bladeAngle * 2) / 2 + (cfg.breaker && state === "open" ? "o" : "");
    if (shown !== bladeDrawn) { blade.innerHTML = bladeSvg(bladeAngle, G.BLADE, P, cfg.breaker && state === "open"); bladeDrawn = shown; }
    const liftTarget = cfg.breaker && state === "open" ? 0 : G.SHUTTER.lift;
    shutterLift += (liftTarget - shutterLift) * (WB.still.matches ? 1 : 0.22);
    if (Math.abs(liftTarget - shutterLift) < 0.05) shutterLift = liftTarget;
    shutter.setAttribute("transform", translateAlong(P, [0, 0, shutterLift]));
    failNeedle.setAttribute("d", needleD(G.FAIL_DIAL.c, G.FAIL_DIAL.r, G.DIAL_TOP, -0.375 + 0.75 * (cfg.breaker ? Math.min(1, b.failures / cfg.threshold) : 0)));
    const cool = cfg.breaker && state === "open" ? Math.max(0, (b.openUntil - t) / cfg.cooldown) : 0;
    coolNeedle.setAttribute("d", needleD(G.COOL_DIAL.c, G.COOL_DIAL.r, G.DIAL_TOP, -0.375 + 0.75 * cool));
    const load = machine.load(), g = G.GAUGE;
    trunkIn.toggleAttribute("data-off", waiting === 0);
    trunkOut.toggleAttribute("data-off", load === 0);
    const fill = Math.min(1, load / g.full);
    gauge.setAttribute("d", fill > 0.005 ? WB.faceRectY(P, g.x0, g.x1, g.y, g.z0, g.z0 + (g.z1 - g.z0) * fill) : "");
    const supplier = cfg.cause === "slow" ? T("supplier slow", "proveedor lento") : cfg.cause === "failing" ? T("supplier failing", "proveedor fallando")
      : s.supplier.recovering ? T("supplier overloaded", "proveedor saturado") : T("supplier ok", "proveedor bien");
    const breakerText = !cfg.breaker ? T("no breaker", "sin interruptor") : state === "half" ? T("breaker half-open · one test call", "interruptor semiabierto · 1 prueba")
      : state === "open" ? T("breaker open", "interruptor abierto") : T("breaker closed", "interruptor cerrado");
    say(L(breakerText) + " · " + L(waiting + " of 6 cords in the trunk", waiting + " de 6 cordones en la troncal") + " · " + L(supplier));
  }

  const stat = stats();
  let statsAt = 0;
  function showStats(force) {
    const now = performance.now();
    if (!force && now - statsAt < 250) return;
    statsAt = now;
    const c = machine.s.counts;
    if (c.latencies.length > 1500) c.latencies.splice(0, c.latencies.length - 1000);
    stat("served", c.served);
    stat("fast", c.failedFast);
    stat("slow", c.failedSlow);
    stat("dropped", c.dropped);
    stat("p95", c.latencies.length ? rankQuantile(c.latencies, 0.95).toFixed(1) + " s" : "–");
    stat("load", machine.load() + " / " + machine.cfg.cap);
  }

  // ---------- controls ----------
  const pause = pauseControls(stage, say);
  const clock = WB.loop({ stage, step: (dt) => { advance(dt * speed); paint(); showStats(); }, onPause: pause.onPause });
  pause.bind(clock);
  clock.setPaused(clock.paused);
  const pressSeg = WB.pressSeg;
  const KNOB_SHARE = { 0: 0, 1.5: 0.45, 4: 1 };
  function set(name, raw) {
    if (name === "cause") { machine.set("cause", raw); scheduled = []; }
    if (name === "timeout") { machine.set("timeout", Number(raw)); knobPath.setAttribute("d", knobD(KNOB_SHARE[Number(raw)] ?? 0)); }
    if (name === "breaker") machine.set("breaker", raw === "true");
    if (name === "threshold") machine.set("threshold", Number(raw));
    if (name === "cooldown") machine.set("cooldown", Number(raw));
    if (name === "retries") { machine.set("retries", raw === "0" ? 0 : 3); machine.set("backoff", raw === "3b"); }
    if (name === "speed") speed = Number(raw);
    pressSeg(name, raw);
  }
  function resetCounts() { machine.resetCounts(); showStats(true); }
  WB.onSegments(set);
  act("reset").addEventListener("click", resetCounts);

  // ---------- experiments (results computed at build time from the same model, 8 seeds each) ----------
  const secs = (x) => x.toFixed(1) + " s";
  const recoveryText = (r) => r.recovered === 0 ? T("> " + WINDOW + " s", "> " + WINDOW + " s")
    : r.recovered < r.runs ? T(secs(r.recovery) + " (" + r.recovered + " of " + r.runs + " runs)", secs(r.recovery) + " (" + r.recovered + " de " + r.runs + " corridas)")
    : T(secs(r.recovery), secs(r.recovery));
  const recoveryShare = (r) => r.recovered === 0 ? 1 : Math.min(1, r.recovery / WINDOW);
  const RUNS = {
    slow: () => {
      const { a, b } = RESULTS.slow;
      return { verdict: T("Requests that never call the supplier: " + percent(a.localServed) + " served when it was healthy, " + percent(b.localServed) + " when it was slow. " + percent(b.dropped) + " of all requests were turned away at the door.",
          "Solicitudes que nunca llaman al proveedor: " + percent(a.localServed) + " atendidas cuando estaba sano, " + percent(b.localServed) + " cuando estaba lento. El " + percent(b.dropped) + " de todas las solicitudes se rechazó en la entrada."),
        bars: [[T("Healthy supplier", "Proveedor sano"), a.localServed, percent(a.localServed)], [T("Slow supplier", "Proveedor lento"), b.localServed, percent(b.localServed), true]] };
    },
    timeout: () => {
      const { a, b } = RESULTS.timeout;
      const top = Math.max(a.p95Supplier, b.p95Supplier);
      return { verdict: T("Requests that never call the supplier went from " + percent(a.localServed) + " to " + percent(b.localServed) + " served. Supplier requests now fail: " + percent(b.failedSlow) + " of all requests failed after waiting out the timeout.",
          "Las solicitudes que nunca llaman al proveedor pasaron de " + percent(a.localServed) + " a " + percent(b.localServed) + " atendidas. Las solicitudes al proveedor ahora fallan: el " + percent(b.failedSlow) + " de todas las solicitudes falló después de esperar el tiempo límite completo."),
        bars: [[T("No timeout: others served", "Sin límite: otras atendidas"), a.localServed, percent(a.localServed)], [T("1.5 s: others served", "1.5 s: otras atendidas"), b.localServed, percent(b.localServed), true], [T("No timeout: p95 wait", "Sin límite: espera p95"), a.p95Supplier / top, secs(a.p95Supplier)], [T("1.5 s: p95 wait", "1.5 s: espera p95"), b.p95Supplier / top, secs(b.p95Supplier), true]] };
    },
    breaker: () => {
      const { a, b } = RESULTS.breaker;
      const top = Math.max(a.p50Supplier, b.p50Supplier);
      return { verdict: T("Calls in progress at the supplier: " + a.load.toFixed(1) + " → " + b.load.toFixed(1) + " on average. A supplier request now fails in " + secs(b.p50Supplier) + " (median), not " + secs(a.p50Supplier) + ".",
          "Llamadas en curso en el proveedor: " + a.load.toFixed(1) + " → " + b.load.toFixed(1) + " en promedio. Una solicitud al proveedor ahora falla en " + secs(b.p50Supplier) + " (mediana), no en " + secs(a.p50Supplier) + "."),
        bars: [[T("Breaker off: load", "Sin interruptor: carga"), a.load / 15, a.load.toFixed(1)], [T("Breaker on: load", "Con interruptor: carga"), b.load / 15, b.load.toFixed(1), true], [T("Breaker off: median wait", "Sin interruptor: espera mediana"), a.p50Supplier / top, secs(a.p50Supplier)], [T("Breaker on: median wait", "Con interruptor: espera mediana"), b.p50Supplier / top, secs(b.p50Supplier), true]] };
    },
    retries: () => {
      const { a, b, c } = RESULTS.retries;
      const ra = recoveryText(a), rb = recoveryText(b), rc = recoveryText(c);
      return { verdict: T("Time from the fix to the first successful supplier call: " + ra.en + " without retries, " + rb.en + " with three immediate retries, " + rc.en + " with retries behind a breaker.",
          "Tiempo desde el arreglo hasta la primera llamada exitosa al proveedor: " + ra.es + " sin reintentos, " + rb.es + " con tres reintentos inmediatos, " + rc.es + " con reintentos detrás de un interruptor."),
        bars: [[T("No retries", "Sin reintentos"), recoveryShare(a), ra], [T("3 retries", "3 reintentos"), recoveryShare(b), rb, true], [T("3 retries + breaker", "3 reintentos + interruptor"), recoveryShare(c), rc]] };
    },
    cooldown: () => {
      const { a, b, c } = RESULTS.cooldown;
      const ra = recoveryText(a), rb = recoveryText(b), rc = recoveryText(c);
      return { verdict: T("Time from the fix to the first successful supplier call: " + rb.en + " with a 5 s cooldown, " + rc.en + " with a 30 s cooldown (" + ra.en + " with no breaker at all).",
          "Tiempo desde el arreglo hasta la primera llamada exitosa al proveedor: " + rb.es + " con un enfriamiento de 5 s, " + rc.es + " con uno de 30 s (" + ra.es + " sin ningún interruptor)."),
        bars: [[T("No breaker", "Sin interruptor"), recoveryShare(a), ra], [T("Cooldown 5 s", "Enfriamiento 5 s"), recoveryShare(b), rb], [T("Cooldown 30 s", "Enfriamiento 30 s"), recoveryShare(c), rc, true]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    machine = createSim(machine.cfg, (Date.now() % 1e6) + 1);
    set("cause", w.cause); set("timeout", w.timeout); set("breaker", w.breaker); set("retries", w.retries);
    if (w.cooldown) set("cooldown", w.cooldown);
    if (w.fixAfter) scheduled = [{ at: machine.s.t + w.fixAfter, fn: () => { machine.set("cause", "healthy"); pressSeg("cause", "healthy"); } }];
    showStats(true);
    if (clock.paused) clock.setPaused(false);
  } });

  paint(); showStats(true);
}

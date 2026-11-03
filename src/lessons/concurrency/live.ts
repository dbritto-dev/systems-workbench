// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The kitchen in the browser: runs the model, moves the stirring rig from pan to pan, wires the controls and the
// experiment cards. mount() gets the build-time data from page.ts (geometry, experiment results).
import * as WB from "../../runtime/wb";
import { T } from "../../runtime/wb";
import { readout, stats as statsStrip, act, pauseControls } from "../../runtime/dom";
import { easeInOutQuad as ease, approach } from "../../lib/tween";
import { mean as avg } from "../../lib/stats";
import { pct } from "../../lib/format";
import { DT, createKitchen, step, isReady, stats } from "./sim";
import { movingParts } from "./parts";

export default function mount({ P, G, RESULTS, EXPERIMENTS }) {
  const { rigSvg, plateStack, knobPointer } = movingParts(P);
  const stage = document.querySelector("[data-kitchen]");
  const svg = stage.querySelector("svg");
  const say = readout();
  const stat = statsStrip();
  const panEls = G.PANS.map((_, i) => svg.querySelector('[data-pan="' + i + '"]'));
  const pointerEls = G.PANS.map((_, i) => svg.querySelector('[data-pointer="' + i + '"]'));
  const rigEl = svg.querySelector("[data-rig]");
  const platesEl = svg.querySelector("[data-plates]");

  const cfg = { pans: 4, wait: 0.7, policy: "wait", slice: 1, cost: 0.3, stockpot: false, speed: 1 };
  let K, acc = 0, stirAngle = 0, tip = G.PAN_TOP + 22, platesShown = -1, statTimer = 0;
  const topOf = (i) => (cfg.stockpot && i === 0 ? G.POT_TOP : G.PAN_TOP);
  const center = (i) => (i === null || i === undefined ? G.PARK : [G.PANS[i].x, G.PANS[i].y]);

  function reset() {
    K = createKitchen({ pans: cfg.pans, waitShare: cfg.wait, active: 3, policy: cfg.policy, slice: cfg.slice, switchCost: cfg.cost, stockpot: cfg.stockpot, mode: "continuous", seed: (Date.now() % 1e6) + 1 });
    acc = 0; platesShown = -1;
    panEls.forEach((el, i) => {
      el.toggleAttribute("data-off", i >= cfg.pans);
      const pan = el.querySelector('[data-variant="pan"]'), pot = el.querySelector('[data-variant="pot"]');
      if (pot) { pan.toggleAttribute("data-off", cfg.stockpot); pot.toggleAttribute("data-off", !cfg.stockpot); }
    });
    paint(0); showStats();
  }

  function advance(dt) {
    acc += dt;
    let n = Math.min(4000, Math.floor(acc / DT));
    acc -= n * DT;
    while (n-- > 0) step(K);
  }

  const kindOfPan = (pan) => (pan.state === "done" ? "done" : pan.dish.phases[pan.phase].kind);

  function paint(dt) {
    K.pans.forEach((pan, i) => {
      const el = panEls[i];
      const variant = el.querySelector(cfg.stockpot && i === 0 ? '[data-variant="pot"]' : '[data-variant="pan"]');
      const kind = kindOfPan(pan);
      variant.querySelector("[data-lid]").toggleAttribute("data-off", kind !== "wait");
      variant.querySelector("[data-ticket]").toggleAttribute("data-off", !isReady(K, pan));
      const ph = pan.dish.phases[pan.phase];
      const share = kind === "wait" && ph ? Math.max(0, pan.left / ph.t) : 0;
      const [kx, ky] = G.KNOBS[i];
      pointerEls[i].setAttribute("d", knobPointer(kx, ky, share));
    });
    for (let i = K.pans.length; i < 8; i++) pointerEls[i].setAttribute("d", "");
    const c = K.cook;
    let pos, want, lit = false, stir = [0, 0];
    if (c.mode === "switch") {
      const p = ease(Math.min(1, Math.max(0, 1 - c.left / cfg.cost)));
      const a = center(c.at), b = center(c.target);
      pos = [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p];
      want = Math.max(topOf(c.at ?? 1), topOf(c.target)) + 22;
    } else if (c.mode === "work") {
      pos = center(c.at); want = topOf(c.at) + 0.8; lit = true;
      stirAngle += dt * 9;
      stir = [Math.cos(stirAngle) * 6, Math.sin(stirAngle) * 6];
    } else if (c.mode === "hold") {
      pos = center(c.at); want = topOf(c.at) + 12;
    } else {
      pos = center(c.at); want = (c.at === null ? G.PAN_TOP : topOf(c.at)) + 22;
    }
    tip += (want - tip) * approach(dt, 14);
    if (dt === 0) tip = want;
    rigEl.innerHTML = rigSvg(pos[0], pos[1], tip, lit, stir);
    const plates = K.done.length % 9;
    if (plates !== platesShown) { platesShown = plates; platesEl.innerHTML = plateStack(plates); }
    const waiting = K.pans.filter((p) => isReady(K, p)).length;
    const simmering = K.pans.filter((p) => kindOfPan(p) === "wait").length;
    const es = WB.lang() === "es";
    const n = (i) => (es ? "la sartén " : "pan ") + (i + 1);
    const esp = waiting === 1 ? " espera" : " esperan";
    if (c.mode === "work") say(es ? "revolviendo " + n(c.at) + " · " + waiting + esp + " al cocinero · " + simmering + " a fuego lento" : "stirring " + n(c.at) + " · " + waiting + " waiting for the cook · " + simmering + " simmering");
    else if (c.mode === "switch") say(es ? "yendo a " + n(c.target) + " · " + waiting + esp : "moving to " + n(c.target) + " · " + waiting + " waiting");
    else if (c.mode === "hold") say(es ? "parado junto a " + n(c.at) + " mientras hierve · " + waiting + esp : "standing at " + n(c.at) + " while it simmers · " + waiting + " waiting");
    else say(es ? "inactivo · todas las sartenes están a fuego lento" : "idle · every pan is simmering");
  }

  function showStats() {
    const s = stats(K);
    stat("done", s.done);
    stat("rate", s.done ? s.perMinute.toFixed(1) : "–");
    stat("time", s.done ? s.avgTime.toFixed(1) + " s" : "–");
    stat("cooking", K.now > 0.5 ? pct(s.cooking) : "–");
    stat("switching", K.now > 0.5 ? pct(s.switching) : "–");
    stat("idle", K.now > 0.5 ? pct(s.idle) : "–");
  }

  const pause = pauseControls(stage, say);
  const clock = WB.loop({ stage, step: (dt) => {
    advance(dt * cfg.speed); paint(dt * cfg.speed);
    statTimer += dt; if (statTimer > 0.25) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  clock.setPaused(clock.paused);

  function set(name, raw) {
    if (name === "speed") { cfg.speed = Number(raw); WB.pressSeg(name, raw); return; }
    if (name === "pans") cfg.pans = Number(raw);
    if (name === "wait") cfg.wait = Number(raw);
    if (name === "policy") cfg.policy = raw;
    if (name === "slice") cfg.slice = Number(raw);
    if (name === "cost") cfg.cost = Number(raw);
    if (name === "stockpot") cfg.stockpot = raw === true || raw === "true";
    WB.pressSeg(name, raw);
    reset();
  }
  WB.onSegments(set);
  act("reset").addEventListener("click", reset);
  pause.bind(clock);

  // ---------- experiments (results computed at build time from the same model) ----------
  const fmt = (x) => x.toFixed(1) + " s";
  const RUNS = {
    waiting: () => {
      const { a, b } = RESULTS.waiting;
      const top = a.total * 1.05, less = Math.round(100 * (1 - b.total / a.total));
      return { verdict: T("All four served in " + fmt(a.total) + " one at a time, " + fmt(b.total) + " switching while pans simmer: " + less + "% less. The cook was idle " + pct(a.idle) + " of the time one at a time, " + pct(b.idle) + " switching.",
          "Los cuatro servidos en " + fmt(a.total) + " una a la vez y en " + fmt(b.total) + " cambiando mientras las sartenes hierven: " + less + "% menos. El cocinero estuvo inactivo el " + pct(a.idle) + " del tiempo una a la vez y el " + pct(b.idle) + " cambiando."),
        bars: [[T("One at a time", "Una a la vez"), a.total / top, fmt(a.total)], [T("Switch on simmer", "Cambiar al hervir"), b.total / top, fmt(b.total), true]] };
    },
    busy: () => {
      const { a, b } = RESULTS.busy;
      const top = Math.max(a.total, b.total) * 1.05;
      return { verdict: T("Total " + fmt(a.total) + " one at a time vs " + fmt(b.total) + " taking turns. The average dish came out at " + fmt(avg(a.finish)) + " vs " + fmt(avg(b.finish)) + ".",
          "Total: " + fmt(a.total) + " una a la vez contra " + fmt(b.total) + " por turnos. El plato promedio salió a los " + fmt(avg(a.finish)) + " contra " + fmt(avg(b.finish)) + "."),
        bars: [[T("One at a time: all", "Una a la vez: todos"), a.total / top, fmt(a.total)], [T("Taking turns: all", "Por turnos: todos"), b.total / top, fmt(b.total), true], [T("One at a time: avg dish", "Una a la vez: plato prom."), avg(a.finish) / top, fmt(avg(a.finish))], [T("Taking turns: avg dish", "Por turnos: plato prom."), avg(b.finish) / top, fmt(avg(b.finish)), true]] };
    },
    slice: () => {
      const { a, b } = RESULTS.slice;
      return { verdict: T("Moving took " + pct(a.switching) + " of the cook's time with 3 s turns and " + pct(b.switching) + " with 0.3 s turns; the batch went from " + fmt(a.total) + " to " + fmt(b.total) + ".",
          "Moverse ocupó el " + pct(a.switching) + " del tiempo del cocinero con turnos de 3 s y el " + pct(b.switching) + " con turnos de 0.3 s; la tanda pasó de " + fmt(a.total) + " a " + fmt(b.total) + "."),
        bars: [[T("3 s turns", "Turnos de 3 s"), a.switching, pct(a.switching)], [T("0.3 s turns", "Turnos de 0.3 s"), b.switching, pct(b.switching), true]] };
    },
    fair: () => {
      const { a, b } = RESULTS.fair;
      const sa = avg(a.finish.slice(1)), sb = avg(b.finish.slice(1));
      const top = Math.max(a.finish[0], b.finish[0], sa, sb) * 1.05;
      return { verdict: T("The small dishes came out at " + fmt(sa) + " on average without turns and " + fmt(sb) + " with 1 s turns. The stew went from " + fmt(a.finish[0]) + " to " + fmt(b.finish[0]) + ".",
          "Los platos pequeños salieron en promedio a los " + fmt(sa) + " sin turnos y a los " + fmt(sb) + " con turnos de 1 s. El guiso pasó de " + fmt(a.finish[0]) + " a " + fmt(b.finish[0]) + "."),
        bars: [[T("Small, no turns", "Pequeños, sin turnos"), sa / top, fmt(sa)], [T("Small, 1 s turns", "Pequeños, turnos de 1 s"), sb / top, fmt(sb), true], [T("Stew, no turns", "Guiso, sin turnos"), a.finish[0] / top, fmt(a.finish[0])], [T("Stew, 1 s turns", "Guiso, turnos de 1 s"), b.finish[0] / top, fmt(b.finish[0]), true]] };
    },
    pans: () => {
      const { r2, r4, r8 } = RESULTS.pans;
      const rt = Math.max(r2.perMinute, r4.perMinute, r8.perMinute) * 1.1, tt = r8.avgTime * 1.1;
      return { verdict: T("Per minute: " + r4.perMinute.toFixed(1) + " with 4 pans, " + r8.perMinute.toFixed(1) + " with 8. Time per dish: " + fmt(r4.avgTime) + " → " + fmt(r8.avgTime) + ". With 4 pans the cook was idle " + pct(r4.idle) + " of the time.",
          "Por minuto: " + r4.perMinute.toFixed(1) + " con 4 sartenes, " + r8.perMinute.toFixed(1) + " con 8. Tiempo por plato: " + fmt(r4.avgTime) + " → " + fmt(r8.avgTime) + ". Con 4 sartenes el cocinero estuvo inactivo el " + pct(r4.idle) + " del tiempo."),
        bars: [[T("2 pans: per min", "2 sartenes: por min"), r2.perMinute / rt, r2.perMinute.toFixed(1)], [T("4 pans: per min", "4 sartenes: por min"), r4.perMinute / rt, r4.perMinute.toFixed(1)], [T("8 pans: per min", "8 sartenes: por min"), r8.perMinute / rt, r8.perMinute.toFixed(1), true], [T("4 pans: per dish", "4 sartenes: por plato"), r4.avgTime / tt, fmt(r4.avgTime)], [T("8 pans: per dish", "8 sartenes: por plato"), r8.avgTime / tt, fmt(r8.avgTime), true]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    for (const [name, value] of Object.entries({ pans: w.pans, wait: w.wait, policy: w.policy, slice: w.slice, cost: w.cost, stockpot: String(w.stockpot) })) { cfg[name] = name === "policy" ? value : name === "stockpot" ? value === "true" : Number(value); WB.pressSeg(name, value); }
    reset();
    if (clock.paused) clock.setPaused(false);
  } });

  reset();
}

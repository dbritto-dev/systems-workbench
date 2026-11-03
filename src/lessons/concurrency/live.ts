// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The kitchen in the browser: runs the model, moves the stirring rig from pan to pan, and answers the controls.
// mount() gets the build-time data from page.ts (geometry) and root, the <wb-lesson>.
import * as WB from "../../runtime/wb";
import { playPause } from "../../runtime/dom";
import { easeInOutQuad as ease, approach } from "../../lib/tween";
import { pct, secs1 } from "../../lib/format";
import { DT, createKitchen, step, isReady, stats } from "./sim";
import { movingParts } from "./parts";

export default function mount({ P, G }, root) {
  const { rigSvg, plateStack, knobPointer } = movingParts(P);
  const { stage, svg } = root.figure;
  const say = (text) => root.figure.say(text);
  const stat = (key, value) => root.stat(key, value);
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
    stat("time", s.done ? secs1(s.avgTime) : "–");
    stat("cooking", K.now > 0.5 ? pct(s.cooking) : "–");
    stat("switching", K.now > 0.5 ? pct(s.switching) : "–");
    stat("idle", K.now > 0.5 ? pct(s.idle) : "–");
  }

  const pause = playPause(root);
  const clock = WB.loop({ stage, step: (dt) => {
    advance(dt * cfg.speed); paint(dt * cfg.speed);
    statTimer += dt; if (statTimer > 0.25) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  clock.setPaused(clock.paused);

  function set(name, raw) {
    if (name === "speed") { cfg.speed = Number(raw); root.press(name, raw); return; }
    if (name === "pans") cfg.pans = Number(raw);
    if (name === "wait") cfg.wait = Number(raw);
    if (name === "policy") cfg.policy = raw;
    if (name === "slice") cfg.slice = Number(raw);
    if (name === "cost") cfg.cost = Number(raw);
    if (name === "stockpot") cfg.stockpot = raw === true || raw === "true";
    root.press(name, raw);
    reset();
  }
  root.on("change", (name, value) => set(name, value));
  const actions = { reset };
  root.on("action", (name) => actions[name]?.());
  pause.bind(clock);

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const [name, value] of Object.entries({ pans: w.pans, wait: w.wait, policy: w.policy, slice: w.slice, cost: w.cost, stockpot: String(w.stockpot) })) { cfg[name] = name === "policy" ? value : name === "stockpot" ? value === "true" : Number(value); root.press(name, value); }
    reset();
    if (clock.paused) clock.setPaused(false);
  });

  reset();
}

// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The typesetting bench in the browser: runs the frame model in slow motion, segment by segment. Writes reshape the
// list's blocks, every layout segment is a pass of the gantry (lit when a read forced it), the console lamps follow
// the step running, and every finished frame becomes a bar on the strip. mount() gets the build-time data from
// page.ts (projection, geometry) and root, the <wb-lesson>.
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, playPause } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { millis, int } from "../../lib/format";
import { makeRunner, BUDGET } from "./sim";
import { itemSvg, barSvg } from "./blocks";

const SLOW = BUDGET;        // model ms per second on the page at ×1: one frame takes about a second
const GLOW = 0.12;          // seconds a READ or WRITE lamp stays on after an op

export default function mount({ P, G }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const say = (v) => root.figure.say(L(v));
  const stat = (key, value) => root.stat(key, value);

  const items = qa("[data-item]");
  const nodes = qa("[data-node]");
  const fences = qa("[data-fence]");
  const slips = qa("[data-slip]");
  const bars = qa("[data-bar]");
  const gantry = q("[data-gantry]"), gantryOff = q("[data-gantry-off]"), gantryOn = q("[data-gantry-on]");
  const slipText = q("[data-item-text]");
  const lamps = Object.fromEntries(["read", "write"].map((n) => [n, { off: q('[data-lamp="' + n + '"]'), on: q('[data-lamp-on="' + n + '"]') }]));
  const stages = Object.fromEntries(G.STAGES.map((n) => [n, { off: q('[data-stage="' + n + '"]'), on: q('[data-stage-on="' + n + '"]'), ms: WB.counter(svg, "ms-" + n, P) }]));
  const counters = { layouts: WB.counter(svg, "layouts", P), forced: WB.counter(svg, "forced", P), boxes: WB.counter(svg, "boxes", P), frame: WB.counter(svg, "frame", P) };

  // ---------- settings and the run ----------
  const cfg = { pattern: "inplace", prop: "height", items: 40, dom: 2000, contain: "none", speed: 1 };
  let runner, fr, segIdx, started, clock, frameNo, history, passes, gantryY, stray = false, seed = 5;
  let acc, slots, drawn, lastOp, glowRead = 0, glowWrite = 0, realNow = 0;

  const slotsUsed = () => Math.min(cfg.items, G.ITEM_SLOTS);
  const slotOf = (i) => (cfg.items <= G.ITEM_SLOTS ? i : Math.floor((i * G.ITEM_SLOTS) / cfg.items));
  const heightFor = (i, f) => Math.round(10 * (G.ITEM_H.min + (G.ITEM_H.max - G.ITEM_H.min) * (0.5 + 0.5 * Math.sin(f * 0.9 + i * 0.55)))) / 10;
  const sweep = () => (cfg.contain === "strict" ? G.SWEEP.list : G.SWEEP.page);
  const freshAcc = () => ({ js: 0, style: 0, layout: 0, paint: 0, composite: 0, layouts: 0, forced: 0, rafDone: 0, taskReads: 0 });

  function restart() {
    runner = makeRunner({ pattern: cfg.pattern, prop: cfg.prop, items: cfg.items, dom: cfg.dom, contain: cfg.contain === "strict" }, seed);
    seed = (Date.now() % 1e6) + 1;
    clock = 0; frameNo = 0; history = []; passes = 0; gantryY = G.GANTRY.rest; lastOp = null;
    slots = Array.from({ length: G.ITEM_SLOTS }, (_, s) => ({ h: heightFor(s, 0), inked: false, dx: 0 }));
    drawn = slots.map(() => "");
    begin(runner.frame(0));
    // static parts of the setup
    const shown = Math.round((G.NODE_BLOCKS * cfg.dom) / 8000);
    nodes.forEach((g) => show(g, Number(g.dataset.node) < shown));
    fences.forEach((g) => show(g, cfg.contain === "strict"));
    items.forEach((g, s) => { show(g, s < slotsUsed()); g.removeAttribute("transform"); });
    counters.boxes.setClamped(runner.scope);
    for (const k of ["frame", "layouts", "forced", "layoutMs", "fps", "over"]) stat(k, "–");
    warm();
    paint();
  }
  function begin(next) { fr = next; segIdx = 0; started = -1; acc = freshAcc(); }

  // Start a few frames in, in the middle of a layout pass, so the still frame shows the machine at work.
  function warm() {
    while (frameNo < 3) { clock = fr.next; advance(); }
    const lays = fr.segs.filter((s) => s.kind === "layout");
    const s = lays[Math.floor(lays.length / 3)] || fr.segs.find((x) => x.kind === "paint") || fr.segs[0];
    clock = s.t0 + s.dur * 0.55;
    advance();
    glowRead = glowWrite = 0;
  }

  // ---------- running the frame's segments up to the clock ----------
  function startSeg(s) {
    if (s.kind === "read" || s.kind === "write") {
      lastOp = s;
      if (s.kind === "read") { glowRead = realNow + GLOW; if (s.phase === "task") acc.taskReads++; }
      else {
        glowWrite = realNow + GLOW;
        if (s.phase === "raf") acc.rafDone++;
        const sl = slots[slotOf(s.item)];
        if (cfg.prop === "height") sl.h = heightFor(s.item, frameNo + 1);
        else if (cfg.prop === "color") sl.inked = frameNo % 2 === 0;
        else sl.dx = 3 * Math.sin(frameNo * 0.8 + s.item * 0.5);
      }
    } else if (s.kind === "layout") { acc.layouts++; if (s.forced) acc.forced++; passes++; }
  }
  function endSeg(s) {
    const key = s.kind === "read" || s.kind === "write" ? "js" : s.kind;
    acc[key] += s.dur;
  }
  function finishFrame() {
    history.push({ total: fr.total, interval: fr.next - fr.start, layouts: fr.layouts, forced: fr.forced, layout: fr.layout });
    if (history.length > 60) history.shift();
    frameNo++;
    showStats();
  }
  function advance() {
    for (let guard = 0; guard < 100000; guard++) {
      const s = fr.segs[segIdx];
      if (s) {
        if (clock < s.t0) return;
        if (started !== segIdx) { started = segIdx; startSeg(s); }
        if (clock < s.t0 + s.dur) return;
        endSeg(s); segIdx++;
        continue;
      }
      if (clock < fr.next) return;
      finishFrame();
      begin(runner.frame(fr.next, { stray }));
      stray = false;
    }
  }

  // ---------- painting ----------
  function paint() {
    const s = fr.segs[segIdx], live = s && clock >= s.t0 ? s : null;
    const frac = live ? Math.min(1, (clock - live.t0) / Math.max(1e-9, live.dur)) : 0;

    // the gantry: a pass per layout, back and forth; lit when forced
    const forced = live && live.kind === "layout" && live.forced;
    if (live && live.kind === "layout") {
      const [a, b] = sweep();
      gantryY = passes % 2 ? lerp(a, b, frac) : lerp(b, a, frac);
    }
    gantry.setAttribute("transform", translateAlong(P, [0, gantryY - G.GANTRY.rest, 0]));
    show(gantryOn, !!forced); show(gantryOff, !forced);

    // the list's blocks
    const litSlot = forced && live.item >= 0 ? slotOf(live.item) : -1;
    for (let k = 0; k < slotsUsed(); k++) {
      const sl = slots[k], key = sl.h + "|" + sl.inked + "|" + (k === litSlot);
      if (drawn[k] !== key) { drawn[k] = key; items[k].innerHTML = itemSvg(P, k, sl.h, { inked: sl.inked, lit: k === litSlot }); }
      if (cfg.prop === "transform") items[k].setAttribute("transform", translateAlong(P, [sl.dx, 0, 0]));
    }

    // the desk: the item in hand, the READ and WRITE lamps, the rAF tray
    setText(slipText, lastOp ? String(lastOp.item + 1) : "–");
    // a read that forced a layout waits for it: its lamp stays on through the pass
    const reading = realNow < glowRead || (live && live.kind === "read") || !!forced, writing = !forced && (realNow < glowWrite || (live && live.kind === "write"));
    show(lamps.read.on, reading); show(lamps.read.off, !reading);
    show(lamps.write.on, writing); show(lamps.write.off, !writing);
    const pending = cfg.pattern === "rafWrite" ? acc.taskReads - acc.rafDone : cfg.pattern === "rafBoth" && segIdx < fr.segs.length ? cfg.items - acc.rafDone : 0;
    const nSlips = pending > 0 ? Math.ceil((pending / cfg.items) * G.SLIPS) : 0;
    slips.forEach((g, n) => show(g, n < nSlips));

    // the console: the step running now, and ms per step so far this frame
    const step = live ? (live.kind === "read" || live.kind === "write" ? "js" : live.kind) : realNow < Math.max(glowRead, glowWrite) ? "js" : null;
    for (const [name, st] of Object.entries(stages)) {
      const on = name === step;
      show(st.on, on); show(st.off, !on);
      st.ms.setClamped(Math.round(acc[name] + (live && (name === step) ? live.dur * frac : 0)));
    }
    counters.layouts.setClamped(acc.layouts);
    counters.forced.setClamped(acc.forced);

    // the frame strip: newest frame at the front
    const recent = history.slice(-G.BARS.n);
    bars.forEach((g, i) => {
      const f = recent[i - (G.BARS.n - recent.length)];
      const h = f ? Math.min(G.BARS.max, f.total * G.BARS.perMs) : 0.4, key = h.toFixed(2);
      if (g.dataset.k !== key) { g.dataset.k = key; g.innerHTML = barSvg(P, i, h); }
    });
    if (history.length) counters.frame.setClamped(Math.round(history[history.length - 1].total));

    narrate(live);
  }

  // ---------- the readout ----------
    // Short lines: the readout shares one line of the plate with the pause hint on a phone.
  function narrate(live) {
    const n = (s) => s.item + 1;
    if (live && live.kind === "layout") {
      if (live.stray) return say(T("stray read · forced layout #" + live.n + " mid-writes", "lectura colada · layout forzado #" + live.n));
      if (live.forced) return say(T("forced layout #" + live.n + " · item " + n(live) + " read after a write", "layout forzado #" + live.n + " · ítem " + n(live) + " leído tras escribir"));
      return say(T("end of frame · one layout for all changes", "fin del cuadro · un layout para todo"));
    }
    if (live && live.kind === "paint") return say(cfg.prop === "color" ? T("repainting " + live.boxes + " boxes · no layout", "repintando " + live.boxes + " cajas · sin layout") : T("painting " + int(live.boxes) + " boxes", "pintando " + int(live.boxes) + " cajas"));
    if (live && live.kind === "composite") return say(live.layer ? T("compositor moves layers · no paint", "el compositor mueve capas · sin pintar") : T("compositing the frame", "componiendo el cuadro"));
    if (live && live.kind === "style") {
      const next = fr.segs[segIdx + 1], layoutNext = next && next.kind === "layout";
      if (!live.forced) return say(T("end of frame · updating style", "fin del cuadro · actualiza el estilo"));
      return say(layoutNext ? T("item " + n(live) + " read · style, then layout", "ítem " + n(live) + " leído · estilo y layout")
        : T("item " + n(live) + " read · style only, layout valid", "ítem " + n(live) + " leído · solo estilo"));
    }
    if (segIdx >= fr.segs.length) {
      const missed = Math.round((fr.next - fr.start) / BUDGET) - 1;
      return say(missed > 0 ? T("frame took " + millis(fr.total) + " · " + missed + (missed === 1 ? " vsync" : " vsyncs") + " missed", "cuadro de " + millis(fr.total) + " · " + missed + (missed === 1 ? " vsync perdido" : " vsyncs perdidos"))
        : T("frame done in " + millis(fr.total) + " · waiting for vsync", "cuadro listo en " + millis(fr.total) + " · espera el vsync"));
    }
    if (lastOp) {
      const where = lastOp.phase === "raf" ? "rAF" : "handler";
      if (lastOp.kind === "read") return say(T(where + " · reading item " + n(lastOp), where + " · lee el ítem " + n(lastOp)));
      return say(T(where + " · writing item " + n(lastOp) + "'s " + cfg.prop, where + " · escribe " + propEs() + " del ítem " + n(lastOp)));
    }
    say(T("frame starts", "empieza el cuadro"));
  }
  const propEs = () => (cfg.prop === "height" ? "la altura" : cfg.prop === "color" ? "el color" : "el transform");

  // ---------- stats: the last frame, and the last ten for the rate ----------
  function showStats() {
    const f = history[history.length - 1], recent = history.slice(-10);
    const interval = recent.reduce((a, x) => a + x.interval, 0) / recent.length;
    const over = history.filter((x) => x.total > BUDGET).length;
    stat("frame", millis(f.total));
    stat("layouts", String(f.layouts));
    stat("forced", String(f.forced));
    stat("layoutMs", millis(f.layout));
    stat("fps", String(Math.round(1000 / interval)));
    stat("over", L(T(over + " of " + history.length, over + " de " + history.length)));
  }

  // ---------- the loop ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    realNow += dt;
    clock += dt * cfg.speed * SLOW;
    advance();
    paint();
  }, onPause: pause.onPause });
  pause.bind(loop);

  const NUM = ["items", "dom", "speed"];
  function set(name, raw, quiet) {
    root.press(name, raw);
    cfg[name] = NUM.includes(name) ? Number(raw) : String(raw);
    if (name === "speed") return;
    if (!quiet) { restart(); say(T("settings applied · run restarted", "ajustes aplicados · corrida reiniciada")); }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    stray: () => { stray = true; say(T("next frame: a stray read mid-writes", "próximo cuadro: una lectura colada")); wake(); },
    reset: () => { restart(); say(T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const key of ["pattern", "prop", "items", "dom", "contain", "speed"]) set(key, String(w[key]), true);
    restart();
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

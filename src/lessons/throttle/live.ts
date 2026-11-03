// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The metronome gate in the browser: feeds the event stream through the gate model in slow motion, rolls the balls,
// swings the metronome and answers the controls. mount() gets the build-time data from page.ts (geometry, the ball
// drawing) and root, the <wb-lesson>.
import { iso, translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import { digitPath, counterCells, digitsOf } from "../../../workbench/digits.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { playPause } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { makeGate, makeStream, TRAVEL, ROLL, FALL } from "./sim";
import { livePaths } from "./paths";

export default function mount({ P, G, GAUGE, BALL_SVG }, root) {
  const railX = (v) => G.RAIL.x0 + 8 + (Math.max(0, Math.min(G.VALUE_MAX, v)) / G.VALUE_MAX) * (G.RAIL.x1 - G.RAIL.x0 - 16);
  const ARM = G.ARM;
  const { armPaths, needlePath, gapPath } = livePaths(P, { PIVOT: G.PIVOT, ARM, GAUGE, RAIL: G.RAIL, LANE_USER: G.LANE_USER });

  const SLOW = 0.1;            // seconds of input per second on the page at ×1
  const PRESS = 0.03, HOP = 0.02, PILE_T = 0.5;
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const NS = "http://www.w3.org/2000/svg";

  function pool(layer, n) {
    return Array.from({ length: n }, () => { const g = document.createElementNS(NS, "g"); g.innerHTML = BALL_SVG; g.style.display = "none"; layer.appendChild(g); return { g, solid: g.firstElementChild, lit: false }; });
  }
  function slots(layer, list) {
    return list.map((p) => { const g = document.createElementNS(NS, "g"); g.innerHTML = BALL_SVG; g.style.display = "none"; WB.place(g, P, p); layer.appendChild(g); return g; });
  }
  const binLayer = q("[data-bin-balls]"), backLayer = q("[data-balls-back]"), frontLayer = q("[data-balls-front]"), trayLayer = q("[data-tray-balls]");
  const binPile = slots(binLayer, G.BIN_SLOTS), trayPile = slots(trayLayer, G.TRAY_SLOTS);
  const pools = { bin: pool(binLayer, 10), back: pool(backLayer, 40), front: pool(frontLayer, 14) };
  const bladeUp = q("[data-blade-up]"), bladeDown = q("[data-blade-down]"), ram = q("[data-ram]"), rod = q("[data-rod]"), needle = q("[data-needle]"), gap = q("[data-gap]");
  const userEl = q("[data-user]"), screenEl = q("[data-screen]");
  const ramSolid = ram.querySelector(".iso-solid");
  const armEls = { rod: q("[data-arm-rod]"), rodFill: q("[data-arm-rod-fill]"), wt: q("[data-arm-wt]"), wtFill: q("[data-arm-wt-fill]") };

  // Counters: this figure draws its wheels as data-digit="name-j" paths (not the shared parts' data-counter), so
  // WB.counter can't find them; the same redraw-on-change, kept here.
  function counter(name) { const c = G.COUNTERS[name]; const cells = counterCells(c); return { c, cells, els: cells.map((_, j) => q('[data-digit="' + name + '-' + j + '"]')), shown: [] }; }
  const dials = { events: counter("events"), dropped: counter("dropped"), handled: counter("handled") };
  function showCount(dial, v) { digitsOf(v, dial.c.count).forEach((d, j) => { if (dial.shown[j] !== d) { dial.shown[j] = d; dial.els[j].setAttribute("d", digitPath(iso, P, dial.cells[j], d)); } }); }

  const cfg = { mode: "throttle", wait: 0.1, edges: "both", input: "scroll", rate: 60, speed: 1 };
  let gate, stream, nextEv, incoming, clock, seed = 3, scan, liveV, liveDir, holding = false, holdNext = 0, bladeOpen = null, needleRate = 0, armAngle = -ARM.swing, callPtr;

  function restart() {
    const leading = cfg.edges !== "trail", trailing = cfg.edges !== "lead";
    gate = makeGate({ mode: cfg.mode, wait: cfg.wait, leading, trailing });
    stream = cfg.input === "you" ? null : makeStream(cfg.input, seed++, { rate: cfg.rate });
    nextEv = stream ? stream.next() : null;
    incoming = []; scan = 0; callPtr = 0; liveV = 500; liveDir = 1; holdNext = 0;
    armAngle = -ARM.swing;
    // Start mid-burst so the first frame already shows balls on the track, one waiting and a few dropped.
    clock = cfg.input === "you" ? 0 : cfg.input === "clicks" ? 0.62 : 0.66;
    advance(clock);
    bladeOpen = null;
    paint();
  }

  function advance(t) {
    while (nextEv && nextEv.t - TRAVEL <= t) { incoming.push(nextEv); nextEv = stream.next(); }
    while (holding && holdNext - TRAVEL <= t) {
      liveV += liveDir * 6.5; if (liveV > 960 || liveV < 40) liveDir = -liveDir;
      incoming.push({ t: holdNext, v: liveV }); holdNext += 1 / 60;
    }
    incoming.sort((a, b) => a.t - b.t);
    while (incoming.length && incoming[0].t <= t) { const e = incoming.shift(); gate.event(e.t, e.v); }
    gate.advance(t);
  }

  const gateShut = () => cfg.mode !== "off" && gate.timerEnd !== null && gate.timerEnd > clock;
  const lastCallT = () => (gate.calls.length ? gate.calls[gate.calls.length - 1].t : -9);

  function paint() {
    const used = { bin: 0, back: 0, front: 0 };
    const place = (layer, p, lit) => {
      const pl = pools[layer]; if (used[layer] >= pl.length) return;
      const b = pl[used[layer]++];
      b.g.style.display = ""; WB.place(b.g, P, p);
      if (b.lit !== lit) { b.lit = lit; b.solid.toggleAttribute("data-lit", lit); }
    };
    const Z = G.BALL_Z, CY = G.CY;
    // Balls still on their way from the hopper; in queue mode they stop at the end of the line.
    const qIndex = new Map(gate.queue.map((i, n) => [i, n]));
    let tail = cfg.mode === "queue" ? gate.queue.length : 0;
    for (const e of incoming) {
      const s = 1 - (e.t - clock) / TRAVEL;
      if (s < 0) continue;
      let x = lerp(G.FEED_X, G.LEDGE_X, Math.min(1, s));
      if (cfg.mode === "queue") x = Math.min(x, G.LEDGE_X - tail++ * G.QUEUE_GAP);
      place("back", [Math.max(G.FEED_X, x), CY, Z], false);
    }
    // Balls that have reached the gate.
    const ev = gate.events;
    while (scan < ev.length && ev[scan].out !== null && clock - ev[scan].out > ROLL + PRESS + HOP + 0.01) scan++;
    for (let i = scan; i < ev.length; i++) {
      const e = ev[i];
      if (e.out === null || e.out > clock) {
        const n = qIndex.has(i) ? qIndex.get(i) : 0;
        place("back", [Math.max(G.FEED_X, G.LEDGE_X - n * G.QUEUE_GAP), CY, Z], false);
        continue;
      }
      const s = clock - e.out;
      if (e.call) {
        if (s < ROLL) { const x = lerp(G.LEDGE_X, G.PRESS_X, s / ROLL); place(x < G.GATE_X + 3 ? "back" : "front", [x, CY, Z], true); }
        else if (s < ROLL + PRESS) place("front", [G.PRESS_X, CY, Z], true);
        else if (s < ROLL + PRESS + HOP) { const f = (s - ROLL - PRESS) / HOP; place("front", [G.PRESS_X, lerp(CY, G.TRAY.y + 7, f), lerp(Z, 4 + G.BALL_R, f) + 6 * Math.sin(Math.PI * f)], false); }
      } else if (s < FALL) {
        const f = s / FALL, z = lerp(Z, 1 + G.BALL_R, f * f), y = lerp(CY, CY + 12, Math.max(0, (f - 0.35) / 0.65));
        place(z > Z - 1.2 ? "back" : "bin", [G.LEDGE_X, y, z], false);
      }
    }
    for (const layer of ["bin", "back", "front"]) for (let i = used[layer]; i < pools[layer].length; i++) pools[layer][i].g.style.display = "none";

    // Piles: what landed in the bin and the tray in the last half second.
    let binN = 0; for (let i = gate.drops.length - 1; i >= 0 && gate.drops[i] + FALL > clock - PILE_T; i--) if (gate.drops[i] + FALL <= clock) binN++;
    let trayN = 0; const fin = ROLL + PRESS + HOP;
    for (let i = gate.calls.length - 1; i >= 0 && gate.calls[i].t + fin > clock - PILE_T; i--) if (gate.calls[i].t + fin <= clock) trayN++;
    binPile.forEach((g, i) => { const on = i < binN; if ((g.style.display !== "none") !== on) g.style.display = on ? "" : "none"; });
    trayPile.forEach((g, i) => { const on = i < trayN; if ((g.style.display !== "none") !== on) g.style.display = on ? "" : "none"; });

    // The gate blade: down while the metronome swings, up for a moment as a ball goes through.
    const open = !gateShut() || clock - lastCallT() < 0.012;
    if (open !== bladeOpen) { bladeOpen = open; bladeUp.style.display = open ? "" : "none"; bladeDown.style.display = open ? "none" : ""; }

    // The metronome: one swing per window; debounce always starts its swing from the left.
    const segs = gate.segs, last = segs[segs.length - 1];
    if (last && cfg.mode !== "off") {
      const dir = cfg.mode === "debounce" ? 1 : (segs.length % 2 ? 1 : -1);
      const p = Math.min(1, (clock - last[0]) / cfg.wait);
      armAngle = clock < last[1] ? dir * (-ARM.swing + 2 * ARM.swing * p) : dir * ARM.swing;
    } else armAngle = -ARM.swing;
    const a = armPaths(armAngle);
    armEls.rod.setAttribute("d", a.rod); armEls.rodFill.setAttribute("d", a.rod); armEls.wt.setAttribute("d", a.wt); armEls.wtFill.setAttribute("d", a.wt);

    // The press: comes down as each handled ball arrives.
    let pressT = -9;
    for (let i = gate.calls.length - 1; i >= 0; i--) { const t = gate.calls[i].t + ROLL; if (t <= clock) { pressT = t; break; } }
    const ps = clock - pressT, down = ps >= 0 && ps < PRESS ? Math.sin(Math.PI * ps / PRESS) : 0;
    const drop = down * (G.RAM.up - G.RAM.down);
    ram.setAttribute("transform", drop ? translateAlong(P, [0, 0, -drop]) : ""); rod.setAttribute("transform", drop ? translateAlong(P, [0, 0, -drop]) : "");
    ramSolid.toggleAttribute("data-lit", down > 0.05);

    // Counters, the gauge.
    showCount(dials.events, ev.length); showCount(dials.handled, gate.calls.length); showCount(dials.dropped, gate.drops.length);
    let recent = 0; for (let i = gate.calls.length - 1; i >= 0 && gate.calls[i].t > clock - 1; i--) recent++;
    const span = Math.min(1, clock);
    const rate = span > 0.05 ? recent / span : 0;
    needleRate += (rate - needleRate) * 0.2;
    needle.setAttribute("d", needlePath(needleRate));

    // The rail: where the user is, and what the screen shows.
    const clicks = cfg.input === "clicks";
    let uv, sv;
    if (clicks) {
      const base = Math.floor(Math.min(ev.length, gate.calls.length) / 30) * 30;
      uv = ((ev.length - base) / 30) * G.VALUE_MAX; sv = ((gate.calls.length - base) / 30) * G.VALUE_MAX;
    } else {
      uv = ev.length ? ev[ev.length - 1].v : (cfg.input === "you" ? liveV : 300);
      sv = gate.handled !== null ? ev[gate.handled].v : uv;
    }
    const ux = railX(uv), sx = railX(sv);
    WB.place(userEl, P, [ux, 0, 0]);
    WB.place(screenEl, P, [sx, 0, 0]);
    gap.setAttribute("d", gapPath(sx, ux));

    // Readout and stats.
    const waiting = cfg.mode === "queue" ? gate.queue.length : gate.pending >= 0 ? 1 : 0;
    const newest = ev.length - 1;
    const behindMs = gate.handled === null ? (newest >= 0 ? (clock - ev[0].t) * 1000 : 0) : gate.handled < newest ? (clock - ev[gate.handled + 1].t) * 1000 : 0;
    stat("events", ev.length); stat("handled", gate.calls.length); stat("dropped", gate.drops.length);
    stat("rate", Math.round(rate));
    stat("behind", clicks ? (ev.length - gate.calls.length) + L(" items", " artículos") : Math.round(behindMs) + " ms");
    stat("waiting", waiting);
    const shut = gateShut();
    let line;
    const quiet = Math.round(cfg.wait * 1000), left = Math.max(0, Math.round((gate.timerEnd - clock) * 1000));
    if (cfg.mode === "off") line = T("no gate · every event runs the handler", "sin compuerta · cada evento ejecuta el handler");
    else if (cfg.mode === "queue") line = T((shut ? "gate down · " : "gate up · ") + waiting + " in line · none dropped", (shut ? "compuerta cerrada · " : "compuerta abierta · ") + waiting + " en fila · ninguno descartado");
    else if (cfg.mode === "debounce") line = shut ? T("waiting for a quiet " + quiet + " ms · " + (waiting ? "1 on the flap" : "flap empty"), "esperando " + quiet + " ms de calma · " + (waiting ? "1 en la trampilla" : "trampilla vacía")) : T("quiet · handler ran " + gate.calls.length + "×", "calma · el handler corrió " + gate.calls.length + "×");
    else line = shut ? T("gate down for " + left + " ms · " + (waiting ? "newest on the flap" : "flap empty"), "compuerta cerrada por " + left + " ms · " + (waiting ? "la más nueva en la trampilla" : "trampilla vacía")) : T("gate up · next ball goes straight through", "compuerta abierta · la próxima bola pasa directo");
    if (cfg.input === "you" && !ev.length && !incoming.length) line = T("hold the button to scroll", "mantén presionado el botón para hacer scroll");
    say(L(line));
  }
  const stat = (key, value) => root.stat(key, value);

  const pause = playPause(root);
  const loop = WB.loop({ stage, maxDt: 0.1, step: (dt) => { clock += dt * SLOW * cfg.speed; advance(clock); paint(); }, onPause: pause.onPause });

  function set(name, raw, quiet) {
    if (name === "speed") { cfg.speed = Number(raw); root.press(name, raw); return; }
    if (name === "mode") cfg.mode = raw;
    if (name === "wait") cfg.wait = Number(raw);
    if (name === "edges") cfg.edges = raw;
    if (name === "input") { cfg.input = raw; if (!quiet) cfg.rate = 60; }
    root.press(name, raw);
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));

  // Your hand: hold to scroll, click to send one event.
  const holdBtn = root.button("hold");
  function toYou() { if (cfg.input !== "you") set("input", "you"); if (loop.paused) loop.setPaused(false); }
  function startHold() { toYou(); if (holding) return; holding = true; holdNext = clock + TRAVEL; holdBtn.setAttribute("data-held", ""); }
  function stopHold() { holding = false; holdBtn.removeAttribute("data-held"); }
  holdBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); holdBtn.setPointerCapture?.(e.pointerId); startHold(); });
  holdBtn.addEventListener("pointerup", stopHold);
  holdBtn.addEventListener("pointercancel", stopHold);
  holdBtn.addEventListener("lostpointercapture", stopHold);
  holdBtn.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); startHold(); } });
  holdBtn.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") stopHold(); });
  holdBtn.addEventListener("blur", stopHold);
  const actions = {
    click: () => {
      toYou();
      const t = Math.max(clock + TRAVEL, incoming.length ? incoming[incoming.length - 1].t + 0.001 : 0);
      incoming.push({ t, v: liveV });
    },
    reset: () => { stopHold(); restart(); },
  };
  root.on("action", (name) => actions[name]?.());
  pause.bind(loop);

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    stopHold();
    set("mode", w.mode, true); set("wait", String(w.wait), true); set("edges", w.edges, true); set("input", w.input, true);
    cfg.rate = w.rate;
    restart();
    if (loop.paused) loop.setPaused(false);
  });

  loop.setPaused(loop.paused);
  restart();
}

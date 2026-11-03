// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The front counter in the browser: runs the model in slow motion, walks the couriers out to the records office and
// back, lights the screen, the server's board and the button, and answers the controls. mount() gets the build-time
// data from page.ts (projection, geometry, the courier drawing) and root, the <wb-lesson>.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, setLit, playPause } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { clamp } from "../../lib/stats";
import { pointAlong, polylineLength } from "../../lib/geometry";
import { makeSim } from "./sim";

export default function mount({ P, G, COURIER_SVG, SLIP_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const stat = (key, value) => root.stat(key, value);
  const NS = "http://www.w3.org/2000/svg";
  const walkLayer = q('[data-layer="walk"]'), binLayer = q('[data-layer="bin"]');
  const pills = { screen: q('[data-pill="screen"]'), server: q('[data-pill="server"]') };
  const capMove = q("[data-cap]"), cap = q("[data-button]");
  const toastEl = q("[data-toast]");
  const lamps = { savingOn: q('[data-saving="on"]'), savingOff: q('[data-saving="off"]'), syncOn: q('[data-sync="on"]'), syncOff: q('[data-sync="off"]') };
  const counters = Object.fromEntries(["taps", "notSaved", "late", "ignored", "writes"].map((n) => [n, WB.counter(svg, n, P)]));
  const H = 0.8;                                  // the walkway's top
  const LINGER = 0.06;                            // model seconds a courier stays after handing in its answer

  // ---------- couriers: one pooled element per request on screen ----------
  const free = [], recs = new Map();
  function makeEl() {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = COURIER_SVG;
    return { g, slip: g.querySelector("[data-slip]"), text: g.querySelector("[data-slip-text]"), lit: null, label: null };
  }
  function dress(el, lit, label) {
    if (el.lit !== lit) { el.lit = lit; setLit(el.slip, lit); }
    if (el.label !== label) { el.label = label; setText(el.text, label); el.text.setAttribute("font-size", label.length > 3 ? 2.4 : 3); }
  }
  // slips falling into the bin
  const drops = [];
  function dropSlip(lit) {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = SLIP_SVG;
    setLit(g, lit);
    binLayer.appendChild(g);
    drops.push({ g, born: clock });
  }

  // ---------- settings and the run ----------
  const cfg = { ui: "opt", onFail: "rollback", order: "all", reads: "off", fail: 0.1, server: "tail", taps: "mixed", speed: 0.25 };
  let model, clock, logAt, from, seed = 5, binCount, pressAt = -9, saidAt = -9, saidRank = 0;

  function restart() {
    for (const r of recs.values()) { r.el.g.remove(); free.push(r.el); }
    recs.clear();
    for (const d of drops.splice(0)) d.g.remove();
    model = makeSim({ ui: cfg.ui, onFail: cfg.onFail, order: cfg.order, reads: cfg.reads, fail: Number(cfg.fail), server: cfg.server, taps: cfg.taps }, seed);
    seed = (seed * 7 + 3) % 9973 + 1;
    clock = 0; logAt = 0; from = 0; binCount = 0; saidAt = -9; saidRank = 0; held = null;
    paint(true);
    showStats();
  }

  // ---------- narration: the model's log ----------
  const like = (v) => (v ? T("LIKE", "ME GUSTA") : T("no like", "sin like"));
  let held = null;
  function say(rank, text) {
    // a message stays up at least 1.2 s of page time unless a more important one comes; a less important one waits
    const wall = performance.now() / 1000;
    if (rank < saidRank && wall - saidAt < 1.2) { held = { rank, text }; return; }
    held = null;
    saidRank = rank; saidAt = wall;
    root.figure.say(L(text));
  }
  function sayHeld() {
    if (held && performance.now() / 1000 - saidAt >= 1.2) { const h = held; held = null; saidRank = -1; say(h.rank, h.text); }
  }
  function narrate() {
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt];
      if (e.t > clock) break;
      const r = e.r, n = r && r.n ? "#" + r.n : "";
      if (e.type === "tap" || e.type === "disabled" || e.type === "queued") pressAt = e.t;
      switch (e.type) {
        case "tap": {
          const m = "#" + e.tap.req.n;
          if (cfg.ui === "pess") say(1, T("tap · " + m + " walks out · the screen waits", "toque · sale " + m + " · la pantalla espera"));
          else say(1, e.tap.value ? T("tap · LIKE shown at once · " + m + " walks out", "toque · ME GUSTA al instante · sale " + m)
            : T("tap · like removed at once · " + m + " walks out", "toque · like quitado al instante · sale " + m));
          break;
        }
        case "disabled": say(2, T("tap ignored · button disabled while saving", "toque ignorado · botón deshabilitado al guardar")); break;
        case "queued": say(1, T("tap · screen flips · waits for the save in flight", "toque · la pantalla cambia · espera al guardado")); break;
        case "write": if (r.slow) say(2, T(n + " written late (slow path) · server: " + like(r.value).en, n + " escrito tarde (camino lento) · servidor: " + like(r.value).es)); break;
        case "refused": say(2, T(n + " refused by the server", n + " rechazado por el servidor")); break;
        case "stale":
          if (e.cause === "read") say(4, T("a stale refetch landed · the like jumped back", "aterrizó una recarga vieja · el like volvió atrás"));
          else if (e.cause === "answer") say(4, T(n + " answered last · its old value wins", n + " respondió último · gana su valor viejo"));
          else say(4, T(n + " rolled back to an outdated snapshot", n + " volvió a una instantánea vieja"));
          break;
        case "ignored": say(3, T(n + " answered after a newer save · ignored", n + " respondió tras uno más nuevo · ignorada")); break;
        case "rollback": say(3, T(n + " failed · rolled back · NOT SAVED", n + " falló · revertido · NO SE GUARDÓ")); break;
        case "failSilent": say(4, T(n + " failed · unhandled · the screen keeps it", n + " falló · sin manejar · la pantalla lo mantiene")); break;
        case "failMoot": say(2, T(n + " failed · the user already tapped back", n + " falló · el usuario ya volvió a tocar")); break;
        case "notSaved": say(3, T(n + " failed · screen unchanged · NOT SAVED", n + " falló · pantalla sin cambios · NO SE GUARDÓ")); break;
        case "followUp": say(3, T(n + " back · user wants " + like(e.next.value).en + " now · sends #" + e.next.n, n + " volvió · ahora quiere " + like(e.next.value).es + " · envía #" + e.next.n)); break;
        case "cancel": say(2, T("save started · refetch in flight cancelled", "empezó un guardado · recarga cancelada")); break;
        case "answerChanged": if (cfg.ui === "pess") { const w = Math.round(1000 * (e.t - model.taps[r.tap].t)); say(2, T(n + " answered · shown " + w + " ms after the tap", n + " respondió · se ve " + w + " ms después del toque")); } break;
        case "settle":
          if (model.client.screen !== model.server.value) say(4, T("all in · screen and server disagree", "todo llegó · pantalla y servidor no coinciden"));
          else if (model.client.screen !== model.client.intent && Math.abs(model.client.toastAt - e.t) > 1e-9) say(3, T("all in · screen shows the value taken back", "todo llegó · la pantalla muestra lo que se quitó"));
          else say(0, T("all in · screen matches the server", "todo llegó · pantalla igual al servidor"));
          break;
      }
    }
    if (logAt > 4000) { model.log.splice(0, logAt); logAt = 0; }
  }

  // ---------- where a courier is ----------
  const NEAR = G.WINDOW_Y + 12;
  function where(r, now) {
    const slot = G.SLOT_X[r.id % G.SLOT_X.length];
    if (now < r.arrive) {
      const pts = [[G.LANES.out, G.ENTER_Y], [G.LANES.out, NEAR], [slot, G.WINDOW_Y]];
      return pointAlong(pts, polylineLength(pts) * clamp((now - r.sent) / (r.arrive - r.sent)));
    }
    if (now < r.commit) return [slot, G.WINDOW_Y];
    const pts = [[slot, G.WINDOW_Y], [G.LANES.back, NEAR], [G.LANES.back, G.ENTER_Y]];
    return pointAlong(pts, polylineLength(pts) * clamp((now - r.commit) / (r.done - r.commit)));
  }
  function slipOf(r, now) {
    const back = now >= r.commit;
    if (r.kind === "get") return { lit: back && r.value === true, label: "GET" };
    if (back && r.refused) return { lit: false, label: "ERR" };
    return { lit: r.value, label: "#" + r.n };
  }

  // ---------- painting ----------
  function paint(snap) {
    narrate();
    sayHeld();
    const c = model.client, s = model.server;
    setLit(pills.screen, c.screen);
    setLit(pills.server, s.value);
    setLit(cap, c.intent);
    const press = clock - pressAt < 0.04;
    capMove.setAttribute("transform", press ? translateAlong(P, [0, 0, -1]) : "");
    show(toastEl, c.toasts > 0 && clock - c.toastAt < 0.6);
    const saving = model.inflight.length > 0;
    show(lamps.savingOn, saving); show(lamps.savingOff, !saving);
    const off = !saving && c.screen !== s.value;
    show(lamps.syncOn, off); show(lamps.syncOff, !off);

    // couriers
    const reqs = model.reqs;
    while (from < reqs.length && reqs[from].done + LINGER < clock) {
      const r = reqs[from];
      if (recs.has(r.id)) { const x = recs.get(r.id); x.el.g.remove(); free.push(x.el); recs.delete(r.id); }
      from++;
    }
    const live = [];
    for (let i = from; i < reqs.length; i++) {
      const r = reqs[i];
      if (r.sent > clock) break;
      let x = recs.get(r.id);
      if (r.done + LINGER < clock) {
        if (x) { x.el.g.remove(); free.push(x.el); recs.delete(r.id); }
        continue;
      }
      if (!x) { x = { el: free.pop() || makeEl(), binned: false }; recs.set(r.id, x); walkLayer.appendChild(x.el.g); }
      const [px, py] = where(r, clock);
      const { lit, label } = slipOf(r, clock);
      dress(x.el, lit, label);
      // after handing in: an answer the app ignored (or a cancelled read) goes into the bin
      if (clock >= r.done && !x.binned && (r.fate === "ignored" || r.fate === "cancelled")) { x.binned = true; binCount++; dropSlip(lit); }
      const fade = clock >= r.done ? clamp(1 - (clock - r.done) / LINGER) : clamp((clock - r.sent) / (0.15 * (r.arrive - r.sent)));
      x.el.g.style.opacity = fade < 1 ? String(fade) : "";
      x.pos = [px, py, H];
      x.el.g.setAttribute("transform", translateAlong(P, x.pos));
      live.push(x);
    }
    // painter's order: far first
    const sorted = live.sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P));
    const kids = [...walkLayer.children];
    if (sorted.some((x, i) => x.el.g !== kids[i])) sorted.forEach((x) => walkLayer.appendChild(x.el.g));

    // slips falling from the end of the back lane into the bin
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i], u = (clock - d.born) / 0.12;
      if (u >= 1.6 || snap) { d.g.remove(); drops.splice(i, 1); continue; }
      const k = clamp(u);
      const p = [lerp(G.LANES.back, G.BIN_SPOT[0], k), lerp(G.ENTER_Y, G.BIN_SPOT[1], k), G.BIN_SPOT[2] + 10 * Math.sin(Math.PI * Math.min(1, k * 0.9)) + (1 - k) * 4];
      d.g.setAttribute("transform", translateAlong(P, p));
      d.g.style.opacity = u > 1 ? String(clamp(1.6 - u) / 0.6) : "";
    }

    counters.taps.setClamped(model.taps.length);
    counters.notSaved.setClamped(c.toasts);
    counters.late.setClamped(c.late);
    counters.ignored.setClamped(binCount);
    counters.writes.setClamped(s.writes);
  }

  // ---------- stats ----------
  const msText = (x) => Math.round(1000 * x) + " ms";
  function showStats() {
    const c = model.client;
    stat("taps", model.taps.length);
    const last = [...model.taps].reverse().find((x) => !x.ignored);
    stat("wait", !last ? "–" : last.shownAt !== null ? msText(last.shownAt - last.t) : cfg.ui === "pess" && model.inflight.length ? "…" : "–");
    stat("told", c.toasts);
    stat("late", c.late);
    stat("stale", c.stale);
    stat("sync", model.outOfSync.toFixed(1) + " s");
  }

  // ---------- the loop ----------
  let statTimer = 0;
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    clock += dt * cfg.speed;
    model.runTo(clock);
    paint(false);
    statTimer += dt; if (statTimer > 0.2) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = String(raw);
    if (!quiet) { restart(); say(9, T("settings applied · run restarted", "ajustes aplicados · corrida reiniciada")); }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const tap = (double) => { model.tap(clock, double); pressAt = clock; paint(false); showStats(); wake(); };
  const actions = {
    tap: () => tap(false),
    double: () => tap(true),
    reset: () => { restart(); say(9, T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const key of ["ui", "onFail", "order", "reads", "fail", "server", "taps"]) set(key, w[key], true);
    restart();
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

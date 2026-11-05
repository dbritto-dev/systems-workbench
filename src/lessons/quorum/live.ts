// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The vault row in the browser: runs the model a few hundred times slower than real time, slides the slips along the
// tracks, lights the doors that hold the newest version, and answers the controls. mount() gets the build-time data
// from page.ts (projection, geometry, the slip drawing) and root, the <wb-lesson>.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, setLit, playPause } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { clamp } from "../../lib/stats";
import { makeSim, N, NAMES, isDown } from "./sim";

export default function mount({ P, G, SLIP_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const layer = q('[data-layer="slips"]');
  const doors = Array.from({ length: N }, (_, i) => q(`[data-door="${i}"]`));
  const downs = Array.from({ length: N }, (_, i) => q(`[data-down="${i}"]`));
  const vCounters = Array.from({ length: N }, (_, i) => WB.counter(svg, "v" + i, P));
  const counters = Object.fromEntries(["ok", "failed", "stale", "lastOk", "read"].map((n) => [n, WB.counter(svg, n, P)]));
  const staleOn = q('[data-stale="on"]'), staleOff = q('[data-stale="off"]');
  const readers = q("[data-readers]");
  const plaques = { W: q('[data-plaque="W"]'), R: q('[data-plaque="R"]') };
  const LINGER = 0.15;                       // model ms a slip stays at the desk after it's back

  // ---------- slips: one pooled element per message on screen ----------
  const free = [], recs = new Map();
  function makeEl() {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = SLIP_SVG;
    return { g, slip: g.querySelector("[data-slip]"), text: g.querySelector("[data-slip-text]"), lit: null, label: null };
  }
  function dress(el, lit, label) {
    if (el.lit !== lit) { el.lit = lit; setLit(el.slip, lit); }
    if (el.label !== label) { el.label = label; setText(el.text, label); el.text.setAttribute("font-size", label.length > 3 ? 3.1 : 3.8); }
  }

  // ---------- settings and the run ----------
  const cfg = { R: 2, W: 2, down: 0, repl: "busy", repair: "off", readers: "one", speed: 0.0025 };
  let model, clock, logAt, from, seed = 5, lastRead = null, saidAt = -9, saidRank = 0, held = null;

  function restart() {
    for (const r of recs.values()) { r.el.g.remove(); free.push(r.el); }
    recs.clear();
    model = makeSim({ R: Number(cfg.R), W: Number(cfg.W), down: Number(cfg.down), repl: cfg.repl, repair: cfg.repair, readers: cfg.readers }, seed);
    seed = (seed * 7 + 3) % 9973 + 1;
    clock = 0; logAt = 0; from = 0; lastRead = null; saidAt = -9; saidRank = 0; held = null;
    for (let i = 0; i < N; i++) show(downs[i], isDown(i, Number(cfg.down)));
    show(readers, cfg.readers === "many");
    setText(plaques.W, "W = " + cfg.W);
    setText(plaques.R, "R = " + cfg.R);
    paint();
    showStats();
  }

  // ---------- narration: the model's log ----------
  function say(rank, text) {
    // a message stays up at least 1.4 s of page time unless a more important one comes; a less important one waits
    const wall = performance.now() / 1000;
    if (rank < saidRank && wall - saidAt < 1.4) { held = { rank, text }; return; }
    held = null;
    saidRank = rank; saidAt = wall;
    root.figure.say(L(text));
  }
  function sayHeld() {
    if (held && performance.now() / 1000 - saidAt >= 1.4) { const h = held; held = null; saidRank = -1; say(h.rank, h.text); }
  }
  const names = (list) => list.map((i) => NAMES[i]).join(", ");
  const msText = (x) => x.toFixed(1) + " ms";
  function narrate() {
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt];
      if (e.t > clock) break;
      const op = e.op, v = op && op.v ? "v" + op.v : "";
      const mine = op && op.who !== "reader";
      switch (e.type) {
        case "wSent": say(1, T("write " + v + " goes to every live vault · OK after " + op.need + " acks", "escritura " + v + " va a cada bóveda viva · OK tras " + op.need + " acks")); break;
        case "wOk": say(2, T(v + " acknowledged: " + op.need + " acks in " + msText(op.doneAt - op.t), v + " confirmada: " + op.need + " acks en " + msText(op.doneAt - op.t))); break;
        case "wUnavailable": say(4, T("write refused: W = " + op.need + ", only " + model.live.length + " vaults up · FAILED", "escritura rechazada: W = " + op.need + ", solo " + model.live.length + " bóvedas arriba · FALLIDA")); break;
        case "rUnavailable": if (mine) say(4, T("read refused: R = " + op.need + ", only " + model.live.length + " vaults up · FAILED", "lectura rechazada: R = " + op.need + ", solo " + model.live.length + " bóvedas arriba · FALLIDA")); break;
        case "rSent": if (mine) say(1, T((op.who === "writer" ? "read-back" : "your read") + " asks " + names(op.asked), (op.who === "writer" ? "la relectura" : "tu lectura") + " pregunta a " + names(op.asked))); break;
        case "lateApply": if (e.m.v === model.seq) say(0, T(NAMES[e.m.rep] + " is behind: applies v" + e.m.v + " late", NAMES[e.m.rep] + " va atrasada: aplica v" + e.m.v + " tarde")); break;
        case "repair": say(3, T("replies disagree · writing v" + op.result + " to " + names(e.old.map((m) => m.rep)) + " before answering", "las respuestas no coinciden · escribe v" + op.result + " en " + names(e.old.map((m) => m.rep)) + " antes de responder")); break;
        case "rDone": {
          lastRead = op;
          const got = "v" + op.result, from_ = names(op.asked);
          if (op.stale) say(5, T("read got " + got + " from " + from_ + " · STALE: v" + op.okBefore + " was acknowledged", "la lectura obtuvo " + got + " de " + from_ + " · VIEJA: v" + op.okBefore + " ya estaba confirmada"));
          else if (op.backwards) say(5, T("read got " + got + " from " + from_ + " · went back: a read already returned v" + op.seenBefore, "la lectura obtuvo " + got + " de " + from_ + " · retrocedió: otra ya había devuelto v" + op.seenBefore));
          else if (mine) say(2, T((op.who === "writer" ? "read-back" : "your read") + " got " + got + " from " + from_ + " · up to date", (op.who === "writer" ? "la relectura" : "tu lectura") + " obtuvo " + got + " de " + from_ + " · al día"));
          break;
        }
      }
    }
    if (logAt > 4000) { model.log.splice(0, logAt); logAt = 0; }
  }

  // ---------- where a slip is ----------
  // along track i, u = 0 at the desk, 1 at the door
  function pointOn(i, u) {
    return [lerp(G.DESK_X[i], G.VAULT_X[i], u), lerp(G.START_Y, G.DOOR_Y, u)];
  }
  const LEN = Math.hypot(G.VAULT_X[4] - G.DESK_X[4], G.DOOR_Y - G.START_Y);
  function slipOf(m, now) {
    if (now < m.served) {
      const lit = m.kind !== "r" && m.v === model.seq;
      return { lit, label: m.kind === "r" ? "GET" : "v" + m.v };
    }
    if (m.kind === "r") return { lit: m.v === model.seq && m.v > 0, label: "v" + m.v };
    return { lit: false, label: "ACK" };
  }

  // ---------- painting ----------
  function paint() {
    narrate();
    sayHeld();
    const seq = model.seq;
    for (let i = 0; i < N; i++) {
      const r = model.reps[i];
      setLit(doors[i], seq > 0 && r.version === seq);
      vCounters[i].setClamped(r.version);
    }
    counters.ok.setClamped(model.st.okW);
    counters.failed.setClamped(model.st.failW + model.st.failR);
    counters.stale.setClamped(model.st.stale);
    counters.lastOk.setClamped(model.lastOk);
    counters.read.setClamped(lastRead ? lastRead.result : 0);
    const stale = !!(lastRead && lastRead.stale);
    show(staleOn, stale); show(staleOff, !stale);

    // slips
    const msgs = model.msgs;
    while (from < msgs.length && msgs[from].done + LINGER < clock) {
      const m = msgs[from];
      if (recs.has(m.id)) { const x = recs.get(m.id); x.el.g.remove(); free.push(x.el); recs.delete(m.id); }
      from++;
    }
    const waiting = Array.from({ length: N }, () => 0);
    const live = [];
    for (let j = from; j < msgs.length; j++) {
      const m = msgs[j];
      if (m.sent > clock) break;
      let x = recs.get(m.id);
      if (m.done + LINGER < clock) {
        if (x) { x.el.g.remove(); free.push(x.el); recs.delete(m.id); }
        continue;
      }
      if (!x) { x = { el: free.pop() || makeEl() }; recs.set(m.id, x); layer.appendChild(x.el.g); }
      let u;
      if (clock < m.arrive) u = clamp((clock - m.sent) / (m.arrive - m.sent));
      else if (clock < m.served) {
        // waiting at the door: slips queue back along the track
        u = 1 - (waiting[m.rep]++ * 7) / LEN;
      } else u = 1 - clamp((clock - m.served) / (m.done - m.served));
      const [px, py] = pointOn(m.rep, u);
      const { lit, label } = slipOf(m, clock);
      dress(x.el, lit, label);
      const fade = clock >= m.done ? clamp(1 - (clock - m.done) / LINGER) : 1;
      x.el.g.style.opacity = fade < 1 ? String(fade) : "";
      x.pos = [px, py, 0];
      x.el.g.setAttribute("transform", translateAlong(P, x.pos));
      live.push(x);
    }
    // painter's order: far first
    const sorted = live.sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P));
    const kids = [...layer.children];
    if (sorted.some((x, i) => x.el.g !== kids[i])) sorted.forEach((x) => layer.appendChild(x.el.g));
  }

  // ---------- stats ----------
  function showStats() {
    const s = model.st;
    root.stat("ok", s.okW);
    root.stat("failed", s.failW + s.failR);
    root.stat("stale", s.reads ? s.stale + " · " + Math.round((100 * s.stale) / s.reads) + "%" : "0");
    root.stat("back", s.back);
    root.stat("wlat", model.lat.w.length ? msText(model.lat.w[model.lat.w.length - 1]) : "–");
    root.stat("rlat", model.lat.r.length ? msText(model.lat.r[model.lat.r.length - 1]) : "–");
  }

  // ---------- the loop ----------
  let statTimer = 0;
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    clock += dt * 1000 * cfg.speed;
    model.runTo(clock);
    paint();
    statTimer += dt; if (statTimer > 0.2) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = String(raw);
    if (!quiet) { restart(); say(9, T("settings applied · run restarted", "ajustes aplicados · ejecución reiniciada")); }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    write: () => { model.visitor("write", clock); paint(); showStats(); wake(); },
    read: () => { model.visitor("read", clock); paint(); showStats(); wake(); },
    reset: () => { restart(); say(9, T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const key of ["R", "W", "down", "repl", "repair", "readers"]) set(key, w[key], true);
    restart();
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

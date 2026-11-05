// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The records desk in the browser: runs the model in slow motion, walks each office's courier to the desk and back,
// turns the clocks, shows the record's stamp (and a sibling), drops lost edits into the tray, and answers the
// controls. mount() gets the build-time data from page.ts (projection, geometry, the courier drawing) and root, the
// <wb-lesson>.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, setLit, playPause } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { clamp } from "../../lib/stats";
import { makeSim, OFFICES, FAST, EPOCH } from "./sim";

const STEP_AT = 40;          // live: model ms into the run when NTP steps A's clock back
const IDLE_BOOST = 10;       // how much faster the machine plays while both offices wait between edits

export default function mount({ P, G, COURIER_SVG, SLIP_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const walkLayer = q('[data-layer="walk"]'), dropLayer = q('[data-layer="drop"]');
  const counters = Object.fromEntries(["edits0", "lost0", "edits1", "lost1", "lines", "siblings"].map((n) => [n, WB.counter(svg, n, P)]));
  const dials = [WB.dial(svg, "clock0", P), WB.dial(svg, "clock1", P)], trueDial = WB.dial(svg, "true", P);
  const clockText = [q('[data-clock-text="0"]'), q('[data-clock-text="1"]')], trueText = q("[data-time-text]");
  const cards = [q('[data-card="0"]'), q('[data-card="1"]')], cardText = [q('[data-card-text="0"]'), q('[data-card-text="1"]')];

  // ---------- couriers: one per office ----------
  const couriers = [0, 1].map(() => {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = COURIER_SVG;
    walkLayer.appendChild(g);
    return { g, slip: g.querySelector("[data-slip]"), text: g.querySelector("[data-slip-text]"), label: null, pos: [0, 0, 0] };
  });
  function dress(c, label) {
    if (c.label === label) return;
    c.label = label;
    setText(c.text, label);
    show(c.slip, label !== "");
  }
  // lit slips falling into the tray (page time, so they fall at the same pace at every speed)
  const drops = [];
  let pageT = 0;
  function drop(from) {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = SLIP_SVG;
    setLit(g, true);
    dropLayer.appendChild(g);
    drops.push({ g, from, born: pageT });
  }

  // ---------- settings and the run ----------
  const cfg = { rule: "lww", clocks: "ntp", speed: 0.004 };
  let model, clock, logAt, seed = 5, handled, saidAt = -9, saidRank = 0, held = null;

  function restart() {
    for (const d of drops.splice(0)) d.g.remove();
    model = makeSim({ rule: cfg.rule, clocks: cfg.clocks, stepAt: STEP_AT }, seed);
    seed = (seed * 7 + 3) % 9973 + 1;
    clock = 0; logAt = 0; handled = new Set(); saidAt = -9; saidRank = 0; held = null;
    WB.pose(svg, "rule", cfg.rule);
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
  const who = (i) => OFFICES[i];
  function narrate() {
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt];
      if (e.t > clock) break;
      const w = e.w, s = e.s, a = w ? who(w.office) : "";
      switch (e.type) {
        case "send": say(0, T(a + " sends its edit · stamp " + w.label, a + " envía su edición · sello " + w.label)); break;
        case "won":
          if (cfg.rule === "vector") say(1, T(a + "'s " + w.label + " has seen the record · replaces it", w.label + " de " + a + " ya vio el registro · lo reemplaza"));
          else say(1, T(a + "'s " + w.label + " is the highest stamp · kept", w.label + " de " + a + " es el sello más alto · queda"));
          break;
        case "older":
          if (s.office === w.office) say(4, T(a + " had read its own " + s.label + " but stamped " + w.label + " · dropped, OK sent", a + " leyó su propio " + s.label + " pero selló " + w.label + " · descartada, OK enviado"));
          else say(4, T(a + " had read " + who(s.office) + "'s " + s.label + " but stamped " + w.label + " · dropped, OK sent", a + " leyó " + s.label + " de " + who(s.office) + " pero selló " + w.label + " · descartada, OK enviado"));
          break;
        case "conc": say(3, T(a + "'s " + w.label + " loses to " + who(s.office) + "'s " + s.label + " · both edited one copy", w.label + " de " + a + " pierde ante " + s.label + " de " + who(s.office) + " · editaron la misma copia")); break;
        case "over": say(3, T(a + "'s " + w.label + " overwrites " + who(s.office) + "'s " + s.label + " · both edited one copy", w.label + " de " + a + " pisa " + s.label + " de " + who(s.office) + " · editaron la misma copia")); break;
        case "sibling": {
          const others = w.with.map((id) => model.writes[id].label).join(", ");
          say(3, T(w.label + " and " + others + " haven't seen each other · both kept", w.label + " y " + others + " no se vieron · quedan las dos"));
          break;
        }
        case "merge": say(2, T(who(e.office) + " reads two siblings · merges their lines", who(e.office) + " lee dos hermanas · une sus líneas")); break;
      }
    }
    if (logAt > 4000) { model.log.splice(0, logAt); logAt = 0; }
  }

  // ---------- where a courier is, and what its slip says ----------
  const COPY = () => L("COPY", "COPIA");
  function courierAt(i) {
    const o = model.offices[i], r = o.trip, x = G.LANE_X[i];
    if (!r) return { y: G.HOME_Y, label: o.phase === "think" ? COPY() : "" };
    if (clock < r.arrive) return { y: lerp(G.HOME_Y, G.DESK_Y, clamp((clock - r.sent) / (r.arrive - r.sent))), label: r.kind === "read" ? "GET" : r.label };
    return { y: lerp(G.DESK_Y, G.HOME_Y, clamp((clock - r.arrive) / (r.done - r.arrive))), label: r.kind === "read" ? COPY() : "OK" };
  }

  // ---------- painting ----------
  const cardLabel = (x) => (x && x.id >= 0 ? who(x.office) + " · " + x.label : "—");
  function paint() {
    narrate();
    sayHeld();
    // clocks
    for (const i of [0, 1]) {
      const w = model.wall(i, clock);
      setText(clockText[i], w.toFixed(1));
      dials[i].set((((w - EPOCH) % 100) + 100) % 100 / 100);
    }
    setText(trueText, (EPOCH + clock).toFixed(1));
    trueDial.set((clock % 100) / 100);
    // the record
    if (cfg.rule === "vector") {
      const s = model.sibs;
      setText(cardText[0], cardLabel(s[0]));
      show(cards[1], s.length > 1);
      if (s.length > 1) setText(cardText[1], cardLabel(s[s.length - 1]));
      setLit(cards[1], s.length > 1);
    } else {
      setText(cardText[0], cardLabel(model.rec));
      show(cards[1], false);
    }
    // couriers, far one first
    for (const i of [0, 1]) {
      const c = couriers[i], { y, label } = courierAt(i);
      dress(c, label);
      c.pos = [G.LANE_X[i], y, 0.8];
      c.g.setAttribute("transform", translateAlong(P, c.pos));
    }
    const order = [...couriers].sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P));
    if (walkLayer.firstChild !== order[0].g) order.forEach((c) => walkLayer.appendChild(c.g));
    // edits the desk dropped (or overwrote) since the last frame fall into the tray
    const ws = model.writes;
    for (let j = Math.max(0, ws.length - 8); j < ws.length; j++) {
      const w = ws[j];
      if (handled.has(w.id) || w.arrive > clock) continue;
      handled.add(w.id);
      if (w.fate === "older" || w.fate === "conc") drop([G.LANE_X[w.office], G.DESK_Y, 8]);
      else if (w.fate === "over") drop([G.CARDS[0].x + G.CARDS[0].w / 2, G.BOARD_FACE + 2, G.CARD_Z + 2]);
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i], u = (pageT - d.born) / 0.7;
      if (u >= 1.5) { d.g.remove(); drops.splice(i, 1); continue; }
      const k = clamp(u), [x0, y0, z0] = d.from, [x1, y1, z1] = G.TRAY_SPOT;
      const p = [lerp(x0, x1, k), lerp(y0, y1, k), lerp(z0, z1, k) + 10 * Math.sin(Math.PI * k)];
      d.g.setAttribute("transform", translateAlong(P, p));
      d.g.style.opacity = u > 1 ? String(clamp((1.5 - u) / 0.5)) : "";
    }
    counters.lines.setClamped(model.lines().length);
    counters.siblings.setClamped(model.st.siblings);
  }

  // ---------- stats ----------
  const signed = (x) => (x > 0.05 ? "+" : x < -0.05 ? "−" : "") + Math.abs(x).toFixed(1) + " ms";
  function showStats() {
    const ws = model.writes, alive = model.alive();
    const by = [0, 1].map((i) => { let edits = 0, lost = 0; for (const w of ws) if (w.office === i) { edits++; if (!alive.has(w.id)) lost++; } return { edits, lost }; });
    for (const i of [0, 1]) { counters["edits" + i].setClamped(by[i].edits); counters["lost" + i].setClamped(by[i].lost); }
    root.stat("edits", ws.length);
    root.stat("lost", by[0].lost + by[1].lost);
    root.stat("older", model.st.older);
    root.stat("siblings", model.st.siblings);
    root.stat("skew", signed(model.offset(0, clock) - model.offset(1, clock)));
    const kept = (b) => (b.edits ? Math.round((100 * (b.edits - b.lost)) / b.edits) + "%" : "–");
    root.stat("kept", kept(by[0]) + " · " + kept(by[1]));
  }

  // ---------- the loop ----------
  let statTimer = 0;
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    pageT += dt;
    const before = clock;
    // while both offices wait between edits, play ten times faster, up to the moment the next edit starts
    const busy = model.offices.some((o) => o.phase !== "idle");
    if (busy) clock += dt * 1000 * cfg.speed;
    else clock = Math.max(clock + dt * 1000 * cfg.speed, Math.min(clock + dt * 1000 * cfg.speed * IDLE_BOOST, ...model.offices.map((o) => o.nextAt)));
    model.runTo(clock);
    if (cfg.clocks === "step" && before < STEP_AT && clock >= STEP_AT) say(5, T("NTP steps A's clock back " + FAST + " ms · the record keeps A's last stamp", "NTP atrasa el reloj de A " + FAST + " ms de un salto · el registro guarda el último sello de A"));
    paint();
    statTimer += dt; if (statTimer > 0.2) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = String(raw);
    if (!quiet) { restart(); say(9, T("settings applied · run restarted, new clock offsets", "ajustes aplicados · ejecución reiniciada, nuevos desfases")); }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const edit = (i) => {
    if (model.poke(i, clock)) say(6, T(who(i) + " starts an edit · GET", who(i) + " empieza una edición · GET"));
    else say(6, T(who(i) + " is busy with an edit", who(i) + " está ocupada con una edición"));
    paint(); showStats(); wake();
  };
  const actions = {
    editA: () => edit(0),
    editB: () => edit(1),
    reset: () => { restart(); say(9, T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const key of ["rule", "clocks"]) set(key, w[key], true);
    restart();
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

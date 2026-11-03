// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The ticket dispenser in the browser: runs the model a ticket's ride ahead, moves the tickets, discs, flaps and
// window dials, and answers the controls. mount() gets the build-time data from page.ts (geometry, the ticket
// drawing) and root, the <wb-lesson>.
import { lineOnTop, translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { playPause } from "../../runtime/dom";
import { easeInOutCubic as ease } from "../../lib/tween";
import { makeSim, levelOf, TRAVEL } from "./sim";

export default function mount({ P, G, TICKET_SVG }, root) {
  const POOL = 70, PASS_TIME = 0.9, BACK_TIME = 0.6, DROP_TIME = 0.3;

  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (v) => root.figure.say(L(v));
  const NS = "http://www.w3.org/2000/svg";
  const groups = [0, 1].map((i) => q('[data-group="' + i + '"]'));
  const ups = [0, 1].map((i) => q('[data-up="' + i + '"]'));
  const downs = [0, 1].map((i) => q('[data-down="' + i + '"]'));
  const flaps = G.LANES.map((_, i) => q('[data-flap="' + i + '"]'));
  const dials = [0, 1].map((i) => q('[data-dial="' + i + '"]'));
  const tubes = {};
  for (const el of svg.querySelectorAll("[data-tube]")) tubes[el.dataset.tube] = { el, discs: [...el.querySelectorAll("[data-disc]")], drop: el.querySelector("[data-drop]"), shown: -1, dropT: -1 };

  const cfg = { rate: 4, capacity: 8, algorithm: "bucket", window: 2, mode: "global", noisy: false, noisyRate: 8, behaviour: "after", instances: 1, demand: [1, 1, 1], speed: 1 };
  let sim, clock, snaps, initial, decided, tickets;
  let seed = (Date.now() % 1e6) + 1;

  // The pool of ticket groups the figure reuses.
  const pool = Array.from({ length: POOL }, () => { const g = document.createElementNS(NS, "g"); g.innerHTML = TICKET_SVG; g.style.display = "none"; return { g, solid: g.firstElementChild, busy: false }; });

  function restart() {
    sim = makeSim({ ...cfg }, seed++);
    clock = 0; decided = []; tickets = [];
    snaps = sim.limiters.map((row) => row.map(() => []));
    initial = sim.limiters.map((row) => row.map((l) => ({ ...l })));
    pool.forEach((p) => { p.busy = false; p.g.style.display = "none"; });
    groups[1].toggleAttribute("data-off", cfg.instances < 2);
    for (const [key, t] of Object.entries(tubes)) {
      const [inst, which] = key.split("-");
      const shown = cfg.mode === "client" ? which !== "g" : which === "g";
      t.el.style.display = shown ? "" : "none";
      t.used = shown && Number(inst) < cfg.instances; t.shown = -1;
      if (shown && !t.used) t.discs.forEach((d, n) => (d.style.display = n < (which === "g" ? cfg.capacity : Math.ceil(cfg.capacity / 3)) ? "" : "none"));
    }
    dials.forEach((d) => d.setAttribute("d", ""));
    resetCounts();
    showStats();
    paint();
  }

  function limiterOf(instance, client) { return cfg.mode === "client" ? [instance, client] : [instance, 0]; }
  function stateAt(i, j, t) {
    const list = snaps[i][j];
    let s = initial[i][j];
    for (let n = list.length - 1; n >= 0; n--) if (list[n].t <= t) { s = list[n].l; break; }
    return s;
  }

  function onDecision(d) {
    const [i, j] = limiterOf(d.instance, d.client);
    snaps[i][j].push({ t: d.t, l: { ...sim.limiters[i][j] } });
    decided.push(d);
    tickets.push({ d, lane: d.instance * 3 + d.client, start: d.t - TRAVEL, slot: null, said: false });
  }

  function laneY(lane) { return G.LANES[lane].y; }
  function place(p, x, y, z, lit, opacity) {
    p.g.setAttribute("transform", translateAlong(P, [x, y, z]));
    p.g.style.display = "";
    p.g.style.opacity = String(opacity);
    p.solid.toggleAttribute("data-lit", lit);
  }

  function paint() {
    // Tubes: discs present at this moment.
    for (const [key, t] of Object.entries(tubes)) {
      if (!t.used) continue;
      const [inst, which] = key.split("-");
      const i = Number(inst), j = which === "g" ? 0 : Number(which);
      const s = stateAt(i, j, clock);
      const level = Math.max(0, Math.min(t.discs.length, Math.floor(levelOf(s, clock) + 1e-9)));
      if (t.shown >= 0 && level === t.shown + 1 && s.kind === "bucket") t.dropT = 0;
      t.shown = level;
      t.discs.forEach((d, n) => { d.style.display = n < level ? "" : "none"; });
    }
    // Window dials.
    dials.forEach((el, i) => {
      if (cfg.algorithm !== "window" || i >= cfg.instances) { el.setAttribute("d", ""); return; }
      const a = ((clock % cfg.window) / cfg.window) * Math.PI * 2, [x, y] = G.DIALS[i];
      el.setAttribute("d", lineOnTop([x, y], [x + Math.sin(a) * 3.2, y - Math.cos(a) * 3.2], 32.5, P));
    });
    // Tickets.
    const lifted = new Set();
    pool.forEach((p) => (p.busy = false));
    let used = 0;
    tickets = tickets.filter((tk) => clock < tk.d.t + (tk.d.ok ? PASS_TIME : BACK_TIME) + 0.05);
    for (const tk of tickets) {
      if (clock < tk.start) continue;
      if (used >= POOL) break;
      const p = pool[used++]; p.busy = true;
      const y = laneY(tk.lane), inst = G.LANES[tk.lane].instance;
      let x, z = G.TICKET.z, lit = false, opacity = 1, after = false;
      if (clock < tk.d.t) { const u = (clock - tk.start) / TRAVEL; x = G.SENDER_X + (G.GATE_X - 7 - G.SENDER_X) * u; opacity = Math.min(1, u * 5); }
      else if (tk.d.ok) { const u = (clock - tk.d.t) / PASS_TIME; x = G.GATE_X - 7 + (G.TRAY_X - G.GATE_X + 7) * ease(Math.min(1, u)); after = x > G.GATE_X; opacity = u > 0.8 ? (1 - u) / 0.2 : 1; if (u < 0.4) lifted.add(tk.lane); }
      else { const u = (clock - tk.d.t) / BACK_TIME; x = G.GATE_X - 7 - (G.GATE_X - 7 - G.SENDER_X) * ease(Math.min(1, u)); lit = true; opacity = u > 0.85 ? (1 - u) / 0.15 : 1; }
      const parent = after ? downs[inst] : ups[inst];
      if (p.g.parentNode !== parent) parent.appendChild(p.g);
      place(p, x, y, z, lit, Math.max(0, opacity));
      if (!tk.said && clock >= tk.d.t) {
        tk.said = true;
        const name = "ABC"[tk.d.client];
        say(tk.d.ok
          ? T("client " + name + " · allowed" + (cfg.instances > 1 ? " by instance " + (tk.d.instance + 1) : ""), "cliente " + name + " · permitida" + (cfg.instances > 1 ? " por la instancia " + (tk.d.instance + 1) : ""))
          : T("client " + name + " · 429" + (tk.d.attempt > 1 ? " (attempt " + tk.d.attempt + ")" : ""), "cliente " + name + " · 429" + (tk.d.attempt > 1 ? " (intento " + tk.d.attempt + ")" : "")));
      }
    }
    pool.forEach((p) => { if (!p.busy) p.g.style.display = "none"; });
    flaps.forEach((f, i) => f.setAttribute("transform", lifted.has(i) ? translateAlong(P, [0, 0, 6]) : ""));
  }

  function animateDrops(dt) {
    for (const t of Object.values(tubes)) {
      if (t.dropT < 0 || !t.used) { t.drop.style.opacity = "0"; continue; }
      t.dropT += dt / DROP_TIME;
      if (t.dropT >= 1) { t.dropT = -1; t.drop.style.opacity = "0"; continue; }
      const top = G.TUBE_BASE + t.discs.length * G.DISC.h + 6, landing = G.TUBE_BASE + Math.max(0, t.shown - 1) * G.DISC.h;
      t.drop.setAttribute("transform", translateAlong(P, [0, 0, top + (landing - top) * t.dropT * t.dropT]));
      t.drop.style.opacity = "1";
    }
  }

  const stat = (key, value) => root.stat(key, value);
  let counts, recent;
  function resetCounts() { counts = { attempts: 0, allowed: 0, quiet: 0, quietRejected: 0, peak: 0, next: 0 }; recent = []; }
  function showStats() {
    while (counts.next < decided.length && decided[counts.next].t <= clock) {
      const d = decided[counts.next++];
      counts.attempts++;
      if (d.client !== 2) { counts.quiet++; if (!d.ok) counts.quietRejected++; }
      if (d.ok) { counts.allowed++; recent.push(d.t); while (recent[0] < d.t - 30) recent.shift(); let n = 0; for (let i = recent.length - 1; i >= 0 && recent[i] >= d.t - 1; i--) n++; counts.peak = Math.max(counts.peak, n); }
    }
    if (counts.next > 2000) { decided.splice(0, counts.next); counts.next = 0; }
    stat("attempts", counts.attempts);
    stat("allowed", counts.allowed);
    stat("rejected", counts.attempts - counts.allowed);
    const span = Math.min(clock, 30);
    stat("perMinute", span > 3 ? Math.round((recent.filter((t) => t > clock - span).length / span) * 60) : "–");
    stat("quiet", counts.quiet ? Math.round((100 * counts.quietRejected) / counts.quiet) + "%" : "–");
    stat("peak", counts.peak);
  }

  let statTimer = 0;
  function step(dt) {
    const s = dt * cfg.speed;
    clock += s;
    sim.runTo(clock + TRAVEL, onDecision);
    paint(); animateDrops(s);
    statTimer += dt; if (statTimer > 0.25) { statTimer = 0; showStats(); }
  }

  // ---------- controls ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage, step, onPause: pause.onPause });
  pause.bind(loop);
  const NUMERIC = ["rate", "capacity", "instances", "speed"];
  function set(name, raw, quiet) {
    const value = NUMERIC.includes(name) ? Number(raw) : name === "noisy" ? raw === true || raw === "true" : raw;
    cfg[name] = value;
    root.press(name, raw);
    if (name !== "speed" && !quiet) { restart(); say(T("settings applied · run restarted", "ajustes aplicados · corrida reiniciada")); }
  }
  function burst(client = 0, n = 20) {
    const t0 = clock + TRAVEL + 0.05;
    for (let i = 0; i < n; i++) sim.add(t0 + i * 0.02, client);
    say(T("client " + "ABC"[client] + " · burst of " + n, "cliente " + "ABC"[client] + " · ráfaga de " + n));
    if (loop.paused) loop.setPaused(false);
  }
  root.on("change", (name, value) => set(name, value));
  const actions = {
    burst: () => burst(),
    reset: () => { restart(); say(T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w, id) => {
    for (const name of ["rate", "capacity", "algorithm", "mode", "noisy", "behaviour", "instances"]) set(name, String(w[name]), true);
    cfg.demand = w.heavy ? [2.5, 2.5, 2.5] : [1, 1, 1];
    restart();
    if (loop.paused) loop.setPaused(false);
    if (w.burst) setTimeout(() => burst(0, id === "retry" ? 30 : 20), 2500);
    say(T("watching: " + id, "observando: " + id));
  });

  loop.setPaused(loop.paused);
  restart();
}

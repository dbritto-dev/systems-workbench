// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The ticket office in the browser: steps the model, walks the pawns to the line, the windows, the garden and the
// plaza, swings the load gauge, wires the controls and the experiment cards. mount() gets the build-time data from
// page.ts (geometry, the pawn and ticket drawings, results).
import { lineOnTop, translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats, act, pauseControls, setLit } from "../../runtime/dom";
import { pct } from "../../lib/format";
import { createOffice } from "./sim";

export default function mount({ P, G, PAWN, TICKET, LEDGE_TICKET, RESULTS, EXPERIMENTS }, root) {
  const stage = document.querySelector("[data-office]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const sayText = readout();
  const say = (v) => sayText(L(v));
  const people = q("[data-people]"), ticketsLayer = q("[data-tickets]"), ledgeLayer = q("[data-ledge]"), needle = q("[data-needle]");
  const still = WB.still;
  const NS = "http://www.w3.org/2000/svg";

  const settings = { retries: 3, backoff: "none", jitter: false, timeout: 3, layers: 1, budget: false };
  let speed = 1, seed = 1;
  let office, pawns, homeOf, base, emaAttempts, emaAnswered, lastCounts, peak, rushAt, pendingRush;

  function group(markup) { const g = document.createElementNS(NS, "g"); g.innerHTML = markup; return g; }
  const ticketPool = Array.from({ length: G.QUEUE_SHOWN }, () => { const g = group(TICKET); g.style.display = "none"; ticketsLayer.appendChild(g); return g; });
  const ledgePool = G.LEDGE_SPOTS.map(() => { const g = group(LEDGE_TICKET); g.style.display = "none"; ledgeLayer.appendChild(g); return g; });
  G.LEDGE_SPOTS.forEach((p, i) => ledgePool[i].setAttribute("transform", translateAlong(P, [p[0], p[1], 0])));

  function queueSpot(i) {
    const lane = Math.min(G.LANES.length - 1, Math.floor(i / G.PER_LANE));
    const j = Math.min(G.PER_LANE - 1, i - lane * G.PER_LANE);
    const x = lane % 2 === 0 ? G.LANE_X[1] - j * G.STEP : G.LANE_X[0] + j * G.STEP;
    return [x, G.LANES[lane]];
  }
  const spread = (id) => { const h = Math.sin(id * 12.9898) * 43758.5453; return h - Math.floor(h); };

  function start() {
    seed += 1;
    office = createOffice({ ...settings }, seed);
    people.innerHTML = ""; pawns = new Map(); homeOf = new Map();
    let n = 0; office.clients.forEach((c) => homeOf.set(c.id, n++));
    base = { ...office.counts }; emaAttempts = 0; emaAnswered = 0; lastCounts = { ...office.counts }; peak = 0; rushAt = null; pendingRush = null;
    showStats();
  }

  function targetOf(c, index) {
    if (c.phase === "waiting") {
      const slot = office.slots.indexOf(c.ticket);
      if (slot >= 0) return G.WINDOW_SPOTS[slot];
      const i = index.get(c.ticket);
      return queueSpot(i === undefined ? 0 : Math.min(i, G.QUEUE_SHOWN - 1));
    }
    if (c.phase === "bench") {
      const y = G.GARDEN_Y[0] + 8 + spread(c.id) * (G.GARDEN_Y[1] - G.GARDEN_Y[0] - 14);
      return [-G.PER_SECOND * c.backoff, y];
    }
    if (c.phase === "away") return G.HOMES[homeOf.get(c.id) % G.HOMES.length];
    return G.GATE;
  }

  function paintPeople(dt) {
    const index = new Map(); office.queue.forEach((id, i) => index.set(id, i));
    const alive = new Set();
    for (const c of office.clients) {
      alive.add(c.id);
      let p = pawns.get(c.id);
      if (!p) {
        const start = c.kind === "visitor" ? [G.GATE[0], G.GATE[1]] : (G.HOMES[homeOf.get(c.id) % G.HOMES.length] || G.GATE);
        p = { el: group(PAWN), x: start[0], y: start[1], lit: false };
        people.appendChild(p.el); pawns.set(c.id, p);
      }
      const [tx, ty] = targetOf(c, index);
      const dx = tx - p.x, dy = ty - p.y, dist = Math.hypot(dx, dy), stepLen = 140 * dt;
      if (dist <= stepLen || still.matches) { p.x = tx; p.y = ty; } else { p.x += dx / dist * stepLen; p.y += dy / dist * stepLen; }
      p.el.setAttribute("transform", translateAlong(P, [p.x, p.y, 0]));
      const lit = (c.phase === "waiting" || c.phase === "bench") && c.used.some((u) => u > 0);
      if (lit !== p.lit) { p.lit = lit; setLit(p.el, lit); }
      p.el.style.opacity = c.phase === "leaving" ? String(Math.max(0, Math.min(1, (c.until - office.t) / 1.2))) : "";
    }
    for (const [id, p] of pawns) if (!alive.has(id)) { p.el.remove(); pawns.delete(id); }
    const sorted = [...pawns.values()].sort((a, b) => depthOf([a.x, a.y, 0], P) - depthOf([b.x, b.y, 0], P));
    sorted.forEach((p) => people.appendChild(p.el));
    // Abandoned tickets: on the floor in the line, on the ledge when a window serves one.
    let used = 0;
    for (let i = 0; i < office.queue.length && i < G.QUEUE_SHOWN; i++) {
      const t = office.tickets.get(office.queue[i]);
      if (!t || !t.abandoned) continue;
      const [x, y] = queueSpot(i);
      const g = ticketPool[used++];
      g.style.display = ""; g.setAttribute("transform", translateAlong(P, [x, y, 0]));
    }
    for (; used < ticketPool.length; used++) ticketPool[used].style.display = "none";
    office.slots.forEach((id, i) => { const t = id !== null && office.tickets.get(id); ledgePool[i].style.display = t && t.abandoned ? "" : "none"; });
  }

  function measure(dt) {
    const c = office.counts;
    const tau = 1.5, w = 1 - Math.exp(-dt / tau);
    emaAttempts += ((c.attempts - lastCounts.attempts) / Math.max(dt, 1e-6) - emaAttempts) * w;
    emaAnswered += ((c.goodput - lastCounts.goodput) / Math.max(dt, 1e-6) - emaAnswered) * w;
    lastCounts = { ...c };
    const bins = office.bins, now = Math.floor(office.t);
    if (bins[now - 1] && rushAt !== null && now - 1 > rushAt + 1) peak = Math.max(peak, bins[now - 1].attempts);
  }

  const stat = stats();
  function showStats() {
    if (!office) return;
    const c = office.counts;
    stat("attempts", emaAttempts.toFixed(1));
    stat("answered", emaAnswered.toFixed(1));
    stat("line", office.queue.length);
    stat("wasted", c.wasted - base.wasted);
    stat("failed", c.failed - base.failed);
    stat("peak", rushAt === null ? "–" : String(peak));
  }

  function describe() {
    const bins = office.bins, now = Math.floor(office.t);
    let recent = 0; for (let i = Math.max(0, now - 4); i <= now; i++) recent += bins[i] ? bins[i].timeouts : 0;
    const retrying = office.clients.filter((c) => (c.phase === "waiting" || c.phase === "bench") && c.used.some((u) => u > 0)).length;
    const line = office.queue.length;
    const left = office.queue.reduce((n, id) => n + (office.tickets.get(id) && office.tickets.get(id).abandoned ? 1 : 0), 0);
    if (rushAt !== null && office.t - rushAt < 2) return T("rush · 16 visitors at the gate", "avalancha · 16 visitantes en la entrada");
    if (!recent) return T("calm · " + line + " in line", "calma · " + line + " en la fila");
    return T("storm · " + line + " in line, " + left + " left behind · " + retrying + " retrying", "tormenta · " + line + " en la fila, " + left + " abandonados · " + retrying + " reintentando");
  }

  function step(dt) {
    const sim = dt * speed;
    const steps = Math.max(1, Math.round(sim / office.cfg.dt));
    for (let i = 0; i < steps; i++) office.step(sim / steps);
    if (pendingRush !== null && office.t >= pendingRush) { pendingRush = null; rush(); }
    measure(sim);
    paintPeople(dt * Math.min(speed, 3));
    needle.setAttribute("d", needleD(emaAttempts));
    say(describe());
    showStats();
  }
  function needleD(value) {
    const a = G.GAUGE_FROM + G.GAUGE_SPAN * Math.min(1, value / G.GAUGE_MAX);
    const [gx, gy] = G.GAUGE;
    return lineOnTop([gx - Math.sin(a) * 2.6, gy + Math.cos(a) * 2.6], [gx + Math.sin(a) * (G.GAUGE_R - 4), gy - Math.cos(a) * (G.GAUGE_R - 4)], G.GAUGE_Z + 0.2, P);
  }

  // ---------- controls ----------
  const pause = pauseControls(stage, sayText);
  const loop = WB.loop({ stage, step, onPause: pause.onPause });
  pause.bind(loop);
  const pressSeg = WB.pressSeg;
  function set(name, raw) {
    if (name === "speed") { speed = Number(raw); pressSeg(name, raw); return; }
    const value = name === "jitter" || name === "budget" ? String(raw) === "true" : name === "backoff" ? raw : Number(raw);
    settings[name] = value;
    office.setConfig({ [name]: value });
    pressSeg(name, raw);
  }
  function rush() { office.trigger(); rushAt = office.t; peak = 0; office.clients.forEach((c) => { if (!homeOf.has(c.id)) homeOf.set(c.id, -1); }); }
  WB.onSegments((name, value) => set(name, value));
  act("rush").addEventListener("click", () => { rush(); if (loop.paused) loop.setPaused(false); });
  act("restart").addEventListener("click", () => { start(); paintPeople(0); });

  // ---------- experiments (results computed at build time from the same model, 16 seeds each) ----------
  const storm = (r) => r.recoveredShare === 0 ? "2 min+" : Math.round(r.recovery) + " s";
  const stormEs = (r) => r.recoveredShare === 0 ? "más de 2 min" : Math.round(r.recovery) + " s";
  const stormT = (r) => T(storm(r), stormEs(r));
  const stormShare = (r) => Math.min(1, r.recovery / 120);
  const perSec = (x) => x.toFixed(1) + "/s";
  const RUNS = {
    retry: () => {
      const { a, b } = RESULTS.retry;
      return { verdict: T("Without retries the trouble was over " + storm(a) + " after the rush. With three immediate retries it had not ended after 2 minutes in " + pct(1 - b.recoveredShare) + " of runs: " + b.attemptsPerRequest.toFixed(1) + " attempts per request, and only " + perSec(b.goodputRate) + " answered instead of " + perSec(a.goodputRate) + ".",
          "Sin reintentos, el problema terminó " + stormEs(a) + " después de la avalancha. Con tres reintentos inmediatos no había terminado después de 2 minutos en el " + pct(1 - b.recoveredShare) + " de las ejecuciones: " + b.attemptsPerRequest.toFixed(1) + " intentos por solicitud, y solo " + perSec(b.goodputRate) + " respondidos en lugar de " + perSec(a.goodputRate) + "."),
        groups: [[T("Trouble lasted", "El problema duró"), [[T("No retries", "Sin reintentos"), stormShare(a), stormT(a)], [T("3 immediate retries", "3 reintentos inmediatos"), stormShare(b), stormT(b), true]]],
          [T("Answered per second", "Respondidos por segundo"), [[T("No retries", "Sin reintentos"), a.goodputRate / 3, perSec(a.goodputRate)], [T("3 immediate retries", "3 reintentos inmediatos"), b.goodputRate / 3, perSec(b.goodputRate), true]]]] };
    },
    backoff: () => {
      const { a, b } = RESULTS.backoff;
      return { verdict: T("With backoff the storm ended " + (b.recoveredShare === 1 ? "in every run" : "in " + pct(b.recoveredShare) + " of runs") + ", after " + storm(b) + " on average. The tallest wave of attempts after the rush was still " + perSec(b.peak) + " (immediate retries: " + perSec(a.peak) + "), against a capacity of 3/s.",
          "Con espera exponencial, la tormenta terminó " + (b.recoveredShare === 1 ? "en todas las ejecuciones" : "en el " + pct(b.recoveredShare) + " de las ejecuciones") + ", después de " + stormEs(b) + " en promedio. La ola de intentos más alta después de la avalancha seguía siendo de " + perSec(b.peak) + " (reintentos inmediatos: " + perSec(a.peak) + "), frente a una capacidad de 3/s."),
        groups: [[T("Trouble lasted", "El problema duró"), [[T("Immediate retries", "Reintentos inmediatos"), stormShare(a), stormT(a)], [T("Backoff 2 · 4 · 8 s", "Espera 2 · 4 · 8 s"), stormShare(b), stormT(b), true]]],
          [T("Tallest wave", "Ola más alta"), [[T("Immediate retries", "Reintentos inmediatos"), a.peak / 20, perSec(a.peak)], [T("Backoff 2 · 4 · 8 s", "Espera 2 · 4 · 8 s"), b.peak / 20, perSec(b.peak), true]]]] };
    },
    jitter: () => {
      const { a, b } = RESULTS.jitter;
      return { verdict: T("The tallest wave fell from " + perSec(a.peak) + " to " + perSec(b.peak) + " (" + Math.round(100 * (1 - b.peak / a.peak)) + "% lower). The storm lasted " + storm(a) + " without jitter and " + storm(b) + " with it.",
          "La ola más alta bajó de " + perSec(a.peak) + " a " + perSec(b.peak) + " (" + Math.round(100 * (1 - b.peak / a.peak)) + "% menos). La tormenta duró " + stormEs(a) + " sin jitter y " + stormEs(b) + " con jitter."),
        groups: [[T("Tallest wave", "Ola más alta"), [[T("Backoff", "Espera"), a.peak / 20, perSec(a.peak)], [T("Backoff + jitter", "Espera + jitter"), b.peak / 20, perSec(b.peak), true]]],
          [T("Trouble lasted", "El problema duró"), [[T("Backoff", "Espera"), stormShare(a), stormT(a)], [T("Backoff + jitter", "Espera + jitter"), stormShare(b), stormT(b), true]]]] };
    },
    timeout: () => {
      const { a, b } = RESULTS.timeout;
      return { verdict: T(pct(b.goodputShare) + " of the window's work reached a waiting client with a 0.8 s timeout (" + pct(a.goodputShare) + " with 3 s), while attempts rose from " + perSec(a.load) + " to " + perSec(b.load) + ".",
          "El " + pct(b.goodputShare) + " del trabajo de la ventanilla llegó a un cliente que esperaba con un tiempo límite de 0.8 s (" + pct(a.goodputShare) + " con 3 s), mientras los intentos subieron de " + perSec(a.load) + " a " + perSec(b.load) + "."),
        groups: [[T("Work that reached a client", "Trabajo que llegó a un cliente"), [[T("Timeout 3 s", "Tiempo límite 3 s"), a.goodputShare, pct(a.goodputShare)], [T("Timeout 0.8 s", "Tiempo límite 0.8 s"), b.goodputShare, pct(b.goodputShare), true]]],
          [T("Attempts per second", "Intentos por segundo"), [[T("Timeout 3 s", "Tiempo límite 3 s"), a.load / 10, perSec(a.load)], [T("Timeout 0.8 s", "Tiempo límite 0.8 s"), b.load / 10, perSec(b.load), true]]]] };
    },
    layers: () => {
      const { a, b, c } = RESULTS.layers;
      const top = Math.max(a.attemptsPerRequest, b.attemptsPerRequest);
      return { verdict: T("The worst case is 64. During the storm the office measured " + b.attemptsPerRequest.toFixed(1) + " attempts per request with three layers retrying, " + a.attemptsPerRequest.toFixed(1) + " with one, and " + c.attemptsPerRequest.toFixed(2) + " with three layers and a 10% retry budget, which also ended the trouble in " + storm(c) + ".",
          "El peor caso es 64. Durante la tormenta, la taquilla midió " + b.attemptsPerRequest.toFixed(1) + " intentos por solicitud con tres capas reintentando, " + a.attemptsPerRequest.toFixed(1) + " con una, y " + c.attemptsPerRequest.toFixed(2) + " con tres capas y un presupuesto de reintentos del 10%, que además terminó el problema en " + stormEs(c) + "."),
        groups: [[T("Attempts per request", "Intentos por solicitud"), [[T("1 layer", "1 capa"), a.attemptsPerRequest / top, a.attemptsPerRequest.toFixed(1)], [T("3 layers", "3 capas"), b.attemptsPerRequest / top, b.attemptsPerRequest.toFixed(1), true], [T("3 layers + budget", "3 capas + presupuesto"), c.attemptsPerRequest / top, c.attemptsPerRequest.toFixed(2)]]]] };
    },
  };
  // Results come in titled groups of bars.
  root.on("run", (id, respond) => {
    const out = RUNS[id]();
    respond({ verdict: L(out.verdict), groups: out.groups.map(([title, bars]) => ({ title: L(title), bars: bars.map(([label, share, text, after]) => [L(label), Math.max(0.01, Math.min(1, share)), L(text), after]) })) });
  });
  root.on("watch", (w) => {
    for (const name of ["retries", "backoff", "jitter", "timeout", "layers", "budget"]) { settings[name] = w[name]; pressSeg(name, w[name]); }
    start();
    if (w.rush) pendingRush = office.t + 6;
    if (loop.paused) loop.setPaused(false);
  });

  start();
  loop.setPaused(loop.paused);
  paintPeople(0);
  needle.setAttribute("d", needleD(0));
}

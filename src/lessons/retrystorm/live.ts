// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The ticket office in the browser: steps the model, walks the pawns to the line, the windows, the garden and the
// plaza, swings the load gauge, and answers the controls. mount() gets the build-time data from page.ts (geometry,
// the pawn and ticket drawings) and root, the <wb-lesson>.
import { lineOnTop, translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { playPause, setLit } from "../../runtime/dom";
import { createOffice } from "./sim";

export default function mount({ P, G, PAWN, TICKET, LEDGE_TICKET }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (v) => root.figure.say(L(v));
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

  const stat = (key, value) => root.stat(key, value);
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
  const pause = playPause(root);
  const loop = WB.loop({ stage, step, onPause: pause.onPause });
  pause.bind(loop);
  function set(name, raw) {
    if (name === "speed") { speed = Number(raw); root.press(name, raw); return; }
    const value = name === "jitter" || name === "budget" ? String(raw) === "true" : name === "backoff" ? raw : Number(raw);
    settings[name] = value;
    office.setConfig({ [name]: value });
    root.press(name, raw);
  }
  function rush() { office.trigger(); rushAt = office.t; peak = 0; office.clients.forEach((c) => { if (!homeOf.has(c.id)) homeOf.set(c.id, -1); }); }
  root.on("change", (name, value) => set(name, value));
  const actions = {
    rush: () => { rush(); if (loop.paused) loop.setPaused(false); },
    restart: () => { start(); paintPeople(0); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const name of ["retries", "backoff", "jitter", "timeout", "layers", "budget"]) { settings[name] = w[name]; root.press(name, w[name]); }
    start();
    if (w.rush) pendingRush = office.t + 6;
    if (loop.paused) loop.setPaused(false);
  });

  start();
  loop.setPaused(loop.paused);
  paintPeople(0);
  needle.setAttribute("d", needleD(0));
}

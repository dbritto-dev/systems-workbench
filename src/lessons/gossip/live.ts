// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The gossip village in the browser: runs a rumour and the membership heartbeats round by round, flies messengers
// between houses, keeps the town hall's pegboard, and answers the controls. mount() gets the build-time data from
// page.ts (projection, geometry, Spanish experiment titles) and root, the <wb-lesson>.
import { iso, lineOnTop } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { playPause } from "../../runtime/dom";
import { easeInOutQuad } from "../../lib/tween";
import { makeSpread, makeMembership } from "./sim";

export default function mount({ P, G, TITLES_ES }, root) {
  // The dial's needle and a messenger's arc, as figure.ts draws them (needleAt, flightPoint).
  const DIAL = G.DIAL;
  const needleAt = (turn) => {
    const a = turn * Math.PI * 2, { x, y, r, z } = DIAL;
    return lineOnTop([x - Math.sin(a) * 2.6, y + Math.cos(a) * 2.6], [x + Math.sin(a) * (r - 3.4), y - Math.cos(a) * (r - 3.4)], z + 0.2, P);
  };
  const flightPoint = (a, b, e) => [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e + 14 * Math.sin(Math.PI * e)];
  const ROUND = 1.0, FLIGHT = 0.75, HOLD = 2, POOL = 160;

  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const sayText = (text) => root.figure.say(text);
  const say = (v) => sayText(L(v));
  const NS = "http://www.w3.org/2000/svg";
  const houses = Array.from({ length: G.MEMBERS }, (_, m) => q('[data-house="' + m + '"]'));
  const lamps = Array.from({ length: G.MEMBERS }, (_, m) => q('[data-lamp="' + m + '"]'));
  const pegs = Array.from({ length: G.MEMBERS }, (_, m) => q('[data-peg="' + m + '"]'));
  const needle = q("[data-needle]");
  const roofs = houses.map((h) => h.querySelector(".roof>.iso-solid"));
  const digits = [0, 1].map((i) => q('[data-digit="' + i + '"] text'));
  const layer = q("[data-messengers]");
  // Each messenger is a dot with a dashed trail back along its arc to the house that sent it.
  const pool = Array.from({ length: POOL }, () => {
    const g = document.createElementNS(NS, "g"), t = document.createElementNS(NS, "path"), c = document.createElementNS(NS, "circle");
    t.setAttribute("class", "trail"); c.setAttribute("r", "2.1"); c.setAttribute("class", "messenger");
    g.append(t, c); g.style.display = "none"; layer.appendChild(g); return { g, t, c };
  });

  const cfg = { houses: 40, fanout: 2, mode: "push", loss: 0, timeout: 8, slow: 0, speed: 1 };
  let seed = 8; // the first run is the same on every load; later runs differ
  let clock, nextRound, member, spread, flights, shown, litAt, holdUntil, rumourRounds, lastRumour, totalRounds;

  const pointOf = (m) => [G.HOMES[m][0], G.HOMES[m][1], G.HOME_Z[m] + 1.5];
  const randomLive = () => { const live = []; for (let m = 0; m < cfg.houses; m++) if (member.alive[m]) live.push(m); return live[Math.floor(Math.random() * live.length)]; };

  function newRumour() {
    const start = randomLive();
    spread = makeSpread({ n: cfg.houses, fanout: cfg.fanout, mode: cfg.mode, loss: cfg.loss, slow: cfg.slow, alive: member.alive.slice(0, cfg.houses), start }, seed++);
    shown = new Uint8Array(G.MEMBERS); litAt = new Float64Array(G.MEMBERS).fill(Infinity);
    shown[start] = 1; litAt[start] = clock;
    rumourRounds = 0; holdUntil = null;
    say(T("house " + start + " starts a rumour", "la casa " + start + " empieza un rumor"));
  }

  // stopEarly: a house that stopped a few rounds before the run starts, so the first frame already shows a suspected house.
  function restart(stopEarly) {
    clock = 0; nextRound = ROUND; totalRounds = 0; flights = []; lastRumour = null;
    member = makeMembership({ n: cfg.houses, fanout: cfg.fanout, loss: cfg.loss, slow: cfg.slow, timeout: cfg.timeout }, seed++);
    const early = stopEarly ? Math.min(cfg.houses - 1, 13) : -1;
    for (let r = 0; r < 12; r++) { if (r === 12 - Math.ceil(cfg.timeout * 0.75) && early > 0) member.alive[early] = false; member.step(); }
    houses.forEach((h, m) => { h.toggleAttribute("data-off", m >= cfg.houses); h.toggleAttribute("data-dead", m === early); });
    pegs.forEach((p, m) => p.toggleAttribute("data-off", m >= cfg.houses));
    newRumour();
    // Start a little way in, so the first frame shows lit houses and messengers in flight.
    while (nextRound <= 2) { clock = nextRound; nextRound += ROUND; onRound(); }
    clock = 2.45 * ROUND;
    paint(); showStats();
  }

  function onRound() {
    totalRounds++;
    member.step();
    if (holdUntil !== null) {
      if (totalRounds >= holdUntil) newRumour();
      return;
    }
    rumourRounds++;
    for (const ev of spread.step()) {
      if (ev.arrives) { if (ev.informs) { shown[ev.to] = 1; litAt[ev.to] = clock; } continue; }
      const span = ev.slow ? ev.delay * ROUND : FLIGHT;
      flights.push({ from: ev.from, to: ev.to, t0: clock, span, lost: !!ev.lost });
      if (ev.informs) { shown[ev.to] = 1; litAt[ev.to] = clock + span; }
    }
    if (spread.done()) {
      lastRumour = { rounds: rumourRounds, messages: spread.messages };
      holdUntil = totalRounds + HOLD;
      say(T("everyone knows · " + rumourRounds + " rounds, " + spread.messages + " messages", "todos lo saben · " + rumourRounds + " rondas, " + spread.messages + " mensajes"));
    } else say(T("round " + rumourRounds + " · messengers out", "ronda " + rumourRounds + " · mensajeros en camino"));
  }

  const stat = (key, value) => root.stat(key, value);
  function paint() {
    let heard = 0;
    for (let m = 0; m < G.MEMBERS; m++) {
      const on = m < cfg.houses && member.alive[m] && shown[m] && clock >= litAt[m];
      if (on) heard++;
      lamps[m].toggleAttribute("data-on", on);
      roofs[m].toggleAttribute("data-lit", on);
      houses[m].dataset.view = m === 0 || m >= cfg.houses ? "alive" : member.view(0, m);
    }
    let used = 0;
    flights = flights.filter((f) => clock < f.t0 + f.span);
    for (const f of flights) {
      if (used >= POOL) break;
      const u = Math.max(0, (clock - f.t0) / f.span);
      const a = pointOf(f.from), b = pointOf(f.to);
      const e = easeInOutQuad(u);
      const p = flightPoint(a, b, e);
      let opacity = 1;
      if (f.lost && u > 0.5) { opacity = Math.max(0, 1 - (u - 0.5) * 3); p[2] -= (u - 0.5) * 20; }
      const [sx, sy] = iso(p, P);
      const trail = [];
      for (let i = 0; i <= 8; i++) trail.push(iso(flightPoint(a, b, (e * i) / 8), P));
      const o = pool[used++];
      o.c.setAttribute("cx", sx.toFixed(1)); o.c.setAttribute("cy", sy.toFixed(1));
      o.t.setAttribute("d", "M" + trail.map(([x, y]) => x.toFixed(1) + " " + y.toFixed(1)).join("L"));
      o.g.style.opacity = String(opacity); o.g.style.display = "";
    }
    for (let i = used; i < POOL; i++) pool[i].g.style.display = "none";
    stat("know", heard + "/" + spread.liveCount());
    for (let m = 0; m < cfg.houses; m++) pegs[m].dataset.state = m === 0 ? "alive" : member.view(0, m);
    const frac = holdUntil === null ? Math.max(0, Math.min(1, 1 - (nextRound - clock) / ROUND)) : 0;
    needle.setAttribute("d", needleAt((rumourRounds + frac) / G.DIAL_ROUNDS));
    const shownRound = String(Math.min(99, rumourRounds)).padStart(2, "0");
    if (digits[0].textContent !== shownRound[0]) { digits[0].textContent = shownRound[0]; digits[1].textContent = shownRound[1]; }
    digits[1].textContent = shownRound[1];
  }

  function showStats() {
    stat("round", rumourRounds);
    stat("messages", spread.messages);
    stat("last", lastRumour ? lastRumour.rounds + L(" rounds", " rondas") : "–");
    let s = 0, d = 0;
    for (let m = 1; m < cfg.houses; m++) { const v = member.view(0, m); if (v === "suspected") s++; if (v === "dead") d++; }
    stat("suspected", s);
    stat("dead", d);
  }

  function step(dt) {
    clock += dt * cfg.speed;
    while (clock >= nextRound) { nextRound += ROUND; onRound(); showStats(); }
    paint();
  }

  // ---------- controls ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage, step, onPause: pause.onPause });
  pause.bind(loop);
  const NUMERIC = ["houses", "fanout", "loss", "timeout", "slow", "speed"];
  function set(name, raw, quiet) {
    cfg[name] = NUMERIC.includes(name) ? Number(raw) : raw;
    root.press(name, raw);
    if (name === "speed" || quiet) return;
    if (name === "timeout") { member.cfg.timeout = cfg.timeout; say(T("failure timeout " + cfg.timeout + " rounds", "timeout de falla: " + cfg.timeout + " rondas")); return; }
    if (name === "slow") { member.cfg.slow = cfg.slow; say(cfg.slow ? T("slow links on: 3 in 10 messages arrive late", "enlaces lentos: 3 de cada 10 mensajes llegan tarde") : T("slow links off", "sin enlaces lentos")); return; }
    restart(); say(T("settings applied · run restarted", "ajustes aplicados · ejecución reiniciada"));
  }
  function kill() {
    const live = []; for (let m = 1; m < cfg.houses; m++) if (member.alive[m]) live.push(m);
    if (!live.length) return;
    const m = live[Math.floor(Math.random() * live.length)];
    member.alive[m] = false; spread.live[m] = false;
    houses[m].setAttribute("data-dead", "");
    say(T("house " + m + " stopped · watch its peg", "casa " + m + " detenida · mira su clavija"));
    if (loop.paused) loop.setPaused(false);
  }
  function revive() {
    for (let m = 0; m < cfg.houses; m++) { member.alive[m] = true; spread.live[m] = true; houses[m].removeAttribute("data-dead"); }
    say(T("all houses running again", "todas las casas funcionan de nuevo"));
  }
  root.on("change", (name, value) => set(name, value));
  const actions = { kill, revive, reset: () => { restart(); say(T("started over", "empezamos de nuevo")); } };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w, id) => {
    for (const name of ["houses", "fanout", "mode", "loss", "timeout", "slow"]) set(name, String(w[name]), true);
    restart();
    if (loop.paused) loop.setPaused(false);
    if (id === "timeout") setTimeout(kill, 3000);
    say(T("watching: " + id, "observando: " + TITLES_ES[id]));
  });

  loop.setPaused(loop.paused);
  restart(true);
}

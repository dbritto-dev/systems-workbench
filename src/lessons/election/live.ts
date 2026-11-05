// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The signal towers in the browser: runs the election model in slow motion, flies its messages between the roofs,
// sets each tower's role, term, timer and log tiles, raises the fences, and answers the controls. mount() gets the
// build-time data from page.ts (projection, geometry, the message drawings) and root, the <wb-lesson>.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, setLit, playPause } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { clamp } from "../../lib/stats";
import { makeSim, LETTERS, CUT, SOLO } from "./sim";

export default function mount({ P, G, BALL, REPLY, BALLOT, WRITE }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const layer = q('[data-layer="msgs"]');
  const towers = LETTERS.map((_, i) => q(`[data-tower="${i}"]`));
  const terms = LETTERS.map((_, i) => WB.counter(svg, `term-${i}`, P));
  const dials = LETTERS.map((_, i) => WB.dial(svg, `timer-${i}`, P));
  const tiles = LETTERS.map((_, i) => Array.from({ length: G.TILES }, (_, s) => {
    const el = q(`[data-tile="${i}-${s}"]`);
    return { el, texts: [...el.querySelectorAll("[data-tile-text]")], state: "", label: "" };
  }));
  const fences = { cut: [...svg.querySelectorAll('[data-fence="cut"]')], solo: [...svg.querySelectorAll('[data-fence="solo"]')] };
  const board = { acked: WB.counter(svg, "acked", P), failed: WB.counter(svg, "failed", P), lost: WB.counter(svg, "lost", P) };

  // ---------- settings and the run ----------
  const cfg = { rule: "majority", timeouts: "random", n: 5, prevote: "off", net: "whole", speed: 0.05 };
  let sim, clock, logAt, from, seed = 5, script = [], saidAt = -9, saidRank = 0, held = null, quietAt = 0;

  function restart() {
    for (const x of active.values()) release(x);
    active.clear();
    sim = makeSim({ rule: cfg.rule, timeouts: cfg.timeouts, n: Number(cfg.n), prevote: cfg.prevote === "on" }, seed);
    seed = (seed * 7 + 3) % 9973 + 1;
    clock = 0; logAt = 0; from = 0; script = []; held = null; saidRank = 0; quietAt = 0;
    if (cfg.net !== "whole") sim.setNet(cfg.net, 0);
    paint();
    showStats();
  }

  // ---------- narration ----------
  const letter = (i) => LETTERS[i];
  const sideOf = (net, i) => (net === "cut" ? (i >= 2 ? 1 : 0) : net === "solo" ? (i === 4 ? 1 : 0) : 0);
  const cutText = () => sim.ids.filter((i) => i < 2).map(letter).join(" ") + " | " + sim.ids.filter((i) => i >= 2).map(letter).join(" ");
  function say(rank, text) {
    const wall = performance.now() / 1000;
    if (rank < saidRank && wall - saidAt < 1.4) { if (!held || rank >= held.rank) held = { rank, text, at: wall }; return; }
    held = null; saidRank = rank; saidAt = wall; quietAt = wall;
    root.figure.say(L(text));
  }
  function sayHeld() {
    const wall = performance.now() / 1000;
    if (held && wall - held.at > 2.5) held = null;
    if (held && wall - saidAt >= 1.4) { const h = held; held = null; saidRank = -1; say(h.rank, h.text); return; }
    if (wall - quietAt > 3) {
      const top = sim.topLeader();
      const k = sim.leaders();
      if (k.length > 1 && cfg.rule === "takeover") say(0, T(k.map(letter).join(" and ") + " both lead and acknowledge writes · split brain", k.map(letter).join(" y ") + " lideran y confirman escrituras · cerebro dividido"));
      else if (k.length > 1) { const old = k.filter((i) => i !== top).map(letter).join(" "), n = sim.nodes[top].term; say(0, T(old + " still thinks it leads · only " + letter(top) + " (term " + n + ") can commit", old + " todavía cree liderar · solo " + letter(top) + " (mandato " + n + ") puede confirmar")); }
      else if (top >= 0) say(0, T(letter(top) + " leads term " + sim.nodes[top].term + " · " + sim.stats.acked + " writes acknowledged", letter(top) + " lidera el mandato " + sim.nodes[top].term + " · " + sim.stats.acked + " escrituras confirmadas"));
      else say(0, T("no leader · writes are refused", "sin líder · se rechazan las escrituras"));
    }
  }
  const reach = (i) => sim.ids.filter((j) => !sim.nodes[j].down && sideOf(sim.net, j) === sideOf(sim.net, i)).length;
  let lastFail = -9;
  function narrate() {
    for (; logAt < sim.log.length; logAt++) {
      const e = sim.log[logAt];
      if (e.t > clock) break;
      const X = e.i !== undefined ? letter(e.i) : "";
      switch (e.type) {
        case "candidate": say(2, T(X + " times out · term " + e.term + " · asks for votes", X + " agota su tiempo · mandato " + e.term + " · pide votos")); break;
        case "prevote": say(2, T(X + " times out · asks first if it could win", X + " agota su tiempo · pregunta antes si ganaría")); break;
        case "elected": say(4, T(X + " wins " + e.votes + " of " + sim.ids.length + " votes · leads term " + e.term, X + " gana " + e.votes + " de " + sim.ids.length + " votos · lidera el mandato " + e.term)); break;
        case "takeover": say(4, T(X + " hears nothing · takes over term " + e.term + " without a vote", X + " no oye nada · toma el mando del mandato " + e.term + " sin votar")); break;
        case "split":
          if (reach(e.i) < sim.majority) say(2, T(X + " can't reach a majority · term " + e.term + " has no leader", X + " no llega a una mayoría · el mandato " + e.term + " queda sin líder"));
          else say(3, T("no one won term " + e.term + " · split vote", "nadie ganó el mandato " + e.term + " · voto dividido"));
          break;
        case "stepdown":
          if (e.why === "rival") say(4, T(X + " meets another leader of term " + e.term + " · steps down", X + " se cruza con otra líder del mandato " + e.term + " · deja de liderar"));
          else say(4, T(X + " sees term " + e.term + " · steps down", X + " ve el mandato " + e.term + " · deja de liderar"));
          break;
        case "truncate":
          if (e.lost) say(6, T(X + " overwritten · " + e.lost + " acknowledged writes lost", X + " sobrescrita · " + e.lost + " escrituras confirmadas perdidas"));
          else say(3, T(X + " drops " + e.dropped + " uncommitted entries", X + " descarta " + e.dropped + " entradas sin confirmar"));
          break;
        case "behind": say(3, T(X + " refuses " + letter(e.c) + ": its log is behind", X + " rechaza a " + letter(e.c) + ": su registro está atrasado")); break;
        case "net":
          if (e.mode === "cut") say(5, T("fence up · " + cutText(), "cerca arriba · " + cutText()));
          else if (e.mode === "solo") say(5, T("fence up · E alone", "cerca arriba · E aislada"));
          else say(5, T("fence down · the network is whole", "cerca abajo · la red está completa"));
          break;
        case "crash": say(5, e.wasLeader ? T(X + " crashes · it led term " + e.term, X + " se apaga · lideraba el mandato " + e.term) : T(X + " crashes", X + " se apaga")); break;
        case "restart": say(5, T(X + " is back · term " + e.term, X + " vuelve · mandato " + e.term)); break;
        case "fail": {
          if (e.t - lastFail < 0.15) break;
          lastFail = e.t;
          if (e.why === "uncommitted" && e.leader !== undefined) { if (sim.nodes[e.leader].state === "leader") say(2, T(letter(e.leader) + " can't commit · write " + e.w + " timed out", letter(e.leader) + " no puede confirmar · la escritura " + e.w + " venció")); }
          else if (e.why === "noLeader") say(1, T("no leader known · write " + e.w + " refused", "no se conoce líder · escritura " + e.w + " rechazada"));
          else say(1, T("write " + e.w + " never reached a leader", "la escritura " + e.w + " nunca llegó a una líder"));
          break;
        }
      }
    }
    if (logAt > 4000) { sim.log.splice(0, logAt); logAt = 0; }
  }

  // ---------- messages: one pooled element per message in flight ----------
  const DRAW = { ball: BALL, reply: REPLY, ballot: BALLOT, write: WRITE };
  const kindOf = (m) => (m.kind === "ae" ? "ball" : m.kind === "aer" ? "reply" : m.kind === "req" || m.kind === "fwd" ? "write" : "ballot");
  const pools = { ball: [], reply: [], ballot: [], write: [] };
  const active = new Map();
  function take(kind) {
    const el = pools[kind].pop();
    if (el) return el;
    const g = document.createElementNS(NS, "g");
    g.innerHTML = DRAW[kind];
    return { g, kind, lit: null };
  }
  function release(x) { x.el.g.remove(); x.el.g.style.opacity = ""; pools[x.el.kind].push(x.el); }
  const endOf = (i, m) => (i < 0 ? [...G.CLIENTS[-i - 1][m.write.w % 2], G.CLIENT_Z] : [...G.TOWERS[i], G.ROOF]);
  const point = (a, b, u, hump) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u) + hump * Math.sin(Math.PI * u)];
  // where a message sent across a fence runs into it (a share of the way), or 1
  function wallAt(a, b, net) {
    const hits = [];
    const ux = (X) => (b[0] === a[0] ? -1 : (X - a[0]) / (b[0] - a[0]));
    if (net === "cut") hits.push(ux(G.CUT_X));
    else if (net === "solo") hits.push(ux(G.SOLO_X));
    const ok = hits.filter((u) => u > 0 && u < 1);
    return ok.length ? Math.min(...ok) : 1;
  }
  function placeMsg(m, x) {
    const a = endOf(m.from, m), b = endOf(m.to, m);
    const hump = m.from < 0 ? 5 : 9;
    const dur = m.arrive - m.sent, u = (clock - m.sent) / dur;
    let p, fade = 1;
    if (m.cutAtSend) {
      if (x.stop === undefined) x.stop = wallAt(a, b, m.net);
      if (u < x.stop) p = point(a, b, u, hump);
      else { const s = point(a, b, x.stop, hump), k = clamp((u - x.stop) / 0.5); p = [s[0], s[1], s[2] - 6 * k]; fade = 1 - k; }
    } else p = point(a, b, clamp(u), hump);
    if (u < 0.12) fade = Math.min(fade, u / 0.12);
    x.pos = p;
    x.el.g.setAttribute("transform", translateAlong(P, p));
    x.el.g.style.opacity = fade < 1 ? String(Math.max(0, fade)) : "";
    if (x.el.kind === "ballot") { const lit = (m.kind === "rvr" && m.granted) || (m.kind === "pvr" && m.ok); if (x.el.lit !== lit) { x.el.lit = lit; setLit(x.el.g, lit); } }
  }
  const doneAt = (m) => (m.cutAtSend ? m.sent + (m.arrive - m.sent) * 1.5 : m.arrive);
  function paintMsgs() {
    const msgs = sim.msgs;
    while (from < msgs.length && msgs[from].sent <= clock) {
      const m = msgs[from++];
      if (doneAt(m) < clock) continue;
      const x = { m, el: take(kindOf(m)) };
      active.set(m.id, x);
      layer.appendChild(x.el.g);
    }
    for (const [id, x] of active) {
      if (doneAt(x.m) < clock) { release(x); active.delete(id); continue; }
      placeMsg(x.m, x);
    }
    const sorted = [...active.values()].sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P));
    const kids = layer.children;
    if (sorted.some((x, i) => x.el.g !== kids[i])) sorted.forEach((x) => layer.appendChild(x.el.g));
  }

  // ---------- painting ----------
  function paint() {
    narrate();
    sayHeld();
    for (let i = 0; i < LETTERS.length; i++) {
      const x = sim.nodes[i], el = towers[i];
      el.toggleAttribute("data-off", !x.on);
      if (!x.on) continue;
      const role = x.down ? "down" : x.state;
      if (el.getAttribute("data-role") !== role) el.setAttribute("data-role", role);
      terms[i].setClamped(x.term);
      dials[i].set(role === "follower" || role === "candidate" ? clamp((clock - x.since) / x.timerLen) : 0);
      const len = x.log.length;
      tiles[i].forEach((tile, s) => {
        const idx = len - G.TILES + s;
        const state = idx < 0 ? "empty" : idx < x.commit ? "commit" : "pending";
        if (tile.state !== state) { tile.state = state; tile.el.setAttribute("data-state", state); }
        const label = idx < 0 ? "" : String(x.log[idx].term % 100);
        if (tile.label !== label) { tile.label = label; tile.texts.forEach((t) => setText(t, label)); }
      });
    }
    fences.cut.forEach((f) => show(f, sim.net === "cut"));
    fences.solo.forEach((f) => show(f, sim.net === "solo"));
    paintMsgs();
    board.acked.setClamped(sim.stats.acked);
    board.failed.setClamped(sim.stats.failed);
    board.lost.setClamped(sim.stats.lost);
  }

  // ---------- stats ----------
  function showStats() {
    const k = sim.leaders();
    root.stat("leader", k.length === 0 ? "–" : k.length === 1 ? letter(k[0]) : k.map((i) => letter(i) + " (" + sim.nodes[i].term + ")").join(" + "));
    root.stat("term", Math.max(...sim.ids.map((i) => sim.nodes[i].term)));
    root.stat("elections", sim.stats.elections);
    root.stat("acked", sim.stats.acked);
    root.stat("failed", sim.stats.failed);
    root.stat("lost", sim.stats.lost);
  }

  // ---------- the loop ----------
  let statTimer = 0;
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    clock += dt * cfg.speed;
    while (script.length && script[0].t <= clock) { const s = script.shift(); sim.runTo(s.t); s.fn(); }
    sim.runTo(clock);
    paint();
    statTimer += dt; if (statTimer > 0.2) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  pause.bind(loop);

  function setNet(mode) { cfg.net = mode; root.press("net", mode); sim.setNet(mode, clock); }
  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    if (name === "net") { setNet(String(raw)); return; }
    cfg[name] = String(raw);
    if (!quiet) { restart(); say(9, T("settings applied · run restarted", "ajustes aplicados · ejecución reiniciada")); }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const crashLeader = () => {
    const i = sim.topLeader();
    if (i < 0) { say(9, T("no leader to crash", "no hay líder para apagar")); return; }
    sim.crash(i, clock);
  };
  const crashFollower = () => {
    const f = sim.ids.filter((i) => !sim.nodes[i].down && sim.nodes[i].state !== "leader").reverse();
    if (!f.length) { say(9, T("no follower left to crash", "no queda seguidora para apagar")); return; }
    sim.crash(f[0], clock);
  };
  const actions = {
    crash: () => { crashLeader(); wake(); },
    crashFollower: () => { crashFollower(); wake(); },
    restart: () => { const d = sim.ids.filter((i) => sim.nodes[i].down); if (!d.length) say(9, T("every tower is already up", "todas las torres ya están encendidas")); d.forEach((i) => sim.restart(i, clock)); wake(); },
    reset: () => { restart(); say(9, T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings and its script ----------
  const SCRIPTS = {
    cut: () => [{ t: 0.4, fn: () => setNet("cut") }, { t: 0.4 + CUT.len, fn: () => setNet("whole") }],
    solo: () => [{ t: 0.4, fn: () => setNet("solo") }, { t: 0.4 + SOLO.len, fn: () => setNet("whole") }],
    crash: () => [{ t: 0.4, fn: crashLeader }],
    crash2: () => [{ t: 0.4, fn: crashFollower }, { t: 0.4, fn: crashFollower }],
  };
  root.on("watch", (w) => {
    for (const key of ["rule", "timeouts", "n", "prevote"]) set(key, w[key], true);
    cfg.net = "whole"; root.press("net", "whole");
    restart();
    script = SCRIPTS[w.script] ? SCRIPTS[w.script]() : [];
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

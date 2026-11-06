// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The commit desk in the browser: runs the model in slow motion, moves envelopes along the lanes and the peer line,
// closes the padlocks, lines up the customers, and answers the controls. mount() gets the build-time data from page.ts
// (projection, geometry, the envelope and customer drawings) and root, the <wb-lesson>.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, playPause } from "../../runtime/dom";
import { lerp, approach } from "../../lib/tween";
import { clamp, mean } from "../../lib/stats";
import { makeSim, NAMES, COORD } from "./sim";

export default function mount({ P, G, ENV_SVG, CUSTOMER_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const stat = (key, value) => root.stat(key, value);
  const NS = "http://www.w3.org/2000/svg";
  const floor = q('[data-layer="floor"]'), railLayer = q('[data-layer="rail"]');
  const locks = [0, 1, 2].map((i) => ({ open: q(`[data-lock="${i}"] [data-lock-state="open"]`), closed: q(`[data-lock="${i}"] [data-lock-state="closed"]`) }));
  const owners = [0, 1, 2].map((i) => q(`[data-owner="${i}"]`));
  const states = [0, 1, 2].map((i) => q(`[data-state="${i}"]`));
  const votes = [0, 1, 2].map((i) => q(`[data-vote="${i}"]`));
  const plogs = [0, 1, 2].map((i) => q(`[data-plog="${i}"]`));
  const more = [0, 1, 2].map((i) => q(`[data-more="${i}"]`));
  const recId = q("[data-record-id]"), recText = q("[data-record]");
  const bookLog = q('[data-book="log"]'), bookMem = q('[data-book="memory"]');
  const clerk = q("[data-clerk]"), down = q("[data-down]");
  const counters = Object.fromEntries(["committed", "aborted", "split", "inflight", "wait0", "wait1", "wait2"].map((n) => [n, WB.counter(svg, n, P)]));

  // ---------- words ----------
  const WORD = {
    work: T("WORK", "TAREA"), done: T("DONE", "HECHO"), prepare: T("PREPARE", "PREPARAR"), yes: T("YES", "SÍ"), no: T("NO", "NO"),
    commit: T("COMMIT", "CONFIRMAR"), abort: T("ABORT", "ABORTAR"), ack: T("ACK", "ACK"), ask: T("ASK", "CONSULTA"), unknown: T("NOT SURE", "NO SÉ"),
  };
  const STATE = {
    working: T("WORKING", "TRABAJANDO"), done: T("WORK DONE", "TAREA HECHA"), forcing: T("PREPARING", "PREPARANDO"),
    prepared: T("VOTED YES", "VOTÓ SÍ"), doubt: T("IN DOUBT", "EN DUDA"), commit: T("COMMITTED", "CONFIRMÓ"), abort: T("ROLLED BACK", "REVIRTIÓ"), free: T("FREE", "LIBRE"),
  };
  function labelOf(m) {
    if (m.kind === "vote") return WORD[m.value];
    if (m.kind === "decision" || m.kind === "answer" || m.kind === "reply") return WORD[m.value];
    if (m.kind === "inquire") return WORD.ask;
    return WORD[m.kind];
  }

  // ---------- pooled elements ----------
  const envFree = [], envs = new Map(), custFree = [], custs = new Map();
  function makeEnv() {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = ENV_SVG;
    return { g, text: g.querySelector("[data-env-text]"), label: null };
  }
  function makeCust() {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = CUSTOMER_SVG;
    return { g, pos: null };
  }

  // ---------- settings and the run ----------
  const cfg = { point: "voted", b: "normal", net: "near", log: "log", doubt: "wait", speed: 0.02 };
  // the first run's seed: one where a transaction holds the rows a few seconds in, so the still frame shows the locks
  let model, clock, logAt, from, seed = 10, lastEnd, focus, shownVotes, pendingArm = null, lastPrep;

  function restart(fixedSeed) {
    for (const e of envs.values()) { e.g.remove(); envFree.push(e); }
    envs.clear();
    for (const c of custs.values()) { c.g.remove(); custFree.push(c); }
    custs.clear();
    model = makeSim(simCfg(), fixedSeed ?? seed);
    if (fixedSeed === undefined) seed = (seed * 7 + 3) % 9973 + 1;
    clock = 0; logAt = 0; from = 0; lastEnd = [null, null, null]; focus = null; shownVotes = ["", "", ""]; pendingArm = null; lastPrep = ["", "", ""];
    cur = null; held = null;
    show(bookLog, cfg.log === "log"); show(bookMem, cfg.log !== "log");
    paint();
    showStats();
  }

  const simCfg = () => ({ b: cfg.b, net: cfg.net, log: cfg.log, doubt: cfg.doubt, trace: true });

  // ---------- narration ----------
  // The readout says each step as it starts. A more important message stays up for at least HOLD s of page time; a
  // less important one that comes meanwhile waits, and is dropped if something newer comes or it waits longer than
  // STALE s, so the readout never runs behind the picture by more than about a second.
  const HOLD = 0.9, STALE = 1.1;
  let cur = null, held = null;
  function say(rank, text) {
    const wall = performance.now() / 1000;
    if (cur && rank < cur.rank && wall - cur.at < HOLD) { held = { rank, text, at: wall }; return; }
    held = null; cur = { rank, at: wall };
    root.figure.say(L(text));
  }
  function sayHeld() {
    if (!held) return;
    const wall = performance.now() / 1000;
    if (wall - held.at > STALE) { held = null; return; }
    if (wall - cur.at >= HOLD) { const h = held; held = null; cur = null; say(h.rank, h.text); }
  }
  const ms = (x) => (x < 1 ? Math.round(1000 * x) + " ms" : x.toFixed(2) + " s");
  const list = (xs, en) => (xs.length === 1 ? xs[0] : xs.slice(0, -1).join(", ") + (en ? " and " : " y ") + xs[xs.length - 1]);
  function narrate() {
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt];
      if (e.t > clock) break;
      const id = "#" + e.id, who = NAMES[e.i];
      switch (e.type) {
        case "start": say(0, T("#" + e.tx.id + " starts · WORK to A, B and C", "empieza #" + e.tx.id + " · TAREA a A, B y C")); break;
        case "door": say(1, T("#" + e.tx.id + " waits at the door · coordinator down", "#" + e.tx.id + " espera en la puerta · coordinador caído")); break;
        case "prepare": focus = e.id; shownVotes = ["…", "…", "…"]; say(1, T(id + " · all three done · PREPARE: vote", id + " · los tres listos · PREPARAR: a votar")); break;
        case "forcing": say(1, T(id + " · three yes · writing COMMIT to the log", id + " · tres sí · escribe CONFIRMAR en el log")); break;
        case "decide":
          if (e.decision === "commit") say(1, cfg.log === "log" ? T(id + " · COMMIT on disk · sent to all", id + " · CONFIRMAR en disco · enviado a todos") : T(id + " · three yes · COMMIT sent, kept in memory", id + " · tres sí · CONFIRMAR enviado, solo en memoria"));
          else say(2, T(id + " · a no vote · ABORT to the others", id + " · un voto no · ABORTAR a los otros"));
          break;
        case "voteNo": say(2, T(who + " votes no on " + id + " · rolls back at once", who + " vota no en " + id + " · revierte de inmediato")); break;
        case "crash":
          if (e.point === "before") say(6, T("coordinator down before PREPARE · " + id + " not voted yet", "coordinador caído antes de PREPARAR · " + id + " sin votar"));
          else if (e.point === "voted") say(6, T("coordinator down while votes come in · " + id + " can't finish", "coordinador caído mientras llegan votos · " + id + " no puede terminar"));
          else say(6, T("coordinator down · COMMIT for " + id + " reached A only", "coordinador caído · CONFIRMAR de " + id + " solo llegó a A"));
          break;
        case "recover":
          if (e.resend > 0) say(6, T("coordinator back · its log says COMMIT · sends it again", "coordinador de vuelta · su log dice CONFIRMAR · lo reenvía"));
          else if (cfg.log !== "log") say(6, T("coordinator back · memory empty · questions get ABORT", "coordinador de vuelta · memoria vacía · las consultas reciben ABORTAR"));
          else say(6, T("coordinator back · no decision logged · questions get ABORT", "coordinador de vuelta · sin decisión en el log · las consultas reciben ABORTAR"));
          break;
        case "doubt": say(5, T(who + " voted yes · no answer · in doubt, row locked", who + " votó sí · sin respuesta · en duda, fila bloqueada")); break;
        case "prepared": lastPrep[e.i] = "#" + e.id; break;
        case "unsure": say(5, T(who + " asks " + NAMES[e.j] + " · " + NAMES[e.j] + " voted yes too, not sure · row stays locked", who + " pregunta a " + NAMES[e.j] + " · " + NAMES[e.j] + " también votó sí, no sabe · la fila sigue bloqueada")); break;
        case "split": {
          const c = e.outcome.map((o, i) => (o === "commit" ? NAMES[i] : null)).filter(Boolean), a = e.outcome.map((o, i) => (o === "abort" ? NAMES[i] : null)).filter(Boolean);
          say(8, T(id + " SPLIT · committed at " + list(c, true) + ", rolled back at " + list(a, true), id + " DIVIDIDA · confirmada en " + list(c, false) + ", revertida en " + list(a, false)));
          break;
        }
        case "commit": case "abort": {
          lastEnd[e.i] = { outcome: e.type, at: clock };
          const word = e.type === "commit" ? WORD.commit : WORD.abort;
          if (e.why === "timeout") say(4, T(who + " never got PREPARE · rolls back on its own", who + " nunca recibió PREPARAR · revierte por su cuenta"));
          else if (e.why === "answer") say(5, T(who + " asks · gets " + word.en + " · row was locked " + ms(e.held), who + " pregunta · recibe " + word.es + " · fila bloqueada " + ms(e.held)));
          else if (e.why && e.why.startsWith("peer:")) {
            const j = NAMES[Number(e.why.slice(5))];
            say(5, e.type === "abort" ? T(who + " asks " + j + " · " + j + " knows: ABORT · " + who + " rolls back", who + " pregunta a " + j + " · " + j + " sabe: ABORTAR · " + who + " revierte")
              : T(who + " asks " + j + " · " + j + " committed · " + who + " commits", who + " pregunta a " + j + " · " + j + " confirmó · " + who + " confirma"));
          } else if (e.why === "decision" && e.held > 0.15) say(5, T(who + " gets " + word.en + " · row was locked " + ms(e.held), who + " recibe " + word.es + " · fila bloqueada " + ms(e.held)));
          break;
        }
      }
    }
    if (logAt > 4000) { model.log.splice(0, logAt); logAt = 0; }
  }

  // ---------- where things are ----------
  function envPos(m, u) {
    if (m.from === COORD) return [G.CX[m.to] + G.LANE.out, lerp(G.LANE_Y[1], G.LANE_Y[0], u), 0.8];
    if (m.to === COORD) return [G.CX[m.from] + G.LANE.back, lerp(G.LANE_Y[0], G.LANE_Y[1], u), 0.8];
    return [lerp(G.CX[m.from], G.CX[m.to], u), G.RAIL.y, G.RAIL.z];
  }

  // ---------- painting ----------
  function paint() {
    narrate();
    sayHeld();
    const live = [];
    // envelopes
    const linger = 0.15 * cfg.speed, msgs = model.msgs;
    while (from < msgs.length && msgs[from].arrive + linger < clock) {
      const e = envs.get(msgs[from]);
      if (e) { e.g.remove(); envFree.push(e); envs.delete(msgs[from]); }
      from++;
    }
    for (let i = from; i < msgs.length; i++) {
      const m = msgs[i];
      if (m.sent > clock) break;
      let e = envs.get(m);
      if (m.arrive + linger < clock) { if (e) { e.g.remove(); envFree.push(e); envs.delete(m); } continue; }
      const peer = m.from !== COORD && m.to !== COORD;
      if (!e) { e = envFree.pop() || makeEnv(); e.layer = null; envs.set(m, e); }
      const layer = peer ? railLayer : floor;
      if (e.layer !== layer) { layer.appendChild(e.g); e.layer = layer; }
      const label = L(labelOf(m));
      if (e.label !== label) { e.label = label; setText(e.text, label); e.text.setAttribute("font-size", label.length > 8 ? 2.4 : label.length > 6 ? 2.6 : 2.9); }
      const u = clamp((clock - m.sent) / (m.arrive - m.sent));
      e.pos = envPos(m, u);
      e.g.setAttribute("transform", translateAlong(P, e.pos));
      const fade = clock > m.arrive ? clamp(1 - (clock - m.arrive) / linger) : clamp(u / 0.12);
      e.g.style.opacity = fade < 1 ? String(fade) : "";
      if (!peer) live.push(e);
    }
    // customers: the local requests holding or waiting for each row, in line order
    const seen = new Set();
    for (const p of model.parts) {
      const line = [];
      if (p.holder && p.holder.kind === "local") line.push(p.holder);
      for (const r of p.queue) if (r.kind === "local") line.push(r);
      line.forEach((r, k) => {
        if (k >= G.CUST.max) return;
        seen.add(r);
        let c = custs.get(r);
        const target = [G.CX[p.i] + G.CUST.dx, G.CUST.y0 + k * G.CUST.step, 0];
        if (!c) { c = custFree.pop() || makeCust(); c.left = 0; c.pos = [target[0], target[1] + G.CUST.step * 1.5, 0]; c.born = performance.now(); floor.appendChild(c.g); custs.set(r, c); }
        c.target = target;
        live.push(c);
      });
    }
    // a served customer steps aside and fades out
    const wall = performance.now();
    for (const [r, c] of custs) {
      if (seen.has(r)) continue;
      if (!c.left) { c.left = wall; c.target = [c.pos[0] + 6, c.pos[1] + 3, 0]; }
      if (wall - c.left > 450) { c.g.remove(); c.left = 0; custFree.push(c); custs.delete(r); }
      else live.push(c);
    }
    // painter's order on the floor: far first
    const sorted = live.sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P));
    const kids = [...floor.children];
    if (sorted.some((x, i) => x.g !== kids[i])) sorted.forEach((x) => floor.appendChild(x.g));

    // counters, padlocks, rows
    model.parts.forEach((p, i) => {
      const b = p.holder && p.holder.kind === "txn" ? p.holder.b : null;
      show(locks[i].closed, !!b); show(locks[i].open, !b);
      setText(owners[i], b ? "#" + b.id : "");
      let s;
      if (b) s = b.state === "prepared" ? (b.doubt ? STATE.doubt : STATE.prepared) : STATE[b.state] || STATE.working;
      else if (lastEnd[i] && clock - lastEnd[i].at < 3 * cfg.speed) s = STATE[lastEnd[i].outcome];
      else s = STATE.free;
      setText(states[i], L(s));
      counters["wait" + i].setClamped(p.waiting);
      setText(plogs[i], lastPrep[i] ? lastPrep[i] + " " + L(WORD.yes) : "");
      const line = (p.holder && p.holder.kind === "local" ? 1 : 0) + p.waiting;
      setText(more[i], line > G.CUST.max ? "+" + (line - G.CUST.max) : "");
    });
    // the desk
    const co = model.coord;
    show(clerk, co.up); show(down, !co.up);
    const c = focus !== null ? co.txns.get(focus) : null;
    // the votes for the transaction being decided; blank once it is over, "?" while a crashed coordinator has
    // forgotten it (a memory-only coordinator forgets everything, plaques included)
    if (c) shownVotes = c.votes.map((v) => (v === null ? "…" : L(WORD[v])));
    else if (!co.up && cfg.log === "log" && focus !== null) shownVotes = ["?", "?", "?"];
    else shownVotes = ["", "", ""];
    votes.forEach((el, i) => setText(el, shownVotes[i]));
    setText(recId, co.record ? "#" + co.record.id : "");
    setText(recText, co.record ? L(WORD[co.record.decision]) : "");
    counters.committed.setClamped(model.st.committed);
    counters.aborted.setClamped(model.st.aborted);
    counters.split.setClamped(model.st.split);
    counters.inflight.setClamped(model.inFlight());
  }
  function ease(dt) {
    const k = approach(dt, 9);
    for (const c of custs.values()) {
      c.pos = [lerp(c.pos[0], c.target[0], k), lerp(c.pos[1], c.target[1], k), 0];
      c.g.setAttribute("transform", translateAlong(P, c.pos));
      const age = (performance.now() - c.born) / 300, gone = c.left ? (performance.now() - c.left) / 450 : 0;
      const o = Math.min(clamp(age), 1 - clamp(gone));
      c.g.style.opacity = o < 1 ? String(o) : "";
    }
  }

  // ---------- stats ----------
  function showStats() {
    const st = model.st;
    stat("committed", st.committed);
    stat("aborted", st.aborted);
    stat("split", st.split);
    // commits and arrivals over the same window, the last 2 s of model time (from 1 s in, the time so far)
    const span = Math.min(2, clock);
    if (span < 1) stat("rate", "–");
    else {
      let k = 0, a = 0;
      for (let j = st.ends.length - 1; j >= 0 && st.ends[j] > clock - span; j--) k++;
      for (let j = model.all.length - 1; j >= 0 && model.all[j].born > clock - span; j--) a++;
      stat("rate", (k / span).toFixed(1) + " / " + (a / span).toFixed(1));
    }
    const h = st.holds[0].slice(-10).map(([, x]) => x);
    stat("hold", h.length ? Math.round(1000 * mean(h)) + " ms" : "–");
    stat("waiting", model.parts.reduce((a, p) => a + p.waiting, 0));
  }

  // ---------- the loop ----------
  let statTimer = 0;
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    clock += dt * cfg.speed;
    if (pendingArm && clock >= pendingArm.at) { model.arm(pendingArm.point); pendingArm = null; }
    model.runTo(clock);
    paint();
    ease(dt);
    statTimer += dt; if (statTimer > 0.25) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = String(raw);
    if (name === "point") return;          // only the next crash changes
    if (!quiet) { restart(); say(9, T("settings applied · run restarted", "ajustes aplicados · ejecución reiniciada")); }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const ARMED = {
    before: T("crash armed · the next transaction, once all three are done, before PREPARE", "caída preparada · la siguiente transacción, con los tres listos, antes de PREPARAR"),
    voted: T("crash armed · the next transaction, as its first vote comes in", "caída preparada · la siguiente transacción, al llegar su primer voto"),
    midsend: T("crash armed · the next transaction, once COMMIT reaches A", "caída preparada · la siguiente transacción, cuando CONFIRMAR llega a A"),
  };
  const actions = {
    crash: () => {
      if (!model.coord.up) { say(9, T("the coordinator is already down", "el coordinador ya está caído")); return; }
      model.arm(cfg.point);
      say(9, ARMED[cfg.point]);
      wake();
    },
    reset: () => { restart(); say(9, T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  // w.speed: the speed it plays at. w.arm: arm the crash at that model time (0: the first transaction). w.warm: run the
  // model this far at once, so the counters and the line at the rows have built up. w.toBack: with a crash, run on to
  // this long before the coordinator is back. w.allYes: use a run whose crashed transaction got three yes votes (the
  // common case, the one asking the others can't settle).
  function crashedRun(w, s) {
    const m = makeSim(simCfg(), s);
    m.arm(w.crash);
    for (let t = 0; t <= 1 && !m.st.crashRecs.length; t += 0.002) m.runTo(t);
    const rec = m.st.crashRecs[0];
    if (!rec) return null;
    m.runTo(rec.t + 0.1);
    return { rec, yes: m.all[rec.id - 1].outcome.every((o) => o === null) };
  }
  root.on("watch", (w) => {
    for (const key of ["b", "net", "log", "doubt"]) set(key, w[key], true);
    set("point", w.crash, true);
    if (w.speed) set("speed", w.speed, true);
    let s;
    if (w.allYes) for (let k = 0, x = seed; k < 40; k++, x = (x * 7 + 3) % 9973 + 1) { const r = crashedRun(w, x); if (r && r.yes) { s = x; break; } }
    restart(s);
    if (w.arm !== undefined) { if (w.arm <= 0) model.arm(w.crash); else pendingArm = { at: w.arm, point: w.crash }; }
    let to = w.warm || 0;
    if (w.toBack !== undefined) {
      for (let t = 0; t <= 1 && !model.st.crashRecs.length; t += 0.002) model.runTo(t);
      const rec = model.st.crashRecs[0];
      if (rec) to = Math.max(to, rec.upAt - w.toBack);
    }
    if (to > 0) {
      model.runTo(to);
      clock = to;
      // narrate only what is still going on: the crash, if the coordinator is still down
      for (; logAt < model.log.length && model.log[logAt].t <= to; logAt++) {
        const e = model.log[logAt];
        if (e.type === "prepared") lastPrep[e.i] = "#" + e.id;
        if (e.type === "prepare") focus = e.id;
        if (e.type === "commit" || e.type === "abort") lastEnd[e.i] = { outcome: e.type, at: e.t };
      }
      while (from < model.msgs.length && model.msgs[from].arrive + 0.15 * cfg.speed < clock) from++;
      cur = null; held = null;
      if (!model.coord.up) say(6, T("coordinator down · back in " + ms(model.coord.upAt - clock), "coordinador caído · vuelve en " + ms(model.coord.upAt - clock)));
      else { const n = model.inFlight(); say(1, T("after " + to.toFixed(1) + " s: " + n + (n === 1 ? " transaction" : " transactions") + " in flight", "tras " + to.toFixed(1) + " s: " + n + (n === 1 ? " transacción" : " transacciones") + " en curso")); }
      paint(); showStats();
    }
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

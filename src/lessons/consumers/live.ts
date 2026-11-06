// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The sorting hall in the browser: runs the consumer-group model, eases records along the lanes and onto the desks,
// and shows what the coordinator is doing. mount() gets the build-time data from page.ts (projection, geometry, the
// record drawing) and root, the <wb-lesson>.
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, playPause } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { clamp } from "../../lib/stats";
import { makeGroup, LANES, SLOTS } from "./sim";

export default function mount({ P, G, RECORD_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (v) => root.figure.say(L(v));
  const stat = (key, value) => root.stat(key, value);
  const NS = "http://www.w3.org/2000/svg";
  const lanesL = G.LANE_X.map((_, i) => q('[data-layer="lane' + i + '"]'));
  const deskL = q('[data-layer="desk"]');
  const gates = G.LANE_X.map((_, i) => ({ up: q('[data-gate="' + i + '"] [data-arm="up"]'), down: q('[data-gate="' + i + '"] [data-arm="down"]') }));
  const owners = G.LANE_X.map((_, i) => q('[data-sign="' + i + '"] [data-owner]'));
  const people = G.LANE_X.map((_, i) => ({ g: q('[data-worker="' + i + '"]'), up: q('[data-worker="' + i + '"] [data-pose="up"]'), out: q('[data-worker="' + i + '"] [data-pose="out"]'), fallen: q('[data-fallen="' + i + '"]') }));
  const slips = G.LANE_X.map((_, i) => [...svg.querySelectorAll('[data-slips="' + i + '"] [data-slip]')]);
  const spares = G.BENCH_SPOTS.map((_, n) => q('[data-spare="' + n + '"]'));
  const lampOn = q('[data-lamp="on"]'), lampOff = q('[data-lamp="off"]');
  const lagC = G.LANE_X.map((_, i) => WB.counter(svg, "lag" + i, P));
  const counters = { rebalances: WB.counter(svg, "rebalances", P), done: WB.counter(svg, "done", P), twice: WB.counter(svg, "twice", P) };
  const polls = G.LANE_X.map((_, i) => WB.meter(svg, "poll" + i, P));
  const session = WB.dial(svg, "session", P);

  // ---------- records: one pooled element per record on screen, eased toward where the model has it ----------
  const free = [];
  function makeEl() {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = RECORD_SVG;
    return { g, body: g.querySelector("[data-body]"), num: g.querySelector("[data-num]"), shown: {} };
  }
  const recs = new Map();   // key -> { el, pos, target, layer, seen, leaving, until, y }
  function drop(key) { const r = recs.get(key); r.el.g.remove(); free.push(r.el); recs.delete(key); }
  function want(key, off, pos, layer, lit, from) {
    let r = recs.get(key);
    if (!r) {
      const el = free.pop() || makeEl();
      r = { el, pos: [...(from || pos)], layer: null };
      recs.set(key, r);
    }
    r.target = pos; r.seen = true; r.leaving = false;
    if (r.layer !== layer) { r.layer = layer; layer.appendChild(r.el.g); }
    const s = r.el.shown, txt = String(off % 100);
    if (s.txt !== txt) { s.txt = txt; r.el.num.textContent = txt; }
    if (s.lit !== lit) { s.lit = lit; r.el.body.toggleAttribute("data-lit", lit); r.el.body.toggleAttribute("data-lit-fill", lit); r.el.num.setAttribute("data-tone", lit ? "on-lit" : "hi"); }
  }

  // ---------- settings and the run ----------
  const cfg = { workers: 3, rate: 6, protocol: "eager", members: "dynamic", session: 45, pollLimit: 10, slow: 1, speed: 1 };
  let model, clock, logAt, note, history, seed = 7;
  const WARM = 20;   // each run starts 20 s in, so the first frame shows a working hall

  function restart(warm = WARM) {
    for (const key of [...recs.keys()]) drop(key);
    model = makeGroup({ workers: cfg.workers, rate: cfg.rate, protocol: cfg.protocol, members: cfg.members, session: cfg.session, pollLimit: cfg.pollLimit, slow: cfg.slow }, seed);
    seed = (Date.now() % 1e6) + 1;
    clock = warm; model.runTo(clock);
    logAt = model.log.length; note = null; history = [{ t: clock, c: model.st.committedN }];
    paint(0, true);
  }

  // ---------- narration: the model's log ----------
  const W = (i) => i + 1;
  function narrate() {
    const c = model.cfg;
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt];
      let text = null;
      if (e.type === "start") text = T("worker " + W(e.slot) + " joins the group", "el trabajador " + W(e.slot) + " entra al grupo");
      else if (e.type === "stop") text = c.members === "static"
        ? T("worker " + W(e.slot) + " stops · static id: its lanes wait for its session to run out", "el trabajador " + W(e.slot) + " se detiene · id estático: sus carriles esperan a que venza su sesión")
        : T("worker " + W(e.slot) + " stops and leaves the group", "el trabajador " + W(e.slot) + " se detiene y sale del grupo");
      else if (e.type === "restart") text = c.members === "static"
        ? T("worker " + W(e.slot) + " restarts · static id: its lanes wait for it", "el trabajador " + W(e.slot) + " se reinicia · id estático: sus carriles lo esperan")
        : T("worker " + W(e.slot) + " restarts · it leaves the group", "el trabajador " + W(e.slot) + " se reinicia · sale del grupo");
      else if (e.type === "back") text = T("worker " + W(e.slot) + " is back · same lanes, no rebalance", "el trabajador " + W(e.slot) + " volvió · mismos carriles, sin rebalanceo");
      else if (e.type === "crash") text = T("worker " + W(e.slot) + " crashed · the coordinator hears nothing until its session times out (" + c.session + " s)", "el trabajador " + W(e.slot) + " se cayó · el coordinador no sabe nada hasta que vence su sesión (" + c.session + " s)");
      else if (e.type === "expired") text = T("worker " + W(e.slot) + "'s session timed out · dropped from the group", "venció la sesión del trabajador " + W(e.slot) + " · sale del grupo");
      else if (e.type === "kick") text = e.why === "kick"
        ? T("worker " + W(e.slot) + " went " + c.pollLimit + " s without a poll · dropped from the group", "el trabajador " + W(e.slot) + " pasó " + c.pollLimit + " s sin hacer poll · sale del grupo")
        : T("worker " + W(e.slot) + " didn't join the rebalance in time · dropped", "el trabajador " + W(e.slot) + " no entró al rebalanceo a tiempo · sale del grupo");
      else if (e.type === "failed") text = T("worker " + W(e.slot) + "'s commit failed · " + e.n + " records will be done again", "falló el commit del trabajador " + W(e.slot) + " · " + e.n + " registros se harán otra vez");
      else if (e.type === "revoke") text = T("lane " + e.lanes.map(W).join(", ") + " changes hands · second round", "el carril " + e.lanes.map(W).join(", ") + " cambia de dueño · segunda ronda");
      else if (e.type === "assigned") {
        const map = e.owners.map((o) => (o === null ? "–" : W(o))).join(" ");
        text = T("lanes handed out · owners " + map, "carriles repartidos · dueños " + map);
      }
      if (text) note = { t: e.t, text };
    }
    if (logAt > 2000) { model.log.splice(0, logAt); logAt = 0; }
  }
  function status() {
    const co = model.co, eager = model.cfg.protocol === "eager";
    if (co.state === "joining") {
      const waiting = model.slots.filter((s) => s.inGroup && !s.joined).length;
      // eager: each lane stops when its owner joins the round, so say how many have stopped so far
      if (eager) {
        const stopped = model.lanes.filter((l) => l.stopped).length;
        const lanes = stopped === LANES ? T("all " + LANES + " lanes stopped", "los " + LANES + " carriles detenidos") : T(stopped + " of " + LANES + " lanes stopped so far", stopped + " de " + LANES + " carriles detenidos por ahora");
        return T("eager rebalance · " + lanes.en + " · waiting for " + waiting + " worker" + (waiting === 1 ? "" : "s") + " to finish a batch", "rebalanceo eager · " + lanes.es + " · esperando a que " + waiting + " trabajador" + (waiting === 1 ? "" : "es") + " termine" + (waiting === 1 ? "" : "n") + " su lote");
      }
      return T("cooperative rebalance, round " + co.round + " · lanes keep running · waiting for " + waiting + " to poll", "rebalanceo cooperativo, ronda " + co.round + " · los carriles siguen · esperando el poll de " + waiting);
    }
    if (co.state === "syncing") return T("everyone has joined · the coordinator hands out the lanes", "todos entraron · el coordinador reparte los carriles");
    return null;
  }

  // ---------- painting ----------
  function paint(dt, snap) {
    narrate();
    for (const r of recs.values()) r.seen = false;
    const H = G.BED_H + 0.3;
    model.lanes.forEach((l, i) => {
      const n = Math.min(G.SLOT_Y.length, l.end - l.next);
      for (let k = 0; k < n; k++) {
        const off = l.next + k, fresh = l.born[off] > clock - 1.5;
        want("L" + i + ":" + off, off, [G.LANE_X[i], G.SLOT_Y[k], H], lanesL[i], false, fresh && !snap ? G.CHUTE[i] : null);
      }
      lagC[i].setClamped(l.end - l.committed);
      const stopped = l.stopped;
      show(gates[i].up, !stopped); show(gates[i].down, stopped);
      setText(owners[i], l.owner === null ? "–" : String(l.owner + 1));
    });
    model.slots.forEach((s, i) => {
      if (s.state === "up" && s.cur) {
        const [li, off] = s.cur;
        want("D" + i + ":" + li + ":" + off, off, G.DESK_SPOT[i], deskL, false, snap ? null : [G.LANE_X[li], G.SLOT_Y[0], H]);
      }
      const p = people[i];
      show(p.up, s.state === "up" && s.inGroup); show(p.out, s.state === "up" && !s.inGroup); show(p.fallen, s.state === "crashed");
      const n = s.state === "up" ? Math.min(slips[i].length, s.uncommitted.length) : 0;
      slips[i].forEach((el, k) => show(el, k < n));
      polls[i].set(s.state === "up" && s.batch.length ? (clock - s.lastPoll) / model.cfg.pollLimit : 0);
    });
    // the bench holds workers away and out of the group: a static member restarting keeps its place in the group
    const away = model.slots.filter((s) => (s.state === "off" || s.state === "down") && !s.inGroup).length;
    spares.forEach((el, n) => show(el, n < away));
    const co = model.co;
    show(lampOn, co.state !== "stable"); show(lampOff, co.state === "stable");
    const silent = model.slots.filter((s) => s.inGroup && s.state !== "up").map((s) => (clock - s.lastHb) / model.cfg.session);
    session.set(silent.length ? clamp(Math.max(...silent)) : 0);

    // records that left the model's view: a lane record went to a desk (its desk copy takes over); a desk record is done
    for (const [key, r] of recs) {
      if (r.seen) continue;
      if (snap || key[0] === "L") { drop(key); continue; }
      if (!r.leaving) { r.leaving = true; r.until = performance.now() + 350; r.target = [r.target[0] + 9, r.target[1], r.target[2] + 1]; }
      else if (performance.now() > r.until) drop(key);
    }
    const f = snap ? 1 : 1 - Math.exp(-dt * 10);
    for (const r of recs.values()) {
      const [tx, ty, tz] = r.target;
      const dist = Math.hypot(tx - r.pos[0], ty - r.pos[1]);
      r.pos[0] = lerp(r.pos[0], tx, f); r.pos[1] = lerp(r.pos[1], ty, f);
      r.pos[2] = snap ? tz : lerp(r.pos[2], tz + Math.min(6, dist * 0.2), f);
      r.el.g.setAttribute("transform", translateAlong(P, r.pos));
      r.el.g.__y = r.pos[1];
      if (r.leaving) r.el.g.style.opacity = String(clamp((r.until - performance.now()) / 300));
      else if (r.el.g.style.opacity) r.el.g.style.opacity = "";
    }
    // painter's order in each lane: the back (small y) first
    for (const layer of lanesL) {
      const kids = [...layer.children];
      const sorted = [...kids].sort((a, b) => a.__y - b.__y);
      if (sorted.some((el, n) => el !== kids[n])) sorted.forEach((el) => layer.appendChild(el));
    }

    // counters, stats and the readout
    const st = model.st;
    counters.rebalances.setClamped(co.rebalances); counters.done.setClamped(st.committedN); counters.twice.setClamped(st.duplicates);
    history.push({ t: clock, c: st.committedN });
    while (history.length > 2 && history[1].t <= clock - 10) history.shift();
    const span = clock - history[0].t;
    stat("lag", model.lag());
    stat("rate", span > 1 ? ((st.committedN - history[0].c) / span).toFixed(1) : "–");
    stat("rebalances", co.rebalances);
    stat("stopped", model.lanes.filter((l) => l.stopped).length + " / " + LANES);
    stat("twice", st.duplicates);
    const members = model.slots.filter((s) => s.inGroup).length;
    stat("members", members);
    const now = status();
    if (note && clock - note.t < 2.5) say(note.text);
    else if (now) say(now);
    else say(T(members + " worker" + (members === 1 ? "" : "s") + " in the group · lag " + model.lag() + " · " + model.lanes.filter((l) => l.stopped).length + " lanes stopped",
      members + " trabajador" + (members === 1 ? "" : "es") + " en el grupo · lag " + model.lag() + " · " + model.lanes.filter((l) => l.stopped).length + " carriles detenidos"));
  }

  // ---------- the loop ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(dt); }, onPause: pause.onPause });
  pause.bind(loop);

  const NUM = ["workers", "rate", "session", "pollLimit", "slow"];
  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = NUM.includes(name) ? Number(raw) : String(raw);
    if (!quiet) { restart(); note = { t: clock, text: T("settings applied · run restarted", "ajustes aplicados · ejecución reiniciada") }; }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    add: () => { const i = model.addWorker(); if (i === null) note = { t: clock, text: T("every desk is taken: six lanes, six workers at most", "todos los escritorios están ocupados: seis carriles, seis trabajadores como máximo") }; wake(); },
    remove: () => { const i = model.removeWorker(); note = { t: clock, text: i === null ? T("no worker to stop", "no hay trabajador para detener") : T("worker " + W(i) + " will stop after its batch", "el trabajador " + W(i) + " se detendrá después de su lote") }; wake(); },
    crash: () => { const i = model.crash(); if (i === null) note = { t: clock, text: T("no worker to crash", "no hay trabajador para tumbar") }; wake(); },
    rolling: () => { const n = model.rolling(15); note = { t: clock, text: T("rolling restart · " + n + " workers, one every 15 s", "reinicio escalonado · " + n + " trabajadores, uno cada 15 s") }; wake(); },
    reset: () => { restart(); note = { t: clock, text: T("started over", "empezó de nuevo") }; },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const k of ["workers", "rate", "protocol", "members", "session", "pollLimit", "slow"]) set(k, String(w[k]), true);
    set("speed", String(w.speed || 1));
    restart();
    if (w.then === "add") model.at(clock + 4, () => model.addWorker());
    if (w.then === "rolling") model.at(clock + 1, () => model.rolling(20));
    if (w.then === "crash") model.at(clock + 4, () => model.crash(1));
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

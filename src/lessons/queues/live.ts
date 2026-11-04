// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The parcel office in the browser: runs the model, eases parcels toward where it has them, and answers the
// controls. mount() gets the build-time data from page.ts (geometry, parcel drawing) and root, the <wb-lesson>.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { playPause } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { makeQueue } from "./sim";

export default function mount({ P, G, PARCEL_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const NS = "http://www.w3.org/2000/svg";
  const layers = { back: q('[data-layer="back"]'), front: q('[data-layer="front"]') };
  const desks = [0, 1, 2, 3].map((i) => q('[data-desk="' + i + '"]'));
  const clerkEls = [0, 1, 2, 3].map((i) => q('[data-clerk="' + i + '"]'));
  const fallenEls = [0, 1, 2, 3].map((i) => q('[data-fallen="' + i + '"]'));
  const stamps = [0, 1, 2, 3].map((i) => q('[data-stamp="' + i + '"]'));
  const gate = q("[data-gate]"), gateArm = q("[data-gate-arm] .iso-solid");
  const flagOn = q('[data-flag="on"]'), flagOff = q('[data-flag="off"]');
  const counters = Object.fromEntries(["inq", "oldest", "redelivered", "dead", "done", "twice", "turned"].map((n) => [n, WB.counter(svg, n, P)]));
  const meters = G.RACK_X.map((_, i) => WB.meter(svg, "vis" + i, P));
  const KEYS = "ABCD";

  // ---------- parcels: one pooled element per parcel on screen, eased toward where the model has it ----------
  const free = [];
  function makeEl() {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = PARCEL_SVG;
    const kind = (name) => { const r = g.querySelector('[data-kind="' + name + '"]'); return { g: r, body: r.querySelector("[data-body]"), num: r.querySelector("[data-num]"), key: r.querySelector("[data-key]"), bad: r.querySelector("[data-bad]"), tag: r.querySelector("[data-tag]"), tries: r.querySelector("[data-tries]") }; };
    return { g, kinds: { box: kind("box"), tall: kind("tall") }, shown: {} };
  }
  const recs = new Map();   // id -> { el, pos, target, layer, leaving, until, p }
  function take() { return free.pop() || makeEl(); }
  function drop(id) { const r = recs.get(id); r.el.g.remove(); free.push(r.el); recs.delete(id); }
  function dress(r, lit, tagShown) {
    const p = r.p, el = r.el, s = el.shown;
    const kind = p.slow ? "tall" : "box";
    if (s.kind !== kind) { s.kind = kind; el.kinds.box.g.style.display = kind === "box" ? "" : "none"; el.kinds.tall.g.style.display = kind === "tall" ? "" : "none"; }
    const k = el.kinds[kind];
    if (s.id !== p.id || s.k !== kind) {
      s.id = p.id; s.k = kind;
      const txt = String(p.id);
      k.num.textContent = txt; k.num.setAttribute("font-size", txt.length <= 2 ? 3.6 : txt.length === 3 ? 2.8 : 2.2);
      k.key.textContent = KEYS[p.key];
      k.bad.style.display = p.poison ? "" : "none";
    }
    if (s.lit !== lit) { s.lit = lit; k.body.toggleAttribute("data-lit", lit); k.body.toggleAttribute("data-lit-fill", lit); for (const t of [k.num, k.key]) t.setAttribute("data-tone", lit ? "on-lit" : "hi"); }
    const tg = tagShown ? String(p.tries) : "";
    if (s.tag !== tg) { s.tag = tg; k.tag.style.display = tg ? "" : "none"; if (tg) k.tries.textContent = tg; }
  }

  const cfg = { rate: 0.8, clerks: 3, order: "any", cap: "inf", crash: 0.1, poison: 0.02, tries: "3", handler: "after", speed: 1 };
  const WARM = 60;   // each run starts a minute in, so the first frame shows a working office
  let model, clock, logAt, lastEvent, lastStamp, lastDead, note, seed = 7;   // the first run opens on a typical minute: a short line, a parcel on the rack, a collapsed clerk, two in the cage

  function modelCfg() {
    return { rate: cfg.rate, clerks: cfg.clerks, service: 3, crash: cfg.crash, poison: cfg.poison, maxTries: cfg.tries === "inf" ? Infinity : 3, visibility: 6,
      order: cfg.order, keys: 4, cap: cfg.cap === "inf" ? Infinity : G.CAP, ackFirst: cfg.handler === "first", dedupe: cfg.handler === "idem", recover: 3 };
  }

  function restart(warm = WARM) {
    for (const id of [...recs.keys()]) drop(id);
    model = makeQueue(modelCfg(), seed);
    seed = (Date.now() % 1e6) + 1;
    clock = warm; logAt = 0; lastEvent = new Map(); lastStamp = [-9, -9, -9, -9]; lastDead = -9; note = null;
    model.runTo(clock);
    scanLog();
    desks.forEach((el, i) => el.toggleAttribute("data-off", i >= cfg.clerks));
    clerkEls.forEach((el, i) => el.toggleAttribute("data-off", i >= cfg.clerks));
    gate.style.display = cfg.cap === "inf" ? "none" : "";
    paint(0, true);
  }

  function scanLog() {
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt];
      lastEvent.set(e.id, e.type);
      if (e.type === "ack" && e.clerk !== undefined && !model.cfg.ackFirst) lastStamp[e.clerk] = e.t;
      if (e.type === "take" && model.cfg.ackFirst) lastStamp[e.clerk] = e.t;
      if (e.type === "dead") { lastDead = e.t; note = { t: e.t, text: T("parcel " + e.id + " failed " + model.cfg.maxTries + " times · into the cage", "el paquete " + e.id + " falló " + model.cfg.maxTries + " veces · a la jaula") }; }
      if (e.type === "crash") note = { t: e.t, text: T("clerk " + (e.clerk + 1) + " collapsed " + (e.after ? "after the work, before the stamp" : "mid-work") + " · parcel " + e.id + (model.cfg.ackFirst ? (e.after ? " was done" : " is lost") : " waits on the rack"),
        "el empleado " + (e.clerk + 1) + " se desplomó " + (e.after ? "después del trabajo, antes del sello" : "a mitad del trabajo") + " · el paquete " + e.id + (model.cfg.ackFirst ? (e.after ? " ya estaba hecho" : " se perdió") : " espera en el estante")) };
      if (e.type === "show") note = { t: e.t, text: T("parcel " + e.id + " back at the front of the lane", "el paquete " + e.id + " vuelve al frente del carril") };
      if (e.type === "reject") note = { t: e.t, text: T("lane full · parcel " + e.id + " turned away", "carril lleno · el paquete " + e.id + " fue rechazado") };
    }
  }

  const ease = lerp;
  function place(p, pos, layer, lit, tagShown) {
    let r = recs.get(p.id);
    if (!r) {
      const el = take();
      const fresh = p.born > clock - 1.2 && p.tries <= 1;
      r = { el, p, pos: fresh ? [...G.PROD_SPOT] : [...pos], layer: null };
      recs.set(p.id, r);
    }
    r.p = p; r.target = pos; r.leaving = false; r.seen = true;
    if (r.layer !== layer) { r.layer = layer; layers[layer].appendChild(r.el.g); }
    dress(r, lit, tagShown);
  }

  function paint(dt, snap) {
    scanLog();
    for (const r of recs.values()) r.seen = false;
    const Q = model.queue;
    for (let i = 0; i < Q.length; i++) {
      let pos = null;
      if (i < G.SLOTS) pos = [G.SLOT_X[i], G.LANE_Y, G.LANE_Z];
      else {
        const j = i - G.SLOTS, layer = Math.floor(j / 4), r = j % 4;
        if (layer < G.PILE.layers) pos = [G.PILE.xs[r % 2], G.PILE.ys[Math.floor(r / 2)], G.PILE.z + layer * G.PILE.step];
      }
      if (pos) place(Q[i], pos, "back", false, Q[i].tries >= 1);
    }
    model.clerks.forEach((c, i) => { if (c.p) place(c.p, G.DESK_SPOT[i], "front", true, c.p.tries >= 2); });
    [...model.hold].sort((a, b) => a.since - b.since).slice(0, G.RACK_X.length).forEach((h, k) => place(h.p, [G.RACK_X[k], G.RACK_Y, G.RACK_Z], "back", false, true));
    model.dead.slice(-G.CAGE_SPOTS.length).forEach((p, n) => place(p, G.CAGE_SPOTS[n], "back", false, true));
    model.rejected.filter((x) => x.t > clock - 2.5).slice(-2).forEach((x, n) => place(x.p, G.TRAY_SPOTS[n], "back", false, false));

    // parcels that left the model's view: into the cart if worked, onto the floor if lost
    for (const [id, r] of recs) {
      if (r.seen) continue;
      if (!r.leaving) {
        r.leaving = true; r.until = performance.now() + 700;
        if (lastEvent.get(id) === "lost") { r.target = [r.pos[0], r.pos[1] + 9, 0.2]; }
        else if (lastEvent.get(id) === "reject") { r.target = [r.pos[0], r.pos[1], -4]; }
        else { r.target = [...G.CART_SPOT]; r.fade = true; if (r.layer !== "front") { r.layer = "front"; layers.front.appendChild(r.el.g); } dress(r, false, false); }
      }
      if (snap || performance.now() > r.until) drop(id);
    }

    // move everything toward its target, with a little lift while travelling
    const f = snap ? 1 : 1 - Math.exp(-dt * 9);
    const backOrder = [];
    for (const r of recs.values()) {
      const [tx, ty, tz] = r.target;
      const dist = Math.hypot(tx - r.pos[0], ty - r.pos[1]);
      r.pos[0] = ease(r.pos[0], tx, f); r.pos[1] = ease(r.pos[1], ty, f);
      r.pos[2] = snap ? tz : ease(r.pos[2], tz + Math.min(9, dist * 0.18), f);
      r.el.g.setAttribute("transform", translateAlong(P, r.pos));
      if (r.leaving) r.el.g.style.opacity = String(Math.max(0, Math.min(1, (r.until - performance.now()) / 450)));
      else if (r.el.g.style.opacity) r.el.g.style.opacity = "";
      if (r.layer === "back") backOrder.push(r);
    }
    // painter's order inside the back layer: far parcels first, lower before higher
    backOrder.sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P));
    let prev = null, inOrder = true;
    for (const r of backOrder) { if (prev && r.el.g.previousElementSibling !== prev) { inOrder = false; break; } prev = r.el.g; }
    if (!inOrder) for (const r of backOrder) layers.back.appendChild(r.el.g);

    // clerks, stamps, gate, flag, rack timers
    model.clerks.forEach((c, i) => { const down = c.downUntil > clock; clerkEls[i].firstElementChild.style.display = down ? "none" : ""; fallenEls[i].style.display = down ? "" : "none"; });
    stamps.forEach((s, i) => { const k = clock - lastStamp[i]; const press = k >= 0 && k < 0.35 ? Math.sin(Math.PI * k / 0.35) : 0; s.setAttribute("transform", press ? translateAlong(P, [0, 0, -2.4 * press]) : ""); });
    const full = model.cfg.cap !== Infinity && Q.length >= model.cfg.cap;
    gateArm.toggleAttribute("data-lit", full);
    const fresh = clock - lastDead < 3;
    flagOn.style.display = fresh ? "" : "none"; flagOff.style.display = fresh ? "none" : "";
    const holds = [...model.hold].sort((a, b) => a.since - b.since);
    meters.forEach((m, k) => m.set(holds[k] ? Math.max(0, (holds[k].visibleAt - clock) / model.cfg.visibility) : 0));

    // counters and readout
    const st = model.st, oldest = model.oldestWait();
    counters.inq.set(Q.length); counters.oldest.set(Math.round(oldest)); counters.redelivered.set(st.redelivered); counters.dead.set(st.deadN);
    counters.done.set(st.done); counters.twice.set(st.harmful); counters.turned.set(st.rejectedN);
    stat("inq", Q.length); stat("oldest", oldest < 10 ? oldest.toFixed(1) + " s" : Math.round(oldest) + " s"); stat("done", st.done);
    stat("redelivered", st.redelivered); stat("twice", st.harmful + (model.cfg.dedupe && st.twice ? L(" (" + st.twice + " ignored)", " (" + st.twice + " ignorados)") : "")); stat("lost", st.lost); stat("dead", st.deadN); stat("turned", st.rejectedN);
    const busy = model.clerks.filter((c) => c.p).length;
    if (note && clock - note.t < 2.5) say(L(note.text));
    else say(L(Q.length + " in queue · oldest " + Math.round(oldest) + " s · " + busy + " of " + cfg.clerks + " clerks busy",
      Q.length + " en cola · el más antiguo " + Math.round(oldest) + " s · " + busy + " de " + cfg.clerks + " empleados ocupados"));
  }
  const stat = (key, value) => root.stat(key, value);

  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(dt); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = ["rate", "clerks", "crash", "poison"].includes(name) ? Number(raw) : raw;
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));
  const actions = {
    burst: () => { model.burst(clock, 30); note = { t: clock, text: T("30 parcels dropped at once", "30 paquetes soltados de golpe") }; if (loop.paused) loop.setPaused(false); },
    slow: () => { const p = model.slowOne(clock, 30, 0); note = { t: clock, text: T("parcel " + p.id + " for customer A takes 30 s", "el paquete " + p.id + " del cliente A tarda 30 s") }; if (loop.paused) loop.setPaused(false); },
    reset: () => restart(),
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    set("rate", String(w.rate), true); set("crash", String(w.crash), true); set("poison", String(w.poison), true); set("order", w.order, true);
    set("cap", w.cap, true); set("clerks", String(w.clerks), true); set("tries", w.tries || "3", true); set("handler", w.handler || "after", true);
    if (w.speed) set("speed", String(w.speed));
    restart(w.burst || w.slow ? 6 : WARM);
    if (loop.paused) loop.setPaused(false);
    if (w.burst) setTimeout(() => { model.burst(clock, 30); note = { t: clock, text: T("30 parcels dropped at once", "30 paquetes soltados de golpe") }; }, 1500);
    if (w.slow) { set("speed", "3"); setTimeout(() => { const p = model.slowOne(clock, 30, 0); note = { t: clock, text: T("parcel " + p.id + " for customer A takes 30 s · everyone waits behind it", "el paquete " + p.id + " del cliente A tarda 30 s · todos esperan detrás") }; }, 1500); }
  });

  loop.setPaused(loop.paused);
  restart();
}

// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The ring table in the browser: runs the model, eases items toward where it has them, and answers the controls.
// mount() gets the build-time data from page.ts (geometry, token drawing) and root, the <wb-lesson>.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, playPause } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { makeRing } from "./sim";

export default function mount({ P, G, TOKEN_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const NS = "http://www.w3.org/2000/svg";
  const layers = Object.fromEntries(["ring", "prod", "desk", "tray", "bin", "fly"].map((n) => [n, q('[data-layer="' + n + '"]')]));
  const handEls = { w: [], r: [] };
  for (let i = 0; i < G.CAP; i++) { handEls.w.push(q('[data-hand="w' + i + '"]')); handEls.r.push(q('[data-hand="r' + i + '"]')); }
  const lamp = { on: q('[data-lamp="on"]'), off: q('[data-lamp="off"]') };
  const flag = { on: q('[data-flag="on"]'), off: q('[data-flag="off"]') };
  const plates = [...svg.querySelectorAll("[data-policy]")];
  const prod2 = q("[data-prod2]");
  const counters = Object.fromEntries(["fill", "lag", "lost", "gaps", "read", "waiting", "stall"].map((n) => [n, WB.counter(svg, n, P)]));

  // ---------- items: one pooled element per item on screen, eased toward where the model has it ----------
  const free = [];
  function makeEl() {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = TOKEN_SVG;
    return { g, body: g.querySelector("[data-body]"), seq: g.querySelector("[data-seq]"), shown: {} };
  }
  const recs = new Map();   // item id -> { el, pos, target, layer, leaving, until, item }
  function dress(r, lit) {
    const s = r.el.shown, it = r.item;
    const n = it.seq ?? it.claimed, label = n === undefined ? "" : String(n);   // a claimed item shows the slot number it read
    if (s.label !== label) { s.label = label; r.el.seq.textContent = label; r.el.seq.setAttribute("font-size", label.length <= 2 ? 3 : label.length === 3 ? 2.4 : 1.9); }
    if (s.lit !== lit) { s.lit = lit; r.el.body.toggleAttribute("data-lit", lit); r.el.seq.setAttribute("data-tone", lit ? "on-lit" : "hi"); }
  }
  function moveTo(r, layer) { if (r.layer !== layer) { r.layer = layer; layers[layer].appendChild(r.el.g); } }
  function place(item, pos, layer, lit) {
    let r = recs.get(item.id);
    if (!r) {
      const el = free.pop() || makeEl();
      r = { el, item, pos: snapping ? [...pos] : [...G.PROD_SPOT], layer: null };
      recs.set(item.id, r);
    }
    r.item = item; r.target = pos; r.leaving = false; r.seen = true; r.want = layer;
    dress(r, lit);
  }
  function drop(id) { const r = recs.get(id); r.el.g.remove(); r.el.g.style.opacity = ""; free.push(r.el); recs.delete(id); }

  const cfg = { rate: 6, reader: "one", policy: "overwrite", check: "yes", producers: "one", speed: 0.5 };
  const WARM = 20;
  let model, clock, logAt, note, seed = 5, snapping = false, binned = [];
  const modelCfg = () => ({ cap: G.CAP, rate: cfg.rate, policy: cfg.policy, check: cfg.check === "yes", overhead: 0.15, per: 0.1, batch: cfg.reader === "batch", maxBatch: 16,
    producers: cfg.producers === "one" ? 1 : 2, claim: cfg.producers === "atomic" ? "atomic" : "racy", window: 0.1 });

  function restart(warm = WARM) {
    for (const id of [...recs.keys()]) drop(id);
    model = makeRing(modelCfg(), seed);
    seed = (Date.now() % 1e6) + 1;
    clock = warm; logAt = 0; note = null; binned = [];
    model.runTo(clock);
    plates.forEach((p) => show(p, p.dataset.policy === cfg.policy));
    show(prod2, cfg.producers !== "one");
    snapping = true; paint(0, true); snapping = false;
  }

  // What happened since the last frame: lost items go to the bin; the newest message goes to the readout.
  function scanLog() {
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt];
      if (e.type === "overwrite") { binned.push(e.item); note = { t: e.t, text: e.behind
        ? T("item " + e.seq + " was left behind the reader · item " + e.by + " writes over it", "el elemento " + e.seq + " quedó detrás del lector · el " + e.by + " lo sobrescribe")
        : T("ring full · item " + e.by + " overwrote item " + e.seq + " before it was read", "anillo lleno · el elemento " + e.by + " sobrescribió al " + e.seq + " antes de que se leyera") }; }
      if (e.type === "clobber") { binned.push(e.item); note = { t: e.t, text: T("both producers took slot " + e.slot + " · item " + e.seq + " was written over before it was read", "los dos productores tomaron el hueco " + e.slot + " · el elemento " + e.seq + " se sobrescribió antes de leerse") }; }
      if (e.type === "drop") { binned.push(e.item); note = { t: e.t, text: T("ring full · the new item was dropped at the producer", "anillo lleno · el elemento nuevo se descartó en el productor") }; }
      if (e.type === "wait" && model.backlog.length === 1) note = { t: e.t, text: T("ring full · the producer waits with its item", "anillo lleno · el productor espera con su elemento") };
      if (e.type === "gap") note = { t: e.t, text: T("reader expected " + e.from + ", found a newer item · skipped " + (e.to - e.from) + ", goes on from " + e.to, "el lector esperaba el " + e.from + " y encontró uno más nuevo · saltó " + (e.to - e.from) + ", sigue desde el " + e.to) };
      if (e.type === "silent") note = { t: e.t, text: T("reader expected " + e.expected + ", read " + e.found + " instead · and didn't notice", "el lector esperaba el " + e.expected + " y leyó el " + e.found + " · y no se dio cuenta") };
    }
    if (binned.length > 60) binned = binned.slice(-G.BIN_SPOTS.length);
  }

  const ease = lerp;
  function paint(dt, snap) {
    scanLog();
    for (const r of recs.values()) r.seen = false;
    const m = model;
    // the ring: unread items sit in their pockets
    m.slots.forEach((it, i) => { if (it && !it.read && !it.lost) place(it, [...G.SLOT[i]], "ring", false); });
    // two producers: an item claimed but not yet stored waits, lit, in its producer's hands
    (m.pending || []).forEach((p) => place(p.item, [...(p.item.prod ? G.PROD2_SPOT : G.PROD_SPOT)], "prod", true));
    // the reader's hand
    m.reader.hand.forEach((it, k) => { const s = G.HAND_SPOTS[k % G.HAND_SPOTS.length]; place(it, [s[0], s[1], s[2] + Math.floor(k / G.HAND_SPOTS.length) * (G.TOKEN.h + 0.3)], "desk", true); });
    // the blocked producer's pile
    m.backlog.forEach((it, k) => {
      const per = G.BACKLOG.xs.length * G.BACKLOG.ys.length, layer = Math.floor(k / per);
      if (layer >= G.BACKLOG.layers) return;
      const j = k % per;
      place(it, [G.BACKLOG.xs[j % G.BACKLOG.xs.length], G.BACKLOG.ys[Math.floor(j / G.BACKLOG.xs.length)], G.BACKLOG.z + layer * (G.TOKEN.h + 0.4)], "prod", false);
    });
    // the bin keeps the last few lost items
    binned.slice(-G.BIN_SPOTS.length).forEach((it, n) => place(it, [...G.BIN_SPOTS[n]], "bin", false));

    // items that left: read ones slide into the tray and fade, the rest just fade
    for (const [id, r] of recs) {
      if (r.seen) continue;
      if (!r.leaving) {
        r.leaving = true; r.until = performance.now() + 650;
        if (r.want === "desk") { r.target = [...G.TRAY_SPOT]; r.want = "tray"; dress(r, false); }
        else r.target = [...r.pos];
      }
      if (snap || performance.now() > r.until) drop(id);
    }

    // ease toward targets, lifting a little while travelling
    const f = snap ? 1 : 1 - Math.exp(-dt * 16);
    const byLayer = {};
    for (const r of recs.values()) {
      const [tx, ty, tz] = r.target;
      const dist = Math.hypot(tx - r.pos[0], ty - r.pos[1]);
      r.pos[0] = ease(r.pos[0], tx, f); r.pos[1] = ease(r.pos[1], ty, f);
      r.pos[2] = snap ? tz : ease(r.pos[2], tz + Math.min(10, dist * 0.2), f);
      // a moving item flies over everything, then settles into its station's layer
      moveTo(r, dist > 3 && !r.leaving ? "fly" : r.want);
      r.el.g.setAttribute("transform", translateAlong(P, r.pos));
      if (r.leaving) r.el.g.style.opacity = String(Math.max(0, Math.min(1, (r.until - performance.now()) / 400)));
      (byLayer[r.layer] ||= []).push(r);
    }
    // painter's order inside each layer: far items first, lower before higher
    for (const [name, list] of Object.entries(byLayer)) {
      list.sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P));
      let prev = null, inOrder = true;
      for (const r of list) { if (prev && r.el.g.previousElementSibling !== prev) { inOrder = false; break; } prev = r.el.g; }
      if (!inOrder) for (const r of list) layers[name].appendChild(r.el.g);
    }

    // hands, lamp, flag
    const wi = m.w % G.CAP, ri = m.r % G.CAP;
    handEls.w.forEach((el, i) => show(el, i === wi));
    handEls.r.forEach((el, i) => show(el, i === ri));
    const full = m.full();
    show(lamp.on, full); show(lamp.off, !full);
    const blocked = m.backlog.length > 0;
    show(flag.on, blocked); show(flag.off, !blocked);

    // counters, stats and the readout
    const st = m.st, lag = m.w - m.r;
    counters.fill.set(m.fill()); counters.lag.set(Math.min(999, lag)); counters.lost.set(m.lost()); counters.gaps.set(st.gapsSeen);
    counters.read.set(st.read); counters.waiting.set(m.backlog.length); counters.stall.set(Math.round(m.stalled()));
    stat("fill", m.fill() + "/" + G.CAP); stat("lag", lag); stat("lost", m.lost()); stat("gaps", st.gapsSeen);
    stat("stall", m.stalled().toFixed(1) + " s"); stat("batch", st.ops ? (st.opItems / st.ops).toFixed(1) : "–");
    narrate();
  }
  function narrate() {
    if (note && clock - note.t < 2.2) { say(L(note.text)); return; }
    const m = model, lag = m.w - m.r;
    if (m.reader.pausedUntil > clock) { say(L("reader stopped · " + m.fill() + " of " + G.CAP + " pockets in use", "lector detenido · " + m.fill() + " de " + G.CAP + " huecos ocupados")); return; }
    say(L("written " + m.w + " · read " + m.st.read + " · " + m.fill() + " of " + G.CAP + " in use" + (lag > G.CAP ? " · lapped by " + (lag - G.CAP) : ""),
      "escritos " + m.w + " · leídos " + m.st.read + " · " + m.fill() + " de " + G.CAP + " ocupados" + (lag > G.CAP ? " · le sacó " + (lag - G.CAP) + " de ventaja" : "")));
  }
  const stat = (key, value) => root.stat(key, value);

  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(dt); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = name === "rate" ? Number(raw) : raw;
    if (quiet) return;
    // the producer's rate, the reader and the checks change the running ring; the policy starts a new run
    if (name === "rate") model.setRate(cfg.rate);
    else if (name === "producers") restart();
    else if (name === "reader") model.cfg.batch = cfg.reader === "batch";
    else if (name === "check") model.cfg.check = cfg.check === "yes";
    else restart();
  }
  root.on("change", (name, value) => set(name, value));
  const burst = () => { model.inject(clock, 40); note = { t: clock, text: T("40 items arrive at once", "llegan 40 elementos de golpe") }; };
  const actions = {
    burst: () => { burst(); if (loop.paused) loop.setPaused(false); },
    stop: () => { model.pauseReader(clock, 5); note = { t: clock, text: T("the reader stops for 5 s", "el lector se detiene 5 s") }; if (loop.paused) loop.setPaused(false); },
    reset: () => restart(),
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    set("rate", String(w.rate), true); set("policy", w.policy, true); set("reader", w.reader, true); set("check", w.check, true); set("producers", w.producers || "one", true);
    restart(w.burst ? 4 : WARM);
    if (loop.paused) loop.setPaused(false);
    if (w.burst) setTimeout(burst, 1200);
  });

  loop.setPaused(loop.paused);
  restart();
}

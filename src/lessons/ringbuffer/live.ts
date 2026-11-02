// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The ring table in the browser: runs the model, eases items toward where it has them, wires the controls and the
// experiment cards. mount() gets the build-time data from page.ts (geometry, token drawing, results).
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats, show, act, pauseControls } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { one, int } from "../../lib/format";
import { makeRing } from "./sim";

export default function mount({ P, G, TOKEN_SVG, RESULTS, EXPERIMENTS }) {
  const stage = document.querySelector("[data-ring]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const say = readout();
  const NS = "http://www.w3.org/2000/svg";
  const layers = Object.fromEntries(["ring", "prod", "desk", "tray", "bin", "fly"].map((n) => [n, q('[data-layer="' + n + '"]')]));
  const handEls = { w: [], r: [] };
  for (let i = 0; i < G.CAP; i++) { handEls.w.push(q('[data-hand="w' + i + '"]')); handEls.r.push(q('[data-hand="r' + i + '"]')); }
  const lamp = { on: q('[data-lamp="on"]'), off: q('[data-lamp="off"]') };
  const flag = { on: q('[data-flag="on"]'), off: q('[data-flag="off"]') };
  const plates = [...svg.querySelectorAll("[data-policy]")];
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
    const label = it.seq === undefined ? "" : String(it.seq);
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

  const cfg = { rate: 6, reader: "one", policy: "overwrite", check: "yes", speed: 0.5 };
  const WARM = 20;
  let model, clock, logAt, note, seed = 5, snapping = false, binned = [];
  const modelCfg = () => ({ cap: G.CAP, rate: cfg.rate, policy: cfg.policy, check: cfg.check === "yes", overhead: 0.15, per: 0.1, batch: cfg.reader === "batch", maxBatch: 16 });

  function restart(warm = WARM) {
    for (const id of [...recs.keys()]) drop(id);
    model = makeRing(modelCfg(), seed);
    seed = (Date.now() % 1e6) + 1;
    clock = warm; logAt = 0; note = null; binned = [];
    model.runTo(clock);
    plates.forEach((p) => show(p, p.dataset.policy === cfg.policy));
    snapping = true; paint(0, true); snapping = false;
  }

  // What happened since the last frame: lost items go to the bin; the newest message goes to the readout.
  function scanLog() {
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt];
      if (e.type === "overwrite") { binned.push(e.item); note = { t: e.t, text: T("ring full · item " + e.by + " overwrote item " + e.seq + " before it was read", "anillo lleno · el elemento " + e.by + " sobrescribió al " + e.seq + " antes de que se leyera") }; }
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
  const stat = stats();

  const pause = pauseControls(stage, say);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(dt); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    WB.pressSeg(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = name === "rate" ? Number(raw) : raw;
    if (quiet) return;
    // the producer's rate, the reader and the checks change the running ring; the policy starts a new run
    if (name === "rate") model.setRate(cfg.rate);
    else if (name === "reader") model.cfg.batch = cfg.reader === "batch";
    else if (name === "check") model.cfg.check = cfg.check === "yes";
    else restart();
  }
  WB.onSegments((name, value) => set(name, value));
  const burst = () => { model.inject(clock, 40); note = { t: clock, text: T("40 items arrive at once", "llegan 40 elementos de golpe") }; };
  act("burst").addEventListener("click", () => { burst(); if (loop.paused) loop.setPaused(false); });
  act("stop").addEventListener("click", () => { model.pauseReader(clock, 5); note = { t: clock, text: T("the reader stops for 5 s", "el lector se detiene 5 s") }; if (loop.paused) loop.setPaused(false); });
  act("reset").addEventListener("click", () => restart());

  // ---------- experiments (numbers computed from the same model) ----------
  // Whole numbers with thousands separators (3,600), as the original page printed them; src/lib/format's n0 has none.
  const RUNS = {
    burst: () => {
      const { overwrite: o, drop: d, block: b } = RESULTS.burst;
      return { verdict: T("Overwrite: " + int(o.lost) + " lost, items " + o.lostFrom + " to " + o.lostTo + " of the burst; the reader got the newest 16. Drop: " + int(d.lost) + " lost, items " + d.lostFrom + " to " + d.lostTo + ". Block: " + int(b.lost) + " lost; the producer held up to " + int(b.held) + " items and stood still for " + one(b.stall) + " s, and the ring took " + one(b.empty) + " s to empty instead of " + one(o.empty) + " s.",
          "Sobrescribir: " + int(o.lost) + " perdidos, los elementos " + o.lostFrom + " a " + o.lostTo + " de la ráfaga; el lector recibió los 16 más nuevos. Descartar: " + int(d.lost) + " perdidos, los elementos " + d.lostFrom + " a " + d.lostTo + ". Frenar: " + int(b.lost) + " perdidos; el productor llegó a sostener " + int(b.held) + " elementos y estuvo quieto " + one(b.stall) + " s, y el anillo tardó " + one(b.empty) + " s en vaciarse en lugar de " + one(o.empty) + " s."),
        bars: [[T("Lost, overwrite", "Perdidos, sobrescribir"), o.lost / 40, T("#" + o.lostFrom + "–" + o.lostTo, "n.º " + o.lostFrom + "–" + o.lostTo), true], [T("Lost, drop", "Perdidos, descartar"), d.lost / 40, T("#" + d.lostFrom + "–" + d.lostTo, "n.º " + d.lostFrom + "–" + d.lostTo), true], [T("Lost, block", "Perdidos, frenar"), b.lost / 40, "0"], [T("Producer stalled, block (of 20 s)", "Productor quieto, frenar (de 20 s)"), Math.min(1, b.stall / 20), one(b.stall) + " s"]] };
    },
    lap: () => {
      const { naive: a, checked: c } = RESULTS.lap, top = Math.max(a.written, 1);
      return { verdict: T("In both runs about " + int(a.written) + " were written and " + int(a.read) + " read. Overwritten before being read: " + int(a.lost) + " without checks, " + int(c.lost) + " with them. The checking reader counted " + int(c.seen) + " skipped; the other counted 0, and " + int(a.silent) + " of its " + int(a.read) + " reads were not the item it thought it was reading.",
          "En las dos ejecuciones se escribieron cerca de " + int(a.written) + " y se leyeron " + int(a.read) + ". Sobrescritos antes de leerse: " + int(a.lost) + " sin revisar, " + int(c.lost) + " revisando. El lector que revisa contó " + int(c.seen) + " saltados; el otro contó 0, y " + int(a.silent) + " de sus " + int(a.read) + " lecturas no eran el elemento que creía estar leyendo."),
        bars: [[T("Lost, no checks", "Perdidos, sin revisar"), a.lost / top, int(a.lost), true], [T("Noticed, no checks", "Notados, sin revisar"), 0, "0", true], [T("Lost, with checks", "Perdidos, revisando"), c.lost / top, int(c.lost)], [T("Noticed, with checks", "Notados, revisando"), c.seen / top, int(c.seen)]] };
    },
    size: () => {
      const { c64, c128, c256 } = RESULTS.size;
      return { verdict: T("64 slots: filled up, " + int(c64.lost) + " dropped. 128 slots: peaked at " + int(c128.peak) + ", nothing dropped. 256 slots: peaked at " + int(c256.peak) + ", nothing dropped, " + int(256 - c256.peak) + " slots never used.",
          "64 huecos: se llenó y se descartaron " + int(c64.lost) + ". 128 huecos: llegó a " + int(c128.peak) + ", no se descartó nada. 256 huecos: llegó a " + int(c256.peak) + ", no se descartó nada y " + int(256 - c256.peak) + " huecos nunca se usaron."),
        bars: [[T("Peak fill, 64 slots", "Máximo ocupado, 64 huecos"), c64.peak / 256, int(c64.peak)], [T("Dropped, 64 slots", "Descartados, 64 huecos"), c64.lost / 200, int(c64.lost), true], [T("Peak fill, 128 slots", "Máximo ocupado, 128 huecos"), c128.peak / 256, int(c128.peak)], [T("Peak fill, 256 slots", "Máximo ocupado, 256 huecos"), c256.peak / 256, int(c256.peak)]] };
    },
    block: () => {
      const { block: b, overwrite: o } = RESULTS.block;
      return { verdict: T("Block: " + int(b.lost) + " lost, " + int(b.read) + " read; the producer was stalled " + int(b.stall) + " of the 60 s and " + int(b.backlog) + " items were waiting in front of it at the end, the oldest for " + int(b.wait) + " s. Overwrite: the same " + int(o.read) + " read, nothing waiting, " + int(o.lost) + " lost.",
          "Frenar: " + int(b.lost) + " perdidos, " + int(b.read) + " leídos; el productor estuvo frenado " + int(b.stall) + " de los 60 s y al final había " + int(b.backlog) + " elementos esperando delante de él, el más viejo desde hacía " + int(b.wait) + " s. Sobrescribir: los mismos " + int(o.read) + " leídos, nada esperando, " + int(o.lost) + " perdidos."),
        bars: [[T("Producer stalled, block", "Productor frenado, frenar"), b.stall / 60, int(b.stall) + " s", true], [T("Waiting upstream, block", "Esperando antes, frenar"), b.backlog / 200, int(b.backlog), true], [T("Lost, overwrite", "Perdidos, sobrescribir"), o.lost / 200, int(o.lost)], [T("Read, either way", "Leídos, en ambos casos"), b.read / 480, int(b.read)]] };
    },
    batch: () => {
      const { one: a, batch: b } = RESULTS.batch;
      return { verdict: T("One at a time: " + int(a.read) + " of " + int(a.arrived) + " read, " + int(a.lost) + " dropped, average wait " + one(a.wait) + " s. Batches: " + int(b.read) + " read, " + int(b.lost) + " dropped, " + one(b.perOp) + " items per read on average, average wait " + int(b.wait * 1000) + " ms, reader busy " + Math.round(b.busy * 100) + "% of the time.",
          "De a uno: " + int(a.read) + " de " + int(a.arrived) + " leídos, " + int(a.lost) + " descartados, espera media " + one(a.wait) + " s. Por lotes: " + int(b.read) + " leídos, " + int(b.lost) + " descartados, " + one(b.perOp) + " elementos por lectura en promedio, espera media " + int(b.wait * 1000) + " ms, lector ocupado el " + Math.round(b.busy * 100) + "% del tiempo."),
        bars: [[T("Dropped, one at a time", "Descartados, de a uno"), a.lost / a.arrived, int(a.lost), true], [T("Dropped, batches", "Descartados, por lotes"), b.lost / b.arrived, int(b.lost)], [T("Items per read, batches (of 4)", "Elementos por lectura, lotes (de 4)"), b.perOp / 4, one(b.perOp)], [T("Average wait, one at a time (of 2 s)", "Espera media, de a uno (de 2 s)"), Math.min(1, a.wait / 2), one(a.wait) + " s", true]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    set("rate", String(w.rate), true); set("policy", w.policy, true); set("reader", w.reader, true); set("check", w.check, true);
    restart(w.burst ? 4 : WARM);
    if (loop.paused) loop.setPaused(false);
    if (w.burst) setTimeout(burst, 1200);
  } });

  loop.setPaused(loop.paused);
  restart();
}

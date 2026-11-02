// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The tally hall in the browser: runs the live model, moves tally cards to the wall and traces through the sampler,
// wires the controls and the experiment cards. mount() gets the build-time data from page.ts (geometry, tokens,
// results).
import { iso, translateAlong, lineOnTop } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import { digitPath, counterCells } from "../../../workbench/digits.mjs";
import * as WB from "../../runtime/wb";
import { L, T, digitsOf } from "../../runtime/wb";
import { readout, stats, act, pauseControls } from "../../runtime/dom";
import { one, int } from "../../lib/format";
import { meanBy } from "../../lib/stats";
import { makeLive, seriesBytes, LIVE_RATE, BYTES_PER_SERIES } from "./sim";

export default function mount({ P, G, TOK, RESULTS, EXPERIMENTS }) {
  const VM = 45, VT = 30, HOP = 0.45, DROP = 0.5, WAIT = 2.5, SLOTHOP = 0.3, WARM = 40;

  const stage = document.querySelector("[data-hall]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const say = readout();
  const NS = "http://www.w3.org/2000/svg";
  // Set a path's d only when it changes.
  const setD = (el, d) => { if (el.getAttribute("d") !== d) el.setAttribute("d", d); };

  const holes = Array.from({ length: G.HOLES }, (_, i) => q('[data-hole="' + i + '"]'));
  const bins = Array.from({ length: G.BIN_LEVELS }, (_, i) => q('[data-bin="' + (i + 1) + '"]'));
  const cards = Array.from({ length: G.CARDS }, (_, s) => { const g = q('[data-card="' + s + '"]'); return { g, solid: g.querySelector(".iso-solid") }; });
  const needle = q("[data-needle]");
  const gate = (name) => ({ parts: [...svg.querySelectorAll('[data-gate="' + name + '"]')], text: q('[data-gate-text="' + name + '"]') });
  const gates = { head: gate("head"), tail: gate("tail") };
  const rackCover = q("[data-rack-cover]");

  function counter(name, c) { const cells = counterCells(c); return { c, cells, els: cells.map((_, j) => q('[data-digit="' + name + '-' + j + '"]')), shown: [] }; }
  const dials = Object.fromEntries(["requests", "series", "kept", "errors", "errorsKept"].map((n) => [n, counter(n, G.COUNTERS[n])]));
  function showCount(dial, v) { digitsOf(v, dial.c.count).forEach((d, j) => { if (dial.shown[j] !== d) { dial.shown[j] = d; dial.els[j].setAttribute("d", digitPath(iso, P, dial.cells[j], d)); } }); }

  function makePool(layer, kinds, n) {
    return Array.from({ length: n }, () => {
      const g = document.createElementNS(NS, "g"); g.style.display = "none";
      const parts = {};
      for (const kind of kinds) { const sub = document.createElementNS(NS, "g"); sub.innerHTML = TOK[kind]; sub.style.display = "none"; g.appendChild(sub); parts[kind] = { g: sub, solid: sub.firstElementChild }; }
      layer.appendChild(g); return { g, parts, kind: null };
    });
  }
  const mPool = makePool(q("[data-mtokens]"), ["metric"], 70);
  const tPool = makePool(q("[data-ttokens]"), ["flat", "tall"], 90);

  const cfg = { labels: "status", route: "template", sampling: "tail", errorRate: 0.02, speed: 1 };
  let model, clock, next, active, slotFree, keptSeq, seriesShown, keptCount, errSeen, errKept, holeHit, cardReq, reqCount;
  let seed = (Date.now() % 1e6) + 1;

  // ---- each request's path through the machine, worked out once ----
  function plan(r) {
    // the tally card
    const over = r.idx >= G.HOLES, hole = over ? null : G.holes[r.idx];
    const xc = over ? G.MBELT.x1 - 2 : hole.cx;
    const mBelt = (xc - G.OUT_X - 2) / VM;
    r.m = { xc, over, hole, belt: mBelt, arrive: r.t + mBelt + HOP };
    // the trace
    const segs = [];
    let x = G.OUT_X + 2, t = r.t;
    const y = G.TBELT.y, z = G.TBELT.z;
    const run = (x1) => { segs.push({ t0: t, t1: t + (x1 - x) / VT, a: [x, y, z], b: [x1, y, z] }); t += (x1 - x) / VT; x = x1; };
    const hop = (to, d, lift) => { const a = segs.length ? segs[segs.length - 1].b : [x, y, z]; segs.push({ t0: t, t1: t + d, a, b: to, lift }); t += d; };
    const sit = (d) => { const a = segs[segs.length - 1].b; segs.push({ t0: t, t1: t + d, a, b: a }); t += d; };
    r.dropped = false;
    if (cfg.sampling === "tail") {
      let s = 0; for (; s < G.SLOTS; s++) { const tin = r.t + (G.slots[s][0] - x) / VT; if (slotFree[s] <= tin) break; }
      if (s === G.SLOTS) s = r.n % G.SLOTS;
      const [sx, sy, sz] = G.slots[s];
      run(sx); hop([sx, sy, sz], SLOTHOP, 5); r.slotIn = t; sit(WAIT); r.slotOut = t; hop([sx, y, z], SLOTHOP, 5); x = sx;
      slotFree[s] = t;
      run(G.TAIL_GATE); r.tDecide = t;
      if (!r.kept) { hop([G.TAIL_GATE, G.DROP_Y, 2], DROP, 3); r.dropped = true; }
    } else {
      run(G.HEAD_GATE); r.tDecide = t;
      if (!r.headKeep) { hop([G.HEAD_GATE, G.DROP_Y, 2], DROP, 3); r.dropped = true; }
    }
    if (!r.dropped) {
      r.seq = keptSeq++;
      run(G.TBELT.x1); if (cfg.sampling === "all") r.tDecide = t;
      hop(G.cards[r.seq % G.CARDS], HOP, 8);
    }
    r.segs = segs; r.end = Math.max(t, r.m.arrive); r.tArrive = t;
  }
  function along(segs, s) {
    for (const g of segs) if (s < g.t1) {
      const u = g.t1 > g.t0 ? Math.max(0, (s - g.t0) / (g.t1 - g.t0)) : 1;
      return [g.a[0] + (g.b[0] - g.a[0]) * u, g.a[1] + (g.b[1] - g.a[1]) * u, g.a[2] + (g.b[2] - g.a[2]) * u + (g.lift || 0) * Math.sin(Math.PI * u)];
    }
    return null;
  }

  function restart() {
    model = makeLive({ ...cfg, rate: LIVE_RATE }, seed++);
    clock = WARM; next = 0; active = []; slotFree = new Array(G.SLOTS).fill(-1); keptSeq = 0;
    seriesShown = 0; keptCount = 0; errSeen = 0; errKept = 0; reqCount = 0; holeHit = new Array(G.HOLES).fill(-9); cardReq = new Array(G.CARDS).fill(null);
    holes.forEach((h) => { h.removeAttribute("data-on"); h.removeAttribute("data-hit"); });
    cards.forEach((c) => { c.g.style.display = "none"; });
    const tail = cfg.sampling === "tail", head = cfg.sampling === "head10" || cfg.sampling === "head1";
    gates.head.parts.forEach((el) => { el.style.display = head ? "" : "none"; });
    gates.tail.parts.forEach((el) => { el.style.display = tail ? "" : "none"; });
    gates.head.text.textContent = cfg.sampling === "head10" ? "10%" : "1%";
    rackCover.style.display = tail ? "none" : "";
    model.runTo(clock);
    paint();
  }

  function paint() {
    model.runTo(clock);
    while (next < model.reqs.length && model.reqs[next].t <= clock) { const r = model.reqs[next++]; plan(r); active.push(r); reqCount++; }
    // things that happen when a token arrives
    for (const r of active) {
      if (!r.mDone && clock >= r.m.arrive) {
        r.mDone = true;
        if (r.first) seriesShown++;
        if (!r.m.over) { holeHit[r.idx] = r.m.arrive; if (r.first) holes[r.idx].setAttribute("data-on", ""); }
      }
      if (!r.decided && clock >= r.tDecide) { r.decided = true; if (r.err) errSeen++; }
      if (!r.tDone && !r.dropped && clock >= r.tArrive) {
        r.tDone = true; keptCount++; if (r.err) errKept++;
        cardReq[r.seq % G.CARDS] = r;
      }
    }
    active = active.filter((r) => clock < r.end);

    // tokens
    let mu = 0, tu = 0, buffer = 0;
    for (const r of active) {
      const s = clock - r.t;
      if (!r.mDone && mu < mPool.length) {
        let p;
        if (s < r.m.belt) p = [G.OUT_X + 2 + VM * s, G.MBELT.y, G.MBELT.z];
        else {
          const u = Math.min(1, (s - r.m.belt) / HOP);
          const to = r.m.over ? [G.BIN.x + G.BIN.w / 2, G.BIN.y + G.BIN.d / 2, G.BIN.h] : [r.m.xc, G.WALL_FRONT + 1.6, r.m.hole.z0 + 1.6];
          const from = [r.m.xc, G.MBELT.y, G.MBELT.z];
          p = [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, from[2] + (to[2] - from[2]) * u + Math.sin(Math.PI * u) * 7];
        }
        const t = mPool[mu++]; t.g.style.display = ""; if (t.kind !== "metric") { t.parts.metric.g.style.display = ""; t.kind = "metric"; }
        t.g.setAttribute("transform", translateAlong(P, p));
      }
      const p = r.tDone ? null : along(r.segs, clock);
      if (p && tu < tPool.length) {
        if (r.slotIn !== undefined && clock >= r.slotIn && clock < r.slotOut) buffer++;
        const t = tPool[tu++], kind = r.slow ? "tall" : "flat";
        t.g.style.display = "";
        if (t.kind !== kind) { if (t.kind) t.parts[t.kind].g.style.display = "none"; t.parts[kind].g.style.display = ""; t.kind = kind; }
        t.parts[kind].solid.toggleAttribute("data-lit", r.err);
        t.g.setAttribute("transform", translateAlong(P, p));
      }
    }
    for (let i = mu; i < mPool.length; i++) mPool[i].g.style.display = "none";
    for (let i = tu; i < tPool.length; i++) tPool[i].g.style.display = "none";

    // wall, bin, dial, drawer
    for (let i = 0; i < G.HOLES; i++) holes[i].toggleAttribute("data-hit", clock - holeHit[i] < 0.35);
    const overflow = Math.max(0, seriesShown - G.HOLES);
    const level = overflow ? Math.min(G.BIN_LEVELS, Math.ceil(Math.log10(overflow + 1) * 2.2)) : 0;
    bins.forEach((b, i) => { b.style.display = i + 1 === level ? "" : "none"; });
    const bytes = seriesShown * BYTES_PER_SERIES;
    const turn = bytes > 0 ? (Math.log10(bytes) - G.DIAL_SPAN.decades[0]) / (G.DIAL_SPAN.decades[1] - G.DIAL_SPAN.decades[0]) : 0;
    setD(needle, needleOf(turn));
    cardReq.forEach((r, s) => { const c = cards[s]; c.g.style.display = r ? "" : "none"; if (r) c.solid.toggleAttribute("data-lit", r.err); });

    showCount(dials.requests, reqCount); showCount(dials.series, seriesShown); showCount(dials.kept, keptCount); showCount(dials.errors, errSeen); showCount(dials.errorsKept, errKept);
    stat("requests", reqCount); stat("series", seriesShown); stat("memory", fmtBytes(bytes)); stat("kept", keptCount);
    stat("errors", L(errKept + " of " + errSeen, errKept + " de " + errSeen)); stat("buffer", cfg.sampling === "tail" ? buffer : "–");
    say(L(seriesShown + " series · " + fmtBytes(bytes) + (overflow ? " · wall full" : "") + " · errors kept " + errKept + " of " + errSeen,
      seriesShown + " series · " + fmtBytes(bytes) + (overflow ? " · pared llena" : "") + " · errores guardados " + errKept + " de " + errSeen));
  }
  function needleOf(turn) {
    const D = G.DIAL, a = G.DIAL_SPAN.from + Math.max(0, Math.min(1, turn)) * G.DIAL_SPAN.span;
    return lineOnTop([D.x - Math.sin(a) * 2, D.y + Math.cos(a) * 2], [D.x + Math.sin(a) * (D.r - 2.6), D.y - Math.cos(a) * (D.r - 2.6)], D.top + 0.2, P);
  }
  function fmtBytes(b) {
    const u = [["GB", 2 ** 30], ["MB", 2 ** 20], ["KB", 2 ** 10]];
    for (const [n, v] of u) if (b >= v) { const x = b / v; return (x < 10 ? x.toFixed(1) : int(x)) + " " + n; }
    return b + " B";
  }
  const stat = stats();

  const pause = pauseControls(stage, say);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; paint(); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    WB.pressSeg(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    if (name === "errors") cfg.errorRate = Number(raw); else cfg[name] = raw;
    if (!quiet) restart();
  }
  WB.onSegments((name, value) => set(name, value));
  act("reset").addEventListener("click", () => restart());

  // ---------- experiments (series counts and sampled hours computed at build time from the same model) ----------
  const RUNS = {
    status: () => {
      const a = RESULTS.base, b = RESULTS.status;
      return { verdict: T("16 series → " + int(b) + " (×" + one(b / a) + "), " + fmtBytes(seriesBytes(a)) + " → " + fmtBytes(seriesBytes(b)) + " of memory.",
          "16 series → " + int(b) + " (×" + one(b / a) + "), " + fmtBytes(seriesBytes(a)) + " → " + fmtBytes(seriesBytes(b)) + " de memoria."),
        bars: [["{method, route}", a / b, int(a) + " series"], ["{method, route, status}", 1, int(b) + " series", true]] };
    },
    user: () => {
      const a = RESULTS.status, h = RESULTS.user, d = RESULTS.userDay;
      return { verdict: T("After an hour: " + int(h) + " series (×" + int(h / a) + "), about " + fmtBytes(seriesBytes(h)) + ". After a day: " + int(d) + ", " + fmtBytes(seriesBytes(d)) + ". All for one counter.",
          "Después de una hora: " + int(h) + " series (×" + int(h / a) + "), unos " + fmtBytes(seriesBytes(h)) + ". Después de un día: " + int(d) + ", " + fmtBytes(seriesBytes(d)) + ". Todo para un solo contador."),
        bars: [[T("Without user_id", "Sin user_id"), a / d, int(a)], [T("With user_id, 1 hour", "Con user_id, 1 hora"), h / d, int(h), true], [T("With user_id, 1 day", "Con user_id, 1 día"), 1, int(d), true]] };
    },
    raw: () => {
      const t1 = RESULTS.statusDay, r1 = RESULTS.raw, r24 = RESULTS.rawDay;
      return { verdict: T("Template: " + int(t1) + " series after a day. Raw paths: " + int(r1) + " after an hour and " + int(r24) + " after a day (" + fmtBytes(seriesBytes(r24)) + "), still climbing.",
          "Plantilla: " + int(t1) + " series después de un día. Rutas crudas: " + int(r1) + " después de una hora y " + int(r24) + " después de un día (" + fmtBytes(seriesBytes(r24)) + "), y siguen subiendo."),
        bars: [[T("Template, 1 day", "Plantilla, 1 día"), t1 / r24, int(t1)], [T("Raw path, 1 hour", "Ruta cruda, 1 hora"), r1 / r24, int(r1), true], [T("Raw path, 1 day", "Ruta cruda, 1 día"), 1, int(r24), true]] };
    },
    head: () => {
      const hours = RESULTS.head12;
      const none = hours.filter((h) => h.rareKept === 0).length;
      const err = int(meanBy(hours, (h) => h.errors)), errK = one(meanBy(hours, (h) => h.errorsKept)), rare = one(meanBy(hours, (h) => h.rare)), rareK = one(meanBy(hours, (h) => h.rareKept));
      return { verdict: T("Per hour, on average: " + err + " errors, " + errK + " kept; " + rare + " rare failures, " + rareK + " kept. " + none + " of 12 hours kept no example of the rare bug.",
          "Por hora, en promedio: " + err + " errores, " + errK + " guardados; " + rare + " fallas raras, " + rareK + " guardadas. En " + none + " de 12 horas no se guardó ningún ejemplo del bug raro."),
        bars: [[T("Errors kept", "Errores guardados"), meanBy(hours, (h) => h.errorsKept / h.errors), T(errK + " of " + err, errK + " de " + err)], [T("Rare bug kept", "Bug raro guardado"), meanBy(hours, (h) => h.rareKept / Math.max(1, h.rare)), T(rareK + " of " + rare, rareK + " de " + rare), true], [T("Hours with no example", "Horas sin ningún ejemplo"), none / 12, T(none + " of 12", none + " de 12"), true]] };
    },
    tail: () => {
      const head = RESULTS.head6, tail = RESULTS.tail6;
      const hk = meanBy(head, (h) => h.kept), tk = meanBy(tail, (h) => h.kept);
      const ehk = one(meanBy(head, (h) => h.errorsKept)), etk = int(meanBy(tail, (h) => h.errorsKept)), et = int(meanBy(tail, (h) => h.errors));
      return { verdict: T("Traces stored per hour: " + int(hk) + " with head 1%, " + int(tk) + " with tail (×" + one(tk / hk) + "). Errors kept: " + ehk + " vs " + etk + " of " + et + ". The tail sampler holds about 1,000 traces at any moment (10 s each at 100/s) while it waits.",
          "Trazas almacenadas por hora: " + int(hk) + " con head 1%, " + int(tk) + " con tail (×" + one(tk / hk) + "). Errores guardados: " + ehk + " contra " + etk + " de " + et + ". El muestreador tail retiene unas 1,000 trazas en todo momento (10 s cada una a 100/s) mientras espera."),
        bars: [[T("Stored, head 1%", "Almacenadas, head 1%"), hk / tk, int(hk)], [T("Stored, tail", "Almacenadas, tail"), 1, int(tk), true], [T("Errors kept, head", "Errores guardados, head"), meanBy(head, (h) => h.errorsKept / h.errors), ehk], [T("Errors kept, tail", "Errores guardados, tail"), 1, etk, true]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    set("labels", w.labels, true); set("route", w.route, true); if (w.sampling) set("sampling", w.sampling, true);
    restart();
    if (loop.paused) loop.setPaused(false);
  } });

  loop.setPaused(loop.paused);
  restart();
}

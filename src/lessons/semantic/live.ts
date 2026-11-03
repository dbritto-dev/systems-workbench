// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The star-map table in the browser: chunks the help centre at the chosen size, lays it out, runs each query's
// search (an exact sweep or graph hops) step by step, and answers the controls. mount() gets the build-time data
// from page.ts (geometry, part drawings) and root, the <wb-lesson>.
import { translateAlong, depthOf, segment, lineSvg, ring } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L as tr } from "../../runtime/wb";   // L is taken by the layers below
import { playPause } from "../../runtime/dom";
import { smoothstep } from "../../lib/tween";
import { CONCEPTS, embed, chunk, exact, makeGraph, graphSearch, layout, QUERIES } from "./sim";

export default function mount({ P, G, STUD, LAMP_SVG, ARM_SVG, BEAD_SVG, LABEL_SVG }, root) {
  const CONCEPTS_ES = ["PAGOS", "DUPLICADOS", "REEMBOLSOS", "TIEMPO", "ACCESO", "SEGURIDAD", "ENVÍOS", "ERRORES", "API", "EXPORTACIÓN", "PLANES", "FACTURAS", "CUENTA", "MÓVIL", "ALERTAS", "SOPORTE"];
  const conceptName = (i) => tr(CONCEPTS[i], CONCEPTS_ES[i]);
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const say = (text) => root.figure.say(text);
  const layer = (n) => q('[data-layer="' + n + '"]');
  const L = { links: layer("links"), labels: layer("labels"), rings: layer("rings"), pins: layer("pins"), probe: layer("probe"), strings: layer("strings") };
  const make = (html) => { const g = document.createElementNS(NS, "g"); g.innerHTML = html; return g; };
  const counters = { compared: WB.counter(svg, "compared", P), total: WB.counter(svg, "total", P), sims: [0, 1, 2, 3, 4].map((i) => WB.counter(svg, "sim" + i, P)) };
  const queryText = q("[data-query]");
  const slots = [0, 1, 2, 3, 4].map((i) => ({ card: q('[data-card="' + i + '"]'), body: q('[data-card="' + i + '"] .iso-solid'), text: q('[data-card-text="' + i + '"]'), cut: q('[data-cut="' + i + '"]'), lid: q('[data-lid="' + i + '"]'), simbox: q('[data-simbox="' + i + '"]'), rank: q('[data-rank="' + i + '"]') }));

  // ---------- the collection at each chunk size: chunks, map positions, graph ----------
  const cache = {};
  function collection(size) {
    if (cache[size]) return cache[size];
    const ch = chunk(size), pos = layout(ch, G.FIELD, { gap: size === "doc" ? 17 : size === "section" ? 12 : 9 });
    const links = makeGraph(ch.map((c) => c.vec), 3, 7, 0);
    return (cache[size] = { size, ch, pos, links });
  }

  const lamp = make(LAMP_SVG), lampHead = lamp.querySelector("[data-head]");
  const arm = make(ARM_SVG), bead = make(BEAD_SVG), pathEl = make("");
  let pins = [], COL = null;

  function build(size) {
    COL = collection(size);
    for (const k of ["links", "labels", "rings", "pins", "probe", "strings"]) L[k].innerHTML = "";
    pins = COL.ch.map((c, i) => {
      const g = make(STUD[size]);
      g.setAttribute("transform", translateAlong(P, [COL.pos[i][0], COL.pos[i][1], 0]));
      return { g, body: g.querySelector("[data-body]"), rank: g.querySelector("[data-rank]"), depth: depthOf([COL.pos[i][0], COL.pos[i][1], 0], P) };
    });
    // links of the graph index, drawn once per size
    const seen = new Set(), d = [];
    COL.links.forEach((ls, i) => ls.forEach((j) => { const key = i < j ? i + "-" + j : j + "-" + i; if (seen.has(key)) return; seen.add(key); d.push(segment([COL.pos[i][0], COL.pos[i][1], G.MAP_H], [COL.pos[j][0], COL.pos[j][1], G.MAP_H], P)); }));
    L.links.innerHTML = lineSvg(d.join(""), { tone: "lo", dotted: true });
    placeLabels();
    counters.total.set(COL.ch.length);
  }

  // constellation names, placed for the page's language
  function placeLabels() {
    L.labels.innerHTML = "";
    const size = COL.size;
    // constellation names: the topics that lead at least two chunks, printed beside their cluster where
    // no stud and no other name sits
    const groups = {}, r = G.PIN[size].r, placed = [];
    COL.ch.forEach((c, i) => (groups[c.topic] ||= []).push(i));
    const F = G.FIELD, LS = G.LABEL_SIZE;
    const clash = (cx, cy, w) => {
      const x0 = cx - w / 2 - 1, x1 = cx + w / 2 + 1, y0 = cy - LS - 0.6, y1 = cy + 1;
      let bad = 0;
      if (x0 < F.x + 2 || x1 > F.x + F.w - 2 || y0 < F.y + 2 || y1 > F.y + F.d - 2) bad += 100;
      // a stud covers its own footprint and, on screen, the strip of map just behind it
      for (const p of COL.pos) for (const [ox, oy] of [[0, 0], [-1.5, -2.5], [-3, -5]]) { const px = p[0] + ox, py = p[1] + oy, nx = Math.max(x0, Math.min(px, x1)), ny = Math.max(y0, Math.min(py, y1)); if (Math.hypot(px - nx, py - ny) < r + 0.8) { bad += 10; break; } }
      for (const b of placed) if (x0 < b[1] && x1 > b[0] && y0 < b[3] && y1 > b[2]) bad += 50;
      return [bad, [x0, x1, y0, y1]];
    };
    Object.entries(groups).sort((a, b) => b[1].length - a[1].length).forEach(([t, idx]) => {
      if (idx.length < 2 && size !== "doc") return;
      const xs = idx.map((i) => COL.pos[i][0]), ys = idx.map((i) => COL.pos[i][1]);
      const cx = xs.reduce((a, b) => a + b, 0) / idx.length, cy = ys.reduce((a, b) => a + b, 0) / idx.length;
      const w = conceptName(t).length * LS * 0.62;
      const cands = [[cx, Math.max(...ys) + r + LS + 1.2], [cx, Math.min(...ys) - r - 1.4], [Math.min(...xs) - r - w / 2 - 1.5, cy + LS / 2], [Math.max(...xs) + r + w / 2 + 1.5, cy + LS / 2]];
      for (const dy of [4, 8]) cands.push([cx, Math.max(...ys) + r + LS + 1.2 + dy], [cx, Math.min(...ys) - r - 1.4 - dy]);
      let best = null;
      for (const [x, y] of cands) { const [bad, box] = clash(x, y, w); if (!best || bad < best[0]) best = [bad, x, y, box]; }
      if (best[0] >= 50) return;
      placed.push(best[3]);
      const g = make(LABEL_SVG);
      g.querySelector("[data-label]").textContent = conceptName(t);
      g.setAttribute("transform", translateAlong(P, [best[1], best[2], 0]));
      L.labels.appendChild(g);
    });
  }

  // ---------- one search ----------
  const cfg = { q: "twice", k: 3, size: "sentence", search: "exact", cut: 0, speed: 1 };
  const MOVE = 0.9, STEP = 0.06, HOLD = 5.5;
  let run = null, clock = 0, lampAt = null;

  function plan() {
    const query = QUERIES.find((x) => x.id === cfg.q), qv = embed(query.text);
    const ex = exact(qv, COL.ch, COL.ch.length).hits;
    let res, order, hops = [];
    if (cfg.search === "exact") { res = ex.slice(0, cfg.k); order = COL.ch.map((_, i) => i).sort((a, b) => COL.pos[a][0] - COL.pos[b][0]); }
    else { const r = graphSearch(qv, COL.ch.map((c) => c.vec), COL.links, { ef: cfg.search === "wide" ? cfg.k * 4 : cfg.k, k: cfg.k, entry: 0 }); res = r.hits; order = r.order; hops = r.hops; }
    const truth = ex.slice(0, cfg.k).map((h) => h.i);
    // the lamp stands among its three nearest, nudged off any stud
    const w = ex.slice(0, 3).map((h) => [h.i, Math.pow(Math.max(h.s, 0.01), 6)]), ws = w.reduce((s, [, x]) => s + x, 0);
    let at = [w.reduce((s, [i, x]) => s + COL.pos[i][0] * x, 0) / ws, w.reduce((s, [i, x]) => s + COL.pos[i][1] * x, 0) / ws];
    for (let it = 0; it < 30; it++) for (const p of COL.pos) { const dx = at[0] - p[0], dy = at[1] - p[1], d = Math.hypot(dx, dy) || 0.01, min = G.PIN[cfg.size].r + 4.5; if (d < min) { at[0] += dx / d * (min - d) * 0.6; at[1] += dy / d * (min - d) * 0.6; } }
    return { query, qv, res, order, hops, truth, at, from: lampAt || at, t0: clock, searchEnd: MOVE + order.length * STEP };
  }

  function start(fresh) {
    if (fresh) build(cfg.size);
    run = plan();
    queryText.textContent = run.query.text;
    L.strings.innerHTML = ""; L.rings.innerHTML = ""; L.probe.innerHTML = "";
    pathEl.innerHTML = ""; L.links.appendChild(pathEl);
    if (cfg.search === "exact") L.probe.appendChild(arm); else L.probe.appendChild(bead);
    L.links.style.display = cfg.search === "exact" ? "none" : "";
    run.shown = false;
  }

  // Light one element (dom.setLit lights every solid in a group), touching the DOM only when it changes.
  function lit(el, on) { if (el && el.hasAttribute("data-lit") !== on) el.toggleAttribute("data-lit", on); }

  function paint() {
    const t = clock - run.t0;
    // lamp glides to the query's place
    const e = smoothstep(Math.min(1, t / MOVE));
    lampAt = [run.from[0] + (run.at[0] - run.from[0]) * e, run.from[1] + (run.at[1] - run.from[1]) * e];
    lamp.setAttribute("transform", translateAlong(P, [lampAt[0], lampAt[1], 0]));
    // the search: compared so far, the arm or the bead
    const n = run.order.length, done = Math.max(0, Math.min(n, Math.floor((t - MOVE) / STEP) + 1));
    const searching = t >= MOVE && t < run.searchEnd, finished = t >= run.searchEnd;
    const flash = new Set();
    if (t >= MOVE) {
      if (cfg.search === "exact") {
        const x0 = G.FIELD.x, x1 = G.FIELD.x + G.FIELD.w, ax = x0 + (x1 - x0) * Math.min(1, (t - MOVE) / (n * STEP));
        arm.setAttribute("transform", translateAlong(P, [ax, 0, 0]));
        arm.style.display = finished ? "none" : "";
        run.order.forEach((i) => { if (Math.abs(COL.pos[i][0] - ax) < 5 && !finished) flash.add(i); });
      } else {
        const step = Math.min(n - 1, Math.max(0, (t - MOVE) / STEP)), i = Math.floor(step), frac = step - i;
        const a = i === 0 ? run.order[0] : run.hops[i - 1][0], b = i === 0 ? run.order[0] : run.hops[i - 1][1];
        const pa = COL.pos[a], pb = COL.pos[b];
        bead.setAttribute("transform", translateAlong(P, [pa[0] + (pb[0] - pa[0]) * frac, pa[1] + (pb[1] - pa[1]) * frac, 0]));
        bead.style.display = finished ? "none" : "";
        if (!finished) flash.add(b);
        const upto = finished ? run.hops.length : i;
        if (run.drawn !== upto) { run.drawn = upto; pathEl.innerHTML = lineSvg(run.hops.slice(0, upto).map(([a2, b2]) => segment([COL.pos[a2][0], COL.pos[a2][1], G.MAP_H + 0.1], [COL.pos[b2][0], COL.pos[b2][1], G.MAP_H + 0.1], P)).join(""), { tone: "hi" }); }
      }
    } else { arm.style.display = "none"; bead.style.display = "none"; }
    counters.compared.set(t < MOVE ? 0 : done);

    // results once the search is over
    const kept = finished ? run.res.filter((h) => h.s >= cfg.cut) : [];
    const keptSet = new Map(kept.map((h, r) => [h.i, run.res.indexOf(h) + 1]));
    pins.forEach((p, i) => {
      lit(p.body, flash.has(i) || keptSet.has(i));
      const r = keptSet.get(i); const txt = r ? String(r) : "";
      if (p.rank.textContent !== txt) p.rank.textContent = txt;
    });
    lit(lampHead, finished);
    if (finished && !run.shown) {
      run.shown = true;
      const top = G.LAMP_TOP;
      L.strings.innerHTML = lineSvg(kept.map((h) => segment([run.at[0], run.at[1], top], [COL.pos[h.i][0], COL.pos[h.i][1], G.MAP_H + G.PIN[cfg.size].h], P)).join(""), { tone: "hi" });
      const missed = run.truth.filter((i) => !run.res.some((h) => h.i === i));
      L.rings.innerHTML = missed.map((i) => lineSvg(ring(COL.pos[i][0], COL.pos[i][1], G.PIN[cfg.size].r + 2.4, G.MAP_H, P), { tone: "hi", dashed: true })).join("");
    }
    if (!finished && run.shown) { run.shown = false; L.strings.innerHTML = ""; L.rings.innerHTML = ""; }
    // the rack
    slots.forEach((s, r) => {
      const used = r < cfg.k;
      s.lid.style.display = used ? "none" : "";
      s.simbox.style.display = used ? "" : "none";
      s.rank.style.opacity = used ? "" : "0";
      const h = finished && used ? run.res[r] : null;
      s.card.style.display = h && h.s >= cfg.cut ? "" : "none";
      s.cut.style.display = h && h.s < cfg.cut ? "" : "none";
      if (h) { const id = COL.ch[h.i].id; if (s.text.textContent !== id) s.text.textContent = id; lit(s.body, r === 0 && h.s >= cfg.cut); }
      counters.sims[r].set(h ? Math.min(99, Math.round(h.s * 100)) : 0);
    });
    // pins and lamp in depth order
    const items = pins.map((p) => [p.depth, p.g]).concat([[depthOf([lampAt[0], lampAt[1], 0], P) + 0.001, lamp]]).sort((a, b) => a[0] - b[0]);
    let ok = L.pins.childNodes.length === items.length;
    if (ok) items.forEach(([, g], i) => { if (L.pins.childNodes[i] !== g) ok = false; });
    if (!ok) items.forEach(([, g]) => L.pins.appendChild(g));

    // stats and readout
    const best = run.res[0], found = run.truth.filter((i) => run.res.some((h) => h.i === i)).length;
    stat("query", "\u201c" + run.query.text + "\u201d");
    const of = tr(" of ", " de "), shownDone = t < MOVE ? 0 : done, miss = cfg.k - found;
    stat("top", finished ? COL.ch[best.i].id + " \u00b7 " + COL.ch[best.i].text : tr("searching", "buscando"));
    stat("sim", finished ? best.s.toFixed(2) : "-");
    stat("compared", shownDone + of + COL.ch.length);
    stat("kept", finished ? kept.length + of + cfg.k + (cfg.cut ? tr(" (cutoff ", " (umbral ") + cfg.cut.toFixed(2) + ")" : "") : "-");
    stat("recall", finished ? found + of + cfg.k : "-");
    if (t < MOVE) say(tr("embedding the query \u00b7 \u201c" + run.query.text + "\u201d", "calculando el embedding de la consulta \u00b7 \u201c" + run.query.text + "\u201d"));
    else if (searching) say(cfg.search === "exact"
      ? tr("comparing with every chunk \u00b7 " + done + " of " + COL.ch.length + " compared", "comparando con cada fragmento \u00b7 " + done + " de " + COL.ch.length + " comparados")
      : tr("hopping through the graph \u00b7 " + done + " of " + COL.ch.length + " compared", "saltando por el grafo \u00b7 " + done + " de " + COL.ch.length + " comparados"));
    else if (cfg.cut && kept.length < cfg.k) say(tr(kept.length + " of " + cfg.k + " above the cutoff \u00b7 best " + best.s.toFixed(2), kept.length + " de " + cfg.k + " sobre el umbral \u00b7 mejor " + best.s.toFixed(2)));
    else say(tr("top " + COL.ch[best.i].id + " \u00b7 " + best.s.toFixed(2) + " \u00b7 " + n + " compared" + (found < cfg.k ? " \u00b7 missed " + miss + " true neighbour" + (miss > 1 ? "s" : "") : ""),
      "primero " + COL.ch[best.i].id + " \u00b7 " + best.s.toFixed(2) + " \u00b7 " + n + " comparados" + (found < cfg.k ? (miss > 1 ? " \u00b7 se le escaparon " + miss + " vecinos reales" : " \u00b7 se le escapó 1 vecino real") : "")));
    if (t > run.searchEnd + HOLD) { next(); }
  }
  const stat = (key, value) => root.stat(key, value);

  function next() {
    const i = QUERIES.findIndex((x) => x.id === cfg.q);
    cfg.q = QUERIES[(i + 1) % QUERIES.length].id; root.press("q", cfg.q);
    start(false);
  }

  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; paint(); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = name === "k" || name === "cut" ? Number(raw) : raw;
    if (quiet) return;
    start(name === "size");
    if (loop.paused) { clock = run.t0 + run.searchEnd + 0.01; paint(); }
  }
  root.on("change", (name, value) => set(name, value));
  const actions = { next: () => { next(); if (loop.paused) { clock = run.t0 + run.searchEnd + 0.01; paint(); } } };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    const sizeChanged = w.size !== cfg.size;
    set("q", w.q, true); set("k", w.k, true); set("size", w.size, true); set("search", w.search, true); set("cut", w.cut, true);
    start(sizeChanged || !COL);
    if (loop.paused) loop.setPaused(false);
  });

  // first frame: the first query already answered, so a still page shows a finished search
  build(cfg.size);
  start(false);
  clock = run.searchEnd + 0.4;
  loop.setPaused(loop.paused);
  paint();
}

// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The assay bench in the browser: ranks the knowledge base for the chosen query, places the weights one term at a
// time and drops each term's discs into the pans of the top five, wires the controls and the experiment cards.
// mount() gets the build-time data from page.ts (geometry, experiment results).
import { solidSvg, lineSvg, faceTextSvg, sideMatrix, ring, cylinder, segment, translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L as tr, T } from "../../runtime/wb";   // L is taken by lineSvg below
import { readout, stats, act, pauseControls } from "../../runtime/dom";
import { clamp } from "../../lib/stats";
import { DOCS, QUERIES, makeIndex, rank } from "./sim";

export default function mount({ P, G, RESULTS, EXPERIMENTS }) {
  const stage = document.querySelector("[data-bench]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const say = readout();
  // The top-five list under the controls: Panel has no slot for it, so it goes in here, at the end of the panel.
  const resultsEl = document.createElement("div");
  resultsEl.className = "bm-results";
  resultsEl.setAttribute("data-results", "");
  resultsEl.setAttribute("aria-live", "polite");
  document.querySelector(".panel").append(resultsEl);
  const weightsEl = q("[data-weights]"), assayer = q("[data-assayer]");
  const queryEl = q("[data-query]"), corpusEl = q("[data-corpus]");
  const stacks = [0, 1, 2, 3, 4].map((i) => q('[data-stack="' + i + '"]'));
  const pans = [0, 1, 2, 3, 4].map((i) => q('[data-pan="' + i + '"] .iso-solid'));
  const docEls = [0, 1, 2, 3, 4].map((i) => q('[data-doc="' + i + '"]'));
  const intC = [0, 1, 2, 3, 4].map((i) => WB.counter(svg, "si" + i, P));
  const fracC = [0, 1, 2, 3, 4].map((i) => WB.counter(svg, "sf" + i, P));
  const lenM = [0, 1, 2, 3, 4].map((i) => WB.meter(svg, "len" + i, P));
  const QUERY_OF = Object.fromEntries(QUERIES);
  const TOUR = ["panic", "code", "printer", "para", "the"];

  // ---------- drawing helpers ----------
  const S = (paths, style) => solidSvg(paths, style);
  const L = (d, style) => lineSvg(d, style);
  const text = (xyz, t, size, tone, anchor = "middle") => faceTextSvg(sideMatrix([xyz[0], xyz[1]], xyz[2], P, "left"), t, { size, tone, anchor });
  const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const radiusOf = (idf) => 2.4 + 1.55 * Math.min(idf, 4.4);
  const DISC = 2.2;   // disc thickness per point of score

  // ---------- state ----------
  const cfg = { qid: "panic", q: QUERY_OF.panic, k1: 1.2, b: 0.75, speed: 1, stuff: false, tour: true };
  const T_CLEAR = 0.8, T_TERM = 1.4, T_HOLD = 3.6;
  let ix, plan, t, slots, total;

  function indexFor(stuff) {
    if (!stuff) return makeIndex(DOCS);
    return makeIndex(DOCS.map(([id, tx]) => id === "D16" ? [id, "Cheap " + "cheap ".repeat(19) + tx.slice(6)] : [id, tx]));
  }
  let IX_PLAIN = indexFor(false), IX_STUFF = null;

  function start(at = 0) {
    ix = cfg.stuff ? (IX_STUFF ||= indexFor(true)) : IX_PLAIN;
    plan = rank(ix, cfg.q, cfg.k1, cfg.b);
    plan.top = plan.rows.filter((r) => r.score > 0).slice(0, 5);
    const n = plan.terms.length;
    const [x0, x1] = G.SHELF_X, step = (x1 - x0) / n;
    slots = plan.terms.map((term, j) => ({ ...term, x: x0 + step * (j + 0.5), r: Math.min(radiusOf(term.idf), step / 2 - 2.4), w: step }));
    total = T_CLEAR + n * T_TERM + T_HOLD;
    t = at;
    queryEl.textContent = cfg.q;
    queryEl.setAttribute("font-size", cfg.q.length > 34 ? 3 : cfg.q.length > 26 ? 3.6 : 4.4);
    drawRack(-1);
    for (let i = 0; i < 5; i++) {
      const row = plan.top[i];
      docEls[i].textContent = row ? row.id : "—";
      lenM[i].set(row ? Math.min(1, row.len / (2 * ix.avg)) : 0);
    }
    words();
    paint();
  }

  // everything printed in words
  function words() {
    corpusEl.textContent = tr(ix.N + " documents · average " + ix.avg.toFixed(1) + " words · k1 " + cfg.k1 + " · b " + cfg.b + (cfg.stuff ? " · D16 stuffed" : ""),
      ix.N + " documentos · promedio " + ix.avg.toFixed(1) + " palabras · k1 " + cfg.k1 + " · b " + cfg.b + (cfg.stuff ? " · D16 rellenado" : ""));
    drawResults();
    const matched = plan.rows.filter((r) => r.score > 0).length;
    stat("terms", plan.terms.length);
    stat("matched", tr(matched + " of " + ix.N, matched + " de " + ix.N));
    stat("top", plan.top[0] ? plan.top[0].score.toFixed(2) : "0");
    stat("topdoc", plan.top[0] ? plan.top[0].id : tr("none", "ninguno"));
  }

  function drawRack(active) {
    const out = [];
    slots.forEach((s, j) => {
      const h = 1.2 + s.idf * 1.5;
      out.push(L(ring(s.x, G.SLOT_Y, s.r + 0.8, G.SHELF_TOP, P, 32), { tone: "faint" }));
      out.push(S(cylinder(s.x, G.SLOT_Y, s.r, G.SHELF_TOP, h, P, 36, 0.2), { tone: "hi", crease: "lo", lit: j === active }));
      out.push(S(cylinder(s.x, G.SLOT_Y, Math.min(1.3, s.r * 0.45), G.SHELF_TOP + h, 1.6, P, 16), { tone: "mid", crease: "none" }));
      const size = Math.max(1.5, Math.min(3, (s.w - 2) / (s.term.length * 0.62)));
      out.push(text([s.x, G.SHELF_FRONT, 5.4], s.term, size, "hi"));
      out.push(text([s.x, G.SHELF_FRONT, 1.7], "idf " + s.idf.toFixed(2), Math.min(2.1, size), "mid"));
      if (j > 0) out.push(L(segment([s.x - s.w / 2, G.SHELF_FRONT, 1], [s.x - s.w / 2, G.SHELF_FRONT, G.SHELF_TOP - 1], P), { tone: "faint" }));
    });
    weightsEl.innerHTML = out.join("");
    weightsEl.dataset.active = String(active);
  }

  function drawResults() {
    const terms = new Set(plan.terms.map((x) => x.term));
    const mark = (tx) => escapeHtml(tx).replace(/[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*/g, (w) => terms.has(w.toLowerCase()) ? "<mark>" + w + "</mark>" : w);
    const head = '<div class="head">' + tr("Top five for “" + escapeHtml(cfg.q) + "”, with each term’s part of the score", "Los cinco primeros para “" + escapeHtml(cfg.q) + "”, con lo que aporta cada término") + '</div>';
    if (!plan.top.length) { resultsEl.innerHTML = head + '<div class="none">' + tr("No document contains any of the query’s words.", "Ningún documento contiene alguna de las palabras de la consulta.") + '</div>'; return; }
    resultsEl.innerHTML = head + plan.top.map((r, i) => {
      const tx = r.id === "D16" && cfg.stuff ? "Cheap cheap cheap … (×20) " + r.text.slice(6) : r.text;
      const parts = r.parts.filter((p) => p.tf).map((p) => p.term + " ×" + p.tf + " → " + p.score.toFixed(2)).join(" · ");
      return '<div class="row"><span class="rk">#' + (i + 1) + '</span><span class="id">' + r.id + '</span><span class="tx">' + mark(tx) + '</span><span class="sc">' + r.score.toFixed(2) + '</span><span class="parts">' + escapeHtml(parts) + ' · ' + r.len + tr(" words", " palabras") + '</span></div>';
    }).join("");
  }

  // ---------- the weighing, as a function of time ----------
  const easeIn = (x) => x * x;
  let shownActive = null, shownKey = "";
  function paint() {
    const n = slots.length;
    const tt = t - T_CLEAR;
    const active = tt < 0 ? -1 : Math.min(n - 1, Math.floor(tt / T_TERM));
    const done = tt < 0 ? 0 : Math.min(n, Math.floor(tt / T_TERM + 0.0001));
    const inTerm = tt < 0 ? 0 : tt - active * T_TERM;
    const holding = tt >= n * T_TERM;
    const drop = holding ? 1 : clamp((inTerm - 0.35) / 0.7);
    const live = holding ? -1 : active;
    if (shownActive !== live) { shownActive = live; drawRack(live); }

    // the assayer walks to the weight being placed
    const tx = live >= 0 ? slots[live].x : (holding ? slots[n - 1].x : slots[0].x);
    const walk = live >= 0 ? clamp(inTerm / 0.35) : 1;
    const from = live > 0 ? slots[live - 1].x : slots[0].x;
    const x = from + (tx - from) * (1 - (1 - walk) ** 2);
    assayer.setAttribute("transform", translateAlong(P, [x - G.SLOT0, 0, 0]));

    // stacks: every term already placed, plus the one falling
    const fade = tt < 0 ? clamp(-tt / T_CLEAR) : 1;
    const key = [active, Math.round(drop * 40), holding, Math.round(fade * 20)].join();
    if (key !== shownKey) {
      shownKey = key;
      for (let i = 0; i < 5; i++) {
        const row = plan.top[i];
        const out = [];
        let z = G.STACK_Z, sum = 0;
        if (row && tt >= 0) {
          for (let j = 0; j <= Math.min(active, n - 1); j++) {
            const p = row.parts[j];
            if (!p.tf || p.score <= 0) continue;
            const h = Math.max(0.5, p.score * DISC);
            const falling = j === active && !holding;
            const lift = falling ? (1 - easeIn(drop)) * 18 : 0;
            if (falling && drop <= 0) continue;
            const s = slots[j];
            const svgDisc = S(cylinder(G.CX[i], G.CY, s.r, z + lift, h, P, 36, 0.15), { tone: "hi", crease: "lo", lit: falling || (j === active && inTerm < T_TERM) && !holding });
            const label = h >= 2.6 ? text([G.CX[i], G.CY + s.r, z + lift + h / 2 - 0.9], "×" + p.tf, Math.min(2.6, h * 0.62), falling ? "on-lit" : "hi") : "";
            out.push('<g class="wb-lit-group"' + (falling ? ' style="opacity:' + Math.min(1, drop * 3).toFixed(2) + '"' : "") + ">" + svgDisc + label + "</g>");
            z += h;
            if (!falling || drop >= 1) sum += p.score;
          }
        }
        stacks[i].innerHTML = out.join("");
        stacks[i].style.opacity = tt < 0 ? String(1 - fade) : "";
        const shown = tt < 0 ? 0 : sum;
        const tenths = Math.round(Math.min(99.9, shown) * 10);
        intC[i].set(Math.floor(tenths / 10)); fracC[i].set(tenths % 10);
      }
    }
    pans.forEach((p, i) => p.toggleAttribute("data-lit", holding && i === 0 && !!plan.top[0]));

    if (tt < 0) say(tr("clearing the pans · next query: “" + cfg.q + "”", "vaciando los platillos · siguiente consulta: “" + cfg.q + "”"));
    else if (!holding) {
      const s = slots[active], hits = plan.top.filter((r) => r.parts[active].tf).length;
      const all = plan.rows.filter((r) => r.parts[active].tf).length;
      say(tr("weighing “" + s.term + "” · idf " + s.idf.toFixed(2) + " · in " + all + " of " + ix.N + " documents" + (hits ? " · " + hits + " of the top five" : ""),
        "pesando “" + s.term + "” · idf " + s.idf.toFixed(2) + " · en " + all + " de " + ix.N + " documentos" + (hits ? " · " + hits + " de los cinco primeros" : "")));
    } else say(plan.top[0] ? tr("ranked · " + plan.top[0].id + " first with " + plan.top[0].score.toFixed(2), "ordenado · " + plan.top[0].id + " primero con " + plan.top[0].score.toFixed(2)) : tr("ranked · no document matched", "ordenado · ningún documento coincidió"));
  }
  const stat = stats();

  const stuffBtn = act("stuff");
  const pause = pauseControls(stage, say);
  const loop = WB.loop({ stage, step: (dt) => {
    t += dt * cfg.speed;
    if (t >= total) {
      if (cfg.tour) { const k = (TOUR.indexOf(cfg.qid) + 1) % TOUR.length; setQuery(TOUR[k], true); }
      start(0);
    } else paint();
  }, onPause: pause.onPause });

  function setQuery(id, fromTour) {
    cfg.qid = id; cfg.q = QUERY_OF[id] || id;
    if (!fromTour) cfg.tour = false;
    WB.pressSeg("q", QUERY_OF[id] ? id : "");
  }
  function set(name, raw) {
    WB.pressSeg(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    if (name === "q") { setQuery(raw); start(0); return; }
    cfg[name] = Number(raw);
    cfg.tour = false;
    start(0);
  }
  WB.onSegments((name, value) => set(name, value));
  function stuffLabel() { stuffBtn.textContent = cfg.stuff ? tr("Un-stuff D16", "Quitar el relleno de D16") : tr("Stuff “cheap” ×20 into D16", "Rellenar D16 con “cheap” ×20"); }
  function setStuff(on) { cfg.stuff = on; stuffLabel(); }
  stuffBtn.addEventListener("click", () => { setStuff(!cfg.stuff); cfg.tour = false; if (!cfg.stuff || cfg.qid === "cheap") start(0); else { setQuery("cheap"); start(0); } if (loop.paused) loop.setPaused(false); });
  act("again").addEventListener("click", () => { start(0); if (loop.paused) loop.setPaused(false); });
  act("reset").addEventListener("click", () => { setStuff(false); cfg.k1 = 1.2; cfg.b = 0.75; WB.pressSeg("k1", "1.2"); WB.pressSeg("b", "0.75"); cfg.tour = true; setQuery("panic", true); start(WARM); });
  pause.bind(loop);

  // ---------- experiments (numbers computed at build time from the same model) ----------
  const n2 = (x) => x.toFixed(2);
  const RUNS = {
    rare: () => {
      const r = RESULTS.rare, top = r.idfPrinter;
      return { verdict: T("IDF of “the” (in all " + r.N + " documents): " + n2(r.idfThe) + ". IDF of “printer” (in " + r.dfPrinter + "): " + n2(r.idfPrinter) + ". D35 scored " + n2(r.guideScore) + " with " + r.guideThe + " matches and ranked " + r.guideRank + "th; D06 scored " + n2(r.d06Score) + " and ranked " + r.d06Rank + "rd.",
          "IDF de “the” (en los " + r.N + " documentos): " + n2(r.idfThe) + ". IDF de “printer” (en " + r.dfPrinter + "): " + n2(r.idfPrinter) + ". D35 sumó " + n2(r.guideScore) + " con " + r.guideThe + " coincidencias y quedó en el puesto " + r.guideRank + "; D06 sumó " + n2(r.d06Score) + " y quedó en el puesto " + r.d06Rank + "."),
        bars: [[T("IDF of “the”", "IDF de “the”"), r.idfThe / top, n2(r.idfThe)], [T("IDF of “printer”", "IDF de “printer”"), 1, n2(r.idfPrinter), true], [T("D35 score (17 × “the”)", "Puntaje de D35 (17 × “the”)"), r.guideScore / r.d06Score, n2(r.guideScore)], [T("D06 score (1 × “printer”)", "Puntaje de D06 (1 × “printer”)"), 1, n2(r.d06Score), true]] };
    },
    stuff: () => {
      const s = RESULTS.stuff, top = s.k3[5].s;
      const at = (c, n) => c.find((p) => p.n === n).s;
      return { verdict: T("With k1 = 1.2 the “cheap” part went " + n2(at(s.k12, 1)) + " (once) → " + n2(at(s.k12, 5)) + " (5 times) → " + n2(at(s.k12, 20)) + " (20 times): " + (at(s.k12, 20) / at(s.k12, 1)).toFixed(1) + "×, against a ceiling of " + n2(s.cap12) + ". With k1 = 0 it stayed " + n2(at(s.k0, 20)) + "; with k1 = 3 it reached " + n2(at(s.k3, 20)) + ".",
          "Con k1 = 1.2 la parte de “cheap” pasó de " + n2(at(s.k12, 1)) + " (una vez) a " + n2(at(s.k12, 5)) + " (5 veces) y a " + n2(at(s.k12, 20)) + " (20 veces): " + (at(s.k12, 20) / at(s.k12, 1)).toFixed(1) + "×, frente a un techo de " + n2(s.cap12) + ". Con k1 = 0 se quedó en " + n2(at(s.k0, 20)) + "; con k1 = 3 llegó a " + n2(at(s.k3, 20)) + "."),
        bars: [[T("k1 1.2, once", "k1 1.2, una vez"), at(s.k12, 1) / top, n2(at(s.k12, 1))], [T("k1 1.2, 5 times", "k1 1.2, 5 veces"), at(s.k12, 5) / top, n2(at(s.k12, 5))], [T("k1 1.2, 20 times", "k1 1.2, 20 veces"), at(s.k12, 20) / top, n2(at(s.k12, 20)), true], [T("k1 0, 20 times", "k1 0, 20 veces"), at(s.k0, 20) / top, n2(at(s.k0, 20))], [T("k1 3, 20 times", "k1 3, 20 veces"), at(s.k3, 20) / top, n2(at(s.k3, 20))]] };
    },
    length: () => {
      const l = RESULTS.length, top = l.b1.short;
      return { verdict: T("b = 0: both " + n2(l.b0.short) + ". b = 0.75: D03 " + n2(l.b75.short) + ", D36 " + n2(l.b75.long) + " (" + l.b75.ratio.toFixed(1) + "×). b = 1: D03 " + n2(l.b1.short) + ", D36 " + n2(l.b1.long) + " (" + l.b1.ratio.toFixed(1) + "×).",
          "b = 0: ambos " + n2(l.b0.short) + ". b = 0.75: D03 " + n2(l.b75.short) + ", D36 " + n2(l.b75.long) + " (" + l.b75.ratio.toFixed(1) + "×). b = 1: D03 " + n2(l.b1.short) + ", D36 " + n2(l.b1.long) + " (" + l.b1.ratio.toFixed(1) + "×)."),
        bars: [[T("D03, " + l.lenShort + " words, b 0.75", "D03, " + l.lenShort + " palabras, b 0.75"), l.b75.short / top, n2(l.b75.short), true], [T("D36, " + l.lenLong + " words, b 0.75", "D36, " + l.lenLong + " palabras, b 0.75"), l.b75.long / top, n2(l.b75.long), true], [T("Either, b 0", "Cualquiera, b 0"), l.b0.short / top, n2(l.b0.short)], ["D36, b 1", l.b1.long / top, n2(l.b1.long)]] };
    },
    exact: () => {
      const e = RESULTS.exact, top = Math.max(e.codeScore, e.paraTopScore);
      return { verdict: T("“ERR_CONNECTION_RESET”: D08 ranked " + e.codeRank + "st with " + n2(e.codeScore) + "; the next document scored " + n2(e.codeNext) + ". The description: D08 ranked " + e.paraRank + "th with " + n2(e.paraScore) + " (it shares only “" + e.paraShared.join("”, “") + "”); " + e.paraTop + " came first with " + n2(e.paraTopScore) + ".",
          "“ERR_CONNECTION_RESET”: D08 quedó en el puesto " + e.codeRank + " con " + n2(e.codeScore) + "; el documento siguiente sumó " + n2(e.codeNext) + ". La descripción: D08 quedó en el puesto " + e.paraRank + " con " + n2(e.paraScore) + " (solo comparte “" + e.paraShared.join("”, “") + "”); " + e.paraTop + " quedó primero con " + n2(e.paraTopScore) + "."),
        bars: [[T("D08, error code query", "D08, consulta con el código de error"), e.codeScore / top, n2(e.codeScore), true], [T("D08, description query", "D08, consulta con la descripción"), e.paraScore / top, n2(e.paraScore), true], [T(e.paraTop + " (wrong), description query", e.paraTop + " (incorrecto), consulta con la descripción"), e.paraTopScore / top, n2(e.paraTopScore)]] };
    },
    stop: () => {
      const s = RESULTS.stop;
      return { verdict: T("Top five with and without “the”: " + (s.same ? "identical" : "different") + " (" + s.order.join(", ") + "). Top score " + n2(s.topA) + " → " + n2(s.topB) + ". IDF of “the”: " + n2(s.idfThe) + "; of “kernel”: " + n2(s.idfKernel) + ".",
          "Los cinco primeros con y sin “the”: " + (s.same ? "idénticos" : "distintos") + " (" + s.order.join(", ") + "). Puntaje más alto " + n2(s.topA) + " → " + n2(s.topB) + ". IDF de “the”: " + n2(s.idfThe) + "; de “kernel”: " + n2(s.idfKernel) + "."),
        bars: [[T("Top score, “kernel panic”", "Puntaje más alto, “kernel panic”"), s.topA / s.topB, n2(s.topA)], [T("Top score, “the kernel panic”", "Puntaje más alto, “the kernel panic”"), 1, n2(s.topB), true], [T("IDF of “the”", "IDF de “the”"), s.idfThe / s.idfKernel, n2(s.idfThe)], [T("IDF of “kernel”", "IDF de “kernel”"), 1, n2(s.idfKernel)]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    cfg.tour = false;
    setStuff(!!w.stuff);
    cfg.k1 = Number(w.k1); cfg.b = Number(w.b); WB.pressSeg("k1", w.k1); WB.pressSeg("b", w.b);
    const id = Object.keys(QUERY_OF).find((k) => QUERY_OF[k] === w.q);
    if (id) setQuery(id); else { cfg.qid = w.q; cfg.q = w.q; WB.pressSeg("q", ""); }
    start(0);
    if (loop.paused) loop.setPaused(false);
  } });

  // the first frame: a minute's worth of weighing already under way, the third term falling into the pans
  const WARM = T_CLEAR + 2 * T_TERM + 0.85;
  loop.setPaused(loop.paused);
  start(WARM);
}

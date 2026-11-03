// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The assay bench in the browser: ranks the knowledge base for the chosen query, places the weights one term at a
// time and drops each term's discs into the pans of the top five, and answers the controls. mount() gets the
// build-time data from page.ts (geometry) and root, the <wb-lesson>.
import { solidSvg, lineSvg, faceTextSvg, sideMatrix, ring, cylinder, segment, translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L as tr } from "../../runtime/wb";   // L is taken by lineSvg below
import { playPause } from "../../runtime/dom";
import { clamp } from "../../lib/stats";
import { DOCS, QUERIES, makeIndex, rank } from "./sim";

export default function mount({ P, G }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  // The top-five list under the controls: Panel has no slot for it, so it goes in here, at the end of the panel.
  const resultsEl = document.createElement("div");
  resultsEl.className = "bm-results";
  resultsEl.setAttribute("data-results", "");
  resultsEl.setAttribute("aria-live", "polite");
  root.$(".panel").append(resultsEl);
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
  const stat = (key, value) => root.stat(key, value);

  const stuffBtn = root.button("stuff");
  const pause = playPause(root);
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
    root.press("q", QUERY_OF[id] ? id : "");
  }
  function set(name, raw) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    if (name === "q") { setQuery(raw); start(0); return; }
    cfg[name] = Number(raw);
    cfg.tour = false;
    start(0);
  }
  root.on("change", (name, value) => set(name, value));
  function stuffLabel() { stuffBtn.textContent = cfg.stuff ? tr("Un-stuff D16", "Quitar el relleno de D16") : tr("Stuff “cheap” ×20 into D16", "Rellenar D16 con “cheap” ×20"); }
  function setStuff(on) { cfg.stuff = on; stuffLabel(); }
  const actions = {
    stuff: () => { setStuff(!cfg.stuff); cfg.tour = false; if (!cfg.stuff || cfg.qid === "cheap") start(0); else { setQuery("cheap"); start(0); } if (loop.paused) loop.setPaused(false); },
    again: () => { start(0); if (loop.paused) loop.setPaused(false); },
    reset: () => { setStuff(false); cfg.k1 = 1.2; cfg.b = 0.75; root.press("k1", "1.2"); root.press("b", "0.75"); cfg.tour = true; setQuery("panic", true); start(WARM); },
  };
  root.on("action", (name) => actions[name]?.());
  pause.bind(loop);

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    cfg.tour = false;
    setStuff(!!w.stuff);
    cfg.k1 = Number(w.k1); cfg.b = Number(w.b); root.press("k1", w.k1); root.press("b", w.b);
    const id = Object.keys(QUERY_OF).find((k) => QUERY_OF[k] === w.q);
    if (id) setQuery(id); else { cfg.qid = w.q; cfg.q = w.q; root.press("q", ""); }
    start(0);
    if (loop.paused) loop.setPaused(false);
  });

  // the first frame: a minute's worth of weighing already under way, the third term falling into the pans
  const WARM = T_CLEAR + 2 * T_TERM + 0.85;
  loop.setPaused(loop.paused);
  start(WARM);
}

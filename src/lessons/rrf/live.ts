// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The count room in the browser: plans the clerk's walk over the ballots, flies a token per vote into its tube,
// keeps the standings, and wires the controls and the experiment cards. mount() gets the build-time data from
// page.ts (geometry, part drawings, results).
import { translateAlong, solidSvg, cylinder } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L as tr, T } from "../../runtime/wb";
import { readout, stats, act, pauseControls } from "../../runtime/dom";
import { lerpVec, smoothstep } from "../../lib/tween";
import { QUERY, JUDGES, countOrder, pointsOf, rrfShare } from "./sim";

export default function mount({ P, G, CLERK_SVG, FLIGHT_SVG, RESULTS, EXPERIMENTS }) {
  const NAME_ES = { keyword: "PALABRAS", meaning: "SIGNIFICADO", clicks: "CLICS" };            // as on the ballot boards
  const LIST_ES = { keyword: "palabras clave", meaning: "significado", clicks: "clics" };
  const stage = document.querySelector("[data-count]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const say = readout();
  const NS = "http://www.w3.org/2000/svg";

  // the clerk: a pooled group moved with translateAlong
  const clerk = document.createElementNS(NS, "g");
  clerk.innerHTML = CLERK_SVG;
  q('[data-layer="clerk"]').appendChild(clerk);
  const flight = document.createElementNS(NS, "g");
  flight.innerHTML = FLIGHT_SVG;
  q('[data-layer="flight"]').appendChild(flight);

  const counters = Object.fromEntries(G.DOC_IDS.map((id) => [id, WB.counter(svg, "pts-" + id, P)]));
  const stacks = Object.fromEntries(G.DOC_IDS.map((id) => [id, q('[data-stack="' + id + '"]')]));
  const caps = Object.fromEntries(G.DOC_IDS.map((id) => [id, q('[data-cap="' + id + '"]')]));
  const kDial = WB.dial(svg, "k", P);
  const judgeEl = Object.fromEntries(JUDGES.map((j) => [j, q('[data-judge="' + j + '"]')]));
  const weightText = Object.fromEntries(JUDGES.map((j) => [j, q('[data-weight="' + j + '"]')]));
  const modeSolid = q("[data-mode] .iso-solid"), modeText = q("[data-mode-text]");
  const places = [1, 2, 3, 4, 5].map((p) => ({ solid: q('[data-place="' + p + '"] .iso-solid'), id: q('[data-place-id="' + p + '"]'), pts: q('[data-place-pts="' + p + '"]') }));
  const cardEl = (j, r) => q('[data-card="' + j + "-" + r + '"]');
  const cardSolid = (j, r) => q('[data-card="' + j + "-" + r + '"] .iso-solid');

  const cfg = { mode: "rrf", k: 60, judges: 2, weight: 1, depth: 8, speed: 1 };
  const WALK = 120, PICK = 0.35, FLY = 0.85, HOLD = 5;
  let plan, clock, shown = {};

  function use() { return cfg.judges === 3 ? JUDGES : JUDGES.slice(0, 2); }
  function weightOf(j) { return j === "clicks" ? cfg.weight : 1; }

  // the schedule: walk to the ballot, pick the card, fly the token to its tube
  function makePlan() {
    const votes = countOrder(QUERY.lists, { depth: cfg.depth, use: use() }).map((v) => ({ ...v, w: weightOf(v.list), pts: pointsOf(v, { k: cfg.k, mode: cfg.mode, w: weightOf(v.list) }), add: cfg.mode === "raw" ? weightOf(v.list) * v.raw : rrfShare(v.rank, cfg.k, weightOf(v.list)) }));
    let t = 0, pos = G.AT.home;
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    for (const v of votes) {
      const ballot = G.AT.ballot[v.list];
      v.t0 = t; v.from = pos; v.ballot = ballot;
      v.t1 = t + dist(pos, ballot) / WALK; v.t2 = v.t1 + PICK; v.t4 = v.t2 + FLY;
      v.src = G.CARD_AT[v.list + v.rank];
      v.dst = [G.TUBE_X[G.DOC_IDS.indexOf(v.id)], G.TUBE_Y, 0];
      t = v.t4; pos = ballot;
    }
    return { votes, end: t };
  }

  function restart(at) {
    plan = makePlan();
    clock = at ?? plan.end * 0.55;
    shown = {};
    for (const j of JUDGES) {
      judgeEl[j].toggleAttribute("data-off", !use().includes(j));
      for (let r = 1; r <= G.SLOTS; r++) q('[data-slot="' + j + "-" + r + '"]').toggleAttribute("data-hidden", r > cfg.depth);
    }
    modeSolid.toggleAttribute("data-lit", cfg.mode === "raw");
    plaques();
    kDial.set(Math.log10(cfg.k) / 3);
    paint();
  }

  // the words on the weight and mode plaques
  function plaques() {
    for (const j of JUDGES) weightText[j].textContent = use().includes(j) ? "×" + weightOf(j) : tr("off", "fuera");
    modeText.textContent = cfg.mode === "raw" ? tr("raw scores added", "puntajes sumados") : tr("1 / (k + rank)", "1 / (k + puesto)");
  }

  const fmtScore = (x) => cfg.mode === "raw" ? x.toFixed(1) : x.toFixed(5);

  function tokenSvg(tx, z, h, tone, lit) {
    return solidSvg(cylinder(tx, G.TUBE_Y, G.COL.r, z, Math.max(0.35, h), P, 24, Math.min(0.3, h / 4)), { tone, crease: "lo", lit });
  }

  function paint() {
    const votes = plan.votes;
    const t = Math.min(clock, plan.end);
    const done = votes.filter((v) => v.t4 <= t);
    const cur = votes.find((v) => v.t4 > t) || null;
    const perDone = {};
    for (const v of done) perDone[v.id] = (perDone[v.id] || 0) + v.pts;

    // the clerk walks the ballots; once a card is picked, its token flies in an arc to the tube
    let pos = G.AT.home;
    if (cur) pos = t < cur.t1 ? lerpVec(cur.from, cur.ballot, (t - cur.t0) / Math.max(1e-6, cur.t1 - cur.t0)) : cur.ballot;
    else if (votes.length) pos = votes[votes.length - 1].ballot;
    clerk.setAttribute("transform", translateAlong(P, pos));
    if (cur && t >= cur.t2) {
      const f = Math.min(1, (t - cur.t2) / FLY), e = smoothstep(f);
      const stackTop = G.COL.z0 + Math.min(G.COL.top - G.COL.z0, (perDone[cur.id] || 0) * G.SCALE);
      const x = cur.src[0] + (cur.dst[0] - cur.src[0]) * e, y = cur.src[1] + (cur.dst[1] - cur.src[1]) * e;
      const z = cur.src[2] + (stackTop - cur.src[2]) * e + Math.sin(Math.PI * f) * 26;
      flight.setAttribute("transform", translateAlong(P, [x, y, z]));
      flight.style.display = "";
    } else flight.style.display = "none";

    // ballot cards: counted ones fade, the one in hand is lit
    for (const j of JUDGES) for (let r = 1; r <= G.SLOTS; r++) {
      const counted = done.some((v) => v.list === j && v.rank === r);
      const now = cur && cur.list === j && cur.rank === r && t >= cur.t1;
      const key = j + r, state = now ? "lit" : counted ? "done" : "wait";
      if (shown[key] !== state) { shown[key] = state; cardEl(j, r).toggleAttribute("data-counted", state === "done"); cardSolid(j, r).toggleAttribute("data-lit", state === "lit"); }
    }

    // tubes: one token per counted vote, newest lit for a moment
    const per = Object.fromEntries(G.DOC_IDS.map((id) => [id, []]));
    for (const v of done) per[v.id].push(v);
    for (const id of G.DOC_IDS) {
      const vs = per[id], last = vs[vs.length - 1];
      const fresh = last && t - last.t4 < 0.8;
      const key = "s" + id, sig = vs.length + (fresh ? "*" : "") + cfg.mode + cfg.k;
      if (shown[key] === sig) continue;
      shown[key] = sig;
      const tx = G.TUBE_X[G.DOC_IDS.indexOf(id)];
      let z = G.COL.z0, html = "", over = false;
      vs.forEach((v, n) => {
        let h = v.pts * G.SCALE;
        if (z + h > G.COL.top) { h = G.COL.top - z; over = true; }
        if (h > 0.05) html += tokenSvg(tx, z, h, G.JUDGE_TONE[v.list], fresh && n === vs.length - 1);
        z += h;
      });
      stacks[id].innerHTML = html;
      caps[id].style.display = over ? "" : "none";
      counters[id].set(Math.round(vs.reduce((a, v) => a + v.pts, 0)));
    }

    // standings over what has been counted so far
    const tally = new Map();
    for (const v of done) { const e = tally.get(v.id) || { id: v.id, score: 0, pts: 0, best: 99 }; e.score += v.add; e.pts += v.pts; e.best = Math.min(e.best, v.rank); tally.set(v.id, e); }
    const order = [...tally.values()].sort((a, b) => b.score - a.score || a.best - b.best || Number(a.id.slice(1)) - Number(b.id.slice(1)));
    places.forEach((p, i) => {
      const e = order[i], txt = e ? e.id : "–", pts = e ? Math.round(e.pts) + " pts" : "";
      if (p.id.textContent !== txt) p.id.textContent = txt;
      if (p.pts.textContent !== pts) p.pts.textContent = pts;
      p.solid.toggleAttribute("data-lit", i === 0 && !!e);
    });

    // stats and readout
    stat("counted", done.length + " / " + votes.length);
    stat("leader", order[0] ? order[0].id : "–");
    stat("score", order[0] ? fmtScore(order[0].score) : "–");
    stat("rel", order.slice(0, 5).filter((e) => QUERY.docs[e.id].rel > 0).length + tr(" of ", " de ") + Math.min(5, order.length));
    stat("first", cfg.mode === "raw" ? tr("its own score", "su propio puntaje") : "1/" + (cfg.k + 1) + " = " + (1 / (cfg.k + 1)).toFixed(4));
    stat("eighth", cfg.mode === "raw" ? "–" : Math.round(100 * (cfg.k + 1) / (cfg.k + 8)) + "%");
    if (cur && t >= cur.t1) {
      const name = tr(cur.list.toUpperCase(), NAME_ES[cur.list]);
      const rawShown = cur.list === "meaning" ? cur.raw.toFixed(2) : cur.raw;
      const share = (cur.w !== 1 ? cur.w + " × " : "") + "1/(" + cfg.k + " + " + cur.rank + ") = " + cur.add.toFixed(5);
      const worth = cfg.mode === "raw" ? tr("adds its raw score " + rawShown, "suma su puntaje crudo " + rawShown) : tr("adds ", "suma ") + share;
      say(name + " #" + cur.rank + " · " + cur.id + " “" + QUERY.docs[cur.id].title + "” · " + worth);
    } else if (!cur) say(tr("count done · " + (order[0] ? order[0].id + " leads with " + fmtScore(order[0].score) : "") + " · counting again shortly",
      "conteo terminado · " + (order[0] ? order[0].id + " lidera con " + fmtScore(order[0].score) : "") + " · se vuelve a contar en un momento"));
    else say(tr("walking to the " + cur.list + " ballot for rank " + cur.rank, "caminando a la boleta de " + LIST_ES[cur.list] + " para el puesto " + cur.rank));
  }
  const stat = stats();

  const pause = pauseControls(stage, say);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; if (clock > plan.end + HOLD) restart(0); else paint(); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    WB.pressSeg(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = ["k", "judges", "weight", "depth"].includes(name) ? Number(raw) : raw;
    if (!quiet) restart(0);
  }
  WB.onSegments((name, value) => set(name, value));
  act("finish").addEventListener("click", () => { clock = plan.end; paint(); });
  act("reset").addEventListener("click", () => { restart(0); if (loop.paused) loop.setPaused(false); });

  // ---------- experiments (numbers computed from the same model at build time) ----------
  const f1 = (x) => x.toFixed(1), f5 = (x) => x.toFixed(5);
  const RUNS = {
    scales: () => {
      const s = RESULTS.scales;
      return { verdict: T("Relevant documents in the top 10, averaged over 40 queries: raw sum " + f1(s.raw) + ", keyword alone " + f1(s.kwOnly) + ", meaning alone " + f1(s.meOnly) + ", RRF " + f1(s.rrf) + ". " + f1(s.sameAsKeyword) + " of the raw sum's top 10 were simply the keyword top 10. On the figure's query the raw sum's top 5 is " + s.figure.raw.join(" ") + " (" + s.figure.rawHits + " relevant); RRF's is " + s.figure.rrf.join(" ") + " (" + s.figure.rrfHits + " relevant).",
          "Documentos relevantes en el top 10, en promedio sobre 40 consultas: suma cruda " + f1(s.raw) + ", solo palabras clave " + f1(s.kwOnly) + ", solo significado " + f1(s.meOnly) + ", RRF " + f1(s.rrf) + ". " + f1(s.sameAsKeyword) + " de los 10 primeros de la suma cruda eran simplemente los 10 primeros de palabras clave. En la consulta de la figura, el top 5 de la suma cruda es " + s.figure.raw.join(" ") + " (" + s.figure.rawHits + " relevantes); el de RRF es " + s.figure.rrf.join(" ") + " (" + s.figure.rrfHits + " relevantes)."),
        bars: [[T("Keyword alone", "Solo palabras clave"), s.kwOnly / 10, f1(s.kwOnly)], [T("Meaning alone", "Solo significado"), s.meOnly / 10, f1(s.meOnly)], [T("Raw score sum", "Suma de puntajes crudos"), s.raw / 10, f1(s.raw), true], ["RRF, k = 60", s.rrf / 10, f1(s.rrf), true]] };
    },
    agree: () => {
      const a = RESULTS.agree;
      return { verdict: T("D1 (3rd and 4th): 1/63 + 1/64 = " + f5(a.d1) + ", 1st place. D2 (1st, one ballot only): 1/61 = " + f5(a.d2) + ", " + a.d2Place + "th place, tied with D5, the meaning ballot's first. D1 scores " + a.ratio.toFixed(2) + "× D2.",
          "D1 (puestos 3 y 4): 1/63 + 1/64 = " + f5(a.d1) + ", primer lugar. D2 (puesto 1, en una sola boleta): 1/61 = " + f5(a.d2) + ", puesto " + a.d2Place + ", empatado con D5, el primero de la boleta de significado. D1 suma " + a.ratio.toFixed(2) + "× lo de D2."),
        bars: [[T("D1: 3rd + 4th", "D1: puestos 3 + 4"), a.d1 / 0.0328, f5(a.d1), true], [T("D2: 1st on one ballot", "D2: puesto 1 en una boleta"), a.d2 / 0.0328, f5(a.d2)], [T("Most possible from two ballots (2 × 1/61)", "Máximo posible con dos boletas (2 × 1/61)"), 2 / 61 / 0.0328, f5(2 / 61)]] };
    },
    k: () => {
      const K = RESULTS.k;
      return { verdict: T("Top 5 at k = 1: " + K.fig[1].top.join(" ") + " (" + K.fig[1].hits + " relevant). At k = 60: " + K.fig[60].top.join(" ") + " (" + K.fig[60].hits + "). At k = 1000: " + K.fig[1000].top.join(" ") + " (" + K.fig[1000].hits + "). Over 40 queries, relevant in the top 10: " + f1(K.avg[1]) + " / " + f1(K.avg[60]) + " / " + f1(K.avg[1000]) + ". A first place is worth " + K.firstVsTenth[1].toFixed(1) + "× a 10th at k = 1, " + K.firstVsTenth[60].toFixed(2) + "× at 60 and " + K.firstVsTenth[1000].toFixed(3) + "× at 1000.",
          "Top 5 con k = 1: " + K.fig[1].top.join(" ") + " (" + K.fig[1].hits + " relevantes). Con k = 60: " + K.fig[60].top.join(" ") + " (" + K.fig[60].hits + "). Con k = 1000: " + K.fig[1000].top.join(" ") + " (" + K.fig[1000].hits + "). En 40 consultas, relevantes en el top 10: " + f1(K.avg[1]) + " / " + f1(K.avg[60]) + " / " + f1(K.avg[1000]) + ". Un primer lugar vale " + K.firstVsTenth[1].toFixed(1) + "× un décimo puesto con k = 1, " + K.firstVsTenth[60].toFixed(2) + "× con 60 y " + K.firstVsTenth[1000].toFixed(3) + "× con 1000."),
        bars: [[T("k = 1, relevant in top 10", "k = 1, relevantes en el top 10"), K.avg[1] / 10, f1(K.avg[1]), true], ["k = 60", K.avg[60] / 10, f1(K.avg[60])], ["k = 1000", K.avg[1000] / 10, f1(K.avg[1000])]] };
    },
    noisy: () => {
      const n = RESULTS.noisy;
      return { verdict: T("Relevant documents in the top 10, over 40 queries: two judges " + f1(n.two) + ", plus clicks at full weight " + f1(n.three) + ", plus clicks at 0.3 " + f1(n.weighted) + ". On the figure's query the top 5 goes from " + n.fig.two + " relevant to " + n.fig.three.hits + " (" + n.fig.three.top.join(" ") + ") with clicks at full weight, and back to " + n.fig.weighted.hits + " (" + n.fig.weighted.top.join(" ") + ") at 0.3.",
          "Documentos relevantes en el top 10, en 40 consultas: dos jueces " + f1(n.two) + ", más clics a peso completo " + f1(n.three) + ", más clics con 0.3 " + f1(n.weighted) + ". En la consulta de la figura, el top 5 pasa de " + n.fig.two + " relevantes a " + n.fig.three.hits + " (" + n.fig.three.top.join(" ") + ") con clics a peso completo, y vuelve a " + n.fig.weighted.hits + " (" + n.fig.weighted.top.join(" ") + ") con 0.3."),
        bars: [[T("Keyword + meaning", "Palabras clave + significado"), n.two / 10, f1(n.two)], [T("+ clicks, weight 1", "+ clics, peso 1"), n.three / 10, f1(n.three), true], [T("+ clicks, weight 0.3", "+ clics, peso 0.3"), n.weighted / 10, f1(n.weighted), true]] };
    },
    depth: () => {
      const d = RESULTS.depth, ex = d.example;
      return { verdict: T("Relevant documents in the fused top 10: " + f1(d.shallow) + " with top-10 lists, " + f1(d.deep) + " with top-100 lists; " + f1(d.rescued) + " per query were on neither top-10 list. For example, a document ranked " + ex.ranks.join(" and ") + " scored " + f5(ex.score) + " and finished " + ex.place + (ex.place === 1 ? "st" : ex.place === 2 ? "nd" : ex.place === 3 ? "rd" : "th") + ", ahead of any single first place (" + f5(d.single1) + "). A lone 40th place is worth " + f5(d.single40) + ".",
          "Documentos relevantes en el top 10 fusionado: " + f1(d.shallow) + " con listas de 10, " + f1(d.deep) + " con listas de 100; " + f1(d.rescued) + " por consulta no estaban en ninguna de las dos listas de 10. Por ejemplo, un documento en los puestos " + ex.ranks.join(" y ") + " sumó " + f5(ex.score) + " y terminó en el puesto " + ex.place + ", por delante de cualquier primer lugar solitario (" + f5(d.single1) + "). Un puesto 40 solitario vale " + f5(d.single40) + "."),
        bars: [[T("Top 10 from each", "Los 10 primeros de cada una"), d.shallow / 10, f1(d.shallow)], [T("Top 100 from each", "Los 100 primeros de cada una"), d.deep / 10, f1(d.deep), true], [T("Two votes in the teens (example)", "Dos votos cerca del puesto 15 (ejemplo)"), ex.score / 0.0328, f5(ex.score), true], [T("One first place", "Un primer lugar"), d.single1 / 0.0328, f5(d.single1)]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    for (const name of ["mode", "k", "judges", "weight", "depth"]) set(name, String(w[name]), true);
    restart(0);
    if (loop.paused) loop.setPaused(false);
  } });

  loop.setPaused(loop.paused);
  restart();
}

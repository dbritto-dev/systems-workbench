// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The sorting plant in the browser: builds the same help centre and engine as the experiments, sends each query
// down the two lanes, merges (and optionally reranks) the racks onto the shelf, and wires the controls and the
// experiment cards. mount() gets the build-time data from page.ts (geometry, results).
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L as tr, T } from "../../runtime/wb";
import { readout, stats, setText, act, pauseControls } from "../../runtime/dom";
import { pct } from "../../lib/format";
import { makeEngine, tokens, LATENCY } from "./sim";

export default function mount({ P, G, RESULTS, EXPERIMENTS }) {
  const START = 85;                 // "Puffin parcel slow": keywords rank it 7th, meaning 3rd, the merge 1st

  const KIND_ES = { exact: "exacta", paraphrase: "paráfrasis", mixed: "mixta" };                 // "exacta: …" in the Query stat
  const QUERY_ES = { exact: "consulta exacta", paraphrase: "consulta de paráfrasis", mixed: "consulta mixta" };
  const stage = document.querySelector("[data-plant]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const say = readout();
  const E = makeEngine(11);
  const slot = (id) => { const g = q('[data-slot="' + id + '"]'); return { g, body: g.querySelector("[data-body]"), num: g.querySelector("[data-num]"), shown: null }; };
  const tiles = { a: [], b: [], f: [] };
  for (let i = 0; i < G.SLOTS; i++) for (const k of ["a", "b", "f"]) tiles[k].push(slot(k + i));
  const reading = (() => { const g = q("[data-reading]"); return { g, body: g.querySelector("[data-body]"), num: g.querySelector("[data-num]") }; })();
  const querySign = q("[data-query]"), sieveText = q("[data-sieve]"), fuseText = q("[data-fuse]"), closed = q("[data-closed]");
  const counters = Object.fromEntries(["ranka", "rankb", "reread", "rexact", "rparaphrase", "rmixed", "ms"].map((n) => [n, WB.counter(svg, n, P)]));
  const latDial = WB.dial(svg, "lat", P);
  const stat = stats();

  const cfg = { qtype: "all", lanes: "both", fusion: "rrf", alpha: "0.5", depth: "20", rerank: "off", speed: 1 };
  const engCfg = () => ({ lexical: cfg.lanes !== "sem", semantic: cfg.lanes !== "lex", fusion: cfg.fusion, alpha: Number(cfg.alpha), depth: Number(cfg.depth), rerank: cfg.rerank === "on" });
  let scores = null, order = [], at = 0, cur = null, t = 0;

  function rescore() {
    const r = E.evaluate(engCfg(), 10);
    scores = r;
    counters.rexact.set(Math.round(r.exact.recall * 100)); counters.rparaphrase.set(Math.round(r.paraphrase.recall * 100)); counters.rmixed.set(Math.round(r.mixed.recall * 100));
  }
  function queue() {
    const byType = (t) => E.queries.filter((x) => x.type === t);
    if (cfg.qtype !== "all") return byType(cfg.qtype).map((x) => x.id);
    const [a, b, c] = ["mixed", "exact", "paraphrase"].map(byType);
    const out = [];
    for (let i = 0; i < 30; i++) out.push(a[i].id, b[i].id, c[i].id);
    return out;
  }
  function begin(id, startAt = 0) {
    const query = E.queries[id];
    const res = E.search(query, engCfg());
    const L = E.lists(query);
    const rankA = cfg.lanes === "sem" ? 0 : (L.lex[query.target] > 0 ? L.lexRank.indexOf(query.target) + 1 : 0);
    const rankB = cfg.lanes === "lex" ? 0 : L.semRank.indexOf(query.target) + 1;
    const rf = res.final.indexOf(query.target) + 1;
    const rel = new Set(query.rel);
    const rr = res.reranked ? 0.6 + 1.4 * Math.min(1, res.reranked / 100) : 0;
    cur = { query, res, rankA, rankB, rf, rel, rr, shelf0: 3 + rr };
    t = startAt;
    const terms = tokens(query.words);
    cur.terms = terms;
    setText(querySign, query.text);
    words();
    paint();
  }
  function next() { at = (at + 1) % order.length; begin(order[at]); }
  function restart(startAt = 0, first) {
    rescore();
    order = queue();
    const want = first ? START : order[0];
    at = Math.max(0, order.indexOf(want));
    WB.pose(svg, "fusion", cfg.fusion === "rrf" || cfg.lanes !== "both" ? "rrf" : "a" + cfg.alpha);
    closed.style.display = cfg.rerank === "on" ? "none" : "";
    begin(order[at], startAt);
  }

  // the words on the sieve and the hopper
  function words() {
    setText(sieveText, cfg.lanes === "sem" ? tr("lane off", "carril apagado") : cur.terms.join(" · "));
    setText(fuseText, cfg.lanes !== "both" ? tr("ONE LANE", "UN CARRIL") : cfg.fusion === "rrf" ? "RRF" : (cfg.fusion === "raw" ? tr("RAW ", "CRUDO ") : "α ") + cfg.alpha);
  }

  function dress(tile, docId) {
    const key = docId === null ? null : docId + (cur.rel.has(docId) ? "*" : "");
    if (tile.shown === key) return;
    tile.shown = key;
    if (docId === null) { tile.g.style.display = "none"; return; }
    tile.g.style.display = "";
    setText(tile.num, String(E.docs[docId].n));
    tile.body.toggleAttribute("data-lit", cur.rel.has(docId));
  }
  function drop(tile, k) {   // a tile settles into its slot over its first 0.25 s
    const lift = Math.max(0, 1 - k / 0.25);
    tile.g.style.opacity = String(Math.min(1, k / 0.12));
    const base = tile.g.dataset.base || (tile.g.dataset.base = tile.g.getAttribute("transform"));
    tile.g.setAttribute("transform", lift > 0 ? base + " " + translateAlong(P, [0, 0, 6 * lift]) : base);
  }

  function paint() {
    const c = cur, r = c.res;
    const fillAt = (i) => 0.5 + 0.18 * i;
    for (const [lane, list] of [["a", r.lexTop], ["b", r.semTop]]) {
      tiles[lane].forEach((tile, i) => {
        const k = t - fillAt(i);
        const id = k >= 0 && i < list.length ? list[i] : null;
        dress(tile, id);
        if (id !== null) drop(tile, k);
      });
    }
    const laneDone = t >= fillAt(9) + 0.25;
    counters.ranka.set(laneDone ? Math.min(999, c.rankA) : 0); counters.rankb.set(laneDone ? Math.min(999, c.rankB) : 0);
    // reranking: the inspector re-reads the head of the merged list
    const rrK = c.rr ? (t - 3) / c.rr : -1;
    const reading_ = c.rr && rrK >= 0 && rrK < 1;
    WB.pose(svg, "inspector", cfg.rerank !== "on" ? "off" : reading_ ? "lit" : "on");
    if (reading_) {
      const n = Math.floor(rrK * r.reranked);
      const id = r.final[Math.min(r.final.length - 1, n % Math.min(r.final.length, 100))];
      reading.g.style.display = "";
      setText(reading.num, String(E.docs[id].n));
      reading.body.toggleAttribute("data-lit", c.rel.has(id));
    } else reading.g.style.display = "none";
    const rrDone = Math.max(0, Math.min(1, rrK));
    counters.reread.set(Math.round(rrDone * r.reranked));
    latDial.set(Math.min(1, (t >= 3 ? (Math.max(0, Math.min(1, (t - 2.6) / 0.4)) * (r.ms - r.reranked * LATENCY.perRerank) + rrDone * r.reranked * LATENCY.perRerank) : 0) / 300));
    tiles.f.forEach((tile, i) => {
      const k = t - (c.shelf0 + 0.14 * i);
      const id = k >= 0 && i < r.final.length ? r.final[i] : null;
      dress(tile, id);
      if (id !== null) drop(tile, k);
    });
    const done = t >= c.shelf0 + 0.14 * 9 + 0.25;
    counters.ms.set(done ? Math.round(r.ms) : 0);
    const show = (x) => (x ? "#" + x : tr("not found", "no encontrado")), off = tr("off", "apagado");
    stat("query", tr(c.query.type, KIND_ES[c.query.type]) + ": " + c.query.text);
    stat("ra", cfg.lanes === "sem" ? off : laneDone ? show(c.rankA) : "…");
    stat("rb", cfg.lanes === "lex" ? off : laneDone ? show(c.rankB) : "…");
    stat("rf", done ? show(c.rf) + (c.rel.size > 1 ? tr(" (" + c.rel.size + " articles count)", " (cuentan " + c.rel.size + " artículos)") : "") : "…");
    stat("recall", scores ? pct(scores[c.query.type].recall) : "");
    stat("ms", done ? Math.round(r.ms) + " ms" : "…");
    const head = '"' + c.query.text + '"';
    const ra = cfg.lanes === "sem" ? off : show(c.rankA), rb = cfg.lanes === "lex" ? off : show(c.rankB);
    if (t < 0.5) say(tr(c.query.type + " query " + head + " · down both lanes", QUERY_ES[c.query.type] + " " + head + " · por los dos carriles"));
    else if (!laneDone) say(head + tr(" · lanes filling their racks", " · los carriles llenan sus estantes"));
    else if (t < 3) say(head + tr(" · keywords " + ra + " · meaning " + rb + " · merging", " · palabras clave " + ra + " · significado " + rb + " · fusionando"));
    else if (reading_) say(head + tr(" · reranker re-reading " + r.reranked + " candidates", " · el reranker relee " + r.reranked + " candidatos"));
    else say(head + tr(" · keywords " + ra + " · meaning " + rb + " · result " + show(c.rf), " · palabras clave " + ra + " · significado " + rb + " · resultado " + show(c.rf)));
  }

  const pause = pauseControls(stage, say);
  const loop = WB.loop({ stage, step: (dt) => { t += dt * cfg.speed; if (t > cur.shelf0 + 1.6 + 2.6) next(); else paint(); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    WB.pressSeg(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = raw;
    if (!quiet) restart();
  }
  WB.onSegments((name, value) => set(name, value));
  act("next").addEventListener("click", () => { next(); if (loop.paused) loop.setPaused(false); });
  act("reset").addEventListener("click", () => restart());

  // ---------- experiments (same model: 90 labelled queries on each of five generated help centres) ----------
  const kinds = (o, after) => [["Exact IDs", o.exact / 100, o.exact + "%", after], ["Paraphrases", o.paraphrase / 100, o.paraphrase + "%", after], ["Mixed", o.mixed / 100, o.mixed + "%", after]];
  const RUNS = {
    lanes: () => { const { lexical, semantic, hybrid } = RESULTS.three;
      const trio = (o) => o.exact + " / " + o.paraphrase + " / " + o.mixed + "%";
      return { verdict: T("Keyword lane: " + trio(lexical) + " (exact / paraphrase / mixed). Meaning lane: " + trio(semantic) + ". Both, merged: " + trio(hybrid) + ".",
          "Carril de palabras clave: " + trio(lexical) + " (exactas / paráfrasis / mixtas). Carril de significado: " + trio(semantic) + ". Los dos, fusionados: " + trio(hybrid) + "."),
        bars: [[T("Keywords: exact IDs", "Palabras clave: IDs exactos"), lexical.exact / 100, lexical.exact + "%"], [T("Keywords: paraphrases", "Palabras clave: paráfrasis"), lexical.paraphrase / 100, lexical.paraphrase + "%"], [T("Meaning: exact IDs", "Significado: IDs exactos"), semantic.exact / 100, semantic.exact + "%"], [T("Meaning: paraphrases", "Significado: paráfrasis"), semantic.paraphrase / 100, semantic.paraphrase + "%"], [T("Both: exact IDs", "Ambos: IDs exactos"), hybrid.exact / 100, hybrid.exact + "%", true], [T("Both: paraphrases", "Ambos: paráfrasis"), hybrid.paraphrase / 100, hybrid.paraphrase + "%", true], [T("Both: mixed (keywords " + lexical.mixed + "%, meaning " + semantic.mixed + "%)", "Ambos: mixtas (palabras clave " + lexical.mixed + "%, significado " + semantic.mixed + "%)"), hybrid.mixed / 100, hybrid.mixed + "%", true]] }; },
    fusion: () => { const { raw, minmax, rrf } = RESULTS.fusion;
      return { verdict: T("Paraphrases in the top 10: raw sum " + raw.paraphrase + "%, scaled sum " + minmax.paraphrase + "%, RRF " + rrf.paraphrase + "%. Over all 90 queries: " + raw.all + "%, " + minmax.all + "%, " + rrf.all + "%. The keyword lane alone gets " + RESULTS.three.lexical.paraphrase + "% of paraphrases.",
          "Paráfrasis en el top 10: suma cruda " + raw.paraphrase + "%, suma escalada " + minmax.paraphrase + "%, RRF " + rrf.paraphrase + "%. Sobre las 90 consultas: " + raw.all + "%, " + minmax.all + "%, " + rrf.all + "%. El carril de palabras clave solo consigue el " + RESULTS.three.lexical.paraphrase + "% de las paráfrasis."),
        bars: [[T("Paraphrases, raw sum", "Paráfrasis, suma cruda"), raw.paraphrase / 100, raw.paraphrase + "%", true], [T("Paraphrases, scaled sum", "Paráfrasis, suma escalada"), minmax.paraphrase / 100, minmax.paraphrase + "%"], [T("Paraphrases, RRF", "Paráfrasis, RRF"), rrf.paraphrase / 100, rrf.paraphrase + "%"], [T("All queries, raw sum", "Todas las consultas, suma cruda"), raw.all / 100, raw.all + "%", true], [T("All queries, scaled sum", "Todas las consultas, suma escalada"), minmax.all / 100, minmax.all + "%"], [T("All queries, RRF", "Todas las consultas, RRF"), rrf.all / 100, rrf.all + "%"]] }; },
    alpha: () => { const A = RESULTS.alpha; const top = (k) => A.reduce((b, a) => (a[k] > b[k] ? a : b));
      const span = (k, to = " to ") => { const m = top(k)[k]; const h = A.filter((a) => a[k] === m).map((a) => a.alpha); return h.length > 1 ? h[0] + to + h[h.length - 1] : String(h[0]); };
      return { verdict: T("Best α for exact IDs " + span("exact") + ", for paraphrases " + span("paraphrase") + ", for mixed " + span("mixed") + "; over all 90 queries α " + span("all") + " (" + top("all").all + "%). α 0 and α 1 are just the two lanes alone.",
          "Mejor α para IDs exactos " + span("exact", " a ") + ", para paráfrasis " + span("paraphrase", " a ") + ", para mixtas " + span("mixed", " a ") + "; sobre las 90 consultas, α " + span("all", " a ") + " (" + top("all").all + "%). α 0 y α 1 son solo los dos carriles por separado."),
        bars: A.map((a) => [T("α " + a.alpha + ": exact " + a.exact + " · para " + a.paraphrase + " · mixed " + a.mixed, "α " + a.alpha + ": exactas " + a.exact + " · paráf. " + a.paraphrase + " · mixtas " + a.mixed), a.all / 100, a.all + "%", a.alpha === top("all").alpha]) }; },
    depth: () => { const D = RESULTS.depth;
      return { verdict: T(D.map((d) => "Depth " + d.depth + ": " + d.pool + "% reach the merge, " + d.all + "% in the top 10, " + d.ms + " ms").join(". ") + ".",
          D.map((d) => "Profundidad " + d.depth + ": el " + d.pool + "% llega a la fusión, el " + d.all + "% al top 10, " + d.ms + " ms").join(". ") + "."),
        bars: D.flatMap((d) => [[T("Depth " + d.depth + ": in the top 10", "Profundidad " + d.depth + ": en el top 10"), d.all / 100, d.all + "%", d.depth !== 10], [T("Depth " + d.depth + ": time (of 300 ms)", "Profundidad " + d.depth + ": tiempo (de 300 ms)"), Math.min(1, d.ms / 300), d.ms + " ms"]]) }; },
    rerank: () => { const { off, on } = RESULTS.rerank;
      return { verdict: T("In the top 5 without reranking: " + off.all + "% (" + off.exact + " / " + off.paraphrase + " / " + off.mixed + "), " + off.ms + " ms. With the reranker over the top 100: " + on.all + "% (" + on.exact + " / " + on.paraphrase + " / " + on.mixed + "), " + on.ms + " ms.",
          "En el top 5 sin reranking: " + off.all + "% (" + off.exact + " / " + off.paraphrase + " / " + off.mixed + "), " + off.ms + " ms. Con el reranker sobre los primeros 100: " + on.all + "% (" + on.exact + " / " + on.paraphrase + " / " + on.mixed + "), " + on.ms + " ms."),
        bars: [[T("Top 5, no rerank", "Top 5, sin reranking"), off.all / 100, off.all + "%"], [T("Top 5, reranked", "Top 5, con reranking"), on.all / 100, on.all + "%", true], [T("Time, no rerank (of 300 ms)", "Tiempo, sin reranking (de 300 ms)"), off.ms / 300, off.ms + " ms"], [T("Time, reranked (of 300 ms)", "Tiempo, con reranking (de 300 ms)"), on.ms / 300, on.ms + " ms", true]] }; },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    for (const key of ["qtype", "lanes", "fusion", "alpha", "depth", "rerank"]) if (w[key] !== undefined) set(key, w[key], true);
    restart();
    if (loop.paused) loop.setPaused(false);
  } });

  loop.setPaused(loop.paused);
  restart(4.7, true);
}

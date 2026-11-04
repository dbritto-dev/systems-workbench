// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The print shop in the browser: the indexing line runs for show, and each question replays where its answer chunk
// landed under the current settings (ranks worked out at build time), and the controls. mount() gets the build-time
// data from page.ts (geometry, card drawing, ranks, questions) and root, the <wb-lesson>.
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L as tr } from "../../runtime/wb";
import { setText, playPause } from "../../runtime/dom";

export default function mount({ P, G, CARD_SVG, RANKS, QS, DOCS, COST, POOL, CHUNKS }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const say = (text) => root.figure.say(text);
  const NS = "http://www.w3.org/2000/svg";
  const layers = { belt: q('[data-layer="belt"]'), rack: q('[data-layer="rack"]'), tray: q('[data-layer="tray"]') };
  const counters = Object.fromEntries(["pooled", "rank", "k", "asked", "missed"].map((n) => [n, WB.counter(svg, n, P)]));
  const costMeter = WB.meter(svg, "cost", P), failMeter = WB.meter(svg, "failrate", P);
  const blade = q("[data-blade]"), ram = q("[data-ram]"), reading = q("[data-reading]"), pressOff = q("[data-press-off]");
  const bins = qa("[data-bin]");
  const question = q("[data-question]");
  const cover = { stack: q("[data-cover-stack]"), cut: q("[data-cover-cut]"), read: q("[data-cover-read]"), read2: q("[data-cover-read2]") };
  const wordsBand = q('[data-off-band="words"]'), rerankBand = q('[data-off-band="rerank"]');

  function makeCard() {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = CARD_SVG;
    return { g, body: g.querySelector("[data-body]"), strip: g.querySelector("[data-strip]"), lit: null, stripOn: null };
  }
  function dress(c, lit, strip) {
    if (c.lit !== lit) { c.lit = lit; c.body.toggleAttribute("data-lit", lit); }
    if (c.stripOn !== strip) { c.stripOn = strip; c.strip.style.display = strip ? "" : "none"; }
  }
  // the tray's 20 places, and the answer card in the rack
  const slots = G.SLOT.map((pos) => { const c = makeCard(); c.g.setAttribute("transform", translateAlong(P, pos)); c.g.style.display = "none"; layers.tray.appendChild(c.g); return c; });
  const marker = makeCard(); marker.g.style.display = "none"; layers.rack.appendChild(marker.g); dress(marker, true, false);

  // ---------- the indexing line: booklets cut into cards that ride the belt past the press ----------
  const belt = [], spare = [];
  const SPACING = 0.62, SPEED = 15, PER_DOC = 8;
  let spawnClock = 0, cardNo = 0;
  function docName(n) { return DOCS[Math.floor(n / PER_DOC) % DOCS.length]; }
  function splitName(name) { const parts = name.split(" "); return parts.length === 3 ? [parts[0], parts[1] + " " + parts[2]] : [parts[0], "MANUAL"]; }
  function spawn(x) {
    const c = spare.pop() || makeCard();
    c.x = x; layers.belt.appendChild(c.g); belt.push(c); cardNo++;
  }
  function stepBelt(dt) {
    spawnClock += dt;
    while (spawnClock >= SPACING) { spawnClock -= SPACING; spawn(G.BELT_X0 + spawnClock * SPEED); }
    for (let i = belt.length - 1; i >= 0; i--) {
      const c = belt[i];
      c.x += dt * SPEED;
      if (c.x > G.BELT_X1) { c.g.remove(); spare.push(c); belt.splice(i, 1); continue; }
      c.g.setAttribute("transform", translateAlong(P, [c.x, G.BELT_Y, G.BELT_Z]));
      dress(c, false, cfg.ctx === "ctx" && c.x > G.PRESS_X + 1);
      const fade = Math.min(1, (G.BELT_X1 - c.x) / 8);
      c.g.style.opacity = fade < 1 ? String(fade) : "";
    }
    // the blade comes down as each card is cut; the ram stamps as each card passes under it
    const cut = spawnClock / SPACING, bladeDown = cut < 0.25 ? Math.sin(Math.PI * cut / 0.25) : 0;
    blade.setAttribute("transform", bladeDown ? translateAlong(P, [0, 0, -(G.BLADE.z1 - G.BLADE.z0) * bladeDown]) : "");
    let stamp = 0;
    if (cfg.ctx === "ctx") for (const c of belt) { const d = Math.abs(c.x - G.PRESS_X); if (d < 2.4) stamp = Math.max(stamp, Math.cos((d / 2.4) * Math.PI / 2)); }
    ram.setAttribute("transform", stamp ? translateAlong(P, [0, 0, -(G.RAM.z1 - G.RAM.z0) * 0.55 * stamp]) : "");
    const cutting = docName(cardNo), next = docName(cardNo + PER_DOC);
    setText(cover.cut, cutting.split(" ").slice(0, 2).join(" ")); setText(cover.stack, next.split(" ").slice(0, 2).join(" "));
    const [a, b] = splitName(cutting); setText(cover.read, a); setText(cover.read2, b);
  }

  // ---------- questions ----------
  const cfg = { ctx: "ctx", search: "both", rerank: "on", k: "20", cache: "on", speed: 1 };
  const T = 4.8;              // seconds per question at ×1
  const WARM = 40;            // each run opens with 40 questions already answered
  let qi, phase, asked, missed, lastMissed, ranks;
  const key = () => (cfg.ctx === "ctx" ? 1 : 0) + "" + (cfg.search === "both" ? 1 : 0) + (cfg.rerank === "on" ? 1 : 0);
  const K = () => Number(cfg.k);
  function outcome(n) {
    const [first, fin] = ranks[QS[n % QS.length].i];
    const k = K(), rer = cfg.rerank === "on";
    const finalRank = rer ? fin : first;
    return { first, finalRank, rer, found: finalRank >= 0 && finalRank < k, inPool: first < (rer ? POOL : k) };
  }
  function restart() {
    ranks = RANKS[key()];
    asked = 0; missed = 0;
    for (let n = 0; n < WARM; n++) { asked++; if (!outcome(n).found) missed++; }
    qi = WARM; phase = 0.55; lastMissed = false;
    wordsBand.style.display = cfg.search === "both" ? "none" : "";
    rerankBand.style.display = cfg.rerank === "on" ? "none" : "";
    WB.pose(svg, "inspector", cfg.rerank === "on" ? "on" : "off");
    const ctxOn = cfg.ctx === "ctx";
    reading.style.display = ctxOn ? "" : "none"; pressOff.style.display = ctxOn ? "none" : "";
    for (const c of belt) dress(c, false, ctxOn && c.x > G.PRESS_X + 1);
    counters.k.set(K());
    paint();
  }
  const ordinal = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");
  const ordinalEs = (n) => n + ".\u00ba";
  function paint() {
    const cur = QS[qi % QS.length], o = outcome(qi), k = K();
    const label = cur.label;
    setText(question, label);
    question.setAttribute("font-size", label.length <= 18 ? 2.8 : label.length <= 22 ? 2.4 : 2.1);
    const fetching = phase < 0.4;
    WB.pose(svg, "lamp-map", fetching ? "on" : "off");
    WB.pose(svg, "lamp-words", fetching && cfg.search === "both" ? "on" : "off");
    // the rack: candidates arrive bin by bin
    const pooled = o.rer ? POOL : k;
    const binsTotal = Math.ceil(pooled / 10);
    const shownBins = Math.max(0, Math.min(binsTotal, Math.ceil(((phase - 0.1) / 0.3) * binsTotal)));
    bins.forEach((b, i) => { const on = i < shownBins; if ((b.style.display !== "none") !== on) b.style.display = on ? "" : "none"; });
    counters.pooled.set(Math.min(pooled, shownBins * 10));
    const markerBin = o.first >= 0 && o.first < pooled ? Math.floor(o.first / 10) : -1;
    const showMarker = markerBin >= 0 && markerBin < shownBins && (phase < 0.4 || !o.found || o.rer);
    marker.g.style.display = showMarker ? "" : "none";
    if (showMarker) { marker.g.setAttribute("transform", translateAlong(P, [G.BIN_X[markerBin], G.BIN_Y, G.BIN_Z + 4.2])); dress(marker, true, cfg.ctx === "ctx"); }
    // the tray: the inspector (or search itself) passes the best k on, one by one
    const filled = phase < 0.4 ? 0 : Math.min(k, Math.ceil(((phase - 0.4) / 0.32) * k));
    const ctxOn = cfg.ctx === "ctx";
    slots.forEach((c, i) => { const on = i < filled; c.g.style.display = on ? "" : "none"; if (on) dress(c, o.found && i === o.finalRank, ctxOn); });
    // the answer's rank: where search put it, then where it ended up
    const shownRank = phase < 0.4 ? o.first : o.finalRank;
    counters.rank.set(shownRank >= 0 ? Math.min(9999, shownRank + 1) : 9999);
    // the score, counted once the tray is full
    const done = phase >= 0.75;
    const a = asked + (done ? 1 : 0), m = missed + (done && !o.found ? 1 : 0);
    counters.asked.set(a); counters.missed.set(m);
    failMeter.set(a ? Math.min(1, m / a / 0.4) : 0);
    WB.pose(svg, "miss", (done && !o.found) || (!done && lastMissed && phase < 0.1) ? "on" : "off");
    const cost = cfg.ctx === "ctx" ? COST[cfg.cache] : 0;
    costMeter.set(cost / 4);
    stat("asked", a); stat("missed", m); stat("rate", a ? (100 * m / a).toFixed(1) + "%" : "–");
    stat("rank", o.first < 0 ? "–" : o.rer
      ? tr(ordinal(o.first + 1) + " → " + (o.finalRank >= 0 ? ordinal(o.finalRank + 1) : "not in the 150"), ordinalEs(o.first + 1) + " → " + (o.finalRank >= 0 ? ordinalEs(o.finalRank + 1) : "no está entre los 150"))
      : tr(ordinal(o.first + 1), ordinalEs(o.first + 1)));
    stat("passed", k + tr(" chunks", " fragmentos")); stat("cost", cfg.ctx === "ctx" ? "$" + cost.toFixed(2) + tr(" per M tokens", " por M de tokens") : tr("none", "ninguno"));
    // the readout
    const where = o.first < 0 ? tr("not found", "no encontrado") : tr("search ranked it " + ordinal(o.first + 1) + " of " + CHUNKS, "la búsqueda lo puso en el puesto " + (o.first + 1) + " de " + CHUNKS);
    const came = (o.rer ? o.finalRank : o.first) + 1;
    let text;
    if (phase < 0.4) text = "\u201c" + cur.text + "\u201d · " + where;
    else if (!o.found) text = tr((o.rer && !o.inPool ? "the answer wasn't in the first 150" : "the answer came " + ordinal(came)) + " · not among the " + k + " passed on · missed",
      (o.rer && !o.inPool ? "la respuesta no estaba entre los 150 primeros" : "la respuesta quedó en el puesto " + came) + " · no está entre los " + k + " que se pasan · sin encontrar");
    else text = tr((o.rer ? "reranked to " + ordinal(o.finalRank + 1) : "ranked " + ordinal(o.first + 1)) + " · in the " + k + " passed on to the model",
      (o.rer ? "reranking: puesto " + (o.finalRank + 1) : "puesto " + (o.first + 1)) + " · en los " + k + " que se pasan");
    say(text);
  }
  const stat = (key, value) => root.stat(key, value);

  function nextQuestion() {
    const o = outcome(qi);
    asked++; if (!o.found) missed++;
    lastMissed = !o.found;
    qi++; phase = 0;
  }
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    const d = dt * cfg.speed;
    stepBelt(d);
    phase += d / T;
    if (phase >= 1) nextQuestion();
    paint();
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = raw;
    if (name === "cache") { paint(); return; }
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));
  const actions = {
    next: () => { if (phase < 0.75) phase = 0.75; else nextQuestion(); paint(); },
    reset: () => restart(),
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const n of ["ctx", "search", "rerank", "k", "cache"]) set(n, w[n], true);
    restart();
    if (loop.paused) loop.setPaused(false);
  });

  for (let i = 0; i < 120; i++) stepBelt(0.1);
  loop.setPaused(loop.paused);
  restart();
}

// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The two desks in the browser, one ticket at a time: the ticket arrives and each desk gets a copy; the writing desk
// reads it and lays a tile for every token it writes, then the parser takes the reply or sends it back; the sorting
// desk reads it once, raises every bar at the same moment and drops the ticket into the top bin (or the review
// tray). Both desks' clocks run on the model's time, slowed down (Speed); the gate and the moving cards take a little
// page time of their own, which the clocks don't count. "Send 1,000 tickets" runs them through the same model at
// once. mount() gets the build-time data from page.ts (projection, geometry, drawings) and root, the <wb-lesson>.
import { translateAlong, solidSvg, slabOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, setLit, playPause } from "../../runtime/dom";
import { lerp, smoothstep } from "../../lib/tween";
import { clamp, rankQuantile } from "../../lib/stats";
import { msOrSecs } from "../../lib/format";
import { makeTicket, binsOf, labelOf, NONE, FLOOR, CONFIDENT, SHOWN } from "./sim";

const HOLD = 1.6;          // page seconds a finished ticket stays before the next arrives
const NUM_EN = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN"];
const NUM_ES = ["CERO", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE"];

export default function mount({ P, G, SLIP_SVG, TICKET_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const layer = (n) => q(`[data-layer="${n}"]`);
  const layers = { wland: layer("wland"), sland: layer("sland"), slips: layer("slips"), review: layer("review"), fly: layer("fly") };
  const C = Object.fromEntries(["wms", "tokens", "rejected", "wwrong", "sms", "swrong", "review"].map((n) => [n, WB.counter(svg, n, P)]));
  const tiles = Array.from({ length: G.TILES }, (_, i) => q(`[data-tile="${i}"]`));
  const moreTok = q("[data-more-tokens]"), moreBins = q("[data-more-bins]");
  const bins = Array.from({ length: SHOWN }, (_, i) => {
    const g = q(`[data-bin="${i}"]`);
    return { g, bar: g.querySelector("[data-bar]"), body: g.querySelector("[data-binbody]"), label: g.querySelector("[data-bin-label]"), hold: g.querySelector("[data-binticket]"), key: "", lit: false, big: null };
  });
  const int = (x) => Math.round(x).toLocaleString("en");
  const anim = (d) => (WB.still.matches ? 0.001 : d);
  const gatePose = (key) => { WB.pose(svg, "gate", key); WB.pose(svg, "gate-arm", key); };

  // ---------- cards ----------
  function make(svgText) {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = svgText;
    return g;
  }
  const truthText = (tk) => {
    const { cfg, t } = tk;
    if (cfg.task === "count") return t.count + "/" + t.n;
    return t.off ? "Q" + (Number(cfg.options) + 1 + (t.y % 5)) : labelOf(cfg, t.y);
  };
  function ticketCard(tk) {
    const g = make(TICKET_SVG);
    setText(g.querySelector("[data-ticket-no]"), "#" + (tk.i + 1));
    setText(g.querySelector("[data-ticket-truth]"), truthText(tk));
    return g;
  }
  const put = (g, p) => g.setAttribute("transform", translateAlong(P, p));
  const along = (a, b, u, hop = 0) => { const s = smoothstep(clamp(u)); return [lerp(a[0], b[0], s), lerp(a[1], b[1], s), lerp(a[2], b[2], s) + Math.sin(Math.PI * s) * hop]; };

  // ---------- the bins ----------
  const optText = (cfg, j) => (j === NONE ? L("NONE", "NINGUNA") : labelOf(cfg, j));
  // a label smaller when it's long, so it stays on the bin's face
  function binLabel(b, text) {
    setText(b.label, text);
    b.big ??= Number(b.label.getAttribute("font-size"));
    const size = Math.round(100 * Math.min(b.big, (G.BIN.w - 1) / (0.62 * Math.max(1, text.length)))) / 100;
    b.label.setAttribute("font-size", String(size));
  }
  function setBar(b, p, lit) {
    const h = Math.max(0, p) * G.BAR.max, key = h.toFixed(1) + "|" + lit;
    if (b.key === key) return;
    b.key = key;
    const x = G.BIN_X[bins.indexOf(b)] + G.BAR.dx;
    b.bar.innerHTML = h < 0.3 ? "" : solidSvg(slabOf({ x, y: G.BAR.y, w: G.BAR.w, d: G.BAR.d, r: 0.4 }, G.DESK_H, h, P, 2, 0.15), { tone: "hi", crease: "lo", lit });
  }
  function litBin(b, on) { if (b.lit !== on) { b.lit = on; setLit(b.body, on); } }
  let shownBins = null;            // { bins: [{ j, p }], more } for the ticket on the desk
  function layoutBins(tk) {
    shownBins = binsOf(tk);
    bins.forEach((b, i) => {
      const it = shownBins.bins[i];
      show(b.g, !!it);
      if (it) binLabel(b, optText(tk.cfg, it.j));
      setBar(b, 0, false); litBin(b, false);
      b.hold.replaceChildren();
    });
    setText(moreBins, shownBins.more ? "+" + shownBins.more : "");
  }
  function emptyBins(cfg) {
    const K = cfg.task === "count" ? 8 : Number(cfg.options), none = cfg.task === "route" && cfg.unlisted === "guard";
    const n = Math.min(SHOWN, K + (none ? 1 : 0));
    bins.forEach((b, i) => {
      show(b.g, i < n);
      if (i < n) binLabel(b, none && i === n - 1 ? L("NONE", "NINGUNA") : K > SHOWN - (none ? 1 : 0) ? "" : labelOf(cfg, i));
      setBar(b, 0, false); litBin(b, false); b.hold.replaceChildren();
    });
    setText(moreBins, K + (none ? 1 : 0) > SHOWN ? "+" + (K + (none ? 1 : 0) - SHOWN) : "");
  }

  // ---------- settings, the run and its counts ----------
  const cfg = { task: "route", options: "12", unlisted: "none", format: "json", output: "free", questions: "1", speed: 0.5 };
  const modelCfg = () => ({ task: cfg.task, options: Number(cfg.options), unlisted: cfg.unlisted, format: cfg.format, output: cfg.output, questions: Number(cfg.questions) });
  let seed = 5, runSeed = 5, idx = 0, round = null;
  let acc;
  function resetCounts() {
    acc = { w: [], s: [], rejected: 0, wwrong: 0, swrong: 0, review: 0, n: 0 };
  }
  function count(tk) {          // a whole ticket at once (Send 1,000 tickets)
    acc.w.push(tk.write.time); acc.s.push(tk.sort.time); acc.n++;
    acc.rejected += tk.write.rejected;
    if (tk.write.wrong) acc.wwrong++;
    if (tk.sort.wrong) acc.swrong++;
    if (tk.sort.review) acc.review++;
  }
  function paintCounts() {
    C.rejected.setClamped(acc.rejected); C.wwrong.setClamped(acc.wwrong); C.swrong.setClamped(acc.swrong); C.review.setClamped(acc.review);
  }

  // ---------- narration ----------
  let saidAt = -9, saidRank = 0, held = null;
  const holdFor = (rank) => (rank >= 5 ? 3 : 1.4);
  function say(rank, text) {
    const wall = performance.now() / 1000;
    // a less important message waits; so does one as important as a warning (rank 4+) still being read
    const blocked = wall - saidAt < holdFor(saidRank) && (rank < saidRank || (rank === saidRank && rank >= 4));
    if (blocked) { if (!held || rank >= held.rank) held = { rank, text }; return; }
    held = null; saidRank = rank; saidAt = wall;
    root.figure.say(L(text));
  }
  function sayHeld() {
    if (held && performance.now() / 1000 - saidAt >= holdFor(saidRank)) { const h = held; held = null; saidRank = -1; say(h.rank, h.text); }
  }
  const pctOf = (p) => Math.round(100 * p) + "%";
  const ms = (s) => int(1000 * s) + " ms";

  // ---------- what the writing desk wrote ----------
  function answerText(tk, a) {
    const c = tk.cfg, K = c.task === "count" ? 8 : c.options;
    let lab = a.pick === NONE ? L("NONE", "NINGUNA") : labelOf(c, a.pick);
    if (a.bad && a.bad.q === 0 && a.bad.kind === "near") lab = c.task === "count" ? L(NUM_EN[a.pick], NUM_ES[a.pick]) : L("QUEUE ", "COLA ") + (a.pick === NONE ? K + 1 : a.pick + 1);
    if (a.bad && a.bad.q === 0 && a.bad.kind === "outside") lab = c.task === "count" ? "9" : "Q" + (K + 1 + ((a.pick + 1) % 4));
    const more = c.questions > 1 ? ",…" : "";
    if (c.format === "label") return lab + (c.questions > 1 ? " +" + (c.questions - 1) : "");
    if (c.format === "json") return a.bad && a.bad.kind === "broken" ? '{"q":"' + lab + '"' : c.questions > 1 ? '{"q1":"' + lab + '"' + more + "}" : '{"q":"' + lab + '"}';
    return a.bad && a.bad.kind === "broken" ? "…" + lab + L(" OR ", " O ") + labelOf(c, (Math.max(0, a.pick) + 2) % K) : '{…"q":"' + lab + '"' + more + "}";
  }
  function badText(c, a) {
    if (!a.bad) return "";
    if (a.bad.kind === "broken") return c.format === "json" ? L("NOT VALID JSON", "JSON INVÁLIDO") : L("NO CLEAR ANSWER", "SIN RESPUESTA CLARA");
    return a.bad.q ? L("ANSWER " + (a.bad.q + 1) + " NOT AN OPTION", "RESPUESTA " + (a.bad.q + 1) + " NO ES OPCIÓN") : L("NOT AN OPTION", "NO ES UNA OPCIÓN");
  }
  function badSay(c, a) {
    if (a.bad.kind === "broken") return c.format === "json" ? T("the parser rejects it: not valid JSON · writing it again", "el parser la rechaza: no es JSON válido · se escribe de nuevo") : T("the parser rejects it: no single answer at the end · writing it again", "el parser la rechaza: no hay una sola respuesta al final · se escribe de nuevo");
    if (a.bad.q) return T("the parser rejects it: answer " + (a.bad.q + 1) + " isn't one of the options · writing all " + c.questions + " again", "el parser la rechaza: la respuesta " + (a.bad.q + 1) + " no es una de las opciones · se escriben las " + c.questions + " de nuevo");
    return a.bad.kind === "near" ? T("the parser rejects it: close to an option, but not one · writing it again", "el parser la rechaza: parecida a una opción, pero no es una · se escribe de nuevo") : T("the parser rejects it: that option isn't on the list · writing it again", "el parser la rechaza: esa opción no está en la lista · se escribe de nuevo");
  }

  // ---------- one ticket: a round ----------
  function clearDesks() {
    for (const k of ["wland", "sland", "slips", "review", "fly"]) layers[k].replaceChildren();
    tiles.forEach((tl) => show(tl, false));
    setText(moreTok, "");
    gatePose("down");
  }
  function startRound() {
    clearDesks();
    const tk = makeTicket(modelCfg(), runSeed, idx++);
    const wCard = ticketCard(tk), sCard = ticketCard(tk);
    layers.fly.append(wCard, sCard);
    put(wCard, G.INBOX_AT); put(sCard, G.INBOX_AT);
    emptyBins(tk.cfg);
    round = { tk, phase: "arrive", age: 0, wCard, sCard, w: { k: 0, phase: "wait", clock: 0, done0: 0, tok0: 0, anim: 0, slip: null, shown: -1 }, s: { phase: "wait", clock: 0, anim: 0, bin: -1 }, hold: 0 };
    C.wms.set(0); C.tokens.set(0); C.sms.set(0);
    const what = tk.cfg.task === "count" ? T("how many of its " + tk.t.n + " lines are flagged?", "¿cuántas de sus " + tk.t.n + " líneas están marcadas?") : tk.t.off ? T("its queue isn't on the list", "su cola no está en la lista") : T("which of " + tk.cfg.options + " queues?", "¿cuál de " + tk.cfg.options + " colas?");
    say(1, T("ticket #" + (tk.i + 1) + " · " + what.en + " · both desks get a copy", "ticket #" + (tk.i + 1) + " · " + what.es + " · las dos mesas reciben una copia"));
  }

  function stepRound(dt) {
    const r = round, tk = r.tk, dtm = dt * Number(cfg.speed);
    if (r.phase === "arrive") {
      r.age += dt;
      const u = r.age / anim(0.6);
      put(r.wCard, along(G.INBOX_AT, G.W_LAND, u, 10)); put(r.sCard, along(G.INBOX_AT, G.S_LAND, u, 10));
      if (u >= 1) { layers.wland.append(r.wCard); layers.sland.append(r.sCard); r.phase = "work"; r.w.phase = "read"; r.s.phase = "read"; }
      return;
    }
    if (r.phase === "work") {
      stepWriter(r, tk, dt, dtm);
      stepSorter(r, tk, dt, dtm);
      // while the writing desk is still at it, the readout says how far it has got
      const wall = performance.now() / 1000;
      if ((r.w.phase === "read" || r.w.phase === "write") && wall - saidAt > holdFor(saidRank) + 0.6) {
        const n = Math.max(0, r.w.shown), done = r.s.phase === "done" ? T(" · the sorting desk finished in " + ms(tk.sort.time), " · la mesa de clasificación terminó en " + ms(tk.sort.time)) : T("", "");
        say(0, r.w.phase === "read" ? T("writing desk: still reading the ticket" + done.en, "mesa de escritura: todavía lee el ticket" + done.es)
          : T("writing desk: " + int(n) + (n === 1 ? " token" : " tokens") + " written, one at a time" + done.en, "mesa de escritura: " + int(n) + (n === 1 ? " token escrito" : " tokens escritos") + ", uno a la vez" + done.es));
      }
      if (r.w.phase === "done" && r.s.phase === "done") { r.phase = "hold"; r.hold = 0; finish(r, tk); }
      return;
    }
    r.hold += dt;
    if (r.hold >= HOLD) startRound();
  }
  function finish(r, tk) {
    acc.w.push(tk.write.time); acc.s.push(tk.sort.time); acc.n++;
    showStats();
  }

  // the writing desk: read, write token by token, the parser, and back for another try if it's rejected
  function stepWriter(r, tk, dt, dtm) {
    const w = r.w, a = tk.write.tries[w.k], c = tk.cfg;
    if (w.phase === "read" || w.phase === "write") {
      if (!w.slip) {
        w.slip = make(SLIP_SVG); layers.slips.append(w.slip); put(w.slip, G.SLIP_AT);
        setText(w.slip.querySelector("[data-slip-text]"), "");
        setText(w.slip.querySelector("[data-slip-sub]"), w.k ? L("TRY " + (w.k + 1), "INTENTO " + (w.k + 1)) : "");
        say(1, w.k ? T("writing desk: reading the ticket again for try " + (w.k + 1), "mesa de escritura: lee el ticket otra vez para el intento " + (w.k + 1)) : T("writing desk: reading the ticket", "mesa de escritura: lee el ticket"));
      }
      w.clock = Math.min(a.time, w.clock + dtm);
      const n = w.clock < a.read ? 0 : Math.min(a.tokens, Math.floor((w.clock - a.read) / a.tok) + 1);
      if (n > 0 && w.phase === "read") {
        w.phase = "write";
        if (c.format === "reason") say(1, T("writing desk: writes its reasoning, one token at a time", "mesa de escritura: escribe su razonamiento, un token a la vez"));
        else if (c.format === "json") say(1, T("writing desk: writes the JSON, one token at a time", "mesa de escritura: escribe el JSON, un token a la vez"));
        else say(1, T("writing desk: writes the label, one token at a time", "mesa de escritura: escribe la etiqueta, un token a la vez"));
      }
      if (n !== w.shown) {
        w.shown = n;
        tiles.forEach((tl, i) => show(tl, i < n));
        setText(moreTok, n > tiles.length ? "+" + (n - tiles.length) : "");
      }
      C.wms.setClamped(Math.round(1000 * (w.done0 + w.clock)));
      C.tokens.setClamped(w.tok0 + n);
      if (w.clock >= a.time) {
        w.phase = "toGate"; w.anim = 0;
        setText(w.slip.querySelector("[data-slip-text]"), answerText(tk, a));
      }
      return;
    }
    w.anim += dt;
    const atGate = [G.GATE_X - 1.6 - G.SLIP.w, G.SLIP_AT[1], G.SLIP_AT[2]];
    if (w.phase === "toGate") {
      put(w.slip, along(G.SLIP_AT, atGate, w.anim / anim(0.45)));
      if (w.anim >= anim(0.45)) {
        w.anim = 0;
        if (a.bad) {
          w.phase = "rejected"; acc.rejected++; paintCounts();
          setLit(w.slip, true);
          setText(w.slip.querySelector("[data-slip-sub]"), badText(c, a));
          const last = w.k === tk.write.tries.length - 1;
          say(5, last ? T("the parser rejects try " + (w.k + 1) + " too · the desk gives up on this ticket", "el parser rechaza también el intento " + (w.k + 1) + " · la mesa se rinde con este ticket") : badSay(c, a));
        } else {
          w.phase = "through"; gatePose("up");
        }
      }
      return;
    }
    if (w.phase === "rejected") {
      if (w.anim < anim(0.9)) return;
      if (w.k === tk.write.tries.length - 1) { w.phase = "done"; return; }
      w.phase = "back"; w.anim = 0;
      return;
    }
    if (w.phase === "back") {
      const u = w.anim / anim(0.45);
      put(w.slip, along(atGate, G.SLIP_AT, u));
      w.slip.style.opacity = String(clamp(1 - u));
      if (u >= 1) {
        w.slip.remove(); w.slip = null;
        w.done0 += a.time; w.tok0 += a.tokens; w.k++; w.clock = 0; w.shown = -1; w.phase = "read";
        tiles.forEach((tl) => show(tl, false)); setText(moreTok, "");
      }
      return;
    }
    if (w.phase === "through") {
      put(w.slip, along(atGate, G.TRAY_AT, w.anim / anim(0.5)));
      if (w.anim >= anim(0.5)) {
        w.phase = "done";
        gatePose("down");
        const total = ms(tk.write.time), toks = int(tk.write.tokens);
        if (tk.write.wrong) {
          acc.wwrong++; paintCounts(); setLit(w.slip, true);
          setText(w.slip.querySelector("[data-slip-sub]"), L("VALID, BUT WRONG", "VÁLIDA, PERO ERRÓNEA"));
          say(5, T("the parser accepts it: a valid answer, and the wrong one · " + total + ", " + toks + " tokens", "el parser la acepta: una respuesta válida, y errónea · " + total + ", " + toks + " tokens"));
        } else {
          setText(w.slip.querySelector("[data-slip-sub]"), "");
          say(3, T("the parser accepts the reply · writing desk: " + total + ", " + toks + " tokens · sorting desk: " + ms(tk.sort.time), "el parser acepta la respuesta · mesa de escritura: " + total + ", " + toks + " tokens · mesa de clasificación: " + ms(tk.sort.time)));
        }
      }
    }
  }

  // the sorting desk: one pass, every bar at once, the ticket into the top bin or the review tray
  function stepSorter(r, tk, dt, dtm) {
    const s = r.s, so = tk.sort, c = tk.cfg;
    if (s.phase === "read") {
      s.clock = Math.min(so.time, s.clock + dtm);
      C.sms.setClamped(Math.round(1000 * s.clock));
      if (s.clock >= so.time) { s.phase = "bars"; s.anim = 0; layoutBins(tk); }
      return;
    }
    if (s.phase === "done") return;
    s.anim += dt;
    if (s.phase === "bars") {
      const f = smoothstep(clamp(s.anim / anim(0.35)));
      shownBins.bins.forEach((it, i) => setBar(bins[i], it.p * f, false));
      if (s.anim >= anim(0.35)) {
        s.phase = "drop"; s.anim = 0;
        s.bin = so.review ? -1 : shownBins.bins.findIndex((it) => it.j === so.pick);
        layers.fly.append(r.sCard);
        const n = c.task === "count" ? 8 : c.options + (c.unlisted === "guard" ? 1 : 0);
        const qs = c.questions > 1 ? T(" · all " + c.questions + " questions in the same pass", " · las " + c.questions + " preguntas en la misma pasada") : T("", "");
        say(2, T("sorting desk: one pass, " + n + " scores at once · " + ms(so.time) + qs.en, "mesa de clasificación: una pasada, " + n + " puntajes a la vez · " + ms(so.time) + qs.es));
      }
      return;
    }
    if (s.phase === "drop") {
      const to = s.bin >= 0 ? [G.BIN_X[s.bin] - 0.5, G.BIN.y + 5, G.DESK_H + 1] : G.REVIEW_AT;
      put(r.sCard, along(G.S_LAND, to, s.anim / anim(0.45), 8));
      if (s.anim >= anim(0.45)) {
        s.phase = "done";
        (s.bin >= 0 ? bins[s.bin].hold : layers.review).append(r.sCard);
        const pick = optText(c, so.pick), conf = pctOf(so.conf);
        if (so.review) {
          acc.review++;
          say(4, so.pick === NONE ? T("sorting desk: NONE OF THESE at " + conf + " · to review", "mesa de clasificación: NINGUNA al " + conf + " · a revisión") : T("sorting desk: " + pick + " at only " + conf + ", under " + pctOf(FLOOR) + " · to review", "mesa de clasificación: " + pick + " con solo " + conf + ", menos de " + pctOf(FLOOR) + " · a revisión"));
        } else if (so.wrong) {
          acc.swrong++;
          litBin(bins[s.bin], true); setBar(bins[s.bin], shownBins.bins[s.bin].p, true);
          const truth = truthText(tk);
          const why = c.task === "count" ? T("it's " + tk.t.count, "son " + tk.t.count) : tk.t.off ? T("it's " + truth + ", not on the list", "es " + truth + ", que no está en la lista") : T("it's " + truth, "es " + truth);
          say(5, T("sorting desk: " + pick + " at " + conf + (so.conf >= CONFIDENT ? ", sure of itself" : "") + " · wrong: " + why.en, "mesa de clasificación: " + pick + " al " + conf + (so.conf >= CONFIDENT ? ", muy segura" : "") + " · errónea: " + why.es));
        } else say(2, T("sorting desk: " + pick + " at " + conf + " · " + ms(so.time), "mesa de clasificación: " + pick + " al " + conf + " · " + ms(so.time)));
        paintCounts();
      }
    }
  }

  // ---------- stats ----------
  const lat = (xs) => (xs.length ? msOrSecs(rankQuantile(xs, 0.5)) + " · " + msOrSecs(rankQuantile(xs, 0.99)) : "–");
  function showStats() {
    const r = round, tk = r && r.tk;
    if (tk) {
      const w = r.w, a = tk.write.tries[w.k];
      const done = w.phase === "done" || r.phase === "hold";
      const wsec = done ? tk.write.time : w.done0 + w.clock, wtok = done ? tk.write.tokens : w.tok0 + Math.max(0, w.shown);
      root.stat("wnow", int(1000 * wsec) + " ms · " + int(wtok) + " tokens");
      root.stat("snow", int(1000 * (r.s.phase === "done" || r.phase === "hold" ? tk.sort.time : r.s.clock)) + " ms");
    }
    root.stat("wlat", lat(acc.w));
    root.stat("slat", lat(acc.s));
    root.stat("rejected", acc.n ? L(int(acc.rejected) + " in " + int(acc.n) + " tickets", int(acc.rejected) + " en " + int(acc.n) + " tickets") : "–");
    const rev = acc.review ? L(" · " + int(acc.review) + " to review", " · " + int(acc.review) + " a revisión") : "";
    root.stat("wrong", acc.n ? int(acc.wwrong) + " · " + int(acc.swrong) + rev : "–");
  }

  // ---------- the loop ----------
  let statTimer = 0;
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    if (round) stepRound(dt);
    sayHeld();
    statTimer += dt; if (statTimer > 0.25) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  pause.bind(loop);

  function restart() {
    runSeed = seed; seed = (seed * 7 + 3) % 9973 + 1;
    idx = 0; resetCounts(); paintCounts();
    startRound(); showStats();
  }
  function controlsFor() {
    const count = cfg.task === "count";
    const why = L("Counting always has 8 options, 0 to 7+, and every order's lines are on it", "Contar siempre tiene 8 opciones, de 0 a 7+, y todas las líneas del pedido cuentan");
    root.disable("options", count, why);
    root.disable("unlisted", count, why);
  }
  function set(name, raw, quiet) {
    root.press(name, raw);
    cfg[name] = name === "speed" ? Number(raw) : String(raw);
    if (name === "speed") return;
    controlsFor();
    if (!quiet) { restart(); say(9, T("settings applied · run restarted", "ajustes aplicados · ejecución reiniciada")); }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };

  // Send 1,000 tickets: the same model, all at once; the counts and percentiles take them in.
  function burst(n = 1000, quiet = false) {
    const c = modelCfg();
    for (let i = 0; i < n; i++) count(makeTicket(c, runSeed, idx++));
    paintCounts(); showStats();
    if (!quiet) say(6, T(int(n) + " tickets through both desks · p99: writing desk " + msOrSecs(rankQuantile(acc.w, 0.99)) + ", sorting desk " + msOrSecs(rankQuantile(acc.s, 0.99)),
      int(n) + " tickets por las dos mesas · p99: mesa de escritura " + msOrSecs(rankQuantile(acc.w, 0.99)) + ", mesa de clasificación " + msOrSecs(rankQuantile(acc.s, 0.99))));
  }
  const actions = {
    burst: () => { burst(); wake(); },
    reset: () => { restart(); say(9, T("started over", "empezó de nuevo")); wake(); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": the experiment's settings, 1,000 tickets at once, then a ticket that
  // shows the outcome, found by running the same seed ahead ----------
  const FIND = {
    rejected: (tk) => !!tk.write.tries[0].bad && !tk.write.gaveUp,
    offwrong: (tk) => tk.t.off && tk.sort.wrong && tk.sort.conf >= CONFIDENT,
    countwrong: (tk) => tk.sort.wrong && !tk.write.wrong && tk.t.n >= 8,
  };
  root.on("watch", (w) => {
    for (const key of ["task", "options", "unlisted", "format", "output", "questions"]) if (w[key] !== undefined) set(key, w[key], true);
    set("speed", w.speed ?? 0.5, true);
    restart();
    burst(1000, true);
    if (w.find && FIND[w.find]) {
      const c = modelCfg();
      for (let i = idx; i < idx + 4000; i++) if (FIND[w.find](makeTicket(c, runSeed, i))) { idx = i; break; }
    }
    startRound();
    wake();
  });

  loop.setPaused(loop.paused);
  controlsFor();
  restart();
}

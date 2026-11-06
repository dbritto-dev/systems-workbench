// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The peg board in the browser: runs the filter one operation at a time (add, look up, delete), flies the key card
// from the feed to the reader, threads it to the pegs its hashes pick, lights the answer, raises or lowers pegs when
// the model commits a change, and carries the card on to the archive and the trays. Lit is the current key's check
// only: its pegs, threads and the board's answer; a wrong NO gets a pennant on its card in the tray instead. mount() gets the build-time data
// from page.ts (projection, geometry, the card drawing) and root, the <wb-lesson>.
import { translateAlong, iso } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, setLit, playPause } from "../../runtime/dom";
import { lerp, smoothstep } from "../../lib/tween";
import { clamp } from "../../lib/stats";
import { makeLive, formula, ratePct, M_LIVE } from "./sim";

// Moments within an operation, in machine seconds (each operation's length is DUR in sim.ts).
const AT = {
  look: { in: 0.3, probe: 0.3, verdict: 0.62, out: 0.75, land: 1.05 },
  maybe: { in: 0.3, probe: 0.3, verdict: 0.62, out: 0.8, inbox: 1.3, found: 1.4, back: 1.6, land: 1.95 },
  add: { in: 0.3, probe: 0.3, commit: 0.62, out: 0.75, inbox: 1.2 },
  del: { in: 0.4, probe: 0.4, commit: 0.72, out: 0.9, gone: 1.15 },
};
const PROBE_LEN = 0.3;

export default function mount({ P, G, CARD_SVG, RING_SVG, SPINDLE_SVG, MORE_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const stat = (key, value) => root.stat(key, value);
  const boardG = q("[data-board]");
  const pegs = G.PEG_XY.map((_, i) => ({ g: q('[data-peg="' + i + '"]'), hole: q('[data-hole="' + i + '"]'), pin: q('[data-pin="' + i + '"]'), rings: null, more: null, n: -1, lit: null }));
  // the counting filter's rings: built the first time it's chosen, one spindle, RING.max rings and a "+N" tag per peg
  function buildRings() {
    if (pegs[0].rings) return;
    pegs.forEach((p, i) => {
      const [x, y] = G.PEG_XY[i];
      const set = document.createElementNS(NS, "g");
      set.setAttribute("data-ringset", "");
      let html = '<g transform="' + translateAlong(P, [x, y, 0]) + '">' + SPINDLE_SVG + "</g>";
      for (let j = 0; j < G.RING.max; j++) html += '<g class="wb-lit-group" data-ring style="display:none" transform="' + translateAlong(P, [x, y, j * G.RING.pitch]) + '">' + RING_SVG + "</g>";
      html += '<g data-more style="display:none" transform="' + translateAlong(P, [x, y, 0]) + '">' + MORE_SVG + "</g>";
      set.innerHTML = html;
      p.g.appendChild(set);
      p.rings = [...set.querySelectorAll("[data-ring]")];
      const more = set.querySelector("[data-more]");
      p.more = { g: more, txt: more.querySelector("[data-more-text]") };
    });
  }
  const signs = { no: q('[data-sign="no"]'), maybe: q('[data-sign="maybe"]') };
  // the trays: the latest cards lie in a row, newest on the left; a stored key the board said NO to has a pennant
  const rest = Object.fromEntries(["no", "found", "fp"].map((n) => [n, { list: [], slots: G.TRAY_SLOTS[n].map((_, j) => {
    const g = q('[data-rest="' + n + "-" + j + '"]');
    return { g, txt: g.querySelector("[data-rest-text]"), flag: g.querySelector("[data-flag]") };
  }) }]));
  function paintTray(name) {
    const r = rest[name];
    r.slots.forEach((sl, j) => {
      const c = r.list[j];
      show(sl.g, !!c);
      if (c) { setText(sl.txt, String(c.key)); if (sl.flag) show(sl.flag, c.wrong); }
    });
  }
  const counters = Object.fromEntries(["keys", "up", "fn", "hashes", "no", "found", "fp"].map((n) => [n, WB.counter(svg, n, P)]));

  // the flying card
  const fly = q('[data-layer="fly"]');
  const card = document.createElementNS(NS, "g");
  card.innerHTML = CARD_SVG;
  fly.appendChild(card);
  const cardTxt = card.querySelector("[data-card-text]");
  card.style.display = "none";

  // threads from the card to the pegs: one path per hash
  const threadsG = q("[data-threads]");
  const threads = Array.from({ length: 20 }, () => {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("class", "bloom-thread");
    p.setAttribute("pathLength", "1");
    p.setAttribute("stroke-dasharray", "1 1");
    p.style.display = "none";
    threadsG.appendChild(p);
    return p;
  });

  const cfg = { bpk: 5, k: 3, keys: "planned", deletes: "none", speed: 1 };
  let model, op, opT, shown, seed = 7, said = null;

  // ---------- pegs ----------
  const mode = () => (cfg.deletes === "count" ? "count" : "plain");
  function paintPeg(i, n, lit) {
    const p = pegs[i];
    if (p.n === n && p.lit === lit) return;
    p.n = n; p.lit = lit;
    show(p.hole, !!(lit && n === 0));
    if (mode() === "plain") { show(p.pin, n > 0); setLit(p.pin, lit && n > 0); }
    else {
      p.rings.forEach((r, j) => { show(r, n > j); setLit(r, lit && n > j); });
      show(p.more.g, n > G.RING.max);
      if (n > G.RING.max) setText(p.more.txt, "+" + (n - G.RING.max));
    }
  }
  function pegTop(i, n) {
    const [x, y] = G.PEG_XY[i];
    const z = G.BOARD_H + 0.3 + (n === 0 ? 0.3 : mode() === "plain" ? G.PIN.h : Math.min(n, G.RING.max) * G.RING.pitch);
    return [x, y, z];
  }

  function restart() {
    model = makeLive({ bpk: cfg.bpk, k: cfg.k, keys: cfg.keys, deletes: cfg.deletes }, seed);
    seed = (seed * 7 + 3) % 9973 + 1;
    model.prefill(model.target - 2);
    if (mode() === "count") buildRings();
    boardG.setAttribute("data-mode", mode());
    pegs.forEach((p) => { p.n = -1; p.lit = null; });
    for (const n in rest) { rest[n].list = []; paintTray(n); }
    shown = model.snapshot();
    op = model.next(); opT = 0; said = null;
    counters.hashes.set(cfg.k);
    paint();
    showStats();
  }

  // ---------- where things are during an operation ----------
  const arc = (a, b, u, h) => { const s = smoothstep(u); return [lerp(a[0], b[0], s), lerp(a[1], b[1], s), lerp(a[2], b[2], s) + h * 4 * s * (1 - s)]; };
  const kind = (o) => (o.type === "look" ? (o.maybe ? "maybe" : "look") : o.type);
  const tray = (o) => (o.maybe ? (o.inArchive ? "found" : "fp") : "no");
  /** The card's place and opacity at time s into op o, or null when it isn't shown. */
  // The climb between the reader and the archive's inbox: across low, then up the archive's bare left end, so the card
  // never passes in front of a counter or a caption.
  // Going up, the card first slides right (away from the verdict board), then back, then rises; coming down, the reverse.
  const climb = (a, b, u) => {
    const up = a[2] < b[2], v = smoothstep(u);
    const fx = up ? 1 - (1 - v) ** 2 : v ** 2, fy = up ? v ** 2 : 1 - (1 - v) ** 2, fz = up ? v ** 2.5 : 1 - (1 - v) ** 2.5;
    return [lerp(a[0], b[0], fx), lerp(a[1], b[1], fy), lerp(a[2], b[2], fz)];
  };
  function cardAt(o, s) {
    const a = AT[kind(o)], R = G.READ_SPOT, I = G.INBOX_SPOT;
    const fadeIn = (t0, t1) => ({ p: [R[0], R[1], R[2] + 2 * (1 - clamp((s - t0) / (t1 - t0)))], o: clamp((s - t0) / (t1 - t0)) });
    if (o.type === "del") {
      if (s < a.in) return { p: climb(I, R, s / a.in), o: 1 };
      if (s < a.out) return { p: R, o: 1 };
      return s < a.gone ? { p: R, o: 1 - (s - a.out) / (a.gone - a.out) } : null;
    }
    if (s < a.in) return fadeIn(0, a.in);
    if (s < a.out) return { p: R, o: 1 };
    if (o.type === "add") return s < a.inbox ? { p: climb(R, I, (s - a.out) / (a.inbox - a.out)), o: 1 - 0.8 * clamp(((s - a.out) / (a.inbox - a.out) - 0.7) / 0.3) } : null;
    const T0 = G.TRAY_SPOT[tray(o)];
    const up = [T0[0], T0[1], T0[2] + 0.4];
    if (!o.maybe) return s < a.land ? { p: arc(R, [up[0], up[1], up[2]], (s - a.out) / (a.land - a.out), 5), o: 1 } : null;
    if (s < a.inbox) return { p: climb(R, I, (s - a.out) / (a.inbox - a.out)), o: 1 };
    if (s < a.back) return { p: I, o: 1 };
    return s < a.land ? { p: arc(I, up, (s - a.back) / (a.land - a.back), 6), o: 1 } : null;
  }

  // ---------- narration (short: three lines at most on a phone) ----------
  // Counts are of distinct pegs: two hashes can pick the same one.
  const n1 = (k, en, es) => (k === 1 ? T("1 peg " + en, "1 clavija " + es) : T(k + " pegs " + en, k + " clavijas " + es));
  function line(o, s) {
    const a = AT[kind(o)], key = "#" + o.key, k = o.distinct;
    // before the outcome: what the machine is doing with this card, from the moment it appears
    const pk = n1(k, "", ""), its = k === 1 ? T("its peg", "su clavija") : T("its " + k + " pegs", "sus " + k + " clavijas");
    if (o.type === "add") {
      if (s < a.commit) return T(key + " · adding · its hashes pick " + pk.en.trim(), key + " · se agrega · sus hashes eligen " + pk.es.trim());
      const what = mode() === "count" ? T("a ring on each of " + n1(k, "", "").en.trim(), "un anillo en " + n1(k, "", "").es.trim()) : n1(k, "up", "arriba");
      return T(key + " added · " + what.en + " · card to the archive", key + " agregada · " + what.es + " · tarjeta al archivo");
    }
    if (o.type === "del") {
      if (s < a.commit) return T(key + " · deleting · its hashes pick " + pk.en.trim(), key + " · se borra · sus hashes eligen " + pk.es.trim());
      if (mode() === "count") return T(key + " deleted · a ring off each of " + n1(k, "", "").en.trim(), key + " borrada · un anillo menos en " + n1(k, "", "").es.trim());
      return T(key + " deleted · " + n1(k, "pulled down", "").en + ", shared or not", key + " borrada · " + n1(k, "abajo", "abajo").es + (k === 1 ? ", compartida o no" : ", compartidas o no"));
    }
    if (s < a.verdict) return T(key + " · lookup · checking " + its.en, key + " · búsqueda · revisa " + its.es);
    if (!o.maybe) {
      const down = k === 1 ? T("its peg is down", "su clavija está abajo") : T(o.down + " of its " + k + " pegs are down", o.down + " de sus " + k + " clavijas están abajo");
      if (o.fn) return T(key + " is stored, but " + down.en + " · NO · a false negative", key + " está guardada, pero " + down.es + " · NO · falso negativo");
      return k === 1 ? T(key + " · its peg is down · NO · no trip to the archive", key + " · su clavija está abajo · NO · sin viaje al archivo")
        : T(key + " · " + o.down + " of " + k + " pegs down · NO · no trip to the archive", key + " · " + o.down + " de " + k + " clavijas abajo · NO · sin viaje al archivo");
    }
    const all = k === 1 ? T("its peg is up", "su clavija arriba") : T("all " + k + " pegs up", "las " + k + " arriba");
    if (s < AT.maybe.found) return T(key + " · " + all.en + " · MAYBE · to the archive", key + " · " + all.es + " · QUIZÁS · al archivo");
    if (o.inArchive) return T(key + " · " + all.en + " · MAYBE · found in the archive", key + " · " + all.es + " · QUIZÁS · está en el archivo");
    return T(key + " · " + all.en + ", by other keys · MAYBE · not there: a false positive", key + " · " + all.es + " por otras claves · QUIZÁS · no está: falso positivo");
  }

  // ---------- painting ----------
  function paint() {
    const o = op, s = opT, a = AT[kind(o)];
    const commitAt = a.commit ?? Infinity;
    const probing = s >= a.probe;
    // pegs: this operation's pegs show their old count until the change commits
    const old = new Map();
    if (s < commitAt) o.pos.forEach((p, j) => { if (!old.has(p)) old.set(p, o.before[j]); });
    const mine = new Set(o.pos);
    const counts = model.f.counts;
    for (let i = 0; i < M_LIVE; i++) paintPeg(i, old.has(i) ? old.get(i) : counts[i], probing && mine.has(i));
    // threads, while the card is on the reader
    const onReader = s >= a.in && s < a.out;
    const grow = clamp((s - a.probe) / PROBE_LEN);
    const R = G.READ_SPOT, from = iso([R[0], R[1], R[2] + G.CARD.h], P);
    threads.forEach((th, j) => {
      const on = onReader && probing && j < o.pos.length;
      show(th, on);
      if (!on) return;
      const i = o.pos[j], to = iso(pegTop(i, old.has(i) ? old.get(i) : counts[i]), P);
      const mx = (from[0] + to[0]) / 2, my = (from[1] + to[1]) / 2 - 3;
      th.setAttribute("d", "M" + from[0].toFixed(1) + " " + from[1].toFixed(1) + "Q" + mx.toFixed(1) + " " + my.toFixed(1) + " " + to[0].toFixed(1) + " " + to[1].toFixed(1));
      th.setAttribute("stroke-dashoffset", String(1 - grow));
    });
    // the answer
    const verdict = o.type === "look" && s >= a.verdict;
    setLit(signs.no, !!(verdict && !o.maybe));
    setLit(signs.maybe, !!(verdict && o.maybe));
    // the card
    const c = cardAt(o, s);
    show(card, !!c);
    if (c) {
      setText(cardTxt, (o.type === "add" ? "+" : o.type === "del" ? "−" : "") + o.key);
      card.setAttribute("transform", translateAlong(P, c.p));
      card.style.opacity = c.o < 1 ? String(Math.max(0, c.o)) : "";
    }
    // stats and counters change when the machine shows the outcome
    const statAt = o.type === "look" ? (o.maybe ? AT.maybe.found : a.verdict) : commitAt;
    const st = s >= statAt ? o.st : shown;
    counters.keys.setClamped(st.keys); counters.up.setClamped(st.up); counters.fn.setClamped(st.fn);
    counters.no.setClamped(st.saidNo); counters.found.setClamped(st.found); counters.fp.setClamped(st.fp);
    const text = line(o, s);
    if (text && L(text) !== said) { said = L(text); root.figure.say(said); }
  }
  // An operation ends: its card lands in its tray (and stays there until the next one lands in the same tray).
  function finish(o) {
    shown = o.st;
    if (o.type !== "look") return;
    const name = tray(o), r = rest[name];
    r.list.unshift({ key: o.key, wrong: !!o.fn });
    r.list.length = Math.min(r.list.length, r.slots.length);
    paintTray(name);
  }

  function showStats() {
    const st = shown, k = cfg.k;
    stat("keys", st.keys);
    stat("up", L(st.up + " of " + M_LIVE, st.up + " de " + M_LIVE));
    stat("no", st.saidNo);
    stat("fp", st.absent ? L(st.fp + " of " + st.absent, st.fp + " de " + st.absent) + " · " + ratePct(st.fp / st.absent) : "0");
    stat("pred", ratePct(formula(k, st.keys, M_LIVE)));
    stat("fn", st.fn);
  }

  // ---------- the loop ----------
  let statTimer = 0;
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    opT += dt * cfg.speed;
    while (opT >= op.dur) { opT -= op.dur; finish(op); op = model.next(); said = null; }
    paint();
    statTimer += dt; if (statTimer > 0.2) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = name === "bpk" || name === "k" ? Number(raw) : String(raw);
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  // A button's operation starts at once: the one on the machine is cut short, its card straight to its tray.
  function now(what) {
    model.force(what);
    finish(op); op = model.next(); opT = 0; said = null;
    paint(); showStats(); wake();
  }
  const actions = { add: () => now("add"), check: () => now("look"), reset: () => restart() };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const key of ["bpk", "k", "keys", "deletes"]) set(key, w[key], true);
    if (w.speed) set("speed", w.speed);
    restart();
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

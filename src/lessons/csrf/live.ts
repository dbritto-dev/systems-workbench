// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The bank street in the browser: runs the model in slow motion, walks a courier out of each page's door, past the
// cookie jar (where it picks up the customer's card when the cookie rule allows), to the bank's gates and window.
// A gate that refuses drops its arm and lights its lamp; the teller holds up a slip while it pays. mount() gets the
// build-time data from page.ts (projection, geometry, the courier drawing) and root, the <wb-lesson>.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, setLit, playPause } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { clamp } from "../../lib/stats";
import { pointAlong, polylineLength } from "../../lib/geometry";
import { makeSim, KINDS, REL } from "./sim";

// Walking pace (world units per machine second) and the moments of one errand, in machine seconds: the walk out
// takes as long as its path, the courier waits DWELL at its stop, then a refused one steps back and fades (BACK) and
// a served one fades at the window (LINGER).
const PACE = 40, DWELL = 0.9, BACK = 0.8, STEP_BACK = 10, LINGER = 0.5;

export default function mount({ P, G, COURIER_SVG, CARD_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const flyLayer = q('[data-layer="fly"]'), roadLayer = q('[data-layer="road"]');
  const teller = { idle: q('[data-teller="idle"]'), paying: q('[data-teller="paying"]') };
  const gateX = Object.fromEntries(G.GATES.map((g) => [g.key, g.x]));
  const gates = Object.fromEntries(G.GATES.map((g) => [g.key, {
    armClosed: q(`[data-gate="${g.key}"] [data-arm="closed"]`), armOpen: q(`[data-gate="${g.key}"] [data-arm="open"]`),
    lampOn: q(`[data-gate-lamp="${g.key}"][data-lamp="on"]`), lampOff: q(`[data-gate-lamp="${g.key}"][data-lamp="off"]`),
  }]));
  const modeText = q("[data-mode]");
  const getpay = { on: q('[data-getpay="on"]'), off: q('[data-getpay="off"]') };
  const stateGroup = (gate) => svg.querySelectorAll(`[data-state-${gate}]`);
  const counters = Object.fromEntries(["paid", "blocked", "signedout"].map((n) => [n, WB.counter(svg, n, P)]));

  // stop → where on the road the courier halts (a gate's x, or the window)
  const stopX = (r) => (r.stop === "teller" || r.stop === null ? G.WINDOW_X : gateX[r.stop]);
  const DOOR = (r) => G.DOOR[KINDS[r.kind].from];
  const outPath = (r) => { const d = DOOR(r); return [[d[0], d[1]], [d[0], G.ROAD_Y], [stopX(r), G.ROAD_Y]]; };
  const OUT = (r) => (r.out ??= polylineLength(outPath(r)) / PACE);
  const DUR = (r) => OUT(r) + DWELL + (r.stop ? BACK : LINGER);

  // ---------- pooled courier elements ----------
  const free = [], recs = new Map();
  function makeEl() {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = COURIER_SVG;
    return { g, card: g.querySelector("[data-card]"), flag: g.querySelector("[data-flag]"), method: g.querySelector("[data-method]"), shownCard: null, shownMethod: null, shownFlag: null };
  }
  // flying cards from the jar to a courier
  const flights = [];
  function flyCard(to) {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = CARD_SVG;
    flyLayer.appendChild(g);
    flights.push({ g, born: clock, to });
  }

  function where(r, now) {
    const out = outPath(r), sx = stopX(r), u = now - r.t, o = OUT(r);
    if (u < o) return pointAlong(out, polylineLength(out) * clamp(u / o));
    if (u < o + DWELL || !r.stop) return [sx, G.ROAD_Y];
    return [sx - STEP_BACK * clamp((u - o - DWELL) / BACK), G.ROAD_Y];
  }
  // the courier has the card once it has walked past the jar (card requests only)
  const pastJar = (r, now) => r.card && where(r, now)[0] >= G.JAR_X - 0.5;

  // ---------- settings and the run ----------
  const cfg = { samesite: "lax", token: "off", origin: "off", getpay: "on", errand: "mix", speed: 1 };
  let model, clock, from, seed = 5;
  // what the machine shows: an errand counts when its courier reaches its stop, not when the model decides it
  let tally, counted;
  const count = (r) => {
    if (counted.has(r.id)) return;
    counted.add(r.id);
    if (r.outcome === "paid" || r.outcome === "blocked" || r.outcome === "ok" || r.outcome === "signedout") tally[r.outcome]++;
    narrate(r);
  };

  function restart() {
    for (const r of recs.values()) { r.el.g.remove(); free.push(r.el); }
    recs.clear();
    for (const f of flights.splice(0)) f.g.remove();
    model = makeSim({ samesite: cfg.samesite, token: cfg.token, origin: cfg.origin, getPay: cfg.getpay === "on", errand: cfg.errand }, seed);
    seed = (seed * 7 + 3) % 9973 + 1;
    clock = 0; from = 0;
    tally = { sent: 0, paid: 0, blocked: 0, ok: 0, signedout: 0 }; counted = new Set();
    paintStatic();
    paint(true);
    showStats();
    root.figure.say(L(T("SameSite=" + cap(cfg.samesite) + " · token " + tokenWord[cfg.token].en + " · origin check " + originWord[cfg.origin].en + " · errands on their way",
      "SameSite=" + cap(cfg.samesite) + " · token " + tokenWord[cfg.token].es + " · comprobación de origen " + originWord[cfg.origin].es + " · encargos en camino")));
  }
  const cap = (x) => x[0].toUpperCase() + x.slice(1);
  const tokenWord = { off: T("off", "apagado"), copy: T("cookie copy", "copia en cookie"), session: T("session", "de sesión") };
  const originWord = { off: T("off", "apagada"), site: T("same site", "mismo sitio"), origin: T("same origin", "mismo origen") };

  // ---------- static readouts that follow the controls ----------
  function paintStatic() {
    setText(modeText, "SAMESITE=" + cfg.samesite.toUpperCase());
    show(getpay.on, cfg.getpay === "on"); show(getpay.off, cfg.getpay !== "on");
    for (const gate of ["origin", "token"]) stateGroup(gate).forEach((el) => show(el, el.getAttribute(`data-state-${gate}`) === cfg[gate]));
  }

  // ---------- narration ----------
  const relWord = (rel) => (rel === "cross-site" ? T("cross-site", "de otro sitio") : rel === "same-site" ? T("same-site", "del mismo sitio") : T("same-origin", "del mismo origen"));
  const gateName = { card: T("no card: SameSite kept the cookie back", "sin tarjeta: SameSite retuvo la cookie"), origin: T("origin check refused it", "la comprobación de origen la rechazó"), token: T("no valid token", "sin token válido"), teller: T("no GET endpoint to pay", "no hay endpoint GET para pagar") };
  function narrate(r) {
    const k = KINDS[r.kind], from = k.from === "bank" ? "www.bank.example" : k.from === "forum" ? "forum.bank.example" : "other.example";
    if (!k.forged) {
      if (r.outcome === "signedout") root.figure.say(L(T("you followed a link in · arrived signed out", "seguiste un enlace · llegaste sin sesión")));
      else root.figure.say(L(r.kind === "visit" ? T("you followed a link to the bank · signed in", "seguiste un enlace al banco · con sesión") : T("your transfer from the bank's page · paid", "tu transferencia desde la página del banco · pagada")));
      return;
    }
    const head = L(T(from + " · " + k.method + " /pay", from + " · " + k.method + " /pay"));
    if (r.outcome === "paid") root.figure.say(head + L(T(" · forged payment made", " · pago falso hecho")));
    else root.figure.say(head + " · " + L(gateName[r.stop]));
  }

  // ---------- painting ----------
  function paint(snap) {
    const reqs = model.reqs;
    // retire finished couriers
    while (from < reqs.length && reqs[from].t + DUR(reqs[from]) + 0.01 < clock) {
      const r = reqs[from];
      count(r);
      if (recs.has(r.id)) { recs.get(r.id).el.g.remove(); free.push(recs.get(r.id).el); recs.delete(r.id); }
      from++;
    }
    const activeGate = { card: false, origin: false, token: false };
    let tellerOn = false;
    const live = [];
    for (let i = from; i < reqs.length; i++) {
      const r = reqs[i];
      if (r.t > clock) break;
      const u = clock - r.t;
      if (u > DUR(r)) { if (recs.has(r.id)) { recs.get(r.id).el.g.remove(); free.push(recs.get(r.id).el); recs.delete(r.id); } continue; }
      let x = recs.get(r.id);
      if (!x) {
        x = { el: free.pop() || makeEl(), flew: false };
        recs.set(r.id, x); roadLayer.appendChild(x.el.g);
      }
      const method = KINDS[r.kind].method;
      if (x.el.shownMethod !== method) { x.el.shownMethod = method; setText(x.el.method, method); }
      const forged = KINDS[r.kind].forged;
      if (x.el.shownFlag !== forged) { x.el.shownFlag = forged; show(x.el.flag, forged); }
      const hasCard = pastJar(r, clock);
      if (x.el.shownCard !== hasCard) { x.el.shownCard = hasCard; show(x.el.card, hasCard); }
      // a card flies from the jar the moment the courier reaches it
      if (!x.flew && hasCard && !snap) { x.flew = true; flyCard(r.id); }
      const [px, py] = where(r, clock);
      // at the stop during the dwell: light the gate or the teller
      if (u >= OUT(r)) count(r);
      const atStop = u >= OUT(r) && u < OUT(r) + DWELL;
      if (atStop) {
        if (r.stop && r.stop !== "teller") activeGate[r.stop] = true;
        if (KINDS[r.kind].pay && (r.outcome === "paid" || r.outcome === "ok")) tellerOn = true;
      }
      const fade = u < 0.2 ? u / 0.2 : u > OUT(r) + DWELL ? clamp((DUR(r) - u) / (r.stop ? BACK : LINGER)) : 1;
      x.el.g.style.opacity = fade < 1 ? String(clamp(fade)) : "";
      x.pos = [px, py, G.ROAD_H];
      x.el.g.setAttribute("transform", translateAlong(P, x.pos));
      live.push(x);
    }
    // painter's order: far first
    const sorted = live.sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P));
    const kids = [...roadLayer.children];
    if (sorted.some((x, i) => x.el.g !== kids[i])) sorted.forEach((x) => roadLayer.appendChild(x.el.g));

    // gates and teller
    for (const key of ["card", "origin", "token"]) {
      const g = gates[key], on = activeGate[key];
      show(g.armClosed, on); show(g.armOpen, !on);
      show(g.lampOn, on); show(g.lampOff, !on);
    }
    show(teller.paying, tellerOn); show(teller.idle, !tellerOn);

    // flying cards: jar → courier
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i], rec = recs.get(f.to), u = (clock - f.born) / 0.22;
      if (u >= 1 || snap || !rec) { f.g.remove(); flights.splice(i, 1); continue; }
      const kf = clamp(u), tp = rec.pos || [G.JAR.x, G.ROAD_Y, G.ROAD_H];
      const p = [lerp(G.JAR.x, tp[0], kf), lerp(G.JAR.y, tp[1], kf), lerp(G.JAR.z + G.JAR.h * 0.5, 4, kf) + 5 * Math.sin(Math.PI * kf)];
      f.g.setAttribute("transform", translateAlong(P, p));
    }

    counters.paid.setClamped(tally.paid);
    counters.blocked.setClamped(tally.blocked);
    counters.signedout.setClamped(tally.signedout);
  }

  function showStats() {
    const st = tally;
    root.stat("sent", model.st.sent);
    root.stat("paid", st.paid);
    root.stat("blocked", st.blocked);
    root.stat("ok", st.ok);
    root.stat("signedout", st.signedout);
  }

  // ---------- the loop ----------
  let statTimer = 0;
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    clock += dt * cfg.speed;
    model.runTo(clock);
    paint(false);
    statTimer += dt; if (statTimer > 0.2) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = String(raw);
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    forge: () => { model.forge(clock); paint(false); showStats(); wake(); },
    visit: () => { model.visit(clock); paint(false); showStats(); wake(); },
    reset: () => restart(),
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine" ----------
  // The experiment's settings, plus the errands it is about sent at once (kick), so the outcome shows within seconds.
  root.on("watch", (w) => {
    for (const key of ["samesite", "token", "origin", "getpay", "errand"]) set(key, w[key], true);
    restart();
    for (const what of w.kick || []) what === "visit" ? model.visit(0) : model.forge(0, what);
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

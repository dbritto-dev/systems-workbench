// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The festival gate in the browser: runs the model one round at a time (log in, theft, revocation, until the thief is
// locked out), walks the user and the thief along their lanes, through the box office and the gate, works the arms,
// lamps, lookups and the deny list, and answers the controls. mount() gets the build-time data from page.ts
// (projection, geometry, drawings) and root, the <wb-lesson>.
import { translateAlong, iso } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, setLit, playPause } from "../../runtime/dom";
import { lerp, easeInOutQuad as ease } from "../../lib/tween";
import { clamp } from "../../lib/stats";
import { pointAlong, polylineLength } from "../../lib/geometry";
import { rngMixed } from "../../lib/random";
import { makeFestival, WALK, hhmm } from "./sim";

export default function mount({ P, G, USER_SVG, THIEF_SVG, DENY_CARD_SVG, FLY_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const stat = (key, value) => root.stat(key, value);
  const NS = "http://www.w3.org/2000/svg";
  const layers = { back: q('[data-layer="back"]'), front: q('[data-layer="front"]'), fly: q('[data-layer="fly"]') };
  const denyCards = q("[data-deny-cards]"), pulseLayer = q("[data-pulse-layer]");
  const C = Object.fromEntries(["refreshes", "logins", "after", "win", "winT", "lookups", "ver", "hh", "mm"].map((n) => [n, WB.counter(svg, n, P)]));
  const lamps = {};
  for (const name of ["deny", "ver", "office"]) lamps[name] = { on: q(`[data-lamp-${name}="on"]`), off: q(`[data-lamp-${name}="off"]`) };
  const scan = {}, arms = {};
  for (const who of ["user", "thief"]) {
    scan[who] = { on: q(`[data-scan-on="${who}"]`), off: q(`[data-scan="${who}"]`) };
    arms[who] = { closed: q(`[data-arm="${who}"]`), open: q(`[data-arm-open="${who}"]`) };
  }
  const lampSet = (l, on) => { show(l.on, on); show(l.off, !on); };

  // ---------- the two walkers ----------
  function makeWalker(markup) {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = markup;
    return { g, band: g.querySelector("[data-band]"), id: g.querySelector("[data-band-id]"), exp: g.querySelector("[data-band-exp]"), pass: g.querySelector("[data-pass]"), passId: g.querySelector("[data-pass-id]"), layer: null, shown: {} };
  }
  const W = { user: makeWalker(USER_SVG), thief: makeWalker(THIEF_SVG) };
  setLit(W.thief.band, true); setLit(W.thief.pass, true);
  function dress(w, band, pass, ver) {
    const s = w.shown;
    show(w.band, !!band); show(w.pass, !!pass);
    const idText = band ? "#" + band.id + (ver ? " v" + band.ver : "") : "";
    if (s.id !== idText) { s.id = idText; setText(w.id, idText); }
    const expText = band ? hhmm(band.exp) : "";
    if (s.exp !== expText) { s.exp = expText; setText(w.exp, expText); }
    const pText = pass ? "P" + pass.id : "";
    if (s.p !== pText) { s.p = pText; setText(w.passId, pText); }
  }
  function place(w, pos, alpha) {
    const layer = pos[1] < G.GATE_Y ? layers.back : layers.front;
    if (w.layer !== layer) { w.layer = layer; layer.appendChild(w.g); }
    w.g.setAttribute("transform", translateAlong(P, [pos[0], pos[1], 0]));
    const o = alpha >= 1 ? "" : String(Math.max(0, alpha));
    if (w.g.style.opacity !== o) w.g.style.opacity = o;
    show(w.g, alpha > 0);
  }

  // ---------- settings and the round ----------
  const cfg = { ttl: 60, refresh: "rotate", check: "stamp", steal: "band", revoke: "logout", speed: 1 };
  let model, clock, logAt, seed = 3, endAt, said = -9, deny = new Map(), pulses = [];
  const round = rngMixed(91);

  // over: a Watch's staging (seed, theft and revocation times, and a warm-up the clock jumps to)
  function restart(over = {}) {
    for (const c of [...denyCards.children]) c.remove();
    for (const p of pulses) p.g.remove();
    for (const k of [...pulseMap.keys()]) pulseMap.delete(k);
    pulses = []; deny = new Map();
    const theftAt = over.theftAt ?? 6 + 10 * round(), revokeAfter = over.revokeAfter ?? 5 + 6 * round();
    if (over.seed) seed = over.seed;
    model = makeFestival({ ttl: cfg.ttl, refresh: cfg.refresh, check: cfg.check, steal: cfg.steal, revoke: cfg.revoke, theftAt, revokeAfter }, seed);
    seed = (seed * 31 + 7) % 9973 + 1;
    clock = 0; logAt = 0; endAt = Infinity; keyAt = -1e9;
    const b = model.user.band;
    say(T("new round · the user logs in · wristband #" + b.id + " until " + hhmm(b.exp), "ronda nueva · el usuario inicia sesión · pulsera #" + b.id + " hasta las " + hhmm(b.exp)));
    if (over.warm) { clock = over.warm; model.runTo(clock); }
    paint();
    showStats();
  }

  // ---------- narration ----------
  // routine news (the user's refreshes and logins, the user walking in) waits until an event that matters has been
  // up for eight seconds, so a Watch's outcome stays on the readout
  let keyAt = -1e9;
  const say = (v) => { root.figure.say(L(v)); said = clock; keyAt = clock; };
  const sayRoutine = (v) => { if (clock - keyAt < 8 * cfg.speed) return; root.figure.say(L(v)); said = clock; };
  // the window as the stat and the counter show it: minutes, rounded to a tenth
  const tenths = (x) => Math.round(x * 10) / 10;
  const whyText = { expired: T("expired", "vencida"), denied: T("on the deny list", "en la lista de bloqueo"), version: T("old token version", "versión vieja del token") };
  function narrate() {
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt];
      if (e.t > clock) break;
      const id = e.band ? "#" + e.band.id : "";
      switch (e.type) {
        case "login": if (e.t > 0) (e.forced ? say : sayRoutine)(e.forced ? T("pass refused · the user has to log in again · " + id, "pase rechazado · el usuario vuelve a iniciar sesión · " + id) : T("wristband ran out, no pass · log in again · " + id, "la pulsera venció, sin pase · nuevo inicio de sesión · " + id)); break;
        case "refresh": (e.who === "thief" ? say : sayRoutine)(e.who === "thief" ? T("the thief refreshes with the copied pass · new wristband " + id, "el ladrón renueva con el pase copiado · pulsera nueva " + id) : T("wristband ran out · refreshed at the box office · " + id, "la pulsera venció · renovada en la taquilla · " + id)); break;
        case "reuse": {
          const next = model.log[logAt + 1];
          const relog = next && next.type === "login" && next.t === e.t;
          if (relog) logAt++;
          say(e.who === "thief"
            ? T("the thief shows a retired pass · reuse detected · the family is revoked", "el ladrón muestra un pase retirado · reúso detectado · se revoca la familia")
            : relog ? T("the user's pass was already spent · reuse · family revoked · log in again", "el pase del usuario ya se usó · reúso · familia revocada · nuevo inicio de sesión")
            : T("a retired pass came back · reuse detected · the family is revoked", "volvió un pase retirado · reúso detectado · se revoca la familia"));
          break;
        }
        case "theft": say(e.pass ? T("the thief copies wristband " + id + " and the refresh pass", "el ladrón copia la pulsera " + id + " y el pase de renovación") : T("the thief copies wristband " + id + ", valid until " + hhmm(e.band.exp), "el ladrón copia la pulsera " + id + ", válida hasta las " + hhmm(e.band.exp))); break;
        case "revoke": {
          const what = e.how === "reset" ? T("password changed · every pass revoked", "contraseña cambiada · todos los pases revocados") : T("the user logs out · their pass revoked", "el usuario cierra sesión · su pase revocado");
          const extra = e.denied ? T(" · " + id + " on the deny list", " · " + id + " en la lista de bloqueo")
            : model.cfg.check === "version" ? T(" · version now " + e.ver, " · versión ahora " + e.ver)
            : model.cfg.check === "deny" ? T(" · nothing goes on the deny list", " · nada entra en la lista de bloqueo")
            : T(" · the gate keeps no list", " · la entrada no guarda ninguna lista");
          // a copy that has already run out has nothing left to revoke: say so
          const gone = model.st.lockedT >= 0 && model.st.lockedT <= e.t ? T(" · the copy had already expired", " · la copia ya había vencido") : T("", "");
          say(T(what.en + extra.en + gone.en, what.es + extra.es + gone.es));
          if (e.denied) addDeny(e.band);
          break;
        }
        case "gate":
          if (e.who === "user" && e.ok && clock - said > 3 && model.st.theftT < 0) sayRoutine(T("the user walks in · " + id + " is good until " + hhmm(e.band.exp), "el usuario entra · " + id + " vale hasta las " + hhmm(e.band.exp)));
          if (e.who === "thief") {
            if (e.ok && e.after) { const w = tenths(e.t - model.st.revokeT).toFixed(1); say(T("the copy still opens the gate · " + w + " min after the revocation", "la copia todavía abre la entrada · " + w + " min después de revocar")); }
            else if (e.ok && clock - said > 2) say(T("the thief walks in with " + id, "el ladrón entra con " + id));
            else if (!e.ok) say(T("the thief is turned away · " + L(whyText[e.why]), "al ladrón lo rechazan · " + L(whyText[e.why])));
          }
          break;
        case "locked": say(T("the thief is locked out · round over", "el ladrón queda afuera · fin de la ronda")); break;
      }
    }
  }

  // ---------- the deny list board ----------
  function addDeny(band) {
    const free = G.HOOKS.findIndex((_, i) => ![...deny.values()].some((d) => d.hook === i));
    if (free < 0) return;
    const g = document.createElementNS(NS, "g");
    g.innerHTML = DENY_CARD_SVG;
    g.querySelector("[data-deny-id]").textContent = "#" + band.id;
    denyCards.appendChild(g);
    deny.set(band.id, { g, hook: free, exp: band.exp, born: clock });
  }
  function paintDeny() {
    for (const [id, d] of deny) {
      if (d.exp <= clock) { d.g.remove(); deny.delete(id); continue; }
      const u = clamp((clock - d.born) / 0.4);
      const [x, y, z] = G.HOOKS[d.hook];
      d.g.setAttribute("transform", translateAlong(P, [x, y, z + 3 * (1 - ease(u))]));
      d.g.style.opacity = u < 1 ? String(u) : "";
    }
  }

  // ---------- where a walker is ----------
  const spot = (who) => G.SPOTS[who];
  const gatePt = (who) => [G.LANES[who], G.GATE_Y + 8];
  const insidePt = (who) => [G.LANES[who], G.INSIDE_Y];
  const backPt = (who) => [G.LANES[who] + 4, G.GATE_Y + 8];
  const EXIT = { user: [-24, 62], thief: [4, 64] };
  const seg = (a, b, u) => [lerp(a[0], b[0], ease(u)), lerp(a[1], b[1], ease(u))];
  const along = (pts, u) => pointAlong(pts, polylineLength(pts) * ease(clamp(u)));
  function tripPos(who, tr, t) {
    const s = spot(who);
    if (t < tr.depart) return s;
    if (tr.none) return s;
    if (tr.office !== null) {
      if (t < tr.office) return seg(s, G.WINDOW, (t - tr.depart) / (tr.office - tr.depart));
      if (tr.refusedAt !== undefined) return seg(G.WINDOW, s, (t - tr.refusedAt) / WALK.officeToGate);
      if (t < tr.gate) return seg(G.WINDOW, gatePt(who), (t - tr.office) / (tr.gate - tr.office));
    } else if (t < tr.gate) return seg(s, gatePt(who), (t - tr.depart) / (tr.gate - tr.depart));
    if (!tr.why) return gatePt(who);                // still being decided (shouldn't show)
    if (tr.ok) {
      if (t < tr.inside) return seg(gatePt(who), insidePt(who), (t - tr.gate) / (tr.inside - tr.gate));
      return along([insidePt(who), backPt(who), s], (t - tr.inside) / (tr.back - tr.inside));
    }
    return seg(gatePt(who), s, (t - tr.gate) / Math.max(1e-6, tr.back - tr.gate));
  }
  function walkerAt(who, t) {
    const list = model.trips;
    let tr = null;
    for (let i = list.length - 1; i >= 0; i--) if (list[i].who === who && list[i].depart <= t) { tr = list[i]; break; }
    return tr ? tripPos(who, tr, t) : spot(who);
  }

  // ---------- painting ----------
  function paint() {
    narrate();
    const st = model.st, ver = model.cfg.check === "version";
    // the user: walks until the revocation, then leaves
    let u = walkerAt("user", clock), ua = 1;
    if (st.revokeT >= 0 && clock >= st.revokeT) {
      const k = clamp((clock - st.revokeT) / WALK.exit);
      const from = walkerAt("user", st.revokeT);
      u = seg(from, EXIT.user, k); ua = 1 - clamp((k - 0.5) / 0.5);
    }
    place(W.user, u, ua);
    dress(W.user, model.user.band, model.cfg.refresh === "off" ? null : model.user.pass, ver);
    // the thief: waits at the spot, walks with the copy after the theft, leaves once locked out
    let th = walkerAt("thief", clock), ta = 1;
    if (st.lockedT >= 0 && clock >= st.lockedT) {
      const last = model.trips.filter((x) => x.who === "thief").pop();
      const out = last ? Math.max(st.lockedT, last.back) : st.lockedT;
      if (clock >= out) { const k = clamp((clock - out) / WALK.exit); th = seg(spot("thief"), EXIT.thief, k); ta = 1 - clamp((k - 0.5) / 0.5); }
    }
    place(W.thief, th, ta);
    const stolen = st.theftT >= 0 && clock >= st.theftT + 0.3;
    dress(W.thief, stolen ? model.thief.band : null, stolen ? model.thief.pass : null, ver);

    // gate: a scanner lights while it turns a wristband away; an arm is raised while it lets one through
    const turnedAway = (tr) => tr.why === "expired" || tr.why === "denied" || tr.why === "version";
    const refusing = (tr) => !tr.ok && !tr.none && turnedAway(tr) && clock >= tr.gate - 0.05 && clock < tr.gate + 0.45;
    for (const who of ["user", "thief"]) {
      let lit = false, open = false;
      for (let i = model.trips.length - 1; i >= 0 && i > model.trips.length - 6; i--) {
        const tr = model.trips[i];
        if (tr.who !== who) continue;
        if (refusing(tr)) lit = true;
        if (tr.ok && clock >= tr.gate - 0.05 && clock < tr.inside + 0.05) open = true;
      }
      lampSet(scan[who], lit);
      show(arms[who].closed, !open); show(arms[who].open, open);
    }
    // the copy flying from the user's scanner to the thief
    paintTheft();
    // lookups: a dot from the scanner through the reader to the deny list or the user record; that store's lamp
    // lights when its answer turns the wristband away
    let storeNo = false;
    if (model.cfg.check !== "stamp") {
      const store = model.cfg.check === "deny" ? "deny" : "ver";
      for (let i = model.trips.length - 1; i >= 0 && i > model.trips.length - 6; i--) {
        const tr = model.trips[i];
        if (!tr.why || tr.why === "gone" || tr.why === "refused" || tr.none || tr.why === "expired") continue;
        const k = (clock - (tr.gate - 0.3)) / 0.3;
        if (k >= 0 && k <= 1) pulse(i, G.WIRES[store][tr.who], k);
        if ((tr.why === "denied" || tr.why === "version") && refusing(tr)) storeNo = true;
      }
    }
    sweepPulses();
    lampSet(lamps.deny, model.cfg.check === "deny" && storeNo);
    lampSet(lamps.ver, model.cfg.check === "version" && storeNo);
    // the box office lamp: lit for a moment when it revokes passes (logout, reset, reuse) or refuses one
    const revokes = model.log.filter((e) => (e.type === "revoke" || e.type === "reuse" || e.type === "refused") && e.t <= clock && clock - e.t < 0.8).length;
    lampSet(lamps.office, revokes > 0);
    paintDeny();

    // counters
    C.refreshes.setClamped(st.refreshes);
    C.logins.setClamped(st.logins);
    C.after.setClamped(st.thiefAfter);
    const win10 = Math.round((st.lastAfter >= 0 ? st.lastAfter - st.revokeT : 0) * 10);
    C.win.setClamped(Math.floor(win10 / 10)); C.winT.set(win10 % 10);
    C.lookups.setClamped(st.lookups);
    C.ver.setClamped(model.userVer);
    const m = Math.floor(540 + clock);
    C.hh.set(Math.floor(m / 60) % 24); C.mm.set(m % 60);
  }
  let flyEl = null;
  function paintTheft() {
    const t0 = model.st.theftT;
    const k = t0 >= 0 ? (clock - t0) / 0.3 : -1;
    if (k < 0 || k > 1) { if (flyEl) { flyEl.remove(); flyEl = null; } return; }
    if (!flyEl) { flyEl = document.createElementNS(NS, "g"); flyEl.innerHTML = FLY_SVG; setLit(flyEl, true); layers.fly.appendChild(flyEl); }
    const b0 = G.PERSON.band, a = [G.SCAN.user[0], G.SCAN.user[1] + 3, G.SCAN_H + 4], b = [G.SPOTS.thief[0] + b0.x + b0.w / 2, G.SPOTS.thief[1] + 4, b0.z];
    const e = ease(k);
    flyEl.setAttribute("transform", translateAlong(P, [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e) + 10 * Math.sin(Math.PI * e)]));
  }
  const pulseMap = new Map();
  function pulse(key, wire, k) {
    let p = pulseMap.get(key);
    if (!p) { const g = document.createElementNS(NS, "circle"); g.setAttribute("r", "1.6"); g.setAttribute("class", "tok-pulse"); pulseLayer.appendChild(g); p = { g, seen: 0 }; pulseMap.set(key, p); pulses.push(p); }
    p.seen = clock;
    const [x, y] = pointAlong(wire, polylineLength(wire) * k);
    const [sx, sy] = iso([x, y, 1.1], P);
    p.g.setAttribute("cx", sx.toFixed(1)); p.g.setAttribute("cy", sy.toFixed(1));
  }
  function sweepPulses() {
    for (const [key, p] of pulseMap) if (p.seen !== clock) { p.g.remove(); pulseMap.delete(key); pulses.splice(pulses.indexOf(p), 1); }
  }
  // ---------- stats ----------
  function showStats() {
    const st = model.st;
    stat("after", st.thiefAfter);
    stat("window", tenths(st.lastAfter >= 0 ? st.lastAfter - st.revokeT : 0).toFixed(1) + " min");
    stat("lookups", st.lookups);
    stat("refreshes", st.refreshes);
    stat("logins", st.logins);
    stat("thief", L(st.theftT < 0 ? T("waiting", "esperando") : model.thief.active ? T("has a copy", "tiene una copia") : T("locked out at " + hhmm(st.lockedT), "afuera desde las " + hhmm(st.lockedT))));
  }

  // ---------- the loop ----------
  let statTimer = 0;
  const pause = playPause(root);
  const CAP_AFTER_THEFT = 150;
  const loop = WB.loop({ stage, step: (dt) => {
    clock += dt * cfg.speed;
    model.runTo(clock);
    const st = model.st;
    // with nobody noticing, a lockout by reuse detection also logs the user out: wait for their new login first
    const userRefusedNext = model.user.pass && model.user.pass.fam.revoked && model.user.active;
    const quietEnd = st.theftT >= 0 && !model.thief.active && st.lockedT >= 0 && st.revokeT < 0 && (!userRefusedNext || clock > st.lockedT + 30);
    if (endAt === Infinity && (model.done || quietEnd || (st.theftT >= 0 && clock > st.theftT + CAP_AFTER_THEFT))) {
      endAt = clock + 8 * cfg.speed;          // eight seconds on the outcome, at any speed
      if (model.thief.active) say(T("the copy still works · new round in a moment", "la copia todavía sirve · ronda nueva en un momento"));
    }
    if (clock > endAt) restart();
    paint();
    statTimer += dt; if (statTimer > 0.2) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = name === "ttl" ? Number(raw) : String(raw);
    if (!quiet) { restart(); say(T("settings applied · new round", "ajustes aplicados · ronda nueva")); }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    steal: () => { model.stealNow(clock); say(T("the thief will copy at the user's next scan", "el ladrón copiará en el próximo escaneo del usuario")); wake(); },
    logout: () => { if (!model.revokeNow(clock, "logout")) say(T("the user has already left", "el usuario ya se fue")); wake(); },
    resetpw: () => { if (!model.revokeNow(clock, "reset")) say(T("the user has already left", "el usuario ya se fue")); wake(); },
    reset: () => { restart(); say(T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => actions[name]?.());

  // Watch: the experiment's settings, staged so the outcome shows within seconds: a fixed seed, the theft at the first
  // scan after 3 minutes and the revocation 3 minutes after it, the clock started at 2.5 minutes, 3 min/s.
  root.on("watch", (w) => {
    for (const key of ["ttl", "refresh", "check", "steal", "revoke"]) set(key, w[key], true);
    set("speed", 3, true);
    restart({ seed: 3, theftAt: 3, revokeAfter: 3, warm: 2.5 });
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

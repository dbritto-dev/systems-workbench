// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The bank office in the browser: runs the model, walks the clerks between desks and the card (or the seat board),
// turns the counters, pins the seats, and answers the controls. mount() gets the build-time data from page.ts
// (geometry, the clerk drawing, experiment titles) and root, the <wb-lesson>.
import { iso, translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show as display, setText as put, playPause } from "../../runtime/dom";
import { easeInOutQuad as ease } from "../../lib/tween";
import { makeSim } from "./sim";

export default function mount({ P, G, CLERK_SVG, TITLES }, root) {
  const NAMES = "ABCD";
  const NS = "http://www.w3.org/2000/svg";

  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const stat = (key, value) => root.stat(key, value);
  const layer = q("[data-clerks]");
  const hookKey = q("[data-hook-key]");
  const cardLit = q("[data-card-lit]");
  const seatEls = G.SEAT_AT.map((_, n) => { const g = q('[data-seat="' + n + '"]'); return { pins: [g.querySelector('[data-pin="0"]'), g.querySelector('[data-pin="1"]')], ring: g.querySelector("[data-ring]") }; });
  const clerkEls = [0, 1, 2, 3].map((i) => {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("data-clerk", String(i));
    g.innerHTML = CLERK_SVG;
    layer.appendChild(g);
    return { g, key: g.querySelector("[data-key]"), slip: g.querySelector("[data-slip]"), lit: g.querySelector("[data-slip-lit]"), value: g.querySelector("[data-slip-value]"), note: g.querySelector("[data-slip-note]") };
  });
  const digits = { b: [0, 1, 2, 3].map((n) => q('[data-digit="b' + n + '"]')), e: [0, 1, 2, 3].map((n) => q('[data-digit="e' + n + '"]')) };
  const versionEl = q("[data-version]");
  const labelEls = { balance: q('[data-label="balance"]'), expected: q('[data-label="expected"]') };
  const statLabels = Object.fromEntries(root.$$("[data-s]").map((el) => [el.dataset.s, el.nextElementSibling]));
  // Four digit wheels painted as text: the number padded to four places, kept within 0–9999.
  const wheels = (row, n) => { const t = String(Math.max(0, Math.min(9999, n))).padStart(4, "0"); row.forEach((el, i) => put(el, t[i])); };
  const ROWS = "ABCD";
  function slipText(c, booking) {
    if (booking) return c.seat >= 0 ? [ROWS[Math.floor(c.seat / 6)] + (c.seat % 6 + 1), L("seat", "lugar")] : ["", ""];
    if (c.pre) return ["+10", L("add", "suma")];
    return c.slip ? [String(c.slip.value * 10), "v" + c.slip.version] : ["", ""];
  }

  const cfg = { clerks: 2, think: 1, protection: "none", scenario: "deposits", traffic: "busy", speed: 1 };
  let s, clock, seen, fullSince, doneTimes, seed = (Date.now() % 1e6) + 1;

  function restart() {
    s = makeSim({ clerks: cfg.clerks, think: cfg.think, protection: cfg.protection, scenario: cfg.scenario, traffic: cfg.traffic }, seed++);
    clock = 0; seen = 0; fullSince = -1; doneTimes = [];
    labelAll();
    paint(); showStats();
  }
  const LABELS = {
    booking: [T("Bookings", "Reservas"), T("Seats taken", "Ocupados"), T("Double-booked", "Dobles"), T("Retries", "Reintentos"), T("Per minute", "Por minuto"), T("Avg time", "Tiempo prom.")],
    deposits: [T("Deposits made", "Depósitos hechos"), T("On the card", "En la tarjeta"), T("Lost", "Perdidos"), T("Retries", "Reintentos"), T("Per minute", "Por minuto"), T("Avg time", "Tiempo prom.")],
  };
  function labelAll() {
    const booking = cfg.scenario === "booking", labels = LABELS[booking ? "booking" : "deposits"];
    ["made", "card", "lost", "retries", "perMinute", "wait"].forEach((key, n) => { put(statLabels[key], L(labels[n])); });
    put(labelEls.balance, booking ? L("SEATS TAKEN", "OCUPADOS") : L("BALANCE", "SALDO"));
    put(labelEls.expected, booking ? L("PINS PLACED", "ALFILERES") : L("SHOULD BE", "DEBERÍA SER"));
  }

  const STOP = { idle: 1, think: 1, done: 1 };
  const AT_STAND = { queue: 1, read: 1, write: 1 };
  const OUT = { toStand: 1, toStand2: 1 };
  function position(c) {
    const home = G.DESK_SPOT[c.i], away = (cfg.scenario === "booking" ? G.BOARD_SPOT : G.STAND_SPOT)[c.i];
    if (STOP[c.phase]) return home;
    if (AT_STAND[c.phase]) return away;
    const u = ease(Math.max(0, Math.min(1, (clock - c.t0) / Math.max(1e-6, c.t1 - c.t0))));
    const [a, b] = OUT[c.phase] ? [home, away] : [away, home];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  }
  function carrying(c) {
    if (c.pre) return c.phase === "think" || c.phase === "toStand" || c.phase === "write";
    return c.phase === "toDesk1" || c.phase === "think" || c.phase === "toStand2" || c.phase === "write";
  }

  function paint() {
    const order = [], booking = cfg.scenario === "booking";
    s.clerks.forEach((c) => {
      const el = clerkEls[c.i];
      const [x, y] = position(c);
      el.g.setAttribute("transform", translateAlong(P, [x, y, 0]));
      el.g.style.display = "";
      const flash = c.lit >= 0 && clock - c.lit < 1.6;
      display(el.lit, flash);
      const holding = (flash || carrying(c)) && !c.empty;
      display(el.slip, holding);
      if (holding) { const [v, note] = slipText(c, booking); put(el.value, v); put(el.note, note); }
      display(el.key, s.key.holder === c.i);
      order.push([iso([x, y, 0], P)[1], el.g]);
    });
    for (let i = s.clerks.length; i < 4; i++) display(clerkEls[i].g, false);
    order.sort((a, b) => a[0] - b[0]).forEach(([, g]) => layer.appendChild(g));
    display(hookKey, s.key.holder < 0);
    if (booking) {
      wheels(digits.b, s.seats.filter((x) => x.length).length);
      wheels(digits.e, s.seats.reduce((a, x) => a + x.length, 0));
      put(versionEl, "v–");
    } else {
      wheels(digits.b, s.card.value * 10);
      wheels(digits.e, s.stats.done * 10);
      put(versionEl, "v" + s.card.version);
    }
    const lostNow = !booking && s.clerks.some((c) => c.lit >= 0 && clock - c.lit < 1.6);
    display(cardLit, lostNow);
    digits.b.forEach((el) => el.setAttribute("data-tone", lostNow ? "lit" : "hi"));
    s.seats.forEach((list, n) => {
      const e = seatEls[n], count = booking ? list.length : 0;
      display(e.pins[0], count >= 1);
      display(e.pins[1], count >= 2);
      display(e.ring, count >= 2);
    });
  }

  function showStats() {
    const st = s.stats, booking = cfg.scenario === "booking";
    stat("made", booking ? st.booked : st.done);
    stat("card", booking ? s.seats.filter((x) => x.length).length : s.card.value);
    stat("lost", booking ? st.doubles : st.lost);
    stat("retries", st.retries);
    const span = Math.min(clock, 60);
    stat("perMinute", span > 5 ? Math.round((doneTimes.filter((t) => t > clock - span).length / span) * 60) : "–");
    stat("wait", st.done ? (st.waitSum / st.done).toFixed(1) + " s" : "–");
  }

  const show = (v) => say(L(v));
  function tell(e) {
    const who = NAMES[e.clerk], n = e.overwritten, seat = e.seat + 1;
    const text = {
      lost: T("clerk " + who + " · wrote over " + n + " deposit" + (n > 1 ? "s" : "") + " · lost", "empleado " + who + " · sobrescribió " + n + " depósito" + (n > 1 ? "s" : "") + " · perdido" + (n > 1 ? "s" : "")),
      wrote: T("clerk " + who + " · deposit written", "empleado " + who + " · depósito escrito"),
      stale: T("clerk " + who + " · version changed, reading again", "empleado " + who + " · cambió la versión, vuelve a leer"),
      added: T("clerk " + who + " · added 10 in one step", "empleado " + who + " · sumó 10 en un solo paso"),
      key: T("clerk " + who + " · took the key", "empleado " + who + " · tomó la llave"),
      double: T("clerk " + who + " · seat " + seat + " double-booked", "empleado " + who + " · asiento " + seat + " reservado dos veces"),
      booked: T("clerk " + who + " · seat " + seat + " booked", "empleado " + who + " · asiento " + seat + " reservado"),
      taken: T("clerk " + who + " · seat " + seat + " already taken, choosing again", "empleado " + who + " · asiento " + seat + " ya ocupado, elige otro"),
    }[e.kind];
    if (text) show(text);
  }

  let statTimer = 0;
  function step(dt) {
    const d = dt * cfg.speed;
    clock += d;
    const before = s.stats.done;
    s.runTo(clock);
    for (let n = before; n < s.stats.done; n++) doneTimes.push(clock);
    if (doneTimes.length > 400) doneTimes.splice(0, doneTimes.length - 400);
    while (seen < s.events.length) tell(s.events[seen++]);
    if (s.boardFull()) {
      if (fullSince < 0) fullSince = clock;
      else if (clock - fullSince > 2.5) { s.clearBoard(); fullSince = -1; show(T("board full · cleared for the next show", "tablero lleno · se limpia para la próxima función")); }
    } else fullSince = -1;
    paint();
    statTimer += dt; if (statTimer > 0.2) { statTimer = 0; showStats(); }
  }

  // ---------- controls ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage, step, onPause: pause.onPause });
  const NUMERIC = ["clerks", "think", "speed"];
  function set(name, raw, quiet) {
    cfg[name] = NUMERIC.includes(name) ? Number(raw) : raw;
    root.press(name, raw);
    if (name !== "speed" && !quiet) { restart(); show(T("settings applied · run restarted", "ajustes aplicados · la corrida empezó de nuevo")); }
  }
  root.on("change", (name, value) => set(name, value));
  const actions = { reset: () => { restart(); show(T("started over", "empezó de nuevo")); } };
  root.on("action", (name) => actions[name]?.());
  pause.bind(loop);

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w, id) => {
    for (const name of ["scenario", "clerks", "think", "protection", "traffic"]) set(name, String(w[name]), true);
    restart();
    if (loop.paused) loop.setPaused(false);
    show(T("watching: " + TITLES[id].en.toLowerCase(), "viendo: " + TITLES[id].es.toLowerCase()));
  });

  loop.setPaused(loop.paused);
  restart();
}

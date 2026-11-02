// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The travel agency in the browser: runs the model, moves the folders along the tracks, the couriers, the tags on
// the boards, the checklist and the scoreboard, and wires the controls and the experiment cards. mount() gets the
// build-time data from page.ts (geometry, folder and puck drawings, results).
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats, act, pauseControls } from "../../runtime/dom";
import { one, pct } from "../../lib/format";
import { makeSim, folderAt, NAMES } from "./sim";

export default function mount({ P, G, HOOKS, FOLDER_SVG, PUCK_SVG, RESULTS, EXPERIMENTS }) {
  const NS = "http://www.w3.org/2000/svg";
  const POOL = 28, PUCKS = 8;
  const WARM = 40;   // each run starts this many seconds in, so the first frame already shows trips, tags and counts

  const stage = document.querySelector("[data-agency]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const NAMES_ES = { F: "vuelo", H: "hotel", C: "auto", P: "pago", M: "correo de confirmación" };
  const sayText = readout();
  const say = (v) => sayText(L(v));
  const layer = q("[data-folders]");
  const stationsEl = q("[data-stations]");
  const stations = Object.fromEntries(["F", "H", "C", "P", "M"].map((s) => [s, q('[data-station="' + s + '"]')]));
  const tags = Object.fromEntries(["F", "H", "C", "P"].map((s) => [s, HOOKS.map((_, n) => { const g = q('[data-tag="' + s + n + '"]'); return { g, solids: [...g.querySelectorAll(".iso-solid")], x: g.querySelector("[data-x]") }; })]));
  const hookEls = Object.fromEntries(["F", "H", "C", "P"].map((s) => [s, qa('[data-station="' + s + '"] [data-hook]')]));
  const letter = q("[data-letter]");
  const cells = Array.from({ length: G.ROWS }, (_, r) => Array.from({ length: 5 }, (_, c) => q('[data-cell="' + r + "-" + c + '"]')));
  const digits = Object.fromEntries(G.SCORE_ROWS.map((n) => [n, [0, 1, 2].map((j) => q('[data-digit="' + n + j + '"]'))]));
  const parts = { wires: q("[data-wires]"), desk: q("[data-desk]"), sheet: q("[data-sheet]"), keeper: q("[data-keeper]"), closed: q("[data-closed]"), ret: q("[data-return]"), retRails: qa("[data-return-rails]") };

  const mk = (html) => { const g = document.createElementNS(NS, "g"); g.innerHTML = html; g.style.display = "none"; layer.appendChild(g); return g; };
  const folders = Array.from({ length: POOL }, () => { const g = mk(FOLDER_SVG); return { g, solids: [...g.querySelectorAll(".iso-solid")], stamps: [...g.querySelectorAll(".stamp")], shown: "" }; });
  const pucks = Array.from({ length: PUCKS }, () => mk(PUCK_SVG));

  const cfg = { style: "orch", order: "standard", undo: "idem", decline: 0.2, lost: 0, slots: 8, rate: 0.3, speed: 1 };
  let model, clock, slotOf;
  let seed = (Date.now() % 1e6) + 1;

  function slotX(s) {
    if (s <= 0) return G.DOOR_X + (G.SX[0] - G.DOOR_X) * (s + 1);
    if (s >= 4) return G.SX[4] + (G.EXIT_X - G.SX[4]) * (s - 4);
    const i = Math.floor(s); return G.SX[i] + (G.SX[i + 1] - G.SX[i]) * (s - i);
  }

  function restart(warm = WARM) {
    model = makeSim({ style: cfg.style, order: cfg.order, undo: cfg.undo, decline: cfg.decline, lost: cfg.lost, slots: cfg.slots, rate: cfg.rate }, seed++);
    clock = warm;
    model.runTo(clock);
    // Lay the counters out in the order the trip visits them, and paint them back to front.
    slotOf = Object.fromEntries(model.order.map((s, i) => [s, i]));
    const byDepth = model.order.map((s) => [s, depthOf([G.SX[slotOf[s]], -50, 0], P)]).sort((a, b) => a[1] - b[1]);
    for (const [s] of byDepth) { stations[s].setAttribute("transform", translateAlong(P, [G.SX[slotOf[s]], 0, 0])); stationsEl.appendChild(stations[s]); }
    for (const s of ["F", "H", "C", "P"]) hookEls[s].forEach((el, n) => el.toggleAttribute("data-off", s !== "P" && n >= cfg.slots));
    const orch = cfg.style === "orch", none = cfg.style === "none";
    parts.wires.style.display = orch ? "" : "none";
    parts.keeper.style.display = orch ? "" : "none";
    parts.sheet.style.display = orch ? "none" : "";
    parts.desk.style.display = orch ? "" : "none";
    parts.closed.style.display = none ? "" : "none";
    paint();
  }

  function placeFolder(f, x, y, z, lit, steps) {
    f.g.style.display = "";
    const key = x.toFixed(1) + "," + y.toFixed(1) + "," + z;
    if (f.shown !== key) { f.g.setAttribute("transform", translateAlong(P, [x, y, z])); f.shown = key; }
    f.solids.forEach((s) => s.toggleAttribute("data-lit", lit));
    f.stamps.forEach((s, i) => s.toggleAttribute("data-on", i < steps));
  }

  function paint() {
    const t = clock;
    // Folders on the tracks (and on the stuck ledge, stacked per counter).
    let used = 0;
    const stuckStack = [0, 0, 0, 0, 0];
    const visible = [];
    for (const trip of model.trips) {
      if (trip.t0 > t) break;
      if (trip.outcome && trip.outcome !== "stuck" && t > trip.outcomeAt + 0.2) continue;
      visible.push(trip);
    }
    for (const trip of visible) {
      const f = folderAt(trip, t);
      if (!f || used >= POOL) continue;
      let x = slotX(f.slot), y = G.LANE_Y[f.lane], z = G.LANE_Z[f.lane];
      if (f.blend) { y += (G.LANE_Y[f.from] - G.LANE_Y[f.lane]) * f.blend; z += (G.LANE_Z[f.from] - G.LANE_Z[f.lane]) * f.blend; }
      if (f.lane === "s" && !f.blend) { const i = Math.round(f.slot); z += 3.1 * Math.min(4, stuckStack[i]++); }
      placeFolder(folders[used++], x, y, z, f.undoing || f.stuck, f.steps);
    }
    for (let i = used; i < POOL; i++) folders[i].g.style.display = "none";

    // Couriers from the orchestrator desk.
    let pk = 0;
    if (cfg.style === "orch") for (let i = model.couriers.length - 1; i >= 0 && pk < PUCKS; i--) {
      const c = model.couriers[i];
      if (c.to < t - 2) break;
      if (c.from > t || c.to <= t) continue;
      let p = (t - c.from) / (c.to - c.from); if (c.dir === "back") p = 1 - p;
      const x = G.DESK_PORT[0] + (G.SX[c.slot] - G.DESK_PORT[0]) * p, y = G.DESK_PORT[1] + (G.COUNTER_FRONT + 2 - G.DESK_PORT[1]) * p;
      pucks[pk].style.display = ""; pucks[pk].setAttribute("transform", translateAlong(P, [x, y, 0])); pk++;
    }
    for (let i = pk; i < PUCKS; i++) pucks[i].style.display = "none";

    // Tags on the boards; receipts on the payment board. Tags held by a stuck trip are lit.
    const stuckNow = new Set();
    for (const trip of visible) if (trip.outcome === "stuck" && trip.outcomeAt <= t) stuckNow.add(trip.id);
    const show = { F: [], H: [], C: [], P: [] };
    for (const tag of model.tags) if (tag.from <= t && tag.to > t) show[tag.svc][tag.hook] = tag;
    let r = 0;
    for (const rc of model.receipts) if (rc.from <= t && rc.to > t && r < 8) show.P[r++] = rc;
    for (const s of ["F", "H", "C", "P"]) tags[s].forEach((el, n) => {
      const tag = show[s][n];
      el.g.style.display = tag ? "" : "none";
      const orphan = !!tag && stuckNow.has(tag.trip);
      if (tag) el.solids.forEach((x) => x.toggleAttribute("data-lit", orphan));
      el.x.style.display = orphan ? "" : "none";
    });

    // A letter dropping into the postbox.
    let drop = -1;
    for (let i = model.letters.length - 1; i >= 0; i--) { const d = t - model.letters[i].t; if (d < 0) continue; if (d < 0.7) drop = d; break; }
    letter.style.display = drop >= 0 ? "" : "none";
    if (drop >= 0) letter.setAttribute("transform", translateAlong(P, [0, 0, -7 * drop]));

    // The checklist: one row per trip in progress (oldest first), one cell per step done.
    const active = visible.filter((trip) => trip.outcomeAt > t).slice(0, G.ROWS);
    for (let row = 0; row < G.ROWS; row++) {
      const trip = active[row], f = trip && folderAt(trip, t);
      for (let c = 0; c < 5; c++) {
        cells[row][c].toggleAttribute("data-on", !!f && c < f.steps);
        cells[row][c].toggleAttribute("data-undo", !!f && f.undoing);
      }
    }

    // Scoreboard and stats.
    const n = model.count(t);
    for (const name of G.SCORE_ROWS) String(Math.min(999, n[name])).padStart(3, "0").split("").forEach((d, j) => { if (digits[name][j].textContent !== d) digits[name][j].textContent = d; });
    for (const k of ["done", "undone", "stuck", "turned", "wrongMail", "doubles"]) stat(k, n[k]);

    // Readout: what the most interesting trip is doing.
    const undoing = active.find((trip) => t >= trip.compAt);
    if (undoing) {
      const f = folderAt(undoing, t), sold = undoing.failReason === "sold", svc = model.order[undoing.failSlot], steps = Math.max(0, f.steps);
      say(T("trip " + (undoing.id + 1) + " · " + (sold ? NAMES[svc] + " full" : "card declined") + " · undoing " + steps + " step" + (f.steps === 1 ? "" : "s"),
        "viaje " + (undoing.id + 1) + " · " + (sold ? NAMES_ES[svc] + " lleno" : "tarjeta rechazada") + " · deshaciendo " + steps + " paso" + (f.steps === 1 ? "" : "s")));
    }
    else if (n.stuck && cfg.style === "none") say(T(n.stuck + " half-done trip" + (n.stuck === 1 ? "" : "s") + " · " + n.orphans + " bookings held for nobody",
      n.stuck + " viaje" + (n.stuck === 1 ? "" : "s") + " a medias · " + n.orphans + " reservas retenidas para nadie"));
    else say(T(active.length + " trip" + (active.length === 1 ? "" : "s") + " in progress · " + n.done + " booked",
      active.length + " viaje" + (active.length === 1 ? "" : "s") + " en curso · " + n.done + " reservados"));
  }
  const stat = stats();

  const pause = pauseControls(stage, say);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    WB.pressSeg(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = ["style", "order", "undo"].includes(name) ? raw : Number(raw);
    if (!quiet) restart();
  }
  WB.onSegments((name, value) => set(name, value));
  act("decline").addEventListener("click", () => { model.declineNext(); if (loop.paused) loop.setPaused(false); say(T("the next card will be declined", "la próxima tarjeta será rechazada")); });
  act("reset").addEventListener("click", () => restart());

  // ---------- experiments (numbers computed at build time from the same model, 8 seeds each) ----------
  const RUNS = {
    nosaga: () => {
      const { a, b } = RESULTS.nosaga;
      const top = Math.max(a.done, b.done, a.turned, b.turned, 1);
      return { verdict: T("No saga: " + one(a.stuck) + " trips left half-done, " + one(a.orphans) + " bookings still held for nobody at the end, " + one(a.turned) + " customers turned away. With a saga: " + one(b.stuck) + " left half-done, " + one(b.undone) + " undone cleanly, " + one(b.turned) + " turned away, and " + one(b.done) + " trips booked instead of " + one(a.done) + ".",
          "Sin saga: " + one(a.stuck) + " viajes a medias, " + one(a.orphans) + " reservas todavía retenidas para nadie al final, " + one(a.turned) + " clientes sin lugar. Con saga: " + one(b.stuck) + " a medias, " + one(b.undone) + " deshechos limpios, " + one(b.turned) + " sin lugar, y " + one(b.done) + " viajes reservados en vez de " + one(a.done) + "."),
        bars: [[T("Booked, no saga", "Reservados, sin saga"), a.done / top, one(a.done)], [T("Booked, saga", "Reservados, con saga"), b.done / top, one(b.done), true], [T("Turned away, no saga", "Sin lugar, sin saga"), a.turned / top, one(a.turned)], [T("Turned away, saga", "Sin lugar, con saga"), b.turned / top, one(b.turned), true]] };
    },
    lost: () => {
      const { g, r, k } = RESULTS.lost;
      const top = Math.max(g.stuck, r.doubles, 1);
      return { verdict: T("Give up: " + one(g.stuck) + " trips stuck half-done, " + one(g.orphans) + " bookings never released. Retry: " + one(r.stuck) + " stuck, but " + one(r.doubles) + " undos ran twice (another customer's seat released, or a double refund). Retry with a key: " + one(k.stuck) + " stuck, " + one(k.doubles) + " twice.",
          "Rendirse: " + one(g.stuck) + " viajes atascados a medias, " + one(g.orphans) + " reservas nunca liberadas. Reintentar: " + one(r.stuck) + " atascados, pero " + one(r.doubles) + " llamadas de deshacer se ejecutaron dos veces (se liberó el lugar de otro cliente, o hubo un reembolso doble). Reintentar con clave: " + one(k.stuck) + " atascados, " + one(k.doubles) + " dos veces."),
        bars: [[T("Stuck, give up", "A medias, rendirse"), g.stuck / top, one(g.stuck)], [T("Undone twice, retry", "Deshechos dos veces, reintentar"), r.doubles / top, one(r.doubles)], [T("Stuck or twice, retry with key", "A medias o dos veces, con clave"), (k.stuck + k.doubles) / top, one(k.stuck + k.doubles), true]] };
    },
    email: () => {
      const { last, first } = RESULTS.email;
      const failed = first.undone + first.stuck, top = Math.max(failed, 1);
      return { verdict: T("Email last: " + one(last.wrongMail) + " wrong confirmations. Email first: " + one(first.wrongMail) + " of " + one(failed) + " failed trips had already been confirmed by email (" + pct(failed ? first.wrongMail / failed : 0) + ").",
          "Correo al final: " + one(last.wrongMail) + " confirmaciones erróneas. Correo primero: " + one(first.wrongMail) + " de " + one(failed) + " viajes fallidos ya se habían confirmado por correo (" + pct(failed ? first.wrongMail / failed : 0) + ")."),
        bars: [[T("Failed trips, email first", "Viajes fallidos, correo primero"), failed / top, one(failed)], [T("Confirmed anyway", "Confirmados igual"), first.wrongMail / top, one(first.wrongMail), true], [T("Confirmed anyway, email last", "Confirmados igual, correo al final"), last.wrongMail / top, one(last.wrongMail)]] };
    },
    isolation: () => {
      const { a, b } = RESULTS.isolation, top = Math.max(a.turned, 1);
      return { verdict: T("Payment last: " + one(a.turned) + " customers turned away for full seats, " + one(a.wrongTurned) + " of them (" + pct(a.turned ? a.wrongTurned / a.turned : 0) + ") while a seat was held by a trip that was later undone. Card checked first: " + one(b.turned) + " turned away, " + one(b.wrongTurned) + " by doomed trips; " + one(b.done) + " trips booked instead of " + one(a.done) + ".",
          "Pago al final: " + one(a.turned) + " clientes sin lugar por cupo lleno, " + one(a.wrongTurned) + " de ellos (" + pct(a.turned ? a.wrongTurned / a.turned : 0) + ") mientras un viaje que después se deshizo retenía un lugar. Tarjeta primero: " + one(b.turned) + " sin lugar, " + one(b.wrongTurned) + " por viajes condenados; " + one(b.done) + " viajes reservados en vez de " + one(a.done) + "."),
        bars: [[T("Turned away, payment last", "Sin lugar, pago al final"), a.turned / top, one(a.turned)], [T("…by a doomed trip's seat", "…por el lugar de un viaje condenado"), a.wrongTurned / top, one(a.wrongTurned), true], [T("Turned away, card first", "Sin lugar, tarjeta primero"), b.turned / top, one(b.turned)], [T("…by a doomed trip's seat", "…por el lugar de un viaje condenado"), b.wrongTurned / top, one(b.wrongTurned), true]] };
    },
    choreo: () => {
      const { o, c } = RESULTS.choreo, top = Math.max(o.tripTime, c.tripTime);
      return { verdict: T("Time per booked trip: " + one(o.tripTime) + " s orchestrated, " + one(c.tripTime) + " s choreographed. Finding a trip in progress: 1 look at the checklist vs " + one(c.findAsks) + " counters asked on average, and " + pct(c.findMissed) + " of the time the folder was between counters, so nobody had it.",
          "Tiempo por viaje reservado: " + one(o.tripTime) + " s orquestado, " + one(c.tripTime) + " s coreografiado. Encontrar un viaje en curso: 1 vistazo a la lista de control vs " + one(c.findAsks) + " mostradores consultados en promedio, y el " + pct(c.findMissed) + " de las veces la carpeta estaba entre mostradores, así que nadie la tenía."),
        bars: [[T("Trip time, orchestrator", "Tiempo del viaje, orquestador"), o.tripTime / top, one(o.tripTime) + " s"], [T("Trip time, choreography", "Tiempo del viaje, coreografía"), c.tripTime / top, one(c.tripTime) + " s", true], [T("Counters asked to find a trip", "Mostradores consultados por viaje"), c.findAsks / 5, T(one(c.findAsks) + " of 5", one(c.findAsks) + " de 5"), true]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    for (const [k, v] of Object.entries(w)) set(k, v, true);
    restart(exp.id === "nosaga" ? 4 : WARM);
    if (loop.paused) loop.setPaused(false);
  } });

  loop.setPaused(loop.paused);
  restart();
}

// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The travel agency in the browser: runs the model, moves the folders along the tracks, the couriers, the tags on
// the boards, the checklist and the scoreboard, and answers the controls. mount() gets the build-time data from
// page.ts (geometry, folder and puck drawings) and root, the <wb-lesson>.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { playPause } from "../../runtime/dom";
import { makeSim, folderAt, NAMES } from "./sim";

export default function mount({ P, G, HOOKS, FOLDER_SVG, PUCK_SVG }, root) {
  const NS = "http://www.w3.org/2000/svg";
  const POOL = 28, PUCKS = 8;
  const WARM = 40;   // each run starts this many seconds in, so the first frame already shows trips, tags and counts

  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const NAMES_ES = { F: "vuelo", H: "hotel", C: "auto", P: "pago", M: "correo de confirmación" };
  const sayText = (text) => root.figure.say(text);
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
  const stat = (key, value) => root.stat(key, value);

  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = ["style", "order", "undo"].includes(name) ? raw : Number(raw);
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));
  const actions = {
    decline: () => { model.declineNext(); if (loop.paused) loop.setPaused(false); say(T("the next card will be declined", "la próxima tarjeta será rechazada")); },
    reset: () => restart(),
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w, id) => {
    for (const [k, v] of Object.entries(w)) set(k, v, true);
    restart(id === "nosaga" ? 4 : WARM);
    if (loop.paused) loop.setPaused(false);
  });

  loop.setPaused(loop.paused);
  restart();
}

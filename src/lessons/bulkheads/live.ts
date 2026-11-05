// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The hold in the browser: runs the bulkhead model, moves each request's tag along the quay, over the hull wall and onto
// its worker's console (or into its hands while it queues), and keeps the counters and the readout. mount() gets the
// build-time data from page.ts (projection, geometry, the tag drawing) and root, the <wb-lesson>.
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, playPause } from "../../runtime/dom";
import { clamp } from "../../lib/stats";
import { makeHold, WORKERS, AREA, DEADLINE } from "./sim";

const LETTERS = { en: ["S", "C", "P"], es: ["B", "C", "P"] };
const NAMES = { en: ["search", "checkout", "profile"], es: ["búsqueda", "compra", "perfil"] };

export default function mount({ P, G, TAG_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (v) => root.figure.say(L(v));
  const stat = (key, value) => root.stat(key, value);
  const NS = "http://www.w3.org/2000/svg";
  const lang = WB.lang();
  const inL = [0, 1, 2].map((i) => q('[data-layer="in' + i + '"]'));
  const quayL = q('[data-layer="quay"]');
  const workers = Array.from({ length: WORKERS }, (_, w) => [...svg.querySelectorAll('[data-worker="' + w + '"] [data-litable]')]);
  const heads = [0, 1].map((n) => q('[data-bulkhead="' + n + '"]'));
  const fullG = [0, 1, 2].map((i) => q('[data-full="' + i + '"] .iso-solid'));
  const capText = [0, 1, 2].map((i) => q('[data-cap="' + i + '"]'));
  const timeoutText = q("[data-timeout]");
  const reps = [[0, 0], [0, 1], [1, 0], [2, 0]].map(([i, n]) => ({ i, n, ok: q('[data-rep="' + i + "-" + n + '"] [data-v="ok"]'), sick: q('[data-rep="' + i + "-" + n + '"] [data-v="sick"]') }));
  const flight = [0, 1, 2].map((i) => WB.counter(svg, "flight" + i, P));
  const okC = [0, 1, 2].map((i) => WB.counter(svg, "ok" + i, P));
  const busyC = WB.counter(svg, "busy", P), doorC = WB.counter(svg, "door", P);
  const busyDial = WB.dial(svg, "busy", P);
  const lit = (el, on) => { el.toggleAttribute("data-lit", on); el.toggleAttribute("data-lit-fill", on); };

  // ---------- tags: one pooled element per request on screen ----------
  const free = [];
  function makeEl() {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = TAG_SVG;
    return { g, body: g.querySelector("[data-body]"), letter: g.querySelector("[data-letter]"), shown: {} };
  }
  let snapping = false;
  const tags = new Map();   // request id -> { el, pos, path, kind, layer, leaving, until, goal }
  function drop(id) { const r = tags.get(id); r.el.g.remove(); r.el.g.style.opacity = ""; free.push(r.el); tags.delete(id); }
  function tagFor(req, from) {
    let r = tags.get(req.id);
    if (!r) {
      const el = free.pop() || makeEl();
      r = { el, pos: [...from], path: [], kind: req.kind, layer: null, goal: null, born: snapping ? -1e9 : performance.now() };
      tags.set(req.id, r);
      setText(el.letter, LETTERS[lang][req.kind]);
    }
    return r;
  }
  const LANE = (x) => [x, G.LANE_Y, G.QUAY_H];
  const inside = (p) => p[1] < G.HULL_FRONT;
  const compOf = (x) => (x < G.COMP_X[1] ? 0 : x < G.COMP_X[2] ? 1 : 2);
  const same = (a, b) => a && b && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6 && Math.abs(a[2] - b[2]) < 1e-6;
  // A route from where the tag is to `to`: along the lane, then a hop over the hull wall; or one hop inside the hold.
  function route(r, to) {
    if (same(r.goal, to)) return;
    r.goal = to;
    const from = r.pos;
    if (inside(to) && !inside(from)) r.path = [{ p: LANE(to[0]) }, { p: to, hop: true }];
    else if (inside(to) && inside(from)) r.path = [{ p: to, hop: true }];
    else if (!inside(to) && inside(from)) r.path = [{ p: LANE(from[0]), hop: true }, { p: to }];
    else r.path = Math.abs(to[1] - G.LANE_Y) > 0.5 ? [{ p: LANE(to[0]) }, { p: to }] : [{ p: to }];
    r.seg = null;
  }
  const SPEED = 320;   // world units a second at ×1
  function advance(r, dist) {
    while (dist > 0 && r.path.length) {
      const step = r.path[0];
      if (!r.seg) { const a = [...r.pos]; r.seg = { a, len: Math.max(0.01, Math.hypot(step.p[0] - a[0], step.p[1] - a[1], step.p[2] - a[2])), u: 0 }; }
      const s = r.seg, b = step.p;
      const left = (1 - s.u) * s.len;
      if (dist >= left) { s.u = 1; dist -= left; } else { s.u += dist / s.len; dist = 0; }
      const u = s.u;
      const pos = [s.a[0] + (b[0] - s.a[0]) * u, s.a[1] + (b[1] - s.a[1]) * u, s.a[2] + (b[2] - s.a[2]) * u];
      if (step.hop) pos[2] += (G.WALL_H + 3 - Math.min(s.a[2], b[2])) * Math.sin(Math.PI * u);
      r.pos = pos;
      if (u >= 1) { r.path.shift(); r.seg = null; } else break;
    }
  }

  // ---------- settings and the run ----------
  const cfg = { search: "hang", pool: "split", full: "reject", timeout: 0, rush: 1, speed: 1 };
  let model, clock, resAt, logAt, note, rushUntil, seed = 7;
  const WARM = 20;   // each run starts 20 s in, so the first frame shows the hold already working

  function restart(warm = WARM) {
    for (const id of [...tags.keys()]) drop(id);
    model = makeHold({ search: cfg.search, pool: cfg.pool, full: cfg.full, timeout: cfg.timeout, rush: cfg.rush }, seed);
    seed = (Date.now() % 1e6) + 1;
    clock = warm; model.runTo(clock);
    resAt = model.resolved.length; logAt = model.log.length; note = null; rushUntil = -1;
    heads.forEach((h) => h.querySelectorAll(":scope > [data-h]").forEach((g) => show(g, g.getAttribute("data-h") === (cfg.pool === "split" ? "full" : cfg.pool === "caps" ? "half" : "flat"))));
    capText.forEach((el) => setText(el, model.cap === Infinity ? L("NO CAP", "SIN TOPE") : L("CAP " + model.cap, "TOPE " + model.cap)));
    setText(timeoutText, cfg.timeout ? L("TIMEOUT: " + cfg.timeout + " S", "TIEMPO LÍMITE: " + cfg.timeout + " S") : L("TIMEOUT: OFF", "TIEMPO LÍMITE: NO"));
    reps.forEach((r) => { const sick = r.i === 0 && ((cfg.search === "hang" && r.n === 1) || cfg.search === "slow"); show(r.ok, !sick); show(r.sick, sick); });
    paint(0, true);
  }

  // ---------- narration ----------
  const name = (k) => NAMES[lang][k];
  function narrate() {
    // the readout follows the state (status below); the model's log is only trimmed here
    if (model.log.length > 2000) { model.log.splice(0, model.log.length); logAt = 0; }
  }
  // What the hold is doing, as [key, text]: a key holds the readout for a moment so it doesn't flicker.
  function status(busy, ok) {
    const qd = model.queues.reduce((a, l) => a + l.length, 0), door = model.door.length;
    if (qd) {
      const k = model.queues.reduce((m, l, i) => (l.length > model.queues[m].length ? i : m), 0), n = model.queues[k].length;
      return ["queue" + k, T(n + " " + name(k) + " requests queue for a place, each holding a worker · " + busy + " of " + WORKERS + " busy", n + " solicitudes de " + name(k) + " en fila por un lugar, cada una con su worker · " + busy + " de " + WORKERS + " ocupados")];
    }
    if (busy >= WORKERS && door) {
      const top = model.inFlight.indexOf(Math.max(...model.inFlight));
      return ["all", T("all " + WORKERS + " workers busy, " + model.inFlight[top] + " of them on " + name(top) + " calls · " + door + " waiting at the door", "los " + WORKERS + " workers ocupados, " + model.inFlight[top] + " en llamadas de " + name(top) + " · " + door + " esperando en la puerta")];
    }
    const full = [0, 1, 2].filter((k) => model.inFlight[k] >= model.cap);
    if (full.length) return ["full" + full[0], T(name(full[0]) + "'s compartment is full (" + model.cap + " calls) · new " + name(full[0]) + " requests turned away at once", "compartimento de " + name(full[0]) + " lleno (" + model.cap + " llamadas) · sus solicitudes nuevas se rechazan al instante")];
    return ["calm", T(busy + " of " + WORKERS + " workers busy · in time: " + ok.map((v, k) => name(k) + " " + v).join(", "), busy + " de " + WORKERS + " workers ocupados · a tiempo: " + ok.map((v, k) => name(k) + " " + v).join(", "))];
  }
  let shownKey = null, shownAt = -9;

  // ---------- painting ----------
  function paint(dt, snap) {
    snapping = !!snap;
    narrate();
    const seen = new Set();
    // requests at the door
    model.door.forEach((r, j) => { if (j >= G.DOOR_X.length || r.outcome) return; const tg = tagFor(r, [G.ENTRY_X, G.LANE_Y, G.QUAY_H]); route(tg, LANE(G.DOOR_X[j])); seen.add(r.id); });
    // requests on a worker: a call on the console, a queued request in the worker's hands
    model.workers.forEach((w) => {
      const r = w.req;
      if (!r) return;
      const tg = tagFor(r, [G.ENTRY_X, G.LANE_Y, G.QUAY_H]);
      route(tg, r.state === "call" ? G.CONSOLE[w.i] : G.HAND[w.i]);
      seen.add(r.id);
    });
    // requests that ended since the last frame: answered ones fade on the console, turned-away ones drop into the trough
    for (; resAt < model.resolved.length; resAt++) {
      const e = model.resolved[resAt];
      if (e.t < clock - 3) continue;
      const id = e.id;
      if (e.outcome === "turned" || e.outcome === "door" || e.outcome === "gaveup") {
        const tg = tagFor({ id, kind: e.kind }, [G.ENTRY_X, G.LANE_Y, G.QUAY_H]);
        const x = e.outcome === "turned" ? G.CX[e.kind] - 12 + (id % 5) * 6 : tg.pos[0] > G.DOOR_X[G.DOOR_X.length - 1] - 4 && !inside(tg.pos) ? tg.pos[0] : G.DOOR_X[G.DOOR_X.length - 1];
        route(tg, [x, G.TROUGH_Y, G.QUAY_H - 1.4]);
        tg.leaving = "trough";
      } else if (tags.has(id)) tags.get(id).leaving = "done";
    }
    if (resAt > 3000) { model.resolved.splice(0, resAt - 500); resAt = 500; }

    const now = performance.now();
    const move = snap ? Infinity : SPEED * dt * Math.max(1, cfg.speed);
    for (const [id, r] of tags) {
      const active = seen.has(id);
      if (!active && !r.leaving) r.leaving = "done";
      if (active) { r.leaving = null; r.until = 0; }
      if (snap && r.leaving) { drop(id); continue; }
      // a tag that is done finishes its trip first, then fades: on the console, or in the trough
      if (r.leaving && !r.path.length && !r.until) r.until = now + (r.leaving === "trough" ? 700 : 380);
      if (r.leaving && r.until && now > r.until) { drop(id); continue; }
      advance(r, move);
      // layer: in front of the hull wall on the quay, inside the compartment it is over otherwise
      const layer = inside(r.pos) ? inL[compOf(r.pos[0])] : quayL;
      if (r.layer !== layer) { r.layer = layer; layer.appendChild(r.el.g); }
      r.el.g.setAttribute("transform", translateAlong(P, r.pos));
      r.el.g.__d = r.pos[0] + r.pos[1];
      const op = r.leaving && r.until ? clamp((r.until - now) / 400) : clamp((now - r.born) / 250);
      r.el.g.style.opacity = op < 1 ? String(op) : "";
    }
    // painter's order within each layer: far tags first
    for (const layer of [...inL, quayL]) {
      const kids = [...layer.children];
      const sorted = [...kids].sort((a, b) => a.__d - b.__d);
      if (sorted.some((el, n) => el !== kids[n])) sorted.forEach((el) => layer.appendChild(el));
    }
    // lit: a request (and its worker) held past the deadline
    const late = (r) => r && clock - r.born > DEADLINE;
    for (const [id, r] of tags) {
      const req = model.workers.find((w) => w.req && w.req.id === id)?.req;
      const on = !!req && late(req);
      if (r.el.shown.lit !== on) { r.el.shown.lit = on; lit(r.el.body, on); r.el.letter.setAttribute("data-tone", on ? "on-lit" : "hi"); }
    }
    model.workers.forEach((w, i) => { const on = late(w.req); if (workers[i].__lit !== on) { workers[i].__lit = on; workers[i].forEach((el) => lit(el, on)); } });

    // counters, stats and the readout
    const busy = model.busy();
    busyC.setClamped(busy); busyDial.set(busy / WORKERS); doorC.setClamped(model.door.length);
    const recent = model.resolved.filter((e) => e.t > clock - 30);
    const ok = [0, 1, 2].map((k) => { const rs = recent.filter((e) => e.kind === k); return rs.length ? Math.round((100 * rs.filter((e) => e.outcome === "ok").length) / rs.length) : 100; });
    [0, 1, 2].forEach((k) => {
      flight[k].setClamped(model.inFlight[k]);
      const full = model.inFlight[k] >= model.cap;
      if (fullG[k].__lit !== full) { fullG[k].__lit = full; lit(fullG[k], full); }
      okC[k].setClamped(ok[k]);
      stat("s" + k, ok[k] + "%");
    });
    stat("busy", busy + " / " + WORKERS);
    stat("turned", recent.filter((e) => e.outcome === "turned" || e.outcome === "door" || e.outcome === "gaveup").length);
    stat("door", model.door.length);
    if (note && clock - note.t < 2) { say(note.text); shownKey = null; }
    else {
      const [key, text] = status(busy, ok.map((v) => v + "%"));
      const hold = shownKey && key !== shownKey && clock - shownAt < 1.5 * Math.max(1, cfg.speed);
      if (!hold) { if (key !== shownKey) { shownKey = key; shownAt = clock; } say(text); }
    }
  }

  // ---------- the loop ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    clock += dt * cfg.speed;
    if (rushUntil > 0 && clock > rushUntil) { model.cfg.rush = cfg.rush; rushUntil = -1; note = { t: clock, text: T("the rush is over", "terminó la avalancha") }; }
    model.runTo(clock); paint(dt);
  }, onPause: pause.onPause });
  pause.bind(loop);

  const NUM = ["timeout", "rush"];
  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = NUM.includes(name) ? Number(raw) : String(raw);
    if (!quiet) { restart(); note = { t: clock, text: T("settings applied · run restarted", "ajustes aplicados · ejecución reiniciada") }; }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    rush20: () => { model.cfg.rush = 4; rushUntil = clock + 20; note = { t: clock, text: T("checkout rush: 4 a second for 20 s", "avalancha de compras: 4 por segundo durante 20 s") }; wake(); },
    reset: () => { restart(); note = { t: clock, text: T("started over", "empezó de nuevo") }; },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const k of ["search", "pool", "full", "timeout", "rush"]) set(k, String(w[k]), true);
    set("speed", String(w.speed || 1));
    restart();
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

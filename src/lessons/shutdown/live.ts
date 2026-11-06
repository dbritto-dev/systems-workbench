// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The shop at closing time in the browser: runs the model (a rolling deploy that deletes pod B, lets it shut down
// and starts a replacement, over and over), walks customers along their paths as the model routes, serves, refuses
// and cuts them, and answers the controls. mount() gets the build-time data from page.ts (projection, geometry, the
// customer and ticket drawings) and root, the <wb-lesson>.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setLit, setText, playPause } from "../../runtime/dom";
import { makeSim } from "./sim";

export default function mount({ P, G, WALKER_SVG, TICKET_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const layers = { shop: q('[data-layer="shop"]'), street: q('[data-layer="street"]'), tickets: q('[data-layer="tickets"]') };
  const counters = Object.fromEntries(["tookI", "tookF", "inflight", "served", "refused", "cut"].map((n) => [n, WB.counter(svg, n, P)]));
  const moreEl = q("[data-more]");
  const pins = { term: q('[data-pin="term"]'), kill: q('[data-pin="kill"]') };
  const marks = { knew: q('[data-mark="knew"]'), gone: q('[data-mark="gone"]'), now: q('[data-mark="now"]') };
  const capsule = q("[data-capsule]"), plaqueB = q('[data-plaque="B"]'), shutter = q("[data-shutter]");
  const signs = Object.fromEntries([...svg.querySelectorAll("[data-sign]")].map((el) => [el.getAttribute("data-sign"), el]));
  const stat = (key, value) => root.stat(key, value);
  const railX = (s) => G.RAIL.x0 + G.RAIL.per * Math.max(0, Math.min(G.RAIL.secs, s));
  const slide = (el, s) => el.setAttribute("transform", translateAlong(P, [railX(s), 0, 0]));

  // ---------- paths ----------
  const F = G.SHOP_FRONT;
  const STEP_FRONT = [G.DOOR_X, G.LANE_Y, 0], STEP_TOP = [G.DOOR_X, F + 1.8, G.STEP.h], DOOR_IN = [G.DOOR_X, F - 3, G.FLOOR], WALK_IN = [G.DOOR_X, G.WALKWAY_Y, G.FLOOR];
  const SPAWN = G.SPAWN, QUEUE = G.QUEUE, GONE_AWAY = [-22, G.LANE_Y - 0.5, 0], TURNED = [-94, G.LANE_Y - 1, 0];
  const intoSpot = (j) => [STEP_TOP, DOOR_IN, WALK_IN, [G.SPOTS[j][0], G.WALKWAY_Y, G.FLOOR], G.SPOTS[j]];
  const outOfSpot = (j) => [[G.SPOTS[j][0], G.WALKWAY_Y, G.FLOOR], WALK_IN, DOOR_IN, STEP_TOP, STEP_FRONT];
  const toOthers = (n) => { const x = G.OTH_DOORS[n % 2]; return [[x - 6, G.LANE_Y, 0], [x, G.OTH_FRONT + 2.5, 0]]; };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  // ---------- customers and tickets: pooled elements ----------
  const pool = [], walkers = new Set();
  function walker(pos, keep) {
    let w = pool.pop();
    if (!w) {
      const g = document.createElementNS(NS, "g");
      g.innerHTML = WALKER_SVG;
      w = { g, tones: { new: g.querySelector('[data-tone="new"]'), keep: g.querySelector('[data-tone="keep"]') } };
    }
    Object.assign(w, { pos: [...pos], path: [], speed: 40, fadeFrom: null, fadeLen: 0, lit: false, layer: null, onArrive: null, unlitAt: null });
    show(w.tones.new, !keep); show(w.tones.keep, !!keep);
    setLit(w.g, false); w.g.style.opacity = "";
    walkers.add(w);
    return w;
  }
  function drop(w) { if (!walkers.has(w)) return; walkers.delete(w); w.g.remove(); pool.push(w); }
  const go = (w, path, speed = 40) => { w.path = path.map((p) => [...p]); w.speed = speed; };
  const timed = (w, path, secs) => { let len = 0, a = w.pos; for (const p of path) { len += dist(a, p); a = p; } go(w, path, len / Math.max(0.35, secs)); };
  const fade = (w, secs = 0.6) => { if (w.fadeFrom == null) { w.fadeFrom = clock; w.fadeLen = secs; } };
  const light = (w, on) => { w.lit = on; setLit(w.g, on); };

  const tickets = new Map();
  const tpool = [];
  function ticket(req) {
    if (req.spot < 0) return;
    let k = tpool.pop();
    if (!k) { const g = document.createElementNS(NS, "g"); g.innerHTML = TICKET_SVG; k = { g, short: g.querySelector('[data-len="short"]'), long: g.querySelector('[data-len="long"]') }; }
    show(k.short, !req.long); show(k.long, req.long);
    setLit(k.g, false); k.g.style.opacity = ""; k.fadeFrom = null;
    k.g.setAttribute("transform", translateAlong(P, [G.SPOTS[req.spot][0], G.TICKET_Y, G.TICKET_Z]));
    const before = [...layers.tickets.children].find((c) => Number(c.dataset.x) > req.spot);
    k.g.dataset.x = String(req.spot);
    layers.tickets.insertBefore(k.g, before || null);
    tickets.set(req.id, k);
  }
  function unticket(id, cut) {
    const k = tickets.get(id);
    if (!k) return;
    tickets.delete(id);
    if (cut) { setLit(k.g, true); k.fadeFrom = clock; fading.add(k); return; }
    k.g.remove(); tpool.push(k);
  }
  const fading = new Set();

  // ---------- settings and the run ----------
  const cfg = { onTerm: "stop", preStop: "0", grace: "30", work: "short", conns: "new", router: "fast", speed: 1 };
  let model, clock, logAt, note, seed = 5;
  const byW = new Map(), byReq = new Map(), byClient = new Map();

  // firstIn: seconds from now to the first delete; negative when the delete happened that long before the first frame
  // (a Watch that would otherwise wait half a minute for SIGKILL). useSeed: a fixed seed for a Watch.
  function restart(firstIn = 2.5, useSeed = null) {
    for (const w of [...walkers]) drop(w);
    for (const id of [...tickets.keys()]) unticket(id, false);
    for (const k of fading) { k.g.remove(); tpool.push(k); }
    fading.clear(); byW.clear(); byReq.clear(); byClient.clear();
    const warm = (cfg.work === "exports" ? 40 : 8) + Math.max(0, -firstIn);
    model = makeSim({ onTerm: cfg.onTerm, preStop: Number(cfg.preStop), grace: Number(cfg.grace), work: cfg.work, conns: cfg.conns, router: cfg.router, auto: true, firstAt: warm + firstIn }, useSeed ?? seed);
    if (useSeed == null) seed = (seed * 7 + 3) % 9973 + 1;
    clock = warm; note = null;
    model.runTo(clock);
    logAt = model.log.length;
    // what is in the shop at the start: customers at their spots, their tickets on the counter
    for (const req of model.inflight) {
      ticket(req);
      if (req.reg == null && req.spot >= 0) { const w = walker(G.SPOTS[req.spot], false); byReq.set(req.id, w); }
    }
    for (const reg of model.regs) { const w = walker(G.SPOTS[reg.spot], true); byClient.set(reg.id, w); }
    slide(pins.term, Number(cfg.preStop)); slide(pins.kill, Number(cfg.grace));
    paint(0, true);
  }

  // ---------- the model's log: walk customers and narrate ----------
  const keep = () => model.cfg.conns === "keep";
  // A note for the readout: held `hold` seconds of page time, and dropped sooner once `still()` is false (the state it
  // describes is gone). en/es may be functions, for a number that changes while the note shows.
  function tell(at, en, es, hold = 2.6, still = null) { note = { t: at, until: at + hold * Math.max(1, cfg.speed), en, es, still }; }
  const s1 = (x) => (Math.floor(x * 10 + 1e-6) / 10).toFixed(1) + " s";   // to a tenth, rounded down, as on the wheels
  function scan() {
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt];
      if (e.t > clock) break;
      const sd = model.sd;
      switch (e.type) {
        case "routed": {
          const c = e.w.client;
          const w = (c != null && byClient.get(c)) || walker(SPAWN, c != null);
          timed(w, c != null && byClient.has(c) ? [STEP_FRONT] : [QUEUE, STEP_FRONT], e.w.at - e.t);
          byW.set(e.w.id, w);
          if (!model.routed) break;
          if (!model.listed && sd) tell(e.t, "the doorman still sends a customer to B", "el portero todavía manda un cliente a B", 1.6, () => model.routed);
          break;
        }
        case "elsewhere": {
          const c = e.client;
          const w = (c != null && byClient.get(c)) || walker(SPAWN, c != null);
          if (c != null) byClient.delete(c);
          go(w, c != null ? toOthers(c) : [QUEUE, ...toOthers(Math.floor(e.t * 7))], 70);
          w.onArrive = () => fade(w);
          break;
        }
        case "refused": {
          const w = byW.get(e.w.id); byW.delete(e.w.id);
          if (!w) break;
          light(w, true); w.unlitAt = clock + 1.4;
          if (e.w.client != null) { go(w, [QUEUE], 30); byClient.set(e.w.client, w); }
          else { go(w, [TURNED], 26); w.onArrive = () => fade(w, 0.8); }
          tell(e.t, "B is not listening · refused (" + (sd ? sd.refused : 0) + " this shutdown)", "B no escucha · rechazado (" + (sd ? sd.refused : 0) + " en este apagado)", 1.8, () => !model.listening);
          break;
        }
        case "start": {
          const req = e.req;
          ticket(req);
          if (req.w == null) break;
          let w = byW.get(req.w); byW.delete(req.w);
          if (!w) w = walker(STEP_FRONT, req.reg != null);
          if (req.spot >= 0) go(w, intoSpot(req.spot), 30);
          else { go(w, [STEP_TOP, DOOR_IN], 30); w.onArrive = () => fade(w); }
          if (req.reg != null) byClient.set(req.reg, w); else byReq.set(req.id, w);
          break;
        }
        case "done": {
          unticket(e.req.id, false);
          const w = byReq.get(e.req.id);
          if (!w) break;
          byReq.delete(e.req.id);
          go(w, [...outOfSpot(e.req.spot), GONE_AWAY], 32);
          w.onArrive = () => fade(w);
          break;
        }
        case "cut": {
          unticket(e.req.id, true);
          const w = byReq.get(e.req.id);
          if (w) { byReq.delete(e.req.id); light(w, true); go(w, []); fade(w, 1.4); }
          break;
        }
        case "left": {
          const w = byClient.get(e.reg.id);
          if (!w) break;
          if (e.why === "reset") { light(w, true); w.unlitAt = clock + 1.2; }
          go(w, [...outOfSpot(e.reg.spot), QUEUE], 32);
          if (e.why === "closed") tell(e.t, "B closes a keep-alive connection · the client will reconnect through the doorman", "B cierra una conexión keep-alive · el cliente volverá a conectarse por el portero", 2.2);
          break;
        }
        case "delete": {
          const at0 = sd;
          tell(e.t, model.cfg.preStop ? "pod B deleted · preStop sleep " + model.cfg.preStop + " s before SIGTERM · the doorman hasn't heard" : "pod B deleted · SIGTERM at once · the doorman hasn't heard", model.cfg.preStop ? "pod B borrado · pausa preStop de " + model.cfg.preStop + " s antes de SIGTERM · el portero no se enteró" : "pod B borrado · SIGTERM de inmediato · el portero no se enteró", 2.6, () => model.routed && model.sd === at0 && (model.phase === "prestop" || !model.cfg.preStop));
          break;
        }
        case "sigterm":
          if (model.cfg.preStop) {
            if (model.cfg.onTerm === "exit") tell(e.t, "SIGTERM · the app exits at once", "SIGTERM · la app sale de inmediato", 2.4);
            else tell(e.t, () => "SIGTERM · B stops accepting, finishing " + model.inflight.length + " in progress", () => "SIGTERM · B deja de aceptar y termina " + model.inflight.length + " en curso", 2.4, () => model.phase === "draining");
          }
          break;
        case "news":
          if (e.kind === "remove") tell(e.t, "the capsule arrives · the doorman crosses B off, " + s1(e.t - sd.t0) + " after the delete", "llega la cápsula · el portero tacha a B, " + s1(e.t - sd.t0) + " después del borrado", 2.4);
          else tell(e.t, "the new pod B is back on the doorman's list", "el pod B nuevo vuelve a la lista del portero", 2, () => model.routed);
          break;
        case "sigkill":
          tell(e.t, "SIGKILL at " + model.cfg.grace + " s · " + sd.killed + (sd.killed === 1 ? " request" : " requests") + " cut", "SIGKILL a los " + model.cfg.grace + " s · " + sd.killed + (sd.killed === 1 ? " solicitud cortada" : " solicitudes cortadas"), 3);
          break;
        case "gone":
          if (e.why !== "kill") tell(e.t, "pod B gone, " + s1(e.t - sd.t0) + " after the delete" + (sd.cut ? " · " + sd.cut + " cut" : ""), "pod B terminado, " + s1(e.t - sd.t0) + " después del borrado" + (sd.cut ? " · " + sd.cut + " cortadas" : ""), 2.6, () => model.phase === "gone");
          break;
        case "starting": {
          // after SIGKILL, keep what it cut in the readout while the new pod starts
          const k = sd && sd.how === "kill" ? sd.killed : -1;
          if (k >= 0) tell(e.t, "SIGKILL at " + model.cfg.grace + " s cut " + k + (k === 1 ? " request" : " requests") + " · a new pod B starting", "SIGKILL a los " + model.cfg.grace + " s cortó " + k + (k === 1 ? " solicitud" : " solicitudes") + " · arranca un pod B nuevo", 3, () => model.phase === "starting");
          else tell(e.t, "a new pod B starting", "arranca un pod B nuevo", 2, () => model.phase === "starting");
          break;
        }
      }
    }
  }

  // ---------- drawing ----------
  function paint(dt, snap) {
    scan();
    const step = dt * cfg.speed;
    const byLayer = { shop: [], street: [] };
    for (const w of [...walkers]) {
      let budget = w.speed * step;
      while (w.path.length && budget > 0) {
        const p = w.path[0], d = dist(w.pos, p);
        if (d <= budget || snap) { w.pos = [...p]; w.path.shift(); budget -= d; if (!w.path.length && w.onArrive) { const f = w.onArrive; w.onArrive = null; f(); } }
        else { const u = budget / d; for (let i = 0; i < 3; i++) w.pos[i] += (p[i] - w.pos[i]) * u; budget = 0; }
      }
      if (w.unlitAt != null && clock > w.unlitAt) { w.unlitAt = null; light(w, false); }
      if (w.fadeFrom != null) {
        const o = 1 - (clock - w.fadeFrom) / w.fadeLen;
        if (o <= 0 || snap) { drop(w); continue; }
        w.g.style.opacity = String(o);
      }
      const layer = w.pos[1] < F - 1 ? "shop" : "street";
      if (w.layer !== layer) { w.layer = layer; layers[layer].appendChild(w.g); }
      w.g.setAttribute("transform", translateAlong(P, w.pos));
      byLayer[layer].push(w);
    }
    for (const [name, list] of Object.entries(byLayer)) {
      list.sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P));
      const kids = [...layers[name].children];
      if (list.some((w, i) => kids[i] !== w.g)) list.forEach((w) => layers[name].appendChild(w.g));
    }
    for (const k of [...fading]) {
      const o = 1 - (clock - k.fadeFrom) / 1.4;
      if (o <= 0 || snap) { fading.delete(k); k.g.remove(); tpool.push(k); } else k.g.style.opacity = String(o);
    }

    // the pod, the lists, the capsule
    const ph = model.phase;
    for (const [key, el] of Object.entries(signs)) show(el, key === (ph === "open" ? "open" : ph === "gone" ? "closed" : ph === "starting" ? "starting" : "closing"));
    show(shutter, !model.listening);
    show(plaqueB, model.listed);
    WB.pose(svg, "peg-B", model.routed ? (model.listed ? "up" : "stale") : "down");
    const news = model.news;
    show(capsule, !!news);
    if (news) { const u = Math.max(0, Math.min(1, (clock - news.sent) / (news.at - news.sent))); capsule.setAttribute("transform", translateAlong(P, [G.TUBE.x, G.TUBE.y0 + 5 + u * (G.TUBE.y1 - G.TUBE.y0 - 8), G.TUBE.z])); }

    // the shutdown clock
    const sd = model.sd;
    const since = sd ? (sd.gone != null ? sd.gone : clock) - sd.t0 : 0;
    show(marks.now, !sd || sd.gone == null);
    slide(marks.now, sd && sd.gone == null ? clock - sd.t0 : 0);
    show(marks.knew, !!(sd && sd.knew != null));
    if (sd && sd.knew != null) slide(marks.knew, sd.knew - sd.t0);
    show(marks.gone, !!(sd && sd.gone != null));
    if (sd && sd.gone != null) slide(marks.gone, sd.gone - sd.t0);

    const st = model.st;
    const tenths = Math.min(999, Math.floor(since * 10 + 1e-6));
    counters.tookI.set(Math.floor(tenths / 10)); counters.tookF.set(tenths % 10);
    const more = model.inflight.filter((r) => r.spot < 0).length;
    setText(moreEl, more ? "+" + more : "");
    counters.inflight.setClamped(model.inflight.length);
    counters.served.setClamped(st.served); counters.refused.setClamped(st.refused); counters.cut.setClamped(st.cut);
    stat("inflight", model.inflight.length);
    stat("served", st.served);
    stat("refused", st.refused);
    stat("cut", st.cut);
    stat("since", sd ? (tenths / 10).toFixed(1) + " s" + (sd.gone != null ? L(" (gone)", " (terminado)") : "") : "—");
    const PH = { open: T("Open", "Abierto"), prestop: T("preStop sleep", "Pausa preStop"), draining: T("Draining", "Vaciando"), gone: T("Gone", "Terminado"), starting: T("Starting", "Arrancando") };
    stat("phase", L(PH[ph]) + (ph !== "starting" && ph !== "gone" && !model.listed ? L(", deleted", ", borrado") : ""));

    if (note && (clock >= note.until || (note.still && !note.still()))) note = null;
    if (note) { const f = (v) => (typeof v === "function" ? v() : v); root.figure.say(L(f(note.en), f(note.es))); }
    else root.figure.say(L(status(ph, sd, "en"), status(ph, sd, "es")));
  }
  function status(ph, sd, lang) {
    const es = lang === "es", n = model.inflight.length;
    const heard = model.routed ? (es ? "el portero todavía lo tiene en su lista" : "still on the doorman's list") : (es ? "el portero ya lo tachó" : "off the doorman's list");
    if (ph === "open") return es ? "pod B abierto · " + n + " en curso" : "pod B open · " + n + " in progress";
    if (ph === "prestop") return es ? "pausa preStop · " + Math.max(0, sd.t0 + model.cfg.preStop - clock).toFixed(1) + " s para SIGTERM · " + heard : "preStop sleep · " + Math.max(0, sd.t0 + model.cfg.preStop - clock).toFixed(1) + " s to SIGTERM · " + heard;
    if (ph === "draining") return es ? "sin aceptar · terminando " + n + " · SIGKILL en " + Math.max(0, sd.t0 + model.cfg.grace - clock).toFixed(0) + " s · " + heard : "not accepting · finishing " + n + " · SIGKILL in " + Math.max(0, sd.t0 + model.cfg.grace - clock).toFixed(0) + " s · " + heard;
    if (ph === "gone") return es ? "pod B terminado · " + heard : "pod B gone · " + heard;
    return es ? "arranca un pod B nuevo" : "a new pod B is starting";
  }

  // ---------- the loop ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(dt, false); }, onPause: pause.onPause });
  pause.bind(loop);
  const wake = () => { if (loop.paused) loop.setPaused(false); };

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = String(raw);
    if (!quiet) { restart(); tell(clock, "settings applied · run restarted", "ajustes aplicados · ejecución reiniciada", 1.5); }
  }
  root.on("change", (name, value) => set(name, value));
  const actions = {
    delete: () => { if (!model.remove(clock)) tell(clock, "pod B isn't open right now", "el pod B no está abierto ahora", 1.6); wake(); },
    reset: () => { restart(); tell(clock, "started over", "empezó de nuevo", 1.5); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings, and a delete a couple of seconds in ----------
  root.on("watch", (w) => {
    for (const key of ["onTerm", "preStop", "grace", "work", "conns", "router"]) set(key, String(w[key]), true);
    set("speed", String(w.speed || 1));
    restart(w.firstIn ?? 2, w.seed ?? null);
    wake();
  });

  loop.setPaused(loop.paused);
  restart(7);
}

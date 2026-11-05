// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The sorting room in the browser: runs the model, eases parcels toward where it has them (conveyor, desks, retry
// shelf, cage, the ledger drawer they update), and answers the controls. mount() gets the build-time data from
// page.ts (projection, geometry, the parcel drawing) and root, the <wb-lesson>.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setLit, playPause } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { makeSim, backoff } from "./sim";

export default function mount({ P, G, PARCEL_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const layers = { back: q('[data-layer="back"]'), pile: q('[data-layer="pile"]'), mid: q('[data-layer="mid"]'), front: q('[data-layer="front"]') };
  const counters = Object.fromEntries(["lag", "oldest", "dead", "done", "stale", "rec0", "rec1", "rec2", "rec3"].map((n) => [n, WB.counter(svg, n, P)]));
  const backoffMeter = WB.meter(svg, "backoff", P);
  const dueMeters = G.SHELF_X.map((_, i) => WB.meter(svg, "due" + i, P));
  const tabs = [0, 1, 2, 3].map((i) => q('[data-tab="' + i + '"]'));
  const statusEls = { ok: q('[data-status="ok"]'), flaky: q('[data-status="flaky"]'), down: q('[data-status="down"]') };
  const flagOn = q('[data-flag="on"]'), flagOff = q('[data-flag="off"]');
  const stamps = { main: q('[data-stamp="main"]'), retry: q('[data-stamp="retry"]') };
  const KEYS = "ABCD";
  const stat = (key, value) => root.stat(key, value);

  // ---------- parcels: one pooled element per parcel on screen ----------
  const free = [];
  function makeEl() {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = PARCEL_SVG;
    return { g, body: g.querySelector("[data-body]"), num: g.querySelector("[data-num]"), key: g.querySelector("[data-key]"), bad: g.querySelector("[data-bad]"), tag: g.querySelector("[data-tag]"), tries: g.querySelector("[data-tries]"), shown: {} };
  }
  const recs = new Map();   // id -> { el, m, pos, target, layer, leaving, until, seen }
  function drop(id) { const r = recs.get(id); r.el.g.remove(); free.push(r.el); recs.delete(id); }
  function dress(r, lit, tries) {
    const m = r.m, el = r.el, s = el.shown;
    if (s.id !== m.id) {
      s.id = m.id;
      const txt = String(m.v);
      el.num.textContent = txt; el.num.setAttribute("font-size", txt.length <= 2 ? 3.6 : 2.8);
      el.key.textContent = KEYS[m.key];
      el.bad.style.display = m.bad ? "" : "none";
    }
    if (s.lit !== lit) { s.lit = lit; el.body.toggleAttribute("data-lit", lit); el.body.toggleAttribute("data-lit-fill", lit); for (const x of [el.num, el.key]) x.setAttribute("data-tone", lit ? "on-lit" : "hi"); }
    const tg = tries ? String(tries) : "";
    if (s.tag !== tg) { s.tag = tg; el.tag.style.display = tg ? "" : "none"; if (tg) { el.tries.textContent = tg; el.tries.setAttribute("font-size", tg.length > 1 ? 2.8 : 3.2); } }
  }

  // ---------- settings and the run ----------
  const cfg = { rate: 0.6, flaky: 0.1, attempts: "3", mode: "inplace", parse: "retry", stale: "apply", speed: 1 };
  const WARM = 30;   // each run starts half a minute in, so the first frame shows a working line
  let model, clock, logAt, note, lastDead, lastOk, seed = 5, poisonKey = 0;

  function modelCfg(script = []) {
    return { rate: Number(cfg.rate), flaky: Number(cfg.flaky), attempts: cfg.attempts === "inf" ? Infinity : Number(cfg.attempts), mode: cfg.mode, parse: cfg.parse, stale: cfg.stale, script };
  }
  // The first run opens a few seconds into an outage (as any run would after "Outage"), so the first frame shows the
  // cage filling and the line backing up; Start over and every setting begin from a quiet line.
  let first = true;
  function restart(script = []) {
    for (const id of [...recs.keys()]) drop(id);
    const opening = first ? [{ dt: -12, type: "outage" }] : [];
    first = false;
    model = makeSim(modelCfg([...opening, ...script].map((s) => ({ ...s, t: WARM + s.dt }))), seed);
    seed = (seed * 7 + 3) % 9973 + 1;
    clock = WARM; note = null; lastDead = -9; lastOk = { main: -9, retry: -9 };
    model.runTo(clock);
    logAt = model.log.length;
    paint(0, true);
  }

  // ---------- narration: the model's log ----------
  const who = (m) => KEYS[m.key] + m.v;
  function tell(at, en, es, hold = 2.5) { note = { t: at, until: at + hold, text: T(en, es) }; }
  function scan() {
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt], m = e.m;
      if (e.t > clock) break;
      if (e.by) lastOk[e.by] = e.t;
      switch (e.type) {
        case "badIn": tell(e.t, "malformed " + who(m) + " joins the line · it can never succeed", "entra " + who(m) + " malformado · nunca va a funcionar"); break;
        case "down": tell(e.t, "downstream down for " + e.secs + " s · every call fails", "el destino cae por " + e.secs + " s · toda llamada falla", 3); break;
        case "up": tell(e.t, "downstream back up", "el destino volvió", 2); break;
        case "wait":
          if (m.bad || e.wait >= 4) tell(e.t, who(m) + " failed " + m.tries + "× · head waits " + e.wait + " s · " + (model.line.length - 1) + " behind it", who(m) + " falló " + m.tries + " veces · la cabeza espera " + e.wait + " s · " + (model.line.length - 1) + " detrás");
          break;
        case "shelf": if (m.bad || m.tries > 1) tell(e.t, who(m) + " to the retry shelf for " + e.wait + " s · the line moves on", who(m) + " al estante por " + e.wait + " s · la fila sigue"); break;
        case "dead":
          lastDead = e.t;
          if (m.bad) tell(e.t, "malformed " + who(m) + " into the cage · the line moves again", who(m) + " malformado a la jaula · la fila vuelve a moverse", 3);
          else if (e.why === "attempts") tell(e.t, "good " + who(m) + " out of attempts · into the cage", who(m) + " (bueno) sin intentos · a la jaula", 3);
          break;
        case "back": tell(e.t, who(m) + " applied after " + KEYS[m.key] + e.had + " · record " + KEYS[m.key] + " went back", who(m) + " aplicado después de " + KEYS[m.key] + e.had + " · el registro " + KEYS[m.key] + " retrocedió", 3); break;
        case "skip": tell(e.t, who(m) + " older than " + KEYS[m.key] + e.had + " · skipped", who(m) + " más viejo que " + KEYS[m.key] + e.had + " · se omite", 2.5); break;
        case "redrive": tell(e.t, e.n ? e.n + " redriven to the tail of the line" : "the cage is empty", e.n ? e.n + " reenviados al final de la fila" : "la jaula está vacía", 3); break;
      }
    }
  }

  // ---------- placing parcels ----------
  function place(m, pos, layer, lit, tries) {
    let r = recs.get(m.id);
    if (!r) {
      const fresh = m.born > clock - 1.2 && m.tries <= 1;
      r = { el: free.pop() || makeEl(), m, pos: fresh ? [...G.PROD_SPOT] : [...pos], layer: null };
      recs.set(m.id, r);
    }
    r.m = m; r.target = pos; r.leaving = false; r.seen = true;
    if (r.layer !== layer) { r.layer = layer; layers[layer].appendChild(r.el.g); }
    dress(r, lit, tries);
  }

  function paint(dt, snap) {
    scan();
    for (const r of recs.values()) r.seen = false;
    const line = model.line, w = model.worker, rw = model.rworker;
    // the head on the desk while the worker has it; the rest on the conveyor, then the overflow pallet
    let i0 = 0;
    if (w.m && line[0] === w.m) { place(w.m, G.DESK_SPOT, "back", w.phase === "work", w.m.tries > 1 || w.phase === "wait" ? w.m.tries : 0); i0 = 1; }
    for (let i = i0; i < line.length; i++) {
      const j = i - i0;
      if (j < G.SLOTS) { place(line[i], [G.SLOT_X[j], G.LANE_Y, G.LANE_Z], "back", false, line[i].tries); continue; }
      const k = j - G.SLOTS, layer = Math.floor(k / 4), c = k % 4;
      if (layer < G.PILE.layers) place(line[i], [G.PILE.xs[c % 2], G.PILE.ys[Math.floor(c / 2)], G.PILE.z + layer * G.PILE.step], "pile", false, line[i].tries);
    }
    const shelf = [...model.shelf].sort((a, b) => a.since - b.since);
    shelf.slice(0, G.SHELF_X.length).forEach((s, k) => place(s.m, [G.SHELF_X[k], G.SHELF_Y, G.SHELF_Z], "mid", false, s.m.tries));
    if (rw.m) place(rw.m, G.RDESK_SPOT, "mid", rw.phase === "work", rw.m.tries);
    model.dlq.slice(-G.CAGE_SPOTS.length).forEach((m, n) => place(m, G.CAGE_SPOTS[n], "back", false, m.tries));

    // parcels the model no longer holds were done: they fly to their customer's drawer and fade
    const now = performance.now();
    for (const [id, r] of recs) {
      if (r.seen) continue;
      if (!r.leaving) {
        r.leaving = true; r.until = now + 800;
        r.target = [...G.DRAWER_SPOT[r.m.key]];
        if (r.layer !== "front") { r.layer = "front"; layers.front.appendChild(r.el.g); }
        dress(r, false, 0);
      }
      if (snap || now > r.until) drop(id);
    }

    // move everything toward its target, with a little lift while travelling
    const f = snap ? 1 : 1 - Math.exp(-dt * 9 * Math.min(2, Math.max(1, cfg.speed / 2)));
    const byLayer = {};
    for (const r of recs.values()) {
      const [tx, ty, tz] = r.target;
      const dist = Math.hypot(tx - r.pos[0], ty - r.pos[1]);
      r.pos[0] = lerp(r.pos[0], tx, f); r.pos[1] = lerp(r.pos[1], ty, f);
      r.pos[2] = snap ? tz : lerp(r.pos[2], tz + Math.min(10, dist * 0.2), f);
      r.el.g.setAttribute("transform", translateAlong(P, r.pos));
      if (r.leaving) r.el.g.style.opacity = String(Math.max(0, Math.min(1, (r.until - now) / 500)));
      else if (r.el.g.style.opacity) r.el.g.style.opacity = "";
      (byLayer[r.layer] ||= []).push(r);
    }
    // painter's order inside each layer: far parcels first
    for (const [name, list] of Object.entries(byLayer)) {
      list.sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P));
      const kids = [...layers[name].children];
      if (list.some((r, k) => kids[k] !== r.el.g)) list.forEach((r) => layers[name].appendChild(r.el.g));
    }

    // desks, meters, board, cage, ledger
    backoffMeter.set(w.phase === "wait" ? Math.max(0, (w.end - clock) / backoff(w.m.tries)) : 0);
    dueMeters.forEach((mt, k) => mt.set(shelf[k] ? Math.max(0, (shelf[k].due - clock) / Math.max(0.01, shelf[k].due - shelf[k].since)) : 0));
    for (const [name, el] of Object.entries(stamps)) { const k = clock - lastOk[name]; const press = k >= 0 && k < 0.35 ? Math.sin((Math.PI * k) / 0.35) : 0; el.setAttribute("transform", press ? translateAlong(P, [0, 0, -2.4 * press]) : ""); }
    const down = model.isDown(), flaky = !down && model.cfg.flaky > 0;
    show(statusEls.down, down); show(statusEls.flaky, flaky); show(statusEls.ok, !down && !flaky);
    const fresh = clock - lastDead < 3;
    show(flagOn, fresh); show(flagOff, !fresh);
    model.records.forEach((rec, k) => { counters["rec" + k].set(rec.v % 100); setLit(tabs[k], clock - rec.backAt < 3); });

    const st = model.st, oldest = model.oldestWait();
    counters.lag.setClamped(line.length); counters.oldest.setClamped(Math.round(oldest));
    counters.dead.setClamped(model.dlq.length); counters.done.setClamped(st.done); counters.stale.setClamped(st.stale + st.skipped);
    stat("lag", line.length);
    stat("oldest", oldest < 10 ? oldest.toFixed(1) + " s" : Math.round(oldest) + " s");
    stat("done", st.done);
    stat("retries", st.retries);
    const good = model.dlq.filter((m) => !m.bad).length;
    stat("dead", model.dlq.length + (good ? L(" (" + good + " good)", " (" + good + " buenos)") : ""));
    stat("stale", st.stale + (st.skipped ? L(" (" + st.skipped + " skipped)", " (" + st.skipped + " omitidos)") : ""));
    if (note && clock < note.until) root.figure.say(L(note.text));
    else {
      const head = w.m && line[0] === w.m ? w.m : null;
      root.figure.say(L(
        (down ? "downstream down · " : "") + line.length + " in the line · " + (head ? (w.phase === "wait" ? "head " + who(head) + " waits out its backoff" : "working " + who(head)) : "worker idle") + (model.shelf.length ? " · " + model.shelf.length + " on the shelf" : ""),
        (down ? "destino caído · " : "") + line.length + " en la fila · " + (head ? (w.phase === "wait" ? "la cabeza " + who(head) + " en espera" : "procesando " + who(head)) : "trabajador libre") + (model.shelf.length ? " · " + model.shelf.length + " en el estante" : ""),
      ));
    }
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
    poison: () => { model.poison(clock, poisonKey); poisonKey = (poisonKey + 1) % 4; wake(); },
    outage: () => { model.outage(clock); wake(); },
    redrive: () => { model.redrive(clock); wake(); },
    reset: () => { restart(); tell(clock, "started over", "empezó de nuevo", 1.5); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings and its scripted events ----------
  root.on("watch", (w) => {
    for (const key of ["rate", "flaky", "attempts", "mode", "parse", "stale"]) set(key, String(w[key]), true);
    set("speed", String(w.speed || 1));
    restart(w.script || []);
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

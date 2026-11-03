// @ts-nocheck: live code in the lessons' plain style; shared helpers come from src/runtime and src/lib.
// The relay desks in the browser: runs the chain model, eases each docket toward where the model has it (a tray, a
// lane, the database's overflow table), prints the time its client has left, blackens it once the client has its
// outcome, and answers the controls. mount() gets the build-time data from page.ts (projection, geometry, the docket
// drawing) and root, the <wb-lesson>.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { playPause } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { makeChain, STALL } from "./sim";

export default function mount({ P, G, DOCKET_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const stat = (key, value) => root.stat(key, value);
  const NS = "http://www.w3.org/2000/svg";
  const layers = {};
  for (const el of svg.querySelectorAll("[data-layer]")) layers[el.getAttribute("data-layer")] = el;
  const counters = Object.fromEntries(["ok", "late", "waste1", "waste2", "waste3", "queue"].map((n) => [n, WB.counter(svg, n, P)]));
  const tlabel = [0, 1, 2, 3].map((i) => q('[data-tlabel="' + i + '"]'));
  const tvalue = [0, 1, 2, 3].map((i) => q('[data-tvalue="' + i + '"]'));
  const HOP_THE = [T("the gateway", "el gateway"), T("the service", "el servicio"), T("the database", "la base de datos")];

  // ---------- dockets: one pooled element per docket on screen ----------
  const free = [];
  function makeEl() {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = DOCKET_SVG;
    return { g, body: g.querySelector("[data-body]"), num: g.querySelector("[data-left]"), lit: null, text: null };
  }
  const recs = new Map();   // key -> { el, pos, target, layer, leaving, until, seen }
  function drop(key) { const r = recs.get(key); r.el.g.remove(); free.push(r.el); recs.delete(key); }
  function dress(el, lit, left) {
    if (el.lit !== lit) {
      el.lit = lit;
      el.body.toggleAttribute("data-lit", lit); el.body.toggleAttribute("data-lit-fill", lit);
      el.num.setAttribute("data-tone", lit ? "on-lit" : "hi");
    }
    const v = Math.max(-99, Math.min(99, left));
    const text = (v < -0.05 ? "−" : "") + Math.abs(v).toFixed(1);
    if (el.text !== text) { el.text = text; el.num.textContent = text; el.num.setAttribute("font-size", text.length <= 3 ? 2.9 : 2.4); }
  }

  const cfg = { mode: "fixed", client: 2, inner: "short", db: "stall", gw: "fast", speed: 0.5 };
  const WARM = 7;   // each run starts a few seconds in; the first opens on a typical moment: two queries hung for clients already gone
  let model, clock, logAt, note, slots, slotOf, seed = 9;

  function restart(warm = WARM) {
    for (const key of [...recs.keys()]) drop(key);
    model = makeChain({ mode: cfg.mode, client: cfg.client, inner: cfg.inner, db: cfg.db, gw: cfg.gw }, seed);
    seed = (Date.now() % 1e6) + 1;
    clock = warm; logAt = 0; note = null; slots = Array(G.PADS[0].length).fill(null); slotOf = new Map();
    model.runTo(clock);
    showSettings();
    paint(0, true);
  }

  function showSettings() {
    const deadline = cfg.mode === "deadline", fmt = (v) => String(v) + " S";
    tlabel.forEach((el) => (el.textContent = deadline ? L("DEADLINE", "PLAZO") : L("TIMEOUT", "LÍMITE")));
    tvalue[0].textContent = fmt(cfg.client);
    tvalue[1].textContent = deadline ? L("SHARED", "COMÚN") : fmt(model.timeouts[0]);
    tvalue[2].textContent = deadline ? L("SHARED", "COMÚN") : fmt(model.timeouts[1]);
    tvalue[3].textContent = deadline ? L("SHARED", "COMÚN") : L("NONE", "NINGUNO");
  }

  // ---------- what the readout says: the latest thing worth telling, for a couple of seconds ----------
  const s1 = (x) => x.toFixed(1);
  function readLog() {
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt], id = e.req.id;
      let text = null, weight = 1;
      // Kept short: the readout is one line, and must fit a phone.
      const n = "#" + id + " · ";
      if (e.type === "late") {
        text = cfg.mode === "deadline"
          ? T(n + "deadline passed · every desk drops it", n + "venció el plazo · todos la sueltan")
          : e.working ? T(n + "client gave up · " + e.working + (e.working === 1 ? " desk still has it" : " desks still have it"), n + "el cliente se rindió · " + e.working + (e.working === 1 ? " escritorio la tiene" : " escritorios la tienen"))
            : T(n + "client gave up after " + s1(cfg.client) + " s", n + "el cliente se rindió a los " + s1(cfg.client) + " s");
        weight = 2;
      } else if (e.type === "error") {
        const db = e.req.calls.some((c) => c.h === 2 && c.state === "work");
        text = db ? T(n + "error at " + s1(e.t - e.req.born) + " s · database still running", n + "error a los " + s1(e.t - e.req.born) + " s · la base sigue corriendo")
          : T(n + "error at " + s1(e.t - e.req.born) + " s", n + "error a los " + s1(e.t - e.req.born) + " s");
      } else if (e.type === "refuse") {
        text = T(n + e.left.toFixed(2) + " s left · " + HOP_THE[e.h].en + " refuses", n + "quedan " + e.left.toFixed(2) + " s · " + HOP_THE[e.h].es + " la rechaza");
      } else if (e.type === "dbLate") {
        text = T(n + "database done " + s1(e.after) + " s too late · thrown away", n + "la base terminó " + s1(e.after) + " s tarde · se tira");
        weight = 2;
      }
      if (text && (!note || clock - note.t > 1.6 || weight >= note.weight)) note = { t: clock, text, weight };
    }
    if (logAt > 500) { model.log.splice(0, logAt); logAt = 0; }
  }

  // ---------- where each docket is ----------
  function spot(h, i) {
    const lane = G.LANES[h], n = lane.length;
    if (h === 2) {
      if (i < n) return { pos: lane[i], layer: "lane-3" };
      const j = i - n;
      return j < G.PILE.length ? { pos: G.PILE[j], layer: "pile" } : null;
    }
    const level = Math.floor(i / n);
    if (level >= 5) return null;
    const [x, y, z] = lane[i % n];
    return { pos: [x, y, z + level * 2.6], layer: "lane-" + (h + 1) };
  }
  const qIndex = new Map();   // call -> its place in its hop's line, rebuilt every frame
  const padOf = (desk, slot) => ({ pos: G.PADS[desk][slot], layer: "top-" + desk });
  function whereIs(c) {
    if (c.state === "work" || c.state === "wait") return padOf(c.h + 1, c.slot);
    if (c.state === "queued") return spot(c.h, qIndex.get(c));
    if (c.state === "transit") return spot(c.h, model.hops[c.h].queue.length);
    return null;
  }
  function callerOf(c) {
    if (c.parent) return c.parent.slot >= 0 ? G.PADS[c.h][c.parent.slot] : null;
    const s = slotOf.get(c.req.id);
    return s !== undefined ? G.PADS[0][s] : null;
  }

  function place(key, at, start, lit, left) {
    let r = recs.get(key);
    if (!r) { const el = free.pop() || makeEl(); r = { el, pos: [...(start || at.pos)], layer: null }; recs.set(key, r); }
    r.target = at.pos; r.leaving = false; r.seen = true;
    if (r.layer !== at.layer) { r.layer = at.layer; layers[at.layer].appendChild(r.el.g); }
    dress(r.el, lit, left);
    return r;
  }

  function paint(dt, snap) {
    readLog();
    for (const r of recs.values()) r.seen = false;
    qIndex.clear();
    for (const hop of model.hops) hop.queue.forEach((c, i) => qIndex.set(c, i));
    // client trays: a docket for every request still waiting for its outcome
    for (const [id, s] of slotOf) if (slots[s] && slots[s].outcome !== null) { slots[s] = null; slotOf.delete(id); }
    let nobody = 0, inflight = 0;
    for (const req of model.reqs) {
      if (req.outcome === null) {
        inflight++;
        if (!slotOf.has(req.id)) { const s = slots.indexOf(null); if (s >= 0) { slots[s] = req; slotOf.set(req.id, s); } }
        const s = slotOf.get(req.id);
        if (s !== undefined) place("r" + req.id, padOf(0, s), null, false, req.deadline - clock).req = req;
      }
      for (const c of req.calls) {
        const at = whereIs(c);
        if (!at) continue;
        const lit = req.doneAt !== null;
        if (lit) nobody++;
        const r = place("c" + c.id, at, callerOf(c), lit, req.deadline - clock);
        r.call = c;
      }
    }
    // dockets the model has let go of: back to their caller with the answer, or dropped where they were
    for (const [key, r] of recs) {
      if (r.seen) continue;
      if (!r.leaving) {
        r.leaving = true; r.until = performance.now() + 600;
        const c = r.call;
        if (c && (c.state === "done" || c.state === "refused")) { const back = callerOf(c); r.target = back ? [back[0], back[1], back[2] + 1] : [r.pos[0], r.pos[1], r.pos[2] + 4]; }
        else if (c) r.target = [r.pos[0], r.pos[1], r.pos[2] - 3];
        else r.target = r.req && r.req.outcome === "ok" ? [r.pos[0], r.pos[1], r.pos[2] + 7] : [r.pos[0], r.pos[1], r.pos[2] - 3];
        if (r.req && r.req.outcome !== "ok") dress(r.el, true, r.req.deadline - clock);
      }
      if (snap || performance.now() > r.until) drop(key);
    }

    // ease toward the targets, lifting a little while travelling; painter's order inside each layer
    const f = snap ? 1 : 1 - Math.exp(-dt * 10);
    const byLayer = {};
    for (const r of recs.values()) {
      const [tx, ty, tz] = r.target;
      const dist = Math.hypot(tx - r.pos[0], ty - r.pos[1]);
      r.pos[0] = lerp(r.pos[0], tx, f); r.pos[1] = lerp(r.pos[1], ty, f);
      r.pos[2] = snap ? tz : lerp(r.pos[2], tz + Math.min(4, dist * 0.12), f);
      r.el.g.setAttribute("transform", translateAlong(P, r.pos));
      const o = r.leaving ? String(Math.max(0, Math.min(1, (r.until - performance.now()) / 400))) : "";
      if (r.el.g.style.opacity !== o) r.el.g.style.opacity = o;
      (byLayer[r.layer] ||= []).push(r);
    }
    for (const [name, list] of Object.entries(byLayer)) {
      list.sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P));
      let prev = null, inOrder = true;
      for (const r of list) { if (prev && r.el.g.previousElementSibling !== prev) { inOrder = false; break; } prev = r.el.g; }
      if (!inOrder) for (const r of list) layers[name].appendChild(r.el.g);
    }

    // counters, stats, readout
    const st = model.st;
    const waste = [0, 1, 2].map((h) => model.wasteNow(h));
    counters.ok.setClamped(st.ok); counters.late.setClamped(st.late);
    waste.forEach((w, h) => counters["waste" + (h + 1)].setClamped(w));
    counters.queue.setClamped(model.hops[2].queue.length);
    stat("ok", st.ok); stat("late", st.late); stat("errors", st.error);
    const total = waste[0] + waste[1] + waste[2];
    stat("wasted", (total < 10 ? total.toFixed(1) : Math.round(total)) + " s");
    stat("nobody", nobody);
    let n = 0, good = 0;
    for (let i = st.times.length - 1; i >= 0; i--) { const [born, o, s] = st.times[i]; if (born + s < clock - 30) break; n++; if (o === "ok") good++; }
    stat("rate", n >= 5 ? Math.round((100 * good) / n) + "%" : "–");
    if (st.times.length > 3000) st.times.splice(0, st.times.length - 1000);
    if (model.reqs.length > 300) {
      const keep = model.reqs.filter((r) => r.outcome === null || r.calls.some((c) => c.state === "transit" || c.state === "queued" || c.state === "work" || c.state === "wait") || clock - r.doneAt < 5);
      model.reqs.splice(0, model.reqs.length, ...keep);
    }
    if (note && clock - note.t < 2.6) say(L(note.text));
    else say(L(inflight + " in flight · " + nobody + " working for nobody", inflight + " en curso · " + nobody + " trabajando para nadie"));
  }

  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(dt * Math.max(1, Math.sqrt(cfg.speed))); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = name === "client" ? Number(raw) : String(raw);
    if (name === "mode") root.controls.showFor(cfg.mode);
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));
  const actions = {
    hang: () => {
      model.stallNext();
      note = { t: clock, weight: 3, text: T("the next query will hang for " + (STALL.min + STALL.max) / 2 + " s", "la próxima consulta se colgará " + (STALL.min + STALL.max) / 2 + " s") };
      if (loop.paused) loop.setPaused(false);
    },
    reset: () => restart(),
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const name of ["mode", "client", "inner", "db", "gw"]) set(name, String(w[name]), true);
    restart();
    if (loop.paused) loop.setPaused(false);
  });

  root.controls.showFor(cfg.mode);
  loop.setPaused(loop.paused);
  restart();
}

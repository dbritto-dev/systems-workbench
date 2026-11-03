// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The kitchen pass in the browser: runs the model, hangs the tickets on the rails, works the stoves, moves the timer
// dial and the console, and answers the controls. mount() gets the build-time data from page.ts (projection,
// geometry, the ticket drawing, the p95 delay) and root, the <wb-lesson>.
import { translateAlong, lineOnTop } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { T, L } from "../../runtime/wb";
import { show, setD, setLit, playPause } from "../../runtime/dom";
import { lerp, approach, easeInOutCubic as ease } from "../../lib/tween";
import { rankQuantile } from "../../lib/stats";
import { makeKitchen, REPLICAS, HEAVY_X } from "./sim";

export default function mount({ P, G, TICKET_SVG, P95 }, root) {
  const MS_PER_S = 10;          // at ×1, 10 ms of kitchen time per second: 100 times slower
  const FLY = 0.45;             // seconds a ticket takes to hop to the tray or the bin
  const LIFT = 0.5;             // seconds a cancelled ticket takes to lift off and fade
  const SHOW = 8;               // queued tickets drawn per rail; more wait off the end
  const LEAD = 30;              // ms of kitchen time shown before the first stall

  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const say = (v) => root.figure.say(L(v));
  const stat = (key, value) => root.stat(key, value);
  const layers = G.LY.map((_, i) => q('[data-tickets="' + i + '"]'));
  const fly = q("[data-fly]");
  const stoves = G.LY.map((ly, i) => ({ ly, prog: q('[data-prog="' + i + '"]'), sign: q('[data-stall="' + i + '"]'), cook: q('[data-cook="' + i + '"]') }));
  const mark = q("[data-mark]");
  const needle = WB.dial(svg, "age", P);
  const counters = Object.fromEntries(["p50", "p99", "copies", "extra"].map((n) => [n, WB.counter(svg, n, P)]));

  const RZ = G.RAIL.z + 0.7;   // a ticket's top, at the rail
  const cfg = { mode: "hedge", delay: P95, cancel: "cancel", budget: "0", load: 0.5, stalls: "on", heavy: "0", speed: 1 };
  let kitchen, clock, vis, pool, recent, busy, since, lastSay, waiting, trimmed, seed = (Date.now() % 1e6) + 1;
  pool = [];

  // ---------- tickets ----------
  function ticket() {
    let g = pool.pop();
    if (!g) {
      g = document.createElementNS(NS, "g");
      g.innerHTML = TICKET_SVG;
      g._num = g.querySelector("[data-num]");
      g._sub = g.querySelector("[data-sub]");
    }
    return g;
  }
  function release(v) { v.g.remove(); v.g.style.display = ""; pool.push(v.g); }
  function addVisual(c) {
    if (vis.has(c)) return;
    const g = ticket();
    g._num.textContent = String(c.q.id % 100).padStart(2, "0");
    g._sub.textContent = c.q.heavy ? "×" + HEAVY_X : "";
    setLit(g, c.n > 0);
    g.style.opacity = "0";
    layers[c.server].appendChild(g);
    vis.set(c, { g, c, x: G.PASS_X + 3, z: RZ, o: 0, phase: "rail", t: 0 });
  }
  const placeAt = (v, x, y, z, o) => {
    v.g.setAttribute("transform", translateAlong(P, [x, y, z]));
    const s = String(Math.max(0, Math.min(1, o)));
    if (v.g.style.opacity !== s) v.g.style.opacity = s;
  };

  // ---------- the model ----------
  // A run starts a moment before the model's first stall, so the machine doesn't idle for minutes first: a dry run
  // with the same seed finds when that is, and the real run skips ahead to it. Nothing is changed, only skipped.
  function firstStall(model, s) {
    const probe = makeKitchen(model, s);
    probe.keepLog = true;
    for (let t = 250; t <= 20000; t += 250) {
      probe.runTo(t);
      const e = probe.log.find((x) => x.type === "stall");
      if (e) return e.t;
      probe.log.length = 0;
    }
    return 0;
  }
  function restart() {
    const model = { mode: cfg.mode, delay: Number(cfg.delay), cancel: cfg.cancel === "cancel", budget: Number(cfg.budget), load: Number(cfg.load), stalls: cfg.stalls === "on", heavy: Number(cfg.heavy) };
    const s = seed++;
    const warm = model.stalls ? Math.max(0, firstStall(model, s) - LEAD) : 0;
    kitchen = makeKitchen(model, s);
    kitchen.runTo(warm);
    kitchen.keepLog = true;
    clock = warm; recent = kitchen.done.map((q) => q.answered - q.born); busy = 0; since = warm; lastSay = -1; waiting = null; trimmed = 0;
    if (vis) for (const v of vis.values()) release(v);
    vis = new Map();
    // Tickets already out when the run is shown: hang them where they are.
    for (const r of kitchen.live.values()) for (const c of r.copies) if (c.state === "queued" || c.state === "run" || c.state === "transit") { addVisual(c); const v = vis.get(c); v.o = 1; v.x = G.SERVE_X; }
    for (const s of stoves) { show(s.sign, false); setD(s.prog, ""); s.cook.removeAttribute("transform"); }
    show(mark, cfg.mode === "hedge");
    if (cfg.mode === "hedge") setD(mark, markPath(Number(cfg.delay)));
    needle.set(0);
    for (const c of Object.values(counters)) c.set(0);
    showStats();
  }
  function markPath(ms) {
    const d = G.DIAL, a = (Math.min(ms, G.DIAL_MS) / G.DIAL_MS) * Math.PI * 2, sx = Math.sin(a), sy = -Math.cos(a);
    const z = d.z + d.h + 0.2, r0 = d.r - 2.6, r1 = d.r + 1.4;
    return lineOnTop([d.x + sx * r0, d.y + sy * r0], [d.x + sx * r1, d.y + sy * r1], z, P);
  }

  // What happened in the model since the last frame: new tickets on the rails, and the readout.
  const cook = (c) => c.server + 1;
  const no = (c) => c.q.id;
  function handle(e) {
    const c = e.c;
    if (e.type === "arrive") { for (const x of e.q.copies) addVisual(x); return; }
    if (e.type === "hedge") { addVisual(c); tell(2, T("ticket " + no(c) + " still out after " + Math.round(e.t - c.q.born) + " ms · copy to cook " + cook(c), "comanda " + no(c) + " sigue pendiente tras " + Math.round(e.t - c.q.born) + " ms · copia al cocinero " + cook(c))); return; }
    if (e.type === "skip") { tell(2, T("ticket " + e.q.id + " still out · hedge budget spent, no copy", "comanda " + e.q.id + " sigue pendiente · presupuesto agotado, sin copia")); return; }
    if (e.type === "stall") {
      const n = e.s.queue.length + (e.s.cur ? 1 : 0), who = e.s.i + 1, ms = Math.round(e.dur);
      tell(3, n ? T("cook " + who + " stalls for " + ms + " ms · " + n + " ticket" + (n > 1 ? "s" : "") + " stuck", "el cocinero " + who + " se traba " + ms + " ms · " + n + (n > 1 ? " comandas atascadas" : " comanda atascada"))
        : T("cook " + who + " stalls for " + ms + " ms", "el cocinero " + who + " se traba " + ms + " ms"));
      return;
    }
    if (e.type === "unstall") { tell(2, T("cook " + (e.s.i + 1) + " is back · " + e.s.queue.length + " tickets on the rail", "el cocinero " + (e.s.i + 1) + " vuelve · " + e.s.queue.length + " comandas en el riel")); return; }
    if (e.type === "answer") {
      const ms = Math.round(e.t - c.q.born);
      recent.push(e.t - c.q.born); if (recent.length > 4000) recent.splice(0, 2000);
      if (c.q.copies.length > 1) tell(1, c.n > 0
        ? T("the copy of " + no(c) + " won on cook " + cook(c) + " · " + ms + " ms", "la copia de " + no(c) + " ganó con el cocinero " + cook(c) + " · " + ms + " ms")
        : T("ticket " + no(c) + " answered by cook " + cook(c) + " before its copy · " + ms + " ms", "la comanda " + no(c) + " la respondió el cocinero " + cook(c) + " antes que su copia · " + ms + " ms"));
      else tell(0, T("ticket " + no(c) + " · cook " + cook(c) + " · " + ms + " ms", "comanda " + no(c) + " · cocinero " + cook(c) + " · " + ms + " ms"));
      return;
    }
    if (e.type === "late") { tell(2, T("cook " + cook(c) + " finished " + no(c) + " too late · thrown away", "el cocinero " + cook(c) + " terminó " + no(c) + " tarde · al cesto")); return; }
    if (e.type === "cancel") { tell(1, e.from === "run" ? T("ticket " + no(c) + " stopped on cook " + cook(c) + " · its answer is already in", "comanda " + no(c) + " detenida en el cocinero " + cook(c) + " · su respuesta ya llegó") : T("cook " + cook(c) + " drops its copy of " + no(c), "el cocinero " + cook(c) + " descarta su copia de " + no(c))); return; }
    if (e.type === "drop") { tell(1, T("cook " + cook(c) + " drops " + no(c) + " on arrival · the other copy started", "el cocinero " + cook(c) + " descarta " + no(c) + " al llegar · la otra copia ya empezó")); return; }
  }
  // The readout: a more important message replaces a less important one that has had little time on screen.
  function tell(level, text) {
    const now = performance.now() / 1000;
    if (waiting && waiting.level > level && now - lastSay < 1.2) return;
    if (level === 0 && now - lastSay < 1.2) return;
    waiting = { level, text }; lastSay = now;
    say(text);
  }

  // ---------- painting ----------
  function paint(dt) {
    const k = kitchen, now = clock, follow = approach(dt, 7 * Math.max(1, cfg.speed));
    // Rails: where each queued or running ticket hangs.
    const slotOf = new Map();
    for (const s of k.replicas) {
      if (s.cur) slotOf.set(s.cur, 0);
      let n = 1;
      for (const c of s.queue) if (c.state === "queued") slotOf.set(c, n++);
    }
    for (const [c, v] of vis) {
      const ly = G.LY[c.server], y = ly + 0.8;
      v.t += dt;
      if (v.phase === "rail") {
        if (now < c.sent) { placeAt(v, v.x, y, RZ, 0); continue; }
        const done = c.state === "done", gone = c.state === "gone";
        if (done && c.q.winner === c) { toFly(v, G.TRAY_AT, "tray"); }
        else if ((done && c.q.winner && c.q.winner !== c) || (gone && c.start >= 0)) { toFly(v, G.BIN_AT, "bin"); }
        else if (gone) { v.phase = "lift"; v.t = 0; v.g.style.display = ""; }
        else {
          const n = slotOf.has(c) ? slotOf.get(c) : 0;
          if (n > SHOW) { if (v.g.style.display !== "none") v.g.style.display = "none"; v.x = G.SERVE_X - G.SLOT * SHOW; continue; }
          if (v.g.style.display) v.g.style.display = "";
          const tx = c.state === "transit" ? G.ENTRY_X + 2 : G.SERVE_X - G.SLOT * n;
          v.x += (tx - v.x) * follow;
          v.o = Math.min(1, v.o + dt * 4);
          placeAt(v, v.x, y, RZ, v.o);
          continue;
        }
      }
      if (v.phase === "lift") {
        const u = Math.min(1, v.t / LIFT);
        placeAt(v, v.x, y, RZ + 8 * ease(u), (1 - u) * v.o);
        if (u >= 1) { release(v); vis.delete(c); }
        continue;
      }
      if (v.phase === "fly") {
        const u = Math.min(1, v.t / FLY), w = ease(u);
        const p = [lerp(v.from[0], v.to[0], w), lerp(v.from[1], v.to[1], w), lerp(v.from[2], v.to[2], w) + 10 * Math.sin(Math.PI * u)];
        placeAt(v, p[0], p[1], p[2], u > 0.7 ? (1 - u) / 0.3 : 1);
        if (u >= 1) { release(v); vis.delete(c); }
      }
    }
    // Stoves: progress, the STALL sign, the cook at work.
    k.replicas.forEach((s, i) => {
      const st = stoves[i];
      show(st.sign, s.stalled);
      if (s.cur) {
        const c = s.cur, did = c.did + (s.stalled ? 0 : now - s.runFrom), f = Math.max(0, Math.min(1, did / c.q.work));
        setD(st.prog, f > 0.01 ? WB.faceRectX(P, G.FACE_X + 0.05, st.ly + G.PROG.y0, st.ly + G.PROG.y0 + (G.PROG.y1 - G.PROG.y0) * f, G.PROG.z0, G.PROG.z1) : "");
      } else setD(st.prog, "");
      const bob = s.cur && !s.stalled ? 0.9 * Math.abs(Math.sin(now * 0.9)) : 0;
      st.cook.setAttribute("transform", bob ? translateAlong(P, [0, 0, bob]) : "");
    });
    // The timer dial: how long the oldest ticket still waiting for a copy (or for any answer) has been out.
    let oldest = Infinity;
    for (const r of k.live.values()) { if (cfg.mode === "hedge" && r.copies.length > 1) continue; if (r.born < oldest) oldest = r.born; break; }
    needle.set(oldest === Infinity ? 0 : (now - oldest) / G.DIAL_MS);
  }
  function toFly(v, to, kind) {
    const c = v.c;
    fly.appendChild(v.g);
    v.g.style.display = "";
    v.phase = "fly"; v.kind = kind; v.t = 0;
    v.from = [v.x, G.LY[c.server] + 0.8, RZ]; v.to = to;
  }

  // ---------- stats and the console ----------
  function showStats() {
    const k = kitchen, n = recent.length;
    stat("answered", trimmed + k.done.length);
    const tail = recent.slice(-2000);
    const p50 = n ? rankQuantile(tail, 0.5) : 0, p99 = n ? rankQuantile(tail, 0.99) : 0;
    stat("p50", n ? Math.round(p50) + " ms" : "–");
    stat("p99", n >= 100 ? Math.round(p99) + " ms" : "–");
    const copies = k.requests ? k.hedges / k.requests : 0, extra = k.work > k.wasted ? k.wasted / (k.work - k.wasted) : 0;
    stat("copies", k.requests ? Math.round(100 * copies) + "%" : "–");
    stat("extra", k.work ? Math.round(100 * extra) + "%" : "–");
    stat("busy", clock - since > 30 ? Math.round(100 * busy) + "%" : "–");
    counters.p50.setClamped(Math.round(p50));
    counters.p99.setClamped(n >= 100 ? Math.round(p99) : 0);
    counters.copies.setClamped(Math.round(100 * copies));
    counters.extra.setClamped(Math.round(100 * extra));
    if (k.done.length > 6000) { k.done.splice(0, 3000); trimmed += 3000; }
  }

  let statTimer = 0;
  function step(dt) {
    const dms = dt * cfg.speed * MS_PER_S;
    clock += dms;
    kitchen.runTo(clock);
    // How busy the cooks are: the share working right now, smoothed over about 300 ms of kitchen time.
    const working = kitchen.replicas.filter((s) => s.cur && !s.stalled).length / REPLICAS;
    busy = clock - since < dms + 1e-9 ? working : busy + (working - busy) * (1 - Math.exp(-dms / 300));
    for (const e of kitchen.log.splice(0)) handle(e);
    paint(dt);
    statTimer += dt; if (statTimer > 0.3) { statTimer = 0; showStats(); }
  }

  // ---------- controls ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage, step, onPause: pause.onPause });
  pause.bind(loop);
  function set(name, raw, quiet) {
    cfg[name] = name === "speed" ? Number(raw) : raw;
    root.press(name, raw);
    if (name !== "speed" && !quiet) { restart(); say(T("settings changed · the run starts again", "ajustes cambiados · la ejecución empieza de nuevo")); }
  }
  function stallThree() {
    const s = kitchen.replicas[2];
    if (s.stalled) { say(T("cook 3 is already stalled", "el cocinero 3 ya está trabado")); return; }
    kitchen.stall(2, 100);
    for (const e of kitchen.log.splice(0)) handle(e);
    if (loop.paused) loop.setPaused(false);
  }
  root.on("change", (name, value) => set(name, value));
  const actions = { stall: stallThree, reset: () => { restart(); say(T("started over", "empezó de nuevo")); } };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w, id) => {
    for (const name of ["mode", "delay", "cancel", "budget", "load", "stalls", "heavy"]) set(name, String(w[name]), true);
    restart();
    if (loop.paused) loop.setPaused(false);
    say(T("watching: " + id, "observando: " + id));
  });

  loop.setPaused(loop.paused);
  restart();
  say(cfg.mode === "hedge" ? T("tickets go out · a copy after " + cfg.delay + " ms", "salen comandas · copia tras " + cfg.delay + " ms") : T("tickets go out", "salen comandas"));
}

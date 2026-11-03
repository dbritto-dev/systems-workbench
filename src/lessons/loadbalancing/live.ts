// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The sorting station in the browser: steps the model, rides parcels from the infeed through the turntable and down
// the lanes, turns the arm, works the presses, and answers the controls. mount() gets the build-time data from
// page.ts (projection, geometry, parcel drawing) and root, the <wb-lesson>.
import { translateAlong, solidSvg, extrude } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { T, L } from "../../runtime/wb";
import { show, playPause } from "../../runtime/dom";
import { lerp, easeInOutCubic } from "../../lib/tween";
import { clamp, rankQuantile } from "../../lib/stats";
import { pct } from "../../lib/format";
import { TRANSFER, SLOW, createStation } from "./sim";

export default function mount({ P, G, PARCEL_SVG }, root) {
  const IN_TIME = 1.2;

  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const infeedLayer = q("[data-infeed]"), armEl = q("[data-arm]");
  const lanes = G.LANES.map((ly, i) => ({
    ly,
    parcels: q('[data-parcels="' + i + '"]'), head: q('[data-head="' + i + '"]'),
    gateOpen: q('[data-gate-open="' + i + '"]'), gateClosed: q('[data-gate-closed="' + i + '"]'),
    shutter: q('[data-shutter="' + i + '"]'), cover: q('[data-cover="' + i + '"]'),
    lampOn: q('[data-lamp-on="' + i + '"]'), lampOff: q('[data-lamp-off="' + i + '"]'),
  }));

  const opts = { servers: 4, algorithm: "rr", rate: 0.9, slow: -1, check: 10, sticky: false, sizes: "even", heavy: false };
  let station = createStation(opts, (Date.now() % 1e6) + 1);
  let speed = 1;
  let armAngle = Math.atan2(0, 1), armTarget = armAngle, armDrawn = null;
  let incoming = null;
  const visuals = new Map();
  let base = { done: 0, errors: 0 };
  const history = [];

  const ease = easeInOutCubic;
  const clamp01 = (t) => clamp(t);
  const say = (msg) => root.figure.say(L(msg));
  function armOf(angle) {
    const c = Math.cos(angle), s = Math.sin(angle), x = G.TABLE[0], y = G.TABLE[1];
    const pt = (u, v) => [x + u * c - v * s, y + u * s + v * c];
    return solidSvg(extrude([pt(-6, -1.6), pt(21, -1.6), pt(21, 1.6), pt(-6, 1.6)], G.TABLE_Z, 4, P, { bevel: 0.3 }), { tone: "hi", lit: true });
  }
  const slotX = (index) => G.SERVE_X - G.SLOT * Math.min(index, 8);

  function makeParcel(layer) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
    el.innerHTML = PARCEL_SVG;
    layer.appendChild(el);
    return el;
  }
  function place(el, p, opacity = 1) {
    el.setAttribute("transform", translateAlong(P, p));
    if (el.style.opacity !== String(opacity)) el.style.opacity = String(opacity);
  }
  function laneIndexOf(job) {
    const s = station.st.servers[job.server];
    const first = s.current ? 1 : 0;
    if (job.state === "service") return 0;
    if (job.state === "queued") return first + s.queue.indexOf(job);
    const ahead = station.st.jobs.filter((j) => j.server === job.server && j.state === "transit" && j.reach < job.reach).length;
    return first + s.queue.length + ahead;
  }

  function handle(event) {
    const job = event.job;
    if (event.type === "dispatch") {
      const lane = lanes[job.server];
      const el = incoming ? incoming.el : makeParcel(lane.parcels);
      incoming = null;
      lane.parcels.appendChild(el);
      visuals.set(job.id, { el, job, x: G.TABLE[0], phase: "live" });
      armTarget = Math.atan2(lane.ly - G.TABLE[1], G.LANE.from - G.TABLE[0]);
      say(T("parcel " + job.id + " → counter " + (job.server + 1), "paquete " + job.id + " → mostrador " + (job.server + 1)));
    } else if (event.type === "finish") {
      const v = visuals.get(job.id); if (v) { v.phase = "done"; v.t = 0; }
    } else if (event.type === "error") {
      let v = visuals.get(job.id);
      if (!v && incoming) { v = { el: incoming.el, job, x: G.TABLE[0], phase: "live" }; incoming = null; visuals.set(job.id, v); }
      if (v) { v.phase = "error"; v.t = 0; v.from = v.last || [G.TABLE[0], 0, G.TABLE_Z]; }
      say(job.server >= 0
        ? T("parcel " + job.id + " failed · counter " + (job.server + 1) + " is down", "paquete " + job.id + " falló · el mostrador " + (job.server + 1) + " está caído")
        : T("parcel " + job.id + " failed · no counter available", "paquete " + job.id + " falló · no hay mostrador disponible"));
    } else if (event.type === "check") {
      const out = station.st.servers.filter((s) => s.index < opts.servers && !s.healthy).map((s) => s.index + 1);
      if (out.length) say(out.length === 1
        ? T("health check · counter " + out[0] + " taken out", "chequeo de salud · se saca el mostrador " + out[0])
        : T("health check · counter " + out.join(", ") + " taken out", "chequeo de salud · se sacan los mostradores " + out.join(", ")));
    }
  }

  function advance(dt) {
    station.step(station.st.now + dt);
    for (const e of station.st.events.splice(0)) handle(e);
    const now = station.st.now;
    // the next parcel rides the infeed toward the turntable
    if (!incoming && station.st.nextArrival - now <= IN_TIME) incoming = { el: makeParcel(infeedLayer) };
    if (incoming) {
      if (incoming.el.parentNode !== infeedLayer) infeedLayer.appendChild(incoming.el);
      const u = clamp01(1 - (station.st.nextArrival - now) / IN_TIME);
      place(incoming.el, [lerp(G.INFEED.from + 6, G.TABLE[0], u), 0, G.TABLE_Z]);
    }
    const follow = 1 - Math.exp(-dt / 0.12);
    for (const [id, v] of visuals) {
      const job = v.job, ly = job.server >= 0 ? lanes[job.server].ly : 0;
      if (v.phase === "done") {
        v.t += dt / 0.45;
        place(v.el, [G.SERVE_X + 12 * v.t, ly, G.LANE.z], clamp01(1 - v.t));
        if (v.t >= 1) { v.el.remove(); visuals.delete(id); }
        continue;
      }
      if (v.phase === "error") {
        v.t += dt / 0.6;
        place(v.el, [v.from[0], v.from[1], v.from[2] - 5 * v.t], clamp01(1 - v.t));
        if (v.t >= 1) { v.el.remove(); visuals.delete(id); }
        continue;
      }
      const index = laneIndexOf(job);
      v.el.style.display = index > 9 ? "none" : "";
      let p;
      if (job.state === "transit") {
        const u = clamp01((now - job.arrive) / TRANSFER);
        const p0 = [G.TABLE[0], G.TABLE[1], G.TABLE_Z], p1 = [G.LANE.from + 2, ly, G.LANE.z], tx = slotX(index);
        if (u < 0.5) { const w = ease(u / 0.5); p = [lerp(p0[0], p1[0], w), lerp(p0[1], p1[1], w), lerp(p0[2], p1[2], w)]; }
        else p = [lerp(p1[0], tx, ease((u - 0.5) / 0.5)), ly, G.LANE.z];
        v.x = p[0];
      } else {
        v.x += (slotX(index) - v.x) * follow;
        p = [v.x, ly, G.LANE.z];
      }
      v.last = p;
      place(v.el, p);
    }
    // the arm turns toward the lane it last chose
    armAngle += (armTarget - armAngle) * (1 - Math.exp(-dt / 0.1));
    if (armDrawn === null || Math.abs(armAngle - armDrawn) > 0.004) { armEl.innerHTML = armOf(armAngle); armDrawn = armAngle; }
    // counters
    station.st.servers.forEach((s, i) => {
      const lane = lanes[i], present = i < opts.servers;
      show(lane.gateOpen, present && s.healthy); show(lane.gateClosed, !(present && s.healthy));
      show(lane.shutter, !present || !s.alive); show(lane.cover, !present);
      show(lane.lampOn, present && s.alive); show(lane.lampOff, !(present && s.alive));
      let dz = 0;
      if (s.current && s.alive) {
        const period = 1.1 * (opts.slow === i ? SLOW : 1);
        const phase = (now - s.current.start) / period;
        dz = -G.HEAD.travel * Math.pow(Math.max(0, Math.sin(2 * Math.PI * phase)), 2);
      }
      lane.head.setAttribute("transform", dz ? translateAlong(P, [0, 0, dz]) : "");
    });
    if (!history.length || now - history[history.length - 1].t >= 1) {
      history.push({ t: now, busy: station.st.servers.map((s) => s.busy) });
      while (history.length > 62) history.shift();
      showStats();
    }
  }

  const stat = (key, value) => root.stat(key, value);
  function showStats() {
    const done = station.st.done.slice(base.done).slice(-300);
    const times = done.map((j) => j.end - j.arrive);
    stat("served", station.st.done.length - base.done);
    stat("failed", station.st.errors - base.errors);
    stat("p50", times.length ? rankQuantile(times, 0.5).toFixed(1) + " s" : "–");
    stat("p95", times.length ? rankQuantile(times, 0.95).toFixed(1) + " s" : "–");
    if (history.length > 5) {
      const a = history[0], b = history[history.length - 1], span = b.t - a.t;
      const util = station.st.servers.slice(0, opts.servers).map((s, i) => ({ i, u: (b.busy[i] - a.busy[i]) / span }));
      const hi = util.reduce((x, y) => (y.u > x.u ? y : x)), lo = util.reduce((x, y) => (y.u < x.u ? y : x));
      stat("busiest", pct(Math.min(1, hi.u)) + " · #" + (hi.i + 1));
      stat("quietest", pct(lo.u) + " · #" + (lo.i + 1));
    } else { stat("busiest", "–"); stat("quietest", "–"); }
  }

  // ---------- controls ----------
  const pause = playPause(root);
  const clock = WB.loop({ stage, step: (dt) => { advance(dt * speed); }, onPause: pause.onPause });
  pause.bind(clock);
  clock.setPaused(clock.paused);
  function resetCounts() { base = { done: station.st.done.length, errors: station.st.errors }; history.length = 0; showStats(); }
  function set(name, raw) {
    const value = String(raw);
    if (name === "servers") { opts.servers = Number(value); station.set({ servers: opts.servers }); history.length = 0; }
    if (name === "algorithm") { opts.algorithm = value; station.set({ algorithm: value }); }
    if (name === "rate") { opts.rate = Number(value); station.set({ rate: opts.rate }); }
    if (name === "sizes") { opts.sizes = value; station.set({ sizes: value }); }
    if (name === "slow") { opts.slow = value === "true" ? 0 : -1; station.set({ slow: opts.slow }); }
    if (name === "check") { opts.check = Number(value); station.set({ check: opts.check }); }
    if (name === "heavy") { opts.heavy = value === "true"; station.set({ heavy: opts.heavy }); }
    if (name === "sticky") { opts.sticky = value === "true"; station.set({ sticky: opts.sticky }); }
    if (name === "speed") speed = Number(value);
    root.press(name, value);
  }
  function crash() { station.kill(1); say(T("counter 2 crashed · the balancer doesn't know yet", "el mostrador 2 se cayó · el balanceador todavía no lo sabe")); for (const e of station.st.events.splice(0)) handle(e); if (clock.paused) clock.setPaused(false); }
  function restart() { for (let i = 0; i < 5; i++) station.restart(i); say(T("counters restarted · back in at the next health check", "mostradores reiniciados · vuelven en el siguiente chequeo de salud")); }
  root.on("change", (name, value) => set(name, value));
  const actions = { crash, restart, reset: resetCounts };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    restart();
    set("servers", w.servers); set("algorithm", w.algorithm); set("rate", w.rate); set("sizes", w.sizes);
    set("slow", String(w.slow)); set("sticky", String(w.sticky)); set("heavy", String(w.heavy)); set("check", w.check);
    resetCounts();
    if (clock.paused) clock.setPaused(false);
    if (w.crash) setTimeout(crash, 3000);
  });

  advance(0); showStats();
}

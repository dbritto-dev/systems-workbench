// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The lighting console in the browser: runs the flag model, sends request tokens along the rail, turns each stage's
// refresh dial and cue card, and wires the controls and the experiment cards. mount() gets the build-time data from
// page.ts (geometry, cable routes, the token drawing, experiment results).
import { iso, lineOnTop, translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats, act, pauseControls } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { secs } from "../../lib/format";
import { polylineLength } from "../../lib/geometry";
import { makeSim, setFlag, rollback, step, flippers } from "./sim";

export default function mount({ P, G, CABLES, TOKEN_SVG, RESULTS, EXPERIMENTS }) {
  const SPEED = 150, FADE = 0.35, PULSE_TIME = 0.6, POOL = 48, NS = "http://www.w3.org/2000/svg";

  const stage = document.querySelector("[data-console]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const say = readout();
  const stat = stats();
  const tokensBox = q("[data-tokens]"), pulsesBox = q("[data-pulses]");
  const lampNew = G.STAGES.map((_, i) => q('[data-lamp="' + i + '-new"] .iso-solid:last-of-type'));
  const dials = G.STAGES.map((_, i) => q('[data-dial="' + i + '"]'));
  const cues = G.STAGES.map((_, i) => q('[data-cue="' + i + '"]'));
  const fader = q("[data-fader]"), toggle = q("[data-toggle]"), kill = q("[data-kill]");
  const pointers = { target: q('[data-pointer="target"]'), refresh: q('[data-pointer="refresh"]') };
  const bank = Array.from({ length: 10 }, (_, i) => q('[data-bank="' + i + '"]'));

  const cfg = { on: true, pct: 10, sticky: true, staffFirst: false, ttl: 5, buggy: false, flags: 1 };
  let speed = 1, sim, seed = (Date.now() % 1e6) + 1, tokens = [], pulses = [], rolledBack = false;
  const pool = Array.from({ length: POOL }, () => { const g = document.createElementNS(NS, "g"); g.innerHTML = TOKEN_SVG; g.style.display = "none"; tokensBox.appendChild(g); return { g, solid: g.firstElementChild, busy: false }; });

  // Where a token is, given how far it has travelled along turnstile → rail → spur.
  function routeOf(server) {
    const cx = G.STAGES[server];
    return [[G.RAIL_X0, G.RAIL_Y], [cx, G.RAIL_Y], [cx, G.DECK_FRONT + 3]];
  }
  // Not geometry's pointAlong(): no clamping, and past the end it returns the last point itself.
  function along(points, dist) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (dist <= len) return [lerp(a[0], b[0], dist / len), lerp(a[1], b[1], dist / len)];
      dist -= len;
    }
    return points[points.length - 1];
  }

  function restart() {
    sim = makeSim({ ...cfg }, seed++);
    rolledBack = false;
    tokens = []; pulses.forEach((p) => p.el.remove()); pulses = [];
    pool.forEach((p) => { p.busy = false; p.g.style.display = "none"; });
    sim.onRequest = (r) => {
      const slot = pool.find((p) => !p.busy);
      if (!slot) return;
      slot.busy = true; slot.g.style.display = "";
      const pts = routeOf(r.server);
      tokens.push({ slot, r, pts, len: polylineLength(pts), born: sim.t, turn: Math.abs(G.STAGES[r.server] - G.RAIL_X0) });
    };
    sim.onFetch = (s) => {
      const el = document.createElementNS(NS, "circle"); el.setAttribute("r", "1.6"); el.setAttribute("class", "pulse");
      pulsesBox.appendChild(el); pulses.push({ el, server: s.i, born: sim.t });
    };
    paint(); showStats();
  }

  function placeToken(t) {
    const age = sim.t - t.born, dist = age * SPEED, travel = t.len / SPEED;
    let x, y, z = G.TOKEN.z, op = 1, lit = false;
    if (age < travel) {
      [x, y] = along(t.pts, dist);
      lit = t.r.isNew && dist > t.turn;
    } else if (t.r.error) {
      const u = Math.min(1, (age - travel) / 0.5), cx = G.STAGES[t.r.server];
      x = lerp(cx, cx + G.BIN.dx, u); y = lerp(G.DECK_FRONT + 3, G.BIN.y, u); z = G.TOKEN.z + 4 * Math.sin(Math.PI * u) - 2 * u;
      lit = true; op = u < 1 ? 1 : Math.max(0, 1 - (age - travel - 0.5) / FADE);
    } else {
      [x, y] = t.pts[t.pts.length - 1];
      lit = t.r.isNew; op = Math.max(0, 1 - (age - travel) / FADE);
    }
    t.slot.g.setAttribute("transform", translateAlong(P, [x, y, z]));
    t.slot.g.style.opacity = String(op);
    t.slot.solid.toggleAttribute("data-lit", lit);
    return op > 0;
  }

  function paint() {
    tokens = tokens.filter((t) => { const keep = placeToken(t); if (!keep) { t.slot.busy = false; t.slot.g.style.display = "none"; } return keep; });
    pulses = pulses.filter((p) => {
      const u = (sim.t - p.born) / PULSE_TIME;
      if (u >= 1) { p.el.remove(); return false; }
      const flat = CABLES[p.server].map((c) => [c[0], c[1]]), total = polylineLength(flat);
      const [x, y] = along(flat, u * total);
      const [sx, sy] = iso([x, y, 1.6], P);
      p.el.setAttribute("cx", sx.toFixed(1)); p.el.setAttribute("cy", sy.toFixed(1));
      return true;
    });
    sim.servers.forEach((s, i) => {
      const c = s.cache, cx = G.STAGES[i];
      const showing = s.codeHasFeature && c.on && (c.pct > 0 || c.staffFirst);
      lampNew[i] && lampNew[i].toggleAttribute("data-lit", showing);
      const share = !s.codeHasFeature || !c.on ? 0 : c.staffFirst ? 0.05 : c.pct / 100;
      const x0 = cx + G.CARD.dx - 6, y = G.CARD.y + 1.4, z0 = G.DECK_H + 4.5, z1 = G.DECK_H + 7.5;
      cues[i].setAttribute("d", share > 0.005 ? WB.faceRectY(P, x0, x0 + 12 * share, y, z0, z1) : "");
      const turn = Math.min(1, (sim.t - s.fetchedAt) / sim.ttl), a = turn * Math.PI * 2, dx = cx + G.DIAL.dx, dy = G.DIAL.y, r = G.DIAL.r - 1.8;
      dials[i].setAttribute("d", lineOnTop([dx, dy], [dx + Math.sin(a) * r, dy - Math.cos(a) * r], G.DIAL.z + 0.1, P));
    });
    const f = sim.flag;
    fader.setAttribute("transform", translateAlong(P, [lerp(G.FADER.x0, G.FADER.x1, f.pct / 100), 0, 0]));
    toggle.setAttribute("transform", translateAlong(P, [f.sticky ? 4 : -4, 0, 0]));
    kill.setAttribute("transform", f.on ? "" : translateAlong(P, [0, 0, -3]));
    pointer("target", f.staffFirst ? 0.6 : -0.6);
    pointer("refresh", sim.ttl === 5 ? -0.9 : sim.ttl === 30 ? 0 : 0.9);
    bank.forEach((el, i) => el.setAttribute("transform", translateAlong(P, [0, i < sim.flags ? -G.BANK.travel / 2 : G.BANK.travel / 2, 0])));
  }

  function pointer(name, a) {
    const [x, y] = G.KNOBS[name], z = G.DESK_TOP + 5.05;
    pointers[name].setAttribute("d", lineOnTop([x, y], [x + Math.sin(a) * 5.2, y - Math.cos(a) * 5.2], z, P));
  }

  const behind = () => sim.servers.filter((s) => s.cache.on !== sim.flag.on || s.cache.pct !== sim.flag.pct || s.cache.sticky !== sim.flag.sticky || s.cache.staffFirst !== sim.flag.staffFirst).length;
  function showStats() {
    const st = sim.stats;
    stat("requests", st.requests);
    stat("share", st.requests ? Math.round(100 * st.newCount / st.requests) + "%" : "–");
    stat("errors", st.errors);
    stat("both", flippers(sim));
    stat("behind", behind() + L(" of 4", " de 4"));
    stat("combos", sim.combos.size);
    const b = behind(), f = sim.flag;
    let text;
    if (rolledBack) { const n = sim.servers.filter((s) => !s.codeHasFeature).length; text = T("redeploying the old build · " + n + " of 4 servers replaced", "redesplegando el build anterior · " + n + " de 4 servidores reemplazados"); }
    else if (!f.on) { const n = sim.servers.filter((s) => s.cache.on).length; text = T("kill switch on · " + n + " of 4 servers still showing it", "kill switch activado · " + n + " de 4 servidores todavía la muestran"); }
    else text = T((f.staffFirst ? "staff only" : f.pct + "% · " + (f.sticky ? "sticky" : "random")) + " · " + (b ? b + " of 4 servers behind" : "all servers up to date"),
      (f.staffFirst ? "solo personal" : f.pct + "% · " + (f.sticky ? "fija" : "aleatoria")) + " · " + (b ? b + " de 4 servidores atrasados" : "todos los servidores al día"));
    say(L(text));
  }

  let statClock = 0;
  const pause = pauseControls(stage, say);
  const loop = WB.loop({ stage, step: (dt) => { step(sim, dt * speed); paint(); statClock += dt; if (statClock > 0.2) { statClock = 0; showStats(); } }, onPause: pause.onPause });
  pause.bind(loop);
  const killBtn = act("kill");
  const killLabel = () => { killBtn.textContent = sim.flag.on ? "Kill switch" : L("Turn back on", "Volver a encender"); };

  function set(name, raw, quiet) {
    if (name === "speed") speed = Number(raw);
    else if (name === "pct") { cfg.pct = Number(raw); setFlag(sim, { pct: cfg.pct }); }
    else if (name === "sticky") { cfg.sticky = raw === "true"; setFlag(sim, { sticky: cfg.sticky }); }
    else if (name === "staffFirst") { cfg.staffFirst = raw === "true"; setFlag(sim, { staffFirst: cfg.staffFirst }); }
    else if (name === "ttl") { cfg.ttl = Number(raw); sim.ttl = cfg.ttl; sim.servers.forEach((s) => { s.nextFetch = Math.min(s.nextFetch, sim.t + sim.ttl); }); }
    else if (name === "buggy") { cfg.buggy = raw === "true"; sim.buggy = cfg.buggy; }
    else if (name === "flags") { cfg.flags = Number(raw); sim.flags = cfg.flags; sim.combos.clear(); }
    WB.pressSeg(name, raw);
    if (!quiet) { paint(); showStats(); }
  }
  WB.onSegments((name, value) => set(name, value));
  function toggleKill() {
    setFlag(sim, { on: !sim.flag.on });
    cfg.on = sim.flag.on;
    killLabel();
    paint(); showStats();
  }
  killBtn.addEventListener("click", toggleKill);
  act("rollback").addEventListener("click", () => { if (!rolledBack) { rollback(sim); rolledBack = true; showStats(); } });
  act("reset").addEventListener("click", () => { cfg.on = true; restart(); killLabel(); });

  // ---------- experiments (numbers computed at build time from the same model, 8 seeds each) ----------
  const RUNS = {
    kill: () => {
      const r = RESULTS.kill, top = Math.max(r.kill.stop, r.rollback.stop);
      return { verdict: T("Kill switch: the last bad request came " + secs(r.kill.stop) + " after the decision, " + r.kill.errors.toFixed(1) + " errors on average. Redeploy: " + secs(r.rollback.stop) + ", " + Math.round(r.rollback.errors) + " errors.",
          "Kill switch: la última solicitud mala llegó " + secs(r.kill.stop) + " después de la decisión, con " + r.kill.errors.toFixed(1) + " errores en promedio. Redespliegue: " + secs(r.rollback.stop) + ", " + Math.round(r.rollback.errors) + " errores."),
        bars: [["Kill switch", r.kill.stop / top, secs(r.kill.stop), true], [T("Redeploy", "Redespliegue"), r.rollback.stop / top, secs(r.rollback.stop)]] };
    },
    sticky: () => {
      const r = RESULTS.sticky;
      return { verdict: T("Of about " + Math.round(r.users) + " users, " + Math.round(r.random) + " saw both versions with a random roll per request; " + Math.round(r.sticky) + " with sticky bucketing.",
          "De unos " + Math.round(r.users) + " usuarios, " + Math.round(r.random) + " vieron ambas versiones con un sorteo por solicitud; " + Math.round(r.sticky) + " con asignación fija."),
        bars: [[T("Random", "Aleatoria"), r.random / r.users, T(Math.round(r.random) + " users", Math.round(r.random) + " usuarios"), true], [T("Sticky", "Fija"), r.sticky / r.users, T(Math.round(r.sticky) + " users", Math.round(r.sticky) + " usuarios")]] };
    },
    ttl: () => {
      const { a, b } = RESULTS.ttl;
      return { verdict: T("After the flip, servers kept showing the feature for up to " + secs(a.worst) + " with a 5 s refresh and up to " + secs(b.worst) + " with a 60 s refresh (" + Math.round(b.served) + " requests on average).",
          "Después del cambio, los servidores siguieron mostrando la funcionalidad hasta " + secs(a.worst) + " con actualización cada 5 s y hasta " + secs(b.worst) + " con actualización cada 60 s (" + Math.round(b.served) + " solicitudes en promedio)."),
        bars: [[T("Refresh 5 s", "Cada 5 s"), a.worst / 60, secs(a.worst)], [T("Refresh 60 s", "Cada 60 s"), b.worst / 60, secs(b.worst), true]] };
    },
    debt: () => {
      const { a, b } = RESULTS.debt;
      return { verdict: T("Live combinations: " + Math.round(a.live) + " of " + a.possible + " possible with 3 flags; " + Math.round(b.live) + " of " + b.possible + " possible with 10 flags, among " + Math.round(b.users) + " active users.",
          "Combinaciones en vivo: " + Math.round(a.live) + " de " + a.possible + " posibles con 3 flags; " + Math.round(b.live) + " de " + b.possible + " posibles con 10 flags, entre " + Math.round(b.users) + " usuarios activos."),
        bars: [["3 flags", a.live / b.users, T(Math.round(a.live) + " versions", Math.round(a.live) + " versiones")], ["10 flags", b.live / b.users, T(Math.round(b.live) + " versions", Math.round(b.live) + " versiones"), true]] };
    },
    target: () => {
      const r = RESULTS.target, top = Math.max(r.everyone.customers, r.staff.customers, 1);
      return { verdict: T("Customers who hit the bug in 60 s: " + r.staff.customers.toFixed(0) + " with staff only (staff met it " + r.staff.staff.toFixed(0) + " times); " + r.everyone.customers.toFixed(0) + " with 10% of everyone.",
          "Clientes que se toparon con el bug en 60 s: " + r.staff.customers.toFixed(0) + " con solo personal (el personal lo encontró " + r.staff.staff.toFixed(0) + " veces); " + r.everyone.customers.toFixed(0) + " con el 10% de todos."),
        bars: [[T("Staff only", "Solo personal"), r.staff.customers / top, T(r.staff.customers.toFixed(0) + " customers", r.staff.customers.toFixed(0) + " clientes")], [T("10% of everyone", "10% de todos"), r.everyone.customers / top, T(r.everyone.customers.toFixed(0) + " customers", r.everyone.customers.toFixed(0) + " clientes"), true]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    for (const name of ["pct", "sticky", "staffFirst", "ttl", "buggy", "flags"]) set(name, String(w[name]), true);
    cfg.on = true;
    restart(); killLabel();
    if (loop.paused) loop.setPaused(false);
    if (w.then === "kill") setTimeout(() => { if (sim.flag.on) toggleKill(); }, 4000);
  } });

  loop.setPaused(loop.paused);
  restart();
}

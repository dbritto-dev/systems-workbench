// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The signal network in the browser: runs the model at 100 values a second, follows one value at a time with pucks on
// the wires, and wires the controls and the experiment cards. mount() gets the build-time data from page.ts (wire
// routes in screen space, gauge travel, experiment results).
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats, act, pauseControls } from "../../runtime/dom";
import { pct, int, msOrSecs } from "../../lib/format";
import { rankQuantileSorted } from "../../lib/stats";
import { TOPOLOGIES, HOP, createNet, hubsOf } from "./sim";

export default function mount({ ROUTES, GAUGE, RESULTS, EXPERIMENTS }) {
  const KILL = { grid: 6, ring: 6, hubs: 6, star: 12, direct: 6 };

  const stage = document.querySelector("[data-office]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const sayText = readout();
  const say = (text) => sayText(L(text));
  const NS = "http://www.w3.org/2000/svg";
  const topoEls = Object.fromEntries(TOPOLOGIES.map((t) => [t, q('[data-topo="' + t + '"]')]));
  const busy = Object.fromEntries(TOPOLOGIES.map((t) => [t, Object.fromEntries([...topoEls[t].querySelectorAll("[data-e]")].map((el) => [el.dataset.e, el]))]));
  const stations = qa("[data-station]");
  const lenses = qa("[data-lens]");
  const origins = qa("[data-origin]");
  const collars = qa("[data-collar]");
  const walls = qa("[data-wall]");
  const dotLayer = q("[data-dots]");
  dotLayer.textContent = "";
  const gaugeEls = { mpo: q('[data-gauge="mpo"]'), max: q('[data-gauge="max"]') };
  function setGauge(key, v) { const g = GAUGE[key], f = isFinite(v) ? Math.max(0, Math.min(1, v / g.max)) : 0; gaugeEls[key].setAttribute("transform", "translate(" + (g.dx * f).toFixed(2) + " " + (g.dy * f).toFixed(2) + ")"); }
  const dots = Array.from({ length: 90 }, () => { const c = document.createElementNS(NS, "circle"); c.setAttribute("r", "3"); c.setAttribute("class", "msg"); c.style.display = "none"; dotLayer.appendChild(c); return c; });

  // The note under the panel links its source; the panel writes notes as text, so make the link here.
  const note = document.querySelector(".panel-note");
  if (note && note.textContent.includes("fly.io/dist-sys")) {
    const [before, after] = note.textContent.split("fly.io/dist-sys");
    const a = document.createElement("a");
    a.href = "https://fly.io/dist-sys/"; a.target = "_blank"; a.rel = "noopener"; a.textContent = "fly.io/dist-sys";
    note.replaceChildren(before, a, after);
  }

  const cfg = { topology: "grid", batch: 0, retries: false, forward: "new", speed: 0.25 };
  let net, inflight, spot, nextSpotAt, history, seed = (Date.now() % 1e6) + 1, killed = null;
  const keyOf = (a, b) => (a < b ? a + "-" + b : b + "-" + a);

  const cutBtn = act("cut");
  const killBtn = act("kill");

  function restart() {
    inflight = new Map();
    net = createNet({ topology: cfg.topology, batch: cfg.batch, retries: cfg.retries, forward: cfg.forward, rate: 100, seed: seed++, maxInFlight: 6000 }, {
      send: (m) => inflight.set(m.id, m),
      deliver: (m) => inflight.delete(m.id),
      drop: (m) => inflight.delete(m.id),
    });
    spot = null; nextSpotAt = 0.3; history = [[0, 0, 0]]; killed = null;
    TOPOLOGIES.forEach((t) => (topoEls[t].style.display = t === cfg.topology ? "" : "none"));
    const hubs = hubsOf(cfg.topology);
    collars.forEach((c, i) => (c.style.display = hubs.includes(i) ? "" : "none"));
    stations.forEach((s) => s.removeAttribute("data-dead"));
    walls.forEach((w) => (w.style.display = "none"));
    labelButtons();
    paint(); showStats();
  }

  function labelButtons() {
    cutBtn.textContent = net.partition ? L("Heal the network", "Restablecer la red") : L("Cut the network", "Cortar la red");
    killBtn.textContent = killed !== null ? L("Switch it back on", "Volver a encenderlo") : (cfg.topology === "hubs" || cfg.topology === "star" ? L("Switch off a hub", "Apagar un hub") : L("Switch off a node", "Apagar un nodo"));
  }
  function setCut(on) {
    net.setPartition(on);
    walls.forEach((w) => (w.style.display = on ? "" : "none"));
    labelButtons();
    say(on ? T("network cut between columns 2 and 3", "red cortada entre las columnas 2 y 3") : T("network healed", "red restablecida"));
  }
  function setKill(on) {
    const n = KILL[cfg.topology];
    if (on) { net.kill(n); killed = n; stations[n].setAttribute("data-dead", ""); }
    else { net.revive(n); killed = null; stations[n].removeAttribute("data-dead"); }
    labelButtons();
    say(on ? T("node " + (n + 1) + " switched off", "nodo " + (n + 1) + " apagado") : T("node " + (n + 1) + " back on", "nodo " + (n + 1) + " encendido de nuevo"));
  }

  function pickSpot() {
    const op = net.ops[net.ops.length - 1];
    if (!op) return;
    spot = { id: op.id, origin: op.origin, start: net.t };
  }

  let statTimer = 0;
  function step(dt) {
    const s = dt * cfg.speed;
    net.runTo(net.t + s);
    if (!spot || ((net.ops[spot.id].done || net.t - spot.start > 2.2) && net.t >= nextSpotAt)) {
      if (spot && !nextSpotAt) nextSpotAt = net.t + 0.35;
      if (!spot || net.t >= nextSpotAt) { pickSpot(); nextSpotAt = 0; }
    }
    const last = history[history.length - 1];
    if (net.t - last[0] >= 0.5) { history.push([net.t, net.stats.msgs, net.ops.length]); if (history.length > 24) history.shift(); }
    paint();
    statTimer += dt; if (statTimer > 0.3) { statTimer = 0; showStats(); }
  }

  function paint() {
    const t = net.t, routes = ROUTES[cfg.topology], load = {};
    let d = 0;
    for (const m of inflight.values()) {
      const key = keyOf(m.from, m.to);
      load[key] = (load[key] || 0) + 1;
      if (spot && d < dots.length && m.kind === "b" && m.values.includes(spot.id)) {
        const pts = routes[key]; if (!pts) continue;
        const path = m.from < m.to ? pts : [...pts].reverse();
        const u = Math.max(0, Math.min(1, (t - m.sent) / HOP));
        const [x, y] = along(path, u);
        dots[d].setAttribute("cx", x.toFixed(1)); dots[d].setAttribute("cy", y.toFixed(1)); dots[d].style.display = ""; d++;
      }
    }
    for (; d < dots.length; d++) dots[d].style.display = "none";
    for (const [key, el] of Object.entries(busy[cfg.topology])) {
      const o = Math.min(1, (load[key] || 0) / 5);
      const v = o > 0.02 ? o.toFixed(2) : "0";
      if (el.style.opacity !== v) el.style.opacity = v;
    }
    lenses.forEach((el, i) => el.toggleAttribute("data-on", !!spot && !net.dead.has(i) && net.seen[i].has(spot.id)));
    origins.forEach((el, i) => el.toggleAttribute("data-on", !!spot && spot.origin === i));
    if (spot) {
      const op = net.ops[spot.id];
      const lit = Math.min(op.have, 25);
      const took = op.done ? Math.round((op.done - op.t0) * 1000) : 0;
      say(T("value " + (spot.id + 1) + " · entered at node " + (spot.origin + 1) + " · " + lit + " of " + op.target + " lit" + (op.done ? " in " + took + " ms" : "") + (net.stats.overload ? " · network flooded" : ""),
        "valor " + (spot.id + 1) + " · entró en el nodo " + (spot.origin + 1) + " · " + lit + " de " + op.target + " encendidos" + (op.done ? " en " + took + " ms" : "") + (net.stats.overload ? " · red saturada" : "")));
    }
  }
  // A point a share u of the way along a polyline (by length). Not src/lib/geometry's pointAlong: a share, not a
  // distance, a straight two-point shortcut, and no clamp below the start.
  function along(pts, u) {
    if (pts.length === 2) return [pts[0][0] + (pts[1][0] - pts[0][0]) * u, pts[0][1] + (pts[1][1] - pts[0][1]) * u];
    const seg = []; let total = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
    let left = u * total;
    for (let i = 0; i < seg.length; i++) { if (left <= seg[i] || i === seg.length - 1) { const f = seg[i] ? Math.min(1, left / seg[i]) : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; } left -= seg[i]; }
    return pts[pts.length - 1];
  }

  const stat = stats();
  // Seconds as "250 ms" under one second, "1.25 s" above; "–" when there is nothing to show.
  const ms = (x) => (isFinite(x) ? msOrSecs(x) : "–");
  // Messages per value: one decimal, whole with thousands separators from 100 up.
  const n1 = (x) => (x >= 100 ? int(x) : x.toFixed(1));
  function showStats() {
    const first = history[0], now = [net.t, net.stats.msgs, net.ops.length];
    const ops = now[2] - first[2];
    const mpo = ops > 0 ? (now[1] - first[1]) / ops : NaN;
    // Values from the last 12 s: finished ones give latency; unfinished ones older than 3 s count as not delivered.
    const win = net.ops.filter((o) => o.t0 >= Math.max(0, net.t - 12) && (o.done || o.t0 < net.t - 3));
    const lat = win.filter((o) => o.done).map((o) => o.done - o.t0).sort((a, b) => a - b);
    const median = rankQuantileSorted(lat, 0.5, NaN), max = lat.length ? lat[lat.length - 1] : NaN;
    const delivered = win.length ? lat.length / win.length : NaN;
    stat("mpo", isFinite(mpo) ? n1(mpo) : "–");
    stat("median", ms(median));
    stat("max", ms(max));
    stat("delivered", isFinite(delivered) ? pct(delivered) : "–");
    stat("values", int(net.ops.length));
    setGauge("mpo", mpo); setGauge("max", max);
    const ok = (lim) => isFinite(mpo) && lat.length && delivered >= 0.999 && mpo < lim.m && median < lim.med && max < lim.max;
    stat("target", !lat.length ? "–" : ok({ m: 20, med: 1, max: 2 }) && ok({ m: 30, med: 0.4, max: 0.6 }) ? "3d + 3e" : ok({ m: 20, med: 1, max: 2 }) ? "3e" : ok({ m: 30, med: 0.4, max: 0.6 }) ? "3d" : L("neither", "ninguno"));
  }

  // ---------- controls ----------
  const pause = pauseControls(stage, say);
  const clock = WB.loop({ stage, step, onPause: pause.onPause });
  pause.bind(clock);
  function set(name, raw, quiet) {
    const value = name === "batch" || name === "speed" ? Number(raw) : name === "retries" ? raw === true || raw === "true" : raw;
    cfg[name] = value;
    WB.pressSeg(name, raw);
    if (name !== "speed" && !quiet) { restart(); say(T("settings applied · run restarted", "ajustes aplicados · ejecución reiniciada")); }
  }
  WB.onSegments((name, value) => set(name, value));
  cutBtn.addEventListener("click", () => setCut(!net.partition));
  killBtn.addEventListener("click", () => setKill(killed === null));
  act("reset").addEventListener("click", () => { restart(); say(T("started over", "empezamos de nuevo")); });

  // ---------- experiments (seeded runs of the same model, computed at build time) ----------
  const RUNS = {
    topology: () => {
      const rows = RESULTS.topology;
      const top = Math.max(...rows.map(([, r]) => r.msgsPerOp));
      const name = { grid: T("Grid", "Malla"), ring: T("Ring", "Anillo"), hubs: T("Hubs", "Hubs") };
      return {
        verdict: T(rows.map(([t, r]) => name[t].en + ": " + n1(r.msgsPerOp) + " messages, median " + ms(r.median) + ", max " + ms(r.max)).join(" · ") + ". Only hubs meets 3d.",
          rows.map(([t, r]) => name[t].es + ": " + n1(r.msgsPerOp) + " mensajes, mediana " + ms(r.median) + ", máx " + ms(r.max)).join(" · ") + ". Solo hubs cumple 3d."),
        bars: rows.map(([t, r]) => [name[t], r.msgsPerOp / top, n1(r.msgsPerOp) + " · " + ms(r.max), t === "hubs"]),
      };
    },
    batch: () => {
      const rows = [T("Off", "Sin agrupar"), T("Every 200 ms", "Cada 200 ms"), T("Every 500 ms", "Cada 500 ms")].map((label, i) => [label, RESULTS.batch[i]]);
      const top = Math.max(...rows.map(([, r]) => r.msgsPerOp));
      const [, off] = rows[0], [, b2] = rows[1], [, b5] = rows[2];
      return {
        verdict: T("Messages per value " + n1(off.msgsPerOp) + " → " + n1(b2.msgsPerOp) + ", median " + ms(off.median) + " → " + ms(b2.median) + ", max " + ms(b2.max) + ": inside 3e. At 500 ms the median reaches " + ms(b5.median) + " and misses it.",
          "Mensajes por valor " + n1(off.msgsPerOp) + " → " + n1(b2.msgsPerOp) + ", mediana " + ms(off.median) + " → " + ms(b2.median) + ", máx " + ms(b2.max) + ": dentro de 3e. Con 500 ms la mediana llega a " + ms(b5.median) + " y no lo cumple."),
        bars: rows.map(([label, r], i) => [label, r.msgsPerOp / top, n1(r.msgsPerOp) + " · " + ms(r.median), i === 1]),
      };
    },
    partition: () => {
      const { off, on } = RESULTS.partition;
      return {
        verdict: T("Without retries " + pct(off.delivered) + " of values reached every node; the rest never crossed. With retry-until-acked: " + pct(on.delivered) + ", but messages per value went from " + n1(off.msgsPerOp) + " to " + n1(on.msgsPerOp) + ".",
          "Sin reintentos, el " + pct(off.delivered) + " de los valores llegó a todos los nodos; el resto nunca cruzó. Reintentando hasta el ack: " + pct(on.delivered) + ", pero los mensajes por valor pasaron de " + n1(off.msgsPerOp) + " a " + n1(on.msgsPerOp) + "."),
        bars: [[T("No retries", "Sin reintentos"), off.delivered, pct(off.delivered), true], [T("Retry until acked", "Reintentar hasta el ack"), on.delivered, pct(on.delivered)]],
      };
    },
    hub: () => {
      const { hubs, grid } = RESULTS.hub;
      return {
        verdict: T("With the hub off, each value reached " + pct(hubs.reach) + " of the live nodes on average: its six leaves hear nothing and their values go nowhere. The grid with the same node off: " + pct(grid.reach) + ".",
          "Con el hub apagado, cada valor llegó en promedio al " + pct(hubs.reach) + " de los nodos vivos: sus seis hojas no reciben nada y sus valores no llegan a ningún lado. La malla con el mismo nodo apagado: " + pct(grid.reach) + "."),
        bars: [[T("Hubs, hub off", "Hubs, hub apagado"), hubs.reach, pct(hubs.reach), true], [T("Grid, node off", "Malla, nodo apagado"), grid.reach, pct(grid.reach)]],
      };
    },
    forward: () => {
      const { newOnly, every } = RESULTS.forward;
      return {
        verdict: T("One value caused " + newOnly.msgs + " messages forwarding only new values, and " + int(every.msgs) + " in the first second forwarding every copy, still growing when the second ended.",
          "Un valor causó " + newOnly.msgs + " mensajes reenviando solo valores nuevos, y " + int(every.msgs) + " en el primer segundo reenviando cada copia, y seguía creciendo al terminar ese segundo."),
        bars: [[T("New values only", "Solo valores nuevos"), newOnly.msgs / every.msgs, String(newOnly.msgs)], [T("Every copy", "Cada copia"), 1, int(every.msgs), true]],
      };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    ["topology", "batch", "retries", "forward"].forEach((name) => set(name, String(w[name]), true));
    restart();
    if (clock.paused) clock.setPaused(false);
    if (w.cut) { setTimeout(() => setCut(true), 1500); setTimeout(() => net.partition && setCut(false), 1500 + 3000 / cfg.speed); }
    if (w.kill) setTimeout(() => setKill(true), 1000);
  } });

  restart();
  if (clock.paused) act("pause").textContent = L("Play", "Reanudar");
}

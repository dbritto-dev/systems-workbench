// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The taxi rank in the browser: runs the model 20 times slower than real time, drives the cabs between the ranks,
// roads and the terminal kerb, and answers the controls. mount() gets the build-time data from page.ts (geometry, the
// cab drawing) and root, the <wb-lesson>.
import { iso, translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import { digitPath, counterCells } from "../../../workbench/digits.mjs";
import * as WB from "../../runtime/wb";
import { L, digitsOf } from "../../runtime/wb";
import { playPause } from "../../runtime/dom";
import { msOrSecs } from "../../lib/format";
import { rankQuantileSorted } from "../../lib/stats";
import { makeSim, slowdown, RETRY } from "./sim";

export default function mount({ P, G, CAB_SVG }, root) {
  const SLOW = 20;          // the machine runs 20× slower than real time
  const WARM = 1.5;         // each run starts this far in, so the first frame already shows a working rank
  const NS = "http://www.w3.org/2000/svg";
  const rankSlot = (cx, s) => [cx + G.RANK.dx + (s % G.RANK.cols) * G.RANK.sx, G.RANK.y + Math.floor(s / G.RANK.cols) * G.RANK.sy];

  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const kerbLayer = q("[data-kerbcabs]");
  const cols = G.COLS.map((cx, j) => ({
    cx, rx: cx + G.ROAD.dx, g: q('[data-col="' + j + '"]'), plot: q('[data-plot="' + j + '"]'),
    road: q('[data-roadcabs="' + j + '"]'), rank: q('[data-rankcabs="' + j + '"]'),
    people: Array.from({ length: G.PEOPLE.max }, (_, n) => q('[data-person="' + j + '-' + n + '"]')),
    slots: Array.from({ length: 20 }, (_, s) => q('[data-rankslot="' + j + '-' + s + '"]')),
    lamp: q('[data-booth-lamp="' + j + '"] .iso-solid'),
  }));
  const permits = [...svg.querySelectorAll("[data-permit]")];
  const poolerPanel = q("[data-pooler-panel]");
  const lamps = Array.from({ length: 20 }, (_, n) => q('[data-lamp="' + n + '"] .iso-solid'));
  const needle = q("[data-needle]");

  function counter(name, c) { const cells = counterCells(c); return { c, cells, els: cells.map((_, j) => q('[data-digit="' + name + '-' + j + '"]')), shown: [] }; }
  const dials = { open: counter("open", G.COUNTERS.open), wait: G.COUNTERS.wait.map((c, j) => counter("wait" + j, c)) };
  function showCount(dial, v) { digitsOf(v, dial.c.count).forEach((d, j) => { if (dial.shown[j] !== d) { dial.shown[j] = d; dial.els[j].setAttribute("d", digitPath(iso, P, dial.cells[j], d)); } }); }

  const cfg = { pool: 10, instances: 3, rate: 120, api: "none", leak: 0, pooler: "off", speed: 1 };
  let model, tokens = new Map(), bays = new Map(), snap = true, shownPermits = -1;
  let seed = (Date.now() % 1e6) + 1;

  function restart() {
    model = makeSim({ instances: cfg.instances, pool: cfg.pool, rate: cfg.rate, api: cfg.api, leak: cfg.leak, pooler: cfg.pooler === "on", stagger: 0.25, live: true }, seed++);
    model.runTo(WARM);
    for (const t of tokens.values()) t.g.remove();
    tokens.clear(); bays.clear(); snap = true;
    poolerPanel.style.display = cfg.pooler === "on" ? "" : "none";
    paint(0);
  }

  // Where each cab should be. Regions: the rank (in front), the road (between) and the kerb (at the terminal).
  const region = (y) => (y > G.RANK_EDGE ? 0 : y < G.KERB_EDGE ? 2 : 1);
  const bayAt = (n) => [G.BAY_X0 + (n % G.BAYS_PER_ROW) * G.BAY_STEP, G.BAY_ROWS[Math.floor(n / G.BAYS_PER_ROW)]];
  function takeBay(id, rx) {
    if (bays.has(id)) return bays.get(id);
    const used = new Set(bays.values());
    let best = -1, bestCost = Infinity;
    for (let n = 0; n < 2 * G.BAYS_PER_ROW; n++) {
      if (used.has(n)) continue;
      const [x, y] = bayAt(n), cost = Math.abs(x - (rx - 7)) + (y === G.BAY_ROWS[0] ? 1.5 : 0);   // left of the road end, clear of the booth
      if (cost < bestCost) { bestCost = cost; best = n; }
    }
    if (best >= 0) bays.set(id, best);
    return best;
  }
  // A trip to the kerb (a query) or to the booth (a new connection) is shorter in the model than the drive
  // on screen, so once a cab is sent there it finishes the trip and waits a moment before following the model.
  const DWELL = 0.35;
  function targets() {
    const out = new Map();
    const counts = cols.map(() => ({ stack: 0, layby: 0, lot: 0 }));
    const live = model.conns.filter((c) => c.state !== "closed" || (tokens.get(c.id) || {}).sticky).sort((a, b) => a.since - b.since);
    for (const id of [...bays.keys()]) { const c = model.conns.find((x) => x.id === id); const t = tokens.get(id); if ((!c || c.state !== "query") && !(t && t.sticky && t.sticky.bay === bays.get(id))) bays.delete(id); }
    for (const c of live) {
      const col = cols[c.inst], n = counts[c.inst];
      if (!col) continue;
      const t = tokens.get(c.id);
      let x, y, sticky = null;
      if (c.state === "query") { const b = takeBay(c.id, col.rx); if (b < 0) continue; [x, y] = bayAt(b); sticky = { x, y, bay: b }; }
      else if (c.state === "connecting") { const s = Math.min(n.stack++, G.STACK.max - 1); x = col.rx; y = G.STACK.y + s * G.STACK.step; sticky = { x, y }; }
      else if (t && t.sticky) { x = t.sticky.x; y = t.sticky.y; if (t.sticky.bay === undefined) n.stack++; }
      else if (c.state === "idle") { if (c.slot < 0) continue; [x, y] = rankSlot(col.cx, c.slot); }
      else if (c.state === "gate") { const s = Math.min(n.stack++, G.STACK.max - 1); x = col.rx; y = G.STACK.y + s * G.STACK.step; }
      else if (c.state === "api") { const s = Math.min(n.layby++, G.LAYBY.max - 1); x = col.cx + G.LAYBY.dx; y = G.LAYBY.y + s * G.LAYBY.step; }
      else if (c.state === "leaked") { const s = n.lot++; if (s >= G.LOT.cols * G.LOT.rows) continue; x = col.cx + G.LOT.dx + (s % G.LOT.cols) * G.LOT.sx; y = G.LOT.y + Math.floor(s / G.LOT.cols) * G.LOT.sy; }
      else if (c.state === "closed") continue;
      else continue;
      out.set(c.id, { x, y, col, sticky, lit: !!c.req || !!(t && t.sticky && t.sticky.lit), spawn: c.slot >= 0 && cfg.pool > 0 ? rankSlot(col.cx, c.slot) : [col.rx, G.RANK_EDGE - 0.4] });
    }
    return out;
  }
  function nextPoint(x, y, tx, ty, rx) {
    const a = region(y), b = region(ty);
    if (a === b) return [tx, ty];
    if (a === 0) return [rx, G.RANK_EDGE - 0.4];
    if (a === 2) return Math.abs(x - rx) > 0.05 ? [rx, y] : [rx, G.KERB_EDGE + 0.4];
    if (Math.abs(x - rx) > 0.05) return [rx, y];
    return b === 2 ? [rx, ty] : [rx, G.RANK_EDGE + 0.4];
  }
  function move(t, tx, ty, rx, dist) {
    for (let i = 0; i < 6 && dist > 1e-6; i++) {
      const [px, py] = nextPoint(t.x, t.y, tx, ty, rx);
      const dx = px - t.x, dy = py - t.y, len = Math.hypot(dx, dy);
      if (len <= dist) { t.x = px; t.y = py; dist -= len; if (px === tx && py === ty) break; }
      else { t.x += (dx / len) * dist; t.y += (dy / len) * dist; dist = 0; }
    }
  }

  let wallNow = 0;
  function paint(wallDt) {
    wallNow += wallDt;
    // Cabs.
    const want = targets();
    for (const [id, t] of tokens) if (!want.has(id)) { t.g.remove(); tokens.delete(id); }
    const dist = wallDt * 320 * Math.sqrt(cfg.speed);
    const layers = new Map();
    for (const [id, w] of want) {
      let t = tokens.get(id);
      if (!t) {
        const g = document.createElementNS(NS, "g"); g.innerHTML = CAB_SVG;
        const [sx, sy] = snap ? [w.x, w.y] : w.spawn;
        t = { g, solid: g.firstElementChild, pax: g.querySelector("[data-pax]"), x: sx, y: sy, layer: null, lit: null };
        tokens.set(id, t);
      }
      if (w.sticky && !t.sticky) t.sticky = { ...w.sticky, lit: w.lit, at: -1 };
      if (snap) { t.x = w.x; t.y = w.y; t.sticky = null; } else move(t, w.x, w.y, w.col.rx, dist);
      if (t.sticky && Math.abs(t.x - t.sticky.x) + Math.abs(t.y - t.sticky.y) < 0.01) {
        if (t.sticky.at < 0) t.sticky.at = wallNow;
        else if (wallNow - t.sticky.at > DWELL) t.sticky = null;
      }
      t.g.setAttribute("transform", translateAlong(P, [t.x, t.y, 0]));
      if (t.lit !== w.lit) { t.lit = w.lit; t.solid.toggleAttribute("data-lit", w.lit); t.pax.style.display = w.lit ? "" : "none"; }
      const r = region(t.y), layer = r === 2 ? kerbLayer : r === 1 ? w.col.road : w.col.rank;
      if (!layers.has(layer)) layers.set(layer, []);
      layers.get(layer).push(t);
    }
    // Within each layer, draw far cabs first.
    for (const [layer, list] of layers) {
      list.sort((a, b) => depthOf([a.x, a.y, 0], P) - depthOf([b.x, b.y, 0], P));
      let prev = null;
      for (const t of list) { if (t.g.parentNode !== layer || t.g.previousSibling !== prev) layer.insertBefore(t.g, prev ? prev.nextSibling : layer.firstChild); prev = t.g; }
    }
    snap = false;

    // Hotels: which are running, their rank slots, waiting passengers and the counter over the door.
    const recent = (cfg.speed / SLOW) * 0.8;
    cols.forEach((col, j) => {
      const inst = model.instances[j], on = !!(inst && inst.on);
      col.g.toggleAttribute("data-off", !on);
      col.plot.style.display = on ? "none" : "";
      if (!on) return;
      col.slots.forEach((s, n) => { s.style.display = n < cfg.pool ? "" : "none"; });
      const waiting = inst.waiters.length;
      col.people.forEach((p, n) => { p.style.display = n < waiting ? "" : "none"; });
      showCount(dials.wait[j], Math.min(99, waiting));
      let refusedAt = -9; for (let i = model.refusals.length - 1; i >= 0; i--) if (model.refusals[i][1] === j) { refusedAt = model.refusals[i][0]; break; }
      col.lamp.toggleAttribute("data-lit", model.now - refusedAt < Math.max(recent, RETRY));   // lit while this hotel is being turned away
    });

    // The terminal: permit board, open counter, pooler lamps, gauge.
    const open = model.dbOpen;
    if (open !== shownPermits) { shownPermits = open; permits.forEach((p, n) => p.toggleAttribute("data-used", n < open)); }
    showCount(dials.open, open);
    if (cfg.pooler === "on") lamps.forEach((l, n) => l.toggleAttribute("data-lit", n < model.pooler.busy));
    const slow = slowdown(model.active);
    const frac = Math.max(0, Math.min(1, Math.log2(slow) / 5));
    const a = G.NEEDLE_SPAN[0] + frac * (G.NEEDLE_SPAN[1] - G.NEEDLE_SPAN[0]);
    const g = G.GAUGE, tip = iso([g.x + Math.sin(a) * (g.r - 1.6), g.y - Math.cos(a) * (g.r - 1.6), g.z], P), tail = iso([g.x - Math.sin(a) * 1.6, g.y + Math.cos(a) * 1.6, g.z], P);
    needle.setAttribute("d", "M" + tail[0].toFixed(1) + " " + tail[1].toFixed(1) + "L" + tip[0].toFixed(1) + " " + tip[1].toFixed(1));

    // Stats and readout.
    const since = Math.max(0.001, Math.min(1, model.now));
    const lastSecond = model.done.filter((d) => d[0] > model.now - since);
    const lat = lastSecond.map((d) => d[1]).sort((x, y) => x - y);
    const p95 = rankQuantileSorted(lat, 0.95);
    const waiting = model.waiting(), leaked = model.leaked();
    stat("served", Math.round(lastSecond.length / since));
    stat("p95", lat.length ? msOrSecs(p95) : "–");
    stat("waiting", waiting);
    stat("failed", (model.timeouts + model.refused) + (model.refused ? L(" (" + model.refused + " refused)", " (" + model.refused + " rechazadas)") : ""));
    stat("open", open + " / 60");
    stat("slow", "×" + slow.toFixed(1));
    const paused = clock && clock.paused;
    say(L(model.active + " at the kerb · " + waiting + " waiting" + (leaked ? " · " + leaked + " never returned" : "") + " · " + open + " of 60 permits" + (paused ? " · paused" : ""),
      model.active + " en la terminal · " + waiting + " esperando" + (leaked ? " · " + leaked + " sin devolver" : "") + " · " + open + " de 60 permisos" + (paused ? " · en pausa" : "")));
  }
  const stat = (key, value) => root.stat(key, value);

  // The readout says "paused" itself (paint() reads clock.paused), so it is painted again after the pause controls.
  const pause = playPause(root);
  let clock = null;
  clock = WB.loop({ stage, step: (dt) => { model.runTo(model.now + (dt * cfg.speed) / SLOW); paint(dt); }, onPause: (on) => { pause.onPause(on); if (model) paint(0); } });
  pause.bind(clock);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    if (name === "instances") { cfg.instances = Number(raw); if (!quiet) { model.scaleTo(cfg.instances); paint(0); } return; }
    if (name === "pool" || name === "rate" || name === "leak") cfg[name] = Number(raw); else cfg[name] = raw;
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));
  const actions = { reset: () => restart() };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  let scaleTimer = null;
  root.on("watch", (w) => {
    clearTimeout(scaleTimer);
    for (const key of ["pool", "instances", "rate", "api", "leak", "pooler"]) set(key, String(w[key]), true);
    set("speed", String(w.speed || 1), true);
    restart();
    if (clock.paused) clock.setPaused(false);
    if (w.scaleTo) scaleTimer = setTimeout(() => set("instances", String(w.scaleTo)), 4000);
  });

  clock.setPaused(clock.paused);
  restart();
}

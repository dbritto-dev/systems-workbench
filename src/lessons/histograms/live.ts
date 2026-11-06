// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The sorting room in the browser: runs the fleet, drops a sample of requests into their tubes, keeps each host's
// tubes and p99 current, flies the scrape slips to the merged rack every few seconds and updates the merged tubes
// and the desk when they land. mount() gets the build-time data from page.ts (projection, geometry, drawings) and
// root, the <wb-lesson>.
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { playPause } from "../../runtime/dom";
import { lerp, easeInOutCubic } from "../../lib/tween";
import { makeFleet, LAYOUTS, SHARES, RATE, WINDOW, SLO, bucketOf } from "./sim";
import { fillSvg, heightOf } from "./fill";

export default function mount({ P, G, CHIP, SLIP, SCRAPE, CHIP_EVERY }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const stat = (key, value) => root.stat(key, value);
  const NS = "http://www.w3.org/2000/svg";
  const chipsLayer = q('[data-layer="chips"]'), slipsLayer = q('[data-layer="slips"]'), atLeastMark = q("[data-atleast]");
  const hostCounters = [0, 1, 2].map((i) => WB.counter(svg, "p99-" + i, P));
  const desk = Object.fromEntries(["avg", "max", "est", "exact", "under", "under-f"].map((n) => [n, WB.counter(svg, n, P)]));
  const NREF = RATE * WINDOW, FLIGHT = 1.6, FALL = 0.55, MAX_CHIPS = 36;
  const spec = (i) => (i === 3 ? G.TUBE.M : G.TUBE.host);
  // Per layout: the tube groups and the fill group of every tube, rack by rack.
  const layouts = Object.fromEntries(Object.keys(LAYOUTS).map((name) => [name, {
    groups: [0, 1, 2, 3].map((i) => q('[data-tubes="' + i + '"][data-layout="' + name + '"]')),
    fills: [0, 1, 2, 3].map((i) => G.XS[name][i].map((_, j) => q('[data-tubes="' + i + '"][data-layout="' + name + '"] [data-fill="' + i + "-" + j + '"]'))),
    labels: q('[data-labels="' + name + '"]'),
  }]));

  const cfg = { share: "1", slow: "slow", buckets: "fine", speed: 1 };
  let model, clock, seenId, chips, slips, nextScrape, pending, live, dash, sumIn, note, shown, seed = 7;
  const modelCfg = () => ({ share: SHARES[cfg.share], slow: cfg.slow === "slow", buckets: cfg.buckets });
  const edges = () => LAYOUTS[cfg.buckets];

  function restart() {
    model = makeFleet(modelCfg(), seed);
    seed = (Date.now() % 1e6) + 1;
    clock = WINDOW;                       // start with a full minute behind every host
    model.runTo(clock);
    seenId = model.recent.length ? model.recent[model.recent.length - 1].id : 0;
    chipsLayer.textContent = ""; slipsLayer.textContent = "";
    chips = []; slips = []; pending = null; note = null; sumIn = 0;
    nextScrape = clock + SCRAPE;
    for (const [name, l] of Object.entries(layouts)) {
      const on = name === cfg.buckets;
      l.groups.forEach((g) => (g.style.display = on ? "" : "none"));
      l.labels.style.display = on ? "" : "none";
      l.fills.forEach((row) => row.forEach((el) => (el.innerHTML = "")));
    }
    shown = [0, 1, 2, 3].map(() => ({ h: [], lit: -1 }));
    live = model.summary();
    dash = live;
    paintHosts(true);
    paintDash();
  }

  // ---------- tubes ----------
  function drawRack(i, counts, lit, snap) {
    const l = layouts[cfg.buckets], s = spec(i), sh = shown[i];
    counts.forEach((c, j) => {
      const target = heightOf(c, NREF, s.h);
      const h = snap || sh.h[j] === undefined ? target : sh.h[j];
      if (sh.h[j] === undefined || Math.abs(target - sh.h[j]) > 0.2 || sh.lit !== lit) {
        sh.h[j] = target;
        l.fills[i][j].innerHTML = fillSvg(P, G.XS[cfg.buckets][i][j], G.TUBE_Y, G.TUBE_Z, s.r, h, j === lit);
      }
    });
    sh.lit = lit;
  }
  function paintHosts(snap) {
    for (let i = 0; i < 3; i++) {
      drawRack(i, live.counts[i], live.ns[i] ? live.hostBuckets[i] : -1, snap);
      hostCounters[i].setClamped(Math.round(live.p99s[i]));
    }
  }
  const ms = (x) => Math.round(x) + " ms";
  const pc = (x) => (100 * x).toFixed(1) + "%";
  function paintDash() {
    const s = dash;
    drawRack(3, s.merged, s.estBucket, true);
    desk.avg.setClamped(Math.round(s.avg)); desk.max.setClamped(Math.round(s.max)); desk.est.setClamped(Math.round(s.est)); desk.exact.setClamped(Math.round(s.exact));
    const tenths = Math.round(1000 * s.underBuckets);
    desk.under.setClamped(Math.floor(tenths / 10)); desk["under-f"].set(tenths % 10);
    stat("avg", ms(s.avg)); stat("max", ms(s.max)); stat("est", ms(s.est)); stat("exact", ms(s.exact));
    // buckets that stop below 300 ms can only say "at least the share under their top edge"
    const atLeast = edges()[edges().length - 1] < SLO;
    atLeastMark.style.display = atLeast ? "" : "none";
    stat("under", (atLeast ? "≥ " : "") + pc(s.underBuckets)); stat("underx", pc(s.underExact));
  }

  // ---------- chips: one request in CHIP_EVERY drops into its tube ----------
  function spawnChips() {
    for (const r of model.recent) {
      if (r.id <= seenId) continue;
      seenId = r.id;
      if (r.id % CHIP_EVERY || chips.length >= MAX_CHIPS) continue;
      const g = document.createElementNS(NS, "g");
      g.innerHTML = CHIP;
      chipsLayer.appendChild(g);
      const j = bucketOf(r.ms, edges());
      chips.push({ g, host: r.host, j, x: G.XS[cfg.buckets][r.host][j], age: 0 });
    }
  }
  function moveChips(dt) {
    const s = G.TUBE.host, top = G.TUBE_Z + s.h + 6;
    for (const c of chips) {
      c.age += dt;
      const f = Math.min(1, c.age / FALL);
      const floor = G.TUBE_Z + Math.max(0, shown[c.host].h[c.j] || 0);
      c.g.setAttribute("transform", translateAlong(P, [c.x, G.TUBE_Y, top + (floor - top) * f * f]));
      c.g.style.opacity = f < 0.15 ? String(f / 0.15) : "";
    }
    chips = chips.filter((c) => { if (c.age < FALL) return true; c.g.remove(); return false; });
  }

  // ---------- scrape slips: each host's bucket counts fly to the merged rack ----------
  function scrape() {
    pending = model.summary();
    slips = [0, 1, 2].map((i) => {
      const g = document.createElementNS(NS, "g");
      g.innerHTML = SLIP;
      g.querySelectorAll("[data-slip-key]").forEach((t) => (t.textContent = "ABC"[i]));
      slipsLayer.appendChild(g);
      return { g, from: G.SLIP_FROM[i], to: G.SLIP_TO[i], t0: clock };
    });
    note = { until: clock + FLIGHT + 0.4 * cfg.speed, text: T("scrape: A, B and C's bucket counts go to the merged rack", "recolección: los conteos de A, B y C van al estante combinado") };
  }
  function moveSlips() {
    if (!slips.length) return;
    const f = Math.min(1, (clock - slips[0].t0) / FLIGHT), e = easeInOutCubic(f);
    for (const s of slips) {
      const p = [lerp(s.from[0], s.to[0], e), lerp(s.from[1], s.to[1], e), s.to[2] + (G.SLIP_PEAK - s.to[2]) * Math.sin(Math.PI * f)];
      s.g.setAttribute("transform", translateAlong(P, p));
      s.g.style.opacity = f > 0.9 ? String(Math.max(0, (1 - f) / 0.1)) : "";
    }
    if (f >= 1) {
      for (const s of slips) s.g.remove();
      slips = [];
      dash = pending; pending = null;
      paintDash();
    }
  }

  // ---------- the readout ----------
  function readout() {
    const s = dash, top = edges()[edges().length - 1];
    if (note && clock < note.until) return say(L(note.text));
    if (s.estBucket === edges().length) return say(L("the p99 is in the +Inf bucket · the buckets can only say it's over " + top + " ms",
      "el p99 está en el bucket +Inf · los buckets solo dicen que pasa de " + top + " ms"));
    say(L("avg of p99s " + ms(s.avg) + " · merged buckets " + ms(s.est) + " · exact " + ms(s.exact),
      "promedio de p99 " + ms(s.avg) + " · buckets combinados " + ms(s.est) + " · exacto " + ms(s.exact)));
  }

  function step(dt) {
    clock += dt * cfg.speed;
    model.runTo(clock);
    spawnChips();
    moveChips(dt);
    sumIn -= dt;
    if (sumIn <= 0) { sumIn = 0.3; live = model.summary(); paintHosts(false); }
    if (!slips.length && clock >= nextScrape) { nextScrape = clock + SCRAPE; scrape(); }
    moveSlips();
    readout();
  }

  const pause = playPause(root);
  const loop = WB.loop({ stage, step, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = String(raw);
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));
  const actions = {
    spike: () => {
      if (cfg.slow === "slow") { note = { until: clock + 2.5 * cfg.speed, text: T("host C is already 8× slower · set it to Healthy first", "el host C ya va 8× más lento · ponlo en Sano primero") }; return; }
      model.spike(10);
      note = { until: clock + 3 * cfg.speed, text: T("host C is 8× slower for the next 10 s", "el host C va 8× más lento los próximos 10 s") };
      if (loop.paused) loop.setPaused(false);
    },
    reset: () => restart(),
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    set("share", w.share, true); set("slow", w.slow, true); set("buckets", w.buckets, true);
    restart();
    if (loop.paused) loop.setPaused(false);
  });

  loop.setPaused(loop.paused);
  restart();
}

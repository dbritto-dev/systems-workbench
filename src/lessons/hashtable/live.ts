// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The pigeonhole rack in the browser: inserts keys and looks some up on the same table model the experiments use,
// animating each trace (stamp, shuttle, compares or probes, the card dropping in, the rack doubling), and wires the
// controls and the experiment cards. mount() gets the build-time data from page.ts (geometry, results).
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats as statsStrip, show, act, pauseControls } from "../../runtime/dom";
import { smoothstep } from "../../lib/tween";
import { n0 } from "../../lib/format";
import { rngMixed as rng } from "../../lib/random";
import { makeTable, hashOf, userKeys, attackKeys } from "./sim";

export default function mount({ P, G, COUNTERS, RESULTS, EXPERIMENTS }) {
  const TRAY_CX = G.CX;
  const stage = document.querySelector("[data-hashtable]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const say = readout();
  const ease = smoothstep;
  const lift = (el, by) => el.setAttribute("transform", translateAlong(P, by));
  const setText = (el, s) => { if (el.textContent !== s) el.textContent = s; };
  const setLit = (g, on) => g.querySelectorAll(".iso-solid").forEach((s) => s.toggleAttribute("data-lit", on));
  const dials = Object.fromEntries(Object.keys(COUNTERS).map((n) => [n, WB.counter(svg, n, P)]));
  const wheel = (name, v) => dials[name].set(Math.max(0, Math.min(v, 10 ** COUNTERS[name].count - 1)));
  const gauge = WB.meter(svg, "load", P);
  const stat = statsStrip();

  const cards = Array.from({ length: G.SLOTS }, (_, i) => Array.from({ length: G.PILE }, (_, s) => q('[data-c="' + i + "-" + s + '"]')));
  const more = Array.from({ length: G.SLOTS }, (_, i) => ({ g: q('[data-more="' + i + '"]'), label: q('[data-more-label="' + i + '"]') }));
  const lids = Array.from({ length: G.SLOTS }, (_, i) => q('[data-lid="' + i + '"]'));
  const shuttle = q("[data-shuttle]"), keyCard = q("[data-keycard]"), keyLabel = q("[data-key-label]"), keySub = q("[data-key-sub]");
  const head = q("[data-head]"), fly = q("[data-fly]");

  const cfg = { hash: "seeded", keys: "random", mode: "chain", grow: "on", speed: 1 };
  const ATTACK = attackKeys(60, 3);
  const short = (key) => key.slice(5);

  // ---------- what the rack shows ----------
  // The piles for a list of keys in insertion order, placed the way the table places them (a fresh table, no resizing).
  let tb, shownM = 8;
  function layout(keys, m) {
    const v = makeTable({ mode: tb.mode, hash: tb.hash, grow: false, m, seed: tb.seed });
    keys.forEach((key) => v.insert(key));
    return v.slots.map((s) => (tb.mode === "chain" ? s.length : s === null ? 0 : 1));
  }
  function paint(keys, m) {
    const piles = layout(keys, m);
    shownM = m;
    for (let i = 0; i < G.SLOTS; i++) {
      const n = i < m ? piles[i] : 0;
      cards[i].forEach((c, s) => { show(c, s < n); setLit(c, false); });
      show(more[i].g, n > G.PILE);
      if (n > G.PILE) setText(more[i].label, "+" + (n - G.PILE));
      show(lids[i], i >= m);
    }
    return piles;
  }
  const lightCard = (slot, level, on) => { const c = cards[slot][Math.min(level, G.PILE - 1)]; if (c) setLit(c, on); };

  // ---------- the script: insert keys, look some up, start over ----------
  let cycle = 0, pool, poolAt, ops, op, msg = null, probesShown = 0, lastProbes = null, sx = G.HOME_X, holding = 0;
  const random = rng(97);
  function reset() {
    cycle++;
    tb = makeTable({ mode: cfg.mode, hash: cfg.hash, grow: cfg.grow === "on", m: 8, seed: 1 + (cycle % 7) });
    pool = cfg.keys === "attack" ? ATTACK.slice((cycle * 7) % 30) : userKeys(40, 11 + cycle);
    poolAt = 0; ops = 0; op = null; holding = 0; lastProbes = null; probesShown = 0; tailLookups = 0;
    paint([], 8);
    sx = G.HOME_X; lift(shuttle, [sx, 0, 0]); show(fly, false);
    setText(keyLabel, ""); setText(keySub, "");
  }
  let tailLookups = 0;
  function full() {
    if (cfg.grow === "on") return tb.wouldResize() && tb.m * 2 > G.SLOTS;
    return tb.mode === "chain" ? tb.n >= 24 : tb.n >= tb.m - 1;
  }
  function nextOp() {
    ops++;
    const lookupNow = tb.n > 2 && ops % 4 === 0;
    if (!lookupNow && !full()) return { kind: "insert", key: pool[poolAt++] };
    if (!full()) return { kind: "lookup", key: tb.keys[Math.floor(random() * tb.n)] };
    if (tailLookups === 0) { tailLookups++; return { kind: "lookup", key: tb.keys[Math.floor(random() * tb.n)] }; }
    if (tailLookups === 1) { tailLookups++; return { kind: "lookup", key: cfg.keys === "attack" ? ATTACK[59] : "user:0420" }; }
    return null;
  }
  // Start an operation: run it on the table now, then animate the trace.
  function begin() {
    const o = nextOp();
    if (!o) { holding = 2.2; return; }
    const before = tb.keys.slice(), mBefore = tb.m;
    const tr = o.kind === "insert" ? tb.insert(o.key) : tb.lookup(o.key);
    op = { ...o, tr, before, mBefore, phase: "back", t: 0, step: 0, probes: 0 };
    setText(keyLabel, short(o.key)); setText(keySub, o.kind === "insert" ? "+" : "?"); show(keyCard, true);
    probesShown = 0;
    wheel("probes", 0);
  }
  // "1 probe" / "3 probes", "1 sondeo" / "3 sondeos"
  const pr = (n) => T(n + (n === 1 ? " probe" : " probes"), n + (n === 1 ? " sondeo" : " sondeos"));
  const cmp = (n) => T(n + (n === 1 ? " compare" : " compares"), n + (n === 1 ? " comparación" : " comparaciones"));
  const K = (n) => T(n + (n === 1 ? " key" : " keys"), n + (n === 1 ? " clave" : " claves"));
  function describe() {
    const o = op, tr = o.tr, key = o.key, b = tr.home, ch = tb.mode === "chain";
    if (o.kind === "insert") {
      if (ch) return tr.probes ? T(key + " → bucket " + b + " · compared with " + K(tr.probes).en + ", none equal · added to the chain", key + " → cubeta " + b + " · comparada con " + K(tr.probes).es + ", ninguna igual · se agrega a la cadena")
        : T(key + " → bucket " + b + " · empty · starts a chain", key + " → cubeta " + b + " · vacía · empieza una cadena");
      const extra = tr.path.length - 1;
      return extra ? T(key + " → slot " + b + " taken · tried the next " + extra + " · stored in slot " + tr.at + " (" + pr(tr.probes).en + ")", key + " → casilla " + b + " ocupada · probó las " + extra + " siguientes · guardada en la casilla " + tr.at + " (" + pr(tr.probes).es + ")")
        : T(key + " → slot " + b + " is free · 1 probe", key + " → la casilla " + b + " está libre · 1 sondeo");
    }
    if (tr.found) return ch ? T("find " + key + " → bucket " + b + " · found on compare " + tr.probes, "buscar " + key + " → cubeta " + b + " · encontrada en la comparación " + tr.probes)
      : T("find " + key + " → slot " + b + " · found in slot " + tr.at + " (" + pr(tr.probes).en + ")", "buscar " + key + " → casilla " + b + " · encontrada en la casilla " + tr.at + " (" + pr(tr.probes).es + ")");
    return ch ? T("find " + key + " → bucket " + b + " · not there: " + cmp(tr.probes).en + " to be sure", "buscar " + key + " → cubeta " + b + " · no está: " + cmp(tr.probes).es + " para estar seguro")
      : T("find " + key + " → slot " + b + " · not there: " + pr(tr.probes).en + " until an empty slot", "buscar " + key + " → casilla " + b + " · no está: " + pr(tr.probes).es + " hasta una casilla vacía");
  }

  // ---------- animation ----------
  const DUR = { back: 0.35, stamp: 0.5, resize: 1.6, travel: 0.5, look: 0.2, hop: 0.16, drop: 0.35, rest: 0.35 };
  function moveShuttle(x) { sx = x; lift(shuttle, [x, 0, 0]); }
  function step(dt) {
    if (holding > 0) { holding -= dt; if (holding <= 0) reset(); return; }
    if (!op) { begin(); if (!op) return; }
    const o = op, tr = o.tr;
    o.t += dt;
    if (o.phase === "back") {
      const p = ease(o.t / DUR.back);
      moveShuttle(sx + (G.HOME_X - sx) * p);
      if (o.t >= DUR.back) { o.phase = "stamp"; o.t = 0; msg = o.kind === "insert" ? T("insert " + o.key + ": hash it", "insertar " + o.key + ": calcular su hash") : T("find " + o.key + ": hash it", "buscar " + o.key + ": calcular su hash"); }
      return;
    }
    if (o.phase === "stamp") {
      const p = o.t / DUR.stamp, down = p < 0.5 ? ease(p * 2) : ease((1 - p) * 2);
      lift(head, [0, 0, G.HEAD_Z - 3.2 * down]); setLit(head, p > 0.2 && p < 0.8);
      if (p >= 0.5 && !o.stamped) { o.stamped = true; wheel("bucket", tr.resized ? hashOf(o.key, tb.hash, tb.seed) % tr.resized.from : tr.home); setText(keySub, "→ " + (tr.resized ? hashOf(o.key, tb.hash, tb.seed) % tr.resized.from : tr.home)); }
      if (o.t >= DUR.stamp) { setLit(head, false); o.phase = tr.resized ? "resize" : "travel"; o.t = 0; if (tr.resized) msg = T("load would pass 75% · double to " + tr.resized.to + " buckets, place all " + tr.resized.moved + " keys again", "la carga pasaría del 75% · duplicar a " + tr.resized.to + " cubetas y reubicar las " + tr.resized.moved + " claves"); }
      return;
    }
    if (o.phase === "resize") {
      const p = o.t / DUR.resize, moved = tr.resized.moved;
      if (!o.opened) { o.opened = true; paint([], tr.resized.to); }
      const k = Math.min(moved, Math.floor(Math.max(0, (p - 0.15) / 0.75) * moved + 0.0001));
      if (k !== o.placed) { o.placed = k; paint(o.before.slice(0, k), tr.resized.to); wheel("moved", tb.moved - moved + k); }
      if (o.t >= DUR.resize) { o.phase = "travel"; o.t = 0; wheel("bucket", tr.home); setText(keySub, "→ " + tr.home); }
      return;
    }
    if (o.phase === "travel") {
      if (o.from === undefined) { o.from = sx; msg = tb.mode === "chain" ? T(o.key + " → bucket " + tr.home, o.key + " → cubeta " + tr.home) : T(o.key + " → slot " + tr.home, o.key + " → casilla " + tr.home); }
      const p = ease(o.t / DUR.travel);
      moveShuttle(o.from + (TRAY_CX[tr.home] - o.from) * p);
      if (o.t >= DUR.travel) { o.phase = "look"; o.t = 0; o.step = 0; }
      return;
    }
    const chain = tb.mode === "chain";
    if (o.phase === "look") {
      // chaining: light the pile's cards one by one; probing: check one slot, then hop to the next.
      const total = tr.probes, d = chain ? Math.max(0.05, Math.min(DUR.look, 1.6 / Math.max(1, total))) : DUR.look + DUR.hop;
      const idx = Math.floor(o.t / d);
      if (chain) {
        const n = Math.min(idx, total);
        if (n !== probesShown) { for (let s = 0; s < G.PILE; s++) lightCard(tr.home, s, false); if (n > 0) lightCard(tr.home, n - 1, true); probesShown = n; wheel("probes", n); }
        if (idx > total || (total === 0 && o.t > 0.1)) { o.phase = o.kind === "insert" ? "drop" : "rest"; o.t = 0; msg = describe(); }
      } else {
        const j = Math.min(idx, tr.path.length - 1), slot = tr.path[j];
        const local = o.t - idx * d;
        if (j !== o.step || !o.began) { o.began = true; o.step = j; probesShown = j + 1; wheel("probes", probesShown); for (let i = 0; i < G.SLOTS; i++) lightCard(i, 0, false); }
        const occupied = o.kind === "insert" ? j < tr.path.length - 1 : (tr.found ? j < tr.path.length - 1 : j < tr.path.length - 1);
        if (local < DUR.look) { if (occupied || (o.kind === "lookup" && tr.found && j === tr.path.length - 1)) lightCard(slot, 0, true); }
        else if (j < tr.path.length - 1) { lightCard(slot, 0, false); const nx = tr.path[j + 1]; const from = TRAY_CX[slot], to = TRAY_CX[nx]; moveShuttle(from + (to - from) * ease((local - DUR.look) / DUR.hop)); }
        if (idx >= tr.path.length) { moveShuttle(TRAY_CX[tr.path[tr.path.length - 1]]); o.phase = o.kind === "insert" ? "drop" : "rest"; o.t = 0; msg = describe(); }
      }
      return;
    }
    if (o.phase === "drop") {
      if (!o.dropping) {
        o.dropping = true;
        paint(o.before, tb.m);
        o.slot = chain ? tr.home : tr.at;
        o.level = chain ? tr.at : 0;
        show(fly, true); show(keyCard, false);
      }
      const p = ease(o.t / DUR.drop);
      lift(fly, [G.CX[o.slot] - G.CX[0], G.Y[o.slot] - G.Y[0], G.Z[o.slot] - G.Z[0] + Math.min(o.level, G.PILE - 1) * G.CARD_PITCH + 9 * (1 - p)]);
      if (o.t >= DUR.drop) { show(fly, false); paint(tb.keys, tb.m); o.phase = "rest"; o.t = 0; }
      return;
    }
    if (o.phase === "rest") {
      if (o.kind === "lookup" && tr.found && chain) lightCard(tr.home, tr.at, true);
      if (o.t >= DUR.rest + (o.kind === "lookup" ? 0.4 : 0)) { lastProbes = tr.probes; paint(tb.keys, tb.m); op = null; }
    }
  }

  function stats() {
    const s = tb.stats();
    wheel("keys", s.n); wheel("longest", s.longest);
    if (!op || op.phase !== "resize") wheel("moved", s.moved);
    gauge.set(Math.min(1, s.load / G.METER_MAX));
    stat("keys", s.n); stat("buckets", s.m); stat("load", s.load.toFixed(2));
    stat("last", lastProbes === null ? "–" : lastProbes); stat("avg", s.n ? s.avg.toFixed(2) : "–");
    stat("longest", s.longest); stat("moved", s.moved);
  }

  const pause = pauseControls(stage, say);
  const loop = WB.loop({
    stage,
    step: (dt) => { step(dt * cfg.speed); stats(); say(holding > 0 ? L("full for this figure · starting over", "llena para esta figura · se empieza de nuevo") : msg ? L(msg) : L("starting", "iniciando")); },
    onPause: pause.onPause,
  });
  pause.bind(loop);

  function set(name, raw, quiet) {
    WB.pressSeg(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = raw;
    if (!quiet) { cycle = 0; reset(); }
  }
  WB.onSegments((name, value) => set(name, value));
  act("reset").addEventListener("click", () => { cycle = 0; reset(); });

  // ---------- experiments (numbers computed from the same model at build time, six seeds where keys are random) ----------
  const n2 = (x) => x.toFixed(x < 10 ? 1 : 0);
  const big = (x) => Math.round(x).toLocaleString("en");
  const RUNS = {
    nogrow: () => {
      const { a, b, c } = RESULTS.nogrow;
      const top = Math.max(b.worst, 1);
      return { verdict: T("64 keys in 64 buckets: " + n2(a.avg) + " compares per lookup on average. 1,024 keys in the same 64 buckets: " + n2(b.avg) + " on average, " + n2(b.worst) + " for the unluckiest key (" + n2(b.avg / a.avg) + "× slower). Growing at 75% instead: " + n2(c.avg) + ".",
          "64 claves en 64 cubetas: " + n2(a.avg) + " comparaciones por búsqueda en promedio. 1,024 claves en las mismas 64 cubetas: " + n2(b.avg) + " en promedio y " + n2(b.worst) + " para la clave más desafortunada (" + n2(b.avg / a.avg) + " veces más lento). Creciendo al 75% en su lugar: " + n2(c.avg) + "."),
        bars: [[T("64 keys, load 1", "64 claves, carga 1"), a.avg / top, n2(a.avg)], [T("1,024 keys, load 16", "1,024 claves, carga 16"), b.avg / top, n2(b.avg), true], [T("Worst key, load 16", "Peor clave, carga 16"), b.worst / top, n2(b.worst), true], [T("1,024 keys, doubling", "1,024 claves, duplicando"), c.avg / top, n2(c.avg)]] };
    },
    weak: () => {
      const { g, w } = RESULTS.weak;
      return { verdict: T("Good hash: " + big(g.used) + " of " + big(g.m) + " buckets in use, longest chain " + n0(g.longest) + ", " + n2(g.avg) + " compares per lookup. First 4 characters: " + big(w.used) + " bucket in use, one chain of " + big(w.longest) + " keys, " + n2(w.avg) + " compares per lookup, in a table that still doubled to " + big(w.m) + " buckets.",
          "Buen hash: " + big(g.used) + " de " + big(g.m) + " cubetas en uso, cadena más larga de " + n0(g.longest) + ", " + n2(g.avg) + " comparaciones por búsqueda. Primeros 4 caracteres: " + big(w.used) + " cubeta en uso, una cadena de " + big(w.longest) + " claves, " + n2(w.avg) + " comparaciones por búsqueda, en una tabla que igual se duplicó a " + big(w.m) + " cubetas."),
        bars: [[T("Compares per lookup, good hash", "Comparaciones por búsqueda, buen hash"), g.avg / w.avg, n2(g.avg)], [T("Compares per lookup, weak hash", "Comparaciones por búsqueda, hash débil"), 1, n2(w.avg), true], [T("Buckets in use, good hash", "Cubetas en uso, buen hash"), g.used / g.m, big(g.used)], [T("Buckets in use, weak hash", "Cubetas en uso, hash débil"), w.used / w.m, big(w.used), true]] };
    },
    resize: () => {
      const { d, a } = RESULTS.resize;
      const per = d.moved / 1000, perA = a.moved / 1000;
      return { verdict: T("Doubling: " + d.resizes + " resizes, " + big(d.moved) + " keys moved in all, " + per.toFixed(2) + " moves per insert; the biggest single insert moved " + big(d.biggest) + " keys. Adding 8 buckets: " + big(a.resizes) + " resizes, " + big(a.moved) + " moves, " + perA.toFixed(0) + " per insert.",
          "Duplicando: " + d.resizes + " redimensionamientos, " + big(d.moved) + " claves movidas en total, " + per.toFixed(2) + " movimientos por inserción; la inserción individual más cara movió " + big(d.biggest) + " claves. Sumando 8 cubetas: " + big(a.resizes) + " redimensionamientos, " + big(a.moved) + " movimientos, " + perA.toFixed(0) + " por inserción."),
        bars: [[T("Moves per insert, doubling", "Movimientos por inserción, duplicando"), per / perA, per.toFixed(2), true], [T("Moves per insert, +8 buckets", "Movimientos por inserción, +8 cubetas"), 1, perA.toFixed(0)], [T("Biggest single insert, doubling", "Inserción más cara, duplicando"), d.biggest / 1000, big(d.biggest)]] };
    },
    probe: () => {
      const { c5, p5, c9, p9 } = RESULTS.probe;
      const top = p9.miss;
      return { verdict: T("50% full: finding a key takes " + n2(c5.avg) + " checks with chaining, " + n2(p5.avg) + " with linear probing. 90% full: chaining " + n2(c9.avg) + ", probing " + n2(p9.avg) + "; a missing key costs " + n2(c9.miss) + " vs " + n2(p9.miss) + ", and the longest run of full slots is " + big(p9.longest) + " (longest chain: " + n0(c9.longest) + ").",
          "Al 50%: encontrar una clave cuesta " + n2(c5.avg) + " revisiones con encadenamiento y " + n2(p5.avg) + " con sondeo lineal. Al 90%: encadenamiento " + n2(c9.avg) + ", sondeo " + n2(p9.avg) + "; una clave que no está cuesta " + n2(c9.miss) + " contra " + n2(p9.miss) + ", y el tramo más largo de casillas llenas es de " + big(p9.longest) + " (cadena más larga: " + n0(c9.longest) + ")."),
        bars: [[T("Find a key, chaining, 90%", "Encontrar, encadenamiento, 90%"), c9.avg / top, n2(c9.avg)], [T("Find a key, probing, 90%", "Encontrar, sondeo, 90%"), p9.avg / top, n2(p9.avg), true], [T("Missing key, chaining, 90%", "No está, encadenamiento, 90%"), c9.miss / top, n2(c9.miss)], [T("Missing key, probing, 90%", "No está, sondeo, 90%"), 1, n2(p9.miss), true]] };
    },
    flood: () => {
      const { fx, sd, nm } = RESULTS.flood;
      return { verdict: T("Crafted keys, fixed hash: " + big(fx.work) + " compares and moves to insert 1,000 keys, all in one bucket. Ordinary ids, same hash: " + big(nm.work) + " (" + Math.round(fx.work / nm.work) + "× less). The crafted keys against the seeded hash: " + big(sd.work) + ", longest chain " + n0(sd.longest) + ".",
          "Claves fabricadas, hash fijo: " + big(fx.work) + " comparaciones y movimientos para insertar 1,000 claves, todas en una cubeta. IDs normales, mismo hash: " + big(nm.work) + " (" + Math.round(fx.work / nm.work) + " veces menos). Las claves fabricadas contra el hash con semilla: " + big(sd.work) + ", cadena más larga de " + n0(sd.longest) + "."),
        bars: [[T("Ordinary ids, fixed hash", "IDs normales, hash fijo"), nm.work / fx.work, big(nm.work)], [T("Crafted keys, fixed hash", "Claves fabricadas, hash fijo"), 1, big(fx.work), true], [T("Crafted keys, seeded hash", "Claves fabricadas, hash con semilla"), sd.work / fx.work, big(sd.work)]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    for (const [name, value] of Object.entries(exp.watch)) set(name, value, true);
    cycle = 0; reset();
    if (loop.paused) loop.setPaused(false);
  } });

  loop.setPaused(loop.paused);
  reset();
}

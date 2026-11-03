// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The pigeonhole rack in the browser: inserts keys and looks some up on the same table model the experiments use,
// animating each trace (stamp, shuttle, compares or probes, the card dropping in, the rack doubling), and answers
// the controls. mount() gets the build-time data from page.ts (geometry) and root, the <wb-lesson>.
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, playPause, setText, setLit } from "../../runtime/dom";
import { smoothstep } from "../../lib/tween";
import { rngMixed as rng } from "../../lib/random";
import { makeTable, hashOf, userKeys, attackKeys } from "./sim";

export default function mount({ P, G, COUNTERS }, root) {
  const TRAY_CX = G.CX;
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const ease = smoothstep;
  const dials = Object.fromEntries(Object.keys(COUNTERS).map((n) => [n, WB.counter(svg, n, P)]));
  const gauge = WB.meter(svg, "load", P);
  const stat = (key, value) => root.stat(key, value);

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
    sx = G.HOME_X; WB.place(shuttle, P, [sx, 0, 0]); show(fly, false);
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
    dials.probes.setClamped(0);
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
  function moveShuttle(x) { sx = x; WB.place(shuttle, P, [x, 0, 0]); }
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
      WB.place(head, P, [0, 0, G.HEAD_Z - 3.2 * down]); setLit(head, p > 0.2 && p < 0.8);
      if (p >= 0.5 && !o.stamped) { o.stamped = true; dials.bucket.setClamped(tr.resized ? hashOf(o.key, tb.hash, tb.seed) % tr.resized.from : tr.home); setText(keySub, "→ " + (tr.resized ? hashOf(o.key, tb.hash, tb.seed) % tr.resized.from : tr.home)); }
      if (o.t >= DUR.stamp) { setLit(head, false); o.phase = tr.resized ? "resize" : "travel"; o.t = 0; if (tr.resized) msg = T("load would pass 75% · double to " + tr.resized.to + " buckets, place all " + tr.resized.moved + " keys again", "la carga pasaría del 75% · duplicar a " + tr.resized.to + " cubetas y reubicar las " + tr.resized.moved + " claves"); }
      return;
    }
    if (o.phase === "resize") {
      const p = o.t / DUR.resize, moved = tr.resized.moved;
      if (!o.opened) { o.opened = true; paint([], tr.resized.to); }
      const k = Math.min(moved, Math.floor(Math.max(0, (p - 0.15) / 0.75) * moved + 0.0001));
      if (k !== o.placed) { o.placed = k; paint(o.before.slice(0, k), tr.resized.to); dials.moved.setClamped(tb.moved - moved + k); }
      if (o.t >= DUR.resize) { o.phase = "travel"; o.t = 0; dials.bucket.setClamped(tr.home); setText(keySub, "→ " + tr.home); }
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
        if (n !== probesShown) { for (let s = 0; s < G.PILE; s++) lightCard(tr.home, s, false); if (n > 0) lightCard(tr.home, n - 1, true); probesShown = n; dials.probes.setClamped(n); }
        if (idx > total || (total === 0 && o.t > 0.1)) { o.phase = o.kind === "insert" ? "drop" : "rest"; o.t = 0; msg = describe(); }
      } else {
        const j = Math.min(idx, tr.path.length - 1), slot = tr.path[j];
        const local = o.t - idx * d;
        if (j !== o.step || !o.began) { o.began = true; o.step = j; probesShown = j + 1; dials.probes.setClamped(probesShown); for (let i = 0; i < G.SLOTS; i++) lightCard(i, 0, false); }
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
      WB.place(fly, P, [G.CX[o.slot] - G.CX[0], G.Y[o.slot] - G.Y[0], G.Z[o.slot] - G.Z[0] + Math.min(o.level, G.PILE - 1) * G.CARD_PITCH + 9 * (1 - p)]);
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
    dials.keys.setClamped(s.n); dials.longest.setClamped(s.longest);
    if (!op || op.phase !== "resize") dials.moved.setClamped(s.moved);
    gauge.set(Math.min(1, s.load / G.METER_MAX));
    stat("keys", s.n); stat("buckets", s.m); stat("load", s.load.toFixed(2));
    stat("last", lastProbes === null ? "–" : lastProbes); stat("avg", s.n ? s.avg.toFixed(2) : "–");
    stat("longest", s.longest); stat("moved", s.moved);
  }

  const pause = playPause(root);
  const loop = WB.loop({
    stage,
    step: (dt) => { step(dt * cfg.speed); stats(); say(holding > 0 ? L("full for this figure · starting over", "llena para esta figura · se empieza de nuevo") : msg ? L(msg) : L("starting", "iniciando")); },
    onPause: pause.onPause,
  });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = raw;
    if (!quiet) { cycle = 0; reset(); }
  }
  root.on("change", (name, value) => set(name, value));
  const actions = { reset: () => { cycle = 0; reset(); } };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const [name, value] of Object.entries(w)) set(name, value, true);
    cycle = 0; reset();
    if (loop.paused) loop.setPaused(false);
  });

  loop.setPaused(loop.paused);
  reset();
}

// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The sorting carousel in the browser: streams cards through the ring or the drum into the bins, flies the cards
// that move when the cluster changes, and answers the controls. mount() gets the build-time data from page.ts
// (geometry, the card drawing) and root, the <wb-lesson>. The parts that change with the cluster (pegs, drum face,
// lever, bins) are drawn here with the kit, as the standalone page did.
import * as k from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { T, L as Lg } from "../../runtime/wb";   // L draws lines in this figure, so the language helper is Lg
import { playPause } from "../../runtime/dom";
import { lerp, easeInOutCubic as ease } from "../../lib/tween";
import { rng } from "../../lib/random";
import { KEYS, NODE_IDS, HOT_KEY, HOT_SHARE, keyHash, keyAngle, ringPoints, ownerOnRing, assign, loads, spread, moved } from "./sim";
import { pctTenths } from "../../lib/format";

export default function mount({ P, G, CARD_SVG }, root) {
  const { depthOf, slabOf, cylinder, lineOnTop, planOutline, insetPlan, haloOf, sideSeam, translateAlong } = k;
  const S = (paths, style) => k.solidSvg(paths, style), L = (d, style) => k.lineSvg(d, style);
  const RING = G.RING, DRUM = G.DRUM, BINS = G.BINS, TRAY_H = G.TRAY_H, STACK_SCALE = G.STACK_SCALE, LEVER = G.LEVER, MOUTH = G.MOUTH;
  const rad = (deg) => (deg * Math.PI) / 180;
  const onRing = (deg, r) => [RING.cx + r * Math.sin(rad(deg)), RING.cy - r * Math.cos(rad(deg))];
  const onDrum = (deg, r) => [DRUM.cx + r * Math.sin(rad(deg)), DRUM.cy - r * Math.cos(rad(deg))];
  const stackHeight = (share) => Math.min(48, STACK_SCALE * share);
  const stackTop = (index, share) => [BINS[index].cx, BINS[index].y + BINS[index].d / 2, TRAY_H + stackHeight(share)];

  // Marker pegs for the current ring. Big pegs for 1 and 10 per node; at 100 per node, engraved ticks.
  function pegsSvg(points, litAngle = null) {
    if (!points.length) return "";
    if (points.length > 80) {
      const d = points.map((p) => lineOnTop(onRing(p.angle, RING.groove[1]), onRing(p.angle, RING.scale - 3.2), RING.top, P)).join("");
      let lit = "";
      if (litAngle !== null) lit = L(lineOnTop(onRing(litAngle, RING.groove[1]), onRing(litAngle, RING.scale - 3.2), RING.top, P), { tone: "lit" });
      return L(d, { tone: "mid" }) + lit;
    }
    const sorted = [...points].sort((a, b) => depthOf([...onRing(a.angle, RING.peg), 0], P) - depthOf([...onRing(b.angle, RING.peg), 0], P));
    const r = points.length > 24 ? 1.2 : 1.8;
    return sorted.map((p) => {
      const [x, y] = onRing(p.angle, RING.peg);
      const lit = litAngle !== null && Math.abs(p.angle - litAngle) < 1e-6;
      return S(cylinder(x, y, r, RING.top, 4.5, P, 14), { tone: "hi", lit });
    }).join("");
  }

  // Sector lines and the pointer on the drum's face: n sectors, pointer at sector `slot`.
  function drumFace(n, slot, active) {
    const { cx, cy } = DRUM;
    const lines = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * 360;
      return lineOnTop(onDrum(a, 4.5), onDrum(a, DRUM.r - 2), DRUM.top, P);
    }).join("");
    const mid = ((slot + 0.5) / n) * 360;
    const needle = lineOnTop(onDrum(mid + 180, 2.5), onDrum(mid, DRUM.r - 4.5), DRUM.top + 0.2, P);
    return L(lines, { tone: "mid" }) + L(k.ring(cx, cy, 4.5, DRUM.top, P, 24), { tone: "mid" })
      + `<path class="iso-line" data-tone="${active ? "lit" : "hi"}" data-free="start" d="${needle}" style="stroke-width:1.1"/>`;
  }

  function leverSvg(mode) {
    const x = mode === "modulo" ? LEVER.modulo : LEVER.ring, y = LEVER.y + 4;
    return S(cylinder(x, y, 1.2, 3, 11, P, 12), { tone: "mid", crease: "none" })
      + S(cylinder(x, y, 3.2, 14, 4, P, 24, 0.4), { tone: "hi", crease: "lo" });
  }

  // One bin: a tray with a stack of cards whose height is the node's share. state: "up" | "down" | "absent".
  function binSvg(index, share, state, lit = false) {
    const b = BINS[index];
    if (state === "absent") return "";
    const tray = { x: b.cx - b.w / 2, y: b.y, w: b.w, d: b.d, r: 2 };
    let out = `<path class="iso-halo" d="${haloOf(insetPlan(tray, 2), 0, 0.1, P)}" style="filter:blur(4px)"/>`;
    out += S(slabOf(tray, 0, TRAY_H, P, 3, 0.5), { tone: "mid" });
    out += L(planOutline(insetPlan(tray, 2.5), TRAY_H, P, 3), { tone: "lo" });
    if (state === "down") {
      out += S(slabOf(insetPlan(tray, 1), TRAY_H, 2.5, P, 3, 0.4), { tone: "lo" });
      out += L(lineOnTop([tray.x + 5, tray.y + 5], [tray.x + tray.w - 5, tray.y + tray.d - 5], TRAY_H + 2.5, P) + lineOnTop([tray.x + tray.w - 5, tray.y + 5], [tray.x + 5, tray.y + tray.d - 5], TRAY_H + 2.5, P), { tone: "mid" });
      return out;
    }
    const h = stackHeight(share);
    if (h > 0.2) {
      const stack = { x: b.cx - 12, y: b.y + 3, w: 24, d: 18, r: 1 };
      const seams = [];
      for (let z = TRAY_H + 6; z < TRAY_H + h - 1; z += 6) seams.push(sideSeam(stack, z, P, 2));
      out += S(slabOf(stack, TRAY_H, h, P, 2, 0.4), { tone: "hi", crease: "lo", lit, inner: seams.length ? L(seams.join(""), { tone: "faint" }) : "" });
    }
    return out;
  }

  const SALT = 25;
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const stat = (key, value) => root.stat(key, value);
  const pegsEl = q("[data-pegs]"), trackEl = q("[data-track]"), drumEl = q("[data-drum]"), leverEl = q("[data-lever]"), binsEl = q("[data-bins]"), flyEl = q("[data-fly]");
  const DEFAULTS = { mode: "ring", count: 4, vnodes: 1, failed: false, hot: false };
  const cfg = { ...DEFAULTS, speed: 1 };
  let random = rng(20261019);
  let owners, share, points, shown = {}, needle = 0, sorted = 0, lastMove = null, litBin = -1;
  let steps = [], current = null;

  const arc = (a, b, t, lift) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t) + Math.sin(Math.PI * t) * lift];
  const tell = (v) => say(Lg(v));
  const activeNodes = () => NODE_IDS.slice(0, cfg.count).filter((n) => !(cfg.failed && n === "C"));
  const binIndex = (node) => NODE_IDS.indexOf(node);
  const binState = (i) => i >= cfg.count ? "absent" : cfg.failed && NODE_IDS[i] === "C" ? "down" : "up";

  function recompute() {
    const nodes = activeNodes();
    owners = assign({ mode: cfg.mode, nodes, vnodes: cfg.vnodes, salt: SALT });
    share = loads(owners, nodes, cfg.hot);
    points = ringPoints(nodes, cfg.vnodes, SALT);
  }
  const shareOf = (map, id) => map[id] || 0;

  function drawPegs(lit = null) { pegsEl.innerHTML = cfg.mode === "ring" ? pegsSvg(points, lit) : ""; }
  function drawDrum(active = false) { drumEl.innerHTML = drumFace(activeNodes().length, needle, active); }
  function drawLever() { leverEl.innerHTML = leverSvg(cfg.mode); }
  function drawBins() {
    const order = BINS.map((b, i) => i).sort((a, b) => depthOf([BINS[a].cx, BINS[a].y, 0], P) - depthOf([BINS[b].cx, BINS[b].y, 0], P));
    binsEl.innerHTML = order.map((i) => binSvg(i, shareOf(shown, NODE_IDS[i]), binState(i), i === litBin)).join("");
  }
  const cardAt = (p) => '<g transform="' + translateAlong(P, p) + '">' + CARD_SVG + "</g>";
  function drawFly(list) { flyEl.innerHTML = list.map(cardAt).join(""); }
  function drawTrack(list) { trackEl.innerHTML = list.map(cardAt).join(""); }

  function showStats() {
    const nodes = activeNodes(), s = spread(Object.fromEntries(nodes.map((n) => [n, share[n]])));
    const busiest = nodes.reduce((a, b) => (share[b] > share[a] ? b : a)), quietest = nodes.reduce((a, b) => (share[b] < share[a] ? b : a));
    stat("nodes", Lg(nodes.length + (cfg.failed && cfg.count >= 3 ? " (C down)" : ""), nodes.length + (cfg.failed && cfg.count >= 3 ? " (C caído)" : "")));
    stat("moved", lastMove ? lastMove.count + " · " + pctTenths(lastMove.share) : "–");
    stat("ratio", s.ratio.toFixed(2) + "×");
    stat("busiest", busiest + " · " + pctTenths(share[busiest]));
    stat("quietest", quietest + " · " + pctTenths(share[quietest]));
    stat("sorted", sorted);
  }

  function nextKey() { return cfg.hot && random() < HOT_SHARE ? HOT_KEY : Math.floor(random() * KEYS); }

  function streamCard() {
    const key = nextKey(), node = owners[key], bin = binIndex(node), name = "key " + key + (cfg.hot && key === HOT_KEY ? " (hot)" : ""), nameEs = "clave " + key + (cfg.hot && key === HOT_KEY ? " (caliente)" : "");
    const rise = [MOUTH[0], MOUTH[1], MOUTH[2] + 4];
    steps.push({ dur: 0.3, run: (t) => drawFly([[MOUTH[0], MOUTH[1], MOUTH[2] - 6 + 10 * ease(t)]]) });
    if (cfg.mode === "ring") {
      const angle = keyAngle(key), peg = ownerOnRing(points, angle), dist = (peg.angle - angle + 360) % 360;
      const land = [...onRing(angle, RING.track), RING.top];
      tell(T(name + " · lands at " + angle.toFixed(0) + "°", nameEs + " · cae en " + angle.toFixed(0) + "°"));
      steps.push({ dur: 0.6, run: (t) => drawFly([arc(rise, land, ease(t), 14)]), done: () => drawFly([]) });
      steps.push({ dur: 0.35 + 1.5 * dist / 360, run: (t) => drawTrack([[...onRing(angle + dist * ease(t), RING.track), RING.top]]) });
      steps.push({ dur: 0.2, begin: () => { drawPegs(peg.angle); tell(T(name + " · " + angle.toFixed(0) + "° → marker at " + peg.angle.toFixed(0) + "° → " + node, nameEs + " · " + angle.toFixed(0) + "° → marcador en " + peg.angle.toFixed(0) + "° → " + node)); } });
      const from = [...onRing(peg.angle, RING.track), RING.top];
      steps.push({ dur: 0.75, begin: () => drawTrack([]), run: (t) => drawFly([arc(from, stackTop(bin, shareOf(shown, node)), ease(t), 26)]), done: () => land2(bin) });
    } else {
      const n = activeNodes().length, slot = keyHash(key) % n, top = [DRUM.cx, DRUM.cy, DRUM.top + 0.5];
      tell(T(name + " · hash mod " + n + " = " + slot + " → " + node, nameEs + " · hash mod " + n + " = " + slot + " → " + node));
      steps.push({ dur: 0.6, run: (t) => drawFly([arc(rise, top, ease(t), 12)]) });
      const from = needle;
      let to = slot; if (to < from) to += n;
      steps.push({ dur: 0.45, run: (t) => { needle = (from + (to - from) * ease(t)) % n; drawDrum(true); }, done: () => { needle = slot; drawDrum(false); } });
      steps.push({ dur: 0.75, run: (t) => drawFly([arc(top, stackTop(bin, shareOf(shown, node)), ease(t), 24)]), done: () => land2(bin) });
    }
    function land2(b) { drawFly([]); drawPegs(null); sorted++; litBin = b; drawBins(); showStats(); }
    steps.push({ dur: 0.3, done: () => { litBin = -1; drawBins(); } });
  }

  // Change the cluster: recompute the model, then fly only the cards whose owner changed.
  function reconfigure(label, change) {
    const beforeOwners = owners, beforeShare = { ...share };
    change();
    recompute();
    const mv = moved(beforeOwners, owners);
    lastMove = mv;
    const sources = Object.entries(mv.from).sort((a, b) => b[1] - a[1]).map(([n]) => n);
    const fromText = mv.count === 0 ? "" : sources.length === 1 ? " · all from " + sources[0] : " · from " + sources.length + " nodes";
    const fromEs = mv.count === 0 ? "" : sources.length === 1 ? " · todas de " + sources[0] : " · de " + sources.length + " nodos";
    steps = []; current = null; drawFly([]); drawTrack([]); drawPegs(null); drawLever(); drawDrum(false); litBin = -1;
    const sample = [];
    for (let key = 0; key < KEYS; key += 25) if (beforeOwners[key] !== owners[key]) sample.push(key);
    const target = { ...share };
    const total = 1.1 + 0.035 * sample.length;
    tell(T(label.en + " · " + mv.count + " of 1,000 keys moved (" + pctTenths(mv.share) + ")" + fromText, label.es + " · " + mv.count + " de 1,000 claves se movieron (" + pctTenths(mv.share) + ")" + fromEs));
    steps.push({ dur: total, run: (t) => {
      const time = t * total;
      for (const id of NODE_IDS) shown[id] = lerp(shareOf(beforeShare, id), shareOf(target, id), ease(Math.min(1, time / total)));
      drawBins();
      const flying = [];
      sample.forEach((key, i) => {
        const u = (time - 0.035 * i) / 1.0;
        if (u <= 0 || u >= 1) return;
        const a = binIndex(beforeOwners[key]), b = binIndex(owners[key]);
        flying.push(arc(stackTop(a, shown[beforeOwners[key]] || 0), stackTop(b, shown[owners[key]] || 0), ease(u), 30));
      });
      drawFly(flying);
    }, done: () => { shown = { ...target }; drawFly([]); drawBins(); showStats(); } });
    steps.push({ dur: 1.2 });
    showStats();
  }

  function advance(dt) {
    let left = dt, guard = 0;
    while (left > 1e-9 && guard++ < 50) {
      if (!current) {
        current = steps.shift();
        if (!current) { streamCard(); continue; }
        current.elapsed = 0; current.begin && current.begin();
      }
      const use = Math.min(current.dur - current.elapsed, left);
      current.elapsed += use; left -= use;
      current.run && current.run(Math.min(1, current.dur ? current.elapsed / current.dur : 1));
      if (current.elapsed >= current.dur - 1e-9) { const c = current; current = null; c.done && c.done(); }
    }
  }

  // ---------- controls ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => advance(dt * cfg.speed), onPause: pause.onPause });
  pause.bind(loop);
  const LABELS = {
    mode: (v) => v === "ring" ? T("switched to the hash ring", "cambio al anillo de hash") : T("switched to hash mod n", "cambio a hash mod n"),
    count: (v, before) => v > before
      ? (v - before === 1 ? T(NODE_IDS[v - 1] + " added", NODE_IDS[v - 1] + " agregado") : T("nodes " + before + " → " + v, "nodos " + before + " → " + v))
      : (before - v === 1 ? T(NODE_IDS[before - 1] + " removed", NODE_IDS[before - 1] + " quitado") : T("nodes " + before + " → " + v, "nodos " + before + " → " + v)),
    vnodes: (v) => T(v + (v === 1 ? " marker" : " markers") + " per node", v + (v === 1 ? " marcador" : " marcadores") + " por nodo"),
    failed: (v) => v ? T("C failed", "C cayó") : T("C is back", "C volvió"),
    hot: (v) => v ? T("key 7 is hot", "la clave 7 está caliente") : T("no hot key", "sin clave caliente"),
  };
  function apply(changes) {
    const parsed = {};
    for (const [name, raw] of Object.entries(changes)) {
      parsed[name] = name === "count" || name === "vnodes" ? Number(raw) : name === "failed" || name === "hot" ? raw === true || raw === "true" : raw;
    }
    const real = Object.entries(parsed).filter(([name, v]) => cfg[name] !== v);
    for (const [name, v] of Object.entries(parsed)) root.press(name, v);
    if (!real.length) return;
    const parts = real.map(([name, v]) => LABELS[name](v, cfg[name]));
    const label = T(parts.map((x) => x.en).join(" · "), parts.map((x) => x.es).join(" · "));
    reconfigure(label, () => { for (const [name, v] of real) cfg[name] = v; });
    if (loop.paused) loop.setPaused(false);
  }
  root.on("change", (name, value) => {
    if (name === "speed") { cfg.speed = Number(value); root.press("speed", cfg.speed); return; }
    apply({ [name]: value });
  });
  function startOver(config = DEFAULTS) {
    Object.assign(cfg, config);
    for (const name of Object.keys(DEFAULTS)) root.press(name, cfg[name]);
    random = rng(20261019); sorted = 0; lastMove = null; needle = 0;
    recompute(); shown = { ...share }; steps = []; current = null;
    drawPegs(); drawDrum(); drawLever(); drawBins(); drawFly([]); drawTrack([]); showStats();
    tell(cfg.mode === "ring" ? T("hash ring · " + activeNodes().length + " nodes", "anillo de hash · " + activeNodes().length + " nodos") : "hash mod " + activeNodes().length);
  }
  const actions = { reset: () => startOver() };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    const { then, ...first } = w;
    startOver({ ...DEFAULTS, ...first });
    if (loop.paused) loop.setPaused(false);
    if (then) setTimeout(() => apply(then), 3500);
  });

  startOver();
  loop.setPaused(loop.paused);
}

// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The reading window in the browser: runs the list model frame by frame (six times slower than real time at ×1),
// slides the tiles under the window, lights the blank parts of the viewport, moves the scrollbar thumb and the range
// stops, and answers the controls. mount() gets the build-time data from page.ts (projection, geometry, tile drawings)
// and root, the <wb-lesson>.
import { translateAlong, iso, pathOf, slabOf, solidSvg } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, setD, playPause } from "../../runtime/dom";
import { int, oneUnder10 } from "../../lib/format";
import { makeList, VIEW, FRAME } from "./sim";

const SLOW = 1 / 6;   // model ms per real ms at ×1

export default function mount({ P, G, TILES }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (v) => root.figure.say(L(v));
  const NS = "http://www.w3.org/2000/svg";
  const tilesLayer = q('[data-layer="tiles"]'), blankLayer = q('[data-layer="blank"]');
  const blankPath = document.createElementNS(NS, "path");
  blankPath.setAttribute("class", "vz-blank");
  blankLayer.appendChild(blankPath);
  const rangePath = q("[data-range]"), stops = [q('[data-stop="0"]'), q('[data-stop="1"]')];
  const lampOn = q('[data-lamp="on"]'), lampOff = q('[data-lamp="off"]');
  const thumb = q("[data-thumb]"), foundText = q("[data-found]");
  foundText.setAttribute("font-size", "2.2");
  const counters = { dom: WB.counter(svg, "dom", P), first: WB.counter(svg, "first", P), blank: WB.counter(svg, "blank", P), jumps: WB.counter(svg, "jumps", P) };
  const mainMeter = WB.meter(svg, "main", P);
  const { PX, BELT, TILE, WIN, RAIL } = G;
  const Z = BELT.h;
  const ms = (x) => oneUnder10(x) + " ms";

  // ---------- tiles: pooled, one element per row on the belt ----------
  const pools = TILES.map(() => []), ghostPool = [];
  const shown = new Map();   // row -> { el, kind, ghost }
  function makeTile(kind) {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = TILES[kind];
    return { g, kind, body: g.querySelector("[data-body]"), num: g.querySelector("[data-num]"), hit: g.querySelector("[data-hit]"), row: -1, lit: null, isHit: null };
  }
  function makeGhost() {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("class", "vz-ghost");
    return { g: p, ghost: true, len: -1 };
  }
  function release(row) {
    const r = shown.get(row);
    r.el.g.remove();
    (r.el.ghost ? ghostPool : pools[r.el.kind]).push(r.el);
    shown.delete(row);
  }
  const litUntil = new Map();   // row -> performance.now() until which it stays lit

  // ---------- settings and the run ----------
  const cfg = { mode: "window", n: 10000, overscan: 3, heights: "fixed", estimate: 48, anchor: "off", gesture: "read", speed: 1 };
  let model, clock, seed = 7, lastSay = -1e9, wasBlank = false, wasLoading = true, thumbLen = -1, lastTag = "", mainShown = 0;
  let moveFrames = 0, moveMain = 0;

  function restart() {
    for (const row of [...shown.keys()]) release(row);
    litUntil.clear();
    model = makeList({ mode: cfg.mode, n: Number(cfg.n), overscan: Number(cfg.overscan), heights: cfg.heights, estimate: Number(cfg.estimate), anchor: cfg.anchor === "on", gesture: cfg.gesture }, seed);
    seed = (Date.now() % 1e6) + 1;
    clock = 0; lastSay = -1e9; wasBlank = false; wasLoading = true; lastTag = ""; moveFrames = 0; moveMain = 0; mainShown = 0;
    root.controls.showFor(cfg.heights);
    paint();
    showStats();
  }

  // ---------- narration ----------
  function narrate(now) {
    const f = model.frame;
    if (f.loading) {
      if (now - lastSay > 600) { say(T("first render · building " + int(model.rowsInDom) + " rows · nothing on screen until it ends", "primer render · construyendo " + int(model.rowsInDom) + " filas · nada en pantalla hasta que termine")); lastSay = now; }
      return;
    }
    if (wasLoading) {
      wasLoading = false;
      say(T("first paint after " + ms(model.firstMs) + " · " + int(model.rowsInDom) + " rows in the DOM", "primer pintado a los " + ms(model.firstMs) + " · " + int(model.rowsInDom) + " filas en el DOM"));
      lastSay = now + 1500;
      return;
    }
    if (f.above.length && cfg.heights === "variable") {
      const i = f.above[0], h = model.height(i), k = f.above.length;
      const en = k === 1 ? "row " + int(i + 1) + " above the screen measured " + h + " px, not " + cfg.estimate : k + " rows above the screen measured, not " + cfg.estimate + " px each";
      const es = k === 1 ? "la fila " + int(i + 1) + ", arriba de la pantalla, midió " + h + " px, no " + cfg.estimate : k + " filas arriba de la pantalla se midieron, no de " + cfg.estimate + " px cada una";
      if (f.jump) say(T(en + " · the rows on screen jumped " + Math.round(f.jump) + " px", es + " · las filas en pantalla saltaron " + Math.round(f.jump) + " px"));
      else if (cfg.anchor === "on" && f.above.some((r) => model.height(r) !== Number(cfg.estimate))) say(T(en + " · the scroll position moved with them, nothing jumped", es + " · la posición de scroll se movió con ellas, nada saltó"));
      else return;
      lastSay = now + 900;
      return;
    }
    const tag = model.dirTag;
    if (tag === "land" && lastTag !== "land") {
      say(T("scrollbar dragged to row " + int(model.rowAt(model.s) + 1), "barra de scroll arrastrada hasta la fila " + int(model.rowAt(model.s) + 1)));
      lastTag = tag; lastSay = now + 900;
      return;
    }
    lastTag = tag;
    const blank = f.blank.length > 0;
    if (blank && !wasBlank && now > lastSay) {
      say(T("blank · the scroll moved past the rendered rows before the next pass", "en blanco · el scroll pasó las filas renderizadas antes de la siguiente pasada"));
      lastSay = now + 1200;
    } else if (now - lastSay > 2200) {
      const top = model.rowAt(model.s) + 1;
      say(f.fling
        ? T("fling · row " + int(top) + " at the top · " + int(model.rowsInDom) + " rows in the DOM", "deslizamiento · fila " + int(top) + " arriba · " + int(model.rowsInDom) + " filas en el DOM")
        : T("row " + int(top) + " at the top · " + int(model.rowsInDom) + " rows in the DOM", "fila " + int(top) + " arriba · " + int(model.rowsInDom) + " filas en el DOM"));
      lastSay = now;
    }
    wasBlank = blank;
  }

  // ---------- painting ----------
  // Each model frame is shown as it is, for its whole length (a tenth of a second at ×1): the scroll position, the rows
  // the DOM holds and the blank between them belong to the same frame.
  function paint() {
    const now = performance.now();
    const f = model.frame;
    const sd = model.s;
    const xOf = (px) => WIN.x0 + (px - sd) / PX;
    const pxFrom = sd - (WIN.x0 - BELT.x0) * PX, pxTo = sd + (BELT.x1 - WIN.x0) * PX;
    const seen = new Set();
    const order = [];
    if (!f.loading) {
      const a = model.rowAt(Math.max(0, pxFrom)), b = model.rowAt(pxTo);
      for (let i = a; i <= b; i++) {
        if (!model.inDom(i)) continue;
        const top = model.offset(i), h = model.height(i);
        if (top + h < pxFrom || top > pxTo) continue;
        const ghost = !model.laid(i);
        const kind = cfg.heights === "variable" ? model.kind[i] : 0;
        let r = shown.get(i);
        if (r && (r.el.ghost !== ghost || (!ghost && r.el.kind !== kind))) { release(i); r = null; }
        if (!r) {
          const el = ghost ? ghostPool.pop() || makeGhost() : pools[kind].pop() || makeTile(kind);
          r = { el };
          shown.set(i, r);
          tilesLayer.appendChild(el.g);
        }
        const x = xOf(top);
        if (ghost) {
          const len = h / PX;
          setD(r.el.g, pathOf([[x + 0.3, TILE.y0], [x + len - 0.3, TILE.y0], [x + len - 0.3, TILE.y1], [x + 0.3, TILE.y1]].map(([px, py]) => iso([px, py, Z + 0.1], P)), true));
        } else {
          const el = r.el;
          el.g.setAttribute("transform", translateAlong(P, [x, 0, Z]));
          if (el.row !== i) { el.row = i; setText(el.num, String(i + 1)); }
          const hit = model.isMatch(i);
          if (el.isHit !== hit) { el.isHit = hit; show(el.hit, hit); }
          const lit = (litUntil.get(i) || 0) > now;
          if (el.lit !== lit) { el.lit = lit; el.body.toggleAttribute("data-lit", lit); el.body.toggleAttribute("data-lit-fill", lit); el.num.setAttribute("data-tone", lit ? "on-lit" : "hi"); }
        }
        seen.add(i); order.push(r.el.g);
      }
    }
    for (const row of [...shown.keys()]) if (!seen.has(row)) release(row);
    // keep the layer in list order (painter's order along the belt)
    const kids = tilesLayer.children;
    if (order.some((g, n) => kids[n] !== g)) order.forEach((g) => tilesLayer.appendChild(g));

    // blank parts of the viewport: no row under them
    const blanks = [];
    if (f.loading) blanks.push([0, VIEW]);
    else if (cfg.mode !== "full") {
      const [r0, r1] = model.range, top = model.offset(r0), end = model.offset(r1 + 1);
      if (top > sd) blanks.push([0, Math.min(VIEW, top - sd)]);
      if (end < sd + VIEW) blanks.push([Math.max(0, end - sd), VIEW]);
    }
    setD(blankPath, blanks.filter(([a, b]) => b - a > 0.5).map(([a, b]) => pathOf([[a, TILE.y0], [b, TILE.y0], [b, TILE.y1], [a, TILE.y1]].map(([px, py]) => iso([WIN.x0 + px / PX, py, Z + 0.05], P)), true)).join(""));
    const blankNow = blanks.some(([a, b]) => b - a > 0.5);
    show(lampOn, blankNow); show(lampOff, !blankNow);

    // the range stops: where the rows in the DOM (or laid out) begin and end
    const inRange = (x) => x > BELT.x0 + 0.8 && x < BELT.x1 - 0.8;
    if (cfg.mode === "full" || f.loading) { stops.forEach((s) => show(s, false)); setD(rangePath, ""); }
    else {
      const [r0, r1] = model.range, xa = xOf(model.offset(r0)), xb = xOf(model.offset(r1 + 1));
      [xa, xb].forEach((x, k) => { show(stops[k], inRange(x)); if (inRange(x)) stops[k].setAttribute("transform", translateAlong(P, [x, 0, 0])); });
      const a = Math.max(BELT.x0 + 0.8, xa), b = Math.min(BELT.x1 - 0.8, xb);
      const ym = (G.STOP_Y[0] + G.STOP_Y[1]) / 2;
      setD(rangePath, b > a ? pathOf([iso([a, ym, Z + 0.1], P), iso([b, ym, Z + 0.1], P)]) : "");
    }

    // the scrollbar thumb
    const railLen = RAIL.x1 - RAIL.x0, len = Math.max(4, Math.min(railLen, (VIEW / Math.max(VIEW, model.total)) * railLen));
    if (Math.abs(len - thumbLen) > 0.2) { thumbLen = len; thumb.innerHTML = solidSvg(slabOf({ x: 0, y: RAIL.y - 2, w: len, d: 4, r: 0.6 }, RAIL.z + 3.6, 2, P, 2, 0.2), { tone: "hi", crease: "lo" }); }
    const tx = RAIL.x0 + (model.maxS > 0 ? Math.min(1, Math.max(0, sd / model.maxS)) : 0) * (railLen - thumbLen);
    thumb.setAttribute("transform", translateAlong(P, [tx, 0, 0]));

    // counters and the main-thread meter
    counters.dom.setClamped(f.loading ? 0 : model.rowsInDom);
    counters.first.setClamped(f.loading ? model.t : Math.round(model.firstMs));
    counters.blank.setClamped(model.st.blankFrames);
    counters.jumps.setClamped(model.st.jumps);
    mainShown += ((f.mainMs / FRAME) - mainShown) * 0.35;
    mainMeter.set(mainShown);
    setText(foundText, f.loading ? "–" : model.foundNow() + "/" + model.matches.length);
    narrate(now);
  }

  function showStats() {
    const f = model.frame, st = model.st;
    root.stat("dom", f.loading ? "–" : int(model.rowsInDom));
    root.stat("first", f.loading ? "…" : ms(model.firstMs));
    root.stat("blank", int(st.blankFrames));
    root.stat("jumps", int(st.jumps));
    root.stat("main", cfg.mode === "full" ? "0 ms" : moveFrames ? ms(moveMain / moveFrames) : "–");
    root.stat("found", f.loading ? "–" : L(T(model.foundNow() + " of " + model.matches.length, model.foundNow() + " de " + model.matches.length)));
  }

  // ---------- the loop ----------
  let statTimer = 0;
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    clock += dt * 1000 * SLOW * cfg.speed;
    while (model.t <= clock) {
      model.step();
      const f = model.frame;
      if (f.moving && !f.loading) { moveFrames++; moveMain += f.mainMs; }
      if (f.above.length) for (const i of f.above) litUntil.set(i, performance.now() + 700);
    }
    paint();
    statTimer += dt; if (statTimer > 0.25) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = String(raw);
    if (!quiet) { restart(); say(T("settings applied · run restarted", "ajustes aplicados · ejecución reiniciada")); lastSay = performance.now(); }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    fling: () => { if (model.ready) { model.fling(); say(T("fling", "deslizamiento rápido")); lastSay = performance.now(); } wake(); },
    middle: () => { if (model.ready) model.jumpTo(0.5); wake(); },
    find: () => {
      if (!model.ready) return;
      const r = model.find(), total = model.matches.length;
      if (r.row >= 0) litUntil.set(r.row, performance.now() + 2500);
      say(cfg.mode === "window"
        ? T("Ctrl+F: " + r.found + " of " + total + " matching rows are in the DOM" + (r.found ? "" : " · the browser finds nothing"), "Ctrl+F: " + r.found + " de " + total + " filas con la palabra están en el DOM" + (r.found ? "" : " · el navegador no encuentra nada"))
        : T("Ctrl+F: " + r.found + " of " + total + " found · scrolled to row " + int(r.row + 1), "Ctrl+F: " + r.found + " de " + total + " encontradas · scroll hasta la fila " + int(r.row + 1)));
      lastSay = performance.now() + 1500;
      wake();
    },
    reset: () => { restart(); say(T("started over", "empezó de nuevo")); lastSay = performance.now(); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const key of ["mode", "n", "overscan", "heights", "estimate", "anchor", "gesture"]) if (w[key] !== undefined) set(key, w[key], true);
    set("speed", w.speed ?? 1, true);
    restart();
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

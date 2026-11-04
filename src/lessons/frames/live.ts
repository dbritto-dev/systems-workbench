// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The frame conveyor in the browser: runs the page model in slow motion, lays the main thread's work onto the belt as
// blocks, presses a rib at every vsync and stands a card where a new picture reached the screen, tracks each click from
// its pennant to its paint, and answers the controls. mount() gets the build-time data from page.ts (projection,
// geometry) and root, the <wb-lesson>.
import { solidSvg, slabOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { playPause, show } from "../../runtime/dom";
import { makePage, inpOf, latencyOf, STAGES } from "./sim";

export default function mount({ P, G, RIB, CARD_SVG, CARD_LIT, PENNANT, PENNANT_LIT }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (v) => root.figure.say(L(v));
  const stat = (key, value) => root.stat(key, value);
  const NS = "http://www.w3.org/2000/svg";
  const layers = { ribs: q('[data-layer="ribs"]'), cards: q('[data-layer="cards"]'), blocks: q('[data-layer="blocks"]'), lane: q('[data-layer="lane"]') };
  const ball = q("[data-ball]");
  const counters = { frames: WB.counter(svg, "frames", P), missed: WB.counter(svg, "missed", P) };
  const vsync = WB.dial(svg, "vsync", P), clickMeter = WB.meter(svg, "click", P);

  const SLOW = 40;                         // ms of page time per second on screen at ×1
  const SPAN = (G.NOW_X - G.BX0) / G.MS;   // ms of history the belt holds
  const CLICKS = 3;                        // the user at the button clicks about this often per second of page time
  const xOf = (tm) => G.NOW_X - (clock - tm) * G.MS;
  const S = (paths, style) => { const out = solidSvg(paths, style); return style.lit ? out.replace(/data-lit=""/g, 'data-lit="" data-lit-fill=""') : out; };
  function blockSvg(kind, len, lit) {
    return S(slabOf({ x: 0, y: G.BLOCK.y0, w: Math.max(0.4, len), d: G.BLOCK.y1 - G.BLOCK.y0, r: 0.25 }, G.BELT.z, G.HEIGHTS[kind], P, 2, 0.15), { tone: kind === "task" ? "mid" : "hi", crease: "lo", lit })
      ;
  }
  function spanSvg(len, lit) {
    return S(slabOf({ x: 0, y: G.LANE.y0 + 2.6, w: Math.max(0.4, len), d: 3.4, r: 0.4 }, G.LANE.z, 0.8, P, 2), { tone: "hi", crease: "none", lit })
      ;
  }
  const el = (layer, html) => { const g = document.createElementNS(NS, "g"); g.innerHTML = html; layers[layer].appendChild(g); return g; };

  // ---------- settings and the run ----------
  const cfg = { hz: "60", driver: "raf", prop: "transform", work: "long", speed: 1 };
  let model, clock, seed = 7, items, seen, tally, tracked, sayAt;

  function restart() {
    for (const layer of Object.values(layers)) layer.replaceChildren();
    model = makePage({ hz: Number(cfg.hz), driver: cfg.driver, prop: cfg.prop, work: cfg.work, clicks: CLICKS, script: [352] }, seed);
    seed = (Date.now() % 1e6) + 1;
    clock = 420;                            // start a little into the first busy task, with a click waiting on it
    model.runTo(clock);
    items = { blocks: new Map(), ticks: new Map(), clicks: new Map() };
    seen = -1; tally = { frames: 0, missed: 0 }; tracked = null; sayAt = -1;
    WB.pose(svg, "hz", cfg.hz);
    paint(true);
  }

  // ---------- painting ----------
  function paint(force) {
    const tmin = clock - SPAN;
    const P_ = model.P;
    // the click being followed: the newest one so far
    const clicks = model.clicks;
    let newest = null;
    for (let i = clicks.length - 1; i >= 0; i--) if (clicks[i].t <= clock) { newest = clicks[i]; break; }
    tracked = newest;
    const trackedFrame = (f) => tracked && f && f.ias.includes(tracked.id);

    // blocks of main-thread work, clipped to the belt
    const keep = new Set();
    for (const b of model.blocks) {
      if (b.start > clock || b.end < tmin) continue;
      keep.add(b);
      const s = Math.max(b.start, tmin), e = Math.min(b.end, clock);
      const done = b.end <= clock;
      const len = Math.max(0.4, (e - s) * G.MS - (done ? 0.3 : 0));
      const lit = !!tracked && b.ia === tracked.id;
      let it = items.blocks.get(b);
      if (!it) { it = { g: el("blocks", ""), len: -1, lit: null }; items.blocks.set(b, it); }
      if (Math.abs(it.len - len) > 0.05 || it.lit !== lit) { it.g.innerHTML = blockSvg(b.kind, len, lit); it.len = len; it.lit = lit; }
      WB.place(it.g, P, [xOf(s), 0, 0]);
    }
    for (const [b, it] of items.blocks) if (!keep.has(b)) { it.g.remove(); items.blocks.delete(b); }

    // vsync ribs, and a card where a new picture reached the screen
    keep.clear();
    for (const k of model.ticks) {
      if (k.t > clock || k.t < tmin) continue;
      keep.add(k);
      const f = k.frame >= 0 ? model.frames[k.frame] : null;
      const card = k.fresh || (f && f.ias.length > 0);
      const lit = !!card && trackedFrame(f);
      let it = items.ticks.get(k);
      if (!it) { it = { rib: el("ribs", RIB), card: null, lit: null }; items.ticks.set(k, it); }
      if (card && (!it.card || it.lit !== lit)) { if (it.card) it.card.remove(); it.card = el("cards", lit ? CARD_LIT : CARD_SVG); it.lit = lit; }
      const x = xOf(k.t);
      WB.place(it.rib, P, [x, 0, 0]);
      if (it.card) WB.place(it.card, P, [x, 0, 0]);
    }
    for (const [k, it] of items.ticks) if (!keep.has(k)) { it.rib.remove(); it.card?.remove(); items.ticks.delete(k); }

    // clicks: a pennant where it happened, a bar to the paint that answered it
    keep.clear();
    for (const c of clicks) {
      const end = c.present ?? clock;
      if (c.t > clock || end < tmin) continue;
      keep.add(c);
      const lit = c === tracked;
      const s = Math.max(c.t, tmin), len = Math.max(0.4, (Math.min(end, clock) - s) * G.MS);
      let it = items.clicks.get(c);
      if (!it) { it = { span: el("lane", ""), flag: el("lane", ""), len: -1, lit: null }; items.clicks.set(c, it); }
      if (Math.abs(it.len - len) > 0.05 || it.lit !== lit) { it.span.innerHTML = spanSvg(len, lit); it.len = len; }
      if (it.lit !== lit) { it.flag.innerHTML = lit ? PENNANT_LIT : PENNANT; it.lit = lit; }
      WB.place(it.span, P, [xOf(s), 0, 0]);
      WB.place(it.flag, P, [xOf(c.t), 0, 0]);
      show(it.flag, c.t >= tmin);
    }
    for (const [c, it] of items.clicks) if (!keep.has(c)) { it.span.remove(); it.flag.remove(); items.clicks.delete(c); }

    // counters: every tick since the run started
    const anim = cfg.driver !== "none";
    for (const k of model.ticks) {
      if (k.t <= seen || k.t > clock) continue;
      seen = k.t;
      if (k.fresh) tally.frames++; else if (anim && k.t >= 100) tally.missed++;
    }
    counters.frames.set(tally.frames); counters.missed.set(tally.missed);

    // the bench lamps: the stage under way
    const now = model.activity(clock);
    const lampOn = now ? STAGES.indexOf(now.kind) : -1;
    for (let i = 0; i < STAGES.length; i++) WB.pose(svg, "lamp-" + i, i === lampOn ? "on" : "off");
    // the compositor lights as it puts a frame on the screen
    const lastTick = Math.floor(clock / P_) * P_;
    const lastK = model.ticks.length ? model.ticks[model.ticks.length - 1] : null;
    WB.pose(svg, "comp", lastK && lastK.t === lastTick && (lastK.frame >= 0 || lastK.comp) && clock - lastTick < P_ * 0.4 ? "on" : "off");
    WB.pose(svg, "button", newest && clock - newest.t < 25 ? "down" : "up");
    vsync.set((clock % P_) / P_);
    // the ball on the screen: where the animation was in the newest picture shown
    const shown = model.shown;
    if (Number.isFinite(shown)) { const ph = (shown % 1600) / 1600, u = ph < 0.5 ? ph * 2 : 2 - ph * 2; WB.place(ball, P, [G.TRACK.x0 + u * (G.TRACK.x1 - G.TRACK.x0), 0, 0]); }
    else WB.place(ball, P, [G.TRACK.x0, 0, 0]);

    if (force || clock - sayAt > 6) { sayAt = clock; narrate(now); showStats(); }
    if (model.blocks.length > 400) model.prune(tmin - 50);
  }

  const ms = (x) => (x < 10 ? x.toFixed(1) : String(Math.round(x))) + " ms";
  const budgetOf = (P_) => (Math.round(P_ * 10) / 10).toFixed(1) + " ms";
  function narrate(now) {
    const waiting = model.clicks.find((c) => c.t <= clock && (c.start === null || c.start > clock));
    if (now && now.kind === "task") {
      const job = model.jobs[now.job], from = job.start ?? now.start;
      let missed = 0; for (const k of model.ticks) if (k.t > from && k.t <= clock && !k.fresh) missed++;
      const what = cfg.work.startsWith("chunk") ? T(ms(now.end - now.start) + " chunk", "pedazo de " + ms(now.end - now.start)) : T("task", "tarea");
      if (waiting) say(T(L(what) + " · click waiting " + ms(clock - waiting.t), L(what) + " · clic esperando " + ms(clock - waiting.t)));
      else say(T(L(what) + " · " + missed + " frames missed so far", L(what) + " · " + missed + " cuadros perdidos"));
      return;
    }
    if (now && now.kind === "input") { const w = ms(now.start - model.clicks[now.ia].t); say(T("click handler · waited " + w, "handler del clic · esperó " + w)); return; }
    if (now && now.frame >= 0) {
      const f = model.frames[now.frame], name = { js: "JS", style: L(T("style", "estilo")), layout: "layout", paint: L(T("paint", "pintado")) }[now.kind];
      say(T("frame · " + name + " · " + ms(f.end - f.start) + " of " + budgetOf(model.P), "cuadro · " + name + " · " + ms(f.end - f.start) + " de " + budgetOf(model.P)));
      return;
    }
    if (now && now.kind === "js") { say(T("setTimeout step · a new position", "paso de setTimeout · posición nueva")); return; }
    if (cfg.driver === "css" && cfg.prop === "transform") say(T("idle · the compositor moves the ball", "libre · el compositor mueve la bola"));
    else say(T("idle · waiting for the next vsync", "libre · esperando el siguiente vsync"));
  }

  function showStats() {
    const P_ = model.P, from = Math.max(100, clock - 1000);
    let fresh = 0, n = 0;
    for (const k of model.ticks) if (k.t > from && k.t <= clock) { n++; if (k.fresh) fresh++; }
    stat("fps", clock - from > 200 ? Math.round((fresh * 1000) / (clock - from)) : "–");
    const total = tally.frames + tally.missed;
    stat("missed", total ? tally.missed + " (" + Math.round((100 * tally.missed) / total) + "%)" : "–");
    let last = null;
    for (let i = model.frames.length - 1; i >= 0; i--) { const f = model.frames[i]; if (f.end <= clock) { last = f; break; } }
    stat("work", last ? (last.end - last.start).toFixed(1) + " / " + budgetOf(P_) : "–");
    let busy = 0;
    for (const b of model.blocks) { const s = Math.max(b.start, from), e = Math.min(b.end, clock); if (e > s) busy += e - s; }
    stat("busy", clock - from > 200 ? Math.round((100 * busy) / (clock - from)) + "%" : "–");
    const done = model.clicks.filter((c) => c.present !== null && c.present <= clock);
    const lastClick = done.length ? done[done.length - 1] : null;
    const pending = tracked && (tracked.present === null || tracked.present > clock) ? tracked : null;
    stat("click", pending ? L(T("waiting… ", "esperando… ")) + ms(clock - pending.t) : lastClick ? ms(latencyOf(lastClick)) : "–");
    clickMeter.set(pending ? (clock - pending.t) / 500 : lastClick ? latencyOf(lastClick) / 500 : 0);
    stat("inp", done.length ? ms(inpOf(done.map(latencyOf))) : "–");
  }

  // ---------- the loop ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    clock += dt * SLOW * cfg.speed;
    model.runTo(clock);
    paint(false);
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = String(raw);
    if (!quiet) { restart(); say(T("settings applied · run restarted", "ajustes aplicados · ejecución reiniciada")); }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    click: () => { model.click(clock); wake(); },
    task: () => { model.job(clock); wake(); },
    reset: () => { restart(); say(T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const key of ["hz", "driver", "prop", "work"]) set(key, w[key], true);
    restart();
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

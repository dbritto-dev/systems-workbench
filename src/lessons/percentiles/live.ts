// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The timing hall in the browser: streams user requests through the model into the histogram, plays one request on
// the rig in slow motion, moves the pointers and answers the controls. mount() gets the build-time data from
// page.ts (geometry, chip drawings) and root, the <wb-lesson>.
import { translateAlong, solidSvg, slabOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { T as TT, L as tr } from "../../runtime/wb";   // this script already uses short names, so the language helpers get their own
import { playPause } from "../../runtime/dom";
import { lerp, approach } from "../../lib/tween";
import { rng, userRequest, summary, binOf, binPos, SLOW_MS, fmt } from "./sim";

export default function mount({ P, G, CHIP, POINTER_KEYS, HEDGE_AT }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const NS = "http://www.w3.org/2000/svg";
  const counters = Object.fromEntries(["mean", "p50", "p99", "slow", "out"].map((n) => [n, WB.counter(svg, n, P)]));
  const cols = [...Array(10).keys()].map((i) => q('[data-col="' + i + '"]'));
  const pointers = Object.fromEntries(POINTER_KEYS.map((k) => [k, q('[data-pointer="' + k + '"]')]));
  const lamps = [...Array(10).keys()].map((i) => ({ on: q('[data-lamp="' + i + '-on"]'), off: q('[data-lamp="' + i + '-off"]'), gc: q('[data-gc="' + i + '"]') }));
  const chipsLayer = q("[data-chips]");
  const token = q("[data-token]");
  const each = q("[data-each]");
  const stat = (key, value) => root.stat(key, value);

  const cfg = { fanout: 10, share: 0.01, hedge: "off", tester: "open", speed: 1 };
  const RATE = 100, WINDOW = 3000, SLOWMO = 2.5, GC_HOST = 6;
  let r, clock, made, nextAt, win, winAt, bins, extra, calls, gc, shown, feat, chips, sumAt, last, note, seed = 3;

  function restart() {
    r = rng(seed); seed = (Date.now() % 1e6) + 1;
    clock = 0; made = 0; nextAt = 1 / RATE; win = []; winAt = 0; bins = Array(10).fill(0); extra = 0; calls = 0; gc = null; chips = []; sumAt = 0; note = null;
    shown = { heights: Array(10).fill(-1), pos: {} };
    chipsLayer.textContent = "";
    feat = { phase: "idle", wait: 0.4 };
    token.style.display = "none";
    each.style.display = cfg.fanout === 100 ? "" : "none";
    lamps.forEach((l) => { l.on.style.display = "none"; l.off.style.display = ""; l.gc.style.display = "none"; });
    // Start with a window already full, so the first frame has a histogram.
    advance(WINDOW / RATE);
    summarize(true);
  }

  const hedgeAt = () => (cfg.hedge === "p95" ? HEDGE_AT : null);
  // Fan-out 1 is one backend: every call goes to tower 7, the one the GC pause stops.
  function oneRequest(rr, t) { return userRequest(rr, { fanout: cfg.fanout, share: cfg.share, hedgeAt: hedgeAt(), t, gc, single: cfg.fanout === 1 ? GC_HOST : null }); }
  // A fixed-rate tester sends a request every 1/RATE s whatever happens; one that waits for each reply sends the
  // next request when the last one returns, so it sends nothing while a call is stuck.
  function advance(dt) {
    const end = clock + dt;
    while (nextAt <= end) {
      const t = nextAt;
      const req = oneRequest(r, t);
      nextAt = cfg.tester === "closed" ? t + req.ms / 1000 : t + 1 / RATE;
      made++; extra += req.extra; calls += req.calls.length;
      if (win.length < WINDOW) win.push(req.ms); else { bins[binOf(win[winAt])]--; win[winAt] = req.ms; winAt = (winAt + 1) % WINDOW; }
      bins[binOf(req.ms)]++;
      // A sample of requests drops onto the bins as chips (more of the slow ones, so the tail shows).
      if (chips.length < 10 && (made % 9 === 0 || (req.ms > SLOW_MS && r() < 0.3))) dropChip(req.ms, false);
    }
    clock = end;
    if (gc && clock > gc.until + 0.2) { lamps[GC_HOST].gc.style.display = "none"; gc = null; }
  }

  // ---------- chips ----------
  function dropChip(ms, featured, from) {
    const g = featured ? token.cloneNode(true) : document.createElementNS(NS, "g");
    if (!featured) { g.setAttribute("class", "wb-lit-group"); g.innerHTML = ms > SLOW_MS ? CHIP.on : CHIP.off; }
    else { g.removeAttribute("data-token"); g.innerHTML = ms > SLOW_MS ? CHIP.on : CHIP.off; g.style.display = ""; }
    const bin = binOf(ms);
    const x = G.BX0 + (bin + 0.5) * G.BW, y = G.PANEL_Y + 10 + ((made * 7) % 5) + (featured ? 1 : 0);
    const top = G.TRAY_Z + G.COL_MAX + 10;
    const c = { g, bin, age: 0, x, y, from: from || [x, y, top], featured, dur: featured ? 1.3 : 0.6 };
    chipsLayer.appendChild(g);
    chips.push(c);
  }
  function moveChips(dt) {
    for (const c of chips) {
      c.age += dt;
      const f = Math.min(1, c.age / c.dur);
      const floor = G.TRAY_Z + Math.max(0, shown.heights[c.bin]) + 0.2, top = G.TRAY_Z + G.COL_MAX + 10;
      let p;
      if (c.featured) {
        // across from the desk at height, then down into the bin
        const a = Math.min(1, f / 0.6), b = Math.max(0, (f - 0.6) / 0.4);
        const ea = 1 - Math.pow(1 - a, 2);
        p = [lerp(c.from[0], c.x, ea), lerp(c.from[1], c.y, ea), b ? top + (floor - top) * b * b : c.from[2] + (top - c.from[2]) * Math.sin(ea * Math.PI / 2)];
      } else p = [c.x, c.y, top + (floor - top) * f * f];
      c.g.setAttribute("transform", translateAlong(P, p));
      c.g.style.opacity = f > 0.92 ? String(Math.max(0, (1 - f) / 0.08)) : (f < 0.1 && !c.featured ? String(f / 0.1) : "");
    }
    chips = chips.filter((c) => { if (c.age < c.dur) return true; c.g.remove(); return false; });
  }

  // ---------- the request on the rig, in slow motion ----------
  function towerOf(host) { return host % 10; }
  function stepFeatured(dt) {
    if (feat.phase === "idle") {
      feat.wait -= dt;
      if (feat.wait > 0) return;
      const req = oneRequest(r, clock);
      feat = { phase: "out", t: 0, req, left: req.calls.map((c) => ({ tower: towerOf(c.host), end: c.ms * SLOWMO / 1000 })) };
      token.style.display = "";
    }
    if (feat.phase === "out") {
      feat.t += dt;
      const out = feat.left.filter((c) => c.end > feat.t);
      const busy = new Set(out.map((c) => c.tower));
      lamps.forEach((l, i) => { const on = busy.has(i); l.on.style.display = on ? "" : "none"; l.off.style.display = on ? "none" : ""; });
      counters.out.set(out.length);
      if (out.length && feat.t > 0.25) {
        const towers = [...busy].map((i) => i + 1).join(", ");
        note = { text: TT("waiting on " + out.length + " of " + feat.req.calls.length + " calls · tower " + towers, "espera " + out.length + " de " + feat.req.calls.length + " llamadas · torre " + towers) };
      }
      if (!out.length) {
        token.style.display = "none";
        dropChip(feat.req.ms, true, G.TOKEN_SPOT);
        const n = feat.req.calls.length, ms = feat.req.ms;
        note = { until: clock + 2.2 * cfg.speed, text: ms > SLOW_MS
          ? TT("took " + fmt(ms) + " · waited for its slowest call", "tardó " + fmt(ms) + " · esperó a la llamada más lenta")
          : TT("took " + fmt(ms) + " · " + (n === 1 ? "its call was fast" : "all " + n + " calls fast"), "tardó " + fmt(ms) + " · " + (n === 1 ? "su llamada fue rápida" : "las " + n + " llamadas, rápidas")) };
        feat = { phase: "idle", wait: 0.9 };
      }
    }
  }

  // ---------- the histogram, pointers and numbers ----------
  function summarize(snap) {
    const s = summary(win);
    const total = win.length;
    for (let i = 0; i < 10; i++) {
      const h = heightOf(bins[i], total);
      if (Math.abs(h - shown.heights[i]) > 0.25) { shown.heights[i] = h; cols[i].innerHTML = h < 0.4 ? "" : solidSvg(slabOf({ x: G.BX0 + i * G.BW + 2, y: G.PANEL_Y + 6, w: G.BW - 4, d: G.PANEL_D - 12, r: 0.6 }, G.TRAY_Z, h, P, 2, 0.2), { tone: "hi", crease: "lo", lit: i >= 5 }); }
    }
    shown.target = { mean: binPos(s.mean), p50: binPos(s.p50), p95: binPos(s.p95), p99: binPos(s.p99) };
    if (snap) shown.pos = { ...shown.target };
    counters.mean.set(Math.min(9999, Math.round(s.mean))); counters.p50.set(Math.min(9999, Math.round(s.p50))); counters.p99.set(Math.min(9999, Math.round(s.p99))); counters.slow.set(Math.round(100 * s.slow));
    stat("mean", fmt(s.mean)); stat("p50", fmt(s.p50)); stat("p95", fmt(s.p95)); stat("p99", fmt(s.p99)); stat("slow", (100 * s.slow).toFixed(1) + "%");
    stat("extra", calls ? (100 * extra / calls).toFixed(1) + "%" : "0%");
    last = s;
  }
  function heightOf(count, total) { return count ? Math.max(1, G.COL_MAX * Math.log10(1 + count) / Math.log10(1 + total)) : 0; }
  function movePointers(dt) {
    const f = approach(dt, 6);
    for (const k of POINTER_KEYS) {
      const to = shown.target[k], at = shown.pos[k] ?? to;
      const now = Math.abs(to - at) < 0.002 ? to : lerp(at, to, f);
      shown.pos[k] = now;
      pointers[k].setAttribute("transform", translateAlong(P, [G.BX0 + now * G.BW, 0, 0]));
    }
  }
  function words() {
    if (gc) { say(tr("GC pause on tower 7 · its calls wait", "pausa de GC en la torre 7 · sus llamadas esperan")); return; }
    if (note && (note.until === undefined || clock < note.until)) { say(tr(note.text)); return; }
    const s = last;
    say(tr("last " + win.length.toLocaleString("en") + " · p50 " + fmt(s.p50) + " · p99 " + fmt(s.p99), "últimas " + win.length.toLocaleString("en") + " · p50 " + fmt(s.p50) + " · p99 " + fmt(s.p99)));
  }

  function paint(dt) {
    sumAt += dt;
    if (sumAt > 0.15) { sumAt = 0; summarize(false); }
    movePointers(dt);
    moveChips(dt);
    words();
  }

  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => { advance(dt * cfg.speed); stepFeatured(dt * Math.min(cfg.speed, 3)); paint(dt); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = name === "hedge" || name === "tester" ? raw : Number(raw);
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));
  function pauseHost() {
    gc = { host: GC_HOST, from: clock, until: clock + 1 };
    lamps[GC_HOST].gc.style.display = "";
    note = { until: clock + 1.6, text: TT("tower 7 stops for a 1-second GC pause", "la torre 7 se detiene por una pausa de GC de 1 segundo") };
    if (loop.paused) loop.setPaused(false);
  }
  const actions = { gc: () => pauseHost(), reset: () => restart() };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    set("fanout", String(w.fanout), true); set("share", String(w.share), true); set("hedge", w.hedge, true); set("tester", w.tester || "open", true);
    restart();
    if (loop.paused) loop.setPaused(false);
    if (w.gc) setTimeout(pauseHost, 1200);
  });

  loop.setPaused(loop.paused);
  restart();
}

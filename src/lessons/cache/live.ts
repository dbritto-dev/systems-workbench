// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The records office in the browser: plays each request as a sequence of steps (press, hit or fetch from the archive,
// place the card), keeps the rack's cards and their time to live, wires the controls and the experiment cards.
// mount() gets the build-time data from page.ts (projection, geometry, experiment results).
import { translateAlong, solidSvg, slabOf, lineOnTop } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats as statsStrip, act, pauseControls, setLit as lightUp } from "../../runtime/dom";
import { lerp, lerpVec, easeInOutCubic } from "../../lib/tween";
import { pct } from "../../lib/format";
import { rng } from "../../lib/random";
import { TIMING, HIT_TIME, MISS_TIME, RECORDS, pickRecord } from "./sim";

export default function mount({ P, G, RESULTS, EXPERIMENTS }) {
  const CLOCK = [-28, -42], CLOCK_R = 14, CLOCK_TOP = 12, CARRY_Y = 48, CARRY_Z = 8, LIFT_Z = 52;

  const stage = document.querySelector("[data-office]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const drawersBox = q("[data-drawers]");
  const drawerEls = G.DRAWERS.map((_, i) => q('[data-drawer="' + i + '"]'));
  const slotEls = G.SLOTS.map((_, i) => q('[data-slot="' + i + '"]'));
  const coverEls = G.SLOTS.map((_, i) => q('[data-cover="' + i + '"]'));
  const ttlEls = slotEls.map((el) => el.querySelector("[data-ttl]"));
  const liftEls = slotEls.map((el) => el.querySelector("[data-lift]"));
  const carriageEl = q("[data-carriage]"), fly = q("[data-fly]"), flyHome = q("[data-fly-home]"), cap = q("[data-cap]"), needle = q("[data-needle]");
  const capSolid = cap.querySelector(".iso-solid");
  const anchors = { front: q('[data-anchor="front"]'), back: q('[data-anchor="back"]') };

  const cfg = { ttl: 60, slots: 12, traffic: "popular", invalidate: false, speed: 1 };
  let random = rng(Date.now() % 1e6 + 1);
  let now = 0, steps = [], current = null, carX = G.PARK;
  const versions = new Array(RECORDS + 1).fill(1);
  const rack = new Array(12).fill(null);
  const where = new Map();
  const stats = { requests: 0, hits: 0, misses: 0, stale: 0, wait: 0 };
  const drawerOpen = new Array(8).fill(0);
  let pulse = null;

  const ease = easeInOutCubic;
  const lerp3 = lerpVec;
  const sayText = readout();
  const say = (m) => sayText(L(m));

  function setCar(x) { carX = x; carriageEl.setAttribute("transform", translateAlong(P, [x, 0, 0])); }
  function setDrawer(i, open) {
    drawerOpen[i] = open;
    const d = G.DRAWERS[i], el = drawerEls[i];
    el.querySelector("[data-front]").setAttribute("transform", translateAlong(P, [0, open, 0]));
    el.querySelector("[data-body]").innerHTML = open < 0.3 ? "" : solidSvg(slabOf({ x: d.x0 + 1.2, y: G.FACE_Y, w: G.DRAWER.w - 2.4, d: open, r: 0.4 }, d.z0 + 1, G.DRAWER.h - 2, P, 2), { tone: "mid", crease: "none" });
  }
  function raise(i) { drawersBox.appendChild(drawerEls[i]); }
  function flyAt(p, opacity = 1) { fly.setAttribute("transform", translateAlong(P, p)); fly.style.opacity = String(opacity); }
  function flyInto(node) { if (fly.parentNode !== node) node.appendChild(fly); }
  const setLit = (slot, on) => lightUp(liftEls[slot], on);
  function lift(slot, dz) { liftEls[slot].setAttribute("transform", dz ? translateAlong(P, [0, 0, dz]) : ""); }
  function showCard(slot, on) { slotEls[slot].toggleAttribute("data-empty", !on); }
  function clearSlot(slot) { const c = rack[slot]; if (!c) return; where.delete(c.record); rack[slot] = null; showCard(slot, false); ttlEls[slot].setAttribute("d", ""); }
  function expire() { rack.forEach((c, i) => { if (c && c.expires <= now) clearSlot(i); }); }

  function chooseSlot(record) {
    expire();
    for (let i = 0; i < cfg.slots; i++) if (!rack[i]) return { slot: i, evicted: null };
    let oldest = 0;
    for (let i = 1; i < cfg.slots; i++) if (rack[i].used < rack[oldest].used) oldest = i;
    const evicted = rack[oldest].record;
    clearSlot(oldest);
    return { slot: oldest, evicted };
  }

  function finish(time) {
    stats.requests++; stats.wait += time; showStats();
    steps.push({ dur: TIMING.gap });
  }

  function request() {
    const record = pickRecord(random, cfg.traffic);
    say(T("#" + record + " · asked for", "#" + record + " · pedido"));
    steps.push({
      dur: TIMING.press,
      begin: () => capSolid.setAttribute("data-lit", ""),
      run: (t) => cap.setAttribute("transform", translateAlong(P, [0, 0, -1.6 * Math.sin(Math.PI * t)])),
      done: () => { capSolid.removeAttribute("data-lit"); decide(record); },
    });
  }

  function decide(record) {
    expire();
    const slot = where.get(record);
    if (slot !== undefined) {
      const card = rack[slot], stale = card.version < versions[record];
      say(stale
        ? T("#" + record + " · hit, but stale v" + card.version + " (archive v" + versions[record] + ")", "#" + record + " · acierto, pero obsoleto v" + card.version + " (archivo v" + versions[record] + ")")
        : T("#" + record + " · hit", "#" + record + " · acierto"));
      setLit(slot, true);
      steps.push({ dur: TIMING.hit, run: (t) => lift(slot, 4 * Math.sin(Math.PI * t)), done: () => {
        setLit(slot, false); lift(slot, 0);
        if (rack[slot]) rack[slot].used = now;
        stats.hits++; if (stale) stats.stale++;
        finish(HIT_TIME);
      } });
      return;
    }
    const di = (record - 1) % 8, d = G.DRAWERS[di];
    say(T("#" + record + " · miss · to the archive", "#" + record + " · fallo · al archivo"));
    const from = carX;
    steps.push({ dur: TIMING.leg, run: (t) => setCar(lerp(from, d.cx, ease(t))) });
    steps.push({ dur: TIMING.drawer, begin: () => raise(di), run: (t) => setDrawer(di, G.DRAWER.open * ease(t)) });
    const top = [d.cx, G.FACE_Y + G.DRAWER.open / 2, d.z0 + G.DRAWER.h + 4];
    steps.push({ dur: TIMING.transfer, begin: () => flyInto(flyHome), run: (t) => {
      if (t < 0.35) flyAt([top[0], top[1], top[2] - 6 + 6 * ease(t / 0.35)], t / 0.35);
      else flyAt(lerp3(top, [d.cx, CARRY_Y, CARRY_Z], ease((t - 0.35) / 0.65)));
    } });
    let target = null;
    steps.push({ dur: TIMING.leg, begin: () => {
      const pick = chooseSlot(record); target = pick.slot;
      if (pick.evicted) say(T("#" + record + " · rack full · #" + pick.evicted + " out (least recently used)", "#" + record + " · estante lleno · sale #" + pick.evicted + " (el menos usado recientemente)"));
    }, run: (t) => {
      setDrawer(di, G.DRAWER.open * (1 - ease(Math.min(1, t * 2.5))));
      const x = lerp(d.cx, G.SLOTS[target].cx, ease(t));
      setCar(x); flyAt([x, CARRY_Y, CARRY_Z]);
    } });
    steps.push({ dur: TIMING.place, run: (t) => {
      const s = G.SLOTS[target], above = [s.cx, CARRY_Y, LIFT_Z], over = [s.cx, s.y + G.CARD.d / 2, LIFT_Z], home = [s.cx, s.y + G.CARD.d / 2, s.z];
      if (t < 0.35) flyAt(lerp3([s.cx, CARRY_Y, CARRY_Z], above, ease(t / 0.35)));
      else if (t < 0.65) flyAt(lerp3(above, over, ease((t - 0.35) / 0.3)));
      else { flyInto(anchors[s.row]); flyAt(lerp3(over, home, ease((t - 0.65) / 0.35))); }
    }, done: () => {
      fly.style.opacity = "0"; flyInto(flyHome);
      const s = target;
      if (rack[s]) clearSlot(s);
      rack[s] = { record, version: versions[record], expires: now + cfg.ttl, used: now };
      where.set(record, s); showCard(s, true); setLit(s, false);
      stats.misses++;
      finish(MISS_TIME);
    } });
  }

  function advance(dt) {
    now += dt;
    let left = dt, guard = 0;
    while (left > 1e-9 && guard++ < 50) {
      if (!current) {
        current = steps.shift();
        if (!current) { request(); continue; }
        current.elapsed = 0; current.begin && current.begin();
      }
      const use = Math.min(current.dur - current.elapsed, left);
      current.elapsed += use; left -= use;
      current.run && current.run(Math.min(1, current.elapsed / current.dur));
      if (current.elapsed >= current.dur - 1e-9) { const c = current; current = null; c.done && c.done(); }
    }
    if (pulse) {
      pulse.t += dt / 0.7;
      const busy = current && drawerOpen[pulse.di] > 0 && pulse.t <= 0;
      if (!busy) setDrawer(pulse.di, 6 * Math.sin(Math.PI * Math.min(1, pulse.t)));
      if (pulse.t >= 1) { setDrawer(pulse.di, 0); pulse = null; }
    }
  }

  function paint() {
    expire();
    rack.forEach((c, i) => {
      if (!c) return;
      const share = Math.max(0, Math.min(1, (c.expires - now) / cfg.ttl));
      const s = G.SLOTS[i], y = s.y + G.CARD.d, T = G.TTL_STRIP;
      ttlEls[i].setAttribute("d", share > 0.01 ? WB.faceRectY(P, s.cx + T.x0, s.cx + T.x0 + (T.x1 - T.x0) * share, y, s.z + T.z0, s.z + T.z1) : "");
    });
    const turn = (now % 60) / 60, a = turn * Math.PI * 2;
    needle.setAttribute("d", lineOnTop([CLOCK[0] - Math.sin(a) * 2.6, CLOCK[1] + Math.cos(a) * 2.6], [CLOCK[0] + Math.sin(a) * (CLOCK_R - 3.4), CLOCK[1] - Math.cos(a) * (CLOCK_R - 3.4)], CLOCK_TOP + 0.2, P));
  }

  const stat = statsStrip();
  function showStats() {
    const looked = stats.hits + stats.misses;
    stat("requests", stats.requests);
    stat("hits", stats.hits);
    stat("misses", stats.misses);
    stat("rate", looked ? Math.round(100 * stats.hits / looked) + "%" : "–");
    stat("wait", stats.requests ? (stats.wait / stats.requests).toFixed(2) + " s" : "–");
    stat("stale", stats.stale);
  }

  // ---------- controls ----------
  const pause = pauseControls(stage, sayText);
  const clock = WB.loop({ stage, step: (dt) => { advance(dt * cfg.speed); paint(); }, onPause: pause.onPause });
  pause.bind(clock);
  clock.setPaused(clock.paused);
  function resetCounts() { Object.assign(stats, { requests: 0, hits: 0, misses: 0, stale: 0, wait: 0 }); showStats(); }
  function applySlots(n) { cfg.slots = n; coverEls.forEach((el, i) => el.toggleAttribute("data-on", i >= n)); rack.forEach((c, i) => { if (i >= n) clearSlot(i); }); }
  function set(name, raw) {
    if (name === "ttl") { cfg.ttl = Number(raw); rack.forEach((c) => { if (c) c.expires = Math.min(c.expires, now + cfg.ttl); }); }
    if (name === "slots") applySlots(Number(raw));
    if (name === "traffic") cfg.traffic = raw;
    if (name === "invalidate") cfg.invalidate = raw === "true" || raw === true;
    if (name === "speed") cfg.speed = Number(raw);
    WB.pressSeg(name, raw);
  }
  function flushRack() { rack.forEach((c, i) => clearSlot(i)); say(T("rack emptied", "estante vaciado")); }
  function changeRecord() {
    versions[1]++;
    pulse = { di: 0, t: 0 }; raise(0);
    let en = "#1 changed · archive now v" + versions[1], es = "#1 cambió · el archivo ahora tiene v" + versions[1];
    if (cfg.invalidate && where.has(1)) { clearSlot(where.get(1)); en += " · rack copy removed"; es += " · se quitó la copia del estante"; }
    else if (where.has(1)) { const v = rack[where.get(1)].version; en += " · rack still has v" + v; es += " · el estante sigue con v" + v; }
    say(T(en, es));
    if (clock.paused) clock.setPaused(false);
  }
  WB.onSegments(set);
  act("flush").addEventListener("click", flushRack);
  act("change").addEventListener("click", changeRecord);
  act("reset").addEventListener("click", resetCounts);

  // ---------- experiments (computed at build time from the same model; see sim.ts) ----------
  const secs = (x) => x.toFixed(2) + " s";
  const RUNS = {
    ttl: () => { const a = RESULTS.base, b = RESULTS.ttl; return {
      verdict: T("Hit rate " + pct(a.hitRate) + " → " + pct(b.hitRate) + ", average wait " + secs(a.avgTime) + " → " + secs(b.avgTime) + ".",
        "Tasa de aciertos " + pct(a.hitRate) + " → " + pct(b.hitRate) + ", espera media " + secs(a.avgTime) + " → " + secs(b.avgTime) + "."),
      bars: [[T("TTL 60 s", "TTL 60 s"), a.hitRate, pct(a.hitRate)], [T("TTL 6 s", "TTL 6 s"), b.hitRate, pct(b.hitRate), true]] }; },
    size: () => { const a = RESULTS.base, b = RESULTS.size; return {
      verdict: T("Room fell to a third; hit rate only fell from " + pct(a.hitRate) + " to " + pct(b.hitRate) + ".",
        "El espacio cayó a un tercio; la tasa de aciertos solo bajó de " + pct(a.hitRate) + " a " + pct(b.hitRate) + "."),
      bars: [[T("12 slots", "12 lugares"), a.hitRate, pct(a.hitRate)], [T("4 slots", "4 lugares"), b.hitRate, pct(b.hitRate), true]] }; },
    even: () => { const a = RESULTS.base, b = RESULTS.even; return {
      verdict: T("Hit rate " + pct(a.hitRate) + " → " + pct(b.hitRate) + ", close to 12 of 40 records (30%).",
        "Tasa de aciertos " + pct(a.hitRate) + " → " + pct(b.hitRate) + ", cerca de 12 de 40 registros (30%)."),
      bars: [[T("Popular traffic", "Tráfico popular"), a.hitRate, pct(a.hitRate)], [T("Even traffic", "Tráfico parejo"), b.hitRate, pct(b.hitRate), true]] }; },
    flush: () => { const { warm, first, later } = RESULTS.flush; const top = Math.max(warm, first, later) * 1.1; const more = Math.round(100 * (first / warm - 1)); return {
      verdict: T("The first 10 requests after emptying took " + more + "% longer on average; requests 11 to 30 were already back to " + secs(later) + ".",
        "Las primeras 10 solicitudes después de vaciar tardaron en promedio " + more + "% más; las solicitudes 11 a 30 ya habían vuelto a " + secs(later) + "."),
      bars: [[T("Never emptied", "Nunca vaciado"), warm / top, secs(warm)], [T("First 10 after", "Primeras 10 después"), first / top, secs(first), true], [T("Requests 11–30", "Solicitudes 11–30"), later / top, secs(later)]] }; },
    stale: () => { const { off, on } = RESULTS.stale; return {
      verdict: T(pct(off) + " of rack reads of #1 were stale. With invalidate on write: " + pct(on) + ".",
        pct(off) + " de las lecturas de #1 desde el estante fueron obsoletas. Con invalidar al escribir: " + pct(on) + "."),
      bars: [[T("Invalidate off", "Invalidar: no"), off, pct(off), true], [T("Invalidate on", "Invalidar: sí"), on, pct(on)]] }; },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    set("ttl", w.ttl); set("slots", w.slots); set("traffic", w.traffic); if ("invalidate" in w) set("invalidate", String(w.invalidate));
    resetCounts();
    if (clock.paused) clock.setPaused(false);
    if (w.flush) setTimeout(flushRack, 2500);
    if (w.change) setTimeout(changeRecord, 2500);
  } });

  paint(); showStats(); applySlots(12);
}

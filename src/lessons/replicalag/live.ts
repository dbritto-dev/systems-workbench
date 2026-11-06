// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The copy desks in the browser: runs the model in slow motion, rides the slips along the conveyors, lines them up
// on each desk's tray and copies them into its ledger, turns the counters, lights your slip and the lamps of the
// desks that have it, and answers the controls. "Watch it on the machine" jumps the run to a few seconds before the
// moment the experiment is about, found by running the same seed ahead. mount() gets the build-time data from page.ts (projection, geometry, the slip drawing) and
// root, the <wb-lesson>.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setLit, setText, playPause } from "../../runtime/dom";
import { lerp, smoothstep } from "../../lib/tween";
import { clamp, rankQuantile } from "../../lib/stats";
import { makeSim, BURST } from "./sim";

export default function mount({ P, G, SLIP_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const stat = (key, value) => root.stat(key, value);
  const NS = "http://www.w3.org/2000/svg";
  const layers = [q('[data-layer="slips0"]'), q('[data-layer="slips1"]')];
  const counters = Object.fromEntries(["lsn", "at0", "at1", "lag0", "lag1", "wrote", "saw", "missing", "wentBack"].map((n) => [n, WB.counter(svg, n, P)]));
  const lampEl = (name) => { const g = q(`[data-lamp="${name}"]`); return { on: g.querySelector("[data-on-lamp]"), off: g.querySelector("[data-off-lamp]") }; };
  const lamps = { yours0: lampEl("yours0"), yours1: lampEl("yours1") };
  const setLamp = (l, on) => { show(l.on, on); show(l.off, !on); };
  const more = [q('[data-more="0"]'), q('[data-more="1"]')], verdict = q("[data-verdict]");
  const MAX_BELT = 120;                // slips drawn on one conveyor at a time

  // ---------- slips: pooled elements per conveyor ----------
  const pools = [[], []], used = [[], []];
  function slipEl(f) {
    const el = pools[f].pop();
    if (el) return el;
    const g = document.createElementNS(NS, "g");
    g.innerHTML = SLIP_SVG;
    return { g, lit: false, pos: null };
  }

  // ---------- settings and the run ----------
  const cfg = { route: "any", commit: "async", b: "slow", speed: 0.1 };
  let model, clock, logAt, seed = 5, runCfg = null, runSeed = 5;
  let youW = null, lastRead = null, readAt = -9;
  const arrived = [0, 0];               // per follower: writes that have reached it (they arrive in log order)

  // withBursts: the time of the first batch burst, then one every 20 s
  function restart(withBursts = null) {
    for (const f of [0, 1]) { for (const el of used[f]) { el.g.remove(); pools[f].push(el); } used[f] = []; }
    const burst = withBursts !== null ? Array.from({ length: 12 }, (_, i) => ({ at: withBursts + 20 * i, rate: BURST.rate, dur: BURST.dur })) : [];
    runCfg = { route: cfg.route, commit: cfg.commit, b: cfg.b, burst }; runSeed = seed;
    model = makeSim(runCfg, seed);
    seed = (seed * 7 + 3) % 9973 + 1;
    clock = 0; logAt = 0; youW = null; lastRead = null; readAt = -9; held = null; saidAt = -9; saidRank = 0;
    arrived[0] = arrived[1] = 0;
    paint();
    showStats();
  }

  // ---------- narration ----------
  const NODE = { L: T("the leader", "el líder"), 0: T("A", "A"), 1: T("B", "B") };
  const TO = { L: "al líder", 0: "a A", 1: "a B" };   // Spanish: "fue al líder", "fue a A"
  const four = (n) => String(n % 10000).padStart(4, "0");
  const T_BURST = () => T("a batch job writes " + BURST.rate + " a second for " + BURST.dur + " s", "un proceso por lotes escribe " + BURST.rate + " por segundo durante " + BURST.dur + " s");
  let held = null, saidAt = -9, saidRank = 0;
  // a message stays up at least 1.4 s of page time (3 s for a read that missed your save or went back) unless a more
  // important one comes; a less important one waits
  const holdFor = (rank) => (rank >= 4 ? 3 : 1.4);
  // read: the read of yours a message is about; the board shows it once the message is up, so the board and the
  // readout always talk about the same read
  function say(rank, text, read = null) {
    const wall = performance.now() / 1000;
    if (rank < saidRank && wall - saidAt < holdFor(saidRank)) { held = { rank, text, read }; return; }
    held = null; saidRank = rank; saidAt = wall;
    if (read) lastRead = read;
    root.figure.say(L(text));
  }
  function sayHeld() {
    if (held && performance.now() / 1000 - saidAt >= holdFor(saidRank)) { const h = held; held = null; saidRank = -1; say(h.rank, h.text, h.read); }
  }
  function narrate(quiet = false) {
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt];
      if (e.t > clock) break;
      if (quiet) { if (e.type === "write") youW = e.w; else if (e.type === "read") { lastRead = e; readAt = clock; } continue; }
      switch (e.type) {
        case "write": {
          youW = e.w;
          const n = "#" + four(e.w.lsn);
          if (cfg.commit === "async") say(1, T("you save " + n + " · the leader has it · the followers get it next", "guardas " + n + " · el líder lo tiene · las réplicas lo reciben después"));
          else if (cfg.commit === "semi") say(1, T("you save " + n + " · waiting for one follower to receive it", "guardas " + n + " · esperando que una réplica lo reciba"));
          else say(1, T("you save " + n + " · waiting for A and B to apply it", "guardas " + n + " · esperando que A y B lo apliquen"));
          if (e.w.ret === Infinity) say(3, T("your save " + n + " waits for B, which has stopped replaying", "tu guardado " + n + " espera a B, que dejó de aplicar"));
          break;
        }
        case "ret":
          if (cfg.commit !== "async") say(2, T("saved · the commit took " + Math.round(1000 * (e.w.ret - e.w.t)) + " ms", "guardado · el commit tardó " + Math.round(1000 * (e.w.ret - e.w.t)) + " ms"));
          break;
        case "read": {
          const where = NODE[e.node], to = TO[e.node], at = "#" + four(e.got);
          if (e.miss) say(4, T("your read went to " + where.en + " · it is at " + at + " · your save is missing", "tu lectura fue " + to + " · va en " + at + " · falta tu guardado"), e);
          else if (e.backInTime) say(4, T("your read went to " + where.en + " · it shows less than your last read", "tu lectura fue " + to + " · muestra menos que tu lectura anterior"), e);
          else if (e.isBack) say(2, T("your read went to " + where.en + " · your save is there", "tu lectura fue " + to + " · tu guardado está"), e);
          else say(1, T("you look again · " + where.en + " · at " + at, "miras de nuevo · " + where.es + " · en " + at), e);
          break;
        }
        case "burstStart": say(5, T_BURST()); break;
        case "burstEnd": say(5, T("burst over · the followers are still replaying it", "terminó la ráfaga · las réplicas todavía la aplican")); break;
      }
    }
    if (logAt > 2000) { model.log.splice(0, logAt); logAt = 0; }
  }

  // ---------- where a slip is ----------
  const Q = G.QUEUE, BK = G.BOOK;
  const bookX = G.DESKS[0].x + BK.dx + BK.w / 2;
  const trayEnd = Q.x0 + (Q.slots - 1) * Q.step;
  const onBelt = (w, f, now) => [lerp(G.BELT.x0 + 3, G.BELT.x1 - 1, clamp((now - w.t) / (w.f[f].arrive - w.t))), G.BELT_Y[f], G.BELT.z];
  // waiting on the tray, k-th in line: the next one to copy sits at the tray's end
  const onTray = (f, k) => [trayEnd - k * Q.step, G.BELT_Y[f], G.DESK_H + 0.6];
  // being copied: slides from the tray onto the ledger and sinks into it
  function copying(w, f, now) {
    const s = w.f[f], u = s.end === Infinity ? 0 : clamp((now - s.start) / (s.end - s.start));
    return [lerp(trayEnd, bookX, smoothstep(Math.min(1, u * 1.6))), G.BELT_Y[f], G.DESK_H + 0.6 - 2.4 * Math.max(0, u - 0.6)];
  }

  // ---------- painting ----------
  function paintSlips(f, now) {
    const F = model.F[f], ws = model.writes, n = ws.length, items = [];
    const applied = model.appliedAt(F, now);
    while (arrived[f] < n && ws[arrived[f]].f[f].arrive <= now) arrived[f]++;
    // the tray shows the one being copied and Q.slots waiting; the rest are counted on the "+N" tag
    const over = Math.max(0, arrived[f] - applied - (Q.slots + 1));
    if (more[f].over !== over) { more[f].over = over; setText(more[f], over ? "+" + over : ""); }
    // the one being copied, then the line on the tray
    for (let i = applied; i < n && i <= applied + Q.slots; i++) {
      const w = ws[i];
      if (w.t > now || w.f[f].arrive > now) break;
      items.push([w, i === applied && now >= w.f[f].start ? copying(w, f, now) : onTray(f, i - applied - (now >= ws[applied].f[f].start ? 1 : 0))]);
    }
    // on the conveyor: from the newest back
    let m = 0;
    for (let i = n - 1; i >= 0 && m < MAX_BELT; i--) {
      const w = ws[i];
      if (w.f[f].arrive <= now) break;
      if (w.t > now) continue;
      items.push([w, onBelt(w, f, now)]); m++;
    }
    items.sort((a, b) => depthOf(a[1], P) - depthOf(b[1], P));
    const els = used[f];
    while (els.length > items.length) { const el = els.pop(); el.g.remove(); pools[f].push(el); }
    while (els.length < items.length) { const el = slipEl(f); layers[f].appendChild(el.g); els.push(el); }
    items.forEach(([w, p], i) => {
      const el = els[i], lit = !!youW && w === youW;
      if (el.lit !== lit) { el.lit = lit; setLit(el.g, lit); }
      el.g.setAttribute("transform", translateAlong(P, p));
    });
  }

  function paint() {
    narrate();
    sayHeld();
    const now = clock;
    paintSlips(0, now); paintSlips(1, now);
    counters.lsn.set(model.leaderLSN % 10000);
    for (const f of [0, 1]) {
      const F = model.F[f];
      counters["at" + f].set(model.appliedAt(F, now) % 10000);
      counters["lag" + f].setClamped(Math.round(1000 * model.lagAt(F, now)));
      setLamp(lamps["yours" + f], !!youW && model.appliedAt(F, now) >= youW.lsn);
    }
    counters.wrote.set(youW ? youW.lsn % 10000 : 0);
    counters.saw.set(lastRead ? lastRead.got % 10000 : 0);
    const v = verdictOf(lastRead);
    if (verdict.said !== v) { verdict.said = v; setText(verdict, v); }
    // the same shares as the panel's first two stats
    counters.missing.setClamped(pctNum(model.st.backMiss, model.st.backs));
    counters.wentBack.setClamped(pctNum(model.st.quickBack, model.st.quick));
  }
  // the board's line about your last read: where it was served, and whether it had your save
  function verdictOf(r) {
    if (!r) return "";
    const from = r.node === "L" ? L("FROM THE LEADER", "DEL LÍDER") : L("FROM " + (r.node ? "B" : "A"), "DE " + (r.node ? "B" : "A"));
    if (r.miss) return from + " · " + L("YOUR SAVE IS MISSING", "FALTA TU GUARDADO");
    if (r.backInTime) return from + " · " + L("LESS THAN YOUR LAST READ", "MENOS QUE TU LECTURA ANTERIOR");
    return r.wrote ? from + " · " + L("HAS YOUR SAVE", "TIENE TU GUARDADO") : from;
  }

  // ---------- stats ----------
  const pctNum = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const pctOf = (a, b) => (b ? pctNum(a, b) + "%" : "–");
  const msText = (x) => Math.round(1000 * x) + " ms";
  function showStats() {
    const st = model.st;
    stat("missing", pctOf(st.backMiss, st.backs));
    stat("back", pctOf(st.quickBack, st.quick));
    stat("lagA", msText(model.lagAt(model.F[0], clock)));
    stat("lagB", msText(model.lagAt(model.F[1], clock)));
    const stuck = youW && youW.ret === Infinity;
    stat("save", stuck ? L("stuck", "detenido") : st.commits.length ? msText(rankQuantile(st.commits.slice(-200), 0.5)) : "–");
    stat("leader", pctOf(st.onLeader, st.reads));
  }

  // ---------- the loop ----------
  let statTimer = 0;
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    clock += dt * cfg.speed;
    model.runTo(clock);
    paint();
    statTimer += dt; if (statTimer > 0.2) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = String(raw);
    if (!quiet) { restart(); say(9, T("settings applied · run restarted", "ajustes aplicados · ejecución reiniciada")); }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    save: () => {
      if (!model.save(clock)) say(9, T("your last save is still waiting for its commit", "tu último guardado todavía espera su commit"));
      paint(); showStats(); wake();
    },
    burst: () => { model.burst(clock); paint(); wake(); },
    reset: () => { restart(); say(9, T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings, and the moment it's about ----------
  // The first time your own read does what the experiment asks about, found by running the same seed ahead without
  // drawing it: a read-back without your save, or a second look that shows less than the one before.
  const MOMENTS = {
    miss: (e) => e.type === "read" && e.isBack && e.miss,
    back: (e) => e.type === "read" && e.backInTime && !e.miss,
  };
  function firstMoment(pred, cap = 120) {
    const m = makeSim(runCfg, runSeed);
    for (let T = 0.5, j = 0; T <= cap; T += 0.5) {
      m.runTo(T);
      for (; j < m.log.length; j++) if (pred(m.log[j])) return m.log[j].t;
    }
    return null;
  }
  // Run the model to T without narrating what happened before it, keeping what the board shows.
  function jumpTo(T) {
    if (T <= clock) return;
    model.runTo(T);
    clock = T;
    narrate(true);
    if (model.bursts.some((b) => b.at <= T && T < b.end)) say(5, T_BURST());
    paint();
    showStats();
  }
  root.on("watch", (w) => {
    for (const key of ["route", "commit", "b"]) set(key, w[key], true);
    set("speed", w.speed ?? 0.1, true);
    restart(w.burst ?? null);
    if (w.until && MOMENTS[w.until]) {
      const t = firstMoment(MOMENTS[w.until]);
      // land about 4.5 s of page time before it
      if (t !== null) jumpTo(t - 4.5 * cfg.speed);
    }
    // or straight to a moment of the run (into the first burst)
    if (w.jump) jumpTo(w.jump);
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The ledger room in the browser: runs the model about a hundred times slower than real time, stacks the trays,
// shelves the books, flies the commit slips, and stages crashes and recoveries. mount() gets the build-time data from
// page.ts (projection, geometry, the slip drawing) and root, the <wb-lesson>.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, setLit, playPause } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { clamp } from "../../lib/stats";
import { makeSim, PAGES, PAGE_NAMES, REPLAY } from "./sim";

export default function mount({ P, G, SLIP_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const NS = "http://www.w3.org/2000/svg";
  const layer = q('[data-layer="slips"]');
  const sheets = { buf: Array.from({ length: G.SHEETS }, (_, i) => q(`[data-sheet="buf-${i}"]`)), os: Array.from({ length: G.SHEETS }, (_, i) => q(`[data-sheet="os-${i}"]`)) };
  const books = Array.from({ length: G.BOOKS }, (_, i) => q(`[data-book="${i}"]`));
  const cards = Array.from({ length: PAGES }, (_, i) => q(`[data-card="${i}"]`));
  const dirty = Array.from({ length: PAGES }, (_, i) => q(`[data-dirty="${i}"]`));
  const clientEls = qa("[data-client]");
  const clientsText = q("[data-clients]");
  const clerk = q("[data-clerk]");
  const more = q("[data-more]"), moreLabel = q("[data-more-label]");
  const counters = Object.fromEntries(["replay", "os", "buffer", "acked", "ondisk", "lost"].map((n) => [n, WB.counter(svg, n, P)]));
  const fsync = WB.dial(svg, "fsync", P);

  // ---------- settings and the run ----------
  const cfg = { log: "on", commit: "group", ckpt: 1000, clients: 4, speed: 0.01 };
  let model, clock, logAt, seed = 5, pages = null, lost = 0, phase = "run", phaseT = 0, crashRes = null, plan = [], screenT = 0;
  let saidAt = -9, saidRank = 0, lastCk = null, saidLsn = 0;
  let warm = 0;                                        // a Watch's warm-up: model ms run unseen at the start of each run it stages
  const slips = [], freeSlips = [];

  function restart(keepPages) {
    if (!keepPages) { pages = null; lost = 0; }
    model = makeSim({ log: cfg.log, commit: cfg.commit, ckpt: Number(cfg.ckpt), clients: Number(cfg.clients) }, seed, pages);
    seed = (seed * 7 + 3) % 9973 + 1;
    clock = 0; logAt = 0; phase = "run"; phaseT = 0; crashRes = null; lastCk = null; saidLsn = 0;
    WB.pose(svg, "lever", "on"); WB.pose(svg, "plunger", "up");
    show(clerk, false);
    const n = Number(cfg.clients);
    clientEls.forEach((el, i) => show(el, i < Math.min(n, clientEls.length)));
    show(more, n > clientEls.length); setText(moreLabel, "+" + (n - clientEls.length));
    setText(clientsText, L(n + " CLIENTS", n + " CLIENTES"));
    // a Watch that still has crashes to stage starts each run warmed up, past the first checkpoint and flush
    if (warm && plan.length) {
      clock = warm; model.runTo(clock);
      logAt = model.log.length;
      saidLsn = model.recs.length ? model.recs[model.recs.length - 1].lsn : 0;
    }
    paint();
    showStats();
  }

  // ---------- narration ----------
  function say(rank, text) {
    const wall = performance.now() / 1000;
    if ((rank < saidRank || rank === 0) && wall - saidAt < 1.6) return;
    saidRank = rank; saidAt = wall;
    root.figure.say(L(text));
  }
  const int = (x) => Math.round(x).toLocaleString("en");
  const ms = (x) => (x < 10 ? x.toFixed(1) : String(Math.round(x))) + " ms";
  // "1 record" / "2 records", in both languages
  const nOf = (n, en1, en, es1, es) => (n === 1 ? T("1 " + en1, "1 " + es1) : T(int(n) + " " + en, int(n) + " " + es));
  function narrate() {
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt];
      if (e.t > clock) break;
      const nRec = e.to - e.from;
      switch (e.type) {
        case "flush":
          if (cfg.commit === "group" || cfg.commit === "each") say(1, nRec > 1 ? T("fsync: " + nRec + " commits in one flush · OK after it", "fsync: " + nRec + " commits en una escritura · OK después") : T("fsync: one commit · OK once it's on disk", "fsync: un commit · OK cuando está en disco"));
          else { const w = nOf(nRec, "acknowledged record reaches", "acknowledged records reach", "registro ya confirmado llega", "registros ya confirmados llegan"); say(3, T("flush: " + w.en + " disk", "escritura: " + w.es + " al disco")); }
          break;
        case "ckptStart": say(2, T("checkpoint: log on disk up to record " + int(e.redo) + ", then the dirty pages", "checkpoint: log en disco hasta el registro " + int(e.redo) + ", luego las páginas sucias")); break;
        case "ckptDone": { const pw = nOf(e.pages, "page written", "pages written", "página escrita", "páginas escritas"); say(3, cfg.log === "on"
          ? T("checkpoint done: " + pw.en + " · recovery would start at record " + int(e.redo), "checkpoint listo: " + pw.es + " · la recuperación empezaría en el registro " + int(e.redo))
          : T(pw.en + " · the only copy that survives a crash", pw.es + " · la única copia que sobrevive a una caída")); break; }
      }
    }
    if (logAt > 4000) { model.log.splice(0, logAt); logAt = 0; }
    // the newest commit, when nothing more important is being said
    const r = model.recs[model.recs.length - 1];
    if (r && r.lsn !== saidLsn && r.at <= clock) {
      saidLsn = r.lsn;
      const id = "#" + r.lsn, pg = PAGE_NAMES[r.page];
      if (cfg.log !== "on") say(0, T("commit " + id + " · page " + pg + " updated in memory · OK sent", "commit " + id + " · página " + pg + " actualizada en memoria · OK enviado"));
      else if (cfg.commit === "write") say(0, T("commit " + id + " · write() to the OS cache · OK sent, no fsync", "commit " + id + " · write() a la caché del SO · OK enviado, sin fsync"));
      else if (cfg.commit === "async") say(0, T("commit " + id + " · record in the log buffer · OK sent at once", "commit " + id + " · registro en el búfer del log · OK enviado de inmediato"));
      else say(0, T("commit " + id + " · page " + pg + " in memory · record waits for the fsync", "commit " + id + " · página " + pg + " en memoria · el registro espera el fsync"));
    }
  }

  // ---------- stacks, books, cards ----------
  const sheetsFor = (n) => (n <= 0 ? 0 : Math.min(G.SHEETS, 1 + Math.floor(Math.log10(n) * 3)));
  function stack(name, n, lit) {
    const k = sheetsFor(n);
    sheets[name].forEach((el, i) => { show(el, i < k); setLit(el, lit && i < k); });
  }
  const perBook = () => Math.max(1, Number(cfg.ckpt) / G.BOOKS);
  function shelf(count) {
    const k = Math.min(G.BOOKS, Math.ceil(count / perBook()));
    books.forEach((el, i) => show(el, i < k));
  }
  function drawers(on) { for (let i = 0; i < PAGES; i++) WB.pose(svg, "drawer-" + i, on.includes(i) ? "out" : "in"); }

  // ---------- slips: a commit flies from its client to the desk ----------
  function slipEl() {
    const g = freeSlips.pop() || (() => { const el = document.createElementNS(NS, "g"); el.innerHTML = SLIP_SVG; return el; })();
    layer.appendChild(g);
    return g;
  }
  const FLY = 0.45;                                  // seconds of page time a slip flies
  function flySlips() {
    const span = FLY * 1000 * cfg.speed;             // the same, in model ms
    const want = [];
    const recs = model.recs;
    for (let j = recs.length - 1; j >= 0 && want.length < 10; j--) {
      const r = recs[j];
      if (r.at > clock) continue;
      if (clock - r.at > span) break;
      want.push(r);
    }
    while (slips.length > want.length) { const s = slips.pop(); s.g.remove(); freeSlips.push(s.g); }
    while (slips.length < want.length) slips.push({ g: slipEl() });
    want.forEach((r, i) => {
      const u = clamp((clock - r.at) / span);
      const c = G.CLIENT_AT[r.client % G.CLIENT_AT.length];
      const to = cfg.log === "on" ? [G.LOG_TRAY.x + G.LOG_TRAY.w / 2, G.LOG_TRAY.y + G.LOG_TRAY.d / 2, G.DESK_H + 1]
        : [G.cardXs[r.page] + G.CARD.w / 2, G.CARD.y + G.CARD.d / 2, G.DESK_H + 1.5];
      const from = [c[0], c[1], 8];
      const p = [lerp(from[0], to[0], u), lerp(from[1], to[1], u), lerp(from[2], to[2], u) + Math.sin(Math.PI * u) * 3];
      slips[i].p = p;
      slips[i].g.setAttribute("transform", translateAlong(P, p));
    });
    const sorted = [...slips].sort((a, b) => depthOf(a.p, P) - depthOf(b.p, P));
    const kids = [...layer.children];
    if (sorted.some((s, i) => s.g !== kids[i])) sorted.forEach((s) => layer.appendChild(s.g));
  }
  function clearSlips() { while (slips.length) { const s = slips.pop(); s.g.remove(); freeSlips.push(s.g); } }

  // ---------- painting a running database ----------
  function paint() {
    narrate();
    const on = cfg.log === "on", risky = cfg.commit === "async" || cfg.commit === "write";
    const buf = on ? model.lsnTop - model.osLsn : 0, os = on ? model.osLsn - model.diskLsn : 0;
    stack("buf", buf, risky); stack("os", os, risky);
    counters.buffer.setClamped(buf); counters.os.setClamped(os);
    const toReplay = on ? model.diskLsn - model.redoDone : 0;
    shelf(toReplay); counters.replay.setClamped(toReplay);
    for (let p = 0; p < PAGES; p++) {
      const d = model.mem[p] > model.disk[p];
      show(cards[p], true); show(dirty[p], d); setLit(cards[p], d && !on);
    }
    // drawers stay out while the checkpoint writes, and a little after
    const ck = model.ck;
    if (ck && ck.phase === "pages") lastCk = { pages: ck.pages, until: screenT + 0.9 };
    drawers(lastCk && screenT < lastCk.until ? lastCk.pages : []);
    const f = model.flushing;
    fsync.set(f ? clamp((clock - f.start) / (f.end - f.start)) : 0);
    counters.acked.setClamped(model.st.acked);
    counters.ondisk.setClamped(model.onDisk);
    counters.lost.setClamped(lost);
    flySlips();
  }

  // ---------- crash and recovery ----------
  const DOWN = 1.4;                                   // page seconds the machine stays dark before recovery starts
  function crash(kind) {
    if (phase !== "run") return;
    model.runTo(clock);
    crashRes = model.crash(clock, kind);
    lost = crashRes.lost;
    phase = "down"; phaseT = 0;
    clearSlips();
    WB.pose(svg, kind === "power" ? "lever" : "plunger", kind === "power" ? "off" : "down");
    // memory is gone: the log buffer and the pages in memory; the OS cache too on a power cut
    stack("buf", 0, false); counters.buffer.set(0);
    const osLeft = cfg.log === "on" && kind === "process" ? model.osLsn - model.diskLsn : 0;
    // a process crash leaves the OS cache: records there still reach disk, but until then they stay at risk
    stack("os", osLeft, cfg.commit === "async" || cfg.commit === "write"); counters.os.setClamped(osLeft);
    cards.forEach((c) => show(c, false)); dirty.forEach((d) => show(d, false));
    fsync.set(0);
    counters.lost.setClamped(lost);
    const what = kind === "power" ? T("power cut", "corte de energía") : T("process killed", "proceso matado");
    const tail = lost
      ? (({ en, es }) => T(" · " + en, " · " + es))(nOf(lost, "acknowledged commit lost", "acknowledged commits lost", "commit confirmado perdido", "commits confirmados perdidos"))
      : T(" · no acknowledged commit lost", " · ningún commit confirmado perdido");
    say(9, T(what.en + tail.en, what.es + tail.es));
    showStats();
  }
  function recoverStep(dt) {
    phaseT += dt;
    const r = crashRes;
    if (phase === "down") {
      if (phaseT < DOWN) return;
      phase = "replay"; phaseT = 0;
      WB.pose(svg, "lever", "on"); WB.pose(svg, "plunger", "up");
      stack("os", 0, false); counters.os.set(0);
      r.screen = clamp(r.replayMs / (1000 * cfg.speed), 1.2, 10);
      if (cfg.log === "on") {
        if (!r.replay) say(9, T("restart: nothing in the log after the checkpoint to replay", "reinicio: no hay nada en el log después del checkpoint que reproducir"));
        else {
          const rec = nOf(r.replay, "record", "records", "registro", "registros");
          if (!r.redo) say(9, T("restart: no checkpoint yet · replaying " + rec.en + " from the start of the log · " + ms(r.replayMs), "reinicio: todavía sin checkpoint · reproduce " + rec.es + " desde el principio del log · " + ms(r.replayMs)));
          else say(9, T("restart: replaying " + rec.en + " after the checkpoint · " + ms(r.replayMs), "reinicio: reproduce " + rec.es + " después del checkpoint · " + ms(r.replayMs)));
        }
        show(clerk, true);
      } else {
        say(9, T("restart: no log to replay · the pages on disk are all there is", "reinicio: no hay log que reproducir · las páginas en disco son todo lo que queda"));
      }
      return;
    }
    if (phase === "replay") {
      const u = clamp(phaseT / r.screen);
      if (cfg.log === "on") {
        const k = Math.min(G.BOOKS, Math.ceil(r.replay / perBook()));
        shelf(r.replay);
        counters.replay.setClamped(Math.round(r.replay * (1 - u)));
        const x = k ? lerp(G.bookXs[0], G.bookXs[Math.max(0, k - 1)], u) : G.bookXs[0];
        clerk.setAttribute("transform", translateAlong(P, [x, G.CLERK_Y, G.PLINTH_H]));
      }
      if (u < 1) return;
      pages = r.pages;
      show(clerk, false);
      const saved = lost;
      restart(true);
      lost = saved; counters.lost.setClamped(lost);
      say(9, cfg.log === "on"
        ? T("recovered · " + int(r.acked - r.lost) + " of " + int(r.acked) + " acknowledged commits are in the pages", "recuperada · " + int(r.acked - r.lost) + " de " + int(r.acked) + " commits confirmados están en las páginas")
        : T("back up with the pages on disk · " + int(r.acked - r.lost) + " of " + int(r.acked) + " acknowledged commits", "arriba con las páginas en disco · " + int(r.acked - r.lost) + " de " + int(r.acked) + " commits confirmados"));
      showStats();
    }
  }

  // ---------- stats ----------
  function showStats() {
    const s = model.st;
    root.stat("acked", int(s.acked));
    root.stat("risk", int(Math.max(0, s.acked - model.onDisk)));
    const W = Math.min(clock, 200), t0 = clock - W;
    let n = 0;
    for (let j = model.lat.length - 1; j >= 0 && model.lat[j][0] > t0; j--) n++;
    root.stat("rate", W > 20 ? int((1000 * n) / W) : "–");
    root.stat("lat", model.lat.length ? ms(model.lat[model.lat.length - 1][1]) : "–");
    root.stat("flush", cfg.log === "on" && s.fsyncs ? (s.flushed / s.fsyncs).toFixed(1) : "–");
    root.stat("lost", int(lost));
  }

  // ---------- the loop ----------
  let statTimer = 0;
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    screenT += dt;
    if (phase === "run") {
      clock += dt * 1000 * cfg.speed;
      model.runTo(clock);
      paint();
      phaseT += dt;
      while (plan.length && phaseT >= plan[0][1]) crash(plan.shift()[0]);
    } else recoverStep(dt);
    statTimer += dt; if (statTimer > 0.25) { statTimer = 0; if (phase === "run") showStats(); }
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = String(raw);
    if (!quiet) { plan = []; warm = 0; restart(); phaseT = 0; say(9, T("settings applied · run restarted", "ajustes aplicados · ejecución reiniciada")); }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    power: () => { crash("power"); wake(); },
    kill: () => { crash("process"); wake(); },
    reset: () => { plan = []; warm = 0; restart(); phaseT = 0; say(9, T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings, and its crashes ----------
  root.on("watch", (w) => {
    for (const key of ["log", "commit", "ckpt", "clients", "speed"]) set(key, w[key], true);
    // crashes at page seconds after the start; after a crash, the next one counts from the restart. While crashes
    // are still to come, each run starts w.warm model ms in, so the first one lands after a checkpoint and a flush.
    plan = (w.crashes || []).map(([kind, after]) => [kind, after]);
    warm = w.warm || 0;
    restart();
    say(9, T("experiment's settings applied · run restarted", "ajustes del experimento aplicados · ejecución reiniciada"));
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
  say(0, T("clients commit · the log goes to disk before the OK", "los clientes hacen commit · el log va a disco antes del OK"));
}

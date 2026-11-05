// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The key office in the browser: runs the model, flies keys from the office to the desks and slips from the desks to
// the vault, turns the lease dial, lights a paused worker and a key or slip whose lease has run out, and answers the
// controls. mount() gets the build-time data from page.ts (projection, geometry, drawings) and root, the <wb-lesson>.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, setLit, playPause } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { clamp } from "../../lib/stats";
import { makeSim } from "./sim";

export default function mount({ P, G, KEY_SVG, SLIP_SVG, STATUS }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const stat = (key, value) => root.stat(key, value);
  const NS = "http://www.w3.org/2000/svg";
  const fly = q('[data-layer="fly"]');
  const hookKey = q("[data-hook-key]"), fencePanel = q("[data-fence]");
  const flashOn = q('[data-flash="on"]'), flashOff = q('[data-flash="off"]');
  const desks = [0, 1, 2].map((i) => {
    const key = q('[data-desk-key="' + i + '"]');
    return { key, tag: key.querySelector("[data-tag]"), tagText: key.querySelector("[data-tag-text]"), plate: q('[data-status-plate="' + i + '"]'), status: q('[data-status="' + i + '"]'), shown: {} };
  });
  const ttlDial = WB.dial(svg, "ttl", P);
  const counters = Object.fromEntries(["token", "two", "version", "over", "rejected", "seen"].map((n) => [n, WB.counter(svg, n, P)]));
  const NAME = "ABC";
  const LINGER = 0.5;

  // ---------- flying keys and slips: pooled elements ----------
  const pools = { key: [], slip: [] }, recs = new Map();
  function makeEl(kind) {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = kind === "key" ? KEY_SVG : SLIP_SVG;
    const lit = g.querySelector(kind === "key" ? "[data-tag]" : "[data-slip]");
    const txt = g.querySelector(kind === "key" ? "[data-tag-text]" : "[data-slip-text]");
    return { g, kind, lit, txt, label: null, on: null };
  }
  function dress(el, label, lit) {
    if (el.label !== label) { el.label = label; setText(el.txt, label); }
    if (el.on !== lit) { el.on = lit; setLit(el.lit, lit); }
  }
  const arc = (a, b, u, h) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u) + h * 4 * u * (1 - u)];

  // ---------- settings and the run ----------
  const cfg = { pauses: "long", ttl: "10", check: "off", fence: "off", crashes: "off", speed: 1 };
  let model, clock, logAt, from, seed = 5, flashAt = -9, stage2 = null;

  function restart() {
    for (const r of recs.values()) { r.el.g.remove(); pools[r.el.kind].push(r.el); }
    recs.clear();
    model = makeSim({ pauses: cfg.pauses, ttl: Number(cfg.ttl), check: cfg.check === "on", fence: cfg.fence, crashes: cfg.crashes === "on" }, seed);
    seed = (seed * 7 + 3) % 9973 + 1;
    clock = 0; logAt = 0; from = 0; flashAt = -9; held = null; saidAt = -9; saidRank = 0; stage2 = null;
    show(fencePanel, cfg.fence !== "off");
    paint();
    showStats();
  }

  // ---------- narration: the model's log ----------
  let held = null, saidAt = -9, saidRank = 0;
  function say(rank, text) {
    // a message stays up at least 1.4 s of page time unless a more important one comes; a less important one waits
    const wall = performance.now() / 1000;
    if (rank < saidRank && wall - saidAt < 1.4) { held = { rank, text }; return; }
    held = null; saidRank = rank; saidAt = wall;
    root.figure.say(L(text));
  }
  function sayHeld() {
    if (held && performance.now() / 1000 - saidAt >= 1.4) { const h = held; held = null; saidRank = -1; say(h.rank, h.text); }
  }
  function narrate() {
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt];
      if (e.t > clock) break;
      const w = e.w ? NAME[e.w.i] : "", k = "#" + e.token;
      switch (e.type) {
        case "grant": say(1, T("key " + k + " to " + w, "llave " + k + " para " + w)); break;
        case "two": say(4, T("lease #" + e.old.token + " ran out · key " + k + " to " + w + " · " + NAME[e.old.i] + " still paused", "venció el #" + e.old.token + " · llave " + k + " para " + w + " · " + NAME[e.old.i] + " sigue en pausa")); break;
        case "pause":
          if (e.staged) say(3, T(w + " frozen right after its check · lease #" + e.w.token + " running out", w + " congelado justo después de verificar · el #" + e.w.token + " se agota"));
          else if (e.holding && e.d > 2) say(3, T(w + " paused (a long GC) · lease #" + e.w.token + " running out", w + " en pausa (un GC largo) · el #" + e.w.token + " se agota"));
          break;
        case "wake":
          if (e.w.heldToken && !e.holding) say(3, T(w + " wakes · still thinks it holds #" + e.w.heldToken, w + " despierta · cree que sigue con el #" + e.w.heldToken));
          break;
        case "landed": say(0, e.stale ? T(w + "'s late write " + k + " landed · nobody else had written", "la escritura tardía " + k + " de " + w + " entró · nadie más había escrito") : T(w + " wrote v" + e.version + " with " + k, w + " escribió la v" + e.version + " con " + k)); break;
        case "over": flashAt = e.t; say(5, T(w + " wrote " + k + " from v" + e.read + ", vault at v" + e.version + " · an update lost", w + " escribió " + k + " desde v" + e.read + ", la bóveda va en v" + e.version + " · se perdió una actualización")); break;
        case "refused": case "readRefused": say(5, T("vault refuses " + k + " from " + w + " · it has seen #" + e.seen, "la bóveda rechaza el " + k + " de " + w + " · ya vio el #" + e.seen)); break;
        case "stopped": say(4, T(w + " checks: lease " + k + " ran out · job dropped", w + " verifica: venció el " + k + " · deja la tarea")); break;
        case "crash": say(4, T(w + " crashed holding " + k + " · the key waits for the lease to run out", w + " se cayó con el " + k + " · la llave espera a que venza")); break;
        case "expire": if (e.crashed) say(3, T("lease " + k + " ran out · " + w + " never handed it in", "venció el " + k + " · " + w + " nunca la devolvió")); break;
        case "up": say(1, T(w + " is back", w + " volvió")); break;
      }
    }
    if (logAt > 3000) { model.log.splice(0, logAt); logAt = 0; }
  }

  // ---------- where a message is ----------
  function active(m, now) {
    // seconds of sending done by now: the upload stops while its worker is paused
    let t = now - m.sent;
    for (const [a, b] of m.stops) t -= Math.max(0, Math.min(b, now) - Math.max(a, m.sent));
    return t;
  }
  function placeMsg(m, now) {
    const i = m.w, desk = G.SLIP_SPOT[i];
    if (m.kind === "key") return { p: arc(G.KEY_OUT, G.KEY_SPOT[i], clamp((now - m.sent) / (m.done - m.sent)), 16), fade: 1 };
    if (m.kind === "read") {
      if (now < m.land) return { p: arc(desk, G.SLOT_AT, clamp((now - m.sent) / (m.land - m.sent)), 14), fade: 1 };
      if (m.fate === "refused") return toTray(m, now);
      return { p: arc(G.SLOT_AT, desk, clamp((now - m.land) / (m.done - m.land)), 14), fade: 1 };
    }
    // a write
    if (m.fate === "lost") return { p: arc(desk, G.SLOT_AT, clamp(active(m, m.lostAt) / m.U), 14), fade: clamp(1 - (now - m.lostAt) / 0.6) };
    if (m.land === null || now < m.land) return { p: arc(desk, G.SLOT_AT, clamp(active(m, now) / m.U) * (m.land === null ? 0.98 : 1), 14), fade: 1 };
    if (m.fate === "refused") return toTray(m, now);
    return { p: G.SLOT_AT, fade: clamp(1 - (now - m.land) / 0.25) };
  }
  function toTray(m, now) {
    const u = clamp((now - m.land) / 0.5);
    return { p: arc(G.SLOT_AT, G.TRAY_SPOT, u, 6), fade: now - m.land > 1.5 ? clamp(1 - (now - m.land - 1.5) / 0.5) : 1 };
  }
  function msgEnd(m) {
    if (m.kind === "key") return m.done;
    if (m.fate === "refused") return m.land + 2;
    if (m.kind === "read") return m.done ?? Infinity;
    if (m.fate === "lost") return m.lostAt + 0.6;
    return m.land === null ? Infinity : m.land + 0.25;
  }

  // ---------- painting ----------
  function paint() {
    narrate();
    sayHeld();
    const lease = model.lock.lease;
    // keys and slips in the air
    const msgs = model.msgs;
    while (from < msgs.length && msgEnd(msgs[from]) + LINGER < clock) {
      const m = msgs[from];
      if (recs.has(m)) { const x = recs.get(m); x.el.g.remove(); pools[x.el.kind].push(x.el); recs.delete(m); }
      from++;
    }
    if (from > 500) { msgs.splice(0, from); from = 0; }
    const live = [];
    for (let j = from; j < msgs.length; j++) {
      const m = msgs[j];
      if (m.sent > clock) continue;
      let x = recs.get(m);
      const gone = msgEnd(m) < clock;
      if (gone) { if (x) { x.el.g.remove(); pools[x.el.kind].push(x.el); recs.delete(m); } continue; }
      const kind = m.kind === "key" ? "key" : "slip";
      if (!x) { x = { el: pools[kind].pop() || makeEl(kind) }; recs.set(m, x); fly.appendChild(x.el.g); }
      const { p, fade } = placeMsg(m, clock);
      // lit: a slip whose lease has run out (as it stands now, or as it stood when the slip landed)
      const stale = m.land !== null && m.land <= clock ? !!m.stale : !lease || lease.token !== m.token;
      dress(x.el, "#" + m.token % 1000, kind === "slip" ? stale : false);
      x.el.g.style.opacity = fade < 1 ? String(fade) : "";
      x.pos = p;
      x.el.g.setAttribute("transform", translateAlong(P, p));
      live.push(x);
    }
    const sorted = live.sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P));
    const kids = [...fly.children];
    if (sorted.some((x, n) => x.el.g !== kids[n])) sorted.forEach((x) => fly.appendChild(x.el.g));

    // the desks: the worker's pose, its status, and the key it believes it holds
    model.workers.forEach((w, i) => {
      const d = desks[i], s = d.shown;
      const isPaused = w.pausedUntil > clock && !w.down;
      const pose = w.down ? "down" : isPaused ? "paused" : "run";
      if (s.pose !== pose) { s.pose = pose; WB.pose(svg, "worker-" + i, pose); }
      const st = w.down ? "down" : isPaused ? "paused" : STATUS_OF[w.phase] || "idle";
      if (s.st !== st) { s.st = st; setText(d.status, L(STATUS[st])); setLit(d.plate, st === "paused"); }
      const hasKey = !!w.heldToken && w.phase !== "key" && !w.down;
      if (s.key !== hasKey) { s.key = hasKey; show(d.key, hasKey); }
      if (hasKey) {
        const label = "#" + w.heldToken % 1000;
        if (s.label !== label) { s.label = label; setText(d.tagText, label); }
        const stale = !lease || lease.token !== w.heldToken;
        if (s.stale !== stale) { s.stale = stale; setLit(d.tag, stale); }
      }
    });
    show(hookKey, !lease);
    ttlDial.set(lease ? clamp((lease.expires - clock) / Number(cfg.ttl)) : 0);
    const flash = clock - flashAt < 1.2;
    show(flashOn, flash); show(flashOff, !flash);
    counters.token.set(model.lock.last % 1000);
    counters.two.setClamped(model.lock.two);
    counters.version.set(model.vault.version % 1000);
    counters.over.setClamped(model.vault.over);
    counters.rejected.setClamped(model.vault.rejected);
    counters.seen.set(model.vault.seen % 1000);
  }
  const STATUS_OF = { rest: "idle", want: "waits", key: "reads", readWait: "reads", readReply: "reads", work: "works", upload: "writes", writeReply: "writes" };

  // ---------- stats ----------
  function showStats() {
    const l = model.lock, idle = l.idle + (l.lease && l.lease.crashAt !== null ? clock - l.lease.crashAt : 0);
    stat("version", model.vault.version);
    stat("over", model.vault.over);
    stat("rejected", model.vault.rejected);
    stat("stopped", model.st.stopped);
    stat("two", l.two);
    stat("idle", Math.round(idle) + " s");
  }

  // ---------- the loop ----------
  let statTimer = 0;
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    clock += dt * cfg.speed;
    if (stage2 && clock >= stage2.at) { const s = stage2; stage2 = null; s.run(); }
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
  function freeze(extra) {
    const w = model.freezeAtWrite(extra);
    if (w) say(6, T(NAME[w.i] + " will freeze right after its next check", NAME[w.i] + " se congelará justo después de su próxima verificación"));
  }
  function crashNow() {
    const w = model.crashHolder();
    if (!w) say(6, T("nobody holds the key right now · try again", "nadie tiene la llave ahora · prueba de nuevo"));
    paint(); showStats();
  }
  const actions = {
    freeze: () => { freeze(3); wake(); },
    crash: () => { crashNow(); wake(); },
    reset: () => { restart(); say(9, T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings, and the moment it's about ----------
  root.on("watch", (w) => {
    for (const key of ["pauses", "ttl", "check", "fence", "crashes"]) set(key, w[key], true);
    restart();
    if (w.stage === "freeze") freeze(w.extra ?? 3);
    if (w.stage === "crash") stage2 = { at: 1.2, run: crashNow };
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

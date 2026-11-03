// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The order depot in the browser: runs the page-load model a frame at a time, moves the handshake tokens, order
// slips and packets along their tracks, stacks packets that wait behind a gap, fills the page tray and answers the
// controls. mount() gets the build-time data from page.ts (projection, geometry, drawings) and root, the <wb-lesson>.
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { playPause, show } from "../../runtime/dom";
import { makeLoad, loadOnce, SLOW_FILE } from "./sim";

export default function mount({ P, G, PACKET_SVG, CARD_SVG }, root) {
  const MS_PER_S = 100;            // model milliseconds per real second at ×1
  const HOLD = 3.2;                // real seconds a finished page stays before the next load
  const NOTE = 2.2;                // real seconds a note stays in the readout
  const NS = "http://www.w3.org/2000/svg";

  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const stat = (key, value) => root.stat(key, value);
  const tracks = Array.from({ length: 18 }, (_, c) => q('[data-track="' + c + '"]'));
  const rails = Array.from({ length: 18 }, (_, c) => q('[data-rail="' + c + '"]'));
  const slips = [...svg.querySelectorAll("[data-slip]")];
  const tiles = G.TILES.map((_, i) => { const g = q('[data-tile="' + i + '"]'); return { g, part: g.querySelector("[data-part]"), full: g.querySelector("[data-full]"), state: "" }; });
  const lampOn = q('[data-slow-lamp="on"]'), lampOff = q('[data-slow-lamp="off"]');
  const counters = Object.fromEntries(["loaded", "waiting", "ms", "handshakes", "resent"].map((n) => [n, WB.counter(svg, n, P)]));
  const linkMeter = WB.meter(svg, "link", P);
  const trackY = (c) => G.BEDS_Y[G.BED_OF[c % 6]] + G.TRACK_OFF[Math.floor(c / 6)];
  const X_IN = G.LX0 + 2.6, X_OUT = G.LX1 - 3;       // where packets stop at the browser / leave the warehouse

  // ---------- pooled drawings: packets and cards (order slips, handshake tokens) ----------
  const freePk = [], freeCd = [];
  function makePacket() {
    const g = document.createElementNS(NS, "g"); g.innerHTML = PACKET_SVG;
    return { g, body: g.querySelector("[data-body]"), band: g.querySelector("[data-band]"), lit: false, banded: false };
  }
  function makeCard() {
    const g = document.createElementNS(NS, "g"); g.innerHTML = CARD_SVG;
    return { g, body: g.querySelector("[data-body]"), word: g.querySelector("[data-word]"), lit: false, text: "GET" };
  }
  const setLitEl = (el, lit) => { if (el.lit !== lit) { el.lit = lit; el.body.toggleAttribute("data-lit", lit); el.body.toggleAttribute("data-lit-fill", lit); if (el.word) el.word.setAttribute("data-tone", lit ? "on-lit" : "hi"); } };
  const pkEls = new Map(), cdEls = new Map();
  function packetEl(pkt) {
    let el = pkEls.get(pkt);
    if (!el) { el = freePk.pop() || makePacket(); tracks[pkt.conn].appendChild(el.g); el.g.style.display = ""; pkEls.set(pkt, el); }
    el.seen = true;
    return el;
  }
  function cardEl(key, c) {
    let el = cdEls.get(key);
    if (!el) { el = freeCd.pop() || makeCard(); tracks[c].appendChild(el.g); el.g.style.display = ""; cdEls.set(key, el); }
    el.seen = true;
    return el;
  }
  const put = (el, x, y, z, opacity = 1) => { el.g.setAttribute("transform", translateAlong(P, [x, y, z])); const o = opacity >= 1 ? "" : String(Math.max(0, opacity)); if (el.g.style.opacity !== o) el.g.style.opacity = o; };

  // ---------- the run ----------
  const cfg = { proto: "h1", files: 40, rtt: 100, mbps: 10, loss: 0, conns: 6, slow: 0, speed: 1 };
  let sim, clock, seed = 101, logAt, notes, note, noteUntil, heldUntil, finished, other, linkAt, linkShown, realT;

  function restart(newSeed = true) {
    if (newSeed) seed += 7;
    sim = makeLoad(cfg, seed);
    clock = 0; logAt = 0; notes = []; note = null; noteUntil = 0; heldUntil = 0; finished = false; other = null; linkAt = 0; linkShown = 0;
    for (const el of pkEls.values()) { el.g.style.display = "none"; freePk.push(el); }
    for (const el of cdEls.values()) { el.g.style.display = "none"; freeCd.push(el); }
    pkEls.clear(); cdEls.clear();
    rails.forEach((r) => show(r, false));
    tiles.forEach((tl, i) => { show(tl.g, i < cfg.files); tl.state = ""; show(tl.part, false); show(tl.full, false); });
    paint(true);
  }

  const name = () => (cfg.proto === "h2" ? "HTTP/2" : "HTTP/1.1");
  function setNote(text) { note = text; noteUntil = realT + NOTE; }

  // What happened since the last frame, for the readout.
  function narrate() {
    for (; logAt < sim.log.length; logAt++) notes.push(sim.log[logAt]);
    const due = notes.filter((e) => e.t <= clock).sort((a, b) => a.t - b.t);
    if (!due.length) return;
    notes = notes.filter((e) => e.t > clock);
    let opened = 0;
    for (const e of due) {
      if (e.type === "open" && e.c > 0) opened++;
      else if (e.type === "think") setNote(cfg.proto === "h2"
        ? T("file 3 is slow · the server takes 1 s · the other streams keep coming", "el archivo 3 es lento · al servidor le toma 1 s · los otros flujos siguen llegando")
        : T("file 3 is slow · the server takes 1 s · its connection waits with it", "el archivo 3 es lento · al servidor le toma 1 s · su conexión espera con él"));
      else if (e.type === "lost") setNote(T("a packet of file " + (e.pkt.file + 1) + " fell off · what's behind it on that track will wait", "un paquete del archivo " + (e.pkt.file + 1) + " se cayó · lo que viene detrás en esa pista va a esperar"));
      else if (e.type === "resend") {
        const n = sim.conns[e.pkt.conn].held.size;
        setNote(T("file " + (e.pkt.file + 1) + "'s packet sent again · " + n + " packet" + (n === 1 ? "" : "s") + " waiting behind the gap",
          "el paquete del archivo " + (e.pkt.file + 1) + " se reenvía · " + n + " paquete" + (n === 1 ? "" : "s") + " esperando detrás del hueco"));
      } else if (e.type === "loaded") {
        finished = true; heldUntil = realT + HOLD;
        if (!other) other = loadOnce({ ...cfg, proto: cfg.proto === "h2" ? "h1" : "h2" }, seed).load;
        const otherName = cfg.proto === "h2" ? "HTTP/1.1" + (cfg.conns !== 6 ? " (" + cfg.conns + ")" : "") : "HTTP/2";
        setNote(T("page loaded in " + Math.round(sim.st.loadTime) + " ms · the same page over " + otherName + ": " + Math.round(other) + " ms",
          "página cargada en " + Math.round(sim.st.loadTime) + " ms · la misma página con " + otherName + ": " + Math.round(other) + " ms"));
        noteUntil = heldUntil;
      }
    }
    if (opened) setNote(T(opened + " new connection" + (opened === 1 ? "" : "s") + " open · each paid 2 round trips of handshakes", opened + " conexi" + (opened === 1 ? "ón nueva abierta" : "ones nuevas abiertas") + " · cada una pagó 2 viajes de ida y vuelta de handshakes"));
  }

  function paint(snap) {
    const rtt = cfg.rtt, half = rtt / 2, files = sim.files, conns = sim.conns;
    // packets
    for (const el of pkEls.values()) el.seen = false;
    const queuedOn = new Map(), heldOn = new Map();
    const fade = Math.max(6, half * 0.25);
    for (const pkt of sim.packets) {
      if (pkt.queued > clock) break;
      const y = trackY(pkt.conn);
      if (clock < pkt.depart) {
        const k = queuedOn.get(pkt.conn) || 0; queuedOn.set(pkt.conn, k + 1);
        if (k >= 7) continue;
        const el = packetEl(pkt); setLitEl(el, false); put(el, X_OUT, y, G.BED_H + k * G.BOX.h);
        dress(el, pkt); continue;
      }
      const u = (clock - pkt.depart) / half;
      if (pkt.lost) {
        if (u < 0.5) { const el = packetEl(pkt); setLitEl(el, false); dress(el, pkt); put(el, X_OUT + (X_IN - X_OUT) * u, y, G.BED_H); continue; }
        const f = (u - 0.5) / 0.5;
        if (f >= 1) continue;
        const el = packetEl(pkt); setLitEl(el, true); dress(el, pkt);
        put(el, X_OUT + (X_IN - X_OUT) * 0.5, y, G.BED_H - 16 * f * f, 1 - f);
        continue;
      }
      if (u < 1) { const el = packetEl(pkt); setLitEl(el, false); dress(el, pkt); put(el, X_OUT + (X_IN - X_OUT) * u, y, G.BED_H); continue; }
      if (pkt.delivered >= 0 && pkt.delivered <= clock) {
        const f = (clock - pkt.delivered) / fade;
        if (f >= 1) continue;
        const el = packetEl(pkt); setLitEl(el, false); dress(el, pkt); put(el, X_IN, y, G.BED_H, 1 - f);
        continue;
      }
      // arrived, but waiting behind a gap: stack in a column at the browser's end
      const k = heldOn.get(pkt.conn) || 0; heldOn.set(pkt.conn, k + 1);
      if (k >= 12) continue;
      const el = packetEl(pkt); setLitEl(el, true); dress(el, pkt); put(el, X_IN, y, G.BED_H + k * G.BOX.h);
    }
    for (const [pkt, el] of pkEls) if (!el.seen) { el.g.style.display = "none"; el.g.remove(); freePk.push(el); pkEls.delete(pkt); }

    // cards: handshake tokens, order slips, and a slip waiting while the server works on the slow file
    for (const el of cdEls.values()) el.seen = false;
    for (const c of conns) {
      if (c.readyAt <= 0 || clock >= c.readyAt) continue;
      const leg = Math.min(3, Math.floor(clock / half)), u = clock / half - leg;
      const x = leg % 2 === 0 ? X_IN + 4 + (X_OUT - 4 - X_IN - 4) * u : X_OUT - 4 - (X_OUT - 4 - X_IN - 4) * u;
      const el = cardEl("hs" + c.id, c.id); word(el, leg < 2 ? "TCP" : "TLS"); setLitEl(el, false); put(el, x, trackY(c.id), G.BED_H);
    }
    const shown = new Set();
    let thinking = false;
    for (const f of files) {
      if (f.requested < 0 || clock < f.requested) continue;
      const tIn = f.requested + half;
      if (clock < tIn) {
        const key = "rq" + f.conn + ":" + f.requested;
        if (shown.has(key)) continue;
        shown.add(key);
        const el = cardEl(key, f.conn); word(el, "GET"); setLitEl(el, false);
        put(el, X_IN + 4 + (X_OUT - 4 - X_IN - 4) * ((clock - f.requested) / half), trackY(f.conn), G.BED_H);
      } else if (f.think > 0 && clock < tIn + f.think) {
        thinking = true;
        const el = cardEl("think", f.conn); word(el, "GET"); setLitEl(el, true);
        put(el, X_OUT - 11, trackY(f.conn), G.BED_H);
      }
    }
    for (const [key, el] of cdEls) if (!el.seen) { el.g.style.display = "none"; el.g.remove(); freeCd.push(el); cdEls.delete(key); }
    show(lampOn, thinking); show(lampOff, !thinking);

    // rails, slips, tiles
    conns.forEach((c) => show(rails[c.id], c.open));
    const waiting = sim.waiting, per = Math.max(1, cfg.files / G.SLIPS.n);
    slips.forEach((s, i) => show(s, i < Math.ceil(waiting / per)));
    for (const f of files) {
      const tl = tiles[f.id]; if (!tl) continue;
      const state = f.done >= 0 ? "full" : f.got > 0 ? "part" : "";
      if (tl.state !== state) { tl.state = state; show(tl.part, state === "part"); show(tl.full, state === "full"); }
    }

    // link meter: how much of the last stretch the link spent sending
    const W = Math.max(30, rtt * 0.5), tx = sim.tx, P2 = sim.packets;
    while (linkAt < P2.length && P2[linkAt].depart < clock - W) linkAt++;
    let busy = 0;
    for (let i = linkAt; i < P2.length && P2[i].depart - tx < clock; i++) busy += Math.max(0, Math.min(clock, P2[i].depart) - Math.max(clock - W, P2[i].depart - tx));
    const target = Math.min(1, busy / W);
    linkShown = snap ? target : linkShown + (target - linkShown) * 0.2;
    linkMeter.set(linkShown);

    // counters, stats, readout
    const done = sim.st.done, elapsed = sim.st.loadTime >= 0 ? sim.st.loadTime : clock, opened = conns.filter((c) => c.open).length;
    counters.loaded.setClamped(done); counters.waiting.setClamped(waiting); counters.ms.setClamped(Math.round(elapsed));
    counters.handshakes.setClamped(opened); counters.resent.setClamped(sim.st.resent);
    stat("load", Math.round(elapsed) + " ms" + (sim.st.loadTime >= 0 ? "" : " …"));
    stat("loaded", done + " / " + cfg.files);
    stat("handshakes", opened);
    stat("waiting", waiting);
    stat("resent", sim.st.resent);
    stat("held", sim.st.held);
  }
  function dress(el, pkt) { const b = pkt.file % 2 === 1; if (el.banded !== b) { el.banded = b; show(el.band, b); } }
  function word(el, text) { if (el.text !== text) { el.text = text; el.word.textContent = text; } }

  function readout() {
    if (note && realT < noteUntil) { say(L(note)); return; }
    const conns = cfg.proto === "h2" ? 1 : Math.min(cfg.conns, cfg.files);
    say(L(T(name() + " · " + conns + " connection" + (conns === 1 ? "" : "s") + " · " + sim.st.done + " of " + cfg.files + " files · " + Math.round(clock) + " ms",
      name() + " · " + conns + " conexi" + (conns === 1 ? "ón" : "ones") + " · " + sim.st.done + " de " + cfg.files + " archivos · " + Math.round(clock) + " ms")));
  }

  realT = 0;
  function step(dt) {
    realT += dt;
    if (finished && realT >= heldUntil) { restart(); return; }
    if (!finished || clock < sim.st.loadTime + cfg.rtt) clock += dt * MS_PER_S * cfg.speed;
    sim.runTo(clock);
    narrate();
    paint(false);
    readout();
  }

  // ---------- controls ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage, step, onPause: pause.onPause });
  pause.bind(loop);
  const NUMERIC = ["files", "rtt", "mbps", "loss", "conns", "slow", "speed"];
  function set(nameOf, raw, quiet) {
    root.press(nameOf, raw);
    cfg[nameOf] = NUMERIC.includes(nameOf) ? Number(raw) : raw;
    if (nameOf === "speed" || quiet) return;
    restart(false);
    setNote(T("settings applied · a new load starts", "ajustes aplicados · empieza una carga nueva"));
  }
  root.on("change", (n, value) => set(n, value));
  const actions = {
    drop: () => {
      if (finished) restart();
      sim.drop();
      setNote(T("the next packet the warehouse sends will fall off", "el próximo paquete que envíe el almacén se va a caer"));
      if (loop.paused) loop.setPaused(false);
    },
    reset: () => { restart(); setNote(T("loading the page again", "cargando la página de nuevo")); },
  };
  root.on("action", (n) => actions[n]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const k of ["proto", "files", "rtt", "mbps", "loss", "conns", "slow"]) set(k, String(w[k]), true);
    restart();
    setNote(T("watching: " + name() + " · " + w.files + " files · " + w.rtt + " ms · " + w.mbps + " Mbps", "observando: " + name() + " · " + w.files + " archivos · " + w.rtt + " ms · " + w.mbps + " Mbps"));
    if (loop.paused) loop.setPaused(false);
  });

  loop.setPaused(loop.paused);
  restart(false);
  // A still frame (reduced motion) shows a load in progress rather than an empty depot.
  if (loop.paused) { clock = 0.45 * loadOnce(cfg, seed).load; sim.runTo(clock); narrate(); paint(true); }
  readout();
}

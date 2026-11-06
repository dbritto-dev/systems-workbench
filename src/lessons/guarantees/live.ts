// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The mail-order room in the browser: runs the model, moves envelopes from the sender to the queue's rack and from the
// rack to the desks, flies letters to the mail service and slips to the ledger, turns each desk's visibility dial, and
// answers the controls. mount() gets the build-time data from page.ts (projection, geometry, drawings) and root.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, setLit, playPause } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { clamp } from "../../lib/stats";
import { makeSim } from "./sim";

export default function mount({ P, G, ENV_SVG, LETTER_SVG, SLIP_SVG, STATUS }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const stat = (key, value) => root.stat(key, value);
  const NS = "http://www.w3.org/2000/svg";
  const layers = Object.fromEntries(["rack", "desk", "sent", "fly"].map((n) => [n, q('[data-layer="' + n + '"]')]));
  const desks = [0, 1, 2].map((i) => ({ plate: q('[data-status-plate="' + i + '"]'), status: q('[data-status="' + i + '"]'), dial: WB.dial(svg, "vt" + i, P), shown: {} }));
  const counters = Object.fromEntries(["waiting", "again", "lost", "resent", "orders", "ledger2", "seen", "letters", "letters2", "dropped"].map((n) => [n, WB.counter(svg, n, P)]));
  const plaques = { dedupe: [...svg.querySelectorAll("[data-dedupe-plaque]")], key: [...svg.querySelectorAll("[data-key-plaque]")], ack: [...svg.querySelectorAll("[data-ack-plaque]")] };
  const flash = { ledger: [q('[data-flash-ledger="on"]'), q('[data-flash-ledger="off"]')], mail: [q('[data-flash-mail="on"]'), q('[data-flash-mail="off"]')] };
  const NAME = "ABC";
  const DESK_TOP = (i) => [G.ENV_SPOT[i][0], G.ENV_SPOT[i][1], G.ENV_SPOT[i][2]];
  const SENT_AT = (j) => [G.SENT_X[j], G.SENT_Y, G.PO_H];
  const arc = (a, b, u, h) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u) + h * 4 * u * (1 - u)];

  // ---------- sprites: pooled elements for envelopes, letters and slips ----------
  const pools = { env: [], letter: [], slip: [] };
  function makeEl(kind) {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = kind === "env" ? ENV_SVG : kind === "letter" ? LETTER_SVG : SLIP_SVG;
    const pick = (s) => g.querySelector(s);
    if (kind === "env") return { g, kind, lit: pick("[data-env]"), a: pick("[data-env-o]"), b: pick("[data-env-m]"), s: {} };
    if (kind === "letter") return { g, kind, lit: pick("[data-letter]"), a: pick("[data-letter-text]"), s: {} };
    return { g, kind, lit: pick("[data-slip]"), a: pick("[data-slip-text]"), s: {} };
  }
  function dress(el, a, b, lit, hidden = false) {
    const s = el.s;
    if (s.a !== a) { s.a = a; setText(el.a, a); }
    if (el.b && s.b !== b) { s.b = b; setText(el.b, b); }
    if (s.lit !== lit) { s.lit = lit; setLit(el.lit, lit); }
    if (s.hidden !== hidden) { s.hidden = hidden; el.g.setAttribute("opacity", hidden ? "0.38" : "1"); }
  }
  const sprites = new Map();   // key -> { kind, el, pos, mid, layer, leaving, until }
  function drop(key) { const sp = sprites.get(key); sp.el.g.remove(); pools[sp.kind].push(sp.el); sprites.delete(key); }

  // ---------- settings and the run ----------
  const cfg = { ack: "after", vt: "10", crash: "0.1", lost: "0", dedupe: "off", key: "plain", speed: 1 };
  let model, clock, logAt, seed = 5, sent, dropped, replies, flashAt, stages, held, saidAt, saidRank, quietSince, jump;
  const WARM = 24;
  const wallNow = () => performance.now() / 1000;

  function modelCfg() {
    return { ack: cfg.ack, vt: cfg.vt === "60" ? 60 : 10, heartbeat: cfg.vt === "hb", crash: Number(cfg.crash), lostAck: Number(cfg.lost), dedupe: cfg.dedupe, key: cfg.key === "key" };
  }
  // A run opens with an incident already under way: a slow order (14 s of work) received 8 s before the first frame, so
  // with the 10 s timeout its envelope is handed out a second time 2 s in, and the order is written twice by 18 s.
  // A Watch passes its own warm-up step instead (or none).
  const incident = (m, warm) => { m.runTo(warm - 8); m.slowOrder(14); };
  function restart(warm = WARM, pre = incident) {
    for (const key of [...sprites.keys()]) drop(key);
    model = makeSim(modelCfg(), seed);
    seed = (seed * 7 + 3) % 9973 + 1;
    clock = warm; logAt = 0; sent = []; dropped = []; replies = []; flashAt = { ledger: -9, mail: -9 }; stages = [];
    held = null; saidAt = -9; saidRank = 0; quietSince = 0; jump = null;
    if (pre) pre(model, warm);
    model.runTo(clock);
    narrate(true);
    plaques.dedupe.forEach((g) => show(g, g.getAttribute("data-dedupe-plaque") === cfg.dedupe));
    plaques.key.forEach((g) => show(g, g.getAttribute("data-key-plaque") === (cfg.key === "key" ? "on" : "off")));
    plaques.ack.forEach((g) => show(g, g.getAttribute("data-ack-plaque") === cfg.ack));
    paint(0, true);
    showStats();
  }

  // ---------- narration: the model's log ----------
  function say(rank, text) {
    // a message stays up at least 1.6 s of page time unless a more important one comes; a less important one waits
    const wall = performance.now() / 1000;
    if (rank < saidRank && wall - saidAt < 1.6) { if (!held || rank >= held.rank) held = { rank, text }; return; }
    held = null; saidRank = rank; saidAt = wall; quietSince = wall;
    root.figure.say(L(text));
  }
  function sayHeld() {
    const wall = performance.now() / 1000;
    if (held && wall - saidAt >= 1.6) { const h = held; held = null; saidRank = -1; say(h.rank, h.text); }
    else if (!held && wall - quietSince > 3.2) { saidRank = -1; say(-1, summary()); }
  }
  function summary() {
    const busy = model.workers.filter((w) => w.att).length, down = model.workers.filter((w) => w.downUntil > clock).length;
    const n = model.visible.length;
    return T(n + " waiting · " + busy + " of 3 workers busy" + (down ? " · " + down + " down" : ""), n + " en espera · " + busy + " de 3 trabajadores ocupados" + (down ? " · " + down + (down > 1 ? " caídos" : " caído") : ""));
  }
  function narrate(quiet = false) {
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt];
      if (e.t > clock) break;
      const o = e.m ? e.m.o : e.o, id = o ? "#" + o.id : "", w = e.w ? NAME[e.w.i] : "", mid = e.m ? "m" + e.m.mid : "";
      if (e.type === "stored") replies.push({ t: e.t, lose: e.lose, id });
      if (e.type === "letter") { sent.push({ key: "S" + e.t.toFixed(4) + o.id, id, dup: e.n >= 2 }); if (sent.length > G.SENT) sent.shift(); if (e.n >= 2 && !quiet) flashAt.mail = wallNow(); }
      if (e.type === "dropped") { dropped.push({ key: "T" + e.t.toFixed(4) + o.id, id }); if (dropped.length > 3) dropped.shift(); }
      if (e.type === "ledger" && e.n >= 2 && !quiet) flashAt.ledger = wallNow();
      if (quiet) continue;
      switch (e.type) {
        case "receive":
          if (e.skip) break;
          if (e.copy) {
            // a second message for the same order (the sender resent it) is a copy with its own id, not the same one again
            const other = model.workers.find((x) => x.att && x !== e.w && x.att.o === o);
            const resent = e.m.resent && e.m.receives === 1;
            const what = resent ? T(w + " receives " + id + "'s resent copy (" + mid + ")", w + " recibe la copia reenviada de " + id + " (" + mid + ")")
              : T(w + " receives " + id + " (" + mid + ") again", w + " recibe " + id + " (" + mid + ") de nuevo");
            say(3, other ? T(what.en + " · " + NAME[other.i] + " is still working on it", what.es + " · " + NAME[other.i] + " sigue trabajando en él") : what);
          } else say(0, T(w + " takes " + id + " from the front of the line", w + " toma " + id + " del frente de la fila"));
          break;
        case "shown":
          // the worker that still has it when the timeout ran out (the message's holder changes once someone takes it again)
          if (e.held) say(4, T(id + ": timeout ran out while " + NAME[e.holder] + " still works on it · back in line", id + ": venció su tiempo mientras " + NAME[e.holder] + " sigue con él · vuelve a la fila"));
          else say(3, T(id + ": timeout ran out · back at the front of the line", id + ": venció su tiempo · vuelve al frente de la fila"));
          break;
        case "crash": {
          const after = { letter: T(" after mailing " + id + "'s letter", " después de enviar la carta de " + id), ledger: T(" after writing " + id, " después de escribir " + id), work: T(" after the work on " + id, " después del trabajo de " + id), ack: T(" right after acking " + id, " justo después del ack de " + id) }[e.after];
          const rest = cfg.ack === "first" ? T("", "") : T(" · the envelope waits hidden for its timeout", " · el sobre espera oculto a que venza su tiempo");
          say(5, T(w + " crashed" + (after ? after.en : " on " + id) + rest.en, w + " se cayó" + (after ? after.es : " con " + id) + rest.es));
          // a Watch about a crash skips most of the long timeout, so the redelivery comes within seconds
          if (jump && jump.armed && e.after === "letter" && !e.m.acked && cfg.ack !== "first") jump = { at: e.t + 3, to: e.m.visibleAt - 2.5, crashed: e.t, id, w };
          break;
        }
        case "letter": say(e.n >= 2 ? 5 : 0, e.n >= 2 ? T(id + ": the customer gets the same letter a second time", id + ": el cliente recibe la misma carta por segunda vez") : T(w + " mailed " + id + "'s letter", w + " envió la carta de " + id)); break;
        case "dropped": say(4, T("mail service drops " + id + "'s repeat letter: it has seen the key", "el servicio de correo descarta la carta repetida de " + id + ": ya vio la clave")); break;
        case "ledger": say(e.n >= 2 ? 5 : 0, e.n >= 2 ? T(id + " written in the ledger a second time", id + " escrito en el libro por segunda vez") : T(w + " wrote " + id + " in the ledger", w + " escribió " + id + " en el libro")); break;
        case "refused": say(4, T("ledger refuses " + id + " again: its id is already in the table", "el libro rechaza " + id + " otra vez: su id ya está en la tabla")); break;
        case "fenced": say(4, T(w + "'s commit for " + id + " fails: another worker already acked it", "falla el commit de " + w + " para " + id + ": otro trabajador ya hizo el ack")); break;
        case "skip": say(3, T(w + " skips " + id + " (" + mid + "): its id is in the table", w + " omite " + id + " (" + mid + "): su id está en la tabla")); break;
        case "lost": say(5, T(id + " lost: acked on receipt, and its worker crashed before the ledger", id + " perdido: ack al recibir, y su trabajador se cayó antes del libro")); break;
        case "stored": if (e.lose) say(3, T("the queue's reply about " + id + " is lost · the sender will send it again", "se pierde la respuesta de la cola sobre " + id + " · el remitente lo volverá a enviar")); break;
        case "resend": say(3, T("sender resends " + id + " as a new message", "el remitente reenvía " + id + " como un mensaje nuevo")); break;
        case "up": say(1, T(w + " is back", w + " volvió")); break;
      }
    }
    if (logAt > 4000) { model.log.splice(0, logAt); logAt = 0; }
    while (replies.length && replies[0].t < clock - 2) replies.shift();
  }

  // ---------- where everything is ----------
  const stepStart = (a, k) => (k > 0 ? a.steps[k - 1].end : a.start);
  function wanted() {
    const out = new Map();
    const env = (key, m, target, layer, lit, spawn, hidden = false) => out.set(key, { kind: "env", mid: m.mid, target, layer, lit, a: "#" + m.o.id, b: "m" + m.mid, spawn, ease: true, hidden });
    model.visible.slice(0, G.SLOTS).forEach((m, i) => env("q" + m.mid, m, [G.SLOT_X[i], G.RACK_Y, G.RACK_Z], "rack", false,
      m.receives === 0 ? [...G.SENDER_AT] : m.holder ? DESK_TOP(m.holder.i) : null));
    let j = 0;
    for (const m of model.inflight) {
      if (m.holder || j >= G.HIDE_X.length) continue;
      env("q" + m.mid, m, [G.HIDE_X[j++], G.HIDE_Y, G.RACK_Z], "rack", false, null, true);
    }
    for (const w of model.workers) {
      const a = w.att;
      if (!a) continue;
      const m = a.m;
      const stale = (m.acked && m.ackedBy !== w) || m.lastRecv !== a.recv || (!m.acked && cfg.ack !== "first" && clock >= m.visibleAt);
      env("a" + a.id, m, DESK_TOP(w.i), "desk", stale, [G.SLOT_X[0], G.RACK_Y, G.RACK_Z]);
      // a letter or a ledger slip on its way
      const s = a.steps[a.k];
      if (!s) continue;
      const u = clamp((clock - stepStart(a, a.k)) / Math.max(0.01, s.end - stepStart(a, a.k)));
      const from = [DESK_TOP(w.i)[0] + 2, DESK_TOP(w.i)[1], G.DESK_H + 2];
      if (s.name === "letter") {
        const drop = cfg.key === "key" && model.keys.has(a.o.id);
        const to = drop ? G.TRAY_SPOTS[Math.min(dropped.length, 2)] : SENT_AT(G.SENT - 1);
        out.set("L" + a.id, { kind: "letter", target: arc(from, to, u, 22), layer: "fly", lit: !drop && a.o.letters >= 1, a: "#" + a.o.id });
      }
      if (s.name === "ledger" || s.name === "commit") out.set("W" + a.id, { kind: "slip", target: arc(from, G.BOOK_AT, u, 26), layer: "fly", lit: false, a: "#" + a.o.id });
    }
    // the rack of letters sent, the newest on the right, and the tray of dropped repeats
    sent.forEach((x, n) => out.set(x.key, { kind: "letter", target: SENT_AT(G.SENT - sent.length + n), layer: "sent", lit: x.dup, a: x.id, ease: true, spawn: SENT_AT(G.SENT - 1) }));
    dropped.forEach((x, n) => out.set(x.key, { kind: "letter", target: G.TRAY_SPOTS[n], layer: "sent", lit: false, a: x.id, ease: true }));
    // the queue's replies to the sender: lit and dropped half way when lost
    for (const r of replies) {
      const u = (clock - r.t) / 0.8;
      if (u < 0 || u > (r.lose ? 0.55 : 1)) continue;
      out.set("R" + r.t.toFixed(4), { kind: "slip", target: arc(G.QUEUE_IN, G.SENDER_AT, u, 12), layer: "fly", lit: r.lose, a: "OK" });
    }
    return out;
  }

  // ---------- painting ----------
  function paint(dt, snap = false) {
    narrate();
    sayHeld();
    const want = wanted();
    const now = performance.now();
    // envelopes keep their element as they move between the rack, the desks and the hidden row
    const free = new Map();
    for (const [key, sp] of sprites) if (!want.has(key) && sp.kind === "env" && !sp.leaving) free.set(sp.mid, key);
    for (const [key, w] of want) {
      let sp = sprites.get(key);
      if (!sp && w.kind === "env" && free.has(w.mid)) {
        const old = free.get(w.mid); free.delete(w.mid);
        sp = sprites.get(old); sprites.delete(old); sprites.set(key, sp);
      }
      if (!sp) {
        const el = pools[w.kind].pop() || makeEl(w.kind);
        sp = { kind: w.kind, el, pos: [...(snap ? w.target : w.spawn || w.target)], mid: w.mid, layer: null };
        sprites.set(key, sp);
      }
      sp.leaving = false; sp.el.g.style.opacity = "";
      sp.mid = w.mid; sp.target = w.target; sp.want = w;
      dress(sp.el, w.a, w.b, w.lit, !!w.hidden);
    }
    for (const [key, sp] of sprites) {
      if (want.has(key)) continue;
      if (!sp.leaving) { sp.leaving = true; sp.until = now + 450; }
      if (snap || now > sp.until) { drop(key); continue; }
      sp.el.g.style.opacity = String(clamp((sp.until - now) / 450));
    }
    // move, and keep each in its layer: a travelling envelope flies above everything until it lands
    const f = snap ? 1 : 1 - Math.exp(-dt * 8);
    const byLayer = { rack: [], desk: [], sent: [], fly: [] };
    for (const sp of sprites.values()) {
      const w = sp.want, tg = sp.target;
      if (w && w.ease && !sp.leaving) {
        const d = Math.hypot(tg[0] - sp.pos[0], tg[1] - sp.pos[1]);
        sp.pos[0] = lerp(sp.pos[0], tg[0], f); sp.pos[1] = lerp(sp.pos[1], tg[1], f);
        sp.pos[2] = snap ? tg[2] : lerp(sp.pos[2], tg[2] + Math.min(14, d * 0.25), f);
        sp.layerNow = d > 2 ? "fly" : w.layer;
      } else if (!sp.leaving) { sp.pos = [...tg]; sp.layerNow = w.layer; }
      sp.el.g.setAttribute("transform", translateAlong(P, sp.pos));
      byLayer[sp.layerNow || "fly"].push(sp);
    }
    for (const [name, list] of Object.entries(byLayer)) {
      list.sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P));
      const parent = layers[name];
      const kids = parent.children;
      if (list.some((sp, n) => kids[n] !== sp.el.g) || kids.length !== list.length) list.forEach((sp) => parent.appendChild(sp.el.g));
    }

    // desks: pose, status, the visibility dial
    model.workers.forEach((w, i) => {
      const d = desks[i], s = d.shown, a = w.att;
      const down = w.downUntil > clock;
      if (s.down !== down) { s.down = down; WB.pose(svg, "worker-" + i, down ? "down" : "run"); }
      let st = "idle";
      if (down) st = "down";
      else if (a && a.steps[a.k]) { const name = a.steps[a.k].name; st = name === "check" && a.skip ? "skip" : name; }
      if (s.st !== st) { s.st = st; setText(d.status, L(STATUS[st])); }
      let v = 0;
      if (a && cfg.ack !== "first" && !a.m.acked && a.m.lastRecv === a.recv) v = clamp((a.m.visibleAt - clock) / model.cfg.vt);
      if (s.v === undefined || Math.abs(s.v - v) > 0.004) { s.v = v; d.dial.set(v); }
    });
    // the lamps stay lit 1.6 s of page time, whatever the speed
    for (const k of ["ledger", "mail"]) { const on = wallNow() - flashAt[k] < 1.6; show(flash[k][0], on); show(flash[k][1], !on); }
    const st = model.st;
    counters.waiting.setClamped(model.visible.length);
    counters.again.setClamped(st.again);
    counters.lost.setClamped(st.lost);
    counters.resent.setClamped(st.resent);
    counters.orders.setClamped(st.inLedger % 1000);
    counters.ledger2.setClamped(st.ledgerTwice);
    counters.seen.setClamped(model.seen.size % 1000);
    counters.letters.setClamped(st.letters % 1000);
    counters.letters2.setClamped(st.lettersTwice);
    counters.dropped.setClamped(st.dropped);
  }
  function showStats() {
    const st = model.st;
    stat("waiting", model.visible.length);
    stat("again", st.again);
    stat("lost", st.lost);
    stat("ledger2", st.ledgerTwice);
    stat("letters2", st.lettersTwice);
    stat("resent", st.resent);
  }

  // ---------- the loop ----------
  let statTimer = 0;
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    clock += dt * cfg.speed;
    while (stages.length && clock >= stages[0].at) stages.shift().run();
    if (jump && jump.at !== undefined && clock >= jump.at) {
      const j = jump; jump = null;
      if (j.to > clock) {
        clock = j.to; model.runTo(clock); narrate(true);
        for (const key of [...sprites.keys()]) drop(key);
        const secs = Math.round(clock - j.crashed);
        say(8, T(secs + " s later · " + j.id + " still waits hidden: nothing tells the queue that " + j.w + " crashed", secs + " s después · " + j.id + " sigue oculto: nada le avisa a la cola que " + j.w + " se cayó"));
        paint(0, true);
      }
    }
    model.runTo(clock);
    paint(dt);
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
  const acts = {
    slow: (secs = 26) => { const o = model.slowOrder(secs); say(6, T("slow order #" + o.id + " sent: " + secs + " s of work", "pedido lento #" + o.id + " enviado: " + secs + " s de trabajo")); },
    crash: () => { model.crashAfterLetter(); say(6, T("the next worker to mail a letter will crash right after it", "el próximo trabajador que envíe una carta se caerá justo después")); },
    lose: () => { const o = model.loseNextAck(); say(6, T("order #" + o.id + " sent · the queue's reply will be lost", "pedido #" + o.id + " enviado · se perderá la respuesta de la cola")); },
  };
  const actions = {
    slow: () => { acts.slow(26); wake(); },
    crash: () => { acts.crash(); wake(); },
    lose: () => { acts.lose(); wake(); },
    reset: () => { restart(); say(9, T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings, and the moment it's about ----------
  root.on("watch", (w) => {
    for (const key of ["ack", "vt", "crash", "lost", "dedupe", "key"]) set(key, w[key], true);
    set("speed", String(w.speed || 1));
    // the moment each Watch is about, staged in the warm-up where it would otherwise come too late to see
    let o = null;
    const pre = {
      // a slow order of 15 s, received 9 s before the press: its 10 s timeout runs out 1 s in, a second worker takes it
      // while the first still works, and both write it within about 20 s of model time
      slow: (m, wm) => { m.runTo(wm - 9); o = m.slowOrder(15); },
      // the queue's reply to an order was lost 2.5 s before the press: the sender resends it half a second in
      lose: (m, wm) => { m.runTo(wm - 2.5); o = m.loseNextAck(); },
    }[w.stage] || null;
    restart(12, pre);
    const at = (dt, run) => stages.push({ at: clock + dt, run });
    const holder = () => { const x = o && model.workers.find((k) => k.att && k.att.o === o); return x ? NAME[x.i] : null; };
    if (w.stage === "slow") {
      const h = holder();
      say(7, h ? T("slow order #" + o.id + ", 15 s of work, has been at " + h + "'s desk for 9 s · its timeout is 10 s", "el pedido lento #" + o.id + ", de 15 s de trabajo, lleva 9 s en el escritorio de " + h + " · su tiempo es de 10 s")
        : T("slow order #" + o.id + ": 15 s of work, a 10 s timeout", "pedido lento #" + o.id + ": 15 s de trabajo, un tiempo de 10 s"));
    }
    if (w.stage === "lose") say(7, T("the queue's reply about #" + o.id + " was lost · the sender will send it again", "se perdió la respuesta de la cola sobre #" + o.id + " · el remitente lo volverá a enviar"));
    // a crash right after a letter: an order sent now (so a letter comes within seconds), the next letter crashes its worker
    if (w.stage === "crash" || w.stage === "letter") { at(0.5, () => { model.slowOrder(2); acts.crash(); }); jump = { armed: true }; }
    if (w.stage === "all") { at(0.8, acts.slow); at(3, acts.lose); at(6, acts.crash); }
    stages.sort((a, b) => a.at - b.at);
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

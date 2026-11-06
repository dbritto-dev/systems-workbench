// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The records office in the browser: runs the model in slow motion, scrolls every read, write, COMMIT and ROLLBACK
// along the timeline tape, hangs lock tags on the rows, turns the counters, and answers the controls. mount() gets the
// build-time data from page.ts (projection, geometry, the mark drawings) and root, the <wb-lesson>.
import { iso, translateAlong, pathOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, playPause } from "../../runtime/dom";
import { makeSim, NAMES } from "./sim";

export default function mount({ P, G, MARKS }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const NS = "http://www.w3.org/2000/svg";
  const WINDOW = 3.6;                                   // model seconds shown on the tape
  const UPS = (G.NOW_X - G.START_X) / WINDOW;           // tape units per model second
  const xAt = (t) => G.NOW_X - (clock - t) * UPS;
  const Z = G.TAPE_H + 0.05;

  const scenes = { deposits: qa('[data-scene="deposits"]'), rota: qa('[data-scene="rota"]') };
  const levelEl = q("[data-level]");
  const desks = [0, 1, 2, 3].map((i) => ({ g: q('[data-desk="' + i + '"]'), status: q('[data-status="' + i + '"]'), slip: q('[data-slip="' + i + '"]'), slipText: q('[data-slip-text="' + i + '"]') }));
  const laneLabels = [0, 1, 2, 3].map((i) => q('[data-lane-label="' + i + '"]'));
  const docs = [0, 1, 2, 3].map((i) => ({ g: q('[data-doc="' + i + '"]'), flag: q('[data-flag="' + i + '"]'), state: q('[data-doc-state="' + i + '"]') }));
  const locks = Object.fromEntries(["acct", "d0", "d1", "d2", "d3"].map((n) => [n, { open: q('[data-lock="' + n + '"] [data-lock-state="open"]'), closed: q('[data-lock="' + n + '"] [data-lock-state="closed"]'), text: q('[data-lock-text="' + n + '"]') }]));
  const docLocks = [0, 1, 2, 3].map((i) => q('[data-doc-lock="' + i + '"]'));
  const vers = Array.from({ length: G.VERSIONS }, (_, j) => ({ g: q('[data-ver="' + j + '"]'), text: q('[data-ver-text="' + j + '"]'), who: q('[data-ver-who="' + j + '"]') }));
  const rule = { on: q('[data-rule="on"]'), off: q('[data-rule="off"]') };
  const badGroup = q("[data-bad]");
  const counters = Object.fromEntries(["balance", "expected", "done", "aborts", "bad"].map((n) => [n, WB.counter(svg, n, P)]));
  const spanLayer = q('[data-layer="spans"]');
  const laneLayers = [0, 1, 2, 3].map((i) => q('[data-layer="lane' + i + '"]'));
  const postLayers = [0, 1, 2, 3].map((i) => q('[data-layer="posts' + i + '"]'));
  const statLabels = Object.fromEntries(root.$$("[data-s]").map((el) => [el.dataset.s, el.nextElementSibling]));
  const LEVEL = { rc: "READ COMMITTED", rr: "REPEATABLE READ", ser: "SERIALIZABLE" };

  // ---------- settings and the run ----------
  const cfg = { scenario: "deposits", level: "rc", write: "rmw", check: "plain", people: 2, speed: 0.25 };
  let model, clock, logAt, seed = 5, lostAt = -9, lastDone = {}, lastAbort = {}, statTimer = 0;

  function restart() {
    for (const r of marks.values()) r.g.remove();
    marks.clear();
    for (const s of spans.values()) { s.line.remove(); s.wait.remove(); }
    spans.clear();
    // Pick a run where something happens early: the first night's requests overlap, or the first deposits clash.
    // Same model, same rules; only the seed is chosen, so a visitor doesn't wait through quiet nights.
    const settings = { scenario: cfg.scenario, level: cfg.level, write: cfg.write, check: cfg.check, people: cfg.people };
    const next = (x) => (x * 7 + 3) % 9973 + 1;
    const early = (x) => {
      const probe = makeSim(settings, x);
      probe.runTo(cfg.scenario === "rota" ? 3.2 : 2.5);
      const s = probe.stats;
      if (cfg.scenario === "rota") return s.overlap > 0 ? 2 : 0;
      return s.lost + s.aborts > 0 ? 2 : s.waits > 0 ? 1 : 0;
    };
    let best = null, ok = null;
    for (let k = 0, x = seed; k < 40; k++, x = next(x)) {
      const e = early(x);
      if (e === 2) { best = x; break; }
      if (e === 1 && ok === null) ok = x;
    }
    seed = best ?? ok ?? seed;
    // Start a little before the first clash (a deposit written over, a rollback, a night with nobody on call; else a
    // lock wait), so the tape already shows what led up to it and the clash comes about LEAD s of model time in.
    const first = firstClash(settings, seed);
    model = makeSim(settings, seed);
    seed = next(seed);
    clock = 0; logAt = 0; lostAt = -9; lastDone = {}; lastAbort = {}; saidAt = -9; saidRank = 0; held = null;
    const start = Math.max(0, first - LEAD);
    if (start > 0) {
      model.runTo(start); clock = start;
      for (; logAt < model.log.length && model.log[logAt].t <= start; logAt++) {
        const e = model.log[logAt];
        if (e.type === "commit") lastDone[e.i] = e.t;
        if (e.type === "abort") lastAbort[e.i] = e.t;
      }
    }
    dressScene();
    paint();
    showStats();
  }
  // LEAD: model seconds from the start to the clash. The clash is the first one at least FILL s in, so the tape (3.6 s
  // wide) already carries a run of reads and writes when it comes; failing that, the first one at all.
  const LEAD = 1.6, FILL = 4;
  function firstClash(settings, s) {
    const m = makeSim(settings, s);
    m.runTo(16);
    const clash = (e) => (e.type === "commit" && e.lost > 0) || e.type === "abort" || (e.type === "nightEnd" && e.on === 0);
    const late = m.log.find((e) => clash(e) && e.t >= FILL), any = m.log.find(clash), wait = m.log.find((e) => e.type === "wait");
    return (late ?? any ?? wait)?.t ?? 0;
  }
  function dressScene() {
    const rota = cfg.scenario === "rota";
    scenes.deposits.forEach((g) => show(g, !rota));
    scenes.rota.forEach((g) => show(g, rota));
    setText(levelEl, LEVEL[cfg.level]);
    desks.forEach((d, i) => show(d.g, i < cfg.people));
    laneLabels.forEach((g, i) => show(g, i < cfg.people));
    docs.forEach((d, i) => show(d.g, i < cfg.people));
    docLocks.forEach((g, i) => show(g, i < cfg.people));
    root.controls.showFor(cfg.scenario);
    const lab = rota ? [T("Nights", "Noches"), T("Nobody on call", "Sin nadie de guardia")] : [T("Deposits", "Depósitos"), T("Lost", "Perdidos")];
    setText(statLabels.done, L(lab[0]));
    setText(statLabels.lost, L(lab[1]));
  }

  // ---------- narration: the model's log ----------
  let held = null, saidAt = -9, saidRank = 0;
  function say(rank, text) {
    const wall = performance.now() / 1000;
    if (rank < saidRank && wall - saidAt < 1.3) { if (!held || rank >= held.rank) held = { rank, text }; return; }
    held = null; saidRank = rank; saidAt = wall;
    root.figure.say(L(text));
  }
  function sayHeld() { if (held && performance.now() / 1000 - saidAt >= 1.3) { const h = held; held = null; saidRank = -1; say(h.rank, h.text); } }
  const who = (i) => (cfg.scenario === "rota" ? T("Dr " + NAMES[i], "Dr. " + NAMES[i]) : T(NAMES[i], NAMES[i]));
  const W = (i, en, es) => { const w = who(i); return T(w.en + " · " + en, w.es + " · " + es); };
  function narrate() {
    const log = model.log;
    for (; logAt < log.length; logAt++) {
      const e = log[logAt];
      if (e.t > clock) break;
      const i = e.i;
      switch (e.type) {
        case "read":
          say(1, cfg.level === "rc" ? W(i, "SELECT · balance " + e.v, "SELECT · saldo " + e.v) : W(i, "SELECT · balance " + e.v + " in its snapshot", "SELECT · saldo " + e.v + " en su instantánea"));
          break;
        case "readAll": say(1, W(i, "counts " + e.count + " on call", "cuenta " + e.count + " de guardia")); break;
        case "wait": say(2, W(i, "waits for " + NAMES[e.holder] + "'s row lock", "espera el bloqueo de fila de " + NAMES[e.holder])); break;
        case "write":
          if (e.how === "add") say(1, W(i, "UPDATE · balance + 10 → " + e.v, "UPDATE · saldo + 10 → " + e.v));
          else say(1, W(i, "UPDATE · writes " + e.v + " (what it read + 10)", "UPDATE · escribe " + e.v + " (lo que leyó + 10)"));
          break;
        case "off": say(1, W(i, e.count + " on call · goes off", e.count + " de guardia · se va")); break;
        case "stay": say(2, W(i, "only " + e.count + " on call · stays", "solo " + e.count + " de guardia · se queda")); break;
        case "commit":
          lastDone[i] = e.t;
          if (e.lost > 0) {
            lostAt = e.t;
            if (e.lost === 1 && e.over && e.over.length === 1) say(4, W(i, "COMMIT · wrote over " + NAMES[e.over[0]] + "'s deposit · no error", "COMMIT · sobrescribió el depósito de " + NAMES[e.over[0]] + " · sin error"));
            else say(4, W(i, "COMMIT · wrote over " + e.lost + " deposit" + (e.lost > 1 ? "s" : "") + " · no error", "COMMIT · sobrescribió " + e.lost + " depósito" + (e.lost > 1 ? "s" : "") + " · sin error"));
          }
          break;
        case "abort":
          lastAbort[i] = e.t;
          if (e.why === "ssi") say(3, W(i, "ROLLBACK · read/write conflict at COMMIT · retries", "ROLLBACK · conflicto de lectura y escritura en el COMMIT · reintenta"));
          else say(3, W(i, "ROLLBACK · row changed after its snapshot · retries", "ROLLBACK · la fila cambió después de su instantánea · reintenta"));
          break;
        case "night": say(0, T("night " + e.n + " · every doctor on call", "noche " + e.n + " · todos de guardia")); break;
        case "nightEnd":
          if (e.on === 0) say(4, T("night " + e.n + " · nobody on call · no error raised", "noche " + e.n + " · nadie de guardia · sin ningún error"));
          else say(2, T("night " + e.n + " · " + e.on + " on call · rule kept", "noche " + e.n + " · " + e.on + " de guardia · se cumple la regla"));
          break;
      }
    }
  }

  // ---------- the tape: spans and marks, pooled per attempt ----------
  const marks = new Map(), spans = new Map();
  function markEl(kind, label) {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = MARKS[kind];
    const txt = g.querySelector("[data-mark-text]");
    if (label === "OFF") label = L("OFF", "LIBRE");
    if (txt) { txt.textContent = label; txt.setAttribute("font-size", label.length > 4 ? 3.4 : 4.4); }
    return g;
  }
  function spanEl() {
    const line = document.createElementNS(NS, "path");
    line.setAttribute("class", "iso-line"); line.setAttribute("data-tone", "mid");
    const wait = document.createElementNS(NS, "path");
    wait.setAttribute("class", "iso-line"); wait.setAttribute("data-tone", "hi"); wait.setAttribute("data-dashed", "");
    spanLayer.appendChild(line); spanLayer.appendChild(wait);
    return { line, wait };
  }
  const seg = (y, t0, t1) => {
    const a = Math.max(G.START_X, xAt(t0)), b = Math.min(G.NOW_X, xAt(t1));
    return b > a ? pathOf([iso([a, y, Z], P), iso([b, y, Z], P)]) : "";
  };
  function paintTape() {
    const keep = new Set(), keepSpan = new Set();
    const from = clock - WINDOW - 0.3;
    model.trim(from - 1);
    for (const a of model.attempts) {
      const end = a.t1 ?? clock;
      if (end < from || a.t0 > clock) continue;
      const y = G.LANE_Y[a.i];
      let s = spans.get(a.id);
      if (!s) { s = spanEl(); spans.set(a.id, s); }
      keepSpan.add(a.id);
      s.line.setAttribute("d", seg(y, a.t0, Math.min(end, clock)));
      s.wait.setAttribute("d", a.waits.map(([w0, w1]) => seg(y, w0, Math.min(w1 ?? clock, clock))).join(""));
      a.marks.forEach((m, j) => {
        if (m.t > clock) return;
        const key = a.id + ":" + j + ":" + m.kind;
        // a tile ends at the moment it happened; a post or a cross stands at that moment
        const tile = m.kind === "read" || m.kind === "write" || m.kind === "lost";
        const x = tile ? xAt(m.t) - G.MARK.w : xAt(m.t);
        const my = tile ? y : y + G.POST_DY;
        let r = marks.get(key);
        if (x < G.START_X - (tile ? 0 : 2)) { if (r) { r.g.remove(); marks.delete(key); } return; }
        if (!r) { r = { g: markEl(m.kind, m.text) }; marks.set(key, r); (tile ? laneLayers : postLayers)[a.i].appendChild(r.g); }
        keep.add(key);
        r.g.setAttribute("transform", translateAlong(P, [x, my, Z]));
      });
    }
    for (const [key, r] of marks) if (!keep.has(key)) { r.g.remove(); marks.delete(key); }
    for (const [id, s] of spans) if (!keepSpan.has(id)) { s.line.remove(); s.wait.remove(); spans.delete(id); }
  }

  // ---------- painting ----------
  const STATUS = {
    idle: T("", ""), select: T("SELECT", "SELECT"), work: T("WORK", "TRABAJA"), wait: T("WAIT", "ESPERA"),
    update: T("UPDATE", "UPDATE"), rollback: T("ROLLBACK", "ROLLBACK"), commit: T("COMMIT", "COMMIT"),
  };
  function paint() {
    narrate(); sayHeld();
    const rota = cfg.scenario === "rota";
    model.clerks.forEach((c, i) => {
      const d = desks[i];
      let st = c.phase;
      if (lastAbort[i] !== undefined && clock - lastAbort[i] < 0.25) st = "rollback";
      else if (c.phase === "idle" && lastDone[i] !== undefined && clock - lastDone[i] < 0.25) st = "commit";
      setText(d.status, L(STATUS[st] || STATUS.idle));
      // the slip shows what the running transaction read, and for a moment after it commits (not after a rollback)
      const slip = c.read !== null && (c.txn || ((lastDone[i] ?? -9) > (lastAbort[i] ?? -9) && clock - lastDone[i] < 0.6));
      show(d.slip, !!slip);
      if (slip) setText(d.slipText, String(c.read));
    });
    // rows
    if (rota) {
      model.rowNames.forEach((name, i) => {
        const on = model.rows[name].versions[model.rows[name].versions.length - 1].v;
        show(docs[i].flag, on);
        setText(docs[i].state, on ? L("ON CALL", "GUARDIA") : L("OFF", "LIBRE"));
        setLock("d" + i, model.lockOf(name));
      });
      const n = model.night, bad = !!(n && n.end !== undefined && n.on === 0);
      show(rule.on, bad); show(rule.off, !bad);
      counters.done.setClamped(model.stats.nights);
      counters.bad.setClamped(model.stats.broken);
      setLitGroup(badGroup, bad);
    } else {
      setLock("acct", model.lockOf("acct"));
      // the last committed versions, oldest at the left, and under each the desks whose transaction read it
      const vs = model.rows.acct.versions, n = vs.length;
      vers.forEach((x, j) => {
        const v = vs[n - G.VERSIONS + j];
        show(x.g, !!v);
        if (!v) return;
        setText(x.text, String(v.v));
        const who = model.clerks.filter((c) => c.txn && c.txn.ctx.readVer === v).map((c) => NAMES[c.i]);
        setText(x.who, who.join(who.length > 2 ? "" : " "));
      });
      counters.balance.setClamped(model.balance());
      counters.expected.setClamped(100 + 10 * model.stats.made);
      counters.done.setClamped(model.stats.made);
      counters.bad.setClamped(model.stats.lost);
      setLitGroup(badGroup, clock - lostAt < 0.5);
    }
    counters.aborts.setClamped(model.stats.aborts);
    paintTape();
  }
  function setLock(name, holder) {
    const l = locks[name];
    show(l.closed, holder >= 0); show(l.open, holder < 0);
    if (holder >= 0) setText(l.text, NAMES[holder]);
  }
  // a counter housing that lights (the wb-lit-group CSS turns its wheels to the page colour)
  function setLitGroup(g, on) {
    for (const s of g.querySelectorAll(".wb-counter > .iso-solid")) s.toggleAttribute("data-lit", on);
  }

  // ---------- stats ----------
  function showStats() {
    const s = model.stats, rota = cfg.scenario === "rota";
    root.stat("done", rota ? s.nights : s.made);
    root.stat("lost", rota ? s.broken : s.lost);
    root.stat("aborts", s.aborts);
    root.stat("waits", s.waits);
    root.stat("time", s.reqs ? Math.round((1000 * s.reqTime) / s.reqs) + " ms" : "–");
  }

  // ---------- the loop ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    clock += dt * cfg.speed;
    model.runTo(clock);
    paint();
    statTimer += dt; if (statTimer > 0.2) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  pause.bind(loop);

  const NUMERIC = ["people", "speed"];
  function set(name, raw, quiet) {
    root.press(name, raw);
    cfg[name] = NUMERIC.includes(name) ? Number(raw) : String(raw);
    if (name === "speed") return;
    if (!quiet) { restart(); say(9, T("settings applied · run restarted", "ajustes aplicados · ejecución reiniciada")); }
  }
  root.on("change", (name, value) => set(name, value));
  const actions = { reset: () => { restart(); say(9, T("started over", "empezó de nuevo")); } };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const key of ["scenario", "level", "write", "check", "people"]) set(key, w[key], true);
    set("speed", 0.25, true);
    restart();
    if (loop.paused) loop.setPaused(false);
  });

  loop.setPaused(loop.paused);
  restart();
}

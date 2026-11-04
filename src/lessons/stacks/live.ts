// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The three stacks in the browser: steps the call stack, the undo/redo editor and the busy server, and answers the
// controls. mount() gets the build-time data from page.ts (geometry, first frame) and root, the <wb-lesson>.
import { iso, pathOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, playPause, setText, setLit } from "../../runtime/dom";
import { smoothstep } from "../../lib/tween";
import { callOps, makeEditor, makeServer, TIMEOUT } from "./sim";

export default function mount({ P, CSG, URG, COLG, COUNTERS, FIRST }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const say = (text) => root.figure.say(text);
  const ease = smoothstep;

  // Counters: digit wheels from the shared parts (WB.counter redraws only the wheels that changed).
  const dials = Object.fromEntries(Object.keys(COUNTERS).map((n) => [n, WB.counter(svg, n, P)]));
  const wheel = (name, v) => dials[name].set(Math.min(v, 10 ** COUNTERS[name].count - 1));

  const cfg = { program: "sum", n: 10, order: "lifo", load: 1.2, speed: 1 };
  const stat = (key, value) => root.stat(key, value);
  let focus = "cs", focusAt = 0;   // which station the readout narrates

  // ======== 1. the call stack ========
  const csZ = (i) => CSG.z0 + i * CSG.pitch;
  const csSlots = Array.from({ length: CSG.LIMIT + 1 }, (_, i) => ({ g: q('[data-cs-slot="' + i + '"]'), label: q('[data-cs-label="' + i + '"]') }));
  const csFly = { g: q("[data-cs-fly]"), label: q("[data-cs-fly-label]") };
  const csCursor = q("[data-cs-cursor]");
  const lamps = { off: q('[data-lamp="off"]'), on: q('[data-lamp="on"]') };
  const DUR = { push: 0.55, pop: 0.5, step: 0.16, visit: 0.02, overflow: 2.2, hold: 1.6 };
  let cs;
  function csRestart(skipTo = 0) {
    const r = callOps(cfg.program, cfg.n, CSG.LIMIT);
    cs = { ops: r.ops, i: 0, t: 0, began: false, frames: [], deepest: 0, holding: 0, cursorZ: csZ(0), overflows: cs ? cs.overflows : 0, visited: [], last: "" };
    csSlots.forEach((s) => show(s.g, false)); show(csFly.g, false); show(lamps.on, false); show(lamps.off, true);
    setLit(csSlots[CSG.LIMIT].g, true);
    // Fast-forward through the first ops (the first frame shows a stack part-way down).
    while (cs.i < skipTo && cs.i < cs.ops.length) { const op = cs.ops[cs.i++]; applyEnd(op); }
    cs.cursorZ = csZ(cs.frames.length) - 0.6;
    csPaint();
  }
  function applyEnd(op) {
    if (op.op === "push") { cs.frames.push(op.label); cs.deepest = Math.max(cs.deepest, cs.frames.length); }
    else if (op.op === "pop") cs.frames.pop();
    else if (op.op === "step") cs.frames[cs.frames.length - 1] = op.label;
    else if (op.op === "visit") cs.visited.push(op.node);
  }
  function csPaint() {
    cs.frames.forEach((label, i) => { show(csSlots[i].g, true); setText(csSlots[i].label, label); });
    for (let i = cs.frames.length; i < CSG.LIMIT; i++) show(csSlots[i].g, false);
    wheel("depth", cs.frames.length); wheel("deepest", cs.deepest);
  }
  function csStep(dt) {
    if (cs.holding > 0) { cs.holding -= dt; if (cs.holding <= 0) csRestart(); return; }
    if (cs.i >= cs.ops.length) { cs.holding = DUR.hold; return; }
    const op = cs.ops[cs.i];
    const d = DUR[op.op];
    if (!cs.began) {
      cs.began = true;
      if (op.op === "push") { setText(csFly.label, op.label); show(csFly.g, true); const caller = cs.frames.length ? cs.frames[cs.frames.length - 1] : ""; cs.last = T((caller ? caller + " calls " : "") + op.label, (caller ? caller + " llama a " : "") + op.label); }
      if (op.op === "pop") { const top = cs.frames.length - 1; show(csSlots[top].g, false); setText(csFly.label, op.label); show(csFly.g, true); cs.last = T(op.label + " returns " + op.ret, op.label + " retorna " + op.ret); }
      if (op.op === "step") { setLit(csSlots[cs.frames.length - 1].g, true); cs.last = T("loop " + op.label + " · total " + op.total, "bucle " + op.label + " · total " + op.total); }
      if (op.op === "visit") { const order = cs.visited.concat(op.node).join(", "); cs.last = T("visit " + op.node + " · order so far " + order, "visita " + op.node + " · orden hasta ahora " + order); }
      if (op.op === "overflow") { setText(csSlots[CSG.LIMIT].label, op.label); show(csSlots[CSG.LIMIT].g, true); show(lamps.on, true); show(lamps.off, false); cs.last = T("stack overflow: " + op.label + " doesn't fit (limit " + CSG.LIMIT + ")", "desbordamiento de pila: " + op.label + " no cabe (límite " + CSG.LIMIT + ")"); }
      if (op.op === "step") cs.frames[cs.frames.length - 1] = op.label;
      csPaint();
      if (op.op === "pop") show(csSlots[cs.frames.length - 1].g, false);
    }
    cs.t += dt;
    const p = Math.min(1, cs.t / d);
    if (op.op === "push") WB.place(csFly.g, P, [0, 0, csZ(cs.frames.length) + 9 * (1 - ease(p / 0.8))]);
    if (op.op === "pop") WB.place(csFly.g, P, [0, 0, csZ(cs.frames.length - 1) + 9 * ease(p)]);
    if (cs.t >= d) {
      if (op.op === "push" || op.op === "pop") show(csFly.g, false);
      if (op.op === "step") setLit(csSlots[cs.frames.length - 1].g, false);
      if (op.op === "overflow") { cs.overflows++; cs.frames = []; show(csSlots[CSG.LIMIT].g, false); show(lamps.on, false); show(lamps.off, true); cs.i = cs.ops.length; cs.holding = DUR.hold; csPaint(); return; }
      if (op.op !== "step") applyEnd(op);
      cs.i++; cs.t = 0; cs.began = false;
      csPaint();
    }
  }
  function csCursor_(dt) {
    const op = cs.ops[cs.i];
    let depth = cs.frames.length;
    if (op && cs.began && op.op === "push") depth += 1;
    if (op && cs.began && op.op === "pop") depth -= 1;
    const target = csZ(Math.max(0, depth)) - 0.6;
    cs.cursorZ += (target - cs.cursorZ) * Math.min(1, dt * 12);
    WB.place(csCursor, P, [0, 0, cs.cursorZ]);
  }

  // ======== 2. undo and redo ========
  const urSlots = [0, 1].map((t) => Array.from({ length: URG.UR_LIMIT }, (_, s) => ({ g: q('[data-ur-slot="' + t + '-' + s + '"]'), label: q('[data-ur-label="' + t + '-' + s + '"]') })));
  const urFly = { g: q("[data-ur-fly]"), label: q("[data-ur-fly-label]") };
  const docTiles = Array.from({ length: URG.DOC_SLOTS }, (_, s) => ({ g: q('[data-doc="' + s + '"]'), tile: q('[data-doc="' + s + '"] .tile'), label: q('[data-doc-label="' + s + '"]') }));
  const caret = q("[data-caret]");
  const binPlates = [0, 1, 2].map((s) => q('[data-bin="' + s + '"]'));
  const urZ = (i) => URG.UR_BASE_H + i * URG.UR_PITCH;
  const DX = URG.UR[1].x - URG.UR[0].x;
  const DEMO = ["redo", "redo", "undo", "undo", "type:R", "undo", "type:Y", "wait", "wait"];
  const WATCH = ["reset0", "type:A", "type:B", "type:C", "undo", "undo", "wait", "type:D", "wait", "wait", "wait"];
  let ed, ur;
  function edFromFirst() { const e = makeEditor(); e.doc = FIRST.editor.doc.slice(); e.undo = FIRST.editor.undo.slice(); e.redo = FIRST.editor.redo.slice(); e.dropped = FIRST.editor.binned; return e; }
  function urRestart(script = DEMO, fresh = false) {
    ed = fresh ? makeEditor() : edFromFirst();
    ur = { script, i: 0, t: 0, gap: 0.9, anim: null, manual: false };
    show(urFly.g, false);
    urPaint();
  }
  function urPaint() {
    [ed.undo, ed.redo].forEach((pile, t) => urSlots[t].forEach((s, i) => { show(s.g, i < pile.length); if (i < pile.length) setText(s.label, pile[i]); }));
    docTiles.forEach((d, i) => { show(d.g, i < ed.doc.length); if (i < ed.doc.length) setText(d.label, ed.doc[i]); });
    const x = URG.DOC.x + 5 + ed.doc.length * 7.1 - 0.6;
    caret.setAttribute("d", pathOf([iso([x, URG.DOC.fy, 10.6], P), iso([x, URG.DOC.fy, 19.4], P)]));
    binPlates.forEach((b, i) => show(b, i < Math.min(3, ed.dropped)));
    stat("editor", ed.undo.length + " · " + ed.redo.length);
  }
  // The editor's last message, for the readout while the editor has the focus.
  let urMsg = null;
  const sayUr = (m) => { urMsg = m; say(L(m)); };
  // Start an animated edit. Returns false if it can't happen.
  function urDo(action) {
    if (ur.anim) return false;
    let ev = null, from, to, label;
    if (action.startsWith("type:")) {
      if (ed.doc.length >= URG.DOC_SLOTS || ed.undo.length >= URG.UR_LIMIT) { sayUr(T("the document and the undo tower are full in this model; real editors drop the oldest undo", "el documento y la torre de deshacer están llenos en este modelo; los editores reales descartan el deshacer más antiguo")); return false; }
      const ch = action.slice(5);
      const cleared = ed.redo.length;
      ev = ed.type(ch); from = null; to = [0, ed.undo.length - 1]; label = ch;
      sayUr(cleared ? T("typed " + ch + " · the redo stack (" + cleared + ") goes in the bin", "escribiste " + ch + " · la pila de rehacer (" + cleared + ") va al descarte") : T("typed " + ch + " · pushed on undo", "escribiste " + ch + " · se apila en deshacer"));
    } else if (action === "undo") {
      if (!ed.undo.length) { sayUr(T("nothing to undo", "nada que deshacer")); return false; }
      from = [0, ed.undo.length - 1]; ev = ed.undoOne(); to = [1, ed.redo.length - 1]; label = ev.ch;
      sayUr(T("undo " + ev.ch + " · popped from undo, pushed on redo", "deshacer " + ev.ch + " · sale de deshacer, entra en rehacer"));
    } else if (action === "redo") {
      if (!ed.redo.length) { sayUr(T("nothing to redo", "nada que rehacer")); return false; }
      from = [1, ed.redo.length - 1]; ev = ed.redoOne(); to = [0, ed.undo.length - 1]; label = ev.ch;
      sayUr(T("redo " + ev.ch + " · popped from redo, pushed on undo", "rehacer " + ev.ch + " · sale de rehacer, entra en deshacer"));
    }
    focus = "ur"; focusAt = 2.2;
    ur.anim = { from, to, t: 0, d: from ? 0.9 : 0.55 };
    setText(urFly.label, label); show(urFly.g, true);
    urPaint();
    show(urSlots[to[0]][to[1]].g, false);
    const tile = docTiles[Math.max(0, ed.doc.length - 1)];
    if (action !== "undo") tile.tile.toggleAttribute("data-lit", true);
    return true;
  }
  function urStep(dt) {
    if (ur.anim) {
      const a = ur.anim; a.t += dt;
      const p = Math.min(1, a.t / a.d);
      const toZ = urZ(a.to[1]), toX = a.to[0] * DX;
      let x, z;
      if (!a.from) { x = toX; z = toZ + 9 * (1 - ease(p)); }
      else {
        const fx = a.from[0] * DX, fz = urZ(a.from[1]), top = Math.max(fz, toZ) + 7;
        if (p < 0.3) { x = fx; z = fz + (top - fz) * ease(p / 0.3); }
        else if (p < 0.7) { x = fx + (toX - fx) * ease((p - 0.3) / 0.4); z = top; }
        else { x = toX; z = top + (toZ - top) * ease((p - 0.7) / 0.3); }
      }
      WB.place(urFly.g, P, [x, 0, z]);
      if (p >= 1) { ur.anim = null; show(urFly.g, false); docTiles.forEach((d) => d.tile.removeAttribute("data-lit")); urPaint(); }
      return;
    }
    if (ur.manual) return;
    ur.gap -= dt;
    if (ur.gap > 0) return;
    if (ur.i >= ur.script.length) { urRestart(ur.script === WATCH ? WATCH : DEMO, ur.script === WATCH); return; }
    const action = ur.script[ur.i++];
    ur.gap = 0.8;
    if (action === "wait") return;
    if (action === "reset0") { ed = makeEditor(); urPaint(); return; }
    urDo(action);
  }

  // ======== 3. the busy server ========
  const TS = 0.25;           // model seconds per figure second
  const tickets = Array.from({ length: COLG.TK_SHOW }, (_, s) => q('[data-tk="' + s + '"]'));
  const grab = q("[data-grab]");
  const work = { lit: q("[data-work]"), stale: q("[data-work-stale]") };
  const trays = [0, 1].map((t) => Array.from({ length: COLG.TRAY_SHOW }, (_, s) => q('[data-tray="' + t + '-' + s + '"]')));
  const tkZ = (i) => COLG.tkZ0 + i * COLG.TK_PITCH;
  let sv, svSeed = 11, grabZ = tkZ(8);
  function svRestart() {
    sv = makeServer({ order: cfg.order, load: cfg.load }, svSeed++);
    sv.runTo(cfg.load > 1 ? 5 : 3);
    sv.base = { onTime: sv.onTime, late: sv.late };
    svPaint(0);
  }
  function svPaint(dt) {
    const now = sv.now, w = sv.waiting, n = Math.min(COLG.TK_SHOW, w.length), first = w.length - n;
    for (let s = 0; s < COLG.TK_SHOW; s++) {
      const el = tickets[s];
      if (s >= n) { show(el, false); continue; }
      const r = w[first + s];
      show(el, true);
      el.toggleAttribute("data-stale", now - r.t > TIMEOUT);
      const fresh = (now - r.t) / TS;   // figure seconds since it arrived
      const arriving = dt > 0 && fresh < 0.3;
      WB.place(el, P, [0, 0, tkZ(s) + (arriving ? 6 * (1 - ease(fresh / 0.3)) : 0)]);
      setLit(el, arriving);
    }
    const target = sv.order === "lifo" ? (n ? tkZ(n - 1) + 0.2 : tkZ(0)) : COLG.BOTTOM_GRAB;
    grabZ = dt > 0 ? grabZ + (target - grabZ) * Math.min(1, dt * 10) : target;
    WB.place(grab, P, [0, 0, grabZ]);
    const b = sv.busy;
    show(work.lit, !!b && now - b.t <= TIMEOUT);
    show(work.stale, !!b && now - b.t > TIMEOUT);
    const done = [sv.onTime, sv.late];
    trays.forEach((pile, t) => pile.forEach((el, s) => show(el, s < Math.min(COLG.TRAY_SHOW, Math.ceil(done[t] / 8)))));
    wheel("waiting", w.length); wheel("onTime", sv.onTime); wheel("late", sv.late); wheel("oldest", Math.floor(sv.oldest()));
    const gaveUp = sv.late + sv.stale();
    const decided = sv.onTime + gaveUp;
    stat("ontime", decided ? Math.round((100 * sv.onTime) / decided) + "%" : "–");
    stat("late", gaveUp);
    stat("oldest", sv.oldest().toFixed(1) + " s");
  }
  function svStep(dt) {
    sv.runTo(sv.now + dt * TS);
    if (sv.waiting.length > 400) svRestart();
    svPaint(dt);
  }

  // ======== the loop ========
  function narrate() {
    if (focus === "ur" && focusAt > 0) { if (urMsg) say(L(urMsg)); return; }
    say(cs.last ? L(cs.last) : L("starting", "iniciando"));
  }
  const pause = playPause(root);
  const loop = WB.loop({
    stage,
    step: (dt) => {
      const d = dt * cfg.speed;
      csStep(d); csCursor_(d); urStep(d); svStep(d);
      focusAt -= d; narrate();
      stat("depth", cs.frames.length); stat("deepest", cs.deepest); stat("overflows", cs.overflows);
    },
    onPause: pause.onPause,
  });
  pause.bind(loop);

  function restartAll() { csRestart(cfg.program === "sum" && cfg.n === 10 ? FIRST.stack.length : 0); urRestart(); svRestart(); }
  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    if (name === "program") { cfg.program = raw; if (!quiet) csRestart(); }
    if (name === "n") { cfg.n = Number(raw); if (!quiet) csRestart(); }
    if (name === "order") { cfg.order = raw; sv.setOrder(raw); }
    if (name === "load") { cfg.load = Number(raw); if (!quiet) svRestart(); }
  }
  root.on("change", (name, value) => set(name, value));
  const LETTERS = "STACKPUSHPOP";
  let typed = 0;
  const edit = (name) => {
    ur.manual = true;
    if (name === "type") { if (urDo("type:" + LETTERS[typed % LETTERS.length])) typed++; }
    else urDo(name);
    if (loop.paused) loop.setPaused(false);
  };
  const actions = { type: () => edit("type"), undo: () => edit("undo"), redo: () => edit("redo"), reset: () => { cs.overflows = 0; restartAll(); } };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    if (w.program) { set("program", w.program, true); if (w.n) set("n", String(w.n), true); csRestart(); }
    if (w.editor) urRestart(WATCH, true);
    if (w.order) { set("order", w.order, true); set("load", String(w.load), true); svRestart(); }
    if (loop.paused) loop.setPaused(false);
  });

  loop.setPaused(loop.paused);
  restartAll();
}

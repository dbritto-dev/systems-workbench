// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The trace archive in the browser: runs the model, walks each request past the services, flies each recorded span's
// card along the belt to the collector, holds it in a rack slot while the collector waits, then files it in a folder
// or drops it in the bin, and answers the controls. mount() gets the build-time data from page.ts (projection,
// geometry, card and token drawings) and root, the <wb-lesson>.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, playPause } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { clamp } from "../../lib/stats";
import { makeLab, LIVE_ERR, LIVE_SLOW, LIVE_RATE } from "./sim";

export default function mount({ P, G, CARD_SVG, TOKEN_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const NS = "http://www.w3.org/2000/svg";
  const say = (v) => root.figure.say(L(v));
  const stat = (key, value) => root.stat(key, value);
  const layers = Object.fromEntries(["rack", "tokens", "belt", "back", "bin", "front", "fly"].map((n) => [n, q('[data-layer="' + n + '"]')]));
  const lampOff = [0, 1, 2].map((i) => q('[data-lamp="' + i + '"]')), lampOn = [0, 1, 2].map((i) => q('[data-lamp-on="' + i + '"]'));
  const rateText = [0, 1, 2].map((i) => q('[data-rate="' + i + '"]'));
  const weightText = Array.from({ length: G.FOLDERS }, (_, i) => q('[data-weight="' + i + '"]'));
  const signs = { one: q('[data-signs="one"]'), two: q('[data-signs="two"]') }, divider = q("[data-divider]");
  const counters = Object.fromEntries(["held", "kept", "broken", "dropped", "errAll", "errKept", "slowAll", "slowKept"].map((n) => [n, WB.counter(svg, n, P)]));
  const meters = Array.from({ length: G.SLOTS }, (_, i) => WB.meter(svg, "wait" + i, P));
  const dials = [WB.dial(svg, "rate0", P), WB.dial(svg, "rate1", P)];
  const LETTERS = "ABC";

  // ---------- pooled drawings ----------
  const freeCards = [], freeTokens = [];
  function makeCard() {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = CARD_SVG;
    const kind = (name) => { const r = g.querySelector('[data-kind="' + name + '"]'); return { g: r, body: r.querySelector("[data-body]"), letter: r.querySelector("[data-letter]") }; };
    return { g, kinds: { card: kind("card"), tall: kind("tall") }, shown: {} };
  }
  function makeToken() {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = TOKEN_SVG;
    return { g, flag: g.querySelector("[data-flag]") };
  }
  const cards = new Map();     // "id-svc" -> { el, pos, target, layer, fixed, seen, until }
  const tokens = new Map();    // id -> { el, pos, seen }
  function dress(el, tr, svc) {
    const s = el.shown, kind = tr.slow && svc !== 1 ? "tall" : "card", lit = svc === 2 && tr.err;
    if (s.kind !== kind) { s.kind = kind; show(el.kinds.card.g, kind === "card"); show(el.kinds.tall.g, kind === "tall"); s.svc = -1; s.lit = null; }
    const k = el.kinds[kind];
    if (s.svc !== svc) { s.svc = svc; k.letter.textContent = LETTERS[svc]; }
    if (s.lit !== lit) { s.lit = lit; k.body.toggleAttribute("data-lit", lit); k.body.toggleAttribute("data-lit-fill", lit); k.letter.setAttribute("data-tone", lit ? "on-lit" : "hi"); }
  }
  function want(tr, svc, pos, layer, fixed) {
    const key = tr.id + "-" + svc;
    let r = cards.get(key);
    if (!r) { const el = freeCards.pop() || makeCard(); r = { el, pos: [...pos], layer: null }; cards.set(key, r); el.g.style.opacity = ""; }
    r.target = pos; r.fixed = fixed; r.seen = true;
    if (r.layer !== layer) { r.layer = layer; layers[layer].appendChild(r.el.g); }
    dress(r.el, tr, svc);
    return r;
  }
  function dropCard(key) { const r = cards.get(key); r.el.g.remove(); freeCards.push(r.el); cards.delete(key); }

  // ---------- settings and the run ----------
  const cfg = { mode: "tail", keep: "0.1", pay: "same", wait: "15", coll: "one", speed: 1 };
  const WARM = 45;                       // each run starts 45 s in, so the first frame shows a working archive
  let lab, clock, last, seed = 7, note = null, folders, nextFolder, filed, slots, partSlot, extra = 0;

  const modelCfg = () => ({ mode: cfg.mode, keep: Number(cfg.keep), pay: cfg.pay === "all" ? 1 : null, wait: Number(cfg.wait), coll: cfg.mode === "tail" ? cfg.coll : "one", err: LIVE_ERR, slow: LIVE_SLOW, rate: LIVE_RATE });
  function restart(warm = WARM) {
    for (const key of [...cards.keys()]) dropCard(key);
    for (const [id, r] of tokens) { r.el.g.remove(); freeTokens.push(r.el); tokens.delete(id); }
    lab = makeLab(modelCfg(), seed);
    seed = (Date.now() % 1e6) + 1;
    folders = Array(G.FOLDERS).fill(null); nextFolder = 0; filed = new Set();
    weightText.forEach((el) => setText(el, ""));
    slots = Array(G.SLOTS).fill(null); partSlot = new Map();
    note = null;
    clock = warm; last = warm;
    lab.runTo(clock);
    paintPanel();
    paint(0, true);
  }

  // the plaques on the services, the collector's signs
  function paintPanel() {
    const pc = (x) => Math.round(x * 100) + "%";
    const keep = Number(cfg.keep);
    rateText.forEach((el, i) => setText(el, cfg.mode === "tail" ? "100%" : i === 2 && cfg.pay === "all" ? "100%" : pc(keep)));
    const two = cfg.mode === "tail" && cfg.coll !== "one";
    show(signs.one, !two); show(signs.two, two); show(divider, two);
  }

  // ---------- where things are ----------
  const station = (i) => [G.SX[i], G.TRACK_Y, G.BENCH_H];
  function stationOf(tr, at) {
    const [a, b, c] = tr.spans;
    if (at < b.start) return 0;
    if (at < b.end) return 1;
    if (at < c.end) return 2;
    return 0;
  }
  // the card's ride: out of its station onto the belt, along the belt, into the collector
  function ridePath(svc) {
    const e = G.EMIT[svc];
    return [[e[0], e[1], e[2] + 2], [e[0], G.BELT_Y, G.BELT_H + 3], [e[0] + 4, G.BELT_Y, G.BELT_H], [G.INLET[0] + 2, G.BELT_Y, G.BELT_H], [G.INLET[0] + 6, G.BELT_Y - 4, G.COLL_H]];
  }
  const RIDES = [0, 1, 2].map(ridePath);
  const rideAt = (svc, u) => {
    const path = RIDES[svc];
    // walk the 3D polyline by its length
    let total = 0;
    for (let i = 1; i < path.length; i++) total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]);
    let d = clamp(u) * total;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      if (d <= l || i === path.length - 1) { const f = l ? clamp(d / l) : 1; return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)]; }
      d -= l;
    }
    return path[path.length - 1];
  };
  // a collector's rack slots: all 8 for one collector; 0–3 and 4–7 for two
  const slotRange = (coll) => (cfg.mode === "tail" && cfg.coll !== "one" ? (coll === 0 ? [0, G.SLOTS / 2] : [G.SLOTS / 2, G.SLOTS]) : [0, G.SLOTS]);
  function slotFor(part, tr) {
    if (partSlot.has(part)) return partSlot.get(part);
    const [lo, hi] = slotRange(part.coll);
    for (let i = lo; i < hi; i++) if (!slots[i]) { slots[i] = part; partSlot.set(part, i); return i; }
    return -1;
  }
  function freeSlots(at) {
    for (let i = 0; i < slots.length; i++) if (slots[i] && slots[i].at <= at) slots[i] = null;
    for (const [part] of partSlot) if (part.at <= at) partSlot.delete(part);
  }
  const fileAt = (tr) => { let m = Infinity; for (const s of tr.spans) if (s.kept && s.decided < m) m = s.decided; return m; };
  function fileTraces() {
    const ready = lab.traces.filter((tr) => tr.keptN && !filed.has(tr.id) && fileAt(tr) <= clock).sort((a, b) => fileAt(a) - fileAt(b));
    for (const tr of ready) {
      filed.add(tr.id);
      const i = nextFolder; nextFolder = (nextFolder + 1) % G.FOLDERS;
      const old = folders[i];
      if (old) for (let s = 0; s < 3; s++) if (cards.has(old.id + "-" + s)) dropCard(old.id + "-" + s);
      folders[i] = tr;
      const c = tr.spans[2], first = tr.spans.find((s) => s.kept);
      setText(weightText[i], "×" + Math.round(1 / (c.kept ? c.p : first.p)));
    }
    if (filed.size > 4000) filed = new Set([...filed].slice(-1000));
  }

  // ---------- the narration ----------
  const fmt = (x) => (x < 10 ? x.toFixed(1) : String(Math.round(x))) + " s";
  function narrate() {
    for (const tr of lab.traces) {
      if (tr.t0 > clock) break;
      const notable = tr.err || tr.slow || tr.injected;
      if (cfg.mode === "tail") {
        for (const p of tr.parts) {
          if (!(p.at > last && p.at <= clock)) continue;
          if (!notable && note && clock - note.t < 2.5) continue;
          const who = cfg.coll === "one" ? "" : " (" + L("collector ", "colector ") + (p.coll + 1) + ")";
          const of = p.seen + "/" + (p.seen + p.late);
          let text;
          if (p.why === "error") text = T("trace " + tr.id + " kept" + who + ": payments failed", "traza " + tr.id + " guardada" + who + ": pagos falló");
          else if (p.why === "slow") text = T("trace " + tr.id + " kept" + who + ": it took " + fmt(tr.spans[0].end - tr.t0), "traza " + tr.id + " guardada" + who + ": tardó " + fmt(tr.spans[0].end - tr.t0));
          else if (p.why === "base") text = T("trace " + tr.id + " kept" + who + " by the " + Math.round(lab.cfg.keep * 100) + "% rule", "traza " + tr.id + " guardada" + who + " por la regla del " + Math.round(lab.cfg.keep * 100) + "%");
          else if (p.late && (tr.slow || tr.err)) text = T("trace " + tr.id + " dropped" + who + ": judged on " + of + " spans · the slow or failing ones come later", "traza " + tr.id + " descartada" + who + ": juzgada con " + of + " spans · los lentos o fallidos llegan después");
          else if (tr.err) text = T("trace " + tr.id + " dropped" + who + ": these spans look healthy · the error is at the other collector", "traza " + tr.id + " descartada" + who + ": estos spans se ven sanos · el error está en el otro colector");
          else text = T("trace " + tr.id + " dropped" + who + ": fast and healthy", "traza " + tr.id + " descartada" + who + ": rápida y sana");
          note = { t: clock, text, pri: notable };
        }
      } else if (tr.t0 > last && tr.t0 <= clock && (notable || !note || clock - note.t > 2.5)) {
        const [a, b, c] = tr.spans;
        let text;
        if (cfg.mode === "parent") {
          text = tr.flag ? T("request " + tr.id + " · the edge samples it · B and C follow its flag", "solicitud " + tr.id + " · la entrada la muestrea · B y C siguen su bandera")
            : T("request " + tr.id + " · the edge doesn't sample it · nobody records it", "solicitud " + tr.id + " · la entrada no la muestrea · nadie la registra");
          if (tr.err) text = tr.flag ? T("request " + tr.id + " will fail at payments · sampled at the edge, so it's kept", "la solicitud " + tr.id + " va a fallar en pagos · la entrada la muestreó, así que se guarda")
            : T("request " + tr.id + " will fail at payments · the edge didn't sample it, so payments doesn't record it", "la solicitud " + tr.id + " va a fallar en pagos · la entrada no la muestreó, así que pagos no la registra");
        } else {
          const rec = LETTERS.split("").filter((_, i) => tr.spans[i].recorded).join(" ");
          text = rec ? T("request " + tr.id + " · recorded by " + rec + (tr.keptN < 3 ? " · a broken trace" : " · whole"), "solicitud " + tr.id + " · la registra " + rec + (tr.keptN < 3 ? " · traza incompleta" : " · completa"))
            : T("request " + tr.id + " · no service recorded it", "solicitud " + tr.id + " · ningún servicio la registró");
          if (tr.err) text = c.recorded ? T("request " + tr.id + " fails at payments · recorded by " + (rec || "–") + (tr.keptN < 3 ? " · the rest of its trace is missing" : ""), "la solicitud " + tr.id + " falla en pagos · la registra " + (rec || "–") + (tr.keptN < 3 ? " · falta el resto de su traza" : ""))
            : T("request " + tr.id + " fails at payments · payments didn't record it", "la solicitud " + tr.id + " falla en pagos · pagos no la registró");
        }
        note = { t: clock, text, pri: notable };
      }
    }
  }

  // ---------- painting ----------
  function paint(dt, snap) {
    freeSlots(clock);
    fileTraces();
    for (const r of cards.values()) r.seen = false;
    for (const r of tokens.values()) r.seen = false;
    const lit = [false, false, false];
    for (const tr of lab.traces) {
      if (tr.t0 > clock) break;
      const aEnd = tr.spans[0].end;
      // the request on the track
      if (clock < aEnd + 0.5) {
        let r = tokens.get(tr.id);
        if (!r) { const el = freeTokens.pop() || makeToken(); r = { el, pos: [...G.ENTRY] }; tokens.set(tr.id, r); layers.tokens.appendChild(el.g); show(el.flag, false); }
        r.seen = true;
        const at = stationOf(tr, clock), p = station(at);
        const off = at === 2 && tr.slow ? ((tr.id % 3) - 1) * 4.6 : 0;
        r.target = [p[0] + off, p[1], p[2]];
        r.fade = clock > aEnd ? clamp((aEnd + 0.5 - clock) / 0.5) : 1;
        show(r.el.flag, cfg.mode === "parent" && !!tr.flag);
        if (tr.spans[at].recorded && clock < aEnd) lit[at] = true;
      }
      // the cards still on their way, in the rack, or falling into the bin
      for (const s of tr.spans) {
        if (!s.recorded || clock < s.end) continue;
        if (clock < s.arrive) { want(tr, s.svc, rideAt(s.svc, (clock - s.end) / (s.arrive - s.end)), "fly", true); continue; }
        if (clock < s.decided) {
          const slot = slotFor(s.part, tr);
          if (slot < 0) continue;            // the rack is full: it waits inside the collector
          want(tr, s.svc, [G.SLOT_X[slot] + G.SLOT_W / 2 + G.SLOT_CARD_X[s.svc], G.SLOT_CARD_Y, G.COLL_H], "rack", false);
          continue;
        }
        if (!s.kept && clock < s.decided + 1.4) {
          const r = want(tr, s.svc, [G.BIN_SPOT[0] + ((tr.id * 7 + s.svc * 11) % 34) - 17, G.BIN_SPOT[1] + ((tr.id * 13 + s.svc * 17) % 48) - 24, G.BIN_SPOT[2]], "fly", false);
          r.fadeAt = s.decided;
        }
      }
    }
    // the filed traces, in their folders
    folders.forEach((tr, i) => {
      if (!tr) return;
      for (const s of tr.spans) if (s.kept && clock >= s.decided) want(tr, s.svc, [...G.CARD_SPOTS[i][s.svc]], i >= G.FOLDERS / 2 ? "back" : "front", false);
    });

    // move everything; cards that left the view go
    const f = snap ? 1 : 1 - Math.exp(-dt * 9);
    for (const [key, r] of cards) {
      if (!r.seen) { dropCard(key); continue; }
      if (r.fixed || snap) r.pos = [...r.target];
      else {
        const [tx, ty, tz] = r.target, dist = Math.hypot(tx - r.pos[0], ty - r.pos[1]);
        r.pos[0] = lerp(r.pos[0], tx, f); r.pos[1] = lerp(r.pos[1], ty, f); r.pos[2] = lerp(r.pos[2], tz + Math.min(10, dist * 0.2), f);
      }
      r.el.g.setAttribute("transform", translateAlong(P, r.pos));
      const o = r.fadeAt !== undefined ? clamp(1 - (clock - r.fadeAt - 0.5) / 0.9) : 1;
      r.el.g.style.opacity = o < 1 ? String(o) : "";
    }
    for (const [id, r] of tokens) {
      if (!r.seen) { r.el.g.remove(); freeTokens.push(r.el); tokens.delete(id); continue; }
      if (snap) r.pos = [...r.target];
      else for (let j = 0; j < 3; j++) r.pos[j] = lerp(r.pos[j], r.target[j], 1 - Math.exp(-dt * 12));
      r.el.g.setAttribute("transform", translateAlong(P, r.pos));
      r.el.g.style.opacity = r.fade < 1 ? String(r.fade) : "";
    }
    // painter's order inside the layers that hold several cards
    for (const name of ["rack", "back", "front", "fly", "tokens"]) {
      const layer = layers[name], kids = [...layer.children];
      if (kids.length < 2) continue;
      const pos = (g) => g.__pos || [0, 0, 0];
      for (const r of cards.values()) r.el.g.__pos = r.pos;
      for (const r of tokens.values()) r.el.g.__pos = r.pos;
      const sorted = [...kids].sort((a, b) => depthOf(pos(a), P) - depthOf(pos(b), P));
      if (sorted.some((el, n) => el !== kids[n])) sorted.forEach((el) => layer.appendChild(el));
    }
    lit.forEach((on, i) => { show(lampOn[i], on); show(lampOff[i], !on); });
    // rack timers
    for (let i = 0; i < G.SLOTS; i++) meters[i].set(slots[i] ? clamp((slots[i].at - clock) / lab.cfg.wait) : 0);
    // counters and readout
    const st = lab.st;
    counters.held.setClamped(lab.held()); counters.kept.setClamped(st.kept); counters.broken.setClamped(st.broken); counters.dropped.setClamped(st.dropped);
    counters.errAll.setClamped(st.err); counters.errKept.setClamped(st.errKept); counters.slowAll.setClamped(st.slow); counters.slowKept.setClamped(st.slowKept);
    const counted = st.cTraces ? st.cErr / st.cTraces : 0, weighted = st.wSum ? st.wErr / st.wSum : 0;
    dials[0].set(counted / 0.5); dials[1].set(weighted / 0.5);
  }

  const pc = (x) => (x < 0.1 && x > 0 ? (100 * x).toFixed(1) : String(Math.round(100 * x))) + "%";
  function showStats() {
    const st = lab.st;
    stat("kept", st.sent ? L(st.kept + " of " + st.sent, st.kept + " de " + st.sent) : "–");
    stat("broken", st.kept ? st.broken + " (" + pc(st.broken / st.kept) + ")" : "–");
    stat("errors", st.err ? L(st.errKept + " of " + st.err + ", " + st.errWhole + " whole", st.errKept + " de " + st.err + ", " + st.errWhole + " completos") : "–");
    stat("slow", st.slow ? L(st.slowKept + " of " + st.slow + ", " + st.slowWhole + " whole", st.slowKept + " de " + st.slow + ", " + st.slowWhole + " completas") : "–");
    stat("held", cfg.mode === "tail" ? L(lab.held() + " traces", lab.held() + " trazas") : "–");
    stat("rate", st.cTraces ? pc(st.cErr / st.cTraces) + " → " + pc(st.wErr / st.wSum) : "–");
  }
  function readout() {
    if (note && clock - note.t < (note.pri ? 4 : 2.5)) { say(note.text); return; }
    const st = lab.st;
    say(T(st.kept + " of " + st.sent + " traces kept · " + st.broken + " broken" + (cfg.mode === "tail" ? " · " + lab.held() + " in memory" : ""),
      st.kept + " de " + st.sent + " trazas guardadas · " + st.broken + " incompletas" + (cfg.mode === "tail" ? " · " + lab.held() + " en memoria" : "")));
  }

  // ---------- the loop ----------
  let statTimer = 0;
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    last = clock;
    clock += dt * cfg.speed;
    lab.runTo(clock);
    narrate();
    paint(dt);
    readout();
    statTimer += dt; if (statTimer > 0.25) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = String(raw);
    if (!quiet) { restart(); showStats(); say(T("settings applied · run restarted", "ajustes aplicados · ejecución reiniciada")); }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  function inject(kind) {
    const tr = lab.inject(clock, kind);
    tr.injected = true;
    note = { t: clock, pri: true, text: kind === "err" ? T("request " + tr.id + " will fail at payments", "la solicitud " + tr.id + " va a fallar en pagos") : T("request " + tr.id + " will be slow at payments", "la solicitud " + tr.id + " va a ser lenta en pagos") };
    wake();
  }
  const actions = {
    err: () => inject("err"),
    slow: () => inject("slow"),
    reset: () => { restart(); showStats(); say(T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  let pending = 0;
  root.on("watch", (w) => {
    for (const k of ["mode", "keep", "pay", "wait", "coll"]) set(k, w[k], true);
    set("speed", w.warm ? "4" : "2", true);
    restart(w.warm || WARM);
    showStats();
    wake();
    clearTimeout(pending);
    if (w.inject) pending = setTimeout(() => inject(w.inject), 1200);
  });

  loop.setPaused(loop.paused);
  restart();
  showStats();
}

// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The page-load bench in the browser: runs one load of the model, then plays it back in slow motion. Tubes fill from
// the model's byte counts, tags appear as the HTML's bytes arrive, the parser walks to the tag it is reading, the
// shutter lifts at the first paint and every frame the model drew is laid out on the phone. mount() gets the
// build-time data from page.ts (projection, geometry) and root, the <wb-lesson>.
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, playPause } from "../../runtime/dom";
import { makeLoad, FIRST_SCREEN, IMAGES } from "./sim";
import { tubeFill, shutterSvg, SCREEN, BOTTOM } from "./shapes";

const SLOW = 400;           // model ms per second on the page at ×1
const HOLD = 3.5;           // seconds the finished page stays before it loads again
const s2 = (ms) => (ms / 1000).toFixed(2) + " s";
const clsText = (x) => (x < 0.0005 ? "0" : x < 0.1 ? x.toFixed(3) : x.toFixed(2));

// Which tag on the strip a token belongs to (the long article folds into "more").
function slotOf(id) {
  if (id === "style" || id === "cssRest" || id === "css") return "css";
  if (id === "preFont" || id === "preHero") return "pre";
  if (id === "app" || id === "adjs" || id === "hero" || id === "p1" || id === "ad" || id === "p2" || id === "p3" || id === "img2" || id === "img3" || id === "img4") return id;
  if (id === "header" || id === "h1") return "h1";
  if (/^m\d/.test(id)) return "more";
  if (/^n\d/.test(id)) return "img2";
  if (/^o\d/.test(id)) return "img3";
  if (id === "end") return "img4";
  return null;
}

export default function mount({ P, G }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (v) => root.figure.say(L(v));
  const stat = (key, value) => root.stat(key, value);

  // ---------- the parts ----------
  const fills = Object.fromEntries(G.TUBES.map((n) => [n, { g: q('[data-fill="' + n + '"]'), key: "" }]));
  const pips = Object.fromEntries(G.TUBES.map((n) => [n, [0, 1, 2].map((p) => q('[data-pip="' + n + "-" + p + '"]'))]));
  const tags = Object.fromEntries(Object.keys(G.SLOTS).map((n) => [n, { g: q('[data-tag="' + n + '"]'), text: q('[data-tag-text="' + n + '"]'), lit: q('[data-tag-lit="' + n + '"]'), litText: q('[data-tag-lit-text="' + n + '"]') }]));
  const walker = q("[data-walker]"), walkerOn = q("[data-walker-on]"), walkerOff = q("[data-walker-off]");
  const pageG = q("[data-page]"), shutter = q("[data-shutter]"), lcpTag = q("[data-lcp]");
  const els = FIRST_SCREEN.map((e) => {
    const g = q('[data-el="' + e.id + '"]');
    return { e, g, vs: Object.fromEntries([...g.querySelectorAll("[data-v]")].map((v) => [v.dataset.v, v])), shown: null, top: null };
  });
  const shiftOn = q('[data-shift="on"]'), shiftOff = q('[data-shift="off"]');
  const threads = Object.fromEntries(["parse", "css", "script", "render"].map((k) => [k, { on: q('[data-thread-on="' + k + '"]'), off: q('[data-thread="' + k + '"]') }]));
  const counters = { fp: WB.counter(svg, "fp", P), text: WB.counter(svg, "text", P), lcp: WB.counter(svg, "lcp", P), cls: WB.counter(svg, "cls", P) };
  const meters = { lcp: WB.meter(svg, "lcp", P), cls: WB.meter(svg, "cls", P) };
  const clockDial = WB.dial(svg, "clock", P);

  // ---------- settings ----------
  const cfg = { css: "link", js: "head", font: "block", preload: new Set(), lazy: new Set(), reserve: new Set(), speed: 1, warm: false };
  const modelCfg = () => ({
    css: cfg.css, js: cfg.js, font: cfg.font,
    preloadFont: cfg.preload.has("font"), preloadHero: cfg.preload.has("hero"),
    lazyHero: cfg.lazy.has("hero"), lazyBelow: cfg.lazy.has("below"),
    sizeImg: cfg.reserve.has("img"), sizeAd: cfg.reserve.has("ad"), matchFont: cfg.reserve.has("font"),
    warm: cfg.warm,
  });

  // ---------- one load ----------
  let m, clock, seed = 11, realNow = 0, endAt = null;
  let logAt, workAt, frameAt, shiftUntil, shutterZ, walkerX, said, pending, blockedFrom, cssReadyAt, tokenSlot, shifts;

  function restart(startAt = 0) {
    m = makeLoad(modelCfg(), seed);
    seed = (Date.now() % 1e6) + 1;
    clock = startAt; endAt = null;
    logAt = 0; workAt = 0; frameAt = -1; shiftUntil = -1; shutterZ = BOTTOM; walkerX = G.slotXs.css; said = { prio: -1, at: -9 }; pending = null;
    const blocked = m.log.find((e) => e.type === "parserBlocked");
    blockedFrom = blocked ? blocked.t : null;
    const ready = m.log.find((e) => e.type === "cssReady");
    cssReadyAt = ready ? ready.t : null;
    tokenSlot = m.tokens.map((tk) => slotOf(tk.id));
    // windowed CLS as it builds up: the score of the largest burst so far, after each shift
    let best = 0;
    shifts = m.shifts.map((s) => { best = Math.max(best, s.window); return { t: s.t, cls: best }; });
    labelTags();
    shutter.innerHTML = shutterSvg(P, BOTTOM);
    for (const x of els) { x.shown = null; x.top = null; }
    for (const f of Object.values(fills)) f.key = "";
    paint(true);
  }

  function labelTags() {
    const lazyHero = cfg.lazy.has("hero"), lazyBelow = cfg.lazy.has("below");
    const words = {
      css: cfg.css === "inline" ? "STYLE" : "CSS",
      pre: "PRELOAD",
      app: cfg.js === "head" ? "JS" : cfg.js.toUpperCase(),
      adjs: "ADS.JS",
      h1: "H1", hero: lazyHero ? "LAZY" : "HERO", p1: "P", ad: L(T("AD", "ANUNCIO")), p2: "P", p3: "P", more: "…",
      img2: lazyBelow ? "LAZY" : "IMG", img3: lazyBelow ? "LAZY" : "IMG", img4: lazyBelow ? "LAZY" : "IMG",
    };
    for (const [n, tg] of Object.entries(tags)) {
      const w = words[n], size = w.length <= 4 ? 2.8 : w.length <= 6 ? 2.4 : 2;
      for (const el of [tg.text, tg.litText]) { el.textContent = w; el.setAttribute("font-size", size); }
    }
  }

  // ---------- reading the model at the clock ----------
  const sample = (name, t) => { const s = m.R[name].samples; return s[Math.max(0, Math.min(s.length - 1, Math.floor(t / 10)))]; };
  function frac(name, t) {
    if (name === "imgs") return (sample("img2", t) + sample("img3", t) + sample("img4", t)) / 3;
    if (name === "ad") return (sample("adjs", t) * m.R.adjs.kb + sample("ad", t) * m.R.ad.kb) / (m.R.adjs.kb + m.R.ad.kb);
    return sample(name, t);
  }
  const resOf = (name, t) => (name === "imgs" ? m.R.img2 : name === "ad" ? (m.R.ad.reqAt !== null && t >= m.R.ad.reqAt ? m.R.ad : m.R.adjs) : m.R[name]);
  const prioAt = (r, t) => (r.boostAt !== null ? (t >= r.boostAt ? 1 : 2) : r.prio);
  const painted = (t) => m.firstPaint !== null && t >= m.firstPaint;
  const textShown = (t) => m.textAt !== null && t >= m.textAt;
  // what the page is waiting for right now: before the first paint, the HTML, a linked stylesheet and a classic
  // script; after it, the font while text is invisible, and the hero until it is the LCP
  function awaited(name, t) {
    if (!painted(t)) {
      if (name === "html") return m.R.html.doneAt === null || t < m.R.html.doneAt;
      if (name === "css") return m.cfg.css === "link" && (cssReadyAt === null || t < cssReadyAt);
      if (name === "app") return m.cfg.js === "head" && (m.appDone === null || t < m.appDone);
      return false;
    }
    if (name === "font") return !textShown(t) && m.R.font.reqAt !== null && t >= m.R.font.reqAt;
    if (name === "hero") return m.lcpId === "hero" && t < m.lcp;
    return false;
  }
  const appRunning = (t) => m.work.some((w) => w.label === "app" && w.t0 <= t && t < w.t1);
  const blockedNow = (t) => blockedFrom !== null && t >= blockedFrom && (m.appDone === null || t < m.appDone);

  // ---------- painting ----------
  function paint(snap, dt = 0) {
    const t = clock;
    // the rack
    G.TUBES.forEach((name, i) => {
      const f = fills[name], fr = frac(name, t), lit = awaited(name, t);
      const key = fr.toFixed(3) + (lit ? "L" : "");
      if (f.key !== key) { f.key = key; f.g.innerHTML = tubeFill(P, i, fr, lit); }
      const r = resOf(name, t), asked = r.reqAt !== null && t >= r.reqAt && (r.doneAt === null || t < r.doneAt);
      const n = asked ? 3 - prioAt(r, t) : 0;
      pips[name].forEach((p, k) => show(p, k < n));
    });

    // the strip: tags appear as their bytes arrive; the parser walks to the tag it's reading
    const arrivedSlots = new Set();
    let parsedN = 0;
    m.tokens.forEach((tk, i) => {
      if (tk.arrive !== null && t >= tk.arrive && tokenSlot[i]) arrivedSlots.add(tokenSlot[i]);
      if (tk.parsedAt !== null && t >= tk.parsedAt) parsedN = i + 1;
    });
    const blocked = blockedNow(t), running = appRunning(t);
    for (const [n, tg] of Object.entries(tags)) {
      show(tg.g, arrivedSlots.has(n));
      const lit = n === "app" && (blocked || running);
      show(tg.lit, lit);
    }
    let at = Math.min(parsedN, m.tokens.length - 1);
    while (at > 0 && !tokenSlot[at]) at--;
    const target = G.slotXs[tokenSlot[at] || "css"];
    walkerX = snap ? target : walkerX + (target - walkerX) * (1 - Math.exp(-dt * 10));
    walker.setAttribute("transform", translateAlong(P, [walkerX - G.slotXs.css, 0, 0]));
    show(walkerOn, blocked); show(walkerOff, !blocked);

    // the main thread
    while (workAt < m.work.length && m.work[workAt].t1 <= t) workAt++;
    const w = m.work[workAt] && m.work[workAt].t0 <= t ? m.work[workAt] : null;
    for (const [k, th] of Object.entries(threads)) { const on = !!w && w.kind === k; show(th.on, on); show(th.off, !on); }

    // the phone: the latest frame the model drew
    let fi = frameAt;
    while (fi + 1 < m.frames.length && m.frames[fi + 1].t <= t) {
      fi++;
      if (m.frames[fi].shift > 0 && !snap) shiftUntil = realNow + 0.6;
    }
    frameAt = fi;
    const frame = fi >= 0 ? m.frames[fi] : null;
    show(pageG, !!frame);
    const shutterTo = frame ? SCREEN.top : BOTTOM;
    const z = snap ? shutterTo : shutterZ + (shutterTo - shutterZ) * (1 - Math.exp(-dt * 6));
    if (Math.abs(z - shutterZ) > 0.05 || snap) { shutterZ = Math.abs(z - shutterTo) < 0.1 ? shutterTo : z; shutter.innerHTML = shutterSvg(P, shutterZ); }
    if (frame) {
      const byId = new Map(frame.els.map((e) => [e.id, e]));
      for (const x of els) {
        const e = byId.get(x.e.id);
        let v = null;
        if (e) {
          if (x.e.kind === "text") v = frame.font === "invisible" ? "invisible" : frame.font === "web" ? "web" : m.cfg.matchFont ? "matched" : "fallback";
          else if (x.e.kind === "img" || x.e.kind === "ad") v = e.show ? "loaded" : e.h > 0 ? "placeholder" : null;
          else v = "box";
        }
        const shown = e && (v !== null) ? v : null;
        if (x.shown !== shown) {
          x.shown = shown;
          show(x.g, shown !== null);
          for (const [k, el] of Object.entries(x.vs)) show(el, k === shown);
        }
        if (e && x.top !== e.top) { x.top = e.top; x.g.setAttribute("transform", translateAlong(P, [0, 0, -e.top * SCREEN.scale])); }
      }
    }
    // the LCP tag: on the latest candidate
    let cand = null;
    for (const e of m.log) { if (e.t > t) break; if (e.type === "lcp") cand = e.el; }
    const ce = frame && cand ? frame.els.find((e) => e.id === cand) : null;
    show(lcpTag, !!ce);
    if (ce) lcpTag.setAttribute("transform", translateAlong(P, [0, 0, -Math.max(0, ce.top) * SCREEN.scale]));
    const shifting = realNow < shiftUntil;
    show(shiftOn, shifting); show(shiftOff, !shifting);

    // the console: each counter runs until its moment, then holds it
    const upTo = (when) => Math.round(when !== null && t >= when ? when : t);
    counters.fp.setClamped(upTo(m.firstPaint));
    counters.text.setClamped(upTo(m.textAt));
    counters.lcp.setClamped(upTo(m.lcp));
    let clsNow = 0;
    for (const s of shifts) if (s.t <= t) clsNow = s.cls;
    counters.cls.setClamped(Math.round(clsNow * 1000));
    meters.lcp.set(upTo(m.lcp) / 5000);
    meters.cls.set(clsNow / 0.5);
    clockDial.set((t % 5000) / 5000);

    showStats(t, clsNow);
    narrate(t);
  }

  function showStats(t, clsNow) {
    stat("fp", painted(t) ? s2(m.firstPaint) : "–");
    stat("text", textShown(t) ? s2(m.textAt) : "–");
    stat("lcp", m.lcp !== null && t >= m.lcp ? s2(m.lcp) : "–");
    stat("cls", painted(t) ? clsText(clsNow) : "–");
    const b = blockedFrom === null || t < blockedFrom ? 0 : Math.min(t, m.appDone ?? t) - blockedFrom;
    stat("blocked", s2(b));
    stat("app", m.appRan !== null && t >= m.appRan ? s2(m.appRan) : "–");
  }

  // ---------- the readout: the model's log as it passes ----------
  const RES = { css: "app.css", app: "app.js", font: L(T("the font", "la fuente")), hero: "hero.jpg", img2: "img2.jpg", img3: "img3.jpg", img4: "img4.jpg", adjs: "ads.js", ad: L(T("the ad", "el anuncio")), html: "HTML" };
  function line(e) {
    switch (e.type) {
      case "request":
        if (e.res === "html") return [1, T("requesting the HTML · new connection first", "pidiendo el HTML · primero una conexión nueva")];
        if (m.cfg.warm) return [2, T(RES[e.res] + " from the HTTP cache", RES[e.res] + " desde la caché HTTP")];
        if (e.why === "preload") return [3, T("preload tag · " + RES[e.res] + " requested early", "etiqueta preload · " + RES[e.res] + " pedido temprano")];
        if (e.why === "layout") return [4, T("first layout needs the font · requested now", "el primer layout necesita la fuente · se pide ahora")];
        if (e.why === "lazy") return [4, T("layout found lazy " + RES[e.res] + " in view · requested now", "el layout halló " + RES[e.res] + " (lazy) a la vista · se pide")];
        if (blockedNow(e.t)) return [3, T("parser stuck · preload scanner requests " + RES[e.res], "parser detenido · el escáner de precarga pide " + RES[e.res])];
        return [2, T("HTML names " + RES[e.res] + " · requested", "el HTML nombra " + RES[e.res] + " · se pide")];
      case "parserBlocked": return [5, T("parser stops at app.js · waits for it", "el parser se detiene en app.js · lo espera")];
      case "cssReady": return [4, blockedNow(e.t) ? T("stylesheet in · no body to paint yet", "llegó la hoja de estilos · aún no hay body que pintar") : T("stylesheet in · rendering can start", "llegó la hoja de estilos · ya se puede renderizar")];
      case "criticalCss": return [4, T("inline critical CSS · nothing to wait for", "CSS crítico en línea · nada que esperar")];
      case "appRun": return [5, e.how === "head" ? T("app.js runs · parser still waiting", "corre app.js · el parser sigue esperando") : T("app.js (" + e.how + ") runs · main thread busy", "corre app.js (" + e.how + ") · hilo principal ocupado")];
      case "firstPaint": return [6, painted(e.t) && !textShown(e.t) ? T("first paint · text invisible until the font", "primer pintado · texto invisible hasta la fuente") : T("first paint · shutter up", "primer pintado · cortina arriba")];
      case "boost": return [3, T(RES[e.res] + " is in the viewport · priority raised", RES[e.res] + " está en el viewport · sube su prioridad")];
      case "font": return e.state === "web" ? [5, T("web font in · text redrawn", "llegó la fuente web · texto redibujado")] : e.state === "fallback" ? [5, T("text shown in the fallback font", "texto con la fuente de respaldo")] : null;
      case "fontLocked": return [4, T("font too late for optional · fallback stays", "fuente tarde para optional · queda la de respaldo")];
      case "lcp": return [5, T("LCP candidate: " + (e.el === "hero" ? "hero" : e.el) + " at " + s2(e.t), "candidato a LCP: " + (e.el === "hero" ? "hero" : e.el) + " a los " + s2(e.t))];
      case "shift": return [6, T("layout shift · " + Math.round(e.dist) + " px · score " + e.score.toFixed(3), "salto de layout · " + Math.round(e.dist) + " px · puntaje " + e.score.toFixed(3))];
      case "adIn": return [4, m.cfg.sizeAd ? T("the ad fills its reserved slot", "el anuncio llena su espacio reservado") : T("the ad arrives · pushes the text down", "llega el anuncio · empuja el texto")];
      case "dcl": return [3, T("DOMContentLoaded at " + s2(e.t), "DOMContentLoaded a los " + s2(e.t))];
      default: return null;
    }
  }
  // Events pile up in `pending` (the most important, latest first); a line stays up at least 0.8 s unless something
  // more important comes along.
  function narrate(t) {
    for (; logAt < m.log.length && m.log[logAt].t <= t; logAt++) {
      const l = line(m.log[logAt]);
      if (l && (!pending || l[0] >= pending[0])) pending = l;
    }
    if (pending && (pending[0] >= said.prio || realNow - said.at > 0.8)) { say(pending[1]); said = { prio: pending[0], at: realNow }; pending = null; }
    if (endAt !== null) say(T("loaded · LCP " + (m.lcp !== null ? s2(m.lcp) : "–") + " · CLS " + clsText(m.cls) + " · loading again soon", "cargada · LCP " + (m.lcp !== null ? s2(m.lcp) : "–") + " · CLS " + clsText(m.cls) + " · vuelve a cargar pronto"));
  }

  // ---------- the loop ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    realNow += dt;
    if (endAt === null) {
      clock += dt * SLOW * cfg.speed;
      if (clock >= m.end) { clock = m.end; endAt = realNow; }
    } else if (realNow - endAt > HOLD) { restart(); return; }
    paint(false, dt);
  }, onPause: pause.onPause });
  pause.bind(loop);

  // ---------- controls ----------
  const MULTI = ["preload", "lazy", "reserve"];
  function set(name, raw, quiet) {
    if (name === "speed") { cfg.speed = Number(raw); root.press(name, raw); return; }
    if (MULTI.includes(name)) { cfg[name] = new Set(String(raw).split(" ").filter(Boolean)); root.press(name, [...cfg[name]]); }
    else { cfg[name] = String(raw); root.press(name, raw); }
    if (!quiet) { cfg.warm = false; restart(); say(T("settings applied · loading again", "ajustes aplicados · cargando de nuevo")); }
  }
  root.on("change", (name, value, detail) => {
    if (!MULTI.includes(name)) return set(name, value);
    // a multi-select segment: the clicked option switches on or off (the segment presses it itself)
    if (detail.pressed) cfg[name].add(value); else cfg[name].delete(value);
    cfg.warm = false;
    restart();
    say(T("settings applied · loading again", "ajustes aplicados · cargando de nuevo"));
  });
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    warm: () => { cfg.warm = true; restart(); say(T("repeat visit · all but the HTML from cache", "visita repetida · todo menos el HTML desde caché")); wake(); },
    reset: () => { cfg.warm = false; restart(); say(T("loading again · cold cache", "cargando de nuevo · caché vacía")); wake(); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const key of ["css", "js", "font", "preload", "lazy", "reserve", "speed"]) set(key, String(w[key]), true);
    cfg.warm = !!w.warm;
    restart();
    wake();
  });

  loop.setPaused(loop.paused);
  // The first load starts just after its first paint, so the still frame shows the page arriving.
  restart();
  clock = Math.min(m.end, (m.firstPaint ?? 0) + 350);
  paint(true);
}

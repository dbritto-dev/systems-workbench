// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The relay track in the browser: runs one page load of the model in slow motion. Runners leave when their request
// starts, wait at the server for its time, and run back with a crate; the chart board draws every request and every
// main-thread task as a bar against time, with the previous setup as dashed outlines; the page screen fills in as the
// parts land. When the load is done, the machine waits a moment and loads again with fresh server times. mount() gets
// the build-time data from page.ts (projection, geometry) and root, the <wb-lesson>.
import { translateAlong, sideMatrix, faceTextSvg } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setD, playPause } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { int } from "../../lib/format";
import { makeLoad, LANES, NAMES, PARTS, HOVER, DEFAULTS } from "./sim";

const SLOW = 5;          // real seconds per model second at ×1
const HOLD = 2.6;        // real seconds the finished page stays up before the next load
const FLASH = 120;       // model ms a landed crate or page part stays lit
const SPANS = [500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000];

export default function mount({ P, G }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const say = (v) => root.figure.say(L(v));
  const stat = (key, value) => root.stat(key, value);
  const variant = (g) => Object.fromEntries([...g.querySelectorAll(":scope > [data-v]")].map((v) => [v.dataset.v, v]));
  const pick = (vs, key) => { for (const [k, el] of Object.entries(vs)) show(el, k === key); };

  const runners = qa("[data-runner]").map((g) => ({ g, v: variant(g) }));
  const crates = qa("[data-crate]").map((g) => ({ g, v: variant(g) }));
  const services = Object.fromEntries(G.SERVICES.map((n) => [n, variant(q('[data-svc="' + n + '"]'))]));
  const parts = Object.fromEntries(PARTS.map((p) => [p, { el: q('[data-part="' + p + '"]'), lines: q('[data-part-lines="' + p + '"]') }]));
  const bars = { done: q('[data-bars="done"]'), live: q('[data-bars="live"]'), inner: q('[data-bars="inner"]') };
  const ghostEl = q("[data-ghost]"), ticksEl = q("[data-ticks]"), tickLabels = q("[data-tick-labels]"), nowEl = q("[data-now]");
  const js = { on: q('[data-js="on"]'), off: q('[data-js="off"]') };
  const counters = { ms: WB.counter(svg, "ms", P), chain: WB.counter(svg, "chain", P), flight: WB.counter(svg, "flight", P), landed: WB.counter(svg, "landed", P) };
  const C = G.CHART, Y = G.FACE_Y + 0.12;
  const rowZ = (i) => C.top - (i + 1) * C.rowH;
  const serviceOf = (name) => (name === "html" || name === "main" || name === "chunk" ? "cdn" : name);

  // ---------- settings and the run ----------
  const KEYS = ["mode", "split", "start", "rtt", "servers"];
  const cfg = { ...DEFAULTS, speed: 1 };
  const settings = () => Object.fromEntries(KEYS.map((k) => [k, cfg[k]]));
  let load, ghost = null, ghostCfg = null, clock, hold, seed = 3, tmin, span, events, lastMsg = null;

  function restart(newSeed = true) {
    if (newSeed) seed = (Date.now() % 1e6) + 1;
    load = makeLoad(settings(), seed);
    ghost = ghostCfg ? makeLoad(ghostCfg, seed) : null;
    clock = load.t0; hold = 0; lastMsg = null;
    tmin = Math.min(load.t0, ghost ? ghost.t0 : 0);
    const need = Math.max(load.all, ghost ? ghost.all : 0) + 40 - tmin;
    span = SPANS.find((s) => s >= need) || SPANS[SPANS.length - 1];
    events = buildEvents(load);
    drawAxis();
    setD(ghostEl, ghost ? barsOf(ghost, Infinity).all : "");
    for (const k of ["user", "comments", "all", "chain", "requests", "flight"]) stat(k, "–");
    paint();
  }
  // A setting changed: the old setup becomes the dashed outline, run with the same seed.
  function change(next) {
    const before = settings();
    Object.assign(cfg, next);
    const after = settings();
    if (KEYS.some((k) => before[k] !== after[k])) ghostCfg = before;
    restart();
  }

  // ---------- the chart ----------
  const tx = (t) => C.x0 + ((t - tmin) / span) * (C.x1 - C.x0);
  const rect = (x0, x1, z0, z1) => (x1 - x0 < 0.15 ? "" : WB.faceRectY(P, x0, x1, Y, z0, z1));
  const rowBar = (i, t0, t1, inset = 0.75) => rect(tx(t0), tx(t1), rowZ(i) + inset, rowZ(i) + C.rowH - inset);
  const CPU_ROW = G.ROWS.indexOf("cpu");
  // The bars of a load up to `now`: finished ones, the ones still running (lit), the server-side calls of /page.
  function barsOf(m, now) {
    let done = "", live = "", inner = "";
    LANES.forEach((name, i) => {
      const r = m.reqs[name];
      if (!r || now < r.t0) return;
      const d = rowBar(i, r.t0, Math.min(now, r.t1));
      if (now >= r.t1) done += d; else live += d;
      for (const c of r.inner) if (now >= c.t0) inner += rowBar(LANES.indexOf(c.name), c.t0, Math.min(now, c.t1), 1.6);
    });
    for (const c of m.cpu) {
      if (now < c.t0) continue;
      const d = rowBar(CPU_ROW, c.t0, Math.min(now, c.t1));
      if (now >= c.t1) done += d; else live += d;
    }
    return { done, live, inner, all: done + live + inner };
  }
  function drawAxis() {
    const step = span <= 1000 ? 100 : span <= 2500 ? 250 : 500, every = span <= 1000 ? 250 : span <= 2500 ? 500 : 1000;
    let d = "", labels = "";
    const tick = (t, h) => WB.faceRectY(P, tx(t), tx(t), Y, C.axis - h, C.axis).replace(/Z$/, "");
    d += WB.faceRectY(P, C.x0, C.x1, Y, C.axis, C.axis).replace(/Z$/, "");
    for (let t = Math.ceil(tmin / step) * step; t <= tmin + span + 1e-6; t += step) {
      const major = Math.abs(t % every) < 1e-6;
      d += tick(t, major ? 1.4 : 0.7);
      if (major && t >= 0) labels += label(t, t === 0 && cfg.start !== "first" && load.cfg.start !== "first" ? L("click", "clic") : (t / 1000).toFixed(every < 1000 ? 2 : 0).replace(/\.?0+$/, "") + " s");
    }
    if (tmin < 0) { d += tick(-HOVER, 1.4); labels += label(-HOVER, "hover"); }
    setD(ticksEl, d);
    tickLabels.innerHTML = labels;
  }
  const label = (t, text) => faceTextSvg(sideMatrix([tx(t), Y], C.label, P, "left"), text, { size: 2.2, tone: "mid", anchor: "middle" });

  // ---------- narration: what started, landed or showed last ----------
  function buildEvents(m) {
    const list = [];
    const byStart = new Map();
    for (const name of LANES) { const r = m.reqs[name]; if (!r) continue; const key = Math.round(r.t0 * 1000); if (!byStart.has(key)) byStart.set(key, []); byStart.get(key).push(r); }
    for (const group of byStart.values()) list.push({ t: group[0].t0, msg: startMsg(group, m) });
    for (const p of PARTS) list.push({ t: m.shown[p].t, msg: shownMsg(p, m) });
    if (m.cfg.start === "hover") list.push({ t: -HOVER, msg: m.cfg.mode === "loader" || m.cfg.mode === "bff"
      ? T("the pointer rests on the link · the router starts the route's loader now", "el puntero se posa en el enlace · el router arranca el loader de la ruta ya")
      : T("the pointer rests on the link · nothing to prefetch: the requests live in components that haven't rendered", "el puntero se posa en el enlace · nada que precargar: las solicitudes viven en componentes que no se renderizaron") });
    if (m.cfg.start !== "first") list.push({ t: 0, msg: T("click", "clic"), quiet: true });
    return list.sort((a, b) => a.t - b.t);
  }
  const join = (names, es) => { const n = names.map((x) => NAMES[x]); return n.length === 1 ? n[0] : n.slice(0, -1).join(", ") + (es ? " y " : " and ") + n[n.length - 1]; };
  function startMsg(group, m) {
    const names = group.map((r) => r.name), r = group[0], en = join(names, false), es = join(names, true), lazy = m.cfg.split === "lazy";
    if (r.name === "html") return T("the browser asks for the page's HTML", "el navegador pide el HTML de la página");
    if (r.name === "main") return T("the HTML names main.js · the browser asks for it", "el HTML nombra main.js · el navegador lo pide");
    if (r.name === "page") return T("one request, /page · the server calls the services itself, 2 ms away", "una sola solicitud, /page · el servidor llama a los servicios él mismo, a 2 ms");
    if (r.why === "app") return T("App mounts and asks for " + en + " at once", "App se monta y pide " + es + " a la vez");
    if (r.why === "loader" && r.name === "comments") return T("/posts landed · the loader asks for /comments right away", "llegó /posts · el loader pide /comments de inmediato");
    if (r.why === "loader") return T("the route loader asks for " + en + " before anything renders", "el loader de la ruta pide " + es + " antes de renderizar nada");
    if (r.name === "chunk" && r.why === "lazy" && (m.cfg.mode === "loader" || m.cfg.mode === "bff")) return T("the route also starts comments.js now", "la ruta también arranca comments.js ahora");
    if (r.name === "chunk") return T("the posts rendered · Comments is lazy, so first the browser asks for comments.js", "se renderizaron las publicaciones · Comments es diferido, así que primero el navegador pide comments.js");
    if (r.name === "user") return T("App rendered · it asks for /user", "App se renderizó · pide /user");
    if (r.name === "comments") return lazy ? T("comments.js ran · Comments renders and asks for /comments", "corrió comments.js · Comments se renderiza y pide /comments")
      : T("the posts rendered · Comments mounts and asks for /comments", "se renderizaron las publicaciones · Comments se monta y pide /comments");
    return T("the header rendered · Posts and Sidebar mount and ask for " + en, "se renderizó el encabezado · Posts y Sidebar se montan y piden " + es);
  }
  const PART_NAMES = { user: T("the header", "el encabezado"), posts: T("the posts", "las publicaciones"), notifs: T("the notifications", "las notificaciones"), comments: T("the comments", "los comentarios") };
  function shownMsg(p, m) {
    const at = int(m.shown[p].t) + " ms";
    if (m.shown[p].t === m.all) return T("all on screen at " + at + " · " + m.chain + " round trips in a row", "todo en pantalla a los " + at + " · " + m.chain + " viajes en cadena");
    return T(PART_NAMES[p].en + " on screen at " + at, PART_NAMES[p].es + " en pantalla a los " + at);
  }

  // ---------- painting ----------
  function paint() {
    const m = load, now = clock;
    // runners and crates
    let flight = 0, landed = 0, chain = 0;
    LANES.forEach((name, i) => {
      const r = m.reqs[name], rn = runners[i], cr = crates[i];
      if (!r) { show(rn.g, false); show(cr.g, false); return; }
      if (now >= r.t0) chain = Math.max(chain, r.depth);
      let x = G.RUN.start, v = "wait";
      if (now >= r.t1) { show(rn.g, false); show(cr.g, true); pick(cr.v, now - r.t1 < FLASH ? "on" : "off"); landed++; return; }
      show(cr.g, false); show(rn.g, true);
      if (now >= r.t0) {
        flight++;
        if (now < r.arrive) { x = lerp(G.RUN.start, G.RUN.server, (now - r.t0) / (r.arrive - r.t0)); v = "go"; }
        else if (now < r.leave) { x = G.RUN.server; v = "go"; }
        else { x = lerp(G.RUN.server, G.RUN.start, (now - r.leave) / (r.t1 - r.leave)); v = r.kb >= 100 ? "big" : "back"; }
      }
      pick(rn.v, v);
      rn.g.setAttribute("transform", translateAlong(P, [x, G.LANE_Y[i], 0]));
    });
    // the services working right now
    const busy = new Set();
    for (const r of Object.values(m.reqs)) {
      if (r.name !== "page" && now >= r.arrive && now < r.leave) busy.add(serviceOf(r.name));
      for (const c of r.inner) if (now >= c.t0 && now < c.t1) busy.add(c.name);
    }
    for (const [name, vs] of Object.entries(services)) pick(vs, busy.has(name) ? "on" : "off");
    // the main thread
    const running = m.cpu.find((c) => now >= c.t0 && now < c.t1);
    show(js.on, !!running); show(js.off, !running);
    // the chart
    const b = barsOf(m, now);
    setD(bars.done, b.done); setD(bars.live, b.live); setD(bars.inner, b.inner);
    setD(nowEl, now <= m.all ? WB.faceRectY(P, tx(now), tx(now), Y, C.axis, C.top + 0.4).replace(/Z$/, "") : "");
    // the page
    for (const p of PARTS) {
      const s = m.shown[p], on = now >= s.t;
      show(parts[p].el, on); show(parts[p].lines, on);
      parts[p].el.toggleAttribute("data-lit", on && now - s.t < FLASH);
    }
    // counters
    counters.ms.setClamped(Math.max(0, Math.min(now, m.all)));
    counters.chain.setClamped(chain); counters.flight.setClamped(flight); counters.landed.setClamped(landed);
    // narration
    let msg = null;
    for (const e of events) { if (e.t > now) break; if (!e.quiet || !msg) msg = e.msg; }
    if (!msg) msg = m.cfg.start === "first" ? T("loading…", "cargando…") : T("waiting for the click", "esperando el clic");
    if (now > m.all && hold > HOLD * 0.6) msg = T("loading the page again with fresh server times", "cargando la página de nuevo con tiempos de servidor nuevos");
    if (msg !== lastMsg) { lastMsg = msg; say(msg); }
    // stats
    const ms = (x) => int(x) + " ms";
    for (const [key, part] of [["user", "user"], ["comments", "comments"]]) if (now >= m.shown[part].t) stat(key, ms(m.shown[part].t));
    if (now >= m.all) { stat("all", ms(m.all)); stat("chain", String(m.chain)); stat("requests", String(m.requests)); stat("flight", String(m.flight)); }
    else stat("chain", String(chain));
  }

  // ---------- the loop ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    if (clock <= load.all) clock = Math.min(load.all + 1e-6, clock + (dt * cfg.speed * 1000) / SLOW);
    else { hold += dt * cfg.speed; if (hold > HOLD) restart(); }
    paint();
  }, onPause: pause.onPause });
  pause.bind(loop);

  root.on("change", (name, value) => {
    root.press(name, value);
    if (name === "speed") { cfg.speed = Number(value); return; }
    change({ [name]: name === "rtt" ? Number(value) : String(value) });
  });
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    reload: () => { restart(); wake(); },
    reset: () => {
      ghostCfg = null;
      Object.assign(cfg, DEFAULTS);
      for (const k of KEYS) root.press(k, cfg[k]);
      restart(); wake();
    },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": the experiment's setup, its "before" as the outline ----------
  root.on("watch", (w) => {
    for (const k of KEYS) { cfg[k] = k === "rtt" ? Number(w.after[k]) : w.after[k]; root.press(k, cfg[k]); }
    ghostCfg = { ...w.before };
    restart(); wake();
  });

  loop.setPaused(loop.paused);
  // The still frame: a moment into the first load, with runners on the track.
  restart(false);
  clock = Math.min(load.all, load.reqs.user ? (load.reqs.user.arrive + load.reqs.user.t0) / 2 : load.all / 2);
  paint();
}

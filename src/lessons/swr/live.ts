// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The copy rack in the browser: runs the model, paints the screen's tiles, the cache's cards, gauges and counters, the
// server's version counters and the requests on the network, narrates what happens, and answers the controls.
// mount() gets the build-time data from page.ts (projection, geometry, drawings) and root, the <wb-lesson>.
import { translateAlong, iso, pathOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, playPause } from "../../runtime/dom";
import { lerp, easeInOutCubic as ease } from "../../lib/tween";
import { clamp } from "../../lib/stats";
import { makeApp, RES, PAGES, AWAY, GC, FLIP, SAVE } from "./sim";

export default function mount({ P, G, RES_LABEL, CARD_SVG, CAPSULE_SVG, ENVELOPE_SVG, OTHER_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (v) => root.figure.say(L(v));
  const NS = "http://www.w3.org/2000/svg";
  const layer = (name) => q('[data-layer="' + name + '"]');
  const make = (html, parent) => { const g = document.createElementNS(NS, "g"); g.innerHTML = html; parent.appendChild(g); return g; };
  const label = (res) => RES_LABEL[RES.indexOf(res)];

  // ---------- the parts of the figure ----------
  const tiles = [...Array(G.slots)].map((_, i) => {
    const g = q('[data-tile="' + i + '"]');
    return { g, box: g.querySelector(".tile"), want: g.querySelector("[data-want]"), show: g.querySelector("[data-show]"), old: g.querySelector('[data-tag="old"]'), wrong: g.querySelector('[data-tag="wrong"]'), state: null };
  });
  const route = q("[data-route]");
  const lamps = Object.fromEntries(["away", "offline"].map((n) => [n, { off: q('[data-lamp="' + n + '"]'), on: q('[data-lamp-on="' + n + '"]') }]));
  const curtain = q("[data-curtain]"), gate = q("[data-gate]");
  const srv = [0, 1, 2, 3].map((i) => WB.counter(svg, "srv" + i, P));
  const use = [0, 1, 2, 3].map((i) => WB.counter(svg, "use" + i, P));
  const keyText = [0, 1, 2, 3].map((i) => q('[data-key="' + i + '"]'));
  const gcText = [0, 1, 2, 3].map((i) => q('[data-gc="' + i + '"]'));
  const inUse = [0, 1, 2, 3].map((i) => q('[data-inuse="' + i + '"]'));
  const pies = [0, 1, 2, 3].map((i) => q('[data-pie="' + i + '"]'));
  const cards = G.cardHome.map((home) => {
    const g = make(CARD_SVG, layer("cards"));
    g.setAttribute("transform", translateAlong(P, home));
    return { g, v: g.querySelector("[data-card-v]"), res: g.querySelector("[data-card-res]"), home, key: null, drop: null };
  });
  const others = G.OTHERS.map((p) => { const g = make(OTHER_SVG, layer("others")); g.setAttribute("transform", translateAlong(P, p)); return { g, p, until: 0 }; });

  // ---------- settings, scenarios and the run ----------
  const cfg = { stale: 0, gc: 300, fetch: "shared", key: "id", save: "inval", speed: 1 };
  // What each run plays: the simulated user ("auto"), or an experiment's script, looped.
  const flipScript = () => {
    const s = [[0, "goto", "user1"]];
    for (let x = 0, n = 1; x < FLIP.secs; n++) { x += FLIP.dwell[0] + (FLIP.dwell[1] - FLIP.dwell[0]) * ((n * 0.618) % 1); s.push([x, "goto", n % 2 ? "user2" : "user1"]); }
    return s;
  };
  const SCENARIOS = {
    auto: { auto: true },
    away: { script: [[0, "goto", "todos"], [AWAY.at, "leave"], [AWAY.at + AWAY.secs, "back"]], end: AWAY.at + AWAY.secs + 30 },
    dedupe: { script: [[0, "goto", "feed"]], header: false, end: 8 },
    gc: { script: [[0, "goto", "todos"], [GC.leave, "goto", "user1"], [GC.back, "goto", "todos"]], end: GC.back + 8 },
    key: { script: flipScript(), end: FLIP.secs },
    save: { script: [[0, "goto", "todos"], [SAVE.at, "edit", "todos"], [SAVE.leave, "leave"], [SAVE.back, "back"]], end: SAVE.back + 8 },
  };
  let scenario = "auto";
  let m, clock, logAt, history, seed = 7, lastSay = -9, quietSay = -9;

  function restart() {
    const sc = SCENARIOS[scenario];
    m = makeApp({
      staleTime: Number(cfg.stale), gcTime: Number(cfg.gc), shared: cfg.fetch === "shared", keyBug: cfg.key === "bug", invalidate: cfg.save === "inval",
      header: sc.header !== false, script: sc.script || [], auto: !!sc.auto,
    }, seed);
    seed = (Date.now() % 1e6) + 1;
    clock = 0; logAt = 0; lastSay = -9; quietSay = -9;
    history = [{ t: 0, time: { ...m.st.time } }];
    for (const c of cards) { c.key = null; c.drop = null; c.g.style.opacity = ""; }
    for (const el of flying.values()) el.g.remove();
    flying.clear();
    m.runTo(0);
    paint(0);
    showStats();
  }

  // ---------- which column of the rack a key lives in ----------
  // Shared cache: todos, stats, ['user', 1], ['user', 2] (or ['user'] in column 2 with the bug). No shared cache:
  // nothing is kept, and requests leave from the column of their resource.
  const KEY_TEXT = { todos: "['todos']", stats: "['stats']", "user,1": "['user', 1]", "user,2": "['user', 2]", user: "['user']" };
  const colOfKey = (key) => (key === "user" ? 2 : RES.indexOf(key === "user,1" ? "user1" : key === "user,2" ? "user2" : key));
  const colOfRes = (res) => RES.indexOf(res);
  function columnKeys() {
    if (cfg.fetch !== "shared") return [null, null, null, null];
    return cfg.key === "bug" ? ["todos", "stats", "user", null] : ["todos", "stats", "user,1", "user,2"];
  }

  // ---------- requests on the network ----------
  const flying = new Map();   // request id -> { g, kind }
  const fromY = G.RACK.y - 12, toY = G.SERVER_FACE + 4;   // from just behind the cards (so they don't hide it) to the drawer
  function paintRequests() {
    const seen = new Set();
    for (const r of [...m.flights, ...m.paused]) {
      seen.add(r.id);
      let el = flying.get(r.id);
      if (!el) { el = { g: make(r.kind === "save" ? ENVELOPE_SVG : CAPSULE_SVG, layer("wire")) }; flying.set(r.id, el); }
      const xFrom = G.colMid[r.kind === "fetch" && cfg.fetch === "shared" ? colOfKey(r.key) : colOfRes(r.res)];
      const xTo = G.colMid[colOfRes(r.res)];
      let x, y;
      if (r.paused) { x = xFrom; y = fromY; }
      else {
        const u = clamp((clock - r.t0) / r.lat);
        const leg = u < 0.5 ? ease(u * 2) : ease((1 - u) * 2);   // out to the server, then back
        x = lerp(xFrom, xTo, leg); y = lerp(fromY, toY, leg);
      }
      // several requests for one column (no shared cache) sit side by side
      el.g.setAttribute("transform", translateAlong(P, [x, y, G.NET_Z]));
    }
    for (const [id, el] of flying) if (!seen.has(id)) { el.g.remove(); flying.delete(id); }
  }

  // ---------- the cache ----------
  function piePath(cx, cy, frac) {
    if (frac <= 0.001) return "";
    const z = G.GAUGE.z + G.GAUGE.h + 0.05, r = G.GAUGE.r - 0.6, n = Math.max(2, Math.ceil(40 * frac));
    const pts = [iso([cx, cy, z], P)];
    for (let i = 0; i <= n; i++) { const a = (i / n) * frac * 2 * Math.PI; pts.push(iso([cx + r * Math.sin(a), cy - r * Math.cos(a), z], P)); }
    return pathOf(pts, true);
  }
  function paintCache(dt) {
    const keys = columnKeys();
    for (let i = 0; i < 4; i++) {
      const key = keys[i], e = key ? m.entries.get(key) : null, c = cards[i];
      setText(keyText[i], key ? KEY_TEXT[key] : cfg.fetch === "shared" ? "–" : "");
      use[i].setClamped(e ? e.observers.size : 0);
      // gauge: the share of staleTime left
      const fresh = e && e.data && !e.invalid && m.cfg.staleTime > 0 ? clamp(1 - (clock - e.updatedAt) / m.cfg.staleTime) : 0;
      const d = piePath(G.colMid[i] + G.GAUGE.dx, G.GAUGE.y, fresh);
      if (pies[i].getAttribute("d") !== d) pies[i].setAttribute("d", d);
      // gc countdown while nobody uses it
      const counting = !!(e && !e.observers.size && e.gcAt !== null);
      setText(gcText[i], counting ? L(T("GC IN ", "GC EN ")) + Math.max(0, e.gcAt - clock).toFixed(e.gcAt - clock < 10 ? 1 : 0) + " s" : "");
      // "IN USE" only under a column whose entry has someone using it
      show(inUse[i], !!(e && e.observers.size));
      // the card: shown while the entry exists; slides forward as its gc countdown runs; falls off when dropped
      if (c.drop) {
        const u = clamp((performance.now() - c.drop) / 700);
        c.g.setAttribute("transform", translateAlong(P, [c.home[0], lerp(c.home[1], G.RACK_FACE + 6, u), G.BASE_H * (1 - u * u)]));
        c.g.style.opacity = String(1 - u);
        if (u >= 1) { c.drop = null; c.g.style.display = "none"; c.g.style.opacity = ""; }
        continue;
      }
      show(c.g, !!e);
      if (!e) continue;
      c.key = key;
      const slide = !e.observers.size && e.gcAt !== null && m.cfg.gcTime > 0 ? clamp(1 - (e.gcAt - clock) / m.cfg.gcTime) : 0;
      c.g.setAttribute("transform", translateAlong(P, [c.home[0], c.home[1] + slide * 5, c.home[2]]));
      setText(c.v, e.data ? "v" + e.data.v : "···".slice(0, 1 + (Math.floor(clock * 3) % 3)));
      setText(c.res, e.data && e.data.res.startsWith("user") ? label(e.data.res) : "");
    }
  }

  // ---------- the screen ----------
  function paintScreen() {
    for (let i = 0; i < tiles.length; i++) {
      const el = tiles[i], tile = i < m.tiles.length ? m.tiles[i] : null;
      if (i >= 10) { show(el.g, false); continue; }
      let state = "empty", want = "", text = "";
      if (tile) {
        const s = m.show(tile);
        state = s.state; want = label(tile.res);
        text = state === "loading" ? "·".repeat(1 + (Math.floor(clock * 3) % 3)) : state === "wrong" ? label(s.res) + " v" + s.v : "v" + s.v;
      }
      if (el.state !== state) { el.state = state; el.box.setAttribute("data-state", state); show(el.old, state === "old"); show(el.wrong, state === "wrong"); }
      setText(el.want, want); setText(el.show, text);
      const size = state === "wrong" ? "2.8" : "3.4";
      if (el.show.getAttribute("font-size") !== size) el.show.setAttribute("font-size", size);
    }
    setText(route, m.page ? PAGES[m.page].path : "");
    show(curtain, !m.focused); show(lamps.away.on, !m.focused); show(lamps.away.off, m.focused);
    show(gate, !m.online); show(lamps.offline.on, !m.online); show(lamps.offline.off, m.online);
  }

  function paint(dt) {
    narrate();
    paintScreen();
    paintCache(dt);
    paintRequests();
    RES.forEach((r, i) => srv[i].setClamped(m.server[r]));
    const now = performance.now();
    for (const o of others) {
      const u = o.until > now ? Math.sin(Math.PI * (1 - (o.until - now) / 600)) : 0;
      o.g.setAttribute("transform", translateAlong(P, [o.p[0], o.p[1], o.p[2] + 4 * u]));
    }
  }

  // ---------- narration: the model's log ----------
  const KEY = (k) => KEY_TEXT[k] || label(k.split("#")[0]);
  function narrate() {
    for (; logAt < m.log.length; logAt++) {
      const e = m.log[logAt];
      if (e.t > clock) break;
      let msg = null, quiet = false;
      if (e.type === "goto") msg = T("→ " + PAGES[e.page].path, "→ " + PAGES[e.page].path);
      else if (e.type === "fetch") {
        const k = KEY(e.key);
        if (!e.background) msg = cfg.fetch === "shared" ? T(k + ": nothing cached · spinner · request sent", k + ": sin caché · cargando · solicitud enviada") : T(label(e.res) + ": the component fetches for itself · spinner", label(e.res) + ": el componente pide por su cuenta · cargando");
        else if (e.why === "mount") msg = T(k + ": cached copy shown at once · it is stale, so refetching in the background", k + ": copia en caché mostrada al instante · está vieja, así que se vuelve a pedir en segundo plano");
        else if (e.why === "focus") msg = T("back in the tab · " + k + " is stale · refetching", "de vuelta en la pestaña · " + k + " está vieja · se vuelve a pedir");
        else if (e.why === "reconnect") msg = T("network back · " + k + " is stale · refetching", "volvió la red · " + k + " está vieja · se vuelve a pedir");
        else if (e.why === "invalidate") msg = T("save done · " + k + " invalidated · refetching", "guardado · " + k + " invalidada · se vuelve a pedir");
      } else if (e.type === "join") msg = T(KEY(e.key) + ": a request is already in flight · this tile waits for the same answer", KEY(e.key) + ": ya hay una solicitud en vuelo · este panel espera la misma respuesta");
      else if (e.type === "fresh") {
        const en = m.entries.get(e.key), age = en ? Math.max(0, e.t - en.updatedAt) : 0;
        msg = T(KEY(e.key) + ": fresh copy (" + age.toFixed(0) + " s old) · no request", KEY(e.key) + ": copia fresca (" + age.toFixed(0) + " s) · sin solicitud");
      } else if (e.type === "answer") {
        if (e.users) msg = e.was ? T(KEY(e.key) + ": v" + e.v + " arrives · " + e.users + (e.users === 1 ? " tile updates" : " tiles update"), KEY(e.key) + ": llega v" + e.v + " · " + (e.users === 1 ? "se actualiza 1 panel" : "se actualizan " + e.users + " paneles"))
          : T(KEY(e.key) + ": v" + e.v + " arrives · spinner gone", KEY(e.key) + ": llega v" + e.v + " · fin de la carga");
        quiet = !!e.was && e.was.v === e.v && e.was.res === e.res;
      } else if (e.type === "gc") msg = T(KEY(e.key) + ": unused for gcTime · dropped from the cache", KEY(e.key) + ": sin usar durante gcTime · borrada de la caché");
      else if (e.type === "others") {
        const o = others[RES.indexOf(e.res) % others.length]; o.until = performance.now() + 600;
        msg = T("someone else edits " + label(e.res) + " · server now v" + e.v, "otra persona edita " + label(e.res) + " · el servidor tiene v" + e.v);
        quiet = true;
      } else if (e.type === "leave") msg = T("the user switches to another tab · nothing refetches while away", "el usuario se va a otra pestaña · nada se vuelve a pedir mientras no está");
      else if (e.type === "back") msg = T("the user is back · the tab regains focus", "el usuario vuelve · la pestaña recupera el foco");
      else if (e.type === "offline") msg = T("network down · new requests wait", "red caída · las solicitudes nuevas esperan");
      else if (e.type === "online") msg = T("network back", "volvió la red");
      else if (e.type === "save") msg = T("the user saves an edit to " + label(e.res), "el usuario guarda un cambio en " + label(e.res));
      else if (e.type === "saved") msg = cfg.save === "inval" || cfg.fetch !== "shared" ? null : T("saved as v" + e.v + " · the cache still holds the old copy", "guardado como v" + e.v + " · la caché sigue con la copia vieja");
      if (e.type === "gc") { const c = cards[colOfKey(e.key)]; if (c && cfg.fetch === "shared") c.drop = performance.now(); }
      if (!msg) continue;
      // quiet news (an edit elsewhere, an answer that changes nothing) only when nothing else was said lately
      if (quiet && e.t - lastSay < 1.5) continue;
      say(msg); if (!quiet) lastSay = e.t;
    }
    if (logAt > 4000) { m.log.splice(0, logAt); logAt = 0; }
  }

  // ---------- stats: Old on screen and Wrong data over the last 30 s ----------
  function showStats() {
    const now = { t: clock, time: { ...m.st.time } };
    history.push(now);
    while (history.length > 2 && history[1].t <= clock - 30) history.shift();
    const a = history[0], d = (k) => now.time[k] - a.time[k];
    const total = d("loading") + d("wrong") + d("old") + d("current");
    root.stat("requests", m.st.requests);
    root.stat("spinners", m.st.spinners);
    root.stat("old", total > 0.5 ? Math.round((100 * d("old")) / total) + "%" : "–");
    root.stat("wrong", total > 0.5 ? Math.round((100 * d("wrong")) / total) + "%" : "–");
    root.stat("keys", cfg.fetch === "shared" ? m.entries.size : 0);
    root.stat("gc", m.st.gcs);
  }

  // ---------- the loop ----------
  let statTimer = 0;
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    clock += dt * cfg.speed;
    const end = SCENARIOS[scenario].end;
    if (end && clock > end) { restart(); say(T("again from the start", "otra vez desde el principio")); return; }
    m.runTo(clock);
    paint(dt);
    statTimer += dt; if (statTimer > 0.25) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = String(raw);
    if (!quiet) { restart(); say(T("settings applied · run restarted", "ajustes aplicados · ejecución reiniciada")); }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    away: () => { if (!m.live.leave(clock, 20)) say(T("already away", "ya está fuera")); wake(); },
    offline: () => { if (!m.live.offline(clock, 8)) say(T("already offline", "ya no hay red")); wake(); },
    edit: () => {
      const res = m.page ? PAGES[m.page].tiles[0] : "todos";
      m.live.edit(clock, res); wake();
    },
    reset: () => { scenario = "auto"; restart(); say(T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings and script ----------
  root.on("watch", (w) => {
    for (const k of ["stale", "gc", "fetch", "key", "save"]) set(k, w[k], true);
    set("speed", String(w.speed), true);
    scenario = w.scenario;
    restart();
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

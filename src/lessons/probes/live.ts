// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The shopping street in the browser: runs the probe model, raises and lowers signs and pegs, rebuilds shops, walks
// customers to open shops, and answers the controls. mount() gets the build-time data from page.ts (geometry, the
// customer drawing, experiment titles) and root, the <wb-lesson>.
import { cylinder, solidSvg, translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { playPause } from "../../runtime/dom";
import { easeInOutQuad } from "../../lib/tween";
import { polylineLength, pointAlong } from "../../lib/geometry";
import { makeSim } from "./sim";

export default function mount({ P, G, TOKEN_SVG, TITLES }, root) {
  const NS = "http://www.w3.org/2000/svg";
  const WALK = 95, SPAWN_EVERY = 0.28;

  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const stat = (key, value) => root.stat(key, value);
  const tell = (v) => say(L(v));
  const ease = easeInOutQuad;
  const shops = G.SHOP_X.map((cx, i) => {
    const g = q('[data-shop="' + i + '"]');
    return {
      cx, building: g.querySelector("[data-building]"), scaffold: g.querySelector("[data-scaffold]"), shut: g.querySelector("[data-shop-shut]"), jam: g.querySelector("[data-jam]"),
      crates: [0, 1, 2, 3].map((n) => g.querySelector('[data-crate="' + i + "-" + n + '"]')),
      sign: g.querySelector("[data-sign-plate]"), signSolid: g.querySelector("[data-sign-plate] .iso-solid"),
      tallies: [0, 1, 2].map((n) => g.querySelector('[data-tally="' + i + "-" + n + '"]')), slots: [0, 1, 2].map((n) => g.querySelector('[data-slot="' + i + "-" + n + '"]')),
      pips: Array.from({ length: G.PIPS }, (_, n) => g.querySelector('[data-pip="' + i + "-" + n + '"]')),
      peg: q('[data-peg="' + i + '"]'), signAt: G.TABLEAU[i].ready ? 0 : -G.SIGN_DROP, pegUp: G.TABLEAU[i].ready, lit: G.TABLEAU[i].ready, shown: {},
    };
  });
  const houseShut = q("[data-house-shut]");
  const layer = q("[data-customers]");
  layer.replaceChildren();
  const pool = Array.from({ length: 36 }, () => { const g = document.createElementNS(NS, "g"); g.innerHTML = TOKEN_SVG; g.style.display = "none"; layer.appendChild(g); return { g, edges: [...g.querySelectorAll(".iso-edge")], busy: false, failed: false }; });

  const cfg = { readiness: "shop", liveness: "shop", timeout: 5, threshold: 3, boot: 12, startupProbe: false, load: 0.5, speed: 1 };
  let model, simTime, tokens, spawnClock, seed = (Date.now() % 1e6) + 1, lastEvent = 0, history;

  function options() { const { speed, ...rest } = cfg; return rest; }
  // The first frame: one shop rebuilding, one jammed, one restocking (the same tableau the static figure shows).
  function tableau() {
    G.TABLEAU.forEach((st, i) => {
      const s = model.shops[i];
      s.restarts = st.restarts; s.inRow = st.restarts; model.totals.restarts += st.restarts;
      if (st.phase === "down") { s.phase = "down"; s.phaseT = 0; s.downFor = 9; s.ready = false; s.containerAge = 0; }
      if (st.phase === "dead") { s.phase = "dead"; s.phaseT = 0; s.fails = st.fails; s.ready = false; }
      if (st.phase === "warm") { s.phase = "warm"; s.phaseT = (st.stock / 5) * model.cfg.warm; s.ready = false; s.containerAge = model.cfg.boot + s.phaseT; s.runFor = 0; }
    });
    model.disrupt();
  }
  function restart(withTableau = true) {
    model = makeSim(options(), seed++);
    if (withTableau) tableau();
    simTime = 0; tokens = []; spawnClock = 0; lastEvent = 0; history = [];
    pool.forEach((p) => { p.busy = false; p.g.style.display = "none"; });
    shops.forEach((s) => { s.shown = {}; s.pegUp = null; });
    paint(0); showStats();
    tell(withTableau ? T("shop 2 rebuilding · shop 3 jammed · shop 4 restocking", "tienda 2 en reconstrucción · tienda 3 atascada · tienda 4 reabasteciéndose") : T("five shops open", "cinco tiendas abiertas"));
  }
  function apply() { Object.assign(model.cfg, options()); }

  function setShown(s, key, el, on) { if (s.shown[key] !== on) { s.shown[key] = on; el.style.display = on ? "" : "none"; } }
  function paint(realDt) {
    houseShut.style.display = model.warehouseUp ? "none" : "";
    model.shops.forEach((m, i) => {
      const s = shops[i];
      setShown(s, "building", s.building, m.phase !== "down");
      setShown(s, "scaffold", s.scaffold, m.phase === "down");
      setShown(s, "shut", s.shut, m.phase === "boot");
      setShown(s, "jam", s.jam, m.phase === "dead");
      const stock = m.phase === "warm" ? Math.min(4, Math.floor((m.phaseT / model.cfg.warm) * 5)) : (m.phase === "run" || m.phase === "dead") ? 4 : 0;
      s.crates.forEach((c, n) => setShown(s, "c" + n, c, n < stock));
      const target = m.ready ? 0 : -G.SIGN_DROP;
      s.signAt += (target - s.signAt) * Math.min(1, realDt * 8);
      if (Math.abs(target - s.signAt) < 0.05) s.signAt = target;
      s.sign.setAttribute("transform", s.signAt ? translateAlong(P, [0, 0, s.signAt]) : "");
      if (s.lit !== m.ready) { s.lit = m.ready; s.signSolid.toggleAttribute("data-lit", m.ready); s.signSolid.querySelector(".iso-edge").setAttribute("data-tone", m.ready ? "hi" : "mid"); }
      if (s.pegUp !== m.ready) {
        s.pegUp = m.ready;
        const [x, y] = G.PEGS[i];
        s.peg.innerHTML = solidSvg(cylinder(x, y, 1.2, G.KIOSK_TOP, m.ready ? 5 : 1, P, 14, 0.2), { tone: m.ready ? "hi" : "lo", crease: "lo", lit: m.ready });
      }
      s.tallies.forEach((t, n) => setShown(s, "t" + n, t, n < m.fails));
      s.slots.forEach((el, n) => setShown(s, "s" + n, el, n < model.cfg.threshold));
      s.pips.forEach((el, n) => setShown(s, "p" + n, el, n < m.restarts));
    });
    paintTokens(realDt);
  }

  function spawn() {
    const p = pool.find((x) => !x.busy); if (!p) return;
    const ready = model.shops.filter((m) => m.ready);
    if (!ready.length) { p.busy = true; tokens.push({ p, path: [[G.SPAWN[0], G.SPAWN[1]], [G.SPAWN[0] + 26, G.SPAWN[1]]], ok: false, t: 0 }); return; }
    const m = ready[Math.floor(Math.random() * ready.length)];
    const cx = G.SHOP_X[m.i];
    const ok = m.phase === "run" && model.warehouseUp;
    p.busy = true;
    tokens.push({ p, path: [[G.SPAWN[0], G.SPAWN[1]], [cx, G.WALK_Y], [cx, G.SHOP.y1 + 5]], ok, t: 0 });
  }
  function paintTokens(realDt) {
    for (const tk of tokens) {
      tk.t += realDt;
      const len = polylineLength(tk.path), go = len / WALK, back = tk.ok ? 0.35 : Math.min(go, 1.2);
      let d, opacity = 1, lit = false;
      if (tk.t < go) d = ease(tk.t / go) * len;
      else if (tk.ok) { d = len; opacity = 1 - (tk.t - go) / back; }
      else { const u = (tk.t - go) / back; d = len * (1 - ease(Math.min(1, u))); lit = true; opacity = u > 0.75 ? (1 - u) / 0.25 : 1; }
      const [x, y] = pointAlong(tk.path, d);
      tk.p.g.setAttribute("transform", translateAlong(P, [x, y, 0]));
      tk.p.g.style.opacity = String(Math.max(0, opacity));
      tk.p.g.style.display = "";
      if (tk.p.failed !== lit) { tk.p.failed = lit; tk.p.edges.forEach((e) => e.setAttribute("data-tone", lit ? "lo" : "hi")); }
      if (tk.t >= go + back) { tk.done = true; tk.p.busy = false; tk.p.g.style.display = "none"; }
    }
    tokens = tokens.filter((tk) => !tk.done);
  }

  function showStats() {
    const tot = model.totals;
    stat("served", Math.round(tot.served));
    stat("errors", Math.round(tot.errors));
    stat("restarts", tot.restarts);
    stat("ready", model.readyCount() + " / 5");
    history.push({ t: model.t, a: tot.arrived, e: tot.errors });
    while (history.length > 2 && history[1].t < model.t - 10) history.shift();
    const h0 = history[0], da = tot.arrived - h0.a, de = tot.errors - h0.e;
    stat("rate", da > 0 ? Math.round((100 * de) / da) + "%" : "0%");
    stat("recover", model.lastDisruption === null ? "–" : model.recovered !== null ? Math.round(model.recovered - model.lastDisruption) + " s" : L("waiting", "esperando"));
  }

  let statTimer = 0;
  function step(dt) {
    simTime += dt * cfg.speed;
    model.runTo(simTime);
    spawnClock += dt;
    while (spawnClock >= SPAWN_EVERY) { spawnClock -= SPAWN_EVERY; spawn(); }
    paint(dt);
    if (model.events.length && model.events[model.events.length - 1] !== lastEvent) { lastEvent = model.events[model.events.length - 1]; tell(lastEvent.text); }
    statTimer += dt; if (statTimer > 0.25) { statTimer = 0; showStats(); }
  }

  // ---------- controls ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage, step, onPause: pause.onPause });
  pause.bind(loop);
  const NUMERIC = ["timeout", "threshold", "boot", "load", "speed"];
  function set(name, raw) {
    cfg[name] = NUMERIC.includes(name) ? Number(raw) : name === "startupProbe" ? raw === true || raw === "true" : raw;
    root.press(name, raw);
    if (name !== "speed") apply();
  }
  function act(name) {
    if (name === "blip") model.blip(30);
    if (name === "jam") model.deadlock(2);
    if (name === "restart") { model.restartShop(3); model.restartShop(4); }
    if (name === "restart1") model.restartShop(2);
    if (loop.paused) loop.setPaused(false);
  }
  root.on("change", (name, value) => set(name, value));
  const actions = { blip: () => act("blip"), jam: () => act("jam"), restart: () => act("restart"), reset: () => restart() };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w, id) => {
    restart(false);
    for (const name of ["readiness", "liveness", "timeout", "threshold", "boot", "startupProbe", "load"]) set(name, String(w[name]));
    if (loop.paused) loop.setPaused(false);
    if (w.act) setTimeout(() => act(w.act), 2500);
    tell(T("watching: " + TITLES[id].en.toLowerCase(), "observando: " + TITLES[id].es.toLowerCase()));
  });

  loop.setPaused(loop.paused);
  restart();
}

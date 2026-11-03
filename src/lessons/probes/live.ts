// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The shopping street in the browser: runs the probe model, raises and lowers signs and pegs, rebuilds shops, walks
// customers to open shops, and wires the controls and the experiment cards. mount() gets the build-time data from
// page.ts (geometry, the customer drawing, experiment results).
import { cylinder, solidSvg, translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats, act as button, pauseControls } from "../../runtime/dom";
import { easeInOutQuad } from "../../lib/tween";
import { n0 } from "../../lib/format";
import { polylineLength, pointAlong } from "../../lib/geometry";
import { makeSim } from "./sim";

export default function mount({ P, G, TOKEN_SVG, RESULTS, EXPERIMENTS }) {
  const NS = "http://www.w3.org/2000/svg";
  const WALK = 95, SPAWN_EVERY = 0.28;

  const stage = document.querySelector("[data-office]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const say = readout();
  const stat = stats();
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
  const pause = pauseControls(stage, say);
  const loop = WB.loop({ stage, step, onPause: pause.onPause });
  pause.bind(loop);
  const NUMERIC = ["timeout", "threshold", "boot", "load", "speed"];
  function set(name, raw) {
    cfg[name] = NUMERIC.includes(name) ? Number(raw) : name === "startupProbe" ? raw === true || raw === "true" : raw;
    WB.pressSeg(name, raw);
    if (name !== "speed") apply();
  }
  function act(name) {
    if (name === "blip") model.blip(30);
    if (name === "jam") model.deadlock(2);
    if (name === "restart") { model.restartShop(3); model.restartShop(4); }
    if (name === "restart1") model.restartShop(2);
    if (loop.paused) loop.setPaused(false);
  }
  WB.onSegments((name, value) => set(name, value));
  for (const name of ["blip", "jam", "restart"]) button(name).addEventListener("click", () => act(name));
  button("reset").addEventListener("click", () => restart());

  // ---------- experiments (numbers computed at build time from the same model, 4 seeds each) ----------
  const r = n0;
  const top = (...xs) => Math.max(1, ...xs);
  const RUNS = {
    readiness: () => {
      const { off, on } = RESULTS.readiness, m = top(off.errors, on.errors);
      return { verdict: T("Errors over the 70 s after the deploy: " + r(off.errors) + " of about " + r(off.arrived * 70 / 90) + " customers without a readiness probe, " + r(on.errors) + " with one.",
          "Errores en los 70 s después del despliegue: " + r(off.errors) + " de unos " + r(off.arrived * 70 / 90) + " clientes sin sonda de readiness, " + r(on.errors) + " con una."),
        bars: [[T("No readiness", "Sin readiness"), off.errors / m, String(r(off.errors)), true], [T("Readiness", "Con readiness"), on.errors / m, String(r(on.errors))]] };
    },
    deps: () => {
      const { live, ready } = RESULTS.deps, m = top(live.back, ready.back);
      return { verdict: T("All five shops open again " + live.back.toFixed(0) + " s after the warehouse is back when liveness checks it (" + r(live.restarts) + " restarts), " + ready.back.toFixed(0) + " s when only readiness does (" + r(ready.restarts) + " restarts).",
          "Las cinco tiendas vuelven a abrir " + live.back.toFixed(0) + " s después de que vuelve el almacén cuando lo revisa liveness (" + r(live.restarts) + " reinicios), y " + ready.back.toFixed(0) + " s cuando solo lo revisa readiness (" + r(ready.restarts) + " reinicios)."),
        bars: [[T("Liveness: warehouse", "Liveness: almacén"), live.back / m, live.back.toFixed(0) + " s", true], [T("Readiness: warehouse", "Readiness: almacén"), ready.back / m, ready.back.toFixed(0) + " s"], [T("Errors, liveness", "Errores, liveness"), live.errors / top(live.errors, ready.errors), String(r(live.errors)), true], [T("Errors, readiness", "Errores, readiness"), ready.errors / top(live.errors, ready.errors), String(r(ready.errors))]] };
    },
    timeout: () => {
      const { loose, tight } = RESULTS.timeout, m = top(loose.restarts, tight.restarts), e = top(loose.errors, tight.errors);
      return { verdict: T("In 5 minutes at 90% traffic: " + tight.restarts.toFixed(1) + " restarts and " + r(tight.errors) + " errors with a 1 s timeout, " + loose.restarts.toFixed(1) + " restarts and " + r(loose.errors) + " errors with 5 s.",
          "En 5 minutos con tráfico al 90%: " + tight.restarts.toFixed(1) + " reinicios y " + r(tight.errors) + " errores con un timeout de 1 s, " + loose.restarts.toFixed(1) + " reinicios y " + r(loose.errors) + " errores con 5 s."),
        bars: [[T("Restarts, 1 s", "Reinicios, 1 s"), tight.restarts / m, tight.restarts.toFixed(1), true], [T("Restarts, 5 s", "Reinicios, 5 s"), loose.restarts / m, loose.restarts.toFixed(1)], [T("Errors, 1 s", "Errores, 1 s"), tight.errors / e, String(r(tight.errors)), true], [T("Errors, 5 s", "Errores, 5 s"), loose.errors / e, String(r(loose.errors))]] };
    },
    startup: () => {
      const { none, probe } = RESULTS.startup, m = top(none.back, probe.back);
      const never = none.back >= 295;
      return { verdict: T("Without a startup probe the shop was restarted " + none.restarts.toFixed(0) + " times and " + (never ? "never opened in 5 minutes" : "opened after " + none.back.toFixed(0) + " s") + ". With one it opened after " + probe.back.toFixed(0) + " s, with " + probe.restarts.toFixed(0) + " restarts.",
          "Sin sonda de arranque la tienda se reinició " + none.restarts.toFixed(0) + " veces y " + (never ? "nunca abrió en 5 minutos" : "abrió después de " + none.back.toFixed(0) + " s") + ". Con una abrió después de " + probe.back.toFixed(0) + " s, con " + probe.restarts.toFixed(0) + " reinicios."),
        bars: [[T("No startup probe", "Sin sonda de arranque"), none.back / m, never ? T("never", "nunca") : none.back.toFixed(0) + " s", true], [T("Startup probe", "Con sonda de arranque"), probe.back / m, probe.back.toFixed(0) + " s"]] };
    },
    deadlock: () => {
      const { neither, ready, both } = RESULTS.deadlock, m = 160, e = top(neither.errors, ready.errors, both.errors);
      const label = (x) => (x >= 159 ? T("never", "nunca") : T(x.toFixed(0) + " s", x.toFixed(0) + " s"));
      return { verdict: T("Over 160 s: no probes, " + r(neither.errors) + " errors and shop 3 never recovers; readiness only, " + r(ready.errors) + " errors and it never recovers; readiness and liveness, " + r(both.errors) + " errors and it is back after " + label(both.back).en + ".",
          "En 160 s: sin sondas, " + r(neither.errors) + " errores y la tienda 3 nunca se recupera; solo readiness, " + r(ready.errors) + " errores y nunca se recupera; readiness y liveness, " + r(both.errors) + " errores y vuelve después de " + label(both.back).es + "."),
        bars: [[T("Back: readiness only", "Vuelve: solo readiness"), ready.back / m, label(ready.back), true], [T("Back: + liveness", "Vuelve: + liveness"), both.back / m, label(both.back)], [T("Errors: no probes", "Errores: sin sondas"), neither.errors / e, String(r(neither.errors))], [T("Errors: readiness", "Errores: readiness"), ready.errors / e, String(r(ready.errors)), true]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    restart(false);
    for (const name of ["readiness", "liveness", "timeout", "threshold", "boot", "startupProbe", "load"]) set(name, String(w[name]));
    if (loop.paused) loop.setPaused(false);
    if (w.act) setTimeout(() => act(w.act), 2500);
    tell(T("watching: " + exp.title.en.toLowerCase(), "observando: " + exp.title.es.toLowerCase()));
  } });

  loop.setPaused(loop.paused);
  restart();
}

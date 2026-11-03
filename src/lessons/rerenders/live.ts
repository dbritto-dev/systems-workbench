// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The component board in the browser: runs the model for each interaction (a keystroke, a pick, an item added to the
// cart), lights each rendered component as the wave reaches its row, works the memo gates, flashes the DOM changes on
// the page, and answers the controls. mount() gets the build-time data from page.ts and root, the <wb-lesson>.
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, setLit } from "../../runtime/dom";
import { playPause } from "../../runtime/dom";
import { rngMixed } from "../../lib/random";
import { makeApp, NODES, N, suggestionsFor, SEARCHES } from "./sim";

const LAG = 0.11;      // s between one row of the tree and the next, as the wave runs down
const HOLD = 0.5;      // s a component stays lit after it renders
const FRAME = 1000 / 60;
const FLAGS_FOR = { top: ["App"], down: ["App", "UserMenu", "Sidebar", "SearchPanel", "ResultList"], context: ["App"], split: ["App"], store: ["Store"] };

export default function mount({ P, G }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (v) => root.figure.say(L(v));
  const stat = (key, value) => root.stat(key, value);

  // ---------- the figure's moving parts ----------
  const solids = NODES.map((n) => q(G.BANKS[n.name] ? `[data-stud="${n.name}-${n.index}"]` : `[data-comp="${n.name}"]`));
  const edges = Object.fromEntries(G.EDGES.map((name) => [name, q(`[data-edge="${name}"]`)]));
  const gates = Object.fromEntries(G.GATES.map((name) => [name, { g: q(`[data-gate="${name}"]`), shut: q(`[data-variants="gate-${name}"] [data-variant="shut"]`) }]));
  const flags = Object.fromEntries([...svg.querySelectorAll("[data-flag]")].map((el) => [el.dataset.flag, el]));
  const dom = Object.fromEntries([...svg.querySelectorAll("[data-dom]")].map((el) => [el.dataset.dom, el]));
  const pageText = { query: q('[data-page="query"]'), cart: q('[data-page="cart"]'), suggest: q('[data-page="suggest"]') };
  const counters = { renders: WB.counter(svg, "renders", P), dom: WB.counter(svg, "dom", P), selectors: WB.counter(svg, "selectors", P) };
  const workMeter = WB.meter(svg, "work", P);

  // Light intervals [from, to) per thing; the frame paints whatever changed.
  const lights = new Map();     // key -> { from, to, on }
  function light(key, from, to) {
    const l = lights.get(key);
    if (l && l.to > from && l.from <= from) l.to = Math.max(l.to, to);   // still lit: stay lit
    else lights.set(key, { from, to, on: l ? l.on : false });
  }
  const pending = [];          // [{ at, fn }]: page text and readout, when the wave gets there

  // ---------- settings and the run ----------
  const cfg = { source: "top", memo: "off", input: "key", speed: 1 };
  let app, clock, nextAt, jitter, seed = 5;

  function restart() {
    app = makeApp({ source: cfg.source, memo: cfg.memo }, seed);
    jitter = rngMixed(seed * 31 + 7);
    seed = (Date.now() % 1e6) + 1;
    clock = 0; nextAt = 0.4;
    pending.length = 0;
    for (const [key, l] of lights) { if (l.on) paintKey(key, false); }
    lights.clear();
    const flagsOn = new Set(FLAGS_FOR[cfg.source]);
    for (const [name, f] of Object.entries(flags)) { show(f, flagsOn.has(name)); setLit(f, false); }
    for (const [name, g] of Object.entries(gates)) { show(g.g, cfg.memo !== "off"); WB.pose(svg, "gate-" + name, "shut"); setLit(g.shut, false); }
    paintPage();
    for (const k of Object.keys(dom)) dom[k].removeAttribute("data-on");
    counters.renders.set(0); counters.dom.set(0); counters.selectors.set(0); workMeter.set(0);
    for (const k of ["renders", "dom", "wasted", "compares", "selectors", "work"]) stat(k, "–");
    say(T("ready · " + sourceText() + (cfg.memo === "off" ? "" : " · React.memo on"), "listo · " + sourceText(true) + (cfg.memo === "off" ? "" : " · React.memo activado")));
  }
  function sourceText(es) {
    const en = { top: "state in App", down: "state moved down", context: "one context", split: "split contexts", store: "a store with selectors" };
    const sp = { top: "estado en App", down: "estado más abajo", context: "un contexto", split: "contextos separados", store: "un store con selectores" };
    return (es ? sp : en)[cfg.source];
  }

  // The page lying on the bench shows the app's state as of the last commit.
  function paintPage() {
    const s = app.state;
    setText(pageText.query, s.query + "▏");
    setText(pageText.cart, String(s.cart));
    const sug = suggestionsFor(s.query);
    setText(pageText.suggest, sug.length ? sug[0] + (sug.length > 1 ? " +" + (sug.length - 1) : "") : "–");
    for (let i = 0; i < G.BANKS.ResultCard; i++) dom["ResultCard-" + i].toggleAttribute("data-sel", s.selected === i);
  }

  // ---------- one interaction ----------
  const ACT = { key: () => app.key(), pick: () => app.pick(), cart: () => app.addToCart() };
  function act(kind) {
    const u = ACT[kind]();
    if (!u) return;
    const t0 = clock;
    const d0 = u.rendered.length ? Math.min(...u.rendered.map((id) => NODES[id].depth)) : 0;
    const at = (id) => t0 + (cfg.source === "store" ? 0.12 : LAG * (NODES[id].depth - d0 + 0.5));
    // the store's STATE plaque lights when it changes (a component that holds state lights as it renders anyway)
    if (cfg.source === "store") light("flag:Store", t0, t0 + HOLD + 0.2);
    // renders, and the wires the wave came down
    u.rendered.forEach((id, i) => {
      const a = at(id);
      light("node:" + id, a, a + HOLD);
      if (u.causes[i] === "owner") light("edge:" + NODES[id].name, a - LAG * 0.6, a + HOLD);
    });
    // memo gates: up when the props differed, down and lit when the render was skipped
    const byGate = {};
    for (const c of u.compares) { const name = NODES[c.id].name; (byGate[name] ||= { pass: 0, skip: 0, id: c.id }); byGate[name][c.same ? "skip" : "pass"]++; }
    for (const [name, r] of Object.entries(byGate)) {
      const a = at(r.id) - LAG * 0.3;
      light((r.pass ? "open:" : "shut:") + name, a, a + HOLD);
    }
    // the DOM: what changed flashes on the page once the wave has passed
    const deepest = u.rendered.length ? Math.max(...u.rendered.map((id) => at(id))) : t0;
    const tc = deepest + 0.08;
    for (const id of u.commits) { const n = NODES[id]; light("dom:" + (n.name === "ResultCard" ? "ResultCard-" + n.index : n.name), tc, tc + HOLD + 0.25); }
    pending.push({ at: tc, fn: paintPage });
    report(u, kind);
  }

  function report(u, kind) {
    const r = u.rendered.length, c = u.commits.length, work = u.work / 1000;
    counters.renders.setClamped(r); counters.dom.setClamped(c); counters.selectors.setClamped(u.selectorsRun);
    workMeter.set(work / (2 * FRAME));
    stat("renders", r + " / " + N);
    stat("dom", c);
    stat("wasted", u.wasted);
    stat("compares", cfg.memo === "off" ? "–" : u.compares.length);
    stat("selectors", cfg.source === "store" ? u.selectorsRun : "–");
    stat("work", (work < 1 ? work.toFixed(2) : work.toFixed(1)) + " ms");
    const what = { key: T("keystroke", "pulsación"), pick: T("pick", "elección"), cart: T("add to cart", "al carrito") }[kind];
    const tail = T(r + (r === 1 ? " render · " : " renders · ") + c + (c === 1 ? " DOM change" : " DOM changes"), r + (r === 1 ? " render · " : " renders · ") + c + (c === 1 ? " cambio DOM" : " cambios DOM"));
    let why;
    if (cfg.source === "store") {
      const changed = u.dirty.length;
      why = T(u.selectorsRun + " selectors ran, " + changed + " changed", "corrieron " + u.selectorsRun + " selectores, cambiaron " + changed);
    } else if (cfg.source === "context" || cfg.source === "split") {
      const readers = u.causes.filter((x) => x === "context").length;
      why = T(readers + (readers === 1 ? " context reader" : " context readers"), readers + (readers === 1 ? " lector del contexto" : " lectores del contexto"));
    } else {
      const owner = NODES[u.origin[0]].name;
      why = T("state in " + owner, "estado en " + owner);
    }
    let memoNote = null;
    if (cfg.memo !== "off" && u.compares.length) {
      const skipped = u.compares.filter((x) => x.same).length;
      memoNote = T("memo skipped " + skipped + " of " + u.compares.length, "memo se saltó " + skipped + " de " + u.compares.length);
    }
    const msText = (work < 1 ? work.toFixed(2) : work.toFixed(1)) + " ms";
    const parts = [what, why, tail, memoNote, T(msText, msText)].filter(Boolean);
    say(T(parts.map((p) => p.en).join(" · "), parts.map((p) => p.es).join(" · ")));
  }

  // ---------- painting ----------
  function paintKey(key, on) {
    const [kind, name] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
    if (kind === "node") setLit(solids[Number(name)], on);
    else if (kind === "edge") edges[name]?.toggleAttribute("data-on", on);
    else if (kind === "dom") dom[name]?.toggleAttribute("data-on", on);
    else if (kind === "flag" && flags[name]) setLit(flags[name], on);
    else if (kind === "open" || kind === "shut") {
      const g = gates[name]; if (!g) return;
      if (on) WB.pose(svg, "gate-" + name, kind);
      else WB.pose(svg, "gate-" + name, "shut");
      setLit(g.shut, on && kind === "shut");
    }
  }
  function paint() {
    for (const [key, l] of lights) {
      const on = clock >= l.from && clock < l.to;
      if (on !== l.on) { l.on = on; paintKey(key, on); }
      if (!on && clock >= l.to) lights.delete(key);
    }
    for (let i = pending.length - 1; i >= 0; i--) if (clock >= pending[i].at) { pending[i].fn(); pending.splice(i, 1); }
  }

  // ---------- the user ----------
  // Typing: a key every 0.3-0.45 s, and a pause on each finished search before the box is cleared. Picking and
  // adding to the cart: about one every 1.2 to 1.6 s.
  function schedule() {
    if (cfg.input === "key") return 0.3 + 0.15 * jitter() + (SEARCHES.includes(app.state.query) ? 1.1 : 0);
    return (cfg.input === "pick" ? 1.1 : 1.3) + 0.3 * jitter();
  }

  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    clock += dt * cfg.speed;
    while (clock >= nextAt) { act(cfg.input); nextAt += schedule(); }
    paint();
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = String(raw);
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    key: () => { act("key"); nextAt = clock + 0.8; wake(); },
    pick: () => { act("pick"); nextAt = clock + 0.8; wake(); },
    cart: () => { act("cart"); nextAt = clock + 0.8; wake(); },
    reset: () => restart(),
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    set("source", w.source, true); set("memo", w.memo, true); set("input", w.input, true);
    restart();
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

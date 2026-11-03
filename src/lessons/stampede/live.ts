// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The bakery in the browser: runs the model, paints the trays, oven, ticket rail, customers and scoreboard, wires
// the controls and the experiment cards. mount() gets the build-time data from page.ts (geometry, results).
import { iso, pathOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats, show, act, pauseControls, setD } from "../../runtime/dom";
import { one, n0 } from "../../lib/format";
import { makeSim, LIVE } from "./sim";

export default function mount({ P, G, RESULTS, EXPERIMENTS }) {
  const TTL = 10;

  const stage = document.querySelector("[data-bakery]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const say = readout();
  const stat = stats();
  // Set a path's d only when it changes.
  const at = (p) => iso(p, P);

  const trays = Array.from({ length: G.KEYS }, (_, i) => ({ loaf: q('[data-loaf="' + i + '"]'), old: q('[data-loaf="' + i + '"] [data-old]'), dial: q('[data-dial="' + i + '"]'), fill: q('[data-dial-fill="' + i + '"]') }));
  const shelves = G.SHELVES.map((_, i) => ({ tag: q('[data-shelf-tag="' + i + '"]'), tagLit: q('[data-shelf-tag="' + i + '"] [data-shelf-lit]'), num: q('[data-shelf-tag="' + i + '"] [data-shelf-num]'), tray: q('[data-shelf-tray="' + i + '"]') }));
  const slots = G.RACK_SLOTS.map((_, n) => ({ g: q('[data-slot="' + n + '"]'), plain: q('[data-slot="' + n + '"] [data-plain]'), lit: q('[data-slot="' + n + '"] [data-lit]'), nums: qa('[data-slot="' + n + '"] [data-ticket-num]') }));
  const spots = G.SPOTS.map((row, key) => row.map((_, n) => q('[data-spot="' + key + "-" + n + '"]')));
  const gauge = q("[data-gauge]");
  const digits = Object.fromEntries(G.BOARD_ROWS.map((r) => [r.name, [0, 1, 2].map((n) => q('[data-digit="' + r.name + n + '"]'))]));

  function setCounter(name, v) {
    const s = String(Math.min(999, Math.max(0, Math.floor(v)))).padStart(3, "0");
    digits[name].forEach((el, n) => { if (el.textContent !== s[n]) el.textContent = s[n]; });
  }
  function dialPaths(i, frac) {
    const cx = G.TRAY_X[i] + 2, y = G.DIAL.y, cz = G.DIAL.z, r = G.DIAL.r * 0.78;
    const pt = (f) => { const a = f * Math.PI * 2; return at([cx + Math.sin(a) * r, y, cz + Math.cos(a) * r]); };
    const c = at([cx, y, cz]);
    const tip = pt(frac);
    const needle = pathOf([c, tip]);
    if (frac <= 0.001) return { needle, fill: "" };
    const n = Math.max(2, Math.ceil(frac * 32));
    const arc = [c]; for (let s = 0; s <= n; s++) arc.push(pt((s / n) * frac));
    return { needle, fill: pathOf(arc, true) };
  }
  function gaugePath(frac) {
    const g = G.GAUGE, a = Math.PI * (1 - Math.max(0, Math.min(1, frac)));
    return pathOf([at([g.x, g.y + 1.3, g.z]), at([g.x + Math.cos(a) * g.r * 0.82, g.y + 1.3, g.z + Math.sin(a) * g.r * 0.82])]);
  }

  const cfg = { mode: "all", jitter: 0, bake: 1, rate: 12, speed: 1 };
  const WARM = 10.9;   // start just after the first expiry, so the first frame shows a stampede in progress
  let model, clock, seed = 4;

  function restart() {
    model = makeSim({ weights: LIVE.weights, rate: cfg.rate, ttl: TTL, bake: cfg.bake, shelves: LIVE.shelves, mode: cfg.mode, jitter: cfg.jitter }, seed++);
    clock = WARM;
    model.runTo(clock);
    paint();
  }

  function paint() {
    const m = model, st = m.stats;
    // Trays, their dials and the old tags.
    m.keys.forEach((k, i) => {
      const fresh = k.has && clock < k.exp;
      const shown = fresh || (cfg.mode === "stale" && k.has);
      show(trays[i].loaf, shown);
      show(trays[i].old, shown && !fresh);
      const p = dialPaths(i, fresh ? Math.min(1, (k.exp - clock) / (TTL * (1 + cfg.jitter))) : 0);
      setD(trays[i].dial, p.needle); setD(trays[i].fill, p.fill);
    });
    // Oven shelves.
    shelves.forEach((s, i) => {
      const job = m.oven[i];
      show(s.tag, !!job); show(s.tray, !!job);
      if (job) { const t = String(job.key + 1); if (s.num.textContent !== t) s.num.textContent = t; show(s.tagLit, job.dup); }
    });
    // Rack.
    slots.forEach((s, n) => {
      const job = m.rack[n]; show(s.g, !!job);
      if (job) { show(s.plain, !job.dup); show(s.lit, job.dup); const t = String(job.key + 1); for (const el of s.nums) if (el.textContent !== t) el.textContent = t; }
    });
    // Gauge.
    setD(gauge, gaugePath(m.load() / G.GAUGE.max));
    // Customers waiting, in front of their tray.
    const counts = Array(G.KEYS).fill(0);
    const waiting = m.waiting();
    for (const r of waiting) counts[r.key]++;
    spots.forEach((row, key) => row.forEach((el, n) => show(el, n < counts[key])));
    // Board.
    setCounter("wait", waiting.length); setCounter("dup", st.dups); setCounter("stale", st.stale);
    // Readout and stats.
    const empty = m.keys.filter((k) => !(k.has && clock < k.exp)).length;
    if (m.load() || waiting.length) say(L(
      (empty ? empty + (empty === 1 ? " tray" : " trays") + " expired · " : "") + m.load() + " orders in the oven · " + waiting.length + " waiting",
      (empty ? empty + (empty === 1 ? " bandeja vencida" : " bandejas vencidas") + " · " : "") + m.load() + " pedidos en el horno · " + waiting.length + " esperando"));
    else { const next = Math.min(...m.keys.map((k) => k.exp)) - clock; say(cfg.mode === "stale" && empty ? L("old loaves out while they refresh", "panes viejos afuera mientras se refrescan") : L("all trays fresh · next expiry in " + Math.max(0, next).toFixed(1) + " s", "todas las bandejas frescas · próximo vencimiento en " + Math.max(0, next).toFixed(1) + " s")); }
    stat("requests", st.requests);
    stat("hit", st.requests ? Math.round((100 * st.hits) / st.requests) + "%" : "–");
    stat("orders", st.orders);
    stat("dups", st.dups);
    stat("wait", st.waited ? st.maxWait.toFixed(1) + " s" : "–");
    stat("stale", st.stale);
  }

  const pause = pauseControls(stage, say);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    if (name === "speed") { cfg.speed = Number(raw); WB.pressSeg(name, raw); return; }
    cfg[name] = name === "mode" ? raw : Number(raw);
    WB.pressSeg(name, raw);
    if (!quiet) restart();
  }
  WB.onSegments((name, value) => set(name, value));
  act("expire").addEventListener("click", () => { model.expireAll(clock); if (loop.paused) loop.setPaused(false); paint(); });
  act("reset").addEventListener("click", () => restart());

  // ---------- experiments (numbers computed at build time from the same model, 6 seeds each) ----------
  const RUNS = {
    deploy: () => {
      const r = RESULTS.deploy, top = Math.max(r.peak, r.capacity);
      return { verdict: T("At the 30 s mark the oven got up to " + n0(r.peak) + " orders in one second, against a capacity of " + n0(r.capacity) + ". " + n0(r.dups) + " of " + n0(r.orders) + " orders were duplicates, and the unluckiest customer waited " + one(r.maxWait) + " s.",
          "Cerca del segundo 30 el horno llegó a " + n0(r.peak) + " pedidos en un segundo, con una capacidad de " + n0(r.capacity) + ". " + n0(r.dups) + " de " + n0(r.orders) + " pedidos fueron duplicados, y el cliente con peor suerte esperó " + one(r.maxWait) + " s."),
        bars: [[T("Oven capacity per second", "Capacidad del horno por segundo"), r.capacity / top, n0(r.capacity)], [T("Busiest second", "Segundo de más trabajo"), r.peak / top, n0(r.peak), true], [T("Duplicate orders", "Pedidos duplicados"), r.dups / r.orders, T(n0(r.dups) + " of " + n0(r.orders), n0(r.dups) + " de " + n0(r.orders)), true]] };
    },
    jitter: () => {
      const a = RESULTS.deploy, b = RESULTS.jitter, top = Math.max(a.peak, b.peak, a.capacity), wtop = Math.max(a.maxWait, b.maxWait);
      return { verdict: T("With jitter the busiest second fell from " + n0(a.peak) + " to " + n0(b.peak) + " orders (the oven takes " + n0(a.capacity) + "), and the longest wait from " + one(a.maxWait) + " s to " + one(b.maxWait) + " s.",
          "Con jitter el segundo de más trabajo bajó de " + n0(a.peak) + " a " + n0(b.peak) + " pedidos (el horno acepta " + n0(a.capacity) + "), y la espera más larga de " + one(a.maxWait) + " s a " + one(b.maxWait) + " s."),
        bars: [[T("Busiest second, equal TTL", "Segundo de más trabajo, mismo TTL"), a.peak / top, n0(a.peak)], [T("Busiest second, ±20 %", "Segundo de más trabajo, ±20 %"), b.peak / top, n0(b.peak), true], [T("Longest wait, equal TTL", "Espera más larga, mismo TTL"), a.maxWait / wtop, one(a.maxWait) + " s"], [T("Longest wait, ±20 %", "Espera más larga, ±20 %"), b.maxWait / wtop, one(b.maxWait) + " s", true]] };
    },
    single: () => {
      const a = RESULTS.all, b = RESULTS.single, top = a.perExpiry, wtop = Math.max(a.maxWait, b.maxWait);
      return { verdict: T("Orders per expiry: " + n0(a.perExpiry) + " when every miss orders, " + n0(b.perExpiry) + " with single-flight. The longest wait fell from " + one(a.maxWait) + " s to " + one(b.maxWait) + " s, because no queue forms.",
          "Pedidos por vencimiento: " + n0(a.perExpiry) + " si cada fallo pide, " + n0(b.perExpiry) + " con single-flight. La espera más larga bajó de " + one(a.maxWait) + " s a " + one(b.maxWait) + " s, porque no se forma cola."),
        bars: [[T("Orders per expiry, everyone orders", "Pedidos por vencimiento, todos piden"), a.perExpiry / top, n0(a.perExpiry)], [T("Orders per expiry, single-flight", "Pedidos por vencimiento, single-flight"), b.perExpiry / top, n0(b.perExpiry), true], [T("Longest wait, everyone orders", "Espera más larga, todos piden"), a.maxWait / wtop, one(a.maxWait) + " s"], [T("Longest wait, single-flight", "Espera más larga, single-flight"), b.maxWait / wtop, one(b.maxWait) + " s", true]] };
    },
    stale: () => {
      const a = RESULTS.single1, b = RESULTS.stale1, top = Math.max(a.waitedPerExpiry, b.stalePerExpiry);
      return { verdict: T("Single-flight: " + n0(a.waitedPerExpiry) + " customers waited at each expiry, up to " + one(a.maxWait) + " s. Stale-while-revalidate: " + n0(b.waitedPerExpiry) + " waited and " + n0(b.stalePerExpiry) + " got the old loaf; the oven still baked " + n0(b.perExpiry) + " order per expiry.",
          "Single-flight: " + n0(a.waitedPerExpiry) + " clientes esperaron en cada vencimiento, hasta " + one(a.maxWait) + " s. Stale-while-revalidate: " + n0(b.waitedPerExpiry) + " esperaron y " + n0(b.stalePerExpiry) + " recibieron el pan viejo; el horno siguió horneando " + n0(b.perExpiry) + " pedido por vencimiento."),
        bars: [[T("Waited per expiry, single-flight", "Esperaron por vencimiento, single-flight"), a.waitedPerExpiry / top, n0(a.waitedPerExpiry)], [T("Waited per expiry, stale", "Esperaron por vencimiento, viejo"), b.waitedPerExpiry / top, n0(b.waitedPerExpiry), true], [T("Served stale per expiry", "Viejos servidos por vencimiento"), b.stalePerExpiry / top, n0(b.stalePerExpiry), true]] };
    },
    slow: () => {
      const a = RESULTS.slowFast, b = RESULTS.slowSlow, wtop = Math.max(a.maxWait, b.maxWait), otop = Math.max(a.perExpiry, b.perExpiry);
      return { verdict: T("Bake 0.2 s: " + n0(a.perExpiry) + " orders per expiry, longest wait " + one(a.maxWait) + " s. Bake 1 s: " + n0(b.perExpiry) + " orders, longest wait " + one(b.maxWait) + " s, " + Math.round(b.maxWait / a.maxWait) + " times longer for a bake five times slower.",
          "Horneado de 0.2 s: " + n0(a.perExpiry) + " pedidos por vencimiento, espera más larga " + one(a.maxWait) + " s. Horneado de 1 s: " + n0(b.perExpiry) + " pedidos, espera más larga " + one(b.maxWait) + " s, " + Math.round(b.maxWait / a.maxWait) + " veces más larga por un horneado cinco veces más lento."),
        bars: [[T("Orders per expiry, 0.2 s bake", "Pedidos por vencimiento, horneado de 0.2 s"), a.perExpiry / otop, n0(a.perExpiry)], [T("Orders per expiry, 1 s bake", "Pedidos por vencimiento, horneado de 1 s"), b.perExpiry / otop, n0(b.perExpiry), true], [T("Longest wait, 0.2 s bake", "Espera más larga, horneado de 0.2 s"), a.maxWait / wtop, one(a.maxWait) + " s"], [T("Longest wait, 1 s bake", "Espera más larga, horneado de 1 s"), b.maxWait / wtop, one(b.maxWait) + " s", true]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    for (const name of ["mode", "jitter", "bake", "rate"]) set(name, String(w[name]), true);
    restart();
    if (loop.paused) loop.setPaused(false);
  } });

  loop.setPaused(loop.paused);
  restart();
}

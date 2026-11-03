// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The bakery in the browser: runs the model, paints the trays, oven, ticket rail, customers and scoreboard, and
// answers the controls. mount() gets the build-time data from page.ts (geometry) and root, the <wb-lesson>.
import { iso, pathOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L } from "../../runtime/wb";
import { show, setD, playPause } from "../../runtime/dom";
import { makeSim, LIVE } from "./sim";

export default function mount({ P, G }, root) {
  const TTL = 10;

  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const say = (text) => root.figure.say(text);
  const stat = (key, value) => root.stat(key, value);
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

  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    if (name === "speed") { cfg.speed = Number(raw); root.press(name, raw); return; }
    cfg[name] = name === "mode" ? raw : Number(raw);
    root.press(name, raw);
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));
  const actions = { expire: () => { model.expireAll(clock); if (loop.paused) loop.setPaused(false); paint(); }, reset: () => restart() };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const name of ["mode", "jitter", "bake", "rate"]) set(name, String(w[name]), true);
    restart();
    if (loop.paused) loop.setPaused(false);
  });

  loop.setPaused(loop.paused);
  restart();
}

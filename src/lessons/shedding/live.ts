// @ts-nocheck: live code in the lessons' plain-JS style; shared helpers come from src/runtime and src/lib.
// The takeaway kitchen in the browser: runs the model, eases slips, dishes and customers toward where the model has
// them, draws the chart recorder, and answers the controls. mount() gets the build-time data from page.ts
// (projection, geometry, the moving pieces' drawings) and root, the <wb-lesson>.
import { translateAlong, depthOf, iso, pathOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L } from "../../runtime/wb";
import { show, playPause } from "../../runtime/dom";
import { lerp } from "../../lib/tween";
import { makeKitchen, HOOKS, INTERVAL, LIVE_WARM } from "./sim";

export default function mount({ P, G, SLIP_SVG, FLAT_SVG, DISH_SVG, CUSTOMER_SVG }, root) {
  const WARM = LIVE_WARM;   // each run opens this far in, so the first frame shows a working kitchen and a chart
  const RATE_WINDOW = 15;   // the rate counters and pens count the last 15 s, times 4
  const HAND = 0.9;         // a served dish takes this long from the pass to its customer
  const NS = "http://www.w3.org/2000/svg";

  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (en, es) => root.figure.say(L(en, es));
  const stat = (key, value) => root.stat(key, value);
  const layers = Object.fromEntries(["rail", "stoves", "desk", "pass", "floor"].map((n) => [n, q('[data-layer="' + n + '"]')]));
  const stop = q("[data-stop]"), gap = q("[data-gap]");
  const pots = G.STOVE_X.map((_, i) => q('[data-pot="' + i + '"]'));
  const pens = { cooked: q('[data-pen="cooked"]'), good: q('[data-pen="good"]') };
  const counters = Object.fromEntries(["cookedMin", "goodMin", "desk", "rail", "oldest", "dropped", "served", "late", "turned"].map((n) => [n, WB.counter(svg, n, P)]));
  const gauge = WB.meter(svg, "standing", P);

  const cfg = { load: 1.5, policy: "all", order: "fifo", dish: 2, speed: 1 };
  let m, clock, logAt, allAt, done, note, wasLifo = false, seed = 11;

  // ---------- pooled pieces ----------
  const make = (html) => { const g = document.createElementNS(NS, "g"); g.innerHTML = html; return g; };
  const pools = { slip: [], dish: [], cust: [] };
  function takeSlip() {
    const el = pools.slip.pop();
    if (el) return el;
    const g = make('<g data-v="hang">' + SLIP_SVG + '</g><g data-v="flat" style="display:none">' + FLAT_SVG + "</g>");
    const part = (v) => { const r = g.querySelector('[data-v="' + v + '"]'); return { g: r, body: r.querySelector("[data-body]"), num: r.querySelector("[data-num]") }; };
    return { g, hang: part("hang"), flat: part("flat"), shown: {} };
  }
  function takeDish() { return pools.dish.pop() || { g: make(DISH_SVG), shown: {} }; }
  function takeCust() { return pools.cust.pop() || { g: make(CUSTOMER_SVG), shown: {} }; }
  const slips = new Map(), dishes = new Map(), custs = new Map();

  function dressSlip(rec, id, flat, lit) {
    const el = rec.el, s = el.shown;
    if (s.flat !== flat) { s.flat = flat; show(el.hang.g, !flat); show(el.flat.g, flat); }
    if (s.id !== id) { s.id = id; const txt = String(id % 1000); for (const p of [el.hang, el.flat]) { p.num.textContent = txt; p.num.setAttribute("font-size", txt.length <= 2 ? 3.4 : 2.7); } }
    if (s.lit !== lit) { s.lit = lit; for (const p of [el.hang, el.flat]) { p.body.toggleAttribute("data-lit", lit); p.num.setAttribute("data-tone", lit ? "on-lit" : "hi"); } }
  }
  const setLitAll = (el, lit) => { if (el.shown.lit !== lit) { el.shown.lit = lit; el.g.querySelectorAll(".iso-solid").forEach((s) => s.toggleAttribute("data-lit", lit)); } };
  function put(rec, layer) { if (rec.layer !== layer) { rec.layer = layer; layers[layer].appendChild(rec.el.g); } }
  function moveRec(rec, f, lift = true) {
    const [tx, ty, tz] = rec.target;
    const dist = Math.hypot(tx - rec.pos[0], ty - rec.pos[1], tz - rec.pos[2]);
    rec.pos[0] = lerp(rec.pos[0], tx, f); rec.pos[1] = lerp(rec.pos[1], ty, f);
    rec.pos[2] = lerp(rec.pos[2], tz + (lift ? Math.min(6, dist * 0.15) : 0), f);
    rec.el.g.setAttribute("transform", translateAlong(P, rec.pos));
    const o = rec.opacity === undefined ? "" : String(Math.max(0, Math.min(1, rec.opacity)));
    if (rec.el.g.style.opacity !== o) rec.el.g.style.opacity = o;
  }

  // ---------- a run ----------
  function restart() {
    const free = (rec, pool) => { if (!rec) return; rec.el.g.remove(); rec.el.g.style.opacity = ""; pool.push(rec.el); };
    for (const rec of slips.values()) free(rec, pools.slip);
    for (const rec of custs.values()) free(rec, pools.cust);
    for (const d of dishes.values()) free(d.rec, pools.dish);
    slips.clear(); custs.clear(); dishes.clear();
    m = makeKitchen({ load: cfg.load, policy: cfg.policy, order: cfg.order, dish: cfg.dish }, seed);
    seed = (Date.now() % 1e6) + 1;
    clock = WARM; logAt = 0; allAt = 0; done = []; note = null;
    m.runTo(clock);
    scanLog(true);
    show(stop, cfg.policy === "rail" || cfg.policy === "door");
    paint(0, true);
    drawChart();
  }

  // Everything the model did since the last frame: completions for the rates, notes for the readout.
  function scanLog(quiet) {
    for (; logAt < m.log.length; logAt++) {
      const e = m.log[logAt];
      if (e.type === "served" || e.type === "late") {
        done.push({ t: e.t, ok: e.type === "served" });
        if (e.type === "late") dishes.set(e.r.id, { r: e.r, kind: "late", t0: e.t, cook: e.cook });
        else dishes.set(e.r.id, { r: e.r, kind: "served", t0: e.t, cook: e.cook });
        if (!quiet && e.type === "late" && (!note || clock - note.t > 5)) note = { t: e.t, en: "dish " + e.r.id + " · " + (e.t - e.r.deadline).toFixed(1) + " s after its customer left · binned", es: "plato " + e.r.id + " · " + (e.t - e.r.deadline).toFixed(1) + " s tarde · a la basura" };
      } else if (!quiet && e.type === "turned" && (!note || clock - note.t > 5)) {
        note = { t: e.t, en: "rail full · customer " + e.r.id + " turned away", es: "riel lleno · cliente " + e.r.id + " rechazado" };
      } else if (!quiet && e.type === "dropped" && (!note || clock - note.t > 5)) {
        note = { t: e.t, en: "slip " + e.r.id + " waited " + (e.t - e.r.born).toFixed(1) + " s · dropped uncooked", es: "comanda " + e.r.id + " esperó " + (e.t - e.r.born).toFixed(1) + " s · descartada" };
      }
    }
    if (logAt > 4000) { m.log.splice(0, logAt); logAt = 0; }
    while (done.length && done[0].t < clock - 80) done.shift();
  }

  // Where the model has each slip right now.
  function slipTargets() {
    const out = new Map();
    m.front.slice(0, G.DESK_SHOW).forEach((r, i) => out.set(r.id, { r, pos: [G.DESK_SPOT[0], G.DESK_SPOT[1], G.DESK_SPOT[2] + i * 0.9], flat: true, layer: "desk" }));
    const R = m.rail, n = R.length, hooks = G.HOOK_X.length;
    const onHook = (r, h) => out.set(r.id, { r, pos: [G.HOOK_X[h], G.RAIL_Y, G.SLIP_Z], flat: false, layer: "rail" });
    // more than the hooks show: the five oldest at the right, the five newest at the left, and the gap marked
    const over = n > hooks;
    if (!over) R.forEach((r, i) => onHook(r, i));
    else { for (let i = 0; i < 5; i++) onHook(R[i], i); for (let i = 0; i < 5; i++) onHook(R[n - 5 + i], hooks - 5 + i); }
    show(gap, over);
    m.cooks.forEach((c, i) => { if (c.r) out.set(c.r.id, { r: c.r, pos: [...G.COOK_SPOT[i]], flat: true, layer: "stoves" }); });
    return out;
  }

  // A customer leaves at: once, at the door, if turned away; when their dish reaches them; when told their slip was
  // dropped; or when their patience runs out.
  const leaveAt = (r) => (r.state === "turned" ? r.born : r.state === "served" ? r.end + HAND : r.state === "dropped" ? Math.min(r.end, r.deadline) : r.deadline);
  const outward = (r) => (r.state === "served" && r.end + HAND <= clock ? "exit" : "back");

  function paint(dt, snap) {
    const f = snap ? 1 : 1 - Math.exp(-dt * 10);

    // slips
    const want = slipTargets();
    for (const [id, w] of want) {
      let rec = slips.get(id);
      if (!rec) {
        // a new slip is pinned at the rail's free end and slides along to its hook
        rec = { el: takeSlip(), layer: null, pos: w.layer === "rail" && !snap ? [G.HOOK_X[G.HOOK_X.length - 1] - 9, G.RAIL_Y, G.SLIP_Z] : [...w.pos] };
        slips.set(id, rec);
      }
      rec.target = w.pos; rec.r = w.r; rec.opacity = undefined; rec.fall = undefined;
      put(rec, w.layer);
      dressSlip(rec, id, w.flat, clock > w.r.deadline);
    }
    for (const [id, rec] of slips) {
      if (want.has(id)) continue;
      // dropped: falls into the trough; cooked: fades on the stove; still waiting but off the shown hooks: fades in place
      const state = rec.r.state;
      if (rec.fall === undefined) rec.fall = clock - (state === "dropped" ? 0 : 0.4);
      const u = (clock - rec.fall) / 0.7;
      if (snap || u >= 1 || state === "rail" || state === "front") { rec.el.g.remove(); rec.el.g.style.opacity = ""; pools.slip.push(rec.el); slips.delete(id); continue; }
      if (state === "dropped") rec.target = [rec.pos[0], G.RAIL_Y + 3, G.TROUGH_Z];
      else rec.target = [...rec.pos];
      rec.opacity = 1 - u;
    }
    for (const rec of slips.values()) moveRec(rec, f, rec.layer !== "rail");

    // customers: present ones stand on the floor in arrival order; leaving ones walk out
    for (; allAt < m.all.length && leaveAt(m.all[allAt]) + 3 < clock; allAt++);
    if (allAt > 3000) { m.all.splice(0, allAt); allAt = 0; }
    let rank = 0;
    const seenC = new Set();
    for (let i = allAt; i < m.all.length; i++) {
      const r = m.all[i];
      if (r.born > clock) break;
      const leave = leaveAt(r);
      if (leave + 2.2 < clock) continue;
      let rec = custs.get(r.id);
      if (!rec) {
        rec = { el: takeCust(), layer: null, pos: snap ? [0, 0, 0] : [G.DOOR_X + 4, G.LANE_Y, 0] };
        custs.set(r.id, rec);
        put(rec, "floor");
      }
      seenC.add(r.id);
      if (clock < leave) {
        const spot = G.SPOTS[rank++];
        rec.target = spot ? [spot[0], spot[1], 0] : [G.DOOR_X + 4, G.LANE_Y, 0];
        rec.opacity = spot ? undefined : 0;
        if (snap) rec.pos = [...rec.target];
      } else {
        const u = clock - leave;
        if (outward(r) === "exit") rec.target = [G.EXIT[0], G.EXIT[1], 0];
        else rec.target = u < 0.9 && rec.pos[0] > G.DOOR_X + 2 ? [G.DOOR_X + 4, G.LANE_Y, 0] : [G.STREET[0], G.STREET[1], 0];
        rec.opacity = u < 1.2 ? 1 : (2.2 - u);
        if (snap) { rec.opacity = 0; rec.pos = [...rec.target]; }
      }
    }
    for (const [id, rec] of custs) if (!seenC.has(id)) { rec.el.g.remove(); rec.el.g.style.opacity = ""; pools.cust.push(rec.el); custs.delete(id); }
    for (const rec of custs.values()) moveRec(rec, snap ? 1 : 1 - Math.exp(-dt * 6), false);

    // dishes: out on the pass, then to the customer (in time) or into the bin (too late)
    for (const [id, d] of dishes) {
      const u = clock - d.t0;
      const end = d.kind === "served" ? HAND + 1.4 : 1.4;
      if (snap || u > end) { if (d.rec) { d.rec.el.g.remove(); d.rec.el.g.style.opacity = ""; pools.dish.push(d.rec.el); } dishes.delete(id); continue; }
      if (!d.rec) { d.rec = { el: takeDish(), layer: null, pos: [...G.PASS_SPOT[d.cook]] }; put(d.rec, "pass"); }
      const rec = d.rec;
      setLitAll(rec.el, d.kind === "late");
      rec.opacity = undefined;
      if (d.kind === "late") {
        rec.target = u < 0.6 ? [...G.PASS_SPOT[d.cook]] : [...G.BIN_SPOT];
        if (u > 0.9) rec.opacity = (1.4 - u) / 0.5;
      } else {
        const c = custs.get(id);
        if (u < 0.35 || !c) rec.target = [...G.PASS_SPOT[d.cook]];
        else { put(rec, "floor"); rec.target = [c.pos[0] + 3.2, c.pos[1] + 2.2, 4.4]; if (u > HAND) rec.pos = [...rec.target]; }
        if (u > HAND + 1) rec.opacity = (HAND + 1.4 - u) / 0.4;
      }
      moveRec(rec, f);
    }

    // painter's order on the floor: far first
    const floorRecs = [...custs.values(), ...[...dishes.values()].filter((d) => d.rec && d.rec.layer === "floor").map((d) => d.rec)];
    floorRecs.sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P) || a.pos[2] - b.pos[2]);
    let prev = null, inOrder = true;
    for (const rec of floorRecs) { if (prev && rec.el.g.previousElementSibling !== prev) { inOrder = false; break; } prev = rec.el.g; }
    if (!inOrder) for (const rec of floorRecs) layers.floor.appendChild(rec.el.g);

    // pots bubble while a cook works
    m.cooks.forEach((c, i) => { pots[i].setAttribute("transform", c.r ? translateAlong(P, [0, 0, 0.5 * Math.abs(Math.sin(clock * 7 + i * 2))]) : ""); });

    // signs, gauge, counters
    const full = cfg.policy === "door" && m.rail.length >= HOOKS;
    WB.pose(svg, "door", full ? "full" : "open");
    const lifo = cfg.order === "alifo" && m.standing;
    WB.pose(svg, "order", lifo ? "lifo" : "fifo");
    if (!snap && lifo !== wasLifo) note = lifo ? { t: clock, en: "rail not emptied for " + INTERVAL + " s · newest first", es: "riel " + INTERVAL + " s sin vaciarse · la más nueva primero" } : { t: clock, en: "rail emptied · oldest first again", es: "riel vacío · otra vez la más vieja primero" };
    wasLifo = lifo;
    gauge.set(Math.min(1, m.sinceEmpty / (2 * INTERVAL)));
    const st = m.st, oldest = m.oldestWait();
    counters.desk.setClamped(m.front.length); counters.rail.setClamped(m.rail.length); counters.oldest.setClamped(Math.round(oldest));
    counters.dropped.setClamped(st.dropped); counters.served.setClamped(st.inTime); counters.late.setClamped(st.late); counters.turned.setClamped(st.turned);
  }

  // ---------- rates and the chart recorder ----------
  function rateAt(s) {
    let cooked = 0, good = 0;
    for (const d of done) if (d.t > s - RATE_WINDOW && d.t <= s) { cooked++; if (d.ok) good++; }
    const k = 60 / RATE_WINDOW;
    return { cooked: cooked * k, good: good * k };
  }
  function drawChart() {
    const pts = { cooked: [], good: [] };
    const from = Math.max(RATE_WINDOW, clock - G.PLOT.span);
    for (let s = Math.ceil(from * 2) / 2; s <= clock; s += 0.5) {
      const r = rateAt(s), x = G.PLOT.x1 - ((clock - s) / G.PLOT.span) * (G.PLOT.x1 - G.PLOT.x0);
      for (const key of ["cooked", "good"]) pts[key].push(iso([x, G.PLOT.y, G.PLOT.z0 + Math.min(1, r[key] / G.PLOT.max) * (G.PLOT.z1 - G.PLOT.z0)], P));
    }
    for (const key of ["cooked", "good"]) pens[key].setAttribute("d", pts[key].length > 1 ? pathOf(pts[key]) : "");
    const now = rateAt(clock);
    counters.cookedMin.setClamped(Math.round(now.cooked)); counters.goodMin.setClamped(Math.round(now.good));
    return now;
  }

  function narrate(now) {
    if (note && clock - note.t < 2.4) { say(note.en, note.es); return; }
    const waiting = m.front.length + m.rail.length;
    const orphans = [...m.front, ...m.rail, ...m.cooks.filter((c) => c.r).map((c) => c.r)].filter((r) => clock > r.deadline).length;
    // kept short: the readout is one line, even on a phone
    const head = Math.round(now.cooked) + " cooked/min · " + Math.round(now.good) + " in time";
    const headEs = Math.round(now.cooked) + " cocinados/min · " + Math.round(now.good) + " a tiempo";
    if (orphans) say(head + " · " + orphans + " slips for no one", headEs + " · " + orphans + " sin cliente");
    else if (cfg.policy === "door" && m.rail.length >= HOOKS) say(head + " · rail full", headEs + " · riel lleno");
    else say(head + " · " + waiting + " waiting", headEs + " · " + waiting + " en espera");
  }

  let chartTimer = 0, statTimer = 0, last = null;
  function step(dt) {
    clock += dt * cfg.speed;
    m.runTo(clock);
    scanLog(false);
    paint(dt * cfg.speed, false);
    chartTimer += dt; statTimer += dt;
    if (chartTimer > 0.2) { chartTimer = 0; last = drawChart(); }
    if (statTimer > 0.25) { statTimer = 0; showStats(last || rateAt(clock)); narrate(last || rateAt(clock)); }
  }
  function showStats(now) {
    stat("cooked", Math.round(now.cooked)); stat("good", Math.round(now.good));
    stat("late", m.st.late); stat("turned", m.st.turned); stat("dropped", m.st.dropped);
    stat("waiting", m.front.length + m.rail.length);
  }

  // ---------- controls ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage, step, onPause: pause.onPause });
  pause.bind(loop);
  const NUMERIC = ["load", "dish", "speed"];
  function set(name, raw, quiet) {
    root.press(name, raw);
    cfg[name] = NUMERIC.includes(name) ? Number(raw) : raw;
    if (name !== "speed" && !quiet) { restart(); note = { t: clock, en: "settings applied · restarted " + WARM + " s in", es: "ajustes aplicados · reinicia a los " + WARM + " s" }; afterRestart(); }
  }
  function afterRestart() { const now = drawChart(); showStats(now); narrate(now); }
  function rush(n = 30) {
    m.rush(n);
    scanLog(false);
    note = { t: clock, en: n + " customers walk in at once", es: "entran " + n + " clientes de golpe" };
    if (loop.paused) loop.setPaused(false);
  }
  root.on("change", (name, value) => set(name, value));
  const actions = { rush: () => rush(), reset: () => { restart(); note = { t: clock, en: "started over", es: "empezó de nuevo" }; afterRestart(); } };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  let rushTimer = 0;
  root.on("watch", (w) => {
    clearTimeout(rushTimer);
    for (const name of ["load", "policy", "order", "dish"]) set(name, String(w[name]), true);
    restart();
    afterRestart();
    if (loop.paused) loop.setPaused(false);
    if (w.rush) rushTimer = setTimeout(() => rush(w.rush), 2500);
  });

  loop.setPaused(loop.paused);
  restart();
  afterRestart();
}

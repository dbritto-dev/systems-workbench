// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The dispatch desk in the browser: runs the model, eases jobs along the lanes, rides the picked job on the shuttle to
// the press, works the press head, and answers the controls. mount() gets the build-time data from page.ts (projection,
// geometry, job drawing) and root, the <wb-lesson>.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, playPause } from "../../runtime/dom";
import { lerp, easeInOutCubic as ease } from "../../lib/tween";
import { clamp } from "../../lib/stats";
import { makeDesk, BASE_RATES, NAMES, N, BATCH, SPIKE } from "./sim";

export default function mount({ P, G, PARCEL_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (v) => root.figure.say(L(v));
  const stat = (key, value) => root.stat(key, value);
  const NS = "http://www.w3.org/2000/svg";
  const layers = { shuttle: q('[data-layer="shuttle"]'), work: q('[data-layer="work"]'), out: q('[data-layer="out"]') };
  for (let i = 0; i < N; i++) layers["lane" + i] = q('[data-layer="lane' + i + '"]');
  const shuttle = q("[data-shuttle]"), head = q("[data-head]");
  const idleOn = q('[data-idle="on"]'), idleOff = q('[data-idle="off"]');
  const tags = [0, 1, 2, 3].map((i) => ({ plate: q('[data-tag="' + i + '"]'), text: q('[data-tag-text="' + i + '"]') }));
  const counters = { done: WB.counter(svg, "done", P), serving: WB.counter(svg, "serving", P), wait: [0, 1, 2, 3].map((i) => WB.counter(svg, "wait" + i, P)) };
  const busyMeter = WB.meter(svg, "busy", P);
  const H = G.BED_H;

  // ---------- jobs: one pooled element per job on screen, eased toward where the model has it ----------
  const free = [];
  function makeEl() {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = PARCEL_SVG;
    const kind = (name) => { const r = g.querySelector('[data-kind="' + name + '"]'); return { g: r, body: r.querySelector("[data-body]"), num: r.querySelector("[data-num]"), key: r.querySelector("[data-key]") }; };
    return { g, kinds: { box: kind("box"), tall: kind("tall") }, shown: {} };
  }
  const recs = new Map();   // id -> { el, job, pos, target, layer, seen, leaving, until, fixed }
  function drop(id) { const r = recs.get(id); r.el.g.remove(); free.push(r.el); recs.delete(id); }
  function dress(r, lit) {
    const j = r.job, el = r.el, s = el.shown;
    const kind = j.size > 2.2 ? "tall" : "box";
    if (s.kind !== kind) { s.kind = kind; el.kinds.box.g.style.display = kind === "box" ? "" : "none"; el.kinds.tall.g.style.display = kind === "tall" ? "" : "none"; s.id = null; s.lit = null; }
    const k = el.kinds[kind];
    if (s.id !== j.id) {
      s.id = j.id;
      const txt = String(j.id % 1000);
      k.num.textContent = txt; k.num.setAttribute("font-size", txt.length <= 2 ? 3.4 : 2.6);
      k.key.textContent = NAMES[j.tenant];
    }
    if (s.lit !== lit) { s.lit = lit; k.body.toggleAttribute("data-lit", lit); k.body.toggleAttribute("data-lit-fill", lit); for (const x of [k.num, k.key]) x.setAttribute("data-tone", lit ? "on-lit" : "hi"); }
  }
  function want(job, pos, layer, lit, fixed = false) {
    let r = recs.get(job.id);
    if (!r) {
      const el = free.pop() || makeEl();
      r = { el, job, pos: [-118, G.LANE_YS[job.tenant], H], layer: null };   // new jobs come out of their dock
      el.g.__rec = r;
      recs.set(job.id, r);
    }
    r.job = job; r.target = pos; r.seen = true; r.leaving = false; r.fixed = fixed;
    if (r.layer !== layer) { r.layer = layer; layers[layer].appendChild(r.el.g); }
    dress(r, lit);
  }

  // ---------- settings and the run ----------
  const cfg = { sched: "fifo", weights: "equal", sizes: "same", speed: 1 };
  // What each run starts with: D's batch job 3 s in, unless an experiment set up another scenario.
  const SCENARIOS = {
    batchD: { script: [[3, 3, BATCH]] },
    all: { script: [0, 1, 2, 3].map((i) => [3, i, 20]) },
    aAndD: { script: [[3, 0, 30], [3, 3, 30]] },
    spike: { script: [[3, 3, 20]], spike: { from: 10, to: 10 + (SPIKE.to - SPIKE.from), rate: SPIKE.rate } },
  };
  let scenario = "batchD";
  let model, clock, logAt, history, seed = 7, lastSay = -9;

  const weightsOf = () => (cfg.weights === "a3" ? [3, 1, 1, 1] : [1, 1, 1, 1]);
  function restart() {
    for (const id of [...recs.keys()]) drop(id);
    const sc = SCENARIOS[scenario];
    model = makeDesk({ sched: cfg.sched, weights: weightsOf(), sizes: cfg.sizes === "big" ? [1, 1, 1, 4] : [1, 1, 1, 1], rates: BASE_RATES, script: sc.script, spike: sc.spike || null }, seed);
    seed = (Date.now() % 1e6) + 1;
    clock = 0; logAt = 0; history = [{ t: 0, busy: 0, d: 0 }]; lastSay = -9; shuttleY = G.WORK_Y;
    paintTags();
    paint(0, true);
    showStats();
  }

  function paintTags() {
    const w = weightsOf();
    tags.forEach((tg, i) => {
      show(tg.plate, cfg.sched !== "fifo"); show(tg.text, cfg.sched !== "fifo");
      tg.text.textContent = cfg.sched === "prio" ? L(i < 3 ? T("HIGH", "ALTA") : T("LOW", "BAJA")) : "×" + w[i];
      tg.text.setAttribute("font-size", cfg.sched === "prio" ? 3.2 : 4);
    });
  }

  // ---------- narration: the model's log, newest first ----------
  function narrate() {
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt];
      if (e.t > clock) break;
      if (e.type === "start") {
        const j = e.job, w = e.t - j.born, n = NAMES[j.tenant];
        const ahead = model.lanes.reduce((s, l) => s + l.length, 0);
        if (e.t - lastSay > 0.6 || w > 5) {
          say(T("serving #" + j.id + " from " + n + " · waited " + w.toFixed(1) + " s · " + ahead + " still waiting",
            "turno #" + j.id + " de " + n + " · esperó " + w.toFixed(1) + " s · quedan " + ahead + " en espera"));
          lastSay = e.t;
        }
      } else if (e.type === "idle") {
        const n = NAMES[e.lane];
        say(e.waiting ? T(n + "'s slot · lane empty · the worker idles while others wait", "franja de " + n + " · carril vacío · el trabajador queda ocioso mientras otros esperan")
          : T(n + "'s slot · lane empty", "franja de " + n + " · carril vacío"));
        lastSay = e.t;
      } else if (e.type === "batch") {
        say(T(NAMES[e.tenant] + " drops a batch of " + e.n + " jobs", NAMES[e.tenant] + " suelta un lote de " + e.n + " trabajos"));
        lastSay = e.t + 1.5;
      } else if (e.type === "spike") {
        say(T("spike · A, B and C send " + e.rate + " jobs/s each for " + e.secs + " s", "pico · A, B y C envían " + e.rate + " trabajos/s cada uno durante " + e.secs + " s"));
        lastSay = e.t + 1.5;
      } else if (e.type === "calm") {
        say(T("spike over · A, B and C back to normal", "fin del pico · A, B y C vuelven a lo normal"));
        lastSay = e.t + 1.5;
      }
    }
    if (logAt > 4000) { model.log.splice(0, logAt); logAt = 0; }
  }

  // ---------- painting ----------
  let shuttleY;
  const TR = (size) => Math.min(0.7, 0.6 * size);     // the ride from the lane head to the press, part of the job's time
  function paint(dt, snap) {
    narrate();
    for (const r of recs.values()) r.seen = false;
    // the lanes
    model.lanes.forEach((lane, i) => {
      for (let k = 0; k < Math.min(lane.length, G.SLOTS); k++) want(lane[k], [G.SLOT_X[k], G.LANE_YS[i], H], "lane" + i, false);
      counters.wait[i].setClamped(lane.length);
    });
    // the job in hand: lane head → shuttle → infeed → press
    const c = model.current;
    let sy = G.WORK_Y, pressDz = 0, idleLit = false;
    if (c && c.job) {
      const j = c.job, ly = G.LANE_YS[j.tenant], tr = TR(j.size), u = clamp((clock - c.start) / tr);
      let pos, layer = "shuttle";
      const seg = (a, b) => clamp((u - a) / (b - a));
      if (u < 0.3) { sy = lerp(shuttleY, ly, ease(seg(0, 0.3))); pos = [G.SLOT_X[0], ly, H]; layer = "lane" + j.tenant; }
      else if (u < 0.45) { sy = ly; pos = [lerp(G.SLOT_X[0], G.RAIL_X, ease(seg(0.3, 0.45))), ly, H]; }
      else if (u < 0.75) { sy = lerp(ly, G.WORK_Y, ease(seg(0.45, 0.75))); pos = [G.RAIL_X, sy, H]; }
      else { sy = G.WORK_Y; pos = [lerp(G.RAIL_X, G.WORK_SPOT[0], ease(seg(0.75, 1))), G.WORK_Y, H]; layer = "work"; }
      if (u >= 1) {
        // the press: one stroke per second of work
        const work = c.end - c.start - tr, v = clamp((clock - c.start - tr) / Math.max(0.01, work));
        const strokes = Math.max(1, Math.round(work)), f = (v * strokes) % 1;
        const top = H + (j.size > 2.2 ? G.BOX.tall : G.BOX.h);
        pressDz = -(G.HEAD.rest - top - 0.3) * Math.pow(Math.sin(Math.PI * f), 2);
      }
      want(j, pos, layer, true, true);
      counters.serving.set(j.id % 1000);
    } else if (c && c.idle !== undefined) {
      sy = lerp(shuttleY, G.LANE_YS[c.idle], ease(clamp((clock - c.start) / 0.3)));
      idleLit = c.waiting;
    } else sy = shuttleY;
    const moving = c && (c.job ? clock - c.start < TR(c.job.size) * 0.3 : clock - c.start < 0.3);
    if (!moving) shuttleY = sy;
    shuttle.setAttribute("transform", translateAlong(P, [0, sy, 0]));
    head.setAttribute("transform", pressDz ? translateAlong(P, [0, 0, pressDz]) : "");
    show(idleOn, idleLit); show(idleOff, !idleLit);

    // jobs that left the model's view: finished, into the bin
    for (const [id, r] of recs) {
      if (r.seen) continue;
      if (!r.leaving) {
        // finished: it drops into the done bin from above and fades
        r.leaving = true; r.until = performance.now() + 600; r.target = [...G.BIN_SPOT]; r.fixed = false;
        if (!snap) r.pos = [G.BIN_SPOT[0], G.BIN_SPOT[1], G.BIN_SPOT[2] + 12];
        if (r.layer !== "out") { r.layer = "out"; layers.out.appendChild(r.el.g); }
        dress(r, false);
      }
      if (snap || performance.now() > r.until) drop(id);
    }

    // move everything toward its target
    const f = snap ? 1 : 1 - Math.exp(-dt * 10);
    for (const r of recs.values()) {
      const [tx, ty, tz] = r.target;
      if (r.fixed) r.pos = [tx, ty, tz];
      else { r.pos[0] = lerp(r.pos[0], tx, f); r.pos[1] = lerp(r.pos[1], ty, f); r.pos[2] = lerp(r.pos[2], tz, f); }
      r.el.g.setAttribute("transform", translateAlong(P, r.pos));
      if (r.leaving) r.el.g.style.opacity = String(Math.max(0, Math.min(1, (r.until - performance.now()) / 400)));
      else if (r.el.g.style.opacity) r.el.g.style.opacity = "";
    }
    // painter's order in each lane: far (small x) first
    for (let i = 0; i < N; i++) {
      const layer = layers["lane" + i], kids = [...layer.children];
      const sorted = [...kids].sort((a, b) => depthOf(posOf(a), P) - depthOf(posOf(b), P));
      if (sorted.some((el, n) => el !== kids[n])) sorted.forEach((el) => layer.appendChild(el));
    }
    counters.done.set(model.st.done);
  }
  const posOf = (g) => (g.__rec ? g.__rec.pos : [0, 0, 0]);

  // ---------- stats: the last 30 s, including jobs still waiting ----------
  function maxWait(pick) {
    let m = 0;
    for (let n = model.done.length - 1; n >= 0; n--) { const j = model.done[n]; if (j.end < clock - 30) break; if (pick(j.tenant) && j.start > clock - 30) m = Math.max(m, j.start - j.born); }
    const c = model.current;
    if (c && c.job && pick(c.job.tenant)) m = Math.max(m, c.start - c.job.born);
    model.lanes.forEach((lane, i) => { if (pick(i) && lane.length) m = Math.max(m, clock - lane[0].born); });
    return m;
  }
  const secs = (x) => (x < 10 ? x.toFixed(1) : String(Math.round(x))) + " s";
  function showStats() {
    const st = model.st;
    const now = { t: clock, busy: st.busy, d: st.busyBy[3] };
    history.push(now);
    while (history.length > 2 && history[1].t <= clock - 30) history.shift();
    const a = history[0], span = clock - a.t;
    const busy = span > 0.5 ? (now.busy - a.busy) / span : 0;
    busyMeter.set(busy);
    stat("done", st.done);
    stat("waiting", model.lanes.reduce((s, l) => s + l.length, 0));
    stat("abc", secs(maxWait((i) => i < 3)));
    stat("d", secs(maxWait((i) => i === 3)));
    stat("busy", span > 2 ? Math.round(100 * Math.min(1, busy)) + "%" : "–");
    stat("shareD", span > 2 ? Math.round((100 * (now.d - a.d)) / span) + "%" : "–");
  }

  // ---------- the loop ----------
  let statTimer = 0;
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    clock += dt * cfg.speed;
    model.runTo(clock);
    paint(dt);
    statTimer += dt; if (statTimer > 0.25) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = String(raw);
    if (!quiet) { restart(); say(T("settings applied · run restarted", "ajustes aplicados · corrida reiniciada")); }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    batchD: () => { model.drop(clock, 3, BATCH); wake(); },
    batchA: () => { model.drop(clock, 0, 30); wake(); },
    spike: () => { model.spikeNow(clock, SPIKE.to - SPIKE.from, SPIKE.rate); wake(); },
    reset: () => { restart(); say(T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    set("sched", w.sched, true); set("weights", w.weights || "equal", true); set("sizes", w.sizes || "same", true); set("speed", "3", true);
    scenario = w.scenario || "batchD";
    restart();
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

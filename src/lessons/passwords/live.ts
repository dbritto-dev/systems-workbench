// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The vault, the login desk and the rig in the browser. Two clocks: the rig's runs on a log scale (each DECADE seconds
// of page time is ten times more attacker time), so seconds and centuries of guessing fit in one run; the login desk
// runs in slow motion (SLOW). mount() gets the build-time data from page.ts (projection, geometry, drawings) and root.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { setText, playPause } from "../../runtime/dom";
import { int, pct } from "../../lib/format";
import { lerp } from "../../lib/tween";
import { makeTable, makeServer, shownRows, crackedBy, guessesBy, halfTime, passwordText, dur, rigRate, hashSecs, N, CORES, YEAR, DAY } from "./sim";

const DECADE = 1.6;                 // page seconds per power of ten on the rig's clock
const LOG_START = -3, LOG_END = Math.log10(1000 * YEAR);
const SLOW = 1 / 20;                // the login desk: model seconds per page second
const LETTERS = "ABCDEFGH";

export default function mount({ P, G, SLIP_SVG, TAG_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const stat = (key, value) => root.stat(key, value);
  const NS = "http://www.w3.org/2000/svg";
  const layers = { lane: q('[data-layer="lane"]'), cores: q('[data-layer="cores"]'), rail: q('[data-layer="rail"]') };
  const C = Object.fromEntries(["line", "waitI", "waitF", "hashMs", "cracked", "same", "gM", "gF", "gE", "clockI", "clockF"].map((n) => [n, WB.counter(svg, n, P)]));
  const unitEl = q("[data-unit]"), hashCap = q("[data-hash-cap]"), moreEl = q("[data-more]");
  const drawers = [...Array(8)].map((_, i) => { const g = q('[data-drawer="' + i + '"]'); return { g, body: g.querySelector(".iso-solid"), letter: g.querySelector("[data-letter]"), hash: g.querySelector("[data-hash]"), salt: g.querySelector("[data-salt]"), lit: null }; });
  const cores = G.CORE_X.map((_, i) => ({ needle: WB.dial(svg, "core" + i, P), phase: i * 0.21 }));
  const gpus = G.GPU_X.map((_, i) => ({ needle: WB.dial(svg, "gpu" + i, P), phase: i / 4 }));

  const cfg = { hash: "sha256", work: 1, salt: "on", policy: "people", logins: 20, speed: 1 };
  let table, rows, logT, holdUntil, server, sclock, seed = 7, lastCracked, note, noteAt = -9, cpuAvg = 0;
  // A Watch's stop: the rig's clock halts at the experiment's horizon (half the table, or 30 days) for a few seconds,
  // with the outcome in the readout, then runs on. { at: seconds, text: () => T(...), until: page ms }
  let stop = null;

  // ---------- the attack ----------
  function steal(newSeed = true) {
    table = makeTable({ hash: cfg.hash, work: Number(cfg.work), salt: cfg.salt === "on", policy: cfg.policy }, seed);
    if (newSeed) seed = (seed * 7 + 3) % 9973 + 1;
    rows = shownRows(table);
    logT = LOG_START; holdUntil = 0; lastCracked = new Set(); stop = null;
    rows.forEach((u, i) => {
      const d = drawers[i];
      setText(d.letter, LETTERS[i]);
      setText(d.hash, u.hash);
      setText(d.salt, cfg.salt === "on" ? L("SALT ", "SAL ") + u.saltText : L("NO SALT", "SIN SAL"));
    });
    C.same.setClamped(table.shared);
    for (const tg of tags.splice(0)) tg.g.remove();
    stat("half", L(timeText(halfTime(table))));
    stat("rig", L(rateText(table.rate)));
    half = false;
    say(T("table stolen · the rig starts guessing", "tabla robada · el equipo empieza a adivinar"), 1);
    paintAttack();
  }
  const rateText = (r) => {
    if (r >= 1e9) return T(Math.round(r / 1e9) + " billion", Math.round(r / 1e9) + " mil millones");
    if (r >= 1e6) return T(Math.round(r / 1e6) + " million", Math.round(r / 1e6) + " millones");
    const n = r >= 100 ? Math.round(r).toLocaleString("en") : String(+r.toPrecision(2));
    return T(n, n);
  };

  // The rig's clock as wheels, dddd.d and a unit; the stat and the readout say the same number in words.
  const UNITS = [[YEAR, "YEARS", "AÑOS", "years", "años"], [DAY, "DAYS", "DÍAS", "days", "días"], [3600, "HOURS", "HORAS", "hours", "horas"], [60, "MINUTES", "MINUTOS", "minutes", "minutos"], [1, "SECONDS", "SEGUNDOS", "seconds", "segundos"]];
  function clockParts(s) {
    let u = UNITS[UNITS.length - 1];
    for (const x of UNITS) if (s >= x[0]) { u = x; break; }
    const tenths = Math.min(99999, Math.floor((s / u[0]) * 10 + 1e-6));
    return { tenths, u, text: T((tenths / 10).toLocaleString("en", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " " + u[3], (tenths / 10).toLocaleString("en", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " " + u[4]) };
  }
  // a time in words: as the clock shows it (to a tenth, rounded down) up to 1,000 years, in words beyond
  const timeText = (s) => (s < 1000 * YEAR ? clockParts(s).text : dur(s));
  function clockWheels(s) {
    const { tenths, u } = clockParts(s);
    C.clockI.set(Math.floor(tenths / 10)); C.clockF.set(tenths % 10);
    setText(unitEl, L(u[1], u[2]));
  }
  function guessWheels(g) {
    if (g < 1) { C.gM.set(0); C.gF.set(0); C.gE.set(0); return; }
    let e = Math.floor(Math.log10(g)), m = Math.round((g / 10 ** e) * 10);
    if (m >= 100) { m = 10; e++; }
    C.gM.set(Math.floor(m / 10)); C.gF.set(m % 10); C.gE.set(e);
  }

  let half = false;
  function paintAttack() {
    const Tt = 10 ** logT;
    const n = crackedBy(table, Tt);
    C.cracked.setClamped(n);
    clockWheels(Tt);
    guessWheels(guessesBy(table, Tt));
    rows.forEach((u, i) => {
      const on = u.t <= Tt, d = drawers[i];
      if (d.lit !== on) { d.lit = on; d.body.toggleAttribute("data-lit", on); d.body.toggleAttribute("data-lit-fill", on); }
      // while the login desk is swamped, the readout follows the desk rather than each cracked row
      if (on && !lastCracked.has(i) && server && server.line.length > 8) lastCracked.add(i);
      if (on && !lastCracked.has(i)) {
        lastCracked.add(i);
        const twin = rows.findIndex((v, j) => j !== i && v.input === u.input);
        const what = passwordText(u);
        if (twin >= 0 && !lastCracked.has(twin)) {
          lastCracked.add(twin);
          say(T("rows " + LETTERS[i] + " and " + LETTERS[twin] + " fall together · same password, same hash", "las filas " + LETTERS[i] + " y " + LETTERS[twin] + " caen juntas · misma contraseña, mismo hash"), 2);
        } else say(T("row " + LETTERS[i] + " cracked after " + dur(u.t).en + " · " + what.en, "fila " + LETTERS[i] + " adivinada en " + dur(u.t).es + " · " + what.es), 2);
      }
    });
    if (!half && n >= N / 2) {
      half = true;
      const tt = timeText(halfTime(table));
      if (!(server && server.line.length > 8)) say(T("half the table cracked after " + tt.en, "la mitad de la tabla adivinada en " + tt.es), 2);
    }
    stat("cracked", n.toLocaleString("en") + " · " + Math.round((100 * n) / N) + "%");
    stat("clock", L(clockParts(Tt).text));
  }

  // ---------- narration: one line at a time, held a moment ----------
  let saidRank = 0;
  function say(text, rank) {
    const now = performance.now() / 1000;
    if (rank < saidRank && now - noteAt < (saidRank >= 4 ? 4.4 : 1.4)) return;
    note = text; noteAt = now; saidRank = rank;
    root.figure.say(L(note));
  }
  function narrate() {
    const now = performance.now() / 1000;
    if (now - noteAt < (saidRank >= 4 ? 4.4 : 1.6) && !(saidRank >= 4 && !stop)) return;
    saidRank = 0;
    const n = crackedBy(table, 10 ** logT);
    const busy = server.cores.filter((c) => c.busy).length;
    const clock = clockParts(10 ** logT).text;
    const line = server.line.length, wait = Math.round((line * hashSecs(cfg.hash, Number(cfg.work))) / CORES);
    if (line > 8) root.figure.say(L(int(line) + " logins waiting · a new one waits about " + wait + " s · all " + CORES + " cores hashing", int(line) + " logins esperando · uno nuevo espera unos " + wait + " s · los " + CORES + " núcleos calculando"));
    else root.figure.say(L("rig clock " + clock.en + " · " + int(n) + " of " + int(N) + " cracked · " + busy + " of " + CORES + " cores busy", "reloj del equipo " + clock.es + " · " + int(n) + " de " + int(N) + " adivinadas · " + busy + " de " + CORES + " núcleos ocupados"));
  }

  // ---------- guess tags: a stream from the hopper along the rail into the mills ----------
  const tags = [];
  let tagClock = 0, nextMill = 0;
  function spawnTag() {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = TAG_SVG;
    layers.rail.appendChild(g);
    tags.push({ g, age: 0, mill: (nextMill = (nextMill + 1) % G.GPU_X.length), pos: [...G.HOPPER_SPOT] });
  }
  function tagPos(tg) {
    // rise out of the hopper (0..0.12), slide along the rail (..0.8), drop into the mill (..1)
    const [hx, hy, hz] = G.HOPPER_SPOT, mx = G.GPU_X[tg.mill], a = tg.age;
    if (a < 0.12) { const f = a / 0.12; return [hx, lerp(hy, G.RAIL_Y, f), lerp(hz - 6, G.RAIL_Z, f)]; }
    if (a < 0.8) { const f = (a - 0.12) / 0.68; return [lerp(hx, mx, f), G.RAIL_Y, G.RAIL_Z]; }
    const f = (a - 0.8) / 0.2; return [mx, lerp(G.RAIL_Y, G.GPU_Y, f), lerp(G.RAIL_Z, G.GPU_TOP, f)];
  }
  function paintTags(dt, running) {
    tagClock += dt;
    if (running && tagClock > 0.22) { tagClock = 0; spawnTag(); }
    for (let i = tags.length - 1; i >= 0; i--) {
      const tg = tags[i];
      tg.age += dt * 0.45;
      if (tg.age >= 1) { tg.g.remove(); tags.splice(i, 1); continue; }
      tg.pos = tagPos(tg);
      tg.g.setAttribute("transform", translateAlong(P, tg.pos));
      tg.g.style.opacity = tg.age > 0.9 ? String((1 - tg.age) / 0.1) : "";
    }
    const sorted = [...tags].sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P));
    const kids = [...layers.rail.children];
    if (sorted.some((x, i) => x.g !== kids[i])) sorted.forEach((x) => layers.rail.appendChild(x.g));
  }

  // ---------- the login desk ----------
  const slips = new Map();   // login id -> { el, text, pos, target, layer, leaving, until }
  // warm: model seconds of logins to run at once (a Watch skips the desk's slow motion to the end of the minute)
  function restartServer(warm = 0) {
    for (const s of slips.values()) s.el.remove();
    slips.clear();
    server = makeServer({ rate: Number(cfg.logins), hashSecs: hashSecs(cfg.hash, Number(cfg.work)), cores: CORES }, seed + 101);
    sclock = 0; cpuAvg = 0; logAt = 0;
    if (warm) { server.runTo(warm); sclock = warm; logAt = server.log.length; cpuAvg = server.cores.filter((c) => c.busy).length / CORES; }
    // one hash: ms, or µs when under a millisecond (SHA-256); the counter and the stat in the same unit
    const ms = 1000 * hashSecs(cfg.hash, Number(cfg.work)), micro = ms < 1;
    C.hashMs.setClamped(Math.round(micro ? ms * 1000 : ms));
    setText(hashCap, micro ? "HASH µS" : "HASH MS");
    stat("login", micro ? Math.round(ms * 1000) + " µs" : Math.round(ms) + " ms");
  }
  function slipFor(L0) {
    let s = slips.get(L0.id);
    if (!s) {
      const g = document.createElementNS(NS, "g");
      g.innerHTML = SLIP_SVG;
      g.querySelector("[data-slip-text]").textContent = LETTERS[L0.user];
      const start = [G.LANE_X[G.LANE_X.length - 1], G.LANE_Y, G.LANE_Z + 8];   // drops onto the back of the lane, clear of the "+N"
      s = { el: g, body: g.querySelector(".iso-solid"), pos: start, target: start, layer: null, lit: false, leaving: false };
      slips.set(L0.id, s);
    }
    return s;
  }
  function moveTo(s, layer, target, lit) {
    s.target = target; s.seen = true;
    if (s.layer !== layer) { s.layer = layer; layers[layer].appendChild(s.el); }
  }
  let logAt = 0;
  function paintServer(dt) {
    // logins hashed so fast they were never on screen (SHA-256): a slip appears at its core and floats off
    for (; logAt < server.log.length; logAt++) {
      const e = server.log[logAt];
      if (e.type !== "done" || slips.has(e.id)) continue;
      const core = e.core ?? 0;
      const g = document.createElementNS(NS, "g");
      g.innerHTML = SLIP_SVG;
      g.querySelector("[data-slip-text]").textContent = LETTERS[e.user ?? 0];
      const at = [G.CORE_X[core], G.CORE_Y, G.CORE_TOP];
      slips.set(e.id, { el: g, body: g.querySelector(".iso-solid"), pos: [...at], target: at, layer: null, lit: false, leaving: false, seen: false });
    }
    if (server.log.length > 2000) { server.log.splice(0, logAt); logAt = 0; }
    for (const s of slips.values()) s.seen = false;
    server.line.slice(0, G.LANE_X.length).forEach((L0, k) => moveTo(slipFor(L0), "lane", [G.LANE_X[k], G.LANE_Y, G.LANE_Z]));
    server.cores.forEach((c, i) => { if (c.busy) moveTo(slipFor(c.busy), "cores", [G.CORE_X[i], G.CORE_Y, G.CORE_TOP]); });
    const more = server.line.length - G.LANE_X.length;
    setText(moreEl, more > 0 ? "+" + more : "");   // no separator, as on the IN LINE wheels
    const now = performance.now();
    for (const [id, s] of slips) {
      if (s.seen) continue;
      if (!s.leaving) { s.leaving = true; s.until = now + 700; s.target = [s.pos[0], s.pos[1] + 3, s.pos[2] + 10]; if (s.layer !== "cores") { s.layer = "cores"; layers.cores.appendChild(s.el); } }
      if (now > s.until) { s.el.remove(); slips.delete(id); }
    }
    const f = 1 - Math.exp(-dt * 10);
    for (const s of slips.values()) {
      for (let j = 0; j < 3; j++) s.pos[j] = lerp(s.pos[j], s.target[j], f);
      s.el.setAttribute("transform", translateAlong(P, s.pos));
      s.el.style.opacity = s.leaving ? String(Math.max(0, Math.min(1, (s.until - now) / 500))) : "";
    }
    // the slips on the lane: far first (the lane runs along x, so depth follows x)
    const lane = [...slips.values()].filter((s) => s.layer === "lane").sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P));
    const kids = [...layers.lane.children];
    if (lane.some((s, i) => s.el !== kids[i])) lane.forEach((s) => layers.lane.appendChild(s.el));
    // cores: the needle spins while hashing
    server.cores.forEach((c, i) => {
      const k = cores[i];
      if (c.busy) k.phase = (k.phase + dt * 1.6) % 1;
      k.needle.set(k.phase);
    });
    const line = server.line.length;
    C.line.setClamped(line);
    const wait = line ? sclock - server.line[0].born : 0;
    const tenths = Math.min(9999, Math.floor(wait * 10));
    C.waitI.set(Math.floor(tenths / 10)); C.waitF.set(tenths % 10);
    const busy = server.cores.filter((c) => c.busy).length / CORES;
    cpuAvg = lerp(cpuAvg, busy, 1 - Math.exp(-dt * 1.5));
    stat("cpu", Math.round(100 * cpuAvg) + "%");
  }

  // ---------- the loop ----------
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    const sp = Number(cfg.speed);
    // the rig
    if (stop && stop.until && performance.now() > stop.until) stop = null;
    const held = !!(stop && stop.until);
    const running = logT < LOG_END && !held;
    if (running) {
      logT = Math.min(LOG_END, logT + (dt * sp) / DECADE);
      if (stop && 10 ** logT >= stop.at) {
        logT = Math.log10(stop.at); stop.until = performance.now() + 4500;
        paintAttack();
        say(stop.text(), 4);
      }
      if (logT >= LOG_END) {
        holdUntil = performance.now() + 3500;
        const n = crackedBy(table, 10 ** LOG_END);
        say(T(int(n) + " of 1,000 cracked in 1,000 years of guessing · stealing again", int(n) + " de 1,000 adivinadas en 1,000 años de intentos · se roba de nuevo"), 3);
      }
      paintAttack();
    } else if (!held && performance.now() > holdUntil) steal();
    gpus.forEach((g) => { if (running) g.phase = (g.phase + dt * 2.4) % 1; g.needle.set(g.phase); });
    paintTags(dt * sp, running);
    // the desk
    sclock += dt * sp * SLOW;
    server.runTo(sclock);
    paintServer(dt * Math.min(sp, 3));
    narrate();
  }, onPause: pause.onPause });
  pause.bind(loop);

  function controlsFor() { root.controls.showFor(cfg.hash === "sha256" ? "fast" : "slow"); }
  function set(name, raw, quiet) {
    root.press(name, raw);
    cfg[name] = String(raw);
    if (name === "speed" || quiet) return;
    controlsFor();
    if (name === "logins") restartServer();
    else { restartServer(); steal(false); }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    steal: () => { steal(); wake(); },
    burst: () => {
      server.burst(sclock, 300);
      say(T("300 logins at once · each one costs a hash", "300 logins de golpe · cada uno cuesta un hash"), 2);
      wake();
    },
    reset: () => { restartServer(); steal(false); wake(); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  // stop: "half" (half the table cracked) or a number of seconds of attacker time; the rig's clock starts about 5 s of
  // page time before it, so the outcome shows soon after the press. desk: model seconds of logins to skip ahead.
  root.on("watch", (w) => {
    for (const key of ["hash", "work", "salt", "policy", "logins"]) set(key, w[key], true);
    if (w.speed) set("speed", w.speed, true);
    controlsFor();
    restartServer(w.desk || 0);
    steal(false);
    if (w.stop) {
      const at = 10 ** Math.log10(w.stop === "half" ? halfTime(table) : Number(w.stop));   // the clock's own float, so the counts agree
      const tt = timeText(at), k = () => crackedBy(table, at);
      const text = w.stop === "half"
        ? () => T("half the table cracked after " + tt.en + " · " + int(k()) + " of 1,000", "la mitad de la tabla adivinada en " + tt.es + " · " + int(k()) + " de 1,000")
        : () => T(tt.en + " of guessing: " + int(k()) + " of 1,000 cracked (" + pct(k() / N) + ")", tt.es + " de intentos: " + int(k()) + " de 1,000 adivinadas (" + pct(k() / N) + ")");
      stop = { at, text, until: 0 };
      logT = Math.max(LOG_START, Math.log10(at) - (5 * Number(cfg.speed || 1)) / DECADE);
      paintAttack();
    } else stop = null;
    if (w.desk) say(T("a minute of " + w.logins + " logins a second, skipped ahead · " + int(server.line.length) + " waiting", "un minuto de " + w.logins + " logins por segundo, adelantado · " + int(server.line.length) + " esperando"), 3);
    wake();
  });

  loop.setPaused(loop.paused);
  controlsFor();
  restartServer();
  steal(false);
}

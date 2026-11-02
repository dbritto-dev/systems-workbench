// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The elevator lobby in the browser: runs the debounce model, moves passengers, the car, tickets and answers, wires
// the controls and the experiment cards. mount() gets the build-time data from page.ts (geometry, part drawings,
// experiment results).
import { iso, pathOf, translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import { digitPath, counterCells, digitsOf } from "../../../workbench/digits.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats, show, setText, act, pauseControls } from "../../runtime/dom";
import { lerpVec, smoothstep } from "../../lib/tween";
import { one } from "../../lib/format";
import { makeSim } from "./sim";

export default function mount({ P, G, EXPERIMENTS, PAWN, TICKET_SVG, DOT_SVG, PEG_SVG, POST_SVG, RESULTS, TYPE }) {
  const stage = document.querySelector("[data-lobby]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const say = readout();
  const NS = "http://www.w3.org/2000/svg";
  const at = (p) => iso(p, P);
  const path = (pts) => pathOf(pts.map(at));

  function makePool(layer, html, n) {
    return Array.from({ length: n }, () => { const g = document.createElementNS(NS, "g"); g.innerHTML = html; g.style.display = "none"; layer.appendChild(g); return g; });
  }
  const riders = makePool(q("[data-riders]"), PAWN, 12);
  const walkers = makePool(q("[data-walkers]"), PAWN, 24);
  const climbers = makePool(q("[data-climbers]"), PAWN, 16);
  const tickets = makePool(q("[data-tickets]"), TICKET_SVG, G.SLOTS.length);
  const dots = makePool(q("[data-dots]"), DOT_SVG, 10);
  const pegs = makePool(q("[data-tape]"), PEG_SVG, 90);
  const posts = makePool(q("[data-tape]"), POST_SVG, 40);
  const carEl = q("[data-car]"), cable = q("[data-cable]");
  const doorsOpen = q('[data-doors="open"]'), doorsClosed = q('[data-doors="closed"]');
  const pie = { quiet: q('[data-pie="quiet"]'), first: q('[data-pie="first"]') };
  const markEl = q('[data-mark="first"]'), markPath = markEl.querySelector("path");
  const keyEls = Object.fromEntries([...svg.querySelectorAll("[data-key]")].map((el) => [el.dataset.key, { cap: el.querySelector("[data-cap]"), lit: el.querySelector("[data-cap-lit]") }]));
  const typedText = q('[data-text="typed"]'), shownText = q('[data-text="shown"]'), shownField = q('[data-field="shown"]');
  const lampOn = q('[data-lamp="on"]'), lampOff = q('[data-lamp="off"]');

  // Counters: this figure draws its wheels as data-digit="name-j" paths (not the shared parts' data-counter), so
  // WB.counter can't find them; the same redraw-on-change, kept here.
  function counter(name, c) { const cells = counterCells(c); return { c, cells, els: cells.map((_, j) => q('[data-digit="' + name + '-' + j + '"]')), shown: [] }; }
  const dials = { keys: counter("keys", G.COUNTERS.keys), aboard: counter("aboard", G.COUNTERS.aboard), sent: counter("sent", G.COUNTERS.sent), stale: counter("stale", G.COUNTERS.stale) };
  function showCount(dial, v) { digitsOf(v, dial.c.count).forEach((d, j) => { if (dial.shown[j] !== d) { dial.shown[j] = d; dial.els[j].setAttribute("d", digitPath(iso, P, dial.cells[j], d)); } }); }
  const place = (g, p, extra) => { show(g, true); WB.place(g, P, p); if (extra !== undefined) g.style.opacity = extra; };
  const hide = (list, from) => { for (let i = from; i < list.length; i++) show(list[i], false); };
  const lerp = lerpVec;
  const ease = smoothstep;

  const cfg = { mode: "trailing", wait: 0.3, maxWait: 0, input: "typing", latency: "variable", cancel: "off", speed: 1 };
  let model, clock, lagText, seenShown, liveText;
  let seed = (Date.now() % 1e6) + 1;

  const ride = (r) => Math.min(0.25, 0.4 * cfg.wait, 0.5 * r.lat);
  const transit = (r) => Math.min(0.45, 0.5 * r.lat);
  const wireT = (r) => Math.min(0.35, 0.4 * r.lat);
  const walkT = () => Math.min(0.3, 0.8 * cfg.wait);
  const arriveAt = (r) => r.t + (cfg.mode === "none" ? transit(r) : ride(r));

  function restart() {
    model = makeSim({ mode: cfg.mode, wait: cfg.wait, maxWait: cfg.maxWait, input: cfg.input, latency: cfg.latency, cancel: cfg.cancel === "on" }, seed++);
    clock = 0; lagText = "–"; seenShown = 0; liveText = "";
    if (cfg.input !== "live") warm();
    markEl.style.display = cfg.maxWait > 0 && cfg.mode === "trailing" ? "" : "none";
    if (cfg.maxWait > 0) { const c = G.DIALS.first, a = Math.min(1, cfg.maxWait / 2) * Math.PI * 2, r = G.DIALS.r; markPath.setAttribute("d", path([[c[0] + 0.5 * r * Math.sin(a), c[1], c[2] + 0.5 * r * Math.cos(a)], [c[0] + 1.02 * r * Math.sin(a), c[1], c[2] + 1.02 * r * Math.cos(a)]])); }
    paint();
  }

  // Start a little way in, at a moment that shows the machine at work.
  function warm() {
    const inFlight = () => model.requests.filter((r) => r.status === "flight" && clock >= arriveAt(r) && clock < r.done - wireT(r)).length;
    const good = (strict) => {
      if (cfg.input === "hold") return clock > 6.6 && clock < 7.6;
      if (cfg.input === "clicks") return model.requests.length >= 2 && (cfg.mode === "none" ? inFlight() >= 1 : clock - model.events[model.events.length - 1].t < 0.12);
      if (cfg.mode === "trailing") { const p = model.pending; const left = (model.fireAt - clock) / cfg.wait; return p && p.keys >= (strict ? 4 : 3) && left > 0.35 && left < (strict ? 0.7 : 1) && model.screen.text && (!strict || model.requests.length >= 8); }
      if (cfg.mode === "none") return model.requests.filter((r) => r.status === "flight" && clock < r.done - wireT(r)).length >= (strict ? 3 : 2) && model.screen.text;
      return model.quietUntil > clock && model.events.length && model.events[model.events.length - 1].fate === "ignored" && model.screen.text;
    };
    for (clock = 4; clock < 60; clock += 0.02) { model.runTo(clock); if (good(clock < 30)) return; }
  }

  function keyFor(e) {
    if (cfg.input === "hold") return " ";
    if (cfg.input === "clicks") return "⏎";
    const ch = (e.text[e.text.length - 1] || " ").toLowerCase();
    return keyEls[ch] ? ch : "⏎";
  }

  function paint() {
    const m = model, now = clock;
    // Keys: the ones pressed in the last 120 ms dip and light.
    const pressed = new Set();
    for (let i = m.events.length - 1; i >= 0 && now - m.events[i].t < 0.12; i--) pressed.add(keyFor(m.events[i]));
    for (const [ch, el] of Object.entries(keyEls)) { const on = pressed.has(ch); el.cap.style.display = on ? "none" : ""; el.lit.style.display = on ? "" : "none"; }

    // The car: find the trip in progress, if any.
    let trip = null;
    if (cfg.mode !== "none") for (let i = m.requests.length - 1; i >= 0; i--) { const r = m.requests[i]; if (now >= r.t && now < r.t + 2 * ride(r)) { trip = r; break; } if (r.t + 2 * ride(r) < now - 1) break; }
    let carZ = 0, up = false;
    if (trip) { const R = ride(trip), p = (now - trip.t) / R; up = p < 1; carZ = G.TOP * (up ? ease(p) : 1 - ease(p - 1)); }
    carEl.setAttribute("transform", carZ ? translateAlong(P, [0, 0, carZ]) : "");
    doorsOpen.style.display = trip ? "none" : ""; doorsClosed.style.display = trip ? "" : "none";
    const cx = G.CAR.x + G.CAR.w / 2, cy = G.CAR.y + G.CAR.d / 2;
    cable.setAttribute("d", path([[G.CABLE_TOP[0], G.CABLE_TOP[1], G.CABLE_TOP[2] - carZ], [cx, cy, G.CAR_H + 1.6]]));

    // Riders inside the car, people waiting in front of it, people walking from the keyboard.
    let nr = 0, nw = 0;
    const pending = m.pending;
    const pend = cfg.mode === "trailing" && pending ? pending.events : [];
    if (trip && up) for (let i = 0; i < Math.min(12, trip.keys); i++) place(riders[nr++], [...G.RIDE_SLOTS[i], 1.6]);
    pend.forEach((e, i) => {
      const t = (now - e.t) / walkT();
      const home = !trip;
      const target = home ? [...G.RIDE_SLOTS[Math.min(11, i)], 1.6] : [...G.WAIT_SLOTS[Math.min(7, i)], 0];
      if (t >= 1) { if (home) { if (nr < 12) place(riders[nr++], target); } else if (nw < walkers.length) place(walkers[nw++], target, 1); }
      else if (nw < walkers.length) {
        // Walk to the door, then step in.
        const door = [target[0], G.CAR.y + G.CAR.d + 4, 0];
        const pos = t < 0.75 ? lerp([...G.KB_EXIT, 0], door, ease(t / 0.75)) : lerp(door, home ? [target[0], target[1], 0] : target, ease((t - 0.75) / 0.25));
        if (home && t >= 0.75) { if (nr < 12) place(riders[nr++], [pos[0], pos[1], 1.6]); }
        else place(walkers[nw++], pos, 1);
      }
    });
    if (cfg.mode === "leading") {
      for (let i = m.events.length - 1; i >= 0 && now - m.events[i].t < 0.6; i--) {
        const e = m.events[i]; if (e.fate !== "ignored" || nw >= walkers.length) continue;
        const t = (now - e.t) / 0.6, door = [G.CAR.x + 12 + (i % 3) * 5, G.CAR.y + G.CAR.d + 8, 0];
        place(walkers[nw++], t < 0.5 ? lerp([...G.KB_EXIT, 0], door, ease(t * 2)) : lerp(door, [...G.KB_EXIT, 0], ease((t - 0.5) * 2)), String(Math.max(0, 1 - t)));
      }
    }
    hide(riders, nr); hide(walkers, nw);

    // Without debounce: every request is its own climber, from the keyboard to the foot of the stairs and up,
    // for as long as the request is out (a slow request climbs slowly); at the top its answer takes the wire.
    let nc = 0;
    if (cfg.mode === "none") for (let i = m.requests.length - 1; i >= 0; i--) {
      const r = m.requests[i]; const T = r.done - wireT(r) - r.t;
      const gone = r.status === "cancelled" ? now - r.cancelledAt : 0;   // a cancelled climber fades where it stood
      if (now - r.t > T || gone > 0.4) { if (now - r.t > 4) break; continue; }
      if (now < r.t || nc >= climbers.length) continue;
      const f = (Math.min(now, r.cancelledAt ?? now) - r.t) / T, foot = [G.STAIR.x0 - 3, G.STAIR.y + G.STAIR.d / 2, 0];
      let pos;
      if (f < 0.25) pos = lerp([...G.KB_EXIT, 0], foot, ease(f / 0.25));
      else { const s = (f - 0.25) / 0.75, run = (G.STAIR.x1 - G.STAIR.x0) / G.STEPS, k = Math.min(G.STEPS - 1, Math.floor(s * G.STEPS)); pos = [G.STAIR.x0 + s * (G.STAIR.x1 - G.STAIR.x0) - run / 2, foot[1], ((k + 1) * G.TOP) / G.STEPS]; }
      place(climbers[nc++], pos, gone > 0 ? String(1 - gone / 0.4) : "1");
    }
    hide(climbers, nc);

    // Tickets on the desk, answers on the wire.
    const slotUsed = new Array(G.SLOTS.length).fill(false);
    let nd = 0, inFlight = 0;
    for (let i = m.requests.length - 1; i >= 0; i--) {
      const r = m.requests[i];
      if (r.done < now - 3 && (r.status !== "cancelled" || r.cancelledAt < now - 3)) { if (now - r.t > 6) break; continue; }
      const s = r.id % G.SLOTS.length;
      if (r.status === "cancelled") {
        if (cfg.mode !== "none" && now >= arriveAt(r) && now < r.cancelledAt + 0.7 && !slotUsed[s]) { slotUsed[s] = true; const g = tickets[s]; place(g, [...G.SLOTS[s], 0]); g.children[0].style.display = "none"; g.children[1].style.display = ""; }
        continue;
      }
      if (now < r.t || now >= r.done) continue;
      inFlight++;
      if (now >= r.done - wireT(r)) {
        if (nd < dots.length) { const f = (now - (r.done - wireT(r))) / wireT(r); place(dots[nd++], along(G.WIRE, f)); }
      } else if (cfg.mode !== "none" && now >= arriveAt(r) && !slotUsed[s]) { slotUsed[s] = true; const g = tickets[s]; place(g, [...G.SLOTS[s], 0]); g.children[0].style.display = ""; g.children[1].style.display = "none"; }
    }
    tickets.forEach((g, s) => { if (!slotUsed[s]) g.style.display = "none"; });
    hide(dots, nd);

    // Dials: the door timer, and how long the first passenger has waited.
    let rem = 0, first = 0;
    if (cfg.mode === "trailing" && pending) { rem = (m.fireAt - now) / cfg.wait; first = (now - pending.first) / 2; }
    if (cfg.mode === "leading") rem = (m.quietUntil - now) / cfg.wait;
    rem = Math.max(0, Math.min(1, rem)); first = Math.max(0, Math.min(1, first));
    setNeedle("quiet", rem); setNeedle("first", first);

    // Tape: pegs for keys, posts for requests.
    let np = 0, nq = 0;
    const xOf = (t) => G.NOW_X - (now - t) * G.TAPE_SCALE;
    for (let i = m.events.length - 1; i >= 0; i--) {
      const e = m.events[i]; if (now - e.t > G.TAPE_SECONDS) break; if (np >= pegs.length) break;
      place(pegs[np++], [xOf(e.t), G.TAPE.y + 4, 0], e.fate === "ignored" ? ".35" : "1");
    }
    for (let i = m.requests.length - 1; i >= 0; i--) {
      const r = m.requests[i]; if (now - r.t > G.TAPE_SECONDS) break; if (nq >= posts.length) break;
      const g = posts[nq++]; place(g, [xOf(r.t), G.TAPE.y + 8.5, 0]);
      const off = r.status === "cancelled"; g.children[1].style.display = off ? "none" : ""; g.children[2].style.display = off ? "" : "none";
    }
    hide(pegs, np); hide(posts, nq);

    // Screen and counters.
    const typed = m.screen.typed, stale = m.screen.id >= 0 && m.screen.id < m.screen.maxId;
    setText(typedText, typed ? (typed.length > 22 ? "…" + onScreen(typed).slice(-21) : onScreen(typed)) + "▏" : "▏");
    setText(shownText, m.screen.text ? (m.screen.text.length > 22 ? "…" + onScreen(m.screen.text).slice(-21) : onScreen(m.screen.text)) : "–");
    shownText.dataset.tone = stale ? "lit" : "hi";
    shownField.toggleAttribute("data-lit", stale);
    lampOn.style.display = stale ? "" : "none"; lampOff.style.display = stale ? "none" : "";
    showCount(dials.keys, m.events.length); showCount(dials.sent, m.requests.length); showCount(dials.stale, m.screen.staleShown);
    showCount(dials.aboard, trip ? (up ? trip.keys : 0) : pend.length);

    // Lag: when the answer for exactly what is typed lands, measure it from the last keystroke.
    const shownNow = m.requests.filter((r) => r.status === "shown").length;
    if (shownNow !== seenShown) {
      seenShown = shownNow;
      const last = m.events[m.events.length - 1];
      if (last && m.screen.text === typed && m.screen.id === m.screen.maxId) { const r = m.requests[m.screen.id]; if (r.done >= last.t) lagText = Math.round((r.done - last.t) * 1000) + " ms"; }
    }

    // Readout and stats.
    let msg;
    if (stale) msg = T("an older answer replaced a newer one · the screen is behind", "una respuesta anterior reemplazó a una más reciente · la pantalla está atrasada");
    else if (trip) msg = up ? T("doors closed · " + trip.keys + (trip.keys === 1 ? " key" : " keys") + " going up as one request", "puertas cerradas · " + trip.keys + (trip.keys === 1 ? " tecla sube" : " teclas suben") + " como una sola solicitud") : T("car coming back down", "la cabina vuelve a bajar");
    else if (cfg.mode === "none") msg = T("no debounce · every key climbs the stairs · " + inFlight + " in flight", "sin debounce · cada tecla sube por la escalera · " + inFlight + " en curso");
    else if (cfg.mode === "leading") msg = rem > 0 ? T("leading · ignoring keys until " + Math.round(cfg.wait * 1000) + " ms of quiet", "al inicio · ignora teclas hasta " + Math.round(cfg.wait * 1000) + " ms de calma") : T("leading · the next key goes up at once", "al inicio · la próxima tecla sube enseguida");
    else if (pending) { const left = Math.max(0, Math.round((m.fireAt - now) * 1000)); msg = T("door open · " + pending.keys + " aboard · closes in " + left + " ms unless someone else comes", "puerta abierta · " + pending.keys + " a bordo · cierra en " + left + " ms si no llega nadie más"); }
    else msg = T("door open · waiting for a key", "puerta abierta · esperando una tecla");
    say(L(msg));
    stat("keys", m.events.length);
    stat("reqs", m.requests.length);
    stat("per", m.requests.length ? (m.events.length / m.requests.length).toFixed(1) : "–");
    stat("lag", lagText);
    stat("stale", m.screen.staleShown);
    stat("cancelled", m.requests.filter((r) => r.status === "cancelled").length);
  }
  // The clicks input's screen text is "order N", data from the model; it reads "pedido N" in Spanish.
  function onScreen(s) { return cfg.input === "clicks" ? s.replace(/^order /, L("order ", "pedido ")) : s; }
  // A dial shows its value as a filled wedge, clockwise from twelve o'clock.
  function setNeedle(name, frac) {
    const c = G.DIALS[name], r = G.DIALS.r * 0.8;
    if (frac <= 0.002) { pie[name].setAttribute("d", ""); return; }
    const n = Math.max(2, Math.ceil(frac * 36)), pts = [c];
    for (let i = 0; i <= n; i++) { const a = (i / n) * frac * Math.PI * 2; pts.push([c[0] + r * Math.sin(a), c[1], c[2] + r * Math.cos(a)]); }
    pie[name].setAttribute("d", pathOf(pts.map(at), true));
  }
  // A point a share f of the way along a polyline (by length).
  function along(pts, f) {
    const seg = []; let total = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); seg.push(l); total += l; }
    let d = Math.max(0, Math.min(1, f)) * total;
    for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) return lerp(pts[i], pts[i + 1], d / seg[i]); d -= seg[i]; }
    return pts[pts.length - 1];
  }
  const stat = stats();

  const pause = pauseControls(stage, say);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    if (name === "speed") { cfg.speed = Number(raw); WB.pressSeg(name, raw); return; }
    cfg[name] = ["wait", "maxWait"].includes(name) ? Number(raw) : raw;
    WB.pressSeg(name, raw);
    if (!quiet) restart();
  }
  WB.onSegments((name, value) => set(name, value));
  act("reset").addEventListener("click", () => restart());

  // The "Type here" box: Panel has no text input, so it goes in here, between the settings and the speed control.
  const typeBox = document.createElement("div");
  typeBox.className = "control";
  const typeLabel = document.createElement("span");
  typeLabel.textContent = L(TYPE.label);
  const typeIn = document.createElement("input");
  Object.assign(typeIn, { className: "type-in", type: "text", placeholder: L(TYPE.placeholder), autocomplete: "off", spellcheck: false, maxLength: 40 });
  typeIn.setAttribute("data-type", "");
  typeIn.setAttribute("aria-label", L(TYPE.aria));
  typeBox.append(typeLabel, typeIn);
  const speedBox = document.querySelector('[data-set="speed"]')?.closest(".control");
  if (speedBox) speedBox.before(typeBox); else document.querySelector(".controls").append(typeBox);
  typeIn.addEventListener("focus", () => { if (cfg.input !== "live") set("input", "live"); });
  typeIn.addEventListener("input", () => {
    if (cfg.input !== "live") set("input", "live");
    model.feed(clock, typeIn.value);
    if (loop.paused) loop.setPaused(false);
  });

  // ---------- experiments (results computed at build time from the same model, six seeds each) ----------
  const ms = (x) => Math.round(x * 1000) + " ms";
  const sec = (x) => (x >= 1 ? one(x) + " s" : ms(x));
  const RUNS = {
    search: () => {
      const { off, on } = RESULTS.search;
      return { verdict: T("A search is " + one(off.keysPerSession) + " keys on average. Without debounce it sent " + one(off.perSession) + " requests; with a 300 ms debounce, " + one(on.perSession) + ".",
          "Una búsqueda tiene " + one(off.keysPerSession) + " teclas en promedio. Sin debounce enviaba " + one(off.perSession) + " solicitudes; con un debounce de 300 ms, " + one(on.perSession) + "."),
        bars: [[T("Keys per search", "Teclas por búsqueda"), 1, one(off.keysPerSession)], [T("Requests, no debounce", "Solicitudes, sin debounce"), off.perSession / off.keysPerSession, one(off.perSession)], [T("Requests, 300 ms debounce", "Solicitudes, debounce de 300 ms"), on.perSession / off.keysPerSession, one(on.perSession), true]] };
    },
    wait: () => {
      const r = RESULTS.wait;
      const k = r[0].keysPerSession, lagTop = Math.max(...r.map((x) => x.lag));
      const reqs = r.map((x) => one(x.perSession)).join(" → "), lags = r.map((x) => ms(x.lag)).join(" → ");
      return { verdict: T("Requests per search: " + reqs + " (of " + one(k) + " keys). Last key to results: " + lags + ".",
          "Solicitudes por búsqueda: " + reqs + " (de " + one(k) + " teclas). De la última tecla a los resultados: " + lags + "."),
        bars: [[T("Requests, 100 ms", "Solicitudes, 100 ms"), r[0].perSession / k, one(r[0].perSession)], [T("Requests, 300 ms", "Solicitudes, 300 ms"), r[1].perSession / k, one(r[1].perSession)], [T("Requests, 1 s", "Solicitudes, 1 s"), r[2].perSession / k, one(r[2].perSession), true],
          [T("Wait for results, 100 ms", "Espera de resultados, 100 ms"), r[0].lag / lagTop, ms(r[0].lag)], [T("Wait for results, 1 s", "Espera de resultados, 1 s"), r[2].lag / lagTop, ms(r[2].lag), true]] };
    },
    hold: () => {
      const { plain, capped } = RESULTS.hold;
      return { verdict: T("Debounce 300 ms: the first request left " + sec(plain.firstSend) + " after the stream began, " + one(plain.sentDuring) + " during it. With maxWait 1 s: first after " + sec(capped.firstSend) + ", " + one(capped.sentDuring) + " during the 5 s.",
          "Debounce de 300 ms: la primera solicitud salió " + sec(plain.firstSend) + " después de que empezó el flujo, " + one(plain.sentDuring) + " durante él. Con maxWait de 1 s: la primera a los " + sec(capped.firstSend) + ", " + one(capped.sentDuring) + " durante los 5 s."),
        bars: [[T("First request, 300 ms", "Primera solicitud, 300 ms"), Math.min(1, plain.firstSend / 6), sec(plain.firstSend), true], [T("First request, maxWait 1 s", "Primera solicitud, maxWait 1 s"), Math.min(1, capped.firstSend / 6), sec(capped.firstSend)]] };
    },
    clicks: () => {
      const r = RESULTS.clicks;
      const names = ["No debounce", "Trailing 300 ms", "Leading 300 ms"], nombres = ["Sin debounce", "Al final 300 ms", "Al inicio 300 ms"];
      return { verdict: T(r.map((x, i) => names[i] + ": " + one(x.perSession) + " orders, first after " + ms(x.firstSend)).join(" · ") + ".",
          r.map((x, i) => nombres[i] + ": " + one(x.perSession) + " pedidos, el primero a los " + ms(x.firstSend)).join(" · ") + "."),
        bars: r.flatMap((x, i) => [[T(names[i] + ", orders", nombres[i] + ", pedidos"), x.perSession / 2, one(x.perSession), i === 2], [T(names[i] + ", delay", nombres[i] + ", demora"), Math.min(1, x.firstSend / 0.6), ms(x.firstSend), i === 2]]) };
    },
    order: () => {
      const { off, deb, can } = RESULTS.order;
      const per = (x) => Math.round(x.staleShare * 100), top = Math.max(1, per(off));
      return { verdict: T("Times an older answer replaced a newer one, per 100 searches: " + per(off) + " without debounce, " + per(deb) + " with a 300 ms debounce, " + per(can) + " when each new request cancels the older one.",
          "Veces que una respuesta anterior reemplazó a una más reciente, por cada 100 búsquedas: " + per(off) + " sin debounce, " + per(deb) + " con un debounce de 300 ms, " + per(can) + " cuando cada solicitud nueva cancela la anterior."),
        bars: [[T("No debounce", "Sin debounce"), per(off) / top, String(per(off))], [T("Debounce 300 ms", "Debounce de 300 ms"), per(deb) / top, String(per(deb)), true], [T("Debounce + cancel", "Debounce + cancelar"), per(can) / top, String(per(can))]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    for (const key of ["mode", "wait", "maxWait", "input", "latency", "cancel"]) set(key, String(w[key]), true);
    restart();
    if (loop.paused) loop.setPaused(false);
  } });

  loop.setPaused(loop.paused);
  restart();
}

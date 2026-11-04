// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The dispatch office in the browser: steps the pub/sub model, moves the capsules, cards and stamps, and answers
// the controls. mount() gets the build-time data from page.ts (projection, geometry) and root, the <wb-lesson>.
import { translateAlong, lineOnTop } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { show, playPause } from "../../runtime/dom";
import { lerp, lerpVec, easeInOutCubic } from "../../lib/tween";
import { clamp } from "../../lib/stats";
import { T, STATIONS, STATION_X, OFFLINE_STATION, createModel, step, active, subscribed, setOffline, setDurable } from "./sim";

export default function mount({ P, G }, root) {
  const LETTER = "ABCDE";

  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const platenEl = q("[data-platen]"), pubcard = q("[data-pubcard]"), pubcap = q("[data-pubcap]"), rotor = q("[data-rotor]");
  const tubeEls = STATION_X.map((_, i) => q('[data-tube="' + i + '"]'));
  const capEls = tubeEls.map((el) => [el.querySelector("[data-cap0]"), el.querySelector("[data-cap1]")]);
  const portCaps = STATION_X.map((_, i) => q('[data-port="' + i + '"] [data-cap]'));
  const recvEls = STATION_X.map((_, i) => q('[data-recv="' + i + '"]'));
  const binEls = STATION_X.map((_, i) => q('[data-tray="' + i + '"] + [data-bin]'));
  const anchorBed = q('[data-anchor="bed"]');
  const stationEls = STATION_X.map((_, i) => q('[data-station="' + i + '"]'));
  const topEls = STATION_X.map((_, i) => q('[data-top="' + i + '"]'));
  const workEls = topEls.map((el) => el.querySelector("[data-work]"));
  const stampEls = topEls.map((el) => el.querySelector("[data-stamp]"));
  const lampEls = topEls.map((el) => el.querySelector("[data-lamp] .iso-solid"));
  const coverEls = topEls.map((el) => el.querySelector("[data-cover]"));
  const trayEls = STATION_X.map((_, i) => q('[data-tray="' + i + '"]'));
  const stackEls = trayEls.map((el) => [...el.querySelectorAll("[data-card]")]);
  const dropEls = STATION_X.map((_, i) => q('[data-drop="' + i + '"]'));

  const cfg = { subs: 3, slow: false, offline: false, durable: true, crash: 0, idempotent: false, shared: false, direct: false };
  let speed = 1;
  let m = fresh();
  let drops = new Array(STATIONS).fill(null);
  const lens = G.ROUTES.map(lengthOf), pubLen = lengthOf(G.PUB_ROUTE);
  let note = null;
  function fresh() { const model = createModel({ ...cfg }, (Date.now() % 1e6) + 1); model.log = []; if (cfg.offline) setOffline(model, true); return model; }

  const ease = easeInOutCubic;
  const lerp3 = lerpVec;
  const clamp01 = (v) => clamp(v);
  // T is the timing table here, so bilingual messages use B(en, es).
  const B = WB.T, L = WB.L;
  const say = (msg) => root.figure.say(L(msg));
  const place = (el, p, opacity = 1) => { el.setAttribute("transform", translateAlong(P, p)); el.style.opacity = String(opacity); };
  const trayVisible = (i) => active(m, i) && !(m.cfg.shared && i === 1) && (m.stations[i].online || m.cfg.durable);
  const stackTop = (n) => G.TRAY_FLOOR + Math.min(n, G.TRAY_MAX - 1) * G.TRAY_STEP;
  // Polylines: total length, and the point a share of the way along. In 3D, unlike src/lib/geometry (x, y only).
  function lengthOf(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); return s; }
  function along(pts, total, share) {
    let left = Math.max(0, Math.min(1, share)) * total;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      if (left <= d || i === pts.length - 1) return lerp3(a, b, d ? Math.min(1, left / d) : 0);
      left -= d;
    }
    return pts[pts.length - 1];
  }
  const tubeOn = (i) => active(m, i) && !(m.cfg.shared && i === 1);
  // Phases of one message in flight: press tube, hub, then every station tube at once.
  const PUB_SHARE = 0.3, HUB_SHARE = 0.08;

  function events() {
    for (const e of m.log) {
      if (e.type === "drop") drops[e.q] = { t0: m.t, bin: false };
      if (e.type === "lost") drops[e.q] = { t0: m.t, bin: true };
      if (e.type === "call") note = { until: m.t + 0.8 }, say(B("press calls " + LETTER[e.q] + " with #" + e.id + " and waits for its stamp", "la prensa llama a " + LETTER[e.q] + " con #" + e.id + " y espera su sello"));
      if (e.type === "publish" && !m.cfg.direct && (!note || m.t > note.until)) {
        const copies = STATION_X.filter((_, q) => subscribed(m, q)).length;
        say(B("message #" + e.id + " · " + copies + (copies === 1 ? " copy" : " copies"), "mensaje #" + e.id + " · " + copies + (copies === 1 ? " copia" : " copias")));
      }
      if (e.type === "lost") note = { until: m.t + 1.5 }, say(B(LETTER[e.q] + " is offline · #" + e.id + " lost for it", LETTER[e.q] + " está desconectada · #" + e.id + " perdido para ella"));
      if (e.type === "dropped") note = { until: m.t + 1.5 }, say(B(LETTER[e.q] + " unsubscribed · " + e.n + " waiting cards dropped", LETTER[e.q] + " canceló la suscripción · " + e.n + " tarjetas en espera descartadas"));
      if (e.type === "crash") note = { until: m.t + 1.5 }, say(B(LETTER[e.i] + " crashed before the ack · #" + e.id + " goes back", LETTER[e.i] + " se cayó antes del ack · #" + e.id + " vuelve a la cola"));
      if (e.type === "duplicate") note = { until: m.t + 1.5 }, say(m.cfg.idempotent
        ? B(LETTER[e.i] + " handled #" + e.id + " again · no effect", LETTER[e.i] + " procesó #" + e.id + " otra vez · sin efecto")
        : B(LETTER[e.i] + " handled #" + e.id + " again · effect applied twice", LETTER[e.i] + " procesó #" + e.id + " otra vez · efecto aplicado dos veces"));
    }
    m.log.length = 0;
  }

  function paint() {
    // Press and published card.
    const pressP = m.press ? m.press.t / T.press : 0;
    platenEl.setAttribute("transform", translateAlong(P, [0, 0, -G.PLATEN_DROP * Math.sin(Math.PI * pressP)]));
    if (m.press) { if (pubcard.parentNode !== anchorBed) anchorBed.appendChild(pubcard); place(pubcard, G.BED_CARD, clamp01(pressP * 3) * (pressP > 0.8 ? (1 - pressP) / 0.2 : 1)); }
    else pubcard.style.opacity = "0";
    // Messages in flight: one capsule down the press tube, a short spin in the hub, then one copy down every tube at once.
    pubcap.style.opacity = "0";
    capEls.forEach((pair) => pair.forEach((el) => (el.style.opacity = "0")));
    let spin = null;
    m.inflight.forEach((f, n) => {
      const p = f.t / T.tube;
      if (p < PUB_SHARE) place(pubcap, along(G.PUB_ROUTE, pubLen, ease(p / PUB_SHARE)));
      else if (p < PUB_SHARE + HUB_SHARE) spin = (p - PUB_SHARE) / HUB_SHARE;
      else {
        const share = ease((p - PUB_SHARE - HUB_SHARE) / (1 - PUB_SHARE - HUB_SHARE));
        for (let i = 0; i < STATIONS; i++) if (tubeOn(i) && (f.only === undefined || f.only === i)) place(capEls[i][n % 2], along(G.ROUTES[i], lens[i], share));
      }
    });
    const ang = (spin === null ? 0 : spin) * Math.PI * 2, H = G.HUB;
    rotor.innerHTML = '<path class="iso-line" data-tone="' + (spin === null ? "mid" : "lit") + '" d="' + lineOnTop([H.x, H.y], [H.x + Math.cos(ang) * H.r, H.y + Math.sin(ang) * H.r], H.z, P) + '" style="stroke-width:1.1"/>';
    // Trays and drops.
    for (let i = 0; i < STATIONS; i++) {
      show(stationEls[i], active(m, i)); show(topEls[i], active(m, i));
      const tv = trayVisible(i); show(trayEls[i], tv);
      const on = tubeOn(i); show(tubeEls[i], on); show(portCaps[i], !on); show(recvEls[i], on);
      show(binEls[i], on && !tv);
      const d = drops[i]; const dp = d ? (m.t - d.t0) / 0.3 : 1;
      const dropping = d && dp < 1 && (d.bin || tv);
      const n = Math.max(0, m.queues[i].length - (dropping && !d.bin ? 1 : 0));
      stackEls[i].forEach((el, k) => show(el, k < Math.min(n, G.TRAY_MAX)));
      if (dropping) {
        // The capsule pops out of the receiver and the card lands in the tray (or the bin, where it is lost).
        const from = G.RECV_TOP[i], up = [from[0], from[1], from[2] + 7];
        const to = d.bin ? [STATION_X[i], G.TRAY_CARD_Y, 7] : [STATION_X[i], G.TRAY_CARD_Y, stackTop(n)];
        const pos = dp < 0.35 ? lerp3(from, up, ease(dp / 0.35)) : lerp3(up, to, ease((dp - 0.35) / 0.65));
        place(dropEls[i], pos, d.bin ? Math.min(1, (1 - dp) * 2.5) : 1);
      } else { dropEls[i].style.opacity = "0"; drops[i] = null; }
      // Station.
      const s = m.stations[i], b = s.busy, cx = STATION_X[i];
      show(coverEls[i], !s.online);
      const pad = [cx, G.PAD_Y, G.PAD_Z];
      let stampDrop = 0, lampOn = false;
      if (!b) workEls[i].style.opacity = "0";
      else {
        const p = clamp01(b.t / b.dur);
        const tray = [STATION_X[b.q], G.TRAY_CARD_Y, stackTop(m.queues[b.q].length)];
        if (b.phase === "take") place(workEls[i], lerp3(tray, pad, ease(p)));
        else if (b.phase === "work") { place(workEls[i], pad); stampDrop = G.STAMP_DROP * ease(clamp01((p - 0.55) / 0.45)); }
        else if (b.phase === "ack") { place(workEls[i], [cx + 14 * ease(p), G.PAD_Y, G.PAD_Z], 1 - p); stampDrop = G.STAMP_DROP * (1 - ease(p)); lampOn = true; }
        else if (b.phase === "crash") { place(workEls[i], lerp3(pad, tray, ease(p))); stampDrop = G.STAMP_DROP * (1 - ease(p)) * 0.4; }
      }
      stampEls[i].setAttribute("transform", stampDrop ? translateAlong(P, [0, 0, -stampDrop]) : "");
      lampEls[i].toggleAttribute("data-lit", lampOn);
    }
  }

  const stat = (key, value) => root.stat(key, value);
  function showStats() {
    const sum = (f) => m.stations.reduce((a, s) => a + f(s), 0);
    stat("published", m.published);
    stat("delivered", sum((s) => s.delivered));
    stat("handled", sum((s) => s.handled));
    stat("lost", sum((s) => s.lost));
    stat("dupes", sum((s) => s.effects - s.seen.size));
    stat("backlog", Math.max(...m.queues.map((qq) => qq.length)));
  }

  function advance(dt) { let left = dt; while (left > 1e-9) { const d = Math.min(0.02, left); step(m, d); left -= d; } }

  // ---------- controls ----------
  const pause = playPause(root);
  const clock = WB.loop({ stage, step: (dt) => { advance(dt * speed); events(); paint(); showStats(); }, onPause: pause.onPause });
  pause.bind(clock);
  clock.setPaused(clock.paused);
  function set(name, raw) {
    if (name === "subs") {
      cfg.subs = m.cfg.subs = Number(raw);
      for (let i = cfg.subs; i < STATIONS; i++) { m.queues[i].length = 0; m.stations[i].busy = null; }
    }
    if (name === "station") {
      cfg.slow = m.cfg.slow = raw === "slow";
      cfg.offline = raw === "offline";
      if (cfg.offline !== !m.stations[OFFLINE_STATION].online) setOffline(m, cfg.offline);
    }
    if (name === "durable") { cfg.durable = raw === "true" || raw === true; setDurable(m, cfg.durable); }
    if (name === "crash") cfg.crash = m.cfg.crash = Number(raw);
    if (name === "idempotent") cfg.idempotent = m.cfg.idempotent = raw === "true" || raw === true;
    if (name === "shared") {
      cfg.shared = m.cfg.shared = raw === "true" || raw === true;
      if (cfg.shared) { m.queues[0].push(...m.queues[1]); m.queues[1].length = 0; }
    }
    if (name === "direct") { cfg.direct = m.cfg.direct = raw === "true" || raw === true; if (!cfg.direct) m.call = null; }
    if (name === "speed") speed = Number(raw);
    root.press(name, raw);
  }
  function restart() { m = fresh(); drops = new Array(STATIONS).fill(null); note = null; paint(); showStats(); say(B("starting", "empezando")); }
  const DEFAULTS = { subs: 3, station: "normal", durable: "true", crash: 0, idempotent: "false", shared: "false", direct: "false" };
  root.on("change", (name, value) => set(name, value));
  const actions = { reset: restart };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------

  root.on("watch", (watch) => {
    const w = { ...DEFAULTS, ...watch };
    for (const name of ["subs", "durable", "crash", "idempotent", "shared", "direct"]) set(name, String(w[name]));
    cfg.slow = cfg.offline = false;
    restart();
    set("station", w.station);
    root.press("station", w.station);
    if (clock.paused) clock.setPaused(false);
  });

  paint(); showStats();
}

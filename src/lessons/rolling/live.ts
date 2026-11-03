// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The module yard in the browser: runs the rollout model, moves the crane, modules, flags and request tokens to
// match it, and answers the controls. mount() gets the build-time data from page.ts (geometry, the token drawing)
// and root, the <wb-lesson>.
import { iso, lineOnTop, translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { playPause } from "../../runtime/dom";
import { lerp, easeInOutCubic } from "../../lib/tween";
import { clamp, percentile } from "../../lib/stats";
import { RD, createSim } from "./sim";

export default function mount({ P, G, TOKEN_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const stat = (key, value) => root.stat(key, value);
  const still = WB.still;
  const slotEls = Array.from({ length: RD.SLOTS }, (_, i) => {
    const el = q('[data-slot="' + i + '"]');
    return {
      old: el.querySelector('[data-mod="old"]'), neu: el.querySelector('[data-mod="new"]'),
      warm: el.querySelector("[data-warm]"), anchor: el.querySelector("[data-anchor]"), flag: el.querySelector("[data-flag]"),
      pucks: Array.from({ length: G.PUCKS }, (_, j) => el.querySelector('[data-puck="' + i + "-" + j + '"]')),
      flagUp: -1, shown: "", warmD: "", puckN: -1,
    };
  });
  const craneParts = [q("[data-crane-back]"), q("[data-crane-front]"), q("[data-crane-top]"), q("[data-crane-top-front]")];
  const grabber = q("[data-grabber]"), cables = q("[data-cables]"), fly = q("[data-fly]"), flyHome = q("[data-fly-home]");
  const flyOld = q('[data-fly-mod="old"]'), flyNew = q('[data-fly-mod="new"]');
  const supply = q("[data-supply]"), binAnchor = q("[data-bin-anchor]"), tokensBox = q("[data-tokens]"), needle = q("[data-needle]");
  const GRIP = G.MODULE_TOP + G.HANDLE_H;          // grabber bottom when it holds a module in a bay
  const BIN_DROP = 4 + G.MODULE.h + G.HANDLE_H;     // grabber bottom when a module sits in the bin
  const TRANSIT = 0.5;

  const cfg = { unavail: 1, surge: 0, probe: "on", next: "good", load: "normal", speed: 1 };
  let sim, tokens, counters, grabZ, jobSeen, jobStartZ, needleAngle, auto = true, idleSince = 0;

  function newSim() {
    sim = createSim({ seed: (Date.now() % 1e6) + 1, load: cfg.load, unavail: cfg.unavail, surge: cfg.surge, probe: cfg.probe === "on", keep: 4000 });
    tokens = []; tokensBox.innerHTML = "";
    counters = { served: 0, errors: 0 };
    grabZ = G.HOIST_TOP; jobSeen = null; jobStartZ = G.HOIST_TOP; needleAngle = 0; idleSince = 0;
    flyInto(flyHome); fly.style.display = "none"; fly.style.opacity = "1";
  }

  const ease = easeInOutCubic;
  const clamp01 = (t) => clamp(t);
  const seg01 = (p, a, b) => clamp01((p - a) / (b - a));
  const faceRect = (x0, x1, y, z0, z1) => WB.faceRectY(P, x0, x1, y, z0, z1);
  function flyInto(node) { if (fly.parentNode !== node) node.appendChild(fly); }
  const isLit = (version) => version === sim.S.target && sim.S.target > 1;

  // ---------- tokens (requests in flight on the feed rail) ----------
  function launch(e) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
    el.innerHTML = TOKEN_SVG;
    tokensBox.appendChild(el);
    tokens.push({ el, bay: e.bay, fail: e.type === "fail", t0: sim.S.t });
    if (tokens.length > 40) { const old = tokens.shift(); old.el.remove(); }
  }
  function tokenPos(tk, s) {
    const [x0, y0] = G.DIST_EXIT;
    if (tk.bay === null) return [lerp(x0, -156, s), lerp(y0, 56, s), 2.4 - 1.4 * s];
    const cx = RD.slotX(tk.bay), run = Math.abs(cx - x0), drop = Math.abs(G.TOKEN_Y - G.TRAY_Y), total = run + drop, d = s * total;
    if (d <= run) return [x0 + (cx - x0) * (d / run), G.TOKEN_Y, 2.4];
    return [cx, G.TOKEN_Y - (d - run), 2.4 - 0.8 * ((d - run) / drop)];
  }
  function paintTokens() {
    const inflight = new Array(RD.SLOTS).fill(0);
    tokens = tokens.filter((tk) => {
      const age = sim.S.t - tk.t0, life = TRANSIT + (tk.fail ? 0.35 : 0);
      if (age >= life || age < 0) { tk.el.remove(); return false; }
      const s = ease(clamp01(age / TRANSIT));
      const [x, y, z] = tokenPos(tk, s);
      tk.el.setAttribute("transform", translateAlong(P, [x, y, z]));
      tk.el.style.opacity = tk.fail && age > TRANSIT ? String(1 - (age - TRANSIT) / 0.35) : "1";
      if (!tk.fail && tk.bay !== null) inflight[tk.bay]++;
      return true;
    });
    return inflight;
  }

  // ---------- the crane ----------
  function paintCrane() {
    const S = sim.S, job = S.crane.job;
    let x = S.crane.x, z = grabZ, carry = null, hideSlot = -1, hideSupply = false;
    if (job !== jobSeen) { jobSeen = job; jobStartZ = grabZ; }
    if (job) {
      const p = clamp01((S.t - job.t0) / job.dur), tx = RD.slotX(job.bay);
      if (job.type === "install") {
        x = p < 0.25 ? lerp(job.fromX, RD.SUPPLY_X, ease(seg01(p, 0, 0.25))) : p < 0.45 ? RD.SUPPLY_X : lerp(RD.SUPPLY_X, tx, ease(seg01(p, 0.45, 0.75)));
        if (p < 0.25) z = lerp(jobStartZ, G.HOIST_TOP, ease(seg01(p, 0, 0.2)));
        else if (p < 0.35) z = lerp(G.HOIST_TOP, GRIP, ease(seg01(p, 0.25, 0.35)));
        else if (p < 0.45) z = lerp(GRIP, G.HOIST_TOP, ease(seg01(p, 0.35, 0.45)));
        else if (p < 0.75) z = G.HOIST_TOP;
        else z = lerp(G.HOIST_TOP, GRIP, ease(seg01(p, 0.75, 0.95)));
        if (p >= 0.35) { carry = { version: job.version, where: p >= 0.75 ? job.bay : "top" }; hideSupply = true; }
      } else {
        x = p < 0.55 ? lerp(job.fromX, tx, ease(seg01(p, 0, 0.3))) : lerp(tx, RD.BIN_X, ease(seg01(p, 0.55, 0.85)));
        if (p < 0.3) z = lerp(jobStartZ, G.HOIST_TOP, ease(seg01(p, 0, 0.25)));
        else if (p < 0.42) z = lerp(G.HOIST_TOP, GRIP, ease(seg01(p, 0.3, 0.42)));
        else if (p < 0.55) z = lerp(GRIP, G.HOIST_TOP, ease(seg01(p, 0.42, 0.55)));
        else if (p < 0.85) z = G.HOIST_TOP;
        else z = lerp(G.HOIST_TOP, BIN_DROP, ease(seg01(p, 0.85, 1)));
        if (p >= 0.42) { hideSlot = job.bay; carry = { version: job.version, where: p < 0.5 ? job.bay : p >= 0.85 ? "bin" : "top", fade: p >= 0.9 ? 1 - (p - 0.9) / 0.1 : 1 }; }
      }
    } else {
      z = lerp(grabZ, G.HOIST_TOP, 0.08); // idle: the hoist winds back up
    }
    grabZ = z;
    const tr = translateAlong(P, [x, 0, 0]);
    craneParts.forEach((el) => el.setAttribute("transform", tr));
    grabber.setAttribute("transform", translateAlong(P, [x, 0, z]));
    cables.setAttribute("d", CABLE_Y_PATH(x, z));
    supply.style.display = hideSupply ? "none" : "";
    if (carry) {
      flyInto(carry.where === "top" ? flyHome : carry.where === "bin" ? binAnchor : slotEls[carry.where].anchor);
      fly.style.display = "";
      fly.style.opacity = String(carry.fade === undefined ? 1 : Math.max(0, carry.fade));
      const lit = isLit(carry.version);
      flyNew.style.display = lit ? "" : "none"; flyOld.style.display = lit ? "none" : "";
      fly.setAttribute("transform", translateAlong(P, [x, 0, z - G.MODULE.h - G.HANDLE_H]));
    } else if (fly.style.display !== "none") { fly.style.display = "none"; flyInto(flyHome); }
    return hideSlot;
  }
  const CABLE_Y_PATH = (x, z) => [G.ROW_Y - 2, G.ROW_Y + 2].map((y) => { const a = iso([x, y, G.TROLLEY_Z], P), b = iso([x, y, z + 3], P); return "M" + a[0].toFixed(1) + " " + a[1].toFixed(1) + "L" + b[0].toFixed(1) + " " + b[1].toFixed(1); }).join("");

  // ---------- bays ----------
  function paintBays(inflight, hideSlot, dt) {
    const S = sim.S;
    S.bays.forEach((b, i) => {
      const el = slotEls[i];
      const show = b.module && i !== hideSlot ? (isLit(b.module.version) ? "new" : "old") : "";
      if (show !== el.shown) { el.neu.style.display = show === "new" ? "" : "none"; el.old.style.display = show === "old" ? "" : "none"; el.shown = show; }
      let d = "";
      if (show) {
        const share = clamp01((S.t - b.module.installedAt) / RD.WARM), cx = RD.slotX(i), W = G.WARM_STRIP;
        if (share > 0.02) d = faceRect(cx + W.x0, cx + W.x0 + (W.x1 - W.x0) * share, W.y, W.z0, W.z1);
      }
      if (d !== el.warmD) { el.warm.setAttribute("d", d); el.warmD = d; }
      const want = sim.ready(b) ? 1 : 0;
      const from = el.flagUp < 0 ? want : el.flagUp;
      const next = still.matches ? want : from + (want - from) * (1 - Math.exp(-dt / 0.12));
      if (next !== el.flagUp) { el.flagUp = Math.abs(next - want) < 0.002 ? want : next; el.flag.setAttribute("transform", translateAlong(P, [0, 0, G.FLAG_RISE * el.flagUp])); }
      const n = Math.max(0, Math.min(G.PUCKS, b.queue.length - inflight[i]));
      if (n !== el.puckN) { el.pucks.forEach((pk, j) => (pk.style.display = j < n ? "" : "none")); el.puckN = n; }
    });
  }

  // ---------- readout and stats ----------
  function describe() {
    const S = sim.S, r = S.rollout;
    const mods = S.bays.filter((b) => b.module);
    const fresh = mods.filter((b) => b.module.version === S.target).length;
    const readyN = S.bays.filter((b) => sim.ready(b)).length;
    if (!r || r.end !== null) return L("v" + S.target + " on " + mods.length + " bays · " + readyN + " flags up", "v" + S.target + " en " + mods.length + " bahías · " + readyN + " banderas arriba");
    const stuck = S.bays.find((b) => b.module && b.module.version === S.target && b.module.bad && S.t > b.module.warmAt + 1);
    if (stuck && sim.S.cfg.probe) { const oldN = S.bays.filter((b) => b.module && b.module.version !== S.target && sim.ready(b)).length; return L("v" + S.target + " stuck · bay " + (stuck.i + 1) + " never ready · " + oldN + " old bays serving", "v" + S.target + " atascada · bahía " + (stuck.i + 1) + " nunca lista · " + oldN + " bahías viejas atendiendo"); }
    const job = S.crane.job;
    const doing = job ? (job.type === "install" ? T(" · installing bay " + (job.bay + 1), " · instalando bahía " + (job.bay + 1)) : T(" · pulling bay " + (job.bay + 1), " · sacando bahía " + (job.bay + 1))) : S.bays.some((b) => b.module && b.module.version === S.target && S.t < b.module.warmAt) ? T(" · waiting for warm-up", " · esperando el calentamiento") : T("", "");
    return L("v" + S.target + " rolling · " + fresh + " of 6 new" + doing.en, "v" + S.target + " desplegando · " + fresh + " de 6 nuevas" + doing.es);
  }
  function showStats() {
    const S = sim.S;
    const mods = S.bays.filter((b) => b.module);
    const fresh = mods.filter((b) => isLit(b.module.version)).length;
    stat("mix", fresh + " / " + (mods.length - fresh));
    stat("ready", S.bays.filter((b) => sim.ready(b)).length);
    stat("served", counters.served);
    stat("errors", counters.errors);
    const recent = S.records.filter((r) => r.latency !== undefined).slice(-200).map((r) => r.latency);
    stat("p95", recent.length >= 10 ? percentile(recent, 0.95).toFixed(1) + " s" : "–");
    const r = S.rollout;
    stat("time", r ? ((r.end !== null ? r.end : S.t) - r.start).toFixed(0) + " s" + (r.end === null ? "…" : "") : "–");
  }

  let statTimer = 0;
  function frameStep(dtReal) {
    const dt = dtReal * cfg.speed;
    sim.step(dt);
    for (const e of sim.S.events) {
      if (e.type === "route" || e.type === "fail") { launch(e); if (e.bay !== null) needleAngle = -1.2 + 0.32 * e.bay; }
      if (e.type === "done") counters.served++;
      if (e.type === "fail") counters.errors++;
    }
    sim.S.events.length = 0;
    const inflight = paintTokens();
    const hide = paintCrane();
    paintBays(inflight, hide, dt);
    needle.setAttribute("d", lineOnTop([-152, 32], [-152 + Math.sin(needleAngle) * 6, 32 - Math.cos(needleAngle) * 6], 17.2, P));
    say(describe());
    statTimer += dtReal;
    if (statTimer > 0.2) { statTimer = 0; showStats(); }
    const r = sim.S.rollout;
    if (auto) {
      if (!r) { idleSince += dt; if (idleSince > 2) { sim.startRollout("good"); idleSince = 0; } }
      else if (r.end !== null) { idleSince += dt; if (idleSince > 8) { sim.startRollout("good"); idleSince = 0; } }
    }
  }

  // ---------- controls ----------
  const pause = playPause(root);
  const clock = WB.loop({ stage, step: frameStep, onPause: pause.onPause });
  pause.bind(clock);
  function set(name, raw) {
    if (name === "unavail" || name === "surge" || name === "speed") cfg[name] = Number(raw); else cfg[name] = raw;
    if (cfg.unavail === 0 && cfg.surge === 0) { cfg.surge = 1; root.press("surge", 1); }
    sim.S.cfg.unavail = cfg.unavail; sim.S.cfg.surge = cfg.surge; sim.S.cfg.probe = cfg.probe === "on"; sim.S.cfg.load = cfg.load;
    root.press(name, raw);
  }
  function startRollout() {
    auto = false;
    if (!sim.startRollout(cfg.next)) say(L("a rollout is already running · reset to start over", "ya hay un despliegue en curso · reinicia para empezar de nuevo"));
    if (clock.paused) clock.setPaused(false);
  }
  function reset() { auto = false; newSim(); paintAll(); showStats(); }
  root.on("change", (name, value) => { if (name !== "speed") auto = false; set(name, value); });
  const actions = { rollout: startRollout, reset };
  root.on("action", (name) => actions[name]?.());
  function paintAll() { const inflight = paintTokens(); const hide = paintCrane(); paintBays(inflight, hide, 1); say(describe()); }

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    auto = false;
    ["unavail", "surge", "probe", "next", "load"].forEach((n) => { cfg[n] = n === "unavail" || n === "surge" ? Number(w[n]) : w[n]; root.press(n, w[n]); });
    newSim(); paintAll(); showStats();
    if (clock.paused) clock.setPaused(false);
    setTimeout(() => { sim.startRollout(cfg.next); }, 1500);
  });

  newSim();
  clock.setPaused(clock.paused);
  paintAll(); showStats();
}

// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The race track in the browser: slides each lane's finish post to its step count, runs the carriages along the
// log-scale track and answers the controls. mount() gets the build-time data from page.ts (geometry, the step counts
// per n) and root, the <wb-lesson>.
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { playPause, setText } from "../../runtime/dom";
import { int } from "../../lib/format";
import { compact } from "./sim";

export default function mount({ P, TRACK, DECADES, LANE_LABEL, STEPS, FIRST_CLOCK }, root) {
  const KEYS = ["1", "log", "n", "nlog", "n2"];

  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const xOf = (steps) => TRACK.x0 + (Math.log10(Math.max(1, steps)) / DECADES) * (TRACK.x1 - TRACK.x0);
  const stat = (key, value) => root.stat(key, value);
  // Seconds as a short duration. Units are the same in both languages except days.
  const dur = (s) => {
    const f = (v) => (v < 10 ? v.toFixed(1).replace(/\.0$/, "") : Math.round(v).toLocaleString("en"));
    if (s < 1e-6) return f(s * 1e9) + " ns";
    if (s < 1e-3) return f(s * 1e6) + " µs";
    if (s < 1) return f(s * 1e3) + " ms";
    if (s < 120) return f(s) + " s";
    if (s < 7200) return f(s / 60) + " min";
    if (s < 172800) return f(s / 3600) + " h";
    return L(f(s / 86400) + " days", f(s / 86400) + " días");
  };

  const cars = [0, 1, 2, 3, 4].map((i) => ({ g: q('[data-car="' + i + '"]'), label: q('[data-car-text="' + i + '"]') }));
  const posts = [0, 1, 2, 3, 4].map((i) => q('[data-post="' + i + '"]'));
  const nlogSign = q("[data-nlog-sign]");
  const nText = q("[data-n-text]"), costText = q("[data-cost-text]");
  const clock = WB.dial(svg, "clock", P);
  const COST_LABEL = { "1e-9": "1 ns", "1e-7": "100 ns", "1e-3": "1 ms" };

  const cfg = { n: 1000, cost: "1e-9", constant: 1, speed: 1 };
  const RATE = 1.1;          // decades of the clock per second at speed ×1
  const HOLD = 2.6;          // seconds to show the finished race before it starts again
  let race, loop;
  const steps = () => KEYS.map((k, i) => STEPS[cfg.n][k] * (i === 3 ? cfg.constant : 1));
  function restart(atClock = 1) {
    const s = steps();
    race = { steps: s, logT: Math.log10(atClock), end: Math.log10(Math.max(...s)), hold: 0, msg: null };
    posts.forEach((p, i) => p.setAttribute("transform", translateAlong(P, [xOf(s[i]), 0, 0])));
    setText(nlogSign, LANE_LABEL[3] + (cfg.constant === 1 ? "" : " ×" + cfg.constant));
    setText(nText, "n = " + int(cfg.n));
    setText(costText, COST_LABEL[cfg.cost]);
    const c = Number(cfg.cost);
    stat("tn", dur(s[2] * c)); stat("tnlog", dur(s[3] * c)); stat("tn2", dur(s[4] * c));
    const r = s[4] / s[3];
    stat("vs", "×" + (r >= 10 ? int(r) : r >= 0.1 ? r.toFixed(1) : r.toFixed(2)));
    paint();
  }
  function paint() {
    const tNow = 10 ** Math.min(race.logT, race.end);
    race.steps.forEach((s, i) => {
      const done = Math.min(tNow, s);
      cars[i].g.setAttribute("transform", translateAlong(P, [xOf(done), 0, 0]));
      setText(cars[i].label, compact(Math.floor(done)));
      const running = tNow < s;
      cars[i].g.querySelectorAll(".iso-solid").forEach((el) => el.toggleAttribute("data-lit", running));
    });
    clock.set(Math.min(1, Math.log10(tNow) / DECADES));
    stat("clock", int(Math.floor(tNow)));
    stat("clockTime", dur(Math.floor(tNow) * Number(cfg.cost)));
    // Narrate the slowest lane still running, or the result once every lane is done.
    const running = race.steps.map((s, i) => [s, i]).filter(([s]) => s > tNow);
    if (running.length) {
      const [s, i] = running.reduce((a, b) => (b[0] > a[0] ? b : a));
      const left = running.length;
      race.msg = T(LANE_LABEL[i] + " running · " + compact(Math.floor(tNow)) + " of " + compact(s) + " steps · " + (5 - left) + " of 5 lanes done",
        LANE_LABEL[i] + " en carrera · " + compact(Math.floor(tNow)) + " de " + compact(s) + " pasos · " + (5 - left) + " de 5 carriles listos");
    } else {
      const slow = race.steps.indexOf(Math.max(...race.steps));
      race.msg = T("all lanes done · slowest " + LANE_LABEL[slow] + ", " + int(race.steps[slow]) + " steps = " + dur(race.steps[slow] * Number(cfg.cost)),
        "todos los carriles listos · el más lento, " + LANE_LABEL[slow] + ", " + int(race.steps[slow]) + " pasos = " + dur(race.steps[slow] * Number(cfg.cost)));
    }
    if (!loop || !loop.paused) say(L(race.msg));
  }
  function step(dt) {
    if (race.logT >= race.end) {
      race.hold += dt;
      if (race.hold > HOLD) restart();
      return;
    }
    race.logT = Math.min(race.end, race.logT + dt * RATE);
    paint();
  }

  const pause = playPause(root);
  loop = WB.loop({ stage, step: (dt) => step(dt * cfg.speed), onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    if (name === "n") cfg.n = Number(raw);
    if (name === "constant") cfg.constant = Number(raw);
    if (name === "cost") { cfg.cost = raw; const keep = race.logT; restart(10 ** keep); race.logT = keep; paint(); return; }
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));
  const actions = { reset: () => { restart(); if (loop.paused) loop.setPaused(false); } };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    set("n", String(w.n), true); set("constant", String(w.constant), true);
    restart();
    if (loop.paused) loop.setPaused(false);
  });

  loop.setPaused(loop.paused);
  restart(FIRST_CLOCK);
}

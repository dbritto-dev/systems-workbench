// Systems lesson 09 · Blue-green deploys. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, P, GEOMETRY, gateArm, POOL } from "./figure.mjs";
import { EXP } from "./sim.js";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// Numbers quoted in the page text come from the model at build time.
const R = { rollback: EXP.rollback(), cost: EXP.cost(), cold: EXP.cold(), drain: EXP.drain(), migration: EXP.migration() };
const s0 = (x) => Math.round(x) + " s";

const EXPERIMENTS = [
  {
    id: "rollback",
    title: "Roll back a bad release",
    change: "Green ships with a bug that fails 40% of requests · the alarm fires 15 s after the flip",
    question: "You roll back by flipping the gate back to blue. How long until errors stop, compared with redeploying the old version server by server (one minute each)?",
    options: ["About the same: either way the old code has to come back", "Seconds after the rollback, against minutes for the redeploy", "Longer: flipping back drops everything in flight"],
    answer: 1,
    why: "Blue never went away. It is still running the old version, with a warm cache, so flipping back is just a change of route. A rolling redeploy has to rebuild each server, and every minute it takes, the servers still on the bad version keep failing requests.",
    watch: { release: "bad", warm: "on", draining: "on", migration: "compatible", script: [[3, "flip"], [18, "flip"]] },
  },
  {
    id: "cost",
    title: "What it costs",
    change: "A normal deploy · blue is kept running after the flip so you can roll back",
    question: "What do you pay for that instant rollback while the deploy is in progress?",
    options: ["Nothing: the idle side costs nothing until it takes traffic", "About one extra server, like a rolling deploy", "A whole second copy of production, doing no work"],
    answer: 2,
    why: "Both sides are full production: same number of servers, same connections to the database. While one is live the other does nothing but wait. That is the price of being able to flip back instantly. Rolling deploys only add one spare server at a time, and pay for it with slow rollbacks.",
    watch: { release: "good", warm: "on", draining: "on", migration: "compatible", script: [[3, "flip"]] },
  },
  {
    id: "cold",
    title: "A cold green",
    change: "Green starts with an empty cache · you flip as soon as it is up",
    question: "Right after the flip, what happens to latency?",
    options: ["Nothing: green runs the same code paths", "It spikes for a while as green fills its cache, and some requests are turned away", "It drops: a fresh process is faster"],
    answer: 1,
    why: "Every request misses on a cold cache, misses take four times longer, and three workers can't keep up with the traffic until the cache fills. The queue fills, and once it is full new requests are turned away. Warming green first (replaying traffic, or preloading the hot keys) makes the flip a non-event.",
    watch: { release: "good", warm: "off", draining: "on", migration: "compatible", script: [[3, "flip"]] },
  },
  {
    id: "drain",
    title: "Flip without draining",
    change: "Draining off · blue stops the moment the gate flips",
    question: "What happens to the requests already on blue's lane, in its queue or under its presses?",
    options: ["They finish on blue anyway", "They move over to green", "They fail"],
    answer: 2,
    why: "Those requests were already routed. If blue stops at the flip, they are cut off and their clients get errors. With connection draining, blue takes no new requests but finishes the ones it has, so the switch drops nothing.",
    watch: { release: "good", warm: "on", draining: "off", migration: "compatible", script: [[3, "flip"]] },
  },
  {
    id: "migration",
    title: "A migration blue can't read",
    change: "Green's migration drops a column blue still reads · then green turns out to be bad",
    question: "You flip back to blue. What happens?",
    options: ["Rollback works: blue is untouched", "Blue fails almost every request", "Only requests for new records fail"],
    answer: 1,
    why: "The database is shared. Green's migration changed it for both sides, so the rollback brings back code that no longer matches the schema. Blue-green only rolls back code. Migrations have to work for both versions: add the new column first (expand), switch the code, and drop the old one only after blue is gone for good (contract).",
    watch: { release: "bad", warm: "on", draining: "on", migration: "breaking", script: [[3, "flip"], [18, "flip"]] },
  },
];

const QUESTIONS = [
  ["Why is rolling back a blue-green deploy so much faster than rolling back a rolling deploy?",
    "Blue is still running the old version, warm, so rollback is only a change of route at the gate. A rolling rollback has to rebuild servers one by one, and the bad version keeps serving traffic until the last one is replaced."],
  ["Your manager asks why the deploy doubles the cloud bill for an hour. How do you explain it, and when is it worth it?",
    "Both sides are full production while the old one is kept for rollback, and the idle one does no work. It is worth it when a bad release is expensive and you need to undo it in seconds; for small, low-risk services, a rolling or canary deploy may be the better trade."],
  ["What would you do before flipping to a freshly deployed green, and why?",
    "Warm it: let its caches fill, open its connection pools, run smoke tests against it. Otherwise the first minute after the flip runs on cold caches with slow misses, latency spikes and requests may be turned away."],
  ["What is connection draining, and what goes wrong without it?",
    "The old side stops taking new requests but finishes the ones it already has before shutting down. Without it, requests that were routed just before the flip are cut off and fail."],
  ["Green needs to rename a column. How do you ship that with blue-green and still be able to roll back?",
    "Expand and contract: add the new column and write both, deploy green reading the new one, keep the old column until blue is gone and rollback is no longer needed, then drop it in a later deploy."],
  ["Blue-green flips all traffic at once. What risk does that leave that a canary deploy reduces?",
    "Every user hits the new version at the same moment, so a bug that only shows under real traffic affects everyone until the rollback. A canary sends a small share first, so only a few users see the bug."],
];

const figure = figurePlate({
  title: "Two press lines",
  keys: [
    { mark: "lit", label: "Green line and its requests: the new version" },
    { mark: "raised", label: "Blue line: the version in production" },
    { mark: "flat", label: "Records cabinet: the shared database" },
  ],
  caption: "Requests ride the infeed to the gate. The gate's arm points at the live line, and every request that reaches it goes there. Each line has its own cache tray (the cards are how full it is), three presses, an outfeed tray for served requests and a reject bin for errors. Both lines read and write the same records cabinet.",
  stage: 'data-office aria-label="Blue-green deploy simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const controls = panel({
  stats: [["served", "Served"], ["errors", "Errors"], ["p95", "p95 latency", "–"], ["recover", "Time to recover", "–"], ["running", "Servers running", "6"]],
  controls: [
    seg("release", "Green release", [["good", "Good"], ["bad", "Bad"]], "good"),
    seg("warm", "Warm green first", [["on", "On"], ["off", "Off"]], "on"),
    seg("draining", "Connection draining", [["on", "On"], ["off", "Off"]], "on"),
    seg("migration", "Green's migration", [["compatible", "Compatible"], ["breaking", "Breaking"]], "compatible"),
    speedSeg(),
    // Built by hand: the flip button is the primary action.
    `<div class="control"><span>Do something</span><div class="actions">
      <button class="btn primary" type="button" data-act="flip">Flip to green</button>
      <button class="btn" type="button" data-act="redeploy">Redeploy green</button>
      <button class="btn" type="button" data-act="reset">Start over</button>
      <button class="btn" type="button" data-act="pause">Pause</button>
    </div></div>`,
  ],
});

// Five stats instead of six; the item pool is hidden until placed.
const css = `
.stats{grid-template-columns:repeat(5,1fr)}
@media (max-width:640px){.stats{grid-template-columns:repeat(2,1fr)}.stat{border-bottom:1px solid var(--anatomy-faint)}.stat:nth-child(3){border-right:1px solid var(--anatomy-faint)}.stat:nth-child(2n){border-right:0}}
[data-pool]{display:none}
`;

const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const POOL = ${POOL};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const RESULTS = ${JSON.stringify(R)};
const gateArm = ${gateArm.toString().replace(/k\./g, "").replace(/\bS\(/g, "solidSvg(").replace(/GATE_R/g, "15").replace(/BELT_Z/g, "G.BELT_Z").replace(/\bGATE\b/g, "G.GATE")};

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const layers = { blue: q('[data-layer="blue"]'), green: q('[data-layer="green"]'), mid: q('[data-layer="mid"]') };
const items = [...svg.querySelectorAll("[data-item]")];
const heads = { blue: [0, 1, 2].map((i) => q('[data-head="blue-' + i + '"]')), green: [0, 1, 2].map((i) => q('[data-head="green-' + i + '"]')) };
const cards = { blue: [...q('[data-cache="blue"]').children], green: [...q('[data-cache="green"]').children] };
const lamps = { blue: q('[data-lamp="blue"] .iso-solid'), green: q('[data-lamp="green"] .iso-solid') };
const armEl = q("[data-arm]"), schemaEl = q("[data-schema]");
const settings = { release: "good", warm: "on", draining: "on", migration: "compatible" };
let speed = 1;
let w, vis, slotOf, free, script, armAngle, latencies, incident, lastErrors, note;

const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };

function start() {
  w = createWorld({ seed: (Date.now() % 1e6) + 1, release: settings.release, warm: settings.warm === "on", draining: settings.draining === "on", migration: settings.migration });
  vis = new Map(); slotOf = new Map(); free = items.map((_, i) => i).reverse(); script = [];
  armAngle = G.LANE_ANGLE.blue; latencies = []; incident = null; lastErrors = 0; note = null;
  items.forEach((el) => { el.style.display = "none"; });
  armEl.innerHTML = gateArm(armAngle, false);
  updateFlipButton(); paint(0);
}

function targetOf(job) {
  const o = w.o, t = w.t;
  if (job.stage === "infeed") return [lerp(G.INFEED.from, G.GATE[0], clamp01((t - job.born) / o.infeed)), 0, G.BELT_Z];
  const ys = G.LINES[job.side];
  if (job.stage === "lane") return lerp3([G.GATE[0], G.GATE[1], G.BELT_Z], [G.LANE_END_X + 2, ys, G.BELT_Z], clamp01((t - job.gateAt) / o.lane));
  if (job.stage === "queue") {
    const i = w.sides[job.side].queue.indexOf(job);
    return i < G.QUEUE.shown ? [G.QUEUE.x0 - i * G.QUEUE.gap, ys, G.BELT_Z] : null;
  }
  if (job.stage === "service") return [G.STATIONS[job.worker], ys, G.BELT_Z];
  return null;
}

// Where a finished request goes: served to the outfeed tray, errors into the reject bin.
function exitOf(job, from, age) {
  const ys = G.LINES[job.side] || 0;
  if (job.outcome === "ok") { const f = clamp01(age / 0.5); return { p: lerp3(from, [G.OUTFEED.x, ys, G.BELT_Z + 3], ease(f)), alpha: age < 0.5 ? 1 : 1 - clamp01((age - 0.5) / 0.3) }; }
  const bin = [G.BIN.x, ys + G.BIN.dy, G.BELT_Z + 9], inBin = [G.BIN.x, ys + G.BIN.dy, G.BELT_Z + 1];
  if (age < 0.45) { const f = ease(clamp01(age / 0.45)); return { p: [lerp(from[0], bin[0], f), lerp(from[1], bin[1], f), lerp(from[2], bin[2], f) + 6 * Math.sin(Math.PI * f)], alpha: 1 }; }
  return { p: lerp3(bin, inBin, clamp01((age - 0.45) / 0.2)), alpha: 1 - clamp01((age - 0.65) / 0.25) };
}

function paint(realDt) {
  const t = w.t, follow = 1 - Math.exp(-realDt * Math.max(1, speed) / 0.1);
  const shown = new Set();
  const place = (job, p, alpha) => {
    let slot = slotOf.get(job.id);
    if (slot === undefined) { if (!free.length) return; slot = free.pop(); slotOf.set(job.id, slot); }
    shown.add(job.id);
    const el = items[slot];
    const layer = job.side ? layers[job.side] : layers.mid;
    if (el.parentNode !== layer) layer.appendChild(el);
    el.style.display = "";
    el.style.opacity = alpha < 1 ? String(Math.max(0, alpha)) : "";
    el.setAttribute("transform", translateAlong(P, p));
    el.firstElementChild.toggleAttribute("data-lit", job.side === "green");
  };
  for (const job of w.active) {
    const target = targetOf(job);
    let v = vis.get(job.id);
    if (!target) { if (v) v.hidden = true; continue; }
    if (!v || job.stage === "infeed" || job.stage === "lane") { v = { p: target }; vis.set(job.id, v); }
    else v.p = lerp3(v.p, target, follow);
    v.hidden = false;
    place(job, v.p, 1);
  }
  for (let i = w.log.length - 1; i >= 0; i--) {
    const job = w.log[i];
    const age = t - job.doneAt;
    if (age > 0.9) break;
    const v = vis.get(job.id);
    const from = v ? v.p : [G.LANE_END_X + 2, G.LINES[job.side] || 0, G.BELT_Z];
    if (!v) vis.set(job.id, { p: from });
    if (!job.exitFrom) job.exitFrom = from;
    if (job.outcome === "turned") { place(job, job.exitFrom, 1 - clamp01(age / 0.6)); continue; }
    const e = exitOf(job, job.exitFrom, age);
    place(job, e.p, e.alpha);
  }
  for (const [id, slot] of slotOf) if (!shown.has(id)) { items[slot].style.display = "none"; slotOf.delete(id); free.push(slot); vis.delete(id); }
  for (const name of ["blue", "green"]) {
    const side = w.sides[name];
    side.workers.forEach((worker, i) => {
      const job = worker.job;
      const f = job ? clamp01((t - job.startAt) / (job.endAt - job.startAt)) : 0;
      const dz = job ? (G.HEAD.press - G.HEAD.rest) * Math.sin(Math.PI * f) : 0;
      heads[name][i].setAttribute("transform", dz ? translateAlong(P, [0, 0, dz]) : "");
    });
    const n = Math.round(side.fill * 10);
    cards[name].forEach((card, i) => { card.style.display = i < n ? "" : "none"; });
    lamps[name].toggleAttribute("data-lit", w.live === name);
  }
  const target = G.LANE_ANGLE[w.live];
  if (Math.abs(target - armAngle) > 0.002) {
    armAngle = lerp(armAngle, target, 1 - Math.exp(-realDt * Math.max(1, speed) / 0.12));
    if (Math.abs(target - armAngle) < 0.002) armAngle = target;
    armEl.innerHTML = gateArm(armAngle, w.live === "green");
  }
  schemaEl.textContent = "SCHEMA v" + w.schema;
  showStats();
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
let seenLog = 0;
function showStats() {
  for (; seenLog < w.log.length; seenLog++) { const j = w.log[seenLog]; if (j.outcome === "ok") { latencies.push(j.doneAt - j.born); if (latencies.length > 300) latencies.shift(); } }
  const errors = w.stats.error + w.stats.dropped + w.stats.turned;
  if (errors > lastErrors) {
    if (!incident || w.t - incident.last > 10) incident = { start: w.t, last: w.t };
    incident.last = w.t; lastErrors = errors;
  }
  statEls.served.textContent = w.stats.ok;
  statEls.errors.textContent = errors;
  statEls.p95.textContent = latencies.length ? p95(latencies).toFixed(1) + " s" : "–";
  statEls.recover.textContent = !incident ? "–" : w.t - incident.last < 10 ? "ongoing" : Math.max(1, Math.round(incident.last - incident.start)) + " s";
  const busy = w.sides.blue.workers.filter((x) => x.job).length + w.sides.green.workers.filter((x) => x.job).length;
  statEls.running.textContent = "6 · " + busy + " busy";
  if (note && w.t < note.until) say(note.text);
  else {
    const side = w.sides[w.live];
    say(w.live + " live · queue " + side.queue.length + " · " + busy + " of 6 presses busy");
  }
}
function tell(text) { note = { text, until: w.t + 3 }; say(text); }

function doFlip() {
  const from = w.live;
  const migrating = w.live === "blue" && w.schema === 1;
  const to = flip(w);
  let text = "flipped to " + to;
  if (migrating) text += " · migration ran, schema v2";
  text += w.o.draining ? " · " + from + " draining" : " · " + from + " cut off";
  tell(text);
  updateFlipButton();
}
const flipBtn = document.querySelector('[data-act="flip"]'), redeployBtn = document.querySelector('[data-act="redeploy"]');
function updateFlipButton() { flipBtn.textContent = "Flip to " + (w.live === "blue" ? "green" : "blue"); redeployBtn.disabled = w.live === "green"; }

function advance(dt) {
  let left = dt;
  while (left > 1e-9) {
    const d = Math.min(0.02, left); left -= d;
    step(w, d);
    while (script.length && w.t >= script[0][0]) { const [, act] = script.shift(); if (act === "flip") doFlip(); }
  }
  if (w.log.length > 4000) { const cut = w.log.length - 2000; w.log.splice(0, cut); seenLog = Math.max(0, seenLog - cut); }
}

const pauseBtn = document.querySelector('[data-act="pause"]');
const clock = WB.loop({ stage, step: (dt) => { advance(dt * speed); paint(dt); }, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });
const pressSeg = WB.pressSeg;
function set(name, value) {
  if (name === "speed") speed = Number(value);
  else {
    settings[name] = value;
    if (name === "release") w.o.release = value;
    if (name === "draining") w.o.draining = value === "on";
    if (name === "migration") w.o.migration = value;
    if (name === "warm") { w.o.warm = value === "on"; if (prepareGreen(w)) tell("green redeployed · cache " + (w.o.warm ? "warmed" : "empty")); }
  }
  pressSeg(name, value);
}
WB.onSegments(set);
flipBtn.addEventListener("click", () => { doFlip(); if (clock.paused) clock.setPaused(false); });
redeployBtn.addEventListener("click", () => { if (prepareGreen(w)) tell("green redeployed · cache " + (w.o.warm ? "warmed" : "empty")); });
document.querySelector('[data-act="reset"]').addEventListener("click", () => { start(); seenLog = 0; tell("started over · blue live"); });
pauseBtn.addEventListener("click", () => clock.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); clock.toggle(); } });

// ---------- experiments ----------
const pct = (x) => Math.round(100 * x) + "%";
const secs = (x) => x.toFixed(1) + " s";
const RUNS = {
  rollback: () => { const r = RESULTS.rollback, top = r.rolling * 1.05; return { verdict: "Errors stopped " + Math.round(r.flip) + " s after the bad flip with blue-green (15 s of it waiting for the alarm), against " + Math.round(r.rolling) + " s with a rolling redeploy. Failed requests: " + Math.round(r.flipErrors) + " against " + Math.round(r.rollingErrors) + ".", bars: [["Flip back", r.flip / top, Math.round(r.flip) + " s", true], ["Rolling redeploy", r.rolling / top, Math.round(r.rolling) + " s"]] }; },
  cost: () => { const r = RESULTS.cost, top = r.blueGreenServers; return { verdict: "Blue-green runs " + r.blueGreenServers + " servers to serve the work of " + r.normal + "; a rolling deploy runs " + r.rollingServers + ". After the flip, the idle side was busy " + pct(r.idleBusy) + " of the time, the live side " + pct(r.liveBusy) + ".", bars: [["Normal", r.normal / top, String(r.normal)], ["Rolling", r.rollingServers / top, String(r.rollingServers)], ["Blue-green", r.blueGreenServers / top, String(r.blueGreenServers), true]] }; },
  cold: () => { const r = RESULTS.cold, top = Math.max(r.cold.p95, r.warm.p95) * 1.1; return { verdict: "In the 30 s after the flip, p95 latency was " + secs(r.warm.p95) + " with a warm green and " + secs(r.cold.p95) + " with a cold one, and the cold flip turned away about " + Math.round(r.cold.turned) + " requests (warm: " + Math.round(r.warm.turned) + ").", bars: [["Before the flip", r.warm.before / top, secs(r.warm.before)], ["Warm green", r.warm.p95 / top, secs(r.warm.p95)], ["Cold green", r.cold.p95 / top, secs(r.cold.p95), true]] }; },
  drain: () => { const r = RESULTS.drain, top = Math.max(r.off, 1) * 1.1; return { verdict: "Without draining, about " + r.off.toFixed(1) + " requests failed at each flip. With draining: " + Math.round(r.on) + ".", bars: [["Draining off", r.off / top, r.off.toFixed(1), true], ["Draining on", r.on / top, String(Math.round(r.on))]] }; },
  migration: () => { const r = RESULTS.migration; return { verdict: "After the rollback, blue failed " + pct(r.breaking) + " of requests with the breaking migration, and " + pct(r.compatible) + " with a compatible one.", bars: [["Breaking", r.breaking, pct(r.breaking), true], ["Compatible", r.compatible, pct(r.compatible)]] }; },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const wt = exp.watch;
  for (const name of ["release", "warm", "draining", "migration"]) { settings[name] = wt[name]; pressSeg(name, wt[name]); }
  start(); seenLog = 0;
  script = wt.script.map(([at, act]) => [w.t + at, act]);
  tell("watching: " + document.querySelector('[data-exp="' + exp.id + '"] h3').textContent.replace(/^\\d+\\. /, ""));
  if (clock.paused) clock.setPaused(false);
} });

start();
clock.setPaused(clock.paused);
`;


const size = writePage(new URL("./blue-green-workbench.html", import.meta.url), {
  title: "Blue-Green Workbench",
  eyebrow: "Systems lesson 09 · Blue-green deploys",
  lede: "Run two complete copies of production. Deploy the new version to the idle one, then move all traffic over with one switch, and keep the old one ready to switch back. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
  machine: { intro: "The back line is blue, the version in production. The front line is green, the new version, already deployed and waiting. Flip the gate and watch where the requests go, then try a bad release, a cold cache, or no draining.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the figure, averaged over six runs: requests arrive at 5 per second, and each line has three presses.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote blue-green-workbench.html", (size / 1024).toFixed(0) + " KB");
console.log(JSON.stringify(R, (key, v) => (typeof v === "number" ? +v.toFixed(2) : v)));

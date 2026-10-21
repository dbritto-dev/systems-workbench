// Systems lesson 10 · Rolling deploys. Built on the shared workbench layer (../../workbench).
import * as k from "../../workbench/kit.mjs";
import { writePage, figurePlate, panel, seg, speedSeg, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, P, GEOMETRY, needleOf } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// Figure-specific styles: warm-up strip, the darker old modules, and headed groups of result bars.
const css = `
.warm-fill{fill:var(--anatomy-mid);stroke:none}
.mod-old .iso-top{fill:var(--anatomy-shade-1)}
.mod-old .iso-fill{fill:var(--anatomy-shade-2)}
.mod-old .iso-edge{stroke:var(--anatomy-mid)}
.bar-group{font-family:var(--anatomy-mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--anatomy-muted);margin-top:6px}
.bar-group:first-child{margin-top:0}
`;

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "unavail",
    title: "Take more bays out at once",
    change: "maxUnavailable 1 → 3 · busy traffic (2 requests/s, six bays serve 3/s)",
    question: "Half the bays may now be out at the same time. What happens?",
    options: ["Nothing users notice: the other bays absorb it", "It finishes about twice as fast, but waits jump while half the bays are out", "It finishes about six times as fast, with no other effect"],
    answer: 1,
    why: "maxUnavailable is how much capacity the rollout may take away. Three bays out leaves 1.5 requests/s of capacity for 2 requests/s of traffic, so queues grow until new bays come up. The rollout is faster because three modules warm up at the same time, but warm-up still sets the pace, so it is not three times faster.",
    watch: { load: "high", unavail: 3, surge: 0, probe: "on", next: "good" },
  },
  {
    id: "surge",
    title: "Add before you remove",
    change: "maxUnavailable 1, maxSurge 0 → maxUnavailable 0, maxSurge 1 · busy traffic",
    question: "Now a new bay is added before any old one is taken out. What does that cost?",
    options: ["Nothing: same speed, same resources, no dip", "No dip in capacity, but a seventh bay is in use while it runs", "No dip, but it takes twice as long"],
    answer: 1,
    why: "With maxSurge the rollout adds a new bay in a spare position first and only removes an old one once the new one is ready, so capacity never drops below six bays. The price is the extra bay: your cluster needs room for seven while it runs. It is not slower, because each step still waits for exactly one warm-up.",
    watch: { load: "high", unavail: 0, surge: 1, probe: "on", next: "good" },
  },
  {
    id: "probe",
    title: "No readiness probe",
    change: "Readiness probe on → off · a new bay's flag rises as soon as it is installed",
    question: "The new version is fine, but every module needs 6 s to warm up. Without the probe…",
    options: ["Nothing changes: the new version works", "Requests fail at every swap while the new bay is still warming up", "The rollout is slower, but nothing fails"],
    answer: 1,
    why: "The flag is the only thing the distributor looks at. Without a probe it rises the moment the module is in place, so requests go to a bay that cannot answer yet. Worse, a new bay has an empty queue, so a least-busy distributor sends it more than its share. The rollout also looks twice as fast, because nothing waits for warm-up: that speed is the bug.",
    watch: { load: "normal", unavail: 1, surge: 0, probe: "off", next: "good" },
  },
  {
    id: "bad",
    title: "A broken version",
    change: "Next version: broken · it starts, but never passes its health check",
    question: "With the readiness probe on, how far does the rollout get?",
    options: ["It replaces all six bays and the service goes down", "It stops after the first new bay; the old bays keep serving", "It notices and rolls back by itself"],
    answer: 1,
    why: "The rollout only removes another old bay when enough bays are ready. A new bay that never becomes ready keeps it waiting forever, so the damage stays at one bay. It does not roll back: in Kubernetes the deployment is marked as failed after progressDeadlineSeconds and someone (or a pipeline) runs kubectl rollout undo. Without the probe, nothing stops it.",
    watch: { load: "normal", unavail: 1, surge: 0, probe: "on", next: "bad" },
  },
  {
    id: "format",
    title: "Two versions at once",
    change: "Next version saves user data in a new format that the old version cannot read",
    question: "During the rollout, old and new bays both serve. What do users see?",
    options: ["No errors: every request lands on a working bay", "Errors for users who were served by a new bay and then land on an old one, until the rollout ends", "Every request fails until the rollout ends"],
    answer: 1,
    why: "A rolling deploy always has a window where both versions serve, and a user can bounce between them from one request to the next. Anything one version writes, the other must be able to read. Ship format changes in steps: first a version that reads both formats, then one that writes the new one (expand, then contract).",
    watch: { load: "normal", unavail: 1, surge: 0, probe: "on", next: "incompatible" },
  },
];

const QUESTIONS = [
  ["maxUnavailable and maxSurge both make a rollout faster. What does each one cost?",
    "maxUnavailable spends capacity: bays are taken out before replacements are ready, so the remaining bays carry more load and waits grow. maxSurge spends resources: extra bays run alongside the old ones, so you need room in the cluster. With maxUnavailable 0 and maxSurge 1 you never drop below full capacity."],
  ["Why does a readiness probe make a broken rollout stop by itself, and what does it not do for you?",
    "The rollout only removes another old bay when enough bays are ready. A new bay that never becomes ready blocks that, so only one bay is lost and the old ones keep serving. It does not roll back: the deployment just stops progressing (Kubernetes marks it failed after progressDeadlineSeconds), and someone has to run a rollback."],
  ["Without the probe, the rollout finished in half the time. Why is that number misleading?",
    "It finished faster because nothing waited for warm-up: each flag rose the moment the module was in place. The time saved was paid for with failed requests sent to bays that could not answer yet."],
  ["A new version renames a field in the data it stores. How do you ship it with a rolling deploy?",
    "In steps, because old and new versions serve side by side during every rollout. First deploy a version that can read both the old and the new field but still writes the old one; once that is everywhere, deploy the version that writes the new one; later remove the old field (expand, then contract)."],
  ["A brand-new bay has an empty queue. Why can that hurt right after it becomes ready, and what helps?",
    "A least-busy distributor sends it a burst of traffic, while it may still be cold (caches empty, JIT not warmed). A readiness probe that only passes when it can really serve, a short warm-up delay, or slow-start in the load balancer all help."],
  ["When would you choose blue-green or canary instead of a rolling deploy?",
    "Blue-green when you cannot have two versions serving at once or want an instant, complete rollback. Canary when you want to try the new version on a small share of real traffic and judge it by metrics before going further. Rolling is the cheap default when versions are compatible and gradual replacement is fine."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Module yard",
  keys: [
    { mark: "lit", label: "New version" },
    { mark: "raised", label: "Old version, and the six bays on the feed rail" },
    { mark: "flat", label: "Readiness flag: up means the distributor may send work" },
  ],
  caption:
    "Requests come down the chute and the distributor sends each one to the least busy bay whose flag is up. In a rollout the gantry crane pulls out an old module, drops it in the bin, and lowers a new one from the supply stand. The strip on a module's face fills while it warms up; the flag rises only when it is ready. The two positions at the right end are spare room for surge.",
  stage: 'data-yard aria-label="Rolling deploy simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

// The panel carries a note under the controls (lesson-local: panel() has no slot for one).
const controls = panel({
  stats: [["mix", "New / old bays", "0 / 6"], ["ready", "Flags up", "6"], ["served", "Served"], ["errors", "Errors"], ["p95", "p95 wait", "–"], ["time", "Rollout time", "–"]],
  controls: [
    seg("unavail", "maxUnavailable", [[0, "0"], [1, "1"], [3, "3"]], 1),
    seg("surge", "maxSurge", [[0, "0"], [1, "1"], [2, "2"]], 0),
    seg("probe", "Readiness probe", [["on", "On"], ["off", "Off"]], "on"),
    seg("next", "Next version", [["good", "Good"], ["bad", "Broken"], ["incompatible", "New data format"]], "good"),
    seg("load", "Traffic", [["normal", "Normal"], ["high", "Busy"]], "normal"),
    speedSeg(),
    `<div class="control"><span>Do something</span><div class="actions">
      <button class="btn primary" type="button" data-act="rollout">Start rollout</button>
      <button class="btn" type="button" data-act="reset">Reset</button>
      <button class="btn" type="button" data-act="pause">Pause</button>
    </div></div>`,
  ],
}).replace(/<\/div>$/, `  <p class="note" data-note style="padding:0 12px 12px;margin:0">Kubernetes does not allow maxUnavailable and maxSurge to both be 0; choosing that sets maxSurge to 1.</p>
</div>`);

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};

const stage = document.querySelector("[data-yard]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
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
const TOKEN_SVG = ${JSON.stringify(k.solidSvg(k.cylinder(0, 0, 1.5, 0, 2.4, P, 14), { tone: "mid", crease: "none" }))};
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

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const seg01 = (p, a, b) => clamp01((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
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
const CABLE_Y_PATH = (x, z) => [${GEOMETRY.ROW_Y - 2}, ${GEOMETRY.ROW_Y + 2}].map((y) => { const a = iso([x, y, ${GEOMETRY.TROLLEY_Z}], P), b = iso([x, y, z + 3], P); return "M" + a[0].toFixed(1) + " " + a[1].toFixed(1) + "L" + b[0].toFixed(1) + " " + b[1].toFixed(1); }).join("");

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
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function describe() {
  const S = sim.S, r = S.rollout;
  const mods = S.bays.filter((b) => b.module);
  const fresh = mods.filter((b) => b.module.version === S.target).length;
  const readyN = S.bays.filter((b) => sim.ready(b)).length;
  if (!r || r.end !== null) return "v" + S.target + " on " + mods.length + " bays · " + readyN + " flags up";
  const stuck = S.bays.find((b) => b.module && b.module.version === S.target && b.module.bad && S.t > b.module.warmAt + 1);
  if (stuck && sim.S.cfg.probe) return "v" + S.target + " stuck · bay " + (stuck.i + 1) + " never ready · " + S.bays.filter((b) => b.module && b.module.version !== S.target && sim.ready(b)).length + " old bays serving";
  const job = S.crane.job;
  const doing = job ? (job.type === "install" ? " · installing bay " + (job.bay + 1) : " · pulling bay " + (job.bay + 1)) : S.bays.some((b) => b.module && b.module.version === S.target && S.t < b.module.warmAt) ? " · waiting for warm-up" : "";
  return "v" + S.target + " rolling · " + fresh + " of 6 new" + doing;
}
function showStats() {
  const S = sim.S;
  const mods = S.bays.filter((b) => b.module);
  const fresh = mods.filter((b) => isLit(b.module.version)).length;
  statEls.mix.textContent = fresh + " / " + (mods.length - fresh);
  statEls.ready.textContent = S.bays.filter((b) => sim.ready(b)).length;
  statEls.served.textContent = counters.served;
  statEls.errors.textContent = counters.errors;
  const recent = S.records.filter((r) => r.latency !== undefined).slice(-200).map((r) => r.latency).sort((a, b) => a - b);
  statEls.p95.textContent = recent.length >= 10 ? recent[Math.floor(0.95 * (recent.length - 1))].toFixed(1) + " s" : "–";
  const r = S.rollout;
  statEls.time.textContent = r ? ((r.end !== null ? r.end : S.t) - r.start).toFixed(0) + " s" + (r.end === null ? "…" : "") : "–";
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
const pauseBtn = document.querySelector('[data-act="pause"]');
const clock = WB.loop({ stage, step: frameStep, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });
const pressSeg = WB.pressSeg;
function set(name, raw) {
  if (name === "unavail" || name === "surge" || name === "speed") cfg[name] = Number(raw); else cfg[name] = raw;
  if (cfg.unavail === 0 && cfg.surge === 0) { cfg.surge = 1; pressSeg("surge", 1); }
  sim.S.cfg.unavail = cfg.unavail; sim.S.cfg.surge = cfg.surge; sim.S.cfg.probe = cfg.probe === "on"; sim.S.cfg.load = cfg.load;
  pressSeg(name, raw);
}
function startRollout() {
  auto = false;
  if (!sim.startRollout(cfg.next)) say("a rollout is already running · reset to start over");
  if (clock.paused) clock.setPaused(false);
}
function reset() { auto = false; newSim(); paintAll(); showStats(); }
WB.onSegments((name, value) => { if (name !== "speed") auto = false; set(name, value); });
document.querySelector('[data-act="rollout"]').addEventListener("click", startRollout);
document.querySelector('[data-act="reset"]').addEventListener("click", reset);
pauseBtn.addEventListener("click", () => clock.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); clock.toggle(); } });
function paintAll() { const inflight = paintTokens(); const hide = paintCrane(); paintBays(inflight, hide, 1); say(describe()); }

// ---------- experiments ----------
// Lesson-local wiring: results come as groups of bars with a heading each, which WB.experiments does not draw.
const pct = (x) => (100 * x < 1 && x > 0 ? (100 * x).toFixed(1) : Math.round(100 * x)) + "%";
const secs = (x) => (x === null ? "never" : x.toFixed(x < 10 ? 1 : 0) + " s");
const run8 = (o) => averageRollout({ warm: 40, window: 110, ...o });
const group = (title, rows) => ({ title, rows });
const RUNS = {
  unavail: () => {
    const base = run8({ load: "high", deploy: false }), a = run8({ load: "high", unavail: 1 }), b = run8({ load: "high", unavail: 3 });
    return { verdict: "Rollout time " + secs(a.rolloutTime) + " → " + secs(b.rolloutTime) + ". p95 wait during it " + secs(a.p95) + " → " + secs(b.p95) + " (no rollout: " + secs(base.p95) + ").",
      groups: [group("Rollout time", [["maxUnavailable 1", a.rolloutTime, secs(a.rolloutTime)], ["maxUnavailable 3", b.rolloutTime, secs(b.rolloutTime), true]]),
        group("p95 wait during the rollout", [["No rollout", base.p95, secs(base.p95)], ["maxUnavailable 1", a.p95, secs(a.p95)], ["maxUnavailable 3", b.p95, secs(b.p95), true]])] };
  },
  surge: () => {
    const base = run8({ load: "high", deploy: false }), a = run8({ load: "high", unavail: 1, surge: 0 }), b = run8({ load: "high", unavail: 0, surge: 1 });
    return { verdict: "p95 wait during the rollout " + secs(a.p95) + " → " + secs(b.p95) + " (no rollout: " + secs(base.p95) + "). Rollout time " + secs(a.rolloutTime) + " → " + secs(b.rolloutTime) + ". Bays in use at the peak: " + a.peakBays + " → " + b.peakBays + ".",
      groups: [group("p95 wait during the rollout", [["No rollout", base.p95, secs(base.p95)], ["Unavailable 1", a.p95, secs(a.p95)], ["Surge 1", b.p95, secs(b.p95), true]]),
        group("Bays in use at the peak", [["Unavailable 1", a.peakBays, String(a.peakBays)], ["Surge 1", b.peakBays, String(b.peakBays), true]]),
        group("Rollout time", [["Unavailable 1", a.rolloutTime, secs(a.rolloutTime)], ["Surge 1", b.rolloutTime, secs(b.rolloutTime), true]])] };
  },
  probe: () => {
    const a = run8({ load: "normal" }), b = run8({ load: "normal", probe: false });
    return { verdict: "Without the probe, " + pct(b.errorRate) + " of requests failed during the rollout (with it: " + pct(a.errorRate) + "). It also \\"finished\\" in " + secs(b.rolloutTime) + " instead of " + secs(a.rolloutTime) + ", because nothing waited for warm-up.",
      groups: [group("Requests that failed", [["Probe on", a.errorRate, pct(a.errorRate)], ["Probe off", b.errorRate, pct(b.errorRate), true]]),
        group("Rollout time", [["Probe on", a.rolloutTime, secs(a.rolloutTime)], ["Probe off", b.rolloutTime, secs(b.rolloutTime), true]])] };
  },
  bad: () => {
    const a = run8({ load: "normal", quality: "bad", full: true }), b = run8({ load: "normal", quality: "bad", probe: false, full: true });
    return { verdict: "With the probe: " + a.newBays.toFixed(0) + " bay replaced, " + a.oldServing.toFixed(0) + " old bays still serving, " + pct(a.errorRate) + " of requests failed; the rollout just waits. Without it: " + b.newBays.toFixed(0) + " of 6 replaced and " + pct(b.errorRate) + " failed.",
      groups: [group("Requests that failed (110 s)", [["Probe on", a.errorRate, pct(a.errorRate)], ["Probe off", b.errorRate, pct(b.errorRate), true]]),
        group("Bays running the broken version", [["Probe on", a.newBays, a.newBays.toFixed(0) + " of 6"], ["Probe off", b.newBays, b.newBays.toFixed(0) + " of 6", true]])] };
  },
  format: () => {
    const a = run8({ load: "normal" }), b = run8({ load: "normal", quality: "incompatible" });
    return { verdict: pct(b.errorRate) + " of requests failed during the rollout, every one from a user sent back to an old bay after a new one had saved their data. A compatible change: " + pct(a.errorRate) + ". After the last old bay is gone, the errors stop.",
      groups: [group("Requests that failed during the rollout", [["Compatible change", a.errorRate, pct(a.errorRate)], ["New data format", b.errorRate, pct(b.errorRate), true]])] };
  },
};
function barsHtml(groups) {
  return groups.map((g) => {
    const top = Math.max(...g.rows.map((r) => r[1] || 0)) * 1.1 || 1;
    return '<div class="bar-group">' + g.title + "</div>" + g.rows.map(([label, value, text, after]) => '<div class="bar"' + (after ? " data-after" : "") + ' data-share="' + Math.max(0.01, (value || 0) / top) + '"><span>' + label + '</span><span class="track"><span class="fill" style="width:0"></span></span><b>' + text + "</b></div>").join("");
  }).join("");
}
document.querySelectorAll("[data-exp]").forEach((card) => {
  const exp = EXPERIMENTS.find((e) => e.id === card.dataset.exp);
  const runBtn = card.querySelector("[data-run]");
  const choices = [...card.querySelectorAll("[data-choice]")];
  let picked = null;
  choices.forEach((c) => c.addEventListener("click", () => {
    if (card.hasAttribute("data-done")) return;
    picked = Number(c.dataset.choice);
    choices.forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
    runBtn.disabled = false; runBtn.textContent = "Run the experiment";
  }));
  runBtn.addEventListener("click", () => {
    if (picked === null) return;
    const out = RUNS[exp.id]();
    const right = picked === exp.answer;
    choices.forEach((x, j) => { x.disabled = true; if (j === exp.answer) x.dataset.verdict = "right"; else if (j === picked) x.dataset.verdict = "wrong"; });
    card.querySelector("[data-outcome]").textContent = (right ? "Your prediction held. " : "Not what you predicted. ") + out.verdict;
    card.querySelector("[data-bars]").innerHTML = barsHtml(out.groups);
    card.setAttribute("data-done", "");
    runBtn.disabled = true; runBtn.textContent = "Done";
    requestAnimationFrame(() => requestAnimationFrame(() => card.querySelectorAll(".bar").forEach((b) => { b.querySelector(".fill").style.width = Math.round(100 * Number(b.dataset.share)) + "%"; })));
  });
  card.querySelector("[data-watch]").addEventListener("click", () => {
    const w = exp.watch;
    auto = false;
    ["unavail", "surge", "probe", "next", "load"].forEach((n) => { cfg[n] = n === "unavail" || n === "surge" ? Number(w[n]) : w[n]; pressSeg(n, w[n]); });
    newSim(); paintAll(); showStats();
    document.getElementById("machine").scrollIntoView({ behavior: still.matches ? "auto" : "smooth" });
    if (clock.paused) clock.setPaused(false);
    setTimeout(() => { sim.startRollout(cfg.next); }, 1500);
  });
});

newSim();
clock.setPaused(clock.paused);
paintAll(); showStats();
`;


const size = writePage(new URL("./rolling-deploy-workbench.html", import.meta.url), {
  title: "Rolling Deploy Workbench",
  eyebrow: "Systems lesson 10 · Rolling deploys",
  lede: "A rolling deploy replaces a service one piece at a time, so it never has to stop. This lesson builds the idea three ways: watch a crane swap modules in a running yard, predict what each setting breaks, then explain it back.",
  machine: { intro: "Each bay is one replica of the service. Watch a rollout or two, then change the settings below, pick the next version, and start one yourself.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results are averaged over eight simulated rollouts of the same yard: six bays, 6 s warm-up, 2.4 s per crane move.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote rolling-deploy-workbench.html", (size / 1024).toFixed(0) + " KB");

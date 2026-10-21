// Systems lesson 04 · Circuit breakers. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, actions, inlineModule, speedSeg } from "../../workbench/page.mjs";
import { buildFigure, P, GEOMETRY, boxSvg, bladeSvg } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const INCIDENT = [{ at: 0, cause: "failing" }, { at: 20, cause: "healthy" }];
const EXPERIMENTS = [
  {
    id: "slow",
    title: "The supplier slows down",
    change: "Supplier healthy → slow · each call now takes about 6 s · no timeout, no breaker",
    question: "Three in ten requests never call the supplier. What happens to them?",
    options: ["They are served as usual: only supplier calls are affected", "They slow down a little while the supplier is slow", "Most of them are turned away too, as if they needed the supplier"],
    answer: 2,
    why: "Every worker that picks up a supplier request sits on the line for 6 seconds. Requests needing the supplier arrive faster than that, so soon all six workers are stuck waiting and the tray at the door is full. Requests that would take 0.4 s on their own are turned away because there is nobody to serve them. A slow dependency is worse than a dead one: a dead one at least answers quickly.",
    watch: { cause: "slow", timeout: 0, breaker: "false", retries: "0" },
  },
  {
    id: "timeout",
    title: "Add a timeout",
    change: "Slow supplier, as before · timeout off → 1.5 s",
    question: "With a 1.5 s timeout, what happens to the requests that need the supplier?",
    options: ["They succeed, just faster", "They fail, each after waiting the full 1.5 s, and the other requests are served again", "Nothing changes: the supplier is still slow"],
    answer: 1,
    why: "A timeout doesn't make the supplier faster. It caps how long a worker can be held, so workers come back and the requests that don't need the supplier are served again. The supplier requests still fail, and every one of them waits the full timeout first.",
    watch: { cause: "slow", timeout: 1.5, breaker: "false", retries: "0" },
  },
  {
    id: "breaker",
    title: "Add the breaker",
    change: "Supplier failing · timeout 1.5 s · breaker off → on (opens after 5 failures in a row, 5 s cooldown)",
    question: "With the breaker on, what happens to the load on the supplier?",
    options: ["It stays the same: the same requests keep arriving", "It drops to almost nothing, and failures come back almost at once", "It doubles, because the breaker keeps probing"],
    answer: 1,
    why: "After five failures in a row, the breaker opens and requests fail at the breaker instead of waiting on the line. Your workers are free, and the supplier stops receiving calls, apart from one probe after each cooldown. The requests still fail, but quickly, and the supplier gets room to recover.",
    watch: { cause: "failing", timeout: 1.5, breaker: "true", retries: "0" },
  },
  {
    id: "retries",
    title: "Retry three times",
    change: "Supplier failing, fixed after 20 s · timeout 1.5 s · retries 0 → 3, no backoff, no breaker",
    question: "The cause is fixed after 20 s. With three immediate retries per request, when do supplier calls succeed again?",
    options: ["Sooner: the retries get through as soon as it's fixed", "About the same time as without retries", "Much later, or not at all: the retries keep it overloaded"],
    answer: 2,
    why: "Each failing request now makes up to four calls, and abandoned calls keep running on the supplier. Its load climbs past what it can handle, so it stays overloaded after the original cause is fixed. The retries become the outage. A breaker in front of the retries cuts the load and lets it recover.",
    watch: { cause: "failing", timeout: 1.5, breaker: "false", retries: "3", fixAfter: 20 },
  },
  {
    id: "cooldown",
    title: "A long cooldown",
    change: "Supplier failing, fixed after 20 s · timeout 1.5 s · breaker on · cooldown 5 s → 30 s",
    question: "With a 30 s cooldown, how soon after the fix does traffic flow again?",
    options: ["Right away: the breaker sees the fix", "Only after the cooldown runs out and a probe gets through", "Never: an open breaker has to be reset by hand"],
    answer: 1,
    why: "An open breaker doesn't watch the supplier. It waits out the cooldown, then lets one probe through (half-open). If the probe succeeds the breaker closes; if it fails it opens for another cooldown. A long cooldown keeps you failing after the supplier is healthy; a short one probes more often but costs little, since it's one call.",
    watch: { cause: "failing", timeout: 1.5, breaker: "true", retries: "0", cooldown: 30, fixAfter: 20 },
  },
];

const QUESTIONS = [
  ["Why can a slow dependency hurt you more than one that is down?",
    "A dead dependency fails fast, so your workers are released at once. A slow one holds each worker for the whole call. Once every worker is waiting, nothing else can be served, not even requests that never touch that dependency. That is how one slow service takes down endpoints that have nothing to do with it."],
  ["How would you choose a timeout for a call to another service?",
    "Start from that service's normal latency (for example its p99 plus a margin) and keep it shorter than your own caller's deadline. Too long and workers pile up behind a slow call; too short and normal jitter turns into false failures. A timeout should be set on purpose, never left at a library default of 30 s or infinity."],
  ["A circuit breaker protects whom: your service, the supplier, or both?",
    "Both. It releases your workers by failing fast, and it takes load off the supplier so it can recover. The cost is that requests fail without even trying while it is open, so you need a fallback for them."],
  ["Why can automatic retries make an outage longer, and how do you retry safely?",
    "Retries multiply the load at the worst moment: three retries can mean four times the calls to a struggling service, which keeps it overloaded after the original cause is fixed. Retry only idempotent operations, keep the count small, add exponential backoff with jitter, use a retry budget, and put retries behind a breaker."],
  ["What is the half-open state for, and what goes wrong if the cooldown is too long or too short?",
    "After the cooldown, half-open lets a single probe through to test the supplier without sending it full traffic. Success closes the breaker; failure opens it again. Too long a cooldown keeps you failing after the supplier has recovered; too short a cooldown makes it flap, which costs little load but makes noisy alerts and logs."],
  ["The breaker is open. What should the user see?",
    "A fast, honest response: a cached or default value, a degraded feature (\"recommendations unavailable\"), or a clear error. Not a spinner that waits for a timeout. Deciding the fallback is part of adding a breaker."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Switchboard",
  keys: [
    { mark: "lit", label: "A cord in the trunk: a worker waiting on the supplier" },
    { mark: "raised", label: "Six operator positions: the thread pool" },
    { mark: "flat", label: "Knife-switch breaker between the board and the supplier" },
  ],
  caption:
    "About three calls a second come in; the lamps at the top are calls waiting for a free operator (four at most; the separate lamp flashes when one is turned away). An operator plugs into the lower row for work done in-house, or into the upper trunk row to call the supplier, and stays plugged in until the supplier answers or the timeout pulls the cord. The dial in front of each position shows how long its cord has been in (one turn is 8 s). The breaker's blade is down when closed, half raised when it lets one test call through, and up when open, with a shutter dropped over the trunk jacks. Its dials count failures and the cooldown. The gauge on the supplier shows calls in progress against what it can handle.",
  stage: 'data-office aria-label="Switchboard simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const controls = panel({
  stats: [["served", "Served"], ["fast", "Failed fast"], ["slow", "Failed slow"], ["dropped", "Turned away"], ["p95", "p95 wait", "–"], ["load", "Supplier load"]],
  controls: [
    seg("cause", "Supplier", [["healthy", "Healthy"], ["slow", "Slow"], ["failing", "Failing"]], "healthy"),
    seg("timeout", "Timeout", [[0, "Off"], [1.5, "1.5 s"], [4, "4 s"]], 0),
    seg("breaker", "Circuit breaker", [["false", "Off"], ["true", "On"]], "false"),
    seg("threshold", "Opens after", [[3, "3 fails"], [5, "5 fails"], [10, "10 fails"]], 5),
    seg("cooldown", "Cooldown", [[5, "5 s"], [30, "30 s"]], 5),
    seg("retries", "Retries", [["0", "None"], ["3", "3 now"], ["3b", "3 + backoff"]], "0"),
    speedSeg(),
    actions("Do something", [["reset", "Reset counts"], ["pause", "Pause"]]),
  ],
});

// Figure-specific styles.
const css = `
[data-op]>[data-v]{display:none}
[data-op][data-state="rest"]>[data-v="rest"],[data-op][data-state="local"]>[data-v="local"],[data-op][data-state="trunk"]>[data-v="trunk"],[data-op][data-state="bounce"]>[data-v="bounce"]{display:inline}
.cord-out{fill:none;stroke:var(--anatomy-mid);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.cord-in{fill:none;stroke:var(--anatomy-card);stroke-width:1;stroke-linecap:round;stroke-linejoin:round}
.cord-lit{fill:none;stroke:var(--anatomy-lit);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.lamp{fill:var(--anatomy-card);stroke:none;transition:fill .15s}
.lamp[data-on]{fill:var(--anatomy-hi)}
.jack-hole{fill:var(--anatomy-hi);stroke:none;opacity:.55}
.gauge-fill{fill:var(--anatomy-mid);stroke:none}
.flow[data-off]{display:none}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const INCIDENT = ${JSON.stringify(INCIDENT)};

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (sel) => svg.querySelector(sel);
const readout = document.querySelector("[data-readout]");
const ops = G.OPS.map((_, i) => q('[data-op="' + i + '"]'));
const needles = G.OPS.map((_, i) => q('[data-needle="' + i + '"]'));
const lamps = G.LAMPS.map((_, i) => q('[data-lamp="' + i + '"]'));
const overflowLamp = q("[data-overflow]"), shutter = q("[data-shutter]"), blade = q("[data-blade]");
const failNeedle = q("[data-fail-needle]"), coolNeedle = q("[data-cool-needle]");
const trunkIn = q("[data-trunk-in]"), trunkOut = q("[data-trunk-out]"), gauge = q("[data-gauge]"), knobPath = q("[data-knob]");

let machine = createSim({}, (Date.now() % 1e6) + 1);
let speed = 1, carry = 0, bladeAngle = 0, bladeDrawn = null, shutterLift = G.SHUTTER.lift;
let scheduled = [];
const pops = new Array(G.OPS.length).fill(-1);
const lastCall = new Array(G.OPS.length).fill(-1), replug = new Array(G.OPS.length).fill(-1);
let lastDrop = -1;

function needleD(c, r, z, turn, tail = 1.8) { const a = turn * Math.PI * 2; return lineOnTop([c[0] - Math.sin(a) * tail, c[1] + Math.cos(a) * tail], [c[0] + Math.sin(a) * (r - 1.8), c[1] - Math.cos(a) * (r - 1.8)], z + 0.2, P); }
function knobD(share) { const [x, y] = G.KNOB.c, r = G.KNOB.r, a = -Math.PI * 0.75 + share * Math.PI * 1.5; return lineOnTop([x + Math.sin(a) * 1.2, y - Math.cos(a) * 1.2], [x + Math.sin(a) * (r - 0.8), y - Math.cos(a) * (r - 0.8)], G.KNOB.z + G.KNOB.h + 0.1, P); }
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };

function advance(dt) {
  carry += dt;
  while (carry >= STEP) {
    carry -= STEP; machine.step(STEP);
    while (scheduled.length && scheduled[0].at <= machine.s.t) scheduled.shift().fn();
  }
  for (const e of machine.s.events) {
    if (e.kind === "fast" && e.worker >= 0 && e.t > machine.s.t - 0.35) pops[e.worker] = e.t;
    if (e.kind === "drop" && e.t > lastDrop) lastDrop = e.t;
  }
}

const boxSvg = ${boxSvg.toString().replace(/^function boxSvg/, 'function')};
const bladeSvg = ${bladeSvg.toString().replace(/^function bladeSvg/, 'function')};
const ANGLES = G.BLADE.angles;

function paint() {
  const s = machine.s, cfg = machine.cfg, t = s.t;
  let waiting = 0;
  s.workers.forEach((w, i) => {
    const onLine = w.phase === "call";
    if (onLine) {
      waiting++;
      if (lastCall[i] >= 0 && w.callStart !== lastCall[i] && w.callStart - lastCall[i] > 0.01) replug[i] = t;
      lastCall[i] = w.callStart;
    } else lastCall[i] = -1;
    let state = "rest";
    if (pops[i] >= 0 && t - pops[i] < 0.35) state = "bounce";
    else if (onLine) state = replug[i] >= 0 && t - replug[i] < 0.18 ? "rest" : "trunk";
    else if (w.phase === "local" && w.req && w.req.attempts === 0) state = "local";
    if (ops[i].dataset.state !== state) ops[i].dataset.state = state;
    needles[i].setAttribute("d", needleD([G.OPS[i].cx, G.DIAL.y], G.DIAL.r, G.DIAL.z, onLine ? (t - w.callStart) / 8 : 0));
  });
  lamps.forEach((el, i) => el.toggleAttribute("data-on", i < s.queue.length));
  overflowLamp.toggleAttribute("data-on", lastDrop >= 0 && t - lastDrop < 0.4);
  const b = s.breaker, state = cfg.breaker ? b.state : "closed";
  const target = ANGLES[state];
  bladeAngle += (target - bladeAngle) * (WB.still.matches ? 1 : 0.18);
  if (Math.abs(target - bladeAngle) < 0.2) bladeAngle = target;
  const shown = Math.round(bladeAngle * 2) / 2 + (cfg.breaker && state === "open" ? "o" : "");
  if (shown !== bladeDrawn) { blade.innerHTML = bladeSvg(bladeAngle, G.BLADE, P, cfg.breaker && state === "open"); bladeDrawn = shown; }
  const liftTarget = cfg.breaker && state === "open" ? 0 : G.SHUTTER.lift;
  shutterLift += (liftTarget - shutterLift) * (WB.still.matches ? 1 : 0.22);
  if (Math.abs(liftTarget - shutterLift) < 0.05) shutterLift = liftTarget;
  shutter.setAttribute("transform", translateAlong(P, [0, 0, shutterLift]));
  failNeedle.setAttribute("d", needleD(G.FAIL_DIAL.c, G.FAIL_DIAL.r, G.DIAL_TOP, -0.375 + 0.75 * (cfg.breaker ? Math.min(1, b.failures / cfg.threshold) : 0)));
  const cool = cfg.breaker && state === "open" ? Math.max(0, (b.openUntil - t) / cfg.cooldown) : 0;
  coolNeedle.setAttribute("d", needleD(G.COOL_DIAL.c, G.COOL_DIAL.r, G.DIAL_TOP, -0.375 + 0.75 * cool));
  const load = machine.load(), g = G.GAUGE;
  trunkIn.toggleAttribute("data-off", waiting === 0);
  trunkOut.toggleAttribute("data-off", load === 0);
  const fill = Math.min(1, load / g.full);
  gauge.setAttribute("d", fill > 0.005 ? WB.faceRectY(P, g.x0, g.x1, g.y, g.z0, g.z0 + (g.z1 - g.z0) * fill) : "");
  const supplier = cfg.cause !== "healthy" ? "supplier " + cfg.cause : s.supplier.recovering ? "supplier overloaded" : "supplier ok";
  const breakerText = !cfg.breaker ? "no breaker" : state === "half" ? "breaker half-open · one test call" : "breaker " + state;
  say(breakerText + " · " + waiting + " of 6 cords in the trunk · " + supplier);
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
let statsAt = 0;
function showStats(force) {
  const now = performance.now();
  if (!force && now - statsAt < 250) return;
  statsAt = now;
  const c = machine.s.counts;
  if (c.latencies.length > 1500) c.latencies.splice(0, c.latencies.length - 1000);
  statEls.served.textContent = c.served;
  statEls.fast.textContent = c.failedFast;
  statEls.slow.textContent = c.failedSlow;
  statEls.dropped.textContent = c.dropped;
  statEls.p95.textContent = c.latencies.length ? p95(c.latencies).toFixed(1) + " s" : "–";
  statEls.load.textContent = machine.load() + " / " + machine.cfg.cap;
}


// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const clock = WB.loop({ stage, step: (dt) => { advance(dt * speed); paint(); showStats(); }, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });
clock.setPaused(clock.paused);
const pressSeg = WB.pressSeg;
const KNOB_SHARE = { 0: 0, 1.5: 0.45, 4: 1 };
function set(name, raw) {
  if (name === "cause") { machine.set("cause", raw); scheduled = []; }
  if (name === "timeout") { machine.set("timeout", Number(raw)); knobPath.setAttribute("d", knobD(KNOB_SHARE[Number(raw)] ?? 0)); }
  if (name === "breaker") machine.set("breaker", raw === "true");
  if (name === "threshold") machine.set("threshold", Number(raw));
  if (name === "cooldown") machine.set("cooldown", Number(raw));
  if (name === "retries") { machine.set("retries", raw === "0" ? 0 : 3); machine.set("backoff", raw === "3b"); }
  if (name === "speed") speed = Number(raw);
  pressSeg(name, raw);
}
function resetCounts() { machine.resetCounts(); showStats(true); }
WB.onSegments(set);
document.querySelector('[data-act="reset"]').addEventListener("click", resetCounts);
pauseBtn.addEventListener("click", () => clock.setPaused(!clock.paused));
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); clock.setPaused(!clock.paused); } });

// ---------- experiments ----------
const percent = (x) => Math.round(100 * x) + "%";
const secs = (x) => x.toFixed(1) + " s";
const WINDOW = 40;
const recoveryText = (r) => r.recovered === 0 ? ">\u00a0" + WINDOW + "\u00a0s" : secs(r.recovery) + (r.recovered < r.runs ? " (" + r.recovered + " of " + r.runs + " runs)" : "");
const recoveryShare = (r) => r.recovered === 0 ? 1 : Math.min(1, r.recovery / WINDOW);
const RUNS = {
  slow: () => {
    const a = averageScenario({ options: { cause: "healthy" } }), b = averageScenario({ options: { cause: "slow" } });
    return { verdict: "Requests that never call the supplier: " + percent(a.localServed) + " served when it was healthy, " + percent(b.localServed) + " when it was slow. " + percent(b.dropped) + " of all requests were turned away at the door.",
      bars: [["Healthy supplier", a.localServed, percent(a.localServed)], ["Slow supplier", b.localServed, percent(b.localServed), true]] };
  },
  timeout: () => {
    const a = averageScenario({ options: { cause: "slow" } }), b = averageScenario({ options: { cause: "slow", timeout: 1.5 } });
    const top = Math.max(a.p95Supplier, b.p95Supplier);
    return { verdict: "Requests that never call the supplier went from " + percent(a.localServed) + " to " + percent(b.localServed) + " served. Supplier requests now fail: " + percent(b.failedSlow) + " of all requests failed after waiting out the timeout.",
      bars: [["No timeout: others served", a.localServed, percent(a.localServed)], ["1.5 s: others served", b.localServed, percent(b.localServed), true], ["No timeout: p95 wait", a.p95Supplier / top, secs(a.p95Supplier)], ["1.5 s: p95 wait", b.p95Supplier / top, secs(b.p95Supplier), true]] };
  },
  breaker: () => {
    const a = averageScenario({ options: { cause: "failing", timeout: 1.5 } }), b = averageScenario({ options: { cause: "failing", timeout: 1.5, breaker: true } });
    const top = Math.max(a.p50Supplier, b.p50Supplier);
    return { verdict: "Calls in progress at the supplier: " + a.load.toFixed(1) + " → " + b.load.toFixed(1) + " on average. A supplier request now fails in " + secs(b.p50Supplier) + " (median), not " + secs(a.p50Supplier) + ".",
      bars: [["Breaker off: load", a.load / 15, a.load.toFixed(1)], ["Breaker on: load", b.load / 15, b.load.toFixed(1), true], ["Breaker off: median wait", a.p50Supplier / top, secs(a.p50Supplier)], ["Breaker on: median wait", b.p50Supplier / top, secs(b.p50Supplier), true]] };
  },
  retries: () => {
    const spec = (o) => averageScenario({ options: { timeout: 1.5, ...o }, events: INCIDENT, seconds: 20 + WINDOW, from: 0 });
    const a = spec({}), b = spec({ retries: 3 }), c = spec({ retries: 3, breaker: true });
    return { verdict: "Time from the fix to the first successful supplier call: " + recoveryText(a) + " without retries, " + recoveryText(b) + " with three immediate retries, " + recoveryText(c) + " with retries behind a breaker.",
      bars: [["No retries", recoveryShare(a), recoveryText(a)], ["3 retries", recoveryShare(b), recoveryText(b), true], ["3 retries + breaker", recoveryShare(c), recoveryText(c)]] };
  },
  cooldown: () => {
    const spec = (o) => averageScenario({ options: { timeout: 1.5, ...o }, events: INCIDENT, seconds: 20 + WINDOW, from: 0 });
    const a = spec({}), b = spec({ breaker: true, cooldown: 5 }), c = spec({ breaker: true, cooldown: 30 });
    return { verdict: "Time from the fix to the first successful supplier call: " + recoveryText(b) + " with a 5 s cooldown, " + recoveryText(c) + " with a 30 s cooldown (" + recoveryText(a) + " with no breaker at all).",
      bars: [["No breaker", recoveryShare(a), recoveryText(a)], ["Cooldown 5 s", recoveryShare(b), recoveryText(b)], ["Cooldown 30 s", recoveryShare(c), recoveryText(c), true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  machine = createSim(machine.cfg, (Date.now() % 1e6) + 1);
  set("cause", w.cause); set("timeout", w.timeout); set("breaker", w.breaker); set("retries", w.retries);
  if (w.cooldown) set("cooldown", w.cooldown);
  if (w.fixAfter) scheduled = [{ at: machine.s.t + w.fixAfter, fn: () => { machine.set("cause", "healthy"); pressSeg("cause", "healthy"); } }];
  showStats(true);
  if (clock.paused) clock.setPaused(false);
} });

paint(); showStats(true);
`;

const size = writePage(new URL("./circuit-breaker-workbench.html", import.meta.url), {
  title: "Circuit Breaker Workbench",
  eyebrow: "Systems lesson 04 · Circuit breakers",
  lede: "When a service you depend on gets slow or fails, the danger is not the failed calls: it is your own workers waiting on them. This lesson shows how timeouts, retries and a circuit breaker change that, three ways: watch a machine do it, predict what breaks it, then explain it back.",
  machine: { intro: "The six operator positions are your service's workers. The cabinet at the back right is a supplier you call over the network. Set the supplier to Slow or Failing, then try a timeout, the breaker and retries, and watch the counters.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results are averaged over eight seeded runs of the same machine, about 50 to 70 seconds of traffic each.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote circuit-breaker-workbench.html", (size / 1024).toFixed(0) + " KB");

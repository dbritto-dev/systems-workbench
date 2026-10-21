// Systems lesson 16 · The event loop. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, P, GEOMETRY, BELT_SLOTS, MICRO_SLOTS, TIMER_SLOTS, HELPERS, DEPTH_MAX } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "long",
    title: "One long job",
    change: "CPU job none → 200 ms of synchronous work every half second · setTimeout(…, 10) still armed every 100 ms",
    question: "What happens to a timer that is due 10 ms from now while the job runs?",
    options: ["It fires on time: timers are kept outside the loop", "It waits until the job finishes, up to about 200 ms late", "It is skipped and fires on the next round"],
    answer: 1,
    why: "The timer is kept outside the loop, and it does become due on time: it drops onto the conveyor after 10 ms. But only the operator runs callbacks, and the operator is busy with the job. Nothing interrupts running JavaScript, so the callback, every I/O callback and every frame wait their turn behind it. A delay is a minimum, never a promise.",
    watch: { job: 200, chunk: false, worker: false, flood: false, delay: 10 },
  },
  {
    id: "order",
    title: "Who goes first",
    change: "One script: setTimeout(cb, 0), then Promise.resolve().then(cb), then console.log(…)",
    question: "In what order do the three run?",
    options: ["setTimeout(0), Promise.then, console.log", "console.log, Promise.then, setTimeout(0)", "console.log, setTimeout(0), Promise.then"],
    answer: 1,
    why: "The script itself is on the stack, so its console.log runs first. When it ends, the operator empties the microtask tray before touching the conveyor, so the promise callback runs next. The timer callback, even with a delay of 0, is a macrotask: it waits on the conveyor until the stack and the tray are both empty.",
    watch: { puzzle: true },
  },
  {
    id: "flood",
    title: "A promise chain that never yields",
    change: "Promise chain on · 400 callbacks of 0.5 ms, each queuing the next",
    question: "Each callback is tiny. What happens to I/O callbacks and frames while the chain runs?",
    options: ["Nothing: each callback is only half a millisecond", "They wait until the whole chain is done, about 200 ms", "They take turns with the chain, one each"],
    answer: 1,
    why: "The rule is to empty the microtask tray completely before anything else. A callback that queues another callback keeps the tray from ever being empty, so 400 small steps behave like one 200 ms block. This is how code full of await, with no long function anywhere, can still freeze a page or stall a server.",
    watch: { job: 0, chunk: false, worker: false, flood: true, delay: 10 },
  },
  {
    id: "chunk",
    title: "Split the job",
    change: "200 ms job → 40 chunks of 5 ms, each queued at the back of the conveyor",
    question: "What happens to the longest gap between frames, and to how long the job takes?",
    options: ["Same freeze, just in pieces", "Frames stay smooth; the job finishes a little later", "Frames stay smooth and the job finishes sooner"],
    answer: 1,
    why: "Each chunk goes to the back of the line, so timers, I/O callbacks and frames slip in between. Nobody waits more than one chunk. The total work is the same, plus everyone else's turns in between, so the job itself finishes a little later. You trade a little throughput for a lot of responsiveness.",
    watch: { job: 200, chunk: true, worker: false, flood: false, delay: 10 },
  },
  {
    id: "worker",
    title: "Hand it to a worker",
    change: "200 ms job → posted to a worker thread; the result comes back as a message",
    question: "What happens to the loop, and to how long the job takes?",
    options: ["The loop stays responsive, and the job takes about as long", "The job runs twice as fast", "The loop still freezes: the worker shares the same thread"],
    answer: 0,
    why: "A worker is a second thread with its own loop. The main loop only spends half a millisecond posting the job and one millisecond handling the result, so timers and frames stay on time. The job is not faster: the same 200 ms of work happens on another core. Workers cost memory and a copy of the data, so they suit heavy, self-contained work.",
    watch: { job: 200, chunk: false, worker: true, flood: false, delay: 10 },
  },
];

const QUESTIONS = [
  ["setTimeout(fn, 10) ran 180 ms late. Nothing was wrong with the timer. What was?",
    "Something else held the call stack: a long synchronous function, a big JSON.parse, a loop over a large array, or a chain of microtasks. The delay only says when the callback may run at the earliest. It runs when the stack is empty and the microtasks are drained."],
  ["Why do promise callbacks run before a setTimeout(0) callback queued earlier?",
    "Promise callbacks are microtasks, timer callbacks are macrotasks. After each macrotask the loop empties the whole microtask queue before it takes the next macrotask or draws a frame. Queue order only matters within the same queue."],
  ["A page freezes but the profiler shows no single long function, only thousands of tiny async callbacks. How is that possible?",
    "A chain of microtasks (a recursive .then, an await inside a tight loop that never really waits) keeps the microtask queue from emptying, so frames, timers and I/O never get a turn. The fix is to yield to the macrotask queue (setTimeout, setImmediate, scheduler.yield) every so often, or to batch the work."],
  ["Your Node API has to parse a 50 MB JSON upload. What are the options, and what does each cost?",
    "Parsing it on the main thread blocks every other request for the whole parse. Splitting the work keeps the loop responsive but makes this request slower. A worker thread keeps the loop free but costs memory and a copy of the data. A streaming parser avoids holding it all at once. Moving the work to a queue and a separate service removes it from the API entirely."],
  ["Node reads files on a pool of four helper threads. What happens if 20 slow file reads arrive at once?",
    "Four run, sixteen wait for a free helper, and their callbacks arrive later. DNS lookups and some crypto use the same pool, so they wait too. The pool size can be raised (UV_THREADPOOL_SIZE). Network sockets don't use the pool, because the operating system already does them asynchronously."],
  ["What would you measure in production to catch these problems early?",
    "Event-loop delay (for example perf_hooks.monitorEventLoopDelay in Node or the long-task API in browsers): how late a timer that should fire every few milliseconds actually fires. A rising p99 delay means something is holding the stack, long before users complain about timeouts."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Event loop",
  keys: [
    { mark: "lit", label: "Lit: the task in the operator's hands, its frames on the spindle, the lamp on each frame" },
    { mark: "raised", label: "Puck = timer, tile = I/O callback, block = CPU job, small disc = promise callback" },
    { mark: "flat", label: "Conveyor = macrotask queue, tray at the operator's hand = microtask queue" },
  ],
  caption:
    "One operator runs everything, one task at a time. After each task the operator empties the tray at their hand (the gate across the conveyor stays down while it holds anything), draws a frame if one is due (every 16 ms, and the lamp blinks), then takes the next item off the conveyor. Timers wait in the cabinet and slide onto the conveyor when due; the dots on the dial mark when. Behind the partition, four helpers do the I/O and send finished reads down the channel into the hopper. The dial turns once per 100 ms of loop time; at ×1, one second on screen is 40 ms of loop time.",
  stage: 'data-loop aria-label="Event loop simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const controls = panel({
  stats: [["busy", "Loop busy", "–"], ["late", "Timer late, max", "–"], ["gap", "Longest frame gap", "–"], ["io", "I/O wait, avg", "–"], ["job", "Last job", "–"], ["queue", "Waiting", "0"]],
  controls: [
    seg("job", "CPU job every 0.5 s", [[0, "None"], [50, "50 ms"], [200, "200 ms"]], 50),
    seg("chunk", "Split the job", [["false", "Off"], ["true", "5 ms chunks"]], "false"),
    seg("worker", "Worker thread", [["false", "Off"], ["true", "On"]], "false"),
    seg("flood", "Promise chain", [["false", "Off"], ["true", "On"]], "false"),
    seg("delay", "setTimeout delay", [[0, "0 ms"], [10, "10 ms"], [50, "50 ms"]], 10),
    speedSeg(),
    actions("Do something", [["puzzle", "Run the order puzzle"], ["reset", "Reset counts"], ["pause", "Pause"]]),
  ],
});

const css = `
[data-slot] > [data-k]{display:none}
[data-slot][data-kind="timer"] > [data-k="timer"],[data-slot][data-kind="io"] > [data-k="io"],[data-slot][data-kind="cpu"] > [data-k="cpu"],[data-slot][data-kind="promise"] > [data-k="promise"],[data-slot][data-kind="frame"] > [data-k="frame"]{display:inline}
.bar-fill{fill:var(--anatomy-mid);stroke:none}
[data-lamp="on"]{display:none}
[data-flash] [data-lamp="on"]{display:inline}
[data-flash] [data-lamp="off"]{display:none}
[data-worker-cover][data-off]{display:none}
[data-gate-arm="down"]{display:none}
[data-gate] [data-gate-arm="down"]{display:inline}
[data-gate] [data-gate-arm="up"]{display:none}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, options, watch }) => ({ id, answer, options, watch })))};
const SLOTS = { belt: ${BELT_SLOTS}, micro: ${MICRO_SLOTS}, timers: ${TIMER_SLOTS}, helpers: ${HELPERS}, depth: ${DEPTH_MAX} };
const MS_PER_SECOND = 40;

const stage = document.querySelector("[data-loop]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const slotEls = {};
svg.querySelectorAll("[data-slot]").forEach((el) => { slotEls[el.dataset.slot] = el; });
const setKind = (name, kind) => { const el = slotEls[name], v = kind || ""; if (el.dataset.kind !== v) el.dataset.kind = v; };
const frameEls = [...svg.querySelectorAll("[data-frame]")];
const needle = q("[data-needle]");
const dueEls = [...svg.querySelectorAll("[data-due]")];
const deskBar = q("[data-desk-bar]"), workerBar = q("[data-worker-bar]"), cover = q("[data-worker-cover]");
const helperBars = [...svg.querySelectorAll("[data-helper-bar]")];
const bar = (b, share) => share > 0.01 ? WB.faceRectY(P, b.x0, b.x0 + (b.x1 - b.x0) * Math.min(1, share), b.y, b.z0, b.z1) : "";
const setD = (el, d) => { if (el.getAttribute("d") !== d) el.setAttribute("d", d); };

const cfg = { job: 50, chunk: false, flood: false, worker: false, delay: 10, speed: 1 };
let loop = createLoop(cfg, 7);
let puzzle = null;
loop.nextFrame = 0;
// A representative moment for the first frame: the operator 30 ms into a CPU job, two promise callbacks
// waiting in the tray (so the gate is down), mixed work on the conveyor, timers armed, helpers reading.
(function seed(L) {
  advance(L, 520);
  L.micro.push(task(L, "promise", "promise.then", 0.5, () => {}), task(L, "promise", "promise.then", 0.5, () => {}));
  L.macro.push(task(L, "io", "I/O callback", 1, () => {}), task(L, "cpu", "CPU job", 20, () => {}), task(L, "timer", "setTimeout", 0.5, () => {}, { due: L.t, set: L.t }));
  armTimer(L, 45, "setTimeout 45"); armTimer(L, 80, "setTimeout 80");
  L.helpers.forEach((h, i) => { if (!h && i < 3) L.helpers[i] = { id: L.nextSeq++, queued: L.t, ms: 30, left: 12 + i * 7, total: 30 }; });
  resetStats(L);
})(loop);

const stackDepth = (r) => !r ? 0 : r.kind === "cpu" ? 3 : r.kind === "promise" ? 2 : 1;
const msText = (v) => (v < 10 ? v.toFixed(1) : Math.round(v)) + " ms";

function paint() {
  const L = loop;
  for (let i = 0; i < SLOTS.belt; i++) setKind("c" + i, L.macro[i] && L.macro[i].kind);
  for (let i = 0; i < SLOTS.micro; i++) setKind("m" + i, L.micro[i] ? "promise" : "");
  const timers = [...L.timers].sort((a, b) => a.due - b.due);
  for (let i = 0; i < SLOTS.timers; i++) setKind("t" + i, timers[i] ? "timer" : "");
  L.helpers.forEach((h, i) => { setKind("h" + i, h ? "io" : ""); setD(helperBars[i], h ? bar(G.helperBars[i], 1 - h.left / h.total) : ""); });
  setKind("w", L.worker ? "cpu" : "");
  setD(workerBar, L.worker ? bar(G.workerBar, 1 - L.worker.left / L.worker.total) : "");
  cover.toggleAttribute("data-off", !!L.cfg.worker);
  const r = L.running;
  setKind("run", r && r.kind);
  setD(deskBar, r && r.total > 2 ? bar(G.DESK_STRIP, 1 - r.left / r.total) : "");
  const depth = stackDepth(r);
  frameEls.forEach((el, i) => { const show = i < depth ? "" : "none"; if (el.style.display !== show) el.style.display = show; });
  svg.toggleAttribute("data-flash", L.flash > 0);
  svg.toggleAttribute("data-gate", L.micro.length > 0 || !!(L.running && L.running.kind === "promise"));
  const D = G.dial, hand = (turn, r0, r1) => { const a = turn * Math.PI * 2; return [[D.x - Math.sin(a) * r0, D.y + Math.cos(a) * r0], [D.x + Math.sin(a) * r1, D.y - Math.cos(a) * r1]]; };
  const [n0, n1] = hand((L.t % 100) / 100, 2.4, D.r - 3.2);
  setD(needle, lineOnTop(n0, n1, D.z + 0.2, P));
  dueEls.forEach((el, i) => {
    const tm = timers[i];
    if (!tm) { if (el.style.display !== "none") el.style.display = "none"; return; }
    const [, p] = hand((tm.due % 100) / 100, 0, D.r - 5.2), [x, y] = iso([p[0], p[1], D.z], P);
    el.setAttribute("cx", x.toFixed(1)); el.setAttribute("cy", y.toFixed(1)); el.style.display = "";
  });
  showStats();
  if (puzzle && puzzle.order.length) {
    say(puzzle.order.map((x, i) => (i + 1) + ". " + x).join(" · "));
    if (puzzle.order.length === 3 && L.t > puzzle.until) puzzle = null;
  } else if (!puzzle) {
    const waiting = L.macro.length + " on the conveyor · " + L.micro.length + " in the tray";
    say(r ? r.label + (r.total > 2 ? " · " + Math.ceil(r.left) + " ms left" : "") + " · " + waiting : "idle · " + waiting);
  }
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function showStats() {
  const s = loop.stats, span = loop.t - s.since;
  const put = (k, v) => { if (statEls[k].textContent !== v) statEls[k].textContent = v; };
  put("busy", span > 20 ? Math.round((100 * s.busy) / span) + "%" : "–");
  put("late", s.timers ? msText(s.lateMax) : "–");
  put("gap", span > 40 ? msText(Math.max(s.gapMax, loop.t - loop.lastFrame)) : "–");
  put("io", s.ioDone ? msText(s.ioWaitSum / s.ioDone) : "–");
  put("job", s.jobs ? msText(s.lastJob) : "–");
  put("queue", String(loop.macro.length + loop.micro.length));
}

function runPuzzle() {
  const L = loop;
  const order = [];
  puzzle = { order, until: L.t + 60 };
  L.macro.unshift(task(L, "io", "script", 3, () => {
    armTimer(L, 0, "setTimeout 0", () => order.push("setTimeout(0) callback"));
    L.micro.unshift(task(L, "promise", "promise.then", 1, () => order.push("Promise.then callback")));
    order.push("console.log in the script");
  }));
  say("script queued at the front of the conveyor");
}

const pauseBtn = document.querySelector('[data-act="pause"]');
const clock = WB.loop({ stage, step: (dt) => { advance(loop, dt * cfg.speed * MS_PER_SECOND); paint(); }, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });
clock.setPaused(clock.paused);
function resetCounts() { resetStats(loop); showStats(); }
function set(name, raw) {
  if (name === "speed") cfg.speed = Number(raw);
  else if (name === "job" || name === "delay") { cfg[name] = Number(raw); loop.cfg[name] = Number(raw); if (name === "job") loop.nextCycle = Math.min(loop.nextCycle, loop.t + 20); resetCounts(); }
  else { cfg[name] = raw === "true" || raw === true; loop.cfg[name] = cfg[name]; if (name === "flood" && cfg.flood) loop.nextCycle = Math.min(loop.nextCycle, loop.t + 20); resetCounts(); }
  WB.pressSeg(name, raw);
}
WB.onSegments(set);
document.querySelector('[data-act="reset"]').addEventListener("click", resetCounts);
document.querySelector('[data-act="puzzle"]').addEventListener("click", () => { runPuzzle(); if (clock.paused) clock.setPaused(false); });
pauseBtn.addEventListener("click", () => clock.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); clock.toggle(); } });

// ---------- experiments ----------
const ms = (v) => msText(v);
const RUNS = {
  long: () => {
    const a = measure({ job: 0 }), b = measure({ job: 200 });
    const top = Math.max(a.lateMax, b.lateMax, a.gapMax, b.gapMax) * 1.05;
    return { verdict: "With the 200 ms job, the 10 ms timer ran up to " + ms(b.lateMax) + " late (" + ms(a.lateMax) + " without it), and the longest gap between frames grew from " + ms(a.gapMax) + " to " + ms(b.gapMax) + ".",
      bars: [["Timer late, no job", a.lateMax / top, ms(a.lateMax)], ["Timer late, 200 ms job", b.lateMax / top, ms(b.lateMax), true], ["Frame gap, no job", a.gapMax / top, ms(a.gapMax)], ["Frame gap, 200 ms job", b.gapMax / top, ms(b.gapMax), true]] };
  },
  order: () => {
    const o = orderPuzzle();
    return { verdict: "The order was: " + o.join(", then ") + ".", bars: o.map((x, i) => [(i + 1) + ". " + x.split(" ")[0], 1 - i / 3, ["1st", "2nd", "3rd"][i], i === 0]) };
  },
  flood: () => {
    const a = measure({ job: 0 }), b = measure({ job: 0, flood: true });
    const top = Math.max(a.ioWaitMax, b.ioWaitMax, a.gapMax, b.gapMax) * 1.05;
    return { verdict: "While the chain ran, I/O callbacks waited up to " + ms(b.ioWaitMax) + " (" + ms(a.ioWaitMax) + " without it), and the longest gap between frames was " + ms(b.gapMax) + ".",
      bars: [["I/O wait, no chain", a.ioWaitMax / top, ms(a.ioWaitMax)], ["I/O wait, promise chain", b.ioWaitMax / top, ms(b.ioWaitMax), true], ["Frame gap, no chain", a.gapMax / top, ms(a.gapMax)], ["Frame gap, promise chain", b.gapMax / top, ms(b.gapMax), true]] };
  },
  chunk: () => {
    const a = measure({ job: 200 }), b = measure({ job: 200, chunk: true });
    const gt = Math.max(a.gapMax, b.gapMax) * 1.05, jt = Math.max(a.jobAvg, b.jobAvg) * 1.05;
    return { verdict: "In 5 ms chunks, the longest frame gap fell from " + ms(a.gapMax) + " to " + ms(b.gapMax) + ", and the job took " + ms(b.jobAvg) + " instead of " + ms(a.jobAvg) + ".",
      bars: [["Frame gap, one block", a.gapMax / gt, ms(a.gapMax)], ["Frame gap, chunked", b.gapMax / gt, ms(b.gapMax), true], ["Job time, one block", a.jobAvg / jt, ms(a.jobAvg)], ["Job time, chunked", b.jobAvg / jt, ms(b.jobAvg), true]] };
  },
  worker: () => {
    const a = measure({ job: 200 }), b = measure({ job: 200, worker: true });
    const gt = Math.max(a.gapMax, b.gapMax) * 1.05, jt = Math.max(a.jobAvg, b.jobAvg) * 1.05;
    return { verdict: "With a worker, the longest frame gap was " + ms(b.gapMax) + " (" + ms(a.gapMax) + " on the main thread), and the job took " + ms(b.jobAvg) + " instead of " + ms(a.jobAvg) + ".",
      bars: [["Frame gap, main thread", a.gapMax / gt, ms(a.gapMax)], ["Frame gap, worker", b.gapMax / gt, ms(b.gapMax), true], ["Job time, main thread", a.jobAvg / jt, ms(a.jobAvg)], ["Job time, worker", b.jobAvg / jt, ms(b.jobAvg), true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  if (w.puzzle) { set("job", 0); set("flood", "false"); set("worker", "false"); set("chunk", "false"); setTimeout(runPuzzle, 800); }
  else for (const k of ["job", "chunk", "worker", "flood", "delay"]) set(k, String(w[k]));
  if (cfg.speed > 1) set("speed", 1);
  if (clock.paused) clock.setPaused(false);
} });

paint();
`;

const size = writePage(new URL("./event-loop-workbench.html", import.meta.url), {
  title: "Event Loop Workbench",
  eyebrow: "Systems lesson 16 · The event loop",
  lede: "JavaScript runs your code on one thread, one task at a time. Everything else, from timers to network replies to drawing the screen, waits for that one thread to be free. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
  machine: { intro: "One operator stands at the desk, which is the call stack. The conveyor feeding it is the macrotask queue, and the tray at the operator's hand is the microtask queue. Everything behind the partition happens in the background. Watch a few jobs go through, then make one job long and see whether the lamp keeps blinking.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the figure, averaged over four 3-second runs of loop time.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote event-loop-workbench.html", (size / 1024).toFixed(0) + " KB");

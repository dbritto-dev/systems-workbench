// Systems lesson 13 · Concurrency. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, rigSvg, plateStack, knobPointer, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "waiting",
    title: "Dishes that mostly simmer",
    change: "4 dishes, each 3 s of stirring and 70% simmering · one at a time → switch when a pan starts simmering",
    question: "How much sooner is everything served?",
    options: ["A little: the cook still does the same 12 s of stirring", "Far sooner: under half the time", "Not at all: one cook can only do one thing at a time"],
    answer: 1,
    why: "One at a time, the cook stands beside each pan while it simmers, so most of the run is waiting. Switching lets the cook stir another pan during every simmer. The stirring work is the same; what disappears is the idle standing. This is what concurrency buys: overlapping the waits of many tasks with one worker.",
    watch: { pans: 4, wait: 0.7, policy: "wait", slice: 1, cost: 0.3, stockpot: false },
  },
  {
    id: "busy",
    title: "Dishes that never simmer",
    change: "4 dishes, each 3 s of nonstop stirring · one at a time → round robin, 1 s each",
    question: "Does taking turns help when there is no waiting at all?",
    options: ["Yes: everything is done sooner", "No: the total is the same and so is each dish", "No: everything takes longer, and every dish finishes later"],
    answer: 2,
    why: "With no waits to fill, there is nothing to overlap. The cook still stirs 12 s in total, plus every switch between pans, so the whole batch takes longer. Worse, one at a time serves the first dish after 3 s; taking turns keeps every dish half-done until near the end. Concurrency helps with waiting, not with work.",
    watch: { pans: 4, wait: 0, policy: "rr", slice: 1, cost: 0.3, stockpot: false },
  },
  {
    id: "slice",
    title: "A very short turn",
    change: "Round robin, 4 nonstop dishes, switching costs 0.3 s · turns of 3 s → 0.3 s",
    question: "What share of the cook's time goes on moving between pans?",
    options: ["Around a tenth", "Around half", "None: shorter turns are just fairer"],
    answer: 1,
    why: "Each turn is followed by a switch. When a turn is as short as a switch, the cook spends as long moving as stirring, so half the time is overhead and the batch takes about twice as long. Operating systems face the same trade-off: short time slices feel responsive but each context switch costs time and cache.",
    watch: { pans: 4, wait: 0, policy: "rr", slice: 0.3, cost: 0.3, stockpot: false },
  },
  {
    id: "fair",
    title: "One huge stew",
    change: "A 12 s stew and four 1 s dishes, all nonstop, stew first in line · finish each step before moving → round robin, 1 s turns",
    question: "What happens to the four small dishes?",
    options: ["They come out far sooner with round robin", "About the same either way", "Later with round robin, because of all the switching"],
    answer: 0,
    why: "Without turns, the stew holds the cook for 12 s and every small dish waits behind it (head-of-line blocking). With 1 s turns the cook finishes each small dish on its first visit. The stew itself is served later, and the batch takes a little longer, but the short jobs stop paying for the long one. That is why schedulers preempt.",
    watch: { pans: 5, wait: 0, policy: "rr", slice: 1, cost: 0.3, stockpot: true },
  },
  {
    id: "pans",
    title: "More pans on the stove",
    change: "Keep every pan busy, 70% simmering · 4 pans → 8 pans",
    question: "What happens to dishes served per minute, and to the time each dish takes?",
    options: ["Twice as many dishes per minute", "About the same per minute, but each dish takes about twice as long", "Fewer per minute, because the cook is overloaded"],
    answer: 1,
    why: "With 4 pans the cook is already busy all the time, stirring or moving. Extra pans add nothing the cook can serve; they only queue for the cook, so each dish waits longer. Dishes in progress = dishes per minute × time per dish (Little's law): with the rate fixed, twice the pans means twice the time.",
    watch: { pans: 8, wait: 0.7, policy: "wait", slice: 1, cost: 0.3, stockpot: false },
  },
];

const QUESTIONS = [
  ["What is the difference between concurrency and parallelism, in terms of the cook?",
    "Concurrency is one cook keeping several dishes in progress by switching between them. Parallelism is several cooks stirring at the same instant. Concurrency is about structure (dealing with many things at once); parallelism is about execution (doing many things at once)."],
  ["When does interleaving with one worker make things faster, and when does it make them slower?",
    "Faster when tasks spend time waiting (simmering, I/O, network), because the waits can overlap with other work. Slower when tasks are pure work, because nothing overlaps and every switch adds cost."],
  ["A teammate halves the time slice \"to make the app more responsive\". What do you check first?",
    "How much a switch costs compared with the slice. If switching is close to the slice length, most of the time goes on overhead and total throughput drops. Responsiveness for short tasks improves, but only up to the point where switching dominates."],
  ["Why can one long task make many short tasks slow, and what fixes it?",
    "Without preemption, the short tasks queue behind the long one (head-of-line blocking). Time slices (preemption), a separate queue or priority for short work, or splitting the long task into chunks all let short tasks through."],
  ["You raise concurrency from 4 to 8 and throughput doesn't move. What does that tell you?",
    "The worker is already saturated; the bottleneck is the worker, not the number of tasks in flight. Extra concurrency only adds queueing, so latency rises (Little's law). Find the bottleneck or add workers instead."],
  ["Where do you see this one-worker pattern in real systems?",
    "A Node.js or Python asyncio process interleaving requests on one thread; a single database connection multiplexing queries; an OS scheduling many threads on one core; a goroutine scheduler. The same trade-offs apply: overlap waits, pay for switches, beware long tasks."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Range and stirring head",
  keys: [
    { mark: "lit", label: "The cook: one stirring head, one pan at a time" },
    { mark: "raised", label: "Pans: a lid means simmering, a ticket means waiting for the cook" },
    { mark: "flat", label: "Knobs: each pan's simmer timer" },
  ],
  caption:
    "Each dish needs the cook for its stirring steps and nobody while it simmers. The single head on the gantry is the only worker: it stirs one pan, then travels to the next, and every trip costs time. Served dishes pile up on the pass at the right.",
  stage: 'data-kitchen aria-label="Kitchen simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const controls = panel({
  stats: [["done", "Served"], ["rate", "Per minute", "–"], ["time", "Time per dish", "–"], ["cooking", "Stirring", "–"], ["switching", "Moving", "–"], ["idle", "Idle", "–"]],
  controls: [
    seg("pans", "Pans", [[1, "1"], [2, "2"], [4, "4"], [5, "5"], [8, "8"]], 4),
    seg("wait", "Simmering", [[0, "0%"], [0.4, "40%"], [0.7, "70%"]], 0.7),
    seg("policy", "Cook", [["seq", "One at a time"], ["wait", "Switch when it simmers"], ["rr", "Take turns"]], "wait"),
    seg("slice", "Turn length", [[0.3, "0.3 s"], [1, "1 s"], [3, "3 s"]], 1),
    seg("cost", "Moving costs", [[0.1, "0.1 s"], [0.3, "0.3 s"], [1, "1 s"]], 0.3),
    seg("stockpot", "First pan", [["false", "Normal"], ["true", "Big stew"]], "false"),
    speedSeg(),
    actions("Do something", [["reset", "Start over"], ["pause", "Pause"]]),
  ],
}).replace('</div>\n</div>', '</div>\n  <p class="note">Changing a setting starts the kitchen over. "Turn length" only matters when the cook takes turns.</p>\n</div>');

const css = `
.pan[data-off]{display:none}
.pan [data-variant][data-off]{display:none}
.lid,.ticket{transition:opacity .18s var(--anatomy-ease)}
.lid[data-off],.ticket[data-off]{opacity:0}
.panel .note{padding:0 12px 12px;margin:0}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, options, watch }) => ({ id, answer, options, watch })))};
const rigSvg = ${rigSvg.toString().replace(/k\./g, "")};
const plateStack = ${plateStack.toString().replace(/k\./g, "")};
const knobPointer = ${knobPointer.toString().replace(/k\./g, "")};
const S = (paths, style) => solidSvg(paths, style);
const L = (d, style) => lineSvg(d, style);
const D = (points, style) => dotsSvg(points, style);
const at = (p) => iso(p, P);
const RAIL = { x: -138, y: -92, w: 276, d: 8, r: 1.5 }, RAIL_TOP = G.RAIL_TOP, PASS_TOP = 6, PLATE_AT = [146, 34], KNOB_R = 5.5, KNOB_TOP = 38;

const stage = document.querySelector("[data-kitchen]");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const panEls = G.PANS.map((_, i) => svg.querySelector('[data-pan="' + i + '"]'));
const pointerEls = G.PANS.map((_, i) => svg.querySelector('[data-pointer="' + i + '"]'));
const rigEl = svg.querySelector("[data-rig]");
const platesEl = svg.querySelector("[data-plates]");
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
const say = (t) => { if (readout.textContent !== t) readout.textContent = t; };

const cfg = { pans: 4, wait: 0.7, policy: "wait", slice: 1, cost: 0.3, stockpot: false, speed: 1 };
let K, acc = 0, stirAngle = 0, tip = G.PAN_TOP + 22, platesShown = -1, statTimer = 0;
const topOf = (i) => (cfg.stockpot && i === 0 ? G.POT_TOP : G.PAN_TOP);
const center = (i) => (i === null || i === undefined ? G.PARK : [G.PANS[i].x, G.PANS[i].y]);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function reset() {
  K = createKitchen({ pans: cfg.pans, waitShare: cfg.wait, active: 3, policy: cfg.policy, slice: cfg.slice, switchCost: cfg.cost, stockpot: cfg.stockpot, mode: "continuous", seed: (Date.now() % 1e6) + 1 });
  acc = 0; platesShown = -1;
  panEls.forEach((el, i) => {
    el.toggleAttribute("data-off", i >= cfg.pans);
    const pan = el.querySelector('[data-variant="pan"]'), pot = el.querySelector('[data-variant="pot"]');
    if (pot) { pan.toggleAttribute("data-off", cfg.stockpot); pot.toggleAttribute("data-off", !cfg.stockpot); }
  });
  paint(0); showStats();
}

function advance(dt) {
  acc += dt;
  let n = Math.min(4000, Math.floor(acc / DT));
  acc -= n * DT;
  while (n-- > 0) step(K);
}

const kindOfPan = (pan) => (pan.state === "done" ? "done" : pan.dish.phases[pan.phase].kind);

function paint(dt) {
  K.pans.forEach((pan, i) => {
    const el = panEls[i];
    const variant = el.querySelector(cfg.stockpot && i === 0 ? '[data-variant="pot"]' : '[data-variant="pan"]');
    const kind = kindOfPan(pan);
    variant.querySelector("[data-lid]").toggleAttribute("data-off", kind !== "wait");
    variant.querySelector("[data-ticket]").toggleAttribute("data-off", !isReady(K, pan));
    const ph = pan.dish.phases[pan.phase];
    const share = kind === "wait" && ph ? Math.max(0, pan.left / ph.t) : 0;
    const [kx, ky] = G.KNOBS[i];
    pointerEls[i].setAttribute("d", knobPointer(kx, ky, share));
  });
  for (let i = K.pans.length; i < 8; i++) pointerEls[i].setAttribute("d", "");
  const c = K.cook;
  let pos, want, lit = false, stir = [0, 0];
  if (c.mode === "switch") {
    const p = ease(Math.min(1, Math.max(0, 1 - c.left / cfg.cost)));
    const a = center(c.at), b = center(c.target);
    pos = [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p];
    want = Math.max(topOf(c.at ?? 1), topOf(c.target)) + 22;
  } else if (c.mode === "work") {
    pos = center(c.at); want = topOf(c.at) + 0.8; lit = true;
    stirAngle += dt * 9;
    stir = [Math.cos(stirAngle) * 6, Math.sin(stirAngle) * 6];
  } else if (c.mode === "hold") {
    pos = center(c.at); want = topOf(c.at) + 12;
  } else {
    pos = center(c.at); want = (c.at === null ? G.PAN_TOP : topOf(c.at)) + 22;
  }
  tip += (want - tip) * (1 - Math.exp(-dt * 14));
  if (dt === 0) tip = want;
  rigEl.innerHTML = rigSvg(pos[0], pos[1], tip, lit, stir);
  const plates = K.done.length % 9;
  if (plates !== platesShown) { platesShown = plates; platesEl.innerHTML = plateStack(plates); }
  const waiting = K.pans.filter((p) => isReady(K, p)).length;
  const simmering = K.pans.filter((p) => kindOfPan(p) === "wait").length;
  const n = (i) => "pan " + (i + 1);
  if (c.mode === "work") say("stirring " + n(c.at) + " · " + waiting + " waiting for the cook · " + simmering + " simmering");
  else if (c.mode === "switch") say("moving to " + n(c.target) + " · " + waiting + " waiting");
  else if (c.mode === "hold") say("standing at " + n(c.at) + " while it simmers · " + waiting + " waiting");
  else say("idle · every pan is simmering");
}

const pct = (x) => Math.round(100 * x) + "%";
function showStats() {
  const s = stats(K);
  statEls.done.textContent = s.done;
  statEls.rate.textContent = s.done ? s.perMinute.toFixed(1) : "–";
  statEls.time.textContent = s.done ? s.avgTime.toFixed(1) + " s" : "–";
  statEls.cooking.textContent = K.now > 0.5 ? pct(s.cooking) : "–";
  statEls.switching.textContent = K.now > 0.5 ? pct(s.switching) : "–";
  statEls.idle.textContent = K.now > 0.5 ? pct(s.idle) : "–";
}

const pauseBtn = document.querySelector('[data-act="pause"]');
const clock = WB.loop({ stage, step: (dt) => {
  advance(dt * cfg.speed); paint(dt * cfg.speed);
  statTimer += dt; if (statTimer > 0.25) { statTimer = 0; showStats(); }
}, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });
clock.setPaused(clock.paused);

function set(name, raw) {
  if (name === "speed") { cfg.speed = Number(raw); WB.pressSeg(name, raw); return; }
  if (name === "pans") cfg.pans = Number(raw);
  if (name === "wait") cfg.wait = Number(raw);
  if (name === "policy") cfg.policy = raw;
  if (name === "slice") cfg.slice = Number(raw);
  if (name === "cost") cfg.cost = Number(raw);
  if (name === "stockpot") cfg.stockpot = raw === true || raw === "true";
  WB.pressSeg(name, raw);
  reset();
}
WB.onSegments(set);
document.querySelector('[data-act="reset"]').addEventListener("click", reset);
pauseBtn.addEventListener("click", () => clock.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); clock.toggle(); } });

// ---------- experiments ----------
const fmt = (x) => x.toFixed(1) + " s";
const four = (active, waitShare) => Array.from({ length: 4 }, () => ({ active, waitShare }));
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const RUNS = {
  waiting: () => {
    const a = runBatch({ dishes: four(3, 0.7), policy: "seq", switchCost: 0.3 }), b = runBatch({ dishes: four(3, 0.7), policy: "wait", switchCost: 0.3 });
    const top = a.total * 1.05;
    return { verdict: "All four served in " + fmt(a.total) + " one at a time, " + fmt(b.total) + " switching while pans simmer: " + Math.round(100 * (1 - b.total / a.total)) + "% less. The cook was idle " + pct(a.idle) + " of the time one at a time, " + pct(b.idle) + " switching.",
      bars: [["One at a time", a.total / top, fmt(a.total)], ["Switch on simmer", b.total / top, fmt(b.total), true]] };
  },
  busy: () => {
    const a = runBatch({ dishes: four(3, 0), policy: "seq", switchCost: 0.3 }), b = runBatch({ dishes: four(3, 0), policy: "rr", slice: 1, switchCost: 0.3 });
    const top = Math.max(a.total, b.total) * 1.05;
    return { verdict: "Total " + fmt(a.total) + " one at a time vs " + fmt(b.total) + " taking turns. The average dish came out at " + fmt(avg(a.finish)) + " vs " + fmt(avg(b.finish)) + ".",
      bars: [["One at a time: all", a.total / top, fmt(a.total)], ["Taking turns: all", b.total / top, fmt(b.total), true], ["One at a time: avg dish", avg(a.finish) / top, fmt(avg(a.finish))], ["Taking turns: avg dish", avg(b.finish) / top, fmt(avg(b.finish)), true]] };
  },
  slice: () => {
    const a = runBatch({ dishes: four(3, 0), policy: "rr", slice: 3, switchCost: 0.3 }), b = runBatch({ dishes: four(3, 0), policy: "rr", slice: 0.3, switchCost: 0.3 });
    return { verdict: "Moving took " + pct(a.switching) + " of the cook's time with 3 s turns and " + pct(b.switching) + " with 0.3 s turns; the batch went from " + fmt(a.total) + " to " + fmt(b.total) + ".",
      bars: [["3 s turns", a.switching, pct(a.switching)], ["0.3 s turns", b.switching, pct(b.switching), true]] };
  },
  fair: () => {
    const mix = [{ active: 12, waitShare: 0 }, ...Array.from({ length: 4 }, () => ({ active: 1, waitShare: 0 }))];
    const a = runBatch({ dishes: mix, policy: "wait", switchCost: 0.3 }), b = runBatch({ dishes: mix, policy: "rr", slice: 1, switchCost: 0.3 });
    const sa = avg(a.finish.slice(1)), sb = avg(b.finish.slice(1));
    const top = Math.max(a.finish[0], b.finish[0], sa, sb) * 1.05;
    return { verdict: "The small dishes came out at " + fmt(sa) + " on average without turns and " + fmt(sb) + " with 1 s turns. The stew went from " + fmt(a.finish[0]) + " to " + fmt(b.finish[0]) + ".",
      bars: [["Small, no turns", sa / top, fmt(sa)], ["Small, 1 s turns", sb / top, fmt(sb), true], ["Stew, no turns", a.finish[0] / top, fmt(a.finish[0])], ["Stew, 1 s turns", b.finish[0] / top, fmt(b.finish[0]), true]] };
  },
  pans: () => {
    const base = { waitShare: 0.7, active: 3, policy: "wait", switchCost: 0.3 };
    const r2 = runSteady({ ...base, pans: 2 }), r4 = runSteady({ ...base, pans: 4 }), r8 = runSteady({ ...base, pans: 8 });
    const rt = Math.max(r2.perMinute, r4.perMinute, r8.perMinute) * 1.1, tt = r8.avgTime * 1.1;
    return { verdict: "Per minute: " + r4.perMinute.toFixed(1) + " with 4 pans, " + r8.perMinute.toFixed(1) + " with 8. Time per dish: " + fmt(r4.avgTime) + " → " + fmt(r8.avgTime) + ". With 4 pans the cook was idle " + pct(r4.idle) + " of the time.",
      bars: [["2 pans: per min", r2.perMinute / rt, r2.perMinute.toFixed(1)], ["4 pans: per min", r4.perMinute / rt, r4.perMinute.toFixed(1)], ["8 pans: per min", r8.perMinute / rt, r8.perMinute.toFixed(1), true], ["4 pans: per dish", r4.avgTime / tt, fmt(r4.avgTime)], ["8 pans: per dish", r8.avgTime / tt, fmt(r8.avgTime), true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  for (const [name, value] of Object.entries({ pans: w.pans, wait: w.wait, policy: w.policy, slice: w.slice, cost: w.cost, stockpot: String(w.stockpot) })) { cfg[name] = name === "policy" ? value : name === "stockpot" ? value === "true" : Number(value); WB.pressSeg(name, value); }
  reset();
  if (clock.paused) clock.setPaused(false);
} });

reset();
`;

const size = writePage(new URL("./concurrency-workbench.html", import.meta.url), {
  title: "Concurrency Workbench",
  eyebrow: "Systems lesson 13 · Concurrency",
  lede: "Concurrency is one worker keeping many tasks in progress by switching between them. It hides waiting, but it never adds a second pair of hands. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
  machine: { intro: "One stirring head serves every pan on the range. Watch it move to whichever pan is waiting, then change how many pans there are, how much they simmer and how the cook picks the next one.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same kitchen model the figure runs, timed to the hundredth of a second.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote concurrency-workbench.html", (size / 1024).toFixed(0) + " KB");

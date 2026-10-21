// Systems lesson 15 · Async I/O. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "threads",
    title: "Four waiters or one",
    change: "100 orders · each waits 200 ms in the kitchen · 4 blocking threads vs 1 async waiter",
    question: "Which finishes the 100 orders faster?",
    options: ["The 4 blocking threads: four pairs of hands beat one", "About the same: the kitchen takes 200 ms either way", "The single async waiter, by several times"],
    answer: 2,
    why: "A blocking thread spends almost all of its time standing at the window. Four threads can only have four orders in the kitchen at once, so 100 orders take 25 rounds of 200 ms. The async waiter clips a ticket on the rail and goes straight back for the next order, so the kitchen gets all 32 burners busy. Waiting doesn't need a pair of hands, only a ticket.",
    watch: { mode: "blocking", threads: 4, n: 20, cpu: 2, io: 200, gather: "gather", limit: 0, block: 0 },
  },
  {
    id: "cpu",
    title: "Orders that need real work",
    change: "100 orders · 40 ms of CPU each, 10 ms in the kitchen · 4 blocking threads vs 1 async waiter",
    question: "Now most of the time is spent working, not waiting. Which is faster?",
    options: ["The async waiter, by several times", "About the same: the hands are busy the whole time", "The blocking threads, by several times"],
    answer: 1,
    why: "Async only removes waiting. Here every order needs 40 ms of hands-on work, and there is one pair of hands (one CPU core), so 100 orders take about 4 seconds however you schedule them. To go faster you need more cores working at the same time: parallelism, which is a different tool (lesson 14).",
    watch: { mode: "async", threads: 4, n: 20, cpu: 40, io: 10, gather: "gather", limit: 0, block: 0 },
  },
  {
    id: "loop",
    title: "Await in a loop",
    change: "20 orders · async · `for … await` one by one vs `Promise.all` / `asyncio.gather`",
    question: "How much faster is gathering them?",
    options: ["About the same: it's the same code, just async", "About twice as fast", "More than ten times as fast"],
    answer: 2,
    why: "Awaiting inside a loop sends one order, waits for it to come back, then sends the next: async syntax, sequential behaviour. Gathering puts all 20 tickets on the rail at once, so they cook side by side and the batch takes about one kitchen trip. Await in a loop is right only when each call needs the previous result.",
    watch: { mode: "async", n: 20, cpu: 2, io: 200, gather: "sequential", limit: 0, block: 0 },
  },
  {
    id: "limit",
    title: "Gather a thousand",
    change: "1,000 orders · gather all at once vs at most 20 in flight · the kitchen has 32 burners, calls time out after 2 s",
    question: "Which way gets more orders delivered?",
    options: ["All at once: no waiting to start", "At most 20 at a time: everything is delivered, all at once loses most", "Both deliver all 1,000"],
    answer: 1,
    why: "Gathering everything floods the kitchen: 32 burners serve about 160 orders a second, so the queue grows by hundreds and most orders wait past the 2 s timeout and fail, after the kitchen did part of the work. A semaphore keeps no more in flight than the kitchen can cook, so nothing times out. The right limit is about the dependency's capacity, not your own.",
    watch: { mode: "async", n: 1000, cpu: 2, io: 200, gather: "gather", limit: 0, block: 0 },
  },
  {
    id: "block",
    title: "One blocking call",
    change: "100 orders · async · each handler also reads a file synchronously for 15 ms",
    question: "What happens to the batch?",
    options: ["Nothing much: 15 ms is tiny next to 200 ms in the kitchen", "Everything slows: the waiter is frozen 15 ms per order, and ready dishes sit at the bell", "Only the orders that read the file wait"],
    answer: 1,
    why: "A synchronous call inside async code blocks the only pair of hands. While the waiter reads, nobody takes orders and nobody answers the bell, so 100 reads add 1.5 seconds of frozen time for everyone and finished dishes wait over a second to be picked up. Use the async version of the call, or hand it to a worker thread.",
    watch: { mode: "async", n: 100, cpu: 2, io: 200, gather: "gather", limit: 0, block: 15 },
  },
];

const QUESTIONS = [
  ["Why does one async waiter deliver more than four blocking threads when the work is mostly waiting?",
    "A blocking thread is occupied for the whole wait, so throughput is threads ÷ time per order. Async keeps many orders in flight with one thread: it only needs a ticket per wait, not a thread, so throughput is limited by how many calls the dependency can handle at once."],
  ["When does async not help, and what do you use instead?",
    "When the work is CPU-bound: there is nothing to overlap, the core is busy the whole time. You need parallelism (more cores: processes, worker threads) or less work per request (caching, better algorithms)."],
  ["`for (const id of ids) await fetchUser(id)` is slow. When is that loop still the right choice?",
    "When each call depends on the previous result, when order matters, or when the other side can only take one at a time. Otherwise gather them, with a limit."],
  ["What can go wrong with `Promise.all` over 10,000 items, and how do you fix it?",
    "Every call starts at once: the dependency gets flooded, calls time out, retries add more load, and memory grows with every pending call. Bound it with a semaphore or a pool (p-limit, asyncio.Semaphore, a worker pool) sized to what the dependency can serve."],
  ["Someone adds `fs.readFileSync`, `time.sleep` or a synchronous HTTP client inside an async handler. What happens in production?",
    "It blocks the event loop for every request, not just this one: no new requests are picked up and finished ones aren't handled until it returns. Latency rises for everyone. Use the async version or move the call to a thread pool (`asyncio.to_thread`, a worker thread)."],
  ["How would you pick the concurrency limit for calls to a database that holds 32 connections?",
    "Start from the dependency's capacity: about 32 in flight keeps it busy without queueing. Little's law gives the throughput: in-flight ÷ time per call, so 32 ÷ 0.2 s ≈ 160 calls a second. Then measure, and leave room for other clients sharing it."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Restaurant pass",
  keys: [
    { mark: "lit", label: "Waiting: tickets clipped on the rail, waiters holding an empty tray at the window, a waiter frozen in a blocking call, tags on the permit board" },
    { mark: "raised", label: "Order desk (left): the one CPU core, with the spike of orders not yet taken" },
    { mark: "flat", label: "Kitchen range (right): 32 burners, the dependency's capacity" },
  ],
  caption:
    "Each order needs a moment at the desk (CPU), a trip to the kitchen (I/O), and a moment to deliver. Blocking: each waiter stands at the window until the dish is ready. Async: one waiter clips a ticket on the rail and keeps working, and the bell calls them back. The permit board behind the desk has one slot per order allowed in flight; it is covered when there is no limit. Until you touch a control, the batches cycle through async, blocking threads, and async with at most 5 in flight. Time runs 10× slower than the numbers.",
  stage: 'data-pass aria-label="Restaurant pass simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const controls = panel({
  stats: [["time", "Batch time", "–"], ["rate", "Orders / s", "–"], ["done", "Delivered"], ["failed", "Timed out"], ["kitchen", "Max in kitchen"], ["bell", "Bell wait p95", "–"]],
  controls: [
    seg("mode", "Model", [["blocking", "Blocking threads"], ["async", "Async"]], "async"),
    seg("threads", "Threads", [[1, "1"], [4, "4"], [8, "8"]], 4),
    seg("gather", "Async calls", [["sequential", "Await in a loop"], ["gather", "Gather"]], "gather"),
    seg("limit", "In flight", [[0, "No limit"], [20, "20"], [5, "5"]], 0),
    seg("io", "Kitchen time", [[50, "50 ms"], [200, "200 ms"], [500, "500 ms"]], 200),
    seg("cpu", "CPU per order", [[2, "2 ms"], [20, "20 ms"], [40, "40 ms"]], 2),
    seg("block", "Blocking read", [[0, "None"], [15, "15 ms"]], 0),
    seg("n", "Orders", [[20, "20"], [100, "100"], [1000, "1,000"]], 20),
    speedSeg(),
    actions("Do something", [["restart", "New batch"], ["pause", "Pause"]]),
  ],
});

const css = `
[data-off]{display:none}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, options, watch }) => ({ id, answer, options, watch })))};
const SLOW = 10;

const stage = document.querySelector("[data-pass]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const qa = (s) => [...svg.querySelectorAll(s)];
const readout = document.querySelector("[data-readout]");
const say = (t) => { if (readout.textContent !== t) readout.textContent = t; };
const pots = qa("[data-pot]").sort((a, b) => a.dataset.pot - b.dataset.pot);
const queued = qa("[data-q]").sort((a, b) => a.dataset.q - b.dataset.q);
const rail = qa("[data-rail]").sort((a, b) => a.dataset.rail - b.dataset.rail);
const pending = qa("[data-p]").sort((a, b) => a.dataset.p - b.dataset.p);
const plates = qa("[data-d]").sort((a, b) => a.dataset.d - b.dataset.d);
const binned = qa("[data-f]").sort((a, b) => a.dataset.f - b.dataset.f);
const waiterBox = q("[data-waiters]");
const VARIANTS = ["idle", "wait", "carry", "frozen"];
const waiters = qa("[data-waiter]").sort((a, b) => a.dataset.waiter - b.dataset.waiter).map((el) => ({ el, v: Object.fromEntries(VARIANTS.map((n) => [n, el.querySelector('[data-v="' + n + '"]')])), x: 0, y: 0, placed: false, look: "idle" }));
const tags = qa("[data-tag]").sort((a, b) => a.dataset.tag - b.dataset.tag);
const cover = q("[data-cover]");
const blankRows = [q('[data-blank-row="1"]'), q('[data-blank-row="2"]')];
const bellSolids = qa("[data-bell] .iso-solid");
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));

const cfg = { mode: "async", threads: 4, n: 20, cpu: 2, io: 200, gather: "gather", limit: 0, block: 0, speed: 1 };
let run, simT = 0, hold = 0, seed = 1;
// Until someone touches a control, the machine tours: each new batch moves to the next of
// async, blocking threads, and async with at most 5 in flight.
let touring = true, tourAt = 0;
const TOUR = [{ mode: "async", limit: 0 }, { mode: "blocking", limit: 0 }, { mode: "async", limit: 5 }];
const PREROLL = 90; // ms of simulated time already run when a batch first appears, so a still frame shows a working pass
const show = (list, count) => list.forEach((el, i) => el.toggleAttribute("data-off", i >= count));
const fmt = (ms) => ms >= 1000 ? (ms / 1000).toFixed(2) + " s" : Math.round(ms) + " ms";

function restart() {
  run = createSim({ mode: cfg.mode, threads: cfg.threads, n: cfg.n, cpu: cfg.cpu, io: cfg.io, gather: cfg.gather, limit: cfg.limit, block: cfg.block, seed: seed++ });
  simT = PREROLL; hold = 0;
  run.advance(simT);
  waiters.forEach((w) => (w.placed = false));
  paint(0);
}

// Where waiter i stands and how it looks: idle, wait (lit, holding an empty tray at the window),
// carry (a plate on the tray, heading for the bell), frozen (lit, stuck in a blocking call).
function spotFor(i, th) {
  const S = G.SPOTS;
  const lane = (s) => [s[0] + i * s[2], s[1]];
  if (cfg.mode === "async") {
    const c = run.core;
    if (c && c.kind === "deliver") return { at: S.pickup, look: "carry" };
    if (c && c.kind === "error") return { at: S.pickup, look: "idle" };
    if (c && c.kind === "cpu") return { at: S.desk, look: c.split !== undefined && run.now - c.startAt > c.split ? "frozen" : "idle" };
    return { at: S.asyncHome, look: "idle" };
  }
  switch (th.state) {
    case "cpu": return { at: [S.desk[0] + i * 2, S.desk[1] - i * 3], look: "idle" };
    case "queued-cpu": return { at: lane(S.home), look: "idle" };
    case "waiting": return { at: lane(S.window), look: "wait" };
    case "reading": return { at: lane(S.home), look: "frozen" };
    case "deliver": return { at: [S.pickup[0] - i * 3, S.pickup[1] + 4], look: "carry" };
    case "error": return { at: [S.pickup[0] - i * 3, S.pickup[1] + 4], look: "idle" };
    default: return { at: lane(S.home), look: "idle" };
  }
}

function paint(dt) {
  const st = run.st;
  pots.forEach((el, i) => el.toggleAttribute("data-off", !run.burners[i]));
  show(queued, Math.min(run.queue.length, G.QUEUE_SHOWN));
  const onRail = cfg.mode === "async" ? run.orders.filter((o) => o.state === "queued" || o.state === "cooking").length : 0;
  show(rail, Math.min(onRail, G.RAIL_SHOWN));
  const waitingToStart = run.orders.filter((o) => o.state === "pending").length;
  show(pending, Math.min(waitingToStart, G.PENDING_SHOWN));
  show(plates, Math.min(st.done, G.DONE_SHOWN));
  show(binned, Math.min(st.failed, G.FAILED_SHOWN));
  const ringing = st.lastBell >= 0 && run.now - st.lastBell < 60;
  bellSolids.forEach((el) => el.toggleAttribute("data-lit", ringing));
  const limit = cfg.mode === "async" ? cfg.limit : 0;
  cover.toggleAttribute("data-off", limit > 0);
  blankRows[0].toggleAttribute("data-off", !(limit > 0 && limit <= 5));
  blankRows[1].toggleAttribute("data-off", !(limit > 0 && limit <= 10));
  show(tags, limit > 0 ? Math.min(run.inFlight, limit) : 0);

  const count = cfg.mode === "async" ? 1 : cfg.threads;
  const k = dt ? 1 - Math.exp(-dt / 0.12) : 1;
  waiters.forEach((w, i) => {
    w.el.toggleAttribute("data-off", i >= count);
    if (i >= count) return;
    const { at, look } = spotFor(i, run.threads[i]);
    if (!w.placed) { w.x = at[0]; w.y = at[1]; w.placed = true; }
    w.x += (at[0] - w.x) * k; w.y += (at[1] - w.y) * k;
    w.el.setAttribute("transform", translateAlong(P, [w.x, w.y, 0]));
    if (look !== w.look) { w.v[w.look].toggleAttribute("data-off", true); w.v[look].toggleAttribute("data-off", false); w.look = look; }
  });
  waiters.slice(0, count).sort((a, b) => (a.x * Math.cos(${(52 * Math.PI) / 180}) + a.y * Math.sin(${(52 * Math.PI) / 180})) - (b.x * Math.cos(${(52 * Math.PI) / 180}) + b.y * Math.sin(${(52 * Math.PI) / 180}))).forEach((w) => waiterBox.appendChild(w.el));

  const m = run.metrics();
  const elapsed = run.complete() ? m.total : run.now;
  statEls.time.textContent = elapsed > 0 ? fmt(elapsed) : "–";
  statEls.rate.textContent = elapsed > 0 ? (st.done / elapsed * 1000).toFixed(1) : "–";
  statEls.done.textContent = st.done;
  statEls.failed.textContent = st.failed;
  statEls.kitchen.textContent = st.maxInFlight;
  statEls.bell.textContent = st.bellWaits.length ? fmt(m.bellP95) : "–";

  const cooking = run.burners.filter(Boolean).length;
  if (run.complete()) say("batch done in " + fmt(m.total) + " · " + st.done + " delivered" + (st.failed ? " · " + st.failed + " timed out" : ""));
  else if (cfg.mode === "async") {
    const c = run.core;
    const doing = !c ? "waiter free" : c.kind === "cpu" ? (c.split !== undefined && run.now - c.startAt > c.split ? "waiter frozen on a blocking read" : "taking an order") : "delivering";
    say(onRail + " on the rail · " + cooking + " cooking · " + doing);
  } else {
    const atWindow = run.threads.filter((t) => t.state === "waiting").length;
    say(atWindow + " of " + cfg.threads + " waiters stuck at the window · " + cooking + " cooking");
  }
}

function step(dt) {
  if (run.complete()) {
    hold += dt;
    if (hold > 1.6) {
      if (touring) {
        tourAt = (tourAt + 1) % TOUR.length;
        for (const [name, value] of Object.entries(TOUR[tourAt])) { cfg[name] = value; WB.pressSeg(name, value); }
      }
      restart();
    }
    else paint(dt);
    return;
  }
  simT += (dt * 1000 * cfg.speed) / SLOW;
  run.advance(simT);
  paint(dt);
}

const pauseBtn = document.querySelector('[data-act="pause"]');
const clock = WB.loop({ stage, step, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });
clock.setPaused(clock.paused);
function set(name, raw) {
  touring = false;
  if (name === "speed") { cfg.speed = Number(raw); WB.pressSeg(name, raw); return; }
  cfg[name] = ["mode", "gather"].includes(name) ? raw : Number(raw);
  WB.pressSeg(name, raw);
  restart();
}
WB.onSegments(set);
document.querySelector('[data-act="restart"]').addEventListener("click", () => { touring = false; restart(); if (clock.paused) clock.setPaused(false); });
pauseBtn.addEventListener("click", () => clock.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); clock.toggle(); } });

// ---------- experiments ----------
const secs = (ms) => (ms / 1000).toFixed(2) + " s";
const RUNS = {
  threads: () => { const a = measure({ mode: "blocking", threads: 4, n: 100 }), b = measure({ mode: "async", n: 100 }); const top = Math.max(a.throughput, b.throughput) * 1.05;
    return { verdict: "4 blocking threads: " + a.throughput.toFixed(0) + " orders/s, done in " + secs(a.total) + ". One async waiter: " + b.throughput.toFixed(0) + " orders/s, done in " + secs(b.total) + " (" + (b.throughput / a.throughput).toFixed(1) + "× more).", bars: [["4 blocking threads", a.throughput / top, a.throughput.toFixed(0) + "/s"], ["1 async waiter", b.throughput / top, b.throughput.toFixed(0) + "/s", true]] }; },
  cpu: () => { const a = measure({ mode: "blocking", threads: 4, n: 100, cpu: 40, io: 10 }), b = measure({ mode: "async", n: 100, cpu: 40, io: 10 }); const top = Math.max(a.total, b.total) * 1.05;
    return { verdict: "4 blocking threads: " + secs(a.total) + ". One async waiter: " + secs(b.total) + ". The desk was busy " + Math.round(b.busy * 100) + "% of the time either way.", bars: [["4 blocking threads", a.total / top, secs(a.total)], ["1 async waiter", b.total / top, secs(b.total), true]] }; },
  loop: () => { const a = measure({ mode: "async", n: 20, gather: "sequential" }), b = measure({ mode: "async", n: 20 }); const top = Math.max(a.total, b.total) * 1.05;
    return { verdict: "Await in a loop: " + secs(a.total) + ". Gather: " + secs(b.total) + " (" + Math.round(a.total / b.total) + "× faster).", bars: [["Await in a loop", a.total / top, secs(a.total)], ["Gather", b.total / top, secs(b.total), true]] }; },
  limit: () => { const a = measure({ mode: "async", n: 1000 }), b = measure({ mode: "async", n: 1000, limit: 20 });
    return { verdict: "All at once: " + Math.round(a.done) + " delivered, " + (1000 - Math.round(a.done)) + " timed out, up to " + Math.round(a.maxInFlight) + " orders in the kitchen. At most 20 in flight: " + Math.round(b.done) + " delivered, none timed out, in " + secs(b.total) + ".", bars: [["All at once", a.done / 1000, Math.round(a.done) + " ok"], ["At most 20", b.done / 1000, Math.round(b.done) + " ok", true]] }; },
  block: () => { const a = measure({ mode: "async", n: 100 }), b = measure({ mode: "async", n: 100, block: 15 }); const top = Math.max(a.total, b.total) * 1.05;
    return { verdict: "Without the read: " + secs(a.total) + ", dishes picked up within " + Math.round(a.bellP95) + " ms (p95). With a 15 ms blocking read: " + secs(b.total) + ", and ready dishes waited " + secs(b.bellP95) + " at the bell (p95).", bars: [["No blocking read", a.total / top, secs(a.total)], ["15 ms blocking read", b.total / top, secs(b.total), true]] }; },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  touring = false;
  for (const [name, value] of Object.entries(w)) { cfg[name] = value; WB.pressSeg(name, value); }
  restart();
  if (clock.paused) clock.setPaused(false);
} });

restart();
`;

const size = writePage(new URL("./async-workbench.html", import.meta.url), {
  title: "Async Workbench",
  eyebrow: "Systems lesson 15 · Async I/O",
  lede: "Async I/O lets one worker start many slow operations and handle each result when it is ready, instead of standing still while it waits. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
  machine: { intro: "The desk is the CPU, the kitchen is a slow dependency with 32 burners, and the rail holds orders that are waiting. Switch between blocking threads and async, then change how the calls are made and watch the counters.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results are averaged over six seeded runs of the same model the figure runs.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote async-workbench.html", (size / 1024).toFixed(0) + " KB");

// Systems lesson 14 · Parallelism. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, pawnSvg, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const BASE = { workers: 8, cores: 8, serial: 0.1, chunks: 8, tool: false, job: "big", data: "even" };
const EXPERIMENTS = [
  {
    id: "amdahl",
    title: "Eight workers",
    change: "1 → 8 workers on 8 benches · 10% of the job is packing, which only one station can do",
    question: "How much faster does a job finish?",
    options: ["About 8× faster: eight workers, eight benches", "About 4× faster", "About 2× faster"],
    answer: 1,
    why: "Only the parallel part gets eight times faster. The 10% at the packing station still takes as long as before, so it soon dominates: Amdahl's law caps 10% serial work on 8 cores at 4.7×, and handing out and merging chunks costs a little more. No number of workers can beat 10× here, because the serial part alone takes a tenth of the original time.",
    watch: { ...BASE },
  },
  {
    id: "oversub",
    title: "More workers than benches",
    change: "8 → 16 workers · still 8 benches (cores) · job split into 16 chunks",
    question: "What happens to the job time?",
    options: ["It halves: twice the workers", "Nothing gets faster; it's slightly slower", "It doubles: they get in each other's way"],
    answer: 1,
    why: "A bench can only work on one thing at an instant. Two workers on one bench take turns, and every switch costs a little (on a CPU: saving and restoring state, cold caches). More threads than cores helps only when threads spend time waiting on something other than the CPU; for CPU-bound work, match the worker count to the cores.",
    watch: { ...BASE, workers: 16, chunks: 16 },
  },
  {
    id: "tool",
    title: "One shared tool",
    change: "Shared tool off → on · the last 40% of every chunk needs the one tool on the rack",
    question: "With 8 workers, how fast is the job compared with one worker?",
    options: ["Still about 4× faster", "About 2× faster", "No faster at all"],
    answer: 1,
    why: "The tool is a lock: only one worker can hold it, so the part of each chunk that needs it is serial again, and workers queue for it. Every shared, exclusive resource (a lock, a single database row, one connection) adds to the serial share in Amdahl's law. Speed-up comes from removing what workers share, not from adding workers.",
    watch: { ...BASE, tool: true },
  },
  {
    id: "tiny",
    title: "A tiny job",
    change: "A job of 0.3 s instead of 16 s · 1 worker with 1 chunk vs 8 workers with 8 chunks",
    question: "Which finishes first?",
    options: ["8 workers, about 8× sooner", "1 worker", "They tie"],
    answer: 1,
    why: "Splitting has a fixed cost per chunk: the foreman hands each one out and the packing station merges each one back. On a big job that cost is lost in the noise; on a tiny one it is bigger than the work saved. Parallelise work that is large compared with the cost of coordinating it, and batch small items together.",
    watch: { ...BASE, job: "tiny" },
  },
  {
    id: "uneven",
    title: "One heavy chunk",
    change: "Uneven data: the first eighth of the job holds a third of the work · 8 chunks vs 32 chunks, 8 workers",
    question: "With 8 chunks, what happens to the job time?",
    options: ["Nothing: the total work is the same", "It roughly doubles, until the job is cut into smaller chunks", "It gets shorter: big chunks cost less to hand out"],
    answer: 1,
    why: "The job only finishes when its slowest chunk does. With 8 chunks, one worker gets the heavy one while seven finish early and stand idle. Cutting the job into 32 smaller chunks lets free workers keep taking the next one, which spreads the heavy part out. That is what work-stealing schedulers and dynamic batching do.",
    watch: { ...BASE, data: "uneven" },
  },
];

const QUESTIONS = [
  ["Your batch job takes 60 minutes on one core and 20% of it can't be parallelised. What's the best it can do on 16 cores, and on infinitely many?",
    "Amdahl: 1 / (0.2 + 0.8/16) = 4×, so 15 minutes. With infinite cores it approaches 1/0.2 = 5×, 12 minutes: the serial part alone takes 12 minutes. To go further you have to shrink the serial part, not add cores."],
  ["What's the difference between concurrency and parallelism?",
    "Concurrency is dealing with many things at once: tasks overlap in time, even on one core, by taking turns. Parallelism is doing many things at the same instant, which needs several cores or machines. Concurrency is about structure; parallelism is about execution."],
  ["A teammate sets a thread pool to 200 threads on an 8-core server to make CPU-heavy image resizing faster. What do you expect?",
    "No speed-up beyond 8 at a time, plus extra switching and memory per thread, so it may get slower. For CPU-bound work, size the pool near the core count; large pools only help work that mostly waits on I/O."],
  ["Why can adding workers make a program slower?",
    "Coordination overhead (splitting, scheduling, merging) and contention on shared things: a lock, a shared counter, a single connection, cache lines bouncing between cores. If those grow with the number of workers, past some point each new worker costs more than it adds."],
  ["Your parallel job's progress bar sits at 95% for a long time. What's the likely cause and the fix?",
    "Uneven work: one chunk is much bigger than the others, so one worker is still busy while the rest are idle. Use smaller chunks with a shared queue (or a work-stealing scheduler), or split by work done rather than by item count."],
  ["Where do you meet these ideas outside threads?",
    "Everywhere work is spread out: map-reduce and Spark jobs, CI pipelines split across runners, database queries using parallel workers, Kubernetes jobs with many pods. The same rules hold: the serial step (a final merge, a single writer), coordination cost and stragglers decide the speed-up."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Workshop",
  keys: [
    { mark: "lit", label: "Work happening this instant: a chunk being worked, the tool in use, the press" },
    { mark: "raised", label: "Workbenches: the cores" },
    { mark: "flat", label: "Packing station: the serial part" },
  ],
  caption:
    "The foreman in the cap splits each job into chunks and stacks them on the pallet. A worker with nothing to do takes the next chunk to its bench; the chunk shrinks as it is worked on and is lit while someone is working on it. Workers who share a bench take turns: the one stepped back is waiting. The T-handled tool on the rack is the one shared tool; with it switched on, the end of every chunk needs it, so it travels to the bench using it and the others drop a token on the rail beside the rack and wait their turn. Finished chunks land in the packing tray, and when all are in, the packing station merges them and presses the job alone while the benches stand empty. The dial on the desk turns once in the time one worker would need.",
  stage: 'data-office aria-label="Workshop simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const controls = panel({
  stats: [["jobs", "Jobs done"], ["last", "Last job", "–"], ["speedup", "Speed-up", "–"], ["limit", "Amdahl limit", "–"], ["busy", "Benches busy", "–"], ["toolwait", "Waiting for tool", "–"]],
  controls: [
    seg("workers", "Workers", [[1, "1"], [2, "2"], [4, "4"], [8, "8"], [16, "16"]], 8),
    seg("cores", "Benches (cores)", [[4, "4"], [8, "8"]], 8),
    seg("serial", "Serial part", [[0, "0%"], [0.1, "10%"], [0.3, "30%"]], 0.1),
    seg("chunks", "Chunks per job", [[1, "1"], [8, "8"], [16, "16"], [32, "32"]], 8),
    seg("tool", "Shared tool", [["false", "Off"], ["true", "On"]], "false"),
    seg("job", "Job size", [["big", "16 s"], ["tiny", "0.3 s"]], "big"),
    seg("data", "Work per chunk", [["even", "Even"], ["uneven", "One heavy part"]], "even"),
    speedSeg(),
    actions("Do something", [["reset", "Start over"], ["pause", "Pause"]]),
  ],
});

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const PAWN_SVG = ${JSON.stringify(pawnSvg())};
const NS = "http://www.w3.org/2000/svg";

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const covers = G.BENCHES.map((b) => q('[data-bench="' + b.i + '"] [data-cover]'));
const crateRows = [q('[data-crates="0"]'), q('[data-crates="1"]')];
const pawnRows = [q('[data-pawns="0"]'), q('[data-pawns="1"]')];
const toolAnchors = { rack: q('[data-anchor="tool-rack"]'), 0: q('[data-anchor="tool-0"]'), 1: q('[data-anchor="tool-1"]') };
const tool = q("[data-tool]");
const waits = [...svg.querySelectorAll("[data-wait]")];
const tokens = [...svg.querySelectorAll("[data-token]")];
const tiles = [...svg.querySelectorAll("[data-tile]")];
const product = q("[data-product]"), ram = q("[data-ram]"), rod = q("[data-rod]"), clockHand = q("[data-clock]");
const pawns = Array.from({ length: 16 }, () => { const g = document.createElementNS(NS, "g"); g.innerHTML = PAWN_SVG; g.style.display = "none"; return g; });

const cfg = { ...${JSON.stringify(BASE)}, speed: 1 };
let shop, seed = (Date.now() % 1e5) + 1, ref = 1, lastRam = null;

function crate(x0, y0, w, h, lit) { return solidSvg(slabOf({ x: x0, y: y0, w, d: G.CRATE.d, r: 0.6 }, G.CRATE.z, h, P, 2, 0.3), { tone: "hi", crease: "lo", lit }); }
function ramAt(z, lit) { return solidSvg(slabOf({ x: G.PRESS.cx - 5.5, y: G.PRESS.cy - 5.5, w: 11, d: 11, r: 0.8 }, z, 4, P, 2, 0.4), { tone: "hi", crease: "lo", lit }); }
function rodAt(z) { return solidSvg(cylinder(G.PRESS.cx, G.PRESS.cy, 1.8, z + 4, G.PRESS.top - z - 4, P, 14), { tone: "mid", crease: "none" }); }

function restart() {
  shop = makeShop(cfg, seed++);
  ref = Math.max(...shop.chunks.map((c) => c.size));
  covers.forEach((c, i) => (c.style.display = i >= cfg.cores ? "" : "none"));
  pawns.forEach((p, i) => {
    p.style.display = i < cfg.workers ? "" : "none";
    const b = G.BENCHES[i % cfg.cores];
    if (p.parentNode !== pawnRows[b.row]) pawnRows[b.row].appendChild(p);
  });
  // Start a little way into the first job, so even a still frame shows workers busy and chunks waiting.
  shop.runTo(cfg.job === "tiny" ? 0.06 : cfg.workers === 1 ? 2.4 : 1.1);
  computeStats();
  paint();
}

let current = { speedup: null, limit: null };
function computeStats() {
  current.limit = amdahl(cfg.serial, cfg.workers, cfg.cores);
  current.speedup = speedup(cfg);
  statEls.limit.textContent = current.limit.toFixed(1) + "×";
  statEls.speedup.textContent = current.speedup.toFixed(1) + "×";
}

function onBench(b) { return shop.workers.filter((w) => w.bench === b); }
function paint() {
  const t = shop.t;
  if (shop.chunks[0] && shop.jobStart === t) ref = Math.max(...shop.chunks.map((c) => c.size));
  const rows = [[], []], seen = new Set();
  for (let b = 0; b < cfg.cores; b++) {
    const bench = G.BENCHES[b], list = onBench(b), n = list.length;
    const running = list.filter((w) => w.chunk && !w.waiting);
    const active = running.length ? running[Math.floor(t / 0.3) % running.length] : null;
    const gap = Math.min(15, 30 / Math.max(1, n)), width = Math.min(14, gap - 2);
    list.forEach((w, j) => {
      const x = bench.cx + (j - (n - 1) / 2) * gap;
      const working = w === active;
      pawns[w.id].setAttribute("transform", translateAlong(P, [x, bench.front + 5 + (working ? 0 : 5), 0]));
      if (w.chunk) {
        const left = w.chunk.free + w.chunk.tool;
        const h = 1 + 14 * Math.min(1, left / ref);
        rows[bench.row].push(crate(x - width / 2, bench.cy - G.CRATE.d / 2 - 1, width, h, working));
      }
    });
  }
  crateRows[0].innerHTML = rows[0].join(""); crateRows[1].innerHTML = rows[1].join("");
  waits.forEach((el, i) => (el.style.display = i < shop.ready.length ? "" : "none"));
  // Shared tool: on its rack, or on the bench of the worker holding it.
  {
    const holder = shop.toolHolder === null ? null : shop.workers[shop.toolHolder];
    const anchor = holder ? toolAnchors[G.BENCHES[holder.bench].row] : toolAnchors.rack;
    if (tool.parentNode !== anchor) anchor.appendChild(tool);
    const b = holder && G.BENCHES[holder.bench];
    tool.setAttribute("transform", translateAlong(P, holder ? [b.x0 + G.BENCH.w - 5.5, b.y0 + 5.5, G.BENCH.h] : G.TOOL_REST));
    tool.querySelectorAll(".iso-solid").forEach((s) => s.toggleAttribute("data-lit", !!holder));
    tokens.forEach((el, i) => (el.style.display = i < shop.toolQueue.length ? "" : "none"));
  }
  // Packing tray and press.
  const inTray = shop.phase === "work" ? shop.doneCount : shop.phase === "merge" ? Math.ceil(Math.max(0, shop.mergeLeft) / PAR.MERGE) : 0;
  tiles.forEach((el, i) => (el.style.display = i < inTray ? "" : "none"));
  product.style.display = shop.phase === "work" ? "none" : "";
  const pressing = shop.phase === "pack";
  const z = pressing ? G.PRESS.down + (G.PRESS.up - G.PRESS.down) * 0.5 * (1 + Math.cos(t * Math.PI * 2 / 0.7)) : G.PRESS.up;
  const key = z.toFixed(1) + pressing;
  if (key !== lastRam) { lastRam = key; ram.innerHTML = ramAt(z, pressing); rod.innerHTML = rodAt(z); }
  clockHand.setAttribute("d", needleOf((t - shop.jobStart) / PAR.BIG));
  // Readout.
  const waitingTool = shop.workers.filter((w) => w.waiting).length;
  if (shop.phase === "work") say("job " + (shop.jobsDone + 1) + " · " + shop.doneCount + " of " + shop.chunks.length + " chunks done" + (waitingTool ? " · " + waitingTool + " waiting for the tool" : "") + (shop.lastTime ? " · last " + shop.lastTime.toFixed(1) + " s" : ""));
  else if (shop.phase === "merge") say("job " + (shop.jobsDone + 1) + " · merging " + shop.chunks.length + " chunks · benches idle");
  else say("job " + (shop.jobsDone + 1) + " · packing alone (serial part) · benches idle");
}
function needleOf(turn) { const a = turn * Math.PI * 2, x = -131, y = -84; return lineOnTop([x, y], [x + Math.sin(a) * 2.9, y - Math.cos(a) * 2.9], 16.2, P); }

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function showStats() {
  statEls.jobs.textContent = shop.jobsDone;
  statEls.last.textContent = shop.lastTime ? (cfg.job === "tiny" ? Math.round(shop.lastTime * 1000) + " ms" : shop.lastTime.toFixed(1) + " s") : "–";
  statEls.busy.textContent = shop.t > 0.5 ? Math.round((100 * shop.busyTime) / shop.t) + "%" : "–";
  statEls.toolwait.textContent = cfg.tool && shop.t > 0.5 ? Math.round((100 * shop.toolWaitTime) / (shop.t * cfg.workers)) + "%" : "–";
}

let statTimer = 0;
function step(dt) {
  const before = shop.jobsDone;
  shop.runTo(shop.t + dt * cfg.speed);
  if (shop.jobsDone !== before) ref = Math.max(...shop.chunks.map((c) => c.size));
  paint();
  statTimer += dt; if (statTimer > 0.25) { statTimer = 0; showStats(); }
}

// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });
const NUMERIC = ["workers", "cores", "serial", "chunks", "speed"];
function set(name, raw, quiet) {
  cfg[name] = NUMERIC.includes(name) ? Number(raw) : name === "tool" ? raw === true || raw === "true" : raw;
  WB.pressSeg(name, raw);
  if (name !== "speed" && !quiet) { restart(); showStats(); }
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="reset"]').addEventListener("click", () => { restart(); showStats(); say("started over"); });
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const B = ${JSON.stringify(BASE)};
const x1 = (v) => v.toFixed(1) + "×";
const s1 = (v) => v.toFixed(1) + " s";
const ms = (v) => Math.round(v * 1000) + " ms";
const RUNS = {
  amdahl: () => {
    const t1 = jobTime({ ...B, workers: 1 }), list = [1, 2, 4, 8].map((w) => [w, t1 / jobTime({ ...B, workers: w })]);
    const s8 = list[3][1];
    return { verdict: "8 workers finished a job " + x1(s8) + " faster, not 8×. Amdahl's limit for 10% serial work on 8 cores is " + x1(amdahl(0.1, 8, 8)) + "; handing out and merging chunks takes the rest.",
      bars: list.map(([w, s]) => [w + (w === 1 ? " worker" : " workers"), s / 8, x1(s), w === 8]) };
  },
  oversub: () => {
    const a = jobTime({ ...B, chunks: 16 }), b = jobTime({ ...B, chunks: 16, workers: 16 }), top = Math.max(a, b);
    return { verdict: "Job time " + s1(a) + " with 8 workers, " + s1(b) + " with 16 on the same 8 benches: " + Math.round(100 * (b / a - 1)) + "% slower.",
      bars: [["8 workers", a / top, s1(a)], ["16 workers", b / top, s1(b), true]] };
  },
  tool: () => {
    const off = speedup(B), on = speedup({ ...B, tool: true });
    return { verdict: "Speed-up with 8 workers: " + x1(off) + " without the shared tool, " + x1(on) + " with it.",
      bars: [["Tool off", off / 8, x1(off)], ["Tool on", on / 8, x1(on), true]] };
  },
  tiny: () => {
    const one = jobTime({ ...B, job: "tiny", workers: 1, chunks: 1 }), eight = jobTime({ ...B, job: "tiny" }), more = jobTime({ ...B, job: "tiny", chunks: 32 }), top = Math.max(one, eight, more);
    return { verdict: "A 0.3 s job took " + ms(one) + " with 1 worker and " + ms(eight) + " split across 8. Split into 32 chunks it took " + ms(more) + ".",
      bars: [["1 worker", one / top, ms(one)], ["8 workers, 8 chunks", eight / top, ms(eight), true], ["8 workers, 32 chunks", more / top, ms(more)]] };
  },
  uneven: () => {
    const even = jobTime(B), u8 = jobTime({ ...B, data: "uneven" }), u32 = jobTime({ ...B, data: "uneven", chunks: 32 }), top = Math.max(even, u8, u32);
    return { verdict: "Job time " + s1(even) + " with even chunks, " + s1(u8) + " with one heavy chunk, " + s1(u32) + " once the job is cut into 32 chunks.",
      bars: [["Even, 8 chunks", even / top, s1(even)], ["Heavy, 8 chunks", u8 / top, s1(u8), true], ["Heavy, 32 chunks", u32 / top, s1(u32)]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  for (const name of ["workers", "cores", "serial", "chunks", "tool", "job", "data"]) set(name, String(w[name]), true);
  restart(); showStats();
  if (loop.paused) loop.setPaused(false);
  say("watching: " + exp.id);
} });

loop.setPaused(loop.paused);
restart();
showStats();
`;

const size = writePage(new URL("./parallelism-workbench.html", import.meta.url), {
  title: "Parallelism Workbench",
  eyebrow: "Systems lesson 14 · Parallelism",
  lede: "Parallelism is doing many pieces of work at the same instant, on several cores or machines. More workers help only as far as the work can be split, shared things allow and coordination costs. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
  machine: { intro: "Each workbench is a core and each worker a thread. Watch eight workers share a job, then change the workers, the serial part or the chunks and see the speed-up move.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over six seeded runs of one job.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  script: live,
});
console.log("wrote parallelism-workbench.html", (size / 1024).toFixed(0) + " KB");

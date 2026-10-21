// Systems lesson 05 · Rate limiting. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, ticketSvg, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "size",
    title: "A bigger bucket",
    change: "Bucket 8 tokens → 16 tokens · refill stays at 4 per second",
    question: "Clients want more than the limit all the time. How many requests get through per minute now?",
    options: ["About twice as many", "About the same: only short bursts get bigger", "Fewer, because a big bucket takes longer to refill"],
    answer: 1,
    why: "Over a long stretch, nothing can get through faster than tokens arrive: 4 per second is 240 per minute, plus one bucketful. The size only decides how big a burst can pass at once after a quiet spell. Size is the burst allowance; the refill rate is the limit.",
    watch: { capacity: 16, rate: 4, algorithm: "bucket", mode: "global", noisy: false, behaviour: "after", instances: 1, burst: true },
  },
  {
    id: "window",
    title: "The window boundary",
    change: "Fixed window (8 per 2 s) vs token bucket (4/s, holds 8) · a client sends 16 just before a window ends and 16 just after",
    question: "With the fixed window, how many get through in that 0.4 s?",
    options: ["8, the limit", "About 16, twice the limit", "None, the window blocks bursts"],
    answer: 1,
    why: "A fixed window only counts within its own window. 8 fit at the end of one window and 8 more at the start of the next, so twice the limit passes in less than half a second. A token bucket (or a sliding window) has no boundary to exploit: after the first 8 it only lets through what drips in.",
    watch: { capacity: 8, rate: 4, algorithm: "window", mode: "global", noisy: false, behaviour: "after", instances: 1 },
  },
  {
    id: "noisy",
    title: "One noisy client",
    change: "Client C sends 8 requests/s, A and B send 1/s · one shared limit of 6/s vs a third of it per client",
    question: "With one shared limit, what happens to A and B?",
    options: ["Nothing: they send so little they always get a token", "Many of their requests are rejected too", "Only C is slowed down"],
    answer: 1,
    why: "A shared bucket doesn't know who is asking. C takes most of the tokens, so A and B find the tube empty as often as C does. A limit per client (per API key, per user, per IP) gives each its own tube, so C only drains its own.",
    watch: { capacity: 12, rate: 6, algorithm: "bucket", mode: "global", noisy: true, behaviour: "after", instances: 1 },
  },
  {
    id: "retry",
    title: "Retrying on 429",
    change: "Client A bursts 30 requests at once · impatient clients retry every 0.25 s vs clients that wait the Retry-After time (plus jitter)",
    question: "How many rejected attempts does the limiter see?",
    options: ["The same either way: the burst is the burst", "Far fewer when clients wait the Retry-After time", "More when clients wait, because they come back all together"],
    answer: 1,
    why: "A rejected request costs the server something even if it does no work: a connection, parsing, a lookup. Clients that hammer every 0.25 s turn one burst into a stream of rejections. Waiting the Retry-After time, with jitter so they don't all return at once, sends far fewer. Impatient clients also grab tokens first, which is why well-behaved clients need the server to enforce fairness.",
    watch: { capacity: 8, rate: 4, algorithm: "bucket", mode: "global", noisy: false, behaviour: "now", instances: 1, burst: true },
  },
  {
    id: "instances",
    title: "Two app instances",
    change: "1 → 2 app instances behind a load balancer · each keeps its own bucket in memory (4/s, holds 8)",
    question: "Clients ask for 7.5 requests/s. How many get through per minute now?",
    options: ["The same: the limit is 4/s", "About twice as many", "Fewer, because each instance sees only half the traffic"],
    answer: 1,
    why: "Each instance enforces 4/s on the half of the traffic it sees, so together they allow 8/s. Every instance you add raises the real limit. A limit meant for the whole service needs one shared counter, usually in Redis, that every instance checks.",
    watch: { capacity: 8, rate: 4, algorithm: "bucket", mode: "global", noisy: false, behaviour: "after", instances: 2, heavy: true },
  },
];

const QUESTIONS = [
  ["A limit is set as \"bucket 20, refill 5 per second\". What does each number control?",
    "The refill rate is the long-run limit: never more than 5/s over time, 300 a minute. The bucket size is the burst allowance: after a quiet period, up to 20 can go through at once. Doubling the bucket doesn't raise throughput; doubling the refill does."],
  ["Why is a fixed window easy to exploit, and what fixes it?",
    "It resets at fixed times, so a client can spend the whole limit just before the boundary and again just after, getting twice the limit in a moment. A token bucket or a sliding window (counting the last N seconds at any moment) doesn't have a boundary to exploit."],
  ["Your API has one global limit and one customer starts a batch job. What do other customers see, and how would you design the limit instead?",
    "They get 429s too, because they share the same tokens. Limit per API key or per user (often with a global limit behind it to protect the service), so a noisy customer only exhausts their own allowance."],
  ["What should a well-behaved client do when it gets a 429?",
    "Stop, wait at least the Retry-After time, add random jitter so many clients don't come back at the same instant, and back off further if it keeps getting 429s. Retrying immediately multiplies the load on a server that is already saying it's busy."],
  ["You run 4 replicas, each with an in-memory limiter of 100 requests/s. What is the real limit, and how do you get a true 100/s?",
    "About 400/s, and it changes whenever you scale. Keep the counter in a shared store such as Redis (an atomic increment or a small Lua script per request), or rate limit at the gateway in front of the replicas."],
  ["Where does rate limiting belong: the API gateway, each service, or the client?",
    "Usually more than one: the gateway or edge for coarse per-client limits that stop abuse early, services for limits that protect a specific expensive resource, and clients for politeness (honouring Retry-After, backing off). Each layer protects something different."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Ticket dispenser",
  keys: [
    { mark: "lit", label: "A token being added, a ticket being turned away" },
    { mark: "raised", label: "Coin tube: the bucket, one disc per token" },
    { mark: "flat", label: "Lanes for clients A, B, C, back to front" },
  ],
  caption:
    "Each client pushes tickets (requests) along its lane. At the gate a ticket takes one disc from the tube above it and rides on to the served tray; if the tube is empty it goes back to its client with a 429. The dropper adds one disc at the refill rate until the tube is full. The front gate is a second app instance: it only runs with two instances, and has its own tubes.",
  stage: 'data-office aria-label="Rate limiter simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">Changing a setting starts the run again with full tubes. With "Each client", every client gets a third of the rate and of the bucket.</p>`;
const controls = panel({
  stats: [["attempts", "Attempts"], ["allowed", "Allowed"], ["rejected", "Rejected 429"], ["perMinute", "Allowed / min", "–"], ["quiet", "A, B rejected", "–"], ["peak", "Most in 1 s"]],
  controls: [
    seg("rate", "Refill rate", [[2, "2/s"], [4, "4/s"], [6, "6/s"]], 4),
    seg("capacity", "Bucket size", [[8, "8"], [16, "16"]], 8),
    seg("algorithm", "Algorithm", [["bucket", "Token bucket"], ["window", "Fixed window"]], "bucket"),
    seg("mode", "Limit applies to", [["global", "Everyone"], ["client", "Each client"]], "global"),
    seg("noisy", "Client C", [["false", "Normal"], ["true", "Noisy"]], "false"),
    seg("behaviour", "On 429", [["now", "Retry now"], ["after", "Wait Retry-After"]], "after"),
    seg("instances", "App instances", [[1, "1"], [2, "2"]], 1),
    speedSeg(),
    actions("Do something", [["burst", "Burst of 20 from A"], ["reset", "Start over"], ["pause", "Pause"]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

// Figure-specific styles: the second app instance is hidden while there is one.
const css = `
[data-group][data-off]{display:none}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const TICKET_SVG = ${JSON.stringify(ticketSvg())};
const POOL = 70, PASS_TIME = 0.9, BACK_TIME = 0.6, DROP_TIME = 0.3;

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const NS = "http://www.w3.org/2000/svg";
const groups = [0, 1].map((i) => q('[data-group="' + i + '"]'));
const ups = [0, 1].map((i) => q('[data-up="' + i + '"]'));
const downs = [0, 1].map((i) => q('[data-down="' + i + '"]'));
const flaps = G.LANES.map((_, i) => q('[data-flap="' + i + '"]'));
const dials = [0, 1].map((i) => q('[data-dial="' + i + '"]'));
const tubes = {};
for (const el of svg.querySelectorAll("[data-tube]")) tubes[el.dataset.tube] = { el, discs: [...el.querySelectorAll("[data-disc]")], drop: el.querySelector("[data-drop]"), shown: -1, dropT: -1 };

const cfg = { rate: 4, capacity: 8, algorithm: "bucket", window: 2, mode: "global", noisy: false, noisyRate: 8, behaviour: "after", instances: 1, demand: [1, 1, 1], speed: 1 };
let sim, clock, snaps, initial, decided, tickets, lastSaid = "";
let seed = (Date.now() % 1e6) + 1;

// The pool of ticket groups the figure reuses.
const pool = Array.from({ length: POOL }, () => { const g = document.createElementNS(NS, "g"); g.innerHTML = TICKET_SVG; g.style.display = "none"; return { g, solid: g.firstElementChild, busy: false }; });

function restart() {
  sim = makeSim({ ...cfg }, seed++);
  clock = 0; decided = []; tickets = [];
  snaps = sim.limiters.map((row) => row.map(() => []));
  initial = sim.limiters.map((row) => row.map((l) => ({ ...l })));
  pool.forEach((p) => { p.busy = false; p.g.style.display = "none"; });
  groups[1].toggleAttribute("data-off", cfg.instances < 2);
  for (const [key, t] of Object.entries(tubes)) {
    const [inst, which] = key.split("-");
    const shown = cfg.mode === "client" ? which !== "g" : which === "g";
    t.el.style.display = shown ? "" : "none";
    t.used = shown && Number(inst) < cfg.instances; t.shown = -1;
    if (shown && !t.used) t.discs.forEach((d, n) => (d.style.display = n < (which === "g" ? cfg.capacity : Math.ceil(cfg.capacity / 3)) ? "" : "none"));
  }
  dials.forEach((d) => d.setAttribute("d", ""));
  resetCounts();
  showStats();
  paint();
}

function limiterOf(instance, client) { return cfg.mode === "client" ? [instance, client] : [instance, 0]; }
function stateAt(i, j, t) {
  const list = snaps[i][j];
  let s = initial[i][j];
  for (let n = list.length - 1; n >= 0; n--) if (list[n].t <= t) { s = list[n].l; break; }
  return s;
}

function onDecision(d) {
  const [i, j] = limiterOf(d.instance, d.client);
  snaps[i][j].push({ t: d.t, l: { ...sim.limiters[i][j] } });
  decided.push(d);
  tickets.push({ d, lane: d.instance * 3 + d.client, start: d.t - TRAVEL, slot: null, said: false });
}

function laneY(lane) { return G.LANES[lane].y; }
function place(p, x, y, z, lit, opacity) {
  p.g.setAttribute("transform", translateAlong(P, [x, y, z]));
  p.g.style.display = "";
  p.g.style.opacity = String(opacity);
  p.solid.toggleAttribute("data-lit", lit);
}

function paint() {
  // Tubes: discs present at this moment.
  for (const [key, t] of Object.entries(tubes)) {
    if (!t.used) continue;
    const [inst, which] = key.split("-");
    const i = Number(inst), j = which === "g" ? 0 : Number(which);
    const s = stateAt(i, j, clock);
    const level = Math.max(0, Math.min(t.discs.length, Math.floor(levelOf(s, clock) + 1e-9)));
    if (t.shown >= 0 && level === t.shown + 1 && s.kind === "bucket") t.dropT = 0;
    t.shown = level;
    t.discs.forEach((d, n) => { d.style.display = n < level ? "" : "none"; });
  }
  // Window dials.
  dials.forEach((el, i) => {
    if (cfg.algorithm !== "window" || i >= cfg.instances) { el.setAttribute("d", ""); return; }
    const a = ((clock % cfg.window) / cfg.window) * Math.PI * 2, [x, y] = G.DIALS[i];
    el.setAttribute("d", lineOnTop([x, y], [x + Math.sin(a) * 3.2, y - Math.cos(a) * 3.2], 32.5, P));
  });
  // Tickets.
  const lifted = new Set();
  pool.forEach((p) => (p.busy = false));
  let used = 0;
  tickets = tickets.filter((tk) => clock < tk.d.t + (tk.d.ok ? PASS_TIME : BACK_TIME) + 0.05);
  for (const tk of tickets) {
    if (clock < tk.start) continue;
    if (used >= POOL) break;
    const p = pool[used++]; p.busy = true;
    const y = laneY(tk.lane), inst = G.LANES[tk.lane].instance;
    let x, z = G.TICKET.z, lit = false, opacity = 1, after = false;
    if (clock < tk.d.t) { const u = (clock - tk.start) / TRAVEL; x = G.SENDER_X + (G.GATE_X - 7 - G.SENDER_X) * u; opacity = Math.min(1, u * 5); }
    else if (tk.d.ok) { const u = (clock - tk.d.t) / PASS_TIME; x = G.GATE_X - 7 + (G.TRAY_X - G.GATE_X + 7) * ease(Math.min(1, u)); after = x > G.GATE_X; opacity = u > 0.8 ? (1 - u) / 0.2 : 1; if (u < 0.4) lifted.add(tk.lane); }
    else { const u = (clock - tk.d.t) / BACK_TIME; x = G.GATE_X - 7 - (G.GATE_X - 7 - G.SENDER_X) * ease(Math.min(1, u)); lit = true; opacity = u > 0.85 ? (1 - u) / 0.15 : 1; }
    const parent = after ? downs[inst] : ups[inst];
    if (p.g.parentNode !== parent) parent.appendChild(p.g);
    place(p, x, y, z, lit, Math.max(0, opacity));
    if (!tk.said && clock >= tk.d.t) {
      tk.said = true;
      const name = "ABC"[tk.d.client];
      say(tk.d.ok ? "client " + name + " · allowed" + (cfg.instances > 1 ? " by instance " + (tk.d.instance + 1) : "") : "client " + name + " · 429" + (tk.d.attempt > 1 ? " (attempt " + tk.d.attempt + ")" : ""));
    }
  }
  pool.forEach((p) => { if (!p.busy) p.g.style.display = "none"; });
  flaps.forEach((f, i) => f.setAttribute("transform", lifted.has(i) ? translateAlong(P, [0, 0, 6]) : ""));
}

function animateDrops(dt) {
  for (const t of Object.values(tubes)) {
    if (t.dropT < 0 || !t.used) { t.drop.style.opacity = "0"; continue; }
    t.dropT += dt / DROP_TIME;
    if (t.dropT >= 1) { t.dropT = -1; t.drop.style.opacity = "0"; continue; }
    const top = G.TUBE_BASE + t.discs.length * G.DISC.h + 6, landing = G.TUBE_BASE + Math.max(0, t.shown - 1) * G.DISC.h;
    t.drop.setAttribute("transform", translateAlong(P, [0, 0, top + (landing - top) * t.dropT * t.dropT]));
    t.drop.style.opacity = "1";
  }
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
let counts, recent;
function resetCounts() { counts = { attempts: 0, allowed: 0, quiet: 0, quietRejected: 0, peak: 0, next: 0 }; recent = []; }
function showStats() {
  while (counts.next < decided.length && decided[counts.next].t <= clock) {
    const d = decided[counts.next++];
    counts.attempts++;
    if (d.client !== 2) { counts.quiet++; if (!d.ok) counts.quietRejected++; }
    if (d.ok) { counts.allowed++; recent.push(d.t); while (recent[0] < d.t - 30) recent.shift(); let n = 0; for (let i = recent.length - 1; i >= 0 && recent[i] >= d.t - 1; i--) n++; counts.peak = Math.max(counts.peak, n); }
  }
  if (counts.next > 2000) { decided.splice(0, counts.next); counts.next = 0; }
  statEls.attempts.textContent = counts.attempts;
  statEls.allowed.textContent = counts.allowed;
  statEls.rejected.textContent = counts.attempts - counts.allowed;
  const span = Math.min(clock, 30);
  statEls.perMinute.textContent = span > 3 ? Math.round((recent.filter((t) => t > clock - span).length / span) * 60) : "–";
  statEls.quiet.textContent = counts.quiet ? Math.round((100 * counts.quietRejected) / counts.quiet) + "%" : "–";
  statEls.peak.textContent = counts.peak;
}

let statTimer = 0;
function step(dt) {
  const s = dt * cfg.speed;
  clock += s;
  sim.runTo(clock + TRAVEL, onDecision);
  paint(); animateDrops(s);
  statTimer += dt; if (statTimer > 0.25) { statTimer = 0; showStats(); }
}

// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });
const pressSeg = WB.pressSeg;
const NUMERIC = ["rate", "capacity", "instances", "speed"];
function set(name, raw, quiet) {
  const value = NUMERIC.includes(name) ? Number(raw) : name === "noisy" ? raw === true || raw === "true" : raw;
  cfg[name] = value;
  pressSeg(name, raw);
  if (name !== "speed" && !quiet) { restart(); say("settings applied · run restarted"); }
}
function burst(client = 0, n = 20) {
  const t0 = clock + TRAVEL + 0.05;
  for (let i = 0; i < n; i++) sim.add(t0 + i * 0.02, client);
  say("client " + "ABC"[client] + " · burst of " + n);
  if (loop.paused) loop.setPaused(false);
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="burst"]').addEventListener("click", () => burst());
document.querySelector('[data-act="reset"]').addEventListener("click", () => { restart(); say("started over"); });
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const pct = (x) => Math.round(100 * x) + "%";
const BASE = { rate: 4, capacity: 8, algorithm: "bucket", window: 2, mode: "global", noisy: false, noisyRate: 8, behaviour: "after", instances: 1, demand: [1, 1, 1] };
function burstThrough(capacity) {
  // A quiet bucket, then 20 requests at once: how many pass in that first instant?
  const script = Array.from({ length: 20 }, (_, i) => [10 + i * 0.005, 0]);
  const s = makeSim({ ...BASE, capacity, script, retry: false }, 1); s.runTo(10.2);
  return s.log.filter((d) => d.ok && d.attempt === 1).length;
}
function boundary(algorithm) {
  const script = [];
  for (let i = 0; i < 16; i++) script.push([1.8 + i * 0.012, 0]);
  for (let i = 0; i < 16; i++) script.push([2.02 + i * 0.012, 0]);
  const s = makeSim({ ...BASE, algorithm, script, retry: false }, 1); s.runTo(2.25);
  return s.log.filter((d) => d.ok && d.attempt === 1).length;
}
function retryRun(behaviour) {
  const script = Array.from({ length: 30 }, (_, i) => [5 + i * 0.01, 0]);
  let rejected = 0; const seeds = [3, 5, 7, 11, 13, 17];
  for (const seed of seeds) { const s = makeSim({ ...BASE, script, background: true, behaviour }, seed); s.runTo(60); rejected += s.log.filter((d) => !d.ok).length; }
  return rejected / seeds.length;
}
const RUNS = {
  size: () => {
    const heavy = { ...BASE, demand: [2.5, 2.5, 2.5] };
    const a = average({ ...heavy, capacity: 8 }), b = average({ ...heavy, capacity: 16 });
    const b8 = burstThrough(8), b16 = burstThrough(16), top = Math.max(a.perMinute, b.perMinute);
    return { verdict: "Per minute: " + Math.round(a.perMinute) + " → " + Math.round(b.perMinute) + ". A burst of 20 after a quiet spell: " + b8 + " → " + b16 + " let through.",
      bars: [["Per min, size 8", a.perMinute / top, Math.round(a.perMinute)], ["Per min, size 16", b.perMinute / top, Math.round(b.perMinute), true], ["Burst, size 8", b8 / 20, b8 + " of 20"], ["Burst, size 16", b16 / 20, b16 + " of 20", true]] };
  },
  window: () => { const w = boundary("window"), b = boundary("bucket"); return { verdict: "In 0.4 s around the boundary, the fixed window let " + w + " through; the token bucket let " + b + " through. The limit is 8.", bars: [["Fixed window", w / 32, String(w), true], ["Token bucket", b / 32, String(b)]] }; },
  noisy: () => {
    const c = { ...BASE, noisy: true, rate: 6, capacity: 12 };
    const g = average({ ...c, mode: "global" }), p = average({ ...c, mode: "client" });
    return { verdict: "A and B's attempts rejected: " + pct(g.quietRejected) + " with one shared limit, " + pct(p.quietRejected) + " with a limit per client.", bars: [["Shared limit", g.quietRejected, pct(g.quietRejected), true], ["Per client", p.quietRejected, pct(p.quietRejected)]] };
  },
  retry: () => { const now = retryRun("now"), after = retryRun("after"), top = Math.max(now, after); return { verdict: "Rejected attempts in the minute after the burst: " + Math.round(now) + " retrying every 0.25 s, " + Math.round(after) + " waiting the Retry-After time.", bars: [["Retry now", now / top, String(Math.round(now)), true], ["Wait Retry-After", after / top, String(Math.round(after))]] }; },
  instances: () => {
    const heavy = { ...BASE, demand: [2.5, 2.5, 2.5] };
    const one = average({ ...heavy, instances: 1 }), two = average({ ...heavy, instances: 2 }), top = Math.max(one.perMinute, two.perMinute);
    return { verdict: "Allowed per minute: " + Math.round(one.perMinute) + " with one instance, " + Math.round(two.perMinute) + " with two. The \\"4/s\\" limit is now about 8/s.", bars: [["1 instance", one.perMinute / top, Math.round(one.perMinute)], ["2 instances", two.perMinute / top, Math.round(two.perMinute), true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  for (const name of ["rate", "capacity", "algorithm", "mode", "noisy", "behaviour", "instances"]) set(name, String(w[name]), true);
  cfg.demand = w.heavy ? [2.5, 2.5, 2.5] : [1, 1, 1];
  restart();
  if (loop.paused) loop.setPaused(false);
  if (w.burst) setTimeout(() => burst(0, exp.id === "retry" ? 30 : 20), 2500);
  say("watching: " + exp.id);
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./rate-limiter-workbench.html", import.meta.url), {
  title: "Rate Limiter Workbench",
  eyebrow: "Systems lesson 05 · Rate limiting",
  lede: 'A rate limiter hands out permission at a fixed pace and says "not now" (HTTP 429) when it runs out. This lesson builds the token bucket three ways: watch a machine do it, predict what breaks it, then explain it back.',
  machine: { intro: "The coin tube is the bucket and each disc is a token. Watch tickets take discs, then empty the tube with a burst, make client C noisy, or add a second app instance.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over six seeded runs (60 s each unless noted).", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote rate-limiter-workbench.html", (size / 1024).toFixed(0) + " KB");

// Systems lesson 06 · Retry storms. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, P, GEOMETRY, pawnSvg, ticketSvg, needleAt, queueSpot, homeSpot, benchX, SPOT, GATE, QUEUE_SHOWN, GAUGE_MAX } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "retry",
    title: "Three quick retries",
    change: "No retries → 3 retries, sent at once · then a rush of 16 visitors",
    question: "Without retries, the trouble from a rush is over in about ten seconds. With three immediate retries, how long does it last?",
    options: ["About the same: retries only help clients who were unlucky", "Somewhat longer, maybe twice as long", "It may not end on its own: the office stays overloaded long after the rush has gone"],
    answer: 2,
    why: "Every client that times out leaves its ticket in the line, and the window still serves it for nobody. Then the client queues again, and again. The line gets longer, so more clients time out, so more tickets are added: up to four per request. The window spends its time on abandoned tickets, and the rush is self-sustaining even after every visitor has left.",
    watch: { retries: 3, backoff: "none", jitter: false, timeout: 3, layers: 1, budget: false, rush: true },
  },
  {
    id: "backoff",
    title: "Wait before retrying",
    change: "Immediate retries → exponential backoff · wait 2, then 4, then 8 s",
    question: "Clients now wait on the benches before trying again. What happens after the rush?",
    options: ["Nothing changes: the storm still doesn't end", "The storm ends, but retries come back in waves almost as tall as the rush", "It ends about as fast as with no retries, with a smooth load"],
    answer: 1,
    why: "While clients sit on the benches they are not adding tickets, so the window catches up and the storm ends. But the rush's visitors all timed out at the same moment, so they all wait exactly 2 s, come back together, time out together, and wait exactly 4 s. You can see them clumped on the same bench.",
    watch: { retries: 3, backoff: "exp", jitter: false, timeout: 3, layers: 1, budget: false, rush: true },
  },
  {
    id: "jitter",
    title: "Add jitter",
    change: "Exponential backoff → backoff with jitter · each wait spread between ½ and 1½ times its delay",
    question: "The average wait is exactly the same as before. What does jitter change?",
    options: ["The storm ends much sooner", "The waves flatten: the tallest wave drops by about a third, but the storm lasts about as long", "Nothing: the same clients wait the same time on average"],
    answer: 1,
    why: "Jitter breaks up the clump: clients that failed together now return at different moments, so the window sees a trickle instead of a wave, and the tallest spike is far lower. It does not reduce how many retries there are, so the total work, and the time to recover, stay about the same. Jitter protects against spikes; budgets and backoff reduce work.",
    watch: { retries: 3, backoff: "exp", jitter: true, timeout: 3, layers: 1, budget: false, rush: true },
  },
  {
    id: "timeout",
    title: "A timeout that's too short",
    change: "Timeout 3 s → 0.8 s · the window normally takes 0.7 to 1.3 s · no rush",
    question: "Nothing else is wrong. With three retries, what share of the window's work reaches a client who is still waiting?",
    options: ["Most of it: only the slow requests fail", "About half", "Almost none: the window is busy serving tickets whose clients already gave up"],
    answer: 2,
    why: "Most requests take longer than 0.8 s even with an empty line, so the client gives up while the window is still working on it, then sends another. The window finishes every ticket anyway. Load more than triples and almost nothing useful comes out. A timeout must sit above the normal, slow-end latency of what you call, not at its average.",
    watch: { retries: 3, backoff: "none", jitter: false, timeout: 0.8, layers: 1, budget: false, rush: false },
  },
  {
    id: "layers",
    title: "Retries at every layer",
    change: "1 layer retries → 3 layers retry (app, client library, proxy) · 3 retries each",
    question: "In the worst case, how many attempts reach the window for one request?",
    options: ["9: three layers times three retries", "12: the first attempt plus three retries at each of three layers", "64: each layer makes up to 4 attempts, and each of those runs the 4 attempts of the layer below"],
    answer: 2,
    why: "Retries multiply, they don't add: 4 × 4 × 4 = 64 attempts for one request. During the storm the office measured above 30 attempts per request. Retry at one layer only, usually the one nearest the user, and give it a budget: here retries may be at most about 10% of new requests, so once the window struggles, clients fail fast instead of piling on.",
    watch: { retries: 3, backoff: "none", jitter: false, timeout: 3, layers: 3, budget: false, rush: true },
  },
];

const QUESTIONS = [
  ["Why can a ten-second rush turn into an outage that lasts after the rush is gone?",
    "Clients time out and retry, but the server still does the work for the abandoned attempts. More attempts make the line longer, which makes more clients time out, which adds more attempts. The system settles in a state where it is fully busy with work nobody is waiting for. Removing the original cause doesn't fix it; reducing load does."],
  ["Backoff ended the storm in the office. Why might it not in a system where new users keep arriving at a fixed rate?",
    "In the office, clients on a bench are not sending anything, so backoff lowers the load. When new requests keep arriving regardless, backoff only delays retries: every failed request still sends all its attempts eventually, so the total load can stay above capacity. That's why retry budgets and circuit breakers, which cap the number of retries, are needed on top."],
  ["If jitter doesn't change the average wait, why does it matter?",
    "Clients that failed at the same moment retry at the same moment. Those waves hit the server as spikes, which make queues long right then and cause more timeouts. Jitter spreads them out so the server sees a steady trickle. It reduces peaks, not the total number of retries."],
  ["How would you choose a client timeout for a call that normally takes 50–200 ms?",
    "Above the slow end of normal latency (the p99 or so), not the average, with some room: maybe 500 ms to 1 s. Pair it with a deadline the server can see, so it can drop work for clients that have already given up instead of finishing it."],
  ["A request goes app → client library → proxy → service, and each retries 3 times. What would you change?",
    "Retry in one place only, usually the outermost layer that knows whether retrying is safe and useful, and make the others fail fast. Worst case is 4 × 4 × 4 = 64 attempts otherwise. Add a retry budget so retries stop when the error rate is high."],
  ["What does a retry budget do, and what should the client do when it's empty?",
    "It caps retries at a share of normal traffic, e.g. 10%. When most calls fail, the budget runs out quickly and the client fails fast instead of multiplying load. The client returns an error or a fallback right away, and a circuit breaker can stop calls entirely until the service recovers."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Ticket office",
  keys: [
    { mark: "lit", label: "A client on a retry" },
    { mark: "flat", label: "A ticket left behind: the window still serves it" },
    { mark: "raised", label: "Waiting garden: distance from the line is the backoff delay" },
  ],
  caption:
    "Regular clients come from the plaza, join the line and wait up to the timeout for one of the three windows. A client that gives up leaves its ticket in the line and, if it may retry, rejoins the line or waits in the garden first: the further along the ruler, the longer the wait. The gauge on the roof shows attempts per second; the pin marks what the window can serve, 3 per second. Send a rush to start a storm.",
  stage: 'data-office aria-label="Ticket office simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const controls = panel({
  stats: [["attempts", "Attempts/s", "–"], ["answered", "Answered/s", "–"], ["line", "In line"], ["wasted", "Served for nobody"], ["failed", "Gave up"], ["peak", "Peak/s", "–"]],
  controls: [
    seg("retries", "Retries", [[0, "None"], [3, "3"]], 3),
    seg("backoff", "Backoff", [["none", "None"], ["exp", "2 · 4 · 8 s"]], "none"),
    seg("jitter", "Jitter", [["false", "Off"], ["true", "On"]], "false"),
    seg("timeout", "Timeout", [[0.8, "0.8 s"], [3, "3 s"], [6, "6 s"]], 3),
    seg("layers", "Layers that retry", [[1, "1"], [3, "3"]], 1),
    seg("budget", "Retry budget", [["false", "Off"], ["true", "10%"]], "false"),
    speedSeg(),
    actions("Do something", [["rush", "Send a rush"], ["restart", "Start over"], ["pause", "Pause"]]).replace('<button class="btn" type="button" data-act="rush">', '<button class="btn primary" type="button" data-act="rush">'),
  ],
});

// Experiment results here come in titled groups of bars.
const css = `
.bar-group{font-family:var(--anatomy-mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--anatomy-muted);margin-top:6px}
.bar-group:first-child{margin-top:0}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const PAWN = ${JSON.stringify(pawnSvg())};
const TICKET = ${JSON.stringify(ticketSvg(0))};
const LEDGE_TICKET = ${JSON.stringify(ticketSvg(GEOMETRY.LEDGE_Z))};

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const people = q("[data-people]"), ticketsLayer = q("[data-tickets]"), ledgeLayer = q("[data-ledge]"), needle = q("[data-needle]");
const still = WB.still;
const NS = "http://www.w3.org/2000/svg";
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };

const settings = { retries: 3, backoff: "none", jitter: false, timeout: 3, layers: 1, budget: false };
let speed = 1, seed = 1;
let office, pawns, homeOf, base, emaAttempts, emaAnswered, lastCounts, peak, rushAt, pendingRush;

function group(markup) { const g = document.createElementNS(NS, "g"); g.innerHTML = markup; return g; }
const ticketPool = Array.from({ length: G.QUEUE_SHOWN }, () => { const g = group(TICKET); g.style.display = "none"; ticketsLayer.appendChild(g); return g; });
const ledgePool = G.LEDGE_SPOTS.map(() => { const g = group(LEDGE_TICKET); g.style.display = "none"; ledgeLayer.appendChild(g); return g; });
G.LEDGE_SPOTS.forEach((p, i) => ledgePool[i].setAttribute("transform", translateAlong(P, [p[0], p[1], 0])));

function queueSpot(i) {
  const lane = Math.min(G.LANES.length - 1, Math.floor(i / G.PER_LANE));
  const j = Math.min(G.PER_LANE - 1, i - lane * G.PER_LANE);
  const x = lane % 2 === 0 ? G.LANE_X[1] - j * G.STEP : G.LANE_X[0] + j * G.STEP;
  return [x, G.LANES[lane]];
}
const spread = (id) => { const h = Math.sin(id * 12.9898) * 43758.5453; return h - Math.floor(h); };

function start() {
  seed += 1;
  office = createOffice({ ...settings }, seed);
  people.innerHTML = ""; pawns = new Map(); homeOf = new Map();
  let n = 0; office.clients.forEach((c) => homeOf.set(c.id, n++));
  base = { ...office.counts }; emaAttempts = 0; emaAnswered = 0; lastCounts = { ...office.counts }; peak = 0; rushAt = null; pendingRush = null;
  showStats();
}

function targetOf(c, index) {
  if (c.phase === "waiting") {
    const slot = office.slots.indexOf(c.ticket);
    if (slot >= 0) return G.WINDOW_SPOTS[slot];
    const i = index.get(c.ticket);
    return queueSpot(i === undefined ? 0 : Math.min(i, G.QUEUE_SHOWN - 1));
  }
  if (c.phase === "bench") {
    const y = G.GARDEN_Y[0] + 8 + spread(c.id) * (G.GARDEN_Y[1] - G.GARDEN_Y[0] - 14);
    return [-G.PER_SECOND * c.backoff, y];
  }
  if (c.phase === "away") return G.HOMES[homeOf.get(c.id) % G.HOMES.length];
  return G.GATE;
}

function paintPeople(dt) {
  const index = new Map(); office.queue.forEach((id, i) => index.set(id, i));
  const alive = new Set();
  for (const c of office.clients) {
    alive.add(c.id);
    let p = pawns.get(c.id);
    if (!p) {
      const start = c.kind === "visitor" ? [G.GATE[0], G.GATE[1]] : (G.HOMES[homeOf.get(c.id) % G.HOMES.length] || G.GATE);
      p = { el: group(PAWN), x: start[0], y: start[1], lit: false };
      people.appendChild(p.el); pawns.set(c.id, p);
    }
    const [tx, ty] = targetOf(c, index);
    const dx = tx - p.x, dy = ty - p.y, dist = Math.hypot(dx, dy), stepLen = 140 * dt;
    if (dist <= stepLen || still.matches) { p.x = tx; p.y = ty; } else { p.x += dx / dist * stepLen; p.y += dy / dist * stepLen; }
    p.el.setAttribute("transform", translateAlong(P, [p.x, p.y, 0]));
    const lit = (c.phase === "waiting" || c.phase === "bench") && c.used.some((u) => u > 0);
    if (lit !== p.lit) { p.lit = lit; p.el.querySelectorAll(".iso-solid").forEach((s) => s.toggleAttribute("data-lit", lit)); }
    p.el.style.opacity = c.phase === "leaving" ? String(Math.max(0, Math.min(1, (c.until - office.t) / 1.2))) : "";
  }
  for (const [id, p] of pawns) if (!alive.has(id)) { p.el.remove(); pawns.delete(id); }
  const sorted = [...pawns.values()].sort((a, b) => depthOf([a.x, a.y, 0], P) - depthOf([b.x, b.y, 0], P));
  sorted.forEach((p) => people.appendChild(p.el));
  // Abandoned tickets: on the floor in the line, on the ledge when a window serves one.
  let used = 0;
  for (let i = 0; i < office.queue.length && i < G.QUEUE_SHOWN; i++) {
    const t = office.tickets.get(office.queue[i]);
    if (!t || !t.abandoned) continue;
    const [x, y] = queueSpot(i);
    const g = ticketPool[used++];
    g.style.display = ""; g.setAttribute("transform", translateAlong(P, [x, y, 0]));
  }
  for (; used < ticketPool.length; used++) ticketPool[used].style.display = "none";
  office.slots.forEach((id, i) => { const t = id !== null && office.tickets.get(id); ledgePool[i].style.display = t && t.abandoned ? "" : "none"; });
}

function measure(dt) {
  const c = office.counts;
  const tau = 1.5, w = 1 - Math.exp(-dt / tau);
  emaAttempts += ((c.attempts - lastCounts.attempts) / Math.max(dt, 1e-6) - emaAttempts) * w;
  emaAnswered += ((c.goodput - lastCounts.goodput) / Math.max(dt, 1e-6) - emaAnswered) * w;
  lastCounts = { ...c };
  const bins = office.bins, now = Math.floor(office.t);
  if (bins[now - 1] && rushAt !== null && now - 1 > rushAt + 1) peak = Math.max(peak, bins[now - 1].attempts);
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function showStats() {
  if (!office) return;
  const c = office.counts;
  statEls.attempts.textContent = emaAttempts.toFixed(1);
  statEls.answered.textContent = emaAnswered.toFixed(1);
  statEls.line.textContent = office.queue.length;
  statEls.wasted.textContent = c.wasted - base.wasted;
  statEls.failed.textContent = c.failed - base.failed;
  statEls.peak.textContent = rushAt === null ? "–" : String(peak);
}

function describe() {
  const bins = office.bins, now = Math.floor(office.t);
  let recent = 0; for (let i = Math.max(0, now - 4); i <= now; i++) recent += bins[i] ? bins[i].timeouts : 0;
  const retrying = office.clients.filter((c) => (c.phase === "waiting" || c.phase === "bench") && c.used.some((u) => u > 0)).length;
  const line = office.queue.length;
  const left = office.queue.reduce((n, id) => n + (office.tickets.get(id) && office.tickets.get(id).abandoned ? 1 : 0), 0);
  if (rushAt !== null && office.t - rushAt < 2) return "rush · 16 visitors at the gate";
  if (!recent) return "calm · " + line + " in line";
  return "storm · " + line + " in line, " + left + " left behind · " + retrying + " retrying";
}

function step(dt) {
  {
    const sim = dt * speed;
    const steps = Math.max(1, Math.round(sim / office.cfg.dt));
    for (let i = 0; i < steps; i++) office.step(sim / steps);
    if (pendingRush !== null && office.t >= pendingRush) { pendingRush = null; rush(); }
    measure(sim);
    paintPeople(dt * Math.min(speed, 3));
    needle.setAttribute("d", needleD(emaAttempts));
    say(describe());
    showStats();
  }
}
function needleD(value) {
  const a = G.GAUGE_FROM + G.GAUGE_SPAN * Math.min(1, value / G.GAUGE_MAX);
  const [gx, gy] = G.GAUGE;
  return lineOnTop([gx - Math.sin(a) * 2.6, gy + Math.cos(a) * 2.6], [gx + Math.sin(a) * (G.GAUGE_R - 4), gy - Math.cos(a) * (G.GAUGE_R - 4)], G.GAUGE_Z + 0.2, P);
}

// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });
const pressSeg = WB.pressSeg;
function set(name, raw) {
  if (name === "speed") { speed = Number(raw); pressSeg(name, raw); return; }
  const value = name === "jitter" || name === "budget" ? String(raw) === "true" : name === "backoff" ? raw : Number(raw);
  settings[name] = value;
  office.setConfig({ [name]: value });
  pressSeg(name, raw);
}
function rush() { office.trigger(); rushAt = office.t; peak = 0; office.clients.forEach((c) => { if (!homeOf.has(c.id)) homeOf.set(c.id, -1); }); }
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="rush"]').addEventListener("click", () => { rush(); if (loop.paused) loop.setPaused(false); });
document.querySelector('[data-act="restart"]').addEventListener("click", () => { start(); paintPeople(0); });
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const pct = (x) => Math.round(100 * x) + "%";
const SEEDS = Array.from({ length: 16 }, (_, i) => i * 7 + 3);
const BASE = { retries: 3, backoff: "none", jitter: false, timeout: 3, layers: 1, budget: false };
const avg = (o, run) => average({ ...BASE, ...o }, SEEDS, run);
const storm = (r) => r.recoveredShare === 0 ? "2 min+" : Math.round(r.recovery) + " s";
const stormShare = (r) => Math.min(1, r.recovery / 120);
const perSec = (x) => x.toFixed(1) + "/s";
const RUNS = {
  retry: () => {
    const a = avg({ retries: 0 }), b = avg({});
    return { verdict: "Without retries the trouble was over " + storm(a) + " after the rush. With three immediate retries it had not ended after 2 minutes in " + pct(1 - b.recoveredShare) + " of runs: " + b.attemptsPerRequest.toFixed(1) + " attempts per request, and only " + perSec(b.goodputRate) + " answered instead of " + perSec(a.goodputRate) + ".",
      groups: [["Trouble lasted", [["No retries", stormShare(a), storm(a)], ["3 immediate retries", stormShare(b), storm(b), true]]],
        ["Answered per second", [["No retries", a.goodputRate / 3, perSec(a.goodputRate)], ["3 immediate retries", b.goodputRate / 3, perSec(b.goodputRate), true]]]] };
  },
  backoff: () => {
    const a = avg({}), b = avg({ backoff: "exp" });
    return { verdict: "With backoff the storm ended " + (b.recoveredShare === 1 ? "in every run" : "in " + pct(b.recoveredShare) + " of runs") + ", after " + storm(b) + " on average. The tallest wave of attempts after the rush was still " + perSec(b.peak) + " (immediate retries: " + perSec(a.peak) + "), against a capacity of 3/s.",
      groups: [["Trouble lasted", [["Immediate retries", stormShare(a), storm(a)], ["Backoff 2 · 4 · 8 s", stormShare(b), storm(b), true]]],
        ["Tallest wave", [["Immediate retries", a.peak / 20, perSec(a.peak)], ["Backoff 2 · 4 · 8 s", b.peak / 20, perSec(b.peak), true]]]] };
  },
  jitter: () => {
    const a = avg({ backoff: "exp" }), b = avg({ backoff: "exp", jitter: true });
    return { verdict: "The tallest wave fell from " + perSec(a.peak) + " to " + perSec(b.peak) + " (" + Math.round(100 * (1 - b.peak / a.peak)) + "% lower). The storm lasted " + storm(a) + " without jitter and " + storm(b) + " with it.",
      groups: [["Tallest wave", [["Backoff", a.peak / 20, perSec(a.peak)], ["Backoff + jitter", b.peak / 20, perSec(b.peak), true]]],
        ["Trouble lasted", [["Backoff", stormShare(a), storm(a)], ["Backoff + jitter", stormShare(b), storm(b), true]]]] };
  },
  timeout: () => {
    const a = avg({}, { trigger: false }), b = avg({ timeout: 0.8 }, { trigger: false });
    return { verdict: pct(b.goodputShare) + " of the window's work reached a waiting client with a 0.8 s timeout (" + pct(a.goodputShare) + " with 3 s), while attempts rose from " + perSec(a.load) + " to " + perSec(b.load) + ".",
      groups: [["Work that reached a client", [["Timeout 3 s", a.goodputShare, pct(a.goodputShare)], ["Timeout 0.8 s", b.goodputShare, pct(b.goodputShare), true]]],
        ["Attempts per second", [["Timeout 3 s", a.load / 10, perSec(a.load)], ["Timeout 0.8 s", b.load / 10, perSec(b.load), true]]]] };
  },
  layers: () => {
    const a = avg({}), b = avg({ layers: 3 }), c = avg({ layers: 3, budget: true });
    const top = Math.max(a.attemptsPerRequest, b.attemptsPerRequest);
    return { verdict: "The worst case is 64. During the storm the office measured " + b.attemptsPerRequest.toFixed(1) + " attempts per request with three layers retrying, " + a.attemptsPerRequest.toFixed(1) + " with one, and " + c.attemptsPerRequest.toFixed(2) + " with three layers and a 10% retry budget, which also ended the trouble in " + storm(c) + ".",
      groups: [["Attempts per request", [["1 layer", a.attemptsPerRequest / top, a.attemptsPerRequest.toFixed(1)], ["3 layers", b.attemptsPerRequest / top, b.attemptsPerRequest.toFixed(1), true], ["3 layers + budget", c.attemptsPerRequest / top, c.attemptsPerRequest.toFixed(2)]]]] };
  },
};
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
    runBtn.disabled = true; runBtn.textContent = "Running…";
    setTimeout(() => {
      const out = RUNS[exp.id]();
      const right = picked === exp.answer;
      choices.forEach((x, j) => { x.disabled = true; if (j === exp.answer) x.dataset.verdict = "right"; else if (j === picked) x.dataset.verdict = "wrong"; });
      card.querySelector("[data-outcome]").textContent = (right ? "Your prediction held. " : "Not what you predicted. ") + out.verdict;
      const rows = [];
      out.groups.forEach(([title, bars]) => { rows.push('<div class="bar-group">' + title + "</div>"); bars.forEach(([label, share, text, after]) => rows.push('<div class="bar"' + (after ? " data-after" : "") + '><span>' + label + '</span><span class="track"><span class="fill" style="width:0" data-share="' + Math.max(0.01, Math.min(1, share)) + '"></span></span><b>' + text + "</b></div>")); });
      card.querySelector("[data-bars]").innerHTML = rows.join("");
      card.setAttribute("data-done", "");
      runBtn.textContent = "Done";
      requestAnimationFrame(() => requestAnimationFrame(() => card.querySelectorAll(".fill").forEach((f) => { f.style.width = Math.round(100 * Number(f.dataset.share)) + "%"; })));
    }, 30);
  });
  card.querySelector("[data-watch]").addEventListener("click", () => {
    const w = exp.watch;
    for (const name of ["retries", "backoff", "jitter", "timeout", "layers", "budget"]) { settings[name] = w[name]; pressSeg(name, w[name]); }
    start();
    if (w.rush) pendingRush = office.t + 6;
    document.getElementById("machine").scrollIntoView({ behavior: still.matches ? "auto" : "smooth" });
    if (loop.paused) loop.setPaused(false);
  });
});

start();
loop.setPaused(loop.paused);
paintPeople(0);
needle.setAttribute("d", needleD(0));
`;

const size = writePage(new URL("./retry-storm-workbench.html", import.meta.url), {
  title: "Retry Storm Workbench",
  eyebrow: "Systems lesson 06 · Retry storms",
  lede: 'A retry feels like the safe thing to do: if a call fails, try again. When many clients do it at once, retries can keep a system overloaded long after the original problem is gone. This lesson shows how that happens, and what actually stops it.',
  machine: { intro: 'A ticket office with one window that can serve three clients per second. Watch it run calmly, then send a rush and see what three retries do. Change the settings below and send another rush.', figure, panel: controls },
  predict: { intro: 'Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same office, averaged over 16 two-minute runs after a rush of 16 visitors.', experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote retry-storm-workbench.html", (size / 1024).toFixed(0) + " KB");

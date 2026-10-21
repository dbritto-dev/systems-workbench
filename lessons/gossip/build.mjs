// Systems lesson 19 · Gossip protocols. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, needleAt, flightPoint, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "size",
    title: "Ten times the village",
    change: "40 houses → 400 houses · push, each house tells 2 random houses per round",
    question: "How many rounds until every house has heard the rumour?",
    options: ["About ten times as many rounds", "A few more rounds", "Exactly the same number of rounds"],
    answer: 1,
    why: "The number of houses that know roughly triples every round (each tells two more), so covering ten times the houses only takes the few extra rounds it needs to triple a couple more times. Spreading time grows with the logarithm of the size: that is why gossip scales to thousands of nodes.",
    watch: { houses: 40, fanout: 2, mode: "push", loss: 0, timeout: 8, slow: 0 },
  },
  {
    id: "fanout",
    title: "Tell more neighbours",
    change: "Fanout 1 → 3 · push, 40 houses",
    question: "Each house now tells 3 random houses per round instead of 1. What happens?",
    options: ["Three times faster and a third of the messages", "Fewer rounds, but more messages in total", "Same rounds, three times the messages"],
    answer: 1,
    why: "With a bigger fanout the rumour reaches everyone in about half the rounds, but every informed house sends three messages a round, and many of them land on houses that already know. You trade bandwidth for speed. Real systems keep fanout small (often 2 to 4) and run rounds frequently.",
    watch: { houses: 40, fanout: 3, mode: "push", loss: 0, timeout: 8, slow: 0 },
  },
  {
    id: "mode",
    title: "Push, pull or both",
    change: "Push vs pull vs push-pull · fanout 1, 40 houses",
    question: "Once half the village knows, which way reaches the last houses fastest?",
    options: ["Push: the houses that know do the work", "Pull or push-pull: the houses that don't know go and ask", "All three take the same time"],
    answer: 1,
    why: "With push, the last few houses only hear it if some informed house happens to pick them, and most pushes land on houses that already know. With pull, every uninformed house asks someone each round, and once most houses know, almost every question gets an answer. Push-pull combines both and finishes first, at the cost of more messages, because everyone keeps asking.",
    watch: { houses: 40, fanout: 1, mode: "push-pull", loss: 0, timeout: 8, slow: 0 },
  },
  {
    id: "loss",
    title: "Lose a third of the messages",
    change: "Message loss 0% → 30% · push-pull, fanout 2, 40 houses",
    question: "Three in ten messages vanish on the way. What happens to the rumour?",
    options: ["About 30% of houses never hear it", "Everyone still hears it, a round or two later", "It stops spreading after a few rounds"],
    answer: 1,
    why: "Nobody depends on one particular message: every house hears the rumour from many directions, and lost messages are simply replaced by later random ones. Losing 30% only costs a round or so. This redundancy is why gossip works over unreliable networks without acknowledgements or retries.",
    watch: { houses: 40, fanout: 2, mode: "push-pull", loss: 0.3, timeout: 8, slow: 0 },
  },
  {
    id: "timeout",
    title: "How long before \"dead\"",
    change: "Failure timeout 4 → 8 → 16 rounds · heartbeats gossiped with fanout 2, slow links (3 in 10 messages arrive 1–3 rounds late)",
    question: "What does a short timeout do?",
    options: ["Detects real failures sooner with no downside", "Detects sooner, but healthy houses get declared dead", "Nothing: with gossip the timeout doesn't matter"],
    answer: 1,
    why: "A house's heartbeat needs a few rounds to travel through the gossip, more when links are slow. If the timeout is shorter than that, a perfectly healthy house looks silent and gets declared dead. A long timeout never cries wolf but takes longer to notice a real failure. The timeout has to cover the normal spreading time (which grows with the village size) plus slow links.",
    watch: { houses: 40, fanout: 2, mode: "push", loss: 0, timeout: 4, slow: 0.3 },
  },
];

const QUESTIONS = [
  ["Why does gossip reach a 10,000-node cluster in only a few more rounds than a 100-node cluster?",
    "Each round, every node that knows tells a few others, so the number that know multiplies (roughly by fanout + 1) until most know. Multiplying gets from 100 to 10,000 in a couple more steps: spreading time grows with log N, not with N."],
  ["Gossip never retries a lost message. Why does it still reach everyone?",
    "Every node hears the news from many random senders, so no single message matters; a lost one is replaced by the next random contact. Redundancy replaces acknowledgements, which is what makes gossip robust to loss, slow links and nodes coming and going."],
  ["What is the difference between push, pull and push-pull, and when does each shine?",
    "Push: nodes that know send it out; fast at the start, slow to reach the last few. Pull: every node asks a random peer; slow at the start, but finishes the tail quickly. Push-pull exchanges both ways and is fastest overall. Pull-style anti-entropy also repairs nodes that missed updates while they were down."],
  ["What does a bigger fanout buy, and what does it cost?",
    "Fewer rounds to reach everyone, because the informed population grows faster, but more messages per round, many of them redundant. Most systems pick a small fanout (2 to 4) and a short round interval instead."],
  ["In gossip-based failure detection, why can't the timeout be just one or two rounds?",
    "A node's heartbeat reaches others only by being passed along, which takes several rounds (about log N) and longer with slow links. A timeout shorter than that declares healthy nodes dead. Systems like Cassandra use a suspicion level (phi accrual) instead of a fixed cutoff, and SWIM asks other nodes to probe a suspect before declaring it dead."],
  ["Where is gossip used in practice?",
    "Cluster membership and failure detection (Consul/Serf with SWIM, Cassandra, Redis Cluster), spreading cluster state and metadata, anti-entropy repair between replicas, and eventually consistent data like counters and CRDTs. It suits information everyone should learn eventually, not things that need an immediate, agreed answer (that needs consensus)."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Gossip village",
  keys: [
    { mark: "lit", label: "Lit roof and lamp: the house has heard the rumour. Dot on a dashed arc: a messenger in flight" },
    { mark: "raised", label: "Pennant: the town hall suspects the house. Boards across the door: declared dead" },
    { mark: "flat", label: "Grey house: stopped. Dial and digit wheels: rounds of the current rumour" },
  ],
  caption:
    "Every round, each house that knows the rumour sends messengers to random houses (push), or every house asks a random house (pull), or both. A lamp lights when its house hears. When the whole village knows, a new rumour starts somewhere else. Meanwhile every house gossips heartbeats too, and the town hall keeps a pegboard of who it thinks is alive (tall peg alive, short peg suspected, empty hole dead) and marks each house to match: a pennant when it is suspected, boards across the door when it is declared dead. One house has already stopped when the page opens; stop another and watch it go grey, then get a pennant, then boards. A short peg on a house nobody stopped is a false suspicion: its heartbeat was just slow to arrive.",
  stage: 'data-office aria-label="Gossip village simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const controls = panel({
  stats: [["round", "Round"], ["know", "Know it", "–"], ["messages", "Messages"], ["last", "Last rumour", "–"], ["suspected", "Suspected"], ["dead", "Declared dead"]],
  controls: [
    seg("houses", "Houses", [[20, "20"], [40, "40"]], 40),
    seg("fanout", "Fanout", [[1, "1"], [2, "2"], [3, "3"]], 2),
    seg("mode", "Mode", [["push", "Push"], ["pull", "Pull"], ["push-pull", "Push-pull"]], "push"),
    seg("loss", "Messages lost", [[0, "0%"], [0.1, "10%"], [0.3, "30%"]], 0),
    seg("timeout", "Failure timeout", [[4, "4 rounds"], [8, "8"], [16, "16"]], 8),
    seg("slow", "Slow links", [[0, "Off"], [0.3, "On"]], 0),
    speedSeg(),
    actions("Do something", [["kill", "Stop a house"], ["revive", "Revive all"], ["reset", "Start over"], ["pause", "Pause"]]),
  ],
});

// Figure-specific styles: the lamp glow, stopped houses, hidden plots, peg states.
const css = `
.glow{fill:var(--anatomy-lit);stroke:none;opacity:0;transition:opacity .25s}
[data-lamp][data-on] .glow{opacity:1}
[data-lamp][data-on] .iso-solid>.iso-edge{stroke:var(--anatomy-lit)}
[data-house][data-dead] .iso-top,[data-house][data-dead] .iso-shade,[data-house][data-dead] .iso-fill{fill:var(--anatomy-faint)}
[data-house]>[data-flag],[data-house]>[data-boards]{display:none}
[data-house][data-view="suspected"]>[data-flag],[data-house][data-view="dead"]>[data-boards]{display:inline}
[data-boards] path{stroke-width:1.5;stroke:var(--anatomy-lo)}
.pennant{fill:var(--anatomy-mid);stroke:var(--anatomy-mid);stroke-width:.6;stroke-linejoin:round}
.roof>.iso-solid[data-lit]>.iso-top{fill:var(--anatomy-lit)}
.iso-face-text[data-tone="lit"]{fill:var(--anatomy-lit);font-weight:600}
.trail{fill:none;stroke:var(--anatomy-lit);stroke-width:.7;stroke-dasharray:1.6 1.6;opacity:.5}
[data-house][data-off]{display:none}
[data-peg]>[data-v]{display:none}
[data-peg][data-state="alive"]>[data-v="alive"],[data-peg][data-state="suspected"]>[data-v="suspected"]{display:inline}
[data-peg][data-off]{display:none}
.messenger{fill:var(--anatomy-lit);stroke:var(--anatomy-card);stroke-width:.6}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const needleAt = ${needleAt.toString().replace(/k\.lineOnTop/g, "lineOnTop")};
const flightPoint = ${flightPoint.toString()};
const DIAL = { x: 102, y: 44, r: 15, z: 7 };
const ROUND = 1.0, FLIGHT = 0.75, HOLD = 2, POOL = 160;

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const NS = "http://www.w3.org/2000/svg";
const houses = Array.from({ length: G.MEMBERS }, (_, m) => q('[data-house="' + m + '"]'));
const lamps = Array.from({ length: G.MEMBERS }, (_, m) => q('[data-lamp="' + m + '"]'));
const pegs = Array.from({ length: G.MEMBERS }, (_, m) => q('[data-peg="' + m + '"]'));
const needle = q("[data-needle]");
const roofs = houses.map((h) => h.querySelector(".roof>.iso-solid"));
const digits = [0, 1].map((i) => q('[data-digit="' + i + '"] text'));
const layer = q("[data-messengers]");
// Each messenger is a dot with a dashed trail back along its arc to the house that sent it.
const pool = Array.from({ length: POOL }, () => {
  const g = document.createElementNS(NS, "g"), t = document.createElementNS(NS, "path"), c = document.createElementNS(NS, "circle");
  t.setAttribute("class", "trail"); c.setAttribute("r", "2.1"); c.setAttribute("class", "messenger");
  g.append(t, c); g.style.display = "none"; layer.appendChild(g); return { g, t, c };
});

const cfg = { houses: 40, fanout: 2, mode: "push", loss: 0, timeout: 8, slow: 0, speed: 1 };
let seed = 8; // the first run is the same on every load; later runs differ
let clock, nextRound, member, spread, flights, shown, litAt, holdUntil, rumourRounds, lastRumour, totalRounds;

const pointOf = (m) => [G.HOMES[m][0], G.HOMES[m][1], G.HOME_Z[m] + 1.5];
const randomLive = () => { const live = []; for (let m = 0; m < cfg.houses; m++) if (member.alive[m]) live.push(m); return live[Math.floor(Math.random() * live.length)]; };

function newRumour() {
  const start = randomLive();
  spread = makeSpread({ n: cfg.houses, fanout: cfg.fanout, mode: cfg.mode, loss: cfg.loss, slow: cfg.slow, alive: member.alive.slice(0, cfg.houses), start }, seed++);
  shown = new Uint8Array(G.MEMBERS); litAt = new Float64Array(G.MEMBERS).fill(Infinity);
  shown[start] = 1; litAt[start] = clock;
  rumourRounds = 0; holdUntil = null;
  say("house " + start + " starts a rumour");
}

// stopEarly: a house that stopped a few rounds before the run starts, so the first frame already shows a suspected house.
function restart(stopEarly) {
  clock = 0; nextRound = ROUND; totalRounds = 0; flights = []; lastRumour = null;
  member = makeMembership({ n: cfg.houses, fanout: cfg.fanout, loss: cfg.loss, slow: cfg.slow, timeout: cfg.timeout }, seed++);
  const early = stopEarly ? Math.min(cfg.houses - 1, 13) : -1;
  for (let r = 0; r < 12; r++) { if (r === 12 - Math.ceil(cfg.timeout * 0.75) && early > 0) member.alive[early] = false; member.step(); }
  houses.forEach((h, m) => { h.toggleAttribute("data-off", m >= cfg.houses); h.toggleAttribute("data-dead", m === early); });
  pegs.forEach((p, m) => p.toggleAttribute("data-off", m >= cfg.houses));
  newRumour();
  // Start a little way in, so the first frame shows lit houses and messengers in flight.
  while (nextRound <= 2) { clock = nextRound; nextRound += ROUND; onRound(); }
  clock = 2.45 * ROUND;
  paint(); showStats();
}

function onRound() {
  totalRounds++;
  member.step();
  if (holdUntil !== null) {
    if (totalRounds >= holdUntil) newRumour();
    return;
  }
  rumourRounds++;
  for (const ev of spread.step()) {
    if (ev.arrives) { if (ev.informs) { shown[ev.to] = 1; litAt[ev.to] = clock; } continue; }
    const span = ev.slow ? ev.delay * ROUND : FLIGHT;
    flights.push({ from: ev.from, to: ev.to, t0: clock, span, lost: !!ev.lost });
    if (ev.informs) { shown[ev.to] = 1; litAt[ev.to] = clock + span; }
  }
  if (spread.done()) {
    lastRumour = { rounds: rumourRounds, messages: spread.messages };
    holdUntil = totalRounds + HOLD;
    say("everyone knows · " + rumourRounds + " rounds, " + spread.messages + " messages");
  } else say("round " + rumourRounds + " · messengers out");
}

function paint() {
  let heard = 0;
  for (let m = 0; m < G.MEMBERS; m++) {
    const on = m < cfg.houses && member.alive[m] && shown[m] && clock >= litAt[m];
    if (on) heard++;
    lamps[m].toggleAttribute("data-on", on);
    roofs[m].toggleAttribute("data-lit", on);
    houses[m].dataset.view = m === 0 || m >= cfg.houses ? "alive" : member.view(0, m);
  }
  let used = 0;
  flights = flights.filter((f) => clock < f.t0 + f.span);
  for (const f of flights) {
    if (used >= POOL) break;
    const u = Math.max(0, (clock - f.t0) / f.span);
    const a = pointOf(f.from), b = pointOf(f.to);
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    const p = flightPoint(a, b, e);
    let opacity = 1;
    if (f.lost && u > 0.5) { opacity = Math.max(0, 1 - (u - 0.5) * 3); p[2] -= (u - 0.5) * 20; }
    const [sx, sy] = iso(p, P);
    const trail = [];
    for (let i = 0; i <= 8; i++) trail.push(iso(flightPoint(a, b, (e * i) / 8), P));
    const o = pool[used++];
    o.c.setAttribute("cx", sx.toFixed(1)); o.c.setAttribute("cy", sy.toFixed(1));
    o.t.setAttribute("d", "M" + trail.map(([x, y]) => x.toFixed(1) + " " + y.toFixed(1)).join("L"));
    o.g.style.opacity = String(opacity); o.g.style.display = "";
  }
  for (let i = used; i < POOL; i++) pool[i].g.style.display = "none";
  const know = heard + "/" + spread.liveCount();
  if (statEls.know.textContent !== know) statEls.know.textContent = know;
  for (let m = 0; m < cfg.houses; m++) pegs[m].dataset.state = m === 0 ? "alive" : member.view(0, m);
  const frac = holdUntil === null ? Math.max(0, Math.min(1, 1 - (nextRound - clock) / ROUND)) : 0;
  needle.setAttribute("d", needleAt((rumourRounds + frac) / G.DIAL_ROUNDS));
  const shownRound = String(Math.min(99, rumourRounds)).padStart(2, "0");
  if (digits[0].textContent !== shownRound[0]) { digits[0].textContent = shownRound[0]; digits[1].textContent = shownRound[1]; }
  digits[1].textContent = shownRound[1];
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function showStats() {
  statEls.round.textContent = rumourRounds;
  statEls.messages.textContent = spread.messages;
  statEls.last.textContent = lastRumour ? lastRumour.rounds + " rounds" : "–";
  let s = 0, d = 0;
  for (let m = 1; m < cfg.houses; m++) { const v = member.view(0, m); if (v === "suspected") s++; if (v === "dead") d++; }
  statEls.suspected.textContent = s;
  statEls.dead.textContent = d;
}

function step(dt) {
  clock += dt * cfg.speed;
  while (clock >= nextRound) { nextRound += ROUND; onRound(); showStats(); }
  paint();
}

// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });
const NUMERIC = ["houses", "fanout", "loss", "timeout", "slow", "speed"];
function set(name, raw, quiet) {
  cfg[name] = NUMERIC.includes(name) ? Number(raw) : raw;
  WB.pressSeg(name, raw);
  if (name === "speed" || quiet) return;
  if (name === "timeout") { member.cfg.timeout = cfg.timeout; say("failure timeout " + cfg.timeout + " rounds"); return; }
  if (name === "slow") { member.cfg.slow = cfg.slow; say(cfg.slow ? "slow links on: 3 in 10 messages arrive late" : "slow links off"); return; }
  restart(); say("settings applied · run restarted");
}
function kill() {
  const live = []; for (let m = 1; m < cfg.houses; m++) if (member.alive[m]) live.push(m);
  if (!live.length) return;
  const m = live[Math.floor(Math.random() * live.length)];
  member.alive[m] = false; spread.live[m] = false;
  houses[m].setAttribute("data-dead", "");
  say("house " + m + " stopped · watch its peg");
  if (loop.paused) loop.setPaused(false);
}
function revive() {
  for (let m = 0; m < cfg.houses; m++) { member.alive[m] = true; spread.live[m] = true; houses[m].removeAttribute("data-dead"); }
  say("all houses running again");
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="kill"]').addEventListener("click", kill);
document.querySelector('[data-act="revive"]').addEventListener("click", revive);
document.querySelector('[data-act="reset"]').addEventListener("click", () => { restart(); say("started over"); });
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const r1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const halfToAll = (opts) => {
  let half = 0, total = 0, messages = 0; const seeds = 60;
  for (let k = 1; k <= seeds; k++) { const r = spreadRun(opts, k * 31); half += r.rounds - r.curve.findIndex((c) => c >= 0.5); total += r.rounds; messages += r.messages; }
  return { half: half / seeds, total: total / seeds, messages: messages / seeds };
};
const RUNS = {
  size: () => {
    const a = spreadAverage({ n: 40, fanout: 2, mode: "push" }, 40), b = spreadAverage({ n: 400, fanout: 2, mode: "push" }, 20), top = b.rounds * 1.15;
    return { verdict: "Rounds to reach every house: " + r1(a.rounds) + " with 40 houses, " + r1(b.rounds) + " with 400. Ten times the houses, " + r1(b.rounds - a.rounds) + " more rounds.",
      bars: [["40 houses", a.rounds / top, r1(a.rounds) + " rounds"], ["400 houses", b.rounds / top, r1(b.rounds) + " rounds", true]] };
  },
  fanout: () => {
    const a = spreadAverage({ n: 40, fanout: 1, mode: "push" }), b = spreadAverage({ n: 40, fanout: 3, mode: "push" });
    const tr = Math.max(a.rounds, b.rounds) * 1.1, tm = Math.max(a.messages, b.messages) * 1.1;
    return { verdict: "Rounds " + r1(a.rounds) + " → " + r1(b.rounds) + "; messages per rumour " + Math.round(a.messages) + " → " + Math.round(b.messages) + ".",
      bars: [["Rounds, fanout 1", a.rounds / tr, r1(a.rounds)], ["Rounds, fanout 3", b.rounds / tr, r1(b.rounds), true], ["Msgs, fanout 1", a.messages / tm, String(Math.round(a.messages))], ["Msgs, fanout 3", b.messages / tm, String(Math.round(b.messages)), true]] };
  },
  mode: () => {
    const p = halfToAll({ n: 40, fanout: 1, mode: "push" }), l = halfToAll({ n: 40, fanout: 1, mode: "pull" }), b = halfToAll({ n: 40, fanout: 1, mode: "push-pull" }), top = p.half * 1.15;
    return { verdict: "From half the village to every house: push " + r1(p.half) + " rounds, pull " + r1(l.half) + ", push-pull " + r1(b.half) + ". Messages per rumour: " + Math.round(p.messages) + ", " + Math.round(l.messages) + ", " + Math.round(b.messages) + ".",
      bars: [["Push", p.half / top, r1(p.half) + " rounds"], ["Pull", l.half / top, r1(l.half) + " rounds", true], ["Push-pull", b.half / top, r1(b.half) + " rounds", true]] };
  },
  loss: () => {
    const a = spreadAverage({ n: 40, fanout: 2, mode: "push-pull", loss: 0 }), b = spreadAverage({ n: 40, fanout: 2, mode: "push-pull", loss: 0.3 }), top = b.worst * 1.1;
    return { verdict: "Every house heard it in " + Math.round(100 * b.reached) + "% of runs with 30% loss. Rounds " + r1(a.rounds) + " → " + r1(b.rounds) + " (slowest run " + a.worst + " → " + b.worst + ").",
      bars: [["No loss", a.rounds / top, r1(a.rounds) + " rounds"], ["30% lost", b.rounds / top, r1(b.rounds) + " rounds", true]] };
  },
  timeout: () => {
    const rows = [4, 8, 16].map((t) => ({ t, ...detectionAverage({ n: 40, fanout: 2, slow: 0.3, timeout: t }) }));
    const td = Math.max(...rows.map((r) => r.detect)) * 1.1;
    return { verdict: "Healthy houses wrongly declared dead (out of 40): " + rows.map((r) => r1(r.falseDead) + " at " + r.t).join(", ") + ". Rounds until everyone notices a real failure: " + rows.map((r) => r1(r.detect)).join(", ") + ".",
      bars: [
        ...rows.map((r) => ["Wrongly dead, " + r.t, r.falseDead / 40, r1(r.falseDead), r.t === 4]),
        ...rows.map((r) => ["Detect, " + r.t + " rounds", r.detect / td, r1(r.detect) + " rds", r.t === 16]),
      ] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  for (const name of ["houses", "fanout", "mode", "loss", "timeout", "slow"]) set(name, String(w[name]), true);
  restart();
  if (loop.paused) loop.setPaused(false);
  if (exp.id === "timeout") setTimeout(kill, 3000);
  say("watching: " + exp.id);
} });

loop.setPaused(loop.paused);
restart(true);
`;

const size = writePage(new URL("./gossip-workbench.html", import.meta.url), {
  title: "Gossip Workbench",
  eyebrow: "Systems lesson 19 · Gossip protocols",
  lede: "Gossip spreads information the way a rumour moves through a village: every round, whoever knows tells a few random others. Nobody coordinates, nothing is retried, and yet everyone hears it fast. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
  machine: { intro: "Each lamp is a house that has heard the current rumour; the dots are messengers. The town hall's board shows which houses it believes are alive. Change the fanout or the mode, lose messages, or stop a house and watch its peg drop.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over 12 to 60 seeded runs.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote gossip-workbench.html", (size / 1024).toFixed(0) + " KB");

// Systems lesson 18 · Broadcast. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import * as k from "../../workbench/kit.mjs";
import { buildFigure, routeOf, P, gaugeTravel } from "./figure.mjs";
import { TOPOLOGIES, edgesOf, createNet, HOP } from "./sim.js";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "topology",
    title: "Pick a topology",
    change: "Grid → ring → hubs · 25 nodes, 100 values a second, 100 ms per message",
    question: "Challenge 3d asks for fewer than 30 messages per value, a median under 400 ms and a maximum under 600 ms. Which topology meets it?",
    options: ["The grid Maelstrom hands you: every node already has neighbours", "A ring: each node only ever talks to two others", "Hubs: leaves talk to their hub, hubs talk to each other"],
    answer: 2,
    why: "Flooding a grid sends every value down almost every wire (56 messages), and the far corner is 8 hops away (800 ms). A ring is cheap but slow: halfway round is 12 hops. Hubs keep every node within 3 hops of every other and send each value down each wire once. Sending straight from the first node to all 24 others also passes, but it needs every node connected to every other, which stops working long before 1,000 nodes.",
    watch: { topology: "hubs", batch: 0, retries: false, forward: "new" },
  },
  {
    id: "batch",
    title: "Batch the messages",
    change: "Hubs · batching off → one message per neighbour every 200 ms",
    question: "Challenge 3e asks for fewer than 20 messages per value, a median under 1 s and a maximum under 2 s. With batching every 200 ms…",
    options: ["Messages drop a little and latency stays the same", "Messages drop to a few per value; latency rises but stays inside 3e", "Messages drop, but latency blows past 3e's limits"],
    answer: 1,
    why: "At 100 values a second, a node has several new values each time it flushes, so one message carries many of them. Each value waits for the next flush at every hop, so latency grows with the batch interval. 200 ms is comfortably inside 3e; 500 ms pushes the median past 1 s. Batching trades latency for messages, the same deal as Kafka's linger.ms or Nagle's algorithm in TCP.",
    watch: { topology: "hubs", batch: 0.2, retries: false, forward: "new" },
  },
  {
    id: "partition",
    title: "Cut the network",
    change: "Hubs · the fence goes up between columns 2 and 3 for 3 seconds · no retries",
    question: "What happens to the values sent while the network is cut?",
    options: ["They arrive late, once the fence comes down", "Some never reach the far side", "Nothing: copies find another way round"],
    answer: 1,
    why: "A message sent across the cut is simply lost, and nobody sends it again, so values that started on one side never reach the other. Maelstrom's checker catches this as values missing from reads. Retrying every unacknowledged message until it is acknowledged gets everything through after the cut heals, at a price: every message now has an acknowledgement, so messages per value more than double.",
    watch: { topology: "hubs", batch: 0, retries: false, forward: "new", cut: true },
  },
  {
    id: "hub",
    title: "Lose a hub",
    change: "Hubs · the top-left hub is switched off",
    question: "Which nodes stop hearing new values?",
    options: ["Only the dead hub", "The dead hub's whole branch, and its leaves' values go nowhere", "Everyone: the network stops"],
    answer: 1,
    why: "In the hub topology each leaf has exactly one path to the rest of the network: its hub. When the hub dies, its leaves are cut off in both directions. The grid has many paths between any two nodes, so the same failure costs it nothing. Fewer wires means fewer messages and fewer ways round a failure; production systems keep two parents per node or fall back to gossip.",
    watch: { topology: "hubs", batch: 0, retries: false, forward: "new", kill: true },
  },
  {
    id: "forward",
    title: "Forward everything",
    change: "Grid · forward every copy you receive, not only values you haven't seen",
    question: "One value enters the network. How many messages in the first second?",
    options: ["About the same as before: 56", "A few hundred: some duplicates", "Tens of thousands, and still growing"],
    answer: 2,
    why: "Every node that forwards every copy turns one incoming message into three outgoing ones, and the grid has loops, so copies come back round and multiply at every hop. Remembering which values you've already seen makes forwarding idempotent: a second copy is ignored. Real systems do the same with message IDs, sequence numbers or a hop limit.",
    watch: { topology: "grid", batch: 0, retries: false, forward: "every" },
  },
];

const QUESTIONS = [
  ["The grid Maelstrom gives you connects every node. Why does flooding it fail challenge 3d?",
    "Flooding sends each new value to every neighbour except the sender, so a value crosses nearly every wire: 56 messages for 25 nodes. And the grid is wide: the far corner is 8 hops away, 800 ms at 100 ms a hop. Connected is not the same as short or cheap."],
  ["Sending straight from the first node to all 24 others gives 24 messages and 100 ms. Why not always do that?",
    "Every node needs a connection to every other one: 300 links for 25 nodes, about 500,000 for 1,000. Each node also has to know the full membership. Relays such as hubs keep each node's fan-out small and the path short, which is what scales."],
  ["What does batching trade, and where else have you seen the same trade?",
    "It trades latency for messages: values wait up to one interval at each hop, and one message carries many values. Kafka producers (linger.ms, batch size), Nagle's algorithm in TCP and log shippers all do the same."],
  ["Retries delivered everything across a cut network but doubled messages per value. Why, and how do real systems keep that down?",
    "Every message needs an acknowledgement, and unacknowledged ones are sent again. Systems acknowledge in batches, back off between retries, or skip per-message acks and periodically compare what each side has (anti-entropy), sending only the difference."],
  ["A hub dies and its branch goes dark. How would you design so one node can't cut off others?",
    "Give every node at least two independent paths: two parents, a ring of hubs with leaves connected to two hubs, or a gossip fallback. Detect the failure (heartbeats) and rewire around it."],
  ["Why must a node forward only values it hasn't seen?",
    "Networks with loops send copies back round. If every copy is forwarded, they multiply without end. Keeping a set of seen value IDs makes handling a duplicate a no-op. That's idempotency, the same idea as idempotency keys on an API."],
];

// ---------- page ----------
// Wire routes in screen space, from the lower-numbered node to the higher, for moving copies along them.
const ROUTES = Object.fromEntries(TOPOLOGIES.map((t) => [t, Object.fromEntries(edgesOf(t).map(([a, b]) => {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return [lo + "-" + hi, routeOf(t, lo, hi).map(([x, y]) => k.iso([x, y, 0.3], P).map((v) => Math.round(v * 10) / 10))];
}))]));

// A still frame for the figure at rest: the grid, one value 0.25 s after it entered node 7, copies halfway along their wires.
function stillFrame() {
  const ORIGIN = 6, AT = 0.25, flying = new Map();
  const net = createNet({ topology: "grid", rate: 0, seed: 1 }, { send: (m) => flying.set(m.id, m), deliver: (m) => flying.delete(m.id) });
  net.sendValue(ORIGIN);
  net.runTo(AT);
  const routes = ROUTES.grid, busy = {}, dots = [];
  for (const m of flying.values()) {
    const key = Math.min(m.from, m.to) + "-" + Math.max(m.from, m.to);
    busy[key] = 0.6;
    const pts = m.from < m.to ? routes[key] : [...routes[key]].reverse();
    const u = (AT - m.sent) / HOP;
    dots.push([+(pts[0][0] + (pts[1][0] - pts[0][0]) * u).toFixed(1), +(pts[0][1] + (pts[1][1] - pts[0][1]) * u).toFixed(1)]);
  }
  const lit = [...Array(25).keys()].filter((i) => net.seen[i].has(0));
  return { origin: ORIGIN, lit, busy, dots, mpo: 56, max: 0.8, text: "value 1 · entered at node 7 · " + lit.length + " of 25 lit" };
}
const STILL = stillFrame();

const figure = figurePlate({
  title: "Signal network",
  keys: [
    { mark: "lit", label: "The value being followed: lamps that have it, pucks for copies on the wires" },
    { mark: "raised", label: "Relay stations: 25 nodes, collars mark hubs" },
    { mark: "flat", label: "Wires (darker while busy) and two gauges with target pins" },
  ],
  caption:
    "Every node must learn every value. A value enters one station (ringed), and copies travel along the wires at 100 ms a hop until every lamp is lit. The network handles 100 values a second; the figure follows one at a time while the rest load the wires. The two gauges on the front edge measure the run: messages per value (left) and the slowest value (right, one tick per 100 ms hop). Tall pins mark challenge 3d’s limits, short pins 3e’s; a slider left of both pins passes. A fence between the second and third columns is a network cut. At 1/4 speed a hop takes 0.4 s.",
  stage: 'data-office aria-label="Broadcast network simulation. Space pauses or resumes."',
  readout: STILL.text,
  svg: buildFigure(STILL),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">Based on Fly.io's Gossip Glomers broadcast challenge (3a–3e), where your nodes are verified by Maelstrom: <a href="https://fly.io/dist-sys/" target="_blank" rel="noopener">fly.io/dist-sys</a>. Changing a setting starts the run again.</p>`;
const controls = panel({
  stats: [["mpo", "Msgs / value", "–"], ["median", "Median", "–"], ["max", "Max", "–"], ["delivered", "Reached all", "–"], ["values", "Values"], ["target", "Meets", "–"]],
  controls: [
    seg("topology", "Topology", [["grid", "Grid"], ["ring", "Ring"], ["hubs", "Hubs"], ["star", "Star"], ["direct", "Direct"]], "grid"),
    seg("batch", "Batching", [[0, "Off"], [0.1, "100 ms"], [0.2, "200 ms"], [0.5, "500 ms"]], 0),
    seg("retries", "Retry until acked", [["false", "Off"], ["true", "On"]], "false"),
    seg("forward", "Forward", [["new", "New values only"], ["every", "Every copy"]], "new"),
    speedSeg([[0.05, "1/20"], [0.1, "1/10"], [0.25, "1/4"], [1, "Real time"]], 0.25),
    actions("Do something", [["cut", "Cut the network"], ["kill", "Switch off a hub"], ["reset", "Start over"], ["pause", "Pause"]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
.busy{fill:none;stroke:var(--anatomy-mid);stroke-width:1.6;stroke-linecap:round}
.lens{fill:var(--anatomy-faint);stroke:none}
.lens[data-on]{fill:var(--anatomy-lit)}
.origin-ring{fill:none;stroke:var(--anatomy-lit);stroke-width:1.2;opacity:0}
.origin-ring[data-on]{opacity:1}
.station[data-dead]{opacity:.28}
.msg{fill:var(--anatomy-lit);stroke:none}
`;

// ---------- live code ----------
const live = `
${sim}
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const ROUTES = ${JSON.stringify(ROUTES)};
const GAUGE = ${JSON.stringify({ mpo: gaugeTravel("mpo"), max: gaugeTravel("max") })};
const KILL = { grid: 6, ring: 6, hubs: 6, star: 12, direct: 6 };

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const qa = (s) => [...svg.querySelectorAll(s)];
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const NS = "http://www.w3.org/2000/svg";
const topoEls = Object.fromEntries(TOPOLOGIES.map((t) => [t, q('[data-topo="' + t + '"]')]));
const busy = Object.fromEntries(TOPOLOGIES.map((t) => [t, Object.fromEntries([...topoEls[t].querySelectorAll("[data-e]")].map((el) => [el.dataset.e, el]))]));
const stations = qa("[data-station]");
const lenses = qa("[data-lens]");
const origins = qa("[data-origin]");
const collars = qa("[data-collar]");
const walls = qa("[data-wall]");
const dotLayer = q("[data-dots]");
dotLayer.textContent = "";
const gaugeEls = { mpo: q('[data-gauge="mpo"]'), max: q('[data-gauge="max"]') };
function setGauge(key, v) { const g = GAUGE[key], f = isFinite(v) ? Math.max(0, Math.min(1, v / g.max)) : 0; gaugeEls[key].setAttribute("transform", "translate(" + (g.dx * f).toFixed(2) + " " + (g.dy * f).toFixed(2) + ")"); }
const dots = Array.from({ length: 90 }, () => { const c = document.createElementNS(NS, "circle"); c.setAttribute("r", "3"); c.setAttribute("class", "msg"); c.style.display = "none"; dotLayer.appendChild(c); return c; });

const cfg = { topology: "grid", batch: 0, retries: false, forward: "new", speed: 0.25 };
let net, inflight, spot, nextSpotAt, history, seed = (Date.now() % 1e6) + 1, killed = null;
const keyOf = (a, b) => (a < b ? a + "-" + b : b + "-" + a);

function restart() {
  inflight = new Map();
  net = createNet({ topology: cfg.topology, batch: cfg.batch, retries: cfg.retries, forward: cfg.forward, rate: 100, seed: seed++, maxInFlight: 6000 }, {
    send: (m) => inflight.set(m.id, m),
    deliver: (m) => inflight.delete(m.id),
    drop: (m) => inflight.delete(m.id),
  });
  spot = null; nextSpotAt = 0.3; history = [[0, 0, 0]]; killed = null;
  TOPOLOGIES.forEach((t) => (topoEls[t].style.display = t === cfg.topology ? "" : "none"));
  const hubs = hubsOf(cfg.topology);
  collars.forEach((c, i) => (c.style.display = hubs.includes(i) ? "" : "none"));
  stations.forEach((s) => s.removeAttribute("data-dead"));
  walls.forEach((w) => (w.style.display = "none"));
  cutBtn.textContent = "Cut the network"; killBtn.textContent = cfg.topology === "hubs" || cfg.topology === "star" ? "Switch off a hub" : "Switch off a node";
  paint(); showStats();
}

function setCut(on) {
  net.setPartition(on);
  walls.forEach((w) => (w.style.display = on ? "" : "none"));
  cutBtn.textContent = on ? "Heal the network" : "Cut the network";
  say(on ? "network cut between columns 2 and 3" : "network healed");
}
function setKill(on) {
  const n = KILL[cfg.topology];
  if (on) { net.kill(n); killed = n; stations[n].setAttribute("data-dead", ""); }
  else { net.revive(n); killed = null; stations[n].removeAttribute("data-dead"); }
  killBtn.textContent = on ? "Switch it back on" : (cfg.topology === "hubs" || cfg.topology === "star" ? "Switch off a hub" : "Switch off a node");
  say(on ? "node " + (n + 1) + " switched off" : "node " + (n + 1) + " back on");
}

function pickSpot() {
  const op = net.ops[net.ops.length - 1];
  if (!op) return;
  spot = { id: op.id, origin: op.origin, start: net.t };
}

let statTimer = 0;
function step(dt) {
  const s = dt * cfg.speed;
  net.runTo(net.t + s);
  if (!spot || ((net.ops[spot.id].done || net.t - spot.start > 2.2) && net.t >= nextSpotAt)) {
    if (spot && !nextSpotAt) nextSpotAt = net.t + 0.35;
    if (!spot || net.t >= nextSpotAt) { pickSpot(); nextSpotAt = 0; }
  }
  const last = history[history.length - 1];
  if (net.t - last[0] >= 0.5) { history.push([net.t, net.stats.msgs, net.ops.length]); if (history.length > 24) history.shift(); }
  paint();
  statTimer += dt; if (statTimer > 0.3) { statTimer = 0; showStats(); }
}

function paint() {
  const t = net.t, routes = ROUTES[cfg.topology], load = {};
  let d = 0;
  for (const m of inflight.values()) {
    const key = keyOf(m.from, m.to);
    load[key] = (load[key] || 0) + 1;
    if (spot && d < dots.length && m.kind === "b" && m.values.includes(spot.id)) {
      const pts = routes[key]; if (!pts) continue;
      const path = m.from < m.to ? pts : [...pts].reverse();
      const u = Math.max(0, Math.min(1, (t - m.sent) / HOP));
      const [x, y] = along(path, u);
      dots[d].setAttribute("cx", x.toFixed(1)); dots[d].setAttribute("cy", y.toFixed(1)); dots[d].style.display = ""; d++;
    }
  }
  for (; d < dots.length; d++) dots[d].style.display = "none";
  for (const [key, el] of Object.entries(busy[cfg.topology])) {
    const o = Math.min(1, (load[key] || 0) / 5);
    const v = o > 0.02 ? o.toFixed(2) : "0";
    if (el.style.opacity !== v) el.style.opacity = v;
  }
  lenses.forEach((el, i) => el.toggleAttribute("data-on", !!spot && !net.dead.has(i) && net.seen[i].has(spot.id)));
  origins.forEach((el, i) => el.toggleAttribute("data-on", !!spot && spot.origin === i));
  if (spot) {
    const op = net.ops[spot.id];
    const lit = Math.min(op.have, 25);
    say("value " + (spot.id + 1) + " · entered at node " + (spot.origin + 1) + " · " + lit + " of " + op.target + " lit" + (op.done ? " in " + Math.round((op.done - op.t0) * 1000) + " ms" : "") + (net.stats.overload ? " · network flooded" : ""));
  }
}
function along(pts, u) {
  if (pts.length === 2) return [pts[0][0] + (pts[1][0] - pts[0][0]) * u, pts[0][1] + (pts[1][1] - pts[0][1]) * u];
  const seg = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
  let left = u * total;
  for (let i = 0; i < seg.length; i++) { if (left <= seg[i] || i === seg.length - 1) { const f = seg[i] ? Math.min(1, left / seg[i]) : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; } left -= seg[i]; }
  return pts[pts.length - 1];
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
const ms = (x) => (isFinite(x) ? (x >= 1 ? x.toFixed(2) + " s" : Math.round(x * 1000) + " ms") : "–");
function showStats() {
  const first = history[0], now = [net.t, net.stats.msgs, net.ops.length];
  const ops = now[2] - first[2];
  const mpo = ops > 0 ? (now[1] - first[1]) / ops : NaN;
  // Values from the last 12 s: finished ones give latency; unfinished ones older than 3 s count as not delivered.
  const win = net.ops.filter((o) => o.t0 >= Math.max(0, net.t - 12) && (o.done || o.t0 < net.t - 3));
  const lat = win.filter((o) => o.done).map((o) => o.done - o.t0).sort((a, b) => a - b);
  const median = lat.length ? lat[Math.floor(lat.length / 2)] : NaN, max = lat.length ? lat[lat.length - 1] : NaN;
  const delivered = win.length ? lat.length / win.length : NaN;
  statEls.mpo.textContent = isFinite(mpo) ? (mpo >= 100 ? Math.round(mpo).toLocaleString("en-US") : mpo.toFixed(1)) : "–";
  statEls.median.textContent = ms(median);
  statEls.max.textContent = ms(max);
  statEls.delivered.textContent = isFinite(delivered) ? Math.round(delivered * 100) + "%" : "–";
  statEls.values.textContent = net.ops.length.toLocaleString("en-US");
  setGauge("mpo", mpo); setGauge("max", max);
  const ok = (lim) => isFinite(mpo) && lat.length && delivered >= 0.999 && mpo < lim.m && median < lim.med && max < lim.max;
  statEls.target.textContent = !lat.length ? "–" : ok({ m: 20, med: 1, max: 2 }) && ok({ m: 30, med: 0.4, max: 0.6 }) ? "3d + 3e" : ok({ m: 20, med: 1, max: 2 }) ? "3e" : ok({ m: 30, med: 0.4, max: 0.6 }) ? "3d" : "neither";
}

// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const cutBtn = document.querySelector('[data-act="cut"]');
const killBtn = document.querySelector('[data-act="kill"]');
const clock = WB.loop({ stage, step, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });
function set(name, raw, quiet) {
  const value = name === "batch" || name === "speed" ? Number(raw) : name === "retries" ? raw === true || raw === "true" : raw;
  cfg[name] = value;
  WB.pressSeg(name, raw);
  if (name !== "speed" && !quiet) { restart(); say("settings applied · run restarted"); }
}
WB.onSegments((name, value) => set(name, value));
cutBtn.addEventListener("click", () => setCut(!net.partition));
killBtn.addEventListener("click", () => setKill(killed === null));
document.querySelector('[data-act="reset"]').addEventListener("click", () => { restart(); say("started over"); });
pauseBtn.addEventListener("click", () => clock.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); clock.toggle(); } });

// ---------- experiments ----------
const pct = (x) => Math.round(100 * x) + "%";
const n1 = (x) => (x >= 100 ? Math.round(x).toLocaleString("en-US") : x.toFixed(1));
const RUNS = {
  topology: () => {
    const rows = ["grid", "ring", "hubs"].map((t) => [t, runScenario({ topology: t })]);
    const top = Math.max(...rows.map(([, r]) => r.msgsPerOp));
    const name = { grid: "Grid", ring: "Ring", hubs: "Hubs" };
    return {
      verdict: rows.map(([t, r]) => name[t] + ": " + n1(r.msgsPerOp) + " messages, median " + ms(r.median) + ", max " + ms(r.max)).join(" · ") + ". Only hubs meets 3d.",
      bars: rows.map(([t, r]) => [name[t], r.msgsPerOp / top, n1(r.msgsPerOp) + " · " + ms(r.max), t === "hubs"]),
    };
  },
  batch: () => {
    const rows = [[0, "Off"], [0.2, "Every 200 ms"], [0.5, "Every 500 ms"]].map(([b, label]) => [label, runScenario({ topology: "hubs", batch: b })]);
    const top = Math.max(...rows.map(([, r]) => r.msgsPerOp));
    const [, off] = rows[0], [, b2] = rows[1], [, b5] = rows[2];
    return {
      verdict: "Messages per value " + n1(off.msgsPerOp) + " → " + n1(b2.msgsPerOp) + ", median " + ms(off.median) + " → " + ms(b2.median) + ", max " + ms(b2.max) + ": inside 3e. At 500 ms the median reaches " + ms(b5.median) + " and misses it.",
      bars: rows.map(([label, r], i) => [label, r.msgsPerOp / top, n1(r.msgsPerOp) + " · " + ms(r.median), i === 1]),
    };
  },
  partition: () => {
    const off = average({ topology: "hubs", duration: 10, partition: [3, 6] });
    const on = average({ topology: "hubs", duration: 10, partition: [3, 6], retries: true });
    return {
      verdict: "Without retries " + pct(off.delivered) + " of values reached every node; the rest never crossed. With retry-until-acked: " + pct(on.delivered) + ", but messages per value went from " + n1(off.msgsPerOp) + " to " + n1(on.msgsPerOp) + ".",
      bars: [["No retries", off.delivered, pct(off.delivered), true], ["Retry until acked", on.delivered, pct(on.delivered)]],
    };
  },
  hub: () => {
    const hubs = average({ topology: "hubs", kill: [6] });
    const grid = average({ topology: "grid", kill: [6] });
    return {
      verdict: "With the hub off, each value reached " + pct(hubs.reach) + " of the live nodes on average: its six leaves hear nothing and their values go nowhere. The grid with the same node off: " + pct(grid.reach) + ".",
      bars: [["Hubs, hub off", hubs.reach, pct(hubs.reach), true], ["Grid, node off", grid.reach, pct(grid.reach)]],
    };
  },
  forward: () => {
    const newOnly = oneValue({ forward: "new" }), every = oneValue({ forward: "every" });
    return {
      verdict: "One value caused " + newOnly.msgs + " messages forwarding only new values, and " + every.msgs.toLocaleString("en-US") + " in the first second forwarding every copy, still growing when the second ended.",
      bars: [["New values only", newOnly.msgs / every.msgs, String(newOnly.msgs)], ["Every copy", 1, every.msgs.toLocaleString("en-US"), true]],
    };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  ["topology", "batch", "retries", "forward"].forEach((name) => set(name, String(w[name]), true));
  restart();
  if (clock.paused) clock.setPaused(false);
  if (w.cut) { setTimeout(() => setCut(true), 1500); setTimeout(() => net.partition && setCut(false), 1500 + 3000 / cfg.speed); }
  if (w.kill) setTimeout(() => setKill(true), 1000);
} });

restart();
`;

const size = writePage(new URL("./broadcast-workbench.html", import.meta.url), {
  title: "Broadcast Workbench",
  eyebrow: "Systems lesson 18 · Broadcast",
  lede: "Broadcast means every node learns every value. Which nodes talk to which (the topology) decides how many messages that costs and how long it takes. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
  machine: { intro: 'Values enter at random stations and copies race along the wires. Switch topology and watch messages and latency change, then batch, cut the network or switch off a hub. It follows <a href="https://fly.io/dist-sys/3a/" target="_blank" rel="noopener">Gossip Glomers challenge 3</a>, which Maelstrom verifies for real.', figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine: 25 nodes, 100 values a second for 20 s, 100 ms per message.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote broadcast-workbench.html", (size / 1024).toFixed(0) + " KB");

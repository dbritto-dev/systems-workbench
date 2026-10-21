// Systems lesson 07 · Consistent hashing. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import * as F from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "modulo",
    title: "Add a node, modulo style",
    change: "bin = hash mod n · nodes 4 → 5",
    question: "One node joins a cluster of four. What share of the 1,000 keys has to move to a different node?",
    options: ["About a fifth: the new node takes its fair share", "About half", "About four in five"],
    answer: 2,
    why: "A key stays put only if hash mod 4 and hash mod 5 happen to agree, and that is true for just 4 numbers in every 20. Everything else is reshuffled, between every pair of nodes, not just toward the new one. On a cache cluster that means four in five reads suddenly miss.",
    watch: { mode: "modulo", count: 4, vnodes: 1, then: { count: 5 } },
  },
  {
    id: "ring",
    title: "Add a node, on a ring",
    change: "Hash ring, 1 marker per node · nodes 4 → 5",
    question: "Same change, but keys go to the next marker clockwise. Which keys move?",
    options: ["About a fifth, all of them taken from one neighbour", "About a fifth, taken evenly from all four nodes", "About four in five, the same as modulo"],
    answer: 0,
    why: "The new node's marker lands somewhere on the ring and claims only the arc just before it. Those keys used to slide on to the next marker clockwise, so they all come from that one neighbour. Every other key still reaches the same marker as before.",
    watch: { mode: "ring", count: 4, vnodes: 1, then: { count: 5 } },
  },
  {
    id: "balance",
    title: "Is the ring fair?",
    change: "Hash ring, 5 nodes · 1 marker per node",
    question: "Five nodes, one marker each, placed by hashing. How much does the busiest node get compared with a fair fifth?",
    options: ["About the same: hashing spreads things evenly", "About twice its fair share", "Nearly all the keys"],
    answer: 1,
    why: "Five random points cut the ring into five arcs of very different lengths, and each node owns one arc. Give every node many markers (virtual nodes) and each node owns many small arcs, which average out: with 100 markers the busiest node is close to fair.",
    watch: { mode: "ring", count: 5, vnodes: 1, then: { vnodes: 100 } },
  },
  {
    id: "fail",
    title: "A node fails",
    change: "Hash ring, 5 nodes, 1 marker per node · node C fails",
    question: "C's keys must go somewhere. Where do they go?",
    options: ["Spread evenly over the four survivors", "All to the next node clockwise", "Nowhere: they are lost until C comes back"],
    answer: 1,
    why: "With one marker per node, C's whole arc now slides on to the next marker, so one neighbour takes all of C's work on top of its own, often the moment it can least afford it. With many markers C's arcs are scattered round the ring and their next markers belong to different nodes, so the work spreads over everyone.",
    watch: { mode: "ring", count: 5, vnodes: 1, then: { failed: true } },
  },
  {
    id: "hot",
    title: "One very popular key",
    change: "Hash ring, 100 markers per node · key 7 gets 30% of all requests",
    question: "Does consistent hashing spread a hot key's traffic?",
    options: ["Yes: its requests are spread around the ring", "No: one node serves all of that key, and adding nodes barely helps", "Yes, as long as you add enough nodes"],
    answer: 1,
    why: "Consistent hashing decides where each key lives, and a key lives on one node. The node that owns key 7 carries 30% of the traffic plus its own share of the rest, however many nodes you add. Hot keys need a different tool: replicate that key to several nodes, cache it closer to the callers, or split it into sub-keys.",
    watch: { mode: "ring", count: 3, vnodes: 100, hot: true, then: { count: 6 } },
  },
];

const QUESTIONS = [
  ["Why does hash mod n move almost every key when n changes by one?",
    "A key keeps its node only when hash mod n and hash mod (n + 1) agree, which happens for about 1 in n + 1 keys. So going from 4 to 5 nodes keeps about 1 in 5 and moves the other 80%, between all pairs of nodes, not just onto the new one."],
  ["On a ring, exactly which keys move when a node is added, and where do they come from?",
    "Only the keys in the arc between the new marker and the previous marker counter-clockwise. They used to slide on to the next marker clockwise, so they all come from that node. Every other key reaches the same marker as before."],
  ["What problem do virtual nodes solve? Name two.",
    "Balance: a few random markers cut the ring into very uneven arcs (the busiest node had about 2.3× its fair share with one marker); many markers per node average out. Failure: with one marker a dead node's whole arc lands on one neighbour; with many, its arcs spread over all survivors. They also let a bigger machine take more markers."],
  ["You run a cache cluster in front of a database and add a node. Compare modulo and a ring.",
    "With modulo about 80% of keys now map to a different node, so 80% of reads miss at once and hit the database: the same stampede as emptying the cache. With a ring only about 1 in n + 1 keys move, so the miss spike is small and lands on the keys of one neighbour."],
  ["One key gets 30% of all requests and its node is overloaded. What would you do?",
    "Consistent hashing won't help: a key lives on one node. Replicate the hot key to several nodes and read from any of them, cache it closer to the callers (in-process), or split it into sub-keys (key#1…key#n) and combine the results. Also find out why one key is that hot."],
  ["Where have you met consistent hashing in real systems?",
    "Memcached and Redis client-side sharding, Cassandra and DynamoDB partitioning, load balancers that keep a user on the same backend (Envoy ring hash, Maglev), and CDNs choosing which edge server holds an object. A good answer also notes that moving a key means moving its data, which is why moving fewer keys matters."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Sorting carousel",
  keys: [
    { mark: "lit", label: "The card in play, and cards that move" },
    { mark: "raised", label: "Turntable: the hash ring, 0–360°" },
    { mark: "flat", label: "Bins A–F, left to right: stack height is each node's share" },
  ],
  caption:
    "Each card is one of 1,000 keys. In ring mode it lands at its hash angle, slides clockwise to the next marker peg and goes to that peg's bin. Flip the lever to modulo and the drum picks bin number hash mod n instead. Change the cluster and only the cards that must move fly to their new bin.",
  stage: 'data-office aria-label="Sorting carousel simulation. Space pauses or resumes."',
  svg: F.buildFigure(),
});

const controls = panel({
  stats: [["nodes", "Nodes", "4"], ["moved", "Moved, last change", "–"], ["ratio", "Busiest ÷ fair", "–"], ["busiest", "Busiest node", "–"], ["quietest", "Quietest node", "–"], ["sorted", "Cards sorted"]],
  controls: [
    seg("mode", "Sorting", [["ring", "Hash ring"], ["modulo", "hash mod n"]], "ring"),
    seg("count", "Nodes", [[3, "3"], [4, "4"], [5, "5"], [6, "6"]], 4),
    seg("vnodes", "Markers per node", [[1, "1"], [10, "10"], [100, "100"]], 1),
    seg("failed", "Node C", [["false", "Up"], ["true", "Failed"]], "false"),
    seg("hot", "Hot key (30% of traffic)", [["false", "Off"], ["true", "On"]], "false"),
    speedSeg(),
    actions("Do something", [["reset", "Start over"], ["pause", "Pause"]]),
  ],
});

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(F.P)};
const G = ${JSON.stringify(F.GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const k = { iso, depthOf, slabOf, cylinder, solidSvg, lineSvg, dotsSvg, lineOnTop, ring, planOutline, insetPlan, haloOf, sideSeam, translateAlong };
const S = (paths, style) => solidSvg(paths, style), L = (d, style) => lineSvg(d, style), D = (pts, style) => dotsSvg(pts, style), at = (p) => iso(p, P);
const RING = G.RING, DRUM = G.DRUM, BINS = G.BINS, TRAY_H = G.TRAY_H, CARD = G.CARD, STACK_SCALE = G.STACK_SCALE, LEVER = G.LEVER, MOUTH = G.MOUTH;
const rad = (deg) => (deg * Math.PI) / 180;
const onRing = ${F.onRing.toString()};
const onDrum = ${F.onDrum.toString()};
const stackHeight = ${F.stackHeight.toString()};
const stackTop = ${F.stackTop.toString()};
${F.pegsSvg.toString()}
${F.drumFace.toString()}
${F.leverSvg.toString()}
${F.binSvg.toString()}
${F.cardSvg.toString()}
const SALT = 25;
const CARD_SVG = cardSvg();

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const pegsEl = q("[data-pegs]"), trackEl = q("[data-track]"), drumEl = q("[data-drum]"), leverEl = q("[data-lever]"), binsEl = q("[data-bins]"), flyEl = q("[data-fly]");
const DEFAULTS = { mode: "ring", count: 4, vnodes: 1, failed: false, hot: false };
const cfg = { ...DEFAULTS, speed: 1 };
let random = rng(20261019);
let owners, share, points, shown = {}, needle = 0, sorted = 0, lastMove = null, litBin = -1;
let steps = [], current = null;

const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const arc = (a, b, t, lift) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t) + Math.sin(Math.PI * t) * lift];
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const pct = (x) => (100 * x).toFixed(x < 0.1 ? 1 : 0) + "%";
const activeNodes = () => NODE_IDS.slice(0, cfg.count).filter((n) => !(cfg.failed && n === "C"));
const binIndex = (node) => NODE_IDS.indexOf(node);
const binState = (i) => i >= cfg.count ? "absent" : cfg.failed && NODE_IDS[i] === "C" ? "down" : "up";

function recompute() {
  const nodes = activeNodes();
  owners = assign({ mode: cfg.mode, nodes, vnodes: cfg.vnodes, salt: SALT });
  share = loads(owners, nodes, cfg.hot);
  points = ringPoints(nodes, cfg.vnodes, SALT);
}
const shareOf = (map, id) => map[id] || 0;

function drawPegs(lit = null) { pegsEl.innerHTML = cfg.mode === "ring" ? pegsSvg(points, lit) : ""; }
function drawDrum(active = false) { drumEl.innerHTML = drumFace(activeNodes().length, needle, active); }
function drawLever() { leverEl.innerHTML = leverSvg(cfg.mode); }
function drawBins() {
  const order = BINS.map((b, i) => i).sort((a, b) => depthOf([BINS[a].cx, BINS[a].y, 0], P) - depthOf([BINS[b].cx, BINS[b].y, 0], P));
  binsEl.innerHTML = order.map((i) => binSvg(i, shareOf(shown, NODE_IDS[i]), binState(i), i === litBin)).join("");
}
const cardAt = (p) => '<g transform="' + translateAlong(P, p) + '">' + CARD_SVG + "</g>";
function drawFly(list) { flyEl.innerHTML = list.map(cardAt).join(""); }
function drawTrack(list) { trackEl.innerHTML = list.map(cardAt).join(""); }

function showStats() {
  const nodes = activeNodes(), s = spread(Object.fromEntries(nodes.map((n) => [n, share[n]])));
  const busiest = nodes.reduce((a, b) => (share[b] > share[a] ? b : a)), quietest = nodes.reduce((a, b) => (share[b] < share[a] ? b : a));
  const set = (key, text) => { document.querySelector('[data-s="' + key + '"]').textContent = text; };
  set("nodes", nodes.length + (cfg.failed && cfg.count >= 3 ? " (C down)" : ""));
  set("moved", lastMove ? lastMove.count + " · " + pct(lastMove.share) : "–");
  set("ratio", s.ratio.toFixed(2) + "×");
  set("busiest", busiest + " · " + pct(share[busiest]));
  set("quietest", quietest + " · " + pct(share[quietest]));
  set("sorted", sorted);
}

function nextKey() { return cfg.hot && random() < HOT_SHARE ? HOT_KEY : Math.floor(random() * KEYS); }

function streamCard() {
  const key = nextKey(), node = owners[key], bin = binIndex(node), name = "key " + key + (cfg.hot && key === HOT_KEY ? " (hot)" : "");
  const rise = [MOUTH[0], MOUTH[1], MOUTH[2] + 4];
  steps.push({ dur: 0.3, run: (t) => drawFly([[MOUTH[0], MOUTH[1], MOUTH[2] - 6 + 10 * ease(t)]]) });
  if (cfg.mode === "ring") {
    const angle = keyAngle(key), peg = ownerOnRing(points, angle), dist = (peg.angle - angle + 360) % 360;
    const land = [...onRing(angle, RING.track), RING.top];
    say(name + " · lands at " + angle.toFixed(0) + "°");
    steps.push({ dur: 0.6, run: (t) => drawFly([arc(rise, land, ease(t), 14)]), done: () => drawFly([]) });
    steps.push({ dur: 0.35 + 1.5 * dist / 360, run: (t) => drawTrack([[...onRing(angle + dist * ease(t), RING.track), RING.top]]) });
    steps.push({ dur: 0.2, begin: () => { drawPegs(peg.angle); say(name + " · " + angle.toFixed(0) + "° → marker at " + peg.angle.toFixed(0) + "° → " + node); } });
    const from = [...onRing(peg.angle, RING.track), RING.top];
    steps.push({ dur: 0.75, begin: () => drawTrack([]), run: (t) => drawFly([arc(from, stackTop(bin, shareOf(shown, node)), ease(t), 26)]), done: () => land2(bin) });
  } else {
    const n = activeNodes().length, slot = keyHash(key) % n, top = [DRUM.cx, DRUM.cy, DRUM.top + 0.5];
    say(name + " · hash mod " + n + " = " + slot + " → " + node);
    steps.push({ dur: 0.6, run: (t) => drawFly([arc(rise, top, ease(t), 12)]) });
    const from = needle;
    let to = slot; if (to < from) to += n;
    steps.push({ dur: 0.45, run: (t) => { needle = (from + (to - from) * ease(t)) % n; drawDrum(true); }, done: () => { needle = slot; drawDrum(false); } });
    steps.push({ dur: 0.75, run: (t) => drawFly([arc(top, stackTop(bin, shareOf(shown, node)), ease(t), 24)]), done: () => land2(bin) });
  }
  function land2(b) { drawFly([]); drawPegs(null); sorted++; litBin = b; drawBins(); showStats(); }
  steps.push({ dur: 0.3, done: () => { litBin = -1; drawBins(); } });
}

// Change the cluster: recompute the model, then fly only the cards whose owner changed.
function reconfigure(label, change) {
  const beforeOwners = owners, beforeShare = { ...share };
  change();
  recompute();
  const mv = moved(beforeOwners, owners);
  lastMove = mv;
  const sources = Object.entries(mv.from).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const fromText = mv.count === 0 ? "" : sources.length === 1 ? " · all from " + sources[0] : " · from " + sources.length + " nodes";
  steps = []; current = null; drawFly([]); drawTrack([]); drawPegs(null); drawLever(); drawDrum(false); litBin = -1;
  const sample = [];
  for (let key = 0; key < KEYS; key += 25) if (beforeOwners[key] !== owners[key]) sample.push(key);
  const target = { ...share };
  const total = 1.1 + 0.035 * sample.length;
  say(label + " · " + mv.count + " of 1,000 keys moved (" + pct(mv.share) + ")" + fromText);
  steps.push({ dur: total, run: (t) => {
    const time = t * total;
    for (const id of NODE_IDS) shown[id] = lerp(shareOf(beforeShare, id), shareOf(target, id), ease(Math.min(1, time / total)));
    drawBins();
    const flying = [];
    sample.forEach((key, i) => {
      const u = (time - 0.035 * i) / 1.0;
      if (u <= 0 || u >= 1) return;
      const a = binIndex(beforeOwners[key]), b = binIndex(owners[key]);
      flying.push(arc(stackTop(a, shown[beforeOwners[key]] || 0), stackTop(b, shown[owners[key]] || 0), ease(u), 30));
    });
    drawFly(flying);
  }, done: () => { shown = { ...target }; drawFly([]); drawBins(); showStats(); } });
  steps.push({ dur: 1.2 });
  showStats();
}

function advance(dt) {
  let left = dt, guard = 0;
  while (left > 1e-9 && guard++ < 50) {
    if (!current) {
      current = steps.shift();
      if (!current) { streamCard(); continue; }
      current.elapsed = 0; current.begin && current.begin();
    }
    const use = Math.min(current.dur - current.elapsed, left);
    current.elapsed += use; left -= use;
    current.run && current.run(Math.min(1, current.dur ? current.elapsed / current.dur : 1));
    if (current.elapsed >= current.dur - 1e-9) { const c = current; current = null; c.done && c.done(); }
  }
}

// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => advance(dt * cfg.speed), onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });
const pressSeg = WB.pressSeg;
const LABELS = {
  mode: (v) => v === "ring" ? "switched to the hash ring" : "switched to hash mod n",
  count: (v, before) => v > before ? (v - before === 1 ? NODE_IDS[v - 1] + " added" : "nodes " + before + " → " + v) : (before - v === 1 ? NODE_IDS[before - 1] + " removed" : "nodes " + before + " → " + v),
  vnodes: (v) => v + (v === 1 ? " marker" : " markers") + " per node",
  failed: (v) => v ? "C failed" : "C is back",
  hot: (v) => v ? "key 7 is hot" : "no hot key",
};
function apply(changes) {
  const parsed = {};
  for (const [name, raw] of Object.entries(changes)) {
    parsed[name] = name === "count" || name === "vnodes" ? Number(raw) : name === "failed" || name === "hot" ? raw === true || raw === "true" : raw;
  }
  const real = Object.entries(parsed).filter(([name, v]) => cfg[name] !== v);
  for (const [name, v] of Object.entries(parsed)) pressSeg(name, v);
  if (!real.length) return;
  const label = real.map(([name, v]) => LABELS[name](v, cfg[name])).join(" · ");
  reconfigure(label, () => { for (const [name, v] of real) cfg[name] = v; });
  if (loop.paused) loop.setPaused(false);
}
WB.onSegments((name, value) => {
  if (name === "speed") { cfg.speed = Number(value); pressSeg("speed", cfg.speed); return; }
  apply({ [name]: value });
});
function startOver(config = DEFAULTS) {
  Object.assign(cfg, config);
  for (const name of Object.keys(DEFAULTS)) pressSeg(name, cfg[name]);
  random = rng(20261019); sorted = 0; lastMove = null; needle = 0;
  recompute(); shown = { ...share }; steps = []; current = null;
  drawPegs(); drawDrum(); drawLever(); drawBins(); drawFly([]); drawTrack([]); showStats();
  say(cfg.mode === "ring" ? "hash ring · " + activeNodes().length + " nodes" : "hash mod " + activeNodes().length);
}
document.querySelector('[data-act="reset"]').addEventListener("click", () => startOver());
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const N = (n) => NODE_IDS.slice(0, n);
const RUNS = {
  modulo: () => {
    const m = moved(assign({ mode: "modulo", nodes: N(4) }), assign({ mode: "modulo", nodes: N(5) })).share;
    return { verdict: pct(m) + " of the keys moved to a different node, against 20% that had to.", bars: [["hash mod n", m, pct(m), true], ["Least possible", 0.2, "20%"]] };
  },
  ring: () => {
    const m = moved(assign({ mode: "modulo", nodes: N(4) }), assign({ mode: "modulo", nodes: N(5) })).share;
    const r = overClusters((s) => moved(assign({ nodes: N(4), salt: s }), assign({ nodes: N(5), salt: s })).share);
    const one = overClusters((s) => Object.keys(moved(assign({ nodes: N(4), salt: s }), assign({ nodes: N(5), salt: s })).from).length <= 1 ? 1 : 0);
    return { verdict: "On average " + pct(r) + " of keys moved, and in " + pct(one) + " of clusters they all came from a single neighbour.", bars: [["hash mod n", m, pct(m)], ["Hash ring", r, pct(r), true]] };
  },
  balance: () => {
    const ratio = (v) => overClusters((s) => spread(loads(assign({ nodes: N(5), vnodes: v, salt: s }), N(5))).ratio);
    const r1 = ratio(1), r10 = ratio(10), r100 = ratio(100), top = 2.6;
    return { verdict: "With one marker per node the busiest node carried " + r1.toFixed(2) + "× its fair share on average. With 100 markers, " + r100.toFixed(2) + "×.", bars: [["1 marker", r1 / top, r1.toFixed(2) + "×", true], ["10 markers", r10 / top, r10.toFixed(2) + "×"], ["100 markers", r100 / top, r100.toFixed(2) + "×"]] };
  },
  fail: () => {
    const without = N(5).filter((n) => n !== "C");
    const receivers = (v) => overClusters((s) => Object.keys(moved(assign({ nodes: N(5), vnodes: v, salt: s }), assign({ nodes: without, vnodes: v, salt: s })).to).length);
    const r1 = receivers(1), r100 = receivers(100);
    return { verdict: "With one marker per node, C's keys went to " + r1.toFixed(1) + " node on average. With 100 markers they spread over " + r100.toFixed(1) + " of the 4 survivors.", bars: [["1 marker", r1 / 4, r1.toFixed(1) + " of 4", true], ["100 markers", r100 / 4, r100.toFixed(1) + " of 4"]] };
  },
  hot: () => {
    const busiest = (n) => overClusters((s) => spread(loads(assign({ nodes: N(n), vnodes: 100, salt: s }), N(n), true)).max, 50);
    const b3 = busiest(3), b6 = busiest(6);
    return { verdict: "The busiest node served " + pct(b3) + " of all requests with 3 nodes and still " + pct(b6) + " with 6, where a fair share is 17%.", bars: [["3 nodes", b3, pct(b3)], ["6 nodes", b6, pct(b6), true], ["Fair share, 6", 1 / 6, "17%"]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const { then, ...first } = exp.watch;
  startOver({ ...DEFAULTS, ...first });
  if (loop.paused) loop.setPaused(false);
  if (then) setTimeout(() => apply(then), 3500);
} });

startOver();
loop.setPaused(loop.paused);
`;

const size = writePage(new URL("./hash-ring-workbench.html", import.meta.url), {
  title: "Hash Ring Workbench",
  eyebrow: "Systems lesson 07 · Consistent hashing",
  lede: "When data is split across nodes, every key needs a home, and adding or losing a node should move as few keys as possible. This lesson compares two ways of choosing the home, hash mod n and a hash ring, three ways: watch a machine do it, predict what each change does, then explain it back.",
  machine: { intro: "The turntable is the hash ring and the bins along the front are the nodes. Watch a few cards find their bin, then add a node, switch to hash mod n and add it again, and compare how many cards fly.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results use the machine's own model with 1,000 keys; ring results are averaged over 200 clusters, because they depend on where the markers happen to land.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  script: live,
});
console.log("wrote hash-ring-workbench.html", (size / 1024).toFixed(0) + " KB");

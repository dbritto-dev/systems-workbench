// Systems lesson 20 · Logs and offsets. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, carSvg, P, GEOMETRY } from "./figure.mjs";
import * as M from "./sim.js";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "order",
    title: "Order per customer",
    change: "Records with no key (any track) vs keyed by customer · 3 tracks, 3 consumers, 4 records/s",
    question: "Each customer's records are created in order: created, paid, shipped. With no key, how often is a customer's record read before an earlier one of the same customer?",
    options: ["Never: a log keeps records in order", "Sometimes: order only holds within one track", "Almost always"],
    answer: 1,
    why: "A log is ordered per track, not across tracks. Without a key, one customer's records land on different tracks, and each track is read by its own consumer at its own pace, so a later record can be read first. Keying by customer sends all of that customer's records to one track, where one consumer reads them in order.",
    watch: { keying: "random", partitions: 3, consumers: 3, commit: "after", rate: 4, retention: 0 },
  },
  {
    id: "crash",
    title: "A consumer crashes",
    change: "Consumer 1 crashes in the middle of a batch every 10 s · commit after processing vs before",
    question: "Committing after processing, what happens to the records it had processed but not yet committed when it crashed?",
    options: ["They are lost", "They are read again after the restart", "Nothing: the log remembers what was processed"],
    answer: 1,
    why: "After a restart a consumer continues from the committed offset, the bookmark. Commit after processing and the records processed since the last commit are read a second time (at least once), so the handler must be idempotent. Commit before processing and the records that were committed but never processed are skipped for good (at most once).",
    watch: { keying: "key", partitions: 3, consumers: 3, commit: "after", rate: 4, retention: 0, crashes: true },
  },
  {
    id: "group",
    title: "More consumers than tracks",
    change: "3 tracks · producer at 8 records/s · consumers in the group 3 → 6",
    question: "Three consumers can't keep up. With six, how many records are read per minute?",
    options: ["About twice as many", "The same: three consumers get no track", "Fewer, because they fight over the tracks"],
    answer: 1,
    why: "Within a group each track is read by exactly one consumer, which is what keeps it in order. Three tracks means at most three consumers doing work; the other three stand by. To read faster you need more tracks (partitions), and that is much easier to plan up front than to change later.",
    watch: { keying: "key", partitions: 3, consumers: 6, commit: "after", rate: 8, retention: 0 },
  },
  {
    id: "hot",
    title: "A hot customer",
    change: "70% of records are for customer A · keyed by customer · 3 tracks, 3 consumers, 4 records/s",
    question: "After a minute, where is the lag?",
    options: ["Spread evenly over the three tracks", "Almost all on customer A's track", "Nowhere: three consumers can handle 4 records/s"],
    answer: 1,
    why: "Every record for A goes to one track, and one consumer reads it at about 2 records/s while A alone sends 2.8. The other two tracks sit nearly empty. More tracks don't help a single key; if the order only matters per order or per device, key by that instead so the load spreads.",
    watch: { keying: "hot", partitions: 3, consumers: 3, commit: "after", rate: 4, retention: 0 },
  },
  {
    id: "replay",
    title: "Rebuild from the log",
    change: "After 90 s the customer totals are wiped · every bookmark is rewound to the oldest record and read again · keep all records vs keep 20 s",
    question: "Keeping every record, how many of the 6 customer totals come back right?",
    options: ["None: records are gone once they're read", "All 6", "Only the customers seen most recently"],
    answer: 1,
    why: "Reading a log doesn't remove anything; consumers only move a bookmark. Rewind the bookmark and the same records are read again, so a broken read model can be rebuilt from scratch. That only works for what the log still keeps: with 20 s of retention most of the history is already gone, and no total comes back right.",
    watch: { keying: "key", partitions: 3, consumers: 3, commit: "after", rate: 4, retention: 0, rewindAt: 15 },
  },
];

const QUESTIONS = [
  ["Why does the producer pick a track by key, and what exactly does that guarantee?",
    "The same key always goes to the same track, and a track is read in order by one consumer, so all records for one key are processed in the order they were written. There is no ordering guarantee between different keys or different tracks."],
  ["Commit after processing or before? Which guarantee does each give, and what does the handler need?",
    "After processing gives at-least-once: after a crash some records are read again, so the handler must be idempotent (for example, dedupe by record id or use upserts). Before processing gives at-most-once: nothing is repeated, but records committed and not yet processed are lost."],
  ["A topic has 3 partitions and you scale the consumer group to 10 to catch up. What happens, and what should you change?",
    "Only 3 consumers get a partition; 7 sit idle and throughput doesn't change. Add partitions (and plan for it early, since it changes which partition a key maps to), or make each consumer faster."],
  ["One customer produces most of the traffic. What do you see, and what can you do?",
    "Lag builds on that customer's partition while the others are idle. More partitions don't help one key. Key by something finer when order only matters per order or per device, or split that customer's work after the log."],
  ["How is a log different from a queue where reading deletes the message?",
    "A log keeps records until retention removes them, whether or not anyone read them. Each consumer group has its own bookmark, so many groups can read the same records independently, and any group can rewind and replay."],
  ["A consumer restarts. How does it know where to continue, and why do offsets have to keep increasing?",
    "The group stores a committed offset per partition (in Gossip Glomers this is `commit_offsets` and `list_committed_offsets`), and the consumer resumes there. Offsets only grow, so \"committed offset 120\" means everything below 120 is done; if offsets could repeat or go backwards, a bookmark would mean nothing."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Rail yard",
  keys: [
    { mark: "lit", label: "The record being read" },
    { mark: "raised", label: "Car: a record; plate = offset, roof dots = customer A–F" },
    { mark: "flat", label: "Gantry board = committed offset · counter over the door = lag" },
  ],
  caption:
    "Each track is a partition. The transfer table couples every new car (record) to the near end of one track; older cars roll back into the archive shed, where they are kept. Each numbered reading cabin is a consumer; an overhead wire runs from its mast to the bookmark gantry on every track it owns, and the gantry's board shows the committed offset: the next car the group still has to read. The counter above each shed door shows that track's lag: the cars past its bookmark. A line on a car's roof means it has been read. Reading never removes a car.",
  stage: 'data-office aria-label="Rail yard simulation of a Kafka-style log. Space pauses or resumes."',
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">Changing a setting starts the run again with empty tracks. Consumer 1 is the leftmost cabin.</p>`;
const controls = panel({
  stats: [["produced", "Produced"], ["processed", "Read"], ["lag", "Lag"], ["duplicates", "Read twice"], ["lost", "Lost"], ["order", "Out of order"]],
  controls: [
    seg("partitions", "Tracks (partitions)", [[2, "2"], [3, "3"], [4, "4"]], 3),
    seg("consumers", "Consumers in the group", [[1, "1"], [2, "2"], [3, "3"], [4, "4"], [6, "6"]], 3),
    seg("keying", "Records keyed", [["random", "No key"], ["key", "By customer"], ["hot", "Hot customer"]], "key"),
    seg("commit", "Commit", [["after", "After processing"], ["before", "Before processing"]], "after"),
    seg("rate", "Producer", [[2, "2/s"], [4, "4/s"], [8, "8/s"]], 4),
    seg("retention", "Log keeps", [[0, "Everything"], [20, "Last 20 s"]], 0),
    speedSeg(),
    actions("Do something", [["crash", "Crash consumer 1"], ["rewind", "Rewind and rebuild"], ["reset", "Start over"], ["pause", "Pause"]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
.door{fill:var(--anatomy-shade-0);stroke:none}
.shutter{fill:var(--anatomy-lo);stroke:none}
.window{fill:var(--anatomy-shade-0);stroke:none}
.cable{fill:none;stroke:var(--anatomy-mid);stroke-width:var(--anatomy-weight);stroke-linecap:round;stroke-linejoin:round}
[data-track][data-off],[data-cabin][data-off]{display:none}
`;

// ---------- experiment results (headless, same model) ----------
const pct = (x) => Math.round(100 * x) + "%";
const order = { random: M.orderRun("random"), key: M.orderRun("key") };
const crash = { after: M.crashRun("after"), before: M.crashRun("before") };
const group = { three: M.groupRun(3), six: M.groupRun(6) };
const hot = M.hotRun("hot"), even = M.hotRun("key");
const replay = { all: M.replayRun(0), short: M.replayRun(20) };
const R = (n) => Math.round(n);
const RESULTS = {
  order: {
    verdict: `No key: ${pct(order.random)} of records were read before an earlier record of the same customer. Keyed by customer: ${pct(order.key)}.`,
    bars: [["No key", order.random / Math.max(order.random, 0.01), pct(order.random), true], ["By customer", order.key / Math.max(order.random, 0.01), pct(order.key)]],
  },
  crash: (() => {
    const top = Math.max(crash.after.duplicates, crash.before.lost, 1);
    return {
      verdict: `About ${R(crash.after.crashes)} crashes in 2 minutes. Commit after processing: ${R(crash.after.duplicates)} records read twice, ${R(crash.after.lost)} lost. Commit before: ${R(crash.before.duplicates)} read twice, ${R(crash.before.lost)} lost.`,
      bars: [["After · read twice", crash.after.duplicates / top, String(R(crash.after.duplicates)), true], ["After · lost", crash.after.lost / top, String(R(crash.after.lost))], ["Before · read twice", crash.before.duplicates / top, String(R(crash.before.duplicates))], ["Before · lost", crash.before.lost / top, String(R(crash.before.lost)), true]],
    };
  })(),
  group: (() => {
    const top = 480;
    return {
      verdict: `Read per minute: ${R(group.three.perMinute)} with 3 consumers, ${R(group.six.perMinute)} with 6, while 480 arrive. With 6, ${R(group.six.idle)} consumers have no track.`,
      bars: [["Arriving", 1, "480"], ["3 consumers", group.three.perMinute / top, String(R(group.three.perMinute))], ["6 consumers", group.six.perMinute / top, String(R(group.six.perMinute)), true]],
    };
  })(),
  hot: (() => {
    const top = Math.max(...hot, 1);
    const hotTrack = hot.indexOf(Math.max(...hot));
    return {
      verdict: `Lag after a minute, per track: ${hot.map((x) => R(x)).join(" · ")} with a hot customer (A is on track ${hotTrack + 1}), against ${even.map((x) => R(x)).join(" · ")} when customers are even.`,
      bars: hot.map((x, i) => ["Track " + (i + 1) + (i === hotTrack ? " (A)" : ""), x / top, String(R(x)), i === hotTrack]),
    };
  })(),
  replay: {
    verdict: `Keeping everything: ${R(replay.all.correct)} of 6 totals right after replaying ${R(replay.all.kept)} records. Keeping 20 s: ${R(replay.short.correct)} of 6, from only ${R(replay.short.kept)} of ${R(replay.short.produced)} records.`,
    bars: [["Keep everything", replay.all.correct / 6, R(replay.all.correct) + " of 6", true], ["Keep 20 s", replay.short.correct / 6, R(replay.short.correct) + " of 6"]],
  },
};

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const RESULTS = ${JSON.stringify(RESULTS)};
const CAR_SVG = ${JSON.stringify(carSvg())};
const NS = "http://www.w3.org/2000/svg";

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const tracks = G.TRACK_Y.map((_, i) => q('[data-track="' + i + '"]'));
const carLayers = G.TRACK_Y.map((_, i) => q('[data-cars="' + i + '"]'));
const bookmarks = G.TRACK_Y.map((_, i) => q('[data-bookmark="' + i + '"]'));
const flags = bookmarks.map((b) => b.querySelector("[data-flag]"));
const flagNums = bookmarks.map((b) => b.querySelector("[data-num]"));
const lagBoxes = G.TRACK_Y.map((_, i) => q('[data-shed-lag="' + i + '"]'));
const lagNums = lagBoxes.map((b) => b.querySelector("[data-lag]"));
const setText = (el, v) => { v = String(v); if (el.textContent !== v) el.textContent = v; };
const WARM = 20;
const cabins = G.CABIN_X.map((_, i) => q('[data-cabin="' + i + '"]'));
const lamps = cabins.map((c) => c.querySelector("[data-lamp] .iso-solid"));
const shutters = cabins.map((c) => c.querySelector("[data-shutter]"));
const cables = q("[data-cables]");
const traverser = q("[data-traverser]");
const incomingLayer = q("[data-incoming]");

function makeCar(parent) {
  const g = document.createElementNS(NS, "g"); g.innerHTML = CAR_SVG; parent.appendChild(g);
  const solids = g.querySelectorAll(".iso-solid");
  return { g, box: solids[1], num: g.querySelector("[data-num]"), stamp: g.querySelector("[data-stamp]"), keys: [...g.querySelectorAll("[data-key]")], shownKey: -1, shownOffset: -1, shown: true };
}
const pools = carLayers.map((layer) => Array.from({ length: G.WINDOW }, () => makeCar(layer)));
const incoming = G.TRACK_Y.map(() => makeCar(incomingLayer));

const cfg = { partitions: 3, consumers: 3, keying: "key", commit: "after", rate: 4, retention: 0, speed: 1 };
let sim, endShown, travY, seed = (Date.now() % 1e6) + 1, script = [], note = null, seenEvents = 0;

function restart() {
  sim = makeSim({ ...cfg }, seed++);
  sim.runTo(WARM);   // open on a yard already in use
  endShown = G.TRACK_Y.map((_, p) => (sim.logs[p] ? sim.logs[p].records.length : 0));
  travY = G.TRACK_Y[sim.lastProduced ? sim.lastProduced.p : 1];
  script = []; note = null; seenEvents = 0;
  tracks.forEach((t, i) => t.toggleAttribute("data-off", i >= cfg.partitions));
  lagBoxes.forEach((b, i) => (b.style.display = i >= cfg.partitions ? "none" : ""));
  cabins.forEach((c, i) => c.toggleAttribute("data-off", i >= cfg.consumers));
  showStats(); paint();
}

function setCar(car, x, y, rec, lit) {
  car.g.style.display = ""; car.shown = true;
  car.g.setAttribute("transform", translateAlong(P, [x, y, 0]));
  if (car.shownKey !== rec.key) { car.keys.forEach((el, n) => (el.style.display = n === rec.key ? "" : "none")); car.shownKey = rec.key; }
  if (car.shownOffset !== rec.offset) { car.num.textContent = rec.offset; car.shownOffset = rec.offset; }
  car.stamp.style.display = rec.reads > 0 ? "" : "none";
  car.box.toggleAttribute("data-lit", lit);
}
function hideCar(car) { if (car.shown) { car.g.style.display = "none"; car.shown = false; } }

function paint() {
  const reading = new Set(sim.consumers.filter((c) => c.current).map((c) => c.current.p + ":" + c.current.offset));
  let wires = "";
  for (let p = 0; p < G.TRACK_Y.length; p++) {
    const pool = pools[p], inc = incoming[p];
    if (p >= cfg.partitions) { pool.forEach(hideCar); hideCar(inc); continue; }
    const y = G.TRACK_Y[p], log = sim.logs[p], end = log.records.length, e = endShown[p];
    const xOf = (o) => G.TAIL_X - (e - 1 - o) * G.SPACING;
    const first = Math.max(log.start, Math.ceil(e - 1 - (G.TAIL_X - (G.SHED_X + G.CAR.w / 2)) / G.SPACING));
    let n = 0;
    hideCar(inc);
    for (let o = first; o < end && n < pool.length; o++) {
      const x = xOf(o), rec = log.records[o];
      const lit = reading.has(p + ":" + o);
      if (x > G.TAIL_X + 6) { setCar(inc, x, y, rec, lit); continue; }
      setCar(pool[n++], x, y, rec, lit);
    }
    for (; n < pool.length; n++) hideCar(pool[n]);
    // Bookmark post: between the last committed car and the next one.
    setText(flagNums[p], sim.committed[p]);
    setText(lagNums[p], Math.min(999, sim.lag(p)));
    const minX = G.SHED_X + 3;
    const bx = xOf(sim.committed[p]) - G.SPACING / 2;
    const clamped = bx < minX;
    const postX = Math.min(G.TAIL_X + G.SPACING / 2, Math.max(minX, bx));
    bookmarks[p].setAttribute("transform", translateAlong(P, [postX, 0, 0]));
    flags[p].style.display = clamped ? "none" : "";
    // Overhead wire from the owning cabin's mast to the gantry.
    const owner = sim.consumers.findIndex((c) => c.parts.includes(p));
    if (owner >= 0) {
      const from = iso([G.CABIN_X[owner] + G.MAST.dx, G.CABIN.y + G.MAST.dy, G.MAST.top], P);
      wires += wireSvg(from, iso([postX, y + G.GANTRY.half, G.GANTRY.h], P), { tone: "lo", size: 0.8 });
    }
  }
  cables.innerHTML = wires;
  sim.consumers.forEach((c, i) => {
    lamps[i].toggleAttribute("data-lit", !!c.current && c.down === 0);
    shutters[i].style.display = c.down > 0 ? "" : "none";
  });
  traverser.setAttribute("transform", translateAlong(P, [0, travY, 0]));
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function showStats() {
  statEls.produced.textContent = sim.produced;
  statEls.processed.textContent = sim.processed;
  statEls.lag.textContent = sim.totalLag();
  statEls.duplicates.textContent = sim.duplicates;
  statEls.lost.textContent = sim.lost();
  statEls.order.textContent = sim.firstReads ? Math.round(100 * sim.outOfOrder / sim.firstReads) + "%" : "–";
}

let statTimer = 0;
function advance(dt) {
  sim.step(dt);
  while (script.length && script[0].at <= sim.t) script.shift().run();
  const k = 1 - Math.exp(-dt / 0.2);
  for (let p = 0; p < cfg.partitions; p++) endShown[p] += (sim.logs[p].records.length - endShown[p]) * k;
  if (sim.lastProduced) travY += (G.TRACK_Y[sim.lastProduced.p] - travY) * (1 - Math.exp(-dt / 0.12));
  for (; seenEvents < sim.events.length; seenEvents++) {
    const ev = sim.events[seenEvents];
    if (ev.type === "crash") note = { until: sim.t + 2, text: "consumer " + (ev.consumer + 1) + " crashed · restarts from its bookmarks" };
    if (ev.type === "restart") note = { until: sim.t + 2, text: "consumer " + (ev.consumer + 1) + " back · " + (cfg.commit === "after" ? "rereads since the last commit" : "skips what it had committed") };
    if (ev.type === "rewind") note = { until: sim.t + 3, text: "bookmarks rewound to the oldest kept record · rebuilding" };
  }
  statTimer += dt;
  if (statTimer > 0.2) { statTimer = 0; showStats(); }
  if (note && sim.t < note.until) say(note.text);
  else {
    const idle = sim.idle();
    say(cfg.partitions + " tracks · " + cfg.consumers + " consumers" + (idle ? " (" + idle + " idle)" : "") + " · lag " + sim.totalLag());
  }
}

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => { advance(dt * cfg.speed); paint(); }, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });

function set(name, raw, quiet) {
  if (name === "speed") { cfg.speed = Number(raw); WB.pressSeg(name, raw); return; }
  if (name in cfg) cfg[name] = ["keying", "commit"].includes(name) ? raw : Number(raw);
  WB.pressSeg(name, raw);
  if (!quiet) restart();
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="crash"]').addEventListener("click", () => { sim.requestCrash(0); if (loop.paused) loop.setPaused(false); });
document.querySelector('[data-act="rewind"]').addEventListener("click", () => { sim.rewind(); if (loop.paused) loop.setPaused(false); });
document.querySelector('[data-act="reset"]').addEventListener("click", () => restart());
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

const RUNS = Object.fromEntries(Object.keys(RESULTS).map((id) => [id, () => RESULTS[id]]));
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  for (const name of ["partitions", "consumers", "keying", "commit", "rate", "retention"]) set(name, String(w[name]), true);
  restart();
  if (w.crashes) for (let t = sim.t + 3; t < sim.t + 600; t += 10) script.push({ at: t, run: () => sim.requestCrash(0) });
  if (w.rewindAt) script.push({ at: sim.t + w.rewindAt, run: () => sim.rewind() });
  if (loop.paused) loop.setPaused(false);
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./kafka-log-workbench.html", import.meta.url), {
  title: "Kafka Log Workbench",
  eyebrow: "Systems lesson 20 · Logs and offsets",
  lede: "A log keeps records in the order they arrive and doesn't delete them when they are read; each consumer group keeps a bookmark instead. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
  machine: { intro: "Tracks are partitions, cars are records, and the bookmark posts are committed offsets. Crash a consumer, add consumers, make one customer hot, or rewind the bookmarks and rebuild.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over six seeded runs.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote kafka-log-workbench.html", (size / 1024).toFixed(0) + " KB");
for (const [id, r] of Object.entries(RESULTS)) console.log(id, "·", r.verdict);

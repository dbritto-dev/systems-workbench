// Systems lesson 21 · Distributed counters. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, puckSvg, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "lost",
    title: "Read, add one, write it back",
    change: "One shared key · each add reads the count, adds 1 and writes the result · 3 branches, 0.3 adds/s each, for 60 s",
    question: "Every add does its read and its write successfully. What share of the adds end up in the register?",
    options: ["All of them: each add writes its own +1", "Nearly all: maybe 1 or 2 are lost", "Only about two thirds: more than a third are lost"],
    answer: 2,
    why: "Two branches that read the same value both write value + 1, and one add disappears. With half a second between a read and its write, overlaps are common even at a gentle rate, and nothing reports an error: every write succeeds. This is a lost update, the classic read-modify-write race, now across machines.",
    watch: { approach: "shared", rate: 0.3, nodes: 3 },
  },
  {
    id: "cas",
    title: "Compare-and-swap",
    change: "The write becomes \"set to v + 1 only if it is still v\" · on failure, read again and retry · traffic 0.1 → 0.6 adds/s per branch",
    question: "The count is now exact at both rates. What changes as traffic grows?",
    options: ["Nothing: compare-and-swap costs the same at any rate", "Each add needs many more attempts before it gets through", "It stays exact at low traffic but starts losing adds at high traffic"],
    answer: 1,
    why: "The stamp only accepts a write if nobody changed the value since this branch read it. With more branches adding at once, more writes are rejected and must read again. The count stays exact, but every retry costs two more courier trips, and at high traffic adds queue up behind each other on the single key.",
    watch: { approach: "cas", rate: 0.6, nodes: 3 },
  },
  {
    id: "slots",
    title: "One slot per branch",
    change: "Each branch writes only its own slot (its own count) · the total is the sum of all slots · 0.6 adds/s per branch, where compare-and-swap struggled",
    question: "How many adds are lost or retried now?",
    options: ["None: no two branches ever write the same key", "A few, when two branches write at the same moment", "About as many as with compare-and-swap"],
    answer: 0,
    why: "A branch only ever writes the slot it owns, so there is nothing to race on: no lost updates, no compare-and-swap, no retries. Reading adds up every slot. This is a grow-only counter (G-counter), one of the simplest CRDTs: replicas that can always merge (take each slot's highest value) and agree.",
    watch: { approach: "g", rate: 0.6, nodes: 3 },
  },
  {
    id: "partition",
    title: "Branch C is cut off",
    change: "One slot per branch · C's track is cut for 15 s, then healed · adds stop when it heals",
    question: "What happens to the count while C is cut off, and after?",
    options: ["C can't take adds until the track is back", "Everyone's total is behind for a while (C misses the others, the others miss C), then all agree again within seconds", "C's adds made during the cut are lost"],
    answer: 1,
    why: "C keeps counting its own adds in its own slot, but its reads can't reach the register and its writes wait at the barrier. So C misses A and B's adds, and A and B miss C's. When the track heals, C's queued writes land, every branch reads every slot, and they all agree on the exact total. Always available, eventually consistent.",
    watch: { approach: "g", rate: 0.3, nodes: 3, partition: true },
  },
  {
    id: "seq",
    title: "Reading right after an add",
    change: "Compare-and-swap · B adds 1 and gets its acknowledgement · at that moment A and B each read the count · 20 tries",
    question: "Does A's read include B's add?",
    options: ["Always: B's add was already acknowledged", "Not always: A can be served a slightly older state, while B always sees its own add", "Never until A's next scheduled refresh"],
    answer: 1,
    why: "The register is only sequentially consistent: everyone sees the writes in the same order, and each branch never goes backwards from what it has already seen, but a read may be served from a state a moment old. B has seen its own write, so B's read includes it. A hasn't, so A can lag. If a user must see their own update, read through the branch that made it, or use a linearizable store.",
    watch: { approach: "cas", rate: 0.1, nodes: 3 },
  },
];

const QUESTIONS = [
  ["Two services each read a counter, add one and write it back. Both succeed, yet the counter only went up by one. Why, and why did nothing report an error?",
    "Both read the same old value, so both wrote old + 1; the second write replaced the first. Each request was valid on its own, so no error is raised. The fix is an atomic operation: compare-and-swap, an atomic increment in the store, or a design where writers never share a key."],
  ["How does compare-and-swap prevent the lost update, and what does it cost?",
    "The write only succeeds if the value is still what you read; otherwise you re-read and try again. Nothing is lost, but under contention many attempts fail, each costing round trips, and throughput on that one key is capped by how fast read-then-write cycles can complete."],
  ["Explain a G-counter in one minute.",
    "Each node keeps its own count in its own slot and only ever increments it. The value is the sum of all slots. Two copies merge by taking the maximum of each slot, so merges never conflict and every replica ends up with the same total, no matter the order messages arrive in."],
  ["During a network partition, what does a G-counter give up, and what does it keep?",
    "It gives up up-to-date reads: each side misses the other side's increments. It keeps availability (adds still succeed on both sides) and correctness after healing: no increment is lost or double counted, and everyone converges on the exact total."],
  ["Your store is sequentially consistent. A user clicks \"like\", then reloads and sees the old count. What happened, and how would you fix it?",
    "The reload was served from a replica or state that hadn't caught up yet. Sequential consistency only guarantees order, not recency. Fixes: read from the node that took the write (session stickiness), wait for or require a version at least as new as the write, or use a linearizable read for that path."],
  ["When would you choose a single atomic counter in a database over a CRDT counter?",
    "When reads must be exact and current (balances, stock that must not oversell) and the write rate on that key is moderate. CRDT counters win for high-volume, approximate-is-fine-for-a-moment counts (likes, views, metrics) and when writes must keep working during partitions."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Branch tally",
  keys: [
    { mark: "lit", label: "A courier on its way to the register; a plunger being pressed" },
    { mark: "raised", label: "Counter wheels: every number in the system" },
    { mark: "flat", label: "Tracks between each branch and the register" },
  ],
  caption:
    "Each branch desk has a hand tally (adds it took) and a front display (the total it last read). The register cabinet shows one big shared counter for read, add, write and compare-and-swap, or one slot counter per branch for one slot each. Compare-and-swap adds a stamp over the shared counter and a spindle that collects rejected slips. When the far branch is cut off, the barrier drops across its track and its couriers wait there. The counts agree when every display matches the sum of the tallies.",
  stage: 'data-office aria-label="Distributed counter simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">Changing the approach, branches or traffic starts the run again. Traffic is adds per second at each branch; set it to Off to watch the branches settle on one total.</p>`;
const controls = panel({
  stats: [["total", "Adds made"], ["stored", "Register total"], ["lost", "Lost adds"], ["retries", "CAS retries"], ["reads", "Reads A · B · C", "–"], ["agree", "Branches agree", "–"]],
  controls: [
    seg("approach", "Approach", [["shared", "Read, add, write"], ["cas", "Compare-and-swap"], ["g", "One slot each"]], "shared"),
    seg("nodes", "Branches", [[2, "2"], [3, "3"]], 3),
    seg("rate", "Traffic", [[0, "Off"], [0.1, "0.1/s"], [0.3, "0.3/s"], [0.6, "0.6/s"]], 0.3),
    seg("partition", "Far branch", [["off", "Connected"], ["on", "Cut off"]], "off"),
    speedSeg(),
    actions("Do something", [["addA", "Add at A"], ["reset", "Start over"], ["pause", "Pause"]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
[data-branch][data-off],[data-route][data-off]{display:none}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const PUCK_SVG = ${JSON.stringify(puckSvg())};
const POOL = 48;

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const NS = "http://www.w3.org/2000/svg";
const layer = q("[data-couriers]");
const branches = [0, 1, 2].map((i) => q('[data-branch="' + i + '"]'));
const routes = [0, 1, 2].map((i) => q('[data-route="' + i + '"]'));
const barriers = [0, 1, 2].map((i) => ({ g: q('[data-barrier="' + i + '"]'), up: q('[data-barrier="' + i + '"] [data-arm="up"]'), down: q('[data-barrier="' + i + '"] [data-arm="down"]') }));
const plungers = [0, 1, 2].map((i) => ({ g: q('[data-plunger="' + i + '"]'), solid: q('[data-plunger="' + i + '"] .iso-solid') }));
const stamp = q("[data-stamp]");
const slips = Array.from({ length: G.SLIPS }, (_, s) => ({ g: q('[data-slip="' + s + '"]'), solid: q('[data-slip="' + s + '"] .iso-solid') }));
const unitEls = { main: q('[data-unit="main"]'), cas: q('[data-unit="cas"]'), slot: [0, 1, 2].map((i) => q('[data-unit="slot' + i + '"]')) };

// Counters: the shared digit-wheel counters; WB.counter redraws a wheel only when its digit changes.
const counter = (name) => WB.counter(svg, name, P);
const dials = { main: counter("main"), slot: [0, 1, 2].map((i) => counter("slot" + i)), view: [0, 1, 2].map((i) => counter("view" + i)), tally: [0, 1, 2].map((i) => counter("tally" + i)) };
const show = (dial, v) => dial.set(v);

const pool = Array.from({ length: POOL }, () => { const g = document.createElementNS(NS, "g"); g.innerHTML = PUCK_SVG; g.style.display = "none"; layer.appendChild(g); return { g, solid: g.firstElementChild }; });

const cfg = { approach: "shared", nodes: 3, rate: 0.3, speed: 1 };
let model, clock, tripAt, logAt, stampAt, active, lastAdd, lastStamp, cut, tallies;
const WARM = 12;   // each run starts a few seconds in, so the first frame already shows counts and couriers
let seed = (Date.now() % 1e6) + 1;

function restart() {
  model = makeSim({ approach: cfg.approach, nodes: cfg.nodes, rate: cfg.rate, partitions: [] }, seed++);
  clock = cfg.rate > 0 ? WARM : 0; tripAt = 0; logAt = 0; stampAt = 0; active = []; lastAdd = [-9, -9, -9]; lastStamp = { t: -9, ok: true }; cut = false; tallies = [0, 0, 0];
  model.runTo(clock);
  WB.pressSeg("partition", "off");
  branches.forEach((el, i) => el.toggleAttribute("data-off", i >= cfg.nodes));
  routes.forEach((el, i) => el.toggleAttribute("data-off", i >= cfg.nodes));
  barriers.forEach((b, i) => { b.g.style.display = i === cfg.nodes - 1 ? "" : "none"; });
  unitEls.main.style.display = cfg.approach === "g" ? "none" : "";
  unitEls.cas.style.display = cfg.approach === "cas" ? "" : "none";
  unitEls.slot.forEach((el, i) => { el.style.display = cfg.approach === "g" && i < cfg.nodes ? "" : "none"; });
  paint(0);
}

function setCut(on) {
  if (on === cut) return;
  cut = on;
  if (on) model.cut(clock); else model.healAt(clock);
  WB.pressSeg("partition", on ? "on" : "off");
}

function lastValue(key) { const h = model.history[key]; return h[h.length - 1][1]; }

function paint(dt) {
  // Couriers on the tracks.
  while (tripAt < model.trips.length) active.push(model.trips[tripAt++]);
  active = active.filter((tr) => tr.arrive > clock);
  let used = 0;
  const place = (x, y, lit) => {
    if (used >= POOL) return;
    const p = pool[used++];
    p.g.style.display = "";
    p.g.setAttribute("transform", translateAlong(P, [x, y, 0]));
    p.solid.toggleAttribute("data-lit", lit);
  };
  const far = cfg.nodes - 1, span = G.BRANCH_Y - G.REG_Y;
  for (const tr of active) {
    const x = G.XS[tr.node] + (tr.dir === "up" ? -G.LANE : G.LANE);
    if (clock < tr.start) { if (tr.sent <= clock) place(x, tr.dir === "up" ? G.BARRIER_Y + 5 : G.BARRIER_Y - 5, tr.dir === "up"); continue; }
    if (tr.sent > clock) continue;
    const p = Math.max(0, Math.min(1, (clock - tr.start) / (tr.arrive - tr.start)));
    place(x, tr.dir === "up" ? G.BRANCH_Y - p * span : G.REG_Y + p * span, tr.dir === "up");
  }
  let upHeld = 0, downHeld = 0;
  for (const h of model.held) {
    if (h.dir === "up") place(G.XS[far] - G.LANE, G.BARRIER_Y + 5 + 5.2 * Math.min(3, upHeld++), true);
    else place(G.XS[far] + G.LANE, G.BARRIER_Y - 5 - 5.2 * Math.min(3, downHeld++), false);
  }
  for (let i = used; i < POOL; i++) pool[i].g.style.display = "none";

  // Plungers, the stamp and its spindle, the barrier.
  for (; logAt < model.log.length; logAt++) { const e = model.log[logAt]; if (e.type === "add") { lastAdd[e.node] = e.t; tallies[e.node]++; } }
  for (; stampAt < model.stamps.length; stampAt++) lastStamp = model.stamps[stampAt];
  plungers.forEach((p, i) => { const on = clock - lastAdd[i] < 0.35; p.solid.toggleAttribute("data-lit", on); p.g.setAttribute("transform", on ? translateAlong(P, [0, 0, -1.2]) : ""); });
  const press = clock - lastStamp.t < 0.3 ? Math.sin(Math.PI * (clock - lastStamp.t) / 0.3) : 0;
  stamp.setAttribute("transform", press ? translateAlong(P, [0, 0, -3.5 * press]) : "");
  const shownSlips = Math.min(G.SLIPS, model.retries), freshReject = !lastStamp.ok && clock - lastStamp.t < 0.6;
  slips.forEach((s, k) => { s.g.style.display = k < shownSlips ? "" : "none"; s.solid.toggleAttribute("data-lit", freshReject && k === shownSlips - 1); });
  const b = barriers[far];
  b.up.style.display = cut ? "none" : ""; b.down.style.display = cut ? "" : "none";

  // The counter wheels.
  if (cfg.approach !== "g") show(dials.main, lastValue("counter"));
  else for (let i = 0; i < cfg.nodes; i++) show(dials.slot[i], lastValue("slot" + i));
  for (let i = 0; i < cfg.nodes; i++) { show(dials.view[i], model.nodes[i].view); show(dials.tally[i], tallies[i]); }

  // Readout and stats.
  const views = model.nodes.map((n) => n.view);
  const behind = model.added - Math.min(...views);
  say(cut ? (["A", "B", "C"][far] + " cut off · " + model.held.length + " waiting at the barrier") : (cfg.approach === "shared" ? "read, add, write · " : cfg.approach === "cas" ? "compare-and-swap · " : "one slot each · ") + "total " + model.added);
  stat("total", model.added);
  stat("stored", model.stored());
  stat("lost", cfg.approach === "shared" ? model.lost() : 0);
  stat("retries", model.retries);
  stat("reads", views.join(" · "));
  stat("agree", behind === 0 ? "yes" : "behind " + behind);
}
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(key, value) { const el = statEls[key]; const text = String(value); if (el && el.textContent !== text) el.textContent = text; }

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(dt * cfg.speed); }, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });

function set(name, raw, quiet) {
  if (name === "speed") { cfg.speed = Number(raw); WB.pressSeg(name, raw); return; }
  if (name === "partition") { setCut(raw === "on"); return; }
  if (name === "approach") cfg.approach = raw;
  if (name === "nodes") cfg.nodes = Number(raw);
  if (name === "rate") cfg.rate = Number(raw);
  WB.pressSeg(name, raw);
  if (!quiet) restart();
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="addA"]').addEventListener("click", () => { model.add(clock, 0); if (loop.paused) loop.setPaused(false); });
document.querySelector('[data-act="reset"]').addEventListener("click", () => restart());
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const pct = (x) => Math.round(100 * x) + "%";
const one = (x) => (Math.round(x * 10) / 10).toFixed(1);
const RUNS = {
  lost: () => {
    const r = lostAdds();
    return { verdict: "Of " + Math.round(r.added) + " adds, the register ended at " + Math.round(r.stored) + ": " + pct(r.lost) + " were lost, with no error anywhere.",
      bars: [["Adds made", 1, String(Math.round(r.added))], ["In the register", r.stored / r.added, String(Math.round(r.stored)), true], ["Lost", r.lost, pct(r.lost), true]] };
  },
  cas: () => {
    const slow = casCost(0.1), heavy = casCost(0.6), top = Math.max(slow.retries, heavy.retries);
    return { verdict: "Exact both times (" + Math.round(slow.stored) + " of " + Math.round(slow.added) + ", " + Math.round(heavy.stored) + " of " + Math.round(heavy.added) + "). Retries per add: " + one(slow.retries) + " at 0.1/s, " + one(heavy.retries) + " at 0.6/s; courier trips per add: " + one(slow.msgs) + " → " + one(heavy.msgs) + ".",
      bars: [["Retries, 0.1/s", slow.retries / top, one(slow.retries)], ["Retries, 0.6/s", heavy.retries / top, one(heavy.retries), true]] };
  },
  slots: () => {
    const g = slotCost(0.6), c = casCost(0.6), top = Math.max(g.msgs, c.msgs);
    return { verdict: "One slot each: " + Math.round(g.stored) + " of " + Math.round(g.added) + " counted, " + one(g.retries) + " retries, " + one(g.msgs) + " courier trips per add. Compare-and-swap at the same rate: " + one(c.retries) + " retries and " + one(c.msgs) + " trips per add.",
      bars: [["Trips per add, CAS", c.msgs / top, one(c.msgs)], ["Trips per add, slots", g.msgs / top, one(g.msgs), true]] };
  },
  partition: () => {
    const r = partitionRun(), top = Math.max(r.farBehind, r.nearBehind, 1);
    return { verdict: "During the 15 s cut, C's total was up to " + one(r.farBehind) + " adds behind and A and B's up to " + one(r.nearBehind) + ". " + one(r.converge) + " s after healing, every branch agreed on the exact total" + (r.exact === 1 ? "; nothing was lost." : "."),
      bars: [["C behind, at worst", r.farBehind / top, one(r.farBehind) + " adds", true], ["A, B behind, at worst", r.nearBehind / top, one(r.nearBehind) + " adds"], ["Agree after healing (of the 15 s cut)", Math.min(1, r.converge / 15), one(r.converge) + " s"]] };
  },
  seq: () => {
    const r = readAfterAdd();
    return { verdict: "B's own read showed its add " + pct(r.own) + " of the time; A's read showed it " + pct(r.other) + " of the time.",
      bars: [["B reads its own add", r.own, pct(r.own)], ["A reads B's add", r.other, pct(r.other), true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  set("approach", w.approach, true); set("nodes", String(w.nodes), true); set("rate", String(w.rate), true);
  restart();
  if (loop.paused) loop.setPaused(false);
  if (w.partition) { setTimeout(() => setCut(true), 3000); setTimeout(() => setCut(false), 18000); }
  if (exp.id === "seq") say("watch A's display lag B's for a moment after each add");
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./counter-workbench.html", import.meta.url), {
  title: "Counter Workbench",
  eyebrow: "Systems lesson 21 · Distributed counters",
  lede: "Counting sounds trivial until several machines count at once. This lesson builds a grow-only counter three ways: watch a machine do it, predict what breaks it, then explain it back.",
  machine: { intro: "Three branches count adds into one register by courier. The tallies on the desks add up to the true total; compare them with the register and with each branch’s display. Start with read, add, write and watch the lost adds pile up, then try compare-and-swap and one slot each, and cut the far branch off.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: `Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). The setup follows Fly.io's <a href="https://fly.io/dist-sys/4/" target="_blank" rel="noopener">Gossip Glomers grow-only counter</a> challenge. Simulation written for this lesson.`,
  css,
  script: live,
});
console.log("wrote counter-workbench.html", (size / 1024).toFixed(0) + " KB");

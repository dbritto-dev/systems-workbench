// Systems lesson 33 · Queues. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { LIT_FILL_CSS } from "../../workbench/parts.mjs";
import { buildFigure, parcelSvg, P, GEOMETRY } from "./figure.mjs";
import { overload, burstRun, crashRun, poisonRun, holRun } from "./sim.js";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- results (computed once here from the same model the page runs) ----------
const R = { overload: overload(), burst: burstRun(), crash: crashRun(), poison: poisonRun(), hol: holRun() };

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "overload",
    title: "Slightly more than the clerks can do",
    change: "Arrivals 8/s → 10/s · three clerks can do 9 a second between them · run for 5 minutes",
    question: "After 5 minutes at 10 a second, what does the queue look like?",
    options: ["About the same as at 8/s: a handful waiting", "Longer, but it levels off at a few dozen", "It never levels off: about 300 waiting, and the newest parcel waits about half a minute"],
    answer: 2,
    why: "Every second one more parcel arrives than leaves, so the line grows by about one a second for as long as it lasts. Little's law ties the numbers together: time waiting = queue length ÷ throughput, so 300 ÷ 9 ≈ 33 s. Just below capacity the line stays short. A queue smooths out bursts; it cannot fix an average arrival rate above the service rate. Only more clerks, cheaper work or fewer arrivals can.",
    watch: { rate: 1.2, crash: 0, poison: 0, order: "any", cap: "inf", clerks: 3 },
  },
  {
    id: "burst",
    title: "200 parcels at once",
    change: "A quiet 5/s stream that the clerks (9/s) easily keep up with · 200 parcels dropped in at once · a queue vs nowhere to wait (turned away if every clerk is busy)",
    question: "What happens to the 200 parcels?",
    options: ["With the queue they all get done, the last ones about 20 s late; with nowhere to wait almost all are turned away", "With the queue the clerks fall behind for good", "Both handle it the same: three clerks are three clerks"],
    answer: 0,
    why: "The spare capacity (9 − 5 = 4 a second) drains the burst in under a minute, so the queue turns a spike nobody could serve into a short delay. Without anywhere to wait, everything that arrives while the clerks are busy is refused. This is the main reason queues sit between services: producers and consumers no longer have to run at the same speed at the same moment.",
    watch: { rate: 0.3, crash: 0, poison: 0, order: "any", cap: "inf", clerks: 3, burst: true },
  },
  {
    id: "crash",
    title: "A clerk collapses before stamping",
    change: "1 try in 10 ends with the clerk collapsing: half during the work, half after it but before the stamp · stamp after the work vs stamp on pickup vs an idempotent handler",
    question: "With the stamp after the work, what happens to the parcels whose clerk collapsed?",
    options: ["They're lost", "They come back after the hold timer and are worked again, so some get done twice", "Nothing: the queue knows which clerk had them and waits for that clerk"],
    answer: 1,
    why: "Nobody stamped them, so when the hold timer (the visibility timeout) runs out they reappear and another clerk works them. Nothing is lost, but a parcel whose work had finished gets done twice: at-least-once delivery. Stamping on pickup flips it: no repeats, but a clerk who collapses mid-work loses the parcel for good (at-most-once). The usual answer is to stamp after the work and make the handler idempotent: it remembers parcel ids, so a repeat does no harm.",
    watch: { rate: 0.8, crash: 0.1, poison: 0, order: "any", cap: "inf", clerks: 3, handler: "after" },
  },
  {
    id: "poison",
    title: "One parcel in 50 can never be processed",
    change: "4 clerks, 1.5 s per parcel, 2 arriving a second · a bad parcel fails every time · retried forever vs moved to the dead-letter cage after 3 tries · 5 minutes",
    question: "With retry forever, what happens by the 5-minute mark?",
    options: ["Not much: 2% bad parcels cost about 2% of capacity", "The bad ones keep coming back and pile up, until they take enough clerk time that the whole queue backs up", "The bad ones drop out on their own once their timer runs out"],
    answer: 1,
    why: "A bad parcel never leaves: every few seconds it reappears, takes a clerk, fails and goes back on the rack. New bad parcels keep arriving, so the share of clerk time spent on them grows until the clerks fall behind on the good ones too. A limit on tries plus a dead-letter queue takes them out of circulation after a few attempts, so the rest flows, and leaves them in one place for a person to inspect, fix and send back.",
    watch: { rate: 0.8, crash: 0, poison: 0.1, order: "any", cap: "inf", clerks: 3, tries: "inf" },
  },
  {
    id: "hol",
    title: "One slow parcel at the front",
    change: "Parcels must be handled in order · one parcel for customer A takes 30 s instead of 0.4 s · one order for everything vs one order per customer (4 customers)",
    question: "How long do customers B, C and D wait?",
    options: ["The same either way: their parcels aren't slow", "With one order for everything they all wait about 30 s behind A's parcel; with one order per customer they barely notice", "With an order per customer everyone waits longer, because of the extra bookkeeping"],
    answer: 1,
    why: "Keeping one global order means only one parcel can be out at a time, so the slow one blocks everything behind it: head-of-line blocking. Most systems only need order within one customer, account or key. Keep a separate order per key (message groups, partitions) and a free clerk can reach past A's blocked parcels to B, C and D. A still waits behind its own slow parcel, which is the order it asked for.",
    watch: { rate: 0.3, crash: 0, poison: 0, order: "strict", cap: "inf", clerks: 3, slow: true },
  },
];

const QUESTIONS = [
  ["As a data structure, what does a queue promise, and how do you make adding and removing O(1)?",
    "First in, first out: add at the tail, remove from the head, in arrival order. A linked list with head and tail pointers, or a ring buffer (a fixed array with head and tail indices that wrap around), makes both O(1). Removing from the front of a plain array (array.shift()) moves every other element, so it is O(n)."],
  ["Your queue gets longer every afternoon and drains overnight. What is happening, and what are your options?",
    "In the afternoon work arrives faster than it is processed, and Little's law says the wait grows with the length (wait = length ÷ throughput). A bigger queue only delays the problem. The options: add consumers, make each job cheaper, or reduce what arrives (shed load, rate-limit, or bound the queue and push back on producers)."],
  ["Why should a queue consumer be idempotent, and when should it acknowledge a message?",
    "Acknowledge after the work is done, or a crash mid-work loses the message (at-most-once). But then a crash after the work and before the ack makes the message come back, and it is processed again (at-least-once). So handlers must tolerate repeats: dedupe by message id, use an idempotency key, or make the operation naturally idempotent (set a value rather than add to it)."],
  ["What is a visibility timeout, and what goes wrong if it is shorter than your processing time?",
    "While a consumer holds a message it is hidden from the others; if it isn't acknowledged before the timeout, it becomes visible again for someone else. If processing takes longer than the timeout, a second consumer picks up a message the first is still working on, so you get duplicates with no crash at all. Set it above your worst-case processing time, or extend it (a heartbeat) while you work."],
  ["What is a dead-letter queue for, and what should you do with what lands in it?",
    "It catches messages that failed a set number of times (max receive count), so one poison message can't keep consuming workers or block the line. Alert on it, inspect the messages, fix the bug or the bad data, then redrive them to the main queue. A dead-letter queue nobody watches is just a slower way to lose data."],
  ["Strict first-in-first-out for everything, or order per key: what do you gain and lose?",
    "One global order means one message in flight at a time, so throughput is one worker's and any slow message blocks all the others (head-of-line blocking). Ordering per key (SQS FIFO message groups, Kafka partitions) keeps order where it matters, within an account or an order, and lets different keys run in parallel. A hot or stuck key still blocks its own line. If you don't need order at all, plain parallel consumers give the most throughput."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Parcel office",
  keys: [
    { mark: "lit", label: "A parcel being worked; a collapsed clerk; the lane gate when the lane is full" },
    { mark: "raised", label: "Numbered parcels: number on top, customer letter in front, tries tag once redelivered" },
    { mark: "flat", label: "The roller lane: tail at the dock, front of the queue at the right" },
  ],
  caption:
    "The producer drops numbered parcels at the dock; they roll to the front of the lane, so the numbers read in arrival order. A clerk takes the parcel at the front, works it at the desk and stamps it into the cart. If a clerk collapses, or a parcel can't be processed, the parcel waits on the hold rack: the gauge under it runs down to the moment it rejoins the front of the lane, wearing a tag with its number of tries. After 3 tries it goes into the dead-letter cage. A crossed band marks a bad parcel. Parcels that don't fit on the lane pile up on the pallet beside the dock; with a limited lane, the gate turns them away into the tray instead.",
  stage: 'data-office aria-label="Work queue simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">Each clerk takes 3 s a parcel (1.5 to 4.5), so three clerks keep up with about one parcel a second. Changing a setting starts the run again.</p>`;
const controls = panel({
  stats: [["inq", "In queue"], ["oldest", "Oldest wait"], ["done", "Done"], ["redelivered", "Redelivered"], ["twice", "Done twice"], ["lost", "Lost"], ["dead", "Dead letters"], ["turned", "Turned away"]],
  controls: [
    seg("rate", "Arrivals", [[0.3, "0.3/s"], [0.8, "0.8/s"], [1.2, "1.2/s"]], 0.8),
    seg("clerks", "Clerks", [[1, "1"], [2, "2"], [3, "3"], [4, "4"]], 3),
    seg("order", "Order", [["any", "Any free clerk"], ["strict", "One at a time"], ["key", "Per customer"]], "any"),
    seg("cap", "Lane", [["inf", "No limit"], ["10", "10, then turn away"]], "inf"),
    seg("crash", "Clerk collapses", [[0, "Never"], [0.1, "1 try in 10"]], 0.1),
    seg("poison", "Bad parcels", [[0, "None"], [0.02, "1 in 50"], [0.1, "1 in 10"]], 0.02),
    seg("tries", "Tries, then cage", [["3", "3"], ["inf", "Retry forever"]], "3"),
    seg("handler", "Stamp", [["after", "After the work"], ["first", "On pickup"], ["idem", "After, idempotent"]], "after"),
    speedSeg(),
    actions("Do something", [["burst", "Drop 30 at once"], ["slow", "Slow parcel for A"], ["reset", "Start over"], ["pause", "Pause"]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
[data-desk][data-off],[data-clerk][data-off]{display:none}
.iso-stage [data-layer] text{pointer-events:none}
${LIT_FILL_CSS}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const PARCEL_SVG = ${JSON.stringify(parcelSvg())};
const RESULTS = ${JSON.stringify(R)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const NS = "http://www.w3.org/2000/svg";
const layers = { back: q('[data-layer="back"]'), front: q('[data-layer="front"]') };
const desks = [0, 1, 2, 3].map((i) => q('[data-desk="' + i + '"]'));
const clerkEls = [0, 1, 2, 3].map((i) => q('[data-clerk="' + i + '"]'));
const stamps = [0, 1, 2, 3].map((i) => q('[data-stamp="' + i + '"]'));
const gate = q("[data-gate]"), gateArm = q("[data-gate-arm] .iso-solid");
const flagOn = q('[data-flag="on"]'), flagOff = q('[data-flag="off"]');
const counters = Object.fromEntries(["inq", "oldest", "redelivered", "dead", "done", "twice", "turned"].map((n) => [n, WB.counter(svg, n, P)]));
const meters = G.RACK_X.map((_, i) => WB.meter(svg, "vis" + i, P));
const KEYS = "ABCD";

// ---------- parcels: one pooled element per parcel on screen, eased toward where the model has it ----------
const free = [];
function makeEl() {
  const g = document.createElementNS(NS, "g");
  g.innerHTML = PARCEL_SVG;
  const kind = (name) => { const r = g.querySelector('[data-kind="' + name + '"]'); return { g: r, body: r.querySelector("[data-body]"), num: r.querySelector("[data-num]"), key: r.querySelector("[data-key]"), bad: r.querySelector("[data-bad]"), tag: r.querySelector("[data-tag]"), tries: r.querySelector("[data-tries]") }; };
  return { g, kinds: { box: kind("box"), tall: kind("tall") }, shown: {} };
}
const recs = new Map();   // id -> { el, pos, target, layer, leaving, until, p }
function take() { return free.pop() || makeEl(); }
function drop(id) { const r = recs.get(id); r.el.g.remove(); free.push(r.el); recs.delete(id); }
function dress(r, lit, tagShown) {
  const p = r.p, el = r.el, s = el.shown;
  const kind = p.slow ? "tall" : "box";
  if (s.kind !== kind) { s.kind = kind; el.kinds.box.g.style.display = kind === "box" ? "" : "none"; el.kinds.tall.g.style.display = kind === "tall" ? "" : "none"; }
  const k = el.kinds[kind];
  if (s.id !== p.id || s.k !== kind) {
    s.id = p.id; s.k = kind;
    const txt = String(p.id);
    k.num.textContent = txt; k.num.setAttribute("font-size", txt.length <= 2 ? 3.6 : txt.length === 3 ? 2.8 : 2.2);
    k.key.textContent = KEYS[p.key];
    k.bad.style.display = p.poison ? "" : "none";
  }
  if (s.lit !== lit) { s.lit = lit; k.body.toggleAttribute("data-lit", lit); k.body.toggleAttribute("data-lit-fill", lit); for (const t of [k.num, k.key]) t.setAttribute("data-tone", lit ? "on-lit" : "hi"); }
  const tg = tagShown ? String(p.tries) : "";
  if (s.tag !== tg) { s.tag = tg; k.tag.style.display = tg ? "" : "none"; if (tg) k.tries.textContent = tg; }
}

const cfg = { rate: 0.8, clerks: 3, order: "any", cap: "inf", crash: 0.1, poison: 0.02, tries: "3", handler: "after", speed: 1 };
const WARM = 60;   // each run starts a minute in, so the first frame shows a working office
let model, clock, logAt, lastEvent, lastStamp, lastDead, note, seed = 7;   // the first run opens on a typical minute: a short line, a parcel on the rack, a collapsed clerk, two in the cage

function modelCfg() {
  return { rate: cfg.rate, clerks: cfg.clerks, service: 3, crash: cfg.crash, poison: cfg.poison, maxTries: cfg.tries === "inf" ? Infinity : 3, visibility: 6,
    order: cfg.order, keys: 4, cap: cfg.cap === "inf" ? Infinity : G.CAP, ackFirst: cfg.handler === "first", dedupe: cfg.handler === "idem", recover: 3 };
}

function restart(warm = WARM) {
  for (const id of [...recs.keys()]) drop(id);
  model = makeQueue(modelCfg(), seed);
  seed = (Date.now() % 1e6) + 1;
  clock = warm; logAt = 0; lastEvent = new Map(); lastStamp = [-9, -9, -9, -9]; lastDead = -9; note = null;
  model.runTo(clock);
  scanLog();
  desks.forEach((el, i) => el.toggleAttribute("data-off", i >= cfg.clerks));
  clerkEls.forEach((el, i) => el.toggleAttribute("data-off", i >= cfg.clerks));
  gate.style.display = cfg.cap === "inf" ? "none" : "";
  paint(0, true);
}

function scanLog() {
  for (; logAt < model.log.length; logAt++) {
    const e = model.log[logAt];
    lastEvent.set(e.id, e.type);
    if (e.type === "ack" && e.clerk !== undefined && !model.cfg.ackFirst) lastStamp[e.clerk] = e.t;
    if (e.type === "take" && model.cfg.ackFirst) lastStamp[e.clerk] = e.t;
    if (e.type === "dead") { lastDead = e.t; note = { t: e.t, text: "parcel " + e.id + " failed " + (model.cfg.maxTries) + " times · into the cage" }; }
    if (e.type === "crash") note = { t: e.t, text: "clerk " + (e.clerk + 1) + " collapsed " + (e.after ? "after the work, before the stamp" : "mid-work") + " · parcel " + e.id + (model.cfg.ackFirst ? (e.after ? " was done" : " is lost") : " waits on the rack") };
    if (e.type === "show") note = { t: e.t, text: "parcel " + e.id + " back at the front of the lane" };
    if (e.type === "reject") note = { t: e.t, text: "lane full · parcel " + e.id + " turned away" };
  }
}

const ease = (a, b, f) => a + (b - a) * f;
function place(p, pos, layer, lit, tagShown) {
  let r = recs.get(p.id);
  if (!r) {
    const el = take();
    const fresh = p.born > clock - 1.2 && p.tries <= 1;
    r = { el, p, pos: fresh ? [...G.PROD_SPOT] : [...pos], layer: null };
    recs.set(p.id, r);
  }
  r.p = p; r.target = pos; r.leaving = false; r.seen = true;
  if (r.layer !== layer) { r.layer = layer; layers[layer].appendChild(r.el.g); }
  dress(r, lit, tagShown);
}

function paint(dt, snap) {
  scanLog();
  for (const r of recs.values()) r.seen = false;
  const Q = model.queue;
  for (let i = 0; i < Q.length; i++) {
    let pos = null;
    if (i < G.SLOTS) pos = [G.SLOT_X[i], G.LANE_Y, G.LANE_Z];
    else {
      const j = i - G.SLOTS, layer = Math.floor(j / 4), r = j % 4;
      if (layer < G.PILE.layers) pos = [G.PILE.xs[r % 2], G.PILE.ys[Math.floor(r / 2)], G.PILE.z + layer * G.PILE.step];
    }
    if (pos) place(Q[i], pos, "back", false, Q[i].tries >= 1);
  }
  model.clerks.forEach((c, i) => { if (c.p) place(c.p, G.DESK_SPOT[i], "front", true, c.p.tries >= 2); });
  [...model.hold].sort((a, b) => a.since - b.since).slice(0, G.RACK_X.length).forEach((h, k) => place(h.p, [G.RACK_X[k], G.RACK_Y, G.RACK_Z], "back", false, true));
  model.dead.slice(-G.CAGE_SPOTS.length).forEach((p, n) => place(p, G.CAGE_SPOTS[n], "back", false, true));
  model.rejected.filter((x) => x.t > clock - 2.5).slice(-2).forEach((x, n) => place(x.p, G.TRAY_SPOTS[n], "back", false, false));

  // parcels that left the model's view: into the cart if worked, onto the floor if lost
  for (const [id, r] of recs) {
    if (r.seen) continue;
    if (!r.leaving) {
      r.leaving = true; r.until = performance.now() + 700;
      if (lastEvent.get(id) === "lost") { r.target = [r.pos[0], r.pos[1] + 9, 0.2]; }
      else if (lastEvent.get(id) === "reject") { r.target = [r.pos[0], r.pos[1], -4]; }
      else { r.target = [...G.CART_SPOT]; r.fade = true; if (r.layer !== "front") { r.layer = "front"; layers.front.appendChild(r.el.g); } dress(r, false, false); }
    }
    if (snap || performance.now() > r.until) drop(id);
  }

  // move everything toward its target, with a little lift while travelling
  const f = snap ? 1 : 1 - Math.exp(-dt * 9);
  const backOrder = [];
  for (const r of recs.values()) {
    const [tx, ty, tz] = r.target;
    const dist = Math.hypot(tx - r.pos[0], ty - r.pos[1]);
    r.pos[0] = ease(r.pos[0], tx, f); r.pos[1] = ease(r.pos[1], ty, f);
    r.pos[2] = snap ? tz : ease(r.pos[2], tz + Math.min(9, dist * 0.18), f);
    r.el.g.setAttribute("transform", translateAlong(P, r.pos));
    if (r.leaving) r.el.g.style.opacity = String(Math.max(0, Math.min(1, (r.until - performance.now()) / 450)));
    else if (r.el.g.style.opacity) r.el.g.style.opacity = "";
    if (r.layer === "back") backOrder.push(r);
  }
  // painter's order inside the back layer: far parcels first, lower before higher
  backOrder.sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P));
  let prev = null, inOrder = true;
  for (const r of backOrder) { if (prev && r.el.g.previousElementSibling !== prev) { inOrder = false; break; } prev = r.el.g; }
  if (!inOrder) for (const r of backOrder) layers.back.appendChild(r.el.g);

  // clerks, stamps, gate, flag, rack timers
  model.clerks.forEach((c, i) => WB.pose(svg, "clerk-" + i, c.downUntil > clock ? "down" : "up"));
  stamps.forEach((s, i) => { const k = clock - lastStamp[i]; const press = k >= 0 && k < 0.35 ? Math.sin(Math.PI * k / 0.35) : 0; s.setAttribute("transform", press ? translateAlong(P, [0, 0, -2.4 * press]) : ""); });
  const full = model.cfg.cap !== Infinity && Q.length >= model.cfg.cap;
  gateArm.toggleAttribute("data-lit", full);
  const fresh = clock - lastDead < 3;
  flagOn.style.display = fresh ? "" : "none"; flagOff.style.display = fresh ? "none" : "";
  const holds = [...model.hold].sort((a, b) => a.since - b.since);
  meters.forEach((m, k) => m.set(holds[k] ? Math.max(0, (holds[k].visibleAt - clock) / model.cfg.visibility) : 0));

  // counters and readout
  const st = model.st, oldest = model.oldestWait();
  counters.inq.set(Q.length); counters.oldest.set(Math.round(oldest)); counters.redelivered.set(st.redelivered); counters.dead.set(st.deadN);
  counters.done.set(st.done); counters.twice.set(st.harmful); counters.turned.set(st.rejectedN);
  stat("inq", Q.length); stat("oldest", oldest < 10 ? oldest.toFixed(1) + " s" : Math.round(oldest) + " s"); stat("done", st.done);
  stat("redelivered", st.redelivered); stat("twice", st.harmful + (model.cfg.dedupe && st.twice ? " (" + st.twice + " ignored)" : "")); stat("lost", st.lost); stat("dead", st.deadN); stat("turned", st.rejectedN);
  const busy = model.clerks.filter((c) => c.p).length;
  if (note && clock - note.t < 2.5) say(note.text);
  else say(Q.length + " in queue · oldest " + Math.round(oldest) + " s · " + busy + " of " + cfg.clerks + " clerks busy");
}
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(key, value) { const el = statEls[key]; const text = String(value); if (el && el.textContent !== text) el.textContent = text; }

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(dt); }, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });

function set(name, raw, quiet) {
  WB.pressSeg(name, raw);
  if (name === "speed") { cfg.speed = Number(raw); return; }
  cfg[name] = ["rate", "clerks", "crash", "poison"].includes(name) ? Number(raw) : raw;
  if (!quiet) restart();
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="burst"]').addEventListener("click", () => { model.burst(clock, 30); note = { t: clock, text: "30 parcels dropped at once" }; if (loop.paused) loop.setPaused(false); });
document.querySelector('[data-act="slow"]').addEventListener("click", () => { const p = model.slowOne(clock, 30, 0); note = { t: clock, text: "parcel " + p.id + " for customer A takes 30 s" }; if (loop.paused) loop.setPaused(false); });
document.querySelector('[data-act="reset"]').addEventListener("click", () => restart());
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments (numbers computed from the same model, 8 seeds each) ----------
const one = (x) => (Math.round(x * 10) / 10).toFixed(1);
const n0 = (x) => String(Math.round(x));
const RUNS = {
  overload: () => {
    const { under, over } = RESULTS.overload, top = Math.max(over.len, 1);
    return { verdict: "At 8/s: " + one(under.len) + " waiting after 5 minutes, the oldest for " + one(under.wait) + " s. At 10/s: " + n0(over.len) + " waiting, the oldest for " + n0(over.wait) + " s, and still growing by about one a second.",
      bars: [["Waiting at 8/s", under.len / top, one(under.len)], ["Waiting at 10/s", over.len / top, n0(over.len), true], ["Oldest wait at 10/s (of 60 s)", Math.min(1, over.wait / 60), n0(over.wait) + " s", true]] };
  },
  burst: () => {
    const { queued, none } = RESULTS.burst;
    return { verdict: "With the queue: the line peaked at " + n0(queued.peak) + ", drained in " + n0(queued.drained) + " s, the longest wait was " + n0(queued.maxWait) + " s and nothing was turned away. With nowhere to wait: " + n0(none.rejected) + " of the 200 were turned away.",
      bars: [["Turned away, with a queue", queued.rejected / 200, n0(queued.rejected)], ["Turned away, nowhere to wait", none.rejected / 200, n0(none.rejected), true], ["Time to drain the burst (of 60 s)", Math.min(1, queued.drained / 60), n0(queued.drained) + " s"]] };
  },
  crash: () => {
    const { after, first, idem } = RESULTS.crash, top = Math.max(after.harmful, first.lost, 1);
    return { verdict: "Stamp after the work: 0 lost, " + one(after.harmful) + " parcels done twice in 5 minutes. Stamp on pickup: 0 done twice, " + one(first.lost) + " lost. Stamp after, idempotent handler: " + one(idem.twice) + " repeats arrived and did no harm; nothing lost.",
      bars: [["Done twice, stamp after", after.harmful / top, one(after.harmful), true], ["Lost, stamp on pickup", first.lost / top, one(first.lost), true], ["Harm, stamp after + idempotent", idem.harmful / top, one(idem.harmful)]] };
  },
  poison: () => {
    const { forever, dlq } = RESULTS.poison, top = Math.max(forever.poisonTries, 1);
    return { verdict: "Retry forever: " + n0(forever.poisonTries) + " tries spent on bad parcels, " + n0(forever.len) + " parcels waiting at 5 minutes, the oldest for " + n0(forever.wait) + " s. Three tries then the cage: " + n0(dlq.poisonTries) + " tries, " + one(dlq.dead) + " parcels in the cage, " + one(dlq.len) + " waiting.",
      bars: [["Tries on bad parcels, forever", forever.poisonTries / top, n0(forever.poisonTries), true], ["Tries on bad parcels, 3 then cage", dlq.poisonTries / top, n0(dlq.poisonTries)], ["Waiting at 5 min, forever (of 100)", Math.min(1, forever.len / 100), n0(forever.len), true], ["Waiting at 5 min, 3 then cage", Math.min(1, dlq.len / 100), one(dlq.len)]] };
  },
  hol: () => {
    const { strict, key } = RESULTS.hol, top = 32;
    return { verdict: "One order for everything: B, C and D waited up to " + one(strict.others) + " s and the line peaked at " + n0(strict.peak) + ". One order per customer: B, C and D waited at most " + one(key.others) + " s; A waited up to " + one(key.same) + " s behind its own slow parcel.",
      bars: [["B, C, D wait, one order", Math.min(1, strict.others / top), one(strict.others) + " s", true], ["B, C, D wait, per customer", Math.min(1, key.others / top), one(key.others) + " s"], ["A waits, per customer", Math.min(1, key.same / top), one(key.same) + " s"]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  set("rate", String(w.rate), true); set("crash", String(w.crash), true); set("poison", String(w.poison), true); set("order", w.order, true);
  set("cap", w.cap, true); set("clerks", String(w.clerks), true); set("tries", w.tries || "3", true); set("handler", w.handler || "after", true);
  restart(w.burst || w.slow ? 6 : WARM);
  if (loop.paused) loop.setPaused(false);
  if (w.burst) setTimeout(() => { model.burst(clock, 30); note = { t: clock, text: "30 parcels dropped at once" }; }, 1500);
  if (w.slow) { set("speed", "3"); setTimeout(() => { const p = model.slowOne(clock, 30, 0); note = { t: clock, text: "parcel " + p.id + " for customer A takes 30 s · everyone waits behind it" }; }, 1500); }
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./queue-workbench.html", import.meta.url), {
  title: "Queue Workbench",
  eyebrow: "Systems lesson 33 · Queues",
  lede: "A queue is a line: the first one in is the first one out. Put one between the code that creates work and the code that does it, and it soaks up bursts, survives crashed workers and keeps arrival order, as long as the work keeps up on average. This lesson runs a parcel office as a work queue: watch a machine do it, predict what breaks it, then explain it back.",
  machine: { intro: "Parcels arrive at the dock on the left and roll along the lane to the front on the right. Clerks take the parcel at the front, work it and stamp it into the cart. When a clerk collapses before stamping, or a parcel can't be processed, the parcel waits on the hold rack until its timer runs out, then goes back to the front of the lane. After 3 tries it goes into the cage. Try the arrival rate, the bad parcels, the lane limit and the per-customer order.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: `Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson.`,
  css,
  script: live,
});
console.log("wrote queue-workbench.html", (size / 1024).toFixed(0) + " KB");

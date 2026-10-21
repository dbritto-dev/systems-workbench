// Systems lesson 26 · Sagas. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, folderSvg, puckSvg, P, GEOMETRY, HOOKS } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "nosaga",
    title: "A card is declined after everything is booked",
    change: "No saga · each counter is called in turn and nothing is undone · 20% of cards are declined · 3 minutes of customers",
    question: "The flight, hotel and car are booked, then the card is declined. What happens to those three bookings?",
    options: ["They are cancelled automatically, because the trip failed", "They stay booked for a trip that will never happen, and the boards fill up", "The customer is charged anyway, so nothing is lost"],
    answer: 1,
    why: "Each counter committed its own booking in its own database. Nothing ties them together, so when payment fails nobody tells the flight, hotel and car counters. Their tags stay on the boards, holding stock no one will use, and later customers are turned away for it. A saga gives every step an undo and runs those undos, newest first, when a later step fails.",
    watch: { style: "none", decline: "0.2", lost: "0", order: "standard", slots: "8", rate: "0.3" },
  },
  {
    id: "lost",
    title: "Undo calls that time out",
    change: "Saga · a quarter of undo calls time out, and half of those actually ran before the reply was lost · 40% of cards declined",
    question: "Compare three policies for a timed-out undo: give up, retry, or retry with the same idempotency key. What does each leave behind?",
    options: ["Retrying fixes it either way: running an undo twice is harmless", "Giving up strands trips half-done; plain retries sometimes undo twice; retries with a key end clean", "Giving up is safest, because a timed-out undo probably worked"],
    answer: 1,
    why: "A timeout tells you nothing: the undo may or may not have happened. Giving up leaves the trip stuck with bookings nobody will release. Retrying is the only way forward, but a retry of an undo that already ran releases someone else's room or refunds twice. The idempotency key lets the counter recognise the repeat and do nothing, so the saga can retry until it gets a definite answer.",
    watch: { style: "orch", decline: "0.4", lost: "0.25", undo: "retry", order: "standard", slots: "8", rate: "0.3" },
  },
  {
    id: "email",
    title: "Send the confirmation first",
    change: "Order: email → flight → hotel → car → payment, instead of email last · 20% of cards declined",
    question: "Of the trips that fail after the email went out, how many customers received a confirmation?",
    options: ["None: the saga recalls the email", "Every one of them: an email can't be undone", "About half of them"],
    answer: 1,
    why: "Some steps have no undo: an email, a text message, a shipped parcel. The best the saga can do is send a second \"sorry, cancelled\" message. So steps that can't be compensated go after the last step that can fail (the pivot), where nothing can roll them back anymore.",
    watch: { style: "orch", decline: "0.2", lost: "0", order: "mailFirst", slots: "8", rate: "0.3" },
  },
  {
    id: "isolation",
    title: "Few seats, busy day",
    change: "5 seats on each board · a customer every 2.5 s · 40% of cards declined · payment checked last",
    question: "Customers are turned away because the flight is full. How many of them were blocked by a seat held by a trip that was later undone?",
    options: ["None: a held seat is a real booking", "A few, by bad luck", "Most of them"],
    answer: 2,
    why: "A saga has no isolation: every step's booking is visible to everyone the moment it commits, even though the trip may still be undone. Doomed trips hold seats for several seconds, and full boards turn real customers away. Checking the step most likely to fail first (here, the card) means doomed trips never hold anything. Other fixes: pending holds that expire, or a semantic lock other trips can see.",
    watch: { style: "orch", decline: "0.4", lost: "0", order: "standard", slots: "5", rate: "0.4" },
  },
  {
    id: "choreo",
    title: "Drop the orchestrator",
    change: "Choreography: each counter hands the folder to the next directly, and back on failure · no desk, no checklist",
    question: "What changes?",
    options: ["Nothing: it only looks different", "Trips finish faster, but to find where a trip is you ask counter after counter", "Trips get slower and harder to find"],
    answer: 1,
    why: "Without the round trip to the desk, every step is quicker. But no one holds the whole picture: to answer \"where is my trip?\" you ask each counter in turn, and a folder in transit between counters shows up nowhere. Orchestration costs a hop per step and a central component; choreography spreads the saga's logic across services and makes it harder to follow and to change.",
    watch: { style: "choreo", decline: "0.2", lost: "0", order: "standard", slots: "8", rate: "0.3" },
  },
];

const QUESTIONS = [
  ["Why can't you wrap \"book flight, book hotel, charge card\" in one database transaction?",
    "Each service owns its own database, and often a third party owns it (an airline, a payment provider). There is no shared transaction across them, and holding locks across slow remote calls (two-phase commit) would block everyone and fail when any participant is down. A saga accepts that each step commits on its own and plans the way back instead."],
  ["What makes a good compensation?",
    "It undoes the business effect, not the history: a refund, a cancellation, a release. It is idempotent (safe to run twice, usually through an idempotency key), it can be retried until it gives a definite answer, and it should not be able to fail for business reasons. If it can, the saga needs a human or a parking place for stuck trips."],
  ["Where do you put a step that can't be undone, and a step that is likely to fail?",
    "Likely-to-fail steps go early, so failures happen before much has to be undone. Steps that can't be compensated (emails, shipping) go after the pivot, the last step that can fail, so they only run for trips that will definitely complete."],
  ["A saga has no isolation. Describe an anomaly and a way to soften it.",
    "Other requests see intermediate state: a seat held by a trip that will be undone turns a real customer away, or a refund reads a balance mid-saga. Mitigations: order steps so doomed trips fail early, use pending states that others can see and skip (a semantic lock), reservations that expire, and updates that commute so order doesn't matter."],
  ["When would you choose orchestration, and when choreography?",
    "Orchestration when the flow has many steps or branches, when you need to see and change it in one place, and when support must answer \"where is this order?\". Choreography when there are few steps and teams want services to react to events without a central coordinator, accepting that the flow is spread across services and harder to trace."],
  ["An undo call to the hotel times out. What do you know, and what do you do?",
    "Nothing: the cancel may have run and only the reply was lost. Retry with the same idempotency key until the hotel gives a definite answer; never assume either way. If retries run out, park the saga as stuck and alert someone, because its bookings are still holding stock."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Travel agency",
  keys: [
    { mark: "lit", label: "A folder riding back to undo its steps, or left stuck; tags held for a stuck trip (crossed out)" },
    { mark: "raised", label: "Counters with tag boards, the postbox, the orchestrator desk and the scoreboard" },
    { mark: "flat", label: "Forward track, return track and the stuck ledge" },
  ],
  caption:
    "A folder enters at the door and rides the forward track. Each counter books its part, hangs a tag on its board and stamps the folder; the postbox sends the confirmation, which can't be taken back. If a step fails, the folder drops to the return track and every counter it already visited takes its tag down. Without a saga the return track is closed and the folder is left on the ledge with its tags still hanging. The orchestrator desk sends a courier along the dashed lines for each step and keeps one checklist row per trip; with choreography it is covered.",
  stage: 'data-agency aria-label="Saga simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const controls = panel({
  stats: [["done", "Trips booked"], ["undone", "Undone cleanly"], ["stuck", "Left half-done"], ["turned", "Turned away"], ["wrongMail", "Wrong emails"], ["doubles", "Undone twice"]],
  controls: [
    seg("style", "Coordination", [["orch", "Orchestrator"], ["choreo", "Choreography"], ["none", "No undo"]], "orch"),
    seg("order", "Order", [["standard", "Email last"], ["mailFirst", "Email first"], ["payFirst", "Card first"]], "standard"),
    seg("undo", "Timed-out undo", [["none", "Give up"], ["retry", "Retry"], ["idem", "Retry with key"]], "idem"),
    seg("decline", "Cards declined", [["0", "0%"], ["0.2", "20%"], ["0.4", "40%"]], "0.2"),
    seg("lost", "Undo timeouts", [["0", "None"], ["0.25", "25%"]], "0"),
    seg("slots", "Seats per board", [["5", "5"], ["8", "8"]], "8"),
    seg("rate", "Customers", [["0.2", "1 per 5 s"], ["0.3", "1 per 3 s"], ["0.4", "1 per 2.5 s"]], "0.3"),
    speedSeg(),
    actions("Do something", [["decline", "Decline the next card"], ["reset", "Start over"], ["pause", "Pause"]]),
  ],
});

const css = `
.stamp{fill:none;stroke:var(--anatomy-lo);stroke-width:.6}
.stamp[data-on]{fill:var(--anatomy-strong);stroke:var(--anatomy-strong)}
.xmark{fill:none;stroke:var(--anatomy-strong);stroke-width:1.1;stroke-linecap:round}
.cell{fill:none;stroke:var(--anatomy-lo);stroke-width:.6}
.cell[data-on]{fill:var(--anatomy-strong);stroke:var(--anatomy-strong)}
.cell[data-undo]{fill:none;stroke:var(--anatomy-lit);stroke-width:1.4}
.cell[data-undo][data-on]{fill:var(--anatomy-lit)}
[data-hook][data-off]{display:none}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const HOOKS = ${JSON.stringify(HOOKS)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const FOLDER_SVG = ${JSON.stringify(folderSvg())};
const PUCK_SVG = ${JSON.stringify(puckSvg())};
const NS = "http://www.w3.org/2000/svg";
const POOL = 28, PUCKS = 8;
const WARM = 40;   // each run starts this many seconds in, so the first frame already shows trips, tags and counts

const stage = document.querySelector("[data-agency]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const qa = (s) => [...svg.querySelectorAll(s)];
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const layer = q("[data-folders]");
const stationsEl = q("[data-stations]");
const stations = Object.fromEntries(["F", "H", "C", "P", "M"].map((s) => [s, q('[data-station="' + s + '"]')]));
const tags = Object.fromEntries(["F", "H", "C", "P"].map((s) => [s, HOOKS.map((_, n) => { const g = q('[data-tag="' + s + n + '"]'); return { g, solids: [...g.querySelectorAll(".iso-solid")], x: g.querySelector("[data-x]") }; })]));
const hookEls = Object.fromEntries(["F", "H", "C", "P"].map((s) => [s, qa('[data-station="' + s + '"] [data-hook]')]));
const letter = q("[data-letter]");
const cells = Array.from({ length: G.ROWS }, (_, r) => Array.from({ length: 5 }, (_, c) => q('[data-cell="' + r + "-" + c + '"]')));
const digits = Object.fromEntries(G.SCORE_ROWS.map((n) => [n, [0, 1, 2].map((j) => q('[data-digit="' + n + j + '"]'))]));
const parts = { wires: q("[data-wires]"), desk: q("[data-desk]"), sheet: q("[data-sheet]"), keeper: q("[data-keeper]"), closed: q("[data-closed]"), ret: q("[data-return]"), retRails: qa("[data-return-rails]") };

const mk = (html) => { const g = document.createElementNS(NS, "g"); g.innerHTML = html; g.style.display = "none"; layer.appendChild(g); return g; };
const folders = Array.from({ length: POOL }, () => { const g = mk(FOLDER_SVG); return { g, solids: [...g.querySelectorAll(".iso-solid")], stamps: [...g.querySelectorAll(".stamp")], shown: "" }; });
const pucks = Array.from({ length: PUCKS }, () => mk(PUCK_SVG));

const cfg = { style: "orch", order: "standard", undo: "idem", decline: 0.2, lost: 0, slots: 8, rate: 0.3, speed: 1 };
let model, clock, slotOf;
let seed = (Date.now() % 1e6) + 1;

function slotX(s) {
  if (s <= 0) return G.DOOR_X + (G.SX[0] - G.DOOR_X) * (s + 1);
  if (s >= 4) return G.SX[4] + (G.EXIT_X - G.SX[4]) * (s - 4);
  const i = Math.floor(s); return G.SX[i] + (G.SX[i + 1] - G.SX[i]) * (s - i);
}

function restart(warm = WARM) {
  model = makeSim({ style: cfg.style, order: cfg.order, undo: cfg.undo, decline: cfg.decline, lost: cfg.lost, slots: cfg.slots, rate: cfg.rate }, seed++);
  clock = warm;
  model.runTo(clock);
  // Lay the counters out in the order the trip visits them, and paint them back to front.
  slotOf = Object.fromEntries(model.order.map((s, i) => [s, i]));
  const byDepth = model.order.map((s) => [s, depthOf([G.SX[slotOf[s]], -50, 0], P)]).sort((a, b) => a[1] - b[1]);
  for (const [s] of byDepth) { stations[s].setAttribute("transform", translateAlong(P, [G.SX[slotOf[s]], 0, 0])); stationsEl.appendChild(stations[s]); }
  for (const s of ["F", "H", "C", "P"]) hookEls[s].forEach((el, n) => el.toggleAttribute("data-off", s !== "P" && n >= cfg.slots));
  const orch = cfg.style === "orch", none = cfg.style === "none";
  parts.wires.style.display = orch ? "" : "none";
  parts.keeper.style.display = orch ? "" : "none";
  parts.sheet.style.display = orch ? "none" : "";
  parts.desk.style.display = orch ? "" : "none";
  parts.closed.style.display = none ? "" : "none";
  paint();
}

function placeFolder(f, x, y, z, lit, steps) {
  f.g.style.display = "";
  const key = x.toFixed(1) + "," + y.toFixed(1) + "," + z;
  if (f.shown !== key) { f.g.setAttribute("transform", translateAlong(P, [x, y, z])); f.shown = key; }
  f.solids.forEach((s) => s.toggleAttribute("data-lit", lit));
  f.stamps.forEach((s, i) => s.toggleAttribute("data-on", i < steps));
}

function paint() {
  const t = clock;
  // Folders on the tracks (and on the stuck ledge, stacked per counter).
  let used = 0;
  const stuckStack = [0, 0, 0, 0, 0];
  const visible = [];
  for (const trip of model.trips) {
    if (trip.t0 > t) break;
    if (trip.outcome && trip.outcome !== "stuck" && t > trip.outcomeAt + 0.2) continue;
    visible.push(trip);
  }
  for (const trip of visible) {
    const f = folderAt(trip, t);
    if (!f || used >= POOL) continue;
    let x = slotX(f.slot), y = G.LANE_Y[f.lane], z = G.LANE_Z[f.lane];
    if (f.blend) { y += (G.LANE_Y[f.from] - G.LANE_Y[f.lane]) * f.blend; z += (G.LANE_Z[f.from] - G.LANE_Z[f.lane]) * f.blend; }
    if (f.lane === "s" && !f.blend) { const i = Math.round(f.slot); z += 3.1 * Math.min(4, stuckStack[i]++); }
    placeFolder(folders[used++], x, y, z, f.undoing || f.stuck, f.steps);
  }
  for (let i = used; i < POOL; i++) folders[i].g.style.display = "none";

  // Couriers from the orchestrator desk.
  let pk = 0;
  if (cfg.style === "orch") for (let i = model.couriers.length - 1; i >= 0 && pk < PUCKS; i--) {
    const c = model.couriers[i];
    if (c.to < t - 2) break;
    if (c.from > t || c.to <= t) continue;
    let p = (t - c.from) / (c.to - c.from); if (c.dir === "back") p = 1 - p;
    const x = G.DESK_PORT[0] + (G.SX[c.slot] - G.DESK_PORT[0]) * p, y = G.DESK_PORT[1] + (G.COUNTER_FRONT + 2 - G.DESK_PORT[1]) * p;
    pucks[pk].style.display = ""; pucks[pk].setAttribute("transform", translateAlong(P, [x, y, 0])); pk++;
  }
  for (let i = pk; i < PUCKS; i++) pucks[i].style.display = "none";

  // Tags on the boards; receipts on the payment board. Tags held by a stuck trip are lit.
  const stuckNow = new Set();
  for (const trip of visible) if (trip.outcome === "stuck" && trip.outcomeAt <= t) stuckNow.add(trip.id);
  const show = { F: [], H: [], C: [], P: [] };
  for (const tag of model.tags) if (tag.from <= t && tag.to > t) show[tag.svc][tag.hook] = tag;
  let r = 0;
  for (const rc of model.receipts) if (rc.from <= t && rc.to > t && r < 8) show.P[r++] = rc;
  for (const s of ["F", "H", "C", "P"]) tags[s].forEach((el, n) => {
    const tag = show[s][n];
    el.g.style.display = tag ? "" : "none";
    const orphan = !!tag && stuckNow.has(tag.trip);
    if (tag) el.solids.forEach((x) => x.toggleAttribute("data-lit", orphan));
    el.x.style.display = orphan ? "" : "none";
  });

  // A letter dropping into the postbox.
  let drop = -1;
  for (let i = model.letters.length - 1; i >= 0; i--) { const d = t - model.letters[i].t; if (d < 0) continue; if (d < 0.7) drop = d; break; }
  letter.style.display = drop >= 0 ? "" : "none";
  if (drop >= 0) letter.setAttribute("transform", translateAlong(P, [0, 0, -7 * drop]));

  // The checklist: one row per trip in progress (oldest first), one cell per step done.
  const active = visible.filter((trip) => trip.outcomeAt > t).slice(0, G.ROWS);
  for (let row = 0; row < G.ROWS; row++) {
    const trip = active[row], f = trip && folderAt(trip, t);
    for (let c = 0; c < 5; c++) {
      cells[row][c].toggleAttribute("data-on", !!f && c < f.steps);
      cells[row][c].toggleAttribute("data-undo", !!f && f.undoing);
    }
  }

  // Scoreboard and stats.
  const n = model.count(t);
  for (const name of G.SCORE_ROWS) String(Math.min(999, n[name])).padStart(3, "0").split("").forEach((d, j) => { if (digits[name][j].textContent !== d) digits[name][j].textContent = d; });
  for (const k of ["done", "undone", "stuck", "turned", "wrongMail", "doubles"]) stat(k, n[k]);

  // Readout: what the most interesting trip is doing.
  const undoing = active.find((trip) => t >= trip.compAt);
  if (undoing) { const f = folderAt(undoing, t); say("trip " + (undoing.id + 1) + " · " + (undoing.failReason === "sold" ? NAMES[model.order[undoing.failSlot]] + " full" : "card declined") + " · undoing " + Math.max(0, f.steps) + " step" + (f.steps === 1 ? "" : "s")); }
  else if (n.stuck && cfg.style === "none") say(n.stuck + " half-done trip" + (n.stuck === 1 ? "" : "s") + " · " + n.orphans + " bookings held for nobody");
  else say(active.length + " trip" + (active.length === 1 ? "" : "s") + " in progress · " + n.done + " booked");
}
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(key, value) { const el = statEls[key]; const text = String(value); if (el && el.textContent !== text) el.textContent = text; }

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(); }, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });

function set(name, raw, quiet) {
  WB.pressSeg(name, raw);
  if (name === "speed") { cfg.speed = Number(raw); return; }
  cfg[name] = ["style", "order", "undo"].includes(name) ? raw : Number(raw);
  if (!quiet) restart();
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="decline"]').addEventListener("click", () => { model.declineNext(); if (loop.paused) loop.setPaused(false); say("the next card will be declined"); });
document.querySelector('[data-act="reset"]').addEventListener("click", () => restart());
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const one = (x) => (Math.round(x * 10) / 10).toFixed(1);
const r0 = (x) => String(Math.round(x));
const pct = (x) => Math.round(100 * x) + "%";
const RUNS = {
  nosaga: () => {
    const a = runScenario({ style: "none", decline: 0.2 }), b = runScenario({ style: "orch", decline: 0.2 });
    const top = Math.max(a.done, b.done, a.turned, b.turned, 1);
    return { verdict: "No saga: " + one(a.stuck) + " trips left half-done, " + one(a.orphans) + " bookings still held for nobody at the end, " + one(a.turned) + " customers turned away. With a saga: " + one(b.stuck) + " left half-done, " + one(b.undone) + " undone cleanly, " + one(b.turned) + " turned away, and " + one(b.done) + " trips booked instead of " + one(a.done) + ".",
      bars: [["Booked, no saga", a.done / top, one(a.done)], ["Booked, saga", b.done / top, one(b.done), true], ["Turned away, no saga", a.turned / top, one(a.turned)], ["Turned away, saga", b.turned / top, one(b.turned), true]] };
  },
  lost: () => {
    const base = { style: "orch", decline: 0.4, lost: 0.25 };
    const g = runScenario({ ...base, undo: "none" }), r = runScenario({ ...base, undo: "retry" }), k = runScenario({ ...base, undo: "idem" });
    const top = Math.max(g.stuck, r.doubles, 1);
    return { verdict: "Give up: " + one(g.stuck) + " trips stuck half-done, " + one(g.orphans) + " bookings never released. Retry: " + one(r.stuck) + " stuck, but " + one(r.doubles) + " undos ran twice (another customer's seat released, or a double refund). Retry with a key: " + one(k.stuck) + " stuck, " + one(k.doubles) + " twice.",
      bars: [["Stuck, give up", g.stuck / top, one(g.stuck)], ["Undone twice, retry", r.doubles / top, one(r.doubles)], ["Stuck or twice, retry with key", (k.stuck + k.doubles) / top, one(k.stuck + k.doubles), true]] };
  },
  email: () => {
    const last = runScenario({ style: "orch", decline: 0.2 }), first = runScenario({ style: "orch", decline: 0.2, order: "mailFirst" });
    const failed = first.undone + first.stuck, top = Math.max(failed, 1);
    return { verdict: "Email last: " + one(last.wrongMail) + " wrong confirmations. Email first: " + one(first.wrongMail) + " of " + one(failed) + " failed trips had already been confirmed by email (" + pct(failed ? first.wrongMail / failed : 0) + ").",
      bars: [["Failed trips, email first", failed / top, one(failed)], ["Confirmed anyway", first.wrongMail / top, one(first.wrongMail), true], ["Confirmed anyway, email last", last.wrongMail / top, one(last.wrongMail)]] };
  },
  isolation: () => {
    const base = { style: "orch", decline: 0.4, slots: 5, rate: 0.4 };
    const a = runScenario(base), b = runScenario({ ...base, order: "payFirst" }), top = Math.max(a.turned, 1);
    return { verdict: "Payment last: " + one(a.turned) + " customers turned away for full seats, " + one(a.wrongTurned) + " of them (" + pct(a.turned ? a.wrongTurned / a.turned : 0) + ") while a seat was held by a trip that was later undone. Card checked first: " + one(b.turned) + " turned away, " + one(b.wrongTurned) + " by doomed trips; " + one(b.done) + " trips booked instead of " + one(a.done) + ".",
      bars: [["Turned away, payment last", a.turned / top, one(a.turned)], ["…by a doomed trip's seat", a.wrongTurned / top, one(a.wrongTurned), true], ["Turned away, card first", b.turned / top, one(b.turned)], ["…by a doomed trip's seat", b.wrongTurned / top, one(b.wrongTurned), true]] };
  },
  choreo: () => {
    const o = runScenario({ style: "orch", decline: 0.2 }), c = runScenario({ style: "choreo", decline: 0.2 }), top = Math.max(o.tripTime, c.tripTime);
    return { verdict: "Time per booked trip: " + one(o.tripTime) + " s orchestrated, " + one(c.tripTime) + " s choreographed. Finding a trip in progress: 1 look at the checklist vs " + one(c.findAsks) + " counters asked on average, and " + pct(c.findMissed) + " of the time the folder was between counters, so nobody had it.",
      bars: [["Trip time, orchestrator", o.tripTime / top, one(o.tripTime) + " s"], ["Trip time, choreography", c.tripTime / top, one(c.tripTime) + " s", true], ["Counters asked to find a trip", c.findAsks / 5, one(c.findAsks) + " of 5", true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  for (const [k, v] of Object.entries(w)) set(k, v, true);
  restart(exp.id === "nosaga" ? 4 : WARM);
  if (loop.paused) loop.setPaused(false);
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./saga-workbench.html", import.meta.url), {
  title: "Saga Workbench",
  eyebrow: "Systems lesson 26 · Sagas",
  lede: "Booking a trip touches several services that share no transaction: the flight, the hotel, the car, the card. A saga runs each step on its own and, when a later one fails, runs the undo of every earlier step. This lesson builds one: watch a machine do it, predict what breaks it, then explain it back.",
  machine: { intro: "Folders ride past five counters. Each counter books its part and hangs a tag; when the card is declined or a board is full, the folder rides back on the lower track and the tags come down. Try <em>Decline the next card</em>, then switch to <em>No undo</em> and watch tags pile up for trips that never happen.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine: three minutes of customers, averaged over eight seeded runs.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: `Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson.`,
  css,
  script: live,
});
console.log("wrote saga-workbench.html", (size / 1024).toFixed(0) + " KB");

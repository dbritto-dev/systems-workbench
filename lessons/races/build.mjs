// Systems lesson 17 · Race conditions. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, clerkSvg, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "overlap",
    title: "Two clerks, no protection",
    change: "2 clerks × 100 deposits each · read the card, work out the new balance at the desk (1 s), walk back and write it",
    question: "How many of the 200 deposits never reach the card?",
    options: ["None: each clerk writes their own deposit", "A handful, fewer than 5", "Dozens"],
    answer: 2,
    why: "Each write puts down \"what I read, plus 10\". If the other clerk wrote in between, that write is replaced by a balance that never included it. Nothing crashes and every clerk thinks they succeeded; the money just isn't there. The longer the gap between reading and writing, the more often someone else writes inside it.",
    watch: { clerks: 2, think: 1, protection: "none", scenario: "deposits", traffic: "busy" },
  },
  {
    id: "lock",
    title: "Take the key first",
    change: "4 clerks · a clerk takes the key from the hook before reading and hangs it back after writing",
    question: "Nothing is lost now. What happens to deposits per minute compared with no protection?",
    options: ["About the same", "Far fewer: only one clerk at a time can be between reading and writing", "More, because nobody has to redo work"],
    answer: 1,
    why: "The lock makes the whole read-think-write one at a time, including the walk and the thinking. Three clerks stand at the hook while one works. Correct, but the office now runs at the speed of one clerk. Keep what you do while holding a lock as short as possible.",
    watch: { clerks: 4, think: 1, protection: "lock", scenario: "deposits", traffic: "busy" },
  },
  {
    id: "cas",
    title: "Check the version",
    change: "Compare-and-swap: the card carries a version number; a write only lands if the version is still the one the clerk read, otherwise the clerk reads again and redoes the sum",
    question: "Going from 2 clerks to 4, what happens?",
    options: ["Nothing: the version check almost never fails", "Retries climb steeply, though no deposit is lost", "Deposits get lost when a retry fails"],
    answer: 1,
    why: "Compare-and-swap is optimistic: it assumes nobody else wrote, and pays only when someone did. With more clerks, more writes land inside each clerk's window, so more work is thrown away and redone. Best of all is to not read at all: an atomic increment (UPDATE accounts SET balance = balance + 10) is one step, so there is no window to race in.",
    watch: { clerks: 4, think: 1, protection: "cas", scenario: "deposits", traffic: "busy" },
  },
  {
    id: "booking",
    title: "Check, then book",
    change: "3 clerks fill 24 seats · each checks the board for a free seat, fills in the form at the desk, then pins the seat",
    question: "Every clerk checked the seat was free. How many seats end up booked twice?",
    options: ["None: they all checked first", "Several", "Nearly all of them"],
    answer: 1,
    why: "\"Check, then act\" has the same gap as read-modify-write: the seat was free when the clerk looked, not when they pinned it. Customers like the same front-row seats, which makes clashes more likely. The fix is to make the act carry the check: pin only if still free (a conditional update), or let the database refuse a second booking (a unique constraint on the seat).",
    watch: { clerks: 3, think: 1, protection: "none", scenario: "booking", traffic: "busy" },
  },
  {
    id: "hidden",
    title: "It passed locally",
    change: "The same unprotected code · 1 clerk (a unit test), 2 clerks at a quiet moment (a manual test), 4 clerks when the office is busy (production)",
    question: "What do the tests show?",
    options: ["The same loss rate as production", "None or almost none", "More losses than production, because tests are harsher"],
    answer: 1,
    why: "A race needs two clerks inside the same window. One clerk can never race with itself, and two clerks at a quiet moment rarely overlap. Production has many requests at once, so the bug shows up only there, and it isn't reproducible on demand. Find races by reading the code for read-then-write and check-then-act, and test them with many concurrent requests on purpose.",
    watch: { clerks: 2, think: 0.2, protection: "none", scenario: "deposits", traffic: "quiet" },
  },
];

const QUESTIONS = [
  ["Two requests run `balance = get(); set(balance + 10)` at the same time. Explain how money disappears.",
    "Both read the same balance, say 100. Each adds 10 and writes 110. Two deposits happened, but the balance only went up once. Neither request failed, so nothing is logged; the second write simply replaced the first."],
  ["Name three ways to fix a lost update on a database row, and when you'd pick each.",
    "An atomic update in one statement (UPDATE … SET balance = balance + 10): the best when the change can be expressed that way. Optimistic locking (a version column, UPDATE … WHERE version = 7, retry on 0 rows): good when conflicts are rare. A lock (SELECT … FOR UPDATE, or a mutex): when the change needs a long read-modify-write and conflicts are common, keeping the locked section short."],
  ["Why can a lock make a fast system slow, and how do you avoid that?",
    "Everything inside the lock runs one at a time. If the locked section includes slow work (a network call, a heavy computation, waiting for a user), every other request queues behind it. Do the slow work before taking the lock, keep only the read and write inside it, or avoid the lock with an atomic operation."],
  ["What is check-then-act, and what is a real example in a web app?",
    "Checking a condition and then acting on it as two separate steps: \"is this username free? then create the user\", \"is the seat free? then book it\", \"is stock above 0? then sell\". Between the check and the act, another request can make the check false. Fix it by making the database enforce it: a unique constraint, a conditional update, or an insert that fails on conflict."],
  ["Your tests pass but production has a lost-update bug. Why didn't the tests catch it, and how would you write a test that does?",
    "Tests usually send one request at a time, so two requests never overlap inside the read-write window. Write a test that fires many concurrent requests at the same record (and add a small delay between read and write to widen the window), then check the final value equals the number of successful requests."],
  ["Compare-and-swap never loses an update. Why might it still be the wrong choice?",
    "Under heavy contention most attempts fail and get retried, so the same work is done many times, latency grows and some requests can starve. If the update can be one atomic operation, use that; if contention is high and the work is long, a short lock or a queue that serialises updates per record may be better."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Bank office",
  keys: [
    { mark: "lit", label: "A deposit written over, or a seat pinned twice" },
    { mark: "raised", label: "Ledger card: the balance counter and what it should be" },
    { mark: "flat", label: "Desks at the front, seat board at the right" },
  ],
  caption:
    "Each deposit adds 10. A clerk copies the balance onto a slip, walks back to the desk to work out the new balance, then walks back and writes it. When two slips carry the same old balance, the second write undoes the first, and BALANCE falls behind SHOULD BE. The key on the hook is a lock: whoever holds it is the only one between reading and writing. The stamp in the card's corner is the version: with the version check, a write only lands if the slip's v-number still matches. In seat booking, clerks check the board, fill in the form, then pin the seat; a seat with two pins is double-booked.",
  stage: 'data-office aria-label="Race condition simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">In seat booking, "Version check" means pin only if the seat is still free, and "Atomic" means a unique constraint on the seat. Changing a setting starts the run again.</p>`;
const controls = panel({
  stats: [["made", "Deposits made"], ["card", "On the card"], ["lost", "Lost"], ["retries", "Retries"], ["perMinute", "Per minute", "–"], ["wait", "Avg time", "–"]],
  controls: [
    seg("scenario", "Scenario", [["deposits", "Deposits"], ["booking", "Seat booking"]], "deposits"),
    seg("clerks", "Clerks", [[1, "1"], [2, "2"], [3, "3"], [4, "4"]], 2),
    seg("think", "Time at the desk", [[0.2, "0.2 s"], [1, "1 s"], [3, "3 s"]], 1),
    seg("protection", "Protection", [["none", "None"], ["lock", "Lock"], ["cas", "Version check"], ["atomic", "Atomic"]], "none"),
    seg("traffic", "Office", [["busy", "Busy"], ["quiet", "Quiet"]], "busy"),
    speedSeg(),
    actions("Do something", [["reset", "Start over"], ["pause", "Pause"]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
body.lit-fill [data-slip]:has(> [data-slip-lit]:not([style*="none"])) :is([data-slip-value],[data-slip-note]){fill:var(--anatomy-page)}
.iso-stage .iso-face-text[data-tone="lit"]{fill:var(--anatomy-lit)}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, title, answer, watch }) => ({ id, title, answer, watch })))};
const CLERK_SVG = ${JSON.stringify(clerkSvg())};
const NAMES = "ABCD";
const NS = "http://www.w3.org/2000/svg";

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const layer = q("[data-clerks]");
const hookKey = q("[data-hook-key]");
const cardLit = q("[data-card-lit]");
const seatEls = G.SEAT_AT.map((_, n) => { const g = q('[data-seat="' + n + '"]'); return { pins: [g.querySelector('[data-pin="0"]'), g.querySelector('[data-pin="1"]')], ring: g.querySelector("[data-ring]") }; });
const clerkEls = [0, 1, 2, 3].map((i) => {
  const g = document.createElementNS(NS, "g");
  g.setAttribute("data-clerk", String(i));
  g.innerHTML = CLERK_SVG;
  layer.appendChild(g);
  return { g, key: g.querySelector("[data-key]"), slip: g.querySelector("[data-slip]"), lit: g.querySelector("[data-slip-lit]"), value: g.querySelector("[data-slip-value]"), note: g.querySelector("[data-slip-note]") };
});
const digits = { b: [0, 1, 2, 3].map((n) => q('[data-digit="b' + n + '"]')), e: [0, 1, 2, 3].map((n) => q('[data-digit="e' + n + '"]')) };
const versionEl = q("[data-version]");
const labelEls = { balance: q('[data-label="balance"]'), expected: q('[data-label="expected"]') };
const put = (el, text) => { if (el.textContent !== text) el.textContent = text; };
const wheels = (row, n) => { const t = String(Math.max(0, Math.min(9999, n))).padStart(4, "0"); row.forEach((el, i) => put(el, t[i])); };
const ROWS = "ABCD";
function slipText(c, booking) {
  if (booking) return c.seat >= 0 ? [ROWS[Math.floor(c.seat / 6)] + (c.seat % 6 + 1), "seat"] : ["", ""];
  if (c.pre) return ["+10", "add"];
  return c.slip ? [String(c.slip.value * 10), "v" + c.slip.version] : ["", ""];
}

const cfg = { clerks: 2, think: 1, protection: "none", scenario: "deposits", traffic: "busy", speed: 1 };
let s, clock, seen, fullSince, doneTimes, seed = (Date.now() % 1e6) + 1;

function restart() {
  s = makeSim({ clerks: cfg.clerks, think: cfg.think, protection: cfg.protection, scenario: cfg.scenario, traffic: cfg.traffic }, seed++);
  clock = 0; seen = 0; fullSince = -1; doneTimes = [];
  const booking = cfg.scenario === "booking";
  const labels = booking ? ["Bookings", "Seats taken", "Double-booked", "Retries", "Per minute", "Avg time"] : ["Deposits made", "On the card", "Lost", "Retries", "Per minute", "Avg time"];
  ["made", "card", "lost", "retries", "perMinute", "wait"].forEach((key, n) => { statEls[key].nextElementSibling.textContent = labels[n]; });
  put(labelEls.balance, booking ? "SEATS TAKEN" : "BALANCE");
  put(labelEls.expected, booking ? "PINS PLACED" : "SHOULD BE");
  paint(); showStats();
}

const STOP = { idle: 1, think: 1, done: 1 };
const AT_STAND = { queue: 1, read: 1, write: 1 };
const OUT = { toStand: 1, toStand2: 1 };
const BACK = { toDesk1: 1, toDesk: 1 };
function position(c) {
  const home = G.DESK_SPOT[c.i], away = (cfg.scenario === "booking" ? G.BOARD_SPOT : G.STAND_SPOT)[c.i];
  if (STOP[c.phase]) return home;
  if (AT_STAND[c.phase]) return away;
  const u = ease(Math.max(0, Math.min(1, (clock - c.t0) / Math.max(1e-6, c.t1 - c.t0))));
  const [a, b] = OUT[c.phase] ? [home, away] : [away, home];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}
function carrying(c) {
  if (c.pre) return c.phase === "think" || c.phase === "toStand" || c.phase === "write";
  return c.phase === "toDesk1" || c.phase === "think" || c.phase === "toStand2" || c.phase === "write";
}

function paint() {
  const order = [], booking = cfg.scenario === "booking";
  s.clerks.forEach((c) => {
    const el = clerkEls[c.i];
    const [x, y] = position(c);
    el.g.setAttribute("transform", translateAlong(P, [x, y, 0]));
    el.g.style.display = "";
    const flash = c.lit >= 0 && clock - c.lit < 1.6;
    el.lit.style.display = flash ? "" : "none";
    const holding = (flash || carrying(c)) && !c.empty;
    el.slip.style.display = holding ? "" : "none";
    if (holding) { const [v, note] = slipText(c, booking); put(el.value, v); put(el.note, note); }
    el.key.style.display = s.key.holder === c.i ? "" : "none";
    order.push([iso([x, y, 0], P)[1], el.g]);
  });
  for (let i = s.clerks.length; i < 4; i++) clerkEls[i].g.style.display = "none";
  order.sort((a, b) => a[0] - b[0]).forEach(([, g]) => layer.appendChild(g));
  hookKey.style.display = s.key.holder >= 0 ? "none" : "";
  if (booking) {
    wheels(digits.b, s.seats.filter((x) => x.length).length);
    wheels(digits.e, s.seats.reduce((a, x) => a + x.length, 0));
    put(versionEl, "v–");
  } else {
    wheels(digits.b, s.card.value * 10);
    wheels(digits.e, s.stats.done * 10);
    put(versionEl, "v" + s.card.version);
  }
  const lostNow = !booking && s.clerks.some((c) => c.lit >= 0 && clock - c.lit < 1.6);
  cardLit.style.display = lostNow ? "" : "none";
  digits.b.forEach((el) => el.setAttribute("data-tone", lostNow ? "lit" : "hi"));
  s.seats.forEach((list, n) => {
    const e = seatEls[n], count = booking ? list.length : 0;
    e.pins[0].style.display = count >= 1 ? "" : "none";
    e.pins[1].style.display = count >= 2 ? "" : "none";
    e.ring.style.display = count >= 2 ? "" : "none";
  });
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function showStats() {
  const st = s.stats, booking = cfg.scenario === "booking";
  statEls.made.textContent = booking ? st.booked : st.done;
  statEls.card.textContent = booking ? s.seats.filter((x) => x.length).length : s.card.value;
  statEls.lost.textContent = booking ? st.doubles : st.lost;
  statEls.retries.textContent = st.retries;
  const span = Math.min(clock, 60);
  statEls.perMinute.textContent = span > 5 ? Math.round((doneTimes.filter((t) => t > clock - span).length / span) * 60) : "–";
  statEls.wait.textContent = st.done ? (st.waitSum / st.done).toFixed(1) + " s" : "–";
}

function tell(e) {
  const who = "clerk " + NAMES[e.clerk];
  const text = {
    lost: who + " · wrote over " + e.overwritten + " deposit" + (e.overwritten > 1 ? "s" : "") + " · lost",
    wrote: who + " · deposit written",
    stale: who + " · version changed, reading again",
    added: who + " · added 10 in one step",
    key: who + " · took the key",
    double: who + " · seat " + (e.seat + 1) + " double-booked",
    booked: who + " · seat " + (e.seat + 1) + " booked",
    taken: who + " · seat " + (e.seat + 1) + " already taken, choosing again",
  }[e.kind];
  if (text) say(text);
}

let statTimer = 0;
function step(dt) {
  const d = dt * cfg.speed;
  clock += d;
  const before = s.stats.done;
  s.runTo(clock);
  for (let n = before; n < s.stats.done; n++) doneTimes.push(clock);
  if (doneTimes.length > 400) doneTimes.splice(0, doneTimes.length - 400);
  while (seen < s.events.length) tell(s.events[seen++]);
  if (s.boardFull()) {
    if (fullSince < 0) fullSince = clock;
    else if (clock - fullSince > 2.5) { s.clearBoard(); fullSince = -1; say("board full · cleared for the next show"); }
  } else fullSince = -1;
  paint();
  statTimer += dt; if (statTimer > 0.2) { statTimer = 0; showStats(); }
}

// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });
const NUMERIC = ["clerks", "think", "speed"];
function set(name, raw, quiet) {
  cfg[name] = NUMERIC.includes(name) ? Number(raw) : raw;
  WB.pressSeg(name, raw);
  if (name !== "speed" && !quiet) { restart(); say("settings applied · run restarted"); }
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="reset"]').addEventListener("click", () => { restart(); say("started over"); });
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const D = { scenario: "deposits", traffic: "busy", quota: 100 };
const r1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const RUNS = {
  overlap: () => {
    const runs = [0.2, 1, 3].map((think) => average({ ...D, clerks: 2, think, protection: "none" }));
    const lost = runs.map((a) => Math.round(a.lost));
    return { verdict: lost[1] + " of 200 deposits lost with 1 s at the desk. With 0.2 s: " + lost[0] + "; with 3 s: " + lost[2] + ".",
      bars: [["0.2 s at desk", lost[0] / 200, lost[0] + " lost"], ["1 s at desk", lost[1] / 200, lost[1] + " lost", true], ["3 s at desk", lost[2] / 200, lost[2] + " lost"]] };
  },
  lock: () => {
    const none = average({ ...D, clerks: 4, think: 1, protection: "none" }), lock = average({ ...D, clerks: 4, think: 1, protection: "lock" }), one = average({ ...D, clerks: 1, think: 1, protection: "none" });
    const top = Math.max(none.perMinute, lock.perMinute);
    return { verdict: "Deposits per minute with 4 clerks: " + Math.round(none.perMinute) + " unprotected (losing " + Math.round(none.lost) + " of 400), " + Math.round(lock.perMinute) + " with the lock (losing none). One clerk alone manages " + Math.round(one.perMinute) + ".",
      bars: [["No protection", none.perMinute / top, Math.round(none.perMinute) + "/min"], ["Lock", lock.perMinute / top, Math.round(lock.perMinute) + "/min", true], ["One clerk", one.perMinute / top, Math.round(one.perMinute) + "/min"]] };
  },
  cas: () => {
    const two = average({ ...D, clerks: 2, think: 1, protection: "cas" }), four = average({ ...D, clerks: 4, think: 1, protection: "cas" });
    const lock = average({ ...D, clerks: 4, think: 1, protection: "lock" }), atomic = average({ ...D, clerks: 4, think: 1, protection: "atomic" });
    const r2 = two.retries / two.done, r4 = four.retries / four.done, topR = Math.max(r2, r4), topW = Math.max(lock.wait, four.wait, atomic.wait);
    return { verdict: "Retries per deposit: " + r2.toFixed(2) + " with 2 clerks, " + r4.toFixed(2) + " with 4, and nothing lost. Average time per deposit with 4 clerks: " + r1(lock.wait) + " s with the lock, " + r1(four.wait) + " s with the version check, " + r1(atomic.wait) + " s with an atomic increment.",
      bars: [["Retries, 2 clerks", r2 / topR, r2.toFixed(2)], ["Retries, 4 clerks", r4 / topR, r4.toFixed(2), true], ["Time, lock", lock.wait / topW, r1(lock.wait) + " s"], ["Time, version", four.wait / topW, r1(four.wait) + " s", true], ["Time, atomic", atomic.wait / topW, r1(atomic.wait) + " s"]] };
  },
  booking: () => {
    const none = average({ scenario: "booking", traffic: "busy", clerks: 3, think: 1, protection: "none" }), cas = average({ scenario: "booking", traffic: "busy", clerks: 3, think: 1, protection: "cas" });
    return { verdict: r1(none.doubleSeats) + " of 24 seats booked twice on average with check-then-book. With \\"pin only if still free\\": 0, at the cost of " + r1(cas.retries) + " re-checks.",
      bars: [["Check, then book", none.doubleSeats / 24, r1(none.doubleSeats) + " seats", true], ["Pin if still free", cas.doubleSeats / 24, r1(cas.doubleSeats) + " seats"]] };
  },
  hidden: () => {
    const unit = average({ ...D, clerks: 1, think: 1, protection: "none" }), manual = average({ ...D, clerks: 2, think: 0.2, traffic: "quiet", protection: "none" }), prod = average({ ...D, clerks: 4, think: 1, traffic: "busy", protection: "none" });
    const p = (a) => a.done ? a.lost / a.done : 0;
    const pc = (a) => Math.round(100 * p(a)) + "%";
    return { verdict: "Deposits lost: " + pc(unit) + " in the unit test, " + pc(manual) + " in the quiet manual test, " + pc(prod) + " in busy production.",
      bars: [["Unit test", p(unit), pc(unit)], ["Manual, quiet", p(manual), pc(manual)], ["Production", p(prod), pc(prod), true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  for (const name of ["scenario", "clerks", "think", "protection", "traffic"]) set(name, String(w[name]), true);
  restart();
  if (loop.paused) loop.setPaused(false);
  say("watching: " + exp.title.toLowerCase());
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./race-condition-workbench.html", import.meta.url), {
  title: "Race Condition Workbench",
  eyebrow: "Systems lesson 17 · Race conditions",
  lede: "A race condition happens when two requests read the same thing, both decide what to write, and one quietly undoes the other. Nothing crashes, so it hides until there is real traffic. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
  machine: { intro: "Every clerk updates the same ledger card. Watch them read, think and write, then add clerks, lengthen the time at the desk, and try each kind of protection.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs of 100 deposits per clerk unless noted.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote race-condition-workbench.html", (size / 1024).toFixed(0) + " KB");

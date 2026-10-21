// Systems lesson 25 · Idempotency keys. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, tokenSvgs, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "lost",
    title: "Lost replies, no keys",
    change: "Keys off · 1 reply in 10 is lost on the way back · a customer who hears nothing in 5 s pays again · 4 customers, 3 minutes",
    question: "The counter charges correctly every time it receives a slip. Out of roughly 120 orders, how many end up charged twice?",
    options: ["None: every charge the counter made was a real request", "About one for every lost reply, roughly 1 in 10", "About half of them"],
    answer: 1,
    why: "A lost reply looks exactly like a lost request from the customer's side: no answer. So the customer pays again, and the counter, which has no memory of the first slip, charges again. Every lost reply after a successful charge becomes a double charge. Nothing failed on the server; the duplicate was created by a correct retry.",
    watch: { keys: "off", loss: 0.1, timeout: "patient", lifetime: "long", drift: 0 },
  },
  {
    id: "keys",
    title: "Remember the result",
    change: "Every order carries a key · the counter files key → receipt after charging · a slip whose key is on file gets the stored receipt back · same 10% loss",
    question: "What happens to the retries now?",
    options: ["Still charged, just about half as often", "Nobody is charged twice: each retry is answered with the stored receipt", "Nobody is charged twice, but the retried orders fail"],
    answer: 1,
    why: "The retry carries the same key, finds the receipt in the rack and gets the original answer back, with no second charge. From the customer's side it looks exactly like the first reply arriving late, which is the point: an idempotent operation can be repeated safely, so retries become harmless.",
    watch: { keys: "store", loss: 0.1, timeout: "patient", lifetime: "long", drift: 0 },
  },
  {
    id: "race",
    title: "An impatient customer",
    change: "Customers wait only 1 s before paying again · charging takes 1.2–2.4 s · no replies lost · the key is filed only once the charge is done",
    question: "Keys are on and no reply is ever lost. How many orders are charged twice?",
    options: ["None: the key stops every duplicate", "A handful, when timing is unlucky", "Most of them"],
    answer: 2,
    why: "The retry arrives while the first charge is still running, and the rack has nothing filed for that key yet, so the counter charges again. Checking a key and filing it later is a race. The fix is to claim the key before doing the work: an in-progress marker written atomically (a unique insert), so a second slip with the same key is told \"still in progress\" (409) and tries again later, when the receipt is on file.",
    watch: { keys: "store", loss: 0, timeout: "impatient", lifetime: "long", drift: 0 },
  },
  {
    id: "ttl",
    title: "Keys that expire",
    change: "Key lifetime 1 day → 8 s · 3 replies in 10 lost · retries back off 1, 2, 4 s, so a third try comes about 14 s after the first",
    question: "With the in-progress marker on, does a short key lifetime change anything?",
    options: ["No: any retry still finds its key", "A few orders are charged twice again: their retry arrives after the key was thrown away", "The late retries are rejected with an error"],
    answer: 1,
    why: "Once a key is forgotten, a retry with that key is a brand-new request, so it is charged. A key must be kept for longer than the longest time a client may still retry the same operation (including retries after an app restart or a queue redelivery). Payment APIs keep keys for about 24 hours for this reason.",
    watch: { keys: "lock", loss: 0.3, timeout: "patient", lifetime: "short", drift: 0 },
  },
  {
    id: "drift",
    title: "Same key, different amount",
    change: "A buggy client recalculates the total (+$5) on half of its retries but reuses the order's key · 3 replies in 10 lost · keys on",
    question: "What should the counter do with a retry whose key is on file but whose amount differs?",
    options: ["Charge the new amount: it's what the customer asked for now", "Return the stored receipt as if nothing changed", "Refuse it (422) and charge nothing"],
    answer: 2,
    why: "A key names one specific operation. If the request behind it changed, either the client has a bug or two different operations share a key; replaying the old receipt would tell the client the new amount was charged when it wasn't, and charging would double-charge. So the server keeps a fingerprint of the original request and rejects a mismatch loudly (422), which surfaces the client bug.",
    watch: { keys: "lock", loss: 0.3, timeout: "patient", lifetime: "long", drift: 0.5 },
  },
];

const QUESTIONS = [
  ["The payment service charged the card once for every request it received, yet a customer was charged twice. How?",
    "The first charge succeeded but its reply was lost (or arrived after the client's timeout). The client can't tell that apart from a failed request, so it retried, and the server, with no memory of the first request, treated the retry as a new payment. Retries are correct behaviour; the server must make them safe."],
  ["What should the server store for each idempotency key, and why the whole response rather than just \"seen\"?",
    "The response it sent (status and body) plus a fingerprint of the request. A retry must get the same answer the first request got, including the charge ID or the error, so the client can carry on as if the first reply had arrived. \"Seen\" alone would leave the server unable to answer the retry."],
  ["Why is \"look up the key, charge, then save the key\" not enough?",
    "Two requests with the same key can arrive close together; both look up, both find nothing, both charge. The key must be claimed before the work starts, atomically: insert an in-progress row with a unique constraint, and answer a concurrent duplicate with 409 (or make it wait) until the first finishes and its response is stored."],
  ["How long should keys be kept?",
    "Longer than any client could still retry the same operation: across backoff schedules, app restarts, queued retries and message redeliveries. A day is common for payment APIs. Too short and late retries become duplicates; forever is unnecessary storage."],
  ["Who generates the key, and how should keys be scoped?",
    "The client generates one key per logical operation (for example a UUID created when the user presses Pay) and reuses it for every retry of that operation, never for a different one. The server scopes keys per account or API client, so two clients that pick the same key can't see each other's results."],
  ["Which operations need idempotency keys, and where else does the same idea show up?",
    "Anything that isn't naturally idempotent: creating payments, orders, emails, transfers. PUT and DELETE that set a final state usually are idempotent already. The same idea appears in message consumers (dedupe by message ID under at-least-once delivery), webhooks, and the outbox pattern's relay."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Payment counter",
  keys: [
    { mark: "lit", label: "A receipt answered from the rack; a customer paying again; a card charged twice" },
    { mark: "raised", label: "Slips going up, replies coming back, the stored receipts" },
    { mark: "flat", label: "Lanes, and the trough where lost replies fall" },
  ],
  caption:
    "Each customer holds a slip with their order's key (A7 is customer A's 7th order) and how many times they've tried. Slips go up the left side of a lane to a card terminal; replies come back down the right side, and some fall into the trough. Behind the counter, the key rack holds one stored receipt per key, or a flag while that key's charge is still running. A lit receipt in the rack means a retry was answered from it. The till counts orders paid against card charges: when charges run ahead, someone paid twice.",
  stage: 'data-counter aria-label="Idempotency key simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">Changing any setting starts the run again. "Double-click Pay" makes customer A send the same slip twice at once.</p>`;
const controls = panel({
  stats: [["orders", "Orders paid"], ["charges", "Card charges"], ["twice", "Charged twice"], ["replays", "Answered from rack"], ["c409", "Still in progress (409)"], ["r422", "Rejected (422)"], ["lost", "Replies lost"]],
  controls: [
    seg("keys", "Idempotency keys", [["off", "Off"], ["store", "File after charging"], ["lock", "Claim first (in-progress flag)"]], "lock"),
    seg("loss", "Replies lost", [[0, "None"], [0.1, "1 in 10"], [0.3, "3 in 10"]], 0.3),
    seg("timeout", "Customer waits", [["patient", "5 s"], ["impatient", "1 s"]], "patient"),
    seg("lifetime", "Key kept for", [["long", "1 day"], ["short", "8 s"]], "long"),
    seg("drift", "Amount on retry", [[0, "Same"], [0.5, "Sometimes +$5"]], 0),
    speedSeg(),
    actions("Do something", [["double", "Double-click Pay"], ["reset", "Start over"], ["pause", "Pause"]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
.iso-stage .iso-face-text[data-tone="lit"]{fill:var(--anatomy-lit)}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const TOKENS = ${JSON.stringify(tokenSvgs())};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const POOL = 60, PILE = 3;
const WARM = 30;   // each run starts half a minute in, so the first frame already shows keys, retries and lost replies

const stage = document.querySelector("[data-counter]");
const svg = stage.querySelector("svg");
const q = (s, root = svg) => root.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const NS = "http://www.w3.org/2000/svg";
const label = (key) => "ABCD"[Number(key.slice(1, key.indexOf("-")))] + key.slice(key.indexOf("-") + 1);

function poolOf(layer, n) {
  return Array.from({ length: n }, () => { const g = document.createElementNS(NS, "g"); g.style.display = "none"; layer.appendChild(g); return { g, kind: null }; });
}
const tokens = poolOf(q("[data-tokens]"), POOL);
const work = poolOf(q("[data-work]"), 12);
function place(list, used, kind, point) {
  if (used >= list.length) return used;
  const t = list[used];
  if (t.kind !== kind) { t.g.innerHTML = TOKENS[kind]; t.kind = kind; }
  t.g.style.display = "";
  t.g.setAttribute("transform", translateAlong(P, point));
  return used + 1;
}
const hide = (list, from) => { for (let i = from; i < list.length; i++) list[i].g.style.display = "none"; };

const holes = Array.from({ length: SLOTS }, (_, i) => { const g = q('[data-hole="' + i + '"]'); return { g, card: q("[data-card]", g), lit: q("[data-card-lit]", g), flag: q("[data-flag]", g), key: q("[data-hole-key]", g), shown: "" }; });
const customers = [0, 1, 2, 3].map((i) => { const g = q('[data-customer="' + i + '"]'); return { slip: q("[data-slip]", g), plain: q("[data-slip-plain]", g), lit: q("[data-slip-lit]", g), top: q("[data-slip-top]", g), note: q("[data-slip-note]", g) }; });
const screens = [0, 1, 2, 3].map((i) => ({ off: q('[data-screen="' + i + '"]'), on: q('[data-screen-lit="' + i + '"]') }));
const digits = (name, n) => Array.from({ length: n }, (_, j) => q('[data-digit="' + name + j + '"]'));
const dials = { orders: digits("orders", 4), charges: digits("charges", 4), replays: digits("replays", 4) };
function showDial(name, value, lit) {
  const s = String(Math.max(0, Math.floor(value)) % 10000).padStart(4, "0");
  dials[name].forEach((el, j) => { if (el.textContent !== s[j]) el.textContent = s[j]; const tone = lit ? "lit" : "hi"; if (el.getAttribute("data-tone") !== tone) el.setAttribute("data-tone", tone); });
}
const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };
const showEl = (el, on) => { const v = on ? "" : "none"; if (el.style.display !== v) el.style.display = v; };

const cfg = { keys: "lock", loss: 0.3, timeout: "patient", lifetime: "long", drift: 0, speed: 1 };
let model, clock, logAt, holeHit, lastExtra, lastEvent, outcomes, piles;
let seed = (Date.now() % 1e6) + 1;

function restart() {
  model = makeSim({ keys: cfg.keys, loss: cfg.loss, timeout: cfg.timeout, lifetime: cfg.lifetime, drift: cfg.drift }, seed++);
  clock = WARM; logAt = 0; holeHit = {}; lastExtra = -9; lastEvent = null; outcomes = [null, null, null, null]; piles = [[], [], [], []];
  model.runTo(clock);
  paint();
}

const SPAN = G.LANE_NEAR - G.LANE_FAR;
const FALL_AT = (G.TROUGH_Y - G.LANE_FAR) / SPAN;    // share of a reply's trip at which a lost one drops

function pilePoint(lane, n) {
  const x = G.XS[lane] + G.LANE + 1.2 + (n % 2) * 3.2 - 2.2, y = G.TROUGH.y0 + 2.6 + Math.floor(n / 2) * 2.6 + (n % 2) * 1.2;
  return [x, y, G.TROUGH_H - 0.6];
}

function paint() {
  // Events since the last frame: rack hits, double charges, finished orders, the readout.
  for (; logAt < model.log.length; logAt++) {
    const e = model.log[logAt];
    if (e.type === "replay" || e.type === "422") holeHit[e.slot] = e.t;
    if (e.type === "charge" && e.n > 1) lastExtra = e.t;
    if (e.type !== "send" || e.try > 1) lastEvent = e;
  }
  model.purchases.forEach((p) => { if (p.done && p.end > clock - 1.6 && p.end <= clock) outcomes[p.client] = p; });

  // Slips and replies on the lanes; lost replies fall into the trough and stay.
  let used = 0;
  for (const tr of model.trips) {
    if (tr.sent > clock) break;
    const x = G.XS[tr.client];
    const p = (clock - tr.sent) / (tr.arrive - tr.sent);
    if (tr.kind === "req") {
      if (p >= 1) continue;
      used = place(tokens, used, "req", [x - G.LANE, G.LANE_NEAR - p * SPAN, 0]);
    } else {
      const kind = tr.status === "ok" ? "ok" : tr.status;
      if (tr.lost && p >= FALL_AT) {
        if (!tr.piled) { tr.piled = true; piles[tr.client].push(tr); }
        const drop = Math.min(1, (p - FALL_AT) / 0.25);
        if (drop < 1) used = place(tokens, used, kind, [x + G.LANE, G.TROUGH_Y, G.TROUGH_H + 2 - 2.6 * drop]);
        continue;
      }
      if (p >= 1) continue;
      used = place(tokens, used, kind, [x + G.LANE, G.LANE_FAR + p * SPAN, 0]);
    }
  }
  piles.forEach((pile, lane) => {
    const settled = pile.filter((tr) => (clock - tr.sent) / (tr.arrive - tr.sent) >= FALL_AT + 0.25);
    settled.slice(-PILE * 2).forEach((tr, n) => { used = place(tokens, used, tr.status === "ok" ? "ok" : tr.status, pilePoint(lane, n)); });
  });
  hide(tokens, used);

  // Slips being charged, on each terminal's tray; a second charge for the same order is lit.
  let w = 0;
  const busy = [false, false, false, false];
  const counts = {};
  for (const job of model.working) {
    if (job.start > clock) continue;
    busy[job.client] = true;
    const stackN = counts[job.client] = (counts[job.client] || 0) + 1;
    const p = model.purchases.find((pp) => pp.key === job.key);
    const dup = (p && p.charges > 0) || model.working.some((o) => o !== job && o.key === job.key && o.start < job.start);
    w = place(work, w, dup ? "workLit" : "work", [G.TRAY[job.client][0], G.TRAY[job.client][1], G.TRAY_Z + (stackN - 1) * 1.3]);
  }
  hide(work, w);
  screens.forEach((s, i) => { showEl(s.off, !busy[i]); showEl(s.on, busy[i]); });

  // The key rack.
  const rack = model.rack(clock);
  holes.forEach((h, i) => {
    const e = rack[i];
    const live = e && e.state !== "expired";
    showEl(h.g, !!live);
    if (!live) return;
    const hit = holeHit[i] != null && clock - holeHit[i] < 0.9;
    showEl(h.card, e.state === "done" && !hit);
    showEl(h.lit, e.state === "done" && hit);
    showEl(h.flag, e.state === "progress");
    setText(h.key, label(e.key));
  });

  // Customers' slips: the order's key and try, then the outcome for a moment.
  model.customers.forEach((cu, i) => {
    const c = customers[i], o = outcomes[i];
    const showOutcome = o && clock - o.end < 1.6;
    const p = showOutcome ? o : cu.current;
    showEl(c.slip, !!p);
    if (!p) return;
    const retrying = !showOutcome && p.tries > 1;
    showEl(c.plain, !retrying); showEl(c.lit, retrying);
    if (showOutcome) {
      setText(c.top, o.outcome === "paid" ? "PAID" : o.outcome === "rejected" ? "422" : "GAVE UP");
      setText(c.note, label(o.key) + (o.charges > 1 ? " · charged " + o.charges + "×" : " · $" + o.amount));
    } else {
      setText(c.top, label(p.key));
      setText(c.note, "try " + p.tries + " · $" + p.amount);
    }
  });

  // The till.
  const S = model.stats;
  const twice = model.purchases.filter((p) => p.charges > 1).length;
  showDial("orders", model.charged(), false);
  showDial("charges", S.charges, clock - lastExtra < 1.2);
  showDial("replays", S.replays, false);

  // Readout and stats.
  const e = lastEvent && clock - lastEvent.t < 2.5 ? lastEvent : null;
  const k = e && e.key ? label(e.key) : "";
  say(!e ? model.charged() + " orders paid · " + S.charges + " card charges"
    : e.type === "send" ? k + " · no reply yet, paying again (try " + e.try + ")"
    : e.type === "lost" ? k + " · reply lost on the way back"
    : e.type === "replay" ? k + " · answered from the rack, not charged again"
    : e.type === "409" ? k + " · still in progress (409), try again shortly"
    : e.type === "422" ? k + " · same key, different amount: rejected (422)"
    : e.type === "expired" ? k + " · key expired, so this is a new payment"
    : e.type === "charge" && e.n > 1 ? k + " · charged again (" + e.n + "×)"
    : model.charged() + " orders paid · " + S.charges + " card charges");
  stat("orders", model.charged());
  stat("charges", S.charges);
  stat("twice", twice);
  stat("replays", S.replays);
  stat("c409", S.conflicts);
  stat("r422", S.rejected);
  stat("lost", S.lost);
}
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(key, value) { const el = statEls[key]; const text = String(value); if (el && el.textContent !== text) el.textContent = text; }

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(); }, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });

function set(name, raw, quiet) {
  WB.pressSeg(name, raw);
  if (name === "speed") { cfg.speed = Number(raw); return; }
  cfg[name] = name === "loss" || name === "drift" ? Number(raw) : raw;
  if (!quiet) restart();
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="double"]').addEventListener("click", () => { model.doubleClick(0, clock); if (loop.paused) loop.setPaused(false); });
document.querySelector('[data-act="reset"]').addEventListener("click", () => restart());
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const r0 = (x) => String(Math.round(x));
const pct = (x) => Math.round(100 * x) + "%";
const RUNS = {
  lost: () => {
    const r = runScenario({ keys: "off", loss: 0.1 });
    return { verdict: "Of " + r0(r.purchases) + " orders, " + r0(r.doubled) + " were charged twice (" + pct(r.doubled / r.purchases) + "), against " + r0(r.lost) + " lost replies. Every charge was a real request; the duplicates came from correct retries.",
      bars: [["Orders", 1, r0(r.purchases)], ["Replies lost", r.lost / r.purchases, r0(r.lost)], ["Charged twice", r.doubled / r.purchases, r0(r.doubled), true]] };
  },
  keys: () => {
    const off = runScenario({ keys: "off", loss: 0.1 }), on = runScenario({ keys: "store", loss: 0.1 }), top = Math.max(off.doubled, on.replays, 1);
    return { verdict: "With keys, " + r0(on.doubled) + " orders were charged twice (" + r0(off.doubled) + " without). " + r0(on.replays) + " retries were answered from the rack with the original receipt.",
      bars: [["Charged twice, no keys", off.doubled / top, r0(off.doubled)], ["Charged twice, with keys", on.doubled / top, r0(on.doubled), true], ["Answered from the rack", on.replays / top, r0(on.replays), true]] };
  },
  race: () => {
    const late = runScenario({ keys: "store", loss: 0, timeout: "impatient" }), claim = runScenario({ keys: "lock", loss: 0, timeout: "impatient" });
    return { verdict: "Filing the key after charging: " + r0(late.doubled) + " of " + r0(late.purchases) + " orders charged twice (" + pct(late.doubled / late.purchases) + "), with no reply ever lost. Claiming the key first: " + r0(claim.doubled) + " charged twice, and " + r0(claim.conflicts) + " early retries told \\"still in progress\\" (409).",
      bars: [["Charged twice, filed after", late.doubled / late.purchases, pct(late.doubled / late.purchases), true], ["Charged twice, claimed first", claim.doubled / claim.purchases, pct(claim.doubled / claim.purchases), true]] };
  },
  ttl: () => {
    const long = runScenario({ keys: "lock", loss: 0.3, lifetime: "long" }), short = runScenario({ keys: "lock", loss: 0.3, lifetime: "short" }), top = Math.max(short.doubled, short.expiredHits, 1);
    return { verdict: "Keys kept 1 day: " + r0(long.doubled) + " orders charged twice. Kept 8 s: " + r0(short.doubled) + " of " + r0(short.purchases) + " charged twice; " + r0(short.expiredHits) + " retries arrived after their key was gone.",
      bars: [["Charged twice, 1 day", long.doubled / top, r0(long.doubled)], ["Charged twice, 8 s", short.doubled / top, r0(short.doubled), true], ["Retries after expiry", short.expiredHits / top, r0(short.expiredHits)]] };
  },
  drift: () => {
    const on = runScenario({ keys: "lock", loss: 0.3, drift: 0.5 }), off = runScenario({ keys: "off", loss: 0.3, drift: 0.5 }), top = Math.max(on.rejected, off.wrongAmount, 1);
    return { verdict: "With keys: " + r0(on.rejected) + " retries with a changed amount were rejected (422) and " + r0(on.extra) + " extra charges were made. Without keys, " + r0(off.wrongAmount) + " orders were charged a second time at a different amount.",
      bars: [["Rejected (422), with keys", on.rejected / top, r0(on.rejected), true], ["Wrong second charges, with keys", on.wrongAmount / top, r0(on.wrongAmount)], ["Wrong second charges, no keys", off.wrongAmount / top, r0(off.wrongAmount)]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  for (const [name, value] of Object.entries(exp.watch)) set(name, String(value), true);
  restart();
  if (loop.paused) loop.setPaused(false);
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./idempotency-workbench.html", import.meta.url), {
  title: "Idempotency Workbench",
  eyebrow: "Systems lesson 25 · Idempotency keys",
  lede: "When a reply goes missing, the client can't tell whether its request worked, so it sends it again. An idempotency key lets the server recognise the retry and answer it with the result it already produced, instead of doing the work twice. This lesson builds that on a payment counter: watch it, predict what breaks it, then explain it back.",
  machine: { intro: "Four customers pay at a counter over lanes that sometimes lose the reply. Watch the till: card charges should match orders paid. With keys on, retries are answered from the rack of stored receipts; switch keys off, make the customers impatient or let keys expire, and watch charges run ahead of orders.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded three-minute runs.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote idempotency-workbench.html", (size / 1024).toFixed(0) + " KB");

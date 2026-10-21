// Systems lesson 30 · Sampling and cardinality. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, tokenSvg, needleAt, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));
const digits = inlineModule(new URL("./digits.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "status",
    title: "Add a status label",
    change: "http_requests_total{method, route} → {method, route, status} · 2 methods × 8 routes, status has 5 values · 100 requests/s for an hour",
    question: "The metric had 16 series. After adding status, how many series does it have?",
    options: ["21: five more, one per status", "About 80: every existing series splits into one per status", "Still 16: the status is stored inside each sample"],
    answer: 1,
    why: "A series is one combination of label values, so the count is the product of how many values each label takes: 2 × 8 × 5 = 80. Every label multiplies. Here that's fine: 80 series is a few hundred kilobytes, and every value is bounded.",
    watch: { labels: "status", route: "template" },
  },
  {
    id: "user",
    title: "Add user_id",
    change: "{method, route, status} → {method, route, status, user_id} · 10,000 active users · 100 requests/s for an hour",
    question: "Compared with the 80 series before, the count after one hour is…",
    options: ["About the same: user_id is just one more column", "About 125 times more: one per user, 10,000", "Thousands of times more: well over a hundred thousand series"],
    answer: 2,
    why: "user_id multiplies too: every route and status a user touches becomes its own series. Not every combination happens in an hour, but a large share do, and the count keeps climbing as the day goes on. At a few kilobytes per series that is hundreds of megabytes for one metric, and queries over it slow down. Per-user detail belongs in logs and traces, which cost per event, not per combination.",
    watch: { labels: "user", route: "template" },
  },
  {
    id: "raw",
    title: "Raw paths as the route",
    change: "route=\"/orders/{id}\" → route=\"/orders/58213\" · ids come from a catalogue of a million · {method, route, status} · 100 requests/s",
    question: "How many series after one hour, and after a day?",
    options: ["About 80 both times, like the template", "A lot more after an hour, then it levels off", "Far more after an hour and many times more again after a day: it never levels off"],
    answer: 2,
    why: "An id in a label is an unbounded label: there is no last value, so new series keep appearing for as long as new ids are requested. This is the most common way cardinality leaks into a metrics system: raw URLs, error messages, query strings, IP addresses. Template the route before it becomes a label.",
    watch: { labels: "status", route: "raw" },
  },
  {
    id: "head",
    title: "Head sampling at 1%",
    change: "Keep 1 in 100 traces, decided when the request starts · 0.1% of requests fail · one rare bug hits 1 in 10,000 · 100 requests/s, 12 hours",
    question: "Each hour about 360 requests fail, 36 of them from the rare bug. How many traces of the rare bug do you keep in an hour?",
    options: ["About 36: a fair share of everything is kept", "About 3 or 4", "Usually none: most hours have no example at all"],
    answer: 2,
    why: "The head gate decides before it knows how the request will end, so errors are kept at the same 1% as everything else: 360 errors become about 3 traces, and 36 rare failures become 0.36, so most hours have none. Head sampling is cheap and fine for the common path, but a rare failure needs far more traffic before you hold even one example. Count errors with metrics (which see every request) and keep error traces some other way.",
    watch: { labels: "status", route: "template", sampling: "head1" },
  },
  {
    id: "tail",
    title: "Tail sampling",
    change: "Wait until each trace finishes, then keep every error, every slow trace (0.5%) and 1% of the rest · same traffic as before",
    question: "Compared with head sampling at 1%, what does tail sampling cost?",
    options: ["Somewhat more storage, every error kept, but every trace must wait in a buffer until it finishes", "About 100 times the storage: it has to keep everything", "Less storage: it drops more of the ordinary traces"],
    answer: 0,
    why: "Errors and slow requests are a small share of traffic, so keeping all of them adds little to the 1% baseline, and you keep exactly the traces you'll want to open. The price moves elsewhere: the sampler must hold every trace in memory until it is complete (all its spans have arrived) before it can decide, and all spans of a trace must reach the same sampler.",
    watch: { labels: "status", route: "template", sampling: "tail" },
  },
];

const QUESTIONS = [
  ["A teammate adds user_id as a label on http_requests_total \"so we can see who is affected\". What happens, and what would you do instead?",
    "Every user multiplies the series: route × status × users, hundreds of thousands of series, so memory and ingestion cost jump, queries slow down, and the metrics system may start dropping data or hit limits. Keep metric labels bounded (method, route template, status class) and put user ids in logs and traces, linked from the metric by an exemplar or trace id. If you need per-customer numbers, use a small bounded label like a plan or tier."],
  ["How do you estimate how many series a metric will create before you ship it?",
    "Multiply the number of distinct values of every label; that's the ceiling, and real traffic hits a share of it. Remember the labels you don't write yourself: every instance or pod multiplies it again, and a histogram multiplies it by its number of buckets. If any label has no fixed list of values, the answer is \"unbounded\" and the label needs to change."],
  ["The number of series grows every day although nothing was deployed. Where would you look?",
    "For an unbounded label: raw paths with ids, error messages, query strings, IP addresses, user agents, or pod names that change on every restart or autoscale. Find the metric with the most series and the label with the most values, then template, bucket or drop that label (for example with a relabelling rule)."],
  ["Head sampling and tail sampling: what does each cost, and what does each miss?",
    "Head sampling decides at the start: cheap, stateless, every service follows the same decision, but it can't know a request will fail or be slow, so rare errors are mostly dropped. Tail sampling decides when the trace is complete, so it can keep every error and slow trace; it needs a buffer that holds every trace until it finishes, a wait before the decision, and all spans of a trace routed to the same sampler."],
  ["With head sampling at 1%, can you still tell the error rate? Can you find the trace of one customer's failed checkout?",
    "The rate, roughly, but counts from sampled traces are noisy when errors are rare: 360 errors an hour become about 3 kept traces. Take rates from metrics, which count every request. One specific failed checkout was almost certainly dropped; to have it you need tail sampling (keep all errors), a rule that always keeps errors, or logs that carry the trace id."],
  ["Metrics, logs and traces: where should high-cardinality data go, and why?",
    "Into logs and traces. A metric costs per series and is kept and indexed for every combination of labels, so each label must have few values. Logs and traces cost per event, so they can carry any id: user, order, request. Link them: a trace id in the logs, exemplars on the metric pointing to example traces."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Tally hall",
  keys: [
    { mark: "lit", label: "A failed request's trace, and a pigeonhole a card just landed in" },
    { mark: "raised", label: "Tally cards, traces (tall when slow), counters and kept trace cards" },
    { mark: "flat", label: "Belts, the buffer rack and the drop bins" },
  ],
  caption:
    "For every request the service cabinet sends a tally card up the back belt and a trace along the front belt. Each distinct combination of label values owns one pigeonhole in the wall: that is one time series. The series counter and the memory dial (one tick per ×10, from 10 KB to 10 GB) stand beside the wall; when every hole is taken, new series fall into the overflow bin. A gate with an open bin is the sampler in use: the head gate decides as the trace starts, the tail gate after it has waited in the buffer rack until it finished. Kept traces stand in the archive drawer, error traces lit, and its front counts traces kept, errors seen and errors kept.",
  stage: 'data-hall aria-label="Sampling and cardinality simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">The machine runs 8 requests a second, so it fills the wall in seconds; the experiments use 100 a second for hours. Changing the labels, the route, the sampler or the error rate starts the run again.</p>`;
const controls = panel({
  stats: [["requests", "Requests"], ["series", "Series"], ["memory", "Series memory", "–"], ["kept", "Traces kept"], ["errors", "Errors kept", "–"], ["buffer", "Waiting in buffer"]],
  controls: [
    seg("labels", "Labels", [["base", "Method · route"], ["status", "+ status"], ["user", "+ user id"]], "status"),
    seg("route", "Route label", [["template", "Template"], ["raw", "Raw path"]], "template"),
    seg("sampling", "Traces", [["all", "Keep all"], ["head10", "Head 10%"], ["head1", "Head 1%"], ["tail", "Tail"]], "tail"),
    seg("errors", "Errors", [[0.005, "0.5%"], [0.02, "2%"], [0.1, "10%"]], 0.02),
    speedSeg(),
    actions("Do something", [["reset", "Start over"], ["pause", "Pause"]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
.cw{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.6}
.dg{fill:none;stroke:var(--anatomy-strong);stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round}
.dg[data-size=m]{stroke-width:1.5}
.dg[data-size=s]{stroke-width:.9}
.hole{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:.6}
.hole-card{display:none;fill:var(--anatomy-lit-top);stroke:var(--anatomy-mid);stroke-width:.7}
[data-hole][data-on] .hole-card{display:inline}
[data-hole][data-hit] .hole-card{stroke:var(--anatomy-lit);stroke-width:1.5}
.bin-hole{fill:var(--anatomy-shade-0);stroke:none}
.needle{fill:none;stroke:var(--anatomy-strong);stroke-width:1.8;stroke-linecap:round}
`;

// ---------- live code ----------
const live = `
${sim}
${digits}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const TOK = ${JSON.stringify(tokenSvg())};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const VM = 45, VT = 30, HOP = 0.45, DROP = 0.5, WAIT = 2.5, SLOTHOP = 0.3, WARM = 40;

const stage = document.querySelector("[data-hall]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const NS = "http://www.w3.org/2000/svg";
const setD = (el, d) => { if (el.getAttribute("d") !== d) el.setAttribute("d", d); };

const holes = Array.from({ length: G.HOLES }, (_, i) => q('[data-hole="' + i + '"]'));
const bins = Array.from({ length: G.BIN_LEVELS }, (_, i) => q('[data-bin="' + (i + 1) + '"]'));
const cards = Array.from({ length: G.CARDS }, (_, s) => { const g = q('[data-card="' + s + '"]'); return { g, solid: g.querySelector(".iso-solid") }; });
const needle = q("[data-needle]");
const gate = (name) => ({ parts: [...svg.querySelectorAll('[data-gate="' + name + '"]')], text: q('[data-gate-text="' + name + '"]') });
const gates = { head: gate("head"), tail: gate("tail") };
const rackCover = q("[data-rack-cover]");

function counter(name, c) { const cells = counterCells(c); return { c, cells, els: cells.map((_, j) => q('[data-digit="' + name + '-' + j + '"]')), shown: [] }; }
const dials = Object.fromEntries(["requests", "series", "kept", "errors", "errorsKept"].map((n) => [n, counter(n, G.COUNTERS[n])]));
function show(dial, v) { digitsOf(v, dial.c.count).forEach((d, j) => { if (dial.shown[j] !== d) { dial.shown[j] = d; dial.els[j].setAttribute("d", digitPath(iso, P, dial.cells[j], d)); } }); }

function makePool(layer, kinds, n) {
  return Array.from({ length: n }, () => {
    const g = document.createElementNS(NS, "g"); g.style.display = "none";
    const parts = {};
    for (const kind of kinds) { const sub = document.createElementNS(NS, "g"); sub.innerHTML = TOK[kind]; sub.style.display = "none"; g.appendChild(sub); parts[kind] = { g: sub, solid: sub.firstElementChild }; }
    layer.appendChild(g); return { g, parts, kind: null };
  });
}
const mPool = makePool(q("[data-mtokens]"), ["metric"], 70);
const tPool = makePool(q("[data-ttokens]"), ["flat", "tall"], 90);

const cfg = { labels: "status", route: "template", sampling: "tail", errorRate: 0.02, speed: 1 };
let model, clock, next, active, slotFree, keptSeq, seriesShown, keptCount, errSeen, errKept, holeHit, cardReq, reqCount;
let seed = (Date.now() % 1e6) + 1;

// ---- each request's path through the machine, worked out once ----
function plan(r) {
  // the tally card
  const over = r.idx >= G.HOLES, hole = over ? null : G.holes[r.idx];
  const xc = over ? G.MBELT.x1 - 2 : hole.cx;
  const mBelt = (xc - G.OUT_X - 2) / VM;
  r.m = { xc, over, hole, belt: mBelt, arrive: r.t + mBelt + HOP };
  // the trace
  const segs = [];
  let x = G.OUT_X + 2, t = r.t;
  const y = G.TBELT.y, z = G.TBELT.z;
  const run = (x1) => { segs.push({ t0: t, t1: t + (x1 - x) / VT, a: [x, y, z], b: [x1, y, z] }); t += (x1 - x) / VT; x = x1; };
  const hop = (to, d, lift) => { const a = segs.length ? segs[segs.length - 1].b : [x, y, z]; segs.push({ t0: t, t1: t + d, a, b: to, lift }); t += d; };
  const sit = (d) => { const a = segs[segs.length - 1].b; segs.push({ t0: t, t1: t + d, a, b: a }); t += d; };
  r.dropped = false;
  if (cfg.sampling === "tail") {
    let s = 0; for (; s < G.SLOTS; s++) { const tin = r.t + (G.slots[s][0] - x) / VT; if (slotFree[s] <= tin) break; }
    if (s === G.SLOTS) s = r.n % G.SLOTS;
    const [sx, sy, sz] = G.slots[s];
    run(sx); hop([sx, sy, sz], SLOTHOP, 5); r.slotIn = t; sit(WAIT); r.slotOut = t; hop([sx, y, z], SLOTHOP, 5); x = sx;
    slotFree[s] = t;
    run(G.TAIL_GATE); r.tDecide = t;
    if (!r.kept) { hop([G.TAIL_GATE, G.DROP_Y, 2], DROP, 3); r.dropped = true; }
  } else {
    run(G.HEAD_GATE); r.tDecide = t;
    if (!r.headKeep) { hop([G.HEAD_GATE, G.DROP_Y, 2], DROP, 3); r.dropped = true; }
  }
  if (!r.dropped) {
    r.seq = keptSeq++;
    run(G.TBELT.x1); if (cfg.sampling === "all") r.tDecide = t;
    hop(G.cards[r.seq % G.CARDS], HOP, 8);
  }
  r.segs = segs; r.end = Math.max(t, r.m.arrive); r.tArrive = t;
}
function along(segs, s) {
  for (const g of segs) if (s < g.t1) {
    const u = g.t1 > g.t0 ? Math.max(0, (s - g.t0) / (g.t1 - g.t0)) : 1;
    return [g.a[0] + (g.b[0] - g.a[0]) * u, g.a[1] + (g.b[1] - g.a[1]) * u, g.a[2] + (g.b[2] - g.a[2]) * u + (g.lift || 0) * Math.sin(Math.PI * u)];
  }
  return null;
}

function restart() {
  model = makeLive({ ...cfg, rate: LIVE_RATE }, seed++);
  clock = WARM; next = 0; active = []; slotFree = new Array(G.SLOTS).fill(-1); keptSeq = 0;
  seriesShown = 0; keptCount = 0; errSeen = 0; errKept = 0; reqCount = 0; holeHit = new Array(G.HOLES).fill(-9); cardReq = new Array(G.CARDS).fill(null);
  holes.forEach((h) => { h.removeAttribute("data-on"); h.removeAttribute("data-hit"); });
  cards.forEach((c) => { c.g.style.display = "none"; });
  const tail = cfg.sampling === "tail", head = cfg.sampling === "head10" || cfg.sampling === "head1";
  gates.head.parts.forEach((el) => { el.style.display = head ? "" : "none"; });
  gates.tail.parts.forEach((el) => { el.style.display = tail ? "" : "none"; });
  gates.head.text.textContent = cfg.sampling === "head10" ? "10%" : "1%";
  rackCover.style.display = tail ? "none" : "";
  model.runTo(clock);
  paint();
}

function paint() {
  model.runTo(clock);
  while (next < model.reqs.length && model.reqs[next].t <= clock) { const r = model.reqs[next++]; plan(r); active.push(r); reqCount++; }
  // things that happen when a token arrives
  for (const r of active) {
    if (!r.mDone && clock >= r.m.arrive) {
      r.mDone = true;
      if (r.first) seriesShown++;
      if (!r.m.over) { holeHit[r.idx] = r.m.arrive; if (r.first) holes[r.idx].setAttribute("data-on", ""); }
    }
    if (!r.decided && clock >= r.tDecide) { r.decided = true; if (r.err) errSeen++; }
    if (!r.tDone && !r.dropped && clock >= r.tArrive) {
      r.tDone = true; keptCount++; if (r.err) errKept++;
      cardReq[r.seq % G.CARDS] = r;
    }
  }
  active = active.filter((r) => clock < r.end);

  // tokens
  let mu = 0, tu = 0, buffer = 0;
  for (const r of active) {
    const s = clock - r.t;
    if (!r.mDone && mu < mPool.length) {
      let p;
      if (s < r.m.belt) p = [G.OUT_X + 2 + VM * s, G.MBELT.y, G.MBELT.z];
      else {
        const u = Math.min(1, (s - r.m.belt) / HOP);
        const to = r.m.over ? [G.BIN.x + G.BIN.w / 2, G.BIN.y + G.BIN.d / 2, G.BIN.h] : [r.m.xc, G.WALL_FRONT + 1.6, r.m.hole.z0 + 1.6];
        const from = [r.m.xc, G.MBELT.y, G.MBELT.z];
        p = [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, from[2] + (to[2] - from[2]) * u + Math.sin(Math.PI * u) * 7];
      }
      const t = mPool[mu++]; t.g.style.display = ""; if (t.kind !== "metric") { t.parts.metric.g.style.display = ""; t.kind = "metric"; }
      t.g.setAttribute("transform", translateAlong(P, p));
    }
    const p = r.tDone ? null : along(r.segs, clock);
    if (p && tu < tPool.length) {
      if (r.slotIn !== undefined && clock >= r.slotIn && clock < r.slotOut) buffer++;
      const t = tPool[tu++], kind = r.slow ? "tall" : "flat";
      t.g.style.display = "";
      if (t.kind !== kind) { if (t.kind) t.parts[t.kind].g.style.display = "none"; t.parts[kind].g.style.display = ""; t.kind = kind; }
      t.parts[kind].solid.toggleAttribute("data-lit", r.err);
      t.g.setAttribute("transform", translateAlong(P, p));
    }
  }
  for (let i = mu; i < mPool.length; i++) mPool[i].g.style.display = "none";
  for (let i = tu; i < tPool.length; i++) tPool[i].g.style.display = "none";

  // wall, bin, dial, drawer
  for (let i = 0; i < G.HOLES; i++) holes[i].toggleAttribute("data-hit", clock - holeHit[i] < 0.35);
  const overflow = Math.max(0, seriesShown - G.HOLES);
  const level = overflow ? Math.min(G.BIN_LEVELS, Math.ceil(Math.log10(overflow + 1) * 2.2)) : 0;
  bins.forEach((b, i) => { b.style.display = i + 1 === level ? "" : "none"; });
  const bytes = seriesShown * BYTES_PER_SERIES;
  const turn = bytes > 0 ? (Math.log10(bytes) - G.DIAL_SPAN.decades[0]) / (G.DIAL_SPAN.decades[1] - G.DIAL_SPAN.decades[0]) : 0;
  setD(needle, needleOf(turn));
  cardReq.forEach((r, s) => { const c = cards[s]; c.g.style.display = r ? "" : "none"; if (r) c.solid.toggleAttribute("data-lit", r.err); });

  show(dials.requests, reqCount); show(dials.series, seriesShown); show(dials.kept, keptCount); show(dials.errors, errSeen); show(dials.errorsKept, errKept);
  stat("requests", reqCount); stat("series", seriesShown); stat("memory", fmtBytes(bytes)); stat("kept", keptCount);
  stat("errors", errKept + " of " + errSeen); stat("buffer", cfg.sampling === "tail" ? buffer : "–");
  say(seriesShown + " series · " + fmtBytes(bytes) + (overflow ? " · wall full" : "") + " · errors kept " + errKept + " of " + errSeen);
}
function needleOf(turn) {
  const D = G.DIAL, a = G.DIAL_SPAN.from + Math.max(0, Math.min(1, turn)) * G.DIAL_SPAN.span;
  return lineOnTop([D.x - Math.sin(a) * 2, D.y + Math.cos(a) * 2], [D.x + Math.sin(a) * (D.r - 2.6), D.y - Math.cos(a) * (D.r - 2.6)], D.top + 0.2, P);
}
function fmtBytes(b) {
  const u = [["GB", 2 ** 30], ["MB", 2 ** 20], ["KB", 2 ** 10]];
  for (const [n, v] of u) if (b >= v) { const x = b / v; return (x < 10 ? x.toFixed(1) : Math.round(x).toLocaleString("en-US")) + " " + n; }
  return b + " B";
}
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(key, value) { const el = statEls[key]; const text = String(value); if (el && el.textContent !== text) el.textContent = text; }

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; paint(); }, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });

function set(name, raw, quiet) {
  WB.pressSeg(name, raw);
  if (name === "speed") { cfg.speed = Number(raw); return; }
  if (name === "errors") cfg.errorRate = Number(raw); else cfg[name] = raw;
  if (!quiet) restart();
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="reset"]').addEventListener("click", () => restart());
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const N_HOUR = 100 * 3600;
const big = (x) => Math.round(x).toLocaleString("en-US");
const one = (x) => (Math.round(x * 10) / 10).toFixed(1);
const avg = (list, f) => list.reduce((s, x) => s + f(x), 0) / list.length;
const RUNS = {
  status: () => {
    const a = expectedSeries({ labels: "base", route: "template" }, N_HOUR), b = expectedSeries({ labels: "status", route: "template" }, N_HOUR);
    return { verdict: "16 series → " + big(b) + " (×" + one(b / a) + "), " + fmtBytes(seriesBytes(a)) + " → " + fmtBytes(seriesBytes(b)) + " of memory.",
      bars: [["{method, route}", a / b, big(a) + " series"], ["{method, route, status}", 1, big(b) + " series", true]] };
  },
  user: () => {
    const a = expectedSeries({ labels: "status", route: "template" }, N_HOUR), h = expectedSeries({ labels: "user", route: "template" }, N_HOUR), d = expectedSeries({ labels: "user", route: "template" }, N_HOUR * 24);
    return { verdict: "After an hour: " + big(h) + " series (×" + big(h / a) + "), about " + fmtBytes(seriesBytes(h)) + ". After a day: " + big(d) + ", " + fmtBytes(seriesBytes(d)) + ". All for one counter.",
      bars: [["Without user_id", a / d, big(a)], ["With user_id, 1 hour", h / d, big(h), true], ["With user_id, 1 day", 1, big(d), true]] };
  },
  raw: () => {
    const t1 = expectedSeries({ labels: "status", route: "template" }, N_HOUR * 24), r1 = expectedSeries({ labels: "status", route: "raw" }, N_HOUR), r24 = expectedSeries({ labels: "status", route: "raw" }, N_HOUR * 24);
    return { verdict: "Template: " + big(t1) + " series after a day. Raw paths: " + big(r1) + " after an hour and " + big(r24) + " after a day (" + fmtBytes(seriesBytes(r24)) + "), still climbing.",
      bars: [["Template, 1 day", t1 / r24, big(t1)], ["Raw path, 1 hour", r1 / r24, big(r1), true], ["Raw path, 1 day", 1, big(r24), true]] };
  },
  head: () => {
    const hours = sampleHours({ mode: "head", head: 0.01 }, 12);
    const none = hours.filter((h) => h.rareKept === 0).length;
    return { verdict: "Per hour, on average: " + big(avg(hours, (h) => h.errors)) + " errors, " + one(avg(hours, (h) => h.errorsKept)) + " kept; " + one(avg(hours, (h) => h.rare)) + " rare failures, " + one(avg(hours, (h) => h.rareKept)) + " kept. " + none + " of 12 hours kept no example of the rare bug.",
      bars: [["Errors kept", avg(hours, (h) => h.errorsKept / h.errors), one(avg(hours, (h) => h.errorsKept)) + " of " + big(avg(hours, (h) => h.errors))], ["Rare bug kept", avg(hours, (h) => h.rareKept / Math.max(1, h.rare)), one(avg(hours, (h) => h.rareKept)) + " of " + one(avg(hours, (h) => h.rare)), true], ["Hours with no example", none / 12, none + " of 12", true]] };
  },
  tail: () => {
    const head = sampleHours({ mode: "head", head: 0.01 }, 6), tail = sampleHours({ mode: "tail" }, 6);
    const hk = avg(head, (h) => h.kept), tk = avg(tail, (h) => h.kept);
    return { verdict: "Traces stored per hour: " + big(hk) + " with head 1%, " + big(tk) + " with tail (×" + one(tk / hk) + "). Errors kept: " + one(avg(head, (h) => h.errorsKept)) + " vs " + big(avg(tail, (h) => h.errorsKept)) + " of " + big(avg(tail, (h) => h.errors)) + ". The tail sampler holds about 1,000 traces at any moment (10 s each at 100/s) while it waits.",
      bars: [["Stored, head 1%", hk / tk, big(hk)], ["Stored, tail", 1, big(tk), true], ["Errors kept, head", avg(head, (h) => h.errorsKept / h.errors), one(avg(head, (h) => h.errorsKept))], ["Errors kept, tail", 1, big(avg(tail, (h) => h.errorsKept)), true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  set("labels", w.labels, true); set("route", w.route, true); if (w.sampling) set("sampling", w.sampling, true);
  restart();
  if (loop.paused) loop.setPaused(false);
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./sampling-cardinality-workbench.html", import.meta.url), {
  title: "Cardinality Workbench",
  eyebrow: "Systems lesson 30 · Sampling and cardinality",
  lede: "Every label on a metric multiplies how many time series it creates, and every trace you keep costs storage, so what you record has to be chosen. This lesson builds a metric and a trace sampler as one machine: watch it run, predict what an experiment will do, then explain it back.",
  machine: { intro: "One service, two records of every request. At the back, a tally card finds the pigeonhole for its exact combination of labels: one hole per time series. At the front, the request's trace goes through a sampler that keeps or drops it. Add a label, switch the route to raw paths, or change the sampler, and watch the wall, the dial and the archive.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Series counts are the expected number of distinct label combinations at 100 requests a second; sampling results average seeded runs of the same model.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: `Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Memory per series is a round figure (about 3 KB) for an in-memory time-series store. Simulation written for this lesson.`,
  css,
  script: live,
});
console.log("wrote sampling-cardinality-workbench.html", (size / 1024).toFixed(0) + " KB");

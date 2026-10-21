// Systems lesson 03 · Load balancing. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, actions, inlineModule, speedSeg } from "../../workbench/page.mjs";
import { buildFigure, P, GEOMETRY, parcelSvg } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "add",
    title: "One more counter",
    change: "Counters 3 → 4 at 0.9 parcels/s · a third more capacity, same traffic",
    question: "What happens to the slowest 5% of waits (p95)?",
    options: ["It drops by about a quarter, in line with the extra capacity", "It drops by more than half", "It barely moves: the traffic is the same"],
    answer: 1,
    why: "At 90% busy, any small burst lands on a long queue and waits behind it; at 68% busy, queues rarely form at all. Waiting grows roughly like busy ÷ (1 − busy), so the last few points of utilisation cost far more than the first. That is why teams keep headroom instead of running servers near 100%.",
    watch: { servers: 3, algorithm: "rr", rate: 0.9, sizes: "even", slow: false, sticky: false, heavy: false, check: 10 },
  },
  {
    id: "slow",
    title: "One slow counter",
    change: "Counter 1 works at a third of the speed · 4 counters, round robin",
    question: "With round robin, what happens to p95?",
    options: ["It rises a little: we lost two-thirds of one counter", "It explodes: the slow counter's queue grows for as long as traffic flows", "It stays the same: the other counters pick up the slack"],
    answer: 1,
    why: "Round robin hands every counter the same share, a quarter of the parcels, whatever it can handle. The slow counter can only finish about half of its share, so its queue grows without limit, and every parcel sent to it waits longer than the last. Least connections looks at how many parcels each counter still has and routes around the slow one.",
    watch: { servers: 4, algorithm: "rr", rate: 0.9, sizes: "even", slow: true, sticky: false, heavy: false, check: 10 },
  },
  {
    id: "uneven",
    title: "Uneven parcels",
    change: "1 parcel in 10 takes 11× longer than the rest · same total work",
    question: "Switching from round robin to least connections changes p95 by…",
    options: ["Nothing: the total work is identical", "A lot: short parcels stop queuing behind long ones", "It gets worse: counting every counter's queue slows the balancer down"],
    answer: 1,
    why: "Round robin doesn't know a counter is stuck on a big parcel, so it keeps sending short parcels into that lane, where they wait for 16 seconds. Least connections sends them to a counter that is free. Random is worse than both: it can pile several parcels on one counter by chance.",
    watch: { servers: 4, algorithm: "rr", rate: 0.9, sizes: "uneven", slow: false, sticky: false, heavy: false, check: 10 },
  },
  {
    id: "crash",
    title: "A counter crashes",
    change: "Counter 2 dies · the balancer only finds out at its next health check",
    question: "With a health check every 30 s, how many parcels fail?",
    options: ["None: the balancer notices at once", "The parcels already inside it, plus everything sent to it until the next check", "Every parcel until someone restarts the counter"],
    answer: 1,
    why: "Between the crash and the next check, the balancer still believes the counter is up and keeps sending it a quarter of the traffic. Faster checks shrink that window, but they cannot save the parcels that were already inside the counter when it died: that floor stays the same at any interval.",
    watch: { servers: 4, algorithm: "rr", rate: 0.9, sizes: "even", slow: false, sticky: false, heavy: false, check: 30, crash: true },
  },
  {
    id: "sticky",
    title: "Sticky customers",
    change: "Two customers send 40% of the parcels · sticky sessions pin each customer to one counter",
    question: "Twenty customers in total. What happens to the counters?",
    options: ["Load still evens out: twenty customers is plenty", "One counter runs flat out while others idle, and p95 soars", "Nothing changes: round robin is still on"],
    answer: 1,
    why: "Sticky sessions decide by customer, not by load. Here both big customers hash to the same counter, so it gets half the traffic and more work than it can do, while the others sit at under half busy. The balancer's algorithm never gets a say for those parcels.",
    watch: { servers: 4, algorithm: "rr", rate: 0.9, sizes: "even", slow: false, sticky: true, heavy: true, check: 10 },
  },
];

const QUESTIONS = [
  ["At 90% busy, adding a third more capacity cut p95 by more than half. Why isn't the gain proportional?",
    "Waiting time grows roughly like utilisation ÷ (1 − utilisation): at 0.9 that is 9, at 0.68 about 2. Near full, every burst queues behind the last one. Leave headroom (many teams aim for 60–70% at peak) and scale before you reach the steep part of the curve."],
  ["Round robin is fine when servers are identical. When does it hurt, and why does least connections help?",
    "It hurts when servers differ in speed (an old instance, a noisy neighbour, a server doing GC) or requests differ in cost. Round robin ignores both and keeps feeding a backed-up server. Least connections uses outstanding requests as a cheap signal of how busy each server really is."],
  ["Least connections has a trap: a broken server that returns errors instantly has almost no outstanding requests. What happens?",
    "It looks like the least busy server, so the balancer sends it more and more traffic, and most requests fail (a \"black hole\"). Health checks, outlier detection that ejects servers with high error rates, and counting errors as failures all guard against it."],
  ["Someone proposes health checks every 100 ms on a 200-server fleet. What are the trade-offs?",
    "Faster detection, but checks become real load on every server, and one slow response can mark a healthy server down (flapping). Real setups combine an interval with thresholds (down after 3 failures, up after 2 passes) and passive checks that watch real traffic."],
  ["Why use sticky sessions at all, and how would you avoid the hot counter from experiment 5?",
    "They keep a user on the server that holds their session or warm cache. To avoid hot spots, move session state to a shared store (Redis, a database, a signed cookie) so any server can answer, or use consistent hashing with bounded load so a full server spills to the next one."],
  ["Parcels inside a crashed counter fail no matter how fast the checks are. How do real systems protect those requests?",
    "Retry idempotent requests on another server (at the balancer or the client, with a budget so retries can't multiply load), drain servers before planned restarts so they finish in-flight work, and set timeouts so a request doesn't hang on a dead connection."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Sorting station",
  keys: [
    { mark: "lit", label: "Turntable arm: the load balancer's choice" },
    { mark: "raised", label: "Counters: servers, one parcel at a time" },
    { mark: "flat", label: "Lanes: each counter's queue" },
  ],
  caption:
    "Parcels arrive at random, about one a second, and the turntable sends each one down a lane. A counter takes 3 s on an average parcel. The gate at the start of a lane shows whether the balancer still sends parcels there; it only changes at a health check. A closed shutter means the counter is down.",
  stage: 'data-office aria-label="Sorting station simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const controls = panel({
  stats: [["served", "Served"], ["failed", "Failed"], ["p50", "Median wait", "–"], ["p95", "p95 wait", "–"], ["busiest", "Busiest counter", "–"], ["quietest", "Quietest counter", "–"]],
  controls: [
    seg("servers", "Counters", [[2, "2"], [3, "3"], [4, "4"], [5, "5"]], 4),
    seg("algorithm", "Balancer", [["rr", "Round robin"], ["lc", "Least conn."], ["random", "Random"]], "rr"),
    seg("rate", "Traffic", [[0.6, "0.6/s"], [0.9, "0.9/s"], [1.2, "1.2/s"]], 0.9),
    seg("sizes", "Parcel sizes", [["even", "Similar"], ["uneven", "1 in 10 huge"]], "even"),
    seg("slow", "Counter 1", [["false", "Normal"], ["true", "3× slower"]], "false"),
    seg("check", "Health check", [[2, "2 s"], [10, "10 s"], [30, "30 s"]], 10),
    seg("heavy", "Customers", [["false", "Many small"], ["true", "Two big"]], "false"),
    seg("sticky", "Sticky sessions", [["false", "Off"], ["true", "On"]], "false"),
    speedSeg(),
    actions("Do something", [["crash", "Crash counter 2"], ["restart", "Restart counters"], ["reset", "Reset counts"], ["pause", "Pause"]]),
  ],
});

// Figure-specific styles.
const css = `
.slot [data-lift]{transition:opacity .35s var(--anatomy-ease)}
.slot[data-empty] [data-lift]{opacity:0}
.ttl-fill{fill:var(--anatomy-mid);stroke:none}
.cover{display:none}
.cover[data-on]{display:inline}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const PARCEL_SVG = ${JSON.stringify(parcelSvg())};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const IN_TIME = 1.2;

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const infeedLayer = q("[data-infeed]"), armEl = q("[data-arm]");
const lanes = G.LANES.map((ly, i) => ({
  ly,
  parcels: q('[data-parcels="' + i + '"]'), head: q('[data-head="' + i + '"]'),
  gateOpen: q('[data-gate-open="' + i + '"]'), gateClosed: q('[data-gate-closed="' + i + '"]'),
  shutter: q('[data-shutter="' + i + '"]'), cover: q('[data-cover="' + i + '"]'),
  lampOn: q('[data-lamp-on="' + i + '"]'), lampOff: q('[data-lamp-off="' + i + '"]'),
}));

const opts = { servers: 4, algorithm: "rr", rate: 0.9, slow: -1, check: 10, sticky: false, sizes: "even", heavy: false };
let station = createStation(opts, (Date.now() % 1e6) + 1);
let speed = 1;
let armAngle = Math.atan2(0, 1), armTarget = armAngle, armDrawn = null;
let incoming = null;
const visuals = new Map();
let base = { done: 0, errors: 0 };
const history = [];

const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const show = (el, on) => { el.style.display = on ? "" : "none"; };
function armOf(angle) {
  const c = Math.cos(angle), s = Math.sin(angle), x = G.TABLE[0], y = G.TABLE[1];
  const pt = (u, v) => [x + u * c - v * s, y + u * s + v * c];
  return solidSvg(extrude([pt(-6, -1.6), pt(21, -1.6), pt(21, 1.6), pt(-6, 1.6)], G.TABLE_Z, 4, P, { bevel: 0.3 }), { tone: "hi", lit: true });
}
const slotX = (index) => G.SERVE_X - G.SLOT * Math.min(index, 8);

function makeParcel(layer) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
  el.innerHTML = PARCEL_SVG;
  layer.appendChild(el);
  return el;
}
function place(el, p, opacity = 1) {
  el.setAttribute("transform", translateAlong(P, p));
  if (el.style.opacity !== String(opacity)) el.style.opacity = String(opacity);
}
function laneIndexOf(job) {
  const s = station.st.servers[job.server];
  const first = s.current ? 1 : 0;
  if (job.state === "service") return 0;
  if (job.state === "queued") return first + s.queue.indexOf(job);
  const ahead = station.st.jobs.filter((j) => j.server === job.server && j.state === "transit" && j.reach < job.reach).length;
  return first + s.queue.length + ahead;
}

function handle(event) {
  const job = event.job;
  if (event.type === "dispatch") {
    const lane = lanes[job.server];
    const el = incoming ? incoming.el : makeParcel(lane.parcels);
    incoming = null;
    lane.parcels.appendChild(el);
    visuals.set(job.id, { el, job, x: G.TABLE[0], phase: "live" });
    armTarget = Math.atan2(lane.ly - G.TABLE[1], G.LANE.from - G.TABLE[0]);
    say("parcel " + job.id + " → counter " + (job.server + 1));
  } else if (event.type === "finish") {
    const v = visuals.get(job.id); if (v) { v.phase = "done"; v.t = 0; }
  } else if (event.type === "error") {
    let v = visuals.get(job.id);
    if (!v && incoming) { v = { el: incoming.el, job, x: G.TABLE[0], phase: "live" }; incoming = null; visuals.set(job.id, v); }
    if (v) { v.phase = "error"; v.t = 0; v.from = v.last || [G.TABLE[0], 0, G.TABLE_Z]; }
    say("parcel " + job.id + " failed" + (job.server >= 0 ? " · counter " + (job.server + 1) + " is down" : " · no counter available"));
  } else if (event.type === "check") {
    const out = station.st.servers.filter((s) => s.index < opts.servers && !s.healthy).map((s) => s.index + 1);
    if (out.length) say("health check · counter " + out.join(", ") + " taken out");
  }
}

function advance(dt) {
  station.step(station.st.now + dt);
  for (const e of station.st.events.splice(0)) handle(e);
  const now = station.st.now;
  // the next parcel rides the infeed toward the turntable
  if (!incoming && station.st.nextArrival - now <= IN_TIME) incoming = { el: makeParcel(infeedLayer) };
  if (incoming) {
    if (incoming.el.parentNode !== infeedLayer) infeedLayer.appendChild(incoming.el);
    const u = clamp01(1 - (station.st.nextArrival - now) / IN_TIME);
    place(incoming.el, [lerp(G.INFEED.from + 6, G.TABLE[0], u), 0, G.TABLE_Z]);
  }
  const follow = 1 - Math.exp(-dt / 0.12);
  for (const [id, v] of visuals) {
    const job = v.job, ly = job.server >= 0 ? lanes[job.server].ly : 0;
    if (v.phase === "done") {
      v.t += dt / 0.45;
      place(v.el, [G.SERVE_X + 12 * v.t, ly, G.LANE.z], clamp01(1 - v.t));
      if (v.t >= 1) { v.el.remove(); visuals.delete(id); }
      continue;
    }
    if (v.phase === "error") {
      v.t += dt / 0.6;
      place(v.el, [v.from[0], v.from[1], v.from[2] - 5 * v.t], clamp01(1 - v.t));
      if (v.t >= 1) { v.el.remove(); visuals.delete(id); }
      continue;
    }
    const index = laneIndexOf(job);
    v.el.style.display = index > 9 ? "none" : "";
    let p;
    if (job.state === "transit") {
      const u = clamp01((now - job.arrive) / TRANSFER);
      const p0 = [G.TABLE[0], G.TABLE[1], G.TABLE_Z], p1 = [G.LANE.from + 2, ly, G.LANE.z], tx = slotX(index);
      if (u < 0.5) { const w = ease(u / 0.5); p = [lerp(p0[0], p1[0], w), lerp(p0[1], p1[1], w), lerp(p0[2], p1[2], w)]; }
      else p = [lerp(p1[0], tx, ease((u - 0.5) / 0.5)), ly, G.LANE.z];
      v.x = p[0];
    } else {
      v.x += (slotX(index) - v.x) * follow;
      p = [v.x, ly, G.LANE.z];
    }
    v.last = p;
    place(v.el, p);
  }
  // the arm turns toward the lane it last chose
  armAngle += (armTarget - armAngle) * (1 - Math.exp(-dt / 0.1));
  if (armDrawn === null || Math.abs(armAngle - armDrawn) > 0.004) { armEl.innerHTML = armOf(armAngle); armDrawn = armAngle; }
  // counters
  station.st.servers.forEach((s, i) => {
    const lane = lanes[i], present = i < opts.servers;
    show(lane.gateOpen, present && s.healthy); show(lane.gateClosed, !(present && s.healthy));
    show(lane.shutter, !present || !s.alive); show(lane.cover, !present);
    show(lane.lampOn, present && s.alive); show(lane.lampOff, !(present && s.alive));
    let dz = 0;
    if (s.current && s.alive) {
      const period = 1.1 * (opts.slow === i ? SLOW : 1);
      const phase = (now - s.current.start) / period;
      dz = -G.HEAD.travel * Math.pow(Math.max(0, Math.sin(2 * Math.PI * phase)), 2);
    }
    lane.head.setAttribute("transform", dz ? translateAlong(P, [0, 0, dz]) : "");
  });
  if (!history.length || now - history[history.length - 1].t >= 1) {
    history.push({ t: now, busy: station.st.servers.map((s) => s.busy) });
    while (history.length > 62) history.shift();
    showStats();
  }
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function showStats() {
  const done = station.st.done.slice(base.done).slice(-300);
  const times = done.map((j) => j.end - j.arrive);
  statEls.served.textContent = station.st.done.length - base.done;
  statEls.failed.textContent = station.st.errors - base.errors;
  statEls.p50.textContent = times.length ? percentile(times, 0.5).toFixed(1) + " s" : "–";
  statEls.p95.textContent = times.length ? percentile(times, 0.95).toFixed(1) + " s" : "–";
  if (history.length > 5) {
    const a = history[0], b = history[history.length - 1], span = b.t - a.t;
    const util = station.st.servers.slice(0, opts.servers).map((s, i) => ({ i, u: (b.busy[i] - a.busy[i]) / span }));
    const hi = util.reduce((x, y) => (y.u > x.u ? y : x)), lo = util.reduce((x, y) => (y.u < x.u ? y : x));
    statEls.busiest.textContent = Math.round(100 * Math.min(1, hi.u)) + "% · #" + (hi.i + 1);
    statEls.quietest.textContent = Math.round(100 * lo.u) + "% · #" + (lo.i + 1);
  } else { statEls.busiest.textContent = "–"; statEls.quietest.textContent = "–"; }
}


// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const clock = WB.loop({ stage, step: (dt) => { advance(dt * speed); }, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });
clock.setPaused(clock.paused);
const pressSeg = WB.pressSeg;
function resetCounts() { base = { done: station.st.done.length, errors: station.st.errors }; history.length = 0; showStats(); }
function set(name, raw) {
  const value = String(raw);
  if (name === "servers") { opts.servers = Number(value); station.set({ servers: opts.servers }); history.length = 0; }
  if (name === "algorithm") { opts.algorithm = value; station.set({ algorithm: value }); }
  if (name === "rate") { opts.rate = Number(value); station.set({ rate: opts.rate }); }
  if (name === "sizes") { opts.sizes = value; station.set({ sizes: value }); }
  if (name === "slow") { opts.slow = value === "true" ? 0 : -1; station.set({ slow: opts.slow }); }
  if (name === "check") { opts.check = Number(value); station.set({ check: opts.check }); }
  if (name === "heavy") { opts.heavy = value === "true"; station.set({ heavy: opts.heavy }); }
  if (name === "sticky") { opts.sticky = value === "true"; station.set({ sticky: opts.sticky }); }
  if (name === "speed") speed = Number(value);
  pressSeg(name, value);
}
function crash() { station.kill(1); say("counter 2 crashed · the balancer doesn't know yet"); for (const e of station.st.events.splice(0)) handle(e); if (clock.paused) clock.setPaused(false); }
function restart() { for (let i = 0; i < 5; i++) station.restart(i); say("counters restarted · back in at the next health check"); }
WB.onSegments(set);
document.querySelector('[data-act="crash"]').addEventListener("click", crash);
document.querySelector('[data-act="restart"]').addEventListener("click", restart);
document.querySelector('[data-act="reset"]').addEventListener("click", resetCounts);
pauseBtn.addEventListener("click", () => clock.setPaused(!clock.paused));
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); clock.setPaused(!clock.paused); } });

// ---------- experiments ----------
const pct = (x) => Math.round(100 * x) + "%";
const secs = (x) => (x >= 100 ? Math.round(x) : x.toFixed(1)) + " s";
const RUN = { seconds: 600 };
const avg = (o) => average(o, RUN);
function crashErrors(check) {
  let sum = 0, n = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const t = 20 + ((seed * 7.31) % 30);
    sum += runHeadless({ servers: 4, rate: 0.9, check }, { seconds: 120, seed, events: [{ t, do: "kill", index: 1 }] }).errors; n++;
  }
  return sum / n;
}
const scale = (values) => Math.max(...values) * 1.08;
const RUNS = {
  add: () => {
    const a = avg({ servers: 3, rate: 0.9 }), b = avg({ servers: 4, rate: 0.9 }), top = scale([a.p95, b.p95]);
    return { verdict: "p95 went from " + secs(a.p95) + " to " + secs(b.p95) + ", " + Math.round(100 * (1 - b.p95 / a.p95)) + "% lower, from " + Math.round(100 / 3) + "% more capacity. The median fell from " + secs(a.p50) + " to " + secs(b.p50) + ".",
      bars: [["3 counters", a.p95 / top, secs(a.p95)], ["4 counters", b.p95 / top, secs(b.p95), true]] };
  },
  slow: () => {
    const a = avg({ servers: 4, rate: 0.9 }), b = avg({ servers: 4, rate: 0.9, slow: 0 }), c = avg({ servers: 4, rate: 0.9, slow: 0, algorithm: "lc" }), top = scale([a.p95, b.p95, c.p95]);
    return { verdict: "Round robin: p95 " + secs(a.p95) + " → " + secs(b.p95) + " after ten minutes, and still climbing. Least connections with the same slow counter: " + secs(c.p95) + ".",
      bars: [["All normal", a.p95 / top, secs(a.p95)], ["Slow, round robin", b.p95 / top, secs(b.p95), true], ["Slow, least conn.", c.p95 / top, secs(c.p95)]] };
  },
  uneven: () => {
    const o = { servers: 4, rate: 0.9, sizes: "uneven" };
    const r = avg({ ...o, algorithm: "random" }), a = avg(o), b = avg({ ...o, algorithm: "lc" }), top = scale([r.p95, a.p95, b.p95]);
    return { verdict: "p95 with round robin " + secs(a.p95) + ", with least connections " + secs(b.p95) + " (" + Math.round(100 * (1 - b.p95 / a.p95)) + "% lower). The median fell from " + secs(a.p50) + " to " + secs(b.p50) + ".",
      bars: [["Random", r.p95 / top, secs(r.p95)], ["Round robin", a.p95 / top, secs(a.p95)], ["Least conn.", b.p95 / top, secs(b.p95), true]] };
  },
  crash: () => {
    const e30 = crashErrors(30), e10 = crashErrors(10), e2 = crashErrors(2), top = scale([e30, e10, e2]);
    const f = (x) => x.toFixed(1);
    return { verdict: "Failed parcels per crash: " + f(e30) + " with 30 s checks, " + f(e10) + " with 10 s, " + f(e2) + " with 2 s. The last ones were already inside the counter when it died.",
      bars: [["Check every 30 s", e30 / top, f(e30), true], ["Check every 10 s", e10 / top, f(e10)], ["Check every 2 s", e2 / top, f(e2)]] };
  },
  sticky: () => {
    const o = { servers: 4, rate: 0.9, heavy: true };
    const a = avg(o), b = avg({ ...o, sticky: true });
    return { verdict: "Busiest counter " + pct(a.busiest) + " → " + pct(Math.min(1, b.busiest)) + ", quietest " + pct(a.quietest) + " → " + pct(b.quietest) + ". p95 went from " + secs(a.p95) + " to " + secs(b.p95) + ".",
      bars: [["Busiest, not sticky", a.busiest, pct(a.busiest)], ["Busiest, sticky", Math.min(1, b.busiest), pct(Math.min(1, b.busiest)), true], ["Quietest, sticky", b.quietest, pct(b.quietest)]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  restart();
  set("servers", w.servers); set("algorithm", w.algorithm); set("rate", w.rate); set("sizes", w.sizes);
  set("slow", String(w.slow)); set("sticky", String(w.sticky)); set("heavy", String(w.heavy)); set("check", w.check);
  resetCounts();
  if (clock.paused) clock.setPaused(false);
  if (w.crash) setTimeout(crash, 3000);
} });

advance(0); showStats();
`;

const size = writePage(new URL("./load-balancer-workbench.html", import.meta.url), {
  title: "Load Balancer Workbench",
  eyebrow: "Systems lesson 03 · Load balancing",
  lede: "A load balancer decides which server gets each request. That one decision, made thousands of times a second, sets how long users wait. This lesson builds the idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
  machine: { intro: "The turntable is the load balancer. Each lane is one server's queue, and each counter at the end works through it one parcel at a time. Change the balancer, slow a counter down or crash one, and watch the queues and the waits.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the figure, averaged over six runs of ten minutes each.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote load-balancer-workbench.html", (size / 1024).toFixed(0) + " KB");

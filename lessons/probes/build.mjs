// Systems lesson 23 · Health checks. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, tokenSvg, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "readiness",
    title: "No readiness probe",
    change: "A deploy restarts shops 4 and 5 under steady traffic · readiness probe on → off",
    question: "Each restarted shop takes 12 s to open its doors and 10 s to stock its shelves. Without a readiness probe, what do customers see?",
    options: ["Nothing: the shop is only restarting, it isn't broken", "Errors until each new shop is fully stocked", "Errors only for the first second"],
    answer: 1,
    why: "Without a readiness probe, Kubernetes adds a pod to the service as soon as its container starts. The warden sends customers to a shop whose doors aren't open yet (connection refused) and then to empty shelves (cold caches, no connections). A readiness probe that only says yes once the shop can really serve keeps it off the list until then.",
    watch: { readiness: "off", liveness: "shop", timeout: 5, threshold: 3, boot: 12, startupProbe: "false", load: 0.5, act: "restart" },
  },
  {
    id: "deps",
    title: "Liveness checks the warehouse",
    change: "The warehouse (database) is down for 30 s · liveness checks the warehouse vs readiness checks it",
    question: "With the liveness probe checking the warehouse, when is the street fully open again?",
    options: ["As soon as the warehouse is back", "Long after: every shop restarts, then has to boot and restock", "Never, until someone intervenes"],
    answer: 1,
    why: "Restarting a shop can't fix a warehouse. When liveness depends on it, every inspector sees the same failure at the same time and rebuilds every shop at once. The warehouse comes back to a street of scaffolding, and shops that restart again get a growing back-off. Checking the warehouse in readiness only takes shops off the warden's list for the duration and puts them back as soon as it returns.",
    watch: { readiness: "shop", liveness: "deps", timeout: 5, threshold: 3, boot: 12, startupProbe: "false", load: 0.5, act: "blip" },
  },
  {
    id: "timeout",
    title: "A tight timeout on a busy street",
    change: "Traffic at 90% of capacity · liveness timeout 5 s → 1 s",
    question: "The shops are slow but healthy: probes wait in the same queue as customers. What does a 1 s liveness timeout do?",
    options: ["Nothing: a healthy shop always answers its inspector", "It restarts healthy shops, and the others get busier", "It makes the street faster by restarting slow shops"],
    answer: 1,
    why: "A busy shop answers its inspector late, not never. With a 1 s timeout, three late answers in a row look like a dead shop, so it gets rebuilt. Its queue is lost, and its customers move to the other shops, which become even busier and miss their own checks. Give liveness a generous timeout and threshold: it should catch a process that is truly stuck, not one that is busy.",
    watch: { readiness: "shop", liveness: "shop", timeout: 1, threshold: 3, boot: 12, startupProbe: "false", load: 0.9 },
  },
  {
    id: "startup",
    title: "A slow start",
    change: "A shop takes 60 s to open its doors · liveness starts checking 10 s after start · no startup probe vs a startup probe",
    question: "Without a startup probe, when is the restarted shop ready?",
    options: ["After about 70 s, like any slow shop", "Never: liveness kills it before it finishes starting", "After 70 s, but with a few errors first"],
    answer: 1,
    why: "Liveness starts checking 10 s after the container starts and gives up after three failures, about 20 s in. A shop that needs 60 s is killed every time, and the back-off between attempts keeps growing: a crash loop. A startup probe holds liveness and readiness back until the shop answers once (here allowing up to 120 s), then normal checks take over.",
    watch: { readiness: "shop", liveness: "shop", timeout: 5, threshold: 3, boot: 60, startupProbe: "false", load: 0.5, act: "restart1" },
  },
  {
    id: "deadlock",
    title: "A jammed shop",
    change: "Shop 3 jams: its doors are open but nobody answers · readiness only vs readiness and liveness",
    question: "With only a readiness probe, what happens to shop 3?",
    options: ["Readiness takes it off the list, and it comes back by itself", "Readiness stops the errors, but only liveness brings the shop back", "Neither notices: it still looks open"],
    answer: 1,
    why: "Readiness only decides whether customers are sent there. The jammed shop drops off the warden's list, so errors stop, but nothing ever fixes it: you run on four shops until someone notices. Liveness exists for exactly this: a process that is stuck in a way only a restart can fix.",
    watch: { readiness: "shop", liveness: "off", timeout: 5, threshold: 3, boot: 12, startupProbe: "false", load: 0.5, act: "jam" },
  },
];

const QUESTIONS = [
  ["In one sentence each: what does a readiness probe decide, and what does a liveness probe decide?",
    "Readiness decides whether the pod gets traffic: failing removes it from the service's endpoints, and nothing is restarted. Liveness decides whether the container should be killed and restarted: failing it enough times restarts the container. Readiness is \"not right now\"; liveness is \"this is broken and a restart will fix it\"."],
  ["Your liveness probe calls the database. Why is that dangerous?",
    "A database outage makes every pod's liveness fail at once, so Kubernetes restarts all of them. The database comes back to pods that are still booting and warming up, repeated failures add back-off, and a short blip becomes a long outage. Liveness should only check things a restart of this container can fix; put dependency checks in readiness (or nowhere)."],
  ["What should a readiness probe check, and is it ever wrong to include a dependency?",
    "That this pod can serve right now: it has started, finished warming up and isn't overloaded. Including a dependency every pod shares means one outage makes every pod unready, so the service returns 503s with no pods behind it. That's sometimes what you want (fail fast and clearly); a service that can serve degraded responses should stay ready and handle the error instead."],
  ["An app takes 90 s to start. How would you configure its probes?",
    "Add a startup probe with periodSeconds × failureThreshold comfortably above 90 s, say 10 s × 15 = 150 s. Liveness and readiness don't run until it passes, so liveness can keep a short, sensible period for catching hangs later. Avoid the old workaround of a huge initialDelaySeconds on liveness, which also delays detecting a real hang after a restart."],
  ["Under heavy load your pods keep restarting, and the liveness timeout is 1 s. What is going on, and what would you change?",
    "Probes queue behind real requests, so busy pods answer late and get killed as if they were dead. Each restart loses work and moves load onto the remaining pods, which then miss their checks too: a restart storm. Raise the timeout and failure threshold, answer health checks outside the request queue (a separate lightweight handler or port), and fix the real capacity problem."],
  ["If readiness already removes broken pods from traffic, why have a liveness probe at all?",
    "Because readiness never repairs anything. A deadlocked or wedged process fails readiness forever and you quietly run with less capacity. Liveness restarts it. The two answer different questions, so many apps need both, but each must check the right thing."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Shopping street",
  keys: [
    { mark: "lit", label: "Open sign raised and the warden's peg up: the shop is ready and gets customers (a lowered grey sign is closed)" },
    { mark: "raised", label: "Inspector's board: top slots are failed checks in a row, bottom pips are restarts" },
    { mark: "flat", label: "Supply pipes: every shop draws from the one warehouse" },
  ],
  caption:
    "Each shop is a pod. When its readiness probe passes, its open sign goes up and lights, and the warden raises that shop's peg on the kiosk roof (the service's endpoint list); customers only walk to shops with a peg up, and turned-away customers walk back faint. Each shop's inspector checks it every 3 s, fills a slot for each failure in a row, and when the slots are full has the shop torn down and rebuilt: scaffolding, then the store shutter while it starts, then crates while it restocks, with a pip added for every restart. A bar across a door means the shop is jammed. The warehouse behind is the shared database; its roller door comes down when it is out of action. The first frame shows shop 2 being rebuilt, shop 3 jammed and shop 4 restocking.",
  stage: 'data-office aria-label="Health probe simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const controls = panel({
  stats: [["served", "Served"], ["errors", "Errors"], ["restarts", "Restarts"], ["ready", "Shops open", "5 / 5"], ["rate", "Errors, last 10 s", "0%"], ["recover", "Back to normal in", "–"]],
  controls: [
    seg("readiness", "Readiness probe checks", [["off", "No probe"], ["shop", "The shop"], ["deps", "Shop + warehouse"]], "shop"),
    seg("liveness", "Liveness probe checks", [["off", "No probe"], ["shop", "The shop"], ["deps", "Shop + warehouse"]], "shop"),
    seg("timeout", "Liveness timeout", [[1, "1 s"], [5, "5 s"]], 5),
    seg("threshold", "Restart after", [[1, "1 failure"], [3, "3 in a row"]], 3),
    seg("boot", "Shop start-up", [[12, "12 s"], [60, "60 s"]], 12),
    seg("startupProbe", "Startup probe", [["false", "Off"], ["true", "On"]], "false"),
    seg("load", "Traffic", [[0.5, "50%"], [0.9, "90%"]], 0.5),
    speedSeg(),
    actions("Do something", [["blip", "Warehouse down 30 s"], ["jam", "Jam shop 3"], ["restart", "Redeploy shops 4, 5"], ["reset", "Start over"], ["pause", "Pause"]]),
  ],
});

const css = `
.tally-fill{fill:var(--anatomy-hi);stroke:none}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const TOKEN_SVG = ${JSON.stringify(tokenSvg())};
const NS = "http://www.w3.org/2000/svg";
const WALK = 95, SPAWN_EVERY = 0.28;

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const shops = G.SHOP_X.map((cx, i) => {
  const g = q('[data-shop="' + i + '"]');
  return {
    cx, building: g.querySelector("[data-building]"), scaffold: g.querySelector("[data-scaffold]"), shut: g.querySelector("[data-shop-shut]"), jam: g.querySelector("[data-jam]"),
    crates: [0, 1, 2, 3].map((n) => g.querySelector('[data-crate="' + i + "-" + n + '"]')),
    sign: g.querySelector("[data-sign-plate]"), signSolid: g.querySelector("[data-sign-plate] .iso-solid"),
    tallies: [0, 1, 2].map((n) => g.querySelector('[data-tally="' + i + "-" + n + '"]')), slots: [0, 1, 2].map((n) => g.querySelector('[data-slot="' + i + "-" + n + '"]')),
    pips: Array.from({ length: G.PIPS }, (_, n) => g.querySelector('[data-pip="' + i + "-" + n + '"]')),
    peg: q('[data-peg="' + i + '"]'), signAt: G.TABLEAU[i].ready ? 0 : -G.SIGN_DROP, pegUp: G.TABLEAU[i].ready, lit: G.TABLEAU[i].ready, shown: {},
  };
});
const houseShut = q("[data-house-shut]");
const layer = q("[data-customers]");
layer.replaceChildren();
const pool = Array.from({ length: 36 }, () => { const g = document.createElementNS(NS, "g"); g.innerHTML = TOKEN_SVG; g.style.display = "none"; layer.appendChild(g); return { g, edges: [...g.querySelectorAll(".iso-edge")], busy: false, failed: false }; });

const cfg = { readiness: "shop", liveness: "shop", timeout: 5, threshold: 3, boot: 12, startupProbe: false, load: 0.5, speed: 1 };
let model, simTime, tokens, spawnClock, seed = (Date.now() % 1e6) + 1, lastEvent = 0, history;

function options() { const { speed, ...rest } = cfg; return rest; }
// The first frame: one shop rebuilding, one jammed, one restocking (the same tableau the static figure shows).
function tableau() {
  G.TABLEAU.forEach((st, i) => {
    const s = model.shops[i];
    s.restarts = st.restarts; s.inRow = st.restarts; model.totals.restarts += st.restarts;
    if (st.phase === "down") { s.phase = "down"; s.phaseT = 0; s.downFor = 9; s.ready = false; s.containerAge = 0; }
    if (st.phase === "dead") { s.phase = "dead"; s.phaseT = 0; s.fails = st.fails; s.ready = false; }
    if (st.phase === "warm") { s.phase = "warm"; s.phaseT = (st.stock / 5) * model.cfg.warm; s.ready = false; s.containerAge = model.cfg.boot + s.phaseT; s.runFor = 0; }
  });
  model.disrupt();
}
function restart(withTableau = true) {
  model = makeSim(options(), seed++);
  if (withTableau) tableau();
  simTime = 0; tokens = []; spawnClock = 0; lastEvent = 0; history = [];
  pool.forEach((p) => { p.busy = false; p.g.style.display = "none"; });
  shops.forEach((s) => { s.shown = {}; s.pegUp = null; });
  paint(0); showStats();
  say(withTableau ? "shop 2 rebuilding · shop 3 jammed · shop 4 restocking" : "five shops open");
}
function apply() { Object.assign(model.cfg, options()); }

function setShown(s, key, el, on) { if (s.shown[key] !== on) { s.shown[key] = on; el.style.display = on ? "" : "none"; } }
function paint(realDt) {
  houseShut.style.display = model.warehouseUp ? "none" : "";
  model.shops.forEach((m, i) => {
    const s = shops[i];
    setShown(s, "building", s.building, m.phase !== "down");
    setShown(s, "scaffold", s.scaffold, m.phase === "down");
    setShown(s, "shut", s.shut, m.phase === "boot");
    setShown(s, "jam", s.jam, m.phase === "dead");
    const stock = m.phase === "warm" ? Math.min(4, Math.floor((m.phaseT / model.cfg.warm) * 5)) : (m.phase === "run" || m.phase === "dead") ? 4 : 0;
    s.crates.forEach((c, n) => setShown(s, "c" + n, c, n < stock));
    const target = m.ready ? 0 : -G.SIGN_DROP;
    s.signAt += (target - s.signAt) * Math.min(1, realDt * 8);
    if (Math.abs(target - s.signAt) < 0.05) s.signAt = target;
    s.sign.setAttribute("transform", s.signAt ? translateAlong(P, [0, 0, s.signAt]) : "");
    if (s.lit !== m.ready) { s.lit = m.ready; s.signSolid.toggleAttribute("data-lit", m.ready); s.signSolid.querySelector(".iso-edge").setAttribute("data-tone", m.ready ? "hi" : "mid"); }
    if (s.pegUp !== m.ready) {
      s.pegUp = m.ready;
      const [x, y] = G.PEGS[i];
      s.peg.innerHTML = solidSvg(cylinder(x, y, 1.2, G.KIOSK_TOP, m.ready ? 5 : 1, P, 14, 0.2), { tone: m.ready ? "hi" : "lo", crease: "lo", lit: m.ready });
    }
    s.tallies.forEach((t, n) => setShown(s, "t" + n, t, n < m.fails));
    s.slots.forEach((el, n) => setShown(s, "s" + n, el, n < model.cfg.threshold));
    s.pips.forEach((el, n) => setShown(s, "p" + n, el, n < m.restarts));
  });
  paintTokens(realDt);
}

function spawn() {
  const p = pool.find((x) => !x.busy); if (!p) return;
  const ready = model.shops.filter((m) => m.ready);
  if (!ready.length) { p.busy = true; tokens.push({ p, path: [[G.SPAWN[0], G.SPAWN[1]], [G.SPAWN[0] + 26, G.SPAWN[1]]], ok: false, t: 0 }); return; }
  const m = ready[Math.floor(Math.random() * ready.length)];
  const cx = G.SHOP_X[m.i];
  const ok = m.phase === "run" && model.warehouseUp;
  p.busy = true;
  tokens.push({ p, path: [[G.SPAWN[0], G.SPAWN[1]], [cx, G.WALK_Y], [cx, G.SHOP.y1 + 5]], ok, t: 0 });
}
function lengthOf(path) { let n = 0; for (let i = 1; i < path.length; i++) n += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); return n; }
function pointOn(path, d) {
  for (let i = 1; i < path.length; i++) {
    const seg = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    if (d <= seg || i === path.length - 1) { const u = seg ? Math.max(0, Math.min(1, d / seg)) : 1; return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * u, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * u]; }
    d -= seg;
  }
  return path[path.length - 1];
}
function paintTokens(realDt) {
  for (const tk of tokens) {
    tk.t += realDt;
    const len = lengthOf(tk.path), go = len / WALK, back = tk.ok ? 0.35 : Math.min(go, 1.2);
    let d, opacity = 1, lit = false;
    if (tk.t < go) d = ease(tk.t / go) * len;
    else if (tk.ok) { d = len; opacity = 1 - (tk.t - go) / back; }
    else { const u = (tk.t - go) / back; d = len * (1 - ease(Math.min(1, u))); lit = true; opacity = u > 0.75 ? (1 - u) / 0.25 : 1; }
    const [x, y] = pointOn(tk.path, d);
    tk.p.g.setAttribute("transform", translateAlong(P, [x, y, 0]));
    tk.p.g.style.opacity = String(Math.max(0, opacity));
    tk.p.g.style.display = "";
    if (tk.p.failed !== lit) { tk.p.failed = lit; tk.p.edges.forEach((e) => e.setAttribute("data-tone", lit ? "lo" : "hi")); }
    if (tk.t >= go + back) { tk.done = true; tk.p.busy = false; tk.p.g.style.display = "none"; }
  }
  tokens = tokens.filter((tk) => !tk.done);
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function showStats() {
  const T = model.totals;
  statEls.served.textContent = Math.round(T.served);
  statEls.errors.textContent = Math.round(T.errors);
  statEls.restarts.textContent = T.restarts;
  statEls.ready.textContent = model.readyCount() + " / 5";
  history.push({ t: model.t, a: T.arrived, e: T.errors });
  while (history.length > 2 && history[1].t < model.t - 10) history.shift();
  const h0 = history[0], da = T.arrived - h0.a, de = T.errors - h0.e;
  statEls.rate.textContent = da > 0 ? Math.round((100 * de) / da) + "%" : "0%";
  statEls.recover.textContent = model.lastDisruption === null ? "–" : model.recovered !== null ? Math.round(model.recovered - model.lastDisruption) + " s" : "waiting";
}

let statTimer = 0;
function step(dt) {
  simTime += dt * cfg.speed;
  model.runTo(simTime);
  spawnClock += dt;
  while (spawnClock >= SPAWN_EVERY) { spawnClock -= SPAWN_EVERY; spawn(); }
  paint(dt);
  if (model.events.length && model.events[model.events.length - 1] !== lastEvent) { lastEvent = model.events[model.events.length - 1]; say(lastEvent.text); }
  statTimer += dt; if (statTimer > 0.25) { statTimer = 0; showStats(); }
}

// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });
const NUMERIC = ["timeout", "threshold", "boot", "load", "speed"];
function set(name, raw) {
  cfg[name] = NUMERIC.includes(name) ? Number(raw) : name === "startupProbe" ? raw === true || raw === "true" : raw;
  WB.pressSeg(name, raw);
  if (name !== "speed") apply();
}
function act(name) {
  if (name === "blip") model.blip(30);
  if (name === "jam") model.deadlock(2);
  if (name === "restart") { model.restartShop(3); model.restartShop(4); }
  if (name === "restart1") model.restartShop(2);
  if (loop.paused) loop.setPaused(false);
}
WB.onSegments((name, value) => set(name, value));
for (const name of ["blip", "jam", "restart"]) document.querySelector('[data-act="' + name + '"]').addEventListener("click", () => act(name));
document.querySelector('[data-act="reset"]').addEventListener("click", () => restart());
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const r = (x) => Math.round(x);
const top = (...xs) => Math.max(1, ...xs);
const BASE = { load: 0.5 };
const RUNS = {
  readiness: () => {
    const run = (readiness) => average((seed) => { const { totals } = scenario({ ...BASE, readiness }, [[20, (s) => { s.restartShop(3); s.restartShop(4); }]], 90, seed); return { errors: totals.errors, arrived: totals.arrived }; });
    const off = run("off"), on = run("shop"), m = top(off.errors, on.errors);
    return { verdict: "Errors over the 70 s after the deploy: " + r(off.errors) + " of about " + r(off.arrived * 70 / 90) + " customers without a readiness probe, " + r(on.errors) + " with one.",
      bars: [["No readiness", off.errors / m, String(r(off.errors)), true], ["Readiness", on.errors / m, String(r(on.errors))]] };
  },
  deps: () => {
    const run = (liveness, readiness) => average((seed) => { const { sim, totals } = scenario({ ...BASE, liveness, readiness }, [[20, (s) => s.blip(30)]], 240, seed); return { errors: totals.errors, restarts: totals.restarts, back: (sim.recovered ?? 240) - 50 }; });
    const live = run("deps", "shop"), ready = run("shop", "deps"), m = top(live.back, ready.back);
    return { verdict: "All five shops open again " + live.back.toFixed(0) + " s after the warehouse is back when liveness checks it (" + r(live.restarts) + " restarts), " + ready.back.toFixed(0) + " s when only readiness does (" + r(ready.restarts) + " restarts).",
      bars: [["Liveness: warehouse", live.back / m, live.back.toFixed(0) + " s", true], ["Readiness: warehouse", ready.back / m, ready.back.toFixed(0) + " s"], ["Errors, liveness", live.errors / top(live.errors, ready.errors), String(r(live.errors)), true], ["Errors, readiness", ready.errors / top(live.errors, ready.errors), String(r(ready.errors))]] };
  },
  timeout: () => {
    const run = (timeout) => average((seed) => { const { totals } = scenario({ load: 0.9, timeout }, [], 300, seed); return { errors: totals.errors, restarts: totals.restarts }; });
    const loose = run(5), tight = run(1), m = top(loose.restarts, tight.restarts), e = top(loose.errors, tight.errors);
    return { verdict: "In 5 minutes at 90% traffic: " + tight.restarts.toFixed(1) + " restarts and " + r(tight.errors) + " errors with a 1 s timeout, " + loose.restarts.toFixed(1) + " restarts and " + r(loose.errors) + " errors with 5 s.",
      bars: [["Restarts, 1 s", tight.restarts / m, tight.restarts.toFixed(1), true], ["Restarts, 5 s", loose.restarts / m, loose.restarts.toFixed(1)], ["Errors, 1 s", tight.errors / e, String(r(tight.errors)), true], ["Errors, 5 s", loose.errors / e, String(r(loose.errors))]] };
  },
  startup: () => {
    const run = (startupProbe) => average((seed) => { const { sim, totals } = scenario({ ...BASE, boot: 60, startupProbe }, [[5, (s) => s.restartShop(2)]], 300, seed); return { restarts: totals.restarts, back: (sim.recovered ?? 300) - 5 }; });
    const none = run(false), probe = run(true), m = top(none.back, probe.back);
    const never = none.back >= 295;
    return { verdict: "Without a startup probe the shop was restarted " + none.restarts.toFixed(0) + " times and " + (never ? "never opened in 5 minutes" : "opened after " + none.back.toFixed(0) + " s") + ". With one it opened after " + probe.back.toFixed(0) + " s, with " + probe.restarts.toFixed(0) + " restarts.",
      bars: [["No startup probe", none.back / m, never ? "never" : none.back.toFixed(0) + " s", true], ["Startup probe", probe.back / m, probe.back.toFixed(0) + " s"]] };
  },
  deadlock: () => {
    const run = (liveness, readiness) => average((seed) => { const { sim, totals } = scenario({ ...BASE, liveness, readiness }, [[20, (s) => s.deadlock(2)]], 180, seed); return { errors: totals.errors, back: (sim.recovered ?? 180) - 20 }; });
    const neither = run("off", "off"), ready = run("off", "shop"), both = run("shop", "shop"), m = 160, e = top(neither.errors, ready.errors, both.errors);
    const label = (x) => (x >= 159 ? "never" : x.toFixed(0) + " s");
    return { verdict: "Over 160 s: no probes, " + r(neither.errors) + " errors and shop 3 never recovers; readiness only, " + r(ready.errors) + " errors and it never recovers; readiness and liveness, " + r(both.errors) + " errors and it is back after " + label(both.back) + ".",
      bars: [["Back: readiness only", ready.back / m, label(ready.back), true], ["Back: + liveness", both.back / m, label(both.back)], ["Errors: no probes", neither.errors / e, String(r(neither.errors))], ["Errors: readiness", ready.errors / e, String(r(ready.errors)), true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  restart(false);
  for (const name of ["readiness", "liveness", "timeout", "threshold", "boot", "startupProbe", "load"]) set(name, String(w[name]));
  if (loop.paused) loop.setPaused(false);
  if (w.act) setTimeout(() => act(w.act), 2500);
  say("watching: " + exp.title.toLowerCase());
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./health-probe-workbench.html", import.meta.url), {
  title: "Health Probe Workbench",
  eyebrow: "Systems lesson 23 · Health checks",
  lede: "Kubernetes asks every pod two different questions: can you take traffic right now (readiness), and are you so broken that only a restart will help (liveness)? Mixing them up turns small problems into outages. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
  machine: { intro: "Each shop is a pod. Its open sign is the readiness probe, its inspector is the liveness probe, and the warden only sends customers to shops whose peg is up. Take the warehouse down, jam a shop or redeploy two, then change what the probes check.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over four seeded runs; probes run every 3 s.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote health-probe-workbench.html", (size / 1024).toFixed(0) + " KB");

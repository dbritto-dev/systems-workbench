// Systems lesson 22 · Feature flags. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, tokenSvg, cablePoints, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "kill",
    title: "A bad feature at 50%",
    change: "Buggy feature on for 50% of users · someone notices at 30 s · flip the kill switch (servers refresh every 5 s) vs redeploy the old build (90 s pipeline, then 30 s per server)",
    question: "How long until no user hits the bug, with each fix?",
    options: ["About the same: either way the old behaviour comes back", "Seconds with the kill switch, minutes with the redeploy", "The redeploy is faster, because flag settings are cached"],
    answer: 1,
    why: "The new code was already on every server; the flag only decided who ran it. Turning the flag off needs no build, no pipeline and no restart: each server stops showing the feature at its next settings refresh. A redeploy has to rebuild and roll out server by server, and the bug keeps firing on every server that hasn't been replaced yet. That gap is the whole point of separating deploy from release.",
    watch: { pct: 50, sticky: true, staffFirst: false, ttl: 5, buggy: true, flags: 1, then: "kill" },
  },
  {
    id: "sticky",
    title: "Random or sticky",
    change: "30% rollout for 2 minutes · each request rolls a die vs each user is hashed to a fixed bucket",
    question: "Out of about 200 users, how many see both the old and the new version?",
    options: ["About 30%, the rollout share", "Most of them with random, none with sticky", "None either way: a user is either in or out"],
    answer: 1,
    why: "With a die roll per request, a user who makes several requests lands in the 30% sometimes and outside it the rest, so the page changes under them: a button appears, then vanishes. Hashing the user id (plus the flag name) gives each user a fixed bucket from 0 to 99, so the same user always gets the same answer, and raising the rollout from 30% to 50% only adds users, never moves them back.",
    watch: { pct: 30, sticky: false, staffFirst: false, ttl: 5, buggy: false, flags: 1 },
  },
  {
    id: "ttl",
    title: "Stale flags",
    change: "Feature on for everyone, turned off at 30 s · each server refreshes its copy of the settings every 5 s vs every 60 s",
    question: "With a 60 s refresh, how long do servers keep showing the feature after it's off?",
    options: ["It stops at once: the console is the source of truth", "Up to about a minute, one server at a time", "Until the next deploy"],
    answer: 1,
    why: "Servers don't ask the flag service on every request; that would make it a dependency of every page. They keep a copy and refresh it. Until a server's next refresh it still serves what it last saw, so after a flip the feature fades out server by server. Shorter refreshes or a push from the flag service (streaming, webhooks) shrink that window; that is what makes a kill switch fast.",
    watch: { pct: 100, sticky: true, staffFirst: false, ttl: 60, buggy: false, flags: 1, then: "kill" },
  },
  {
    id: "debt",
    title: "Flag debt",
    change: "3 flags vs 10 flags in use, each on for half the users (sticky, independent)",
    question: "With 10 flags, how many different versions of the app are live at the same time?",
    options: ["10, one per flag", "1,024, every possible combination", "Nearly one per active user: well over a hundred"],
    answer: 2,
    why: "Each flag doubles the number of possible combinations: 3 flags give 8, 10 flags give 1,024. Only about 200 users are active, so the live count stops near the number of users, and almost every user runs a combination nobody else has, and nobody tested. That is why finished rollouts should have their flag deleted: a flag that stays at 100% is still a branch someone has to reason about.",
    watch: { pct: 50, sticky: true, staffFirst: false, ttl: 5, buggy: false, flags: 10 },
  },
  {
    id: "target",
    title: "Staff first",
    change: "A buggy feature for 60 s · on for internal staff only (5% of traffic) vs on for 10% of all users",
    question: "How many customers hit the bug in that minute?",
    options: ["About the same either way", "None with staff first; around ten with 10% of everyone", "More with staff first, because staff use the product more"],
    answer: 1,
    why: "Targeting lets the first users of a feature be the people who built it. Staff meet the bug, report it and the flag goes off before any customer sees it. A percentage rollout picks users at random, so customers are in the first group. In practice teams chain both: staff, then a few percent of customers, then everyone, watching errors at each step.",
    watch: { pct: 10, sticky: true, staffFirst: true, ttl: 5, buggy: true, flags: 1 },
  },
];

const QUESTIONS = [
  ["What does \"separate deploy from release\" mean, and what does it buy you?",
    "Deploying puts the new code on the servers; releasing decides who runs it. With a flag the code ships dark, and turning it on or off is a settings change, not a build. You can deploy on Tuesday, release to staff on Wednesday, to 10% on Thursday, and switch it off in seconds if it breaks, without a redeploy."],
  ["Why hash the user id for a percentage rollout instead of picking randomly per request?",
    "A random roll per request flips the same user between versions, which breaks their experience and your metrics. Hashing the user id (with the flag name as salt) gives each user a stable bucket, so they always see the same thing, and raising the percentage only adds users. Including the flag name means different flags don't all pick the same users."],
  ["You flip a kill switch and some users still see the feature for a while. Why, and how would you shorten that?",
    "Each server evaluates flags from a cached copy that refreshes on a timer, so servers keep serving the old setting until their next refresh. Shorten the refresh interval, use a flag service that pushes changes (streaming), and for kill switches make sure the client also re-evaluates rather than caching the decision for a whole session."],
  ["Your team has 40 flags, many at 100% for months. What's the risk, and what would you do?",
    "Every flag is a branch in the code and a dimension in the test matrix. Old flags hide dead code, make bugs depend on flag combinations nobody tested, and a stray toggle can switch off something everyone relies on. Give each release flag an owner and an expiry, remove the flag and the old path once it's at 100%, and keep only long-lived operational flags (kill switches, limits) on purpose."],
  ["Is a feature flag a replacement for a canary deploy or a rollback?",
    "No, they cover different risks. A flag only protects the code it wraps; a bad dependency upgrade, a config change or a broken migration in the same deploy isn't behind any flag. Canaries and rollbacks protect the deploy itself; flags protect the release of a feature. Most teams use both."],
  ["Where should flag evaluation happen, and what happens if the flag service is down?",
    "Usually in the app, from a locally cached copy, so the flag service isn't on the request path. Every flag needs a safe default for when no copy is available (usually off for new features), and servers should keep using their last good copy rather than failing when the service is unreachable."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Lighting console",
  keys: [
    { mark: "lit", label: "The new show: requests and lamps running the new feature" },
    { mark: "raised", label: "Stages: four app servers, each with a cue card, its cached copy of the settings" },
    { mark: "flat", label: "Console: rollout fader, random/sticky toggle, targeting and refresh knobs, kill switch, flag bank" },
  ],
  caption:
    "The new feature is already deployed on all four stages, dark. Requests ride the rail from the turnstile to a stage, which decides from its cue card whether to show the new version (lit) or the old one; a request that fails drops into the stage's bin. A stage only learns about a change on the console when its dial comes round and it fetches the settings along its cable.",
  stage: 'data-console aria-label="Feature flag console simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const controls = panel({
  stats: [["requests", "Requests"], ["share", "On new version", "–"], ["errors", "Errors"], ["both", "Saw both versions"], ["behind", "Servers behind"], ["combos", "App versions live"]],
  controls: [
    seg("pct", "Rollout", [[0, "0%"], [10, "10%"], [50, "50%"], [100, "100%"]], 10),
    seg("sticky", "Bucketing", [["false", "Random"], ["true", "Sticky by user"]], "true"),
    seg("staffFirst", "Targeting", [["false", "Everyone"], ["true", "Staff only"]], "false"),
    seg("ttl", "Settings refresh", [[5, "5 s"], [30, "30 s"], [60, "60 s"]], 5),
    seg("buggy", "Feature", [["false", "Works"], ["true", "Buggy"]], "false"),
    seg("flags", "Flags in use", [[1, "1"], [3, "3"], [10, "10"]], 1),
    speedSeg(),
    actions("Do something", [["kill", "Kill switch"], ["rollback", "Redeploy old build"], ["reset", "Start over"], ["pause", "Pause"]]),
  ],
});

const css = `
.cue-fill{fill:var(--anatomy-mid);stroke:none}
.pulse{fill:var(--anatomy-lit);stroke:none}
[data-tokens] .tok{transition:none}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const CABLES = ${JSON.stringify(GEOMETRY.STAGES.map((_, i) => cablePoints(i)))};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const TOKEN_SVG = ${JSON.stringify(tokenSvg())};
const SPEED = 150, FADE = 0.35, PULSE_TIME = 0.6, POOL = 48, NS = "http://www.w3.org/2000/svg";

const stage = document.querySelector("[data-console]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const lerp = (a, b, t) => a + (b - a) * t;
const tokensBox = q("[data-tokens]"), pulsesBox = q("[data-pulses]");
const lampNew = G.STAGES.map((_, i) => q('[data-lamp="' + i + '-new"] .iso-solid:last-of-type'));
const dials = G.STAGES.map((_, i) => q('[data-dial="' + i + '"]'));
const cues = G.STAGES.map((_, i) => q('[data-cue="' + i + '"]'));
const fader = q("[data-fader]"), toggle = q("[data-toggle]"), kill = q("[data-kill]");
const pointers = { target: q('[data-pointer="target"]'), refresh: q('[data-pointer="refresh"]') };
const bank = Array.from({ length: 10 }, (_, i) => q('[data-bank="' + i + '"]'));
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));

const cfg = { on: true, pct: 10, sticky: true, staffFirst: false, ttl: 5, buggy: false, flags: 1 };
let speed = 1, sim, seed = (Date.now() % 1e6) + 1, tokens = [], pulses = [], rolledBack = false;
const pool = Array.from({ length: POOL }, () => { const g = document.createElementNS(NS, "g"); g.innerHTML = TOKEN_SVG; g.style.display = "none"; tokensBox.appendChild(g); return { g, solid: g.firstElementChild, busy: false }; });

// Where a token is, given how far it has travelled along turnstile → rail → spur.
function routeOf(server) {
  const cx = G.STAGES[server];
  return [[G.RAIL_X0, G.RAIL_Y], [cx, G.RAIL_Y], [cx, G.DECK_FRONT + 3]];
}
function along(points, dist) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (dist <= len) return [lerp(a[0], b[0], dist / len), lerp(a[1], b[1], dist / len)];
    dist -= len;
  }
  return points[points.length - 1];
}
const lengthOf = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

function restart() {
  sim = makeSim({ ...cfg }, seed++);
  rolledBack = false;
  tokens = []; pulses.forEach((p) => p.el.remove()); pulses = [];
  pool.forEach((p) => { p.busy = false; p.g.style.display = "none"; });
  sim.onRequest = (r) => {
    const slot = pool.find((p) => !p.busy);
    if (!slot) return;
    slot.busy = true; slot.g.style.display = "";
    const pts = routeOf(r.server);
    tokens.push({ slot, r, pts, len: lengthOf(pts), born: sim.t, turn: Math.abs(G.STAGES[r.server] - G.RAIL_X0) });
  };
  sim.onFetch = (s) => {
    const el = document.createElementNS(NS, "circle"); el.setAttribute("r", "1.6"); el.setAttribute("class", "pulse");
    pulsesBox.appendChild(el); pulses.push({ el, server: s.i, born: sim.t });
  };
  paint(); showStats();
}

function placeToken(t) {
  const age = sim.t - t.born, dist = age * SPEED, travel = t.len / SPEED;
  let x, y, z = G.TOKEN.z, op = 1, lit = false;
  if (age < travel) {
    [x, y] = along(t.pts, dist);
    lit = t.r.isNew && dist > t.turn;
  } else if (t.r.error) {
    const u = Math.min(1, (age - travel) / 0.5), cx = G.STAGES[t.r.server];
    x = lerp(cx, cx + G.BIN.dx, u); y = lerp(G.DECK_FRONT + 3, G.BIN.y, u); z = G.TOKEN.z + 4 * Math.sin(Math.PI * u) - 2 * u;
    lit = true; op = u < 1 ? 1 : Math.max(0, 1 - (age - travel - 0.5) / FADE);
  } else {
    [x, y] = t.pts[t.pts.length - 1];
    lit = t.r.isNew; op = Math.max(0, 1 - (age - travel) / FADE);
  }
  t.slot.g.setAttribute("transform", translateAlong(P, [x, y, z]));
  t.slot.g.style.opacity = String(op);
  t.slot.solid.toggleAttribute("data-lit", lit);
  return op > 0;
}

function paint() {
  tokens = tokens.filter((t) => { const keep = placeToken(t); if (!keep) { t.slot.busy = false; t.slot.g.style.display = "none"; } return keep; });
  pulses = pulses.filter((p) => {
    const u = (sim.t - p.born) / PULSE_TIME;
    if (u >= 1) { p.el.remove(); return false; }
    const flat = CABLES[p.server].map((c) => [c[0], c[1]]), total = lengthOf(flat);
    const [x, y] = along(flat, u * total);
    const [sx, sy] = iso([x, y, 1.6], P);
    p.el.setAttribute("cx", sx.toFixed(1)); p.el.setAttribute("cy", sy.toFixed(1));
    return true;
  });
  sim.servers.forEach((s, i) => {
    const c = s.cache, cx = G.STAGES[i];
    const showing = s.codeHasFeature && c.on && (c.pct > 0 || c.staffFirst);
    lampNew[i] && lampNew[i].toggleAttribute("data-lit", showing);
    const share = !s.codeHasFeature || !c.on ? 0 : c.staffFirst ? 0.05 : c.pct / 100;
    const x0 = cx + G.CARD.dx - 6, y = G.CARD.y + 1.4, z0 = G.DECK_H + 4.5, z1 = G.DECK_H + 7.5;
    cues[i].setAttribute("d", share > 0.005 ? WB.faceRectY(P, x0, x0 + 12 * share, y, z0, z1) : "");
    const turn = Math.min(1, (sim.t - s.fetchedAt) / sim.ttl), a = turn * Math.PI * 2, dx = cx + G.DIAL.dx, dy = G.DIAL.y, r = G.DIAL.r - 1.8;
    dials[i].setAttribute("d", lineOnTop([dx, dy], [dx + Math.sin(a) * r, dy - Math.cos(a) * r], G.DIAL.z + 0.1, P));
  });
  const f = sim.flag;
  fader.setAttribute("transform", translateAlong(P, [lerp(G.FADER.x0, G.FADER.x1, f.pct / 100), 0, 0]));
  toggle.setAttribute("transform", translateAlong(P, [f.sticky ? 4 : -4, 0, 0]));
  kill.setAttribute("transform", f.on ? "" : translateAlong(P, [0, 0, -3]));
  pointer("target", f.staffFirst ? 0.6 : -0.6);
  pointer("refresh", sim.ttl === 5 ? -0.9 : sim.ttl === 30 ? 0 : 0.9);
  bank.forEach((el, i) => el.setAttribute("transform", translateAlong(P, [0, i < sim.flags ? -G.BANK.travel / 2 : G.BANK.travel / 2, 0])));
}

function pointer(name, a) {
  const [x, y] = G.KNOBS[name], z = G.DESK_TOP + 5.05;
  pointers[name].setAttribute("d", lineOnTop([x, y], [x + Math.sin(a) * 5.2, y - Math.cos(a) * 5.2], z, P));
}

const behind = () => sim.servers.filter((s) => s.cache.on !== sim.flag.on || s.cache.pct !== sim.flag.pct || s.cache.sticky !== sim.flag.sticky || s.cache.staffFirst !== sim.flag.staffFirst).length;
function showStats() {
  const st = sim.stats;
  statEls.requests.textContent = st.requests;
  statEls.share.textContent = st.requests ? Math.round(100 * st.newCount / st.requests) + "%" : "–";
  statEls.errors.textContent = st.errors;
  statEls.both.textContent = flippers(sim);
  statEls.behind.textContent = behind() + " of 4";
  statEls.combos.textContent = sim.combos.size;
  const b = behind(), f = sim.flag;
  let text;
  if (rolledBack) text = "redeploying the old build · " + sim.servers.filter((s) => !s.codeHasFeature).length + " of 4 servers replaced";
  else if (!f.on) text = "kill switch on · " + sim.servers.filter((s) => s.cache.on).length + " of 4 servers still showing it";
  else text = (f.staffFirst ? "staff only" : f.pct + "% · " + (f.sticky ? "sticky" : "random")) + " · " + (b ? b + " of 4 servers behind" : "all servers up to date");
  say(text);
}

let statClock = 0;
const loop = WB.loop({ stage, step: (dt) => { step(sim, dt * speed); paint(); statClock += dt; if (statClock > 0.2) { statClock = 0; showStats(); } }, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });
const pauseBtn = document.querySelector('[data-act="pause"]');
const killBtn = document.querySelector('[data-act="kill"]');

function set(name, raw, quiet) {
  if (name === "speed") speed = Number(raw);
  else if (name === "pct") { cfg.pct = Number(raw); setFlag(sim, { pct: cfg.pct }); }
  else if (name === "sticky") { cfg.sticky = raw === "true"; setFlag(sim, { sticky: cfg.sticky }); }
  else if (name === "staffFirst") { cfg.staffFirst = raw === "true"; setFlag(sim, { staffFirst: cfg.staffFirst }); }
  else if (name === "ttl") { cfg.ttl = Number(raw); sim.ttl = cfg.ttl; sim.servers.forEach((s) => { s.nextFetch = Math.min(s.nextFetch, sim.t + sim.ttl); }); }
  else if (name === "buggy") { cfg.buggy = raw === "true"; sim.buggy = cfg.buggy; }
  else if (name === "flags") { cfg.flags = Number(raw); sim.flags = cfg.flags; sim.combos.clear(); }
  WB.pressSeg(name, raw);
  if (!quiet) { paint(); showStats(); }
}
WB.onSegments((name, value) => set(name, value));
function toggleKill() {
  setFlag(sim, { on: !sim.flag.on });
  cfg.on = sim.flag.on;
  killBtn.textContent = sim.flag.on ? "Kill switch" : "Turn back on";
  paint(); showStats();
}
killBtn.addEventListener("click", toggleKill);
document.querySelector('[data-act="rollback"]').addEventListener("click", () => { if (!rolledBack) { rollback(sim); rolledBack = true; showStats(); } });
document.querySelector('[data-act="reset"]').addEventListener("click", () => { cfg.on = true; killBtn.textContent = "Kill switch"; restart(); });
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const secs = (x) => (x < 10 ? x.toFixed(1) : Math.round(x)) + " s";
const RUNS = {
  kill: () => {
    const r = killVsRollback(), top = Math.max(r.kill.stop, r.rollback.stop);
    return { verdict: "Kill switch: the last bad request came " + secs(r.kill.stop) + " after the decision, " + r.kill.errors.toFixed(1) + " errors on average. Redeploy: " + secs(r.rollback.stop) + ", " + Math.round(r.rollback.errors) + " errors.",
      bars: [["Kill switch", r.kill.stop / top, secs(r.kill.stop), true], ["Redeploy", r.rollback.stop / top, secs(r.rollback.stop)]] };
  },
  sticky: () => {
    const r = stickiness();
    return { verdict: "Of about " + Math.round(r.users) + " users, " + Math.round(r.random) + " saw both versions with a random roll per request; " + Math.round(r.sticky) + " with sticky bucketing.",
      bars: [["Random", r.random / r.users, Math.round(r.random) + " users", true], ["Sticky", r.sticky / r.users, Math.round(r.sticky) + " users"]] };
  },
  ttl: () => {
    const a = staleness(5), b = staleness(60);
    return { verdict: "After the flip, servers kept showing the feature for up to " + secs(a.worst) + " with a 5 s refresh and up to " + secs(b.worst) + " with a 60 s refresh (" + Math.round(b.served) + " requests on average).",
      bars: [["Refresh 5 s", a.worst / 60, secs(a.worst)], ["Refresh 60 s", b.worst / 60, secs(b.worst), true]] };
  },
  debt: () => {
    const a = combos(3), b = combos(10);
    return { verdict: "Live combinations: " + Math.round(a.live) + " of " + a.possible + " possible with 3 flags; " + Math.round(b.live) + " of " + b.possible + " possible with 10 flags, among " + Math.round(b.users) + " active users.",
      bars: [["3 flags", a.live / b.users, Math.round(a.live) + " versions"], ["10 flags", b.live / b.users, Math.round(b.live) + " versions", true]] };
  },
  target: () => {
    const r = targeting(), top = Math.max(r.everyone.customers, r.staff.customers, 1);
    return { verdict: "Customers who hit the bug in 60 s: " + r.staff.customers.toFixed(0) + " with staff only (staff met it " + r.staff.staff.toFixed(0) + " times); " + r.everyone.customers.toFixed(0) + " with 10% of everyone.",
      bars: [["Staff only", r.staff.customers / top, r.staff.customers.toFixed(0) + " customers"], ["10% of everyone", r.everyone.customers / top, r.everyone.customers.toFixed(0) + " customers", true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  for (const name of ["pct", "sticky", "staffFirst", "ttl", "buggy", "flags"]) set(name, String(w[name]), true);
  cfg.on = true; killBtn.textContent = "Kill switch";
  restart();
  if (loop.paused) loop.setPaused(false);
  if (w.then === "kill") setTimeout(() => { if (sim.flag.on) toggleKill(); }, 4000);
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./feature-flag-workbench.html", import.meta.url), {
  title: "Feature Flag Workbench",
  eyebrow: "Systems lesson 22 · Feature flags",
  lede: "A feature flag ships new code switched off and lets you decide, at run time, who sees it. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
  machine: { intro: "The four stages are app servers that already have the new feature. Move the rollout, switch random and sticky, flip the kill switch, and watch each stage pick up the change only when its dial comes round.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs at 8 requests per second from 200 users.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote feature-flag-workbench.html", (size / 1024).toFixed(0) + " KB");

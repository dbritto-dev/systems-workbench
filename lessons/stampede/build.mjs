// Systems lesson 28 · Cache stampede. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, customerSvg, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "deploy",
    title: "Everything expires at once",
    change: "A deploy fills 50 keys at the same moment, all with a 30 s TTL · 500 requests a second spread evenly · the oven has 8 shelves and bakes in 0.2 s, so it can take 40 orders a second",
    question: "What happens around the 30 s mark?",
    options: ["Not much: each key is refreshed once, 50 orders in all", "A burst far above the oven's capacity, mostly duplicate orders, and customers waiting for seconds", "Requests fail fast and the clients retry later"],
    answer: 1,
    why: "Every key was cached at the same instant with the same TTL, so they all expire in the same instant. Each request that arrives before its key is baked again misses and sends its own order, and the oven can only take 40 a second. The queue makes every bake slower, which keeps keys empty longer, which lets more requests miss: the herd feeds itself.",
    watch: { mode: "all", jitter: 0, bake: 1, rate: 12 },
  },
  {
    id: "jitter",
    title: "Add ±20 % jitter",
    change: "Same deploy · every TTL is multiplied by a random factor between 0.8 and 1.2",
    question: "What happens to the busiest second at the oven?",
    options: ["About the same: the same keys still expire", "It drops to well under the oven's capacity", "It gets worse: expiries now land at random times"],
    answer: 1,
    why: "Jitter spreads the 50 expiries over 12 seconds instead of one instant. Each key's little herd is over before the next key expires, so the oven never queues and each refresh finishes in one bake. Jitter costs nothing and fixes the synchronised case, but a single very hot key still has its own herd.",
    watch: { mode: "all", jitter: 0.2, bake: 1, rate: 12 },
  },
  {
    id: "single",
    title: "One order per tray",
    change: "One hot key at 500 requests a second · 10 s TTL · 0.2 s bake · a miss now waits for the order already in the oven instead of sending its own (single-flight, request coalescing)",
    question: "How many oven orders does each expiry cause now?",
    options: ["About 100, the same as before", "About 50: half the customers still order", "One"],
    answer: 2,
    why: "With every miss ordering, about 100 requests arrive during the bake and each sends a duplicate. Coalescing keeps one in-flight order per key; everyone else waits on it and is served by the same result. The oven sees one order per expiry, so the queue never forms and even the waiting customers are served sooner.",
    watch: { mode: "single", jitter: 0, bake: 1, rate: 12 },
  },
  {
    id: "stale",
    title: "Serve the old loaf",
    change: "Same hot key, but a bake now takes 1 s · single-flight vs stale-while-revalidate (serve the expired loaf at once and refresh it with one background order)",
    question: "With single-flight, about 500 customers wait up to a second at every expiry. With stale-while-revalidate…",
    options: ["The same customers wait, just a little less", "Nobody waits; about 500 customers get a loaf up to a second past its expiry", "The oven bakes 500 times instead of once"],
    answer: 1,
    why: "Single-flight removes the duplicate work but not the wait: everyone who arrives during the bake waits for it. Stale-while-revalidate keeps serving the old value while one background order refreshes it, so the expiry becomes invisible to users. The price is freshness: for one bake's time, people see data slightly past its TTL, which is fine for a product page and not for a balance.",
    watch: { mode: "stale", jitter: 0, bake: 1, rate: 12 },
  },
  {
    id: "slow",
    title: "A slower oven",
    change: "One hot key at 200 requests a second · every miss orders · bake time 0.2 s → 1 s (five times slower)",
    question: "What happens to the longest wait at an expiry?",
    options: ["About five times longer, in line with the bake", "Far more than five times longer: the herd outgrows the oven", "Unchanged: the first order still finishes after one bake"],
    answer: 1,
    why: "A slower bake keeps the key empty five times longer, so five times as many requests miss, and they all land on the same eight shelves. Once the herd is bigger than what the oven can bake before the next customers arrive, the queue grows and the last orders wait for every duplicate ahead of them. Stampedes hurt most exactly when the database is already slow.",
    watch: { mode: "all", jitter: 0, bake: 2, rate: 12 },
  },
];

const QUESTIONS = [
  ["What is a cache stampede, and why can it make the database slower than having no cache at all?",
    "A hot entry expires and every request that arrives before it is rebuilt misses at the same moment and runs the same expensive query. The database sees a sudden burst of identical work it was never sized for (the cache was hiding that load), queues, slows down, and the slowdown keeps the entry empty longer, so even more requests miss."],
  ["Why do deploys and cold starts cause synchronised expiry, and what does TTL jitter do about it?",
    "A deploy or warm-up fills many keys within a few seconds, all with the same TTL, so they all expire together one TTL later and again after that. Multiplying each TTL by a small random factor (say 0.8–1.2) spreads those expiries over a window, so the refresh load arrives as a trickle the database can absorb."],
  ["How does request coalescing (single-flight) work, and what does it not solve across many app servers?",
    "Each process keeps a map of in-flight refreshes per key; a miss that finds one waits on it instead of starting its own, so one query serves everyone. It works per process: with 50 instances you still get up to 50 queries per expiry. For one query in total you need a shared lock or lease (with a timeout, in case its holder dies), or you accept N."],
  ["What does stale-while-revalidate trade, and where would you not use it?",
    "It keeps serving the expired value while one background refresh runs, so nobody waits and the database sees one query. The trade is freshness: readers can see data slightly older than the TTL. Fine for catalogues, feeds and counts; not for balances, permissions or anything where an old value causes a wrong decision."],
  ["What is probabilistic early expiration (XFetch), and why does it avoid a stampede without any coordination?",
    "Each request that hits a value near the end of its TTL refreshes it early with a probability that rises as expiry approaches (and with how slow the recompute is). Some request almost always refreshes the key just before it expires, so it never actually goes missing, and no lock or shared state is needed."],
  ["Every hour on the hour your database CPU spikes for 30 seconds and the slow-query log shows the same query hundreds of times. Diagnose it and list the fixes you would try, in order.",
    "Many keys cached at the same time with a one-hour TTL, expiring together and stampeding. In order: add TTL jitter; coalesce refreshes per key (single-flight, or a lock with timeout across instances); serve stale while revalidating where freshness allows; refresh early (XFetch or a background job) for the hottest keys; and make the query itself cheaper or rate-limited so a herd can't take the database down."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Bakery",
  keys: [
    { mark: "lit", label: "A duplicate order (that tray is already ordered), or an old loaf being served" },
    { mark: "raised", label: "Trays, oven shelves, order tickets, customers and counters" },
    { mark: "flat", label: "Expiry dials and the oven's load gauge" },
  ],
  caption:
    "Each tray in the case is a cached key; the wedge on its dial is the time it has left. When a loaf expires, customers who wanted it stand in front of its tray and orders go to the oven, the database. The oven bakes four at a time; the rest hang as numbered tickets on the rail, and the gauge shows how many orders are in. The tag above a shelf names the tray it is baking. With every miss ordering, the oven fills with the same tray over and over: those duplicates are lit, and each customer waits for their own order even after the first one has refilled the tray. With one order per tray, customers wait for the single order; with stale-while-revalidate the expired loaf stays out with an OLD tag while one fresh batch bakes.",
  stage: 'data-bakery aria-label="Cache stampede simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">Every tray is cached at the start, as after a deploy, with a 10 s TTL. Changing a setting starts the run again. Expire every tray now to watch a stampede on demand.</p>`;
const controls = panel({
  stats: [["requests", "Requests"], ["hit", "Hit rate", "–"], ["orders", "Oven orders"], ["dups", "Duplicates"], ["wait", "Longest wait", "–"], ["stale", "Stale served"]],
  controls: [
    seg("mode", "On a miss", [["all", "Everyone orders"], ["single", "One order, others wait"], ["stale", "Serve stale, refresh"]], "all"),
    seg("jitter", "Expiry", [[0, "Equal TTL"], [0.2, "±20 % jitter"]], 0),
    seg("bake", "Bake time", [[0.5, "0.5 s"], [1, "1 s"], [2, "2 s"]], 1),
    seg("rate", "Customers", [[6, "6/s"], [12, "12/s"], [24, "24/s"]], 12),
    speedSeg(),
    actions("Do something", [["expire", "Expire every tray now"], ["reset", "Start over"], ["pause", "Pause"]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
.iso-dial-fill{fill:var(--anatomy-faint);stroke:none}
body.lit-fill [data-shelf-tag]:has(> [data-shelf-lit]:not([style*="none"])) [data-shelf-num]{fill:var(--anatomy-page)}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const TTL = 10;

const stage = document.querySelector("[data-bakery]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const qa = (s) => [...svg.querySelectorAll(s)];
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const setD = (el, d) => { if (el.getAttribute("d") !== d) el.setAttribute("d", d); };
const show = (el, on) => { const v = on ? "" : "none"; if (el.style.display !== v) el.style.display = v; };
const lit = (el, on) => { if (on !== el.hasAttribute("data-lit")) el.toggleAttribute("data-lit", on); };
const at = (p) => iso(p, P);

const trays = Array.from({ length: G.KEYS }, (_, i) => ({ loaf: q('[data-loaf="' + i + '"]'), old: q('[data-loaf="' + i + '"] [data-old]'), dial: q('[data-dial="' + i + '"]'), fill: q('[data-dial-fill="' + i + '"]') }));
const shelves = G.SHELVES.map((_, i) => ({ tag: q('[data-shelf-tag="' + i + '"]'), tagLit: q('[data-shelf-tag="' + i + '"] [data-shelf-lit]'), num: q('[data-shelf-tag="' + i + '"] [data-shelf-num]'), tray: q('[data-shelf-tray="' + i + '"]') }));
const slots = G.RACK_SLOTS.map((_, n) => ({ g: q('[data-slot="' + n + '"]'), plain: q('[data-slot="' + n + '"] [data-plain]'), lit: q('[data-slot="' + n + '"] [data-lit]'), nums: qa('[data-slot="' + n + '"] [data-ticket-num]') }));
const spots = G.SPOTS.map((row, key) => row.map((_, n) => q('[data-spot="' + key + '-' + n + '"]')));
const gauge = q("[data-gauge]");
const digits = Object.fromEntries(G.BOARD_ROWS.map((r) => [r.name, [0, 1, 2].map((n) => q('[data-digit="' + r.name + n + '"]'))]));

function setCounter(name, v) {
  const s = String(Math.min(999, Math.max(0, Math.floor(v)))).padStart(3, "0");
  digits[name].forEach((el, n) => { if (el.textContent !== s[n]) el.textContent = s[n]; });
}
function dialPaths(i, frac) {
  const cx = G.TRAY_X[i] + 2, y = G.DIAL.y, cz = G.DIAL.z, r = G.DIAL.r * 0.78;
  const pt = (f) => { const a = f * Math.PI * 2; return at([cx + Math.sin(a) * r, y, cz + Math.cos(a) * r]); };
  const c = at([cx, y, cz]);
  const tip = pt(frac);
  const needle = pathOf([c, tip]);
  if (frac <= 0.001) return { needle, fill: "" };
  const n = Math.max(2, Math.ceil(frac * 32));
  const arc = [c]; for (let s = 0; s <= n; s++) arc.push(pt((s / n) * frac));
  return { needle, fill: pathOf(arc, true) };
}
function gaugePath(frac) {
  const g = G.GAUGE, a = Math.PI * (1 - Math.max(0, Math.min(1, frac)));
  return pathOf([at([g.x, g.y + 1.3, g.z]), at([g.x + Math.cos(a) * g.r * 0.82, g.y + 1.3, g.z + Math.sin(a) * g.r * 0.82])]);
}

const cfg = { mode: "all", jitter: 0, bake: 1, rate: 12, speed: 1 };
const WARM = 10.9;   // start just after the first expiry, so the first frame shows a stampede in progress
let model, clock, seed = 4;

function restart() {
  model = makeSim({ weights: LIVE.weights, rate: cfg.rate, ttl: TTL, bake: cfg.bake, shelves: LIVE.shelves, mode: cfg.mode, jitter: cfg.jitter }, seed++);
  clock = WARM;
  model.runTo(clock);
  paint();
}

function paint() {
  const m = model, st = m.stats;
  // Trays, their dials and the old tags.
  m.keys.forEach((k, i) => {
    const fresh = k.has && clock < k.exp;
    const shown = fresh || (cfg.mode === "stale" && k.has);
    show(trays[i].loaf, shown);
    show(trays[i].old, shown && !fresh);
    const p = dialPaths(i, fresh ? Math.min(1, (k.exp - clock) / (TTL * (1 + cfg.jitter))) : 0);
    setD(trays[i].dial, p.needle); setD(trays[i].fill, p.fill);
  });
  // Oven shelves.
  shelves.forEach((s, i) => {
    const job = m.oven[i];
    show(s.tag, !!job); show(s.tray, !!job);
    if (job) { const t = String(job.key + 1); if (s.num.textContent !== t) s.num.textContent = t; show(s.tagLit, job.dup); }
  });
  // Rack.
  slots.forEach((s, n) => {
    const job = m.rack[n]; show(s.g, !!job);
    if (job) { show(s.plain, !job.dup); show(s.lit, job.dup); const t = String(job.key + 1); for (const el of s.nums) if (el.textContent !== t) el.textContent = t; }
  });
  // Gauge.
  setD(gauge, gaugePath(m.load() / G.GAUGE.max));
  // Customers waiting, in front of their tray.
  const counts = Array(G.KEYS).fill(0);
  const waiting = m.waiting();
  for (const r of waiting) counts[r.key]++;
  spots.forEach((row, key) => row.forEach((el, n) => show(el, n < counts[key])));
  // Board.
  setCounter("wait", waiting.length); setCounter("dup", st.dups); setCounter("stale", st.stale);
  // Readout and stats.
  const empty = m.keys.filter((k) => !(k.has && clock < k.exp)).length;
  if (m.load() || waiting.length) say((empty ? empty + (empty === 1 ? " tray" : " trays") + " expired · " : "") + m.load() + " orders in the oven · " + waiting.length + " waiting");
  else { const next = Math.min(...m.keys.map((k) => k.exp)) - clock; say(cfg.mode === "stale" && empty ? "old loaves out while they refresh" : "all trays fresh · next expiry in " + Math.max(0, next).toFixed(1) + " s"); }
  stat("requests", st.requests);
  stat("hit", st.requests ? Math.round((100 * st.hits) / st.requests) + "%" : "–");
  stat("orders", st.orders);
  stat("dups", st.dups);
  stat("wait", st.waited ? st.maxWait.toFixed(1) + " s" : "–");
  stat("stale", st.stale);
}
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(key, value) { const el = statEls[key]; const text = String(value); if (el && el.textContent !== text) el.textContent = text; }

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(); }, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });

function set(name, raw, quiet) {
  if (name === "speed") { cfg.speed = Number(raw); WB.pressSeg(name, raw); return; }
  cfg[name] = name === "mode" ? raw : Number(raw);
  WB.pressSeg(name, raw);
  if (!quiet) restart();
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="expire"]').addEventListener("click", () => { model.expireAll(clock); if (loop.paused) loop.setPaused(false); paint(); });
document.querySelector('[data-act="reset"]').addEventListener("click", () => restart());
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const one = (x) => (Math.round(x * 10) / 10).toFixed(1);
const int = (x) => String(Math.round(x));
const RUNS = {
  deploy: () => {
    const r = deployRun(0), top = Math.max(r.peak, r.capacity);
    return { verdict: "At the 30 s mark the oven got up to " + int(r.peak) + " orders in one second, against a capacity of " + int(r.capacity) + ". " + int(r.dups) + " of " + int(r.orders) + " orders were duplicates, and the unluckiest customer waited " + one(r.maxWait) + " s.",
      bars: [["Oven capacity per second", r.capacity / top, int(r.capacity)], ["Busiest second", r.peak / top, int(r.peak), true], ["Duplicate orders", r.dups / r.orders, int(r.dups) + " of " + int(r.orders), true]] };
  },
  jitter: () => {
    const a = deployRun(0), b = deployRun(0.2), top = Math.max(a.peak, b.peak, a.capacity), wtop = Math.max(a.maxWait, b.maxWait);
    return { verdict: "With jitter the busiest second fell from " + int(a.peak) + " to " + int(b.peak) + " orders (the oven takes " + int(a.capacity) + "), and the longest wait from " + one(a.maxWait) + " s to " + one(b.maxWait) + " s.",
      bars: [["Busiest second, equal TTL", a.peak / top, int(a.peak)], ["Busiest second, ±20 %", b.peak / top, int(b.peak), true], ["Longest wait, equal TTL", a.maxWait / wtop, one(a.maxWait) + " s"], ["Longest wait, ±20 %", b.maxWait / wtop, one(b.maxWait) + " s", true]] };
  },
  single: () => {
    const a = hotRun("all"), b = hotRun("single"), top = a.perExpiry, wtop = Math.max(a.maxWait, b.maxWait);
    return { verdict: "Orders per expiry: " + int(a.perExpiry) + " when every miss orders, " + int(b.perExpiry) + " with single-flight. The longest wait fell from " + one(a.maxWait) + " s to " + one(b.maxWait) + " s, because no queue forms.",
      bars: [["Orders per expiry, everyone orders", a.perExpiry / top, int(a.perExpiry)], ["Orders per expiry, single-flight", b.perExpiry / top, int(b.perExpiry), true], ["Longest wait, everyone orders", a.maxWait / wtop, one(a.maxWait) + " s"], ["Longest wait, single-flight", b.maxWait / wtop, one(b.maxWait) + " s", true]] };
  },
  stale: () => {
    const a = hotRun("single", 1), b = hotRun("stale", 1), top = Math.max(a.waitedPerExpiry, b.stalePerExpiry);
    return { verdict: "Single-flight: " + int(a.waitedPerExpiry) + " customers waited at each expiry, up to " + one(a.maxWait) + " s. Stale-while-revalidate: " + int(b.waitedPerExpiry) + " waited and " + int(b.stalePerExpiry) + " got the old loaf; the oven still baked " + int(b.perExpiry) + " order per expiry.",
      bars: [["Waited per expiry, single-flight", a.waitedPerExpiry / top, int(a.waitedPerExpiry)], ["Waited per expiry, stale", b.waitedPerExpiry / top, int(b.waitedPerExpiry), true], ["Served stale per expiry", b.stalePerExpiry / top, int(b.stalePerExpiry), true]] };
  },
  slow: () => {
    const a = hotRun("all", 0.2, 200), b = hotRun("all", 1, 200), wtop = Math.max(a.maxWait, b.maxWait), otop = Math.max(a.perExpiry, b.perExpiry);
    return { verdict: "Bake 0.2 s: " + int(a.perExpiry) + " orders per expiry, longest wait " + one(a.maxWait) + " s. Bake 1 s: " + int(b.perExpiry) + " orders, longest wait " + one(b.maxWait) + " s, " + Math.round(b.maxWait / a.maxWait) + " times longer for a bake five times slower.",
      bars: [["Orders per expiry, 0.2 s bake", a.perExpiry / otop, int(a.perExpiry)], ["Orders per expiry, 1 s bake", b.perExpiry / otop, int(b.perExpiry), true], ["Longest wait, 0.2 s bake", a.maxWait / wtop, one(a.maxWait) + " s"], ["Longest wait, 1 s bake", b.maxWait / wtop, one(b.maxWait) + " s", true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  for (const name of ["mode", "jitter", "bake", "rate"]) set(name, String(w[name]), true);
  restart();
  if (loop.paused) loop.setPaused(false);
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./cache-stampede-workbench.html", import.meta.url), {
  title: "Cache Stampede Workbench",
  eyebrow: "Systems lesson 28 · Cache stampede",
  lede: "A cache hides how much work the database would have to do. When a hot entry expires, every request that arrives before it is rebuilt misses at once and the database gets that hidden load in one burst. This lesson builds the herd and the fixes for it: watch a machine do it, predict what changes it, then explain it back.",
  machine: { intro: "A bakery with six trays in the case and an oven that bakes four orders at a time. Every tray was filled at the same moment, so they expire together. Watch customers line up, order tickets pile up on the rail and duplicate orders light up, then switch to one order per tray, serve stale, or add jitter.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, at larger scale, averaged over six seeded runs.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: `Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. Probabilistic early expiration follows Vattani, Chierichetti and Lowenstein, <em>Optimal Probabilistic Cache Stampede Prevention</em> (VLDB 2015).`,
  css,
  script: live,
});
console.log("wrote cache-stampede-workbench.html", (size / 1024).toFixed(0) + " KB");

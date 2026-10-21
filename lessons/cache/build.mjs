// Systems lesson 01 · Caching. Built on the shared workbench layer (../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "ttl",
    title: "Shorter freshness",
    change: "TTL 60 s → 6 s · a card now leaves the rack ten times sooner",
    question: "What happens to the share of requests answered from the rack?",
    options: ["It barely moves: the popular cards are still asked for all the time", "It falls by about half", "It falls to almost nothing"],
    answer: 1,
    why: "A copy only helps if the same record is asked for again before it expires. The most popular record comes back every few requests and still hits, but the next dozen come back every 10 to 30 seconds, after their cards have gone. You trade freshness for trips to the archive.",
    watch: { ttl: 6, slots: 12, traffic: "popular" },
  },
  {
    id: "size",
    title: "A smaller rack",
    change: "Rack 12 slots → 4 slots · a third of the room",
    question: "The rack can now hold 4 of the 40 records. The hit rate…",
    options: ["Falls to a third of what it was, like the room", "Drops, but much less than the room did", "Stays the same"],
    answer: 1,
    why: "When the rack is full, the card that has gone unused longest is taken out (least recently used). The few popular records are used all the time, so they stay; it is the rarely asked records that get pushed out, and they were rarely hits anyway.",
    watch: { ttl: 60, slots: 4, traffic: "popular" },
  },
  {
    id: "even",
    title: "No favourites",
    change: "Popular traffic → even traffic · every record equally likely",
    question: "Same rack, same TTL, but no record is more popular than another. The hit rate…",
    options: ["Stays about the same: the rack is the same size", "Falls to roughly the share of records the rack can hold", "Falls to zero"],
    answer: 1,
    why: "With even traffic, the chance that the record you want is in the rack is about the share of records the rack holds: 12 of 40 is 30%. Caches pay off because real traffic is uneven: a few things are asked for constantly.",
    watch: { ttl: 60, slots: 12, traffic: "even" },
  },
  {
    id: "flush",
    title: "The rack is emptied",
    change: "Empty the rack while traffic flows · a deploy, a restart, a flush",
    question: "Right after the rack is emptied, how long do requests take?",
    options: ["The same as before: the archive still has everything", "Slower for a short while, then back to normal", "Slow until every card has expired once, about a minute"],
    answer: 1,
    why: "Every request becomes a trip to the archive until the popular cards are back. With skewed traffic that takes only a handful of requests. In a real system those trips arrive all at once, and if they are more than the database can serve, a short refill turns into a queue.",
    watch: { ttl: 60, slots: 12, traffic: "popular", flush: true },
  },
  {
    id: "stale",
    title: "A record changes",
    change: "Record #1 is updated in the archive · its card is still in the rack",
    question: "Of the next reads of #1 answered from the rack, how many show the old version?",
    options: ["None: the rack notices the change", "About half", "Most of them, until the card expires"],
    answer: 2,
    why: "The rack has no idea the archive changed. It keeps serving its copy until the TTL runs out. Turning on invalidate on write takes the card out when the record changes, so the next read fetches the new version.",
    watch: { ttl: 60, slots: 12, traffic: "popular", invalidate: false, change: true },
  },
];

const QUESTIONS = [
  ["In the figure a hit takes 0.7 s and a miss 2.75 s. Why does the average wait depend mostly on the hit rate?",
    "Because misses are four times as expensive. Average wait = hit rate × 0.7 + (1 − hit rate) × 2.75, so each point of hit rate removes about 0.02 s. Making hits faster would barely help; avoiding misses is what matters."],
  ["The rack holds 12 of 40 records but answers about two-thirds of requests. What about the traffic makes that possible, and what would break it?",
    "The traffic is skewed: a few records get most of the requests, and those stay in the rack. Even traffic breaks it (hit rate falls to about the rack's share, 30%), and so would a key space so large that even the popular part doesn't fit."],
  ["A teammate wants TTL = 1 s \"so prices are always fresh\". What happens, and what would you suggest instead?",
    "Most copies expire before anyone asks again, so the hit rate collapses and the database takes nearly all reads. Keep a longer TTL and invalidate the key when the price changes, so freshness comes from the write, not from expiry."],
  ["Invalidate on write fixed the stale reads here. Name one way a stale value can still be served.",
    "A writer that skips the app (a migration, an admin script, another service) doesn't delete the key. Or a race: a reader misses, reads the old row, the writer updates and deletes the key, then the reader stores the old row it read. The TTL is the backstop for both."],
  ["Redis restarts during peak traffic. What do you expect in the first seconds, and what would you do before the next deploy?",
    "Every read misses at once, the database gets more reads than it can serve, requests queue and latency jumps. Warm the cache before switching traffic, add capacity headroom on the database, and consider request coalescing so one miss per key goes to the database."],
];



// ---------- page ----------
const figure = figurePlate({
  title: "Records office",
  keys: [
    { mark: "lit", label: "The record in play" },
    { mark: "raised", label: "Card rack: the cache, 12 slots, fast" },
    { mark: "flat", label: "Archive chest: the database, every record, slow" },
  ],
  caption:
    "Each press of the button asks for one of 40 records. If its card is in the rack, it is a hit and is answered in 0.7 s. If not, the carriage fetches it from the archive (2.75 s) and leaves a copy in the rack. The strip on each card is its time to live; the dial turns once a minute.",
  stage: 'data-office aria-label="Records office simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const controls = panel({
  stats: [["requests", "Requests"], ["hits", "From rack"], ["misses", "From archive"], ["rate", "Hit rate", "–"], ["wait", "Avg wait", "–"], ["stale", "Stale reads"]],
  controls: [
    seg("ttl", "Time to live", [[6, "6 s"], [20, "20 s"], [60, "60 s"]], 60),
    seg("slots", "Rack size", [[4, "4 slots"], [12, "12 slots"]], 12),
    seg("traffic", "Traffic", [["popular", "Popular"], ["even", "Even"]], "popular"),
    seg("invalidate", "Invalidate on write", [["false", "Off"], ["true", "On"]], "false"),
    speedSeg(),
    actions("Do something", [["change", "Change record #1"], ["flush", "Empty rack"], ["reset", "Reset counts"], ["pause", "Pause"]]),
  ],
});

// Figure-specific styles: empty slots hide their card, the TTL strip fill, blanking covers.
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
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, options, watch }) => ({ id, answer, options, watch })))};
const CLOCK = [-28, -42], CLOCK_R = 14, CLOCK_TOP = 12, CARRY_Y = 48, CARRY_Z = 8, LIFT_Z = 52;

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const drawersBox = q("[data-drawers]");
const drawerEls = G.DRAWERS.map((_, i) => q('[data-drawer="' + i + '"]'));
const slotEls = G.SLOTS.map((_, i) => q('[data-slot="' + i + '"]'));
const coverEls = G.SLOTS.map((_, i) => q('[data-cover="' + i + '"]'));
const ttlEls = slotEls.map((el) => el.querySelector("[data-ttl]"));
const liftEls = slotEls.map((el) => el.querySelector("[data-lift]"));
const carriageEl = q("[data-carriage]"), fly = q("[data-fly]"), flyHome = q("[data-fly-home]"), cap = q("[data-cap]"), needle = q("[data-needle]");
const capSolid = cap.querySelector(".iso-solid");
const anchors = { front: q('[data-anchor="front"]'), back: q('[data-anchor="back"]') };

const cfg = { ttl: 60, slots: 12, traffic: "popular", invalidate: false, speed: 1 };
let random = rng(Date.now() % 1e6 + 1);
let now = 0, steps = [], current = null, carX = G.PARK;
const versions = new Array(RECORDS + 1).fill(1);
const rack = new Array(12).fill(null);
const where = new Map();
const stats = { requests: 0, hits: 0, misses: 0, stale: 0, wait: 0 };
const drawerOpen = new Array(8).fill(0);
let pulse = null;

const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };

function setCar(x) { carX = x; carriageEl.setAttribute("transform", translateAlong(P, [x, 0, 0])); }
function setDrawer(i, open) {
  drawerOpen[i] = open;
  const d = G.DRAWERS[i], el = drawerEls[i];
  el.querySelector("[data-front]").setAttribute("transform", translateAlong(P, [0, open, 0]));
  el.querySelector("[data-body]").innerHTML = open < 0.3 ? "" : solidSvg(slabOf({ x: d.x0 + 1.2, y: G.FACE_Y, w: G.DRAWER.w - 2.4, d: open, r: 0.4 }, d.z0 + 1, G.DRAWER.h - 2, P, 2), { tone: "mid", crease: "none" });
}
function raise(i) { drawersBox.appendChild(drawerEls[i]); }
function flyAt(p, opacity = 1) { fly.setAttribute("transform", translateAlong(P, p)); fly.style.opacity = String(opacity); }
function flyInto(node) { if (fly.parentNode !== node) node.appendChild(fly); }
function setLit(slot, on) { liftEls[slot].querySelector(".iso-solid").toggleAttribute("data-lit", on); }
function lift(slot, dz) { liftEls[slot].setAttribute("transform", dz ? translateAlong(P, [0, 0, dz]) : ""); }
function showCard(slot, on) { slotEls[slot].toggleAttribute("data-empty", !on); }
function clearSlot(slot) { const c = rack[slot]; if (!c) return; where.delete(c.record); rack[slot] = null; showCard(slot, false); ttlEls[slot].setAttribute("d", ""); }
function expire() { rack.forEach((c, i) => { if (c && c.expires <= now) clearSlot(i); }); }

function chooseSlot(record) {
  expire();
  for (let i = 0; i < cfg.slots; i++) if (!rack[i]) return { slot: i, evicted: null };
  let oldest = 0;
  for (let i = 1; i < cfg.slots; i++) if (rack[i].used < rack[oldest].used) oldest = i;
  const evicted = rack[oldest].record;
  clearSlot(oldest);
  return { slot: oldest, evicted };
}

function finish(time) {
  stats.requests++; stats.wait += time; showStats();
  steps.push({ dur: TIMING.gap });
}

function request() {
  const record = pickRecord(random, cfg.traffic);
  say("#" + record + " · asked for");
  steps.push({
    dur: TIMING.press,
    begin: () => capSolid.setAttribute("data-lit", ""),
    run: (t) => cap.setAttribute("transform", translateAlong(P, [0, 0, -1.6 * Math.sin(Math.PI * t)])),
    done: () => { capSolid.removeAttribute("data-lit"); decide(record); },
  });
}

function decide(record) {
  expire();
  const slot = where.get(record);
  if (slot !== undefined) {
    const card = rack[slot], stale = card.version < versions[record];
    say("#" + record + (stale ? " · hit, but stale v" + card.version + " (archive v" + versions[record] + ")" : " · hit"));
    setLit(slot, true);
    steps.push({ dur: TIMING.hit, run: (t) => lift(slot, 4 * Math.sin(Math.PI * t)), done: () => {
      setLit(slot, false); lift(slot, 0);
      if (rack[slot]) rack[slot].used = now;
      stats.hits++; if (stale) stats.stale++;
      finish(HIT_TIME);
    } });
    return;
  }
  const di = (record - 1) % 8, d = G.DRAWERS[di];
  say("#" + record + " · miss · to the archive");
  const from = carX;
  steps.push({ dur: TIMING.leg, run: (t) => setCar(lerp(from, d.cx, ease(t))) });
  steps.push({ dur: TIMING.drawer, begin: () => raise(di), run: (t) => setDrawer(di, G.DRAWER.open * ease(t)) });
  const top = [d.cx, G.FACE_Y + G.DRAWER.open / 2, d.z0 + G.DRAWER.h + 4];
  steps.push({ dur: TIMING.transfer, begin: () => flyInto(flyHome), run: (t) => {
    if (t < 0.35) flyAt([top[0], top[1], top[2] - 6 + 6 * ease(t / 0.35)], t / 0.35);
    else flyAt(lerp3(top, [d.cx, CARRY_Y, CARRY_Z], ease((t - 0.35) / 0.65)));
  } });
  let target = null;
  steps.push({ dur: TIMING.leg, begin: () => {
    const pick = chooseSlot(record); target = pick.slot;
    if (pick.evicted) say("#" + record + " · rack full · #" + pick.evicted + " out (least recently used)");
  }, run: (t) => {
    setDrawer(di, G.DRAWER.open * (1 - ease(Math.min(1, t * 2.5))));
    const x = lerp(d.cx, G.SLOTS[target].cx, ease(t));
    setCar(x); flyAt([x, CARRY_Y, CARRY_Z]);
  } });
  steps.push({ dur: TIMING.place, run: (t) => {
    const s = G.SLOTS[target], above = [s.cx, CARRY_Y, LIFT_Z], over = [s.cx, s.y + G.CARD.d / 2, LIFT_Z], home = [s.cx, s.y + G.CARD.d / 2, s.z];
    if (t < 0.35) flyAt(lerp3([s.cx, CARRY_Y, CARRY_Z], above, ease(t / 0.35)));
    else if (t < 0.65) flyAt(lerp3(above, over, ease((t - 0.35) / 0.3)));
    else { flyInto(anchors[s.row]); flyAt(lerp3(over, home, ease((t - 0.65) / 0.35))); }
  }, done: () => {
    fly.style.opacity = "0"; flyInto(flyHome);
    const s = target;
    if (rack[s]) clearSlot(s);
    rack[s] = { record, version: versions[record], expires: now + cfg.ttl, used: now };
    where.set(record, s); showCard(s, true); setLit(s, false);
    stats.misses++;
    finish(MISS_TIME);
  } });
}

function advance(dt) {
  now += dt;
  let left = dt, guard = 0;
  while (left > 1e-9 && guard++ < 50) {
    if (!current) {
      current = steps.shift();
      if (!current) { request(); continue; }
      current.elapsed = 0; current.begin && current.begin();
    }
    const use = Math.min(current.dur - current.elapsed, left);
    current.elapsed += use; left -= use;
    current.run && current.run(Math.min(1, current.elapsed / current.dur));
    if (current.elapsed >= current.dur - 1e-9) { const c = current; current = null; c.done && c.done(); }
  }
  if (pulse) {
    pulse.t += dt / 0.7;
    const busy = current && drawerOpen[pulse.di] > 0 && pulse.t <= 0;
    if (!busy) setDrawer(pulse.di, 6 * Math.sin(Math.PI * Math.min(1, pulse.t)));
    if (pulse.t >= 1) { setDrawer(pulse.di, 0); pulse = null; }
  }
}

function paint() {
  expire();
  rack.forEach((c, i) => {
    if (!c) return;
    const share = Math.max(0, Math.min(1, (c.expires - now) / cfg.ttl));
    const s = G.SLOTS[i], y = s.y + G.CARD.d, T = G.TTL_STRIP;
    ttlEls[i].setAttribute("d", share > 0.01 ? WB.faceRectY(P, s.cx + T.x0, s.cx + T.x0 + (T.x1 - T.x0) * share, y, s.z + T.z0, s.z + T.z1) : "");
  });
  const turn = (now % 60) / 60, a = turn * Math.PI * 2;
  needle.setAttribute("d", lineOnTop([CLOCK[0] - Math.sin(a) * 2.6, CLOCK[1] + Math.cos(a) * 2.6], [CLOCK[0] + Math.sin(a) * (CLOCK_R - 3.4), CLOCK[1] - Math.cos(a) * (CLOCK_R - 3.4)], CLOCK_TOP + 0.2, P));
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function showStats() {
  const looked = stats.hits + stats.misses;
  statEls.requests.textContent = stats.requests;
  statEls.hits.textContent = stats.hits;
  statEls.misses.textContent = stats.misses;
  statEls.rate.textContent = looked ? Math.round(100 * stats.hits / looked) + "%" : "–";
  statEls.wait.textContent = stats.requests ? (stats.wait / stats.requests).toFixed(2) + " s" : "–";
  statEls.stale.textContent = stats.stale;
}

// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const clock = WB.loop({ stage, step: (dt) => { advance(dt * cfg.speed); paint(); }, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });
clock.setPaused(clock.paused);
const pressSeg = WB.pressSeg;
function resetCounts() { Object.assign(stats, { requests: 0, hits: 0, misses: 0, stale: 0, wait: 0 }); showStats(); }
function applySlots(n) { cfg.slots = n; coverEls.forEach((el, i) => el.toggleAttribute("data-on", i >= n)); rack.forEach((c, i) => { if (i >= n) clearSlot(i); }); }
function set(name, raw) {
  if (name === "ttl") { cfg.ttl = Number(raw); rack.forEach((c) => { if (c) c.expires = Math.min(c.expires, now + cfg.ttl); }); }
  if (name === "slots") applySlots(Number(raw));
  if (name === "traffic") cfg.traffic = raw;
  if (name === "invalidate") cfg.invalidate = raw === "true" || raw === true;
  if (name === "speed") cfg.speed = Number(raw);
  pressSeg(name, raw);
}
function flushRack() { rack.forEach((c, i) => clearSlot(i)); say("rack emptied"); }
function changeRecord() {
  versions[1]++;
  pulse = { di: 0, t: 0 }; raise(0);
  let text = "#1 changed · archive now v" + versions[1];
  if (cfg.invalidate && where.has(1)) { clearSlot(where.get(1)); text += " · rack copy removed"; }
  else if (where.has(1)) text += " · rack still has v" + rack[where.get(1)].version;
  say(text);
  if (clock.paused) clock.setPaused(false);
}
WB.onSegments(set);
document.querySelector('[data-act="flush"]').addEventListener("click", flushRack);
document.querySelector('[data-act="change"]').addEventListener("click", changeRecord);
document.querySelector('[data-act="reset"]').addEventListener("click", resetCounts);
pauseBtn.addEventListener("click", () => clock.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); clock.toggle(); } });

// ---------- experiments ----------
const pct = (x) => Math.round(100 * x) + "%";
const secs = (x) => x.toFixed(2) + " s";
const SEEDS = [3, 5, 7, 11, 13, 17];
const avg = (o) => average({ warm: 300, n: 1500, ...o }, SEEDS);
function windowWait(o, from, to) {
  let sum = 0; const seeds = Array.from({ length: 120 }, (_, i) => i + 1);
  for (const seed of seeds) { const r = runHeadless({ ttl: 60, warm: 300, n: to, seed, ...o }); sum += r.log.slice(from, to).reduce((a, x) => a + x.time, 0) / (to - from); }
  return sum / seeds.length;
}
function staleShare(invalidate) {
  let stale = 0, reads = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const r = runHeadless({ ttl: 60, warm: 300, n: 30, seed, invalidate, events: [{ at: 0, do: "change", record: 1 }] });
    const l = r.log.filter((x) => x.record === 1 && x.hit); reads += l.length; stale += l.filter((x) => x.stale).length;
  }
  return reads ? stale / reads : 0;
}
const base = () => avg({ ttl: 60 });
const RUNS = {
  ttl: () => { const a = base(), b = avg({ ttl: 6 }); return { verdict: "Hit rate " + pct(a.hitRate) + " → " + pct(b.hitRate) + ", average wait " + secs(a.avgTime) + " → " + secs(b.avgTime) + ".", bars: [["TTL 60 s", a.hitRate, pct(a.hitRate)], ["TTL 6 s", b.hitRate, pct(b.hitRate), true]] }; },
  size: () => { const a = base(), b = avg({ ttl: 60, slots: 4 }); return { verdict: "Room fell to a third; hit rate only fell from " + pct(a.hitRate) + " to " + pct(b.hitRate) + ".", bars: [["12 slots", a.hitRate, pct(a.hitRate)], ["4 slots", b.hitRate, pct(b.hitRate), true]] }; },
  even: () => { const a = base(), b = avg({ ttl: 60, traffic: "even" }); return { verdict: "Hit rate " + pct(a.hitRate) + " → " + pct(b.hitRate) + ", close to 12 of 40 records (30%).", bars: [["Popular traffic", a.hitRate, pct(a.hitRate)], ["Even traffic", b.hitRate, pct(b.hitRate), true]] }; },
  flush: () => { const warm = windowWait({}, 0, 10), first = windowWait({ events: [{ at: 0, do: "flush" }] }, 0, 10), later = windowWait({ events: [{ at: 0, do: "flush" }] }, 10, 30); const top = Math.max(warm, first, later) * 1.1; return { verdict: "The first 10 requests after emptying took " + Math.round(100 * (first / warm - 1)) + "% longer on average; requests 11 to 30 were already back to " + secs(later) + ".", bars: [["Never emptied", warm / top, secs(warm)], ["First 10 after", first / top, secs(first), true], ["Requests 11–30", later / top, secs(later)]] }; },
  stale: () => { const off = staleShare(false), on = staleShare(true); return { verdict: pct(off) + " of rack reads of #1 were stale. With invalidate on write: " + pct(on) + ".", bars: [["Invalidate off", off, pct(off), true], ["Invalidate on", on, pct(on)]] }; },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  set("ttl", w.ttl); set("slots", w.slots); set("traffic", w.traffic); if ("invalidate" in w) set("invalidate", String(w.invalidate));
  resetCounts();
  if (clock.paused) clock.setPaused(false);
  if (w.flush) setTimeout(flushRack, 2500);
  if (w.change) setTimeout(changeRecord, 2500);
} });

paint(); showStats(); applySlots(12);
`;


const size = writePage(new URL("./cache-workbench.html", import.meta.url), {
  title: "Cache Workbench",
  eyebrow: "Systems lesson 01 · Caching",
  lede: "A cache is a small, fast shelf of copies in front of a big, slow store. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
  machine: { intro: "The rack on the right is the cache. The chest on the left is the database. Watch a few requests, then change the settings below and see what the counters do.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results are averaged over 9,000 simulated requests of the same machine; the figure's starting point is a 67% hit rate.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote cache-workbench.html", (size / 1024).toFixed(0) + " KB");

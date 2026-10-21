// Systems lesson 32 · Throttle. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule } from "../../workbench/page.mjs";
import { buildFigure, ballSvg, P, GEOMETRY, GAUGE } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));
const digits = inlineModule(new URL("./digits.js", import.meta.url));
const figureSrc = inlineModule(new URL("./figure.mjs", import.meta.url));
// The live script needs the arm, needle and gap paths from the figure: lift those three functions out of it.
const lift = (name) => { const m = figureSrc.match(new RegExp("function " + name + "\\([\\s\\S]*?\\n}\\n")); if (!m) throw new Error("missing " + name); return m[0]; };

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "scroll",
    title: "Throttle a scroll handler",
    change: "A scroll fires 120 events a second · the handler takes 6 ms · no gate → throttle, 100 ms",
    question: "While the user is scrolling, how often does the handler run with the throttle?",
    options: ["About as often as before: every event still has to be handled", "About 10 times a second: once per 100 ms", "Not at all until the scrolling stops"],
    answer: 1,
    why: "A throttle runs the handler at most once per interval while events keep coming, and drops the events in between. For a scroll position that is exactly right: only the newest position matters, and a screen that updates ten times a second still feels live. The work drops by an order of magnitude and stops competing with scrolling itself.",
    watch: { mode: "throttle", wait: 0.1, edges: "both", input: "scroll", rate: 120 },
  },
  {
    id: "trailing",
    title: "Leading edge only",
    change: "Throttle 100 ms · run on the leading edge only (no trailing call) · scroll in bursts, then stop",
    question: "When the user stops scrolling, does the handler see the position they stopped at?",
    options: ["Yes, always: the throttle saw that event", "Often not: the last events fall inside a closed window and are dropped, so the screen stops short", "Only if the interval is shorter than the scroll"],
    answer: 1,
    why: "Leading-only acts on the first event of each window and drops the rest. The user's final position usually arrives mid-window, so it is dropped and nothing ever comes after it: the screen stays a few pixels behind where the user stopped. A trailing call keeps the newest event waiting and runs it when the window closes, so the final state always lands. Most libraries default to both edges for this reason.",
    watch: { mode: "throttle", wait: 0.1, edges: "lead", input: "scroll", rate: 60 },
  },
  {
    id: "drag",
    title: "Throttle or debounce a drag",
    change: "A steady 3 s drag at 60 events a second · throttle 100 ms → debounce 100 ms",
    question: "How many updates does each give during the drag itself?",
    options: ["About the same: both cut 180 events down to a few dozen", "Throttle about 30 steady updates; debounce none until the drag stops", "Debounce more, because it reacts to every event"],
    answer: 1,
    why: "Debounce waits for a quiet gap: every new event winds its timer back, so during a continuous drag it never fires; it runs once, after the drag ends. That is right for a search box or saving a draft, and wrong for anything that should follow the pointer. Throttle fires on a steady beat during the burst, which is what live feedback needs.",
    watch: { mode: "debounce", wait: 0.1, edges: "both", input: "drag", rate: 60 },
  },
  {
    id: "clicks",
    title: "Throttle the add-to-cart button",
    change: "Bursts of quick clicks, one every 130–220 ms · each click should add one item · throttle 500 ms",
    question: "What happens to the cart?",
    options: ["Every click still adds an item, just spaced out", "Some clicks are dropped and their items never arrive, with no error", "The extra clicks are merged into one bigger order"],
    answer: 1,
    why: "A throttle is lossy by design: it keeps the newest event and drops the others. That is fine when only the latest value matters (a position, a size) and wrong when every event is its own piece of work. For clicks, handle each one (or make the operation idempotent and disable the button while a request is in flight); if you must space them out, queue them, which keeps every item but delivers the last one later and later.",
    watch: { mode: "throttle", wait: 0.5, edges: "both", input: "clicks", rate: 60 },
  },
  {
    id: "interval",
    title: "Pick the interval",
    change: "Scrolling at 120 events a second · throttle interval 16 ms (one frame) → 100 ms → 500 ms",
    question: "What does a longer interval buy, and what does it cost?",
    options: ["A shorter interval is free: always use the smallest", "Less work, but the screen trails further behind the user", "Less work and less lag, because there is less to do"],
    answer: 1,
    why: "The interval is a dial between work and staleness. One call per frame (16 ms, or requestAnimationFrame) follows the input as closely as the screen can show it and still halves the work at 120 events a second. 100 ms cuts the work by ten but the screen can be a tenth of a second behind; 500 ms is cheap and visibly laggy. Pick the longest interval the user won't notice for that kind of feedback.",
    watch: { mode: "throttle", wait: 0.5, edges: "both", input: "scroll", rate: 120 },
  },
];

const QUESTIONS = [
  ["In one sentence each: what does a throttle do, and what does a debounce do? Give one use for each.",
    "A throttle runs the handler at most once per interval while events keep coming (scroll position, pointer tracking, progress updates). A debounce waits until events stop for a quiet interval and then runs once (search-as-you-type, autosave, reacting to the end of a resize)."],
  ["Why do throttles usually fire on both the leading and the trailing edge?",
    "The leading call gives instant feedback on the first event. The trailing call runs the newest event when the window closes, so the final state (where the user stopped) is always handled. Leading-only can leave the screen short of the final position; trailing-only adds a full interval of delay to the first response."],
  ["A teammate throttled the \"Pay\" button to stop double charges. What's wrong with that, and what would you do?",
    "A throttle drops events by design; it can still send two requests (one per window) and it silently swallows clicks the user meant. Disable the button while the request is in flight, and make the server call idempotent (an idempotency key) so a retry or double click can't charge twice."],
  ["Why is requestAnimationFrame a good throttle for anything that draws?",
    "It runs once per frame, right before the browser paints, so work happens at most as often as the screen can show it, in step with rendering, and it pauses in background tabs. Keep the newest event in a variable and read it in the frame callback."],
  ["How is this throttle different from the rate limiter in lesson 05?",
    "A throttle lives in the caller and drops its own redundant work, keeping only the newest event. A rate limiter lives in the server and protects it from many callers: it refuses requests beyond a budget (HTTP 429), and the caller decides whether to retry. One is a courtesy to yourself, the other a defence against everyone."],
  ["A dashboard receives 200 websocket messages a second and re-renders on each one; the tab freezes. How would you fix it without losing data?",
    "Separate receiving from drawing. Apply every message to an in-memory state (no data lost, nothing dropped), and throttle the render to the frame rate or ~10 times a second, always drawing the newest state. If the processing itself is heavy, batch the messages per frame."],
];

// ---------- page ----------
const figure = figurePlate({
  title: "Metronome gate",
  keys: [
    { mark: "lit", label: "A ball let through to the handler; the press at work; the frame showing what the screen shows" },
    { mark: "raised", label: "Event balls: rolling, waiting on the flap, or piled in the discard bin" },
    { mark: "flat", label: "The metronome: one swing per interval; while it swings, the gate stays down" },
  ],
  caption:
    "Balls (events) leave the hopper and roll to the gate. If the metronome is at rest, the first ball goes straight through to the press (the handler) and the metronome starts a swing that keeps the gate down for one interval. While it swings, the newest ball waits on the flap in front of the gate; when another arrives, the waiting one drops through the flap into the bin. When the swing ends, the waiting ball goes through. Counters show events, dropped and handled; the dial shows handler calls per second. On the rail in front, the figure is where the user is and the lit frame is what the screen shows; the dashed line between them is how far behind the screen is.",
  stage: 'data-gate aria-label="Throttle simulation. Space pauses or resumes."',
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">The machine plays in slow motion: at ×1 one second on the page is a tenth of a second of real input. Choose <em>Your hand</em> and hold the button to scroll, or press Click quickly a few times.</p>`;
const controls = panel({
  stats: [["events", "Events"], ["handled", "Handled"], ["dropped", "Dropped"], ["rate", "Calls / s"], ["behind", "Screen behind", "–"], ["waiting", "Waiting", "–"]],
  controls: [
    seg("mode", "Gate", [["off", "No gate"], ["throttle", "Throttle"], ["debounce", "Debounce"], ["queue", "Queue"]], "throttle"),
    seg("wait", "Interval", [[0.016, "16 ms"], [0.1, "100 ms"], [0.25, "250 ms"], [0.5, "500 ms"]], 0.1),
    seg("edges", "Edges", [["both", "Leading + trailing"], ["lead", "Leading only"], ["trail", "Trailing only"]], "both"),
    seg("input", "Input", [["scroll", "Scroll bursts"], ["drag", "Steady drag"], ["clicks", "Clicks"], ["you", "Your hand"]], "scroll"),
    speedSeg(),
    actions("Do something", [["hold", "Hold to scroll"], ["click", "Click"], ["reset", "Start over"], ["pause", "Pause"]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
.cw{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.7}
.dg{fill:none;stroke:var(--anatomy-strong);stroke-width:1.05;stroke-linecap:round;stroke-linejoin:round}
[data-act="hold"]{touch-action:none;user-select:none;-webkit-user-select:none}
[data-act="hold"][data-held]{background:var(--anatomy-strong);color:var(--anatomy-page)}
`;

// ---------- live code ----------
const live = `
${sim}
${digits}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const GAUGE = ${JSON.stringify(GAUGE)};
const railX = (v) => G.RAIL.x0 + 8 + (Math.max(0, Math.min(G.VALUE_MAX, v)) / G.VALUE_MAX) * (G.RAIL.x1 - G.RAIL.x0 - 16);
const k = { iso, pathOf, segment, lineOnTop, onTop, translateAlong };
const at = (p) => iso(p, P);
const ARM = G.ARM, PIVOT = G.PIVOT, RAIL = G.RAIL, LANE_USER = G.LANE_USER;
${lift("armPaths")}
${lift("needlePath")}
${lift("gapPath")}
const BALL_SVG = ${JSON.stringify(ballSvg(false))};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};

const SLOW = 0.1;            // seconds of input per second on the page at ×1
const PRESS = 0.03, HOP = 0.02, PILE_T = 0.5;
const stage = document.querySelector("[data-gate]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const NS = "http://www.w3.org/2000/svg";

function pool(layer, n) {
  return Array.from({ length: n }, () => { const g = document.createElementNS(NS, "g"); g.innerHTML = BALL_SVG; g.style.display = "none"; layer.appendChild(g); return { g, solid: g.firstElementChild, lit: false }; });
}
function slots(layer, list) {
  return list.map((p) => { const g = document.createElementNS(NS, "g"); g.innerHTML = BALL_SVG; g.style.display = "none"; g.setAttribute("transform", translateAlong(P, p)); layer.appendChild(g); return g; });
}
const binLayer = q("[data-bin-balls]"), backLayer = q("[data-balls-back]"), frontLayer = q("[data-balls-front]"), trayLayer = q("[data-tray-balls]");
const binPile = slots(binLayer, G.BIN_SLOTS), trayPile = slots(trayLayer, G.TRAY_SLOTS);
const pools = { bin: pool(binLayer, 10), back: pool(backLayer, 40), front: pool(frontLayer, 14) };
const bladeUp = q("[data-blade-up]"), bladeDown = q("[data-blade-down]"), ram = q("[data-ram]"), rod = q("[data-rod]"), needle = q("[data-needle]"), gap = q("[data-gap]");
const userEl = q("[data-user]"), screenEl = q("[data-screen]");
const ramSolid = ram.querySelector(".iso-solid");
const armEls = { rod: q("[data-arm-rod]"), rodFill: q("[data-arm-rod-fill]"), wt: q("[data-arm-wt]"), wtFill: q("[data-arm-wt-fill]") };

function counter(name) { const c = G.COUNTERS[name]; const cells = counterCells(c); return { c, cells, els: cells.map((_, j) => q('[data-digit="' + name + '-' + j + '"]')), shown: [] }; }
const dials = { events: counter("events"), dropped: counter("dropped"), handled: counter("handled") };
function show(dial, v) { digitsOf(v, dial.c.count).forEach((d, j) => { if (dial.shown[j] !== d) { dial.shown[j] = d; dial.els[j].setAttribute("d", digitPath(iso, P, dial.cells[j], d)); } }); }

const cfg = { mode: "throttle", wait: 0.1, edges: "both", input: "scroll", rate: 60, speed: 1 };
let gate, stream, nextEv, incoming, clock, seed = 3, scan, liveV, liveDir, holding = false, holdNext = 0, bladeOpen = null, needleRate = 0, armAngle = -ARM.swing, callPtr;

function restart() {
  const leading = cfg.edges !== "trail", trailing = cfg.edges !== "lead";
  gate = makeGate({ mode: cfg.mode, wait: cfg.wait, leading, trailing });
  stream = cfg.input === "you" ? null : makeStream(cfg.input, seed++, { rate: cfg.rate });
  nextEv = stream ? stream.next() : null;
  incoming = []; scan = 0; callPtr = 0; liveV = 500; liveDir = 1; holdNext = 0;
  armAngle = -ARM.swing;
  // Start mid-burst so the first frame already shows balls on the track, one waiting and a few dropped.
  clock = cfg.input === "you" ? 0 : cfg.input === "clicks" ? 0.62 : 0.66;
  advance(clock);
  bladeOpen = null;
  paint();
}

function advance(t) {
  while (nextEv && nextEv.t - TRAVEL <= t) { incoming.push(nextEv); nextEv = stream.next(); }
  while (holding && holdNext - TRAVEL <= t) {
    liveV += liveDir * 6.5; if (liveV > 960 || liveV < 40) liveDir = -liveDir;
    incoming.push({ t: holdNext, v: liveV }); holdNext += 1 / 60;
  }
  incoming.sort((a, b) => a.t - b.t);
  while (incoming.length && incoming[0].t <= t) { const e = incoming.shift(); gate.event(e.t, e.v); }
  gate.advance(t);
}

const gateShut = () => cfg.mode !== "off" && gate.timerEnd !== null && gate.timerEnd > clock;
const lastCallT = () => (gate.calls.length ? gate.calls[gate.calls.length - 1].t : -9);
const lerp = (a, b, f) => a + (b - a) * f;

function paint() {
  const used = { bin: 0, back: 0, front: 0 };
  const place = (layer, p, lit) => {
    const pl = pools[layer]; if (used[layer] >= pl.length) return;
    const b = pl[used[layer]++];
    b.g.style.display = ""; b.g.setAttribute("transform", translateAlong(P, p));
    if (b.lit !== lit) { b.lit = lit; b.solid.toggleAttribute("data-lit", lit); }
  };
  const Z = G.BALL_Z, CY = G.CY;
  // Balls still on their way from the hopper; in queue mode they stop at the end of the line.
  const qIndex = new Map(gate.queue.map((i, n) => [i, n]));
  let tail = cfg.mode === "queue" ? gate.queue.length : 0;
  for (const e of incoming) {
    const s = 1 - (e.t - clock) / TRAVEL;
    if (s < 0) continue;
    let x = lerp(G.FEED_X, G.LEDGE_X, Math.min(1, s));
    if (cfg.mode === "queue") x = Math.min(x, G.LEDGE_X - tail++ * G.QUEUE_GAP);
    place("back", [Math.max(G.FEED_X, x), CY, Z], false);
  }
  // Balls that have reached the gate.
  const ev = gate.events;
  while (scan < ev.length && ev[scan].out !== null && clock - ev[scan].out > ROLL + PRESS + HOP + 0.01) scan++;
  for (let i = scan; i < ev.length; i++) {
    const e = ev[i];
    if (e.out === null || e.out > clock) {
      const n = qIndex.has(i) ? qIndex.get(i) : 0;
      place("back", [Math.max(G.FEED_X, G.LEDGE_X - n * G.QUEUE_GAP), CY, Z], false);
      continue;
    }
    const s = clock - e.out;
    if (e.call) {
      if (s < ROLL) { const x = lerp(G.LEDGE_X, G.PRESS_X, s / ROLL); place(x < G.GATE_X + 3 ? "back" : "front", [x, CY, Z], true); }
      else if (s < ROLL + PRESS) place("front", [G.PRESS_X, CY, Z], true);
      else if (s < ROLL + PRESS + HOP) { const f = (s - ROLL - PRESS) / HOP; place("front", [G.PRESS_X, lerp(CY, G.TRAY.y + 7, f), lerp(Z, 4 + G.BALL_R, f) + 6 * Math.sin(Math.PI * f)], false); }
    } else if (s < FALL) {
      const f = s / FALL, z = lerp(Z, 1 + G.BALL_R, f * f), y = lerp(CY, CY + 12, Math.max(0, (f - 0.35) / 0.65));
      place(z > Z - 1.2 ? "back" : "bin", [G.LEDGE_X, y, z], false);
    }
  }
  for (const layer of ["bin", "back", "front"]) for (let i = used[layer]; i < pools[layer].length; i++) pools[layer][i].g.style.display = "none";

  // Piles: what landed in the bin and the tray in the last half second.
  let binN = 0; for (let i = gate.drops.length - 1; i >= 0 && gate.drops[i] + FALL > clock - PILE_T; i--) if (gate.drops[i] + FALL <= clock) binN++;
  let trayN = 0; const fin = ROLL + PRESS + HOP;
  for (let i = gate.calls.length - 1; i >= 0 && gate.calls[i].t + fin > clock - PILE_T; i--) if (gate.calls[i].t + fin <= clock) trayN++;
  binPile.forEach((g, i) => { const on = i < binN; if ((g.style.display !== "none") !== on) g.style.display = on ? "" : "none"; });
  trayPile.forEach((g, i) => { const on = i < trayN; if ((g.style.display !== "none") !== on) g.style.display = on ? "" : "none"; });

  // The gate blade: down while the metronome swings, up for a moment as a ball goes through.
  const open = !gateShut() || clock - lastCallT() < 0.012;
  if (open !== bladeOpen) { bladeOpen = open; bladeUp.style.display = open ? "" : "none"; bladeDown.style.display = open ? "none" : ""; }

  // The metronome: one swing per window; debounce always starts its swing from the left.
  const segs = gate.segs, last = segs[segs.length - 1];
  if (last && cfg.mode !== "off") {
    const dir = cfg.mode === "debounce" ? 1 : (segs.length % 2 ? 1 : -1);
    const p = Math.min(1, (clock - last[0]) / cfg.wait);
    armAngle = clock < last[1] ? dir * (-ARM.swing + 2 * ARM.swing * p) : dir * ARM.swing;
  } else armAngle = -ARM.swing;
  const a = armPaths(armAngle);
  armEls.rod.setAttribute("d", a.rod); armEls.rodFill.setAttribute("d", a.rod); armEls.wt.setAttribute("d", a.wt); armEls.wtFill.setAttribute("d", a.wt);

  // The press: comes down as each handled ball arrives.
  let pressT = -9;
  for (let i = gate.calls.length - 1; i >= 0; i--) { const t = gate.calls[i].t + ROLL; if (t <= clock) { pressT = t; break; } }
  const ps = clock - pressT, down = ps >= 0 && ps < PRESS ? Math.sin(Math.PI * ps / PRESS) : 0;
  const drop = down * (G.RAM.up - G.RAM.down);
  ram.setAttribute("transform", drop ? translateAlong(P, [0, 0, -drop]) : ""); rod.setAttribute("transform", drop ? translateAlong(P, [0, 0, -drop]) : "");
  ramSolid.toggleAttribute("data-lit", down > 0.05);

  // Counters, the gauge.
  show(dials.events, ev.length); show(dials.handled, gate.calls.length); show(dials.dropped, gate.drops.length);
  let recent = 0; for (let i = gate.calls.length - 1; i >= 0 && gate.calls[i].t > clock - 1; i--) recent++;
  const span = Math.min(1, clock);
  const rate = span > 0.05 ? recent / span : 0;
  needleRate += (rate - needleRate) * 0.2;
  needle.setAttribute("d", needlePath(needleRate));

  // The rail: where the user is, and what the screen shows.
  const clicks = cfg.input === "clicks";
  let uv, sv;
  if (clicks) {
    const base = Math.floor(Math.min(ev.length, gate.calls.length) / 30) * 30;
    uv = ((ev.length - base) / 30) * G.VALUE_MAX; sv = ((gate.calls.length - base) / 30) * G.VALUE_MAX;
  } else {
    uv = ev.length ? ev[ev.length - 1].v : (cfg.input === "you" ? liveV : 300);
    sv = gate.handled !== null ? ev[gate.handled].v : uv;
  }
  const ux = railX(uv), sx = railX(sv);
  userEl.setAttribute("transform", translateAlong(P, [ux, 0, 0]));
  screenEl.setAttribute("transform", translateAlong(P, [sx, 0, 0]));
  gap.setAttribute("d", gapPath(sx, ux));

  // Readout and stats.
  const waiting = cfg.mode === "queue" ? gate.queue.length : gate.pending >= 0 ? 1 : 0;
  const newest = ev.length - 1;
  const behindMs = gate.handled === null ? (newest >= 0 ? (clock - ev[0].t) * 1000 : 0) : gate.handled < newest ? (clock - ev[gate.handled + 1].t) * 1000 : 0;
  stat("events", ev.length); stat("handled", gate.calls.length); stat("dropped", gate.drops.length);
  stat("rate", Math.round(rate));
  stat("behind", clicks ? (ev.length - gate.calls.length) + " items" : Math.round(behindMs) + " ms");
  stat("waiting", waiting);
  const shut = gateShut();
  let line;
  if (cfg.mode === "off") line = "no gate · every event runs the handler";
  else if (cfg.mode === "queue") line = (shut ? "gate down · " : "gate up · ") + waiting + " in line · none dropped";
  else if (cfg.mode === "debounce") line = shut ? "waiting for a quiet " + Math.round(cfg.wait * 1000) + " ms · " + (waiting ? "1 on the flap" : "flap empty") : "quiet · handler ran " + gate.calls.length + "×";
  else line = shut ? "gate down for " + Math.max(0, Math.round((gate.timerEnd - clock) * 1000)) + " ms · " + (waiting ? "newest on the flap" : "flap empty") : "gate up · next ball goes straight through";
  if (cfg.input === "you" && !ev.length && !incoming.length) line = "hold the button to scroll";
  say(line);
}
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(key, value) { const el = statEls[key]; const text = String(value); if (el && el.textContent !== text) el.textContent = text; }

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, maxDt: 0.1, step: (dt) => { clock += dt * SLOW * cfg.speed; advance(clock); paint(); }, onPause: (on) => { pauseBtn.textContent = on ? "Play" : "Pause"; if (on) say("paused"); } });

function set(name, raw, quiet) {
  if (name === "speed") { cfg.speed = Number(raw); WB.pressSeg(name, raw); return; }
  if (name === "mode") cfg.mode = raw;
  if (name === "wait") cfg.wait = Number(raw);
  if (name === "edges") cfg.edges = raw;
  if (name === "input") { cfg.input = raw; if (!quiet) cfg.rate = 60; }
  WB.pressSeg(name, raw);
  if (!quiet) restart();
}
WB.onSegments((name, value) => set(name, value));

// Your hand: hold to scroll, click to send one event.
const holdBtn = document.querySelector('[data-act="hold"]');
function toYou() { if (cfg.input !== "you") set("input", "you"); if (loop.paused) loop.setPaused(false); }
function startHold() { toYou(); if (holding) return; holding = true; holdNext = clock + TRAVEL; holdBtn.setAttribute("data-held", ""); }
function stopHold() { holding = false; holdBtn.removeAttribute("data-held"); }
holdBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); holdBtn.setPointerCapture?.(e.pointerId); startHold(); });
holdBtn.addEventListener("pointerup", stopHold);
holdBtn.addEventListener("pointercancel", stopHold);
holdBtn.addEventListener("lostpointercapture", stopHold);
holdBtn.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); startHold(); } });
holdBtn.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") stopHold(); });
holdBtn.addEventListener("blur", stopHold);
document.querySelector('[data-act="click"]').addEventListener("click", () => {
  toYou();
  const t = Math.max(clock + TRAVEL, incoming.length ? incoming[incoming.length - 1].t + 0.001 : 0);
  incoming.push({ t, v: liveV });
});
document.querySelector('[data-act="reset"]').addEventListener("click", () => { stopHold(); restart(); });
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const ms = (x) => Math.round(x * 1000) + " ms";
const one = (x) => (Math.round(x * 10) / 10).toFixed(1);
const pct = (x) => Math.round(100 * x) + "%";
const RUNS = {
  scroll: () => {
    const off = avg({ kind: "scroll", rate: 120, mode: "off" }), thr = avg({ kind: "scroll", rate: 120, mode: "throttle", wait: 0.1 });
    return { verdict: "While scrolling: " + Math.round(off.callsPerSec) + " handler calls a second with no gate, " + Math.round(thr.callsPerSec) + " with the throttle. At 6 ms a call that is " + ms(off.workPerSec) + " of work per second of scrolling against " + ms(thr.workPerSec) + ", and the screen is never more than " + ms(thr.maxLag) + " behind.",
      bars: [["Calls / s, no gate", 1, String(Math.round(off.callsPerSec))], ["Calls / s, throttle 100 ms", thr.callsPerSec / off.callsPerSec, String(Math.round(thr.callsPerSec)), true]] };
  },
  trailing: () => {
    const lead = avg({ kind: "scroll", mode: "throttle", wait: 0.1, trailing: false }), both = avg({ kind: "scroll", mode: "throttle", wait: 0.1 });
    return { verdict: "The handler saw the position the user stopped at in " + pct(lead.finalHandled) + " of bursts with leading only, and " + pct(both.finalHandled) + " with leading + trailing (for " + one(both.callsPerSec - lead.callsPerSec) + " more calls a second).",
      bars: [["Final position handled, leading only", lead.finalHandled, pct(lead.finalHandled), true], ["Final position handled, both edges", both.finalHandled, pct(both.finalHandled)]] };
  },
  drag: () => {
    const thr = avg({ kind: "drag", mode: "throttle", wait: 0.1 }), deb = avg({ kind: "drag", mode: "debounce", wait: 0.1 }), top = Math.max(1, thr.duringPerBurst);
    return { verdict: "During each 3 s drag the throttle updated " + Math.round(thr.duringPerBurst) + " times, about every " + ms(3 / Math.max(1, thr.duringPerBurst)) + "; the debounce updated " + Math.round(deb.duringPerBurst) + " times, and once " + ms(0.1) + " after each drag ended.",
      bars: [["Updates during a drag, throttle", thr.duringPerBurst / top, String(Math.round(thr.duringPerBurst))], ["Updates during a drag, debounce", deb.duringPerBurst / top, String(Math.round(deb.duringPerBurst)), true]] };
  },
  clicks: () => {
    const thr = avg({ kind: "clicks", mode: "throttle", wait: 0.5 }), qu = avg({ kind: "clicks", mode: "queue", wait: 0.5 });
    const lost = thr.dropped / thr.n;
    return { verdict: "Throttled: " + Math.round(thr.calls) + " of " + Math.round(thr.n) + " clicks reached the cart; " + pct(lost) + " of the items vanished without an error. Queued at the same pace, every item arrived, but the last one up to " + one(qu.maxDelay) + " s after its click.",
      bars: [["Items lost, throttle", lost, pct(lost), true], ["Items lost, queue", 0, "0%"], ["Longest wait, queue (of 5 s)", Math.min(1, qu.maxDelay / 5), one(qu.maxDelay) + " s"]] };
  },
  interval: () => {
    const rs = [0.016, 0.1, 0.5].map((w) => ({ w, r: avg({ kind: "scroll", rate: 120, mode: "throttle", wait: w }) }));
    const top = Math.max(...rs.map(({ r }) => r.callsPerSec));
    return { verdict: rs.map(({ w, r }) => Math.round(w * 1000) + " ms: " + Math.round(r.callsPerSec) + " calls/s, screen up to " + ms(r.maxLag) + " behind").join(" · ") + ".",
      bars: rs.flatMap(({ w, r }, n) => [["Calls / s, " + Math.round(w * 1000) + " ms", r.callsPerSec / top, String(Math.round(r.callsPerSec)), n === 2], ["Behind, at worst, " + Math.round(w * 1000) + " ms", Math.min(1, r.maxLag / 0.5), ms(r.maxLag), n === 2]]) };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  stopHold();
  set("mode", w.mode, true); set("wait", String(w.wait), true); set("edges", w.edges, true); set("input", w.input, true);
  cfg.rate = w.rate;
  restart();
  if (loop.paused) loop.setPaused(false);
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./throttle-workbench.html", import.meta.url), {
  title: "Throttle Workbench",
  eyebrow: "Systems lesson 32 · Throttle",
  lede: "Some events arrive far faster than you need to act on them: a scroll or a pointer fires 60 to 120 times a second. A throttle lets the handler run at most once per interval, keeps the newest event and drops the rest. This lesson builds one as a machine: watch it, predict what changes it, then explain it back.",
  machine: { intro: "Event balls roll from the hopper to a gate held by a metronome. One swing is one interval: the first ball goes straight through, the newest one waits on the flap, the rest fall into the bin, and the waiting ball goes through when the swing ends. Watch the rail in front: the frame (what the screen shows) chases the figure (where the user is). Try Leading only, then Debounce, then Clicks.", figure, panel: controls },
  predict: { intro: "Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs of 20 seconds of input.", experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: `Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). The gate follows the usual <code>throttle(fn, wait, { leading, trailing })</code> semantics. Simulation written for this lesson.`,
  css,
  script: live,
});
console.log("wrote throttle-workbench.html", (size / 1024).toFixed(0) + " KB");

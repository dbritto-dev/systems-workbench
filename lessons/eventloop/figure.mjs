// The event loop as a workshop. One operator stands behind one desk (the call stack): frames stack on a
// spindle at the left hand, the microtask tray sits at the right hand, and the conveyor (macrotasks) runs
// into the desk through a gate that stays shut while the tray holds anything. Timers wait in a cabinet
// in front and drop onto the conveyor when due. Behind a partition, four small helpers (the thread pool)
// do I/O and send finished reads down a channel into the conveyor's hopper. A worker bench with its own
// helper can take CPU jobs, and a big lamp should blink every 16 ms.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";
import { sphereOf } from "../../workbench/vendor-anatomy/kit/lathe.mjs";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -170, y: -100, w: 340, d: 184, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// The operator's desk (call stack).
const DESK = { x: -100, y: -30, w: 76, d: 50, r: 3 };
const DESK_TOP = 20;
const OPERATOR = [-68, -44];
const SPINDLE = [-89, -14];
const DISC = { r: 5.4, h: 3 };
export const DEPTH_MAX = 4;
const SPOT = [-68, -4];
const DESK_STRIP = { x0: -94, x1: -56, y: DESK.y + DESK.d, z0: 6, z1: 9.5 };

// The microtask tray, on the desk at the operator's right hand.
const TRAY = { x: -54, y: -25, w: 26, d: 38, r: 2 };
const TRAY_Z = DESK_TOP;
const TRAY_H = 2.5;
export const MICRO_SLOTS = 6;
const microXY = (i) => [-47.5 + (i % 2) * 13, -15 + Math.floor(i / 2) * 11];

// The conveyor (macrotask queue) runs from the hopper into the desk.
const BELT = { x: -22, y: -17, w: 152, d: 24, r: 2 };
const BELT_TOP = 8;
export const BELT_SLOTS = 11;
const beltX = (i) => -3 + i * 12.4;
const BELT_CY = BELT.y + BELT.d / 2;
const GATE_X = -13;
const HOPPER = { x: 130, y: -22, w: 20, d: 34, r: 2 };
const HOPPER_H = 15;

// Behind the partition: four helpers (thread pool) and the channel to the hopper.
export const HELPERS = 4;
const benchPlan = (i) => ({ x: 16 + i * 29, y: -86, w: 23, d: 21, r: 2 });
const BENCH_TOP = 10;
const WALL = { y: -54, d: 4, h: 18 };
const WALL_GAP = [133, 149];
const CHANNEL = { y: -63, d: 7 };
const DROP = { x: 136, w: 10 };

// In front: the timer cabinet, its chute onto the conveyor and the due dial.
const CAB = { x: 62, y: 30, w: 64, d: 30, r: 3 };
const CAB_TOP = 18;
export const TIMER_SLOTS = 6;
const timerXY = (i) => [70 + i * 9.8, 45];
const CHUTE = { x: 108, w: 11 };
export const DIAL = [148, 46];
export const DIAL_R = 13;
export const DIAL_TOP = 14;

// The worker thread: its own bench and its own helper.
const WORKER = { x: -156, y: 34, w: 48, d: 30, r: 3 };
const WORKER_TOP = 12;

const LAMP = [-140, -22];
const LAMP_Z = 14;
const BULB_R = 10;

export const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [OPERATOR[0], OPERATOR[1], 56],
    [LAMP[0], LAMP[1], LAMP_Z + BULB_R + 4],
    [SPINDLE[0], SPINDLE[1], DESK_TOP + DEPTH_MAX * DISC.h + 10],
  ],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const top = (a, b, z) => k.lineOnTop(a, b, z, P);

// ---------- a pawn: one person ----------
function pawn(x, y, z, s, tone = "mid") {
  const out = [S(k.cylinder(x, y, 7 * s, z, 2.6 * s, P, 32, 0.5 * s), { tone })];
  out.push(S(k.cylinder(x, y, 4.3 * s, z + 2.6 * s, 20 * s, P, 28), { tone, crease: "none" }));
  out.push(S(k.cylinder(x, y, 6 * s, z + 22.6 * s, 2.2 * s, P, 28, 0.4 * s), { tone }));
  out.push(S(sphereOf([x, y, z + 30 * s], 5.4 * s, P), { tone: "hi", crease: "lo" }));
  return out.join("");
}

// ---------- tokens: one shape per kind of work ----------
const shape = {
  // a puck with a clock hand
  timer: (x, y, z, lit) => S(k.cylinder(x, y, 4.2, z, 3.2, P, 24, 0.3), { tone: "hi", crease: "lo", lit })
    + L(k.ring(x, y, 2.9, z + 3.2, P, 20) + top([x, y], [x + 1.6, y - 2], z + 3.2), { tone: lit ? "mid" : "lo" }),
  // a flat tile with an envelope flap
  io: (x, y, z, lit) => S(k.slabOf({ x: x - 4.6, y: y - 4.6, w: 9.2, d: 9.2, r: 1 }, z, 2.8, P, 2, 0.3), { tone: "hi", crease: "lo", lit })
    + L(top([x - 3.4, y - 3.4], [x, y + 0.6], z + 2.8) + top([x + 3.4, y - 3.4], [x, y + 0.6], z + 2.8), { tone: lit ? "mid" : "lo" }),
  // a tall block
  cpu: (x, y, z, lit) => S(k.slabOf({ x: x - 4.6, y: y - 4.6, w: 9.2, d: 9.2, r: 1 }, z, 8, P, 2, 0.3), { tone: "hi", crease: "lo", lit })
    + L(k.sideSeam({ x: x - 4.6, y: y - 4.6, w: 9.2, d: 9.2, r: 1 }, z + 4, P, 2), { tone: "faint" }),
  // a small thin disc
  promise: (x, y, z, lit) => S(k.cylinder(x, y, 3.4, z, 1.8, P, 20, 0.2), { tone: "hi", crease: "lo", lit }),
  frame: (x, y, z, lit) => S(k.slabOf({ x: x - 5, y: y - 3.5, w: 10, d: 7, r: 0.8 }, z, 1.2, P, 2), { tone: "hi", crease: "none", lit }),
};
const slot = (name, x, y, z, kinds, lit = false) => `<g data-slot="${name}" data-kind="">${kinds.map((kind) => `<g data-k="${kind}">${shape[kind](x, y, z, lit)}</g>`).join("")}</g>`;

// ---------- the plate ----------
function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -96, y: 72, w: 96, d: 7, r: 1 })
    + labelPlate(P, { x: 12, y: 64, w: 40, d: 16, r: 1.5 }, [[17, 68.5, 24], [17, 72, 30], [17, 75.5, 18]]);
}

// ---------- behind the partition: the thread pool ----------
function helpers() {
  const out = [];
  for (let i = 0; i < HELPERS; i++) {
    const p = benchPlan(i);
    out.push(pawn(p.x + p.w / 2, p.y - 6, 0, 0.62));
  }
  for (let i = 0; i < HELPERS; i++) {
    const p = benchPlan(i);
    const cx = p.x + p.w / 2, cy = p.y + p.d / 2;
    out.push(S(k.slabOf(p, 0, BENCH_TOP, P, 3, 0.5), { tone: "mid" }));
    out.push(L(k.planOutline({ x: cx - 6.5, y: cy - 6.5, w: 13, d: 13, r: 1 }, BENCH_TOP, P, 2), { tone: "lo" }));
    const fy = p.y + p.d;
    out.push(L(k.faceRectY(P, p.x + 3, p.x + p.w - 3, fy, 3, 5.6), { tone: "lo" }));
    out.push(`<path class="bar-fill" data-helper-bar="${i}" d=""/>`);
    out.push(slot(`h${i}`, cx, cy, BENCH_TOP, ["io"]));
  }
  return out.join("");
}
// The channel runs along the benches, turns at the end and passes through the partition into the hopper.
function channel() {
  const run = { x: benchPlan(0).x - 2, y: CHANNEL.y, w: DROP.x + DROP.w - benchPlan(0).x + 2, d: CHANNEL.d, r: 1 };
  const drop = { x: DROP.x, y: CHANNEL.y, w: DROP.w, d: HOPPER.y - CHANNEL.y, r: 1 };
  const out = [S(k.slabOf(run, 0, 4, P, 2), { tone: "mid" }), L(top([run.x + 2, run.y + run.d / 2], [DROP.x + DROP.w / 2, run.y + run.d / 2], 4), { tone: "faint" })];
  out.push(S(k.slabOf(drop, 0, 4, P, 2), { tone: "mid" }), L(top([DROP.x + DROP.w / 2, CHANNEL.y + CHANNEL.d / 2], [DROP.x + DROP.w / 2, HOPPER.y], 4), { tone: "faint" }));
  return out.join("");
}
function wall() {
  const seg = (x0, x1) => S(k.slabOf({ x: x0, y: WALL.y, w: x1 - x0, d: WALL.d, r: 0.6 }, 0, WALL.h, P, 2, 0.4), { tone: "mid", inner: L(k.sideSeam({ x: x0, y: WALL.y, w: x1 - x0, d: WALL.d, r: 0.6 }, WALL.h - 4, P, 2), { tone: "faint" }) });
  return seg(-6, WALL_GAP[0]) + seg(WALL_GAP[1], 164);
}

// ---------- the loop's own parts ----------
// A beacon: a squat housing with a big dome lamp on top, unlike any person on the plate.
function lamp() {
  const [x, y] = LAMP;
  const house = { x: x - 11, y: y - 11, w: 22, d: 22, r: 3 };
  const out = [S(k.slabOf(house, 0, LAMP_Z, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(house, LAMP_Z - 4, P, 4), { tone: "faint" }) })];
  out.push(L(k.faceRectY(P, house.x + 5, house.x + house.w - 5, house.y + house.d, 3, 6), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, BULB_R + 2, LAMP_Z, 2.4, P, 40, 0.4), { tone: "mid" }));
  const bulb = (lit) => S(sphereOf([x, y, LAMP_Z + 5], BULB_R, P), { tone: "hi", crease: "lo", lit });
  out.push(`<g data-lamp="off">${bulb(false)}</g><g data-lamp="on">${bulb(true)}${L(k.ring(x, y, BULB_R + 1, LAMP_Z + 2.4, P, 40), { tone: "lit" })}</g>`);
  return out.join("");
}

function desk() {
  const out = [S(k.slabOf(k.insetPlan(DESK, 2), 0, 3, P, 3, 0.4), { tone: "lo" })];
  out.push(S(k.slabOf(DESK, 3, DESK_TOP - 3, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(DESK, 13, P, 4), { tone: "faint" }) }));
  out.push(L(k.planOutline({ x: SPOT[0] - 7.5, y: SPOT[1] - 7.5, w: 15, d: 15, r: 1.5 }, DESK_TOP, P, 2), { tone: "lo" }));
  out.push(L(k.faceRectY(P, DESK_STRIP.x0, DESK_STRIP.x1, DESK_STRIP.y, DESK_STRIP.z0, DESK_STRIP.z1), { tone: "lo" }));
  out.push(`<path class="bar-fill" data-desk-bar d=""/>`);
  const [sx, sy] = SPINDLE;
  out.push(S(k.cylinder(sx, sy, 6.8, DESK_TOP, 2, P, 32, 0.4), { tone: "mid" }));
  return out.join("");
}
// Frames on the call-stack spindle, built bottom up; live code shows the first `depth` of them.
function spindle() {
  const [sx, sy] = SPINDLE, out = [];
  out.push(S(k.cylinder(sx, sy, 1.1, DESK_TOP + 2, DEPTH_MAX * DISC.h + 7, P, 14), { tone: "mid", crease: "none" }));
  for (let i = 0; i < DEPTH_MAX; i++) out.push(`<g data-frame="${i}" style="display:none">${S(k.cylinder(sx, sy, DISC.r, DESK_TOP + 2 + i * DISC.h, DISC.h - 0.2, P, 28, 0.3), { tone: "hi", crease: "lo", lit: true })}</g>`);
  out.push(S(k.cylinder(sx, sy, 1.8, DESK_TOP + 2 + DEPTH_MAX * DISC.h + 7, 1.4, P, 16), { tone: "mid" }));
  return out.join("");
}
function currentToken() {
  return slot("run", SPOT[0], SPOT[1], DESK_TOP, ["timer", "io", "cpu", "promise", "frame"], true);
}
function tray() {
  const out = [S(k.slabOf(TRAY, TRAY_Z, TRAY_H, P, 3, 0.3), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(TRAY, 2), TRAY_Z + TRAY_H, P, 3), { tone: "lo" }));
  for (let i = 0; i < MICRO_SLOTS; i++) { const [x, y] = microXY(i); out.push(L(k.ring(x, y, 4, TRAY_Z + TRAY_H, P, 20), { tone: "faint" })); }
  return out.join("");
}
function microTokens() {
  return Array.from({ length: MICRO_SLOTS }, (_, i) => i).sort((a, b) => k.depthOf([...microXY(a), 0], P) - k.depthOf([...microXY(b), 0], P))
    .map((i) => slot(`m${i}`, ...microXY(i), TRAY_Z + TRAY_H, ["promise"])).join("");
}

function belt() {
  const out = [S(k.slabOf(BELT, 0, BELT_TOP - 1, P, 3, 0.5), { tone: "mid" })];
  out.push(S(k.slabOf(k.insetPlan(BELT, 2), BELT_TOP - 1, 1, P, 3), { tone: "lo", crease: "none" }));
  // chevrons between the slots point at the desk
  const chev = [];
  for (let i = 0; i < BELT_SLOTS; i++) { const x = beltX(i) + 6.3; chev.push(top([x + 1.6, BELT_CY - 5], [x - 1.2, BELT_CY], BELT_TOP), top([x - 1.2, BELT_CY], [x + 1.6, BELT_CY + 5], BELT_TOP)); }
  out.push(L(chev.join(""), { tone: "faint" }));
  for (const y of [BELT.y - 1.6, BELT.y + BELT.d]) out.push(S(k.slabOf({ x: BELT.x, y, w: BELT.w, d: 1.6, r: 0.4 }, 0, BELT_TOP + 1, P, 2), { tone: "mid", crease: "none" }));
  return out.join("");
}
// The gate at the head of the conveyor: down while the tray holds anything, up otherwise.
function gateBack() {
  return S(k.slabOf({ x: GATE_X - 1.5, y: BELT.y - 2.6, w: 3, d: 3, r: 0.4 }, 0, 14, P, 2), { tone: "mid" });
}
function gateFront() {
  const post = { x: GATE_X - 1.5, y: BELT.y + BELT.d - 0.4, w: 3, d: 3, r: 0.4 };
  const out = [S(k.slabOf(post, 0, 20, P, 2), { tone: "mid" })];
  const down = S(k.slabOf({ x: GATE_X - 1.6, y: BELT.y - 2.6, w: 3.2, d: BELT.d + 5.6, r: 0.5 }, 14, 6, P, 2), { tone: "lo" });
  const up = S(k.slabOf({ x: GATE_X - 1.4, y: post.y + 0.1, w: 2.8, d: 2.8, r: 0.5 }, 20, BELT.d + 4, P, 2), { tone: "lo" });
  out.push(`<g data-gate-arm="down">${down}</g><g data-gate-arm="up">${up}</g>`);
  return out.join("");
}
function beltTokens() {
  return Array.from({ length: BELT_SLOTS }, (_, i) => ({ i, x: beltX(i) }))
    .sort((a, b) => k.depthOf([a.x, BELT_CY, 0], P) - k.depthOf([b.x, BELT_CY, 0], P))
    .map(({ i, x }) => slot(`c${i}`, x, BELT_CY, BELT_TOP, ["timer", "io", "cpu"])).join("");
}
function hopper() {
  return S(k.slabOf(HOPPER, 0, HOPPER_H, P, 3, 0.5), { tone: "mid" })
    + S(k.slabOf(k.insetPlan(HOPPER, 2.5), HOPPER_H - 0.6, 0.6, P, 3), { tone: "lo", crease: "none" });
}

function chute() {
  const plan = { x: CHUTE.x, y: BELT.y + BELT.d + 1.6, w: CHUTE.w, d: CAB.y - (BELT.y + BELT.d + 1.6), r: 1 };
  return S(k.slabOf(plan, 0, 5, P, 2), { tone: "mid" }) + L(top([CHUTE.x + CHUTE.w / 2, CAB.y], [CHUTE.x + CHUTE.w / 2, plan.y], 5), { tone: "faint" });
}
function cabinet() {
  const out = [S(k.slabOf(CAB, 0, CAB_TOP, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(CAB, 9, P, 4), { tone: "faint" }) })];
  const fy = CAB.y + CAB.d;
  out.push(L(k.faceRectY(P, CAB.x + 6, CAB.x + CAB.w - 6, fy, 2.5, 7.5) + k.faceRectY(P, CAB.x + 6, CAB.x + CAB.w - 6, fy, 10.5, 15.5), { tone: "lo" }));
  out.push(L(k.planOutline({ x: CAB.x + 3, y: CAB.y + 8, w: CAB.w - 6, d: 14, r: 1.5 }, CAB_TOP, P), { tone: "lo" }));
  for (let i = 0; i < TIMER_SLOTS; i++) { const [x, y] = timerXY(i); out.push(L(k.ring(x, y, 4.7, CAB_TOP, P, 24), { tone: "faint" })); }
  return out.join("");
}
function timerTokens() {
  return Array.from({ length: TIMER_SLOTS }, (_, i) => slot(`t${i}`, ...timerXY(i), CAB_TOP, ["timer"])).join("");
}
function dial() {
  const [x, y] = DIAL;
  const out = [S(k.cylinder(x, y, DIAL_R + 2.5, 0, 6, P, 56), { tone: "mid" })];
  out.push(S(k.cylinder(x, y, DIAL_R, 6, DIAL_TOP - 6, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, DIAL_R, DIAL_TOP - 3, DIAL_TOP, 60, P, 0.3), { tone: "lo" }));
  out.push(L(k.ring(x, y, DIAL_R - 2, DIAL_TOP, P, 64), { tone: "lo" }));
  const t = k.radialTicks(x, y, DIAL_R - 2.6, 100, 10, DIAL_TOP, [0.9, 2.2], P);
  out.push(L(t.minor, { tone: "faint" }), L(t.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.2, DIAL_TOP, P, 16), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([x, y + 6], DIAL_TOP, P, "x"), "ms", { size: 2.4, tone: "lo", anchor: "middle" }));
  // due marks: where on the dial each armed timer comes due (placed by the live code)
  out.push(`<g class="iso-dots" data-tone="lo">${Array.from({ length: 3 }, (_, i) => `<circle data-due="${i}" r="2.3" cx="0" cy="0" style="display:none"/>`).join("")}</g>`);
  return out.join("");
}
export const needleAt = (turn) => {
  const a = turn * Math.PI * 2, [x, y] = DIAL;
  return top([x - Math.sin(a) * 2.4, y + Math.cos(a) * 2.4], [x + Math.sin(a) * (DIAL_R - 3.2), y - Math.cos(a) * (DIAL_R - 3.2)], DIAL_TOP + 0.2);
};

function worker() {
  const out = [pawn(WORKER.x + WORKER.w / 2, WORKER.y - 7, 0, 0.72)];
  out.push(S(k.slabOf(WORKER, 0, WORKER_TOP, P, 4, 0.5), { tone: "mid" }));
  const cx = WORKER.x + WORKER.w / 2, cy = WORKER.y + WORKER.d / 2;
  out.push(L(k.planOutline({ x: cx - 7, y: cy - 7, w: 14, d: 14, r: 1.2 }, WORKER_TOP, P, 2), { tone: "lo" }));
  const fy = WORKER.y + WORKER.d;
  out.push(L(k.faceRectY(P, WORKER.x + 5, WORKER.x + WORKER.w - 5, fy, 4, 6.6), { tone: "lo" }));
  out.push(`<path class="bar-fill" data-worker-bar d=""/>`);
  out.push(slot("w", cx, cy, WORKER_TOP, ["cpu"]));
  out.push(`<g data-worker-cover>${S(k.slabOf(k.insetPlan(WORKER, -0.6), WORKER_TOP, 2.4, P, 4, 0.5), { tone: "lo" })}${L(k.planOutline(k.insetPlan(WORKER, 4), WORKER_TOP + 2.4, P), { tone: "faint" })}</g>`);
  return out.join("");
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "An event loop as a workshop. One operator stands behind one desk, the call stack: frames stack on a spindle at the left hand, the task being run sits in front, and the microtask tray (promise callbacks) is at the right hand. A conveyor of macrotasks (timer pucks, I/O tiles, CPU blocks) runs into the desk through a gate that stays down while the tray holds anything. Timers wait in a cabinet in front and slide onto the conveyor when due; a dial shows when. Behind a partition, four small helpers do I/O and send finished reads down a channel into the conveyor's hopper. A worker bench with its own helper can take CPU jobs, and a big lamp should blink every 16 ms when the loop gets a chance to draw a frame.",
    body: [
      plate(),
      helpers(),
      channel(),
      wall(),
      lamp(),
      pawn(OPERATOR[0], OPERATOR[1], 0, 1.5),
      desk(),
      spindle(),
      currentToken(),
      tray(),
      microTokens(),
      gateBack(),
      belt(),
      beltTokens(),
      gateFront(),
      hopper(),
      worker(),
      chute(),
      cabinet(),
      timerTokens(),
      dial(),
      `<path data-needle class="iso-line" data-tone="lit" data-free="start" d="${needleAt(0)}" style="stroke-width:1.1"/>`,
    ],
  });
}

const helperBar = (i) => { const p = benchPlan(i); return { x0: p.x + 3, x1: p.x + p.w - 3, y: p.y + p.d, z0: 3, z1: 5.6 }; };
export const GEOMETRY = {
  DESK_STRIP,
  helperBars: Array.from({ length: HELPERS }, (_, i) => helperBar(i)),
  workerBar: { x0: WORKER.x + 5, x1: WORKER.x + WORKER.w - 5, y: WORKER.y + WORKER.d, z0: 4, z1: 6.6 },
  dial: { x: DIAL[0], y: DIAL[1], r: DIAL_R, z: DIAL_TOP },
};

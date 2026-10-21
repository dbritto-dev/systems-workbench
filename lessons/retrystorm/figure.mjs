// The ticket office: one window with three service slots, a serpentine line in front of it,
// a waiting garden whose distance from the line is the backoff delay, and a plaza where
// regular clients spend their time between visits. Built with the Anatomy kit (MIT).
import * as k from "../../workbench/kit.mjs";
import { basePlate } from "../../workbench/parts.mjs";

export const WIDTH = 720;
export const HEIGHT = 470;

const PLATE = { x: -172, y: -96, w: 344, d: 192, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// Booth with three windows on its +y face.
const BOOTH = { x: 62, y: -86, w: 98, d: 56, r: 3 };
const BOOTH_TOP = 56;
const FACE_Y = BOOTH.y + BOOTH.d; // -30
export const WINDOWS = [79, 111, 143];
const WIN = { w: 22, z0: 20, z1: 40 };
const LEDGE_Z = 19.5;

// Load gauge on the roof.
const GAUGE = [111, -58];
const GAUGE_R = 17;
const GAUGE_Z = BOOTH_TOP + 3 + 5;
export const GAUGE_MAX = 15; // attempts per second at full scale
export const GAUGE_SPAN = 1.5 * Math.PI;
export const GAUGE_FROM = -0.75 * Math.PI;
const CAPACITY = 3; // three slots, one second each

// The line: four lanes of a serpentine, head nearest the windows.
const LANES = [-6, 10, 26, 42];
const LANE_X = [12, 140];
const STEP = 9.8;
const PER_LANE = Math.round((LANE_X[1] - LANE_X[0]) / STEP) + 1; // 14
export function queueSpot(i) {
  const lane = Math.min(LANES.length - 1, Math.floor(i / PER_LANE));
  const j = Math.min(PER_LANE - 1, i - lane * PER_LANE);
  const x = lane % 2 === 0 ? LANE_X[1] - j * STEP : LANE_X[0] + j * STEP;
  return [x, LANES[lane]];
}
export const QUEUE_SHOWN = LANES.length * PER_LANE;

// The garden: distance from x = 0 is the backoff delay, 9 units per second.
export const PER_SECOND = 9;
const GARDEN_Y = [-80, -22];
const BENCHES = [2, 4, 8];
export const benchX = (delay) => -PER_SECOND * delay;

// Plaza for regulars between visits, and the gate visitors use.
const PLAZA = { x: -150, y: 28, w: 128, d: 54, r: 4 };
export const homeSpot = (i) => [PLAZA.x + 12 + (i % 6) * 21, PLAZA.y + 10 + Math.floor(i / 6) * 17];
export const GATE = [150, 80];

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [BOOTH.x, BOOTH.y, BOOTH_TOP + 12], [BOOTH.x + BOOTH.w, BOOTH.y + BOOTH.d, BOOTH_TOP + 10]],
  WIDTH,
  HEIGHT,
  { pad: 24, azimuth: 50 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const faceRect = (x0, x1, y, z0, z1) => k.faceRectY(P, x0, x1, y, z0, z1);

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H });
}

// The garden ruler: one tick per second, major every two, from the line (0 s) to 16 s.
function garden() {
  const out = [];
  const strip = { x: -150, y: -14, w: 156, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(-144, 0, PER_SECOND, 2, strip.y + 0.8, 0.6, [2, 3.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2.5, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2.5, strip.y + 3.5, 0.6])], { size: 0.45 }));
  out.push(k.faceTextSvg(k.topMatrix([-147, strip.y + 5.6], 0.6, P, "x"), "s", { size: 2.4, tone: "lo", anchor: "middle" }));
  // Garden bed outline.
  out.push(L(k.planOutline({ x: -150, y: GARDEN_Y[0], w: 156, d: GARDEN_Y[1] - GARDEN_Y[0] + 4, r: 4 }, 0, P), { tone: "faint" }));
  // Benches at 2, 4 and 8 seconds: a seat on two legs, long in y.
  for (const delay of [...BENCHES].sort((a, b) => b - a)) {
    const x = benchX(delay) - 6;
    const seat = { x: x - 2.5, y: GARDEN_Y[0] + 4, w: 5, d: 44, r: 1 };
    for (const y of [seat.y + 4, seat.y + seat.d - 6]) out.push(S(k.slabOf({ x: x - 1.6, y, w: 3.2, d: 2, r: 0.4 }, 0, 4, P, 2), { tone: "mid", crease: "none" }));
    out.push(S(k.slabOf(seat, 4, 1.6, P, 2, 0.3), { tone: "mid" }));
    out.push(S(k.slabOf({ x: x - 3.8, y: seat.y, w: 1.3, d: seat.d, r: 0.4 }, 5.6, 5, P, 2), { tone: "mid", crease: "none" }));
  }
  return out.join("");
}

function plaza() {
  const out = [];
  out.push(L(k.planOutline(PLAZA, 0, P), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(PLAZA, 3), 0, P), { tone: "faint" }));
  out.push(L(Array.from({ length: 18 }, (_, i) => homeSpot(i)).map(([x, y]) => k.ring(x, y, 3.2, 0, P, 14)).join(""), { tone: "faint" }));
  return out.join("");
}

function labelPlate() {
  const plan = { x: -40, y: 64, w: 40, d: 18, r: 1.5 };
  const out = [S(k.slabOf(plan, 0, 0.8, P, 4), { tone: "mid", crease: "none" })];
  out.push(L(k.planOutline(k.insetPlan(plan, 1.6), 0.8, P), { tone: "faint" }));
  out.push(L([[-34, 68.5, 22], [-34, 73, 28], [-34, 77.5, 14]].map(([x, y, len]) => k.lineOnTop([x, y], [x + len, y], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([plan.x + 3, plan.y + 3, 0.8]), at([plan.x + plan.w - 3, plan.y + plan.d - 3, 0.8])], { size: 0.45 }));
  return out.join("");
}

// Floor lanes of the line, with stanchion posts at the turns.
function lanes() {
  const out = [];
  const lines = [];
  const edges = [LANES[0] - 8, ...LANES.slice(0, -1).map((y, i) => (y + LANES[i + 1]) / 2), LANES[LANES.length - 1] + 8];
  edges.forEach((y) => lines.push(k.lineOnTop([LANE_X[0] - 6, y], [LANE_X[1] + 6, y], 0, P)));
  lines.push(k.lineOnTop([LANE_X[0] - 6, edges[0]], [LANE_X[0] - 6, edges[edges.length - 1]], 0, P));
  lines.push(k.lineOnTop([LANE_X[1] + 6, edges[0]], [LANE_X[1] + 6, edges[edges.length - 1]], 0, P));
  out.push(L(lines.join(""), { tone: "faint" }));
  const posts = [];
  edges.slice(1, -1).forEach((y, i) => posts.push(i % 2 === 0 ? [LANE_X[0] + 4, y] : [LANE_X[1] - 4, y]));
  return { floor: out.join(""), posts: byDepth(posts) };
}
function post([x, y]) {
  return S(k.cylinder(x, y, 2.6, 0, 1.2, P, 16), { tone: "mid" }) + S(k.cylinder(x, y, 0.9, 1.2, 9, P, 10), { tone: "mid", crease: "none" }) + S(k.cylinder(x, y, 1.5, 10.2, 1.4, P, 12), { tone: "mid" });
}

function booth() {
  const out = [];
  out.push(S(k.slabOf(k.insetPlan(BOOTH, -2), 0, 3, P, 4, 0.5), { tone: "lo" }));
  out.push(S(k.slabOf(BOOTH, 3, BOOTH_TOP - 3, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(BOOTH, 14, P, 4), { tone: "faint" }) }));
  // Windows: a frame and a pane per slot, a ledge under each.
  for (const cx of WINDOWS) {
    out.push(L(faceRect(cx - WIN.w / 2, cx + WIN.w / 2, FACE_Y, WIN.z0, WIN.z1), { tone: "lo" }));
    out.push(L(faceRect(cx - WIN.w / 2 + 2, cx + WIN.w / 2 - 2, FACE_Y, WIN.z0 + 2, WIN.z1 - 2), { tone: "faint" }));
    out.push(S(k.slabOf({ x: cx - 13, y: FACE_Y, w: 26, d: 6, r: 0.8 }, LEDGE_Z - 2.5, 2.5, P, 2, 0.3), { tone: "mid" }));
  }
  // Roof cap and the gauge.
  out.push(S(k.slabOf(k.insetPlan(BOOTH, -3), BOOTH_TOP, 3, P, 4, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BOOTH, 3), BOOTH_TOP + 3, P), { tone: "faint" }));
  out.push(D(k.corners(BOOTH, 3).map(([x, y]) => at([x, y, BOOTH_TOP + 3])), { size: 0.45 }));
  const [gx, gy] = GAUGE;
  out.push(S(k.cylinder(gx, gy, GAUGE_R + 3, BOOTH_TOP + 3, 2, P, 56), { tone: "mid" }));
  out.push(S(k.cylinder(gx, gy, GAUGE_R, BOOTH_TOP + 5, GAUGE_Z - BOOTH_TOP - 5, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(gx, gy, GAUGE_R - 2, GAUGE_Z, P, 64), { tone: "lo" }));
  // Ticks for 0..15 attempts/s, major every 3 (the capacity is the first major).
  const tickD = [], majorD = [];
  for (let v = 0; v <= GAUGE_MAX; v++) {
    const a = GAUGE_FROM + GAUGE_SPAN * (v / GAUGE_MAX);
    const r0 = GAUGE_R - 2.6, r1 = r0 - (v % 3 === 0 ? 2.6 : 1.2);
    const d = k.lineOnTop([gx + Math.sin(a) * r0, gy - Math.cos(a) * r0], [gx + Math.sin(a) * r1, gy - Math.cos(a) * r1], GAUGE_Z, P);
    (v % 3 === 0 ? majorD : tickD).push(d);
  }
  out.push(L(tickD.join(""), { tone: "lo" }), L(majorD.join(""), { tone: "mid" }));
  // Capacity pin on the rim at 3 attempts/s.
  const ca = GAUGE_FROM + GAUGE_SPAN * (CAPACITY / GAUGE_MAX);
  const pin = [gx + Math.sin(ca) * (GAUGE_R + 1.3), gy - Math.cos(ca) * (GAUGE_R + 1.3)];
  out.push(S(k.cylinder(pin[0], pin[1], 1.1, BOOTH_TOP + 5, GAUGE_Z - BOOTH_TOP - 3, P, 12), { tone: "hi", crease: "none" }));
  // Band past capacity: a groove arc on the face from 3 to 15.
  const arc = [];
  for (let i = 0; i <= 40; i++) {
    const a = ca + (GAUGE_FROM + GAUGE_SPAN - ca) * (i / 40);
    arc.push([gx + Math.sin(a) * (GAUGE_R - 7), gy - Math.cos(a) * (GAUGE_R - 7)]);
  }
  out.push(L(k.onTop(arc, GAUGE_Z, P), { tone: "mid", free: true }));
  out.push(L(k.ring(gx, gy, 1.5, GAUGE_Z, P, 16), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([gx, gy + 8], GAUGE_Z, P, "x"), "/s", { size: 2.4, tone: "lo", anchor: "middle" }));
  return out.join("");
}

export const needleAt = (value) => {
  const a = GAUGE_FROM + GAUGE_SPAN * Math.min(1, value / GAUGE_MAX);
  const [gx, gy] = GAUGE;
  return k.lineOnTop([gx - Math.sin(a) * 2.6, gy + Math.cos(a) * 2.6], [gx + Math.sin(a) * (GAUGE_R - 4), gy - Math.cos(a) * (GAUGE_R - 4)], GAUGE_Z + 0.2, P);
};

function gate() {
  const [gx, gy] = GATE;
  const out = [];
  for (const dx of [-12, 12]) out.push(S(k.slabOf({ x: gx + dx - 2, y: gy - 2, w: 4, d: 4, r: 0.8 }, 0, 20, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: gx - 15, y: gy - 3, w: 30, d: 6, r: 1 }, 20, 3, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([gx - 10, gy, 23]), at([gx + 10, gy, 23])], { size: 0.45 }));
  return out.join("");
}

// A client: a turned pawn. Built at the origin; live code moves it.
export function pawnSvg() {
  return S(k.cylinder(0, 0, 3.4, 0, 1.4, P, 18), { tone: "mid" })
    + S(k.cylinder(0, 0, 2.3, 1.4, 6.4, P, 16), { tone: "hi", crease: "none" })
    + S(k.cylinder(0, 0, 2.9, 7.8, 3.2, P, 18, 0.3), { tone: "hi" });
}
// A ticket left behind: a flat card on the floor.
export function ticketSvg(z = 0) {
  return S(k.slabOf({ x: -3.6, y: -2.4, w: 7.2, d: 4.8, r: 0.5 }, z, 0.7, P, 2), { tone: "lo", crease: "none" }) + L(k.lineOnTop([-2.2, 0], [1.6, 0], z + 0.7, P), { tone: "faint", free: true });
}

export const SPOT = {
  window: (i) => [WINDOWS[i], FACE_Y + 9],
  ledge: (i) => [WINDOWS[i], FACE_Y + 3, LEDGE_Z],
};

export function buildFigure() {
  const { floor, posts } = lanes();
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A ticket office on a base plate. At the back, a booth with three service windows and a load gauge on its roof marked at the window's capacity of three per second. In front, a serpentine line. To the left, a waiting garden with benches at 2, 4 and 8 seconds along a ruler: a client who retries with backoff waits at the distance of its delay. At the front left, a plaza where regular clients spend time between visits, and at the front right, a gate where a rush of visitors comes in.",
    body: [
      plate(),
      garden(),
      plaza(),
      labelPlate(),
      floor,
      `<g data-tickets></g>`,
      booth(),
      `<g data-ledge></g>`,
      `<path data-needle class="iso-line" data-tone="lit" data-free="start" d="${needleAt(2)}" style="stroke-width:1.1"/>`,
      posts.map(post).join(""),
      gate(),
      `<g data-people></g>`,
    ],
  });
}

export const GEOMETRY = {
  WINDOWS, QUEUE_SHOWN, PER_SECOND, GARDEN_Y, GATE, LANES, LANE_X, STEP, PER_LANE, FACE_Y, LEDGE_Z,
  GAUGE, GAUGE_R, GAUGE_Z, GAUGE_FROM, GAUGE_SPAN, GAUGE_MAX,
  HOMES: Array.from({ length: 18 }, (_, i) => homeSpot(i)),
  WINDOW_SPOTS: WINDOWS.map((_, i) => SPOT.window(i)),
  LEDGE_SPOTS: WINDOWS.map((_, i) => SPOT.ledge(i)),
};

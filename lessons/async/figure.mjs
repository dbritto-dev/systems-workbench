// A restaurant pass: an order desk (the CPU) with a spike of orders, a permit board (the concurrency limit),
// a pass counter with a ticket rail and a service bell, a kitchen range with 32 burners (the dependency),
// and the waiters who carry orders between them.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) on the workbench layer.
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";

export const WIDTH = 720;
export const HEIGHT = 420;

const PLATE = { x: -172, y: -112, w: 344, d: 222, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const RANGE = { x: 76, y: -106, w: 84, d: 124, r: 2.5 };
const RANGE_H = 22;
export const BURNERS = Array.from({ length: 32 }, (_, i) => ({ x: 87 + (i % 4) * 20.6, y: -78 + Math.floor(i / 4) * 12.2 }));
const QTRAY = { x: 82, y: -102, w: 72, d: 14, r: 1.2 };
export const QUEUE_SHOWN = 14;
export const QUEUE_X = Array.from({ length: QUEUE_SHOWN }, (_, i) => QTRAY.x + 5 + i * 4.6);

const PASS = { x: -98, y: -84, w: 154, d: 24, r: 2 };
const PASS_H = 26;
const RAIL_Y = -72;
const RAIL_Z = 66;
export const RAIL_SHOWN = 24;
export const RAIL_X = Array.from({ length: RAIL_SHOWN }, (_, i) => -86 + i * 5.7);
const BELL = [32, -66];

const BOARD = { x: -158, y: -46, w: 52, d: 5, r: 0.8 };
const BOARD_H = 34;
export const SLOTS = Array.from({ length: 20 }, (_, i) => ({ x: BOARD.x + 5.5 + (i % 10) * 4.5, z: i < 10 ? 25 : 13 }));

const DESK = { x: -164, y: 12, w: 48, d: 40, r: 2.5 };
const DESK_H = 26;
export const PENDING_SHOWN = 20;
const TRAY = { x: 96, y: 50, w: 54, d: 38, r: 2.5 };
export const DONE_SHOWN = 20;
const BIN = { x: 30, y: 56, w: 42, d: 28, r: 1.5 };
export const FAILED_SHOWN = 12;

export const WAITERS = 8;
export const SPOTS = {
  window: [-84, -48, 17.5],
  home: [-84, -14, 17.5],
  desk: [-140, 4],
  asyncHome: [-66, -14],
  pickup: [34, -46],
};

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-94, RAIL_Y, RAIL_Z + 4], [52, RAIL_Y, RAIL_Z + 4], [RANGE.x, RANGE.y, RANGE_H + 8], [BOARD.x, BOARD.y, BOARD_H + 2]],
  WIDTH, HEIGHT, { pad: 22, azimuth: 52 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (items) => [...items].sort((a, b) => k.depthOf(a.at, P) - k.depthOf(b.at, P));

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -152, y: 96, w: 166, d: 7, r: 1 })
    + labelPlate(P, { x: -66, y: 68, w: 40, d: 18, r: 1.5 }, [[-60, 73, 22], [-60, 77.5, 30], [-60, 82, 16]]);
}

function ticketCard(x, y, z) {
  return S(k.slabOf({ x: x - 5, y: y - 3.5, w: 10, d: 7, r: 0.4 }, z, 1, P, 2), { tone: "hi", crease: "none" });
}

function pass() {
  const out = [];
  out.push(S(k.slabOf(k.insetPlan(PASS, 1.5), 0, 3, P, 3, 0.4), { tone: "lo" }));
  out.push(S(k.slabOf(PASS, 3, PASS_H - 5, P, 3, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(PASS, -1.5), PASS_H - 2, 2, P, 3, 0.6), { tone: "hi", crease: "lo" }));
  const front = PASS.y + PASS.d;
  out.push(L([[-92, -44], [-38, 4], [10, 50]].map(([a, b]) => k.faceRectY(P, a, b, front, 6, 18)).join(""), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(PASS, 2.5), PASS_H, P, 3), { tone: "faint" }));
  return out.join("");
}

function railFrame() {
  const out = [];
  for (const x of [-92, 50]) {
    out.push(S(k.cylinder(x, RAIL_Y, 2.8, PASS_H, 1.6, P, 16), { tone: "mid" }));
    out.push(S(k.cylinder(x, RAIL_Y, 1.5, PASS_H + 1.6, RAIL_Z - PASS_H - 1.6, P, 14), { tone: "mid", crease: "none" }));
  }
  out.push(S(k.slabOf({ x: -94.5, y: RAIL_Y - 1.6, w: 147, d: 3.2, r: 0.6 }, RAIL_Z, 3, P, 2, 0.3), { tone: "hi", crease: "lo" }));
  out.push(L(k.segment([-94.5, RAIL_Y + 1.6, RAIL_Z + 1.5], [52.5, RAIL_Y + 1.6, RAIL_Z + 1.5], P), { tone: "faint" }));
  out.push(D([at([-92, RAIL_Y, RAIL_Z + 3]), at([50, RAIL_Y, RAIL_Z + 3])], { size: 0.45 }));
  out.push(D(RAIL_X.map((x) => at([x, RAIL_Y + 1.6, RAIL_Z + 0.6])), { size: 0.35, tone: "lo" }));
  return out.join("");
}

function railTickets() {
  return RAIL_X.map((x, i) => `<g data-rail="${i}" data-off="">`
    + S(k.slabOf({ x: x - 1.1, y: RAIL_Y + 1.6, w: 2.2, d: 1.4, r: 0.3 }, RAIL_Z - 3.5, 4.5, P, 2), { tone: "mid", crease: "none" })
    + S(k.slabOf({ x: x - 2.5, y: RAIL_Y + 3, w: 5, d: 0.8, r: 0.2 }, RAIL_Z - 21, 18, P, 2), { tone: "hi", crease: "none", lit: true })
    + L([RAIL_Z - 8, RAIL_Z - 11, RAIL_Z - 14, RAIL_Z - 17].map((z, j) => k.segment([x - 1.7, RAIL_Y + 3.8, z], [x - 1.7 + [3.4, 2.4, 3, 1.8][j], RAIL_Y + 3.8, z], P)).join(""), { tone: "faint", free: true })
    + `</g>`).join("");
}

function bell() {
  const [x, y] = BELL;
  return S(k.cylinder(x, y, 7.4, PASS_H, 1.4, P, 28, 0.3), { tone: "mid" })
    + `<g data-bell>`
    + S(k.cylinder(x, y, 6.2, PASS_H + 1.4, 3.4, P, 28, 0.3), { tone: "hi", crease: "lo" })
    + S(k.cylinder(x, y, 4, PASS_H + 4.8, 2.4, P, 24, 0.3), { tone: "hi", crease: "lo" })
    + S(k.cylinder(x, y, 1.1, PASS_H + 7.2, 2.8, P, 12), { tone: "mid" })
    + `</g>`;
}

function board() {
  const out = [];
  out.push(S(k.slabOf({ x: BOARD.x - 2, y: BOARD.y - 3, w: BOARD.w + 4, d: BOARD.d + 6, r: 1 }, 0, 3, P, 2, 0.4), { tone: "lo" }));
  out.push(S(k.slabOf(BOARD, 3, BOARD_H - 3, P, 2, 0.5), { tone: "mid" }));
  const face = BOARD.y + BOARD.d;
  out.push(L(SLOTS.map((s) => k.faceRectY(P, s.x - 1.6, s.x + 1.6, face, s.z, s.z + 7)).join(""), { tone: "lo" }));
  out.push(D(SLOTS.map((s) => at([s.x, face, s.z + 8.4])), { size: 0.35, tone: "lo" }));
  out.push(`<g data-tags>` + SLOTS.map((s, i) => `<g data-tag="${i}" data-off="">${S(k.slabOf({ x: s.x - 1.4, y: face, w: 2.8, d: 2.2, r: 0.3 }, s.z + 0.6, 6, P, 2), { tone: "hi", crease: "none", lit: true })}</g>`).join("") + `</g>`);
  out.push(`<g data-blank-row="1" data-off="">${S(k.slabOf({ x: BOARD.x + 26.5, y: face, w: 22.5, d: 0.8, r: 0.3 }, 24, 9, P, 2), { tone: "mid", crease: "none" })}</g>`);
  out.push(`<g data-blank-row="2" data-off="">${S(k.slabOf({ x: BOARD.x + 3.5, y: face, w: 45.5, d: 0.8, r: 0.3 }, 12, 9, P, 2), { tone: "mid", crease: "none" })}</g>`);
  out.push(`<g data-cover data-off="">${S(k.slabOf({ x: BOARD.x + 2, y: face, w: BOARD.w - 4, d: 1, r: 0.4 }, 10, 23, P, 2, 0.3), { tone: "mid" })}${L(k.faceRectY(P, BOARD.x + 6, BOARD.x + BOARD.w - 6, face + 1, 14, 29), { tone: "faint" })}</g>`);
  return out.join("");
}

function range() {
  const out = [];
  out.push(S(k.slabOf(k.insetPlan(RANGE, 2), 0, 3, P, 3, 0.4), { tone: "lo" }));
  out.push(S(k.slabOf(RANGE, 3, RANGE_H - 3, P, 3, 0.8), { tone: "mid", inner: L(k.sideSeam(RANGE, 11, P, 3), { tone: "faint" }) }));
  const front = RANGE.y + RANGE.d, side = RANGE.x + RANGE.w;
  out.push(L(k.faceRectY(P, RANGE.x + 6, RANGE.x + RANGE.w - 6, front, 4, 9) + [[-96, -54], [-46, -4], [4, 12]].map(([a, b]) => k.faceRectX(P, side, a, b, 4, 9)).join(""), { tone: "lo" }));
  out.push(L([0, 1, 2, 3].map((i) => k.sideRing([BURNERS[i].x, front, 16], 1.8, "y", P, 14)).join(""), { tone: "mid" }));
  out.push(D([0, 1, 2, 3].map((i) => at([BURNERS[i].x, front, 16])), { size: 0.45, tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(RANGE, 3), RANGE_H, P), { tone: "faint" }));
  out.push(L(BURNERS.map((b) => k.ring(b.x, b.y, 4.6, RANGE_H, P, 24) + k.ring(b.x, b.y, 2.3, RANGE_H, P, 16)).join(""), { tone: "lo" }));
  out.push(D(BURNERS.map((b) => at([b.x, b.y, RANGE_H])), { size: 0.35, tone: "lo" }));
  out.push(S(k.slabOf(QTRAY, RANGE_H, 2, P, 2, 0.3), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(QTRAY, 1.6), RANGE_H + 2, P, 2), { tone: "lo" }));
  return out.join("");
}

function kitchenQueue() {
  return QUEUE_X.map((x, i) => `<g data-q="${i}" data-off="">${S(k.slabOf({ x: x - 1.6, y: QTRAY.y + 3, w: 3.2, d: 8, r: 0.3 }, RANGE_H + 2, 7, P, 2), { tone: "hi", crease: "none" })}</g>`).join("");
}

function pots() {
  return byDepth(BURNERS.map((b, i) => ({ at: [b.x, b.y, RANGE_H], i, b })))
    .map(({ i, b }) => `<g data-pot="${i}" data-off="">`
      + S(k.cylinder(b.x, b.y, 5, RANGE_H, 6, P, 22, 0.3), { tone: "mid" })
      + L(k.sideArc(b.x, b.y, 5, RANGE_H + 4.6, P, 16), { tone: "faint" })
      + L(k.ring(b.x, b.y, 3.9, RANGE_H + 6, P, 18), { tone: "lo" })
      + D([at([b.x, b.y, RANGE_H + 6])], { size: 0.55, tone: "mid" })
      + `</g>`).join("");
}

function desk() {
  const out = [];
  out.push(S(k.slabOf(k.insetPlan(DESK, 2), 0, 3, P, 3, 0.4), { tone: "lo" }));
  out.push(S(k.slabOf(DESK, 3, DESK_H - 5, P, 3, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(DESK, -1.5), DESK_H - 2, 2, P, 3, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.faceRectY(P, DESK.x + 6, DESK.x + DESK.w - 6, DESK.y + DESK.d, 6, 19), { tone: "lo" }));
  const [sx, sy] = [DESK.x + 15, DESK.y + 20];
  out.push(S(k.cylinder(sx, sy, 3.6, DESK_H, 1.4, P, 18), { tone: "mid" }));
  out.push(`<g data-pending>` + Array.from({ length: PENDING_SHOWN }, (_, i) => `<g data-p="${i}" data-off="">${ticketCard(sx, sy, DESK_H + 1.4 + i * 1.2)}</g>`).join("") + `</g>`);
  out.push(S(k.cylinder(sx, sy, 0.55, DESK_H + 1.4, 28, P, 10), { tone: "mid", crease: "none" }));
  const pad = { x: DESK.x + 28, y: DESK.y + 10, w: 14, d: 20, r: 0.6 };
  out.push(S(k.slabOf(pad, DESK_H, 0.8, P, 2), { tone: "hi", crease: "none" }));
  out.push(L([4, 8, 12].map((dy, j) => k.lineOnTop([pad.x + 2.5, pad.y + dy], [pad.x + 2.5 + [9, 6, 8][j], pad.y + dy], DESK_H + 0.8, P)).join(""), { tone: "lo", free: true }));
  return out.join("");
}

function outTray() {
  const out = [S(k.slabOf(TRAY, 0, 4, P, 3, 0.5), { tone: "mid" }), L(k.planOutline(k.insetPlan(TRAY, 3), 4, P, 3), { tone: "lo" })];
  const [cx, cy] = [TRAY.x + TRAY.w / 2, TRAY.y + TRAY.d / 2];
  out.push(`<g data-done>` + Array.from({ length: DONE_SHOWN }, (_, i) => `<g data-d="${i}" data-off="">`
    + S(k.cylinder(cx, cy, 10.5, 4 + i * 1.5, 1.5, P, 32, 0.3), { tone: "hi", crease: "lo" }) + `</g>`).join("") + `</g>`);
  return out.join("");
}

function rejectBin() {
  const out = [S(k.slabOf(BIN, 0, 2, P, 2, 0.3), { tone: "mid" })];
  out.push(`<g data-failed>` + Array.from({ length: FAILED_SHOWN }, (_, i) => `<g data-f="${i}" data-off="">${ticketCard(BIN.x + 21 + ((i % 3) - 1) * 1.2, BIN.y + 14, 2 + i * 1.15)}</g>`).join("") + `</g>`);
  const wall = (plan) => S(k.slabOf(plan, 2, 12, P, 2, 0.3), { tone: "mid" });
  out.push(wall({ x: BIN.x, y: BIN.y, w: BIN.w, d: 2.4, r: 0.4 }), wall({ x: BIN.x, y: BIN.y, w: 2.4, d: BIN.d, r: 0.4 }));
  out.push(wall({ x: BIN.x + BIN.w - 2.4, y: BIN.y, w: 2.4, d: BIN.d, r: 0.4 }), wall({ x: BIN.x, y: BIN.y + BIN.d - 2.4, w: BIN.w, d: 2.4, r: 0.4 }));
  out.push(L(k.faceRectY(P, BIN.x + 8, BIN.x + BIN.w - 8, BIN.y + BIN.d, 5, 10), { tone: "lo" }));
  return out.join("");
}

// A waiter standing at the origin, optionally holding a tray (empty, or with a plate on it).
export function waiterSvg({ lit = false, tray = false, plate = false } = {}) {
  let s = S(k.cylinder(0, 0, 5.8, 0, 1.4, P, 18), { tone: "mid" })
    + S(k.cylinder(0, 0, 4.6, 1.4, 18, P, 18, 0.3), { tone: "hi", crease: "lo", lit })
    + S(k.cylinder(0, 0, 5.4, 19.4, 1.8, P, 18), { tone: "mid" })
    + S(k.cylinder(0, 0, 3.6, 21.2, 6.2, P, 18, 0.3), { tone: "hi", crease: "lo", lit });
  if (tray) {
    // forearms reach toward the viewer and the tray sits in front of the body
    s += S(k.slabOf({ x: 2.4, y: 2.4, w: 3.2, d: 3.2, r: 0.6 }, 13.4, 1.2, P, 2), { tone: "mid", crease: "none" });
    s += S(k.cylinder(5.6, 5.6, 5.6, 14.6, 1, P, 24, 0.2), { tone: "hi", crease: "lo" });
    if (plate) s += S(k.cylinder(5.6, 5.6, 4, 15.6, 1.2, P, 20, 0.2), { tone: "hi", crease: "lo" }) + S(k.cylinder(5.6, 5.6, 2.3, 16.8, 1.8, P, 16), { tone: "mid" });
  }
  return s;
}

export function buildFigure() {
  const variants = [["idle", {}], ["wait", { lit: true, tray: true }], ["carry", { tray: true, plate: true }], ["frozen", { lit: true }]];
  const waiters = Array.from({ length: WAITERS }, (_, i) => `<g data-waiter="${i}" data-off="">${variants.map(([name, o], j) => `<g data-v="${name}"${j ? ' data-off=""' : ""}>${waiterSvg(o)}</g>`).join("")}</g>`).join("");
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "A restaurant pass on a base plate. On the left, a permit board whose slots limit how many orders may be out at once, and an order desk with a spike of orders still to take. In the middle, the pass counter with a ticket rail and a service bell. On the right, a kitchen range with 32 burners and a tray of tickets waiting for a burner. In front, a tray of delivered plates and a bin of orders that timed out. Waiters move between the desk, the window at the pass and the bell.",
    body: [
      plate(), pass(), railFrame(), `<g data-rail-tickets>${railTickets()}</g>`, bell(), board(),
      `<g data-waiters>${waiters}</g>`,
      range(), `<g data-queue>${kitchenQueue()}</g>`, `<g data-pots>${pots()}</g>`,
      desk(), rejectBin(), outTray(),
    ],
  });
}

export const GEOMETRY = { SPOTS, WAITERS, RAIL_SHOWN, QUEUE_SHOWN, PENDING_SHOWN, DONE_SHOWN, FAILED_SHOWN, SLOTS: SLOTS.length };

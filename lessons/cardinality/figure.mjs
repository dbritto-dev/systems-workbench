// A tally hall. On the left, the service cabinet sends two things out for every request:
//   at the back, a tally card on the metric belt; each distinct combination of label values owns one
//   pigeonhole in the tally wall (a time series). The series counter and a memory dial stand beside the wall,
//   and cards with no hole left drop into the overflow bin at the end of the belt;
//   at the front, the request's trace on the trace belt. A head gate can drop traces as they start; with tail
//   sampling, traces wait in the buffer rack until they finish, then the tail gate keeps errors and slow ones.
//   Kept traces stand as cards in the archive drawer, whose front counts what was kept.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip } from "../../workbench/parts.mjs";
import { digitPath, counterCells, digitsOf } from "./digits.js";

export const WIDTH = 700;
export const HEIGHT = 440;

const PLATE = { x: -138, y: -108, w: 270, d: 172, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// Service cabinet
const APP = { x: -130, y: -84, w: 24, d: 122, r: 2 };
const APP_H = 26;
export const OUT_X = APP.x + APP.w;               // both belts start at the cabinet's right face

// Tally wall: 12 columns × 8 rows of pigeonholes on its front face
export const COLS = 12, ROWS = 8, HOLES = COLS * ROWS;
const WALL = { x: -94, y: -100, w: COLS * 12, d: 10, r: 1 };
const WALL_H = 62;
export const WALL_FRONT = WALL.y + WALL.d;        // -90
export const holeAt = (i) => { const c = i % COLS, r = Math.floor(i / COLS); return { x0: WALL.x + c * 12 + 1, x1: WALL.x + c * 12 + 11, z0: 4 + r * 7, z1: 10 + r * 7, cx: WALL.x + c * 12 + 6 }; };

// Metric belt in front of the wall, running to the overflow bin
export const MBELT = { y: -68, x0: OUT_X, x1: 56, z: 3 };
export const BIN = { x: 60, y: -79, w: 22, d: 22, r: 1.5, h: 9 };
export const BIN_LEVELS = 8;
const BOARD = { x: 86, y: -100, w: 44, d: 8, r: 1 };
const BOARD_H = 34;
export const DIAL = { x: 108, y: -66, r: 11, top: 9 };
export const DIAL_SPAN = { from: -Math.PI * 0.8, span: Math.PI * 1.6, decades: [4, 10] };   // 10 KB … 10 GB

// Trace belt along the front
export const TBELT = { y: 18, x0: OUT_X, x1: 62, z: 3 };
export const HEAD_GATE = -88;
export const TAIL_GATE = 34;
export const DROP_Y = 35;
const BIN_PLAN = (x) => ({ x: x - 7, y: 28, w: 14, d: 12, r: 1.5 });
const RACK = { x: -70, y: 27, w: 84, d: 27, r: 1.5 };
const RACK_H = 2.5;
export const SLOTS = 30;
export const slotAt = (s) => [RACK.x + 6 + (s % 10) * 8, RACK.y + 6.5 + Math.floor(s / 10) * 7, RACK_H];
const ARCH = { x: 68, y: 2, w: 58, d: 40, r: 2 };
const ARCH_H = 20;
export const CARDS = 30;
export const cardAt = (s) => [ARCH.x + 7.5 + (s % 10) * 4.8, ARCH.y + 10 + Math.floor(s / 10) * 9, ARCH_H - 4];

export const TOKEN = { m: 3.4, t: 5, flat: 2, tall: 5.5 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [WALL.x, WALL.y, WALL_H], [WALL.x + WALL.w, WALL.y, WALL_H], [BOARD.x + BOARD.w, BOARD.y, BOARD_H]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 50 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);

// Counters: printed wheels on a front face (constant y), on a thin housing plate.
const PROUD = 1.2;
export const COUNTERS = {
  requests: { x: APP.x + 3.4, y: APP.y + APP.d + PROUD, z: 13, w: 3.4, h: 5.4, gap: 0.5, count: 5, size: "s", housing: { x: APP.x + 2.2, z0: 11.8, z1: 19.6 } },
  series: { x: BOARD.x + 5.5, y: BOARD.y + BOARD.d + PROUD, z: 7, w: 5, h: 8, gap: 0.8, count: 6, size: "m", housing: { x: BOARD.x + 3.5, z0: 5, z1: 17 } },
  kept: { x: ARCH.x + 36.8, y: ARCH.y + ARCH.d + PROUD, z: 11.5, w: 3.8, h: 5.4, gap: 0.5, count: 4, size: "s", housing: { x: ARCH.x + 35.4, z0: 10.3, z1: 18.1 } },
  errors: { x: ARCH.x + 16.5, y: ARCH.y + ARCH.d + PROUD, z: 2.6, w: 3.6, h: 5.4, gap: 0.5, count: 3, size: "s", housing: { x: ARCH.x + 15.2, z0: 1.4, z1: 9.2 } },
  errorsKept: { x: ARCH.x + 40.5, y: ARCH.y + ARCH.d + PROUD, z: 2.6, w: 3.6, h: 5.4, gap: 0.5, count: 3, size: "s", housing: { x: ARCH.x + 39.2, z0: 1.4, z1: 9.2 } },
};
const housingW = (c) => 2 * (c.x - c.housing.x) + c.count * c.w + (c.count - 1) * c.gap;

function counter(c, name, value = 0) {
  const out = [];
  if (c.housing) out.push(S(k.slabOf({ x: c.housing.x, y: c.y - PROUD, w: housingW(c), d: PROUD, r: 0.4 }, c.housing.z0, c.housing.z1 - c.housing.z0, P, 2), { tone: "hi", crease: "lo" }));
  const digits = digitsOf(value, c.count);
  counterCells(c).forEach((cell, j) => {
    out.push(`<path class="cw" d="${k.faceRectY(P, cell.x, cell.x + cell.w, cell.y, cell.z, cell.z + cell.h)}"/>`);
    out.push(`<path class="dg" data-size="${c.size}" data-digit="${name}-${j}" d="${digitPath(k.iso, P, cell, digits[j])}"/>`);
  });
  return out.join("");
}
// Text printed on a front face (constant y), reading left to right.
const printed = (x, y, z, text, size = 2.5, tone = "mid", extra = "") =>
  `<text class="iso-face-text" ${extra} data-tone="${tone}" transform="${k.sideMatrix([x, y], z, P, "left")}" font-size="${size}">${text}</text>`;

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H }) + rulerStrip(P, { x: -96, y: 56, w: 92, d: 5, r: 1 });
}

function service() {
  const out = [S(k.slabOf(APP, 0, APP_H, P, 3, 0.6), { tone: "mid" })];
  const fy = APP.y + APP.d;
  // vents on the right face and the two outlets
  const vents = [];
  for (let i = 0; i < 9; i++) { const y = APP.y + 10 + i * 4; vents.push(k.pathOf([at([OUT_X, y, 15]), at([OUT_X, y, 22])])); }
  out.push(L(vents.join(""), { tone: "lo" }));
  for (const y of [MBELT.y, TBELT.y]) out.push(L(k.pathOf([[OUT_X, y - 5, 1], [OUT_X, y + 5, 1], [OUT_X, y + 5, 9], [OUT_X, y - 5, 9]].map(at), true), { tone: "lo" }));
  out.push(counter(COUNTERS.requests, "requests"));
  out.push(printed(APP.x + 2.4, fy, 8.2, "REQUESTS", 2.6, "mid"));
  out.push(k.dotsSvg([at([APP.x + 4, fy, 23]), at([APP.x + 7, fy, 23])], { size: 0.6, tone: "lo" }));
  return out.join("");
}

function belt(b, y) {
  const plan = { x: b.x0, y: y - 4, w: b.x1 - b.x0, d: 8, r: 1 };
  const out = [S(k.slabOf(plan, 0, b.z, P, 3, 0.3), { tone: "lo" })];
  const marks = [];
  for (let x = b.x0 + 5; x < b.x1 - 2; x += 6) marks.push(k.lineOnTop([x, y - 3.2], [x, y + 3.2], b.z, P));
  out.push(L(marks.join(""), { tone: "faint" }));
  return out.join("");
}

function wall() {
  const out = [S(k.slabOf(WALL, 0, WALL_H, P, 2, 0.5), { tone: "hi", crease: "lo" })];
  for (let i = 0; i < HOLES; i++) {
    const h = holeAt(i);
    out.push(`<g data-hole="${i}"><path class="hole" d="${k.faceRectY(P, h.x0, h.x1, WALL_FRONT, h.z0, h.z1)}"/><path class="hole-card" d="${k.faceRectY(P, h.x0 + 1.4, h.x1 - 1.4, WALL_FRONT, h.z0 + 0.9, h.z1 - 0.9)}"/></g>`);
  }
  return out.join("");
}

function board() {
  const out = [S(k.slabOf(BOARD, 0, BOARD_H, P, 2, 0.5), { tone: "mid" })];
  out.push(counter(COUNTERS.series, "series", 0));
  out.push(printed(BOARD.x + 4, BOARD.y + BOARD.d, 23, "SERIES", 3, "mid"));
  return out.join("");
}

function overflowBin() {
  const { x, y, w, d, h } = BIN;
  const out = [openBin(BIN, h)];
  for (let lv = 1; lv <= BIN_LEVELS; lv++) {
    const top = h - 1 + lv * 1.6;
    out.push(`<g data-bin="${lv}" style="display:none">${S(k.slabOf({ x: x + 2.6, y: y + 2.6, w: w - 5.2, d: d - 5.2, r: 0.6 }, h - 1.4, top - (h - 1.4), P, 2), { tone: "hi", crease: "lo" })}</g>`);
  }
  return out.join("");
}

// An open-topped bin: walls, and a dark floor seen through the opening.
function openBin(plan, h) {
  const inner = k.insetPlan(plan, 1.5);
  return S(k.slabOf(plan, 0, h, P, 3, 0.4), { tone: "mid" })
    + `<path class="bin-hole" d="${k.planOutline(inner, h, P, 3)}"/>`
    + L(k.planOutline(inner, h, P, 3), { tone: "lo" });
}

function dial() {
  const { x, y, r, top } = DIAL;
  const out = [S(k.cylinder(x, y, r + 2.2, 0, 4, P, 48), { tone: "mid" })];
  out.push(S(k.cylinder(x, y, r, 4, top - 4, P, 56, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(x, y, r - 1.6, top, P, 56), { tone: "lo" }));
  const n = (DIAL_SPAN.decades[1] - DIAL_SPAN.decades[0]) * 3;
  const t = k.radialTicks(x, y, r - 2, n, 3, top, [0.8, 2.2], P, DIAL_SPAN.from, DIAL_SPAN.span);
  out.push(L(t.minor, { tone: "faint" }), L(t.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.1, top, P, 14), { tone: "mid" }));
  out.push(`<path class="needle" data-needle d="${needleAt(0)}"/>`);
  return out.join("");
}
export function needleAt(turn) {
  const a = DIAL_SPAN.from + Math.max(0, Math.min(1, turn)) * DIAL_SPAN.span;
  const { x, y, r, top } = DIAL;
  return k.lineOnTop([x - Math.sin(a) * 2, y + Math.cos(a) * 2], [x + Math.sin(a) * (r - 2.6), y - Math.cos(a) * (r - 2.6)], top + 0.2, P);
}

// A gate over the trace belt: back post (behind the tokens) and front post + beam (in front of them).
function gateBack(x, name) {
  return `<g data-gate="${name}">${S(k.slabOf({ x: x - 1.2, y: TBELT.y - 7.2, w: 2.4, d: 2.4, r: 0.4 }, 0, 16, P, 2), { tone: "mid", crease: "none" })}</g>`;
}
function gateFront(x, name, text) {
  const out = [`<g data-gate="${name}">`, S(k.slabOf({ x: x - 1.2, y: TBELT.y + 4.8, w: 2.4, d: 2.4, r: 0.4 }, 0, 16, P, 2), { tone: "mid", crease: "none" })];
  out.push(S(k.slabOf({ x: x - 6, y: TBELT.y - 7.6, w: 12, d: 15.2, r: 0.6 }, 16, 5, P, 2, 0.3), { tone: "hi", crease: "lo" }));
  out.push(S(k.slabOf({ x: x - 0.5, y: TBELT.y - 4, w: 1, d: 8, r: 0.3 }, 7.5, 8.5, P, 2), { tone: "lo", crease: "none" }));
  out.push(printed(x - 5, TBELT.y + 7.6, 17.2, text, 3, "hi", `data-gate-text="${name}"`));
  out.push(`</g>`);
  return out.join("");
}
function dropBin(x, name) {
  const plan = BIN_PLAN(x);
  return `<g data-gate="${name}">${openBin(plan, 6)}</g>`;
}

function rack() {
  const out = [S(k.slabOf(RACK, 0, RACK_H, P, 3, 0.3), { tone: "mid" })];
  const rings = [];
  for (let s = 0; s < SLOTS; s++) { const [x, y] = slotAt(s); rings.push(k.planOutline({ x: x - 3, y: y - 3, w: 6, d: 6, r: 0.8 }, RACK_H, P, 2)); }
  out.push(L(rings.join(""), { tone: "lo" }));
  out.push(`<g data-rack-cover style="display:none">${S(k.slabOf(k.insetPlan(RACK, 1), RACK_H, 1, P, 3, 0.3), { tone: "hi", crease: "lo" })}</g>`);
  return out.join("");
}

function archive() {
  const out = [S(k.slabOf(ARCH, 0, ARCH_H, P, 4, 0.6), { tone: "mid", inner: L(k.planOutline({ x: ARCH.x + 3.5, y: ARCH.y + 4, w: ARCH.w - 7, d: ARCH.d - 8, r: 1 }, ARCH_H, P, 3), { tone: "lo" }) })];
  // drawer floor
  out.push(S(k.slabOf({ x: ARCH.x + 4, y: ARCH.y + 4.5, w: ARCH.w - 8, d: ARCH.d - 9, r: 0.8 }, ARCH_H - 4.2, 0.2, P, 2), { tone: "lo", crease: "none" }));
  for (let s = 0; s < CARDS; s++) {
    const [x, y, z] = cardAt(s);
    out.push(`<g data-card="${s}" style="display:none">${S(k.slabOf({ x: x - 1.9, y: y - 0.6, w: 3.8, d: 1.2, r: 0.2 }, z, 6.5, P, 1), { tone: "hi", crease: "lo" })}</g>`);
  }
  const fy = ARCH.y + ARCH.d;
  out.push(printed(ARCH.x + 4, fy, 13, "TRACES KEPT", 2.6, "mid"));
  out.push(counter(COUNTERS.kept, "kept"));
  out.push(printed(ARCH.x + 4, fy, 4, "ERRORS", 2.6, "mid"));
  out.push(printed(ARCH.x + 31, fy, 4, "KEPT", 2.6, "mid"));
  out.push(counter(COUNTERS.errors, "errors"));
  out.push(counter(COUNTERS.errorsKept, "errorsKept"));
  return out.join("");
}

// Tokens drawn at the origin and moved with translateAlong: a tally card and a trace (flat, or tall when slow).
export function tokenSvg() {
  const m = TOKEN.m, t = TOKEN.t;
  return {
    metric: S(k.slabOf({ x: -m / 2, y: -m / 2, w: m, d: m, r: 0.4 }, 0, 1.4, P, 2), { tone: "hi", crease: "lo" }),
    flat: S(k.slabOf({ x: -t / 2, y: -t / 2, w: t, d: t, r: 0.6 }, 0, TOKEN.flat, P, 2, 0.2), { tone: "hi", crease: "lo" }),
    tall: S(k.slabOf({ x: -t / 2, y: -t / 2, w: t, d: t, r: 0.6 }, 0, TOKEN.tall, P, 2, 0.2), { tone: "hi", crease: "lo" }),
  };
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A tally hall on a base plate. A service cabinet on the left sends a tally card up a belt at the back for every request; each distinct combination of label values owns one pigeonhole in a 12 by 8 tally wall, a series counter and a memory dial stand beside it, and cards with no hole left fall into an overflow bin. Along the front, each request's trace rides a second belt through a head gate, a buffer rack and a tail gate, each gate with a drop bin; traces that are kept stand as cards in an archive drawer whose front counts traces kept, errors and errors kept. Error traces are lit.",
    body: [
      plate(),
      wall(),
      board(),
      service(),
      belt(MBELT, MBELT.y),
      overflowBin(),
      `<g data-mtokens></g>`,
      dial(),
      belt(TBELT, TBELT.y),
      gateBack(HEAD_GATE, "head"),
      gateBack(TAIL_GATE, "tail"),
      rack(),
      dropBin(HEAD_GATE, "head"),
      dropBin(TAIL_GATE, "tail"),
      archive(),
      `<g data-ttokens></g>`,
      gateFront(HEAD_GATE, "head", "HEAD"),
      gateFront(TAIL_GATE, "tail", "TAIL"),
    ],
  });
}

export const GEOMETRY = { OUT_X, COLS, ROWS, HOLES, WALL_FRONT, MBELT, BIN, BIN_LEVELS, DIAL, DIAL_SPAN, TBELT, HEAD_GATE, TAIL_GATE, DROP_Y, SLOTS, CARDS, TOKEN, COUNTERS,
  holes: Array.from({ length: HOLES }, (_, i) => holeAt(i)), slots: Array.from({ length: SLOTS }, (_, s) => slotAt(s)), cards: Array.from({ length: CARDS }, (_, s) => cardAt(s)) };

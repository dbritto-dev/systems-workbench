// A small library: bookcases along the back (the table), card catalogue cabinets at the front (the indexes),
// a book trolley that does the reading, and a desk with a stopwatch. Built with the Anatomy kit (MIT).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip } from "../../workbench/parts.mjs";
import { INDEXES } from "./sim.js";

export const WIDTH = 720;
export const HEIGHT = 470;

const PLATE = { x: -172, y: -104, w: 344, d: 200, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

export const CASE = { w: 34, d: 16, h: 62, y0: -92 };
export const CASES = Array.from({ length: 8 }, (_, i) => ({ x0: -150 + i * 36, cx: -150 + i * 36 + 17 }));
export const LEVELS = [3, 17, 31, 45];
const LEVEL_TOP = 59;
export const BOOK = { w: 3, d: 10, h: 11 };

export const CAB = { w: 34, d: 24, h: 28, y0: -6 };
export const CABS = INDEXES.map((index, i) => ({ id: index.id, x0: -112 + i * 40, cx: -112 + i * 40 + 17 }));
export const CAB_NAMES = { isbn: ["ISBN"], author: ["AUTHOR"], authorYear: ["AUTHOR", "+ YEAR"], loan: ["ON LOAN"], authorTitle: ["AUTHOR", "+ TITLE"] };
// The top drawer of every cabinet stands open: a tray of sorted cards, its tabs stepping across like A to Z.
export const TRAY = { out: 14, z0: 20, h: 6, cards: 8, gap: 1.3, cardH: 6.6, slot: 11.6, rise: 9 };
const CAB_FRONT = CAB.y0 + CAB.d;

export const HOME = [-146, 58];
export const AISLE_X = -146;
export const CAB_STOP_Y = 52;
export const SHELF_LANE_Y = -62;
export const DESK = { x: 108, y: 28, w: 56, d: 28, h: 24 };
export const DIAL = { x: 136, y: 41, r: 9.5, z: 28 };
export const IN_TRAY = { x: 114, y: 32, w: 16, d: 13 };
export const COUNTER = { x: 108, y: -46, w: 56, d: 28, h: 5 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [CASES[0].x0, CASE.y0, CASE.h + 1], [CASES[7].x0 + CASE.w, CASE.y0, CASE.h + 1], [DESK.x + DESK.w, DESK.y, DIAL.z + 4]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (items) => [...items].sort((a, b) => k.depthOf(a.at, P) - k.depthOf(b.at, P));

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -120, y: 82, w: 180, d: 7, r: 1 });
}

// Book blocks per shelf: [left offset, width, height]. Varied so the shelves read as unsorted.
const PATTERNS = [
  [[2, 9, 10], [12, 10, 12], [23, 8, 9]],
  [[2, 7, 12], [10, 12, 10], [23, 9, 11]],
  [[2, 11, 9], [14, 8, 12], [23, 9, 10]],
  [[2, 8, 11], [11, 9, 9], [21, 11, 12]],
];

function bookBlock(x, w, z, h) {
  const y0 = CASE.y0 + 3, front = y0 + BOOK.d;
  const spines = [];
  for (let sx = x + 2; sx < x + w - 0.5; sx += 2) spines.push(k.segment([sx, front, z], [sx, front, z + h], P));
  return S(k.slabOf({ x, y: y0, w, d: BOOK.d, r: 0.3 }, z, h, P, 2), { tone: "mid", crease: "none", inner: L(spines.join(""), { tone: "lo" }) });
}

function bookcase(c, index) {
  const out = [];
  const { x0 } = c, y0 = CASE.y0, w = CASE.w;
  out.push(S(k.slabOf({ x: x0, y: y0, w, d: 2, r: 0.4 }, 0, CASE.h, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf({ x: x0, y: y0, w: 2, d: CASE.d, r: 0.4 }, 0, CASE.h, P, 2), { tone: "mid" }));
  LEVELS.forEach((z, level) => {
    out.push(S(k.slabOf({ x: x0 + 2, y: y0 + 2, w: w - 4, d: CASE.d - 2, r: 0.3 }, z - 1.6, 1.6, P, 2), { tone: "mid", crease: "none" }));
    const pattern = PATTERNS[(index + level) % PATTERNS.length];
    for (const [dx, bw, bh] of pattern) out.push(bookBlock(x0 + dx, bw, z, bh));
  });
  out.push(S(k.slabOf({ x: x0, y: y0, w, d: CASE.d, r: 0.6 }, LEVEL_TOP, CASE.h - LEVEL_TOP, P, 3, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: x0 + w - 2, y: y0, w: 2, d: CASE.d, r: 0.4 }, 0, CASE.h, P, 2), { tone: "mid" }));
  out.push(D([at([x0 + 3, y0 + CASE.d - 1, CASE.h]), at([x0 + w - 3, y0 + CASE.d - 1, CASE.h])], { size: 0.4, tone: "lo" }));
  return out.join("") + tag(c, index);
}

// A numbered plaque on top of each bookcase: the shelf number a catalogue card points to. Lit when it is the target.
function tag(c, index) {
  const plan = { x: c.cx - 6.5, y: CASE.y0 + 3, w: 13, d: 10, r: 1 };
  const plaque = S(k.slabOf(plan, CASE.h, 1, P, 3, 0.2), { tone: "mid", crease: "none" });
  const text = k.faceTextSvg(k.topMatrix([c.cx, plan.y + plan.d - 2.2], CASE.h + 1, P, "x"), String(index + 1), { size: 6.4, tone: "mid", anchor: "middle" });
  return `<g class="wb-lit-group" data-tag="${index}">${plaque}${text}</g>`;
}

function cabinet(cab, i) {
  const out = [];
  const plan = { x: cab.x0, y: CAB.y0, w: CAB.w, d: CAB.d, r: 1.2 };
  const front = CAB_FRONT;
  out.push(S(k.slabOf(k.insetPlan(plan, 1.5), 0, 2.4, P, 3), { tone: "lo" }));
  out.push(S(k.slabOf(plan, 2.4, CAB.h - 2.4, P, 3, 0.5), { tone: "mid", inner: L(k.faceRectY(P, cab.x0 + 2, cab.x0 + CAB.w - 2, front, TRAY.z0 - 0.4, TRAY.z0 + TRAY.h + 0.4), { tone: "lo" }) }));
  // Two closed drawers below the open one.
  const rows = [], dots = [];
  for (const z0 of [12.6, 5.4]) {
    rows.push(k.faceRectY(P, cab.x0 + 2, cab.x0 + CAB.w - 2, front, z0, z0 + 6));
    dots.push(at([cab.cx, front, z0 + 3]));
  }
  out.push(L(rows.join(""), { tone: "lo" }), D(dots, { size: 0.55, tone: "mid" }));
  const cap = k.insetPlan(plan, -1);
  out.push(S(k.slabOf(cap, CAB.h, 1.6, P, 3, 0.4), { tone: "mid" }));
  // The index name, engraved on the lid.
  const names = CAB_NAMES[cab.id];
  names.forEach((line, n) => out.push(k.faceTextSvg(k.topMatrix([cab.x0 + 3, CAB.y0 + 9.5 + n * 7.2], CAB.h + 1.6, P, "x"), line, { size: 5.6, tone: "hi" })));
  return `<g data-cab="${i}">${out.join("")}</g>`;
}

// The open drawer: a tray of standing cards, back to front. The lit card (data-card) sits in the front slot.
function tray(cab, i) {
  const out = [];
  const x0 = cab.x0 + 2, x1 = cab.x0 + CAB.w - 2, y0 = CAB_FRONT, y1 = CAB_FRONT + TRAY.out, z0 = TRAY.z0, wall = 4.2;
  out.push(S(k.slabOf({ x: x0, y: y0, w: x1 - x0, d: TRAY.out, r: 0.3 }, z0, 0.8, P, 2), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf({ x: x0, y: y0, w: 1, d: TRAY.out, r: 0.2 }, z0, wall, P, 2), { tone: "mid", crease: "none" }));
  for (let j = 0; j < TRAY.cards; j++) out.push(card(cab.x0 + 4, y0 + 1.2 + j * TRAY.gap, z0 + 0.8, j, false));
  out.push(`<g class="wb-lit-group" data-card="${i}" style="display:none">${card(cab.x0 + 4, y0 + TRAY.slot, z0 + 0.8, 3, true)}${k.faceTextSvg(k.sideMatrix([cab.cx, y0 + TRAY.slot + 0.6], z0 + 0.8 + 1.5, P, "left"), "SHELF 1", { size: 5, tone: "lit", anchor: "middle" })}</g>`);
  out.push(S(k.slabOf({ x: x1 - 1, y: y0, w: 1, d: TRAY.out, r: 0.2 }, z0, wall, P, 2), { tone: "mid", crease: "none" }));
  const face = S(k.slabOf({ x: x0 - 0.4, y: y1 - 1.2, w: x1 - x0 + 0.8, d: 1.2, r: 0.3 }, z0 - 0.2, TRAY.h, P, 2), { tone: "mid" });
  out.push(`<g data-drawer="${i}">${face}</g>`);
  out.push(S(k.slabOf({ x: cab.cx - 3, y: y1, w: 6, d: 1, r: 0.4 }, z0 + 1.8, 1.4, P, 2), { tone: "mid", crease: "none" }));
  return out.join("");
}

// One index card standing in the tray, with its tab stepped across by position (sorted order).
function card(x, y, z, j, lit) {
  const w = CAB.w - 8, tabW = 5, tabX = x + 1 + (j % TRAY.cards) * ((w - tabW - 2) / (TRAY.cards - 1));
  const body = S(k.slabOf({ x, y, w, d: 0.6, r: 0 }, z, TRAY.cardH, P, 1), { tone: lit ? "hi" : "mid", crease: "none", lit });
  const tab = S(k.slabOf({ x: tabX, y, w: tabW, d: 0.6, r: 0 }, z + TRAY.cardH, 1.6, P, 1), { tone: lit ? "hi" : "mid", crease: "none", lit });
  return body + tab;
}

function footprints() {
  const out = [L(CABS.map((cab) => k.planOutline({ x: cab.x0 - 1, y: CAB.y0 - 1, w: CAB.w + 2, d: CAB.d + 2, r: 1.6 }, 0, P, 3)).join(""), { tone: "faint" })];
  // The empty slot keeps the index's name on the floor, so a catalogue you could add still has a place.
  CABS.forEach((cab) => CAB_NAMES[cab.id].forEach((line, n) => out.push(k.faceTextSvg(k.topMatrix([cab.x0 + 3, CAB.y0 + 9.5 + n * 7.2], 0, P, "x"), line, { size: 5.6, tone: "faint" }))));
  return out.join("");
}

// The counter: a plate with an engraved window whose caption and number the live code rewrites.
function counter() {
  const { x, y, w, d, h } = COUNTER;
  const plan = { x, y, w, d, r: 2 };
  const out = [S(k.slabOf(plan, 0, h, P, 4, 0.6), { tone: "mid" })];
  const win = k.insetPlan(plan, 2.6);
  out.push(S(k.slabOf(win, h, 0.4, P, 3), { tone: "lo", crease: "none", flat: true }));
  out.push(L(k.planOutline(win, h + 0.4, P, 3), { tone: "lo" }));
  out.push(`<text data-count-label class="iso-face-text" data-tone="mid" transform="${k.topMatrix([x + 5, y + 9.5], h + 0.4, P, "x")}" font-size="4.2">BOOKS CHECKED</text>`);
  out.push(`<text data-count class="iso-face-text" data-tone="hi" transform="${k.topMatrix([x + 5, y + d - 5.5], h + 0.4, P, "x")}" font-size="10">0</text>`);
  out.push(D([at([x + w - 4.5, y + 4.5, h + 0.4])], { size: 0.5, tone: "mid" }));
  return out.join("");
}

function aisle() {
  const marks = [];
  for (const x of [-150, 140]) marks.push(k.lineOnTop([x, SHELF_LANE_Y - 9], [x, SHELF_LANE_Y + 9], 0, P));
  const lane = k.planOutline({ x: -160, y: SHELF_LANE_Y - 10, w: 306, d: 20, r: 3 }, 0, P, 3);
  const side = k.planOutline({ x: AISLE_X - 13, y: SHELF_LANE_Y + 12, w: 26, d: HOME[1] + 8 - SHELF_LANE_Y - 12, r: 3 }, 0, P, 3);
  return L(lane + side, { tone: "faint" }) + L(marks.join(""), { tone: "faint" });
}

function desk() {
  const out = [];
  const plan = { x: DESK.x, y: DESK.y, w: DESK.w, d: DESK.d, r: 2 };
  out.push(S(k.slabOf(k.insetPlan(plan, 2), 0, 3, P, 3), { tone: "lo" }));
  out.push(S(k.slabOf(plan, 3, DESK.h - 3, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(plan, 12, P, 4), { tone: "faint" }) }));
  out.push(S(k.slabOf(k.insetPlan(plan, -1.5), DESK.h, 2, P, 4, 0.8), { tone: "mid" }));
  out.push(S(k.slabOf({ ...IN_TRAY, r: 1 }, DESK.h + 2, 2, P, 3, 0.3), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan({ ...IN_TRAY, r: 1 }, 1.4), DESK.h + 4, P, 2), { tone: "faint" }));
  const { x, y, r, z } = DIAL;
  out.push(S(k.cylinder(x, y, r + 2, DESK.h + 2, z - DESK.h - 2, P, 48), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, r, z, 2.5, P, 56, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(x, y, r - 1.6, z + 2.5, P, 48), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, r - 2, 50, 5, z + 2.5, [0.9, 2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 1, z + 2.5, P, 12), { tone: "mid" }));
  out.push(S(k.cylinder(x, y - r - 2.2, 1.6, z, 3.5, P, 16), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([x, y + 4.5], z + 2.5, P, "x"), "10 ms", { size: 1.9, tone: "lo", anchor: "middle" }));
  return out.join("");
}

export const needleAt = (turn) => {
  const a = turn * Math.PI * 2, { x, y, r, z } = DIAL;
  return k.lineOnTop([x - Math.sin(a) * 1.8, y + Math.cos(a) * 1.8], [x + Math.sin(a) * (r - 2.6), y - Math.cos(a) * (r - 2.6)], z + 2.7, P);
};

export function bookSvg({ lit = false } = {}) {
  return S(k.slabOf({ x: -BOOK.w / 2, y: -BOOK.d / 2, w: BOOK.w, d: BOOK.d, r: 0.3 }, 0, BOOK.h, P, 2, 0.2), { tone: "hi", crease: "lo", lit });
}

function trolley() {
  const out = [];
  const plan = { x: -12, y: -7, w: 24, d: 14, r: 1.5 };
  const wheels = byDepth([[-9, -5], [9, -5], [-9, 5], [9, 5]].map(([x, y]) => ({ at: [x, y, 0], x, y })));
  for (const wh of wheels) out.push(S(k.cylinder(wh.x, wh.y, 1.8, 0, 2.6, P, 14), { tone: "lo" }));
  out.push(S(k.slabOf({ x: -12, y: -7, w: 2, d: 14, r: 0.4 }, 2.6, 18, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf(plan, 3.4, 1.6, P, 3, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -8, y: -4, w: 9, d: 8, r: 0.3 }, 5, 6, P, 2), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf(plan, 12.4, 1.6, P, 3, 0.3), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(plan, 2), 14, P, 2), { tone: "faint" }));
  out.push(S(k.slabOf({ x: 10, y: -7, w: 2, d: 14, r: 0.4 }, 2.6, 18, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf({ x: 10.4, y: -6, w: 1.2, d: 12, r: 0.5 }, 20.6, 2, P, 2), { tone: "mid" }));
  out.push(`<g data-lamp>${S(k.cylinder(-11, 0, 1.6, 20.6, 2.2, P, 16), { tone: "hi" })}</g>`);
  return out.join("");
}

export function buildFigure() {
  const shelves = CASES.map((c, i) => bookcase(c, i)).join("");
  // Bodies first, then the open drawers: a drawer sticks out in front of its right-hand neighbour.
  const cabs = CABS.map((cab, i) => cabinet(cab, i)).join("") + CABS.map((cab, i) => `<g data-cab="${i}">${tray(cab, i)}</g>`).join("");
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A small library on a base plate. Eight numbered bookcases along the back hold the books, in no particular order. Five card catalogue cabinets at the front are the indexes, each with its column engraved on the lid and its top drawer open on a tray of sorted cards; a missing one leaves only its outline and name on the floor. A book trolley either walks past every bookcase while a counter climbs (a full scan) or reads a catalogue drawer, lifts the card that names a shelf number, and follows a lit route to that bookcase. New books file a card in every cabinet. A desk on the right holds a stopwatch and a tray for new books.",
    body: [
      plate(),
      aisle(),
      shelves,
      `<g data-onshelf style="display:none">${bookSvg({ lit: true })}</g>`,
      `<path data-route class="iso-line" data-tone="lit" data-dashed="" d="" style="stroke-width:1"/>`,
      `<g data-back></g>`,
      footprints(),
      cabs,
      counter(),
      desk(),
      `<g data-newbook style="display:none">${S(k.slabOf({ x: IN_TRAY.x + 3, y: IN_TRAY.y + 3, w: 10, d: 7, r: 0.3 }, DESK.h + 4, 2.4, P, 2), { tone: "hi", crease: "lo" })}</g>`,
      `<path data-needle class="iso-line" data-tone="lit" data-free="start" d="${needleAt(0)}" style="stroke-width:1"/>`,
      `<g data-front><g data-trolley transform="${k.translateAlong(P, [HOME[0], HOME[1], 0])}">${trolley()}</g><g data-fly style="opacity:0">${bookSvg({ lit: true })}</g></g>`,
    ],
  });
}

export const GEOMETRY = { CASE, CASES, LEVELS, BOOK, CAB, CABS, TRAY, CAB_FRONT, HOME, AISLE_X, CAB_STOP_Y, SHELF_LANE_Y, DESK, DIAL, IN_TRAY };

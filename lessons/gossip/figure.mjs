// A gossip village: houses on a board pass a rumour to random neighbours each round; the town hall keeps a
// membership board of who is alive, suspected or dead; a dial counts the rounds.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";
import { rng } from "./sim.js";

export const WIDTH = 720;
export const HEIGHT = 470;
export const MEMBERS = 40;

const PLATE = { x: -178, y: -116, w: 356, d: 226, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const HOUSE = { w: 12, d: 10, h: 8 };
const ROOF_Z = HOUSE.h;
export const LAMP_Z = HOUSE.h + 2.4 + 2.6;

// House plots: member 0 is the town hall; members 1..39 live in a jittered 8 × 5 grid.
const jitter = rng(4242);
const SLOTS = [];
for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) SLOTS.push([-158 + c * 27 + (jitter() - 0.5) * 6, -98 + r * 30 + (jitter() - 0.5) * 6]);
export const HALL = { x: 72, y: -102, w: 58, d: 40, h: 20, r: 2 };
export const HALL_LAMP = [HALL.x + HALL.w / 2, HALL.y + HALL.d / 2];
export const HOMES = [HALL_LAMP, ...SLOTS.slice(0, MEMBERS - 1).map(([x, y]) => [x - 2, y + 0.5])];
export const HOME_Z = [HALL.h + 3 + 2.6, ...SLOTS.slice(0, MEMBERS - 1).map(() => LAMP_Z)];

const BOARD = { x: 70, y: -36, w: 64, d: 46, r: 2 };
const BOARD_H = 3;
export const PEGS = Array.from({ length: MEMBERS }, (_, m) => [BOARD.x + 6 + (m % 8) * 7.4, BOARD.y + 6 + Math.floor(m / 8) * 8.4]);
export const DIAL = { x: 102, y: 44, r: 15, z: 7 };
export const DIAL_ROUNDS = 20;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [HALL.x, HALL.y, HALL.h + 12], [-158, -98, 30]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth = ([x, y]) => k.depthOf([x, y, 0], P);

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -158, y: 84, w: 196, d: 7, r: 1 })
    + labelPlate(P, { x: 128, y: 74, w: 36, d: 18, r: 1.5 }, [[133, 79, 20], [133, 83, 26], [133, 87, 14]]);
}

// A street pad under every plot, so an empty plot still reads as a place for a house.
function plot([x, y]) {
  return L(k.planOutline({ x: x - 9, y: y - 8, w: 18, d: 16, r: 1.5 }, 0, P, 3), { tone: "faint" });
}

function lamp(cx, cy, z) {
  const out = [S(k.cylinder(cx, cy, 2.1, z - 2.6, 2.6, P, 18, 0.3), { tone: "mid" })];
  out.push(`<path class="glow" d="${k.ring(cx, cy, 1.5, z, P, 18)}"/>`);
  return out.join("");
}

function house(m, [x, y]) {
  const out = [`<g data-house="${m}">`];
  const body = { x: x - HOUSE.w / 2, y: y - HOUSE.d / 2, w: HOUSE.w, d: HOUSE.d, r: 0.8 };
  out.push(S(k.slabOf(body, 0, HOUSE.h, P, 2, 0.3), { tone: "mid" }));
  const front = y + HOUSE.d / 2;
  out.push(L(k.faceRectY(P, x - 1.5, x + 1.5, front, 0, 4.6) + k.faceRectY(P, x + 2.6, x + 5, front, 3.6, 6), { tone: "lo" }));
  const side = x + HOUSE.w / 2;
  out.push(L(k.faceRectX(P, side, y - 2, y + 1, 3.6, 6), { tone: "lo" }));
  // Boards nailed across the front: the town hall has declared this house dead.
  out.push(`<g data-boards>${L([[x - 5.4, 0.8, x + 5.4, 7.2], [x - 5.4, 7.2, x + 5.4, 0.8]].map(([x0, z0, x1, z1]) => k.pathOf([[x0, front + 0.05, z0], [x1, front + 0.05, z1]].map(at))).join(""), { tone: "mid", free: true })}</g>`);
  out.push(`<g class="roof">${S(k.slabOf(k.insetPlan(body, -1.2), ROOF_Z, 2.4, P, 2, 0.4), { tone: "mid" })}</g>`);
  out.push(S(k.slabOf({ x: x + 2.6, y: y - 3.4, w: 2.4, d: 2.4, r: 0.3 }, ROOF_Z + 2.4, 3.4, P, 2), { tone: "mid", crease: "none" }));
  out.push(`<g data-lamp="${m}">${lamp(x - 2, y + 0.5, LAMP_Z)}</g>`);
  // A pennant on a pole: the town hall suspects this house (no fresh heartbeat lately).
  const fx = x - 4.6, fy = y - 3, top = ROOF_Z + 2.4 + 12;
  out.push(`<g data-flag>${L(k.pathOf([[fx, fy, ROOF_Z + 2.4], [fx, fy, top]].map(at)), { tone: "mid" })}<path class="pennant" d="${k.pathOf([[fx, fy, top], [fx + 9, fy, top - 2.6], [fx, fy, top - 5.2]].map(at), true)}"/></g>`);
  out.push(`</g>`);
  return out.join("");
}

function hall() {
  const out = [`<g data-house="0">`];
  out.push(S(k.slabOf(k.insetPlan(HALL, -2), 0, 2, P, 3, 0.4), { tone: "lo" }));
  out.push(S(k.slabOf(HALL, 2, HALL.h - 2, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(HALL, 11, P, 3), { tone: "faint" }) }));
  const front = HALL.y + HALL.d;
  for (let i = 0; i < 4; i++) out.push(L(k.faceRectY(P, HALL.x + 6 + i * 13, HALL.x + 12 + i * 13, front, 12.5, 17.5), { tone: "lo" }));
  out.push(L(k.faceRectY(P, HALL.x + HALL.w / 2 - 4, HALL.x + HALL.w / 2 + 4, front, 2, 9.5), { tone: "lo" }));
  const side = HALL.x + HALL.w;
  for (let i = 0; i < 3; i++) out.push(L(k.faceRectX(P, side, HALL.y + 6 + i * 11, HALL.y + 12 + i * 11, 12.5, 17.5), { tone: "lo" }));
  out.push(`<g class="roof">${S(k.slabOf(k.insetPlan(HALL, -2), HALL.h, 3, P, 3, 0.6), { tone: "mid" })}</g>`);
  out.push(L(k.planOutline(k.insetPlan(HALL, 3), HALL.h + 3, P), { tone: "faint" }));
  out.push(D(k.corners(HALL, 1).map(([x, y]) => at([x, y, HALL.h + 3])), { size: 0.45 }));
  out.push(`<g data-lamp="0">${lamp(HALL_LAMP[0], HALL_LAMP[1], HALL.h + 3 + 2.6)}</g>`);
  // Steps down to the board in front.
  out.push(S(k.slabOf({ x: HALL.x + HALL.w / 2 - 8, y: front, w: 16, d: 5, r: 0.6 }, 0, 2, P, 2, 0.3), { tone: "mid" }));
  out.push(`</g>`);
  return out.join("");
}

// The membership board: one peg per house. A tall peg is alive, a short one suspected, an empty hole dead.
function board() {
  const out = [S(k.slabOf(BOARD, 0, BOARD_H, P, 4, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(BOARD, 2.4), BOARD_H, P, 4), { tone: "faint" }));
  out.push(L(PEGS.map(([x, y]) => k.ring(x, y, 2, BOARD_H, P, 14)).join(""), { tone: "lo" }));
  const order = PEGS.map((p, m) => ({ p, m })).sort((a, b) => depth(a.p) - depth(b.p));
  for (const { p: [x, y], m } of order) {
    out.push(`<g data-peg="${m}" data-state="alive">`
      + `<g data-v="alive">${S(k.cylinder(x, y, 1.5, BOARD_H, 6, P, 14, 0.3), { tone: "hi", crease: "lo" })}</g>`
      + `<g data-v="suspected">${S(k.cylinder(x, y, 1.5, BOARD_H, 2.6, P, 14, 0.3), { tone: "mid" })}</g>`
      + `</g>`);
  }
  return out.join("");
}

function dial() {
  const { x, y, r, z } = DIAL;
  const out = [S(k.cylinder(x, y, r + 2.5, 0, 3, P, 56, 0.5), { tone: "mid" })];
  out.push(S(k.cylinder(x, y, r, 3, z - 3, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, r, z - 2.6, z, 60, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(x, y, r, z - 2.6, P, 40), { tone: "faint" }));
  out.push(L(k.ring(x, y, r - 2, z, P, 64), { tone: "lo" }));
  const t = k.radialTicks(x, y, r - 2.6, DIAL_ROUNDS, 5, z, [1.1, 2.4], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.3, z, P, 16), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([x, y + 6.5], z, P, "x"), "rounds", { size: 2.2, tone: "lo", anchor: "middle" }));
  return out.join("");
}

// A mechanical round counter in front of the dial: two digit wheels behind windows on its front face.
export const COUNTER = { x: 86, y: 64, w: 32, d: 12, h: 9, r: 1 };
function counter() {
  const { x, y, w, d, h } = COUNTER, front = y + d;
  const out = [S(k.slabOf(COUNTER, 0, h, P, 3, 0.5), { tone: "mid" })];
  const wins = [[x + 4, x + 14.5], [x + 17.5, x + 28]];
  out.push(L(wins.map(([a, b]) => k.faceRectY(P, a, b, front, 1.6, h - 1.6)).join(""), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(COUNTER, 1.5), h, P, 3), { tone: "faint" }));
  wins.forEach(([a, b], i) => out.push(`<g data-digit="${i}">${k.faceTextSvg(k.sideMatrix([(a + b) / 2, front + 0.05], 2.6, P, "left"), "0", { size: 5.4, tone: "lit", anchor: "middle" })}</g>`));
  return out.join("");
}

// Where a messenger is when it is a share e (0..1) of the way from house a to house b: an arc over the roofs.
export const flightPoint = (a, b, e) => [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e + 14 * Math.sin(Math.PI * e)];

export const needleAt = (turn) => {
  const a = turn * Math.PI * 2, { x, y, r, z } = DIAL;
  return k.lineOnTop([x - Math.sin(a) * 2.6, y + Math.cos(a) * 2.6], [x + Math.sin(a) * (r - 3.4), y - Math.cos(a) * (r - 3.4)], z + 0.2, P);
};

export function buildFigure() {
  const items = [
    ...SLOTS.slice(0, MEMBERS - 1).map((p) => ({ d: depth(p) - 0.1, svg: plot(p) })),
    ...SLOTS.slice(0, MEMBERS - 1).map((p, i) => ({ d: depth(p), svg: house(i + 1, p) })),
  ].sort((a, b) => a.d - b.d);
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A village of houses on a board. Each round, every house that knows a rumour sends messengers to a few random houses, and a house's roof lamp lights when it hears. At the back right stands the town hall, with a membership board in front of it: one peg per house, tall while the house is alive, short when it is suspected, an empty hole when it is declared dead. A dial at the front counts the rounds.",
    body: [
      plate(),
      items.map((i) => i.svg).join(""),
      hall(),
      board(),
      dial(),
      counter(),
      `<path data-needle class="iso-line" data-tone="lit" data-free="start" d="${needleAt(0)}" style="stroke-width:1.1"/>`,
      `<g data-messengers></g>`,
    ],
  });
}

export const GEOMETRY = { HOMES, HOME_Z, MEMBERS, DIAL_ROUNDS };

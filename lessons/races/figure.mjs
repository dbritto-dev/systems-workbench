// A bank office: clerks walk between their desks and one big ledger card (the shared balance),
// or a seat-booking board. Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -112, y: -78, w: 240, d: 136, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;

// The ledger: an upright card on a plinth, its front face (+y) toward the viewer.
const PLINTH = { x: -52, y: -48, w: 66, d: 14, r: 2 };
const PLINTH_H = 8;
const CARD = { x: -50, y: -42.5, w: 62, d: 3, r: 0.6 };
const CARD_Z = [PLINTH_H, 62];
const FACE = CARD.y + CARD.d;           // y of the card's front face
const COUNTER = { x0: -21, w: 29 };     // housing span on the face
const ROWS = { balance: 40, expected: 27 }; // housing bottom z for each counter
const HOUSING_H = 9.5;
const WHEELS = 4;

const HOOK = [-64, -40];
const KEY_Z = 36;

const BOARD = { x: 32, y: -66, w: 86, d: 62, r: 2 };
const BOARD_Z = 12;
export const SEAT_AT = Array.from({ length: 24 }, (_, n) => [42 + (n % 6) * 13.2, -57 + Math.floor(n / 6) * 14.4]);

export const DESKS = [-88, -50, -12, 26];
const DESK_Y = 22;
const DESK = { w: 30, d: 12, h: 9 };
export const DESK_SPOT = DESKS.map((x) => [x, 14]);
export const STAND_SPOT = [-42, -27, -12, 3].map((x) => [x, -27]);
export const BOARD_SPOT = [50, 66, 82, 98].map((x) => [x, 8]);

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [HOOK[0], HOOK[1], 54], [CARD.x, CARD.y, CARD_Z[1] + 2], [CARD.x + CARD.w, CARD.y, CARD_Z[1] + 2]],
  WIDTH,
  HEIGHT,
  { pad: 20, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const faceY = (x0, x1, y, z0, z1) => k.faceRectY(P, x0, x1, y, z0, z1);
const text = (x, y, z, value, { size = 3, tone = "mid", anchor = "start", attr = "" } = {}) =>
  `<text class="iso-face-text" ${attr} data-tone="${tone}" transform="${k.sideMatrix([x, y], z, P, "left")}" font-size="${size}" text-anchor="${anchor}">${value}</text>`;

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -100, y: 44, w: 104, d: 6, r: 1 })
    + labelPlate(P, { x: 70, y: 36, w: 46, d: 16, r: 1.5 }, [[76, 41, 28], [76, 45, 34], [76, 49, 20]]);
}

// A counter: a housing proud of the card face with digit wheels showing through windows.
function counter(z, name) {
  const out = [];
  const front = FACE + 2.2;
  out.push(S(k.slabOf({ x: COUNTER.x0, y: FACE, w: COUNTER.w, d: 2.2, r: 0.4 }, z, HOUSING_H, P, 2, 0.3), { tone: "mid" }));
  const win = (COUNTER.w - 2.4) / WHEELS;
  for (let n = 0; n < WHEELS; n++) {
    const x0 = COUNTER.x0 + 1.2 + n * win + 0.5, x1 = x0 + win - 1;
    out.push(L(faceY(x0, x1, front, z + 1.2, z + HOUSING_H - 1.2), { tone: "lo" }));
    // Wheel rims: the drum curving away above and below the digit.
    out.push(L(k.segment([x0 + 0.6, front, z + HOUSING_H - 2], [x1 - 0.6, front, z + HOUSING_H - 2], P) + k.segment([x0 + 0.6, front, z + 2], [x1 - 0.6, front, z + 2], P), { tone: "faint", free: true }));
    out.push(text((x0 + x1) / 2, front, z + 3.3, "0", { size: 4.6, tone: "hi", anchor: "middle", attr: `data-digit="${name}${n}"` }));
  }
  return out.join("");
}

// The ledger stand: plinth, the big card with two counters, the version stamp and ruled entry lines.
function ledger() {
  const out = [];
  out.push(S(k.slabOf(PLINTH, 0, PLINTH_H, P, 3, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLINTH, 2), PLINTH_H, P, 3), { tone: "faint" }));
  const card = k.slabOf(CARD, CARD_Z[0], CARD_Z[1] - CARD_Z[0], P, 2, 0.4);
  out.push(S(card, { tone: "hi", crease: "lo" }));
  out.push(`<g data-card-lit style="display:none">${S(card, { tone: "hi", crease: "lo", lit: true }).replace('class="iso-solid"', 'class="iso-solid" data-lit-outline')}</g>`);
  const x0 = CARD.x + 3, x1 = CARD.x + CARD.w - 3;
  // Header: title, a rule, and the version stamp at the top right.
  out.push(text(x0, FACE, 55.6, "LEDGER · ACCOUNT 7", { size: 2.8, tone: "lo" }));
  out.push(L(k.segment([x0, FACE, 52.6], [x1, FACE, 52.6], P), { tone: "faint", free: true }));
  out.push(S(k.slabOf({ x: -2, y: FACE, w: 11, d: 1, r: 0.3 }, 53.6, 6.6, P, 2, 0.2), { tone: "mid", crease: "none" }));
  out.push(L(faceY(-1.2, 8.2, FACE + 1, 54.4, 59.4), { tone: "lo" }));
  out.push(text(3.5, FACE + 1, 55.4, "v0", { size: 3.6, tone: "hi", anchor: "middle", attr: "data-version" }));
  // Two counters with their labels on the card face.
  out.push(text(x0, FACE, ROWS.balance + 3.6, "BALANCE", { size: 2.9, tone: "mid", attr: 'data-label="balance"' }));
  out.push(counter(ROWS.balance, "b"));
  out.push(text(x0, FACE, ROWS.expected + 3.6, "SHOULD BE", { size: 2.9, tone: "mid", attr: 'data-label="expected"' }));
  out.push(counter(ROWS.expected, "e"));
  // Ruled entry lines below.
  out.push(L([0, 1, 2, 3].map((n) => k.segment([x0, FACE, 22 - n * 3.4], [x0 + [44, 30, 50, 22][n], FACE, 22 - n * 3.4], P)).join(""), { tone: "faint", free: true }));
  return out.join("");
}

function hook() {
  const [x, y] = HOOK;
  const out = [];
  out.push(S(k.cylinder(x, y, 4.6, 0, 2, P, 24, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 1.4, 2, 50, P, 14), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: x - 1.2, y: y - 1.2, w: 10, d: 2.4, r: 0.5 }, 50, 2.2, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x + 7.5, y, 0.6, KEY_Z + 7, 7, P, 8), { tone: "mid", crease: "none" }));
  out.push(`<g data-hook-key>${keySvg([x + 7.5, y, KEY_Z])}</g>`);
  return out.join("");
}

// The key: a ring head and a bit with a tooth, hung upright.
export function keySvg([x, y, z], s = 1.5) {
  return S(k.cylinder(x, y, 2 * s, z + 3 * s, 1.2 * s, P, 18), { tone: "hi", crease: "lo" })
    + S(k.slabOf({ x: x - 0.5 * s, y: y - 0.5 * s, w: s, d: s, r: 0.2 }, z - 3 * s, 6 * s, P, 1), { tone: "hi", crease: "none" })
    + S(k.slabOf({ x: x + 0.5 * s, y: y - 0.5 * s, w: 1.6 * s, d: s, r: 0.2 }, z - 3 * s, 1.4 * s, P, 1), { tone: "hi", crease: "none" });
}

function board() {
  const out = [];
  for (const [x, y] of [[BOARD.x + 5, BOARD.y + 5], [BOARD.x + BOARD.w - 5, BOARD.y + 5], [BOARD.x + 5, BOARD.y + BOARD.d - 5], [BOARD.x + BOARD.w - 5, BOARD.y + BOARD.d - 5]]) {
    out.push(S(k.cylinder(x, y, 2, 0, BOARD_Z, P, 14), { tone: "mid", crease: "none" }));
  }
  out.push(S(k.slabOf(BOARD, BOARD_Z, 3, P, 4, 0.6), { tone: "mid" }));
  const top = BOARD_Z + 3;
  out.push(L(k.planOutline(k.insetPlan(BOARD, 3), top, P, 3), { tone: "faint" }));
  out.push(L(SEAT_AT.map(([x, y]) => k.ring(x, y, 4.4, top, P, 22)).join(""), { tone: "lo" }));
  // Row letters and a stage edge at the back of the board.
  out.push(L(k.lineOnTop([BOARD.x + 8, BOARD.y + 4.2], [BOARD.x + BOARD.w - 8, BOARD.y + 4.2], top, P), { tone: "mid" }));
  "ABCD".split("").forEach((row, r) => out.push(k.faceTextSvg(k.topMatrix([BOARD.x + 4.6, SEAT_AT[r * 6][1] + 1.2], top, P, "x"), row, { size: 3, tone: "lo", anchor: "middle" })));
  return out.join("");
}

// Pins for every seat: a first pin, a second pin (a double booking) and a lit ring that marks the clash.
function pins() {
  const top = BOARD_Z + 3;
  return SEAT_AT.map(([x, y], n) => `<g data-seat="${n}">`
    + `<path class="iso-line" data-ring data-tone="lit" style="display:none;stroke-width:1.6" d="${k.ring(x, y, 6.2, top, P, 26)}"/>`
    + `<g data-pin="0" style="display:none">${pinSvg(x - 1.8, y - 0.6, top)}</g>`
    + `<g data-pin="1" style="display:none">${pinSvg(x + 2.2, y + 1.2, top)}</g>`
    + `</g>`).join("");
}
function pinSvg(x, y, z) {
  return S(k.cylinder(x, y, 0.8, z, 7, P, 10), { tone: "mid", crease: "none" })
    + S(k.cylinder(x, y, 2.4, z + 7, 2, P, 16, 0.3), { tone: "hi", crease: "lo" });
}

function desk(cx) {
  const plan = { x: cx - DESK.w / 2, y: DESK_Y, w: DESK.w, d: DESK.d, r: 1.5 };
  const out = [];
  for (const x of [plan.x + 2.5, plan.x + plan.w - 5.5]) out.push(S(k.slabOf({ x, y: plan.y + 2, w: 3, d: plan.d - 4, r: 0.6 }, 0, DESK.h - 2, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf(plan, DESK.h - 2, 2, P, 3, 0.5), { tone: "mid" }));
  out.push(S(k.slabOf({ x: cx - 5, y: plan.y + 2.5, w: 10, d: 7, r: 0.6 }, DESK.h, 0.8, P, 2), { tone: "hi", crease: "none" }));
  out.push(L([0, 1].map((n) => k.lineOnTop([cx - 3.5, plan.y + 4.5 + n * 2.2], [cx + 3.5 - n * 2, plan.y + 4.5 + n * 2.2], DESK.h + 0.8, P)).join(""), { tone: "faint", free: true }));
  return out.join("");
}

// A clerk: base, body, collar and head; a slip held in front showing what they read; the key at the side.
const SLIP = { x: -5.2, y: 5.2, w: 10.4, d: 1, r: 0.3 };
const SLIP_Z = [8.5, 17];
export function clerkSvg() {
  const out = [];
  out.push(S(k.cylinder(0, 0, 6, 0, 1.6, P, 26, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(0, 0, 4.4, 1.6, 13.4, P, 24), { tone: "hi", crease: "none" }));
  out.push(S(k.cylinder(0, 0, 5.2, 15, 1.4, P, 24, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(0, 0, 3.6, 16.4, 6, P, 22, 0.3), { tone: "hi", crease: "lo" }));
  out.push(`<g data-key style="display:none">${keySvg([6.4, 1.5, 9])}</g>`);
  const slip = k.slabOf(SLIP, SLIP_Z[0], SLIP_Z[1] - SLIP_Z[0], P, 1, 0.2);
  const front = SLIP.y + SLIP.d;
  out.push(`<g data-slip style="display:none">`
    + S(slip, { tone: "hi", crease: "lo" })
    + `<g data-slip-lit style="display:none">${S(slip, { tone: "hi", crease: "lo", lit: true })}</g>`
    + text(0, front, 12.6, "0", { size: 4, tone: "hi", anchor: "middle", attr: "data-slip-value" })
    + text(0, front, 9.4, "", { size: 2.4, tone: "mid", anchor: "middle", attr: "data-slip-note" })
    + `</g>`);
  return out.join("");
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A bank office on a base plate. In the middle stands a large ledger card with two digit counters: the balance, and what the balance should be. A key hangs on a hook beside it and a version stamp sits in the card's corner. At the right is a seat-booking board. Clerks walk from their desks at the front to the card, copy the balance onto a slip, walk back to work out the new balance, then walk back and write it. When two clerks hold the same old balance, one overwrites the other and the balance falls behind.",
    body: [
      plate(),
      hook(),
      ledger(),
      board(),
      `<g data-pins>${pins()}</g>`,
      `<g data-clerks></g>`,
      DESKS.map(desk).join(""),
    ],
  });
}

export const GEOMETRY = { DESK_SPOT, STAND_SPOT, BOARD_SPOT, SEAT_AT };

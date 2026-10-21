// A bakery: a display case of trays (cached keys), each with an expiry dial; an oven with a few shelves
// (the database) and a ticket rail where orders wait for a shelf; customers who missed wait in front of their tray.
// A scoreboard on the back wall counts waiting customers, duplicate orders and stale loaves served.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";

export const WIDTH = 700;
export const HEIGHT = 470;
export const KEYS = 6;

const PLATE = { x: -124, y: -96, w: 248, d: 162, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;

// Oven: front face at y = OVEN_FRONT, four shelf openings (2 × 2) and a load gauge above them.
const OVEN = { x: -116, y: -90, w: 64, d: 30, r: 2.5 };
const OVEN_H = 58;
const OVEN_FRONT = OVEN.y + OVEN.d;
const OPEN_X = [[-111, -88], [-80, -57]];
const OPEN_Z = [[24, 34], [8, 18]];        // top row first, so shelves 0, 1 are the upper pair
export const SHELVES = OPEN_Z.flatMap((z) => OPEN_X.map((x) => ({ x, z })));
export const GAUGE = { x: -84, y: OVEN_FRONT, z: 46.5, r: 7.2, max: 16 };

// Ticket rail: orders waiting for a shelf hang on two rails as numbered tickets, eight per rail, first in line at the left.
const RAIL = { x: -46, y: -90, w: 76, d: 3 };
const RAIL_Z = [44, 26];                    // bar height of the upper and lower rail
export const TICKET = { w: 7.4, h: 11 };
export const RACK_SLOTS = RAIL_Z.flatMap((z) => Array.from({ length: 8 }, (_, i) => ({ x: RAIL.x + 4 + i * 9, y: RAIL.y + RAIL.d, z: z - 1 - TICKET.h })));

// Scoreboard on the back wall.
const BOARD = { x: 36, y: -92, w: 82, d: 4, r: 0.8 };
const BOARD_Z = [6, 46];
const BOARD_FRONT = BOARD.y + BOARD.d;
export const BOARD_ROWS = [
  { name: "wait", label: "WAITING", z: 34 },
  { name: "dup", label: "DUPLICATES", z: 22 },
  { name: "stale", label: "STALE", z: 10 },
];
const WHEELS = 3;
const WIN = 7.6;
const HOUSING = { x: 88, w: WHEELS * WIN + 2.4, h: 9.4 };

// Display case: six trays on top, a number and an expiry dial on its front face under each.
const CASE = { x: -100, y: -30, w: 200, d: 26, r: 2.5 };
const CASE_H = 18;
const CASE_FRONT = CASE.y + CASE.d;
export const TRAY_X = Array.from({ length: KEYS }, (_, i) => CASE.x + 18 + i * 32.8);
const TRAY_Y = CASE.y + CASE.d / 2;
export const DIAL = { y: CASE_FRONT, z: 7.6, r: 4.6 };

// Waiting customers: two columns of four in front of each tray.
export const SPOTS = TRAY_X.map((x) => Array.from({ length: 8 }, (_, n) => [x + (n % 2 ? 6 : -6), 15 + Math.floor(n / 2) * 9]));

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [OVEN.x, OVEN.y, OVEN_H + 12], [OVEN.x + OVEN.w, OVEN.y, OVEN_H + 12], [BOARD.x + BOARD.w, BOARD.y, BOARD_Z[1]]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const faceY = (x0, x1, y, z0, z1) => k.faceRectY(P, x0, x1, y, z0, z1);
export const text = (x, y, z, value, { size = 3, tone = "mid", anchor = "start", attr = "" } = {}) =>
  `<text class="iso-face-text" ${attr} data-tone="${tone}" transform="${k.sideMatrix([x, y], z, P, "left")}" font-size="${size}" text-anchor="${anchor}">${value}</text>`;

// A needle on a vertical face (constant y): frac 0 points left, 1 points right, sweeping over the top.
export function needle(c, frac, len = 0.82) {
  const a = Math.PI * (1 - Math.max(0, Math.min(1, frac)));
  return k.pathOf([at([c.x, c.y, c.z]), at([c.x + Math.cos(a) * c.r * len, c.y, c.z + Math.sin(a) * c.r * len])]);
}

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -116, y: 55, w: 118, d: 5, r: 1 })
    + labelPlate(P, { x: 74, y: 49, w: 42, d: 11, r: 1.5 }, [[79, 52.5, 26], [79, 56, 32]]);
}

// A tray with a loaf on it; `x, y` is the tray's back-left corner.
function trayAt(x, y, z, { w = 7.6, d = 12, lit = false, loaf = true } = {}) {
  const tray = S(k.slabOf({ x, y, w, d, r: 0.6 }, z, 1.2, P, 2), { tone: "mid", crease: "none", lit });
  if (!loaf) return tray;
  return tray + S(k.slabOf({ x: x + 1, y: y + 1.4, w: w - 2, d: d - 2.8, r: Math.min(2.4, (w - 2) / 2 - 0.1) }, z + 1.2, 2.6, P, 4, 0.6), { tone: "hi", crease: "lo", lit });
}

function board() {
  const out = [];
  out.push(S(k.slabOf({ x: BOARD.x + 6, y: BOARD.y + 0.5, w: 3, d: 3, r: 0.4 }, 0, BOARD_Z[0], P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: BOARD.x + BOARD.w - 9, y: BOARD.y + 0.5, w: 3, d: 3, r: 0.4 }, 0, BOARD_Z[0], P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf(BOARD, BOARD_Z[0], BOARD_Z[1] - BOARD_Z[0], P, 2, 0.4), { tone: "hi", crease: "lo" }));
  for (const row of BOARD_ROWS) {
    out.push(text(BOARD.x + 5, BOARD_FRONT, row.z + 3, row.label, { size: 4, tone: "mid" }));
    const front = BOARD_FRONT + 1.8;
    out.push(S(k.slabOf({ x: HOUSING.x, y: BOARD_FRONT, w: HOUSING.w, d: 1.8, r: 0.4 }, row.z, HOUSING.h, P, 2, 0.3), { tone: "mid" }));
    for (let n = 0; n < WHEELS; n++) {
      const x0 = HOUSING.x + 1.2 + n * WIN + 0.4, x1 = x0 + WIN - 0.8;
      out.push(L(faceY(x0, x1, front, row.z + 1.1, row.z + HOUSING.h - 1.1), { tone: "lo" }));
      out.push(L(k.segment([x0 + 0.6, front, row.z + HOUSING.h - 2], [x1 - 0.6, front, row.z + HOUSING.h - 2], P) + k.segment([x0 + 0.6, front, row.z + 2], [x1 - 0.6, front, row.z + 2], P), { tone: "faint", free: true }));
      out.push(text((x0 + x1) / 2, front, row.z + 3.1, "0", { size: 4.8, tone: "hi", anchor: "middle", attr: `data-digit="${row.name}${n}"` }));
    }
  }
  return out.join("");
}

function oven() {
  const out = [];
  const inner = [];
  for (const s of SHELVES) inner.push(faceY(s.x[0], s.x[1], OVEN_FRONT, s.z[0], s.z[1]));
  out.push(S(k.slabOf(OVEN, 0, OVEN_H, P, 3, 0.6), { tone: "mid", inner: L(inner.join(""), { tone: "lo" }) }));
  // Shelf floors inside each opening and a handle bar under each row.
  out.push(L(SHELVES.map((s) => k.segment([s.x[0] + 1, OVEN_FRONT, s.z[0] + 1.2], [s.x[1] - 1, OVEN_FRONT, s.z[0] + 1.2], P)).join(""), { tone: "faint", free: true }));
  // Chimney.
  out.push(S(k.cylinder(OVEN.x + 14, OVEN.y + 10, 4, OVEN_H, 10, P, 20), { tone: "mid" }));
  // Gauge: a round face, ticks over the top half, a red-zone arc, the needle.
  const g = GAUGE;
  out.push(S(k.slabOf({ x: g.x - g.r - 1.6, y: OVEN_FRONT, w: 2 * g.r + 3.2, d: 1.2, r: 1 }, g.z - 3, g.r + 5.4, P, 3, 0.3), { tone: "hi", crease: "none" }));
  const ticks = [];
  for (let n = 0; n <= 8; n++) {
    const a = Math.PI * (1 - n / 8), r0 = g.r * (n % 4 === 0 ? 0.66 : 0.78);
    ticks.push(k.segment([g.x + Math.cos(a) * r0, g.y + 1.2, g.z + Math.sin(a) * r0], [g.x + Math.cos(a) * g.r * 0.92, g.y + 1.2, g.z + Math.sin(a) * g.r * 0.92], P));
  }
  out.push(L(ticks.join(""), { tone: "lo", free: true }));
  const arc = [];
  for (let n = 0; n <= 10; n++) { const a = Math.PI * (0.25 - 0.25 * n / 10); arc.push(at([g.x + Math.cos(a) * g.r * 0.96, g.y + 1.2, g.z + Math.sin(a) * g.r * 0.96])); }
  out.push(L(k.pathOf(arc), { tone: "hi", free: true }));
  out.push(`<path class="iso-line" data-tone="hi" data-gauge d="${needle({ ...g, y: g.y + 1.3 }, 0)}"/>`);
  out.push(k.dotsSvg([at([g.x, g.y + 1.3, g.z])], { size: 0.8, tone: "hi" }));
  // Shelf tags: a plate above each opening that names the tray baking there.
  SHELVES.forEach((s, i) => {
    const cx = (s.x[0] + s.x[1]) / 2;
    out.push(`<g data-shelf-tag="${i}" style="display:none">`
      + S(k.slabOf({ x: cx - 3.6, y: OVEN_FRONT, w: 7.2, d: 1, r: 0.4 }, s.z[1] + 0.6, 4.6, P, 2), { tone: "hi", crease: "none" })
      + `<g data-shelf-lit style="display:none">${S(k.slabOf({ x: cx - 3.6, y: OVEN_FRONT, w: 7.2, d: 1, r: 0.4 }, s.z[1] + 0.6, 4.6, P, 2), { tone: "hi", crease: "none", lit: true })}</g>`
      + text(cx, OVEN_FRONT + 1, s.z[1] + 1.6, "1", { size: 3.4, tone: "hi", anchor: "middle", attr: "data-shelf-num" })
      + `</g>`);
    // The tray in the opening, sticking out a little.
    out.push(`<g data-shelf-tray="${i}" style="display:none">${trayAt(s.x[0] + 2.5, OVEN_FRONT - 6, s.z[0] + 0.4, { w: s.x[1] - s.x[0] - 5, d: 9 })}</g>`);
  });
  return out.join("");
}

// An order ticket: an upright card hanging from a clip, the tray number printed on its front.
export function ticketSvg(lit) {
  const card = k.slabOf({ x: 0, y: 0, w: TICKET.w, d: 0.6, r: 0.2 }, 0, TICKET.h, P, 2);
  return S(card, { tone: "hi", crease: "none", lit })
    + S(k.slabOf({ x: TICKET.w / 2 - 1.2, y: -0.4, w: 2.4, d: 1.4, r: 0.3 }, TICKET.h - 1, 2, P, 2), { tone: "mid", crease: "none" })
    + `<text class="iso-face-text" data-ticket-num data-tone="hi" transform="${k.sideMatrix([TICKET.w / 2, 0.6], 2.6, P, "left")}" font-size="6.4" text-anchor="middle">1</text>`;
}

function rail() {
  const out = [];
  // Two posts and a back panel, then each bar with its faint ticket places and tickets.
  const panel = { x: RAIL.x, y: RAIL.y - 1.6, w: RAIL.w, d: 1.6, r: 0.4 };
  out.push(S(k.slabOf(panel, 4, RAIL_Z[0] + 4, P, 2, 0.3), { tone: "mid", crease: "none" }));
  for (const x of [RAIL.x + 3, RAIL.x + RAIL.w - 3]) out.push(S(k.slabOf({ x: x - 1.2, y: RAIL.y - 1.6, w: 2.4, d: 2.4, r: 0.3 }, 0, 4, P, 2), { tone: "lo", crease: "none" }));
  RAIL_Z.forEach((z, r) => {
    out.push(S(k.slabOf({ x: RAIL.x + 1, y: RAIL.y, w: RAIL.w - 2, d: RAIL.d, r: 0.6 }, z, 1.6, P, 2), { tone: "hi", crease: "lo" }));
    out.push(L(RACK_SLOTS.slice(r * 8, r * 8 + 8).map((s) => k.faceRectY(P, s.x, s.x + TICKET.w, RAIL.y, s.z, s.z + TICKET.h)).join(""), { tone: "lo", dashed: true }));
    RACK_SLOTS.slice(r * 8, r * 8 + 8).forEach((s, i) => {
      const n = r * 8 + i;
      out.push(`<g data-slot="${n}" style="display:none" transform="${k.translateAlong(P, [s.x, s.y, s.z])}"><g data-plain>${ticketSvg(false)}</g><g data-lit class="wb-lit-group" style="display:none">${ticketSvg(true)}</g></g>`);
    });
  });
  return out.join("");
}

function displayCase() {
  const out = [];
  const inner = [];
  TRAY_X.forEach((x) => inner.push(faceY(x - 13, x + 13, CASE_FRONT, 2.2, CASE_H - 2.2)));
  out.push(S(k.slabOf(CASE, 0, CASE_H, P, 3, 0.6), { tone: "mid", inner: L(inner.join(""), { tone: "faint" }) }));
  TRAY_X.forEach((x, i) => {
    // Tray well on top.
    out.push(L(k.planOutline({ x: x - 13, y: TRAY_Y - 9, w: 26, d: 18, r: 1.2 }, CASE_H, P, 3), { tone: "lo" }));
    // The number and the expiry dial on the front.
    out.push(text(x - 9.5, CASE_FRONT, 12.2, String(i + 1), { size: 4.4, tone: "hi", anchor: "middle" }));
    out.push(L(k.sideRing([x + 2, DIAL.y, DIAL.z], DIAL.r, "y", P, 28), { tone: "lo" }));
    const ticks = [];
    for (let n = 0; n < 12; n++) { const a = (n / 12) * Math.PI * 2; ticks.push(k.segment([x + 2 + Math.cos(a) * DIAL.r * 0.8, DIAL.y, DIAL.z + Math.sin(a) * DIAL.r * 0.8], [x + 2 + Math.cos(a) * DIAL.r * 0.95, DIAL.y, DIAL.z + Math.sin(a) * DIAL.r * 0.95], P)); }
    out.push(L(ticks.join(""), { tone: "faint", free: true }));
    out.push(`<path class="iso-dial-fill" data-dial-fill="${i}" d=""/>`);
    out.push(`<path class="iso-line" data-tone="hi" data-dial="${i}" d=""/>`);
    // The loaf on the tray, and the "old" tag stuck in it.
    const loaf = { x: x - 10, y: TRAY_Y - 6, w: 20, d: 12, r: 4 };
    out.push(`<g data-loaf="${i}">`
      + S(k.slabOf({ x: x - 12, y: TRAY_Y - 8, w: 24, d: 16, r: 1 }, CASE_H, 1, P, 2), { tone: "mid", crease: "none" })
      + S(k.slabOf(loaf, CASE_H + 1, 6, P, 6, 1.6), { tone: "hi", crease: "lo" })
      + L(k.lineOnTop([x - 5, TRAY_Y - 3], [x - 2, TRAY_Y + 3], CASE_H + 7, P) + k.lineOnTop([x, TRAY_Y - 3], [x + 3, TRAY_Y + 3], CASE_H + 7, P) + k.lineOnTop([x + 5, TRAY_Y - 3], [x + 8, TRAY_Y + 3], CASE_H + 7, P), { tone: "lo", free: true })
      + `<g data-old class="wb-lit-group" style="display:none">`
      + S(k.cylinder(x + 6, TRAY_Y + 1, 0.4, CASE_H + 7, 8, P, 8), { tone: "mid", crease: "none" })
      + S(k.slabOf({ x: x + 6.4, y: TRAY_Y + 0.6, w: 9, d: 0.8, r: 0.2 }, CASE_H + 10.5, 4.5, P, 2), { tone: "hi", crease: "none", lit: true })
      + text(x + 10.9, TRAY_Y + 1.4, CASE_H + 11.6, "OLD", { size: 2.8, tone: "hi", anchor: "middle" })
      + `</g></g>`);
  });
  return out.join("");
}

export function customerSvg() {
  return S(k.cylinder(0, 0, 3.2, 0, 1, P, 20, 0.2), { tone: "mid" })
    + S(k.cylinder(0, 0, 2.4, 1, 7.4, P, 20), { tone: "hi", crease: "none" })
    + S(k.cylinder(0, 0, 2.9, 8.4, 1, P, 20, 0.2), { tone: "mid" })
    + S(k.cylinder(0, 0, 2.1, 9.4, 3.6, P, 18, 0.3), { tone: "hi", crease: "lo" });
}

function customers() {
  // Every spot, back rows first; the live script shows the occupied ones.
  const all = SPOTS.flatMap((row, key) => row.map(([x, y], n) => ({ x, y, key, n })));
  all.sort((a, b) => k.depthOf([a.x, a.y, 0], P) - k.depthOf([b.x, b.y, 0], P));
  return all.map(({ x, y, key, n }) => `<g data-spot="${key}-${n}" style="display:none" transform="${k.translateAlong(P, [x, y, 0])}">${customerSvg()}</g>`).join("");
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A bakery on a base plate. At the back stand an oven with four shelves and a load gauge, a ticket rail where numbered order tickets wait for a shelf, and a scoreboard counting waiting customers, duplicate orders and stale loaves served. In front is a display case of six numbered trays, each with an expiry dial. When a tray's loaf expires, customers who wanted it stand in front of the case and orders go to the oven; without coalescing every customer sends an order, so the oven and ticket rail fill with duplicates of the same tray.",
    body: [plate(), board(), oven(), rail(), displayCase(), `<g data-customers>${customers()}</g>`],
  });
}

export const GEOMETRY = { KEYS, SHELVES, RACK_SLOTS, GAUGE, TRAY_X, DIAL, SPOTS, BOARD_ROWS, TICKET };

// A warehouse picker filling an orders page. The packing table on the right is the app: one ticket per order
// on the page, and a box on each ticket once that order's items have arrived. The warehouse at the end of the
// aisle is the database; it slides along the aisle to the distance chosen. Every query is one trip down the
// aisle and back. A trip counter, a stopwatch and a data crate on the table read out the cost of the page.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip } from "../../workbench/parts.mjs";
import { digitPath, counterCells, digitsOf } from "./digits.js";

export const WIDTH = 700;
export const HEIGHT = 420;

const PLATE = { x: -150, y: -48, w: 292, d: 100, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// The table (the app).
export const TABLE = { x: 74, y: -40, w: 60, d: 80, r: 2.5 };
export const TABLE_H = 22;
const TOP = TABLE_H;
const FRONT = TABLE.y + TABLE.d;                // 40
export const PARK_X = 57;                       // where a picker stands at the table

// The order tickets: up to 50 slots, 10 to a row.
export const SLOT = { x0: 79.4, y0: -35.5, dx: 5.4, dy: 6.6, w: 4.2, d: 5.2, cols: 10, max: 50 };
export const slotAt = (i) => [SLOT.x0 + (i % SLOT.cols) * SLOT.dx, SLOT.y0 + Math.floor(i / SLOT.cols) * SLOT.dy];

// The stopwatch and the data crate on the front of the table.
export const WATCH = { x: 87, y: 23, r: 8, z: TOP + 3 };
export const WATCH_MS = 250;                    // one turn of the hand
export const CRATE = { x: 101, y: 12, w: 28, d: 22, wall: 1.4, h: 18 };
export const CRATE_LEVELS = [[1e4, "10 KB"], [1e5, "100 KB"], [1e6, "1 MB"]];
export const crateLevel = (bytes) => Math.max(0, Math.min(1, Math.log10(Math.max(1, bytes) / 1000) / 4));   // 1 KB → 0, 10 MB → 1

// Counters on the table's front face.
const PROUD = 1.2;
export const COUNTERS = {
  trips: { x: 104.6, y: FRONT + PROUD, z: 12.6, w: 4.8, h: 6.6, gap: 0.8, count: 4, size: "m" },
  ms: { x: 99, y: FRONT + PROUD, z: 3, w: 4.8, h: 6.6, gap: 0.8, count: 5, size: "m" },
};

// The warehouse (the database): built at the near stop and slid along x to the chosen distance.
export const STOPS = { host: 30, zone: -20, region: -104 };   // x of the warehouse's serving face
const WH = { w: 30, y: -42, d: 60, h: 44 };
export const SERVE_GAP = 4.5;                   // a picker stands this far in front of the serving face
export const LANES = [0, -10, 10, -5, 5];       // y of each picker's lane in the aisle (lane 0 is the single picker)
const AISLE = { x: -140, y: -16, w: 207, d: 32, r: 1 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [STOPS.region - WH.w, WH.y, WH.h + 4], [STOPS.host, WH.y, WH.h + 4], [STOPS.host, WH.y + WH.d, WH.h]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const faceTextY = (x, y, z, value, { size = 3, tone = "mid", anchor = "start", attr = "" } = {}) =>
  `<text class="iso-face-text" ${attr} data-tone="${tone}" transform="${k.sideMatrix([x, y], z, P, "left")}" font-size="${size}" text-anchor="${anchor}">${value}</text>`;
const topText = (x, y, z, value, { size = 3, tone = "lo", anchor = "middle" } = {}) => k.faceTextSvg(k.topMatrix([x, y], z, P, "x"), value, { size, tone, anchor });

// A counter: one window per wheel with its printed digit.
function counter(c, name, value = 0) {
  const out = [];
  const w = c.count * c.w + (c.count - 1) * c.gap + 2.4;
  out.push(S(k.slabOf({ x: c.x - 1.2, y: c.y - PROUD, w, d: PROUD, r: 0.4 }, c.z - 1, c.h + 2, P, 2), { tone: "hi", crease: "lo" }));
  const digits = digitsOf(value, c.count);
  counterCells(c).forEach((cell, j) => {
    out.push(`<path class="cw" d="${k.faceRectY(P, cell.x, cell.x + cell.w, cell.y, cell.z, cell.z + cell.h)}"/>`);
    out.push(`<path class="dg" data-size="${c.size}" data-digit="${name}-${j}" d="${digitPath(k.iso, P, cell, digits[j])}"/>`);
  });
  return out.join("");
}

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H }) + rulerStrip(P, { x: -142, y: 40, w: 96, d: 6, r: 1 });
}

// The aisle floor, with distance ticks along its front edge and a plaque at each stop.
function aisle() {
  const out = [S(k.slabOf(AISLE, 0, 0.6, P, 3), { tone: "lo", crease: "none" })];
  const t = k.topTicks(AISLE.x + 4, AISLE.x + AISLE.w - 4, 5, 5, AISLE.y + AISLE.d, 0.6, [-1.6, -3.2], P);
  out.push(L(t.minor, { tone: "faint" }), L(t.major, { tone: "lo" }));
  out.push(L(k.lineOnTop([AISLE.x + 3, 0], [AISLE.x + AISLE.w - 3, 0], 0.6, P), { tone: "faint", dashed: true }));
  return out.join("");
}

function plaques() {
  const out = [];
  const names = { host: ["SAME", "HOST"], zone: ["SAME", "ZONE"], region: ["OTHER", "ZONE"] };
  for (const [key, x] of Object.entries(STOPS)) {
    const plan = { x: x - 20, y: 22, w: 20, d: 12, r: 1.2 };
    out.push(`<g data-plaque="${key}">`);
    out.push(S(k.slabOf(plan, 0, 0.9, P, 3), { tone: "mid", crease: "none" }));
    out.push(L(k.planOutline(k.insetPlan(plan, 1.2), 0.9, P), { tone: "faint" }));
    out.push(topText(x - 10, 26.6, 0.9, names[key][0], { size: 2.7 }));
    out.push(topText(x - 10, 30.8, 0.9, names[key][1], { size: 2.7 }));
    // A short stake from the plaque to the aisle edge: the stop it marks.
    out.push(L(k.lineOnTop([x, AISLE.y + AISLE.d], [x, 22], 0.6, P), { tone: "lo" }));
    out.push(`</g>`);
  }
  return out.join("");
}

// The warehouse, at the near stop. Shelving on both visible faces, a serving counter where the pickers stand,
// and a lamp on the roof that lights while a query is being served.
function warehouse() {
  const fx = STOPS.host;
  const plan = { x: fx - WH.w, y: WH.y, w: WH.w, d: WH.d, r: 1.5 };
  const front = WH.y + WH.d;
  const out = [];
  const shelves = [];
  // Serving face (constant x): bays above the hatch, a hatch across the aisle.
  for (const z of [18, 26, 34]) shelves.push(k.segment([fx, WH.y + 2, z], [fx, front - 2, z], P));
  for (let y = WH.y + 2; y <= front - 2 + 1e-6; y += 8) shelves.push(k.segment([fx, y, 16], [fx, y, 42], P));
  const bins = [];
  for (const z of [18.8, 26.8, 34.8]) for (let y = WH.y + 3.5; y < front - 6; y += 8) bins.push(k.faceRectX(P, fx, y, y + 5, z, z + 5));
  const side = [];
  for (const z of [10, 18, 26, 34]) side.push(k.segment([fx - WH.w + 2, front, z], [fx - 2, front, z], P));
  for (let x = fx - WH.w + 2; x <= fx - 2 + 1e-6; x += 7) side.push(k.segment([x, front, 2], [x, front, 42], P));
  const sideBins = [];
  for (const z of [2.8, 10.8, 18.8, 26.8, 34.8]) for (let x = fx - WH.w + 3; x < fx - 5; x += 7) sideBins.push(k.faceRectY(P, x, x + 4.4, front, z, z + 4.6));
  out.push(S(k.slabOf(plan, 0, WH.h, P, 4, 0.6), {
    tone: "mid",
    inner: L(shelves.join("") + side.join(""), { tone: "lo" }) + L(bins.join("") + sideBins.join(""), { tone: "faint" }) + L(k.faceRectX(P, fx, -14, 14, 0.6, 14), { tone: "lo" }),
  }));
  // Roof: a parapet line and the lamp.
  out.push(L(k.planOutline(k.insetPlan(plan, 2.4), WH.h, P), { tone: "faint" }));
  out.push(S(k.cylinder(fx - 6, -2, 2.4, WH.h, 1.4, P, 18), { tone: "mid" }));
  out.push(`<g data-lamp="off">${S(k.cylinder(fx - 6, -2, 3, WH.h + 1.4, 2.6, P, 20, 0.4), { tone: "hi", crease: "lo" })}</g>`);
  out.push(`<g data-lamp="on" style="display:none">${S(k.cylinder(fx - 6, -2, 3, WH.h + 1.4, 2.6, P, 20, 0.4), { tone: "hi", crease: "lo", lit: true })}</g>`);
  // The serving counter: a ledge across the hatch.
  out.push(S(k.slabOf({ x: fx, y: -15, w: 3, d: 30, r: 0.5 }, 13, 1.6, P, 2), { tone: "hi", crease: "lo" }));
  return out.join("");
}

// The table: legs, top, the order tickets, the stopwatch, the crate, the counters.
function table() {
  const out = [];
  const t = TABLE;
  out.push(S(k.slabOf(k.insetPlan(t, 2), 0, 2, P, 3), { tone: "lo" }));
  out.push(S(k.slabOf(t, 2, TABLE_H - 2, P, 3, 0.5), {
    tone: "mid",
    inner: faceTextY(t.x + 4, FRONT, 14.4, "QUERIES", { size: 3.4, tone: "mid" }) + faceTextY(t.x + 4, FRONT, 4.8, "MS", { size: 3.4, tone: "mid" }),
  }));
  out.push(L(k.planOutline(k.insetPlan(t, 1.6), TOP, P), { tone: "faint" }));
  // Ticket slots, back row first.
  for (let i = 0; i < SLOT.max; i++) {
    const [x, y] = slotAt(i);
    const tile = { x, y, w: SLOT.w, d: SLOT.d, r: 0.4 };
    const box = { x: x + 0.5, y: y + 0.9, w: SLOT.w - 1, d: SLOT.d - 1.8, r: 0.3 };
    out.push(`<g data-slot="${i}">`);
    out.push(L(k.planOutline(tile, TOP, P, 2), { tone: "faint" }));
    out.push(`<g data-ticket style="display:none">${S(k.slabOf(tile, TOP, 0.5, P, 2), { tone: "hi", crease: "none" })}${L(k.lineOnTop([x + 0.8, y + 1], [x + SLOT.w - 0.8, y + 1], TOP + 0.5, P), { tone: "lo" })}</g>`);
    out.push(`<g data-box style="display:none">${S(k.slabOf(box, TOP + 0.5, 3.4, P, 2), { tone: "hi", crease: "lo" })}</g>`);
    out.push(`<g data-box-lit style="display:none">${S(k.slabOf(box, TOP + 0.5, 3.4, P, 2), { tone: "hi", crease: "lo", lit: true })}</g>`);
    out.push(`</g>`);
  }
  out.push(stopwatch(), crate());
  out.push(counter(COUNTERS.trips, "trips"), counter(COUNTERS.ms, "ms"));
  return out.join("");
}

function stopwatch() {
  const { x, y, r, z } = WATCH;
  const out = [];
  out.push(S(k.cylinder(x, y - r - 0.6, 1.2, TOP, 3, P, 12), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x, y - r - 1.6, 1.8, TOP + 3, 1.2, P, 14), { tone: "hi" }));
  out.push(S(k.cylinder(x, y, r, TOP, z - TOP, P, 36, 0.5), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(x, y, r - 1.2, z, P, 36), { tone: "faint" }));
  const ticks = k.radialTicks(x, y, r - 1.4, 10, 5, z, [1, 2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(`<path class="hand" data-hand d="${k.pathOf([at([x, y, z]), at([x, y - (r - 2.2), z])])}"/>`);
  out.push(D([at([x, y, z])], { size: 0.7, tone: "hi" }));
  return out.join("");
}

// The crate: a back wall with level marks, side walls, a low front lip; the fill block grows with the bytes fetched.
function crate() {
  const { x, y, w, d, wall, h } = CRATE;
  const out = [];
  out.push(S(k.slabOf({ x, y, w, d, r: 0.6 }, TOP, 0.8, P, 2), { tone: "lo" }));
  const back = { x, y, w, d: wall, r: 0.3 };
  const marks = CRATE_LEVELS.map(([b]) => { const zz = TOP + 0.8 + crateLevel(b) * (h - 1.6); return k.segment([x + 1.5, y + wall, zz], [x + w - 1.5, y + wall, zz], P); }).join("");
  const labels = CRATE_LEVELS.map(([b, label]) => faceTextY(x + w - 2, y + wall, TOP + 1.4 + crateLevel(b) * (h - 1.6), label, { size: 2.3, tone: "lo", anchor: "end" })).join("");
  out.push(S(k.slabOf(back, TOP, h, P, 2), { tone: "hi", crease: "lo", inner: L(marks, { tone: "lo" }) + labels }));
  out.push(S(k.slabOf({ x, y, w: wall, d, r: 0.3 }, TOP, h * 0.55, P, 2), { tone: "hi", crease: "lo" }));
  out.push(`<g data-fill>${S(k.slabOf({ x: x + wall + 0.4, y: y + wall + 0.4, w: w - 2 * wall - 0.8, d: d - 2 * wall - 0.8, r: 0.4 }, TOP + 0.8, 1, P, 2), { tone: "hi", crease: "lo" })}</g>`);
  out.push(S(k.slabOf({ x: x + w - wall, y, w: wall, d, r: 0.3 }, TOP, h * 0.55, P, 2), { tone: "hi", crease: "lo" }));
  out.push(S(k.slabOf({ x, y: y + d - wall, w, d: wall, r: 0.3 }, TOP, 2.4, P, 2), { tone: "hi", crease: "lo" }));
  return out.join("");
}

// The fill block for a given level (0..1), as markup; the live script swaps it in.
export function fillSvg(level) {
  const { x, y, w, d, wall, h } = CRATE;
  const height = Math.max(0.01, level * (h - 1.6));
  return S(k.slabOf({ x: x + wall + 0.4, y: y + wall + 0.4, w: w - 2 * wall - 0.8, d: d - 2 * wall - 0.8, r: 0.4 }, TOP + 0.8, height, P, 2), { tone: "hi", crease: "lo", lit: level > 0 });
}

// A picker, built at the origin: base, body, collar, head; a pick slip held in front; a box carried back.
export const PICKER_SCALE = 1.5;
export function pickerSvg() {
  const m = PICKER_SCALE, out = [];
  out.push(S(k.cylinder(0, 0, 4.4 * m, 0, 1.2 * m, P, 22, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(0, 0, 3.2 * m, 1.2 * m, 9.6 * m, P, 20), { tone: "hi", crease: "none" }));
  out.push(S(k.cylinder(0, 0, 3.9 * m, 10.8 * m, 1.1 * m, P, 20, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(0, 0, 2.7 * m, 11.9 * m, 4.6 * m, P, 18, 0.3), { tone: "hi", crease: "lo" }));
  // The slip: one id for a single query, a long list for a batch.
  const y = 3.4 * m, w = 5.6 * m;
  out.push(`<g data-slip="one" style="display:none">${S(k.slabOf({ x: -w / 2, y, w, d: 0.8, r: 0.2 }, 5.5 * m, 4.4 * m, P, 1), { tone: "hi", crease: "lo" })}${L(k.segment([-w / 2 + 1.4, y + 0.8, 7.7 * m], [w / 2 - 1.4, y + 0.8, 7.7 * m], P), { tone: "lo" })}</g>`);
  out.push(`<g data-slip="list" style="display:none">${S(k.slabOf({ x: -w / 2, y, w, d: 0.8, r: 0.2 }, 2.6 * m, 10.4 * m, P, 1), { tone: "hi", crease: "lo" })}${L([11.4, 10, 8.6, 7.2, 5.8, 4.4].map((z) => k.segment([-w / 2 + 1.4, y + 0.8, z * m], [w / 2 - 1.4, y + 0.8, z * m], P)).join(""), { tone: "lo" })}</g>`);
  return out.join("");
}

// The carried box, built at the origin on its base; the live script scales it with the bytes it holds.
export function cargoSvg() {
  return S(k.slabOf({ x: -3, y: -3, w: 6, d: 6, r: 0.5 }, 0, 5, P, 2), { tone: "hi", crease: "lo", lit: true })
    + L(k.lineOnTop([-3, 0], [3, 0], 5, P), { tone: "lo" });
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A warehouse picker filling one page of orders. On the right, a packing table holds a ticket for each order on the page and a box on each ticket whose items have arrived, with a stopwatch, a crate that fills with the data fetched, and counters for queries and milliseconds on its front. A long aisle runs to a warehouse that stands at one of three distances: same host, same zone or other zone. Each query is one trip down the aisle and back: out with a slip, back with a box.",
    body: [
      plate(),
      aisle(),
      `<g data-warehouse>${warehouse()}</g>`,
      plaques(),
      `<g data-pickers></g>`,
      table(),
    ],
  });
}

export const GEOMETRY = { PICKER_SCALE, TABLE, TABLE_H, PARK_X, SLOT, WATCH, WATCH_MS, CRATE, COUNTERS, STOPS, SERVE_GAP, LANES };

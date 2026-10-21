// Connection pooling as a taxi rank. Each hotel is an app instance; its rank of cabs is its connection pool.
// The airport terminal at the back is the database: every cab that exists holds one of its permits
// (max_connections, the board on its front), and a cab parked at the kerb is a query running.
//   booth at the end of each road: where a new cab registers (TCP + TLS + auth) before it can be used
//   lay-by beside each road: cabs held while their passenger makes an outside call (an API inside the transaction)
//   fenced lot behind each hotel: cabs that were never given back (leaked connections)
//   lamps on the terminal (pooler mode): the 20 server connections a shared pooler keeps
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate } from "../../workbench/parts.mjs";
import { digitPath, counterCells, digitsOf } from "./digits.js";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -98, y: -107, w: 196, d: 152, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

export const COLS = [0, 1, 2, 3].map((j) => -69 + 46 * j);
const TERM = { x: -94, y: -103, w: 188, d: 21, r: 2 };
const TERM_H = 22;
export const FACADE_Y = TERM.y + TERM.d;            // -88
const KERB = { x: -94, y: -81.5, w: 188, d: 13.5, r: 1 };
export const KERB_EDGE = -68;                        // cabs past this line are at the kerb
export const BAY_ROWS = [-77.8, -71.8];
export const BAY_X0 = -90.5, BAY_STEP = 5.6, BAYS_PER_ROW = 33;
export const RANK_EDGE = 9.2;                        // cabs past this line are on the rank
export const ROAD = { dx: -12, half: 4.2, y0: -68, y1: 9.6 };   // road centre at cx + dx
export const STACK = { y: -63.5, step: 6.2, max: 5 };         // cabs queueing at the booth / pooler stop line
export const LAYBY = { dx: -22.2, y: -40, step: 6.1, max: 6 };
export const LOT = { dx: -1.6, y: -55.5, cols: 4, rows: 3, sx: 5.2, sy: 6 };
const HOTEL = { dx: -5, y: -14, w: 21, d: 18, h: 16 };
export const PEOPLE = { dx: -2.6, y: 6.4, step: 3.9, max: 5, scale: 0.95 };
export const RANK = { dx: -12.4, y: 13.4, sx: 6.2, sy: 7, cols: 5, rows: 4 };
export const CAB = { w: 3.8, d: 5.4 };
export const PERMITS = { cols: 15, rows: 4 };
const PROUD = 1.2;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [TERM.x, TERM.y, TERM_H + 4], [TERM.x + TERM.w, TERM.y, TERM_H + 4]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 50 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);

// Counters: a thin housing on a front face (constant y), one window per wheel with its printed digit.
export const COUNTERS = {
  open: { x: -16.5, y: FACADE_Y + PROUD, z: 6, w: 6, h: 10, gap: 1, count: 2, size: "l", housing: { x: -19, z0: 3.8, z1: 18.2 } },
  wait: COLS.map((cx) => ({ x: cx + HOTEL.dx + 10.2, y: HOTEL.y + HOTEL.d + PROUD, z: 8.6, w: 4.4, h: 5.8, gap: 0.7, count: 2, size: "m", housing: { x: cx + HOTEL.dx + 8.8, z0: 7.4, z1: 15.6 } })),
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

// ---------- the terminal (the database) ----------
export const GAUGE = { x: 74, y: -92.5, z: TERM_H + 1.6, r: 7.5 };
export const NEEDLE_SPAN = [-0.75 * Math.PI, 0.75 * Math.PI];   // ×1 at the left stop, ×32 at the right
function terminal() {
  const out = [];
  const f = FACADE_Y;
  // Body, a roof parapet, glazed entrance doors at the right end.
  const doors = [];
  for (let n = 0; n < 3; n++) { const x0 = 60 + n * 9; doors.push(k.faceRectY(P, x0, x0 + 7.2, f, 0.6, 12)); doors.push(k.segment([x0 + 3.6, f, 0.6], [x0 + 3.6, f, 12], P)); }
  out.push(S(k.slabOf(TERM, 0, TERM_H, P, 4, 0.6), { tone: "mid", inner: L(doors.join(""), { tone: "lo" }) }));
  out.push(L(k.planOutline(k.insetPlan(TERM, 2.2), TERM_H, P), { tone: "faint" }));
  out.push(S(k.slabOf({ x: 57, y: f, w: 33, d: 3.4, r: 0.4 }, 12.6, 1.4, P, 2), { tone: "hi", crease: "lo" }));   // canopy over the doors
  // The permit board: one cell per connection the database allows (max_connections = 60).
  const board = { x: -90, z0: 3, z1: 20.4 };
  const pitchX = 4.5, pitchZ = 4.1, cw = 3.6, ch = 3.2;
  out.push(S(k.slabOf({ x: board.x, y: f, w: PERMITS.cols * pitchX + 1.8, d: PROUD, r: 0.4 }, board.z0, board.z1 - board.z0, P, 2), { tone: "hi", crease: "lo" }));
  const cells = [];
  for (let n = 0; n < PERMITS.cols * PERMITS.rows; n++) {
    const col = n % PERMITS.cols, row = Math.floor(n / PERMITS.cols);
    const x0 = board.x + 1.3 + col * pitchX, z1 = board.z1 - 1.2 - row * pitchZ;
    cells.push(`<path class="pm" data-permit="${n}" d="${k.faceRectY(P, x0, x0 + cw, f + PROUD, z1 - ch, z1)}"/>`);
  }
  out.push(cells.join(""));
  out.push(counter(COUNTERS.open, "open", 0));
  // The pooler's lamps: its 20 server connections, lit while one is lent to a transaction.
  const lamps = [`<g data-pooler-panel style="display:none">`];
  lamps.push(S(k.slabOf({ x: 0, y: f, w: 48, d: PROUD, r: 0.4 }, 4.5, 13, P, 2), { tone: "hi", crease: "lo" }));
  for (let n = 0; n < 20; n++) {
    const col = n % 10, row = Math.floor(n / 10);
    const x0 = 2 + col * 4.6, z0 = 12.6 - row * 5.8;
    lamps.push(`<g data-lamp="${n}">${S(k.slabOf({ x: x0, y: f + PROUD, w: 2.9, d: 1.6, r: 0.6 }, z0, 2.9, P, 3), { tone: "hi", crease: "lo" })}</g>`);
  }
  lamps.push(`</g>`);
  out.push(lamps.join(""));
  // The congestion gauge on the roof: how much slower each query runs than on a quiet database.
  const g = GAUGE;
  out.push(S(k.slabOf({ x: g.x - 9.5, y: g.y - 8.5, w: 19, d: 17, r: 1.5 }, TERM_H, 0.8, P, 3), { tone: "hi", crease: "lo" }));
  out.push(S(k.cylinder(g.x, g.y, g.r, TERM_H + 0.8, 0.8, P, 40, 0.3), { tone: "hi", crease: "lo" }));
  const t = k.radialTicks(g.x, g.y, g.r - 0.8, 12, 4, g.z, [1, 2], P, NEEDLE_SPAN[0], NEEDLE_SPAN[1] - NEEDLE_SPAN[0]);
  out.push(L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }));
  out.push(`<path class="needle" data-needle d=""/>`);
  out.push(S(k.cylinder(g.x, g.y, 1, g.z, 0.7, P, 14), { tone: "mid", crease: "none" }));
  return out.join("");
}

function kerb() {
  const out = [S(k.slabOf(KERB, 0, 0.8, P, 3), { tone: "lo", crease: "none" })];
  const lines = [];
  for (let n = 0; n <= BAYS_PER_ROW; n++) { const x = BAY_X0 - BAY_STEP / 2 + n * BAY_STEP; lines.push(k.lineOnTop([x, KERB.y + 1.4], [x, KERB.y + KERB.d - 1.4], 0.8, P)); }
  lines.push(k.lineOnTop([KERB.x + 2, (BAY_ROWS[0] + BAY_ROWS[1]) / 2], [KERB.x + KERB.w - 2, (BAY_ROWS[0] + BAY_ROWS[1]) / 2], 0.8, P));
  out.push(L(lines.join(""), { tone: "faint" }));
  return out.join("");
}

// ---------- a hotel column (an app instance) ----------
function person(x, y, scale) {
  const r = 1.6 * scale, h = 5.2 * scale, hr = 1.25 * scale;
  return S(k.cylinder(x, y, r, 0.6, h, P, 14, 0.3 * scale), { tone: "hi", crease: "lo" })
    + S(k.cylinder(x, y, hr, h + 0.8, 2.2 * scale, P, 12, 0.5 * scale), { tone: "hi", crease: "none" });
}

function booth(cx, j) {
  const x = cx - 6.5, y = -66.8;
  return S(k.slabOf({ x, y, w: 6, d: 6, r: 0.8 }, 0, 5, P, 3, 0.4), { tone: "hi", crease: "lo", inner: L(k.faceRectY(P, x + 1.2, x + 4.8, y + 6, 2.2, 4.2), { tone: "lo" }) })
    + S(k.slabOf({ x: x - 0.6, y: y - 0.6, w: 7.2, d: 7.2, r: 1 }, 5, 0.9, P, 3), { tone: "mid", crease: "none" })
    + `<g data-booth-lamp="${j}">${S(k.cylinder(x + 3, y + 3, 1.2, 5.9, 1.8, P, 14, 0.4), { tone: "hi", crease: "lo" })}</g>`;
}

function lot(cx) {
  const x0 = cx + LOT.dx - 2.6, y0 = LOT.y - 3.2, w = LOT.cols * LOT.sx + 1.4, d = LOT.rows * LOT.sy + 1.2;
  const out = [S(k.slabOf({ x: x0, y: y0, w, d, r: 0.8 }, 0, 0.5, P, 3), { tone: "lo", crease: "none" })];
  const posts = [[x0, y0], [x0 + w, y0], [x0, y0 + d], [x0 + w, y0 + d], [x0 + w / 2, y0], [x0, y0 + d / 2]];
  const rails = [[[x0, y0], [x0 + w, y0]], [[x0, y0], [x0, y0 + d]], [[x0 + w, y0], [x0 + w, y0 + d]], [[x0, y0 + d], [x0 + w * 0.55, y0 + d]]];
  out.push(L(rails.map(([a, b]) => k.segment([a[0], a[1], 3], [b[0], b[1], 3], P) + k.segment([a[0], a[1], 1.6], [b[0], b[1], 1.6], P)).join(""), { tone: "lo" }));
  out.push(L(posts.map(([x, y]) => k.segment([x, y, 0.5], [x, y, 3.6], P)).join(""), { tone: "mid" }));
  return out.join("");
}

function hotel(cx, j) {
  const h = { x: cx + HOTEL.dx, y: HOTEL.y, w: HOTEL.w, d: HOTEL.d, r: 1.2 };
  const f = h.y + h.d, side = h.x + h.w;
  const marks = [k.faceRectY(P, h.x + 2, h.x + 6.4, f, 0.6, 8)];                       // the door
  for (let z = 10.5; z < h.h - 2; z += 4) marks.push(k.faceRectX(P, side, h.y + 2.5, h.y + h.d - 2.5, z, z + 2.2));   // windows down the side
  const out = [S(k.slabOf(h, 0, HOTEL.h, P, 3, 0.5), { tone: "hi", crease: "lo", inner: L(marks.join(""), { tone: "lo" }) })];
  out.push(L(k.planOutline(k.insetPlan(h, 1.4), HOTEL.h, P), { tone: "faint" }));
  out.push(S(k.slabOf({ x: h.x + 0.8, y: f, w: 7, d: 3, r: 0.4 }, 8.6, 1, P, 2), { tone: "mid", crease: "none" }));   // canopy over the door
  out.push(counter(COUNTERS.wait[j], "wait" + j, 0));
  return out.join("");
}

function rank(cx, j) {
  const pad = { x: cx - 16.6, y: 9.6, w: 33.2, d: 29, r: 1.2 };
  const out = [S(k.slabOf(pad, 0, 0.6, P, 3), { tone: "lo", crease: "none" })];
  for (let s = 0; s < RANK.cols * RANK.rows; s++) {
    const [x, y] = rankSlot(cx, s);
    out.push(`<g data-rankslot="${j}-${s}">${L(k.planOutline({ x: x - CAB.w / 2 - 0.5, y: y - CAB.d / 2 - 0.5, w: CAB.w + 1, d: CAB.d + 1, r: 0.4 }, 0.6, P, 2), { tone: "faint" })}</g>`);
  }
  return out.join("");
}
export const rankSlot = (cx, s) => [cx + RANK.dx + (s % RANK.cols) * RANK.sx, RANK.y + Math.floor(s / RANK.cols) * RANK.sy];

function column(cx, j) {
  const road = { x: cx + ROAD.dx - ROAD.half, y: ROAD.y0, w: ROAD.half * 2, d: ROAD.y1 - ROAD.y0, r: 0.6 };
  const layby = { x: cx + LAYBY.dx - 2.6, y: LAYBY.y - 3, w: 5.2, d: LAYBY.max * LAYBY.step + 0.8, r: 0.6 };
  const out = [`<g data-col="${j}">`];
  out.push(lot(cx));
  out.push(S(k.slabOf(road, 0, 0.5, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.lineOnTop([cx + ROAD.dx, ROAD.y0 + 8], [cx + ROAD.dx, ROAD.y1 - 2], 0.5, P), { tone: "faint", dashed: true }));
  out.push(S(k.slabOf(layby, 0, 0.5, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(Array.from({ length: LAYBY.max + 1 }, (_, n) => k.lineOnTop([layby.x + 0.6, layby.y + 0.4 + n * LAYBY.step], [layby.x + layby.w - 0.6, layby.y + 0.4 + n * LAYBY.step], 0.5, P)).join(""), { tone: "faint" }));
  out.push(`<g data-roadcabs="${j}"></g>`);
  out.push(booth(cx, j));
  out.push(hotel(cx, j));
  out.push(`<g data-people="${j}">`);
  for (let n = 0; n < PEOPLE.max; n++) out.push(`<g data-person="${j}-${n}" style="display:none">${person(cx + PEOPLE.dx + n * PEOPLE.step, PEOPLE.y, PEOPLE.scale)}</g>`);
  out.push(`</g>`);
  out.push(rank(cx, j));
  out.push(`<g data-rankcabs="${j}"></g>`);
  out.push(`</g>`);
  // An empty plot where a hotel would stand when that instance isn't running.
  out.push(`<g data-plot="${j}" style="display:none">${L(k.planOutline({ x: cx - 16.6, y: -14, w: 33.2, d: 52.6, r: 2 }, 0, P), { tone: "faint", dashed: true })}</g>`);
  return out.join("");
}

// A cab: body, cabin, roof sign, and a passenger's head when it is carrying one. Pointing along the roads (y).
export function cabSvg() {
  const body = k.slabOf({ x: -CAB.w / 2, y: -CAB.d / 2, w: CAB.w, d: CAB.d, r: 0.8 }, 0.6, 2.2, P, 3, 0.3);
  return S(body, { tone: "hi", crease: "lo", lit: true })
    + S(k.slabOf({ x: -1.5, y: -1.6, w: 3, d: 2.8, r: 0.5 }, 2.8, 1.5, P, 2, 0.2), { tone: "hi", crease: "lo" })
    + S(k.slabOf({ x: -0.8, y: -1.4, w: 1.6, d: 0.9, r: 0.2 }, 4.3, 0.8, P, 1), { tone: "mid", crease: "none" })
    + `<g data-pax style="display:none">${S(k.cylinder(0, 0.5, 0.95, 4.3, 1.5, P, 14, 0.45), { tone: "hi", crease: "lo" })}</g>`;
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A taxi rank model of connection pooling. Along the front, up to four hotels (app instances) each have a rank of parked cabs (its connection pool) and a queue of passengers (requests). A road runs from each hotel back to an airport terminal (the database). A cab at the terminal kerb is a query running; the board on the terminal front has one cell per connection the database allows, filled for every cab that exists. A booth at the end of each road registers new cabs, a lay-by holds cabs waiting on an outside call, and a fenced lot behind each hotel collects cabs that were never returned. A gauge on the roof shows how much slower each query runs.",
    body: [
      basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H }),
      terminal(),
      kerb(),
      `<g data-kerbcabs></g>`,
      COLS.map((cx, j) => column(cx, j)).join(""),
    ],
  });
}

export const GEOMETRY = { COLS, RANK_EDGE, ROAD, STACK, LAYBY, LOT, PEOPLE, RANK, CAB, KERB_EDGE, BAY_ROWS, BAY_X0, BAY_STEP, BAYS_PER_ROW, COUNTERS, GAUGE, NEEDLE_SPAN };

// A payment counter: four customers send payment slips down lanes to card terminals on a long
// counter; replies come back the same way, and a lost reply drops into the trough across the lanes.
// Behind the counter, the key rack: one pigeonhole per idempotency key, holding the stored receipt
// (or a flag while the charge is still in progress). The till at the right counts orders vs charges.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip } from "../../workbench/parts.mjs";

export const WIDTH = 700;
export const HEIGHT = 460;

const PLATE = { x: -112, y: -94, w: 240, d: 160, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;

export const XS = [-74, -36, 2, 40];        // lane centres, one per customer
export const LANE = 3.4;                    // requests at x - LANE, replies at x + LANE

// The service counter, its terminals and the trays where a slip waits while the card is charged.
const DESK = { x: -100, y: -46, w: 162, d: 16, r: 2 };
const DESK_H = 13;
export const DESK_FRONT = DESK.y + DESK.d;  // -28
export const TRAY = XS.map((x) => [x - 7.5, DESK.y + 9]);
export const TRAY_Z = DESK_H + 1;

// The trough across the lanes: lost replies fall in and stay.
const TROUGH = { x: -96, y: 2, w: 156, d: 10, r: 1.5 };
export const TROUGH_H = 4;
export const TROUGH_Y = TROUGH.y + TROUGH.d / 2;
export const LANE_FAR = DESK_FRONT;         // lanes run from the counter...
export const LANE_NEAR = 40;                // ...to the customers

export const CUSTOMER_Y = 50;

// The key rack: a cabinet of pigeonholes, front face toward the viewer.
const RACK = { x: -100, y: -88, w: 168, d: 16, r: 2 };
const RACK_H = 66;
export const RACK_FACE = RACK.y + RACK.d;   // -72
export const COLS = 10, ROWS = 3;
const HOLE = { x0: RACK.x + 4, w: 15.2, gap: 0.8, z0: 19, h: 10.4, gapZ: 2 };
export const HOLES = Array.from({ length: COLS * ROWS }, (_, i) => {
  const c = i % COLS, r = Math.floor(i / COLS);
  const x0 = HOLE.x0 + c * (HOLE.w + HOLE.gap);
  const z0 = HOLE.z0 + (ROWS - 1 - r) * (HOLE.h + HOLE.gapZ);
  return { x0, x1: x0 + HOLE.w, z0, z1: z0 + HOLE.h };
});

// The till: two counters on its front face (orders paid, card charges), a third for replays.
const TILL = { x: 78, y: -4, w: 42, d: 32, r: 2.5 };
const TILL_H = 44;
export const TILL_FACE = TILL.y + TILL.d;   // 28

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [RACK.x, RACK.y, RACK_H + 2], [RACK.x + RACK.w, RACK.y, RACK_H + 2], [TILL.x + TILL.w, TILL.y, TILL_H + 2], [TILL.x + TILL.w, TILL.y + TILL.d, 0], [XS[0] - 6, CUSTOMER_Y + 8, 30]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const faceY = (x0, x1, y, z0, z1) => k.faceRectY(P, x0, x1, y, z0, z1);
export const textY = (x, y, z, value, { size = 3, tone = "mid", anchor = "start", attr = "" } = {}) =>
  `<text class="iso-face-text" ${attr} data-tone="${tone}" transform="${k.sideMatrix([x, y], z, P, "left")}" font-size="${size}" text-anchor="${anchor}">${value}</text>`;

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: 64, y: 50, w: 56, d: 6, r: 1 });
}

// ---------- the key rack ----------
function rack() {
  const out = [];
  out.push(S(k.slabOf(RACK, 0, RACK_H, P, 4, 0.6), { tone: "mid" }));
  const f = RACK_FACE;
  // Header plaque and a cornice line.
  out.push(textY(RACK.x + 5, f, RACK_H - 5.2, "KEY RACK · ONE STORED RECEIPT PER KEY", { size: 3.2, tone: "lo" }));
  out.push(L(k.segment([RACK.x + 4, f, RACK_H - 7.4], [RACK.x + RACK.w - 4, f, RACK_H - 7.4], P), { tone: "faint", free: true }));
  // Pigeonholes: an outer frame and an inset back wall, so each reads as a recess.
  out.push(L(HOLES.map((h) => faceY(h.x0, h.x1, f, h.z0, h.z1)).join(""), { tone: "lo" }));
  out.push(L(HOLES.map((h) => k.segment([h.x0 + 1.2, f, h.z0 + 1.2], [h.x1 - 1.2, f, h.z0 + 1.2], P) + k.segment([h.x0 + 1.2, f, h.z0 + 1.2], [h.x0 + 1.2, f, h.z1 - 1.2], P)).join(""), { tone: "faint", free: true }));
  // Replays counter on the plinth below the holes.
  out.push(textY(RACK.x + 70, f, 8.6, "ANSWERED FROM THE RACK", { size: 3, tone: "mid" }));
  out.push(counter(RACK.x + 118, f, 4.6, 4, "replays", 6));
  return out.join("");
}

// One pigeonhole's contents, drawn three ways and toggled live: a receipt, a lit receipt, an in-progress flag.
export function holeSvg(i) {
  const h = HOLES[i], f = RACK_FACE, cx = (h.x0 + h.x1) / 2;
  const card = k.slabOf({ x: h.x0 + 2, y: f - 0.6, w: h.x1 - h.x0 - 4, d: 1.6, r: 0.3 }, h.z0 + 1.2, h.z1 - h.z0 - 2.6, P, 1, 0.2);
  const label = (tone) => textY(cx, f + 1, h.z0 + 3.4, "", { size: 3.4, tone, anchor: "middle", attr: "data-hole-key" });
  const flag = S(k.cylinder(h.x0 + 4, f + 2.4, 0.45, h.z0 + 1, 7.6, P, 8), { tone: "mid", crease: "none" })
    + S(k.slabOf({ x: h.x0 + 4.4, y: f + 2, w: 6, d: 0.8, r: 0.2 }, h.z0 + 5.2, 3.4, P, 1), { tone: "hi", crease: "lo" });
  return `<g data-hole="${i}" style="display:none">`
    + `<g data-card>${S(card, { tone: "hi", crease: "lo" })}</g>`
    + `<g data-card-lit style="display:none">${S(card, { tone: "hi", crease: "lo", lit: true })}</g>`
    + `<g data-flag style="display:none">${flag}</g>`
    + label("hi")
    + `</g>`;
}

// A digit counter on a face of constant y: a proud housing with one window per wheel.
function counter(x0, y, z, wheels, name, size = 5) {
  const w = size * 0.95, hgt = size * 1.55, out = [];
  out.push(S(k.slabOf({ x: x0, y, w: wheels * w + 2, d: 1.6, r: 0.4 }, z, hgt + 2, P, 2, 0.3), { tone: "mid" }));
  const front = y + 1.6;
  for (let n = 0; n < wheels; n++) {
    const a = x0 + 1 + n * w + 0.35, b = a + w - 0.7;
    out.push(L(faceY(a, b, front, z + 1, z + 1 + hgt), { tone: "lo" }));
    out.push(L(k.segment([a + 0.5, front, z + 1 + hgt - 1.2], [b - 0.5, front, z + 1 + hgt - 1.2], P) + k.segment([a + 0.5, front, z + 2.2], [b - 0.5, front, z + 2.2], P), { tone: "faint", free: true }));
    out.push(textY((a + b) / 2, front, z + 1 + hgt * 0.24, "0", { size: size * 0.92, tone: "hi", anchor: "middle", attr: `data-digit="${name}${n}"` }));
  }
  return out.join("");
}

// ---------- the till ----------
function till() {
  const out = [];
  out.push(S(k.slabOf(TILL, 0, TILL_H, P, 4, 0.6), { tone: "mid" }));
  const f = TILL_FACE, x0 = TILL.x + 4;
  out.push(textY(x0, f, TILL_H - 5.2, "ORDERS PAID", { size: 3.2, tone: "mid" }));
  out.push(counter(x0, f, TILL_H - 19, 4, "orders", 7));
  out.push(textY(x0, f, 18.6, "CARD CHARGES", { size: 3.2, tone: "mid" }));
  out.push(counter(x0, f, 3.4, 4, "charges", 7));
  // A receipt printer slot on top.
  out.push(L(k.planOutline({ x: TILL.x + 6, y: TILL.y + 8, w: 30, d: 6, r: 1 }, TILL_H, P, 2), { tone: "lo" }));
  return out.join("");
}

// ---------- the counter, terminals and lanes ----------
function desk() {
  const out = [];
  out.push(S(k.slabOf(k.insetPlan(DESK, 1.5), 0, 2, P, 3), { tone: "lo" }));
  out.push(S(k.slabOf(DESK, 2, DESK_H - 2, P, 3, 0.5), { tone: "mid" }));
  // Lane mouths on the counter front.
  out.push(L(XS.map((cx) => faceY(cx - 7, cx + 7, DESK_FRONT, 1.2, 5)).join(""), { tone: "lo" }));
  return out.join("");
}

// A card terminal per lane: a body, a screen that lights while it charges, and a keypad.
function terminal(i) {
  const cx = XS[i] + 6, cy = DESK.y + 8;
  const body = { x: cx - 4.5, y: cy - 5, w: 9, d: 10, r: 1.2 };
  const screen = { x: cx - 3.3, y: cy - 4, w: 6.6, d: 4, r: 0.6 };
  return S(k.slabOf(body, DESK_H, 4, P, 2, 0.4), { tone: "hi", crease: "lo" })
    + `<g data-screen="${i}">${S(k.slabOf(screen, DESK_H + 4, 0.6, P, 2), { tone: "mid", crease: "none" })}</g>`
    + `<g data-screen-lit="${i}" style="display:none">${S(k.slabOf(screen, DESK_H + 4, 0.6, P, 2), { tone: "hi", lit: true })}</g>`
    + D([0, 1, 2].flatMap((c) => [0, 1].map((r) => at([cx - 2.4 + c * 2.4, cy + 2 + r * 1.8, DESK_H + 4]))), { size: 0.35, tone: "lo" })
    // The tray beside it where the slip being charged sits.
    + L(k.planOutline({ x: TRAY[i][0] - 4.5, y: TRAY[i][1] - 4, w: 9, d: 8, r: 0.8 }, DESK_H, P, 2), { tone: "lo" });
}

function lanes() {
  const out = [];
  // The trough first (lanes bridge over it).
  out.push(S(k.slabOf(TROUGH, 0, TROUGH_H, P, 3, 0.3), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(TROUGH, 1.4), TROUGH_H, P, 3), { tone: "mid" }));
  out.push(textY(TROUGH.x + 3, TROUGH.y + TROUGH.d, 0.7, "REPLIES LOST ON THE WAY BACK", { size: 2.8, tone: "mid" }));
  XS.forEach((cx) => {
    for (const [y0, y1] of [[LANE_FAR, TROUGH.y], [TROUGH.y + TROUGH.d, LANE_NEAR]]) {
      out.push(S(k.slabOf({ x: cx - 7, y: y0, w: 14, d: y1 - y0, r: 0.6 }, 0, 0.6, P, 2), { tone: "lo", crease: "none" }));
      out.push(L([cx - LANE, cx + LANE].map((x) => k.lineOnTop([x, y0], [x, y1], 0.6, P)).join(""), { tone: "faint" }));
    }
    // The request lane bridges the trough; the reply lane has a gap there.
    out.push(S(k.slabOf({ x: cx - LANE - 2, y: TROUGH.y, w: 4, d: TROUGH.d, r: 0.3 }, TROUGH_H, 0.6, P, 1), { tone: "lo", crease: "none" }));
  });
  return out.join("");
}

// ---------- customers ----------
const SLIP = { x: -9.5, y: 5.4, w: 19, d: 1, r: 0.3 };
const SLIP_Z = [9, 19.6];
export function customerSvg(i) {
  const out = [`<g data-customer="${i}">`];
  out.push(S(k.cylinder(0, 0, 5.6, 0, 1.6, P, 26, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(0, 0, 4.2, 1.6, 12.4, P, 24), { tone: "hi", crease: "none" }));
  out.push(S(k.cylinder(0, 0, 5, 14, 1.4, P, 24, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(0, 0, 3.4, 15.4, 5.8, P, 22, 0.3), { tone: "hi", crease: "lo" }));
  const slip = k.slabOf(SLIP, SLIP_Z[0], SLIP_Z[1] - SLIP_Z[0], P, 1, 0.2);
  const front = SLIP.y + SLIP.d;
  out.push(`<g data-slip style="display:none">`
    + `<g data-slip-plain>${S(slip, { tone: "hi", crease: "lo" })}</g>`
    + `<g data-slip-lit style="display:none">${S(slip, { tone: "hi", crease: "lo", lit: true })}</g>`
    + textY(0, front, 14.6, "", { size: 4.2, tone: "hi", anchor: "middle", attr: "data-slip-top" })
    + textY(0, front, 10.9, "", { size: 2.2, tone: "mid", anchor: "middle", attr: "data-slip-note" })
    + `</g>`);
  out.push(`</g>`);
  return out.join("");
}

// ---------- tokens ----------
// A request slip, a reply receipt (puck), a replay (puck with a raised ring, lit), a 409 (cube) and a 422 (upright card).
export function tokenSvgs() {
  return {
    req: S(k.slabOf({ x: -2.6, y: -1.8, w: 5.2, d: 3.6, r: 0.4 }, 0.6, 1.2, P, 1), { tone: "hi", crease: "lo" }),
    ok: S(k.cylinder(0, 0, 2.6, 0.6, 2.2, P, 18), { tone: "hi", crease: "lo" }),
    replay: S(k.cylinder(0, 0, 2.6, 0.6, 2.2, P, 18), { tone: "hi", crease: "lo", lit: true }) + S(k.cylinder(0, 0, 1.4, 2.8, 1.2, P, 14), { tone: "hi", lit: true }),
    "409": S(k.slabOf({ x: -1.8, y: -1.8, w: 3.6, d: 3.6, r: 0.4 }, 0.6, 3.6, P, 1), { tone: "mid" }),
    "422": S(k.slabOf({ x: -2.4, y: -0.5, w: 4.8, d: 1, r: 0.2 }, 0.6, 5, P, 1), { tone: "mid" }),
    work: S(k.slabOf({ x: -3, y: -2.2, w: 6, d: 4.4, r: 0.4 }, 0, 1, P, 1), { tone: "hi", crease: "lo" }),
    workLit: S(k.slabOf({ x: -3, y: -2.2, w: 6, d: 4.4, r: 0.4 }, 0, 1, P, 1), { tone: "hi", crease: "lo", lit: true }),
  };
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A payment counter on a base plate. Four customers stand at the front, each holding a slip with their order's key and how many times they have tried. Lanes run from each customer to a card terminal on a long counter; payment slips go up one side, replies come back the other, and a trough across the lanes catches replies lost on the way. Behind the counter, a rack of pigeonholes holds one stored receipt per key, or a flag while that key's charge is still in progress. A till at the right counts orders paid and card charges; when charges run ahead of orders, someone was charged twice.",
    body: [
      plate(),
      rack(),
      `<g data-holes>${HOLES.map((_, i) => holeSvg(i)).join("")}</g>`,
      desk(),
      XS.map((_, i) => terminal(i)).join(""),
      `<g data-work></g>`,
      lanes(),
      `<g data-tokens></g>`,
      till(),
      `<g data-customers>${XS.map((x, i) => `<g transform="${k.translateAlong(P, [x, CUSTOMER_Y, 0])}">${customerSvg(i)}</g>`).join("")}</g>`,
    ],
  });
}

export const GEOMETRY = { XS, LANE, DESK_FRONT, TRAY, TRAY_Z, TROUGH_Y, TROUGH_H, TROUGH: { y0: TROUGH.y, y1: TROUGH.y + TROUGH.d, x0: TROUGH.x, x1: TROUGH.x + TROUGH.w }, LANE_FAR, LANE_NEAR, CUSTOMER_Y };

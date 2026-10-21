// An order office: a clerk records each order in a ledger cabinet (the database) and a letter must reach the
// warehouse (the event). In outbox mode the cabinet's lower drawer is the outbox: the card and the letter go in
// with one drawer slam, and a relay runner in a cap later carries pending letters to the postbox.
// Every number that matters is printed on counter wheels: orders in the ledger, shipments, duplicates.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";
import { digitPath, counterCells, digitsOf } from "./digits.js";

export const WIDTH = 700;
export const HEIGHT = 400;

const PLATE = { x: -102, y: -70, w: 204, d: 104, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// The ledger cabinet (back left), its front face at y = CAB_FRONT.
const CAB = { x: -96, y: -66, w: 54, d: 18, r: 2 };
const CAB_H = 42;
const CAB_FRONT = CAB.y + CAB.d;                 // -48
const DRAWER = { x0: -73, x1: -45, z0: 4, z1: 15 };
const TRAY = { x: -72, y: CAB_FRONT, w: 26, d: 12, r: 1 };
const TRAY_Z = [7, 13];
export const TRAY_CARDS = 6;

// The warehouse (back right), its front face at y = WH_FRONT, and the intake desk in front of it.
const WH = { x: 38, y: -68, w: 58, d: 36, r: 2 };
const WH_H = 42;
const WH_FRONT = WH.y + WH.d;                    // -32
const INTAKE = { x: 40, y: -29, w: 30, d: 11, r: 1.5 };
const INTAKE_H = 7;
const SPIKE = [47, -23.5];
export const SPIKE_DISCS = 12;
const REJECT = { x: 56, y: -28, w: 10, d: 9, r: 0.8 };
export const REJECT_CARDS = 8;

// Counters (digit wheels on front faces).
const PROUD = 1.2;
export const COUNTERS = {
  orders: { x: -80.8, y: CAB_FRONT + PROUD, z: 21, w: 7.2, h: 10.5, gap: 1, count: 3, size: "l", housing: { x: -83.3, z0: 18.5, z1: 34 } },
  shipped: { x: 69, y: WH_FRONT + PROUD, z: 24, w: 7.2, h: 10.5, gap: 1, count: 3, size: "l", housing: { x: 66.5, z0: 21.5, z1: 37 } },
  extra: { x: 69, y: WH_FRONT + PROUD, z: 9.5, w: 7.2, h: 10.5, gap: 1, count: 3, size: "l", housing: { x: 66.5, z0: 7, z1: 20 } },
};
const housingW = (c) => 2 * (c.x - c.housing.x) + c.count * c.w + (c.count - 1) * c.gap;

// Where people stand and walk.
export const SPOTS = { home: [-84, -34], post: [-15, 14], rhome: [-34, -36], rpost: [15, -2] };
export const POSTBOX = [0, 6];
// The rail from the back of the postbox to the warehouse intake.
export const RAIL = [[0, 0], [0, -10], [52, -10], [52, -18]];
const TIMER = [-33, -50];
const INTRAY = { x: -98, y: -25, w: 12, d: 11, r: 1 };
export const INTRAY_SLIPS = 8;
const BIN = [-31, -62];
export const BIN_CARDS = 8;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(CAB, CAB_H, CAB_H), ...k.boxCorners(WH, WH_H, WH_H)],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const text = (x, y, z, value, { size = 3.4, tone = "mid", anchor = "start" } = {}) => k.faceTextSvg(k.sideMatrix([x, y], z, P, "left"), value, { size, tone, anchor });

function counter(c, name, value = 0) {
  const out = [];
  const w = housingW(c);
  out.push(S(k.slabOf({ x: c.housing.x, y: c.y - PROUD, w, d: PROUD, r: 0.5 }, c.housing.z0, c.housing.z1 - c.housing.z0, P, 2), { tone: "hi", crease: "lo" }));
  const digits = digitsOf(value, c.count);
  counterCells(c).forEach((cell, j) => {
    out.push(`<path class="cw" d="${k.faceRectY(P, cell.x, cell.x + cell.w, cell.y, cell.z, cell.z + cell.h)}"/>`);
    out.push(`<path class="dg" data-size="${c.size}" data-digit="${name}-${j}" d="${digitPath(k.iso, P, cell, digits[j])}"/>`);
  });
  return out.join("");
}

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -94, y: 24, w: 66, d: 6, r: 1 })
    + labelPlate(P, { x: 52, y: 12, w: 40, d: 14, r: 1.5 }, [[58, 16.5, 24], [58, 20, 30], [58, 23.5, 16]]);
}

// The rail: a low bed on the floor with a centre groove, from the postbox to the intake desk.
function rail() {
  const out = [];
  for (let i = 0; i < RAIL.length - 1; i++) {
    const [a, b] = [RAIL[i], RAIL[i + 1]];
    const x0 = Math.min(a[0], b[0]) - 3, y0 = Math.min(a[1], b[1]) - 3;
    out.push(S(k.slabOf({ x: x0, y: y0, w: Math.abs(b[0] - a[0]) + 6, d: Math.abs(b[1] - a[1]) + 6, r: 1 }, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  }
  out.push(L(k.onTop(RAIL, 0.6, P), { tone: "faint" }));
  return out.join("");
}

function cabinet() {
  const out = [];
  out.push(S(k.slabOf(CAB, 0, CAB_H, P, 4, 0.6), {
    tone: "mid",
    inner: L(k.faceRectY(P, DRAWER.x0, DRAWER.x1, CAB_FRONT, DRAWER.z0, DRAWER.z1) + k.faceRectY(P, CAB.x + 3, CAB.x + CAB.w - 3, CAB_FRONT, 17.5, CAB_H - 2), { tone: "lo" }),
  }));
  out.push(text(COUNTERS.orders.housing.x, CAB_FRONT, 35, "ORDERS", { size: 3, tone: "hi" }));
  out.push(`<g data-commit>${counter(COUNTERS.orders, "orders", 0)}</g>`);
  // The drawer's handle; in outbox mode the drawer is pulled out into a tray of pending letters.
  out.push(`<g data-drawer="closed">${S(k.slabOf({ x: -63, y: CAB_FRONT, w: 8, d: 1.2, r: 0.4 }, 9, 1.6, P, 2), { tone: "hi", crease: "none" })}</g>`);
  out.push(`<g data-drawer="open" style="display:none">${tray()}</g>`);
  return out.join("");
}

function tray() {
  const out = [];
  const [z0, z1] = TRAY_Z;
  // runners under the tray, then the tray: a floor, a back lip and two sides, the front face with its label.
  out.push(S(k.slabOf({ x: TRAY.x + 2, y: TRAY.y, w: 2, d: TRAY.d - 1, r: 0.3 }, 5, z0 - 5, P, 2), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf({ x: TRAY.x + TRAY.w - 4, y: TRAY.y, w: 2, d: TRAY.d - 1, r: 0.3 }, 5, z0 - 5, P, 2), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf(TRAY, z0, 1, P, 3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: TRAY.x, y: TRAY.y, w: 1.2, d: TRAY.d, r: 0.3 }, z0 + 1, z1 - z0 - 1, P, 2), { tone: "mid", crease: "none" }));
  for (let i = 0; i < TRAY_CARDS; i++) {
    const x = TRAY.x + 3.2 + i * 3.8;
    out.push(`<g data-card="${i}" style="display:none">${S(k.slabOf({ x, y: TRAY.y + 1.8, w: 1, d: TRAY.d - 4, r: 0.2 }, z0 + 1, 7.5, P, 1), { tone: "hi", crease: "lo" })}</g>`);
  }
  out.push(S(k.slabOf({ x: TRAY.x + TRAY.w - 1.2, y: TRAY.y, w: 1.2, d: TRAY.d, r: 0.3 }, z0 + 1, z1 - z0 - 1, P, 2), { tone: "mid", crease: "none" }));
  const front = TRAY.y + TRAY.d;
  out.push(S(k.slabOf({ x: TRAY.x - 0.5, y: front - 1.4, w: TRAY.w + 1, d: 1.4, r: 0.4 }, z0 - 1, z1 - z0 + 2, P, 2), { tone: "hi", crease: "lo" }));
  out.push(text(TRAY.x + 2, front, z0 + 1.6, "OUTBOX", { size: 3.2, tone: "hi" }));
  return out.join("");
}

function bin() {
  const [x, y] = BIN;
  const out = [S(k.cylinder(x, y, 5.2, 0, 9, P, 26, 0.3), { tone: "mid" })];
  out.push(L(k.ring(x, y, 4.3, 9, P, 26), { tone: "lo" }));
  for (let i = 0; i < BIN_CARDS; i++) out.push(`<g data-bin="${i}" style="display:none">${S(k.slabOf({ x: x - 3.4 + (i % 2) * 0.8, y: y - 3 + (i % 3) * 0.5, w: 6, d: 5, r: 0.6 }, 8.4 + i * 1.1, 1, P, 2), { tone: "hi", crease: "lo" })}</g>`);
  return out.join("");
}

function intray() {
  const out = [S(k.slabOf(INTRAY, 0, 3, P, 3, 0.3), { tone: "mid" })];
  for (let i = 0; i < INTRAY_SLIPS; i++) out.push(`<g data-slip="${i}" style="display:none">${S(k.slabOf(k.insetPlan(INTRAY, 2), 3 + i * 1.1, 0.8, P, 2), { tone: "hi", crease: "lo" })}</g>`);
  return out.join("");
}

function timer() {
  const [x, y] = TIMER;
  const out = [`<g data-timer style="display:none">`];
  out.push(S(k.slabOf({ x: x - 4, y: y - 4, w: 8, d: 8, r: 1 }, 0, 1.4, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 0.9, 1.4, 15, P, 12), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x, y, 6.6, 16.4, 1.8, P, 32, 0.3), { tone: "hi" }));
  const t = k.radialTicks(x, y, 6, 12, 3, 18.2, [0.9, 1.8], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(`<path class="iso-line needle" data-tone="hi" data-needle d="${k.lineOnTop([x, y], [x, y - 5], 18.2, P)}"/>`);
  out.push(S(k.cylinder(x, y, 0.9, 18.2, 0.5, P, 12), { tone: "hi", crease: "none" }));
  out.push(`</g>`);
  return out.join("");
}

function warehouse() {
  const out = [];
  const door = k.faceRectY(P, WH.x + 3, WH.x + 14, WH_FRONT, 0, 17);
  out.push(S(k.slabOf(WH, 0, WH_H, P, 4, 0.6), { tone: "mid", inner: L(door + k.faceRectY(P, WH.x + 4.2, WH.x + 12.8, WH_FRONT, 0, 15.8), { tone: "lo" }) }));
  out.push(text(WH.x + 4, WH_FRONT, 35, "WAREHOUSE", { size: 3, tone: "mid" }));
  out.push(text(64.5, WH_FRONT, 27, "SHIPPED", { size: 3, tone: "hi", anchor: "end" }));
  out.push(`<g data-extra-label="twice">${text(64.5, WH_FRONT, 12.5, "TWICE", { size: 3, tone: "hi", anchor: "end" })}</g>`);
  out.push(`<g data-extra-label="caught" style="display:none">${text(64.5, WH_FRONT, 12.5, "CAUGHT", { size: 3, tone: "hi", anchor: "end" })}</g>`);
  out.push(`<g data-ship>${counter(COUNTERS.shipped, "shipped", 0)}</g>`);
  out.push(counter(COUNTERS.extra, "extra", 0));
  return out.join("");
}

function intake() {
  const out = [S(k.slabOf(INTAKE, 0, INTAKE_H, P, 3, 0.5), { tone: "mid" })];
  out.push(`<g data-dedupe>`);
  const [x, y] = SPIKE;
  out.push(S(k.cylinder(x, y, 3.2, INTAKE_H, 1.2, P, 22, 0.3), { tone: "mid" }));
  for (let i = 0; i < SPIKE_DISCS; i++) out.push(`<g data-seen="${i}" style="display:none">${S(k.cylinder(x, y, 2.7, INTAKE_H + 1.4 + i * 0.95, 0.6, P, 20), { tone: "hi", crease: "lo" })}</g>`);
  out.push(S(k.cylinder(x, y, 0.4, INTAKE_H + 1.2, 13.5, P, 8), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf(REJECT, INTAKE_H, 1.4, P, 2, 0.2), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(REJECT, 1.2), INTAKE_H + 1.4, P, 2), { tone: "lo" }));
  for (let i = 0; i < REJECT_CARDS; i++) out.push(`<g data-reject="${i}" style="display:none">${S(k.slabOf(k.insetPlan(REJECT, 1.6), INTAKE_H + 1.4 + i * 0.9, 0.6, P, 2), { tone: "hi", crease: "lo" })}</g>`);
  out.push(`</g>`);
  return out.join("");
}

// A square pillar box: base, body (lit while posting), a cap, the slot hood on the front and a collection plate.
function postbox() {
  const [x, y] = POSTBOX;
  const front = y + 5.5;
  return S(k.slabOf({ x: x - 7, y: y - 7, w: 14, d: 14, r: 1.5 }, 0, 1.4, P, 3, 0.3), { tone: "mid" })
    + `<g data-postbox>${S(k.slabOf({ x: x - 5.5, y: y - 5.5, w: 11, d: 11, r: 1.2 }, 1.4, 17, P, 3), { tone: "hi", crease: "lo",
        inner: L(k.faceRectY(P, x - 3.6, x + 3.6, front, 13, 14.2) + k.faceRectY(P, x - 2.6, x + 2.6, front, 5, 9), { tone: "mid" }) })}</g>`
    + S(k.slabOf({ x: x - 6.8, y: y - 6.8, w: 13.6, d: 13.6, r: 2 }, 18.4, 1.8, P, 3, 0.4), { tone: "mid" })
    + S(k.slabOf({ x: x - 4.6, y: y - 4.6, w: 9.2, d: 9.2, r: 2.5 }, 20.2, 1.6, P, 4, 0.5), { tone: "hi", crease: "lo" })
    + S(k.slabOf({ x: x - 4.4, y: front, w: 8.8, d: 1.6, r: 0.4 }, 14.2, 1.4, P, 2), { tone: "mid", crease: "none" });
}

// People: a standing pawn (with an optional cap and something carried) and a fallen one.
function pawn({ cap = false } = {}) {
  const out = [];
  out.push(S(k.cylinder(0, 0, 6, 0, 1.6, P, 26, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(0, 0, 4.4, 1.6, 13.4, P, 24), { tone: "hi", crease: "none" }));
  out.push(S(k.cylinder(0, 0, 5.2, 15, 1.4, P, 24, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(0, 0, 3.6, 16.4, 6, P, 22, 0.3), { tone: "hi", crease: "lo" }));
  if (cap) {
    out.push(S(k.cylinder(0.8, 0.8, 5.6, 22.4, 0.8, P, 24, 0.2), { tone: "mid" }));
    out.push(S(k.cylinder(0, 0, 3.7, 23.2, 2.2, P, 22, 0.4), { tone: "mid", crease: "lo" }));
  }
  return out.join("");
}
function fallen({ cap = false } = {}) {
  const out = [];
  out.push(S(k.slabOf({ x: -10, y: -3.4, w: 14, d: 6.8, r: 3.2 }, 0, 5.8, P, 4, 0.4), { tone: "hi", crease: "lo" }));
  out.push(S(k.cylinder(7, 0, 3.4, 0, 5.6, P, 20, 0.3), { tone: "hi", crease: "lo" }));
  if (cap) out.push(S(k.cylinder(10.2, 0, 2.8, 0.4, 4.8, P, 18, 0.3), { tone: "mid" }));
  return out.join("");
}
const letterInHand = () => S(k.slabOf({ x: -4.4, y: 5, w: 8.8, d: 0.9, r: 0.3 }, 7.5, 6.4, P, 1, 0.2), { tone: "hi", crease: "lo", lit: true });
const bundleInHand = () => S(k.slabOf({ x: -4.2, y: 4.8, w: 8.4, d: 3, r: 0.6 }, 8.5, 4.6, P, 2, 0.3), { tone: "hi", crease: "lo", lit: true });

export function actorSvg(kind) {
  const cap = kind === "relay";
  return `<g data-pose="up">${pawn({ cap })}<g data-carry style="display:none">${cap ? bundleInHand() : letterInHand()}</g></g>`
    + `<g data-pose="down" style="display:none">${fallen({ cap })}</g>`;
}
// A letter lying flat: an envelope with its flap drawn on top.
const envelope = (z, h, lit) => `<g class="wb-lit-group">` + S(k.slabOf({ x: -4.5, y: -3, w: 9, d: 6, r: 0.5 }, z, h, P, 2, 0.2), { tone: "hi", crease: "lo", lit })
  + L(k.onTop([[-4.1, -2.6], [0, 0.6], [4.1, -2.6]], z + h, P), { tone: lit ? "lit" : "mid" }).replace("<path ", '<path data-on-lit="stroke" ') + `</g>`;
export const railLetterSvg = () => envelope(0.6, 1.4, true);
export const droppedLetterSvg = () => envelope(0, 1, false);

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "An order office on a base plate. At the back left a ledger cabinet counts committed orders on digit wheels; its lower drawer can be pulled out as an outbox tray of pending letters. A clerk stands in front of it, with an in-tray of waiting orders and a bin for cards that failed to commit. A postbox stands in the middle; a rail runs from it to an intake desk in front of the warehouse at the back right, where a spike keeps the order numbers already seen and a tray holds duplicates. The warehouse counts shipments and duplicate shipments on digit wheels. In outbox mode a relay runner in a cap waits by a poll timer next to the cabinet. Letters the clerk drops when failing on the way lie on the floor.",
    body: [
      plate(),
      rail(),
      `<g data-dropped></g>`,
      `<g data-rail></g>`,
      bin(),
      cabinet(),
      warehouse(),
      timer(),
      intake(),
      intray(),
      `<g data-sorted><g data-actor="postbox">${postbox()}</g><g data-actor="clerk">${actorSvg("clerk")}</g><g data-actor="relay" style="display:none">${actorSvg("relay")}</g></g>`,
    ],
  });
}

export const GEOMETRY = { SPOTS, POSTBOX, RAIL, TIMER, COUNTERS, TRAY_CARDS, SPIKE_DISCS, REJECT_CARDS, INTRAY_SLIPS, BIN_CARDS };

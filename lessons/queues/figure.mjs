// A parcel post office: a work queue you can watch.
//   the producer's dock drops numbered parcels onto the back of a roller lane (the queue);
//   clerks take the parcel at the front, work it at their desk and stamp it done;
//   a parcel nobody stamped waits on the hold rack until its timer runs out, then rejoins the front;
//   after too many tries it goes to the dead-letter cage. Every number is a counter on a real object.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../workbench/kit.mjs";
import { sphereOf } from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate, digitCounter, person, meter, pennant, faceText, variants, litFill } from "../../workbench/parts.mjs";

export const WIDTH = 700;
export const HEIGHT = 450;

const PLATE = { x: -128, y: -86, w: 256, d: 136, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The lane (the queue): slot 0 is the front, at the head end on the right.
const BED = { x: -102, y: -56, w: 150, d: 14, r: 1 };
const BED_H = 9;
export const LANE_Y = BED.y + BED.d / 2;
export const LANE_Z = BED_H + 0.4;
export const SLOTS = 16;
export const SLOT_X = Array.from({ length: SLOTS }, (_, i) => 42 - 9 * i);
export const CAP = 10;
const GATE_X = (SLOT_X[CAP - 1] + SLOT_X[CAP]) / 2;

const PROD = { x: -124, y: -70, w: 22, d: 20, r: 1.5 };
const PROD_H = 10;
export const PROD_SPOT = [PROD.x + PROD.w / 2, PROD.y + PROD.d / 2, PROD_H + 0.3];

export const PALLET = { x: -124, y: -44, w: 22, d: 22, r: 1 };
export const PILE = { xs: [-118, -108], ys: [-38, -28], z: 2.8, step: 6.4, layers: 4 };

export const TRAY = { x: -124, y: -16, w: 24, d: 16, r: 1.2 };
const TRAY_H = 9;
export const TRAY_SPOTS = [[-118, -8, TRAY_H - 2.2], [-108, -8, TRAY_H - 2.2]];

const RACK = { x: 40, y: -33, w: 72, d: 14, r: 1 };
const RACK_H = 9;
export const RACK_X = [47, 56, 65, 74, 83, 92];
export const RACK_Y = RACK.y + RACK.d / 2;
export const RACK_Z = RACK_H + 0.3;

const PLINTH = { x: 74, y: -84, w: 44, d: 28, r: 1.5 };
const PLINTH_H = 10, CAGE_H = 24;
export const CAGE_SPOTS = (() => {
  const out = [];
  for (let layer = 0; layer < 2; layer++) for (const y of [-76, -64]) for (const x of [82, 92, 102, 112]) out.push([x, y, PLINTH_H + 0.3 + layer * 6.4]);
  return out;
})();

export const XS = [-64, -34, -4, 26];                  // desk centres
const DESK_Y = 6, DESK_D = 13, DESK_H = 10;
export const DESK_SPOT = XS.map((cx) => [cx - 2, DESK_Y + 6.2, DESK_H + 0.3]);
const CLERK_Y = -3;

const CART = { x: 64, y: 12, w: 48, d: 28, r: 2 };
const CART_H = 14;
export const CART_SPOT = [CART.x + CART.w / 2, CART.y + CART.d / 2, CART_H - 3];

export const BOX = { w: 8, d: 8, h: 6, tall: 12 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [PLINTH.x, PLINTH.y, PLINTH_H + CAGE_H + 12], [PROD.x, PROD.y - 8, 26], [PLINTH.x + PLINTH.w, PLINTH.y, PLINTH_H + CAGE_H + 4]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 50 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const seg = (a, b) => k.segment(a, b, P);
const label = (x, y, z, text, size = 2.6) => faceText(P, [x, y, z], text, { size, tone: "mid" });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -112, y: 38, w: 80, d: 6, r: 1 })
    + labelPlate(P, { x: -18, y: 32, w: 48, d: 13, r: 1.5 }, [[-13, 36.5, 30], [-13, 40.5, 36]]);
}

// The producer's dock: a table at the tail of the lane, with the producer standing behind it.
function dock() {
  const out = [person(P, [PROD.x + PROD.w / 2, PROD.y - 8, 0], { scale: 0.72, hat: "cap" })];
  out.push(S(k.slabOf(PROD, 0, PROD_H, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PROD, 2), PROD_H, P), { tone: "faint" }));
  return out.join("");
}

// The lane: a roller conveyor on a cabinet; rollers across the top, a rail along each side,
// capacity marks on the front rail and an end stop at the front.
function lane() {
  const out = [S(k.slabOf(BED, 0, BED_H, P, 3, 0.5), { tone: "mid" })];
  const rollers = [];
  for (let x = BED.x + 3; x < BED.x + BED.w - 2; x += 3) rollers.push(k.lineOnTop([x, BED.y + 2.2], [x, BED.y + BED.d - 2.2], BED_H, P));
  out.push(L(rollers.join(""), { tone: "lo" }));
  for (const y of [BED.y + 0.2, BED.y + BED.d - 1.6]) out.push(S(k.slabOf({ x: BED.x + 1, y, w: BED.w - 2, d: 1.4, r: 0.3 }, BED_H, 1.6, P, 2), { tone: "hi", crease: "none" }));
  // slot marks on the front rail: one per place in the lane, the front of the queue on the right
  const marks = SLOT_X.map((x) => k.lineOnTop([x + 4.5, BED.y + BED.d - 1.6], [x + 4.5, BED.y + BED.d - 0.2], BED_H + 1.6, P));
  out.push(L(marks.join(""), { tone: "mid" }));
  out.push(S(k.slabOf({ x: BED.x + BED.w - 2.4, y: BED.y + 0.8, w: 2.4, d: BED.d - 1.6, r: 0.4 }, BED_H, 6, P, 2), { tone: "hi", crease: "lo" }));
  // counters on the cabinet front: how many are waiting (at the tail) and how long the oldest has waited (at the head)
  const front = BED.y + BED.d;
  out.push(digitCounter(P, { x: -96, y: front, z: 1.8, count: 3, w: 4.4, h: 5.4, gap: 0.8, pad: 1.4, name: "inq" }));
  out.push(label(-79, front, 2.6, "IN QUEUE"));
  out.push(digitCounter(P, { x: -24, y: front, z: 1.8, count: 3, w: 4.4, h: 5.4, gap: 0.8, pad: 1.4, name: "oldest" }));
  out.push(label(-5, front, 2.6, "OLDEST WAIT S"));
  return out.join("");
}

// The capacity gate across the lane: shown only for a bounded lane; lit while the lane is full.
function gate() {
  const out = [`<g data-gate style="display:none">`];
  for (const y of [BED.y - 1.6, BED.y + BED.d + 1.6]) out.push(S(k.cylinder(GATE_X, y, 0.9, 0, BED_H + 13, P, 12), { tone: "mid", crease: "none" }));
  out.push(`<g data-gate-arm>${S(k.slabOf({ x: GATE_X - 0.8, y: BED.y - 2.4, w: 1.6, d: BED.d + 4.8, r: 0.4 }, BED_H + 12, 2, P, 2), { tone: "hi", crease: "lo" })}</g>`);
  out.push(`</g>`);
  return out.join("");
}

// Overflow pallet beside the tail (a queue longer than the lane piles up here) and the returns tray.
function pallet() {
  const out = [S(k.slabOf(PALLET, 0, 2.5, P, 3, 0.3), { tone: "lo", crease: "none" })];
  out.push(L([PALLET.y + 6, PALLET.y + 11, PALLET.y + 16].map((y) => k.lineOnTop([PALLET.x + 1, y], [PALLET.x + PALLET.w - 1, y], 2.5, P)).join(""), { tone: "faint" }));
  return out.join("");
}
function tray() {
  const out = [S(k.slabOf(TRAY, 0, TRAY_H, P, 3, 0.4), { tone: "mid", inner: L(k.planOutline(k.insetPlan(TRAY, 1.6), TRAY_H, P), { tone: "lo" }) })];
  const front = TRAY.y + TRAY.d;
  out.push(digitCounter(P, { x: TRAY.x + 2, y: front, z: 1.4, count: 3, w: 3.6, h: 4.6, gap: 0.6, pad: 1, name: "turned" }));
  out.push(faceText(P, [TRAY.x + 16.4, front, 4.4], "TURNED", { size: 2.1, tone: "mid" }), faceText(P, [TRAY.x + 16.4, front, 1.8], "AWAY", { size: 2.1, tone: "mid" }));
  return out.join("");
}

// The hold rack: parcels taken but never stamped wait here, each over a timer that runs down to
// the moment it becomes visible again.
function rack() {
  const front = RACK.y + RACK.d;
  const out = [S(k.slabOf(RACK, 0, RACK_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(RACK_X.map((x) => k.planOutline({ x: x - 4.3, y: RACK.y + 1.8, w: 8.6, d: 8.6, r: 0.6 }, RACK_H, P)).join(""), { tone: "faint" }));
  RACK_X.forEach((x, i) => out.push(meter(P, { x, y: front, z: 1.6, r: 3.6, ticks: 6, name: "vis" + i, value: 0 })));
  const end = RACK.x + RACK.w;
  out.push(digitCounter(P, { x: end, y: RACK.y + RACK.d - 1.6, z: 2.4, count: 3, w: 3.4, h: 4.6, gap: 0.5, pad: 0.8, face: "x", name: "redelivered" }));
  out.push(faceText(P, [97.6, front, 3.4], "REDELIVERED", { size: 1.9, tone: "mid" }));
  return out.join("");
}

// The dead-letter cage: a plinth with its counter, a cage of bars on top and a pennant.
const CAGE = { x: PLINTH.x + 2, y: PLINTH.y + 2, w: PLINTH.w - 4, d: PLINTH.d - 4 };
const cageBar = (x, y) => seg([x, y, PLINTH_H], [x, y, PLINTH_H + CAGE_H]);
function cageBack() {
  const out = [S(k.slabOf(PLINTH, 0, PLINTH_H, P, 3, 0.5), { tone: "mid" })];
  const front = PLINTH.y + PLINTH.d;
  out.push(digitCounter(P, { x: PLINTH.x + 4, y: front, z: 2.4, count: 3, w: 4.2, h: 5.4, gap: 0.8, pad: 1.4, name: "dead" }));
  out.push(label(PLINTH.x + 21, front, 4.8, "DEAD"), label(PLINTH.x + 21, front, 1.6, "LETTERS"));
  // back and left walls of bars, then the back posts
  const bars = [];
  for (let x = CAGE.x + 3.5; x < CAGE.x + CAGE.w; x += 3.5) bars.push(cageBar(x, CAGE.y));
  for (let y = CAGE.y + 3.5; y < CAGE.y + CAGE.d; y += 3.5) bars.push(cageBar(CAGE.x, y));
  out.push(L(bars.join(""), { tone: "lo" }));
  out.push(L(k.planOutline({ ...CAGE, r: 0 }, PLINTH_H + 0.2, P), { tone: "lo" }));
  return out.join("");
}
function cageFront() {
  const out = [];
  const bars = [];
  for (let x = CAGE.x + 3.5; x < CAGE.x + CAGE.w; x += 3.5) bars.push(cageBar(x, CAGE.y + CAGE.d));
  for (let y = CAGE.y + 3.5; y < CAGE.y + CAGE.d; y += 3.5) bars.push(cageBar(CAGE.x + CAGE.w, y));
  out.push(L(bars.join(""), { tone: "mid" }));
  out.push(L(k.planOutline({ ...CAGE, r: 0 }, PLINTH_H + CAGE_H, P), { tone: "mid" }));
  for (const [x, y] of [[CAGE.x, CAGE.y], [CAGE.x + CAGE.w, CAGE.y], [CAGE.x, CAGE.y + CAGE.d], [CAGE.x + CAGE.w, CAGE.y + CAGE.d]]) out.push(S(k.cylinder(x, y, 0.9, PLINTH_H, CAGE_H, P, 12), { tone: "mid", crease: "none" }));
  out.push(`<g data-flag="off">${pennant(P, { x: CAGE.x + CAGE.w, y: CAGE.y, z: PLINTH_H + CAGE_H, height: 11, length: 9, drop: 5.5 })}</g>`);
  out.push(`<g data-flag="on" style="display:none">${pennant(P, { x: CAGE.x + CAGE.w, y: CAGE.y, z: PLINTH_H + CAGE_H, height: 11, length: 9, drop: 5.5, lit: true })}</g>`);
  return out.join("");
}

// A clerk standing behind each desk, or lying on the floor after collapsing.
function clerk(i) {
  const cx = XS[i];
  // collapsed: lying on the floor beside the desk's right end, feet toward the lane, head toward the viewer
  const lx = cx + 17.5;
  const down = litFill(S(k.slabOf({ x: lx - 3.2, y: CLERK_Y - 6, w: 6.4, d: 13, r: 3 }, 0, 4.6, P, 4, 1), { tone: "hi", crease: "lo", lit: true }))
    + litFill(S(sphereOf([lx, CLERK_Y + 10.4, 3], 3, P), { tone: "hi", crease: "lo", lit: true }));
  return `<g data-clerk="${i}">${variants("clerk-" + i, { up: person(P, [cx, CLERK_Y, 0], { scale: 0.75 }), down }, "up")}</g>`;
}

function desk(i) {
  const cx = XS[i];
  const plan = { x: cx - 13, y: DESK_Y, w: 26, d: DESK_D, r: 1.4 };
  const out = [`<g data-desk="${i}">`];
  out.push(S(k.slabOf(plan, 0, DESK_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(plan, 1.8), DESK_H, P), { tone: "faint" }) }));
  // the stamp: a pad and a handled stamp beside it
  const sx = cx + 8.5, sy = DESK_Y + 6.5;
  out.push(S(k.slabOf({ x: sx - 3, y: sy - 3, w: 6, d: 6, r: 0.6 }, DESK_H, 0.8, P, 2), { tone: "lo", crease: "none" }));
  out.push(`<g data-stamp="${i}">${S(k.cylinder(sx, sy, 2.2, DESK_H + 0.8, 1.6, P, 18), { tone: "hi", crease: "lo" })}${S(k.cylinder(sx, sy, 0.8, DESK_H + 2.4, 3.6, P, 12), { tone: "mid", crease: "none" })}${S(k.cylinder(sx, sy, 1.5, DESK_H + 6, 1.4, P, 14), { tone: "hi", crease: "lo" })}</g>`);
  out.push(`</g>`);
  return out.join("");
}

// The cart for finished parcels, with what was done and what was done twice.
function cart() {
  const front = CART.y + CART.d;
  const out = [S(k.slabOf(CART, 0, CART_H, P, 3, 0.6), { tone: "mid", inner: L(k.planOutline(k.insetPlan(CART, 2.4), CART_H, P), { tone: "lo" }) })];
    // side by side, each with its label printed above its wheels
  out.push(digitCounter(P, { x: CART.x + 3, y: front, z: 2.2, count: 4, w: 4.2, h: 5.8, gap: 0.6, pad: 1, name: "done" }));
  out.push(label(CART.x + 2, front, 10.2, "DONE", 2.6));
  out.push(digitCounter(P, { x: CART.x + 28, y: front, z: 2.2, count: 3, w: 4.2, h: 5.8, gap: 0.6, pad: 1, name: "twice" }));
  out.push(label(CART.x + 27, front, 10.2, "DONE TWICE", 2.6));
  for (const [x, y] of [[CART.x + 6, front - 3], [CART.x + CART.w - 6, front - 3], [CART.x + 6, CART.y + 3], [CART.x + CART.w - 6, CART.y + 3]]) out.push(D([at([x, y, 0])], { size: 0.5, tone: "lo" }));
  return out.join("");
}

// A parcel, drawn at the origin and moved with translateAlong. Two sizes (normal, slow = tall);
// each has its number on top, its customer letter on the front, a crossed band for a bad parcel
// and a tries tag that stands on top once it has been redelivered.
export function parcelSvg() {
  const one = (h, kind) => {
    const b = { x: -BOX.w / 2, y: -BOX.d / 2, w: BOX.w, d: BOX.d, r: 0.5 };
    const out = [`<g data-kind="${kind}"${kind === "tall" ? ' style="display:none"' : ""}>`];
    out.push(litFill(S(k.slabOf(b, 0, h, P, 2, 0.3), { tone: "hi", crease: "lo" })).replace('class="iso-solid"', 'class="iso-solid" data-body'));
    // the band: a line around the parcel's middle, and a cross on its right face for a bad parcel
    out.push(L(k.lineOnTop([b.x + 3, b.y], [b.x + 3, b.y + b.d], h, P), { tone: "faint" }));
    out.push(`<g data-bad style="display:none">${L(seg([BOX.w / 2, -3, 0.8], [BOX.w / 2, 3, h - 0.8]) + seg([BOX.w / 2, 3, 0.8], [BOX.w / 2, -3, h - 0.8]), { tone: "hi" })}</g>`);
    out.push(faceText(P, [0.8, 0.9, h], "0", { face: "top", size: 3.6, tone: "hi", anchor: "middle", attr: "data-num" }));
    out.push(faceText(P, [0, BOX.d / 2, 1.2], "A", { size: 3.4, tone: "hi", anchor: "middle", attr: "data-key" }));
    out.push(`<g data-tag style="display:none">`);
    out.push(S(k.slabOf({ x: -3.6, y: -3.4, w: 4.4, d: 0.5, r: 0.1 }, h, 5, P, 1, 0.1), { tone: "hi", crease: "none", lit: true }).replace("data-lit", "data-lit data-lit-fill"));
    out.push(faceText(P, [-1.4, -2.9, h + 1.2], "2", { size: 3.2, tone: "on-lit", anchor: "middle", attr: "data-tries" }));
    out.push(`</g></g>`);
    return out.join("");
  };
  return one(BOX.h, "box") + one(BOX.tall, "tall");
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A parcel post office on a base plate. At the back left a producer stands at a dock that drops numbered parcels onto the tail of a long roller lane; the parcels roll up to the front at the right. Clerks stand behind desks in front of the lane, take the parcel at the front, work it and stamp it, and finished parcels drop into a cart with counters for done and done twice. Behind the lane a hold rack keeps parcels nobody stamped, each over a timer, until they rejoin the front of the lane. A caged plinth at the back right collects dead letters. Counters on the lane show how many wait and how long the oldest has waited; a gate can limit the lane, and a tray by the dock collects parcels turned away.",
    body: [
      plate(),
      rack(),
      cageBack(),
      dock(),
      pallet(),
      tray(),
      lane(),
      `<g data-layer="back"></g>`,
      gate(),
      cageFront(),
      XS.map((_, i) => clerk(i)).join(""),
      XS.map((_, i) => desk(i)).join(""),
      cart(),
      `<g data-layer="front"></g>`,
    ],
  });
}

export const GEOMETRY = { SLOT_X, LANE_Y, LANE_Z, SLOTS, CAP, PROD_SPOT, PILE, TRAY_SPOTS, RACK_X, RACK_Y, RACK_Z, CAGE_SPOTS, DESK_SPOT, CART_SPOT, XS, BOX };

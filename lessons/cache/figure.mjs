// The records office: a card rack (the cache) in front of an archive chest (the database),
// joined by a carriage on rails. Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";

export const WIDTH = 700;
export const HEIGHT = 430;

const PLATE = { x: -160, y: -80, w: 320, d: 160, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// Archive chest, drawer fronts on its +y face.
const CHEST = { x: -142, y: -64, w: 84, d: 76, r: 3 };
const CHEST_TOP = 70;
const FACE_Y = CHEST.y + CHEST.d; // 12
const DRAWER = { w: 36, h: 13, t: 2.5, open: 10 };
const drawerAt = (index) => {
  const col = index % 2, row = Math.floor(index / 2);
  const x0 = -138 + col * 40;
  const z0 = 8 + (3 - row) * 14.5; // row 0 at the top
  return { x0, z0, cx: x0 + DRAWER.w / 2, col, row };
};
export const DRAWERS = Array.from({ length: 8 }, (_, i) => drawerAt(i));

// Card rack: two rows of six slots, back row on a raised step.
const COLS = Array.from({ length: 6 }, (_, i) => 14 + 21.6 * i);
const CARD = { w: 16, d: 1.8, h: 22 };
const FRONT = { y: -4, z: 5 };
const BACK = { y: -36, z: 20 };
export const SLOTS = [
  ...COLS.map((cx) => ({ cx, y: FRONT.y, z: FRONT.z, row: "front" })),
  ...COLS.map((cx) => ({ cx, y: BACK.y, z: BACK.z, row: "back" })),
];

// Rails and carriage.
const RAIL_FROM = -146;
const RAIL_TO = 136;
const RAIL_Y = [40, 54];
const CARRIAGE = { x: -16, y: 35, w: 32, d: 26, r: 3 };
const CARRIAGE_Z = 3;
const CARRIAGE_TOP = 8;
export const CARRY = { y: 48 - CARD.d / 2, z: CARRIAGE_TOP + 1.2 };
export const PARK = 60;

const BUTTON = [116, 70];
const CLOCK = [-28, -42];
const CLOCK_R = 14;
const CLOCK_TOP = 12;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [CHEST.x, CHEST.y, CHEST_TOP + 3], [CHEST.x + CHEST.w, CHEST.y + CHEST.d, CHEST_TOP + 3], [136, -50, 44]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
// A closed rectangle on a face of constant y (x along, z up).
export const faceRect = (x0, x1, y, z0, z1) => k.faceRectY(P, x0, x1, y, z0, z1);

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -140, y: 66, w: 210, d: 7, r: 1 })
    + labelPlate(P, { x: -50, y: -14, w: 40, d: 18, r: 1.5 }, [[-44, -9, 22], [-44, -4.5, 30], [-44, 0, 16]]);
}

function clock() {
  const [x, y] = CLOCK;
  const out = [];
  out.push(S(k.cylinder(x, y, CLOCK_R + 2.5, 0, 4, P, 56), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, CLOCK_R, 4, CLOCK_TOP - 4, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, CLOCK_R, CLOCK_TOP - 3, CLOCK_TOP, 64, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(x, y, CLOCK_R, CLOCK_TOP - 3, P, 40), { tone: "faint" }));
  out.push(L(k.ring(x, y, CLOCK_R - 2, CLOCK_TOP, P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, CLOCK_R - 2.6, 60, 5, CLOCK_TOP, [1, 2.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.3, CLOCK_TOP, P, 16), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([x, y + 6], CLOCK_TOP, P, "x"), "60 s", { size: 2.2, tone: "lo", anchor: "middle" }));
  return out.join("");
}

export const needleAt = (turn) => {
  const angle = turn * Math.PI * 2;
  const [x, y] = CLOCK;
  return k.lineOnTop([x - Math.sin(angle) * 2.6, y + Math.cos(angle) * 2.6], [x + Math.sin(angle) * (CLOCK_R - 3.4), y - Math.cos(angle) * (CLOCK_R - 3.4)], CLOCK_TOP + 0.2, P);
};

function chest() {
  const out = [];
  out.push(S(k.slabOf(k.insetPlan(CHEST, 3), 0, 4, P, 4, 0.4), { tone: "lo" }));
  out.push(S(k.slabOf(CHEST, 4, CHEST_TOP - 4, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(CHEST, 37, P, 4), { tone: "faint" }) }));
  out.push(S(k.slabOf(k.insetPlan(CHEST, -2), CHEST_TOP, 3, P, 4, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(CHEST, 4), CHEST_TOP + 3, P), { tone: "faint" }));
  out.push(D(k.corners(CHEST, 4).map(([x, y]) => at([x, y, CHEST_TOP + 3])), { size: 0.45 }));
  // Face frame: the recess every drawer sits in.
  out.push(L(DRAWERS.map((d) => faceRect(d.x0 - 0.8, d.x0 + DRAWER.w + 0.8, FACE_Y, d.z0 - 0.8, d.z0 + DRAWER.h + 0.8)).join(""), { tone: "lo" }));
  return out.join("");
}

// A drawer front, built closed. Live code slides it along +y and draws its body behind it.
export function drawerFront(d) {
  const out = [];
  const plan = { x: d.x0, y: FACE_Y, w: DRAWER.w, d: DRAWER.t, r: 0.8 };
  out.push(S(k.slabOf(plan, d.z0, DRAWER.h, P, 2, 0.4), { tone: "hi", crease: "lo" }));
  const front = FACE_Y + DRAWER.t;
  out.push(L(faceRect(d.x0 + 4, d.x0 + 14, front, d.z0 + 7.5, d.z0 + 10.5), { tone: "lo" }));
  const handle = { x: d.cx + 2, y: front, w: 10, d: 1.8, r: 0.6 };
  out.push(S(k.slabOf(handle, d.z0 + 4, 2.4, P, 2), { tone: "mid", crease: "none" }));
  out.push(D([at([d.cx + 3.2, front + 1.8, d.z0 + 5.2]), at([d.cx + 10.8, front + 1.8, d.z0 + 5.2])], { size: 0.35, tone: "lo" }));
  return out.join("");
}

export function drawerBody(d, open) {
  if (open < 0.3) return "";
  return S(k.slabOf({ x: d.x0 + 1.2, y: FACE_Y, w: DRAWER.w - 2.4, d: open, r: 0.4 }, d.z0 + 1, DRAWER.h - 2, P, 2), { tone: "mid", crease: "none" });
}

// A card at the origin (bottom centre); live code moves it with translateAlong.
export function cardSvg({ lit = false, y = 0 } = {}) {
  return S(k.slabOf({ x: -CARD.w / 2, y: y - CARD.d / 2, w: CARD.w, d: CARD.d, r: 0.3 }, 0, CARD.h, P, 2, 0.3), { tone: "hi", crease: "lo", lit });
}

// The freshness strip on a card face: a frame and a bar whose length is the share of TTL left.
export const TTL_STRIP = { x0: -6.5, x1: 6.5, z0: CARD.h - 6, z1: CARD.h - 3.6 };
export function ttlBar(slot, share) {
  const y = slot.y + CARD.d;
  if (share <= 0.01) return "";
  return faceRect(slot.cx + TTL_STRIP.x0, slot.cx + TTL_STRIP.x0 + (TTL_STRIP.x1 - TTL_STRIP.x0) * share, y, slot.z + TTL_STRIP.z0, slot.z + TTL_STRIP.z1);
}

function slotCard(slot, index) {
  const y = slot.y + CARD.d;
  return `<g data-slot="${index}" class="slot" data-empty="">`
    + `<g data-lift>${S(k.slabOf({ x: slot.cx - CARD.w / 2, y: slot.y, w: CARD.w, d: CARD.d, r: 0.3 }, slot.z, CARD.h, P, 2, 0.3), { tone: "hi", crease: "lo" })}`
    + L(faceRect(slot.cx + TTL_STRIP.x0, slot.cx + TTL_STRIP.x1, y, slot.z + TTL_STRIP.z0, slot.z + TTL_STRIP.z1), { tone: "lo" })
    + `<path class="ttl-fill" data-ttl d=""/>`
    + L([4, 7, 10].map((dz, i) => k.segment([slot.cx - 6.5, y, slot.z + CARD.h - 6 - dz], [slot.cx - 6.5 + [13, 9, 11][i], y, slot.z + CARD.h - 6 - dz], P)).join(""), { tone: "faint", free: true })
    + `</g></g>`;
}

function slotCover(slot, index) {
  return `<g data-cover="${index}" class="cover">${S(k.slabOf({ x: slot.cx - CARD.w / 2 - 1, y: slot.y - 1.2, w: CARD.w + 2, d: CARD.d + 2.4, r: 0.6 }, slot.z, 3, P, 2, 0.3), { tone: "lo" })}</g>`;
}

function divider(xb, y, d, z) {
  return S(k.slabOf({ x: xb - 0.8, y, w: 1.6, d, r: 0.4 }, z, 7, P, 2), { tone: "mid", crease: "none" });
}

function rackRow(row, anchorName) {
  const level = row === "front" ? FRONT : BACK;
  const items = [];
  const bounds = [...COLS.map((cx) => cx - 10.8), COLS[5] + 10.8];
  const y0 = row === "front" ? -14 : -46;
  bounds.forEach((xb) => items.push({ at: [xb, y0 + 11, level.z], svg: divider(xb, y0, 22, level.z) }));
  SLOTS.forEach((slot, index) => {
    if (slot.row !== row) return;
    items.push({ at: [slot.cx, slot.y, level.z + 1], svg: slotCard(slot, index) + slotCover(slot, index) });
  });
  items.sort((a, b) => k.depthOf(a.at, P) - k.depthOf(b.at, P));
  const slots = L(SLOTS.filter((s) => s.row === row).map((s) => k.planOutline({ x: s.cx - 9, y: s.y - 2, w: 18, d: CARD.d + 4, r: 0.8 }, level.z, P, 2)).join(""), { tone: "lo" });
  return slots + items.map((item) => item.svg).join("") + `<g data-anchor="${anchorName}"></g>`;
}

function rack() {
  const out = [];
  const base = { x: 2, y: -52, w: 134, d: 66, r: 3 };
  out.push(S(k.slabOf(base, 0, FRONT.z, P, 4, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf({ x: 4, y: -50, w: 130, d: 30, r: 2 }, FRONT.z, BACK.z - FRONT.z, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam({ x: 4, y: -50, w: 130, d: 30, r: 2 }, 12.5, P, 4), { tone: "faint" }) }));
  out.push(D([[8, -46], [130, -46]].map(([x, y]) => at([x, y, BACK.z])), { size: 0.45 }));
  out.push(rackRow("back", "back"));
  out.push(rackRow("front", "front"));
  const lip = { x: 4, y: 8, w: 130, d: 4, r: 1 };
  out.push(S(k.slabOf(lip, FRONT.z, 6, P, 3, 0.4), { tone: "mid" }));
  out.push(D(COLS.map((cx) => at([cx, 10, FRONT.z + 6])), { size: 0.4, tone: "lo" }));
  return out.join("");
}

function rails() {
  const out = [];
  for (const y of RAIL_Y) {
    out.push(S(k.slabOf({ x: RAIL_FROM, y, w: RAIL_TO - RAIL_FROM, d: 5, r: 1 }, 0, 3, P, 3, 0.4), { tone: "mid" }));
    out.push(D([RAIL_FROM + 6, (RAIL_FROM + RAIL_TO) / 2, RAIL_TO - 6].map((x) => at([x, y + 2.5, 3])), { size: 0.4 }));
  }
  for (const x of [RAIL_FROM - 5, RAIL_TO]) {
    out.push(S(k.slabOf({ x, y: 37, w: 5, d: 25, r: 1.2 }, 0, 7, P, 3, 0.5), { tone: "mid" }));
    out.push(D([at([x + 2.5, 40, 7]), at([x + 2.5, 59, 7])], { size: 0.45 }));
  }
  return out.join("");
}

function carriage() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(CARRIAGE, 3), CARRIAGE_Z, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.slabOf(CARRIAGE, CARRIAGE_Z, CARRIAGE_TOP - CARRIAGE_Z, P, 5, 0.6), { tone: "mid" }));
  out.push(D([-10, -3.5, 3.5, 10].map((x) => at([x, CARRIAGE.y + CARRIAGE.d - 2.4, CARRIAGE_TOP])), { size: 0.4, tone: "lo" }));
  out.push(L(k.planOutline({ x: -10, y: 45.5, w: 20, d: 5, r: 0.8 }, CARRIAGE_TOP, P, 2), { tone: "lo" }));
  // Two jaws that hold a card upright.
  for (const y of [43.6, 50.2]) out.push(S(k.slabOf({ x: -9, y, w: 18, d: 2.2, r: 0.5 }, CARRIAGE_TOP, 3.6, P, 2, 0.3), { tone: "mid" }));
  const handle = [CARRIAGE.x + CARRIAGE.w - 7, CARRIAGE.y + CARRIAGE.d + 3];
  out.push(S(k.slabOf({ x: handle[0] - 2, y: CARRIAGE.y + CARRIAGE.d - 1, w: 4, d: 4, r: 1 }, CARRIAGE_Z + 1, 3, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(handle[0], handle[1] + 1, 3, CARRIAGE_Z, 5, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(handle[0], handle[1] + 1, 3, CARRIAGE_Z, CARRIAGE_Z + 5, 18, P), { tone: "lo" }));
  return out.join("");
}

function buttonBase() {
  const [x, y] = BUTTON;
  return S(k.cylinder(x, y, 8.5, 0, 4, P, 40, 0.5), { tone: "mid" }) + L(k.ring(x, y, 6.6, 4, P, 40), { tone: "lo" });
}
function buttonCap() {
  const [x, y] = BUTTON;
  return S(k.cylinder(x, y, 5.6, 4, 4, P, 36, 0.4), { tone: "hi", lit: true }) + L(k.ring(x, y, 3.6, 8, P, 28), { tone: "faint" });
}

// The request cable: from the button's side, along the plate, to the rack base.
function cable() {
  const from = at([BUTTON[0] + 6, BUTTON[1] - 6, 1.5]);
  const to = at([136, 4, 2]);
  const via = [at([140, 64, 0.5]), at([146, 30, 0.5])];
  return k.wireSvg(from, to, { via, tone: "lo", size: 1 });
}

export function buildFigure() {
  const drawerGroups = DRAWERS.map((d, i) => `<g data-drawer="${i}"><g data-body></g><g data-front>${drawerFront(d)}</g></g>`).join("");
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A records office on a base plate. On the left, an archive chest with eight drawers holds every record but is slow to reach. On the right, a card rack with twelve slots holds copies of recently used records. A carriage on rails carries a copy from the archive to the rack. A push button at the front asks for a record; if its card is in the rack it is answered at once, otherwise the carriage fetches it.",
    body: [
      plate(),
      clock(),
      `<path data-needle class="iso-line" data-tone="lit" data-free="start" d="${needleAt(0)}" style="stroke-width:1.1"/>`,
      chest(),
      `<g data-drawers>${drawerGroups}</g>`,
      rack(),
      rails(),
      cable(),
      `<g data-carriage transform="${k.translateAlong(P, [PARK, 0, 0])}">${carriage()}</g>`,
      `<g data-fly-home><g data-fly style="opacity:0">${cardSvg({ lit: true })}</g></g>`,
      buttonBase(),
      `<g data-cap>${buttonCap()}</g>`,
    ],
  });
}

export const GEOMETRY = { DRAWERS, SLOTS, DRAWER, CARD, FACE_Y, CARRY, PARK, TTL_STRIP, BUTTON };

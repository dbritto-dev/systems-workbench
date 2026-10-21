// A filing machine: folders on a long rail, newest at the left, and a reader carriage that fetches one page at a time.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) through the shared workbench layer.
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";

export const WIDTH = 760;
export const HEIGHT = 420;

const PLATE = { x: -200, y: -42, w: 400, d: 104, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

export const SLOTS = 40;
export const SLOT_X0 = -152;
export const SLOT_W = 8;
export const slotX = (i) => SLOT_X0 + i * SLOT_W;
export const RAIL_Z = 3;
export const FOLDER = { w: 2.6, d: 18, h: 20 };
export const TAB = { w: 2.6, d: 5, h: 3 };
export const TAB_Y = [-8, -2.5, 3];
export const FEED_X = -176;
export const BIN_X = 176;
export const READER = { y: 36, beamZ: 38, headZ: 30 };
export const DIAL = { dx: 5, y: 41, r: 4.4, z: 9.4 };
const RAIL_FROM = -160, RAIL_TO = 164;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [FEED_X, -14, 34], [0, 0, READER.beamZ + 3]],
  WIDTH,
  HEIGHT,
  { pad: 20, azimuth: 56 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H, footInset: 24 })
    + rulerStrip(P, { x: -150, y: 52, w: 230, d: 6, r: 1 })
    + labelPlate(P, { x: 110, y: 46, w: 52, d: 12, r: 1.5 }, [[116, 50, 34], [116, 54, 24]]);
}

// The folder rail: two bars on a low bed, one stop at each end.
function folderRail() {
  const out = [S(k.slabOf({ x: RAIL_FROM, y: -11, w: RAIL_TO - RAIL_FROM, d: 22, r: 1.5 }, 0, 1.2, P, 3, 0.3), { tone: "lo", crease: "none" })];
  for (const y of [-7, 4]) out.push(S(k.slabOf({ x: RAIL_FROM, y, w: RAIL_TO - RAIL_FROM, d: 3, r: 0.6 }, 1.2, RAIL_Z - 1.2, P, 2), { tone: "mid", crease: "none" }));
  out.push(D([RAIL_FROM + 4, 0, RAIL_TO - 4].map((x) => at([x, -5.5, RAIL_Z])), { size: 0.4 }));
  return out.join("");
}

// The feed: a hopper at the newest end where new folders come in.
function feed() {
  const plan = { x: FEED_X - 14, y: -16, w: 22, d: 32, r: 2 };
  const out = [S(k.slabOf(plan, 0, 30, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(plan, 10, P, 3), { tone: "faint" }) })];
  out.push(L(k.faceRectX(P, plan.x + plan.w, -10, 10, 3, 26), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(plan, 3), 30, P, 3), { tone: "faint" }));
  out.push(D([[plan.x + 3, plan.y + 3], [plan.x + plan.w - 3, plan.y + plan.d - 3]].map(([x, y]) => at([x, y, 30])), { size: 0.45 }));
  return out.join("");
}

// The bin past the last slot, where older folders slide out of view.
function bin() {
  const plan = { x: BIN_X - 8, y: -16, w: 22, d: 32, r: 2 };
  const out = [S(k.slabOf(plan, 0, 2, P, 3, 0.4), { tone: "mid" })];
  out.push(S(k.slabOf({ x: plan.x, y: plan.y, w: plan.w, d: 2.4, r: 0.6 }, 2, 12, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: plan.x + plan.w - 2.4, y: plan.y, w: 2.4, d: plan.d, r: 0.6 }, 2, 12, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: plan.x, y: plan.y + plan.d - 2.4, w: plan.w - 2.4, d: 2.4, r: 0.6 }, 2, 8, P, 2), { tone: "mid", crease: "none" }));
  return out.join("");
}

// The card index next to the reader rail: where a cursor query looks up its starting point.
function cardIndex() {
  const plan = { x: FEED_X - 14, y: 24, w: 22, d: 24, r: 2 };
  const out = [S(k.slabOf(plan, 0, 14, P, 3, 0.5), { tone: "mid" })];
  const fx = plan.x + plan.w;
  for (const [z0, z1] of [[2, 6.5], [7.5, 12]]) {
    out.push(L(k.faceRectX(P, fx, plan.y + 3, plan.y + plan.d - 3, z0, z1), { tone: "lo" }));
    out.push(S(k.slabOf({ x: fx, y: plan.y + plan.d / 2 - 2, w: 1.4, d: 4, r: 0.4 }, (z0 + z1) / 2 - 0.6, 1.2, P, 2), { tone: "mid", crease: "none" }));
  }
  return out.join("");
}

function readerRail() {
  const out = [];
  for (const y of [28, 44]) out.push(S(k.slabOf({ x: RAIL_FROM, y, w: RAIL_TO - RAIL_FROM, d: 4, r: 0.8 }, 0, 2.5, P, 3, 0.3), { tone: "mid" }));
  for (const x of [RAIL_FROM - 4, RAIL_TO]) {
    out.push(S(k.slabOf({ x, y: 25, w: 4, d: 26, r: 1 }, 0, 6, P, 3, 0.4), { tone: "mid" }));
    out.push(D([at([x + 2, 28, 6]), at([x + 2, 48, 6])], { size: 0.4 }));
  }
  return out.join("");
}

// The reader carriage, built at x = 0 and moved along x: base, post, beam over the folders, reading head.
export function carriageSvg() {
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: -8, y: 28, w: 16, d: 18, r: 2 }, 2.5, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.slabOf({ x: -10, y: 26, w: 20, d: 22, r: 2.5 }, 2.5, 4.5, P, 4, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(-4, 34, 2.2, 7, READER.beamZ - 7, P, 18), { tone: "mid", crease: "none" }));
  out.push(L(k.sideArc(-4, 34, 2.2, 20, P, 12), { tone: "faint" }));
  out.push(S(k.slabOf({ x: -6.5, y: -3, w: 5, d: 40, r: 1 }, READER.beamZ, 3, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([-4, 33, READER.beamZ + 3]), at([-4, 0, READER.beamZ + 3])], { size: 0.4 }));
  out.push(`<g data-head>${S(k.slabOf({ x: -6, y: -3.5, w: 4, d: 7, r: 0.8 }, READER.headZ, READER.beamZ - READER.headZ, P, 2, 0.3), { tone: "hi", crease: "lo" })}</g>`);
  // Tally dial on the carriage top: rows read by the current query.
  const [cx, cy] = [DIAL.dx, DIAL.y];
  out.push(S(k.cylinder(cx, cy, DIAL.r, 7, DIAL.z - 7, P, 32, 0.3), { tone: "hi", crease: "lo" }));
  const t = k.radialTicks(cx, cy, DIAL.r - 0.6, 20, 5, DIAL.z, [0.5, 1.1], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(L(k.ring(cx, cy, 0.7, DIAL.z, P, 12), { tone: "mid" }));
  return out.join("");
}

export const needleAt = (cx, turn) => {
  const a = turn * Math.PI * 2, x = cx + DIAL.dx, y = DIAL.y;
  return k.lineOnTop([x - Math.sin(a) * 0.9, y + Math.cos(a) * 0.9], [x + Math.sin(a) * (DIAL.r - 1.2), y - Math.cos(a) * (DIAL.r - 1.2)], DIAL.z + 0.1, P);
};

// A folder at x = 0: the body, and a tab whose position along y follows its created_at second (folders filed in the same second share a tab position).
export function folderSvg(tab) {
  const body = S(k.slabOf({ x: -FOLDER.w / 2, y: -FOLDER.d / 2, w: FOLDER.w, d: FOLDER.d, r: 0.4 }, RAIL_Z, FOLDER.h, P, 2, 0.3), { tone: "hi", crease: "lo", className: "body" });
  const t = S(k.slabOf({ x: -TAB.w / 2, y: TAB_Y[tab], w: TAB.w, d: TAB.d, r: 0.4 }, RAIL_Z + FOLDER.h, TAB.h, P, 2), { tone: "mid", crease: "none", className: "tab" });
  return body + t;
}

// The cursor clip: a small clamp on the rail just after the last folder read.
export function clipSvg() {
  return S(k.slabOf({ x: 2, y: 7.6, w: 2.6, d: 3, r: 0.6 }, 1.2, 9, P, 2, 0.3), { tone: "mid" })
    + S(k.slabOf({ x: 2, y: 4.2, w: 2.6, d: 6.4, r: 0.5 }, 10.2, 1.8, P, 2), { tone: "mid", crease: "none" });
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "A filing machine. Folders stand on a long rail, newest at the left, where a feed hopper adds new ones and pushes the rest along; old folders slide into a bin at the right. A reader carriage on a front rail fetches one page of folders at a time. In offset mode it starts from the newest folder every time and steps past every folder it skips, counted on its dial. In cursor mode a clip marks where the last page ended and the carriage goes straight there.",
    body: [
      plate(),
      folderRail(),
      feed(),
      `<g data-folders></g>`,
      `<g data-clip style="display:none">${clipSvg()}</g>`,
      bin(),
      cardIndex(),
      readerRail(),
      `<g data-carriage>${carriageSvg()}</g>`,
      `<path data-needle class="iso-line" data-tone="hi" data-free="start" d="" style="stroke-width:.9"/>`,
    ],
  });
}

export const GEOMETRY = { SLOTS, SLOT_X0, SLOT_W, FEED_X, BIN_X, TAB_Y, DIAL, READER };

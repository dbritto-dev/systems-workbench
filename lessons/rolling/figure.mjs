// The module yard: six service bays (plus two spare positions) on a feed rail, a distributor,
// and a gantry crane that swaps one module at a time. Built with the Anatomy kit (MIT).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip } from "../../workbench/parts.mjs";
import { RD } from "./sim.js";

export const WIDTH = 720;
export const HEIGHT = 440;

const PLATE = { x: -182, y: -58, w: 362, d: 136, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

export const ROW_Y = 2;               // centre line of the bays
export const SOCKET_TOP = 5;
export const MODULE = { w: 20, d: 24, h: 26 };
export const MODULE_TOP = SOCKET_TOP + MODULE.h; // 31
export const HANDLE_H = 2;
export const HOIST_TOP = 66;          // grabber bottom when the hoist is fully up
export const TROLLEY_Z = 72;
export const BEAM_Z = 78;
const BACK_RAIL_Y = -42;
const FRONT_RAIL_Y = 58;
const FEED_Y = 31;                    // feed rail from the distributor along the bays
export const TOKEN_Y = 34;
export const TRAY_Y = 25.5;
export const DIST_EXIT = [-138, TOKEN_Y];
export const REJECT = [-156, 56];
const RAIL_FROM = -142;
const RAIL_TO = 160;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [RAIL_FROM, BACK_RAIL_Y, BEAM_Z + 7], [RAIL_TO, FRONT_RAIL_Y + 10, BEAM_Z + 7], [RAIL_FROM, FRONT_RAIL_Y + 10, BEAM_Z + 7]],
  WIDTH,
  HEIGHT,
  { pad: 24, azimuth: 50 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
export const faceRect = (x0, x1, y, z0, z1) => k.faceRectY(P, x0, x1, y, z0, z1);

// Warm-up strip on a module's front face, relative to the module's centre x.
export const WARM_STRIP = { x0: -7, x1: 7, z0: 18, z1: 20.6, y: ROW_Y + MODULE.d / 2 };

function plate() {
  const out = [basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H }), rulerStrip(P, { x: -112, y: 67, w: 196, d: 6, r: 1 }, { ticks: [1.8, 3.2] })];
  // A narrow two-line label plate (lesson-local: thinner than parts.labelPlate, with its screws on the centre line).
  const label = { x: 104, y: 66, w: 52, d: 8, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "mid", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P), { tone: "faint" }));
  out.push(L([[110, 68.6, 30], [110, 71.4, 22]].map(([x, y, len]) => k.lineOnTop([x, y], [x + len, y], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + 2.6, label.y + 4, 0.8]), at([label.x + label.w - 2.6, label.y + 4, 0.8])], { size: 0.4 }));
  return out.join("");
}

function rail(y) {
  const out = [];
  out.push(S(k.slabOf({ x: RAIL_FROM, y: y - 2.5, w: RAIL_TO - RAIL_FROM, d: 5, r: 1 }, 0, 3, P, 3, 0.4), { tone: "mid" }));
  out.push(D([RAIL_FROM + 6, (RAIL_FROM + RAIL_TO) / 2, RAIL_TO - 6].map((x) => at([x, y, 3])), { size: 0.4 }));
  for (const x of [RAIL_FROM - 5, RAIL_TO]) {
    out.push(S(k.slabOf({ x, y: y - 5, w: 5, d: 10, r: 1.2 }, 0, 7, P, 3, 0.5), { tone: "mid" }));
    out.push(D([at([x + 2.5, y, 7])], { size: 0.45 }));
  }
  return out.join("");
}

function intake() {
  const chute = { x: -160, y: -52, w: 14, d: 70, r: 2 };
  return S(k.slabOf(chute, 0, 3, P, 3, 0.4), { tone: "mid" })
    + L(k.planOutline(k.insetPlan(chute, 2.5), 3, P, 3), { tone: "lo" })
    + D([at([-153, -46, 3])], { size: 0.45 });
}

function distributor() {
  const out = [];
  const box = { x: -166, y: 18, w: 28, d: 28, r: 3 };
  out.push(S(k.slabOf(box, 0, 14, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(box, 7, P, 4), { tone: "faint" }) }));
  out.push(S(k.cylinder(-152, 32, 9, 14, 3, P, 40, 0.5), { tone: "mid" }));
  out.push(L(k.ring(-152, 32, 6.5, 17, P, 40), { tone: "lo" }));
  const t = k.radialTicks(-152, 32, 8, 24, 6, 17, [0.8, 1.6], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(L(k.ring(-152, 32, 1.2, 17, P, 12), { tone: "mid" }));
  out.push(D(k.corners(box, 3).map(([x, y]) => at([x, y, 14])), { size: 0.4 }));
  // Exit throat onto the feed rail.
  out.push(S(k.slabOf({ x: -138, y: 28, w: 4, d: 10, r: 0.8 }, 0, 6, P, 2, 0.3), { tone: "mid" }));
  // Reject tray for requests nobody can take.
  const tray = { x: -166, y: 50, w: 22, d: 12, r: 1.6 };
  out.push(S(k.slabOf(tray, 0, 3, P, 3, 0.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(tray, 2), 3, P, 3), { tone: "lo" }));
  return out.join("");
}

export const needleOf = (angle) => k.lineOnTop([-152, 32], [-152 + Math.sin(angle) * 6, 32 - Math.cos(angle) * 6], 17.2, P);

function feedRail() {
  const out = [];
  const plan = { x: -134, y: FEED_Y, w: 282, d: 6, r: 1 };
  out.push(S(k.slabOf(plan, 0, 2.4, P, 3, 0.3), { tone: "mid" }));
  out.push(L(k.lineOnTop([-134, TOKEN_Y], [148, TOKEN_Y], 2.4, P), { tone: "faint" }));
  out.push(D([-120, -40, 40, 120].map((x) => at([x, FEED_Y + 1, 2.4])), { size: 0.35, tone: "lo" }));
  return out.join("");
}

// A module at the origin (centre of its footprint, bottom at z 0). Live code moves it with translateAlong.
export function moduleSvg({ lit = false, x = 0, y = ROW_Y, z = SOCKET_TOP } = {}) {
  const plan = { x: x - MODULE.w / 2, y: y - MODULE.d / 2, w: MODULE.w, d: MODULE.d, r: 1.6 };
  const face = y + MODULE.d / 2;
  let out = S(k.slabOf(plan, z, MODULE.h, P, 3, 0.5), { tone: "hi", crease: "lo", lit, inner: L(k.sideSeam(plan, z + 8, P, 3), { tone: "faint" }) });
  out += L(faceRect(x + WARM_STRIP.x0, x + WARM_STRIP.x1, face, z + WARM_STRIP.z0 - SOCKET_TOP, z + WARM_STRIP.z1 - SOCKET_TOP), { tone: "lo" });
  out += L([5, 8, 11].map((dz) => k.segment([x - 7, face, z + dz - 2], [x + 7, face, z + dz - 2], P)).join(""), { tone: "faint" });
  out += S(k.slabOf({ x: x - 5, y: y - 2, w: 10, d: 4, r: 1 }, z + MODULE.h, HANDLE_H, P, 2, 0.3), { tone: "mid" });
  out += D([at([x - 7, y - 8, z + MODULE.h]), at([x + 7, y - 8, z + MODULE.h])], { size: 0.35, tone: "lo" });
  return out;
}

function socket(i) {
  const cx = RD.slotX(i);
  const spare = i >= RD.R;
  const plan = { x: cx - 13, y: ROW_Y - 16, w: 26, d: 32, r: 2 };
  let out = S(k.slabOf(plan, 0, SOCKET_TOP, P, 4, 0.5), { tone: spare ? "lo" : "mid" });
  out += L(k.planOutline({ x: cx - 11, y: ROW_Y - 13, w: 22, d: 26, r: 1.4 }, SOCKET_TOP, P, 3), { tone: spare ? "faint" : "lo" });
  out += D([at([cx - 11, ROW_Y + 14.5, SOCKET_TOP]), at([cx + 11, ROW_Y + 14.5, SOCKET_TOP])], { size: 0.35, tone: "lo" });
  return out;
}

// Readiness flag: a post at the front-left corner of the socket with a plate that slides up.
export const FLAG_RISE = 20;
function flagPost(i) {
  const cx = RD.slotX(i);
  const [px, py] = [cx - 12.5, ROW_Y + 17];
  return S(k.cylinder(px, py, 1.8, 0, 2, P, 16), { tone: "mid" }) + S(k.cylinder(px, py, 0.9, 2, 34, P, 12), { tone: "mid", crease: "none" }) + S(k.cylinder(px, py, 1.3, 36, 1.2, P, 12), { tone: "mid" });
}
function flagPlate(i) {
  const cx = RD.slotX(i);
  const plan = { x: cx - 19.5, y: ROW_Y + 16.4, w: 6.2, d: 1.2, r: 0.3 };
  return S(k.slabOf(plan, 6, 7, P, 2, 0.2), { tone: "hi", crease: "lo" });
}

// Waiting requests: up to five pucks in a tray in front of the bay.
export const PUCKS = 5;
function tray(i) {
  const cx = RD.slotX(i);
  const plan = { x: cx - 10, y: TRAY_Y - 4.5, w: 20, d: 9, r: 1.5 };
  let out = S(k.slabOf(plan, 0, 1.6, P, 3, 0.3), { tone: "mid", crease: "none" });
  out += L(k.planOutline(k.insetPlan(plan, 1.5), 1.6, P, 3), { tone: "lo" });
  for (let j = 0; j < PUCKS; j++) {
    const x = cx - 6.8 + j * 3.4;
    out += `<g data-puck="${i}-${j}" style="display:none">${S(k.cylinder(x, TRAY_Y, 1.5, 1.6, 2.4, P, 14), { tone: "mid", crease: "none" })}</g>`;
  }
  return out;
}

export function tokenSvg() {
  return S(k.cylinder(0, 0, 1.5, 0, 2.4, P, 14), { tone: "mid", crease: "none" });
}

function bins() {
  const out = [];
  const bin = { x: RD.BIN_X - 12, y: ROW_Y - 14, w: 24, d: 28, r: 2 };
  out.push(S(k.slabOf(bin, 0, 2, P, 4, 0.4), { tone: "lo" }));
  for (const wall of [
    { x: bin.x, y: bin.y, w: 24, d: 2.2, r: 0.5 },
    { x: bin.x, y: bin.y, w: 2.2, d: 28, r: 0.5 },
  ]) out.push(S(k.slabOf(wall, 2, 12, P, 2, 0.3), { tone: "mid" }));
  return out.join("");
}
function binFront() {
  const bin = { x: RD.BIN_X - 12, y: ROW_Y - 14, w: 24, d: 28, r: 2 };
  return S(k.slabOf({ x: bin.x + 21.8, y: bin.y, w: 2.2, d: 28, r: 0.5 }, 2, 12, P, 2, 0.3), { tone: "mid" })
    + S(k.slabOf({ x: bin.x, y: bin.y + 25.8, w: 24, d: 2.2, r: 0.5 }, 2, 12, P, 2, 0.3), { tone: "mid" })
    + D([at([bin.x + 3, bin.y + 26.9, 14]), at([bin.x + 21, bin.y + 26.9, 14])], { size: 0.35, tone: "lo" });
}
function supplyStand() {
  const plan = { x: RD.SUPPLY_X - 13, y: ROW_Y - 16, w: 26, d: 32, r: 2 };
  return S(k.slabOf(plan, 0, SOCKET_TOP, P, 4, 0.5), { tone: "mid" })
    + L(k.planOutline({ x: RD.SUPPLY_X - 11, y: ROW_Y - 13, w: 22, d: 26, r: 1.4 }, SOCKET_TOP, P, 3), { tone: "lo" });
}

// Gantry crane, built at x = 0 and moved with translateAlong.
function gantryLeg(railY) {
  const out = [];
  out.push(S(k.slabOf({ x: -10, y: railY - 5, w: 20, d: 10, r: 1.5 }, 3, 5, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([-7, railY + 5, 5.5]), at([7, railY + 5, 5.5])], { size: 0.5, tone: "lo" }));
  out.push(S(k.slabOf({ x: -3.5, y: railY - 3, w: 7, d: 6, r: 1 }, 8, BEAM_Z - 8, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam({ x: -3.5, y: railY - 3, w: 7, d: 6, r: 1 }, 40, P, 3), { tone: "faint" }) }));
  return out.join("");
}
// The crossbeam is split where it passes over the front of the bays, so a module hanging
// under it is drawn between the back half and the front half.
const BEAM_SPLIT = ROW_Y + 14;
function gantryTop() {
  const out = [];
  out.push(S(k.slabOf({ x: -5, y: BACK_RAIL_Y - 4, w: 10, d: BEAM_SPLIT - BACK_RAIL_Y + 4, r: 1.4 }, BEAM_Z, 7, P, 3, 0.6), { tone: "mid" }));
  out.push(D([at([0, BACK_RAIL_Y, BEAM_Z + 7])], { size: 0.45 }));
  out.push(S(k.slabOf({ x: -7.5, y: ROW_Y - 8, w: 15, d: 16, r: 1.4 }, TROLLEY_Z, BEAM_Z - TROLLEY_Z, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(0, ROW_Y + 8.6, 2.6, TROLLEY_Z + 1, 4, P, 18), { tone: "mid" }));
  out.push(L(k.knurl(0, ROW_Y + 8.6, 2.6, TROLLEY_Z + 1, TROLLEY_Z + 5, 14, P), { tone: "lo" }));
  return out.join("");
}
function gantryTopFront() {
  const plan = { x: -5, y: BEAM_SPLIT, w: 10, d: FRONT_RAIL_Y + 4 - BEAM_SPLIT, r: 1.4 };
  return S(k.slabOf(plan, BEAM_Z, 7, P, 3, 0.6), { tone: "mid" }) + D([at([0, FRONT_RAIL_Y, BEAM_Z + 7])], { size: 0.45 });
}
export function grabberSvg() {
  return S(k.slabOf({ x: -8, y: ROW_Y - 5, w: 16, d: 10, r: 1.2 }, 0, 3, P, 2, 0.3), { tone: "mid" })
    + S(k.slabOf({ x: -8, y: ROW_Y - 5, w: 2, d: 10, r: 0.4 }, -2, 2, P, 2), { tone: "mid", crease: "none" })
    + S(k.slabOf({ x: 6, y: ROW_Y - 5, w: 2, d: 10, r: 0.4 }, -2, 2, P, 2), { tone: "mid", crease: "none" });
}
export const CABLE_Y = [ROW_Y - 2, ROW_Y + 2];
export const cablesAt = (x, grabZ) => CABLE_Y.map((y) => k.segment([x, y, TROLLEY_Z], [x, y, grabZ + 3], P)).join("");

export function buildFigure() {
  const slots = Array.from({ length: RD.SLOTS }, (_, i) => {
    const cx = RD.slotX(i);
    return `<g data-slot="${i}">${socket(i)}`
      + `<g data-mod="old" class="mod-old" style="display:none">${moduleSvg({ x: cx })}</g>`
      + `<g data-mod="new" style="display:none">${moduleSvg({ x: cx, lit: true })}</g>`
      + `<path class="warm-fill" data-warm d=""/>`
      + `<g data-anchor></g>`
      + flagPost(i)
      + `<g data-flag>${flagPlate(i)}</g>`
      + tray(i)
      + `</g>`;
  }).join("");
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A module yard on a base plate. Six service bays stand in a row, with two spare positions at the end. A distributor at the left sends requests along a feed rail to any bay whose readiness flag is up. A gantry crane runs on rails over the row; during a rollout it pulls one old module out at a time, drops it in a bin, and lowers a new module from the supply stand into a free bay. A new module warms up before its flag rises.",
    body: [
      plate(),
      intake(),
      rail(BACK_RAIL_Y),
      `<g data-crane-back>${gantryLeg(BACK_RAIL_Y)}</g>`,
      bins(),
      supplyStand(),
      `<g data-supply>${moduleSvg({ x: RD.SUPPLY_X, lit: true })}</g>`,
      `<g data-bin-anchor></g>`,
      binFront(),
      slots,
      feedRail(),
      distributor(),
      `<path data-needle class="iso-line" data-tone="hi" data-free="end" d="${needleOf(0)}" style="stroke-width:1"/>`,
      `<g data-tokens></g>`,
      rail(FRONT_RAIL_Y),
      `<g data-crane-top>${gantryTop()}</g>`,
      `<path data-cables class="iso-line" data-tone="lo" d=""/>`,
      `<g data-grabber>${grabberSvg()}</g>`,
      `<g data-fly-home><g data-fly style="display:none"><g data-fly-mod="old" class="mod-old">${moduleSvg({ x: 0, z: 0 })}</g><g data-fly-mod="new">${moduleSvg({ x: 0, z: 0, lit: true })}</g></g></g>`,
      `<g data-crane-front>${gantryLeg(FRONT_RAIL_Y)}</g>`,
      `<g data-crane-top-front>${gantryTopFront()}</g>`,
    ],
  });
}

export const GEOMETRY = { ROW_Y, SOCKET_TOP, MODULE, MODULE_TOP, HANDLE_H, HOIST_TOP, TROLLEY_Z, WARM_STRIP, TOKEN_Y, TRAY_Y, DIST_EXIT, REJECT, FLAG_RISE, PUCKS };

// A rail yard: each partition is a track of numbered cars (records). The producer's transfer table couples new
// cars to the near end of a track; the cars it pushes along roll back into the archive shed. Consumers are reading
// cabins at the front; a cable runs from each cabin to the bookmark post (committed offset) on every track it owns.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";

export const WIDTH = 720;
export const HEIGHT = 470;

const PLATE = { x: -164, y: -90, w: 324, d: 196, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

export const TRACK_Y = [-62, -28, 6, 40];
export const TAIL_X = 62;            // the newest car's slot
export const SPACING = 17;           // one car per slot
export const WINDOW = 12;            // cars drawn per track
export const SHED_X = -104;          // cars past this are inside the archive shed
export const BED = { x0: SHED_X, x1: TAIL_X + 12, half: 6.5 };
export const RAIL_Z = 3;
export const CAR = { w: 13, d: 9, z: RAIL_Z + 0.4, h: 7 };
export const TRAVERSER = { x0: 76, x1: 92, rail: [-78, 56] };
const DOCK = { x: 104, y: -40, w: 34, d: 56, r: 2 };
const DOCK_H = 26;
const SHED = { x: -150, y: -78, w: 46, d: 134, r: 2 };
const SHED_H = 32;
export const CABIN = { w: 20, d: 12, h: 10, y: 64 };
export const CABIN_X = [-40, -10, 20, 50, 80, 110];
// Bookmark gantry: two posts either side of the track, a cross beam, and a number board over the next car to read.
export const GANTRY = { half: 8.5, h: 19, board: { x0: 1.2, w: 12, z: 13 } };
export const MAST = { dx: -6, dy: 3, top: 22 };   // the cabin's wire mast
export const LAG_WINDOW = { half: 7.5, z0: 18, z1: 26 };   // lag counter above each shed door

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [SHED.x, SHED.y, SHED_H + 3], [DOCK.x + DOCK.w, DOCK.y, DOCK_H + 3], [TAIL_X + 22, TRACK_Y[0] - GANTRY.half, GANTRY.h]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 50 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -146, y: 66, w: 80, d: 7, r: 1 })
    + labelPlate(P, { x: -146, y: 79, w: 56, d: 20, r: 1.5 }, [[-140, 84, 34], [-140, 88.5, 44], [-140, 93, 26]]);
}

function traverserRails() {
  const out = [];
  for (const x of [TRAVERSER.x0 + 2, TRAVERSER.x1 - 3]) {
    out.push(S(k.slabOf({ x, y: TRAVERSER.rail[0], w: 1.4, d: TRAVERSER.rail[1] - TRAVERSER.rail[0], r: 0.4 }, 0, 1.4, P, 2), { tone: "mid", crease: "none" }));
  }
  out.push(D([TRAVERSER.rail[0] + 3, TRAVERSER.rail[1] - 3].flatMap((y) => [at([TRAVERSER.x0 + 2.7, y, 1.4]), at([TRAVERSER.x1 - 2.3, y, 1.4])]), { size: 0.4, tone: "lo" }));
  return out.join("");
}

function shed() {
  const out = [];
  out.push(S(k.slabOf(SHED, 0, SHED_H, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(SHED, 14, P, 3), { tone: "faint" }) }));
  out.push(S(k.slabOf(k.insetPlan(SHED, -2), SHED_H, 3, P, 3, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(SHED, 4), SHED_H + 3, P), { tone: "faint" }));
  const face = SHED.x + SHED.w;
  const doors = TRACK_Y.map((y) => k.faceRectX(P, face, y - 8, y + 8, 0, 15)).join("");
  out.push(`<path class="door" d="${doors}"/>`);
  out.push(L(doors, { tone: "lo" }));
  out.push(D(k.corners(k.insetPlan(SHED, -2), 4).map(([x, y]) => at([x, y, SHED_H + 3])), { size: 0.45 }));
  // Above each door, a digit counter: how many cars on that track are past its bookmark (the lag).
  TRACK_Y.forEach((y, i) => {
    const W = LAG_WINDOW, win = k.faceRectX(P, face, y - W.half, y + W.half, W.z0, W.z1);
    out.push(`<g data-shed-lag="${i}"><path class="window" d="${win}"/>${L(win, { tone: "lo" })}`
      + k.faceTextSvg(k.sideMatrix([face, y - W.half + 1.6], W.z0 + 1.8, P, "right"), "0", { size: 5.4, tone: "hi", anchor: "end" }).replace("<text ", "<text data-lag ")
      + D([at([face, y - W.half - 1.4, W.z1 - 1]), at([face, y + W.half + 1.4, W.z1 - 1])], { size: 0.45, tone: "lo" }) + `</g>`);
  });
  return out.join("");
}

function track(y, index) {
  const out = [];
  const bed = { x: BED.x0, y: y - BED.half, w: BED.x1 - BED.x0, d: BED.half * 2, r: 0.8 };
  out.push(S(k.slabOf(bed, 0, 1.5, P, 2), { tone: "lo", crease: "none" }));
  const sleepers = [];
  for (let x = BED.x0 + 4; x < BED.x1 - 2; x += 6) sleepers.push(k.lineOnTop([x, y - BED.half], [x, y + BED.half], 1.5, P));
  out.push(L(sleepers.join(""), { tone: "faint" }));
  for (const ry of [y - 4, y + 3]) out.push(S(k.slabOf({ x: BED.x0, y: ry, w: BED.x1 - BED.x0 - 1, d: 1, r: 0.3 }, 1.5, RAIL_Z - 1.5, P, 2), { tone: "mid", crease: "none" }));
  return `<g data-track="${index}">${out.join("")}<g data-cars="${index}"></g>${bookmark(y, index)}</g>`;
}

function bookmark(y, index) {
  const G = GANTRY, B = G.board;
  const post = (py) => S(k.cylinder(0, py, 0.9, 0, G.h, P, 14), { tone: "mid", crease: "none" }) + S(k.cylinder(0, py, 1.8, 0, 1, P, 16), { tone: "mid" });
  const beam = S(k.slabOf({ x: -1.2, y: y - G.half - 1, w: 2.4, d: G.half * 2 + 2, r: 0.4 }, G.h - 1.6, 1.6, P, 2, 0.3), { tone: "mid" });
  const board = S(k.slabOf({ x: B.x0, y: y - 0.6, w: B.w, d: 1.2, r: 0.3 }, B.z, G.h - B.z, P, 2), { tone: "hi", crease: "lo" })
    + k.faceTextSvg(k.sideMatrix([B.x0 + B.w / 2, y + 0.6], B.z + 1.4, P, "left"), "0", { size: 4.6, tone: "hi", anchor: "middle" }).replace("<text ", "<text data-num ");
  return `<g data-bookmark="${index}">${post(y - G.half)}${beam}<g data-flag>${board}</g>${post(y + G.half)}${D([at([0, y + G.half, G.h])], { size: 0.5, tone: "lo" })}</g>`;
}

// One wagon at the origin (centre of its slot, on the rails); live code moves it with translateAlong.
export function carSvg() {
  const body = { x: -CAR.w / 2, y: -CAR.d / 2, w: CAR.w, d: CAR.d, r: 0.6 };
  const chassis = S(k.slabOf({ x: -CAR.w / 2 + 1, y: -CAR.d / 2 + 1, w: CAR.w - 2, d: CAR.d - 2, r: 0.4 }, RAIL_Z - 0.4, 0.8, P, 2), { tone: "lo", crease: "none" });
  const box = S(k.slabOf(body, CAR.z, CAR.h, P, 2, 0.3), { tone: "hi", crease: "lo" });
  const top = CAR.z + CAR.h;
  const dots = Array.from({ length: 6 }, (_, n) => {
    const pts = Array.from({ length: n + 1 }, (_, i) => at([-4.5 + i * 1.8, 0, top]));
    return `<g data-key="${n}" style="display:none">${D(pts, { size: 0.55, tone: "hi" })}</g>`;
  }).join("");
  const stamp = `<g data-stamp style="display:none">${L(k.lineOnTop([-CAR.w / 2, -CAR.d / 2 + 1.6], [CAR.w / 2, -CAR.d / 2 + 1.6], top, P), { tone: "mid" })}</g>`;
  const front = CAR.d / 2;
  const plate = L(k.faceRectY(P, -5.2, 5.2, front, CAR.z + 1, CAR.z + 5.6), { tone: "lo" });
  const num = k.faceTextSvg(k.sideMatrix([0, front], CAR.z + 2, P, "left"), "0", { size: 4.2, tone: "hi", anchor: "middle" }).replace("<text ", "<text data-num ");
  return chassis + box + plate + num + stamp + dots;
}

function traverserTable() {
  const out = [S(k.slabOf({ x: TRAVERSER.x0, y: -8, w: TRAVERSER.x1 - TRAVERSER.x0, d: 16, r: 0.8 }, 1.4, 1.6, P, 2, 0.3), { tone: "mid" })];
  for (const ry of [-3.6, 2.6]) out.push(S(k.slabOf({ x: TRAVERSER.x0 + 1, y: ry, w: TRAVERSER.x1 - TRAVERSER.x0 - 2, d: 1, r: 0.3 }, 3, 0.4, P, 2), { tone: "mid", crease: "none" }));
  out.push(D([at([TRAVERSER.x0 + 1.5, -6.5, 3]), at([TRAVERSER.x1 - 1.5, 6.5, 3])], { size: 0.4, tone: "lo" }));
  return `<g data-traverser>${out.join("")}</g>`;
}

function dock() {
  const out = [];
  out.push(S(k.slabOf(DOCK, 0, DOCK_H, P, 3, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(DOCK, -1.5), DOCK_H, 2.5, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(DOCK, 4), DOCK_H + 2.5, P), { tone: "faint" }));
  out.push(L(k.faceRectY(P, DOCK.x + 5, DOCK.x + 25, DOCK.y + DOCK.d, 6, 18), { tone: "lo" }));
  out.push(L([10, 14].map((z) => k.segment([DOCK.x + 5, DOCK.y + DOCK.d, z], [DOCK.x + 25, DOCK.y + DOCK.d, z], P)).join(""), { tone: "faint" }));
  out.push(S(k.cylinder(DOCK.x + 22, DOCK.y + 10, 2.4, DOCK_H + 2.5, 2.5, P, 18), { tone: "mid" }));
  return out.join("");
}

function cabin(i) {
  const x = CABIN_X[i], y = CABIN.y;
  const plan = { x: x - CABIN.w / 2, y, w: CABIN.w, d: CABIN.d, r: 1.2 };
  const out = [];
  out.push(S(k.slabOf(plan, 0, CABIN.h, P, 3, 0.5), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(plan, -1.2), CABIN.h, 1.6, P, 3, 0.4), { tone: "mid" }));
  const front = y + CABIN.d;
  out.push(L(k.faceRectY(P, x - 7, x + 3, front, 3, 8), { tone: "lo" }));
  out.push(`<path class="shutter" data-shutter d="${k.faceRectY(P, x - 7, x + 3, front, 3, 8)}" style="display:none"/>`);
  out.push(L(k.faceRectY(P, x + 4.6, x + 8.6, front, 3, 8), { tone: "lo" }));
  out.push(k.faceTextSvg(k.sideMatrix([x + 6.6, front], 4.2, P, "left"), String(i + 1), { size: 4.4, tone: "hi", anchor: "middle" }));
  const lamp = S(k.cylinder(x + 5, y + 6, 1.9, CABIN.h + 1.6, 2.2, P, 16), { tone: "mid" });
  const mx = x + MAST.dx, my = y + MAST.dy;
  const mast = S(k.cylinder(mx, my, 0.8, CABIN.h + 1.6, MAST.top - CABIN.h - 1.6, P, 14), { tone: "mid", crease: "none" })
    + S(k.cylinder(mx, my, 1.6, CABIN.h + 1.6, 0.8, P, 16), { tone: "mid" })
    + S(k.cylinder(mx, my, 1.3, MAST.top - 0.4, 1.2, P, 16), { tone: "mid" });
  return `<g data-cabin="${i}">${out.join("")}<g data-lamp>${lamp}</g>${mast}</g>`;
}

function pads() {
  return L(CABIN_X.map((x) => k.planOutline({ x: x - CABIN.w / 2 - 1.5, y: CABIN.y - 1.5, w: CABIN.w + 3, d: CABIN.d + 3, r: 1.5 }, 0, P, 3)).join(""), { tone: "lo" });
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A rail yard on a base plate. Up to four parallel tracks are the partitions of a topic. At the right, a loading dock and a transfer table couple each new numbered car (a record) to the near end of one track, pushing the older cars back towards an archive shed at the left, where they are kept. Along the front stand up to six reading cabins: the consumers of one group. An overhead wire runs from each cabin's mast to the bookmark gantry on every track it owns; the gantry's board shows the committed offset. Every car carries its offset on a number plate, and a counter above each shed door shows that track's lag; the car being read lights up.",
    body: [
      plate(),
      pads(),
      traverserRails(),
      shed(),
      ...TRACK_Y.map((y, i) => track(y, i)),
      traverserTable(),
      `<g data-incoming></g>`,
      dock(),
      CABIN_X.map((_, i) => cabin(i)).join(""),
      `<g data-cables></g>`,
    ],
  });
}

export const GEOMETRY = { GANTRY, MAST, TRACK_Y, TAIL_X, SPACING, WINDOW, SHED_X, CAR, CABIN, CABIN_X, TRAVERSER };

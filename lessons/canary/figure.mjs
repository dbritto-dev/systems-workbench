// A model railway junction: a main line splits at a points lever into the old track and a short
// canary track. Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";

export const WIDTH = 700;
export const HEIGHT = 420;

const PLATE = { x: -178, y: -66, w: 334, d: 138, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;
const BED = 5;          // half width of the ballast bed
const BED_H = 1.5;      // track top
const RAIL = 2.4;       // half gauge

export const OLD_Y = -16;
export const NEW_Y = 16;
const START = -170;
const SPLIT = -104;
const ALIGN = -64;
const END = 132;
export const PATHS = {
  old: [[START, 0], [SPLIT, 0], [ALIGN, OLD_Y], [END, OLD_Y]],
  new: [[START, 0], [SPLIT, 0], [ALIGN, NEW_Y], [END, NEW_Y]],
};
export const DERAIL_X = -34;

// Points lever frame (back left, behind the junction).
const FRAME = { x: -152, y: -58, w: 112, d: 22, r: 2 };
const FRAME_H = 5;
export const NOTCHES = [0, 1, 5, 25, 50, 100];
export const notchX = (i) => -140 + i * 17;
export const PUSHER_PARK = -48;

// Console with three gauges (front right).
const CONSOLE = { x: 22, y: 42, w: 112, d: 22, r: 2 };
const CONSOLE_H = 6;
export const DIALS = { old: [44, 53], new: [76, 53], timer: [110, 53] };
export const DIAL_R = 10;
export const DIAL_TOP = CONSOLE_H + 4;
export const SWEEP = { from: -0.75 * Math.PI, span: 1.5 * Math.PI };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-10, -9, 23], [90, 9, 23], [-60, -49, 25]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 63 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);

// ---------- track geometry ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const norm = (v) => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };
// Offset a polyline sideways by `by` (left of travel is +), with mitred joins.
function offset(points, by) {
  return points.map((p, i) => {
    const a = norm(sub(points[Math.min(i + 1, points.length - 1)], points[Math.max(i - 1, 0)]));
    let n = [-a[1], a[0]];
    if (i > 0 && i < points.length - 1) {
      const d1 = norm(sub(p, points[i - 1])), d2 = norm(sub(points[i + 1], p));
      const n1 = [-d1[1], d1[0]], n2 = [-d2[1], d2[0]];
      const m = norm([n1[0] + n2[0], n1[1] + n2[1]]);
      const scale = 1 / (m[0] * n1[0] + m[1] * n1[1]);
      n = [m[0] * scale, m[1] * scale];
    }
    return [p[0] + n[0] * by, p[1] + n[1] * by];
  });
}
export function lengthOf(points) { let s = 0; for (let i = 1; i < points.length; i++) s += Math.hypot(...sub(points[i], points[i - 1])); return s; }
export function pointAt(points, s) {
  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(...sub(points[i], points[i - 1]));
    if (s <= seg || i === points.length - 1) { const t = Math.max(0, Math.min(1, s / seg)); return [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t]; }
    s -= seg;
  }
  return points[points.length - 1];
}

function bed(points, skip = 0) {
  const ring = [...offset(points, BED), ...offset(points, -BED).reverse()];
  const out = [S(k.extrude(ring, 0, BED_H, P, { convex: false }), { tone: "lo", crease: "none" })];
  const rails = [offset(points, RAIL), offset(points, -RAIL)].map((line) => k.onTop(line, BED_H, P)).join("");
  // Sleepers every 6 units, edge to edge of the bed.
  const sleepers = [];
  const total = lengthOf(points);
  for (let s = 3 + skip; s < total - 2; s += 6) {
    const a = pointAt(points, s), b = pointAt(points, s + 0.01);
    const dir = norm(sub(b, a)), n = [-dir[1], dir[0]];
    sleepers.push(k.lineOnTop([a[0] + n[0] * (BED - 0.6), a[1] + n[1] * (BED - 0.6)], [a[0] - n[0] * (BED - 0.6), a[1] - n[1] * (BED - 0.6)], BED_H, P));
  }
  out.push(L(sleepers.join(""), { tone: "faint" }));
  out.push(L(rails, { tone: "mid" }));
  return out.join("");
}

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -150, y: 54, w: 156, d: 7, r: 1 })           // along the front edge
    + labelPlate(P, { x: 92, y: -58, w: 44, d: 18, r: 1.5 }, [[98, -53, 24], [98, -48.5, 32], [98, -44, 18]]);   // back right
}

function tracks() {
  return bed(PATHS.old) + bed(PATHS.new.slice(1), 12) + buffers();
}

function buffers() {
  const out = [];
  for (const y of [OLD_Y, NEW_Y]) {
    out.push(S(k.slabOf({ x: END + 4, y: y - 5, w: 6, d: 10, r: 1 }, BED_H, 6, P, 3, 0.4), { tone: "mid" }));
    for (const dy of [-2.4, 2.4]) out.push(S(k.cylinder(END + 3, y + dy, 1.3, BED_H + 3, 1.6, P, 14), { tone: "mid" }));
  }
  return out.join("");
}

function station() {
  const out = [];
  const platform = { x: -10, y: -7, w: 100, d: 14, r: 1.5 };
  out.push(S(k.slabOf(platform, 0, 5, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(platform, 1.4), 5, P), { tone: "faint" }));
  for (const x of [4, 40, 76]) out.push(S(k.cylinder(x, 0, 1.2, 5, 15, P, 14), { tone: "mid", crease: "none" }));
  const roof = { x: -6, y: -9, w: 92, d: 18, r: 1.5 };
  out.push(S(k.slabOf(roof, 20, 2.5, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(roof, 2.4), 22.5, P), { tone: "faint" }));
  return out.join("");
}

function frame() {
  const out = [];
  out.push(S(k.slabOf(FRAME, 0, FRAME_H, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline({ x: -146, y: -50.4, w: 102, d: 3, r: 1.2 }, FRAME_H, P, 3), { tone: "lo" }));
  const strip = { x: -146, y: -44.5, w: 102, d: 5, r: 1 };
  out.push(S(k.slabOf(strip, FRAME_H, 0.6, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(NOTCHES.map((_, i) => k.lineOnTop([notchX(i), -43.9], [notchX(i), -41], FRAME_H + 0.6, P)).join(""), { tone: "mid" }));
  out.push(D([at([FRAME.x + 3, FRAME.y + 3, FRAME_H]), at([FRAME.x + FRAME.w - 3, FRAME.y + 3, FRAME_H]), at([FRAME.x + 3, FRAME.y + FRAME.d - 3, FRAME_H]), at([FRAME.x + FRAME.w - 3, FRAME.y + FRAME.d - 3, FRAME_H])], { size: 0.45 }));
  return out.join("");
}

// Lever handle, built at x = 0 and moved along the slot.
export function handleSvg() {
  return S(k.slabOf({ x: -4, y: -53, w: 8, d: 8, r: 1 }, FRAME_H, 3, P, 2, 0.3), { tone: "mid" })
    + S(k.cylinder(0, -49, 1.4, FRAME_H + 3, 12, P, 14), { tone: "mid", crease: "none" })
    + S(k.cylinder(0, -49, 3, FRAME_H + 15, 4, P, 24, 0.4), { tone: "hi" })
    + L(k.knurl(0, -49, 3, FRAME_H + 15, FRAME_H + 19, 18, P), { tone: "lo" });
}

// Rollback pusher: rides the slot on the +x side of the handle and drives it back to 0.
export function pusherSvg() {
  return S(k.slabOf({ x: -4.5, y: -53, w: 1.6, d: 8, r: 0.4 }, FRAME_H + 1, 4, P, 2), { tone: "mid", crease: "none" })
    + S(k.slabOf({ x: -3, y: -52.5, w: 6, d: 7, r: 1 }, FRAME_H, 6, P, 2, 0.3), { tone: "hi", crease: "lo" });
}

function consoleBase() {
  const out = [];
  out.push(S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 4, 0.6), { tone: "mid" }));
  out.push(D(k.corners(CONSOLE, 3).map(([x, y]) => at([x, y, CONSOLE_H])), { size: 0.45 }));
  for (const [name, [x, y]] of Object.entries(DIALS)) {
    out.push(S(k.cylinder(x, y, DIAL_R, CONSOLE_H, 4, P, 56, 0.6), { tone: "hi", crease: "lo" }));
    out.push(L(k.ring(x, y, DIAL_R - 1.6, DIAL_TOP, P, 56), { tone: "lo" }));
    const ticks = name === "timer"
      ? k.radialTicks(x, y, DIAL_R - 2, 12, 3, DIAL_TOP, [1, 2.2], P)
      : k.radialTicks(x, y, DIAL_R - 2, 20, 5, DIAL_TOP, [1, 2.2], P, SWEEP.from, SWEEP.span);
    out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
    out.push(L(k.ring(x, y, 1, DIAL_TOP, P, 12), { tone: "mid" }));
  }
  out.push(k.faceTextSvg(k.topMatrix([DIALS.new[0], DIALS.new[1] + 5.5], DIAL_TOP, P, "x"), "2%", { size: 1.8, tone: "lo", anchor: "middle" }));
  return out.join("");
}

export const needleAt = (center, angle, len) => k.lineOnTop([center[0] - Math.sin(angle) * 1.8, center[1] + Math.cos(angle) * 1.8], [center[0] + Math.sin(angle) * len, center[1] - Math.cos(angle) * len], DIAL_TOP + 0.2, P);

// A train at the origin, centred on the track, facing +x: flat wagon with an order crate, then the cab.
export function trainSvg() {
  return `<g data-train class="train" style="opacity:0">`
    + S(k.slabOf({ x: -12, y: -4, w: 24, d: 8, r: 1 }, BED_H, 2.2, P, 2, 0.3), { tone: "mid" })
    + S(k.slabOf({ x: -11.5, y: -3.7, w: 14, d: 7.4, r: 0.6 }, BED_H + 2.2, 1, P, 2), { tone: "mid", crease: "none" })
    + `<g data-crate>${S(k.slabOf({ x: -10, y: -3, w: 10.5, d: 6, r: 0.5 }, BED_H + 3.2, 6.5, P, 2, 0.3), { tone: "hi", crease: "lo" })}</g>`
    + S(k.slabOf({ x: 3.5, y: -3.7, w: 8, d: 7.4, r: 0.8 }, BED_H + 2.2, 10, P, 2, 0.4), { tone: "hi", crease: "lo" })
    + `</g>`;
}

export function buildFigure(poolSize) {
  const pool = (n) => Array.from({ length: n }, () => trainSvg()).join("");
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A model railway junction on a base plate. Trains, each one a customer order, come down the main line to a points switch. A lever on the front frame sets how many go onto the new canary track; the rest stay on the old track. Both tracks run through a station to buffer stops. Trains on the canary track that hit the bug derail before the station. A console shows the old track's failure rate, the canary's failure rate against a threshold mark, and a timer for the rollback check; when the check fails, a pusher drives the lever back to zero.",
    body: [
      plate(),
      tracks(),
      `<g data-layer="old">${pool(poolSize)}</g>`,
      station(),
      `<g data-layer="new">${pool(poolSize)}</g>`,
      frame(),
      `<g data-pusher>${pusherSvg()}</g>`,
      `<g data-handle>${handleSvg()}</g>`,
      consoleBase(),
      `<path data-needle="old" class="iso-line" data-tone="mid" data-free="start" style="stroke-width:1"/>`,
      `<path data-threshold class="iso-line" data-tone="lit" data-free="" style="stroke-width:1.2"/>`,
      `<path data-needle="new" class="iso-line" data-tone="lit" data-free="start" style="stroke-width:1.1"/>`,
      `<path data-needle="timer" class="iso-line" data-tone="hi" data-free="start" style="stroke-width:1"/>`,
    ],
  });
}

export const GEOMETRY = { PATHS, DERAIL_X, NOTCHES, PUSHER_PARK, DIALS, DIAL_R, DIAL_TOP, SWEEP, OLD_Y, NEW_Y, BED_H };

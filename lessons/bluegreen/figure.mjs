// Two identical press lines (blue = current, green = new) fed by one infeed through a gate that sends
// all traffic to one side at once, with a shared records cabinet (the database) behind both.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";

export const WIDTH = 720;
export const HEIGHT = 440;

const PLATE = { x: -180, y: -88, w: 360, d: 176, r: 8 };
const PLATE_H = 12, FOOT_H = 5;
const BENCH_Z = 8, BELT_Z = 10;
export const LINES = { blue: -42, green: 42 };
export const STATIONS = [8, 34, 60];
export const QUEUE = { x0: -14, gap: 9, shown: 6 };
export const LANE_END_X = -62;
export const GATE = [-80, 0];
const GATE_R = 15;
export const INFEED = { from: -164, to: GATE[0] - 6 };
export const OUTFEED = { x: 91 };
export const BIN = { x: 78, dy: 14 };
const CACHE = { x0: -54, n: 10, gap: 3 };
const CAB = { x: 115, y: -30, w: 50, d: 60, r: 3 };
const CAB_H = 58;
export const HEAD = { rest: 21, press: 17.6 };
export const ITEM = { size: 8, h: 7 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [CAB.x, CAB.y, CAB_H + 4], [CAB.x + CAB.w, CAB.y + CAB.d, CAB_H + 4], [60, -57, 40]],
  WIDTH, HEIGHT, { pad: 22, azimuth: 52 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const faceRectY = (x0, x1, y, z0, z1) => k.faceRectY(P, x0, x1, y, z0, z1);
const faceRectX = (x, y0, y1, z0, z1) => k.faceRectX(P, x, y0, y1, z0, z1);

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H, footInset: 24 })
    + rulerStrip(P, { x: -100, y: 72, w: 190, d: 7, r: 1 })
    + labelPlate(P, { x: -166, y: 34, w: 44, d: 20, r: 1.5 }, [[-160, 39, 24], [-160, 44, 32], [-160, 49, 18]]);
}

// One press line: bench, belt, cache tray, press columns, outfeed tray, reject bin, run lamp.
function lineBase(name) {
  const ys = LINES[name];
  const out = [];
  const bench = { x: LANE_END_X, y: ys - 22, w: 162, d: 44, r: 2.5 };
  out.push(S(k.slabOf(bench, 0, BENCH_Z, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(bench, 4, P, 4), { tone: "faint" }) }));
  const belt = { x: LANE_END_X + 2, y: ys - 6, w: 142, d: 12, r: 1 };
  out.push(S(k.slabOf(belt, BENCH_Z, BELT_Z - BENCH_Z, P, 3, 0.3), { tone: "lo", crease: "none" }));
  const rollers = [];
  for (let x = belt.x + 6; x < belt.x + belt.w - 3; x += 7) rollers.push(k.lineOnTop([x, belt.y], [x, belt.y + belt.d], BELT_Z, P));
  out.push(L(rollers.join(""), { tone: "faint" }));
  // Cache tray at the back left, its cards are live.
  const tray = { x: CACHE.x0 - 3, y: ys - 20, w: CACHE.n * CACHE.gap + 4, d: 9, r: 1 };
  out.push(S(k.slabOf(tray, BENCH_Z, 2, P, 3, 0.3), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(tray, 1.2), BENCH_Z + 2, P, 2), { tone: "lo" }));
  out.push(`<g data-cache="${name}">${Array.from({ length: CACHE.n }, (_, i) => `<g data-card="${i}" style="display:none">${S(k.slabOf({ x: CACHE.x0 + i * CACHE.gap, y: ys - 18.5, w: 1.2, d: 6, r: 0.2 }, BENCH_Z + 2, 6, P, 2), { tone: "hi", crease: "none" })}</g>`).join("")}</g>`);
  // Press columns (behind the belt).
  for (const sx of STATIONS) {
    out.push(S(k.slabOf({ x: sx - 5, y: ys - 19, w: 10, d: 8, r: 1 }, BENCH_Z, 2, P, 2, 0.3), { tone: "mid" }));
    out.push(S(k.cylinder(sx, ys - 15, 3, BENCH_Z + 2, 36 - BENCH_Z - 2, P, 20), { tone: "mid", crease: "none" }));
    out.push(L(k.sideArc(sx, ys - 15, 3, 24, P, 12), { tone: "faint" }));
  }
  // Outfeed tray at the end of the belt.
  const out_ = { x: OUTFEED.x - 7, y: ys - 8, w: 14, d: 16, r: 1 };
  out.push(S(k.slabOf(out_, BENCH_Z, 3, P, 3, 0.3), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(out_, 1.6), BENCH_Z + 3, P, 2), { tone: "lo" }));
  // Reject bin beside the last press, on the near side of the belt.
  const bin = { x: BIN.x - 8, y: ys + 8, w: 16, d: 11, r: 1 };
  out.push(S(k.slabOf(bin, BENCH_Z, 6, P, 3, 0.3), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(bin, 1.4), BENCH_Z + 6, P, 2), { tone: "lo" }));
  // Run lamp at the front left.
  out.push(S(k.cylinder(-54, ys + 15, 4.2, BENCH_Z, 1.5, P, 24), { tone: "mid" }));
  out.push(`<g data-lamp="${name}">${S(k.cylinder(-54, ys + 15, 2.8, BENCH_Z + 1.5, 2.5, P, 24), { tone: "hi", crease: "lo" })}</g>`);
  return out.join("");
}

// Press arms and heads, drawn over the items on the belt.
function lineHeads(name) {
  const ys = LINES[name];
  return STATIONS.map((sx, i) => {
    const head = `<g data-head="${name}-${i}">${S(k.cylinder(sx, ys, 1.3, HEAD.rest + 6, 9, P, 14), { tone: "mid", crease: "none" })}${S(k.cylinder(sx, ys, 4.5, HEAD.rest, 6, P, 28, 0.4), { tone: "hi", crease: "lo", lit: name === "green" })}</g>`;
    const arm = S(k.slabOf({ x: sx - 3, y: ys - 18, w: 6, d: 22, r: 1 }, 34, 4, P, 2, 0.4), { tone: "mid" });
    return head + arm + D([at([sx, ys - 15, 38]), at([sx, ys, 38])], { size: 0.4, tone: "lo" });
  }).join("");
}

// A straight chute from the gate's rim to the start of a line's belt, square at both ends.
// Its far end runs under the bench, which is drawn after it.
function lane(name) {
  const ys = LINES[name];
  const dir = [LANE_END_X + 4 - GATE[0], ys - GATE[1]], len = Math.hypot(...dir);
  const u = [dir[0] / len, dir[1] / len], n = [-u[1], u[0]];
  const c0 = [GATE[0] + u[0] * (GATE_R - 2), GATE[1] + u[1] * (GATE_R - 2)];
  const c1 = [LANE_END_X + 4, ys];
  const pts = [[c0[0] - n[0] * 6, c0[1] - n[1] * 6], [c1[0] - n[0] * 6, c1[1] - n[1] * 6], [c1[0] + n[0] * 6, c1[1] + n[1] * 6], [c0[0] + n[0] * 6, c0[1] + n[1] * 6]];
  const cx = pts.reduce((sum, p) => sum + p[0], 0) / 4, cy = pts.reduce((sum, p) => sum + p[1], 0) / 4;
  pts.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  const rails = [-6, 6].map((off) => k.lineOnTop([c0[0] + n[0] * off * 0.8, c0[1] + n[1] * off * 0.8], [c1[0] + n[0] * off * 0.8, c1[1] + n[1] * off * 0.8], BELT_Z, P)).join("");
  return S(k.extrude(pts, 0, BELT_Z, P, { convex: true, bevel: 0.3 }), { tone: "mid", inner: "" }) + L(rails, { tone: "faint" });
}

function infeed() {
  const out = [];
  const bench = { x: -170, y: -10, w: 80, d: 20, r: 2 };
  out.push(S(k.slabOf(bench, 0, BENCH_Z, P, 4, 0.5), { tone: "mid" }));
  const belt = { x: -168, y: -6, w: 76, d: 12, r: 1 };
  out.push(S(k.slabOf(belt, BENCH_Z, 2, P, 3, 0.3), { tone: "lo", crease: "none" }));
  const rollers = [];
  for (let x = belt.x + 5; x < belt.x + belt.w - 2; x += 7) rollers.push(k.lineOnTop([x, belt.y], [x, belt.y + belt.d], BELT_Z, P));
  out.push(L(rollers.join(""), { tone: "faint" }));
  // Gate: base, turntable with ticks.
  out.push(S(k.cylinder(GATE[0], GATE[1], GATE_R, 0, BENCH_Z, P, 56, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(GATE[0], GATE[1], GATE_R - 2, BENCH_Z, 2, P, 56, 0.4), { tone: "hi", crease: "lo" }));
  const ticks = k.radialTicks(GATE[0], GATE[1], GATE_R - 3, 36, 6, BELT_Z, [1, 2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  return out.join("");
}

export function gateArm(angle, lit) {
  const [cx, cy] = GATE;
  const u = [Math.cos(angle), Math.sin(angle)], n = [-u[1], u[0]];
  const pt = (r, s) => [cx + u[0] * r + n[0] * s, cy + u[1] * r + n[1] * s];
  const ring = [pt(-3, -2.2), pt(11, -2.2), pt(12.5, 0), pt(11, 2.2), pt(-3, 2.2)];
  return S(k.extrude(ring, BELT_Z, 3, P, { convex: true, bevel: 0.3 }), { tone: "hi", crease: "lo", lit })
    + S(k.cylinder(cx, cy, 3, BELT_Z, 5.5, P, 20, 0.3), { tone: "mid" });
}
export const LANE_ANGLE = { blue: Math.atan2(LINES.blue - GATE[1], LANE_END_X - GATE[0]), green: Math.atan2(LINES.green - GATE[1], LANE_END_X - GATE[0]) };

function duct(name) {
  const ys = LINES[name];
  const sign = Math.sign(ys);
  const run = { x: 100, y: ys - 4, w: 26, d: 8, r: 1 };
  const rise = sign < 0 ? { x: 118, y: ys - 4, w: 8, d: CAB.y - (ys - 4) + 1, r: 1 } : { x: 118, y: CAB.y + CAB.d - 1, w: 8, d: ys + 4 - (CAB.y + CAB.d - 1), r: 1 };
  const parts = [S(k.slabOf(run, 2, 6, P, 2, 0.3), { tone: "mid" }), S(k.slabOf(rise, 2, 6, P, 2, 0.3), { tone: "mid" })];
  const flange = sign < 0 ? { x: 116.5, y: CAB.y - 2, w: 11, d: 2, r: 0.5 } : { x: 116.5, y: CAB.y + CAB.d, w: 11, d: 2, r: 0.5 };
  parts.push(S(k.slabOf(flange, 0.5, 9, P, 2, 0.3), { tone: "mid" }));
  parts.push(S(k.slabOf({ x: 100, y: ys - 5.5, w: 2, d: 11, r: 0.5 }, 0.5, 9, P, 2, 0.3), { tone: "mid" }));
  return sign < 0 ? parts.join("") : parts.reverse().join("");
}

function cabinet() {
  const out = [];
  out.push(S(k.slabOf(k.insetPlan(CAB, 2), 0, 3, P, 4, 0.3), { tone: "lo" }));
  out.push(S(k.slabOf(CAB, 3, CAB_H - 3, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(CAB, 30, P, 4), { tone: "faint" }) }));
  out.push(S(k.slabOf(k.insetPlan(CAB, -1.5), CAB_H, 3, P, 4, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(CAB, 4), CAB_H + 3, P), { tone: "faint" }));
  // Drawers on the +x face and a version plate on the +y face.
  const fx = CAB.x + CAB.w;
  out.push(L([8, 18].map((z) => faceRectX(fx, CAB.y + 6, CAB.y + CAB.d - 6, z, z + 8)).join("") + [38, 46].map((z) => faceRectX(fx, CAB.y + 6, CAB.y + CAB.d - 6, z, z + 6)).join(""), { tone: "lo" }));
  out.push(L([12, 22, 41, 49].map((z) => faceRectX(fx, -4, 4, z, z + 1.6)).join(""), { tone: "mid" }));
  const fy = CAB.y + CAB.d;
  out.push(S(k.slabOf({ x: CAB.x + 10, y: fy, w: 30, d: 1, r: 0.3 }, 36, 12, P, 2), { tone: "hi", crease: "none" }));
  out.push(D([at([CAB.x + 12, fy + 1, 46]), at([CAB.x + 38, fy + 1, 46]), at([CAB.x + 12, fy + 1, 38]), at([CAB.x + 38, fy + 1, 38])], { size: 0.4, tone: "lo" }));
  out.push(`<text data-schema class="iso-face-text" data-tone="mid" transform="${k.sideMatrix([CAB.x + 25, fy + 1], 40.5, P, "left")}" font-size="4.2" text-anchor="middle">SCHEMA v1</text>`);
  out.push(L(faceRectY(CAB.x + 10, CAB.x + 40, fy + 1, 26, 32), { tone: "lo" }));
  out.push(L(faceRectY(CAB.x + 10, CAB.x + 40, fy + 1, 12, 18), { tone: "lo" }));
  return out.join("");
}

export function itemSvg() {
  return S(k.slabOf({ x: -ITEM.size / 2, y: -ITEM.size / 2, w: ITEM.size, d: ITEM.size, r: 1 }, 0, ITEM.h, P, 2, 0.4), { tone: "hi", crease: "lo" });
}

export const POOL = 44;
export function buildFigure() {
  const pool = (layer) => `<g data-layer="${layer}"></g>`;
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "Two identical press lines on one base plate, fed by a single infeed belt through a turntable gate. The gate's arm points at the live line; every request goes to that line. The back line is blue, the version in production; the front line is green, the new version. A records cabinet at the back right is the shared database, with a schema plate on its face. Each line has a cache tray, three presses, an outfeed tray and a reject bin.",
    body: [
      plate(),
      duct("blue"), lane("blue"), lineBase("blue"),
      pool("blue"),
      lineHeads("blue"),
      infeed(),
      pool("mid"),
      `<g data-arm>${gateArm(LANE_ANGLE.blue, false)}</g>`,
      cabinet(),
      duct("green"), lane("green"), lineBase("green"),
      pool("green"),
      lineHeads("green"),
      `<g data-pool hidden>${Array.from({ length: POOL }, (_, i) => `<g data-item="${i}" style="display:none">${itemSvg()}</g>`).join("")}</g>`,
    ],
  });
}

export const GEOMETRY = { LINES, STATIONS, QUEUE, LANE_END_X, GATE, INFEED, OUTFEED, BIN, CACHE, HEAD, ITEM, LANE_ANGLE, BELT_Z };

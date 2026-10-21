// Three branch offices keep one shared count in a central register, by courier.
// Every number that matters is a row of printed counter wheels on a real object:
//   each branch: a hand tally clicker (adds it took) and a desk display (the total it last read);
//   the register: one big shared counter (one key), or one slot counter per branch (G-counter);
//   compare-and-swap: a stamp over the shared counter and a spindle of rejected slips.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, digitCounter } from "../../workbench/parts.mjs";

export const WIDTH = 700;
export const HEIGHT = 420;

const PLATE = { x: -112, y: -96, w: 224, d: 170, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

export const XS = [-64, 0, 64];             // branch, track and slot centre for A, B, C
const CAB = { x: -100, y: -84, w: 200, d: 32, r: 2.5 };
const CAB_H = 24;
const CAB_FRONT = CAB.y + CAB.d;            // -52
export const REG_Y = CAB_FRONT + 3;         // couriers arrive here, just in front of the mouth
export const BRANCH_Y = 30;                 // couriers leave the back of the desk here
const DESK_D = 28;
const DESK_H = 12;
export const BARRIER_Y = -10;
export const LANE = 3.2;                    // up lane at x - LANE, down lane at x + LANE
export const PUCK = { r: 2.9, h: 2.6, z: 0.6 };
export const SLIPS = 12;                    // rejected slips the spindle can show

// Counters: rows of printed wheels (the shared digitCounter), most in a thin housing proud of their face.
const PROUD = 1.4;
export const COUNTERS = {
  main: { x: -15.3, y: CAB_FRONT + PROUD, z: 7.5, w: 9.2, h: 13.5, gap: 1.2, count: 3, size: "l", pad: [4.2, 2.5, 2] },
  slot: XS.map((cx) => ({ x: cx - 10.9, y: CAB_FRONT + PROUD, z: 9, w: 6.6, h: 10, gap: 1.1, count: 3, size: "m", pad: [3.1, 2.5, 2.5] })),
  view: XS.map((cx) => ({ x: cx - 17.4, y: BRANCH_Y + DESK_D + PROUD, z: 2.4, w: 6, h: 7.6, gap: 0.9, count: 3, size: "m", pad: [2.6, 1.2, 1.2] })),
  tally: XS.map((cx) => ({ x: cx + 8.6, y: 52, z: 14.4, w: 3.7, h: 5.6, gap: 0.5, count: 3, size: "s", housing: false })),
};
export const STAMP = { x: 0, y: -68, base: CAB_H };
export const SPINDLE = { x: 26, y: -66, base: CAB_H };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [CAB.x, CAB.y, CAB_H + 18], [CAB.x + CAB.w, CAB.y, CAB_H + 18]],
  WIDTH,
  HEIGHT,
  { pad: 20, azimuth: 50 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);

const counter = (c, name, value = 0) => digitCounter(P, { ...c, proud: PROUD, name, value });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H }) + rulerStrip(P, { x: -104, y: 63, w: 26, d: 6, r: 1 });
}

function tracks() {
  const out = [];
  XS.forEach((cx, i) => {
    const bed = { x: cx - 7, y: CAB_FRONT, w: 14, d: BRANCH_Y - CAB_FRONT, r: 1 };
    out.push(`<g data-route="${i}">`);
    out.push(S(k.slabOf(bed, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
    out.push(L([cx - LANE, cx + LANE].map((x) => k.lineOnTop([x, CAB_FRONT], [x, BRANCH_Y], 0.6, P)).join(""), { tone: "faint" }));
    out.push(`</g>`);
  });
  return out.join("");
}

// The register: a long cabinet facing the branches, one mouth per track at its foot.
function register() {
  const out = [];
  out.push(S(k.slabOf(CAB, 0, CAB_H, P, 4, 0.6), { tone: "mid", inner: L(XS.map((cx) => k.faceRectY(P, cx - 6, cx + 6, CAB_FRONT, 0.6, 3.6)).join(""), { tone: "lo" }) }));
  out.push(`<g data-unit="main">${counter(COUNTERS.main, "main", 0)}</g>`);
  COUNTERS.slot.forEach((c, i) => out.push(`<g data-unit="slot${i}" style="display:none">${counter(c, "slot" + i, 0)}</g>`));
  out.push(`<g data-unit="cas" style="display:none">${stamp()}${spindle()}</g>`);
  return out.join("");
}

function stamp() {
  const { x, y, base } = STAMP;
  const head = S(k.slabOf({ x: x - 5, y: y - 5, w: 10, d: 10, r: 1 }, base + 6, 3, P, 2, 0.3), { tone: "hi", crease: "lo" })
    + S(k.cylinder(x, y, 1.4, base + 9, 4, P, 16), { tone: "mid", crease: "none" })
    + S(k.cylinder(x, y, 3, base + 13, 1.8, P, 18), { tone: "hi" });
  return S(k.slabOf({ x: x - 7, y: y - 7, w: 14, d: 14, r: 1.2 }, base, 1.6, P, 3, 0.4), { tone: "hi", crease: "lo" })
    + S(k.cylinder(x - 5, y - 5, 1.1, base + 1.6, 14, P, 14), { tone: "mid", crease: "none" })
    + S(k.slabOf({ x: x - 6, y: y - 6.2, w: 8, d: 2.4, r: 0.6 }, base + 13.5, 1.4, P, 2), { tone: "mid", crease: "none" })
    + `<g data-stamp>${head}</g>`;
}

function spindle() {
  const { x, y, base } = SPINDLE;
  const out = [S(k.cylinder(x, y, 4.2, base, 1.4, P, 20), { tone: "hi", crease: "lo" })];
  for (let s = 0; s < SLIPS; s++) out.push(`<g data-slip="${s}" style="display:none">${S(k.cylinder(x, y, 3.2, base + 1.6 + s * 1.15, 0.9, P, 18), { tone: "hi", crease: "lo" })}</g>`);
  out.push(S(k.cylinder(x, y, 0.45, base + 1.4, 17, P, 10), { tone: "mid", crease: "none" }));
  return out.join("");
}

// A boom barrier beside each track; only the far branch's is shown. Up and down are drawn separately.
function barrier(i) {
  const px = XS[i] - 12;
  const out = [`<g data-barrier="${i}" style="display:none">`];
  out.push(S(k.slabOf({ x: px - 2.5, y: BARRIER_Y - 2.5, w: 5, d: 5, r: 1 }, 0, 2, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(px, BARRIER_Y, 1.3, 2, 7, P, 14), { tone: "mid", crease: "none" }));
  out.push(`<g data-arm="up">${S(k.slabOf({ x: px - 0.8, y: BARRIER_Y - 0.8, w: 1.6, d: 1.6, r: 0.4 }, 9, 15, P, 2), { tone: "mid", crease: "none" })}</g>`);
  out.push(`<g data-arm="down" style="display:none">${S(k.slabOf({ x: px - 0.8, y: BARRIER_Y - 0.9, w: 22, d: 1.8, r: 0.5 }, 7.4, 1.6, P, 2), { tone: "hi", lit: true })}</g>`);
  out.push(`</g>`);
  return out.join("");
}

function branch(i) {
  const cx = XS[i];
  const desk = { x: cx - 22, y: BRANCH_Y, w: 44, d: DESK_D, r: 2 };
  const out = [`<g data-branch="${i}">`];
  out.push(S(k.slabOf(k.insetPlan(desk, 1.5), 0, 2, P, 3), { tone: "lo" }));
  out.push(S(k.slabOf(desk, 2, DESK_H - 2, P, 3, 0.5), { tone: "mid" }));
  // The hand tally clicker (behind the display, so drawn first): body, wheels on its face, plunger on top.
  const t = COUNTERS.tally[i];
  const body = { x: cx + 7, y: 42, w: 14.4, d: 10, r: 2.4 };
  out.push(S(k.slabOf(body, DESK_H, 10, P, 4, 0.8), { tone: "hi", crease: "lo" }));
  out.push(counter(t, "tally" + i, 0));
  out.push(S(k.cylinder(body.x + body.w / 2, body.y + body.d / 2, 1.2, DESK_H + 10, 2.6, P, 14), { tone: "mid", crease: "none" }));
  out.push(`<g data-plunger="${i}">${S(k.cylinder(body.x + body.w / 2, body.y + body.d / 2, 2.6, DESK_H + 12.6, 1.5, P, 18), { tone: "hi", crease: "lo" })}</g>`);
  out.push(counter(COUNTERS.view[i], "view" + i, 0));
  out.push(D([at([desk.x + 3, desk.y + desk.d - 3, DESK_H]), at([desk.x + 3, desk.y + 3, DESK_H])], { size: 0.4, tone: "lo" }));
  out.push(`</g>`);
  return out.join("");
}

export function puckSvg() {
  return S(k.cylinder(0, 0, PUCK.r, PUCK.z, PUCK.h, P, 18), { tone: "hi", crease: "lo", lit: true });
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "Three branch offices on a base plate send couriers along tracks to a central register cabinet. Each branch desk has a hand tally clicker counting the adds it took and a counter display showing the total it last read. The register shows either one big shared counter, guarded by a stamp and a spindle of rejected slips for compare-and-swap, or one slot counter per branch. A boom barrier can cut the far branch's track.",
    body: [
      plate(),
      tracks(),
      register(),
      XS.map((_, i) => barrier(i)).join(""),
      `<g data-couriers></g>`,
      XS.map((_, i) => branch(i)).join(""),
    ],
  });
}

export const GEOMETRY = { XS, REG_Y, BRANCH_Y, BARRIER_Y, LANE, PUCK, COUNTERS, SLIPS };

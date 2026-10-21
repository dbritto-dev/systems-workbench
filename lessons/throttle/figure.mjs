// A metronome gate on a ball track. Event balls leave the hopper and roll toward a gate; a metronome
// beside the gate swings once per interval and holds the gate shut while it swings. A ball that reaches a
// shut gate either waits on the flap in front of it (trailing: only the newest waits, the one it replaces
// drops) or falls through the flap into the discard bin. Balls that pass reach the handler press.
// In front, a position rail: the user (a figure) and what the screen shows (a frame) — the gap is staleness.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate } from "../../workbench/parts.mjs";
import { sphereOf } from "../../workbench/vendor-anatomy/kit/lathe.mjs";
import { digitPath, counterCells, digitsOf } from "./digits.js";

export const WIDTH = 700;
export const HEIGHT = 380;

const PLATE = { x: -128, y: -76, w: 256, d: 116, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

export const CY = -30;              // track centre line
export const TRACK = { x0: -96, x1: 53, z0: 13, z1: 16, half: 5.6, rail: 2.2 };
export const BALL_R = 2.9;
export const BALL_Z = TRACK.z1 + BALL_R;
export const FEED_X = -92;          // where a ball leaves the hopper
export const LEDGE_X = -9;          // the flap in front of the gate
export const GATE_X = 0;
export const PRESS_X = 70;          // under the ram
export const QUEUE_GAP = 6.6;       // spacing of waiting balls in queue mode

const FEEDER = { x: -122, y: CY - 13, w: 26, d: 26, r: 2 };
const FEEDER_H = 30;
export const BIN = { x: -36, y: CY - 9, w: 32, d: 28, r: 1.5, h: 7 };
const BED = { x: 52, y: CY - 13, w: 36, d: 26, r: 2 };
const BED_H = TRACK.z1;
export const RAM = { x: PRESS_X - 6.5, y: CY - 6.5, w: 13, d: 13, up: 36, down: BALL_Z + BALL_R - 0.2, h: 8 };
export const TRAY = { x: 54, y: CY + 14, w: 32, d: 16, r: 1.2, h: 5 };
export const METRO = { x: -5, y: CY - 36, w: 22, d: 13, h: 44 };
export const PIVOT = [METRO.x + METRO.w / 2, METRO.y + METRO.d + 0.6, 22];
export const ARM = { len: 33, swing: 0.55, w: 1.8, weight: 0.66 };
export const BLADE = { closed: TRACK.z1 + 0.4, open: TRACK.z1 + 9.4, h: 8.6 };
export const GAUGE = { cx: 104, cy: CY + 22, r: 8, top: 9, from: -2.3, to: 2.3, max: 120 };
export const RAIL = { x0: -108, x1: 108, y: 21, d: 10, h: 2 };
export const LANE_SCREEN = RAIL.y + 3, LANE_USER = RAIL.y + 7;
export const VALUE_MAX = 1000;
export const railX = (v) => RAIL.x0 + 8 + (Math.max(0, Math.min(VALUE_MAX, v)) / VALUE_MAX) * (RAIL.x1 - RAIL.x0 - 16);

// Ball slots in the bin (the part in front of the track) and in the tray.
const heap = (x0, yFront, cols, n, layers = true) => {
  const out = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < cols; c++) out.push([x0 + c * 5.1, yFront - r * 5.2, 1 + BALL_R]);
  if (layers) for (let c = 0; c < cols - 1; c++) out.push([x0 + 2.55 + c * 5.1, yFront - 2.6, 1 + BALL_R + 4.4]);
  // Fill order: back row, front row, then the heap on top — so a few balls already read as a pile.
  return out.slice(cols, 2 * cols).concat(out.slice(0, cols), out.slice(2 * cols)).slice(0, n);
};
export const BIN_SLOTS = heap(BIN.x + 4.4, BIN.y + BIN.d - 4.2, 6, 17);
export const TRAY_SLOTS = heap(TRAY.x + 4.4, TRAY.y + TRAY.d - 4.2, 5, 10, false);

// Counters (wheels printed on a front face, y constant).
export const COUNTERS = {
  events: { x: FEEDER.x + 3.2, y: FEEDER.y + FEEDER.d + 0.9, z: 7, w: 4.4, h: 6.6, gap: 0.6, count: 4 },
  dropped: { x: BIN.x + 8.6, y: BIN.y + BIN.d + 0.9, z: 1.5, w: 3.4, h: 4.4, gap: 0.5, count: 4 },
  handled: { x: BED.x + 5, y: BED.y + BED.d + 0.9, z: 4.6, w: 4.4, h: 6.6, gap: 0.6, count: 4 },
};

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [METRO.x, METRO.y, PIVOT[2] + ARM.len + 6], [BED.x + BED.w, BED.y, 60], [FEEDER.x, FEEDER.y, FEEDER_H + 4]],
  WIDTH, HEIGHT, { pad: 18, azimuth: 60 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const slab = (plan, z, h, steps = 3, bevel = 0) => k.slabOf(plan, z, h, P, steps, bevel);
const flat = (d) => ({ fill: d, outline: d, crease: "", top: "", shades: [] });
const text = (x, y, z, value, { size = 3, tone = "lo", anchor = "start" } = {}) =>
  k.faceTextSvg(k.sideMatrix([x, y], z, P, "left"), value, { size, tone, anchor });
const topText = (x, y, z, value, { size = 3, tone = "lo", anchor = "middle" } = {}) =>
  k.faceTextSvg(k.topMatrix([x, y], z, P, "x"), value, { size, tone, anchor });

function counter(c, name, value = 0) {
  const out = [];
  const w = c.count * c.w + (c.count - 1) * c.gap + 2.4;
  out.push(S(slab({ x: c.x - 1.2, y: c.y - 0.9, w, d: 0.9, r: 0.4 }, c.z - 1.2, c.h + 2.4, 2), { tone: "mid", crease: "lo" }));
  const digits = digitsOf(value, c.count);
  counterCells(c).forEach((cell, j) => {
    out.push(`<path class="cw" d="${k.faceRectY(P, cell.x, cell.x + cell.w, cell.y, cell.z, cell.z + cell.h)}"/>`);
    out.push(`<path class="dg" data-digit="${name}-${j}" d="${digitPath(k.iso, P, cell, digits[j])}"/>`);
  });
  return out.join("");
}

export function ballSvg(lit = false) {
  return S(sphereOf([0, 0, 0], BALL_R, P, { steps: 28 }), { tone: "hi", crease: "lo", lit });
}

// ---------- parts ----------
function feeder() {
  const out = [S(slab(FEEDER, 0, FEEDER_H, 4, 0.6), { tone: "mid" })];
  // A hopper on top, heaped with event balls.
  const lip = { x: FEEDER.x + 2, y: FEEDER.y + 2, w: FEEDER.w - 4, d: FEEDER.d - 4, r: 2 };
  out.push(S(slab(lip, FEEDER_H, 3, 4), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(lip, 1.4), FEEDER_H + 3, P), { tone: "lo" }));
  for (const [x, y] of [[-114, CY - 4], [-108, CY - 5], [-110, CY + 1], [-104, CY]]) out.push(S(sphereOf([x, y, FEEDER_H + 3 + BALL_R * 0.4], BALL_R, P, { steps: 24 }), { tone: "hi", crease: "lo" }));
  // The mouth where balls leave onto the track (right face, x constant).
  const fx = FEEDER.x + FEEDER.w;
  out.push(L(k.faceRectX(P, fx, CY - 4.4, CY + 4.4, TRACK.z1, TRACK.z1 + 7.2), { tone: "mid" }));
  out.push(counter(COUNTERS.events, "events"));
  out.push(text(FEEDER.x + 3.2, FEEDER.y + FEEDER.d, 17.4, "EVENTS", { size: 3.1 }));
  return out.join("");
}

function metronome() {
  const out = [];
  const m = METRO;
  out.push(S(slab({ x: m.x - 2, y: m.y - 2, w: m.w + 4, d: m.d + 4, r: 1.5 }, 0, 4, 3, 0.4), { tone: "mid" }));
  out.push(S(slab({ x: m.x, y: m.y, w: m.w, d: m.d, r: 1 }, 4, m.h - 4, 3, 0.4), { tone: "hi" }));
  out.push(S(slab({ x: m.x + 3, y: m.y + 2, w: m.w - 6, d: m.d - 4, r: 1 }, m.h, 3, 3), { tone: "mid", crease: "none" }));
  // A scale arc on the front face behind the arm, and the pivot boss.
  const [px, py, pz] = PIVOT;
  const arc = Array.from({ length: 21 }, (_, i) => { const a = -ARM.swing + (2 * ARM.swing * i) / 20; return at([px + Math.sin(a) * (ARM.len - 3), py - 0.5, pz + Math.cos(a) * (ARM.len - 3)]); });
  out.push(L(k.pathOf(arc), { tone: "faint" }));
  for (const a of [-ARM.swing, 0, ARM.swing]) out.push(L(k.segment([px + Math.sin(a) * (ARM.len - 3), py - 0.5, pz + Math.cos(a) * (ARM.len - 3)], [px + Math.sin(a) * (ARM.len - 6), py - 0.5, pz + Math.cos(a) * (ARM.len - 6)], P), { tone: "lo" }));
  // The link rod from the metronome to the gate's crossbar.
  out.push(S(slab({ x: GATE_X - 0.8, y: m.y + m.d, w: 1.6, d: CY - 11 - (m.y + m.d), r: 0.3 }, TRACK.z1 + 2.4, 1.6, 2), { tone: "mid", crease: "none" }));
  return out.join("");
}

// The swinging arm (live: rebuilt every frame from its angle).
export function armPaths(a) {
  const [px, py, pz] = PIVOT;
  const u = [Math.sin(a), 0, Math.cos(a)], n = [Math.cos(a), 0, -Math.sin(a)];
  const pt = (s, w) => at([px + u[0] * s + n[0] * w, py, pz + u[2] * s + n[2] * w]);
  const rod = k.pathOf([pt(-1, -ARM.w / 2), pt(ARM.len, -ARM.w / 2), pt(ARM.len, ARM.w / 2), pt(-1, ARM.w / 2)], true);
  const s0 = ARM.len * ARM.weight, wt = k.pathOf([pt(s0 - 3.4, -3.6), pt(s0 + 3.4, -3.6), pt(s0 + 3.4, 3.6), pt(s0 - 3.4, 3.6)], true);
  return { rod, wt };
}
function arm() {
  const { rod, wt } = armPaths(0);
  const part = (name, d, tone) => `<g class="iso-solid"><path class="iso-fill" data-arm-${name}-fill d="${d}"/><path class="iso-line iso-edge" data-tone="${tone}" data-arm-${name} d="${d}"/></g>`;
  return `<g data-arm>${part("rod", rod, "mid")}${part("wt", wt, "hi")}</g>` + S(sphereOf(PIVOT, 1.5, P, { steps: 20 }), { tone: "hi", crease: "lo" });
}

function bin() {
  const b = BIN, out = [];
  out.push(S(slab(b, 0, 1, 3), { tone: "lo", crease: "none" }));
  // Back and side walls first, then the balls (live), then the front wall.
  out.push(S(slab({ x: b.x, y: b.y, w: b.w, d: 1.2, r: 0.3 }, 0, b.h, 2), { tone: "mid" }));
  out.push(S(slab({ x: b.x, y: b.y, w: 1.2, d: b.d, r: 0.3 }, 0, b.h, 2), { tone: "mid" }));
  out.push(S(slab({ x: b.x + b.w - 1.2, y: b.y, w: 1.2, d: b.d, r: 0.3 }, 0, b.h, 2), { tone: "mid" }));
  return out.join("");
}
function binFront() {
  const b = BIN;
  return S(slab({ x: b.x, y: b.y + b.d - 1.2, w: b.w, d: 1.2, r: 0.3 }, 0, b.h, 2), { tone: "hi" })
    + counter(COUNTERS.dropped, "dropped")
    + topText(b.x + b.w / 2, b.y + b.d + 5.4, 0, "DROPPED", { size: 2.8, tone: "lo" });
}

function track() {
  const t = TRACK, out = [];
  for (const x of [-84, -52, 22, 44]) for (const y of [CY - 3.4, CY + 3.4]) out.push(S(k.cylinder(x, y, 1.5, 0, t.z0, P, 14), { tone: "mid", crease: "none" }));
  out.push(S(slab({ x: t.x0, y: CY - t.half, w: t.x1 - t.x0, d: t.half * 2, r: 0.6 }, t.z0, t.z1 - t.z0, 2), { tone: "mid" }));
  // The flap in front of the gate: a hinged square cut into the track.
  out.push(L(k.planOutline({ x: LEDGE_X - 4.2, y: CY - 3.8, w: 8.4, d: 7.6, r: 0.4 }, t.z1, P, true), { tone: "mid" }));
  out.push(D([at([LEDGE_X - 4.2, CY - 2.4, t.z1]), at([LEDGE_X - 4.2, CY + 2.4, t.z1])], { size: 0.5, tone: "mid" }));
  // Direction chevrons on the track floor.
  for (const x of [-72, -48, -26, 18, 38]) out.push(L(k.onTop([[x - 1.6, CY - 2.2], [x + 1.6, CY], [x - 1.6, CY + 2.2]], t.z1, P), { tone: "faint" }));
  return out.join("");
}
// Side rails: the back one before the balls, the front one after.
const rail = (y, x0 = TRACK.x0, x1 = TRACK.x1) => S(slab({ x: x0, y, w: x1 - x0, d: 1.1, r: 0.3 }, TRACK.z1, TRACK.rail, 2), { tone: "hi", crease: "none" });

// The gate: a boom barrier. Down, the boom lies across the track at ball height; up, it stands upright.
const BOOM = { y0: CY - 9, y1: CY + 7.4, z: TRACK.z1 + 2.2, t: 3.4, post: CY + 9.4 };
function gateBack() {
  // The rest post on the far side, which the down boom lies on, and the link rod's post.
  return S(slab({ x: GATE_X - 1.4, y: CY - 10.6, w: 2.8, d: 2.4, r: 0.5 }, 0, BOOM.z, 2), { tone: "mid" })
    + S(slab({ x: GATE_X - 1.8, y: CY - 11, w: 3.6, d: 3.2, r: 0.5 }, BOOM.z, 1, 2), { tone: "hi", crease: "none" });
}
function gateFront() {
  const out = [];
  const stripes = (pts) => L(pts.map(([a, b]) => k.segment(a, b, P)).join(""), { tone: "lo" });
  // Down: across the track.
  const down = S(slab({ x: GATE_X - 1.6, y: BOOM.y0, w: 3.2, d: BOOM.y1 - BOOM.y0, r: 0.4 }, BOOM.z, BOOM.t, 2), { tone: "hi", crease: "lo" })
    + stripes([3, 7, 11, 15].map((d) => [[GATE_X + 1.6, BOOM.y1 - d, BOOM.z], [GATE_X + 1.6, BOOM.y1 - d - 2, BOOM.z + BOOM.t]]));
  // Up: standing on the pivot.
  const up = S(slab({ x: GATE_X - 1.6, y: BOOM.post - 1.6, w: 3.2, d: 3.2, r: 0.4 }, BOOM.z, 17, 2), { tone: "hi", crease: "lo" })
    + stripes([4, 9, 14].map((d) => [[GATE_X + 1.6, BOOM.post - 1.6, BOOM.z + d], [GATE_X + 1.6, BOOM.post + 1.6, BOOM.z + d + 1.8]]));
  out.push(`<g data-blade-down>${down}</g>`);
  out.push(S(slab({ x: GATE_X - 2, y: BOOM.post - 2, w: 4, d: 4, r: 0.8 }, 0, BOOM.z, 3, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(GATE_X, BOOM.post, 1.6, BOOM.z, 1.2, P, 16), { tone: "hi", crease: "none" }));
  out.push(`<g data-blade-up style="display:none">${up}</g>`);
  return out.join("");
}

function pressBack() {
  const out = [S(slab(BED, 0, BED_H, 4, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline({ x: PRESS_X - 6, y: CY - 5.6, w: 12, d: 11.2, r: 1 }, BED_H, P, true), { tone: "lo" }));
  for (const x of [BED.x + 3, BED.x + BED.w - 7]) out.push(S(slab({ x, y: BED.y + 1, w: 4, d: 4, r: 0.6 }, BED_H, 38, 2), { tone: "hi" }));
  out.push(`<g data-rod>${S(k.cylinder(PRESS_X, CY, 1.5, RAM.up + RAM.h, 16, P, 14), { tone: "mid", crease: "none" })}</g>`);
  out.push(S(k.cylinder(PRESS_X, CY, 2.8, 48, 6, P, 18), { tone: "hi" }));
  out.push(S(slab({ x: BED.x + 1, y: BED.y + 1, w: BED.w - 2, d: 17, r: 1 }, BED_H + 38, 4.4, 3, 0.4), { tone: "hi" }));
  out.push(counter(COUNTERS.handled, "handled"));
  out.push(text(BED.x + 5, BED.y + BED.d, 12.8, "HANDLED", { size: 2.6 }));
  return out.join("");
}
function ram() {
  return `<g data-ram>${S(slab({ x: RAM.x, y: RAM.y, w: RAM.w, d: RAM.d, r: 1 }, RAM.up, RAM.h, 3, 0.4), { tone: "hi", crease: "lo" })}</g>`;
}

function tray() {
  const t = TRAY, out = [S(slab(t, 0, 1, 3), { tone: "lo", crease: "none" })];
  out.push(S(slab({ x: t.x, y: t.y, w: t.w, d: 1, r: 0.3 }, 0, t.h, 2), { tone: "mid" }));
  out.push(S(slab({ x: t.x, y: t.y, w: 1, d: t.d, r: 0.3 }, 0, t.h, 2), { tone: "mid" }));
  out.push(S(slab({ x: t.x + t.w - 1, y: t.y, w: 1, d: t.d, r: 0.3 }, 0, t.h, 2), { tone: "mid" }));
  return out.join("");
}
const trayFront = () => S(slab({ x: TRAY.x, y: TRAY.y + TRAY.d - 1, w: TRAY.w, d: 1, r: 0.3 }, 0, TRAY.h, 2), { tone: "hi" })
  + topText(TRAY.x + TRAY.w / 2, TRAY.y + TRAY.d + 4.6, 0, "DONE", { size: 2.8, tone: "lo" });

// Calls-per-second gauge: a dial on a pedestal, needle live.
function gauge() {
  const g = GAUGE, out = [];
  out.push(S(k.cylinder(g.cx, g.cy, g.r + 2.4, 0, g.top, P, 32, 0.6), { tone: "mid" }));
  out.push(L(k.ring(g.cx, g.cy, g.r, g.top, P, 36), { tone: "lo" }));
  const tick = (f, len) => { const a = g.from + (g.to - g.from) * f; return k.segment([g.cx + Math.sin(a) * g.r, g.cy - Math.cos(a) * g.r, g.top], [g.cx + Math.sin(a) * (g.r - len), g.cy - Math.cos(a) * (g.r - len), g.top], P); };
  out.push(L(Array.from({ length: 13 }, (_, i) => tick(i / 12, i % 3 === 0 ? 2.4 : 1.2)).join(""), { tone: "mid" }));
  out.push(topText(g.cx, g.cy + 4.2, g.top, "CALLS/S", { size: 1.9, tone: "lo" }));
  out.push(`<path class="iso-line" data-tone="lit" data-needle style="stroke-width:1.6" d="${needlePath(0)}"/>`);
  out.push(D([at([g.cx, g.cy, g.top])], { size: 0.9, tone: "hi" }));
  return out.join("");
}
export function needlePath(rate) {
  const g = GAUGE, f = Math.max(0, Math.min(1, rate / g.max)), a = g.from + (g.to - g.from) * f;
  return k.segment([g.cx, g.cy, g.top], [g.cx + Math.sin(a) * (g.r - 1.2), g.cy - Math.cos(a) * (g.r - 1.2), g.top], P);
}

// The position rail: where the user is (a figure) and what the screen shows (a frame), and the gap between.
function positionRail() {
  const r = RAIL, out = [];
  out.push(S(slab({ x: r.x0, y: r.y, w: r.x1 - r.x0, d: r.d, r: 1 }, 0, r.h, 3), { tone: "mid" }));
  const t = k.topTicks(r.x0 + 8, r.x1 - 8, 5, 4, r.y + 0.8, r.h, [1.1, 2], P);
  out.push(L(t.minor, { tone: "faint" }), L(t.major, { tone: "lo" }));
  out.push(L(k.lineOnTop([r.x0 + 6, LANE_SCREEN], [r.x1 - 6, LANE_SCREEN], r.h, P), { tone: "faint" }));
  out.push(`<path class="iso-line" data-tone="lit" data-gap data-dashed d=""/>`);
  return out.join("");
}
export function gapPath(x0, x1) {
  if (Math.abs(x1 - x0) < 0.5) return "";
  return k.lineOnTop([x0, LANE_USER], [x1, LANE_USER], RAIL.h, P);
}
export function userSvg() {
  const y = LANE_USER, out = [];
  out.push(S(k.cylinder(0, y, 3, RAIL.h, 1, P, 18), { tone: "mid" }));
  out.push(S(k.cylinder(0, y, 2.4, RAIL.h + 1, 9, P, 16, 0.5), { tone: "hi", crease: "lo" }));
  out.push(S(sphereOf([0, y, RAIL.h + 12.8], 2.6, P, { steps: 24 }), { tone: "hi", crease: "lo" }));
  return out.join("");
}
export function screenSvg() {
  const y = LANE_SCREEN, out = [];
  out.push(S(slab({ x: -6.5, y: y - 1.8, w: 13, d: 3.6, r: 0.8 }, RAIL.h, 1.4, 3), { tone: "mid" }));
  out.push(S(slab({ x: -6.4, y: y - 0.7, w: 12.8, d: 1.4, r: 0.6 }, RAIL.h + 1.4, 12, 3), { tone: "hi", lit: true, inner: L(k.faceRectY(P, -5, 5, y + 0.7, RAIL.h + 3, RAIL.h + 11.8), { tone: "lit" }) }));
  return out.join("");
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A ball track on a base plate. Event balls leave a hopper on the left and roll toward a gate. A metronome behind the gate swings once per interval and holds the gate blade down while it swings. In front of the gate, a hinged flap holds the newest waiting ball; balls that are replaced or not allowed to wait fall through it into a discard bin under the track. Balls that pass the gate roll on to a press, the handler, and then into a tray. Counters show events, dropped and handled; a dial shows handler calls per second. In front, a rail shows where the user is (a figure) and what the screen shows (a lit frame); the dashed gap between them is how far behind the screen is.",
    body: [
      basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H }),
      metronome(),
      `<g data-arm-wrap>${arm()}</g>`,
      feeder(),
      bin(),
      `<g data-bin-balls></g>`,
      binFront(),
      track(),
      rail(CY - TRACK.half),
      gateBack(),
      `<g data-balls-back></g>`,
      rail(CY + TRACK.half - 1.1, TRACK.x0, GATE_X - 1.6),
      gateFront(),
      pressBack(),
      `<g data-balls-front></g>`,
      rail(CY + TRACK.half - 1.1, GATE_X + 1.6, TRACK.x1),
      ram(),
      tray(),
      `<g data-tray-balls></g>`,
      trayFront(),
      gauge(),
      positionRail(),
      `<g data-screen>${screenSvg()}</g>`,
      `<g data-user>${userSvg()}</g>`,
    ],
  });
}

export const GEOMETRY = { CY, TRACK, BALL_R, BALL_Z, FEED_X, LEDGE_X, GATE_X, PRESS_X, QUEUE_GAP, BIN, RAM, TRAY, BLADE, BIN_SLOTS, TRAY_SLOTS, COUNTERS, PIVOT, ARM, RAIL, LANE_USER, LANE_SCREEN, VALUE_MAX };

// A telephone switchboard calling a supplier exchange. Six operator positions (the worker pool) sit at
// the keyshelf; each has a cord that plugs into a local jack (work done in-house) or a trunk jack
// (a call to the supplier). The trunk runs through a knife-switch circuit breaker to the supplier's
// exchange cabinet. Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";

export const WIDTH = 700;
export const HEIGHT = 440;

const PLATE = { x: -168, y: -94, w: 282, d: 142, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// Switchboard: an upright jack panel at the back, a keyshelf in front.
const PANEL = { x: -152, y: -42, w: 182, d: 12, r: 2 };
const PANEL_TOP = 72;
export const FACE = PANEL.y + PANEL.d; // -30, the jack face
const SHELF = { x: -154, y: -30, w: 186, d: 40, r: 2 };
export const SHELF_TOP = 14;

export const OPS = Array.from({ length: 6 }, (_, i) => ({ cx: -136 + i * 26.5 }));
export const HOLE_Y = -21;
export const ROWS = { local: 26, trunk: 43 };
export const DIAL = { y: -4, r: 5.2, z: SHELF_TOP + 1.4 };
export const LAMPS = [-142, -133, -124, -115].map((x) => ({ x, z: 61 }));
export const OVERFLOW = { x: -100, z: 61 };
export const SHUTTER = { x0: -148, x1: 12, z0: ROWS.trunk - 5, z1: ROWS.trunk + 5, lift: 10.5 };

// Breaker: a knife switch on its own base, with a small dial block in front.
const BREAKER = { x: 40, y: -36, w: 48, d: 28, r: 2.5 };
const BREAKER_H = 5;
export const BLADE = { hinge: [48, -21, 10.5], length: 32, half: 1.6, thick: 0.8, angles: { closed: 0, half: 32, open: 72 } };
const DIALS = { x: 40, y: -5, w: 48, d: 14, r: 2 };
export const DIAL_TOP = 7.6;
export const FAIL_DIAL = { c: [53, 2], r: 5.4 };
export const COOL_DIAL = { c: [75, 2], r: 5.4 };

// Supplier exchange cabinet at the back right.
const SUPPLIER = { x: 50, y: -86, w: 50, d: 34, r: 3 };
const SUPPLIER_TOP = 62;
export const GAUGE = { x0: 58, x1: 66, y: SUPPLIER.y + SUPPLIER.d, z0: 10, z1: 54, full: 30, cap: 15 };

export const KNOB = { c: [16, -8], r: 4.6, z: SHELF_TOP + 1.6, h: 4 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [PANEL.x, PANEL.y, PANEL_TOP + 3], [PANEL.x + PANEL.w, PANEL.y + PANEL.d, PANEL_TOP + 3], [SUPPLIER.x + SUPPLIER.w, SUPPLIER.y, SUPPLIER_TOP]],
  WIDTH,
  HEIGHT,
  { pad: 24, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
export const faceRectY = (x0, x1, y, z0, z1) => k.faceRectY(P, x0, x1, y, z0, z1);
// A circle on a face of constant y.
const faceCircle = (x, y, z, r, steps = 20) => k.sideRing([x, y, z], r, "y", P, steps);

export function needle([x, y], r, z, turn, tail = 1.6) {
  const a = turn * Math.PI * 2;
  return k.lineOnTop([x - Math.sin(a) * tail, y + Math.cos(a) * tail], [x + Math.sin(a) * (r - 1.6), y - Math.cos(a) * (r - 1.6)], z + 0.2, P);
}

// ---------- a box with any orientation (the knife-switch blade), painted with the kit's classes ----------
// corners: 8 world points indexed by bits (bit0 along, bit1 across, bit2 up).
export function boxSvg(corners, Pr, { tone = "hi", lit = false } = {}) {
  const o = depthOf([0, 0, 0], Pr);
  const V = [depthOf([1, 0, 0], Pr) - o, depthOf([0, 1, 0], Pr) - o, depthOf([0, 0, 1], Pr) - o];
  const faces = [[0, 2, 6, 4], [1, 5, 7, 3], [0, 4, 5, 1], [2, 3, 7, 6], [0, 1, 3, 2], [4, 6, 7, 5]];
  const centre = [0, 1, 2].map((a) => corners.reduce((s, p) => s + p[a], 0) / 8);
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const fmt = (pts) => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("") + "Z";
  const flat = corners.map((p) => iso(p, Pr));
  const hull = (() => {
    const pts = [...flat].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const turn = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const lower = [], upper = [];
    for (const p of pts) { while (lower.length > 1 && turn(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
    for (const p of [...pts].reverse()) { while (upper.length > 1 && turn(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  })();
  let shades = "", tops = "", edges = "";
  for (const f of faces) {
    const [a, b, c] = f.map((i) => corners[i]);
    let n = cross(sub(b, a), sub(c, a));
    const len = Math.hypot(...n) || 1; n = n.map((v) => v / len);
    const mid = [0, 1, 2].map((ax) => f.reduce((s, i) => s + corners[i][ax], 0) / 4);
    if (dot(n, sub(mid, centre)) < 0) n = n.map((v) => -v);
    if (dot(n, V) <= 0.02) continue;
    const d = fmt(f.map((i) => flat[i]));
    if (n[2] > 0.55) tops += d;
    else shades += '<path class="iso-shade" data-shade="' + (n[1] > n[0] ? 3 : 1) + '" d="' + d + '"/>';
    edges += d;
  }
  return '<g class="iso-solid"' + (lit ? " data-lit" : "") + '><path class="iso-fill" d="' + fmt(hull) + '"/>' + shades
    + (tops ? '<path class="iso-top" d="' + tops + '"/>' : "") + '<path class="iso-line iso-crease" data-tone="faint" d="' + edges + '"/>'
    + '<path class="iso-line iso-edge" data-tone="' + tone + '" d="' + fmt(hull) + '"/></g>';
}

// The blade and its handle at an angle (degrees) about the hinge pin (the y axis).
export function bladeSvg(angle, B, Pr, lit) {
  const t = (angle * Math.PI) / 180, u = [Math.cos(t), 0, Math.sin(t)], w = [-Math.sin(t), 0, Math.cos(t)];
  const point = (s, y, h) => [B.hinge[0] + u[0] * s + w[0] * h, B.hinge[1] + y, B.hinge[2] + u[2] * s + w[2] * h];
  const box = (s0, s1, y0, y1, h0, h1) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => point(i & 1 ? s1 : s0, i & 2 ? y1 : y0, i & 4 ? h1 : h0));
  return boxSvg(box(-2, B.length, -B.half, B.half, -B.thick, B.thick), Pr, { tone: "hi" })
    + boxSvg(box(B.length - 6, B.length - 2, -B.half - 1, B.half + 1, B.thick, B.thick + 8), Pr, { tone: "hi", lit });
}

// A cord from an operator's shelf hole to a plug, sagging toward the operator.
export function cordPoints(cx, end, bulge = 9) {
  const a = [cx, HOLE_Y, SHELF_TOP], pts = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18, s = Math.sin(Math.PI * t);
    pts.push([a[0] + (end[0] - a[0]) * t, a[1] + (end[1] - a[1]) * t + bulge * s, a[2] + (end[2] - a[2]) * t + 3 * s]);
  }
  return pts;
}
const cordD = (pts) => k.pathOf(k.pointsAt(pts, P));

function plate() {
  const out = [
    basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H }),
    rulerStrip(P, { x: -150, y: 26, w: 170, d: 7, r: 1 }),
    labelPlate(P, { x: 44, y: 16, w: 40, d: 18, r: 1.5 }, [[49, 21, 22], [49, 25.5, 28], [49, 30, 16]]),
  ];
  return out.join("");
}

function supplier() {
  const out = [];
  out.push(S(k.slabOf(k.insetPlan(SUPPLIER, 2.5), 0, 4, P, 4, 0.4), { tone: "lo" }));
  out.push(S(k.slabOf(SUPPLIER, 4, SUPPLIER_TOP - 4, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(SUPPLIER, 33, P, 4), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(SUPPLIER, 4), SUPPLIER_TOP, P), { tone: "lo" }));
  out.push(D(k.corners(SUPPLIER, 4).map(([x, y]) => at([x, y, SUPPLIER_TOP])), { size: 0.45 }));
  const face = SUPPLIER.y + SUPPLIER.d;
  // Selector banks on the face: rows of small jacks, the exchange's own lines.
  const banks = [];
  for (const z of [42, 48]) for (let i = 0; i < 6; i++) banks.push(faceCircle(74 + i * 4, face, z, 1.1, 12));
  out.push(L(faceRectY(71, 97, face, 38.5, 51.5), { tone: "lo" }), L(banks.join(""), { tone: "lo" }));
  const g = GAUGE;
  out.push(L(faceRectY(g.x0 - 1.2, g.x1 + 1.2, g.y, g.z0 - 1.2, g.z1 + 1.2), { tone: "lo" }));
  out.push(L(faceRectY(g.x0, g.x1, g.y, g.z0, g.z1), { tone: "faint" }));
  const capZ = g.z0 + (g.z1 - g.z0) * (g.cap / g.full);
  out.push(L(k.segment([g.x0, g.y, capZ], [g.x1, g.y, capZ], P), { tone: "mid" }));
  out.push(`<path class="gauge-fill" data-gauge d=""/>`);
  // Line terminal where the trunk arrives.
  out.push(S(k.slabOf({ x: 84, y: face, w: 10, d: 2, r: 0.5 }, 4, 6, P, 2), { tone: "mid", crease: "none" }));
  out.push(D([at([86.5, face + 2, 10]), at([91.5, face + 2, 10])], { size: 0.4, tone: "lo" }));
  return out.join("");
}

function panel() {
  const out = [];
  out.push(S(k.slabOf(k.insetPlan(PANEL, -1.5), 0, 3, P, 3, 0.4), { tone: "lo" }));
  out.push(S(k.slabOf(PANEL, 3, PANEL_TOP - 3, P, 3, 0.5), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(PANEL, -1.8), PANEL_TOP, 3, P, 3, 0.6), { tone: "mid" }));
  out.push(D(k.corners(PANEL, 4).map(([x, y]) => at([x, y, PANEL_TOP + 3])), { size: 0.4 }));
  // Intake lamps, the overflow lamp, the local row and the trunk row, each on its own plate.
  out.push(L(faceRectY(-147, -110, FACE, 56.5, 65.5) + faceRectY(-105, -95, FACE, 56.5, 65.5), { tone: "lo" }));
  out.push(L([...LAMPS, OVERFLOW].map((l) => faceCircle(l.x, FACE, l.z, 3, 24)).join(""), { tone: "mid" }));
  LAMPS.forEach((l, i) => out.push(`<path class="lamp" data-lamp="${i}" d="${faceCircle(l.x, FACE, l.z, 2.1, 20)}"/>`));
  out.push(`<path class="lamp" data-overflow d="${faceCircle(OVERFLOW.x, FACE, OVERFLOW.z, 2.1, 20)}"/>`);
  out.push(L(faceRectY(-148, 12, FACE, ROWS.local - 5, ROWS.local + 5), { tone: "lo" }));
  out.push(L(faceRectY(SHUTTER.x0, SHUTTER.x1, FACE, SHUTTER.z0, SHUTTER.z1), { tone: "lo" }));
  const jacks = [];
  for (const o of OPS) for (const z of [ROWS.local, ROWS.trunk]) jacks.push(faceCircle(o.cx, FACE, z, 2.2, 18));
  out.push(L(jacks.join(""), { tone: "mid" }));
  out.push(`<path class="jack-hole" d="${OPS.map((o) => faceCircle(o.cx, FACE, ROWS.local, 1.1, 12) + faceCircle(o.cx, FACE, ROWS.trunk, 1.1, 12)).join("")}"/>`);
  // Panel name plate: the one engraved label.
  out.push(k.faceTextSvg(k.sideMatrix([-26, FACE], 66, P, "left"), "TRUNK", { size: 3, tone: "lo", anchor: "middle" }));
  return out.join("");
}

// The trunk shutter: built lowered over the trunk row; live code lifts it into its housing.
function shutter() {
  return S(k.slabOf({ x: SHUTTER.x0, y: FACE, w: SHUTTER.x1 - SHUTTER.x0, d: 1.4, r: 0.4 }, SHUTTER.z0, SHUTTER.z1 - SHUTTER.z0, P, 2, 0.3), { tone: "mid", inner: L(k.sideSeam({ x: SHUTTER.x0, y: FACE, w: SHUTTER.x1 - SHUTTER.x0, d: 1.4, r: 0.4 }, (SHUTTER.z0 + SHUTTER.z1) / 2, P, 2), { tone: "faint" }) });
}
function housing() {
  return S(k.slabOf({ x: SHUTTER.x0 - 2, y: FACE, w: SHUTTER.x1 - SHUTTER.x0 + 4, d: 3.4, r: 0.8 }, SHUTTER.z1, SHUTTER.lift + 0.5, P, 3, 0.4), { tone: "mid" });
}

function shelf() {
  const out = [];
  out.push(S(k.slabOf(SHELF, 0, SHELF_TOP, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(SHELF, 4, P, 3), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(SHELF, 3), SHELF_TOP, P), { tone: "faint" }));
  const front = SHELF.y + SHELF.d;
  OPS.forEach((o) => {
    out.push(L(faceRectY(o.cx - 8, o.cx + 8, front, 6, 10), { tone: "lo" }));
    out.push(L(k.ring(o.cx, HOLE_Y, 2.6, SHELF_TOP, P, 20), { tone: "mid" }) + L(k.ring(o.cx, HOLE_Y, 1.5, SHELF_TOP, P, 16), { tone: "lo" }));
    // Wait timer: one turn is 8 s on the line.
    out.push(S(k.cylinder(o.cx, DIAL.y, DIAL.r, SHELF_TOP, 1.4, P, 36, 0.3), { tone: "hi", crease: "lo" }));
    const t = k.radialTicks(o.cx, DIAL.y, DIAL.r - 0.9, 8, 2, DIAL.z, [0.7, 1.3], P);
    out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  });
  return out.join("");
}

function knob() {
  const [x, y] = KNOB.c;
  const out = [];
  out.push(S(k.cylinder(x, y, 7.6, SHELF_TOP, 1.6, P, 40, 0.3), { tone: "mid" }));
  const t = k.radialTicks(x, y, 7.1, 12, 4, KNOB.z, [1, 1.9], P, -Math.PI * 0.75, Math.PI * 1.5);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(S(k.cylinder(x, y, KNOB.r, KNOB.z, KNOB.h, P, 32, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, KNOB.r, KNOB.z, KNOB.z + KNOB.h, 30, P), { tone: "lo" }));
  out.push(`<path class="iso-line" data-tone="hi" data-knob d="${knobPointer(0)}" style="stroke-width:1"/>`);
  return out.join("");
}
export function knobPointer(share) {
  const [x, y] = KNOB.c;
  const a = -Math.PI * 0.75 + share * Math.PI * 1.5;
  return k.lineOnTop([x + Math.sin(a) * 1, y - Math.cos(a) * 1], [x + Math.sin(a) * (KNOB.r - 0.7), y - Math.cos(a) * (KNOB.r - 0.7)], KNOB.z + KNOB.h + 0.1, P);
}

// One operator's cord in each of its states; live code shows one at a time.
function operator(o, i) {
  const rest = S(k.cylinder(o.cx, HOLE_Y, 1.25, SHELF_TOP, 5.5, P, 16, 0.2), { tone: "hi", crease: "lo" }) + S(k.cylinder(o.cx, HOLE_Y, 0.7, SHELF_TOP + 5.5, 2, P, 12), { tone: "hi", crease: "none" });
  const plugAt = (z, y0) => S(k.slabOf({ x: o.cx - 1.3, y: y0, w: 2.6, d: 5.5, r: 0.5 }, z - 1.3, 2.6, P, 2, 0.2), { tone: "hi", crease: "lo" });
  const cord = (pts, lit) => lit
    ? `<path class="cord-lit" d="${cordD(pts)}"/>`
    : `<path class="cord-out" d="${cordD(pts)}"/><path class="cord-in" d="${cordD(pts)}"/>`;
  const local = cord(cordPoints(o.cx, [o.cx, FACE + 5.5, ROWS.local]), false) + plugAt(ROWS.local, FACE);
  const trunk = cord(cordPoints(o.cx, [o.cx, FACE + 5.5, ROWS.trunk]), true) + plugAt(ROWS.trunk, FACE);
  const bounce = cord(cordPoints(o.cx, [o.cx, FACE + 9.5, ROWS.trunk - 1]), false) + plugAt(ROWS.trunk - 1, FACE + 4);
  return `<g data-op="${i}" data-state="rest"><g data-v="rest">${rest}</g><g data-v="local">${local}</g><g data-v="trunk">${trunk}</g><g data-v="bounce">${bounce}</g>`
    + `<path class="iso-line" data-tone="hi" data-free="start" data-needle="${i}" d="${needle([o.cx, DIAL.y], DIAL.r, DIAL.z, 0)}" style="stroke-width:.9"/></g>`;
}

function breaker() {
  const out = [];
  out.push(S(k.slabOf(BREAKER, 0, BREAKER_H, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BREAKER, 3), BREAKER_H, P), { tone: "faint" }));
  out.push(D(k.corners(BREAKER, 3).map(([x, y]) => at([x, y, BREAKER_H])), { size: 0.45 }));
  // Insulator pads under the hinge and the jaws.
  out.push(S(k.slabOf({ x: 43, y: -27, w: 10, d: 12, r: 1 }, BREAKER_H, 1.5, P, 2), { tone: "lo" }));
  out.push(S(k.slabOf({ x: 75, y: -27, w: 10, d: 12, r: 1 }, BREAKER_H, 1.5, P, 2), { tone: "lo" }));
  return out.join("");
}
const BACK_PLATES = () => S(k.slabOf({ x: 45, y: -24.2, w: 6, d: 1.4, r: 0.3 }, 6.5, 6.5, P, 2), { tone: "mid" }) + S(k.slabOf({ x: 77, y: -24.2, w: 6, d: 1.4, r: 0.3 }, 6.5, 6.5, P, 2), { tone: "mid" });
const FRONT_PLATES = () => S(k.slabOf({ x: 45, y: -19.2, w: 6, d: 1.4, r: 0.3 }, 6.5, 6.5, P, 2), { tone: "mid" })
  + S(k.slabOf({ x: 77, y: -19.2, w: 6, d: 1.4, r: 0.3 }, 6.5, 6.5, P, 2), { tone: "mid" })
  + D([at([48, -17.8, 10.5])], { size: 0.5, tone: "mid" });

function breakerDials() {
  const out = [];
  out.push(S(k.slabOf(DIALS, 0, 6, P, 3, 0.5), { tone: "mid" }));
  for (const dial of [FAIL_DIAL, COOL_DIAL]) {
    const [x, y] = dial.c;
    out.push(S(k.cylinder(x, y, dial.r, 6, DIAL_TOP - 6, P, 40, 0.4), { tone: "hi", crease: "lo" }));
    const t = k.radialTicks(x, y, dial.r - 1.2, 20, 5, DIAL_TOP, [0.8, 1.6], P, -Math.PI * 0.75, Math.PI * 1.5);
    out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
    out.push(L(k.ring(x, y, 0.9, DIAL_TOP, P, 12), { tone: "mid" }));
  }
  return out.join("");
}

// The trunk cable: panel side → hinge, and jaws → supplier terminal. Flow overlays show calls on the line.
const TRUNK_IN = [[PANEL.x + PANEL.w, -36, 40], [36, -36, 40], [36, -36, 0.6], [36, -21, 0.6], [43, -21, 6]];
const TRUNK_OUT = [[85, -21, 6.5], [92, -21, 0.6], [104, -21, 0.6], [104, -50, 0.6], [92, -50, 0.6], [89, SUPPLIER.y + SUPPLIER.d + 2, 6]];
function cable(points, name) {
  const pts = points.map(at);
  const d = "M" + pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L");
  return k.wireSvg(pts[0], pts[pts.length - 1], { via: pts.slice(1, -1), tone: "lo", size: 0.9 })
    + `<path class="iso-line flow" data-tone="hi" data-flow="" data-${name} d="${d}"/>`;
}

export function buildFigure() {
  const ops = OPS.map((o, i) => ({ o, i })).sort((a, b) => k.depthOf([a.o.cx, 0, 0], P) - k.depthOf([b.o.cx, 0, 0], P));
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A telephone switchboard on a base plate. Six operator positions at the keyshelf each have a cord: plugged into the lower row for work done in-house, or into the upper trunk row to call a supplier's exchange at the back. Lamps at the top show calls waiting. The trunk runs through a knife-switch circuit breaker with a failure dial and a cooldown dial; when it opens, a shutter drops over the trunk jacks. A knob on the shelf sets the timeout.",
    body: [
      plate(),
      supplier(),
      panel(),
      `<g data-shutter>${shutter()}</g>`,
      housing(),
      cable(TRUNK_IN, "trunk-in"),
      breaker(),
      BACK_PLATES(),
      `<g data-blade>${bladeSvg(0, BLADE, P, false)}</g>`,
      FRONT_PLATES(),
      cable(TRUNK_OUT, "trunk-out"),
      breakerDials(),
      `<path class="iso-line" data-tone="lit" data-free="start" data-fail-needle d="${needle(FAIL_DIAL.c, FAIL_DIAL.r, DIAL_TOP, -0.375)}" style="stroke-width:1"/>`,
      `<path class="iso-line" data-tone="lit" data-free="start" data-cool-needle d="${needle(COOL_DIAL.c, COOL_DIAL.r, DIAL_TOP, -0.375)}" style="stroke-width:1"/>`,
      shelf(),
      knob(),
      ops.map(({ o, i }) => operator(o, i)).join(""),
    ],
  });
}

export const GEOMETRY = { OPS, DIAL, BLADE, FAIL_DIAL, COOL_DIAL, DIAL_TOP, GAUGE, KNOB, LAMPS, SHUTTER };

// depthOf and iso are named so boxSvg's source also runs inside the page, where the kit is inlined.
function depthOf(p, Pr) { return k.depthOf(p, Pr); }
function iso(p, Pr) { return k.iso(p, Pr); }

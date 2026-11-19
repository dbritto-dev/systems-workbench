// @ts-nocheck: drawing code in the style of the other lessons.
// Geometry and drawing both the figure (build) and the live code (browser) need: the tilting beam of the weighing
// station, and the line the neuron draws across the decision board. Only iso-kit (no Node modules), so the browser can
// import it.
import { iso, pathOf, extrude, solidSvg } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";

// ---------- the station ----------
// The beam runs front to back (along y) on the board's left; its arm is numbered toward the front, so a rider with a
// positive weight sits in front of the fulcrum and pushes the front end down.
export const BEAM = { x0: -104, x1: -70, y0: -100, y1: 16, h: 2.4 };
export const PIVOT = { y: (BEAM.y0 + BEAM.y1) / 2, z: 30 };
export const UNIT = 11;                      // world units of arm per unit of weight
export const REACH = 5;                      // the arm's ticks run from −5 to +5
export const MAX_TILT = (9 * Math.PI) / 180;
/** The beam's tilt for a sum z: up to 9°, most of it by |z| = 3. */
export const tiltOf = (z) => MAX_TILT * Math.tanh(z / 2.5);
/** Where a rider at weight w sits along the beam (y), clamped just past the arm's end. */
export const armY = (w) => PIVOT.y + Math.max(-REACH - 0.2, Math.min(REACH + 0.2, w)) * UNIT;

/** A point of the beam (in its level pose) turned by the tilt about the pivot. Positive tilt: the front end goes down. */
export function turn([x, y, z], a) {
  const dy = y - PIVOT.y, dz = z - PIVOT.z, c = Math.cos(a), s = Math.sin(a);
  return [x, PIVOT.y + dy * c + dz * s, PIVOT.z - dy * s + dz * c];
}

function hull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (const p of pts.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** The tilted beam's paths: its silhouette, top, side (+x, toward the board), front end (+y), and its ticks. */
export function beamPaths(P, a) {
  const { x0, x1, y0, y1, h } = BEAM, zt = PIVOT.z + h, zb = PIVOT.z;
  const c = (x, y, z) => iso(turn([x, y, z], a), P);
  const T = [c(x0, y0, zt), c(x1, y0, zt), c(x1, y1, zt), c(x0, y1, zt)];
  const B = [c(x0, y0, zb), c(x1, y0, zb), c(x1, y1, zb), c(x0, y1, zb)];
  const ticks = [];
  for (let k = -REACH; k <= REACH; k++) {
    const y = PIVOT.y + k * UNIT, long = k === 0 || k % 5 === 0;
    ticks.push(pathOf([c(x1 - (long ? 5 : 2.6), y, zt), c(x1 - 0.4, y, zt)]));
  }
  const sil = pathOf(hull([...T, ...B]), true);
  return {
    fill: sil,
    top: pathOf(T, true),
    side: pathOf([T[1], T[2], B[2], B[1]], true),
    end: pathOf([T[2], T[3], B[3], B[2]], true),
    crease: pathOf([T[1], T[2], T[3]]),
    edge: sil,
    ticks: ticks.join(""),
  };
}
/** The beam as one solid, with each path tagged so the live code can redraw it. */
export function beamSvg(P, a = 0) {
  const d = beamPaths(P, a);
  return `<g class="iso-solid" data-beam>`
    + `<path class="iso-fill" data-d="fill" d="${d.fill}"/>`
    + `<path class="iso-shade" data-shade="2" data-d="side" d="${d.side}"/>`
    + `<path class="iso-shade" data-shade="0" data-d="end" d="${d.end}"/>`
    + `<path class="iso-top" data-d="top" d="${d.top}"/>`
    + `<path class="iso-line iso-crease" data-tone="lo" data-d="crease" d="${d.crease}"/>`
    + `<path class="iso-line" data-tone="mid" data-d="ticks" d="${d.ticks}"/>`
    + `<path class="iso-line iso-edge" data-tone="hi" data-d="edge" d="${d.edge}"/>`
    + `</g>`;
}
/** Where a rider sits: on lane x, at weight w, on the tilted beam's top. */
export const riderAt = (w, x, a) => turn([x, armY(w), PIVOT.z + BEAM.h], a);
export const LANES = { x1: -98, x2: -87, b: -76 };   // rider lanes across the beam, back to front

// ---------- the board ----------
export const BOARD = { x: -28, y: -98, w: 122, d: 118, r: 3 };
export const BOARD_H = 8;
export const FIELD = { x: BOARD.x + 11, y: BOARD.y + 4, w: 104, d: 104 };     // the unit square the tasks are drawn on
export const BX = (u) => FIELD.x + u * FIELD.w;
export const BY = (v) => FIELD.y + (1 - v) * FIELD.d;                       // x2 grows toward the back

/** Keep the part of a polygon (in board units) where A u + B v + C ≥ 0 (side = 1) or ≤ 0 (side = −1). */
export function clip(poly, A, B, C, side = 1) {
  const f = ([u, v]) => side * (A * u + B * v + C);
  const out = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length], fp = f(p), fq = f(q);
    if (fp >= 0) out.push(p);
    if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
  });
  return out;
}
export const SQUARE = [[0, 0], [1, 0], [1, 1], [0, 1]];
/** The segment of A u + B v + C = level inside the unit square, or null. */
export function chord(A, B, C, level = 0) {
  const pts = [];
  const add = (u, v) => { if (u >= -1e-9 && u <= 1 + 1e-9 && v >= -1e-9 && v <= 1 + 1e-9 && !pts.some((p) => Math.abs(p[0] - u) + Math.abs(p[1] - v) < 1e-7)) pts.push([u, v]); };
  const c = C - level;
  if (Math.abs(B) > 1e-12) { add(0, -c / B); add(1, -(A + c) / B); }
  if (Math.abs(A) > 1e-12) { add(-c / A, 0); add(-(B + c) / A, 1); }
  return pts.length >= 2 ? [pts[0], pts[1]] : null;
}
/** The ruler laid along a chord: a bar 2.4 wide, 2.2 high, on the board's top. */
export function rulerSvg(P, seg) {
  if (!seg) return "";
  const [a, b] = seg.map(([u, v]) => [BX(u), BY(v)]);
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = (-dy / len) * 1.2, ny = (dx / len) * 1.2;
  const ring = [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
  return solidSvg(extrude(ring, BOARD_H, 2.2, P), { tone: "hi", crease: "lo" });
}
/** A path on the board's top through board points. */
export const onBoard = (P, pts, closed = false, z = BOARD_H) => pathOf(pts.map(([u, v]) => iso([BX(u), BY(v), z], P)), closed);

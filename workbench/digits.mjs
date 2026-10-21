// Printed numerals for counter wheels: a small stroke font drawn onto a vertical face.
// Used by parts.mjs (the first frame) and by client.js (WB.counter redraws a wheel when its digit changes),
// so it must stay plain: no imports, `iso` is passed in. Glyph space: u 0..1 across, v 0..2 up.
const glyphLoop = (cx, cz, rx, rz, n = 14) => Array.from({ length: n + 1 }, (_, i) => { const a = (i / n) * Math.PI * 2; return [cx + rx * Math.sin(a), cz + rz * Math.cos(a)]; });
export const GLYPHS = [
  [glyphLoop(0.5, 1, 0.5, 1, 18)],
  [[[0.22, 1.6], [0.6, 2], [0.6, 0]], [[0.25, 0], [0.95, 0]]],
  [[[0.02, 1.5], [0.15, 1.86], [0.5, 2], [0.85, 1.86], [0.98, 1.5], [0.86, 1.12], [0, 0], [1, 0]]],
  [[[0.04, 1.8], [0.4, 2], [0.8, 1.94], [0.96, 1.58], [0.84, 1.2], [0.42, 1.06], [0.86, 0.94], [1, 0.52], [0.86, 0.12], [0.46, 0], [0.04, 0.18]]],
  [[[0.72, 0], [0.72, 2], [0, 0.62], [1, 0.62]]],
  [[[0.92, 2], [0.14, 2], [0.06, 1.08], [0.46, 1.24], [0.86, 1.12], [1, 0.62], [0.86, 0.14], [0.46, 0], [0.04, 0.16]]],
  [[[0.88, 1.88], [0.52, 2], [0.16, 1.82], [0, 1.2], [0, 0.6], [0.14, 0.12], [0.5, 0], [0.86, 0.12], [1, 0.6], [0.86, 1.06], [0.5, 1.2], [0.14, 1.04], [0, 0.66]]],
  [[[0, 2], [1, 2], [0.34, 0]]],
  [glyphLoop(0.5, 1.5, 0.4, 0.5, 14), glyphLoop(0.5, 0.52, 0.5, 0.52, 16)],
  [[[0.12, 0.12], [0.48, 0], [0.84, 0.18], [1, 0.8], [1, 1.4], [0.86, 1.88], [0.5, 2], [0.14, 1.88], [0, 1.4], [0.14, 0.94], [0.5, 0.8], [0.86, 0.96], [1, 1.34]]],
];

// A point on a vertical face. face "y": the face of constant y, text runs along +x.
// face "x": the face of constant x, text runs along -y. (u, v) are offsets across and up from cell's corner.
export const facePoint = (face, cell, u, v) => (face === "x" ? [cell.x, cell.y - u, cell.z + v] : [cell.x + u, cell.y, cell.z + v]);

// cell: { x, y, z, w, h } (its left-bottom corner on the face); returns an SVG path for digit d.
export function digitPath(iso, P, cell, d, face = "y") {
  const px = cell.w * 0.24, pz = cell.h * 0.16;
  const gw = cell.w - 2 * px, gh = cell.h - 2 * pz;
  return GLYPHS[d].map((line) => line.map(([gx, gz], i) => {
    const [sx, sy] = iso(facePoint(face, cell, px + gx * gw, pz + (gz / 2) * gh), P);
    return (i ? "L" : "M") + sx.toFixed(1) + " " + sy.toFixed(1);
  }).join("")).join("");
}

// The wheels of a counter: { x, y, z, w, h, gap, count, face }. Wheels run left to right as read.
export function counterCells(c) {
  const step = c.w + (c.gap ?? 1);
  return Array.from({ length: c.count }, (_, j) => (c.face === "x"
    ? { x: c.x, y: c.y - j * step, z: c.z, w: c.w, h: c.h }
    : { x: c.x + j * step, y: c.y, z: c.z, w: c.w, h: c.h }));
}

// The digits a counter of `count` wheels shows for v (it rolls over like an odometer).
export const digitsOf = (v, count) => String(((Math.floor(v) % 10 ** count) + 10 ** count) % 10 ** count).padStart(count, "0").split("").map(Number);

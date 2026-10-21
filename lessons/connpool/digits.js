// Printed numerals for counter wheels (copied from lesson 21): a small stroke font drawn onto a vertical face (constant y).
// Shared by the figure (first frame) and the live script (every change). Glyph space: x 0..1, z 0..2 (z up).
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

// cell: { x, y, z, w, h } on the face y = cell.y; returns an SVG path for digit d.
export function digitPath(iso, P, cell, d) {
  const px = cell.w * 0.24, pz = cell.h * 0.16;
  const gw = cell.w - 2 * px, gh = cell.h - 2 * pz;
  return GLYPHS[d].map((line) => line.map(([gx, gz], i) => {
    const [sx, sy] = iso([cell.x + px + gx * gw, cell.y, cell.z + pz + (gz / 2) * gh], P);
    return (i ? "L" : "M") + sx.toFixed(1) + " " + sy.toFixed(1);
  }).join("")).join("");
}

// The cells of a counter with `count` wheels: { x, y, z, w, h, gap }.
export function counterCells(c) {
  return Array.from({ length: c.count }, (_, j) => ({ x: c.x + j * (c.w + c.gap), y: c.y, z: c.z, w: c.w, h: c.h }));
}
export const digitsOf = (v, count) => String(((Math.floor(v) % 10 ** count) + 10 ** count) % 10 ** count).padStart(count, "0").split("").map(Number);

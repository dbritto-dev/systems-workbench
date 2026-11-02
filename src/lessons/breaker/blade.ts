// @ts-nocheck: drawing code ported as-is.
// The knife-switch blade, drawn at build time (figure.ts) and redrawn in the browser as it swings (live.ts), so it
// imports only the browser-safe kit geometry.
import { iso, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";

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

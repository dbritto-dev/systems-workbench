// @ts-nocheck: drawing shared by figure.ts (build) and live.ts (browser): the list's item blocks and the frame strip's
// bars, which the live code redraws at new heights. Only the kit's geometry, so it runs in the browser too.
import { slabOf, solidSvg, lineSvg, lineOnTop } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import { litFill } from "../../../workbench/parts.mjs";

export const TRAY_H = 7;                                                       // the galley's top
export const LIST = { x0: -88, y0: -40, cols: 10, rows: 2, dx: 16.2, dy: 11.5, w: 12, d: 8 };
export const ITEM_SLOTS = LIST.cols * LIST.rows;                               // 20 blocks stand for the list
export const ITEM_H = { min: 2.4, max: 9 };
export const itemAt = (s) => [LIST.x0 + (s % LIST.cols) * LIST.dx, LIST.y0 + Math.floor(s / LIST.cols) * LIST.dy];

// The frame strip along the right edge: oldest frame at the back, newest at the front.
export const STRIP = { x: 94, y: -94, w: 16, d: 96, r: 1.4 };
export const STRIP_H = 9;
export const BARS = { n: 10, x: STRIP.x + 5, w: 6, y0: STRIP.y + 9, dy: 8.6, d: 5.4, z: STRIP_H, perMs: 0.6, max: 36 };
export const BUDGET_Z = STRIP_H + BARS.perMs * (1000 / 60);

const solid = (P, plan, z, h, style, steps = 3, bevel = 0.3) => {
  const s = solidSvg(slabOf({ r: 0.4, ...plan }, z, h, P, steps, bevel), style);
  return style.lit ? litFill(s) : s;
};

// An item block of height h; inked: striped across its top (the other background colour); lit: its read forced a layout.
export function itemSvg(P, s, h, { inked = false, lit = false } = {}) {
  const [x, y] = itemAt(s);
  const z = TRAY_H + h, stripes = [];
  if (inked) for (let u = x + 2; u < x + LIST.w - 1; u += 2) stripes.push(lineOnTop([u, y + 1.2], [u, y + LIST.d - 1.2], z, P));
  const inner = inked ? lineSvg(stripes.join(""), { tone: "mid" }) : "";
  return solid(P, { x, y, w: LIST.w, d: LIST.d, r: 0.8 }, TRAY_H, h, { tone: "hi", crease: "lo", lit, inner });
}
// One bar of the frame strip, h units tall: the part above the 16.7 ms line is lit (the frame went over budget).
export function barSvg(P, i, h) {
  const plan = { x: BARS.x, y: BARS.y0 + i * BARS.dy, w: BARS.w, d: BARS.d };
  const under = Math.min(h, BUDGET_Z - BARS.z);
  const out = solid(P, plan, BARS.z, Math.max(0.4, under), { tone: "hi", crease: "lo" }, 2, 0.2);
  return h > under + 0.05 ? out + solid(P, plan, BARS.z + under, h - under, { tone: "hi", crease: "lo", lit: true }, 2, 0.2) : out;
}

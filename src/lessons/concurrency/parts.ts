// @ts-nocheck: figure code ported as-is.
// The parts that move, drawn the same way at build time (the still frame, figure.ts) and every frame in the browser
// (live.ts): the stirring rig, the plate stack on the pass, the knob pointers. Only the Anatomy kit's iso-kit, so the
// browser bundle stays small. The original serialised these functions into the live script with toString().
import { iso, solidSvg, lineSvg, dotsSvg, slabOf, cylinder, planOutline, ring, lineOnTop } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";

export const TOP = 34;
export const KNOB_R = 5.5;
export const KNOB_TOP = TOP + 4;
export const RAIL = { x: -138, y: -92, w: 276, d: 8, r: 1.5 };
export const RAIL_TOP = 102;
export const PASS_TOP = 6;
export const PLATE_AT = [146, 34];

export function movingParts(P) {
  const S = (paths, style) => solidSvg(paths, style);
  const L = (d, style) => lineSvg(d, style);
  const D = (points, style) => dotsSvg(points, style);
  const at = (p) => iso(p, P);

  // The pointer of a simmer-timer knob: it turns back to the top as the pan's simmer runs out.
  const knobPointer = (x, y, share) => {
    const a = share * Math.PI * 2;
    return lineOnTop([x, y], [x + Math.sin(a) * (KNOB_R - 1), y - Math.cos(a) * (KNOB_R - 1)], KNOB_TOP + 0.1, P);
  };

  function plateStack(count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const z = PASS_TOP + i * 1.6;
      out.push(S(cylinder(PLATE_AT[0], PLATE_AT[1], 10, z, 1.6, P, 36, 0.2), { tone: "hi", crease: "lo" }));
    }
    if (count) out.push(L(ring(PLATE_AT[0], PLATE_AT[1], 6.5, PASS_TOP + count * 1.6, P, 28), { tone: "faint" }));
    return out.join("");
  }

  // The moving rig, rebuilt every frame: carriage on the rail, arm out to the head, spoon below it.
  function rigSvg(hx, hy, tipZ, lit, stir = [0, 0]) {
    const out = [];
    out.push(S(slabOf({ x: hx - 12, y: RAIL.y - 4, w: 24, d: RAIL.d + 8, r: 2 }, RAIL_TOP, 8, P, 3, 0.5), { tone: "mid" }));
    out.push(D([at([hx - 8, RAIL.y + RAIL.d + 2, RAIL_TOP + 8]), at([hx + 8, RAIL.y + RAIL.d + 2, RAIL_TOP + 8])], { size: 0.45 }));
    const armFrom = RAIL.y + RAIL.d + 4;
    const armTo = hy - 6;
    if (armTo > armFrom + 1) out.push(S(slabOf({ x: hx - 3.5, y: armFrom, w: 7, d: armTo - armFrom, r: 1 }, RAIL_TOP + 1, 4, P, 2, 0.3), { tone: "mid" }));
    const sx = hx + stir[0], sy = hy + stir[1];
    const headZ = RAIL_TOP - 4;
    out.push(S(cylinder(sx, sy, 1.2, tipZ + 1.4, headZ - tipZ - 1.4, P, 12), { tone: "hi", crease: "none", lit }));
    out.push(S(cylinder(sx, sy, 3.2, tipZ, 1.4, P, 18), { tone: "hi", lit }));
    out.push(S(slabOf({ x: hx - 7, y: hy - 7, w: 14, d: 14, r: 2 }, headZ, 14, P, 3, 0.5), { tone: "hi", crease: "lo", lit }));
    out.push(L(planOutline({ x: hx - 4, y: hy - 4, w: 8, d: 8, r: 1 }, headZ + 14, P, 2), { tone: "faint" }));
    return out.join("");
  }

  return { rigSvg, plateStack, knobPointer };
}

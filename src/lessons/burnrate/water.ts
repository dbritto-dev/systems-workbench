// The water in the budget tank, drawn at a share of full. Shared by the figure (build) and the live code (browser).
import { slabOf, solidSvg } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";

export interface Glass { x: number; y: number; w: number; d: number; z0: number; z1: number }
export function waterSvg(P: unknown, g: Glass, share: number) {
  const h = Math.max(0.01, (g.z1 - g.z0 - 0.6) * Math.max(0, Math.min(1, share)));
  return solidSvg(slabOf({ x: g.x + 0.5, y: g.y + 0.5, w: g.w - 1, d: g.d - 1, r: 0.2 }, g.z0 + 0.2, h, P, 2), { tone: "mid", crease: "none", className: "br-water" });
}

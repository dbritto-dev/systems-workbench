// @ts-nocheck: drawing shared by parts.mjs (build) and src/runtime/wb.ts (browser): a tube's fill, which the live code
// redraws as the level changes. Only the vendored kit's geometry, so it runs in the browser too.
import { cylinder, slabOf, solidSvg } from "./vendor-anatomy/kit/iso-kit.mjs";

/** The glass's floor (world z): the tube stands on its socket. */
export const tubeFloor = ({ z = 0, socket = 1.2 }) => z + socket;

/** The fill of a tube (parts.mjs tube) at frac of its height (0–1), lit or not. Empty at 0. */
export function tubeFill(P, spec, frac, lit = false) {
  const { x, y, shape = "round", r = 2, w = 6, d = 6, h = 20, headroom = 0.6 } = spec;
  const f = Math.max(0, Math.min(1, frac));
  if (!(f > 0)) return "";
  const floor = tubeFloor(spec), fh = Math.max(0.3, (h - headroom) * f);
  return shape === "round"
    ? solidSvg(cylinder(x, y, r * 0.78, floor, fh, P, 16), { tone: "hi", crease: "none", lit })
    : solidSvg(slabOf({ x: x - w / 2 + 0.7, y: y - d / 2 + 0.7, w: w - 1.4, d: d - 1.4, r: 0.4 }, floor + 0.3, fh, P, 2, 0.2), { tone: "hi", crease: "lo", lit });
}

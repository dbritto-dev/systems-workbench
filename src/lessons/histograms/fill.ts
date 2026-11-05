// @ts-nocheck: drawing shared by the figure (build) and the live code (browser).
// The column of requests in one tube: a cylinder from the tube floor up to height h, lit for the tube holding the p99.
import { cylinder, solidSvg } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";

export function fillSvg(P, cx, cy, z, r, h, lit) {
  if (h < 0.3) return "";
  const svg = solidSvg(cylinder(cx, cy, r * 0.78, z, h, P, 16), { tone: "hi", crease: "none", lit });
  return lit ? svg.replace(/data-lit=""/g, 'data-lit="" data-lit-fill=""') : svg;
}
// Tube height for a count, on a log scale shared by every rack: `ref` requests fill a tube.
export const heightOf = (count, ref, max) => (count > 0 ? Math.max(0.8, Math.min(max, (max * Math.log10(1 + count)) / Math.log10(1 + ref))) : 0);

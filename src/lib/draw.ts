// Build-time drawing shortcuts every figure defined for itself: S (solids), L (lines), D (dots), at (project a point),
// seg (a line between two points), text (words painted on a face at x, y, z).
import * as k from "../../workbench/kit.mjs";
import { faceText } from "../../workbench/parts.mjs";

type Point3 = [number, number, number];
export interface Projection { origin: [number, number]; scale: number; azimuth?: number; elevation?: number }

export function shorthand(P: Projection) {
  return {
    S: (paths: unknown, style?: Record<string, unknown>) => k.solidSvg(paths, style),
    L: (d: unknown, style?: Record<string, unknown>) => k.lineSvg(d, style),
    D: (points: unknown, style?: Record<string, unknown>) => k.dotsSvg(points, style),
    at: (p: Point3) => k.iso(p, P),
    seg: (a: Point3, b: Point3) => k.segment(a, b, P),
    text: (x: number, y: number, z: number, value: unknown, opts?: Record<string, unknown>) => faceText(P, [x, y, z], value, opts),
  };
}

/** An attribute that hides an element in the still frame until the live code shows it. */
export const hiddenUnless = (on: boolean) => (on ? "" : ' style="display:none"');

// Build-time drawing shortcuts every figure defined for itself: S (solids), L (lines), D (dots), at (project a point).
import * as k from "../../workbench/kit.mjs";

type Point3 = [number, number, number];
export interface Projection { origin: [number, number]; scale: number; azimuth?: number; elevation?: number }

export function shorthand(P: Projection) {
  return {
    S: (paths: unknown, style?: Record<string, unknown>) => k.solidSvg(paths, style),
    L: (d: unknown, style?: Record<string, unknown>) => k.lineSvg(d, style),
    D: (points: unknown, style?: Record<string, unknown>) => k.dotsSvg(points, style),
    at: (p: Point3) => k.iso(p, P),
  };
}

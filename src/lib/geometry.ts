// Polylines in the plane (x, y), for things that travel along a drawn route. Points may carry a z; it's ignored.
type Point = readonly number[];

/** The length of a polyline in x, y. */
export function polylineLength(points: readonly Point[]) {
  let s = 0;
  for (let i = 1; i < points.length; i++) s += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return s;
}

/**
 * The point `dist` along a polyline in x, y, as [x, y]. Clamped: before the start it stays at the start, past the
 * end at the end of the last segment. A zero-length segment that `dist` lands on gives that segment's end point.
 * (Some lessons keep their own walk along a route: unclamped, 3D, or by a share of the length; see their live.ts.)
 */
export function pointAlong(points: readonly Point[], dist: number): Point {
  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    if (dist <= seg || i === points.length - 1) {
      const u = seg ? Math.max(0, Math.min(1, dist / seg)) : 1;
      return [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * u, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * u];
    }
    dist -= seg;
  }
  return points[points.length - 1];
}

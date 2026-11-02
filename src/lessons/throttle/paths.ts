// @ts-nocheck: figure code ported as-is.
// The three shapes the live code redraws every frame: the metronome's arm at an angle, the gauge's needle at a call
// rate, and the dashed gap on the rail between what the screen shows and where the user is. figure.ts draws the first
// frame with them and live.ts the rest (the original page lifted these functions out of figure.mjs as source text).
// Kit geometry only, so it is light enough for the browser.
import { iso, pathOf, segment, lineOnTop } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";

export function livePaths(P, { PIVOT, ARM, GAUGE, RAIL, LANE_USER }) {
  const at = (p) => iso(p, P);
  // The swinging arm (live: rebuilt every frame from its angle).
  function armPaths(a) {
    const [px, py, pz] = PIVOT;
    const u = [Math.sin(a), 0, Math.cos(a)], n = [Math.cos(a), 0, -Math.sin(a)];
    const pt = (s, w) => at([px + u[0] * s + n[0] * w, py, pz + u[2] * s + n[2] * w]);
    const rod = pathOf([pt(-1, -ARM.w / 2), pt(ARM.len, -ARM.w / 2), pt(ARM.len, ARM.w / 2), pt(-1, ARM.w / 2)], true);
    const s0 = ARM.len * ARM.weight, wt = pathOf([pt(s0 - 3.4, -3.6), pt(s0 + 3.4, -3.6), pt(s0 + 3.4, 3.6), pt(s0 - 3.4, 3.6)], true);
    return { rod, wt };
  }
  function needlePath(rate) {
    const g = GAUGE, f = Math.max(0, Math.min(1, rate / g.max)), a = g.from + (g.to - g.from) * f;
    return segment([g.cx, g.cy, g.top], [g.cx + Math.sin(a) * (g.r - 1.2), g.cy - Math.cos(a) * (g.r - 1.2), g.top], P);
  }
  function gapPath(x0, x1) {
    if (Math.abs(x1 - x0) < 0.5) return "";
    return lineOnTop([x0, LANE_USER], [x1, LANE_USER], RAIL.h, P);
  }
  return { armPaths, needlePath, gapPath };
}

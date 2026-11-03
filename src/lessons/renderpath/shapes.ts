// @ts-nocheck: drawing shared by figure.ts (build) and live.ts (browser): the tubes' fill, which the live code redraws
// as bytes arrive, and the shutter over the screen, which rolls up at the first paint. Only the kit's geometry, so it
// runs in the browser too.
import { slabOf, solidSvg, lineSvg, segment, iso, pathOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import { litFill } from "../../../workbench/parts.mjs";

// The download rack at the back: one tube per resource, a plinth with its name under each.
export const TUBES = ["html", "css", "app", "font", "hero", "imgs", "ad"];
export const RACK = { x0: -160, dx: 22, y: -110, w: 18, d: 13, h: 6 };
export const GLASS = { w: 10, d: 6, h: 24 };
export const tubeAt = (i) => [RACK.x0 + i * RACK.dx + RACK.w / 2, RACK.y + RACK.d / 2 - 1];

// The fill of tube i at frac (0–1); lit while the page is waiting on it.
export function tubeFill(P, i, frac, lit) {
  const [cx, cy] = tubeAt(i), w = GLASS.w - 1.4, d = GLASS.d - 1.4;
  const h = Math.max(0.3, (GLASS.h - 0.6) * Math.min(1, frac));
  const s = solidSvg(slabOf({ x: cx - w / 2, y: cy - d / 2, w, d, r: 0.4 }, RACK.h + 0.3, h, P, 2, 0.2), { tone: "hi", crease: "lo", lit });
  return lit ? litFill(s) : s;
}

// The screen: a phone standing at the right, its face toward the viewer. The page is drawn on the face at SCALE
// world units per CSS pixel, from TOP (the top of the viewport) down; 720 px reach BOTTOM.
export const SCREEN = { x0: 56, x1: 92, y: -70, top: 80, scale: 0.09 };
export const BOTTOM = SCREEN.top - 720 * SCREEN.scale;
export const FACE_Y = SCREEN.y + 0.05;

// The roller shutter: down until the first paint, then it rolls up into its box; z0 is its bottom edge.
export function shutterSvg(P, z0) {
  const h = SCREEN.top - z0;
  if (h < 0.3) return "";
  const plan = { x: SCREEN.x0 - 0.6, y: SCREEN.y, w: SCREEN.x1 - SCREEN.x0 + 1.2, d: 0.8, r: 0 };
  const slats = [];
  for (let z = SCREEN.top - 2.4; z > z0 + 0.6; z -= 2.4) slats.push(segment([plan.x + 0.4, SCREEN.y + 0.85, z], [plan.x + plan.w - 0.4, SCREEN.y + 0.85, z], P));
  return solidSvg(slabOf(plan, z0, h, P, 1), { tone: "mid", crease: "none" }) + lineSvg(slats.join(""), { tone: "lo" });
}
export const screenClip = (P) => pathOf([[SCREEN.x0, FACE_Y, BOTTOM], [SCREEN.x1, FACE_Y, BOTTOM], [SCREEN.x1, FACE_Y, SCREEN.top], [SCREEN.x0, FACE_Y, SCREEN.top]].map((p) => iso(p, P)), true);

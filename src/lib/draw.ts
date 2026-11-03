// Build-time drawing shortcuts every figure defined for itself: S (solids), L (lines), D (dots), at (project a point),
// seg (a line between two points), text (words painted on a face at x, y, z), faceY (a rectangle on a y face), top
// (a line on a horizontal top at height z), rawText (face words in the markup some figures were published with).
import * as k from "../../workbench/kit.mjs";
import { faceText } from "../../workbench/parts.mjs";
import { isT } from "../../workbench/i18n.mjs";

type Point3 = [number, number, number];
export interface Projection { origin: [number, number]; scale: number; azimuth?: number; elevation?: number }

type Point2 = [number, number];
interface RawTextOpts { size?: number; tone?: string; anchor?: string; attr?: string }

export function shorthand(P: Projection) {
  const rawText1 = (x: number, y: number, z: number, value: unknown, { size = 3, tone = "mid", anchor = "start", attr = "" }: RawTextOpts = {}) =>
    `<text class="iso-face-text" ${attr} data-tone="${tone}" transform="${k.sideMatrix([x, y], z, P, "left")}" font-size="${size}" text-anchor="${anchor}">${value}</text>`;
  return {
    S: (paths: unknown, style?: Record<string, unknown>) => k.solidSvg(paths, style),
    L: (d: unknown, style?: Record<string, unknown>) => k.lineSvg(d, style),
    D: (points: unknown, style?: Record<string, unknown>) => k.dotsSvg(points, style),
    at: (p: Point3) => k.iso(p, P),
    seg: (a: Point3, b: Point3) => k.segment(a, b, P),
    text: (x: number, y: number, z: number, value: unknown, opts?: Record<string, unknown>) => faceText(P, [x, y, z], value, opts),
    /** A closed rectangle on the face y = const: x0..x1 across, z0..z1 up. */
    faceY: (x0: number, x1: number, y: number, z0: number, z1: number) => k.faceRectY(P, x0, x1, y, z0, z1),
    /** A straight line from a to b (x, y) on a horizontal top at height z. */
    top: (a: Point2, b: Point2, z: number) => k.lineOnTop(a, b, z, P),
    /**
     * Words on a y face, in the markup some figures were published with and must keep byte for byte: the extra
     * attribute goes right after the class, the value isn't escaped, and text-anchor is always written. text() is
     * the one to use for new figures. A t(en, es) value draws one <text> per language.
     */
    rawText: (x: number, y: number, z: number, value: unknown, opts?: RawTextOpts) => (isT(value)
      ? `<g data-l="en">${rawText1(x, y, z, (value as { en: unknown }).en, opts)}</g><g data-l="es">${rawText1(x, y, z, (value as { es: unknown }).es, opts)}</g>`
      : rawText1(x, y, z, value, opts)),
  };
}

/** An attribute that hides an element in the still frame until the live code shows it. */
export const hiddenUnless = (on: boolean) => (on ? "" : ' style="display:none"');

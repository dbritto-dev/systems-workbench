// The phone lens. On a narrow screen (LENS_MAX px and below) a figure shows the whole machine small (the overview, with
// a frame marking what the close-up shows) and a close-up of part of it at a scale where its words read. The close-up
// is the machine's own <svg>, scaled and moved by CSS inside the stage, which crops it; the overview is a still copy,
// taken again every so often. So the live code still draws one machine, and the browser copies nothing per frame.
// Where it looks: a region the lesson declares (plate.regions; the reader picks one, or live code calls
// root.focusOn(id)), else what is lit. components/lesson/FigurePlate.astro renders the first frame with these helpers
// and src/elements/wb-figure.ts moves it; the rules are here so both agree.
import type { Bi } from "../i18n";

/** The lens is on at this viewport width and below (the width the neuron lesson's own phone drawing uses), with
 *  JavaScript: LENS_MEDIA is the query styles.mjs (LENS_CSS) and wb-figure.ts share. */
export const LENS_MAX = 560;
export const LENS_MEDIA = `(max-width: ${LENS_MAX}px) and (scripting: enabled)`;
/** Face text in the close-up comes out at least this large (px). */
export const LENS_TEXT_PX = 12;
/** Face text on a desktop comes out at least this large (px) in a lesson that has been through the text pass. */
export const DESK_TEXT_PX = 11;
/** The stage's width (px) on a desktop: the 780 px page less the plate's 24 px padding each side. */
export const DESK_STAGE_PX = 732;
/** The close-up's width (px) on a 390 px phone: the build draws the first frame for it. */
export const PHONE_CLOSEUP_PX = 334;
/** The close-up is 2 to 3 times the scale the whole figure would get across the same width. */
export const LENS_ZOOM = [2, 3] as const;

export type Box = [x: number, y: number, w: number, h: number];
/** A named part of the figure the close-up can show: its id, a short label for the lens control, and its box in the
 *  figure's viewBox units (screenBox() in workbench/kit.mjs makes one from world points). */
export interface LensRegion { id: string; label: Bi; box: Box }

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** The smallest face text in a figure's SVG markup, in viewBox units: font-size × the scale of the text's transform
 *  along its baseline (what tools/text-size.cjs measures). Null when the figure has no text. */
export function minTextOf(svg: string): number | null {
  let min = Infinity;
  for (const m of svg.matchAll(/<text\b([^>]*)>/g)) {
    const a = m[1];
    const fs = +(a.match(/font-size="([\d.]+)"/)?.[1] ?? NaN);
    if (!(fs > 0)) continue;
    const t = a.match(/transform="matrix\(([^)]*)\)"/)?.[1].split(/[\s,]+/).map(Number);
    min = Math.min(min, fs * (t ? Math.hypot(t[0], t[1]) : 1));
  }
  return Number.isFinite(min) ? min : null;
}

/** px per viewBox unit in a close-up `width` px wide on a figure `vbw` units wide: enough for the smallest text to
 *  reach LENS_TEXT_PX, within LENS_ZOOM times the scale the whole figure gets across that width. */
export function lensScale(width: number, vbw: number, minText: number | null): number {
  const fit = width / vbw;
  // A little over the floor, so rounding in a figure's sizes doesn't leave its smallest word at 11.9 px.
  const want = minText ? (LENS_TEXT_PX + 0.4) / minText : 2.4 * fit;
  return clamp(want, LENS_ZOOM[0] * fit, LENS_ZOOM[1] * fit);
}

/** The close-up's height (px): tall enough for the tallest region at that scale, 0.62 to 1 times its width. */
export function lensHeight(width: number, scale: number, regions: LensRegion[] = []): number {
  const tallest = Math.max(0, ...regions.map((r) => r.box[3] * scale + 8));
  return Math.round(clamp(tallest || width * 0.72, width * 0.62, width));
}

/** The close-up's view (a viewBox) of `size` (viewBox units) centred on `target`, kept inside `bounds`. */
export function viewOn(target: Box, size: [number, number], bounds: Box): Box {
  const [w, h] = size;
  const cx = target[0] + target[2] / 2, cy = target[1] + target[3] / 2;
  const x = w >= bounds[2] ? bounds[0] + (bounds[2] - w) / 2 : clamp(cx - w / 2, bounds[0], bounds[0] + bounds[2] - w);
  const y = h >= bounds[3] ? bounds[1] + (bounds[3] - h) / 2 : clamp(cy - h / 2, bounds[1], bounds[1] + bounds[3] - h);
  return [x, y, w, h];
}

/** The viewBox of an <svg> string as [x, y, w, h]. */
export const viewBoxOf = (svg: string): Box => (svg.match(/viewBox="([^"]*)"/)?.[1] ?? "0 0 700 450").split(/[\s,]+/).map(Number) as Box;

/** The stage's CSS variables for a view: the machine's width at that scale, the shift that brings the view's corner to
 *  the stage's, and the stage's aspect ratio (styles.mjs, LENS_CSS). */
export function lensVars(bounds: Box, view: Box, scale: number, width: number, height: number): string {
  const px = (v: number) => `${+v.toFixed(2)}px`;
  return `--lens-w:${px(bounds[2] * scale)};--lens-x:${px(-(view[0] - bounds[0]) * scale)};--lens-y:${px(-(view[1] - bounds[1]) * scale)};--lens-ar:${Math.round(width)}/${Math.round(height)}`;
}

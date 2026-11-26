// The one place lessons get the Anatomy kit from (vendored, MIT: vendor-anatomy/LICENSE),
// plus faceRectY/faceRectX (closed rectangles on vertical faces), which the kit doesn't have yet.
//
//   import * as k from "../../../workbench/kit.mjs";   // from src/lessons/<slug>/: iso-kit plus the helpers below
//   import * as G from "../../workbench/vendor-anatomy/kit/lathe.mjs";   // round parts, when needed
//   import { tubePieces, tubeSvg } from "../../workbench/vendor-anatomy/kit/tube.mjs";
import { iso, pathOf, ISO_CSS as KIT_CSS } from "./vendor-anatomy/kit/iso-kit.mjs";

export * from "./vendor-anatomy/kit/iso-kit.mjs";

// The kit's palette with one change: the muted grey (captions, eyebrows, labels, plate corners, legends) reaches
// WCAG AA contrast for small text, 4.5:1, on every surface it sits on: light #8c8c90 → #656569 (5.2:1 on the page,
// 5.6:1 on cards), dark #6e6e6e → #8d8d91 (5.6:1 on cards). Only interface text uses it; the drawings don't.
// Words painted on the machine (face text) get their own ink, --anatomy-face-ink, instead of the kit's mid grey, which
// is a line colour and reaches only 2.5–3.5:1 on the faces. The new ink reaches 4.5:1 on every face, shade and lit top
// it can sit on: light #5e5e62 (4.7:1 on the darkest shade, #dcdcd9), dark #939397 (4.9:1 on the lit top, #262626).
// Lines and strokes keep --anatomy-mid.
const MUTED = [
  ["--anatomy-muted:#8c8c90", "--anatomy-muted:#656569"], ["--anatomy-muted:#6e6e6e", "--anatomy-muted:#8d8d91"],
  ["--anatomy-mid:#8a8a8f;", "--anatomy-mid:#8a8a8f;--anatomy-face-ink:#5e5e62;"], ["--anatomy-mid:#6a6a6a;", "--anatomy-mid:#6a6a6a;--anatomy-face-ink:#939397;"],
];
export const ISO_CSS = MUTED.reduce((css, [from, to]) => {
  if (!css.includes(from)) throw new Error(`kit.mjs: the kit's palette changed, ${from} not found`);
  return css.replace(from, to);
}, KIT_CSS) +
  ".iso-face-text{fill:var(--anatomy-face-ink)}" +
  // The live readout wraps instead of running off the plate's left edge: it keeps clear of the hint on wide plates and,
  // on phones, where there is no Space key to pause with, takes the hint's place and the full width.
  '.iso-plate-corner[data-corner="readout"]{left:12em;white-space:normal;text-align:right;line-height:1.3}' +
  '@media (max-width:560px){.iso-plate-corner[data-corner="hint"]{display:none}.iso-plate-corner[data-corner="readout"]{left:0}}';
// Round parts: a shaded sphere (heads, bulbs, knobs) from the kit's lathe module.
export { sphereOf } from "./vendor-anatomy/kit/lathe.mjs";

// A closed rectangle on a vertical face of constant y (runs along x, up z): label slots,
// gauge strips, panels on +y faces. The kit only draws outlines on top faces (planOutline).
export const faceRectY = (P, x0, x1, y, z0, z1) => pathOf([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]].map((p) => iso(p, P)), true);

// The same on a vertical face of constant x (runs along y, up z): panels on +x faces.
export const faceRectX = (P, x, y0, y1, z0, z1) => pathOf([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]].map((p) => iso(p, P)), true);

// figureSvg with a bilingual label: label may be t(en, es); the aria-label then follows the language switch.
import { figureSvg as kitFigureSvg } from "./vendor-anatomy/kit/iso-kit.mjs";
import { isT as isBi } from "./i18n.mjs";
const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Every figure's face text is raised to the desktop floor (textFloor, below) unless the figure passes minText: 0.
export function figureSvg(opts) {
  const floor = (svg) => (opts.minText === 0 ? svg : textFloor(svg, opts.width, opts.minText));
  if (!isBi(opts.label)) return floor(kitFigureSvg(opts));
  return floor(kitFigureSvg({ ...opts, label: opts.label.en })).replace(/aria-label="[^"]*"/, (m) => `${m} data-aria-en="${escAttr(opts.label.en)}" data-aria-es="${escAttr(opts.label.es)}"`);
}

// faceTextSvg with bilingual text: text may be t(en, es); both are drawn and CSS shows the current language.
import { faceTextSvg as kitFaceTextSvg } from "./vendor-anatomy/kit/iso-kit.mjs";
export function faceTextSvg(matrix, text, opts) {
  if (!isBi(text)) return kitFaceTextSvg(matrix, text, opts);
  return `<g data-l="en">${kitFaceTextSvg(matrix, text.en, opts)}</g><g data-l="es">${kitFaceTextSvg(matrix, text.es, opts)}</g>`;
}

// ---------- sizes on a desktop, and boxes for the phone lens ----------
// A figure's stage is 732 px wide on a desktop (src/lib/lens.ts, DESK_STAGE_PX), so a figure `width` viewBox units
// wide draws 732 / width px per unit. tools/text-size.cjs measures face text as font-size × the scale of its transform
// along the baseline, and a counter's digits by their height over 0.72 (a mono face's digits stand about 0.72 em).
export const DESK_STAGE_PX = 732;
export const DIGIT_EM = 0.72;
const unitLen = (P, d) => { const a = iso([0, 0, 0], P), b = iso(d, P); return Math.hypot(b[0] - a[0], b[1] - a[1]); };
const BASELINE = { y: [1, 0, 0], x: [0, -1, 0], top: [1, 0, 0], topY: [0, -1, 0] };

// The face-text size (world units) that comes out at `px` on a desktop: faceText(P, at, text, { size: textSize(P, 11, { width: WIDTH }) }).
// face: "y" | "x" | "top" as for faceText; along: "y" for top text that reads along y.
export const textSize = (P, px, { width = 700, face = "y", along = "x" } = {}) =>
  +(px / (DESK_STAGE_PX / width) / unitLen(P, BASELINE[face === "top" && along === "y" ? "topY" : face])).toFixed(2);

// The desktop floor for words painted on a machine (src/lessons/README.md, "Text on the machine"): 9 px, which the phone
// lens's close-up (up to 3× the whole figure's scale) brings to 12 px. A little over, so rounding doesn't land under.
export const TEXT_FLOOR_PX = 9.2;
// Raise every <text> in an SVG string (a figure `width` units wide) that would come out under `px` on a desktop: its
// font-size × the scale of its transform along the baseline, as tools/text-size.cjs measures it. figureSvg applies it;
// call it on a fragment the live code inserts (a token, a card) with the figure's width.
export function textFloor(svg, width, px = TEXT_FLOOR_PX) {
  const min = (px * width) / DESK_STAGE_PX;
  return svg.replace(/<text\b[^>]*>/g, (tag) => {
    const fs = +(tag.match(/font-size="([\d.]+)"/)?.[1] ?? NaN);
    if (!(fs > 0)) return tag;
    const m = tag.match(/transform="matrix\(([^)]*)\)"/)?.[1].split(/[\s,]+/).map(Number);
    const scale = m ? Math.hypot(m[0], m[1]) : 1;
    return fs * scale >= min ? tag : tag.replace(/font-size="[\d.]+"/, `font-size="${+(min / scale).toFixed(3)}"`);
  });
}

// A digit counter's wheel height h (world units) whose digits come out at `px` on a desktop (the glyph is 0.68 h).
export const wheelHeight = (P, px, { width = 700 } = {}) => +((px * DIGIT_EM) / (0.68 * unitLen(P, [0, 0, 1]) * (DESK_STAGE_PX / width))).toFixed(2);

// The box [x, y, w, h] (viewBox units) around world points, padded: a lens region (plate.regions in page.ts).
//   screenBox(P, k.boxCorners(DESK, 0, 30))
export function screenBox(P, points, pad = 6) {
  const s = points.map((p) => iso(p, P));
  const x0 = Math.min(...s.map((p) => p[0])) - pad, y0 = Math.min(...s.map((p) => p[1])) - pad;
  const x1 = Math.max(...s.map((p) => p[0])) + pad, y1 = Math.max(...s.map((p) => p[1])) + pad;
  return [x0, y0, x1 - x0, y1 - y0].map((v) => +v.toFixed(1));
}

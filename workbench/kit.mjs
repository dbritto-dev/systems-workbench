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
const MUTED = [["--anatomy-muted:#8c8c90", "--anatomy-muted:#656569"], ["--anatomy-muted:#6e6e6e", "--anatomy-muted:#8d8d91"]];
export const ISO_CSS = MUTED.reduce((css, [from, to]) => {
  if (!css.includes(from)) throw new Error(`kit.mjs: the kit's palette changed, ${from} not found`);
  return css.replace(from, to);
}, KIT_CSS) +
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
export function figureSvg(opts) {
  if (!isBi(opts.label)) return kitFigureSvg(opts);
  return kitFigureSvg({ ...opts, label: opts.label.en }).replace(/aria-label="[^"]*"/, (m) => `${m} data-aria-en="${escAttr(opts.label.en)}" data-aria-es="${escAttr(opts.label.es)}"`);
}

// faceTextSvg with bilingual text: text may be t(en, es); both are drawn and CSS shows the current language.
import { faceTextSvg as kitFaceTextSvg } from "./vendor-anatomy/kit/iso-kit.mjs";
export function faceTextSvg(matrix, text, opts) {
  if (!isBi(text)) return kitFaceTextSvg(matrix, text, opts);
  return `<g data-l="en">${kitFaceTextSvg(matrix, text.en, opts)}</g><g data-l="es">${kitFaceTextSvg(matrix, text.es, opts)}</g>`;
}

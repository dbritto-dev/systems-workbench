// The one place lessons get the Anatomy kit from (vendored, MIT: vendor-anatomy/LICENSE),
// plus faceRectY/faceRectX (closed rectangles on vertical faces), which the kit doesn't have yet.
//
//   import * as k from "../../workbench/kit.mjs";      // everything in iso-kit, plus the helpers below
//   import * as G from "../../workbench/vendor-anatomy/kit/lathe.mjs";   // round parts, when needed
//   import { tubePieces, tubeSvg } from "../../workbench/vendor-anatomy/kit/tube.mjs";
import { iso, pathOf } from "./vendor-anatomy/kit/iso-kit.mjs";

export * from "./vendor-anatomy/kit/iso-kit.mjs";
export { kitScript } from "./vendor-anatomy/scripts/inline-kit.mjs";
// Round parts: a shaded sphere (heads, bulbs, knobs) from the kit's lathe module.
export { sphereOf } from "./vendor-anatomy/kit/lathe.mjs";

// A closed rectangle on a vertical face of constant y (runs along x, up z): label slots,
// gauge strips, panels on +y faces. The kit only draws outlines on top faces (planOutline).
export const faceRectY = (P, x0, x1, y, z0, z1) => pathOf([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]].map((p) => iso(p, P)), true);

// The same on a vertical face of constant x (runs along y, up z): panels on +x faces.
export const faceRectX = (P, x, y0, y1, z0, z1) => pathOf([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]].map((p) => iso(p, P)), true);

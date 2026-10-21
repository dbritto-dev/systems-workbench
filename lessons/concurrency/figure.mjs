// One cook, one stove: a range with eight burners, a simmer-timer knob per burner, and a single
// stirring head on a gantry behind it. Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -175, y: -104, w: 350, d: 204, r: 8 };
const STOVE = { x: -116, y: -62, w: 232, d: 124, r: 4 };
export const TOP = 34;
const COLS = [-81, -27, 27, 81];
const ROWS = [-30, 14];
export const PAN_R = 16;
export const PAN_TOP = TOP + 9;
export const POT_TOP = TOP + 24;
const KNOB_Y = 46;
export const KNOB_R = 5.5;
export const KNOB_TOP = TOP + 4;
const RAIL = { x: -138, y: -92, w: 276, d: 8, r: 1.5 };
export const RAIL_TOP = 102;
const POSTS = [[-132, -88], [132, -88]];
const PASS = { x: 128, y: 6, w: 36, d: 56, r: 3 };
export const PASS_TOP = 6;
export const PLATE_AT = [146, 34];

export const PANS = Array.from({ length: 8 }, (_, i) => ({ x: COLS[i % 4], y: ROWS[i < 4 ? 0 : 1], knob: [COLS[i % 4], KNOB_Y] }));
export const PARK = [0, -52];

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -17, 0), [RAIL.x, RAIL.y, RAIL_TOP + 10], [RAIL.x + RAIL.w, RAIL.y, RAIL_TOP + 10], [RAIL.x, RAIL.y + RAIL.d, RAIL_TOP + 10]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 52 },
);

const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const at = (p) => k.iso(p, P);

function plate() {
  return basePlate(P, PLATE)
    + rulerStrip(P, { x: -160, y: 84, w: 190, d: 7, r: 1 })
    + labelPlate(P, { x: 52, y: 74, w: 44, d: 18, r: 1.5 }, [[58, 79, 24], [58, 83.5, 32], [58, 88, 18]]);
}

function gantryBack() {
  const out = [];
  for (const [x, y] of POSTS) {
    out.push(S(k.cylinder(x, y, 7, 0, 3, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 3.6, 3, RAIL_TOP - 9, P, 24), { tone: "mid", crease: "none" }));
    out.push(L(k.sideArc(x, y, 3.6, 30, P, 14) + k.sideArc(x, y, 3.6, 70, P, 14), { tone: "faint" }));
  }
  out.push(S(k.slabOf(RAIL, RAIL_TOP - 6, 6, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.lineOnTop([RAIL.x + 4, RAIL.y + 4], [RAIL.x + RAIL.w - 4, RAIL.y + 4], RAIL_TOP, P), { tone: "faint" }));
  out.push(D(POSTS.map(([x, y]) => at([x, y + 4, RAIL_TOP])), { size: 0.5 }));
  for (const x of [RAIL.x - 4, RAIL.x + RAIL.w]) out.push(S(k.slabOf({ x, y: RAIL.y - 2, w: 4, d: RAIL.d + 4, r: 1 }, RAIL_TOP - 7, 9, P, 2, 0.3), { tone: "mid" }));
  return out.join("");
}

function stove() {
  const out = [`<path class="iso-halo" d="${k.haloOf(STOVE, 0, TOP, P)}"/>`];
  out.push(S(k.slabOf(k.insetPlan(STOVE, 3), 0, 4, P, 4, 0.4), { tone: "lo" }));
  out.push(S(k.slabOf(STOVE, 4, TOP - 4, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(STOVE, 22, P, 4), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan({ x: STOVE.x, y: STOVE.y, w: STOVE.w, d: 104, r: 4 }, 5), TOP, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([STOVE.x + 5, KNOB_Y - 10], [STOVE.x + STOVE.w - 5, KNOB_Y - 10], TOP, P), { tone: "faint" }));
  for (const pan of PANS) {
    const [x, y] = [pan.x, pan.y];
    out.push(L(k.ring(x, y, 18, TOP, P, 48) + k.ring(x, y, 11, TOP, P, 36) + k.ring(x, y, 4, TOP, P, 18), { tone: "lo" }));
    out.push(L([0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * Math.PI * 2; return k.lineOnTop([x + Math.cos(a) * 4, y + Math.sin(a) * 4], [x + Math.cos(a) * 11, y + Math.sin(a) * 11], TOP, P); }).join(""), { tone: "faint" }));
  }
  return out.join("");
}

// A simmer-timer knob: its pointer turns back to the top as the pan's simmer runs out.
export function knob(x, y) {
  return S(k.cylinder(x, y, KNOB_R + 1.2, TOP, 1.2, P, 28), { tone: "lo" })
    + S(k.cylinder(x, y, KNOB_R, TOP + 1.2, KNOB_TOP - TOP - 1.2, P, 32, 0.3), { tone: "mid" })
    + L(k.knurl(x, y, KNOB_R, TOP + 1.4, KNOB_TOP, 30, P), { tone: "lo" });
}

export const knobPointer = (x, y, share) => {
  const a = share * Math.PI * 2;
  return k.lineOnTop([x, y], [x + Math.sin(a) * (KNOB_R - 1), y - Math.cos(a) * (KNOB_R - 1)], KNOB_TOP + 0.1, P);
};

function panBody(pan, pot) {
  const { x, y } = pan;
  const r = pot ? PAN_R + 1 : PAN_R;
  const top = pot ? POT_TOP : PAN_TOP;
  const out = [];
  out.push(S(k.cylinder(x, y, r, TOP, top - TOP, P, 48, 0.4), { tone: "hi", crease: "lo", inner: pot ? L(k.sideArc(x, y, r, TOP + 12, P, 32), { tone: "faint" }) : "" }));
  out.push(L(k.ring(x, y, r - 1.6, top, P, 44), { tone: "lo" }));
  out.push(L(k.ring(x, y, r - 5, top, P, 36), { tone: "faint" }));
  const hz = top - 4;
  out.push(S(k.slabOf({ x: x + r - 1, y: y - 2, w: 13, d: 4, r: 1.2 }, hz, 2.6, P, 2, 0.3), { tone: "mid" }));
  out.push(D([at([x + r + 9, y, hz + 2.6])], { size: 0.5, tone: "lo" }));
  return out.join("");
}

function lid(pan, pot) {
  const { x, y } = pan;
  const r = (pot ? PAN_R + 1 : PAN_R) + 0.6;
  const top = pot ? POT_TOP : PAN_TOP;
  return S(k.cylinder(x, y, r, top, 1.6, P, 48, 0.3), { tone: "hi", crease: "lo" })
    + L(k.ring(x, y, r - 4, top + 1.6, P, 36), { tone: "faint" })
    + S(k.cylinder(x, y, 2.6, top + 1.6, 3, P, 18), { tone: "mid" });
}

// The order ticket clipped to the handle: up while the pan is waiting for the cook.
function ticket(pan, pot) {
  const { x, y } = pan;
  const r = pot ? PAN_R + 1 : PAN_R;
  const top = pot ? POT_TOP : PAN_TOP;
  const hz = top - 4 + 2.6;
  return S(k.slabOf({ x: x + r + 5, y: y - 3.5, w: 1.4, d: 7, r: 0.3 }, hz, 9, P, 2, 0.2), { tone: "hi", crease: "lo" })
    + L(k.segment([x + r + 6.4, y - 2.2, hz + 7], [x + r + 6.4, y + 2.2, hz + 7], P) + k.segment([x + r + 6.4, y - 2.2, hz + 5], [x + r + 6.4, y + 1, hz + 5], P), { tone: "faint", free: true });
}

function panGroup(pan, i) {
  const variant = (pot) => `<g data-variant="${pot ? "pot" : "pan"}">${panBody(pan, pot)}<g data-lid class="lid">${lid(pan, pot)}</g><g data-ticket class="ticket">${ticket(pan, pot)}</g></g>`;
  return `<g data-pan="${i}" class="pan">${variant(false)}${i === 0 ? variant(true) : ""}</g>`;
}

function knobs() {
  return PANS.slice(0, 4).map((p, col) => {
    const [x, y] = p.knob;
    return knob(x - 7, y) + `<path data-pointer="${col}" class="iso-line" data-tone="hi" data-free="end" d=""/>`
      + knob(x + 7, y) + `<path data-pointer="${col + 4}" class="iso-line" data-tone="hi" data-free="end" d=""/>`;
  }).join("");
}

export const KNOBS = PANS.map((p, i) => [p.knob[0] + (i < 4 ? -7 : 7), p.knob[1]]);

function pass() {
  return S(k.slabOf(PASS, 0, PASS_TOP, P, 4, 0.5), { tone: "mid" })
    + L(k.planOutline(k.insetPlan(PASS, 3), PASS_TOP, P), { tone: "faint" })
    + L(k.ring(PLATE_AT[0], PLATE_AT[1], 11, PASS_TOP, P, 32), { tone: "lo" });
}

export function plateStack(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const z = PASS_TOP + i * 1.6;
    out.push(S(k.cylinder(PLATE_AT[0], PLATE_AT[1], 10, z, 1.6, P, 36, 0.2), { tone: "hi", crease: "lo" }));
  }
  if (count) out.push(L(k.ring(PLATE_AT[0], PLATE_AT[1], 6.5, PASS_TOP + count * 1.6, P, 28), { tone: "faint" }));
  return out.join("");
}

// The moving rig, rebuilt every frame: carriage on the rail, arm out to the head, spoon below it.
export function rigSvg(hx, hy, tipZ, lit, stir = [0, 0]) {
  const out = [];
  out.push(S(k.slabOf({ x: hx - 12, y: RAIL.y - 4, w: 24, d: RAIL.d + 8, r: 2 }, RAIL_TOP, 8, P, 3, 0.5), { tone: "mid" }));
  out.push(D([at([hx - 8, RAIL.y + RAIL.d + 2, RAIL_TOP + 8]), at([hx + 8, RAIL.y + RAIL.d + 2, RAIL_TOP + 8])], { size: 0.45 }));
  const armFrom = RAIL.y + RAIL.d + 4;
  const armTo = hy - 6;
  if (armTo > armFrom + 1) out.push(S(k.slabOf({ x: hx - 3.5, y: armFrom, w: 7, d: armTo - armFrom, r: 1 }, RAIL_TOP + 1, 4, P, 2, 0.3), { tone: "mid" }));
  const sx = hx + stir[0], sy = hy + stir[1];
  const headZ = RAIL_TOP - 4;
  out.push(S(k.cylinder(sx, sy, 1.2, tipZ + 1.4, headZ - tipZ - 1.4, P, 12), { tone: "hi", crease: "none", lit }));
  out.push(S(k.cylinder(sx, sy, 3.2, tipZ, 1.4, P, 18), { tone: "hi", lit }));
  out.push(S(k.slabOf({ x: hx - 7, y: hy - 7, w: 14, d: 14, r: 2 }, headZ, 14, P, 3, 0.5), { tone: "hi", crease: "lo", lit }));
  out.push(L(k.planOutline({ x: hx - 4, y: hy - 4, w: 8, d: 8, r: 1 }, headZ + 14, P, 2), { tone: "faint" }));
  return out.join("");
}

export function buildFigure() {
  const back = PANS.slice(0, 4).map((p, i) => panGroup(p, i)).join("");
  const front = PANS.slice(4).map((p, i) => panGroup(p, i + 4)).join("");
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A range with eight burners and a single stirring head on a gantry behind it. Pans sit on the burners; a pan with its lid on is simmering and needs nobody, a pan with an order ticket up is waiting for the cook. The head travels from pan to pan and stirs one at a time; plates pile up on the pass as dishes are served.",
    body: [plate(), gantryBack(), stove(), knobs(), back, front, pass(), `<g data-plates>${plateStack(0)}</g>`, `<g data-rig>${rigSvg(PARK[0], PARK[1], PAN_TOP + 24, false)}</g>`],
  });
}

export const GEOMETRY = { PANS, KNOBS, PARK, PAN_TOP, POT_TOP, PAN_R, RAIL_TOP };

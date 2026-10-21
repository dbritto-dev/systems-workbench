// A workshop: up to eight workbenches (cores) in two rows, a foreman's desk with a pallet of chunks
// waiting to be picked up, one shared tool on a rack, and one packing station everything passes through.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) through the workbench layer.
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -172, y: -104, w: 344, d: 186, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

export const BENCH = { w: 36, d: 22, h: 15 };
const BENCH_X = [-58, -14, 30, 74];
const ROW_Y = [-62, -2];
export const BENCHES = Array.from({ length: 8 }, (_, i) => {
  const row = i < 4 ? 0 : 1, cx = BENCH_X[i % 4], y0 = ROW_Y[row];
  return { i, row, cx, x0: cx - BENCH.w / 2, y0, cy: y0 + BENCH.d / 2, front: y0 + BENCH.d };
});
export const CRATE = { d: 12, maxH: 15, z: BENCH.h };
export const TOOL_REST = [-104, -21, 10];
export const PALLET = { x: -162, y: -50, w: 36, d: 46 };
export const PALLET_SLOTS = (() => {
  const out = [];
  for (const layer of [0, 1]) for (const yy of [-44, -33, -22, -11]) for (const xx of [-153, -136]) out.push([xx, yy, 3 + layer * 6]);
  return out;
})();
export const TRAY = { x: 112, y: -50, w: 22, d: 52, z: 15.5 };
export const TILES = (() => {
  const out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) out.push([TRAY.x + 1 + c * 5, TRAY.y + 1.5 + r * 6.3]);
  return out;
})();
export const PRESS = { cx: 147, cy: -26, top: 44, up: 32, down: 23 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [156, -44, 52], [-160, -92, 22]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -152, y: 58, w: 220, d: 7, r: 1 })
    + labelPlate(P, { x: 108, y: 52, w: 50, d: 18, r: 1.5 }, [[114, 57, 30], [114, 61, 38], [114, 65, 22]]);
}

function bench(b) {
  const out = [];
  const legY = { y: b.y0 + 2, d: BENCH.d - 4 };
  for (const lx of [b.x0 + 2, b.x0 + BENCH.w - 7]) out.push(S(k.slabOf({ x: lx, ...legY, w: 5, r: 0.8 }, 0, 12, P, 3, 0.3), { tone: "mid", inner: L(k.sideSeam({ x: lx, ...legY, w: 5, r: 0.8 }, 4, P, 3), { tone: "faint" }) }));
  out.push(S(k.slabOf({ x: b.x0 + 7, y: b.y0 + 4, w: BENCH.w - 14, d: BENCH.d - 8, r: 0.6 }, 3, 1.4, P, 2), { tone: "lo", crease: "none" }));
  const top = { x: b.x0, y: b.y0, w: BENCH.w, d: BENCH.d, r: 1.6 };
  out.push(S(k.slabOf(top, 12, 3, P, 3, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(top, 2.2), BENCH.h, P, 3), { tone: "faint" }));
  out.push(D([[b.x0 + 3.5, b.y0 + 3.5], [b.x0 + BENCH.w - 3.5, b.y0 + 3.5]].map(([x, y]) => at([x, y, BENCH.h])), { size: 0.4, tone: "lo" }));
  const vise = { x: b.x0 + BENCH.w - 9, y: b.front - 1, w: 6, d: 3.4, r: 0.6 };
  out.push(S(k.slabOf(vise, 10.5, 4.5, P, 2, 0.3), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(vise.x + 3, vise.y + vise.d + 1, 1, 12, 1.4, P, 12), { tone: "mid" }));
  return `<g data-bench="${b.i}">${out.join("")}<g data-cover style="display:none">${S(k.slabOf(k.insetPlan(top, -0.6), BENCH.h, 1.4, P, 3, 0.4), { tone: "lo" })}${L(k.planOutline(k.insetPlan(top, 3), BENCH.h + 1.4, P, 3), { tone: "faint" })}</g></g>`;
}

export function pawnSvg() {
  return S(k.cylinder(0, 0, 3.2, 0, 1.2, P, 20), { tone: "lo" })
    + S(k.cylinder(0, 0, 2.4, 1.2, 8.8, P, 20), { tone: "mid", crease: "none" })
    + S(k.cylinder(0, 0, 2.1, 10.4, 3, P, 20, 0.3), { tone: "hi", crease: "lo" });
}

// The shared tool: a heavy T-handle press on a square foot. One exists; whoever holds it, has it.
// The foreman: a worker with a flat-brimmed cap, so he reads as the one in charge.
function foremanSvg() {
  return pawnSvg()
    + S(k.cylinder(0, 0, 4.6, 13.2, 0.8, P, 24), { tone: "mid", crease: "none" })
    + S(k.cylinder(0, 0, 2.4, 14, 2, P, 20, 0.4), { tone: "mid", crease: "lo" });
}

export function toolSvg() {
  return S(k.slabOf({ x: -4.5, y: -4.5, w: 9, d: 9, r: 1 }, 0, 2.4, P, 2, 0.3), { tone: "mid" })
    + S(k.cylinder(0, 0, 1.3, 2.4, 9, P, 14), { tone: "mid", crease: "none" })
    + S(k.slabOf({ x: -6.5, y: -1.4, w: 13, d: 2.8, r: 1.2 }, 11.4, 2.6, P, 2, 0.3), { tone: "hi", crease: "lo" });
}

export function crateSvg(x0, y0, w, h, lit) {
  return S(k.slabOf({ x: x0, y: y0, w, d: CRATE.d, r: 0.6 }, CRATE.z, h, P, 2, 0.3), { tone: "hi", crease: "lo", lit });
}

function foreman() {
  const out = [];
  const desk = { x: -162, y: -94, w: 44, d: 20, r: 1.6 };
  out.push(S(k.slabOf(desk, 0, 14, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(desk, 9, P, 3), { tone: "faint" }) }));
  for (const [i, z] of [[0, 14], [1, 15.2], [2, 16.4]]) out.push(S(k.slabOf({ x: -156 + i * 0.6, y: -90, w: 14, d: 10, r: 0.3 }, z, 1, P, 2), { tone: "hi", crease: "lo" }));
  out.push(S(k.cylinder(-131, -84, 4, 14, 2, P, 28, 0.3), { tone: "hi", crease: "lo" }));
  const t = k.radialTicks(-131, -84, 3.4, 12, 3, 16, [0.6, 1.2], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(`<path data-clock class="iso-line" data-tone="hi" data-free="end" d=""/>`);
  out.push(`<g transform="${k.translateAlong(P, [-140, -66, 0])}">${foremanSvg()}</g>`);
  return out.join("");
}

function pallet() {
  const out = [];
  for (const y of [PALLET.y + 2, PALLET.y + PALLET.d - 6]) out.push(S(k.slabOf({ x: PALLET.x, y, w: PALLET.w, d: 4, r: 0.4 }, 0, 1.8, P, 2), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf({ ...PALLET, r: 0.6 }, 1.8, 1.2, P, 3, 0.3), { tone: "mid" }));
  for (let x = PALLET.x + 6; x < PALLET.x + PALLET.w - 2; x += 6) out.push(L(k.lineOnTop([x, PALLET.y], [x, PALLET.y + PALLET.d], 3, P), { tone: "faint" }));
  out.push(`<g data-pallet>${PALLET_SLOTS.map(([x, y, z], i) => `<g data-wait="${i}" style="display:none">${S(k.slabOf({ x: x - 6, y: y - 4.5, w: 12, d: 9, r: 0.5 }, z, 5.6, P, 2, 0.3), { tone: "hi", crease: "lo" })}</g>`).join("")}</g>`);
  return out.join("");
}

// Rack for the shared tool, with the tool's outline painted on top: an empty outline means someone has it.
function rack() {
  const [x, y] = TOOL_REST;
  const stand = { x: x - 7.5, y: y - 7.5, w: 15, d: 15, r: 1.2 };
  return S(k.slabOf(stand, 0, 2, P, 3, 0.3), { tone: "lo" })
    + S(k.slabOf(k.insetPlan(stand, 1.5), 2, 8, P, 3, 0.4), { tone: "mid" })
    + L(k.planOutline({ x: x - 4.8, y: y - 4.8, w: 9.6, d: 9.6, r: 1 }, 10, P, 2), { tone: "lo" });
}

// Queue rail beside the rack: a worker who needs the tool drops a token in the next slot and waits its turn.
export const QUEUE_SLOTS = (() => {
  const out = [];
  for (let r = 0; r < 8; r++) for (const c of [0, 1]) out.push([-108 + c * 5, -9.5 + r * 4]);
  return out;
})();
function queueRail() {
  const rail = { x: -111, y: -12, w: 11, d: 34, r: 1 };
  const out = [S(k.slabOf(rail, 0, 2.2, P, 3, 0.3), { tone: "lo" })];
  out.push(L(k.lineOnTop([-105.5, -11], [-105.5, 21], 2.2, P), { tone: "faint" }));
  out.push(D(QUEUE_SLOTS.map(([qx, qy]) => k.iso([qx, qy, 2.2], P)), { size: 0.35, tone: "faint" }));
  out.push(`<g data-queue>${QUEUE_SLOTS.map(([qx, qy], i) => `<g data-token="${i}" style="display:none">${S(k.cylinder(qx, qy, 1.6, 2.2, 2.4, P, 14, 0.2), { tone: "hi", crease: "lo" })}</g>`).join("")}</g>`);
  return out.join("");
}

function packing() {
  const out = [];
  const table = { x: 108, y: -56, w: 52, d: 64, r: 2 };
  out.push(S(k.slabOf(k.insetPlan(table, 2), 0, 12, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(k.insetPlan(table, 2), 6, P, 3), { tone: "faint" }) }));
  out.push(S(k.slabOf(table, 12, 3, P, 4, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf({ x: TRAY.x, y: TRAY.y, w: TRAY.w, d: TRAY.d, r: 1 }, 15, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline({ x: TRAY.x + 0.6, y: TRAY.y + 0.6, w: TRAY.w - 1.2, d: TRAY.d - 1.2, r: 0.6 }, 15.8, P, 2), { tone: "faint" }));
  out.push(`<g data-tiles>${TILES.map(([x, y], i) => `<g data-tile="${i}" style="display:none">${S(k.slabOf({ x, y, w: 4, d: 5, r: 0.4 }, 15.8, 1.6, P, 2), { tone: "hi", crease: "lo" })}</g>`).join("")}</g>`);
  const platen = { x: 139, y: -36, w: 16, d: 22, r: 1 };
  out.push(S(k.slabOf(platen, 15, 2.4, P, 3, 0.4), { tone: "mid" }));
  const column = { x: 140, y: -46, w: 14, d: 6, r: 1 };
  out.push(S(k.slabOf(column, 15, PRESS.top - 15, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(column, 30, P, 3), { tone: "faint" }) }));
  out.push(`<g data-product style="display:none">${S(k.slabOf({ x: PRESS.cx - 5, y: PRESS.cy - 5, w: 10, d: 10, r: 0.6 }, 17.4, 3.4, P, 2, 0.3), { tone: "hi", crease: "lo" })}</g>`);
  out.push(`<g data-rod></g><g data-ram></g>`);
  const head = { x: 138, y: -46, w: 18, d: 27, r: 1.4 };
  out.push(S(k.slabOf(head, PRESS.top, 6, P, 3, 0.6), { tone: "mid" }));
  out.push(D([[head.x + 3, head.y + 3], [head.x + head.w - 3, head.y + 3], [head.x + 3, head.y + head.d - 3], [head.x + head.w - 3, head.y + head.d - 3]].map(([x, y]) => at([x, y, PRESS.top + 6])), { size: 0.45 }));
  return out.join("");
}

export function ramSvg(z, lit) {
  return S(k.slabOf({ x: PRESS.cx - 5.5, y: PRESS.cy - 5.5, w: 11, d: 11, r: 0.8 }, z, 4, P, 2, 0.4), { tone: "hi", crease: "lo", lit });
}
export function rodSvg(z) {
  return S(k.cylinder(PRESS.cx, PRESS.cy, 1.8, z + 4, PRESS.top - z - 4, P, 14), { tone: "mid", crease: "none" });
}

export function needleAt(turn) {
  const a = turn * Math.PI * 2, x = -131, y = -84;
  return k.lineOnTop([x, y], [x + Math.sin(a) * 2.9, y - Math.cos(a) * 2.9], 16.2, P);
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A workshop on a base plate. A foreman at a desk splits each job into chunks and sets them on a pallet. Workers at up to eight workbenches pick chunks up and work on them at the same time. One shared T-handled tool sits on a rack in the aisle and can only be used at one bench at a time; workers waiting for it drop tokens on a queue rail beside the rack. Every finished chunk goes to a single packing station, which merges them and presses the finished job alone.",
    body: [
      plate(),
      foreman(),
      BENCHES.filter((b) => b.row === 0).map(bench).join(""),
      `<g data-crates="0"></g><g data-anchor="tool-0"></g><g data-pawns="0"></g>`,
      pallet(),
      rack(),
      `<g data-anchor="tool-rack"><g data-tool>${toolSvg()}</g></g>`,
      queueRail(),
      BENCHES.filter((b) => b.row === 1).map(bench).join(""),
      `<g data-crates="1"></g><g data-anchor="tool-1"></g><g data-pawns="1"></g>`,
      packing(),
    ],
  });
}

export const GEOMETRY = { QUEUE_SLOTS, BENCHES, BENCH, CRATE, TOOL_REST, PALLET_SLOTS, TILES, PRESS };

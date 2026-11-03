// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A typesetting bench. The page is a galley tray of type blocks (the boxes on the page); at its front, fenced off, the
// list the handler works on, one block per item. A measuring gantry rides on rails over the galley: every pass is one
// layout, measuring every block it crosses. At the back, the script's desk: a clerk, a card with the item in hand, a
// READ and a WRITE lamp, and the rAF tray where deferred callbacks wait. In front, the pipeline console (one lamp and
// one ms counter per step: JS, style, layout, paint, composite) and the frame strip, one bar per frame against the
// 16.7 ms line. Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, labelPlate, digitCounter, lamp, person, faceText, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { TRAY_H, LIST, ITEM_SLOTS, ITEM_H, STRIP, STRIP_H, BARS, BUDGET_Z, itemSvg, barSvg } from "./blocks";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -178, y: -104, w: 302, d: 138, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The galley: a tray of node blocks at the back, the list at the front.
const GALLEY = { x: -92, y: -84, w: 170, d: 70, r: 1.6 };
export const NODE_GRID = { x0: -88, y0: -80, cols: 24, rows: 6, dx: 6.75, dy: 6, w: 5, d: 4.4, h: 2.6 };
export const NODE_BLOCKS = NODE_GRID.cols * NODE_GRID.rows;                     // 144 blocks stand for the page
const FENCE = { x: -91, y: -42.5, w: 168, d: 26.5, h: 4, t: 1 };

// The gantry rides along y over the galley; its rest position is behind it. Sweeps: the whole page, or the list.
const RAIL_X = [-100, 82];
const RAIL = { y: -98, d: 86, w: 4 };
export const GANTRY = { rest: -94, z: 21, beam: 4 };
export const SWEEP = { page: [-82, -16], list: [-42, -16] };

// The script's desk at the back left.
const DESK = { x: -170, y: -56, w: 60, d: 26, r: 1.4 };
const DESK_H = 11;
const DESK_FRONT = DESK.y + DESK.d;
export const CLERK = [DESK.x + 8, DESK_FRONT + 9, 0];
export const LAMPS = { read: [-152, DESK_FRONT - 6, DESK_H], write: [-135, DESK_FRONT - 6, DESK_H] };
const TRAY = { x: -123, y: DESK.y + 4, w: 11, d: 17, r: 0.8 };
export const SLIPS = 10;
export const SLIP = { x: TRAY.x + 1.4, y: TRAY.y + 1.6, w: TRAY.w - 2.8, d: TRAY.d - 3.2, h: 0.7, z: DESK_H + 1 };

// The pipeline console and the frame strip, in front.
const CONSOLE = { x: -150, y: 9, w: 226, d: 12, r: 1.4 };
const CONSOLE_H = 10;
export const STAGES = ["js", "style", "layout", "paint", "composite"];
const STAGE_W = CONSOLE.w / STAGES.length;
export const stageX = (i) => CONSOLE.x + STAGE_W * (i + 0.5);

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [RAIL_X[0], RAIL.y, GANTRY.z + GANTRY.beam + 2], [RAIL_X[1] + 6, RAIL.y, GANTRY.z + GANTRY.beam + 2], [DESK.x + 14, DESK.y - 6, 26], [BARS.x, BARS.y0, STRIP_H + BARS.max + 2]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 50 },
);

const { S, L, D, at } = shorthand(P);
const slab = (plan, z, h, steps = 3, bevel = 0) => k.slabOf({ r: 0.4, ...plan }, z, h, P, steps, bevel);
const text = (x, y, z, words, size = 2.4, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + labelPlate(P, { x: 88, y: 12, w: 24, d: 13, r: 1.4 }, [[92, 17, 15], [92, 21, 10]]);
}

// ---------- the desk ----------
// The clerk in front of the desk, holding the slip with the item in hand (the live code writes its number).
function clerk() {
  return person(P, CLERK, { scale: 1, hat: "cap", holding: "slip", slipText: "1", slipAttr: "data-item-text" });
}
function desk() {
  const out = [S(k.slabOf(DESK, 0, DESK_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(DESK, 2), DESK_H, P), { tone: "faint" }));
  // the READ and WRITE lamps
  for (const [name, p] of Object.entries(LAMPS)) {
    out.push(`<g data-lamp="${name}">${lamp(P, p, { r: 2.4 })}</g><g data-lamp-on="${name}" style="display:none">${litFill(lamp(P, p, { r: 2.4, lit: true }))}</g>`);
  }
  out.push(text(LAMPS.read[0], DESK_FRONT, 5.6, t("READ", "LECTURA"), 2.4, { anchor: "middle" }));
  out.push(text(LAMPS.write[0], DESK_FRONT, 5.6, t("WRITE", "ESCRITURA"), 2.4, { anchor: "middle" }));
  // the rAF tray: deferred callbacks wait here as slips
  out.push(S(k.slabOf(TRAY, DESK_H, 1, P, 2, 0.2), { tone: "lo", inner: L(k.planOutline(k.insetPlan(TRAY, 1), DESK_H + 1, P), { tone: "faint" }) }));
  out.push(text(TRAY.x + TRAY.w / 2, DESK_FRONT, 5.6, "rAF", 2.4, { anchor: "middle" }));
  return out.join("");
}
export function slipSvg(n) {
  return S(slab({ x: SLIP.x, y: SLIP.y, w: SLIP.w, d: SLIP.d, r: 0.3 }, SLIP.z + n * SLIP.h, SLIP.h * 0.8, 1), { tone: "hi", crease: "lo" });
}
function slips() {
  return Array.from({ length: SLIPS }, (_, n) => `<g data-slip="${n}" style="display:none">${slipSvg(n)}</g>`).join("");
}

// ---------- the galley ----------
function rails() {
  return RAIL_X.map((x) => S(k.slabOf({ x, y: RAIL.y, w: RAIL.w, d: RAIL.d, r: 0.6 }, 0, 2, P, 2), { tone: "lo", crease: "none" })
    + L(k.lineOnTop([x + RAIL.w / 2, RAIL.y + 1], [x + RAIL.w / 2, RAIL.y + RAIL.d - 1], 2, P), { tone: "mid" })).join("");
}
function galley() {
  const out = [S(k.slabOf(GALLEY, 0, TRAY_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(GALLEY, 2), TRAY_H, P), { tone: "lo" }) })];
  const front = GALLEY.y + GALLEY.d;
  out.push(digitCounter(P, { x: GALLEY.x + 6, y: front, z: 1.4, count: 3, w: 3.6, h: 4.4, gap: 0.5, pad: 0.8, name: "layouts" }));
  out.push(text(GALLEY.x + 20.6, front, 2.2, t("LAYOUTS", "LAYOUTS"), 2.4));
  out.push(digitCounter(P, { x: GALLEY.x + 52, y: front, z: 1.4, count: 3, w: 3.6, h: 4.4, gap: 0.5, pad: 0.8, name: "forced" }));
  out.push(text(GALLEY.x + 66.6, front, 2.2, t("FORCED", "FORZADOS"), 2.4));
  out.push(digitCounter(P, { x: GALLEY.x + 104, y: front, z: 1.4, count: 4, w: 3.6, h: 4.4, gap: 0.5, pad: 0.8, name: "boxes" }));
  out.push(text(GALLEY.x + 123, front, 2.2, t("BOXES", "CAJAS"), 2.4));
  return out.join("");
}
export function nodeAt(n) {
  // back rows first: a small page fills the back of the galley, a big one reaches the list
  const row = Math.floor(n / NODE_GRID.cols), col = n % NODE_GRID.cols;
  return [NODE_GRID.x0 + col * NODE_GRID.dx, NODE_GRID.y0 + row * NODE_GRID.dy];
}
function nodes() {
  // painter's order: back rows first
  const out = [];
  for (let row = 0; row < NODE_GRID.rows; row++) {
    for (let col = 0; col < NODE_GRID.cols; col++) {
      const n = row * NODE_GRID.cols + col;
      const [x, y] = nodeAt(n);
      out.push(`<g data-node="${n}">${S(slab({ x, y, w: NODE_GRID.w, d: NODE_GRID.d, r: 0.5 }, TRAY_H, NODE_GRID.h, 2, 0.2), { tone: "hi", crease: "lo" })}</g>`);
    }
  }
  return out.join("");
}
function items() {
  // back row first, left to right
  return Array.from({ length: ITEM_SLOTS }, (_, s) => `<g data-item="${s}">${itemSvg(P, s, ITEM_H.min + 1)}</g>`).join("");
}
// The fence (contain: strict): back and left walls before the items, right and front walls after.
function fenceWall(which) {
  const { x, y, w, d, h, t: th } = FENCE;
  const plan = { back: { x, y, w, d: th }, left: { x, y, w: th, d }, right: { x: x + w - th, y, w: th, d }, front: { x, y: y + d - th, w, d: th } }[which];
  return S(slab({ ...plan, r: 0.2 }, TRAY_H, h, 2), { tone: "hi", crease: "lo" });
}
function fenceFront() {
  return fenceWall("right") + fenceWall("front")
    + text(FENCE.x + FENCE.w - 3, FENCE.y + FENCE.d, TRAY_H + 0.9, "CONTAIN", 2.2, { anchor: "end", tone: "hi" });
}

// ---------- the gantry ----------
export function gantrySvg(lit) {
  const y = GANTRY.rest, out = [];
  const leg = (x) => S(slab({ x: x + 0.4, y: y - 2, w: RAIL.w - 0.8, d: 4 }, 2, GANTRY.z - 2, 2), { tone: "mid", crease: "none" });
  const beam = S(slab({ x: RAIL_X[0] - 1, y: y - 2.6, w: RAIL_X[1] - RAIL_X[0] + RAIL.w + 2, d: 5.2, r: 0.8 }, GANTRY.z, GANTRY.beam, 3, 0.4), { tone: "hi", crease: "lo", lit });
  // the measuring comb under the beam: one feeler every 8 units
  const comb = [];
  for (let x = GALLEY.x + 4; x < GALLEY.x + GALLEY.w - 2; x += 8) comb.push(k.segment([x, y, GANTRY.z], [x, y, GANTRY.z - 4], P));
  out.push(leg(RAIL_X[0]));
  out.push(L(comb.join(""), { tone: lit ? "hi" : "mid" }));
  out.push(lit ? litFill(beam) : beam);
  out.push(leg(RAIL_X[1]));
  return out.join("");
}
function gantry() {
  return `<g data-gantry><g data-gantry-off>${gantrySvg(false)}</g><g data-gantry-on style="display:none">${gantrySvg(true)}</g></g>`;
}

// ---------- the console ----------
const LABELS = {
  js: "JS",
  style: t("STYLE", "ESTILO"),
  layout: "LAYOUT",
  paint: t("PAINT", "PINTADO"),
  composite: t("COMPOSITE", "COMPOSICIÓN"),
};
function console_() {
  const out = [S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 3, 0.5), { tone: "mid" })];
  const front = CONSOLE.y + CONSOLE.d;
  for (let i = 1; i < STAGES.length; i++) {
    const x = CONSOLE.x + STAGE_W * i;
    out.push(L(k.lineOnTop([x, CONSOLE.y + 2], [x, CONSOLE.y + CONSOLE.d - 2], CONSOLE_H, P) + k.segment([x, front, 1.5], [x, front, CONSOLE_H - 1.5], P), { tone: "faint" }));
  }
  STAGES.forEach((name, i) => {
    const x = stageX(i), p = [x - 14, CONSOLE.y + 5, CONSOLE_H];   // the lamp at the left of its station, clear of the words
    out.push(`<g data-stage="${name}">${lamp(P, p, { r: 2.4 })}</g><g data-stage-on="${name}" style="display:none">${litFill(lamp(P, p, { r: 2.4, lit: true }))}</g>`);
    out.push(text(x + 3, front, 6.9, LABELS[name], 2.4, { anchor: "middle" }));
    out.push(digitCounter(P, { x: x - 4.6, y: front, z: 1, count: 4, w: 3.2, h: 3.4, gap: 0.4, pad: [0.7, 0.6, 0.4], name: "ms-" + name }));
    out.push(text(x + 11.8, front, 1.4, "ms", 2.2));
  });
  return out.join("");
}

// ---------- the frame strip ----------
function strip() {
  const out = [S(k.slabOf(STRIP, 0, STRIP_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(STRIP, 2), STRIP_H, P), { tone: "faint" }));
  const side = STRIP.x + STRIP.w;
  out.push(digitCounter(P, { x: side, y: STRIP.y + STRIP.d - 6, z: 2.2, count: 4, face: "x", w: 3.8, h: 4.8, gap: 0.5, pad: 0.9, name: "frame" }));
  out.push(faceText(P, [side, STRIP.y + STRIP.d - 25.6, 3.2], t("LAST FRAME, ms", "ÚLTIMO CUADRO, ms"), { face: "x", size: 2.4, tone: "mid" }));
  return out.join("");
}
function bars() {
  return Array.from({ length: BARS.n }, (_, i) => `<g data-bar="${i}">${barSvg(P, i, 0.4)}</g>`).join("");
}
// The budget line: a rod at 16.7 ms on two posts, through the middle of the bars.
function budget() {
  const x = BARS.x + BARS.w / 2, y0 = BARS.y0 - 4, y1 = BARS.y0 + (BARS.n - 1) * BARS.dy + BARS.d + 3;
  const out = [];
  for (const y of [y0, y1]) out.push(S(k.cylinder(x, y, 0.6, STRIP_H, BUDGET_Z - STRIP_H + 0.6, P, 10), { tone: "mid", crease: "none" }));
  out.push(L(k.segment([x, y0, BUDGET_Z], [x, y1, BUDGET_Z], P), { tone: "hi" }));
  // its label on a small plate at the back post, facing right
  out.push(S(slab({ x: x + 0.8, y: y0 - 7, w: 1, d: 14, r: 0.2 }, BUDGET_Z - 2, 4, 2), { tone: "hi", crease: "lo" }));
  out.push(faceText(P, [x + 1.8, y0 + 6, BUDGET_Z - 0.9], "16.7 ms", { face: "x", size: 2.4, tone: "hi" }));
  return out.join("");
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A typesetting bench on a base plate. In the middle, a galley tray of type blocks stands for the page; its front rows, which a low fence can close off, are the list a handler works on, one block per item. A measuring gantry rides on rails over the galley: each pass is one layout, measuring every block it crosses, and it lights when a read forced it to run in the middle of the script. Counters on the galley count the layouts and forced layouts of the current frame, and the boxes on the page. At the back left, the script's desk: a clerk, a card with the item in hand, a READ and a WRITE lamp, and the tray where requestAnimationFrame callbacks wait. In front, a console with one lamp and one millisecond counter for each step of a frame (JavaScript, style, layout, paint, composite), and a strip of bars, one per frame, against a line at 16.7 ms.",
      "Un banco de tipografía sobre una placa base. En el medio, una bandeja de bloques de tipos representa la página; sus filas delanteras, que una cerca baja puede aislar, son la lista que recorre un handler, un bloque por ítem. Un pórtico de medición corre sobre rieles por encima de la bandeja: cada pasada es un layout que mide cada bloque que cruza, y se ilumina cuando una lectura lo obligó a correr en medio del script. Contadores en la bandeja cuentan los layouts y los layouts forzados del cuadro actual, y las cajas de la página. Atrás a la izquierda, el escritorio del script: un empleado, una tarjeta con el ítem en mano, una lámpara LECTURA y otra ESCRITURA, y la bandeja donde esperan los callbacks de requestAnimationFrame. Adelante, una consola con una lámpara y un contador de milisegundos por cada paso de un cuadro (JavaScript, estilo, layout, pintado, composición) y una tira de barras, una por cuadro, contra una línea en 16.7 ms.",
    ),
    body: [
      plate(),
      desk(),
      clerk(),
      `<g data-layer="slips">${slips()}</g>`,
      rails(),
      galley(),
      nodes(),
      `<g data-fence style="display:none">${fenceWall("back")}${fenceWall("left")}</g>`,
      `<g data-layer="items">${items()}</g>`,
      `<g data-fence style="display:none">${fenceFront()}</g>`,
      gantry(),
      console_(),
      strip(),
      `<g data-layer="bars">${bars()}</g>`,
      budget(),
    ],
  });
}

export const GEOMETRY = { NODE_BLOCKS, ITEM_SLOTS, ITEM_H, GANTRY, SWEEP, STAGES, BARS, SLIPS };

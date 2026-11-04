// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A reading window over a tile belt. The belt is the list: each tile is a row, laid end to end in list order, and
// scrolling slides the belt under a window frame, the viewport. A windowed list puts tiles only on the stretch around
// the window (the stops on the belt's lip mark that stretch); the bare belt beyond is the empty spacer that keeps the
// scrollbar honest. Any part of the window with no tile under it lights up: a blank frame. Behind, the scrollbar rail
// stands for the whole list; on the DOM cabinet, counters for the rows in the DOM and the first render; on the console
// in front, blank frames, content jumps and a meter for the main thread's share of each frame. The reader in front
// holds a slip with how many of the search word's rows Ctrl+F can find.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, labelPlate, digitCounter, meter, lamp, plaque, person, faceText, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { KINDS, ROW } from "./sim";

export const WIDTH = 700;
export const HEIGHT = 440;
export const PX = 10;                                       // list pixels per world unit along the belt

const PLATE = { x: -170, y: -80, w: 210, d: 134, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The belt (the list), the tiles on it, and the window (the viewport: 480 px = 48 units).
export const BELT = { x0: -152, x1: 14, y0: -16, y1: 8, h: 10 };
export const TILE = { y0: -13, y1: 5, h: 1.4 };
export const WIN = { x0: -96, x1: -48 };
// The backboard behind the window, with VIEWPORT on it and the blank lamp on top.
const BOARD = { x0: WIN.x0 - 2, x1: WIN.x1 + 2, y0: BELT.y0 - 3.2, y1: BELT.y0 - 1, h: 21 };

// The scrollbar rail, high behind the belt: the whole list, end to end.
export const RAIL = { x0: BELT.x0 + 2, x1: -50, y: -36, z: 26 };
// The DOM cabinet at the back right and the frame console in front.
const CAB = { x: -36, y: -74, w: 62, d: 22, r: 2 };
const CAB_H = 25;
const CON = { x: -44, y: 18, w: 76, d: 30, r: 2 };
const CON_H = 10;
export const READER = [-140, 30];

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [RAIL.x0, RAIL.y - 3, RAIL.z + 6], [BOARD.x0, BOARD.y0, BOARD.h + 6], [CAB.x, CAB.y, CAB_H + 2], [CAB.x + CAB.w, CAB.y, CAB_H + 2], [READER[0], READER[1], 24]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

const { S, L, D, at } = shorthand(P);
const text = (x, y, z, words, size = 2.4, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + labelPlate(P, { x: -150, y: -70, w: 36, d: 14, r: 1.5 }, [[-145, -65, 24], [-145, -61, 16]]);
}

// The belt: a long bed with rollers under where the tiles ride; the window's footprint is marked on it.
function belt() {
  const bed = { x: BELT.x0, y: BELT.y0, w: BELT.x1 - BELT.x0, d: BELT.y1 - BELT.y0, r: 1.2 };
  const out = [S(k.slabOf(bed, 0, BELT.h, P, 3, 0.5), { tone: "mid" })];
  const rollers = [];
  for (let x = bed.x + 3; x < bed.x + bed.w - 2; x += 4) rollers.push(k.lineOnTop([x, TILE.y0 + 0.6], [x, TILE.y1 - 0.6], BELT.h, P));
  out.push(L(rollers.join(""), { tone: "faint" }));
  out.push(L(k.lineOnTop([bed.x + 1.5, TILE.y1 + 0.9], [bed.x + bed.w - 1.5, TILE.y1 + 0.9], BELT.h, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([bed.x + 1.5, TILE.y0 - 0.9], [bed.x + bed.w - 1.5, TILE.y0 - 0.9], BELT.h, P), { tone: "lo" }));
  out.push(L(k.planOutline({ x: WIN.x0, y: TILE.y0 - 0.6, w: WIN.x1 - WIN.x0, d: TILE.y1 - TILE.y0 + 1.2, r: 0.3 }, BELT.h, P, 2), { tone: "mid" }));
  out.push(text(BELT.x0 + 4, BELT.y1, 5.2, t("LIST", "LISTA"), 3));
  return out.join("");
}

// The clip for the tiles: the belt top, so a tile sliding off either end is cut at the end, not drawn in the air.
function beltClip() {
  const pts = k.boxCorners({ x: BELT.x0 + 0.6, y: TILE.y0 - 1, w: BELT.x1 - BELT.x0 - 1.2, d: TILE.y1 - TILE.y0 + 2 }, BELT.h - 0.5, BELT.h + TILE.h + 4).map(at);
  return `<defs><clipPath id="vz-belt-clip"><path d="${k.pathOf(hull(pts), true)}"/></clipPath></defs>`;
}
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}

// The window: a backboard behind the belt with VIEWPORT on it and the blank lamp on top, and a flat frame on the
// belt's lips, just above the tiles: a crossbar at the viewport's top and bottom edges and a low sill in front.
const FZ = BELT.h + TILE.h + 0.5;
export const LAMP_AT = [(BOARD.x0 + BOARD.x1) / 2, (BOARD.y0 + BOARD.y1) / 2, BOARD.h];
function board() {
  const plan = { x: BOARD.x0, y: BOARD.y0, w: BOARD.x1 - BOARD.x0, d: BOARD.y1 - BOARD.y0, r: 0.4 };
  const out = [S(k.slabOf(plan, 0, BOARD.h, P, 2, 0.3), { tone: "hi", crease: "lo" })];
  out.push(L(k.faceRectY(P, BOARD.x0 + 1.4, BOARD.x1 - 1.4, BOARD.y1, BELT.h + 1.4, BOARD.h - 1.4), { tone: "lo" }));
  out.push(text((BOARD.x0 + BOARD.x1) / 2, BOARD.y1, BOARD.h - 6.4, "VIEWPORT", 3.6, { anchor: "middle" }));
  return out.join("");
}
function blankLamp() {
  return `<g data-lamp="off">${lamp(P, LAMP_AT, { r: 2.4 })}</g><g data-lamp="on" style="display:none">${litFill(lamp(P, LAMP_AT, { r: 2.4, lit: true }))}</g>`;
}
function frameBack() {
  const x0 = WIN.x0 - 1.2, x1 = WIN.x1 + 1.2, y0 = BELT.y0 + 0.3;
  return S(k.slabOf({ x: x0, y: y0, w: x1 - x0, d: TILE.y0 - 0.5 - y0, r: 0.3 }, BELT.h, FZ + 1 - BELT.h, P, 2), { tone: "hi", crease: "none" });
}
function frame() {
  const x0 = WIN.x0 - 1.2, x1 = WIN.x1 + 1.2, y0 = BELT.y0 + 0.3, y1 = TILE.y1 + 2, out = [];
  for (const x of [x0, WIN.x1]) out.push(S(k.slabOf({ x, y: y0, w: 1.2, d: y1 - y0, r: 0.3 }, FZ, 1, P, 2), { tone: "hi", crease: "none" }));
  out.push(S(k.slabOf({ x: x0, y: TILE.y1 + 0.5, w: x1 - x0, d: y1 - TILE.y1 - 0.5, r: 0.3 }, BELT.h, FZ + 1 - BELT.h, P, 2), { tone: "hi", crease: "lo" }));
  return out.join("");
}

// The scrollbar: a rail on two legs behind the belt, and the thumb (drawn by the live code, its length depends on
// the list's height).
function rail() {
  const plan = { x: RAIL.x0, y: RAIL.y - 3, w: RAIL.x1 - RAIL.x0, d: 6, r: 1 };
  const out = [];
  for (const x of [RAIL.x0 + 8, RAIL.x1 - 6]) out.push(S(k.slabOf({ x: x - 1.5, y: RAIL.y - 1.5, w: 3, d: 3, r: 0.4 }, 0, RAIL.z, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf(plan, RAIL.z, 3.6, P, 3, 0.3), { tone: "mid" }));
  out.push(L(k.lineOnTop([plan.x + 1.5, RAIL.y], [plan.x + plan.w - 1.5, RAIL.y], RAIL.z + 3.6, P), { tone: "lo" }));
  out.push(text(RAIL.x1 - 26, RAIL.y + 3, RAIL.z + 0.7, "SCROLLBAR", 2.4));
  return out.join("");
}

// The DOM cabinet: rows in the DOM and the first render, in ms.
function cabinet() {
  const out = [S(k.slabOf(CAB, 0, CAB_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(CAB, 2.4), CAB_H, P), { tone: "faint" }));
  const front = CAB.y + CAB.d;
  out.push(digitCounter(P, { x: CAB.x + 4, y: front, z: 14.6, count: 5, w: 4.4, h: 6, gap: 0.6, pad: 1.1, name: "dom" }));
  out.push(text(CAB.x + 32.5, front, 18.6, t("ROWS", "FILAS"), 2.4));
  out.push(text(CAB.x + 32.5, front, 15.4, t("IN THE DOM", "EN EL DOM"), 2.4));
  out.push(digitCounter(P, { x: CAB.x + 4, y: front, z: 3.4, count: 4, w: 4.4, h: 6, gap: 0.6, pad: 1.1, name: "first" }));
  out.push(text(CAB.x + 27.5, front, 7.4, t("FIRST RENDER", "PRIMER RENDER"), 2.4));
  out.push(text(CAB.x + 27.5, front, 4.2, "ms", 2.4));
  return out.join("");
}

// The console: blank frames and content jumps on the front, the main-thread meter on the side.
function console_() {
  const out = [S(k.slabOf(CON, 0, CON_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(CON, 2.4), CON_H, P), { tone: "faint" }));
  const front = CON.y + CON.d;
  out.push(digitCounter(P, { x: CON.x + 3.4, y: front, z: 3, count: 4, w: 4, h: 5.4, gap: 0.6, pad: 1, name: "blank" }));
  out.push(text(CON.x + 25, front, 4.6, t("BLANK", "EN BLANCO"), 2.4));
  out.push(digitCounter(P, { x: CON.x + 45, y: front, z: 3, count: 3, w: 4, h: 5.4, gap: 0.6, pad: 1, name: "jumps" }));
  out.push(text(CON.x + 61.5, front, 4.6, t("JUMPS", "SALTOS"), 2.4));
  const side = CON.x + CON.w;
  out.push(meter(P, { x: side, y: CON.y + CON.d - 8, z: 1.6, r: 6, face: "x", ticks: 10, zone: 0.8, name: "main" }));
  out.push(faceText(P, [side, CON.y + CON.d - 15, 6.2], t("MAIN", "HILO"), { face: "x", size: 2.2, tone: "mid" }));
  out.push(faceText(P, [side, CON.y + CON.d - 15, 3.2], t("THREAD", "PRINCIPAL"), { face: "x", size: 2.2, tone: "mid" }));
  return out.join("");
}

// The reader, with the Ctrl+F slip: how many of the word's rows are in the DOM to be found.
function reader() {
  return person(P, [READER[0], READER[1], 0], { scale: 0.85, holding: "slip", slipText: "40/40", slipAttr: "data-found" })
    + plaque(P, { x: READER[0] + 7, y: READER[1] + 2, z: 0, w: 15, d: 7, text: "CTRL+F", size: 2.6 });
}

// A row: a tile at the origin, len units long along x (its height in the list), drawn for each row height. On top:
// the row number, a line per line of text (or a picture), and the search word's mark, hidden unless the row has it.
export function tileSvg(kind) {
  const len = KINDS[kind] / PX;
  const plan = { x: 0.25, y: TILE.y0, w: len - 0.5, d: TILE.y1 - TILE.y0, r: 0.4 };
  const z = TILE.h;
  const out = [litFill(S(k.slabOf(plan, 0, z, P, 2, 0.2), { tone: "hi", crease: "lo" })).replace('class="iso-solid"', 'class="iso-solid" data-body')];
  out.push(faceText(P, [3.3, TILE.y0 + 1.4, z], "0", { face: "top", along: "y", size: 2.8, tone: "hi", anchor: "end", attr: "data-num" }));
  const lines = [];
  if (kind === 4) {
    lines.push(k.planOutline({ x: 5.2, y: TILE.y0 + 1.6, w: len - 6.6, d: TILE.y1 - TILE.y0 - 3.2, r: 0.3 }, z, P, 2));
    lines.push(k.lineOnTop([5.6, TILE.y1 - 2.2], [len - 5, TILE.y0 + 5], z, P), k.lineOnTop([len - 5, TILE.y0 + 5], [len - 2.2, TILE.y1 - 4], z, P));
  } else for (let j = 0; j < kind; j++) lines.push(k.lineOnTop([5.6 + 2.4 * j, TILE.y0 + 1.6], [5.6 + 2.4 * j, TILE.y1 - 2 - 2.2 * ((j * 7) % 3)], z, P));
  if (lines.length) out.push(`<g data-lines>${L(lines.join(""), { tone: "lo" })}</g>`);
  out.push(`<g data-hit style="display:none">${S(k.cylinder(2.4, TILE.y1 - 2.4, 1.2, z, 0.8, P, 14), { tone: "mid", crease: "none" })}</g>`);
  return `<g data-kind="${kind}">${out.join("")}</g>`;
}

// A range stop: a pin on the belt's back lip, at the origin.
export const STOP_Y = [BELT.y0 + 0.5, TILE.y0 - 0.9];
export function stopSvg() {
  return S(k.slabOf({ x: -0.7, y: STOP_Y[0], w: 1.4, d: STOP_Y[1] - STOP_Y[0], r: 0.3 }, BELT.h, 4.5, P, 2), { tone: "hi", crease: "lo" });
}

// The scrollbar thumb, len units long, at the origin of the rail.
export function thumbSvg(len) {
  return S(k.slabOf({ x: 0, y: RAIL.y - 2, w: len, d: 4, r: 0.6 }, RAIL.z + 3.6, 2, P, 2, 0.2), { tone: "hi", crease: "lo" });
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A reading window over a tile belt, on a base plate. The belt is the list: numbered tiles, one per row, lie end to end and slide under a window frame marked VIEWPORT as the list scrolls. Only the stretch of belt around the window carries tiles when the list is windowed; two stops on the belt's lip mark that stretch, and the rest of the belt is bare. A lamp on the frame lights when part of the window has no tile under it. Behind the belt, a rail with a thumb is the scrollbar. A cabinet at the back counts the rows in the DOM and the first render in milliseconds; a console in front counts blank frames and content jumps and has a main-thread meter. A reader stands at the left holding a Ctrl+F slip with how many of the search word's rows the browser can find.",
      "Una ventana de lectura sobre una cinta de fichas, en una placa base. La cinta es la lista: fichas numeradas, una por fila, van una tras otra y se deslizan bajo un marco de ventana rotulado VIEWPORT a medida que la lista hace scroll. Con la lista virtualizada, solo el tramo de cinta alrededor de la ventana lleva fichas; dos topes en el borde de la cinta marcan ese tramo, y el resto de la cinta queda vacío. Una lámpara en el marco se enciende cuando parte de la ventana no tiene ficha debajo. Detrás de la cinta, un riel con un cursor es la barra de scroll. Un gabinete al fondo cuenta las filas en el DOM y el primer render en milisegundos; una consola adelante cuenta los cuadros en blanco y los saltos del contenido, y tiene un medidor del hilo principal. Un lector, a la izquierda, sostiene una nota de Ctrl+F con cuántas de las filas con la palabra buscada puede encontrar el navegador.",
    ),
    body: [
      beltClip(),
      plate(),
      cabinet(),
      rail(),
      `<g data-thumb></g>`,
      board(),
      blankLamp(),
      belt(),
      `<path class="vz-range" data-range d=""/>`,
      `<g data-layer="blank"></g>`,
      frameBack(),
      `<g data-stop="0" style="display:none">${stopSvg()}</g><g data-stop="1" style="display:none">${stopSvg()}</g>`,
      `<g data-layer="tiles" clip-path="url(#vz-belt-clip)"></g>`,
      frame(),
      console_(),
      reader(),
    ],
  });
}

export const GEOMETRY = { PX, BELT, TILE, WIN, RAIL, ROW, STOP_Y };

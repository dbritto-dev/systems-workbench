// An assay bench for BM25.
//   At the back, the query's terms stand on a rack as brass weights: the rarer the term, the bigger the weight
//   (its IDF). An assayer behind the rack picks them up in turn.
//   In front, five scales hold the five best documents, best on the left. For every query term a document
//   contains, a disc of that term's size goes into its pan; the disc's thickness is what the term adds to the
//   score: more occurrences make it thicker, but less and less (saturation), and a long document gets a thinner
//   disc (length normalisation). Each scale shows its rank, its document, its score on wheels, and a length gauge.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate, digitCounter, person, meter, faceText } from "../../workbench/parts.mjs";
import { t } from "../../workbench/i18n.mjs";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -136, y: -94, w: 272, d: 128, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// the weights rack (back left): up to four query terms
const SHELF = { x: -128, y: -74, w: 138, d: 16, r: 1 };
const SHELF_H = 10;
export const SHELF_X = [SHELF.x + 3, SHELF.x + SHELF.w - 3];
const SLOT0 = SHELF.x + 17;
export const SLOT_Y = SHELF.y + SHELF.d / 2;
export const SHELF_TOP = SHELF_H;
export const SHELF_FRONT = SHELF.y + SHELF.d;
export const ASSAYER_Y = SHELF.y - 8;

// the query board (back right)
const BOARD = { x: 22, y: -72, w: 104, d: 2, r: 0.4 };
const BOARD_Z = 7, BOARD_H = 19;

// the scales (front row), best first from the left
export const BASE_X = [-128, -76, -24, 28, 80];
export const BASE = { y: 2, w: 36, d: 16, h: 14 };
export const CX = BASE_X.map((x) => x + BASE.w / 2);
export const CY = BASE.y + BASE.d / 2;
export const PAN_Z = BASE.h + 8;
export const PAN = { r: 10.6, h: 1.4 };
export const STACK_Z = PAN_Z + PAN.h;
const FRONT = BASE.y + BASE.d;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [SHELF.x, ASSAYER_Y - 4, 30], [BOARD.x + BOARD.w, BOARD.y, BOARD_Z + BOARD_H + 2], [CX[0], CY, STACK_Z + 22], [CX[4] + PAN.r, CY, STACK_Z + 22]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 48 },
);

const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const label = (x, y, z, text, size = 2.4, extra = {}) => faceText(P, [x, y, z], text, { size, tone: "mid", ...extra });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -120, y: 23, w: 84, d: 6, r: 1 })
    + labelPlate(P, { x: 66, y: 22, w: 42, d: 10, r: 1.5 }, [[70, 25.5, 28], [70, 29, 34]]);
}

// The assayer stands behind the rack and moves to the weight being placed.
function assayer() {
  return `<g data-assayer>${person(P, [SLOT0, ASSAYER_Y, 0], { scale: 1.05, hat: "cap" })}</g>`;
}

// The rack: a shelf. The weights, their footprints and the term and IDF printed on the front are drawn live
// into data-weights, spaced for however many terms the query has.
function rack() {
  return S(k.slabOf(SHELF, 0, SHELF_H, P, 3, 0.5), { tone: "mid" }) + `<g data-weights></g>`;
}

// The query board: two posts and a panel with the query and the corpus figures printed on it.
function board() {
  const out = [];
  for (const x of [BOARD.x + 6, BOARD.x + BOARD.w - 6]) out.push(S(k.cylinder(x, BOARD.y + 1, 1, 0, BOARD_Z + 2, P, 12), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf(BOARD, BOARD_Z, BOARD_H, P, 2, 0.3), { tone: "hi", crease: "lo" }));
  const fy = BOARD.y + BOARD.d;
  out.push(L(k.pathOf([[BOARD.x + 3, BOARD_Z + 3], [BOARD.x + BOARD.w - 3, BOARD_Z + 3], [BOARD.x + BOARD.w - 3, BOARD_Z + BOARD_H - 3], [BOARD.x + 3, BOARD_Z + BOARD_H - 3]].map(([x, z]) => k.iso([x, fy, z], P)), true), { tone: "faint" }));
  out.push(label(BOARD.x + 6, fy, BOARD_Z + BOARD_H - 7.6, t("QUERY", "CONSULTA"), 2.4));
  out.push(faceText(P, [BOARD.x + 6, fy, BOARD_Z + 7.4], "", { size: 4.4, tone: "hi", attr: "data-query" }));
  out.push(faceText(P, [BOARD.x + 6, fy, BOARD_Z + 3.8], "", { size: 2, tone: "mid", attr: "data-corpus" }));
  return out.join("");
}

// A scale: a base with its rank, document, score wheels (two + tenths) and length gauge on the front;
// a column; a pan. The pan's stack is drawn live into data-stack.
function scale(i) {
  const x0 = BASE_X[i], cx = CX[i];
  const plan = { x: x0, y: BASE.y, w: BASE.w, d: BASE.d, r: 1.4 };
  const out = [`<g data-scale="${i}">`];
  out.push(S(k.slabOf(plan, 0, BASE.h, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(plan, 2), BASE.h, P), { tone: "faint" }));
  out.push(faceText(P, [x0 + 2.2, FRONT, 8.4], "#" + (i + 1), { size: 4.4, tone: "mid" }));
  out.push(faceText(P, [x0 + 10.6, FRONT, 8.4], "", { size: 4.4, tone: "hi", attr: `data-doc="${i}"` }));
  out.push(digitCounter(P, { x: x0 + 2.6, y: FRONT, z: 1.6, count: 2, w: 3.6, h: 4.8, gap: 0.5, pad: 1, name: "si" + i }));
  out.push(k.dotsSvg([k.iso([x0 + 12.6, FRONT + 0.1, 1.9], P)], { size: 1.1, tone: "hi" }));
  out.push(digitCounter(P, { x: x0 + 15, y: FRONT, z: 1.6, count: 1, w: 3.6, h: 4.8, gap: 0.5, pad: 1, name: "sf" + i }));
  out.push(meter(P, { x: x0 + 28.6, y: FRONT, z: 1.8, r: 4.4, ticks: 8, name: "len" + i, value: 0.5 }));
  out.push(label(x0 + 28.6, FRONT, 9.4, t("LEN", "LONG"), 2, { anchor: "middle" }));
  out.push(S(k.cylinder(cx, CY, 1.6, BASE.h, PAN_Z - BASE.h, P, 16), { tone: "hi", crease: "none" }));
  out.push(`<g data-pan="${i}">${S(k.cylinder(cx, CY, PAN.r, PAN_Z, PAN.h, P, 40, 0.3), { tone: "hi", crease: "lo" })}</g>`);
  out.push(L(k.ring(cx, CY, PAN.r - 1.2, PAN_Z + PAN.h, P, 40), { tone: "faint" }));
  out.push(`<g data-stack="${i}"></g>`);
  out.push(`</g>`);
  return out.join("");
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "An assay bench on a base plate. At the back left, a shelf holds the query's terms as brass weights, one per slot, with the term and its IDF printed on the shelf front; the rarer the term, the bigger the weight. An assayer in a cap stands behind the shelf and moves to the weight being placed. At the back right a board on two posts shows the query and the corpus size. In front, five scales stand in a row, best match on the left. Each scale's base shows its rank, its document number, its score on digit wheels and a length gauge whose needle stands at the middle for a document of average length. For every query term a document contains, a disc the size of that term's weight goes into the document's pan; the disc's thickness is what the term adds to the score, so the stack height is the score.",
      "Un banco de ensayo sobre una placa base. Atrás a la izquierda, un estante tiene los términos de la consulta como pesas de bronce, una por ranura, con el término y su IDF impresos en el frente del estante; cuanto más raro el término, más grande la pesa. Un ensayador con gorra está detrás del estante y se mueve hacia la pesa que coloca. Atrás a la derecha, un tablero sobre dos postes muestra la consulta y el tamaño del corpus. Adelante, cinco balanzas en fila, la mejor coincidencia a la izquierda. La base de cada balanza muestra su puesto, su número de documento, su puntaje en ruedas de dígitos y un medidor de longitud cuya aguja queda en el medio para un documento de longitud promedio. Por cada término de la consulta que contiene un documento, cae en su platillo un disco del tamaño de la pesa de ese término; el grosor del disco es lo que el término suma al puntaje, así que la altura de la pila es el puntaje.",
    ),
    body: [plate(), assayer(), rack(), board(), BASE_X.map((_, i) => scale(i)).join("")],
  });
}

export const GEOMETRY = { SHELF_X, SLOT0, SLOT_Y, SHELF_TOP, SHELF_FRONT, ASSAYER_Y, CX, CY, PAN_Z, PAN, STACK_Z, FRONT };

// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A peg board beside a reader, in front of an archive: a Bloom filter you can watch.
//   Left: the reader, a desk where each key card stands while its hashes pick its pegs (threads run from the card to
//         each one). At its back, the verdict board: the NO and MAYBE signs and the HASHES counter. In front of it,
//         the SAID NO tray, where a card the board turned away lands.
//   Right: the board, 80 pegs in five rows of sixteen. A peg is up once some key has raised it; in a counting filter
//         each peg is a spindle of rings, one per key. Behind it the ARCHIVE cabinet, the slow store the filter
//         protects (a disk), with its KEYS counter; on its top, the inbox where a MAYBE card is checked, and the FOUND
//         and FALSE POSITIVES trays. A spindle shows four rings at most; past that a "+N" tag above it counts the rest.
// Cards only travel behind or beside the faces that carry counters and captions, never in front of them, so nothing
// moving covers a number or a word. Cards that land in a tray lie flat. Every number is a counter on a real object.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, faceText, sign, pennant } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { makeLive, M_LIVE } from "./sim";

export const WIDTH = 700;
export const HEIGHT = 450;

const PLATE = { x: -130, y: -88, w: 258, d: 132, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// ---------- the reader (left) ----------
const READER = { x: -124, y: -82, w: 52, d: 80, r: 2 };
const READER_H = 12;
export const READ_SPOT = [-110, -38, READER_H + 1.2];
const VBOARD = { x: -124 + 2, y: -80, w: 32, d: 2.4, r: 0.4 };   // the verdict board, upright on the reader's back
const VBOARD_H = 24;
const VB_FRONT = VBOARD.y + VBOARD.d;
const SIGNS = { no: { x: VBOARD.x + 2, w: 10 }, maybe: { x: VBOARD.x + 13.5, w: 17 } };

// The SAID NO tray, in front of the reader.
const TRAY_H = 9;
const NO_TRAY = { x: -124, y: 6, w: 52, d: 32, r: 1.5 };

// ---------- the archive (back right) and its trays on top ----------
const ARCH = { x: -64, y: -84, w: 186, d: 34, r: 2 };
const ARCH_H = 34;
const ARCH_FRONT = ARCH.y + ARCH.d;
export const INBOX_SPOT = [ARCH.x + 10, ARCH.y + 9, ARCH_H + 0.8];
const TOP_TRAYS = {
  found: { x: ARCH.x + 36, y: ARCH.y + 4, w: 62, d: 26, r: 1.2 },      // clear of the inbox on screen
  fp: { x: ARCH.x + 102, y: ARCH.y + 4, w: 80, d: 26, r: 1.2 },
};
const TOP_TRAY_H = 9;

// ---------- the board ----------
export const BOARD = { x: -64, y: -44, w: 186, d: 82, r: 2 };
export const BOARD_H = 10;
const BOARD_FRONT = BOARD.y + BOARD.d;
export const COLS = 16, ROWS = M_LIVE / 16;
export const PEG_XY = Array.from({ length: M_LIVE }, (_, i) => {
  const c = i % COLS, r = Math.floor(i / COLS);
  return [BOARD.x + 9 + (c * (BOARD.w - 18)) / (COLS - 1), BOARD.y + 9 + (r * (BOARD.d - 18)) / (ROWS - 1)];
});
export const PIN = { r: 2.6, h: 7 };
export const RING = { r: 3.6, h: 2.1, pitch: 2.5, max: 4 };

export const CARD = { w: 12, h: 8.5, size: 3.6 };

// Flat cards in the trays: where they lie, newest first (left).
const slotsIn = (p, z) => {
  const count = Math.floor((p.w - 6) / 14);
  return Array.from({ length: count }, (_, j) => [p.x + 3 + 7 + j * 14, p.y + p.d * 0.38, z]);
};
export const TRAY_SLOTS = {
  no: slotsIn(NO_TRAY, TRAY_H),
  found: slotsIn(TOP_TRAYS.found, ARCH_H + TOP_TRAY_H),
  fp: slotsIn(TOP_TRAYS.fp, ARCH_H + TOP_TRAY_H),
};
// Where the moving (upright) card lands: at the back of the tray, behind the newest slot, well clear of the counter.
const BACKS = { no: NO_TRAY, found: TOP_TRAYS.found, fp: TOP_TRAYS.fp };
export const TRAY_SPOT = Object.fromEntries(Object.entries(TRAY_SLOTS).map(([n, s]) => [n, [s[0][0], BACKS[n].y + 3.5, s[0][2]]]));

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(ARCH, 0, ARCH_H + TOP_TRAY_H + CARD.h + 2), ...k.boxCorners({ ...VBOARD }, 0, READER_H + VBOARD_H)],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

const { S, L } = shorthand(P);
// Captions beside counters: at the standard size of the other lessons, never smaller.
const LABEL = 3.2;
const text = (x, y, z, words, size = LABEL, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });
const counter = (o) => digitCounter(P, { w: 5, h: 6.6, gap: 0.6, pad: 1.2, ...o });
const CW = 5.6;                                              // one wheel and its gap, for placing a caption after a counter

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H });
}

// ---------- the reader ----------
function reader() {
  const out = [S(k.slabOf(READER, 0, READER_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(READER, 2.4), READER_H, P), { tone: "faint" }));
  // the card stand: a slotted block the key card stands in
  const [sx, sy] = READ_SPOT;
  out.push(S(k.slabOf({ x: sx - 8.5, y: sy - 2.4, w: 17, d: 4.8, r: 0.6 }, READER_H, 1.2, P, 2, 0.2), { tone: "hi", crease: "lo" }));
  // the deck of key cards still to come, lying beside the stand
  for (let j = 0; j < 5; j++) out.push(S(k.slabOf({ x: -94 + j * 0.25, y: -62, w: CARD.w, d: CARD.h, r: 0.4 }, READER_H + j * 1.1, 0.9, P, 2, 0.15), { tone: "hi", crease: "lo" }));
  // the verdict board: NO and MAYBE signs (the lit one is the board's answer) over the HASHES counter
  out.push(S(k.slabOf(VBOARD, READER_H, VBOARD_H, P, 2, 0.3), { tone: "mid", crease: "lo" }));
  const one = (name, words) => {
    const s = SIGNS[name];
    return `<g class="wb-lit-group" data-sign="${name}">${sign(P, { x: s.x, y: VB_FRONT + 1.2, z: READER_H + 13.5, w: s.w, h: 8.5, text: words, size: 3.8, posts: false })}</g>`;
  };
  out.push(one("no", "NO"), one("maybe", t("MAYBE", "QUIZÁS")));
  out.push(counter({ x: VBOARD.x + 3, y: VB_FRONT, z: READER_H + 3.2, count: 2, name: "hashes" }));
  out.push(text(VBOARD.x + 3 + 2 * CW + 2, VB_FRONT, READER_H + 4.8, t("HASHES", "HASHES")));
  return out.join("");
}

// A tray with its counter and caption on the front face; flat cards lie on its top.
function tray(name, p, z0, h, words) {
  const front = p.y + p.d;
  const out = [S(k.slabOf(p, z0, h, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(p, 2), z0 + h, P), { tone: "lo" }) })];
  out.push(counter({ x: p.x + 4, y: front, z: z0 + 0.7, count: 3, name }));
  out.push(text(p.x + 4 + 3 * CW + 2, front, z0 + 2.3, words));
  // a pennant on a card the board got wrong: a stored key it said NO to (a false negative)
  const flag = ([x, y, z]) => `<g data-flag style="display:none">${pennant(P, { x: x - CARD.w / 2 + 1.2, y: y - CARD.h / 2 + 1.2, z: z + 0.6, height: 6, length: 4.5, drop: 3 })}</g>`;
  TRAY_SLOTS[name].forEach((spot, j) => out.push(`<g data-rest="${name}-${j}" style="display:none">${flatCard(spot)}${name === "no" ? flag(spot) : ""}</g>`));
  return out.join("");
}

// ---------- the archive ----------
function archive() {
  const out = [S(k.slabOf(ARCH, 0, ARCH_H, P, 4, 0.6), { tone: "mid" })];
  // drawers along the front, each with a handle; the board in front hides their lower parts
  const DW = ARCH.w / 6;
  const lines = [];
  for (let d = 0; d < 6; d++) lines.push(k.faceRectY(P, ARCH.x + d * DW + 2, ARCH.x + (d + 1) * DW - 2, ARCH_FRONT, 3, ARCH_H - 3));
  out.push(L(lines.join(""), { tone: "lo" }));
  for (let d = 0; d < 6; d++) {
    const cx = ARCH.x + (d + 0.5) * DW;
    out.push(S(k.slabOf({ x: cx - 4, y: ARCH_FRONT, w: 8, d: 1.2, r: 0.4 }, ARCH_H - 9, 1.6, P, 2), { tone: "hi", crease: "lo" }));
  }
  // the title and the keys it holds, on the right face: no card or thread ever passes in front of it
  const side = ARCH.x + ARCH.w;
  out.push(faceText(P, [side, ARCH_FRONT - 3, 22.4], t("ARCHIVE", "ARCHIVO"), { face: "x", size: 4.4, tone: "mid" }));
  out.push(counter({ x: side, y: ARCH_FRONT - 3, z: 10.6, count: 2, face: "x", name: "keys" }));
  out.push(faceText(P, [side, ARCH_FRONT - 3 - 2 * CW - 2, 12.2], t("KEYS", "CLAVES"), { face: "x", size: LABEL, tone: "mid" }));
  // the inbox, where a card is checked against the archive
  const [ix, iy] = INBOX_SPOT;
  out.push(S(k.slabOf({ x: ix - 8.5, y: iy - 2.4, w: 17, d: 4.8, r: 0.6 }, ARCH_H, 0.8, P, 2, 0.2), { tone: "hi", crease: "lo" }));
  out.push(tray("found", TOP_TRAYS.found, ARCH_H, TOP_TRAY_H, t("FOUND", "ENCONTRADAS")));
  out.push(tray("fp", TOP_TRAYS.fp, ARCH_H, TOP_TRAY_H, t("FALSE POSITIVES", "FALSOS POSITIVOS")));
  return out.join("");
}

// ---------- the board ----------
// One peg position: a lit disc shown when a probed peg is down, and the plain filter's pin, drawn once at the origin
// and moved into place. The counting filter's spindles and rings are built by the live code when it's chosen (from
// SPINDLE_SVG and RING_SVG), so the page doesn't carry 400 rings it may never show.
const pinSvg = () => S(k.cylinder(0, 0, PIN.r, BOARD_H + 0.3, PIN.h, P, 12), { tone: "hi", crease: "lo" });
export const ringSvg = () => S(k.cylinder(0, 0, RING.r, BOARD_H + 0.3, RING.h, P, 12), { tone: "hi", crease: "lo" });
export const spindleSvg = () => L(k.segment([0, 0, BOARD_H], [0, 0, BOARD_H + RING.max * RING.pitch + 0.8], P), { tone: "mid" });
/** The "+N" tag over a spindle with more rings than it shows: upright, just above the top of the spindle. */
export const moreSvg = () => faceText(P, [0, 0, BOARD_H + RING.max * RING.pitch + 2], "+1", { size: 3.2, tone: "hi", anchor: "middle", attr: "data-more-text" });
const disc = (x, y, r, z) => k.onTop(k.circleRing(x, y, r, 14), z, P, true);
function peg(i, n, pin) {
  const [x, y] = PEG_XY[i];
  return `<g data-peg="${i}"><path class="bloom-hole" data-hole="${i}" d="${disc(x, y, RING.r - 0.4, BOARD_H + 0.05)}" style="display:none"/>`
    + `<g class="wb-lit-group" data-pin="${i}" transform="${k.translateAlong(P, [x, y, 0])}"${n > 0 ? "" : ' style="display:none"'}>${pin}</g></g>`;
}
function board(counts) {
  const out = [S(k.slabOf(BOARD, 0, BOARD_H, P, 4, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(BOARD, 2.4), BOARD_H, P), { tone: "faint" }));
  out.push(counter({ x: BOARD.x + 6, y: BOARD_FRONT, z: 1.8, count: 2, name: "up", value: counts.filter((c) => c > 0).length }));
  out.push(text(BOARD.x + 6 + 2 * CW + 2, BOARD_FRONT, 3.4, t("PEGS UP", "CLAVIJAS ARRIBA")));
  out.push(counter({ x: BOARD.x + 104, y: BOARD_FRONT, z: 1.8, count: 2, name: "fn" }));
  out.push(text(BOARD.x + 104 + 2 * CW + 2, BOARD_FRONT, 3.4, t("FALSE NEGATIVES", "FALSOS NEGATIVOS")));
  // the sockets, then the pegs, far ones first
  out.push(`<path class="bloom-socket" d="${PEG_XY.map(([x, y]) => disc(x, y, RING.r, BOARD_H)).join("")}"/>`);
  const order = PEG_XY.map((_, i) => i).sort((a, b) => k.depthOf([...PEG_XY[a], 0], P) - k.depthOf([...PEG_XY[b], 0], P));
  const pin = pinSvg();
  out.push(`<g data-board data-mode="plain">${order.map((i) => peg(i, counts[i], pin)).join("")}</g>`);
  return out.join("");
}

// A key card standing upright on its bottom edge at (x, y, z), with the key's number on its front.
function cardAt([x, y, z], attr) {
  const plan = { x: x - CARD.w / 2, y: y - 0.4, w: CARD.w, d: 0.8, r: 0.15 };
  return `<g class="wb-lit-group" data-card>${S(k.slabOf(plan, z, CARD.h, P, 2, 0.15), { tone: "hi", crease: "lo" })}`
    + faceText(P, [x, y + 0.4, z + 2.8], "0000", { size: CARD.size, tone: "hi", anchor: "middle", attr }) + `</g>`;
}
// A key card lying flat in a tray, its number on top.
function flatCard([x, y, z]) {
  const plan = { x: x - CARD.w / 2, y: y - CARD.h / 2, w: CARD.w, d: CARD.h, r: 0.4 };
  return `<g class="wb-lit-group" data-card>${S(k.slabOf(plan, z, 0.6, P, 2, 0.15), { tone: "hi", crease: "lo" })}`
    + faceText(P, [x, y + 1.3, z + 0.6], "0000", { face: "top", size: CARD.size, tone: "hi", anchor: "middle", attr: "data-rest-text" }) + `</g>`;
}
/** The moving card, drawn at the origin and moved with translateAlong. */
export const cardSvg = () => cardAt([0, 0, 0], "data-card-text");

// The first frame, before the live code runs: the default board, almost full (the same run the live code opens with).
function firstCounts() {
  const m = makeLive({}, 7);
  m.prefill(m.target - 2);
  return [...m.f.counts];
}

export function buildFigure() {
  const counts = firstCounts();
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A Bloom filter as a peg board beside a reader, in front of an archive, on a base plate. On the left, the reader: a desk where the current key card stands, with a verdict board at its back carrying a NO sign, a MAYBE sign and a counter of hashes; in front of it, the SAID NO tray. To the right, a board carries 80 pegs in five rows of sixteen, with counters for the pegs that are up and the false negatives. Threads run from the card to the pegs its hashes pick. Adding a key raises its pegs; a lookup answers no if any of them is down and maybe if all are up. A card in the SAID NO tray with a pennant was a stored key: a false negative. In a counting filter each peg is a spindle of rings, one ring per key, with a +N tag above a spindle holding more than four. Behind the board stands the archive, the slow store, with a counter of the keys it holds on its right side; on its top, from left to right, an inbox where a maybe card is checked, a FOUND tray and a FALSE POSITIVES tray, for cards the board let through that the archive didn't have.",
      "Un filtro de Bloom como un tablero de clavijas junto a un lector, frente a un archivo, sobre una placa base. A la izquierda, el lector: un escritorio donde se para la tarjeta de la clave actual, con un tablero de veredicto atrás que lleva un letrero NO, un letrero QUIZÁS y un contador de hashes; delante, la bandeja DIJO NO. A la derecha, un tablero lleva 80 clavijas en cinco filas de dieciséis, con contadores de clavijas arriba y de falsos negativos. Unos hilos van de la tarjeta a las clavijas que eligen sus hashes. Agregar una clave levanta sus clavijas; una búsqueda responde no si alguna está abajo y quizás si todas están arriba. Una tarjeta con un banderín en la bandeja DIJO NO era una clave guardada: un falso negativo. En un filtro con contadores, cada clavija es un eje con anillos, un anillo por clave, con una etiqueta +N sobre un eje que tiene más de cuatro. Detrás del tablero está el archivo, el almacenamiento lento, con un contador de las claves que guarda en su costado derecho; encima, de izquierda a derecha, una bandeja de entrada donde se revisa una tarjeta con quizás, una bandeja ENCONTRADAS y una bandeja FALSOS POSITIVOS, para las tarjetas que el tablero dejó pasar y el archivo no tenía.",
    ),
    body: [
      plate(),
      reader(),
      tray("no", NO_TRAY, 0, TRAY_H, t("SAID NO", "DIJO NO")),
      archive(),
      board(counts),
      `<g data-threads></g>`,
      `<g data-layer="fly"></g>`,
    ],
  });
}

export const GEOMETRY = { PEG_XY, BOARD_H, PIN, RING, READ_SPOT, INBOX_SPOT, TRAY_SPOT, TRAY_SLOTS, CARD };

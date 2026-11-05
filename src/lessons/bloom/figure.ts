// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A peg board in front of an archive: a Bloom filter you can watch.
//   Back: the feed (two piles of key cards: keys to ADD and keys to LOOK UP) and the long ARCHIVE cabinet, the slow
//         store the filter protects (a disk); its KEYS counter says how many keys it holds.
//   Middle: the reader, where a key card stands while its hashes pick its pegs (threads run from the card to each
//         one), with the NO / MAYBE signs and the HASHES counter; and the board, 80 pegs in four rows of twenty. A peg
//         is up once some key has raised it. In a counting filter each peg is a spindle of rings, one per key.
//   Front: three trays for the answers: SAID NO (no trip to the archive), FOUND, and FALSE POSITIVES (the board
//         said maybe, the archive had nothing). Every number is a counter on a real object.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, faceText, sign, lamp, plaque } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { makeLive, M_LIVE, DRAWERS } from "./sim";

export const WIDTH = 700;
export const HEIGHT = 440;

const PLATE = { x: -130, y: -86, w: 258, d: 130, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// ---------- back row ----------
const FEED = { x: -124, y: -80, w: 52, d: 28, r: 1.5 };
const FEED_H = 9;
const PILES = [-110, -86];                                   // ADD, LOOK UP
const PILE_Y = FEED.y + 5;
export const FEED_SPOT = PILES.map((x) => [x, PILE_Y + 5, FEED_H + 6]);

const ARCH = { x: -64, y: -82, w: 186, d: 32, r: 2 };
const ARCH_H = 32;
const ARCH_FRONT = ARCH.y + ARCH.d;
const DRAWER_W = ARCH.w / DRAWERS;
export const DRAWER_SPOT = Array.from({ length: DRAWERS }, (_, d) => [ARCH.x + DRAWER_W * (d + 0.5), ARCH_FRONT + 2, 13]);
const LAMP_AT = [ARCH.x + ARCH.w - 10, ARCH.y + 12, ARCH_H];

// ---------- middle row ----------
const READER = { x: -124, y: -44, w: 52, d: 42, r: 2 };
const READER_H = 12;
const READER_FRONT = READER.y + READER.d;
export const READ_SPOT = [-108, READER.y + 36, READER_H + 1.2];
const SIGN_Y = READER.y + 13;
const SIGNS = { no: { x: -122, w: 16 }, maybe: { x: -103, w: 30 } };

export const BOARD = { x: -66, y: -42, w: 188, d: 40, r: 2 };
export const BOARD_H = 10;
const BOARD_FRONT = BOARD.y + BOARD.d;
export const COLS = 20, ROWS = M_LIVE / 20;
export const PEG_XY = Array.from({ length: M_LIVE }, (_, i) => {
  const c = i % COLS, r = Math.floor(i / COLS);
  return [BOARD.x + 7 + (c * (BOARD.w - 14)) / (COLS - 1), BOARD.y + 6 + (r * (BOARD.d - 12)) / (ROWS - 1)];
});
export const PIN = { r: 2, h: 5.6 };
export const RING = { r: 2.8, h: 1.7, pitch: 1.95, max: 5 };

// ---------- front row ----------
const TRAY_Y = 10, TRAY_D = 26, TRAY_H = 8;
const TRAYS = {
  no: { x: -124, y: TRAY_Y, w: 52, d: TRAY_D, r: 1.5 },
  found: { x: -64, y: TRAY_Y, w: 84, d: TRAY_D, r: 1.5 },
  fp: { x: 28, y: TRAY_Y, w: 94, d: TRAY_D, r: 1.5 },
};
// Each tray keeps its latest cards standing in a row, the newest on the left.
export const TRAY_SLOTS = Object.fromEntries(Object.entries(TRAYS).map(([n, p]) => {
  const count = Math.floor((p.w - 8) / 13.5);
  return [n, Array.from({ length: count }, (_, j) => [p.x + 4 + 6.75 + j * 13.5, p.y + p.d / 2 - 1, TRAY_H - 1.6])];
}));
export const TRAY_SPOT = Object.fromEntries(Object.entries(TRAY_SLOTS).map(([n, s]) => [n, s[0]]));

export const CARD = { w: 11, h: 8, size: 3.6 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(ARCH, 0, ARCH_H + 9), [FEED_SPOT[0][0], FEED_SPOT[0][1], FEED_H + 10]],
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

// ---------- the feed ----------
function feed() {
  const out = [S(k.slabOf(FEED, 0, FEED_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(FEED, 2), FEED_H, P), { tone: "faint" }));
  for (const x of PILES) for (let s = 0; s < 4; s++) {
    out.push(S(k.slabOf({ x: x - 6 + s * 0.3, y: PILE_Y, w: 12, d: 10, r: 0.5 }, FEED_H + s * 1.4, 1.1, P, 2, 0.2), { tone: "hi", crease: "lo" }));
  }
  // what each pile is for, on plaques in front of the piles (the reader hides the feed's front face)
  out.push(plaque(P, { x: PILES[0] - 11, y: PILE_Y + 12, z: FEED_H, w: 22, d: 7.5, text: t("ADD", "AGREGAR"), size: 3.4 }));
  out.push(plaque(P, { x: PILES[1] - 11, y: PILE_Y + 12, z: FEED_H, w: 22, d: 7.5, text: t("LOOK UP", "BUSCAR"), size: 3.4 }));
  return out.join("");
}

// ---------- the archive ----------
function archive() {
  const out = [S(k.slabOf(ARCH, 0, ARCH_H, P, 4, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(ARCH, 2.4), ARCH_H, P), { tone: "faint" }));
  // drawers along the front, each with a handle; the board in front hides their lower halves
  const lines = [];
  for (let d = 0; d < DRAWERS; d++) {
    const x0 = ARCH.x + d * DRAWER_W + 2, x1 = x0 + DRAWER_W - 4;
    lines.push(k.faceRectY(P, x0, x1, ARCH_FRONT, 3, 21));
  }
  out.push(L(lines.join(""), { tone: "lo" }));
  for (let d = 0; d < DRAWERS; d++) {
    const cx = ARCH.x + (d + 0.5) * DRAWER_W;
    out.push(S(k.slabOf({ x: cx - 4, y: ARCH_FRONT, w: 8, d: 1.2, r: 0.4 }, 16.4, 1.6, P, 2), { tone: "hi", crease: "lo" }));
  }
  out.push(text(ARCH.x + 4, ARCH_FRONT, 24.4, t("ARCHIVE", "ARCHIVO"), 4.4));
  out.push(counter({ x: ARCH.x + 34, y: ARCH_FRONT, z: 23.2, count: 2, name: "keys" }));
  out.push(text(ARCH.x + 34 + 2 * CW + 2, ARCH_FRONT, 24.8, t("KEYS", "CLAVES")));
  // the lamp: lit when a trip finds nothing (a false positive)
  out.push(`<g class="wb-lit-group" data-lamp>${lamp(P, LAMP_AT, { r: 3 })}</g>`);
  return out.join("");
}

// ---------- the reader ----------
function reader() {
  const out = [S(k.slabOf(READER, 0, READER_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(READER, 2.4), READER_H, P), { tone: "faint" }));
  // the card stand: a slotted block the key card stands in
  const [sx, sy] = READ_SPOT;
  out.push(S(k.slabOf({ x: sx - 8, y: sy - 2.4, w: 16, d: 4.8, r: 0.6 }, READER_H, 1.2, P, 2, 0.2), { tone: "hi", crease: "lo" }));
  out.push(counter({ x: READER.x + 5, y: READER_FRONT, z: 3.6, count: 2, name: "hashes" }));
  out.push(text(READER.x + 5 + 2 * CW + 2, READER_FRONT, 5.2, t("HASHES", "HASHES")));
  return out.join("");
}
// The verdict signs on the reader: NO and MAYBE, the lit one is the board's answer.
function signs() {
  const one = (name, words) => {
    const s = SIGNS[name];
    return `<g class="wb-lit-group" data-sign="${name}">${sign(P, { x: s.x, y: SIGN_Y, z: READER_H, w: s.w, h: 9, text: words, size: 4.4, posts: false })}</g>`;
  };
  return one("no", "NO") + one("maybe", t("MAYBE", "QUIZÁS"));
}

// ---------- the board ----------
// One peg position: a lit disc shown when a probed peg is down, and the plain filter's pin, drawn once at the origin
// and moved into place. The counting filter's spindles and rings are built by the live code when it's chosen (from
// SPINDLE_SVG and RING_SVG), so the page doesn't carry 400 rings it may never show.
const pinSvg = () => S(k.cylinder(0, 0, PIN.r, BOARD_H + 0.3, PIN.h, P, 12), { tone: "hi", crease: "lo" });
export const ringSvg = () => S(k.cylinder(0, 0, RING.r, BOARD_H + 0.3, RING.h, P, 12), { tone: "hi", crease: "lo" });
export const spindleSvg = () => L(k.segment([0, 0, BOARD_H], [0, 0, BOARD_H + RING.max * RING.pitch + 0.8], P), { tone: "mid" });
const disc = (x, y, r, z) => k.onTop(k.circleRing(x, y, r, 14), z, P, true);
function peg(i, n, pin) {
  const [x, y] = PEG_XY[i];
  return `<g data-peg="${i}"><path class="bloom-hole" data-hole="${i}" d="${disc(x, y, RING.r - 0.3, BOARD_H + 0.05)}" style="display:none"/>`
    + `<g class="wb-lit-group" data-pin="${i}" transform="${k.translateAlong(P, [x, y, 0])}"${n > 0 ? "" : ' style="display:none"'}>${pin}</g></g>`;
}
function board(counts) {
  const out = [S(k.slabOf(BOARD, 0, BOARD_H, P, 4, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(BOARD, 2.4), BOARD_H, P), { tone: "faint" }));
  out.push(counter({ x: BOARD.x + 6, y: BOARD_FRONT, z: 2.9, count: 2, name: "up", value: counts.filter((c) => c > 0).length }));
  out.push(text(BOARD.x + 6 + 2 * CW + 2, BOARD_FRONT, 4.4, t("PEGS UP", "CLAVIJAS ARRIBA")));
  out.push(counter({ x: BOARD.x + 104, y: BOARD_FRONT, z: 2.9, count: 2, name: "fn" }));
  out.push(text(BOARD.x + 104 + 2 * CW + 2, BOARD_FRONT, 4.4, t("FALSE NEGATIVES", "FALSOS NEGATIVOS")));
  // the sockets, then the pegs, far ones first
  out.push(`<path class="bloom-socket" d="${PEG_XY.map(([x, y]) => disc(x, y, RING.r, BOARD_H)).join("")}"/>`);
  const order = PEG_XY.map((_, i) => i).sort((a, b) => k.depthOf([...PEG_XY[a], 0], P) - k.depthOf([...PEG_XY[b], 0], P));
  const pin = pinSvg();
  out.push(`<g data-board data-mode="plain">${order.map((i) => peg(i, counts[i], pin)).join("")}</g>`);
  return out.join("");
}

// ---------- the answer trays ----------
function tray(name, words, digits) {
  const p = TRAYS[name], front = p.y + p.d;
  const out = [S(k.slabOf(p, 0, TRAY_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(p, 2), TRAY_H, P), { tone: "lo" }) })];
  out.push(counter({ x: p.x + 4, y: front, z: 0.8, count: digits, name }));
  out.push(text(p.x + 4 + digits * CW + 2, front, 2.4, words));
  TRAY_SLOTS[name].forEach((spot, j) => out.push(`<g data-rest="${name}-${j}" style="display:none">${cardAt(spot, `data-rest-text`)}</g>`));
  return out.join("");
}

// A key card: an upright card with the key's number on its front, standing on its bottom edge at (x, y, z).
function cardAt([x, y, z], attr) {
  const plan = { x: x - CARD.w / 2, y: y - 0.4, w: CARD.w, d: 0.8, r: 0.15 };
  return `<g class="wb-lit-group" data-card>${S(k.slabOf(plan, z, CARD.h, P, 2, 0.15), { tone: "hi", crease: "lo" })}`
    + faceText(P, [x, y + 0.4, z + 2.6], "0000", { size: CARD.size, tone: "hi", anchor: "middle", attr }) + `</g>`;
}
/** The flying card, drawn at the origin and moved with translateAlong. */
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
      "A Bloom filter as a peg board in front of an archive, on a base plate. At the back, a feed holds two piles of key cards, keys to add and keys to look up, and a long archive cabinet with drawers stands for the slow store; a counter shows how many keys it holds and a lamp on top lights when a trip to it finds nothing. In the middle, a reader holds the current key card, with a NO sign and a MAYBE sign, and a counter of hashes; to its right a long board carries 80 pegs in four rows of twenty. Threads run from the card to the pegs its hashes pick. Adding a key raises its pegs; a lookup answers no if any of them is down and maybe if all are up. In a counting filter each peg is a spindle of rings, one ring per key. Counters on the board show the pegs that are up and the false negatives. In front, three trays collect the cards: said no, found in the archive, and false positives, where the board said maybe and the archive had nothing.",
      "Un filtro de Bloom como un tablero de clavijas frente a un archivo, sobre una placa base. Atrás, una entrada tiene dos pilas de tarjetas de claves, claves para agregar y claves para buscar, y un archivo largo con cajones representa el almacenamiento lento; un contador muestra cuántas claves guarda y una lámpara arriba se enciende cuando un viaje hasta él no encuentra nada. En el medio, un lector sostiene la tarjeta de la clave actual, con un letrero NO y un letrero QUIZÁS, y un contador de hashes; a su derecha, un tablero largo lleva 80 clavijas en cuatro filas de veinte. Unos hilos van de la tarjeta a las clavijas que eligen sus hashes. Agregar una clave levanta sus clavijas; una búsqueda responde no si alguna está abajo y quizás si todas están arriba. En un filtro con contadores, cada clavija es un eje con anillos, un anillo por clave. Contadores en el tablero muestran las clavijas arriba y los falsos negativos. Adelante, tres bandejas reciben las tarjetas: las que recibieron un no, las encontradas en el archivo y los falsos positivos, donde el tablero dijo quizás y el archivo no tenía nada.",
    ),
    body: [
      plate(),
      feed(),
      archive(),
      reader(),
      signs(),
      board(counts),
      tray("no", t("SAID NO", "DIJO NO"), 3),
      tray("found", t("FOUND", "ENCONTRADAS"), 3),
      tray("fp", t("FALSE POSITIVES", "FALSOS POSITIVOS"), 3),
      `<g data-threads></g>`,
      `<g data-layer="fly"></g>`,
    ],
  });
}

export const GEOMETRY = { PEG_XY, BOARD_H, PIN, RING, FEED_SPOT, READ_SPOT, DRAWER_SPOT, TRAY_SPOT, TRAY_SLOTS, CARD };

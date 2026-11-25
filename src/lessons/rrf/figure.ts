// @ts-nocheck: figure code ported as-is; drawing shorthands come from src/lib/draw.
// A count room for ranked ballots: reciprocal rank fusion you can watch.
//   three judges (rankers) post ranked ballots on boards at the back: a column of document cards, best first;
//   a counting clerk walks the ballots rank by rank; for each card a token flies into that document's tube;
//   a token's height is the vote's share of the fused score, 1 / (k + rank), so it shrinks with rank;
//   each tube has a counter and the standings board shows the current top five.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate, person, card, plaque, dial, pennant, faceText } from "../../../workbench/parts.mjs";
import { QUERY, JUDGES } from "./sim";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 720;
export const HEIGHT = 540;

const PLATE = { x: -150, y: -86, w: 300, d: 140, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// Ballot boards along the back. Their front face is at BOARD_Y; rank 1 at the top. Sized for words at 11 px on a
// desktop (TXT, below): rank, card (the document) and the judge's score side by side in each row.
export const BOARD_Y = -66;
export const BOARD_X = { keyword: -112, meaning: -48, clicks: 16 };
const BOARD = { w: 46, z0: 9, h: 76, d: 4 };
export const SLOTS = 8;
export const CARD = { w: 15, h: 7.2, pitch: 8 };
export const slotZ = (rank) => BOARD.z0 + BOARD.h - 10.5 - CARD.h - (rank - 1) * CARD.pitch;
export const CARD_X = (cx) => cx - BOARD.w / 2 + 7;
const STAND_X = 104, STAND = { w: 46, h: 58, pitch: 8.6 };
export const JUDGE_NAME = { keyword: t("KEYWORD", "PALABRAS"), meaning: t("MEANING", "SIGNIFICADO"), clicks: t("CLICKS", "CLICS") };
export const JUDGE_TONE = { keyword: "hi", meaning: "mid", clicks: "lo" };

// Tubes along the front: one per document, in document order.
export const DOC_IDS = Object.keys(QUERY.docs);
export const TUBE_X = DOC_IDS.map((_, i) => -128 + i * 18);
export const TUBE_Y = 12.5;
const SOCKET = { y: 6, d: 12, h: 9 };
export const COL = { z0: SOCKET.h, top: SOCKET.h + 24, r: 4.3 };
export const SCALE = 0.075;   // tube height per point (a first-place vote is 100 points; 300 fills the tube)

// Where the clerk stands: in front of a ballot. A token flies from the card to its tube.
export const AT_BALLOT = (judge) => [BOARD_X[judge] + 27, BOARD_Y + 9, 0];
export const HOME = [BOARD_X.keyword + 27, BOARD_Y + 9, 0];
export const cardAt = (judge, rank) => [CARD_X(BOARD_X[judge]) + CARD.w / 2, BOARD_Y + 2, slotZ(rank)];
export const CLERK_SCALE = 0.78;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [PLATE.x, PLATE.y + 20, BOARD.z0 + BOARD.h + 4], [PLATE.x + PLATE.w, PLATE.y + 20, BOARD.z0 + BOARD.h + 4]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 50 },
);

const { S, L, seg } = shorthand(P);
// Words on the machine come out at 11 px or more on a desktop (workbench/kit.mjs textSize; tools/text-size.cjs).
// TXT: on a face of constant y; TOP: lying on a top face (the plaques).
export const TXT = k.textSize(P, 11.2, { width: WIDTH });
export const TOP = k.textSize(P, 11.2, { width: WIDTH, face: "top" });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: 6, y: 36, w: 60, d: 6, r: 1 })
    + labelPlate(P, { x: 74, y: 31, w: 48, d: 14, r: 1.5 }, [[79, 35.5, 30], [79, 39.5, 36]]);
}

// A ballot board on a low pedestal: the judge's name at the top, rank numbers down the left,
// a card per document in rank order, and the score the judge gave on the right.
function ballot(judge) {
  const cx = BOARD_X[judge], left = cx - BOARD.w / 2, right = cx + BOARD.w / 2;
  const out = [`<g data-judge="${judge}">`];
  out.push(S(k.slabOf({ x: left - 2, y: BOARD_Y - 8, w: BOARD.w + 4, d: 11, r: 1 }, 0, BOARD.z0, P, 3, 0.4), { tone: "mid" }));
  out.push(person(P, [left - 6, BOARD_Y - 4, 0], { scale: 0.74, hat: "brim" }));
  const board = { x: left, y: BOARD_Y - BOARD.d, w: BOARD.w, d: BOARD.d, r: 0.6 };
  out.push(S(k.slabOf(board, BOARD.z0, BOARD.h, P, 2, 0.4), { tone: "mid", crease: "lo" }));
  const top = BOARD.z0 + BOARD.h;
  out.push(faceText(P, [cx, BOARD_Y, top - 7.6], JUDGE_NAME[judge], { size: TXT, tone: "hi", anchor: "middle" }));
  out.push(L(seg([left + 1.5, BOARD_Y, top - 9.4], [right - 1.5, BOARD_Y, top - 9.4]), { tone: "lo" }));
  const list = QUERY.lists[judge];
  for (let r = 1; r <= SLOTS; r++) {
    const z = slotZ(r);
    const [id, raw] = list[r - 1];
    out.push(`<g data-slot="${judge}-${r}">`);
    out.push(faceText(P, [left + 3.6, BOARD_Y, z + 1.6], String(r), { size: TXT, tone: "mid", anchor: "middle" }));
    out.push(`<g class="wb-lit-group" data-card="${judge}-${r}">`);
    out.push(card(P, { x: CARD_X(cx), y: BOARD_Y + 0.6, z, w: CARD.w, h: CARD.h, text: id, size: TXT, tone: JUDGE_TONE[judge] }));
    out.push(`</g>`);
    out.push(faceText(P, [right - 1.4, BOARD_Y, z + 1.6], judge === "clicks" ? String(raw) : judge === "meaning" ? raw.toFixed(2) : raw.toFixed(1), { size: TXT, tone: "mid", anchor: "end" }));
    out.push(`</g>`);
  }
  // the judge's weight, on a plaque in front of the pedestal
  out.push(plaque(P, { x: cx - 12, y: BOARD_Y + 4.4, z: 0, w: 24, d: 9, text: "×1", size: TOP, attr: `data-weight="${judge}"` }));
  out.push(`</g>`);
  return out.join("");
}

// The standings board: the current top five, place numbers down the left.
// The standings board: the current top five, place numbers down the left; each card the document and its points.
function standings() {
  const cx = STAND_X, left = cx - STAND.w / 2, right = cx + STAND.w / 2;
  const out = [];
  out.push(S(k.slabOf({ x: left - 2, y: BOARD_Y - 8, w: STAND.w + 4, d: 11, r: 1 }, 0, BOARD.z0, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: left, y: BOARD_Y - BOARD.d, w: STAND.w, d: BOARD.d, r: 0.6 }, BOARD.z0, STAND.h, P, 2, 0.4), { tone: "mid", crease: "lo" }));
  const top = BOARD.z0 + STAND.h;
  out.push(faceText(P, [cx, BOARD_Y, top - 7.6], t("STANDINGS", "POSICIONES"), { size: TXT, tone: "hi", anchor: "middle" }));
  out.push(L(seg([left + 1.5, BOARD_Y, top - 9.4], [right - 1.5, BOARD_Y, top - 9.4]), { tone: "lo" }));
  for (let p = 1; p <= 5; p++) {
    const z = top - 10.5 - CARD.h - (p - 1) * STAND.pitch;
    out.push(faceText(P, [left + 3.6, BOARD_Y, z + 1.6], String(p), { size: TXT, tone: "hi", anchor: "middle" }));
    out.push(`<g class="wb-lit-group" data-place="${p}">`);
    out.push(card(P, { x: left + 7, y: BOARD_Y + 0.6, z, w: STAND.w - 8.5, h: CARD.h }));
    out.push(faceText(P, [left + 8.6, BOARD_Y + 1.2, z + 1.6], "–", { size: TXT, tone: "hi", attr: `data-place-id="${p}"` }));
    out.push(faceText(P, [right - 3, BOARD_Y + 1.2, z + 1.6], "", { size: TXT, tone: "hi", anchor: "end", attr: `data-place-pts="${p}"` }));
    out.push(`</g>`);
  }
  return out.join("");
}

// A tube: a socket with the document's id (its points are on the standings board for the top five, and in its height),
// a back plate with a tick every 50 points,
// a token stack (filled live) between the back plate and two front posts, and a pennant if the document
// really answers the question.
function tubeBack(i) {
  const tx = TUBE_X[i], id = DOC_IDS[i];
  const out = [`<g data-tube="${id}">`];
  out.push(S(k.slabOf({ x: tx - 6.5, y: SOCKET.y, w: 13, d: SOCKET.d, r: 1 }, 0, SOCKET.h, P, 3, 0.4), { tone: "mid" }));
  const front = SOCKET.y + SOCKET.d;
  out.push(faceText(P, [tx, front, 2.2], id, { size: TXT, tone: "hi", anchor: "middle", attr: "data-tube-id" }));
  const back = { x: tx - 5.6, y: SOCKET.y + 0.6, w: 11.2, d: 1, r: 0.2 };
  out.push(S(k.slabOf(back, COL.z0, COL.top - COL.z0, P, 1, 0.2), { tone: "hi", crease: "lo" }));
  const ticks = [];
  for (let p = 50; p < 300; p += 50) {
    const z = COL.z0 + p * SCALE, long = p % 100 === 0;
    ticks.push(seg([tx - 5, back.y + back.d, z], [tx - (long ? 1.8 : 3.2), back.y + back.d, z]));
  }
  out.push(L(ticks.join(""), { tone: "lo" }));
  if (QUERY.docs[id].rel > 0) out.push(pennant(P, { x: tx - 5, y: back.y + 0.5, z: COL.top, height: QUERY.docs[id].rel === 2 ? 8 : 5, length: 5.6, drop: 3.6 }));
  out.push(`<g data-stack="${id}"></g>`);
  out.push(`</g>`);
  return out.join("");
}
function tubeFront(i) {
  const tx = TUBE_X[i];
  const py = SOCKET.y + SOCKET.d - 1.2;
  const out = [];
  for (const x of [tx - 5.2, tx + 5.2]) out.push(S(k.cylinder(x, py, 0.55, COL.z0, COL.top - COL.z0, P, 10), { tone: "mid", crease: "none" }));
  out.push(L(k.planOutline({ x: tx - 5.6, y: SOCKET.y + 0.6, w: 11.2, d: py - SOCKET.y - 0.6 + 0.5, r: 0.4 }, COL.top, P), { tone: "mid" }));
  out.push(`<g data-cap="${DOC_IDS[i]}" style="display:none">${S(k.slabOf({ x: tx - 5.6, y: SOCKET.y + 0.6, w: 11.2, d: py - SOCKET.y, r: 0.4 }, COL.top, 1.4, P, 2), { tone: "hi", crease: "lo", lit: true })}</g>`);
  return out.join("");
}

// The k dial (needle on a log scale, 1 to 1000; a tick every power of ten) with its value on a plaque beside it, and
// the fusion-mode plaque, low on the front strip.
function frontStrip() {
  const out = [];
  out.push(dial(P, { x: -126, y: 38, r: 8.5, h: 4.5, ticks: 30, every: 10, from: -Math.PI * 0.75, span: Math.PI * 1.5, name: "k", value: Math.log10(60) / 3 }));
  out.push(plaque(P, { x: -114, y: 32, z: 0, w: 37, d: 11, text: "k = 60", size: TOP, attr: "data-k-text" }));
  out.push(`<g class="wb-lit-group" data-mode>${plaque(P, { x: -74, y: 32, z: 0, w: 72, d: 11, text: "1 / (k + rank)", size: TOP, attr: "data-mode-text" })}</g>`);
  return out.join("");
}

// The clerk, drawn at the origin and moved with translateAlong, with a clipboard.
export function clerkSvg() {
  return person(P, [0, 0, 0], { scale: CLERK_SCALE, hat: "cap", holding: "clipboard" });
}
// A token in flight from a ballot card to its tube, drawn at the origin.
export function flightSvg() {
  return S(k.cylinder(0, 0, COL.r * 0.9, 0, 2.2, P, 22, 0.3), { tone: "hi", crease: "lo", lit: true });
}

export function buildFigure() {
  const back = JUDGES.map(ballot).join("") + standings();
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A count room on a base plate. Along the back stand three ballot boards, one per judge (keyword, meaning, clicks), each a column of document cards in rank order with the judge's score beside each card, and a standings board showing the top five. A counting clerk walks along the ballots rank by rank; for each card a token flies into that document's tube in a row of fourteen tubes along the front. A token's height is that vote's share of the fused score, 1 / (k + rank), so later ranks give shorter tokens. Each tube has a tick every 50 points; a pennant marks the documents that really answer the query. A dial on the front sets k, with its value on a plaque, and a plaque shows whether ranks or raw scores are being added.",
      "Una sala de conteo sobre una placa base. Al fondo hay tres tableros de boletas, uno por juez (palabras clave, significado, clics), cada uno con una columna de tarjetas de documentos en orden de puesto y el puntaje del juez al lado de cada tarjeta, y un tablero de posiciones con los cinco primeros. Un escrutador recorre las boletas puesto por puesto; por cada tarjeta, una ficha vuela al tubo de ese documento, en una fila de catorce tubos al frente. La altura de una ficha es la parte de ese voto en el puntaje fusionado, 1 / (k + puesto), así que los puestos más bajos dan fichas más cortas. Cada tubo tiene una marca cada 50 puntos; un banderín marca los documentos que de verdad responden la consulta. Un dial al frente fija k, con su valor en una placa, y una placa muestra si se suman puestos o puntajes crudos.",
    ),
    body: [plate(), back, `<g data-layer="clerk"></g>`, DOC_IDS.map((_, i) => tubeBack(i) + tubeFront(i)).join(""), frontStrip(), `<g data-layer="flight"></g>`],
  });
}

// The phone lens's regions (src/lib/lens.ts), each small enough for the close-up: the first two ballots (keyword and
// meaning), the clicks ballot with the standings (the top five; "Posiciones" would wrap the lens control in
// Spanish), and the tubes in two halves.
const backBox = (x0, x1, h) => k.boxCorners({ x: x0, y: BOARD_Y - 10, w: x1 - x0, d: 24 }, 0, BOARD.z0 + h + 2);
const tubes = (i0, i1) => k.boxCorners({ x: TUBE_X[i0] - 8, y: SOCKET.y, w: TUBE_X[i1] - TUBE_X[i0] + 16, d: SOCKET.d }, 0, COL.top + 9);
export const REGIONS = [
  { id: "ballots", label: t("Ballots", "Boletas"), box: k.screenBox(P, backBox(BOARD_X.keyword - BOARD.w / 2 - 9, BOARD_X.meaning + BOARD.w / 2 + 2, BOARD.h)) },
  { id: "standings", label: "Top 5", box: k.screenBox(P, backBox(BOARD_X.clicks - BOARD.w / 2 - 7, STAND_X + STAND.w / 2 + 2, BOARD.h)) },
  { id: "tubes-a", label: "D1–D7", box: k.screenBox(P, tubes(0, 6)) },
  { id: "tubes-b", label: "D8–D14", box: k.screenBox(P, tubes(7, 13)) },
];

export const GEOMETRY = { BOARD_X, BOARD_Y, TUBE_X, TUBE_Y, DOC_IDS, COL, SCALE, SLOTS, CLERK_SCALE, JUDGE_TONE, AT: { ballot: Object.fromEntries(JUDGES.map((j) => [j, AT_BALLOT(j)])), home: HOME }, CARD_AT: Object.fromEntries(JUDGES.flatMap((j) => Array.from({ length: SLOTS }, (_, r) => [j + (r + 1), cardAt(j, r + 1)]))) };

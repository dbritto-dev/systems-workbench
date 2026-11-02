// A count room for ranked ballots: reciprocal rank fusion you can watch.
//   three judges (rankers) post ranked ballots on boards at the back: a column of document cards, best first;
//   a counting clerk walks the ballots rank by rank; for each card a token flies into that document's tube;
//   a token's height is the vote's share of the fused score, 1 / (k + rank), so it shrinks with rank;
//   each tube has a counter and the standings board shows the current top five.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate, digitCounter, person, card, plaque, dial, pennant, faceText } from "../../workbench/parts.mjs";
import { QUERY, JUDGES } from "./sim.js";

export const WIDTH = 720;
export const HEIGHT = 470;

const PLATE = { x: -150, y: -86, w: 300, d: 140, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// Ballot boards along the back. Their front face is at BOARD_Y; rank 1 at the top.
export const BOARD_Y = -58;
export const BOARD_X = { keyword: -110, meaning: -40, clicks: 30 };
const BOARD = { w: 30, z0: 4, h: 56, d: 4 };
export const SLOTS = 8;
export const CARD = { w: 15, h: 4.8, pitch: 5.6 };
export const slotZ = (rank) => BOARD.z0 + BOARD.h - 9 - CARD.h - (rank - 1) * CARD.pitch;
export const CARD_X = (cx) => cx - 8;
const STAND_X = 112;
export const JUDGE_NAME = { keyword: "KEYWORD", meaning: "MEANING", clicks: "CLICKS" };
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

const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const seg = (a, b) => k.segment(a, b, P);

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -40, y: 36, w: 96, d: 6, r: 1 })
    + labelPlate(P, { x: 70, y: 31, w: 52, d: 14, r: 1.5 }, [[75, 35.5, 34], [75, 39.5, 40]]);
}

// A ballot board on a low pedestal: the judge's name at the top, rank numbers down the left,
// a card per document in rank order, and the score the judge gave on the right.
function ballot(judge) {
  const cx = BOARD_X[judge];
  const out = [`<g data-judge="${judge}">`];
  out.push(S(k.slabOf({ x: cx - 18, y: BOARD_Y - 8, w: 36, d: 11, r: 1 }, 0, BOARD.z0, P, 3, 0.4), { tone: "mid" }));
  out.push(person(P, [cx - 23, BOARD_Y - 4, 0], { scale: 0.74, hat: "brim" }));
  const board = { x: cx - BOARD.w / 2, y: BOARD_Y - BOARD.d, w: BOARD.w, d: BOARD.d, r: 0.6 };
  out.push(S(k.slabOf(board, BOARD.z0, BOARD.h, P, 2, 0.4), { tone: "mid", crease: "lo" }));
  const top = BOARD.z0 + BOARD.h;
  out.push(faceText(P, [cx, BOARD_Y, top - 6.4], JUDGE_NAME[judge], { size: 3.4, tone: "hi", anchor: "middle" }));
  out.push(L(seg([cx - BOARD.w / 2 + 1.5, BOARD_Y, top - 8.2], [cx + BOARD.w / 2 - 1.5, BOARD_Y, top - 8.2]), { tone: "lo" }));
  const list = QUERY.lists[judge];
  for (let r = 1; r <= SLOTS; r++) {
    const z = slotZ(r);
    const [id, raw] = list[r - 1];
    out.push(`<g data-slot="${judge}-${r}">`);
    out.push(faceText(P, [cx - 12.2, BOARD_Y, z + 1.2], String(r), { size: 2.9, tone: "mid", anchor: "middle" }));
    out.push(`<g class="wb-lit-group" data-card="${judge}-${r}">`);
    out.push(card(P, { x: CARD_X(cx), y: BOARD_Y + 0.6, z, w: CARD.w, h: CARD.h, text: id, size: 3, tone: JUDGE_TONE[judge] }));
    out.push(`</g>`);
    out.push(faceText(P, [cx + 11.6, BOARD_Y, z + 1.4], judge === "clicks" ? String(raw) : judge === "meaning" ? raw.toFixed(2) : raw.toFixed(1), { size: 2, tone: "mid", anchor: "middle" }));
    out.push(`</g>`);
  }
  // the judge's weight, on a plaque in front of the pedestal
  out.push(plaque(P, { x: cx - 6, y: BOARD_Y + 4.4, z: 0, w: 12, d: 6, text: "×1", attr: `data-weight="${judge}"` }));
  out.push(`</g>`);
  return out.join("");
}

// The standings board: the current top five, place numbers down the left.
function standings() {
  const cx = STAND_X;
  const out = [];
  out.push(S(k.slabOf({ x: cx - 18, y: BOARD_Y - 8, w: 36, d: 11, r: 1 }, 0, BOARD.z0, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: cx - 17, y: BOARD_Y - BOARD.d, w: 34, d: BOARD.d, r: 0.6 }, BOARD.z0, BOARD.h, P, 2, 0.4), { tone: "mid", crease: "lo" }));
  const top = BOARD.z0 + BOARD.h;
  out.push(faceText(P, [cx, BOARD_Y, top - 6.4], "STANDINGS", { size: 3.2, tone: "hi", anchor: "middle" }));
  out.push(L(seg([cx - 15.5, BOARD_Y, top - 8.2], [cx + 15.5, BOARD_Y, top - 8.2]), { tone: "lo" }));
  for (let p = 1; p <= 5; p++) {
    const z = top - 9 - 7.4 - (p - 1) * 8.6;
    out.push(faceText(P, [cx - 12.6, BOARD_Y, z + 2], String(p), { size: 4.2, tone: "hi", anchor: "middle" }));
    out.push(`<g class="wb-lit-group" data-place="${p}">`);
    out.push(card(P, { x: cx - 8.4, y: BOARD_Y + 0.6, z, w: 22, h: 7.4, text: "–", sub: "0 pts", size: 3.6, subSize: 2.3, attr: `data-place-id="${p}"`, subAttr: `data-place-pts="${p}"` }));
    out.push(`</g>`);
  }
  return out.join("");
}

// A tube: a socket with the document's id and a points counter, a back plate with a tick every 50 points,
// a token stack (filled live) between the back plate and two front posts, and a pennant if the document
// really answers the question.
function tubeBack(i) {
  const tx = TUBE_X[i], id = DOC_IDS[i];
  const out = [`<g data-tube="${id}">`];
  out.push(S(k.slabOf({ x: tx - 6.5, y: SOCKET.y, w: 13, d: SOCKET.d, r: 1 }, 0, SOCKET.h, P, 3, 0.4), { tone: "mid" }));
  const front = SOCKET.y + SOCKET.d;
  out.push(faceText(P, [tx, front, 5.4], id, { size: 2.8, tone: "hi", anchor: "middle" }));
  out.push(digitCounter(P, { x: tx - 5.1, y: front, z: 0.9, count: 4, w: 2.3, h: 3.5, gap: 0.3, pad: 0.4, proud: 0.6, name: "pts-" + id }));
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

// The k dial (needle on a log scale, 1 to 1000) and the fusion-mode plaque, low on the front strip.
function frontStrip() {
  const out = [];
  out.push(dial(P, { x: -122, y: 38, r: 8.5, h: 4.5, ticks: 30, every: 10, from: -Math.PI * 0.75, span: Math.PI * 1.5, name: "k", value: Math.log10(60) / 3, label: "k" }));
  for (const [v, a] of [["1", 0], ["10", 1 / 3], ["100", 2 / 3], ["1000", 1]]) {
    const ang = -Math.PI * 0.75 + a * Math.PI * 1.5;
    out.push(faceText(P, [-122 + Math.sin(ang) * 12.6, 38 - Math.cos(ang) * 12.6 + 1, 0], v, { face: "top", size: 2.4, tone: "mid", anchor: "middle" }));
  }
  out.push(`<g class="wb-lit-group" data-mode>${plaque(P, { x: -100, y: 32, z: 0, w: 46, d: 10, text: "1 / (k + rank)", size: 4, attr: "data-mode-text" })}</g>`);
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
    label:
      "A count room on a base plate. Along the back stand three ballot boards, one per judge (keyword, meaning, clicks), each a column of document cards in rank order with the judge's score beside each card, and a standings board showing the top five. A counting clerk walks along the ballots rank by rank; for each card a token flies into that document's tube in a row of fourteen tubes along the front. A token's height is that vote's share of the fused score, 1 / (k + rank), so later ranks give shorter tokens. Each tube has a points counter and a tick every 50 points; a pennant marks the documents that really answer the query. A dial on the front sets k, and a plaque shows whether ranks or raw scores are being added.",
    body: [plate(), back, `<g data-layer="clerk"></g>`, DOC_IDS.map((_, i) => tubeBack(i) + tubeFront(i)).join(""), frontStrip(), `<g data-layer="flight"></g>`],
  });
}

export const GEOMETRY = { BOARD_X, BOARD_Y, TUBE_X, TUBE_Y, DOC_IDS, COL, SCALE, SLOTS, CLERK_SCALE, JUDGE_TONE, AT: { ballot: Object.fromEntries(JUDGES.map((j) => [j, AT_BALLOT(j)])), home: HOME }, CARD_AT: Object.fromEntries(JUDGES.flatMap((j) => Array.from({ length: SLOTS }, (_, r) => [j + (r + 1), cardAt(j, r + 1)]))) };

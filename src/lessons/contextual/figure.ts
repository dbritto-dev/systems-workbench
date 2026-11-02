// @ts-nocheck: figure code ported as-is; drawing shorthands come from src/lib/draw.
// A print shop that indexes documents, and a front counter that answers questions from the index.
//   back: a stack of bound reports; a guillotine cuts each one into chunk cards (the cover, which says whose
//         report it is, is left behind); a context press reads the whole booklet lying on its head and stamps a
//         header strip on every card; the cards are filed in two cabinets: WORDS (the BM25 index) and MEANING
//         (the embedding map);
//   front: the question on a board; a rack that receives the first 150 candidates; an inspector (the reranker)
//          who picks the best into the tray that is passed on to the model; a scoreboard of questions asked and
//          answers missed. The answer chunk is the lit card wherever it is.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate, digitCounter, person, meter, sign, lamp, faceText, variants } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -134, y: -94, w: 268, d: 150, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// ---------- back row: the indexing line ----------
const STACK = { x: -128, y: -86, w: 24, d: 20, r: 1.4 };
const STACK_H = 9;
export const BOOK = { w: 16, d: 12, h: 1.8 };
export const STACK_TOP = [STACK.x + STACK.w / 2, STACK.y + STACK.d / 2, STACK_H];

const GUIL = { x: -100, y: -88, w: 24, d: 28, r: 1.2 };
const GUIL_H = 8;
export const GUIL_CX = GUIL.x + GUIL.w / 2;
const POST_Y = [GUIL.y + 2, GUIL.y + GUIL.d - 2];
export const BLADE = { z0: 13, z1: 27 };

const BELT = { x: -74, y: -80, w: 118, d: 12, r: 1 };
const BELT_H = 8;
export const BELT_Y = BELT.y + BELT.d / 2;
export const BELT_Z = BELT_H + 0.4;
export const BELT_X0 = BELT.x + 3, BELT_X1 = BELT.x + BELT.w - 3;

export const PRESS_X = -28;
const PRESS_HEAD = { x: PRESS_X - 8, y: -88, w: 16, d: 28, r: 1 };
const HEAD_Z = 24, HEAD_H = 8;
export const RAM = { z0: 9.2, z1: 19 };
export const OPEN_BOOK = [PRESS_X, -74, HEAD_Z + HEAD_H];

const WORDS = { x: 50, y: -90, w: 30, d: 22, r: 1.2 };
const WORDS_H = 26;
const MAP = { x: 86, y: -90, w: 42, d: 22, r: 1.4 };
const MAP_H = 11;

// ---------- front row: answering a question ----------
const RACK = { x: -100, y: -30, w: 100, d: 14, r: 1 };
const RACK_H = 9;
export const BINS = 15;
export const BIN_X = Array.from({ length: BINS }, (_, i) => RACK.x + 4.2 + i * 6.4);
export const BIN_Y = RACK.y + RACK.d / 2;
export const BIN_Z = RACK_H + 0.2;

const TABLE = { x: 10, y: -30, w: 22, d: 14, r: 1.2 };
const TABLE_H = 9;
const INSPECTOR = [21, -40];

const TRAY = { x: 42, y: -32, w: 66, d: 24, r: 1.4 };
const TRAY_H = 7;
export const SLOTS = 20;
export const SLOT = Array.from({ length: SLOTS }, (_, i) => [TRAY.x + 6 + (i % 10) * 6.1, TRAY.y + 6.2 + Math.floor(i / 10) * 11, TRAY_H + 0.2]);

const BOARD = { x: -132, y: 2, z: 13, w: 50, h: 8 };
const ASKER = [-116, -14];

const SCORE = { x: -58, y: 12, w: 96, d: 22, r: 1.6 };
const SCORE_H = 16;

export const CARD = { w: 4.8, d: 7.2, h: 0.6, strip: 2.6 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [GUIL_CX, POST_Y[0], 36], [PRESS_X, -88, HEAD_Z + HEAD_H + 10], [WORDS.x, WORDS.y, WORDS_H + 8], [MAP.x + MAP.w, MAP.y, MAP_H + 8], [INSPECTOR[0], INSPECTOR[1], 26], [ASKER[0], ASKER[1], 26]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 50 },
);

const { S, L, D, at, seg } = shorthand(P);
const label = (x, y, z, text, size = 2.6, face = "y") => faceText(P, [x, y, z], text, { size, tone: "mid", face });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -128, y: 46, w: 62, d: 6, r: 1 })
    + labelPlate(P, { x: 58, y: 30, w: 54, d: 14, r: 1.5 }, [[63, 35, 34], [63, 39, 42]]);
}

// A bound booklet lying flat at the origin, cover text on top (the company and quarter): drawn once,
// moved with translateAlong. `attr` names its cover text for live updates.
export function bookletSvg(attr = "data-cover", lit = false) {
  const b = { x: -BOOK.w / 2, y: -BOOK.d / 2, w: BOOK.w, d: BOOK.d, r: 0.6 };
  return S(k.slabOf(b, 0, BOOK.h, P, 2, 0.2), { tone: "hi", crease: "lo", lit })
    + L(k.lineOnTop([b.x + 1.6, b.y + 0.6], [b.x + 1.6, b.y + b.d - 0.6], BOOK.h, P), { tone: "lo" })
    + faceText(P, [1, 1.2, BOOK.h], "ACME Q2", { face: "top", size: 2.5, tone: "hi", anchor: "middle", attr });
}

// A chunk card lying flat at the origin: a white card with two lines of text and, once stamped, the
// header strip at its far end (the context). The answer card is drawn lit.
export function cardSvg() {
  const b = { x: -CARD.w / 2, y: -CARD.d / 2, w: CARD.w, d: CARD.d, r: 0.3 };
  const out = [`<g class="wb-lit-group">`];
  out.push(S(k.slabOf(b, 0, CARD.h, P, 2, 0.1), { tone: "hi", crease: "lo" }).replace('class="iso-solid"', 'class="iso-solid" data-body'));
  out.push(`<g data-on-lit="stroke">${L(k.lineOnTop([b.x + 0.8, b.y + 3.4], [b.x + b.w - 0.8, b.y + 3.4], CARD.h, P) + k.lineOnTop([b.x + 0.8, b.y + 5], [b.x + b.w - 1.6, b.y + 5], CARD.h, P), { tone: "faint" })}</g>`);
  out.push(`<g data-strip style="display:none">${S(k.slabOf({ x: b.x + 0.2, y: b.y + 0.2, w: b.w - 0.4, d: CARD.strip, r: 0.2 }, CARD.h, 0.5, P, 2), { tone: "lo", crease: "lo" })}${L(k.lineOnTop([b.x + 0.9, b.y + 1.2], [b.x + b.w - 0.9, b.y + 1.2], CARD.h + 0.5, P), { tone: "hi" })}</g>`);
  out.push(`</g>`);
  return out.join("");
}

// The stack of reports waiting to be cut.
function stack() {
  const out = [S(k.slabOf(STACK, 0, STACK_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(STACK, 2), STACK_H, P), { tone: "faint" }));
  for (let i = 0; i < 3; i++) out.push(`<g transform="${k.translateAlong(P, [STACK_TOP[0], STACK_TOP[1], STACK_TOP[2] + i * BOOK.h])}">${bookletSvg(i === 2 ? "data-cover-stack" : "data-cover-under")}</g>`);
  return out.join("");
}

// The guillotine: a bed, two posts, a crossbeam and the blade (moved live), with the booklet being cut.
function guillotineBack() {
  const out = [S(k.slabOf(GUIL, 0, GUIL_H, P, 3, 0.5), { tone: "mid" })];
  out.push(S(k.cylinder(GUIL_CX, POST_Y[0], 1.4, GUIL_H, 26, P, 14), { tone: "mid", crease: "none" }));
  out.push(`<g data-cutting transform="${k.translateAlong(P, [GUIL_CX + 1, GUIL.y + GUIL.d / 2, GUIL_H])}">${bookletSvg("data-cover-cut")}</g>`);
  return out.join("");
}
function guillotineFront() {
  const out = [];
  out.push(`<g data-blade>${S(k.slabOf({ x: GUIL_CX - 1.2, y: GUIL.y + 1, w: 2.4, d: GUIL.d - 2, r: 0.3 }, BLADE.z1, 3.2, P, 2), { tone: "hi", crease: "lo" })}</g>`);
  out.push(S(k.cylinder(GUIL_CX, POST_Y[1], 1.4, GUIL_H, 26, P, 14), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: GUIL_CX - 2, y: GUIL.y, w: 4, d: GUIL.d, r: 0.5 }, GUIL_H + 26, 3, P, 2), { tone: "mid", crease: "lo" }));
  return out.join("");
}

// The belt carrying cards from the guillotine to the cabinets.
function belt() {
  const out = [S(k.slabOf(BELT, 0, BELT_H, P, 3, 0.5), { tone: "mid" })];
  const ribs = [];
  for (let x = BELT.x + 4; x < BELT.x + BELT.w - 2; x += 6) ribs.push(k.lineOnTop([x, BELT.y + 1.4], [x, BELT.y + BELT.d - 1.4], BELT_H, P));
  out.push(L(ribs.join(""), { tone: "faint" }));
  return out.join("");
}

// The context press: two posts astride the belt, a head with the open booklet it reads, a ram that stamps
// the header strip, and the cost meter on the head's front.
function pressBack() {
  return S(k.cylinder(PRESS_X, PRESS_HEAD.y + 2, 1.5, 0, HEAD_Z, P, 14), { tone: "mid", crease: "none" });
}
function pressFront() {
  const out = [];
  out.push(`<g data-ram>${S(k.slabOf({ x: PRESS_X - 3, y: BELT.y + 2, w: 6, d: BELT.d - 4, r: 0.4 }, RAM.z0, 2, P, 2), { tone: "hi", crease: "lo" })}${S(k.cylinder(PRESS_X, BELT_Y, 0.9, RAM.z0 + 2, HEAD_Z - RAM.z0 - 2, P, 12), { tone: "mid", crease: "none" })}</g>`);
  out.push(S(k.cylinder(PRESS_X, PRESS_HEAD.y + PRESS_HEAD.d - 2, 1.5, 0, HEAD_Z, P, 14), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf(PRESS_HEAD, HEAD_Z, HEAD_H, P, 3, 0.6), { tone: "mid", crease: "lo" }));
  // the booklet the press is reading: open on the head
  const left = { x: PRESS_X - 7.4, y: OPEN_BOOK[1] - 6, w: 7.2, d: 12, r: 0.4 }, right = { ...left, x: PRESS_X + 0.2 };
  out.push(`<g data-reading>${S(k.slabOf(left, HEAD_Z + HEAD_H, 0.8, P, 2), { tone: "hi", crease: "lo" })}${S(k.slabOf(right, HEAD_Z + HEAD_H, 0.8, P, 2), { tone: "hi", crease: "lo" })}`
    + L([1, 2.6, 4.2, 5.8, 7.4, 9].map((dy) => k.lineOnTop([right.x + 1, right.y + dy + 0.6], [right.x + right.w - 1, right.y + dy + 0.6], HEAD_Z + HEAD_H + 0.8, P)).join(""), { tone: "faint" })
    + faceText(P, [left.x + left.w / 2, left.y + 7, HEAD_Z + HEAD_H + 0.8], "ACME", { face: "top", size: 2.2, tone: "hi", anchor: "middle", attr: "data-cover-read" })
    + faceText(P, [left.x + left.w / 2, left.y + 10, HEAD_Z + HEAD_H + 0.8], "Q2 2023", { face: "top", size: 1.7, tone: "mid", anchor: "middle", attr: "data-cover-read2" })
    + `</g>`);
  const front = PRESS_HEAD.y + PRESS_HEAD.d;
  out.push(meter(P, { x: PRESS_X, y: front, z: HEAD_Z + 1.4, r: 4.6, ticks: 8, name: "cost", value: 0.25 }));
  out.push(`<g data-press-off style="display:none">${L(seg([PRESS_HEAD.x + 1, front, HEAD_Z + 1], [PRESS_HEAD.x + PRESS_HEAD.w - 1, front, HEAD_Z + HEAD_H - 1]) + seg([PRESS_HEAD.x + 1, front, HEAD_Z + HEAD_H - 1], [PRESS_HEAD.x + PRESS_HEAD.w - 1, front, HEAD_Z + 1]), { tone: "hi" })}</g>`);
  return out.join("");
}
// labels for the press and its meter, printed on the plate in front of it
function pressLabels() {
  return faceText(P, [PRESS_X - 22, BELT.y + BELT.d, 3.2], t("CONTEXT PRESS · DIAL: $ PER M TOKENS", "PRENSA DE CONTEXTO · DIAL: $ POR M TOKENS"), { size: 2.1, tone: "mid" });
}

// The two cabinets the cards are filed in. Each has a lamp on top that lights while it is searched,
// and a crossed band across its front when it isn't used at all.
function cabinets() {
  const out = [];
  const wf = WORDS.y + WORDS.d;
  out.push(S(k.slabOf(WORDS, 0, WORDS_H, P, 3, 0.6), { tone: "mid" }));
  const drawers = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) drawers.push(faceRectY(WORDS.x + 2 + c * 9, WORDS.x + 10 + c * 9, wf, 2 + r * 5.6, 6.8 + r * 5.6));
  out.push(L(drawers.join(""), { tone: "lo" }));
  out.push(D([0, 1, 2, 3].flatMap((r) => [0, 1, 2].map((c) => at([WORDS.x + 6 + c * 9, wf, 4.4 + r * 5.6]))), { size: 0.5, tone: "mid" }));
  out.push(faceText(P, [WORDS.x + WORDS.w / 2, wf, WORDS_H - 3.6], t("WORDS", "PALABRAS"), { size: 2.6, tone: "hi", anchor: "middle" }));
  out.push(`<g data-off-band="words" style="display:none">${L(seg([WORDS.x + 1, wf, 1], [WORDS.x + WORDS.w - 1, wf, WORDS_H - 6]) + seg([WORDS.x + 1, wf, WORDS_H - 6], [WORDS.x + WORDS.w - 1, wf, 1]), { tone: "hi" })}</g>`);
  out.push(`<g data-lamp="words">${variants("lamp-words", { off: lamp(P, [WORDS.x + WORDS.w - 5, WORDS.y + 5, WORDS_H], { r: 2.2 }), on: lamp(P, [WORDS.x + WORDS.w - 5, WORDS.y + 5, WORDS_H], { r: 2.2, lit: true }) }, "off")}</g>`);
  // the meaning map: a table whose top is a map of clusters of pins
  out.push(S(k.slabOf(MAP, 0, MAP_H, P, 3, 0.6), { tone: "mid", inner: L(k.planOutline(k.insetPlan(MAP, 1.8), MAP_H, P), { tone: "lo" }) }));
  const r = mulberry(5), pins = [];
  for (const [cx, cy] of [[MAP.x + 8, MAP.y + 7], [MAP.x + 19, MAP.y + 15], [MAP.x + 30, MAP.y + 7], [MAP.x + 35, MAP.y + 16], [MAP.x + 10, MAP.y + 16]]) for (let i = 0; i < 9; i++) pins.push(at([cx + (r() - 0.5) * 6, cy + (r() - 0.5) * 5, MAP_H]));
  out.push(D(pins, { size: 0.55, tone: "mid" }));
  out.push(faceText(P, [MAP.x + MAP.w / 2, MAP.y + MAP.d, MAP_H - 4.4], t("MEANING", "SIGNIFICADO"), { size: 2.6, tone: "hi", anchor: "middle" }));
  out.push(`<g data-lamp="map">${variants("lamp-map", { off: lamp(P, [MAP.x + MAP.w - 4, MAP.y + 4, MAP_H], { r: 2.2 }), on: lamp(P, [MAP.x + MAP.w - 4, MAP.y + 4, MAP_H], { r: 2.2, lit: true }) }, "off")}</g>`);
  return out.join("");
}
const faceRectY = (x0, x1, y, z0, z1) => k.pathOf([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]].map(at), true);
function mulberry(seed) { let a = seed; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// The person asking, and the question on a board in front of them.
function asker() {
  return person(P, [ASKER[0], ASKER[1], 0], { scale: 0.78 });
}
function board() {
  const out = [sign(P, { x: BOARD.x, y: BOARD.y, z: BOARD.z, w: BOARD.w, h: BOARD.h, text: "ACME SALES Q2 2023", size: 2.8, attr: "data-question" })];
  out.push(faceText(P, [BOARD.x + 1.4, BOARD.y, BOARD.z + BOARD.h + 1], t("QUESTION", "PREGUNTA"), { size: 2, tone: "mid" }));
  return out.join("");
}

// The rack: 15 bins of 10 candidates each (the first 150, best on the left), with the answer's rank on a counter.
function rack() {
  const front = RACK.y + RACK.d;
  const out = [S(k.slabOf(RACK, 0, RACK_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(BIN_X.map((x) => k.planOutline({ x: x - 2.9, y: RACK.y + 2, w: 5.8, d: RACK.d - 4, r: 0.4 }, RACK_H, P)).join(""), { tone: "faint" }));
  BIN_X.forEach((x, i) => {
    out.push(`<g data-bin="${i}" style="display:none">`);
    for (let j = 0; j < 3; j++) out.push(S(k.slabOf({ x: x - 2.4, y: BIN_Y - 3.6, w: 4.8, d: 7.2, r: 0.3 }, RACK_H + j * 1.3, 1.1, P, 2, 0.1), { tone: "hi", crease: "lo" }));
    out.push(`</g>`);
  });
  out.push(digitCounter(P, { x: RACK.x + 4, y: front, z: 1.6, count: 3, w: 4, h: 5.2, gap: 0.6, pad: 1.1, name: "pooled" }));
  out.push(label(RACK.x + 20, front, 4.4, t("CANDIDATES", "CANDIDATOS"), 2.2), label(RACK.x + 20, front, 1.6, t("FIRST 150, BEST ON THE LEFT", "PRIMEROS 150, MEJOR A LA IZQ."), 1.8));
  out.push(digitCounter(P, { x: RACK.x + RACK.w - 36, y: front, z: 1.6, count: 4, w: 4, h: 5.2, gap: 0.6, pad: 1.1, name: "rank" }));
  out.push(label(RACK.x + RACK.w - 16, front, 4.4, t("ANSWER'S", "PUESTO DE"), 2.2), label(RACK.x + RACK.w - 16, front, 1.6, t("RANK", "RESPUESTA"), 2.2));
  return out.join("");
}

// The inspector (the reranker) behind a table, or an empty table with a crossed band when reranking is off.
function inspector() {
  return variants("inspector", { on: person(P, [INSPECTOR[0], INSPECTOR[1], 0], { scale: 0.8, hat: "cap", holding: "clipboard" }), off: "" }, "on");
}
function table() {
  const front = TABLE.y + TABLE.d;
  const out = [S(k.slabOf(TABLE, 0, TABLE_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(TABLE, 1.6), TABLE_H, P), { tone: "faint" }) })];
  out.push(faceText(P, [TABLE.x + TABLE.w / 2, front, 3.2], t("RERANK", "RERANKING"), { size: 2.4, tone: "mid", anchor: "middle" }));
  out.push(`<g data-off-band="rerank" style="display:none">${L(seg([TABLE.x + 1, front, 0.8], [TABLE.x + TABLE.w - 1, front, TABLE_H - 0.8]) + seg([TABLE.x + 1, front, TABLE_H - 0.8], [TABLE.x + TABLE.w - 1, front, 0.8]), { tone: "hi" })}</g>`);
  return out.join("");
}

// The tray of chunks passed on to the model: 20 places, the best first; the number passed on is on its counter.
function tray() {
  const front = TRAY.y + TRAY.d;
  const out = [S(k.slabOf(TRAY, 0, TRAY_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(TRAY, 1.6), TRAY_H, P), { tone: "lo" }) })];
  out.push(L(SLOT.map(([x, y, z]) => k.planOutline({ x: x - 2.6, y: y - 3.8, w: 5.2, d: 7.6, r: 0.4 }, TRAY_H, P)).join(""), { tone: "faint" }));
  out.push(digitCounter(P, { x: TRAY.x + 3, y: front, z: 1.2, count: 2, w: 3.6, h: 4.6, gap: 0.5, pad: 0.9, name: "k" }));
  out.push(label(TRAY.x + 13, front, 1.8, t("PASSED TO THE MODEL", "PASADOS AL MODELO"), 2.2));
  return out.join("");
}

// The scoreboard: questions asked and answers missed (not among the chunks passed on), a failure-rate meter
// and a lamp that lights when the current answer was missed.
function scoreboard() {
  const front = SCORE.y + SCORE.d;
  const out = [S(k.slabOf(SCORE, 0, SCORE_H, P, 3, 0.6), { tone: "mid" })];
  out.push(digitCounter(P, { x: SCORE.x + 5, y: front, z: 3, count: 3, w: 5.2, h: 7, gap: 0.8, pad: 1.4, name: "asked" }));
  out.push(label(SCORE.x + 5, front, 12, t("ASKED", "PREGUNTAS"), 2.6));
  out.push(digitCounter(P, { x: SCORE.x + 30, y: front, z: 3, count: 3, w: 5.2, h: 7, gap: 0.8, pad: 1.4, name: "missed" }));
  out.push(label(SCORE.x + 30, front, 12, t("MISSED", "FALLADAS"), 2.6));
  out.push(meter(P, { x: SCORE.x + 70, y: front, z: 3.6, r: 7.4, ticks: 8, zone: 0.5, name: "failrate", value: 0.2 }));
  out.push(label(SCORE.x + 61, front, 12, t("FAILED  0-40%", "FALLAS  0-40%"), 2.4));
  out.push(`<g data-miss-lamp>${variants("miss", { off: lamp(P, [SCORE.x + SCORE.w - 6, SCORE.y + 6, SCORE_H], { r: 2.6 }), on: lamp(P, [SCORE.x + SCORE.w - 6, SCORE.y + 6, SCORE_H], { r: 2.6, lit: true }) }, "off")}</g>`);
  out.push(faceText(P, [SCORE.x + SCORE.w - 16, SCORE.y + 8, SCORE_H], t("MISS", "FALLA"), { face: "top", size: 2.4, tone: "mid", anchor: "middle" }));
  return out.join("");
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A print shop on a base plate. At the back, bound reports wait in a stack; a guillotine cuts each one into small chunk cards and drops them on a belt. Halfway along, a context press reads the whole report lying open on its head and stamps a dark header strip onto each card; a dial on its front shows what that costs per million tokens. At the end of the belt the cards are filed in two cabinets, a drawer cabinet marked WORDS (the keyword index) and a map table marked MEANING (the embedding map), each with a lamp. In front, a person asks a question written on a board; the first 150 candidates come back into a rack of fifteen bins, best on the left; an inspector at a rerank table picks the best into a tray of up to twenty places passed to the model. The answer chunk is the lit card. A scoreboard counts questions asked and answers missed, with a failure-rate meter and a lamp that lights on a miss.",
      "Una imprenta sobre una placa base. Al fondo, los informes encuadernados esperan en una pila; una guillotina corta cada uno en pequeñas tarjetas de fragmentos y las deja sobre una cinta. A mitad de camino, una prensa de contexto lee el informe completo abierto sobre su cabezal y estampa una franja oscura de encabezado en cada tarjeta; un dial en su frente muestra cuánto cuesta eso por millón de tokens. Al final de la cinta, las tarjetas se archivan en dos gabinetes, un gabinete de cajones marcado PALABRAS (el índice de palabras clave) y una mesa con un mapa marcada SIGNIFICADO (el mapa de embeddings), cada uno con una lámpara. Adelante, una persona hace una pregunta escrita en un tablero; los 150 primeros candidatos vuelven a un estante de quince casilleros, el mejor a la izquierda; un inspector en una mesa de reranking elige los mejores para una bandeja de hasta veinte lugares que se pasa al modelo. El fragmento con la respuesta es la tarjeta encendida. Un marcador cuenta las preguntas hechas y las respuestas falladas, con un medidor de la tasa de fallas y una lámpara que se enciende con cada falla.",
    ),
    body: [
      plate(),
      stack(),
      guillotineBack(),
      pressBack(),
      belt(),
      pressLabels(),
      `<g data-layer="belt"></g>`,
      guillotineFront(),
      pressFront(),
      cabinets(),
      asker(),
      rack(),
      `<g data-layer="rack"></g>`,
      inspector(),
      table(),
      tray(),
      `<g data-layer="tray"></g>`,
      board(),
      scoreboard(),
    ],
  });
}

export const GEOMETRY = { BELT_Y, BELT_Z, BELT_X0, BELT_X1, PRESS_X, GUIL_CX, BLADE, RAM, BIN_X, BIN_Y, BIN_Z, SLOT, BINS, SLOTS, CARD, GUIL_TOP: GUIL_H, STACK_TOP };

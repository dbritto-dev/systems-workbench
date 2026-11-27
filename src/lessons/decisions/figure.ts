// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// Two desks on one base plate answer the same tickets. At the back, the inbox: each ticket arrives there and both
// desks get a copy. On the left, the writing desk: the scribe behind it reads the ticket, then writes the reply one
// token at a time, each token a tile on the bed; the reply slip stands in front, and slides to the parser, a gate
// whose arm rises for a reply that is one of the options and stays down for one that isn't (that slip goes back and
// is written again); accepted slips stand on the tray past the gate. On the right, the sorting desk: the reader reads
// the ticket once, and a row of bins, one per option (eight shown, +N for the rest), each with a bar behind it,
// gets every score at the same moment; the highest takes the ticket, or the review tray does when the answer is NONE
// or too unsure. Clocks and counters on both desks' fronts.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, person, plaque, faceText } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { SHOWN } from "./sim";

export const WIDTH = 700;
export const HEIGHT = 440;

const PLATE = { x: -122, y: -88, w: 244, d: 132, r: 8 };
const PLATE_H = 12, FOOT_H = 5;
export const CAP = 2.9;              // counter captions

// ---------- the inbox, at the back ----------
const INBOX = { x: -12, y: -84, w: 24, d: 20, r: 1.4 };
const INBOX_H = 10;
export const INBOX_AT = [0, INBOX.y + 12, INBOX_H];

// ---------- the writing desk, on the left ----------
const WDESK = { x: -117, y: -46, w: 103, d: 70, r: 1.8 };
export const DESK_H = 14;
const W_FRONT = WDESK.y + WDESK.d;
export const SCRIBE = [-104, -55, 0];
export const W_LAND = [-113, -34, DESK_H];          // the ticket's copy, back left of the desk (card's left edge)
// the bed of token tiles
const BED = { x: -100, y: -44, w: 57, d: 24.5, r: 0.8 };
export const TILE = { cols: 12, rows: 5, w: 3.8, d: 3.6, pitch: 4.6, h: 1.1 };
export const TILES = TILE.cols * TILE.rows;
// the reply slip, and where it goes: the gate, then the tray
export const SLIP = { w: 30, h: 12 };
export const SLIP_AT = [-112, 2, DESK_H];          // left edge, face plane y, bottom
const GATE = { x: -67, y: -9, w: 12, d: 6, r: 0.6 };
const GATE_H = 5;
export const GATE_X = GATE.x + GATE.w / 2, GATE_Y = GATE.y + 3;
const TRAY = { x: -51, y: -6, w: 35, d: 16, r: 0.8 };
export const TRAY_AT = [TRAY.x + 2.5, 2, DESK_H + 1.2];

// ---------- the sorting desk, on the right ----------
const SDESK = { x: 14, y: -46, w: 103, d: 70, r: 1.8 };
const S_FRONT = SDESK.y + SDESK.d;
export const READER = [52, -56, 0];
export const S_LAND = [18, -34, DESK_H];
export const BIN = { w: 10, d: 9, h: 4, pitch: 11, x0: 19, y: 6 };
export const BAR = { dx: 2, w: 6, y: 1, d: 3, max: 34 };
export const BIN_X = Array.from({ length: SHOWN }, (_, i) => BIN.x0 + i * BIN.pitch);
const REVIEW = { x: 94, y: -40, w: 18, d: 16, r: 0.8 };
const REVIEW_H = 5;
export const REVIEW_AT = [REVIEW.x + 3.5, REVIEW.y + 9, DESK_H + 1.2];

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [SCRIBE[0], SCRIBE[1], 26], [READER[0], READER[1], 26], ...k.boxCorners({ x: BIN.x0, y: BAR.y, w: BIN_X[SHOWN - 1] + BIN.w - BIN.x0, d: BAR.d }, DESK_H, DESK_H + BAR.max)],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

const { S, L, D, at } = shorthand(P);
const cap = (x, y, z, words, opts = {}) => faceText(P, [x, y, z], words, { size: CAP, tone: "mid", ...opts });

// One counter in its own housing, its caption above.
const WH = { w: 4.2, h: 5.6, gap: 0.6 };
const span = (n) => n * WH.w + (n - 1) * WH.gap;
function counter(x, y, count, name, words) {
  const z = 2.2;
  return S(k.slabOf({ x: x - 1.2, y: y - 1.4, w: span(count) + 2.4, d: 1.4, r: 0.5 }, z - 1.2, WH.h + 2.4, P, 2), { tone: "hi", crease: "lo" })
    + digitCounter(P, { x, y, z, count, ...WH, housing: false, name })
    + cap(x - 1.2, y, z + WH.h + 3, words);
}

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + plaque(P, { x: -32, y: 29, z: 0, w: 64, d: 9, text: t("ONE TICKET · TWO DESKS", "UN TICKET · DOS MESAS"), size: 3.4 });
}

// ---------- the inbox ----------
function inbox() {
  const out = [S(k.slabOf(INBOX, 0, INBOX_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(INBOX, 2), INBOX_H, P), { tone: "faint" }));
  // a stack of waiting tickets
  for (let i = 0; i < 3; i++) out.push(S(k.slabOf({ x: INBOX.x + 4 + i * 0.6, y: INBOX.y + 4, w: 9, d: 7, r: 0.3 }, INBOX_H + i * 0.8, 0.6, P, 2, 0.1), { tone: "hi", crease: "lo" }));
  out.push(faceText(P, [INBOX.x + INBOX.w / 2, INBOX.y + INBOX.d, 3.4], t("TICKETS", "TICKETS"), { size: 3.6, tone: "hi", anchor: "middle" }));
  return out.join("");
}

// ---------- the writing desk ----------
function writingDesk() {
  const out = [S(k.slabOf(WDESK, 0, DESK_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(WDESK, 2.4), DESK_H, P), { tone: "faint" }));
  // the bed the tokens are laid on, and its caption in front
  out.push(S(k.slabOf(BED, DESK_H, 0.6, P, 3, 0.2), { tone: "lo", crease: "none" }));
  out.push(faceText(P, [BED.x + 1, BED.y + BED.d + 4.6, DESK_H], t("TOKENS WRITTEN", "TOKENS ESCRITOS"), { face: "top", size: 2.6, tone: "mid" }));
  // the tiles past the bed's room: "+N" at the end of its last row
  out.push(faceText(P, [BED.x + BED.w + 1.4, BED.y + BED.d - 1.6, DESK_H + 0.6], "", { face: "top", size: 3, tone: "hi", attr: "data-more-tokens" }));
  // the reply caption, on the desk top in front of the slip
  out.push(faceText(P, [SLIP_AT[0] + SLIP.w / 2, SLIP_AT[1] + 6.4, DESK_H], t("REPLY", "RESPUESTA"), { face: "top", size: 2.6, tone: "mid", anchor: "middle" }));
  // the tray past the gate, captioned on its top in front of the slip that lands there
  out.push(S(k.slabOf(TRAY, DESK_H, 1.2, P, 3, 0.2), { tone: "lo", crease: "none" }));
  out.push(faceText(P, [TRAY.x + TRAY.w / 2, TRAY.y + TRAY.d - 1.4, DESK_H + 1.2], t("ACCEPTED", "ACEPTADAS"), { face: "top", size: 2.6, tone: "hi", anchor: "middle" }));
  // counters on the front
  const y = W_FRONT;
  out.push(counter(WDESK.x + 5, y, 5, "wms", "MS"));
  out.push(counter(WDESK.x + 31, y, 4, "tokens", t("TOKENS", "TOKENS")));
  out.push(counter(WDESK.x + 53, y, 4, "rejected", t("REJECTED", "RECHAZADAS")));
  out.push(counter(WDESK.x + 81.5, y, 4, "wwrong", t("WRONG", "ERRÓNEAS")));
  return out.join("");
}
// The token tiles: drawn once, shown by the live code as tokens are written.
function tiles() {
  const out = [];
  for (let r = 0; r < TILE.rows; r++) for (let c = 0; c < TILE.cols; c++) {
    const x = BED.x + 1.4 + c * TILE.pitch, y = BED.y + 1.2 + r * TILE.pitch;
    out.push(`<g data-tile="${r * TILE.cols + c}" style="display:none">${S(k.slabOf({ x, y, w: TILE.w, d: TILE.d, r: 0.3 }, DESK_H + 0.6, TILE.h, P, 2, 0.1), { tone: "hi", crease: "lo" })}</g>`);
  }
  return out.join("");
}
// The parser: a gate beside the slip's path, whose arm stands up to let an accepted reply through and lies across
// the path otherwise. The standing arm is behind the path and the lying arm in front of it, so they are drawn on
// either side of the slips (two variant groups, posed together).
const PIVOT = DESK_H + GATE_H + 3;
function gate() {
  const out = [S(k.slabOf(GATE, DESK_H, GATE_H, P, 3, 0.3), { tone: "mid", crease: "lo" })];
  out.push(faceText(P, [GATE.x + GATE.w / 2, GATE.y + GATE.d, DESK_H + 1.4], "PARSER", { size: 2.3, tone: "hi", anchor: "middle" }));
  out.push(S(k.cylinder(GATE_X, GATE_Y, 1.1, DESK_H + GATE_H, 4, P, 14), { tone: "mid", crease: "none" }));
  const up = S(k.slabOf({ x: GATE_X - 0.7, y: GATE_Y - 0.7, w: 1.4, d: 1.4, r: 0.3 }, PIVOT, 13, P, 2), { tone: "hi", crease: "lo" });
  return out.join("") + `<g data-variants="gate" class="wb-variants"><g data-variant="up" data-off>${up}</g><g data-variant="down"></g></g>`;
}
function gateArm() {
  const down = S(k.slabOf({ x: GATE_X - 0.7, y: GATE_Y, w: 1.4, d: 13, r: 0.3 }, PIVOT, 1.4, P, 2), { tone: "hi", crease: "lo" });
  return `<g data-variants="gate-arm" class="wb-variants"><g data-variant="up" data-off></g><g data-variant="down">${down}</g></g>`;
}
// The reply slip: an upright card with one line of text; drawn at the origin and moved with translateAlong.
export function slipSvg() {
  const plan = { x: 0, y: -0.6, w: SLIP.w, d: 0.6, r: 0.15 };
  return `<g class="wb-lit-group" data-slip>${S(k.slabOf(plan, 0, SLIP.h, P, 2, 0.15), { tone: "hi", crease: "lo" })}`
    + faceText(P, [SLIP.w / 2, 0, 5.4], "", { size: 3, tone: "hi", anchor: "middle", attr: "data-slip-text" })
    + faceText(P, [SLIP.w / 2, 0, 1.6], "", { size: 2.3, tone: "hi", anchor: "middle", attr: "data-slip-sub" }) + `</g>`;
}

// ---------- the sorting desk ----------
function sortingDesk() {
  const out = [S(k.slabOf(SDESK, 0, DESK_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(SDESK, 2.4), DESK_H, P), { tone: "faint" }));
  // the review tray, at the back right
  out.push(S(k.slabOf(REVIEW, DESK_H, REVIEW_H, P, 3, 0.3), { tone: "mid", inner: L(k.planOutline(k.insetPlan(REVIEW, 1.6), DESK_H + REVIEW_H, P), { tone: "lo" }) }));
  out.push(faceText(P, [REVIEW.x + REVIEW.w / 2, REVIEW.y + REVIEW.d, DESK_H + 1.2], t("REVIEW", "REVISIÓN"), { size: 2.5, tone: "hi", anchor: "middle" }));
  // the options past the eight bins: "+N" at the row's right end
  out.push(faceText(P, [BIN_X[SHOWN - 1] + BIN.w + 1.4, BIN.y + BIN.d - 1, DESK_H], "", { face: "top", size: 3.4, tone: "hi", attr: "data-more-bins" }));
  const y = S_FRONT;
  out.push(counter(SDESK.x + 5, y, 4, "sms", "MS"));
  out.push(counter(SDESK.x + 33, y, 4, "swrong", t("WRONG", "ERRÓNEAS")));
  out.push(counter(SDESK.x + 61, y, 4, "review", t("TO REVIEW", "A REVISIÓN")));
  return out.join("");
}
// A bin: an open box with the option's name on its front, and the bar behind it (drawn live).
function bin(i) {
  const x = BIN_X[i], plan = { x, y: BIN.y, w: BIN.w, d: BIN.d, r: 0.5 };
  const body = S(k.slabOf(plan, DESK_H, BIN.h, P, 3, 0.2), { tone: "hi", crease: "lo", inner: L(k.planOutline(k.insetPlan(plan, 1), DESK_H + BIN.h, P), { tone: "lo" }) });
  return `<g data-bin="${i}"><g data-bar></g><g data-binticket></g><g class="wb-lit-group" data-binbody>${body}`
    + faceText(P, [x + BIN.w / 2, BIN.y + BIN.d, DESK_H + 0.9], "", { size: 2.8, tone: "hi", anchor: "middle", attr: "data-bin-label" }) + `</g></g>`;
}

// A ticket: an upright card with its number and, below, its right answer. Drawn at the origin.
export const CARD = { w: 11, h: 12 };
export function ticketSvg() {
  const plan = { x: 0, y: -0.6, w: CARD.w, d: 0.6, r: 0.15 };
  return `<g data-ticket>${S(k.slabOf(plan, 0, CARD.h, P, 2, 0.15), { tone: "hi", crease: "lo" })}`
    + faceText(P, [CARD.w / 2, 0, 6.2], "", { size: 2.8, tone: "hi", anchor: "middle", attr: "data-ticket-no" })
    + faceText(P, [CARD.w / 2, 0, 1.8], "", { size: 2.4, tone: "hi", anchor: "middle", attr: "data-ticket-truth" }) + `</g>`;
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "Two desks on one base plate, answering the same tickets. At the back in the middle, the TICKETS inbox: each ticket, a card with its number and its right answer, arrives there and a copy goes to each desk. On the left, the writing desk: a scribe stands behind it; on its top, a bed where each token of the reply is laid as a tile, one at a time, with a +N where the bed runs out; in front, the reply slip, which slides right to the PARSER, a gate whose arm stands up for a reply that is one of the options and lies across the path for one that isn't. An accepted slip stands on the ACCEPTED tray past the gate; a rejected one lights and goes back to be written again. Counters on the writing desk's front: milliseconds for this ticket (MS), tokens written for it (TOKENS), replies the parser rejected (REJECTED) and accepted answers that were wrong (WRONG). On the right, the sorting desk: a reader stands behind it; on its top, a row of up to eight bins, one per option with the option's name on its front and a bar behind it whose height is the probability that option got, with a +N for options not shown, and a REVIEW tray at the back right. All the bars rise at the same moment and the ticket drops into the bin with the tallest, or into the REVIEW tray. Counters on its front: milliseconds for this ticket (MS), wrong answers (WRONG) and tickets sent to review (TO REVIEW). Lit: a rejected reply, an accepted reply that is wrong, and a bin holding a ticket that isn't its own.",
      "Dos mesas sobre una placa base, que responden los mismos tickets. Al fondo en el medio, la bandeja de TICKETS: cada ticket, una tarjeta con su número y su respuesta correcta, llega ahí y una copia va a cada mesa. A la izquierda, la mesa de escritura: un escriba está detrás; arriba, una cama donde cada token de la respuesta se coloca como una ficha, uno a la vez, con un +N donde se acaba la cama; adelante, la papeleta de la respuesta, que se desliza a la derecha hasta el PARSER, una barrera cuyo brazo se levanta para una respuesta que es una de las opciones y queda atravesado en el camino para una que no lo es. Una papeleta aceptada queda en la bandeja ACEPTADAS, pasada la barrera; una rechazada se enciende y vuelve a escribirse. Contadores al frente de la mesa de escritura: milisegundos de este ticket (MS), tokens escritos para él (TOKENS), respuestas que rechazó el parser (RECHAZADAS) y respuestas aceptadas que estaban mal (ERRÓNEAS). A la derecha, la mesa de clasificación: un lector está detrás; arriba, una fila de hasta ocho cajones, uno por opción con el nombre de la opción al frente y una barra detrás cuya altura es la probabilidad que recibió esa opción, con un +N para las opciones que no se muestran, y una bandeja de REVISIÓN al fondo a la derecha. Todas las barras suben en el mismo instante y el ticket cae en el cajón con la más alta, o en la bandeja de REVISIÓN. Contadores al frente: milisegundos de este ticket (MS), respuestas erróneas (ERRÓNEAS) y tickets enviados a revisión (A REVISIÓN). Encendidos: una respuesta rechazada, una respuesta aceptada que está mal y un cajón que tiene un ticket que no es el suyo.",
    ),
    body: [
      plate(),
      inbox(),
      `<g data-layer="inbox"></g>`,
      person(P, SCRIBE, { scale: 1 }),
      person(P, READER, { scale: 1 }),
      writingDesk(),
      tiles(),
      `<g data-layer="wland"></g>`,
      gate(),
      `<g data-layer="slips"></g>`,
      gateArm(),
      sortingDesk(),
      `<g data-layer="sland"></g>`,
      `<g data-layer="review"></g>`,
      Array.from({ length: SHOWN }, (_, i) => bin(i)).join(""),
      `<g data-layer="fly"></g>`,
    ],
  });
}

export const GEOMETRY = { INBOX_AT, W_LAND, S_LAND, SLIP_AT, GATE_X, TRAY_AT, REVIEW_AT, BIN, BAR, BIN_X, DESK_H, TILES, CARD, SLIP };

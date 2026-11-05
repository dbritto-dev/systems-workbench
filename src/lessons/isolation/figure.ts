// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A records office. At the back, the database: a cabinet with a board of rows. For deposits, one account card with its
// balance and what the balance should be; for the ward rota, one card per doctor with a flag up while that doctor is
// on call, and a sign that lights when nobody is. A lock tag hangs under a row while a transaction holds its lock.
// Across the middle runs a timeline tape, one lane per desk: reads (flat tiles with the value read), writes (raised
// tiles), a post at COMMIT, a cross at ROLLBACK, a dashed stretch while waiting for a lock. At the front, the desks:
// a clerk at each, the value their transaction read on a slip, and what it is doing now on the desk front.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, labelPlate, digitCounter, person, card, plaque, pennant, sign, faceText, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -108, y: -94, w: 202, d: 144, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The database: a cabinet with an upright board of rows on top.
const CAB = { x: -98, y: -88, w: 124, d: 20, r: 2 };
const CAB_H = 9;
const CAB_FRONT = CAB.y + CAB.d;
const BOARD = { x: -95, y: -83, w: 118, d: 4, r: 0.6 };
const BOARD_Z = CAB_H, BOARD_H = 42;
export const FACE = BOARD.y + BOARD.d;          // the board's front face (y)
const TOP = BOARD_Z + BOARD_H;

// Rota: one card per doctor.
export const DOC_X = [-91, -71, -51, -31];      // left edge of each doctor's card
const DOC_W = 18;
// Lock tags, under the row they lock: one spot per doctor, and one for the account.
export const TAG_Z = BOARD_Z + 3;
export const TAG_W = 9, TAG_H = 8;
export const ACCT_TAG_X = 4;

// The timeline tape: one lane per desk, time running right to left; NOW at the right end.
export const TAPE = { x: -103, y: -62, w: 190, d: 50, r: 1.4 };
export const LANE_Y = [-54, -44, -34, -24];
export const NOW_X = TAPE.x + TAPE.w - 9;
export const START_X = TAPE.x + 13;
export const TAPE_H = 0.8;

// The desks.
export const DESK_X = [-89, -61, -33, -5];      // centres
const DESK = { y: 12, w: 26, d: 12, h: 9 };
const DESK_FRONT = DESK.y + DESK.d;
const PERSON_Y = 5;

// The tally box at the front right.
const BOX = { x: 12, y: 22, w: 78, d: 18, r: 2 };
const BOX_H = 16;
const BOX_FRONT = BOX.y + BOX.d;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(BOARD, 0, TOP + 11), [DESK_X[0], PERSON_Y, 28]],
  WIDTH,
  HEIGHT,
  { pad: 12, azimuth: 50 },
);

const { S, L } = shorthand(P);
const text = (x, y, z, words, size = 3, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + labelPlate(P, { x: -100, y: 31, w: 24, d: 11, r: 1.4 }, [[-96, 35, 16], [-96, 39, 10]]);
}

// ---------- the database ----------
function cabinet() {
  const out = [S(k.slabOf(CAB, 0, CAB_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(CAB, 2.4), CAB_H, P), { tone: "faint" }));
  // the isolation level, on the cabinet front: one text the live code sets (SQL names read the same in both languages)
  out.push(text(CAB.x + 4, CAB_FRONT, 3, t("ISOLATION", "AISLAMIENTO"), 2.8));
  out.push(faceText(P, [CAB.x + 26, CAB_FRONT, 2.8], "READ COMMITTED", { size: 3.6, tone: "hi", attr: "data-level" }));
  out.push(S(k.slabOf(BOARD, BOARD_Z, BOARD_H, P, 3, 0.4), { tone: "mid", crease: "lo" }));
  out.push(L(k.faceRectY(P, BOARD.x + 2, BOARD.x + BOARD.w - 2, FACE, BOARD_Z + 2, TOP - 2), { tone: "faint" }));
  out.push(text(BOARD.x + 4, FACE, TOP - 7.4, t("DATABASE", "BASE DE DATOS"), 4));
  return out.join("");
}

// A lock tag: a small card with the holder's letter; the live code shows it and sets the letter.
function tag(x, name) {
  return `<g data-tag="${name}" style="display:none">`
    + S(k.slabOf({ x: x + TAG_W / 2 - 0.4, y: FACE, w: 0.8, d: 0.8, r: 0.2 }, TAG_Z + TAG_H, 2.4, P, 1), { tone: "mid", crease: "none" })
    + card(P, { x, y: FACE + 1.4, z: TAG_Z, w: TAG_W, h: TAG_H, text: "A", attr: `data-tag-text="${name}"`, size: 5 })
    + `</g>`;
}
const tagSpot = (x) => L(k.faceRectY(P, x - 1.2, x + TAG_W + 1.2, FACE, TAG_Z - 1.2, TAG_Z + TAG_H + 1.2), { tone: "lo" });

function accountPanel() {
  const out = [`<g data-scene="deposits">`];
  const x0 = BOARD.x + 5;
  out.push(text(x0, FACE, TOP - 15, t("ACCOUNT 7", "CUENTA 7"), 3.8, { tone: "hi" }));
  const row = (z, words, name, lit) => text(x0, FACE, z + 2, words, 3.4)
    + (lit ? `<g data-balance>` : "") + digitCounter(P, { x: x0 + 31, y: FACE, z, count: 5, w: 5.2, h: 7.4, gap: 0.6, pad: 1.2, name }) + (lit ? `</g>` : "");
  out.push(row(TOP - 26, t("BALANCE", "SALDO"), "balance", true));
  out.push(row(TOP - 38, t("SHOULD BE", "DEBERÍA SER"), "expected"));
  // the account's lock tag, with its label
  out.push(text(ACCT_TAG_X + TAG_W / 2, FACE, TOP - 14, t("ROW LOCK", "BLOQUEO"), 3, { anchor: "middle" }));
  out.push(tagSpot(ACCT_TAG_X));
  out.push(tag(ACCT_TAG_X, "acct"));
  out.push(`</g>`);
  return out.join("");
}

function rotaPanel() {
  const out = [`<g data-scene="rota" style="display:none">`];
  DOC_X.forEach((x, i) => {
    const name = "ABCD"[i];
    out.push(`<g data-doc="${i}">`);
    out.push(L(k.faceRectY(P, x, x + DOC_W, FACE, BOARD_Z + 1.4, TOP - 11), { tone: "lo" }));
    out.push(text(x + DOC_W / 2, FACE, TOP - 19, "DR " + name, 4.2, { anchor: "middle", tone: "hi" }));
    out.push(faceText(P, [x + DOC_W / 2, FACE, TOP - 25], "ON CALL", { size: 2.8, tone: "mid", anchor: "middle", attr: `data-doc-state="${i}"` }));
    // the flag on the board's top edge: up while this doctor is on call
    out.push(`<g data-flag="${i}">${pennant(P, { x: x + DOC_W / 2 - 2, y: FACE - 2, z: TOP, height: 9, length: 8, drop: 5 })}</g>`);
    out.push(tagSpot(x + DOC_W / 2 - TAG_W / 2));
    out.push(tag(x + DOC_W / 2 - TAG_W / 2, "d" + i));
    out.push(`</g>`);
  });
  // the rule, and the sign that lights when the ward is left with nobody on call
  const sx = -9, sw = 29;
  out.push(text(sx + sw / 2, FACE, TOP - 14, t("RULE", "REGLA"), 3, { anchor: "middle" }));
  out.push(`<g data-rule="off">${sign(P, { x: sx, y: FACE + 1.2, z: BOARD_Z + 9, w: sw, h: 11, text: t("1+ ON CALL", "1+ DE GUARDIA"), size: 2.8, posts: false })}</g>`);
  out.push(`<g class="wb-lit-group" data-rule="on" style="display:none">${litFill(sign(P, { x: sx, y: FACE + 1.2, z: BOARD_Z + 9, w: sw, h: 11, text: t("NOBODY", "NADIE"), size: 4.2, posts: false, lit: true }))}</g>`);
  out.push(`</g>`);
  return out.join("");
}

// ---------- the timeline ----------
function tape() {
  const out = [S(k.slabOf(TAPE, 0, TAPE_H, P, 3, 0.2), { tone: "lo", crease: "none" })];
  const lanes = [];
  for (const y of LANE_Y) lanes.push(k.lineOnTop([START_X, y], [NOW_X, y], TAPE_H, P));
  out.push(L(lanes.join(""), { tone: "faint" }));
  // the NOW line across all lanes, and its label
  out.push(L(k.lineOnTop([NOW_X, TAPE.y + 3], [NOW_X, TAPE.y + TAPE.d - 2], TAPE_H, P), { tone: "mid" }));
  out.push(faceText(P, [NOW_X - 1.6, TAPE.y + TAPE.d - 2.4, TAPE_H], t("NOW", "AHORA"), { face: "top", size: 3.4, tone: "mid", anchor: "end" }));
  // the lane letters at the left
  LANE_Y.forEach((y, i) => out.push(`<g data-lane-label="${i}">${plaque(P, { x: TAPE.x + 2, y: y - 3.5, z: TAPE_H, w: 7, d: 7, text: "ABCD"[i], size: 4 })}</g>`));
  return out.join("");
}

// Timeline marks, drawn at the origin; the live code clones them and moves them along a lane.
export const MARK = { w: 15, d: 7.4 };
export function markSvgs() {
  const plan = { x: 0, y: -MARK.d / 2, w: MARK.w, d: MARK.d, r: 0.6 };
  const label = (z, tone = "hi") => faceText(P, [MARK.w / 2, 1.7, z], "0", { face: "top", size: 4.4, tone, anchor: "middle", attr: "data-mark-text" });
  return {
    read: `<g>${S(k.slabOf(plan, 0, 0.5, P, 2, 0.15), { tone: "mid", crease: "none" })}${label(0.5, "mid")}</g>`,
    write: `<g>${S(k.slabOf(plan, 0, 2.8, P, 2, 0.3), { tone: "hi", crease: "lo" })}${label(2.8)}</g>`,
    lost: `<g class="wb-lit-group">${litFill(S(k.slabOf(plan, 0, 2.8, P, 2, 0.3), { tone: "hi", crease: "lo", lit: true }))}${label(2.8, "on-lit")}</g>`,
    commit: `<g>${S(k.cylinder(0, 0, 1.5, 0, 7, P, 14, 0.3), { tone: "hi", crease: "lo" })}${S(k.cylinder(0, 0, 2.6, 7, 1.2, P, 16, 0.3), { tone: "hi", crease: "lo" })}</g>`,
    abort: `<g>${S(k.slabOf({ x: -3.4, y: -3.4, w: 6.8, d: 6.8, r: 0.6 }, 0, 1.8, P, 2, 0.2), { tone: "hi", crease: "lo" })}`
      + L(k.lineOnTop([-2.2, -2.2], [2.2, 2.2], 1.8, P) + k.lineOnTop([-2.2, 2.2], [2.2, -2.2], 1.8, P), { tone: "hi" }) + `</g>`,
  };
}

// ---------- the desks ----------
function desk(i) {
  const cx = DESK_X[i];
  const plan = { x: cx - DESK.w / 2, y: DESK.y, w: DESK.w, d: DESK.d, r: 1.4 };
  const out = [`<g data-desk="${i}">`];
  out.push(person(P, [cx, PERSON_Y, 0], { scale: 0.95 }));
  out.push(S(k.slabOf(plan, 0, DESK.h, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(plan, 1.6), DESK.h, P), { tone: "faint" }));
  // the desk front: the letter, and what the transaction is doing (one text the live code sets)
  out.push(faceText(P, [plan.x + 2, DESK_FRONT, 2.2], "ABCD"[i], { size: 5, tone: "hi" }));
  out.push(faceText(P, [plan.x + 7.6, DESK_FRONT, 3], "", { size: 3.1, tone: "hi", attr: `data-status="${i}"` }));
  // the slip: what this transaction read
  out.push(`<g data-slip="${i}" style="display:none">${card(P, { x: cx - 6.5, y: DESK.y + 5, z: DESK.h, w: 13, h: 10, text: "0", sub: t("READ", "LEYÓ"), size: 4.2, subSize: 2.5, attr: `data-slip-text="${i}"` })}</g>`);
  out.push(`</g>`);
  return out.join("");
}

// ---------- the tally box ----------
function box() {
  const out = [S(k.slabOf(BOX, 0, BOX_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(BOX, 2.2), BOX_H, P), { tone: "faint" }));
  const col = (x, name, words, lit) => (lit ? `<g data-bad>` : "") + digitCounter(P, { x, y: BOX_FRONT, z: 1.8, count: 3, w: 4.8, h: 6.4, gap: 0.5, pad: 1, name }) + (lit ? `</g>` : "") + words;
  const z = 11;
  const both = (x, dep, rot) => `<g data-scene="deposits">${text(x, BOX_FRONT, z, dep, 3)}</g><g data-scene="rota" style="display:none">${text(x, BOX_FRONT, z, rot, 3)}</g>`;
  out.push(col(BOX.x + 5, "done", both(BOX.x + 4, t("DEPOSITS", "DEPÓSITOS"), t("NIGHTS", "NOCHES"))));
  out.push(col(BOX.x + 32, "aborts", text(BOX.x + 30, BOX_FRONT, z, "ROLLBACKS", 3)));
  out.push(col(BOX.x + 59, "bad", both(BOX.x + 58, t("LOST", "PERDIDOS"), t("NOBODY", "NADIE")), true));
  return out.join("");
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A records office on a base plate. At the back, the database: a cabinet with a board of rows and the isolation level printed on its front. For deposits the board shows one account card with two digit counters, the balance and what it should be, and a spot where a lock tag hangs while a transaction holds the row's lock. For the ward rota it shows one card per doctor, A to D, each with a flag on top while that doctor is on call and a lock-tag spot, and a sign that lights when nobody is on call. Across the middle runs a timeline tape with one lane per desk: flat tiles mark reads with the value read, raised tiles mark writes, a post marks a COMMIT, a cross a ROLLBACK, and a dashed stretch a wait for a lock; time runs from the right, where NOW is, to the left. At the front, up to four desks, A to D, each with a clerk, a slip showing what their transaction read and a word on the desk front saying what it is doing. A tally box at the front right counts deposits or nights, rollbacks, and lost deposits or nights with nobody on call.",
      "Una oficina de registros sobre una placa base. Al fondo, la base de datos: un gabinete con un tablero de filas y el nivel de aislamiento impreso al frente. Para los depósitos, el tablero muestra la tarjeta de una cuenta con dos contadores, el saldo y lo que debería ser, y un lugar donde cuelga una etiqueta de bloqueo mientras una transacción tiene el bloqueo de la fila. Para la guardia del hospital muestra una tarjeta por médico, de la A a la D, cada una con una bandera arriba mientras ese médico está de guardia y un lugar para la etiqueta de bloqueo, y un cartel que se enciende cuando no queda nadie de guardia. Por el medio corre una cinta de tiempo con un carril por escritorio: fichas planas marcan lecturas con el valor leído, fichas altas marcan escrituras, un poste marca un COMMIT, una cruz un ROLLBACK y un tramo punteado una espera por un bloqueo; el tiempo corre desde la derecha, donde está AHORA, hacia la izquierda. Adelante, hasta cuatro escritorios, de la A a la D, cada uno con un empleado, una boleta con lo que leyó su transacción y una palabra al frente que dice qué está haciendo. Una caja de conteo adelante a la derecha cuenta depósitos o noches, rollbacks, y depósitos perdidos o noches sin nadie de guardia.",
    ),
    body: [
      plate(),
      cabinet(),
      accountPanel(),
      rotaPanel(),
      tape(),
      `<g data-layer="spans"></g>`,
      ...LANE_Y.map((_, i) => `<g data-layer="lane${i}"></g><g data-layer="posts${i}"></g>`),
      [0, 1, 2, 3].map(desk).join(""),
      box(),
    ],
  });
}

export const GEOMETRY = { LANE_Y, NOW_X, START_X, TAPE_H, MARK };

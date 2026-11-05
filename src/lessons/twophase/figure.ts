// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A coordinator's desk and three participant counters, A, B and C. At the back, each counter keeps one hot row on its
// top with a padlock (lit while a transaction holds the row), its state on the front face, and a line of local
// customers waiting for the row. A message lane runs from each counter to the desk: envelopes go out on the left
// half (WORK, PREPARE, COMMIT/ABORT, answers) and come back on the right half (DONE, votes, ACK, questions). Behind the
// counters, a peer line carries the participants' questions to each other. On the desk: the coordinator's log with its
// last decision, a vote plaque at the end of each lane, the clerk (gone while the coordinator is down, with a DOWN
// sign in its place) and counters of committed, aborted and split transactions.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, labelPlate, digitCounter, person, figurine, plaque, sign, card, faceText, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 720;
export const HEIGHT = 470;

const PLATE = { x: -100, y: -108, w: 200, d: 150, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The counters at the back.
export const CX = [-58, 2, 62];
const CW = 42, CD = 22, CH = 16;
const C_BACK = -96;
export const C_FRONT = C_BACK + CD;              // -74
// Lanes: out (coordinator → counter) and back (counter → coordinator), on the left half in front of each counter.
export const LANE = { out: -12, back: -5 };       // x offsets from the counter's centre
const LANE_W = 16;
export const DESK = { x: -88, y: -4, w: 166, d: 24, r: 2 };
const DESK_H = 11;
export const LANE_Y = [C_FRONT + 3, DESK.y - 3];  // where envelopes start and stop
// Customers: a line in front of the right half of each counter.
export const CUST = { dx: 11, y0: C_FRONT + 6, step: 7, max: 5, scale: 0.75 };
// The peer line behind the counters.
export const RAIL = { y: C_BACK - 6, z: 22, x0: CX[0] - 18, x1: CX[2] + 18 };
// The row and its padlock on each counter's top.
const ROW = { dx: -16, y: C_BACK + 4, w: 24, d: 11 };
export const LOCK = { dx: 13, y: C_BACK + 12 };
const CLERK = [33, -13, 0];

export const ENV = { w: 17, h: 7 };             // an envelope

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [RAIL.x0, RAIL.y, RAIL.z + 8], [RAIL.x1, RAIL.y, RAIL.z + 8], [CLERK[0], CLERK[1], 26]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

const { S, L, D } = shorthand(P);
const text = (x, y, z, words, size = 2.6, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + labelPlate(P, { x: 66, y: 25, w: 26, d: 12, r: 1.4 }, [[70, 29, 18], [70, 33, 12]]);
}

// ---------- the peer line ----------
function rail() {
  const out = [];
  for (const x of [RAIL.x0 + 2, RAIL.x1 - 2]) out.push(S(k.cylinder(x, RAIL.y, 1, 0, RAIL.z, P, 14), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: RAIL.x0, y: RAIL.y - 1.6, w: RAIL.x1 - RAIL.x0, d: 3.2, r: 0.6 }, RAIL.z - 1.6, 1.6, P, 2), { tone: "mid", crease: "lo" }));
  return out.join("");
}

// ---------- a participant counter ----------
function counter(i) {
  const cx = CX[i];
  const plan = { x: cx - CW / 2, y: C_BACK, w: CW, d: CD, r: 1.6 };
  const out = [S(k.slabOf(plan, 0, CH, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(plan, 1.8), CH, P), { tone: "faint" }));
  // the hot row: a ledger slab on top, with the transaction holding it printed on it
  const row = { x: cx + ROW.dx, y: ROW.y, w: ROW.w, d: ROW.d, r: 0.8 };
  out.push(S(k.slabOf(row, CH, 1.4, P, 3, 0.3), { tone: "hi", crease: "lo" }));
  out.push(L([0, 1, 2].map((j) => k.lineOnTop([row.x + 3, row.y + 2.6 + j * 2.6], [row.x + row.w - 3, row.y + 2.6 + j * 2.6], CH + 1.4, P)).join(""), { tone: "faint" }));
  out.push(text(row.x + 2, row.y + row.d, CH + 0.3, t("ROW", "FILA"), 1.1, { tone: "lo" }));
  out.push(faceText(P, [row.x + row.w / 2, row.y + row.d * 0.62, CH + 1.4], "", { face: "top", size: 4, tone: "hi", anchor: "middle", attr: `data-owner="${i}"` }));
  // front face: the letter and the state
  out.push(text(cx - CW / 2 + 2.4, C_FRONT, 5.6, "ABC"[i], 8, { tone: "hi" }));
  out.push(faceText(P, [cx - 11, C_FRONT, 10.4], "", { size: 3.4, tone: "hi", attr: `data-state="${i}"` }));
  // right face: customers waiting for the row
  const side = cx + CW / 2;
  out.push(digitCounter(P, { x: side, y: C_FRONT - 2.4, z: 2.6, count: 2, face: "x", w: 3.8, h: 5, gap: 0.5, pad: 0.9, name: "wait" + i }));
  out.push(faceText(P, [side, C_FRONT - 2, 10.6], t("WAITING", "ESPERAN"), { face: "x", size: 2.6, tone: "mid" }));
  return out.join("");
}

// The padlock on the row: closed and lit while a transaction holds it, shackle up when free.
function padlock(i, closed) {
  const x = CX[i] + LOCK.dx, y = LOCK.y, z = CH;
  const lift = closed ? 0 : 2.6;
  const body = { x: x - 3.4, y: y - 1.5, w: 6.8, d: 3, r: 0.6 };
  const out = [];
  // the shackle: two posts and a bar over the body; open, it rides up
  for (const dx of [-2.2, 2.2]) out.push(S(k.cylinder(x + dx, y, 0.75, z + 4 + lift, 4.6, P, 12), { tone: "hi", crease: "none", lit: closed }));
  out.push(S(k.slabOf({ x: x - 2.95, y: y - 0.75, w: 5.9, d: 1.5, r: 0.6 }, z + 8.6 + lift, 1.4, P, 2), { tone: "hi", crease: "none", lit: closed }));
  out.push(S(k.slabOf(body, z, 5, P, 2, 0.4), { tone: "hi", crease: "lo", lit: closed }));
  out.push(`<g data-on-lit="fill">${D([k.iso([x, y + 1.5, z + 2.6], P)], { size: 0.6 })}</g>`);
  const svg = out.join("");
  return closed ? litFill(svg) : svg;
}
function padlocks(i) {
  return `<g class="wb-lit-group" data-lock="${i}" data-on="0"><g data-lock-state="open">${padlock(i, false)}</g><g data-lock-state="closed" style="display:none">${padlock(i, true)}</g></g>`;
}

// ---------- the lanes ----------
function lane(i) {
  const cx = CX[i];
  const x0 = cx + LANE.out - 4, plan = { x: x0, y: C_FRONT + 1, w: LANE_W, d: DESK.y - 1 - (C_FRONT + 1), r: 1 };
  const out = [S(k.slabOf(plan, 0, 0.8, P, 3, 0.2), { tone: "lo", crease: "none" })];
  // the divider, dashed, and chevrons: out on the left half (toward the counter), back on the right half
  const mid = cx + (LANE.out + LANE.back) / 2, dash = [], chev = [];
  for (let y = plan.y + 3; y < plan.y + plan.d - 3; y += 7) dash.push(k.lineOnTop([mid, y], [mid, Math.min(y + 3.5, plan.y + plan.d - 3)], 0.8, P));
  for (let y = plan.y + 14; y < plan.y + plan.d - 10; y += 26) {
    const o = cx + LANE.out, b = cx + LANE.back;
    chev.push(k.onTop([[o - 2, y + 1.5], [o, y - 0.5], [o + 2, y + 1.5]], 0.8, P));
    chev.push(k.onTop([[b - 2, y + 11.5], [b, y + 13.5], [b + 2, y + 11.5]], 0.8, P));
  }
  out.push(L(dash.join(""), { tone: "mid" }), L(chev.join(""), { tone: "mid" }));
  return out.join("");
}
// the floor marks where customers stand
function queueMarks(i) {
  const x = CX[i] + CUST.dx, pts = [];
  for (let j = 0; j < CUST.max; j++) pts.push(k.ring(x, CUST.y0 + j * CUST.step, 2.2, 0, P, 14));
  return L(pts.join(""), { tone: "faint" });
}

// ---------- the coordinator's desk ----------
function desk() {
  const out = [S(k.slabOf(DESK, 0, DESK_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(DESK, 2.2), DESK_H, P), { tone: "faint" }));
  const front = DESK.y + DESK.d;
  out.push(faceText(P, [DESK.x + 4, DESK.y + 19, DESK_H], t("COORDINATOR", "COORDINADOR"), { face: "top", size: 3, tone: "mid" }));
  const col = (x, name, count, words) => digitCounter(P, { x, y: front, z: 2.6, count, w: 4, h: 5.4, gap: 0.5, pad: 0.9, name })
    + text(x + count * 4.5 + 3.4, front, 3.8, words, 2.7);   // clear of the housing's right edge
  out.push(col(DESK.x + 4, "committed", 3, t("COMMITTED", "CONFIRMADAS")));
  out.push(col(DESK.x + 48, "aborted", 3, t("ABORTED", "ABORTADAS")));
  out.push(col(DESK.x + 88, "split", 2, t("SPLIT", "DIVIDIDAS")));
  out.push(col(DESK.x + 123, "inflight", 3, t("IN FLIGHT", "EN CURSO")));
  return out.join("");
}
// The coordinator's log on the desk: a ledger lying open, headed LOG (or MEMORY), with the last decision recorded.
const BOOK = { x: -53, y: 1, w: 32, d: 14 };
function book() {
  const out = [S(k.slabOf({ ...BOOK, r: 0.8 }, DESK_H, 1.6, P, 3, 0.3), { tone: "hi", crease: "lo" })];
  out.push(L(k.lineOnTop([BOOK.x + BOOK.w / 2, BOOK.y + 1], [BOOK.x + BOOK.w / 2, BOOK.y + BOOK.d - 1], DESK_H + 1.6, P), { tone: "lo" }));
  out.push(`<g data-book="log">${faceText(P, [BOOK.x + 8.5, BOOK.y + 5, DESK_H + 1.6], t("LOG", "LOG"), { face: "top", size: 2.6, tone: "mid", anchor: "middle" })}</g>`);
  out.push(`<g data-book="memory" style="display:none">${faceText(P, [BOOK.x + 8.5, BOOK.y + 5, DESK_H + 1.6], t("MEMORY", "MEMORIA"), { face: "top", size: 2.2, tone: "mid", anchor: "middle" })}</g>`);
  out.push(L([0, 1].map((j) => k.lineOnTop([BOOK.x + 3, BOOK.y + 8 + j * 3], [BOOK.x + 14, BOOK.y + 8 + j * 3], DESK_H + 1.6, P)).join(""), { tone: "faint" }));
  // the last record, set by the live code: "#12" over "COMMIT"
  out.push(faceText(P, [BOOK.x + BOOK.w * 0.75, BOOK.y + 6, DESK_H + 1.6], "", { face: "top", size: 3, tone: "hi", anchor: "middle", attr: "data-record-id" }));
  out.push(faceText(P, [BOOK.x + BOOK.w * 0.75, BOOK.y + 11, DESK_H + 1.6], "", { face: "top", size: 2.6, tone: "hi", anchor: "middle", attr: "data-record" }));
  return out.join("");
}
// A plaque at the end of each lane: the vote the coordinator has from that participant for the current transaction.
function votePlaque(i) {
  const x = CX[i] + (LANE.out + LANE.back) / 2;
  return plaque(P, { x: x - 6, y: DESK.y + 2, z: DESK_H, w: 12, d: 6 })
    + faceText(P, [x, DESK.y + 6.4, DESK_H + 0.8], "", { face: "top", size: 3.2, tone: "hi", anchor: "middle", attr: `data-vote="${i}"` });
}
function clerk() {
  return `<g data-clerk>${person(P, CLERK, { scale: 0.9, hat: "cap" })}</g>`;
}
function downSign() {
  return `<g class="wb-lit-group" data-down style="display:none">${litFill(sign(P, { x: CLERK[0] - 13, y: CLERK[1] + 2, z: 12, w: 26, h: 8, text: t("DOWN", "CAÍDO"), lit: true }))}</g>`;
}

// ---------- moving parts, drawn at the origin and moved with translateAlong ----------
// An envelope: a card standing on a lane (face y), one <text> the live code sets (WORK, YES, COMMIT…).
export function envelopeSvg() {
  return card(P, { x: -ENV.w / 2, y: 0.3, z: 0, w: ENV.w, h: ENV.h, text: "", tone: "hi" })
    + faceText(P, [0, 0.3, 2.2], "", { size: 2.9, tone: "hi", anchor: "middle", attr: "data-env-text" });
}
// A local customer.
export function customerSvg() {
  return figurine(P, [0, 0, 0], { scale: CUST.scale });
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A coordinator's desk at the front and three participant counters, A, B and C, at the back, on a base plate. Each counter keeps one row on its top with a padlock that closes and lights while a transaction holds the row; its front face shows the letter and its state (working, prepared, in doubt), and a line of small customers in front of it waits for the row, with a counter of how many are waiting on its side. A lane runs from each counter to the desk: envelopes go out to the counter on the left half (work, prepare, commit or abort) and come back on the right half (done, the vote, ack). Behind the counters, a peer line carries questions between participants. On the desk: the coordinator's log with the last decision it recorded, a plaque at the end of each lane with that participant's vote, the clerk, replaced by a lit DOWN sign while the coordinator is down, and counters of committed, aborted and split transactions, and on its side the transactions in flight.",
      "Un escritorio del coordinador adelante y tres mostradores participantes, A, B y C, al fondo, sobre una placa base. Cada mostrador guarda una fila sobre su tapa con un candado que se cierra y se enciende mientras una transacción tiene la fila; su cara frontal muestra la letra y su estado (trabajando, preparada, en duda), y una fila de clientes pequeños frente a él espera la fila, con un contador al costado de cuántos esperan. Un carril va de cada mostrador al escritorio: los sobres van al mostrador por la mitad izquierda (tarea, preparar, confirmar o abortar) y vuelven por la mitad derecha (hecho, el voto, ack). Detrás de los mostradores, una línea entre pares lleva preguntas entre participantes. Sobre el escritorio: el log del coordinador con la última decisión que registró, una placa al final de cada carril con el voto de ese participante, el empleado, reemplazado por un cartel encendido CAÍDO mientras el coordinador está caído, y contadores de transacciones confirmadas, abortadas y divididas, y en su costado las transacciones en curso.",
    ),
    body: [
      plate(),
      rail(),
      `<g data-layer="rail"></g>`,
      [0, 1, 2].map((i) => counter(i) + padlocks(i)).join(""),
      [0, 1, 2].map((i) => lane(i) + queueMarks(i)).join(""),
      `<g data-layer="floor"></g>`,
      clerk(),
      downSign(),
      desk(),
      book(),
      [0, 1, 2].map(votePlaque).join(""),
    ],
  });
}

export const GEOMETRY = { CX, LANE, LANE_Y, CUST, RAIL, ENV, DESK_H, C_FRONT };

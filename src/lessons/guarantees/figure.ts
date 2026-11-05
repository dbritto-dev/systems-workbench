// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A mail-order room: a sender, a queue, three workers, a ledger, a mail service and its customers. The sender (back
// left) puts each order in an envelope (order number on top, message id below) and sends it to the queue (back middle),
// where envelopes stand on the rack in line. A worker takes the envelope at the front of the line to its desk; the dial
// on the desk is the envelope's visibility timeout. The worker mails the customer a letter through the mail service
// (front right), writes the order in the ledger (back right), then acks. The ledger keeps the dedupe table (the index
// box on its top); the mail service checks idempotency keys when that is on. Every number is a counter on a real object. Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, person, dial, card, lamp, faceText, variants, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -134, y: -106, w: 264, d: 128, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The sender's booth, back left, with the sender behind it.
const SB = { x: -128, y: -86, w: 30, d: 22, r: 1.5 };
const SB_H = 12;
const SB_FRONT = SB.y + SB.d;
export const SENDER_AT = [SB.x + SB.w / 2, SB.y + 8, SB_H];   // where an envelope leaves the booth
const SENDER_PERSON = [SB.x + 15, SB.y - 10, 0];

// The queue: a cabinet with a rack on top where waiting envelopes stand in line, the front of the line on the right.
// Its words sit high on its face, above what the workers' heads hide.
const QD = { x: -84, y: -102, w: 120, d: 30, r: 2 };
const QD_H = 23;
const QD_FRONT = QD.y + QD.d;
export const RACK_Y = QD.y + 15;
export const SLOTS = 8;
export const SLOT_X = Array.from({ length: SLOTS }, (_, i) => QD.x + QD.w - 10 - i * 13.6);
export const RACK_Z = QD_H + 0.6;
export const QUEUE_IN = [QD.x + 8, RACK_Y, QD_H + 1];   // where the sender's envelopes land (the back of the line)
// The hidden row behind the line: envelopes out to a worker that crashed wait here until their timeout runs out.
export const HIDE_Y = QD.y + 6;
export const HIDE_X = Array.from({ length: 4 }, (_, i) => QD.x + QD.w - 10 - i * 13.6);

// The ledger, back right: an open book and the dedupe table's index box.
const LG = { x: 44, y: -104, w: 82, d: 42, r: 2 };
const LG_H = 24;
const LG_FRONT = LG.y + LG.d;
const BOOK = { x: LG.x + 4, y: LG.y + 6, w: 38, d: 28 };
export const BOOK_AT = [BOOK.x + BOOK.w / 2, BOOK.y + BOOK.d / 2, LG_H + 2];
const IDX = { x: LG.x + 46, y: LG.y + 8, w: 32, d: 24, r: 1 };
const IDX_H = 9;
const LAMP_LEDGER = [LG.x + LG.w - 6, LG.y + 4.4, LG_H];

// The desks, one per worker, at the front left.
export const DX = [-106, -58, -10];
const DESK = { y: -20, w: 44, d: 26, h: 12 };
const DESK_FRONT = DESK.y + DESK.d;
export const DESK_H = DESK.h;
export const ENV_SPOT = DX.map((x) => [x - 10, DESK.y + 13, DESK.h]);
export const DIAL_AT = DX.map((x) => [x + 11, DESK.y + 12.5]);
const PERSON_AT = DX.map((x) => [x - 9, DESK.y - 9, 0]);

// The mail service, front right: letters sent to customers stand on its rack, the latest on the right.
const PO = { x: 22, y: -50, w: 104, d: 60, r: 2 };
const PO_H = 15;
const PO_FRONT = PO.y + PO.d;
export const SENT_Y = PO.y + 12;
export const SENT = 7;
export const SENT_X = Array.from({ length: SENT }, (_, i) => PO.x + 10 + i * 13.2);
const KEY_PLATE = { x: PO.x + 6, y: PO.y + 30, w: 46, d: 16 };
const TRAY = { x: PO.x + 58, y: PO.y + 28, w: 40, d: 18, r: 1 };
const TRAY_H = 4;
export const TRAY_SPOTS = Array.from({ length: 3 }, (_, i) => [TRAY.x + 7 + i * 13, TRAY.y + 10, PO_H + TRAY_H - 1.4]);
const LAMP_MAIL = [PO.x + PO.w - 7, PO.y + PO.d - 7, PO_H];

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [SENDER_PERSON[0], SENDER_PERSON[1], 30], ...k.boxCorners(LG, 0, LG_H + IDX_H + 4), ...PERSON_AT.map(([x, y]) => [x, y, 30])],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

const { S, L } = shorthand(P);
const text = (x, y, z, words, size = 3, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });
const counter = (o) => digitCounter(P, { w: 4.8, h: 6.4, gap: 0.6, pad: 1.2, ...o });
// Captions beside counters, at the standard size of the other lessons; titles a little larger.
const LABEL = 3;
const TITLE = 3.8;

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H });
}

// ---------- the sender ----------
function sender() {
  const out = [person(P, SENDER_PERSON, { scale: 1.05, hat: "cap" })];
  out.push(S(k.slabOf(SB, 0, SB_H, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(SB, 2), SB_H, P), { tone: "faint" }));
  out.push(text(SB.x + 2.6, SB_FRONT, 8.6, t("SENDER", "REMITENTE"), 3.2));
  out.push(counter({ x: SB.x + 2.6, y: SB_FRONT, z: 1.4, count: 2, w: 4.2, h: 4.8, pad: 0.9, name: "resent" }));
  out.push(text(SB.x + 13.6, SB_FRONT, 2.2, t("RESENT", "REENVÍOS"), LABEL));
  return out.join("");
}

// ---------- the queue ----------
function queue() {
  const out = [S(k.slabOf(QD, 0, QD_H, P, 3, 0.6), { tone: "mid" })];
  // the rack: a groove the envelopes stand in, and a mark under each place in the line
  out.push(S(k.slabOf({ x: QD.x + 2, y: RACK_Y - 2.2, w: QD.w - 4, d: 4.4, r: 0.6 }, QD_H, 0.8, P, 2), { tone: "lo", crease: "none" }));
  out.push(L(SLOT_X.map((x) => k.lineOnTop([x, RACK_Y + 3.4], [x, RACK_Y + 6.6], QD_H, P)).join(""), { tone: "mid" }));
  out.push(S(k.slabOf({ x: HIDE_X[3] - 7, y: HIDE_Y - 2, w: HIDE_X[0] - HIDE_X[3] + 14, d: 4, r: 0.6 }, QD_H, 0.6, P, 2), { tone: "lo", crease: "none" }));
  const z1 = 9.4, z2 = 19.4;
  out.push(text(QD.x + 4, QD_FRONT, z2, t("QUEUE", "COLA"), TITLE));
  out.push(text(QD.x + QD.w - 4, QD_FRONT, z2, t("FRONT OF THE LINE →", "FRENTE DE LA FILA →"), LABEL, { anchor: "end" }));
  out.push(counter({ x: QD.x + 4, y: QD_FRONT, z: z1, count: 2, name: "waiting" }));
  out.push(text(QD.x + 17.2, QD_FRONT, z1 + 1.6, t("WAITING", "EN ESPERA"), LABEL));
  out.push(counter({ x: QD.x + 37.4, y: QD_FRONT, z: z1, count: 3, name: "again" }));
  out.push(text(QD.x + 56, QD_FRONT, z1 + 1.6, t("DELIVERED AGAIN", "REENTREGADOS"), LABEL));
  out.push(counter({ x: QD.x + 90, y: QD_FRONT, z: z1, count: 2, name: "lost" }));
  out.push(text(QD.x + 103.2, QD_FRONT, z1 + 1.6, t("LOST", "PERDIDOS"), LABEL));
  return out.join("");
}

// ---------- the ledger ----------
function ledger() {
  const out = [S(k.slabOf(LG, 0, LG_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(LG, 2.4), LG_H, P), { tone: "faint" }));
  // the open book: two pages on a cover, ruled
  out.push(S(k.slabOf({ x: BOOK.x, y: BOOK.y, w: BOOK.w, d: BOOK.d, r: 1 }, LG_H, 1.2, P, 2), { tone: "lo", crease: "none" }));
  for (const [x0, w] of [[BOOK.x + 1.4, BOOK.w / 2 - 2], [BOOK.x + BOOK.w / 2 + 0.6, BOOK.w / 2 - 2]]) {
    out.push(S(k.slabOf({ x: x0, y: BOOK.y + 1.4, w, d: BOOK.d - 2.8, r: 0.4 }, LG_H + 1.2, 1, P, 2), { tone: "hi", crease: "none" }));
    const rules = [];
    for (let y = BOOK.y + 5; y < BOOK.y + BOOK.d - 3; y += 3) rules.push(k.lineOnTop([x0 + 2, y], [x0 + w - 2, y], LG_H + 2.2, P));
    out.push(L(rules.join(""), { tone: "faint" }));
  }
  const z1 = 10.4;
  out.push(text(LG.x + 4, LG_FRONT, 20.2, t("LEDGER", "LIBRO"), TITLE));
  out.push(counter({ x: LG.x + 4, y: LG_FRONT, z: z1, count: 3, name: "orders" }));
  out.push(text(LG.x + 22.6, LG_FRONT, z1 + 1.6, t("ORDERS", "PEDIDOS"), LABEL));
  out.push(`<g class="wb-lit-group" data-twice-ledger>${counter({ x: LG.x + 44, y: LG_FRONT, z: z1, count: 2, name: "ledger2" })}</g>`);
  out.push(text(LG.x + 57.2, LG_FRONT, z1 + 1.6, t("TWICE", "DOS VECES"), LABEL));
  out.push(`<g data-flash-ledger="off">${lamp(P, LAMP_LEDGER, { r: 3.2 })}</g><g data-flash-ledger="on" style="display:none">${litFill(lamp(P, LAMP_LEDGER, { r: 3.2, lit: true }))}</g>`);
  return out.join("");
}
// The dedupe table: an index box of remembered ids on the ledger's top; its plaque says which id it keys on.
function indexBox() {
  const out = [S(k.slabOf(IDX, LG_H, IDX_H, P, 3, 0.4), { tone: "mid" })];
  const top = LG_H + IDX_H;
  const cards = [];
  for (let x = IDX.x + 4; x < IDX.x + IDX.w - 3; x += 3.2) cards.push(k.lineOnTop([x, IDX.y + 2], [x, IDX.y + 8], top, P));
  out.push(L(cards.join(""), { tone: "lo" }));
  const front = IDX.y + IDX.d;
  out.push(counter({ x: IDX.x + 2.6, y: front, z: LG_H + 1.4, count: 3, w: 4.2, h: 5.4, pad: 0.9, name: "seen" }));
  out.push(text(IDX.x + 18, front, LG_H + 2.8, t("SEEN", "VISTOS"), LABEL));
  for (const [key, words] of [["off", t("NO DEDUPE", "SIN DEDUPE")], ["msg", t("MSG IDS", "IDS MENSAJE")], ["order", t("ORDER IDS", "IDS PEDIDO")]]) {
    out.push(`<g data-dedupe-plaque="${key}"${key === "off" ? "" : ' style="display:none"'}>${faceText(P, [IDX.x + IDX.w / 2, IDX.y + 17, top], words, { face: "top", size: 3.6, tone: "hi", anchor: "middle" })}</g>`);
  }
  return out.join("");
}

// ---------- the desks ----------
function desk(i) {
  const cx = DX[i];
  const plan = { x: cx - DESK.w / 2, y: DESK.y, w: DESK.w, d: DESK.d, r: 1.5 };
  const out = [S(k.slabOf(plan, 0, DESK.h, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(plan, 2), DESK.h, P), { tone: "faint" }));
  out.push(faceText(P, [plan.x + 5.6, DESK_FRONT, 2.4], "ABC"[i], { size: 7.2, tone: "hi", anchor: "middle" }));
  const sp = { x: cx - 11, y: DESK_FRONT, w: 31, d: 1, r: 0.3 };
  out.push(`<g class="wb-lit-group" data-status-plate="${i}">`
    + S(k.slabOf(sp, 2.2, 7.2, P, 2, 0.2), { tone: "hi", crease: "lo" })
    + faceText(P, [sp.x + sp.w / 2, sp.y + sp.d, 4.2], "IDLE", { size: 3.4, tone: "hi", anchor: "middle", attr: `data-status="${i}"` })
    + `</g>`);
  // the visibility clock of the envelope this worker holds
  const [dx, dy] = DIAL_AT[i];
  out.push(dial(P, { x: dx, y: dy, z: DESK.h, r: 7, h: 3, ticks: 20, every: 5, name: "vt" + i, value: 0 }));
  return out.join("");
}
function worker(i) {
  const at = PERSON_AT[i];
  return variants("worker-" + i, {
    run: person(P, at, { scale: 1.15 }),
    // crashed: the worker is gone, only its spot is left
    down: S(k.cylinder(at[0], at[1], 5.6 * 1.15, 0, 1.4 * 1.15, P, 24, 0.3), { tone: "mid" }),
  }, "run");
}

// ---------- the mail service ----------
function mail() {
  const out = [S(k.slabOf(PO, 0, PO_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(PO, 2.4), PO_H, P), { tone: "faint" }));
  // the rack of letters sent: a groove the letters stand in, a mark under each place
  out.push(S(k.slabOf({ x: PO.x + 3, y: SENT_Y - 2.2, w: PO.w - 14, d: 4.4, r: 0.6 }, PO_H, 0.8, P, 2), { tone: "lo", crease: "none" }));
  out.push(L(SENT_X.map((x) => k.lineOnTop([x, SENT_Y + 3.4], [x, SENT_Y + 6.6], PO_H, P)).join(""), { tone: "mid" }));
  // the key check: a plate on the top that says whether the service checks idempotency keys
  out.push(S(k.slabOf({ ...KEY_PLATE, r: 0.8 }, PO_H, 0.8, P, 3, 0.3), { tone: "hi", crease: "lo" }));
  for (const [key, words] of [["off", t("NO KEY CHECK", "SIN CLAVE")], ["on", t("KEY CHECK", "REVISA CLAVE")]]) {
    out.push(`<g data-key-plaque="${key}"${key === "off" ? "" : ' style="display:none"'}>${faceText(P, [KEY_PLATE.x + KEY_PLATE.w / 2, KEY_PLATE.y + KEY_PLATE.d / 2 + 1.2, PO_H + 0.8], words, { face: "top", size: 3.8, tone: "hi", anchor: "middle" })}</g>`);
  }
  // the tray where repeats with a known key are dropped
  out.push(S(k.slabOf(TRAY, PO_H, TRAY_H, P, 3, 0.3), { tone: "mid", inner: L(k.planOutline(k.insetPlan(TRAY, 1.4), PO_H + TRAY_H, P), { tone: "lo" }) }));
  out.push(text(PO.x + 4, PO_FRONT, 10.6, t("MAIL SERVICE", "SERVICIO DE CORREO"), 3.4));
  out.push(counter({ x: PO.x + 4, y: PO_FRONT, z: 1.4, count: 3, h: 5.4, name: "letters" }));
  out.push(text(PO.x + 22.6, PO_FRONT, 2.6, t("LETTERS", "CARTAS"), LABEL));
  out.push(`<g class="wb-lit-group" data-twice-mail>${counter({ x: PO.x + 40, y: PO_FRONT, z: 1.4, count: 2, h: 5.4, name: "letters2" })}</g>`);
  out.push(text(PO.x + 53.2, PO_FRONT, 2.6, t("TWICE", "DOS VECES"), LABEL));
  out.push(counter({ x: PO.x + 73, y: PO_FRONT, z: 1.4, count: 2, h: 5.4, name: "dropped" }));
  out.push(text(PO.x + 86.2, PO_FRONT, 2.6, t("DROPPED", "DESCARTE"), LABEL));
  out.push(`<g data-flash-mail="off">${lamp(P, LAMP_MAIL, { r: 3 })}</g><g data-flash-mail="on" style="display:none">${litFill(lamp(P, LAMP_MAIL, { r: 3, lit: true }))}</g>`);
  return out.join("");
}

// ---------- moving things, drawn at the origin and moved with translateAlong ----------
// An envelope: order number on top, message id below. Lit when its visibility timeout ran out while a worker still has it.
export function envelopeSvg() {
  return `<g class="wb-lit-group" data-env>${card(P, { x: -5.5, y: 0.3, z: 0, w: 11, h: 8.8, text: "#0", sub: "m0", size: 3.4, subSize: 3, attr: "data-env-o", subAttr: "data-env-m" })}</g>`;
}
// A letter to a customer, with its order number. Lit when it's the second one for that order.
export function letterSvg() {
  return `<g class="wb-lit-group" data-letter>${card(P, { x: -4.6, y: 0.3, z: 0, w: 9.2, h: 6.4, text: "#0", size: 3, attr: "data-letter-text" })}</g>`;
}
// A ledger slip, and the queue's reply to the sender.
export function slipSvg() {
  return `<g class="wb-lit-group" data-slip>${card(P, { x: -4.6, y: 0.3, z: 0, w: 9.2, h: 6.4, text: "#0", size: 3, tone: "mid", attr: "data-slip-text" })}</g>`;
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A mail-order room on a base plate. At the back left, the sender sends each order as an envelope to the queue; a counter on the sender's booth shows how many it sent again because the queue's reply never came. At the back middle, the queue's rack holds the envelopes waiting in line, the front of the line on the right; counters show how many wait, how many orders were delivered again and how many were lost. At the front left, workers A, B and C take the envelope at the front of the line to their desks. A dial on each desk shows how much of that envelope's visibility timeout is left; the envelope lights when the timeout has run out while the worker still has it, because the queue then hands it to someone else too. A plate on each desk says what the worker is doing. At the back right, the ledger, an open book, counts the orders written in it and those written twice; an index box on it holds the dedupe table. At the front right, the mail service keeps the latest letters sent to customers on its rack, the second copy of a letter lit, and counts letters sent, letters sent twice and repeats it dropped by their idempotency key.",
      "Una sala de pedidos por correo sobre una placa base. Al fondo a la izquierda, el remitente envía cada pedido como un sobre a la cola; un contador en su puesto muestra cuántos reenvió porque nunca llegó la respuesta de la cola. Al fondo en el medio, el estante de la cola tiene los sobres esperando en fila, con el frente de la fila a la derecha; unos contadores muestran cuántos esperan, cuántos pedidos se entregaron de nuevo y cuántos se perdieron. Adelante a la izquierda, los trabajadores A, B y C llevan el sobre del frente de la fila a sus escritorios. Un dial en cada escritorio muestra cuánto le queda al tiempo de invisibilidad de ese sobre; el sobre se enciende cuando ese tiempo venció y el trabajador todavía lo tiene, porque entonces la cola también se lo da a otro. Una placa en cada escritorio dice qué hace el trabajador. Al fondo a la derecha, el libro, un libro abierto, cuenta los pedidos escritos y los escritos dos veces; una caja de fichas encima guarda la tabla de deduplicación. Adelante a la derecha, el servicio de correo tiene en su estante las últimas cartas enviadas a los clientes, con la segunda copia de una carta encendida, y cuenta las cartas enviadas, las enviadas dos veces y las repeticiones que descartó por su clave de idempotencia.",
    ),
    body: [
      plate(),
      queue(),
      `<g data-layer="rack"></g>`,
      sender(),
      ledger(),
      indexBox(),
      DX.map((_, i) => worker(i)).join(""),
      DX.map((_, i) => desk(i)).join(""),
      `<g data-layer="desk"></g>`,
      mail(),
      `<g data-layer="sent"></g>`,
      `<g data-layer="fly"></g>`,
    ],
  });
}

export const GEOMETRY = { SLOT_X, RACK_Y, RACK_Z, SLOTS, HIDE_X, HIDE_Y, QUEUE_IN, SENDER_AT, BOOK_AT, ENV_SPOT, SENT_X, SENT_Y, SENT, PO_H, TRAY_SPOTS, DESK_H };

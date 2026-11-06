// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A sorting room with one conveyor: an ordered partition you can watch.
//   at the back, the producer's dock feeds numbered parcels onto one roller conveyor (the partition); the worker at
//   its head takes the parcel at the front and calls downstream, the records ledger at the front of the room;
//   a parcel that fails waits on the worker's desk through its backoff (in place), or goes onto the retry shelf in
//   front of the conveyor, where a second worker takes it again when its timer runs out (a retry topic);
//   a parcel out of attempts drops into the dead-letter cage at the back right; redrive sends the cage back to the dock;
//   when the line is longer than the conveyor, a "+N" tag stands at its tail for the parcels not drawn.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate, digitCounter, person, meter, pennant, sign, plaque, faceText, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 420;

const PLATE = { x: -112, y: -106, w: 224, d: 110, r: 8 };
const PLATE_H = 12, FOOT_H = 5;
const CAP = 2.8;                                       // the size of every caption word on the machine

// ---------- back row: dock, conveyor, worker's desk, dead-letter cage ----------
const PROD = { x: -106, y: -92, w: 16, d: 16, r: 1.5 };
const PROD_H = 10;
export const PROD_SPOT = [PROD.x + PROD.w / 2, PROD.y + PROD.d / 2, PROD_H + 0.3];

const BED = { x: -88, y: -90, w: 118, d: 14, r: 1 };
const BED_H = 9;
export const LANE_Y = BED.y + BED.d / 2;
export const LANE_Z = BED_H + 0.4;
export const SLOTS = 13;
export const SLOT_X = Array.from({ length: SLOTS }, (_, i) => 25.5 - 9 * i);

// The "+N" tag at the tail: it takes the last slot when the line doesn't fit.
export const MORE = { x: SLOT_X[SLOTS - 1], y: LANE_Y, z: LANE_Z };

const WD = { x: 34, y: -94, w: 28, d: 18, r: 1.4 };
const DESK_H = 10;
export const DESK_SPOT = [WD.x + 8, WD.y + 9, DESK_H + 0.3];

const PLINTH = { x: 66, y: -104, w: 42, d: 32, r: 1.5 };
const PLINTH_H = 12, CAGE_H = 18;
export const CAGE_SPOTS = (() => {
  const out = [];
  for (let layer = 0; layer < 2; layer++) for (const y of [-95, -84]) for (const x of [74, 83, 92, 101]) out.push([x, y, PLINTH_H + 0.3 + layer * 6.4]);
  return out;
})();

// ---------- middle row: the retry shelf (the retry topic) and the retry desk ----------
const SHELF = { x: -84, y: -62, w: 148, d: 12, r: 1 };
const SHELF_H = 7;
export const SHELF_X = Array.from({ length: 8 }, (_, i) => -49 + 15 * i);
export const SHELF_Y = SHELF.y + SHELF.d / 2;
export const SHELF_Z = SHELF_H + 0.3;

const RD = { x: 68, y: -60, w: 28, d: 16, r: 1.4 };
export const RDESK_SPOT = [RD.x + 8, RD.y + 8, DESK_H + 0.3];
const RWORKER = [102, -52];

// ---------- front row: the records ledger (downstream) ----------
const LEDGER = { x: -58, y: -30, w: 164, d: 18, r: 2 };
const LEDGER_H = 11;
const LEDGER_FRONT = LEDGER.y + LEDGER.d;
export const DRAWER_X = [0, 1, 2, 3].map((i) => LEDGER.x + 3 + 28 * i);
export const DRAWER_SPOT = DRAWER_X.map((x) => [x + 14, LEDGER.y + LEDGER.d / 2, LEDGER_H + 0.3]);

export const BOX = { w: 8, d: 8, h: 6 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [PLINTH.x, PLINTH.y, PLINTH_H + CAGE_H + 12], [PROD.x, PROD.y - 8, 24], [PLINTH.x + PLINTH.w, PLINTH.y, PLINTH_H + CAGE_H + 4]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

const { S, L, D, seg } = shorthand(P);
const word = (x, y, z, text, opts = {}) => faceText(P, [x, y, z], text, { size: CAP, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + labelPlate(P, { x: -106, y: -30, w: 42, d: 13, r: 1.5 }, [[-101, -25.5, 26], [-101, -21.5, 32]])
    + rulerStrip(P, { x: -106, y: -12, w: 42, d: 6, r: 1 });
}

// The producer's dock at the tail, with the producer behind it.
function dock() {
  const out = [person(P, [PROD.x + PROD.w / 2, PROD.y - 8, 0], { scale: 0.72, hat: "cap" })];
  out.push(S(k.slabOf(PROD, 0, PROD_H, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PROD, 2), PROD_H, P), { tone: "faint" }));
  return out.join("");
}
// The tag at the tail for parcels the conveyor can't show: a card standing in the last slot (the live code sets it).
function moreTag() {
  const c = { x: MORE.x - 4.4, y: MORE.y + 3, w: 8.8, h: 6.6 };
  return `<g data-more style="display:none">${S(k.slabOf({ x: c.x, y: c.y - 0.8, w: c.w, d: 0.8, r: 0.2 }, MORE.z, c.h, P, 2, 0.2), { tone: "hi", crease: "lo" })}`
    + faceText(P, [MORE.x, c.y, MORE.z + 2], "+0", { size: 3.4, tone: "hi", anchor: "middle", attr: "data-more-text" }) + `</g>`;
}

// The partition: one roller conveyor. Rollers across the top, a rail along each side, slot marks on the front rail, an
// end stop at the head; on its front, the lag (parcels not yet done with) and how long the head has been waiting.
function conveyor() {
  const out = [S(k.slabOf(BED, 0, BED_H, P, 3, 0.5), { tone: "mid" })];
  const rollers = [];
  for (let x = BED.x + 3; x < BED.x + BED.w - 2; x += 3) rollers.push(k.lineOnTop([x, BED.y + 2.2], [x, BED.y + BED.d - 2.2], BED_H, P));
  out.push(L(rollers.join(""), { tone: "lo" }));
  for (const y of [BED.y + 0.2, BED.y + BED.d - 1.6]) out.push(S(k.slabOf({ x: BED.x + 1, y, w: BED.w - 2, d: 1.4, r: 0.3 }, BED_H, 1.6, P, 2), { tone: "hi", crease: "none" }));
  out.push(L(SLOT_X.map((x) => k.lineOnTop([x + 4.5, BED.y + BED.d - 1.6], [x + 4.5, BED.y + BED.d - 0.2], BED_H + 1.6, P)).join(""), { tone: "mid" }));
  out.push(S(k.slabOf({ x: BED.x + BED.w - 2.4, y: BED.y + 0.8, w: 2.4, d: BED.d - 1.6, r: 0.4 }, BED_H, 6, P, 2), { tone: "hi", crease: "lo" }));
  const front = BED.y + BED.d;
  out.push(digitCounter(P, { x: -84, y: front, z: 1.8, count: 3, w: 4.4, h: 5.4, gap: 0.8, pad: 1.4, name: "lag" }));
  out.push(word(-65, front, 2.8, "LAG"));
  out.push(digitCounter(P, { x: -44, y: front, z: 1.8, count: 3, w: 4.4, h: 5.4, gap: 0.8, pad: 1.4, name: "oldest" }));
  out.push(word(-25, front, 2.8, t("OLDEST WAIT, S", "ESPERA MÁS LARGA, S")));
  return out.join("");
}

// A desk with a worker behind it (or beside it), a stamp pad, and on the main desk the backoff meter.
function deskTop(plan, name) {
  const out = [S(k.slabOf(plan, 0, DESK_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(plan, 1.8), DESK_H, P), { tone: "faint" }) })];
  const sx = plan.x + plan.w - 7, sy = plan.y + plan.d / 2;
  out.push(S(k.slabOf({ x: sx - 3, y: sy - 3, w: 6, d: 6, r: 0.6 }, DESK_H, 0.8, P, 2), { tone: "lo", crease: "none" }));
  out.push(`<g data-stamp="${name}">${S(k.cylinder(sx, sy, 2.2, DESK_H + 0.8, 1.6, P, 18), { tone: "hi", crease: "lo" })}${S(k.cylinder(sx, sy, 0.8, DESK_H + 2.4, 3.6, P, 12), { tone: "mid", crease: "none" })}${S(k.cylinder(sx, sy, 1.5, DESK_H + 6, 1.4, P, 14), { tone: "hi", crease: "lo" })}</g>`);
  return out.join("");
}
function workerDesk() {
  const out = [person(P, [WD.x + WD.w / 2, WD.y - 7, 0], { scale: 0.75 })];
  out.push(deskTop(WD, "main"));
  const front = WD.y + WD.d;
  out.push(meter(P, { x: WD.x + 6, y: front, z: 2.2, r: 4, ticks: 8, name: "backoff", value: 0 }));
  out.push(word(WD.x + 12, front, 3.4, "BACKOFF"));
  return out.join("");
}
function retryDesk() {
  const out = [deskTop(RD, "retry")];
  const front = RD.y + RD.d;
  out.push(word(RD.x + RD.w / 2, front, 3.4, t("RETRY", "REINTENTO"), { anchor: "middle" }));
  return out.join("");
}
function retryWorker() {
  return person(P, [RWORKER[0], RWORKER[1], 0], { scale: 0.7 });
}

// The retry shelf: a parcel waiting out its delay sits on a slot over a timer that runs down to its next attempt.
function shelf() {
  const front = SHELF.y + SHELF.d;
  const out = [S(k.slabOf(SHELF, 0, SHELF_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(SHELF_X.map((x) => k.planOutline({ x: x - 4.6, y: SHELF.y + 1.7, w: 9.2, d: 8.6, r: 0.6 }, SHELF_H, P)).join(""), { tone: "faint" }));
  SHELF_X.forEach((x, i) => out.push(meter(P, { x, y: front, z: 1.4, r: 3.8, ticks: 6, name: "due" + i, value: 0 })));
  out.push(word(SHELF.x + 3, front, 4.6, t("RETRY", "TOPIC DE")), word(SHELF.x + 3, front, 1.3, t("TOPIC", "REINTENTOS")));
  return out.join("");
}

// Downstream's status panel on the ledger's right end: OK, FLAKY or DOWN (lit: a failure).
function status() {
  const at = { x: LEDGER.x + LEDGER.w + 1.2, y: LEDGER_FRONT - 1, z: 1.6, w: LEDGER.d - 2, h: 8, face: "x", posts: false, size: 3.6 };
  return `<g data-status="ok">${sign(P, { ...at, text: "OK" })}</g>`
    + `<g data-status="flaky" style="display:none">${sign(P, { ...at, text: t("FLAKY", "INESTABLE"), size: 2.8 })}</g>`
    + `<g class="wb-lit-group" data-status="down" style="display:none">${litFill(sign(P, { ...at, text: t("DOWN", "CAÍDO"), lit: true }))}</g>`;
}

// The dead-letter cage: a plinth with its counter, a cage of bars and a pennant that flies when a parcel lands.
const CAGE = { x: PLINTH.x + 2, y: PLINTH.y + 2, w: PLINTH.w - 4, d: PLINTH.d - 4 };
const cageBar = (x, y) => seg([x, y, PLINTH_H], [x, y, PLINTH_H + CAGE_H]);
function cageBack() {
  const out = [S(k.slabOf(PLINTH, 0, PLINTH_H, P, 3, 0.5), { tone: "mid" })];
  // the counter on the plinth's right face (reads along -y), the words after it
  const side = PLINTH.x + PLINTH.w, front = PLINTH.y + PLINTH.d;
  out.push(digitCounter(P, { x: side, y: front - 5, z: 1.2, count: 3, face: "x", w: 4.2, h: 4.6, gap: 0.8, pad: 1.2, name: "dead" }));
  out.push(word(side, front - 4.2, 8.7, t("DEAD LETTERS", "MENSAJES MUERTOS"), { face: "x" }));
  const bars = [];
  for (let x = CAGE.x + 3.5; x < CAGE.x + CAGE.w; x += 3.5) bars.push(cageBar(x, CAGE.y));
  for (let y = CAGE.y + 3.5; y < CAGE.y + CAGE.d; y += 3.5) bars.push(cageBar(CAGE.x, y));
  out.push(L(bars.join(""), { tone: "lo" }));
  out.push(L(k.planOutline({ ...CAGE, r: 0 }, PLINTH_H + 0.2, P), { tone: "lo" }));
  return out.join("");
}
function cageFront() {
  const bars = [];
  for (let x = CAGE.x + 3.5; x < CAGE.x + CAGE.w; x += 3.5) bars.push(cageBar(x, CAGE.y + CAGE.d));
  for (let y = CAGE.y + 3.5; y < CAGE.y + CAGE.d; y += 3.5) bars.push(cageBar(CAGE.x + CAGE.w, y));
  const out = [L(bars.join(""), { tone: "mid" }), L(k.planOutline({ ...CAGE, r: 0 }, PLINTH_H + CAGE_H, P), { tone: "mid" })];
  for (const [x, y] of [[CAGE.x, CAGE.y], [CAGE.x + CAGE.w, CAGE.y], [CAGE.x, CAGE.y + CAGE.d], [CAGE.x + CAGE.w, CAGE.y + CAGE.d]]) out.push(S(k.cylinder(x, y, 0.9, PLINTH_H, CAGE_H, P, 12), { tone: "mid", crease: "none" }));
  out.push(`<g data-flag="off">${pennant(P, { x: CAGE.x + CAGE.w, y: CAGE.y, z: PLINTH_H + CAGE_H, height: 11, length: 9, drop: 5.5 })}</g>`);
  out.push(`<g data-flag="on" style="display:none">${pennant(P, { x: CAGE.x + CAGE.w, y: CAGE.y, z: PLINTH_H + CAGE_H, height: 11, length: 9, drop: 5.5, lit: true })}</g>`);
  return out.join("");
}

// The records ledger: one drawer per customer, each with its letter on a tab (lit when the record just went back to an
// older version) and the version it holds; at the right end, updates done and updates that arrived out of order.
function ledger() {
  const out = [S(k.slabOf(LEDGER, 0, LEDGER_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(LEDGER, 2.2), LEDGER_H, P), { tone: "faint" }));
  // the title plaque sits on the top past the drawers, clear of where done parcels land
  out.push(plaque(P, { x: LEDGER.x + 3 + 28 * 4 + 4, y: LEDGER.y + 5, z: LEDGER_H, w: 36, d: 8, text: t("RECORDS", "REGISTROS"), size: 3.4 }));
  const f = LEDGER_FRONT;
  DRAWER_X.forEach((x, i) => {
    out.push(L(k.faceRectY(P, x, x + 26, f, 1, LEDGER_H - 1), { tone: "lo" }));
    const tab = { x: x + 2, y: f, w: 8, d: 0.8, r: 0.2 };
    out.push(`<g class="wb-lit-group" data-tab="${i}">${S(k.slabOf(tab, 1.8, 7.4, P, 2, 0.2), { tone: "hi", crease: "lo" })}${faceText(P, [x + 6, f + 0.8, 3.1], "ABCD"[i], { size: 5.2, tone: "hi", anchor: "middle" })}</g>`);
    out.push(digitCounter(P, { x: x + 13.4, y: f, z: 2.6, count: 2, w: 4.4, h: 5.4, gap: 0.6, pad: 1.2, name: "rec" + i }));
  });
  const x0 = LEDGER.x + 3 + 28 * 4;
  out.push(digitCounter(P, { x: x0 + 1.5, y: f, z: 1.4, count: 3, w: 3.8, h: 4.6, gap: 0.6, pad: 1, name: "done" }));
  out.push(word(x0, f, 8.4, t("DONE", "HECHOS")));
  out.push(digitCounter(P, { x: x0 + 22, y: f, z: 1.4, count: 3, w: 3.8, h: 4.6, gap: 0.6, pad: 1, name: "stale" }));
  out.push(word(x0 + 20.5, f, 8.4, t("OUT OF ORDER", "FUERA DE ORDEN")));
  return out.join("");
}

// A parcel, drawn at the origin and moved with translateAlong: its customer's version on top, the customer's letter on
// the front, a crossed band when malformed, and a tag with its attempts once it has failed.
export function parcelSvg() {
  const h = BOX.h;
  const b = { x: -BOX.w / 2, y: -BOX.d / 2, w: BOX.w, d: BOX.d, r: 0.5 };
  const out = [];
  out.push(litFill(S(k.slabOf(b, 0, h, P, 2, 0.3), { tone: "hi", crease: "lo" })).replace('class="iso-solid"', 'class="iso-solid" data-body'));
  out.push(L(k.lineOnTop([b.x + 3, b.y], [b.x + 3, b.y + b.d], h, P), { tone: "faint" }));
  out.push(`<g data-bad style="display:none">${L(seg([BOX.w / 2, -3, 0.8], [BOX.w / 2, 3, h - 0.8]) + seg([BOX.w / 2, 3, 0.8], [BOX.w / 2, -3, h - 0.8]), { tone: "hi" })}</g>`);
  out.push(faceText(P, [0.8, 0.9, h], "0", { face: "top", size: 3.6, tone: "hi", anchor: "middle", attr: "data-num" }));
  out.push(faceText(P, [0, BOX.d / 2, 1.2], "A", { size: 3.6, tone: "hi", anchor: "middle", attr: "data-key" }));
  out.push(`<g data-tag style="display:none">`);
  out.push(S(k.slabOf({ x: -3.6, y: -3.4, w: 4.4, d: 0.5, r: 0.1 }, h, 5, P, 1, 0.1), { tone: "hi", crease: "lo" }));
  out.push(faceText(P, [-1.4, -2.9, h + 1.2], "2", { size: 3.2, tone: "hi", anchor: "middle", attr: "data-tries" }));
  out.push(`</g>`);
  return out.join("");
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A sorting room on a base plate. At the back left a producer stands at a dock that drops numbered parcels onto the tail of one long roller conveyor, the partition; each parcel shows a customer letter, A to D, and that customer's version number. At the head, on the right, a worker takes the parcel at the front onto a desk and calls downstream. Downstream is the records ledger at the front of the room: one drawer per customer showing the version its record holds, a tab that lights when a record goes back to an older version, and counters for updates done and updates that arrived out of order. A status board on the ledger's right end reads OK, FLAKY or DOWN. A parcel that fails waits on the worker's desk while a backoff meter runs down, or goes onto the retry shelf in front of the conveyor, over a timer, where a second worker takes it again. A parcel out of attempts drops into the dead-letter cage at the back right. Counters on the conveyor show the lag and how long the oldest parcel has waited; when the line is longer than the conveyor, a tag at its tail counts the parcels not shown.",
      "Una sala de clasificación sobre una placa base. Atrás a la izquierda, un productor está en un muelle que deja paquetes numerados al final de una sola cinta de rodillos larga, la partición; cada paquete muestra una letra de cliente, de la A a la D, y el número de versión de ese cliente. En la cabeza, a la derecha, un trabajador toma el paquete del frente, lo pone en su escritorio y llama al servicio de destino. El servicio de destino es el libro de registros al frente de la sala: un cajón por cliente con la versión que guarda su registro, una pestaña que se enciende cuando un registro vuelve a una versión más vieja, y contadores de actualizaciones hechas y de actualizaciones que llegaron fuera de orden. Un tablero en el extremo derecho del libro dice OK, INESTABLE o CAÍDO. Un paquete que falla espera en el escritorio del trabajador mientras baja un medidor de espera, o pasa al estante de reintentos delante de la cinta, sobre un temporizador, donde un segundo trabajador lo vuelve a tomar. Un paquete sin intentos cae en la jaula de mensajes muertos, atrás a la derecha. Contadores en la cinta muestran el lag y cuánto lleva esperando el paquete más antiguo; cuando la fila no cabe en la cinta, una etiqueta en su final cuenta los paquetes que no se ven.",
    ),
    body: [
      plate(),
      cageBack(),
      dock(),
      conveyor(),
      workerDesk(),
      `<g data-layer="back"></g>`,
      cageFront(),
      moreTag(),
      shelf(),
      retryWorker(),
      retryDesk(),
      `<g data-layer="mid"></g>`,
      ledger(),
      status(),
      `<g data-layer="front"></g>`,
    ],
  });
}

export const GEOMETRY = { SLOT_X, LANE_Y, LANE_Z, SLOTS, PROD_SPOT, DESK_SPOT, RDESK_SPOT, CAGE_SPOTS, SHELF_X, SHELF_Y, SHELF_Z, DRAWER_SPOT, BOX };

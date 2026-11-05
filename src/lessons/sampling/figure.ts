// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A trace archive. At the back left, the service bench: requests from the users walk a track past three services, A
// (the edge), B (orders) and C (payments); each service has a sampler (a lamp that lights when it records, and a
// plaque with its rate) and writes one span card per request. The cards ride the belt to the collector at the back
// right, whose rack holds each trace's cards over a timer (the decision wait) until it keeps or drops them. Kept cards
// are filed by trace in the archive's folders, each with its weight; dropped ones fall into the discard bin. On the
// tally desk: errors and slow requests sent and kept, and two dials for the error rate the archive gives, counted and
// weighted. Every number is a counter on a real object.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, figurine, dial, meter, plaque, sign, lamp, faceText, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 380;

const PLATE = { x: -150, y: -100, w: 300, d: 140, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// ---------- the service bench, back left ----------
const BENCH = { x: -146, y: -96, w: 150, d: 46, r: 1.5 };
export const BENCH_H = 6;
export const SX = [-116, -71, -26];                   // station centres: A, B, C
const ST_Y = -94, ST_D = 20, ST_H = 14;
const ST_TOP = BENCH_H + ST_H;                        // 20
const ST_FRONT = ST_Y + ST_D;                         // -74
export const TRACK_Y = -69.5;
export const ENTRY = [-142, TRACK_Y, BENCH_H];
export const LAMP_AT = SX.map((cx) => [cx - 10, ST_Y + 5, ST_TOP]);
// where a span card leaves its station
export const EMIT = SX.map((cx) => [cx + 6, ST_FRONT + 1, BENCH_H + 0.2]);

// ---------- the belt, along the front of the bench, into the collector ----------
const BELT = { x: -144, y: -64, w: 150, d: 10, r: 1 };
const BELT_T = 3;
export const BELT_H = BENCH_H + BELT_T;               // the belt's top
export const BELT_Y = BELT.y + BELT.d / 2;            // -59

// ---------- the collector, back right ----------
const COLL = { x: 8, y: -96, w: 138, d: 40, r: 1.5 };
export const COLL_H = 16;
export const SLOTS = 6;
export const SLOT_X = Array.from({ length: SLOTS }, (_, i) => 13 + i * 22);       // slot left edges
const SLOT_W = 20;
export const SLOT_CARD_X = [-6.8, 0, 6.8];             // a trace's cards stand side by side in its slot: A, B, C
export const SLOT_CARD_Y = -78;
const COLL_FRONT = COLL.y + COLL.d;                    // -56
export const INLET = [COLL.x + 2, BELT_Y, BELT_H];

// ---------- the archive, front left: a back tier and a front tier of folders ----------
const BACK = { x: -146, y: -46, w: 170, d: 34, r: 1.5 };
export const BACK_H = 14;
const FRONT = { x: -146, y: -12, w: 170, d: 42, r: 1.5 };
export const FRONT_H = 8;
export const FOLDERS = 10;                             // 5 on each tier
const FOLDER = { w: 31, d: 22 };
export const folderAt = (i) => {
  const back = i >= 5, j = i % 5;
  const x = -142 + j * 33, y = back ? -42 : -8, z = back ? BACK_H : FRONT_H;
  return { x, y, z };
};
export const CARD = { w: 6, h: 8, tall: 11 };
// a card's spot in a folder: A, B, C left to right
export const cardSpot = (i, svc) => { const f = folderAt(i); return [f.x + 7.5 + svc * 8.5, f.y + 11, f.z + 1.4]; };

// ---------- right: the tally desk, with the discard bin let into its top ----------
const DESK = { x: 30, y: -40, w: 116, d: 70, r: 1.8 };
const DESK_H = 13;
const BIN = { x: 34, y: -36, w: 32, d: 62, r: 1.5 };
export const BIN_SPOT = [BIN.x + BIN.w / 2, BIN.y + BIN.d / 2, DESK_H + 2.2];

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [COLL.x + 10, COLL.y, COLL_H + 9], [COLL.x + COLL.w - 10, COLL.y, COLL_H + 9], [-142, -82, BENCH_H + 14], [SX[0], ST_Y, ST_TOP + 4]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

const { S, L } = shorthand(P);
const words = (x, y, z, w, size = 3, opts = {}) => faceText(P, [x, y, z], w, { size, tone: "hi", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H });
}

// ---------- the service bench ----------
const NAMES = [t("EDGE", "ENTRADA"), t("ORDERS", "PEDIDOS"), t("PAYMENTS", "PAGOS")];
function bench() {
  const out = [S(k.slabOf(BENCH, 0, BENCH_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(BENCH, 1.8), BENCH_H, P), { tone: "faint" }));
  // the users at the left end, sending requests
  out.push(figurine(P, [-139.5, -88, BENCH_H], { scale: 0.78 }), figurine(P, [-139.5, -77, BENCH_H], { scale: 0.78 }));
  return out.join("");
}
function station(i) {
  const cx = SX[i];
  const plan = { x: cx - 17, y: ST_Y, w: 34, d: ST_D, r: 1.4 };
  const out = [S(k.slabOf(plan, BENCH_H, ST_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(plan, 1.8), ST_TOP, P), { tone: "faint" }) })];
  out.push(faceText(P, [cx - 9, ST_Y + 18.5, ST_TOP], "ABC"[i], { face: "top", size: 9, tone: "hi", anchor: "middle" }));
  // the sampler: its rate on a plaque (the live code writes it) and a lamp that lights while it records
  out.push(plaque(P, { x: cx - 1.5, y: ST_Y + 9.5, z: ST_TOP, w: 17, d: 10 }));
  out.push(faceText(P, [cx + 7, ST_Y + 16.6, ST_TOP + 0.8], "10%", { face: "top", size: 4.6, tone: "hi", anchor: "middle", attr: `data-rate="${i}"` }));
  out.push(`<g data-lamp="${i}">${lamp(P, LAMP_AT[i], { r: 2.4 })}</g><g data-lamp-on="${i}" style="display:none">${litFill(lamp(P, LAMP_AT[i], { r: 2.4, lit: true }))}</g>`);
  out.push(words(cx - 15, ST_FRONT, BENCH_H + 4.6, NAMES[i], 3.2, { tone: "hi" }));
  return out.join("");
}
function track() {
  const out = [];
  out.push(S(k.slabOf({ x: -143, y: TRACK_Y - 2, w: 128, d: 4, r: 0.6 }, BENCH_H, 0.6, P, 2), { tone: "lo", crease: "none" }));
  out.push(L(k.lineOnTop([-142, TRACK_Y], [-16, TRACK_Y], BENCH_H + 0.6, P), { tone: "mid" }));
  return out.join("");
}

// ---------- the belt ----------
function belt() {
  const out = [S(k.slabOf(BELT, BENCH_H, BELT_T, P, 3, 0.4), { tone: "mid" })];
  const rollers = [];
  for (let x = BELT.x + 3; x < BELT.x + BELT.w - 2; x += 3.2) rollers.push(k.lineOnTop([x, BELT.y + 1.8], [x, BELT.y + BELT.d - 1.8], BELT_H, P));
  out.push(L(rollers.join(""), { tone: "lo" }));
  for (const y of [BELT.y + 0.2, BELT.y + BELT.d - 1.4]) out.push(S(k.slabOf({ x: BELT.x + 1, y, w: BELT.w - 2, d: 1.2, r: 0.3 }, BELT_H, 1.2, P, 2), { tone: "hi", crease: "none" }));
  return out.join("");
}

// ---------- the collector ----------
function collectorSigns() {
  const z = COLL_H;
  const one = sign(P, { x: 46, y: COLL.y + 1.2, z, w: 62, h: 7.5, text: t("COLLECTOR", "COLECTOR"), size: 3.6, posts: false });
  const two = sign(P, { x: 13, y: COLL.y + 1.2, z, w: 60, h: 7.5, text: t("COLLECTOR 1", "COLECTOR 1"), size: 3.6, posts: false })
    + sign(P, { x: 81, y: COLL.y + 1.2, z, w: 60, h: 7.5, text: t("COLLECTOR 2", "COLECTOR 2"), size: 3.6, posts: false });
  return `<g data-signs="one">${one}</g><g data-signs="two" style="display:none">${two}</g>`;
}
function collector() {
  const out = [S(k.slabOf(COLL, 0, COLL_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(COLL, 1.8), COLL_H, P), { tone: "faint" }));
  // the rack: one slot per trace waiting for its decision, each over a timer
  SLOT_X.forEach((x, i) => {
    out.push(L(k.planOutline({ x, y: -88, w: SLOT_W, d: 18, r: 0.8 }, COLL_H, P), { tone: "lo" }));
    out.push(`<g data-meter-wrap="${i}">${meterPart(x + SLOT_W / 2, i)}</g>`);
  });
  // the wall between the two collectors (shown with two)
  out.push(`<g data-divider style="display:none">${S(k.slabOf({ x: 77.2, y: -92, w: 1.6, d: 30, r: 0.3 }, COLL_H, 6, P, 2), { tone: "hi", crease: "lo" })}</g>`);
  // IN MEMORY: traces held waiting for a decision, on the collector's right side
  const side = COLL.x + COLL.w;
  out.push(digitCounter(P, { x: side, y: COLL_FRONT - 4, z: 2.4, count: 4, w: 4.4, h: 6, gap: 0.6, pad: 1, face: "x", name: "held" }));
  out.push(faceText(P, [side, COLL_FRONT - 4, 12.2], t("IN MEMORY", "EN MEMORIA"), { face: "x", size: 3, tone: "hi" }));
  return out.join("");
}
function meterPart(x, i) {
  return meter(P, { x, y: COLL_FRONT, z: 8.6, r: 4.6, ticks: 6, name: "wait" + i, value: 0 });
}

// ---------- the archive ----------
function tier(plan, h) {
  return S(k.slabOf(plan, 0, h, P, 3, 0.5), { tone: "mid" }) + L(k.planOutline(k.insetPlan(plan, 1.8), h, P), { tone: "faint" });
}
function folder(i) {
  const f = folderAt(i);
  const tray = { x: f.x, y: f.y, w: FOLDER.w, d: FOLDER.d, r: 1 };
  const out = [S(k.slabOf(tray, f.z, 1.4, P, 3, 0.3), { tone: "lo", crease: "none" })];
  out.push(L(k.planOutline(k.insetPlan(tray, 1.2), f.z + 1.4, P), { tone: "mid" }));
  // three card places: A, B, C
  for (let s = 0; s < 3; s++) {
    const [cx, cy] = cardSpot(i, s);
    out.push(L(k.planOutline({ x: cx - CARD.w / 2 - 0.6, y: cy - 1.4, w: CARD.w + 1.2, d: 2, r: 0.3 }, f.z + 1.4, P), { tone: "lo" }));
  }
  // the weight plaque in front: how many requests this kept trace stands for
  out.push(plaque(P, { x: f.x + 1, y: f.y + FOLDER.d + 0.8, z: f.z, w: 18, d: 7.6 }));
  out.push(faceText(P, [f.x + 10, f.y + FOLDER.d + 6.4, f.z + 0.8], "", { face: "top", size: 4.4, tone: "hi", anchor: "middle", attr: `data-weight="${i}"` }));
  return out.join("");
}
function archiveFront() {
  const face = FRONT.y + FRONT.d;
  const out = [words(-142, face, 2.4, t("ARCHIVE", "ARCHIVO"), 4.2, { tone: "hi" })];
  out.push(digitCounter(P, { x: -114, y: face, z: 1.2, count: 4, w: 4.4, h: 5.6, gap: 0.6, pad: 0.9, name: "kept" }));
  out.push(words(-92, face, 2.8, t("KEPT", "GUARDADAS"), 3));
  out.push(digitCounter(P, { x: -62, y: face, z: 1.2, count: 4, w: 4.4, h: 5.6, gap: 0.6, pad: 0.9, name: "broken" }));
  out.push(words(-40, face, 2.8, t("BROKEN", "INCOMPLETAS"), 3));
  return out.join("");
}

// ---------- the tally desk and its discard bin ----------
function desk() {
  const out = [S(k.slabOf(DESK, 0, DESK_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(DESK, 2.2), DESK_H, P), { tone: "faint" }));
  // the bin: a well in the desk top that dropped cards fall into
  out.push(S(k.slabOf(BIN, DESK_H, 2.2, P, 3, 0.3), { tone: "lo", crease: "none", inner: L(k.planOutline(k.insetPlan(BIN, 2.2), DESK_H + 2.2, P), { tone: "mid" }) }));
  const face = DESK.y + DESK.d, side = DESK.x + DESK.w;
  // one caption per counter, on the same face, clear of its housing
  out.push(digitCounter(P, { x: BIN.x + 1, y: face, z: 2.4, count: 4, w: 4.2, h: 5.6, gap: 0.6, pad: 1, name: "dropped" }));
  out.push(words(BIN.x + 22, face, 3.6, t("DROPPED", "DESCARTADAS"), 3));
  out.push(digitCounter(P, { x: DESK.x + 51, y: face, z: 2.4, count: 3, w: 4, h: 5.6, gap: 0.5, pad: 1, name: "errAll" }));
  out.push(words(DESK.x + 66.4, face, 3.6, t("ERRORS", "ERRORES"), 3));
  out.push(digitCounter(P, { x: DESK.x + 82.4, y: face, z: 2.4, count: 3, w: 4, h: 5.6, gap: 0.5, pad: 1, name: "errKept" }));
  out.push(words(DESK.x + 97.8, face, 3.6, t("KEPT", "GUARDADOS"), 3));
  out.push(digitCounter(P, { x: side, y: face - 3, z: 2.4, count: 3, w: 4, h: 5.6, gap: 0.5, pad: 1, face: "x", name: "slowAll" }));
  out.push(faceText(P, [side, face - 18.4, 3.6], t("SLOW", "LENTAS"), { face: "x", size: 3, tone: "hi" }));
  out.push(digitCounter(P, { x: side, y: face - 34, z: 2.4, count: 3, w: 4, h: 5.6, gap: 0.5, pad: 1, face: "x", name: "slowKept" }));
  out.push(faceText(P, [side, face - 49.4, 3.6], t("KEPT", "GUARDADAS"), { face: "x", size: 3, tone: "hi" }));
  // the error-rate dials: what the archive says, counting its traces vs weighting each by its plaque (0 to 50%)
  const dz = DESK_H;
  for (const [i, x, label] of [[0, DESK.x + 57, t("COUNTED", "CONTADA")], [1, DESK.x + 97, t("WEIGHTED", "PONDERADA")]]) {
    out.push(dial(P, { x, y: DESK.y + 24, z: dz, r: 9.5, h: 3, ticks: 50, every: 10, from: -Math.PI * 0.75, span: Math.PI * 1.5, name: "rate" + i, value: 0 }));
    out.push(faceText(P, [x, DESK.y + 42.5, dz], label, { face: "top", size: 3.4, tone: "hi", anchor: "middle" }));
    // the scale: 0 at the front left, 50% at the front right
    const r = 13.4, cy = DESK.y + 24;
    for (const [a, v] of [[-0.75, "0"], [0.75, "50%"]]) out.push(faceText(P, [x + Math.sin(a * Math.PI) * r, cy - Math.cos(a * Math.PI) * r + 1.4, dz], v, { face: "top", size: 3.4, tone: "hi", anchor: "middle" }));
  }
  out.push(faceText(P, [DESK.x + 77, DESK.y + 6.4, dz], t("ERROR RATE", "TASA DE ERROR"), { face: "top", size: 3.8, tone: "hi", anchor: "middle" }));
  return out.join("");
}

// ---------- moving parts, drawn at the origin and moved with translateAlong ----------
// A span card: its service letter on the front; a slow request's card is taller; an error's is lit.
export function cardSvg() {
  const one = (h, kind) => {
    const plan = { x: -CARD.w / 2, y: -0.4, w: CARD.w, d: 0.8, r: 0.15 };
    const out = [`<g data-kind="${kind}"${kind === "tall" ? ' style="display:none"' : ""}>`];
    out.push(S(k.slabOf(plan, 0, h, P, 2, 0.15), { tone: "hi", crease: "none" }).replace('class="iso-solid"', 'class="iso-solid" data-body'));
    out.push(faceText(P, [0, 0.4, h * 0.3], "A", { size: 3.4, tone: "hi", anchor: "middle", attr: "data-letter" }));
    out.push(`</g>`);
    return out.join("");
  };
  return one(CARD.h, "card") + one(CARD.tall, "tall");
}
// A request on the track: a small block; under parent-based sampling it carries the sampled flag.
export function tokenSvg() {
  const plan = { x: -3, y: -3, w: 6, d: 6, r: 0.8 };
  const flag = `<g data-flag style="display:none">${L(k.segment([2, -2, 4.5], [2, -2, 11.5], P), { tone: "hi" })}<path class="wb-pennant" d="${k.pathOf([k.iso([2, -2, 11.5], P), k.iso([7, -2, 9.5], P), k.iso([2, -2, 7.5], P)], true)}"/></g>`;
  return S(k.slabOf(plan, 0, 4.5, P, 2, 0.4), { tone: "hi", crease: "lo" }) + flag;
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A trace archive on a base plate. At the back left, users send requests along a track past three services on a bench: A, the edge, B, orders, and C, payments. Each service has a sampler with a lamp and a plaque showing its rate, and writes one span card per request it records. The cards ride a belt across the middle to the collector at the back right, whose rack holds each trace's cards over a timer until it decides to keep or drop them; a counter on its side shows the traces held in memory. Kept cards are filed by trace in the archive's folders at the front left, three places per folder, with a plaque giving the trace's weight; counters show the traces kept and those kept with spans missing. Dropped cards fall into the discard bin at the right. On the tally desk in front, counters show errors and slow requests sent and kept, and two dials show the error rate the archive gives when you count its traces and when you weight them.",
      "Un archivo de trazas sobre una placa base. Atrás a la izquierda, los usuarios envían solicitudes por un riel que pasa por tres servicios sobre un banco: A, la entrada, B, pedidos, y C, pagos. Cada servicio tiene un muestreador con una lámpara y una placa con su tasa, y escribe una tarjeta de span por cada solicitud que registra. Las tarjetas viajan por una cinta en el medio hasta el colector, atrás a la derecha, cuyo estante retiene las tarjetas de cada traza sobre un temporizador hasta que decide guardarlas o descartarlas; un contador en su costado muestra las trazas retenidas en memoria. Las tarjetas guardadas se archivan por traza en las carpetas del archivo, adelante a la izquierda, con tres lugares por carpeta y una placa con el peso de la traza; los contadores muestran las trazas guardadas y las que se guardaron con spans faltantes. Las tarjetas descartadas caen al cajón de descarte, a la derecha. En el escritorio de conteo, adelante, los contadores muestran los errores y las solicitudes lentas enviados y guardados, y dos diales muestran la tasa de error que da el archivo si cuentas sus trazas y si las ponderas.",
    ),
    body: [
      plate(),
      collectorSigns(),
      collector(),
      `<g data-layer="rack"></g>`,
      bench(),
      SX.map((_, i) => station(i)).join(""),
      track(),
      `<g data-layer="tokens"></g>`,
      belt(),
      `<g data-layer="belt"></g>`,
      tier(BACK, BACK_H),
      Array.from({ length: 6 }, (_, j) => folder(6 + j)).join(""),
      `<g data-layer="back"></g>`,
      tier(FRONT, FRONT_H),
      archiveFront(),
      Array.from({ length: 6 }, (_, j) => folder(j)).join(""),
      `<g data-layer="front"></g>`,
      desk(),
      `<g data-layer="bin"></g>`,
      `<g data-layer="fly"></g>`,
    ],
  });
}

export const CARD_SPOTS = Array.from({ length: FOLDERS }, (_, i) => [0, 1, 2].map((s) => cardSpot(i, s)));
export const GEOMETRY = { CARD_SPOTS, SX, TRACK_Y, ENTRY, BENCH_H, EMIT, BELT_Y, BELT_H, INLET, SLOTS, SLOT_X, SLOT_W, SLOT_CARD_X, SLOT_CARD_Y, COLL_H, FOLDERS, BIN_SPOT, CARD };

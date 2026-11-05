// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A combination checker and a stopwatch booth: the lesson's model of a timing leak and its fix.
//   Back left: the CHECKER, a cabinet with the guess on four digit wheels. Its comparison either stops at the first
//         wrong dial (EARLY EXIT) or always looks at all four (CONSTANT TIME); the lit plate is the one in use, and a
//         lamp over each wheel lights for every dial the latest check looked at. Counters: RUNS and OPENED.
//   Centre: the STOPWATCH on a pedestal: its needle sweeps for each reading; READING shows the last one (one decimal)
//         and READINGS how many have been taken.
//   Back right: the TALLY board: one bar per digit (or per guessed length), the mean reading so far; the column being
//         timed is lit. DIAL on its front face, SAMPLES on its right face.
//   Front: the brute-force desk (how many tries guessing blind would take on average) and the LEARNED rail, with a
//         card for each dial the listener has settled on.
// Nothing moves across a counter or a caption: the bars rise behind the tally board's front face, the needle turns on
// top of the stopwatch, lamps and cards stay in place. Built with the Anatomy kit (MIT) and the shared parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, faceText, lamp, person, plaque } from "../../../workbench/parts.mjs";
import { dial } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { DIALS, DIGITS, BRUTE } from "./sim";

export const WIDTH = 700;
export const HEIGHT = 450;

const PLATE = { x: -132, y: -84, w: 264, d: 112, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// Captions beside counters: the standard size of the other lessons, never smaller. They print in the page's muted
// text colour (page.ts css), which passes AA on front and top faces in both themes; on a shaded side face, tone hi.
const LABEL = 3.2;
const text = (x, y, z, words, size = LABEL, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });
const counter = (o) => digitCounter(P, { w: 5, h: 6.6, gap: 0.6, pad: 1.2, ...o });
const CW = 5.6;

// ---------- the checker ----------
const CK = { x: -124, y: -78, w: 100, d: 38, r: 2 };
const CK_H = 28;
const CK_FRONT = CK.y + CK.d;
const WHEEL = { x0: -114, w: 8, h: 11, gap: 2, z: 5 };
export const WHEEL_CX = Array.from({ length: DIALS }, (_, i) => WHEEL.x0 + i * (WHEEL.w + WHEEL.gap) + WHEEL.w / 2);
const PANEL = { x: CK.x + 3, y: CK.y + 1, w: CK.w - 6, d: 3, r: 0.4 };
const PANEL_H = 13;
const MODE = { early: { x: PANEL.x + 2, w: 44 }, const: { x: PANEL.x + 48, w: 42 } };

// ---------- the stopwatch ----------
const PED = { x: -20, y: -32, w: 54, d: 50, r: 2 };
const PED_H = 16;
const PED_FRONT = PED.y + PED.d;
export const WATCH = { x: 7, y: -12, r: 13 };

// ---------- the tally board ----------
const TB = { x: 40, y: -78, w: 86, d: 52, r: 2 };
export const TB_H = 18;
const TB_FRONT = TB.y + TB.d;
export const BAR = { w: 5, d: 5, y: -54, base: TB_H + 0.2, min: 1, max: 26 };
export const BAR_X = Array.from({ length: DIGITS }, (_, i) => TB.x + 6 + i * 8.4);

// ---------- the front ----------
const DESK = { x: -124, y: -26, w: 98, d: 44, r: 2 };
const DESK_H = 10;
const DESK_FRONT = DESK.y + DESK.d;
const RAIL = { x: 40, y: -16, w: 86, d: 34, r: 2 };
const RAIL_H = 7;
const RAIL_FRONT = RAIL.y + RAIL.d;
export const CARD_X = Array.from({ length: DIALS }, (_, i) => RAIL.x + 13 + i * 20);
export const CARD = { w: 12, d: 10, y: RAIL.y + 9, z: RAIL_H };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(PANEL, CK_H, CK_H + PANEL_H + 1), [BAR_X[0], BAR.y, TB_H + BAR.max], [BAR_X[DIGITS - 1], BAR.y, TB_H + BAR.max]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

const { S, L } = shorthand(P);

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H });
}

function checker() {
  const out = [S(k.slabOf(CK, 0, CK_H, P, 4, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(CK, 2.4), CK_H, P), { tone: "faint" }));
  // the guess on four big wheels, its caption above, clear of the housing
  out.push(digitCounter(P, { x: WHEEL.x0, y: CK_FRONT, z: WHEEL.z, count: DIALS, w: WHEEL.w, h: WHEEL.h, gap: WHEEL.gap, pad: 1.6, name: "guess" }));
  out.push(text(WHEEL.x0 - 1.6, CK_FRONT, WHEEL.z + WHEEL.h + 4, t("GUESS", "INTENTO")));
  // runs and opened, on the front to the right of the guess
  const cx = -64;
  out.push(counter({ x: cx, y: CK_FRONT, z: 16, count: 2, name: "runs" }));
  out.push(text(cx + 2 * CW + 2.4, CK_FRONT, 17.6, t("RUNS", "RONDAS")));
  out.push(counter({ x: cx, y: CK_FRONT, z: 5, count: 2, name: "opened" }));
  out.push(text(cx + 2 * CW + 2.4, CK_FRONT, 6.6, t("OPENED", "ABIERTAS")));
  // a lamp over each wheel, lit for every dial the latest check looked at
  out.push(plaque(P, { x: WHEEL_CX[0] - 6, y: CK_FRONT - 26, z: CK_H, w: WHEEL_CX[DIALS - 1] - WHEEL_CX[0] + 12, d: 8, text: t("LOOKED AT", "REVISADOS"), size: LABEL }));
  WHEEL_CX.forEach((x, i) => out.push(`<g data-look="${i}">${lamp(P, [x, CK_FRONT - 6, CK_H], { r: 2.4 })}</g>`));
  // the mode plates on a panel at the back of the top
  out.push(S(k.slabOf(PANEL, CK_H, PANEL_H, P, 2, 0.3), { tone: "mid", crease: "lo" }));
  const face = PANEL.y + PANEL.d;
  const plateOf = (name, words) => {
    const m = MODE[name], plan = { x: m.x, y: face, w: m.w, d: 1.2, r: 0.3 };
    return `<g class="wb-lit-group" data-mode="${name}">${S(k.slabOf(plan, CK_H + 2.5, 8, P, 2, 0.2), { tone: "hi", crease: "lo" })}`
      + faceText(P, [m.x + m.w / 2, face + 1.2, CK_H + 5.2], words, { size: LABEL, tone: "hi", anchor: "middle" }) + `</g>`;
  };
  out.push(plateOf("early", t("EARLY EXIT", "SALIDA TEMPRANA")), plateOf("const", t("CONSTANT TIME", "TIEMPO CONSTANTE")));
  // the open lamp on the right of the top
  out.push(`<g data-open>${lamp(P, [CK.x + CK.w - 9, CK_FRONT - 9, CK_H], { r: 3 })}</g>`);
  return out.join("");
}

function stopwatch() {
  const out = [S(k.slabOf(PED, 0, PED_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(PED, 2.4), PED_H, P), { tone: "faint" }));
  out.push(dial(P, { x: WATCH.x, y: WATCH.y, z: PED_H, r: WATCH.r, h: 5, ticks: 50, every: 5, name: "watch", value: 0 }));
  // the last reading: three wheels, a decimal point, one wheel
  const x0 = PED.x + 4;
  out.push(counter({ x: x0, y: PED_FRONT, z: 3.4, count: 3, name: "readI" }));
  out.push(k.dotsSvg([k.iso([x0 + 3 * CW + 0.6, PED_FRONT + 0.2, 3.8], P)], { size: 1.1, tone: "hi" }));
  out.push(counter({ x: x0 + 3 * CW + 2.2, y: PED_FRONT, z: 3.4, count: 1, name: "readF" }));
  out.push(text(x0 + 4 * CW + 5, PED_FRONT, 5, t("READING", "LECTURA")));
  // how many readings so far, on the right face
  const side = PED.x + PED.w;
  out.push(counter({ x: side, y: PED_FRONT - 4, z: 2, count: 5, face: "x", name: "readings" }));
  out.push(faceText(P, [side, PED_FRONT - 4, 12.4], t("READINGS", "LECTURAS"), { face: "x", size: LABEL, tone: "hi" }));
  return out.join("");
}

// One bar of the tally, drawn live (its height changes); the build draws the first frame.
export const barPaths = (P2, x, h, slab) => slab({ x: x - BAR.w / 2, y: BAR.y - BAR.d / 2, w: BAR.w, d: BAR.d, r: 0.5 }, BAR.base, h, P2, 2, 0.3);
function tally() {
  const out = [S(k.slabOf(TB, 0, TB_H, P, 4, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(TB, 2.4), TB_H, P), { tone: "faint" }));
  // sockets on the top, one per column
  out.push(L(BAR_X.map((x) => k.planOutline({ x: x - BAR.w / 2 - 0.8, y: BAR.y - BAR.d / 2 - 0.8, w: BAR.w + 1.6, d: BAR.d + 1.6, r: 0.6 }, TB_H, P)).join(""), { tone: "lo" }));
  // the bars, far ones first
  const order = BAR_X.map((_, i) => i).sort((a, b) => k.depthOf([BAR_X[a], BAR.y, 0], P) - k.depthOf([BAR_X[b], BAR.y, 0], P));
  out.push(`<g data-bars>${order.map((i) => `<g class="wb-lit-group" data-bar="${i}">${S(barPaths(P, BAR_X[i], 4, k.slabOf), { tone: "hi", crease: "lo" })}</g>`).join("")}</g>`);
  // column labels under each bar, and the caption, on the front face
  BAR_X.forEach((x, i) => out.push(faceText(P, [x, TB_FRONT, 12.4], String(i), { size: 4, tone: "hi", anchor: "middle", attr: `data-col="${i}"` })));
  out.push(`<g data-cap="dials">${text(TB.x + 4, TB_FRONT, 2.8, t("AVERAGE BY DIGIT", "PROMEDIO POR DÍGITO"))}</g>`);
  out.push(`<g data-cap="length" style="display:none">${text(TB.x + 4, TB_FRONT, 2.8, t("AVERAGE BY LENGTH", "PROMEDIO POR LONGITUD"))}</g>`);
  // dial and samples on the right face
  const side = TB.x + TB.w;
  const dx = TB.x + TB.w - 26;
  out.push(counter({ x: dx, y: TB_FRONT, z: 1.8, count: 1, name: "dial" }));
  out.push(text(dx + CW + 2.4, TB_FRONT, 3.4, t("DIAL", "DIAL")));
  out.push(counter({ x: side, y: TB_FRONT - 4, z: 2, count: 4, face: "x", name: "samples" }));
  out.push(faceText(P, [side, TB_FRONT - 4, 12.6], t("SAMPLES", "MUESTRAS"), { face: "x", size: LABEL, tone: "hi" }));
  return out.join("");
}

function desk() {
  const out = [S(k.slabOf(DESK, 0, DESK_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(DESK, 2.4), DESK_H, P), { tone: "faint" }));
  out.push(counter({ x: DESK.x + 5, y: DESK_FRONT, z: 1.8, count: 5, name: "brute", value: BRUTE / 2 }));
  out.push(text(DESK.x + 5 + 5 * CW + 2.4, DESK_FRONT, 3.4, t("BRUTE FORCE, AVERAGE", "FUERZA BRUTA, PROMEDIO")));
  // the listener stands at the left end of the desk, clear of the checker's wheels
  out.push(person(P, [DESK.x + 10, DESK.y + 12, DESK_H], { scale: 0.62, holding: "clipboard" }));
  return out.join("");
}

function rail() {
  const out = [S(k.slabOf(RAIL, 0, RAIL_H, P, 3, 0.5), { tone: "mid" })];
  out.push(text(RAIL.x + 4, RAIL_FRONT, 2, t("LEARNED", "APRENDIDO")));
  // a place for each dial: an outline the card lies in, and the dial's number in front of it
  out.push(L(CARD_X.map((x) => k.planOutline({ x: x - CARD.w / 2 - 1, y: CARD.y - CARD.d / 2 - 1, w: CARD.w + 2, d: CARD.d + 2, r: 0.6 }, RAIL_H, P)).join(""), { tone: "lo" }));
  CARD_X.forEach((x, i) => out.push(plaque(P, { x: x - 4, y: CARD.y + CARD.d / 2 + 2, z: RAIL_H, w: 8, d: 7, text: String(i + 1), size: LABEL })));
  // the cards lie flat, so nothing on the rail ever rises in front of the tally board's face
  CARD_X.forEach((x, i) => {
    const plan = { x: x - CARD.w / 2, y: CARD.y - CARD.d / 2, w: CARD.w, d: CARD.d, r: 0.4 };
    out.push(`<g data-card="${i}" style="display:none">${S(k.slabOf(plan, CARD.z, 0.8, P, 2, 0.15), { tone: "hi", crease: "lo" })}`
      + faceText(P, [x, CARD.y + 2.2, CARD.z + 0.8], "0", { face: "top", size: 6, tone: "hi", anchor: "middle", attr: `data-card-text="${i}"` }) + `</g>`);
  });
  return out.join("");
}

// a cable from the checker to the stopwatch, lying on the plate
function cable() {
  return L(k.onTop([[CK.x + CK.w - 6, CK_FRONT], [CK.x + CK.w - 6, PED.y + 10], [PED.x, PED.y + 10]], 0.2, P), { tone: "lo" });
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A combination checker and a stopwatch booth on a base plate. At the back left, the checker: a cabinet with the current guess on four digit wheels, a lamp over each wheel that lights for every dial the latest check looked at, and two plates, EARLY EXIT and CONSTANT TIME, of which the lit one is the comparison in use; counters show the runs and how many opened the lock. In the centre, a stopwatch on a pedestal times every check; counters show the last reading, with one decimal, and how many readings have been taken. At the back right, a tally board has one bar per digit, the average reading for that digit so far; the column being timed is lit, and counters show the dial being learned and the samples taken. At the front, a desk shows how many tries guessing blind would take on average, with the listener standing at it, and a rail holds a card for each dial the listener has settled on.",
      "Un verificador de combinaciones y una cabina con cronómetro sobre una placa base. Atrás a la izquierda, el verificador: un gabinete con el intento actual en cuatro ruedas de dígitos, una lámpara sobre cada rueda que se enciende por cada dial que revisó la última comprobación, y dos placas, SALIDA TEMPRANA y TIEMPO CONSTANTE, de las que la encendida es la comparación en uso; unos contadores muestran las rondas y cuántas abrieron la cerradura. En el centro, un cronómetro sobre un pedestal mide cada comprobación; unos contadores muestran la última lectura, con un decimal, y cuántas lecturas se tomaron. Atrás a la derecha, un tablero de conteo tiene una barra por dígito, la lectura promedio de ese dígito hasta ahora; la columna que se está midiendo está encendida, y unos contadores muestran el dial que se está aprendiendo y las muestras tomadas. Adelante, un escritorio muestra cuántos intentos haría falta en promedio adivinando a ciegas, con quien escucha parado ahí, y un riel tiene una tarjeta por cada dial que ya fijó.",
    ),
    body: [plate(), cable(), checker(), tally(), stopwatch(), desk(), rail()],
  });
}

export const GEOMETRY = { WHEEL_CX, BAR, BAR_X, CARD_X, CARD, WATCH, TB_H };

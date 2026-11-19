// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// One neuron as a weighing station and the board it decides on. On the left, the station: a beam running front to back
// on a wedge, with a scale beside it, one tick per unit of weight; three riders sit side by side on it, X1 and X2
// (each showing the input it carries now, on its top) and the bias rider (it always carries 1), each at the distance
// its weight sets, in front of the wedge for a positive weight and behind it for a negative one. The beam tilts by the
// sum, front end down for a positive one. In front of it, the output housing: a meter whose needle snaps from NO to
// YES with a step activation and sweeps between them with a sigmoid, over a counter with the output. On the right, the
// decision board: every example a token (a round stud for yes, a flat square tile for no) and the neuron's line laid
// across it as a ruler; the yes side is shaded, a ring marks the example in play, and a token lights when the neuron
// gets it wrong. Counters on the board's front: examples right, epoch, nudges.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, meter, faceText, plaque } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { BEAM, PIVOT, REACH, LANES, BOARD, BOARD_H, FIELD, BX, BY, beamSvg, armY } from "./draw";

export const WIDTH = 700;
export const HEIGHT = 460;

const PLATE = { x: -118, y: -110, w: 220, d: 158, r: 8 };
const PLATE_H = 12, FOOT_H = 5;
const PED = { x: -110, y: -104, w: 72, d: 120, r: 2 };
const PED_H = 10;
const PED_RIGHT = PED.x + PED.w;
const OUTBOX = { x: -106, y: 19, w: 50, d: 22, r: 1.6 };
const OUT_H = 20;
const OUT_FRONT = OUTBOX.y + OUTBOX.d;
export const RIDER = { w: 10.2, d: 8.4, h: 4.6 };
export const CAP = 2.7;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(BOARD, 0, BOARD_H + 4), [BEAM.x0, BEAM.y0, PIVOT.z + 14], [BEAM.x1, BEAM.y0, PIVOT.z + 14], [OUTBOX.x, OUTBOX.y, OUT_H + 2]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

const { S, L, D, at } = shorthand(P);
const cap = (x, y, z, words, opts = {}) => faceText(P, [x, y, z], words, { size: CAP, tone: "mid", ...opts });
const WH = { w: 4, h: 5.4, gap: 0.6 };
const span = (n) => n * WH.w + (n - 1) * WH.gap;
function housing(x0, x1, y, z0, z1) {
  return S(k.slabOf({ x: x0, y: y - 1.4, w: x1 - x0, d: 1.4, r: 0.5 }, z0, z1 - z0, P, 2), { tone: "hi", crease: "lo" });
}
const wheels = (x, y, z, count, name) => digitCounter(P, { x, y, z, count, ...WH, housing: false, name });

// ---------- the station ----------
function pedestal() {
  const out = [S(k.slabOf(PED, 0, PED_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(PED, 2.4), PED_H, P), { tone: "faint" }));
  // the sum the beam weighs, along the pedestal's side facing the board
  out.push(faceText(P, [PED_RIGHT, PED.y + PED.d - 6, 3.6], t("TILT = X1·W1 + X2·W2 + BIAS", "INCLINACIÓN = X1·W1 + X2·W2 + SESGO"), { face: "x", size: 3, tone: "mid" }));
  return out.join("");
}
// The fulcrum: a wedge across the beam's width, its edge under the pivot.
function fulcrum() {
  const x0 = BEAM.x0 + 2, x1 = BEAM.x1 - 2, half = 8, z0 = PED_H, z1 = PIVOT.z, y = PIVOT.y;
  const A = (x, yy, z) => at([x, yy, z]);
  const side = k.pathOf([A(x1, y - half, z0), A(x1, y + half, z0), A(x1, y, z1)], true);
  const slope = k.pathOf([A(x0, y, z1), A(x1, y, z1), A(x1, y + half, z0), A(x0, y + half, z0)], true);
  const all = k.pathOf([A(x1, y - half, z0), A(x1, y, z1), A(x0, y, z1), A(x0, y + half, z0), A(x1, y + half, z0)], true);
  return `<g class="iso-solid"><path class="iso-fill" d="${all}"/><path class="iso-shade" data-shade="2" d="${side}"/><path class="iso-shade" data-shade="0" d="${slope}"/>`
    + `<path class="iso-line iso-edge" data-tone="hi" d="${all}"/><path class="iso-line" data-tone="lo" d="${k.pathOf([A(x1, y, z1), A(x1, y + half, z0)])}"/></g>`;
}
// A scale on the pedestal's top beside the beam: one tick per unit of weight, numbered, 0 at the pivot.
function scale() {
  const x = BEAM.x1 + 3, z = PED_H, out = [];
  const ticks = [];
  for (let w = -REACH; w <= REACH; w++) ticks.push(k.lineOnTop([x, armY(w)], [x + (w % 5 === 0 ? 3 : 1.8), armY(w)], z, P));
  out.push(L(k.lineOnTop([x, armY(-REACH)], [x, armY(REACH)], z, P) + ticks.join(""), { tone: "mid" }));
  for (let w = -REACH; w <= REACH; w++) out.push(faceText(P, [x + 7.4, armY(w), z], (w > 0 ? "+" : w < 0 ? "−" : "") + Math.abs(w), { face: "top", size: 2.6, tone: "mid", anchor: "middle", along: "y" }));
  out.push(faceText(P, [x + 7.4, armY(-REACH) - 5, z], t("WEIGHT", "PESO"), { face: "top", size: 2.6, tone: "mid", anchor: "start", along: "y" }));
  return out.join("");
}
// A rider: a block on its lane; on its top, the input's name and the input it carries now (on the top, so a rider
// beside it never hides them).
function rider(name, words) {
  const x = LANES[name], y = PIVOT.y, z = PIVOT.z + BEAM.h;
  const plan = { x: x - RIDER.w / 2, y: y - RIDER.d / 2, w: RIDER.w, d: RIDER.d, r: 0.6 };
  const top = z + RIDER.h;
  return `<g data-rider="${name}">`
    + S(k.slabOf(plan, z, RIDER.h, P, 2, 0.3), { tone: "hi", crease: "lo" })
    + faceText(P, [x, y - 0.6, top], words, { face: "top", size: 2.2, tone: "mid", anchor: "middle" })
    + faceText(P, [x, y + 3.2, top], name === "b" ? "1" : "0", { face: "top", size: 2.6, tone: "hi", anchor: "middle", attr: "data-rider-value" })
    + `</g>`;
}
// The output housing in front of the beam: a meter from NO to YES on its front, the output on counters beside it, and
// the activation's name on its top.
function outbox() {
  const out = [S(k.slabOf(OUTBOX, 0, OUT_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(OUTBOX, 1.8), OUT_H, P), { tone: "faint" }));
  const y = OUT_FRONT, mx = OUTBOX.x + 13;
  out.push(meter(P, { x: mx, y, z: 8.6, r: 8.6, ticks: 10, name: "out", value: 0 }));
  out.push(cap(mx - 9, y, 4.4, t("NO", "NO")), cap(mx + 9, y, 4.4, t("YES", "SÍ"), { anchor: "end" }));
  // OUT d.dd: one wheel, a point, two wheels, in one housing
  const x0 = OUTBOX.x + 28.6, z = 4.6;
  out.push(housing(x0 - 1.2, x0 + 3 * WH.w + 2 * WH.gap + 1.6 + 1.2, y, z - 1.2, z + WH.h + 1.2));
  out.push(wheels(x0, y, z, 1, "outI"), D([at([x0 + WH.w + 0.8, y + 0.1, z + 0.6])], { size: 1.1, tone: "hi" }), wheels(x0 + WH.w + 1.6, y, z, 2, "outF"));
  out.push(cap(x0 - 1.2, y, z + WH.h + 2.6, t("OUTPUT", "SALIDA")));
  out.push(plaque(P, { x: OUTBOX.x + 4, y: OUTBOX.y + 4, z: OUT_H, w: OUTBOX.w - 8, d: OUTBOX.d - 8 }));
  out.push(faceText(P, [OUTBOX.x + OUTBOX.w / 2, OUTBOX.y + OUTBOX.d / 2 + 1.3, OUT_H + 0.8], "", { face: "top", size: 3.8, tone: "hi", anchor: "middle", attr: "data-act-word" }));
  return out.join("");
}

// ---------- the board ----------
function board() {
  const out = [S(k.slabOf(BOARD, 0, BOARD_H, P, 4, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline({ ...FIELD, r: 0.5 }, BOARD_H, P), { tone: "mid" }));
  const grid = [];
  for (let i = 1; i < 8; i++) {
    grid.push(k.lineOnTop([BX(i / 8), BY(0)], [BX(i / 8), BY(1)], BOARD_H, P));
    grid.push(k.lineOnTop([BX(0), BY(i / 8)], [BX(1), BY(i / 8)], BOARD_H, P));
  }
  out.push(L(grid.join(""), { tone: "faint", dotted: true }));
  // counters on the front: examples right (of all), epoch, nudges
  const y = BOARD.y + BOARD.d, z = 1.6;
  const c1 = BOARD.x + 8, c2 = c1 + 40, c3 = c2 + 30;
  out.push(housing(c1 - 1.2, c1 + span(2) + 1.2, y, z - 1.2, z + WH.h + 1.2), wheels(c1, y, z, 2, "right"), cap(c1 - 1.2, y, z + WH.h + 2.6, t("RIGHT", "ACIERTOS")));
  out.push(faceText(P, [c1 + span(2) + 2.6, y, z + 1.4], "OF 4", { size: CAP, tone: "mid", attr: "data-of" }));
  out.push(housing(c2 - 1.2, c2 + span(3) + 1.2, y, z - 1.2, z + WH.h + 1.2), wheels(c2, y, z, 3, "epoch"), cap(c2 - 1.2, y, z + WH.h + 2.6, t("EPOCH", "ÉPOCA")));
  out.push(housing(c3 - 1.2, c3 + span(4) + 1.2, y, z - 1.2, z + WH.h + 1.2), wheels(c3, y, z, 4, "nudges"), cap(c3 - 1.2, y, z + WH.h + 2.6, t("NUDGES", "AJUSTES")));
  return out.join("");
}
// The board's axes, one set per kind of task: the inputs' names along the front and left margins, and their values.
function axes() {
  const z = BOARD_H, out = [];
  const front = (u, words, size = 3.2) => faceText(P, [BX(u), FIELD.y + FIELD.d + 3.6, z], words, { face: "top", size, tone: "mid", anchor: "middle" });
  const left = (v, words, size = 3.2) => faceText(P, [FIELD.x - 3.2, BY(v), z], words, { face: "top", size, tone: "mid", anchor: "middle", along: "y" });
  // logic: 0 and 1 on each axis, and dashed lines where each input is 0 (they cross at the origin)
  const lg = [front(0.25, "0"), front(0.75, "1"), front(0.5, "X1 →", 3), left(0.25, "0"), left(0.75, "1"), left(0.5, "X2 →", 3)];
  lg.push(L(k.lineOnTop([BX(0.25), BY(0)], [BX(0.25), BY(1)], z, P) + k.lineOnTop([BX(0), BY(0.25)], [BX(1), BY(0.25)], z, P), { tone: "lo", dashed: true }));
  out.push(`<g data-axes="logic">${lg.join("")}</g>`);
  // loans: income across (1,000 to 10,000 a month), debt ratio up (0 to 0.8)
  const ln = [];
  for (const [inc, s] of [[2000, "$2K"], [4000, "$4K"], [6000, "$6K"], [8000, "$8K"]]) ln.push(front((inc - 1000) / 9000, s));
  ln.push(faceText(P, [BX(1), FIELD.y + FIELD.d + 3.6, z], t("INCOME →", "INGRESO →"), { face: "top", size: 2.8, tone: "mid", anchor: "end" }));
  for (const d of [0.2, 0.4, 0.6]) ln.push(left(d / 0.8, String(d)));
  ln.push(faceText(P, [FIELD.x - 3.2, BY(0.03), z], t("DEBT →", "DEUDA →"), { face: "top", size: 2.8, tone: "mid", along: "y" }));
  out.push(`<g data-axes="loans" style="display:none">${ln.join("")}</g>`);
  return out.join("");
}

// ---------- tokens, drawn at the origin and moved with translateAlong ----------
export const TOKEN = { logic: { r: 4.6, h: 4.2, tile: 8.4 }, loans: { r: 2.3, h: 3, tile: 4.2 } };
/** A yes token: a round stud. A no token: a flat square tile. One solid each, so it can light (a mistake). */
export function tokenSvg(kind, size) {
  const s = TOKEN[size];
  const body = kind === "yes"
    ? S(k.cylinder(0, 0, s.r, BOARD_H, s.h, P, 22, 0.3), { tone: "hi", crease: "lo" })
    : S(k.slabOf({ x: -s.tile / 2, y: -s.tile / 2, w: s.tile, d: s.tile, r: 0.4 }, BOARD_H, 1.1, P, 2, 0.2), { tone: "hi", crease: "lo" });
  return `<g class="wb-lit-group" data-token>${body}</g>`;
}
/** The ring that marks the example in play. */
export function ringSvg(size) {
  const s = TOKEN[size];
  return L(k.ring(0, 0, s.r + (size === "logic" ? 3.4 : 2.2), BOARD_H + 0.1, P, 36), { tone: "hi" });
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "One artificial neuron as a weighing station beside the board it decides on, on one base plate. On the left, the station: a beam running front to back rests on a wedge, with a scale beside it numbered from minus 5 at the back to plus 5 at the front, one tick per unit of weight. Three riders sit side by side on the beam, X1, X2 and the bias rider, each with its name and the input it carries now on its top; the bias rider always carries 1. Each sits at the distance its weight sets, in front of the wedge when the weight is positive and behind it when negative. The beam tilts by the sum, its front end down when the sum is positive. In front of the beam stands the output housing: a meter whose needle points from NO to YES, snapping to an end with a step activation and sweeping between with a sigmoid, counters showing the output, and a plaque on top naming the activation. On the right, the decision board: a square marked with each input's values along its front and left edges, each example a token on it, a round stud for yes and a flat square tile for no. The neuron's line lies across the board as a ruler, the side it says yes to is shaded, a ring marks the example being weighed, and a token lights when the neuron gets it wrong. Counters on the board's front show how many examples it gets right, the epoch, and how many nudges training has made.",
      "Una neurona artificial como una estación de pesaje junto al tablero sobre el que decide, en una placa base. A la izquierda, la estación: una viga que va de adelante hacia atrás, apoyada en una cuña, con una escala al lado numerada de menos 5 atrás a más 5 adelante, una marca por unidad de peso. Tres pesas corredizas van lado a lado sobre la viga, X1, X2 y la del sesgo, cada una con su nombre y la entrada que lleva ahora en la parte de arriba; la del sesgo siempre lleva 1. Cada una está a la distancia que fija su peso, delante de la cuña si el peso es positivo y detrás si es negativo. La viga se inclina según la suma, con su extremo delantero hacia abajo cuando la suma es positiva. Delante de la viga está la caja de salida: un medidor cuya aguja va de NO a SÍ, saltando a un extremo con una activación escalón y moviéndose entre ambos con una sigmoide, contadores con la salida, y una placa arriba con el nombre de la activación. A la derecha, el tablero de decisión: un cuadrado con los valores de cada entrada en sus bordes delantero e izquierdo, cada ejemplo una ficha sobre él, un perno redondo para sí y una baldosa cuadrada plana para no. La línea de la neurona cruza el tablero como un listón, el lado al que dice sí está sombreado, un anillo marca el ejemplo que se pesa, y una ficha se enciende cuando la neurona se equivoca con ella. Los contadores del frente del tablero muestran cuántos ejemplos acierta, la época y cuántos ajustes hizo el entrenamiento.",
    ),
    body: [
      basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H }),
      board(),
      axes(),
      `<g data-layer="yes"></g>`,
      `<g data-layer="band"></g>`,
      `<g data-layer="tokens"></g>`,
      `<g data-layer="ruler"></g>`,
      `<g data-layer="front"></g>`,
      `<g data-layer="ring"></g>`,
      pedestal(),
      scale(),
      fulcrum(),
      beamSvg(P, 0),
      `<g data-layer="riders">${rider("x1", "X1")}${rider("x2", "X2")}${rider("b", t("BIAS", "SESGO"))}</g>`,
      outbox(),
    ],
  });
}


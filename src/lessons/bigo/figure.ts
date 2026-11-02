// @ts-nocheck: figure code ported as-is; drawing shorthands come from src/lib/draw.
// A five-lane race track for growth rates. Every lane runs a real algorithm on the same n items; all carriages
// move at the same pace (one step per tick of the clock) along a log-scale track, so a lane's finish post sits at
// the number of steps its algorithm needed. Posts that move twice as far when n doubles grow twice as fast.
//   Lanes, back to front: O(1) read an item, O(log n) binary search, O(n) scan, O(n log n) merge sort,
//   O(n²) compare every pair. The ruler along the front marks powers of ten.
//   Back: a console showing n and the cost of one step, and a clock dial that sweeps the decades.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../../workbench/kit.mjs";
import { basePlate, faceText, sign, pennant, dial } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { compact } from "./sim";

export const WIDTH = 700;
export const HEIGHT = 370;

const PLATE = { x: -142, y: -72, w: 274, d: 126, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// Track: log10(steps) from 0 to DECADES maps onto TRACK.x0..x1 (carriage centres).
export const DECADES = 9;
export const TRACK = { x0: -94, x1: 118 };
export const xOf = (steps) => TRACK.x0 + (Math.log10(Math.max(1, steps)) / DECADES) * (TRACK.x1 - TRACK.x0);
const RAIL = { x: -101, w: 226 };
export const LANE_Y = [-42, -26, -10, 6, 22];             // O(1) at the back, O(n²) at the front
export const LANE_LABEL = ["O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n²)"];
const RAIL_H = 1.4;
export const CAR = { w: 15, d: 8, h: 6 };
const RULER = { x: RAIL.x, y: 33, w: RAIL.w, d: 7, r: 1 };
const RULER_H = 5;
const CONSOLE = { x: -36, y: -69, w: 110, d: 13, r: 1.4 };
const CONSOLE_H = 13;
export const CLOCK = { x: 104, y: -60, r: 8.5, h: 5, from: -Math.PI * 0.75, span: Math.PI * 1.5 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [CONSOLE.x, CONSOLE.y, CONSOLE_H + 4], [PLATE.x + PLATE.w, PLATE.y, 18]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 64 },
);

const { S, L } = shorthand(P);
const text = (x, y, z, value, opts) => faceText(P, [x, y, z], value, opts);
const sup = ["", "", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

// A carriage: a block riding the rail with its step count printed on the front.
export function carriage(lane, lit, label, attr = "") {
  const c = LANE_Y[lane];
  return S(k.slabOf({ x: -CAR.w / 2, y: c - CAR.d / 2, w: CAR.w, d: CAR.d, r: 1 }, RAIL_H, CAR.h, P, 4, 0.4), { tone: "hi", crease: "lo", lit })
    + text(0, c + CAR.d / 2, RAIL_H + 1.7, label, { size: 3, tone: "hi", anchor: "middle", attr });
}

function track(first) {
  const out = [];
  // Ruler: a raised strip along the front, a major tick and label at each power of ten, minor ticks between.
  out.push(S(k.slabOf(RULER, 0, RULER_H, P, 3, 0.4), { tone: "mid" }));
  const major = [], minor = [];
  for (let d = 0; d <= DECADES; d++) {
    const x = xOf(10 ** d);
    major.push(k.segment([x, RULER.y + 0.8, RULER_H], [x, RULER.y + 4, RULER_H], P));
    if (d < DECADES) for (let m = 2; m <= 9; m++) { const xm = xOf(m * 10 ** d); minor.push(k.segment([xm, RULER.y + 0.8, RULER_H], [xm, RULER.y + 2.2, RULER_H], P)); }
  }
  out.push(L(minor.join(""), { tone: "faint" }), L(major.join(""), { tone: "mid" }));
  for (let d = 0; d <= DECADES; d++) out.push(text(xOf(10 ** d), RULER.y + RULER.d, 1.2, d === 0 ? "1" : "10" + sup[d], { size: 3.2, tone: "hi", anchor: "middle" }));
  out.push(text(RULER.x + RULER.w, PLATE.y + PLATE.d, -8, t("STEPS, LOG SCALE · EACH MARK ×10", "PASOS, ESCALA LOG. · CADA MARCA ×10"), { size: 2.6, tone: "mid", anchor: "end" }));

  // Lanes, back to front: sign, rail, finish post with pennant, carriage.
  LANE_Y.forEach((c, i) => {
    const label = i === 3 && first.constant !== 1 ? LANE_LABEL[i] + " ×" + first.constant : LANE_LABEL[i];
    out.push(sign(P, { x: -139, y: c + 4.6, z: 1.2, w: 34, h: 7.4, text: label, size: 3.2, attr: i === 3 ? "data-nlog-sign" : "" }));
    out.push(S(k.slabOf({ x: RAIL.x, y: c - 1.4, w: RAIL.w, d: 2.8, r: 0.6 }, 0, RAIL_H, P, 3, 0.2), { tone: "mid", crease: "none" }));
    out.push(L(k.segment([RAIL.x + 1, c, RAIL_H], [RAIL.x + RAIL.w - 1, c, RAIL_H], P), { tone: "faint" }));
    // Finish post behind the rail; the live script slides it to xOf(steps).
    out.push(`<g data-post="${i}" transform="${k.translateAlong(P, [xOf(first.steps[i]), 0, 0])}">`
      + S(k.cylinder(0, c - 4.6, 1.3, 0, 0.8, P, 14), { tone: "mid", crease: "none" })
      + pennant(P, { x: 0, y: c - 4.6, z: 0.8, height: 11, length: 6, drop: 4 })
      + `</g>`);
  });
  // Carriages last, so they pass in front of the posts.
  LANE_Y.forEach((c, i) => {
    const done = Math.min(first.clock, first.steps[i]);
    const running = first.clock < first.steps[i];
    out.push(`<g class="wb-lit-group" data-car="${i}" transform="${k.translateAlong(P, [xOf(done), 0, 0])}">${carriage(i, running, compact(Math.round(done)), `data-car-text="${i}"`)}</g>`);
  });
  return out.join("");
}

function consoleBlock(first) {
  const out = [];
  out.push(S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 4, 0.6), { tone: "mid" }));
  const fy = CONSOLE.y + CONSOLE.d;
  out.push(L(k.faceRectY(P, CONSOLE.x + 3, CONSOLE.x + 50, fy, 2, CONSOLE_H - 2), { tone: "lo" }));
  out.push(L(k.faceRectY(P, CONSOLE.x + 54, CONSOLE.x + CONSOLE.w - 3, fy, 2, CONSOLE_H - 2), { tone: "lo" }));
  out.push(text(CONSOLE.x + 5, fy, CONSOLE_H - 5, t("INPUT SIZE", "TAMAÑO"), { size: 2.3, tone: "lo" }));
  out.push(text(CONSOLE.x + 5, fy, 3.6, "n = " + first.n.toLocaleString("en"), { size: 4.6, tone: "hi", attr: "data-n-text" }));
  out.push(text(CONSOLE.x + 56, fy, CONSOLE_H - 5, t("ONE STEP", "UN PASO"), { size: 2.3, tone: "lo" }));
  out.push(text(CONSOLE.x + 56, fy, 3.6, first.cost, { size: 4.6, tone: "hi", attr: "data-cost-text" }));
  // The clock: a dial whose needle sweeps the nine decades of the track as the race runs.
  out.push(S(k.slabOf({ x: CLOCK.x - 12, y: CLOCK.y - 11, w: 24, d: 22, r: 2 }, 0, 4, P, 3, 0.4), { tone: "mid" }));
  out.push(dial(P, { x: CLOCK.x, y: CLOCK.y, z: 4, r: CLOCK.r, h: CLOCK.h, ticks: 36, every: 4, from: CLOCK.from, span: CLOCK.span, name: "clock", value: Math.log10(Math.max(1, first.clock)) / DECADES, knurl: false }));
  out.push(text(CLOCK.x, CLOCK.y + 11, 1, t("CLOCK", "RELOJ"), { size: 2.4, tone: "mid", anchor: "middle" }));
  return out.join("");
}

// The first frame: n = 1,000, about 2,000 steps into the race. The three fast lanes have finished; merge sort and
// the pair check are still running.
export function buildFigure(first) {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A race track with five lanes on a base plate, one per growth rate: O(1), O(log n), O(n), O(n log n) and O(n squared). Each lane has a sign, a rail, a carriage that shows its step count, and a finish post with a pennant placed at the number of steps its algorithm needs. A ruler along the front marks powers of ten. At the back, a console shows the input size n and the cost of one step, and a clock dial sweeps the decades as the race runs.",
      "Una pista de carreras con cinco carriles sobre una placa base, uno por cada ritmo de crecimiento: O(1), O(log n), O(n), O(n log n) y O(n al cuadrado). Cada carril tiene un letrero, un riel, un carro que muestra su cuenta de pasos y un poste de llegada con banderín ubicado en la cantidad de pasos que necesita su algoritmo. Una regla al frente marca potencias de diez. Atrás, una consola muestra el tamaño de entrada n y el costo de un paso, y un reloj de aguja recorre las décadas mientras corre la carrera.",
    ),
    body: [basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H }), consoleBlock(first), track(first)],
  });
}

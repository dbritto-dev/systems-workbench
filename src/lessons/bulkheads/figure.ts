// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A ship's hold split by bulkheads: one service's 15 workers in three compartments, one per dependency.
//   the quay along the front: requests (tags lettered by endpoint) arrive at the left, wait at the door when every
//   worker is busy, and roll along to their compartment; a counter under each compartment shows the share of its
//   endpoint's requests answered in time;
//   the hold: five berths per compartment, a worker at each; a tag on a worker's console is a call in flight, a tag in
//   a worker's hands is a request queued for a place in its compartment; the bulkheads between compartments stand
//   full height (5 per dependency), half height (caps of 8) or lie flat (one shared pool);
//   behind each compartment its dependency, with the calls in flight against its compartment's cap;
//   at the back left, the crew board: how many of the 15 workers are busy.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, rulerStrip, digitCounter, person, dial, card, faceText, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { AREA, WORKERS, DOOR } from "./sim";

export const WIDTH = 700;
export const HEIGHT = 450;

const PLATE = { x: -136, y: -124, w: 272, d: 122, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The hull: walls around a floor, three compartments along x.
const HULL = { x: -86, y: -90, w: 214, d: 48, r: 5 };
export const WALL_H = 15;
const WALL_T = 2.4;
const IN = { x0: HULL.x + WALL_T, x1: HULL.x + HULL.w - WALL_T, y0: HULL.y + WALL_T, y1: HULL.y + HULL.d - WALL_T };
const BH_T = 2;                                                   // bulkhead thickness
const COMP_W = (IN.x1 - IN.x0 - 2 * BH_T) / 3;
export const COMP_X = [0, 1, 2].map((i) => IN.x0 + i * (COMP_W + BH_T));   // left edge of each compartment
export const CX = COMP_X.map((x) => x + COMP_W / 2);
const BH_X = [COMP_X[0] + COMP_W, COMP_X[1] + COMP_W];            // left edge of each bulkhead
const FLOOR_Z = 1.2;

// Berths: a worker at the back, a console in front; the berth index is the model's worker index.
export const BERTH_X = Array.from({ length: WORKERS }, (_, w) => COMP_X[Math.floor(w / AREA)] + 7.6 + 13.1 * (w % AREA));
export const WORKER_Y = -77;
const CONSOLE = { y: -67, d: 7, w: 9.4, h: 7 };
export const CONSOLE_SPOT = (w) => [BERTH_X[w], CONSOLE.y + CONSOLE.d / 2, FLOOR_Z + CONSOLE.h];
export const HAND_SPOT = (w) => [BERTH_X[w] + 1.2, WORKER_Y + 5.2, FLOOR_Z + 8];

// The dependencies, one behind each compartment.
const DEP = { y: -120, d: 22, h: 34, w: 60 };
const DEP_FRONT = DEP.y + DEP.d;

// The crew board at the back left.
const BOARD = { x: -132, y: -120, w: 40, d: 78, r: 2 };
const BOARD_H = 28;

// The quay along the front: a lane on top for the tags, counters on its front face.
const QUAY = { x: -132, y: -36, w: 260, d: 22, r: 2 };
export const QUAY_H = 10;
export const LANE_Y = QUAY.y + 7.4;
export const TROUGH_Y = QUAY.y + 16.6;
const FRONT = QUAY.y + QUAY.d;
export const DOOR_X = Array.from({ length: DOOR }, (_, j) => -96 - 6.6 * j);   // place 0 at the hull end
export const ENTRY_X = -128;                                       // where a new tag appears (it fades in)
export const TAG = { w: 6, h: 7 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [PLATE.x, PLATE.y, DEP.h + 4], [PLATE.x + PLATE.w, PLATE.y, DEP.h + 4]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

const { S, L, D, at, seg } = shorthand(P);
export const CAP = 3.4;   // caption size: no word on the machine is smaller
const text = (x, y, z, words, size = CAP, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });

const NAMES = [t("SEARCH", "BÚSQUEDA"), t("CHECKOUT", "COMPRA"), t("PROFILE", "PERFIL")];
const DEP_NAMES = [t("SEARCH ENGINE", "BUSCADOR"), t("PAYMENTS", "PAGOS"), t("PROFILES", "PERFILES")];

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -40, y: FRONT + 2.6, w: 96, d: 5, r: 1 });
}

// ---------- the dependencies ----------
function dependency(i) {
  const x0 = CX[i] - DEP.w / 2 + 5;                              // nudged right, clear of the crew board
  const plan = { x: x0, y: DEP.y, w: DEP.w, d: DEP.d, r: 1.6 };
  const out = [S(k.slabOf(plan, 0, DEP.h, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(plan, 6, P, 3), { tone: "faint" }) })];
  out.push(S(k.slabOf(k.insetPlan(plan, -1.2), DEP.h, 2, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(plan, 2.6), DEP.h + 2, P), { tone: "faint" }));
  out.push(text(x0 + 4, DEP_FRONT, 27.6, DEP_NAMES[i], 4));
  // calls in flight, with the compartment's cap beside it; the housing lights while the compartment is full
  out.push(`<g data-full="${i}">${digitCounter(P, { x: x0 + 5.2, y: DEP_FRONT, z: 19, count: 2, w: 4.2, h: 5.6, gap: 0.6, pad: 1.1, name: "flight" + i })}</g>`);
  out.push(text(x0 + 17.6, DEP_FRONT, 21.6, t("IN FLIGHT", "EN CURSO")));
  out.push(faceText(P, [x0 + 17.6, DEP_FRONT, 17.8], "", { size: CAP, tone: "mid", attr: `data-cap="${i}"` }));
  // replicas on the roof: two for search (the bad one lights when it hangs), one each for the others
  const reps = i === 0 ? [x0 + 14, x0 + 34] : [x0 + 24];
  reps.forEach((rx, n) => {
    const r = { x: rx, y: DEP.y + 4, w: 14, d: 12, r: 1 };
    const body = (lit) => S(k.slabOf(r, DEP.h + 2, 6, P, 3, 0.4), { tone: "hi", crease: "lo", lit });
    out.push(`<g data-rep="${i}-${n}"><g data-v="ok">${body(false)}</g><g data-v="sick" style="display:none">${litFill(body(true))}</g></g>`);
    out.push(L(k.planOutline(k.insetPlan(r, 2), DEP.h + 8, P), { tone: "faint" }));
  });
  if (i === 0) out.push(faceText(P, [x0 + 4, DEP_FRONT, 12.6], "", { size: CAP, tone: "mid", attr: "data-timeout" }));
  return out.join("");
}

// ---------- the crew board ----------
function board() {
  const out = [S(k.slabOf(BOARD, 0, BOARD_H, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(BOARD, 6, P, 3), { tone: "faint" }) })];
  out.push(S(k.slabOf(k.insetPlan(BOARD, -1.2), BOARD_H, 2, P, 3, 0.5), { tone: "mid" }));
  const front = BOARD.y + BOARD.d;
  out.push(text(BOARD.x + 4, front, 21.8, t("WORKERS", "WORKERS"), 4));
  out.push(digitCounter(P, { x: BOARD.x + 4.6, y: front, z: 13, count: 2, w: 4.2, h: 5.6, gap: 0.6, pad: 1.1, name: "busy" }));
  out.push(text(BOARD.x + 17, front, 16, t("BUSY", "OCUPADOS")));
  out.push(text(BOARD.x + 17, front, 12.2, t("OF " + WORKERS, "DE " + WORKERS)));
  // the dial on top: one tick per worker, the needle at how many are busy
  out.push(dial(P, { x: BOARD.x + BOARD.w / 2, y: BOARD.y + 36, z: BOARD_H + 2, r: 14, h: 3, ticks: WORKERS, every: 5, from: -0.75 * Math.PI, span: 1.5 * Math.PI, name: "busy", value: 0 }));
  return out.join("");
}

// ---------- the hull ----------
const wall = (plan, h = WALL_H, tone = "mid") => S(k.slabOf(plan, 0, h, P, 2, 0.3), { tone, crease: "lo" });
function hullBack() {
  const out = [S(k.slabOf(HULL, 0, FLOOR_Z, P, 3, 0.4), { tone: "lo", crease: "none" })];
  // floor planks
  const planks = [];
  for (let y = IN.y0 + 5; y < IN.y1; y += 5) planks.push(k.lineOnTop([IN.x0 + 1, y], [IN.x1 - 1, y], FLOOR_Z, P));
  out.push(L(planks.join(""), { tone: "faint" }));
  out.push(wall({ x: HULL.x, y: HULL.y, w: HULL.w, d: WALL_T, r: 0.4 }));
  out.push(wall({ x: HULL.x, y: HULL.y, w: WALL_T, d: HULL.d, r: 0.4 }));
  return out.join("");
}
function hullFront() {
  return wall({ x: HULL.x + HULL.w - WALL_T, y: HULL.y, w: WALL_T, d: HULL.d, r: 0.4 })
    + wall({ x: HULL.x, y: HULL.y + HULL.d - WALL_T, w: HULL.w, d: WALL_T, r: 0.4 })
    + L(k.lineOnTop([HULL.x + 2, HULL.y + HULL.d - WALL_T / 2], [HULL.x + HULL.w - 2, HULL.y + HULL.d - WALL_T / 2], WALL_H, P), { tone: "faint" });
}
// A bulkhead in three heights: full (5 per dependency), half (caps of 8), flat (one shared pool: only its footing).
function bulkhead(n) {
  const plan = { x: BH_X[n], y: IN.y0, w: BH_T, d: IN.y1 - IN.y0, r: 0.3 };
  return `<g data-bulkhead="${n}">`
    + `<g data-h="full">${wall(plan)}</g>`
    + `<g data-h="half" style="display:none">${wall(plan, WALL_H / 2)}</g>`
    + `<g data-h="flat" style="display:none">${S(k.slabOf(plan, FLOOR_Z, 0.6, P, 2), { tone: "lo", crease: "none" })}</g>`
    + `</g>`;
}
function berth(w) {
  const x = BERTH_X[w];
  const out = [`<g class="wb-lit-group" data-worker="${w}">${litFill(person(P, [x, WORKER_Y, FLOOR_Z], { scale: 0.56, lit: true })).replace(/data-lit="" data-lit-fill=""/g, 'data-litable=""')}</g>`];
  const plan = { x: x - CONSOLE.w / 2, y: CONSOLE.y, w: CONSOLE.w, d: CONSOLE.d, r: 0.8 };
  out.push(S(k.slabOf(plan, FLOOR_Z, CONSOLE.h, P, 2, 0.3), { tone: "mid", crease: "lo", inner: L(k.planOutline(k.insetPlan(plan, 1), FLOOR_Z + CONSOLE.h, P), { tone: "faint" }) }));
  return out.join("");
}
function compartment(i) {
  const out = [];
  for (let j = 0; j < AREA; j++) out.push(berth(i * AREA + j));
  out.push(`<g data-layer="in${i}"></g>`);
  return out.join("");
}

// ---------- the quay ----------
function quay() {
  const out = [S(k.slabOf(QUAY, 0, QUAY_H, P, 3, 0.5), { tone: "mid" })];
  const rollers = [];
  for (let x = QUAY.x + 3; x < QUAY.x + QUAY.w - 2; x += 3) rollers.push(k.lineOnTop([x, LANE_Y - 4], [x, LANE_Y + 4], QUAY_H, P));
  out.push(L(rollers.join(""), { tone: "lo" }));
  // the trough in front of the lane, where turned-away tags drop
  out.push(L(k.planOutline({ x: QUAY.x + 2, y: TROUGH_Y - 3, w: QUAY.w - 4, d: 6, r: 0.6 }, QUAY_H, P), { tone: "lo" }));
  // the door: places to wait for a worker, at the left end
  out.push(L(DOOR_X.map((x) => k.planOutline({ x: x - 3.2, y: LANE_Y - 3.6, w: 6.4, d: 7.2, r: 0.4 }, QUAY_H, P)).join(""), { tone: "faint" }));
  out.push(digitCounter(P, { x: QUAY.x + 4.2, y: FRONT, z: 2.2, count: 1, w: 4.2, h: 5.6, gap: 0.6, pad: 1.1, name: "door" }));
  out.push(text(QUAY.x + 11.6, FRONT, 5.2, t("AT THE", "EN LA")));
  out.push(text(QUAY.x + 11.6, FRONT, 1.4, t("DOOR", "PUERTA")));
  // under each compartment: its endpoint's name and the share of its requests answered in time (last 30 s)
  CX.forEach((cx, i) => {
    const x0 = COMP_X[i] + 2;
    out.push(text(x0, FRONT, 3, NAMES[i], 4.2, { tone: "hi" }));
    out.push(digitCounter(P, { x: x0 + 31, y: FRONT, z: 2.2, count: 3, w: 4.2, h: 5.6, gap: 0.6, pad: 1.1, name: "ok" + i }));
    out.push(text(x0 + 48.6, FRONT, 5.2, t("IN TIME", "A TIEMPO")));
    out.push(text(x0 + 48.6, FRONT, 1.4, "%"));
  });
  return out.join("");
}

// A request's tag, drawn at the origin and moved with translateAlong: the endpoint's letter on its face.
export function tagSvg() {
  return `<g class="wb-lit-group">${litFill(card(P, { x: -TAG.w / 2, y: 0.3, z: 0, w: TAG.w, h: TAG.h, text: "S", size: 4.2, attr: "data-letter", lit: true })).replace(/data-lit="" data-lit-fill=""/, "data-body")}</g>`;
}

export function buildFigure() {
  const deps = [0, 1, 2].map(dependency).join("");
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A ship's hold on a base plate, standing for one service with 15 workers. The hold is split by two bulkheads into three compartments, search, checkout and profile, with five berths each; a worker stands at every berth behind a console. Behind each compartment stands the dependency its calls go to, the search engine, payments and the profile store, with a counter of calls in flight and the compartment's cap; the search engine has two replicas on its roof. Along the front, a quay carries lettered request tags from the door at the left to their compartment; a tag on a console is a call in flight, a tag in a worker's hands is a request queued for a place, and turned-away tags drop into a trough. Counters under each compartment show the share of its requests answered in time. At the back left, a crew board shows how many workers are busy.",
      "La bodega de un barco sobre una placa base, que representa un servicio con 15 workers. Dos mamparos dividen la bodega en tres compartimentos, búsqueda, compra y perfil, con cinco puestos cada uno; en cada puesto hay un worker detrás de una consola. Detrás de cada compartimento está la dependencia a la que van sus llamadas, el buscador, los pagos y los perfiles, con un contador de llamadas en curso y el tope del compartimento; el buscador tiene dos réplicas en el techo. Al frente, un muelle lleva las etiquetas de las solicitudes, con la letra de su endpoint, desde la puerta a la izquierda hasta su compartimento; una etiqueta sobre una consola es una llamada en curso, una etiqueta en las manos de un worker es una solicitud haciendo fila por un lugar, y las etiquetas rechazadas caen en una canaleta. Los contadores bajo cada compartimento muestran la parte de sus solicitudes respondidas a tiempo. Atrás a la izquierda, un tablero muestra cuántos workers están ocupados.",
    ),
    body: [
      plate(),
      deps,
      board(),
      hullBack(),
      compartment(0), bulkhead(0), compartment(1), bulkhead(1), compartment(2),
      hullFront(),
      quay(),
      `<g data-layer="quay"></g>`,
    ],
  });
}

export const FIGURE_CSS = ``;

export const GEOMETRY = {
  BERTH_X, CX, COMP_X, CONSOLE: BERTH_X.map((_, w) => CONSOLE_SPOT(w)), HAND: BERTH_X.map((_, w) => HAND_SPOT(w)),
  LANE_Y, TROUGH_Y, QUAY_H, DOOR_X, ENTRY_X, WALL_H, HULL_FRONT: HULL.y + HULL.d, TAG,
};

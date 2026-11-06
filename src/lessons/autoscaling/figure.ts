// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A service floor with an autoscaler. Customers (requests) come in through the gate at the back left and wait in one
// line down the left side; twelve desk plots fill the floor (maxReplicas), and each desk that is open has one worker (a
// pod) who serves one customer at a time, then the customer leaves through the exit stand on the right. A new worker
// stands beside the desk with a clipboard until ready; a sent-home worker walks back to the staff room. Along the front:
// the door counters (waiting, gave up), the autoscaler, the HPA (its reading on a dial against the target, the next
// check, and ready / starting / wanted counters) and the database (queries at once, how much slower each runs).
// The workers are drawn once (page data) and placed at each desk by the live code: twelve copies of each pose would
// double the page.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, person, figurine, dial, meter, faceText, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { MAX_R } from "./sim";

export const WIDTH = 700;
export const HEIGHT = 440;

const PLATE = { x: -122, y: -90, w: 244, d: 134, r: 8 };
const PLATE_H = 12, FOOT_H = 5;
export const CAP = 3.2;                 // captions: at least the size of the counter captions in the other lessons

// ---------- the floor: 4 columns × 3 rows of desk plots ----------
export const COLS = [-62, -24, 14, 52];
export const ROWS = [-58, -33, -8];    // the front edge of each row's desks
const DESK = { w: 24, d: 9, h: 9 };
export const SLOTS = Array.from({ length: MAX_R }, (_, i) => ({ cx: COLS[i % 4], y: ROWS[Math.floor(i / 4)], row: Math.floor(i / 4) }));
export const WORKER_AT = (s) => [s.cx, s.y - DESK.d - 5, 0];          // behind the desk
export const SIDE_AT = (s) => [s.cx + 19, s.y - 3.5, 0];               // beside it, getting ready
export const SEAT_AT = (s) => [s.cx - 3, s.y + 6, 0];                  // the customer, in front of the desk
export const WORKER_SCALE = 0.6;
export const CUST_SCALE = 0.8;

// ---------- the line, the gate, the exit, the staff room ----------
const LANE = { x: -116, y: -85, w: 22, d: 82, r: 1.5 };
const LANE_H = 1.6;
export const LINE_X = -105;
export const LINE_SLOTS = 13;
export const LINE_AT = (i) => [LINE_X, -8 - 6 * i, LANE_H];          // slot 0 is the head, at the front
export const ENTRY_AT = [LINE_X, -82, LANE_H];
const EXIT = { x: 82, y: -42, w: 34, d: 48, r: 2 };
const EXIT_H = 16;
export const EXIT_AT = (y) => [EXIT.x + 1, Math.max(EXIT.y + 4, Math.min(EXIT.y + EXIT.d - 4, y)), 0];
const STAFF = { x: 82, y: -84, w: 34, d: 28, r: 2 };
const STAFF_H = 18;
export const STAFF_AT = [STAFF.x + 6, STAFF.y + STAFF.d + 3, 0];

// ---------- the front row: door counters, the autoscaler, the database ----------
const FRONT_Y = 15, FRONT_D = 20, FRONT_H = 15;
const DOOR = { x: -116, y: FRONT_Y, w: 54, d: FRONT_D, r: 2 };
const CTRL = { x: -56, y: FRONT_Y, w: 90, d: FRONT_D, r: 2 };
const DB = { x: 40, y: FRONT_Y, w: 76, d: FRONT_D, r: 2 };
export const READ_DIAL = { x: CTRL.x + 14, y: CTRL.y + 9.5, r: 8.5, from: -0.75 * Math.PI, span: 1.5 * Math.PI };
export const TARGETS = [0.6, 0.75, 0.9];
// The target: a small hollow wedge just outside the dial's rim, at the target's place on the scale.
function targetMark(frac) {
  const d = READ_DIAL, a = d.from + frac * d.span, w = 0.12;
  const pt = (ang, r) => [d.x + Math.sin(ang) * r, d.y - Math.cos(ang) * r];
  return k.pathOf([pt(a, d.r - 1.4), pt(a - w, d.r + 2.6), pt(a + w, d.r + 2.6)].map(([x, y]) => k.iso([x, y, FRONT_H + 3.3], P)), true);
}
export const CHECK_DIAL = { x: CTRL.x + 80, y: CTRL.y + 10, r: 6 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [STAFF.x, STAFF.y, STAFF_H + 6], [LANE.x, LANE.y, 22], [CTRL.x + 15, CTRL.y, FRONT_H + 6]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 50 },
);

const { S, L, D, at, seg } = shorthand(P);
const caption = (x, y, z, words, opts = {}) => faceText(P, [x, y, z], words, { size: CAP, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H });
}

// The line: a low lane with a rail along its back side and a footprint for each place; the gate at its back end
// where customers come in, its lintel carrying a "+N" for those waiting beyond the drawn places.
function lane() {
  const out = [S(k.slabOf(LANE, 0, LANE_H, P, 3, 0.3), { tone: "lo", crease: "none" })];
  out.push(L(Array.from({ length: LINE_SLOTS }, (_, i) => { const [x, y] = LINE_AT(i); return k.ring(x, y, 2.6, LANE_H, P, 14); }).join(""), { tone: "faint" }));
  out.push(S(k.slabOf({ x: LANE.x + 1, y: LANE.y + 4, w: 2, d: LANE.d - 5, r: 0.5 }, LANE_H, 4.5, P, 2), { tone: "mid", crease: "none" }));
  return out.join("");
}
function gate() {
  // two posts and a lintel across the back of the lane
  const y = LANE.y + 2;
  const out = [];
  for (const x of [LANE.x + 1.5, LANE.x + LANE.w - 1.5]) out.push(S(k.slabOf({ x: x - 1.5, y: y - 1.5, w: 3, d: 3, r: 0.4 }, 0, 17, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: LANE.x, y: y - 2, w: LANE.w, d: 4, r: 0.6 }, 17, 6, P, 2), { tone: "hi", crease: "lo" }));
  out.push(faceText(P, [LANE.x + LANE.w / 2, y + 2, 18.3], "", { size: 3.8, tone: "hi", anchor: "middle", attr: "data-more" }));
  return out.join("");
}

// The staff room at the back right, where new workers come from and sent-home workers go.
function staffRoom() {
  const out = [S(k.slabOf(STAFF, 0, STAFF_H, P, 3, 0.6), { tone: "mid", inner: L(k.faceRectY(P, STAFF.x + 3, STAFF.x + 11, STAFF.y + STAFF.d, 0.6, 13), { tone: "lo" }) })];
  out.push(L(k.planOutline(k.insetPlan(STAFF, 2), STAFF_H, P), { tone: "faint" }));
  out.push(faceText(P, [STAFF.x + STAFF.w / 2, STAFF.y + STAFF.d / 2 + 1.4, STAFF_H], t("STAFF", "PERSONAL"), { face: "top", size: CAP + 0.4, tone: "hi", anchor: "middle" }));
  return out.join("");
}

// The exit stand on the right edge: served customers leave through it; its outer face counts them.
function exitStand() {
  const out = [S(k.slabOf(EXIT, 0, EXIT_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(EXIT, 2), EXIT_H, P), { tone: "faint" }));
  const side = EXIT.x + EXIT.w;
  out.push(digitCounter(P, { x: side, y: EXIT.y + EXIT.d - 8, z: 2.2, count: 4, w: 4.4, h: 5.8, gap: 0.7, pad: 1.2, face: "x", name: "served" }));
  out.push(faceText(P, [side, EXIT.y + EXIT.d - 6.8, 11.4], t("SERVED", "ATENDIDOS"), { face: "x", size: CAP, tone: "mid" }));
  out.push(faceText(P, [EXIT.x + EXIT.w / 2, EXIT.y + 18, EXIT_H], t("EXIT", "SALIDA"), { face: "top", size: CAP + 0.4, tone: "hi", anchor: "middle", along: "y" }));
  return out.join("");
}

// A desk plot: the dashed outline of a desk that isn't open, and the open desk (its own group, shown by the script):
// the desk, its meter (that worker's reading), the worker behind it and, while starting, the worker beside it with a
// clipboard and a progress meter.
function plot(i) {
  const s = SLOTS[i];
  return `<g data-plot="${i}">${L(k.planOutline({ x: s.cx - DESK.w / 2 - 2, y: s.y - DESK.d - 9, w: DESK.w + 4, d: DESK.d + 18, r: 1.5 }, 0, P), { tone: "faint", dashed: true })}</g>`;
}
// A desk's worker and its newcomer: empty groups the live code fills with the drawings below and moves into place.
const worker = (i) => `<g data-worker="${i}" style="display:none"></g>`;
const newcomer = (i) => `<g data-new="${i}" style="display:none"></g>`;
// The worker behind a desk, drawn at the origin, with the slip it holds while its request waits on the database (the
// same slip person() draws for holding: "slip").
export function deskWorkerSvg() {
  const sc = WORKER_SCALE;
  const slip = S(k.slabOf({ x: -4.2 * sc, y: 4.6 * sc, w: 8.4 * sc, d: 0.5 * sc, r: 0.15 * sc }, 7 * sc, 7 * sc, P, 1, 0.2 * sc), { tone: "hi", crease: "lo" });
  return `${person(P, [0, 0, 0], { scale: sc })}<g data-slip style="display:none">${slip}</g>`;
}
// A new worker with a clipboard, drawn at the origin.
export const newcomerSvg = () => person(P, [0, 0, 0], { scale: WORKER_SCALE, holding: "clipboard" });
function desk(i) {
  const s = SLOTS[i];
  const plan = { x: s.cx - DESK.w / 2, y: s.y - DESK.d, w: DESK.w, d: DESK.d, r: 1 };
  const out = [`<g data-desk="${i}" style="display:none">`];
  out.push(S(k.slabOf(plan, 0, DESK.h, P, 3, 0.4), { tone: "mid", inner: L(k.planOutline(k.insetPlan(plan, 1.4), DESK.h, P), { tone: "faint" }) }));
  // a terminal on the desk
  out.push(S(k.slabOf({ x: s.cx - 8, y: s.y - DESK.d + 1.6, w: 7, d: 1.2, r: 0.3 }, DESK.h, 5, P, 2), { tone: "hi", crease: "lo" }));
  out.push(meter(P, { x: s.cx + 6, y: s.y, z: 2, r: 3.6, ticks: 4, zone: 0.9, name: "m" + i }));
  out.push(`</g>`);
  return out.join("");
}

// The door counters: how many wait in the line, and how many gave up (each one is an error).
function door() {
  const out = [S(k.slabOf(DOOR, 0, FRONT_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(DOOR, 2), FRONT_H, P), { tone: "faint" }));
  const f = DOOR.y + DOOR.d;
  out.push(digitCounter(P, { x: DOOR.x + 5, y: f, z: 2.2, count: 2, w: 4.4, h: 5.8, gap: 0.7, pad: 1.2, name: "waiting" }));
  out.push(caption(DOOR.x + 3.8, f, 11.4, t("WAITING", "EN ESPERA")));
  out.push(digitCounter(P, { x: DOOR.x + 28, y: f, z: 2.2, count: 4, w: 4.4, h: 5.8, gap: 0.7, pad: 1.2, name: "gaveup" }));
  out.push(caption(DOOR.x + 26.8, f, 11.4, t("GAVE UP", "ABANDONOS")));
  return out.join("");
}

// The autoscaler, the HPA: the reading on a dial against the target (a hollow wedge), the time to the next check on a
// small dial, and its counters.
function controller() {
  const out = [S(k.slabOf(CTRL, 0, FRONT_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(CTRL, 2), FRONT_H, P), { tone: "faint" }));
  const d = READ_DIAL;
  out.push(dial(P, { x: d.x, y: d.y, z: FRONT_H, r: d.r, h: 3, ticks: 20, every: 5, from: d.from, span: d.span, name: "reading", value: 0.5 }));
  for (const frac of TARGETS) out.push(`<path class="as-target" data-target="${frac}"${frac === 0.6 ? "" : ' style="display:none"'} d="${targetMark(frac)}"/>`);
  // the scale's ends: 0 at the front left, 100% at the front right
  for (const [a, v, anchor] of [[d.from, "0", "end"], [d.from + d.span, "100%", "start"]]) out.push(faceText(P, [d.x + Math.sin(a) * (d.r + 3.2) + (anchor === "end" ? 0.8 : -0.8), d.y - Math.cos(a) * (d.r + 3.2) + 1.6, FRONT_H], v, { face: "top", size: CAP, tone: "hi", anchor }));
  out.push(dial(P, { x: CHECK_DIAL.x, y: CHECK_DIAL.y, z: FRONT_H, r: CHECK_DIAL.r, h: 3, ticks: 15, every: 5, name: "check", value: 0, knurl: false }));
  // words on the top, beside each dial
  out.push(`<g data-metric-word="cpu">${faceText(P, [d.x + 12, d.y + 2.6, FRONT_H], "CPU", { face: "top", size: CAP + 0.6, tone: "hi" })}</g>`);
  out.push(`<g data-metric-word="busy" style="display:none">${faceText(P, [d.x + 12, d.y + 2.6, FRONT_H], t("BUSY", "OCUPADO"), { face: "top", size: CAP + 0.6, tone: "hi" })}</g>`);
  out.push(faceText(P, [CHECK_DIAL.x - 10, CHECK_DIAL.y + 1.6, FRONT_H], t("CHECK", "REVISIÓN"), { face: "top", size: CAP, tone: "mid", anchor: "end" }));
  out.push(faceText(P, [CTRL.x + 47, CTRL.y + 7, FRONT_H], "HPA", { face: "top", size: CAP + 1.4, tone: "hi", anchor: "middle" }));
  const f = CTRL.y + CTRL.d;
  const cols = [[CTRL.x + 5, "ready", t("READY", "LISTOS")], [CTRL.x + 35, "starting", t("STARTING", "ARRANCANDO")], [CTRL.x + 66, "wanted", t("WANTED", "DESEADOS")]];
  for (const [x, name, words] of cols) {
    out.push(digitCounter(P, { x, y: f, z: 2.2, count: 2, w: 4.4, h: 5.8, gap: 0.7, pad: 1.2, name }));
    out.push(caption(x - 1.2, f, 11.4, words));
  }
  return out.join("");
}

// The database: how many queries run at once, and how much slower each one runs than on a quiet database.
export const SLOW_MAX = 8;
function database() {
  const out = [S(k.slabOf(DB, 0, FRONT_H, P, 3, 0.6), { tone: "mid" })];
  // filing drawers on the top
  const drawers = [];
  for (let n = 0; n < 3; n++) drawers.push(k.planOutline({ x: DB.x + 42 + n * 10, y: DB.y + 4, w: 8, d: DB.d - 8, r: 0.6 }, FRONT_H, P));
  out.push(L(drawers.join(""), { tone: "lo" }));
  out.push(faceText(P, [DB.x + 21, DB.y + 11.6, FRONT_H], t("DATABASE", "BASE DE DATOS"), { face: "top", size: CAP + 0.4, tone: "hi", anchor: "middle" }));
  const f = DB.y + DB.d;
  out.push(`<g data-db="on" style="display:none">`);
  out.push(digitCounter(P, { x: DB.x + 5, y: f, z: 2.2, count: 2, w: 4.4, h: 5.8, gap: 0.7, pad: 1.2, name: "queries" }));
  out.push(caption(DB.x + 3.8, f, 11.4, t("QUERIES", "CONSULTAS")));
  out.push(meter(P, { x: DB.x + 62, y: f, z: 2.2, r: 6.2, ticks: 7, zone: 0.5, name: "slow" }));
  out.push(caption(DB.x + 62, f, 11.4, t("SLOWER", "MÁS LENTA"), { anchor: "middle" }));
  out.push(`</g><g data-db="off">`);
  // with the workers' CPU as the bottleneck the requests make no queries: say so rather than show idle dials
  out.push(caption(DB.x + 4, f, 8.2, t("NOT USED: THE BOTTLENECK", "SIN USO: EL CUELLO DE BOTELLA"), { tone: "hi" }));
  out.push(caption(DB.x + 4, f, 3.6, t("IS THE WORKERS' CPU", "ES LA CPU DE LOS TRABAJADORES"), { tone: "hi" }));
  out.push(`</g>`);
  return out.join("");
}

// A customer, drawn at the origin and moved with translateAlong. Lit when they give up.
export function customerSvg() {
  return `<g class="wb-lit-group">${litFill(figurine(P, [0, 0, 0], { scale: CUST_SCALE })).replace(/class="iso-solid"/g, 'class="iso-solid" data-body')}</g>`;
}
// A worker walking back to the staff room (a copy the script moves).
export function walkerSvg() {
  return person(P, [0, 0, 0], { scale: WORKER_SCALE });
}

export function buildFigure() {
  const rows = [0, 1, 2].map((r) => {
    const idx = SLOTS.map((s, i) => (s.row === r ? i : -1)).filter((i) => i >= 0);
    return idx.map((i) => plot(i) + worker(i) + desk(i) + newcomer(i)).join("") + `<g data-layer="row${r}"></g>`;
  });
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A service floor with an autoscaler, on a base plate. Customers (requests) come in through a gate at the back left and wait in one line down the left side. Twelve desk plots fill the floor, the most workers the floor can hold; an open desk has one worker, a pod, who serves one customer at a time, and served customers leave through the exit stand on the right, which counts them. A new worker stands beside the desk with a clipboard until ready; a worker sent home walks back to the staff room at the back right. Along the front: the door counters for customers waiting and customers who gave up, the autoscaler, marked HPA, with a dial from 0 to 100% showing the workers' average reading against a hollow target mark, a small dial counting down to its next check and counters for ready, starting and wanted workers, and the database with a counter of queries running at once and a meter of how much slower each one runs, or a note that it isn't used when the workers' CPU is the bottleneck. A tag on the gate's lintel counts the customers waiting beyond the drawn line.",
      "Un piso de atención con un autoescalador, sobre una placa base. Los clientes (solicitudes) entran por una puerta atrás a la izquierda y esperan en una sola fila por el lado izquierdo. Doce lugares para escritorios llenan el piso, la mayor cantidad de trabajadores que cabe; un escritorio abierto tiene un trabajador, un pod, que atiende a un cliente a la vez, y los clientes atendidos salen por el puesto de salida de la derecha, que los cuenta. Un trabajador nuevo espera junto al escritorio con una tablilla hasta estar listo; un trabajador que se manda a casa vuelve caminando a la sala del personal, atrás a la derecha. Al frente: los contadores de la puerta para los clientes en espera y los que se rindieron, el autoescalador, marcado HPA, con un dial de 0 a 100% que muestra la lectura promedio de los trabajadores frente a una marca hueca del objetivo, un dial pequeño con la cuenta regresiva hasta su próxima revisión y contadores de trabajadores listos, arrancando y deseados, y la base de datos con un contador de consultas al mismo tiempo y un medidor de cuánto más lenta corre cada una, o una nota de que no se usa cuando el cuello de botella es la CPU de los trabajadores. Una etiqueta en el dintel de la puerta cuenta los clientes que esperan más allá de la fila dibujada.",
    ),
    body: [
      plate(),
      gate(),
      lane(),
      staffRoom(),
      `<g data-layer="back"></g>`,
      rows[0], rows[1], rows[2],
      exitStand(),
      door(),
      controller(),
      database(),
    ],
  });
}

export const FIGURE_CSS = `
.as-target{fill:var(--anatomy-paper);stroke:var(--anatomy-hi);stroke-width:.8;stroke-linejoin:round}
.iso-stage [data-layer] *{pointer-events:none}
`;

export const GEOMETRY = {
  SLOTS, WORKER: SLOTS.map(WORKER_AT), SIDE: SLOTS.map(SIDE_AT), SEAT: SLOTS.map(SEAT_AT), ROWS, DESK_D: DESK.d,
  LINE: Array.from({ length: LINE_SLOTS }, (_, i) => LINE_AT(i)), ENTRY: ENTRY_AT, EXIT_X: EXIT.x + 1, EXIT_Y: [EXIT.y + 4, EXIT.y + EXIT.d - 4],
  STAFF: STAFF_AT, READ_DIAL, FRONT_H, SLOW_MAX, LINE_SLOTS,
};

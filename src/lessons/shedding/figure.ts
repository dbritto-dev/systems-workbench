// @ts-nocheck: figure code in the lessons' plain-JS style; drawing shorthands come from src/lib/draw.
// A takeaway kitchen past its capacity.
//   Front left: the street and the door, with a doorman whose sign says OPEN or FULL (admission control).
//   Back left: the order desk, where slips wait when the rail is full and nobody told the door, and the chart
//         recorder: dishes cooked a minute (throughput) against dishes handed over in time (goodput).
//   Back: the order rail (the queue), slips hanging oldest at the right; a stop on the rail marks its limit, a
//         gauge shows how long the rail has gone without emptying, and a sign says which end the cooks take from.
//   Back right: three cooks at their stoves, the pass where dishes come out, and the bin for dishes whose
//         customer already left.
//   Front: the floor where customers wait for their dish, each for at most PATIENCE seconds.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate, digitCounter, person, figurine, meter, sign, faceText, variants } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -128, y: -88, w: 256, d: 140, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// ---------- the chart recorder (back left) ----------
const CHART = { x: -122, y: -84, w: 62, d: 6, r: 1 };
const CHART_H = 46;
export const PLOT = { x0: -114, x1: -66, y: CHART.y + CHART.d, z0: 17, z1: 39, max: 120, span: 60 };

// ---------- the order desk, just inside the door ----------
const DESK = { x: -94, y: -26, w: 28, d: 18, r: 1.5 };
const DESK_H = 12;
export const DESK_SPOT = [DESK.x + 8, DESK.y + 8, DESK_H];          // where waiting slips stack, lying flat
export const DESK_SHOW = 8;

// ---------- the rail (the queue) ----------
const RAILBOX = { x: -54, y: -84, w: 110, d: 12, r: 1 };
const RAILBOX_H = 14;
export const TROUGH_Z = RAILBOX_H + 0.4;
export const RAIL_Y = RAILBOX.y + 4;                                 // the plane the slips hang in
export const RAIL_Z = 36;                                            // the bar
export const HOOK_X = Array.from({ length: 12 }, (_, i) => 47 - 8.5 * i); // slot 0, the oldest, at the right
export const SLIP = { w: 6.4, h: 9, d: 0.6 };
export const SLIP_Z = RAIL_Z - 1 - SLIP.h;
export const LIMIT_X = (HOOK_X[5] + HOOK_X[6]) / 2;

// ---------- cooks, stoves, pass, bin ----------
export const STOVE_X = [70, 92, 114];
const STOVE_Y = -78, STOVE_D = 14, STOVE_H = 10;
export const COOK_SPOT = STOVE_X.map((x) => [x + 4.4, STOVE_Y + STOVE_D / 2, STOVE_H]);   // the slip being cooked, lying on the stove
export const POT = STOVE_X.map((x) => [x - 3.6, STOVE_Y + STOVE_D / 2]);
const PASS = { x: 58, y: -58, w: 50, d: 10, r: 1 };
const PASS_H = 13;
export const PASS_SPOT = [66, 80, 94].map((x) => [x, PASS.y + PASS.d / 2, PASS_H]);
const BIN = { x: 110, y: -60, w: 16, d: 14, r: 1.2 };
const BIN_H = 13;
export const BIN_SPOT = [BIN.x + BIN.w / 2, BIN.y + BIN.d / 2, BIN_H + 0.2];

// ---------- the floor, the door, the street ----------
const MAT = { x: -44, y: -40, w: 168, d: 70, r: 3 };
const COLS = 9, ROWS = 3;
export const SPOTS = (() => {
  const out = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) out.push([112 - 18 * c - (r % 2) * 9, -28 + 21 * r]);
  return out;
})();
export const DOOR_X = -100;
const DOOR_Y0 = 8, DOOR_Y1 = 34;
export const LANE_Y = 21;                                            // the path through the door
export const STREET = [-124, LANE_Y];
export const EXIT = [126, 40];
const PODIUM = { x: -124, y: 40, w: 20, d: 10, r: 1.2 };
const PODIUM_H = 13;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [CHART.x, CHART.y, CHART_H + 2], [CHART.x + CHART.w, CHART.y, CHART_H + 2], [STOVE_X[2], STOVE_Y - 10, 30]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 50 },
);

const { S, L, D, at, seg } = shorthand(P);
const word = (x, y, z, text, size = 2.6, opts = {}) => faceText(P, [x, y, z], text, { size, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -60, y: 38, w: 90, d: 6, r: 1 })
    + labelPlate(P, { x: 44, y: 36, w: 40, d: 12, r: 1.5 }, [[49, 40, 26], [49, 44, 30]]);
}

// The chart recorder: a standing panel. Two pens draw the last minute: dishes cooked a minute and dishes handed
// over in time a minute; the counters under the plot are its legend.
function chart() {
  const out = [S(k.slabOf(CHART, 0, CHART_H, P, 3, 0.6), { tone: "mid" })];
  const y = PLOT.y;
  out.push(`<path class="sh-paper" d="${k.faceRectY(P, PLOT.x0 - 2, PLOT.x1 + 2, y, PLOT.z0 - 2, PLOT.z1 + 2)}"/>`);
  // grid: a line every 30 a minute, the axis labels on the left
  const grid = [];
  for (let v = 0; v <= PLOT.max; v += 30) {
    const z = PLOT.z0 + ((PLOT.z1 - PLOT.z0) * v) / PLOT.max;
    grid.push(seg([PLOT.x0, y, z], [PLOT.x1, y, z]));
  }
  for (let s = 0; s <= PLOT.span; s += 15) { const x = PLOT.x0 + ((PLOT.x1 - PLOT.x0) * s) / PLOT.span; grid.push(seg([x, y, PLOT.z0], [x, y, PLOT.z1])); }
  out.push(L(grid.join(""), { tone: "faint" }));
  out.push(L(seg([PLOT.x0, y, PLOT.z0], [PLOT.x1, y, PLOT.z0]) + seg([PLOT.x0, y, PLOT.z0], [PLOT.x0, y, PLOT.z1]), { tone: "lo" }));
  for (const v of [0, 60, 120]) out.push(word(PLOT.x0 - 1.2, y, PLOT.z0 + ((PLOT.z1 - PLOT.z0) * v) / PLOT.max - 0.9, String(v), 2.2, { anchor: "end", tone: "lo" }));
  out.push(word(PLOT.x1 + 2, y, PLOT.z1 + 2.8, t("PER MINUTE · LAST 60 S", "POR MINUTO · ÚLTIMOS 60 S"), 2.1, { anchor: "end", tone: "lo" }));
  out.push(`<path class="sh-pen" data-pen="cooked" d=""/>`, `<path class="sh-pen" data-pen="good" d=""/>`);
  // the legend: each counter with a sample of its pen and its name above it
  const cz = 2.2, lz = 10.2;
  [["cooked", "cookedMin", CHART.x + 4, t("COOKED", "COCINADOS")], ["good", "goodMin", CHART.x + 33, t("IN TIME", "A TIEMPO")]].forEach(([key, name, x, label]) => {
    out.push(digitCounter(P, { x: x + 1, y, z: cz, count: 3, w: 3.8, h: 5.2, gap: 0.5, pad: 1, name }));
    out.push(`<path class="sh-pen" data-key="${key}" d="${k.pathOf([at([x, y, lz + 0.9]), at([x + 5, y, lz + 0.9])])}"/>`);
    out.push(word(x + 6.4, y, lz, label, 2.3));
  });
  return out.join("");
}

// The order desk: slips that don't fit on the rail wait here, lying in a stack, when the rail is limited but the
// door doesn't know.
function desk() {
  const out = [S(k.slabOf(DESK, 0, DESK_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(DESK, 1.8), DESK_H, P), { tone: "faint" }) })];
  const front = DESK.y + DESK.d;
  out.push(digitCounter(P, { x: DESK.x + 3, y: front, z: 1.4, count: 3, w: 3.8, h: 5, gap: 0.5, pad: 0.9, name: "desk" }));
  out.push(word(DESK.x + 2.4, front, 9, t("ON THE DESK", "EN EL MOSTRADOR"), 2.1));
  return out.join("");
}

// The rail: a cabinet with a bar on two posts; slips hang from the bar, the oldest at the right end next to the
// cooks. The stop marks the limit of HOOKS slips; the gauge shows how long the rail has gone without emptying.
function railBack() {
  const out = [S(k.slabOf(RAILBOX, 0, RAILBOX_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(RAILBOX, 2), RAILBOX_H, P), { tone: "faint" }));
  const posts = [RAILBOX.x + 3, RAILBOX.x + RAILBOX.w - 3];
  for (const x of posts) out.push(S(k.cylinder(x, RAIL_Y, 1.1, RAILBOX_H, RAIL_Z - RAILBOX_H, P, 14), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: posts[0] - 1.5, y: RAIL_Y - 1.2, w: posts[1] - posts[0] + 3, d: 2.4, r: 0.5 }, RAIL_Z, 2, P, 2), { tone: "hi", crease: "lo" }));
  out.push(L(HOOK_X.map((x) => seg([x, RAIL_Y, RAIL_Z], [x, RAIL_Y, RAIL_Z - 1.2])).join(""), { tone: "lo" }));
  return out.join("");
}
function railFront() {
  const out = [];
  // the limit stop: a block on the bar, shown when the rail is limited
  // the gap in a rail with more slips than hooks: the middle ones aren't shown
  out.push(`<g data-gap style="display:none">${D([-2.4, 0, 2.4].map((dx) => at([(HOOK_X[5] + HOOK_X[6]) / 2 + dx, RAIL_Y, SLIP_Z + 4.5])), { size: 0.8, tone: "mid" })}</g>`);
  out.push(`<g data-stop style="display:none">${S(k.slabOf({ x: LIMIT_X - 1.2, y: RAIL_Y - 2.4, w: 2.4, d: 4.8, r: 0.5 }, RAIL_Z - 3, 7, P, 2), { tone: "hi", crease: "lo" })}</g>`);
  const front = RAILBOX.y + RAILBOX.d;
  // each counter with its name printed above it; the right end is left clear (the pass stands in front of it)
  const cnt = (x, name, label) => digitCounter(P, { x, y: front, z: 1.8, count: 3, w: 4.2, h: 5.6, gap: 0.6, pad: 1, name }) + word(x - 1, front, 10.6, label, 2.4);
  out.push(cnt(RAILBOX.x + 4, "rail", t("ON THE RAIL", "EN EL RIEL")));
  out.push(cnt(RAILBOX.x + 31, "oldest", t("OLDEST WAIT, S", "ESPERA MÁX., S")));
  out.push(cnt(RAILBOX.x + 60, "dropped", t("DROPPED", "DESCARTADAS")));
  out.push(meter(P, { x: RAILBOX.x + 90, y: front, z: 2.6, r: 5, ticks: 8, zone: 0.5, name: "standing", value: 0 }));
  out.push(word(RAILBOX.x + 90, front, 10.6, t("NOT EMPTIED", "SIN VACIARSE"), 2, { anchor: "middle" }));
  return out.join("");
}

// The sign over the cooks' end of the rail: which slip they take next.
function orderSign() {
  const x = RAILBOX.x + RAILBOX.w - 18, y = RAIL_Y + 2, z = RAIL_Z + 4;
  const one = (text, lit) => sign(P, { x, y, z, w: 15, h: 6.4, text, posts: false, lit });
  return `<g data-order-sign>${variants("order", { fifo: one("FIFO", false), lifo: one("LIFO", true) }, "fifo")}</g>`
    + S(k.cylinder(x + 7.5, RAIL_Y + 1.4, 0.7, RAIL_Z + 2, 2.2, P, 10), { tone: "mid", crease: "none" });
}

function stoves() {
  const out = [];
  STOVE_X.forEach((cx, i) => {
    out.push(person(P, [cx, STOVE_Y - 8, 0], { scale: 0.7 }));
    const plan = { x: cx - 12, y: STOVE_Y, w: 24, d: STOVE_D, r: 1.4 };
    out.push(S(k.slabOf(plan, 0, STOVE_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(plan, 1.6), STOVE_H, P), { tone: "faint" }) }));
    const [px, py] = POT[i];
    out.push(L(k.ring(px, py, 4.6, STOVE_H, P, 24), { tone: "lo" }));
    out.push(`<g data-pot="${i}">${S(k.cylinder(px, py, 4, STOVE_H, 4.4, P, 24, 0.4), { tone: "hi", crease: "lo" })}${S(k.slabOf({ x: px + 3.4, y: py - 0.6, w: 5, d: 1.2, r: 0.4 }, STOVE_H + 3.4, 0.9, P, 2), { tone: "mid", crease: "none" })}</g>`);
    out.push(D([at([cx - 9, STOVE_Y + STOVE_D, 6]), at([cx - 5, STOVE_Y + STOVE_D, 6])], { size: 0.6, tone: "lo" }));
  });
  return out.join("");
}

function pass() {
  const out = [S(k.slabOf(PASS, 0, PASS_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(PASS, 1.6), PASS_H, P), { tone: "faint" }));
  const front = PASS.y + PASS.d;
  out.push(digitCounter(P, { x: PASS.x + 4, y: front, z: 3.4, count: 4, w: 4.6, h: 6.2, gap: 0.7, pad: 1.2, name: "served" }));
  out.push(word(PASS.x + 27, front, 5.4, t("IN TIME", "A TIEMPO")));
  return out.join("");
}

function bin() {
  const out = [S(k.slabOf(BIN, 0, BIN_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(BIN, 1.6), BIN_H, P), { tone: "lo" }) })];
  const front = BIN.y + BIN.d;
  out.push(digitCounter(P, { x: BIN.x + 2.4, y: front, z: 2, count: 3, w: 3.4, h: 4.8, gap: 0.5, pad: 0.8, name: "late" }));
  out.push(word(BIN.x + BIN.w / 2, front, 9.4, t("TOO LATE", "TARDE"), 2, { anchor: "middle" }));
  return out.join("");
}

function floor() {
  const out = [S(k.slabOf(MAT, 0, 0.6, P, 3, 0.2), { tone: "lo", crease: "none" })];
  out.push(L(k.planOutline(k.insetPlan(MAT, 2.4), 0.6, P), { tone: "faint" }));
  return out.join("");
}

// The door: two posts and a lintel across the path in from the street; the sign on the lintel reads OPEN, or FULL
// (lit) while the doorman turns people away. The doorman's podium counts them.
function doorBack() {
  return S(k.cylinder(DOOR_X, DOOR_Y0, 1.6, 0, 28, P, 16), { tone: "mid", crease: "none" });
}
function doorFront() {
  const out = [S(k.cylinder(DOOR_X, DOOR_Y1, 1.6, 0, 28, P, 16), { tone: "mid", crease: "none" })];
  out.push(S(k.slabOf({ x: DOOR_X - 2, y: DOOR_Y0 - 2, w: 4, d: DOOR_Y1 - DOOR_Y0 + 4, r: 0.6 }, 28, 3, P, 2), { tone: "mid" }));
  const board = (text, lit) => sign(P, { x: DOOR_X + 2, y: DOOR_Y1 + 1, z: 31.5, w: DOOR_Y1 - DOOR_Y0 + 2, h: 7, face: "x", text, posts: false, lit });
  out.push(`<g data-door-sign>${variants("door", { open: board(t("OPEN", "ABIERTO"), false), full: board(t("FULL", "LLENO"), true) }, "open")}</g>`);
  out.push(person(P, [-111, 34, 0], { scale: 0.72, hat: "cap" }));
  out.push(S(k.slabOf(PODIUM, 0, PODIUM_H, P, 3, 0.5), { tone: "mid" }));
  const front = PODIUM.y + PODIUM.d;
  out.push(digitCounter(P, { x: PODIUM.x + 3.4, y: front, z: 1.6, count: 3, w: 4, h: 5.4, gap: 0.5, pad: 0.9, name: "turned" }));
  out.push(word(PODIUM.x + PODIUM.w / 2, front, 9.4, t("TURNED AWAY", "SIN LUGAR"), 2.1, { anchor: "middle" }));
  return out.join("");
}

// ---------- moving pieces, drawn at the origin and placed by the live code ----------
// A slip: a card hanging in the rail's plane, its number printed on the face.
export function slipSvg() {
  const body = S(k.slabOf({ x: -SLIP.w / 2, y: -SLIP.d / 2, w: SLIP.w, d: SLIP.d, r: 0.15 }, 0, SLIP.h, P, 2, 0.15), { tone: "hi", crease: "none" }).replace('class="iso-solid"', 'class="iso-solid" data-body');
  const clip = S(k.slabOf({ x: -1.2, y: -0.7, w: 2.4, d: 1.4, r: 0.3 }, SLIP.h - 0.8, 1.8, P, 2), { tone: "mid", crease: "none" });
  const num = faceText(P, [0, SLIP.d / 2, 2.6], "0", { size: 3.4, tone: "hi", anchor: "middle", attr: "data-num" });
  return body + clip + num;
}
// A slip lying flat (on the desk, on a stove): the same card on its back.
export function flatSlipSvg() {
  const body = S(k.slabOf({ x: -SLIP.w / 2, y: -SLIP.h / 2, w: SLIP.w, d: SLIP.h, r: 0.2 }, 0, SLIP.d, P, 2, 0.15), { tone: "hi", crease: "none" }).replace('class="iso-solid"', 'class="iso-solid" data-body');
  const num = faceText(P, [0, 1.2, SLIP.d], "0", { face: "top", size: 3.4, tone: "hi", anchor: "middle", attr: "data-num" });
  return body + num;
}
// A takeaway box.
export function dishSvg() {
  const b = { x: -3.4, y: -3.4, w: 6.8, d: 6.8, r: 0.6 };
  return S(k.slabOf(b, 0, 4.2, P, 2, 0.3), { tone: "hi", crease: "lo" }) + L(k.lineOnTop([b.x + 0.8, 0], [b.x + b.w - 0.8, 0], 4.2, P), { tone: "faint" });
}
export function customerSvg() {
  return figurine(P, [0, 0, 0], { scale: 0.8 });
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A takeaway kitchen on a base plate. Customers come in from the street at the front left through a door with a doorman, whose sign reads OPEN or FULL. Each order is a numbered slip that hangs on a long rail at the back, the oldest at the right end next to three cooks at their stoves. Dishes come out on the pass in front of the stoves and go to the customer waiting on the floor in front, or into the bin if the customer has already left. An order desk at the back left holds slips the rail has no room for, and a chart recorder beside it draws dishes cooked a minute against dishes handed over in time.",
      "Una cocina de comida para llevar sobre una placa base. Los clientes entran desde la calle, adelante a la izquierda, por una puerta con un portero cuyo letrero dice ABIERTO o LLENO. Cada pedido es una comanda numerada que cuelga de un riel largo al fondo, la más vieja en el extremo derecho, junto a tres cocineros en sus estufas. Los platos salen por la barra de entrega frente a las estufas y van al cliente que espera en el piso de adelante, o a la basura si el cliente ya se fue. Un mostrador atrás a la izquierda guarda las comandas que no caben en el riel, y a su lado un registrador dibuja los platos cocinados por minuto frente a los entregados a tiempo.",
    ),
    body: [
      plate(),
      chart(),
      railBack(),
      `<g data-layer="rail"></g>`,
      railFront(),
      stoves(),
      `<g data-layer="stoves"></g>`,
      orderSign(),
      desk(),
      `<g data-layer="desk"></g>`,
      pass(),
      bin(),
      `<g data-layer="pass"></g>`,
      floor(),
      doorBack(),
      `<g data-layer="floor"></g>`,
      doorFront(),
      `<g data-layer="front"></g>`,
    ],
  });
}

export const GEOMETRY = { TROUGH_Z, PLOT, DESK_SPOT, DESK_SHOW, RAIL_Y, RAIL_Z, HOOK_X, SLIP, SLIP_Z, LIMIT_X, STOVE_X, COOK_SPOT, POT, PASS_SPOT, BIN_SPOT, SPOTS, DOOR_X, LANE_Y, STREET, EXIT };

// Page CSS for the figure's own pieces.
export const FIGURE_CSS = `
.sh-paper{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.5}
.sh-pen{fill:none;stroke:var(--anatomy-mid);stroke-width:1.2;stroke-dasharray:3 2;stroke-linejoin:round;stroke-linecap:round}
.sh-pen[data-pen="good"],.sh-pen[data-key="good"]{stroke:var(--anatomy-lit);stroke-width:2;stroke-dasharray:none}
`;

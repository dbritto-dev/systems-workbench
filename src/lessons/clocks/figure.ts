// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// Two offices and a records desk. At the front, offices A and B, each with its own wall clock (a display with the
// reading in ms and a dial, one turn per 100 ms) and counters for its edits and its lost edits. At the back, the
// records desk: a board shows the record it holds (the stamp, and with vector clocks a second card for a sibling),
// a counter of the lines on the record and one of siblings kept. Between each office and the desk runs a lane where
// the office's courier carries a GET, a copy, a stamped edit or an OK. Edits the desk drops fall into the DROPPED
// tray between the offices, into one of two bins, where the last three stay: OLDER (it lost to an edit its writer
// had already read) or SAME COPY (two edits made from one copy of the record). In the back corner, the true time,
// which nobody in the system can read.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, labelPlate, digitCounter, figurine, faceText, dial, card, variants } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -98, y: -114, w: 196, d: 178, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The records desk, at the back.
const DESK = { x: -58, y: -106, w: 116, d: 36, r: 2 };
const DESK_H = 12;
const DESK_FRONT = DESK.y + DESK.d;
const BOARD = { x: -48, y: -100, w: 96, d: 4, r: 0.6 };
const BOARD_H = 32;
const BOARD_FACE = BOARD.y + BOARD.d;
export const CARDS = [{ x: -44, w: 41 }, { x: 3, w: 41 }];
const CARD_Z = DESK_H + 5, CARD_H = 12;

// The lanes, one per office, from behind the office to the desk's window: each on the inner side of its office, far
// enough back that the office and its clock display don't hide a courier waiting there.
export const LANE_X = [-30, 14];
export const DESK_Y = DESK_FRONT + 5;             // where a courier stands at the desk
export const HOME_Y = -27;                         // where a courier waits at its office
const LANE = { y: DESK_FRONT + 1, d: 0 };
LANE.d = HOME_Y + 4 - LANE.y;

// The DROPPED tray, at the front between the offices: two bins, OLDER on the left, SAME COPY on the right.
// Low and clear of the offices' front faces, so it hides none of their counters.
export const TRAY = { x: -22, y: 42, w: 46, d: 20, r: 1.4 };
const TRAY_H = 7;
export const TRAY_SPOTS = [0, 1].map((b) => [TRAY.x + TRAY.w * (b ? 0.75 : 0.25), TRAY.y + TRAY.d / 2, TRAY_H]);

// The offices.
export const OFFICE = [{ x: -90, y: -2, w: 66, d: 40, r: 2 }, { x: 24, y: -2, w: 66, d: 40, r: 2 }];
const OFFICE_H = 14;
const DISPLAY = { dx: [4, 28], y: 0, w: 34, d: 4 };   // the clock display on the outer side, the dial on the inner one
const DIAL_DX = [53, 15];
const DISPLAY_H = 17;
const DIAL_R = 7.4;

// True time, in the back-left corner.
const TOWER = { x: -94, y: -106, w: 30, d: 22, r: 1.4 };
const TOWER_H = 13;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(BOARD, DESK_H, DESK_H + BOARD_H + 2),
    ...OFFICE.flatMap((o, i) => k.boxCorners({ x: o.x + DISPLAY.dx[i], y: DISPLAY.y, w: DISPLAY.w, d: DISPLAY.d }, OFFICE_H, OFFICE_H + DISPLAY_H + 2))],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 50 },
);

const { S, L } = shorthand(P);
const text = (x, y, z, words, size = 2.4, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + labelPlate(P, { x: 62, y: 46, w: 26, d: 11, r: 1.4 }, [[66, 50, 18], [66, 54, 11]]);
}

// ---------- true time ----------
function tower() {
  const out = [S(k.slabOf(TOWER, 0, TOWER_H, P, 3, 0.5), { tone: "mid" })];
  const front = TOWER.y + TOWER.d;
  out.push(text(TOWER.x + TOWER.w / 2, front, TOWER_H - 4.6, t("TRUE TIME", "HORA REAL"), 2.6, { anchor: "middle" }));
  out.push(faceText(P, [TOWER.x + TOWER.w / 2, front, 2.2], "1000.0", { size: 3.6, tone: "hi", anchor: "middle", attr: 'data-time-text="true"' }));
  out.push(dial(P, { x: TOWER.x + TOWER.w / 2, y: TOWER.y + TOWER.d / 2 - 1, z: TOWER_H, r: 7.4, h: 3.4, ticks: 50, every: 10, name: "true", value: 0 }));
  return out.join("");
}

// ---------- the records desk ----------
function desk() {
  const out = [S(k.slabOf(DESK, 0, DESK_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(DESK, 2.4), DESK_H, P), { tone: "faint" }));
  // a window ledge in front of each lane
  for (const x of LANE_X) out.push(S(k.slabOf({ x: x - 9, y: DESK_FRONT, w: 18, d: 2.6, r: 0.5 }, 7, 1.4, P, 2), { tone: "hi", crease: "lo" }));
  // the lines on the record, on the front right of B's window
  out.push(digitCounter(P, { x: 30, y: DESK_FRONT, z: 3.4, count: 3, w: 4, h: 5.2, gap: 0.5, pad: 1, name: "lines" }));
  out.push(text(45.6, DESK_FRONT, 4.6, t("LINES", "LÍNEAS"), 2.8));
  // siblings kept, on the right face
  const side = DESK.x + DESK.w;
  out.push(digitCounter(P, { x: side, y: DESK_FRONT - 4, z: 3.4, count: 3, face: "x", w: 4, h: 5.2, gap: 0.5, pad: 1, name: "siblings" }));
  out.push(faceText(P, [side, DESK_FRONT - 19.4, 4.6], t("SIBLINGS", "HERMANAS"), { face: "x", size: 2.4, tone: "mid" }));
  return out.join("");
}
function board() {
  const out = [S(k.slabOf(BOARD, DESK_H, BOARD_H, P, 3, 0.4), { tone: "mid", crease: "lo" })];
  out.push(L(k.faceRectY(P, BOARD.x + 2, BOARD.x + BOARD.w - 2, BOARD_FACE, DESK_H + 2, DESK_H + BOARD_H - 2), { tone: "faint" }));
  out.push(text(BOARD.x + 4, BOARD_FACE, DESK_H + BOARD_H - 7.6, t("RECORD", "REGISTRO"), 3.6));
  // the rule the desk applies; the live code shows the one in use
  const rule = (words) => text(BOARD.x + BOARD.w - 4, BOARD_FACE, DESK_H + BOARD_H - 7.2, words, 2.6, { anchor: "end" });
  out.push(variants("rule", {
    lww: rule(t("HIGHEST STAMP WINS", "GANA EL SELLO MAYOR")),
    lamport: rule(t("HIGHEST COUNT WINS", "GANA EL CONTADOR MAYOR")),
    vector: rule(t("KEEPS CONCURRENT ONES", "GUARDA LAS CONCURRENTES")),
  }, "lww"));
  // the record's card, and a second one for a sibling
  CARDS.forEach((c, i) => {
    out.push(`<g class="wb-lit-group" data-card="${i}"${i ? ' style="display:none"' : ""}>`
      + card(P, { x: c.x, y: BOARD_FACE + 0.6, z: CARD_Z, w: c.w, h: CARD_H, text: "—", size: 4.6, attr: `data-card-text="${i}"` })
      + `</g>`);
  });
  return out.join("");
}

// ---------- the lanes ----------
function lanes() {
  const out = [];
  for (const x of LANE_X) {
    const plan = { x: x - 7, y: LANE.y, w: 14, d: LANE.d, r: 1 };
    out.push(S(k.slabOf(plan, 0, 0.8, P, 3, 0.2), { tone: "lo", crease: "none" }));
    const ticks = [];
    for (let y = LANE.y + 8; y < LANE.y + LANE.d - 6; y += 10) ticks.push(k.lineOnTop([x - 4.4, y], [x - 2.2, y], 0.8, P), k.lineOnTop([x + 2.2, y], [x + 4.4, y], 0.8, P));
    out.push(L(ticks.join(""), { tone: "mid" }));
  }
  return out.join("");
}

function tray() {
  const out = [S(k.slabOf(TRAY, 0, TRAY_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(TRAY, 2), TRAY_H, P), { tone: "lo" }) })];
  // the divider between the two bins
  const xm = TRAY.x + TRAY.w / 2;
  out.push(L(k.lineOnTop([xm, TRAY.y + 2], [xm, TRAY.y + TRAY.d - 2], TRAY_H, P), { tone: "lo" }));
  // each bin's name on its own half of the front, split by a rule; DROPPED on the right side
  const front = TRAY.y + TRAY.d, side = TRAY.x + TRAY.w;
  out.push(L(k.segment([xm, front, 0.8], [xm, front, TRAY_H - 0.8], P), { tone: "lo" }));
  out.push(text(TRAY_SPOTS[0][0], front, 2.2, t("OLDER", "ANTERIOR"), 2.8, { anchor: "middle" }));
  out.push(text(TRAY_SPOTS[1][0], front, 2.2, t("SAME COPY", "MISMA COPIA"), 2.8, { anchor: "middle" }));
  out.push(faceText(P, [side, front - 3, 2.2], t("DROPPED", "DESCARTE"), { face: "x", size: 2.8, tone: "mid" }));
  return out.join("");
}

// ---------- the offices ----------
function office(i) {
  const o = OFFICE[i], name = i ? "B" : "A";
  const out = [S(k.slabOf(o, 0, OFFICE_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(o, 2.4), OFFICE_H, P), { tone: "faint" }));
  const front = o.y + o.d;
  out.push(text(o.x + 4, front, 3, name, 7.6, { tone: "hi" }));
  const col = (x, key, words) => digitCounter(P, { x, y: front, z: 1.8, count: 3, w: 4, h: 5.2, gap: 0.5, pad: 1, name: key + i })
    + text(x - 1, front, 9.8, words, 2.4);
  out.push(col(o.x + 17, "edits", t("EDITS", "EDICIONES")));
  out.push(col(o.x + 41, "lost", t("LOST", "PERDIDAS")));
  // the wall clock: a display with the reading, and a dial beside it (one turn per 100 ms)
  const disp = { x: o.x + DISPLAY.dx[i], y: DISPLAY.y, w: DISPLAY.w, d: DISPLAY.d, r: 0.6 };
  const face = disp.y + disp.d, z0 = OFFICE_H, top = OFFICE_H + DISPLAY_H;
  out.push(S(k.slabOf(disp, z0, DISPLAY_H, P, 3, 0.4), { tone: "mid", crease: "lo" }));
  out.push(L(k.faceRectY(P, disp.x + 1.8, disp.x + disp.w - 1.8, face, z0 + 1.8, top - 1.8), { tone: "faint" }));
  out.push(text(disp.x + 3.4, face, top - 6, t("CLOCK " + name, "RELOJ " + name), 2.8));
  out.push(faceText(P, [disp.x + disp.w / 2, face, z0 + 3.4], "1000.0", { size: 5.4, tone: "hi", anchor: "middle", attr: `data-clock-text="${i}"` }));
  out.push(dial(P, { x: o.x + DIAL_DX[i], y: o.y + 15, z: OFFICE_H, r: DIAL_R, h: 3.4, ticks: 50, every: 10, name: "clock" + i, value: 0 }));
  return out.join("");
}

// A courier: a small figure with a slip on its front, drawn at the origin and moved with translateAlong. The slip
// lights when the desk drops what it carries; its one <text> is set by the live code (GET, COPY, a stamp, OK).
export const COURIER = { scale: 0.95, slip: { w: 15, h: 5.6, z: 3.8 } };
export function courierSvg() {
  const s = COURIER.scale, c = COURIER.slip;
  const fig = figurine(P, [0, 0, 0], { scale: s });
  const plan = { x: -c.w / 2, y: 2.6 * s + 0.4, w: c.w, d: 0.6, r: 0.15 };
  const slip = `<g class="wb-lit-group" data-slip>${S(k.slabOf(plan, c.z, c.h, P, 2, 0.15), { tone: "hi", crease: "none" })}`
    + faceText(P, [0, plan.y + plan.d, c.z + 1.7], "GET", { size: 2.8, tone: "hi", anchor: "middle", attr: "data-slip-text" }) + `</g>`;
  return fig + slip;
}
// A slip alone, falling into the tray.
export function slipSvg() {
  const c = COURIER.slip;
  const plan = { x: -c.w / 2, y: -0.3, w: c.w, d: 0.6, r: 0.15 };
  return `<g class="wb-lit-group" data-slip>${S(k.slabOf(plan, 0, c.h, P, 2, 0.15), { tone: "hi", crease: "none" })}</g>`;
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "Two offices and a records desk on a base plate. At the front, offices A and B each have a wall clock, a display with the reading in milliseconds and a dial beside it, and counters for the edits the office made and the ones that were lost. At the back, the records desk has a board showing the record it holds: the stamp of the edit it kept, and with vector clocks a second card for a sibling, lit. A counter on the desk shows the lines on the record and one on its side the siblings kept. A lane runs from each office to the desk; on it the office's courier carries a GET, a copy, an edit with its stamp, or an OK. Edits the desk drops fall, lit, into the DROPPED tray (named on its right side) at the front, between the offices: into its OLDER bin when the edit lost to one its writer had already read, into SAME COPY when two edits were made from one copy; the last three stay in each bin. In the back corner, a tower shows the true time.",
      "Dos oficinas y una mesa de registros sobre una placa base. Adelante, las oficinas A y B tienen cada una un reloj de pared, una pantalla con la lectura en milisegundos y un dial al lado, y contadores de las ediciones que hizo la oficina y de las que se perdieron. Al fondo, la mesa de registros tiene un tablero con el registro que guarda: el sello de la edición que conservó y, con relojes vectoriales, una segunda tarjeta encendida para una versión hermana. Un contador en la mesa muestra las líneas del registro y otro a un costado las hermanas guardadas. De cada oficina sale un carril hasta la mesa; por él, el mensajero de la oficina lleva un GET, una copia, una edición con su sello o un OK. Las ediciones que la mesa descarta caen, encendidas, en la bandeja DESCARTE (el nombre en su costado derecho) al frente, entre las oficinas: en su compartimento ANTERIOR cuando la edición perdió ante una que su autor ya había leído, en MISMA COPIA cuando dos ediciones se hicieron desde una misma copia; las tres últimas quedan en cada compartimento. En la esquina del fondo, una torre muestra la hora real.",
    ),
    body: [
      plate(),
      tower(),
      desk(),
      board(),
      lanes(),
      `<g data-layer="walk"></g>`,
      office(0),
      office(1),
      tray(),
      `<g data-layer="drop"></g>`,
    ],
  });
}

export const GEOMETRY = { LANE_X, DESK_Y, HOME_Y, TRAY_SPOTS, CARDS, BOARD_FACE, CARD_Z, CARD_H };

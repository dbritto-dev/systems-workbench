// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A records room that answers order lookups with SQL.
//   Front left: visitors (shop staff) queue at the window desk; the slip stand on the desk shows the shop the one at
//   the window is signed in as (from their session) and what they typed (name, sort). The clerk behind the desk writes
//   the statement on the big board at the back: pasted words are printed inline, on a lit strip; with parameters the
//   statement keeps its $1 $2 $3 slots and the values go into the boxes of the VALUES board beside it, the visitor's
//   words lit, the app's own value ($1, the shop) not. The cabinet at the back left is the orders table, a drawer per
//   row, in three shops; the rows a statement returns slide out and are laid in the result tray in the order the
//   database gave them, each card showing the value the list was sorted by (a lit card: another shop's row). With the
//   row policy on, shutters close over the other shops' drawers. The database, right of the tray, counts errors and
//   requests whose words became code; the tally bench, front right, counts what came back to the window.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, labelPlate, digitCounter, person, plaque, faceText } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 440;

const PLATE = { x: -132, y: -100, w: 258, d: 122, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// ---------- the orders cabinet (the table), back left ----------
const CAB = { x: -120, y: -94, w: 92, d: 18, r: 1.4 };
const CAB_H = 25;
export const CAB_FRONT = CAB.y + CAB.d;
export const DRAWER = { w: 8, h: 7, gap: 1, z: [2.6, 10.8], out: 3.2 };
export const GROUP_X = [0, 1, 2].map((g) => CAB.x + 3 + g * 30);      // left edge of each shop's drawers
// drawer i (0..17, the table's storage order): shop g = floor(i / 6), then 3 columns × 2 rows
export const DRAWER_AT = Array.from({ length: 18 }, (_, i) => {
  const g = Math.floor(i / 6), j = i % 6, col = j % 3, row = Math.floor(j / 3);
  return { x: GROUP_X[g] + col * (DRAWER.w + DRAWER.gap), z: DRAWER.z[1 - row] };
});

// ---------- the statement board and the values board, back right ----------
const BOARD = { x: -20, y: -94, w: 86, d: 4, r: 0.6 };
const BOARD_H = 40;
export const BOARD_FACE = BOARD.y + BOARD.d;
export const LINE_X = BOARD.x + 4;
export const LINE_Z = [26.2, 20.4, 14.6, 8.8];
export const LINE_SIZE = 3.6;
const VALS = { x: 74, y: -94, w: 44, d: 4, r: 0.6 };
const VALS_H = 34;
export const VALS_FACE = VALS.y + VALS.d;
export const VAL_Z = [19.4, 11.4, 3.4];
export const VAL_BOX = { x0: VALS.x + 9, x1: VALS.x + VALS.w - 2.5, h: 5 };

// ---------- the result tray, middle ----------
const TRAY = { x: -76, y: -68, w: 104, d: 36, r: 1.4 };
const TRAY_H = 5;
export const CARD = { w: 12, d: 8 };
export const CARD_AT = Array.from({ length: 18 }, (_, i) => {
  const col = i % 6, row = Math.floor(i / 6);
  return [TRAY.x + 5 + col * 16, TRAY.y + 3.6 + row * 10.4];
});
export const TRAY_TOP = TRAY_H;

// ---------- the window desk and the visitors, front left ----------
const DESK = { x: -123, y: -28, w: 54, d: 14, r: 1.4 };
const DESK_H = 12;
const STAND = { x: -120, y: -22, w: 48, d: 1, z: DESK_H, h: 17 };
export const STAND_FACE = STAND.y + STAND.d;
export const CLERK = [-63, -22, 0];
export const WINDOW = [-100, -5];
export const QUEUE = [[-106, 2.4], [-112, 8.6], [-118, 14.2]];
export const EXIT = [-122, -11];

// ---------- the database engine, right ----------
const DB = { x: 38, y: -68, w: 80, d: 36, r: 1.6 };
const DB_H = 14;

// ---------- the tally bench, front right ----------
// to the right of the queue, so the one at the window and the line stay in view
const BENCH = { x: -68, y: 3, w: 186, d: 13, r: 1.4 };
const BENCH_H = 14;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [BOARD.x, BOARD.y, BOARD_H + 2], [VALS.x + VALS.w, VALS.y, VALS_H + 2], [CAB.x, CAB.y, CAB_H + 3]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 50 },
);

const { S, L, D } = shorthand(P);
// The smallest words on the machine use CAP, the counter-caption size of the other lessons (2.6 units there, at a
// plate scale within a few percent of this one).
export const CAP = 2.7;
// Every word on the machine is printed in the strong ink: the mid grey reads faint on the dark theme's faces.
const text = (x, y, z, words, size = CAP, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "hi", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + labelPlate(P, { x: -118, y: -64, w: 26, d: 12, r: 1.4 }, [[-114, -59.5, 16], [-114, -55.5, 11]]);
}

// The orders cabinet: three shops of six drawers each, the table's name and the account's reach on top.
function cabinet() {
  const out = [S(k.slabOf(CAB, 0, CAB_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(CAB, 2), CAB_H, P), { tone: "faint" }));
  ["A", "B", "C"].forEach((s, g) => out.push(text(GROUP_X[g], CAB_FRONT, 20.6, t("SHOP " + s, "TIENDA " + s), 3, { tone: "hi" })));
  out.push(plaque(P, { x: CAB.x + 6, y: CAB.y + 4, z: CAB_H, w: 26, d: 10, text: "orders", size: 4 }));
  return out.join("");
}
// A drawer, moved out by the live code when its row is returned (it re-sorts them so a pulled drawer covers the ones
// it stands in front of).
function drawer(i) {
  const { x, z } = DRAWER_AT[i];
  const plan = { x, y: CAB_FRONT - 0.4, w: DRAWER.w, d: 1.2, r: 0.3 };
  return `<g class="wb-lit-group" data-drawer="${i}">`
    + S(k.slabOf(plan, z, DRAWER.h, P, 2, 0.2), { tone: "hi", crease: "lo" })
    + S(k.slabOf({ x: x + DRAWER.w / 2 - 1.6, y: CAB_FRONT + 0.8, w: 3.2, d: 0.8, r: 0.2 }, z + DRAWER.h / 2 - 0.6, 1.2, P, 2), { tone: "mid", crease: "none" })
    + `</g>`;
}
// The row policy's shutter over one shop's drawers.
function shutter(g) {
  const plan = { x: GROUP_X[g] - 1, y: CAB_FRONT + 0.8, w: 3 * DRAWER.w + 2 * DRAWER.gap + 2, d: 1, r: 0.3 };
  const slats = [];
  for (let z = 4; z < 18; z += 3) slats.push(k.faceRectY(P, plan.x + 1, plan.x + plan.w - 1, plan.y + plan.d, z, z + 0.01));
  return `<g data-shutter="${g}" style="display:none">${S(k.slabOf(plan, 1.6, 16.8, P, 2, 0.2), { tone: "mid", crease: "lo" })}${L(slats.join(""), { tone: "lo" })}</g>`;
}

// The statement board: four lines of SQL, each one <text> the live code fills with tspans (the pasted words in
// their own tspan, over a lit strip), and the SYNTAX ERROR placard.
function board() {
  const out = [S(k.slabOf(BOARD, 0, BOARD_H, P, 3, 0.4), { tone: "mid", crease: "lo" })];
  out.push(L(k.faceRectY(P, BOARD.x + 2, BOARD.x + BOARD.w - 2, BOARD_FACE, 5, BOARD_H - 2), { tone: "faint" }));
  out.push(text(BOARD.x + 4, BOARD_FACE, BOARD_H - 6.6, t("STATEMENT", "SENTENCIA"), 3.4, { tone: "hi" }));
  // each line: a group in the face's plane holding the lit strip (a rect) and the text
  LINE_Z.forEach((z, i) => {
    const m = k.sideMatrix([LINE_X, BOARD_FACE], z, P, "left");
    out.push(`<g data-line="${i}" transform="${m}"><rect class="inj-strip" data-strip x="0" y="0" width="0" height="0"/><text class="iso-face-text inj-sql" data-tone="hi" font-size="${LINE_SIZE}"></text></g>`);
  });
  return out.join("");
}
// The values board: the parameters, one box each. Empty when the words are pasted into the statement.
function values() {
  const out = [S(k.slabOf(VALS, 0, VALS_H, P, 3, 0.4), { tone: "mid", crease: "lo" })];
  out.push(text(VALS.x + 3.4, VALS_FACE, VALS_H - 6.8, t("VALUES", "VALORES"), 3.4, { tone: "hi" }));
  VAL_Z.forEach((z, i) => {
    out.push(text(VALS.x + 3, VALS_FACE, z + 1.6, "$" + (i + 1), 3.2, { tone: "hi" }));
    const box = { x: VAL_BOX.x0, y: VALS_FACE, w: VAL_BOX.x1 - VAL_BOX.x0, d: 0.8, r: 0.3 };
    out.push(`<g class="wb-lit-group" data-val="${i}">${S(k.slabOf(box, z, VAL_BOX.h, P, 2, 0.2), { tone: "hi", crease: "lo" })}`
      + faceText(P, [box.x + 1.4, box.y + box.d, z + 1.7], "", { size: 3, tone: "hi", attr: `data-val-text="${i}"` }) + `</g>`);
  });
  return out.join("");
}

// The result tray: returned rows laid out in the order the database gave them.
function tray() {
  const out = [S(k.slabOf(TRAY, 0, TRAY_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(TRAY, 1.8), TRAY_H, P), { tone: "lo" }) })];
  out.push(text(TRAY.x + TRAY.w - 3, TRAY.y + TRAY.d, 1.2, t("RESULT, IN THE ORDER RETURNED", "RESULTADO, EN EL ORDEN DEVUELTO"), CAP, { anchor: "end" }));
  return out.join("");
}
// A result card, drawn at its place in the tray; the live code shows it, sets its value and lights it.
function resultCard(i) {
  const [x, y] = CARD_AT[i];
  return `<g class="wb-lit-group" data-card="${i}" style="display:none">${plaque(P, { x, y, z: TRAY_H, w: CARD.w, d: CARD.d, text: " ", size: 3.6, attr: `data-card-text="${i}"` })}</g>`;
}

// The window desk with the slip stand: what the visitor at the window typed.
function desk() {
  const out = [S(k.slabOf(DESK, 0, DESK_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(DESK, 2), DESK_H, P), { tone: "faint" }) })];
  const plan = { x: STAND.x, y: STAND.y, w: STAND.w, d: STAND.d, r: 0.3 };
  out.push(S(k.slabOf({ x: STAND.x + 4, y: STAND.y - 3, w: STAND.w - 8, d: 4, r: 0.4 }, DESK_H, 1, P, 2), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf(plan, DESK_H + 1, STAND.h, P, 2, 0.2), { tone: "hi", crease: "lo" }));
  const z0 = DESK_H + 1, f = STAND_FACE;
  // the shop comes from the visitor's session; a rule sets it apart from the two boxes they typed in
  out.push(text(STAND.x + 2.4, f, z0 + 12.6, t("SIGNED IN AS", "SESIÓN DE"), CAP));
  out.push(L(k.faceRectY(P, STAND.x + 2, STAND.x + STAND.w - 2, f, z0 + 11, z0 + 11.01), { tone: "lo" }));
  out.push(text(STAND.x + 2.4, f, z0 + 6.6, t("NAME", "NOMBRE"), CAP));
  out.push(text(STAND.x + 2.4, f, z0 + 1.8, t("SORT", "ORDEN"), CAP));
  const vx = STAND.x + 25;
  out.push(faceText(P, [vx, f, z0 + 12.6], "", { size: 3, tone: "hi", attr: 'data-slip="shop"' }));
  out.push(faceText(P, [vx, f, z0 + 6.6], "", { size: 3, tone: "hi", attr: 'data-slip="name"' }));
  out.push(faceText(P, [vx, f, z0 + 1.8], "", { size: 3, tone: "hi", attr: 'data-slip="sort"' }));
  return out.join("");
}

// The database: it parses the statement, plans it and runs it against the cabinet. The SYNTAX ERROR sign on top
// lights while it refuses a statement; its counters count refusals and statements whose shape the input changed.
function database() {
  const out = [S(k.slabOf(DB, 0, DB_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(DB, 2.4), DB_H, P), { tone: "faint" }));
  const front = DB.y + DB.d;
  out.push(counterWithWord(DB.x + 4, front, "errors", t("ERRORS", "ERRORES")));
  out.push(counterWithWord(DB.x + 40, front, "asCode", t("AS CODE", "COMO CÓDIGO")));
  out.push(plaque(P, { x: DB.x + 4, y: DB.y + 16, z: DB_H, w: 34, d: 10, text: t("DATABASE", "BASE DE DATOS"), size: 3.2 }));
  out.push(`<g data-reach="full">${plaque(P, { x: DB.x + 42, y: DB.y + 16, z: DB_H, w: 34, d: 10, text: t("ALL SHOPS", "TODAS"), size: 3.2 })}</g>`);
  out.push(`<g data-reach="rls" style="display:none">${plaque(P, { x: DB.x + 42, y: DB.y + 16, z: DB_H, w: 34, d: 10, text: t("OWN SHOP", "SU TIENDA"), size: 3.2 })}</g>`);
  // the error plaque, lying on the top: lit while the database refuses a statement
  out.push(`<g class="wb-lit-group" data-error>${plaque(P, { x: DB.x + 4, y: DB.y + 3, z: DB_H, w: 50, d: 10, text: t("SYNTAX ERROR", "ERROR DE SINTAXIS"), size: 3.2 })}</g>`);
  return out.join("");
}
// A three-wheel counter with its word above the housing, clear of it.
function counterWithWord(x, front, name, words) {
  return digitCounter(P, { x: x + 1, y: front, z: 1.8, count: 3, w: 4.2, h: 5.6, gap: 0.6, pad: 1, name })
    + text(x, front, 10.6, words, CAP);
}

// The tally bench at the front: what came back to the window.
export const TALLY = [
  ["requests", t("REQUESTS", "SOLICITUDES")],
  ["leaked", t("OTHER SHOPS' ROWS", "FILAS DE OTRAS TIENDAS")],
  ["unsorted", t("UNSORTED", "SIN ORDEN")],
  ["rejected", t("REJECTED", "RECHAZADOS")],
];
function bench() {
  const out = [S(k.slabOf(BENCH, 0, BENCH_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(BENCH, 2), BENCH_H, P), { tone: "faint" }));
  const front = BENCH.y + BENCH.d;
  const xs = [BENCH.x + 8, BENCH.x + 56, BENCH.x + 108, BENCH.x + 152];
  TALLY.forEach(([name, words], i) => out.push(counterWithWord(xs[i], front, name, words)));
  return out.join("");
}

// A visitor: a small figure, drawn at the origin and moved by the live code.
export const VISITOR = { scale: 0.6 };
export function visitorSvg() { return person(P, [0, 0, 0], { scale: VISITOR.scale }); }

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A records room on a base plate. At the back left, a cabinet of eighteen drawers is the orders table, six rows for each of three shops, A, B and C. At the back in the middle, a tall board shows the SQL statement the app sends, line by line; words a visitor typed are printed on a lit strip. At the back right, a values board holds the parameters $1, $2 and $3 in separate boxes, the visitor's words lit. In the middle, a result tray; the rows the statement returns slide out of the cabinet and appear as cards in it, in the order returned, each showing the value the list was sorted by; cards and drawers from another shop are lit. To the right of the tray, the database: a SYNTAX ERROR placard on its top lights when it refuses a statement, and counters on its front count errors and requests whose words became code. With the row policy on, shutters close over the other shops' drawers. At the front left, staff of the shops queue at a window desk with a clerk behind it; a stand on the desk shows the shop the visitor at the window is signed in as, and the name and sort column they typed. On a bench at the front right, counters count requests, rows from other shops, lists that came back unsorted and sort values rejected.",
      "Una sala de archivo sobre una placa base. Atrás a la izquierda, un mueble de dieciocho cajones es la tabla de pedidos, seis filas para cada una de tres tiendas, A, B y C. Atrás al medio, un tablero alto muestra la sentencia SQL que envía la app, línea por línea; las palabras que escribió un visitante van impresas sobre una franja encendida. Atrás a la derecha, un tablero de valores tiene los parámetros $1, $2 y $3 en casillas separadas, encendidas las palabras del visitante. En el medio, una bandeja de resultado; las filas que devuelve la sentencia salen del mueble y aparecen en ella como tarjetas, en el orden devuelto, cada una con el valor por el que se ordenó la lista; las tarjetas y los cajones de otra tienda se encienden. A la derecha de la bandeja, la base de datos: un cartel ERROR DE SINTAXIS en su parte de arriba se enciende cuando rechaza una sentencia, y contadores en su frente cuentan los errores y las solicitudes cuyas palabras se volvieron código. Con la política de filas activa, unas persianas cierran los cajones de las otras tiendas. Adelante a la izquierda, empleados de las tiendas hacen fila ante un mostrador con un empleado de la sala detrás; un atril sobre el mostrador muestra la tienda con la que inició sesión el visitante de la ventanilla, y el nombre y la columna de orden que escribió. En un banco adelante a la derecha, contadores cuentan solicitudes, filas de otras tiendas, listas que volvieron sin orden y órdenes rechazados.",
    ),
    body: [
      plate(),
      cabinet(),
      `<g data-drawers>${Array.from({ length: 18 }, (_, i) => drawer(i)).join("")}</g>`,
      [0, 1, 2].map(shutter).join(""),
      board(),
      values(),
      tray(),
      Array.from({ length: 18 }, (_, i) => resultCard(i)).join(""),
      database(),
      person(P, CLERK, { scale: 0.78, hat: "cap" }),
      desk(),
      `<g data-layer="visitors"></g>`,
      bench(),
    ],
  });
}

export const GEOMETRY = { DRAWER, DRAWER_AT, CAB_FRONT, LINE_SIZE, CARD_AT, WINDOW, QUEUE, EXIT, VISITOR };

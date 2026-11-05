// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A ledger room. At the back, on the DISK plinth, what survives a power cut: the cabinet of PAGES ON DISK (drawers A
// to F) and the shelf of the LOG ON DISK, whose books are the log records written since the last checkpoint (the
// pennant marks its redo point; TO REPLAY counts them). In the middle, the power box (POWER lever, KILL plunger), the
// OS CACHE tray with the FSYNC dial beside it, and the COMMITS board (ACKED, ON DISK, LOST). In front, the database's
// desk, its memory: the page cards A to F lying on it (a pennant on a page that is newer than its copy on disk) and the LOG BUFFER
// tray. The clients stand at the front right and send their commits to the desk. During recovery a clerk with a
// clipboard walks the shelf, replaying its books.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, person, figurine, dial, plaque, pennant, faceText, variants, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { PAGES, PAGE_NAMES } from "./sim";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -110, y: -82, w: 220, d: 124, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// ---------- the disk plinth, at the back ----------
const PLINTH = { x: -106, y: -78, w: 212, d: 32, r: 2 };
const PLINTH_H = 8;
const PLINTH_FRONT = PLINTH.y + PLINTH.d;            // -46
// the cabinet of pages on disk, back left
const CAB = { x: -102, y: -76, w: 78, d: 24, r: 1.4 };
const CAB_H = 32;
const CAB_FRONT = CAB.y + CAB.d;                      // -52
export const DRAWER = { w: 22, h: 12, gap: 3, z0: PLINTH_H + 3 };
export const drawerX = (i) => CAB.x + 4 + (i % 3) * (DRAWER.w + DRAWER.gap);
export const drawerZ = (i) => DRAWER.z0 + (i < 3 ? DRAWER.h + 2.5 : 0);
// the log shelf, back right: a back board, a shelf, and BOOKS books
const SHELF = { x: -16, y: -76, w: 120, d: 20, r: 1 };
export const BOOKS = 20;
export const BOOK = { w: 3.8, d: 12, h: 15, step: 5.3, x0: SHELF.x + 6, y: SHELF.y + 5, z: PLINTH_H + 2 };
const BOARD_TOP = PLINTH_H + 38;
// where the recovery clerk walks: in front of the books
export const CLERK_Y = PLINTH_FRONT - 5;
export const bookX = (i) => BOOK.x0 + i * BOOK.step + BOOK.w / 2;

// ---------- the middle row ----------
const POWER = { x: -100, y: -38, w: 44, d: 20, r: 1.4 };
const POWER_H = 9;
const OSC = { x: -40, y: -38, w: 70, d: 22, r: 1.4 };
const OSC_H = 10;
export const OS_TRAY = { x: OSC.x + 4, y: OSC.y + 4, w: 30, d: 14, z: OSC_H };
const DIAL_AT = [OSC.x + OSC.w - 14, OSC.y + 11];
const BOARD = { x: 36, y: -26, w: 70, d: 3, r: 0.6 };
const BOARD_Z = 4, BOARD_H = 28;

// ---------- the desk, in front ----------
const DESK = { x: -102, y: 6, w: 134, d: 24, r: 2 };
const DESK_H = 10;
const DESK_FRONT = DESK.y + DESK.d;                   // 28
export const CARD = { w: 11, d: 10, step: 13, x0: DESK.x + 6, y: DESK.y + 4 };
export const cardX = (i) => CARD.x0 + i * CARD.step;
export const LOG_TRAY = { x: DESK.x + 92, y: DESK.y + 3, w: 34, d: 14, z: DESK_H };

// ---------- clients, front right ----------
export const CLIENT_AT = [[52, 4], [64, 2], [76, 0], [88, -2], [58, 18], [70, 16], [82, 14], [94, 12]];

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [CAB.x, CAB.y, CAB_H + PLINTH_H + 2], [SHELF.x + SHELF.w, SHELF.y, BOARD_TOP + 1], [CLIENT_AT[3][0], CLIENT_AT[3][1], 14]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

const { S, L } = shorthand(P);
const words = (x, y, z, w, size = 3, opts = {}) => faceText(P, [x, y, z], w, { size, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H });
}

// ---------- disk ----------
function plinth() {
  const out = [S(k.slabOf(PLINTH, 0, PLINTH_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(PLINTH, 2), PLINTH_H, P), { tone: "faint" }));
  return out.join("");
}
function cabinet() {
  const out = [S(k.slabOf(CAB, PLINTH_H, CAB_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(CAB, 2), PLINTH_H + CAB_H, P), { tone: "faint" }) })];
  out.push(words(CAB.x + CAB.w / 2, CAB.y + CAB.d - 6, PLINTH_H + CAB_H, t("PAGES ON DISK", "PÁGINAS EN DISCO"), 3.6, { face: "top", tone: "hi", anchor: "middle" }));
  for (let i = 0; i < PAGES; i++) out.push(drawer(i));
  return out.join("");
}
// a drawer front: "in" flush with the cabinet, "out" pulled 5 units while the checkpoint writes that page
function drawerAt(i, dy) {
  const x = drawerX(i), z = drawerZ(i), y = CAB_FRONT + dy;
  const plan = { x, y: y - 1, w: DRAWER.w, d: 1.4 + (dy > 0 ? dy : 0), r: 0.4 };
  const out = [S(k.slabOf(plan, z, DRAWER.h, P, 2, 0.2), { tone: "hi", crease: "lo" })];
  out.push(faceText(P, [x + 6, y + 0.4, z + 3.4], PAGE_NAMES[i], { size: 6, tone: "hi", anchor: "middle" }));
  out.push(L(k.segment([x + 12, y + 0.4, z + 6], [x + 19, y + 0.4, z + 6], P), { tone: "mid" }));
  return out.join("");
}
function drawer(i) {
  return variants("drawer-" + i, { in: drawerAt(i, 0), out: drawerAt(i, 5) }, "in");
}
function shelf() {
  const out = [];
  const back = { x: SHELF.x, y: SHELF.y, w: SHELF.w, d: 3, r: 0.4 };
  out.push(S(k.slabOf(back, PLINTH_H, BOARD_TOP - PLINTH_H, P, 2, 0.3), { tone: "mid", crease: "lo" }));
  const face = back.y + back.d;
  out.push(L(k.faceRectY(P, back.x + 2, back.x + back.w - 2, face, BOOK.z + BOOK.h + 2, BOARD_TOP - 2), { tone: "faint" }));
  out.push(words(back.x + 5, face, BOARD_TOP - 8.6, t("LOG ON DISK", "LOG EN DISCO"), 3.8, { tone: "hi" }));
  // TO REPLAY: the records recovery would replay now
  const cx = back.x + back.w - 40;
  out.push(digitCounter(P, { x: cx, y: face, z: BOOK.z + BOOK.h + 4, count: 5, w: 4.6, h: 6.4, gap: 0.6, pad: 1, name: "replay" }));
  out.push(words(cx - 3, face, BOOK.z + BOOK.h + 6, t("TO REPLAY", "POR REHACER"), 3, { anchor: "end" }));
  // the shelf board the books stand on
  const board = { x: SHELF.x, y: SHELF.y + 3, w: SHELF.w, d: SHELF.d - 3, r: 0.6 };
  out.push(S(k.slabOf(board, PLINTH_H, 2, P, 2, 0.3), { tone: "mid", crease: "none" }));
  // the redo point: a pennant at the left end
  out.push(pennant(P, { x: SHELF.x + 3, y: BOOK.y + BOOK.d / 2, z: BOOK.z, height: 19, length: 7, drop: 5 }));
  // the books, hidden until the log has records since the checkpoint
  for (let i = 0; i < BOOKS; i++) {
    const x = BOOK.x0 + i * BOOK.step;
    const plan = { x, y: BOOK.y, w: BOOK.w, d: BOOK.d, r: 0.4 };
    const h = BOOK.h - (i % 3) * 1.2;
    out.push(`<g class="wb-lit-group" data-book="${i}" style="display:none">${S(k.slabOf(plan, BOOK.z, h, P, 2, 0.2), { tone: "hi", crease: "lo" })}`
      + L(k.segment([x + 0.6, BOOK.y + BOOK.d, BOOK.z + h - 3], [x + BOOK.w - 0.6, BOOK.y + BOOK.d, BOOK.z + h - 3], P), { tone: "faint" }) + `</g>`);
  }
  return out.join("");
}
function clerk() {
  return `<g data-clerk style="display:none"><g class="wb-lit-group" data-clerk-body>${litFill(person(P, [0, 0, 0], { scale: 0.85, holding: "clipboard" }))}</g></g>`;
}

// ---------- middle row ----------
function powerBox() {
  const out = [S(k.slabOf(POWER, 0, POWER_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(POWER, 1.8), POWER_H, P), { tone: "faint" }));
  const face = POWER.y + POWER.d;
  // the lever: a slot and a handle, up (on) or down (off)
  const lx = POWER.x + 13, ly = POWER.y + 10;
  out.push(S(k.slabOf({ x: lx - 6, y: ly - 3, w: 12, d: 6, r: 0.6 }, POWER_H, 2, P, 2, 0.2), { tone: "lo", crease: "none" }));
  const lever = (up) => {
    const tip = up ? [lx, ly - 5, POWER_H + 12] : [lx, ly + 7, POWER_H + 5];
    const rod = L(k.segment([lx, ly, POWER_H + 2], tip, P), { tone: "hi" }).replace('class="iso-line', 'stroke-width="2.4" class="iso-line');
    return rod + S(k.cylinder(tip[0], tip[1], 2.2, tip[2] - 1, 2.4, P, 16, 0.4), { tone: "hi", crease: "lo" });
  };
  out.push(variants("lever", { on: lever(true), off: lever(false) }, "on"));
  out.push(words(lx, face, 3, t("POWER", "ENERGÍA"), 3, { anchor: "middle", tone: "hi" }));
  // the KILL plunger
  const px = POWER.x + 33, py = POWER.y + 10;
  out.push(S(k.cylinder(px, py, 4.2, POWER_H, 1.6, P, 24), { tone: "lo" }));
  const plunger = (h) => S(k.cylinder(px, py, 1.2, POWER_H + 1.6, h, P, 12), { tone: "mid", crease: "none" }) + S(k.cylinder(px, py, 3.2, POWER_H + 1.6 + h, 2, P, 24, 0.5), { tone: "hi", crease: "lo" });
  out.push(variants("plunger", { up: plunger(5), down: plunger(1) }, "up"));
  out.push(words(px, face, 3, t("KILL", "MATAR"), 3, { anchor: "middle", tone: "hi" }));
  return out.join("");
}
// a tray with a rim and up to 10 sheets; the stack's sheets are shown by the live code
export const SHEETS = 10;
function tray(name, plan) {
  const out = [S(k.slabOf({ x: plan.x, y: plan.y, w: plan.w, d: plan.d, r: 1 }, plan.z, 1, P, 3, 0.3), { tone: "lo", crease: "none" })];
  out.push(L(k.planOutline(k.insetPlan({ x: plan.x, y: plan.y, w: plan.w, d: plan.d, r: 1 }, 1.2), plan.z + 1, P), { tone: "mid" }));
  const sheet = { x: plan.x + 3, y: plan.y + 2.2, w: plan.w - 6, d: plan.d - 4.4, r: 0.4 };
  for (let i = 0; i < SHEETS; i++) {
    out.push(`<g class="wb-lit-group" data-sheet="${name}-${i}" style="display:none">${litFill(S(k.slabOf(sheet, plan.z + 1 + i * 1.05, 0.8, P, 2, 0.1), { tone: "hi", crease: "none" }))}</g>`);
  }
  return out.join("");
}
function osCache() {
  const out = [S(k.slabOf(OSC, 0, OSC_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(OSC, 1.8), OSC_H, P), { tone: "faint" }));
  out.push(tray("os", OS_TRAY));
  const face = OSC.y + OSC.d;
  out.push(words(OSC.x + 4, face, 3.4, t("OS CACHE", "CACHÉ DEL SO"), 3.2, { tone: "hi" }));
  out.push(digitCounter(P, { x: OSC.x + OSC.w - 26, y: face, z: 1.8, count: 4, w: 4.4, h: 6, gap: 0.6, pad: 0.9, name: "os" }));
  // the FSYNC dial: its needle sweeps once per flush to disk
  out.push(dial(P, { x: DIAL_AT[0], y: DIAL_AT[1], z: OSC_H, r: 9.5, h: 4, ticks: 40, every: 5, name: "fsync", value: 0 }));
  out.push(faceText(P, [DIAL_AT[0], DIAL_AT[1] + 5.4, OSC_H + 4.1], "FSYNC", { face: "top", size: 3, tone: "mid", anchor: "middle" }));
  return out.join("");
}
function board() {
  const face = BOARD.y + BOARD.d, z0 = BOARD_Z, top = BOARD_Z + BOARD_H, x1 = BOARD.x + BOARD.w;
  const out = [];
  for (const x of [BOARD.x + 5, x1 - 5]) out.push(S(k.cylinder(x, BOARD.y + 1.5, 1.1, 0, z0, P, 12), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf(BOARD, z0, BOARD_H, P, 3, 0.4), { tone: "mid", crease: "lo" }));
  out.push(L(k.faceRectY(P, BOARD.x + 2, x1 - 2, face, z0 + 2, top - 2), { tone: "faint" }));
  out.push(words(BOARD.x + 4.5, face, top - 6.4, t("COMMITS", "COMMITS"), 3.4, { tone: "hi" }));
  const cnt = (x, name, w) => digitCounter(P, { x, y: face, z: z0 + 4, count: 4, w: 4.2, h: 6.4, gap: 0.5, pad: 0.9, name })
    + words(x + 9.15, face, z0 + 13.2, w, 2.8, { anchor: "middle" });
  out.push(cnt(BOARD.x + 4, "acked", t("ACKED", "CONFIRMADOS")));
  out.push(cnt(BOARD.x + 27, "ondisk", t("ON DISK", "EN DISCO")));
  out.push(cnt(BOARD.x + 50, "lost", t("LOST", "PERDIDOS")));
  return out.join("");
}

// ---------- the desk ----------
function desk() {
  const out = [S(k.slabOf(DESK, 0, DESK_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(DESK, 2.4), DESK_H, P), { tone: "faint" }));
  out.push(words(DESK.x + 5, DESK_FRONT, 4, t("PAGES IN MEMORY", "PÁGINAS EN MEMORIA"), 3.4, { tone: "hi" }));
  out.push(words(LOG_TRAY.x + 7, DESK_FRONT, 4, t("LOG BUFFER", "BÚFER DEL LOG"), 3.2, { tone: "hi", anchor: "end" }));
  out.push(digitCounter(P, { x: LOG_TRAY.x + 10, y: DESK_FRONT, z: 2, count: 4, w: 4.4, h: 6, gap: 0.6, pad: 0.9, name: "buffer" }));
  out.push(tray("buf", LOG_TRAY));
  // the page cards: a pennant on top while the page is dirty (newer than on disk)
  for (let i = 0; i < PAGES; i++) {
    const x = cardX(i), plan = { x, y: CARD.y, w: CARD.w, d: CARD.d, r: 0.6 };
    out.push(`<g class="wb-lit-group" data-card="${i}">${S(k.slabOf(plan, DESK_H, 1.2, P, 2, 0.2), { tone: "hi", crease: "lo" })}`
      + faceText(P, [x + CARD.w / 2, CARD.y + CARD.d / 2 + 2.2, DESK_H + 1.2], PAGE_NAMES[i], { face: "top", size: 6, tone: "hi", anchor: "middle" }) + `</g>`);
    out.push(`<g data-dirty="${i}" style="display:none">${pennant(P, { x: x + 1.4, y: CARD.y + 1.4, z: DESK_H + 1.2, height: 5.5, length: 4.5, drop: 3 })}</g>`);
  }
  return out.join("");
}
function clients() {
  const out = CLIENT_AT.map(([x, y], i) => `<g data-client="${i}"${i < 4 ? "" : ' style="display:none"'}>${figurine(P, [x, y, 0], { scale: 0.95 })}</g>`);
  out.push(plaque(P, { x: 58, y: 24, w: 40, d: 10 }));
  out.push(faceText(P, [78, 24 + 7, 0.8], t("4 CLIENTS", "4 CLIENTES"), { face: "top", size: 4, tone: "hi", anchor: "middle", attr: "data-clients" }));
  return out.join("");
}

// A commit slip, drawn at the origin and moved with translateAlong.
export function slipSvg() {
  const plan = { x: -3, y: -0.3, w: 6, d: 0.6, r: 0.15 };
  return S(k.slabOf(plan, 0, 4.4, P, 2, 0.15), { tone: "hi", crease: "lo" });
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A ledger room on a base plate. At the back, a plinth marked DISK holds what survives a power cut: a cabinet of PAGES ON DISK with drawers A to F, and a shelf labelled LOG ON DISK whose books are the log records flushed since the last checkpoint; a pennant at its left end marks the checkpoint's redo point, and a TO REPLAY counter shows how many records recovery would replay. In the middle stand a power box with a POWER lever and a KILL plunger, an OS CACHE tray holding records handed to the operating system but not yet flushed, with an FSYNC dial whose needle sweeps on every flush, and a COMMITS board counting ACKED commits, commits ON DISK and acknowledged commits LOST in the last crash. In front, the database's desk holds its memory: page cards A to F, each with a pennant while it is newer than its copy on disk, and a LOG BUFFER tray. Sheets stacked in the trays are lit while they hold commits that were already acknowledged. Clients at the front right send their commits to the desk. During recovery a clerk with a clipboard walks along the shelf, replaying its books.",
      "Una sala de libros contables sobre una placa base. Al fondo, una plataforma marcada DISCO tiene lo que sobrevive a un corte de energía: un gabinete de PÁGINAS EN DISCO con cajones de la A a la F, y un estante rotulado LOG EN DISCO cuyos libros son los registros del log escritos en disco desde el último checkpoint; un banderín en su extremo izquierdo marca el punto de rehacer (redo point) del checkpoint, y un contador POR REHACER muestra cuántos registros reproduciría la recuperación. En el medio hay una caja de energía con una palanca ENERGÍA y un pulsador MATAR, una bandeja CACHÉ DEL SO con los registros entregados al sistema operativo pero aún no escritos en disco, con un dial FSYNC cuya aguja da una vuelta en cada escritura a disco, y un tablero COMMITS que cuenta los commits CONFIRMADOS, los commits EN DISCO y los commits confirmados PERDIDOS en la última caída. Adelante, el escritorio de la base de datos tiene su memoria: tarjetas de página de la A a la F, cada una con un banderín mientras es más nueva que su copia en disco, y una bandeja BÚFER DEL LOG. Las hojas apiladas en las bandejas se encienden mientras tienen commits ya confirmados. Los clientes, adelante a la derecha, mandan sus commits al escritorio. Durante la recuperación, un empleado con un portapapeles recorre el estante y reproduce sus libros.",
    ),
    body: [
      plate(),
      plinth(),
      cabinet(),
      shelf(),
      clerk(),
      powerBox(),
      osCache(),
      board(),
      desk(),
      `<g data-layer="slips"></g>`,
      clients(),
    ],
  });
}

export const GEOMETRY = {
  BOOK, BOOKS, CLERK_Y, CARD, LOG_TRAY, OS_TRAY, DESK_H, CLIENT_AT, SHEETS, DRAWER,
  bookXs: Array.from({ length: BOOKS }, (_, i) => bookX(i)),
  cardXs: Array.from({ length: PAGES }, (_, i) => cardX(i)),
  PLINTH_H,
};

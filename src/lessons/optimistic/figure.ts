// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A front counter and a records office. At the front, the user and the counter: the like button they tap (lit when
// their last tap asked for a like) and the screen, a monitor whose LIKE pill is what the app shows. At the back, the
// records office, the server: its board shows the value it has stored. Between them runs a walkway: couriers carry
// each save (a slip, lit when it sets the like) out to the office window, wait there while the server works, and
// walk back with the answer. Answers the app ignores, and refetches it cancels, go into the IGNORED bin.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, labelPlate, digitCounter, lamp, person, figurine, plaque, faceText, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -80, y: -124, w: 166, d: 212, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The records office (the server), at the back.
const OFFICE = { x: -62, y: -118, w: 112, d: 36, r: 2 };
const OFFICE_H = 12;
const OFFICE_FRONT = OFFICE.y + OFFICE.d;
const BOARD = { x: -44, y: -106, w: 56, d: 4, r: 0.6 };
const BOARD_H = 30;

// The walkway: out on the left lane, back on the right one.
const WALK = { x: -32, y: OFFICE_FRONT + 4, w: 72, d: 0, r: 1 };
export const LANES = { out: -9, back: 17 };
export const WINDOW_Y = OFFICE_FRONT + 9;               // where couriers wait while the server works
export const SLOT_X = [-26, -14, -2, 10, 22, 34];
export const ENTER_Y = 8;                             // where couriers come out from behind the counter

// The front counter (the client).
const COUNTER = { x: -62, y: 20, w: 124, d: 40, r: 2 };
const COUNTER_H = 12;
const COUNTER_FRONT = COUNTER.y + COUNTER.d;
const MONITOR = { x: -62, y: 27, w: 50, d: 4, r: 0.6 };
const MONITOR_H = 30;
const SCREEN_FACE = MONITOR.y + MONITOR.d;
export const BUTTON = [-46, 50];
export const USER = [-48, 74, 0];
export const BIN = { x: 47, y: -22, w: 32, d: 16, r: 1.4 };
const BIN_H = 7;
export const BIN_SPOT = [BIN.x + BIN.w / 2, BIN.y + BIN.d / 2, BIN_H];
const SYNC = { x: 48, y: -66, w: 28, d: 16, r: 1.4 };
const SYNC_H = 7;

WALK.d = ENTER_Y + 4 - WALK.y;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(BOARD, OFFICE_H, OFFICE_H + BOARD_H + 2), ...k.boxCorners(MONITOR, COUNTER_H, COUNTER_H + MONITOR_H + 6), [USER[0], USER[1], 30]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 50 },
);

const { S, L, D } = shorthand(P);
const text = (x, y, z, words, size = 2.4, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });
const LIKE = t("LIKE", "ME GUSTA");

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + labelPlate(P, { x: 50, y: 66, w: 24, d: 12, r: 1.4 }, [[54, 70, 16], [54, 74, 10]]);
}

// A pill on a vertical +y face: the like button as the screen draws it, and the server's record of it. Lit = liked.
function pill(x, y, z, w, h, name, size) {
  const plan = { x, y, w, d: 1.4, r: 0.5 };
  return `<g class="wb-lit-group" data-pill="${name}">`
    + S(k.slabOf(plan, z, h, P, 3, 0.3), { tone: "hi", crease: "lo" })
    + faceText(P, [x + w / 2, y + 1.4, z + h * 0.32], LIKE, { size, tone: "hi", anchor: "middle" })
    + `</g>`;
}

// ---------- the records office ----------
function office() {
  const out = [S(k.slabOf(OFFICE, 0, OFFICE_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(OFFICE, 2.4), OFFICE_H, P), { tone: "faint" }));
  // the window: a counter ledge on the front face where couriers wait
  out.push(S(k.slabOf({ x: SLOT_X[0] - 6, y: OFFICE_FRONT, w: SLOT_X[5] - SLOT_X[0] + 12, d: 3, r: 0.5 }, 7, 1.6, P, 2), { tone: "hi", crease: "lo" }));
  // the writes counter on the right face
  const side = OFFICE.x + OFFICE.w;
  out.push(digitCounter(P, { x: side, y: OFFICE_FRONT - 4, z: 3.4, count: 3, face: "x", w: 4, h: 5.2, gap: 0.5, pad: 1, name: "writes" }));
  out.push(faceText(P, [side, OFFICE_FRONT - 19.4, 4.6], t("WRITES", "ESCRITURAS"), { face: "x", size: 2.4, tone: "mid" }));
  return out.join("");
}
function board() {
  const out = [S(k.slabOf(BOARD, OFFICE_H, BOARD_H, P, 3, 0.4), { tone: "mid", crease: "lo" })];
  const face = BOARD.y + BOARD.d;
  out.push(L(k.faceRectY(P, BOARD.x + 2, BOARD.x + BOARD.w - 2, face, OFFICE_H + 2, OFFICE_H + BOARD_H - 2), { tone: "faint" }));
  out.push(text(BOARD.x + 4, face, OFFICE_H + BOARD_H - 7.6, t("SERVER", "SERVIDOR"), 3.6));
  out.push(text(BOARD.x + BOARD.w - 4, face, OFFICE_H + BOARD_H - 7.6, t("STORED", "GUARDADO"), 2.8, { anchor: "end" }));
  out.push(pill(BOARD.x + 12, face, OFFICE_H + 6, 32, 10, "server", 4.4));
  return out.join("");
}

// ---------- the walkway ----------
function walkway() {
  const out = [S(k.slabOf(WALK, 0, 0.8, P, 3, 0.2), { tone: "lo", crease: "none" })];
  // the lane divider, dashed
  const dash = [];
  for (let y = WALK.y + 4; y < WALK.y + WALK.d - 4; y += 8) dash.push(k.lineOnTop([WALK.x + WALK.w / 2, y], [WALK.x + WALK.w / 2, Math.min(y + 4, WALK.y + WALK.d - 4)], 0.8, P));
  out.push(L(dash.join(""), { tone: "mid" }));
  // chevrons: out toward the office on the left lane, back toward the counter on the right one
  const chev = [];
  for (let y = WALK.y + 24; y < WALK.y + WALK.d - 12; y += 34) {
    chev.push(k.onTop([[LANES.out - 4, y + 3], [LANES.out, y - 1], [LANES.out + 4, y + 3]], 0.8, P));
    chev.push(k.onTop([[LANES.back - 4, y - 3], [LANES.back, y + 1], [LANES.back + 4, y - 3]], 0.8, P));
  }
  out.push(L(chev.join(""), { tone: "mid" }));
  return out.join("");
}

// The out-of-sync lamp: lit when nothing is in flight and the screen and the server disagree.
function syncPost() {
  const out = [S(k.slabOf(SYNC, 0, SYNC_H, P, 3, 0.5), { tone: "mid" })];
  const p = [SYNC.x + SYNC.w / 2, SYNC.y + SYNC.d / 2, SYNC_H];
  out.push(`<g data-sync="off">${lamp(P, p, { r: 3 })}</g><g data-sync="on" style="display:none">${litFill(lamp(P, p, { r: 3, lit: true }))}</g>`);
  out.push(text(SYNC.x + SYNC.w / 2, SYNC.y + SYNC.d, 2.2, t("OUT OF SYNC", "DESFASE"), 2.8, { anchor: "middle" }));
  return out.join("");
}

function bin() {
  const out = [S(k.slabOf(BIN, 0, BIN_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(BIN, 2), BIN_H, P), { tone: "lo" }) })];
  const front = BIN.y + BIN.d;
  out.push(digitCounter(P, { x: BIN.x + 3, y: front, z: 1.2, count: 2, w: 3.8, h: 4.6, gap: 0.5, pad: 0.8, name: "ignored" }));
  out.push(text(BIN.x + 13.4, front, 2.2, t("IGNORED", "IGNORADAS"), 2.6));
  return out.join("");
}

// ---------- the front counter ----------
function counter() {
  const out = [S(k.slabOf(COUNTER, 0, COUNTER_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(COUNTER, 2.4), COUNTER_H, P), { tone: "faint" }));
  // counters on the front face, each followed by its word
  const col = (x, name, count, words) => digitCounter(P, { x, y: COUNTER_FRONT, z: 3.4, count, w: 4, h: 5.2, gap: 0.5, pad: 1, name })
    + text(x + count * 4.5 + 1.6, COUNTER_FRONT, 4.6, words, 2.8);
  out.push(col(-36, "taps", 3, t("TAPS", "TOQUES")));
  out.push(col(-2, "notSaved", 2, t("NOT SAVED", "NO GUARDADOS")));
  out.push(col(38, "late", 2, t("TOO LATE", "TARDE")));
  return out.join("");
}
// The like button the user taps: lit when their last tap asked for a like.
export function buttonCapSvg() {
  const [x, y] = BUTTON;
  return `<g class="wb-lit-group" data-button>${S(k.cylinder(x, y, 3.6, COUNTER_H + 1.4, 2.4, P, 28, 0.5), { tone: "hi", crease: "lo" })}</g>`;
}
function button() {
  const [x, y] = BUTTON;
  return S(k.cylinder(x, y, 5, COUNTER_H, 1.4, P, 32, 0.3), { tone: "mid" })
    + `<g data-cap>${buttonCapSvg()}</g>`
    + plaque(P, { x: x + 7, y: y - 4, z: COUNTER_H, w: 22, d: 8, text: t("YOUR TAP", "TU TOQUE"), size: 3 });
}
function monitor() {
  const out = [S(k.slabOf({ x: MONITOR.x + MONITOR.w / 2 - 6, y: MONITOR.y - 3, w: 12, d: 8, r: 1 }, COUNTER_H, 1.6, P, 3, 0.3), { tone: "lo" })];
  out.push(S(k.slabOf(MONITOR, COUNTER_H + 1.6, MONITOR_H, P, 3, 0.4), { tone: "mid", crease: "lo" }));
  const z0 = COUNTER_H + 1.6, top = z0 + MONITOR_H;
  out.push(L(k.faceRectY(P, MONITOR.x + 2, MONITOR.x + MONITOR.w - 2, SCREEN_FACE, z0 + 2, top - 2), { tone: "faint" }));
  out.push(text(MONITOR.x + 4, SCREEN_FACE, top - 7.6, t("SCREEN", "PANTALLA"), 3.6));
  out.push(text(MONITOR.x + MONITOR.w - 4, SCREEN_FACE, top - 7.6, t("SAVING", "GUARDANDO"), 2.8, { anchor: "end" }));
  out.push(pill(MONITOR.x + 9, SCREEN_FACE, z0 + 10.4, 32, 10, "screen", 4.4));
  // the toast: lit when the app tells the user a save failed
  const toast = { x: MONITOR.x + 6, y: SCREEN_FACE, w: MONITOR.w - 12, d: 1, r: 0.4 };
  out.push(`<g class="wb-lit-group" data-toast style="display:none">${S(k.slabOf(toast, z0 + 3.4, 6, P, 2, 0.2), { tone: "hi", crease: "lo", lit: true })}`
    + faceText(P, [toast.x + toast.w / 2, toast.y + 1, z0 + 5.2], t("NOT SAVED", "NO SE GUARDÓ"), { size: 3, tone: "hi", anchor: "middle" }) + `</g>`);
  // the saving lamp on top
  const p = [MONITOR.x + MONITOR.w - 7, MONITOR.y + 2, top];
  out.push(`<g data-saving="off">${lamp(P, p, { r: 2.2 })}</g><g data-saving="on" style="display:none">${litFill(lamp(P, p, { r: 2.2, lit: true }))}</g>`);
  return out.join("");
}
function user() {
  return person(P, USER, { scale: 1.15 });
}

// A courier: a small figure carrying a slip on its front, drawn at the origin and moved with translateAlong. The slip
// lights when what it carries is a like; its one <text> is set by the live code (#12, GET, ERR).
export const COURIER = { scale: 0.95, slip: { w: 8.4, h: 5.6, z: 3.8 } };
export function courierSvg() {
  const s = COURIER.scale, c = COURIER.slip;
  const fig = figurine(P, [0, 0, 0], { scale: s });
  const plan = { x: -c.w / 2, y: 2.6 * s + 0.4, w: c.w, d: 0.6, r: 0.15 };
  const slip = `<g class="wb-lit-group" data-slip>${S(k.slabOf(plan, c.z, c.h, P, 2, 0.15), { tone: "hi", crease: "none" })}`
    + faceText(P, [0, plan.y + plan.d, c.z + 1.6], "#0", { size: 3, tone: "hi", anchor: "middle", attr: "data-slip-text" }) + `</g>`;
  return fig + slip;
}
// A slip alone, falling into the bin.
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
      "A front counter and a records office on a base plate. At the front, a person stands at the counter with a like button in front of them; it lights when their last tap asked for a like. On the counter, a monitor, the screen, shows a LIKE pill, lit when the app shows the post as liked, a SAVING lamp and a NOT SAVED notice. At the back, the records office, the server, has a board with the same pill, lit when the server has stored a like, and a counter of writes. Between them runs a walkway: small couriers carry each save out on the left lane to the server window, wait there while the server works, and come back on the right lane with the answer; a slip they carry lights when it sets the like. Answers the app ignores go into the IGNORED bin. A lamp lights when nothing is in flight and the screen and the server disagree. Counters on the front of the counter show taps, failures the user was told about, and failures they had already moved on from.",
      "Un mostrador y una oficina de registros sobre una placa base. Adelante, una persona está frente al mostrador con un botón de like; se enciende cuando su último toque pidió un like. Sobre el mostrador, un monitor, la pantalla, muestra una pastilla ME GUSTA, encendida cuando la app muestra la publicación con like, una lámpara GUARDANDO y un aviso NO SE GUARDÓ. Al fondo, la oficina de registros, el servidor, tiene un tablero con la misma pastilla, encendida cuando el servidor guardó un like, y un contador de escrituras. Entre ambos corre un pasillo: pequeños mensajeros llevan cada guardado por el carril izquierdo hasta la ventanilla del servidor, esperan ahí mientras el servidor trabaja y vuelven por el carril derecho con la respuesta; el papel que llevan se enciende cuando pone el like. Las respuestas que la app ignora caen en el cajón IGNORADAS. Una lámpara se enciende cuando no hay nada en vuelo y la pantalla y el servidor no coinciden. Contadores al frente del mostrador muestran los toques, los fallos que se le avisaron al usuario y los fallos de los que ya había seguido de largo.",
    ),
    body: [
      plate(),
      office(),
      board(),
      walkway(),
      `<g data-layer="walk"></g>`,
      syncPost(),
      bin(),
      `<g data-layer="bin"></g>`,
      counter(),
      monitor(),
      button(),
      user(),
    ],
  });
}

export const GEOMETRY = { LANES, WINDOW_Y, SLOT_X, ENTER_Y, BIN_SPOT, BUTTON, COUNTER_H };

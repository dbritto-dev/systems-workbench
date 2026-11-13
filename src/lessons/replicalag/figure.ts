// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A main ledger and two copy desks. On the left, the leader: the ledger where every write is entered, its LSN counter
// on the front, the users who write to it standing by. Two conveyors carry a slip for each entry, in order, to the
// copy desks, followers A and B; at each desk the slips wait in line on a tray and are copied one at a time into
// the desk's own ledger, and the counters on the desk's front say how far it has got (AT) and how old the oldest
// entry it hasn't copied yet is (LAG); a "+N" tag counts the slips the tray has no room to show. On every node a row of
// four slots holds the leader's newest writes by name (W812…): a raised block once the node has the write in its
// ledger, a flat tile while it waits on a desk's tray, a dashed slot while it hasn't arrived. Crash the leader and its
// sign reads DOWN, the follower with the most of the log becomes the leader, and the blocks only the dead leader held
// are crossed out. Your own latest save is lit: its slip, its blocks, and the lamp on each desk that has copied it. In
// front, you, and the board that shows what
// you wrote, what your last read saw and where it was served, over the share of read-backs that missed the user's
// save (MISSING) and of second reads that went back (WENT BACK), for every user.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, labelPlate, digitCounter, lamp, person, figurine, plaque, faceText, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -98, y: -134, w: 182, d: 186, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The leader: the main ledger.
const LEAD = { x: -90, y: -126, w: 48, d: 96, r: 2 };
const LEAD_H = 17;
const LEAD_FRONT = LEAD.y + LEAD.d;
const LEAD_RIGHT = LEAD.x + LEAD.w;

// The copy desks (followers), A in front, B at the back.
export const DESK_W = 58, DESK_D = 38, DESK_H = 15;
export const DESKS = [{ x: 18, y: -70 }, { x: 18, y: -128 }].map((d) => ({ ...d, w: DESK_W, d: DESK_D, r: 2 }));
export const BELT_Y = DESKS.map((d) => d.y + d.d / 2);       // each conveyor runs along its desk's middle
export const BELT = { x0: LEAD_RIGHT, x1: DESKS[0].x, w: 8, z: DESK_H };
export const QUEUE = { x0: DESKS[0].x + 3, step: 2.8, slots: 10 };  // slips waiting on the desk's tray; the next to copy is last
export const BOOK = { dx: 32, w: 16, d: 14 };            // the desk's copy of the ledger, on its top
// The rows of named writes: four slots on each node's top, the leader's newest four writes, oldest on the left.
export const SLOTS = 4;
export const SLOT = { w: 10, d: 6.4, h: 2.2, gap: 1, size: 3.4, small: 2.8 };
const SLOT_SPAN = SLOTS * SLOT.w + (SLOTS - 1) * SLOT.gap;
export const ROWS = {
  L: { x: LEAD.x + (LEAD.w - SLOT_SPAN) / 2, y: LEAD_FRONT - 11, z: LEAD_H },
  0: { x: DESKS[0].x + 2, y: DESKS[0].y + 30, z: DESK_H },
  1: { x: DESKS[1].x + 2, y: DESKS[1].y + 30, z: DESK_H },
};

// In front: you, and your board.
export const YOU = [-34, 34, 0];
const BOARD = { x: 2, y: 12, w: 78, d: 16, r: 1.6 };
const BOARD_H = 9;
const SCREEN = { x: 7, y: 16, w: 68, d: 3, r: 0.5 };
const SCREEN_H = 22;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(LEAD, 0, LEAD_H + 14), ...k.boxCorners(DESKS[1], 0, DESK_H + 11), ...k.boxCorners(SCREEN, BOARD_H, BOARD_H + SCREEN_H + 2), [YOU[0], YOU[1], 30]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 50 },
);

const { S, L } = shorthand(P);
const text = (x, y, z, words, size = 2.6, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });
const sideText = (x, y, z, words, size = 2.6, opts = {}) => faceText(P, [x, y, z], words, { face: "x", size, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + labelPlate(P, { x: -92, y: 32, w: 26, d: 12, r: 1.4 }, [[-88, 36, 18], [-88, 40, 11]]);
}

// A ledger lying open on a top face at height z: two pages with rule lines.
function ledger(x, y, w, d, z, lines = 6) {
  const out = [];
  const half = w / 2;
  for (const px of [x, x + half]) {
    out.push(S(k.slabOf({ x: px + 0.3, y, w: half - 0.6, d, r: 0.6 }, z, 1.2, P, 3, 0.2), { tone: "hi", crease: "lo" }));
    const rows = [];
    for (let i = 1; i <= lines; i++) rows.push(k.lineOnTop([px + 1.6, y + (d * i) / (lines + 1)], [px + half - 1.8, y + (d * i) / (lines + 1)], z + 1.2, P));
    out.push(L(rows.join(""), { tone: "faint", free: true }));
  }
  return out.join("");
}

// ---------- the leader ----------
function leader() {
  const out = [S(k.slabOf(LEAD, 0, LEAD_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(LEAD, 2.4), LEAD_H, P), { tone: "faint" }));
  out.push(ledger(LEAD.x + 11, LEAD.y + 36, 26, 22, LEAD_H, 7));
  // the sign at the back of its top: LEADER, or DOWN once it has crashed
  const sign = { x: LEAD.x + 8, y: LEAD.y + 6, w: 32, d: 3, r: 0.5 };
  out.push(S(k.slabOf(sign, LEAD_H, 13, P, 3, 0.3), { tone: "mid", crease: "lo" })
    + `<g data-word="up">${text(sign.x + sign.w / 2, sign.y + sign.d, LEAD_H + 4.2, t("LEADER", "LÍDER"), 4.6, { anchor: "middle" })}</g>`
    + `<g data-word="down">${text(sign.x + sign.w / 2, sign.y + sign.d, LEAD_H + 4.2, t("DOWN", "CAÍDO"), 4.6, { anchor: "middle" })}</g>`);
  // its LSN on the front face
  out.push(text(LEAD.x + 6, LEAD_FRONT, 5.4, "LSN", 3.2));
  out.push(digitCounter(P, { x: LEAD.x + 15, y: LEAD_FRONT, z: 3.6, count: 4, w: 4.4, h: 6, gap: 0.5, pad: 1, name: "lsn" }));
  return `<g data-node="L" data-role="up">${out.join("")}</g>`;
}
// The users who write to the leader: a small crowd in front of it, clear of its LSN counter.
function crowd() {
  return [[-84, 4], [-73, -1], [-64, 7], [-80, 15]].map(([x, y]) => figurine(P, [x, y, 0], { scale: 0.8 })).join("");
}

// ---------- the conveyors ----------
function belt(i) {
  const y = BELT_Y[i], { x0, x1, w, z } = BELT;
  const plan = { x: x0, y: y - w / 2, w: x1 - x0, d: w, r: 0.4 };
  const out = [];
  for (const x of [x0 + 6, x1 - 6]) for (const dy of [-w / 2 + 1, w / 2 - 1]) out.push(S(k.cylinder(x, y + dy, 0.8, 0, z - 2, P, 10), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf(plan, z - 2, 2, P, 2, 0.2), { tone: "lo", crease: "none" }));
  const rollers = [];
  for (let x = x0 + 3; x < x1 - 1; x += 4) rollers.push(k.lineOnTop([x, y - w / 2 + 0.8], [x, y + w / 2 - 0.8], z, P));
  out.push(L(rollers.join(""), { tone: "faint", free: true }));
  // chevrons toward the desk
  const ch = [];
  for (let x = x0 + 14; x < x1 - 8; x += 18) ch.push(k.onTop([[x - 1.6, y - 2.2], [x + 1.2, y], [x - 1.6, y + 2.2]], z, P));
  out.push(L(ch.join(""), { tone: "mid" }));
  return out.join("");
}

// ---------- the copy desks ----------
function desk(i) {
  const d = DESKS[i], name = i ? "B" : "A";
  const out = [S(k.slabOf(d, 0, DESK_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(d, 2), DESK_H, P), { tone: "faint" }));
  // the tray the slips wait on
  const y = BELT_Y[i];
  out.push(S(k.slabOf({ x: d.x + 1.5, y: y - 4.5, w: 30, d: 9, r: 0.6 }, DESK_H, 0.6, P, 2, 0.2), { tone: "lo", crease: "none" }));
  // the copy of the ledger
  out.push(ledger(d.x + BOOK.dx, y - BOOK.d / 2, BOOK.w, BOOK.d, DESK_H, 5));
  // its name, on the right face (an upright sign on the top would hide B); LEADER once it has been promoted
  out.push(`<g data-word="up">${faceText(P, [d.x + d.w, d.y + d.d - 2.4, 4.6], t("FOLLOWER " + name, "RÉPLICA " + name), { face: "x", size: 3.6, tone: "hi" })}</g>`
    + `<g data-word="promoted">${faceText(P, [d.x + d.w, d.y + d.d - 2.4, 4.6], t("LEADER " + name, "LÍDER " + name), { face: "x", size: 3.6, tone: "hi" })}</g>`);
  // the slips the tray has no room to show, at the end of the line where they come in, on the tray's front half
  out.push(faceText(P, [d.x + 2.4, y + 4.2, DESK_H + 0.6], "", { face: "top", size: 3.6, tone: "hi", attr: `data-more="${i}"` }));
  return `<g data-desk="${i}" data-role="up">${out.join("")}</g>`;
}

// A row of named writes: per slot a raised block (the node has the write in its ledger), a flat tile (it has arrived
// and waits to be copied), a dashed slot (not here yet), and a cross for a write only the dead leader held. The
// live code picks one with data-state and writes the name. A block is lit when it is your latest save.
function slotRow(node) {
  const { x, y, z } = ROWS[node], out = [];
  for (let s = 0; s < SLOTS; s++) {
    const p = { x: x + s * (SLOT.w + SLOT.gap), y, w: SLOT.w, d: SLOT.d, r: 0.6 };
    const cx = p.x + p.w / 2, base = p.y + p.d / 2 + SLOT.size * 0.36;
    const name = (zz, tone) => faceText(P, [cx, base, zz], "", { face: "top", size: SLOT.size, tone, anchor: "middle", attr: "data-slot-text" });
    const tile = k.insetPlan(p, 0.7), top = z + SLOT.h;
    const cross = k.lineOnTop([p.x + 0.8, p.y + 0.6], [p.x + p.w - 0.8, p.y + p.d - 0.6], top, P) + k.lineOnTop([p.x + 0.8, p.y + p.d - 0.6], [p.x + p.w - 0.8, p.y + 0.6], top, P);
    out.push(`<g data-slot="${node}-${s}" data-state="none">`
      + `<g data-v="block" class="wb-lit-group">${S(k.slabOf(p, z, SLOT.h, P, 3, 0.3), { tone: "hi", crease: "lo" })}${name(top, "hi")}</g>`
      + `<g data-v="tile">${S(k.slabOf(tile, z, 0.5, P, 3, 0.2), { tone: "lo", crease: "none" })}${name(z + 0.5, "hi")}</g>`
      + `<g data-v="gap">${L(k.planOutline(k.insetPlan(p, 0.4), z + 0.1, P, 3), { tone: "mid", dashed: true })}${name(z + 0.1, "mid")}</g>`
      + `<g data-v="x">${L(cross, { tone: "mid" })}</g>`
      + `</g>`);
  }
  // the lost writes the row has no room for, where it is cut off (on the left, the older side)
  if (node === "L") out.push(faceText(P, [x, y - 4.6, z], "", { face: "top", size: 3.4, tone: "hi", attr: 'data-more-lost=""' }));
  return out.join("");
}
// The desk's front face: how far it has got (AT, an LSN) on top, how far behind (ms) below.
function counters(i) {
  const d = DESKS[i], front = d.y + d.d;
  return text(d.x + 3, front, 10, t("AT", "VA EN"), 2.8)
    + digitCounter(P, { x: d.x + 14, y: front, z: 8.8, count: 4, w: 3.8, h: 4.6, gap: 0.5, pad: 0.8, name: "at" + i })
    + digitCounter(P, { x: d.x + 14, y: front, z: 1.8, count: 4, w: 3.8, h: 4.6, gap: 0.5, pad: 0.8, name: "lag" + i })
    + text(d.x + 33.6, front, 2.9, "ms", 2.6)
    + text(d.x + 39, front, 2.9, t("LAG", "RETRASO"), 2.8);
}
// The lamp that lights once the desk has applied your latest save.
function yours(i) {
  const d = DESKS[i];
  const p = [d.x + 53, d.y + d.d - 5, DESK_H];
  return `<g data-lamp="yours${i}"><g data-off-lamp>${lamp(P, p, { r: 2.2 })}</g><g data-on-lamp style="display:none">${litFill(lamp(P, p, { r: 2.2, lit: true }))}</g></g>`;
}

// ---------- you and your board ----------
function board() {
  const out = [S(k.slabOf(BOARD, 0, BOARD_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(BOARD, 1.8), BOARD_H, P), { tone: "faint" }));
  const front = BOARD.y + BOARD.d;
  // everyone's shares on the front face, as the panel shows them
  const share = (x, name, words) => digitCounter(P, { x, y: front, z: 2.2, count: 3, w: 3.8, h: 5, gap: 0.5, pad: 0.9, name })
    + text(x + 14.4, front, 3.2, "%", 2.8) + text(x + 18.4, front, 3.2, words, 2.8);
  out.push(share(BOARD.x + 4, "missing", t("MISSING", "FALTA")));
  out.push(share(BOARD.x + 38, "wentBack", t("WENT BACK", "RETROCEDIÓ")));
  // the screen on top: what you wrote, what your last read saw, and where it was served
  out.push(S(k.slabOf({ x: SCREEN.x + SCREEN.w / 2 - 6, y: SCREEN.y - 3, w: 12, d: 7, r: 1 }, BOARD_H, 1.4, P, 3, 0.3), { tone: "lo" }));
  out.push(S(k.slabOf(SCREEN, BOARD_H + 1.4, SCREEN_H, P, 3, 0.4), { tone: "mid", crease: "lo" }));
  const z0 = BOARD_H + 1.4, top = z0 + SCREEN_H, face = SCREEN.y + SCREEN.d;
  out.push(L(k.faceRectY(P, SCREEN.x + 2, SCREEN.x + SCREEN.w - 2, face, z0 + 2, top - 2), { tone: "faint" }));
  out.push(text(SCREEN.x + 4, face, top - 6.6, t("YOU WROTE", "ESCRIBISTE"), 2.8));
  out.push(digitCounter(P, { x: SCREEN.x + 6, y: face, z: z0 + 7.6, count: 4, w: 4, h: 5.6, gap: 0.5, pad: 0.9, name: "wrote" }));
  out.push(text(SCREEN.x + 40, face, top - 6.6, t("YOUR READ SAW", "TU LECTURA VIO"), 2.8));
  out.push(digitCounter(P, { x: SCREEN.x + 42, y: face, z: z0 + 7.6, count: 4, w: 4, h: 5.6, gap: 0.5, pad: 0.9, name: "saw" }));
  // one line under them, set live: where your last read went, and whether it had your save
  out.push(faceText(P, [SCREEN.x + SCREEN.w / 2, face, z0 + 2.8], "", { size: 2.6, tone: "hi", anchor: "middle", attr: "data-verdict" }));
  return out.join("");
}
function you() {
  return person(P, YOU, { scale: 1.1 }) + plaque(P, { x: YOU[0] - 7, y: YOU[1] + 8, w: 14, d: 7, text: t("YOU", "TÚ"), size: 3.4 });
}

// A slip: a small card standing on the conveyor, drawn at the origin and moved with translateAlong. Lit when it
// carries your own latest save.
export const SLIP = { w: 5.2, h: 4.6 };
export function slipSvg() {
  const plan = { x: -SLIP.w / 2, y: -0.3, w: SLIP.w, d: 0.6, r: 0.15 };
  return `<g class="wb-lit-group" data-slip>${S(k.slabOf(plan, 0, SLIP.h, P, 2, 0.15), { tone: "hi", crease: "none" })}</g>`;
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A main ledger and two copy desks on a base plate. On the left, the leader: a long block with an open ledger on top, a LEADER sign, and its LSN counter on the front, the number of the last write it took; a few users stand in front of it. Two conveyors run from the leader to two copy desks on the right, follower A in front and follower B at the back, each named on its right side, carrying a slip for every write, in order. On each desk the slips wait on a tray and are copied one at a time into the desk's own ledger; a +N tag at the end of the line counts the slips the tray has no room to show. The desk's front shows how far it has got (AT, an LSN) and how many milliseconds old the oldest write it hasn't copied is (LAG). On the front of the leader's top and of each desk's top lies a row of four slots naming the leader's four newest writes, W followed by the LSN, oldest on the left: a raised block where the node has copied the write, a flat tile where it has arrived and waits on the tray, a dashed slot where it hasn't arrived. When the leader crashes its sign reads DOWN, the follower that has received the most is renamed LEADER, and the blocks only the dead leader held are crossed out, with a +N tag for those the row has no room for. The slip for your own latest save is lit, as are its blocks, and a lamp on each desk lights once that desk has copied it. In front stand you and your board: its screen shows what you wrote, what your last read saw, and a line saying where that read was served and whether it had your save; its front shows, for every user since the run started, the share of read-backs that missed the user's save (MISSING) and of second reads that went back (WENT BACK).",
      "Un libro mayor y dos mesas de copia sobre una placa base. A la izquierda, el líder: un bloque largo con un libro abierto encima, un letrero LÍDER y su contador LSN al frente, el número de la última escritura que recibió; unos usuarios esperan delante. Dos cintas transportadoras van del líder a dos mesas de copia a la derecha, la réplica A adelante y la réplica B al fondo, cada una con su nombre en el costado derecho, y llevan un papel por cada escritura, en orden. En cada mesa los papeles esperan en una bandeja y se copian uno a la vez en el libro propio de la mesa; una marca +N al final de la fila cuenta los papeles que no caben en la bandeja. El frente de la mesa muestra hasta dónde llegó (VA EN, un LSN) y cuántos milisegundos tiene la escritura más vieja que todavía no copió (RETRASO). Al frente de la parte superior del líder y de cada mesa hay una fila de cuatro casillas con las cuatro escrituras más nuevas del líder, W seguida del LSN, la más vieja a la izquierda: un bloque alto donde el nodo ya copió la escritura, una ficha plana donde llegó y espera en la bandeja, una casilla punteada donde no llegó. Cuando el líder se cae su letrero dice CAÍDO, la réplica que más recibió pasa a llamarse LÍDER, y los bloques que solo tenía el líder caído quedan tachados, con una marca +N para los que no caben en la fila. El papel de tu último guardado está encendido, igual que sus bloques, y una lámpara en cada mesa se enciende cuando esa mesa ya lo copió. Adelante estás tú con tu tablero: su pantalla muestra lo que escribiste, lo que vio tu última lectura y una línea que dice dónde se atendió esa lectura y si tenía tu guardado; su frente muestra, para todos los usuarios desde que empezó la ejecución, la parte de las lecturas tras guardar sin lo guardado (FALTA) y de las segundas lecturas que retrocedieron (RETROCEDIÓ).",
    ),
    body: [
      plate(),
      leader(), slotRow("L"),
      belt(1), desk(1), counters(1), yours(1), `<g data-layer="slips1"></g>`, slotRow(1),
      crowd(),
      belt(0), desk(0), counters(0), yours(0), `<g data-layer="slips0"></g>`, slotRow(0),
      board(),
      you(),
    ],
  });
}

export const GEOMETRY = { BELT_Y, BELT, QUEUE, BOOK, DESK_H, DESKS, SLOTS, SLOT };

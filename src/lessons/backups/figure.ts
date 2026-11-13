// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A backup room. In front on the left, the leader: its newest writes stand on its top as labelled blocks (W1, W2…),
// the open segment of its log waits on the pad beside it, and its front shows the time (NOW) and how hard it is
// working (LOAD). Behind it, the replica, holding the writes it has applied, with a dashed slot for one it hasn't got
// yet. At the back, two shelves: the LOG ARCHIVE, where each closed segment lands as a crate labelled with the last
// write it carries, and the BACKUPS shelf, where each snapshot lands as a box (S1, S2…) labelled with the time it holds
// every write up to. A lit sign on the archive's board marks a segment that never arrived (GAP). In front on the right, the
// restore station: a snapshot crate on its pad, the segment being replayed in its tray, the newest writes the copy has
// got back and a dashed slot for the first one it hasn't; its front counts how far it got (UP TO), the writes it lost
// (LOST) and how long it took (TOOK). The same station builds a new replica, and runs restore drills.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, meter, faceText, variants, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -92, y: -108, w: 184, d: 112, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// ---------- where things are ----------
export const BLOCK = { w: 12, d: 6, h: 7, step: 13.4 };            // a write
export const CRATE = { w: 11, d: 8, h: 9.5, step: 12.6 };            // a log segment
export const SNAP = { w: 14, d: 9, h: 11, step: 15.6 };              // a snapshot

const ARCH = { x: -86, y: -104, w: 82, d: 22, r: 1 };
const BACK = { x: 2, y: -104, w: 84, d: 22, r: 1 };
const BOARD_H = 34;
const SHELF_Z = 2;
const REPLICA = { x: -88, y: -70, w: 52, d: 24, r: 2 };
const REPLICA_H = 12;
const PAD = { x: -31, y: -66, w: 15, d: 14, r: 1.2 };
const PAD_H = 6;
const LEADER = { x: -88, y: -34, w: 52, d: 32, r: 2 };
const LEADER_H = 14;
const STATION = { x: -26, y: -38, w: 112, d: 34, r: 2 };
const STATION_H = 12;

// slots: [x, y, z] of each block's left-back-bottom corner
const slotsOn = (x0, y, z, n) => Array.from({ length: n }, (_, i) => [x0 + i * BLOCK.step, y, z]);
export const SLOTS = {
  leader: slotsOn(LEADER.x + 4, LEADER.y + 14, LEADER_H, 3),
  replica: slotsOn(REPLICA.x + 4, REPLICA.y + 12, REPLICA_H, 3),
  station: slotsOn(STATION.x + 50, STATION.y + 15, STATION_H, 4),
};
export const ARCH_SLOTS = Array.from({ length: 5 }, (_, i) => [ARCH.x + 18 + i * CRATE.step, ARCH.y + 6, SHELF_Z + 2]);
export const BACK_SLOTS = Array.from({ length: 4 }, (_, i) => [BACK.x + 18 + i * SNAP.step, BACK.y + 6, SHELF_Z + 2]);
export const OPEN_AT = [PAD.x + 2, PAD.y + 3, PAD_H];
export const PAD_AT = [STATION.x + 6, STATION.y + 14, STATION_H];       // the snapshot being restored
export const TRAY_AT = [STATION.x + 30, STATION.y + 15, STATION_H];     // the segment being replayed

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(ARCH, 0, BOARD_H + 1), ...k.boxCorners(BACK, 0, BOARD_H + 1), ...k.boxCorners(REPLICA, 0, REPLICA_H + 12)],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

const { S, L } = shorthand(P);
const words = (x, y, z, w, size = 3, opts = {}) => faceText(P, [x, y, z], w, { size, tone: "mid", ...opts });

// ---------- pieces that hold a write, a segment or a snapshot ----------
// A block in a slot: shown solid with its write's name, or as a dashed outline (one the node hasn't got). The name is
// one <text> the live code writes.
function block(id, [x, y, z]) {
  const { w, d, h } = BLOCK, plan = { x, y, w, d, r: 0.4 }, face = y + d;
  const solid = `<g class="wb-lit-group" data-block>${litFill(S(k.slabOf(plan, z, h, P, 2, 0.2), { tone: "hi", crease: "lo" }))}`
    + faceText(P, [x + w / 2, face, z + 2], "", { size: 3.6, tone: "hi", anchor: "middle", attr: "data-label" }) + `</g>`;
  // the empty slot: a dashed footprint, the missing write's name lying in it
  const dash = `<g data-dash style="display:none">`
    + L(k.planOutline(plan, z + 0.1, P, 2), { tone: "mid", dashed: true })
    + faceText(P, [x + w / 2, y + d / 2 + 1.2, z + 0.1], "", { face: "top", size: 3.4, tone: "hi", anchor: "middle", attr: "data-dlabel" }) + `</g>`;
  return `<g data-slot="${id}" style="display:none">${solid}${dash}</g>`;
}
// A crate (a log segment) or a box (a snapshot), standing on a shelf: one or two lines on its front.
function crate(id, [x, y, z], size, { top = "", sub = "", hidden = true } = {}) {
  const { w, d, h } = size, plan = { x, y, w, d, r: 0.5 }, face = y + d;
  const big = size === SNAP;
  const lines = big
    ? faceText(P, [x + w / 2, face, z + h * 0.5], top, { size: 3.6, tone: "hi", anchor: "middle", attr: "data-label" })
      + faceText(P, [x + w / 2, face, z + h * 0.15], sub, { size: 2.6, tone: "hi", anchor: "middle", attr: "data-sub" })
    : faceText(P, [x + w / 2, face, z + h * 0.34], top, { size: 3, tone: "hi", anchor: "middle", attr: "data-label" });
  const body = litFill(S(k.slabOf(plan, z, h, P, 3, 0.4), { tone: "hi", crease: "lo" }))
    + L(k.planOutline(k.insetPlan(plan, 1.2), z + h, P, 3), { tone: "faint" });
  return `<g class="wb-lit-group" data-crate="${id}"${hidden ? ' style="display:none"' : ""}>${body}${lines}</g>`;
}
// The same, drawn at the origin for the live code to move (translateAlong).
export function flyerSvg(kind) {
  return crate("fly-" + kind, [0, 0, 0], kind === "snap" ? SNAP : CRATE, { hidden: false });
}
const dashedCrate = (id, [x, y, z], size) => {
  const { w, d, h } = size, plan = { x, y, w, d, r: 0.5 }, face = y + d;
  return `<g data-gapslot="${id}" style="display:none">${L(k.planOutline(plan, z + h, P, 3), { tone: "mid", dashed: true })}${L(k.faceRectY(P, x, x + w, face, z, z + h), { tone: "mid", dashed: true })}</g>`;
};

// A sign standing on a top face: a name, and a second drawing for when the node is down (lit, two lines).
function nodeSign(name, x, y, z, w, up, down) {
  const plan = { x, y, w, d: 3, r: 0.5 }, face = y + 3;
  const upSvg = S(k.slabOf(plan, z, 9, P, 3, 0.3), { tone: "mid", crease: "lo" }) + words(x + w / 2, face, z + 2.6, up, 4.2, { anchor: "middle", tone: "hi" });
  const downSvg = `<g class="wb-lit-group">${litFill(S(k.slabOf(plan, z, 9, P, 3, 0.3), { tone: "hi", crease: "lo", lit: true }))}`
    + words(x + w / 2, face, z + 5.2, up, 2.8, { anchor: "middle", tone: "on-lit" }) + words(x + w / 2, face, z + 1.4, down, 2.8, { anchor: "middle", tone: "on-lit" }) + `</g>`;
  return variants(name, { up: upSvg, down: downSvg }, "up");
}

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H });
}

// ---------- the replica, at the back left ----------
function replica() {
  const out = [S(k.slabOf(REPLICA, 0, REPLICA_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(REPLICA, 2), REPLICA_H, P), { tone: "faint" }));
  out.push(nodeSign("replica-sign", REPLICA.x + 6, REPLICA.y + 3, REPLICA_H, 34, t("REPLICA", "RÉPLICA"), t("DOWN", "CAÍDA")));
  SLOTS.replica.forEach((p, i) => out.push(block("replica-" + i, p)));
  return out.join("");
}
// a link from the leader to the replica: the replication stream
function link() {
  const x = REPLICA.x + REPLICA.w - 6;
  return L(k.segment([x, LEADER.y, 4], [x, REPLICA.y + REPLICA.d, 4], P), { tone: "mid" })
    + L(k.segment([x - 2, LEADER.y, 4], [x - 2, REPLICA.y + REPLICA.d, 4], P), { tone: "faint" });
}

// ---------- the leader, in front on the left ----------
function leader() {
  const out = [S(k.slabOf(LEADER, 0, LEADER_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(LEADER, 2), LEADER_H, P), { tone: "faint" }));
  out.push(nodeSign("leader-sign", LEADER.x + 6, LEADER.y + 3, LEADER_H, 34, t("LEADER", "LÍDER"), t("DOWN", "CAÍDO")));
  SLOTS.leader.forEach((p, i) => out.push(block("leader-" + i, p)));
  // the front: the time, and the load meter
  const front = LEADER.y + LEADER.d;
  out.push(words(LEADER.x + 3.5, front, 9.6, t("NOW", "AHORA"), 2.6));
  out.push(digitCounter(P, { x: LEADER.x + 4, y: front, z: 2.4, count: 2, w: 3.8, h: 5, gap: 0.5, pad: 0.8, name: "hh" }));
  out.push(words(LEADER.x + 13.4, front, 3.2, ":", 4.2, { tone: "hi" }));
  out.push(digitCounter(P, { x: LEADER.x + 15.6, y: front, z: 2.4, count: 2, w: 3.8, h: 5, gap: 0.5, pad: 0.8, name: "mm" }));
  out.push(meter(P, { x: LEADER.x + 36, y: front, z: 3, r: 6, ticks: 10, zone: 0.8, name: "load", value: 0.15 }));
  out.push(words(LEADER.x + 36, front, 0.9, t("LOAD", "CARGA"), 2.2, { anchor: "middle" }));
  return out.join("");
}
// the pad beside it, where the open segment waits
function pad() {
  const out = [S(k.slabOf(PAD, 0, PAD_H, P, 3, 0.4), { tone: "mid" })];
  out.push(words(PAD.x + PAD.w / 2, PAD.y + PAD.d, 1.8, "LOG", 2.4, { anchor: "middle" }));
  out.push(crate("open", OPEN_AT, CRATE));
  return out.join("");
}

// ---------- the shelves at the back ----------
function shelf(plan, label, x0) {
  const out = [];
  const back = { x: plan.x, y: plan.y, w: plan.w, d: 3, r: 0.4 };
  out.push(S(k.slabOf(back, 0, BOARD_H, P, 2, 0.3), { tone: "mid", crease: "lo" }));
  const face = back.y + back.d;
  out.push(L(k.faceRectY(P, back.x + 2, back.x + back.w - 2, face, SHELF_Z + 16, BOARD_H - 2), { tone: "faint" }));
  out.push(words(back.x + 5, face, BOARD_H - 9, label, 3.8, { tone: "hi" }));
  const board = { x: plan.x, y: plan.y + 3, w: plan.w, d: plan.d - 3, r: 0.6 };
  out.push(S(k.slabOf(board, 0, SHELF_Z + 2, P, 2, 0.3), { tone: "mid", crease: "none" }));
  // older ones than the shelf shows: "+N", on the board at its left end, where the row is cut off
  out.push(faceText(P, [plan.x + 4, face, SHELF_Z + 15.5], "", { size: 3.4, tone: "hi", attr: `data-more="${x0}"` }));
  return out.join("");
}
function archive() {
  const out = [shelf(ARCH, t("LOG ARCHIVE", "LOG ARCHIVADO"), "arch")];
  ARCH_SLOTS.forEach((p, i) => { out.push(dashedCrate("arch-" + i, p, CRATE)); out.push(crate("arch-" + i, p, CRATE)); });
  // archive off
  out.push(`<g data-off style="display:none">${words(ARCH.x + ARCH.w / 2, ARCH.y + 3, SHELF_Z + 8, t("ARCHIVING OFF", "SIN ARCHIVAR"), 3.8, { anchor: "middle", tone: "hi" })}</g>`);
  return out.join("");
}
function backups() {
  const out = [shelf(BACK, t("BACKUPS", "RESPALDOS"), "back")];
  BACK_SLOTS.forEach((p, i) => out.push(crate("back-" + i, p, SNAP)));
  return out.join("");
}
// the gap: a lit sign hung on the archive's back board, above the crates
function gapSign() {
  const x = ARCH.x + 30, y = ARCH.y + 3, z = SHELF_Z + 15, w = 46, h = 6.4;
  return `<g class="wb-lit-group" data-gap style="display:none">${litFill(S(k.slabOf({ x, y, w, d: 1, r: 0.3 }, z, h, P, 2, 0.2), { tone: "hi", crease: "lo", lit: true }))}`
    + faceText(P, [x + w / 2, y + 1, z + 1.8], "", { size: 3, tone: "on-lit", anchor: "middle", attr: "data-gap-label" }) + `</g>`;
}

// ---------- the restore station, in front on the right ----------
function station() {
  const out = [S(k.slabOf(STATION, 0, STATION_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(STATION, 2), STATION_H, P), { tone: "faint" }));
  // its sign: what it is doing
  const sx = STATION.x + 6, sy = STATION.y + 2, sw = 44;
  const plan = { x: sx, y: sy, w: sw, d: 3, r: 0.5 };
  const sign = (w) => S(k.slabOf(plan, STATION_H, 9, P, 3, 0.3), { tone: "mid", crease: "lo" }) + words(sx + sw / 2, sy + 3, STATION_H + 2.6, w, 4, { anchor: "middle", tone: "hi" });
  out.push(variants("station-sign", { restore: sign(t("RESTORE", "RESTAURAR")), seed: sign(t("NEW REPLICA", "RÉPLICA NUEVA")), drill: sign(t("DRILL", "SIMULACRO")) }, "restore"));
  // the pad for the snapshot and the tray for the segment being replayed
  out.push(S(k.slabOf({ x: PAD_AT[0] - 2, y: PAD_AT[1] - 2, w: SNAP.w + 4, d: SNAP.d + 4, r: 0.8 }, STATION_H, 0.8, P, 3, 0.2), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf({ x: TRAY_AT[0] - 2, y: TRAY_AT[1] - 2, w: CRATE.w + 4, d: CRATE.d + 4, r: 0.8 }, STATION_H, 0.8, P, 3, 0.2), { tone: "lo", crease: "none" }));
  out.push(crate("pad", [PAD_AT[0], PAD_AT[1], PAD_AT[2] + 0.8], SNAP));
  out.push(crate("tray", [TRAY_AT[0], TRAY_AT[1], TRAY_AT[2] + 0.8], CRATE));
  SLOTS.station.forEach((p, i) => out.push(block("station-" + i, p)));
  // the front: how far it got, what it lost, how long it took
  const front = STATION.y + STATION.d;
  const cnt = (x, name, label, count, unit = "") => words(x, front, 9.4, label, 2.6)
    + digitCounter(P, { x, y: front, z: 2.4, count, w: 3.8, h: 5, gap: 0.5, pad: 0.8, name })
    + (unit ? words(x + count * 4.3 + 1.4, front, 3, unit, 2.6) : "");
  out.push(words(STATION.x + 6, front, 3, "W", 3.4, { tone: "hi" }));
  out.push(cnt(STATION.x + 10, "upto", t("UP TO", "HASTA"), 4));
  out.push(cnt(STATION.x + 40, "lost", t("LOST", "PERDIDAS"), 4));
  out.push(cnt(STATION.x + 70, "took", t("TOOK", "TARDÓ"), 3, "min"));
  return out.join("");
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A backup room on a base plate. In front on the left, the leader: a block with a LEADER sign, its newest writes standing on top as small blocks labelled W and a number, a NOW clock and a LOAD meter on its front, and a pad beside it labelled LOG where the open segment of its log waits. Behind it, linked to it, the replica: a block with a REPLICA sign and the writes it has applied, with a dashed empty slot, the write's name lying in it, for a write it hasn't got yet. At the back, two shelves. On the left, the LOG ARCHIVE, where each closed segment lands as a crate labelled with the last write it carries; a lit sign on its board marks a segment that never arrived. A +N above a shelf's left end counts older crates. On the right, the BACKUPS shelf, where each snapshot lands as a box labelled S and a number, with the time it holds every write up to. In front on the right, the restore station, with a sign saying what it is doing (RESTORE, NEW REPLICA or DRILL): a pad holding the snapshot it restores, a tray holding the segment it replays, and the newest writes the restored copy has got back, with a dashed empty slot for the first write it doesn't have. Its front counts the last write it got back (UP TO), the writes it lost (LOST) and the minutes it took (TOOK). Lit: the bad DELETE wherever it has reached, a node that is down, and the gap in the archive.",
      "Una sala de respaldos sobre una placa base. Adelante a la izquierda, el líder: un bloque con un letrero LÍDER, sus escrituras más nuevas paradas encima como bloquecitos rotulados con W y un número, un reloj AHORA y un medidor de CARGA al frente, y al lado una base rotulada LOG donde espera el segmento abierto de su log. Detrás, unida a él, la réplica: un bloque con un letrero RÉPLICA y las escrituras que ya aplicó, con un lugar vacío punteado, con el nombre de la escritura adentro, para una escritura que todavía no tiene. Al fondo, dos estantes. A la izquierda, el LOG ARCHIVADO, donde cada segmento cerrado llega como una caja rotulada con la última escritura que lleva; un letrero encendido en su tablero marca un segmento que nunca llegó. Un +N sobre el extremo izquierdo de un estante cuenta las cajas más viejas. A la derecha, el estante de RESPALDOS, donde cada instantánea llega como una caja rotulada con S y un número, y la hora hasta la que guarda cada escritura. Adelante a la derecha, la estación de restauración, con un letrero que dice qué está haciendo (RESTAURAR, RÉPLICA NUEVA o SIMULACRO): una base con la instantánea que restaura, una bandeja con el segmento que reproduce y las escrituras más nuevas que recuperó la copia, con un lugar vacío punteado para la primera escritura que no tiene. Su frente cuenta la última escritura recuperada (HASTA), las escrituras perdidas (PERDIDAS) y los minutos que tardó (TARDÓ). Encendidos: el DELETE malo dondequiera que haya llegado, un nodo caído y el hueco en el archivo.",
    ),
    body: [
      plate(),
      archive(),
      gapSign(),
      backups(),
      replica(),
      link(),
      leader(),
      pad(),
      station(),
      `<g data-layer="fly"></g>`,
    ],
  });
}

export const GEOMETRY = { SLOTS, ARCH_SLOTS, BACK_SLOTS, OPEN_AT, PAD_AT, TRAY_AT, BLOCK, CRATE, SNAP, LEADER_TOP: [LEADER.x + 18, LEADER.y + 14, LEADER_H + 2] };

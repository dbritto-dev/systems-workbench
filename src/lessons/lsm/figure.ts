// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// Two storage rooms on one plate, fed the same writes by the writer at the back.
//   Left, the B-tree: a filing cabinet whose drawers are its leaf pages (each drawer stands for a stretch of them).
//   A write pulls out its drawer (lit) and the page table in front shows what that costs: one record changed, the
//   whole 40-record page written back. Writes the disk can't keep up with wait in the tray beside the writer.
//   Right, the LSM tree: writes land in the memtable tray; a full tray is bound into a file that goes on the L0 shelf
//   of the rack; the merge press (compaction) merges files down the shelves L1, L2, L3 (lit while it works on them).
// Each room has a bench of counters at the front: bytes written per byte (WRITE AMP), pages or files a read touches,
// space used against the data, and a meter for how busy its disk is.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, meter, person, sign, plaque, faceText, card } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { PER_PAGE, TARGET, runLen } from "./sim";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -108, y: -86, w: 216, d: 108, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// ---------- B-tree room (left) ----------
export const CAB = { x: -102, y: -82, w: 94, d: 18, r: 1.4 };
export const CAB_H = 36;
export const CAB_FRONT = CAB.y + CAB.d;
export const DRAWERS = { cols: 6, rows: 4 };
const DR = { pad: 3, gap: 1.4 };
export const DRAWER_W = (CAB.w - 2 * DR.pad - (DRAWERS.cols - 1) * DR.gap) / DRAWERS.cols;
export const DRAWER_H = (CAB_H - 2 * DR.pad - (DRAWERS.rows - 1) * DR.gap) / DRAWERS.rows;
// The page table: one leaf page as 40 record tiles; the changed record lights.
const PTAB = { x: -104, y: -54, w: 76, d: 42, r: 1.6 };
const PTAB_H = 7;
export const TILE = { cols: 10, rows: 4, w: 6, d: 6.2, gap: 1.1 };
const BENCH_B = { x: -102, y: -2, w: 86, d: 20, r: 1.6 };
const BENCH_H = 9;

// ---------- the writer's desk (centre back): two out-trays, writes waiting for each engine ----------
export const WRITER = [-9, 12, 0];
export const DESK = { x: -23, y: -46, w: 46, d: 26, r: 1.2 };
export const DESK_H = 8;
export const TRAYS = [{ x: -19, y: -43, w: 16, d: 13 }, { x: 3, y: -43, w: 16, d: 13 }];
export const WAIT_SLIPS = 8;

// ---------- LSM room (right) ----------
export const MEMT = { x: 27, y: -52, w: 30, d: 24, r: 1.4 };
export const MEMT_H = 8;
export const MEM_CARDS = 10;
export const RACK = { x: 8, y: -84, w: 94, d: 14, r: 1 };
export const SHELF_Z = [36, 25, 14, 3];          // L0 at the top, L3 at the bottom
export const SHELF_H = 11;
export const RACK_H = SHELF_Z[0] + SHELF_H + 1;
export const SHELF = { x0: RACK.x + 13, x1: RACK.x + RACK.w - 3, y: RACK.y + RACK.d - 3 };   // where runs stand
export const BOOK = { w: 1.4, gap: 0.33, h: 8 };
export const L0_BOOKS = 36;
const PRESS = { x: 61, y: -54, w: 41, d: 30, r: 1.6 };
const PRESS_H = 9;
export const DIAL = { x: PRESS.x + 29, y: PRESS.y + 14, r: 7.4 };
const BENCH_L = { x: 16, y: -2, w: 86, d: 20, r: 1.6 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(RACK, 0, RACK_H + 11), ...k.boxCorners(CAB, 0, CAB_H + 2), [CAB.x, CAB.y, CAB_H + 2]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

const { S, L, D } = shorthand(P);
const text = (x, y, z, words, size = 2.8, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });
export const SIZE = 2.8;        // the smallest words on the machine

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H });
}

// ---------- B-tree ----------
export const drawerAt = (i) => {
  const c = i % DRAWERS.cols, r = Math.floor(i / DRAWERS.cols);
  return { x: CAB.x + DR.pad + c * (DRAWER_W + DR.gap), z: CAB_H - DR.pad - (r + 1) * DRAWER_H - r * DR.gap };
};
function cabinet() {
  const out = [S(k.slabOf(CAB, 0, CAB_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(CAB, 2.2), CAB_H, P), { tone: "faint" }));
  out.push(text(CAB.x + 6, CAB.y + 12, CAB_H, t("B-TREE", "ÁRBOL B"), 6, { face: "top", tone: "hi" }));
  out.push(text(CAB.x + CAB.w - 5, CAB.y + 12, CAB_H, t("PAGES", "PÁGINAS"), 3.4, { face: "top", anchor: "end" }));
  for (let i = 0; i < DRAWERS.cols * DRAWERS.rows; i++) {
    const { x, z } = drawerAt(i);
    const plan = { x, y: CAB_FRONT, w: DRAWER_W, d: 1.2, r: 0.4 };
    const handle = L(k.segment([x + DRAWER_W / 2 - 2.4, CAB_FRONT + 1.2, z + DRAWER_H * 0.55], [x + DRAWER_W / 2 + 2.4, CAB_FRONT + 1.2, z + DRAWER_H * 0.55], P), { tone: "mid" });
    out.push(`<g data-drawer="${i}">${S(k.slabOf(plan, z, DRAWER_H, P, 2, 0.2), { tone: "hi", crease: "lo" })}${handle}</g>`);
  }
  return out.join("");
}
export const tileAt = (i) => {
  const c = i % TILE.cols, r = Math.floor(i / TILE.cols);
  const x0 = PTAB.x + (PTAB.w - (TILE.cols * TILE.w + (TILE.cols - 1) * TILE.gap)) / 2;
  return { x: x0 + c * (TILE.w + TILE.gap), y: PTAB.y + 5 + r * (TILE.d + TILE.gap) };
};
function pageTable() {
  const out = [S(k.slabOf(PTAB, 0, PTAB_H, P, 3, 0.5), { tone: "mid" })];
  // the page: a thin sheet the tiles sit on, lit while it is being written back
  const sheet = { x: tileAt(0).x - 1.4, y: PTAB.y + 3.6, w: TILE.cols * TILE.w + (TILE.cols - 1) * TILE.gap + 2.8, d: TILE.rows * TILE.d + (TILE.rows - 1) * TILE.gap + 2.8, r: 0.6 };
  out.push(`<g data-sheet>${S(k.slabOf(sheet, PTAB_H, 0.6, P, 2, 0.2), { tone: "lo", crease: "none" })}</g>`);
  for (let i = 0; i < PER_PAGE; i++) {
    const { x, y } = tileAt(i);
    out.push(`<g data-tile="${i}">${S(k.slabOf({ x, y, w: TILE.w, d: TILE.d, r: 0.3 }, PTAB_H + 0.6, 1.2, P, 2, 0.2), { tone: "hi", crease: "lo" })}</g>`);
  }
  out.push(text(PTAB.x + 4, PTAB.y + PTAB.d - 3, PTAB_H, t("ONE CHANGE · WHOLE PAGE", "UN CAMBIO · PÁGINA ENTERA"), SIZE, { face: "top" }));
  return out.join("");
}
function counterCol(x, y, name, count, words, { dot = false } = {}) {
  const w = 4.4, gap = 0.6;
  const out = [digitCounter(P, { x, y, z: 1.6, count, w, h: 6, gap, pad: 1, name })];
  if (dot) out.push(D([k.iso([x + (count - 1) * (w + gap) - gap / 2, y + 0.4, 2.1], P)], { size: 0.6, tone: "hi" }));
  out.push(text(x - 1, y - 3.2, BENCH_H, words, SIZE, { face: "top" }));
  return out.join("");
}
function benchB() {
  const out = [S(k.slabOf(BENCH_B, 0, BENCH_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(BENCH_B, 2.2), BENCH_H, P), { tone: "faint" }));
  const f = BENCH_B.y + BENCH_B.d, x = BENCH_B.x;
  out.push(counterCol(x + 5, f, "waB", 2, t("WRITE AMP", "AMP. ESCR.")));
  out.push(counterCol(x + 26, f, "rdB", 3, t("PAGES/READ", "PÁG./LECT."), { dot: true }));
  out.push(counterCol(x + 51, f, "spB", 3, t("SPACE %", "ESPACIO %")));
  out.push(meter(P, { x: x + 77, y: f, z: 1.4, r: 6.4, ticks: 10, zone: 0.8, name: "diskB" }));
  out.push(text(x + 77, f - 3.2, BENCH_H, t("DISK", "DISCO"), SIZE, { face: "top", anchor: "middle" }));
  return out.join("");
}

// ---------- the writer ----------
function writerPerson() {
  return person(P, WRITER, { scale: 0.9, hat: "cap", holding: "slip" });
}
function writer() {
  const out = [];
  out.push(S(k.slabOf(DESK, 0, DESK_H, P, 3, 0.5), { tone: "mid" }));
  TRAYS.forEach((tr, j) => {
    out.push(S(k.slabOf({ ...tr, r: 0.6 }, DESK_H, 1.4, P, 2, 0.2), { tone: "hi", crease: "lo", inner: L(k.planOutline(k.insetPlan({ ...tr, r: 0.6 }, 1), DESK_H + 1.4, P), { tone: "lo" }) }));
    for (let i = 0; i < WAIT_SLIPS; i++) out.push(`<g data-wait="${j}-${i}" style="display:none">${S(k.slabOf({ x: tr.x + 2, y: tr.y + 2, w: tr.w - 4, d: tr.d - 4, r: 0.3 }, DESK_H + 0.8 + i * 1.1, 0.8, P, 2, 0.1), { tone: "hi", crease: "lo" })}</g>`);
  });
  const front = DESK.y + DESK.d;
  out.push(digitCounter(P, { x: DESK.x + 2.2, y: front, z: 1.6, count: 5, w: 3.6, h: 5, gap: 0.4, pad: 0.8, name: "waitB" }));
  out.push(digitCounter(P, { x: DESK.x + 24.6, y: front, z: 1.6, count: 5, w: 3.6, h: 5, gap: 0.4, pad: 0.8, name: "waitL" }));
  out.push(text(0, front - 2.2, DESK_H, t("WAITING", "EN ESPERA"), SIZE, { face: "top", anchor: "middle" }));
  return out.join("");
}

// ---------- LSM tree ----------
function memtable() {
  const out = [S(k.slabOf(MEMT, 0, MEMT_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(MEMT, 1.8), MEMT_H, P), { tone: "lo" }) })];
  for (let i = 0; i < MEM_CARDS; i++) {
    const x = MEMT.x + 4 + i * 2.7;
    out.push(`<g data-mem="${i}" style="display:none">${S(k.slabOf({ x, y: MEMT.y + 4, w: 1.6, d: MEMT.d - 8, r: 0.2 }, MEMT_H, 6, P, 2, 0.1), { tone: "hi", crease: "lo" })}</g>`);
  }
  out.push(text(MEMT.x + 3, MEMT.y + MEMT.d, 2.2, "MEMTABLE", SIZE));
  return out.join("");
}
function rack() {
  const out = [S(k.slabOf(RACK, 0, RACK_H, P, 3, 0.4), { tone: "mid", crease: "lo" })];
  const front = RACK.y + RACK.d;
  SHELF_Z.forEach((z, i) => {
    // the shelf board, proud of the rack face
    out.push(S(k.slabOf({ x: RACK.x + 1, y: front - 4, w: RACK.w - 2, d: 5, r: 0.3 }, z - 1.2, 1.2, P, 2, 0.2), { tone: "hi", crease: "lo" }));
    out.push(`<g data-labels="leveled">${text(RACK.x + 3, front + 1, z + 2.2, "L" + i, 4.2, { tone: "hi" })}</g>`);
    out.push(`<g data-labels="tiered" style="display:none">${text(RACK.x + 3, front + 1, z + 2.2, "T" + (i + 1), 4.2, { tone: "hi" })}</g>`);
    if (i === 1 || i === 2) {
      // the level's target size: a run past this mark is due for compaction
      const x = SHELF.x0 + runLen(TARGET[i], SHELF.x1 - SHELF.x0);
      out.push(`<g data-target>${L(k.lineOnTop([x, front - 4], [x, front + 1], z, P), { tone: "hi" })}</g>`);
    }
    out.push(`<g data-shelf="${i}"></g>`);
  });
  out.push(L(k.planOutline(k.insetPlan(RACK, 1.6), RACK_H, P), { tone: "faint" }));
  out.push(text(RACK.x + 4, RACK.y + 10, RACK_H, t("LSM TREE", "ÁRBOL LSM"), 5, { face: "top", tone: "hi" }));
  return out.join("");
}
function press() {
  const out = [S(k.slabOf(PRESS, 0, PRESS_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(PRESS, 1.8), PRESS_H, P), { tone: "faint" }));
  out.push(`<g class="wb-lit-group" data-press>${S(k.slabOf({ x: PRESS.x + 3, y: PRESS.y + 4, w: 12, d: 14, r: 0.8 }, PRESS_H, 5, P, 2, 0.3), { tone: "hi", crease: "lo" })}</g>`);
  out.push(`<g data-dial-base>${k.solidSvg(k.cylinder(DIAL.x, DIAL.y, DIAL.r + 1, PRESS_H, 1.2, P, 40), { tone: "hi", crease: "lo" })}</g>`);
  const tk = k.radialTicks(DIAL.x, DIAL.y, DIAL.r - 0.6, 20, 5, PRESS_H + 1.2, [0.8, 1.6], P);
  out.push(L(tk.minor, { tone: "faint" }), L(tk.major, { tone: "mid" }));
  out.push(`<path class="wb-needle" data-progress d=""/>`);
  out.push(text(PRESS.x + 3, PRESS.y + PRESS.d, 2.2, t("MERGE", "FUSIÓN"), SIZE));
  return out.join("");
}
function stallSign() {
  // on top of the rack, at its right end: lit while writes are slowed or stopped
  return `<g class="wb-lit-group" data-stall>${sign(P, { x: RACK.x + RACK.w - 34, y: RACK.y + 8, z: RACK_H, w: 32, h: 8, text: t("WRITE STALL", "FRENO"), size: 3.6, posts: false })}</g>`;
}
function benchL() {
  const out = [S(k.slabOf(BENCH_L, 0, BENCH_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(BENCH_L, 2.2), BENCH_H, P), { tone: "faint" }));
  const f = BENCH_L.y + BENCH_L.d, x = BENCH_L.x;
  out.push(counterCol(x + 5, f, "waL", 2, t("WRITE AMP", "AMP. ESCR.")));
  out.push(counterCol(x + 26, f, "rdL", 3, t("FILES/READ", "ARCH./LECT."), { dot: true }));
  out.push(counterCol(x + 51, f, "spL", 3, t("SPACE %", "ESPACIO %")));
  out.push(meter(P, { x: x + 77, y: f, z: 1.4, r: 6.4, ticks: 10, zone: 0.8, name: "diskL" }));
  out.push(text(x + 77, f - 3.2, BENCH_H, t("DISK", "DISCO"), SIZE, { face: "top", anchor: "middle" }));
  return out.join("");
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "Two storage rooms on one base plate, fed the same writes by a writer standing at the back between them. Left, the B-tree: a filing cabinet whose drawers are its pages; a write pulls out its drawer, and a page table in front shows one leaf page as 40 record tiles, with the changed record lit while the whole page is written back. Writes the B-tree's disk can't take yet wait in a tray beside the writer. Right, the LSM tree: writes land in the memtable tray; a full tray is bound into a file that goes on the top shelf, L0, of a rack; a merge press merges files down the shelves L1, L2 and L3, and the files it is working on light up. A STALL sign lights when writes are slowed. Each room has a bench of counters at the front: write amplification, pages or files a read checks, space used against the data, and a meter for how busy its disk is.",
      "Dos salas de almacenamiento sobre una placa base, que reciben las mismas escrituras de un escritor parado al fondo entre ambas. A la izquierda, el árbol B: un archivador cuyos cajones son sus páginas; una escritura abre su cajón, y una mesa de página adelante muestra una página hoja como 40 fichas de registro, con el registro cambiado encendido mientras se reescribe la página entera. Las escrituras que el disco del árbol B todavía no puede tomar esperan en una bandeja junto al escritor. A la derecha, el árbol LSM: las escrituras caen en la bandeja de la memtable; una bandeja llena se encuaderna en un archivo que va al estante de arriba, L0, de un mueble; una prensa de fusión combina archivos hacia los estantes L1, L2 y L3, y los archivos en los que trabaja se encienden. Un letrero FRENO se enciende cuando se frenan las escrituras. Cada sala tiene adelante un banco de contadores: amplificación de escritura, páginas o archivos que revisa una lectura, espacio usado frente a los datos y un indicador de qué tan ocupado está su disco.",
    ),
    body: [
      plate(),
      cabinet(),
      rack(),
      stallSign(),
      writer(),
      `<g data-layer="fly-back"></g>`,
      pageTable(),
      memtable(),
      press(),
      `<g data-layer="fly"></g>`,
      benchB(),
      benchL(),
      writerPerson(),
    ],
  });
}

export const TILE_C = [PTAB.x + PTAB.w / 2, PTAB.y + PTAB.d / 2 - 3, PTAB_H + 3];
export const GEOMETRY = { TILE_C, CAB_FRONT, DRAWERS, DRAWER_W, DRAWER_H, TILE, MEMT, MEMT_H, DESK, DESK_H, TRAYS, SHELF_Z, SHELF, BOOK, L0_BOOKS, DIAL, PRESS_H, MEM_CARDS, WAIT_SLIPS, WRITER };

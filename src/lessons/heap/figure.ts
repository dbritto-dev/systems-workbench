// @ts-nocheck: figure code ported as-is; drawing shorthands come from src/lib/draw.
// A triage room built around a binary heap.
//   Middle: the heap as a tournament tree of pedestals, root at the back and highest, each level a step lower and
//           closer. Every pedestal holds one job token printed with its priority (1 most urgent). Rods on the plate
//           join each pedestal to its two children. No child beats its parent, so the best job is always on top.
//   Front:  the same heap as an array on a rail: slot i is pedestal i, its children are slots 2i+1 and 2i+2.
//   Left:   the intake desk, where a new job appears before it drops onto the next free leaf and sifts up.
//   Right:  the service desk, where the root goes when it is served; the last leaf then jumps to the top and
//           sifts down. Counters: swaps in the last operation, jobs waiting, oldest routine job's wait.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, faceText, person } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand, hiddenUnless } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 430;
const AZ = 66;                                           // the x axis nearly flat, so the tree spreads across the page

const PLATE = { x: -98, y: -74, w: 196, d: 112, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// ---------- the tree ----------
export const SLOTS = 15;                                  // four levels drawn
const LEVEL_Y = [-56, -38, -20, -2];
const LEVEL_H = [18, 13, 8, 3];                           // pedestal heights, root highest
const LEAF_X = Array.from({ length: 8 }, (_, i) => -59.5 + i * 17);
const levelOf = (i) => Math.floor(Math.log2(i + 1));
function nodeX(i) {
  const lv = levelOf(i), first = 2 ** lv - 1, pos = i - first, span = 8 / 2 ** lv;
  const xs = LEAF_X.slice(pos * span, pos * span + span);
  return (xs[0] + xs[xs.length - 1]) / 2;
}
export const NODES = Array.from({ length: SLOTS }, (_, i) => ({ x: nodeX(i), y: LEVEL_Y[levelOf(i)], z: LEVEL_H[levelOf(i)] }));
const PED = { w: 12, d: 10 };
export const TOKEN = { w: 10.4, d: 7.6, h: 5.4 };

// ---------- the array rail ----------
export const RAIL = { x0: -63, pitch: 8.4, y: 16, d: 8, h: 2.6 };
export const CELLS = Array.from({ length: SLOTS }, (_, i) => ({ x: RAIL.x0 + 1 + i * RAIL.pitch, w: RAIL.pitch - 1.2 }));
const CELL_H = 3.6;

// ---------- desks, at the two back corners ----------
const IN_DESK = { x: -92, y: -70, w: 30, d: 20, r: 1.6 };
const OUT_DESK = { x: 54, y: -70, w: 40, d: 20, r: 1.6 };
const DESK_H = 10;
export const IN_PAD = { x: IN_DESK.x + 20, y: IN_DESK.y + 9, z: DESK_H };       // where a new job appears
export const OUT_PAD = { x: OUT_DESK.x + 10, y: OUT_DESK.y + 9, z: DESK_H };    // where the served job lands

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [IN_DESK.x, IN_DESK.y - 8, 24], [OUT_DESK.x + OUT_DESK.w, OUT_DESK.y - 8, 24], [0, -56, 26]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: AZ },
);

const { S, L: Ln, text } = shorthand(P);
const hidden = hiddenUnless;

export const COUNTERS = {
  waiting: { x: IN_DESK.x + 4, y: IN_DESK.y + IN_DESK.d, z: 1.8, w: 4.6, h: 5.4, gap: 0.7, count: 2, size: "s" },
  swaps: { x: OUT_DESK.x + 4, y: OUT_DESK.y + OUT_DESK.d, z: 1.8, w: 4.6, h: 5.4, gap: 0.7, count: 2, size: "s" },
  oldest: { x: OUT_DESK.x + 21, y: OUT_DESK.y + OUT_DESK.d, z: 1.8, w: 4.6, h: 5.4, gap: 0.7, count: 3, size: "s" },
};

// A job token, drawn at the origin: place it with translateAlong. The digit is set live (one <text>).
export function tokenSvg(digit = "", lit = false, attr = "") {
  return S(k.slabOf({ x: -TOKEN.w / 2, y: -TOKEN.d / 2, w: TOKEN.w, d: TOKEN.d, r: 1.2 }, 0, TOKEN.h, P, 4, 0.4), { tone: "hi", crease: "lo", lit })
    + text(0, TOKEN.d / 2, 1, String(digit), { size: 4.2, tone: lit ? "on-lit" : "hi", anchor: "middle", attr });
}
const place = ([x, y, z]) => k.translateAlong(P, [x, y, z]);

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H });
}

// Rods joining each pedestal to its children, lying on the plate and ending at the pedestal faces.
function rods() {
  const out = [];
  for (let i = 0; i < SLOTS; i++) for (const c of [2 * i + 1, 2 * i + 2]) {
    if (c >= SLOTS) continue;
    const a = NODES[i], b = NODES[c];
    out.push(k.segment([a.x + (b.x > a.x ? 1 : -1) * 2, a.y + PED.d / 2, 0.3], [b.x, b.y - PED.d / 2, 0.3], P));
  }
  return Ln(out.join(""), { tone: "lo" });
}

function pedestal(i, job) {
  const n = NODES[i];
  const plan = { x: n.x - PED.w / 2, y: n.y - PED.d / 2, w: PED.w, d: PED.d, r: 1.4 };
  return S(k.slabOf(plan, 0, n.z, P, 4, 0.5), { tone: "mid" })
    + (n.z > 3 ? text(n.x, n.y + PED.d / 2, Math.max(0.6, n.z / 2 - 1), String(i), { size: 1.9, tone: "lo", anchor: "middle" }) : "")
    + `<g class="wb-lit-group" data-node="${i}" transform="${place([n.x, n.y, n.z])}"${hidden(job != null)}>${tokenSvg(job ?? "", false, `data-node-label="${i}"`)}</g>`;
}

function rail(state) {
  const out = [];
  const base = { x: RAIL.x0 - 3, y: RAIL.y, w: SLOTS * RAIL.pitch + 5, d: RAIL.d, r: 1.2 };
  out.push(S(k.slabOf(base, 0, RAIL.h, P, 3, 0.4), { tone: "mid" }));
  out.push(text(base.x + base.w + 2, base.y + base.d, 0.6, t("ARRAY", "ARREGLO"), { size: 2.1, tone: "lo" }));
  CELLS.forEach((c, i) => {
    const y0 = RAIL.y + 1.2, d = RAIL.d - 2.4;
    out.push(`<g class="wb-lit-group" data-cell="${i}"${hidden(state[i] != null)}>`
      + S(k.slabOf({ x: c.x, y: y0, w: c.w, d, r: 0.6 }, RAIL.h, CELL_H, P, 2, 0.2), { tone: "hi", crease: "lo" })
      + text(c.x + c.w / 2, y0 + d, RAIL.h + 0.6, String(state[i] ?? ""), { size: 2.4, tone: "hi", anchor: "middle", attr: `data-cell-label="${i}"` })
      + `</g>`);
    out.push(text(c.x + c.w / 2, base.y + base.d, 0.5, String(i), { size: 1.5, tone: "lo", anchor: "middle" }));
  });
  // past slot 14 the heap goes on below the drawing: a small "+n" plate at the rail's end
  out.push(`<g data-more style="display:none">${text(base.x + base.w + 2, base.y + base.d, RAIL.h - 0.2, "+0", { size: 2.1, tone: "mid", attr: "data-more-label" })}</g>`);
  return out.join("");
}

function inDesk(state) {
  const out = [person(P, [IN_DESK.x + 8, IN_DESK.y - 4, 0], { scale: 0.85 })];
  out.push(S(k.slabOf(IN_DESK, 0, DESK_H, P, 4, 0.6), { tone: "mid" }));
  out.push(Ln(k.ring(IN_PAD.x, IN_PAD.y, 6, DESK_H, P, 28), { tone: "lo" }));
  out.push(text(COUNTERS.waiting.x, IN_DESK.y + IN_DESK.d, 7.9, t("WAITING", "EN ESPERA"), { size: 1.7, tone: "mid" }));
  out.push(digitCounter(P, { ...COUNTERS.waiting, housing: false, name: "waiting", value: state.waiting }));
  return out.join("");
}

function outDesk(state) {
  const out = [person(P, [OUT_DESK.x + 30, OUT_DESK.y - 4, 0], { scale: 0.85, hat: "cap" })];
  out.push(S(k.slabOf(OUT_DESK, 0, DESK_H, P, 4, 0.6), { tone: "mid" }));
  out.push(Ln(k.ring(OUT_PAD.x, OUT_PAD.y, 6, DESK_H, P, 28), { tone: "lo" }));
  out.push(text(COUNTERS.swaps.x, OUT_DESK.y + OUT_DESK.d, 7.9, t("SWAPS", "INTERCAMBIOS"), { size: 1.7, tone: "mid" }));
  out.push(digitCounter(P, { ...COUNTERS.swaps, housing: false, name: "swaps", value: state.swaps }));
  out.push(text(COUNTERS.oldest.x, OUT_DESK.y + OUT_DESK.d, 7.9, t("OLDEST 7–9 (s)", "ANTIGUA 7–9 (s)"), { size: 1.7, tone: "mid" }));
  out.push(digitCounter(P, { ...COUNTERS.oldest, housing: false, name: "oldest", value: state.oldest }));
  out.push(`<g data-served${hidden(state.served != null)} transform="${place([OUT_PAD.x, OUT_PAD.y, OUT_PAD.z])}">${tokenSvg(state.served ?? "", false, "data-served-label")}</g>`);
  return out.join("");
}

// The first frame: a heap of 11 jobs, a 2 just served, before the live script takes over. Valid heap order.
export const FIRST = { heap: [1, 3, 2, 5, 4, 7, 3, 9, 8, 6, 5], served: 1, swaps: 3, waiting: 11, oldest: 24 };

export function buildFigure() {
  const h = FIRST.heap;
  const byLevel = [[0], [1, 2], [3, 4, 5, 6], [7, 8, 9, 10, 11, 12, 13, 14]];
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A triage room built around a binary heap. In the middle, fifteen pedestals form a tree: one at the back on top, two below it, then four, then eight at the front, joined by rods to their children. Each holds a job token printed with its priority, 1 the most urgent, and no token beats the one above it, so the most urgent job is always on the top pedestal. In front, the same jobs sit on a numbered rail, the array the tree is stored in. On the left, an intake desk where new jobs arrive; on the right, a service desk where the top job goes when it is served, with counters for swaps, jobs waiting and the oldest routine job's wait.",
      "Una sala de triaje armada alrededor de un montículo binario (heap). En el centro, quince pedestales forman un árbol: uno atrás y arriba, dos debajo, luego cuatro y ocho al frente, unidos por varillas a sus hijos. Cada uno sostiene una ficha de trabajo con su prioridad, 1 la más urgente, y ninguna ficha le gana a la de arriba, así que el trabajo más urgente siempre está en el pedestal de arriba. Al frente, los mismos trabajos están en un riel numerado: el arreglo donde se guarda el árbol. A la izquierda, un mostrador de entrada donde llegan los trabajos nuevos; a la derecha, un mostrador de atención adonde va el trabajo de arriba cuando se atiende, con contadores de intercambios, trabajos en espera y la espera del trabajo de rutina más antiguo.",
    ),
    body: [
      plate(),
      rods(),
      outDesk(FIRST),
      inDesk(FIRST),
      ...byLevel.map((lv) => lv.map((i) => pedestal(i, h[i])).join("")),
      rail(h),
      `<g class="wb-lit-group" data-fly="a" style="display:none">${tokenSvg("", true, 'data-fly-label="a"')}</g>`,
      `<g class="wb-lit-group" data-fly="b" style="display:none">${tokenSvg("", true, 'data-fly-label="b"')}</g>`,
    ],
  });
}

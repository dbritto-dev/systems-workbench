// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A kitchen pass for hedged requests.
//   Left: the pass (the client). The expediter behind it sends each order ticket (a request) to one of five cooks
//         (replicas). A timer dial on the pass shows how long the oldest ticket has been out, with a lit mark at the
//         hedge delay; answers land in the tray.
//   Middle: five ticket rails, one per cook. Tickets hang on a rail in the order the cook will take them; the one at
//         the stove end is being cooked. A lit ticket is a copy.
//   Right: the stoves, each with its cook behind it, its number and a progress strip on the face toward the viewer, and
//         a STALL sign on top that lights while the cook is stalled.
//   Front: the console (p50, p99, share of requests with a copy, extra work) and the bin where unwanted work ends up.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, rulerStrip, digitCounter, person, figurine, dial, card, sign, faceRect } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { HEAVY_X } from "./sim";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -126, y: -78, w: 208, d: 166, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

export const LY = [-52, -26, 0, 26, 52];          // the five lanes, back to front
const PASS = { x: -102, y: -64, w: 26, d: 128, r: 2 };
const PASS_H = 11;
export const DIAL = { x: -89, y: -38, z: PASS_H, r: 9.5, h: 4 };
export const DIAL_MS = 60;                        // the timer dial goes round once in this many ms
export const RAIL = { x0: -64, x1: 36, z: 17 };   // ticket rails
export const TICKET = { w: 9, h: 11 };            // hanging under the rail
export const SERVE_X = 28;                        // where the ticket being cooked hangs
export const SLOT = 10.6;                         // spacing of queued tickets
export const ENTRY_X = -64;                       // where a ticket joins its rail, coming off the pass
const STOVE = { x: 42, w: 22, half: 7, h: 10 };
export const FACE_X = STOVE.x + STOVE.w;          // the stove face toward the viewer (constant x)
export const PROG = { y0: 4.5, y1: -5.5, z0: 1.6, z1: 3.6 }; // progress strip on that face, from the lane's y
const COOK = { dx: 12, dy: -11.5 };               // the cook stands behind the stove
const CONSOLE = { x: -104, y: 67, w: 140, d: 16, r: 1.6 };
const CONSOLE_H = 11.5;
const BIN = { x: 46, y: 65, w: 28, d: 18, r: 2 };
const BIN_H = 9;
export const BIN_AT = [BIN.x + BIN.w / 2, BIN.y + BIN.d / 2, BIN_H - 2];
export const TRAY = { x: PASS.x + 4, y: 14, w: PASS.w - 8, d: 40, r: 1.2 };
export const COUNTERS = {
  p50: { x: -99, count: 4 },
  p99: { x: -66, count: 4 },
  copies: { x: -33, count: 3 },
  extra: { x: -6, count: 3 },
};

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-114, -8, 24], [STOVE.x + COOK.dx, LY[0] + COOK.dy, 14], [RAIL.x0, LY[0], RAIL.z + 2]],
  WIDTH, HEIGHT, { pad: 16, azimuth: 50 },
);

const { S, L, text } = shorthand(P);

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H }) + rulerStrip(P, { x: -60, y: -73, w: 90, d: 5, r: 1 });
}

// The pass: a long counter with the timer dial and the tray where answers land. The expediter stands behind it.
function pass(mark) {
  const out = [person(P, [-114, -8, 0], { scale: 1, hat: "cap" })];
  out.push(S(k.slabOf(PASS, 0, PASS_H, P, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(PASS, 4, P, 4), { tone: "faint" }) }));
  out.push(dial(P, { ...DIAL, ticks: 60, every: 5, name: "age", value: 0, label: "ms" }));
  out.push(`<path data-mark class="iso-line" data-tone="lit" data-free="end" d="${markPath(mark)}"/>`);
  out.push(S(k.slabOf(TRAY, PASS_H, 1.2, P, 3, 0.3), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(TRAY, 1.4), PASS_H + 1.2, P, 3), { tone: "faint" }));
  // The pass's face toward the rails.
  out.push(text(PASS.x + PASS.w, -10, 3.6, t("PASS", "PASE"), { face: "x", size: 3.6, tone: "mid", anchor: "middle" }));
  return out.join("");
}
// The hedge mark on the timer dial: a lit tick at `ms`.
export function markPath(ms) {
  const a = (Math.min(ms, DIAL_MS) / DIAL_MS) * Math.PI * 2, sx = Math.sin(a), sy = -Math.cos(a);
  const z = DIAL.z + DIAL.h + 0.2, r0 = DIAL.r - 3, r1 = DIAL.r + 1.6;
  return k.lineOnTop([DIAL.x + sx * r0, DIAL.y + sy * r0], [DIAL.x + sx * r1, DIAL.y + sy * r1], z, P);
}

function lane(i) {
  const ly = LY[i], out = [`<g data-lane="${i}">`];
  const bed = { x: RAIL.x0 - 2, y: ly - 5, w: STOVE.x - RAIL.x0 + 2, d: 10, r: 1 };
  out.push(S(k.slabOf(bed, 0, 1.4, P, 2, 0.3), { tone: "mid", crease: "none" }));
  const post = (x) => S(k.cylinder(x, ly - 0.8, 0.8, 1.4, RAIL.z - 1.4, P, 12), { tone: "mid", crease: "none" });
  out.push(post(RAIL.x0), post(RAIL.x1 - 1));
  out.push(S(k.slabOf({ x: RAIL.x0 - 1.5, y: ly - 1.6, w: RAIL.x1 - RAIL.x0 + 1.5, d: 1.6, r: 0.4 }, RAIL.z, 1.4, P, 2, 0.2), { tone: "hi", crease: "lo" }));
  out.push(`<g data-tickets="${i}"></g>`);
  // The cook behind the stove.
  out.push(`<g data-cook="${i}">${figurine(P, [STOVE.x + COOK.dx, ly + COOK.dy, 0], { scale: 1.05 })}</g>`);
  // The stove: a pan on top, the number and a progress strip on the face toward the viewer.
  const body = { x: STOVE.x, y: ly - STOVE.half, w: STOVE.w, d: STOVE.half * 2, r: 1.6 };
  out.push(S(k.slabOf(body, 0, STOVE.h, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(body, 7, P, 3), { tone: "faint" }) }));
  out.push(S(k.cylinder(STOVE.x + 9, ly, 5, STOVE.h, 0.8, P, 28), { tone: "lo", crease: "none" }));
  out.push(S(k.cylinder(STOVE.x + 9, ly, 4.1, STOVE.h + 0.8, 2, P, 28, 0.3), { tone: "hi", crease: "lo" }));
  out.push(text(FACE_X, ly + 2, 5.4, String(i + 1), { face: "x", size: 3.8, tone: "hi", anchor: "middle" }));
  out.push(L(faceRect(P, "x", { x: FACE_X, y: ly + PROG.y0, z: 0 }, 0, PROG.y0 - PROG.y1, PROG.z0, PROG.z1), { tone: "lo" }));
  out.push(`<path class="hg-prog" data-prog="${i}" d=""/>`);
  // The STALL sign, standing on the stove top, hidden until the cook stalls.
  out.push(`<g class="wb-lit-group" data-stall="${i}" style="display:none">${sign(P, { x: STOVE.x + 17, y: ly + 7, z: STOVE.h, w: 14, h: 6.4, face: "x", text: t("STALL", "TRABA"), size: 3, posts: false, lit: true })}</g>`);
  out.push(`</g>`);
  return out.join("");
}

function consoleDesk() {
  const out = [S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 4, 0.5), { tone: "mid" })];
  const fy = CONSOLE.y + CONSOLE.d;
  const labels = { p50: "P50, ms", p99: "P99, ms", copies: t("COPIES, %", "COPIAS, %"), extra: t("EXTRA WORK, %", "TRABAJO EXTRA, %") };
  for (const key of Object.keys(COUNTERS)) {
    const c = COUNTERS[key];
    out.push(text(c.x, fy, 8.2, labels[key], { size: 3, tone: "mid" }));
    out.push(digitCounter(P, { x: c.x, y: fy, z: 1.4, w: 5, h: 5.4, gap: 0.6, count: c.count, size: "s", housing: false, name: key, value: 0 }));
  }
  return out.join("");
}

function bin() {
  const out = [S(k.slabOf(BIN, 0, BIN_H, P, 4, 0.6), { tone: "mid" })];
  out.push(S(k.slabOf(k.insetPlan(BIN, 2.4), BIN_H - 0.6, 0.6, P, 3, 0.2), { tone: "lo", crease: "none" }));
  out.push(text(BIN.x + BIN.w / 2, BIN.y + BIN.d, 3.4, t("WASTED", "DESCARTE"), { size: 3, tone: "mid", anchor: "middle" }));
  return out.join("");
}

// An order ticket: an upright card hanging from a clip, its order number, and "×15" under it for a heavy one. Built
// at the origin (its top centre on the face toward the viewer); the live code places it. A copy is the lit one.
export function ticketSvg() {
  const w = TICKET.w, h = TICKET.h;
  return `<g class="wb-lit-group">${card(P, { x: -w / 2, y: 0, z: -h, w, h, text: "000", sub: "×" + HEAVY_X, size: 3.8, subSize: 2.6, clip: true, attr: "data-num", subAttr: "data-sub" })}</g>`;
}

export function buildFigure({ mark }) {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A kitchen pass on a base plate. At the left, the expediter stands behind the pass, which has a timer dial with a lit mark at the hedge delay and a tray where answers land. Five ticket rails run from the pass to five numbered stoves, each with its cook behind it; order tickets hang on a rail in the order that cook will take them, and a lit ticket is a copy. Each stove has a progress strip on its face and a sign on top that lights up while the cook is stalled. In front, a console counts the p50 and p99 in milliseconds, the share of requests that got a copy and the extra work, and a bin collects work whose answer nobody wanted.",
      "Un pase de cocina sobre una placa base. A la izquierda, el expedidor está detrás del pase, que tiene un reloj con una marca encendida en la demora del respaldo y una bandeja donde llegan las respuestas. Cinco rieles de comandas van del pase a cinco estufas numeradas, cada una con su cocinero detrás; las comandas cuelgan del riel en el orden en que ese cocinero las tomará, y una comanda encendida es una copia. Cada estufa tiene una barra de avance en su frente y un letrero arriba que se enciende mientras el cocinero está trabado. Adelante, una consola cuenta el p50 y el p99 en milisegundos, la proporción de solicitudes que recibieron copia y el trabajo extra, y una bandeja de descarte junta el trabajo cuya respuesta nadie quería.",
    ),
    body: [plate(), pass(mark), LY.map((_, i) => lane(i)).join(""), consoleDesk(), bin(), `<g data-fly></g>`],
  });
}

export const GEOMETRY = {
  DIAL, LY, RAIL, SERVE_X, SLOT, ENTRY_X, TICKET, PROG, FACE_X, BIN_AT, DIAL_MS,
  TRAY_AT: [TRAY.x + TRAY.w / 2, TRAY.y + TRAY.d / 2, PASS_H + 1.2 + TICKET.h], PASS_X: PASS.x + PASS.w,
};

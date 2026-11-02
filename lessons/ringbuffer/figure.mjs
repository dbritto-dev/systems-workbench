// A ring buffer you can watch: a round table with 16 numbered pockets, two hands on a hub and the stations around it.
//   Back left: the producer at a table. Each item gets the next sequence number and goes into the pocket under the
//              write hand. When the producer has to wait (policy "block"), the items it holds pile up on its table.
//   Middle: the ring. The write hand (long, solid) points at the pocket it writes next; the read hand (open ring
//           at its tip) at the pocket the reader reads next. Slot = sequence number mod 16.
//   Back right: the reader at a desk, with the items it is reading in hand (lit); finished items drop into the tray.
//   Front left: the bin for lost items (overwritten unread, or dropped). Front: a console with the policy plate,
//               FILL and LAG counters and the FULL lamp.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../workbench/kit.mjs";
import { sphereOf } from "../../workbench/kit.mjs";
import { basePlate, digitCounter, faceText, person, plaque, litFill } from "../../workbench/parts.mjs";
import { t } from "../../workbench/i18n.mjs";

export const WIDTH = 700;
export const HEIGHT = 430;

const PLATE = { x: -112, y: -78, w: 210, d: 130, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// ---------- the ring ----------
export const CAP = 16;
export const C = { x: -6, y: -16 };          // centre of the table
const R = 42;                                // table radius
const BASE_H = 2.4, DRUM_H = 10;             // the top of the table is at DRUM_H
export const RS = 31.5;                      // radius of the pocket circle
export const TOP = DRUM_H;
const POCKET_R = 5;
// pocket i: index 0 at the back, numbers increasing clockwise seen from above
export const angleOf = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / CAP;
export const SLOT = Array.from({ length: CAP }, (_, i) => [C.x + RS * Math.cos(angleOf(i)), C.y + RS * Math.sin(angleOf(i)), TOP]);
const HUB_R = 5.6, HUB_TOP = 24;
const READ_Z = 15.2, WRITE_Z = 19.2, HAND_T = 1.5;

// ---------- the stations ----------
const PTABLE = { x: -108, y: -72, w: 42, d: 22, r: 1.6 };
const PTABLE_H = 14;
export const PROD_SPOT = [PTABLE.x + PTABLE.w - 6, PTABLE.y + 10, PTABLE_H];                 // where a new item appears
export const BACKLOG = { xs: [-92, -84, -76], ys: [-66, -57], z: PTABLE_H, step: 3.4, layers: 3 };

const DESK = { x: 50, y: -74, w: 44, d: 22, r: 1.6 };
const DESK_H = 10;
export const HAND_SPOTS = [[58, -66], [67, -66], [76, -66], [85, -66], [58, -57], [67, -57], [76, -57], [85, -57]].map(([x, y]) => [x, y, DESK_H]);

const TRAY = { x: 54, y: -26, w: 40, d: 20, r: 1.4 };
const TRAY_H = 7;
export const TRAY_SPOT = [TRAY.x + TRAY.w / 2, TRAY.y + TRAY.d / 2, TRAY_H - 2.6];

const BIN = { x: -106, y: 8, w: 36, d: 26, r: 1.2 };
const BIN_H = 9;
export const BIN_SPOTS = [[-98, 15], [-89, 15], [-80, 15], [-98, 25], [-89, 25], [-80, 25]].map(([x, y]) => [x, y, 0.9]);

const CONSOLE = { x: -50, y: 30, w: 92, d: 15, r: 1.4 };
const CONSOLE_H = 9;

export const TOKEN = { r: 3.9, h: 3 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [PTABLE.x + 14, PTABLE.y - 8, 26], [DESK.x + 20, DESK.y - 8, 26], [C.x, C.y, HUB_TOP + 3]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 50 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const label = (x, y, z, text, size = 2.2, opts = {}) => faceText(P, [x, y, z], text, { size, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H });
}

// ---------- the table ----------
function table() {
  const out = [S(k.cylinder(C.x, C.y, R + 2.4, 0, BASE_H, P, 72), { tone: "lo" })];
  out.push(S(k.cylinder(C.x, C.y, R, BASE_H, DRUM_H - BASE_H, P, 96, 0.6), { tone: "mid" }));
  out.push(L(k.ring(C.x, C.y, R - 2.2, TOP, P, 96), { tone: "faint" }));
  out.push(L(k.ring(C.x, C.y, RS - POCKET_R - 2.6, TOP, P, 72), { tone: "faint" }));
  // pockets and their slot numbers
  out.push(L(SLOT.map(([x, y]) => k.ring(x, y, POCKET_R, TOP, P, 24)).join(""), { tone: "lo" }));
  SLOT.forEach(([, , ], i) => {
    const a = angleOf(i), rr = RS + POCKET_R + 3.4;
    out.push(faceText(P, [C.x + rr * Math.cos(a), C.y + rr * Math.sin(a) + 0.7, TOP], String(i), { face: "top", size: 2.1, tone: "lo", anchor: "middle" }));
  });
  return out.join("");
}

// A hand: a flat bar from the hub towards pocket i, stopping short of the pocket so the item stays readable.
const rot = (a, pts) => pts.map(([u, v]) => [C.x + u * Math.cos(a) - v * Math.sin(a), C.y + u * Math.sin(a) + v * Math.cos(a)]);
function hand(kind, i) {
  const a = angleOf(i), out = [];
  if (kind === "w") {
    const bar = rot(a, [[3, -1.3], [RS - 9, -1.3], [RS - 9, -2.6], [RS - 5.4, 0], [RS - 9, 2.6], [RS - 9, 1.3], [3, 1.3]]);
    out.push(S(k.extrude(bar, WRITE_Z, HAND_T, P, { convex: false }), { tone: "hi", crease: "lo" }));
  } else {
    const bar = rot(a, [[3, -0.8], [RS - 11.6, -0.8], [RS - 11.6, 0.8], [3, 0.8]]);
    out.push(S(k.extrude(bar, READ_Z, HAND_T * 0.8, P), { tone: "mid", crease: "none" }));
    const [tx, ty] = rot(a, [[RS - 8.4, 0]])[0];
    out.push(S(k.extrude(k.circleRing(tx, ty, 3.2, 28), READ_Z, HAND_T * 0.8, P), { tone: "mid", crease: "lo" }));
    out.push(L(k.ring(tx, ty, 1.9, READ_Z + HAND_T * 0.8, P, 20), { tone: "lo" }));
  }
  return out.join("");
}
// Hands pointing to the back half are drawn before the hub, the rest after it.
const backHalf = (i) => Math.sin(angleOf(i)) < 0.05;
function hands(which, front) {
  const out = [];
  for (const kind of which) for (let i = 0; i < CAP; i++) {
    if (backHalf(i) === front) continue;
    out.push(`<g data-hand="${kind}${i}"${i === (kind === "w" ? 5 : 0) ? "" : ' style="display:none"'}>${hand(kind, i)}</g>`);
  }
  return out.join("");
}
function hub() {
  return S(k.cylinder(C.x, C.y, HUB_R + 1.6, TOP, 1.6, P, 32), { tone: "lo" })
    + S(k.cylinder(C.x, C.y, HUB_R, TOP + 1.6, HUB_TOP - TOP - 1.6, P, 32, 0.4), { tone: "mid", crease: "none" });
}
function hubCap() {
  return S(k.cylinder(C.x, C.y, HUB_R - 1.2, HUB_TOP, 1.4, P, 28, 0.4), { tone: "hi", crease: "lo" }) + D([at([C.x, C.y, HUB_TOP + 1.4])], { size: 0.6 });
}

// ---------- the producer ----------
function producer() {
  const out = [person(P, [PTABLE.x + 21, PTABLE.y - 7, 0], { scale: 0.85, hat: "cap" })];
  out.push(S(k.slabOf(PTABLE, 0, PTABLE_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(PTABLE, 1.8), PTABLE_H, P), { tone: "faint" }) }));
  const front = PTABLE.y + PTABLE.d;
  out.push(digitCounter(P, { x: PTABLE.x + 4, y: front, z: 8, count: 3, w: 3.6, h: 4.4, gap: 0.5, pad: 0.8, name: "waiting" }));
  out.push(label(PTABLE.x + 19.5, front, 9.2, t("WAITING", "EN ESPERA"), 2.3));
  out.push(digitCounter(P, { x: PTABLE.x + 4, y: front, z: 1.8, count: 3, w: 3.6, h: 4.4, gap: 0.5, pad: 0.8, name: "stall" }));
  out.push(label(PTABLE.x + 19.5, front, 3, t("STALLED S", "DETENIDO S"), 2.3));
  return out.join("");
}
// The flag on the producer's table: up and lit while the producer is blocked.
function producerFlag() {
  const x = PTABLE.x + 3, y = PTABLE.y + 3, z = PTABLE_H;
  const pole = L(k.segment([x, y, z], [x, y, z + 13], P), { tone: "mid" });
  const iso = at;
  const flag = (lit) => `<path class="wb-pennant"${lit ? " data-lit" : ""} d="${k.pathOf([iso([x, y, z + 13]), iso([x + 7, y, z + 10.4]), iso([x, y, z + 7.8])], true)}"/>`;
  return `${pole}<g data-flag="off">${flag(false)}</g><g data-flag="on" style="display:none">${flag(true)}</g>`
    + S(k.cylinder(x, y, 1.4, z, 0.8, P, 14), { tone: "lo", crease: "none" });
}

// ---------- the reader ----------
function reader() {
  const out = [person(P, [DESK.x + 22, DESK.y - 7, 0], { scale: 0.85 })];
  out.push(S(k.slabOf(DESK, 0, DESK_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(DESK, 1.8), DESK_H, P), { tone: "faint" }) }));
  const front = DESK.y + DESK.d;
  out.push(digitCounter(P, { x: DESK.x + 4, y: front, z: 2.4, count: 3, w: 3.6, h: 4.4, gap: 0.5, pad: 0.8, name: "gaps" }));
  out.push(label(DESK.x + 19.5, front, 3.6, t("GAPS SEEN", "SALTOS VISTOS"), 2.3));
  return out.join("");
}
function tray() {
  const out = [S(k.slabOf(TRAY, 0, TRAY_H, P, 3, 0.4), { tone: "mid", inner: L(k.planOutline(k.insetPlan(TRAY, 1.6), TRAY_H, P), { tone: "lo" }) })];
  const front = TRAY.y + TRAY.d;
  out.push(digitCounter(P, { x: TRAY.x + 4, y: front, z: 1.3, count: 4, w: 3.4, h: 4.2, gap: 0.5, pad: 0.8, name: "read" }));
  out.push(label(TRAY.x + 24, front, 2.4, t("READ", "LEÍDOS"), 2.3));
  return out.join("");
}

// ---------- the bin ----------
const wall = (plan, z0, h) => S(k.slabOf(plan, z0, h, P, 2), { tone: "mid", crease: "none" });
function binBack() {
  const out = [S(k.slabOf(BIN, 0, 0.9, P, 3), { tone: "lo" })];
  out.push(wall({ x: BIN.x, y: BIN.y, w: BIN.w, d: 1.2, r: 0.3 }, 0.9, BIN_H - 0.9), wall({ x: BIN.x, y: BIN.y, w: 1.2, d: BIN.d, r: 0.3 }, 0.9, BIN_H - 0.9));
  return out.join("");
}
function binFront() {
  const front = BIN.y + BIN.d;
  const out = [wall({ x: BIN.x + BIN.w - 1.2, y: BIN.y, w: 1.2, d: BIN.d, r: 0.3 }, 0.9, BIN_H - 0.9), wall({ x: BIN.x, y: front - 1.2, w: BIN.w, d: 1.2, r: 0.3 }, 0.9, BIN_H - 0.9)];
  out.push(digitCounter(P, { x: BIN.x + 4, y: front, z: 2, count: 3, w: 3.6, h: 4.6, gap: 0.5, pad: 0.8, name: "lost" }));
  out.push(label(BIN.x + 19.5, front, 3.2, t("LOST", "PERDIDOS"), 2.3));
  return out.join("");
}

// ---------- the console ----------
const POLICIES = {
  overwrite: t("OVERWRITE OLDEST", "SOBRESCRIBE EL VIEJO"),
  drop: t("DROP NEWEST", "DESCARTA EL NUEVO"),
  block: t("BLOCK PRODUCER", "FRENA AL PRODUCTOR"),
};
function consoleBox() {
  const out = [S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 3, 0.5), { tone: "mid" })];
  const front = CONSOLE.y + CONSOLE.d;
  out.push(digitCounter(P, { x: CONSOLE.x + 4, y: front, z: 1.8, count: 2, w: 4.2, h: 5.2, gap: 0.6, pad: 1, name: "fill" }));
  out.push(label(CONSOLE.x + 16.2, front, 3, t("IN USE /16", "OCUPADOS /16"), 2.3));
  out.push(digitCounter(P, { x: CONSOLE.x + 36, y: front, z: 1.8, count: 3, w: 4.2, h: 5.2, gap: 0.6, pad: 1, name: "lag" }));
  out.push(label(CONSOLE.x + 53.2, front, 3, t("LAG", "RETRASO"), 2.3));
  // the policy plate on top, one drawing per policy
  const pl = { x: CONSOLE.x + 4, y: CONSOLE.y + 3.5, w: 60, d: 8 };
  out.push(`<g data-policy-plate>${Object.entries(POLICIES).map(([key, text]) => `<g data-policy="${key}"${key === "overwrite" ? "" : ' style="display:none"'}>${plaque(P, { ...pl, z: CONSOLE_H, text, size: 3 })}</g>`).join("")}</g>`);
  // the FULL lamp: off and lit drawings
  const lx = CONSOLE.x + CONSOLE.w - 9, ly = CONSOLE.y + 7.5;
  const lamp = (lit) => S(k.cylinder(lx, ly, 3.4, CONSOLE_H, 1.4, P, 22), { tone: "mid", crease: "none" })
    + litFill(S(sphereOf([lx, ly, CONSOLE_H + 4], 2.8, P), { tone: "hi", crease: "lo", lit }));
  out.push(`<g data-lamp="off">${lamp(false)}</g><g data-lamp="on" style="display:none">${lamp(true)}</g>`);
  out.push(label(lx, CONSOLE.y + CONSOLE.d, 3, t("FULL", "LLENO"), 2.3, { anchor: "middle" }));
  return out.join("");
}

// An item: a puck with its sequence number on top, drawn at the origin and moved with translateAlong.
export function tokenSvg() {
  const out = [litFill(S(k.cylinder(0, 0, TOKEN.r, 0, TOKEN.h, P, 26, 0.3), { tone: "hi", crease: "lo" })).replace('class="iso-solid"', 'class="iso-solid" data-body')];
  out.push(faceText(P, [0, 0.8, TOKEN.h], "0", { face: "top", size: 3, tone: "hi", anchor: "middle", attr: "data-seq" }));
  return `<g class="wb-lit-group">${out.join("")}</g>`;
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A ring buffer on a base plate: a round table with 16 numbered pockets in a circle and two hands on a central hub. The long solid hand points at the pocket the writer fills next; the shorter hand with a ring at its tip points at the pocket the reader takes next. Each item is a puck with its sequence number on top. At the back left a producer stands at a table where items it cannot place yet pile up, with a flag that rises when it is blocked. At the back right a reader holds the items it is reading at a desk and drops finished ones into a tray. At the front left a bin collects lost items. A console at the front shows the policy, how full the ring is, how far the reader lags behind the writer, and a lamp that lights when the ring is full.",
      "Un búfer circular sobre una placa base: una mesa redonda con 16 huecos numerados en círculo y dos manecillas en un eje central. La manecilla larga y sólida apunta al hueco que el escritor llena después; la más corta, con un anillo en la punta, al hueco que el lector toma después. Cada elemento es una ficha con su número de secuencia arriba. Atrás a la izquierda, un productor está en una mesa donde se apilan los elementos que todavía no puede poner, con un banderín que se levanta cuando está bloqueado. Atrás a la derecha, un lector sostiene en un escritorio los elementos que está leyendo y deja los terminados en una bandeja. Adelante a la izquierda, un cesto junta los elementos perdidos. Una consola al frente muestra la política, qué tan lleno está el anillo, cuánto se atrasa el lector respecto del escritor y una lámpara que se enciende cuando el anillo está lleno.",
    ),
    body: [
      plate(),
      binBack(),
      `<g data-layer="bin"></g>`,
      binFront(),
      table(),
      `<g data-layer="ring"></g>`,
      hands(["r", "w"], false),
      hub(),
      hands(["r", "w"], true),
      hubCap(),
      producer(),
      `<g data-layer="prod"></g>`,
      producerFlag(),
      reader(),
      `<g data-layer="desk"></g>`,
      tray(),
      `<g data-layer="tray"></g>`,
      consoleBox(),
      `<g data-layer="fly"></g>`,
    ],
  });
}

export const GEOMETRY = { CAP, SLOT, PROD_SPOT, BACKLOG, HAND_SPOTS, TRAY_SPOT, BIN_SPOTS, TOKEN };

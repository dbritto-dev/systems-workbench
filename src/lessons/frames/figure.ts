// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A frame conveyor. The belt is a time line: it runs right to left at a steady speed, driven by the vsync drum, so a
// block's length on it is how long that work took. The main thread (a worker at the NOW gantry) lays its work onto the
// belt as it does it: tall blocks for tasks, low steps for a frame's JS, style, layout and paint; the lamps on the bench
// behind light the stage under way. At every vsync a rib is pressed into the belt; when a new picture reaches the screen
// at that tick, a card stands at the rib, so a missing card is a dropped frame. In front, the click lane: a pennant
// where each click happened and a bar from it to the paint that showed its answer, against a ruler of ms ago.
// At the right, the compositor on its console puts frames on the screen.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, meter, lamp, dial, card, pennant, sign, plaque, person, figurine, faceText, variants, litFill } from "../../../workbench/parts.mjs";
import { sphereOf } from "../../../workbench/vendor-anatomy/kit/lathe.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 760;
export const HEIGHT = 470;

const PLATE = { x: -104, y: -66, w: 242, d: 116, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

export const MS = 0.7;                       // belt units per ms of page time
export const NOW_X = 60, BX0 = -92;          // the belt runs from BX0 (oldest) to NOW_X (now)
export const BELT = { y0: -20, y1: 0, z: 10 };
export const LANE = { y0: 5, y1: 15, z: 2.4 };
export const BLOCK = { y0: -18.5, y1: -9 };
export const HEIGHTS = { task: 8, input: 6.4, js: 5, style: 3, layout: 4, paint: 2.2 };
export const CARD = { y: -3, w: 3.6, h: 6.4 };
export const DRUM = { x: 71, y: -10, r: 8 };
const BENCH = { x: -46, y: -53, w: 82, d: 11, r: 1.2, h: 11 };
export const LAMP_X = [0, 1, 2, 3, 4, 5].map((i) => -39 + 13.2 * i);
const WORKER = [67, -33];
const CABINET = { x: 82, y: -58, w: 44, d: 24, r: 1.5, h: 13 };
const SCREEN = { x: 85, y: -60, w: 38, d: 4, r: 0.8, z0: 13, z1: 42 };
export const TRACK = { x0: 91, x1: 117, y: SCREEN.y + SCREEN.d, z: 28 };
export const BALL_R = 2.4;
export const BUTTON = { x: 99, y: 31 };
const GAUGE = { x: 109, y: 22, w: 23, d: 10, h: 14 };
const STAGE_WORDS = [t("TASK", "TAREA"), t("INPUT", "ENTRADA"), "JS", t("STYLE", "ESTILO"), "LAYOUT", t("PAINT", "PINTURA")];

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [SCREEN.x, SCREEN.y, SCREEN.z1 + 2], [SCREEN.x + SCREEN.w, SCREEN.y, SCREEN.z1 + 2], [NOW_X, BELT.y0 - 3, 30], [WORKER[0], WORKER[1], 24]],
  WIDTH, HEIGHT, { pad: 14, azimuth: 56 },
);

const { S, L, D, at } = shorthand(P);
const slab = (plan, z, h, steps = 3, bevel = 0) => k.slabOf(plan, z, h, P, steps, bevel);
const text = (x, y, z, words, size = 2.8, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });

// ---------- live pieces, drawn at the origin and moved along x by the live code ----------
// A block of main-thread work from x = 0 to x = len (belt units).
export function blockSvg(kind, len, lit = false) {
  const h = HEIGHTS[kind];
  return S(slab({ x: 0, y: BLOCK.y0, w: Math.max(0.4, len), d: BLOCK.y1 - BLOCK.y0, r: 0.25 }, BELT.z, h, 2, 0.15), { tone: kind === "task" ? "mid" : "hi", crease: "lo", lit });
}
export const ribSvg = () => S(slab({ x: -0.4, y: BELT.y0 + 0.6, w: 0.8, d: BELT.y1 - BELT.y0 - 1.2, r: 0.2 }, BELT.z, 0.7, 2), { tone: "lo", crease: "none" });
export const cardSvg = (lit = false) => litFill(card(P, { x: -CARD.w / 2, y: CARD.y, z: BELT.z, w: CARD.w, h: CARD.h, lit }));
export const pennantSvg = (lit = false) => pennant(P, { x: 0, y: LANE.y0 + 4, z: LANE.z, height: 9, length: 5, drop: 3.6, lit });
export function spanSvg(len, lit = false) {
  return S(slab({ x: 0, y: LANE.y0 + 2.6, w: Math.max(0.4, len), d: 3.4, r: 0.4 }, LANE.z, 0.8, 2), { tone: "hi", crease: "none", lit });
}

// ---------- the plate and the belt ----------
function belt() {
  const out = [];
  for (const x of [-80, -46, -12, 22, 52]) for (const y of [BELT.y0 + 3, BELT.y1 - 3]) out.push(S(k.cylinder(x, y, 1.5, 0, BELT.z - 1, P, 14), { tone: "mid", crease: "none" }));
  const bed = { x: BX0 - 3, y: BELT.y0, w: NOW_X - BX0 + 3, d: BELT.y1 - BELT.y0, r: 1 };
  out.push(S(slab(bed, BELT.z - 2.4, 2.4, 3), { tone: "mid" }));
  // the tail roller at the left end
  out.push(S(slab({ x: BX0 - 6, y: BELT.y0 - 0.6, w: 4, d: BELT.y1 - BELT.y0 + 1.2, r: 1.8 }, BELT.z - 4, 4.2, 4), { tone: "hi", crease: "lo" }));
  out.push(L(k.lineOnTop([BX0, BELT.y0 + 1], [NOW_X, BELT.y0 + 1], BELT.z, P) + k.lineOnTop([BX0, BELT.y1 - 1], [NOW_X, BELT.y1 - 1], BELT.z, P), { tone: "faint" }));
  return out.join("");
}

// The click lane in front: a low rail with a ruler of ms before now and a line at 200 ms.
function lane() {
  const out = [S(slab({ x: BX0 - 3, y: LANE.y0, w: NOW_X - BX0 + 3, d: LANE.y1 - LANE.y0, r: 1 }, 0, LANE.z, 3), { tone: "mid" })];
  const ticks = [];
  for (let ms = 0; ms <= 210; ms += 10) {
    const x = NOW_X - ms * MS, major = ms % 50 === 0;
    ticks.push(k.lineOnTop([x, LANE.y1 - 0.8], [x, LANE.y1 - (major ? 3 : 1.8)], LANE.z, P));
  }
  out.push(L(ticks.join(""), { tone: "lo" }));
  for (const ms of [50, 100, 150]) out.push(faceText(P, [NOW_X - ms * MS, LANE.y1 + 4.4, 0], String(ms), { face: "top", size: 3, tone: "lo", anchor: "middle" }));
  const x200 = NOW_X - 200 * MS;
  out.push(S(slab({ x: x200 - 0.5, y: LANE.y0 + 0.4, w: 1, d: LANE.y1 - LANE.y0 - 0.8, r: 0.2 }, LANE.z, 1.4, 2), { tone: "hi", crease: "lo" }));
  out.push(faceText(P, [x200, LANE.y1 + 4.4, 0], "200 ms", { face: "top", size: 3, tone: "mid", anchor: "middle" }));
  out.push(faceText(P, [NOW_X - 8, LANE.y1 + 9.6, 0], t("CLICK → NEXT PAINT", "CLIC → SIGUIENTE PINTURA"), { face: "top", size: 3, tone: "mid", anchor: "end" }));
  out.push(faceText(P, [BX0 - 2, LANE.y1 + 9.6, 0], t("← EARLIER", "← ANTES"), { face: "top", size: 3, tone: "lo" }));
  return out.join("");
}

// The NOW gantry over the head of the belt.
function gantry() {
  const out = [];
  for (const y of [BELT.y0 - 2.4, BELT.y1 + 1.6]) out.push(S(slab({ x: NOW_X - 0.9, y: y - 0.8, w: 1.8, d: 1.6, r: 0.4 }, 0, 24, 2), { tone: "mid", crease: "none" }));
  out.push(S(slab({ x: NOW_X - 1.3, y: BELT.y0 - 3.4, w: 2.6, d: BELT.y1 - BELT.y0 + 6, r: 0.5 }, 24, 2.2, 2), { tone: "hi", crease: "lo" }));
  out.push(sign(P, { x: NOW_X - 8, y: BELT.y1 + 3.4, z: 17, w: 16, h: 6, text: t("NOW", "AHORA"), size: 3, posts: false }));
  return out.join("");
}

// The vsync drum that drives the belt: a dial whose needle turns once per frame, and a plaque with the rate.
function drum() {
  const out = [dial(P, { x: DRUM.x, y: DRUM.y, z: 0, r: DRUM.r, h: BELT.z + 1, ticks: 40, every: 5, name: "vsync", label: "VSYNC" })];
  const hz = (n, ms) => plaque(P, { x: DRUM.x - 9, y: 4, z: 0, w: 31, d: 7, text: n + " Hz · " + ms + " ms", size: 2.7 });
  out.push(variants("hz", { "60": hz(60, "16.7"), "120": hz(120, "8.3") }, "60"));
  return out.join("");
}

// The main thread's bench: one lamp per stage, the stage's name under it.
function bench() {
  const out = [S(slab(BENCH, 0, BENCH.h, 3, 0.5), { tone: "mid" })];
  const front = BENCH.y + BENCH.d;
  STAGE_WORDS.forEach((w, i) => {
    const x = LAMP_X[i];
    out.push(variants("lamp-" + i, { off: lamp(P, [x, BENCH.y + 5, BENCH.h], { r: 2.6 }), on: litFill(lamp(P, [x, BENCH.y + 5, BENCH.h], { r: 2.6, lit: true })) }, "off"));
    out.push(text(x, front, 6.4, w, 2.8, { anchor: "middle" }));
  });
  // the frame's stages, JS to paint, bracketed under their lamps
  out.push(L(k.segment([LAMP_X[2] - 5, front, 4.6], [LAMP_X[5] + 5, front, 4.6], P), { tone: "lo" }));
  out.push(text((LAMP_X[2] + LAMP_X[5]) / 2, front, 1.6, t("ONE FRAME", "UN FRAME"), 2.6, { anchor: "middle", tone: "lo" }));
  out.push(text((LAMP_X[0] + LAMP_X[1]) / 2, front, 1.6, t("MAIN THREAD", "HILO PRINCIPAL"), 2.6, { anchor: "middle", tone: "lo" }));
  return out.join("");
}

// The compositor's cabinet, the screen on it, and the frame counters on its front.
function cabinet() {
  const c = CABINET, front = c.y + c.d, out = [S(slab(c, 0, c.h, 3, 0.5), { tone: "mid" })];
  out.push(digitCounter(P, { x: c.x + 4, y: front, z: 2, count: 4, w: 3.6, h: 4.8, gap: 0.5, pad: 1, name: "frames" }));
  out.push(text(c.x + 4, front, 8.6, "FRAMES", 2.6));
  out.push(digitCounter(P, { x: c.x + 24, y: front, z: 2, count: 4, w: 3.6, h: 4.8, gap: 0.5, pad: 1, name: "missed" }));
  out.push(text(c.x + 24, front, 8.6, t("MISSED", "PERDIDOS"), 2.6));
  out.push(faceText(P, [c.x + c.w - 3, front - 5, c.h], "COMPOSITOR", { face: "top", size: 2.8, tone: "mid", anchor: "end" }));
  return out.join("");
}
function screen() {
  const out = [];
  const face = SCREEN.y + SCREEN.d;
  const inner = L(k.faceRectY(P, SCREEN.x + 2.2, SCREEN.x + SCREEN.w - 2.2, face, SCREEN.z0 + 5, SCREEN.z1 - 2.2), { tone: "lo" });
  out.push(S(slab(SCREEN, SCREEN.z0, SCREEN.z1 - SCREEN.z0, 2, 0.3), { tone: "hi", crease: "lo", inner }));
  out.push(L(k.segment([TRACK.x0 - 2, face, TRACK.z - BALL_R], [TRACK.x1 + 2, face, TRACK.z - BALL_R], P), { tone: "lo" }));
  out.push(text(SCREEN.x + SCREEN.w / 2, face, SCREEN.z0 + 1.4, t("SCREEN", "PANTALLA"), 2.6, { anchor: "middle", tone: "lo" }));
  return out.join("");
}
export const ballSvg = () => S(sphereOf([0, TRACK.y + BALL_R, TRACK.z], BALL_R, P, { steps: 24 }), { tone: "hi", crease: "lo" });

// The user's corner: the click button and a meter of the last click's time to paint (red zone past 200 ms).
function clickCorner() {
  const b = BUTTON, out = [S(k.cylinder(b.x, b.y, 4.6, 0, 4, P, 28, 0.4), { tone: "mid" })];
  out.push(variants("button", { up: S(k.cylinder(b.x, b.y, 3.2, 4, 2.2, P, 24, 0.4), { tone: "hi", crease: "lo" }), down: litFill(S(k.cylinder(b.x, b.y, 3.2, 4, 1, P, 24, 0.4), { tone: "hi", crease: "lo", lit: true })) }, "up"));
  out.push(faceText(P, [b.x, b.y + 9.2, 0], t("CLICK", "CLIC"), { face: "top", size: 3, tone: "mid", anchor: "middle" }));
  const g = GAUGE, front = g.y + g.d;
  out.push(S(slab({ x: g.x, y: g.y, w: g.w, d: g.d, r: 1 }, 0, g.h, 3, 0.4), { tone: "mid" }));
  out.push(meter(P, { x: g.x + g.w / 2, y: front, z: 4.6, r: 7, ticks: 10, zone: 0.4, name: "click" }));
  out.push(text(g.x + g.w / 2, front, 1.4, "0 – 500 ms", 2.4, { anchor: "middle", tone: "lo" }));
  out.push(faceText(P, [g.x + g.w / 2, g.y + 6.4, g.h], t("LAST CLICK", "ÚLTIMO CLIC"), { face: "top", size: 2.6, tone: "mid", anchor: "middle" }));
  return out.join("");
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A frame conveyor on a base plate. A long belt runs from right to left at a steady speed, driven by a drum at its right end whose dial turns once per vsync, so distance along the belt is time. At the NOW gantry over the belt's head, the main thread, a worker, lays its work onto the belt as it does it: tall blocks are tasks, a medium block is a click handler, and low steps are a frame's JavaScript, style, layout and paint. Behind the worker, a bench has a lamp for each stage, lit while that stage runs. At every vsync a rib is pressed into the belt, and when a new picture reaches the screen at that tick a card stands at the rib; a rib without a card is a missed frame. In front, a lane marks each click with a pennant and draws a bar from it to the paint that showed its result, against a ruler of milliseconds with a line at 200 ms. At the right, the compositor's console counts frames shown and missed and has a meter for the last click's latency, and behind it the screen shows a ball moving along a track. A user stands at a click button in front.",
      "Una cinta de frames sobre una placa base. Una cinta larga corre de derecha a izquierda a velocidad constante, movida por un tambor en su extremo derecho cuyo dial da una vuelta por cada vsync, así que la distancia a lo largo de la cinta es tiempo. En el pórtico AHORA, sobre la cabeza de la cinta, el hilo principal, un trabajador, va dejando su trabajo sobre la cinta mientras lo hace: los bloques altos son tareas, un bloque mediano es un handler de clic, y los escalones bajos son el JavaScript, el estilo, el layout y la pintura de un frame. Detrás del trabajador, un banco tiene una lámpara por etapa, encendida mientras esa etapa corre. En cada vsync se marca una costilla en la cinta, y cuando una imagen nueva llega a la pantalla en ese tick, una tarjeta se para junto a la costilla; una costilla sin tarjeta es un frame perdido. Al frente, un carril marca cada clic con un banderín y traza una barra desde él hasta la pintura que mostró su resultado, sobre una regla de milisegundos con una línea en 200 ms. A la derecha, la consola del compositor cuenta los frames mostrados y perdidos y tiene un medidor de la latencia del último clic, y detrás de ella la pantalla muestra una bola que se mueve por un riel. Una persona está frente a un botón de clic.",
    ),
    body: [
      basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H }),
      bench(),
      cabinet(),
      screen(),
      `<g data-ball transform="${k.translateAlong(P, [TRACK.x0, 0, 0])}">${ballSvg()}</g>`,
      variants("comp", { off: figurine(P, [CABINET.x + 9, CABINET.y + 13, CABINET.h], { scale: 0.8 }), on: litFill(figurine(P, [CABINET.x + 9, CABINET.y + 13, CABINET.h], { scale: 0.8, lit: true })) }, "off"),
      person(P, [WORKER[0], WORKER[1], 0], { scale: 0.9 }),
      belt(),
      `<g data-layer="ribs"></g><g data-layer="blocks"></g><g data-layer="cards"></g>`,
      gantry(),
      drum(),
      lane(),
      `<g data-layer="lane"></g>`,
      clickCorner(),
      person(P, [76, 40, 0], { scale: 0.85 }),
    ],
  });
}

export const GEOMETRY = { MS, NOW_X, BX0, BELT, LANE, BLOCK, HEIGHTS, CARD, DRUM, TRACK, BALL_R, LAMP_X };

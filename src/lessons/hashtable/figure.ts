// @ts-nocheck: figure code ported as-is; drawing shorthands come from src/lib/draw.
// A pigeonhole rack on one base plate.
//   Back: 16 numbered trays (buckets) in two rows of eight, the back row on a step. Only the first m are open; the
//         rest wait under lids until the table doubles. In chaining a tray holds a pile of cards (its chain); in linear probing, one card.
//   Left: the hash stamp. A key card stands on a shuttle under the stamp's head, which prints its bucket number on
//         the BUCKET counter; the shuttle then runs along the rail to that tray (and on to the next ones when probing).
//   Front: a load-factor meter (the shaded band is past 75%), and counters for keys,
//         probes on the last operation, the longest chain or run, and keys moved by resizing.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, faceText, meter, card } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand, hiddenUnless } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -136, y: -64, w: 230, d: 88, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// ---------- the rack of trays ----------
// Two rows of eight: buckets 0–7 in front, 8–15 on a raised step behind. A table of 8 uses the front row; doubling
// takes the lids off the back row.
export const SLOTS = 16;                                  // trays drawn; the table uses the first m
export const COLS = 8;
export const PILE = 8;                                    // cards drawn per pile; more shows as "+n"
export const TRAY = { x0: -84, pitch: 18.5, w: 15.5, d: 14 };
const ROW_Y = [-38, -58];                                 // front row, back row (tray's back edge)
const RB = { x: TRAY.x0 - 4, y: ROW_Y[0] - 3, w: COLS * TRAY.pitch + 5, d: TRAY.d + 6, r: 2 };   // front base
const STEP = { x: RB.x, y: ROW_Y[1] - 3, w: RB.w, d: ROW_Y[0] - 3 - (ROW_Y[1] - 3), r: 2 };     // raised back step
export const RB_H = 5, STEP_H = 15;
const TRAY_H = 1.2;
export const CARD_TH = 1.4, CARD_PITCH = 1.75;
const row = (i) => (i < COLS ? 0 : 1);
export const trayX = (i) => TRAY.x0 + (i % COLS) * TRAY.pitch;
export const trayY = (i) => ROW_Y[row(i)];
export const trayCx = (i) => trayX(i) + TRAY.w / 2;
const baseZ = (i) => (row(i) ? STEP_H : RB_H);
export const pileZ = (i, s) => baseZ(i) + TRAY_H + s * CARD_PITCH;
const cardPlan = (i) => ({ x: trayX(i) + 2, y: trayY(i) + 2, w: TRAY.w - 4, d: TRAY.d - 4, r: 0.6 });

// ---------- rail, shuttle and stamp ----------
const RAIL = { x: -131, y: -19, w: COLS * TRAY.pitch + 53, d: 3.2, r: 1 };
const RAIL_H = 1.6;
export const HOME_X = -124;                               // shuttle under the stamp
const PRESS = { x: -130, y: -58, w: 30, d: 28, r: 2 };
const PRESS_H = 14;
const COL = { x: -124, y: -51 };
const HEAD = { y: -20.5, w: 11, d: 8, r: 1 };
export const HEAD_Z = 17;
const ARM_Z = 22;

// ---------- front ----------
const FEED = { x: -112, y: -48, w: 8, d: 10, r: 0.6 };       // waiting keys, on top of the stamp's base
const BENCH = { x: -118, y: 8, w: 202, d: 10, r: 1.5 };
const BENCH_H = 9;
export const METER = { x: BENCH.x + 10, y: BENCH.y + BENCH.d, z: 1.8, r: 6, max: 1.5 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [COL.x, COL.y, ARM_Z + 4], [STEP.x + STEP.w, STEP.y, pileZ(SLOTS - 1, PILE) + 5], [STEP.x, STEP.y, pileZ(SLOTS - 1, PILE) + 5]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 60 },
);

const { S, L, text } = shorthand(P);
const hidden = hiddenUnless;

export const COUNTERS = {
  bucket: { x: PRESS.x + 15, y: PRESS.y + PRESS.d, z: 2, w: 5, h: 6, gap: 0.7, count: 2, size: "s" },
  keys: { x: BENCH.x + 44, y: BENCH.y + BENCH.d, z: 1.6, w: 5, h: 5.8, gap: 0.8, count: 2, size: "s" },
  probes: { x: BENCH.x + 84, y: BENCH.y + BENCH.d, z: 1.6, w: 5, h: 5.8, gap: 0.8, count: 2, size: "s" },
  longest: { x: BENCH.x + 124, y: BENCH.y + BENCH.d, z: 1.6, w: 5, h: 5.8, gap: 0.8, count: 2, size: "s" },
  moved: { x: BENCH.x + 164, y: BENCH.y + BENCH.d, z: 1.6, w: 5, h: 5.8, gap: 0.8, count: 2, size: "s" },
};

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H });
}

// A flat card on pile level s of tray i.
export const pileCard = (i, s, lit = false) => S(k.slabOf(cardPlan(i), pileZ(i, s), CARD_TH, P, 3, 0.2), { tone: "hi", crease: "lo", lit });

function trays(state, from, to) {
  const out = [];
  for (let i = from; i < to; i++) {
    const x = trayX(i), y = trayY(i), z = baseZ(i), plan = { x, y, w: TRAY.w, d: TRAY.d, r: 1 };
    out.push(S(k.slabOf(plan, z, TRAY_H, P, 3, 0.3), { tone: "lo", crease: "lo" }));
    out.push(L(k.planOutline(k.insetPlan(plan, 1), z + TRAY_H, P), { tone: "mid" }));
    const pile = state.piles[i] || 0;
    for (let s = 0; s < PILE; s++) out.push(`<g class="wb-lit-group" data-c="${i}-${s}"${hidden(s < pile)}>${pileCard(i, s)}</g>`);
    out.push(`<g data-more="${i}"${hidden(pile > PILE)}>${text(trayCx(i), y + TRAY.d - 1, pileZ(i, PILE) + 2.6, pile > PILE ? "+" + (pile - PILE) : "", { size: 3.2, tone: "hi", anchor: "middle", attr: `data-more-label="${i}"` })}</g>`);
    // Lid over a tray the table doesn't use yet, with a handle.
    const lid = { x: x - 0.3, y: y - 0.3, w: TRAY.w + 0.6, d: TRAY.d + 0.6, r: 1.2 };
    const knob = { x: x + TRAY.w / 2 - 4, y: y + TRAY.d / 2 - 1, w: 8, d: 2, r: 0.8 };
    out.push(`<g data-lid="${i}"${hidden(i >= state.m)}>${S(k.slabOf(lid, z + TRAY_H, 2.4, P, 3, 0.3), { tone: "mid", crease: "lo" })}${S(k.slabOf(knob, z + TRAY_H + 2.4, 1.2, P, 2, 0.2), { tone: "hi", crease: "lo" })}</g>`);
  }
  return out.join("");
}

function rack(state) {
  const out = [];
  // Back step and its row first, then the front base and its row, so nearer things draw over farther ones.
  out.push(S(k.slabOf(STEP, 0, STEP_H, P, 4, 0.5), { tone: "mid" }));
  out.push(trays(state, COLS, SLOTS));
  for (let i = COLS; i < SLOTS; i++) out.push(text(trayCx(i), STEP.y + STEP.d, RB_H + 3.4, String(i), { size: 3, tone: "mid", anchor: "middle" }));
  out.push(S(k.slabOf(RB, 0, RB_H, P, 4, 0.5), { tone: "mid" }));
  for (let i = 0; i < SLOTS; i++) {
    const front = row(i) ? STEP.y + STEP.d : RB.y + RB.d, z = row(i) ? RB_H + 2.4 : 1.2;
    if (row(i) === 0) out.push(text(trayCx(i), front, z, String(i), { size: 3, tone: "mid", anchor: "middle" }));
  }
  out.push(trays(state, 0, COLS));
  return out.join("");
}

// The shuttle, drawn at x = 0 and moved along the rail with a transform: a lit carriage and an upright key card.
function shuttle(state) {
  const carriage = { x: -5.5, y: RAIL.y - 1, w: 11, d: 5.2, r: 0.8 };
  const body = S(k.slabOf(carriage, RAIL_H, 1.8, P, 3, 0.3), { tone: "hi", crease: "lo", lit: true })
    + `<g data-keycard>${card(P, { x: -6, y: RAIL.y + 2.6, z: RAIL_H + 1.8, w: 12, h: 9.5, text: state.key, sub: "→ " + state.home, size: 3.4, subSize: 2.6, attr: "data-key-label", subAttr: "data-key-sub" })}</g>`;
  return `<g data-shuttle transform="${k.translateAlong(P, [state.x, 0, 0])}">${body}</g>`;
}

// The falling card that lands on a pile (drawn on tray 0, moved by the live script).
const flyCard = () => `<g class="wb-lit-group" data-fly style="display:none">${pileCard(0, 0, true)}</g>`;

function stamp(state) {
  const out = [];
  out.push(S(k.slabOf(PRESS, 0, PRESS_H, P, 4, 0.5), { tone: "mid" }));
  out.push(text(PRESS.x + 15, PRESS.y + PRESS.d, 9.6, t("BUCKET", "CUBETA"), { size: 2.2, tone: "mid" }));
  out.push(digitCounter(P, { ...COUNTERS.bucket, housing: false, name: "bucket", value: state.home }));
  // Keys waiting to go in: a short pile of cards on the stamp's base.
  for (let s = 0; s < 4; s++) out.push(S(k.slabOf({ ...FEED, x: FEED.x + s * 0.25 }, PRESS_H + s * 1.5, 1.2, P, 2, 0.2), { tone: "hi", crease: "lo" }));
  // Column, an arm reaching over the rail, and the stamp head (moved by the live script).
  out.push(S(k.cylinder(COL.x, COL.y, 1.6, PRESS_H, ARM_Z + 2 - PRESS_H, P, 16), { tone: "mid", crease: "none" }));
  const arm = { x: COL.x - 2.2, y: COL.y - 1.4, w: 4.4, d: HEAD.y + HEAD.d / 2 + 1.4 - (COL.y - 1.4), r: 0.6 };
  out.push(S(k.slabOf(arm, ARM_Z, 2, P, 2, 0.2), { tone: "mid", crease: "lo" }));
  out.push(S(k.cylinder(COL.x, HEAD.y + HEAD.d / 2, 0.9, HEAD_Z + 3, ARM_Z - HEAD_Z - 3, P, 12), { tone: "mid", crease: "none" }));
  const head = S(k.slabOf({ ...HEAD, x: COL.x - HEAD.w / 2 }, 0, 3, P, 3, 0.3), { tone: "hi", crease: "lo" });
  out.push(`<g class="wb-lit-group" data-head transform="${k.translateAlong(P, [0, 0, HEAD_Z])}">${head}</g>`);
  return out.join("");
}

// The front bench: the load-factor gauge (0 to 1.5 keys per bucket; the shaded band is past 0.75, where this table
// doubles) and four counters.
function front(state) {
  const out = [];
  out.push(S(k.slabOf(BENCH, 0, BENCH_H, P, 4, 0.5), { tone: "mid" }));
  out.push(meter(P, { x: METER.x, y: METER.y, z: METER.z, r: METER.r, ticks: 6, zone: 0.75 / METER.max, name: "load", value: state.load / METER.max }));
  out.push(text(METER.x + METER.r + 2.4, METER.y, 3.4, t("LOAD", "CARGA"), { size: 2.4, tone: "mid" }));
  const labels = { keys: t("KEYS", "CLAVES"), probes: t("CHECKS", "REVISIONES"), longest: t("LONGEST", "MÁS LARGA"), moved: t("MOVED", "MOVIDAS") };
  for (const [name, c] of Object.entries(COUNTERS)) {
    if (name === "bucket") continue;
    out.push(digitCounter(P, { ...c, housing: false, name, value: state[name] }));
    out.push(text(c.x + 12.8, c.y, c.z + 1.8, labels[name], { size: 2.4, tone: "mid" }));
  }
  return out.join("");
}

// The first frame, before the live script takes over: eight buckets, five keys stored (bucket 5 holds two), and the
// next key under the stamp.
export const FIRST = { m: 8, piles: [1, 0, 1, 0, 0, 2, 1, 0], key: "4821", home: 5, x: HOME_X, load: 5 / 8, keys: 5, probes: 2, longest: 2, moved: 0 };

export const GEOM = { SLOTS, PILE, HOME_X, HEAD_Z, METER_MAX: METER.max, CX: Array.from({ length: SLOTS }, (_, i) => trayCx(i)), Y: Array.from({ length: SLOTS }, (_, i) => trayY(i)), Z: Array.from({ length: SLOTS }, (_, i) => pileZ(i, 0)), CARD_PITCH };

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A hash table as a pigeonhole rack. At the back, sixteen numbered trays in two rows, the buckets; the back row sits on a step, and trays the table doesn't use yet are covered by lids. Cards pile up in a tray when keys share a bucket. On the left, a stamp computes each key's bucket and shows it on a counter; a shuttle carries the key card along a rail to that tray. A short pile of keys waits on the stamp's base. In front: a load-factor gauge with a shaded band past 75%, and counters for keys, probes, the longest chain and keys moved by resizing.",
      "Una tabla hash como un casillero. Atrás, dieciséis bandejas numeradas en dos filas, las cubetas; la fila de atrás está sobre un escalón, y las bandejas que la tabla todavía no usa están tapadas. Las tarjetas se apilan en una bandeja cuando varias claves comparten cubeta. A la izquierda, un sello calcula la cubeta de cada clave y la muestra en un contador; un carro lleva la tarjeta de la clave por un riel hasta esa bandeja. Sobre la base del sello espera una pila corta de claves. Adelante: un medidor del factor de carga con una franja sombreada pasado el 75% y contadores de claves, sondeos, la cadena más larga y las claves movidas al redimensionar.",
    ),
    body: [plate(), rack(FIRST), stamp(FIRST), S(k.slabOf(RAIL, 0, RAIL_H, P, 3, 0.3), { tone: "mid" }), shuttle(FIRST), flyCard(), front(FIRST)],
  });
}

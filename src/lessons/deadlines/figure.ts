// @ts-nocheck: figure code in the lessons' plain style; drawing shorthands come from src/lib/draw.
// A relay of desks: the client's desk, then the gateway, the service and the database, left to right. Every desk has
// a tray per worker; a docket on a tray is a call that worker holds. Dockets ride the lanes between the desks to the
// next hop and back. Each docket shows the time its client has left; it turns black once the client has its
// outcome, so a black docket is work nobody will use.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate, digitCounter, person, faceText, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { WORKERS } from "./sim";

export const WIDTH = 700;
export const HEIGHT = 440;

const PLATE = { x: -140, y: -50, w: 280, d: 84, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// Desks: 0 client, 1 gateway, 2 service, 3 database. Two rows of trays, PITCH apart.
const PITCH = 9, ROW = 9;
const DESK_Y = -30, DESK_D = 23, DESK_H = 16;
const COLS = [5, 5, 5, 3];
const DESK_X = [-123, -54, 15, 92];
export const DESKS = COLS.map((cols, i) => ({ x: DESK_X[i], y: DESK_Y, w: cols * PITCH + 4, d: DESK_D, r: 1.5 }));
export const TOP_Z = DESK_H + 0.6;
export const PADS = DESKS.map((d, i) => {
  const out = [];
  for (let row = 0; row < 2; row++) for (let col = 0; col < COLS[i]; col++) out.push([d.x + 6.5 + col * PITCH, d.y + 7 + row * ROW, TOP_Z]);
  return out;
});

// Lanes between desks: the incoming line of hop h (1..3) runs from the desk on its left up to its own desk.
export const LANE_Y = DESK_Y + DESK_D / 2, LANE_Z = 3.4;
export const LANES = [1, 2, 3].map((i) => {
  const x0 = DESKS[i - 1].x + DESKS[i - 1].w, x1 = DESKS[i].x;
  const n = Math.max(1, Math.floor((x1 - x0 - 3) / 9.5));
  return { x0, x1, spots: Array.from({ length: n }, (_, j) => [x1 - 6 - j * 9.5, LANE_Y, LANE_Z]) };
});
// The database's overflow table: where its line goes once the lane is full.
const TABLE = { x: 63, y: -1, w: 28, d: 28, r: 1.5 };
const TABLE_H = 11;
export const PILE = (() => {
  const out = [];
  for (let layer = 0; layer < 5; layer++) for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) out.push([TABLE.x + 5.5 + col * 8.5, TABLE.y + 5.5 + row * 8.5, TABLE_H + 0.3 + layer * 2.6]);
  return out;
})();
export const DOCKET = { w: 8, d: 7, h: 2.4 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [DESK_X[0] + 20, DESK_Y - 8, 26], [DESK_X[3] + 20, DESK_Y - 8, 26]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 45 },
);

const { S, L, D, at } = shorthand(P);

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -126, y: 21, w: 96, d: 6, r: 1 })
    + labelPlate(P, { x: 100, y: 8, w: 30, d: 14, r: 1.5 }, [[104, 13, 18], [104, 17.5, 22]]);
}

function lane(i) {
  const { x0, x1 } = LANES[i];
  const bed = { x: x0 - 1, y: LANE_Y - 6, w: x1 - x0 + 2, d: 12, r: 0.8 };
  const out = [S(k.slabOf(bed, 0, LANE_Z - 0.4, P, 2, 0.3), { tone: "mid" })];
  const rollers = [];
  for (let x = bed.x + 2.5; x < bed.x + bed.w - 1.5; x += 3) rollers.push(k.lineOnTop([x, bed.y + 1.6], [x, bed.y + bed.d - 1.6], LANE_Z - 0.4, P));
  out.push(L(rollers.join(""), { tone: "lo" }));
  for (const y of [bed.y + 0.1, bed.y + bed.d - 1.3]) out.push(S(k.slabOf({ x: bed.x, y, w: bed.w, d: 1.2, r: 0.3 }, LANE_Z - 0.4, 1.4, P, 2), { tone: "hi", crease: "none" }));
  return out.join("");
}

// The database's overflow table, with a counter of everything in its line.
function table() {
  const out = [S(k.slabOf(TABLE, 0, TABLE_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(TABLE, 2), TABLE_H, P), { tone: "faint" }) })];
  const front = TABLE.y + TABLE.d;
  out.push(digitCounter(P, { x: TABLE.x + 2.6, y: front, z: 1.2, count: 3, w: 3.4, h: 4.4, gap: 0.5, pad: 0.8, name: "queue" }));
  out.push(faceText(P, [TABLE.x + 2, front, 8.6], t("IN QUEUE", "EN COLA"), { size: 2.9, tone: "mid" }));
  return out.join("");
}

// "BASE DE DATOS" doesn't fit the side at a readable size; the texts also call it "la base".
const NAMES = [t("CLIENT", "CLIENTE"), t("GATEWAY", "GATEWAY"), t("SERVICE", "SERVICIO"), t("DATABASE", "BASE")];

// A desk: the body, a tray per worker, the station's name and its timeout on the right face, counters on the front.
function desk(i) {
  const d = DESKS[i], front = d.y + d.d, right = d.x + d.w, mid = d.y + d.d / 2;
  const out = [`<g data-desk="${i}">`];
  out.push(S(k.slabOf(d, 0, DESK_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(d, 1.8), DESK_H, P), { tone: "faint" }) }));
  out.push(PADS[i].map(([x, y]) => S(k.slabOf({ x: x - 4.1, y: y - 3.9, w: 8.2, d: 7.8, r: 0.6 }, DESK_H, 0.6, P, 2, 0.2), { tone: "lo", crease: "none" })).join(""));
  // right face: name, then what this hop waits for its call (live)
  // (kept above z 5, clear of the lane that leaves this face)
  out.push(faceText(P, [right, mid, 12.8], NAMES[i], { face: "x", size: 3, tone: "hi", anchor: "middle" }));
  out.push(faceText(P, [right, mid, 9.2], "TIMEOUT", { face: "x", size: 2.8, tone: "mid", anchor: "middle", attr: `data-tlabel="${i}"` }));
  out.push(faceText(P, [right, mid, 5.5], "", { face: "x", size: 3, tone: "hi", anchor: "middle", attr: `data-tvalue="${i}"` }));
  // front face: counters
  if (i === 0) {
    out.push(digitCounter(P, { x: d.x + 4, y: front, z: 2, count: 4, w: 4, h: 5.4, gap: 0.6, pad: 1.2, name: "ok" }));
    out.push(faceText(P, [d.x + 3, front, 11.2], t("IN TIME", "A TIEMPO"), { size: 3.2, tone: "mid" }));
    out.push(digitCounter(P, { x: d.x + 29, y: front, z: 2, count: 3, w: 4, h: 5.4, gap: 0.6, pad: 1.2, name: "late" }));
    out.push(faceText(P, [d.x + 28, front, 11.2], t("GAVE UP", "SE RINDIÓ"), { size: 3.2, tone: "mid" }));
  } else {
    out.push(digitCounter(P, { x: d.x + 4, y: front, z: 2, count: 3, w: 4, h: 5.4, gap: 0.6, pad: 1.2, name: "waste" + i }));
    out.push(faceText(P, [d.x + 3, front, 11.2], t("WASTED S", "S PERDIDOS"), { size: 3.2, tone: "mid" }));
  }
  out.push(`</g>`);
  return out.join("");
}

// Who works each desk, standing behind it.
function attendant(i) {
  const d = DESKS[i];
  return person(P, [d.x + d.w / 2, d.y - 7, 0], { scale: 1, hat: i === 0 ? null : "cap" });
}

/** A docket: a flat slip on its tray, the time its client has left printed on top. */
export function docketSvg() {
  const b = { x: -DOCKET.w / 2, y: -DOCKET.d / 2, w: DOCKET.w, d: DOCKET.d, r: 0.5 };
  return S(k.slabOf(b, 0, DOCKET.h, P, 2, 0.3), { tone: "hi", crease: "lo" }).replace('class="iso-solid"', 'class="iso-solid" data-body')
    + faceText(P, [0, 1, DOCKET.h], "2.0", { face: "top", size: 2.9, tone: "hi", anchor: "middle", attr: "data-left" });
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A relay of four desks on a base plate, left to right: the client, the gateway, the service and the database, each with a row of trays, one per worker, and an attendant behind it. Dockets ride short lanes from one desk to the next and back. Each docket shows the seconds its client has left; it turns black once the client has given up or had its answer, so black dockets are work nobody will use. Each desk shows on its right side how long it waits for the next one, and on its front how many worker-seconds it has wasted. An overflow table in front of the database holds its line.",
      "Una cadena de cuatro escritorios sobre una placa base, de izquierda a derecha: el cliente, el gateway, el servicio y la base de datos, cada uno con una fila de bandejas, una por trabajador, y un encargado detrás. Las fichas viajan por carriles cortos de un escritorio al siguiente y de vuelta. Cada ficha muestra los segundos que le quedan a su cliente; se vuelve negra cuando el cliente ya se rindió o ya tuvo su respuesta, así que las fichas negras son trabajo que nadie va a usar. Cada escritorio muestra en su costado derecho cuánto espera al siguiente, y al frente cuántos segundos de trabajo ha desperdiciado. Una mesa delante de la base de datos sostiene su cola.",
    ),
    // Painter's order, back to front along the relay: each lane and its dockets, the desk it leads to, the dockets on
    // that desk's trays; the database's overflow table stands in front of its desk.
    body: [
      plate(),
      DESKS.map((_, i) => attendant(i)).join(""),
      DESKS.map((_, i) => (i ? lane(i - 1) + `<g data-layer="lane-${i}"></g>` : "") + desk(i) + `<g data-layer="top-${i}"></g>`).join(""),
      table(),
      `<g data-layer="pile"></g>`,
    ],
  });
}

export const GEOMETRY = { PADS, LANES: LANES.map((l) => l.spots), PILE, DOCKET, TOP_Z, WORKERS };

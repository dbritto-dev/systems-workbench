// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A dispatch desk: four tenants' docks at the back feed four roller lanes (one queue per tenant); a shuttle on a rail
// across the lane heads carries the job the scheduler picks to the one worker, a press that stamps one job at a time;
// finished jobs drop into the done bin. Every number is a counter on a real object: each lane's waiting count, the
// ticket being served, the done count and a busy meter.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate, digitCounter, meter, lamp, plaque, faceText, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 450;

const PLATE = { x: -158, y: -92, w: 308, d: 140, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The lanes, back (A) to front (D). Slot 0 is the head, at the right.
export const LANE_YS = [-65, -40, -15, 10];
const LANE_HALF = 7;
export const BED_H = 11;
const LANE_X0 = -110, LANE_X1 = 24;
export const SLOTS = 9;
export const SLOT_X = Array.from({ length: SLOTS }, (_, i) => 16 - 10 * i);
const DOCK = { x: -136, w: 24 };
const DOCK_H = [14, 14, 14, 22];

// The shuttle rail across the lane heads, the infeed to the worker, the worker and the done bin.
export const RAIL_X = 34;                 // shuttle centre line
const RAIL = { x: RAIL_X - 6, y: -76, w: 12, d: 100, r: 1 };
export const WORK_Y = -27.5;                // the infeed and the press sit between lanes B and C
const INFEED = { x: 40, y: WORK_Y - 6, w: 26, d: 12, r: 0.8 };
const BODY = { x: 66, y: WORK_Y - 17, w: 42, d: 34, r: 2 };
export const WORK_SPOT = [82, WORK_Y, BED_H];
const COLUMN = [82, WORK_Y - 13];
export const HEAD = { x: 82, y: WORK_Y, r: 6, rest: 31, len: 4.5 };
const ARM_Z = 42;
const BIN = { x: 70, y: 6, w: 30, d: 22, r: 2 };
const BIN_H = 8;
export const BIN_SPOT = [85, 17, BIN_H];

export const BOX = { w: 8, d: 8, h: 6, tall: 12 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [COLUMN[0], COLUMN[1], ARM_Z + 6], [DOCK.x, LANE_YS[0] - 8, 30], [BODY.x + BODY.w, WORK_Y - 40, 30]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 50 },
);

const { S, L, D, at, seg } = shorthand(P);
const text = (x, y, z, words, size = 2.4, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -136, y: 30, w: 96, d: 6, r: 1 })
    + labelPlate(P, { x: 108, y: 22, w: 32, d: 14, r: 1.5 }, [[113, 27, 20], [113, 31, 14]]);
}

// A tenant's dock at the tail of its lane: a block with the tenant's letter on top and a tag (weight or priority)
// the live code fills in. D's dock is the tall batch hopper, with BATCH on its face.
function dock(i) {
  const y = LANE_YS[i], h = DOCK_H[i];
  const plan = { x: DOCK.x, y: y - 8, w: DOCK.w, d: 16, r: 1.5 };
  const out = [S(k.slabOf(plan, 0, h, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(plan, 1.6), h, P), { tone: "faint" }) })];
  out.push(faceText(P, [DOCK.x + 6.5, y + 3.2, h], "ABCD"[i], { face: "top", size: 8, tone: "hi", anchor: "middle" }));
  out.push(`<g data-tag="${i}">${plaque(P, { x: DOCK.x + 11, y: y - 5, z: h, w: 12, d: 10 })}</g>`);
  // the tag's text: one <text> the live code sets (×1, ×3, HIGH, LOW)
  out.push(faceText(P, [DOCK.x + 17, y + 1.4, h + 0.8], "", { face: "top", size: 4, tone: "hi", anchor: "middle", attr: `data-tag-text="${i}"` }));
  if (i === 3) out.push(text(DOCK.x + 12, y + 8, 6, t("BATCH", "LOTE"), 3.2, { anchor: "middle" }));
  return out.join("");
}

// A roller lane on a cabinet, with an end stop at the head and the lane's waiting counter on its front.
function lane(i) {
  const y = LANE_YS[i];
  const bed = { x: LANE_X0, y: y - LANE_HALF, w: LANE_X1 - LANE_X0, d: LANE_HALF * 2, r: 1 };
  const out = [S(k.slabOf(bed, 0, BED_H, P, 3, 0.5), { tone: "mid" })];
  const rollers = [];
  for (let x = bed.x + 3; x < bed.x + bed.w - 2; x += 3) rollers.push(k.lineOnTop([x, bed.y + 2], [x, bed.y + bed.d - 2], BED_H, P));
  out.push(L(rollers.join(""), { tone: "lo" }));
  for (const yy of [bed.y + 0.2, bed.y + bed.d - 1.6]) out.push(S(k.slabOf({ x: bed.x + 1, y: yy, w: bed.w - 3, d: 1.4, r: 0.3 }, BED_H, 1.4, P, 2), { tone: "hi", crease: "none" }));
  out.push(S(k.slabOf({ x: LANE_X1 - 2.4, y: bed.y + 0.8, w: 2.4, d: bed.d - 1.6, r: 0.4 }, BED_H, 5, P, 2), { tone: "hi", crease: "lo" }));
  const front = y + LANE_HALF;
  out.push(digitCounter(P, { x: LANE_X0 + 3, y: front, z: 3.6, count: 2, w: 4.2, h: 5.6, gap: 0.6, pad: 1.1, name: "wait" + i }));
  out.push(text(LANE_X0 + 15, front, 5.4, t("WAITING", "EN ESPERA"), 3.2));
  return out.join("");
}

// The shuttle's rail across the lane heads, and the shuttle (moved along y by the live code).
function rail() {
  const out = [S(k.slabOf(RAIL, 0, 2.4, P, 3, 0.3), { tone: "lo", crease: "none" })];
  out.push(L(k.lineOnTop([RAIL_X, RAIL.y + 2], [RAIL_X, RAIL.y + RAIL.d - 2], 2.4, P), { tone: "mid" }));
  for (const y of [RAIL.y + 2.5, RAIL.y + RAIL.d - 2.5]) out.push(S(k.slabOf({ x: RAIL.x - 0.6, y: y - 1.6, w: RAIL.w + 1.2, d: 3.2, r: 0.4 }, 2.4, 2, P, 2), { tone: "mid", crease: "none" }));
  return out.join("");
}
export function shuttleSvg() {
  const plan = { x: RAIL_X - 6, y: -6.5, w: 12, d: 13, r: 1.2 };
  return S(k.slabOf(plan, 2.4, BED_H - 2.4, P, 3, 0.4), { tone: "hi", crease: "lo" })
    + L(k.planOutline(k.insetPlan(plan, 1.6), BED_H, P), { tone: "faint" });
}

function infeed() {
  const out = [S(k.slabOf(INFEED, 0, BED_H, P, 3, 0.5), { tone: "mid" })];
  const rollers = [];
  for (let x = INFEED.x + 2; x < INFEED.x + INFEED.w - 1; x += 3) rollers.push(k.lineOnTop([x, INFEED.y + 2], [x, INFEED.y + INFEED.d - 2], BED_H, P));
  out.push(L(rollers.join(""), { tone: "lo" }));
  return out.join("");
}

// The worker: a press bench. Counters on its front: the ticket being served; a busy meter and the idle lamp on its side.
function body() {
  const out = [S(k.slabOf(BODY, 0, BED_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(BODY, 2.4), BED_H, P), { tone: "faint" }));
  out.push(L(k.planOutline({ x: WORK_SPOT[0] - 6, y: WORK_Y - 6, w: 12, d: 12, r: 1 }, BED_H, P), { tone: "lo" }));
  const front = BODY.y + BODY.d;
  out.push(digitCounter(P, { x: BODY.x + 3.4, y: front, z: 2.2, count: 3, w: 4.2, h: 5.4, gap: 0.6, pad: 1.1, name: "serving" }));
  out.push(text(BODY.x + 20.2, front, 3.8, t("SERVING", "TURNO"), 3.2));
  const side = BODY.x + BODY.w;
  out.push(meter(P, { x: side, y: BODY.y + BODY.d - 7, z: 1.8, r: 5.6, face: "x", ticks: 10, zone: 0.9, name: "busy" }));
  out.push(faceText(P, [side, BODY.y + BODY.d - 15, 1.8], t("BUSY", "OCUPADO"), { face: "x", size: 3, tone: "mid" }));
  return out.join("");
}
function idleLamp() {
  const p = [BODY.x + BODY.w - 4, BODY.y + BODY.d - 19, BED_H];
  return `<g data-idle="off">${lamp(P, p, { r: 2.8 })}</g><g data-idle="on" style="display:none">${litFill(lamp(P, p, { r: 2.8, lit: true }))}</g>`
    + faceText(P, [BODY.x + BODY.w, BODY.y + BODY.d - 15, 6.4], t("IDLE", "OCIOSO"), { face: "x", size: 3, tone: "mid" });
}

// The press: a column behind the work spot, an arm over it and the head the live code lowers onto each job.
function column() {
  const out = [S(k.cylinder(COLUMN[0], COLUMN[1], 3, BED_H, ARM_Z - BED_H, P, 20), { tone: "mid", crease: "none" })];
  out.push(L(k.sideArc(COLUMN[0], COLUMN[1], 3, 22, P, 12), { tone: "faint" }));
  return out.join("");
}
export function headSvg() {
  const rod = S(k.cylinder(HEAD.x, HEAD.y, 1.2, HEAD.rest + HEAD.len, ARM_Z - HEAD.rest - HEAD.len, P, 14), { tone: "mid", crease: "none" });
  const head = S(k.cylinder(HEAD.x, HEAD.y, HEAD.r, HEAD.rest, HEAD.len, P, 28, 0.4), { tone: "hi", crease: "lo" });
  return rod + head + L(k.sideArc(HEAD.x, HEAD.y, HEAD.r, HEAD.rest + 2, P, 20), { tone: "faint" });
}
function arm() {
  const plan = { x: HEAD.x - 4, y: COLUMN[1] - 3.5, w: 8, d: HEAD.y - COLUMN[1] + 7.5, r: 2 };
  return S(k.slabOf(plan, ARM_Z, 4, P, 3, 0.4), { tone: "mid" }) + D([at([HEAD.x, HEAD.y, ARM_Z + 4]), at([COLUMN[0], COLUMN[1], ARM_Z + 4])], { size: 0.45 });
}

function bin() {
  const out = [S(k.slabOf(BIN, 0, BIN_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(BIN, 2.2), BIN_H, P), { tone: "lo" }) })];
  const front = BIN.y + BIN.d;
  out.push(digitCounter(P, { x: BIN.x + 3, y: front, z: 1.4, count: 3, w: 3.8, h: 4.8, gap: 0.6, pad: 0.9, name: "done" }));
  out.push(text(BIN.x + 18.2, front, 2.6, t("DONE", "HECHOS"), 2.8));
  return out.join("");
}


// A job, drawn at the origin and moved with translateAlong: a short box (normal work) or a tall one (4× the work),
// with its ticket number on top and the tenant's letter on the front.
export function parcelSvg() {
  const one = (h, kind) => {
    const b = { x: -BOX.w / 2, y: -BOX.d / 2, w: BOX.w, d: BOX.d, r: 0.5 };
    const out = [`<g data-kind="${kind}"${kind === "tall" ? ' style="display:none"' : ""}>`];
    out.push(litFill(S(k.slabOf(b, 0, h, P, 2, 0.3), { tone: "hi", crease: "lo" })).replace('class="iso-solid"', 'class="iso-solid" data-body'));
    out.push(L(k.lineOnTop([b.x + 3, b.y], [b.x + 3, b.y + b.d], h, P), { tone: "faint" }));
    out.push(faceText(P, [0.8, 0.9, h], "0", { face: "top", size: 3.4, tone: "hi", anchor: "middle", attr: "data-num" }));
    out.push(faceText(P, [0, BOX.d / 2, 1.2], "A", { size: 3.4, tone: "hi", anchor: "middle", attr: "data-key" }));
    out.push(`</g>`);
    return out.join("");
  };
  return one(BOX.h, "box") + one(BOX.tall, "tall");
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A dispatch desk on a base plate. At the left, four tenant docks, A, B and C and the tall batch hopper D, each push numbered jobs onto their own roller lane; a counter on each lane shows how many jobs wait in it. At the lane heads, a shuttle runs on a rail across all four lanes and carries the job the scheduler picks onto a short infeed to the one worker, a press bench. The press stamps one job at a time; a counter on the bench shows the ticket being served, a meter on its side how busy it has been, and a lamp lights when a reserved slot sits idle. Finished jobs drop into the done bin in front.",
      "Un despacho sobre una placa base. A la izquierda, cuatro muelles de clientes (tenants), A, B y C y la tolva alta de lotes D, empujan trabajos numerados cada uno a su propio carril de rodillos; un contador en cada carril muestra cuántos trabajos esperan en él. En la cabeza de los carriles, un carro corre sobre un riel que cruza los cuatro carriles y lleva el trabajo que elige el planificador a una cinta corta hacia el único trabajador, un banco de prensa. La prensa sella un trabajo a la vez; un contador en el banco muestra el turno que se atiende, un medidor en su costado cuánto ha estado ocupado, y una lámpara se enciende cuando un turno reservado queda vacío. Los trabajos terminados caen en el cajón de hechos, adelante.",
    ),
    body: [
      plate(),
      LANE_YS.map((_, i) => dock(i) + lane(i) + `<g data-layer="lane${i}"></g>`).join(""),
      rail(),
      `<g data-shuttle>${shuttleSvg()}</g>`,
      `<g data-layer="shuttle"></g>`,
      infeed(),
      column(),
      body(),
      idleLamp(),
      `<g data-layer="work"></g>`,
      `<g data-head>${headSvg()}</g>`,
      arm(),
      bin(),
      `<g data-layer="out"></g>`,
    ],
  });
}

export const GEOMETRY = { LANE_YS, SLOT_X, SLOTS, BED_H, RAIL_X, WORK_Y, WORK_SPOT, HEAD, BIN_SPOT, BOX, INFEED_X: [INFEED.x, INFEED.x + INFEED.w] };

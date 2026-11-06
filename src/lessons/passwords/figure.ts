// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A server's vault of password hashes, the login desk that checks them, and the cracking rig that guesses against a
// stolen copy. Left, the login desk: users' login slips wait on a lane on its top and go to one of four cores, a
// drum whose needle spins while it hashes. Centre, the vault: a cabinet of eight drawers, one per user row, each with
// the row's letter, its stored hash and its salt; a drawer lights when the rig has cracked it. Right, the rig: guess
// tags slide from the hopper along a rail into its one GPU, a mill; its counters show how far down the guess list it
// has got and the rig's clock. Behind it the thief stands by the stolen copy.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, person, figurine, dial, plaque, faceText } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 430;

const PLATE = { x: -140, y: -62, w: 280, d: 94, r: 8 };
const PLATE_H = 12, FOOT_H = 5;
export const CAP = 2.9;          // caption size: at this figure's scale, a little above the counter captions of other lessons

// ---------- the login desk ----------
const DESK = { x: -134, y: -24, w: 86, d: 48, r: 1.6 };
const DESK_H = 14;
const DESK_FRONT = DESK.y + DESK.d;
export const CORE_X = [-120, -103, -86, -69];
export const CORE_Y = 10;
const CORE_R = 5.6, CORE_H = 5;
export const CORE_TOP = DESK_H + CORE_H;
// the lane on the desk top where login slips wait, front of the line on the right
const LANE = { x: -132, y: -20, w: 82, d: 11, r: 1 };
const LANE_H = 1.6;
export const LANE_Y = LANE.y + LANE.d / 2;
export const LANE_Z = DESK_H + LANE_H;
export const LANE_X = Array.from({ length: 8 }, (_, i) => -57 - 8.6 * i);   // the ninth place holds "+N" for the rest
export const SLIP = { w: 6.4, h: 7.6 };

// ---------- the vault: plinth and cabinet ----------
const PLINTH = { x: -40, y: -58, w: 80, d: 82, r: 1.6 };
const PLINTH_H = 14;
const PLINTH_FRONT = PLINTH.y + PLINTH.d;
const CAB = { x: -37, y: -52, w: 74, d: 42, r: 1 };
const CAB_H = 34;
const CAB_FRONT = CAB.y + CAB.d;
export const DRAWER = { w: 16.4, h: 13.6, gap: 1.6 };
export const DRAWER_X = [0, 1, 2, 3].map((i) => CAB.x + 2.2 + i * (DRAWER.w + DRAWER.gap));
export const DRAWER_Z = [PLINTH_H + 2 + DRAWER.h + DRAWER.gap, PLINTH_H + 2];

// ---------- the rig ----------
const RIG = { x: 46, y: -28, w: 88, d: 52, r: 1.6 };
const RIG_H = 14;
const RIG_FRONT = RIG.y + RIG.d;
export const GPU_X = [112];                  // one GPU: every number on the rig is for one
export const GPU_Y = 4;
const GPU_R = 10, GPU_H = 6;
const RAIL = { x: 52, y: -9, w: 60, d: 6, r: 0.8 };
const RAIL_H = 2;
export const RAIL_Y = RAIL.y + RAIL.d / 2;
export const RAIL_Z = RIG_H + RAIL_H;
const HOPPER = { x: 48, y: -22, w: 14, d: 14, r: 1 };
const HOPPER_H = 12;
export const HOPPER_SPOT = [HOPPER.x + HOPPER.w / 2, HOPPER.y + HOPPER.d / 2, RIG_H + HOPPER_H];
export const GPU_TOP = RIG_H + GPU_H;
export const TAG = { w: 4.4, h: 5.4 };
const COPY = { x: 62, y: -58, w: 40, d: 22, r: 1.2 };
const COPY_H = 8;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(CAB, PLINTH_H, PLINTH_H + CAB_H + 2), [120, -46, 28]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

const { S, L, D, at } = shorthand(P);
const cap = (x, y, z, words, opts = {}) => faceText(P, [x, y, z], words, { size: CAP, tone: "mid", ...opts });

// One housing with several counters side by side (housing: false on each), so a decimal point or a ×10 sits inside it.
function housing(x0, x1, y, z0, z1) {
  return S(k.slabOf({ x: x0, y: y - 1.4, w: x1 - x0, d: 1.4, r: 0.5 }, z0, z1 - z0, P, 2), { tone: "hi", crease: "lo" });
}
const WH = { w: 4.2, h: 5.6, gap: 0.6 };
const span = (n) => n * WH.w + (n - 1) * WH.gap;
const wheels = (x, y, z, count, name) => digitCounter(P, { x, y, z, count, ...WH, housing: false, name });
const dot = (x, y, z) => D([at([x, y + 0.1, z])], { size: 1.1, tone: "hi" });
const CAP_Z = (z) => z + WH.h + 3.4;          // caption baseline: clear of the housing top (z + h + 1.2)

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H });
}

// The users at the back left, whose logins come to the desk.
function crowd() {
  const spots = [[-128, -54], [-116, -48], [-103, -55], [-92, -46], [-79, -53], [-66, -45], [-122, -38], [-54, -52]];
  return spots.sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P)).map(([x, y]) => figurine(P, [x, y, 0], { scale: 0.85 })).join("");
}

function desk() {
  const out = [S(k.slabOf(DESK, 0, DESK_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(DESK, 2.4), DESK_H, P), { tone: "faint" }));
  // the lane: a low bed with rollers across it
  out.push(S(k.slabOf(LANE, DESK_H, LANE_H, P, 2, 0.3), { tone: "lo", crease: "none" }));
  const rollers = [];
  for (let x = LANE.x + 2; x < LANE.x + LANE.w - 1; x += 2.6) rollers.push(k.lineOnTop([x, LANE.y + 1.6], [x, LANE.y + LANE.d - 1.6], LANE_H + DESK_H, P));
  out.push(L(rollers.join(""), { tone: "faint" }));
  // counters on the front: how many wait, how long the oldest has waited, and one hash
  const z = 2, y = DESK_FRONT;
  const c1 = DESK.x + 5, c2 = c1 + 29, c3 = c2 + 28;
  out.push(housing(c1 - 1.2, c1 + span(4) + 1.2, y, z - 1.2, z + WH.h + 1.2), wheels(c1, y, z, 4, "line"), cap(c1 - 1.2, y, CAP_Z(z), t("IN LINE", "EN FILA")));
  out.push(housing(c2 - 1.2, c2 + span(4) + 2.2, y, z - 1.2, z + WH.h + 1.2), wheels(c2, y, z, 3, "waitI"), dot(c2 + span(3) + 1, y, z + 0.6), wheels(c2 + span(3) + 2, y, z, 1, "waitF"), cap(c2 - 1.2, y, CAP_Z(z), t("WAIT S", "ESPERA S")));
  out.push(housing(c3 - 1.2, c3 + span(4) + 1.2, y, z - 1.2, z + WH.h + 1.2), wheels(c3, y, z, 4, "hashMs"), faceText(P, [c3 - 1.2, y, CAP_Z(z)], "HASH MS", { size: CAP, tone: "mid", attr: "data-hash-cap" }));
  // the back of the line, beyond the lane's eight places: "+N" on the lane's left end, where the line is cut off
  out.push(faceText(P, [LANE.x + 0.6, LANE.y + LANE.d - 1.6, LANE_Z], "", { face: "top", size: 3, tone: "hi", attr: "data-more" }));
  return out.join("");
}

// A core: a drum on the desk top whose needle spins while it hashes, with the login slip it is hashing on top.
function core(i) {
  const x = CORE_X[i];
  return `<g data-core="${i}">` + dial(P, { x, y: CORE_Y, z: DESK_H, r: CORE_R, h: CORE_H, ticks: 8, every: 2, name: "core" + i, value: i * 0.21, knurl: false }) + `</g>`;
}

// ---------- the vault ----------
function vault() {
  const out = [S(k.slabOf(PLINTH, 0, PLINTH_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(PLINTH, 2.4), PLINTH_H, P), { tone: "faint" }));
  out.push(plaque(P, { x: CAB.x + 4, y: CAB_FRONT + 6, z: PLINTH_H, w: CAB.w - 8, d: 12, text: t("VAULT · 1,000 ROWS", "BÓVEDA · 1,000 FILAS"), size: 4.2 }));
  // counters on the plinth's front: rows cracked, and rows whose hash is the same as another row's
  const y = PLINTH_FRONT, z = 2;
  const c1 = PLINTH.x + 5, c2 = PLINTH.x + 50;
  out.push(housing(c1 - 1.2, c1 + span(4) + 1.2, y, z - 1.2, z + WH.h + 1.2), wheels(c1, y, z, 4, "cracked"), cap(c1 - 1.2, y, CAP_Z(z), t("CRACKED", "ADIVINADAS")));
  out.push(cap(c1 + span(4) + 2.6, y, z + 1.4, t("OF 1,000", "DE 1,000")));
  out.push(housing(c2 - 1.2, c2 + span(3) + 1.2, y, z - 1.2, z + WH.h + 1.2), wheels(c2, y, z, 3, "same"), cap(c2 - 1.2, y, CAP_Z(z), t("SAME HASH", "MISMO HASH")));
  out.push(S(k.slabOf(CAB, PLINTH_H, CAB_H, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(CAB, 2), PLINTH_H + CAB_H, P), { tone: "faint" }));
  return out.join("");
}
// A drawer front on the cabinet's face: letter, stored hash and salt. Lit when the rig has cracked that row.
function drawer(i) {
  const x = DRAWER_X[i % 4], z = DRAWER_Z[Math.floor(i / 4)];
  const plan = { x, y: CAB_FRONT, w: DRAWER.w, d: 1, r: 0.4 };
  const out = [`<g class="wb-lit-group" data-drawer="${i}">`];
  out.push(S(k.slabOf(plan, z, DRAWER.h, P, 2, 0.3), { tone: "hi", crease: "lo" }));
  const fy = CAB_FRONT + 1;
  out.push(faceText(P, [x + 1.4, fy, z + 8], "A", { size: CAP * 1.25, tone: "hi", attr: "data-letter" }));
  out.push(faceText(P, [x + DRAWER.w - 1.4, fy, z + 8], "0000", { size: CAP, tone: "hi", anchor: "end", attr: "data-hash" }));
  out.push(faceText(P, [x + DRAWER.w / 2, fy, z + 2.4], "SALT 00", { size: CAP, tone: "hi", anchor: "middle", attr: "data-salt" }));
  out.push(`</g>`);
  return out.join("");
}

// ---------- the rig ----------
function copy() {
  const out = [S(k.slabOf(COPY, 0, COPY_H, P, 3, 0.5), { tone: "mid" })];
  out.push(plaque(P, { x: COPY.x + 3, y: COPY.y + 4, z: COPY_H, w: COPY.w - 6, d: COPY.d - 8, text: t("STOLEN COPY", "COPIA ROBADA"), size: 3.8 }));
  return out.join("");
}
function thief() {
  return person(P, [120, -46, 0], { scale: 0.95, hat: "brim" });
}
function rig() {
  const out = [S(k.slabOf(RIG, 0, RIG_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(RIG, 2.4), RIG_H, P), { tone: "faint" }));
  // the rail the guesses slide along, from the hopper to the mills
  out.push(S(k.slabOf(RAIL, RIG_H, RAIL_H, P, 2, 0.3), { tone: "lo", crease: "none" }));
  out.push(L(k.lineOnTop([RAIL.x + 1, RAIL_Y], [RAIL.x + RAIL.w - 1, RAIL_Y], RIG_H + RAIL_H, P), { tone: "faint" }));
  // counters on the front: how far down the guess list (d.d × 10^ee) and the rig's clock (dddd.d and a unit)
  const y = RIG_FRONT, z = 2;
  const g = RIG.x + 4;
  out.push(housing(g - 1.2, g + 2 * WH.w + 9.4 + span(2) + 1.2, y, z - 1.2, z + WH.h + 1.2));
  out.push(wheels(g, y, z, 1, "gM"), dot(g + WH.w + 0.9, y, z + 0.6), wheels(g + WH.w + 1.8, y, z, 1, "gF"));
  out.push(faceText(P, [g + 2 * WH.w + 3, y, z + 1.2], "×10", { size: CAP, tone: "hi" }));
  out.push(wheels(g + 2 * WH.w + 9.4, y, z + 1.6, 2, "gE"));
  out.push(cap(g - 1.2, y, CAP_Z(z), t("GUESSES", "INTENTOS")));
  const c = RIG.x + 37;
  out.push(housing(c - 1.2, c + span(5) + 2.2, y, z - 1.2, z + WH.h + 1.2), wheels(c, y, z, 4, "clockI"), dot(c + span(4) + 1, y, z + 0.6), wheels(c + span(4) + 2, y, z, 1, "clockF"));
  out.push(cap(c - 1.2, y, CAP_Z(z), t("RIG CLOCK", "RELOJ")));
  out.push(faceText(P, [c + span(5) + 3.6, y, z + 1.4], "SECONDS", { size: CAP, tone: "mid", attr: "data-unit" }));
  // the one GPU, named on the rig's top in front of the rail
  out.push(plaque(P, { x: RAIL.x + 14, y: RAIL.y + RAIL.d + 5, z: RIG_H, w: 24, d: 8, text: t("ONE GPU", "UNA GPU"), size: 3.4 }));
  return out.join("");
}
function hopper() {
  return S(k.slabOf(HOPPER, RIG_H, HOPPER_H, P, 3, 0.4), { tone: "mid", inner: L(k.planOutline(k.insetPlan(HOPPER, 2), RIG_H + HOPPER_H, P), { tone: "lo" }) });
}
// The GPU mill: a drum whose needle spins with the rig.
function gpu(i) {
  return `<g data-gpu="${i}">` + dial(P, { x: GPU_X[i], y: GPU_Y, z: RIG_H, r: GPU_R, h: GPU_H, ticks: 16, every: 4, name: "gpu" + i, value: 0 }) + `</g>`;
}

// A login slip: an upright card with the user's letter, drawn at the origin and moved with translateAlong.
export function slipSvg() {
  const plan = { x: -SLIP.w / 2, y: -0.3, w: SLIP.w, d: 0.6, r: 0.15 };
  return `<g class="wb-lit-group" data-slip>${S(k.slabOf(plan, 0, SLIP.h, P, 2, 0.15), { tone: "hi", crease: "lo" })}`
    + faceText(P, [0, 0.3, 2.2], "A", { size: 4, tone: "hi", anchor: "middle", attr: "data-slip-text" }) + `</g>`;
}
// A guess tag: a small blank card.
export function tagSvg() {
  const plan = { x: -TAG.w / 2, y: -0.3, w: TAG.w, d: 0.6, r: 0.15 };
  return `<g data-tag>${S(k.slabOf(plan, 0, TAG.h, P, 2, 0.15), { tone: "hi", crease: "lo" })}</g>`;
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A server and a thief on one base plate. At the left, the login desk: users stand behind it, and their login slips wait on a lane on the desk's top until one of four cores, drums whose needles spin while they hash, takes the slip; counters on the desk's front show how many wait, how long the oldest has waited and how long one hash takes. In the centre, the vault: a cabinet of eight drawers, each a user row with its letter, its stored hash and its salt; a drawer lights when the rig has cracked that row. Counters on the vault's plinth show how many of the table's 1,000 rows are cracked and how many share their hash with another row. At the right, the cracking rig: guess tags slide from a hopper along a rail into one GPU, a mill; counters show how far down its guess list the rig has got, as a number times a power of ten, and the rig's clock. Behind the rig, the thief stands by the stolen copy of the vault.",
      "Un servidor y un ladrón sobre una placa base. A la izquierda, el mostrador de login: los usuarios esperan detrás, y sus papeletas de login esperan en un carril sobre el mostrador hasta que uno de cuatro núcleos, tambores cuya aguja gira mientras calculan el hash, toma la papeleta; los contadores al frente muestran cuántas esperan, cuánto lleva esperando la más antigua y cuánto tarda un hash. En el centro, la bóveda: un gabinete de ocho cajones, cada uno una fila de usuario con su letra, su hash guardado y su sal; un cajón se enciende cuando el equipo adivinó esa fila. Los contadores del zócalo muestran cuántas de las 1,000 filas de la tabla están adivinadas y cuántas comparten su hash con otra fila. A la derecha, el equipo de ataque: fichas de intentos salen de una tolva por un riel hacia una GPU, un molino; los contadores muestran hasta dónde llegó el equipo en su lista de intentos, como un número por una potencia de diez, y el reloj del equipo. Detrás, el ladrón está junto a la copia robada de la bóveda.",
    ),
    body: [
      plate(),
      crowd(),
      copy(),
      thief(),
      desk(),
      `<g data-layer="lane"></g>`,
      CORE_X.map((_, i) => core(i)).join(""),
      `<g data-layer="cores"></g>`,
      vault(),
      [0, 1, 2, 3, 4, 5, 6, 7].map(drawer).join(""),
      rig(),
      hopper(),
      `<g data-layer="rail"></g>`,
      GPU_X.map((_, i) => gpu(i)).join(""),
    ],
  });
}

export const GEOMETRY = { CORE_X, CORE_Y, CORE_TOP, CORE_R, LANE_X, LANE_Y, LANE_Z, GPU_X, GPU_Y, GPU_TOP, RAIL_Y, RAIL_Z, HOPPER_SPOT, DESK_H, RIG_H };

// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A shop at closing time: one pod of a service, shut down the way Kubernetes does it.
//   at the back, the control plane's office keeps the endpoint list (a plaque per pod), the shop is pod B with a
//   counter where every request in progress has a ticket, and the other pods A and C share one block;
//   at the front left the doorman (the routers) sends each new customer to a pod on his own list, a copy of the
//   office's that a capsule updates along a tube; at the front, the shutdown clock: a 60 s rail from the delete, with
//   SIGTERM and SIGKILL signs, and the counters.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, person, figurine, sign, plaque, card, faceText, variants, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 430;

const PLATE = { x: -116, y: -64, w: 232, d: 102, r: 8 };
const PLATE_H = 12, FOOT_H = 5;
export const CAP = 3;                                   // caption size: no word on the machine is smaller

// ---------- back row ----------
const OFFICE = { x: -111, y: -59, w: 41, d: 31, r: 1.5 };
const OFFICE_H = 14;
const SHOP = { x: -64, y: -61, w: 109, d: 47, r: 1.5 };
export const FLOOR = 10;                                // the shop floor's height
const WALL = { x: -62, y: -61, w: 105, d: 2.6, r: 0.4 };
const WALL_H = 22;
const COUNTER = { x: -56, y: -52, w: 93, d: 6, r: 0.8 };
const COUNTER_H = 8;
const OTH = { x: 52, y: -61, w: 60, d: 43, r: 1.5 };
const OTH_H = 22;
export const OTH_DOORS = [71, 97];                      // pods A and C

// the places in the shop: even spots against the counter, odd ones a row behind them
export const SPOTS = Array.from({ length: 14 }, (_, j) => [-50 + 6.5 * j, j % 2 ? -30 : -39.5, FLOOR]);
export const TICKET_Y = COUNTER.y + COUNTER.d;          // tickets stand on the counter's front edge
export const TICKET_Z = FLOOR + COUNTER_H;
export const WALKWAY_Y = -21;
export const DOOR_X = -57;                              // the shop's door, at the front left

// ---------- front row ----------
const PODIUM = { x: -112, y: 12, w: 41, d: 22, r: 1.5 };
const PODIUM_H = 9;
const DESK = { x: -64, y: 18, w: 176, d: 16, r: 1.5 };      // well in front of the street, so customers walk clear of it
const DESK_H = 12;
export const DOORMAN = [-75, -2];
export const TUBE = { x: -106, y0: OFFICE.y + OFFICE.d, y1: PODIUM.y, z: 2.2 };
export const PEGS = [-104, -92, -80];                   // the doorman's list: A, B, C
export const PLAQUES = [-101, -90.5, -80];              // the office's list: A, B, C

// the shutdown clock's rail: seconds since the delete along x
export const RAIL = { x0: -46, per: 2.5, secs: 60, y: 19.6, d: 5.6, z: DESK_H };   // 0 s clear of the doorman
export const railX = (s) => RAIL.x0 + RAIL.per * s;

// walkers' paths (x, y, z)
export const SPAWN = [-110, -10, 0];
export const QUEUE = [-84, -10, 0];
export const LANE_Y = -10.5;
export const STEP = { x: DOOR_X - 5, y: SHOP.y + SHOP.d, w: 10, d: 2.4, h: 5, r: 0.4 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [WALL.x, WALL.y, FLOOR + WALL_H + 2], [OTH.x + OTH.w, OTH.y, OTH_H + 3], [OFFICE.x, OFFICE.y, OFFICE_H + 4]],
  WIDTH,
  HEIGHT,
  { pad: 12, azimuth: 50 },
);

const { S, L, D, seg } = shorthand(P);
const word = (x, y, z, text, opts = {}) => faceText(P, [x, y, z], text, { size: CAP, tone: "mid", ...opts });

function plate() {
  const out = [basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })];
  // the street: paving lines from the doorman to the doors
  out.push(L(k.lineOnTop([-70, -9], [48, -9], 0, P) + k.lineOnTop([-70, 7], [112, 7], 0, P), { tone: "faint" }));
  return out.join("");
}

// The control plane's office: its endpoint list on the roof, one plaque per ready pod.
function office() {
  const out = [S(k.slabOf(OFFICE, 0, OFFICE_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(OFFICE, 2), OFFICE_H, P), { tone: "faint" }));
  const f = OFFICE.y + OFFICE.d;
  out.push(word(OFFICE.x + 3, f, 10, t("CONTROL PLANE", "PLANO DE CONTROL")));
  out.push(word(OFFICE.x + 3, f, 6, t("ENDPOINTS", "ENDPOINTS")));
  out.push(L(k.faceRectY(P, OFFICE.x + 3, OFFICE.x + OFFICE.w - 3, f, 1.4, 3.2), { tone: "lo" }));
  PLAQUES.forEach((x, i) => {
    const pl = { x: x - 4.5, y: OFFICE.y + 9, w: 9, d: 11 };
    out.push(L(k.planOutline({ ...pl, r: 0.8 }, OFFICE_H, P), { tone: "lo" }));
    const draw = plaque(P, { x: pl.x, y: pl.y, z: OFFICE_H, w: pl.w, d: pl.d, text: "ABC"[i], size: 5.2 });
    out.push(i === 1 ? `<g data-plaque="B">${draw}</g>` : draw);
  });
  return out.join("");
}

// The tube from the office to the doorman's podium, and the capsule that carries a change to his list.
function tube() {
  const plan = { x: TUBE.x - 2, y: TUBE.y0, w: 4, d: TUBE.y1 - TUBE.y0, r: 1 };
  const out = [S(k.slabOf(plan, 0, TUBE.z, P, 3, 0.4), { tone: "hi", crease: "lo" })];
  const bands = [];
  for (let y = TUBE.y0 + 5; y < TUBE.y1 - 2; y += 6) bands.push(k.lineOnTop([TUBE.x - 2, y], [TUBE.x + 2, y], TUBE.z, P));
  out.push(L(bands.join(""), { tone: "faint" }));
  out.push(`<g class="sd-capsule" data-capsule style="display:none">${S(k.slabOf({ x: -1.6, y: -3, w: 3.2, d: 6, r: 1.4 }, 0, 2.4, P, 4, 0.3), { tone: "lo", crease: "lo" })}</g>`);
  return out.join("");
}

// Pod B: a floor with the door at the front left and a step up to it; a back wall with the pod's name and its sign;
// the counter where each request in progress has a ticket.
function shopBack() {
  const out = [S(k.slabOf(SHOP, 0, FLOOR, P, 3, 0.5), { tone: "mid" })];
  const f = SHOP.y + SHOP.d;
  // door
  out.push(`<path class="sd-door" d="${k.faceRectY(P, DOOR_X - 4.5, DOOR_X + 4.5, f, 0.6, FLOOR - 0.6)}"/>`);
  out.push(`<g data-shutter style="display:none">${L(k.faceRectY(P, DOOR_X - 4.5, DOOR_X + 4.5, f, 0.6, FLOOR - 0.6) + [2.4, 4.2, 6, 7.8].map((z) => k.pathOf([k.iso([DOOR_X - 4.5, f, z], P), k.iso([DOOR_X + 4.5, f, z], P)])).join(""), { tone: "mid" })}</g>`);
  // windows along the rest of the front
  out.push(L([-44, -22, 0, 22].map((x) => k.faceRectY(P, x, x + 16, f, 2.4, FLOOR - 2.4)).join(""), { tone: "faint" }));
  // spot marks on the floor
  out.push(L(SPOTS.map(([x, y]) => k.planOutline({ x: x - 3.4, y: y - 3.4, w: 6.8, d: 6.8, r: 0.8 }, FLOOR, P)).join(""), { tone: "faint" }));
  out.push(L(k.lineOnTop([DOOR_X - 3, WALKWAY_Y + 3.6], [SHOP.x + SHOP.w - 4, WALKWAY_Y + 3.6], FLOOR, P), { tone: "faint" }));
  // back wall
  out.push(S(k.slabOf(WALL, FLOOR, WALL_H, P, 2, 0.3), { tone: "hi", crease: "lo" }));
  const wf = WALL.y + WALL.d;
  out.push(word(WALL.x + 4, wf, FLOOR + 16, "POD B", { size: 4.8, tone: "hi" }));
  out.push(S(k.slabOf(COUNTER, FLOOR, COUNTER_H, P, 3, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(COUNTER, 1.2), FLOOR + COUNTER_H, P), { tone: "faint" }));
  // requests in progress beyond the shop's places: "+N" on the floor past the counter's end
  out.push(faceText(P, [COUNTER.x + COUNTER.w + 1.6, COUNTER.y + COUNTER.d, FLOOR], "", { face: "top", size: 3.6, tone: "hi", attr: "data-more" }));
  return out.join("");
}

// The pod's sign on its back wall: what the pod is doing.
export const SIGN_STATES = {
  open: t("OPEN", "ABIERTO"),
  closing: t("CLOSING", "CERRANDO"),
  closed: t("CLOSED", "CERRADO"),
  starting: t("STARTING", "ARRANCANDO"),
};
function shopSign() {
  const at = { x: 13, y: WALL.y + WALL.d, z: FLOOR + 14, w: 28, h: 7.4, posts: false, size: 3.4 };
  return Object.entries(SIGN_STATES).map(([key, text]) => `<g data-sign="${key}"${key === "open" ? "" : ' style="display:none"'}>${sign(P, { ...at, text })}</g>`).join("");
}

// Pods A and C: one block with two storefronts.
function others() {
  const out = [S(k.slabOf(OTH, 0, OTH_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(OTH, 2), OTH_H, P), { tone: "faint" }));
  const f = OTH.y + OTH.d;
  OTH_DOORS.forEach((x, i) => {
    out.push(`<path class="sd-door" d="${k.faceRectY(P, x - 5, x + 5, f, 0.6, 10.5)}"/>`);
    out.push(L(k.faceRectY(P, x - 9, x + 9, f, 0.6, 20.5), { tone: "lo" }));
    out.push(word(x, f, 13.4, "AC"[i], { size: 5.4, tone: "hi", anchor: "middle" }));
  });
  out.push(plaque(P, { x: OTH.x + 8, y: OTH.y + 12, z: OTH_H, w: 44, d: 9, text: t("OTHER PODS", "OTROS PODS"), size: 3.6 }));
  return out.join("");
}

// The doorman's podium: his own list, a card per pod (laid flat when he has crossed it off).
function podium() {
  const out = [S(k.slabOf(PODIUM, 0, PODIUM_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(PODIUM, 2), PODIUM_H, P), { tone: "faint" }));
  const f = PODIUM.y + PODIUM.d;
  PEGS.forEach((x, i) => {
    const letter = "ABC"[i];
    const up = card(P, { x: x - 4, y: 26, z: PODIUM_H, w: 8, h: 8.4, d: 0.8, text: letter, size: 4.8 });
    if (i === 1) {
      const stale = litFill(card(P, { x: x - 4, y: 26, z: PODIUM_H, w: 8, h: 8.4, d: 0.8, text: letter, size: 4.8, lit: true }));
      const down = plaque(P, { x: x - 4, y: 18.5, z: PODIUM_H, w: 8, d: 8, text: letter, size: 4.4 });
      out.push(variants("peg-B", { up, stale, down }, "up"));
    } else out.push(up);
  });
  out.push(word(PODIUM.x + 3, f, 3, t("DOORMAN'S LIST", "LISTA DEL PORTERO")));
  return out.join("");
}

// The shutdown clock: a desk with a 60 s rail on top and the counters on its front.
function desk() {
  const out = [S(k.slabOf(DESK, 0, DESK_H, P, 3, 0.5), { tone: "mid" })];
  const z = DESK_H;
  const strip = { x: railX(0) - 3, y: RAIL.y, w: RAIL.per * RAIL.secs + 6, d: RAIL.d, r: 0.6 };
  out.push(S(k.slabOf(strip, z, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const tk = k.topTicks(railX(0), railX(60), RAIL.per, 5, RAIL.y + 0.6, z + 0.6, [1.6, 3], P);
  out.push(L(tk.minor, { tone: "lo" }), L(tk.major, { tone: "mid" }));
  for (let s = 0; s <= 60; s += 10) out.push(faceText(P, [railX(s), RAIL.y + RAIL.d + 3.4, z], String(s), { face: "top", size: CAP, tone: "mid", anchor: "middle" }));
  out.push(faceText(P, [railX(60) + 2.6, RAIL.y + RAIL.d + 3.4, z], "S", { face: "top", size: CAP, tone: "mid" }));
  // counters on the front, each with its caption above the housing
  const f = DESK.y + DESK.d;
  const slots = [
    ["took", 0, t("SHUTDOWN S", "APAGADO S")],
    ["inflight", 2, t("IN PROGRESS", "EN CURSO")],
    ["served", 3, t("SERVED", "ATENDIDAS")],
    ["refused", 3, t("REFUSED", "RECHAZADAS")],
    ["cut", 3, t("CUT", "CORTADAS")],
  ];
  const WH = { w: 4.2, h: 4.8, gap: 0.8 };
  slots.forEach(([name, count, label], i) => {
    const x = DESK.x + 4 + 35 * i;
    if (count) out.push(digitCounter(P, { x: x + 1.4, y: f, z: 1.2, count, ...WH, pad: 0.9, name }));
    else {
      // seconds since the delete, to a tenth: two wheels, a decimal point and one wheel, in one housing
      const x0 = x + 1.4, xf = x0 + 2 * WH.w + WH.gap + 1.6;
      out.push(S(k.slabOf({ x: x0 - 0.9, y: f - 1.4, w: xf + WH.w + 0.9 - (x0 - 0.9), d: 1.4, r: 0.5 }, 1.2 - 0.9, WH.h + 1.8, P, 2), { tone: "hi", crease: "lo" }));
      out.push(digitCounter(P, { x: x0, y: f, z: 1.2, count: 2, ...WH, housing: false, name: name + "I" }));
      out.push(D([k.iso([x0 + 2 * WH.w + WH.gap + 0.8, f + 0.1, 1.8], P)], { size: 1, tone: "hi" }));
      out.push(digitCounter(P, { x: xf, y: f, z: 1.2, count: 1, ...WH, housing: false, name: name + "F" }));
    }
    out.push(word(x, f, 9.3, label));
  });
  return out.join("");
}

// The marks on the rail: SIGTERM and SIGKILL signs (moved to their seconds by the live code: a post at the second,
// the board to its right for SIGTERM and to its left for SIGKILL), the moment the doorman heard (a capsule) and the
// moment the pod was gone (a flag), and the slider for now.
function railMarks() {
  const z = DESK_H + 0.6, y = RAIL.y + RAIL.d / 2;
  const pin = (name, label, side, secs) => {
    const w = 15, h = 5.4, post = 2.6, x0 = side > 0 ? 0 : -w;
    const board = { x: x0, y: y - 0.5, w, d: 1, r: 0.2 };
    return `<g data-pin="${name}" transform="${k.translateAlong(P, [railX(secs), 0, 0])}">`
      + S(k.slabOf({ x: -0.5, y: y - 0.5, w: 1, d: 1, r: 0.2 }, z, post + 0.2, P, 2), { tone: "mid", crease: "none" })
      + S(k.slabOf(board, z + post, h, P, 2, 0.2), { tone: "mid", crease: "lo" })
      + faceText(P, [x0 + w / 2 + side * 0.4, y + 0.5, z + post + 1.5], label, { size: CAP, tone: "hi", anchor: "middle" })
      + `</g>`;
  };
  const out = [];
  out.push(`<g data-mark="now" transform="${k.translateAlong(P, [railX(0), 0, 0])}">${S(k.slabOf({ x: -1.6, y: RAIL.y - 0.6, w: 3.2, d: RAIL.d + 1.2, r: 0.4 }, z, 1.6, P, 2, 0.2), { tone: "lo", crease: "none" })}${S(k.slabOf({ x: -0.4, y: RAIL.y + RAIL.d / 2 - 0.4, w: 0.8, d: 0.8, r: 0.2 }, z + 1.6, 4.4, P, 2), { tone: "lo", crease: "none" })}</g>`);
  out.push(pin("term", "SIGTERM", 1, 0), pin("kill", "SIGKILL", -1, 30));
  out.push(`<g data-mark="knew" style="display:none">${S(k.slabOf({ x: -1.4, y: y - 2.6, w: 2.8, d: 5.2, r: 1.2 }, z, 1.6, P, 4, 0.3), { tone: "hi", crease: "lo" })}</g>`);
  out.push(`<g data-mark="gone" style="display:none">${S(k.slabOf({ x: -0.6, y: y - 0.6, w: 1.2, d: 1.2, r: 0.3 }, z, 4.4, P, 2), { tone: "mid", crease: "none" })}<path class="wb-pennant" d="${k.pathOf([k.iso([0, y, z + 4.4], P), k.iso([3.6, y, z + 3.3], P), k.iso([0, y, z + 2.2], P)], true)}"/></g>`);
  return out.join("");
}

// The street in front of pods A and C: a bench.
function street() {
  const out = [];
  const bench = { x: 72, y: 1.5, w: 26, d: 5, r: 0.6 };
  for (const x of [bench.x + 2, bench.x + bench.w - 4]) out.push(S(k.slabOf({ x, y: bench.y + 0.5, w: 2, d: 4, r: 0.3 }, 0, 2.6, P, 2), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf(bench, 2.6, 1.2, P, 2, 0.2), { tone: "hi", crease: "lo" }));
  out.push(S(k.slabOf({ x: bench.x, y: bench.y - 0.2, w: bench.w, d: 1, r: 0.3 }, 3.8, 4, P, 2), { tone: "hi", crease: "lo" }));
  return out.join("");
}

function doorman() {
  return person(P, [DOORMAN[0], DOORMAN[1], 0], { scale: 0.85, hat: "cap", holding: "clipboard" });
}

// A customer, drawn at the origin and moved with translateAlong. A keep-alive client wears a hat.
export function walkerSvg() {
  const s = 0.72, fig = litFill(figurine(P, [0, 0, 0], { scale: s }));
  const hat = S(k.cylinder(0, 0, 3.4 * s, 12.6 * s, 0.6 * s, P, 20), { tone: "mid", crease: "none" }) + S(k.cylinder(0, 0, 2 * s, 13.2 * s, 1.8 * s, P, 16, 0.3 * s), { tone: "mid", crease: "lo" });
  return `<g data-tone="new">${fig}</g><g data-tone="keep" style="display:none">${fig}${hat}</g>`;
}
// A request's ticket on the counter: short, or a taller one for an export.
export function ticketSvg() {
  const c = (h) => litFill(card(P, { x: -2.2, y: 0, z: 0, w: 4.4, h, d: 0.6 }));
  return `<g data-len="short">${c(4.6)}</g><g data-len="long" style="display:none">${c(8)}</g>`;
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A shop at closing time, on a base plate. At the back, the control plane's office has a plaque on its roof for each ready pod, A, B and C. Next to it, pod B is a shop with a door at the front left, a counter with a ticket for every request in progress and a sign on the back wall that reads OPEN, CLOSING, CLOSED or STARTING. Pods A and C share one block at the back right. At the front left a doorman stands at a podium with his own list of pods, a standing card for each; a capsule carries each change from the office to his list along a tube, so his list lags. He sends each new customer to one of the pods on his list; keep-alive clients wear a hat. At the front, the shutdown clock: a rail of 60 seconds from the moment the pod is deleted, with signs for SIGTERM and SIGKILL, a capsule mark for when the doorman heard and a flag for when the pod was gone, and counters for the seconds since the delete, requests in progress, served, refused and cut.",
      "Una tienda a la hora de cierre, sobre una placa base. Atrás, la oficina del plano de control tiene en el techo una placa por cada pod listo, A, B y C. Al lado, el pod B es una tienda con la puerta adelante a la izquierda, un mostrador con un ticket por cada solicitud en curso y un letrero en la pared del fondo que dice ABIERTO, CERRANDO, CERRADO o ARRANCANDO. Los pods A y C comparten un bloque atrás a la derecha. Adelante a la izquierda, un portero está en un atril con su propia lista de pods, una tarjeta de pie por cada uno; una cápsula lleva cada cambio de la oficina a su lista por un tubo, así que su lista va con retraso. Él manda cada cliente nuevo a uno de los pods de su lista; los clientes keep-alive llevan sombrero. Al frente, el reloj del apagado: un riel de 60 segundos desde que se borra el pod, con letreros para SIGTERM y SIGKILL, una marca de cápsula para cuando el portero se enteró y una bandera para cuando el pod terminó, y contadores de los segundos desde el borrado, las solicitudes en curso, atendidas, rechazadas y cortadas.",
    ),
    body: [
      plate(),
      office(),
      others(),
      shopBack(),
      shopSign(),
      `<g data-layer="tickets"></g>`,
      `<g data-layer="shop"></g>`,
      tube(),
      S(k.slabOf(STEP, 0, STEP.h, P, 2, 0.3), { tone: "mid", crease: "lo" }),
      `<g data-layer="street"></g>`,
      street(),
      doorman(),
      podium(),
      desk(),
      railMarks(),
    ],
  });
}

export const GEOMETRY = { LANE_Y, SPOTS, TICKET_Y, TICKET_Z, WALKWAY_Y, DOOR_X, FLOOR, SPAWN, QUEUE, STEP, OTH_DOORS, OTH_FRONT: OTH.y + OTH.d, SHOP_FRONT: SHOP.y + SHOP.d, TUBE, RAIL, DESK_H };

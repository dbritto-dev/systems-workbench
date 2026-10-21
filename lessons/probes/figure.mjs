// A shopping street: five shops (pods), each with an open sign (readiness) and an inspector with a tally board
// (liveness), supply pipes from one shared warehouse (the database), and a traffic warden whose peg board is the
// service's endpoint list. Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";

export const WIDTH = 720;
export const HEIGHT = 460;

const PLATE = { x: -166, y: -122, w: 332, d: 162, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const HOUSE = { x: -150, y: -114, w: 300, d: 30, h: 36 };
const DOOR = { x0: -26, x1: 26, z1: 24 };
const PIPE = { y: -64, z: 31, mast: 0.9, r: 0.7 };
export const SHOP = { w: 46, y0: -68, y1: -36, h: 24 };
export const SHOP_X = [-122, -58, 6, 70, 134];
const STOOP = { y0: -36, y1: -28, h: 1.6 };
// Crates in fill order (bottom row first); drawn back to front.
export const CRATES = [[-17, 0], [-11.6, 0], [-17, 1], [-11.6, 1]];
const CRATE_DRAW = [0, 2, 1, 3];
const SIGN = { x0: 8.5, x1: 20, z0: 12.5, z1: 22.5, rail0: 1, rail1: 23 };
export const SIGN_DROP = 10;
const BOARD = { x0: -40, x1: -25.5, y: -26, d: 1, z0: 3, z1: 15 };
export const PIPS = 5;
const INSPECTOR = { dx: -21, y: -20 };
export const STREET = { y0: -16, y1: 8 };
export const WALK_Y = -4;
const KIOSK = { x: -162, y: 12, w: 30, d: 20, h: 12 };
export const PEGS = Array.from({ length: 5 }, (_, i) => [KIOSK.x + 4 + i * 5.5, KIOSK.y + 7]);
export const KIOSK_TOP = KIOSK.h + 2;
export const SPAWN = [KIOSK.x + KIOSK.w + 4, WALK_Y];
const WARDEN = [KIOSK.x + KIOSK.w + 10, KIOSK.y + 2];
const QUEUE = [[KIOSK.x + KIOSK.w + 7, KIOSK.y + 10], [KIOSK.x + KIOSK.w + 7, KIOSK.y + 16], [KIOSK.x + KIOSK.w + 7, KIOSK.y + 22]];

// The state the first frame shows (the live model starts from the same tableau).
export const TABLEAU = [
  { phase: "run", ready: true, fails: 0, restarts: 0 },
  { phase: "down", ready: false, fails: 0, restarts: 2 },
  { phase: "dead", ready: false, fails: 2, restarts: 0 },
  { phase: "warm", ready: false, fails: 0, restarts: 1, stock: 2 },
  { phase: "run", ready: true, fails: 0, restarts: 0 },
];

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [HOUSE.x, HOUSE.y, HOUSE.h + 4], [HOUSE.x + HOUSE.w, HOUSE.y, HOUSE.h + 4]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 58 },
);

const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const face = (x0, x1, y, z0, z1) => k.faceRectY(P, x0, x1, y, z0, z1);
const show = (on) => (on ? "" : ' style="display:none"');

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -100, y: 25, w: 180, d: 6, r: 1 })
    + labelPlate(P, { x: 98, y: 16, w: 52, d: 18, r: 1.5 }, [[104, 21, 30], [104, 25, 40], [104, 29, 22]]);
}

function warehouse() {
  const plan = { x: HOUSE.x, y: HOUSE.y, w: HOUSE.w, d: HOUSE.d, r: 2 };
  const front = HOUSE.y + HOUSE.d;
  const out = [];
  out.push(S(k.slabOf(plan, 0, HOUSE.h, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(plan, 26, P, 4), { tone: "faint" }) }));
  out.push(S(k.slabOf(k.insetPlan(plan, -1.5), HOUSE.h, 2.4, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(plan, 4), HOUSE.h + 2.4, P, 4), { tone: "faint" }));
  out.push(L(face(DOOR.x0 - 1.2, DOOR.x1 + 1.2, front, 0, DOOR.z1 + 1.2), { tone: "lo" }));
  out.push(L(face(DOOR.x0, DOOR.x1, front, 0, DOOR.z1), { tone: "faint" }));
  for (const x of [-142, -60, -46, 40, 54, 134]) out.push(L(face(x, x + 8, front, 14, 20), { tone: "lo" }));
  // A socket on the front wall for each shop's supply pipe.
  for (const cx of SHOP_X) out.push(L(k.sideRing([cx, front, PIPE.z], 1.6, "y", P, 16), { tone: "lo" }));
  // Stacked stock inside the open door.
  for (const [x, z] of [[-18, 0], [-9, 0], [0, 0], [-14, 6], [-5, 6]]) out.push(S(k.slabOf({ x, y: front - 6, w: 7.4, d: 5, r: 0.4 }, z, 5.6, P, 2, 0.3), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf({ x: -36, y: front, w: 72, d: 8, r: 1 }, 0, 3, P, 3, 0.4), { tone: "mid" }));
  return out.join("");
}

// The roller door: down while the warehouse is out of action.
function shutter(down) {
  const front = HOUSE.y + HOUSE.d;
  const out = [S(k.slabOf({ x: DOOR.x0, y: front, w: DOOR.x1 - DOOR.x0, d: 1, r: 0.2 }, 3, DOOR.z1 - 3, P, 2), { tone: "hi", crease: "lo" })];
  out.push(L([8, 12, 16, 20].map((z) => k.segment([DOOR.x0, front + 1, z], [DOOR.x1, front + 1, z], P)).join(""), { tone: "lo" }));
  return `<g data-house-shut${show(down)}>${out.join("")}</g>`;
}

function building(cx) {
  const plan = { x: cx - SHOP.w / 2, y: SHOP.y0, w: SHOP.w, d: SHOP.y1 - SHOP.y0, r: 1.5 };
  const front = SHOP.y1;
  const out = [];
  out.push(S(k.slabOf(plan, 0, SHOP.h, P, 3, 0.5), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(plan, -1), SHOP.h, 2, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(plan, 3), SHOP.h + 2, P, 3), { tone: "faint" }));
  out.push(L(face(cx - 5, cx + 5, front, 0, 14), { tone: "lo" }));
  out.push(L(face(cx - 20, cx - 8, front, 8, 18), { tone: "lo" }));
  out.push(L(k.segment([cx - 14, front, 8], [cx - 14, front, 18], P), { tone: "faint" }));
  // The sign's track on the wall, right of the door.
  for (const x of [SIGN.x0 + 0.6, SIGN.x1 - 0.6]) out.push(L(k.segment([cx + x, front, SIGN.rail0], [cx + x, front, SIGN.rail1], P), { tone: "lo" }));
  // The supply pipe: a mast on the roof and a pipe back to the warehouse.
  out.push(S(k.cylinder(cx, PIPE.y, PIPE.mast, SHOP.h + 2, PIPE.z - SHOP.h - 2 + PIPE.r, P, 10), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: cx - PIPE.r, y: HOUSE.y + HOUSE.d, w: PIPE.r * 2, d: PIPE.y - HOUSE.y - HOUSE.d + PIPE.mast, r: 0.3 }, PIPE.z - PIPE.r, PIPE.r * 2, P, 2), { tone: "mid", crease: "none" }));
  return out.join("");
}

function scaffold(cx) {
  const x0 = cx - SHOP.w / 2, x1 = cx + SHOP.w / 2, y0 = SHOP.y0, y1 = SHOP.y1;
  const out = [];
  out.push(S(k.slabOf({ x: x0, y: y0, w: SHOP.w, d: y1 - y0, r: 1.5 }, 0, 1.2, P, 3), { tone: "lo", crease: "none" }));
  for (const [x, y] of [[x0 + 1, y0 + 1], [x1 - 1, y0 + 1], [x0 + 1, y1 - 1], [x1 - 1, y1 - 1]]) out.push(S(k.cylinder(x, y, 0.9, 1.2, SHOP.h - 1.2, P, 10), { tone: "mid", crease: "none" }));
  for (const z of [9, 18]) {
    out.push(S(k.slabOf({ x: x0, y: y1 - 2.6, w: SHOP.w, d: 1.6, r: 0.4 }, z, 1.4, P, 2), { tone: "mid", crease: "none" }));
    out.push(S(k.slabOf({ x: x1 - 2.6, y: y0, w: 1.6, d: y1 - y0, r: 0.4 }, z, 1.4, P, 2), { tone: "mid", crease: "none" }));
  }
  // A brace and a pile of planks on the slab.
  out.push(L(k.segment([x0 + 1, y1, 1.2], [x1 - 1, y1, SHOP.h - 2], P), { tone: "mid" }));
  out.push(S(k.slabOf({ x: cx - 8, y: y0 + 8, w: 16, d: 5, r: 0.3 }, 1.2, 2.4, P, 2), { tone: "mid" }));
  return out.join("");
}

// A booting shop: the store shutter is down over door and window.
function storeShutter(cx) {
  const front = SHOP.y1;
  return S(k.slabOf({ x: cx - 21, y: front, w: 27, d: 0.9, r: 0.2 }, 0.4, 18, P, 2), { tone: "hi", crease: "lo", inner: L([4, 8, 12, 16].map((z) => k.segment([cx - 21, front + 0.9, z], [cx + 6, front + 0.9, z], P)).join(""), { tone: "faint" }) });
}

// A jammed shop: a bar across its door, nobody answers.
function jamBar(cx) {
  return S(k.slabOf({ x: cx - 8, y: SHOP.y1, w: 16, d: 1.4, r: 0.3 }, 6, 2.4, P, 2, 0.2), { tone: "hi", crease: "lo" });
}

function stoop(cx) {
  return S(k.slabOf({ x: cx - SHOP.w / 2, y: STOOP.y0, w: SHOP.w, d: STOOP.y1 - STOOP.y0, r: 1 }, 0, STOOP.h, P, 3, 0.3), { tone: "mid" });
}

function crate(x, y, z) {
  const box = { x: x - 2.4, y: y - 2.4, w: 4.8, d: 4.8, r: 0.4 };
  return S(k.slabOf(box, z, 4, P, 2, 0.3), { tone: "hi", crease: "lo", inner: L(k.segment([box.x, box.y + box.d, z + 2], [box.x + box.w, box.y + box.d, z + 2], P), { tone: "faint" }) });
}

// The open sign: a board on a track on the shop front; raised and lit when the shop reports ready, down when not.
function sign(cx, ready) {
  const board = { x: cx + SIGN.x0, y: SHOP.y1, w: SIGN.x1 - SIGN.x0, d: 1.2, r: 0.2 };
  const fy = board.y + board.d, mid = (SIGN.z0 + SIGN.z1) / 2;
  const inner = L(face(board.x + 1.2, board.x + board.w - 1.2, fy, SIGN.z0 + 1.4, SIGN.z1 - 1.4), { tone: "lo" })
    + L(k.segment([board.x + 2.6, fy, mid], [board.x + board.w - 2.6, fy, mid], P), { tone: "lo" });
  const plateSvg = S(k.slabOf(board, SIGN.z0, SIGN.z1 - SIGN.z0, P, 2, 0.2), { tone: ready ? "hi" : "mid", crease: "lo", lit: ready, inner });
  return `<g data-sign-plate${ready ? "" : ` transform="${k.translateAlong(P, [0, 0, -SIGN_DROP])}"`}>${plateSvg}</g>`;
}

// A person: body, head, optional hat; used for the inspectors, the warden and the customers.
function person(x, y, scale, { hat = false, tone = "hi" } = {}) {
  const r = 1.6 * scale, h = 5.2 * scale, hr = 1.25 * scale;
  const out = [S(k.cylinder(x, y, r, 0, h, P, 16, 0.3 * scale), { tone, crease: "lo" })];
  out.push(S(k.cylinder(x, y, hr, h + 0.2 * scale, 2.2 * scale, P, 14, 0.5 * scale), { tone, crease: "none" }));
  if (hat) {
    out.push(S(k.cylinder(x, y, 2.6 * scale, h + 2.2 * scale, 0.4 * scale, P, 18), { tone, crease: "none" }));
    out.push(S(k.cylinder(x, y, 1.3 * scale, h + 2.6 * scale, 1.2 * scale, P, 14), { tone, crease: "none" }));
  }
  return out.join("");
}

// The inspector (liveness): a board with three slots for failed checks in a row and five pips for restarts,
// and the inspector beside it with a clipboard.
function inspector(cx, i, st) {
  const x0 = cx + BOARD.x0, x1 = cx + BOARD.x1, y = BOARD.y, fy = y + BOARD.d;
  const out = [];
  for (const lx of [x0 + 1.2, x1 - 1.2]) out.push(S(k.cylinder(lx, y + 0.5, 0.6, 0, BOARD.z0, P, 8), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: x0, y, w: x1 - x0, d: BOARD.d, r: 0.2 }, BOARD.z0, BOARD.z1 - BOARD.z0, P, 2, 0.2), { tone: "mid" }));
  out.push(L(k.segment([x0 + 0.8, fy, 8.9], [x1 - 0.8, fy, 8.9], P), { tone: "faint" }));
  for (let n = 0; n < 3; n++) {
    const sx = x0 + 1.3 + n * 4.1;
    out.push(`<g data-slot="${i}-${n}">${L(face(sx, sx + 3.4, fy, 10, 14), { tone: "lo" })}<path class="tally-fill" data-tally="${i}-${n}" d="${face(sx + 0.5, sx + 2.9, fy, 10.5, 13.5)}"${show(n < st.fails)}/></g>`);
  }
  for (let n = 0; n < PIPS; n++) {
    const sx = x0 + 1.3 + n * 2.45;
    out.push(L(face(sx, sx + 1.8, fy, 4.2, 7.8), { tone: "lo" }));
    out.push(`<path class="tally-fill" data-pip="${i}-${n}" d="${face(sx + 0.4, sx + 1.4, fy, 4.6, 7.4)}"${show(n < st.restarts)}/>`);
  }
  const px = cx + INSPECTOR.dx, py = INSPECTOR.y;
  out.push(person(px, py, 1.5, { tone: "mid" }));
  out.push(S(k.slabOf({ x: px - 3.2, y: py + 2.2, w: 3.4, d: 0.6, r: 0.1 }, 4, 4.4, P, 2), { tone: "mid", crease: "none" }));
  return out.join("");
}

function shop(cx, i, st) {
  const stock = st.phase === "warm" ? st.stock ?? 0 : st.phase === "run" || st.phase === "dead" ? 4 : 0;
  const crates = CRATE_DRAW.map((n) => `<g data-crate="${i}-${n}"${show(n < stock)}>${crate(cx + CRATES[n][0], (STOOP.y0 + STOOP.y1) / 2, STOOP.h + CRATES[n][1] * 4)}</g>`).join("");
  return `<g data-shop="${i}">`
    + `<g data-building${show(st.phase !== "down")}>${building(cx)}<g data-shop-shut${show(st.phase === "boot")}>${storeShutter(cx)}</g><g data-jam${show(st.phase === "dead")}>${jamBar(cx)}</g></g>`
    + `<g data-scaffold${show(st.phase === "down")}>${scaffold(cx)}</g>`
    + stoop(cx)
    + `<g data-sign="${i}">${sign(cx, st.ready)}</g>`
    + crates
    + inspector(cx, i, st)
    + `</g>`;
}

function street() {
  const plan = { x: PLATE.x + 8, y: STREET.y0, w: PLATE.w - 16, d: STREET.y1 - STREET.y0, r: 1.5 };
  const out = [S(k.slabOf(plan, 0, 0.8, P, 3), { tone: "lo", crease: "none" })];
  out.push(L(k.lineOnTop([plan.x + 1, WALK_Y + 6], [plan.x + plan.w - 1, WALK_Y + 6], 0.8, P), { tone: "faint" }));
  for (const cx of SHOP_X) out.push(L(k.planOutline({ x: cx - 6, y: STREET.y0 + 0.6, w: 12, d: 4, r: 0.6 }, 0.8, P, 2), { tone: "faint" }));
  return out.join("");
}

// The warden's kiosk: a peg per shop on its roof (the endpoint list), the warden beside it, a queue of customers.
function kiosk(state) {
  const plan = { x: KIOSK.x, y: KIOSK.y, w: KIOSK.w, d: KIOSK.d, r: 2 };
  const out = [S(k.slabOf(plan, 0, KIOSK.h, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, 5, P, 3), { tone: "faint" }) })];
  out.push(S(k.slabOf(k.insetPlan(plan, -1), KIOSK.h, 2, P, 3, 0.5), { tone: "mid" }));
  out.push(L(face(KIOSK.x + 6, KIOSK.x + 20, KIOSK.y + KIOSK.d, 6, 11), { tone: "lo" }));
  const strip = { x: PEGS[0][0] - 3, y: PEGS[0][1] - 3, w: PEGS[4][0] - PEGS[0][0] + 6, d: 6, r: 1 };
  out.push(L(k.planOutline(strip, KIOSK_TOP, P, 2), { tone: "lo" }));
  PEGS.forEach(([x, y], i) => {
    out.push(L(k.ring(x, y, 1.5, KIOSK_TOP, P, 16), { tone: "lo" }));
    out.push(`<g data-peg="${i}">${pegSvg(x, y, state[i].ready)}</g>`);
  });
  out.push(person(WARDEN[0], WARDEN[1], 1.6, { hat: true, tone: "mid" }));
  return out.join("");
}
export function pegSvg(x, y, up) {
  return S(k.cylinder(x, y, 1.2, KIOSK_TOP, up ? 5 : 1, P, 14, 0.2), { tone: up ? "hi" : "lo", crease: "lo", lit: up });
}

export function tokenSvg() {
  return person(0, 0, 0.95);
}

function queue() {
  return QUEUE.map(([x, y]) => person(x, y, 0.95)).join("");
}

// Two customers on their way to the open shops in the first frame; the live code replaces them.
function walkers() {
  return [[SHOP_X[0] - 10, WALK_Y], [SHOP_X[4] - 30, WALK_Y], [SHOP_X[4], WALK_Y - 6]].map(([x, y]) => `<g transform="${k.translateAlong(P, [x, y, 0])}">${tokenSvg()}</g>`).join("");
}

export function buildFigure(state = TABLEAU) {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A shopping street on a base plate. Five shops stand in a row in front of a large shared warehouse, each fed by a supply pipe from it. Each shop has crates of stock on its front step, an open sign on a track on its front wall that is raised and lit when the shop is ready, and an inspector standing by a board with three slots for failed checks and five pips for restarts. A traffic warden in a hat stands by a kiosk at the front left with a queue of customers; the kiosk roof has one peg per shop, raised and lit for shops on the warden's list. In this frame shops 1 and 5 are open, shop 2 is being rebuilt under scaffolding, shop 3 is jammed with a bar across its door and two failed checks, and shop 4 is restocking with its sign down.",
    body: [plate(), warehouse(), shutter(false), ...SHOP_X.map((cx, i) => shop(cx, i, state[i])), street(), `<g data-customers>${walkers()}</g>`, kiosk(state), queue()],
  });
}

export const GEOMETRY = { SHOP_X, SHOP, WALK_Y, SPAWN, PEGS, KIOSK_TOP, CRATES, STREET, PIPS, SIGN_DROP, TABLEAU };

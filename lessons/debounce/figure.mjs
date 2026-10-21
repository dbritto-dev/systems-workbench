// An elevator lobby: every keystroke is a passenger. With debounce the elevator door stays open while
// people keep arriving, its timer reset by each one; only after a quiet spell does the car take the whole
// group up to the server floor as one request. Without debounce, every passenger takes the stairs alone.
// Answers come back down a wire to the screen at the front. A tape along the front records keystrokes
// (short pegs) and requests (flagged posts). Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate } from "../../workbench/parts.mjs";
import { digitPath, counterCells, digitsOf } from "./digits.js";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -132, y: -84, w: 244, d: 122, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// The elevator: a shaft of four posts, a car that rides up to the server floor (TOP).
export const TOP = 28;
const SHAFT = { x: -104, y: -72, w: 46, d: 40 };
export const CAR = { x: -101, y: -69, w: 40, d: 34 };
export const CAR_H = 20;
const CAR_FRONT = CAR.y + CAR.d;           // -35
const TOWER_H = TOP + CAR_H + 15;           // 63
const CROSS = { x: SHAFT.x, y: SHAFT.y + SHAFT.d - 3, w: SHAFT.w, d: 3 }; // crossbar over the door, holding the dials
const CROSS_Z = [TOP + CAR_H, TOWER_H];
const CROSS_FACE = CROSS.y + CROSS.d;       // -32
export const DIALS = { quiet: [-92, CROSS_FACE, TOWER_H - 6.4], first: [-70, CROSS_FACE, TOWER_H - 6.4], r: 5 };

// The server floor: a raised block beside the shaft, a desk with ticket slots on top.
const MEZZ = { x: SHAFT.x + SHAFT.w, y: -78, w: 68, d: 44, r: 1.5 };
const MEZZ_FRONT = MEZZ.y + MEZZ.d;         // -34
const DESK = { x: -52, y: -68, w: 56, d: 10, r: 1.5 };
const DESK_H = 7;
const DESK_FRONT = DESK.y + DESK.d;         // -58
const RACK = { x: -54, y: -77, w: 22, d: 7, r: 1 };
const RACK_H = 17;
export const SLOTS = Array.from({ length: 7 }, (_, i) => [-46 + i * 7.2, -63]);
export const TICKET = { w: 4.6, d: 1.4, h: 7 };

// Stairs along the front of the server floor.
export const STEPS = 8;
export const STAIR = { x0: MEZZ.x, x1: MEZZ.x + MEZZ.w, y: MEZZ_FRONT, d: 9 };

// Keyboard in the lobby, the keys counter beside it.
export const KB = { x: -124, y: -16, w: 62, d: 30, r: 2 };
const KB_H = 4;
export const ROWS = ["qwertyuiop", "asdfghjkl⏎", "zxcvbnm,.-"];
const KEY = { w: 4.6, d: 5.2, gap: 1.1 };
export const keyAt = (row, col) => [KB.x + 3 + col * (KEY.w + KEY.gap), KB.y + 3 + row * (KEY.d + KEY.gap)];
export const SPACE = { x: KB.x + 3 + 2 * (KEY.w + KEY.gap), y: KB.y + 3 + 3 * (KEY.d + KEY.gap), w: 6 * (KEY.w + KEY.gap) - KEY.gap, d: KEY.d };
const KEYS_BOX = { x: -56, y: 2, w: 18, d: 10, r: 1.2 };
const KEYS_H = 12;

// The screen at the front right, its face toward the viewer.
const STAND = { x: 30, y: -24, w: 72, d: 16, r: 2 };
const PANEL = { x: 33, y: -18, w: 66, d: 3, r: 0.6 };
const PANEL_Z = [2, 38];
export const SCREEN_FACE = PANEL.y + PANEL.d;   // 1
export const FIELDS = { typed: { x0: 37, x1: 95, z0: 25, z1: 32 }, shown: { x0: 37, x1: 95, z0: 12.5, z1: 19.5 } };
export const LAMP = { x: 91, y: PANEL.y + 1.5, z: PANEL_Z[1] };

// The wire from the server desk down to the screen (answers ride down it).
export const WIRE = [[DESK.x + DESK.w, -64, TOP + 3.5], [MEZZ.x + MEZZ.w + 1.5, -64, TOP + 3.5], [MEZZ.x + MEZZ.w + 1.5, -64, 0.6], [66, -64, 0.6], [66, STAND.y, 0.6], [66, STAND.y, 2]];

// The tape: keystroke pegs and request posts slide left from the "now" mark.
export const TAPE = { x: -124, y: 18, w: 228, d: 12, r: 1 };
export const NOW_X = TAPE.x + TAPE.w - 6;
export const TAPE_SECONDS = 7;
export const TAPE_SCALE = (TAPE.w - 14) / TAPE_SECONDS;

// Counters (digit wheels on vertical faces facing +y).
const PROUD = 1.2;
export const COUNTERS = {
  keys: { x: KEYS_BOX.x + 2.6, y: KEYS_BOX.y + KEYS_BOX.d + PROUD, z: 2, w: 4, h: 5.6, gap: 0.6, count: 3, size: "m", housing: { x: KEYS_BOX.x + 1.4, z0: 1, z1: 8.6 } },
  aboard: { x: CAR.x + 16.4, y: CAR_FRONT + PROUD, z: 14.6, w: 3.4, h: 4.6, gap: 0.5, count: 2, size: "s", housing: { x: CAR.x + 15.4, z0: 14, z1: 19.8 } },
  sent: { x: DESK.x + 5, y: DESK_FRONT + PROUD, z: TOP + 0.9, w: 3.6, h: 5, gap: 0.5, count: 3, size: "m", housing: { x: DESK.x + 3.9, z0: TOP + 0.4, z1: TOP + 6.4 } },
  stale: { x: 85.2, y: SCREEN_FACE + PROUD, z: 4.6, w: 4, h: 5.6, gap: 0.55, count: 2, size: "m", housing: { x: 84, z0: 3.8, z1: 11 } },
};
const housingW = (c) => 2 * (c.x - c.housing.x) + c.count * c.w + (c.count - 1) * c.gap;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [SHAFT.x, SHAFT.y, TOWER_H + 7], [SHAFT.x + SHAFT.w, SHAFT.y, TOWER_H + 7], [SHAFT.x, SHAFT.y + SHAFT.d, TOWER_H + 7]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const slab = (plan, z, h, steps = 3, bevel = 0) => k.slabOf({ r: 0.4, ...plan }, z, h, P, steps, bevel);
export const text = (x, y, z, value, { size = 3, tone = "mid", anchor = "start", attr = "" } = {}) =>
  `<text class="iso-face-text" ${attr} data-tone="${tone}" transform="${k.sideMatrix([x, y], z, P, "left")}" font-size="${size}" text-anchor="${anchor}">${value}</text>`;

function counter(c, name, value = 0) {
  const out = [];
  if (c.housing) out.push(S(k.slabOf({ x: c.housing.x, y: c.y - PROUD, w: housingW(c), d: PROUD, r: 0.4 }, c.housing.z0, c.housing.z1 - c.housing.z0, P, 2), { tone: "hi", crease: "lo" }));
  const digits = digitsOf(value, c.count);
  counterCells(c).forEach((cell, j) => {
    out.push(`<path class="cw" d="${k.faceRectY(P, cell.x, cell.x + cell.w, cell.y, cell.z, cell.z + cell.h)}"/>`);
    out.push(`<path class="dg" data-size="${c.size}" data-digit="${name}-${j}" d="${digitPath(k.iso, P, cell, digits[j])}"/>`);
  });
  return out.join("");
}

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H });
}

// ---------- the tape ----------
function tape() {
  const out = [S(slab(TAPE, 0, 1.2, 3), { tone: "lo", crease: "none" })];
  const t = k.topTicks(TAPE.x + 8, NOW_X, TAPE_SCALE / 2, 2, TAPE.y + 0.8, 1.2, [1.4, 2.6], P);
  out.push(L(t.minor, { tone: "faint" }), L(t.major, { tone: "lo" }));
  out.push(L(k.lineOnTop([TAPE.x + 6, TAPE.y + 5], [NOW_X, TAPE.y + 5], 1.2, P) + k.lineOnTop([TAPE.x + 6, TAPE.y + 9], [NOW_X, TAPE.y + 9], 1.2, P), { tone: "faint" }));
  // The "now" mark: a small upright block at the right end.
  out.push(S(slab({ x: NOW_X, y: TAPE.y + 1, w: 2.4, d: TAPE.d - 2 }, 1.2, 5, 2), { tone: "mid" }));
  return out.join("");
}
export function pegSvg() { return S(k.cylinder(0, 0, 0.9, 1.2, 3.2, P, 12), { tone: "hi", crease: "lo" }); }
export function postSvg() {
  return S(k.cylinder(0, 0, 0.55, 1.2, 9, P, 10), { tone: "mid", crease: "none" })
    + `<g data-flag>${S(slab({ x: 0.5, y: -0.4, w: 4, d: 0.8, r: 0.2 }, 6.6, 3.4, 1), { tone: "hi", crease: "lo", lit: true })}</g>`
    + `<g data-flag-off style="display:none">${S(slab({ x: 0.5, y: -0.4, w: 4, d: 0.8, r: 0.2 }, 6.6, 3.4, 1), { tone: "hi", crease: "lo" })}</g>`;
}

// ---------- people ----------
export function pawnSvg() {
  return S(k.cylinder(0, 0, 2.5, 0, 0.8, P, 18, 0.2), { tone: "mid" })
    + S(k.cylinder(0, 0, 1.8, 0.8, 6.4, P, 16), { tone: "hi", crease: "none" })
    + S(k.cylinder(0, 0, 2.2, 7.2, 0.7, P, 16, 0.2), { tone: "mid" })
    + S(k.cylinder(0, 0, 1.6, 7.9, 2.8, P, 16, 0.3), { tone: "hi", crease: "lo" });
}

// ---------- the elevator ----------
const POSTS = [[SHAFT.x, SHAFT.y], [SHAFT.x + SHAFT.w - 3, SHAFT.y], [SHAFT.x, SHAFT.y + SHAFT.d - 3], [SHAFT.x + SHAFT.w - 3, SHAFT.y + SHAFT.d - 3]];
function post([x, y]) { return S(slab({ x, y, w: 3, d: 3 }, 0, TOWER_H, 2), { tone: "mid", crease: "none" }); }
function shaftBack() {
  const out = [S(slab({ x: SHAFT.x - 1, y: SHAFT.y - 1, w: SHAFT.w + 2, d: SHAFT.d + 2, r: 1 }, 0, 0.8, 3), { tone: "lo" })];
  out.push(L(k.planOutline(k.insetPlan({ ...CAR, r: 0.5 }, -0.6), 0.8, P), { tone: "faint" }));
  out.push(post(POSTS[0]), post(POSTS[1]));
  // Guide rails on the back posts.
  return out.join("");
}
function shaftFront() {
  const out = [post(POSTS[2]), post(POSTS[3])];
  // Head: a cap across the top with a winding motor; the crossbar over the door holds two dials.
  out.push(S(slab({ ...SHAFT, r: 1 }, TOWER_H, 2.4, 3, 0.4), { tone: "hi", crease: "lo" }));
  out.push(S(slab({ x: SHAFT.x + 12, y: SHAFT.y + 10, w: 16, d: 12, r: 1.2 }, TOWER_H + 2.4, 4.6, 3, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(SHAFT.x + 20, SHAFT.y + 16, 3.4, TOWER_H + 7, 0.8, P, 20), { tone: "hi", crease: "lo" }));
  out.push(S(slab(CROSS, CROSS_Z[0], CROSS_Z[1] - CROSS_Z[0], 2), { tone: "hi", crease: "lo" }));
  for (const [name, c] of [["quiet", DIALS.quiet], ["first", DIALS.first]]) {
    out.push(`<path class="dial-face" d="${k.sideRing(c, DIALS.r, "y", P, 32)}"/>`);
    const ticks = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, r0 = DIALS.r * (i % 3 === 0 ? 0.7 : 0.82);
      ticks.push(k.pathOf([at([c[0] + r0 * Math.sin(a), c[1], c[2] + r0 * Math.cos(a)]), at([c[0] + DIALS.r * 0.95 * Math.sin(a), c[1], c[2] + DIALS.r * 0.95 * Math.cos(a)])]));
    }
    out.push(L(ticks.join(""), { tone: "lo" }));
    out.push(`<g data-mark="${name}" style="display:none">${L(k.pathOf([at([c[0], c[1], c[2] + DIALS.r * 0.55]), at([c[0], c[1], c[2] + DIALS.r * 1.02])]), { tone: "hi" })}</g>`);
    out.push(`<path class="pie" data-pie="${name}" d=""/>`);
    out.push(D([at(c)], { size: 0.7, tone: "hi" }));
    out.push(text(c[0], c[1], CROSS_Z[0] + 1.1, name === "quiet" ? "DOOR TIMER" : "FIRST WAITING", { size: 2.1, tone: "mid", anchor: "middle" }));
  }
  return out.join("");
}

// The car, drawn at rest (floor at z 0); the live script moves the whole group. Passengers go inside.
function car() {
  const { x, y, w, d } = CAR;
  const out = [`<g data-car>`];
  out.push(`<path class="cable" data-cable d=""/>`);
  out.push(S(slab({ x, y, w, d, r: 0.8 }, 0, 1.6, 3), { tone: "mid" }));
  out.push(S(slab({ x, y, w, d: 1.6 }, 1.6, CAR_H - 1.6, 2), { tone: "lo", crease: "none" }));
  out.push(S(slab({ x, y, w: 1.6, d }, 1.6, CAR_H - 1.6, 2), { tone: "lo", crease: "none" }));
  out.push(`<g data-riders></g>`);
  // Right side: a waist rail and corner posts, so the riders show.
  out.push(S(slab({ x: x + w - 1.6, y, w: 1.6, d }, 1.6, 5.5, 2), { tone: "mid" }));
  out.push(S(slab({ x: x + w - 1.6, y: y + d - 1.6, w: 1.6, d: 1.6 }, 1.6, CAR_H - 1.6, 2), { tone: "mid", crease: "none" }));
  out.push(S(slab({ x, y: y + d - 1.6, w: 1.6, d: 1.6 }, 1.6, CAR_H - 1.6, 2), { tone: "mid", crease: "none" }));
  // Doors: open (two narrow panels at the sides) or closed (two panels meeting in the middle).
  const door = (x0, ww, lit) => S(slab({ x: x0, y: y + d - 1.4, w: ww, d: 1.2, r: 0.2 }, 1.6, 11.8, 1), { tone: "hi", crease: "lo", lit });
  out.push(`<g data-doors="open">${door(x + 1.6, 4, false)}${door(x + w - 5.6, 4, false)}</g>`);
  out.push(`<g data-doors="closed" style="display:none">${door(x + 1.6, w / 2 - 1.6, true)}${door(x + w / 2, w / 2 - 1.6, true)}</g>`);
  // Open top: a frame of rails, so the riders show; the front rail is a header carrying the "aboard" counter.
  out.push(S(slab({ x, y, w, d: 1.6 }, CAR_H, 1.4, 2), { tone: "hi", crease: "lo" }));
  out.push(S(slab({ x, y, w: 1.6, d }, CAR_H, 1.4, 2), { tone: "hi", crease: "lo" }));
  out.push(S(slab({ x: x + w - 1.6, y, w: 1.6, d }, CAR_H, 1.4, 2), { tone: "hi", crease: "lo" }));
  out.push(S(slab({ x: x + 1.6, y: y + d - 1.6, w: w - 3.2, d: 1.6 }, 13.4, CAR_H + 1.4 - 13.4, 2), { tone: "hi", crease: "lo" }));
  out.push(counter(COUNTERS.aboard, "aboard", 0));
  out.push(S(slab({ x: x + w / 2 - 6, y: y + d / 2 - 1, w: 12, d: 2 }, CAR_H, 1.4, 2), { tone: "mid", crease: "none" }));
  out.push(`</g>`);
  return out.join("");
}
export const CABLE_TOP = [SHAFT.x + 20, SHAFT.y + 16, TOWER_H];

// Slots for riders inside the car (4 x 3) and for people waiting in the lobby.
export const RIDE_SLOTS = Array.from({ length: 12 }, (_, i) => [CAR.x + 6 + (i % 4) * 9.4, CAR.y + 7 + Math.floor(i / 4) * 9.6]);
export const WAIT_SLOTS = Array.from({ length: 8 }, (_, i) => [CAR.x + 6 + (i % 4) * 9.4, CAR_FRONT + 5 + Math.floor(i / 4) * 6]);
export const KB_EXIT = [KB.x + 34, KB.y - 3];

// ---------- the server floor ----------
function mezz() {
  const out = [S(k.slabOf(MEZZ, 0, TOP, P, 4, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(MEZZ, 3), TOP, P), { tone: "faint" }));
  // Landing where riders step off the car, and where the stairs arrive.
  out.push(S(slab({ x: MEZZ.x + 1, y: MEZZ_FRONT - 9, w: 12, d: 7 }, TOP, 0.5, 2), { tone: "lo", crease: "none" }));
  out.push(server());
  // The desk with the ticket slots and the requests counter.
  out.push(S(k.slabOf(DESK, TOP, DESK_H, P, 3, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(SLOTS.map(([sx, sy]) => k.lineOnTop([sx - TICKET.w / 2 - 0.4, sy + TICKET.d / 2 + 0.6], [sx + TICKET.w / 2 + 0.4, sy + TICKET.d / 2 + 0.6], TOP + DESK_H, P)).join(""), { tone: "lo" }));
  out.push(counter(COUNTERS.sent, "sent", 0));
  out.push(text(DESK.x + 18, DESK_FRONT, TOP + 2.2, "REQUESTS SENT", { size: 2.4, tone: "mid" }));
  return out.join("");
}
function server() {
  // A server rack at the back (drive bays and a status light) and the person answering requests behind the desk.
  const out = [S(k.slabOf(RACK, TOP, RACK_H, P, 2, 0.3), { tone: "hi", crease: "lo" })];
  const face = RACK.y + RACK.d;
  const bays = [];
  for (let i = 0; i < 5; i++) { const z = TOP + 2 + i * 3; bays.push(k.faceRectY(P, RACK.x + 2, RACK.x + RACK.w - 6, face, z, z + 2)); }
  out.push(L(bays.join(""), { tone: "lo" }));
  out.push(D([0, 1, 2, 3, 4].map((i) => at([RACK.x + RACK.w - 3.5, face, TOP + 3 + i * 3])), { size: 0.55, tone: "mid" }));
  out.push(`<g transform="${k.translateAlong(P, [DESK.x + DESK.w - 12, DESK.y - 4, TOP])}">${pawnSvg()}</g>`);
  return out.join("");
}
export function ticketSvg() {
  const card = slab({ x: -TICKET.w / 2, y: -TICKET.d / 2, w: TICKET.w, d: TICKET.d, r: 0.2 }, TOP + DESK_H, TICKET.h, 1);
  const flat = slab({ x: -TICKET.w / 2, y: -TICKET.h / 2 + 2, w: TICKET.w, d: TICKET.h - 2, r: 0.2 }, TOP + DESK_H, 0.6, 1);
  return `<g data-up>${S(card, { tone: "hi", crease: "lo", lit: true })}</g><g data-down style="display:none" opacity=".55">${S(flat, { tone: "hi", crease: "lo" })}</g>`;
}

// Stairs as stacked layers, each running to the top end: the front shows a clean stepped profile.
function stairs() {
  const out = [];
  const run = (STAIR.x1 - STAIR.x0) / STEPS, rise = TOP / STEPS;
  for (let i = 0; i < STEPS; i++) {
    out.push(S(slab({ x: STAIR.x0 + i * run, y: STAIR.y, w: STAIR.x1 - STAIR.x0 - i * run, d: STAIR.d, r: 0.3 }, i * rise, rise, 2), { tone: "hi", crease: "lo" }));
  }
  return out.join("");
}
export const stairPoint = (s) => { const run = (STAIR.x1 - STAIR.x0) / STEPS; const i = Math.min(STEPS - 1, Math.floor(s * STEPS)); return [STAIR.x0 + (s * STEPS) * run, STAIR.y + STAIR.d / 2, ((i + 1) * TOP) / STEPS]; };

// ---------- the lobby ----------
function keyboard() {
  const out = [S(k.slabOf(KB, 0, KB_H, P, 3, 0.5), { tone: "mid" })];
  ROWS.forEach((row, r) => [...row].forEach((ch, c) => {
    const [x, y] = keyAt(r, c);
    out.push(`<g data-key="${ch}">${keyCap({ x, y, w: KEY.w, d: KEY.d })}</g>`);
  }));
  out.push(`<g data-key=" ">${keyCap(SPACE)}</g>`);
  // The keys counter on its own stand.
  out.push(S(k.slabOf(KEYS_BOX, 0, KEYS_H, P, 3, 0.4), { tone: "mid" }));
  out.push(counter(COUNTERS.keys, "keys", 0));
  out.push(text(KEYS_BOX.x + KEYS_BOX.w / 2, KEYS_BOX.y + KEYS_BOX.d, 9.4, "KEYS", { size: 2.4, tone: "mid", anchor: "middle" }));
  return out.join("");
}
function keyCap(plan) {
  return `<g data-cap>${S(slab({ ...plan, r: 0.6 }, KB_H, 1.8, 3, 0.3), { tone: "hi", crease: "lo" })}</g><g data-cap-lit style="display:none">${S(slab({ ...plan, r: 0.6 }, KB_H, 0.9, 3, 0.3), { tone: "hi", crease: "lo", lit: true })}</g>`;
}

// ---------- the screen ----------
function screen() {
  const out = [S(k.slabOf(STAND, 0, 2, P, 3, 0.4), { tone: "mid" })];
  out.push(S(k.slabOf(PANEL, PANEL_Z[0], PANEL_Z[1] - PANEL_Z[0], P, 2, 0.3), { tone: "hi", crease: "lo" }));
  const f = SCREEN_FACE + 0.05;
  for (const key of ["typed", "shown"]) {
    const b = FIELDS[key];
    out.push(`<path class="field" data-field="${key}" d="${k.faceRectY(P, b.x0, b.x1, f, b.z0, b.z1)}"/>`);
  }
  out.push(text(FIELDS.typed.x0, f, FIELDS.typed.z1 + 1.2, "TYPED", { size: 2.4, tone: "mid" }));
  out.push(text(FIELDS.shown.x0, f, FIELDS.shown.z1 + 1.2, "RESULTS FOR", { size: 2.4, tone: "mid" }));
  out.push(text(FIELDS.typed.x0 + 1.8, f, FIELDS.typed.z0 + 2, "", { size: 4, tone: "hi", attr: "data-text=\"typed\"" }));
  out.push(text(FIELDS.shown.x0 + 1.8, f, FIELDS.shown.z0 + 2, "", { size: 4, tone: "hi", attr: "data-text=\"shown\"" }));
  out.push(counter(COUNTERS.stale, "stale", 0));
  out.push(text(82.4, f, 6.4, "OLDER ANSWER SHOWN", { size: 2.4, tone: "mid", anchor: "end" }));
  // The stale lamp on top of the panel.
  out.push(S(k.cylinder(LAMP.x, LAMP.y, 2.2, LAMP.z, 0.8, P, 18), { tone: "mid" }));
  out.push(`<g data-lamp="off">${S(k.cylinder(LAMP.x, LAMP.y, 1.6, LAMP.z + 0.8, 2.4, P, 16, 0.4), { tone: "hi", crease: "lo" })}</g>`);
  out.push(`<g data-lamp="on" style="display:none">${S(k.cylinder(LAMP.x, LAMP.y, 1.6, LAMP.z + 0.8, 2.4, P, 16, 0.4), { tone: "hi", crease: "lo", lit: true })}</g>`);
  return out.join("");
}
function wire() {
  return k.wireSvg(at(WIRE[0]), at(WIRE[WIRE.length - 1]), { via: WIRE.slice(1, -1).map(at), tone: "lo" });
}
export function dotSvg() {
  return S(k.cylinder(0, 0, 1.5, -0.6, 1.6, P, 14, 0.3), { tone: "hi", crease: "lo", lit: true });
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "An elevator lobby on a base plate. Every keystroke on the keyboard at the front sends a small figure to the elevator. With debounce, the elevator door stays open while figures keep arriving, and a door timer over it restarts with each one; when nobody has arrived for the wait time, the doors close and the car carries everyone up to the server floor as a single request. Without debounce, each figure climbs the stairs alone, one request per key. Answers come back down a wire to a screen that shows what was typed and which search the results belong to. A tape along the front marks every keystroke and every request.",
    body: [
      plate(),
      shaftBack(),
      car(),
      shaftFront(),
      mezz(),
      `<g data-tickets></g>`,
      wire(),
      `<g data-dots></g>`,
      stairs(),
      `<g data-climbers></g>`,
      `<g data-walkers></g>`,
      keyboard(),
      screen(),
      tape(),
      `<g data-tape></g>`,
    ],
  });
}

export const GEOMETRY = { TOP, CAR, CAR_H, DIALS, SLOTS, STEPS, STAIR, KB, SPACE, ROWS, COUNTERS, FIELDS, SCREEN_FACE, WIRE, TAPE, NOW_X, TAPE_SECONDS, TAPE_SCALE, RIDE_SLOTS, WAIT_SLOTS, KB_EXIT, CABLE_TOP, KEY };

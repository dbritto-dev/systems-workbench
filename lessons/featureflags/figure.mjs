// A theatre lighting console. Four stages (app servers) already carry the new show (deployed, dark);
// the console's faders decide who sees it. Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -172, y: -112, w: 344, d: 222, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

export const STAGES = [-120, -40, 40, 120];
const DECK = { y: -98, d: 36, w: 58, h: 6 };
export const DECK_FRONT = DECK.y + DECK.d;      // -62
const TRUSS_Y = -70;
export const LAMP_Z = 33;
export const RAIL_Y = -42;
export const RAIL_X0 = -162;
export const TOKEN = { w: 6, d: 5, h: 3, z: 2 };
export const BIN = { dx: 9, y: -54 };
export const CARD = { dx: 8, y: -68, w: 16, h: 11 };
export const DIAL = { dx: -15, y: -74, r: 5, z: DECK.h + 2 };

const DESK = { x: -134, y: 6, w: 268, d: 86, r: 4 };
export const DESK_TOP = 12;
export const FADER = { x0: -112, x1: -32, y: 30 };
export const TOGGLE = { x: 0, y: 30 };
export const KNOBS = { target: [34, 30], refresh: [64, 30] };
export const KILL = [104, 32];
export const BANK = { x0: -112, step: 11, y: 66, travel: 10 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-120, -98, 44], [120, -98, 44]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -150, y: 96, w: 180, d: 7, r: 1 })
    + labelPlate(P, { x: 70, y: 94, w: 52, d: 12, r: 1.5 }, [[76, 98, 34], [76, 102, 24]]);
}

// The cable from the console to a stage, lying on the plate (it passes under the feed rail).
export function cablePoints(i) {
  const cx = STAGES[i];
  return [[cx * 0.62, DESK.y, 1], [cx * 0.62, -18, 1], [cx - 22, -24, 1], [cx - 22, DECK_FRONT, 1]];
}

function cables() {
  return STAGES.map((_, i) => {
    const pts = cablePoints(i).map(at);
    return k.wireSvg(pts[0], pts[pts.length - 1], { via: pts.slice(1, -1), tone: "lo", size: 0.9 });
  }).join("");
}

function rail() {
  const out = [S(k.slabOf({ x: RAIL_X0, y: RAIL_Y - 3, w: 300, d: 6, r: 1 }, 0, 2, P, 3, 0.3), { tone: "mid", crease: "none" })];
  out.push(L(k.lineOnTop([RAIL_X0 + 1, RAIL_Y], [RAIL_X0 + 299, RAIL_Y], 2, P), { tone: "faint" }));
  STAGES.forEach((cx) => {
    out.push(S(k.slabOf({ x: cx - 3, y: DECK_FRONT, w: 6, d: RAIL_Y - 3 - DECK_FRONT, r: 0.6 }, 0, 2, P, 2), { tone: "mid", crease: "none" }));
  });
  // Turnstile where requests come in.
  out.push(S(k.slabOf({ x: RAIL_X0 - 10, y: RAIL_Y - 7, w: 10, d: 14, r: 1.5 }, 0, 10, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([RAIL_X0 - 5, RAIL_Y - 4, 10]), at([RAIL_X0 - 5, RAIL_Y + 4, 10])], { size: 0.4, tone: "lo" }));
  return out.join("");
}

function bins() {
  return STAGES.map((cx) => {
    const plan = { x: cx + BIN.dx - 4, y: BIN.y - 4, w: 8, d: 8, r: 1 };
    return S(k.slabOf(plan, 0, 4, P, 3, 0.3), { tone: "mid" }) + L(k.planOutline(k.insetPlan(plan, 1.4), 4, P, 2), { tone: "lo" });
  }).join("");
}

function stage(cx, i) {
  const out = [];
  const deck = { x: cx - DECK.w / 2, y: DECK.y, w: DECK.w, d: DECK.d, r: 2 };
  out.push(S(k.slabOf(deck, 0, DECK.h, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(deck, 2.5), DECK.h, P, 3), { tone: "faint" }));
  out.push(S(k.slabOf({ x: deck.x, y: deck.y, w: deck.w, d: 4, r: 1 }, DECK.h, 38, P, 2, 0.5), { tone: "mid" }));
  out.push(L(k.faceRectY(P, deck.x + 4, deck.x + deck.w - 4, deck.y + 4, DECK.h + 6, DECK.h + 32), { tone: "faint" }));
  for (const px of [deck.x + 3, deck.x + deck.w - 3]) out.push(S(k.cylinder(px, TRUSS_Y, 1.4, DECK.h, 36, P, 14), { tone: "mid", crease: "none" }));
  out.push(`<g data-lamp="${i}-old">${lamp(cx - 10)}</g>`);
  out.push(`<g data-lamp="${i}-new">${lamp(cx + 10, true)}</g>`);
  out.push(S(k.slabOf({ x: deck.x + 1, y: TRUSS_Y - 2, w: deck.w - 2, d: 4, r: 0.8 }, DECK.h + 36, 3, P, 2, 0.4), { tone: "mid" }));
  out.push(D([at([deck.x + 3, TRUSS_Y, DECK.h + 39]), at([deck.x + deck.w - 3, TRUSS_Y, DECK.h + 39])], { size: 0.4, tone: "lo" }));
  // Refresh dial: one turn is one cache refresh interval.
  const [dx, dy] = [cx + DIAL.dx, DIAL.y];
  out.push(S(k.cylinder(dx, dy, DIAL.r, DECK.h, 2, P, 32), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(dx, dy, DIAL.r - 1, DIAL.z, P, 32), { tone: "lo" }));
  const t = k.radialTicks(dx, dy, DIAL.r - 1.4, 12, 3, DIAL.z, [0.7, 1.4], P);
  out.push(L(t.minor, { tone: "faint" }), L(t.major, { tone: "lo" }));
  out.push(`<path class="iso-line" data-tone="hi" data-free="start" data-dial="${i}" d="" style="stroke-width:.9"/>`);
  // The cue card: this server's cached copy of the flag settings. The bar is the rollout it last fetched.
  const c = { x: cx + CARD.dx, y: CARD.y };
  out.push(S(k.slabOf({ x: c.x - 4, y: c.y - 2, w: 8, d: 3, r: 0.6 }, DECK.h, 2, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: c.x - CARD.w / 2, y: c.y, w: CARD.w, d: 1.4, r: 0.3 }, DECK.h + 2, CARD.h, P, 2, 0.3), { tone: "hi", crease: "lo" }));
  const fy = c.y + 1.4, z0 = DECK.h + 4.5, z1 = DECK.h + 7.5;
  out.push(L(k.faceRectY(P, c.x - 6, c.x + 6, fy, z0, z1), { tone: "lo" }));
  out.push(`<path class="cue-fill" data-cue="${i}" d=""/>`);
  out.push(L([0, 1].map((n) => k.segment([c.x - 6, fy, z1 + 2 + n * 2], [c.x - 6 + [9, 6][n], fy, z1 + 2 + n * 2], P)).join(""), { tone: "faint", free: true }));
  return out.join("");
}

function lamp(x, lit = false) {
  return S(k.cylinder(x, TRUSS_Y, 1, LAMP_Z + 4, 5, P, 10), { tone: "mid", crease: "none" })
    + S(k.cylinder(x, TRUSS_Y, 3.6, LAMP_Z, 4.5, P, 24, 0.3), { tone: lit ? "hi" : "mid", crease: "lo" });
}

function desk() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(DESK, 4), 0, 0.1, P)}" style="filter:blur(5px)"/>`];
  out.push(S(k.slabOf(DESK, 0, DESK_TOP, P, 5, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(DESK, 4), DESK_TOP, P, 4), { tone: "faint" }));
  out.push(D(k.corners(DESK, 3).map(([x, y]) => at([x, y, DESK_TOP])), { size: 0.45 }));
  // Rollout fader slot and its scale.
  out.push(L(k.planOutline({ x: FADER.x0 - 3, y: FADER.y - 1.6, w: FADER.x1 - FADER.x0 + 6, d: 3.2, r: 1.6 }, DESK_TOP, P, 3), { tone: "lo" }));
  const strip = { x: FADER.x0 - 4, y: FADER.y + 7, w: FADER.x1 - FADER.x0 + 8, d: 5, r: 0.8 };
  out.push(S(k.slabOf(strip, DESK_TOP, 0.5, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(FADER.x0, FADER.x1, 8, 5, strip.y + 0.6, DESK_TOP + 0.5, [1.6, 3], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  // Bucketing toggle slot.
  out.push(S(k.slabOf({ x: TOGGLE.x - 10, y: TOGGLE.y - 5, w: 20, d: 10, r: 1.5 }, DESK_TOP, 1.4, P, 3, 0.3), { tone: "mid" }));
  out.push(L(k.planOutline({ x: TOGGLE.x - 7, y: TOGGLE.y - 1.4, w: 14, d: 2.8, r: 1.4 }, DESK_TOP + 1.4, P, 3), { tone: "lo" }));
  // Rotary knobs: targeting and cache refresh, each on a scale ring.
  for (const [x, y] of Object.values(KNOBS)) {
    out.push(L(k.ring(x, y, 9, DESK_TOP, P, 40), { tone: "lo" }));
    const t = k.radialTicks(x, y, 9.2, 8, 8, DESK_TOP, [0, 1.8], P, -Math.PI / 2, Math.PI);
    out.push(L(t.major, { tone: "mid" }));
  }
  // Kill switch: a guard ring round the button well.
  const [kx, ky] = KILL;
  out.push(S(k.cylinder(kx, ky, 10, DESK_TOP, 2, P, 40, 0.4), { tone: "mid" }));
  out.push(L(k.ring(kx, ky, 8, DESK_TOP + 2, P, 40), { tone: "lo" }));
  // Flag bank: ten short fader slots; each raised cap is a flag in use.
  for (let i = 0; i < 10; i++) {
    const x = BANK.x0 + i * BANK.step;
    out.push(L(k.planOutline({ x: x - 1.4, y: BANK.y - BANK.travel / 2 - 2, w: 2.8, d: BANK.travel + 4, r: 1.4 }, DESK_TOP, P, 3), { tone: "lo" }));
  }
  return out.join("");
}

export const faderCap = () => S(k.slabOf({ x: -4, y: FADER.y - 5, w: 8, d: 10, r: 1.2 }, DESK_TOP, 5, P, 2, 0.4), { tone: "hi", crease: "lo" });
export const toggleLever = () => S(k.slabOf({ x: -2.5, y: TOGGLE.y - 2.5, w: 5, d: 5, r: 1 }, DESK_TOP + 1.4, 5, P, 2, 0.3), { tone: "hi", crease: "lo" });
export const knob = ([x, y]) => S(k.cylinder(x, y, 6, DESK_TOP, 5, P, 32, 0.4), { tone: "hi", crease: "lo" }) + L(k.knurl(x, y, 6, DESK_TOP, DESK_TOP + 5, 30, P), { tone: "lo" });
export const killCap = () => S(k.cylinder(KILL[0], KILL[1], 6.4, DESK_TOP + 2, 5, P, 36, 0.5), { tone: "hi", crease: "lo" });
export const bankCap = (i) => S(k.slabOf({ x: BANK.x0 + i * BANK.step - 3, y: BANK.y - 2, w: 6, d: 4, r: 1 }, DESK_TOP, 3, P, 2, 0.3), { tone: "hi", crease: "lo" });
export const tokenSvg = () => S(k.slabOf({ x: -TOKEN.w / 2, y: -TOKEN.d / 2, w: TOKEN.w, d: TOKEN.d, r: 0.8 }, 0, TOKEN.h, P, 2, 0.3), { tone: "hi", crease: "lo" });

export function buildFigure() {
  const stages = STAGES.map((cx, i) => ({ i, cx, key: k.depthOf([cx, -80, 0], P) })).sort((a, b) => a.key - b.key);
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "A theatre lighting console on a base plate. At the back, four stages stand for four app servers; each already holds the new show, dark until the console says otherwise. Requests ride a rail from a turnstile to the stages. Each stage keeps a cue card, its cached copy of the console's settings, and a dial that shows when it next fetches them along its cable. At the front, a rollout fader, a random or sticky toggle, a targeting knob, a refresh knob, a guarded kill switch and a bank of ten flag faders.",
    body: [
      plate(),
      cables(),
      `<g data-pulses></g>`,
      rail(),
      ...stages.map((s) => `<g data-stage="${s.i}">${stage(s.cx, s.i)}</g>`),
      bins(),
      `<g data-tokens></g>`,
      desk(),
      `<g data-fader>${faderCap()}</g>`,
      `<g data-toggle>${toggleLever()}</g>`,
      `<g data-knob="target">${knob(KNOBS.target)}<path class="iso-line" data-tone="hi" data-free="end" data-pointer="target" d=""/></g>`,
      `<g data-knob="refresh">${knob(KNOBS.refresh)}<path class="iso-line" data-tone="hi" data-free="end" data-pointer="refresh" d=""/></g>`,
      `<g data-kill>${killCap()}</g>`,
      ...Array.from({ length: 10 }, (_, i) => `<g data-bank="${i}">${bankCap(i)}</g>`),
    ],
  });
}

export const GEOMETRY = { STAGES, DECK_FRONT, RAIL_Y, RAIL_X0, TOKEN, BIN, CARD, DIAL, DECK_H: DECK.h, FADER, TOGGLE, KNOBS, KILL, BANK, DESK_TOP, LAMP_Z, TRUSS_Y };

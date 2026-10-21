// Three stacks on one base plate, each a pile you can only touch from the top.
//   Left: the call stack, a tall plate tower; every call puts a labelled plate on top, every return lifts the top
//         one off. A collar on a corner post marks the top; the shelf at the limit is where the stack overflows.
//   Middle: undo and redo, two short towers in front of the document they edit, and a bin for redo plates
//         thrown away when you type something new.
//   Right: a busy server. Requests pile up in a column as they arrive (newest on top); the clerk's grabber takes
//         from the top (newest first, a stack) or from a slot at the bottom (oldest first, a queue). Requests
//         older than the client's timeout fade: finishing them is wasted work.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, digitCounter, faceText, person } from "../../workbench/parts.mjs";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -126, y: -60, w: 252, d: 90, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// ---------- call stack ----------
export const LIMIT = 12;                                   // frames the tower holds
const PED = { x: -114, y: -32, w: 50, d: 38, r: 2 };       // pedestal under the tower
const PED_H = 9;
export const CS = { x: -106, y: -24, w: 28, d: 22, r: 2.2, z0: PED_H, th: 3.3, pitch: 3.8 };
CS.cx = CS.x + CS.w / 2; CS.front = CS.y + CS.d;
const csZ = (i) => CS.z0 + i * CS.pitch;                   // bottom of plate i
export const CEIL_Z = csZ(LIMIT) + 0.3;                    // underside of the limit beam
const BACK = { x: -110, y: -31, w: 48, d: 3.4, r: 0.6 };   // backboard
const BACK_TOP = CEIL_Z + 12;

// ---------- undo / redo ----------
const DOC = { x: -56, y: -57, w: 74, d: 3, r: 0.6 };
const DOC_H = 30;
export const DOC_SLOTS = 8;
export const UR_LIMIT = 6;
export const UR = [
  { x: -52, y: -42, w: 19, d: 15, r: 1.8 },               // undo plates
  { x: -22, y: -42, w: 19, d: 15, r: 1.8 },               // redo plates
].map((p) => ({ ...p, cx: p.x + p.w / 2, cy: p.y + p.d / 2, front: p.y + p.d }));
const UR_BASE_H = 4;
export const UR_TH = 3.4, UR_PITCH = 3.9;
const urZ = (i) => UR_BASE_H + i * UR_PITCH;
export const BIN = { x: 4, y: -26, w: 18, d: 13, r: 1.2 };

// ---------- busy server ----------
export const COL = { x: 40, y: -40, w: 15, d: 15, r: 1.4 };  // the request column
COL.cx = COL.x + COL.w / 2; COL.cy = COL.y + COL.d / 2; COL.front = COL.y + COL.d;
const COL_BASE_H = 12;
export const TK_TH = 1.8, TK_PITCH = 2.35, TK_SHOW = 16;
const tkZ = (i) => COL_BASE_H + i * TK_PITCH;
export const DESK = { x: 72, y: -46, w: 36, d: 20, r: 1.6 };
const DESK_H = 11;
export const WORK = { x: 80, y: -40, w: 12, d: 10, r: 0.8 };  // the request in hand, on the desk
export const TRAYS = [
  { x: 66, y: -6, w: 24, d: 17, r: 1.4 },                  // finished in time
  { x: 95, y: -6, w: 24, d: 17, r: 1.4 },                  // finished too late (wasted)
];
export const TRAY_SHOW = 8;
const TRAY_H = 9;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [BACK.x, BACK.y, BACK_TOP + 8], [BACK.x + BACK.w, BACK.y, BACK_TOP + 8], [DOC.x, DOC.y, DOC_H], [DOC.x + DOC.w, DOC.y, DOC_H]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 50 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const text = (x, y, z, value, opts) => faceText(P, [x, y, z], value, opts);
const hidden = (on) => (on ? "" : ' style="display:none"');

// Counters (digit wheels) on front faces.
export const COUNTERS = {
  depth: { x: -104, y: PED.y + PED.d, z: 1.6, w: 5.2, h: 6, gap: 0.8, count: 2, size: "m" },
  deepest: { x: -83, y: PED.y + PED.d, z: 1.6, w: 5.2, h: 6, gap: 0.8, count: 2, size: "m" },
  waiting: { x: COL.x - 1.4, y: COL.front + 2, z: 1.2, w: 4.2, h: 4.8, gap: 0.6, count: 3, size: "s" },
  onTime: { x: TRAYS[0].x + 3, y: TRAYS[0].y + TRAYS[0].d, z: 0.7, w: 4.2, h: 4.6, gap: 0.6, count: 3, size: "s" },
  late: { x: TRAYS[1].x + 3, y: TRAYS[1].y + TRAYS[1].d, z: 0.7, w: 4.2, h: 4.6, gap: 0.6, count: 3, size: "s" },
  oldest: { x: DESK.x + 3, y: DESK.y + DESK.d, z: 2.4, w: 4.4, h: 5.4, gap: 0.6, count: 2, size: "s" },
};

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -116, y: 14, w: 60, d: 6, r: 1 });
}

// ---------- the call stack tower ----------
// One frame plate: a rounded slab with its call printed on the front edge.
export function framePlate(label = "", lit = false, attr = "") {
  return S(k.slabOf(CS, 0, CS.th, P, 4, 0.4), { tone: "hi", crease: "lo", lit })
    + text(CS.cx, CS.front, 0.75, label, { size: 2.7, tone: "hi", anchor: "middle", attr });
}

function callStack(initial) {
  const out = [];
  // Pedestal with the two counters on its front.
  out.push(S(k.slabOf(PED, 0, PED_H, P, 4, 0.6), { tone: "mid" }));
  out.push(text(-93, PED.y + PED.d, 3.2, "DEPTH", { size: 2.1, tone: "mid" }));
  out.push(text(-72, PED.y + PED.d, 3.2, "DEEPEST", { size: 2.1, tone: "mid" }));
  out.push(digitCounter(P, { ...COUNTERS.depth, housing: false, name: "depth", value: initial.length }));
  out.push(digitCounter(P, { ...COUNTERS.deepest, housing: false, name: "deepest", value: initial.length }));
  // Backboard with a ruler of frame levels beside the stack, the limit marked.
  out.push(S(k.slabOf(BACK, PED_H, BACK_TOP - PED_H, P, 3, 0.4), { tone: "mid" }));
  const fy = BACK.y + BACK.d;
  const tx0 = CS.x + CS.w + 1.6, tx1 = tx0 + 2.4;
  const ticks = [];
  for (let i = 1; i <= LIMIT; i++) ticks.push(k.segment([tx0, fy, csZ(i)], [i % 4 === 0 ? tx1 + 1.6 : tx1, fy, csZ(i)], P));
  out.push(L(ticks.join(""), { tone: "lo" }));
  for (const i of [4, 8, 12]) out.push(text(tx1 + 2.6, fy, csZ(i) - 1, String(i), { size: 2.2, tone: "lo" }));
  // Overflow lamp on top of the backboard: off and lit versions.
  const lamp = (lit) => S(k.cylinder(BACK.x + 6, BACK.y + 1.7, 2.6, BACK_TOP, 1.2, P, 18), { tone: "mid", crease: "none" })
    + S(k.cylinder(BACK.x + 6, BACK.y + 1.7, 2, BACK_TOP + 1.2, 3.2, P, 18, 0.8), { tone: "hi", crease: "lo", lit });
  const rays = L([3.8, 5.2].map((r) => k.ring(BACK.x + 6, BACK.y + 1.7, r, BACK_TOP + 4.4, P, 24)).join(""), { tone: "lit" });
  out.push(`<g data-lamp="off">${lamp(false)}</g><g data-lamp="on" style="display:none">${lamp(true)}${rays}</g>`);
  // Plates, bottom to top; slot LIMIT is the plate that didn't fit (shown above the beam on overflow).
  const slot = (i, z) => `<g data-cs-slot="${i}" transform="${k.translateAlong(P, [0, 0, z])}"${hidden(i < initial.length)}>${framePlate(i < initial.length ? initial[i] : "", i === LIMIT, `data-cs-label="${i}"`)}</g>`;
  for (let i = 0; i < LIMIT; i++) out.push(slot(i, csZ(i)));
  out.push(`<g data-cs-fly style="display:none">${framePlate("", true, "data-cs-fly-label")}</g>`);
  // The limit: a shelf over the stack, bracketed to the backboard. Nothing fits above it.
  const shelf = { x: CS.x - 1.6, y: BACK.y + BACK.d, w: CS.w + 3.2, d: CS.front + 1.6 - (BACK.y + BACK.d), r: 1.2 };
  out.push(S(k.slabOf(shelf, CEIL_Z, 1.6, P, 3, 0.3), { tone: "mid" }));
  out.push(L(k.faceRectY(P, shelf.x + 2, shelf.x + shelf.w - 2, shelf.y + shelf.d, CEIL_Z + 0.4, CEIL_Z + 1.2), { tone: "faint" }));
  out.push(text(shelf.x + shelf.w / 2, shelf.y + shelf.d, CEIL_Z + 0.35, "LIMIT", { size: 1.3, tone: "lo", anchor: "middle" }));
  out.push(`<g data-cs-posts>${[shelf.x + 0.9, shelf.x + shelf.w - 0.9].map((x) => S(k.cylinder(x, shelf.y + shelf.d - 0.9, 0.75, PED_H, CEIL_Z - PED_H, P, 12), { tone: "mid", crease: "none" })).join("")}</g>`);
  // The top-of-stack marker: a lit collar riding the front-right post, level with the top plate.
  const postX = shelf.x + shelf.w - 0.9, postY = shelf.y + shelf.d - 0.9;
  const cursor = S(k.cylinder(postX, postY, 1.9, -1.4, 2.8, P, 18, 0.4), { tone: "hi", crease: "lo", lit: true });
  const topZ = initial.length ? csZ(initial.length) - 0.6 : csZ(0);
  out.push(`<g data-cs-cursor transform="${k.translateAlong(P, [0, 0, topZ])}">${cursor}</g>`);
  out.push(slot(LIMIT, CEIL_Z + 2.4));   // the frame that didn't fit, shown above the shelf
  return out.join("");
}

// ---------- undo and redo ----------
export function letterPlate(i, letter = "", lit = false, attr = "") {
  const p = UR[i];
  return S(k.slabOf(p, 0, UR_TH, P, 4, 0.3), { tone: "hi", crease: "lo", lit })
    + text(p.cx, p.front, 0.55, letter, { size: 3.1, tone: "hi", anchor: "middle", attr });
}

function undoRedo(state) {
  const out = [];
  // The document: a standing board with letter tiles and a caret after the last one.
  out.push(S(k.slabOf({ x: DOC.x + 2, y: DOC.y - 4, w: DOC.w - 4, d: 7, r: 1 }, 0, 2, P, 3), { tone: "lo" }));
  out.push(S(k.slabOf(DOC, 2, DOC_H - 2, P, 3, 0.4), { tone: "mid" }));
  const fy = DOC.y + DOC.d;
  out.push(L(k.faceRectY(P, DOC.x + 3, DOC.x + DOC.w - 3, fy, 9, DOC_H - 3), { tone: "lo" }));
  out.push(text(DOC.x + 4.5, fy, DOC_H - 6.4, "DOCUMENT", { size: 1.9, tone: "lo" }));
  for (let s = 0; s < DOC_SLOTS; s++) {
    const x0 = DOC.x + 5 + s * 7.1;
    out.push(`<g data-doc="${s}"${hidden(s < state.doc.length)}>`
      + `<path class="tile" d="${k.faceRectY(P, x0, x0 + 6, fy, 11, 19)}"/>`
      + text(x0 + 3, fy, 12.6, state.doc[s] || "", { size: 5.4, tone: "hi", anchor: "middle", attr: `data-doc-label="${s}"` })
      + `</g>`);
  }
  out.push(`<path data-caret class="caret" d="${k.segment([DOC.x + 5 + state.doc.length * 7.1 - 0.6, fy, 10.6], [DOC.x + 5 + state.doc.length * 7.1 - 0.6, fy, 19.4], P)}"/>`);
  // Two towers on bases, with UNDO and REDO printed on the base fronts.
  UR.forEach((p, i) => {
    const base = { x: p.x - 2, y: p.y - 2, w: p.w + 4, d: p.d + 5, r: 1.6 };
    out.push(S(k.slabOf(base, 0, UR_BASE_H, P, 3, 0.4), { tone: "mid" }));
    out.push(text(p.cx, base.y + base.d, 0.9, i ? "REDO" : "UNDO", { size: 2.7, tone: "mid", anchor: "middle" }));
    out.push(S(k.cylinder(p.x - 0.4, p.y - 0.4, 0.8, UR_BASE_H, urZ(UR_LIMIT) + 1 - UR_BASE_H, P, 12), { tone: "mid", crease: "none" }));
    out.push(S(k.cylinder(p.x + p.w + 0.4, p.y - 0.4, 0.8, UR_BASE_H, urZ(UR_LIMIT) + 1 - UR_BASE_H, P, 12), { tone: "mid", crease: "none" }));
    const pile = i ? state.redo : state.undo;
    for (let s = 0; s < UR_LIMIT; s++) out.push(`<g data-ur-slot="${i}-${s}" transform="${k.translateAlong(P, [0, 0, urZ(s)])}"${hidden(s < pile.length)}>${letterPlate(i, pile[s] || "", false, `data-ur-label="${i}-${s}"`)}</g>`);
  });
  out.push(`<g data-ur-fly style="display:none">${letterPlate(0, "", true, "data-ur-fly-label")}</g>`);
  // The bin in front of the redo tower: thrown-away redo plates lie flat in it.
  out.push(S(k.slabOf(BIN, 0, 0.8, P, 3), { tone: "lo" }));
  for (let s = 0; s < 3; s++) out.push(`<g data-bin="${s}"${hidden(s < state.binned)}>${S(k.slabOf({ x: BIN.x + 2.4 + s * 1.2, y: BIN.y + 1.6 + s * 0.6, w: 11, d: 7.6, r: 1 }, 0.8 + s * 0.9, 0.8, P, 3), { tone: "hi", crease: "lo" })}</g>`);
  const wall = (plan) => S(k.slabOf(plan, 0.8, 4.2, P, 2), { tone: "mid", crease: "none" });
  out.push(wall({ x: BIN.x, y: BIN.y, w: BIN.w, d: 1, r: 0.3 }), wall({ x: BIN.x, y: BIN.y, w: 1, d: BIN.d, r: 0.3 }));
  out.push(`<g data-bin-front>${wall({ x: BIN.x + BIN.w - 1, y: BIN.y, w: 1, d: BIN.d, r: 0.3 })}${wall({ x: BIN.x, y: BIN.y + BIN.d - 1, w: BIN.w, d: 1, r: 0.3 })}</g>`);
  return out.join("");
}

// ---------- the busy server ----------
export function ticketSvg(lit = false) {
  return S(k.slabOf({ x: COL.x + 0.6, y: COL.y + 0.6, w: COL.w - 1.2, d: COL.d - 1.2, r: 0.6 }, 0, TK_TH, P, 2, 0.2), { tone: "hi", crease: "lo", lit });
}
function server(state) {
  const out = [];
  // Clerk behind the desk.
  out.push(person(P, [DESK.x + 9, DESK.y - 5, 0], { scale: 0.95, hat: "cap" }));
  // Column: base with WAITING and OLDEST counters, three corner posts (front corner open).
  const base = { x: COL.x - 3, y: COL.y - 3, w: COL.w + 6, d: COL.d + 5, r: 1.4 };
  out.push(S(k.slabOf(base, 0, COL_BASE_H, P, 3, 0.4), { tone: "mid" }));
  out.push(text(COUNTERS.waiting.x, base.y + base.d, 7.1, "WAITING", { size: 1.9, tone: "mid" }));
  const top = tkZ(TK_SHOW) + 2;
  for (const [x, y] of [[COL.x - 0.6, COL.y - 0.6], [COL.x + COL.w + 0.6, COL.y - 0.6], [COL.x - 0.6, COL.y + COL.d + 0.6]]) {
    out.push(S(k.cylinder(x, y, 0.7, COL_BASE_H, top - COL_BASE_H, P, 10), { tone: "mid", crease: "none" }));
  }
  // The bottom slot (where a queue takes from): a notch in the base front.
  out.push(L(k.faceRectY(P, COL.x + 1, COL.x + COL.w - 1, base.y + base.d, COL_BASE_H - 2.2, COL_BASE_H - 0.6), { tone: "lo" }));
  for (let s = 0; s < TK_SHOW; s++) out.push(`<g data-tk="${s}" transform="${k.translateAlong(P, [0, 0, tkZ(s)])}"${hidden(s < state.tickets.length)}${state.tickets[s] ? " data-stale" : ""}>${ticketSvg(false)}</g>`);
  out.push(`<g data-tk-fly style="display:none">${ticketSvg(true)}</g>`);
  out.push(digitCounter(P, { ...COUNTERS.waiting, housing: false, name: "waiting", value: state.tickets.length }));
  // Desk, the request in hand, and the grabber arm reaching from the desk to the column.
  out.push(S(k.slabOf(DESK, 0, DESK_H, P, 4, 0.6), { tone: "mid" }));
  out.push(text(COUNTERS.oldest.x + 11, DESK.y + DESK.d, 4.2, "OLDEST WAIT, s", { size: 1.9, tone: "mid" }));
  out.push(digitCounter(P, { ...COUNTERS.oldest, housing: false, name: "oldest", value: 3 }));
  out.push(`<g data-work${hidden(state.working)}>${S(k.slabOf(WORK, DESK_H, TK_TH, P, 2, 0.2), { tone: "hi", crease: "lo", lit: true })}</g>`);
  out.push(`<g data-work-stale style="display:none">${S(k.slabOf(WORK, DESK_H, TK_TH, P, 2, 0.2), { tone: "hi", crease: "lo" })}</g>`);
  const arm = S(k.slabOf({ x: COL.x + COL.w - 4, y: COL.cy - 1.2, w: DESK.x + 1.4 - (COL.x + COL.w - 4), d: 2.4, r: 0.5 }, 0, 1.4, P, 2), { tone: "hi", crease: "lo", lit: true })
    + S(k.slabOf({ x: COL.x + COL.w - 5.2, y: COL.cy - 3, w: 2, d: 6, r: 0.4 }, -0.6, 2.6, P, 2), { tone: "hi", crease: "none", lit: true });
  out.push(S(k.slabOf({ x: DESK.x + 0.8, y: COL.cy - 2, w: 3.2, d: 4, r: 0.6 }, DESK_H, 1, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(DESK.x + 2.4, COL.cy, 0.9, DESK_H + 1, tkZ(TK_SHOW) + 4 - DESK_H - 1, P, 12), { tone: "mid", crease: "none" }));
  out.push(`<g data-grab transform="${k.translateAlong(P, [0, 0, state.grabZ])}">${arm}</g>`);
  // Two trays in front of the desk: finished in time, finished too late. A counter on each.
  TRAYS.forEach((t, i) => {
    out.push(S(k.slabOf(t, 0, TRAY_H, P, 3, 0.4), { tone: "mid" }));
    out.push(L(k.planOutline(k.insetPlan(t, 1.4), TRAY_H, P), { tone: "lo" }));
    for (let s = 0; s < TRAY_SHOW; s++) out.push(`<g data-tray="${i}-${s}"${hidden(s < state.trays[i])}${i ? " data-stale" : ""}>${S(k.slabOf({ x: t.x + 4.5, y: t.y + 2.4, w: 13, d: 10, r: 0.6 }, TRAY_H + s * 1.3, 1.1, P, 2), { tone: "hi", crease: "lo" })}</g>`);
    out.push(digitCounter(P, { ...(i ? COUNTERS.late : COUNTERS.onTime), housing: false, name: (i ? "late" : "onTime"), value: state.trays[i] * 7 }));
    out.push(text(t.x + 3, t.y + t.d, 6.5, i ? "TOO LATE" : "IN TIME", { size: 1.9, tone: "mid" }));
  });
  return out.join("");
}

export const COL_GEOM = { tkZ0: COL_BASE_H, TK_PITCH, TK_TH, TK_SHOW, BOTTOM_GRAB: COL_BASE_H - 2.4, TRAY_SHOW };
export const CS_GEOM = { z0: CS.z0, pitch: CS.pitch, LIMIT, CEIL_Z };
export const UR_GEOM = { UR, UR_BASE_H, UR_PITCH, UR_LIMIT, DOC_SLOTS, DOC: { x: DOC.x, fy: DOC.y + DOC.d } };

// The first frame, before the live script takes over: a recursive sum part-way down, a few edits with two
// undone, and a busy server with older requests already fading at the bottom of the column.
export const FIRST = {
  stack: ["sum 10", "sum 9", "sum 8", "sum 7", "sum 6", "sum 5", "sum 4"],
  editor: { doc: ["S", "T", "A"], undo: ["S", "T", "A"], redo: ["K", "C"], binned: 1 },
  server: { tickets: [1, 1, 1, 1, 0, 0, 0, 0, 0], working: true, grabZ: tkZ(9) + 0.6, trays: [5, 2] },
};

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "Three stacks on one base plate. Left: a tall tower of labelled plates, the call stack, with a collar on a corner post that marks the top plate, a ruler of levels on the backboard and a shelf at the limit, with a warning lamp on top. Middle: a document board with letter tiles, and two short towers of letter plates for undo and redo, with a bin for thrown-away redo plates. Right: a column of waiting requests, newest on top, a clerk at a desk whose grabber takes either the top or the bottom request, and two trays for requests finished in time and too late.",
    body: [plate(), undoRedo(FIRST.editor), callStack(FIRST.stack), server(FIRST.server)],
  });
}

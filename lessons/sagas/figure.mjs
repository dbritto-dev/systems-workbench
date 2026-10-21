// A travel agency: a trip folder rides a forward track past five counters (flight, hotel, car, payment, email).
// Each counter books its part and hangs a tag on its board. When a step fails, the folder drops to the return
// track and rides back past every counter it visited, and each one takes its tag down (the compensation).
// An orchestrator desk sends a courier to each counter and keeps a checklist; with choreography it is covered.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip } from "../../workbench/parts.mjs";
import { sphereOf } from "../../workbench/vendor-anatomy/kit/lathe.mjs";

export const WIDTH = 700;
export const HEIGHT = 440;

const PLATE = { x: -150, y: -78, w: 290, d: 134, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;

export const SX = [-92, -46, 0, 46, 92];        // counter slots, left to right
export const DOOR_X = -128;
export const EXIT_X = 128;
export const LANE_Y = { f: -23, r: -6, s: 9 }; // forward track, return track, stuck ledge
export const LANE_Z = { f: 6.9, r: 1.6, s: 0.5 }; // where a folder rides: raised forward track, floor return track, ledge
const BED_Z = 0.7;
const DECK_Z = 6;                               // the forward track runs on a raised deck
const COUNTER = { x: -15, y: -50, w: 30, d: 12, r: 1.4 };
const COUNTER_H = 10;
const BOARD = { x: -16, y: -66, w: 32, d: 3, r: 0.5 };
const BOARD_H = 44;
const BOARD_FACE = BOARD.y + BOARD.d;
export const HOOKS = Array.from({ length: 8 }, (_, n) => [-11.25 + (n % 4) * 7.5, n < 4 ? 34 : 22]); // [x, z] on the board face
const DESK = { x: -16, y: 27, w: 56, d: 20, r: 1.6 };
const DESK_H = 7;
export const DESK_PORT = [12, DESK.y];           // couriers leave the desk here
export const ROWS = 4;
const CHECK = { x0: DESK.x + 5, x1: DESK.x + DESK.w - 5, y0: DESK.y + 3, y1: DESK.y + DESK.d - 3 };
const SCORE = { x: -144, y: 22, w: 70, d: 3, r: 0.5 };
const SCORE_Z = [4, 50];
export const SCORE_ROWS = ["done", "undone", "stuck", "wrongMail", "turned"];
const SCORE_LABELS = { done: "BOOKED", undone: "UNDONE", stuck: "STUCK", wrongMail: "WRONG EMAIL", turned: "TURNED AWAY" };
export const LABELS = { F: "FLIGHT", H: "HOTEL", C: "CAR", P: "PAY", M: "EMAIL" };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [BOARD.x + SX[0], BOARD.y, BOARD_H + 2], [BOARD.x + BOARD.w + SX[4], BOARD.y, BOARD_H + 2], [SCORE.x + SCORE.w, SCORE.y, SCORE_Z[1] + 2]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 56 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const faceY = (x0, x1, y, z0, z1) => k.faceRectY(P, x0, x1, y, z0, z1);
const text = (x, y, z, value, { size = 3, tone = "mid", anchor = "start", attr = "" } = {}) =>
  `<text class="iso-face-text" ${attr} data-tone="${tone}" transform="${k.sideMatrix([x, y], z, P, "left")}" font-size="${size}" text-anchor="${anchor}">${value}</text>`;

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -130, y: 44, w: 84, d: 6, r: 1 });
}

// Courier wires from the orchestrator desk to the front of every counter slot (drawn on the floor, under the tracks).
function wires() {
  const d = SX.map((x) => k.lineOnTop(DESK_PORT, [x, COUNTER.y + COUNTER.d], 0.05, P)).join("");
  return `<g data-wires>${L(d, { tone: "lo", dashed: true })}${D(SX.map((x) => at([x, COUNTER.y + COUNTER.d, 0.05])), { size: 0.6, tone: "mid" })}</g>`;
}

function tracks() {
  const out = [];
  const rails = (y, x0, x1, z) => [y - 3.4, y + 2.6].map((yy) => S(k.slabOf({ x: x0 + 2, y: yy, w: x1 - x0 - 4, d: 0.8, r: 0.3 }, z, 0.9, P, 1), { tone: "hi", crease: "none" })).join("");
  const chevron = (x, y, dir, z) => k.onTop([[x - 2.4 * dir, y - 2.2], [x + 2.4 * dir, y], [x - 2.4 * dir, y + 2.2]], z, P);
  const between = [-115, -69, -23, 23, 69, 110];
  // The return track on the floor (drawn first: it is behind and below the deck's front edge).
  out.push(`<g data-return>${S(k.slabOf({ x: DOOR_X - 6, y: LANE_Y.r - 5, w: SX[4] + 12 - DOOR_X + 6, d: 10, r: 1 }, 0, BED_Z, P, 3), { tone: "lo", crease: "none" })}${rails(LANE_Y.r, DOOR_X - 6, SX[4] + 12, BED_Z)}</g>`);
  out.push(`<g data-return-rails>${L(between.slice(0, 5).map((x) => chevron(x, LANE_Y.r, -1, BED_Z)).join(""), { tone: "mid", free: true })}</g>`);
  // The forward track on its raised deck.
  out.push(S(k.slabOf({ x: DOOR_X - 6, y: LANE_Y.f - 5.5, w: EXIT_X + 8 - DOOR_X + 6, d: 11, r: 1 }, 0, DECK_Z, P, 3, 0.4), { tone: "mid" }));
  out.push(rails(LANE_Y.f, DOOR_X - 6, EXIT_X + 8, DECK_Z));
  out.push(L(between.map((x) => chevron(x, LANE_Y.f, 1, DECK_Z)).join(""), { tone: "mid", free: true }));
  // Closure planks laid across the return track when there is no saga (nothing ever rides back).
  const planks = [-100, -54, -8, 38, 84].map((x) => S(k.slabOf({ x: x - 2.5, y: LANE_Y.r - 5.5, w: 5, d: 11, r: 0.5 }, LANE_Z.r, 1.6, P, 2), { tone: "mid", crease: "lo" })).join("");
  out.push(`<g data-closed style="display:none">${planks}</g>`);
  // The stuck ledge: where a half-done trip is left.
  out.push(S(k.slabOf({ x: SX[0] - 14, y: LANE_Y.s - 4.5, w: SX[4] - SX[0] + 28, d: 9, r: 1 }, 0, 0.5, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(SX.map((x) => k.planOutline({ x: x - 7.5, y: LANE_Y.s - 3.6, w: 15, d: 7.2, r: 0.6 }, 0.5, P, 2)).join(""), { tone: "faint" }));
  return out.join("");
}

// A gate frame over the track ends: the door (left) and the departures gate (right).
function gate(x, y0, y1, part) {
  const post = (y) => S(k.slabOf({ x: x - 1.6, y: y - 1.6, w: 3.2, d: 3.2, r: 0.6 }, 0, 20, P, 2), { tone: "mid", crease: "none" });
  if (part === "back") return post(y0) + S(k.slabOf({ x: x - 2, y: y0 - 2, w: 4, d: y1 - y0 + 4, r: 0.8 }, 20, 3, P, 2), { tone: "hi", crease: "lo" });
  return post(y1);
}

// One counter: its tag board (or the postbox), the counter, a sign on its front, a prop on top.
function station(svc) {
  const out = [`<g data-station="${svc}">`];
  if (svc !== "M") {
    out.push(S(k.slabOf(BOARD, 0, BOARD_H, P, 2, 0.3), { tone: "hi", crease: "lo" }));
    out.push(L(faceY(BOARD.x + 1.6, BOARD.x + BOARD.w - 1.6, BOARD_FACE, 12, BOARD_H - 7), { tone: "faint" }));
    out.push(text(0, BOARD_FACE, BOARD_H - 5.2, LABELS[svc], { size: 3.8, tone: "hi", anchor: "middle" }));
    HOOKS.forEach(([hx, hz], n) => {
      out.push(`<g data-hook="${n}">`);
      out.push(D([at([hx, BOARD_FACE, hz])], { size: 0.55, tone: "mid" }));
      out.push(`<g data-tag="${svc}${n}" style="display:none">${tagSvg(hx, hz)}</g>`);
      out.push(`</g>`);
    });
  } else {
    // The postbox: once a letter is in, it can't be taken back out.
    out.push(S(k.cylinder(0, -57, 7.5, 0, 30, P, 30), { tone: "hi", crease: "none" }));
    out.push(S(sphereOf([0, -57, 30], 7.5, P), { tone: "hi", crease: "lo" }));
    out.push(S(k.slabOf({ x: -4, y: -50.4, w: 8, d: 1, r: 0.4 }, 23, 2, P, 2), { tone: "mid", crease: "none" }));
    out.push(S(k.slabOf({ x: -6, y: -50.2, w: 12, d: 1, r: 0.3 }, 12, 6, P, 2), { tone: "mid", crease: "none" }));
    out.push(text(0, -49.2, 13.6, LABELS[svc], { size: 3.4, tone: "hi", anchor: "middle" }));
    out.push(`<g data-letter style="display:none">${S(k.slabOf({ x: -3.2, y: -50.6, w: 6.4, d: 0.6, r: 0.2 }, 25, 5, P, 1), { tone: "hi", crease: "lo", lit: false })}</g>`);
  }
  out.push(S(k.slabOf(COUNTER, 0, COUNTER_H, P, 3, 0.5), { tone: "mid" }));
  const front = COUNTER.y + COUNTER.d;
  out.push(L(faceY(COUNTER.x + 3, COUNTER.x + COUNTER.w - 3, front, 2.2, 8), { tone: "faint" }));
  if (svc === "P") {
    out.push(S(k.slabOf({ x: -4, y: -47, w: 8, d: 6, r: 0.8 }, COUNTER_H, 2, P, 2), { tone: "hi", crease: "lo" }));
    out.push(L(k.planOutline({ x: -2.8, y: -46, w: 5.6, d: 2, r: 0.3 }, COUNTER_H + 2, P, 2), { tone: "lo" }));
    out.push(D([[-2, -42.6], [0, -42.6], [2, -42.6]].map(([x, y]) => at([x, y, COUNTER_H + 2])), { size: 0.45, tone: "lo" }));
  } else {
    // A stamp pad and a rubber stamp on every other counter.
    out.push(S(k.slabOf({ x: 4, y: -47, w: 7, d: 5, r: 0.6 }, COUNTER_H, 1, P, 2), { tone: "lo", crease: "none" }));
    out.push(S(k.cylinder(-6, -44, 1.8, COUNTER_H, 2.2, P, 16), { tone: "hi", crease: "lo" }));
    out.push(S(k.cylinder(-6, -44, 0.8, COUNTER_H + 2.2, 4, P, 12), { tone: "mid", crease: "none" }));
  }
  out.push(`</g>`);
  return out.join("");
}

export function tagSvg(hx, hz, y = BOARD_FACE) {
  const plan = { x: hx - 2.6, y, w: 5.2, d: 0.8, r: 0.3 };
  return L(k.segment([hx, y, hz], [hx, y + 0.4, hz - 1.2], P), { tone: "mid", free: true })
    + S(k.slabOf(plan, hz - 8.5, 7.3, P, 1, 0.2), { tone: "hi", crease: "lo" })
    + D([at([hx, y + 0.8, hz - 2.6])], { size: 0.4, tone: "lo" })
    + `<path class="xmark" data-x style="display:none" d="${k.segment([hx - 1.8, y + 0.8, hz - 3.6], [hx + 1.8, y + 0.8, hz - 7.6], P) + k.segment([hx + 1.8, y + 0.8, hz - 3.6], [hx - 1.8, y + 0.8, hz - 7.6], P)}"/>`;
}

// The orchestrator: a desk with a checklist board (one row per trip in progress, one cell per step) and its keeper.
function desk() {
  const out = [`<g data-desk>`];
  out.push(S(k.slabOf(DESK, 0, DESK_H, P, 3, 0.5), { tone: "mid" }));
  const board = { x: CHECK.x0 - 2, y: CHECK.y0 - 2, w: CHECK.x1 - CHECK.x0 + 4, d: CHECK.y1 - CHECK.y0 + 4, r: 0.8 };
  out.push(S(k.slabOf(board, DESK_H, 0.8, P, 2), { tone: "hi", crease: "lo" }));
  out.push(S(k.slabOf({ x: board.x + board.w / 2 - 5, y: board.y - 0.6, w: 10, d: 3, r: 0.6 }, DESK_H + 0.8, 1.2, P, 2), { tone: "mid", crease: "none" }));
  const top = DESK_H + 0.8, cw = (CHECK.x1 - CHECK.x0) / 5, ch = (CHECK.y1 - CHECK.y0) / ROWS;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < 5; c++) {
    const x0 = CHECK.x0 + c * cw + 0.9, x1 = x0 + cw - 1.8, y0 = CHECK.y0 + r * ch + 0.7, y1 = y0 + ch - 1.4;
    out.push(`<path class="cell" data-cell="${r}-${c}" d="${k.onTop([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], top, P, true)}"/>`);
  }
  out.push(`</g>`);
  // Dust sheet over the desk when nobody orchestrates.
  const sheet = { x: DESK.x - 1, y: DESK.y - 1, w: DESK.w + 2, d: DESK.d + 2, r: 2 };
  out.push(`<g data-sheet style="display:none">${S(k.slabOf(sheet, 0, DESK_H + 2.4, P, 4, 2.4), { tone: "lo", crease: "faint" })}</g>`);
  return out.join("");
}

function keeper() {
  const x = DESK.x + DESK.w + 9, y = DESK.y + 10;
  return `<g data-keeper>`
    + S(k.cylinder(x, y, 5, 0, 1.4, P, 24, 0.3), { tone: "mid" })
    + S(k.cylinder(x, y, 3.8, 1.4, 12, P, 22), { tone: "hi", crease: "none" })
    + S(k.cylinder(x, y, 4.4, 13.4, 1.2, P, 22, 0.3), { tone: "mid" })
    + S(sphereOf([x, y, 18.4], 3.6, P), { tone: "hi", crease: "lo" })
    + `</g>`;
}

// The scoreboard: five rows, a label and a three-wheel counter each.
function scoreboard() {
  const out = [];
  out.push(S(k.slabOf({ x: SCORE.x - 2, y: SCORE.y - 3, w: SCORE.w + 4, d: 9, r: 1.4 }, 0, SCORE_Z[0], P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf(SCORE, SCORE_Z[0], SCORE_Z[1] - SCORE_Z[0], P, 2, 0.3), { tone: "hi", crease: "lo" }));
  const face = SCORE.y + SCORE.d, rowH = (SCORE_Z[1] - SCORE_Z[0] - 4) / SCORE_ROWS.length;
  SCORE_ROWS.forEach((name, i) => {
    const z = SCORE_Z[1] - 2 - (i + 1) * rowH + 1.4;
    out.push(text(SCORE.x + 3, face, z + 2.4, SCORE_LABELS[name], { size: 3, tone: "mid" }));
    const hx = SCORE.x + SCORE.w - 25, hw = 22;
    out.push(S(k.slabOf({ x: hx, y: face, w: hw, d: 1.6, r: 0.3 }, z, rowH - 1.8, P, 2, 0.2), { tone: "mid" }));
    const win = (hw - 1.6) / 3;
    for (let n = 0; n < 3; n++) {
      const x0 = hx + 0.8 + n * win + 0.4, x1 = x0 + win - 0.8;
      out.push(L(faceY(x0, x1, face + 1.6, z + 0.8, z + rowH - 2.6), { tone: "lo" }));
      out.push(text((x0 + x1) / 2, face + 1.6, z + 1.7, "0", { size: 4, tone: "hi", anchor: "middle", attr: `data-digit="${name}${n}"` }));
    }
  });
  return out.join("");
}

export function folderSvg() {
  const plan = { x: -7, y: -4.8, w: 14, d: 9.6, r: 0.8 };
  const top = 3;
  const stamps = Array.from({ length: 5 }, (_, i) => `<path class="stamp" data-stamp="${i}" d="${k.onTop([[-5.8 + i * 2.6, -0.4], [-3.8 + i * 2.6, -0.4], [-3.8 + i * 2.6, 2.8], [-5.8 + i * 2.6, 2.8]], top, P, true)}"/>`).join("");
  return S(k.slabOf(plan, 0, 3, P, 2, 0.3), { tone: "hi", crease: "lo" })
    + S(k.slabOf({ x: -7, y: -4.8, w: 5, d: 2.2, r: 0.4 }, top, 0.9, P, 1), { tone: "hi", crease: "lo" })
    + stamps;
}
export function puckSvg() {
  return S(k.cylinder(0, 0, 2.2, 0.2, 2.2, P, 16), { tone: "mid", crease: "lo" });
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A travel agency on a base plate. Five counters stand in a row: flight, hotel, car, payment and a postbox for the confirmation email. Each booking counter has a board of hooks where it hangs a tag for every booking it holds. A trip folder rides the forward track past the counters, collecting a stamp at each. If a step fails, the folder drops to the return track and rides back, and each counter it passes takes its tag down. Half-done trips are left on a ledge at the front. At the front, an orchestrator desk with a checklist sends couriers to the counters along dashed lines, and a scoreboard counts trips booked, undone, stuck, wrong emails and customers turned away.",
    body: [
      plate(),
      wires(),
      gate(DOOR_X, LANE_Y.f - 7, LANE_Y.r + 7, "back"),
      gate(EXIT_X, LANE_Y.f - 7, LANE_Y.f + 7, "back"),
      `<g data-stations>${["F", "H", "C", "P", "M"].map(station).join("")}</g>`,
      tracks(),
      `<g data-folders></g>`,
      gate(DOOR_X, LANE_Y.f - 7, LANE_Y.r + 7, "front"),
      gate(EXIT_X, LANE_Y.f - 7, LANE_Y.f + 7, "front"),
      desk(),
      keeper(),
      scoreboard(),
    ],
  });
}

export const GEOMETRY = { SX, DOOR_X, EXIT_X, LANE_Y, LANE_Z, DESK_PORT, COUNTER_FRONT: COUNTER.y + COUNTER.d, ROWS, SCORE_ROWS };

// The pneumatic dispatch office: a screw press (publisher) sends each message down one tube into a
// distribution hub (broker), which fires a copy down every subscribed tube at the same moment to up
// to five stamping stations (subscribers), each with its own tray (queue).
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";
import * as G from "../../workbench/vendor-anatomy/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../workbench/vendor-anatomy/kit/tube.mjs";
import { STATION_X } from "./sim.js";

export const WIDTH = 700;
export const HEIGHT = 430;

const PLATE = { x: -176, y: -82, w: 352, d: 164, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// Flat message card, built at the origin (centre of its bottom face).
const CARD = { w: 16, d: 10, h: 1.1 };
// Tray (inbox queue) in front of each station.
const TRAY = { y: 2, d: 16, w: 24, floor: 1.6, wall: 5.5, step: 1.25, max: 10 };
const TRAY_CARD_Y = TRAY.y + TRAY.d / 2;
// Station desk with a pad and a stamp.
const DESK = { y: -62, d: 42, w: 34, h: 14 };
const PAD = { y: -40, d: 12, w: 18 };
const PAD_Y = PAD.y + PAD.d / 2;
const POST_Y = -56;
// Press.
const PRESS = { x: -164, y: -56, w: 40, d: 46, r: 3 };
const BED_Z = 10;
const PLATEN_Z = 22;
const CROWN_Z = 34;
export const BED_CARD = [PRESS.x + PRESS.w / 2, PRESS.y + PRESS.d / 2, BED_Z];
// Hub (broker) and tubes.
const HUB = [-124, 37];
const HUB_R = 14;
const HUB_Z = [4, 26];
const TUBE_R = 2.8;
const TUBE_Z = 9;
const LANES = [25, 31, 37, 43, 49];
// Receiver on the right of each tray: the tube ends on its front face, a capsule pops out on top.
const RECV = { dx: 13, y: 4, w: 9, d: 14, h: 13 };
const RECV_FACE_Y = RECV.y + RECV.d;
// Sender box on the press front.
const SEND = { x: -136, y: -10, w: 12, d: 6, h: 15 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [PRESS.x, PRESS.y, 52], [PRESS.x + PRESS.w, PRESS.y + PRESS.d, 52], [STATION_X[4] + 20, POST_Y, 44]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

export function cardSvg({ lit = false } = {}) {
  return S(k.slabOf({ x: -CARD.w / 2, y: -CARD.d / 2, w: CARD.w, d: CARD.d, r: 0.6 }, 0, CARD.h, P, 2, 0.3), { tone: "hi", crease: "lo", lit })
    + L([[-5.5, -2.2, 8], [-5.5, 0, 11], [-5.5, 2.2, 6]].map(([x, y, len]) => k.lineOnTop([x, y], [x + len, y], CARD.h, P)).join(""), { tone: "faint", free: true });
}

function plate() {
  const out = [
    basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H }),
    rulerStrip(P, { x: -40, y: 62, w: 190, d: 7, r: 1 }),
    labelPlate(P, { x: -100, y: 55, w: 40, d: 16, r: 1.5 }, [[-94, 59.5, 22], [-94, 63, 30], [-94, 66.5, 16]]),
  ];
  // Mounting pads: where a station and its tray sit. Visible when a station is not installed.
  for (const cx of STATION_X) {
    out.push(L(k.planOutline({ x: cx - DESK.w / 2 - 2, y: DESK.y - 2, w: DESK.w + 4, d: TRAY.y + TRAY.d - DESK.y + 4, r: 2 }, 0, P, 3), { tone: "faint" }));
    out.push(D([[cx - DESK.w / 2, DESK.y], [cx + DESK.w / 2, DESK.y], [cx - DESK.w / 2, TRAY.y + TRAY.d], [cx + DESK.w / 2, TRAY.y + TRAY.d]].map(([x, y]) => at([x, y, 0])), { size: 0.4, tone: "lo" }));
  }
  return out.join("");
}

const COLUMNS = [[PRESS.x + 4, PRESS.y + 4], [PRESS.x + PRESS.w - 4, PRESS.y + 4], [PRESS.x + 4, PRESS.y + PRESS.d - 4], [PRESS.x + PRESS.w - 4, PRESS.y + PRESS.d - 4]];
function pressBack() {
  const out = [];
  out.push(S(k.slabOf(k.insetPlan(PRESS, -3), 0, 6, P, 4, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf(PRESS, 6, BED_Z - 6, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline({ x: BED_CARD[0] - 11, y: BED_CARD[1] - 8, w: 22, d: 16, r: 1 }, BED_Z, P, 2), { tone: "lo" }));
  for (const [x, y] of byDepth(COLUMNS.slice(0, 2))) out.push(S(k.cylinder(x, y, 2, BED_Z, CROWN_Z - BED_Z, P, 16), { tone: "mid", crease: "none" }));
  return out.join("");
}
function platen() {
  const plan = { x: PRESS.x + 1, y: PRESS.y + 1, w: PRESS.w - 2, d: PRESS.d - 2, r: 2 };
  return S(k.slabOf(plan, PLATEN_Z, 4, P, 3, 0.5), { tone: "mid" }) + L(COLUMNS.slice(0, 2).map(([x, y]) => k.ring(x, y, 3, PLATEN_Z + 4, P, 16)).join(""), { tone: "lo" });
}
function pressFront() {
  const out = [];
  for (const [x, y] of byDepth(COLUMNS.slice(2))) out.push(S(k.cylinder(x, y, 2, BED_Z, CROWN_Z - BED_Z, P, 16), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ ...PRESS, r: 3 }, CROWN_Z, 4, P, 4, 0.6), { tone: "mid" }));
  out.push(D(COLUMNS.map(([x, y]) => at([x, y, CROWN_Z + 4])), { size: 0.45 }));
  const [cx, cy] = [PRESS.x + PRESS.w / 2, PRESS.y + PRESS.d / 2];
  out.push(S(k.cylinder(cx, cy, 4.5, CROWN_Z + 4, 3, P, 24), { tone: "mid" }));
  out.push(S(k.cylinder(cx, cy, 2.2, CROWN_Z + 7, 8, P, 16), { tone: "mid", crease: "none" }));
  out.push(L([CROWN_Z + 9, CROWN_Z + 11.5].map((z) => k.sideArc(cx, cy, 2.2, z, P, 12)).join(""), { tone: "faint" }));
  out.push(S(k.cylinder(cx, cy, 11, CROWN_Z + 15, 2.4, P, 56, 0.4), { tone: "mid" }));
  out.push(L(k.knurl(cx, cy, 11, CROWN_Z + 15, CROWN_Z + 17.4, 60, P, 0.3), { tone: "lo" }));
  out.push(L(k.ring(cx, cy, 7.5, CROWN_Z + 17.4, P, 40), { tone: "faint" }));
  out.push(S(k.cylinder(cx + 8, cy, 1.6, CROWN_Z + 17.4, 4, P, 12), { tone: "mid" }));
  return out.join("");
}

function desk(cx) {
  const out = [];
  const plan = { x: cx - DESK.w / 2, y: DESK.y, w: DESK.w, d: DESK.d, r: 2 };
  out.push(S(k.slabOf(plan, 0, DESK.h, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(plan, 4, P, 4), { tone: "faint" }) }));
  out.push(S(k.slabOf({ x: cx - PAD.w / 2, y: PAD.y, w: PAD.w, d: PAD.d, r: 1 }, DESK.h, 1, P, 2), { tone: "lo", crease: "none" }));
  out.push(S(k.cylinder(cx, POST_Y, 2, DESK.h, 28, P, 16), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(cx, POST_Y, 2.8, DESK.h + 28, 1.6, P, 16), { tone: "mid" }));
  out.push(S(k.cylinder(cx, POST_Y, 3.6, DESK.h, 1.4, P, 20), { tone: "mid" }));
  out.push(D([at([plan.x + 3, plan.y + 3, DESK.h]), at([plan.x + plan.w - 3, plan.y + plan.d - 3, DESK.h])], { size: 0.4, tone: "lo" }));
  return out.join("");
}
// The stamp: collar on the post, arm and head. Live code lowers it to stamp (acknowledge) a card.
export const STAMP_Z = 30;
function stamp(cx) {
  return S(k.cylinder(cx, POST_Y, 3.4, STAMP_Z - 1, 5, P, 20), { tone: "mid" })
    + S(k.slabOf({ x: cx - 2.2, y: POST_Y - 2, w: 4.4, d: PAD_Y - POST_Y + 6, r: 1 }, STAMP_Z, 3, P, 2, 0.3), { tone: "mid" })
    + S(k.cylinder(cx, PAD_Y, 4.6, STAMP_Z - 5, 5, P, 28, 0.3), { tone: "hi", crease: "lo" })
    + L(k.sideArc(cx, PAD_Y, 4.6, STAMP_Z - 3.5, P, 20), { tone: "faint" });
}
function lamp(cx) {
  return `<g data-lamp>${S(k.cylinder(cx + 12, DESK.y + DESK.d - 5, 2.2, DESK.h, 2, P, 16), { tone: "hi", crease: "lo" })}</g>`;
}
function cover(cx) {
  return `<g data-cover style="display:none">${S(k.slabOf({ x: cx - 12, y: PAD.y - 3, w: 24, d: PAD.d + 6, r: 1.5 }, DESK.h, 4, P, 3, 0.4), { tone: "lo" })}${L(k.planOutline({ x: cx - 9, y: PAD.y, w: 18, d: PAD.d, r: 1 }, DESK.h + 4, P, 2), { tone: "faint" })}</g>`;
}

function tray(cx, q) {
  const x0 = cx - TRAY.w / 2;
  const back = S(k.slabOf({ x: x0, y: TRAY.y, w: TRAY.w, d: TRAY.d, r: 1.5 }, 0, TRAY.floor, P, 3, 0.3), { tone: "mid" })
    + S(k.slabOf({ x: x0, y: TRAY.y, w: TRAY.w, d: 2, r: 0.6 }, TRAY.floor, TRAY.wall, P, 2), { tone: "mid", crease: "none" })
    + S(k.slabOf({ x: x0, y: TRAY.y, w: 2, d: TRAY.d, r: 0.6 }, TRAY.floor, TRAY.wall, P, 2), { tone: "mid", crease: "none" });
  const cards = Array.from({ length: TRAY.max }, (_, n) => `<g data-card="${n}" style="display:none" transform="${k.translateAlong(P, [cx, TRAY_CARD_Y, TRAY.floor + n * TRAY.step])}">${cardSvg()}</g>`).join("");
  const front = S(k.slabOf({ x: x0 + TRAY.w - 2, y: TRAY.y, w: 2, d: TRAY.d, r: 0.6 }, TRAY.floor, TRAY.wall, P, 2), { tone: "mid", crease: "none" })
    + S(k.slabOf({ x: x0, y: TRAY.y + TRAY.d - 2, w: TRAY.w, d: 2, r: 0.6 }, TRAY.floor, 2.4, P, 2, 0.3), { tone: "mid" });
  return `<g data-tray="${q}">${back}<g data-stack>${cards}</g>${front}</g>`;
}


// Tube routes in world space (filleted polylines). Index 0..4: hub to each station. "pub": press to hub.
const hubPort = (y) => [HUB[0] + Math.sqrt(HUB_R * HUB_R - (y - HUB[1]) ** 2), y, TUBE_Z];
const route = (pts, r = 5) => G.fillet(pts, r, 7);
export const ROUTES = STATION_X.map((cx, i) => {
  const port = hubPort(LANES[i]);
  const turn = cx + RECV.dx + RECV.w / 2;
  return route([port, [turn, LANES[i], TUBE_Z], [turn, RECV_FACE_Y, TUBE_Z]], Math.min(5, (LANES[i] - RECV_FACE_Y) * 0.45));
});
const SEND_PORT = [SEND.x + SEND.w / 2, SEND.y + SEND.d, TUBE_Z];
export const PUB_ROUTE = [SEND_PORT, [SEND_PORT[0], HUB[1] - Math.sqrt(HUB_R * HUB_R - (SEND_PORT[0] - HUB[0]) ** 2) + 0.6, TUBE_Z]];
export const RECV_TOP = STATION_X.map((cx) => [cx + RECV.dx + RECV.w / 2, RECV.y + RECV.d / 2, RECV.h]);
export const HUB_TOP = [HUB[0], HUB[1], HUB_Z[1] + 4];

const flange = (at, axis, r = TUBE_R + 1.4, t = 1.4) => {
  const F = G.frameAlong(at, axis);
  return S(G.disc(-t, 0, r, F, P), { tone: "mid" });
};
function tubeRun(points, tone = "hi") {
  return tubePieces(points, TUBE_R, P, { maxLength: 400, caps: [false, false] }).map((piece) => tubeSvg(piece, { tone })).join("");
}

function sender() {
  const plan = { x: SEND.x, y: SEND.y, w: SEND.w, d: SEND.d, r: 1 };
  return S(k.slabOf(plan, 0, SEND.h, P, 2, 0.4), { tone: "mid" })
    + D([at([SEND.x + 2.5, SEND.y + SEND.d, SEND.h - 2.5]), at([SEND.x + SEND.w - 2.5, SEND.y + SEND.d, SEND.h - 2.5])], { size: 0.4, tone: "lo" })
    + flange([SEND_PORT[0], SEND_PORT[1] + 1.4, TUBE_Z], [0, -1, 0]);
}

function hub() {
  const [x, y] = HUB;
  const out = [];
  out.push(S(k.cylinder(x, y, HUB_R + 3, 0, HUB_Z[0], P, 56, 0.5), { tone: "mid" }));
  out.push(D([0, 1, 2, 3].map((n) => { const a = Math.PI / 4 + n * Math.PI / 2; return at([x + Math.cos(a) * (HUB_R + 1.6), y + Math.sin(a) * (HUB_R + 1.6), HUB_Z[0]]); }), { size: 0.45 }));
  out.push(S(k.cylinder(x, y, HUB_R, HUB_Z[0], HUB_Z[1] - HUB_Z[0], P, 64, 0.8), { tone: "hi", crease: "lo", inner: L(k.sideArc(x, y, HUB_R, TUBE_Z + 5, P, 48) + k.sideArc(x, y, HUB_R, TUBE_Z - 4.4, P, 48), { tone: "faint" }) }));
  out.push(L(k.ring(x, y, HUB_R - 2.4, HUB_Z[1], P, 56), { tone: "lo" }));
  out.push(L(k.radialTicks(x, y, HUB_R - 3, 5, 1, HUB_Z[1], [1.6, 1.6], P, Math.PI * 0.2, Math.PI * 0.8).minor, { tone: "lo" }));
  // Hopper on top, where the press's capsule comes in.
  out.push(S(k.cylinder(x, y, 5.5, HUB_Z[1], 3, P, 32, 0.3), { tone: "mid" }));
  out.push(L(k.ring(x, y, 3.4, HUB_Z[1] + 3, P, 28), { tone: "lo" }));
  return out.join("");
}
// The rotor ring on top turns while copies are fired.
export const HUB_GEOM = { x: HUB[0], y: HUB[1], r: HUB_R - 4.6, z: HUB_Z[1] };

function receiver(cx) {
  const plan = { x: cx + RECV.dx, y: RECV.y, w: RECV.w, d: RECV.d, r: 1.2 };
  const top = [cx + RECV.dx + RECV.w / 2, RECV.y + RECV.d / 2];
  return S(k.slabOf(plan, 0, RECV.h, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, 4, P, 3), { tone: "faint" }) })
    + L(k.ring(top[0], top[1], 2.6, RECV.h, P, 20), { tone: "lo" })
    + flange([top[0], RECV_FACE_Y + 1.4, TUBE_Z], [0, -1, 0]);
}

// A capsule: a small ball, drawn over the clear tube while it travels.
export const capsuleSvg = () => S(G.sphereOf([0, 0, 0], TUBE_R - 0.2, P, { steps: 32 }), { tone: "hi", crease: "none", lit: true });

// Discard bin: stands where the tray was while a non-durable subscriber is away.
function bin(cx) {
  const [x, y] = [cx, TRAY.y + TRAY.d / 2];
  return `<g data-bin style="display:none">${S(k.cylinder(x, y, 8, 0, 9, P, 40, 0.4), { tone: "lo" })}${L(k.ring(x, y, 6.6, 9, P, 36), { tone: "mid" })}</g>`;
}
export function buildFigure() {
  const desks = STATION_X.map((cx, i) => ({ cx, i })).sort((a, b) => k.depthOf([a.cx, -40, 0], P) - k.depthOf([b.cx, -40, 0], P));
  const hubFlanges = STATION_X.map((_, i) => {
    const port = hubPort(LANES[i]);
    return `<g data-port="${i}">${flange([port[0] - 1.2, port[1], TUBE_Z], [1, 0, 0])}<g data-cap style="display:none">${S(G.disc(0, 1.2, TUBE_R + 0.6, G.frameAlong(port, [1, 0, 0]), P), { tone: "lo" })}</g></g>`;
  }).join("");
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A pneumatic dispatch office on a base plate. A screw press at the back prints one message at a time and sends it down a single tube into a round distribution hub. The hub fires one copy down every connected tube at the same moment, to up to five stamping stations. Each copy lands in its station's own tray, and each station takes cards from its tray at its own pace and stamps them to acknowledge them; cards it has not reached yet pile up in its tray. While a station without a durable subscription is away, its tray is gone and its copies fall into a discard bin.",
    body: [
      plate(),
      pressBack(),
      `<g data-anchor="bed"></g>`,
      `<g data-platen>${platen()}</g>`,
      pressFront(),
      sender(),
      desks.map(({ cx, i }) => `<g data-station="${i}">${desk(cx)}</g>`).join(""),
      STATION_X.map((cx, q) => tray(cx, q) + bin(cx)).join(""),
      desks.map(({ cx, i }) => `<g data-top="${i}"><g data-work style="opacity:0">${cardSvg()}</g><g data-stamp>${stamp(cx)}</g>${lamp(cx)}${cover(cx)}</g>`).join(""),
      STATION_X.map((cx, q) => `<g data-recv="${q}">${receiver(cx)}</g>`).join(""),
      STATION_X.map((_, q) => `<g data-drop="${q}" style="opacity:0">${cardSvg()}</g>`).join(""),
      tubeRun(PUB_ROUTE),
      `<g data-pubcap style="opacity:0">${capsuleSvg()}</g>`,
      hub(),
      `<g data-rotor></g>`,
      hubFlanges,
      STATION_X.map((_, i) => `<g data-tube="${i}">${tubeRun(ROUTES[i])}${[0, 1].map((n) => `<g data-cap${n} style="opacity:0">${capsuleSvg()}</g>`).join("")}</g>`).join(""),
      `<g data-anchor="top"><g data-pubcard style="opacity:0">${cardSvg({ lit: true })}</g></g>`,
    ],
  });
}

export const GEOMETRY = { TRAY_CARD_Y, TRAY_FLOOR: TRAY.floor, TRAY_STEP: TRAY.step, TRAY_MAX: TRAY.max, PAD_Y, PAD_Z: DESK.h + 1, BED_CARD, STAMP_DROP: 8, PLATEN_DROP: 10, ROUTES, PUB_ROUTE, RECV_TOP, HUB_TOP, HUB: HUB_GEOM, SEND_TOP: [SEND_PORT[0], SEND.y + SEND.d / 2, SEND.h] };

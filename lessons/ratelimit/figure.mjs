// A token-bucket ticket dispenser: client lanes run under a gate whose coin tubes hold the tokens.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -152, y: -102, w: 304, d: 198, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

export const LANE_X0 = -112;      // ticket leaves the client here
export const GATE_X = -6;         // decision point (flap)
export const TRAY_X = 106;        // served tray centre
const GROUPS = [[-76, -56, -36], [4, 24, 44]];
export const LANES = GROUPS.flatMap((ys, instance) => ys.map((y, client) => ({ y, instance, client })));
const GATE = { x: -18, w: 24 };
export const DISC = { r: 5.4, h: 2.3 };
export const TUBE_BASE = 30;      // z of the lowest disc's bottom
export const GLOBAL_MAX = 16;
export const CLIENT_MAX = 6;
export const TICKET = { w: 9, d: 7, h: 3, z: 2 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [GATE.x, -90, TUBE_BASE + GLOBAL_MAX * DISC.h + 18], [GATE.x + GATE.w, 60, 30]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -132, y: 70, w: 160, d: 7, r: 1 })
    + labelPlate(P, { x: 72, y: 66, w: 50, d: 18, r: 1.5 }, [[78, 71, 30], [78, 75, 38], [78, 79, 22]]);
}

function lane(y) {
  const out = [];
  const bed = { x: LANE_X0 - 4, y: y - 6, w: TRAY_X - 14 - LANE_X0 + 4, d: 12, r: 1.2 };
  out.push(S(k.slabOf(bed, 0, 2, P, 3, 0.3), { tone: "mid", crease: "none" }));
  for (const yy of [y - 6, y + 4.6]) out.push(S(k.slabOf({ x: bed.x, y: yy, w: bed.w, d: 1.4, r: 0.4 }, 2, 2.4, P, 2), { tone: "mid", crease: "none" }));
  out.push(L(k.lineOnTop([bed.x + 1, y], [bed.x + bed.w - 1, y], 2, P), { tone: "faint" }));
  return out.join("");
}

// The client's sender: a block with a slot the tickets come out of and go back into.
function sender(y) {
  const plan = { x: LANE_X0 - 22, y: y - 6.5, w: 16, d: 13, r: 1.5 };
  const out = [S(k.slabOf(plan, 0, 12, P, 3, 0.5), { tone: "mid" })];
  const xf = plan.x + plan.w;
  out.push(L(`M${at([xf, y - 4.5, 2.4]).join(" ")}L${at([xf, y + 4.5, 2.4]).join(" ")}L${at([xf, y + 4.5, 6.6]).join(" ")}L${at([xf, y - 4.5, 6.6]).join(" ")}Z`, { tone: "lo" }));
  out.push(S(k.cylinder(plan.x + 8, y, 2.4, 12, 1.2, P, 18), { tone: "mid" }));
  out.push(D([at([plan.x + 3, plan.y + 3, 12]), at([plan.x + 13, plan.y + 3, 12])], { size: 0.4, tone: "lo" }));
  return out.join("");
}

function tray(ys) {
  const y0 = ys[0] - 9, y1 = ys[ys.length - 1] + 9;
  const plan = { x: TRAY_X - 14, y: y0, w: 28, d: y1 - y0, r: 2 };
  const out = [S(k.slabOf(plan, 0, 2, P, 3, 0.4), { tone: "mid" })];
  out.push(S(k.slabOf({ x: plan.x + plan.w - 2.4, y: y0, w: 2.4, d: y1 - y0, r: 0.6 }, 2, 5, P, 2), { tone: "mid", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(plan, 2.4), 2, P, 3), { tone: "faint" }));
  return out.join("");
}

function tubeAngles() {
  return [45, 135, 225, 315].map((deg) => (deg * Math.PI) / 180);
}

// A coin tube on the gate beam: posts round a stack of discs, a cap, and a dropper above it.
function tube(cx, cy, max, attrs) {
  const top = TUBE_BASE + max * DISC.h + 1.2;
  const postR = DISC.r + 1.4;
  const posts = tubeAngles().map((a) => [cx + Math.cos(a) * postR, cy + Math.sin(a) * postR]);
  const sorted = byDepth(posts);
  const post = ([x, y]) => S(k.cylinder(x, y, 0.75, TUBE_BASE - 2, top - TUBE_BASE + 2, P, 10), { tone: "mid", crease: "none" });
  const discs = Array.from({ length: max }, (_, i) => `<g data-disc="${i}">${S(k.cylinder(cx, cy, DISC.r, TUBE_BASE + i * DISC.h, DISC.h - 0.25, P, 28, 0.3), { tone: "hi", crease: "lo" })}</g>`).join("");
  const out = [`<g ${attrs}>`];
  out.push(S(k.cylinder(cx, cy, postR + 1.6, TUBE_BASE - 3, 3, P, 32, 0.4), { tone: "mid" }));
  out.push(sorted.slice(0, 2).map(post).join(""));
  out.push(`<g data-stack>${discs}</g>`);
  out.push(`<g data-drop style="opacity:0">${S(k.cylinder(cx, cy, DISC.r, 0, DISC.h - 0.25, P, 28, 0.3), { tone: "hi", crease: "lo", lit: true })}</g>`);
  out.push(sorted.slice(2).map(post).join(""));
  out.push(S(k.cylinder(cx, cy, postR + 1.2, top, 1.8, P, 32, 0.3), { tone: "mid" }));
  out.push(L(k.ring(cx, cy, DISC.r + 0.2, top + 1.8, P, 28), { tone: "lo" }));
  // Dropper on a bracket over the tube mouth.
  const back = sorted[0];
  out.push(S(k.cylinder(back[0], back[1], 0.75, top + 1.8, 7, P, 10), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: Math.min(back[0], cx) - 1, y: Math.min(back[1], cy) - 1, w: Math.abs(back[0] - cx) + 2, d: Math.abs(back[1] - cy) + 2, r: 0.8 }, top + 8.8, 1.4, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(cx, cy, 2.2, top + 5, 3.8, P, 16, 0.3), { tone: "mid" }));
  out.push(`</g>`);
  return out.join("");
}
export const tubeTop = (max) => TUBE_BASE + max * DISC.h + 1.2;

function gate(instance) {
  const ys = GROUPS[instance];
  const back = ys[0] - 14, front = ys[2] + 16;
  const out = [];
  const pillar = (y) => S(k.slabOf({ x: GATE.x, y, w: GATE.w, d: 6, r: 1.2 }, 0, 22, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam({ x: GATE.x, y, w: GATE.w, d: 6, r: 1.2 }, 6, P, 3), { tone: "faint" }) });
  out.push(pillar(back));
  // Flaps hang from the beam over each lane; the live code lifts the one a ticket passes.
  const flaps = ys.map((y, client) => `<g data-flap="${instance * 3 + client}">${S(k.slabOf({ x: GATE_X - 1, y: y - 5, w: 2, d: 10, r: 0.4 }, 7, 15, P, 2), { tone: "hi", crease: "lo" })}</g>`);
  out.push(flaps.join(""));
  out.push(pillar(front - 6));
  const beam = { x: GATE.x - 2, y: back - 2, w: GATE.w + 4, d: front - back + 4, r: 2 };
  out.push(S(k.slabOf(beam, 22, 8, P, 4, 0.6), { tone: "mid" }));
  out.push(D([[beam.x + 3, beam.y + 3], [beam.x + beam.w - 3, beam.y + 3], [beam.x + 3, beam.y + beam.d - 3], [beam.x + beam.w - 3, beam.y + beam.d - 3]].map(([x, y]) => at([x, y, 30])), { size: 0.45 }));
  // Window dial at the front end of the beam.
  const dial = [GATE.x + GATE.w / 2, front - 1];
  out.push(S(k.cylinder(dial[0], dial[1], 4.2, 30, 2.4, P, 32, 0.3), { tone: "hi", crease: "lo" }));
  const t = k.radialTicks(dial[0], dial[1], 3.5, 12, 3, 32.4, [0.6, 1.2], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(`<path data-dial="${instance}" class="iso-line" data-tone="hi" data-free="end" d=""/>`);
  // Tubes: one shared tube, or one per lane.
  const cx = GATE.x + GATE.w / 2;
  out.push(tube(cx, ys[1], GLOBAL_MAX, `data-tube="${instance}-g"`));
  for (const [client, y] of ys.entries()) out.push(tube(cx, y, CLIENT_MAX, `data-tube="${instance}-${client}"`));
  return out.join("");
}
export const DIALS = GROUPS.map((ys) => [GATE.x + GATE.w / 2, ys[2] + 15]);

export function ticketSvg() {
  return S(k.slabOf({ x: -TICKET.w / 2, y: -TICKET.d / 2, w: TICKET.w, d: TICKET.d, r: 0.6 }, 0, TICKET.h, P, 2, 0.3), { tone: "hi", crease: "lo" });
}

function group(instance) {
  const ys = GROUPS[instance];
  return `<g data-group="${instance}">`
    + ys.map((y) => lane(y)).join("")
    + ys.map((y) => sender(y)).join("")
    + `<g data-up="${instance}"></g>`
    + gate(instance)
    + tray(ys)
    + `<g data-down="${instance}"></g>`
    + `</g>`;
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A ticket dispenser on a base plate. Three client senders on the left push tickets along lanes under a gate. On the gate stand coin tubes holding tokens, refilled one at a time by a dropper. A ticket that finds a token lifts the flap and rides on to the served tray; a ticket that finds the tube empty is sent back to its client. A second, identical gate at the front stands for a second app instance with its own tubes.",
    body: [plate(), group(0), group(1)],
  });
}

export const GEOMETRY = { LANES, LANE_X0, GATE_X, TRAY_X, TICKET, DISC, TUBE_BASE, GLOBAL_MAX, CLIENT_MAX, DIALS, SENDER_X: LANE_X0 - 6 };

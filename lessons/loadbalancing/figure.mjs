// A parcel sorting station: an infeed conveyor, a turntable dispatcher (the load balancer) and up to
// five counters (servers), each with its own queue lane. Built with the Anatomy kit (MIT).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";

export const WIDTH = 700;
export const HEIGHT = 440;

const PLATE = { x: -175, y: -92, w: 350, d: 184, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

export const LANES = [-64, -32, 0, 32, 64];
export const LANE = { from: -18, to: 92, half: 10, z: 3 };
export const SERVE_X = 84;
export const SLOT = 12;
export const PARCEL = { w: 10, h: 8 };
export const TABLE = [-50, 0];
const TABLE_R = 22;
export const TABLE_Z = 8;
export const INFEED = { from: -165, to: -76, z: 8 };
const COUNTER = { x: 96, w: 32, half: 12, h: 18 };
export const HEAD = { x: SERVE_X, r: 4.5, up: 22, travel: 10.5, len: 6 };
const ARM_Z = 34;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [COUNTER.x + COUNTER.w, -76, ARM_Z + 4], [COUNTER.x + COUNTER.w, 76, ARM_Z + 4], [-60, -80, 30]],
  WIDTH,
  HEIGHT,
  { pad: 24, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);

function plate() {
  const out = [
    basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H }),
    rulerStrip(P, { x: -160, y: 76, w: 120, d: 7, r: 1 }),
    labelPlate(P, { x: -160, y: -76, w: 46, d: 20, r: 1.5 }, [[-154, -70, 26], [-154, -65.5, 34], [-154, -61, 18]]),
  ];
  return out.join("");
}

function infeed() {
  const out = [];
  const frame = { x: INFEED.from, y: -11, w: INFEED.to - INFEED.from, d: 22, r: 1.5 };
  out.push(S(k.slabOf(frame, 0, INFEED.z, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(frame, 3, P, 3), { tone: "faint" }) }));
  for (const y of [-11, 9]) out.push(S(k.slabOf({ x: INFEED.from, y, w: INFEED.to - INFEED.from, d: 2, r: 0.5 }, INFEED.z, 3, P, 2, 0.3), { tone: "mid" }));
  const rollers = [];
  for (let x = INFEED.from + 4; x < INFEED.to - 2; x += 5) rollers.push(k.lineOnTop([x, -9], [x, 9], INFEED.z, P));
  out.push(L(rollers.join(""), { tone: "lo" }));
  out.push(D([INFEED.from + 3, INFEED.to - 3].flatMap((x) => [at([x, -10, INFEED.z + 3]), at([x, 10, INFEED.z + 3])]), { size: 0.4 }));
  return out.join("");
}

function apron() {
  const ring = [[-34, -18], [LANE.from, LANES[0] - 12], [LANE.from, LANES[4] + 12], [-34, 18]];
  return S(k.extrude(ring, 0, LANE.z, P, { bevel: 0.4 }), { tone: "mid" });
}

function turntable() {
  const [x, y] = TABLE;
  const out = [];
  out.push(S(k.cylinder(x, y, TABLE_R + 4, 0, 5, P, 64, 0.6), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, TABLE_R, 5, TABLE_Z - 5, P, 64, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(x, y, TABLE_R - 3, TABLE_Z, P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, TABLE_R + 3.6, 40, 5, 5, [1, 2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  return out.join("");
}

// The diverter arm, rebuilt whenever it turns. Angle 0 points along +x.
export function armSvg(angle) {
  const [x, y] = TABLE;
  const c = Math.cos(angle), s = Math.sin(angle);
  const pt = (u, v) => [x + u * c - v * s, y + u * s + v * c];
  const ring = [pt(-6, -1.6), pt(TABLE_R - 1, -1.6), pt(TABLE_R - 1, 1.6), pt(-6, 1.6)];
  return S(k.extrude(ring, TABLE_Z, 4, P, { bevel: 0.3 }), { tone: "hi", lit: true });
}

function laneBed(ly) {
  const out = [];
  const bed = { x: LANE.from, y: ly - LANE.half, w: LANE.to - LANE.from, d: LANE.half * 2, r: 1 };
  out.push(S(k.slabOf(bed, 0, LANE.z, P, 2, 0.3), { tone: "mid" }));
  const rollers = [];
  for (let x = LANE.from + 4; x < LANE.to - 2; x += 5) rollers.push(k.lineOnTop([x, ly - LANE.half + 1.5], [x, ly + LANE.half - 1.5], LANE.z, P));
  out.push(L(rollers.join(""), { tone: "lo" }));
  for (const y of [ly - LANE.half, ly + LANE.half - 1.5]) out.push(S(k.slabOf({ x: LANE.from, y, w: LANE.to - LANE.from, d: 1.5, r: 0.4 }, LANE.z, 2.5, P, 2), { tone: "mid", crease: "none" }));
  return out.join("");
}

function gate(ly, index) {
  const px = LANE.from + 3, py = ly - LANE.half - 2.4;
  const post = S(k.cylinder(px, py, 1.6, 0, 10, P, 16), { tone: "mid" });
  const closed = S(k.slabOf({ x: px - 1, y: py, w: 2, d: LANE.half * 2 + 3.5, r: 0.5 }, 8, 2, P, 2), { tone: "hi", crease: "none" });
  const open = S(k.slabOf({ x: px - 1, y: py - 1, w: 2, d: 2, r: 0.5 }, 10, 18, P, 2), { tone: "hi", crease: "none" });
  return post + `<g data-gate-open="${index}">${open}</g><g data-gate-closed="${index}" style="display:none">${closed}</g>`;
}

function cover(ly, index) {
  return `<g data-cover="${index}" style="display:none">${S(k.slabOf({ x: LANE.from + 6, y: ly - LANE.half - 1, w: LANE.to - LANE.from - 8, d: LANE.half * 2 + 2, r: 1 }, 6, 1.6, P, 2, 0.4), { tone: "lo" })}</g>`;
}

function shutter(ly, index) {
  return `<g data-shutter="${index}" style="display:none">${S(k.slabOf({ x: COUNTER.x - 4, y: ly - LANE.half - 0.5, w: 2.5, d: LANE.half * 2 + 1, r: 0.4 }, LANE.z, 17, P, 2, 0.3), { tone: "lo", inner: L(k.sideSeam({ x: COUNTER.x - 4, y: ly - LANE.half - 0.5, w: 2.5, d: LANE.half * 2 + 1, r: 0.4 }, 11, P, 2), { tone: "faint" }) })}</g>`;
}

function counter(ly, index) {
  const out = [];
  const body = { x: COUNTER.x, y: ly - COUNTER.half, w: COUNTER.w, d: COUNTER.half * 2, r: 2 };
  out.push(S(k.slabOf(body, 0, COUNTER.h, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(body, 6, P, 3), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(body, 3), COUNTER.h, P, 2), { tone: "faint" }));
  // Health lamp: on while the counter is up.
  const lamp = [COUNTER.x + 24, ly + 6];
  out.push(S(k.cylinder(lamp[0], lamp[1], 3.2, COUNTER.h, 1.4, P, 20), { tone: "mid" }));
  out.push(`<g data-lamp-on="${index}">${S(k.cylinder(lamp[0], lamp[1], 2.2, COUNTER.h + 1.4, 2.4, P, 20), { tone: "hi", crease: "lo" })}</g>`);
  out.push(`<g data-lamp-off="${index}" style="display:none">${S(k.cylinder(lamp[0], lamp[1], 2.2, COUNTER.h + 1.4, 0.8, P, 20), { tone: "lo", crease: "none" })}</g>`);
  out.push(D([at([COUNTER.x + 4, ly - 8, COUNTER.h]), at([COUNTER.x + 28, ly - 8, COUNTER.h])], { size: 0.4 }));
  return out.join("");
}

// The press head at its raised position; live code lowers it with translateAlong.
export function headSvg(ly) {
  const rod = S(k.cylinder(HEAD.x, ly, 1.3, HEAD.up + HEAD.len, ARM_Z - HEAD.up - HEAD.len + 6, P, 14), { tone: "mid", crease: "none" });
  const head = S(k.cylinder(HEAD.x, ly, HEAD.r, HEAD.up, HEAD.len, P, 28, 0.4), { tone: "hi", crease: "lo" });
  return rod + head + L(k.sideArc(HEAD.x, ly, HEAD.r, HEAD.up + 2, P, 20), { tone: "faint" });
}

function press(ly) {
  const out = [];
  out.push(S(k.cylinder(COUNTER.x + 8, ly, 3, COUNTER.h, ARM_Z - COUNTER.h, P, 20), { tone: "mid", crease: "none" }));
  out.push(L(k.sideArc(COUNTER.x + 8, ly, 3, 26, P, 12), { tone: "faint" }));
  const arm = { x: HEAD.x - 6, y: ly - 3.5, w: COUNTER.x + 14 - (HEAD.x - 6), d: 7, r: 2 };
  out.push(S(k.slabOf(arm, ARM_Z, 4, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([HEAD.x, ly, ARM_Z + 4]), at([COUNTER.x + 8, ly, ARM_Z + 4])], { size: 0.45 }));
  return out.join("");
}

function laneGroup(index) {
  const ly = LANES[index];
  return `<g data-lane="${index}">`
    + laneBed(ly)
    + gate(ly, index)
    + `<g data-parcels="${index}"></g>`
    + cover(ly, index)
    + shutter(ly, index)
    + counter(ly, index)
    + `<g data-head="${index}">${headSvg(ly)}</g>`
    + press(ly)
    + `</g>`;
}

export function parcelSvg() {
  const h = PARCEL.w / 2;
  return S(k.slabOf({ x: -h, y: -h, w: PARCEL.w, d: PARCEL.w, r: 0.6 }, 0, PARCEL.h, P, 2, 0.3), { tone: "hi", crease: "lo" })
    + L(k.lineOnTop([-h, 0], [h, 0], PARCEL.h, P), { tone: "faint" });
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A parcel sorting station on a base plate. Parcels ride an infeed conveyor onto a turntable whose arm turns to send each one down one of five lanes. Every lane ends at a counter with a press that works through its queue one parcel at a time. A gate at the start of each lane shows whether the turntable still sends parcels there, and a shutter closes a counter that has gone down.",
    body: [
      plate(),
      infeed(),
      `<g data-infeed></g>`,
      apron(),
      turntable(),
      `<g data-arm>${armSvg(0)}</g>`,
      `<g data-table-parcels></g>`,
      LANES.map((_, i) => laneGroup(i)).join(""),
    ],
  });
}

export const GEOMETRY = { LANES, LANE, SERVE_X, SLOT, TABLE, TABLE_Z, INFEED, HEAD, PARCEL };

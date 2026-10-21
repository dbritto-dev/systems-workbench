// The sorting carousel: a hash ring (turntable with a 0–360° scale and marker pegs), a modulo selector drum,
// an intake hopper and a row of six bins (nodes A–F). Built with the Anatomy kit (MIT).
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate } from "../../workbench/parts.mjs";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -175, y: -115, w: 350, d: 215, r: 9 };
const PLATE_H = 12;
const FOOT_H = 5;

export const RING = { cx: -65, cy: -35, plinth: 72, disc: 66, top: 12, track: 53, groove: [49, 57], peg: 60, scale: 64.5 };
export const HUB = { r: 13, top: 18 };
export const DRUM = { cx: 85, cy: -55, r: 18, z: 6, top: 18 };
export const HOPPER = { x: -4, y: -97, w: 28, d: 22, r: 2, h: 20 };
export const MOUTH = [HOPPER.x + HOPPER.w / 2, HOPPER.y + HOPPER.d / 2, HOPPER.h + 2];
export const LEVER = { x: 30, y: -26, w: 26, d: 8, ring: 35, modulo: 51 };
export const BINS = [-130, -78, -26, 26, 78, 130].map((cx) => ({ cx, y: 53, w: 32, d: 24 }));
export const TRAY_H = 5;
export const CARD = { w: 6, d: 4, h: 1.4 };
export const STACK_SCALE = 70;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [RING.cx, RING.cy - RING.plinth, HUB.top + 3], [130, 65, 48], [-130, 65, 48], [MOUTH[0], MOUTH[1], 40]],
  WIDTH,
  HEIGHT,
  { pad: 24, azimuth: 48 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const rad = (deg) => (deg * Math.PI) / 180;
export const onRing = (deg, r) => [RING.cx + r * Math.sin(rad(deg)), RING.cy - r * Math.cos(rad(deg))];

function plate() {
  const out = [
    basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H }),
    rulerStrip(P, { x: -160, y: 86, w: 200, d: 7, r: 1 }),
    labelPlate(P, { x: 118, y: -102, w: 44, d: 18, r: 1.5 }, [[124, -97, 22], [124, -92.5, 30], [124, -88, 16]]),
  ];
  // Bin pads: where each node's bin stands, even when the node is not in the cluster.
  out.push(L(BINS.map((b) => k.planOutline({ x: b.cx - b.w / 2 - 2, y: b.y - 2, w: b.w + 4, d: b.d + 4, r: 3 }, 0, P, 3)).join(""), { tone: "lo" }));
  return out.join("");
}

function ring() {
  const { cx, cy } = RING;
  const out = [];
  out.push(S(k.cylinder(cx, cy, RING.plinth, 0, 4, P, 96, 0.6), { tone: "mid" }));
  out.push(S(k.cylinder(cx, cy, RING.disc, 4, RING.top - 4, P, 96, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(cx, cy, RING.disc, RING.top - 3, RING.top, 120, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(cx, cy, RING.disc, RING.top - 3, P, 64), { tone: "faint" }));
  const ticks = k.radialTicks(cx, cy, RING.scale, 72, 6, RING.top, [1.4, 3], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(RING.groove.map((r) => k.ring(cx, cy, r, RING.top, P, 96)).join(""), { tone: "lo" }));
  out.push(L(k.ring(cx, cy, 22, RING.top, P, 48), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([cx, cy - 28], RING.top, P, "x"), "0°", { size: 3, tone: "lo", anchor: "middle" }));
  return out.join("");
}

function hub() {
  const { cx, cy } = RING;
  return S(k.cylinder(cx, cy, HUB.r, RING.top, HUB.top - RING.top, P, 48, 0.5), { tone: "mid" })
    + L(k.knurl(cx, cy, HUB.r, RING.top + 1, HUB.top, 48, P), { tone: "lo" })
    + S(k.cylinder(cx, cy, 6, HUB.top, 3, P, 32, 0.4), { tone: "mid" })
    + L(k.ring(cx, cy, 2, HUB.top + 3, P, 16), { tone: "lo" });
}

// Marker pegs for the current ring. Big pegs for 1 and 10 per node; at 100 per node, engraved ticks.
export function pegsSvg(points, litAngle = null) {
  const { cx, cy } = RING;
  if (!points.length) return "";
  if (points.length > 80) {
    const d = points.map((p) => k.lineOnTop(onRing(p.angle, RING.groove[1]), onRing(p.angle, RING.scale - 3.2), RING.top, P)).join("");
    let lit = "";
    if (litAngle !== null) lit = L(k.lineOnTop(onRing(litAngle, RING.groove[1]), onRing(litAngle, RING.scale - 3.2), RING.top, P), { tone: "lit" });
    return L(d, { tone: "mid" }) + lit;
  }
  const sorted = [...points].sort((a, b) => k.depthOf([...onRing(a.angle, RING.peg), 0], P) - k.depthOf([...onRing(b.angle, RING.peg), 0], P));
  const r = points.length > 24 ? 1.2 : 1.8;
  return sorted.map((p) => {
    const [x, y] = onRing(p.angle, RING.peg);
    const lit = litAngle !== null && Math.abs(p.angle - litAngle) < 1e-6;
    return S(k.cylinder(x, y, r, RING.top, 4.5, P, 14), { tone: "hi", lit });
  }).join("");
}

function hopper() {
  const out = [];
  out.push(S(k.slabOf(HOPPER, 0, HOPPER.h, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(HOPPER, 6, P, 3), { tone: "faint" }) }));
  const mouth = k.insetPlan(HOPPER, 4);
  out.push(L(k.planOutline(mouth, HOPPER.h, P, 3), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(mouth, 1.4), HOPPER.h, P, 3), { tone: "faint" }));
  out.push(D(k.corners(HOPPER, 2).map(([x, y]) => at([x, y, HOPPER.h])), { size: 0.4 }));
  return out.join("");
}

function drum() {
  const { cx, cy } = DRUM;
  const base = { x: cx - 22, y: cy - 22, w: 44, d: 44, r: 3 };
  const out = [];
  out.push(S(k.slabOf(base, 0, DRUM.z, P, 4, 0.6), { tone: "mid" }));
  out.push(D(k.corners(base, 4).map(([x, y]) => at([x, y, DRUM.z])), { size: 0.4 }));
  out.push(S(k.cylinder(cx, cy, DRUM.r, DRUM.z, DRUM.top - DRUM.z, P, 64, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(cx, cy, DRUM.r, DRUM.z + 1, DRUM.top - 4, 64, P), { tone: "lo" }));
  out.push(L(k.sideArc(cx, cy, DRUM.r, DRUM.top - 4, P, 40), { tone: "faint" }));
  out.push(L(k.ring(cx, cy, DRUM.r - 2, DRUM.top, P, 64), { tone: "lo" }));
  return out.join("");
}

// Sector lines and the pointer on the drum's face: n sectors, pointer at sector `slot`.
export function drumFace(n, slot, active) {
  const { cx, cy } = DRUM;
  const lines = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 360;
    return k.lineOnTop(onDrum(a, 4.5), onDrum(a, DRUM.r - 2), DRUM.top, P);
  }).join("");
  const mid = ((slot + 0.5) / n) * 360;
  const needle = k.lineOnTop(onDrum(mid + 180, 2.5), onDrum(mid, DRUM.r - 4.5), DRUM.top + 0.2, P);
  return L(lines, { tone: "mid" }) + L(k.ring(cx, cy, 4.5, DRUM.top, P, 24), { tone: "mid" })
    + `<path class="iso-line" data-tone="${active ? "lit" : "hi"}" data-free="start" d="${needle}" style="stroke-width:1.1"/>`;
}
export const onDrum = (deg, r) => [DRUM.cx + r * Math.sin(rad(deg)), DRUM.cy - r * Math.cos(rad(deg))];

function leverSlot() {
  const plan = { x: LEVER.x, y: LEVER.y, w: LEVER.w, d: LEVER.d, r: 1.5 };
  return S(k.slabOf(plan, 0, 3, P, 3, 0.4), { tone: "mid" })
    + L(k.planOutline({ x: LEVER.x + 3, y: LEVER.y + 3, w: LEVER.w - 6, d: 2, r: 1 }, 3, P, 2), { tone: "lo" })
    + D([at([LEVER.x + 1.6, LEVER.y + 4, 3]), at([LEVER.x + LEVER.w - 1.6, LEVER.y + 4, 3])], { size: 0.4 });
}
export function leverSvg(mode) {
  const x = mode === "modulo" ? LEVER.modulo : LEVER.ring, y = LEVER.y + 4;
  return S(k.cylinder(x, y, 1.2, 3, 11, P, 12), { tone: "mid", crease: "none" })
    + S(k.cylinder(x, y, 3.2, 14, 4, P, 24, 0.4), { tone: "hi", crease: "lo" });
}

// One bin: a tray with a stack of cards whose height is the node's share. state: "up" | "down" | "absent".
export function binSvg(index, share, state, lit = false) {
  const b = BINS[index];
  if (state === "absent") return "";
  const tray = { x: b.cx - b.w / 2, y: b.y, w: b.w, d: b.d, r: 2 };
  let out = `<path class="iso-halo" d="${k.haloOf(k.insetPlan(tray, 2), 0, 0.1, P)}" style="filter:blur(4px)"/>`;
  out += S(k.slabOf(tray, 0, TRAY_H, P, 3, 0.5), { tone: "mid" });
  out += L(k.planOutline(k.insetPlan(tray, 2.5), TRAY_H, P, 3), { tone: "lo" });
  if (state === "down") {
    out += S(k.slabOf(k.insetPlan(tray, 1), TRAY_H, 2.5, P, 3, 0.4), { tone: "lo" });
    out += L(k.lineOnTop([tray.x + 5, tray.y + 5], [tray.x + tray.w - 5, tray.y + tray.d - 5], TRAY_H + 2.5, P) + k.lineOnTop([tray.x + tray.w - 5, tray.y + 5], [tray.x + 5, tray.y + tray.d - 5], TRAY_H + 2.5, P), { tone: "mid" });
    return out;
  }
  const h = stackHeight(share);
  if (h > 0.2) {
    const stack = { x: b.cx - 12, y: b.y + 3, w: 24, d: 18, r: 1 };
    const seams = [];
    for (let z = TRAY_H + 6; z < TRAY_H + h - 1; z += 6) seams.push(k.sideSeam(stack, z, P, 2));
    out += S(k.slabOf(stack, TRAY_H, h, P, 2, 0.4), { tone: "hi", crease: "lo", lit, inner: seams.length ? L(seams.join(""), { tone: "faint" }) : "" });
  }
  return out;
}
export const stackHeight = (share) => Math.min(48, STACK_SCALE * share);
export const stackTop = (index, share) => [BINS[index].cx, BINS[index].y + BINS[index].d / 2, TRAY_H + stackHeight(share)];

export function cardSvg() {
  return S(k.slabOf({ x: -CARD.w / 2, y: -CARD.d / 2, w: CARD.w, d: CARD.d, r: 0.4 }, 0, CARD.h, P, 2), { tone: "hi", crease: "lo", lit: true });
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A sorting carousel on a base plate. Cards (keys) come out of a hopper. In ring mode each card lands on a turntable at its hash angle, slides clockwise to the next marker peg and goes to the bin that owns that peg. In modulo mode a lever sends cards to a selector drum that picks bin number hash mod n instead. Six bins along the front stand for nodes A to F; the height of each stack is that node's share of the keys.",
    body: [
      plate(),
      ring(),
      `<g data-pegs></g>`,
      hub(),
      `<g data-track></g>`,
      hopper(),
      drum(),
      `<g data-drum></g>`,
      leverSlot(),
      `<g data-lever></g>`,
      `<g data-bins></g>`,
      `<g data-fly></g>`,
    ],
  });
}

export const GEOMETRY = { RING, HUB, DRUM, MOUTH, BINS, TRAY_H, CARD, STACK_SCALE, LEVER };

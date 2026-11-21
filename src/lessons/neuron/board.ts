// @ts-nocheck: figure code in the style of the other lessons.
// The rolling board, drawn for both the page (figure.ts, at build time) and the live code (in the browser): one
// neuron sorting cats from dogs. Each animal rolls down the board from the middle line. Three kickers stand in slots
// across it, one per clue; each pushes the animal sideways, toward the DOG half (shaded) or the CAT half, by this
// animal's share of how much its clue counts: the starting lean pushes every animal by its setting; every 10 kg pushes
// by the setting times the animal's tens of kg; floppy ears push by the setting, and only an animal with floppy ears
// (otherwise the kicker stays back). The sideways place at the end is the sum of the pushes: the score. A divider down
// the middle line sends the animal into the CAT pen or the DOG pen. An animal in the wrong pen is lit; then a chip on
// each sign that took part shows the notch it moves, and the dashed outline the push that animal would get now.
// Two compositions of the same parts: `desk` (the board runs left to right, the signs on a back wall) and `phone`
// (the camera turned so the board runs down the screen, CAT on the left and DOG on the right, the signs on stands).
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, litFill } from "../../../workbench/parts.mjs";
import { t, isT } from "../../../workbench/i18n.mjs";
import { ANIMALS, SETS, SCALE, score100 } from "./sim";

const RAD = Math.PI / 180;
const MINUS = "−";
export const KIND = [t("CAT", "GATO"), t("DOG", "PERRO")];
export const NAMES = {
  cat3: t("a small cat", "un gato pequeño"), cat4: t("a house cat", "un gato de casa"), cat5: t("a house cat", "un gato de casa"),
  cat6: t("a big house cat", "un gato de casa grande"), shihtzu: t("a small floppy-eared dog", "un perro pequeño de orejas caídas"),
  shiba: t("a fox-like dog", "un perro con cara de zorro"), cocker: t("a spaniel", "un spaniel"), husky: t("a husky", "un husky"),
  chihuahua: t("a chihuahua", "un chihuahua"), mainecoon: t("a big fluffy cat", "un gato grande y peludo"),
};

// ---------- numbers as the machine prints them ----------
export const sgn = (v, digits = 0) => (Math.abs(v) < 1e-9 ? (0).toFixed(digits) : (v > 0 ? "+" : MINUS) + Math.abs(v).toFixed(digits));
/** A score in hundredths, with as few decimals as it needs (at most two). */
export const scoreText = (s100) => { const d = s100 % 100 === 0 ? 0 : s100 % 10 === 0 ? 1 : 2; return s100 === 0 ? "0" : sgn(s100 / 100, d); };
export const settingText = { kg: (w10) => sgn(w10 / 10, 1), ears: (v) => sgn(v), lean: (v) => sgn(v) };

// ---------- the model's state as the board shows it ----------
// st: { set, lean (used?), d: { w10, ears, lean } (the kickers' settings: 10 kg in tenths), mode: "hand" | "train",
// cur (the animal on the board, train only), phase: "roll" (on its way) | "correct" (landed in the wrong pen, the
// kickers about to move) | null, nudge (the notches they move), sorted (this round's earlier animals, [id, pen]),
// queue (the next ones), round, mistakes }.
export const START = { set: "easy", lean: true, d: { w10: 0, ears: 0, lean: 0 }, mode: "hand", phase: null, sorted: [], queue: [], round: 0, mistakes: 0 };

/** The three pushes an animal gets, in points of score: the starting lean (every animal), every 10 kg (its tens of kg ×
 *  that setting), floppy ears (that setting, only if its ears are floppy). Their sum is its score. */
export function pushesOf(d, id, lean = true) {
  const [, kg, fl] = ANIMALS[id];
  return [lean ? d.lean : 0, (d.w10 / 10) * (kg / SCALE), d.ears * fl];
}
/** Does kicker i push this animal at all? The lean only if it's in use; 10 kg always (every animal weighs something);
 *  floppy ears only for floppy ears. */
export const firesOn = (i, id, lean = true) => (i === 0 ? lean : i === 1 ? true : ANIMALS[id][2] === 1);

/** What the board shows: every animal's verdict, the animal on the board, who is in the pens, the tally. */
export function readState(st) {
  const ids = SETS[st.set];
  const verdict = (id) => { const s = score100(st.d, id, st.lean), got = s > 0 ? 1 : 0, kind = ANIMALS[id][0]; return { id, s, got, kind, wrong: got !== kind }; };
  const all = ids.map(verdict);
  if (st.mode === "hand") {
    // by hand every animal has run with the same kickers: all are in the pens, the first one sorted wrong in bold
    return { ids, all, cur: all.find((a) => a.wrong) || null, pens: all, queue: [], right: all.filter((a) => !a.wrong).length, sorted: all.length };
  }
  // in the pens an animal keeps the pen it went into, even after the kickers have moved
  const pens = (st.sorted || []).map(([id, got]) => { const kind = ANIMALS[id][0]; return { ...verdict(id), got, wrong: got !== kind }; });
  const cur = st.cur ? verdict(st.cur) : null;
  const landed = cur && st.phase === "correct" ? [...pens, cur] : pens;
  return { ids, all, cur, pens: landed, queue: st.queue || [], right: landed.filter((a) => !a.wrong).length, sorted: landed.length };
}

// ---------- text on faces (bilingual) ----------
function faceTxt(P, face, [x, y, z], words, size, { tone = "hi", anchor = "start", attr = "" } = {}) {
  if (isT(words)) return `<g data-l="en">${faceTxt(P, face, [x, y, z], words.en, size, { tone, anchor, attr })}</g><g data-l="es">${faceTxt(P, face, [x, y, z], words.es, size, { tone, anchor, attr })}</g>`;
  // face "y": reads along +x, up z; face "x": reads along −y; "top": lies on a top face, reads along +x
  const o = k.iso([x, y, z], P);
  const a = face === "x" ? k.iso([x, y - 1, z], P) : k.iso([x + 1, y, z], P);
  const d = face === "top" ? k.iso([x, y + 1, z], P) : k.iso([x, y, z - 1], P);
  const m = `matrix(${(a[0] - o[0]).toFixed(3)} ${(a[1] - o[1]).toFixed(3)} ${(d[0] - o[0]).toFixed(3)} ${(d[1] - o[1]).toFixed(3)} ${o[0].toFixed(2)} ${o[1].toFixed(2)})`;
  const svg = k.faceTextSvg(m, words, { size, tone, anchor });
  return attr ? svg.replace("<text ", `<text ${attr} `) : svg;
}
const wordLen = (w) => (isT(w) ? Math.max(w.en.length, w.es.length) : String(w).length);
const CW = 0.62;  // the mono font's advance, in font sizes (a little over 0.6, for safety)

// ---------- the animals ----------
/** Line drawings, side view facing +u, in a unit box (u right, v up). Original, generic shapes. */
const ellipse = (cx, cy, rx, ry, n = 22) => Array.from({ length: n + 1 }, (_, i) => [cx + rx * Math.cos((i / n) * 2 * Math.PI), cy + ry * Math.sin((i / n) * 2 * Math.PI)]);
const SIL = {
  cat: [
    ellipse(0.46, 0.44, 0.26, 0.14),
    ellipse(0.79, 0.62, 0.13, 0.12),
    [[0.69, 0.69], [0.71, 0.9], [0.79, 0.74]], [[0.81, 0.74], [0.89, 0.9], [0.9, 0.69]],
    [[0.28, 0.34], [0.28, 0.06]], [[0.36, 0.31], [0.37, 0.06]], [[0.58, 0.31], [0.59, 0.06]], [[0.66, 0.34], [0.67, 0.06]],
    [[0.21, 0.5], [0.12, 0.58], [0.08, 0.72], [0.12, 0.86], [0.18, 0.9]],
  ],
  dog: [
    ellipse(0.43, 0.46, 0.27, 0.15),
    [[0.66, 0.56], [0.68, 0.74], [0.78, 0.8], [0.86, 0.72], [0.97, 0.68], [0.97, 0.6], [0.84, 0.57], [0.74, 0.5]],
    [[0.22, 0.36], [0.22, 0.06]], [[0.31, 0.33], [0.31, 0.06]], [[0.56, 0.33], [0.56, 0.06]], [[0.65, 0.36], [0.65, 0.06]],
    [[0.17, 0.55], [0.09, 0.66], [0.07, 0.8]],
  ],
  pointy: [[[0.7, 0.75], [0.74, 0.97], [0.81, 0.78]]],
  floppy: [[[0.7, 0.76], [0.64, 0.66], [0.65, 0.5], [0.71, 0.52], [0.76, 0.74]]],
};
/** A card's size grows a little with how heavy the animal is. */
const sizeOf = (kg) => (kg <= 2 ? 0.78 : kg <= 6 ? 0.9 : kg <= 9 ? 1 : kg <= 12 ? 1.08 : 1.18);

/** An animal: an upright card on a round cart, its shape drawn on the front (the face toward the viewer, world +y).
 *  (x, y, z): the cart's centre. lit: in the wrong pen. tag: words on a tag above it (its kg on the board, its real
 *  kind when it is in the wrong pen). */
function animal(P, id, [x, y, z], { lit = false, tag = null, F = 5, base = 12 } = {}) {
  const [kind, kg, fl] = ANIMALS[id], sc = sizeOf(kg), w = base * sc * 1.12, h = base * sc;
  const out = [];
  out.push(k.solidSvg(k.cylinder(x, y, Math.min(w * 0.42, 3.4), z, 1.4, P, 20, 0.2), { tone: "hi", crease: "lo", className: "nr-cart" }));
  const card = { x: x - w / 2, y: y - 0.7, w, d: 1.4, r: 0.3 };
  const solid = k.solidSvg(k.slabOf(card, z + 1.4, h, P, 2, 0.15), { tone: "hi", crease: "lo", lit });
  out.push(lit ? litFill(solid) : solid);
  const fy = y + 0.72, z0 = z + 1.4;
  const map = ([u, v]) => k.iso([x + (u - 0.5) * w * 0.94, fy, z0 + v * h * 0.94 + h * 0.03], P);
  const lines = [...SIL[kind ? "dog" : "cat"], ...(kind ? SIL[fl ? "floppy" : "pointy"] : [])];
  out.push(`<path class="nr-sil${lit ? " nr-on-lit" : ""}" d="${lines.map((pl) => k.pathOf(pl.map(map))).join("")}"/>`);
  const tagSvg = [];
  if (tag) {
    const tw = wordLen(tag) * CW * F + 3, th = F * 1.35, tz = z0 + h + 2.4;
    tagSvg.push(k.lineSvg(k.pathOf([k.iso([x, fy, z0 + h], P), k.iso([x, fy, tz], P)]), { tone: "hi" }));
    tagSvg.push(k.solidSvg(k.slabOf({ x: x - tw / 2, y: y + 0.2, w: tw, d: 1, r: 0.3 }, tz, th, P, 2, 0.15), { tone: "hi", crease: "lo", className: "nr-tag" }));
    tagSvg.push(faceTxt(P, "y", [x, y + 1.22, tz + th / 2 - F * 0.36], tag, F, { tone: "hi", anchor: "middle", attr: 'data-tag=""' }));
  }
  // the tag sits outside the lit group, so its words keep their ink on the white tag
  return `<g class="wb-lit-group"${lit ? ' data-lit-animal=""' : ""}>${out.join("")}</g>${tagSvg.join("")}`;
}

// ---------- the kickers' signs ----------
const STATIONS = [
  { key: "lean", lines: [t("STARTING", "TENDENCIA"), t("LEAN", "INICIAL")] },
  { key: "kg", lines: [t("EVERY", "CADA"), t("10 KG", "10 KG")] },
  { key: "ears", lines: [t("FLOPPY", "OREJAS"), t("EARS", "CAÍDAS")] },
];
const settingOf = (st, i) => [st.d.lean, st.d.w10 / 10, st.d.ears][i];
const nudgeOf = (st, i) => (st.phase === "correct" && st.nudge ? [st.nudge.lean, st.nudge.w10 / 10, st.nudge.ears][i] : 0);

// ---------- coordinates ----------
// The board is laid out in its own terms: a = along the board (the way the animals roll), s = sideways (+ toward the
// DOG side). Desk: a is world x and s is world y (left to right, the DOG half nearer the viewer). Phone: a is world y
// and s is world x, with the camera turned so the board runs down the screen: CAT on the left, DOG on the right.
// Faces that carry words (signs, cards, the phone's end wall) are faces of constant world y in both.
const LAYOUTS = {
  desk: { width: 760, txtPx: 12.2, az: 50, el: 30 },
  phone: { width: 380, txtPx: 13.4, az: 88, el: 42 },
};

// ---------- sizes: T is the geometry unit, F the font size (both world units) ----------
function sizes(T, F, layout) {
  const z = { T, F, ph: layout === "phone" };
  z.U = 3 * T;                    // sideways: one point of score
  z.HW = 3.4 * z.U;               // half the track, inside the rails
  z.rail = { t: 0.9 * T, h: 0.9 * T };
  z.bh = 1.4 * T;                 // the board's top
  z.tok = z.ph ? { cur: 5.2 * T, queue: 4.4 * T, pen: 4.0 * T } : { cur: 4.2 * T, queue: 3.6 * T, pen: 3.4 * T };
  const labW = Math.max(...STATIONS.flatMap((s) => s.lines).map(wordLen)) * CW * F;
  const vF = z.ph ? 1.15 : 1.3, valW = 4 * CW * F * vF + 1.0 * T, chipW = 4 * CW * F + 0.8 * T, valH = vF * F + 0.8 * T;
  // on the phone the chip sticks out past the sign's right edge, over the slot, so the sign is only as wide as its words
  z.sign = { labW, valW, chipW, valH, vF, w: Math.max(labW, z.ph ? valW : valW + 0.3 * T + chipW) + (z.ph ? 1.0 : 1.4) * T, h: 0.6 * T + 2 * 1.25 * F + 0.35 * T + valH + 0.5 * T };
  z.pen = z.ph ? { rows: 5, lanes: [0.3, 0.72], step: 4.6 * T } : { rows: 5, lanes: [0.3, 0.72], step: 4.1 * T };
  z.tally = { h: 1.1 * F + 1.0 * T, d: 1.6 * T };
  z.wall = 1.2 * T;
  return z;
}
const tallyW = (z) => (wordLen(t("MISTAKES", "ERRORES")) + wordLen(t("ROUND", "VUELTA")) + wordLen(t("RIGHT", "BIEN"))) * CW * z.F + (5 + 3 + 3) * CW * z.F * 1.1 + 6.4 * z.T;

/** Where everything goes along (a) and across (s) the board. */
function layoutOf(z) {
  const T = z.T, s = {};
  s.x0 = z.ph ? -8 * T : -11 * T;
  s.queue = z.ph ? [[-3.4 * T, 0]] : [[-3.4 * T, 0], [-6.6 * T, 0]];
  s.start = -0.4 * T;                  // where an animal leaves the queue
  if (z.ph) {
    // a sign on its own stand at the left end of each slot, far enough apart down the board that the stands, seen
    // from the front, stack without hiding each other
    const A = LAYOUTS.phone.az * RAD, E = LAYOUTS.phone.el * RAD, step = (z.sign.h + 0.5 * T) * Math.cos(E) / (Math.sin(A) * Math.sin(E)) + 1.6 * T;
    s.st = STATIONS.map((_, i) => 2.2 * T + i * step);
    s.sl = -z.HW - z.rail.t - z.sign.w + 0.2 * T;       // the board's left edge: the stands straddle the left rail
  } else {
    s.st = STATIONS.map((_, i) => 1.2 * T + z.sign.w / 2 + i * (z.sign.w + 0.7 * T));
    s.sl = -z.HW - z.rail.t - z.wall;                  // the board's back edge: the wall stands there
  }
  s.kick = [-0.3 * T, 1.9 * T];        // the push happens over this stretch, from the slot on
  s.Dx = s.st[2] + (z.ph ? 9 * T : z.sign.w / 2 + 3.6 * T);
  s.Px = s.Dx + 3.4 * T;
  s.L = s.Px + z.pen.rows * z.pen.step + 1.2 * T;
  s.sr = z.HW + z.rail.t;              // the board's right (phone) or front (desk) edge
  s.tally = z.ph ? null : { x: s.x0, y: s.sr + 2.2 * T, w: tallyW(z) };
  return s;
}

/** The board's terms → the world: a point, a plan, a ring. */
function mapper(z) {
  const M = z.ph ? (a, s, h = 0) => [s, a, h] : (a, s, h = 0) => [a, s, h];
  const plan = (a0, s0, aw, sd, r = 0.4) => {
    if (aw < 0) { a0 += aw; aw = -aw; }
    if (sd < 0) { s0 += sd; sd = -sd; }
    return z.ph ? { x: s0, y: a0, w: sd, d: aw, r } : { x: a0, y: s0, w: aw, d: sd, r };
  };
  const ring = (pts) => { const r = pts.map(([a, s]) => M(a, s).slice(0, 2)); return z.ph ? r.reverse() : r; };
  return { M, plan, ring };
}

function plateOf(z, s) {
  const m = 1.4 * z.T, { plan } = mapper(z);
  const s1 = s.tally ? s.tally.y + z.tally.d : s.sr;
  return { ...plan(s.x0 - m, s.sl - m, s.L + 0.9 * z.T - s.x0 + 2 * m, s1 - s.sl + 2 * m), r: 8 };
}
function shapeOf(z, s) {
  const { M } = mapper(z), T = z.T;
  const signTop = z.bh + (z.ph ? 0 : z.rail.h) + z.sign.h + 0.6 * T, tagTop = z.bh + z.tok.cur * 1.25 + 2.4 * z.F;
  return [...k.boxCorners(plateOf(z, s), -14, 0), M(s.x0, s.sl, signTop), M(s.Dx, s.sl, signTop), M(s.st[0], s.sl, signTop), M(s.Dx, -z.HW, tagTop), M(s.L, -z.HW, z.bh + z.tok.pen * 1.3 + 2.4 * z.F), M(s.x0, 0, tagTop)];
}
const FITS = {};
/** Fit a composition to its width: the font size follows the fit (a few passes), so words keep their size on screen. */
function fitOf(layout) {
  if (FITS[layout]) return FITS[layout];
  const L = LAYOUTS[layout], pad = 8, T = 6, W = L.width;
  let F = 6, z, s, P, height;
  for (let pass = 0; pass < 10; pass++) {
    z = sizes(T, F, layout);
    s = layoutOf(z);
    const unit = { origin: [0, 0], scale: 1, azimuth: L.az, elevation: L.el };
    const q = shapeOf(z, s).map((p) => k.iso(p, unit));
    const x0 = Math.min(...q.map((p) => p[0])), x1 = Math.max(...q.map((p) => p[0])), y0 = Math.min(...q.map((p) => p[1])), y1 = Math.max(...q.map((p) => p[1]));
    const sc = (W - 2 * pad) / (x1 - x0);
    P = { origin: [pad - x0 * sc, pad - y0 * sc], scale: sc, azimuth: L.az, elevation: L.el };
    height = Math.round((y1 - y0) * sc + 2 * pad);
    const kpx = sc * Math.sqrt(1.6) * Math.cos(L.el * RAD) * 0.96;
    const want = L.txtPx / kpx;
    if (Math.abs(want - F) < 0.01) break;
    F = want;
  }
  return (FITS[layout] = { z, s, P, height, ...mapper(z) });
}

// ---------- paths ----------
const clampS = (z, v) => Math.max(-z.HW + 0.6 * z.T, Math.min(z.HW - 0.6 * z.T, v));
/** An animal's path on the board's top, in (a, s), with where each push starts: from the queue down the middle line,
 *  a sideways push just past each kicker's slot, on to the divider's nose and into its place in a pen (`end`; without
 *  it the path stops before the nose). The sideways places are the running sums, clamped to the rails for drawing
 *  only (which side it ends on is always the score's). */
function pathOf(z, s, st, id, end) {
  const p = pushesOf(st.d, id, st.lean), pts = [[s.start, 0]], at = [];
  let y = 0;
  p.forEach((d, i) => {
    at.push({ a: s.st[i], y });
    pts.push([s.st[i] + s.kick[0], clampS(z, y)]);
    y += d * z.U;
    pts.push([s.st[i] + s.kick[1], clampS(z, y)]);
  });
  const last = clampS(z, y);
  // a score of exactly 0 is CAT: on the line it is steered a hair to the CAT side of the nose
  const nose = last === 0 ? -0.35 * z.T : last;
  pts.push([s.Dx - 0.9 * z.T, nose]);
  if (end) pts.push([s.Px, end[1]], [end[0], end[1]]);
  return { pts, at, pushes: p };
}
const segLen = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
/** The point a fraction f of the way along a polyline, and the polyline up to it. */
function along(pts, f) {
  const lens = pts.slice(1).map((p, i) => segLen(pts[i], p)), total = lens.reduce((a, b) => a + b, 0);
  let left = Math.max(0, Math.min(1, f)) * total;
  const out = [pts[0]];
  for (let i = 0; i < lens.length; i++) {
    if (left <= lens[i] || i === lens.length - 1) {
      const u = lens[i] ? Math.min(1, left / lens[i]) : 1, p = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u];
      out.push(p);
      return { p, upto: out };
    }
    left -= lens[i];
    out.push(pts[i + 1]);
  }
  return { p: pts[pts.length - 1], upto: pts };
}
/** The places in a pen, in (a, s), in the order they fill: from the divider's nose on, the row nearest the viewer
 *  first. */
function slotsOf(z, s, kind) {
  const out = [];
  for (let r = 0; r < z.pen.rows; r++) {
    const a = s.Px + 0.6 * z.T + (r + 0.5) * z.pen.step;
    const lanes = z.ph ? z.pen.lanes : kind ? [...z.pen.lanes].reverse() : z.pen.lanes;   // desk: nearer row first
    for (const v of lanes) out.push([a, kind ? v * z.HW : -v * z.HW]);
  }
  return out;
}

// ---------- the parts ----------
/** A kicker's slot: a groove across the board (on the phone it runs on under the sign's stand). */
function slot(P, z, s, i) {
  const { M } = fitOf(z.ph ? "phone" : "desk"), a = s.st[i], gw = 0.6 * z.T, zt = z.bh + 0.03;
  const on = (pts) => k.pathOf(pts.map(([pa, ps]) => k.iso(M(pa, ps, zt), P)), true);
  const s0 = z.ph ? s.sl + 0.6 * z.T : -z.HW - z.rail.t;
  return `<path class="nr-slot" d="${on([[a - gw, s0], [a + gw, s0], [a + gw, z.HW + z.rail.t], [a - gw, z.HW + z.rail.t]])}"/>`;
}
/** A kicker's moving part: a shoe that rides in the slot and, when it fires, an arm out of it with a pusher plate at
 *  its end, as long as this animal's push (`len`, in points; `ext` 0…1 of the way out). It waits at `y`, where the
 *  animal crosses its slot. A kicker that doesn't push this animal stays back, hollow. `ghost`: the push the same
 *  animal would get after the notch, as a dashed outline. */
function paddle(P, z, s, i, y, len, { ext = 1, fired = true, ghost = null } = {}) {
  const { M, plan } = fitOf(z.ph ? "phone" : "desk"), T = z.T, a = s.st[i], zt = z.bh, out = [];
  const y0 = clampS(z, y);
  const y1 = clampS(z, y + len * ext * z.U), d = y1 - y0, sg = Math.sign(d) || 1;
  // the shoe: a block riding in the slot (hollow when this kicker doesn't push this animal)
  const shoe = k.solidSvg(k.slabOf(plan(a - 0.9 * T, y0 - 0.7 * T, 1.8 * T, 1.4 * T, 0.3), zt - 0.4 * T, 2.0 * T, P, 2, 0.2), { tone: "hi", crease: "lo", className: fired ? "nr-shoe" : "nr-shoe nr-idle" });
  if (fired && Math.abs(d) > 0.2 * T) {
    // the arm out of the shoe and the pusher plate at its end, standing across the slot
    const arm = k.solidSvg(k.slabOf(plan(a - 0.45 * T, y0, 0.9 * T, d, 0.2), zt + 0.4 * T, 0.9 * T, P, 2, 0.1), { tone: "hi", crease: "lo", className: "nr-arm" });
    const pusher = k.solidSvg(k.slabOf(plan(a - 1.6 * T, y1, 3.2 * T, sg * 0.7 * T, 0.25), zt - 0.2 * T, 2.6 * T, P, 2, 0.15), { tone: "hi", crease: "lo", className: "nr-pusher" });
    // back to front: whichever end is farther from the viewer first
    out.push(...(sg > 0 ? [shoe, arm, pusher] : [pusher, arm, shoe]));
  } else out.push(shoe);
  if (ghost !== null && Math.abs(ghost) > 0.01) {
    // the outline of the pusher where it would stop now, and the arm out to it
    const g1 = clampS(z, y + ghost * z.U), sg = Math.sign(g1 - y0) || 1, h = zt + 2.4 * T;
    const box = [[a - 1.6 * T, g1], [a + 1.6 * T, g1], [a + 1.6 * T, g1 + sg * 0.7 * T], [a - 1.6 * T, g1 + sg * 0.7 * T]];
    out.push(`<path class="nr-ghost" d="${k.pathOf(box.map(([pa, ps]) => k.iso(M(pa, ps, h), P)), true)}${k.pathOf([k.iso(M(a, y0, h - 1.2 * T), P), k.iso(M(a, g1, h - 1.2 * T), P)])}"/>`);
  }
  return out.join("");
}
/** A window on a face of constant world y with text in it (a readout). */
function windowY(P, x, fy, z0, w, h, text, size, attr = "") {
  return k.solidSvg(k.slabOf({ x, y: fy - 0.02, w, d: 1.2, r: 0.3 }, z0, h, P, 2, 0.15), { tone: "hi", crease: "lo", className: "nr-window" }) + faceTxt(P, "y", [x + w / 2, fy + 1.2, z0 + h / 2 - size * 0.36], text, size, { tone: "hi", anchor: "middle", attr });
}
/** One kicker's sign: its name and how much its clue counts, and after a mistake a chip with the notch it moves.
 *  (x, fy): the sign's left end and its face (world), z0 its foot. */
function sign(P, z, i, st, x, fy, z0) {
  const T = z.T, F = z.F, sg = z.sign, out = [];
  const vals = [st.lean ? settingText.lean(st.d.lean) : t("OFF", "NO"), settingText.kg(st.d.w10), settingText.ears(st.d.ears)];
  out.push(k.solidSvg(k.slabOf({ x, y: fy, w: sg.w, d: 0.7, r: 0.4 }, z0, sg.h, P, 2, 0.15), { tone: "hi", crease: "lo", className: "nr-sign" }));
  const sy = fy + 0.72, mx = (z.ph ? 0.5 : 0.7) * T;
  let zt = z0 + sg.h - 0.6 * T;
  for (const ln of STATIONS[i].lines) { out.push(faceTxt(P, "y", [x + mx, sy, zt - F * 0.8], ln, F, { tone: i === 0 && !st.lean ? "mid" : "hi" })); zt -= 1.25 * F; }
  const wz = z0 + 0.5 * T;
  out.push(windowY(P, x + mx, sy, wz, sg.valW, sg.valH, vals[i], F * sg.vF, `data-setting="${STATIONS[i].key}"`));
  const n = nudgeOf(st, i);
  if (n) {
    const txt = (n > 0 ? "+" : MINUS) + (i === 1 ? Math.abs(n).toFixed(1) : String(Math.abs(n)));
    const cw = txt.length * CW * F + 0.7 * T, cx2 = z.ph ? x + sg.w - 0.4 * T : x + mx + sg.valW + 0.3 * T, ch = F * 1.1 + 0.4 * T, cz = wz + (sg.valH - ch) / 2;
    out.push(k.solidSvg(k.slabOf({ x: cx2, y: sy, w: cw, d: 1.8, r: 0.4 }, cz, ch, P, 2, 0.2), { tone: "hi", crease: "lo", className: "nr-chip" }));
    out.push(faceTxt(P, "y", [cx2 + cw / 2, sy + 1.82, cz + ch / 2 - F * 0.36], txt, F, { tone: "hi", anchor: "middle", attr: 'data-chip=""' }));
  }
  return out.join("");
}
/** Desk: the back wall along the CAT edge, one sign right behind each kicker's slot. */
function backWall(P, z, s, st) {
  const T = z.T, out = [], x1 = s.Dx - 0.6 * T, top = z.bh + z.rail.h + z.sign.h + 0.6 * T;
  out.push(k.solidSvg(k.slabOf({ x: 0, y: s.sl, w: x1, d: z.wall, r: 0.5 }, z.bh, top - z.bh, P, 2, 0.3), { tone: "hi", crease: "lo", className: "nr-wall" }));
  STATIONS.forEach((_, i) => out.push(sign(P, z, i, st, s.st[i] - z.sign.w / 2, s.sl + z.wall + 0.02, z.bh + z.rail.h + 0.3 * T)));
  return out.join("");
}
/** Phone: kicker i's stand at the left end of its slot, the sign on its front. */
function stand(P, z, s, st, i) {
  const T = z.T, a = s.st[i], x = s.sl + 0.2 * T, out = [];
  out.push(k.solidSvg(k.slabOf({ x, y: a - 1.0 * T, w: z.sign.w, d: 1.0 * T, r: 0.4 }, z.bh, z.sign.h + 0.2 * T, P, 2, 0.3), { tone: "hi", crease: "lo", className: "nr-wall" }));
  out.push(sign(P, z, i, st, x, a + 0.02, z.bh + 0.1 * T));
  return out.join("");
}
/** The board's top: the DOG half shaded, faint lanes one point apart, the middle line, CAT and DOG painted at the top. */
function markings(P, z, s) {
  const T = z.T, zt = z.bh + 0.02, out = [], { M } = fitOf(z.ph ? "phone" : "desk");
  const on = (pts, closed = true) => k.pathOf(pts.map(([a, v]) => k.iso(M(a, v, zt), P)), closed);
  out.push(`<path class="nr-dogside" d="${on([[s.x0 + 0.4 * T, 0], [s.L, 0], [s.L, z.HW], [s.x0 + 0.4 * T, z.HW]])}"/>`);
  const lanes = [];
  for (let j = -3; j <= 3; j++) if (j) lanes.push(on([[s.start, j * z.U], [s.Dx, j * z.U]], false));
  out.push(k.lineSvg(lanes.join(""), { tone: "faint" }));
  out.push(`<path class="nr-zero" d="${on([[s.x0 + 0.6 * T, 0], [s.Dx, 0]], false)}"/>`);
  if (z.ph) {
    // "top" text reads along world x, sideways here: centred in each half, on the stretch between the last kicker and
    // the divider (the top of the board is taken by the queue and the first sign)
    const Fw = z.F * 1.15, a = s.st[2] + 4.6 * T;
    out.push(faceTxt(P, "top", [-z.HW * 0.55, a, zt], KIND[0], Fw, { tone: "hi", anchor: "middle" }));
    out.push(faceTxt(P, "top", [z.HW * 0.55, a, zt], KIND[1], Fw, { tone: "hi", anchor: "middle" }));
  } else {
    const Fw = z.F * 2;
    // at the start, in each half, out to the side of the queue on the middle line
    out.push(faceTxt(P, "top", [s.x0 + 0.6 * T, -z.HW * 0.68 - Fw * 0.4, zt], KIND[0], Fw, { tone: "hi" }));
    out.push(faceTxt(P, "top", [s.x0 + 0.6 * T, z.HW * 0.68 - Fw * 0.4, zt], KIND[1], Fw, { tone: "hi" }));
  }
  return out.join("");
}
/** The divider: a low wall down the middle line from its nose to the end, splitting the board into the two pens. */
function divider(P, z, s) {
  const T = z.T, w = 0.4 * T, h = 2.2 * T, { ring } = fitOf(z.ph ? "phone" : "desk");
  return k.solidSvg(k.extrude(ring([[s.Dx, 0], [s.Dx + 1.6 * T, -w], [s.L, -w], [s.L, w], [s.Dx + 1.6 * T, w]]), z.bh, h, P, { convex: true }), { tone: "hi", crease: "lo", className: "nr-divider" });
}
/** The end wall: closes the pens; each pen's name and how many animals are in it. */
function endWall(P, z, s, inPens) {
  const T = z.T, F = z.F, out = [], { plan } = fitOf(z.ph ? "phone" : "desk");
  const h = z.ph ? 2.5 * F + 1.0 * T : 1.4 * F + 0.9 * T;
  out.push(k.solidSvg(k.slabOf(plan(s.L, -z.HW - z.rail.t, 0.9 * T, 2 * (z.HW + z.rail.t)), z.bh, h, P, 2, 0.2), { tone: "hi", crease: "lo", className: "nr-wall" }));
  const n = [0, 1].map((kd) => inPens.filter((a) => a.got === kd).length);
  const e = s.L + 0.92 * T, names = [t("CATS", "GATOS"), t("DOGS", "PERROS")];
  if (z.ph) {
    // the halves are narrow here: the pen's name on top, its count under it
    [0, 1].forEach((kd) => {
      const x = (kd ? 0.5 : -0.5) * (z.HW + z.rail.t);
      out.push(faceTxt(P, "y", [x, e, z.bh + h - 0.5 * T - F * 0.8], names[kd], F, { tone: "hi", anchor: "middle" }));
      out.push(faceTxt(P, "y", [x, e, z.bh + 0.5 * T + 0.1 * F], String(n[kd]), F * 1.15, { tone: "hi", anchor: "middle", attr: `data-pen-count="${kd}"` }));
    });
  } else {
    const zt = z.bh + h / 2 - F * 0.45;
    // face "x" reads along −s: the CAT label starts just past the divider, the DOG label ends just before it
    out.push(faceTxt(P, "x", [e, -0.8 * T, zt], t(`CATS ${n[0]}`, `GATOS ${n[0]}`), F * 1.1, { tone: "hi", attr: 'data-pen-count="0"' }));
    out.push(faceTxt(P, "x", [e, 0.8 * T, zt], t(`DOGS ${n[1]}`, `PERROS ${n[1]}`), F * 1.1, { tone: "hi", anchor: "end", attr: 'data-pen-count="1"' }));
  }
  return out.join("");
}
function rail(P, z, s, dog) {
  const { plan } = fitOf(z.ph ? "phone" : "desk"), v = dog ? z.HW : -z.HW - z.rail.t;
  return k.solidSvg(k.slabOf(plan(s.x0, v, s.L - s.x0, z.rail.t), z.bh, z.rail.h, P, 2, 0.2), { tone: "hi", crease: "lo", className: "nr-rail" });
}
/** The tally strip (desk): right so far this round; while it learns, the round and the mistakes; by hand, SET BY HAND. */
function tally(P, z, s, rd, st) {
  const T = z.T, F = z.F, tl = { ...z.tally, ...s.tally }, out = [], h = tl.h;
  out.push(k.solidSvg(k.slabOf({ x: tl.x, y: tl.y, w: tl.w, d: tl.d, r: 0.8 }, 0, h, P, 2, 0.3), { tone: "hi", crease: "lo", className: "nr-tally" }));
  const fy = tl.y + tl.d + 0.02, wz = 0.3 * T, wh = h - 0.6 * T, tz = h / 2 - F * 0.36;
  let x = tl.x + 0.5 * T;
  const rw = 5 * CW * F * 1.1 + 0.8 * T;
  out.push(windowY(P, x, fy, wz, rw, wh, `${rd.right}/${rd.sorted}`, F * 1.1, 'data-tally="right"')); x += rw + 0.4 * T;
  out.push(faceTxt(P, "y", [x, fy, tz], t("RIGHT", "BIEN"), F, { tone: "mid" }));
  if (st.mode === "hand") { out.push(faceTxt(P, "y", [tl.x + tl.w - 0.5 * T, fy, tz], t("SET BY HAND", "A MANO"), F, { tone: "hi", anchor: "end" })); return out.join(""); }
  const nw = 3 * CW * F * 1.1 + 0.8 * T, lab2 = t("MISTAKES", "ERRORES"), lab1 = t("ROUND", "VUELTA");
  let xr = tl.x + tl.w - 0.4 * T - nw;
  out.push(windowY(P, xr, fy, wz, nw, wh, String(st.mistakes ?? 0), F * 1.1, 'data-tally="mistakes"'));
  out.push(faceTxt(P, "y", [xr - 0.35 * T, fy, tz], lab2, F, { tone: "mid", anchor: "end" }));
  xr -= wordLen(lab2) * CW * F + 0.8 * T + nw;
  out.push(windowY(P, xr, fy, wz, nw, wh, String(st.round ?? 0), F * 1.1, 'data-tally="round"'));
  out.push(faceTxt(P, "y", [xr - 0.35 * T, fy, tz], lab1, F, { tone: "mid", anchor: "end" }));
  return out.join("");
}

/** Where the animals in the pens stand. */
function placedOf(z, s, inPens) {
  const placed = [];
  for (const kd of [0, 1]) { const slots = slotsOf(z, s, kd); inPens.filter((a) => a.got === kd).forEach((a, i) => slots[i] && placed.push({ a, at: slots[i] })); }
  return placed;
}
const line = (P, M, zt, pts, cls) => `<path class="${cls}" d="${k.pathOf(pts.map(([a, v]) => k.iso(M(a, v, zt), P)))}"/>`;

/** The moving layer: the kickers' shoes and arms, the bold path of the animal in play (up to where it is, a fraction
 *  f of its way), and that animal on its cart. Drawn again every frame while an animal rolls. */
export function rollSvg(st, layout = "desk", f = 1) {
  const { z, s, P, M } = fitOf(layout), rd = readState(st), T = z.T, zt = z.bh + 0.05, out = [];
  const cur = rd.cur;
  if (!cur) {
    // nobody on the board: the shoes wait on the middle line
    for (let i = 0; i < 3; i++) out.push(paddle(P, z, s, i, 0, 0, { fired: false }));
    return out.join("");
  }
  const landedAt = st.mode === "hand" || st.phase === "correct" ? placedOf(z, s, rd.pens).find((q) => q.a.id === cur.id)?.at : null;
  const end = landedAt || slotsOf(z, s, cur.got)[rd.pens.filter((a) => a.got === cur.got).length] || null;
  const path = pathOf(z, s, st, cur.id, end), done = landedAt ? 1 : f;
  const { p, upto } = along(path.pts, done);
  const ghostD = st.phase === "correct" && st.nudge ? { w10: st.d.w10 + st.nudge.w10, ears: st.d.ears + st.nudge.ears, lean: st.d.lean + st.nudge.lean } : null;
  const ghost = ghostD ? pushesOf(ghostD, cur.id, st.lean) : null;
  path.at.forEach(({ a, y }, i) => {
    const fired = firesOn(i, cur.id, st.lean) && Math.abs(path.pushes[i]) > 1e-9;
    const ext = Math.max(0, Math.min(1, (p[0] - (a + s.kick[0])) / (s.kick[1] - s.kick[0])));
    out.push(paddle(P, z, s, i, y, path.pushes[i], { ext, fired, ghost: ghost && firesOn(i, cur.id, st.lean) && Math.abs(ghost[i] - path.pushes[i]) > 1e-9 ? ghost[i] : null }));
  });
  out.push(line(P, M, zt, upto, "nr-path"));
  if (!landedAt) out.push(animal(P, cur.id, M(p[0], p[1], z.bh), { F: z.F, base: z.tok.cur, tag: `${ANIMALS[cur.id][1]} KG` }));
  return out.join("");
}

/** The machine in one composition. st: a state (see START); layout: "desk" | "phone"; f: how far the animal in play
 *  has rolled (0…1). The moving parts are in <g data-layer="roll">, which the live code redraws with rollSvg(). */
export function buildFigure(st = START, layout = "desk", f = 1) {
  const rd = readState(st), L = LAYOUTS[layout];
  const { z, s, P, height, M, plan } = fitOf(layout);
  const T = z.T, zt = z.bh + 0.05, out = [`<g class="nr-machine" data-layout="${layout}">`];
  out.push(basePlate(P, plateOf(z, s), { height: 10, foot: 4 }));
  if (z.ph) {
    // the board, and beside it a platform for the signs' stands that ends after the last one
    const sb = -z.HW - z.rail.t;
    out.push(k.solidSvg(k.slabOf(plan(s.x0, s.sl, s.st[2] + 1.6 * T - s.x0, sb - s.sl + 1, 1.2), 0, z.bh, P, 2, 0.4), { tone: "hi", crease: "lo", className: "nr-board" }));
    out.push(k.solidSvg(k.slabOf(plan(s.x0, sb, s.L + 0.9 * T - s.x0, s.sr - sb, 1.2), 0, z.bh, P, 2, 0.4), { tone: "hi", crease: "lo", className: "nr-board" }));
  } else out.push(k.solidSvg(k.slabOf(plan(s.x0, s.sl, s.L + 0.9 * T - s.x0, s.sr - s.sl, 1.2), 0, z.bh, P, 2, 0.4), { tone: "hi", crease: "lo", className: "nr-board" }));
  if (!z.ph) out.push(backWall(P, z, s, st));
  out.push(rail(P, z, s, false));
  out.push(markings(P, z, s));
  for (let i = 0; i < 3; i++) out.push(slot(P, z, s, i));
  const placed = placedOf(z, s, rd.pens);
  // by hand: every animal's path, faint, up to the divider's nose, with a dot where it ends
  if (st.mode === "hand") for (const q of placed) if (!rd.cur || q.a.id !== rd.cur.id) {
    const pts = pathOf(z, s, st, q.a.id, null).pts, e = k.iso(M(...pts[pts.length - 1], zt), P);
    out.push(line(P, M, zt, pts, "nr-trail"), `<circle class="nr-end" cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="${(0.4 * T * P.scale).toFixed(1)}"/>`);
  }
  // the queue waits at the top, behind everything that moves
  s.queue.forEach(([qa, qv], i) => { const id = rd.queue[i]; if (id) out.push(animal(P, id, M(qa, qv, z.bh), { F: z.F, base: z.tok.queue })); });
  if (rd.queue.length > s.queue.length) {
    // the rest of the queue, as a "+N" tag behind the last one shown
    const txt = `+${rd.queue.length - s.queue.length}`, [qa] = s.queue[s.queue.length - 1], w = z.ph ? M(qa, 0.62 * z.HW, z.bh) : M(qa - 3.6 * z.T, 0, z.bh);
    const tw = txt.length * CW * z.F + 2.4, th = z.F * 1.35;
    out.push(k.solidSvg(k.slabOf({ x: w[0] - tw / 2, y: w[1] - 0.5, w: tw, d: 1, r: 0.3 }, z.bh, th, P, 2, 0.15), { tone: "hi", crease: "lo", className: "nr-tag" }));
    out.push(faceTxt(P, "y", [w[0], w[1] + 0.52, z.bh + th / 2 - z.F * 0.36], txt, z.F, { tone: "hi", anchor: "middle", attr: 'data-more=""' }));
  }
  out.push(`<g data-layer="roll">${rollSvg(st, layout, f)}</g>`);
  const lastWrong = [...rd.pens].reverse().find((a) => a.wrong);
  const items = placed.map((q) => {
    // the real-kind tag on the last animal in the wrong pen (desk only: on the phone it would cover its neighbours)
    const w = M(q.at[0], q.at[1], z.bh);
    return { v: q.at[1], d: k.depthOf(w, P), svg: animal(P, q.a.id, w, { F: z.F, base: z.tok.pen, lit: q.a.wrong, tag: !z.ph && q.a === lastWrong ? KIND[q.a.kind] : null }) };
  });
  if (z.ph) STATIONS.forEach((_, i) => items.push({ v: s.sl, d: k.depthOf(M(s.st[i], s.sl), P), svg: stand(P, z, s, st, i) }));
  const byDepth = (xs) => xs.sort((p, q) => p.d - q.d).map((q) => q.svg);
  if (z.ph) out.push(divider(P, z, s), ...byDepth(items));
  else out.push(...byDepth(items.filter((q) => q.v < 0)), divider(P, z, s), ...byDepth(items.filter((q) => q.v >= 0)));
  out.push(endWall(P, z, s, rd.pens));
  out.push(rail(P, z, s, true));
  if (s.tally) out.push(tally(P, z, s, rd, st));
  out.push(`</g>`);
  const label = layout === "phone"
    ? t("A board that sorts cats from dogs, running down the screen: the CAT half on the left, the DOG half on the right, shaded. Each animal rolls down the middle line from the top. Three kickers cross the board, their signs on the left: STARTING LEAN, EVERY 10 KG and FLOPPY EARS, each with how much it counts. Each pushes the animal sideways toward DOG or CAT by its share. A divider at the bottom sends it into the CAT pen or the DOG pen. An animal in the wrong pen is lit.",
      "Un tablero que separa gatos de perros, de arriba abajo: la mitad GATO a la izquierda, la mitad PERRO a la derecha, sombreada. Cada animal rueda por la línea del medio desde arriba. Tres empujadores cruzan el tablero, con sus letreros a la izquierda: TENDENCIA INICIAL, CADA 10 KG y OREJAS CAÍDAS, cada uno con cuánto cuenta. Cada uno empuja al animal de lado hacia PERRO o GATO según le toque. Un divisor abajo lo manda al corral de los gatos o al de los perros. Un animal en el corral equivocado está encendido.")
    : t("A board that sorts cats from dogs, running left to right: the CAT half at the back, the DOG half in front, shaded. Each animal rolls along the middle line from the left. Three kickers cross the board, their signs on the back wall: STARTING LEAN, EVERY 10 KG and FLOPPY EARS, each with how much it counts. Each pushes the animal sideways toward DOG or CAT by its share. A divider at the right end sends it into the CAT pen or the DOG pen. An animal in the wrong pen is lit. The strip in front counts RIGHT, ROUND and MISTAKES.",
      "Un tablero que separa gatos de perros, de izquierda a derecha: la mitad GATO al fondo, la mitad PERRO adelante, sombreada. Cada animal rueda por la línea del medio desde la izquierda. Tres empujadores cruzan el tablero, con sus letreros en la pared del fondo: TENDENCIA INICIAL, CADA 10 KG y OREJAS CAÍDAS, cada uno con cuánto cuenta. Cada uno empuja al animal de lado hacia PERRO o GATO según le toque. Un divisor en el extremo derecho lo manda al corral de los gatos o al de los perros. Un animal en el corral equivocado está encendido. La tira de adelante cuenta BIEN, VUELTA y ERRORES.");
  return k.figureSvg({ width: L.width, height, label, body: out, className: `nr-${layout}` });
}

/** Both compositions, for the page: the CSS shows the desk one from 561 px up and the phone one below. */
export const figures = (st = START) => buildFigure(st, "desk") + buildFigure(st, "phone");

export const FIG_CSS = `
.iso-solid:is(.nr-wall,.nr-tally,.nr-rail,.nr-divider)>:is(.iso-fill,.iso-top){fill:color-mix(in srgb,var(--anatomy-mid) 12%,var(--anatomy-page))}
.iso-solid:is(.nr-window,.nr-chip,.nr-tag,.nr-sign,.nr-cart)>:is(.iso-fill,.iso-top){fill:var(--anatomy-face)}
.iso-solid.nr-chip>:is(.iso-fill,.iso-top,.iso-shade){stroke:var(--anatomy-strong)}
.iso-solid:is(.nr-shoe,.nr-arm,.nr-pusher)>:is(.iso-fill,.iso-top){fill:color-mix(in srgb,var(--anatomy-mid) 62%,var(--anatomy-page))}
.iso-solid:is(.nr-shoe,.nr-arm,.nr-pusher)>:is(.iso-fill,.iso-top,.iso-shade){stroke:var(--anatomy-strong)}
.iso-solid.nr-shoe.nr-idle>:is(.iso-fill,.iso-top){fill:var(--anatomy-page)}
.iso-solid.nr-shoe.nr-idle>:is(.iso-fill,.iso-top,.iso-shade){stroke:var(--anatomy-mid)}
path.nr-slot{fill:color-mix(in srgb,var(--anatomy-mid) 30%,var(--anatomy-page));stroke:var(--anatomy-lo);stroke-width:.8}
path.nr-dogside{fill:color-mix(in srgb,var(--anatomy-mid) 16%,var(--anatomy-page));stroke:none}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) path.nr-dogside{fill:color-mix(in srgb,var(--anatomy-mid) 36%,var(--anatomy-page))}}
:root[data-theme=dark] path.nr-dogside{fill:color-mix(in srgb,var(--anatomy-mid) 36%,var(--anatomy-page))}
path.nr-zero{fill:none;stroke:var(--anatomy-strong);stroke-width:1.4}
path.nr-path{fill:none;stroke:var(--anatomy-strong);stroke-width:4;stroke-linecap:round;stroke-linejoin:round}
path.nr-trail{fill:none;stroke:var(--anatomy-mid);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
circle.nr-end{fill:var(--anatomy-mid)}
path.nr-ghost{fill:none;stroke:var(--anatomy-strong);stroke-width:1.6;stroke-dasharray:3 2;stroke-linejoin:round}
path.nr-sil{fill:none;stroke:var(--anatomy-strong);stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}
.wb-lit-group path.nr-sil.nr-on-lit{stroke:var(--anatomy-page)}
.iso-stage[data-neuron]>svg.nr-phone{display:none}
@media (max-width:560px){.iso-stage[data-neuron]>svg.nr-desk{display:none}.iso-stage[data-neuron]>svg.nr-phone{display:block}}
.iso-solid[data-lit-fill]:not([data-lit-outline])>:is(.iso-fill,.iso-top){fill:var(--anatomy-lit)!important}
.iso-solid[data-lit-fill]:not([data-lit-outline])>.iso-shade{fill:color-mix(in srgb,var(--anatomy-lit) 78%,var(--anatomy-page))!important}
`;

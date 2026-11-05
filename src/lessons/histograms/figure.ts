// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A sorting room for request times. Along the back stand three hosts, A, B and C, and a fourth rack, the merged one.
// Each host sorts its finished requests into a row of glass tubes, one tube per latency bucket, and prints its own
// p99 on its front. Every scrape, a slip with each host's bucket counts flies to the merged rack, whose tubes hold
// the sum. The desk in front is the dashboard: the average and the largest of the hosts' p99s, the p99 read off the
// merged tubes, the exact p99 of every request, and the share under the 300 ms objective.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, faceText, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { LAYOUTS, SLO, RATE, WINDOW } from "./sim";
import { fillSvg, heightOf } from "./fill";

export const WIDTH = 700;
export const HEIGHT = 450;

const PLATE = { x: -138, y: -82, w: 276, d: 80, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The back row: three hosts and the merged rack, front faces on one line.
const ROW_Y = -74, ROW_D = 22;
export const FACE_Y = ROW_Y + ROW_D;            // -52
export const CAB_H = 14;
export const RACKS = [
  { key: "A", x: -130, w: 48 },
  { key: "B", x: -76, w: 48 },
  { key: "C", x: -22, w: 48 },
  { key: "M", x: 32, w: 98 },
];
export const TUBE_Y = FACE_Y - 6;               // tube centre line, near the front of each top, over its labels
export const TUBE = { host: { r: 1.9, h: 21, margin: 4.4 }, M: { r: 3.4, h: 25, margin: 6 } };
const tubeSpec = (i) => (i === 3 ? TUBE.M : TUBE.host);
// Tube centres along x for rack i and a bucket layout of n tubes.
export function tubeXs(i, n) {
  const r = RACKS[i], s = tubeSpec(i), x0 = r.x + s.margin, x1 = r.x + r.w - s.margin;
  return Array.from({ length: n }, (_, j) => (n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * j) / (n - 1)));
}
export const TUBE_Z = CAB_H + 1.2;              // the floor of every tube (on a low socket)

// The dashboard desk in front.
const DESK = { x: -130, y: -28, w: 260, d: 18, r: 1.6 };
export const DESK_H = 10;
const DESK_FACE = DESK.y + DESK.d;               // -10
export const SLOTS = ["avg", "max", "est", "under", "exact"];
// Where each desk number comes from, printed on the desk top over its counters: [first slot, slots, words].
const SOURCES = [[0, 2, t("FROM THE HOSTS' P99s", "DE LOS P99 DE LOS HOSTS")], [2, 2, t("FROM THE MERGED BUCKETS", "DE LOS BUCKETS COMBINADOS")], [4, 1, t("FROM EVERY REQUEST", "DE CADA SOLICITUD")]];
const SLOT_W = DESK.w / SLOTS.length;
const slotX = (i) => DESK.x + i * SLOT_W;

// What the counters look like. Host counters sit high on the host faces, clear of the desk in front.
const HOST_COUNTER = { dx: 12, z: 4.6, w: 4.2, h: 5.6, gap: 0.6, count: 4, pad: 1.1 };
const DESK_COUNTER = { dx: 3.4, z: 2.4, w: 4.4, h: 5.8, gap: 0.6, count: 4, pad: 1.1 };
const span = (c) => c.count * c.w + (c.count - 1) * c.gap;
export const CAPTION = 3;                          // the size of every word on the machine (queues uses 2.6)

// Scrape slips rise off the back of each host's top, fly over the tubes and land on the back of the merged rack.
export const SLIP_Z = TUBE_Z + TUBE.host.h + 7;
export const slipFrom = (i) => [RACKS[i].x + RACKS[i].w / 2 - 4, ROW_Y + 3, CAB_H + 0.1];
export const slipTo = (i) => [RACKS[3].x + RACKS[3].w / 2 - 18 + 12 * i, ROW_Y + 3, CAB_H + 0.1];

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [PLATE.x, ROW_Y, SLIP_Z + 8], [PLATE.x + PLATE.w, ROW_Y, SLIP_Z + 8]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 50 },
);

const { S, L, D, at, text } = shorthand(P);
const word = (x, y, z, words, opts = {}) => text(x, y, z, words, { size: CAPTION, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H });
}

// ---------- tubes ----------
// The column of requests in one tube, from the tube floor up to height h. Shared with the live code.
export const fillAt = (cx, r, h, lit) => fillSvg(P, cx, TUBE_Y, TUBE_Z, r, h, lit);
// The glass of one tube: drawn over the fill, as lines (its two sides and both rims).
function glassSvg(cx, s) {
  const { r, h } = s, sides = [];
  // the silhouette lines: the tube's left and right edges on screen
  const a = (50 * Math.PI) / 180, dx = Math.sin(a) * r, dy = -Math.cos(a) * r;
  for (const sgn of [1, -1]) sides.push(k.segment([cx + sgn * dx, TUBE_Y + sgn * dy, TUBE_Z], [cx + sgn * dx, TUBE_Y + sgn * dy, TUBE_Z + h], P));
  return L(sides.join(""), { tone: "lo" }) + L(k.ring(cx, TUBE_Y, r, TUBE_Z + h, P, 20), { tone: "lo" }) + L(k.sideArc(cx, TUBE_Y, r, TUBE_Z, P, 16), { tone: "faint" });
}
// One layout's tubes on rack i: sockets, an empty fill group per tube (the live code draws into it) and glass.
// `first`: the opening frame's summary; its counts fill the shown layout's tubes, so the still frame isn't empty.
function tubeRow(i, layout, shown, first) {
  const n = LAYOUTS[layout].length + 1, s = tubeSpec(i), xs = tubeXs(i, n);
  const counts = shown ? (i < 3 ? first.counts[i] : first.merged) : null, lit = i < 3 ? first.hostBuckets[i] : first.estBucket;
  const out = [`<g data-tubes="${i}" data-layout="${layout}"${shown ? "" : ' style="display:none"'}>`];
  const order = xs.map((x, j) => [x, j]).sort((p, q) => k.depthOf([p[0], TUBE_Y, 0], P) - k.depthOf([q[0], TUBE_Y, 0], P));
  for (const [x, j] of order) {
    out.push(S(k.cylinder(x, TUBE_Y, s.r + 0.7, CAB_H, 1.2, P, 18), { tone: "mid", crease: "none" }));
    out.push(`<g class="wb-lit-group" data-fill="${i}-${j}">${counts ? fillAt(x, s.r, heightOf(counts[j], RATE * WINDOW, s.h), j === lit) : ""}</g>`);
    out.push(glassSvg(x, s));
  }
  out.push(`</g>`);
  return out.join("");
}

// ---------- the back row ----------
function cabinet(i) {
  const r = RACKS[i], plan = { x: r.x, y: ROW_Y, w: r.w, d: ROW_D, r: 1.6 };
  const out = [S(k.slabOf(plan, 0, CAB_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(plan, 1.8), CAB_H, P), { tone: "faint" }));
  return out.join("");
}
function hostFace(i, first) {
  const r = RACKS[i], c = HOST_COUNTER, out = [];
  out.push(text(r.x + 3.4, FACE_Y, 4, r.key, { size: 9, tone: "hi" }));
  out.push(digitCounter(P, { x: r.x + c.dx, y: FACE_Y, z: c.z, count: c.count, w: c.w, h: c.h, gap: c.gap, pad: c.pad, name: "p99-" + i, value: Math.round(first.p99s[i]) }));
  const cx = r.x + c.dx + span(c) + c.pad + 2;
  out.push(word(cx, FACE_Y, 8.4, "P99"), word(cx, FACE_Y, 4.6, "MS"));
  return out.join("");
}
// The merged rack's face: each tube's upper bound under it (per layout), and the rack's name.
function mergedFace() {
  const r = RACKS[3], out = [];
  for (const [layout, edges] of Object.entries(LAYOUTS)) {
    const xs = tubeXs(3, edges.length + 1);
    out.push(`<g data-labels="${layout}"${layout === "fine" ? "" : ' style="display:none"'}>`);
    [...edges.map(String), "+INF"].forEach((label, j) => {
      const lit = edges[j] === SLO;
      if (lit) out.push(litFill(S(k.slabOf({ x: xs[j] - 4.2, y: FACE_Y, w: 8.4, d: 0.6, r: 0.2 }, 8.6, 4.4, P, 2, 0.1), { tone: "hi", crease: "none", lit: true })));
      out.push(word(xs[j], FACE_Y + (lit ? 0.6 : 0), 9.6, label, { anchor: "middle", tone: lit ? "on-lit" : "mid" }));
    });
    out.push(`</g>`);
  }
  out.push(word(r.x + 4, FACE_Y, 3.2, t("MERGED · ≤ MS", "COMBINADO · ≤ MS")));
  return out.join("");
}

// ---------- the dashboard desk ----------
const DESK_WORDS = {
  avg: [t("AVG OF", "PROMEDIO"), t("P99s, MS", "DE P99, MS")],
  max: [t("MAX OF", "MÁXIMO"), t("P99s, MS", "DE P99, MS")],
  est: [t("MERGED", "P99"), t("P99, MS", "COMBINADO")],
  exact: [t("EXACT", "P99"), t("P99, MS", "EXACTO")],
  under: [t("UNDER", "BAJO"), t("300 MS, %", "300 MS, %")],
};
function desk(first) {
  const values = { avg: first.avg, max: first.max, est: first.est, exact: first.exact, under: 1000 * first.underBuckets };
  const out = [S(k.slabOf(DESK, 0, DESK_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(DESK, 2), DESK_H, P), { tone: "faint" }));
  const c = DESK_COUNTER;
  SLOTS.forEach((key, i) => {
    const x = slotX(i) + c.dx;
    out.push(digitCounter(P, { x, y: DESK_FACE, z: c.z, count: c.count, w: c.w, h: c.h, gap: c.gap, pad: c.pad, name: key, value: Math.min(9999, Math.round(values[key])) }));
    if (key === "under") out.push(D([at([x + 3 * c.w + 2 * c.gap + c.gap / 2, DESK_FACE + 0.2, c.z + 0.5])], { size: 1.1, tone: "hi" }));
    const cx = x + span(c) + c.pad + 2;
    out.push(word(cx, DESK_FACE, 5.6, DESK_WORDS[key][0]), word(cx, DESK_FACE, 2.2, DESK_WORDS[key][1]));
  });
  // the sources, on the desk top, with a groove between groups
  const grooves = [];
  for (const [first, n, words] of SOURCES) {
    out.push(word(slotX(first) + 4, DESK.y + DESK.d - 5, DESK_H, words, { face: "top", size: 3.6 }));
    if (first) grooves.push(k.lineOnTop([slotX(first) - 1, DESK.y + 3], [slotX(first) - 1, DESK.y + DESK.d - 3], DESK_H, P));
  }
  out.push(L(grooves.join(""), { tone: "lo" }));
  return out.join("");
}

// ---------- moving parts, drawn at the origin and moved with translateAlong ----------
// A request: a small disc that drops into its tube.
export function chipSvg() {
  return S(k.cylinder(0, 0, 1.6, 0, 0.9, P, 14), { tone: "hi", crease: "none" });
}
// A scrape slip: a lit tag lying flat, with the host's letter on it.
export function slipSvg() {
  const plan = { x: 0, y: 0, w: 8, d: 6, r: 0.6 };
  return `<g class="wb-lit-group">${litFill(S(k.slabOf(plan, 0, 0.8, P, 3, 0.2), { tone: "hi", crease: "lo", lit: true }))}`
    + faceText(P, [4, 4.6, 0.8], "A", { face: "top", size: 4.2, tone: "on-lit", anchor: "middle", attr: "data-slip-key" }) + `</g>`;
}

export function buildFigure(first) {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A sorting room for request times on a base plate. Along the back stand three hosts, A, B and C, and a wider merged rack. Each host has a row of glass tubes on top, one per latency bucket, and finished requests drop into the tube for their time; the tube holding the host's 99th percentile is lit, and a counter on the host's front shows its p99 in milliseconds. Every scrape, a lit slip flies from each host to the merged rack, whose tubes hold the sum of all three, with each tube's upper bound printed under it. A desk in front shows five counters: the average and the largest of the three hosts' p99s, the p99 read off the merged tubes, the exact p99 of every request, and the share of requests under 300 milliseconds.",
      "Una sala de clasificación de tiempos sobre una placa base. Al fondo hay tres hosts, A, B y C, y un estante combinado más ancho. Cada host tiene una fila de tubos de vidrio arriba, uno por bucket de latencia, y las solicitudes terminadas caen en el tubo de su tiempo; el tubo que contiene el percentil 99 del host está iluminado, y un contador en el frente del host muestra su p99 en milisegundos. En cada recolección, una ficha iluminada vuela de cada host al estante combinado, cuyos tubos tienen la suma de los tres, con el límite superior de cada tubo impreso debajo. Un escritorio adelante muestra cinco contadores: el promedio y el máximo de los p99 de los tres hosts, el p99 leído de los tubos combinados, el p99 exacto de todas las solicitudes y la proporción de solicitudes por debajo de 300 milisegundos.",
    ),
    body: [
      plate(),
      RACKS.map((_, i) => cabinet(i)).join(""),
      `<g data-layer="slips"></g>`,
      `<g data-layer="chips"></g>`,
      RACKS.map((_, i) => Object.keys(LAYOUTS).map((layout) => tubeRow(i, layout, layout === "fine", first)).join("")).join(""),
      [0, 1, 2].map((i) => hostFace(i, first)).join(""),
      mergedFace(),
      desk(first),
    ],
  });
}

export const GEOMETRY = {
  RACKS, TUBE_Y, TUBE_Z, TUBE, FACE_Y, SLIP_FROM: [0, 1, 2].map(slipFrom), SLIP_TO: [0, 1, 2].map(slipTo), SLIP_PEAK: SLIP_Z,
  XS: Object.fromEntries(Object.entries(LAYOUTS).map(([name, edges]) => [name, RACKS.map((_, i) => tubeXs(i, edges.length + 1))])),
};

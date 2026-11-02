// A timing hall for request latency.
//   Left: a fan-out rig. The front desk (one user request) calls ten backend towers over a bus on the floor and can
//         only answer when the last one is back; a tower's lamp stays lit while its call is out, so a stalled call is
//         the lamp that stays on. At a fan-out of 100 each tower stands for ten calls.
//   Right: a histogram on a console. Finished requests drop as chips into ten bins along a log scale of time
//         (5 ms to 2 s); column heights are on a log scale too, so a 1% tail still shows. Under the bins, a slide
//         rule: four pointers ride their own tracks to the mean, p50, p95 and p99. The p99 pointer is the lit one.
//   Front: the readout console: mean, p50 and p99 in ms, and the share of requests over 100 ms.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../workbench/kit.mjs";
import { basePlate, rulerStrip, digitCounter, faceText, lamp } from "../../workbench/parts.mjs";
import { t } from "../../workbench/i18n.mjs";
import { EDGES } from "./sim.js";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -134, y: -66, w: 268, d: 102, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// ---------- fan-out rig ----------
export const DISP = { x: -128, y: -8, w: 36, d: 18, r: 1.6 };
export const DISP_H = 12;
const BUS = { x: -126, y: -27, w: 76, d: 3, r: 0.8 };
export const TOWER = { w: 9, d: 9, h: 16 };
// Five front towers, five back towers set between them so their feeds pass through the gaps.
export const TOWERS = Array.from({ length: 10 }, (_, i) => {
  const row = i % 2, j = Math.floor(i / 2);
  const x = (row ? -117 : -124) + j * 14, y = row ? -56 : -41;
  return { x, y, cx: x + TOWER.w / 2, cy: y + TOWER.d / 2, front: y + TOWER.d };
});
export const TOKEN_SPOT = [DISP.x + 24, DISP.y + 8, DISP_H];

// ---------- histogram console ----------
export const BINS = EDGES.length - 1;              // 10
export const BW = 14;                            // bin width
export const BX0 = -12;                            // left edge of bin 0
const PANEL = { x: BX0 - 3, y: -60, w: BINS * BW + 6, d: 24, r: 1.2 };
export const PANEL_H = 32;                         // the console's front face holds the slide rule
const FACE_Y = PANEL.y + PANEL.d;                  // front face of the console
export const TRACK_Z = [2, 8, 14, 20];             // slide-rule tracks, bottom to top
export const TRACK_H = 5;
export const TRAY_Z = PANEL_H + 1.2;               // floor of the bins
export const COL_MAX = 30;                         // tallest column
export const COL = { y: PANEL.y + 6, d: PANEL.d - 12, inset: 2 };
export const binX = (i) => BX0 + i * BW;
export const posX = (pos) => BX0 + pos * BW;
export const POINTER_W = 12;
export const POINTERS = [
  { key: "mean", track: 0, label: t("MEAN", "MEDIA") },
  { key: "p50", track: 1, label: "P50" },
  { key: "p95", track: 2, label: "P95" },
  { key: "p99", track: 3, label: "P99", lit: true },
];

// ---------- readout console ----------
const DESK = { x: -8, y: 2, w: 128, d: 18, r: 1.6 };
const DESK_H = 12;
export const COUNTERS = {
  mean: { x: -3, y: DESK.y + DESK.d, z: 1.6, w: 5, h: 6, gap: 0.6, count: 4, size: "s" },
  p50: { x: 30, y: DESK.y + DESK.d, z: 1.6, w: 5, h: 6, gap: 0.6, count: 4, size: "s" },
  p99: { x: 63, y: DESK.y + DESK.d, z: 1.6, w: 5, h: 6, gap: 0.6, count: 4, size: "s" },
  slow: { x: 96, y: DESK.y + DESK.d, z: 1.6, w: 5, h: 6, gap: 0.6, count: 3, size: "s" },
  out: { x: DISP.x + 3, y: DISP.y + DISP.d, z: 1.6, w: 4.6, h: 5.2, gap: 0.6, count: 3, size: "s" },
};

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [PANEL.x, PANEL.y, TRAY_Z + COL_MAX + 4], [PANEL.x + PANEL.w, PANEL.y, TRAY_Z + COL_MAX + 4], [TOWERS[1].x, TOWERS[1].y, TOWER.h + 8]],
  WIDTH, HEIGHT, { pad: 18, azimuth: 50 },
);

const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const text = (x, y, z, value, opts) => faceText(P, [x, y, z], value, opts);

// A column of a histogram bin: a slab from the bin floor up to height h. Shared with the live script.
export function columnSvg(i, h, lit) {
  if (h < 0.4) return "";
  return S(k.slabOf({ x: binX(i) + COL.inset, y: COL.y, w: BW - 2 * COL.inset, d: COL.d, r: 0.6 }, TRAY_Z, h, P, 2, 0.2), { tone: "hi", crease: "lo", lit });
}
// Height of a column holding `count` of `total` requests: log scale, so one request in a thousand is still visible.
export function heightOf(count, total) {
  if (!count) return 0;
  return Math.max(1, COL_MAX * Math.log10(1 + count) / Math.log10(1 + total));
}

// A chip: one finished request on its way into a bin.
export function chipSvg(lit) {
  return S(k.slabOf({ x: -3.5, y: -3.5, w: 7, d: 7, r: 0.8 }, 0, 1.6, P, 2, 0.2), { tone: "hi", crease: "lo", lit });
}

// A slide-rule pointer: an upright card on the console's face, a notch pointing down at its value.
function pointerSvg(p) {
  const z0 = TRACK_Z[p.track], w = POINTER_W;
  const plan = { x: -w / 2, y: FACE_Y, w, d: 1.2, r: 0.3 };
  const out = [S(k.slabOf(plan, z0 + 0.2, TRACK_H - 0.4, P, 2, 0.2), { tone: "hi", crease: "lo", lit: !!p.lit })];
  out.push(Ln(k.segment([0, FACE_Y + 1.2, z0 + 0.2], [0, FACE_Y + 1.2, z0 - 0.6], P), { tone: p.lit ? "lit" : "mid" }));
  out.push(text(0, FACE_Y + 1.2, z0 + 1.15, p.label, { size: 2.6, tone: p.lit ? "on-lit" : "hi", anchor: "middle" }));
  return out.join("");
}

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H }) + rulerStrip(P, { x: -126, y: 22, w: 64, d: 6, r: 1 });
}

function rig(first) {
  const out = [];
  // The bus on the floor, the desk's feed to it, and each tower's feed off it.
  out.push(S(k.slabOf(BUS, 0, 1.6, P, 2, 0.2), { tone: "mid", crease: "none" }));
  const feeds = [k.segment([DISP.x + 10, DISP.y, 0.2], [DISP.x + 10, BUS.y + BUS.d, 0.2], P)];
  TOWERS.forEach((tw) => feeds.push(k.segment([tw.cx, BUS.y, 0.2], [tw.cx, tw.front, 0.2], P)));
  out.push(Ln(feeds.join(""), { tone: "lo" }));
  // Towers back to front, so the front row covers the back row.
  const order = [...TOWERS.keys()].sort((a, b) => TOWERS[a].y - TOWERS[b].y || TOWERS[a].x - TOWERS[b].x);
  for (const i of order) {
    const tw = TOWERS[i];
    out.push(`<g data-tower="${i}">`);
    out.push(S(k.slabOf({ x: tw.x, y: tw.y, w: TOWER.w, d: TOWER.d, r: 0.8 }, 0, TOWER.h, P, 3, 0.3), { tone: "mid" }));
    const slots = [];
    for (const z of [5, 8, 11]) slots.push(k.segment([tw.x + 2, tw.front, z], [tw.x + TOWER.w - 2, tw.front, z], P));
    out.push(Ln(slots.join(""), { tone: "lo" }));
    out.push(text(tw.cx, tw.front, 1.2, String(i + 1), { size: 2.4, tone: "mid", anchor: "middle" }));
    const lampAt = [tw.cx, tw.cy, TOWER.h];
    out.push(`<g data-lamp="${i}-off"${first.lit.includes(i) ? ' style="display:none"' : ""}>${lamp(P, lampAt, { r: 1.7 })}</g>`);
    out.push(`<g data-lamp="${i}-on"${first.lit.includes(i) ? "" : ' style="display:none"'}>${lamp(P, lampAt, { r: 1.7, lit: true })}</g>`);
    out.push(`<g data-gc="${i}" style="display:none">${S(k.slabOf({ x: tw.x + 1.5, y: tw.front, w: TOWER.w - 3, d: 0.8, r: 0.2 }, 6.6, 4.6, P, 2, 0.1), { tone: "hi", crease: "lo", lit: true })}${text(tw.cx, tw.front + 0.8, 7.7, "GC", { size: 2.4, tone: "on-lit", anchor: "middle" })}</g>`);
    out.push(`</g>`);
  }
  // At a fan-out of 100, a plaque says each tower stands for ten calls.
  out.push(`<g data-each${first.fanout === 100 ? "" : ' style="display:none"'}>${S(k.slabOf({ x: -84, y: -21, w: 26, d: 6, r: 0.6 }, 0, 0.8, P, 2, 0.2), { tone: "hi", crease: "lo" })}${faceText(P, [-71, -16.9, 0.8], t("EACH ×10", "CADA ×10"), { face: "top", size: 2.4, tone: "hi", anchor: "middle" })}</g>`);
  // The front desk: one user request, waiting on its calls.
  out.push(S(k.slabOf(DISP, 0, DISP_H, P, 4, 0.5), { tone: "mid" }));
  const fy = DISP.y + DISP.d;
  out.push(text(DISP.x + 3, fy, 8.4, t("REQUEST", "SOLICITUD"), { size: 2.6, tone: "mid" }));
  out.push(text(DISP.x + 19.5, fy, 3, t("CALLS OUT", "PENDIENTES"), { size: 2, tone: "mid" }));
  out.push(digitCounter(P, { ...COUNTERS.out, housing: false, name: "out", value: first.out }));
  out.push(`<g class="wb-lit-group" data-token transform="${k.translateAlong(P, TOKEN_SPOT)}"${first.token ? "" : ' style="display:none"'}>${chipSvg(false)}</g>`);
  return out.join("");
}

function histogram(first) {
  const out = [];
  out.push(S(k.slabOf(PANEL, 0, PANEL_H, P, 4, 0.5), { tone: "mid" }));
  // The bin tray on top: a floor and dividers.
  out.push(S(k.slabOf({ x: PANEL.x, y: PANEL.y, w: PANEL.w, d: PANEL.d, r: 1.2 }, PANEL_H, 1.2, P, 3, 0.3), { tone: "mid" }));
  const div = [];
  for (let i = 1; i < BINS; i++) div.push(k.segment([binX(i), PANEL.y + 1.5, TRAY_Z], [binX(i), PANEL.y + PANEL.d - 1.5, TRAY_Z], P));
  out.push(Ln(div.join(""), { tone: "lo" }));
  // Columns (redrawn live).
  out.push(`<g data-cols>${first.heights.map((h, i) => `<g class="wb-lit-group" data-col="${i}">${columnSvg(i, h, i >= 5)}</g>`).join("")}</g>`);
  // Falling chips are drawn into this layer.
  out.push(`<g data-chips></g>`);
  // The slide rule: four tracks, the bin edges printed above them, a tick at every edge.
  const tracks = [], ticks = [];
  for (const z of TRACK_Z) tracks.push(k.faceRectY(P, BX0, binX(BINS), FACE_Y, z, z + TRACK_H));
  out.push(Ln(tracks.join(""), { tone: "faint" }));
  for (let i = 0; i <= BINS; i++) ticks.push(k.segment([binX(i), FACE_Y, TRACK_Z[3] + TRACK_H], [binX(i), FACE_Y, TRACK_Z[3] + TRACK_H + 1.4], P));
  out.push(Ln(ticks.join(""), { tone: "lo" }));
  const edgeLabel = (ms) => (ms >= 1000 ? ms / 1000 + "s" : String(ms));
  for (let i = 1; i < BINS; i++) out.push(text(binX(i), FACE_Y, TRACK_Z[3] + TRACK_H + 2, edgeLabel(EDGES[i]), { size: 2.6, tone: "mid", anchor: "middle" }));
  out.push(text(BX0 + 1, FACE_Y, TRACK_Z[3] + TRACK_H + 2, "ms", { size: 2.6, tone: "lo" }));
  for (const p of POINTERS) out.push(`<g class="wb-lit-group" data-pointer="${p.key}" transform="${k.translateAlong(P, [posX(first.pos[p.key]), 0, 0])}">${pointerSvg(p)}</g>`);
  return out.join("");
}

function readouts(first) {
  const out = [S(k.slabOf(DESK, 0, DESK_H, P, 4, 0.5), { tone: "mid" })];
  const fy = DESK.y + DESK.d;
  const labels = { mean: t("MEAN, ms", "MEDIA, ms"), p50: "P50, ms", p99: "P99, ms", slow: t("> 100 ms, %", "> 100 ms, %") };
  for (const key of ["mean", "p50", "p99", "slow"]) {
    const c = COUNTERS[key];
    out.push(text(c.x, fy, 9, labels[key], { size: 2.3, tone: "mid" }));
    out.push(digitCounter(P, { ...c, housing: false, name: key, value: first.counts[key] }));
  }
  return out.join("");
}

export function buildFigure(first) {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A timing hall on one base plate. Left: a front desk for one user request, wired over a bus on the floor to ten numbered backend towers, each with a lamp that stays lit while its call is out; a counter on the desk shows calls still out. Right: a console with ten bins on top, a histogram of request times from under 5 ms to over 2 s on a log scale, with columns whose height shows how many requests landed in each bin. On the console's front, a slide rule with four pointers for the mean, p50, p95 and p99; the p99 pointer is lit. In front, a readout desk with counters for the mean, p50 and p99 in milliseconds and the share of requests over 100 ms.",
      "Una sala de tiempos sobre una placa base. A la izquierda, un mostrador para una solicitud de usuario, conectado por un bus en el piso a diez torres de backend numeradas, cada una con una lámpara que queda encendida mientras su llamada está pendiente; un contador en el mostrador muestra las llamadas pendientes. A la derecha, una consola con diez cajones arriba, un histograma de tiempos de respuesta desde menos de 5 ms hasta más de 2 s en escala logarítmica, con columnas cuya altura muestra cuántas solicitudes cayeron en cada cajón. En el frente de la consola, una regla de cálculo con cuatro punteros para la media, el p50, el p95 y el p99; el puntero del p99 está encendido. Adelante, un tablero con contadores para la media, el p50 y el p99 en milisegundos y la proporción de solicitudes de más de 100 ms.",
    ),
    body: [plate(), rig(first), histogram(first), readouts(first)],
  });
}
export const GEOMETRY = { BX0, BW, BINS, TRAY_Z, COL_MAX, TOKEN_SPOT, TOWERS: TOWERS.map((t) => [t.cx, t.cy]), TOWER_H: TOWER.h, PANEL_Y: PANEL.y, PANEL_D: PANEL.d };

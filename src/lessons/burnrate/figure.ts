// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// An error-budget tank between two alarms, in one row. On the left, the static alarm: a chart recorder that plots the
// error rate over the last 5 minutes for the last day against its 1% line, with a lamp, a 24-hour clock and counters
// for pages and the day. In the middle, the error budget: a glass tank that every failed request drains through the
// spout. On the right, the burn-rate console: three tiers (14.4× over 1 h, 6× over 6 h, 1× over 3 days), each with a
// meter for its long window, one for its short window and a beacon on top; counters for pages and tickets. At the
// right end stands the engineer on call, lit while a page is open.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate, digitCounter, person, meter, dial, lamp, faceText, litFill, variants } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { waterSvg } from "./water";

export const WIDTH = 700;
export const HEIGHT = 420;

const PLATE = { x: -114, y: -54, w: 234, d: 46, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// ---------- the recorder (the static alarm) ----------
const REC = { x: -108, y: -46, w: 72, d: 18, r: 1.5 };
const REC_H = 40.5;
const REC_FACE = REC.y + REC.d;
export const CHART = { x0: -103, x1: -48, z0: 14.2, z1: 27.2, y: REC_FACE + 0.9, max: 0.02, hours: 24 };
export const REC_LAMP = [REC.x + REC.w - 7, REC.y + REC.d - 5, REC_H];
export const CLOCK = { x: REC.x + REC.w - 22, y: REC.y + REC.d / 2, z: REC_H, r: 6.2 };

// ---------- the tank (the error budget) ----------
const TPL = { x: -32, y: -50, w: 48, d: 30, r: 1.5 };
const TPL_H = 9;
export const GLASS = { x: -24, y: -46, w: 32, d: 22, z0: TPL_H, z1: TPL_H + 40 };
export const SPOUT = [TPL.x + 4.6, TPL.y + TPL.d + 3.4, 5.2];
export const DRAIN = { x: SPOUT[0] - 5, y: TPL.y + TPL.d + 0.6, w: 10, d: 8 };

// ---------- the burn-rate console ----------
const CON = { x: 20, y: -46, w: 86, d: 18, r: 1.5 };
const CON_H = 38;
export const CON_FACE = CON.y + CON.d;
export const COLS = [CON.x + 16, CON.x + 43, CON.x + 70];   // x of each tier's column
export const METER = { r: 5.8, long: 19.8, short: 11.2, dx: -4.6 };

// ---------- the engineer on call, at the right end ----------
export const ENGINEER = [CON.x + CON.w + 7.5, CON.y + CON.d / 2 + 2, 0];

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners({ x: GLASS.x, y: GLASS.y, w: GLASS.w, d: GLASS.d }, 0, GLASS.z1 + 1), [CON.x, CON.y, CON_H + 8], [REC.x, REC.y, REC_H + 2]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 50 },
);

const { S, L, D, seg } = shorthand(P);
const text = (x, y, z, words, size = 2.8, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -100, y: -20, w: 52, d: 6, r: 1 })
    + labelPlate(P, { x: 42, y: -22, w: 34, d: 10, r: 1.4 }, [[46, -18.6, 24], [46, -15, 16]]);
}

// A counter with its word after it, clear of the housing (pad 1 on each side).
const W = 4.2, GAP = 0.6;
function counterWord(x, y, z, name, count, words, size = 2.8) {
  const span = count * W + (count - 1) * GAP;
  return digitCounter(P, { x, y, z, count, w: W, h: 5.4, gap: GAP, pad: 1, name }) + text(x + span + 3, y, z + 1.4, words, size);
}

// A lamp that lights while its alarm fires: two drawings, switched with WB.pose.
const beacon = (name, at, r) => variants(name, { off: lamp(P, at, { r }), on: litFill(lamp(P, at, { r, lit: true })) }, "off");

// ---------- the recorder ----------
function recorder() {
  const out = [S(k.slabOf(REC, 0, REC_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(REC, 2.2), REC_H, P), { tone: "faint" }));
  const f = REC_FACE, c = CHART;
  // the paper: a raised sheet on the front face, with a grid; the 1% line dashed
  out.push(S(k.slabOf({ x: c.x0 - 1.4, y: f, w: c.x1 - c.x0 + 2.8, d: 0.9, r: 0.3 }, c.z0 - 1.4, c.z1 - c.z0 + 2.8, P, 2), { tone: "hi", crease: "none" }));
  const zOf = (share) => c.z0 + (c.z1 - c.z0) * share / c.max;
  const grid = [];
  for (const share of [0.005, 0.015]) grid.push(seg([c.x0, c.y, zOf(share)], [c.x1, c.y, zOf(share)]));
  for (let h = 6; h < c.hours; h += 6) { const x = c.x0 + (c.x1 - c.x0) * h / c.hours; grid.push(seg([x, c.y, c.z0], [x, c.y, c.z1])); }
  out.push(L(grid.join(""), { tone: "faint" }));
  out.push(L(seg([c.x0, c.y, zOf(0.01)], [c.x1, c.y, zOf(0.01)]), { tone: "mid", dashed: true }));
  out.push(L(seg([c.x0, c.y, c.z0], [c.x1, c.y, c.z0]), { tone: "lo" }));
  out.push(text(c.x1 + 2.2, f, zOf(0.01) - 1, "1%", 2.8));
  out.push(text(c.x1 + 2.2, f, c.z0 - 1, "0", 2.8));
  out.push(`<path class="br-trace" data-trace d=""/>`);
  out.push(text(c.x0 - 1, f, REC_H - 4.2, t("STATIC ALARM", "ALARMA FIJA"), 3.2, { tone: "hi" }));
  out.push(text(c.x0 - 1, f, c.z1 + 4.4, t("5-MIN RATE · LAST 24 H", "TASA 5 MIN · ÚLTIMAS 24 H"), 2.8));
  out.push(counterWord(c.x0, f, 2.2, "staticPages", 3, t("PAGES", "AVISOS")));
  out.push(counterWord(c.x1 - 17, f, 2.2, "day", 2, t("DAY", "DÍA")));
  return out.join("");
}
function recorderTop() {
  return dial(P, { x: CLOCK.x, y: CLOCK.y, z: REC_H, r: CLOCK.r, h: 3, ticks: 24, every: 6, name: "clock", value: 0 })
    + beacon("lamp-static", REC_LAMP, 3);
}

// ---------- the tank ----------
function tankBack() {
  const out = [S(k.slabOf(TPL, 0, TPL_H, P, 3, 0.5), { tone: "mid" })];
  const g = GLASS;
  // the glass: floor, back edges and the back posts, drawn before the water
  out.push(L(k.planOutline({ x: g.x, y: g.y, w: g.w, d: g.d, r: 0 }, g.z0 + 0.1, P), { tone: "lo" }));
  out.push(L(seg([g.x, g.y, g.z0], [g.x, g.y, g.z1]) + seg([g.x + g.w, g.y, g.z0], [g.x + g.w, g.y, g.z1]) + seg([g.x, g.y + g.d, g.z0], [g.x, g.y + g.d, g.z1]), { tone: "faint" }));
  // the counter: budget left, in percent
  const front = TPL.y + TPL.d;
  out.push(digitCounter(P, { x: TPL.x + 10, y: front, z: 1.8, count: 3, w: W, h: 5.4, gap: GAP, pad: 1, name: "left" }));
  out.push(text(TPL.x + 10 + 13.8 + 3, front, 4.6, t("BUDGET", "PRESUPUESTO"), 2.8));
  out.push(text(TPL.x + 10 + 13.8 + 3, front, 1.4, t("LEFT %", "QUEDA %"), 2.8));
  return out.join("");
}
function tankFront() {
  const g = GLASS, out = [];
  out.push(L(seg([g.x + g.w, g.y + g.d, g.z0], [g.x + g.w, g.y + g.d, g.z1]), { tone: "lo" }));
  out.push(L(k.planOutline({ x: g.x, y: g.y, w: g.w, d: g.d, r: 0 }, g.z1, P), { tone: "lo" }));
  out.push(L(seg([g.x, g.y + g.d, g.z0], [g.x + g.w, g.y + g.d, g.z0]) + seg([g.x + g.w, g.y, g.z0], [g.x + g.w, g.y + g.d, g.z0]), { tone: "lo" }));
  // level marks on the front glass: every quarter of the budget
  const marks = [];
  for (let q = 1; q < 4; q++) { const z = g.z0 + (g.z1 - g.z0) * q / 4; marks.push(seg([g.x, g.y + g.d, z], [g.x + 4, g.y + g.d, z])); }
  out.push(L(marks.join(""), { tone: "mid" }));
  // the rim: an open frame round the top
  out.push(L(k.planOutline({ x: g.x - 1, y: g.y - 1, w: g.w + 2, d: g.d + 2, r: 0.6 }, g.z1, P), { tone: "mid" }));
  // the spout on the plinth front
  out.push(S(k.slabOf({ x: SPOUT[0] - 1.6, y: TPL.y + TPL.d, w: 3.2, d: 4, r: 0.6 }, SPOUT[2], 2.4, P, 2), { tone: "hi", crease: "lo" }));
  return out.join("");
}
function drain() {
  const d = DRAIN;
  const out = [S(k.slabOf({ ...d, r: 1 }, 0, 0.8, P, 3), { tone: "lo", crease: "none" })];
  const bars = [];
  for (let x = d.x + 2; x < d.x + d.w - 1; x += 2) bars.push(k.lineOnTop([x, d.y + 1.6], [x, d.y + d.d - 1.6], 0.8, P));
  out.push(L(bars.join(""), { tone: "mid" }));
  return out.join("");
}
// ---------- the console ----------
const BURNS = ["14.4×", "6×", "1×"];
const KIND = [t("PAGE", "AVISO"), t("PAGE", "AVISO"), t("TICKET", "TICKET")];
const WINDOWS = [["1 H", "5 MIN"], ["6 H", "30 MIN"], ["3 D", "6 H"]];
function consoleBody() {
  const out = [S(k.slabOf(CON, 0, CON_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(CON, 2.2), CON_H, P), { tone: "faint" }));
  const f = CON_FACE;
  out.push(text(CON.x + 3, f, CON_H - 4, t("BURN-RATE ALARM", "ALARMA DE TASA DE CONSUMO"), 3.2, { tone: "hi" }));
  COLS.forEach((x, i) => {
    out.push(L(k.faceRectY(P, x - 12.8, x + 12.8, f, 10.4, CON_H - 6.4), { tone: "faint" }));
    out.push(text(x - 11.4, f, CON_H - 11, BURNS[i], 3.4, { tone: "hi" }));
    out.push(text(x + 11.4, f, CON_H - 11, KIND[i], 2.8, { anchor: "end" }));
    const mx = x + METER.dx;
    out.push(meter(P, { x: mx, y: f, z: METER.long, r: METER.r, ticks: 8, zone: 0.5, name: "long" + i, value: 0 }));
    out.push(meter(P, { x: mx, y: f, z: METER.short, r: METER.r, ticks: 8, zone: 0.5, name: "short" + i, value: 0 }));
    out.push(text(mx + METER.r + 1.8, f, METER.long + 0.4, WINDOWS[i][0], 2.8));
    out.push(text(mx + METER.r + 1.8, f, METER.short + 0.4, WINDOWS[i][1], 2.8));
  });
  // pages under the two paging tiers, tickets under the third
  out.push(counterWord(COLS[0] - 12, f, 2.2, "pages", 2, t("PAGES", "AVISOS")));
  out.push(counterWord(COLS[2] - 12, f, 2.2, "tickets", 2, t("TICKETS", "TICKETS")));
  return out.join("");
}
// A beacon over each tier, lit while that tier fires.
function consoleTop() {
  return COLS.map((x, i) => beacon("lamp-tier" + i, [x, CON.y + CON.d - 5, CON_H], 2.6)).join("");
}

// The engineer on call, holding the pager: lit while a page is open.
function engineer() {
  const at = { scale: 1.05, hat: "cap", holding: "slip" };
  return variants("engineer", { idle: person(P, ENGINEER, at), paged: litFill(person(P, ENGINEER, { ...at, lit: true })) }, "idle");
}

const LABEL = t(
  "An error-budget tank between two alarms, in a row on a base plate. On the left, the static alarm: a chart recorder plots the error rate over the last 5 minutes across the last 24 hours, with a dashed line at 1%; its lamp lights and its counter adds a page whenever the line is crossed, and a clock and a day counter keep the time. In the middle, a glass tank holds the error budget, the 0.1% of requests the SLO lets fail in 30 days; every failure drains it through a spout into a drain, and a counter shows the share left. On the right, the burn-rate console: three tiers, 14.4 times over 1 hour, 6 times over 6 hours and 1 time over 3 days, each with a meter for its long window and one for its short window, and a beacon that lights while both are past the line; the first two page, the third opens a ticket, and counters add them up. At the right end stands the engineer on call, who lights up while a page is open.",
  "Un tanque de presupuesto de errores entre dos alarmas, en fila sobre una placa base. A la izquierda, la alarma fija: un registrador grafica la tasa de error de los últimos 5 minutos durante las últimas 24 horas, con una línea punteada en 1%; su lámpara se enciende y su contador suma un aviso cada vez que se cruza la línea, y un reloj y un contador de días marcan el tiempo. En el medio, un tanque de vidrio guarda el presupuesto de errores, el 0.1% de las solicitudes que el SLO deja fallar en 30 días; cada fallo lo vacía por un pico hacia un desagüe, y un contador muestra la parte que queda. A la derecha, la consola de tasa de consumo: tres niveles, 14.4 veces en 1 hora, 6 veces en 6 horas y 1 vez en 3 días, cada uno con un medidor para su ventana larga y otro para su ventana corta, y una baliza que se enciende mientras los dos pasan la línea; los dos primeros avisan a la guardia, el tercero abre un ticket, y unos contadores los suman. En el extremo derecho está la persona de guardia, que se enciende mientras hay un aviso abierto.",
);

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: LABEL,
    body: [
      plate(),
      recorder(),
      recorderTop(),
      tankBack(),
      `<g data-water>${waterSvg(P, GLASS, 1)}</g>`,
      tankFront(),
      drain(),
      `<g data-layer="drops"></g>`,
      consoleBody(),
      consoleTop(),
      engineer(),
    ],
  });
}

export const GEOMETRY = { CHART, SPOUT, DRAIN, GLASS, COLS };

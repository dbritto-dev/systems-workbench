// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A relay track. The browser's inbox bench is at the near end, the server at the far end, and one lane between them
// per request the page can make. A request is a runner: it waits at the start line until the page asks for it, runs
// to the server, waits there while the service works, and runs back with a crate of data, which lands on the bench.
// The next runner often can't leave until a crate is in: that wait is the waterfall. Behind the track, the chart board
// draws every request as a bar against time (the waterfall itself), and the page screen fills in as the data lands.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate, digitCounter, figurine, lamp, faceText, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { LANES, NAMES } from "./sim";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -152, y: -100, w: 278, d: 136, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The track: one lane per request, back to front in LANES order.
export const LANE_Y = LANES.map((_, i) => -60 + i * 7.5);
const LANE = { x0: -102, x1: 36, half: 2.6 };
export const RUN = { server: -97, start: 33 };          // where a runner stands at each end

// The server at the far end: a block with one service on top per kind of request.
const SERVER = { x: -144, y: -64, w: 38, d: 60, r: 2 };
const SERVER_H = 20;
export const SERVICES = ["cdn", "user", "posts", "notifs", "comments"];
const SVC = { x: -140, w: 16, d: 10.6, h: 7, y0: -62.5, dy: 11.6 };
const svcPlan = (i) => ({ x: SVC.x, y: SVC.y0 + i * SVC.dy, w: SVC.w, d: SVC.d, r: 1 });

// The browser's inbox bench at the near end: a slot per lane, where the crates land.
const BENCH = { x: 40, y: -64, w: 46, d: 67, r: 2 };
export const BENCH_H = 5;
export const CRATE_X = 78;

// Behind the track: the chart board (the waterfall) and the page screen, side by side.
const WALL_Y = -84, WALL_D = 4;
export const FACE_Y = WALL_Y + WALL_D;
const BOARD = { x0: -106, x1: 38, z0: 8, z1: 64 };
export const CHART = { x0: -78, x1: 34, top: 60, rowH: 4.8, axis: 14.8, label: 10.8, labelX: -102 };
export const ROWS = [...LANES, "cpu"];
const SCREEN = { x0: 44, x1: 122, z0: 8, z1: 64 };

// Page parts on the screen, as rectangles on its face: [x0, x1, z0, z1].
export const PAGE = {
  user: [[50, 116, 48, 53.5]],
  posts: [0, 1, 2].map((i) => [50, 91, 39.5 - i * 11.6, 45 - i * 11.6]),
  comments: [0, 1, 2].map((i) => [53, 91, 35.2 - i * 11.6, 38.4 - i * 11.6]),
  notifs: [0, 1, 2, 3, 4].map((i) => [95, 116, 41.2 - i * 6.4, 45 - i * 6.4]),
};

// The console in front: elapsed time and how the requests line up.
const CONSOLE = { x: -100, y: 17, w: 134, d: 10, r: 1.6 };
const CONSOLE_H = 7.5;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [BOARD.x0, WALL_Y, BOARD.z1 + 1], [SCREEN.x1, WALL_Y, SCREEN.z1 + 1], [SCREEN.x1, WALL_Y + WALL_D, SCREEN.z1 + 1]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

const { S, L, D, at } = shorthand(P);
const slab = (plan, z, h, steps = 3, bevel = 0) => k.slabOf({ r: 0.4, ...plan }, z, h, P, steps, bevel);
const text = (x, y, z, words, size = 2.4, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });
const face = (x0, x1, z0, z1) => k.faceRectY(P, x0, x1, FACE_Y + 0.05, z0, z1);
export const rowZ = (i) => CHART.top - (i + 1) * CHART.rowH;     // bottom of row i

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + labelPlate(P, { x: 90, y: 16, w: 26, d: 13, r: 1.4 }, [[94, 21, 16], [94, 25, 10]]);
}

// ---------- the back wall: chart board and page screen ----------
function board() {
  const out = [S(k.slabOf({ x: BOARD.x0, y: WALL_Y, w: BOARD.x1 - BOARD.x0, d: WALL_D, r: 1 }, BOARD.z0, BOARD.z1 - BOARD.z0, P, 3, 0.4), { tone: "mid" })];
  out.push(`<path class="wf-panel" d="${face(BOARD.x0 + 2, BOARD.x1 - 2, BOARD.z0 + 2, BOARD.z1 - 2)}"/>`);
  // row rules and labels
  const rules = [];
  ROWS.forEach((name, i) => {
    const z = rowZ(i);
    rules.push(k.pathOf([at([CHART.x0, FACE_Y + 0.05, z]), at([CHART.x1, FACE_Y + 0.05, z])]));
    const label = name === "cpu" ? t("MAIN THREAD", "HILO PRINCIPAL") : NAMES[name];
    out.push(faceText(P, [CHART.x0 - 1.6, FACE_Y + 0.05, z + 1.3], label, { size: 2.3, tone: name === "cpu" ? "mid" : "hi", anchor: "end" }));
  });
  out.push(L(rules.join(""), { tone: "faint" }));
  out.push(L(k.pathOf([at([CHART.x0, FACE_Y + 0.05, CHART.axis]), at([CHART.x0, FACE_Y + 0.05, CHART.top + 0.4])]), { tone: "lo" }));
  // live layers: ghost bars (the previous setup), bars, server-side calls, the axis and the now line
  out.push(`<path class="wf-ghost" data-ghost d=""/>`);
  out.push(`<path class="wf-bar" data-bars="done" d=""/>`);
  out.push(`<path class="wf-bar" data-bars="live" data-lit d=""/>`);
  out.push(`<path class="wf-inner" data-bars="inner" d=""/>`);
  out.push(`<path class="wf-tick" data-ticks d=""/>`);
  out.push(`<g data-tick-labels></g>`);
  out.push(`<path class="wf-now" data-now d=""/>`);
  return out.join("");
}
function screen() {
  const out = [S(k.slabOf({ x: SCREEN.x0, y: WALL_Y, w: SCREEN.x1 - SCREEN.x0, d: WALL_D, r: 1 }, SCREEN.z0, SCREEN.z1 - SCREEN.z0, P, 3, 0.4), { tone: "mid" })];
  out.push(`<path class="wf-panel" d="${face(SCREEN.x0 + 2, SCREEN.x1 - 2, SCREEN.z0 + 2, SCREEN.z1 - 2)}"/>`);
  // browser chrome: three dots and the address bar
  out.push(L(face(SCREEN.x0 + 2, SCREEN.x1 - 2, 57, SCREEN.z1 - 2), { tone: "lo" }));
  out.push(D([50, 52.6, 55.2].map((x) => at([x, FACE_Y + 0.05, 59.5])), { size: 0.55, tone: "mid" }));
  out.push(`<path class="wf-address" d="${face(59, 116, 58.4, 60.6)}"/>`);
  // the page's parts: a skeleton outline, the part when its data is in, and the lit flash when it lands
  for (const [part, rects] of Object.entries(PAGE)) {
    const d = rects.map(([x0, x1, z0, z1]) => face(x0, x1, z0, z1)).join("");
    out.push(`<path class="wf-skeleton" d="${d}"/>`);
    out.push(`<path class="wf-part" data-part="${part}" d="${d}" style="display:none"/>`);
    // text lines inside each block, shown with it
    const lines = rects.map(([x0, x1, z0, z1]) => {
      const mid = (z0 + z1) / 2, x = part === "user" ? x0 + 7 : x0 + 2;
      const len = part === "user" ? 24 : (x1 - x0) * (part === "notifs" ? 0.6 : 0.7);
      return k.pathOf([at([x, FACE_Y + 0.1, mid]), at([x + len, FACE_Y + 0.1, mid])]);
    }).join("");
    out.push(`<path class="wf-lines" data-part-lines="${part}" d="${lines}" style="display:none"/>`);
  }
  // the avatar
  out.push(`<path class="wf-skeleton" d="${face(51.4, 56, 48.8, 52.7)}"/>`);
  return out.join("");
}

// ---------- the server ----------
function server() {
  const out = [S(k.slabOf(SERVER, 0, SERVER_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(SERVER, 2), SERVER_H, P), { tone: "faint" }) })];
  out.push(text(SERVER.x + SERVER.w / 2, SERVER.y + SERVER.d, 8, t("SERVER", "SERVIDOR"), 3.4, { anchor: "middle" }));
  SERVICES.forEach((name, i) => {
    const plan = svcPlan(i);
    const word = (lit) => faceText(P, [plan.x + plan.w, plan.y + plan.d - 0.5, SERVER_H + 2.4], name === "cdn" ? "CDN" : name, { face: "x", size: 2, tone: lit ? "on-lit" : "hi" });
    const block = (lit) => S(k.slabOf(plan, SERVER_H, SVC.h, P, 3, 0.4), { tone: "hi", crease: "lo", lit }) + word(lit);
    out.push(`<g data-svc="${name}"><g data-v="off">${block(false)}</g><g data-v="on" style="display:none">${litFill(block(true))}</g></g>`);
  });
  return out.join("");
}

// ---------- the track ----------
function lanes() {
  const out = [];
  LANE_Y.forEach((y) => {
    out.push(S(slab({ x: LANE.x0, y: y - LANE.half, w: LANE.x1 - LANE.x0, d: LANE.half * 2, r: 0.6 }, 0, 0.5, 2), { tone: "lo", crease: "none" }));
  });
  // the start line at the browser end
  out.push(L(k.lineOnTop([RUN.start + 2.6, LANE_Y[0] - 3.4], [RUN.start + 2.6, LANE_Y[LANE_Y.length - 1] + 3.4], 0.5, P), { tone: "mid" }));
  return out.join("");
}

// A runner, drawn at the origin and moved by the live code: waiting, running out, or running back with a crate.
export function runnerSvg() {
  const body = (lit) => figurine(P, [0, 0, 0], { scale: 0.8, lit });
  const crate = (s, h) => S(k.slabOf({ x: -s / 2, y: -s / 2, w: s, d: s, r: 0.4 }, 10.9, h, P, 2, 0.2), { tone: "hi", crease: "lo", lit: true });
  return `<g data-v="wait">${body(false)}</g>`
    + `<g data-v="go" style="display:none">${litFill(body(true))}</g>`
    + `<g data-v="back" style="display:none">${litFill(body(true) + crate(4, 2.8))}</g>`
    + `<g data-v="big" style="display:none">${litFill(body(true) + crate(5.6, 4))}</g>`;
}
function runners() {
  return LANE_Y.map((y, i) => `<g data-runner="${i}" style="display:none">${runnerSvg()}</g>`).join("");
}

// ---------- the bench ----------
function bench() {
  const out = [S(k.slabOf(BENCH, 0, BENCH_H, P, 3, 0.5), { tone: "mid" })];
  LANES.forEach((name, i) => {
    const y = LANE_Y[i];
    out.push(L(k.planOutline({ x: BENCH.x + 2, y: y - 3, w: BENCH.w - 4, d: 6, r: 0.8 }, BENCH_H, P), { tone: "faint" }));
    out.push(faceText(P, [BENCH.x + 3.2, y + 1.1, BENCH_H], NAMES[name], { face: "top", size: 2.6, tone: "hi" }));
    const big = name === "main";
    const s = big ? 5 : 3.6, h = big ? 3.6 : 2.4;
    const crate = (lit) => S(k.slabOf({ x: CRATE_X - s / 2, y: y - s / 2, w: s, d: s, r: 0.4 }, BENCH_H, h, P, 2, 0.2), { tone: "hi", crease: "lo", lit });
    out.push(`<g data-crate="${i}" style="display:none"><g data-v="on">${litFill(crate(true))}</g><g data-v="off" style="display:none">${crate(false)}</g></g>`);
  });
  // the main thread lamp, at the front right of the bench
  const p = [BENCH.x + BENCH.w - 6, BENCH.y + BENCH.d - 3.4, BENCH_H];
  out.push(`<g data-js="off">${lamp(P, p, { r: 2.2 })}</g><g data-js="on" style="display:none">${litFill(lamp(P, p, { r: 2.2, lit: true }))}</g>`);
  out.push(text(BENCH.x + BENCH.w - 13, BENCH.y + BENCH.d, 1.3, t("MAIN THREAD", "HILO PRINCIPAL"), 2.3, { anchor: "end" }));
  return out.join("");
}

// ---------- the console ----------
function console_() {
  const out = [S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 3, 0.5), { tone: "mid" })];
  const front = CONSOLE.y + CONSOLE.d;
  const ctr = (x, count, name) => digitCounter(P, { x: CONSOLE.x + x, y: front, z: 1.3, count, w: 3.8, h: 5, gap: 0.5, pad: 0.9, name });
  out.push(ctr(4, 4, "ms"), text(CONSOLE.x + 23, front, 2.2, "ms", 2.6));
  out.push(ctr(32, 1, "chain"), text(CONSOLE.x + 39, front, 2.2, t("ROUND TRIPS IN A ROW", "VIAJES EN CADENA"), 2.6));
  out.push(ctr(76, 1, "flight"), text(CONSOLE.x + 83, front, 2.2, t("IN FLIGHT", "EN VUELO"), 2.6));
  out.push(ctr(104, 1, "landed"), text(CONSOLE.x + 111, front, 2.2, t("LANDED", "LLEGARON"), 2.6));
  return out.join("");
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A relay track on a base plate. At the far end stands the server, with a block on top for each service: CDN, user, posts, notifs and comments. At the near end is the browser's inbox bench, with a labelled slot for each request the page can make: HTML, main.js, comments.js, /user, /posts, /notifs, /comments and /page. Between them, one lane per request. A request is a small runner: it waits at the start line until the page asks for it, runs to the server, waits while its service works, and runs back carrying a crate of data that lands on its slot. A lamp on the bench lights while the main thread runs JavaScript. Behind the track, a chart board draws every request as a bar against time, the waterfall, with a row for the main thread; beside it, a page screen whose header, posts, comments and notifications fill in as their data lands. A console in front counts the milliseconds, the round trips in a row so far, the requests in flight and the ones that have landed.",
      "Una pista de relevos sobre una placa base. En el extremo lejano está el servidor, con un bloque encima por cada servicio: CDN, user, posts, notifs y comments. En el extremo cercano está la mesa de entrada del navegador, con una ranura con nombre por cada solicitud que la página puede hacer: HTML, main.js, comments.js, /user, /posts, /notifs, /comments y /page. Entre ambos, un carril por solicitud. Una solicitud es un pequeño corredor: espera en la línea de salida hasta que la página la pide, corre al servidor, espera mientras su servicio trabaja y vuelve con una caja de datos que cae en su ranura. Una lámpara en la mesa se enciende mientras el hilo principal ejecuta JavaScript. Detrás de la pista, un tablero dibuja cada solicitud como una barra en el tiempo, la cascada, con una fila para el hilo principal; al lado, una pantalla de la página cuyo encabezado, publicaciones, comentarios y notificaciones se completan a medida que llegan sus datos. Una consola al frente cuenta los milisegundos, los viajes de ida y vuelta en cadena hasta ahora, las solicitudes en vuelo y las que ya llegaron.",
    ),
    body: [
      plate(),
      board(),
      screen(),
      server(),
      lanes(),
      `<g data-layer="runners">${runners()}</g>`,
      bench(),
      console_(),
    ],
  });
}

export const GEOMETRY = { LANE_Y, RUN, CHART, ROWS, FACE_Y, PAGE, SERVICES, CRATE_X, BENCH_H };

// Figure-specific CSS (page.ts adds LIT_FILL_CSS).
export const FIGURE_CSS = `
.wf-panel{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.6}
.wf-address{fill:var(--anatomy-paper);stroke:var(--anatomy-lo);stroke-width:.5}
.wf-skeleton{fill:none;stroke:var(--anatomy-lo);stroke-width:.6;stroke-dasharray:1.6 1.4}
.wf-part{fill:var(--anatomy-faint);stroke:var(--anatomy-mid);stroke-width:.6}
.wf-part[data-lit]{fill:var(--anatomy-lit);stroke:var(--anatomy-lit)}
.wf-lines{fill:none;stroke:var(--anatomy-mid);stroke-width:.9;stroke-linecap:round}
.wf-part[data-lit]+.wf-lines{stroke:var(--anatomy-page)}
.wf-bar{fill:var(--anatomy-lo);stroke:var(--anatomy-mid);stroke-width:.5;stroke-linejoin:round}
.wf-bar[data-lit]{fill:var(--anatomy-lit);stroke:var(--anatomy-lit)}
.wf-inner{fill:var(--anatomy-mid);stroke:var(--anatomy-strong);stroke-width:.4}
.wf-ghost{fill:none;stroke:var(--anatomy-mid);stroke-width:.7;stroke-dasharray:1.4 1.2}
.wf-tick{fill:none;stroke:var(--anatomy-mid);stroke-width:.6}
.wf-now{fill:none;stroke:var(--anatomy-lit);stroke-width:1.1}
`;

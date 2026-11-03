// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// An order depot: a browser's desk on the left orders a page's files from a warehouse on the right.
//   six conveyor beds run between them; each bed has three tracks, and each track is one connection (HTTP/1.1
//   uses the middle track of each bed, up to six; with 18 connections all three; HTTP/2 one track in all);
//   a track gets its rail once its handshakes are done; order slips (GET) ride to the warehouse, packets ride back;
//   a packet that falls off leaves a gap, and the packets behind it on that track wait in a column at the browser's
//   end until the gap is filled;
//   the page tray in front fills a tile per file; counters on real objects show the numbers.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate, digitCounter, person, meter, lamp, faceText, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 450;

const PLATE = { x: -152, y: -86, w: 304, d: 172, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// Conveyor beds (back to front) and the three tracks on each.
export const BEDS_Y = [-60, -44, -28, -12, 4, 20];
export const TRACK_OFF = [0, -4.9, 4.9];          // connection c: bed c % 6, track TRACK_OFF[floor(c / 6)]
const BED_D = 15;
export const BED_H = 3;
export const LX0 = -88;                          // the browser's end of every track
export const LX1 = 72;                            // the warehouse's end
export const BED_OF = [2, 3, 1, 4, 0, 5];         // the first connections take the middle beds
export const trackY = (c) => BEDS_Y[BED_OF[c % 6]] + TRACK_OFF[Math.floor(c / 6)];
export const BOX = { w: 4.8, d: 3.9, h: 3 };

const DESK = { x: -132, y: -68, w: 28, d: 92, r: 1.5 };
const DESK_H = 12;
export const SLIPS = { x: -118, y: -42, n: 20, h: 0.7 };   // the pile of order slips on the desk

const WH = { x: 78, y: -72, w: 50, d: 104, r: 2 };
const WH_H = 18;

const TRAY = { x: -146, y: 38, w: 124, d: 44, r: 2 };
const TRAY_H = 9;
export const GRID = { cols: 10, rows: 8, x0: TRAY.x + 4, y0: TRAY.y + 3.4, px: 11.7, py: 4.75, w: 9.6, d: 3.6 };
export const MAX_FILES = GRID.cols * GRID.rows;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-142, -20, 26], [WH.x, WH.y, WH_H + 8]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 52 },
);

const { S, L, D, at, seg } = shorthand(P);
const label = (x, y, z, text, size = 2.6, opts = {}) => faceText(P, [x, y, z], text, { size, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -6, y: 70, w: 80, d: 6, r: 1 })
    + labelPlate(P, { x: 84, y: 50, w: 46, d: 16, r: 1.5 }, [[89, 55, 28], [89, 59, 36], [89, 63, 20]]);
}

// The browser: a person at a desk with a pile of order slips, one slip per file not asked for yet.
function browser() {
  const out = [person(P, [-142, -20, 0], { scale: 0.95, holding: "clipboard" })];
  out.push(S(k.slabOf(DESK, 0, DESK_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(DESK, 2), DESK_H, P), { tone: "faint" }) }));
  // the slip pile: a tray, then up to 20 slips the live code shows or hides
  const base = { x: SLIPS.x - 7, y: SLIPS.y - 5, w: 14, d: 10, r: 0.8 };
  out.push(S(k.slabOf(base, DESK_H, 0.8, P, 2), { tone: "lo", crease: "none" }));
  for (let i = 0; i < SLIPS.n; i++) {
    out.push(`<g data-slip="${i}">${S(k.slabOf({ x: SLIPS.x - 5.5, y: SLIPS.y - 3.8 + (i % 2) * 0.5, w: 11, d: 7.4, r: 0.3 }, DESK_H + 0.8 + i * SLIPS.h, SLIPS.h * 0.8, P, 1), { tone: "hi", crease: "none" })}</g>`);
  }
  // a pen holder at the front of the desk, so the desk reads as a desk
  out.push(S(k.cylinder(-112, 12, 2.2, DESK_H, 4, P, 16, 0.3), { tone: "mid" }));
  out.push(L(seg([-112.6, 11.4, DESK_H + 4], [-111, 10, DESK_H + 9]), { tone: "mid" }));
  return out.join("");
}

// One conveyor bed: a low slab with rollers; rails per track are drawn by railSvg (the live code shows them).
function bed(i) {
  const y = BEDS_Y[i];
  const plan = { x: LX0 - 4, y: y - BED_D / 2, w: LX1 - LX0 + 8, d: BED_D, r: 1 };
  const out = [S(k.slabOf(plan, 0, BED_H, P, 2, 0.3), { tone: "mid" })];
  const rollers = [];
  for (let x = LX0; x < LX1; x += 6) rollers.push(k.lineOnTop([x, y - BED_D / 2 + 1.4], [x, y + BED_D / 2 - 1.4], BED_H, P));
  out.push(L(rollers.join(""), { tone: "faint" }));
  // the browser's end: a catch plate where packets that wait behind a gap stand
  out.push(S(k.slabOf({ x: LX0 - 4, y: y - BED_D / 2, w: 5, d: BED_D, r: 0.6 }, BED_H, 0.8, P, 2), { tone: "mid", crease: "none" }));
  return out.join("");
}

function rail(c) {
  const y = trackY(c);
  return `<g data-rail="${c}" style="display:none">${L(k.lineOnTop([LX0 + 2, y], [LX1 + 4, y], BED_H, P), { tone: "mid" })}</g>`;
}

// Beds back to front; on each, its three tracks back to front: the rail, then a layer for what rides on it.
function lanes() {
  const out = [];
  for (let i = 0; i < BEDS_Y.length; i++) {
    out.push(bed(i));
    for (const tr of [1, 0, 2]) {
      const c = tr * 6 + BED_OF.indexOf(i);
      out.push(rail(c), `<g data-track="${c}"></g>`);
    }
  }
  return out.join("");
}

// The warehouse: where every track ends. Its front carries the link meter; its right side the counters.
function warehouse() {
  const out = [S(k.slabOf(WH, 0, WH_H, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(WH, 5, P, 3), { tone: "faint" }) })];
  out.push(L(k.planOutline(k.insetPlan(WH, 2.4), WH_H, P), { tone: "faint" }));
  // shelves of stock on top, at the back
  for (const [x, y] of [[83, -67], [97, -67], [111, -67]]) {
    out.push(S(k.slabOf({ x, y, w: 11, d: 9, r: 0.6 }, WH_H, 5, P, 2, 0.3), { tone: "hi", crease: "lo" }));
  }
  out.push(S(k.slabOf({ x: 83, y: -55, w: 11, d: 9, r: 0.6 }, WH_H, 3.4, P, 2, 0.3), { tone: "hi", crease: "lo" }));
  // the slow-response lamp: lit while the server works on the slow file
  out.push(`<g data-slow-lamp="off">${lamp(P, [116, 24, WH_H], { r: 2.6 })}</g>`);
  out.push(`<g data-slow-lamp="on" style="display:none">${litFill(lamp(P, [116, 24, WH_H], { r: 2.6, lit: true }))}</g>`);
  const front = WH.y + WH.d;
  out.push(label(116, front, 12.6, t("SLOW", "LENTO"), 2.6, { anchor: "middle" }));
  // link meter on the front: how busy the shared link has been lately
  out.push(meter(P, { x: 93, y: front, z: 6.4, r: 8.5, ticks: 10, name: "link", value: 0 }));
  out.push(label(93, front, 1.9, t("LINK BUSY", "USO DEL ENLACE"), 2.6, { anchor: "middle" }));
  // counters on the right side (face x): handshakes made and packets sent again
  const side = WH.x + WH.w;
  out.push(digitCounter(P, { x: side, y: 24, z: 4, count: 2, w: 5, h: 6.6, gap: 0.8, pad: 1.3, face: "x", name: "handshakes" }));
  out.push(faceText(P, [side, 10.6, 5.6], t("HANDSHAKES", "HANDSHAKES"), { face: "x", size: 2.8, tone: "mid" }));
  out.push(digitCounter(P, { x: side, y: -16, z: 4, count: 2, w: 5, h: 6.6, gap: 0.8, pad: 1.3, face: "x", name: "resent" }));
  out.push(faceText(P, [side, -29.4, 5.6], t("RESENT", "REENVIADOS"), { face: "x", size: 2.8, tone: "mid" }));
  return out.join("");
}

// The page tray: one tile per file, in the order the page asks for them; counters on its front.
export const tileAt = (i) => [GRID.x0 + (i % GRID.cols) * GRID.px, GRID.y0 + Math.floor(i / GRID.cols) * GRID.py];
function tray() {
  const out = [S(k.slabOf(TRAY, 0, TRAY_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(TRAY, 2), TRAY_H, P), { tone: "faint" }));
  for (let i = 0; i < MAX_FILES; i++) {
    const [x, y] = tileAt(i);
    const plan = { x, y, w: GRID.w, d: GRID.d, r: 0.5 };
    out.push(`<g data-tile="${i}">`);
    out.push(L(k.planOutline(plan, TRAY_H, P, 2), { tone: "lo" }));
    out.push(`<g data-part style="display:none">${S(k.slabOf(plan, TRAY_H, 0.5, P, 2), { tone: "mid", crease: "none" })}</g>`);
    out.push(`<g data-full style="display:none">${S(k.slabOf(plan, TRAY_H, 1.8, P, 2, 0.2), { tone: "hi", crease: "lo" })}</g>`);
    out.push(`</g>`);
  }
  const front = TRAY.y + TRAY.d;
  out.push(label(TRAY.x + 4, front, 2.8, t("PAGE", "PÁGINA"), 3));
  out.push(digitCounter(P, { x: TRAY.x + 22, y: front, z: 2, count: 2, w: 4.2, h: 5.4, gap: 0.7, pad: 1.2, name: "loaded" }));
  out.push(label(TRAY.x + 35.5, front, 3.2, t("LOADED", "CARGADOS"), 2.6));
  out.push(digitCounter(P, { x: TRAY.x + 56, y: front, z: 2, count: 2, w: 4.2, h: 5.4, gap: 0.7, pad: 1.2, name: "waiting" }));
  out.push(label(TRAY.x + 69.5, front, 3.2, t("WAITING", "EN ESPERA"), 2.6));
  out.push(digitCounter(P, { x: TRAY.x + 93, y: front, z: 2, count: 4, w: 4.2, h: 5.4, gap: 0.7, pad: 1.2, name: "ms" }));
  out.push(label(TRAY.x + 115.5, front, 3.2, "MS", 2.6));
  return out.join("");
}

// What rides the tracks, drawn at the origin and moved by the live code.
// A packet: a small box; odd files carry a band, so files read apart on a track. Lit when it waits behind a gap or
// falls off.
export function packetSvg() {
  const b = { x: -BOX.w / 2, y: -BOX.d / 2, w: BOX.w, d: BOX.d, r: 0.3 };
  const body = litFill(S(k.slabOf(b, 0, BOX.h, P, 2, 0.2), { tone: "hi", crease: "lo" })).replace('class="iso-solid"', 'class="iso-solid" data-body');
  const band = `<g data-band style="display:none">${L(k.lineOnTop([0, b.y], [0, b.y + b.d], BOX.h, P), { tone: "hi" })}</g>`;
  return body + band;
}
// An order slip (GET) or a handshake token (TCP / TLS): a card standing on the track, its word set live.
export function cardSvg() {
  const w = 8.4, h = 5.2;
  const out = [litFill(S(k.slabOf({ x: -w / 2, y: -0.4, w, d: 0.8, r: 0.15 }, 0, h, P, 2, 0.15), { tone: "hi", crease: "none" })).replace('class="iso-solid"', 'class="iso-solid" data-body')];
  out.push(faceText(P, [0, 0.4, 1.5], "GET", { size: 2.9, tone: "hi", anchor: "middle", attr: "data-word" }));
  return out.join("");
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "An order depot on a base plate. On the left, a person stands at a desk with a pile of order slips: the browser. On the right is a warehouse: the server. Six conveyor beds run between them, each with three tracks; each track is one connection, and it gets its rail once its handshakes are done. Order slips ride to the warehouse and packets ride back; a packet can fall off, and the packets behind it on the same track wait in a column at the browser's end until it is sent again. A tray in front fills one tile per file of the page, with counters for files loaded, files waiting and milliseconds. The warehouse has a meter for how busy the shared link is, a lamp for a slow response, and counters for handshakes and packets resent.",
      "Un depósito de pedidos sobre una placa base. A la izquierda, una persona está en un escritorio con una pila de órdenes: el navegador. A la derecha hay un almacén: el servidor. Entre ellos corren seis cintas, cada una con tres pistas; cada pista es una conexión y recibe su riel cuando terminan sus handshakes. Las órdenes viajan al almacén y los paquetes vuelven; un paquete puede caerse, y los que vienen detrás en la misma pista esperan en una columna en el extremo del navegador hasta que se reenvía. Una bandeja al frente llena una ficha por cada archivo de la página, con contadores de archivos cargados, archivos en espera y milisegundos. El almacén tiene un medidor de qué tan ocupado está el enlace compartido, una lámpara para una respuesta lenta y contadores de handshakes y de paquetes reenviados.",
    ),
    body: [plate(), browser(), lanes(), warehouse(), tray()],
  });
}

export const GEOMETRY = { BEDS_Y, BED_OF, TRACK_OFF, LX0, LX1, BED_H, BOX, SLIPS, GRID, MAX_FILES, TILES: Array.from({ length: MAX_FILES }, (_, i) => tileAt(i)) };

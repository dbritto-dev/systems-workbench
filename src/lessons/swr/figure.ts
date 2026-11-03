// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A copy rack: the client cache as a rack of pigeonholes, one per query key, each holding the last copy it got from
// the server (a card with the version on it) and a freshness gauge on top that empties as the copy ages. Behind the
// rack, a network bed carries requests (lit capsules) back to the server, a cabinet with one drawer per resource and
// a version counter on each; other people's edits tick those counters. At the front left, the screen: the tiles the
// app shows, each with the resource it wants and the version it is showing, tagged when that version is behind the
// server or belongs to another resource. A curtain drops over the screen while the user is away from the tab.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate, digitCounter, lamp, faceText, figurine, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 400;

const PLATE = { x: -176, y: -100, w: 300, d: 122, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// Four columns: the cache's holders (keys) in front, the server's drawers (resources) behind, the network between.
export const COLS = 4;
const COL_W = 34, COL_GAP = 4, X0 = -34;
export const colX = (i) => X0 + i * (COL_W + COL_GAP);          // left edge
export const colMid = (i) => colX(i) + COL_W / 2;
const X1 = colX(COLS - 1) + COL_W;                              // 114

// The server cabinet at the back.
const SERVER = { x: X0 - 2, y: -92, w: X1 - X0 + 4, d: 22, r: 1.5 };
const SERVER_H = 24;
export const SERVER_FACE = SERVER.y + SERVER.d;                 // -70
// The network bed between the server and the cache; requests ride on it.
export const NET = { x: X0 - 2, y: -66, w: X1 - X0 + 4, d: 38, r: 1 };
export const NET_Z = 1.2;
export const GATE_Y = -47;
// The cache: a low plinth with a card holder per key; each card is the last copy of that key's data.
export const RACK = { y: -24, d: 16 };
export const RACK_FACE = RACK.y + RACK.d;                       // -8
const BASE_H = 7;
export const CARD = { y: -17.5, dx: 5, z: BASE_H, w: 18, h: 13.5 };
export const GAUGE = { dx: -10, y: -17.6, z: BASE_H, r: 5, h: 2.4 };
// The screen at the front left, its face toward the viewer.
const STAND = { x: -170, y: -4, w: 118, d: 18, r: 2 };
const PANEL = { x: -166, y: 1, w: 110, d: 3, r: 0.6 };
export const PANEL_Z = [2, 52];
export const SCREEN_FACE = PANEL.y + PANEL.d;                   // 4
const INNER = { x0: PANEL.x + 3, x1: PANEL.x + PANEL.w - 3 };
export const TILE = { cols: 4, rows: 3, w: (INNER.x1 - INNER.x0 - 3 * 2.5) / 4, h: 11.6, gapX: 2.5, gapZ: 2, z0: 4 };
export const tileAt = (slot) => {
  const c = slot % TILE.cols, r = Math.floor(slot / TILE.cols);
  const x0 = INNER.x0 + c * (TILE.w + TILE.gapX), z1 = TILE.z0 + (TILE.rows - r) * TILE.h + (TILE.rows - r - 1) * TILE.gapZ;
  return { x0, x1: x0 + TILE.w, z0: z1 - TILE.h, z1 };
};
const HEAD_Z = [TILE.z0 + 3 * TILE.h + 2 * TILE.gapZ + 2.6, PANEL_Z[1] - 1.6];
export const LAMPS = { away: [PANEL.x + PANEL.w - 26, PANEL.y + 1.5, PANEL_Z[1]], offline: [PANEL.x + PANEL.w - 9, PANEL.y + 1.5, PANEL_Z[1]] };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [PANEL.x, PANEL.y, PANEL_Z[1] + 6], [SERVER.x, SERVER.y, SERVER_H + 14]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 50 },
);

const { S, L, D, at } = shorthand(P);
const text = (x, y, z, words, size = 2.4, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });
const slab = (plan, z, h, steps = 3, bevel = 0.3) => k.slabOf({ r: 0.4, ...plan }, z, h, P, steps, bevel);

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -10, y: 6, w: 80, d: 6, r: 1 })
    + labelPlate(P, { x: 82, y: 1, w: 30, d: 14, r: 1.5 }, [[87, 6, 19], [87, 10, 13]]);
}

// ---------- the server ----------
export const RES_LABEL = ["todos", "stats", "users/1", "users/2"];
function server() {
  const out = [S(k.slabOf(SERVER, 0, SERVER_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(SERVER, 2.4), SERVER_H, P), { tone: "faint" }));
  for (let i = 0; i < COLS; i++) {
    const x = colX(i);
    // a drawer front per resource: its name and its version counter
    out.push(L(k.faceRectY(P, x + 1, x + COL_W - 1, SERVER_FACE, 3, SERVER_H - 3), { tone: "lo" }));
    out.push(text(x + 3.5, SERVER_FACE, SERVER_H - 8.4, RES_LABEL[i], 2.6, { tone: "hi" }));
    out.push(text(x + 3.5, SERVER_FACE, 5.2, "v", 3.2));
    out.push(digitCounter(P, { x: x + 8.4, y: SERVER_FACE, z: 4.2, count: 2, w: 4.6, h: 6.4, gap: 0.6, pad: 1.1, name: "srv" + i, value: 1 }));
    out.push(L(k.faceRectY(P, x + COL_W / 2 - 4, x + COL_W / 2 + 4, SERVER_FACE, SERVER_H - 4.2, SERVER_H - 3.4), { tone: "faint" }));
  }
  out.push(text(SERVER.x + 4, SERVER.y + 12, SERVER_H, t("SERVER", "SERVIDOR"), 4.2, { face: "top", tone: "hi" }));
  return out.join("");
}
// Other people who edit the same data: a little crowd at the back left. The live code lifts the one who edits.
export const OTHERS = [[-74, -92, 0], [-62, -86, 0], [-80, -80, 0], [-68, -74, 0]];
export function otherSvg() { return figurine(P, [0, 0, 0], { scale: 1 }); }
function othersSign() { return text(-96, -64, 0.2, t("OTHER USERS", "OTROS USUARIOS"), 2.8, { face: "top" }); }

// ---------- the network ----------
function network() {
  const out = [S(k.slabOf(NET, 0, NET_Z, P, 3, 0.3), { tone: "lo", crease: "none" })];
  const lanes = [];
  for (let i = 0; i < COLS; i++) lanes.push(k.lineOnTop([colMid(i), NET.y + 2], [colMid(i), NET.y + NET.d - 2], NET_Z, P));
  out.push(L(lanes.join(""), { tone: "faint" }));
  out.push(text(NET.x + 3, NET.y + 7, NET_Z, t("NETWORK", "RED"), 3, { face: "top" }));
  return out.join("");
}
// The gate across the network: up while online, dropped while offline (the live code moves the bar).
export const GATE = { y: GATE_Y };
// The barrier that lies across the network while it is offline (hidden otherwise).
function gate() {
  const bar = { x: NET.x + 1, y: GATE_Y - 1.2, w: NET.w - 2, d: 2.4, r: 0.4 };
  const out = [S(k.slabOf(bar, NET_Z, 2.6, P, 2, 0.3), { tone: "hi", crease: "lo" })];
  const stripes = [];
  for (let x = bar.x + 4; x < bar.x + bar.w - 2; x += 8) stripes.push(k.lineOnTop([x, bar.y], [x + 3, bar.y + bar.d], NET_Z + 2.6, P));
  out.push(L(stripes.join(""), { tone: "mid" }));
  return `<g data-gate style="display:none">${out.join("")}</g>`;
}

// A request: a lit capsule (a fetch), or a lit envelope (a save).
export function capsuleSvg() {
  return litFill(S(k.cylinder(0, 0, 3, 0, 3, P, 22, 0.4), { tone: "hi", crease: "lo", lit: true }));
}
export function envelopeSvg() {
  return litFill(S(slab({ x: -3.2, y: -2.2, w: 6.4, d: 4.4, r: 0.4 }, 0, 1.6, 2), { tone: "hi", crease: "lo", lit: true }));
}

// ---------- the cache ----------
const CACHE_X = X0 - 15;
function cache() {
  const plan = { x: CACHE_X, y: RACK.y, w: X1 - CACHE_X, d: RACK.d, r: 1.2 };
  const out = [S(k.slabOf(plan, 0, BASE_H, P, 3, 0.4), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(plan, 1.6), BASE_H, P), { tone: "faint" }));
  for (let i = 0; i < COLS; i++) {
    const cx = colMid(i), x = colX(i);
    if (i) out.push(L(k.lineOnTop([x - COL_GAP / 2, RACK.y + 1.6], [x - COL_GAP / 2, RACK_FACE - 1.6], BASE_H, P), { tone: "lo" }));
    // the card holder: a groove the copy stands in
    out.push(L(k.planOutline({ x: cx + CARD.dx - CARD.w / 2 - 1, y: CARD.y - 1.2, w: CARD.w + 2, d: 2.4, r: 0.6 }, BASE_H, P), { tone: "lo" }));
    // the freshness gauge: a drum whose top shows a pie that empties as the copy ages
    const gx = cx + GAUGE.dx;
    out.push(S(k.cylinder(gx, GAUGE.y, GAUGE.r + 0.9, GAUGE.z, GAUGE.h, P, 32, 0.3), { tone: "mid" }));
    out.push(`<path class="gauge-face" d="${k.ring(gx, GAUGE.y, GAUGE.r, GAUGE.z + GAUGE.h, P, 40)}"/>`);
    out.push(`<path class="gauge-pie" data-pie="${i}" d=""/>`);
    out.push(L(k.radialTicks(gx, GAUGE.y, GAUGE.r, 12, 3, GAUGE.z + GAUGE.h, [0.6, 1.1], P).major, { tone: "lo" }));
    out.push(D([at([gx, GAUGE.y, GAUGE.z + GAUGE.h])], { size: 0.5, tone: "hi" }));
    out.push(text(gx - GAUGE.r - 0.6, RACK_FACE - 0.9, BASE_H, t("FRESH", "FRESCO"), 2, { face: "top" }));
    // the lip: the query key, and how many tiles use it
    out.push(faceText(P, [x + 1.6, RACK_FACE, 3.9], "", { size: 2.5, tone: "hi", attr: `data-key="${i}"` }));
    out.push(`<g data-inuse="${i}">${text(x + 1.6, RACK_FACE, 0.9, t("IN USE", "EN USO"), 2)}</g>`);
    // the gc countdown: printed in its place while nobody uses the key
    out.push(faceText(P, [x + 1.6, RACK_FACE, 0.9], "", { size: 2, tone: "hi", attr: `data-gc="${i}"` }));
    out.push(digitCounter(P, { x: x + COL_W - 9.4, y: RACK_FACE, z: 1.2, count: 2, w: 3.4, h: 4.6, gap: 0.5, pad: 0.8, name: "use" + i }));
  }
  out.push(L(k.lineOnTop([X0 - COL_GAP / 2, RACK.y + 1.6], [X0 - COL_GAP / 2, RACK_FACE - 1.6], BASE_H, P), { tone: "lo" }));
  out.push(text(CACHE_X + 2.6, RACK.y + 5, BASE_H, t("CACHE", "CACHÉ"), 3, { face: "top", tone: "hi" }));
  return out.join("");
}
// A copy card, drawn at the origin of its holder and moved by the live code (it slides off when the key is dropped).
export function cardSvg() {
  const plan = { x: -CARD.w / 2, y: -0.4, w: CARD.w, d: 0.8, r: 0.2 };
  return S(k.slabOf(plan, 0, CARD.h, P, 2, 0.15), { tone: "hi", crease: "none" })
    + faceText(P, [0, 0.4, CARD.h * 0.42], "", { size: 4.4, tone: "hi", anchor: "middle", attr: "data-card-v" })
    + faceText(P, [0, 0.4, CARD.h * 0.12], "", { size: 2.2, tone: "mid", anchor: "middle", attr: "data-card-res" });
}
export const cardHome = (i) => [colMid(i) + CARD.dx, CARD.y, BASE_H];

// ---------- the screen ----------
function screen() {
  const out = [S(k.slabOf(STAND, 0, 2, P, 3, 0.4), { tone: "mid" })];
  out.push(S(k.slabOf(PANEL, PANEL_Z[0], PANEL_Z[1] - PANEL_Z[0], P, 2, 0.3), { tone: "hi", crease: "lo" }));
  const f = SCREEN_FACE + 0.05;
  // the address bar
  out.push(`<path class="addr" d="${k.faceRectY(P, INNER.x0, INNER.x0 + 46, f, HEAD_Z[0], HEAD_Z[1])}"/>`);
  out.push(faceText(P, [INNER.x0 + 2, f, HEAD_Z[0] + 1.2], "", { size: 3, tone: "hi", attr: "data-route" }));
  out.push(text(LAMPS.away[0], f, HEAD_Z[0] + 0.6, t("AWAY", "FUERA"), 2.2, { anchor: "middle" }));
  out.push(text(LAMPS.offline[0], f, HEAD_Z[0] + 0.6, t("OFFLINE", "SIN RED"), 2.2, { anchor: "middle" }));
  for (let slot = 0; slot < TILE.cols * TILE.rows; slot++) {
    const b = tileAt(slot);
    out.push(`<g data-tile="${slot}">`);
    out.push(`<path class="tile" d="${k.faceRectY(P, b.x0, b.x1, f, b.z0, b.z1)}"/>`);
    out.push(faceText(P, [b.x0 + 1.4, f, b.z1 - 3.4], "", { size: 2.4, tone: "mid", attr: "data-want" }));
    out.push(faceText(P, [b.x0 + 1.4, f, b.z0 + 1.8], "", { size: 3.4, tone: "hi", attr: "data-show" }));
    // the tag: OLD (behind the server) or WRONG (another resource's data)
    const tw = 8.8, tx = b.x1 - tw - 0.8;
    out.push(`<g data-tag="old" style="display:none"><path class="tag" d="${k.faceRectY(P, tx, tx + tw, f, b.z1 - 4.4, b.z1 - 1)}"/>${faceText(P, [tx + tw / 2, f, b.z1 - 3.6], t("OLD", "VIEJO"), { size: 2.1, tone: "hi", anchor: "middle" })}</g>`);
    out.push(`<g data-tag="wrong" style="display:none"><path class="tag" d="${k.faceRectY(P, tx, tx + tw, f, b.z1 - 4.4, b.z1 - 1)}"/>${faceText(P, [tx + tw / 2, f, b.z1 - 3.6], t("WRONG", "AJENO"), { size: 2.1, tone: "hi", anchor: "middle" })}</g>`);
    out.push(`</g>`);
  }
  // the lamps on top of the panel: away from the tab, offline
  for (const name of ["away", "offline"]) {
    const p = LAMPS[name];
    out.push(`<g data-lamp="${name}">${lamp(P, p, { r: 2 })}</g><g data-lamp-on="${name}" style="display:none">${litFill(lamp(P, p, { r: 2, lit: true }))}</g>`);
  }
  return out.join("");
}
// The curtain that drops over the screen while the user is in another tab.
function curtain() {
  const f = SCREEN_FACE + 0.2, b0 = tileAt(8), b1 = tileAt(3);
  const plan = { x: INNER.x0 - 1, y: f, w: INNER.x1 - INNER.x0 + 2, d: 1, r: 0.3 };
  return `<g data-curtain style="display:none">${S(k.slabOf(plan, b0.z0 - 1, b1.z1 - b0.z0 + 2, P, 2, 0.2), { tone: "mid", crease: "none" })}`
    + faceText(P, [(INNER.x0 + INNER.x1) / 2, f + 1, (b0.z0 + b1.z1) / 2 - 1.5], t("TAB HIDDEN", "PESTAÑA OCULTA"), { size: 4, tone: "mid", anchor: "middle" })
    + `</g>`;
}

// The cable that carries the rack's copies to the screen.
function cable() {
  return k.wireSvg(at([CACHE_X + 8, RACK_FACE, 3]), at([PANEL.x + PANEL.w - 6, PANEL.y - 0.4, 6]), { via: [at([CACHE_X + 8, RACK_FACE + 3, 0.6]), at([PANEL.x + PANEL.w - 6, RACK_FACE + 3, 0.6])], tone: "lo" });
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A copy rack on a base plate. In the middle stands a rack of four pigeonholes, one per query key, each holding the last copy of its data on a card with the version number, a counter of how many tiles use it, and a freshness gauge on top that empties as the copy ages. Behind the rack a network bed carries requests, drawn as lit capsules, to the server: a cabinet with one drawer per resource and a version counter on each, which other people's edits tick up. At the front left, the screen shows the app's tiles; each tile names the resource it wants and the version it shows, with a tag when that version is behind the server or belongs to another resource. A curtain drops over the screen while the user is in another tab, and a gate drops across the network while it is offline.",
      "Un estante de copias sobre una placa base. En el medio hay un estante de cuatro casilleros, uno por clave de consulta (query key); cada uno guarda la última copia de sus datos en una tarjeta con el número de versión, un contador de cuántos paneles la usan y un indicador de frescura arriba que se vacía a medida que la copia envejece. Detrás del estante, una base de red lleva las solicitudes, dibujadas como cápsulas iluminadas, al servidor: un mueble con un cajón por recurso y un contador de versión en cada uno, que suben con las ediciones de otras personas. Adelante a la izquierda, la pantalla muestra los paneles de la app; cada panel indica el recurso que quiere y la versión que muestra, con una etiqueta cuando esa versión está atrasada respecto del servidor o es de otro recurso. Una cortina cae sobre la pantalla mientras el usuario está en otra pestaña, y una barrera cruza la red mientras no hay conexión.",
    ),
    body: [
      plate(),
      othersSign(),
      `<g data-layer="others"></g>`,
      server(),
      network(),
      `<g data-layer="wire"></g>`,
      gate(),
      cache(),
      `<g data-layer="cards"></g>`,
      cable(),
      screen(),
      curtain(),
    ],
  });
}

export const FIGURE_CSS = `
.tile{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.7}
.tile[data-state="loading"]{stroke:var(--anatomy-mid);stroke-dasharray:2 1.6}
.tile[data-state="old"]{stroke:var(--anatomy-mid);stroke-width:.9}
.tile[data-state="wrong"]{stroke:var(--anatomy-hi);stroke-width:1.2}
.tile[data-state="empty"]{fill:none;stroke:var(--anatomy-faint);stroke-dasharray:1 1.6}
.addr{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.6}
.tag{fill:var(--anatomy-hi);stroke:none}
[data-tag] text.iso-face-text[data-tone]{fill:var(--anatomy-page);font-weight:600}
.gauge-face{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.6}
.gauge-pie{fill:var(--anatomy-mid);stroke:var(--anatomy-mid);stroke-width:.3;stroke-linejoin:round}
`;

export const GEOMETRY = { COLS, COL_W, X0, NET, NET_Z, GATE, RACK, RACK_FACE, CARD, GAUGE, SERVER_FACE, OTHERS, BASE_H, SERVER_H, colMid: Array.from({ length: COLS }, (_, i) => colMid(i)), cardHome: Array.from({ length: COLS }, (_, i) => cardHome(i)), slots: TILE.cols * TILE.rows };

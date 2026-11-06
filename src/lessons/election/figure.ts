// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// Five signal towers on a plate, A to E, that elect a leader. Each tower has an election timer (the dial on its roof),
// its term (digit wheels on its right face), its role (the word under its letter) and, on the plate in front of it,
// the last four entries of its log (each tile shows the term that wrote it: solid once committed, an outline while
// not). The leader flies the lit pennant; a candidate an unlit one. Messages fly between the roofs: heartbeats as
// balls, vote requests as ballots (lit when the vote is granted). A fence can rise between B and C (the cut), or
// between D and E, leaving E alone; messages that reach a fence drop (its posts stand clear of the towers behind it).
// Clients stand at the front, and the board at the front counts writes acknowledged, failed and lost.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, labelPlate, digitCounter, dial, pennant, figurine, plaque, faceText, sign } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { LETTERS } from "./sim";

export const WIDTH = 720;
export const HEIGHT = 480;

const PLATE = { x: -140, y: -100, w: 280, d: 156, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

export const TOWER = { w: 22, h: 40 };
export const TOWERS = [[-104, -28], [-56, -60], [0, -72], [56, -60], [108, -28]];
export const ROOF = TOWER.h + 2.2;                    // where messages leave and land
export const TILES = 4;
const TILE = { w: 8.4, d: 7, gap: 1.2 };

// The fences, straight across the plate: the cut between B and C (the plane x = CUT_X), and the one between D and E
// (x = SOLO_X) that leaves E alone.
export const CUT_X = -28;
export const SOLO_X = 84;
const FENCE_H = 52;
const Y0 = PLATE.y + 6, Y1 = PLATE.y + PLATE.d - 6;

// The clients, one group on each side of the cut, and the scoreboard.
export const CLIENTS = [[[-112, 18], [-97, 27]], [[-4, -20], [11, -12]]];
export const CLIENT_Z = 12;
const BOARD = { x: 18, y: 40, w: 52, d: 4, r: 0.6 };
const BOARD_H = 26;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [TOWERS[2][0] - 11, TOWERS[2][1] - 11, TOWER.h + 20], [TOWERS[0][0] - 11, TOWERS[0][1] - 11, TOWER.h + 20], [CUT_X, PLATE.y + 6, FENCE_H]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

const { S, L } = shorthand(P);
const depth = ([x, y]) => k.depthOf([x, y, 0], P);
const text = (p, words, opts = {}) => faceText(P, p, words, { tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + labelPlate(P, { x: 100, y: 34, w: 30, d: 12, r: 1.4 }, [[105, 38, 18], [105, 42, 12]]);
}

// ---------- a tower ----------
export function tilePlan(i, s) {
  const [x, y] = TOWERS[i];
  const span = TILES * TILE.w + (TILES - 1) * TILE.gap;
  return { x: x - span / 2 + s * (TILE.w + TILE.gap), y: y + TOWER.w / 2 + 3.4, w: TILE.w, d: TILE.d, r: 0.6 };
}
function tiles(i) {
  // the entries older than the four tiles, as a +N tag in front of the oldest tile shown, where the row is cut off
  const p0 = tilePlan(i, 0);
  const out = [faceText(P, [p0.x + 0.4, p0.y + p0.d + 3.6, 0], "", { face: "top", size: 3, tone: "mid", attr: `data-more="${i}"` })];
  for (let s = 0; s < TILES; s++) {
    const p = tilePlan(i, s);
    const mid = [p.x + p.w / 2, p.y + p.d / 2 + 1.4];
    out.push(L(k.planOutline(p, 0, P, 3), { tone: "faint" }));
    out.push(`<g data-tile="${i}-${s}" data-state="empty">`
      + `<g data-v="commit">${S(k.slabOf(p, 0, 1.8, P, 3, 0.3), { tone: "hi", crease: "lo" })}${faceText(P, [mid[0], mid[1], 1.8], "1", { face: "top", size: 4, tone: "hi", anchor: "middle", attr: "data-tile-text" })}</g>`
      + `<g data-v="pending">${L(k.planOutline(k.insetPlan(p, 0.4), 0.2, P, 3), { tone: "mid", dashed: true })}${faceText(P, [mid[0], mid[1], 0.2], "1", { face: "top", size: 4, tone: "mid", anchor: "middle", attr: "data-tile-text" })}</g>`
      + `</g>`);
  }
  return out.join("");
}
function tower(i) {
  const [x, y] = TOWERS[i];
  const half = TOWER.w / 2;
  const plan = { x: x - half, y: y - half, w: TOWER.w, d: TOWER.w, r: 1.2 };
  const front = y + half, side = x + half;
  const out = [`<g data-tower="${i}" data-role="follower">`];
  out.push(S(k.slabOf(k.insetPlan(plan, -1.6), 0, 2, P, 3, 0.4), { tone: "lo" }));
  out.push(S(k.slabOf(plan, 2, TOWER.h - 2, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, TOWER.h - 6, P, 3), { tone: "faint" }) }));
  // the letter and the role on the front face
  out.push(text([x, front, TOWER.h - 15], LETTERS[i], { size: 11, tone: "hi", anchor: "middle" }));
  const roles = {
    leader: t("LEADER", "LÍDER"), candidate: t("CANDIDATE", "CANDIDATA"), follower: t("FOLLOWER", "SEGUIDORA"), down: t("DOWN", "CAÍDA"),
  };
  for (const [key, words] of Object.entries(roles)) out.push(`<g data-role-word="${key}">${text([x, front, TOWER.h - 22.4], words, { size: 3, anchor: "middle" })}</g>`);
  // the term on the right face
  out.push(digitCounter(P, { x: side, y: y + 5.6, z: 14, count: 2, face: "x", w: 5.2, h: 7, gap: 0.6, pad: 1.1, name: `term-${i}`, value: 1 }));
  out.push(faceText(P, [side, y + 6.6, 7.4], t("TERM", "MANDATO"), { face: "x", size: 2.8, tone: "mid" }));
  // the roof: the election timer, and the pennant
  out.push(dial(P, { x: x + 1.6, y: y + 1.6, z: TOWER.h, r: 5.8, h: 2.2, ticks: 30, every: 5, name: `timer-${i}`, value: 0, knurl: false }));
  out.push(`<g data-flag="lit">${pennant(P, { x: x - 7.6, y: y - 7.6, z: TOWER.h, height: 17, length: 11, drop: 6.4, lit: true })}</g>`);
  out.push(`<g data-flag="plain">${pennant(P, { x: x - 7.6, y: y - 7.6, z: TOWER.h, height: 17, length: 11, drop: 6.4 })}</g>`);
  out.push(`</g>`);
  return out.join("");
}
// The empty pad a tower stands on: still there when the cluster runs with fewer towers.
function pad(i) {
  const [x, y] = TOWERS[i];
  const half = TOWER.w / 2 + 2.4;
  return L(k.planOutline({ x: x - half, y: y - half, w: half * 2, d: half * 2, r: 2 }, 0, P, 3), { tone: "faint" });
}

// ---------- fences ----------
// The stretch of a fence (shares u of the way from a to b) that stands in front of a tower on screen: a post there
// would cover the tower's letter, role and term.
function hidesTower(a, b, i) {
  const [x, y] = TOWERS[i], half = TOWER.w / 2 + 1;
  const corners = [];
  for (const dx of [-half, half]) for (const dy of [-half, half]) for (const z of [0, TOWER.h]) corners.push(k.iso([x + dx, y + dy, z], P));
  const lo = Math.min(...corners.map((c) => c[0])) - 3, hi = Math.max(...corners.map((c) => c[0])) + 3;
  return (u) => {
    const p = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    const sx = k.iso([p[0], p[1], 0], P)[0];
    return sx > lo && sx < hi && depth(p) > depth([x, y]);
  };
}
// A see-through fence: posts, two rails and a diagonal mesh, from a to b on the plate. Posts that would stand in front
// of one of the towers in "clear" move to the nearest spot beside it.
function fence(a, b, clear = [], every = 18) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.round(len / every));
  const pt = (u, z) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, z];
  const blocked = clear.map((i) => hidesTower(a, b, i));
  const bad = (u) => blocked.some((f) => f(u));
  const us = [];
  for (let j = 0; j <= n; j++) {
    let u = j / n;
    if (bad(u)) {
      // the nearest free spot on either side
      let down = u, up = u;
      while (down > 0 && bad(down)) down -= 0.005;
      while (up < 1 && bad(up)) up += 0.005;
      u = !bad(Math.max(0, down)) && (u - down <= up - u || bad(Math.min(1, up))) ? Math.max(0, down) : Math.min(1, up);
    }
    if (!us.some((v) => Math.abs(v - u) < 0.6 / n)) us.push(u);
  }
  us.sort((p, q) => p - q);
  const posts = us.map((u) => ({ u, p: pt(u, 0) })).sort((p, q) => depth(p.p) - depth(q.p));
  const mesh = [];
  for (let j = 0; j < us.length - 1; j++) {
    const u0 = us[j], u1 = us[j + 1];
    if (bad((u0 + u1) / 2)) continue;              // the stretch in front of a tower: rails only
    mesh.push(k.segment(pt(u0, 4), pt(u1, FENCE_H - 4), P), k.segment(pt(u0, FENCE_H - 4), pt(u1, 4), P));
  }
  const out = [L(mesh.join(""), { tone: "faint" })];
  out.push(L(k.segment(pt(0, FENCE_H - 1), pt(1, FENCE_H - 1), P) + k.segment(pt(0, 3), pt(1, 3), P), { tone: "mid" }));
  for (const { p } of posts) out.push(S(k.cylinder(p[0], p[1], 1, 0, FENCE_H, P, 10), { tone: "mid", crease: "none" }));
  return out.join("");
}
function cutFence() {
  return `<g data-fence="cut" style="display:none">${fence([CUT_X, Y0], [CUT_X, Y1], [1])}`
    + sign(P, { x: CUT_X, y: 26, z: 24, w: 26, h: 9, face: "x", text: t("CUT", "CORTE"), size: 4.4, posts: false })
    + `</g>`;
}
function soloFence() {
  return `<g data-fence="solo" style="display:none">${fence([SOLO_X, Y0], [SOLO_X, Y1], [3])}`
    + sign(P, { x: SOLO_X, y: 26, z: 24, w: 26, h: 9, face: "x", text: t("CUT", "CORTE"), size: 4.4, posts: false })
    + `</g>`;
}

// ---------- clients and the scoreboard ----------
function clients(g) {
  const out = CLIENTS[g].map(([x, y]) => figurine(P, [x, y, 0], { scale: 0.95 }));
  const [x, y] = CLIENTS[g][0];
  out.push(plaque(P, { x: x - 8, y: y + 12, z: 0, w: 28, d: 7, text: t("CLIENTS", "CLIENTES"), size: 3.2 }));
  return out.join("");
}
function board() {
  const out = [S(k.slabOf({ x: BOARD.x + 6, y: BOARD.y - 4, w: BOARD.w - 12, d: 10, r: 1 }, 0, 2, P, 3, 0.4), { tone: "lo" })];
  out.push(S(k.slabOf(BOARD, 2, BOARD_H, P, 3, 0.4), { tone: "mid", crease: "lo" }));
  const face = BOARD.y + BOARD.d;
  out.push(L(k.faceRectY(P, BOARD.x + 2, BOARD.x + BOARD.w - 2, face, 4, BOARD_H), { tone: "faint" }));
  // one housing per row, its word right after it
  const rows = [["acked", t("ACKED", "CONFIRMADAS"), 19.6], ["failed", t("FAILED", "FALLIDAS"), 12], ["lost", t("LOST", "PERDIDAS"), 4.4]];
  for (const [name, words, z] of rows) {
    out.push(digitCounter(P, { x: BOARD.x + 4, y: face, z, count: 3, w: 4.4, h: 4.6, gap: 0.5, pad: 0.6, name }));
    out.push(text([BOARD.x + 22, face, z + 1.2], words, { size: 3.4 }));
  }
  return out.join("");
}

// ---------- messages, drawn at the origin and moved by the live code ----------
export function ballSvg(r, tone) {
  return S(k.sphereOf([0, 0, 0], r, P), { tone, crease: "none" });
}
export function ballotSvg(lit) {
  const plan = { x: -3.2, y: -0.4, w: 6.4, d: 0.8, r: 0.2 };
  return `<g class="wb-lit-group">${S(k.slabOf(plan, -3.4, 6.8, P, 2, 0.2), { tone: "hi", crease: "none", lit })}</g>`;
}
export function writeSvg() {
  return S(k.slabOf({ x: -1.9, y: -1.9, w: 3.8, d: 3.8, r: 0.5 }, -1.9, 3.8, P, 2, 0.3), { tone: "mid", crease: "none" });
}

export function buildFigure() {
  // painter's order: everything behind the cut fence, the fence, then the rest; E's pen wraps E
  const left = [0, 1], mid = [2, 3];
  const group = (is) => is.flatMap((i) => [{ d: depth(TOWERS[i]), svg: pad(i) + tower(i) }, { d: depth([TOWERS[i][0], TOWERS[i][1] + 16]), svg: tiles(i) }])
    .sort((a, b) => a.d - b.d).map((x) => x.svg).join("");
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "Five signal towers, A to E, on a base plate, electing a leader. Each tower shows its letter and its role (leader, candidate, follower or down) on its front, its term on digit wheels on its right side, and an election timer as a dial on its roof. The leader flies a lit pennant; a candidate flies an unlit one. On the plate in front of each tower lie the last four entries of its log, each marked with the term that wrote it: a solid tile once committed, a dashed outline while not; a +N tag in front of the oldest one counts the older entries. Small balls fly between the roofs as heartbeats and their replies; ballots fly as vote requests, lit when a vote is granted. A fence can rise between towers B and C, cutting the network in two, or between D and E, leaving E alone; messages that reach it drop. Clients stand at the front on each side, and a board at the front counts writes acknowledged, failed, and acknowledged then lost, each on digit wheels with its word to the right.",
      "Cinco torres de señales, de la A a la E, sobre una placa base, eligiendo un líder. Cada torre muestra su letra y su papel (líder, candidata, seguidora o caída) al frente, su mandato en ruedas de dígitos en su lado derecho y un temporizador de elección como un dial en su techo. La líder lleva un banderín encendido; una candidata, uno apagado. Sobre la placa, frente a cada torre, están las últimas cuatro entradas de su registro, cada una marcada con el mandato que la escribió: una ficha sólida cuando ya se confirmó, un contorno punteado mientras no; una etiqueta +N frente a la más vieja cuenta las entradas anteriores. Pequeñas bolas vuelan entre los techos como latidos y sus respuestas; boletas vuelan como pedidos de voto, encendidas cuando se concede el voto. Puede levantarse una cerca entre las torres B y C, que corta la red en dos, o entre D y E, que deja sola a E; los mensajes que llegan a ella se pierden. Al frente, a cada lado, hay clientes, y un tablero adelante cuenta las escrituras confirmadas, fallidas, y confirmadas y luego perdidas, cada una en ruedas de dígitos con su palabra a la derecha.",
    ),
    body: [
      plate(),
      group(left),
      clients(0),
      cutFence(),
      group(mid),
      clients(1),
      board(),
      soloFence(),
      group([4]),
      `<g data-layer="msgs"></g>`,
    ],
  });
}

export const GEOMETRY = { TOWERS, ROOF, CUT_X, SOLO_X, CLIENTS, CLIENT_Z, TILES };

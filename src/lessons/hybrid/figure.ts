// @ts-nocheck: figure code ported as-is; drawing shorthands come from src/lib/draw.
// A two-lane sorting plant for search queries.
//   the query board at the back left shows the query; the splitter sends it down two lanes;
//   lane A (raised, at the back) is a keyword sieve: a plate with holes cut to the query's exact words, and a rack
//   of the articles that fell through, best BM25 score first;
//   lane B (in front) is a meaning magnet: articles slide toward it by similarity, and its rack holds the nearest;
//   both racks pour into the merge hopper (reciprocal-rank tokens, or a balance beam set to α for a weighted sum),
//   then the rerank desk, where an inspector re-reads the top candidates, then the results shelf;
//   the scoreboard in front shows recall@10 for each kind of query and the time the query took.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, rulerStrip, digitCounter, person, dial, sign, plaque, faceText, variants } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -134, y: -86, w: 268, d: 140, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// lanes: A (keywords) raised at the back, B (meaning) low in front
const LANE_A = { x: -104, y: -74, w: 156, d: 14, r: 1 }, A_H = 18;
const LANE_B = { x: -104, y: -44, w: 156, d: 14, r: 1 }, B_H = 9;
export const SLOTS = 10;
const RACK_X0 = -50, STEP = 8.4;
export const TILE = { w: 7, d: 6.2, h: 4.4 };
export const LANE_SLOTS = {
  a: Array.from({ length: SLOTS }, (_, i) => [RACK_X0 + STEP * i + TILE.w / 2, LANE_A.y + LANE_A.d / 2, A_H]),
  b: Array.from({ length: SLOTS }, (_, i) => [RACK_X0 + STEP * i + TILE.w / 2, LANE_B.y + LANE_B.d / 2, B_H]),
};

const SPLIT = { x: -130, y: -76, w: 20, d: 48, r: 1.5 }, SPLIT_H = 12;
const HOPPER = { x: 58, y: -76, w: 28, d: 48, r: 2 }, HOPPER_H = 14;
const DESK = { x: 92, y: -70, w: 36, d: 20, r: 1.4 }, DESK_H = 10;
const SHELF = { x: 26, y: 22, w: 92, d: 14, r: 1 }, SHELF_H = 10;
const SHELF_X0 = SHELF.x + 4;
export const SHELF_SLOTS = Array.from({ length: SLOTS }, (_, i) => [SHELF_X0 + STEP * i + TILE.w / 2, SHELF.y + SHELF.d / 2, SHELF_H]);
const BOARD = { x: -114, y: 18, w: 100, d: 24, r: 1.5 }, BOARD_H = 18;
export const READ_SPOT = [DESK.x + 9, DESK.y + 11, DESK_H];
export const INSPECTOR = [DESK.x + 18, DESK.y - 7, 0];

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [SPLIT.x, SPLIT.y - 10, 40], [HOPPER.x + HOPPER.w, HOPPER.y, HOPPER_H + 22], [BOARD.x + BOARD.w, BOARD.y + BOARD.d, BOARD_H]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 52 },
);

const { S, L, D, at, seg } = shorthand(P);
const label = (x, y, z, text, size = 2.4, opts = {}) => faceText(P, [x, y, z], text, { size, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H }) + rulerStrip(P, { x: -112, y: 45, w: 96, d: 6, r: 1 });
}

// The query board on two posts behind the splitter, and the splitter block that feeds both lanes.
function entry() {
  const out = [sign(P, { x: -132, y: -80, z: 26, w: 70, h: 9, text: "E-4072 firmware", size: 3.6, attr: "data-query" })];
  out.push(S(k.slabOf(SPLIT, 0, SPLIT_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(SPLIT, 2), SPLIT_H, P), { tone: "faint" }) }));
  // two chutes from the splitter: one climbing to lane A, one level with lane B
  out.push(S(k.slabOf({ x: SPLIT.x + SPLIT.w, y: LANE_A.y + 3, w: 6, d: 8, r: 0.4 }, SPLIT_H, A_H - SPLIT_H, P, 2), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf({ x: SPLIT.x + SPLIT.w, y: LANE_B.y + 3, w: 6, d: 8, r: 0.4 }, 0, B_H, P, 2), { tone: "lo", crease: "none" }));
  out.push(label(SPLIT.x + 2, SPLIT.y + SPLIT.d, 4, t("QUERY", "CONSULTA"), 2.6));
  return out.join("");
}

// A rack: the lane's bed, ten slot outlines on top with their rank printed on the front, and a counter at the end
// for where the article we want ranked in this lane's whole list.
function rack(lane, H, name, title) {
  const out = [S(k.slabOf(lane, 0, H, P, 3, 0.5), { tone: "mid" })];
  const front = lane.y + lane.d;
  const slots = [];
  for (let i = 0; i < SLOTS; i++) slots.push(k.planOutline({ x: RACK_X0 + STEP * i - 0.3, y: lane.y + 3.6, w: TILE.w + 0.6, d: TILE.d + 0.6, r: 0.5 }, H, P));
  out.push(L(slots.join(""), { tone: "faint" }));
  for (let i = 0; i < SLOTS; i++) out.push(label(RACK_X0 + STEP * i + TILE.w / 2, front, H - 3.6, String(i + 1), 2.4, { anchor: "middle", tone: "lo" }));
  out.push(digitCounter(P, { x: 34, y: front, z: H - 7.6, count: 3, w: 3.6, h: 4.8, gap: 0.5, pad: 0.9, name }));
  out.push(faceText(P, [34, lane.y + 4.6, H], t("WANTED AT #", "BUSCADO #"), { face: "top", size: 2.3, tone: "mid" }));
  out.push(label(lane.x + 3, front, H - 3.6, title, 2.6));
  return out.join("");
}

// The keyword sieve: a framed plate with a grid of holes, the query's words printed on its front.
function sieve() {
  const box = { x: -96, y: LANE_A.y + 1, w: 40, d: LANE_A.d - 2, r: 1 };
  const out = [S(k.slabOf(box, A_H, 5, P, 3, 0.4), { tone: "hi", crease: "lo", inner: L(k.planOutline(k.insetPlan(box, 1.4), A_H + 5, P), { tone: "lo" }) })];
  const holes = [];
  for (let x = box.x + 3.5; x < box.x + box.w - 2; x += 3.2) for (let y = box.y + 3; y < box.y + box.d - 2; y += 2.6) holes.push(at([x, y, A_H + 5]));
  out.push(D(holes, { size: 0.55, tone: "lo" }));
  out.push(faceText(P, [box.x + box.w / 2, box.y + box.d, A_H + 1.4], "e-4072 firmware", { size: 2.4, tone: "hi", anchor: "middle", attr: "data-sieve" }));
  return out.join("");
}

// The meaning magnet: a U magnet lying on lane B, its poles facing the incoming articles, with field lines.
function magnet() {
  const z = B_H, h = 7, yA = LANE_B.y + 1, yB = LANE_B.y + LANE_B.d - 5.5;
  const out = [`<g data-magnet>`];
  out.push(S(k.slabOf({ x: -72, y: yA, w: 7, d: LANE_B.d - 2, r: 1.6 }, z, h, P, 3, 0.4), { tone: "hi", crease: "lo" }));
  for (const y of [yA, yB]) out.push(S(k.slabOf({ x: -92, y, w: 22, d: 4.5, r: 0.8 }, z, h, P, 3, 0.4), { tone: "hi", crease: "lo" }));
  for (const y of [yA, yB]) out.push(S(k.slabOf({ x: -97, y, w: 5, d: 4.5, r: 0.4 }, z, h, P, 2, 0.3), { tone: "lo", crease: "none" }));
  out.push(`</g>`);
  const mid = (yA + yB + 4.5) / 2, half = (yB + 4.5 - yA) / 2 - 2.2;
  const arcs = [];
  for (const r of [3, 5.5, 8]) {
    const pts = [];
    for (let t = 0; t <= 20; t++) { const a = Math.PI * (t / 20); pts.push(at([-97 - r * Math.sin(a), mid - half * Math.cos(a), z + h])); }
    arcs.push(k.pathOf(pts));
  }
  out.push(L(arcs.join(""), { tone: "lo", dashed: true }));
  return out.join("");
}

// The merge hopper with its two ways of merging on top: tokens for reciprocal rank fusion, or a balance beam set to α.
function hopper() {
  const out = [S(k.slabOf(HOPPER, 0, HOPPER_H, P, 3, 0.6), { tone: "mid", inner: L(k.planOutline(k.insetPlan(HOPPER, 3), HOPPER_H, P), { tone: "lo" }) })];
  const front = HOPPER.y + HOPPER.d;
  out.push(faceText(P, [HOPPER.x + HOPPER.w / 2, front, 4.6], "RRF", { size: 4.2, tone: "hi", anchor: "middle", attr: "data-fuse" }));
  out.push(label(HOPPER.x + HOPPER.w / 2, front, 10.4, t("MERGE", "FUSIÓN"), 2.2, { anchor: "middle" }));
  // tokens: one disc per list a candidate came from, 1/(60 + rank) each
  const tokens = [];
  for (const [i, dz] of [[0, 0], [1, 1.2], [2, 2.4]]) tokens.push(S(k.cylinder(HOPPER.x + 8 + i * 6, HOPPER.y + 12, 2.2, HOPPER_H + dz * 0, 1.1 + i * 0.6, P, 18, 0.2), { tone: "hi", crease: "lo" }));
  for (const [i] of [[0], [1], [2]]) tokens.push(S(k.cylinder(HOPPER.x + 8 + i * 6, HOPPER.y + 36, 2.2, HOPPER_H, 2.3 - i * 0.6, P, 18, 0.2), { tone: "hi", crease: "lo" }));
  const beams = {};
  for (const a of [0, 0.3, 0.5, 0.7, 1]) beams["a" + a] = balance(a);
  out.push(variants("fusion", { rrf: tokens.join(""), ...beams }, "rrf"));
  return out.join("");
}
function balance(alpha) {
  const cx = HOPPER.x + HOPPER.w / 2, cy = HOPPER.y + HOPPER.d / 2, top = HOPPER_H + 15;
  const tilt = (alpha - 0.5) * 10;                      // the meaning pan (front) sinks as α grows
  const pa = [cx, HOPPER.y + 8, top + tilt], pb = [cx, HOPPER.y + HOPPER.d - 8, top - tilt];
  const out = [S(k.slabOf({ x: cx - 3, y: cy - 3, w: 6, d: 6, r: 0.6 }, HOPPER_H, 3, P, 2), { tone: "mid", crease: "lo" })];
  out.push(S(k.cylinder(cx, cy, 1.1, HOPPER_H + 3, top - HOPPER_H - 3, P, 12), { tone: "mid", crease: "none" }));
  out.push(L(seg(pa, pb), { tone: "hi" }));
  out.push(D([at([cx, cy, top])], { size: 1.1, tone: "hi" }));
  for (const [p, w] of [[pa, 1 - alpha], [pb, alpha]]) {
    out.push(L(seg([p[0] - 3.5, p[1], p[2] - 6], [p[0], p[1], p[2]]) + seg([p[0] + 3.5, p[1], p[2] - 6], [p[0], p[1], p[2]]), { tone: "mid" }));
    out.push(S(k.cylinder(p[0], p[1], 5.6, p[2] - 7.2, 1.2, P, 24, 0.3), { tone: "hi", crease: "lo" }));
    if (w > 0) out.push(S(k.cylinder(p[0], p[1], 1.6 + 2 * w, p[2] - 6, 0.8 + 3.4 * w, P, 16, 0.2), { tone: "mid", crease: "lo" }));
  }
  return out.join("");
}

// The rerank desk: an inspector behind it re-reading candidates, a stopwatch dial for the time it adds and a
// counter of how many it read; a closed sign when reranking is off.
function desk() {
  const out = [];
  out.push(variants("inspector", { on: person(P, INSPECTOR, { scale: 1.05, hat: "brim" }), lit: person(P, INSPECTOR, { scale: 1.05, hat: "brim", lit: true }), off: "" }, "off"));
  out.push(S(k.slabOf(DESK, 0, DESK_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(DESK, 1.8), DESK_H, P), { tone: "faint" }) }));
  out.push(dial(P, { x: DESK.x + DESK.w - 7, y: DESK.y + 8, z: DESK_H, r: 5, h: 2.4, ticks: 30, every: 5, name: "lat", value: 0 }));
  const front = DESK.y + DESK.d;
  out.push(digitCounter(P, { x: DESK.x + 3, y: front, z: 1.6, count: 3, w: 3.8, h: 5, gap: 0.5, pad: 0.9, name: "reread" }));
  out.push(label(DESK.x + 19, front, 4.6, t("RE-READ", "RELEÍDOS"), 2.1), label(DESK.x + 19, front, 1.8, t("BY RERANK", "POR RERANK"), 2.1));
  out.push(`<g data-closed>${plaque(P, { x: DESK.x + 2.5, y: DESK.y + 4, z: DESK_H, w: 22, d: 8, text: t("NO RERANK", "SIN RERANK"), size: 2.5 })}</g>`);
  return out.join("");
}

// The results shelf, with the result rank of the article we want.
function shelf() {
  const out = [S(k.slabOf(SHELF, 0, SHELF_H, P, 3, 0.5), { tone: "mid" })];
  const front = SHELF.y + SHELF.d;
  out.push(L(Array.from({ length: SLOTS }, (_, i) => k.planOutline({ x: SHELF_X0 + STEP * i - 0.3, y: SHELF.y + 3.6, w: TILE.w + 0.6, d: TILE.d + 0.6, r: 0.5 }, SHELF_H, P)).join(""), { tone: "faint" }));
  for (let i = 0; i < SLOTS; i++) out.push(label(SHELF_X0 + STEP * i + TILE.w / 2, front, SHELF_H - 3.6, String(i + 1), 2.4, { anchor: "middle", tone: "lo" }));
  out.push(faceText(P, [SHELF.x + 2, SHELF.y + 2.6, SHELF_H], t("RESULTS", "RESULTADOS"), { face: "top", size: 2.4, tone: "mid" }));
  return out.join("");
}

// The scoreboard: recall@10 over every query of each kind, for the settings in use, and the time per query.
function board() {
  const out = [S(k.slabOf(BOARD, 0, BOARD_H, P, 3, 0.6), { tone: "mid", inner: L(k.planOutline(k.insetPlan(BOARD, 2), BOARD_H, P), { tone: "faint" }) })];
  const front = BOARD.y + BOARD.d;
  const cells = [[t("EXACT ID", "ID EXACTO"), "rexact", 3], [t("PARAPHRASE", "PARÁFRASIS"), "rparaphrase", 3], [t("MIXED", "MIXTAS"), "rmixed", 3], [t("MS / QUERY", "MS / CONSULTA"), "ms", 3]];
  cells.forEach(([title, name, n], i) => {
    const x = BOARD.x + 4 + i * 24.6;
    out.push(digitCounter(P, { x, y: front, z: 2.6, count: n, w: 5.2, h: 7.6, gap: 0.7, pad: 1.1, name }));
    out.push(label(x - 0.6, front, 13, title, 2.1));
  });
  out.push(faceText(P, [BOARD.x + 5, BOARD.y + 5, BOARD_H], t("FOUND IN THE TOP 10, %", "HALLADOS EN EL TOP 10, %"), { face: "top", size: 2.6, tone: "mid" }));
  return out.join("");
}

// One article tile: a block with its number on the front. Wrapped so the number stays readable when lit.
export function tileSvg() {
  const b = { x: -TILE.w / 2, y: -TILE.d / 2, w: TILE.w, d: TILE.d, r: 0.6 };
  return `<g class="wb-lit-group">${S(k.slabOf(b, 0, TILE.h, P, 2, 0.3), { tone: "hi", crease: "lo" }).replace('class="iso-solid"', 'class="iso-solid" data-body')}`
    + faceText(P, [0, TILE.d / 2, 1.2], "0", { size: 2.7, tone: "hi", anchor: "middle", attr: "data-num" }) + `</g>`;
}
// static tiles at every slot, filled in by the page
function slots(prefix, spots) {
  return spots.map((p, i) => `<g data-slot="${prefix}${i}" transform="${k.translateAlong(P, p)}" style="display:none">${tileSvg()}</g>`).join("");
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A two-lane sorting plant on a base plate. At the back left a query board on posts shows the search query, and a splitter block feeds it down two lanes. The back lane is raised: a sieve plate with holes cut to the query's exact words, then a rack of ten numbered slots holding the articles that fell through, best keyword match first. The front lane has a U-shaped magnet that pulls articles by meaning, then its own rack of the ten nearest. Both racks end at a merge hopper with tokens on top for reciprocal rank fusion, or a balance beam set to the weight between the lanes. In front of the hopper an inspector stands at a rerank desk with a stopwatch dial; then a results shelf of ten slots. The article the query wants is shown filled in on every rack. A scoreboard at the front right shows the percentage of exact-identifier, paraphrase and mixed queries answered in the top ten, and the milliseconds per query. Each rack has a counter for where the wanted article ranked in that lane.",
      "Una planta clasificadora de dos carriles sobre una placa base. Atrás a la izquierda, un tablero sobre postes muestra la consulta, y un bloque divisor la manda por dos carriles. El carril de atrás está elevado: una placa de criba con agujeros cortados a la medida de las palabras exactas de la consulta, y después un estante de diez lugares numerados con los artículos que pasaron, la mejor coincidencia de palabras clave primero. El carril de adelante tiene un imán en U que atrae los artículos por significado, y después su propio estante con los diez más cercanos. Los dos estantes terminan en una tolva de fusión con fichas encima para la fusión de rango recíproco, o una balanza ajustada al peso entre los carriles. Delante de la tolva, un inspector está en un escritorio de reranking con un cronómetro; después, un estante de resultados de diez lugares. El artículo que busca la consulta aparece relleno en cada estante. Un marcador adelante a la derecha muestra el porcentaje de consultas de identificador exacto, de paráfrasis y mixtas resueltas en el top diez, y los milisegundos por consulta. Cada estante tiene un contador del puesto en que ese carril puso el artículo buscado.",
    ),
    body: [
      plate(),
      entry(),
      rack(LANE_A, A_H, "ranka", t("KEYWORDS", "PALABRAS CLAVE")),
      sieve(),
      slots("a", LANE_SLOTS.a),
      hopper(),
      rack(LANE_B, B_H, "rankb", t("MEANING", "SIGNIFICADO")),
      magnet(),
      slots("b", LANE_SLOTS.b),
      desk(),
      `<g data-reading transform="${k.translateAlong(P, READ_SPOT)}" style="display:none">${tileSvg()}</g>`,
      shelf(),
      slots("f", SHELF_SLOTS),
      board(),
    ],
  });
}

export const GEOMETRY = { LANE_SLOTS, SHELF_SLOTS, READ_SPOT, SLOTS };

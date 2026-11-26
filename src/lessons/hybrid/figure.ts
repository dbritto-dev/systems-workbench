// @ts-nocheck: figure code ported as-is; drawing shorthands come from src/lib/draw.
// A two-lane sorting plant for search queries.
//   the query board at the back left shows the query; the splitter sends it down two lanes;
//   lane A (raised, at the back) is a keyword sieve: a plate with holes cut to the query's exact words, and a rack
//   of the articles that fell through, best BM25 score first;
//   lane B (in front) is a meaning magnet: articles slide toward it by similarity, and its rack holds the nearest;
//   both racks pour into the merge hopper (reciprocal-rank tokens, or a balance beam set to α for a weighted sum),
//   then the rerank desk, where an inspector re-reads the top candidates, then the results shelf;
//   the scoreboard in front shows recall@10 for each kind of query. Words come out at 11 px on a desktop.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, rulerStrip, digitCounter, person, dial, sign, plaque, faceText, variants, rack as slotRack } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 720;
export const HEIGHT = 450;

const PLATE = { x: -152, y: -90, w: 304, d: 124, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// lanes: A (keywords) raised at the back, B (meaning) low in front. Tiles are wide enough for a three-digit article
// number at 11 px on a desktop (TXT, below).
const LANE_A = { x: -128, y: -80, w: 186, d: 14, r: 1 }, A_H = 18;
const LANE_B = { x: -128, y: -50, w: 186, d: 14, r: 1 }, B_H = 9;
export const SLOTS = 10;
const RACK_X0 = -90, STEP = 14.6;
export const TILE = { w: 12.6, d: 8, h: 6.4 };
export const LANE_SLOTS = {
  a: Array.from({ length: SLOTS }, (_, i) => [RACK_X0 + STEP * i + TILE.w / 2, LANE_A.y + LANE_A.d / 2, A_H]),
  b: Array.from({ length: SLOTS }, (_, i) => [RACK_X0 + STEP * i + TILE.w / 2, LANE_B.y + LANE_B.d / 2, B_H]),
};

const SPLIT = { x: -148, y: -80, w: 16, d: 44, r: 1.5 }, SPLIT_H = 12;
const HOPPER = { x: 62, y: -80, w: 34, d: 44, r: 2 }, HOPPER_H = 14;
const DESK = { x: 100, y: -76, w: 50, d: 22, r: 1.4 }, DESK_H = 10;
const SHELF = { x: -138, y: 6, w: 156, d: 14, r: 1 }, SHELF_H = 10;
const SHELF_X0 = SHELF.x + 5;
export const SHELF_SLOTS = Array.from({ length: SLOTS }, (_, i) => [SHELF_X0 + STEP * i + TILE.w / 2, SHELF.y + SHELF.d / 2, SHELF_H]);
const BOARD = { x: 22, y: 4, w: 128, d: 24, r: 1.5 }, BOARD_H = 16;
export const READ_SPOT = [DESK.x + 9, DESK.y + 12, DESK_H];
export const INSPECTOR = [DESK.x + 30, DESK.y - 7, 0];

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [SPLIT.x, SPLIT.y - 10, 40], [HOPPER.x + HOPPER.w, HOPPER.y, HOPPER_H + 22], [BOARD.x + BOARD.w, BOARD.y + BOARD.d, BOARD_H]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 52 },
);

const { S, L, D, at, seg } = shorthand(P);
// Words on the machine come out at 11 px or more on a desktop (workbench/kit.mjs textSize; tools/text-size.cjs).
// TXT: on a face of constant y; TOP: lying on a top face; WH: a counter's wheel height.
export const TXT = k.textSize(P, 11.2, { width: WIDTH });
const TOP = k.textSize(P, 11.2, { width: WIDTH, face: "top" });
const WH = k.wheelHeight(P, 11.2, { width: WIDTH }), WW = +(WH * 0.74).toFixed(2);
const label = (x, y, z, text, opts = {}) => faceText(P, [x, y, z], text, { size: TXT, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H }) + rulerStrip(P, { x: -120, y: 25, w: 96, d: 6, r: 1 });
}

// The query board on two posts behind the splitter, and the splitter block that feeds both lanes.
function entry() {
  const out = [sign(P, { x: -150, y: -84, z: 26, w: 72, h: 9, text: "E-4072 firmware", size: TXT, attr: "data-query" })];
  out.push(S(k.slabOf(SPLIT, 0, SPLIT_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(SPLIT, 2), SPLIT_H, P), { tone: "faint" }) }));
  // two chutes from the splitter: one climbing to lane A, one level with lane B
  out.push(S(k.slabOf({ x: SPLIT.x + SPLIT.w, y: LANE_A.y + 3, w: 4, d: 8, r: 0.4 }, SPLIT_H, A_H - SPLIT_H, P, 2), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf({ x: SPLIT.x + SPLIT.w, y: LANE_B.y + 3, w: 4, d: 8, r: 0.4 }, 0, B_H, P, 2), { tone: "lo", crease: "none" }));
  return out.join("");
}

// A rack: the lane's bed with ten slot outlines on top (rank 1 at the left), its name on the front, and a word that
// shows when the lane is switched off.
// The kit's rack, with this machine's slot grid (tiles TILE wide, STEP apart, from RACK_X0).
const rackSpec = (plan, h, name, x0) => ({ ...plan, h, cols: SLOTS, cell: { w: TILE.w, d: TILE.d }, gap: STEP - TILE.w, pad: x0 - plan.x, name });
function rack(lane, H, key, title) {
  const out = [slotRack(P, rackSpec(lane, H, key, RACK_X0))];
  const front = lane.y + lane.d;
  out.push(label(lane.x + 3, front, H - 6.4, title));
  out.push(label(RACK_X0 + 2, front, H - 6.4, "", { tone: "hi", attr: `data-off-word="${key}"` }));
  return out.join("");
}

// The keyword sieve: a framed plate with a grid of holes cut to the query's exact words.
function sieve() {
  const box = { x: -125, y: LANE_A.y + 1, w: 32, d: LANE_A.d - 2, r: 1 };
  const out = [S(k.slabOf(box, A_H, 5, P, 3, 0.4), { tone: "hi", crease: "lo", inner: L(k.planOutline(k.insetPlan(box, 1.4), A_H + 5, P), { tone: "lo" }) })];
  const holes = [];
  for (let x = box.x + 3.5; x < box.x + box.w - 2; x += 3.2) for (let y = box.y + 3; y < box.y + box.d - 2; y += 2.6) holes.push(at([x, y, A_H + 5]));
  out.push(D(holes, { size: 0.55, tone: "lo" }));
  return out.join("");
}

// The meaning magnet: a U magnet lying on lane B, its poles facing the incoming articles, with field lines.
function magnet() {
  const z = B_H, h = 7, yA = LANE_B.y + 1, yB = LANE_B.y + LANE_B.d - 5.5, dx = -22;
  const out = [`<g data-magnet>`];
  out.push(S(k.slabOf({ x: -72 + dx, y: yA, w: 7, d: LANE_B.d - 2, r: 1.6 }, z, h, P, 3, 0.4), { tone: "hi", crease: "lo" }));
  for (const y of [yA, yB]) out.push(S(k.slabOf({ x: -92 + dx, y, w: 22, d: 4.5, r: 0.8 }, z, h, P, 3, 0.4), { tone: "hi", crease: "lo" }));
  for (const y of [yA, yB]) out.push(S(k.slabOf({ x: -97 + dx, y, w: 5, d: 4.5, r: 0.4 }, z, h, P, 2, 0.3), { tone: "lo", crease: "none" }));
  out.push(`</g>`);
  const mid = (yA + yB + 4.5) / 2, half = (yB + 4.5 - yA) / 2 - 2.2;
  const arcs = [];
  for (const r of [3, 5.5, 8]) {
    const pts = [];
    for (let t = 0; t <= 20; t++) { const a = Math.PI * (t / 20); pts.push(at([-97 + dx - r * Math.sin(a), mid - half * Math.cos(a), z + h])); }
    arcs.push(k.pathOf(pts));
  }
  out.push(L(arcs.join(""), { tone: "lo", dashed: true }));
  return out.join("");
}

// The merge hopper with its two ways of merging on top: tokens for reciprocal rank fusion, or a balance beam set to α.
function hopper() {
  const out = [S(k.slabOf(HOPPER, 0, HOPPER_H, P, 3, 0.6), { tone: "mid", inner: L(k.planOutline(k.insetPlan(HOPPER, 3), HOPPER_H, P), { tone: "lo" }) })];
  const front = HOPPER.y + HOPPER.d;
  out.push(label(HOPPER.x + HOPPER.w / 2, front, 1.8, "RRF", { tone: "hi", anchor: "middle", attr: "data-fuse" }));
  out.push(label(HOPPER.x + HOPPER.w / 2, front, 8, t("MERGE", "FUSIÓN"), { anchor: "middle" }));
  // tokens: one disc per list a candidate came from, 1/(60 + rank) each
  const tokens = [];
  for (const [i, dz] of [[0, 0], [1, 1.2], [2, 2.4]]) tokens.push(S(k.cylinder(HOPPER.x + 11 + i * 6, HOPPER.y + 11, 2.2, HOPPER_H + dz * 0, 1.1 + i * 0.6, P, 18, 0.2), { tone: "hi", crease: "lo" }));
  for (const [i] of [[0], [1], [2]]) tokens.push(S(k.cylinder(HOPPER.x + 11 + i * 6, HOPPER.y + 33, 2.2, HOPPER_H, 2.3 - i * 0.6, P, 18, 0.2), { tone: "hi", crease: "lo" }));
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
  out.push(dial(P, { x: DESK.x + DESK.w - 6.5, y: DESK.y + 9, z: DESK_H, r: 4.6, h: 2.4, ticks: 30, every: 5, name: "lat", value: 0 }));
  const front = DESK.y + DESK.d;
  out.push(digitCounter(P, { x: DESK.x + 2, y: front, z: 1.2, count: 3, w: WW, h: WH, gap: 0.5, pad: 0.8, name: "reread" }));
  out.push(label(DESK.x + 6 + 3 * (WW + 0.5), front, 2.2, t("RE-READ", "RELEÍDOS")));
  out.push(`<g data-closed>${plaque(P, { x: DESK.x + 2, y: DESK.y + 5, z: DESK_H, w: 37, d: 10, text: t("NO RERANK", "SIN RERANK"), size: TOP })}</g>`);
  return out.join("");
}

// The results shelf: the merged top ten, rank 1 at the left.
function shelf() {
  const out = [slotRack(P, rackSpec(SHELF, SHELF_H, "results", SHELF_X0))];
  const front = SHELF.y + SHELF.d;
  out.push(label(SHELF.x + 3, front, 2.2, t("RESULTS", "RESULTADOS")));
  return out.join("");
}

// The scoreboard: recall@10 over every query of each kind, for the settings in use.
function board() {
  const out = [S(k.slabOf(BOARD, 0, BOARD_H, P, 3, 0.6), { tone: "mid", inner: L(k.planOutline(k.insetPlan(BOARD, 2), BOARD_H, P), { tone: "faint" }) })];
  const front = BOARD.y + BOARD.d;
  const cells = [[t("EXACT ID", "ID EXACTO"), "rexact"], [t("PARAPHRASE", "PARÁFRASIS"), "rparaphrase"], [t("MIXED", "MIXTAS"), "rmixed"]];
  cells.forEach(([title, name], i) => {
    const x = BOARD.x + 3 + i * 44;
    out.push(digitCounter(P, { x, y: front, z: 1.6, count: 3, w: WW, h: WH, gap: 0.6, pad: 1, name }));
    out.push(label(x - 0.4, front, 11.2, title));
  });
  out.push(faceText(P, [BOARD.x + 4, BOARD.y + 6, BOARD_H], t("FOUND IN THE TOP 10, %", "HALLADOS EN EL TOP 10, %"), { face: "top", size: TOP, tone: "mid" }));
  return out.join("");
}

// One article tile: a block with its number on the front. Wrapped so the number stays readable when lit.
export function tileSvg() {
  const b = { x: -TILE.w / 2, y: -TILE.d / 2, w: TILE.w, d: TILE.d, r: 0.6 };
  return `<g class="wb-lit-group">${S(k.slabOf(b, 0, TILE.h, P, 2, 0.3), { tone: "hi", crease: "lo" }).replace('class="iso-solid"', 'class="iso-solid" data-body')}`
    + faceText(P, [0, TILE.d / 2, 1.5], "0", { size: TXT, tone: "hi", anchor: "middle", attr: "data-num" }) + `</g>`;
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
      "A two-lane sorting plant on a base plate. At the back left a query board on posts shows the search query, and a splitter block feeds it down two lanes. The back lane is raised: a sieve plate with holes cut to the query's exact words, then a rack of ten slots holding the articles that fell through, best keyword match first. The front lane has a U-shaped magnet that pulls articles by meaning, then its own rack of the ten nearest. Both racks end at a merge hopper with tokens on top for reciprocal rank fusion, or a balance beam set to the weight between the lanes. Beside the hopper an inspector stands at a rerank desk with a stopwatch dial and a counter of the candidates re-read; in front, a results shelf of ten slots. The article the query wants is shown filled in on every rack. A scoreboard at the front right shows the percentage of exact-identifier, paraphrase and mixed queries answered in the top ten.",
      "Una planta clasificadora de dos carriles sobre una placa base. Atrás a la izquierda, un tablero sobre postes muestra la consulta, y un bloque divisor la manda por dos carriles. El carril de atrás está elevado: una placa de criba con agujeros cortados a la medida de las palabras exactas de la consulta, y después un estante de diez lugares con los artículos que pasaron, la mejor coincidencia de palabras clave primero. El carril de adelante tiene un imán en U que atrae los artículos por significado, y después su propio estante con los diez más cercanos. Los dos estantes terminan en una tolva de fusión con fichas encima para la fusión recíproca de rankings, o una balanza ajustada al peso entre los carriles. Junto a la tolva, un inspector está en un escritorio de reranking con un cronómetro y un contador de los candidatos releídos; adelante, un estante de resultados de diez lugares. El artículo que busca la consulta aparece relleno en cada estante. Un marcador adelante a la derecha muestra el porcentaje de consultas de identificador exacto, de paráfrasis y mixtas resueltas en el top diez.",
    ),
    body: [
      plate(),
      entry(),
      rack(LANE_A, A_H, "a", t("KEYWORDS", "PALABRAS CLAVE")),
      sieve(),
      slots("a", LANE_SLOTS.a),
      hopper(),
      rack(LANE_B, B_H, "b", t("MEANING", "SIGNIFICADO")),
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

// The phone lens's regions (src/lib/lens.ts), each small enough for the close-up: the head of both lanes (the query,
// the sieve, the magnet and the first slots), the merge hopper with the rerank desk, the results shelf, and the
// scoreboard.
const LANES_Y = { y: LANE_A.y, d: LANE_B.y + LANE_B.d - LANE_A.y };
export const REGIONS = [
  { id: "lanes", label: t("Lanes", "Carriles"), box: k.screenBox(P, k.boxCorners({ x: SPLIT.x, ...LANES_Y, w: RACK_X0 + STEP * 5 - SPLIT.x }, 0, A_H + TILE.h)) },
  { id: "merge", label: t("Merge", "Fusión"), box: k.screenBox(P, [...k.boxCorners(HOPPER, 0, HOPPER_H + 22), ...k.boxCorners(DESK, 0, 26)]) },
  { id: "results", label: "Top 10", box: k.screenBox(P, k.boxCorners(SHELF, 0, SHELF_H + TILE.h), 2) },
  { id: "score", label: t("Score", "Tabla"), box: k.screenBox(P, k.boxCorners(BOARD, 0, BOARD_H)) },
];

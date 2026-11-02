// @ts-nocheck: figure code ported as-is; drawing shorthands come from src/lib/draw.
// A star-map table for semantic search.
//   every chunk of the help centre is a stud on a dark map, placed by a flat picture of its vector,
//   so chunks that mean similar things sit together in constellations (named on the map);
//   the query is a lamp on a post set down among the chunks it is closest to;
//   strings run from the lamp to the k nearest studs, which light and carry their rank;
//   exact search sweeps an arm across every stud; the index (a graph) hops a probe along links instead;
//   the rack in front holds the results with their similarity on counters, the console the query.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { sphereOf } from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, card, faceText } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 400;

const PLATE = { x: -118, y: -112, w: 236, d: 178, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

export const MAP = { x: -110, y: -104, w: 220, d: 124, r: 6 };
export const MAP_H = 7;
export const FIELD = { x: MAP.x + 4, y: MAP.y + 4, w: MAP.w - 8, d: MAP.d - 8, pad: 10 };   // where studs may sit

const CONSOLE = { x: -114, y: 28, w: 92, d: 22, r: 2 };
const CONSOLE_H = 8;
const BOARD = { x: CONSOLE.x + 4, y: CONSOLE.y + 6, w: 84, h: 11 };

const RACK = { x: -14, y: 28, w: 126, d: 22, r: 2 };
const RACK_H = 6;
export const SLOTS = 5;
export const SLOT_X = Array.from({ length: SLOTS }, (_, i) => RACK.x + 4 + i * 24.4);
const CARD = { w: 14, h: 12, y: RACK.y + 9 };

export const PIN = { sentence: { r: 3.1, h: 3.4 }, section: { r: 4, h: 3.6 }, doc: { r: 5.4, h: 3.8 } };
export const LAMP = { r: 3, post: 12, base: 3.2 };
export const LAMP_TOP = MAP_H + 1.2 + LAMP.post + LAMP.r * 2;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [MAP.x, MAP.y, MAP_H + 26], [MAP.x + MAP.w, MAP.y, MAP_H + 26], [BOARD.x, BOARD.y, CONSOLE_H + BOARD.h + 2]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 50 },
);

const { S, L } = shorthand(P);
const label = (x, y, z, text, size = 2.6, face = "y") => faceText(P, [x, y, z], text, { size, tone: "mid", face });

// The table: a base plate carrying a dark map slab whose top is ruled like a star chart.
function table() {
  const out = [basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })];
  out.push(S(k.slabOf(MAP, 0, MAP_H, P, 4, 0.6), { tone: "lo", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(MAP, 3), MAP_H, P), { tone: "mid" }));
  const grid = [];
  for (let x = MAP.x + 3 + 24; x < MAP.x + MAP.w - 6; x += 24) grid.push(k.lineOnTop([x, MAP.y + 3], [x, MAP.y + MAP.d - 3], MAP_H, P));
  for (let y = MAP.y + 3 + 20; y < MAP.y + MAP.d - 6; y += 20) grid.push(k.lineOnTop([MAP.x + 3, y], [MAP.x + MAP.w - 3, y], MAP_H, P));
  out.push(L(grid.join(""), { tone: "faint", dotted: true }));
  return out.join("");
}

// The query console: a desk with the query printed on a standing board, and counters for how many
// chunks the search compared out of how many there are.
function consoleDesk() {
  const out = [S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 3, 0.5), { tone: "mid" })];
  const front = CONSOLE.y + CONSOLE.d;
  out.push(digitCounter(P, { x: CONSOLE.x + 4, y: front, z: 1.4, count: 2, w: 4.4, h: 5.2, gap: 0.6, pad: 1.1, name: "compared" }));
  out.push(label(CONSOLE.x + 17, front, 4.4, t("COMPARED", "FRAGMENTOS"), 2.3), label(CONSOLE.x + 17, front, 1.6, t("CHUNKS", "COMPARADOS"), 2.3));
  out.push(label(CONSOLE.x + 50, front, 3, t("OF", "DE"), 2.6));
  out.push(digitCounter(P, { x: CONSOLE.x + 57, y: front, z: 1.4, count: 2, w: 4.4, h: 5.2, gap: 0.6, pad: 1.1, name: "total" }));
  // the board: two legs and a panel; the query reads across its face
  const by = BOARD.y, z0 = CONSOLE_H + 1.4;
  for (const x of [BOARD.x + 6, BOARD.x + BOARD.w - 6]) out.push(S(k.slabOf({ x: x - 1, y: by - 1, w: 2, d: 2, r: 0.3 }, CONSOLE_H, 1.6, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: BOARD.x, y: by - 1.2, w: BOARD.w, d: 1.2, r: 0.2 }, z0, BOARD.h, P, 2), { tone: "hi", crease: "lo" }));
  out.push(faceText(P, [BOARD.x + 3, by, z0 + BOARD.h - 3.4], t("QUERY", "CONSULTA"), { size: 2.2, tone: "mid" }));
  out.push(faceText(P, [BOARD.x + 3, by, z0 + 2.6], "", { size: 3.9, tone: "hi", attr: "data-query" }));
  return out.join("");
}

// The results rack: five slots, each with a standing card (the chunk), its rank printed on the rack
// top and its similarity on counters below. Slots beyond k are covered by a lid.
function rack() {
  const out = [S(k.slabOf(RACK, 0, RACK_H, P, 3, 0.5), { tone: "mid" })];
  const front = RACK.y + RACK.d;
  SLOT_X.forEach((x, i) => {
    out.push(L(k.planOutline({ x: x - 1, y: RACK.y + 3, w: 22, d: 16, r: 1 }, RACK_H, P), { tone: "faint" }));
    out.push(faceText(P, [x + 1.2, RACK.y + 17.6, RACK_H], String(i + 1), { face: "top", size: 3.4, tone: "mid", attr: `data-rank="${i}"` }));
    out.push(`<g data-slot="${i}">`);
    out.push(`<g class="wb-lit-group" data-card="${i}">${card(P, { x: x + 4.5, y: CARD.y, z: RACK_H, w: CARD.w, h: CARD.h, text: "A1.1", size: 3.8, attr: `data-card-text="${i}"` })}</g>`);
    out.push(`<g data-cut="${i}" style="display:none">${L(k.lineOnTop([x + 2, RACK.y + 14], [x + 19, RACK.y + 14], RACK_H, P), { tone: "hi" })}${faceText(P, [x + 10.5, RACK.y + 10.8, RACK_H], t("BELOW CUTOFF", "BAJO UMBRAL"), { face: "top", size: 2.4, tone: "hi", anchor: "middle" })}</g>`);
    out.push(`</g>`);
    out.push(`<g data-simbox="${i}">${faceText(P, [x - 0.4, front, 1.9], "0.", { size: 4.6, tone: "mid" })}${digitCounter(P, { x: x + 5.4, y: front, z: 1.2, count: 2, w: 4.2, h: 5, gap: 0.5, pad: 1, name: "sim" + i })}</g>`);
    out.push(`<g data-lid="${i}" style="display:none">${S(k.slabOf({ x: x - 1, y: RACK.y + 3, w: 22, d: 16, r: 1 }, RACK_H, 1, P, 3, 0.2), { tone: "lo", crease: "none" })}</g>`);
  });
  return out.join("");
}

// A stud, drawn at the origin and moved with translateAlong: a round stud whose top can carry
// its rank. Three sizes: sentence, section, whole document.
export function studSvg(size) {
  const { r, h } = PIN[size];
  const out = [`<g class="wb-lit-group">`];
  out.push(S(k.cylinder(0, 0, r, MAP_H, h, P, 20, 0.3), { tone: "hi", crease: "lo" }).replace('class="iso-solid"', 'class="iso-solid" data-body'));
  out.push(faceText(P, [0, 0.9, MAP_H + h], "", { face: "top", size: r * 1.15, tone: "hi", anchor: "middle", attr: "data-rank" }));
  out.push(`</g>`);
  return out.join("");
}
// The query lamp: a foot, a post and a lamp head; strings leave from the top of the head.
export function lampSvg() {
  const out = [S(k.cylinder(0, 0, LAMP.base, MAP_H, 1.2, P, 22, 0.3), { tone: "mid", crease: "lo" })];
  out.push(S(k.cylinder(0, 0, 0.7, MAP_H + 1.2, LAMP.post, P, 12), { tone: "mid", crease: "none" }));
  out.push(S(sphereOf([0, 0, MAP_H + 1.2 + LAMP.post + LAMP.r], LAMP.r, P), { tone: "hi", crease: "lo" }).replace('class="iso-solid"', 'class="iso-solid" data-head'));
  return out.join("");
}
// The exact-search arm: a bar spanning the map's depth, slid across it.
export function armSvg() {
  return S(k.slabOf({ x: -1, y: MAP.y + 1, w: 2, d: MAP.d - 2, r: 0.4 }, MAP_H + 4, 1.4, P, 2), { tone: "hi", crease: "lo", lit: true })
    + S(k.cylinder(0, MAP.y + 1.6, 1, MAP_H, 4, P, 10), { tone: "mid", crease: "none" })
    + S(k.cylinder(0, MAP.y + MAP.d - 1.6, 1, MAP_H, 4, P, 10), { tone: "mid", crease: "none" });
}
// The graph probe: a bead that hops along the links.
export function beadSvg() { return S(sphereOf([0, 0, MAP_H + 2.2], 1.8, P), { tone: "hi", crease: "lo", lit: true }); }

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A star-map table for semantic search. A dark map lies on a base plate, ruled like a star chart; every chunk of a small help centre is a round stud on it, placed so that chunks with similar meaning sit together in named constellations. A lamp on a post stands among the studs closest to the query, with strings running from the lamp to the nearest studs, which light and carry their rank. For an exact search an arm sweeps across every stud; with the index, a bead hops along links between studs instead. In front, a console shows the query on a standing board and counts how many chunks were compared; a rack holds the results as cards in rank order, each with its similarity on counters.",
      "Una mesa con un mapa estelar para la búsqueda semántica. Un mapa oscuro sobre una placa base, cuadriculado como una carta estelar; cada fragmento de un pequeño centro de ayuda es un perno redondo sobre él, ubicado de modo que los fragmentos con significado parecido queden juntos en constelaciones con nombre. Una lámpara sobre un poste se para entre los pernos más cercanos a la consulta, con hilos que van de la lámpara a los pernos más cercanos, que se encienden y muestran su puesto. En una búsqueda exacta, un brazo barre todos los pernos; con el índice, en cambio, una bolita salta por los enlaces entre pernos. Adelante, una consola muestra la consulta en un tablero y cuenta cuántos fragmentos se compararon; un estante tiene los resultados como tarjetas en orden de puesto, cada una con su similitud en contadores.",
    ),
    body: [
      table(),
      `<g data-layer="links"></g>`,
      `<g data-layer="labels"></g>`,
      `<g data-layer="rings"></g>`,
      `<g data-layer="pins"></g>`,
      `<g data-layer="probe"></g>`,
      `<g data-layer="strings"></g>`,
      consoleDesk(),
      rack(),
    ],
  });
}

export const LABEL_SIZE = 3.1;
export const GEOMETRY = { MAP, MAP_H, FIELD, SLOT_X, SLOTS, PIN, LAMP_TOP, LABEL_SIZE };
export const labelSvg = () => faceText(P, [0, 0, MAP_H], "", { face: "top", size: LABEL_SIZE, tone: "mid", anchor: "middle", attr: "data-label" });

// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A component board: the shop page's React tree laid out on a bench, root at the back, each level one row nearer the
// front. Every component is a block (or a stud on a tray, for the ones that come by the dozen) wired to its parent.
// A render lights the block; the wave runs down the wires. STATE plaques mark where the state lives, gates on the wires are
// React.memo, the store stands at the back right, and the page lies at the front: the DOM, where only what changed is
// redrawn. Counters on the console count renders and DOM changes, a meter shows the work against one frame.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, meter, plaque, faceText, variants } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { NODES, CARDS } from "./sim";

export const WIDTH = 700;
export const HEIGHT = 372;

const PLATE = { x: -162, y: -108, w: 268, d: 168, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// Rows of the tree (y of each row's back edge), back to front.
const ROW = [-96, -72, -52, -31];
const BUS_Y = -79;

// Single components: centre x, row, width, depth, height, label.
export const BLOCKS = {
  App: { cx: -40, row: 0, w: 40, d: 10, h: 7, label: "APP" },
  Header: { cx: -121.5, row: 1, w: 24, d: 8, h: 6, label: "HEADER" },
  Sidebar: { cx: -66, row: 1, w: 24, d: 8, h: 6, label: "SIDEBAR" },
  SearchPanel: { cx: -9.5, row: 1, w: 24, d: 8, h: 6, label: "SEARCH" },
  Footer: { cx: 44, row: 1, w: 24, d: 8, h: 6, label: "FOOTER" },
  Logo: { cx: -144, row: 2, w: 13, d: 8, h: 5, label: "LOGO" },
  Nav: { cx: -129, row: 2, w: 13, d: 8, h: 5, label: "NAV" },
  UserMenu: { cx: -114, row: 2, w: 13, d: 8, h: 5, label: "USER" },
  CartBadge: { cx: -99, row: 2, w: 13, d: 8, h: 5, label: "CART" },
  PriceChart: { cx: -77, row: 2, w: 18, d: 10, h: 9, label: "CHART" },
  SearchInput: { cx: -30, row: 2, w: 15, d: 8, h: 5, label: "INPUT" },
  Suggestions: { cx: -11, row: 2, w: 19, d: 8, h: 5, label: "SUGGEST" },
  ResultList: { cx: 12, row: 2, w: 15, d: 8, h: 5, label: "LIST" },
};
// Components that come many at a time: a tray of studs, one stud per component.
export const BANKS = {
  NavLink: { cx: -129, row: 3, cols: 3, rows: 2, pitch: 4.2, label: "LINK ×6" },
  Filter: { cx: -55, row: 2, cols: 4, rows: 3, pitch: 4.2, label: "FILTER ×12" },
  ResultCard: { cx: 12, row: 3, cols: 8, rows: 6, pitch: 4.2, label: "CARD ×48" },
  FooterLink: { cx: 44, row: 2, cols: 4, rows: 2, pitch: 4.2, label: "LINK ×8" },
};
const STUD = 3.1, TRAY_PAD = 1.8, TRAY_H = 1.6, STUD_H = 1.5;
const trayOf = (b) => {
  const w = b.cols * b.pitch + 2 * TRAY_PAD - (b.pitch - STUD), d = b.rows * b.pitch + 2 * TRAY_PAD - (b.pitch - STUD);
  return { x: b.cx - w / 2, y: ROW[b.row], w, d, r: 1 };
};
export const studAt = (b, i) => {
  const tr = trayOf(b);
  return [tr.x + TRAY_PAD + (i % b.cols) * b.pitch, tr.y + TRAY_PAD + Math.floor(i / b.cols) * b.pitch];
};
const planOf = (b) => ({ x: b.cx - b.w / 2, y: ROW[b.row], w: b.w, d: b.d, r: 1 });

// The store (back right), the console (front left) and the page (front, lying flat).
const STORE = { x: 64, y: -102, w: 32, d: 16, r: 1.5 };
const STORE_H = 8;
const DRUM = { x: 87, y: -95, r: 6.5, h: 13 };
const CONSOLE = { x: -156, y: 16, w: 74, d: 16, r: 1.5 };
const CONSOLE_H = 16;
export const PAGE = { x: -70, y: 8, w: 160, d: 40 };
const PAGE_Z = 0.7;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [DRUM.x, DRUM.y, STORE_H + DRUM.h + 12], [BLOCKS.App.cx, ROW[0], 22], [CONSOLE.x, CONSOLE.y, 26]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 56 },
);

const { S, L, D, at } = shorthand(P);
const slab = (plan, z, h, steps = 3, bevel = 0.3) => k.slabOf({ r: 0.6, ...plan }, z, h, P, steps, bevel);
const text = (x, y, z, words, size = 2.4, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });

// ---------- where each component sits ----------
const nameOf = (id) => NODES[id].name;
// The point an edge leaves from (front middle of a block) and arrives at (back middle of a block or tray).
function anchor(name) {
  if (BLOCKS[name]) { const b = BLOCKS[name]; return { cx: b.cx, back: ROW[b.row], front: ROW[b.row] + b.d }; }
  const b = BANKS[name], tr = trayOf(b);
  return { cx: b.cx, back: tr.y, front: tr.y + tr.d };
}
// One edge per child name (a tray counts once): a path along the plate from the parent's front to the child's back.
export const EDGES = {};
for (const n of NODES) {
  if (n.parent === null || EDGES[n.name]) continue;
  const p = anchor(nameOf(n.parent)), c = anchor(n.name);
  const midY = n.parent === 0 ? BUS_Y : p.front + 3;
  const pts = [[p.cx, p.front], [p.cx, midY], [c.cx, midY], [c.cx, c.back]];
  EDGES[n.name] = pts.filter((q, i) => i === 0 || q[0] !== pts[i - 1][0] || q[1] !== pts[i - 1][1]);
}
// React.memo gates sit on these edges, a little before the child.
export const GATES = ["Header", "Sidebar", "ResultList", "ResultCard", "Footer"];
const gatePoint = (name) => { const pts = EDGES[name], a = pts[pts.length - 2], b = pts[pts.length - 1]; return [b[0], (a[1] + b[1]) / 2]; };

// ---------- drawing ----------
function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H });
}

function edges() {
  const out = [];
  for (const [name, pts] of Object.entries(EDGES)) {
    out.push(`<path class="rr-edge" data-edge="${name}" d="${k.pathOf(pts.map(([x, y]) => at([x, y, 0.05])))}"/>`);
  }
  // A dot where the bus branches.
  out.push(D([at([BLOCKS.App.cx, BUS_Y, 0.05])], { size: 0.8, tone: "mid" }));
  return out.join("");
}

function gate(name) {
  const [x, y] = gatePoint(name);
  const post = (px) => S(k.cylinder(px, y, 0.75, 0, 6, P, 12), { tone: "mid", crease: "none" });
  const shut = S(slab({ x: x - 4.6, y: y - 0.7, w: 9.2, d: 1.4, r: 0.3 }, 3.6, 1.8, 1, 0), { tone: "hi", crease: "lo" });
  const open = S(slab({ x: x - 5.3, y: y - 0.7, w: 1.4, d: 1.4, r: 0.3 }, 6, 8, 1, 0), { tone: "hi", crease: "lo" });
  return `<g data-gate="${name}" style="display:none">${post(x - 4.6)}${variants("gate-" + name, { shut, open }, "shut")}${post(x + 4.6)}</g>`;
}

function block(name) {
  const b = BLOCKS[name], plan = planOf(b), front = plan.y + plan.d;
  const solid = S(slab(plan, 0, b.h), { tone: "hi", crease: "lo" });
  const out = [`<g class="wb-lit-group" data-comp="${name}">`, solid];
  if (name === "PriceChart") {
    // bars printed on top of the chart block
    const bars = [0.35, 0.6, 0.9, 0.55, 0.75, 0.4];
    out.push(L(bars.map((v, i) => k.lineOnTop([plan.x + 3 + i * 2.4, plan.y + plan.d - 2.5], [plan.x + 3 + i * 2.4, plan.y + plan.d - 2.5 - v * 6], b.h, P)).join(""), { tone: "lo" }));
  }
  out.push(text(b.cx, front, b.h / 2 - 1.1, b.label, name === "App" ? 3.4 : 2.7, { anchor: "middle", tone: "hi" }));
  out.push(`</g>`);
  return out.join("");
}

function bank(name) {
  const b = BANKS[name], tr = trayOf(b);
  const out = [S(slab(tr, 0, TRAY_H, 3, 0.2), { tone: "mid", crease: "lo" })];
  const count = b.cols * b.rows;
  for (let i = 0; i < count; i++) {
    const [x, y] = studAt(b, i);
    out.push(`<g data-stud="${name}-${i}">${S(slab({ x, y, w: STUD, d: STUD, r: 0.4 }, TRAY_H, STUD_H, 2, 0.2), { tone: "hi", crease: "lo" })}</g>`);
  }
  out.push(faceText(P, [b.cx, tr.y + tr.d + 3.4, 0], b.label, { face: "top", size: 2.6, tone: "mid", anchor: "middle" }));
  return out.join("");
}

// STATE plaques: where the state lives (the live code shows the ones for the current setting and lights one when
// its state changes).
export const FLAGS = { App: "App", UserMenu: "UserMenu", Sidebar: "Sidebar", SearchPanel: "SearchPanel", ResultList: "ResultList", Store: "Store" };
function flag(name) {
  let x, y, z, w = 11;
  if (name === "Store") { x = STORE.x + 2; y = STORE.y + 2; z = STORE_H; }
  else { const b = BLOCKS[name]; x = b.cx - b.w / 2 + 1; y = ROW[b.row] + 1.3; z = b.h; w = Math.min(12, b.w - 2); }
  return `<g class="wb-lit-group" data-flag="${name}"${name === "App" ? "" : ' style="display:none"'}>${plaque(P, { x, y, z, w, d: 4.6, text: t("STATE", "ESTADO"), size: 2.2 })}</g>`;
}

function store() {
  const out = [`<g data-store>`];
  out.push(S(k.slabOf(STORE, 0, STORE_H, P, 3, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(DRUM.x, DRUM.y, DRUM.r, STORE_H, DRUM.h, P, 32, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(DRUM.x, DRUM.y, DRUM.r - 1.6, STORE_H + DRUM.h, P, 32), { tone: "lo" }));
  const front = STORE.y + STORE.d;
  out.push(digitCounter(P, { x: STORE.x + 3, y: front, z: 1.6, count: 2, w: 3.8, h: 5, gap: 0.5, pad: 0.9, name: "selectors" }));
  out.push(text(STORE.x + 13, front, 4.6, "STORE", 2.6, { tone: "hi" }));
  out.push(text(STORE.x + 13, front, 1.6, t("SELECTORS", "SELECTORES"), 2.1));
  out.push(flag("Store"));
  out.push(`</g>`);
  return out.join("");
}

function consoleBox() {
  const out = [S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 3, 0.5), { tone: "mid" })];
  const front = CONSOLE.y + CONSOLE.d;
  out.push(digitCounter(P, { x: CONSOLE.x + 5, y: front, z: 2.4, count: 2, w: 5, h: 7, gap: 0.6, pad: 1.2, name: "renders" }));
  out.push(text(CONSOLE.x + 3.8, front, 13, "RENDERS", 2.5));
  out.push(digitCounter(P, { x: CONSOLE.x + 28, y: front, z: 2.4, count: 2, w: 5, h: 7, gap: 0.6, pad: 1.2, name: "dom" }));
  out.push(text(CONSOLE.x + 26.8, front, 13, t("DOM CHANGES", "CAMBIOS DOM"), 2.5));
  out.push(meter(P, { x: CONSOLE.x + 62, y: front, z: 3, r: 7.5, ticks: 10, zone: 0.5, name: "work" }));
  out.push(text(CONSOLE.x + 62, front, 13, t("WORK", "TRABAJO"), 2.5, { anchor: "middle" }));
  return out.join("");
}

// The page, lying on the bench: what the user sees. Regions the live code flashes when the DOM under them changes.
export const PAGE_LAYOUT = (() => {
  const { x, y, w, d } = PAGE;
  const r = (x0, y0, ww, dd) => ({ x: x + x0, y: y + y0, w: ww, d: dd });
  const cards = Array.from({ length: CARDS }, (_, i) => r(42 + (i % 12) * 8.6, 17 + Math.floor(i / 12) * 5.2, 7.4, 4.2));
  return {
    header: r(3, 3, w - 6, 6), logo: r(5, 4.2, 10, 3.6), nav: r(20, 4.2, 34, 3.6), user: r(w - 26, 4.2, 9, 3.6), cart: r(w - 15, 4.2, 10, 3.6),
    sidebar: r(3, 11, 34, d - 20), chart: r(5, 13, 30, 12), filters: r(5, 27, 30, 12),
    input: r(42, 11, 60, 4.6), suggest: r(104, 11, w - 107, 4.6), cards,
    footer: r(3, d - 7, w - 6, 4),
  };
})();
function pageSheet() {
  const L0 = PAGE_LAYOUT, out = [];
  const sheet = { ...PAGE, r: 1.2 };
  out.push(S(k.slabOf(sheet, 0, PAGE_Z, P, 3), { tone: "hi", crease: "none" }));
  const rect = (b, attr, cls = "rr-dom") => `<path class="${cls}"${attr ? ` data-dom="${attr}"` : ""} d="${k.pathOf([[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.d], [b.x, b.y + b.d]].map(([x, y]) => at([x, y, PAGE_Z])), true)}"/>`;
  out.push(rect(L0.header, "", "rr-dom rr-static"), rect(L0.sidebar, "", "rr-dom rr-static"), rect(L0.footer, "", "rr-dom rr-static"));
  out.push(rect(L0.logo, "Logo"), rect(L0.nav, "Nav"), rect(L0.user, "UserMenu"), rect(L0.cart, "CartBadge"));
  out.push(rect(L0.chart, "PriceChart"), rect(L0.filters, "Filter"));
  out.push(rect(L0.input, "SearchInput"), rect(L0.suggest, "Suggestions"));
  L0.cards.forEach((c, i) => out.push(rect(c, "ResultCard-" + i)));
  // the typed text, the cart count and the suggestion count: one <text> each, set by the live code
  out.push(faceText(P, [L0.input.x + 1.5, L0.input.y + 3.6, PAGE_Z], "", { face: "top", size: 3, tone: "hi", attr: 'data-page="query"' }));
  out.push(faceText(P, [L0.cart.x + L0.cart.w / 2, L0.cart.y + 3.1, PAGE_Z], "2", { face: "top", size: 2.6, tone: "hi", anchor: "middle", attr: 'data-page="cart"' }));
  out.push(faceText(P, [L0.suggest.x + L0.suggest.w / 2, L0.suggest.y + 3.4, PAGE_Z], "", { face: "top", size: 2.6, tone: "hi", anchor: "middle", attr: 'data-page="suggest"' }));
  out.push(faceText(P, [PAGE.x + PAGE.w / 2, PAGE.y + PAGE.d + 6.5, 0], t("PAGE (DOM)", "PÁGINA (DOM)"), { face: "top", size: 3, tone: "mid", anchor: "middle" }));
  return out.join("");
}

const countOf = (name) => NODES.filter((n) => n.name === name).length;

export function buildFigure() {
  const [links, filters, cards, footer] = ["NavLink", "Filter", "ResultCard", "FooterLink"].map(countOf);
  const singles = Object.keys(BLOCKS), banks = Object.keys(BANKS);
  // Painter's order: back rows first; within a row, left to right.
  const items = [...singles.map((n) => ({ n, kind: "block", row: BLOCKS[n].row, x: BLOCKS[n].cx })), ...banks.map((n) => ({ n, kind: "bank", row: BANKS[n].row, x: BANKS[n].cx }))]
    .sort((a, b) => a.row - b.row || a.x - b.x);
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A component board on a base plate: a shop page's React component tree laid out in rows, App at the back, then Header, Sidebar, SearchPanel and Footer, then their children nearer the front, with trays of small studs for the components that come many at a time: " + links + " nav links, " + filters + " filters, " + cards + " result cards and " + footer + " footer links. Wires run from each component to its children. When a component renders its block lights, and the light runs down the wires to everything it renders. Plaques marked STATE lie on the components that hold state; gates on some wires are React.memo; a store stands at the back right. At the front lies the page itself, where only the parts whose DOM changed flash, and a console counts renders and DOM changes and shows the work of the last update against one frame.",
      "Un tablero de componentes sobre una placa base: el árbol de componentes de React de la página de una tienda dispuesto en filas, App al fondo, luego Header, Sidebar, SearchPanel y Footer, y sus hijos más adelante, con bandejas de pequeños tacos para los componentes que vienen de a muchos: " + links + " enlaces de navegación, " + filters + " filtros, " + cards + " tarjetas de resultados y " + footer + " enlaces del pie. Cables van de cada componente a sus hijos. Cuando un componente se renderiza su bloque se ilumina, y la luz baja por los cables hasta todo lo que renderiza. Placas marcadas ESTADO están sobre los componentes que guardan estado; compuertas en algunos cables son React.memo; un store está al fondo a la derecha. Adelante está la página misma, donde solo destellan las partes cuyo DOM cambió, y una consola cuenta renders y cambios en el DOM y muestra el trabajo de la última actualización frente a un cuadro.",
    ),
    body: [
      plate(),
      edges(),
      store(),
      GATES.map(gate).join(""),
      items.map((it) => (it.kind === "block" ? block(it.n) + (FLAGS[it.n] ? flag(it.n) : "") : bank(it.n))).join(""),
      pageSheet(),
      consoleBox(),
    ],
  });
}

export const GEOMETRY = { BLOCKS: Object.keys(BLOCKS), BANKS: Object.fromEntries(Object.entries(BANKS).map(([n, b]) => [n, b.cols * b.rows])), EDGES: Object.keys(EDGES), GATES };

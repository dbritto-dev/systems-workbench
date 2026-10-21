// A signal network: 25 relay stations on a board, wired by the chosen topology, with a fence that can cut it in two.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy).
import * as k from "../../workbench/kit.mjs";
import { basePlate } from "../../workbench/parts.mjs";
import { N, COLS, TOPOLOGIES, RING, cellOf, edgesOf } from "./sim.js";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -122, y: -122, w: 244, d: 244, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;
const PITCH = 40;
const BASE = { half: 7, h: 3 };
const POST = { r: 1.6, top: 19 };
const LAMP = { r: 4.6, h: 5, lens: 3.1 };
const LAMP_TOP = POST.top + LAMP.h;
const WIRE_Z = 0.3;
const WALL = { x: -22, w: 4, y0: -108, y1: 92, h: 15 };

export const posOf = (i) => { const [c, r] = cellOf(i); return [-80 + PITCH * c, -80 + PITCH * r]; };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-80, -80, LAMP_TOP + 2], [80, -80, LAMP_TOP + 2], [-80, 80, LAMP_TOP + 2]],
  WIDTH,
  HEIGHT,
  { pad: 24, azimuth: 45 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth = (x, y, z = 0) => k.depthOf([x, y, z], P);

// The route a wire takes on the board: straight between stations, except the ring's closing wire, which runs round the margin.
export function routeOf(topology, a, b) {
  const pa = posOf(a), pb = posOf(b);
  if (topology === "ring" && ((a === RING[0] && b === RING[N - 1]) || (a === RING[N - 1] && b === RING[0]))) {
    const s = posOf(RING[0]), e = posOf(RING[N - 1]);
    const route = [s, [s[0], -102], [102, -102], [102, e[1]], e];
    return a === RING[0] ? route : route.reverse();
  }
  return [pa, pb];
}
const routeD = (pts) => k.onTop(pts, WIRE_Z, P);

function wires(state) {
  return TOPOLOGIES.map((t) => {
    const paths = edgesOf(t).map(([a, b]) => {
      const d = routeD(routeOf(t, a, b));
      const o = (t === "grid" && state.busy[a + "-" + b]) || 0;
      return `<path class="iso-line wire" data-tone="faint" d="${d}"/><path class="busy" data-e="${a}-${b}" d="${d}" style="opacity:${o}"/>`;
    }).join("");
    return `<g data-topo="${t}"${t === "grid" ? "" : ' style="display:none"'}>${paths}</g>`;
  }).join("");
}

function station(i, state) {
  const on = (cond) => (cond ? " data-on" : "");
  const [x, y] = posOf(i);
  const base = { x: x - BASE.half, y: y - BASE.half, w: BASE.half * 2, d: BASE.half * 2, r: 2 };
  const out = [];
  out.push(`<path class="origin-ring" data-origin="${i}"${on(state.origin === i)} d="${k.ring(x, y, BASE.half + 4.5, 0.2, P, 40)}"/>`);
  out.push(S(k.slabOf(base, 0, BASE.h, P, 3, 0.4), { tone: "mid" }));
  out.push(D([[x - 4.2, y + 4.2], [x + 4.2, y + 4.2], [x + 4.2, y - 4.2]].map(([px, py]) => at([px, py, BASE.h])), { size: 0.35, tone: "lo" }));
  out.push(S(k.cylinder(x, y, 2.6, BASE.h, 1.6, P, 20), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, POST.r, BASE.h + 1.6, POST.top - BASE.h - 1.6, P, 16), { tone: "mid", crease: "none" }));
  out.push(`<g data-collar="${i}" style="display:none">${S(k.cylinder(x, y, 3.4, 9, 3, P, 24), { tone: "hi", crease: "lo" })}</g>`);
  out.push(S(k.cylinder(x, y, LAMP.r, POST.top, LAMP.h, P, 32, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.sideArc(x, y, LAMP.r, POST.top + 1.6, P, 24), { tone: "faint" }));
  out.push(`<path class="lens" data-lens="${i}"${on(state.lit.includes(i))} d="${k.ring(x, y, LAMP.lens, LAMP_TOP, P, 32)}"/>`);
  return { key: depth(x, y), svg: `<g class="station" data-station="${i}">${out.join("")}</g>` };
}

function wallPanel(k0, k1) {
  const plan = { x: WALL.x, y: k0, w: WALL.w, d: k1 - k0, r: 0.6 };
  return S(k.slabOf(plan, 0, WALL.h, P, 2, 0.4), { tone: "mid" })
    + D([at([WALL.x + 2, k0 + 3, WALL.h]), at([WALL.x + 2, k1 - 3, WALL.h])], { size: 0.4, tone: "lo" });
}

function board(state) {
  const items = [...Array(N).keys()].map((i) => station(i, state));
  const step = (WALL.y1 - WALL.y0) / COLS;
  for (let r = 0; r < COLS; r++) {
    const y0 = WALL.y0 + r * step, y1 = y0 + step;
    items.push({ key: depth(WALL.x + WALL.w / 2, (y0 + y1) / 2) + 0.01, svg: `<g data-wall style="display:none">${wallPanel(y0, y1)}</g>` });
  }
  items.sort((a, b) => a.key - b.key);
  return items.map((it) => it.svg).join("");
}

// Two gauges on the front margin, each a scale with two target pins (tall: challenge 3d, short: 3e) and a slider.
// Messages per value, 0–60; slowest value, 0–2.4 s, one tick per 100 ms hop.
export const GAUGES = {
  mpo: { x: -106, max: 60, targets: [30, 20] },
  max: { x: 6, max: 2.4, targets: [0.6, 2] },
};
const G = { w: 100, y: 101, d: 7, pad: 4 };
export const gaugeX = (g, v) => g.x + G.pad + (Math.max(0, Math.min(g.max, v)) / g.max) * (G.w - 2 * G.pad);
const UNIT_X = (() => { const a = at([0, 0, 0]), b = at([1, 0, 0]); return [b[0] - a[0], b[1] - a[1]]; })();
export const slideBy = (g, v) => { const dx = gaugeX(g, v) - gaugeX(g, 0); return `translate(${(UNIT_X[0] * dx).toFixed(2)} ${(UNIT_X[1] * dx).toFixed(2)})`; };
// Screen offset of each slider at full scale, for the live page.
export const gaugeTravel = (key) => { const g = GAUGES[key], dx = gaugeX(g, g.max) - gaugeX(g, 0); return { max: g.max, dx: UNIT_X[0] * dx, dy: UNIT_X[1] * dx }; };
function gauge(key, value) {
  const g = GAUGES[key], len = G.w - 2 * G.pad;
  const strip = { x: g.x, y: G.y, w: G.w, d: G.d, r: 1 };
  const out = [S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" })];
  const every = key === "mpo" ? 4 : 5, minor = [], major = [];
  for (let i = 0; i <= 24; i++) {
    const x = g.x + G.pad + (i * len) / 24, big = i % every === 0;
    (big ? major : minor).push(k.lineOnTop([x, G.y + 0.8], [x, G.y + 0.8 + (big ? 3.6 : 2)], 0.6, P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(D([at([g.x + 2, G.y + G.d / 2, 0.6]), at([g.x + G.w - 2, G.y + G.d / 2, 0.6])], { size: 0.45 }));
  g.targets.forEach((v, i) => out.push(S(k.cylinder(gaugeX(g, v), G.y - 2.2, 1.4, 0, i === 0 ? 8 : 4.5, P, 16), { tone: "mid" })));
  const x0 = gaugeX(g, 0);
  const slider = S(k.slabOf({ x: x0 - 1.6, y: G.y - 0.5, w: 3.2, d: G.d + 1, r: 0.6 }, 0.6, 2.6, P, 2, 0.3), { tone: "hi", crease: "lo" })
    + L(k.lineOnTop([x0, G.y + 0.5], [x0, G.y + G.d - 0.5], 3.2, P), { tone: "mid", free: true });
  out.push(`<g data-gauge="${key}" transform="${slideBy(g, value)}">${slider}</g>`);
  return out.join("");
}

// state: a still frame of the run, so the figure reads before anything moves.
// { origin, lit: [nodes], busy: { "a-b": opacity }, dots: [[sx, sy]], mpo, max }
export function buildFigure(state = { origin: -1, lit: [], busy: {}, dots: [], mpo: 0, max: 0 }) {
  const plate = basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H }) + gauge("mpo", state.mpo) + gauge("max", state.max);
  const dots = state.dots.map(([x, y]) => `<circle class="msg" r="3" cx="${x}" cy="${y}"/>`).join("");
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A board of 25 relay stations in a five by five grid. Wires on the board connect them in the chosen topology. A value enters one station, its lamp lights, and copies travel along the wires as pucks until every lamp is lit. Two gauges on the front edge show messages per value and the slowest value's latency against pins for the challenge targets. A fence can rise between the second and third columns to cut the network in two.",
    body: [plate, wires(state), `<g data-dots>${dots}</g>`, board(state)],
  });
}

export const GEOMETRY = { LAMP_TOP, WIRE_Z };

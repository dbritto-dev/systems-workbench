// @ts-nocheck: figure code ported as-is; drawing shorthands come from src/lib/draw.
// A courier depot for latency: the CPU at the left end of a road, and every place data can live set along the
// road at a distance proportional to the logarithm of its latency (one ruler step = 10 times longer).
// A courier runs each trip; a meter on each station shows its share of the job's time; the signs show the total
// and one trip stretched to human scale (an L1 hit = one second).
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { sphereOf } from "../../../workbench/kit.mjs";
import { basePlate, labelPlate, meter, figurine, sign, faceText } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { STATIONS } from "./sim";

export const WIDTH = 700;
export const HEIGHT = 430;

const PLATE = { x: -130, y: -60, w: 260, d: 116, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The road: x = ROAD0 at 0.5 ns, DECADE units for each factor of 10.
const ROAD0 = -88, DECADE = 23;
export const xOf = (ns) => ROAD0 + DECADE * Math.log10(ns / 0.5);
const ROAD = { x: -100, y: -8, w: 214, d: 10, r: 1 };
const ROAD_H = 1.6;
export const ROAD_Y = ROAD.y + ROAD.d / 2;
export const ROAD_Z = ROAD_H;
export const DEPOT_X = -104;

// Stations stand behind the road; their fronts (name and meter) face the reader.
const ST_Y = -26, ST_D = 13, ST_H = 13;
const WIDE = { wan: 18, dc: 11, ssd: 9, disk: 13 };
const NAMES = {
  l1: [t("L1", "L1")], l2: [t("L2", "L2")], ram: [t("RAM", "RAM")], ssd: [t("SSD", "SSD")],
  dc: [t("SAME", "MISMO"), t("DC", "DC")], disk: [t("DISK", "DISCO")], wan: [t("OTHER", "OTRO"), t("CONTINENT", "CONTINENTE")],
};
export const SPOTS = Object.fromEntries(STATIONS.map((s) => [s.id, xOf(s.ns)]));

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [SPOTS.dc, ST_Y, ST_H + 17], [SPOTS.wan, ST_Y + 6, ST_H + 14], [-126, -22, 12]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 52 },
);

const { S, L } = shorthand(P);
const seg = (a, b) => k.segment(a, b, P);

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + labelPlate(P, { x: 60, y: 30, w: 46, d: 13, r: 1.5 }, [[65, 34.5, 30], [65, 38.5, 36]]);
}

// The road with a log ruler along its front: a major tick at each power of ten, labelled 1 ns … 100 ms.
function road() {
  const out = [S(k.slabOf(ROAD, 0, ROAD_H, P, 3, 0.3), { tone: "lo", crease: "none" })];
  out.push(L(k.lineOnTop([ROAD.x + 2, ROAD_Y], [ROAD.x + ROAD.w - 2, ROAD_Y], ROAD_H, P), { tone: "faint", dashed: true }));
  const RUL = { x: ROAD.x, y: ROAD.y + ROAD.d + 3, w: ROAD.w, d: 9, r: 1 };
  out.push(S(k.slabOf(RUL, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  const major = [], minor = [];
  for (let e = 0; e <= 8; e++) {
    const x = xOf(10 ** e);
    major.push(k.lineOnTop([x, RUL.y + 0.6], [x, RUL.y + 3.4], 0.8, P));
    for (let m = 2; m <= 9 && e < 8; m++) { const xm = xOf(m * 10 ** e); minor.push(k.lineOnTop([xm, RUL.y + 0.6], [xm, RUL.y + 1.8], 0.8, P)); }
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  const lab = ["1 ns", "10 ns", "100 ns", "1 µs", "10 µs", "100 µs", "1 ms", "10 ms", "100 ms"];
  lab.forEach((s, e) => out.push(faceText(P, [xOf(10 ** e), RUL.y + 7.6, 0.8], s, { face: "top", size: 2.7, tone: "mid", anchor: "middle" })));
  return out.join("");
}

// The CPU: a chip on a block at the start of the road, where every trip starts and ends.
function depot() {
  const plan = { x: -126, y: -22, w: 22, d: 24, r: 1.5 };
  const out = [S(k.slabOf(plan, 0, 7, P, 3, 0.5), { tone: "mid" })];
  const chip = { x: -122, y: -18, w: 14, d: 14, r: 0.6 };
  out.push(S(k.slabOf(chip, 7, 1.8, P, 2, 0.2), { tone: "hi", crease: "lo" }));
  const pins = [];
  for (let i = 0; i < 6; i++) { const u = chip.x + 1.8 + i * 2.1; pins.push(k.lineOnTop([u, chip.y - 1.4], [u, chip.y], 7, P), k.lineOnTop([u, chip.y + chip.d], [u, chip.y + chip.d + 1.4], 7, P)); }
  out.push(L(pins.join(""), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(chip, 3.4), 8.8, P), { tone: "lo" }));
  out.push(faceText(P, [-115, plan.y + plan.d, 2.4], t("CPU", "CPU"), { size: 2.8, tone: "mid", anchor: "middle" }));
  return out.join("");
}

// What stands on each station's plinth: something that looks like the place.
function topper(id, cx, cy) {
  const z = ST_H;
  if (id === "l1") return S(k.slabOf({ x: cx - 2, y: cy - 2, w: 4, d: 4, r: 0.4 }, z, 2.6, P, 2), { tone: "hi", crease: "lo" });
  if (id === "l2") return S(k.slabOf({ x: cx - 3, y: cy - 3, w: 6, d: 6, r: 0.5 }, z, 3.2, P, 2), { tone: "hi", crease: "lo" });
  if (id === "ram") {
    const stick = { x: cx - 5, y: cy - 0.8, w: 10, d: 1.6, r: 0.2 };
    const chips = [-3.4, 0, 3.4].map((dx) => k.faceRectY(P, cx + dx - 1.2, cx + dx + 1.2, cy + 0.8, z + 1.6, z + 4.4)).join("");
    return S(k.slabOf(stick, z, 6, P, 2), { tone: "hi", crease: "lo", inner: L(chips, { tone: "lo" }) });
  }
  if (id === "ssd") {
    const body = { x: cx - 4.5, y: cy - 3.2, w: 9, d: 6.4, r: 0.6 };
    return S(k.slabOf(body, z, 1.8, P, 2, 0.2), { tone: "hi", crease: "lo", inner: L(k.lineOnTop([cx - 3, cy - 1], [cx + 2, cy - 1], z + 1.8, P), { tone: "lo" }) });
  }
  if (id === "dc") {
    const rack = { x: cx - 4.5, y: cy - 4, w: 9, d: 8, r: 0.5 };
    const slots = [3, 6, 9, 12].map((h) => seg([rack.x + 1.2, rack.y + rack.d, z + h], [rack.x + rack.w - 1.2, rack.y + rack.d, z + h])).join("");
    return S(k.slabOf(rack, z, 15, P, 2, 0.3), { tone: "hi", crease: "lo", inner: L(slots, { tone: "lo" }) });
  }
  if (id === "disk") {
    return S(k.slabOf({ x: cx - 5, y: cy - 4.5, w: 10, d: 9, r: 0.8 }, z, 1.6, P, 2), { tone: "mid", crease: "lo" })
      + S(k.cylinder(cx, cy, 4, z + 1.6, 1, P, 36), { tone: "hi", crease: "lo" })
      + L(k.ring(cx, cy, 2.4, z + 2.6, P, 24), { tone: "faint" })
      + S(k.cylinder(cx, cy, 0.7, z + 2.6, 0.6, P, 12), { tone: "mid", crease: "none" })
      + L(k.lineOnTop([cx + 4.4, cy - 3.8], [cx + 1.2, cy - 0.6], z + 3, P), { tone: "mid" });
  }
  // wan: a globe on a short stand
  const gz = z + 2 + 6;
  return S(k.cylinder(cx, cy, 2.4, z, 2, P, 20), { tone: "mid", crease: "none" })
    + S(sphereOf([cx, cy, gz], 6, P), { tone: "hi", crease: "lo" })
    + L(k.sideRing([cx, cy, gz], 6, "x", P, 40) + k.ring(cx, cy, 6, gz, P, 40), { tone: "faint" });
}

// A station: plinth, its name and share-of-time meter on the front, its topper.
function station(s) {
  const cx = SPOTS[s.id], w = WIDE[s.id] || 11;
  const plan = { x: cx - w / 2, y: ST_Y, w, d: ST_D, r: 1 };
  const front = ST_Y + ST_D;
  const out = [`<g data-station="${s.id}">`];
  out.push(S(k.slabOf(plan, 0, ST_H, P, 3, 0.4), { tone: "mid" }));
  out.push(meter(P, { x: cx, y: front, z: 0.9, r: 4.6, ticks: 4, name: "share-" + s.id, value: 0 }));
  const lines = NAMES[s.id];
  lines.forEach((name, i) => out.push(faceText(P, [cx, front, lines.length === 1 ? 7.8 : 10.4 - i * 2.6], name, { size: lines.length === 1 ? 2.9 : 2.3, tone: "mid", anchor: "middle" })));
  out.push(topper(s.id, cx, ST_Y + ST_D / 2));
  out.push(`</g>`);
  return out.join("");
}

// The signs: the job's total time so far, and one trip at human scale. Their text is set live.
const SIGN_Y = 48;
function signs() {
  const out = [];
  out.push(sign(P, { x: -114, y: SIGN_Y, z: 3, w: 42, h: 9, text: "0 ns", size: 4.4, attr: "data-total" }));
  out.push(faceText(P, [-93, SIGN_Y, 13.4], t("TOTAL SO FAR", "TOTAL HASTA AHORA"), { size: 2.4, tone: "mid", anchor: "middle" }));
  out.push(sign(P, { x: -62, y: SIGN_Y, z: 3, w: 54, h: 9, text: "1 s", size: 4.4, attr: "data-human" }));
  out.push(faceText(P, [-35, SIGN_Y, 13.4], t("ONE TRIP IF L1 TOOK 1 S", "UN VIAJE SI L1 TARDARA 1 S"), { size: 2.4, tone: "mid", anchor: "middle" }));
  return out.join("");
}

// The courier, drawn at the origin and moved with translateAlong; lit while out on a trip.
export function courierSvg() {
  return `<g data-courier>${figurine(P, [0, 0, 0], { scale: 0.75, lit: true })}</g>`;
}

const LABEL = t(
  "A courier depot on a base plate. At the left a CPU chip sits at the start of a long road. Behind the road stand stations at distances that grow with the logarithm of their latency: L1 cache, L2 cache, RAM, an SSD, a rack in the same datacenter, a spinning disk and a globe for another continent. A ruler along the road marks 1 ns to 100 ms, one step per factor of ten. A courier runs each trip from the CPU to a station and back; each station's meter shows its share of the job's time. Two signs in front show the total so far and one trip stretched to human scale.",
  "Un depósito de mensajería sobre una placa base. A la izquierda, un chip de CPU está al inicio de un camino largo. Detrás del camino hay estaciones a distancias que crecen con el logaritmo de su latencia: caché L1, caché L2, RAM, un SSD, un rack en el mismo centro de datos, un disco giratorio y un globo para otro continente. Una regla a lo largo del camino marca de 1 ns a 100 ms, un paso por cada factor de diez. Un mensajero hace cada viaje de la CPU a una estación y de vuelta; el medidor de cada estación muestra su parte del tiempo del trabajo. Dos letreros al frente muestran el total hasta ahora y un viaje estirado a escala humana.",
);
export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: LABEL,
    body: [plate(), STATIONS.map(station).join(""), depot(), road(), `<g data-layer="courier"></g>`, signs()],
  });
}
export const GEOMETRY = { SPOTS, ROAD_Y, ROAD_Z, DEPOT_X };

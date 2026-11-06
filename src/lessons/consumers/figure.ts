// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A sorting hall: a consumer group you can watch.
//   at the back, the topic drops numbered records onto six roller lanes (its partitions); a lag counter over each lane
//   shows how many of its records are not committed yet;
//   at the front end of each lane a sign shows the worker that owns it, and a gate drops across the lane while nobody
//   reads it (a rebalance, a dead owner);
//   six desks in their own row in front, set half a lane over so no desk lines up with a lane (a worker reads whichever
//   lanes it owns): a worker takes a record from one of its lanes, works it on the desk and piles the slip; the
//   pile is the batch not committed yet, and it clears at the next poll (the commit). A meter on each desk shows the
//   time since its last poll against the poll limit;
//   the coordinator's booth at the right hands the lanes out: its lamp lights during a rebalance, its dial runs a
//   silent member's session down, and counters show rebalances, records committed and done twice;
//   workers outside the group wait on the bench at the front right.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { sphereOf } from "../../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate, digitCounter, person, figurine, meter, dial, lamp, faceText, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 450;

const PLATE = { x: -106, y: -94, w: 254, d: 144, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The lanes, left to right; records roll from the topic at the back (small y) to the front end (large y).
export const LANE_X = [-84, -58, -32, -6, 20, 46];
const LANE_HALF = 7.5;
const BED = { y0: -66, y1: -12 };
export const BED_H = 7;
export const SLOT_Y = Array.from({ length: 5 }, (_, i) => -18 - 9.6 * i);   // slot 0 at the front end
export const BOX = { w: 8, d: 8, h: 5.4 };

// The topic: a long block across the lanes' back ends, a chute over each lane and a lag counter above it.
const TOPIC = { x: -100, y: -88, w: 162, d: 18, r: 1.5 };
const TOPIC_H = 30;
export const CHUTE_SPOT = (i) => [LANE_X[i], BED.y0 + 3, BED_H + 0.3];

// The front end of each lane: a low stop block with the owner's sign standing on it, and the gate posts.
const STOP = { y: -12, d: 6 };
const STOP_H = 9;
const SIGN = { w: 11, h: 8 };
export const GATE_Y = -23;
const GATE_H = 15;

// The desks, in a row of their own: each sits half a lane to the right of a lane's end, between two lanes, so no desk
// belongs to a lane. The worker stands behind it, on its right.
const DESK = { y: 8, d: 15, w: 22 };
const DESK_H = 11;
export const DESK_X = LANE_X.map((x) => x + 13);
export const DESK_SPOT = (i) => [DESK_X[i] - 4, DESK.y + 7.5, DESK_H + 0.2];
export const SLIP = { dx: 5.5, dy: 7.5, w: 6, d: 7.6, h: 0.75, n: 10 };
const WORKER_Y = 1.5;

// The coordinator's booth, its counters cabinet, and the bench for workers outside the group.
const BOOTH = { x: 70, y: -86, w: 70, d: 46, r: 2 };
const BOOTH_H = 24;
const CAB = { x: 70, y: -24, w: 74, d: 32, r: 2 };
const CAB_H = 13;
const BENCH = { x: 74, y: 22, w: 62, d: 10, r: 2 };
const BENCH_H = 4;
export const BENCH_SPOTS = [81, 92, 103, 114, 125].map((x) => [x, BENCH.y + 4.6, BENCH_H]);

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [TOPIC.x, TOPIC.y, TOPIC_H + 2], [TOPIC.x + TOPIC.w, TOPIC.y, TOPIC_H + 2], [BOOTH.x + BOOTH.w, BOOTH.y, BOOTH_H + 12], [BOOTH.x, BOOTH.y, BOOTH_H + 12]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 50 },
);

const { S, L, D, at, seg } = shorthand(P);
export const CAP = 3.4;   // caption size: no word on the machine is smaller
const text = (x, y, z, words, size = CAP, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + rulerStrip(P, { x: -30, y: 34, w: 80, d: 6, r: 1 })
    + labelPlate(P, { x: -96, y: 30, w: 52, d: 13, r: 1.5 }, [[-90, 34.5, 32], [-90, 38.5, 40]]);
}

// ---------- the topic ----------
function topic() {
  const out = [S(k.slabOf(TOPIC, 0, TOPIC_H, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(TOPIC, 9, P, 3), { tone: "faint" }) })];
  out.push(S(k.slabOf(k.insetPlan(TOPIC, -1.4), TOPIC_H, 2.4, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(TOPIC, 3), TOPIC_H + 2.4, P), { tone: "faint" }));
  out.push(text(TOPIC.x + 6, TOPIC.y + 12.6, TOPIC_H + 2.4, "TOPIC", 4.2, { face: "top" }));
  const front = TOPIC.y + TOPIC.d;
  // a chute mouth over each lane, then the lane's lag counter above it with its caption clear of the housing
  LANE_X.forEach((x, i) => {
    out.push(L(k.faceRectY(P, x - 5, x + 5, front, 1, 7.4), { tone: "lo" }));
    out.push(`<path class="chute" d="${k.faceRectY(P, x - 4.2, x + 4.2, front, 1.6, 6.8)}"/>`);
    out.push(digitCounter(P, { x: x - 6.3, y: front, z: 11.2, count: 3, w: 3.8, h: 5.2, gap: 0.45, pad: 1, name: "lag" + i }));
    out.push(text(x, front, 19.4, "LAG", CAP, { anchor: "middle" }));
  });
  return out.join("");
}

// ---------- the lanes ----------
function bed(i) {
  const x = LANE_X[i];
  const plan = { x: x - LANE_HALF, y: BED.y0, w: LANE_HALF * 2, d: BED.y1 - BED.y0, r: 1 };
  const out = [S(k.slabOf(plan, 0, BED_H, P, 3, 0.4), { tone: "mid" })];
  const rollers = [];
  for (let y = plan.y + 3; y < plan.y + plan.d - 1; y += 3) rollers.push(k.lineOnTop([plan.x + 2, y], [plan.x + plan.w - 2, y], BED_H, P));
  out.push(L(rollers.join(""), { tone: "lo" }));
  for (const xx of [plan.x + 0.2, plan.x + plan.w - 1.6]) out.push(S(k.slabOf({ x: xx, y: plan.y + 1, w: 1.4, d: plan.d - 2, r: 0.3 }, BED_H, 1.4, P, 2), { tone: "hi", crease: "none" }));
  return out.join("");
}
// The gate: two posts beside the lane, an arm that stands up while the lane runs and lies across it while it's stopped.
function gatePosts(i) {
  const x = LANE_X[i];
  return [x - LANE_HALF - 1.4, x + LANE_HALF + 1.4].map((px) => S(k.cylinder(px, GATE_Y, 0.9, 0, GATE_H, P, 12), { tone: "mid", crease: "none" }) + S(k.cylinder(px, GATE_Y, 1.5, GATE_H, 1, P, 14), { tone: "mid" })).join("");
}
function gateArm(i) {
  const x = LANE_X[i];
  const down = litFill(S(k.slabOf({ x: x - LANE_HALF - 1.2, y: GATE_Y - 0.9, w: LANE_HALF * 2 + 2.4, d: 1.8, r: 0.4 }, GATE_H - 4.2, 2.2, P, 2), { tone: "hi", crease: "lo", lit: true }));
  const up = S(k.slabOf({ x: x + LANE_HALF + 0.5, y: GATE_Y - 0.9, w: 1.8, d: 1.8, r: 0.4 }, GATE_H + 1, 8, P, 2), { tone: "hi", crease: "lo" });
  return `<g data-gate="${i}"><g data-arm="up">${up}</g><g data-arm="down" style="display:none">${down}</g></g>`;
}
// The stop block at the lane's front end and the owner's sign on it (one <text> the live code sets).
function stop(i) {
  const x = LANE_X[i];
  const plan = { x: x - LANE_HALF, y: STOP.y, w: LANE_HALF * 2, d: STOP.d, r: 0.8 };
  const out = [S(k.slabOf(plan, 0, STOP_H, P, 3, 0.4), { tone: "mid" })];
  const face = STOP.y + STOP.d - 1.6;
  const sx = x - SIGN.w / 2 - 1.6;
  const board = { x: sx, y: face - 1.2, w: SIGN.w, d: 1.2, r: 0.2 };
  out.push(`<g class="wb-lit-group" data-sign="${i}">`);
  out.push(S(k.slabOf(board, STOP_H, SIGN.h, P, 2, 0.2), { tone: "hi", crease: "lo" }).replace('class="iso-solid"', 'class="iso-solid" data-board'));
  out.push(faceText(P, [sx + SIGN.w / 2, face, STOP_H + 1.7], "1", { size: 5.2, tone: "hi", anchor: "middle", attr: "data-owner" }));
  out.push(`</g>`);
  return out.join("");
}

// ---------- drawings used many times: drawn once at the origin in <defs>, placed with <use> ----------
// The projection is linear, so a drawing made at the origin and moved by translateAlong is the drawing made in place;
// this keeps six workers, eleven small figures, six slumped workers and sixty slips from being written out one by one.
const ID = "wbcg-";
function defs() {
  const slip = { x: -SLIP.w / 2, y: -SLIP.d / 2, w: SLIP.w, d: SLIP.d, r: 0.3 };
  const fallenBody = S(k.slabOf({ x: -8.5, y: -2.8, w: 11, d: 5.6, r: 2.6 }, DESK_H, 3.6, P, 4, 1), { tone: "hi", crease: "lo" })
    + S(sphereOf([5.6, 0, DESK_H + 2.5], 2.5, P), { tone: "hi", crease: "lo" });
  return `<defs>`
    + `<g id="${ID}person">${person(P, [0, 0, 0], { scale: 0.62 })}</g>`
    + `<g id="${ID}figure">${figurine(P, [0, 0, 0], { scale: 0.62 })}</g>`
    + `<g id="${ID}fallen">${fallenBody}</g>`
    + `<g id="${ID}slip">${S(k.slabOf(slip, 0, SLIP.h, P, 1, 0.1), { tone: "hi", crease: "none" })}</g>`
    + `</defs>`;
}
const use = (name, at) => `<use href="#${ID}${name}" transform="${k.translateAlong(P, at)}"/>`;

// ---------- the workers ----------
// Standing behind the desk (up); out of the group but still finishing its batch, the small figure of the bench (out);
// slumped over the desk (crashed); or away (not drawn).
function worker(i) {
  const x = DESK_X[i] + 6.5;
  const up = use("person", [x, WORKER_Y, 0]);
  const out = use("figure", [x, WORKER_Y, 0]);
  return `<g data-worker="${i}"><g data-pose="up">${up}</g><g data-pose="out" style="display:none">${out}</g></g>`;
}
// A crashed worker slumps over the desk (the desk top is clear: its record and slips are lost with it).
function fallen(i) {
  return `<g data-fallen="${i}" style="display:none">${use("fallen", [DESK_X[i], DESK.y + 6, 0])}</g>`;
}
function desk(i) {
  const cx = DESK_X[i];
  const plan = { x: cx - DESK.w / 2, y: DESK.y, w: DESK.w, d: DESK.d, r: 1.4 };
  const out = [`<g data-desk="${i}">`];
  out.push(S(k.slabOf(plan, 0, DESK_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(plan, 1.6), DESK_H, P), { tone: "faint" }) }));
  // the work spot and the slip tray
  out.push(L(k.planOutline({ x: cx - 9, y: DESK.y + 2.5, w: 10, d: 10, r: 0.8 }, DESK_H, P), { tone: "lo" }));
  out.push(S(k.slabOf({ x: cx + SLIP.dx - SLIP.w / 2 - 0.8, y: DESK.y + SLIP.dy - SLIP.d / 2 - 0.8, w: SLIP.w + 1.6, d: SLIP.d + 1.6, r: 0.5 }, DESK_H, 0.6, P, 2), { tone: "lo", crease: "none" }));
  const front = DESK.y + DESK.d;
  out.push(text(cx - DESK.w / 2 + 2.6, front, 2, String(i + 1), 6.4, { tone: "hi" }));
  out.push(meter(P, { x: cx + 4.4, y: front, z: 1.6, r: 4.6, ticks: 5, zone: 0.8, name: "poll" + i, value: 0 }));
  out.push(text(cx + 4.4, front, 7.4, "POLL", CAP, { anchor: "middle" }));
  out.push(`</g>`);
  return out.join("");
}
// The slips of the batch worked but not committed, stacked on the tray (the live code shows the first n).
function slips(i) {
  const cx = DESK_X[i] + SLIP.dx, cy = DESK.y + SLIP.dy;
  const out = [];
  for (let n = 0; n < SLIP.n; n++) out.push(`<g data-slip="${n}" style="display:none">${use("slip", [cx, cy, DESK_H + 0.6 + n * SLIP.h])}</g>`);
  return `<g data-slips="${i}">${out.join("")}</g>`;
}

// ---------- the coordinator ----------
function booth() {
  const out = [S(k.slabOf(BOOTH, 0, BOOTH_H, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(BOOTH, 8, P, 3), { tone: "faint" }) })];
  out.push(S(k.slabOf(k.insetPlan(BOOTH, -1.4), BOOTH_H, 2.2, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BOOTH, 3), BOOTH_H + 2.2, P), { tone: "faint" }));
  const front = BOOTH.y + BOOTH.d, top = BOOTH_H + 2.2;
  out.push(text(BOOTH.x + 5, front, 19.4, t("COORDINATOR", "COORDINADOR"), 3.8));
  out.push(counted(BOOTH.x + 5.6, front, 9.2, 3, "rebalances", [t("REBALANCES", "REBALANCEOS")]));
  // the session dial: a silent member's session running down
  out.push(dial(P, { x: BOOTH.x + 18, y: BOOTH.y + 16, z: top, r: 9, h: 3, ticks: 30, every: 5, name: "session", value: 0 }));
  out.push(text(BOOTH.x + 18, BOOTH.y + 32.5, top, t("SESSION", "SESIÓN"), CAP, { face: "top", anchor: "middle" }));
  return out.join("");
}
function boothLamp() {
  const p = [BOOTH.x + 48, BOOTH.y + 16, BOOTH_H + 2.2];
  return `<g data-lamp="off">${lamp(P, p, { r: 4 })}</g><g data-lamp="on" style="display:none">${litFill(lamp(P, p, { r: 4, lit: true }))}</g>`
    + text(BOOTH.x + 48, BOOTH.y + 32.5, BOOTH_H + 2.2, t("REBALANCING", "REBALANCEO"), CAP, { face: "top", anchor: "middle" });
}
// A counter on a face with its caption to its right, clear of the housing (one or two lines).
function counted(x, y, z, count, name, lines) {
  const c = { w: 4.2, h: 5.6, gap: 0.6, pad: 1.1 };
  const right = x + count * c.w + (count - 1) * c.gap + c.pad + 2.4;
  const words = lines.length === 1 ? [[lines[0], z + 1.3]] : [[lines[0], z + 3.4], [lines[1], z - 0.4]];
  return digitCounter(P, { x, y, z, count, w: c.w, h: c.h, gap: c.gap, pad: c.pad, name }) + words.map(([w, zz]) => text(right, y, zz, w)).join("");
}
// Records committed on the cabinet's front; records done twice on its right face (it reads toward the back).
function cabinet() {
  const out = [S(k.slabOf(CAB, 0, CAB_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(CAB, 2), CAB_H, P), { tone: "faint" }) })];
  const front = CAB.y + CAB.d, side = CAB.x + CAB.w;
  out.push(counted(CAB.x + 3.4, front, 3.2, 4, "done", [t("COMMITTED", "CONFIRMADOS")]));
  out.push(digitCounter(P, { x: side, y: front - 3, z: 3.2, count: 3, face: "x", w: 4.2, h: 5.6, gap: 0.6, pad: 1.1, name: "twice" }));
  const right = front - 3 - (3 * 4.2 + 2 * 0.6 + 1.1 + 2.4);
  out.push(faceText(P, [side, right, 6.6], t("DONE", "DOS"), { face: "x", size: CAP, tone: "mid" }));
  out.push(faceText(P, [side, right, 2.8], t("TWICE", "VECES"), { face: "x", size: CAP, tone: "mid" }));
  return out.join("");
}

// ---------- the bench ----------
function bench() {
  const out = [S(k.slabOf(BENCH, 0, BENCH_H, P, 3, 0.4), { tone: "mid", inner: L(k.planOutline(k.insetPlan(BENCH, 1.6), BENCH_H, P), { tone: "faint" }) })];
  out.push(text(BENCH.x + 4, BENCH.y + BENCH.d + 5, 0, t("OUT OF GROUP", "FUERA DEL GRUPO"), CAP, { face: "top" }));
  return out.join("");
}
function benchFolk() {
  return BENCH_SPOTS.map((p, n) => `<g data-spare="${n}" style="display:none">${use("figure", p)}</g>`).join("");
}

// A record: a box with its offset on top, drawn at the origin and moved with translateAlong.
export function recordSvg() {
  const b = { x: -BOX.w / 2, y: -BOX.d / 2, w: BOX.w, d: BOX.d, r: 0.5 };
  return `<g class="wb-lit-group">${litFill(S(k.slabOf(b, 0, BOX.h, P, 2, 0.3), { tone: "hi", crease: "lo" })).replace('class="iso-solid"', 'class="iso-solid" data-body')}`
    + faceText(P, [0, 1.2, BOX.h], "0", { face: "top", size: 3.4, tone: "hi", anchor: "middle", attr: "data-num" }) + `</g>`;
}

export function buildFigure() {
  const lanes = LANE_X.map((_, i) => bed(i) + gatePosts(i) + `<g data-layer="lane${i}"></g>` + gateArm(i) + stop(i)).join("");
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A sorting hall on a base plate. At the back, a long block labelled topic drops numbered records onto six roller lanes, its partitions; a lag counter above each lane's chute shows how many of that lane's records are not committed yet. At the front end of each lane, a sign shows the number of the worker that owns it, and a gate arm drops across the lane while nobody reads it. In front, in a row of their own set half a lane over from the lanes, stand six numbered desks with a worker behind each; a worker takes a record from one of its lanes, works it on the desk and piles the slip on a tray; the pile clears when the batch is committed. A meter on each desk shows the time since the worker's last poll against the poll limit. At the right, the coordinator's booth has a lamp that lights during a rebalance, a session dial and a counter of rebalances, and a cabinet in front counts records committed on its front and records done twice on its right side. At the front right, a bench holds the workers outside the group.",
      "Una sala de clasificación sobre una placa base. Atrás, un bloque largo con la palabra topic deja registros numerados sobre seis carriles de rodillos, sus particiones; un contador de lag sobre la boca de cada carril muestra cuántos registros de ese carril aún no están confirmados. En el extremo delantero de cada carril, un letrero muestra el número del trabajador dueño, y una barrera baja sobre el carril mientras nadie lo lee. Adelante, en una fila propia corrida medio carril respecto de los carriles, hay seis escritorios numerados con un trabajador detrás de cada uno; un trabajador toma un registro de uno de sus carriles, lo procesa en el escritorio y apila el comprobante en una bandeja; la pila se vacía cuando se confirma el lote. Un medidor en cada escritorio muestra el tiempo desde el último poll del trabajador contra el límite de poll. A la derecha, la caseta del coordinador tiene una lámpara que se enciende durante un rebalanceo, un dial de sesión y un contador de rebalanceos, y un gabinete delante cuenta los registros confirmados en su frente y los hechos dos veces en su lado derecho. Adelante a la derecha, una banca reúne a los trabajadores fuera del grupo.",
    ),
    body: [
      defs(),
      plate(),
      topic(),
      booth(),
      boothLamp(),
      lanes,
      LANE_X.map((_, i) => worker(i)).join(""),
      LANE_X.map((_, i) => desk(i) + slips(i)).join(""),
      `<g data-layer="desk"></g>`,
      LANE_X.map((_, i) => fallen(i)).join(""),
      cabinet(),
      bench(),
      benchFolk(),
    ],
  });
}

export const FIGURE_CSS = `
.chute{fill:var(--anatomy-shade-0);stroke:none}
`;

export const GEOMETRY = { LANE_X, SLOT_Y, BED_H, BOX, GATE_Y, SLIP: { n: SLIP.n }, BENCH_SPOTS, CHUTE: LANE_X.map((_, i) => CHUTE_SPOT(i)), DESK_SPOT: LANE_X.map((_, i) => DESK_SPOT(i)) };

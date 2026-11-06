// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A blueprint office, a reconciler's booth and a factory floor: GitOps as a machine.
//   Back left:  GIT, the blueprint office. Its wall carries the head revision and one blueprint card per resource
//               (what git says should run); the developer who merges works behind its desk.
//   Back middle: the RECONCILER's booth. Its wall carries the revision the reconciler has read, the countdown to its
//               next look at git, its syncs and the live edits it has undone, the OUT OF SYNC sign and the SELF-HEAL
//               and PRUNE switches. On its desk, the bell a git webhook rings.
//   Back right: the HPA cabinet: the load on a meter and the pods it wants (WANTED).
//   Front:      the cluster floor. WEB, a Deployment whose pods stand on its platform, with its failed requests;
//               CONFIG, a value the app reads;
//               WORKER, an old job runner; and the on-call engineer's KUBECTL desk.
// The reconciler walks an aisle between the back row and the floor: to the office to read git, and to the back of
// each resource it syncs. Everything it passes in front of is either far enough behind it or carries no words, and
// the floor's words are on the faces toward the viewer, so the walker never covers a counter or a caption.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, faceText, faceRect, person, meter, sign, lamp, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { STOPS, LIMIT } from "./sim";

export const WIDTH = 700;
export const HEIGHT = 460;

const PLATE = { x: -132, y: -96, w: 262, d: 120, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// ---------- the back row: walls (all its words), desks in front of them ----------
const WALL_Y = -92, WALL_D = 4, WALL_FRONT = WALL_Y + WALL_D, WALL_H = 48;
const GIT_X = [-126, -70], REC_X = [-62, 74];
const DESK = { y: -78, d: 14, h: 12 };
const HPA_BOX = { x: 82, y: -92, w: 44, d: 28, r: 1.5 };
const HPA_H = 24;
const HPA_FRONT = HPA_BOX.y + HPA_BOX.d;
export const DEV_AT = [-112, -83.4, 0];
export const BELL_AT = [-50, -71, DESK.h];

// ---------- the aisle the reconciler walks ----------
export const AISLE_Y = -50;
const AISLE = { y0: -60, y1: -40 };

// ---------- the floor ----------
const FLOOR = { y: -38, d: 58 };
const FRONT = FLOOR.y + FLOOR.d;
const WEB = { x: -126, y: FLOOR.y, w: 92, d: FLOOR.d, r: 1.6 };
export const WEB_H = 14;     // tall enough for captions over its counters
const CONF = { x: -26, y: -34, w: 40, d: 54, r: 1.6 };
const WORK = { x: 22, y: -34, w: 40, d: 54, r: 1.6 };
const BOX_H = 18;
const KUBE = { x: 72, y: -20, w: 54, d: 40, r: 1.6 };
const KUBE_H = 10;
export const ENG_AT = [99, -28, 0];
export const WORKER_LAMP = [WORK.x + WORK.w - 8, WORK.y + 9, BOX_H];

// Pod slots on WEB: five across, two deep.
export const POD = { w: 15, d: 15, h: 11, hStart: 6 };
export const SLOTS = [];
for (const y of [-9, -31]) for (let i = 0; i < 4; i++) SLOTS.push([WEB.x + 7 + POD.w / 2 + i * 21, y + POD.d / 2]);

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners({ x: GIT_X[0], y: WALL_Y, w: REC_X[1] - GIT_X[0], d: WALL_D }, 0, WALL_H + 3)],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

const { S, L } = shorthand(P);
// Every word on the machine is at least the counter captions' size in the other lessons (queues' IN QUEUE).
export const LABEL = 2.7;
const TITLE = 4;
const text = (x, y, z, words, size = LABEL, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });
const CW = 5.6;     // one wheel and its gap
// Where a caption starts after a counter of n wheels at x: clear of the housing (pad 1.2) by 1.6.
const after = (x, n) => x + n * CW - 0.6 + 2.8;
const counter = (o) => digitCounter(P, { w: 5, h: 6.6, gap: 0.6, pad: 1.2, ...o });
// A counter whose housing lights (lit = differs from git): the wheels stay white, so the digits stay dark.
const litCounter = (name, o) => `<g data-litc="${name}">${counter({ name, ...o })}</g>`;

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H });
}

// ---------- GIT ----------
const CARD = { w: 16, h: 12.4, z: 21 };
export const CARD_X = { web: -123, config: -105, worker: -87 };
function gitWall() {
  const [x0, x1] = GIT_X;
  const out = [S(k.slabOf({ x: x0, y: WALL_Y, w: x1 - x0, d: WALL_D, r: 0.6 }, 0, WALL_H, P, 3, 0.4), { tone: "mid", crease: "lo" })];
  out.push(L(k.faceRectY(P, x0 + 2, x1 - 2, WALL_FRONT, 18, WALL_H - 2), { tone: "faint" }));
  out.push(text(x0 + 3, WALL_FRONT, WALL_H - 8.6, "GIT", TITLE + 1));
  out.push(counter({ x: x0 + 22, y: WALL_FRONT, z: WALL_H - 9.2, count: 2, name: "rev", value: 41 }));
  out.push(text(after(x0 + 22, 2), WALL_FRONT, WALL_H - 7.6, "REV"));
  // the blueprint cards: what git says should run
  for (const [name, x] of Object.entries(CARD_X)) out.push(blueprint(name, x));
  return out.join("");
}
function blueprint(name, x) {
  const y = WALL_FRONT + 0.6, z = CARD.z;
  const plan = { x, y: WALL_FRONT, w: CARD.w, d: 0.6, r: 0.15 };
  const value = name === "web" ? "v7 HPA" : name === "config" ? String(LIMIT.git) : "ON";
  return `<g data-pin="${name}">` + k.dotsSvg([k.iso([x + CARD.w / 2, y, z + CARD.h + 1.2], P)], { size: 0.8, tone: "mid" })
    + `<g class="wb-lit-group" data-card="${name}">`
    + S(k.slabOf(plan, z, CARD.h, P, 2, 0.15), { tone: "hi", crease: "lo" })
    + faceText(P, [x + CARD.w / 2, y, z + CARD.h - 4.2], name.toUpperCase(), { size: LABEL, tone: "hi", anchor: "middle" })
    + L(k.segment([x + 2, y, z + CARD.h - 5.4], [x + CARD.w - 2, y, z + CARD.h - 5.4], P), { tone: "faint" })
    + faceText(P, [x + CARD.w / 2, y, z + 2], name === "worker" ? t("ON", "SÍ") : value, { size: 3.2, tone: "hi", anchor: "middle", attr: `data-card-text="${name}"` })
    + `</g></g>`;
}
function gitDesk() {
  const [x0, x1] = GIT_X;
  const plan = { x: x0, y: DESK.y, w: x1 - x0, d: DESK.d, r: 1.2 };
  const out = [S(k.slabOf(plan, 0, DESK.h, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(plan, 2), DESK.h, P), { tone: "faint" }));
  // a stack of blueprints and a roll on the desk
  for (let j = 0; j < 4; j++) out.push(S(k.slabOf({ x: -98 + j * 0.3, y: -75, w: 14, d: 9, r: 0.3 }, DESK.h + j * 0.8, 0.7, P, 2, 0.1), { tone: "hi", crease: "lo" }));
  out.push(S(k.cylinder(-80, -71, 1.6, DESK.h, 1.2, P, 12), { tone: "mid" }));
  return out.join("");
}
export const developerSvg = (acting) => person(P, DEV_AT, { scale: 0.9, holding: acting ? "slip" : null });

// ---------- the reconciler's booth ----------
function reconWall() {
  const [x0, x1] = REC_X;
  const f = WALL_FRONT;
  const out = [S(k.slabOf({ x: x0, y: WALL_Y, w: x1 - x0, d: WALL_D, r: 0.6 }, 0, WALL_H, P, 3, 0.4), { tone: "mid", crease: "lo" })];
  out.push(L(k.faceRectY(P, x0 + 2, x1 - 2, f, 8, WALL_H - 2), { tone: "faint" }));
  out.push(text(x0 + 4, f, WALL_H - 8.6, t("RECONCILER", "RECONCILIADOR"), TITLE));
  // the OUT OF SYNC sign, lit when the live state differs from what the reconciler read in git
  out.push(`<g class="wb-lit-group" data-outsync>${sign(P, { x: x1 - 44, y: f + 1.2, z: WALL_H - 12, w: 40, h: 8.5, text: t("OUT OF SYNC", "DESINCRONIZADA"), size: 3.4, posts: false })}</g>`);
  // the counters: the revision it has read and the time to its next look; its syncs and the live edits undone
  const row = (x, z, name, count, words, value = 0) => counter({ x, y: f, z, count, name, value }) + text(after(x, count), f, z + 1.6, words);
  out.push(row(x0 + 5, 25, "has", 2, t("HAS REV", "TIENE REV"), 41));
  out.push(row(x0 + 39, 25, "next", 3, t("NEXT CHECK S", "REVISA EN S")));
  out.push(row(x0 + 5, 12, "syncs", 3, "SYNCS"));
  out.push(row(x0 + 39, 12, "undone", 2, t("UNDONE", "DESHECHAS")));
  // the switches: self-heal and prune, knob right = on
  out.push(switchPart(x1 - 40, 24, "selfHeal", "SELF-HEAL"));
  out.push(switchPart(x1 - 40, 11, "prune", "PRUNE"));
  return out.join("");
}
export const SWITCH = { w: 10, travel: 5 };
function switchPart(x, z, name, words) {
  const f = WALL_FRONT;
  const out = [text(x, f, z + 6.2, words)];
  const sx = x + 8.6;
  out.push(text(x, f, z + 0.6, t("OFF", "NO")));
  out.push(L(faceRect(P, "y", { x: sx, y: f, z }, 0, SWITCH.w, 0.6, 3.6), { tone: "lo" }));
  out.push(text(sx + SWITCH.w + 1.4, f, z + 0.6, t("ON", "SÍ")));
  // the knob, drawn at the off end; the live code slides it
  out.push(`<g data-switch="${name}" transform="${k.translateAlong(P, [SWITCH.travel, 0, 0])}">${S(k.slabOf({ x: sx + 0.2, y: f, w: 4.6, d: 1.4, r: 0.4 }, z - 0.2, 4.4, P, 2, 0.2), { tone: "hi", crease: "lo" })}</g>`);
  return out.join("");
}
function reconDesk() {
  const [x0, x1] = REC_X;
  const plan = { x: x0, y: DESK.y, w: x1 - x0, d: DESK.d, r: 1.2 };
  const out = [S(k.slabOf(plan, 0, DESK.h, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(plan, 2), DESK.h, P), { tone: "faint" }));
  // the in-tray with the reconciler's copy of the blueprints
  for (let j = 0; j < 3; j++) out.push(S(k.slabOf({ x: 14 + j * 0.3, y: -75, w: 14, d: 9, r: 0.3 }, DESK.h + j * 0.8, 0.7, P, 2, 0.1), { tone: "hi", crease: "lo" }));
  return out.join("");
}
// The webhook bell, and the wire from the git office that rings it (shown only with a webhook).
function bell() {
  const [bx, by, bz] = BELL_AT;
  const wire = `<g data-hook-wire style="display:none">${L(k.pathOf([[-74, -71, DESK.h + 0.4], [-66, -71, DESK.h + 6], [bx - 3, by, bz + 2]].map((p) => k.iso(p, P))), { tone: "mid" })}</g>`;
  // a desk bell: a flat base, a dome and a knob; ringing, short strokes fly off the dome (unlit: lit is for drift)
  const bellBody = S(k.cylinder(bx, by, 3.6, bz, 0.8, P, 24, 0.2), { tone: "mid" })
    + S(k.cylinder(bx, by, 2.6, bz + 0.8, 2.4, P, 24, 1.1), { tone: "hi", crease: "lo" })
    + S(k.cylinder(bx, by, 0.7, bz + 3.2, 1.2, P, 12), { tone: "mid", crease: "none" });
  const ring = [-1, 0, 1].map((j) => {
    const a = j * 0.7, c = [bx + Math.sin(a) * 1.5, by, bz + 5.2];
    return k.segment([c[0] + Math.sin(a) * 2, c[1], c[2] + Math.cos(a) * 1.6], [c[0] + Math.sin(a) * 4, c[1], c[2] + Math.cos(a) * 3.6], P);
  }).join("");
  return wire + bellBody + `<g data-bell="on" style="display:none">${L(ring, { tone: "hi" })}</g><g data-bell="off"></g>`;
}

// ---------- the HPA cabinet ----------
function hpaBox() {
  const out = [S(k.slabOf(HPA_BOX, 0, HPA_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(HPA_BOX, 2.2), HPA_H, P), { tone: "faint" }));
  const f = HPA_FRONT, x0 = HPA_BOX.x;
  out.push(text(x0 + 4, f, HPA_H - 7.4, "HPA", TITLE));
  out.push(meter(P, { x: x0 + 34, y: f, z: 13.6, r: 6.4, zone: 1 / 1.5, name: "load", value: 20 / 30 / 1.5 }));
  out.push(text(x0 + 34, f, 8.6, t("LOAD", "CARGA"), LABEL, { anchor: "middle" }));
  // the pods it wants: the same word as lesson 76's HPA (READY / STARTING / WANTED)
  out.push(counter({ x: x0 + 5.2, y: f, z: 2, count: 2, name: "wants", value: 3 }));
  out.push(text(x0 + 4, f, 11.6, t("WANTED", "DESEADOS")));
  return out.join("");
}

// ---------- the aisle ----------
function aisle() {
  const dash = [];
  for (const y of [AISLE.y0, AISLE.y1]) for (let x = -126; x < 124; x += 8) dash.push(k.lineOnTop([x, y], [Math.min(x + 4, 124), y], 0, P));
  return L(dash.join(""), { tone: "lo" });
}

// ---------- the floor ----------
function web() {
  const out = [S(k.slabOf(WEB, 0, WEB_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(WEB, 2.4), WEB_H, P), { tone: "faint" }));
  // the pod sockets
  out.push(L(SLOTS.map(([x, y]) => k.planOutline({ x: x - POD.w / 2 - 0.8, y: y - POD.d / 2 - 0.8, w: POD.w + 1.6, d: POD.d + 1.6, r: 1 }, WEB_H, P)).join(""), { tone: "lo" }));
  out.push(text(WEB.x + 4, FRONT, 4.4, "WEB", TITLE + 0.6));
  // each counter with its caption over it; the requests web fails (it can't serve them, or a bad version breaks them)
  const col = (x, name, count, words, value, lit) => (lit ? litCounter(name, { x: x + 1.2, y: FRONT, z: 1.4, count, value }) : counter({ x: x + 1.2, y: FRONT, z: 1.4, count, name, value })) + text(x, FRONT, 10.9, words);
  out.push(col(WEB.x + 20, "version", 1, t("VERSION", "VERSIÓN"), 7, true));
  out.push(col(WEB.x + 37, "replicas", 2, t("REPLICAS", "RÉPLICAS"), 3, true));
  out.push(col(WEB.x + 58, "failed", 4, t("FAILED", "FALLIDAS"), 0, false));
  out.push(`<g data-layer="pods"></g>`);
  return out.join("");
}
function config() {
  const out = [S(k.slabOf(CONF, 0, BOX_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(CONF, 2.4), BOX_H, P), { tone: "faint" }));
  // the config sheet on its top
  const sheet = { x: CONF.x + 8, y: CONF.y + 8, w: 24, d: 30, r: 0.4 };
  out.push(S(k.slabOf(sheet, BOX_H, 0.6, P, 2, 0.1), { tone: "hi", crease: "lo" }));
  out.push(L([0, 1, 2, 3, 4].map((j) => k.lineOnTop([sheet.x + 4, sheet.y + 6 + j * 5], [sheet.x + (j % 2 ? 14 : 20), sheet.y + 6 + j * 5], BOX_H + 0.6, P)).join(""), { tone: "faint" }));
  const f = CONF.y + CONF.d;
  out.push(text(CONF.x + 4, f, BOX_H - 4.8, "CONFIG", TITLE));
  out.push(litCounter("limit", { x: CONF.x + 5, y: f, z: 1.8, count: 2, value: LIMIT.git }));
  out.push(text(after(CONF.x + 5, 2), f, 3.4, t("LIMIT", "LÍMITE")));
  return out.join("");
}
function worker() {
  const out = [S(k.slabOf(WORK, 0, BOX_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(WORK, 2.4), BOX_H, P), { tone: "faint" }));
  // a vent on its top: an old machine
  out.push(L([0, 1, 2, 3].map((j) => k.lineOnTop([WORK.x + 6, WORK.y + 8 + j * 3], [WORK.x + 20, WORK.y + 8 + j * 3], BOX_H, P)).join(""), { tone: "lo" }));
  const f = WORK.y + WORK.d;
  out.push(text(WORK.x + 4, f, BOX_H - 4.8, "WORKER", TITLE));
  out.push(counter({ x: WORK.x + 5, y: f, z: 1.8, count: 3, name: "jobs" }));
  out.push(text(after(WORK.x + 5, 3), f, 3.4, t("JOBS", "TAREAS")));
  // the gone state: once pruned, the machine is removed and only its outline stays on the floor
  out.push(`<g data-lamp="off">${lamp(P, WORKER_LAMP, { r: 2.6 })}</g><g data-lamp="on" style="display:none">${litFill(lamp(P, WORKER_LAMP, { r: 2.6, lit: true }))}</g>`);
  return `<g data-worker>${out.join("")}</g><g data-worker-gone style="display:none">${L(k.planOutline(WORK, 0.1, P), { tone: "lo", dashed: true })}</g>`;
}
function kubectl() {
  const out = [S(k.slabOf(KUBE, 0, KUBE_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(KUBE, 2.4), KUBE_H, P), { tone: "faint" }));
  out.push(text(KUBE.x + 4, KUBE.y + KUBE.d, 2.8, "KUBECTL", TITLE));
  // a laptop, its screen toward the engineer
  out.push(S(k.slabOf({ x: 88, y: -10, w: 22, d: 14, r: 0.6 }, KUBE_H, 1, P, 2, 0.2), { tone: "hi", crease: "lo" }));
  out.push(S(k.slabOf({ x: 88, y: -11.4, w: 22, d: 1.2, r: 0.3 }, KUBE_H + 1, 13, P, 2, 0.2), { tone: "hi", crease: "lo" }));
  return out.join("");
}
export const engineerSvg = (acting) => person(P, ENG_AT, { scale: 0.9, hat: "brim", holding: acting ? "slip" : null });

// ---------- moving parts, drawn at the origin and moved with translateAlong ----------
// The reconciler: a clipboard while it reads and walks; git's blueprint (a slip) while it syncs.
export const walkerSvg = (syncing) => person(P, [0, 0, 0], { scale: 0.9, hat: "cap", holding: syncing ? "slip" : "clipboard" });
// A pod: a box with its version on top; a starting pod is a low box.
export function podSvg(h) {
  const plan = { x: -POD.w / 2, y: -POD.d / 2, w: POD.w, d: POD.d, r: 1 };
  return `<g class="wb-lit-group" data-pod>${S(k.slabOf(plan, 0, h, P, 3, 0.4), { tone: "hi", crease: "lo" })}`
    + faceText(P, [0, POD.d / 2, h / 2 - 1.4], "v7", { size: 4, tone: "hi", anchor: "middle", attr: "data-pod-text" }) + `</g>`;
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "GitOps as a machine on a base plate. At the back left, GIT, a blueprint office: its wall shows the head revision and three blueprint cards, WEB, CONFIG and WORKER, with the values git says should run; a developer who merges changes stands behind its desk. At the back middle, the RECONCILER's booth: its wall shows the revision it has read, the seconds to its next look at git, its syncs and the live edits it has undone, an OUT OF SYNC sign and the SELF-HEAL and PRUNE switches; a bell on its desk rings when a git webhook arrives. At the back right, the HPA cabinet shows the load on a meter and the pods it wants. In front, the cluster floor: WEB, whose pods stand on its platform with their version on the front, with counters for its version, its replicas and the requests it failed; CONFIG, with its LIMIT; WORKER, an old job runner, with a lamp that lights when git no longer has it; and the on-call engineer's KUBECTL desk. The reconciler walks the aisle between the back row and the floor: with a clipboard to the office to read git, and with git's blueprint to each resource it syncs; the developer and the engineer hold a slip while they act. Lit: what differs from git right now.",
      "GitOps como una máquina sobre una placa base. Atrás a la izquierda, GIT, una oficina de planos: su pared muestra la revisión de la cabeza (head) y tres fichas de planos, WEB, CONFIG y WORKER, con los valores que git dice que deben correr; detrás de su escritorio está quien desarrolla y fusiona cambios. Atrás al centro, la cabina del RECONCILIADOR: su pared muestra la revisión que leyó, los segundos hasta su próxima revisión de git, sus syncs y las ediciones en vivo que deshizo, un letrero DESINCRONIZADA y los interruptores SELF-HEAL y PRUNE; una campana en su escritorio suena cuando llega un webhook de git. Atrás a la derecha, el gabinete del HPA muestra la carga en un medidor y los pods que desea. Adelante, el piso del clúster: WEB, cuyos pods están sobre su plataforma con su versión al frente, con contadores de su versión, sus réplicas y las solicitudes que falló; CONFIG, con su LÍMITE; WORKER, un ejecutor de tareas viejo, con una lámpara que se enciende cuando git ya no lo tiene; y el escritorio KUBECTL de la ingeniera de guardia. El reconciliador recorre el pasillo entre la fila de atrás y el piso: con una tablilla hasta la oficina para leer git, y con el plano de git hasta cada recurso que sincroniza; quien desarrolla y la ingeniera sostienen una papeleta mientras actúan. Encendido: lo que difiere de git en este momento.",
    ),
    body: [
      plate(),
      gitWall(),
      reconWall(),
      `<g data-dev>${`<g data-person="off">${developerSvg(false)}</g><g data-person="on" style="display:none">${developerSvg(true)}</g>`}</g>`,
      gitDesk(),
      reconDesk(),
      bell(),
      hpaBox(),
      aisle(),
      `<g data-layer="walk"></g>`,
      web(),
      config(),
      worker(),
      `<g data-eng>${`<g data-person="off">${engineerSvg(false)}</g><g data-person="on" style="display:none">${engineerSvg(true)}</g>`}</g>`,
      kubectl(),
    ],
  });
}

export const GEOMETRY = { AISLE_Y, STOPS, SLOTS, WEB_H, POD, SWITCH, CARD_X };

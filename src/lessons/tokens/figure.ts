// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A festival gate that checks wristbands by their stamp.
//   the box office (the auth server, left) signs wristbands and hands out refresh passes; it counts refreshes and logins;
//   the gate (an API, centre) has a lane for the user and one for the thief, a scanner lamp per lane and an arm that
//   lifts for a wristband it accepts; the clock on its beam is what it compares expiries with;
//   the gate log (front right) counts what matters: the thief's entries after the revocation, how long after it the
//   stolen wristband last worked (the window), and the lookups the gate made;
//   the deny list (back left) and the user record with its token version (back right) are the state the gate can
//   consult, each wired to a scanner; the stage and the crowd are where the gate lets people into.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, rulerStrip, labelPlate, digitCounter, person, figurine, lamp, plaque, pennant, sign, faceText, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -106, y: -92, w: 212, d: 144, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The gate: a frame across the walk at y = GATE_Y, two lanes (user on the left, thief on the right).
export const GATE_Y = -10;
export const LANES = { user: -32, thief: -4 };
const PILLARS = [-46, -18, 10];
const PILLAR_H = 30;
const BEAM = { x: -50, y: GATE_Y - 2.5, w: 64, d: 5, r: 0.6 };
const BEAM_Z = PILLAR_H, BEAM_H = 9;
export const ARM_Z = 11;
export const SCAN = { user: [LANES.user + 9.5, GATE_Y + 6], thief: [LANES.thief + 9.5, GATE_Y + 6] };
const SCAN_H = 12;
// Where people stand, and where they walk to inside.
export const SPOTS = { user: [LANES.user, 29], thief: [LANES.thief, 42] };
export const INSIDE_Y = -46;

// The box office, front left; its window is on the right-hand (+x) face.
const OFFICE = { x: -104, y: 6, w: 42, d: 42, r: 2 };
const OFFICE_H = 22;
export const WINDOW = [OFFICE.x + OFFICE.w + 14, OFFICE.y + 16];   // where a visitor stands
export const WINDOW_LEDGE = [OFFICE.x + OFFICE.w + 2, OFFICE.y + 16, 12];

// The deny list (back left) and the user record (back right).
const DENY = { x: -102, y: -34, w: 40, d: 8, r: 1 };
const DENY_H = 9, BOARD_Z = DENY_H, BOARD_H = 32;
export const HOOKS = [0, 1, 2].map((i) => [DENY.x + 4.5 + 11 * i, DENY.y + 3, BOARD_Z + 8]);
const RECORD = { x: 36, y: -48, w: 64, d: 22, r: 1.6 };
const RECORD_H = 14;

// The gate log, front right.
const LOG = { x: 30, y: 16, w: 74, d: 32, r: 1.6 };
const LOG_H = 19;

// The stage at the back and the crowd in front of it.
const STAGE = { x: -62, y: -90, w: 160, d: 20, r: 1.6 };
const STAGE_H = 7;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [BEAM.x, BEAM.y, BEAM_Z + BEAM_H + 10], [OFFICE.x, OFFICE.y, OFFICE_H + 14], [STAGE.x + STAGE.w, STAGE.y, 34], [DENY.x, DENY.y, BOARD_Z + BOARD_H + 8]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

// Words on the machine are never smaller than the counter captions of the other lessons (queues: 2.6 at scale 1.85).
export const MIN_WORD = (2.6 * 1.8515) / P.scale;
const CAP = Math.max(2.8, Math.ceil(MIN_WORD * 10) / 10);

const { S, L, D, at, seg } = shorthand(P);
const text = (x, y, z, words, size = CAP, opts = {}) => {
  if (size < MIN_WORD - 1e-9) throw new Error(`tokens figure: word size ${size} below ${MIN_WORD}`);
  return faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });
};
const COUNTER = { w: 4.4, h: 5.8, gap: 0.6, pad: 1.1 };
const counter = (x, y, z, count, name, opts = {}) => digitCounter(P, { x, y, z, count, ...COUNTER, name, ...opts });
const counterSpan = (count) => count * COUNTER.w + (count - 1) * COUNTER.gap;

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })

}

// ---------- the stage and the crowd ----------
function stage() {
  const out = [S(k.slabOf(STAGE, 0, STAGE_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(STAGE, 2.4), STAGE_H, P), { tone: "faint" }));
  // speaker stacks at both ends, pennants along the back edge
  for (const x of [STAGE.x + 4, STAGE.x + STAGE.w - 14]) {
    const box = { x, y: STAGE.y + 4, w: 10, d: 9, r: 0.6 };
    out.push(S(k.slabOf(box, STAGE_H, 18, P, 2, 0.3), { tone: "mid", crease: "lo" }));
  }
  for (let x = STAGE.x + 26; x < STAGE.x + STAGE.w - 20; x += 22) out.push(pennant(P, { x, y: STAGE.y + 2, z: STAGE_H, height: 16, length: 7, drop: 4.5 }));
  return out.join("");
}
const CROWD = [[-56, -64], [-46, -68], [-36, -63], [-24, -68], [-12, -63], [0, -67], [12, -62], [24, -67], [36, -70], [48, -66], [60, -71], [72, -67], [84, -71],
  [-50, -55], [-17, -57], [12, -54], [24, -58]];
function crowd() {
  return CROWD.map(([x, y]) => figurine(P, [x, y, 0], { scale: 1.15 })).join("");
}

// ---------- the deny list: a board of band ids the gate may look up ----------
function denyBoard() {
  const out = [S(k.slabOf(DENY, 0, DENY_H, P, 3, 0.5), { tone: "mid" })];
  const panel = { x: DENY.x + 2, y: DENY.y + 1, w: DENY.w - 4, d: 2, r: 0.4 };
  out.push(S(k.slabOf(panel, BOARD_Z, BOARD_H, P, 2, 0.3), { tone: "mid", crease: "lo" }));
  const face = panel.y + panel.d;
  out.push(L(k.faceRectY(P, panel.x + 1.6, panel.x + panel.w - 1.6, face, BOARD_Z + 1.6, BOARD_Z + BOARD_H - 1.6), { tone: "faint" }));
  out.push(text(panel.x + 2.6, face, BOARD_Z + BOARD_H - 9, t("DENY LIST", "LISTA DE BLOQUEO"), 3.2));
  // hooks for the cards
  out.push(D(HOOKS.map(([x, y, z]) => at([x + 4.5, face + 0.2, z + 8])), { size: 0.7, tone: "lo" }));
  out.push(`<g data-deny-cards></g>`);
  const lp = [panel.x + panel.w - 5, panel.y + 1, BOARD_Z + BOARD_H];
  out.push(`<g data-lamp-deny="off">${lamp(P, lp, { r: 2.2 })}</g><g data-lamp-deny="on" style="display:none">${litFill(lamp(P, lp, { r: 2.2, lit: true }))}</g>`);
  return out.join("");
}
// A card on the deny list, drawn at the origin of its hook and placed by the live code.
export function denyCardSvg() {
  const plan = { x: 0, y: 0, w: 9, d: 0.6, r: 0.15 };
  return S(k.slabOf(plan, 0, 7, P, 2, 0.15), { tone: "hi", crease: "none" })
    + faceText(P, [4.5, 0.6, 2.2], "#0", { size: CAP, tone: "hi", anchor: "middle", attr: "data-deny-id" });
}

// ---------- the user record: the token version ----------
function record() {
  const out = [S(k.slabOf(RECORD, 0, RECORD_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(RECORD, 2), RECORD_H, P), { tone: "faint" }));
  out.push(plaque(P, { x: RECORD.x + 6, y: RECORD.y + 4, z: RECORD_H, w: 26, d: 9, text: t("USER", "USUARIO"), size: 3.4 }));
  const front = RECORD.y + RECORD.d;
  out.push(counter(RECORD.x + 4, front, 3.6, 2, "ver", { value: 1 }));
  out.push(text(RECORD.x + 4 + counterSpan(2) + 3.4, front, 5.2, t("TOKEN VERSION", "VERSIÓN DEL TOKEN")));
  const lp = [RECORD.x + RECORD.w - 6, RECORD.y + 8, RECORD_H];
  out.push(`<g data-lamp-ver="off">${lamp(P, lp, { r: 2.2 })}</g><g data-lamp-ver="on" style="display:none">${litFill(lamp(P, lp, { r: 2.2, lit: true }))}</g>`);
  return out.join("");
}

// ---------- the wires from the scanners to the state they can look up ----------
export const WIRES = {
  deny: [[PILLARS[0], GATE_Y - 3], [DENY.x + DENY.w + 3, GATE_Y - 3], [DENY.x + DENY.w + 3, DENY.y + DENY.d / 2], [DENY.x + DENY.w, DENY.y + DENY.d / 2]],
  ver: [[PILLARS[2], GATE_Y - 3], [RECORD.x - 3, GATE_Y - 3], [RECORD.x - 3, RECORD.y + RECORD.d / 2], [RECORD.x, RECORD.y + RECORD.d / 2]],
};
function wires() {
  const line = (pts) => L(k.onTop(pts, 0.2, P), { tone: "lo", dashed: true });
  return `<g data-wire="deny">${line(WIRES.deny)}</g><g data-wire="ver">${line(WIRES.ver)}</g><g data-pulse-layer></g>`;
}

// ---------- the box office ----------
function office() {
  const out = [S(k.slabOf(OFFICE, 0, OFFICE_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(OFFICE, 2.4), OFFICE_H, P), { tone: "faint" }));
  // the window on the right-hand face: an opening frame and a ledge
  const side = OFFICE.x + OFFICE.w, wy = WINDOW_LEDGE[1];
  out.push(`<path class="tok-window" d="${k.faceRectX(P, side, wy - 7, wy + 7, 13, 21)}"/>`);
  out.push(S(k.slabOf({ x: side, y: wy - 8, w: 2.6, d: 16, r: 0.4 }, 11.6, 1.4, P, 2), { tone: "hi", crease: "lo" }));
  // an awning over the window
  out.push(S(k.slabOf({ x: side, y: wy - 9, w: 4, d: 18, r: 0.4 }, 22, 1.2, P, 2), { tone: "hi", crease: "lo" }));
  // the sign on the roof
  const sx = OFFICE.x + 5, sy = OFFICE.y + OFFICE.d - 10;
  for (const u of [3, 33]) out.push(S(k.cylinder(sx + u, sy - 0.6, 0.6, OFFICE_H, 3, P, 10), { tone: "mid", crease: "none" }));
  out.push(sign(P, { x: sx, y: sy, z: OFFICE_H + 3, w: 36, h: 8, text: t("BOX OFFICE", "TAQUILLA"), size: 3.6, posts: false }));
  // counters on the front face, captions above their housings
  const front = OFFICE.y + OFFICE.d;
  out.push(counter(OFFICE.x + 5, front, 3.4, 3, "refreshes"));
  out.push(text(OFFICE.x + 4, front, 12.8, t("REFRESHES", "RENOVACIONES")));
  out.push(counter(OFFICE.x + 30, front, 3.4, 2, "logins"));
  out.push(text(OFFICE.x + 29, front, 12.8, t("LOGINS", "LOGINS")));
  // the revocation lamp on the roof: lit while the box office revokes a pass family
  const lp = [OFFICE.x + OFFICE.w - 6, OFFICE.y + 6, OFFICE_H];
  out.push(`<g data-lamp-office="off">${lamp(P, lp, { r: 2.4 })}</g><g data-lamp-office="on" style="display:none">${litFill(lamp(P, lp, { r: 2.4, lit: true }))}</g>`);
  return out.join("");
}

// ---------- the gate ----------
// An arm across a lane: closed (across, at ARM_Z) or open (raised beside its left pillar).
function arm(lane, open) {
  const x0 = lane - 12, x1 = lane + 12;
  const plan = open ? { x: x0 - 0.2, y: GATE_Y - 0.8, w: 1.6, d: 1.6, r: 0.3 } : { x: x0, y: GATE_Y - 0.8, w: x1 - x0, d: 1.6, r: 0.4 };
  return S(k.slabOf(plan, open ? ARM_Z : ARM_Z, open ? 16 : 1.6, P, 2), { tone: "hi", crease: "lo" });
}
function gateBack() {
  const out = [];
  // a mat along each lane, from where people wait to the gate, with chevrons toward the gate
  for (const lane of Object.values(LANES)) {
    const mat = { x: lane - 6, y: GATE_Y + 4, w: 12, d: SPOTS.thief[1] + 6 - GATE_Y - 4, r: 1 };
    out.push(S(k.slabOf(mat, 0, 0.6, P, 2), { tone: "lo", crease: "none" }));
    const chev = [];
    for (let y = GATE_Y + 12; y < SPOTS.user[1] - 6; y += 10) chev.push(k.onTop([[lane - 3.5, y + 3], [lane, y], [lane + 3.5, y + 3]], 0.6, P));
    out.push(L(chev.join(""), { tone: "mid" }));
  }
  // floor of the walk through the gate
  out.push(S(k.slabOf({ x: -44, y: GATE_Y - 4, w: 64, d: 8, r: 0.6 }, 0, 0.6, P, 2), { tone: "lo", crease: "none" }));
  return out.join("");
}
function gate() {
  const out = [];
  for (const x of PILLARS) out.push(S(k.slabOf({ x: x - 2, y: GATE_Y - 2, w: 4, d: 4, r: 0.5 }, 0, PILLAR_H, P, 2, 0.3), { tone: "mid", crease: "lo" }));
  for (const [who, lane] of Object.entries(LANES)) {
    out.push(`<g data-arm="${who}" data-state="closed">${arm(lane, false)}</g><g data-arm-open="${who}" style="display:none">${arm(lane, true)}</g>`);
  }
  // the beam, with the clock the gate compares expiries with
  out.push(S(k.slabOf(BEAM, BEAM_Z, BEAM_H, P, 2, 0.4), { tone: "hi", crease: "lo" }));
  const face = BEAM.y + BEAM.d;
  out.push(sign(P, { x: BEAM.x + 6, y: BEAM.y + 3.2, z: BEAM_Z + BEAM_H, w: 24, h: 7, text: t("GATE", "ENTRADA"), size: 3.4, posts: false }));
  const cx = BEAM.x + 32;
  out.push(text(cx - 3.2, face, BEAM_Z + 2.8, t("CLOCK", "RELOJ"), CAP, { anchor: "end" }));
  const z = BEAM_Z + 1.6;
  out.push(digitCounter(P, { x: cx, y: face, z, count: 2, ...COUNTER, pad: 0.8, name: "hh", value: 9 }));
  const colonX = cx + counterSpan(2) + 1.4;
  out.push(D([at([colonX, face + 0.1, z + 1.6]), at([colonX, face + 0.1, z + 4.2])], { size: 0.8, tone: "hi" }));
  out.push(digitCounter(P, { x: colonX + 1.4, y: face, z, count: 2, ...COUNTER, pad: 0.8, name: "mm", value: 0 }));
  return out.join("");
}
// The scanner posts in front of the gate, one per lane, each with a lamp: lit while it lets someone in.
function scanners() {
  const out = [];
  for (const [who, [x, y]] of Object.entries(SCAN)) {
    out.push(S(k.slabOf({ x: x - 2.4, y: y - 2.4, w: 4.8, d: 4.8, r: 0.6 }, 0, SCAN_H, P, 2, 0.3), { tone: "mid", crease: "lo" }));
    out.push(S(k.slabOf({ x: x - 3.2, y: y - 3.2, w: 6.4, d: 6.4, r: 0.8 }, SCAN_H, 1.6, P, 2, 0.3), { tone: "hi", crease: "lo" }));
    const pad = (lit) => S(k.slabOf({ x: x - 2.2, y: y - 2.2, w: 4.4, d: 4.4, r: 0.5 }, SCAN_H + 1.6, 0.8, P, 2), { tone: "hi", crease: "lo", lit });
    out.push(`<g data-scan="${who}">${pad(false)}</g><g data-scan-on="${who}" style="display:none">${litFill(pad(true))}</g>`);
  }
  return out.join("");
}

// ---------- the gate log ----------
function gateLog() {
  const out = [S(k.slabOf(LOG, 0, LOG_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(LOG, 2.4), LOG_H, P), { tone: "faint" }));
  out.push(plaque(P, { x: LOG.x + 6, y: LOG.y + 5, z: LOG_H, w: 34, d: 9, text: t("GATE LOG", "REGISTRO"), size: 3.4 }));
  const front = LOG.y + LOG.d, z = 2.6, cz1 = 11.6, cz2 = 15.4;
  const LC = { w: 4, gap: 0.5 }, lspan = (n) => n * LC.w + (n - 1) * LC.gap;
  const counter = (x, y, zz, count, name) => digitCounter(P, { x, y, z: zz, count, ...COUNTER, ...LC, name });
  // the thief's entries after the revocation
  const x1 = LOG.x + 4;
  out.push(counter(x1, front, z, 3, "after"));
  out.push(text(x1 - 1, front, cz2, t("THIEF IN", "ENTRA LADRÓN")), text(x1 - 1, front, cz1, t("AFTER REVOKE", "TRAS REVOCAR")));
  // the window: minutes after the revocation the stolen band last worked, with tenths
  const x2 = LOG.x + 30;
  out.push(counter(x2, front, z, 3, "win"));
  const dot = x2 + lspan(3) + 2.2;
  out.push(D([at([dot, front + 1.5, z + 0.8])], { size: 1.7, tone: "hi" }));
  out.push(counter(dot + 2.2, front, z, 1, "winT"));
  out.push(text(x2 - 1, front, cz2, t("WINDOW", "VENTANA")), text(x2 - 1, front, cz1, t("MIN", "MIN")));
  // lookups the gate made
  const x3 = LOG.x + 56;
  out.push(counter(x3, front, z, 3, "lookups"));
  out.push(text(x3 - 1, front, cz2, t("LOOKUPS", "CONSULTAS")));
  return out.join("");
}

// ---------- the people ----------
// A walker: the user (bare-headed) or the thief (a wide-brimmed hat), drawn at the origin, with the wristband card held
// in front (id and version on top, expiry below) and the refresh pass card under it. The thief's cards are copies: lit.
export const PERSON = { scale: 0.85, band: { x: 3.4, w: 12.4, h: 8.6, z: 7.4 }, pass: { x: -12.4, w: 8.6, h: 6, z: 8.4 } };
export function walkerSvg(kind) {
  const s = PERSON.scale, b = PERSON.band, p = PERSON.pass;
  const body = person(P, [0, 0, 0], { scale: s, hat: kind === "thief" ? "brim" : null });
  const y = 4.8 * s;
  // the cards are held out at each side, so the person stays visible between them
  const bx = b.x + b.w / 2, px = p.x + p.w / 2;
  const band = `<g class="wb-lit-group" data-band>${S(k.slabOf({ x: b.x, y, w: b.w, d: 0.6, r: 0.15 }, b.z, b.h, P, 2, 0.15), { tone: "hi", crease: "none" })}`
    + faceText(P, [bx, y + 0.6, b.z + 4.9], "#0", { size: CAP, tone: "hi", anchor: "middle", attr: "data-band-id" })
    + faceText(P, [bx, y + 0.6, b.z + 1.1], "00:00", { size: CAP, tone: "hi", anchor: "middle", attr: "data-band-exp" }) + `</g>`;
  const pass = `<g class="wb-lit-group" data-pass>${S(k.slabOf({ x: p.x, y, w: p.w, d: 0.6, r: 0.15 }, p.z, p.h, P, 2, 0.15), { tone: "hi", crease: "none" })}`
    + faceText(P, [px, y + 0.6, p.z + 1.9], "P0", { size: CAP, tone: "hi", anchor: "middle", attr: "data-pass-id" }) + `</g>`;
  return body + band + pass;
}
// A copied card in flight (theft), or a deny-list card on its way to the board.
export function flyCardSvg() {
  const b = PERSON.band;
  return `<g class="wb-lit-group">${S(k.slabOf({ x: -b.w / 2, y: 0, w: b.w, d: 0.6, r: 0.15 }, 0, b.h, P, 2, 0.15), { tone: "hi", crease: "none" })}</g>`;
}

const FIGURE_LABEL = t(
  "A festival gate on a base plate. On the left, a box office with a window on its right-hand side signs wristbands and hands out refresh passes; counters on its front show refreshes and logins, and a lamp on its roof lights when it revokes passes. In the middle, a gate frame with two lanes, the user's on the left and a thief's on the right; a scanner post with a lamp stands in front of each lane, and an arm across each lane lifts for a wristband the gate accepts. A clock on the gate's beam is what it compares expiries with. The user and the thief carry their wristband cards, showing an id and an expiry, with a refresh pass card under it; the thief's copies are lit. Behind the gate a crowd stands in front of a stage. At the back left, a deny-list board with hooks for revoked wristband ids; at the back right, the user record with a token-version counter; dashed wires run from the scanners to both. At the front right, the gate log counts the thief's entries after the revocation, the window in minutes, and the lookups the gate made.",
  "La entrada de un festival sobre una placa base. A la izquierda, una taquilla con una ventanilla en su lado derecho firma pulseras y entrega pases de renovación; contadores en su frente muestran renovaciones y logins, y una lámpara en su techo se enciende cuando revoca pases. En el medio, el marco de la entrada con dos carriles, el del usuario a la izquierda y el de un ladrón a la derecha; delante de cada carril hay un poste lector con una lámpara, y una barrera en cada carril se levanta cuando la entrada acepta una pulsera. Un reloj en la viga de la entrada es contra lo que compara los vencimientos. El usuario y el ladrón llevan su tarjeta de pulsera, con un id y un vencimiento, y debajo la tarjeta del pase de renovación; las copias del ladrón están encendidas. Detrás de la entrada, un público frente a un escenario. Atrás a la izquierda, un tablero de lista de bloqueo con ganchos para los ids de pulseras revocadas; atrás a la derecha, el registro del usuario con un contador de versión del token; cables punteados van de los lectores a ambos. Adelante a la derecha, el registro de la entrada cuenta las entradas del ladrón tras la revocación, la ventana en minutos y las consultas que hizo la entrada.",
);

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: FIGURE_LABEL,
    body: [
      plate(),
      stage(),
      crowd(),
      denyBoard(),
      record(),
      wires(),
      gateBack(),
      office(),
      `<g data-layer="back"></g>`,
      gate(),
      scanners(),
      `<g data-layer="front"></g>`,
      `<g data-layer="fly"></g>`,
      gateLog(),
    ],
  });
}

export const GEOMETRY = { GATE_Y, LANES, SCAN, SPOTS, INSIDE_Y, WINDOW, WINDOW_LEDGE, HOOKS, WIRES, ARM_Z, PERSON, SCAN_H };

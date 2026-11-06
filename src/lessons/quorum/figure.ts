// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A vault row: five vaults at the back, A to E, are the replicas of one record; the wheels on each door show the
// version it holds, and the door lights while it holds the newest version written. In front, the coordinator's desk:
// its front shows the acknowledged writes (OK), the failed requests (FAILED), the stale reads (STALE), the reads that
// went back (WENT BACK), the newest version acknowledged to a client (LAST OK) and the version the last read returned
// (READ), with a STALE sign that stands up while that read was stale; plaques on its top show W and R. Five tracks run
// from behind the desk to the vault doors: slips carry each write out (lit, with its version) and its ack back, and
// each read out (GET) and the version it found back (GOT vN). The writer stands at the desk's left, other readers at
// its right.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, labelPlate, digitCounter, person, figurine, plaque, sign, faceText } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { N, NAMES } from "./sim";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -102, y: -92, w: 204, d: 140, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The vaults, left (A) to right (E), at the back.
export const VAULT_X = [-76, -38, 0, 38, 76];
const VAULT = { w: 28, d: 24, h: 34 };
const VAULT_Y = -86;
export const VAULT_FRONT = VAULT_Y + VAULT.d;          // -62
const DOOR = { w: 20, z0: 4, z1: 30, d: 1.2 };

// The coordinator's desk, across the front: low, so the slips waiting behind it stay in view.
const DESK = { x: -66, y: 16, w: 132, d: 24, r: 2 };
const DESK_H = 14;
const DESK_FRONT = DESK.y + DESK.d;
export const DESK_BACK = DESK.y;
// Where each track leaves the desk.
export const DESK_X = [-52, -26, 0, 26, 52];
// The track ends a little short of the doors, where slips wait while a vault works; at the desk end, slips wait far
// enough behind the desk to be seen.
export const DOOR_Y = VAULT_FRONT + DOOR.d + 5;
export const START_Y = DESK_BACK - 30;
// The counters on the desk's front, left to right; the last two are versions, not counts.
const SLOT_X = [-56, -35, -14, 8, 34, 56];
const WRITER = [-86, 24, 0];
export const READERS = [[78, 18], [91, 24], [80, 30]];
export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [VAULT_X[0] - VAULT.w / 2, VAULT_Y, VAULT.h + 1], [VAULT_X[4] + VAULT.w / 2, VAULT_Y, VAULT.h + 1], [WRITER[0], WRITER[1], 30], [READERS[1][0], READERS[1][1], 16]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 50 },
);

const { S, L } = shorthand(P);
const text = (x, y, z, words, size = 2.4, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + labelPlate(P, { x: -98, y: -14, w: 22, d: 11, r: 1.4 }, [[-94, -10, 13], [-94, -6, 8]]);
}

// ---------- the tracks ----------
export const trackOf = (i) => [[DESK_X[i], START_Y], [VAULT_X[i], DOOR_Y]];
function tracks() {
  const out = [];
  for (let i = 0; i < N; i++) {
    const [[x0], [x1, y1]] = trackOf(i), y0 = DESK_BACK;
    // two rails, 2 units either side of the centre line
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), nx = (-dy / len) * 2.4, ny = (dx / len) * 2.4;
    const rails = k.lineOnTop([x0 + nx, y0 + ny], [x1 + nx, y1 + ny], 0, P) + k.lineOnTop([x0 - nx, y0 - ny], [x1 - nx, y1 - ny], 0, P);
    out.push(`<g data-track="${i}">${L(rails, { tone: "mid" })}</g>`);
  }
  return out.join("");
}

// ---------- the vaults ----------
function vault(i) {
  const cx = VAULT_X[i];
  const plan = { x: cx - VAULT.w / 2, y: VAULT_Y, w: VAULT.w, d: VAULT.d, r: 1.6 };
  const out = [S(k.slabOf(plan, 0, VAULT.h, P, 3, 0.6), { tone: "mid", inner: L(k.planOutline(k.insetPlan(plan, 2), VAULT.h, P), { tone: "faint" }) })];
  out.push(faceText(P, [cx, VAULT_Y + VAULT.d / 2 + 4, VAULT.h], NAMES[i], { face: "top", size: 11, tone: "hi", anchor: "middle" }));
  // the door: lit while the vault holds the newest version written; its wheels show the version it holds
  const door = { x: cx - DOOR.w / 2, y: VAULT_FRONT, w: DOOR.w, d: DOOR.d, r: 0.4 };
  const df = VAULT_FRONT + DOOR.d;
  out.push(`<g class="wb-lit-group" data-door="${i}">`
    + S(k.slabOf(door, DOOR.z0, DOOR.z1 - DOOR.z0, P, 2, 0.2), { tone: "hi", crease: "lo" })
    + L(k.sideRing([cx, df, 11], 4.2, "y", P, 24) + k.sideRing([cx, df, 11], 1.2, "y", P, 12), { tone: "mid" })
    + L(k.segment([cx - 4.2, df, 11], [cx + 4.2, df, 11], P) + k.segment([cx, df, 6.8], [cx, df, 15.2], P), { tone: "mid" })
    + `</g>`);
  out.push(digitCounter(P, { x: cx - 7.8, y: df, z: 20, count: 3, w: 4.6, h: 6.6, gap: 0.6, pad: 0.9, name: "v" + i }));
  // DOWN: a board across the door, shown while the vault is down
  out.push(`<g data-down="${i}" style="display:none">` + sign(P, { x: cx - 12, y: df + 0.6, z: 8.6, w: 24, h: 8, d: 1, text: t("DOWN", "CAÍDA"), size: 3.8, posts: false }) + `</g>`);
  return out.join("");
}

// ---------- the coordinator's desk ----------
function desk() {
  const out = [S(k.slabOf(DESK, 0, DESK_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(DESK, 2.4), DESK_H, P), { tone: "faint" }));
  out.push(faceText(P, [DESK.x + 5, DESK.y + 19.4, DESK_H], t("COORDINATOR", "COORDINADOR"), { face: "top", size: 4.4, tone: "hi" }));
  // counters on the front face, each under its word
  const col = (cx, name, words) => digitCounter(P, { x: cx - 6.8, y: DESK_FRONT, z: 1.8, count: 3, w: 4.2, h: 5.6, gap: 0.5, pad: 0.9, name })
    + faceText(P, [cx, DESK_FRONT, 9.6], words, { size: 2.8, tone: "mid", anchor: "middle" });
  out.push(col(SLOT_X[0], "ok", t("OK", "OK")));
  out.push(col(SLOT_X[1], "failed", t("FAILED", "FALLIDAS")));
  out.push(col(SLOT_X[2], "stale", t("STALE", "VIEJAS")));
  out.push(col(SLOT_X[3], "back", t("WENT BACK", "RETROCEDIERON")));
  out.push(col(SLOT_X[4], "lastOk", t("LAST OK", "ÚLTIMO OK")));
  out.push(col(SLOT_X[5], "read", t("READ", "LEÍDA")));
  // a rule between the counts and the two versions
  const xr = (SLOT_X[3] + SLOT_X[4]) / 2;
  out.push(L(k.segment([xr, DESK_FRONT, 1.4], [xr, DESK_FRONT, DESK_H - 1.4], P), { tone: "faint" }));
  // W and R plaques on the top; their numbers are set live
  for (const [x, key] of [[-14, "W"], [12, "R"]]) {
    out.push(plaque(P, { x, y: DESK.y + 5, z: DESK_H, w: 22, d: 10 }));
    out.push(faceText(P, [x + 11, DESK.y + 5 + 6.8, DESK_H + 0.8], key + " = 2", { face: "top", size: 4.8, tone: "hi", anchor: "middle", attr: `data-plaque="${key}"` }));
  }
  // the STALE sign behind READ: it stands up while the last read returned less than LAST OK
  out.push(`<g data-stale style="display:none">` + sign(P, { x: SLOT_X[5] - 10, y: DESK.y + 14, z: DESK_H, w: 20, h: 7, text: t("STALE", "VIEJA"), size: 3.4, posts: false }) + `</g>`);
  return out.join("");
}
function people() {
  const out = [person(P, WRITER, { scale: 1.1 })];
  out.push(plaque(P, { x: WRITER[0] - 9, y: WRITER[1] + 8, z: 0, w: 18, d: 7, text: t("WRITER", "ESCRITOR"), size: 3 }));
  out.push(`<g data-readers style="display:none">${READERS.map(([x, y]) => figurine(P, [x, y, 0], { scale: 0.9 })).join("")}`
    + plaque(P, { x: 74, y: 38, z: 0, w: 20, d: 7, text: t("READERS", "LECTORES"), size: 3 }) + `</g>`);
  return out.join("");
}

// A slip on a little sled: carried along a track, drawn at the origin and moved with translateAlong. Its one <text>
// is set by the live code (v12, ACK, GET, GOT v12); a write slip lights when it carries the newest version.
export const SLIP = { w: 14, h: 7, z: 1 };
export function slipSvg() {
  const c = SLIP;
  const sled = S(k.slabOf({ x: -5, y: -2.4, w: 10, d: 4.8, r: 0.8 }, 0, 1, P, 2, 0.2), { tone: "mid", crease: "none" });
  const plan = { x: -c.w / 2, y: -0.3, w: c.w, d: 0.6, r: 0.15 };
  const slip = `<g class="wb-lit-group" data-slip>${S(k.slabOf(plan, c.z, c.h, P, 2, 0.15), { tone: "hi", crease: "none" })}`
    + faceText(P, [0, plan.y + plan.d, c.z + 1.8], "v0", { size: 3.6, tone: "hi", anchor: "middle", attr: "data-slip-text" }) + `</g>`;
  return sled + slip;
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A row of five vaults, A to E, at the back of a base plate: the replicas of one record. Digit wheels on each vault's door show the version of the record it holds, and the door lights while the vault holds the newest version written. A vault that is down has a DOWN board across its door. Across the front stands the coordinator's desk. Counters on its front count acknowledged writes (OK), failed requests (FAILED), stale reads (STALE) and reads that went back (WENT BACK), and show LAST OK, the newest version acknowledged to a client, and READ, the version the last read returned; a STALE sign stands up behind READ while that read returned less than LAST OK. Plaques on the desk's top show W, the acks a write waits for, and R, the replicas a read asks. Five tracks run from behind the desk to the vault doors: slips carry each write out, lit while it is the newest version, and bring its ack back; read slips go out marked GET and come back marked GOT with the version they found. The writer stands at the left of the desk; other readers wait at its right.",
      "Una fila de cinco bóvedas, de la A a la E, al fondo de una placa base: las réplicas de un registro. Ruedas de dígitos en la puerta de cada bóveda muestran la versión del registro que guarda, y la puerta se enciende mientras la bóveda tiene la versión más nueva escrita. Una bóveda caída tiene un tablón CAÍDA sobre la puerta. A lo ancho del frente está el escritorio del coordinador. Contadores en su frente cuentan las escrituras confirmadas (OK), las solicitudes fallidas (FALLIDAS), las lecturas viejas (VIEJAS) y las lecturas que retrocedieron (RETROCEDIERON), y muestran ÚLTIMO OK, la versión más nueva confirmada a un cliente, y LEÍDA, la versión que devolvió la última lectura; un letrero VIEJA se levanta detrás de LEÍDA mientras esa lectura devolvió menos que ÚLTIMO OK. Placas sobre el escritorio muestran W, las confirmaciones que espera una escritura, y R, las réplicas a las que pregunta una lectura. Cinco vías van desde detrás del escritorio a las puertas de las bóvedas: papeletas llevan cada escritura, encendidas mientras es la versión más nueva, y traen su confirmación de vuelta; las papeletas de lectura salen marcadas GET y vuelven marcadas VIO con la versión que encontraron. El escritor está a la izquierda del escritorio; otros lectores esperan a su derecha.",
    ),
    body: [
      plate(),
      tracks(),
      ...Array.from({ length: N }, (_, i) => vault(i)),
      `<g data-layer="slips"></g>`,
      desk(),
      people(),
    ],
  });
}

export const GEOMETRY = { VAULT_X, DESK_X, DOOR_Y, START_Y, H: 0 };

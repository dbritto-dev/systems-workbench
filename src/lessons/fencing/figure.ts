// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A key office, a vault and three workers' desks. The key office (the lock service) hands out one key at a time: a
// lease with a timer (the TTL dial) and a number on its tag (the token, one higher each time). Workers A, B and C sit
// at their desks at the front; whoever holds the key sends slips to the vault (the storage): a read, then a write,
// each with the key's number. The vault keeps the record, its version, and, when fencing is on, the highest token it
// has seen; slips it refuses drop into the REJECTED tray. Every number is a counter on a real object.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, labelPlate, digitCounter, person, keyPart, dial, card, lamp, faceText, variants, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 470;

const PLATE = { x: -132, y: -90, w: 242, d: 130, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The key office (the lock service), back left.
const KO = { x: -124, y: -84, w: 74, d: 40, r: 2 };
const KO_H = 20;
const KO_FRONT = KO.y + KO.d;
const KO_SIDE = KO.x + KO.w;
const DIAL = { x: -102, y: -64, r: 11.5, h: 4 };
const HOOK = [-70, -64];
export const HOOK_KEY = [HOOK[0] + 6.6, HOOK[1], KO_H + 10];
export const KEY_OUT = [-80, KO_FRONT + 2, KO_H + 2];          // where a key leaves the office

// The vault (the storage), back right.
const VAULT = { x: 4, y: -84, w: 98, d: 46, r: 2 };
const VAULT_H = 32;
const VAULT_FRONT = VAULT.y + VAULT.d;
const SLOT = { x: VAULT.x + 48, w: 28, z: 21.6, h: 4 };
export const SLOT_AT = [SLOT.x + SLOT.w / 2, VAULT_FRONT + 1.6, SLOT.z + 1.2];
const FENCE = { x: VAULT.x + 6, y: VAULT.y + 6, w: 50, d: 13, r: 1 };
const FENCE_H = 9;
const FENCE_FRONT = FENCE.y + FENCE.d;
const LAMP_AT = [VAULT.x + 84, VAULT.y + 14, VAULT_H];

// The REJECTED tray, in front of the vault.
const TRAY = { x: 58, y: 2, w: 44, d: 18, r: 1.4 };
const TRAY_H = 8;
export const TRAY_SPOT = [TRAY.x + TRAY.w / 2, TRAY.y + TRAY.d / 2, TRAY_H - 1];

// The desks at the front: one per worker.
export const DX = [-94, -34, 26];
const DESK = { y: 8, w: 50, d: 22, h: 12 };
const DESK_FRONT = DESK.y + DESK.d;
export const DESK_H = DESK.h;
export const KEY_SPOT = DX.map((x) => [x + 12, DESK.y + 10, DESK.h]);
export const SLIP_SPOT = DX.map((x) => [x - 2, DESK.y + 11, DESK.h + 0.4]);
export const PERSON_AT = DX.map((x) => [x - 12, DESK.y - 9, 0]);

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [HOOK[0], HOOK[1], KO_H + 18], ...k.boxCorners(VAULT, 0, VAULT_H + FENCE_H + 2), ...PERSON_AT.map(([x, y]) => [x, y, 34])],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 50 },
);

const { S, L } = shorthand(P);
const text = (x, y, z, words, size = 3.2, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });
const counter = (o) => digitCounter(P, { w: 5, h: 6.6, gap: 0.6, pad: 1.2, ...o });
// The captions beside counters, at the standard size of the other lessons.
const LABEL = 3;

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + labelPlate(P, { x: 74, y: 26, w: 24, d: 10, r: 1.4 }, [[78, 29.6, 15], [78, 33.2, 9]]);
}

// ---------- the key office ----------
function keyOffice() {
  const out = [S(k.slabOf(KO, 0, KO_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(KO, 2.4), KO_H, P), { tone: "faint" }));
  out.push(text(KO.x + 4.6, KO_FRONT, 14, t("KEY OFFICE", "OFICINA DE LLAVES"), 3.8));
  out.push(counter({ x: KO.x + 4.6, y: KO_FRONT, z: 3.2, count: 3, name: "token" }));
  out.push(text(KO.x + 24, KO_FRONT, 5.2, "TOKEN", LABEL));
  // on the right face: how often the key went to a new holder while the old one, paused, still thought it held it
  out.push(counter({ x: KO_SIDE, y: KO_FRONT - 2.8, z: 4, count: 2, face: "x", name: "two" }));
  out.push(faceText(P, [KO_SIDE, KO_FRONT - 16.6, 5.8], t("TWO HOLDERS", "DOS DUEÑOS"), { face: "x", size: LABEL, tone: "mid" }));
  // the lease timer: the needle shows what's left of the current lease
  out.push(dial(P, { x: DIAL.x, y: DIAL.y, z: KO_H, r: DIAL.r, h: DIAL.h, ticks: 27, every: 3, from: Math.PI * 0.1, span: Math.PI * 1.8, name: "ttl", value: 0 }));
  out.push(faceText(P, [DIAL.x, DIAL.y + DIAL.r * 0.62, KO_H + DIAL.h + 0.1], "TTL", { face: "top", size: 3.4, tone: "hi", anchor: "middle" }));
  // the hook the free key hangs on
  const [hx, hy] = HOOK;
  out.push(S(k.cylinder(hx, hy, 3, KO_H, 1.4, P, 20, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(hx, hy, 1, KO_H + 1.4, 17, P, 12), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: hx - 1, y: hy - 1, w: 8.6, d: 2, r: 0.4 }, KO_H + 17, 1.8, P, 2), { tone: "mid", crease: "none" }));
  out.push(`<g data-hook-key>${keyPart(P, HOOK_KEY, { scale: 1.7 })}</g>`);
  return out.join("");
}

// ---------- the vault ----------
function vault() {
  const out = [S(k.slabOf(VAULT, 0, VAULT_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(VAULT, 2.4), VAULT_H, P), { tone: "faint" }));
  // the door's outline and hinges on the front face
  out.push(L(k.faceRectY(P, VAULT.x + 3, VAULT.x + VAULT.w - 3, VAULT_FRONT, 3, VAULT_H - 3), { tone: "faint" }));
  out.push(text(VAULT.x + 5.4, VAULT_FRONT, 22.6, t("VAULT", "BÓVEDA"), 4.2));
  // the slot slips go in by
  out.push(S(k.slabOf({ x: SLOT.x, y: VAULT_FRONT, w: SLOT.w, d: 1.4, r: 0.4 }, SLOT.z, SLOT.h, P, 2, 0.2), { tone: "hi", crease: "lo" }));
  out.push(L(k.segment([SLOT.x + 2.4, VAULT_FRONT + 1.4, SLOT.z + 1.7], [SLOT.x + SLOT.w - 2.4, VAULT_FRONT + 1.4, SLOT.z + 1.7], P), { tone: "hi" }));
  // the record's version, and the writes that overwrote an update they never saw
  out.push(counter({ x: VAULT.x + 5.4, y: VAULT_FRONT, z: 9, count: 3, name: "version" }));
  out.push(text(VAULT.x + 24.2, VAULT_FRONT, 11, t("VERSION", "VERSIÓN"), LABEL));
  out.push(counter({ x: VAULT.x + 45, y: VAULT_FRONT, z: 9, count: 2, name: "over" }));
  out.push(text(VAULT.x + 58.6, VAULT_FRONT, 11, t("OVERWRITES", "SOBRESCRITURAS"), LABEL));
  // the lamp that flashes when a write overwrites
  out.push(`<g data-flash="off">${lamp(P, LAMP_AT, { r: 3.6 })}</g><g data-flash="on" style="display:none">${litFill(lamp(P, LAMP_AT, { r: 3.6, lit: true }))}</g>`);
  return out.join("");
}
// The fence panel on the vault's top: the highest token the vault has seen. Shown only while the vault checks tokens.
function fencePanel() {
  const out = [`<g data-fence style="display:none">`];
  out.push(S(k.slabOf(FENCE, VAULT_H, FENCE_H, P, 3, 0.4), { tone: "mid" }));
  out.push(counter({ x: FENCE.x + 3.4, y: FENCE_FRONT, z: VAULT_H + 1.4, count: 3, w: 4.6, h: 5.8, pad: 1, name: "seen" }));
  out.push(text(FENCE.x + 20.6, FENCE_FRONT, VAULT_H + 3, t("HIGHEST TOKEN", "TOKEN MÁXIMO"), LABEL));
  out.push(`</g>`);
  return out.join("");
}

function tray() {
  const out = [S(k.slabOf(TRAY, 0, TRAY_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(TRAY, 2), TRAY_H, P), { tone: "lo" }) })];
  const front = TRAY.y + TRAY.d;
  out.push(counter({ x: TRAY.x + 3.4, y: front, z: 1.4, count: 2, w: 4.8, h: 5.4, pad: 1, name: "rejected" }));
  out.push(text(TRAY.x + 17, front, 2.6, t("REJECTED", "RECHAZADAS"), LABEL));
  return out.join("");
}

// ---------- the desks ----------
function desk(i) {
  const cx = DX[i];
  const plan = { x: cx - DESK.w / 2, y: DESK.y, w: DESK.w, d: DESK.d, r: 1.5 };
  const out = [S(k.slabOf(plan, 0, DESK.h, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(plan, 2), DESK.h, P), { tone: "faint" }));
  out.push(faceText(P, [plan.x + 6.6, DESK_FRONT, 2.6], "ABC"[i], { size: 7.2, tone: "hi", anchor: "middle" }));
  // the status plate: what the worker is doing; lit while it's paused
  const sp = { x: cx - 10, y: DESK_FRONT, w: 34, d: 1, r: 0.3 };
  out.push(`<g class="wb-lit-group" data-status-plate="${i}">`
    + S(k.slabOf(sp, 2.2, 7.2, P, 2, 0.2), { tone: "hi", crease: "lo" })
    + faceText(P, [sp.x + sp.w / 2, sp.y + sp.d, 4], t("IDLE", "LIBRE"), { size: 3.6, tone: "hi", anchor: "middle", attr: `data-status="${i}"` })
    + `</g>`);
  return out.join("");
}
function worker(i) {
  const at = PERSON_AT[i];
  return variants("worker-" + i, {
    run: person(P, at, { scale: 1.25 }),
    paused: litFill(person(P, at, { scale: 1.25, lit: true })),
    // crashed: the worker is gone, only its spot is left
    down: S(k.cylinder(at[0], at[1], 5.6 * 1.25, 0, 1.4 * 1.25, P, 24, 0.3), { tone: "mid" }),
  }, "run");
}

// A key with its numbered tag, standing at the origin: on a desk while its worker believes it holds the lease, or in
// flight from the office. The tag lights when the lease it stands for has run out. Its one <text> is set live (#12).
export function keyTagSvg() {
  return keyPart(P, [-2.6, 0, 5.4], { scale: 1.5 })
    + `<g class="wb-lit-group" data-tag>${card(P, { x: 0.6, y: 1, z: 0, w: 9.4, h: 6.6, text: "#0", size: 3.3, attr: "data-tag-text" })}</g>`;
}
// A slip to the vault: a read or a write, with the key's number. Lit when its lease has run out.
export function slipSvg() {
  return `<g class="wb-lit-group" data-slip>${card(P, { x: -4.7, y: 0.3, z: 0, w: 9.4, h: 6.4, text: "#0", size: 3.3, attr: "data-slip-text" })}</g>`;
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A key office, a vault and three desks on a base plate. At the back left, the key office, the lock service, hands out one key at a time. A dial on its top shows how much of the current lease is left, a hook holds the key while nobody has it, and counters show the last token handed out and how many times the key went to a new holder while the old one, paused, still thought it had it. At the back right, the vault, the storage, keeps the record: counters show its version and the writes that overwrote an update they never saw, and a lamp flashes when that happens. When fencing is on, a panel on its top shows the highest token it has seen. In front of it, a tray collects the slips it refuses. At the front, workers A, B and C sit at their desks; a plate on each desk says what the worker is doing, and the worker and its plate light up while it's paused. A key with a numbered tag sits on the desk of each worker that believes it holds the lease, and on a crashed holder's desk until its lease runs out; the tag lights when that lease has run out. Slips with the key's number fly from the holder's desk to the vault's slot: a read, then a write.",
      "Una oficina de llaves, una bóveda y tres escritorios sobre una placa base. Al fondo a la izquierda, la oficina de llaves, el servicio de bloqueo, entrega una llave a la vez. Un dial arriba muestra cuánto le queda al arrendamiento actual, un gancho sostiene la llave mientras nadie la tiene, y unos contadores muestran el último token entregado y cuántas veces la llave pasó a un dueño nuevo mientras el anterior, en pausa, seguía creyendo que la tenía. Al fondo a la derecha, la bóveda, el almacenamiento, guarda el registro: unos contadores muestran su versión y las escrituras que sobrescribieron una actualización que nunca vieron, y una lámpara se enciende cuando eso pasa. Con el cerco activado, un panel arriba muestra el token más alto que vio. Delante, una bandeja recoge los papeles que rechaza. Adelante, los trabajadores A, B y C están en sus escritorios; una placa en cada escritorio dice qué hace el trabajador, y el trabajador y su placa se encienden mientras está en pausa. Una llave con una etiqueta numerada está sobre el escritorio de cada trabajador que cree tener el arrendamiento, y sobre el de un dueño caído hasta que vence su arrendamiento; la etiqueta se enciende cuando ese arrendamiento ya venció. Papeles con el número de la llave vuelan del escritorio del dueño a la ranura de la bóveda: una lectura y después una escritura.",
    ),
    body: [
      plate(),
      keyOffice(),
      tray(),
      `<g data-layer="tray"></g>`,
      vault(),
      fencePanel(),
      DX.map((_, i) => worker(i)).join(""),
      DX.map((_, i) => desk(i) + `<g data-desk-key="${i}" transform="${k.translateAlong(P, KEY_SPOT[i])}" style="display:none">${keyTagSvg()}</g>`).join(""),
      `<g data-layer="fly"></g>`,
    ],
  });
}

export const GEOMETRY = { DX, KEY_SPOT, SLIP_SPOT, KEY_OUT, SLOT_AT, TRAY_SPOT, HOOK_KEY, DESK_H };

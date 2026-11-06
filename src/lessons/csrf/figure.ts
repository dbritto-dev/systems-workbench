// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A bank street. At the back left stand three pages open in the customer's browser: the bank's own page, a forum on a
// sibling subdomain, and another site. The browser is the courier: for every errand a page asks for, it walks out of
// that page's door with an envelope (POST or GET) and goes down the road to the bank's window. On the way it passes
// the browser's cookie jar, where it picks up the customer's ID card for the bank (the session cookie) if the card's
// SameSite rule allows. Then the bank's three gates: CARD (a payment needs it), ORIGIN (Sec-Fetch-Site or Origin)
// and CSRF TOKEN; each arm is raised while the gate is open and lowered when it refuses, and the lamp on the gate's
// plaque lights while it refuses. At the window, the teller carries out what got through and holds up a slip for
// every payment. The pages that send forged errands fly a pennant, and so do their couriers. Each page's host and
// its relation to the bank are painted on its front; plaques along the front name every gate; the bank's ledger,
// front right, counts what it paid and refused.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, person, figurine, lamp, pennant, faceText, faceRect, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 440;

const PLATE = { x: -154, y: -82, w: 286, d: 82, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The road: couriers walk along its middle, from the pages' doors to the bank's window.
const ROAD = { x: -148, y: -45, w: 220, d: 16, r: 1 };
export const ROAD_Y = ROAD.y + ROAD.d / 2;          // -37
const ROAD_H = 0.8;

// The front band: the customer, the cookie jar, the gates' plaques and the ledger, in front of the road.
const FRONT = { y: -25, d: 18 };                       // y -25..-7
const FRONT_FACE = FRONT.y + FRONT.d;
const PLAQUE_H = 9;

// Pages (kiosks) at the back left, each with its name, host and relation to the bank on its front. The pages that
// send forged errands (hostile: another site, and a forum page someone controls) fly a pennant.
export const PAGES = [
  { key: "other", x: -148, w: 38, name: t("OTHER SITE", "OTRO SITIO"), host: "OTHER.EXAMPLE", rel: t("CROSS-SITE", "DE OTRO SITIO"), hostile: true },
  { key: "forum", x: -108, w: 38, name: t("FORUM", "FORO"), host: "FORUM.BANK.EXAMPLE", rel: t("SAME SITE", "MISMO SITIO"), hostile: true },
  { key: "bank", x: -68, w: 38, name: t("BANK PAGE", "PÁGINA DEL BANCO"), host: "WWW.BANK.EXAMPLE", rel: t("SAME ORIGIN", "MISMO ORIGEN") },
];
const KIOSK = { y: -76, d: 26, h: 29 };
const KIOSK_FACE = KIOSK.y + KIOSK.d;                 // -50
export const DOOR = Object.fromEntries(PAGES.map((p) => [p.key, [p.x + p.w / 2, KIOSK_FACE + 1]]));

// The browser's cookie jar, in front of the road.
const JAR_BOOTH = { x: -56, y: FRONT.y, w: 29.6, d: FRONT.d - 4, r: 1.2 };
const JAR_BOOTH_H = 9;
export const JAR = { x: -41.2, y: FRONT.y + 6.4, z: JAR_BOOTH_H, r: 5, h: 9 };
export const JAR_X = JAR.x;                            // where a courier passes the jar

// The bank's three gates, across the road, and their plaques.
export const GATES = [
  { key: "card", x: -15, name: t("CARD", "TARJETA") },
  { key: "origin", x: 8, name: t("ORIGIN", "ORIGEN") },
  { key: "token", x: 31, name: t("CSRF TOKEN", "TOKEN CSRF") },
];
const PLAQUE_W = 21;
const POST_H = 12;
const ARM_Z = 8.4;
const ARM_LEN = 17.2;

// The bank: a long facade along the back right, the teller at its window, the ledger in front.
const BANK = { x: -26, y: -82 + 4, w: 152, d: 28, r: 1.6 };
const BANK_H = 34;
const BANK_FACE = BANK.y + BANK.d;                     // -50
export const WINDOW_X = 64;
export const TELLER = [WINDOW_X, BANK_FACE + 4.4, 0];
// low, so it doesn't hide the window and the couriers standing at it
const LEDGER = { x: 44, y: FRONT.y, w: 82, d: FRONT.d, r: 1.4 };
const LEDGER_H = 10;
// the customer, front left, in front of the pages open in their browser, with a plaque
export const CUSTOMER = [-138, -16, 0];
const CUST_PLAQUE = { x: -128, y: FRONT.y + 1, w: 66, d: FRONT.d - 6, r: 1 };

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(BANK, 0, BANK_H + 2), [PAGES[0].x, KIOSK.y, KIOSK.h + 12.5]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);

const { S, L, D, at } = shorthand(P);
// Words on the machine: never below 2.6 units, the counter captions' size in the other lessons' figures.
const CAP = 2.7;
const word = (x, y, z, w, size = CAP, opts = {}) => faceText(P, [x, y, z], w, { size, tone: "hi", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H });
}

function road() {
  const out = [S(k.slabOf(ROAD, 0, ROAD_H, P, 3, 0.2), { tone: "lo", crease: "none" })];
  // the centre line, dashed, and chevrons pointing to the bank
  const dash = [];
  for (let x = ROAD.x + 6; x < ROAD.x + ROAD.w - 6; x += 10) dash.push(k.lineOnTop([x, ROAD.y + 2], [Math.min(x + 5, ROAD.x + ROAD.w - 6), ROAD.y + 2], ROAD_H, P), k.lineOnTop([x, ROAD.y + ROAD.d - 2], [Math.min(x + 5, ROAD.x + ROAD.w - 6), ROAD.y + ROAD.d - 2], ROAD_H, P));
  out.push(L(dash.join(""), { tone: "mid" }));
  return out.join("");
}

// A page: a small shop with a door; its name, host and relation to the bank painted on the front above the door.
function kiosk(p) {
  const plan = { x: p.x + 1, y: KIOSK.y, w: p.w - 2, d: KIOSK.d, r: 1.2 };
  const out = [`<g data-kiosk="${p.key}">`];
  out.push(S(k.slabOf(plan, 0, KIOSK.h, P, 3, 0.5), { tone: "mid" }));
  const roof = { x: plan.x - 1, y: plan.y - 1, w: plan.w + 2, d: plan.d + 2, r: 1.4 };
  out.push(S(k.slabOf(roof, KIOSK.h, 2.4, P, 3, 0.4), { tone: "hi", crease: "lo" }));
  const cx = p.x + p.w / 2;
  out.push(L(k.faceRectY(P, cx - 5, cx + 5, KIOSK_FACE, 0, 14.6), { tone: "lo" }));
  out.push(word(cx, KIOSK_FACE, 24.4, p.name, CAP, { anchor: "middle" }));
  out.push(word(cx, KIOSK_FACE, 20.4, p.host, CAP, { anchor: "middle" }));
  out.push(word(cx, KIOSK_FACE, 16.4, p.rel, CAP, { anchor: "middle" }));
  if (p.hostile) out.push(pennant(P, { x: plan.x + plan.w - 4, y: plan.y + 4, z: KIOSK.h + 2.4, height: 9, length: 7, drop: 4.5 }));
  out.push(`</g>`);
  return out.join("");
}

// The bank's facade: columns, a cornice, the window with the GET /PAY sign above it, and the bank's name.
function bank() {
  const out = [S(k.slabOf(BANK, 0, BANK_H, P, 3, 0.6), { tone: "mid" })];
  out.push(S(k.slabOf({ x: BANK.x - 1.2, y: BANK.y - 1.2, w: BANK.w + 2.4, d: BANK.d + 2.4, r: 2 }, BANK_H, 2.6, P, 3, 0.5), { tone: "hi", crease: "lo" }));
  const cols = [];
  for (let x = BANK.x + 6; x < WINDOW_X - 16; x += 9) cols.push(k.faceRectY(P, x, x + 3.4, BANK_FACE, 0, BANK_H - 4));
  out.push(L(cols.join(""), { tone: "lo" }));
  // the window and its sign
  out.push(L(k.faceRectY(P, WINDOW_X - 12, WINDOW_X + 12, BANK_FACE, 2, 23.4), { tone: "mid" }));
  out.push(L(k.faceRectY(P, WINDOW_X - 10.6, WINDOW_X + 10.6, BANK_FACE, 3.4, 22), { tone: "faint" }));
  out.push(word(WINDOW_X, BANK_FACE, 30.2, "GET /PAY", CAP, { anchor: "middle" }));
  out.push(`<g data-getpay="on">${faceText(P, [WINDOW_X, BANK_FACE, 26.4], t("OLD LINK WORKS", "ENLACE VIEJO ACTIVO"), { size: CAP, tone: "hi", anchor: "middle" })}</g>`);
  out.push(`<g data-getpay="off" style="display:none">${faceText(P, [WINDOW_X, BANK_FACE, 26.4], t("POST ONLY", "SOLO POST"), { size: CAP, tone: "hi", anchor: "middle" })}</g>`);
  // the name, on the right of the window
  const nx = (WINDOW_X + 14 + BANK.x + BANK.w) / 2;
  out.push(word(nx, BANK_FACE, 21, t("BANK", "BANCO"), 7.2, { anchor: "middle" }));
  out.push(word(nx, BANK_FACE, 15.6, "WWW.BANK.EXAMPLE", CAP, { anchor: "middle" }));
  return out.join("");
}

// The teller: idle, or holding up a payment slip while it pays (the customer's transfer or a forged errand alike).
function teller() {
  return `<g data-teller="idle">${person(P, TELLER, { scale: 0.72, hat: "cap" })}</g>`
    + `<g data-teller="paying" style="display:none">${person(P, TELLER, { scale: 0.72, hat: "cap", holding: "slip", slipText: "$" })}</g>`;
}
function customer() {
  const face = CUST_PLAQUE.y + CUST_PLAQUE.d, cx = CUST_PLAQUE.x + CUST_PLAQUE.w / 2;
  return person(P, CUSTOMER, { scale: 0.86 })
    + S(k.slabOf(CUST_PLAQUE, 0, PLAQUE_H, P, 3, 0.4), { tone: "mid", inner: L(k.planOutline(k.insetPlan(CUST_PLAQUE, 1.4), PLAQUE_H, P), { tone: "faint" }) })
    + word(cx, face, 5.3, t("THE CUSTOMER, SIGNED IN AT", "EL CLIENTE, CON SESIÓN EN"), CAP, { anchor: "middle" })
    + word(cx, face, 1.5, "WWW.BANK.EXAMPLE", CAP, { anchor: "middle" });
}

// A gate: a back post, a front housing with the arm's pivot, and the arm: raised beside the housing while the gate
// is open, lowered across the road onto the back post while it refuses. Its lamp sits on its plaque.
const armClosed = (x) => S(k.slabOf({ x: x - 0.8, y: ROAD.y - 0.6, w: 1.6, d: ARM_LEN, r: 0.4 }, ARM_Z, 1.6, P, 2), { tone: "hi", crease: "lo" });
const armOpen = (x) => S(k.slabOf({ x: x - 0.8, y: ROAD.y + ROAD.d - 1.6, w: 1.6, d: 1.6, r: 0.4 }, ARM_Z, ARM_LEN, P, 2), { tone: "hi", crease: "lo" });
function gateBack(g) {
  return `<g data-gate-back="${g.key}">${S(k.cylinder(g.x, ROAD.y - 1.4, 1, 0, POST_H - 3, P, 14), { tone: "mid", crease: "none" })}</g>`;
}
function gateFront(g) {
  const fy = ROAD.y + ROAD.d + 2;
  const out = [`<g data-gate="${g.key}">`];
  out.push(`<g data-arm="closed" style="display:none">${armClosed(g.x)}</g>`);
  out.push(S(k.slabOf({ x: g.x - 2.2, y: fy - 2, w: 4.4, d: 4, r: 0.5 }, 0, ARM_Z + 0.6, P, 2, 0.3), { tone: "mid", crease: "lo" }));
  out.push(`<g data-arm="open">${armOpen(g.x)}</g>`);
  out.push(`</g>`);
  return out.join("");
}

// The plaques in front of the road: a low slab each, with two lines on its front face.
function plaque(x0, w, line1, line2) {
  const plan = { x: x0, y: FRONT.y, w, d: FRONT.d - 4, r: 1 };
  const face = plan.y + plan.d;
  const cx = x0 + w / 2;
  // line2: words, or { attr, states: { value: words } } for a line the live code switches (one group per value)
  const second = line2 && line2.states
    ? Object.entries(line2.states).map(([v, words], i) => `<g ${line2.attr}="${v}"${i ? ' style="display:none"' : ""}>${word(cx, face, 1.5, words, CAP, { anchor: "middle" })}</g>`).join("")
    : word(cx, face, 1.5, line2, CAP, { anchor: "middle" });
  return S(k.slabOf(plan, 0, PLAQUE_H, P, 3, 0.4), { tone: "mid", inner: L(k.planOutline(k.insetPlan(plan, 1.4), PLAQUE_H, P), { tone: "faint" }) })
    + word(cx, face, 5.3, line1, CAP, { anchor: "middle" })
    + second;
}
export const GATE_STATES = {
  origin: { off: t("OFF", "APAGADO"), site: t("SAME SITE", "MISMO SITIO"), origin: t("SAME ORIGIN", "MISMO ORIGEN") },
  token: { off: t("OFF", "APAGADO"), copy: t("COOKIE COPY", "COPIA COOKIE"), session: t("SESSION", "DE SESIÓN") },
};
// Each gate's plaque, with the gate's lamp on its top: lit while the gate refuses.
function gatePlaques() {
  return GATES.map((g) => {
    const lp = [g.x - PLAQUE_W / 2 + 3, FRONT.y + 3, PLAQUE_H];
    return plaque(g.x - PLAQUE_W / 2, PLAQUE_W, g.name, g.key === "card" ? t("TO PAY", "PARA PAGAR") : { attr: `data-state-${g.key}`, states: GATE_STATES[g.key] })
      + `<g data-gate-lamp="${g.key}" data-lamp="off">${lamp(P, lp, { r: 1.6 })}</g><g data-gate-lamp="${g.key}" data-lamp="on" style="display:none">${litFill(lamp(P, lp, { r: 1.6, lit: true }))}</g>`;
  }).join("");
}

// The cookie jar: a booth with a glass jar on top holding the customer's card for the bank, and the card's SameSite
// setting on its front.
function jar() {
  const face = JAR_BOOTH.y + JAR_BOOTH.d;
  const cx = JAR_BOOTH.x + JAR_BOOTH.w / 2;
  const out = [S(k.slabOf(JAR_BOOTH, 0, JAR_BOOTH_H, P, 3, 0.4), { tone: "mid", inner: L(k.planOutline(k.insetPlan(JAR_BOOTH, 1.4), JAR_BOOTH_H, P), { tone: "faint" }) })];
  out.push(word(cx, face, 5.3, t("COOKIE JAR", "COOKIES"), CAP, { anchor: "middle" }));
  out.push(faceText(P, [cx, face, 1.5], "SAMESITE=LAX", { size: CAP, tone: "hi", anchor: "middle", attr: "data-mode" }));
  // the jar: a base, a glass body (outline only, so the card shows), and a lid
  out.push(S(k.cylinder(JAR.x, JAR.y, JAR.r + 0.8, JAR.z, 1, P, 32), { tone: "mid" }));
  out.push(`<g class="wb-lit-group" data-jar-card>${S(k.slabOf({ x: JAR.x - 3, y: JAR.y - 0.3, w: 6, d: 0.6, r: 0.2 }, JAR.z + 1.4, 4.4, P, 2, 0.15), { tone: "hi", crease: "none", lit: true })}</g>`);
  out.push(L(k.ring(JAR.x, JAR.y, JAR.r, JAR.z + 1, P, 40) + k.ring(JAR.x, JAR.y, JAR.r, JAR.z + JAR.h, P, 40)
    + k.segment([JAR.x + JAR.r * Math.cos(-0.7), JAR.y + JAR.r * Math.sin(-0.7), JAR.z + 1], [JAR.x + JAR.r * Math.cos(-0.7), JAR.y + JAR.r * Math.sin(-0.7), JAR.z + JAR.h], P)
    + k.segment([JAR.x + JAR.r * Math.cos(2.45), JAR.y + JAR.r * Math.sin(2.45), JAR.z + 1], [JAR.x + JAR.r * Math.cos(2.45), JAR.y + JAR.r * Math.sin(2.45), JAR.z + JAR.h], P), { tone: "mid" }));
  out.push(S(k.cylinder(JAR.x, JAR.y, JAR.r + 0.4, JAR.z + JAR.h, 1.4, P, 32, 0.3), { tone: "hi", crease: "lo" }));
  return out.join("");
}

// The ledger: what the bank paid and refused, each counter on the front with its caption on the top, just behind it.
export const LEDGER_COUNTERS = [
  { name: "paid", label: t("FORGED PAID", "FALSAS PAGADAS") },
  { name: "blocked", label: t("BLOCKED", "BLOQUEADAS") },
  { name: "signedout", label: t("SIGNED OUT", "SIN SESIÓN") },
];
function ledger() {
  const face = LEDGER.y + LEDGER.d;
  const out = [S(k.slabOf(LEDGER, 0, LEDGER_H, P, 3, 0.5), { tone: "mid", inner: L(k.planOutline(k.insetPlan(LEDGER, 1.8), LEDGER_H, P), { tone: "faint" }) })];
  const colW = LEDGER.w / LEDGER_COUNTERS.length;
  LEDGER_COUNTERS.forEach((c, i) => {
    const cx = LEDGER.x + colW * (i + 0.5);
    const w = 4.6, gap = 0.6, count = 3, span = count * w + (count - 1) * gap;
    out.push(digitCounter(P, { x: cx - span / 2, y: face, z: 1.6, count, w, h: 6.2, gap, pad: 1, name: c.name }));
    out.push(faceText(P, [cx, face - 1.6, LEDGER_H], c.label, { face: "top", size: CAP, tone: "hi", anchor: "middle" }));
  });
  return out.join("");
}

// A courier, drawn at the origin and moved with translateAlong: a figure with an envelope in front (its one <text> is
// the method, set by the live code), on its right side the ID card when the browser sent the cookie (lit), and on its
// back a pennant when a hostile page sent it (a forged errand).
export const COURIER = { scale: 1.25, env: { w: 10, h: 6.4, z: 5 } };
export function courierSvg() {
  const s = COURIER.scale, e = COURIER.env;
  const out = [figurine(P, [0, 0, 0], { scale: s })];
  const env = { x: -e.w / 2, y: 2.4 * s + 0.4, w: e.w, d: 0.6, r: 0.15 };
  out.push(`<g data-env>${S(k.slabOf(env, e.z, e.h, P, 2, 0.15), { tone: "hi", crease: "none" })}`
    + faceText(P, [0, env.y + env.d, e.z + 1.8], "POST", { size: 3, tone: "hi", anchor: "middle", attr: "data-method" }) + `</g>`);
  out.push(`<g class="wb-lit-group" data-card style="display:none">${S(k.slabOf({ x: 2.6 * s, y: -3.2, w: 0.7, d: 6.4, r: 0.15 }, 6, 6.2, P, 2, 0.15), { tone: "hi", crease: "none", lit: true })}</g>`);
  return `<g data-flag style="display:none">${pennant(P, { x: -1.6 * s, y: -2.6 * s, z: 4, height: 19, length: 8, drop: 5 })}</g>` + litFill(out.join(""));
}
// The card alone, flying from the jar to a courier.
export function cardSvg() {
  return litFill(`<g class="wb-lit-group">${S(k.slabOf({ x: -0.3, y: -2.6, w: 0.6, d: 5.2, r: 0.15 }, 0, 5, P, 2, 0.15), { tone: "hi", crease: "none", lit: true })}</g>`);
}

const LABEL = t(
  "A bank street on a base plate. At the back left stand three pages open in the customer's browser, as small shops, each with its name, host and relation to the bank on its front: OTHER SITE (other.example, cross-site), FORUM (forum.bank.example, same site as the bank) and BANK PAGE (www.bank.example, same origin). The first two send forged errands and fly a pennant. The browser is the courier: for each errand a page asks for, a small figure walks out of that page's door with an envelope marked POST or GET and goes down the road to the bank's window at the back right; a courier from a hostile page carries a pennant too. In front of the road, from the left: the customer beside a plaque saying they are signed in at www.bank.example; the browser's cookie jar, which shows the cookie's SameSite setting, where a courier picks up the customer's ID card for the bank, lit, when the rule allows; and the plaques of three gates that cross the road, CARD, ORIGIN and CSRF TOKEN, each with a lamp that lights while its gate refuses. A gate's arm stands raised while it is open and comes down across the road when it refuses. At the window a teller holds up a payment slip for every payment; a sign above the window says whether the old GET /pay link still works. A low ledger at the front right counts forged payments, blocked requests and the customer's visits that arrived signed out.",
  "Una calle con un banco sobre una placa base. Atrás a la izquierda hay tres páginas abiertas en el navegador del cliente, como tiendas pequeñas, cada una con su nombre, su host y su relación con el banco en el frente: OTRO SITIO (other.example, de otro sitio), FORO (forum.bank.example, del mismo sitio que el banco) y PÁGINA DEL BANCO (www.bank.example, del mismo origen). Las dos primeras envían encargos falsos y tienen un banderín. El navegador es el mensajero: por cada encargo que pide una página, una figura pequeña sale por la puerta de esa página con un sobre marcado POST o GET y va por la calle hasta la ventanilla del banco, atrás a la derecha; un mensajero de una página hostil también lleva un banderín. Delante de la calle, desde la izquierda: el cliente junto a una placa que dice que tiene sesión en www.bank.example; el frasco de cookies del navegador, que muestra el ajuste SameSite de la cookie, donde el mensajero toma la tarjeta de identidad del cliente para el banco, encendida, cuando la regla lo permite; y las placas de tres barreras que cruzan la calle, TARJETA, ORIGEN y TOKEN CSRF, cada una con una lámpara que se enciende mientras su barrera rechaza. El brazo de una barrera queda levantado mientras está abierta y baja a través de la calle cuando rechaza. En la ventanilla, un cajero levanta un comprobante en cada pago; un letrero sobre la ventanilla dice si el viejo enlace GET /pay sigue funcionando. Un libro de cuentas bajo, adelante a la derecha, cuenta los pagos falsos, las solicitudes bloqueadas y las visitas del cliente que llegaron sin sesión.",
);

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: LABEL,
    body: [
      plate(),
      bank(),
      PAGES.map(kiosk).join(""),
      teller(),
      road(),
      GATES.map(gateBack).join(""),
      `<g data-layer="road"></g>`,
      GATES.map(gateFront).join(""),
      customer(),
      jar(),
      gatePlaques(),
      ledger(),
      `<g data-layer="fly"></g>`,
    ],
  });
}

export const GEOMETRY = { ROAD_Y, DOOR, JAR, JAR_X, GATES: GATES.map((g) => ({ key: g.key, x: g.x })), WINDOW_X, ROAD_H };

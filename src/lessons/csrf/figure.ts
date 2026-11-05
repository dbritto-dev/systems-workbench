// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A bank street. At the back left stand three pages open in the customer's browser: the bank's own page, a forum on a
// sibling subdomain, and another site. The browser is the courier: for every errand a page asks for, it walks out of
// that page's door with an envelope (POST or GET) and goes down the road to the bank's window. On the way it passes
// the browser's cookie jar, where it picks up the customer's ID card for the bank (the session cookie) if the card's
// SameSite rule allows. Then the bank's three gates: CARD (is anyone signed in?), ORIGIN (Sec-Fetch-Site or Origin)
// and CSRF TOKEN; each closes its arm and lights its lamp when it refuses. At the window, the teller carries out
// what got through, and lights up when it's a forged payment. Plaques along the front name every page and every gate;
// the bank's ledger counts what it paid and refused.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, digitCounter, person, figurine, lamp, pennant, faceText, faceRect, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";

export const WIDTH = 700;
export const HEIGHT = 440;

const PLATE = { x: -148, y: -82, w: 296, d: 82, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// The road: couriers walk along its middle, from the pages' doors to the bank's window.
const ROAD = { x: -142, y: -45, w: 230, d: 16, r: 1 };
export const ROAD_Y = ROAD.y + ROAD.d / 2;          // -37
const ROAD_H = 0.8;

// The front band: plaques and the ledger, every word the machine shows, in front of the road.
const FRONT = { y: -25, d: 18 };                       // y -25..-7
const FRONT_FACE = FRONT.y + FRONT.d;
const PLAQUE_H = 9;

// Pages (kiosks) at the back left, and the plaques that name them.
export const PAGES = [
  { key: "other", x: -142, w: 32, name: t("OTHER SITE", "OTRO SITIO"), host: "OTHER.EXAMPLE", rel: t("CROSS-SITE", "DE OTRO SITIO") },
  { key: "forum", x: -108, w: 32, name: t("FORUM", "FORO"), host: "FORUM.BANK.EXAMPLE", rel: t("SAME SITE", "MISMO SITIO") },
  { key: "bank", x: -74, w: 32, name: t("BANK PAGE", "PÁGINA BANCO"), host: "WWW.BANK.EXAMPLE", rel: t("SAME ORIGIN", "MISMO ORIGEN") },
];
const KIOSK = { y: -76, d: 26, h: 29 };
const KIOSK_FACE = KIOSK.y + KIOSK.d;                 // -50
export const DOOR = Object.fromEntries(PAGES.map((p) => [p.key, [p.x + p.w / 2, KIOSK_FACE + 1]]));

// The browser's cookie jar, in front of the road.
const JAR_BOOTH = { x: -40, y: FRONT.y, w: 29.6, d: FRONT.d - 4, r: 1.2 };
const JAR_BOOTH_H = 9;
export const JAR = { x: -25.2, y: FRONT.y + 6.4, z: JAR_BOOTH_H, r: 5, h: 9 };
export const JAR_X = JAR.x;                            // where a courier passes the jar

// The bank's three gates, across the road, and their plaques.
export const GATES = [
  { key: "card", x: 1, name: t("CARD", "TARJETA") },
  { key: "origin", x: 24, name: t("ORIGIN", "ORIGEN") },
  { key: "token", x: 47, name: t("CSRF TOKEN", "TOKEN CSRF") },
];
const PLAQUE_W = 21;
const POST_H = 12;
const ARM_Z = 8.4;

// The bank: a long facade along the back right, the teller at its window, the ledger in front.
const BANK = { x: -10, y: -82 + 4, w: 152, d: 28, r: 1.6 };
const BANK_H = 34;
const BANK_FACE = BANK.y + BANK.d;                     // -50
export const WINDOW_X = 80;
export const TELLER = [WINDOW_X, BANK_FACE + 4.4, 0];
const LEDGER = { x: 60, y: FRONT.y, w: 82, d: FRONT.d, r: 1.4 };
const LEDGER_H = 15;
export const CUSTOMER = [-27, -62, 0];

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

// A page: a small shop with a door, its name painted high on the front, out of reach of the couriers below it.
function kiosk(p) {
  const plan = { x: p.x + 1, y: KIOSK.y, w: p.w - 2, d: KIOSK.d, r: 1.2 };
  const out = [`<g data-kiosk="${p.key}">`];
  out.push(S(k.slabOf(plan, 0, KIOSK.h, P, 3, 0.5), { tone: "mid" }));
  const roof = { x: plan.x - 1, y: plan.y - 1, w: plan.w + 2, d: plan.d + 2, r: 1.4 };
  out.push(S(k.slabOf(roof, KIOSK.h, 2.4, P, 3, 0.4), { tone: "hi", crease: "lo" }));
  const cx = p.x + p.w / 2;
  out.push(L(k.faceRectY(P, cx - 5, cx + 5, KIOSK_FACE, 0, 15), { tone: "lo" }));
  out.push(word(cx, KIOSK_FACE, 22, p.name, CAP, { anchor: "middle" }));
  if (p.key === "other") out.push(pennant(P, { x: plan.x + plan.w - 4, y: plan.y + 4, z: KIOSK.h + 2.4, height: 9, length: 7, drop: 4.5 }));
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

function teller() {
  return `<g class="wb-teller">${person(P, TELLER, { scale: 0.72, hat: "cap" })}</g>`
    + `<g data-teller-lit style="display:none">${litFill(person(P, TELLER, { scale: 0.72, hat: "cap", lit: true }))}</g>`;
}
function customer() {
  return person(P, CUSTOMER, { scale: 0.86 });
}

// A gate: a back post, a front post with a lamp, and an arm that comes down across the road when the gate refuses.
const armClosed = (x) => S(k.slabOf({ x: x - 0.8, y: ROAD.y - 0.6, w: 1.6, d: ROAD.d + 1.2, r: 0.4 }, ARM_Z, 1.6, P, 2), { tone: "hi", crease: "lo" });
function gateBack(g) {
  return `<g data-gate-back="${g.key}">${S(k.cylinder(g.x, ROAD.y - 1.4, 1, 0, POST_H, P, 14), { tone: "mid", crease: "none" })}</g>`;
}
function gateFront(g) {
  const fy = ROAD.y + ROAD.d + 1.4;
  const out = [`<g data-gate="${g.key}">`];
  out.push(`<g data-arm="closed" style="display:none">${armClosed(g.x)}</g>`);
  out.push(S(k.cylinder(g.x, fy, 1.2, 0, POST_H, P, 16), { tone: "mid", crease: "none" }));
  out.push(`<g data-lamp="off">${lamp(P, [g.x, fy, POST_H], { r: 2 })}</g><g data-lamp="on" style="display:none">${litFill(lamp(P, [g.x, fy, POST_H], { r: 2, lit: true }))}</g>`);
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
function pagePlaques() {
  return PAGES.map((p) => plaque(p.x, p.w, p.host, p.rel)).join("");
}
export const GATE_STATES = {
  origin: { off: t("OFF", "APAGADA"), site: t("SAME SITE", "MISMO SITIO"), origin: t("SAME ORIGIN", "MISMO ORIGEN") },
  token: { off: t("OFF", "APAGADO"), copy: t("COOKIE COPY", "COPIA COOKIE"), session: t("SESSION", "DE SESIÓN") },
};
function gatePlaques() {
  return GATES.map((g) => plaque(g.x - PLAQUE_W / 2, PLAQUE_W, g.name, g.key === "card" ? t("REQUIRED", "OBLIGATORIA") : { attr: `data-state-${g.key}`, states: GATE_STATES[g.key] })).join("");
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

// The ledger: what the bank paid and refused, each counter with its caption above its housing.
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
    out.push(digitCounter(P, { x: cx - span / 2, y: face, z: 2, count, w, h: 6.2, gap, pad: 1, name: c.name }));
    out.push(word(cx, face, 10.8, c.label, CAP, { anchor: "middle" }));
  });
  return out.join("");
}

// A courier, drawn at the origin and moved with translateAlong: a figure with an envelope in front (its one <text> is
// the method, set by the live code) and, on its right side, the ID card when the browser sent the cookie (lit).
export const COURIER = { scale: 1.25, env: { w: 10, h: 6.4, z: 5 } };
export function courierSvg() {
  const s = COURIER.scale, e = COURIER.env;
  const out = [figurine(P, [0, 0, 0], { scale: s })];
  const env = { x: -e.w / 2, y: 2.4 * s + 0.4, w: e.w, d: 0.6, r: 0.15 };
  out.push(`<g data-env>${S(k.slabOf(env, e.z, e.h, P, 2, 0.15), { tone: "hi", crease: "none" })}`
    + faceText(P, [0, env.y + env.d, e.z + 1.8], "POST", { size: 3, tone: "hi", anchor: "middle", attr: "data-method" }) + `</g>`);
  out.push(`<g class="wb-lit-group" data-card style="display:none">${S(k.slabOf({ x: 2.6 * s, y: -3.2, w: 0.7, d: 6.4, r: 0.15 }, 6, 6.2, P, 2, 0.15), { tone: "hi", crease: "none", lit: true })}</g>`);
  return litFill(out.join(""));
}
// The card alone, flying from the jar to a courier.
export function cardSvg() {
  return litFill(`<g class="wb-lit-group">${S(k.slabOf({ x: -0.3, y: -2.6, w: 0.6, d: 5.2, r: 0.15 }, 0, 5, P, 2, 0.15), { tone: "hi", crease: "none", lit: true })}</g>`);
}

const LABEL = t(
  "A bank street on a base plate. At the back left stand three pages open in the customer's browser, as small shops: OTHER SITE (other.example, cross-site), FORUM (forum.bank.example, same site as the bank) and BANK PAGE (www.bank.example, same origin); the customer stands beside the bank's page. The browser is the courier: for each errand a page asks for, a small figure walks out of that page's door with an envelope marked POST or GET and goes down the road to the bank's window at the right. On the way it passes the browser's cookie jar, which shows the cookie's SameSite setting; when the rule allows, the courier picks up the customer's ID card for the bank, lit. Then three gates cross the road: CARD, ORIGIN and CSRF TOKEN; a gate that refuses drops its arm and lights its lamp. At the window a teller carries out what got through and lights up for a forged payment; a sign above the window says whether the old GET /pay link still works. A ledger in front counts forged payments, blocked requests and the customer's visits that arrived signed out.",
  "Una calle con un banco sobre una placa base. Atrás a la izquierda hay tres páginas abiertas en el navegador del cliente, como tiendas pequeñas: OTRO SITIO (other.example, de otro sitio), FORO (forum.bank.example, del mismo sitio que el banco) y PÁGINA BANCO (www.bank.example, del mismo origen); el cliente está junto a la página del banco. El navegador es el mensajero: por cada encargo que pide una página, una figura pequeña sale por la puerta de esa página con un sobre marcado POST o GET y va por la calle hasta la ventanilla del banco, a la derecha. En el camino pasa por el frasco de cookies del navegador, que muestra el ajuste SameSite de la cookie; cuando la regla lo permite, el mensajero toma la tarjeta de identidad del cliente para el banco, encendida. Después, tres barreras cruzan la calle: TARJETA, ORIGEN y TOKEN CSRF; la que rechaza baja su brazo y enciende su lámpara. En la ventanilla, un cajero hace lo que pasó y se enciende con un pago falso; un letrero sobre la ventanilla dice si el viejo enlace GET /pay sigue funcionando. Un libro de cuentas al frente cuenta los pagos falsos, las solicitudes bloqueadas y las visitas del cliente que llegaron sin sesión.",
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
      customer(),
      teller(),
      road(),
      GATES.map(gateBack).join(""),
      `<g data-layer="road"></g>`,
      GATES.map(gateFront).join(""),
      pagePlaques(),
      jar(),
      gatePlaques(),
      ledger(),
      `<g data-layer="fly"></g>`,
    ],
  });
}

export const GEOMETRY = { ROAD_Y, DOOR, JAR, JAR_X, GATES: GATES.map((g) => ({ key: g.key, x: g.x })), WINDOW_X, ROAD_H };

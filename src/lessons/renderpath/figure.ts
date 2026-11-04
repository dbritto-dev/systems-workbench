// @ts-nocheck: figure code in the style of the other lessons; drawing shorthands come from src/lib/draw.
// A page-load bench. At the back, the download rack: one glass tube per resource, filling as its bytes arrive. In the
// middle, the HTML laid out as a strip of tags in document order, and the parser walking along it, stopping where a
// classic script holds it. At the right, the screen: a phone whose roller shutter stays down until the first paint,
// then shows the page as it is laid out frame by frame, with an LCP tag on the largest element so far and a lamp that
// flashes on a layout shift. In front, the gauges: a stopwatch, first paint, text visible, LCP and CLS.
// Built with the Anatomy kit (MIT, github.com/wheresryan22/anatomy) and the shared workbench parts.
import * as k from "../../../workbench/kit.mjs";
import { basePlate, labelPlate, digitCounter, dial, meter, lamp, person, plaque, faceText, litFill } from "../../../workbench/parts.mjs";
import { t } from "../../../workbench/i18n.mjs";
import { shorthand } from "../../lib/draw";
import { TUBES, RACK, GLASS, tubeAt, tubeFill, SCREEN, BOTTOM, FACE_Y, shutterSvg, screenClip } from "./shapes";
import { FIRST_SCREEN, VIEW } from "./sim";

export const WIDTH = 700;
export const HEIGHT = 400;

const PLATE = { x: -184, y: -116, w: 296, d: 98, r: 8 };
const PLATE_H = 12, FOOT_H = 5;

// ---------- the HTML strip ----------
export const TAPE = { x: -172, y: -84, w: 196, d: 17, h: 6 };
// Where each tag lies on the strip: four in the head, a divider, then the body (the long article folded into "…").
export const SLOTS = { css: 0, pre: 1, app: 2, adjs: 3, h1: 4, hero: 5, p1: 6, ad: 7, p2: 8, p3: 9, more: 10, img2: 11, img3: 12, img4: 13 };
export const slotX = (s) => TAPE.x + 8 + s * 13.2 + (s >= 4 ? 6 : 0);
const PLAQUE = { w: 11, d: 8 };
export const TAG_Y = TAPE.y + 8;
export const WALKER = { y: TAPE.y + 3, z: TAPE.h };

// ---------- the console ----------
const CONSOLE = { x: -172, y: -45, w: 214, d: 15, r: 1.4 };
const CONSOLE_H = 12.5;
const FRONT = CONSOLE.y + CONSOLE.d;
export const STOPWATCH = { x: -158, y: CONSOLE.y + 7.5, z: CONSOLE_H, r: 7.5 };

// ---------- the phone ----------
const PHONE = { x: SCREEN.x0 - 3, y: SCREEN.y - 6, w: SCREEN.x1 - SCREEN.x0 + 6, d: 6, r: 1.6 };
const PHONE_Z = [BOTTOM - 4, SCREEN.top + 3];
const STAND = { x: PHONE.x - 6, y: PHONE.y - 10, w: PHONE.w + 12, d: 26, r: 2 };
const STAND_H = 5;
const BOX = { x: SCREEN.x0 - 1.4, y: SCREEN.y - 0.4, w: SCREEN.x1 - SCREEN.x0 + 2.8, d: 3.4, r: 0.6 };
export const LCP_TAG = { x: SCREEN.x1 + 3.4, y: SCREEN.y, w: 10, h: 4.4 };
export const SHIFT_LAMP = [PHONE.x + PHONE.w + 2.2, STAND.y + STAND.d - 6, STAND_H];

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [PHONE.x, PHONE.y, PHONE_Z[1] + 6], [PHONE.x + PHONE.w, PHONE.y, PHONE_Z[1] + 6], [RACK.x0, RACK.y, RACK.h + GLASS.h + 3]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 50 },
);

const { S, L, D, at } = shorthand(P);
const slab = (plan, z, h, steps = 3, bevel = 0) => k.slabOf({ r: 0.4, ...plan }, z, h, P, steps, bevel);
const text = (x, y, z, words, size = 2.4, opts = {}) => faceText(P, [x, y, z], words, { size, tone: "mid", ...opts });

function plate() {
  return basePlate(P, PLATE, { height: PLATE_H, foot: FOOT_H })
    + labelPlate(P, { x: 76, y: -40, w: 26, d: 12, r: 1.5 }, [[80.5, -35, 16], [80.5, -31.4, 10]]);
}

// ---------- the rack ----------
const TUBE_WORDS = {
  html: "HTML", css: "CSS", app: "JS", font: t("FONT", "FUENTE"), hero: "HERO", imgs: t("IMAGES", "IMÁGENES"), ad: t("AD", "ANUNCIO"),
};
function rackBack() {
  const out = [S(k.slabOf({ x: RACK.x0 - 4, y: RACK.y - 4, w: TUBES.length * RACK.dx + 4, d: RACK.d + 6, r: 1.6 }, 0, 1.2, P, 3), { tone: "lo", crease: "none" })];
  TUBES.forEach((name, i) => {
    const x = RACK.x0 + i * RACK.dx, front = RACK.y + RACK.d;
    out.push(S(k.slabOf({ x, y: RACK.y, w: RACK.w, d: RACK.d, r: 1 }, 1.2, RACK.h - 1.2, P, 3, 0.3), { tone: "mid" }));
    out.push(text(x + RACK.w / 2, front, 2.6, TUBE_WORDS[name], 2.4, { anchor: "middle" }));
    // the back half of the glass, behind the fill
    const [cx, cy] = tubeAt(i), g = { x: cx - GLASS.w / 2, y: cy - GLASS.d / 2, w: GLASS.w, d: GLASS.d, r: 0.8 };
    out.push(L(k.planOutline(g, RACK.h, P), { tone: "lo" }));
    // three priority pips on the plinth top, in front of the glass: while the download is in flight, as many show as
    // it is urgent (the live code shows them)
    for (let p = 0; p < 3; p++) {
      const px = x + 3.2 + p * 3.1, py = front - 2.2;
      out.push(`<g data-pip="${name}-${p}" style="display:none">${S(k.cylinder(px, py, 1.2, RACK.h, 1, P, 14), { tone: "hi", crease: "lo" })}</g>`);
    }
  });
  return out.join("");
}
function tubeGlass(i) {
  // the glass's outline, drawn over the fill: a box of thin lines
  const [cx, cy] = tubeAt(i), g = { x: cx - GLASS.w / 2, y: cy - GLASS.d / 2, w: GLASS.w, d: GLASS.d, r: 0.8 };
  const top = RACK.h + GLASS.h;
  const edges = [[g.x, g.y + g.d], [g.x + g.w, g.y + g.d], [g.x + g.w, g.y]].map(([x, y]) => k.segment([x, y, RACK.h], [x, y, top], P)).join("");
  return L(k.planOutline(g, top, P) + edges, { tone: "mid" }) + L(k.lineOnTop([g.x + 1.2, g.y + g.d], [g.x + 1.2, g.y + g.d], top, P), { tone: "faint" });
}
function rack() {
  return TUBES.map((name, i) => `<g data-fill="${name}">${tubeFill(P, i, 0, false)}</g>${tubeGlass(i)}`).join("");
}

// ---------- the HTML strip ----------
function tape() {
  const out = [S(k.slabOf({ ...TAPE, r: 1.2 }, 0, TAPE.h, P, 3, 0.4), { tone: "mid" })];
  // the paper: the document itself, lying along the bench
  out.push(S(slab({ x: TAPE.x + 3, y: TAG_Y - 1, w: TAPE.w - 6, d: PLAQUE.d + 2, r: 0.4 }, TAPE.h, 0.4, 2), { tone: "hi", crease: "none" }));
  // the head/body divider
  const dx = slotX(4) - 9.6;
  out.push(L(k.lineOnTop([dx, TAG_Y - 0.6], [dx, TAG_Y + PLAQUE.d + 0.6], TAPE.h + 0.4, P), { tone: "lo" }));
  const front = TAPE.y + TAPE.d;
  out.push(text(slotX(0) - 2, front, 2.4, "<HEAD>", 2.4));
  out.push(text(slotX(4) - 2, front, 2.4, "<BODY>", 2.4));
  return out.join("");
}
// A tag on the strip: a plaque with one <text> the live code fills in (its words depend on the settings).
function tag(name, s) {
  const x = slotX(s) - PLAQUE.w / 2;
  return `<g data-tag="${name}" style="display:none">${plaque(P, { x, y: TAG_Y, z: TAPE.h + 0.4, w: PLAQUE.w, d: PLAQUE.d })}`
    + faceText(P, [slotX(s), TAG_Y + PLAQUE.d / 2 + 1.1, TAPE.h + 1.2], "", { face: "top", size: 2.8, tone: "hi", anchor: "middle", attr: `data-tag-text="${name}"` })
    + `<g data-tag-lit="${name}" style="display:none">${litFill(S(k.slabOf({ x, y: TAG_Y, w: PLAQUE.w, d: PLAQUE.d, r: 0.8 }, TAPE.h + 0.4, 0.8, P, 3, 0.3), { tone: "hi", crease: "lo", lit: true }))}`
    + faceText(P, [slotX(s), TAG_Y + PLAQUE.d / 2 + 1.1, TAPE.h + 1.2], "", { face: "top", size: 2.8, tone: "on-lit", anchor: "middle", attr: `data-tag-lit-text="${name}"` })
    + `</g></g>`;
}
function tags() {
  return Object.entries(SLOTS).map(([name, s]) => tag(name, s)).join("");
}
// The parser: a clerk walking along the strip, lit while a classic script holds it.
function walker() {
  const at0 = [slotX(0), WALKER.y, WALKER.z];
  return `<g data-walker><g data-walker-off>${person(P, at0, { scale: 0.78, hat: "cap" })}</g><g data-walker-on style="display:none">${litFill(person(P, at0, { scale: 0.78, hat: "cap", lit: true }))}</g></g>`;
}

// ---------- the phone ----------
function phoneBack() {
  const out = [S(k.slabOf(STAND, 0, STAND_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(STAND, 2), STAND_H, P), { tone: "faint" }));
  out.push(S(k.slabOf({ x: PHONE.x + 6, y: PHONE.y - 6, w: PHONE.w - 12, d: 6, r: 1 }, STAND_H, 16, P, 2, 0.3), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf(PHONE, PHONE_Z[0], PHONE_Z[1] - PHONE_Z[0], P, 4, 0.6), { tone: "hi", crease: "lo" }));
  // the screen: a page-coloured face
  out.push(`<path class="rp-screen" d="${screenClip(P)}"/>`);
  return out.join("");
}
// One element of the page, drawn with its top at the top of the viewport; the live code moves it down to its place.
const zOf = (px) => SCREEN.top - px * SCREEN.scale;
const X0 = SCREEN.x0 + 1.6, X1 = SCREEN.x1 - 1.6;
function lines(n, h, gapPx, cls, tone, widths) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const z = zOf(gapPx * (i + 0.62));
    const w = widths[i % widths.length];
    out.push(k.segment([X0, FACE_Y, z], [X0 + (X1 - X0) * w, FACE_Y, z], P));
  }
  return k.lineSvg(out.join(""), { tone, className: cls });
}
const WIDE = [0.96, 0.9, 0.98, 0.86, 0.93, 0.6], NARROW = [0.92, 0.97, 0.88, 0.95, 0.55];
function textEl(e) {
  const h1 = e.id === "h1";
  const fbLines = h1 ? 2 : 5, webLines = h1 ? 3 : 6;
  const gapFb = e.fb / fbLines, gapWeb = e.web / webLines;
  const cls = h1 ? "rp-h1" : "rp-p";
  return `<g data-el="${e.id}">`
    + `<g data-v="invisible">${lines(fbLines, e.fb, gapFb, cls + " rp-ghost", "faint", NARROW)}</g>`
    + `<g data-v="fallback" style="display:none">${lines(fbLines, e.fb, gapFb, cls + " rp-fb", "mid", NARROW)}</g>`
    + `<g data-v="web" style="display:none">${lines(webLines, e.web, gapWeb, cls + " rp-web", "hi", WIDE)}</g>`
    + `<g data-v="matched" style="display:none">${lines(webLines, e.web, gapWeb, cls + " rp-fb", "mid", WIDE)}</g>`
    + `</g>`;
}
function rect(hPx, cls) { return `<path class="${cls}" d="${k.faceRectY(P, SCREEN.x0 + 0.8, SCREEN.x1 - 0.8, FACE_Y, zOf(hPx - 4), zOf(4))}"/>`; }
function heroEl(e) {
  const zt = zOf(4), zb = zOf(e.h - 4), x0 = SCREEN.x0 + 0.8, x1 = SCREEN.x1 - 0.8;
  const pt = (u, v) => at([x0 + (x1 - x0) * u, FACE_Y, zb + (zt - zb) * v]);
  const hills = k.pathOf([pt(0, 0.12), pt(0.28, 0.62), pt(0.46, 0.34), pt(0.66, 0.8), pt(1, 0.2)]);
  const sun = k.pathOf(Array.from({ length: 17 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return pt(0.2 + 0.06 * Math.cos(a), 0.78 + 0.1 * Math.sin(a)); }), true);
  return `<g data-el="hero">`
    + `<g data-v="placeholder" style="display:none">${rect(e.h, "rp-slot")}</g>`
    + `<g data-v="loaded" style="display:none">${rect(e.h, "rp-img")}<path class="rp-img-line" d="${hills}"/><path class="rp-img-line" d="${sun}"/></g>`
    + `</g>`;
}
function adEl(e) {
  const mid = zOf(e.h / 2) - 1;
  return `<g data-el="ad">`
    + `<g data-v="placeholder" style="display:none">${rect(e.h, "rp-slot")}${faceText(P, [(SCREEN.x0 + SCREEN.x1) / 2, FACE_Y, mid], t("AD", "ANUNCIO"), { size: 2.6, tone: "lo", anchor: "middle" })}</g>`
    + `<g data-v="loaded" style="display:none">${rect(e.h, "rp-ad")}${faceText(P, [(SCREEN.x0 + SCREEN.x1) / 2, FACE_Y, mid], t("AD", "ANUNCIO"), { size: 3.4, tone: "hi", anchor: "middle" })}</g>`
    + `</g>`;
}
function headerEl(e) {
  const zt = zOf(0), zb = zOf(e.h);
  return `<g data-el="header"><path class="rp-header" d="${k.faceRectY(P, SCREEN.x0, SCREEN.x1, FACE_Y, zb, zt)}"/>`
    + `<path class="rp-logo" d="${k.pathOf([at([X0 + 0.4, FACE_Y, (zt + zb) / 2]), at([X0 + 7, FACE_Y, (zt + zb) / 2])])}"/></g>`;
}
function page() {
  const els = FIRST_SCREEN.map((e) => (e.kind === "text" ? textEl(e) : e.kind === "img" ? heroEl(e) : e.kind === "ad" ? adEl(e) : headerEl(e)));
  return `<defs><clipPath id="rp-screen-clip"><path d="${screenClip(P)}"/></clipPath></defs><g clip-path="url(#rp-screen-clip)"><g data-page style="display:none">${els.join("")}</g></g>`;
}
function phoneFront() {
  const out = [`<g data-shutter>${shutterSvg(P, BOTTOM)}</g>`];
  out.push(S(k.slabOf(BOX, SCREEN.top, PHONE_Z[1] - SCREEN.top + 2.4, P, 2, 0.3), { tone: "mid" }));
  out.push(text(SCREEN.x0 + 1, BOX.y + BOX.d, SCREEN.top + 1.4, t("FIRST PAINT", "PRIMER PINTADO"), 2.2, { tone: "hi" }));
  // the LCP tag at the right edge of the screen, moved to the largest element painted so far
  out.push(`<g data-lcp style="display:none">${litFill(S(k.slabOf({ x: LCP_TAG.x, y: LCP_TAG.y - 1.2, w: LCP_TAG.w, d: 1.2, r: 0.3 }, SCREEN.top - LCP_TAG.h, LCP_TAG.h, P, 2, 0.2), { tone: "hi", crease: "lo", lit: true }))}`
    + text(LCP_TAG.x + LCP_TAG.w / 2, LCP_TAG.y, SCREEN.top - LCP_TAG.h + 1.2, "LCP", 2.6, { anchor: "middle", tone: "on-lit" })
    + `</g>`);
  // the stand's front: screen size and the shift lamp
  const front = STAND.y + STAND.d;
  out.push(text(STAND.x + 4, front, 1.4, "400 × 720 px", 2.4));
  out.push(`<g data-shift="off">${lamp(P, SHIFT_LAMP, { r: 2.2 })}</g><g data-shift="on" style="display:none">${litFill(lamp(P, SHIFT_LAMP, { r: 2.2, lit: true }))}</g>`);
  out.push(text(SHIFT_LAMP[0] + 1, front, 1.4, t("SHIFT", "SALTO"), 2.4, { anchor: "middle" }));
  return out.join("");
}

// ---------- the console ----------
function console_() {
  const out = [S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(CONSOLE, 2), CONSOLE_H, P), { tone: "faint" }));
  // the stopwatch: a dial on a drum, one turn = 5 s
  out.push(dial(P, { x: STOPWATCH.x, y: STOPWATCH.y, z: CONSOLE_H, r: STOPWATCH.r, h: 3, ticks: 50, every: 10, name: "clock", value: 0 }));
  out.push(text(STOPWATCH.x, FRONT, 3.4, t("5 s A TURN", "5 s POR VUELTA"), 2.2, { anchor: "middle" }));
  // the gauges: a counter each, and a meter for the two Core Web Vitals
  const gauge = (x, name, words, count) => {
    out.push(digitCounter(P, { x, y: FRONT, z: 1.4, count, w: 3.4, h: 4.4, gap: 0.5, pad: [0.8, 0.7, 0.5], name }));
    out.push(text(x - 0.6, FRONT, 8.8, words, 2.2));
  };
  gauge(-140, "fp", t("FIRST PAINT, ms", "PRIMER PINTADO, ms"), 4);
  gauge(-110, "text", t("TEXT VISIBLE, ms", "TEXTO VISIBLE, ms"), 4);
  gauge(-80, "lcp", "LCP, ms", 4);
  out.push(meter(P, { x: -56, y: FRONT, z: 1.6, r: 5, ticks: 10, zone: 0.5, name: "lcp" }));
  out.push(text(-56, FRONT, 8.6, "0–5 s", 2, { anchor: "middle" }));
  // CLS: "0." painted on the face, then three wheels
  out.push(text(-42.6, FRONT, 1.9, "0.", 3.4, { tone: "hi" }));
  gauge(-37, "cls", "CLS", 3);
  out.push(meter(P, { x: -16, y: FRONT, z: 1.6, r: 5, ticks: 10, zone: 0.2, name: "cls" }));
  out.push(text(-16, FRONT, 8.6, "0–0.5", 2, { anchor: "middle" }));
  // the main thread: what it is doing now (lamps near the front edge, words under them)
  const lampsX = [4, 13, 22, 31];
  const words = ["HTML", "CSS", "JS", t("PAINT", "PINTADO")];
  ["parse", "css", "script", "render"].forEach((kind, i) => {
    const p = [lampsX[i], FRONT - 3.2, CONSOLE_H];
    out.push(`<g data-thread="${kind}">${lamp(P, p, { r: 1.9 })}</g><g data-thread-on="${kind}" style="display:none">${litFill(lamp(P, p, { r: 1.9, lit: true }))}</g>`);
    out.push(text(lampsX[i], FRONT, 5.8, words[i], 2, { anchor: "middle" }));
  });
  out.push(text(17.5, FRONT, 1.8, t("MAIN THREAD", "HILO PRINCIPAL"), 2.2, { anchor: "middle" }));
  return out.join("");
}

export function buildFigure() {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: t(
      "A page-load bench on a base plate. At the back, a rack of glass tubes, one per resource (the HTML, the stylesheet, the script, the font, the hero image, the images further down the page and the ad); each fills as its bytes arrive, and three pips on its plinth show how urgent the browser made the download. In the middle, the HTML lies on a strip as a row of tags in document order, head then body, appearing as the document's bytes arrive; a small figure, the parser, walks along it and stops, lit, where a classic script holds it. At the right, a phone with a roller shutter over its screen: the shutter stays down until the first paint, then the screen shows the page as each frame lays it out, the headline and paragraphs as lines, invisible until the font allows, the hero image, and the ad slot. A lit LCP tag marks the largest element painted so far, and a lamp flashes when visible content moves. In front, a console with a stopwatch, counters for first paint, text visible, LCP and CLS, meters for LCP and CLS, and four lamps for what the main thread is doing: parsing HTML, applying CSS, running JavaScript or painting.",
      "Un banco de carga de página sobre una placa base. Atrás, un estante de tubos de vidrio, uno por recurso (el HTML, la hoja de estilos, el script, la fuente, la imagen hero, las imágenes más abajo en la página y el anuncio); cada uno se llena a medida que llegan sus bytes, y tres marcas en su base muestran qué tan urgente hizo el navegador la descarga. En el medio, el HTML yace sobre una tira como una fila de etiquetas en el orden del documento, primero el head y después el body, que aparecen a medida que llegan los bytes del documento; una pequeña figura, el parser, camina por ella y se detiene, iluminada, donde la retiene un script clásico. A la derecha, un teléfono con una cortina enrollable sobre la pantalla: la cortina sigue baja hasta el primer pintado, y luego la pantalla muestra la página tal como la acomoda cada cuadro, el título y los párrafos como líneas, invisibles hasta que la fuente lo permite, la imagen hero y el espacio del anuncio. Una etiqueta LCP iluminada marca el elemento más grande pintado hasta ahora, y una lámpara se enciende cuando se mueve contenido visible. Adelante, una consola con un cronómetro, contadores de primer pintado, texto visible, LCP y CLS, medidores de LCP y CLS, y cuatro lámparas para lo que hace el hilo principal: analizar HTML, aplicar CSS, correr JavaScript o pintar.",
    ),
    body: [
      plate(),
      rackBack(),
      rack(),
      tape(),
      walker(),
      tags(),
      phoneBack(),
      page(),
      phoneFront(),
      console_(),
    ],
  });
}

export const GEOMETRY = { SLOTS, TAPE, WALKER, SCREEN, BOTTOM, TUBES, LCP_TAG, VIEW_H: VIEW.h, slotXs: Object.fromEntries(Object.entries(SLOTS).map(([n, s]) => [n, slotX(s)])) };

// The page drawn on the screen: lines for text (thicker in the web font, dotted while invisible), the hero, the ad.
export const FIGURE_CSS = `
.rp-screen{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.6}
.iso-line.rp-h1{stroke-width:2.4}
.iso-line.rp-h1.rp-web{stroke-width:3.2}
.iso-line.rp-p{stroke-width:1}
.iso-line.rp-p.rp-web{stroke-width:1.5}
.iso-line.rp-ghost{stroke-dasharray:1 2.4}
.rp-img{fill:var(--anatomy-faint);stroke:var(--anatomy-mid);stroke-width:.6}
.rp-img-line{fill:none;stroke:var(--anatomy-hi);stroke-width:1.1;stroke-linejoin:round}
.rp-slot{fill:none;stroke:var(--anatomy-mid);stroke-dasharray:2 2;stroke-width:.8}
.rp-ad{fill:var(--anatomy-lo);stroke:var(--anatomy-mid);stroke-width:.6}
.rp-header{fill:var(--anatomy-mid)}
.rp-logo{fill:none;stroke:var(--anatomy-page);stroke-width:2;stroke-linecap:round}
`;

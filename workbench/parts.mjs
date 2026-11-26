// Parts every workbench machine stands on. Each returns SVG markup; draw them first (back of the painter's order).
import { isT } from "./i18n.mjs";
import * as k from "./kit.mjs";
import { sphereOf } from "./kit.mjs";
import { digitPath, counterCells, digitsOf, facePoint } from "./digits.mjs";
import { tubeFill, tubeFloor } from "./tube-fill.mjs";
export { tubeFill };


const byDepth = (P, points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// Base plate on four feet, with a halo, a groove inset from the edge and four corner screws.
export function basePlate(P, plan, { height = 12, foot = 5, footInset = 22, groove = 5, screwInset = 10, bevel = 1.6, steps = 8 } = {}) {
  const out = [`<path class="iso-halo" d="${k.haloOf(plan, -height - foot, height, P)}"/>`];
  for (const [x, y] of byDepth(P, k.corners(plan, footInset))) {
    out.push(k.solidSvg(k.cylinder(x, y, 7, -height - foot, 1.6, P, 28), { tone: "lo" }));
    out.push(k.solidSvg(k.cylinder(x, y, 5.4, -height - foot + 1.6, foot - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(k.solidSvg(k.slabOf(plan, -height, height, P, steps, bevel), { tone: "mid" }));
  out.push(k.lineSvg(k.planOutline(k.insetPlan(plan, groove), 0, P), { tone: "lo" }));
  const screws = k.corners(plan, screwInset);
  out.push(k.lineSvg(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(k.dotsSvg(screws.map(([x, y]) => k.iso([x, y, 0], P)), { size: 0.5 }));
  return out.join("");
}

// A thin ruler strip lying on the plate, with minor and major ticks rooted on its back edge and a screw at each end.
export function rulerStrip(P, strip, { step = 4, every = 5, ticks = [2, 3.6] } = {}) {
  const out = [k.solidSvg(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" })];
  const t = k.topTicks(strip.x + 4, strip.x + strip.w - 4, step, every, strip.y + 0.8, 0.6, ticks, P);
  out.push(k.lineSvg(t.minor, { tone: "lo" }), k.lineSvg(t.major, { tone: "mid" }));
  out.push(k.dotsSvg([k.iso([strip.x + 2, strip.y + strip.d / 2, 0.6], P), k.iso([strip.x + strip.w - 2, strip.y + strip.d / 2, 0.6], P)], { size: 0.45 }));
  return out.join("");
}

// A label plate with rule lines that stand for printed text (lines: [[x, y, length], ...] in world units).
export function labelPlate(P, plan, lines) {
  const out = [k.solidSvg(k.slabOf(plan, 0, 0.8, P, 4), { tone: "mid", crease: "none" })];
  out.push(k.lineSvg(k.planOutline(k.insetPlan(plan, 1.6), 0.8, P), { tone: "faint" }));
  out.push(k.lineSvg(lines.map(([x, y, len]) => k.lineOnTop([x, y], [x + len, y], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(k.dotsSvg([k.iso([plan.x + 3, plan.y + 3, 0.8], P), k.iso([plan.x + plan.w - 3, plan.y + plan.d - 3, 0.8], P)], { size: 0.45 }));
  return out.join("");
}

// ---------------------------------------------------------------------------------------------
// Shared machine parts. Promoted from the lessons that kept re-inventing them (counter, races,
// probes, async, parallelism, eventloop, stampede, gossip, nplusone, idempotency, cardinality).
// Every part takes the projection P first and world units; each returns SVG markup, so the
// caller keeps control of the painter's order. Live parts carry their geometry in a data-geo
// attribute so the browser helpers (WB.counter, WB.dial, WB.meter, WB.pose) can update them.
// ---------------------------------------------------------------------------------------------
export { digitPath, counterCells, digitsOf, facePoint };

const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const geo = (o) => ` data-geo='${JSON.stringify(o)}'`;
const at = (P) => (p) => k.iso(p, P);

// Text printed on a face. face "y" (constant y, reads along +x), "x" (constant x, reads along -y),
// or "top" (lying on a top face at height z, reads along x; along: "y" turns it to read along y).
export function faceText(P, [x, y, z], text, { face = "y", size = 3, tone = "mid", anchor = "start", along = "x", attr = "" } = {}) {
  if (isT(text)) return `<g data-l="en">${faceText(P, [x, y, z], text.en, { face, size, tone, anchor, along, attr })}</g><g data-l="es">${faceText(P, [x, y, z], text.es, { face, size, tone, anchor, along, attr })}</g>`;
  const m = face === "top" ? k.topMatrix([x, y], z, P, along) : k.sideMatrix([x, y], z, P, face === "x" ? "right" : "left");
  const svg = k.faceTextSvg(m, text, { size, tone, anchor });
  return attr ? svg.replace("<text ", `<text ${attr} `) : svg;
}

// A rectangle on a vertical face, as a closed path: (u0..u1 across, v0..v1 up) from a face corner.
export function faceRect(P, face, corner, u0, u1, v0, v1) {
  const c = { ...corner, w: 0, h: 0 };
  return k.pathOf([[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => k.iso(facePoint(face, c, u, v), P)), true);
}

// The lit-fill variant: a lit solid whose top and sides fill with the lit colour (black in light
// theme, white in dark) instead of only a darker outline. Opt in per page with LIT_FILL_CSS.
export const litFill = (svg) => svg.replace(/data-lit=""/g, 'data-lit="" data-lit-fill=""');
// Page default (renderPage({ litFill: true }), the default): every lit solid fills. A solid that should keep
// the outline-only lit style (a large body that would turn into a black block, a face carrying dark text)
// opts out with data-lit-outline: S(..., { lit: true }).replace('class="iso-solid"', 'class="iso-solid" data-lit-outline').
// Text printed on a part that can be lit: wrap the part and its marks in <g class="wb-lit-group">. While the solid
// inside is lit (also when data-lit is toggled live), its face text, digit wheels and marks tagged
// data-on-lit="fill" | "stroke" switch to the page colour so they stay readable on the fill. One lit-able solid per group.
const LF = (sel) => `body.lit-fill .iso-solid[data-lit]:not([data-lit-outline])${sel}`;
export const LIT_FILL_PAGE_CSS = `
${LF(">.iso-fill")},${LF(">.iso-top")}{fill:var(--anatomy-lit)}
${LF(">.iso-shade")}{fill:color-mix(in srgb,var(--anatomy-lit) 78%,var(--anatomy-page))}
${LF(">.iso-line")}{stroke:color-mix(in srgb,var(--anatomy-lit) 70%,var(--anatomy-page))}
${LF(">.iso-edge")}{stroke:var(--anatomy-lit)}
${LF("~.iso-face-text[data-tone=\"on-lit\"]")}{fill:var(--anatomy-page)}
body.lit-fill .wb-lit-group:has(.iso-solid[data-lit]:not([data-lit-outline])) :is(.iso-face-text,[data-on-lit~="fill"],[data-on-lit~="fill"] circle){fill:var(--anatomy-page)}
body.lit-fill .wb-lit-group:has(.iso-solid[data-lit]:not([data-lit-outline])) :is(.wb-digit,[data-on-lit~="stroke"]){stroke:var(--anatomy-page)}
`;
export const LIT_FILL_CSS = `
.iso-solid[data-lit-fill]>.iso-fill,.iso-solid[data-lit-fill]>.iso-top{fill:var(--anatomy-lit)}
.iso-solid[data-lit-fill]>.iso-shade{fill:color-mix(in srgb,var(--anatomy-lit) 78%,var(--anatomy-page))}
.iso-solid[data-lit-fill]>.iso-line{stroke:color-mix(in srgb,var(--anatomy-lit) 70%,var(--anatomy-page))}
.iso-solid[data-lit-fill]>.iso-edge{stroke:var(--anatomy-lit)}
.iso-solid[data-lit-fill]~.iso-face-text[data-tone="on-lit"]{fill:var(--anatomy-page)}
`;

// ---------- digit-wheel counter ----------
// A row of printed wheels on a vertical face, in an optional raised housing.
// (x, y, z) is the left-bottom corner of the first wheel on the face plane. pad: a number, or
// [across, below, above] for a housing that isn't even all round.
//   digitCounter(P, { x: -15, y: 20, z: 6, count: 4, w: 6, h: 9, name: "balance", value: 40 })
// Live: const c = WB.counter(svg, "balance", P); c.set(41).
export function digitCounter(P, { x, y, z, count = 3, w = 6, h = 8, gap = 1, face = "y", housing = true, pad = 2.6, proud = 1.4, name = "", value = 0, size, lit = false } = {}) {
  const c = { x, y, z, w, h, gap, count, face };
  const cells = counterCells(c);
  const span = count * w + (count - 1) * gap;
  const px = k.screenRise(h, P);
  const sz = size || (px >= 22 ? "l" : px <= 9 ? "s" : "m");
  const out = [`<g class="wb-counter" data-counter="${name}"${geo({ face, cells })}>`];
  if (housing) {
    const [across, below, above] = Array.isArray(pad) ? pad : [pad, pad, pad];
    const plan = face === "x"
      ? { x: x - proud, y: y - span - across, w: proud, d: span + 2 * across, r: 0.5 }
      : { x: x - across, y: y - proud, w: span + 2 * across, d: proud, r: 0.5 };
    out.push(S(k.slabOf(plan, z - below, h + below + above, P, 2), { tone: "hi", crease: "lo", lit }));
  }
  const digits = digitsOf(value, count);
  const iso = at(P);
  cells.forEach((cell, j) => {
    out.push(`<path class="wb-wheel" d="${faceRect(P, face, cell, 0, w, 0, h)}"/>`);
    const notch = (u0, u1) => k.pathOf([iso(facePoint(face, cell, u0, h / 2)), iso(facePoint(face, cell, u1, h / 2))]);
    out.push(Ln(notch(0, w * 0.12) + notch(w * 0.88, w), { tone: "faint" }));
    out.push(`<path class="wb-digit" data-size="${sz}" data-wheel="${j}" d="${digitPath(k.iso, P, cell, digits[j], face)}"/>`);
  });
  out.push(`</g>`);
  return out.join("");
}

// ---------- people ----------
// A standing person: foot disc, body, shoulders, round head. scale 1 is about 24 units tall.
// hat: "cap" (flat brim, the one in charge) or "brim" (wide brim, a warden). holding: "tray",
// "clipboard", "slip" (with slipText) or "key". Things held sit in front, toward the viewer (+x, +y).
//   person(P, [x, y, 0], { scale: 0.8, hat: "cap", holding: "slip", slipText: "40" })
export function person(P, [x, y, z = 0], { scale: s = 1, tone = "hi", lit = false, hat = null, holding = null, slipText = "", slipAttr = "" } = {}) {
  const out = [];
  out.push(S(k.cylinder(x, y, 5.6 * s, z, 1.4 * s, P, 24, 0.3 * s), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 4.2 * s, z + 1.4 * s, 12.6 * s, P, 22, 0.3 * s), { tone, crease: "none", lit }));
  out.push(S(k.cylinder(x, y, 5 * s, z + 14 * s, 1.4 * s, P, 22, 0.3 * s), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 1.6 * s, z + 15.4 * s, 1.4 * s, P, 12), { tone: "mid", crease: "none" }));
  out.push(S(sphereOf([x, y, z + 20.2 * s], 3.7 * s, P), { tone, crease: "lo", lit }));
  if (hat === "cap") {
    out.push(S(k.cylinder(x, y, 4.6 * s, z + 22.6 * s, 0.7 * s, P, 24), { tone: "mid", crease: "none" }));
    out.push(S(k.cylinder(x, y, 2.8 * s, z + 23.3 * s, 1.6 * s, P, 20, 0.4 * s), { tone: "mid", crease: "lo" }));
  } else if (hat === "brim") {
    out.push(S(k.cylinder(x, y, 6.2 * s, z + 22.4 * s, 0.6 * s, P, 28), { tone: "mid", crease: "none" }));
    out.push(S(k.cylinder(x, y, 3 * s, z + 23 * s, 2.6 * s, P, 20, 0.5 * s), { tone: "mid", crease: "lo" }));
  }
  if (holding === "tray") {
    // forearm out to the side, tray on the palm, clear of the body
    out.push(S(k.slabOf({ x: x + 3.4 * s, y: y + 0.6 * s, w: 3.6 * s, d: 2 * s, r: 0.5 * s }, z + 10.6 * s, 1.4 * s, P, 2), { tone: "mid", crease: "none" }));
    out.push(S(k.cylinder(x + 7.6 * s, y + 1.6 * s, 3.8 * s, z + 12 * s, 0.8 * s, P, 24, 0.2 * s), { tone: "hi", crease: "lo", lit }));
  } else if (holding === "clipboard") {
    out.push(S(k.slabOf({ x: x - 3 * s, y: y + 4.4 * s, w: 6 * s, d: 0.6 * s, r: 0.15 * s }, z + 6.5 * s, 7.5 * s, P, 2), { tone: "hi", crease: "lo" }));
    out.push(S(k.slabOf({ x: x - 1.2 * s, y: y + 4.2 * s, w: 2.4 * s, d: 1 * s, r: 0.2 * s }, z + 13.4 * s, 1 * s, P, 2), { tone: "mid", crease: "none" }));
  } else if (holding === "slip") {
    const slip = { x: x - 4.2 * s, y: y + 4.6 * s, w: 8.4 * s, d: 0.5 * s, r: 0.15 * s };
    out.push(S(k.slabOf(slip, z + 7 * s, 7 * s, P, 1, 0.2 * s), { tone: "hi", crease: "lo", lit }));
    if (slipText !== "") out.push(faceText(P, [x, slip.y + slip.d, z + 9 * s], slipText, { size: 3.6 * s, tone: lit ? "on-lit" : "hi", anchor: "middle", attr: slipAttr }));
  } else if (holding === "key") {
    out.push(keyPart(P, [x + 5.6 * s, y + 3 * s, z + 9 * s], { scale: s }));
  }
  return out.join("");
}

// A small figurine for crowds (customers, queued workers): base, body, round head. ~13 units tall.
export function figurine(P, [x, y, z = 0], { scale: s = 1, tone = "hi", lit = false } = {}) {
  return S(k.cylinder(x, y, 3.2 * s, z, 1.2 * s, P, 20), { tone: "lo" })
    + S(k.cylinder(x, y, 2.4 * s, z + 1.2 * s, 7.6 * s, P, 20, 0.3 * s), { tone, crease: "none", lit })
    + S(sphereOf([x, y, z + 11 * s], 2.3 * s, P), { tone, crease: "lo", lit });
}

// A key: bow ring, shaft and two teeth, lying in a vertical plane facing +y.
export function keyPart(P, [x, y, z], { scale: s = 1, lit = false } = {}) {
  return S(k.cylinder(x, y, 1.8 * s, z + 3 * s, 0.7 * s, P, 16), { tone: "hi", crease: "lo", lit })
    + S(k.slabOf({ x: x - 0.4 * s, y: y - 0.4 * s, w: 0.8 * s, d: 0.8 * s, r: 0.2 * s }, z - 3.6 * s, 6.6 * s, P, 2), { tone: "hi", crease: "none", lit })
    + S(k.slabOf({ x: x + 0.4 * s, y: y - 0.4 * s, w: 1.4 * s, d: 0.8 * s, r: 0.2 * s }, z - 3.6 * s, 0.9 * s, P, 2), { tone: "hi", crease: "none", lit })
    + S(k.slabOf({ x: x + 0.4 * s, y: y - 0.4 * s, w: 1 * s, d: 0.8 * s, r: 0.2 * s }, z - 1.8 * s, 0.9 * s, P, 2), { tone: "hi", crease: "none", lit });
}

// ---------- dials and meters ----------
// A round dial lying on top of a drum: knurled rim, ticks, hub and a needle named `name`.
// The needle sweeps from `from` (radians, 0 = toward -y) through `span`; set it with a fraction 0..1.
//   dial(P, { x: 60, y: 40, r: 9, name: "round", value: 0.25 })   then WB.dial(svg, "round", P).set(0.5)
export function dial(P, { x, y, z = 0, r = 9, h = 5, ticks = 40, every = 5, from = 0, span = Math.PI * 2, name = "", value = 0, knurl = true, label = "" } = {}) {
  const top = z + h;
  const out = [S(k.cylinder(x, y, r + 1.8, z, Math.min(2, h * 0.4), P, 48), { tone: "mid" })];
  out.push(S(k.cylinder(x, y, r, z + Math.min(2, h * 0.4), h - Math.min(2, h * 0.4), P, 56, 0.6), { tone: "hi", crease: "lo" }));
  if (knurl) out.push(Ln(k.knurl(x, y, r, top - Math.min(2.4, h * 0.5), top, 56, P, 0.3), { tone: "lo" }));
  out.push(Ln(k.ring(x, y, r - 1.4, top, P, 56), { tone: "lo" }));
  const t = k.radialTicks(x, y, r - 1.8, ticks, every, top, [r * 0.09, r * 0.2], P, from, span);
  out.push(Ln(t.minor, { tone: "faint" }), Ln(t.major, { tone: "mid" }));
  if (label) out.push(faceText(P, [x, y + r * 0.45, top], label, { face: "top", size: r * 0.24, tone: "lo", anchor: "middle" }));
  const g = { x, y, z: top + 0.15, r: r - 2.4, from, span };
  out.push(`<path class="wb-needle" data-dial="${name}"${geo(g)} d="${dialNeedle(P, g, value)}"/>`);
  out.push(Ln(k.ring(x, y, Math.max(0.8, r * 0.12), top + 0.2, P, 16), { tone: "mid" }));
  return out.join("");
}
export function dialNeedle(P, g, frac) {
  const a = g.from + Math.max(0, Math.min(1, frac)) * g.span, sx = Math.sin(a), sy = -Math.cos(a);
  return k.lineOnTop([g.x - sx * g.r * 0.22, g.y - sy * g.r * 0.22], [g.x + sx * g.r, g.y + sy * g.r], g.z, P);
}

// A half-round meter on a vertical face (a load or temperature gauge): arc, ticks, an optional
// red-zone band from `zone` to 1, and a needle that swings left (0) to right (1).
//   meter(P, { x: 10, y: 30, z: 8, r: 7, name: "load", value: 0.3, zone: 0.8 })
export function meter(P, { x, y, z, r = 7, face = "y", ticks = 10, zone = null, name = "", value = 0 } = {}) {
  const iso = at(P), c = { x, y, z };
  const pt = (frac, rr) => { const a = Math.PI * (1 - frac); return iso(facePoint(face, c, Math.cos(a) * rr, Math.sin(a) * rr)); };
  const arc = (rr, f0 = 0, f1 = 1) => k.pathOf(Array.from({ length: 25 }, (_, i) => pt(f0 + ((f1 - f0) * i) / 24, rr)));
  const out = [`<path class="wb-meter-face" d="${k.pathOf([...Array.from({ length: 25 }, (_, i) => pt(i / 24, r)), pt(1, 0)], true)}"/>`];
  out.push(Ln(arc(r), { tone: "lo" }));
  if (zone !== null) out.push(`<path class="wb-meter-zone" d="${k.pathOf([...Array.from({ length: 9 }, (_, i) => pt(zone + ((1 - zone) * i) / 8, r * 0.92)), ...Array.from({ length: 9 }, (_, i) => pt(1 - ((1 - zone) * i) / 8, r * 0.74))], true)}"/>`);
  const tk = [];
  for (let i = 0; i <= ticks; i++) tk.push(k.pathOf([pt(i / ticks, r * 0.92), pt(i / ticks, i % 5 === 0 ? r * 0.7 : r * 0.8)]));
  out.push(Ln(tk.join(""), { tone: "mid" }));
  const g = { x, y, z, r: r * 0.86, face };
  out.push(`<path class="wb-needle" data-meter="${name}"${geo(g)} d="${meterNeedle(P, g, value)}"/>`);
  out.push(k.dotsSvg([pt(0, 0)], { size: 0.9 }));
  return out.join("");
}
export function meterNeedle(P, g, frac) {
  const a = Math.PI * (1 - Math.max(0, Math.min(1, frac)));
  return k.pathOf([k.iso(facePoint(g.face, g, 0, 0), P), k.iso(facePoint(g.face, g, Math.cos(a) * g.r, Math.sin(a) * g.r), P)]);
}

// ---------- cards, tickets, plaques ----------
// An upright card standing on a face plane, with printed text: a ticket, a slip, a tag.
// (x, y, z) is its left-bottom corner on the plane. clip: a small clip on top (hanging from a rail).
//   card(P, { x: 0, y: 20, z: 6, w: 8, h: 11, text: "A7", sub: "try 2", clip: true, lit: true })
export function card(P, { x, y, z, w = 8, h = 10, d = 0.6, face = "y", text = "", sub = "", size, subSize, clip = false, lit = false, tone = "hi", attr = "", subAttr = "" } = {}) {
  const plan = face === "x" ? { x: x - d, y: y - w, w: d, d: w, r: 0.15 } : { x, y: y - d, w, d, r: 0.15 };
  const out = [S(k.slabOf(plan, z, h, P, 2, 0.15), { tone, crease: "none", lit })];
  if (clip) {
    const cx = face === "x" ? x - d / 2 : x + w / 2, cy = face === "x" ? y - w / 2 : y - d / 2;
    out.push(S(k.slabOf({ x: cx - (face === "x" ? 0.7 : 1.3), y: cy - (face === "x" ? 1.3 : 0.7), w: face === "x" ? 1.4 : 2.6, d: face === "x" ? 2.6 : 1.4, r: 0.3 }, z + h - 1, 2, P, 2), { tone: "mid", crease: "none" }));
  }
  const ink = lit ? "on-lit" : "hi";
  const mid = face === "x" ? [x, y - w / 2] : [x + w / 2, y];
  const big = size ?? Math.min(w * 0.55, h * 0.42);
  if (text !== "") out.push(faceText(P, [mid[0], mid[1], z + (sub ? h * 0.48 : h * 0.3)], text, { face, size: big, tone: ink, anchor: "middle", attr }));
  if (sub !== "") out.push(faceText(P, [mid[0], mid[1], z + h * 0.16], sub, { face, size: subSize ?? big * 0.5, tone: lit ? "on-lit" : "hi", anchor: "middle", attr: subAttr }));
  return out.join("");
}

// A plaque lying on a top surface at height z, with printed text (a shelf number, a station name).
export function plaque(P, { x, y, z = 0, w = 10, d = 6, text = "", size, along = "x", lit = false, attr = "" } = {}) {
  const out = [S(k.slabOf({ x, y, w, d, r: 0.8 }, z, 0.8, P, 3, 0.3), { tone: "hi", crease: "lo", lit })];
  out.push(Ln(k.planOutline(k.insetPlan({ x, y, w, d, r: 0.8 }, 0.9), z + 0.8, P), { tone: "faint" }));
  if (text !== "") out.push(faceText(P, [x + w / 2, y + d / 2 + (size ?? d * 0.5) * 0.35, z + 0.8], text, { face: "top", size: size ?? d * 0.5, tone: lit ? "on-lit" : "hi", anchor: "middle", along, attr }));
  return out.join("");
}

// ---------- flags and signs ----------
// A pennant on a pole standing at (x, y, z): pole up to z + height, a triangle flying along +x
// (face "y") or -y (face "x").
//   pennant(P, { x: 10, y: 4, z: 12, height: 10, lit: true })
export function pennant(P, { x, y, z = 0, height = 10, length = 8, drop = 5, face = "y", lit = false } = {}) {
  const iso = at(P), c = { x, y, z: z + height };
  const out = [Ln(k.segment([x, y, z], [x, y, z + height + 0.6], P), { tone: "mid" })];
  out.push(`<path class="wb-pennant"${lit ? " data-lit" : ""} d="${k.pathOf([iso(facePoint(face, c, 0, 0)), iso(facePoint(face, c, length, -drop / 2)), iso(facePoint(face, c, 0, -drop))], true)}"/>`);
  out.push(k.dotsSvg([iso([x, y, z + height + 0.6])], { size: 0.6 }));
  return out.join("");
}

// A sign board on two posts (posts: false for a board fixed to a wall). (x, y) is the board's
// left edge on its face plane; z0 the bottom of the board, h its height. Text is printed on the face.
//   sign(P, { x: -10, y: 30, z: 10, w: 20, h: 7, text: "OPEN", lit: true })
export function sign(P, { x, y, z = 8, w = 18, h = 7, d = 1.2, face = "y", text = "", size, posts = true, lit = false, attr = "" } = {}) {
  const out = [];
  const plan = face === "x" ? { x: x - d, y: y - w, w: d, d: w, r: 0.2 } : { x, y: y - d, w, d, r: 0.2 };
  if (posts) for (const u of [1.4, w - 1.4]) {
    const [px, py] = face === "x" ? [x - d / 2, y - u] : [x + u, y - d / 2];
    out.push(S(k.cylinder(px, py, 0.6, 0, z, P, 10), { tone: "mid", crease: "none" }));
  }
  const inner = Ln(faceRect(P, face, { x, y, z }, 1, w - 1, 1, h - 1), { tone: lit ? "mid" : "lo" });
  out.push(S(k.slabOf(plan, z, h, P, 2, 0.2), { tone: lit ? "hi" : "mid", crease: "lo", lit, inner }));
  if (text !== "") {
    const mid = face === "x" ? [x, y - w / 2] : [x + w / 2, y];
    out.push(faceText(P, [mid[0], mid[1], z + h * 0.3], text, { face, size: size ?? h * 0.48, tone: lit ? "on-lit" : "hi", anchor: "middle", attr }));
  }
  return out.join("");
}

// ---------- lamps ----------
// A lamp: a squat housing and a round bulb on top. lit lights the bulb.
export function lamp(P, [x, y, z = 0], { r = 3, lit = false, housing = true } = {}) {
  const out = [];
  if (housing) out.push(S(k.cylinder(x, y, r * 1.3, z, r * 1.1, P, 24, 0.3), { tone: "mid" }));
  out.push(S(sphereOf([x, y, z + (housing ? r * 1.1 : 0) + r * 0.9], r, P), { tone: "hi", crease: "lo", lit }));
  return out.join("");
}

// ---------- gate ----------
// A boom barrier across a lane that runs along x: the post stands just behind the lane (y0), the boom crosses to a rest
// post just in front of it (y1). Both states are drawn (closed: the boom down across the lane; open: standing up on its
// post); WB.gate(svg, name).set(open, { lit }) switches them, and lit lights the boom (and the lamp, if any).
// part: "back" draws the post and the boom (before the lane's contents), "front" the rest post and the lamp (after
// them), "all" both, for a gate nothing passes under. rest: false leaves out the rest post (the boom is cantilevered),
// for a lane with words on its front face.
//   gate(P, { x: 40, y0: -50, y1: -36, z: 9, height: 12, name: "cap", lamp: true })
export function gate(P, { x, y0, y1, z = 0, height = 12, name = "", open = false, lit = false, lamp: withLamp = false, rest = true, part = "all" } = {}) {
  const py = y0 - 2.2, ry = y1 + 2.2, top = z + height;
  const back = [], front = [];
  back.push(S(k.cylinder(x, py, 1.3, z, height + 1.2, P, 14), { tone: "mid", crease: "none" }));
  // closed: a striped boom from the pivot to the rest post
  const boom = { x: x - 0.9, y: py - 0.9, w: 1.8, d: ry - py + (rest ? 1.8 : 0), r: 0.4 };
  const stripes = [];
  for (let yy = py + 3; yy < ry - 1; yy += 4) stripes.push(k.segment([x + 0.9, yy, top - 0.4], [x + 0.9, yy + 1.6, top + 1.4], P));
  const down = S(k.slabOf(boom, top - 0.4, 1.8, P, 2), { tone: "hi", crease: "lo", lit }) + Ln(stripes.join(""), { tone: "lo" });
  // open: the boom standing up on the pivot
  const up = S(k.slabOf({ x: x - 0.9, y: py - 0.9, w: 1.8, d: 1.8, r: 0.4 }, top + 1.2, ry - py, P, 2), { tone: "hi", crease: "lo", lit });
  // the post and the boom standing on it are behind whatever crosses the gate; the boom lying across is over it
  back.push(`<g data-gate-state="open"${open ? "" : " data-off"}>${up}</g>`);
  back.push(S(k.cylinder(x, py, 1.9, top + 0.2, 1, P, 16), { tone: "hi", crease: "none" }));
  front.push(`<g data-gate-state="closed"${open ? " data-off" : ""}>${down}</g>`);
  // the rest post the boom lies on, and the lamp on its own housing beside it
  if (rest) front.push(S(k.cylinder(x, ry, 1, z, height - 0.6, P, 12), { tone: "mid", crease: "none" }));
  if (withLamp) front.push(`<g data-gate-lamp>${lamp(P, [x + 3.6, ry, z], { r: 1.6, lit })}</g>`);
  const g = (parts, which) => `<g class="wb-gate" data-gate="${name}" data-gate-part="${which}">${parts.join("")}</g>`;
  return part === "back" ? g(back, "back") : part === "front" ? g(front, "front") : g([...back, ...front], "all");
}

// ---------- lane ----------
// A roller bed along x that work waits on, one slot per place, the head (the front of the line) at the +x end
// (head: "-x" for the other way). laneSlot(spec, i) is the top centre of slot i, counted from the head; a tag at the
// tail's front face shows "+N" when more wait than there are slots (WB.lane(svg, name).more(n)).
//   const L1 = { x: -100, y: -56, w: 150, d: 14, h: 9, slots: 13, name: "q" };  lane(P, L1);  laneSlot(L1, 0)
export function laneSlot({ x, y, w, d = 14, h = 9, slots = 10, head = "+x", stop = 3 }, i) {
  const pitch = (w - stop - 2) / slots, cx = head === "+x" ? x + w - stop - pitch * (i + 0.5) : x + stop + pitch * (i + 0.5);
  return [cx, y + d / 2, h];
}
export function lane(P, spec) {
  const { x, y, w, d = 14, h = 9, slots = 10, head = "+x", stop = 3, rollers = true, name = "", more = true, moreSize = 3 } = spec;
  const out = [S(k.slabOf({ x, y, w, d, r: 1 }, 0, h, P, 3, 0.5), { tone: "mid" })];
  if (rollers) {
    const r = [];
    for (let xx = x + 3; xx < x + w - 2; xx += 3) r.push(k.lineOnTop([xx, y + 2.2], [xx, y + d - 2.2], h, P));
    out.push(Ln(r.join(""), { tone: "lo" }));
  }
  for (const yy of [y + 0.2, y + d - 1.6]) out.push(S(k.slabOf({ x: x + 1, y: yy, w: w - 2, d: 1.4, r: 0.3 }, h, 1.6, P, 2), { tone: "hi", crease: "none" }));
  // a mark on the front rail between slots, and the stop at the head
  const marks = [];
  for (let i = 0; i <= slots; i++) {
    const [cx] = laneSlot(spec, i), pitch = (w - stop - 2) / slots, mx = cx + (head === "+x" ? pitch / 2 : -pitch / 2);
    marks.push(k.lineOnTop([mx, y + d - 1.6], [mx, y + d - 0.2], h + 1.6, P));
  }
  out.push(Ln(marks.join(""), { tone: "mid" }));
  const sx = head === "+x" ? x + w - stop : x;
  out.push(S(k.slabOf({ x: sx, y: y + 0.8, w: stop, d: d - 1.6, r: 0.4 }, h, 6, P, 2), { tone: "hi", crease: "lo" }));
  // "+N" on the front face at the tail (more: false when the machine counts the overflow elsewhere)
  const tx = head === "+x" ? x + 2 : x + w - 2;
  if (more) out.push(faceText(P, [tx, y + d, h - moreSize * 1.15], "", { size: moreSize, tone: "hi", anchor: head === "+x" ? "start" : "end", attr: `data-lane-more="${name}"` }));
  return `<g class="wb-lane" data-lane="${name}">${out.join("")}</g>`;
}

// ---------- rack ----------
// A low block with a grid of slot outlines on top (cols × rows, row 0 at the back, slot 0 at the back left), and an
// optional title on its front face. rackSlot(spec, i) is the top centre of slot i. WB.rack(svg, name).mark(i, on)
// draws a slot's outline in the lit colour (the slot something is about to land in, or the one being read).
//   const R = { x: -90, y: -80, w: 150, d: 14, h: 18, cols: 10, cell: { w: 12.6, d: 8 }, name: "a" };  rack(P, R)
function rackGrid({ x, y, w, d, cols = 10, rows = 1, cell = { w: 8, d: 8 }, gap = 1.6, pad }) {
  const gw = cols * cell.w + (cols - 1) * gap, gd = rows * cell.d + (rows - 1) * gap;
  const px = pad ?? (w - gw) / 2, pz = (d - gd) / 2;
  return { x0: x + px, y0: y + pz, gap };
}
export function rackSlot(spec, i) {
  const { cols = 10, cell = { w: 8, d: 8 }, h = 8 } = spec, g = rackGrid(spec);
  const c = i % cols, r = Math.floor(i / cols);
  return [g.x0 + c * (cell.w + g.gap) + cell.w / 2, g.y0 + r * (cell.d + g.gap) + cell.d / 2, h];
}
export function rack(P, spec) {
  const { x, y, w, d, h = 8, cols = 10, rows = 1, cell = { w: 8, d: 8 }, name = "", title, titleSize = 3, tone = "mid" } = spec;
  const out = [S(k.slabOf({ x, y, w, d, r: 1 }, 0, h, P, 3, 0.5), { tone })];
  for (let i = 0; i < cols * rows; i++) {
    const [cx, cy] = rackSlot(spec, i);
    out.push(Ln(k.planOutline({ x: cx - cell.w / 2 - 0.3, y: cy - cell.d / 2 - 0.3, w: cell.w + 0.6, d: cell.d + 0.6, r: 0.5 }, h, P), { tone: "faint" }).replace("<path ", `<path data-rack-slot="${i}" `));
  }
  if (title) out.push(faceText(P, [x + 3, y + d, Math.max(1.6, h / 2 - titleSize * 0.4)], title, { size: titleSize, tone: "mid" }));
  return `<g class="wb-rack" data-rack="${name}">${out.join("")}</g>`;
}

// ---------- bin ----------
// An open box that holds a pile: `cap` tokens (blocks or balls) are drawn into it, hidden, back to front and bottom up;
// WB.bin(svg, name).set(n, { lit }) shows the first n (lighting the last `lit` of them) and "+N" on its front face for
// the ones that don't fit. binSlots(spec) gives each token's centre, in the order they fill.
//   bin(P, { x: 54, y: 20, w: 32, d: 16, h: 5, cap: 12, token: "ball", size: 5.2, name: "dropped" })
export function binSlots({ x, y, w, d, wall = 1.2, cap = 12, token = "block", size = 4, gap = 0.6 }) {
  const cols = Math.max(1, Math.floor((w - 2 * wall + gap) / (size + gap))), rows = Math.max(1, Math.floor((d - 2 * wall + gap) / (size + gap)));
  const x0 = x + wall + (w - 2 * wall - (cols * size + (cols - 1) * gap)) / 2, y0 = y + wall + (d - 2 * wall - (rows * size + (rows - 1) * gap)) / 2;
  const out = [];
  for (let layer = 0; out.length < cap; layer++) {
    // each layer up sits in the hollows of the one below (balls) or straight on it (blocks), one place smaller
    const off = layer % 2 ? (size + gap) / 2 : 0, lc = cols - (layer % 2), lr = rows - (layer % 2 && token === "ball" ? 1 : 0);
    if (lc < 1 || lr < 1) break;
    const z = 1 + layer * (token === "ball" ? size * 0.78 : size * 0.75) + (token === "ball" ? size / 2 : 0);
    for (let r = 0; r < lr && out.length < cap; r++) for (let c = 0; c < lc && out.length < cap; c++) out.push([x0 + off + c * (size + gap) + size / 2, y0 + (token === "ball" ? off : 0) + r * (size + gap) + size / 2, z]);
  }
  return out;
}
export function bin(P, spec) {
  const { x, y, w, d, h = 6, wall = 1.2, cap = 12, token = "block", size = 4, name = "", moreSize = 3 } = spec;
  const wallSlab = (plan) => S(k.slabOf({ r: 0.3, ...plan }, 0, h, P, 2), { tone: "mid" });
  const out = [S(k.slabOf({ x, y, w, d, r: 1 }, 0, 1, P, 3), { tone: "lo", crease: "none" })];
  out.push(wallSlab({ x, y, w, d: wall }), wallSlab({ x, y, w: wall, d }));
  binSlots(spec).forEach(([cx, cy, cz], i) => {
    const solid = token === "ball"
      ? S(sphereOf([cx, cy, cz], size / 2, P, { steps: 20 }), { tone: "hi", crease: "lo" })
      : S(k.slabOf({ x: cx - size / 2, y: cy - size / 2, w: size, d: size, r: 0.5 }, cz, size * 0.7, P, 2, 0.3), { tone: "hi", crease: "lo" });
    out.push(`<g data-bin-token="${i}" data-off>${solid}</g>`);
  });
  out.push(wallSlab({ x: x + w - wall, y, w: wall, d }), S(k.slabOf({ x, y: y + d - wall, w, d: wall, r: 0.3 }, 0, h, P, 2), { tone: "hi" }));
  out.push(faceText(P, [x + w / 2, y + d, Math.max(0.8, h / 2 - moreSize * 0.4)], "", { size: moreSize, tone: "hi", anchor: "middle", attr: `data-bin-more="${name}"` }));
  return `<g class="wb-bin" data-bin="${name}">${out.join("")}</g>`;
}

// ---------- tube ----------
// A glass tube on a socket whose fill rises and falls: round (a test tube) or square (a gauge glass). The fill is the
// only live part (WB.tube(svg, name, P).set(frac, { lit })); the glass is lines, drawn over it. value: the opening
// level (0–1). headroom: glass left above a full fill. socket: 0 when the tube stands straight on a plinth.
//   tube(P, { x: 10, y: -40, z: 14, r: 2, h: 21, name: "p99-0", value: 0.4 })
//   tube(P, { x: 10, y: -40, z: 6, shape: "square", w: 10, d: 6, h: 24, socket: 0, name: "css" })
export function tube(P, spec) {
  const { x, y, z = 0, shape = "round", r = 2, w = 6, d = 6, h = 20, socket = 1.2, name = "", value = 0, lit = false } = spec;
  const floor = tubeFloor(spec), top = floor + h, out = [];
  if (socket > 0) out.push(shape === "round"
    ? S(k.cylinder(x, y, r + 0.7, z, socket, P, 18), { tone: "mid", crease: "none" })
    : S(k.slabOf({ x: x - w / 2 - 0.7, y: y - d / 2 - 0.7, w: w + 1.4, d: d + 1.4, r: 0.8 }, z, socket, P, 2), { tone: "mid", crease: "none" }));
  const geo = JSON.stringify({ x, y, z, shape, r, w, d, h, socket, headroom: spec.headroom ?? 0.6 });
  out.push(`<g class="wb-tube-fill" data-tube-fill="${name}" data-tube-geo='${geo}'>${tubeFill(P, spec, value, lit)}</g>`);
  if (shape === "round") {
    // the silhouette: the tube's left and right edges on screen, the rim, and the back of the floor
    const a = (50 * Math.PI) / 180, dx = Math.sin(a) * r, dy = -Math.cos(a) * r;
    const sides = [1, -1].map((sg) => k.segment([x + sg * dx, y + sg * dy, floor], [x + sg * dx, y + sg * dy, top], P)).join("");
    out.push(Ln(sides + k.ring(x, y, r, top, P, 20), { tone: "lo" }), Ln(k.sideArc(x, y, r, floor, P, 16), { tone: "faint" }));
  } else {
    const g = { x: x - w / 2, y: y - d / 2, w, d, r: 0.8 };
    const edges = [[g.x, g.y + g.d], [g.x + g.w, g.y + g.d], [g.x + g.w, g.y]].map(([ex, ey]) => k.segment([ex, ey, floor], [ex, ey, top], P)).join("");
    out.push(Ln(k.planOutline(g, top, P) + edges, { tone: "mid" }), Ln(k.lineOnTop([g.x + 1.2, g.y + g.d], [g.x + 1.2, g.y + g.d], top, P), { tone: "faint" }));
  }
  return `<g class="wb-tube" data-tube="${name}">${out.join("")}</g>`;
}

// ---------- cabinet ----------
// A cabinet of drawers on its front (the +y face): a body with a lid line, an optional plinth, and a grid of drawers
// (cols × rows, drawer 0 at the top left). Each drawer is drawn in, and out by `pull` with its sides showing; the
// live code slides one out and lights it (WB.cabinet(svg, name).pull(i, out, { lit })). labels: a word per drawer,
// on its left; without them the handle sits in the middle.
//   cabinet(P, { x: -102, y: -82, w: 94, d: 18, h: 36, drawers: { cols: 6, rows: 4 }, pull: 2, name: "btree" })
// cabinetDrawer(spec, i): drawer i's left x, bottom z, width, height and the cabinet's front y. drawers.pad is the margin
// at the sides (and top and bottom unless given), gap between drawers (vgap between rows, if different).
export function cabinetDrawer({ x, y, w, d, h, z = 0, plinth = 0, drawers: { cols = 1, rows = 1, pad = 3, gap = 1.4, vgap = gap, top = pad, bottom = pad } = {} }, i) {
  const dw = (w - 2 * pad - (cols - 1) * gap) / cols, z0 = z + plinth + bottom, dh = (h - bottom - top - (rows - 1) * vgap) / rows;
  const col = i % cols, row = Math.floor(i / cols);
  return { x: x + pad + col * (dw + gap), z: z0 + (rows - 1 - row) * (dh + vgap), w: dw, h: dh, front: y + d };
}
export function cabinet(P, spec) {
  const { x, y, w, d, h, z = 0, r = 1.4, plinth = 0, drawers = {}, pull = 5, labels = [], labelSize = 3, name = "", lid = true } = spec;
  const out = [];
  if (plinth > 0) out.push(S(k.slabOf(k.insetPlan({ x, y, w, d, r }, 1.5), z, plinth, P, 3), { tone: "lo" }));
  const top = z + plinth + h;
  out.push(S(k.slabOf({ x, y, w, d, r }, z + plinth, h, P, 3, 0.5), { tone: "mid", inner: lid ? Ln(k.planOutline(k.insetPlan({ x, y, w, d, r }, 2), top, P), { tone: "faint" }) : "" }));
  const n = (drawers.cols ?? 1) * (drawers.rows ?? 1), shut = [], pulled = [];
  for (let i = 0; i < n; i++) {
    const dr = cabinetDrawer(spec, i);
    const at = (dy) => {
      const fy = dr.front + dy, parts = [S(k.slabOf({ x: dr.x, y: fy - 1, w: dr.w, d: 1.4 + Math.max(0, dy), r: 0.4 }, dr.z, dr.h, P, 2, 0.2), { tone: "hi", crease: "lo" })];
      const label = labels[i];
      const hx = label ? [dr.x + dr.w * 0.55, dr.x + dr.w - 2.4] : [dr.x + dr.w / 2 - 2.4, dr.x + dr.w / 2 + 2.4];
      if (label) parts.push(faceText(P, [dr.x + 2, fy + 0.4, dr.z + dr.h / 2 - labelSize * 0.36], label, { size: labelSize, tone: "hi" }));
      parts.push(Ln(k.segment([hx[0], fy + 0.4, dr.z + dr.h * 0.55], [hx[1], fy + 0.4, dr.z + dr.h * 0.55], P), { tone: "mid" }));
      return parts.join("");
    };
    shut.push(`<g data-cab-drawer="${i}" data-drawer-state="in">${at(0)}</g>`);
    pulled.push([k.depthOf([dr.x + dr.w / 2, dr.front + pull, dr.z + dr.h / 2], P), `<g data-cab-drawer="${i}" data-drawer-state="out" data-off>${at(pull)}</g>`]);
  }
  // every drawer shut first, then the pulled-out ones (nearest last): one sticking out covers its neighbours
  pulled.sort((a, b) => a[0] - b[0]);
  return `<g class="wb-cabinet" data-cabinet="${name}">${out.join("")}${shut.join("")}${pulled.map((e) => e[1]).join("")}</g>`;
}

// ---------- variants ----------
// One object with several drawings (a waiter idle / carrying / waiting): only `current` shows.
// Switch in the browser with WB.pose(svg, name, key).
//   variants("waiter-2", { idle: person(P, at), carry: person(P, at, { holding: "tray" }) }, "idle")
export function variants(name, drawings, current) {
  const keys = Object.keys(drawings);
  const on = current ?? keys[0];
  return `<g class="wb-variants" data-variants="${name}">${keys.map((key) => `<g data-variant="${key}"${key === on ? "" : " data-off"}>${drawings[key]}</g>`).join("")}</g>`;
}

// CSS for the parts above; page.mjs includes it on every page.
export const PARTS_CSS = `
.wb-wheel{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.7}
.wb-digit{fill:none;stroke:var(--anatomy-strong);stroke-width:1.25;stroke-linecap:round;stroke-linejoin:round}
.wb-digit[data-size=l]{stroke-width:2}
.wb-digit[data-size=s]{stroke-width:.95}
.wb-needle{fill:none;stroke:var(--anatomy-strong);stroke-width:1.4;stroke-linecap:round}
.wb-meter-face{fill:var(--anatomy-page);stroke:none}
.wb-meter-zone{fill:var(--anatomy-faint);stroke:var(--anatomy-lo);stroke-width:.5}
.wb-pennant{fill:var(--anatomy-paper);stroke:var(--anatomy-mid);stroke-width:.7;stroke-linejoin:round}
.wb-pennant[data-lit]{fill:var(--anatomy-lit);stroke:var(--anatomy-lit)}
.iso-face-text[data-tone="on-lit"]{fill:var(--anatomy-strong)}
[data-variant][data-off]{display:none}
.wb-gate [data-off],.wb-bin [data-off],.wb-cabinet [data-off]{display:none}
.wb-rack [data-rack-slot][data-marked]{stroke:var(--anatomy-lit);stroke-width:1.4}
`;

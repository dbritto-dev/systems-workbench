// Builds parts-gallery.html: every shared part from parts.mjs, in light and dark, at two sizes,
// with the live helpers (WB.counter, WB.dial, WB.meter, WB.pose) running.  node parts-gallery.mjs
import { writeFileSync } from "node:fs";
import * as k from "./kit.mjs";
import * as p from "./parts.mjs";
import { clientScript, esc } from "./page.mjs";

const W = 420, H = 260;
const S = (paths, style) => k.solidSvg(paths, style);
const block = (P, plan, h, style = {}) => S(k.slabOf({ r: 1.2, ...plan }, 0, h, P, 3, 0.4), { tone: "mid", ...style });
const floor = (P, plan) => S(k.slabOf({ r: 3, ...plan }, -4, 4, P, 4, 0.6), { tone: "mid" }) + k.lineSvg(k.planOutline(k.insetPlan({ r: 3, ...plan }, 3), 0, P), { tone: "lo" });

// A scene: a floor plan, extra points to fit (tall parts), and the body drawn on it.
function scene(plan, tall, body) {
  const P = k.fitProjection([...k.boxCorners(plan, -4, tall)], W, H, { pad: 18 });
  return { P, svg: k.figureSvg({ width: W, height: H, label: "", body: [floor(P, plan), body(P)] }) };
}

const SCENES = [
  {
    id: "counter",
    name: "digitCounter",
    api: 'digitCounter(P, { x, y, z, count, w, h, gap, face: "y" | "x", housing, pad, name, value, size })',
    live: "WB.counter(svg, name, P).set(v)",
    note: "Printed wheels on a vertical face, in a raised housing. Rolls over like an odometer; size (s / m / l) follows the wheel's height on screen.",
    ...scene({ x: -60, y: -40, w: 120, d: 80 }, 40, (P) => [
      block(P, { x: -48, y: -26, w: 56, d: 30 }, 26),
      p.digitCounter(P, { x: -40.5, y: 5.4, z: 6, count: 4, w: 9, h: 13, gap: 1.4, name: "big", value: 2047 }),
      block(P, { x: 20, y: -10, w: 22, d: 34 }, 14),
      p.digitCounter(P, { x: 43.4, y: 15, z: 3.5, count: 3, w: 5.4, h: 7, gap: 0.9, face: "x", pad: 2, name: "side", value: 58 }),
    ].join("")),
  },
  {
    id: "people",
    name: "person · figurine",
    api: 'person(P, [x, y, z], { scale, tone, lit, hat: "cap" | "brim", holding: "tray" | "clipboard" | "slip" | "key", slipText })  ·  figurine(P, [x, y, z], { scale, lit })',
    note: "A standing person for clerks, waiters, inspectors and wardens; a figurine for crowds and queues. Held things face the viewer.",
    ...scene({ x: -70, y: -30, w: 140, d: 60 }, 30, (P) => [
      p.person(P, [-52, -6, 0]),
      p.person(P, [-30, -6, 0], { hat: "cap", holding: "clipboard" }),
      p.person(P, [-8, -6, 0], { holding: "slip", slipText: "40" }),
      p.person(P, [14, -6, 0], { hat: "brim", holding: "key" }),
      p.person(P, [36, -6, 0], { holding: "tray", lit: true }),
      p.figurine(P, [56, 2, 0], { lit: true }), p.figurine(P, [52, 12, 0]), p.figurine(P, [62, 16, 0]),
    ].join("")),
  },
  {
    id: "dials",
    name: "dial · meter",
    api: 'dial(P, { x, y, z, r, h, ticks, every, from, span, label, name, value })  ·  meter(P, { x, y, z, r, face, ticks, zone, name, value })',
    live: "WB.dial(svg, name, P).set(frac)  ·  WB.meter(svg, name, P).set(frac)",
    note: "A dial on top of a drum (stopwatch, round counter, expiry timer: set from/span for a part-turn), and a half-round meter on a face with an optional red zone.",
    ...scene({ x: -60, y: -40, w: 120, d: 80 }, 30, (P) => [
      p.dial(P, { x: -30, y: -6, r: 15, h: 6, ticks: 60, every: 5, label: "ms", name: "stopwatch", value: 0.3 }),
      p.dial(P, { x: 4, y: 22, r: 7, h: 4, ticks: 12, every: 3, from: -Math.PI / 2, span: Math.PI, knurl: false, name: "small", value: 0.6 }),
      block(P, { x: 18, y: -30, w: 32, d: 22 }, 22),
      p.meter(P, { x: 34, y: -8, z: 5, r: 11, zone: 0.75, name: "load", value: 0.4 }),
    ].join("")),
  },
  {
    id: "cards",
    name: "card · plaque",
    api: 'card(P, { x, y, z, w, h, face, text, sub, clip, lit })  ·  plaque(P, { x, y, z, w, d, text, along, lit })',
    note: "Upright cards with printed text: tickets on a rail (clip), slips, tags; and plaques lying on a top face (shelf numbers, station names).",
    ...scene({ x: -60, y: -40, w: 120, d: 80 }, 34, (P) => [
      S(k.cylinder(-50, -14, 0.8, 0, 28, P, 10), { tone: "mid", crease: "none" }), S(k.cylinder(10, -14, 0.8, 0, 28, P, 10), { tone: "mid", crease: "none" }),
      S(k.slabOf({ x: -51, y: -15, w: 62, d: 2, r: 0.5 }, 28, 1.6, P, 2), { tone: "mid", crease: "none" }),
      p.card(P, { x: -44, y: -13, z: 15, w: 10, h: 13, text: "A7", sub: "try 2", clip: true }),
      p.card(P, { x: -30, y: -13, z: 15, w: 10, h: 13, text: "A8", sub: "paid", clip: true, lit: true }),
      p.card(P, { x: -16, y: -13, z: 15, w: 10, h: 13, text: "B2", clip: true }),
      block(P, { x: 20, y: -26, w: 30, d: 22 }, 12),
      p.plaque(P, { x: 26, y: -21, z: 12, w: 14, d: 10, text: "3" }),
      block(P, { x: -20, y: 10, w: 26, d: 20 }, 4),
      p.card(P, { x: 6.6, y: 26, z: 4, w: 12, h: 9, face: "x", text: "v11", lit: true }),
    ].join("")),
  },
  {
    id: "signs",
    name: "pennant · sign · lamp · keyPart",
    api: 'pennant(P, { x, y, z, height, length, drop, face, lit })  ·  sign(P, { x, y, z, w, h, face, text, posts, lit })  ·  lamp(P, [x, y, z], { r, lit })  ·  keyPart(P, [x, y, z], { scale, lit })',
    note: "A pennant on a pole (suspected, flagged), a sign on posts or a wall (open / closed), a lamp with a round bulb, a key.",
    ...scene({ x: -64, y: -40, w: 128, d: 80 }, 40, (P) => [
      block(P, { x: -56, y: -30, w: 24, d: 22 }, 14),
      p.pennant(P, { x: -44, y: -19, z: 14, height: 12, lit: true }),
      p.sign(P, { x: -24, y: -4, z: 8, w: 22, h: 8, text: "OPEN", lit: true }),
      p.sign(P, { x: 4, y: -4, z: 8, w: 22, h: 8, text: "CLOSED" }),
      p.lamp(P, [40, -26, 0], { r: 4, lit: true }), p.lamp(P, [44, 14, 0], { r: 4 }),
      p.keyPart(P, [-40, 20, 6], { scale: 1.6, lit: true }),
    ].join("")),
  },
  {
    id: "variants",
    name: "variants",
    api: 'variants(name, { key: svg, ... }, current)',
    live: "WB.pose(svg, name, key)",
    note: "One object, several drawings; only the current one shows. Here a waiter cycles idle, carrying and checking.",
    ...scene({ x: -40, y: -30, w: 80, d: 60 }, 30, (P) => p.variants("waiter", {
      idle: p.person(P, [0, 0, 0]),
      tray: p.person(P, [0, 0, 0], { holding: "tray", lit: true }),
      clipboard: p.person(P, [0, 0, 0], { holding: "clipboard", hat: "cap" }),
    }, "idle")),
  },
  {
    id: "litfill",
    name: "Proposal: litFill",
    api: "litFill(svg)  + LIT_FILL_CSS in the lesson's css",
    note: "Left to right: unlit, lit as the kit draws it today (in light theme only the outline darkens), and lit-fill (filled with the lit colour, so a small token reads at a glance in both themes).",
    ...scene({ x: -60, y: -30, w: 120, d: 60 }, 20, (P) => {
      const token = (x, lit) => S(k.cylinder(x, -8, 6, 0, 4, P, 24, 0.4), { tone: "hi", crease: "lo", lit })
        + S(k.slabOf({ x: x - 5, y: 10, w: 10, d: 1, r: 0.2 }, 0, 12, P, 2), { tone: "hi", crease: "none", lit })
        + p.faceText(P, [x, 11, 4], "7", { size: 6, tone: lit ? "on-lit" : "hi", anchor: "middle" });
      return [token(-38, false), token(0, true), p.litFill(token(38, true))].join("");
    }),
  },
];

const plate = (s, theme) => `<div class="iso shot" ${theme ? `data-theme="${theme}"` : ""} data-scene="${s.id}"><span class="corner">${theme === "light" ? "Light" : "Dark"}</span>${s.svg}</div>`;
const projections = Object.fromEntries(SCENES.map((s) => [s.id, s.P]));

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Workbench Parts</title>
<style>${k.ISO_CSS}${p.PARTS_CSS}${p.LIT_FILL_CSS}
*{box-sizing:border-box}
body{margin:0;background:#e9e9e6;color:#222;font:14px/1.55 ui-sans-serif,system-ui,sans-serif}
main{width:min(1100px,100% - 32px);margin:40px auto 80px}
h1{font-size:30px;margin:0 0 6px}
.intro{max-width:70ch;color:#555;margin:0 0 28px}
section{margin:0 0 34px}
h2{font:600 16px/1.3 ui-monospace,Menlo,monospace;margin:0 0 4px}
.api,.live{font:12px/1.5 ui-monospace,Menlo,monospace;color:#444;margin:0;overflow-wrap:anywhere}
.live{color:#777}
.note{margin:4px 0 10px;color:#555;max-width:80ch}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.shot{position:relative;background:var(--anatomy-card);border:1px solid #0002;padding:22px 8px 8px}
.shot .corner{position:absolute;top:6px;left:10px;font:10px ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--anatomy-muted)}
.small{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px}
.small .shot{padding:14px 4px 4px}
@media (max-width:700px){.pair{grid-template-columns:1fr}.small{grid-template-columns:repeat(2,1fr)}}
</style></head><body><main>
<h1>Workbench parts</h1>
<p class="intro">The shared parts in <code>workbench/parts.mjs</code>, drawn with the Anatomy kit. Each part takes the projection first and world units, and returns SVG. The live ones (counters, dials, meters, variants) are updated here by the browser helpers in <code>client.js</code>. Bottom row: every scene again at a quarter of the width, to check the parts still read small.</p>
${SCENES.map((s) => `<section><h2>${esc(s.name)}</h2><p class="api">${esc(s.api)}</p>${s.live ? `<p class="live">live: ${esc(s.live)}</p>` : ""}<p class="note">${esc(s.note)}</p><div class="pair">${plate(s, "light")}${plate(s, "")}</div></section>`).join("")}
<section><h2>Small</h2><div class="small">${SCENES.flatMap((s) => [plate(s, "light"), plate(s, "")]).join("")}</div></section>
</main>
<script type="module">${clientScript().replace(/<\/(script)/gi, "<\\/$1")}
const P = ${JSON.stringify(projections)};
const each = (id, fn) => document.querySelectorAll('[data-scene="' + id + '"] svg').forEach((svg) => fn(svg, P[id]));
const parts = [];
each("counter", (svg, Pr) => parts.push({ big: WB.counter(svg, "big", Pr), side: WB.counter(svg, "side", Pr) }));
const dials = []; each("dials", (svg, Pr) => dials.push({ sw: WB.dial(svg, "stopwatch", Pr), sm: WB.dial(svg, "small", Pr), load: WB.meter(svg, "load", Pr) }));
const waiters = []; each("variants", (svg) => waiters.push(svg));
let t = 0, n = 2047, pose = 0, still = matchMedia("(prefers-reduced-motion: reduce)").matches;
function frame() {
  t += 1 / 60;
  if (Math.floor(t * 4) !== Math.floor((t - 1 / 60) * 4)) { n++; parts.forEach((c) => { c.big.set(n); c.side.set(n % 1000); }); }
  dials.forEach((d) => { d.sw.set((t / 6) % 1); d.sm.set(0.5 + 0.5 * Math.sin(t)); d.load.set(0.55 + 0.4 * Math.sin(t * 0.8)); });
  const pz = Math.floor(t / 1.5) % 3; if (pz !== pose) { pose = pz; waiters.forEach((svg) => WB.pose(svg, "waiter", ["idle", "tray", "clipboard"][pz])); }
  requestAnimationFrame(frame);
}
if (!still) requestAnimationFrame(frame);
</script></body></html>`;
writeFileSync(new URL("./parts-gallery.html", import.meta.url), html);
console.log("wrote parts-gallery.html", Math.round(html.length / 1024), "KB");

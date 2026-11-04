// Browser helpers every lesson shares, as a real module (the standalone pages inline workbench/client.js instead).
// Lessons import what they use; the bundler keeps one copy for the whole site.
import { iso, pathOf, translateAlong } from "../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import { digitPath, digitsOf, facePoint } from "../../workbench/digits.mjs";

export type Projection = { origin: [number, number]; scale: number; azimuth?: number; elevation?: number };
type Point3 = [number, number, number];
export type Bi = string | { en: string; es: string };

// Guarded so the module can also be imported at build time (Node has no matchMedia).
export const still = (typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false }) as MediaQueryList;
export { digitsOf };

// ---------- language ----------
// A page carries one language (data-lang on <html>). L(v) picks it from a { en, es } value; L(en, es) from a pair.
export const lang = (): "en" | "es" => (document.documentElement.getAttribute("data-lang") === "es" ? "es" : "en");
export function L(v: Bi, es?: string): string {
  if (es !== undefined) return lang() === "es" ? es : (v as string);
  return v != null && typeof v === "object" ? v[lang()] : v;
}
export const T = (en: string, es: string) => ({ en, es });

// ---------- faces ----------
export const faceRectY = (P: Projection, x0: number, x1: number, y: number, z0: number, z1: number) =>
  pathOf(([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]] as Point3[]).map((p) => iso(p, P)), true);
export const faceRectX = (P: Projection, x: number, y0: number, y1: number, z0: number, z1: number) =>
  pathOf(([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]] as Point3[]).map((p) => iso(p, P)), true);

// ---------- live parts drawn by workbench/parts.mjs; each is found by name inside the figure's svg ----------
const geoOf = (el: Element) => JSON.parse(el.getAttribute("data-geo")!);

/** Move an SVG group to a point in the figure's space. */
export const place = (el: Element, P: Projection, p: Point3) => el.setAttribute("transform", translateAlong(P, p));

/** A digit counter: set(v) redraws only the wheels whose digit changed; setClamped(v) keeps v within what the
 *  wheels can show (0 to 99…9) instead of wrapping. */
export function counter(root: ParentNode, name: string, P: Projection) {
  const el = root.querySelector(`[data-counter="${name}"]`)!;
  const g = geoOf(el), wheels = [...el.querySelectorAll("[data-wheel]")], shown: number[] = [];
  const set = (v: number) => {
    digitsOf(v, g.cells.length).forEach((d: number, j: number) => {
      if (shown[j] !== d) { shown[j] = d; wheels[j].setAttribute("d", digitPath(iso, P, g.cells[j], d, g.face)); }
    });
  };
  const max = 10 ** g.cells.length - 1;
  return { el, set, setClamped: (v: number) => set(Math.max(0, Math.min(Math.floor(v), max))) };
}
/** The needle of a dial: set(frac) turns it to that share of its sweep. */
export function dial(root: ParentNode, name: string, P: Projection) {
  const el = root.querySelector(`[data-dial="${name}"]`)!, g = geoOf(el);
  return {
    el,
    set(frac: number) {
      const a = g.from + Math.max(0, Math.min(1, frac)) * g.span, sx = Math.sin(a), sy = -Math.cos(a);
      el.setAttribute("d", pathOf([iso([g.x - sx * g.r * 0.22, g.y - sy * g.r * 0.22, g.z], P), iso([g.x + sx * g.r, g.y + sy * g.r, g.z], P)]));
    },
  };
}
/** The needle of a half-round meter: set(frac) swings it from left (0) to right (1). */
export function meter(root: ParentNode, name: string, P: Projection) {
  const el = root.querySelector(`[data-meter="${name}"]`)!, g = geoOf(el);
  return {
    el,
    set(frac: number) {
      const a = Math.PI * (1 - Math.max(0, Math.min(1, frac)));
      el.setAttribute("d", pathOf([iso(facePoint(g.face, g, 0, 0), P), iso(facePoint(g.face, g, Math.cos(a) * g.r, Math.sin(a) * g.r), P)]));
    },
  };
}
/** Show one drawing of a variants() group and hide the others. */
export function pose(root: ParentNode, name: string, key: string) {
  const el = root.querySelector(`[data-variants="${name}"]`)!;
  el.querySelectorAll<HTMLElement>(":scope > [data-variant]").forEach((v) => { if (v.dataset.variant === key) v.removeAttribute("data-off"); else v.setAttribute("data-off", ""); });
}

// ---------- the frame loop: runs only while the figure is on screen and not paused ----------
export interface Loop { readonly paused: boolean; setPaused(on: boolean): void; toggle(): void; run(): void }
export function loop({ stage, step, paused = still.matches, maxDt = 1 / 20, onPause }: { stage: Element; step: (dt: number) => void; paused?: boolean; maxDt?: number; onPause?: (on: boolean) => void }): Loop {
  let frame = 0, last = 0, visible = false, isPaused = paused;
  const tick = (t: number) => {
    const dt = last ? Math.min((t - last) / 1000, maxDt) : 1 / 60;
    last = t;
    if (!isPaused) step(dt);
    frame = visible && !isPaused ? requestAnimationFrame(tick) : 0;
  };
  const run = () => { if (!frame && visible && !isPaused) { last = 0; frame = requestAnimationFrame(tick); } };
  new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; run(); }, { rootMargin: "80px 0px" }).observe(stage);
  const api: Loop = {
    get paused() { return isPaused; },
    setPaused(on) { isPaused = on; onPause?.(on); run(); },
    toggle() { api.setPaused(!isPaused); },
    run,
  };
  return api;
}


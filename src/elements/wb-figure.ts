// <wb-figure>: a lesson's figure plate (markup from components/lesson/FigurePlate.astro): the stage holding the
// machine's SVG, the corner labels, the live readout and, on a phone, the lens.
//
//   figure.stage        the .iso-stage element (the SVG's parent, focusable)
//   figure.svg          the machine's <svg>
//   figure.say(text)    write the readout corner, touching the DOM only on change
//   figure.focusOn(id)  point the phone lens's close-up at a region (plate.regions), or null to follow what is lit
//                       (src/lib/lens.ts; on a phone the stage is the close-up, so .svg is the machine in either case)
//
// Space on the focused stage sends a cancelable "wb-action" event, { name: "pause" }; if a listener handles it
// (preventDefault), the key doesn't scroll the page.
import type { ActionDetail } from "./wb-controls";
import { LENS_MEDIA, lensHeight, lensScale, viewOn, type Box } from "../lib/lens";

export class WbFigure extends HTMLElement {
  #lens: Lens | null = null;
  get stage() { return this.querySelector<HTMLElement>(".iso-stage")!; }
  get svg() { return this.stage.querySelector("svg")!; }
  say(text: string) {
    const el = this.querySelector("[data-readout]");
    if (el && el.textContent !== text) el.textContent = text;
  }
  /** The phone lens's close-up shows region `id` (one of plate.regions), or follows what is lit (null). */
  focusOn(id: string | null) { this.#lens?.select(id ?? FOLLOW, false); }
  connectedCallback() {
    this.addEventListener("keydown", this.#key);
    const plate = this.querySelector<HTMLElement>(".iso-plate[data-lens]");
    if (plate && !this.#lens) this.#lens = new Lens(plate, this.svg);
  }
  disconnectedCallback() { this.removeEventListener("keydown", this.#key); this.#lens?.stop(); this.#lens = null; }
  #key = (e: KeyboardEvent) => {
    if (e.key !== " " || e.target !== this.stage) return;
    const detail: ActionDetail = { name: "pause" };
    if (!this.dispatchEvent(new CustomEvent("wb-action", { bubbles: true, cancelable: true, detail }))) e.preventDefault();
  };
}

const FOLLOW = "follow";
/** How often what is lit is looked up (ms), how long the close-up stays put after a move before following again,
 *  and how far inside the view a lit part may wander before the view follows it (share of the view, each side). */
const SAMPLE_MS = 250, DWELL_MS = 1200, MARGIN = 0.12;
/** The overview's copy is taken again this often (ms), and shortly after the reader changes a control: a copy of a
 *  large machine costs tens of ms of layout and paint, so it is a map that catches up, not a live picture. */
const SNAP_MS = 5000, SNAP_AFTER_INPUT_MS = 400;
// Lit solids (and pennants): what a lesson lights to say "follow this". Lines drawn in the lit tone (needles, rings)
// are ink, not a pointer, so they don't pull the view.
const LIT = "[data-lit]";
const INPUT = ["wb-change", "wb-action", "wb-watch"];

/** Astryx's standard easing, cubic-bezier(0.24, 1, 0.4, 1) (--ux-ease-standard), solved for x by bisection. */
const ease = (() => {
  const b = (a1: number, a2: number, t: number) => 3 * a1 * t * (1 - t) ** 2 + 3 * a2 * t * t * (1 - t) + t ** 3;
  return (x: number) => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (b(0.24, 0.4, m) < x) lo = m; else hi = m; }
    return b(1, 1, (lo + hi) / 2);
  };
})();

/** The lens on one plate. Off above LENS_MAX px and while the plate is off screen. On: what the close-up shows is looked
 *  up every SAMPLE_MS and it eases there over --ux-duration-medium: one shift of the machine's <svg> per animation
 *  frame, only while it moves. The overview's still copy of the machine is taken again every SNAP_MS and
 *  after the reader's input, when the browser is idle; nothing is copied per frame. */
class Lens {
  plate: HTMLElement; stage: HTMLElement; svg: SVGSVGElement; overview: HTMLElement; frame: HTMLElement;
  control: (HTMLElement & { value: string }) | null;
  minText: number | null; regions: { id: string; box: Box }[];
  mq = matchMedia(LENS_MEDIA);
  still = matchMedia("(prefers-reduced-motion: reduce)");
  io: IntersectionObserver; ro: ResizeObserver; mo: MutationObserver;
  visible = false; on = false; mode = FOLLOW;
  bounds: Box; size: [number, number] = [1, 1]; scale = 1; cur: Box; tween: { from: Box; to: Box; t0: number; dur: number } | null = null;
  raf = 0; timer = 0; snapTimer = 0; movedAt = -Infinity; lit = new Set<Element>(); anchor: Element[] = [];

  constructor(plate: HTMLElement, svg: SVGSVGElement) {
    this.plate = plate; this.svg = svg;
    this.stage = svg.parentElement as HTMLElement;
    this.overview = plate.querySelector(".iso-lens-overview")!;
    this.frame = plate.querySelector(".iso-lens-frame")!;
    this.control = plate.querySelector("ax-segmented-control");
    const data = JSON.parse(plate.dataset.lens || "{}");
    this.minText = data.minText ?? null;
    this.regions = data.regions ?? [];
    this.bounds = this.#viewBox();
    this.cur = this.regions[0]?.box ?? this.bounds;
    this.control?.addEventListener("astryx-change", this.#pick);
    this.mq.addEventListener("change", this.#update);
    this.io = new IntersectionObserver((e) => { this.visible = e.some((x) => x.isIntersecting); this.#update(); }, { rootMargin: "200px 0px" });
    this.io.observe(plate);
    this.ro = new ResizeObserver(() => this.#resize());
    // A lesson that crops its own figure (a viewBox of its own) moves the bounds.
    this.mo = new MutationObserver(() => { this.bounds = this.#viewBox(); this.size = [1, 1]; this.#resize(); this.#snap(); });
    this.mo.observe(svg, { attributes: true, attributeFilter: ["viewBox"] });
    this.lesson = plate.closest("wb-lesson");
    for (const t of INPUT) this.lesson?.addEventListener(t, this.#soon);
    this.#update();
  }
  lesson: Element | null = null;
  /** After a control, an action or a Watch, the overview catches up shortly. */
  #soon = () => { if (!this.on) return; clearTimeout(this.snapTimer); this.snapTimer = window.setTimeout(this.#idleSnap, SNAP_AFTER_INPUT_MS); };
  #idleSnap = () => { const idle = (window as any).requestIdleCallback; if (idle) idle(this.#snap, { timeout: 1000 }); else this.#snap(); };
  stop() {
    this.io.disconnect(); this.ro.disconnect(); this.mo.disconnect();
    this.mq.removeEventListener("change", this.#update);
    this.control?.removeEventListener("astryx-change", this.#pick);
    for (const t of INPUT) this.lesson?.removeEventListener(t, this.#soon);
    this.#off();
  }

  /** "follow" or a region's id. A user's pick moves at once; so does live code's (root.focusOn). */
  select(mode: string, fromControl: boolean) {
    if (mode !== FOLLOW && !this.regions.some((r) => r.id === mode)) return;
    this.mode = mode;
    if (!fromControl && this.control && this.control.value !== mode) this.control.value = mode;
    this.movedAt = -Infinity; this.anchor = [];
    if (this.on) this.#sample(true);
  }

  #pick = (e: Event) => { if (e.target === this.control) this.select(String((e as CustomEvent).detail.value), true); };
  #viewBox = (): Box => { const b = this.svg.viewBox.baseVal; return [b.x, b.y, b.width, b.height]; };
  #update = () => {
    const want = this.mq.matches && this.visible;
    if (!this.mq.matches) this.#unstyle();
    if (want === this.on) return;
    if (want) {
      this.on = true;
      this.ro.observe(this.stage);
      this.size = [1, 1];
      this.#resize();
      this.#snap();
      this.#tick();
    } else this.#off();
  };
  #off() {
    this.on = false;
    this.ro.disconnect();
    clearTimeout(this.timer); clearTimeout(this.snapTimer); cancelAnimationFrame(this.raf); this.raf = 0;
  }
  /** Back to the desktop figure: the inline size and shift go (the stylesheet's phone rules no longer apply). */
  #unstyle() { for (const k of ["width", "left", "top"]) this.svg.style.removeProperty(k); this.tween = null; }

  /** The overview: a still copy of the machine, without ids, name or focus (the stage has those). */
  #snap = () => {
    clearTimeout(this.snapTimer);
    if (!this.on) return;
    const copy = this.svg.cloneNode(true) as SVGSVGElement;
    for (const a of ["id", "role", "aria-label", "data-aria-en", "data-aria-es", "style", "tabindex"]) copy.removeAttribute(a);
    copy.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
    copy.setAttribute("aria-hidden", "true"); copy.setAttribute("focusable", "false");
    const old = this.overview.querySelector("svg");
    if (old) old.replaceWith(copy); else this.overview.prepend(copy);
    this.snapTimer = window.setTimeout(this.#idleSnap, SNAP_MS);
  };
  #resize() {
    const width = this.stage.getBoundingClientRect().width;
    if (!width || !this.on) return;
    const scale = lensScale(width, this.bounds[2], this.minText);
    const height = lensHeight(width, scale, this.regions);
    const size: [number, number] = [width / scale, height / scale];
    if (Math.abs(size[0] - this.size[0]) < 0.01 && Math.abs(size[1] - this.size[1]) < 0.01) return;
    this.size = size; this.scale = scale;
    this.stage.style.setProperty("--lens-ar", `${Math.round(width)}/${Math.round(height)}`);
    this.svg.style.width = `${this.bounds[2] * scale}px`;
    this.tween = null;
    this.#set(viewOn(this.cur, size, this.bounds));
    this.#sample(true);
  }
  #tick = () => {
    if (!this.on) return;
    this.#sample(false);
    this.timer = window.setTimeout(this.#tick, SAMPLE_MS);
  };

  /** Where the close-up should look now: the chosen region, else what is lit. */
  #sample(now: boolean) {
    let target: Box | null = null;
    if (this.mode !== FOLLOW) target = this.regions.find((r) => r.id === this.mode)!.box;
    else target = this.#litTarget();
    if (!target) return;
    // A region is shown centred (as far as the figure's edges allow), whatever the view showed before.
    if (this.mode !== FOLLOW) {
      const to = viewOn(target, this.size, this.bounds), at = this.tween?.to ?? this.cur;
      if (to.some((v, i) => Math.abs(v - at[i]) > 0.5)) this.#go(to);
      return;
    }
    const [vx, vy, vw, vh] = this.tween?.to ?? this.cur;
    const mx = vw * MARGIN, my = vh * MARGIN;
    const inside = target[0] >= vx + mx && target[1] >= vy + my && target[0] + target[2] <= vx + vw - mx && target[1] + target[3] <= vy + vh - my;
    const fits = target[2] <= vw - 2 * mx && target[3] <= vh - 2 * my;
    // Already in view (or as much in view as it can be): stay. Following lit parts moves at most once per DWELL_MS.
    if (inside || (!fits && this.#covers(target))) return;
    const t = performance.now();
    if (!now && t - this.movedAt < DWELL_MS) return;
    this.movedAt = t;
    this.#go(viewOn(target, this.size, this.bounds));
  }
  /** A view that already shows the middle of a box too big for it doesn't chase it. */
  #covers(b: Box) {
    const [vx, vy, vw, vh] = this.tween?.to ?? this.cur;
    const cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
    return cx > vx + vw * 0.3 && cx < vx + vw * 0.7 && cy > vy + vh * 0.3 && cy < vy + vh * 0.7;
  }

  /** The lit parts that are drawn: all of them if they fit in the view; else the ones lit most recently, kept until
   *  they go out, so the view doesn't hop between two far-apart lit parts. */
  #litTarget(): Box | null {
    const now = new Set<Element>();
    const boxes = new Map<Element, Box>();
    for (const el of this.svg.querySelectorAll<SVGGraphicsElement>(LIT)) {
      const box = this.#boxOf(el);
      if (box) { now.add(el); boxes.set(el, box); }
    }
    const fresh = [...now].filter((e) => !this.lit.has(e));
    this.lit = now;
    if (!now.size) { this.anchor = []; return null; }
    const all = union([...boxes.values()]);
    const [w, h] = this.size;
    if (all[2] <= w * (1 - 2 * MARGIN) && all[3] <= h * (1 - 2 * MARGIN)) return all;
    if (fresh.length) this.anchor = fresh;
    this.anchor = this.anchor.filter((e) => now.has(e));
    if (!this.anchor.length) this.anchor = [[...now][0]];
    const anchored = union(this.anchor.map((e) => boxes.get(e)!));
    return anchored[2] <= w && anchored[3] <= h ? anchored : boxes.get(this.anchor[0])!;
  }
  #boxOf(el: SVGGraphicsElement): Box | null {
    // Drawn at all? (checkVisibility() says yes for an SVG element under display:none in Chromium; a box says no.)
    if (!el.getClientRects().length) return null;
    // From the element's own units to the figure's viewBox units (getCTM would include the viewBox's scaling).
    const b = el.getBBox(), e = el.getScreenCTM(), s = this.svg.getScreenCTM();
    if (!e || !s || (!b.width && !b.height)) return null;
    const m = s.inverse().multiply(e);
    const xs: number[] = [], ys: number[] = [];
    for (const [x, y] of [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]) {
      xs.push(m.a * x + m.c * y + m.e); ys.push(m.b * x + m.d * y + m.f);
    }
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    return [x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0];
  }

  #go(to: Box) {
    if (this.still.matches) { this.tween = null; this.#set(to); return; }
    // The token reads back as written or normalised ("410ms" or ".41s").
    const raw = getComputedStyle(this.plate).getPropertyValue("--ux-duration-medium").trim();
    const dur = (parseFloat(raw) * (/ms$/.test(raw) ? 1 : /s$/.test(raw) ? 1000 : 1)) || 410;
    this.tween = { from: this.cur, to, t0: performance.now(), dur };
    if (!this.raf) this.raf = requestAnimationFrame(this.#frame);
  }
  #frame = (t: number) => {
    this.raf = 0;
    const tw = this.tween;
    if (!tw || !this.on) return;
    const k = Math.min(1, (t - tw.t0) / tw.dur), e = ease(k);
    this.#set(tw.from.map((v, i) => v + (tw.to[i] - v) * e) as Box);
    if (k < 1) this.raf = requestAnimationFrame(this.#frame);
    else this.tween = null;
  };
  /** One shift of the machine's <svg> in the close-up (left/top: see LENS_CSS), and the overview's frame to match. */
  #set(v: Box) {
    this.cur = v;
    const [bx, by, bw, bh] = this.bounds, k = this.scale;
    this.svg.style.left = `${(-(v[0] - bx) * k).toFixed(2)}px`;
    this.svg.style.top = `${(-(v[1] - by) * k).toFixed(2)}px`;
    const s = this.frame.style;
    s.left = `${((v[0] - bx) / bw) * 100}%`; s.top = `${((v[1] - by) / bh) * 100}%`;
    s.width = `${(v[2] / bw) * 100}%`; s.height = `${(v[3] / bh) * 100}%`;
  }
}

const union = (bs: Box[]): Box => {
  const x0 = Math.min(...bs.map((b) => b[0])), y0 = Math.min(...bs.map((b) => b[1]));
  const x1 = Math.max(...bs.map((b) => b[0] + b[2])), y1 = Math.max(...bs.map((b) => b[1] + b[3]));
  return [x0, y0, x1 - x0, y1 - y0];
};

if (!customElements.get("wb-figure")) customElements.define("wb-figure", WbFigure);

declare global {
  interface HTMLElementTagNameMap {
    "wb-figure": WbFigure;
  }
}

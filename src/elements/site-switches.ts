// <site-switches>: the language links (EN / ES) and the theme radiogroup (Auto / Light / Dark), markup from
// components/Switches.astro.
//
// Theme: Auto follows the device; Light or Dark is forced with data-theme on <html> and remembered in this browser.
// The head of every page applies the remembered theme before first paint (layouts/Base.astro). The group behaves
// like Astryx's SegmentedControl through runtime/roving.ts: one Tab stop on the checked radio, ← → (swapped under
// RTL) wrap, Home and End, selection follows the arrows, Tab-in never changes it, and the "← → to navigate" hint
// shows once. A click selects at release on the same segment (a press that slides off does nothing); choosing the
// checked one does nothing. aria-checked says what is chosen, so nothing is announced. Every switch on the page shows
// the same choice: a change is sent as a "workbench-theme" event on document.
// Language: the links keep the reader's search (?q=) and section (#predict): the href is brought up to date when a
// pointer presses it, focus reaches it, or it is clicked, so a new tab or a copied link keeps them too.
// Press: data-pressed on a segment from pointerdown to its release (switches.css paints the press tint; :active alone
// isn't reliable on touch).
// markTheme() checks the current choice. Switches.astro inlines its source right after the switches, so the right
// radio is checked on the first paint; the element calls it again on every change.
import { roving, type Roving } from "../runtime/roving";

const KEY = "workbench-theme";
const EVENT = "workbench-theme";
type Choice = "auto" | "light" | "dark";

export function setTheme(choice: Choice) {
  const root = document.documentElement;
  if (choice === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  try { if (choice === "auto") localStorage.removeItem(KEY); else localStorage.setItem(KEY, choice); } catch {}
  document.dispatchEvent(new Event(EVENT));
}

/** Checks the theme radio that matches <html data-theme> (none means Auto). Self-contained: Switches.astro
 *  inlines its source, so no imports or outer variables. */
export function markTheme(el: Element) {
  const t = document.documentElement.getAttribute("data-theme");
  const now = t === "light" || t === "dark" ? t : "auto";
  el.querySelectorAll<HTMLButtonElement>("[data-theme-choice]").forEach((b) => {
    const on = String(b.dataset.themeChoice === now);
    if (b.getAttribute("aria-checked") !== on) b.setAttribute("aria-checked", on);
  });
}

// The base class is a stand-in at build time, when Switches.astro imports markTheme in Node.
const Base = (globalThis.HTMLElement ?? Object) as typeof HTMLElement;
export class SiteSwitches extends Base {
  #nav: Roving | null = null;
  #pressed: Element | null = null;
  #mark = () => { markTheme(this); this.#nav?.sync(); };

  connectedCallback() {
    const group = this.querySelector<HTMLElement>(".sw-theme");
    if (group) {
      this.#nav = roving(group, {
        items: "[data-theme-choice]",
        current: () => group.querySelector<HTMLElement>('[aria-checked="true"]'),
        select: (b) => this.#choose(b),
      });
    }
    this.addEventListener("click", this.#click);
    this.addEventListener("pointerdown", this.#down);
    this.addEventListener("focusin", this.#focus);
    document.addEventListener(EVENT, this.#mark);
    this.#mark();
  }
  disconnectedCallback() {
    this.#nav?.destroy();
    this.#nav = null;
    this.removeEventListener("click", this.#click);
    this.removeEventListener("pointerdown", this.#down);
    this.removeEventListener("focusin", this.#focus);
    document.removeEventListener(EVENT, this.#mark);
    this.#release();
  }

  #choose(b: HTMLElement) {
    if (b.getAttribute("aria-checked") === "true" || b.getAttribute("aria-disabled") === "true") return;
    setTheme(b.dataset.themeChoice as Choice);
  }
  /** The link to this page in the other language, with the reader's ?q= and #section. */
  #keepPlace(a: HTMLAnchorElement) {
    const href = a.href.split(/[?#]/)[0] + location.search + location.hash;
    if (a.href !== href) a.href = href;
  }
  #click = (e: MouseEvent) => {
    if (e.defaultPrevented) return;
    const t = e.target as Element;
    const theme = t.closest<HTMLElement>("[data-theme-choice]");
    if (theme) return this.#choose(theme);
    const lang = t.closest<HTMLAnchorElement>("a[data-lang-link]");
    if (lang) this.#keepPlace(lang);
  };
  #focus = (e: FocusEvent) => {
    const lang = (e.target as Element).closest?.<HTMLAnchorElement>("a[data-lang-link]");
    if (lang) this.#keepPlace(lang);
  };
  #down = (e: PointerEvent) => {
    const seg = (e.target as Element).closest(".sw-group > a, .sw-group > button");
    if (!seg) return;
    if (seg instanceof HTMLAnchorElement) this.#keepPlace(seg);
    if (e.button !== 0) return;
    this.#release();
    this.#pressed = seg;
    seg.setAttribute("data-pressed", "");
    addEventListener("pointerup", this.#release, true);
    addEventListener("pointercancel", this.#release, true);
    seg.addEventListener("pointerleave", this.#release);
  };
  #release = () => {
    const seg = this.#pressed;
    if (!seg) return;
    this.#pressed = null;
    seg.removeAttribute("data-pressed");
    removeEventListener("pointerup", this.#release, true);
    removeEventListener("pointercancel", this.#release, true);
    seg.removeEventListener("pointerleave", this.#release);
  };
}

if (globalThis.customElements && !customElements.get("site-switches")) customElements.define("site-switches", SiteSwitches);

declare global {
  interface HTMLElementTagNameMap {
    "site-switches": SiteSwitches;
  }
}

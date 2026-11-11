// <site-switches>: the language links (EN / ES) and the theme switch (Auto / Light / Dark), markup from
// components/Switches.astro. Both are astryx-astro components; this element only adds what is ours.
//
// Theme: an Astryx SegmentedControl (<ax-segmented-control>), which owns the behaviour: one Tab stop on the selected
// segment, ← → / Home / End move and select, a click selects, the "← → to navigate" hint once. On its astryx-change
// this element applies the choice: Auto follows the device; Light or Dark is forced with data-theme on <html> and
// remembered in this browser. The head of every page applies the remembered theme before first paint
// (layouts/Base.astro). Every switch on the page shows the same choice: a change is sent as a "workbench-theme" event
// on document, and the others take it as their value (a programmatic value, so they fire nothing).
// Language: Astryx Links. They keep the reader's search (?q=) and section (#predict): the href is brought up to date
// when a pointer presses it, focus reaches it, or it is clicked, so a new tab or a copied link keeps them too.
// markTheme() selects the segment that matches <html data-theme>. Switches.astro inlines its source right after the
// switches, so the right segment is selected on the first paint, with the attributes the SegmentedControl's element
// reads when it starts.

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

/** The theme chosen now: <html data-theme>, none meaning Auto. */
const current = (): Choice => {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "light" || t === "dark" ? t : "auto";
};

/** Selects the theme segment that matches <html data-theme> (none means Auto), writing what the SegmentedControl
 *  renders for a selected segment: aria-checked, data-selected, the Tab stop, and the hover/press overlay only on
 *  the others. Self-contained: Switches.astro inlines its source, so no imports or outer variables. */
export function markTheme(el: Element) {
  const t = document.documentElement.getAttribute("data-theme");
  const now = t === "light" || t === "dark" ? t : "auto";
  el.querySelectorAll<HTMLElement>('ax-segmented-control [role="radio"][data-value]').forEach((b) => {
    const on = b.dataset.value === now;
    if (b.getAttribute("aria-checked") !== String(on)) b.setAttribute("aria-checked", String(on));
    if (on) b.setAttribute("data-selected", "selected");
    else b.removeAttribute("data-selected");
    b.setAttribute("tabindex", on ? "0" : "-1");
    b.classList.toggle("ax-overlay-bg", !on && b.getAttribute("aria-disabled") !== "true");
  });
}

// The base class is a stand-in at build time, when Switches.astro imports markTheme in Node.
const Base = (globalThis.HTMLElement ?? Object) as typeof HTMLElement;
export class SiteSwitches extends Base {
  /** Another switch changed the theme: show it (the control's value setter fires no event). */
  #sync = () => {
    const control = this.querySelector("ax-segmented-control");
    const Control = customElements.get("ax-segmented-control");
    if (!control) return;
    if (Control && control instanceof Control) {
      const c = control as HTMLElement & { value: string };
      if (c.value !== current()) c.value = current();
    } else markTheme(this);
  };

  connectedCallback() {
    this.addEventListener("astryx-change", this.#change);
    this.addEventListener("click", this.#click);
    this.addEventListener("pointerdown", this.#down);
    this.addEventListener("focusin", this.#focus);
    document.addEventListener(EVENT, this.#sync);
    this.#sync();
  }
  disconnectedCallback() {
    this.removeEventListener("astryx-change", this.#change);
    this.removeEventListener("click", this.#click);
    this.removeEventListener("pointerdown", this.#down);
    this.removeEventListener("focusin", this.#focus);
    document.removeEventListener(EVENT, this.#sync);
  }

  #change = (e: Event) => {
    const value = (e as CustomEvent<{ value: string }>).detail?.value;
    if (!(e.target as Element).closest("ax-segmented-control") || e.defaultPrevented) return;
    if (value === "auto" || value === "light" || value === "dark") setTheme(value);
  };
  /** The link to this page in the other language, with the reader's ?q= and #section. */
  #keepPlace(a: HTMLAnchorElement) {
    const href = a.href.split(/[?#]/)[0] + location.search + location.hash;
    if (a.href !== href) a.href = href;
  }
  #lang = (e: Event) => (e.target as Element).closest?.<HTMLAnchorElement>("a[data-lang-link]");
  #click = (e: MouseEvent) => { const a = this.#lang(e); if (a) this.#keepPlace(a); };
  #focus = (e: FocusEvent) => { const a = this.#lang(e); if (a) this.#keepPlace(a); };
  #down = (e: PointerEvent) => { const a = this.#lang(e); if (a) this.#keepPlace(a); };
}

if (globalThis.customElements && !customElements.get("site-switches")) customElements.define("site-switches", SiteSwitches);

declare global {
  interface HTMLElementTagNameMap {
    "site-switches": SiteSwitches;
  }
}

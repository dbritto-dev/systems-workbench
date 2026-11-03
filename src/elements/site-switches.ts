// <site-switches>: the language links (EN / ES) and the theme buttons (Auto / Light / Dark), markup from
// components/Switches.astro.
//
// Theme: Auto follows the device; Light or Dark is forced with data-theme on <html> and remembered in this browser.
// The head of every page applies the remembered theme before first paint (layouts/Base.astro). Every switch on the
// page shows the same choice: a change is announced with a "workbench-theme" event on document.
// Language: the links keep the reader's search (?q=) and section (#predict) when switching.
const KEY = "workbench-theme";
const EVENT = "workbench-theme";
type Choice = "auto" | "light" | "dark";

const current = (): Choice => {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "light" || t === "dark" ? t : "auto";
};

export function setTheme(choice: Choice) {
  const root = document.documentElement;
  if (choice === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  try { if (choice === "auto") localStorage.removeItem(KEY); else localStorage.setItem(KEY, choice); } catch {}
  document.dispatchEvent(new Event(EVENT));
}

export class SiteSwitches extends HTMLElement {
  #mark = () => this.querySelectorAll<HTMLButtonElement>("[data-theme-choice]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeChoice === current())));

  connectedCallback() {
    this.addEventListener("click", this.#click);
    document.addEventListener(EVENT, this.#mark);
    this.#mark();
  }
  disconnectedCallback() {
    this.removeEventListener("click", this.#click);
    document.removeEventListener(EVENT, this.#mark);
  }
  #click = (e: Event) => {
    const t = e.target as Element;
    const theme = t.closest<HTMLButtonElement>("[data-theme-choice]");
    if (theme) return setTheme(theme.dataset.themeChoice as Choice);
    const lang = t.closest<HTMLAnchorElement>("a[data-lang-link]");
    if (lang) lang.href = lang.href.split(/[?#]/)[0] + location.search + location.hash;
  };
}

if (!customElements.get("site-switches")) customElements.define("site-switches", SiteSwitches);

declare global {
  interface HTMLElementTagNameMap {
    "site-switches": SiteSwitches;
  }
}

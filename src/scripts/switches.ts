// Theme: Auto follows the device; Light or Dark is forced with data-theme on <html> and remembered.
// The head of every page applies the remembered theme before first paint (layouts/Base.astro).
const KEY = "workbench-theme";

export function initTheme() {
  const root = document.documentElement;
  const buttons = document.querySelectorAll<HTMLButtonElement>("[data-theme-choice]");
  const current = () => { const t = root.getAttribute("data-theme"); return t === "light" || t === "dark" ? t : "auto"; };
  const mark = () => buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeChoice === current())));
  buttons.forEach((b) => b.addEventListener("click", () => {
    const c = b.dataset.themeChoice;
    if (c === "light" || c === "dark") root.setAttribute("data-theme", c); else root.removeAttribute("data-theme");
    try { if (c === "light" || c === "dark") localStorage.setItem(KEY, c); else localStorage.removeItem(KEY); } catch {}
    mark();
  }));
  mark();
}

// Language links keep the reader's search (?q=) and section (#predict) when switching.
export function rememberLanguage() {
  document.querySelectorAll<HTMLAnchorElement>("[data-lang-link]").forEach((a) => a.addEventListener("click", () => {
    a.href = a.href.split(/[?#]/)[0] + location.search + location.hash;
  }));
}

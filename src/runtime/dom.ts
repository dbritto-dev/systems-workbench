// Small DOM helpers that every lesson's live code used to write for itself.
import { L, type Loop } from "./wb";

/** The figure's readout line: say(text) writes it only when it changes. */
export function readout(root: ParentNode = document) {
  const el = root.querySelector("[data-readout]")!;
  return (text: string) => { if (el.textContent !== text) el.textContent = text; };
}

/** The stats strip under the figure: stat(key, value) writes <b data-s="key"> only when it changes. */
export function stats(root: ParentNode = document) {
  const els = Object.fromEntries([...root.querySelectorAll<HTMLElement>("[data-s]")].map((el) => [el.dataset.s!, el]));
  return (key: string, value: unknown) => {
    const el = els[key], text = String(value);
    if (el && el.textContent !== text) el.textContent = text;
  };
}

/** Show or hide an element (display), touching the DOM only when it changes. */
export function show(el: HTMLElement | SVGElement, on: boolean) {
  const v = on ? "" : "none";
  if (el.style.display !== v) el.style.display = v;
}

/** Set an element's text, touching the DOM only when it changes. */
export function setText(el: Element, value: unknown) {
  const text = String(value);
  if (el.textContent !== text) el.textContent = text;
}

/** Set a path's d, touching the DOM only when it changes. */
export function setD(el: Element, d: string) {
  if (el.getAttribute("d") !== d) el.setAttribute("d", d);
}

/** Light (or unlight) every solid in a group: the one lit accent of the figure. */
export const setLit = (g: Element, on: boolean) => g.querySelectorAll(".iso-solid").forEach((s) => s.toggleAttribute("data-lit", on));

/** An action button by name: <button data-act="name">. */
export const act = (name: string) => document.querySelector<HTMLButtonElement>(`[data-act="${name}"]`)!;

/**
 * Play/Pause for a lesson: the Pause button's label and the readout follow the loop, the button toggles it, and
 * Space toggles it when the figure has focus. Pass onPause to WB.loop(), then call bind(loop).
 */
export function pauseControls(stage: HTMLElement, say?: (text: string) => void) {
  const btn = document.querySelector<HTMLButtonElement>('[data-act="pause"]');
  return {
    onPause(on: boolean) {
      if (btn) btn.textContent = on ? L("Play", "Reanudar") : L("Pause", "Pausa");
      if (on && say) say(L("paused", "en pausa"));
    },
    bind(loop: Loop) {
      btn?.addEventListener("click", () => loop.toggle());
      stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });
    },
  };
}

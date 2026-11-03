// Small DOM helpers that every lesson's live code used to write for itself.
import { L, type Loop } from "./wb";

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

/**
 * Play/Pause for a lesson: the Pause button's label and the readout follow the loop, and the "pause" action (the
 * Pause button, or Space on the figure) toggles it. Pass onPause to WB.loop(), then call bind(loop).
 */
export function playPause(root: { button(name: string): HTMLButtonElement | null; figure: { say(text: string): void }; on(type: "action", fn: (name: string, detail: { event: CustomEvent }) => void): unknown }) {
  const btn = root.button("pause");
  return {
    onPause(on: boolean) {
      if (btn) btn.textContent = on ? L("Play", "Reanudar") : L("Pause", "Pausa");
      if (on) root.figure.say(L("paused", "en pausa"));
    },
    bind(loop: Loop) {
      root.on("action", (name, { event }) => { if (name !== "pause") return; event.preventDefault(); loop.toggle(); });
    },
  };
}

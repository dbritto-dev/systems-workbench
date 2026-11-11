// Small DOM helpers that every lesson's live code used to write for itself.
import { L, type Loop } from "./wb";
import { setPressed } from "../elements/wb-button";

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
 * Play/Pause for a lesson: the Pause button is an Astryx ToggleButton (aria-pressed and data-is-pressed: pressed
 * while paused; its label stays "Pause"), the readout says "paused", and the "pause" action (the Pause button, or Space on the figure) toggles the
 * loop. Pass onPause to WB.loop(), then call bind(loop), which also shows the loop's state now (a loop starts paused
 * under reduced motion).
 */
export function playPause(root: { button(name: string): HTMLButtonElement | null; figure: { say(text: string): void }; on(type: "action", fn: (name: string, detail: { event: CustomEvent }) => void): unknown }) {
  const btn = root.button("pause");
  const show = (on: boolean) => { if (btn) setPressed(btn, on); };
  return {
    onPause(on: boolean) {
      show(on);
      if (on) root.figure.say(L("paused", "en pausa"));
    },
    bind(loop: Loop) {
      show(loop.paused);
      root.on("action", (name, { event }) => { if (name !== "pause") return; event.preventDefault(); loop.toggle(); });
    },
  };
}

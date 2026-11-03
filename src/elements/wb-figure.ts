// <wb-figure>: a lesson's figure plate (markup from components/lesson/FigurePlate.astro): the stage holding the
// machine's SVG, the corner labels and the live readout.
//
//   figure.stage        the .iso-stage element (the SVG's parent, focusable)
//   figure.svg          the machine's <svg>
//   figure.say(text)    write the readout corner, touching the DOM only on change
//
// Space on the focused stage sends a cancelable "wb-action" event, { name: "pause" }; if a listener handles it
// (preventDefault), the key doesn't scroll the page.
import type { ActionDetail } from "./wb-controls";

export class WbFigure extends HTMLElement {
  get stage() { return this.querySelector<HTMLElement>(".iso-stage")!; }
  get svg() { return this.stage.querySelector("svg")!; }
  say(text: string) {
    const el = this.querySelector("[data-readout]");
    if (el && el.textContent !== text) el.textContent = text;
  }
  connectedCallback() { this.addEventListener("keydown", this.#key); }
  disconnectedCallback() { this.removeEventListener("keydown", this.#key); }
  #key = (e: KeyboardEvent) => {
    if (e.key !== " " || e.target !== this.stage) return;
    const detail: ActionDetail = { name: "pause" };
    if (!this.dispatchEvent(new CustomEvent("wb-action", { bubbles: true, cancelable: true, detail }))) e.preventDefault();
  };
}

if (!customElements.get("wb-figure")) customElements.define("wb-figure", WbFigure);

declare global {
  interface HTMLElementTagNameMap {
    "wb-figure": WbFigure;
  }
}

// The controls under a lesson's figure (markup from components/lesson/Panel.astro):
//
//   <wb-stats>   the stats strip. stats.set("done", 12) writes <b data-s="done">, touching the DOM only on change.
//   <wb-seg name="speed" value="1">   a segmented choice. A click sends a "wb-change" event, { name, value, button },
//                which bubbles to the lesson; unless a listener cancels it (preventDefault) or sets seg.value itself,
//                the clicked option becomes the pressed one. seg.value = "3" presses an option without an event.
//   <wb-actions> a row of buttons <button data-act="name">. A click sends "wb-action", { name, button }.
//
// Lessons rarely touch these directly: <wb-lesson> gives live code root.stat(), root.seg(), root.button() and
// root.on("change" | "action", …).

export interface ChangeDetail { name: string; value: string; button: HTMLButtonElement }
export interface ActionDetail { name: string; button?: HTMLButtonElement }

export class WbStats extends HTMLElement {
  #els: Record<string, HTMLElement> | null = null;
  set(key: string, value: unknown) {
    this.#els ??= Object.fromEntries([...this.querySelectorAll<HTMLElement>("[data-s]")].map((el) => [el.dataset.s!, el]));
    const el = this.#els[key], text = String(value);
    if (el && el.textContent !== text) el.textContent = text;
  }
}

export class WbSeg extends HTMLElement {
  #touched = false;
  get name() { return this.getAttribute("name") ?? ""; }
  get buttons() { return [...this.querySelectorAll<HTMLButtonElement>("button[data-value]")]; }
  get value() { return this.getAttribute("value") ?? ""; }
  set value(v: string | number | boolean) {
    this.#touched = true;
    const s = String(v);
    if (this.getAttribute("value") !== s) this.setAttribute("value", s);
    this.buttons.forEach((b) => { const on = String(b.dataset.value === s); if (b.getAttribute("aria-pressed") !== on) b.setAttribute("aria-pressed", on); });
  }
  connectedCallback() { this.addEventListener("click", this.#click); }
  disconnectedCallback() { this.removeEventListener("click", this.#click); }
  #click = (e: Event) => {
    const button = (e.target as Element).closest<HTMLButtonElement>("button[data-value]");
    if (!button || button.disabled || !this.contains(button)) return;
    this.#touched = false;
    const detail: ChangeDetail = { name: this.name, value: button.dataset.value!, button };
    const go = this.dispatchEvent(new CustomEvent("wb-change", { bubbles: true, cancelable: true, detail }));
    if (go && !this.#touched) this.value = detail.value;
  };
}

export class WbActions extends HTMLElement {
  button(name: string) { return this.querySelector<HTMLButtonElement>(`button[data-act="${name}"]`); }
  connectedCallback() { this.addEventListener("click", this.#click); }
  disconnectedCallback() { this.removeEventListener("click", this.#click); }
  #click = (e: Event) => {
    const button = (e.target as Element).closest<HTMLButtonElement>("button[data-act]");
    if (!button || button.disabled || !this.contains(button)) return;
    const detail: ActionDetail = { name: button.dataset.act!, button };
    this.dispatchEvent(new CustomEvent("wb-action", { bubbles: true, detail }));
  };
}

const define = (name: string, ctor: CustomElementConstructor) => { if (!customElements.get(name)) customElements.define(name, ctor); };
define("wb-stats", WbStats);
define("wb-seg", WbSeg);
define("wb-actions", WbActions);

declare global {
  interface HTMLElementTagNameMap {
    "wb-stats": WbStats;
    "wb-seg": WbSeg;
    "wb-actions": WbActions;
  }
}

// The controls under a lesson's figure (markup from components/lesson/Panel.astro):
//
//   <wb-stats>   the stats strip: one <wb-stat key="done"> per figure. stats.set("done", 12) or stat.set(12) writes
//                its value, touching the DOM only on change.
//   <wb-controls> the controls area: one <wb-control> per row (a label and a segment, buttons or a text box).
//                controls.showFor("lookups") shows the rows with for="lookups" and hides the other rows that have a
//                for= (rows without one always show).
//   <wb-seg name="speed" value="1">   a segmented choice. A click sends a "wb-change" event, { name, value, button,
//                pressed }, which bubbles to the lesson; unless a listener cancels it (preventDefault) or changes
//                the pressed options itself, the clicked option becomes the pressed one. seg.value = "3" presses an
//                option without an event.
//   <wb-seg multiple>   options switch on and off independently (pressed: the clicked option's new state);
//                seg.value is the pressed values separated by spaces.
//   <wb-actions> a row of buttons <button data-act="name">. A click sends "wb-action", { name, button }.
//
// Lessons rarely touch these directly: <wb-lesson> gives live code root.stat(), root.seg(), root.button() and
// root.on("change" | "action", …).

export interface ChangeDetail { name: string; value: string; button: HTMLButtonElement; pressed: boolean }
export interface ActionDetail { name: string; button?: HTMLButtonElement }

export class WbStat extends HTMLElement {
  get key() { return this.getAttribute("key") ?? ""; }
  get value() { return this.querySelector("b")?.textContent ?? ""; }
  set(value: unknown) {
    const el = this.querySelector("b"), text = String(value);
    if (el && el.textContent !== text) el.textContent = text;
  }
}

export class WbStats extends HTMLElement {
  #byKey: Map<string, WbStat> | null = null;
  stat(key: string) {
    this.#byKey ??= new Map([...this.querySelectorAll<WbStat>("wb-stat")].map((s) => [s.key, s]));
    return this.#byKey.get(key);
  }
  set(key: string, value: unknown) { this.stat(key)?.set(value); }
}

export class WbControl extends HTMLElement {
  /** The group this row belongs to (for="…"), shown by controls.showFor(group). */
  get for() { return this.getAttribute("for"); }
}

export class WbControls extends HTMLElement {
  get rows() { return [...this.querySelectorAll<WbControl>(":scope > wb-control")]; }
  showFor(group: string) { this.rows.forEach((r) => { if (r.for !== null) r.hidden = r.for !== group; }); }
}

export class WbSeg extends HTMLElement {
  #touched = false;
  get name() { return this.getAttribute("name") ?? ""; }
  get buttons() { return [...this.querySelectorAll<HTMLButtonElement>("button[data-value]")]; }
  get multiple() { return this.hasAttribute("multiple"); }
  get value() { return this.multiple ? this.buttons.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.value).join(" ") : this.getAttribute("value") ?? ""; }
  set value(v: string | number | boolean | string[]) {
    this.#touched = true;
    const on = new Set(Array.isArray(v) ? v : this.multiple ? String(v).split(" ").filter(Boolean) : [String(v)]);
    if (!this.multiple && this.getAttribute("value") !== String(v)) this.setAttribute("value", String(v));
    this.buttons.forEach((b) => { const p = String(on.has(b.dataset.value!)); if (b.getAttribute("aria-pressed") !== p) b.setAttribute("aria-pressed", p); });
  }
  #pressedState() { return this.buttons.map((b) => b.getAttribute("aria-pressed")).join(); }
  connectedCallback() { this.addEventListener("click", this.#click); }
  disconnectedCallback() { this.removeEventListener("click", this.#click); }
  #click = (e: Event) => {
    const button = (e.target as Element).closest<HTMLButtonElement>("button[data-value]");
    if (!button || button.disabled || !this.contains(button)) return;
    this.#touched = false;
    const before = this.#pressedState();
    const pressed = this.multiple ? button.getAttribute("aria-pressed") !== "true" : true;
    const detail: ChangeDetail = { name: this.name, value: button.dataset.value!, button, pressed };
    const go = this.dispatchEvent(new CustomEvent("wb-change", { bubbles: true, cancelable: true, detail }));
    // The lesson pressed something itself (or refused the click): leave it.
    if (!go || this.#touched || this.#pressedState() !== before) return;
    if (this.multiple) button.setAttribute("aria-pressed", String(pressed));
    else this.value = detail.value;
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
define("wb-stat", WbStat);
define("wb-stats", WbStats);
define("wb-control", WbControl);
define("wb-controls", WbControls);
define("wb-seg", WbSeg);
define("wb-actions", WbActions);

declare global {
  interface HTMLElementTagNameMap {
    "wb-stat": WbStat;
    "wb-stats": WbStats;
    "wb-control": WbControl;
    "wb-controls": WbControls;
    "wb-seg": WbSeg;
    "wb-actions": WbActions;
  }
}

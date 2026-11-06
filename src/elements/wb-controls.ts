// The controls under a lesson's figure (markup from components/lesson/Panel.astro). They behave like Astryx's
// SegmentedControl, ToggleButton and Button (src/lessons/README.md, "UX foundation"); the look stays ours.
//
//   <wb-stats>   the stats strip: one <wb-stat key="done"> per figure. stats.set("done", 12) or stat.set(12) writes
//                its value, touching the DOM only on change.
//   <wb-controls> the controls area: one <wb-control> per row (a label and a segment, buttons or a text box).
//                controls.showFor("lookups") shows the rows with for="lookups" and hides the other rows that have a
//                for= (rows without one always show).
//   <wb-seg name="speed" value="1" role="radiogroup">   a one-of-N choice (a segmented control): buttons with
//                role="radio" and aria-checked. One Tab stop (the selected option); ← → (swapped under RTL) wrap,
//                Home and End, and selection follows focus; the first keyboard entry shows the "← → to navigate"
//                hint. The selected surface slides from the old option to the new one. A click, an arrow or a key
//                on another option sends a "wb-change" event, { name, value, button, pressed }, which bubbles to
//                the lesson; unless a listener cancels it (preventDefault) or changes the pressed options itself,
//                that option becomes the selected one. Activating the selected option does nothing.
//                seg.value = "3" selects an option without an event.
//   <wb-seg multiple role="group">   a toggle group: options switch on and off independently (buttons with
//                aria-pressed, each its own Tab stop; pressed: the clicked option's new state); seg.value is the
//                pressed values separated by spaces.
//   <wb-actions> a row of buttons <button data-act="name">, each its own Tab stop. A click sends "wb-action",
//                { name, button }. A button with aria-pressed (Pause) is a toggle: a click flips it at once, and
//                the live code keeps it in step with what it shows (runtime/dom.ts, playPause).
//
// Disabled is aria-disabled="true" (the control keeps its Tab stop and focus), optionally with a reason tooltip:
// seg.disable(value | null, on, reason?), actions.disable(name, on, reason?), or root.disable(name, on, reason?)
// from <wb-lesson>. Busy, press feedback and reason tooltips come from ./wb-button.
//
// Lessons rarely touch these directly: <wb-lesson> gives live code root.stat(), root.seg(), root.button() and
// root.on("change" | "action", …).
import { roving, type Roving } from "../runtime/roving";
import { still } from "../runtime/wb";
import { isRefused, setDisabled, trackPress } from "./wb-button";

export interface ChangeDetail { name: string; value: string; button: HTMLButtonElement; pressed: boolean }
export interface ActionDetail { name: string; button?: HTMLButtonElement }

const hidden = (el: Element) => el.getClientRects().length === 0;
const nativeDisabled = (el: Element) => (el as HTMLButtonElement).disabled === true;

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
  #nav: Roving | null = null;
  #slideEnd: (() => void) | null = null;
  get name() { return this.getAttribute("name") ?? ""; }
  get buttons() { return [...this.querySelectorAll<HTMLButtonElement>("button[data-value]")]; }
  get multiple() { return this.hasAttribute("multiple"); }
  /** The attribute that says an option is on: aria-checked in a one-of-N group, aria-pressed in a toggle group. */
  get #state() { return this.multiple ? "aria-pressed" : "aria-checked"; }
  get #selected() { return this.buttons.find((b) => b.getAttribute(this.#state) === "true"); }
  get value() { return this.multiple ? this.buttons.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.value).join(" ") : this.getAttribute("value") ?? ""; }
  set value(v: string | number | boolean | string[]) {
    this.#touched = true;
    const on = new Set(Array.isArray(v) ? v : this.multiple ? String(v).split(" ").filter(Boolean) : [String(v)]);
    const was = this.#selected;
    if (!this.multiple && this.getAttribute("value") !== String(v)) this.setAttribute("value", String(v));
    this.buttons.forEach((b) => { const p = String(on.has(b.dataset.value!)); if (b.getAttribute(this.#state) !== p) b.setAttribute(this.#state, p); });
    if (!this.multiple) { this.#slide(was, this.#selected); this.#nav?.sync(); }
  }
  /** The whole group is disabled (aria-disabled on the group: it dims once and keeps its Tab stop). */
  get disabled() { return this.getAttribute("aria-disabled") === "true"; }
  set disabled(on: boolean) { setDisabled(this, on); }
  /** Disables one option (value) or the whole group (null), with an optional reason tooltip. */
  disable(value: string | number | null, on: boolean, reason?: string | null) {
    const el = value === null ? this : this.buttons.find((b) => b.dataset.value === String(value));
    if (el) setDisabled(el, on, reason);
  }
  #refused(b: HTMLButtonElement) { return nativeDisabled(b) || isRefused(b); }
  #pressedState() { return this.buttons.map((b) => b.getAttribute(this.#state)).join(); }

  connectedCallback() {
    this.addEventListener("click", this.#click);
    trackPress(this, "button[data-value]");
    if (!this.multiple && !this.#nav) {
      this.#nav = roving(this, {
        items: "button[data-value]",
        current: () => this.#selected,
        select: (b) => { if (!this.#refused(b as HTMLButtonElement)) this.#activate(b as HTMLButtonElement); },
        skip: (b) => this.#refused(b as HTMLButtonElement) || hidden(b),
        hint: "wb-seg",
      });
    }
  }
  disconnectedCallback() {
    this.removeEventListener("click", this.#click);
    this.#nav?.destroy();
    this.#nav = null;
  }
  #click = (e: Event) => {
    const button = (e.target as Element).closest<HTMLButtonElement>("button[data-value]");
    if (!button || !this.contains(button) || this.#refused(button)) return;
    this.#activate(button);
  };
  #activate(button: HTMLButtonElement) {
    if (!this.multiple && button.getAttribute("aria-checked") === "true") return;
    const pressed = this.multiple ? button.getAttribute("aria-pressed") !== "true" : true;
    this.#commit({ name: this.name, value: button.dataset.value!, button, pressed });
  }
  /** Sends the change and, unless a listener refused it or pressed something itself, applies it. */
  #commit(detail: ChangeDetail) {
    this.#touched = false;
    const before = this.#pressedState();
    const go = this.dispatchEvent(new CustomEvent("wb-change", { bubbles: true, cancelable: true, detail }));
    if (!go || this.#touched || this.#pressedState() !== before) return;
    if (this.multiple) detail.button.setAttribute("aria-pressed", String(detail.pressed));
    else this.value = detail.value;
  }
  /** Sends a change again that was made before the live code had loaded (<wb-lesson> keeps it). */
  replay(detail: ChangeDetail) { this.#commit(detail); }

  // The selected surface slides from the old option to the new one: the group's ::before is placed on the new
  // option and transformed back to the old one, then let go (transform only). The selected option paints its own
  // fill the rest of the time, so the first paint needs no script. Under reduced motion the change is instant.
  #slide(from: HTMLElement | undefined, to: HTMLElement | undefined) {
    this.#slideEnd?.();
    if (!from || !to || from === to || still.matches || !this.isConnected) return;
    const g = this.getBoundingClientRect(), a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    if (!g.width || !a.width || !b.width) return;
    const s = this.style;
    s.setProperty("--wb-sx", `${b.left - g.left - this.clientLeft}px`);
    s.setProperty("--wb-sy", `${b.top - g.top - this.clientTop}px`);
    s.setProperty("--wb-sw", `${b.width}px`);
    s.setProperty("--wb-sh", `${b.height}px`);
    s.setProperty("--wb-st", `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`);
    this.setAttribute("data-slide", "from");
    void this.offsetWidth; // commit the start position
    this.setAttribute("data-slide", "to");
    s.setProperty("--wb-st", "none");
    const end = () => {
      clearTimeout(timer);
      this.removeEventListener("transitionend", onEnd);
      this.removeAttribute("data-slide");
      this.#slideEnd = null;
    };
    const onEnd = (e: TransitionEvent) => { if (e.target === this && e.pseudoElement === "::before") end(); };
    const timer = setTimeout(end, 600);
    this.addEventListener("transitionend", onEnd);
    this.#slideEnd = end;
  }
}

export class WbActions extends HTMLElement {
  button(name: string) { return this.querySelector<HTMLButtonElement>(`button[data-act="${name}"]`); }
  /** Disables (or enables) an action button, keeping its Tab stop, with an optional reason tooltip. */
  disable(name: string, on: boolean, reason?: string | null) {
    const b = this.button(name);
    if (b) setDisabled(b, on, reason);
  }
  connectedCallback() {
    this.addEventListener("click", this.#click);
    trackPress(this, "button[data-act]");
  }
  disconnectedCallback() { this.removeEventListener("click", this.#click); }
  #click = (e: Event) => {
    const button = (e.target as Element).closest<HTMLButtonElement>("button[data-act]");
    if (!button || !this.contains(button) || nativeDisabled(button) || isRefused(button)) return;
    // A toggle shows its new state at once (optimistic); the live code confirms it.
    if (button.hasAttribute("aria-pressed")) button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
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

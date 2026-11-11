// The controls under a lesson's figure (markup from components/lesson/Panel.astro). The controls themselves are
// astryx-astro's: SegmentedControl, ToggleButtonGroup + ToggleButton, Button, TextInput, with Astryx's keyboard,
// focus, hover, press and hint behaviour. These elements wrap them and translate their events into the lesson API
// (src/lessons/README.md) that every live.ts uses through <wb-lesson>:
//
//   <wb-stats>   the stats strip: one <wb-stat key="done"> per figure. stats.set("done", 12) or stat.set(12) writes
//                its value, touching the DOM only on change.
//   <wb-controls> the controls area: one <wb-control> per row (a label and a segment, buttons or a text box).
//                controls.showFor("lookups") shows the rows with for="lookups" and hides the other rows that have a
//                for= (rows without one always show).
//   <wb-seg name="speed">   wraps a SegmentedControl (<ax-segmented-control>, a radiogroup of role="radio" buttons
//                with data-set / data-value). Astryx's cancelable "astryx-change" { value } becomes a cancelable
//                "wb-change" { name, value, button, pressed: true }, which bubbles to the lesson; if a listener
//                cancels it (preventDefault) or presses options itself (root.press), the control keeps that, else
//                Astryx applies the choice. seg.value = "3" selects an option without an event (Astryx slides).
//   <wb-seg name multiple>  wraps a ToggleButtonGroup type="multiple" (aria-pressed toggles, each its own Tab stop):
//                its "astryx-change" { value: [...] } becomes "wb-change" { name, value: the toggled option,
//                button, pressed: its new state }, with the same veto. seg.value is the pressed values separated by
//                spaces; setting it presses those, without an event.
//   <wb-actions> a group of Buttons <button data-act="name">, each its own Tab stop. A click sends "wb-action",
//                { name, button }. Pause is a ToggleButton: Astryx flips it ("astryx-pressed-change"), which sends
//                "wb-action"; the live code keeps it in step with what it shows (runtime/dom.ts, playPause), and a
//                state it writes during the event wins over Astryx's.
//
// Disabled is aria-disabled="true" (the control keeps its Tab stop and focus), optionally with a reason tooltip:
// seg.disable(value | null, on, reason?), actions.disable(name, on, reason?), or root.disable(name, on, reason?)
// from <wb-lesson>; the state is written as the Astryx component renders it (./wb-button).
//
// Lessons rarely touch these directly: <wb-lesson> gives live code root.stat(), root.seg(), root.button(),
// root.relabel() and root.on("change" | "action", …).
import "astryx-astro/elements/segmented-control";
import type { SegmentedControlElement } from "astryx-astro/elements/segmented-control";
import { isRefused, relabel, setDisabled, setPressed } from "./wb-button";

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
  get multiple() { return this.hasAttribute("multiple"); }
  /** The Astryx control: <ax-segmented-control>, or the ToggleButtonGroup's role="group" element. */
  get group() { return this.querySelector<HTMLElement>("ax-segmented-control, [data-ax-toggle-button-group]")!; }
  get buttons() { return [...this.querySelectorAll<HTMLButtonElement>("button[data-value]")]; }
  get #pressedValues() { return this.buttons.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.value!); }
  get value() {
    if (this.multiple) return this.#pressedValues.join(" ");
    return this.buttons.find((b) => b.getAttribute("aria-checked") === "true")?.dataset.value ?? "";
  }
  set value(v: string | number | boolean | string[]) {
    this.#touched = true;
    if (this.multiple) {
      const on = Array.isArray(v) ? v.map(String) : String(v).split(" ").filter(Boolean);
      // As ToggleButtonGroup's own value setter writes it (behaviors/toggleButtonGroup.ts).
      this.buttons.forEach((b) => setPressed(b, on.includes(b.dataset.value!)));
      this.group.setAttribute("data-ax-value-order", JSON.stringify(on.filter((x) => this.buttons.some((b) => b.dataset.value === x))));
    } else {
      (this.group as SegmentedControlElement).value = String(v);
    }
  }
  /** The whole group is disabled (aria-disabled on the group: it dims once and keeps its Tab stop). */
  get disabled() { return this.group.getAttribute("aria-disabled") === "true"; }
  set disabled(on: boolean) { this.disable(null, on); }
  /** Disables one option (value) or the whole group (null), with an optional reason tooltip. */
  disable(value: string | number | null, on: boolean, reason?: string | null) {
    if (value !== null) {
      const b = this.buttons.find((x) => x.dataset.value === String(value));
      if (b) setDisabled(b, on, reason);
      return;
    }
    // A disabled SegmentedControl marks the group and every segment (as it renders isDisabled); a ToggleButton
    // group disables each member.
    if (!this.multiple) {
      if (on) this.group.setAttribute("aria-disabled", "true"); else this.group.removeAttribute("aria-disabled");
    }
    this.buttons.forEach((b) => setDisabled(b, on));
    if (reason !== undefined && this.buttons[0]) setDisabled(this.buttons[0], on, reason);
  }

  connectedCallback() { this.addEventListener("astryx-change", this.#change); }
  disconnectedCallback() { this.removeEventListener("astryx-change", this.#change); }

  #change = (e: Event) => {
    if (e.target !== this.group) return;
    const ev = e as CustomEvent<{ value: string | string[] | null }>;
    let detail: ChangeDetail | null = null;
    if (this.multiple) {
      const next = Array.isArray(ev.detail.value) ? ev.detail.value : [];
      const was = this.#pressedValues;
      const toggled = [...next.filter((v) => !was.includes(v)), ...was.filter((v) => !next.includes(v))][0];
      const button = this.buttons.find((b) => b.dataset.value === toggled);
      if (button) detail = { name: this.name, value: toggled, button, pressed: next.includes(toggled) };
    } else {
      const value = String(ev.detail.value ?? "");
      const button = this.buttons.find((b) => b.dataset.value === value);
      if (button) detail = { name: this.name, value, button, pressed: true };
    }
    if (detail && !this.#ask(detail)) ev.preventDefault();
  };
  #pressedState() { return this.buttons.map((b) => b.getAttribute(this.multiple ? "aria-pressed" : "aria-checked")).join(); }
  /** Sends "wb-change"; true when no listener refused it or pressed something itself (so the choice applies). */
  #ask(detail: ChangeDetail) {
    this.#touched = false;
    const before = this.#pressedState();
    const go = this.dispatchEvent(new CustomEvent("wb-change", { bubbles: true, cancelable: true, detail }));
    return go && !this.#touched && this.#pressedState() === before;
  }
  /** Sends a change again that was made before the live code had loaded (<wb-lesson> keeps it); Astryx already
   *  showed it, so this only re-applies it if a listener didn't decide otherwise. */
  replay(detail: ChangeDetail) {
    if (!this.#ask(detail)) return;
    if (this.multiple) setPressed(detail.button, detail.pressed);
    else this.value = detail.value;
  }
}

export class WbActions extends HTMLElement {
  button(name: string) { return this.querySelector<HTMLButtonElement>(`button[data-act="${name}"]`); }
  /** Disables (or enables) an action button, keeping its Tab stop, with an optional reason tooltip. */
  disable(name: string, on: boolean, reason?: string | null) {
    const b = this.button(name);
    if (b) setDisabled(b, on, reason);
  }
  /** Writes an action button's label. */
  relabel(name: string, text: string) {
    const b = this.button(name);
    if (b) relabel(b, text);
  }
  connectedCallback() {
    this.addEventListener("click", this.#click);
    this.addEventListener("astryx-pressed-change", this.#pressed);
  }
  disconnectedCallback() {
    this.removeEventListener("click", this.#click);
    this.removeEventListener("astryx-pressed-change", this.#pressed);
  }
  // A plain button acts on its click (Astryx's disabled-interaction guard has already stopped one on a disabled
  // button); a busy one refuses.
  #click = (e: Event) => {
    const button = (e.target as Element).closest<HTMLButtonElement>("button[data-act]");
    if (!button || !this.contains(button) || button.hasAttribute("data-ax-toggle-button") || isRefused(button)) return;
    this.dispatchEvent(new CustomEvent("wb-action", { bubbles: true, detail: { name: button.dataset.act!, button } satisfies ActionDetail }));
  };
  // A toggle acts when Astryx flips it. Astryx then shows the new state, unless the live code wrote one itself.
  #pressed = (e: Event) => {
    const button = e.target as HTMLButtonElement;
    if (!(button instanceof HTMLButtonElement) || !button.dataset.act || !this.contains(button)) return;
    const before = button.getAttribute("aria-pressed");
    this.dispatchEvent(new CustomEvent("wb-action", { bubbles: true, detail: { name: button.dataset.act, button } satisfies ActionDetail }));
    const now = button.getAttribute("aria-pressed");
    if (now !== before) { e.preventDefault(); setPressed(button, now === "true"); }
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

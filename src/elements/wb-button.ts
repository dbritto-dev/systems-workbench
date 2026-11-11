// State changes the lesson page makes at run time on astryx-astro's controls (Button, ToggleButton,
// SegmentedControlItem, TextInput), written the way those components render the same state on the server, so
// Astryx's CSS, its tooltip runtime and its disabled-interaction guard treat them alike:
//
//   setDisabled(el, on, reason?)   disabled the focusable way (Astryx contract #2): aria-disabled="true", never the
//                                  native attribute, plus the component's own marker (a Button's data-ax-disabled,
//                                  a segment's data-disabled, a text box's data-disabled on its <ax-text-input>; a
//                                  text field also turns readOnly). With a reason, an Astryx Tooltip says why.
//   setReason(el, text | null)     the reason el is disabled: an <ax-tooltip> layer (the markup <Tooltip> renders,
//                                  driven by astryx-astro's tooltip runtime: hover, keyboard focus, a tap on the
//                                  disabled control, Escape) that describes el, enabled only while el is disabled
//   setBusy(button, on)            an action that hasn't finished: a Button's loading state (aria-busy, activation
//                                  refused through aria-disabled at full opacity, the label kept in place under a
//                                  spinner revealed after --duration-medium-min, "Loading" said once)
//   setPressed(button, on)         a ToggleButton's pressed state (aria-pressed and the theme's data-is-pressed)
//   relabel(button, text)          a Button's visible label (and its aria-label while it has one)
//   isRefused(el)                  true while el (or its group) is disabled or busy: activation does nothing
//
// A reason written into the page at build time (Experiment.astro's Run: <Button tooltip isDisabled>) is the same
// layer, so setDisabled() and setReason() work on it too.
import "astryx-astro/elements/runtime/tooltip";
import "astryx-astro/elements/runtime/disabledInteraction";
import { L } from "../runtime/wb";

export const isRefused = (el: Element) =>
  el.getAttribute("aria-busy") === "true" || el.closest('[aria-disabled="true"]') !== null;

const isButton = (el: Element) => el.classList.contains("astryx-button");
const isToggle = (el: Element) => el.hasAttribute("data-ax-toggle-button");
const isSegment = (el: Element) => el.classList.contains("astryx-segmented-control-item");
const textBox = (el: Element) => (el instanceof HTMLInputElement ? el.closest<HTMLElement>("ax-text-input") : null);

// ---------- describedby ----------
const ids = (el: Element) => (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
function describe(el: Element, id: string, on: boolean) {
  const list = ids(el).filter((x) => x !== id);
  if (on) list.push(id);
  if (list.length) el.setAttribute("aria-describedby", list.join(" "));
  else el.removeAttribute("aria-describedby");
}

// ---------- pressed, label ----------
/** A ToggleButton's pressed state, as Astryx's toggle behaviour writes it. */
export function setPressed(button: Element, on: boolean) {
  const v = String(on);
  if (button.getAttribute("aria-pressed") !== v) button.setAttribute("aria-pressed", v);
  if (button.hasAttribute("data-is-pressed") && button.getAttribute("data-is-pressed") !== v) button.setAttribute("data-is-pressed", v);
}

/** Writes a Button's visible label (a ToggleButton's text and its width reserve too). */
export function relabel(button: HTMLElement, text: string) {
  const spans = button.querySelectorAll<HTMLElement>(".ax-toggle-button-label-text, .ax-toggle-button-label-reserve");
  const targets = spans.length ? [...spans] : [...button.querySelectorAll<HTMLElement>(".ax-button-label")];
  if (!targets.length) { if (button.textContent !== text) button.textContent = text; return; }
  for (const t of targets) if (t.textContent !== text) t.textContent = text;
  if (button.hasAttribute("aria-label")) button.setAttribute("aria-label", text);
}

// ---------- reason tooltips ----------
let n = 0;
/** The element that triggers el's tooltip: a text box's <ax-text-input> (as TextInput's disabledMessage does), else el. */
const triggerOf = (el: HTMLElement) => textBox(el) ?? el;
const layerOf = (trigger: Element) => {
  const id = trigger.getAttribute("data-ax-tooltip");
  return id ? document.getElementById(id) : null;
};

/** An <ax-tooltip> layer, as <Tooltip placement="above"> renders it in sibling mode. */
function makeLayer(trigger: HTMLElement): HTMLElement {
  const layer = document.createElement("ax-tooltip");
  layer.id = `wb-tip-${++n}`;
  layer.setAttribute("popover", "hint");
  layer.setAttribute("role", "tooltip");
  layer.className = "astryx-tooltip ax-layer ax-layer-motion";
  layer.setAttribute("data-astryx-layer-root", "");
  layer.setAttribute("data-placement", "above");
  layer.setAttribute("data-align", "center");
  layer.setAttribute("data-astryx-keep-clear", "");
  // A text box's reason opens on any focus inside the box (TextInput's focusTrigger="always").
  if (trigger.localName === "ax-text-input") layer.setAttribute("data-ax-focus-trigger", "always");
  layer.style.setProperty("--_astryx-layer-clearance", "var(--spacing-1)");
  layer.append(Object.assign(document.createElement("span"), { className: "ax-tooltip-content" }));
  // A sibling of the trigger's row, never inside a joined row of segments (that would break its edges).
  const host = trigger.closest("ax-segmented-control, [data-ax-toggle-button-group]") ?? trigger;
  host.after(layer);
  trigger.setAttribute("data-ax-tooltip", layer.id);
  return layer;
}

/** Sets (text) or removes (null) the reason el is disabled; the tooltip shows only while el is aria-disabled. */
export function setReason(el: HTMLElement, text: string | null) {
  const trigger = triggerOf(el);
  let layer = layerOf(trigger);
  if (text === null) {
    if (layer) { (layer as HTMLElement & { hideNow?: () => void }).hideNow?.(); describe(el, layer.id, false); layer.remove(); }
    trigger.removeAttribute("data-ax-tooltip");
    return;
  }
  layer ??= makeLayer(trigger);
  const content = layer.querySelector(".ax-tooltip-content") ?? layer;
  if (content.textContent !== text) content.textContent = text;
  syncReason(el);
}

/** The reason is described and enabled while el is disabled, and quiet (closed, not describing) otherwise. */
function syncReason(el: HTMLElement) {
  const layer = layerOf(triggerOf(el));
  if (!layer) return;
  const on = el.getAttribute("aria-disabled") === "true";
  describe(el, layer.id, on);
  if (on) layer.removeAttribute("data-ax-enabled");
  else {
    layer.setAttribute("data-ax-enabled", "false");
    (layer as HTMLElement & { hideNow?: () => void }).hideNow?.();
  }
}

/** Disables (or enables) a control without taking it out of the Tab order. A reason (or null to drop it) is
 *  optional; without one an existing reason is kept and shown again next time. */
export function setDisabled(el: HTMLElement, on: boolean, reason?: string | null) {
  if (on) el.setAttribute("aria-disabled", "true");
  else el.removeAttribute("aria-disabled");
  el.removeAttribute("data-busy-refuses"); // an explicit state replaces a busy refusal
  if (isButton(el)) {
    el.toggleAttribute("data-ax-disabled", on);
    // A ToggleButton always carries the guard marker; a Button only while it is aria-disabled.
    if (!isToggle(el)) el.toggleAttribute("data-ax-disabled-interaction", on);
  } else if (isSegment(el)) {
    if (on) { el.setAttribute("data-disabled", "disabled"); el.setAttribute("data-astryx-segment-disabled", ""); }
    else { el.removeAttribute("data-disabled"); el.removeAttribute("data-astryx-segment-disabled"); }
    el.classList.toggle("ax-overlay-bg", !on && el.getAttribute("aria-checked") !== "true");
  } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.readOnly = on;
    const box = textBox(el);
    if (box) { if (on) box.setAttribute("data-disabled", "disabled"); else box.removeAttribute("data-disabled"); }
  }
  if (reason !== undefined) setReason(el, reason);
  else syncReason(el);
}

// ---------- busy ----------
const spinnerTemplate = () => document.querySelector<HTMLTemplateElement>("template[data-wb-spinner]");

/** Marks an action as pending (on) or done (off): a Button's loading state, built as Button renders isLoading.
 *  The button keeps its size, its focus and its Tab stop. */
export function setBusy(button: HTMLElement, on: boolean) {
  const content = button.querySelector<HTMLElement>(":scope > .ax-button-content");
  const live = button.querySelector<HTMLElement>(':scope > [role="status"]');
  if (on) {
    if (button.getAttribute("aria-busy") === "true") return;
    button.setAttribute("aria-busy", "true");
    // Refuses activation while pending (runtime/disabledInteraction), at full opacity: busy is not disabled.
    if (button.getAttribute("aria-disabled") !== "true") {
      button.setAttribute("data-busy-refuses", "");
      button.setAttribute("aria-disabled", "true");
      button.setAttribute("data-ax-disabled-interaction", "");
    }
    // The content is hidden from assistive tech while loading, so the name moves to aria-label.
    if (!button.hasAttribute("aria-label")) { button.setAttribute("aria-label", (button.querySelector(".ax-button-label")?.textContent ?? button.textContent ?? "").trim()); button.setAttribute("data-busy-label", ""); }
    const spin = Object.assign(document.createElement("span"), { className: "ax-button-spinner" });
    spin.setAttribute("data-ax-delayed", "");
    spin.setAttribute("aria-hidden", "true");
    const t = spinnerTemplate();
    if (t) spin.append(t.content.cloneNode(true));
    button.prepend(spin);
    if (content) { content.setAttribute("data-ax-hidden", "delayed"); content.setAttribute("aria-hidden", "true"); }
    // Button's polite region: written on the next frame, so it is heard.
    if (live) requestAnimationFrame(() => { if (button.getAttribute("aria-busy") === "true") live.textContent = L("Loading", "Cargando"); });
  } else {
    if (button.getAttribute("aria-busy") !== "true") return;
    button.removeAttribute("aria-busy");
    if (button.hasAttribute("data-busy-refuses")) {
      button.removeAttribute("data-busy-refuses");
      button.removeAttribute("aria-disabled");
      if (!isToggle(button)) button.removeAttribute("data-ax-disabled-interaction");
    }
    if (button.hasAttribute("data-busy-label")) { button.removeAttribute("data-busy-label"); button.removeAttribute("aria-label"); }
    button.querySelector(":scope > .ax-button-spinner")?.remove();
    if (content) { content.removeAttribute("data-ax-hidden"); content.removeAttribute("aria-hidden"); }
    if (live) live.textContent = "";
  }
}

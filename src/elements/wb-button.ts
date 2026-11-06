// What the lesson page's buttons, segments and cards share (Astryx's Button, disabled-with-reason and Tooltip rules):
//
//   trackPress(root, selector)       press feedback: data-pressed on the pressed control from pointerdown until the
//                                    lift, a slide off or a cancel (CSS paints the overlay and the 0.98 scale)
//   setDisabled(el, on, reason?)     disabled the focusable way: aria-disabled="true", never the native attribute,
//                                    so the control keeps its Tab stop and its focus; a text field also turns
//                                    readOnly. With a reason, a tooltip says why (setReason).
//   setReason(el, text | null)       the reason a control is disabled: a tooltip (role="tooltip", in the top layer)
//                                    that describes el (aria-describedby) and opens on hover, on keyboard focus and
//                                    on a tap of the disabled control; Escape closes it
//   setBusy(button, on)              an action that hasn't finished: aria-busy at once, activation refused
//                                    (aria-disabled) at full opacity, and after 310 ms the label hides (keeping its
//                                    space) under a spinner; "Loading" is said once
//   isRefused(el)                    true while el (or its group) is disabled or busy: activation does nothing
//
// A reason tooltip can also be written into the page at build time (Experiment.astro does, for Run): any element with
// data-wb-tip="<id of a [role=tooltip] element>" gets the same behaviour, from listeners on the document.
// Node-safe: Experiment.astro imports wb-experiment at build time, which imports this module.
import { announce } from "../runtime/announce";
import { showsFocusRing } from "../runtime/modality";
import { L, still } from "../runtime/wb";

const SPINNER_DELAY = 310; // --ux-duration-medium-min: fast actions never flash a spinner
const TIP_DELAY = 200; // hover delay before a tooltip opens
const TIP_BRIDGE = 100; // time to move the pointer from the control onto its tooltip

export const isRefused = (el: Element) =>
  el.getAttribute("aria-busy") === "true" || el.closest('[aria-disabled="true"]') !== null;

// ---------- press feedback ----------
const tracked = new WeakSet<Element>();
/** data-pressed on the control under a primary-button press, from pointerdown until it lifts, slides off or is
 *  cancelled. Not on a disabled or busy control. */
export function trackPress(root: Element, selector: string) {
  if (tracked.has(root)) return;
  tracked.add(root);
  root.addEventListener("pointerdown", (e) => {
    const ev = e as PointerEvent;
    if (ev.button !== 0) return;
    const el = (ev.target as Element).closest?.(selector);
    if (!el || !root.contains(el) || isRefused(el)) return;
    el.setAttribute("data-pressed", "");
    const end = () => {
      el.removeAttribute("data-pressed");
      el.removeEventListener("pointerleave", end);
      removeEventListener("pointerup", end, true);
      removeEventListener("pointercancel", end, true);
    };
    el.addEventListener("pointerleave", end);
    addEventListener("pointerup", end, true);
    addEventListener("pointercancel", end, true);
  });
}

// ---------- describedby ----------
const ids = (el: Element) => (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
function describe(el: Element, id: string, on: boolean) {
  const list = ids(el).filter((x) => x !== id);
  if (on) list.push(id);
  if (list.length) el.setAttribute("aria-describedby", list.join(" "));
  else el.removeAttribute("aria-describedby");
}

// ---------- reason tooltips ----------
let n = 0;
let open: { tip: HTMLElement; trigger: HTMLElement } | null = null;
let showTimer: ReturnType<typeof setTimeout> | null = null, hideTimer: ReturnType<typeof setTimeout> | null = null;

const tipOf = (trigger: Element) => {
  const id = trigger.getAttribute("data-wb-tip");
  return id ? document.getElementById(id) : null;
};
const triggerOf = (node: EventTarget | null) =>
  node instanceof Element ? node.closest<HTMLElement>("[data-wb-tip]") : null;
const clearTimers = () => {
  if (showTimer !== null) clearTimeout(showTimer);
  if (hideTimer !== null) clearTimeout(hideTimer);
  showTimer = hideTimer = null;
};

function place(tip: HTMLElement, trigger: HTMLElement) {
  const r = trigger.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const x = Math.max(8, Math.min(r.left, vw - w - 8));
  const y = r.top - 4 - h >= 8 ? r.top - 4 - h : r.bottom + 4; // above, else below
  tip.style.left = `${Math.round(x)}px`;
  tip.style.top = `${Math.round(y)}px`;
}
function hide() {
  clearTimers();
  if (!open) return;
  try { open.tip.hidePopover(); } catch { /* closed */ }
  open = null;
}
function show(trigger: HTMLElement) {
  clearTimers();
  // A reason shows only while its control is disabled.
  const tip = tipOf(trigger);
  if (!tip || trigger.getAttribute("aria-disabled") !== "true" || trigger.hasAttribute("data-busy-refuses") || !("showPopover" in tip)) return;
  if (open && open.tip !== tip) hide();
  try { if (!tip.matches(":popover-open")) tip.showPopover(); } catch { return; }
  open = { tip, trigger };
  place(tip, trigger);
}

let listening = false;
/** Installs the document listeners that open and close reason tooltips (once per page). */
export function ensureTips() {
  if (listening || typeof document === "undefined") return;
  listening = true;
  const hover = matchMedia("(hover: hover)");
  document.addEventListener("pointerover", (e) => {
    if ((e as PointerEvent).pointerType !== "mouse" || !hover.matches) return;
    const t = triggerOf(e.target);
    const onTip = open && e.target instanceof Node && open.tip.contains(e.target);
    if (onTip || (t && open?.trigger === t)) { if (hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null; } return; }
    if (t) { clearTimers(); showTimer = setTimeout(() => show(t), TIP_DELAY); }
  });
  document.addEventListener("pointerout", (e) => {
    if ((e as PointerEvent).pointerType !== "mouse") return;
    const from = triggerOf(e.target) ?? (open && e.target instanceof Node && open.tip.contains(e.target) ? open.trigger : null);
    if (!from) return;
    const to = (e as PointerEvent).relatedTarget;
    if (to instanceof Node && (from.contains(to) || (open && open.tip.contains(to)))) return;
    if (showTimer !== null) { clearTimeout(showTimer); showTimer = null; }
    if (open) { if (hideTimer !== null) clearTimeout(hideTimer); hideTimer = setTimeout(hide, TIP_BRIDGE); }
  });
  document.addEventListener("focusin", (e) => {
    const t = triggerOf(e.target);
    if (t && showsFocusRing(e.target as Element)) show(t);
    else if (open && !(t && open.trigger === t)) hide();
  });
  document.addEventListener("focusout", (e) => {
    if (open && triggerOf(e.target) === open.trigger) hide();
  });
  // A tap (or click) on a disabled control opens its reason; a press anywhere else closes it.
  document.addEventListener("click", (e) => {
    const t = triggerOf(e.target);
    if (t && t.getAttribute("aria-disabled") === "true") show(t);
  });
  document.addEventListener("pointerdown", (e) => {
    if (open && !(e.target instanceof Node && (open.trigger.contains(e.target) || open.tip.contains(e.target)))) hide();
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open && !e.isComposing) hide();
  });
  addEventListener("scroll", () => { if (open) place(open.tip, open.trigger); }, { capture: true, passive: true });
  addEventListener("resize", () => { if (open) place(open.tip, open.trigger); }, { passive: true });
}

/** Sets (text) or removes (null) the reason el is disabled; it shows only while el is aria-disabled. */
export function setReason(el: HTMLElement, text: string | null) {
  ensureTips();
  let tip = tipOf(el);
  if (text === null) {
    if (tip) { if (open?.tip === tip) hide(); describe(el, tip.id, false); tip.remove(); }
    el.removeAttribute("data-wb-tip");
    return;
  }
  if (!tip) {
    tip = document.createElement("span");
    tip.id = `wb-tip-${++n}`;
    tip.className = "wb-tip";
    tip.setAttribute("role", "tooltip");
    tip.setAttribute("popover", "manual");
    (el.closest("wb-lesson, main") ?? document.body).append(tip);
    el.setAttribute("data-wb-tip", tip.id);
  }
  if (tip.textContent !== text) tip.textContent = text;
  describe(el, tip.id, el.getAttribute("aria-disabled") === "true");
  if (open?.tip === tip) place(tip, el);
}

/** Disables (or enables) a control without taking it out of the Tab order. A reason (or null to drop it) is
 *  optional; without one an existing reason is kept and shown again next time. */
export function setDisabled(el: HTMLElement, on: boolean, reason?: string | null) {
  if (on) el.setAttribute("aria-disabled", "true");
  else el.removeAttribute("aria-disabled");
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.readOnly = on;
  const tip = tipOf(el);
  if (reason !== undefined) setReason(el, reason);
  else if (tip) describe(el, tip.id, on);
  if (!on && open?.trigger === el) hide();
}

// ---------- busy ----------
const spinners = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
/** Marks an action as pending (on) or done (off). The button keeps its size, its focus and its Tab stop. */
export function setBusy(button: HTMLElement, on: boolean) {
  const t = spinners.get(button);
  if (t !== undefined) { clearTimeout(t); spinners.delete(button); }
  if (on) {
    if (button.getAttribute("aria-busy") === "true") return;
    button.setAttribute("aria-busy", "true");
    // Refuses activation while pending; the busy look (full opacity) wins over the disabled one in CSS.
    if (button.getAttribute("aria-disabled") !== "true") button.setAttribute("data-busy-refuses", "");
    button.setAttribute("aria-disabled", "true");
    const spin = () => {
      spinners.delete(button);
      button.setAttribute("data-busy", "");
      if (!button.querySelector(":scope > .wb-spin")) {
        const s = document.createElement("span");
        s.className = "wb-spin";
        s.setAttribute("aria-hidden", "true");
        button.append(s);
      }
      announce(L("Loading", "Cargando"));
    };
    if (still.matches) spin();
    else spinners.set(button, setTimeout(spin, SPINNER_DELAY));
  } else {
    if (button.getAttribute("aria-busy") !== "true") return;
    button.removeAttribute("aria-busy");
    button.removeAttribute("data-busy");
    if (button.hasAttribute("data-busy-refuses")) { button.removeAttribute("data-busy-refuses"); button.removeAttribute("aria-disabled"); }
    button.querySelector(":scope > .wb-spin")?.remove();
  }
}

// How the reader last interacted with the page: "keyboard" or "pointer", kept on <html data-ux-modality>.
//
// :focus-visible stays the condition that draws a focus ring (styles/ux.css). The modality is a gate beside it, so a
// programmatic focus (focus handed back to a trigger, a dialog's first control) shows a ring only after keyboard
// input, in every browser. Base.astro renders data-ux-modality="keyboard" into the HTML (no input yet: a restored or
// initial focus should show) and inlines trackModality() in <head>, so it hears the first key or tap.
// ux.css hides the ring under data-ux-modality="pointer", except on text fields, which ring when clicked so the
// reader sees where typing goes.

export type Modality = "keyboard" | "pointer";

/** Listens, in the capture phase, for the input that sets the modality: pointerdown → "pointer"; a keydown without
 *  Meta, Alt or Ctrl → "keyboard" (holding a modifier for a click is not navigation). Writes the attribute only when
 *  it changes. Self-contained: Base.astro inlines its source, so no imports or outer variables. */
export function trackModality(root: HTMLElement) {
  const set = (m: string) => { if (root.getAttribute("data-ux-modality") !== m) root.setAttribute("data-ux-modality", m); };
  const opts = { capture: true, passive: true };
  document.addEventListener("pointerdown", () => set("pointer"), opts);
  document.addEventListener("keydown", (e) => { if (!(e.metaKey || e.altKey || e.ctrlKey)) set("keyboard"); }, opts);
}

/** The last modality ("keyboard" until the first pointer press). */
export const modality = (): Modality =>
  document.documentElement.getAttribute("data-ux-modality") === "pointer" ? "pointer" : "keyboard";

const TEXT_ENTRY = 'textarea, [contenteditable]:not([contenteditable="false"]), input:not([type="button" i], [type="submit" i], [type="reset" i], [type="checkbox" i], [type="radio" i], [type="range" i], [type="color" i], [type="file" i], [type="image" i])';

/** True for a field the reader types into (ux.css rings these even after a pointer press). */
export const isTextEntry = (el: Element) => el.matches(TEXT_ENTRY);

/** Whether el's focus shows a ring right now: the same test ux.css makes (:focus-visible, gated by the modality). */
export const showsFocusRing = (el: Element) =>
  el.matches(":focus-visible") && (modality() === "keyboard" || isTextEntry(el));

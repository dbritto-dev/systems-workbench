// How the reader last interacted with the page, on <html data-astryx-modality="keyboard|pointer|virtual">.
//
// One tracker for the page: astryx-astro's (astryx-astro/elements/runtime/modality, contract #19), which its components
// use to decide whether focus they move shows a ring, and which styles/ux.css reads to gate the ring of every other
// :focus-visible element. keyboard: the default (no input yet: a restored or initial focus should show), and any
// keydown without Meta, Alt or Ctrl; pointer: a pointerdown; virtual: a click no key or pointer started (a screen
// reader), treated like pointer. ux.css hides the ring on a programmatic focus unless the modality is keyboard, except
// on text fields, which ring when clicked so the reader sees where typing goes.
//
// Astryx's module is an ES module, so it loads after the first paint (and only on pages with an interactive Astryx
// component), possibly after the reader's first key or tap. So Base.astro renders data-astryx-modality="keyboard" and
// inlines startModality() in <head>: it creates the state Astryx's module keeps (its page-wide singleton, a WeakMap
// from the document to { modality, pointerType, pressedAt, listeners }) and adds the same three capture listeners.
// When Astryx's module loads it finds that state and adds none of its own, so there is one set of document listeners
// and getModality() / onModalityChange() see every input since the head ran. If Astryx changes the state's shape it
// bumps the key's version, finds nothing, and starts its own tracker writing the same attribute: still correct.
import { getModality, type InteractionModality } from "astryx-astro/elements/runtime/modality";

export type Modality = InteractionModality;

/** Starts tracking before the first paint, as Astryx's modality module would (see above). Self-contained: Base.astro
 *  inlines its source, so no imports or outer variables. Mirrors astryx-astro src/elements/runtime/modality.ts. */
export function startModality(doc: Document) {
  const key = Symbol.for("astryx-astro/modality/v1");
  const g = globalThis as unknown as Record<symbol, WeakMap<Document, unknown> | undefined>;
  let stores = g[key];
  if (!stores) {
    stores = new WeakMap();
    Object.defineProperty(g, key, { value: stores, configurable: true });
  }
  if (stores.has(doc)) return;
  type Store = { modality: string; pointerType: string | null; pressedAt: number; listeners: Set<(m: string) => void> };
  const store: Store = { modality: "keyboard", pointerType: null, pressedAt: -Infinity, listeners: new Set() };
  stores.set(doc, store);
  const root = doc.documentElement;
  const write = (next: string) => {
    if (store.modality === next && root.getAttribute("data-astryx-modality") === next) return;
    const changed = store.modality !== next;
    store.modality = next;
    root.setAttribute("data-astryx-modality", next);
    if (changed) for (const fn of [...store.listeners]) fn(next);
  };
  const opts = { capture: true, passive: true };
  doc.addEventListener("pointerdown", (e) => {
    store.pointerType = e.pointerType || null;
    store.pressedAt = e.timeStamp;
    write("pointer");
  }, opts);
  doc.addEventListener("keydown", (e) => {
    if (e.metaKey || e.altKey || e.ctrlKey) return;
    store.pressedAt = e.timeStamp;
    write("keyboard");
  }, opts);
  doc.addEventListener("click", (e) => {
    const type = (e as PointerEvent).pointerType;
    if (e.isTrusted && e.detail === 0 && !type && e.timeStamp - store.pressedAt > 1000) write("virtual");
  }, opts);
  if (!root.hasAttribute("data-astryx-modality")) root.setAttribute("data-astryx-modality", store.modality);
}

/** The last modality ("keyboard" until the first pointer press). */
export const modality = (): Modality => getModality();

const TEXT_ENTRY = 'textarea, [contenteditable]:not([contenteditable="false"]), input:not([type="button" i], [type="submit" i], [type="reset" i], [type="checkbox" i], [type="radio" i], [type="range" i], [type="color" i], [type="file" i], [type="image" i])';

/** True for a field the reader types into (ux.css rings these even after a pointer press). */
export const isTextEntry = (el: Element) => el.matches(TEXT_ENTRY);

/** Whether el's focus shows a ring right now: the same test ux.css makes (:focus-visible, gated by the modality). */
export const showsFocusRing = (el: Element) =>
  el.matches(":focus-visible") && (modality() === "keyboard" || isTextEntry(el));

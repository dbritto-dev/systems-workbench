// Roving tabindex for a composite control: a one-of-N group (radiogroup, segmented control, tablist) or a toolbar.
// The group is one Tab stop; the arrow keys move between its members (Astryx's useListFocus and useKeyboardHint).
//
//   const nav = roving(seg, {
//     items: "button[data-value]",
//     current: () => seg.querySelector('[aria-checked="true"]'),   // the Tab stop at rest: the selected member
//     select: (b) => b.click(),                                    // selection follows focus (one-of-N groups)
//   });
//
// - Tab stop: tabindex="0" on one member, "-1" on the rest. At rest it is current() (kept even when that member is
//   disabled), else the first member that isn't skipped; while focus is inside, the focused member. Set by script
//   only: without JavaScript every member stays its own Tab stop, so the group still works.
// - Keys (on a focused member; none with Alt, Ctrl, Meta or Shift): horizontal (the default) ← → in the direction
//   the member is rendered, resolved at key time (they swap under RTL); vertical ↑ ↓; "both" all four. They wrap
//   (wrap: false stops at the ends), and skip members that are aria-disabled, natively disabled or not rendered.
//   Home and End go to the first and last. Other keys pass through: Space and Enter activate the button natively.
//   In a text field the arrows move the caret until it reaches that end, and Home and End stay the field's.
// - Selection: select(member) runs after a move by arrow, Home or End when you pass it (make it do nothing for the
//   member that is already selected). Tabbing into the group never selects anything.
// - Caller first: a keydown handler on a member, or one on the group added before roving(), can preventDefault() to
//   veto the move; roving() ignores keys already handled, so a nested group (a segmented control in a toolbar) keeps
//   its own arrows.
// - Hint: when keyboard focus enters the group from outside, a "← → to navigate" badge (EN/ES from <html lang>) shows
//   below the focused member: popover="manual" in the top layer, aria-hidden, not under the pointer. It follows focus
//   inside the group, goes on the first arrow key, when focus leaves, or after 3 s, and never shows again for the
//   group. hint: "name" shares "never again" among the groups with that name on the page; hint: false turns it off.

import { isTextEntry, showsFocusRing } from "./modality";

export type Orientation = "horizontal" | "vertical" | "both";

export interface RovingOptions {
  /** The members, in order: a selector inside the group, or a function. Default "button". */
  items?: string | (() => HTMLElement[]);
  /** Which arrows move. Default "horizontal". */
  orientation?: Orientation;
  /** Wrap from the last member to the first and back. Default true. */
  wrap?: boolean;
  /** The member that holds the Tab stop at rest (the selected one). Default: the first member that isn't skipped. */
  current?: () => HTMLElement | null | undefined;
  /** Selection follows focus: called with the member an arrow, Home or End moved to. */
  select?: (item: HTMLElement) => void;
  /** Members the arrows pass over. Default: aria-disabled="true", disabled, or not rendered. */
  skip?: (item: HTMLElement) => boolean;
  /** The arrow-key hint: true (default) once for this group, a name to show it once for every group with that
   *  name on the page, false never. */
  hint?: boolean | string;
}

export interface Roving {
  /** The members now. */
  items(): HTMLElement[];
  /** Puts the Tab stop back on current() (call it after the selection changes while focus is outside). */
  sync(): void;
  /** Moves the Tab stop to a member and focuses it (no select). */
  focus(item: HTMLElement): void;
  /** Removes the listeners and any hint; leaves the tabindex values. */
  destroy(): void;
}

const HINT_TEXT = { en: "to navigate", es: "para navegar" } as const;
const ARROWS: Record<Orientation, string[]> = { horizontal: ["←", "→"], vertical: ["↑", "↓"], both: ["←", "→", "↑", "↓"] };
const HINT_MS = 3000;
const seenHints = new Set<string>();

const skipDefault = (el: HTMLElement) =>
  el.getAttribute("aria-disabled") === "true" || (el as HTMLButtonElement).disabled === true || el.getClientRects().length === 0;

export function roving(group: HTMLElement, options: RovingOptions = {}): Roving {
  const { orientation = "horizontal", wrap = true, current, select, skip = skipDefault, hint = true } = options;
  const items = (): HTMLElement[] => {
    const it = options.items ?? "button";
    return typeof it === "function" ? it() : [...group.querySelectorAll<HTMLElement>(it)];
  };
  const memberOf = (node: EventTarget | null) => {
    if (!(node instanceof Element)) return undefined;
    return items().find((i) => i === node || i.contains(node));
  };
  const setStop = (stop: HTMLElement | undefined) => {
    for (const i of items()) {
      const v = i === stop ? "0" : "-1";
      if (i.getAttribute("tabindex") !== v) i.setAttribute("tabindex", v);
    }
  };
  const sync = () => {
    const all = items(), c = current?.();
    setStop(c && all.includes(c) ? c : all.find((i) => !skip(i)) ?? all[0]);
  };

  // ---------- the arrow-key hint ----------
  const hintKey = typeof hint === "string" ? hint : null;
  let hintSeen = hint === false || (hintKey !== null && seenHints.has(hintKey));
  let badge: HTMLElement | null = null, anchor: HTMLElement | null = null, timer: ReturnType<typeof setTimeout> | null = null;
  const place = () => {
    if (!badge || !anchor) return;
    const r = anchor.getBoundingClientRect(), w = badge.offsetWidth, h = badge.offsetHeight;
    const rtl = getComputedStyle(anchor).direction === "rtl";
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const x = Math.max(8, Math.min(rtl ? r.right - w : r.left, vw - w - 8));
    const y = r.bottom + 8 + h <= vh - 8 ? r.bottom + 8 : r.top - 8 - h;
    badge.style.left = `${Math.round(x)}px`;
    badge.style.top = `${Math.round(y)}px`;
  };
  const dismiss = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    anchor = null;
    removeEventListener("scroll", place, true);
    removeEventListener("resize", place);
    const b = badge;
    badge = null;
    if (!b) return;
    try { b.hidePopover(); } catch { /* already closed */ }
    setTimeout(() => b.remove(), 200); // after the fade
  };
  const showHint = (at: HTMLElement) => {
    if (hintSeen || !("showPopover" in HTMLElement.prototype)) return;
    if (items().filter((i) => !skip(i)).length < 2) return;
    hintSeen = true;
    if (hintKey !== null) seenHints.add(hintKey);
    const es = (at.closest("[lang]")?.getAttribute("lang") ?? "").startsWith("es");
    const b = document.createElement("div");
    b.className = "ux-hint";
    b.setAttribute("popover", "manual");
    b.setAttribute("aria-hidden", "true");
    for (const a of ARROWS[orientation]) b.append(Object.assign(document.createElement("kbd"), { textContent: a }));
    b.append(es ? HINT_TEXT.es : HINT_TEXT.en);
    document.body.append(b);
    badge = b;
    anchor = at;
    b.showPopover();
    place();
    addEventListener("scroll", place, { capture: true, passive: true });
    addEventListener("resize", place, { passive: true });
    timer = setTimeout(dismiss, HINT_MS);
  };

  // ---------- events ----------
  const onFocusIn = (e: FocusEvent) => {
    const m = memberOf(e.target);
    if (!m) return;
    setStop(m);
    const fromOutside = !(e.relatedTarget instanceof Node && group.contains(e.relatedTarget));
    if (badge) { anchor = m; place(); }
    else if (fromOutside && showsFocusRing(e.target as Element)) showHint(m);
  };
  const onFocusOut = (e: FocusEvent) => {
    if (e.relatedTarget instanceof Node && group.contains(e.relatedTarget)) return;
    dismiss();
    if (current) sync();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key.startsWith("Arrow")) dismiss();
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const from = memberOf(e.target);
    if (!from) return;
    const t = e.target as HTMLElement;
    const rtl = getComputedStyle(from).direction === "rtl";
    const horiz = orientation !== "vertical", vert = orientation !== "horizontal";
    let step = 0, to: "first" | "last" | null = null;
    if (horiz && e.key === "ArrowLeft") step = rtl ? 1 : -1;
    else if (horiz && e.key === "ArrowRight") step = rtl ? -1 : 1;
    else if (vert && e.key === "ArrowUp") step = -1;
    else if (vert && e.key === "ArrowDown") step = 1;
    else if (e.key === "Home") to = "first";
    else if (e.key === "End") to = "last";
    else return;
    // In a text field the caret moves first; the field keeps Home and End.
    if (isTextEntry(t) && t instanceof HTMLInputElement) {
      if (to) return;
      // step already follows the rendered direction, so step < 0 is toward the start of the text.
      const back = step < 0, at = back ? t.selectionStart : t.selectionEnd;
      if (at !== null && (back ? at > 0 : at < t.value.length)) return;
    } else if (isTextEntry(t)) return;
    const all = items(), ok = all.filter((i) => !skip(i));
    let next: HTMLElement | undefined;
    if (to === "first") next = ok[0];
    else if (to === "last") next = ok[ok.length - 1];
    else {
      const n = all.length;
      for (let k = 1, i = all.indexOf(from); k <= n; k++) {
        let j = i + step * k;
        if (!wrap && (j < 0 || j >= n)) break;
        j = ((j % n) + n) % n;
        if (!skip(all[j])) { next = all[j]; break; }
      }
    }
    e.preventDefault();
    if (!next || next === from) return;
    setStop(next);
    next.focus();
    select?.(next);
  };

  group.addEventListener("focusin", onFocusIn);
  group.addEventListener("focusout", onFocusOut);
  group.addEventListener("keydown", onKeyDown);
  sync();

  return {
    items,
    sync,
    focus(item) { setStop(item); item.focus(); },
    destroy() {
      group.removeEventListener("focusin", onFocusIn);
      group.removeEventListener("focusout", onFocusOut);
      group.removeEventListener("keydown", onKeyDown);
      dismiss();
    },
  };
}

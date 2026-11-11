// The collection page's area filters: Astryx's SegmentedControl in a strip that scrolls sideways when it doesn't fit,
// with ‹ › buttons and a fade at an edge that has more chips past it (markup in components/collection/Toolbar.astro).
//
// markArea() checks the chip the URL's search asks for, and measureStrip() sets the strip's scroll state. Toolbar.astro
// inlines both functions' source right after the strip, so they run while the page is parsed and the first paint
// already shows the right chip, buttons and fades; <lesson-collection> calls measureStrip again on scroll, on resize
// and once the fonts have loaded. Keep them self-contained: no imports, no outer variables. They only write an
// attribute when its value changes, so nothing flips back and forth.

/** Checks the chip for the URL's area filter (?f=area.is.Data): "All" with none, that area's chip with exactly one
 *  "Area is" of one area, no chip otherwise (several areas, or "Area is not …"). It writes what
 *  <ax-segmented-control> writes when its value changes (aria-checked, data-selected, the hover overlay class on the
 *  unchecked chips, the one Tab stop on the checked chip, else the first), so the element finds a consistent state
 *  when it connects. <lesson-collection> keeps it so through the element's `value`. */
export function markArea(wrap: Element) {
  let want: string | null = "all";
  try {
    const areas = new URLSearchParams(location.search).getAll("f").filter((f) => f.startsWith("area."));
    const one = areas.length === 1 ? /^area\.is\.([^,]+)$/.exec(areas[0]) : null;
    want = areas.length === 0 ? "all" : one ? one[1] : null;
  } catch { /* no URL: the markup's "All" */ }
  const chips = [...wrap.querySelectorAll<HTMLElement>('[role="radio"][data-value]')];
  const stop = chips.find((b) => b.dataset.value === want) ?? chips[0];
  const set = (b: HTMLElement, name: string, value: string | null) => {
    if (b.getAttribute(name) !== value) value === null ? b.removeAttribute(name) : b.setAttribute(name, value);
  };
  chips.forEach((b) => {
    const on = b.dataset.value === want;
    set(b, "aria-checked", String(on));
    set(b, "data-selected", on ? "selected" : null);
    set(b, "tabindex", b === stop ? "0" : "-1");
    if (b.classList.contains("ax-overlay-bg") === on) b.classList.toggle("ax-overlay-bg", !on);
  });
}

/** Marks the strip's wrapper data-fits (every chip shows), data-more-left / data-more-right (chips past that edge),
 *  and marks the ‹ › button that has nothing left to scroll to aria-disabled (it keeps its Tab stop and focus). */
export function measureStrip(wrap: Element) {
  const strip = wrap.querySelector<HTMLElement>(".filters");
  if (!strip) return;
  const set = (name: string, on: boolean) => { if (wrap.hasAttribute(name) !== on) wrap.toggleAttribute(name, on); };
  const fits = strip.scrollWidth <= wrap.clientWidth + 2;
  set("data-fits", fits);
  const max = strip.scrollWidth - strip.clientWidth;
  const left = !fits && strip.scrollLeft > 2;
  const right = !fits && strip.scrollLeft < max - 2;
  set("data-more-left", left);
  set("data-more-right", right);
  const arrows = wrap.querySelectorAll<HTMLElement>("[data-scroll]");
  const off = (b: HTMLElement | undefined, on: boolean) => {
    if (b && (b.getAttribute("aria-disabled") === "true") !== !on) b.setAttribute("aria-disabled", String(!on));
  };
  off(arrows[0], left);
  off(arrows[1], right);
}

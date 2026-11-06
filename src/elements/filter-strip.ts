// The collection page's area filters: a strip of chips that scrolls sideways when it doesn't fit, with ‹ › buttons
// and a fade at an edge that has more chips past it (markup in components/collection/Toolbar.astro).
//
// markArea() checks the chip the URL's search asks for, and measureStrip() sets the strip's scroll state. Toolbar.astro
// inlines both functions' source right after the strip, so they run while the page is parsed and the first paint
// already shows the right chip, buttons and fades; <lesson-collection> calls measureStrip again on scroll, on resize
// and once the fonts have loaded. Keep them self-contained: no imports, no outer variables. They only write an
// attribute when its value changes, so nothing flips back and forth.

/** Checks the chip for the URL's area filter (?f=area.is.Data): "All" with none, that area's chip with exactly one
 *  "Area is" of one area, no chip otherwise (several areas, or "Area is not …"). <lesson-collection> keeps it so. */
export function markArea(wrap: Element) {
  let want: string | null = "all";
  try {
    const areas = new URLSearchParams(location.search).getAll("f").filter((f) => f.startsWith("area."));
    const one = areas.length === 1 ? /^area\.is\.([^,]+)$/.exec(areas[0]) : null;
    want = areas.length === 0 ? "all" : one ? one[1] : null;
  } catch { /* no URL: the markup's "All" */ }
  wrap.querySelectorAll<HTMLElement>("[data-filter]").forEach((b) => {
    const on = String(b.dataset.filter === want);
    if (b.getAttribute("aria-checked") !== on) b.setAttribute("aria-checked", on);
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
  const arrows = wrap.querySelectorAll<HTMLButtonElement>("[data-scroll]");
  const off = (b: HTMLButtonElement | undefined, on: boolean) => {
    if (b && (b.getAttribute("aria-disabled") === "true") !== !on) b.setAttribute("aria-disabled", String(!on));
  };
  off(arrows[0], left);
  off(arrows[1], right);
}

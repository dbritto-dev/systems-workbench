// The collection page's area filters: a strip of chips that scrolls sideways when it doesn't fit, with ‹ › buttons
// and a fade at an edge that has more chips past it (markup in components/collection/Toolbar.astro).
//
// measureStrip() sets that state. Toolbar.astro inlines this function's source right after the strip, so the strip is
// measured while the page is parsed and the first paint already shows the right buttons and fades; <lesson-collection>
// calls it again on scroll, on resize and once the fonts have loaded. Keep it self-contained: no imports, no outer
// variables. It only writes an attribute when its value changes, so nothing flips back and forth.

/** Marks the strip's wrapper data-fits (every chip shows), data-more-left / data-more-right (chips past that edge),
 *  and disables the ‹ › button that has nothing left to scroll to. */
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
  if (arrows[0] && arrows[0].disabled !== !left) arrows[0].disabled = !left;
  if (arrows[1] && arrows[1].disabled !== !right) arrows[1].disabled = !right;
}

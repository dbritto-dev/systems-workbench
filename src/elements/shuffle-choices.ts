/** Puts a card's prediction options (the [data-choice] children of its .choices group) in a random order
 *  (Fisher–Yates), letters them A, B, C… in that order, and marks the group data-shuffled so it happens once.
 *  components/lesson/Experiment.astro inlines this function's source into each card, right after its options, so the
 *  first paint already shows the new order; <wb-experiment> runs it too, for a card that missed it. Keep it
 *  self-contained: no imports, no outer variables. (Its own module, with no imports, because Experiment.astro also
 *  imports it at build time, in Node.) Only [data-choice] children move: the group can hold other nodes, such as the
 *  module <script> Astro writes after the first SelectableCard on the page. */
export function shuffleChoices(group: Element) {
  if (group.hasAttribute("data-shuffled")) return;
  const items = Array.from(group.children).filter((c) => c.hasAttribute("data-choice"));
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = items[i]; items[i] = items[j]; items[j] = t;
  }
  items.forEach((b, k) => {
    group.appendChild(b);
    const mark = b.querySelector(".mark");
    if (mark) mark.textContent = "ABCDE".charAt(k);
  });
  group.setAttribute("data-shuffled", "");
}

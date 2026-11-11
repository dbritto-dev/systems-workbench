// <wb-experiment exp="burst" answer="2">: one predict-then-run card (markup from components/lesson/Experiment.astro).
// A prediction's data-choice is its index in the lesson's options, not its place on the card: the options are
// shuffled every time the page loads (./shuffle-choices.ts, inlined into the card so the first paint has the new
// order; this element runs it too, for a card that missed it), so the right answer is never in a fixed place.
//
// The predictions are astryx-astro SelectableCards (type="radio") in a radiogroup: Astryx gives the whole-card click
// (not when the click ends a text selection), Enter, the hover and press paint and the focus ring; the native radios
// give one Tab stop and arrows that move and select. This element adds what a prediction needs on top: picking one
// enables Run (an Astryx Button, disabled with its reason as a Tooltip until then); running locks the cards
// (aria-readonly: clicks, arrows, Space and Enter change nothing), marks the right one and the reader's pick in
// words as well as colour, writes the verdict and reveals the result (its ProgressBars were rendered at build
// time and grow in as they appear), and says the verdict through the page's polite live region.
//
// The result: worked out at build time by the lesson's page.ts (predict.experiments[i].result, see withResults),
// already in the page's language: the bars in the markup, the verdict in <script type="application/json"
// data-result>. Running a card needs no lesson code at all.
//
// "Watch it on the machine" sends "wb-watch", { id, watch } (watch: the experiment's settings from page.ts), then
// scrolls to the machine. <wb-lesson> keeps the event until the live code has loaded, so an early click isn't lost;
// until then the button is busy (and refuses a second press).
import { announce } from "../runtime/announce";
import { L, still } from "../runtime/wb";
import { shuffleChoices } from "./shuffle-choices";
import { isRefused, relabel, setBusy, setDisabled } from "./wb-button";

export { shuffleChoices };
export interface WatchDetail { id: string; watch: unknown }

const NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", " ", "Enter"]);

type Lesson = HTMLElement & { readonly mounted?: boolean; start?: () => Promise<void> };

export class WbExperiment extends HTMLElement {
  #picked: number | null = null;
  get id() { return this.getAttribute("exp") ?? ""; }
  get answer() { return Number(this.getAttribute("answer")); }
  /** The prediction cards, in their shown order. */
  get choices() { return [...this.querySelectorAll<HTMLElement>("[data-choice]")]; }
  get #radios() { return [...this.querySelectorAll<HTMLInputElement>(".choices input[type=radio]")]; }
  get #group() { return this.querySelector<HTMLElement>(".choices"); }
  get runButton() { return this.querySelector<HTMLButtonElement>("[data-run]")!; }
  get watchButton() { return this.querySelector<HTMLButtonElement>("[data-watch]"); }
  get done() { return this.hasAttribute("data-done"); }

  connectedCallback() {
    this.addEventListener("click", this.#click);
    this.addEventListener("change", this.#change);
    this.addEventListener("keydown", this.#key);
    this.shuffle();
    // A prediction the browser kept (back/forward cache) counts as picked.
    const kept = this.#radios.find((r) => r.checked);
    if (kept && this.#picked === null) this.pick(Number(kept.value));
  }
  disconnectedCallback() {
    this.removeEventListener("click", this.#click);
    this.removeEventListener("change", this.#change);
    this.removeEventListener("keydown", this.#key);
  }

  /** Shuffles the options, unless the page already did (or the card has been run). */
  shuffle() {
    const group = this.#group;
    if (group && !this.done) shuffleChoices(group);
  }

  #click = (e: Event) => {
    const t = e.target as Element;
    // Locked after a run: the radio's click (a card click is forwarded to it by Astryx) is cancelled, which undoes it.
    if (t instanceof HTMLInputElement && t.type === "radio") { if (this.done) e.preventDefault(); return; }
    if (t.closest("[data-run]")) return this.run();
    if (t.closest("[data-watch]")) return this.watch();
  };
  #change = (e: Event) => {
    const r = e.target as HTMLInputElement;
    if (r.type === "radio" && r.checked && this.contains(r)) this.pick(Number(r.value));
  };
  #key = (e: KeyboardEvent) => {
    const r = e.target as HTMLElement;
    if (!(r instanceof HTMLInputElement) || r.type !== "radio" || e.isComposing || e.keyCode === 229) return;
    // Locked after a run: the arrows, Space and Enter change nothing.
    if (this.done && NAV_KEYS.has(e.key)) e.preventDefault();
  };

  /** Picks prediction i (its index in the lesson's options) and enables Run. */
  pick(i: number) {
    if (this.done) return;
    this.#picked = i;
    const r = this.#radios.find((x) => Number(x.value) === i);
    if (r && !r.checked) r.checked = true;
    setDisabled(this.runButton, false);
  }

  run() {
    if (this.#picked === null || this.done) return;
    const btn = this.runButton;
    const data = this.querySelector("script[data-result]")?.textContent;
    if (!data) { console.error(`experiment "${this.id}" has no result`); return; }
    const result: { verdict: string } = JSON.parse(data);
    const right = this.#picked === this.answer;
    for (const card of this.choices) {
      const j = Number(card.dataset.choice);
      const verdict = j === this.answer ? "right" : j === this.#picked ? "wrong" : null;
      if (!verdict) continue;
      card.dataset.verdict = verdict;
      // In words too, not only in colour.
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = verdict === "wrong" ? L("Your prediction", "Tu predicción") : j === this.#picked ? L("Your prediction · right", "Tu predicción · correcta") : L("Right answer", "Respuesta correcta");
      card.append(tag);
    }
    this.#group?.setAttribute("aria-readonly", "true");
    relabel(btn, L("Done", "Listo"));
    setDisabled(btn, true, null);
    const verdict = (right ? L("Your prediction held. ", "Tu predicción se cumplió. ") : L("Not what you predicted. ", "No es lo que predijiste. ")) + result.verdict;
    this.querySelector("[data-outcome]")!.textContent = verdict;
    // Reveals the result; its bars grow from empty as they appear (lesson CSS, @starting-style).
    this.setAttribute("data-done", "");
    announce(verdict);
  }

  watch() {
    const btn = this.watchButton;
    if (btn && isRefused(btn)) return;
    const data = this.querySelector("script[data-watch-settings]")?.textContent;
    const detail: WatchDetail = { id: this.id, watch: data ? JSON.parse(data) : undefined };
    this.dispatchEvent(new CustomEvent("wb-watch", { bubbles: true, detail }));
    // Before the live code is in, the press waits for it (<wb-lesson> keeps the event): busy until then.
    const lesson = this.closest<Lesson>("wb-lesson");
    if (btn && lesson && lesson.mounted === false && lesson.start) {
      setBusy(btn, true);
      lesson.start().then(() => setBusy(btn, false), () => setBusy(btn, false));
    }
    document.getElementById(this.getAttribute("watch-target") || "machine")?.scrollIntoView({ behavior: still.matches ? "auto" : "smooth" });
  }
}

if (!customElements.get("wb-experiment")) customElements.define("wb-experiment", WbExperiment);

declare global {
  interface HTMLElementTagNameMap {
    "wb-experiment": WbExperiment;
  }
}

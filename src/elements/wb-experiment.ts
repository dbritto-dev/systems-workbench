// <wb-experiment exp="burst" answer="2">: one predict-then-run card (markup from components/lesson/Experiment.astro).
// A choice's data-choice is its index in the lesson's options, not its place on the card: the options are shuffled every
// time the page loads, so the right answer is never in a fixed place. shuffleChoices() below does it. Each card carries
// its own copy and runs it right after its options, while the HTML is parsed, so the first paint already shows the new
// order (this module only loads after parsing). The element runs it too, for a card that missed it.
//
// The predictions behave like Astryx's SelectableCard in a single-choice group: native radios (one Tab stop, arrows
// move and select, a card never deselects itself), plus Enter selects, a click that ends a text selection doesn't,
// press feedback, and one focus ring on the card. Run is disabled with its reason until a prediction is picked;
// running locks the choices (aria-readonly), marks the right one and the reader's pick in words as well as colour,
// shows the verdict and the result bars (role="meter"), and says the verdict through the page's polite live region.
//
// The result: the card's <script type="application/json" data-result>, worked out at build time by the lesson's
// page.ts (predict.experiments[i].result, see withResults), already in the page's language. Running a card needs no
// lesson code at all.
//
// "Watch it on the machine" sends "wb-watch", { id, watch } (watch: the experiment's settings from page.ts), then
// scrolls to the machine. <wb-lesson> keeps the event until the live code has loaded, so an early click isn't lost;
// until then the button is busy (and refuses a second press).
import { announce } from "../runtime/announce";
import { L, still } from "../runtime/wb";
import { ensureTips, isRefused, setBusy, setDisabled, setReason, trackPress } from "./wb-button";

/** One bar: label, share of the track (0–1), the value text, and whether it's the "after" bar (drawn accented). */
export type ResultBar = [label: string, share: number, text: string, after?: boolean];
/** An experiment's result: a verdict and bars, or bars in titled groups. */
export interface Result { verdict: string; bars?: ResultBar[]; groups?: { title: string; bars: ResultBar[] }[] }
export interface WatchDetail { id: string; watch: unknown }

/** Puts a card's options (the children of .choices) in a random order (Fisher–Yates), letters them A, B, C… in that
 *  order, and marks the group data-shuffled so it happens once. Components/lesson/Experiment.astro inlines this
 *  function's source into each card, so keep it self-contained: no imports, no outer variables. */
export function shuffleChoices(group: Element) {
  if (group.hasAttribute("data-shuffled")) return;
  const items = Array.from(group.children);
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

// The base class is a stand-in at build time, when Experiment.astro imports shuffleChoices in Node.
const Base = (globalThis.HTMLElement ?? Object) as typeof HTMLElement;
const NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", " ", "Enter"]);

type Lesson = HTMLElement & { readonly mounted?: boolean; start?: () => Promise<void> };

export class WbExperiment extends Base {
  #picked: number | null = null;
  #selAtDown = "";
  get id() { return this.getAttribute("exp") ?? ""; }
  get answer() { return Number(this.getAttribute("answer")); }
  /** The prediction cards (labels), in their shown order. */
  get choices() { return [...this.querySelectorAll<HTMLElement>("[data-choice]")]; }
  get #radios() { return [...this.querySelectorAll<HTMLInputElement>(".choices input[type=radio]")]; }
  get #group() { return this.querySelector<HTMLElement>(".choices"); }
  get runButton() { return this.querySelector<HTMLButtonElement>("[data-run]")!; }
  get watchButton() { return this.querySelector<HTMLButtonElement>("[data-watch]"); }
  get done() { return this.hasAttribute("data-done"); }

  connectedCallback() {
    ensureTips();
    trackPress(this, ".choice, .btn");
    this.addEventListener("click", this.#click);
    this.addEventListener("change", this.#change);
    this.addEventListener("keydown", this.#key);
    this.addEventListener("pointerdown", this.#down);
    this.shuffle();
    // A prediction the browser kept (back/forward cache) counts as picked.
    const kept = this.#radios.find((r) => r.checked);
    if (kept && this.#picked === null) this.pick(Number(kept.value));
  }
  disconnectedCallback() {
    this.removeEventListener("click", this.#click);
    this.removeEventListener("change", this.#change);
    this.removeEventListener("keydown", this.#key);
    this.removeEventListener("pointerdown", this.#down);
  }

  /** Shuffles the options, unless the page already did (or the card has been run). */
  shuffle() {
    const group = this.#group;
    if (group && !this.done) shuffleChoices(group);
  }

  // The selection before a press, so a click can tell whether it made a new one.
  #down = () => { this.#selAtDown = getSelection()?.toString() ?? ""; };
  #click = (e: Event) => {
    const t = e.target as Element;
    const card = t.closest<HTMLElement>(".choice");
    if (card && this.contains(card)) {
      // Locked after a run. A click on the card (not the label's forwarded click on its radio) that ends a new
      // text selection in it selects nothing.
      if (this.done) { e.preventDefault(); return; }
      const sel = getSelection();
      if (!(t instanceof HTMLInputElement) && sel && !sel.isCollapsed && card.contains(sel.anchorNode) && sel.toString() !== this.#selAtDown) e.preventDefault();
      return;
    }
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
    if (this.done) { if (NAV_KEYS.has(e.key)) e.preventDefault(); return; }
    // A native radio ignores Enter; a card selects on it.
    if (e.key === "Enter" && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); if (!r.checked) r.click(); }
  };

  /** Picks prediction i (its index in the lesson's options) and enables Run. */
  pick(i: number) {
    if (this.done) return;
    this.#picked = i;
    const r = this.#radios.find((x) => Number(x.value) === i);
    if (r && !r.checked) r.checked = true;
    const btn = this.runButton;
    setReason(btn, null);
    setDisabled(btn, false);
  }

  run() {
    if (this.#picked === null || this.done) return;
    const btn = this.runButton;
    const data = this.querySelector("script[data-result]")?.textContent;
    if (!data) { console.error(`experiment "${this.id}" has no result`); return; }
    const result: Result = JSON.parse(data);
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
    btn.textContent = L("Done", "Listo");
    setDisabled(btn, true);
    this.setAttribute("data-done", "");
    announce(this.#show(result, right));
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

  /** Fills the result and returns the verdict as written. */
  #show(result: Result, right: boolean) {
    let n = 0;
    const bar = ([label, share, text, after]: ResultBar) => {
      const el = document.createElement("div");
      el.className = "bar";
      if (after) el.setAttribute("data-after", "");
      const l = document.createElement("span"), track = document.createElement("span"), fill = document.createElement("span"), b = document.createElement("b");
      const pct = Math.max(1, Math.round(100 * share));
      l.textContent = label; l.id = `${this.id || "exp"}-bar${++n}-${Math.random().toString(36).slice(2, 7)}`;
      // A share of the result, not progress: a meter, named by its label, valued by its visible text.
      track.className = "track";
      track.setAttribute("role", "meter");
      track.setAttribute("aria-labelledby", l.id);
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", String(pct));
      track.setAttribute("aria-valuetext", text);
      fill.className = "fill";
      fill.dataset.fill = `${pct}%`;
      b.textContent = text;
      b.setAttribute("aria-hidden", "true"); // the meter says it
      track.append(fill); el.append(l, track, b);
      return el;
    };
    const groups = result.groups ?? [{ title: "", bars: result.bars ?? [] }];
    this.querySelector("[data-bars]")!.replaceChildren(...groups.flatMap((g) => {
      const head = g.title ? [Object.assign(document.createElement("div"), { className: "bar-group", textContent: g.title })] : [];
      return [...head, ...g.bars.map(bar)];
    }));
    const verdict = (right ? L("Your prediction held. ", "Tu predicción se cumplió. ") : L("Not what you predicted. ", "No es lo que predijiste. ")) + result.verdict;
    this.querySelector("[data-outcome]")!.textContent = verdict;
    // The fills grow from 0 on the compositor (transform); under reduced motion they land at once.
    requestAnimationFrame(() => requestAnimationFrame(() => this.querySelectorAll<HTMLElement>(".fill").forEach((f) => f.style.setProperty("--fill", f.dataset.fill!))));
    return verdict;
  }
}

if (globalThis.customElements && !customElements.get("wb-experiment")) customElements.define("wb-experiment", WbExperiment);

declare global {
  interface HTMLElementTagNameMap {
    "wb-experiment": WbExperiment;
  }
}

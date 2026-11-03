// <wb-experiment exp="burst" answer="2">: one predict-then-run card (markup from components/lesson/Experiments.astro).
// The reader picks a prediction, runs it, and the card shows the verdict and the result bars.
//
// The result: the card's <script type="application/json" data-result>, worked out at build time by the lesson's
// page.ts (predict.experiments[i].result, see withResults), already in the page's language. Running a card needs no
// lesson code at all.
//
// "Watch it on the machine" sends "wb-watch", { id, watch } (watch: the experiment's settings from page.ts), then
// scrolls to the machine. <wb-lesson> keeps the event until the live code has loaded, so an early click isn't lost.
import { L, still } from "../runtime/wb";

/** One bar: label, share of the track (0–1), the value text, and whether it's the "after" bar (drawn accented). */
export type ResultBar = [label: string, share: number, text: string, after?: boolean];
/** An experiment's result: a verdict and bars, or bars in titled groups. */
export interface Result { verdict: string; bars?: ResultBar[]; groups?: { title: string; bars: ResultBar[] }[] }
export interface WatchDetail { id: string; watch: unknown }

export class WbExperiment extends HTMLElement {
  #picked: number | null = null;
  get id() { return this.getAttribute("exp") ?? ""; }
  get answer() { return Number(this.getAttribute("answer")); }
  get choices() { return [...this.querySelectorAll<HTMLButtonElement>("[data-choice]")]; }
  get runButton() { return this.querySelector<HTMLButtonElement>("[data-run]")!; }
  get done() { return this.hasAttribute("data-done"); }

  connectedCallback() { this.addEventListener("click", this.#click); }
  disconnectedCallback() { this.removeEventListener("click", this.#click); }

  #click = (e: Event) => {
    const t = e.target as Element;
    const choice = t.closest<HTMLButtonElement>("[data-choice]");
    if (choice) return this.pick(Number(choice.dataset.choice));
    if (t.closest("[data-run]")) return this.run();
    if (t.closest("[data-watch]")) return this.watch();
  };

  pick(i: number) {
    if (this.done) return;
    this.#picked = i;
    this.choices.forEach((x, j) => x.setAttribute("aria-pressed", String(j === i)));
    this.runButton.disabled = false;
    this.runButton.textContent = L("Run the experiment", "Ejecutar el experimento");
  }

  run() {
    if (this.#picked === null || this.done) return;
    const btn = this.runButton;
    btn.disabled = true;
    const data = this.querySelector("script[data-result]")?.textContent;
    if (!data) { console.error(`experiment "${this.id}" has no result`); btn.disabled = false; return; }
    const result: Result = JSON.parse(data);
    const right = this.#picked === this.answer;
    this.choices.forEach((x, j) => { x.disabled = true; if (j === this.answer) x.dataset.verdict = "right"; else if (j === this.#picked) x.dataset.verdict = "wrong"; });
    this.#show(result, right);
    btn.textContent = L("Done", "Listo");
    this.setAttribute("data-done", "");
  }

  watch() {
    const data = this.querySelector("script[data-watch-settings]")?.textContent;
    const detail: WatchDetail = { id: this.id, watch: data ? JSON.parse(data) : undefined };
    this.dispatchEvent(new CustomEvent("wb-watch", { bubbles: true, detail }));
    document.getElementById(this.getAttribute("watch-target") || "machine")?.scrollIntoView({ behavior: still.matches ? "auto" : "smooth" });
  }

  #show(result: Result, right: boolean) {
    const bar = ([label, , text, after]: ResultBar) => {
      const el = document.createElement("div");
      el.className = "bar";
      if (after) el.setAttribute("data-after", "");
      const l = document.createElement("span"), track = document.createElement("span"), fill = document.createElement("span"), b = document.createElement("b");
      l.textContent = label; track.className = "track"; fill.className = "fill"; fill.style.width = "0"; b.textContent = text;
      track.append(fill); el.append(l, track, b);
      return el;
    };
    const groups = result.groups ?? [{ title: "", bars: result.bars ?? [] }];
    const all = groups.flatMap((g) => g.bars);
    this.querySelector("[data-bars]")!.replaceChildren(...groups.flatMap((g) => {
      const head = g.title ? [Object.assign(document.createElement("div"), { className: "bar-group", textContent: g.title })] : [];
      return [...head, ...g.bars.map(bar)];
    }));
    this.querySelector("[data-outcome]")!.textContent = (right ? L("Your prediction held. ", "Tu predicción se cumplió. ") : L("Not what you predicted. ", "No es lo que predijiste. ")) + result.verdict;
    requestAnimationFrame(() => requestAnimationFrame(() => this.querySelectorAll<HTMLElement>(".fill").forEach((f, i) => { f.style.width = Math.max(1, Math.round(100 * all[i][1])) + "%"; })));
  }
}

if (!customElements.get("wb-experiment")) customElements.define("wb-experiment", WbExperiment);

declare global {
  interface HTMLElementTagNameMap {
    "wb-experiment": WbExperiment;
  }
}

// <lesson-preview index="…/search-index.json" locale="en">: a closer look at a lesson without leaving the
// collection (the machine large, the lede, the five experiments). Markup from components/collection/PreviewDialog.astro.
// Opens on the "lesson-preview" event a card sends (see <lesson-collection>), or with el.open(card).
import { loadIndex, picker, two, PREVIEW_EVENT, type Locale, type PreviewDetail } from "./lesson-index";

export class LessonPreview extends HTMLElement {
  get dialog() { return this.querySelector("dialog")!; }

  connectedCallback() {
    document.addEventListener(PREVIEW_EVENT, this.#onPreview);
    this.addEventListener("click", this.#click);
  }
  disconnectedCallback() {
    document.removeEventListener(PREVIEW_EVENT, this.#onPreview);
    this.removeEventListener("click", this.#click);
  }
  #onPreview = (e: Event) => void this.open((e as CustomEvent<PreviewDetail>).detail.card);
  #click = (e: Event) => {
    const t = e.target as Element;
    if (t === this.dialog || t.closest("[data-close]")) this.dialog.close();
  };

  /** Fill the dialog from a card (its images, counts and link) and the index (the rest), then show it. */
  async open(card: HTMLElement) {
    const { L, T } = picker((this.getAttribute("locale") === "es" ? "es" : "en") as Locale);
    const dlg = this.dialog;
    const d = <E extends HTMLElement = HTMLElement>(k: string) => dlg.querySelector<E>(`[data-d="${k}"]`)!;
    const imgs = card.querySelectorAll<HTMLImageElement>(".shot img");
    d<HTMLImageElement>("light").src = imgs[0]?.currentSrc || imgs[0]?.src || "";
    d<HTMLImageElement>("light").alt = imgs[0]?.alt || "";
    d<HTMLImageElement>("dark").src = imgs[1]?.currentSrc || imgs[1]?.src || "";
    const l = (await loadIndex(this.getAttribute("index")!)).find((x) => x.slug === card.dataset.slug)!;
    d("no").textContent = T("Lesson ", "Lección ") + two(l.n);
    d("machine").textContent = L(l.machine);
    d("area").textContent = L(l.area);
    d("concept").textContent = L(l.concept);
    d("title").textContent = L(l.title);
    d("lede").textContent = L(l.lede);
    d("exps").replaceChildren(...l.exps.map((e, i) => {
      const li = document.createElement("li"), n = document.createElement("span"), body = document.createElement("div"), b = document.createElement("b"), em = document.createElement("em");
      n.textContent = two(i + 1); b.textContent = L(e.title); em.textContent = L(e.question);
      body.append(b, em); li.append(n, body); return li;
    }));
    d("counts").textContent = card.querySelector(".counts")!.textContent;
    d<HTMLAnchorElement>("url").href = card.querySelector<HTMLAnchorElement>(".btn.primary")!.href;
    if (!dlg.open) dlg.showModal();
  }
}

if (!customElements.get("lesson-preview")) customElements.define("lesson-preview", LessonPreview);

declare global {
  interface HTMLElementTagNameMap {
    "lesson-preview": LessonPreview;
  }
}

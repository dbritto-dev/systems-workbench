// <lesson-preview index="…/search-index.json" locale="en">: a closer look at a lesson without leaving the
// collection (the machine large, the lede, the five experiments). Markup from components/collection/PreviewDialog.astro.
// Opens on the "lesson-preview" event a card sends (see <lesson-collection>), or with el.open(card, opener).
//
// Dialog behaviour (Astryx's Dialog, on the native modal <dialog>): showModal() makes the page behind inert and moves
// focus to the dialog's first control; Escape (the dialog's cancel) and Close close it; so does a press that starts
// and ends on the backdrop (not a text selection dragged out of the dialog). On close, focus goes back to the button
// that opened it, without scrolling, with the ring only if the last input was the keyboard (styles/ux.css). While it
// is open, runtime/announce.ts reads messages from regions inside it. If a second preview is asked for while the
// first is still loading, the newer one wins.
import { loadIndex, picker, two, PREVIEW_EVENT, type Locale, type PreviewDetail } from "./lesson-index";

export class LessonPreview extends HTMLElement {
  #opener: HTMLElement | null = null;
  #card: HTMLElement | null = null;
  #seq = 0;
  #downOnBackdrop = false;

  get dialog() { return this.querySelector("dialog")!; }

  connectedCallback() {
    document.addEventListener(PREVIEW_EVENT, this.#onPreview);
    this.addEventListener("pointerdown", this.#down);
    this.addEventListener("click", this.#click);
    this.dialog.addEventListener("close", this.#closed);
  }
  disconnectedCallback() {
    document.removeEventListener(PREVIEW_EVENT, this.#onPreview);
    this.removeEventListener("pointerdown", this.#down);
    this.removeEventListener("click", this.#click);
    this.dialog.removeEventListener("close", this.#closed);
  }
  #onPreview = (e: Event) => { const d = (e as CustomEvent<PreviewDetail>).detail; void this.open(d.card, d.opener); };
  #down = (e: PointerEvent) => { this.#downOnBackdrop = e.target === this.dialog; };
  #click = (e: MouseEvent) => {
    const t = e.target as Element;
    if (t.closest("[data-close]")) this.dialog.close();
    // The backdrop is the dialog element itself (its content fills it): close only for a press that began there too.
    else if (t === this.dialog && this.#downOnBackdrop) this.dialog.close();
    this.#downOnBackdrop = false;
  };
  #closed = () => {
    const to = [this.#opener, this.#card?.querySelector<HTMLElement>(".card-link")].find((el) => el?.isConnected && el.getClientRects().length > 0);
    this.#opener = this.#card = null;
    to?.focus({ preventScroll: true });
  };

  /** Fill the dialog from a card (its images, counts and link) and the index (the rest), then show it. Focus returns
   *  to opener (else the card's link) when it closes. */
  async open(card: HTMLElement, opener?: HTMLElement) {
    const seq = ++this.#seq;
    const { L, T } = picker((this.getAttribute("locale") === "es" ? "es" : "en") as Locale);
    const dlg = this.dialog;
    const docs = await loadIndex(this.getAttribute("index")!);
    if (seq !== this.#seq) return;   // a newer preview was asked for meanwhile
    const l = docs.find((x) => x.slug === card.dataset.slug);
    if (!l) return;
    const d = <E extends HTMLElement = HTMLElement>(k: string) => dlg.querySelector<E>(`[data-d="${k}"]`)!;
    const imgs = card.querySelectorAll<HTMLImageElement>(".shot img");
    d<HTMLImageElement>("light").src = imgs[0]?.currentSrc || imgs[0]?.src || "";
    d<HTMLImageElement>("light").alt = imgs[0]?.alt || "";
    d<HTMLImageElement>("dark").src = imgs[1]?.currentSrc || imgs[1]?.src || "";
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
    this.#card = card;
    this.#opener = opener ?? (document.activeElement instanceof HTMLElement && card.contains(document.activeElement) ? document.activeElement : null);
    if (!dlg.open) dlg.showModal();
  }
}

if (!customElements.get("lesson-preview")) customElements.define("lesson-preview", LessonPreview);

declare global {
  interface HTMLElementTagNameMap {
    "lesson-preview": LessonPreview;
  }
}

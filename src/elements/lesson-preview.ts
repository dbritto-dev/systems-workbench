// <lesson-preview index="…/search-index.json" locale="en">: a closer look at a lesson without leaving the
// collection (the machine large, the lede, the five experiments). Markup from components/collection/PreviewDialog.astro.
// Opens on the "lesson-preview" event a card sends (see <lesson-collection>), or with el.open(card, opener).
//
// This element only fills the dialog in; Astryx's Dialog (<ax-dialog>) does the rest: showing it modal, focus in and
// back to the opener, Escape, the backdrop press, Tab containment, announcements from inside. If a second preview is
// asked for while the first is still loading, the newer one wins.
import "astryx-astro/elements/dialog";
import type { DialogElement } from "astryx-astro/elements/dialog";
import { loadIndex, picker, two, PREVIEW_EVENT, type Locale, type PreviewDetail } from "./lesson-index";

export class LessonPreview extends HTMLElement {
  #seq = 0;

  get host() { return this.querySelector<DialogElement>("ax-dialog")!; }

  connectedCallback() { document.addEventListener(PREVIEW_EVENT, this.#onPreview); }
  disconnectedCallback() { document.removeEventListener(PREVIEW_EVENT, this.#onPreview); }
  #onPreview = (e: Event) => { const d = (e as CustomEvent<PreviewDetail>).detail; void this.open(d.card, d.opener); };

  /** Fill the dialog from a card (its images, counts and link) and the index (the rest), then show it. Focus returns
   *  to opener (else whatever had focus) when it closes. */
  async open(card: HTMLElement, opener?: HTMLElement) {
    const seq = ++this.#seq;
    const { L, T } = picker((this.getAttribute("locale") === "es" ? "es" : "en") as Locale);
    const host = this.host;
    const dlg = host.dialog!;
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
    d<HTMLAnchorElement>("url").href = card.querySelector<HTMLAnchorElement>("[data-open]")!.href;
    if (!host.isOpen) host.show({ source: opener ?? null });
  }
}

if (!customElements.get("lesson-preview")) customElements.define("lesson-preview", LessonPreview);

declare global {
  interface HTMLElementTagNameMap {
    "lesson-preview": LessonPreview;
  }
}

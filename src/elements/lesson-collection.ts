// <lesson-collection index="…/search-index.json" locale="en">: the collection page's area filters, search and
// cards (components/collection/Toolbar.astro and the card grid, in pages/[...lang]/index.astro). The search engine
// and the index load only when someone searches or arrives with ?q=. Typing is debounced (results follow 150 ms
// after the last key, and at least every 500 ms while typing), and a render only touches what changed. A card's Preview button sends a
// "lesson-preview" event, which <lesson-preview> opens on.
import type { SearchRun } from "../lib/search";
import { debounce } from "../lib/timing";
import { loadIndex, picker, PREVIEW_EVENT, type Locale, type PreviewDetail } from "./lesson-index";

export class LessonCollection extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready) return;
    this.dataset.ready = "";
    init(this);
  }
}

function init(root: HTMLElement) {
  const grid = root.querySelector<HTMLElement>("main.grid")!;
  const locale = (root.getAttribute("locale") === "es" ? "es" : "en") as Locale;
  const { L, T } = picker(locale);
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const index = () => loadIndex(root.getAttribute("index")!);

  // ---- area filters ----
  const filters = [...root.querySelectorAll<HTMLButtonElement>("[data-filter]")];
  let area = "all";
  let search: Awaited<ReturnType<typeof startSearch>> | null = null;
  const setFilter = (a: string) => {
    area = a;
    filters.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === a)));
    if (search) search.render();
    else grid.querySelectorAll<HTMLElement>(".card").forEach((c) => { c.hidden = a !== "all" && c.dataset.area !== a; });
  };
  filters.forEach((b) => b.addEventListener("click", () => { setFilter(b.dataset.filter!); b.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce() ? "auto" : "smooth" }); }));

  const strip = root.querySelector<HTMLElement>(".filters")!, wrap = root.querySelector<HTMLElement>(".filters-wrap")!;
  const arrows = wrap.querySelectorAll<HTMLButtonElement>("[data-scroll]");
  const edges = () => {
    wrap.removeAttribute("data-fits");
    const max = strip.scrollWidth - strip.clientWidth;
    if (max <= 2) { wrap.setAttribute("data-fits", ""); wrap.removeAttribute("data-more-left"); wrap.removeAttribute("data-more-right"); return; }
    const left = strip.scrollLeft > 2, right = strip.scrollLeft < max - 2;
    wrap.toggleAttribute("data-more-left", left);
    wrap.toggleAttribute("data-more-right", right);
    arrows[0].disabled = !left;
    arrows[1].disabled = !right;
  };
  arrows.forEach((b) => b.addEventListener("click", () => strip.scrollBy({ left: Number(b.dataset.scroll) * Math.max(120, strip.clientWidth * 0.75), behavior: reduce() ? "auto" : "smooth" })));
  strip.addEventListener("scroll", edges, { passive: true });
  addEventListener("resize", edges);
  strip.addEventListener("wheel", (e) => {
    if (strip.scrollWidth <= strip.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const max = strip.scrollWidth - strip.clientWidth;
    if ((e.deltaY < 0 && strip.scrollLeft <= 0) || (e.deltaY > 0 && strip.scrollLeft >= max)) return;
    e.preventDefault();
    strip.scrollLeft += e.deltaY;
  }, { passive: false });
  edges();

  // ---- previews: <lesson-preview> opens on this event; hovering a Preview button starts fetching the index ----
  root.querySelectorAll<HTMLElement>("[data-preview]").forEach((b) => {
    b.addEventListener("click", () => b.dispatchEvent(new CustomEvent<PreviewDetail>(PREVIEW_EVENT, { bubbles: true, detail: { card: b.closest<HTMLElement>(".card")! } })));
    b.addEventListener("pointerenter", () => void index(), { once: true });
  });

  // ---- search: the engine and the index load on first use ----
  const input = root.querySelector<HTMLInputElement>("input[type=search]")!;
  let starting: Promise<unknown> | null = null;
  const ensureSearch = () => (starting ??= startSearch().then((s) => { search = s; s.render(); }));
  // Results follow the typing without re-rendering on every key: 150 ms after the last key, at least every 500 ms
  // during a long burst. Clearing the box shows every lesson again at once.
  const typed = debounce(() => search?.render(), 150, { maxWait: 500 });
  input.addEventListener("focus", () => void ensureSearch(), { once: true });
  input.addEventListener("input", (e) => {
    if ((e as InputEvent).isComposing) return;   // an accent or IME still being composed: wait for compositionend
    if (!search) return void ensureSearch();
    if (!input.value.trim()) { typed.cancel(); search.render(); } else typed();
  });
  input.addEventListener("compositionend", () => { if (search) typed(); });
  try { const q = new URLSearchParams(location.search).get("q"); if (q) { input.value = q; void ensureSearch(); } } catch {}
  document.addEventListener("keydown", (e) => {
    const el = document.activeElement as HTMLElement | null;
    const typing = !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
    if (((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) && !document.querySelector("dialog[open]")) {
      e.preventDefault(); input.focus(); input.select();
    }
  });

  async function startSearch() {
    const [{ createSearch, fold, stem, terms, WORD }, docs] = await Promise.all([import("../lib/search"), index()]);
    const engine = createSearch(docs);
    const bySlug = new Map(docs.map((l) => [l.slug, l]));
    const status = root.querySelector<HTMLElement>("[data-status]")!;
    const empty = root.querySelector<HTMLElement>("[data-empty]")!;
    const cards = [...grid.querySelectorAll<HTMLElement>(".card")];
    const shown = new Map<HTMLElement, string>();
    cards.forEach((c) => c.querySelectorAll<HTMLElement>("h2, .card-body > p").forEach((e) => shown.set(e, e.textContent ?? "")));
    const areaName = (a: string) => filters.find((b) => b.dataset.filter === a)?.firstChild?.textContent?.trim() ?? a;

    // What each element last showed, so a render leaves unchanged cards alone.
    const marked = new Map<HTMLElement, string>();
    const hitKey = new Map<HTMLElement, string>();
    const keyOf = (set?: Set<string>) => (set && set.size ? [...set].sort().join(" ") : "");
    const setText = (el: Element, text: string) => { if (el.textContent !== text) el.textContent = text; };

    const mark = (el: HTMLElement, text: string, set?: Set<string>) => {
      el.textContent = "";
      if (!set || !set.size) { el.textContent = text; return; }
      const folded = fold(text), re = new RegExp(WORD.source, "g");
      let at = 0;
      for (let m: RegExpExecArray | null; (m = re.exec(folded)); ) {
        if (!set.has(stem(m[0]))) continue;
        el.append(text.slice(at, m.index));
        const k = document.createElement("mark");
        k.textContent = text.slice(m.index, m.index + m[0].length);
        el.append(k);
        at = m.index + m[0].length;
      }
      el.append(text.slice(at));
    };

    // "In Experiment 3 · Thundering herd" under a card whose match isn't in its title or blurb.
    const hitLine = (card: HTMLElement, r?: { terms: Set<string> }) => {
      const key = r ? keyOf(r.terms) || " " : "";
      if (hitKey.get(card) === key) return;
      hitKey.set(card, key);
      const line = card.querySelector<HTMLElement>(".hit")!;
      line.hidden = true;
      if (!r) return;
      const l = bySlug.get(card.dataset.slug!)!;
      const count = (s: string) => terms(s).filter((t) => r.terms.has(t)).length;
      if (count([l.title, l.blurb, l.concept, l.machine, l.area].map(L).join(" "))) return;
      const spots = [
        ...l.exps.map((e, i) => ({ kind: "exp", i, text: [L(e.title), L(e.question), L(e.change)].find((x) => count(x)) ?? L(e.title), n: count(L(e.title)) * 2 + count(`${L(e.change)} ${L(e.question)}`) })),
        ...l.qs.map((q, i) => ({ kind: "q", i, text: L(q), n: count(L(q)) })),
      ].filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
      const hit = spots[0];
      if (!hit) return;
      const k = document.createElement("b");
      k.textContent = (hit.kind === "exp" ? T("Experiment ", "Experimento ") : T("Question ", "Pregunta ")) + (hit.i + 1);
      const text = document.createElement("span");
      mark(text, hit.text, r.terms);
      line.replaceChildren(T("In ", "En "), k, " · ", text);
      line.title = hit.text;
      line.hidden = false;
    };

    const quote = (q: string) => `“${q}”`;
    let last = "\u0000";
    const render = () => {
      typed.cancel();
      const q = input.value.trim();
      const key = q.replace(/\s+/g, " ") + "\u0000" + area;
      if (key === last) return;   // the same words (spacing aside) in the same area: nothing to redo
      last = key;
      const res: SearchRun | null = q ? engine.run(q) : null;
      const hits = res ? new Map(res.results.map((x, i) => [x.lesson.slug, { ...x, rank: i }])) : null;
      // Ranked order while searching, lesson order otherwise. Moving nodes keeps tab order matching what you see;
      // they move only when the order changes.
      const rank = (c: HTMLElement) => (hits?.get(c.dataset.slug!)?.rank ?? 1e6 + cards.indexOf(c));
      const order = [...cards].sort((a, b) => rank(a) - rank(b));
      const now = [...grid.querySelectorAll<HTMLElement>(":scope > .card")];
      if (order.some((c, i) => now[i] !== c)) order.forEach((c) => grid.insertBefore(c, empty));
      const per: Record<string, number> = { all: 0 };
      let visible = 0;
      for (const c of cards) {
        const r = hits?.get(c.dataset.slug!);
        const match = !hits || !!r;
        if (match) { per.all++; per[c.dataset.area!] = (per[c.dataset.area!] ?? 0) + 1; }
        const hide = !match || (area !== "all" && c.dataset.area !== area);
        if (c.hidden !== hide) c.hidden = hide;
        if (!hide) visible++;
        const k = keyOf(r?.terms);
        c.querySelectorAll<HTMLElement>("h2, .card-body > p").forEach((e) => { if (marked.get(e) !== k) { marked.set(e, k); mark(e, shown.get(e)!, r?.terms); } });
        hitLine(c, r);
      }
      filters.forEach((b) => { const n = per[b.dataset.filter!] ?? 0; setText(b.querySelector("b")!, String(n)); if (b.hasAttribute("data-zero") !== (n === 0)) b.toggleAttribute("data-zero", n === 0); });

      const inArea = area === "all" ? "" : areaName(area);
      let msg = "";
      if (res) {
        const n = per.all;
        if (res.mode === "none") msg = T(`No lesson matches ${quote(q)}.`, `Ninguna lección coincide con ${quote(q)}.`);
        else if (res.mode === "some") msg = T(`No lesson has every word; ${n} ${n === 1 ? "has" : "have"} some of them.`, `Ninguna lección tiene todas las palabras; ${n} ${n === 1 ? "tiene" : "tienen"} alguna.`);
        else msg = T(`${n} ${n === 1 ? "lesson matches" : "lessons match"} ${quote(q)}`, `${n} ${n === 1 ? "lección coincide" : "lecciones coinciden"} con ${quote(q)}`);
        if (inArea && n) msg += T(` · ${visible} in ${inArea}`, ` · ${visible} en ${inArea}`);
      }
      setText(status, msg);
      const nothing = !!res && visible === 0;
      if (empty.hidden !== !nothing) empty.hidden = !nothing;
      if (nothing) {
        const elsewhere = per.all > 0;
        setText(empty.querySelector("p")!, elsewhere
          ? T(`None in ${inArea}. The other matches are in other areas.`, `Ninguna en ${inArea}. Las demás coincidencias están en otras áreas.`)
          : T("Try another word, in English or Spanish, or clear the search.", "Prueba otra palabra, en inglés o en español, o borra la búsqueda."));
        empty.querySelector<HTMLElement>("[data-all]")!.hidden = !elsewhere;
      }
      try {
        const u = new URL(location.href);
        if (q) u.searchParams.set("q", q); else u.searchParams.delete("q");
        if (u.href !== location.href) history.replaceState(null, "", u);
      } catch {}
    };

    const clear = () => { input.value = ""; render(); input.focus(); };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { if (input.value) { e.preventDefault(); clear(); } else input.blur(); }
      if (e.key === "Enter") { render(); const first = grid.querySelector<HTMLElement>(":scope > .card:not([hidden])"); if (first) { e.preventDefault(); first.querySelector<HTMLElement>(".btn.primary")!.focus(); } }
    });
    empty.querySelector("[data-clear]")!.addEventListener("click", clear);
    empty.querySelector("[data-all]")!.addEventListener("click", () => filters.find((b) => b.dataset.filter === "all")!.click());
    return { render };
  }
}

if (!customElements.get("lesson-collection")) customElements.define("lesson-collection", LessonCollection);

declare global {
  interface HTMLElementTagNameMap {
    "lesson-collection": LessonCollection;
  }
}

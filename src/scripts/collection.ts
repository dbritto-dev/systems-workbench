// The collection page in the browser: area filters, the preview dialog and search. The search engine and the
// index (every lesson's text, both languages) load only when someone searches, arrives with ?q=, or opens a preview.
import type { SearchDoc } from "../lib/search-index";
import type { SearchRun } from "../lib/search";

type Locale = "en" | "es";
type Bi = string | { en: string; es: string };

export function initCollection() {
  const grid = document.querySelector<HTMLElement>("main.grid")!;
  const locale = (grid.dataset.locale === "es" ? "es" : "en") as Locale;
  const L = (v: Bi) => (typeof v === "string" ? v : v[locale]);
  const T = (en: string, es: string) => (locale === "es" ? es : en);
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const two = (n: number) => String(n).padStart(2, "0");

  // ---- the index, fetched once on demand ----
  let indexP: Promise<SearchDoc[]> | null = null;
  const index = () => (indexP ??= fetch(grid.dataset.index!).then((r) => r.json() as Promise<SearchDoc[]>));

  // ---- area filters ----
  const filters = [...document.querySelectorAll<HTMLButtonElement>("[data-filter]")];
  let area = "all";
  let search: Awaited<ReturnType<typeof startSearch>> | null = null;
  const setFilter = (a: string) => {
    area = a;
    filters.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === a)));
    if (search) search.render();
    else document.querySelectorAll<HTMLElement>(".card").forEach((c) => { c.hidden = a !== "all" && c.dataset.area !== a; });
  };
  filters.forEach((b) => b.addEventListener("click", () => { setFilter(b.dataset.filter!); b.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce() ? "auto" : "smooth" }); }));

  const strip = document.querySelector<HTMLElement>(".filters")!, wrap = document.querySelector<HTMLElement>(".filters-wrap")!;
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

  // ---- preview dialog ----
  const dlg = document.getElementById("preview") as HTMLDialogElement;
  const d = <E extends HTMLElement = HTMLElement>(k: string) => dlg.querySelector<E>(`[data-d="${k}"]`)!;
  const open = async (slug: string) => {
    const card = document.querySelector<HTMLElement>(`.card[data-slug="${slug}"]`)!;
    const imgs = card.querySelectorAll<HTMLImageElement>(".shot img");
    d<HTMLImageElement>("light").src = imgs[0]?.currentSrc || imgs[0]?.src || "";
    d<HTMLImageElement>("light").alt = imgs[0]?.alt || "";
    d<HTMLImageElement>("dark").src = imgs[1]?.currentSrc || imgs[1]?.src || "";
    const l = (await index()).find((x) => x.slug === slug)!;
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
  };
  document.querySelectorAll<HTMLElement>("[data-preview]").forEach((b) => {
    b.addEventListener("click", () => open(b.dataset.preview!));
    b.addEventListener("pointerenter", () => void index(), { once: true });
  });
  dlg.querySelector("[data-close]")!.addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  // ---- search: the engine and the index load on first use ----
  const input = document.getElementById("q") as HTMLInputElement;
  let starting: Promise<unknown> | null = null;
  const ensureSearch = () => (starting ??= startSearch().then((s) => { search = s; s.render(); }));
  input.addEventListener("focus", () => void ensureSearch(), { once: true });
  input.addEventListener("input", () => (search ? search.render() : void ensureSearch()));
  try { const q = new URLSearchParams(location.search).get("q"); if (q) { input.value = q; void ensureSearch(); } } catch {}
  document.addEventListener("keydown", (e) => {
    const el = document.activeElement as HTMLElement | null;
    const typing = !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
    if (((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) && !dlg.open) {
      e.preventDefault(); input.focus(); input.select();
    }
  });

  async function startSearch() {
    const [{ createSearch, fold, stem, terms, WORD }, docs] = await Promise.all([import("../lib/search"), index()]);
    const engine = createSearch(docs);
    const bySlug = new Map(docs.map((l) => [l.slug, l]));
    const status = document.querySelector<HTMLElement>("[data-status]")!;
    const empty = document.querySelector<HTMLElement>("[data-empty]")!;
    const cards = [...grid.querySelectorAll<HTMLElement>(".card")];
    const shown = new Map<HTMLElement, string>();
    cards.forEach((c) => c.querySelectorAll<HTMLElement>("h2, .card-body > p").forEach((e) => shown.set(e, e.textContent ?? "")));
    const areaName = (a: string) => filters.find((b) => b.dataset.filter === a)?.firstChild?.textContent?.trim() ?? a;

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
    const render = () => {
      const q = input.value.trim();
      const res: SearchRun | null = q ? engine.run(q) : null;
      const hits = res ? new Map(res.results.map((x, i) => [x.lesson.slug, { ...x, rank: i }])) : null;
      // Ranked order while searching, lesson order otherwise. Moving nodes keeps tab order matching what you see.
      const rank = (c: HTMLElement) => (hits?.get(c.dataset.slug!)?.rank ?? 1e6 + cards.indexOf(c));
      [...cards].sort((a, b) => rank(a) - rank(b)).forEach((c) => grid.insertBefore(c, empty));
      const per: Record<string, number> = { all: 0 };
      let visible = 0;
      for (const c of cards) {
        const r = hits?.get(c.dataset.slug!);
        const match = !hits || !!r;
        if (match) { per.all++; per[c.dataset.area!] = (per[c.dataset.area!] ?? 0) + 1; }
        c.hidden = !match || (area !== "all" && c.dataset.area !== area);
        if (!c.hidden) visible++;
        c.querySelectorAll<HTMLElement>("h2, .card-body > p").forEach((e) => mark(e, shown.get(e)!, r?.terms));
        hitLine(c, r);
      }
      filters.forEach((b) => { const n = per[b.dataset.filter!] ?? 0; b.querySelector("b")!.textContent = String(n); b.toggleAttribute("data-zero", n === 0); });

      const inArea = area === "all" ? "" : areaName(area);
      let msg = "";
      if (res) {
        const n = per.all;
        if (res.mode === "none") msg = T(`No lesson matches ${quote(q)}.`, `Ninguna lección coincide con ${quote(q)}.`);
        else if (res.mode === "some") msg = T(`No lesson has every word; ${n} ${n === 1 ? "has" : "have"} some of them.`, `Ninguna lección tiene todas las palabras; ${n} ${n === 1 ? "tiene" : "tienen"} alguna.`);
        else msg = T(`${n} ${n === 1 ? "lesson matches" : "lessons match"} ${quote(q)}`, `${n} ${n === 1 ? "lección coincide" : "lecciones coinciden"} con ${quote(q)}`);
        if (inArea && n) msg += T(` · ${visible} in ${inArea}`, ` · ${visible} en ${inArea}`);
      }
      status.textContent = msg;
      const nothing = !!res && visible === 0;
      empty.hidden = !nothing;
      if (nothing) {
        const elsewhere = per.all > 0;
        empty.querySelector("p")!.textContent = elsewhere
          ? T(`None in ${inArea}. The other matches are in other areas.`, `Ninguna en ${inArea}. Las demás coincidencias están en otras áreas.`)
          : T("Try another word, in English or Spanish, or clear the search.", "Prueba otra palabra, en inglés o en español, o borra la búsqueda.");
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
      if (e.key === "Enter") { const first = cards.find((c) => !c.hidden); if (first) { e.preventDefault(); first.querySelector<HTMLElement>(".btn.primary")!.focus(); } }
    });
    empty.querySelector("[data-clear]")!.addEventListener("click", clear);
    empty.querySelector("[data-all]")!.addEventListener("click", () => filters.find((b) => b.dataset.filter === "all")!.click());
    return { render };
  }
}

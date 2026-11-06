// <lesson-collection index="…/search-index.json" locale="en">: the collection page's search, area filters and cards
// (components/collection/Toolbar.astro and the card grid, in pages/[...lang]/index.astro).
//
// Search is a <power-search>: tokens filter (Area is Data or Search, Experiments mention "retry", Lesson from 40, …;
// the fields are in src/lib/lesson-filters.ts) and the text being typed previews a free-text search, debounced by the
// element. The area chips are a shortcut for the Area token. Every filter goes in the URL (?f=area.is.Data&q=retry),
// so a search can be shared. The search engine and the index load only when someone searches, arrives with a
// search in the URL, or opens a preview. A render only touches what changed. A card's Preview button sends a
// "lesson-preview" event, which <lesson-preview> opens on.
//
// The area chips are a segmented control (one Tab stop; ← → / Home / End select; runtime/roving.ts). When the count of
// lessons shown changes after something the reader did, it is announced politely (runtime/announce.ts), with the
// status and empty-state text; a newer count withdraws one not yet read. Nothing is announced on arrival. Actions
// that hide the control they were pressed on hand focus on (Show all areas → the All chip; Clear → the search box).
import type { Scope, SearchRun } from "../lib/search";
import type { SearchDoc } from "../lib/search-index";
import type { ChangeDetail, Filter, PowerSearch } from "./power-search";
import { loadIndex, picker, PREVIEW_EVENT, type Locale, type PreviewDetail } from "./lesson-index";
import { measureStrip } from "./filter-strip";
import { roving } from "../runtime/roving";
import { announcer } from "../runtime/announce";

export class LessonCollection extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready) return;
    this.dataset.ready = "";
    init(this);
  }
}

/** Text fields and the part of a lesson each one searches. */
const SCOPE_OF: Record<string, Scope> = { text: "all", title: "title", machine: "machine", experiments: "experiments", questions: "questions" };

// ---- the URL: ?f=area.is.Data,Search&f=experiments.contains.retry&q=storm ----
const encode = (f: Filter) => {
  const v = f.value;
  const val = v.type === "enum_list" ? v.value.join(",") : v.type === "empty" ? "" : String(v.value);
  return `${f.field}.${f.operator}.${val}`;
};
const decode = (s: string): Filter | null => {
  const m = /^([a-z]+)\.([a-z]+)\.(.*)$/s.exec(s);
  if (!m) return null;
  const [, field, operator, raw] = m;
  if (field === "area") return { field, operator, value: { type: "enum_list", value: raw.split(",").filter(Boolean) } };
  if (field === "lesson") return { field, operator, value: { type: "integer", value: Number(raw) } };
  return raw ? { field, operator, value: { type: "string", value: raw } } : null;
};

function init(root: HTMLElement) {
  const grid = root.querySelector<HTMLElement>("main.grid")!;
  const locale = (root.getAttribute("locale") === "es" ? "es" : "en") as Locale;
  const { L, T } = picker(locale);
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const index = () => loadIndex(root.getAttribute("index")!);
  const ps = root.querySelector<PowerSearch>("power-search")!;
  const chips = [...root.querySelectorAll<HTMLButtonElement>("[data-filter]")];

  // What's asked for: the tokens, and the text being typed (a preview of a Text search).
  let filters: Filter[] = [];
  let typed = "";
  let search: Awaited<ReturnType<typeof startSearch>> | null = null;
  let starting: Promise<unknown> | null = null;
  // Set by the reader's first change: from then on a render announces its count (an arrival's render doesn't).
  let changed = false;
  const ensureSearch = () => (starting ??= startSearch().then((s) => { search = s; s.render(); }));
  const update = () => { changed = true; syncChips(); writeUrl(); if (search) search.render(); else void ensureSearch(); };

  // ---- area chips: a shortcut for one "Area is …" token ----
  const areaTokens = () => filters.filter((f) => f.field === "area");
  const syncChips = () => {
    const a = areaTokens();
    const one = a.length === 1 && a[0].operator === "is" && a[0].value.type === "enum_list" && a[0].value.value.length === 1 ? a[0].value.value[0] : null;
    const checked = a.length === 0 ? "all" : one;
    chips.forEach((b) => { const on = String(b.dataset.filter === checked); if (b.getAttribute("aria-checked") !== on) b.setAttribute("aria-checked", on); });
    nav.sync();
  };
  const setArea = (area: string) => {
    filters = filters.filter((f) => f.field !== "area");
    if (area !== "all") filters.push({ field: "area", operator: "is", value: { type: "enum_list", value: [area] } });
    ps.filters = filters;
    update();
  };
  // A segmented control: one Tab stop (the checked chip, else the first), ← → / Home / End move and select.
  const group = root.querySelector<HTMLElement>(".filters")!;
  const nav = roving(group, {
    items: "[data-filter]",
    current: () => group.querySelector<HTMLElement>('[aria-checked="true"]'),
    select: (b) => b.click(),
  });
  chips.forEach((b) => b.addEventListener("click", () => {
    if (b.getAttribute("aria-checked") !== "true") setArea(b.dataset.filter!);
    b.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce() ? "auto" : "smooth" });
  }));

  // The strip was measured before first paint (Toolbar.astro); measure again when it can change.
  const strip = root.querySelector<HTMLElement>(".filters")!, wrap = root.querySelector<HTMLElement>(".filters-wrap")!;
  const arrows = wrap.querySelectorAll<HTMLButtonElement>("[data-scroll]");
  const edges = () => measureStrip(wrap);
  arrows.forEach((b) => b.addEventListener("click", () => {
    if (b.getAttribute("aria-disabled") === "true") return;   // nothing more that way
    strip.scrollBy({ left: Number(b.dataset.scroll) * Math.max(120, strip.clientWidth * 0.75), behavior: reduce() ? "auto" : "smooth" });
  }));
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
  void document.fonts?.ready.then(edges);

  // ---- previews: <lesson-preview> opens on this event; hovering a Preview button starts fetching the index ----
  root.querySelectorAll<HTMLElement>("[data-preview]").forEach((b) => {
    b.addEventListener("click", () => b.dispatchEvent(new CustomEvent<PreviewDetail>(PREVIEW_EVENT, { bubbles: true, detail: { card: b.closest<HTMLElement>(".card")!, opener: b } })));
    b.addEventListener("pointerenter", () => void index(), { once: true });
  });

  // ---- the power search ----
  ps.input.addEventListener("focus", () => void ensureSearch(), { once: true });
  ps.addEventListener("ps-change", (e) => { filters = (e as CustomEvent<ChangeDetail>).detail.filters; update(); });
  // The text being typed previews a search only while it reads as free text, not while a filter is being typed.
  ps.addEventListener("ps-input", (e) => { const d = (e as CustomEvent<{ text: string; free: boolean }>).detail; typed = d.free ? d.text.trim() : ""; update(); });
  ps.addEventListener("ps-submit", () => grid.querySelector<HTMLElement>(":scope > .card:not([hidden]) .card-link")?.focus());
  document.addEventListener("keydown", (e) => {
    const el = document.activeElement as HTMLElement | null;
    const typing = !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
    if (((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) && !document.querySelector("dialog[open]")) {
      e.preventDefault(); ps.focusInput(); ps.input.select();
    }
  });

  const writeUrl = () => {
    try {
      const u = new URL(location.href);
      u.searchParams.delete("f");
      u.searchParams.delete("q");
      filters.forEach((f) => u.searchParams.append("f", encode(f)));
      if (typed) u.searchParams.set("q", typed);
      if (u.href !== location.href) history.replaceState(null, "", u);
    } catch {}
  };
  // Arriving with a search: ?f= tokens and ?q= text (older links have only ?q=).
  try {
    const p = new URLSearchParams(location.search);
    const fromUrl = p.getAll("f").map(decode).filter((f): f is Filter => f !== null);
    const q = p.get("q")?.trim() ?? "";
    if (fromUrl.length) { ps.filters = fromUrl; filters = ps.filters; }
    if (q) { ps.text = q; typed = q; }
    if (filters.length || typed) { syncChips(); void ensureSearch(); }
  } catch {}

  async function startSearch() {
    const [{ createSearch, fold, stem, terms, WORD }, docs] = await Promise.all([import("../lib/search"), index()]);
    const engines = new Map<Scope, ReturnType<typeof createSearch>>();
    const engine = (scope: Scope) => { let e = engines.get(scope); if (!e) engines.set(scope, (e = createSearch(docs, { scope }))); return e; };
    const bySlug = new Map<string, SearchDoc>(docs.map((l) => [l.slug, l]));
    const status = root.querySelector<HTMLElement>("[data-status]")!;
    const empty = root.querySelector<HTMLElement>("[data-empty]")!;
    const cards = [...grid.querySelectorAll<HTMLElement>(".card")];
    const shown = new Map<HTMLElement, string>();
    const marks = (c: HTMLElement) => c.querySelectorAll<HTMLElement>(".card-link, .card-body > p");
    cards.forEach((c) => marks(c).forEach((e) => shown.set(e, e.textContent ?? "")));
    const say = announcer({ replace: true });

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

    // "In Experiment 3 · Thundering herd" under a card whose match isn't in its title or blurb (or is asked for
    // in experiments or questions).
    const hitLine = (card: HTMLElement, r: { terms: Set<string>; where: Set<Scope> } | undefined) => {
      const key = r ? keyOf(r.terms) + "|" + [...r.where].sort().join(",") || " " : "";
      if (hitKey.get(card) === key) return;
      hitKey.set(card, key);
      const line = card.querySelector<HTMLElement>(".hit")!;
      line.hidden = true;
      if (!r || !r.terms.size) return;
      const l = bySlug.get(card.dataset.slug!)!;
      const count = (s: string) => terms(s).filter((t) => r.terms.has(t)).length;
      const onlyIn = r.where.has("experiments") || r.where.has("questions");
      if (!onlyIn && count([l.title, l.blurb, l.concept, l.machine, l.area].map(L).join(" "))) return;
      const spots = [
        ...(r.where.has("questions") && !r.where.has("experiments") ? [] : l.exps.map((e, i) => ({ kind: "exp", i, text: [L(e.title), L(e.question), L(e.change)].find((x) => count(x)) ?? L(e.title), n: count(L(e.title)) * 2 + count(`${L(e.change)} ${L(e.question)}`) }))),
        ...(r.where.has("experiments") && !r.where.has("questions") ? [] : l.qs.map((q, i) => ({ kind: "q", i, text: L(q), n: count(L(q)) }))),
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

    // Does a lesson pass the non-text filters (area, number)?
    const passes = (l: SearchDoc, area: string, fs: Filter[]) => fs.every((f) => {
      if (f.field === "area" && f.value.type === "enum_list") return f.operator === "not" ? !f.value.value.includes(area) : f.value.value.includes(area);
      if (f.field === "lesson" && f.value.type === "integer") return f.operator === "from" ? l.n >= f.value.value : f.operator === "to" ? l.n <= f.value.value : l.n === f.value.value;
      return true;
    });

    const quote = (q: string) => `“${q}”`;
    const plural = (n: number) => T(`${n} ${n === 1 ? "lesson" : "lessons"}`, `${n} ${n === 1 ? "lección" : "lecciones"}`);
    let last = "\u0000";
    const render = () => {
      const key = JSON.stringify(filters) + "\u0000" + typed.replace(/\s+/g, " ");
      if (key === last) return;   // the same search (spacing aside): nothing to redo
      last = key;

      // Text searches: every text token, and the text being typed. A lesson must match all of them.
      const runs = [
        ...filters.filter((f) => f.field in SCOPE_OF && f.value.type === "string").map((f) => ({ scope: SCOPE_OF[f.field], q: (f.value as { value: string }).value })),
        ...(typed ? [{ scope: "all" as Scope, q: typed }] : []),
      ].map((r) => ({ ...r, res: engine(r.scope).run(r.q) as SearchRun }));
      const rest = filters.filter((f) => !(f.field in SCOPE_OF));
      const hits = new Map<string, { score: number; terms: Set<string>; where: Set<Scope> }>();
      if (runs.length) {
        for (const l of docs) {
          let score = 0;
          const t = new Set<string>(), where = new Set<Scope>();
          let ok = true;
          for (const r of runs) {
            const found = r.res.results.find((x) => x.lesson.slug === l.slug);
            if (!found) { ok = false; break; }
            score += found.score;
            found.terms.forEach((x) => t.add(x));
            where.add(r.scope);
          }
          if (ok) hits.set(l.slug, { score, terms: t, where });
        }
      }
      const searching = runs.length > 0;
      // Ranked by score while searching, lesson order otherwise. Cards move only when the order changes.
      const rank = (c: HTMLElement) => {
        const h = hits.get(c.dataset.slug!);
        return searching && h ? -h.score : 1e6 + cards.indexOf(c);
      };
      const order = [...cards].sort((a, b) => rank(a) - rank(b));
      const now = [...grid.querySelectorAll<HTMLElement>(":scope > .card")];
      if (order.some((c, i) => now[i] !== c)) order.forEach((c) => grid.insertBefore(c, empty));

      // Chip counts: lessons that pass everything except the area filters.
      const per: Record<string, number> = { all: 0 };
      const noArea = rest.filter((f) => f.field !== "area");
      let visible = 0;
      for (const c of cards) {
        const l = bySlug.get(c.dataset.slug!)!;
        const h = hits.get(c.dataset.slug!);
        const textOk = !searching || !!h;
        if (textOk && passes(l, c.dataset.area!, noArea)) { per.all++; per[c.dataset.area!] = (per[c.dataset.area!] ?? 0) + 1; }
        const hide = !textOk || !passes(l, c.dataset.area!, rest);
        if (c.hidden !== hide) c.hidden = hide;
        if (!hide) visible++;
        // Highlight in the title and blurb only what a whole-lesson or title search found.
        const showTerms = h && runs.some((r) => r.scope === "all" || r.scope === "title") ? h.terms : undefined;
        const k = keyOf(showTerms);
        marks(c).forEach((e) => { if (marked.get(e) !== k) { marked.set(e, k); mark(e, shown.get(e)!, showTerms); } });
        hitLine(c, h);
      }
      chips.forEach((b) => { const n = per[b.dataset.filter!] ?? 0; setText(b.querySelector("b")!, String(n)); if (b.hasAttribute("data-zero") !== (n === 0)) b.toggleAttribute("data-zero", n === 0); });

      const active = searching || rest.length > 0;
      ps.resultCount = active ? plural(visible) : "";
      // The status line explains the special cases; the count is in the bar.
      let msg = "";
      const none = runs.find((r) => r.res.mode === "none");
      const some = runs.find((r) => r.res.mode === "some");
      if (none) msg = T(`Nothing matches ${quote(none.q)}.`, `Nada coincide con ${quote(none.q)}.`);
      else if (some) msg = T(`No lesson has every word of ${quote(some.q)}; showing lessons with some of them.`, `Ninguna lección tiene todas las palabras de ${quote(some.q)}; se muestran las que tienen alguna.`);
      setText(status, msg);
      const nothing = active && visible === 0;
      if (empty.hidden !== !nothing) empty.hidden = !nothing;
      let hint = "";
      if (nothing) {
        const elsewhere = per.all > 0 && areaTokens().length > 0;
        hint = elsewhere
          ? T("None in these areas. The other matches are in other areas.", "Ninguna en estas áreas. Las demás coincidencias están en otras áreas.")
          : T("Try another word, in English or Spanish, or remove a filter.", "Prueba otra palabra, en inglés o en español, o quita un filtro.");
        setText(empty.querySelector("p")!, hint);
        empty.querySelector<HTMLElement>("[data-all]")!.hidden = !elsewhere;
      }
      // The count, said once per change the reader made (never for an arrival's search), with what the status line
      // and the empty state now say; a newer count takes back one not yet read.
      if (changed) say([`${plural(visible)}.`, msg, hint].filter(Boolean).join(" "));
    };

    // Both actions hide the empty state, and the button with it: focus moves on instead of dropping to the page.
    empty.querySelector("[data-clear]")!.addEventListener("click", () => {
      filters = [];
      ps.filters = [];
      ps.text = "";
      typed = "";
      update();
      ps.focusInput();
    });
    empty.querySelector("[data-all]")!.addEventListener("click", () => {
      setArea("all");
      const all = group.querySelector<HTMLElement>('[data-filter="all"]')!;
      nav.focus(all);
      all.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    return { render };
  }
}

if (!customElements.get("lesson-collection")) customElements.define("lesson-collection", LessonCollection);

declare global {
  interface HTMLElementTagNameMap {
    "lesson-collection": LessonCollection;
  }
}

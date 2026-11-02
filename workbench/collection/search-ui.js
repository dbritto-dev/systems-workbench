// The collection page's search box. Ranks cards with createSearch (search.js), works with the area filters, highlights
// matching words, and says where a match is when it isn't on the card (an experiment or a question). Keeps ?q= in the
// address bar so a search can be linked. Keys: "/" or Ctrl/Cmd+K focus the box, Esc clears it, Enter jumps to the
// first result. Inlined into index.html by build.mjs.
function initCollectionSearch({ LESSONS, AREA_NAMES, lang, L }) {
  const search = createSearch(LESSONS);
  const input = document.getElementById("q");
  const status = document.querySelector("[data-status]");
  const empty = document.querySelector("[data-empty]");
  const grid = document.querySelector("main.grid");
  const cards = [...grid.querySelectorAll(".card")];
  const filters = [...document.querySelectorAll("[data-filter]")];
  const bySlug = new Map(LESSONS.map((l) => [l.slug, l]));
  const shownText = new Map(); // a card's visible title and blurb spans → their plain text, so highlights can be redrawn
  cards.forEach((c) => c.querySelectorAll("h2 [data-l], .card-body > p [data-l]").forEach((e) => shownText.set(e, e.textContent)));
  const T = (en, es) => (lang() === "es" ? es : en);
  let area = "all";

  const mark = (el, text, set) => {
    el.textContent = "";
    if (!set || !set.size) { el.textContent = text; return; }
    const folded = search.fold(text), re = new RegExp(search.WORD.source, "g");
    let at = 0, m;
    while ((m = re.exec(folded))) {
      if (!set.has(search.stem(m[0]))) continue;
      el.append(text.slice(at, m.index));
      const k = document.createElement("mark");
      k.textContent = text.slice(m.index, m.index + m[0].length);
      el.append(k);
      at = m.index + m[0].length;
    }
    el.append(text.slice(at));
  };

  // "In Experiment 3 · Thundering herd" under a card whose match isn't in its title or blurb. Looks in the language on
  // screen only, so the line always shows the matched word (a Spanish query on the English page shows no line).
  const hitLine = (card, r) => {
    const line = card.querySelector(".hit");
    line.hidden = true;
    if (!r) return;
    const l = bySlug.get(card.dataset.slug);
    const count = (s) => search.terms(s).filter((t) => r.terms.has(t)).length;
    if (count([l.title, l.blurb, l.concept, l.machine, l.area].map(L).join(" "))) return;
    const spots = [
      ...l.exps.map((e, i) => {
        // show the experiment's title, or the line of it that holds the match
        const text = [L(e.title), L(e.question), L(e.change)].find((x) => count(x)) || L(e.title);
        return { kind: "exp", i, text, n: count(L(e.title)) * 2 + count(L(e.change) + " " + L(e.question)) };
      }),
      ...(l.qs || []).map((q, i) => ({ kind: "q", i, text: L(q), n: count(L(q)) })),
    ].filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
    const hit = spots[0];
    if (!hit) return;
    const k = document.createElement("b");
    k.textContent = hit.kind === "exp" ? T("Experiment ", "Experimento ") + (hit.i + 1) : T("Question ", "Pregunta ") + (hit.i + 1);
    const text = document.createElement("span");
    mark(text, hit.text, r.terms);
    line.replaceChildren(T("In ", "En "), k, " · ", text);
    line.title = hit.text;
    line.hidden = false;
  };

  const quote = (q) => "“" + q + "”";
  const render = () => {
    const q = input.value.trim();
    const res = q ? search.run(q) : null;
    const hits = res ? new Map(res.results.map((x, i) => [x.lesson.slug, { ...x, rank: i }])) : null;
    // Ranked order while searching, the lesson order otherwise. Moving the nodes keeps tab order the same as what you see.
    const rank = (c) => (hits && hits.has(c.dataset.slug) ? hits.get(c.dataset.slug).rank : 1e6 + cards.indexOf(c));
    [...cards].sort((a, b) => rank(a) - rank(b)).forEach((c) => grid.insertBefore(c, empty));
    const per = { all: 0 };
    let shown = 0;
    cards.forEach((c) => {
      const r = hits ? hits.get(c.dataset.slug) : null;
      const match = !hits || !!r;
      if (match) { per.all++; per[c.dataset.area] = (per[c.dataset.area] || 0) + 1; }
      c.hidden = !match || (area !== "all" && c.dataset.area !== area);
      if (!c.hidden) shown++;
      c.querySelectorAll("h2 [data-l], .card-body > p [data-l]").forEach((e) => mark(e, shownText.get(e), r && r.terms));
      hitLine(c, r);
    });
    filters.forEach((b) => { const n = per[b.dataset.filter] || 0; b.querySelector("b").textContent = n; b.toggleAttribute("data-zero", n === 0); });

    const inArea = area === "all" ? "" : L(AREA_NAMES[area]);
    let msg = "";
    if (res) {
      const n = per.all;
      if (res.mode === "none") msg = T("No lesson matches " + quote(q) + ".", "Ninguna lección coincide con " + quote(q) + ".");
      else if (res.mode === "some") msg = T("No lesson has every word; " + n + (n === 1 ? " has" : " have") + " some of them.", "Ninguna lección tiene todas las palabras; " + n + (n === 1 ? " tiene" : " tienen") + " alguna.");
      else msg = T(n + (n === 1 ? " lesson matches " : " lessons match ") + quote(q), n + (n === 1 ? " lección coincide con " : " lecciones coinciden con ") + quote(q));
      if (inArea && n) msg += T(" · " + shown + " in " + inArea, " · " + shown + " en " + inArea);
    }
    status.textContent = msg;
    const nothing = !!res && shown === 0;
    empty.hidden = !nothing;
    if (nothing) {
      const other = per.all > 0;
      empty.querySelector("p").textContent = other
        ? T("None in " + inArea + ". The other matches are in other areas.", "Ninguna en " + inArea + ". Las demás coincidencias están en otras áreas.")
        : T("Try another word, in English or Spanish, or clear the search.", "Prueba otra palabra, en inglés o en español, o borra la búsqueda.");
      empty.querySelector("[data-all]").hidden = !other;
    }
    try {
      const u = new URL(location.href);
      if (q) u.searchParams.set("q", q); else u.searchParams.delete("q");
      if (u.href !== location.href) history.replaceState(null, "", u);
    } catch (e) {}
  };

  const placeholder = () => { input.placeholder = input.getAttribute("data-ph-" + lang()) || ""; };
  const clear = () => { input.value = ""; render(); input.focus(); };
  input.addEventListener("input", render);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (input.value) { e.preventDefault(); clear(); } else input.blur(); }
    if (e.key === "Enter") { const first = cards.find((c) => !c.hidden); if (first) { e.preventDefault(); first.querySelector(".btn.primary").focus(); } }
  });
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName) || (document.activeElement && document.activeElement.isContentEditable);
    if (((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) && !document.querySelector("dialog[open]")) {
      e.preventDefault(); input.focus(); input.select();
    }
  });
  empty.querySelector("[data-clear]").addEventListener("click", clear);
  empty.querySelector("[data-all]").addEventListener("click", () => filters.find((b) => b.dataset.filter === "all").click());
  document.addEventListener("wb-lang", () => { placeholder(); render(); });
  try { const q = new URLSearchParams(location.search).get("q"); if (q) input.value = q; } catch (e) {}
  placeholder();
  render();
  return { setArea: (a) => { area = a; render(); }, render };
}

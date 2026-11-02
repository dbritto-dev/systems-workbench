// Search for the collection page: BM25F over every lesson's text in both languages at once, so "cola" and "queue"
// find the same lesson whatever language the page is showing. Inlined into index.html by build.mjs; plain script,
// no dependencies. Lesson 35 (BM25) explains the scoring: rare words weigh more, repeats saturate, long fields
// are discounted. On top of that: field weights (a word in a title counts more than one in a question),
// accent folding, a light plural stemmer, prefix matching for the word being typed, and one-typo tolerance.
//
//   const s = createSearch(LESSONS);   s.run("retry backoff") → { mode, results: [{ lesson, score, terms }] }
function createSearch(lessons) {
  // fold(): lowercase, accents off, one output char per input char so match positions map back onto the original.
  const fold = (s) => {
    let out = "";
    for (const c of String(s)) {
      const f = c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      out += f.length === c.length ? f : c.length === 1 ? c.toLowerCase().slice(0, 1) || c : c;
    }
    return out;
  };
  const STOP = new Set(("a an and are as at be but by can do does for from has have how if in into is it its not of on or so that the their then there this to was what when where which who why will with you your " +
    "al como con cual cuál de del el en entre es esta este esto la las lo los mas más no o para pero por que qué se si sin su sus un una uno unos unas y ya").split(" ").map(fold));
  const stem = (w) => (w.length > 4 && w.endsWith("ies") ? w.slice(0, -3) + "y" : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
  const WORD = /[a-z0-9]+(?:\+[0-9]+)?/g;
  const words = (s) => fold(s).match(WORD) || [];
  const terms = (s) => words(s).filter((w) => !STOP.has(w)).map(stem);
  const both = (v) => (v != null && typeof v === "object" && "en" in v ? v.en + " " + v.es : String(v ?? ""));

  // Fields and their weights. Visible fields (on the card) are what the reader sees; the rest explain a match.
  const FIELDS = [
    ["title", 3, (l) => both(l.title)],
    ["concept", 2.5, (l) => both(l.concept)],
    ["machine", 2, (l) => both(l.machine)],
    ["area", 1.5, (l) => both(l.area)],
    ["blurb", 1.5, (l) => both(l.blurb)],
    ["lede", 1, (l) => both(l.lede)],
    ["exp", 1.2, (l) => l.exps.map((e) => both(e.title)).join(" ")],
    ["expText", 0.6, (l) => l.exps.map((e) => both(e.change) + " " + both(e.question)).join(" ")],
    ["question", 0.7, (l) => (l.qs || []).map(both).join(" ")],
  ];
  const K1 = 1.2, B = 0.5;
  const docs = lessons.map((l) => {
    const tf = new Map();
    let len = 0, flat = " ";
    for (const [, w, get] of FIELDS) {
      const text = get(l);
      flat += words(text).join(" ") + " | ";
      const ts = terms(text);
      len += w * ts.length;
      for (const t of ts) tf.set(t, (tf.get(t) || 0) + w);
    }
    return { lesson: l, tf, len, flat };
  });
  const avg = docs.reduce((s, d) => s + d.len, 0) / docs.length;
  const df = new Map();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  const vocab = [...df.keys()];
  const N = docs.length;
  const idf = (t) => Math.log(1 + (N - df.get(t) + 0.5) / (df.get(t) + 0.5));
  const bm25 = (d, t) => { const f = d.tf.get(t) || 0; return f ? (idf(t) * f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / avg)) : 0; };

  const oneEdit = (a, b) => {
    if (Math.abs(a.length - b.length) > 1 || a === b) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  };
  // Each query word expands to the vocabulary terms it stands for, with a weight: exact 1, prefix 0.8, one typo 0.5.
  const expand = (q) => {
    const out = new Map();
    if (df.has(q)) out.set(q, 1);
    if (q.length >= 2 || /^[0-9]$/.test(q)) for (const t of vocab) if (t !== q && t.startsWith(q)) out.set(t, 0.8);
    if (!out.size && q.length >= 4) for (const t of vocab) if (t.length >= 4 && oneEdit(q, t)) out.set(t, 0.5);
    return out;
  };

  const run = (query) => {
    const qs = [...new Set(words(query).filter((w) => !STOP.has(w)).map(stem))];
    if (!qs.length) return { mode: "none", tokens: [], results: [] };
    const exp = qs.map(expand);
    // A query of several words that appears as a phrase ("dead letter", "exactly once") ranks above scattered words.
    const phrase = words(query);
    const near = (d) => (phrase.length > 1 && d.flat.includes(" " + phrase.join(" ")) ? 1.6 : 1);
    const score = (d, need) => {
      let s = 0, hits = 0;
      const matched = new Set();
      exp.forEach((m) => {
        let best = 0;
        for (const [t, w] of m) { const v = w * bm25(d, t); if (v > 0) matched.add(t); if (v > best) best = v; }
        if (best > 0) hits++;
        s += best;
      });
      return hits >= need ? { score: s * near(d), matched, hits } : null;
    };
    const pick = (need) => docs.map((d) => ({ d, r: score(d, need) })).filter((x) => x.r)
      .sort((a, b) => b.r.hits - a.r.hits || b.r.score - a.r.score || a.d.lesson.n - b.d.lesson.n);
    let mode = "all";
    let found = pick(qs.length);
    if (!found.length && qs.length > 1) { mode = "some"; found = pick(1); }
    return {
      mode: found.length ? mode : "none",
      tokens: qs,
      results: found.map(({ d, r }) => ({ lesson: d.lesson, score: r.score, terms: r.matched })),
    };
  };
  return { run, fold, stem, terms, WORD };
}

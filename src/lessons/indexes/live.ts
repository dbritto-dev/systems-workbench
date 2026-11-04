// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The library in the browser: a queue of timed steps (walk, read a drawer, fetch a book, file a card) that the
// trolley, cards, counter and stopwatch follow, and the controls. mount() gets the build-time data from page.ts
// (geometry) and root, the <wb-lesson>.
import { iso, pathOf, translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { playPause } from "../../runtime/dom";
import { lerp, easeInOutQuad as ease } from "../../lib/tween";
import { rng } from "../../lib/random";
import { int } from "../../lib/format";
import { INDEXES, QUERIES, RAND, choose, levels, insertCost, insertReads, needlePath } from "./sim";

export default function mount({ P, G }, root) {
  const needleAt = (turn) => needlePath(G.DIAL, P, turn);
  const SCALE = 1;

  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const trolleyEl = q("[data-trolley]"), fly = q("[data-fly]"), needle = q("[data-needle]"), newBook = q("[data-newbook]");
  const onShelfEl = q("[data-onshelf]"), routeEl = q("[data-route]"), backSlot = q("[data-back]"), frontSlot = q("[data-front]");
  const countLabel = q("[data-count-label]"), countEl = q("[data-count]");
  const lamp = q("[data-lamp] .iso-solid");
  const cabEls = G.CABS.map((_, i) => qa('[data-cab="' + i + '"]'));
  const cardEls = G.CABS.map((_, i) => q('[data-card="' + i + '"]'));
  const drawerEls = G.CABS.map((_, i) => q('[data-drawer="' + i + '"] .iso-solid'));
  const tagEls = G.CASES.map((_, i) => q('[data-tag="' + i + '"]'));
  const stat = (key, value) => root.stat(key, value);

  const cfg = { rows: 10000, query: "isbn", on: ["isbn"], writes: false, speed: 1 };
  let random = rng(7);
  let pos = [G.HOME[0], G.HOME[1]], inBack = false;
  let steps = [], current = null, watchMs = 0, readsShown = 0;
  let lastQuery = null, lastInsert = null, carrying = false;

  const fmtMs = (ms) => (ms >= 1000 ? (ms / 1000).toFixed(1) + " s" : ms >= 10 ? ms.toFixed(0) + " ms" : ms.toFixed(1) + " ms");
  // Live words are kept as { en, es } and picked when written.
  const say = (msg) => root.figure.say(L(msg));
  const planNameT = (p) => (p.kind === "scan" ? T("Full scan", "Escaneo completo") : p.kind === "covering" ? T("Index only", "Solo índice") : T("Index + shelf trips", "Índice + viajes a estantes"));
  const planName = (p) => L(planNameT(p));
  const INDEX_ES = { isbn: "ISBN", author: "Autor", authorYear: "Autor, año", loan: "Prestado", authorTitle: "Autor (+ título)" };
  const indexLabelT = (id) => T(INDEXES.find((x) => x.id === id).label, INDEX_ES[id]);
  const QUERY_ES = { isbn: "ISBN = 978-0-441-…", author: "autor = Le Guin", year: "año = 1969", authorYear: "autor = Le Guin y año = 1969", loan: "prestado = sí", titles: "títulos de Le Guin" };
  const queryLabelT = (id) => T(QUERIES[id].label, QUERY_ES[id]);
  // Compose a readout per language: f(lang) gets the query label, plan and index words in that language.
  const msg = (f) => T(f("en"), f("es"));
  const pick = (v, lang) => (lang === "es" ? v.es : v.en);

  // The trolley and the book it carries are drawn behind the cabinets when they are back by the shelves.
  function setTrolley(p) {
    pos = p;
    const back = p[1] < -20;
    if (back !== inBack) { (back ? backSlot : frontSlot).append(trolleyEl, fly); inBack = back; }
    trolleyEl.setAttribute("transform", translateAlong(P, [p[0], p[1], 0]));
    if (carrying) flyAt(basket());
  }
  function setLamp(on) { lamp.toggleAttribute("data-lit", on); }
  function flyAt(p, opacity = 1) { fly.setAttribute("transform", translateAlong(P, p)); fly.style.opacity = String(opacity); }
  function setNeedle(ms) { needle.setAttribute("d", needleAt(ms / 10)); }
  const COUNT = { books: T("BOOKS CHECKED", "LIBROS REVISADOS"), drawers: T("DRAWER READS", "CAJONES LEÍDOS"), trips: T("SHELF TRIPS", "VIAJES A ESTANTES"), cards: T("CARDS FILED", "FICHAS ARCHIVADAS") };
  function setCount(label, value) { const l = L(label); if (countLabel.textContent !== l) countLabel.textContent = l; const v = String(value); if (countEl.textContent !== v) countEl.textContent = v; }
  const shelfCard = (n) => T("SHELF " + n, "EST. " + n);   // "ESTANTE 1" is wider than the card
  function setDrawerLit(i, on) { drawerEls[i].toggleAttribute("data-lit", on); }
  function setCard(i, on, text, rise = 1) {
    const el = cardEls[i];
    el.style.display = on ? "" : "none";
    if (!on) return;
    if (text !== undefined) el.querySelector("text").textContent = L(text);
    el.setAttribute("transform", translateAlong(P, [0, 0, rise * G.TRAY.rise]));
  }
  function setTag(c, on) {
    const el = tagEls[c];
    el.querySelector(".iso-solid").toggleAttribute("data-lit", on);
    el.querySelector("text").setAttribute("data-tone", on ? "lit" : "mid");
  }
  function clearTags() { G.CASES.forEach((_, c) => setTag(c, false)); }
  function onShelf(spot) {
    onShelfEl.style.display = spot ? "" : "none";
    if (spot) onShelfEl.setAttribute("transform", translateAlong(P, [spot.x, G.CASE.y0 + 8, spot.level]));
  }
  function setRoute(points) {
    routeEl.setAttribute("d", points ? pathOf(points.map((p) => iso([p[0], p[1], 0.3], P))) : "");
  }

  function route(from, to) {
    const front = (p) => p[1] > 0;
    if (front(from) === front(to)) return [from, to];
    return [from, [G.AISLE_X, from[1]], [G.AISLE_X, to[1]], to];
  }
  // The pointer: from the drawer face, along the trolley's way, to the foot of the numbered bookcase.
  function routeTo(from, spot, cab) {
    const pts = route(from, [spot.x, G.SHELF_LANE_Y]);
    if (cab) pts.unshift([cab.cx, G.CAB_FRONT + G.TRAY.out + 1]);
    pts.push([spot.x, G.CASE.y0 + G.CASE.d + 1]);
    return pts;
  }
  // The route is worked out when the walk starts, from wherever the trolley is by then.
  function travel(to) {
    let pts = [], lens = [], total = 0;
    steps.push({
      dur: 0.12,
      begin() {
        pts = route(pos, to); lens = []; total = 0;
        for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lens.push(l); total += l; }
        this.dur = Math.max(0.12, total / 240 + 0.1 * (pts.length - 2));
      },
      run(t) {
        if (total < 0.5) return;
        let d = ease(t) * total, i = 0;
        while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i++; }
        const u = lens[i] ? Math.min(1, d / lens[i]) : 1;
        setTrolley([lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)]);
      },
    });
  }
  // A clocked step: the stopwatch and the page counter advance with it.
  function reading(ms, pages, run, begin, done) {
    let base = 0, baseReads = 0;
    steps.push({ dur: ms * SCALE, begin: () => { base = watchMs; baseReads = readsShown; setLamp(true); begin && begin(); }, run: (t) => { watchMs = base + ms * t; readsShown = baseReads + Math.round(pages * t); setNeedle(watchMs); showLive(); run && run(t); }, done: () => { setLamp(false); done && done(); } });
  }
  function call(fn) { steps.push({ dur: 0, done: fn }); }

  const shelfSpot = () => { const c = Math.floor(random() * G.CASES.length); const level = G.LEVELS[Math.floor(random() * G.LEVELS.length)]; return { c, x: G.CASES[c].cx, level }; };
  const basket = () => [pos[0] - 3, pos[1], 14];
  function clearScene() {
    clearTags(); setRoute(null); onShelf(null);
    G.CABS.forEach((_, i) => { setCard(i, false); setDrawerLit(i, false); });
  }

  function runQuery() {
    const plan = choose(cfg.query, cfg.rows, cfg.on);
    const ql = queryLabelT(cfg.query), pn = planNameT(plan), il = plan.index ? indexLabelT(plan.index) : null;
    call(() => { watchMs = 0; readsShown = 0; setNeedle(0); fly.style.opacity = "0"; clearScene(); setCount(plan.kind === "scan" ? COUNT.books : COUNT.drawers, 0); say(msg((g) => pick(ql, g) + " · " + pick(pn, g).toLowerCase() + (il ? (g === "es" ? " sobre " : " on ") + pick(il, g).toLowerCase() : ""))); });
    if (plan.kind === "scan") {
      const xs = G.CASES.map((c) => c.cx), x0 = G.CASES[0].x0 - 6;
      travel([x0, G.SHELF_LANE_Y]);
      reading(plan.cost, plan.reads, (t) => {
        const n = xs.length, at = Math.min(n - 1, Math.floor(t * n)), f = t * n - at;
        setTrolley([lerp(at === 0 ? x0 : xs[at - 1], xs[at], ease(Math.min(1, f / 0.3))), G.SHELF_LANE_Y]);
        G.CASES.forEach((_, c) => setTag(c, c === at && t < 1));
        setCount(COUNT.books, int(cfg.rows * t));
      }, () => say(T(ql.en + " · checking every book on every shelf · " + int(plan.reads) + " pages", ql.es + " · revisando cada libro de cada estante · " + int(plan.reads) + " páginas")), () => { clearTags(); carrying = true; flyAt(basket()); });
    } else {
      const i = G.CABS.findIndex((c) => c.id === plan.index), cab = G.CABS[i];
      const covering = plan.kind === "covering";
      const first = shelfSpot();
      travel([cab.cx, G.CAB_STOP_Y]);
      reading(plan.drawerReads * RAND, plan.drawerReads, (t) => { setCard(i, true, undefined, ease(t)); setCount(COUNT.drawers, Math.round(plan.drawerReads * t)); },
        () => { setDrawerLit(i, true); setCard(i, true, covering ? T("+ TITLE", "+ TÍTULO") : shelfCard(first.c + 1), 0); say(T(ql.en + " · " + il.en.toLowerCase() + " catalogue · " + plan.drawerReads + " drawer reads", ql.es + " · catálogo de " + il.es.toLowerCase() + " · " + plan.drawerReads + " cajones leídos")); },
        () => { setDrawerLit(i, false); if (!covering) { setTag(first.c, true); onShelf(first); setRoute(routeTo(pos, first, cab)); say(T(ql.en + " · the card says shelf " + (first.c + 1), ql.es + " · la ficha dice estante " + (first.c + 1))); } });
      if (plan.shelfTrips) {
        travel([first.x, G.SHELF_LANE_Y]);
        for (let n = 0; n < plan.shelfTrips; n++) {
          let from, spot;
          reading(RAND, 1, (t) => {
            setTrolley([lerp(from[0], spot.x, ease(Math.min(1, t * 1.6))), G.SHELF_LANE_Y]);
            if (t > 0.62) { onShelf(null); const u = (t - 0.62) / 0.38; flyAt([spot.x, lerp(G.CASE.y0 + 8, G.SHELF_LANE_Y, ease(u)), lerp(spot.level, 14, ease(u))]); }
          }, () => {
            carrying = false; from = [...pos]; spot = n === 0 ? first : shelfSpot();
            setCard(i, true, shelfCard(spot.c + 1)); clearTags(); setTag(spot.c, true); onShelf(spot);
            if (n > 0) setRoute(routeTo(pos, spot));
            setCount(COUNT.trips, (n + 1) + " / " + plan.shelfTrips);
            say(T(ql.en + " · card " + (n + 1) + " of " + plan.shelfTrips + " → shelf " + (spot.c + 1), ql.es + " · ficha " + (n + 1) + " de " + plan.shelfTrips + " → estante " + (spot.c + 1)));
          }, () => { carrying = true; flyAt(basket()); setRoute(null); });
        }
        call(() => clearTags());
      } else {
        call(() => { setCount(COUNT.trips, 0); say(T(ql.en + " · the title is on the card: no shelf trips", ql.es + " · el título está en la ficha: sin viajes a estantes")); });
        steps.push({ dur: 0.8 });
      }
    }
    travel([G.HOME[0], G.HOME[1]]);
    call(() => { lastQuery = { plan, ms: plan.cost }; carrying = false; fly.style.opacity = "0"; clearScene(); showStats(); say(T(ql.en + " · " + fmtMs(plan.cost) + " · " + int(plan.reads) + " pages", ql.es + " · " + fmtMs(plan.cost) + " · " + int(plan.reads) + " páginas")); });
    steps.push({ dur: 0.6 });
  }

  function runInsert() {
    const on = INDEXES.filter((x) => cfg.on.includes(x.id));
    const per = levels(cfg.rows) + 1;
    const last = G.CASES.length - 1, shelf = { c: last, x: G.CASES[last].cx, level: G.LEVELS[3] };
    call(() => { watchMs = 0; readsShown = 0; setNeedle(0); clearScene(); newBook.style.display = ""; setCount(COUNT.cards, "0 / " + on.length); say(T("a new book · a card to file in " + on.length + (on.length === 1 ? " catalogue" : " catalogues"), "un libro nuevo · una ficha que archivar en " + on.length + (on.length === 1 ? " catálogo" : " catálogos"))); });
    steps.push({ dur: 0.3, done: () => { newBook.style.display = "none"; carrying = true; flyAt(basket()); } });
    on.forEach((index, n) => {
      const i = G.CABS.findIndex((c) => c.id === index.id);
      travel([G.CABS[i].cx, G.CAB_STOP_Y]);
      reading(per * RAND, per, (t) => setCard(i, true, undefined, 1 - ease(t)),
        () => { setDrawerLit(i, true); setCard(i, true, shelfCard(last + 1), 1); say(T("a new book · filing its card in the " + index.label.toLowerCase() + " catalogue · " + per + " page reads and writes", "un libro nuevo · su ficha va al catálogo de " + INDEX_ES[index.id].toLowerCase() + " · " + per + " lecturas y escrituras")); },
        () => { setDrawerLit(i, false); setCard(i, false); setCount(COUNT.cards, (n + 1) + " / " + on.length); });
    });
    call(() => { setTag(last, true); setRoute(routeTo(pos, shelf)); });
    travel([shelf.x, G.SHELF_LANE_Y]);
    reading(RAND, 1, (t) => flyAt([pos[0], lerp(pos[1], G.CASE.y0 + 8, ease(t)), lerp(14, shelf.level, ease(t))], 1 - Math.max(0, t - 0.8) * 5), () => { carrying = false; say(T("a new book · shelved on shelf " + (last + 1), "un libro nuevo · guardado en el estante " + (last + 1))); }, () => { setRoute(null); onShelf(shelf); });
    travel([G.HOME[0], G.HOME[1]]);
    call(() => { lastInsert = { ms: insertCost(cfg.rows, on.length) }; carrying = false; fly.style.opacity = "0"; clearScene(); showStats(); say(T("a new book · " + fmtMs(lastInsert.ms) + " · " + insertReads(cfg.rows, on.length) + " page reads and writes", "un libro nuevo · " + fmtMs(lastInsert.ms) + " · " + insertReads(cfg.rows, on.length) + " lecturas y escrituras de página")); });
    steps.push({ dur: 0.6 });
  }

  let turn = 0;
  function next() { if (cfg.writes && turn % 2 === 1) runInsert(); else runQuery(); turn++; }

  function advance(dt) {
    let left = dt, guard = 0;
    while (left > 1e-9 && guard++ < 400) {
      if (!current) {
        current = steps.shift();
        if (!current) { next(); continue; }
        current.elapsed = 0; current.begin && current.begin();
        if (current.dur === 0) { const c = current; current = null; c.run && c.run(1); c.done && c.done(); continue; }
      }
      const use = Math.min(current.dur - current.elapsed, left);
      current.elapsed += use; left -= use;
      current.run && current.run(Math.min(1, current.elapsed / current.dur));
      if (current.elapsed >= current.dur - 1e-9) { const c = current; current = null; c.done && c.done(); }
    }
  }

  function showLive() {
    stat("time", fmtMs(watchMs));
    stat("reads", int(readsShown));
  }
  function showStats() {
    stat("rows", int(cfg.rows));
    stat("cats", cfg.on.length);
    const plan = choose(cfg.query, cfg.rows, cfg.on);
    stat("plan", planName(plan));
    if (lastQuery) { stat("time", fmtMs(lastQuery.ms)); stat("reads", int(lastQuery.plan.reads)); }
    stat("insert", cfg.writes ? fmtMs(insertCost(cfg.rows, cfg.on.length)) : "–");
  }

  // Several catalogues can be on at once, so each catalogue button shows its own state.
  function applyCatalogues() {
    G.CABS.forEach((c, i) => { cabEls[i].forEach((el) => { el.style.display = cfg.on.includes(c.id) ? "" : "none"; }); });
    root.press("idx", cfg.on.join(" "));
  }
  function restart() {
    steps = []; current = null; turn = 0; watchMs = 0; readsShown = 0; lastQuery = null; lastInsert = null;
    random = rng(7); carrying = false; fly.style.opacity = "0"; newBook.style.display = "none"; setLamp(false);
    clearScene(); setCount(COUNT.books, 0);
    setTrolley([G.HOME[0], G.HOME[1]]); setNeedle(0);
    stat("time", "–"); stat("reads", "–");
    showStats();
  }
  function set(name, raw) {
    if (name === "rows") { cfg.rows = Number(raw); root.press(name, raw); }
    if (name === "query") { cfg.query = raw; root.press(name, raw); }
    if (name === "writes") { cfg.writes = raw === "true" || raw === true; root.press(name, String(cfg.writes)); }
    if (name === "speed") { cfg.speed = Number(raw); root.press(name, raw); return; }
    if (name === "idx") { cfg.on = cfg.on.includes(raw) ? cfg.on.filter((x) => x !== raw) : [...cfg.on, raw]; applyCatalogues(); }
    restart();
  }

  const pause = playPause(root);
  const clock = WB.loop({ stage, step: (dt) => advance(dt * cfg.speed), onPause: pause.onPause });
  pause.bind(clock);
  clock.setPaused(clock.paused);
  root.on("change", (name, value) => set(name, value));
  const actions = { restart };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    cfg.rows = w.rows; cfg.query = w.query; cfg.on = [...(w.then || w.on)]; cfg.writes = w.writes;
    root.press("rows", cfg.rows); root.press("query", cfg.query); root.press("writes", String(cfg.writes));
    if (cfg.rows >= 100000 && cfg.speed < 8) { cfg.speed = 8; root.press("speed", 8); }
    applyCatalogues(); restart();
    if (clock.paused) clock.setPaused(false);
  });

  applyCatalogues(); showStats(); setNeedle(0); setCount(COUNT.books, 0);
}

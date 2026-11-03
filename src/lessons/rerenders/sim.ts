// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// A shop page as a React-style component tree, and the rules that decide which components render after a state
// change. Seeded and deterministic, shared by the live figure and the experiments.
//
// The tree (87 components): App → Header (Logo, Nav → 6 NavLink, UserMenu, CartBadge), Sidebar (PriceChart,
// 12 Filter), SearchPanel (SearchInput, Suggestions, ResultList → 48 ResultCard), Footer (8 FooterLink).
//
// The rules, as React applies them:
//   - A component renders when it has its own state update, when a context it reads gets a new value (Object.is), when
//     a store subscription's selected value changes (Object.is), or when its owner (the component whose render
//     created its element) renders. Elements passed in as children from an owner that did not render are the same
//     elements as last time, so they are skipped.
//   - React.memo: when the owner renders, the new props are compared with the old ones, one by one with Object.is; if
//     all are equal, the component is skipped (an update of its own, a context or a subscription still renders it).
//   - Rendering is calling the component and comparing its output with the last one. Only output that changed is
//     committed to the DOM.
//
// Where the shared state lives (cfg.source):
//   "top"     useState in App, passed down as props
//   "down"    each piece of state in the lowest component that contains everyone who reads or sets it
//   "context" App is the provider: it holds the state in useState, passes it in one context value, and renders
//             {children}, so its own render doesn't reach them; every reader calls useContext
//   "split"   the same, with one context per piece of state (and the setters in a context of their own)
//   "store"   a store outside React (Zustand-style): every reader subscribes with a selector through
//             useSyncExternalStore; a set() calls every subscriber, each runs its selector and compares the result
//             with the last one (Object.is), and only the ones that changed render
// cfg.memo: "off"; "stable" (React.memo on Header, Sidebar, ResultList, ResultCard and Footer, callbacks kept with
// useCallback); "inline" (the same React.memo, but the callbacks are arrow functions written in the render).
//
// Costs are the model's, in microseconds: what each component costs to render (a link 8 µs, a card 250 µs, the price
// chart 5 ms), a props comparison, a selector call and a DOM change.

import { rngMixed } from "../../lib/random";
import { mean } from "../../lib/stats";

export const SOURCES = ["top", "down", "context", "split", "store"];
export const CARDS = 48;

// name, parent (by name), count, render cost (µs), memo-able
const SPEC = [
  ["App", null, 1, 30],
  ["Header", "App", 1, 25, true],
  ["Logo", "Header", 1, 10],
  ["Nav", "Header", 1, 15],
  ["NavLink", "Nav", 6, 8],
  ["UserMenu", "Header", 1, 40],
  ["CartBadge", "Header", 1, 20],
  ["Sidebar", "App", 1, 20, true],
  ["PriceChart", "Sidebar", 1, 5000],
  ["Filter", "Sidebar", 12, 25],
  ["SearchPanel", "App", 1, 20],
  ["SearchInput", "SearchPanel", 1, 30],
  ["Suggestions", "SearchPanel", 1, 80],
  ["ResultList", "SearchPanel", 1, 60, true],
  ["ResultCard", "ResultList", CARDS, 250, true],
  ["Footer", "App", 1, 15, true],
  ["FooterLink", "Footer", 8, 8],
];

// The tree, expanded: one node per component, in render (depth-first) order.
export const NODES = [];
export const FIRST = {};            // name -> id of its first node
{
  const firstOf = {};
  const add = (name, parentId, depth) => {
    const spec = SPEC.find((s) => s[0] === name);
    const [, , count, cost, memo] = spec;
    for (let i = 0; i < count; i++) {
      const id = NODES.length;
      NODES.push({ id, name, index: i, parent: parentId, depth, cost, memo: !!memo, kids: [] });
      if (parentId !== null) NODES[parentId].kids.push(id);
      if (firstOf[name] === undefined) firstOf[name] = id;
      for (const child of SPEC.filter((s) => s[1] === name)) add(child[0], id, depth + 1);
    }
  };
  add("App", null, 0);
  Object.assign(FIRST, firstOf);
}
export const N = NODES.length;
const byName = (name) => NODES.filter((n) => n.name === name).map((n) => n.id);
const ID = (name) => FIRST[name];
export const CARD_IDS = byName("ResultCard");

// The catalog the cards show, and the suggestions for what is typed.
const WORDS_A = ["Oak", "Walnut", "Linen", "Brass", "Wool", "Glass", "Cedar", "Steel"];
const WORDS_B = ["desk", "lamp", "chair", "shelf", "rug", "stool"];
export const CATALOG = Array.from({ length: CARDS }, (_, i) => WORDS_A[i % 8] + " " + WORDS_B[Math.floor(i / 8)]);
const ITEMS = CATALOG.map((name, id) => ({ id, name }));
export const suggestionsFor = (q) => (q ? CATALOG.filter((n) => n.toLowerCase().includes(q.toLowerCase())).slice(0, 4) : []);
export const SEARCHES = ["oak desk", "lamp", "brass", "wool rug", "shelf", "cedar"];

// Costs (µs).
export const COST = { compare: 0.5, perProp: 0.25, selector: 0.5, commit: 25 };

// Who reads which piece of state, and where each piece lives with useState.
const READERS = {
  user: [ID("UserMenu")],
  cart: [ID("CartBadge")],
  filters: [ID("Sidebar")],
  query: [ID("SearchInput"), ID("Suggestions")],
  results: [ID("ResultList")],
  selected: CARD_IDS,
};
export const READER_COUNT = Object.values(READERS).flat().length;   // components that read shared state (context readers, store subscribers)
const OWNER_DOWN = { user: ID("UserMenu"), cart: ID("App"), filters: ID("Sidebar"), query: ID("SearchPanel"), results: ID("SearchPanel"), selected: ID("ResultList") };
export function ownerOf(source, slice) {
  if (source === "store") return null;
  if (source === "down") return OWNER_DOWN[slice];
  return ID("App");
}

// Stable values: one identity each for the lifetime of the page.
const USER = { name: "Ana" }, FILTERS = { price: "any" }, RESULTS = ITEMS;
const STABLE = new Map();
const stableFn = (key) => { if (!STABLE.has(key)) STABLE.set(key, { fn: key }); return STABLE.get(key); };

export function makeApp({ source = "top", memo = "off" } = {}, seed = 1) {
  const rnd = rngMixed(seed);
  const state = { query: "", selected: Math.floor(rnd() * CARDS), cart: 2, user: USER, filters: FILTERS, results: RESULTS };
  let inline = 0;
  // A callback prop: the same function every time (useCallback, or a setter), or a new arrow on every render.
  const cb = (key) => (memo === "inline" ? { fn: key, n: ++inline } : stableFn(key));
  const contextMode = source === "context" || source === "split";

  // Props each component gives the elements it creates (only for the children it owns).
  function propsFor(id) {
    const n = NODES[id], s = state;
    const top = source === "top", down = source === "down";
    switch (n.name) {
      case "Header": return top ? { user: s.user, cart: s.cart, onLogout: cb("logout") } : down ? { cart: s.cart, onLogout: cb("logout") } : { onLogout: cb("logout") };
      case "UserMenu": return top ? { user: s.user } : {};
      case "CartBadge": return top || down ? { cart: s.cart } : {};
      case "Sidebar": return top ? { filters: s.filters, onFilter: cb("filter") } : { onFilter: cb("filter") };
      case "Filter": return { n: n.index };
      case "NavLink": case "FooterLink": return { n: n.index };
      case "SearchPanel": return top ? { query: s.query, selected: s.selected, onQuery: cb("query"), onSelect: cb("select"), onAdd: cb("add") } : down ? { onAdd: cb("add") } : {};
      case "SearchInput": return top || down ? { value: s.query, onChange: cb("query") } : {};
      case "Suggestions": return top || down ? { query: s.query } : {};
      case "ResultList": return top ? { results: s.results, selected: s.selected, onSelect: cb("select"), onAdd: cb("add") } : down ? { results: s.results, onAdd: cb("add") } : {};
      case "ResultCard": {
        const item = ITEMS[n.index];
        if (top || down) return { item, selected: s.selected === n.index, onSelect: cb("select-" + n.index), onAdd: cb("add-" + n.index) };
        return { item };
      }
      default: return {};
    }
  }
  // In the context modes App renders {children}: its children's elements come from outside and never change.
  const ownedBy = (child) => !(contextMode && NODES[child].parent === ID("App"));

  // What a component puts on the page (its DOM output), from the state it shows.
  function out(id) {
    const n = NODES[id], s = state;
    switch (n.name) {
      case "SearchInput": return "input:" + s.query;
      case "Suggestions": return suggestionsFor(s.query).join("|");
      case "CartBadge": return "cart:" + s.cart;
      case "UserMenu": return "user:" + s.user.name;
      case "ResultCard": return ITEMS[n.index].name + (s.selected === n.index ? " *" : "");
      default: return n.name + (n.index ? n.index : "");
    }
  }

  // Context mode: which context each reader uses, and that context's value.
  const ctxOf = (slice) => (source === "context" ? "app" : slice);
  let ctxValue = {};
  const contextValues = () => {
    if (source === "context") return { app: { ...state } };              // a new object on every provider render
    const v = {}; for (const k of Object.keys(READERS)) v[k] = state[k]; return v;
  };
  // Store mode: each reader's selector.
  const selectorOf = (id) => {
    const n = NODES[id];
    if (n.name === "ResultCard") return (s) => s.selected === n.index;
    const slice = Object.keys(READERS).find((k) => READERS[k].includes(id));
    return (s) => s[slice];
  };
  const SUBS = source === "store" ? Object.values(READERS).flat().sort((a, b) => a - b) : [];
  const selected = new Map();

  const prevProps = new Array(N).fill(null);
  const prevOut = new Array(N).fill(null);

  function renderPass(dirty, jitter) {
    const rendered = [], causes = [], compares = [], commits = [];
    let work = 0;
    const visit = (id, ownerRendered, props) => {
      const n = NODES[id];
      let renders = dirty.has(id);
      if (ownerRendered) {
        // React.memo compares only when nothing else already makes the component render.
        if (n.memo && memo !== "off" && !renders) {
          const old = prevProps[id], keys = Object.keys(props);
          const same = old && keys.length === Object.keys(old).length && keys.every((k) => Object.is(old[k], props[k]));
          compares.push({ id, same });
          work += COST.compare + COST.perProp * keys.length;
          if (!same) renders = true;
        } else renders = true;
        prevProps[id] = props;
      }
      if (renders) {
        rendered.push(id); causes.push(dirty.get(id) || "owner");
        work += n.cost * (jitter ? 0.8 + 0.4 * jitter() : 1);
        const o = out(id);
        if (o !== prevOut[id]) { if (prevOut[id] !== null) commits.push(id); prevOut[id] = o; work += COST.commit; }
      }
      for (const k of n.kids) {
        const owned = renders && ownedBy(k);
        visit(k, owned, owned ? propsFor(k) : null);
      }
    };
    visit(0, false, null);
    return { rendered, causes, compares, commits, work };
  }

  // First render: everything mounts.
  {
    const all = new Map(NODES.map((n) => [n.id, "mount"]));
    renderPass(all, null);
    ctxValue = contextValues();
    for (const id of SUBS) selected.set(id, selectorOf(id)(state));
    for (let id = 0; id < N; id++) if (!prevProps[id]) prevProps[id] = propsFor(id);
  }

  // Change one piece of state, then render what React would render.
  function update(slice, value) {
    if (Object.is(state[slice], value)) return null;
    state[slice] = value;
    const dirty = new Map();          // id -> why it renders: "state", "context" or "store"
    let selectorsRun = 0, origin = [];
    if (source === "store") {
      for (const id of SUBS) {
        selectorsRun++;
        const v = selectorOf(id)(state);
        if (!Object.is(v, selected.get(id))) { selected.set(id, v); dirty.set(id, "store"); }
      }
    } else {
      const owner = ownerOf(source, slice);
      dirty.set(owner, "state"); origin = [owner];
      if (contextMode) {
        const next = contextValues();
        for (const [key, readers] of Object.entries(READERS)) {
          const c = ctxOf(key);
          if (!Object.is(next[c], ctxValue[c])) readers.forEach((id) => { if (!dirty.has(id)) dirty.set(id, "context"); });
        }
        ctxValue = next;
      }
    }
    const pass = renderPass(dirty, rnd);
    pass.work += selectorsRun * COST.selector;
    const changed = new Set(pass.commits);
    return {
      slice, origin, dirty: [...dirty.keys()], selectorsRun, ...pass,
      wasted: pass.rendered.filter((id) => !changed.has(id)).length,
      blocked: pass.compares.filter((c) => c.same).length,
    };
  }

  // The interactions: a keystroke (typing the next search, or clearing the box), picking a card, adding to the cart.
  let typing = { word: 0, at: 0 };
  function key() {
    const word = SEARCHES[typing.word % SEARCHES.length];
    if (typing.at >= word.length) { typing = { word: typing.word + 1, at: 0 }; return update("query", ""); }
    typing.at++;
    return update("query", word.slice(0, typing.at));
  }
  function pick() {
    let next = Math.floor(rnd() * (CARDS - 1));
    if (next >= state.selected) next++;
    return update("selected", next);
  }
  const addToCart = () => update("cart", state.cart + 1);
  // Check: everything on the page shows the current state (nothing stale), whatever rendered.
  const consistent = () => NODES.every((n) => prevOut[n.id] === out(n.id));

  return { state, key, pick, addToCart, update, consistent, cfg: { source, memo }, subscribers: SUBS.length };
}

// ---------- measurements for the experiments ----------
export const SEEDS = [3, 5, 7, 11, 13, 17, 19, 23];
export const COUNT = 40;                  // interactions per run
const ACT = { key: (a) => a.key(), pick: (a) => a.pick(), cart: (a) => a.addToCart() };

// Run `count` interactions of one kind and average what each update did.
export function measure(cfg, action = "key", count = COUNT, seed = 1) {
  const app = makeApp(cfg, seed);
  const ups = [];
  for (let i = 0; i < count; i++) { const u = ACT[action](app); if (u) ups.push(u); }
  if (!app.consistent()) throw new Error("model left stale output: " + JSON.stringify(cfg));
  const avg = (f) => mean(ups.map(f));
  return {
    rendered: avg((u) => u.rendered.length), commits: avg((u) => u.commits.length), wasted: avg((u) => u.wasted),
    compares: avg((u) => u.compares.length), blocked: avg((u) => u.blocked), selectors: avg((u) => u.selectorsRun),
    work: avg((u) => u.work) / 1000,            // ms
    cardsRendered: avg((u) => u.rendered.filter((id) => NODES[id].name === "ResultCard").length),
  };
}
export function averaged(cfg, action = "key", count = COUNT, seeds = SEEDS) {
  const runs = seeds.map((s) => measure(cfg, action, count, s));
  const outv = {};
  for (const k of Object.keys(runs[0])) outv[k] = mean(runs.map((r) => r[k]));
  return outv;
}

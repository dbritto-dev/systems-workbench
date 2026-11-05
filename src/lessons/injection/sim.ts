// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// A records room that answers order lookups with SQL. Three shops share one orders table; staff of a shop look up a
// customer's orders by name and pick a sort column. The app builds the statement one of three ways (paste the words
// in, paste them with quotes doubled, or send them as parameters), and a small SQL engine below really tokenizes,
// parses and runs what it gets. Nothing about injection is scripted: a name that ends the string early, or a condition
// that comes from the input, does what the parser makes of it.
//
// cfg:
//   name     "paste" | "escape" | "param"           how the name box reaches the statement
//   sort     "paste" | "escape" | "param" | "allow" how the sort box reaches it (allow: an allowlist of column names)
//   account  "full" | "rls"                         the app's database account: every row, or a row policy that shows
//                                                   only the signed-in shop's rows (PostgreSQL row-level security)
//   attack   share of requests that type the textbook input ' OR '1'='1 into the name box
//   tamper   share of requests whose sort value was edited to a column the page doesn't offer (cost)
import { xorshift32 } from "../../lib/random";
import { averageOver } from "../../lib/stats";

export const DEFAULTS = { name: "paste", sort: "paste", account: "full", attack: 0, tamper: 0 };
export const CLASSIC = "' OR '1'='1";
export const SORTS = ["day", "total", "item"];          // what the page's sort menu offers
export const OFF_LIST = "cost";                           // a real column the page never shows
export const SHOPS = ["A", "B", "C"];

// The orders table, in storage order. Each customer has three orders, stored in an order that is not sorted by day,
// total or item, so a list that comes back unsorted shows it.
const CUSTOMERS = { A: ["Lopez", "Kim"], B: ["O'Neil", "Novak"], C: ["D'Souza", "Tanaka"] };
const ITEMS = ["lamp", "mug", "rug", "desk", "pen", "tea", "jar", "map", "fan", "bag", "cup", "ink", "kit", "box", "hat", "oil", "saw", "net"];
export const ROWS = (() => {
  const rows = [];
  let id = 1;
  // ranks of the three orders, in storage order: never 1, 2, 3
  const dayRank = [2, 3, 1], totalRank = [3, 1, 2], itemRank = [2, 1, 3];
  SHOPS.forEach((shop, s) => CUSTOMERS[shop].forEach((name, c) => {
    const k = s * 2 + c;
    const items = [ITEMS[k * 3], ITEMS[k * 3 + 1], ITEMS[k * 3 + 2]].sort();
    for (let j = 0; j < 3; j++) {
      rows.push({ id, shop, name, day: 2 + k * 4 + dayRank[j], total: 10 * (k + 1) + 7 * totalRank[j], item: items[itemRank[j] - 1], cost: 3 + ((id * 7) % 11) });
      id++;
    }
  }));
  return rows;
})();
export const COLUMNS = ["id", "shop", "name", "day", "total", "item", "cost"];

// ---------- the SQL engine: tokenizer, parser, evaluator ----------
const KEYWORDS = new Set(["SELECT", "FROM", "WHERE", "AND", "OR", "ORDER", "BY"]);
export function tokenize(sql) {
  const out = [];
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "'") {
      let j = i + 1, value = "";
      for (;;) {
        if (j >= sql.length) return { error: "unterminated quoted string", at: i };
        if (sql[j] === "'") { if (sql[j + 1] === "'") { value += "'"; j += 2; continue; } break; }
        value += sql[j++];
      }
      out.push({ kind: "str", value, at: i, end: j + 1 });
      i = j + 1;
      continue;
    }
    if (c === "$") {
      let j = i + 1;
      while (/[0-9]/.test(sql[j] || "")) j++;
      out.push({ kind: "param", value: Number(sql.slice(i + 1, j)), at: i, end: j });
      i = j;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (/[0-9]/.test(sql[j] || "")) j++;
      out.push({ kind: "num", value: Number(sql.slice(i, j)), at: i, end: j });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (/[A-Za-z0-9_]/.test(sql[j] || "")) j++;
      const word = sql.slice(i, j);
      out.push(KEYWORDS.has(word.toUpperCase()) ? { kind: "kw", value: word.toUpperCase(), at: i, end: j } : { kind: "ident", value: word.toLowerCase(), at: i, end: j });
      i = j;
      continue;
    }
    if (c === "*" || c === "=" || c === ",") { out.push({ kind: "sym", value: c, at: i, end: i + 1 }); i++; continue; }
    return { error: "syntax error at or near \"" + c + "\"", at: i };
  }
  return { tokens: out };
}

// SELECT * FROM orders WHERE cond [ORDER BY operand], cond := and (OR and)*, and := cmp (AND cmp)*, cmp := a = b
export function parse(sql) {
  const lex = tokenize(sql);
  if (lex.error) return lex;
  const tk = lex.tokens;
  let p = 0;
  const peek = () => tk[p];
  const fail = () => ({ error: peek() ? "syntax error at or near \"" + (peek().kind === "str" ? "'" + peek().value + "'" : peek().value) + "\"" : "syntax error at end of input" });
  const want = (kind, value) => {
    const x = tk[p];
    if (!x || x.kind !== kind || (value !== undefined && x.value !== value)) throw fail();
    p++;
    return x;
  };
  const operand = () => {
    const x = tk[p];
    if (x && (x.kind === "ident" || x.kind === "str" || x.kind === "num" || x.kind === "param")) { p++; return x; }
    throw fail();
  };
  const cmp = () => { const a = operand(); want("sym", "="); return { op: "=", a, b: operand() }; };
  const and = () => { let e = cmp(); while (peek() && peek().kind === "kw" && peek().value === "AND") { p++; e = { op: "AND", a: e, b: cmp() }; } return e; };
  const or = () => { let e = and(); while (peek() && peek().kind === "kw" && peek().value === "OR") { p++; e = { op: "OR", a: e, b: and() }; } return e; };
  try {
    want("kw", "SELECT"); want("sym", "*"); want("kw", "FROM");
    const table = want("ident").value;
    want("kw", "WHERE");
    const where = or();
    let order = null;
    if (peek() && peek().kind === "kw" && peek().value === "ORDER") { p++; want("kw", "BY"); order = operand(); }
    if (p < tk.length) throw fail();
    return { table, where, order, tokens: tk };
  } catch (e) {
    if (e && e.error) return e;
    throw e;
  }
}

// The statement's shape: its tokens with every literal value blanked out. Two statements with the same shape differ
// only in data.
export const shapeOf = (tokens) => tokens.map((x) => (x.kind === "str" || x.kind === "num" ? "lit" : x.kind === "param" ? "$" + x.value : x.kind + ":" + x.value)).join(" ");

// Run a parsed statement. values: the bound parameters. visible: the rows the account may see.
export function execute(ast, values, visible) {
  if (ast.table !== "orders") return { error: "relation \"" + ast.table + "\" does not exist" };
  const val = (x, row) => {
    if (x.kind === "ident") { if (!COLUMNS.includes(x.value)) throw { error: "column \"" + x.value + "\" does not exist" }; return String(row[x.value]); }
    if (x.kind === "param") return String(values[x.value - 1]);
    return String(x.value);
  };
  const test = (e, row) => (e.op === "=" ? val(e.a, row) === val(e.b, row) : e.op === "AND" ? test(e.a, row) && test(e.b, row) : test(e.a, row) || test(e.b, row));
  try {
    let rows = visible.filter((row) => test(ast.where, row));
    // ORDER BY a column sorts by it; a bound value or a literal is the same constant for every row, so the order stays
    // whatever the scan gave (here: storage order).
    if (ast.order && ast.order.kind === "ident") {
      if (!COLUMNS.includes(ast.order.value)) return { error: "column \"" + ast.order.value + "\" does not exist" };
      const col = ast.order.value;
      rows = [...rows].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0));
    }
    return { rows };
  } catch (e) {
    if (e && e.error) return e;
    throw e;
  }
}

// ---------- the app: how one request becomes a statement ----------
const esc = (s) => s.replace(/'/g, "''");
// The statement as lines of segments [text, kind]: "tpl" is the app's own text, "in" the user's words pasted in,
// "slot" a parameter placeholder, "list" a column name the app took from its allowlist.
export function build(req, cfg) {
  const lines = [[["SELECT * FROM orders", "tpl"]]];
  const values = [];
  const slot = (v) => { values.push(v); return ["$" + values.length, "slot"]; };
  const shop = cfg.name === "param" ? slot(req.shop) : ["'" + req.shop + "'", "tpl"];
  lines.push([["WHERE shop = ", "tpl"], shop]);
  const nameIn = cfg.name === "escape" ? esc(req.name) : req.name;
  lines.push(cfg.name === "param" ? [["  AND name = ", "tpl"], slot(req.name)] : [["  AND name = '", "tpl"], [nameIn, "in"], ["'", "tpl"]]);
  if (cfg.sort === "allow") {
    if (!SORTS.includes(req.sort)) return { rejected: true, lines: [...lines, [["ORDER BY ", "tpl"], ["?", "tpl"]]], values };
    lines.push([["ORDER BY ", "tpl"], [req.sort, "list"]]);
  } else if (cfg.sort === "param") lines.push([["ORDER BY ", "tpl"], slot(req.sort)]);
  else lines.push([["ORDER BY ", "tpl"], [cfg.sort === "escape" ? esc(req.sort) : req.sort, "in"]]);
  return { lines, values, sql: lines.map((l) => l.map((s) => s[0]).join("")).join("\n") };
}

// The shapes the app means to send in this mode: the same build with an ordinary name and each offered sort.
const allowedShapes = (cfg) => new Set(SORTS.map((sort) => { const a = parse(build({ shop: "A", name: "Kim", sort }, cfg).sql); return shapeOf(a.tokens); }));

// One request through the app and the database.
export function serve(req, cfg) {
  const b = build(req, cfg);
  const out = { req, lines: b.lines, values: b.values, sql: b.sql, rejected: !!b.rejected, error: null, rows: [], leaked: 0, asCode: false, unsorted: false };
  if (b.rejected) return out;
  const ast = parse(b.sql);
  if (ast.error) { out.error = ast.error; return out; }
  out.asCode = !allowedShapes(cfg).has(shapeOf(ast.tokens));
  const visible = cfg.account === "rls" ? ROWS.filter((r) => r.shop === req.shop) : ROWS;
  const res = execute(ast, b.values, visible);
  if (res.error) { out.error = res.error; return out; }
  out.rows = res.rows.map((r) => r.id);
  out.leaked = res.rows.filter((r) => r.shop !== req.shop).length;
  // Did the list come back in the order the user asked for? (Only for honest requests with something to order.)
  if (SORTS.includes(req.sort) && res.rows.length > 1) {
    const col = req.sort;
    out.unsorted = res.rows.some((r, i) => i > 0 && res.rows[i - 1][col] > r[col]);
  }
  return out;
}

// ---------- the stream of visitors ----------
export function makeDesk(cfgIn, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rnd = xorshift32(seed);
  const pick = (xs) => xs[Math.floor(rnd() * xs.length) % xs.length];
  let n = 0;
  const st = { requests: 0, errors: 0, leaked: 0, asCode: 0, unsorted: 0, rejected: 0, rows: 0, texts: new Set() };
  function nextReq() {
    const shop = pick(SHOPS);
    const sort = pick(SORTS);
    if (rnd() < cfg.attack) return { shop, name: CLASSIC, sort, attack: true };
    const name = pick(CUSTOMERS[shop]);
    return { shop, name, sort: rnd() < cfg.tamper ? OFF_LIST : sort, tampered: false };
  }
  function tally(r) {
    st.requests++;
    if (r.error) st.errors++;
    if (r.rejected) st.rejected++;
    if (r.asCode) st.asCode++;
    if (r.unsorted) st.unsorted++;
    st.leaked += r.leaked;
    st.rows += r.rows.length;
    if (r.sql) st.texts.add(r.sql);
    return r;
  }
  return {
    cfg, st,
    get n() { return n; },
    next(forced) { n++; const req = forced || nextReq(); if (req.sort === OFF_LIST) req.tampered = true; return tally(serve(req, cfg)); },
  };
}

// ---------- experiments: headless runs averaged over seeds ----------
const SEEDS = [11, 23, 37, 41, 59, 67, 73, 89];
export const REQUESTS = 120;
// Run a stream and sum it up; also per kind of request (apostrophe names, attacks, off-list sorts, ordinary).
function stream(cfg, seed) {
  const d = makeDesk(cfg, seed);
  const k = { apos: 0, aposErr: 0, plain: 0, plainErr: 0, attacks: 0, attackRows: 0, attackLeak: 0, attackErr: 0, attackCode: 0, tampered: 0, tamperCode: 0, tamperRejected: 0, honestLists: 0, honestUnsorted: 0, aposRows: 0 };
  for (let i = 0; i < REQUESTS; i++) {
    const r = d.next();
    const q = r.req;
    if (q.attack) { k.attacks++; k.attackRows += r.rows.length; k.attackLeak += r.leaked; if (r.error) k.attackErr++; if (r.asCode) k.attackCode++; }
    else if (q.tampered) { k.tampered++; if (r.asCode) k.tamperCode++; if (r.rejected) k.tamperRejected++; }
    else {
      if (q.name.includes("'")) { k.apos++; if (r.error) k.aposErr++; k.aposRows += r.rows.length; }
      else { k.plain++; if (r.error) k.plainErr++; }
      if (!r.error && !r.rejected) { k.honestLists++; if (r.unsorted) k.honestUnsorted++; }
    }
  }
  const s = d.st;
  return { requests: s.requests, errors: s.errors, leaked: s.leaked, asCode: s.asCode, unsorted: s.unsorted, rejected: s.rejected, texts: s.texts.size, ...k };
}
const avg = (cfg) => averageOver(SEEDS, (seed) => stream(cfg, seed));
export const ATTACK = 1 / 6, TAMPER = 1 / 6;

// 1. Paste the name in; ordinary customers, two of them with an apostrophe in their name.
export function aposRun() { return { paste: avg({ name: "paste", sort: "allow" }) }; }
// 2. The textbook input: paste vs parameters.
export function classicRun() { return { paste: avg({ name: "paste", sort: "allow", attack: ATTACK }), param: avg({ name: "param", sort: "allow", attack: ATTACK }) }; }
// 3. Escaping quotes vs parameters, on the name box, with the attacker.
// Also: the share of requests whose rows came back the same in both (the same seed gives the same visitors).
export function escapeRun() {
  const a = { name: "escape", sort: "allow", attack: ATTACK }, b = { name: "param", sort: "allow", attack: ATTACK };
  const same = averageOver(SEEDS, (seed) => {
    const da = makeDesk(a, seed), db = makeDesk(b, seed);
    let n = 0;
    for (let i = 0; i < REQUESTS; i++) { const x = da.next(), y = db.next(); if (!x.error && !y.error && x.rows.join() === y.rows.join()) n++; }
    return { same: n / REQUESTS };
  }).same;
  return { escape: avg(a), param: avg(b), same };
}
// 4. The sort box: escaped and pasted, bound as a parameter, or taken from an allowlist; some sort values edited.
export function sortRun() {
  return {
    escape: avg({ name: "param", sort: "escape", tamper: TAMPER }),
    param: avg({ name: "param", sort: "param", tamper: TAMPER }),
    allow: avg({ name: "param", sort: "allow", tamper: TAMPER }),
  };
}
// 5. The hole left open (paste), with the database account limited to the signed-in shop's rows.
export function accountRun() { return { full: avg({ name: "paste", sort: "allow", attack: ATTACK }), rls: avg({ name: "paste", sort: "allow", attack: ATTACK, account: "rls" }) }; }

export const TABLE = { rows: ROWS.length, perShop: ROWS.length / SHOPS.length, perCustomer: 3 };

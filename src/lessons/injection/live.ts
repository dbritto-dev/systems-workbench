// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The records room in the browser: visitors step up to the window one at a time; the app builds each statement
// (shown on the board, pasted words on a lit strip, parameters in the values board), the model's SQL engine runs it,
// and the rows it returns slide out of the cabinet and are laid in the tray in the order returned. mount() gets the
// build-time data from page.ts (projection, geometry, the visitor drawing) and root, the <wb-lesson>.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, setLit, playPause } from "../../runtime/dom";
import { lerp, easeInOutQuad } from "../../lib/tween";
import { clamp } from "../../lib/stats";
import { makeDesk, ROWS, SORTS, CLASSIC, OFF_LIST } from "./sim";

const CYCLE = 3.4, WALK = 0.7, RUN = 1.4;            // model seconds: a visitor's turn, the walk, when the query runs
const HELD = 8;                                       // a sent visitor's turn (Send buttons, Watch): its result stays up

export default function mount({ P, G, VISITOR_SVG }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const NS = "http://www.w3.org/2000/svg";
  const layer = q('[data-layer="visitors"]');
  const lines = qa("[data-line]").map((g) => ({ g, text: g.querySelector("text"), strip: g.querySelector("[data-strip]") }));
  const vals = qa("[data-val]").map((g) => ({ g, text: g.querySelector("[data-val-text]") }));
  const slip = { shop: q('[data-slip="shop"]'), name: q('[data-slip="name"]'), sort: q('[data-slip="sort"]') };
  const drawers = qa("[data-drawer]");
  const drawerBox = q("[data-drawers]");
  const shutters = qa("[data-shutter]");
  const cards = qa("[data-card]").map((g) => ({ g, text: g.querySelector("[data-card-text]") }));
  const errorPlaque = q("[data-error]");
  const reach = { full: q('[data-reach="full"]'), rls: q('[data-reach="rls"]') };
  const names = ["requests", "errors", "leaked", "asCode", "unsorted", "rejected"];
  const counters = Object.fromEntries(names.map((n) => [n, WB.counter(svg, n, P)]));

  // ---------- visitors: a small pool of figurines ----------
  const pool = [];
  function figure() {
    const g = pool.pop() || (() => { const e = document.createElementNS(NS, "g"); e.innerHTML = VISITOR_SVG; return e; })();
    layer.appendChild(g);
    return g;
  }
  function drop(g) { g.remove(); g.style.opacity = ""; pool.push(g); }

  // ---------- settings and the run ----------
  const cfg = { name: "paste", sort: "allow", account: "full", attack: "0", tamper: "0", speed: 1 };
  let desk, clock, turnAt, turnLen = CYCLE, cur, prev, forced = [], seed = 3, outAt = new Map(), shown = null;
  let people = [];                                   // { g, from, to, fade: "in" | "out" | null }

  function restart() {
    desk = makeDesk({ name: cfg.name, sort: cfg.sort, account: cfg.account, attack: Number(cfg.attack), tamper: Number(cfg.tamper) }, seed);
    seed = (seed * 7 + 3) % 9973 + 1;
    clock = 0; turnAt = -CYCLE; turnLen = CYCLE; cur = null; prev = null; shown = null;
    for (const p of people) drop(p.g);
    people = [];
    // the line: the first turn walks the one at its front up to the window
    G.QUEUE.forEach((spot) => people.push({ g: figure(), from: spot, to: spot, role: "wait" }));
    clearResult(true);
    writeStatement(null);
    paintCounters();
    show(reach.full, cfg.account === "full"); show(reach.rls, cfg.account === "rls");
  }

  // ---------- the statement board, the values board and the slip ----------
  function writeStatement(r) {
    lines.forEach((ln, i) => {
      const segs = r ? r.lines[i] || [] : [];
      while (ln.text.firstChild) ln.text.firstChild.remove();
      let inAt = -1, inLen = 0, n = 0;
      for (const [txt, kind] of segs) {
        const span = document.createElementNS(NS, "tspan");
        let words = txt;
        if (kind === "tpl" && txt === "?") words = L("(" + r.req.sort + ": not allowed)", "(" + r.req.sort + ": no permitido)");
        span.textContent = words;
        if (kind === "in") { span.setAttribute("data-in", ""); inAt = n; inLen = words.length; }
        if (kind === "slot") span.setAttribute("data-slot", "");
        ln.text.appendChild(span);
        n += words.length;
      }
      let x = 0, w = 0;
      if (inAt >= 0 && inLen > 0) {
        try { x = ln.text.getSubStringLength(0, inAt); w = ln.text.getSubStringLength(inAt, inLen); } catch { w = 0; }
      }
      const h = G.LINE_SIZE;
      ln.strip.setAttribute("x", (x - 0.5).toFixed(2));
      ln.strip.setAttribute("y", (-h * 0.86).toFixed(2));
      ln.strip.setAttribute("width", w > 0 ? (w + 1).toFixed(2) : "0");
      ln.strip.setAttribute("height", w > 0 ? (h * 1.14).toFixed(2) : "0");
    });
    vals.forEach((v, i) => {
      const value = r && r.values[i] !== undefined ? String(r.values[i]) : "";
      setText(v.text, value);
      setLit(v.g, value !== "" && r.from[i] === "in");      // the visitor's words; $1, the shop, is the app's
    });
    setText(slip.shop, r ? r.req.shop : "");
    setText(slip.name, r ? r.req.name : "");
    setText(slip.sort, r ? r.req.sort : "");
  }

  // ---------- the result: drawers, cards, the error plaque, the shutters ----------
  function clearResult(snap) {
    for (const [i] of outAt) { if (snap) drawers[i].setAttribute("transform", ""); setLit(drawers[i], false); }
    if (snap) outAt.clear();
    else for (const [i, o] of outAt) o.back = clock;
    for (const c of cards) show(c.g, false);
    shown = null;
    setLit(errorPlaque, false);
    shutters.forEach((s) => show(s, false));
  }
  function showResult(r) {
    setLit(errorPlaque, !!r.error);
    const col = SORTS.includes(r.req.sort) || r.req.sort === OFF_LIST ? r.req.sort : "day";
    r.rows.forEach((id, k) => {
      outAt.set(id - 1, { at: clock + 0.04 * k, back: Infinity });
      const row = ROWS[id - 1], c = cards[k];
      setLit(drawers[id - 1], row.shop !== r.req.shop);
      setText(c.text, String(row[col]));
      setLit(c.g, row.shop !== r.req.shop);
      c.at = clock + 0.04 * k + 0.2;
    });
    shown = r;
  }
  // painter's order for the drawers: lower row first, then by how far out and from left to right, so a pulled
  // drawer covers the ones it stands in front of
  const pulled = new Array(drawers.length).fill(0);
  let drawerOrder = "";
  function sortDrawers() {
    const key = pulled.map((u) => (u > 0 ? 1 : 0)).join("");
    if (key === drawerOrder) return;
    drawerOrder = key;
    const depth = (i) => depthOf([G.DRAWER_AT[i].x + G.DRAWER.w / 2, G.CAB_FRONT + (pulled[i] > 0 ? G.DRAWER.out : 0), G.DRAWER_AT[i].z], P);
    drawers.map((_, i) => i).sort((a, b) => depth(a) - depth(b)).forEach((i) => drawerBox.appendChild(drawers[i]));
  }
  function paintResult() {
    pulled.fill(0);
    for (const [i, o] of outAt) {
      const u = o.back < Infinity ? 1 - clamp((clock - o.back) / 0.25) : clamp((clock - o.at) / 0.25);
      pulled[i] = u;
      drawers[i].setAttribute("transform", u > 0 ? translateAlong(P, [0, G.DRAWER.out * easeInOutQuad(u), 0]) : "");
      if (o.back < Infinity && u <= 0) outAt.delete(i);
    }
    sortDrawers();
    if (shown) shown.rows.forEach((_, k) => show(cards[k].g, clock >= cards[k].at));
  }
  function setShutters(r) {
    shutters.forEach((s, g) => show(s, cfg.account === "rls" && !!r && ["A", "B", "C"][g] !== r.req.shop));
  }

  // ---------- counters, stats and the readout ----------
  function paintCounters() {
    const s = desk.st;
    const v = { requests: s.requests, errors: s.errors, leaked: s.leaked, asCode: s.asCode, unsorted: s.unsorted, rejected: s.rejected };
    for (const n of names) { counters[n].setClamped(v[n]); root.stat(n, v[n]); }
  }
  const said = (en, es) => root.figure.say(L(en, es));
  function narrate(r) {
    const who = r.req.name, shop = r.req.shop;
    const n = r.rows.length;
    const rowsEn = n === 1 ? "1 row" : n + " rows", rowsEs = n === 1 ? "1 fila" : n + " filas";
    if (r.rejected) return said(r.req.sort + " is not on the list · refused, no SQL sent", r.req.sort + " no está en la lista · rechazada, sin SQL");
    if (r.error) {
      if (who.includes("'")) return said(who + " · the apostrophe ends the string · syntax error", who + " · el apóstrofo cierra el texto · error de sintaxis");
      return said("the database refused the statement · " + r.error, "la base de datos rechazó la sentencia · " + r.error);
    }
    if (r.req.attack && r.asCode) {
      if (r.leaked) return said("the quote ends the string: OR '1'='1' is code · " + n + " rows, " + r.leaked + " from other shops", "la comilla cierra el texto: OR '1'='1' es código · " + n + " filas, " + r.leaked + " de otras tiendas");
      return said("OR '1'='1' is code, but the row policy shows shop " + shop + " only · " + rowsEn, "OR '1'='1' es código, pero la política solo muestra la tienda " + shop + " · " + rowsEs);
    }
    if (r.req.attack) {
      return cfg.name === "param"
        ? said("' OR '1'='1 sent as $2, a value · no such name · 0 rows", "' OR '1'='1 va como $2, un valor · nadie se llama así · 0 filas")
        : said("quotes doubled: ' OR '1'='1 stays one string · 0 rows", "comillas duplicadas: ' OR '1'='1 es un solo texto · 0 filas");
    }
    if (r.req.tampered && r.asCode) return said(OFF_LIST + " pasted in · sorted by a column the page never shows", OFF_LIST + " pegado · ordena por una columna que la página no muestra");
    if (cfg.sort === "param" && r.req.tampered) return said(OFF_LIST + " sent as $3, a value · a constant sort, no harm · " + rowsEn, OFF_LIST + " va como $3, un valor · orden constante, sin daño · " + rowsEs);
    if (cfg.sort === "param" && r.unsorted) return said("ORDER BY $3 sorts by a constant · " + rowsEn + " in storage order, not by " + r.req.sort, "ORDER BY $3 ordena por una constante · " + rowsEs + " en el orden guardado, no por " + r.req.sort);
    if (cfg.sort === "param") return said("ORDER BY $3 sorts by a constant · " + rowsEn + " in storage order", "ORDER BY $3 ordena por una constante · " + rowsEs + " en el orden guardado");
    const how = cfg.name === "param" ? T("sent as values", "enviado como valores") : cfg.name === "escape" ? T("quotes doubled", "comillas duplicadas") : T("pasted in", "pegado");
    return said(who + " (shop " + shop + ") · " + how.en + " · " + rowsEn + " by " + r.req.sort, who + " (tienda " + shop + ") · " + how.es + " · " + rowsEs + " por " + r.req.sort);
  }

  // ---------- the turn: walk up, write, run ----------
  function startTurn() {
    turnAt = clock;
    turnLen = forced.length ? HELD : CYCLE;
    prev = cur; cur = null;
    // everyone steps forward; the one at the window leaves; a newcomer joins at the back
    for (const p of people) {
      if (p.role === "window") { p.from = G.WINDOW; p.to = G.EXIT; p.role = "leave"; }
      else if (p.role === "wait") { const i = G.QUEUE.findIndex((s) => s === p.to); p.from = p.to; p.to = i === 0 ? G.WINDOW : G.QUEUE[i - 1]; if (i === 0) p.role = "window"; }
    }
    people.push({ g: figure(), from: G.QUEUE[G.QUEUE.length - 1], to: G.QUEUE[G.QUEUE.length - 1], role: "wait", born: clock });
  }
  function serveNow() {
    clearResult(false);
    cur = desk.next(forced.shift());
    writeStatement(cur);
    const how = cfg.name === "param" ? T("sent as values", "enviado como valores") : cfg.name === "escape" ? T("quotes doubled", "comillas duplicadas") : T("pasted in", "pegado");
    said(cur.req.name + " (shop " + cur.req.shop + ") · " + how.en + " · running…", cur.req.name + " (tienda " + cur.req.shop + ") · " + how.es + " · ejecutando…");
    setShutters(cur);
  }
  function runNow() {
    showResult(cur);
    paintCounters();
    narrate(cur);
  }
  function paintPeople() {
    const u = easeInOutQuad(clamp((clock - turnAt) / WALK));
    const live = [];
    for (let i = people.length - 1; i >= 0; i--) {
      const p = people[i];
      const x = lerp(p.from[0], p.to[0], u), y = lerp(p.from[1], p.to[1], u);
      p.pos = [x, y, 0];
      p.g.setAttribute("transform", translateAlong(P, p.pos));
      if (p.role === "leave") { p.g.style.opacity = String(1 - u); if (u >= 1) { drop(p.g); people.splice(i, 1); continue; } }
      else if (p.born !== undefined) p.g.style.opacity = String(clamp((clock - p.born) / WALK));
      live.push(p);
    }
    const sorted = live.sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P));
    const kids = [...layer.children];
    if (sorted.some((p, i) => p.g !== kids[i])) sorted.forEach((p) => layer.appendChild(p.g));
  }

  function step(dt) {
    clock += dt * cfg.speed;
    if (clock - turnAt >= turnLen) startTurn();
    const t = clock - turnAt;
    if (!cur && t >= WALK) serveNow();
    if (cur && shown !== cur && t >= RUN) runNow();
    paintPeople();
    paintResult();
  }

  const pause = playPause(root);
  const loop = WB.loop({ stage, step, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = String(raw);
    if (!quiet) { restart(); said("settings applied · run restarted", "ajustes aplicados · ejecución reiniciada"); }
  }
  root.on("change", (name, value) => set(name, value));
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const actions = {
    apos: () => { forced.push({ shop: "B", name: "O'Neil", sort: "day" }); said("O'Neil joins the line", "O'Neil se suma a la fila"); wake(); },
    attack: () => { forced.push({ shop: "A", name: CLASSIC, sort: "total", attack: true }); said("' OR '1'='1 joins the line", "' OR '1'='1 se suma a la fila"); wake(); },
    reset: () => { forced = []; restart(); said("started over", "empezó de nuevo"); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const key of ["name", "sort", "account", "attack", "tamper"]) set(key, w[key], true);
    forced = [];
    restart();
    if (w.force === "apos") forced.push({ shop: "B", name: "O'Neil", sort: "day" });
    if (w.force === "attack") forced.push({ shop: "A", name: CLASSIC, sort: "total", attack: true });
    if (w.force === "sort") forced.push({ shop: "C", name: "Tanaka", sort: "total" }, { shop: "A", name: "Kim", sort: OFF_LIST });
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

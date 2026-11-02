// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The order office in the browser: runs the model, moves the clerk and the relay, the letters on the rail and the
// floor, the trays and the counter wheels, and wires the controls and the experiment cards. mount() gets the
// build-time data from page.ts (geometry, letter drawings, results).
import { iso, translateAlong, depthOf, lineOnTop } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import { digitPath, counterCells, digitsOf } from "../../../workbench/digits.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats, act, pauseControls } from "../../runtime/dom";
import { lerpVec } from "../../lib/tween";
import { one, n0 } from "../../lib/format";
import { makeSim } from "./sim";

export default function mount({ P, G, RAIL_SVG, DROP_SVG, RESULTS, EXPERIMENTS }) {
  const stage = document.querySelector("[data-office]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const say = readout();
  const NS = "http://www.w3.org/2000/svg";

  function counter(name, c) { const cells = counterCells(c); return { c, cells, els: cells.map((_, j) => q('[data-digit="' + name + '-' + j + '"]')), shown: [] }; }
  const dials = { orders: counter("orders", G.COUNTERS.orders), shipped: counter("shipped", G.COUNTERS.shipped), extra: counter("extra", G.COUNTERS.extra) };
  function showDial(dial, v) { digitsOf(v, dial.c.count).forEach((d, j) => { if (dial.shown[j] !== d) { dial.shown[j] = d; dial.els[j].setAttribute("d", digitPath(iso, P, dial.cells[j], d)); } }); }

  function pool(layer, html, n) {
    return Array.from({ length: n }, () => { const g = document.createElementNS(NS, "g"); g.innerHTML = html; g.style.display = "none"; layer.appendChild(g); return { g, solid: g.querySelector(".iso-solid") }; });
  }
  const railPool = pool(q("[data-rail]"), RAIL_SVG, 16);
  const dropPool = pool(q("[data-dropped]"), DROP_SVG, 12);
  const toggles = (attr, n) => Array.from({ length: n }, (_, i) => { const g = q("[data-" + attr + '="' + i + '"]'); return { g, solid: g.querySelector(".iso-solid") }; });
  const cards = toggles("card", G.TRAY_CARDS), slips = toggles("slip", G.INTRAY_SLIPS), binned = toggles("bin", G.BIN_CARDS), seen = toggles("seen", G.SPIKE_DISCS), rejects = toggles("reject", G.REJECT_CARDS);
  const sorted = q("[data-sorted]");
  const actors = Object.fromEntries(["postbox", "clerk", "relay"].map((n) => { const g = q('[data-actor="' + n + '"]'); return [n, { g, up: g.querySelector('[data-pose="up"]'), down: g.querySelector('[data-pose="down"]'), carry: g.querySelector("[data-carry]") }]; }));
  const postSolid = q("[data-postbox] .iso-solid");
  const commitSolid = q("[data-commit] .iso-solid");
  const shipSolid = q("[data-ship] .iso-solid");
  const needle = q("[data-needle]");
  const timerEl = q("[data-timer]");
  const drawerOpen = q('[data-drawer="open"]'), drawerClosed = q('[data-drawer="closed"]');
  const dedupeEl = q("[data-dedupe]");
  const extraLabels = { twice: q('[data-extra-label="twice"]'), caught: q('[data-extra-label="caught"]') };

  // The rail as a polyline with cumulative lengths.
  const railLen = [0]; for (let i = 1; i < G.RAIL.length; i++) railLen.push(railLen[i - 1] + Math.hypot(G.RAIL[i][0] - G.RAIL[i - 1][0], G.RAIL[i][1] - G.RAIL[i - 1][1]));
  function alongRail(f) {
    const d = f * railLen[railLen.length - 1];
    for (let i = 1; i < G.RAIL.length; i++) if (d <= railLen[i]) { const u = (d - railLen[i - 1]) / (railLen[i] - railLen[i - 1]); return [G.RAIL[i - 1][0] + u * (G.RAIL[i][0] - G.RAIL[i - 1][0]), G.RAIL[i - 1][1] + u * (G.RAIL[i][1] - G.RAIL[i - 1][1])]; }
    return G.RAIL[G.RAIL.length - 1];
  }

  const homeOf = { clerk: "home", relay: "rhome" };

  // Where an actor stands at the clock, and whether it is down.
  function placeOf(name, seg, clock) {
    const S = G.SPOTS, u = seg.t1 > seg.t0 ? Math.max(0, Math.min(1, (clock - seg.t0) / (seg.t1 - seg.t0))) : 1;
    if (seg.kind === "walk") { const reach = seg.cut != null ? seg.cut : 1; return { at: lerpVec(S[seg.from], S[seg.to], u * reach), down: false }; }
    if (seg.kind === "down") { const at = seg.cut != null ? lerpVec(S[seg.from], S[seg.to], seg.cut) : S[seg.from]; return { at, down: true }; }
    if (seg.kind === "post") return { at: S[name === "clerk" ? "post" : "rpost"], down: false };
    return { at: S[homeOf[name]], down: false };
  }

  const cfg = { mode: "dual", crash: 0.15, relay: 0.1, dedupe: "off", poll: 2, speed: 1 };
  let model, clock, order = "";
  const WARM = 58.75;           // the first run opens mid-shift, so the first frame already shows letters and losses
  let first = true, seed = (Date.now() % 1e6) + 1;

  function restart() {
    model = makeSim({ mode: cfg.mode, crash: cfg.crash, relayCrash: cfg.relay, dedupe: cfg.dedupe === "on", poll: cfg.poll }, first ? 1 : seed++);
    clock = first ? WARM : 0; first = false;
    model.runTo(clock);
    const outbox = cfg.mode === "outbox";
    actors.relay.g.style.display = outbox ? "" : "none";
    timerEl.style.display = outbox ? "" : "none";
    drawerOpen.style.display = outbox ? "" : "none"; drawerClosed.style.display = outbox ? "none" : "";
    dedupeEl.style.display = cfg.dedupe === "on" ? "" : "none";
    extraLabels.twice.style.display = cfg.dedupe === "on" ? "none" : ""; extraLabels.caught.style.display = cfg.dedupe === "on" ? "" : "none";
    paint();
  }

  function stack(list, n, litNewest) { list.forEach((t, i) => { t.g.style.display = i < n ? "" : "none"; if (t.solid) t.solid.toggleAttribute("data-lit", litNewest && i === n - 1); }); }

  function paint() {
    const f = model.flashes, st = model.stats;
    // People and the postbox, drawn back to front.
    const spots = { postbox: G.POSTBOX };
    for (const name of ["clerk", "relay"]) {
      const a = actors[name], seg = (name === "clerk" ? model.clerk : model.relay).seg, p = placeOf(name, seg, clock);
      spots[name] = p.at;
      a.g.setAttribute("transform", translateAlong(P, [p.at[0], p.at[1], 0]));
      a.up.style.display = p.down ? "none" : ""; a.down.style.display = p.down ? "" : "none";
      const carrying = name === "clerk" ? model.clerk.carrying && !p.down : (seg.kind === "walk" && seg.to === "rpost") || seg.kind === "post";
      a.carry.style.display = carrying ? "" : "none";
    }
    const want = ["postbox", "clerk", "relay"].sort((m, n) => depthOf([...spots[m], 0], P) - depthOf([...spots[n], 0], P)).join();
    if (want !== order) { order = want; want.split(",").forEach((n) => sorted.appendChild(actors[n].g)); }

    // Letters on the rail and on the floor.
    const onRail = model.rail.filter((l) => l.t0 <= clock && l.t1 > clock);
    railPool.forEach((p, i) => {
      const l = onRail[i];
      if (!l) { p.g.style.display = "none"; return; }
      const [x, y] = alongRail((clock - l.t0) / (l.t1 - l.t0));
      p.g.style.display = ""; p.g.setAttribute("transform", translateAlong(P, [x, y, 0]));
    });
    const drops = model.dropped.filter((d) => d.t <= clock).slice(-dropPool.length);
    dropPool.forEach((p, i) => {
      const d = drops[i];
      if (!d) { p.g.style.display = "none"; return; }
      // beside the path, on the side nearer the viewer, so a passing clerk never hides them
      const [x, y] = lerpVec(G.SPOTS.home, G.SPOTS.post, d.x);
      const jx = ((d.id * 37) % 7) - 3, jy = ((d.id * 53) % 5) - 2;
      p.g.style.display = ""; p.g.setAttribute("transform", translateAlong(P, [x - 7 + jx, y + 9 + jy, 0]));
    });

    // Trays, bin, spike.
    stack(slips, Math.min(G.INTRAY_SLIPS, model.inbox.length), false);
    const batch = new Set(model.relay.batch);
    cards.forEach((t, i) => { const id = model.pending[i]; t.g.style.display = id != null ? "" : "none"; t.solid.toggleAttribute("data-lit", id != null && batch.has(id)); });
    stack(binned, Math.min(G.BIN_CARDS, model.binned), clock - f.fail < 0.8);
    stack(seen, Math.min(G.SPIKE_DISCS, model.seen.size), clock - f.spike < 0.6);
    stack(rejects, Math.min(G.REJECT_CARDS, st.caught), clock - f.catch < 0.8);
    postSolid.toggleAttribute("data-lit", clock - f.post < 0.35);
    commitSolid.toggleAttribute("data-lit", clock - f.commit < 0.35);
    shipSolid.toggleAttribute("data-lit", clock - f.spike < 0.35);

    // The relay's timer: the needle sweeps once per interval while the relay waits.
    if (cfg.mode === "outbox") {
      const r = model.relay, idle = r.seg.kind === "idle";
      const u = idle ? Math.max(0, Math.min(1, 1 - (r.nextCheck - clock) / cfg.poll)) : 0;
      const a = u * Math.PI * 2, [tx, ty] = G.TIMER;
      needle.setAttribute("d", lineOnTop([tx, ty], [tx + Math.sin(a) * 5, ty - Math.cos(a) * 5], 18.2, P));
    }

    // Counters.
    showDial(dials.orders, st.orders); showDial(dials.shipped, st.shipped); showDial(dials.extra, cfg.dedupe === "on" ? st.caught : st.dupShipped);

    // Readout and stats.
    say(story());
    stat("orders", st.orders); stat("shipped", st.shipped); stat("lost", st.lost); stat("phantom", st.phantom);
    stat("dups", cfg.dedupe === "on" ? st.caught + L(" caught", " copias detectadas") : st.dupShipped);
    const ds = model.delays.slice(-40).sort((x, y) => x - y);
    stat("delay", ds.length ? ds[Math.floor(ds.length / 2)].toFixed(1) + " s" : "–");
  }
  function story() {
    const c = model.clerk.seg, r = model.relay.seg, n = model.inbox.length, p = model.pending.length;
    if (c.kind === "down" && cfg.mode === "dual") return L("clerk failed on the way · order #" + c.id + " is in the ledger, its letter is on the floor", "el empleado falló en el camino · el pedido #" + c.id + " está en el libro, su carta está en el piso");
    if (c.kind === "down" && cfg.mode === "pubfirst") return L("ledger write failed · the letter for #" + c.id + " was already sent", "falló la escritura en el libro · la carta del #" + c.id + " ya se había enviado");
    if (c.kind === "down") return L("clerk failed mid-transaction · neither card nor letter was kept", "el empleado falló a mitad de la transacción · no quedó ni la tarjeta ni la carta");
    if (r.kind === "down") return L("relay failed after posting · those letters are still pending and will go again", "el relé falló después de despachar · esas cartas siguen pendientes y van a salir de nuevo");
    if (cfg.mode === "outbox" && r.kind === "walk" && r.to === "rpost") return L("relay carrying " + r.n + " letter" + (r.n === 1 ? "" : "s") + " · " + p + " pending", "el relé lleva " + r.n + " carta" + (r.n === 1 ? "" : "s") + " · " + p + " pendiente" + (p === 1 ? "" : "s"));
    if (cfg.mode === "outbox" && r.kind === "mark") return L("relay marking letters sent", "el relé marca las cartas como enviadas");
    if (c.kind === "walk" && c.to === "post") return L("clerk walking the letter for #" + c.id + " to the postbox", "el empleado lleva la carta del #" + c.id + " al buzón");
    if (c.kind === "post") return L("clerk posting the letter for #" + c.id, "el empleado despacha la carta del #" + c.id);
    if (c.kind === "walk") return L("clerk walking back" + (n ? " · " + n + " waiting" : ""), "el empleado vuelve" + (n ? " · " + n + " en espera" : ""));
    if (c.kind === "write") return L("clerk writing order #" + c.id + (cfg.mode === "outbox" ? " and its letter, in one transaction" : " in the ledger"), "el empleado escribe el pedido #" + c.id + (cfg.mode === "outbox" ? " y su carta, en una sola transacción" : " en el libro"));
    if (cfg.mode === "outbox") return L(p + " letter" + (p === 1 ? "" : "s") + " pending in the outbox", p + " carta" + (p === 1 ? "" : "s") + " pendiente" + (p === 1 ? "" : "s") + " en el outbox");
    return n ? L(n + " order" + (n === 1 ? "" : "s") + " waiting", n + " pedido" + (n === 1 ? "" : "s") + " en espera") : L("waiting for an order", "esperando un pedido");
  }
  const stat = stats();

  const pause = pauseControls(stage, say);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    if (name === "speed") { cfg.speed = Number(raw); WB.pressSeg(name, raw); return; }
    if (name === "mode" || name === "dedupe") cfg[name] = raw; else cfg[name] = Number(raw);
    WB.pressSeg(name, raw);
    if (!quiet) restart();
  }
  WB.onSegments((name, value) => set(name, value));
  act("crash").addEventListener("click", () => { model.crashNext(); if (loop.paused) loop.setPaused(false); });
  act("reset").addEventListener("click", () => restart());

  // ---------- experiments (numbers computed at build time from the same model, 8 seeds each) ----------
  const RUNS = {
    lost: () => {
      const r = RESULTS.lost;
      return { verdict: T("The ledger took " + n0(r.orders) + " orders; the warehouse shipped " + n0(r.shipped) + ". " + one(r.lost) + " orders were committed and never shipped, and nothing reported an error.",
          "El libro recibió " + n0(r.orders) + " pedidos; el almacén envió " + n0(r.shipped) + ". " + one(r.lost) + " pedidos se confirmaron y nunca se enviaron, y nada reportó un error."),
        bars: [[T("In the ledger", "En el libro"), 1, n0(r.orders)], [T("Shipped", "Enviados"), r.shipped / r.orders, n0(r.shipped)], [T("Lost", "Perdidos"), r.lost / r.orders, one(r.lost), true]] };
    },
    phantom: () => {
      const r = RESULTS.phantom, top = Math.max(r.orders, r.shipped);
      return { verdict: T("Nothing lost, but the warehouse shipped " + n0(r.shipped) + " orders against " + n0(r.orders) + " in the ledger: " + one(r.phantom) + " phantom orders whose ledger write failed after the letter had gone.",
          "No se perdió nada, pero el almacén envió " + n0(r.shipped) + " pedidos frente a " + n0(r.orders) + " en el libro: " + one(r.phantom) + " pedidos fantasma cuya escritura en el libro falló después de que la carta ya había salido."),
        bars: [[T("In the ledger", "En el libro"), r.orders / top, n0(r.orders)], [T("Shipped", "Enviados"), r.shipped / top, n0(r.shipped)], [T("Phantom", "Fantasma"), r.phantom / top, one(r.phantom), true]] };
    },
    outbox: () => {
      const r = RESULTS.outbox;
      return { verdict: T("Lost " + one(r.lost) + ", phantom " + one(r.phantom) + ". " + one(r.failed) + " orders failed as a whole (the customer got an error, nothing was kept). The relay failed " + one(r.relayCrashes) + " times and posted " + one(r.caught) + " letters a second time.",
          "Perdidos " + one(r.lost) + ", fantasma " + one(r.phantom) + ". " + one(r.failed) + " pedidos fallaron por completo (el cliente recibió un error, no quedó nada). El relé falló " + one(r.relayCrashes) + " veces y despachó " + one(r.caught) + " cartas por segunda vez."),
        bars: [[T("Lost or phantom", "Perdidos o fantasma"), (r.lost + r.phantom) / Math.max(1, r.caught), one(r.lost + r.phantom)], [T("Letters that arrived twice", "Cartas que llegaron dos veces"), 1, one(r.caught), true]] };
    },
    dedupe: () => {
      const { off, on } = RESULTS.dedupe;
      const top = Math.max(off.dupShipped, on.caught, 1);
      return { verdict: T("Dedupe off: " + one(off.dupShipped) + " of " + n0(off.orders) + " orders shipped twice. Dedupe on: " + one(on.caught) + " repeats caught on the spike, " + one(on.dupShipped) + " shipped twice.",
          "Deduplicación apagada: " + one(off.dupShipped) + " de " + n0(off.orders) + " pedidos enviados dos veces. Deduplicación encendida: " + one(on.caught) + " repeticiones detectadas en el pincho, " + one(on.dupShipped) + " enviados dos veces."),
        bars: [[T("Shipped twice, dedupe off", "Enviados dos veces, dedup. apagada"), off.dupShipped / top, one(off.dupShipped), true], [T("Shipped twice, dedupe on", "Enviados dos veces, dedup. encendida"), on.dupShipped / top, one(on.dupShipped)], [T("Repeats caught, dedupe on", "Repeticiones detectadas, dedup. encendida"), on.caught / top, one(on.caught)]] };
    },
    poll: () => {
      const { rows, dual } = RESULTS.poll;
      const top = Math.max(...rows.map(([, r]) => r.p95));
      const lost = one(rows.reduce((s, [, r]) => s + r.lost, 0));
      return { verdict: T("Typical delay from commit to warehouse: " + rows.map(([p, r]) => one(r.median) + " s at " + p + " s").join(", ") + " (slowest 5%: " + rows.map(([, r]) => one(r.p95) + " s").join(", ") + "). Walking it over directly: " + one(dual.median) + " s. Lost: " + lost + ".",
          "Demora típica desde el commit hasta el almacén: " + rows.map(([p, r]) => one(r.median) + " s con " + p + " s").join(", ") + " (el 5% más lento: " + rows.map(([, r]) => one(r.p95) + " s").join(", ") + "). Llevándola directamente: " + one(dual.median) + " s. Perdidos: " + lost + "."),
        bars: [[T("Walk it over (no outbox)", "Llevarla directo (sin outbox)"), dual.median / top, one(dual.median) + " s"], ...rows.map(([p, r]) => [T("Relay every " + p + " s, typical", "Relé cada " + p + " s, típica"), r.median / top, one(r.median) + " s", p === 5]), [T("Relay every 5 s, slowest 5%", "Relé cada 5 s, el 5% más lento"), rows[2][1].p95 / top, one(rows[2][1].p95) + " s", true]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    for (const [key, v] of Object.entries(w)) set(key, String(v), true);
    restart();
    if (loop.paused) loop.setPaused(false);
  } });

  loop.setPaused(loop.paused);
  restart();
}

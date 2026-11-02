// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The payment counter in the browser: runs the model, draws slips, replies, the key rack and the till, wires the
// controls and the experiment cards. mount() gets the build-time data from page.ts (geometry, tokens, results).
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { readout, stats, show, setText, act, pauseControls } from "../../runtime/dom";
import { n0, pct } from "../../lib/format";
import { makeSim, SLOTS } from "./sim";

export default function mount({ P, G, TOKENS, RESULTS, EXPERIMENTS }) {
  const POOL = 60, PILE = 3;
  const WARM = 30;   // each run starts half a minute in, so the first frame already shows keys, retries and lost replies

  const stage = document.querySelector("[data-counter]");
  const svg = stage.querySelector("svg");
  const q = (s, root = svg) => root.querySelector(s);
  const say = readout();
  const NS = "http://www.w3.org/2000/svg";
  const label = (key) => "ABCD"[Number(key.slice(1, key.indexOf("-")))] + key.slice(key.indexOf("-") + 1);

  function poolOf(layer, n) {
    return Array.from({ length: n }, () => { const g = document.createElementNS(NS, "g"); g.style.display = "none"; layer.appendChild(g); return { g, kind: null }; });
  }
  const tokens = poolOf(q("[data-tokens]"), POOL);
  const work = poolOf(q("[data-work]"), 12);
  function place(list, used, kind, point) {
    if (used >= list.length) return used;
    const t = list[used];
    if (t.kind !== kind) { t.g.innerHTML = TOKENS[kind]; t.kind = kind; }
    t.g.style.display = "";
    t.g.setAttribute("transform", translateAlong(P, point));
    return used + 1;
  }
  const hide = (list, from) => { for (let i = from; i < list.length; i++) list[i].g.style.display = "none"; };

  const holes = Array.from({ length: SLOTS }, (_, i) => { const g = q('[data-hole="' + i + '"]'); return { g, card: q("[data-card]", g), lit: q("[data-card-lit]", g), flag: q("[data-flag]", g), key: q("[data-hole-key]", g), shown: "" }; });
  const customers = [0, 1, 2, 3].map((i) => { const g = q('[data-customer="' + i + '"]'); return { slip: q("[data-slip]", g), plain: q("[data-slip-plain]", g), lit: q("[data-slip-lit]", g), top: q("[data-slip-top]", g), note: q("[data-slip-note]", g) }; });
  const screens = [0, 1, 2, 3].map((i) => ({ off: q('[data-screen="' + i + '"]'), on: q('[data-screen-lit="' + i + '"]') }));
  const digits = (name, n) => Array.from({ length: n }, (_, j) => q('[data-digit="' + name + j + '"]'));
  const dials = { orders: digits("orders", 4), charges: digits("charges", 4), replays: digits("replays", 4) };
  function showDial(name, value, lit) {
    const s = String(Math.max(0, Math.floor(value)) % 10000).padStart(4, "0");
    dials[name].forEach((el, j) => { if (el.textContent !== s[j]) el.textContent = s[j]; const tone = lit ? "lit" : "hi"; if (el.getAttribute("data-tone") !== tone) el.setAttribute("data-tone", tone); });
  }

  const cfg = { keys: "lock", loss: 0.3, timeout: "patient", lifetime: "long", drift: 0, speed: 1 };
  let model, clock, logAt, holeHit, lastExtra, lastEvent, outcomes, piles;
  let seed = (Date.now() % 1e6) + 1;

  function restart() {
    model = makeSim({ keys: cfg.keys, loss: cfg.loss, timeout: cfg.timeout, lifetime: cfg.lifetime, drift: cfg.drift }, seed++);
    clock = WARM; logAt = 0; holeHit = {}; lastExtra = -9; lastEvent = null; outcomes = [null, null, null, null]; piles = [[], [], [], []];
    model.runTo(clock);
    paint();
  }

  const SPAN = G.LANE_NEAR - G.LANE_FAR;
  const FALL_AT = (G.TROUGH_Y - G.LANE_FAR) / SPAN;    // share of a reply's trip at which a lost one drops

  function pilePoint(lane, n) {
    const x = G.XS[lane] + G.LANE + 1.2 + (n % 2) * 3.2 - 2.2, y = G.TROUGH.y0 + 2.6 + Math.floor(n / 2) * 2.6 + (n % 2) * 1.2;
    return [x, y, G.TROUGH_H - 0.6];
  }

  function paint() {
    // Events since the last frame: rack hits, double charges, finished orders, the readout.
    for (; logAt < model.log.length; logAt++) {
      const e = model.log[logAt];
      if (e.type === "replay" || e.type === "422") holeHit[e.slot] = e.t;
      if (e.type === "charge" && e.n > 1) lastExtra = e.t;
      if (e.type !== "send" || e.try > 1) lastEvent = e;
    }
    model.purchases.forEach((p) => { if (p.done && p.end > clock - 1.6 && p.end <= clock) outcomes[p.client] = p; });

    // Slips and replies on the lanes; lost replies fall into the trough and stay.
    let used = 0;
    for (const tr of model.trips) {
      if (tr.sent > clock) break;
      const x = G.XS[tr.client];
      const p = (clock - tr.sent) / (tr.arrive - tr.sent);
      if (tr.kind === "req") {
        if (p >= 1) continue;
        used = place(tokens, used, "req", [x - G.LANE, G.LANE_NEAR - p * SPAN, 0]);
      } else {
        const kind = tr.status === "ok" ? "ok" : tr.status;
        if (tr.lost && p >= FALL_AT) {
          if (!tr.piled) { tr.piled = true; piles[tr.client].push(tr); }
          const drop = Math.min(1, (p - FALL_AT) / 0.25);
          if (drop < 1) used = place(tokens, used, kind, [x + G.LANE, G.TROUGH_Y, G.TROUGH_H + 2 - 2.6 * drop]);
          continue;
        }
        if (p >= 1) continue;
        used = place(tokens, used, kind, [x + G.LANE, G.LANE_FAR + p * SPAN, 0]);
      }
    }
    piles.forEach((pile, lane) => {
      const settled = pile.filter((tr) => (clock - tr.sent) / (tr.arrive - tr.sent) >= FALL_AT + 0.25);
      settled.slice(-PILE * 2).forEach((tr, n) => { used = place(tokens, used, tr.status === "ok" ? "ok" : tr.status, pilePoint(lane, n)); });
    });
    hide(tokens, used);

    // Slips being charged, on each terminal's tray; a second charge for the same order is lit.
    let w = 0;
    const busy = [false, false, false, false];
    const counts = {};
    for (const job of model.working) {
      if (job.start > clock) continue;
      busy[job.client] = true;
      const stackN = counts[job.client] = (counts[job.client] || 0) + 1;
      const p = model.purchases.find((pp) => pp.key === job.key);
      const dup = (p && p.charges > 0) || model.working.some((o) => o !== job && o.key === job.key && o.start < job.start);
      w = place(work, w, dup ? "workLit" : "work", [G.TRAY[job.client][0], G.TRAY[job.client][1], G.TRAY_Z + (stackN - 1) * 1.3]);
    }
    hide(work, w);
    screens.forEach((s, i) => { show(s.off, !busy[i]); show(s.on, busy[i]); });

    // The key rack.
    const rack = model.rack(clock);
    holes.forEach((h, i) => {
      const e = rack[i];
      const live = e && e.state !== "expired";
      show(h.g, !!live);
      if (!live) return;
      const hit = holeHit[i] != null && clock - holeHit[i] < 0.9;
      show(h.card, e.state === "done" && !hit);
      show(h.lit, e.state === "done" && hit);
      show(h.flag, e.state === "progress");
      setText(h.key, label(e.key));
    });

    // Customers' slips: the order's key and try, then the outcome for a moment.
    model.customers.forEach((cu, i) => {
      const c = customers[i], o = outcomes[i];
      const showOutcome = o && clock - o.end < 1.6;
      const p = showOutcome ? o : cu.current;
      show(c.slip, !!p);
      if (!p) return;
      const retrying = !showOutcome && p.tries > 1;
      show(c.plain, !retrying); show(c.lit, retrying);
      if (showOutcome) {
        setText(c.top, o.outcome === "paid" ? L("PAID", "PAGADO") : o.outcome === "rejected" ? "422" : L("GAVE UP", "SE FUE"));
        setText(c.note, label(o.key) + (o.charges > 1 ? L(" · charged " + o.charges + "×", " · " + o.charges + " cobros") : " · $" + o.amount));
      } else {
        setText(c.top, label(p.key));
        setText(c.note, L("try ", "vez ") + p.tries + " · $" + p.amount);
      }
    });

    // The till.
    const S = model.stats;
    const twice = model.purchases.filter((p) => p.charges > 1).length;
    showDial("orders", model.charged(), false);
    showDial("charges", S.charges, clock - lastExtra < 1.2);
    showDial("replays", S.replays, false);

    // Readout and stats.
    const e = lastEvent && clock - lastEvent.t < 2.5 ? lastEvent : null;
    const k = e && e.key ? label(e.key) : "";
    const idle = L(model.charged() + " orders paid · " + S.charges + " card charges", model.charged() + " pedidos pagados · " + S.charges + " cobros a tarjeta");
    say(!e ? idle
      : e.type === "send" ? k + L(" · no reply yet, paying again (try " + e.try + ")", " · sin respuesta todavía, paga de nuevo (intento " + e.try + ")")
      : e.type === "lost" ? k + L(" · reply lost on the way back", " · respuesta perdida al volver")
      : e.type === "replay" ? k + L(" · answered from the rack, not charged again", " · respondido desde el casillero, sin volver a cobrar")
      : e.type === "409" ? k + L(" · still in progress (409), try again shortly", " · todavía en curso (409), reintenta en un momento")
      : e.type === "422" ? k + L(" · same key, different amount: rejected (422)", " · misma clave, otro monto: rechazado (422)")
      : e.type === "expired" ? k + L(" · key expired, so this is a new payment", " · la clave venció, así que es un pago nuevo")
      : e.type === "charge" && e.n > 1 ? k + L(" · charged again (" + e.n + "×)", " · cobrado de nuevo (" + e.n + "×)")
      : idle);
    stat("orders", model.charged());
    stat("charges", S.charges);
    stat("twice", twice);
    stat("replays", S.replays);
    stat("c409", S.conflicts);
    stat("r422", S.rejected);
    stat("lost", S.lost);
  }
  const stat = stats();

  const pause = pauseControls(stage, say);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    WB.pressSeg(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = name === "loss" || name === "drift" ? Number(raw) : raw;
    if (!quiet) restart();
  }
  WB.onSegments((name, value) => set(name, value));
  act("double").addEventListener("click", () => { model.doubleClick(0, clock); if (loop.paused) loop.setPaused(false); });
  act("reset").addEventListener("click", () => restart());

  // ---------- experiments (numbers computed at build time from the same model, 8 seeds each) ----------
  const RUNS = {
    lost: () => {
      const r = RESULTS.lost;
      return { verdict: T("Of " + n0(r.purchases) + " orders, " + n0(r.doubled) + " were charged twice (" + pct(r.doubled / r.purchases) + "), against " + n0(r.lost) + " lost replies. Every charge was a real request; the duplicates came from correct retries.",
          "De " + n0(r.purchases) + " pedidos, a " + n0(r.doubled) + " se les cobró dos veces (" + pct(r.doubled / r.purchases) + "), frente a " + n0(r.lost) + " respuestas perdidas. Cada cobro fue una solicitud real; los duplicados vinieron de reintentos correctos."),
        bars: [[T("Orders", "Pedidos"), 1, n0(r.purchases)], [T("Replies lost", "Respuestas perdidas"), r.lost / r.purchases, n0(r.lost)], [T("Charged twice", "Cobrados dos veces"), r.doubled / r.purchases, n0(r.doubled), true]] };
    },
    keys: () => {
      const { off, on } = RESULTS.keys, top = Math.max(off.doubled, on.replays, 1);
      return { verdict: T("With keys, " + n0(on.doubled) + " orders were charged twice (" + n0(off.doubled) + " without). " + n0(on.replays) + " retries were answered from the rack with the original receipt.",
          "Con claves, a " + n0(on.doubled) + " pedidos se les cobró dos veces (" + n0(off.doubled) + " sin claves). " + n0(on.replays) + " reintentos se respondieron desde el casillero con el recibo original."),
        bars: [[T("Charged twice, no keys", "Cobrados dos veces, sin claves"), off.doubled / top, n0(off.doubled)], [T("Charged twice, with keys", "Cobrados dos veces, con claves"), on.doubled / top, n0(on.doubled), true], [T("Answered from the rack", "Respondidos del casillero"), on.replays / top, n0(on.replays), true]] };
    },
    race: () => {
      const { late, claim } = RESULTS.race;
      return { verdict: T("Filing the key after charging: " + n0(late.doubled) + " of " + n0(late.purchases) + " orders charged twice (" + pct(late.doubled / late.purchases) + "), with no reply ever lost. Claiming the key first: " + n0(claim.doubled) + " charged twice, and " + n0(claim.conflicts) + " early retries told \"still in progress\" (409).",
          "Guardando la clave después de cobrar: " + n0(late.doubled) + " de " + n0(late.purchases) + " pedidos cobrados dos veces (" + pct(late.doubled / late.purchases) + "), sin que se perdiera ninguna respuesta. Reservando la clave primero: " + n0(claim.doubled) + " cobrados dos veces, y a " + n0(claim.conflicts) + " reintentos tempranos se les respondió \"todavía en curso\" (409)."),
        bars: [[T("Charged twice, filed after", "Cobrados dos veces, guardada después"), late.doubled / late.purchases, pct(late.doubled / late.purchases), true], [T("Charged twice, claimed first", "Cobrados dos veces, reservada primero"), claim.doubled / claim.purchases, pct(claim.doubled / claim.purchases), true]] };
    },
    ttl: () => {
      const { long, short } = RESULTS.ttl, top = Math.max(short.doubled, short.expiredHits, 1);
      return { verdict: T("Keys kept 1 day: " + n0(long.doubled) + " orders charged twice. Kept 8 s: " + n0(short.doubled) + " of " + n0(short.purchases) + " charged twice; " + n0(short.expiredHits) + " retries arrived after their key was gone.",
          "Claves guardadas 1 día: " + n0(long.doubled) + " pedidos cobrados dos veces. Guardadas 8 s: " + n0(short.doubled) + " de " + n0(short.purchases) + " cobrados dos veces; " + n0(short.expiredHits) + " reintentos llegaron cuando su clave ya no estaba."),
        bars: [[T("Charged twice, 1 day", "Cobrados dos veces, 1 día"), long.doubled / top, n0(long.doubled)], [T("Charged twice, 8 s", "Cobrados dos veces, 8 s"), short.doubled / top, n0(short.doubled), true], [T("Retries after expiry", "Reintentos tras vencer"), short.expiredHits / top, n0(short.expiredHits)]] };
    },
    drift: () => {
      const { on, off } = RESULTS.drift, top = Math.max(on.rejected, off.wrongAmount, 1);
      return { verdict: T("With keys: " + n0(on.rejected) + " retries with a changed amount were rejected (422) and " + n0(on.extra) + " extra charges were made. Without keys, " + n0(off.wrongAmount) + " orders were charged a second time at a different amount.",
          "Con claves: " + n0(on.rejected) + " reintentos con un monto cambiado se rechazaron (422) y se hicieron " + n0(on.extra) + " cobros extra. Sin claves, a " + n0(off.wrongAmount) + " pedidos se les cobró una segunda vez con otro monto."),
        bars: [[T("Rejected (422), with keys", "Rechazados (422), con claves"), on.rejected / top, n0(on.rejected), true], [T("Wrong second charges, with keys", "Segundos cobros erróneos, con claves"), on.wrongAmount / top, n0(on.wrongAmount)], [T("Wrong second charges, no keys", "Segundos cobros erróneos, sin claves"), off.wrongAmount / top, n0(off.wrongAmount)]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    for (const [name, value] of Object.entries(exp.watch)) set(name, String(value), true);
    restart();
    if (loop.paused) loop.setPaused(false);
  } });

  loop.setPaused(loop.paused);
  restart();
}

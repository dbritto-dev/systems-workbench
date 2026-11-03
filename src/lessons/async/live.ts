// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The restaurant pass in the browser: runs the model, moves the waiters, fills the rail, the burners and the trays,
// wires the controls and the experiment cards. mount() gets the build-time data from page.ts (geometry, results).
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L as tr, T } from "../../runtime/wb";
import { readout, stats, pauseControls, act } from "../../runtime/dom";
import { createSim } from "./sim";

export default function mount({ P, G, RESULTS, EXPERIMENTS }) {
  const SLOW = 10;
  const AZ = (52 * Math.PI) / 180;   // the figure's azimuth: waiters are re-stacked back to front along it
  const stage = document.querySelector("[data-pass]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const say = readout();
  const stat = stats();
  const pots = qa("[data-pot]").sort((a, b) => a.dataset.pot - b.dataset.pot);
  const queued = qa("[data-q]").sort((a, b) => a.dataset.q - b.dataset.q);
  const rail = qa("[data-rail]").sort((a, b) => a.dataset.rail - b.dataset.rail);
  const pending = qa("[data-p]").sort((a, b) => a.dataset.p - b.dataset.p);
  const plates = qa("[data-d]").sort((a, b) => a.dataset.d - b.dataset.d);
  const binned = qa("[data-f]").sort((a, b) => a.dataset.f - b.dataset.f);
  const waiterBox = q("[data-waiters]");
  const VARIANTS = ["idle", "wait", "carry", "frozen"];
  const waiters = qa("[data-waiter]").sort((a, b) => a.dataset.waiter - b.dataset.waiter).map((el) => ({ el, v: Object.fromEntries(VARIANTS.map((n) => [n, el.querySelector('[data-v="' + n + '"]')])), x: 0, y: 0, placed: false, look: "idle" }));
  const tags = qa("[data-tag]").sort((a, b) => a.dataset.tag - b.dataset.tag);
  const cover = q("[data-cover]");
  const blankRows = [q('[data-blank-row="1"]'), q('[data-blank-row="2"]')];
  const bellSolids = qa("[data-bell] .iso-solid");

  const cfg = { mode: "async", threads: 4, n: 20, cpu: 2, io: 200, gather: "gather", limit: 0, block: 0, speed: 1 };
  let run, simT = 0, hold = 0, seed = 1;
  // Until someone touches a control, the machine tours: each new batch moves to the next of
  // async, blocking threads, and async with at most 5 in flight.
  let touring = true, tourAt = 0;
  const TOUR = [{ mode: "async", limit: 0 }, { mode: "blocking", limit: 0 }, { mode: "async", limit: 5 }];
  const PREROLL = 90; // ms of simulated time already run when a batch first appears, so a still frame shows a working pass
  // Show the first `count` elements of a list, hide the rest.
  const showFirst = (list, count) => list.forEach((el, i) => el.toggleAttribute("data-off", i >= count));
  const fmt = (ms) => ms >= 1000 ? (ms / 1000).toFixed(2) + " s" : Math.round(ms) + " ms";

  function restart() {
    run = createSim({ mode: cfg.mode, threads: cfg.threads, n: cfg.n, cpu: cfg.cpu, io: cfg.io, gather: cfg.gather, limit: cfg.limit, block: cfg.block, seed: seed++ });
    simT = PREROLL; hold = 0;
    run.advance(simT);
    waiters.forEach((w) => (w.placed = false));
    paint(0);
  }

  // Where waiter i stands and how it looks: idle, wait (lit, holding an empty tray at the window),
  // carry (a plate on the tray, heading for the bell), frozen (lit, stuck in a blocking call).
  function spotFor(i, th) {
    const S = G.SPOTS;
    const lane = (s) => [s[0] + i * s[2], s[1]];
    if (cfg.mode === "async") {
      const c = run.core;
      if (c && c.kind === "deliver") return { at: S.pickup, look: "carry" };
      if (c && c.kind === "error") return { at: S.pickup, look: "idle" };
      if (c && c.kind === "cpu") return { at: S.desk, look: c.split !== undefined && run.now - c.startAt > c.split ? "frozen" : "idle" };
      return { at: S.asyncHome, look: "idle" };
    }
    switch (th.state) {
      case "cpu": return { at: [S.desk[0] + i * 2, S.desk[1] - i * 3], look: "idle" };
      case "queued-cpu": return { at: lane(S.home), look: "idle" };
      case "waiting": return { at: lane(S.window), look: "wait" };
      case "reading": return { at: lane(S.home), look: "frozen" };
      case "deliver": return { at: [S.pickup[0] - i * 3, S.pickup[1] + 4], look: "carry" };
      case "error": return { at: [S.pickup[0] - i * 3, S.pickup[1] + 4], look: "idle" };
      default: return { at: lane(S.home), look: "idle" };
    }
  }

  function paint(dt) {
    const st = run.st;
    pots.forEach((el, i) => el.toggleAttribute("data-off", !run.burners[i]));
    showFirst(queued, Math.min(run.queue.length, G.QUEUE_SHOWN));
    const onRail = cfg.mode === "async" ? run.orders.filter((o) => o.state === "queued" || o.state === "cooking").length : 0;
    showFirst(rail, Math.min(onRail, G.RAIL_SHOWN));
    const waitingToStart = run.orders.filter((o) => o.state === "pending").length;
    showFirst(pending, Math.min(waitingToStart, G.PENDING_SHOWN));
    showFirst(plates, Math.min(st.done, G.DONE_SHOWN));
    showFirst(binned, Math.min(st.failed, G.FAILED_SHOWN));
    const ringing = st.lastBell >= 0 && run.now - st.lastBell < 60;
    bellSolids.forEach((el) => el.toggleAttribute("data-lit", ringing));
    const limit = cfg.mode === "async" ? cfg.limit : 0;
    cover.toggleAttribute("data-off", limit > 0);
    blankRows[0].toggleAttribute("data-off", !(limit > 0 && limit <= 5));
    blankRows[1].toggleAttribute("data-off", !(limit > 0 && limit <= 10));
    showFirst(tags, limit > 0 ? Math.min(run.inFlight, limit) : 0);

    const count = cfg.mode === "async" ? 1 : cfg.threads;
    const k = dt ? 1 - Math.exp(-dt / 0.12) : 1;
    waiters.forEach((w, i) => {
      w.el.toggleAttribute("data-off", i >= count);
      if (i >= count) return;
      const { at, look } = spotFor(i, run.threads[i]);
      if (!w.placed) { w.x = at[0]; w.y = at[1]; w.placed = true; }
      w.x += (at[0] - w.x) * k; w.y += (at[1] - w.y) * k;
      w.el.setAttribute("transform", translateAlong(P, [w.x, w.y, 0]));
      if (look !== w.look) { w.v[w.look].toggleAttribute("data-off", true); w.v[look].toggleAttribute("data-off", false); w.look = look; }
    });
    waiters.slice(0, count).sort((a, b) => (a.x * Math.cos(AZ) + a.y * Math.sin(AZ)) - (b.x * Math.cos(AZ) + b.y * Math.sin(AZ))).forEach((w) => waiterBox.appendChild(w.el));

    const m = run.metrics();
    const elapsed = run.complete() ? m.total : run.now;
    stat("time", elapsed > 0 ? fmt(elapsed) : "–");
    stat("rate", elapsed > 0 ? (st.done / elapsed * 1000).toFixed(1) : "–");
    stat("done", st.done);
    stat("failed", st.failed);
    stat("kitchen", st.maxInFlight);
    stat("bell", st.bellWaits.length ? fmt(m.bellP95) : "–");

    const cooking = run.burners.filter(Boolean).length;
    const es = WB.lang() === "es";
    if (run.complete()) say(es ? "tanda lista en " + fmt(m.total) + " · " + st.done + " entregados" + (st.failed ? " · " + st.failed + " expirados" : "") : "batch done in " + fmt(m.total) + " · " + st.done + " delivered" + (st.failed ? " · " + st.failed + " timed out" : ""));
    else if (cfg.mode === "async") {
      const c = run.core;
      const doing = !c ? tr("waiter free", "mesero libre") : c.kind === "cpu" ? (c.split !== undefined && run.now - c.startAt > c.split ? tr("waiter frozen on a blocking read", "mesero congelado en una lectura bloqueante") : tr("taking an order", "tomando un pedido")) : tr("delivering", "entregando");
      say(es ? onRail + " en el riel · " + cooking + " cocinándose · " + doing : onRail + " on the rail · " + cooking + " cooking · " + doing);
    } else {
      const atWindow = run.threads.filter((t) => t.state === "waiting").length;
      say(es ? atWindow + " de " + cfg.threads + " meseros atascados en la ventanilla · " + cooking + " cocinándose" : atWindow + " of " + cfg.threads + " waiters stuck at the window · " + cooking + " cooking");
    }
  }

  function step(dt) {
    if (run.complete()) {
      hold += dt;
      if (hold > 1.6) {
        if (touring) {
          tourAt = (tourAt + 1) % TOUR.length;
          for (const [name, value] of Object.entries(TOUR[tourAt])) { cfg[name] = value; WB.pressSeg(name, value); }
        }
        restart();
      }
      else paint(dt);
      return;
    }
    simT += (dt * 1000 * cfg.speed) / SLOW;
    run.advance(simT);
    paint(dt);
  }

  const pause = pauseControls(stage, say);
  const clock = WB.loop({ stage, step, onPause: pause.onPause });
  clock.setPaused(clock.paused);
  function set(name, raw) {
    touring = false;
    if (name === "speed") { cfg.speed = Number(raw); WB.pressSeg(name, raw); return; }
    cfg[name] = ["mode", "gather"].includes(name) ? raw : Number(raw);
    WB.pressSeg(name, raw);
    restart();
  }
  WB.onSegments(set);
  act("restart").addEventListener("click", () => { touring = false; restart(); if (clock.paused) clock.setPaused(false); });
  pause.bind(clock);

  // ---------- experiments (results computed at build time from the same model) ----------
  const secs = (ms) => (ms / 1000).toFixed(2) + " s";
  const RUNS = {
    threads: () => { const { a, b } = RESULTS.threads; const top = Math.max(a.throughput, b.throughput) * 1.05;
      const ar = a.throughput.toFixed(0), br = b.throughput.toFixed(0), more = (b.throughput / a.throughput).toFixed(1);
      return { verdict: T("4 blocking threads: " + ar + " orders/s, done in " + secs(a.total) + ". One async waiter: " + br + " orders/s, done in " + secs(b.total) + " (" + more + "× more).",
          "4 hilos bloqueantes: " + ar + " pedidos/s, listos en " + secs(a.total) + ". Un mesero async: " + br + " pedidos/s, listos en " + secs(b.total) + " (" + more + "× más)."),
        bars: [[T("4 blocking threads", "4 hilos bloqueantes"), a.throughput / top, ar + "/s"], [T("1 async waiter", "1 mesero async"), b.throughput / top, br + "/s", true]] }; },
    cpu: () => { const { a, b } = RESULTS.cpu; const top = Math.max(a.total, b.total) * 1.05;
      const busy = Math.round(b.busy * 100);
      return { verdict: T("4 blocking threads: " + secs(a.total) + ". One async waiter: " + secs(b.total) + ". The desk was busy " + busy + "% of the time either way.",
          "4 hilos bloqueantes: " + secs(a.total) + ". Un mesero async: " + secs(b.total) + ". El mostrador estuvo ocupado el " + busy + "% del tiempo en ambos casos."),
        bars: [[T("4 blocking threads", "4 hilos bloqueantes"), a.total / top, secs(a.total)], [T("1 async waiter", "1 mesero async"), b.total / top, secs(b.total), true]] }; },
    loop: () => { const { a, b } = RESULTS.loop; const top = Math.max(a.total, b.total) * 1.05;
      const x = Math.round(a.total / b.total);
      return { verdict: T("Await in a loop: " + secs(a.total) + ". Gather: " + secs(b.total) + " (" + x + "× faster).",
          "Await en un bucle: " + secs(a.total) + ". Reunir: " + secs(b.total) + " (" + x + "× más rápido)."),
        bars: [[T("Await in a loop", "Await en un bucle"), a.total / top, secs(a.total)], [T("Gather", "Reunir"), b.total / top, secs(b.total), true]] }; },
    limit: () => { const { a, b } = RESULTS.limit;
      const ad = Math.round(a.done), bd = Math.round(b.done), am = Math.round(a.maxInFlight);
      return { verdict: T("All at once: " + ad + " delivered, " + (1000 - ad) + " timed out, up to " + am + " orders in the kitchen. At most 20 in flight: " + bd + " delivered, none timed out, in " + secs(b.total) + ".",
          "Todos a la vez: " + ad + " entregados, " + (1000 - ad) + " expirados, hasta " + am + " pedidos en la cocina. Como máximo 20 en curso: " + bd + " entregados, ninguno expirado, en " + secs(b.total) + "."),
        bars: [[T("All at once", "Todos a la vez"), a.done / 1000, T(ad + " ok", ad + " ok")], [T("At most 20", "Máximo 20"), b.done / 1000, T(bd + " ok", bd + " ok"), true]] }; },
    block: () => { const { a, b } = RESULTS.block; const top = Math.max(a.total, b.total) * 1.05;
      return { verdict: T("Without the read: " + secs(a.total) + ", dishes picked up within " + Math.round(a.bellP95) + " ms (p95). With a 15 ms blocking read: " + secs(b.total) + ", and ready dishes waited " + secs(b.bellP95) + " at the bell (p95).",
          "Sin la lectura: " + secs(a.total) + ", platos recogidos en menos de " + Math.round(a.bellP95) + " ms (p95). Con una lectura bloqueante de 15 ms: " + secs(b.total) + ", y los platos listos esperaron " + secs(b.bellP95) + " en la campana (p95)."),
        bars: [[T("No blocking read", "Sin lectura bloqueante"), a.total / top, secs(a.total)], [T("15 ms blocking read", "Lectura bloqueante de 15 ms"), b.total / top, secs(b.total), true]] }; },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    touring = false;
    for (const [name, value] of Object.entries(w)) { cfg[name] = value; WB.pressSeg(name, value); }
    restart();
    if (clock.paused) clock.setPaused(false);
  } });

  restart();
}

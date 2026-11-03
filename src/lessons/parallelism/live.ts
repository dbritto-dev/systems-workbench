// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The workshop in the browser: runs the model, moves workers, crates, the shared tool and the press, wires the
// controls and the experiment cards. mount() gets the build-time data from page.ts (geometry, experiment results).
import { translateAlong, solidSvg, slabOf, cylinder, lineOnTop } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L as tr, T } from "../../runtime/wb";
import { readout, stats as statsStrip, act, pauseControls } from "../../runtime/dom";
import { PAR, makeShop, amdahl, speedup } from "./sim";
import { secs1, msFromSecs } from "../../lib/format";

export default function mount({ P, G, BASE, RESULTS, PAWN_SVG, EXP_ES, EXPERIMENTS }) {
  const NS = "http://www.w3.org/2000/svg";
  const stage = document.querySelector("[data-office]");
  const svg = stage.querySelector("svg");
  const q = (s) => svg.querySelector(s);
  const say = readout();
  const stat = statsStrip();
  const covers = G.BENCHES.map((b) => q('[data-bench="' + b.i + '"] [data-cover]'));
  const crateRows = [q('[data-crates="0"]'), q('[data-crates="1"]')];
  const pawnRows = [q('[data-pawns="0"]'), q('[data-pawns="1"]')];
  const toolAnchors = { rack: q('[data-anchor="tool-rack"]'), 0: q('[data-anchor="tool-0"]'), 1: q('[data-anchor="tool-1"]') };
  const tool = q("[data-tool]");
  const waits = [...svg.querySelectorAll("[data-wait]")];
  const tokens = [...svg.querySelectorAll("[data-token]")];
  const tiles = [...svg.querySelectorAll("[data-tile]")];
  const product = q("[data-product]"), ram = q("[data-ram]"), rod = q("[data-rod]"), clockHand = q("[data-clock]");
  const pawns = Array.from({ length: 16 }, () => { const g = document.createElementNS(NS, "g"); g.innerHTML = PAWN_SVG; g.style.display = "none"; return g; });

  const cfg = { ...BASE, speed: 1 };
  let shop, seed = (Date.now() % 1e5) + 1, ref = 1, lastRam = null;

  // The parts redrawn every frame (the still frame has none of them).
  function crate(x0, y0, w, h, lit) { return solidSvg(slabOf({ x: x0, y: y0, w, d: G.CRATE.d, r: 0.6 }, G.CRATE.z, h, P, 2, 0.3), { tone: "hi", crease: "lo", lit }); }
  function ramAt(z, lit) { return solidSvg(slabOf({ x: G.PRESS.cx - 5.5, y: G.PRESS.cy - 5.5, w: 11, d: 11, r: 0.8 }, z, 4, P, 2, 0.4), { tone: "hi", crease: "lo", lit }); }
  function rodAt(z) { return solidSvg(cylinder(G.PRESS.cx, G.PRESS.cy, 1.8, z + 4, G.PRESS.top - z - 4, P, 14), { tone: "mid", crease: "none" }); }
  function needleOf(turn) { const a = turn * Math.PI * 2, x = -131, y = -84; return lineOnTop([x, y], [x + Math.sin(a) * 2.9, y - Math.cos(a) * 2.9], 16.2, P); }

  function restart() {
    shop = makeShop(cfg, seed++);
    ref = Math.max(...shop.chunks.map((c) => c.size));
    covers.forEach((c, i) => (c.style.display = i >= cfg.cores ? "" : "none"));
    pawns.forEach((p, i) => {
      p.style.display = i < cfg.workers ? "" : "none";
      const b = G.BENCHES[i % cfg.cores];
      if (p.parentNode !== pawnRows[b.row]) pawnRows[b.row].appendChild(p);
    });
    // Start a little way into the first job, so even a still frame shows workers busy and chunks waiting.
    shop.runTo(cfg.job === "tiny" ? 0.06 : cfg.workers === 1 ? 2.4 : 1.1);
    computeStats();
    paint();
  }

  const current = { speedup: null, limit: null };
  function computeStats() {
    current.limit = amdahl(cfg.serial, cfg.workers, cfg.cores);
    current.speedup = speedup(cfg);
    stat("limit", current.limit.toFixed(1) + "×");
    stat("speedup", current.speedup.toFixed(1) + "×");
  }

  function onBench(b) { return shop.workers.filter((w) => w.bench === b); }
  function paint() {
    const t = shop.t;
    if (shop.chunks[0] && shop.jobStart === t) ref = Math.max(...shop.chunks.map((c) => c.size));
    const rows = [[], []];
    for (let b = 0; b < cfg.cores; b++) {
      const bench = G.BENCHES[b], list = onBench(b), n = list.length;
      const running = list.filter((w) => w.chunk && !w.waiting);
      const active = running.length ? running[Math.floor(t / 0.3) % running.length] : null;
      const gap = Math.min(15, 30 / Math.max(1, n)), width = Math.min(14, gap - 2);
      list.forEach((w, j) => {
        const x = bench.cx + (j - (n - 1) / 2) * gap;
        const working = w === active;
        pawns[w.id].setAttribute("transform", translateAlong(P, [x, bench.front + 5 + (working ? 0 : 5), 0]));
        if (w.chunk) {
          const left = w.chunk.free + w.chunk.tool;
          const h = 1 + 14 * Math.min(1, left / ref);
          rows[bench.row].push(crate(x - width / 2, bench.cy - G.CRATE.d / 2 - 1, width, h, working));
        }
      });
    }
    crateRows[0].innerHTML = rows[0].join(""); crateRows[1].innerHTML = rows[1].join("");
    waits.forEach((el, i) => (el.style.display = i < shop.ready.length ? "" : "none"));
    // Shared tool: on its rack, or on the bench of the worker holding it.
    {
      const holder = shop.toolHolder === null ? null : shop.workers[shop.toolHolder];
      const anchor = holder ? toolAnchors[G.BENCHES[holder.bench].row] : toolAnchors.rack;
      if (tool.parentNode !== anchor) anchor.appendChild(tool);
      const b = holder && G.BENCHES[holder.bench];
      tool.setAttribute("transform", translateAlong(P, holder ? [b.x0 + G.BENCH.w - 5.5, b.y0 + 5.5, G.BENCH.h] : G.TOOL_REST));
      tool.querySelectorAll(".iso-solid").forEach((s) => s.toggleAttribute("data-lit", !!holder));
      tokens.forEach((el, i) => (el.style.display = i < shop.toolQueue.length ? "" : "none"));
    }
    // Packing tray and press.
    const inTray = shop.phase === "work" ? shop.doneCount : shop.phase === "merge" ? Math.ceil(Math.max(0, shop.mergeLeft) / PAR.MERGE) : 0;
    tiles.forEach((el, i) => (el.style.display = i < inTray ? "" : "none"));
    product.style.display = shop.phase === "work" ? "none" : "";
    const pressing = shop.phase === "pack";
    const z = pressing ? G.PRESS.down + (G.PRESS.up - G.PRESS.down) * 0.5 * (1 + Math.cos(t * Math.PI * 2 / 0.7)) : G.PRESS.up;
    const key = z.toFixed(1) + pressing;
    if (key !== lastRam) { lastRam = key; ram.innerHTML = ramAt(z, pressing); rod.innerHTML = rodAt(z); }
    clockHand.setAttribute("d", needleOf((t - shop.jobStart) / PAR.BIG));
    // Readout.
    const waitingTool = shop.workers.filter((w) => w.waiting).length;
    const job = shop.jobsDone + 1, last = shop.lastTime ? secs1(shop.lastTime) : "";
    if (WB.lang() === "es") {
      if (shop.phase === "work") say("trabajo " + job + " · " + shop.doneCount + " de " + shop.chunks.length + " bloques hechos" + (waitingTool ? " · " + waitingTool + (waitingTool === 1 ? " espera" : " esperan") + " la herramienta" : "") + (last ? " · último " + last : ""));
      else if (shop.phase === "merge") say("trabajo " + job + " · uniendo " + shop.chunks.length + " bloques · bancos inactivos");
      else say("trabajo " + job + " · la estación empaca sola (parte serial) · bancos inactivos");
    } else {
      if (shop.phase === "work") say("job " + job + " · " + shop.doneCount + " of " + shop.chunks.length + " chunks done" + (waitingTool ? " · " + waitingTool + " waiting for the tool" : "") + (last ? " · last " + last : ""));
      else if (shop.phase === "merge") say("job " + job + " · merging " + shop.chunks.length + " chunks · benches idle");
      else say("job " + job + " · packing alone (serial part) · benches idle");
    }
  }

  function showStats() {
    stat("jobs", shop.jobsDone);
    stat("last", shop.lastTime ? (cfg.job === "tiny" ? msFromSecs(shop.lastTime) : secs1(shop.lastTime)) : "–");
    stat("busy", shop.t > 0.5 ? Math.round((100 * shop.busyTime) / shop.t) + "%" : "–");
    stat("toolwait", cfg.tool && shop.t > 0.5 ? Math.round((100 * shop.toolWaitTime) / (shop.t * cfg.workers)) + "%" : "–");
  }

  let statTimer = 0;
  function step(dt) {
    const before = shop.jobsDone;
    shop.runTo(shop.t + dt * cfg.speed);
    if (shop.jobsDone !== before) ref = Math.max(...shop.chunks.map((c) => c.size));
    paint();
    statTimer += dt; if (statTimer > 0.25) { statTimer = 0; showStats(); }
  }

  // ---------- controls ----------
  const pause = pauseControls(stage, say);
  const loop = WB.loop({ stage, step, onPause: pause.onPause });
  const NUMERIC = ["workers", "cores", "serial", "chunks", "speed"];
  function set(name, raw, quiet) {
    cfg[name] = NUMERIC.includes(name) ? Number(raw) : name === "tool" ? raw === true || raw === "true" : raw;
    WB.pressSeg(name, raw);
    if (name !== "speed" && !quiet) { restart(); showStats(); }
  }
  WB.onSegments((name, value) => set(name, value));
  act("reset").addEventListener("click", () => { restart(); showStats(); say(tr("started over", "empezó de nuevo")); });
  pause.bind(loop);

  // ---------- experiments (results computed at build time from the same model) ----------
  const x1 = (v) => v.toFixed(1) + "×";
  const RUNS = {
    amdahl: () => {
      const { list, limit } = RESULTS.amdahl;
      const s8 = list[3][1];
      return { verdict: T("8 workers finished a job " + x1(s8) + " faster, not 8×. Amdahl's limit for 10% serial work on 8 cores is " + x1(limit) + "; handing out and merging chunks takes the rest.",
          "8 trabajadores terminaron un trabajo " + x1(s8) + " más rápido, no 8×. El límite de Amdahl para un 10% de trabajo serial en 8 núcleos es " + x1(limit) + "; repartir y unir los bloques se lleva el resto."),
        bars: list.map(([w, s]) => [T(w + (w === 1 ? " worker" : " workers"), w + (w === 1 ? " trabajador" : " trabajadores")), s / 8, x1(s), w === 8]) };
    },
    oversub: () => {
      const { a, b } = RESULTS.oversub, top = Math.max(a, b);
      const slower = Math.round(100 * (b / a - 1));
      return { verdict: T("Job time " + secs1(a) + " with 8 workers, " + secs1(b) + " with 16 on the same 8 benches: " + slower + "% slower.",
          "Tiempo del trabajo: " + secs1(a) + " con 8 trabajadores, " + secs1(b) + " con 16 en los mismos 8 bancos: " + slower + "% más lento."),
        bars: [[T("8 workers", "8 trabajadores"), a / top, secs1(a)], [T("16 workers", "16 trabajadores"), b / top, secs1(b), true]] };
    },
    tool: () => {
      const { off, on } = RESULTS.tool;
      return { verdict: T("Speed-up with 8 workers: " + x1(off) + " without the shared tool, " + x1(on) + " with it.",
          "Aceleración con 8 trabajadores: " + x1(off) + " sin la herramienta compartida, " + x1(on) + " con ella."),
        bars: [[T("Tool off", "Herramienta apagada"), off / 8, x1(off)], [T("Tool on", "Herramienta encendida"), on / 8, x1(on), true]] };
    },
    tiny: () => {
      const { one, eight, more } = RESULTS.tiny, top = Math.max(one, eight, more);
      return { verdict: T("A 0.3 s job took " + msFromSecs(one) + " with 1 worker and " + msFromSecs(eight) + " split across 8. Split into 32 chunks it took " + msFromSecs(more) + ".",
          "Un trabajo de 0.3 s tardó " + msFromSecs(one) + " con 1 trabajador y " + msFromSecs(eight) + " repartido entre 8. Dividido en 32 bloques tardó " + msFromSecs(more) + "."),
        bars: [[T("1 worker", "1 trabajador"), one / top, msFromSecs(one)], [T("8 workers, 8 chunks", "8 trabajadores, 8 bloques"), eight / top, msFromSecs(eight), true], [T("8 workers, 32 chunks", "8 trabajadores, 32 bloques"), more / top, msFromSecs(more)]] };
    },
    uneven: () => {
      const { even, u8, u32 } = RESULTS.uneven, top = Math.max(even, u8, u32);
      return { verdict: T("Job time " + secs1(even) + " with even chunks, " + secs1(u8) + " with one heavy chunk, " + secs1(u32) + " once the job is cut into 32 chunks.",
          "Tiempo del trabajo: " + secs1(even) + " con bloques parejos, " + secs1(u8) + " con un bloque pesado, " + secs1(u32) + " al cortar el trabajo en 32 bloques."),
        bars: [[T("Even, 8 chunks", "Parejo, 8 bloques"), even / top, secs1(even)], [T("Heavy, 8 chunks", "Pesado, 8 bloques"), u8 / top, secs1(u8), true], [T("Heavy, 32 chunks", "Pesado, 32 bloques"), u32 / top, secs1(u32)]] };
    },
  };
  WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
    const w = exp.watch;
    for (const name of ["workers", "cores", "serial", "chunks", "tool", "job", "data"]) set(name, String(w[name]), true);
    restart(); showStats();
    if (loop.paused) loop.setPaused(false);
    say(tr("watching: " + exp.id, "observando: " + EXP_ES[exp.id]));
  } });

  loop.setPaused(loop.paused);
  restart();
  showStats();
}

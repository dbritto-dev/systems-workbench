// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The two storage rooms in the browser: runs the model (slowed down), pulls out the B-tree's drawers and lights the
// record each write changes, fills the LSM tree's memtable, puts its files on the shelves and lights the ones the
// merge press is working on, and answers the controls. mount() gets the build-time data from page.ts (projection,
// geometry) and root, the <wb-lesson>.
import { iso, pathOf, translateAlong, slabOf, solidSvg } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setLit, playPause } from "../../runtime/dom";
import { mean } from "../../lib/stats";
import { makeRooms, MEM, L0_SLOW, L0_STOP, PER_PAGE, BURST, runLen } from "./sim";

export default function mount({ P, G }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const stat = (key, value) => root.stat(key, value);
  const NS = "http://www.w3.org/2000/svg";
  const nDrawers = G.DRAWERS.cols * G.DRAWERS.rows;
  const drawers = Array.from({ length: nDrawers }, (_, i) => q(`[data-drawer="${i}"]`));
  const tiles = Array.from({ length: PER_PAGE }, (_, i) => q(`[data-tile="${i}"]`));
  const memCards = Array.from({ length: G.MEM_CARDS }, (_, i) => q(`[data-mem="${i}"]`));
  const waits = [0, 1].map((j) => Array.from({ length: G.WAIT_SLIPS }, (_, i) => q(`[data-wait="${j}-${i}"]`)));
  const shelves = [0, 1, 2, 3].map((i) => q(`[data-shelf="${i}"]`));
  const press = q("[data-press]"), needle = q("[data-progress]"), stallSign = q("[data-stall]");
  const labels = { leveled: qa('[data-labels="leveled"]'), tiered: qa('[data-labels="tiered"]'), ticks: qa("[data-target]") };
  const fly = q('[data-layer="fly"]');
  const counters = Object.fromEntries(["waitB", "waitL", "waB", "waL", "waLf", "rdB", "rdBf", "rdL", "rdLf", "spB", "spL"].map((n) => [n, WB.counter(svg, n, P)]));
  const meters = { diskB: WB.meter(svg, "diskB", P), diskL: WB.meter(svg, "diskL", P) };

  // ---------- settings and the run ----------
  const cfg = { rate: 100, reads: "hit", bloom: "off", compaction: "leveled", speed: 0.25 };
  const WARM = 60;
  let model, clock, logAt, seed = 5, hist, note, burstUntil = -1, lastLeaf = -1, lastPos = -1;
  function restart() {
    for (const r of runEls.values()) r.g.remove();
    runEls.clear();
    model = makeRooms({ rate: cfg.rate, reads: cfg.reads, readRate: 20, bloom: cfg.bloom === "on", compaction: cfg.compaction }, seed);
    seed = (seed * 7 + 3) % 9973 + 1;
    // run the first minute unseen, keeping 30 s of it for the write amplification counters
    model.runTo(WARM - 30);
    hist = [snapshot(WARM - 30)];
    model.runTo(WARM);
    clock = WARM; logAt = model.lsm.log.length; note = null; stalled = false; burstUntil = -1; lastBt = model.bt.st.writes; lastLs = model.lsm.st.writes;
    labels.leveled.forEach((g) => show(g, cfg.compaction === "leveled"));
    labels.tiered.forEach((g) => show(g, cfg.compaction === "tiered"));
    labels.ticks.forEach((g) => show(g, cfg.compaction === "leveled"));
    paint(true);
  }

  // ---------- runs on the shelves: one element per file or level, redrawn when its size changes ----------
  const runEls = new Map();      // id → { g, key }
  const LEN = G.SHELF.x1 - G.SHELF.x0;
  const lenOf = (n) => runLen(n, LEN);
  function runEl(id, shelf, x, w, h, lit) {
    let r = runEls.get(id);
    if (!r) { r = { g: document.createElementNS(NS, "g"), key: "" }; runEls.set(id, r); }
    const key = shelf + "|" + x.toFixed(1) + "|" + w.toFixed(1) + "|" + h;
    if (r.key !== key) {
      r.key = key;
      const plan = { x, y: G.SHELF.y - 1.6, w, d: 4, r: Math.min(0.4, w / 4) };
      r.g.innerHTML = solidSvg(slabOf(plan, G.SHELF_Z[shelf], h, P, 2, 0.15), { tone: "hi", crease: "lo" });
      shelves[shelf].appendChild(r.g);
      r.lit = null;
    }
    if (r.lit !== lit) { r.lit = lit; setLit(r.g, lit); }
    r.seen = true;
  }
  function layoutRuns() {
    for (const r of runEls.values()) r.seen = false;
    const m = model.lsm, job = m.job;
    const inJob = new Set(job && job.inputs ? job.inputs.map((x) => x.id) : []);
    const bookAt = (n) => G.SHELF.x0 + n * (G.BOOK.w + G.BOOK.gap);
    if (!m.tiered) {
      // L0: one book per file, oldest at the left
      const files = m.l0.slice().reverse().slice(-G.L0_BOOKS);
      files.forEach((f, n) => runEl(f.id, 0, bookAt(n), G.BOOK.w, G.BOOK.h, inJob.has(f.id)));
      for (let i = 1; i <= 3; i++) {
        const lv = m.lv[i], lit = !!job && (job.to === i || job.from === i);
        if (lv.keys.length) runEl(lv.id, i, G.SHELF.x0, lenOf(lv.keys.length), 6.4, lit);
      }
    } else {
      // tiered: each run on the shelf for its size, oldest at the left; a crowded shelf squeezes its runs
      const byShelf = [[], [], [], []];
      for (const x of m.runs.slice().reverse()) { const n = x.keys.length; byShelf[n < 150 ? 0 : n < 1500 ? 1 : n < 6000 ? 2 : 3].push(x); }
      byShelf.forEach((list, s) => {
        if (s === 0) { list.slice(-G.L0_BOOKS).forEach((x, n) => runEl(x.id, 0, bookAt(n), G.BOOK.w, G.BOOK.h, inJob.has(x.id))); return; }
        const want = list.map((x) => lenOf(x.keys.length) * 0.42);
        const total = want.reduce((a, b) => a + b, 0) + Math.max(0, list.length - 1) * 1.2;
        const k = total > LEN ? (LEN - Math.max(0, list.length - 1) * 1.2) / (total - Math.max(0, list.length - 1) * 1.2) : 1;
        let x0 = G.SHELF.x0;
        list.forEach((x, n) => { const w = Math.max(1.4, want[n] * k); runEl(x.id, s, x0, w, 6.4, inJob.has(x.id)); x0 += w + 1.2; });
      });
    }
    for (const [id, r] of runEls) if (!r.seen) { r.g.remove(); runEls.delete(id); }
  }

  // ---------- slips flying from the writer's desk ----------
  const SLIP = solidSvg(slabOf({ x: -2.2, y: -1.6, w: 4.4, d: 3.2, r: 0.3 }, 0, 0.8, P, 2, 0.1), { tone: "hi", crease: "lo" });
  const flights = [];
  const FROM = [[G.TRAYS[0].x + 6, G.TRAYS[0].y + 6, G.DESK_H + 2], [G.TRAYS[1].x + 6, G.TRAYS[1].y + 6, G.DESK_H + 2]];
  const TO = [[G.TILE_C[0], G.TILE_C[1], G.TILE_C[2]], [G.MEMT.x + G.MEMT.w / 2, G.MEMT.y + G.MEMT.d / 2, G.MEMT_H + 4]];
  let lastLaunch = [0, 0];
  function launch(side) {
    const now = performance.now();
    if (now - lastLaunch[side] < 140 || flights.length > 10) return;
    lastLaunch[side] = now;
    const g = document.createElementNS(NS, "g");
    g.innerHTML = SLIP;
    fly.appendChild(g);
    flights.push({ g, side, born: now });
  }
  function moveFlights() {
    const now = performance.now();
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i], u = (now - f.born) / 420;
      if (u >= 1) { f.g.remove(); flights.splice(i, 1); continue; }
      const a = FROM[f.side], b = TO[f.side];
      const p = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u + Math.sin(Math.PI * u) * 8];
      f.g.setAttribute("transform", translateAlong(P, p));
    }
  }

  // ---------- narration ----------
  const say = (text) => root.figure.say(L(text));
  const SHOW = 1.6;              // seconds of page time a note stays up before a less important one may replace it
  let noteWall = 0;
  // A merge note names its job: it reads "merging" while the press works and "merged" once the job is done; the
  // next merge to start replaces a "merged" note at once, so the readout follows the press.
  function put(rank, text, t, job = null, doneText = null) {
    const wall = performance.now() / 1000;
    if (job && note && note.past) { note = { t, rank, text, job, doneText }; noteWall = wall; return; }
    if (note && rank < note.rank && wall - noteWall < SHOW * (note.rank >= 3 ? 2 : 1)) return;
    if (note && rank === note.rank && rank < 2 && wall - noteWall < SHOW) return;
    if (rank < 1 && wall - noteWall < 4.5) return;      // frequent events (flushes, single-file merges) now and then
    note = { t, rank, text, job, doneText }; noteWall = wall;
  }
  // the stall flickers around its trigger while it lasts: say it's over only once L0 is well below it
  let stalled = false;
  function narrate() {
    const lg = model.lsm.log;
    if (stalled && model.lsm.stall === "off" && model.lsm.l0.length <= L0_SLOW / 2) { stalled = false; put(3, T("compaction caught up: writes at full speed again", "la compactación se puso al día: escrituras a toda velocidad otra vez"), clock); }
    for (; logAt < lg.length; logAt++) {
      const e = lg[logAt];
      if (e.type === "start") {
        const j = e.job, out = j.out.length, n = j.inputs ? j.inputs.length : 1;
        if (j.kind === "l0") put(1, T("merging " + n + " L0 files into L1 · " + out + " records to rewrite", "fusionando " + n + " archivos de L0 en L1 · " + out + " registros por reescribir"), e.t, j,
          T("merged " + n + " L0 files into L1 · " + out + " records rewritten", "fusionados " + n + " archivos de L0 en L1 · " + out + " registros reescritos"));
        else if (j.kind === "lv" && !j.trivial) put(0.5, T("merging one L" + j.from + " file into L" + j.to + " · " + out + " records to rewrite", "fusionando un archivo de L" + j.from + " en L" + j.to + " · " + out + " registros por reescribir"), e.t, j,
          T("merged one L" + j.from + " file into L" + j.to + " · " + out + " records rewritten", "fusionado un archivo de L" + j.from + " en L" + j.to + " · " + out + " registros reescritos"));
        else if (j.kind === "tier") {
          const each = Math.round(j.inN / n);
          put(1, T("merging " + n + " runs of about " + each + " records · " + out + " to rewrite", "fusionando " + n + " secuencias de unos " + each + " registros · " + out + " por reescribir"), e.t, j,
            T("merged " + n + " runs of about " + each + " records · " + out + " rewritten", "fusionadas " + n + " secuencias de unos " + each + " registros · " + out + " reescritos"));
        }
      } else if (e.type === "done") {
        if (note && note.job === e.job) { note.text = note.doneText; note.job = null; note.past = true; }
      } else if (e.type === "stall") {
        if (e.stall === "slow" && !stalled) put(3, T(L0_SLOW + " files in L0: writes slowed so compaction can catch up", L0_SLOW + " archivos en L0: escrituras frenadas para que la compactación se ponga al día"), e.t);
        else if (e.stall === "stop" && e.was !== "stop") put(3, T(L0_STOP + " files in L0: writes stopped", L0_STOP + " archivos en L0: escrituras detenidas"), e.t);
        if (e.stall !== "off") stalled = true;
      } else if (e.type === "flush") {
        put(0, model.lsm.tiered ? T("memtable full: " + e.run.keys.length + " records sorted into a new run", "memtable llena: " + e.run.keys.length + " registros ordenados en una secuencia nueva")
          : T("memtable full: " + e.run.keys.length + " records sorted into a new L0 file", "memtable llena: " + e.run.keys.length + " registros ordenados en un archivo nuevo de L0"), e.t);
      }
    }
  }

  // ---------- painting ----------
  const drawerLit = new Array(nDrawers).fill(0);
  let lastBt = 0, lastLs = 0;
  const snapshot = (t) => ({ t, bw: model.bt.st.written, bn: model.bt.st.writes, lw: model.lsm.st.written, ln: model.lsm.st.writes });
  function windowAmp(key) {
    const a = hist[0], b = hist[hist.length - 1];
    if (!a || a === b) return null;
    const w = b[key + "w"] - a[key + "w"], n = b[key + "n"] - a[key + "n"];
    return n > 20 ? w / n : null;
  }
  function paint(snap) {
    const m = model, bt = m.bt, ls = m.lsm, now = performance.now();
    narrate();
    // history for the write amplification counters: the last 30 s of model time
    hist.push(snapshot(clock));
    while (hist.length > 2 && hist[1].t <= clock - 30) hist.shift();     // keep one entry at least 30 s old

    // B-tree: the drawer of the latest write slides out and lights, one at a time (at high rates the rest blur into
    // a cabinet of black); the page table shows the same page
    const fresh = bt.recent.filter((r) => r[1] > clock - 0.25 * cfg.speed - 0.02);
    if (fresh.length) { drawerLit.fill(0); drawerLit[Math.min(nDrawers - 1, Math.floor((fresh[fresh.length - 1][0] / bt.pages) * nDrawers))] = now + 220; }
    drawers.forEach((d, i) => {
      const on = drawerLit[i] > now;
      if (d._on !== on) { d._on = on; setLit(d, on); d.setAttribute("transform", on ? translateAlong(P, [0, 2, 0]) : ""); }
    });
    if (bt.recent.length) {
      const [li, , key] = bt.recent[bt.recent.length - 1];
      const leaf = bt.leaves[li], pos = leaf.indexOf(key);
      if (li !== lastLeaf || lastPos !== pos) {
        lastLeaf = li; lastPos = pos;
        tiles.forEach((tl, i) => { show(tl, i < leaf.length); setLit(tl, i === pos); });
      }
    }
    if (bt.st.writes > lastBt) launch(0);
    if (ls.st.writes > lastLs) launch(1);
    lastBt = bt.st.writes; lastLs = ls.st.writes;
    moveFlights();

    // LSM: memtable cards, shelves, the press and its dial, the stall sign
    const cards = Math.ceil(ls.memFill * G.MEM_CARDS - 1e-9);
    memCards.forEach((c, i) => show(c, i < cards));
    layoutRuns();
    const job = ls.job;
    setLit(press, !!job);
    const frac = job ? (job.cost ? job.done / job.cost : 1) : 0, a = frac * Math.PI * 2, r = G.DIAL.r - 1.4;
    needle.setAttribute("d", pathOf([iso([G.DIAL.x, G.DIAL.y, G.PRESS_H + 1.3], P), iso([G.DIAL.x + Math.sin(a) * r, G.DIAL.y - Math.cos(a) * r, G.PRESS_H + 1.3], P)]));
    show(stallSign, stalled || ls.stall !== "off");

    // waiting writes: slips in the out-trays (one more slip each time the line doubles) and the counters
    const wb = bt.queue.length, wl = ls.queue.length;
    [wb, wl].forEach((n, j) => { const k = n ? Math.min(G.WAIT_SLIPS, 1 + Math.floor(Math.log2(n))) : 0; waits[j].forEach((s, i) => show(s, i < k)); });
    counters.waitB.setClamped(wb); counters.waitL.setClamped(wl);

    // the benches
    const waB = windowAmp("b"), waL = windowAmp("l");
    if (waB !== null) counters.waB.setClamped(Math.round(waB));
    const tenthsOf = (v) => { const n = Math.min(999, Math.round(v * 10)); return [Math.floor(n / 10), n % 10]; };
    if (waL !== null) { const [i, f] = tenthsOf(waL); counters.waL.set(i); counters.waLf.set(f); }
    // pages per read on both benches, as the panel shows them (the panel adds the LSM tree's files checked)
    const rb = mean(m.reads.bt.map((x) => x.pages)), rl = mean(m.reads.lsm.map((x) => x.pages)), fl = mean(m.reads.lsm.map((x) => x.files));
    { const [i, f] = tenthsOf(rb); counters.rdB.set(i); counters.rdBf.set(f); }
    { const [i, f] = tenthsOf(rl); counters.rdL.set(i); counters.rdLf.set(f); }
    counters.spB.setClamped(Math.round(bt.space * 100)); counters.spL.setClamped(Math.round(ls.space * 100));
    meters.diskB.set(Math.min(1, m.busy.bt)); meters.diskL.set(Math.min(1, m.busy.lsm));

    // the panel
    stat("waB", waB === null ? "–" : waB.toFixed(0) + "×");
    stat("waL", waL === null ? "–" : waL.toFixed(1) + "×");
    stat("rdB", rb.toFixed(1));
    stat("rdL", rl.toFixed(1) + " / " + fl.toFixed(1));
    stat("space", Math.round(bt.space * 100) + "% / " + Math.round(ls.space * 100) + "%");
    stat("wait", wb + " / " + wl);

    // the readout: the latest note while it's fresh, otherwise what each room is doing
    const wall = now / 1000;
    if (note && wall - noteWall < SHOW * (note.rank >= 3 ? 2.5 : 1.4)) say(note.text);
    else {
      note = null;
      const n = ls.tiered ? ls.runs.length : ls.l0.length;
      const files = ls.tiered ? (n === 1 ? L("1 sorted run", "1 secuencia ordenada") : L(n + " sorted runs", n + " secuencias ordenadas"))
        : n === 1 ? L("1 file in L0", "1 archivo en L0") : L(n + " files in L0", n + " archivos en L0");
      if (wb > 0) say(T("B-tree: " + wb + " writes waiting for its disk · LSM tree: " + files, "árbol B: " + wb + " escrituras esperando su disco · árbol LSM: " + files));
      else say(T("B-tree: a 4 KB page written per write · LSM tree: memtable " + Math.round(ls.memFill * MEM) + " of " + MEM + " · " + files, "árbol B: una página de 4 KB por escritura · árbol LSM: memtable " + Math.round(ls.memFill * MEM) + " de " + MEM + " · " + files));
    }
  }

  const pause = playPause(root);
  const loop = WB.loop({
    stage,
    step: (dt) => {
      clock += dt * cfg.speed;
      if (burstUntil > 0 && clock >= burstUntil) { burstUntil = -1; model.cfg.burst = null; }
      model.runTo(clock);
      paint(false);
    },
    onPause: pause.onPause,
  });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = name === "rate" ? Number(raw) : raw;
    if (!quiet) restart();
  }
  root.on("change", (name, value) => set(name, value));
  function burst() {
    model.cfg.burst = { at: model.t, len: BURST.len, rate: BURST.rate };
    burstUntil = model.t + BURST.len;
    note = null; put(2, T("burst: " + BURST.rate + " writes a second for a minute, to both engines", "ráfaga: " + BURST.rate + " escrituras por segundo durante un minuto, a los dos motores"), clock);
    if (loop.paused) loop.setPaused(false);
  }
  const actions = { burst, reset: () => restart() };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    set("rate", String(w.rate ?? 100), true); set("reads", w.reads ?? "hit", true); set("bloom", w.bloom ?? "off", true); set("compaction", w.compaction ?? "leveled", true);
    set("speed", String(w.speed ?? 0.25));
    restart();
    if (w.burst) burst();
    if (loop.paused) loop.setPaused(false);
  });

  loop.setPaused(loop.paused);
  restart();
}

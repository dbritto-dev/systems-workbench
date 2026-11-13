// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The backup room in the browser: runs the model in time-lapse, stands the newest writes on the leader and the
// replica, closes segments into the archive and lands snapshots on the shelf, and runs the restore station: a restore
// after a bad DELETE or a lost database, a new replica, a restore drill. While the station works, the clock runs
// faster, so a restore of hours fits in a few seconds. mount() gets the build-time data from page.ts (projection,
// geometry, the flying crates) and root, the <wb-lesson>.
import { translateAlong } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, setLit, playPause } from "../../runtime/dom";
import { lerp, smoothstep } from "../../lib/tween";
import { clamp } from "../../lib/stats";
import { makeSim, clockText, dur, DAY, NOTICE, REPLAY_X } from "./sim";

const LIVE_FROM = 13 * 60 + 50;      // a run starts at 13:50 on day 1
const SPAN = 5 * DAY;                // the model is built this far ahead; past it the run starts over
const JOB_SECS = 4;                  // page seconds a station job takes, at least
const HOLD = 2.5;                    // page seconds a lost database's restored copy is shown before it takes over

export default function mount({ P, G, FLY_SEG, FLY_SNAP }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";

  // ---------- the figure's parts ----------
  const slotEl = (id) => {
    const g = q(`[data-slot="${id}"]`);
    return { g, block: g.querySelector("[data-block]"), label: g.querySelector("[data-label]"), dash: g.querySelector("[data-dash]"), dlabel: g.querySelector("[data-dlabel]"), key: "" };
  };
  const slots = {
    leader: G.SLOTS.leader.map((_, i) => slotEl("leader-" + i)),
    replica: G.SLOTS.replica.map((_, i) => slotEl("replica-" + i)),
    station: G.SLOTS.station.map((_, i) => slotEl("station-" + i)),
  };
  const crateEl = (id) => { const g = q(`[data-crate="${id}"]`); return { g, label: g.querySelector("[data-label]"), sub: g.querySelector("[data-sub]"), key: "" }; };
  const arch = G.ARCH_SLOTS.map((_, i) => crateEl("arch-" + i));
  const archGap = G.ARCH_SLOTS.map((_, i) => q(`[data-gapslot="arch-${i}"]`));
  const backs = G.BACK_SLOTS.map((_, i) => crateEl("back-" + i));
  const openC = crateEl("open"), padC = crateEl("pad"), trayC = crateEl("tray");
  const more = { arch: q('[data-more="arch"]'), back: q('[data-more="back"]') };
  const offEl = q("[data-off]"), gapEl = q("[data-gap]"), gapLabel = q("[data-gap-label]");
  const counters = Object.fromEntries(["hh", "mm", "upto", "lost", "took"].map((n) => [n, WB.counter(svg, n, P)]));
  const load = WB.meter(svg, "load", P);
  const flyLayer = q('[data-layer="fly"]');

  const name = (w) => "W" + Math.max(0, w.n);
  // a block's or crate's label, smaller for a long one so it stays on its face
  const fit = (el, text, big = el.big ??= Number(el.getAttribute("font-size"))) => {
    const room = el.closest("[data-crate]") ? G.CRATE.w - 1 : G.BLOCK.w - 0.8;     // the face's width, in model units
    const size = Math.round(100 * Math.min(big, room / (0.7 * text.length))) / 100;
    if (el.size !== size) { el.size = size; el.setAttribute("font-size", String(size)); }
  };
  // kind: "" hidden, "solid" a write the node holds, "dash" one it hasn't got
  function setSlot(s, kind, label = "", lit = false) {
    const key = kind + "|" + label + "|" + lit;
    if (s.key === key) return;
    s.key = key;
    show(s.g, kind !== "");
    show(s.block, kind === "solid");
    show(s.dash, kind === "dash");
    if (kind === "solid") { setText(s.label, label); fit(s.label, label); setLit(s.block, lit); }
    if (kind === "dash") { setText(s.dlabel, label); fit(s.dlabel, label); }
  }
  function setCrate(c, on, label = "", sub = "", lit = false) {
    const key = on + "|" + label + "|" + sub + "|" + lit;
    if (c.key === key) return;
    c.key = key;
    show(c.g, on);
    if (!on) return;
    setText(c.label, label);
    if (c.sub) setText(c.sub, sub);
    else fit(c.label, label);
    setLit(c.g, lit);
  }
  // a row of slots from a list of { label, lit, dash } (the newest last), right-aligned
  function fillRow(row, items, width = row.length) {
    const shown = items.slice(-width);
    row.forEach((s, i) => {
      const it = shown[i - (width - shown.length)];
      if (i >= width || !it) setSlot(s, "");
      else setSlot(s, it.dash ? "dash" : "solid", it.label, !!it.lit);
    });
  }

  // ---------- settings and the run ----------
  const cfg = { snap: 360, archive: "on", seed: "shelf", speed: 10, gapAt: null };
  let model, runSeed = 5, seedN = 5, runOpts, clock = LIVE_FROM, prev = LIVE_FROM;
  let phase = "run";                 // "run", or "down" while a lost database is being restored
  let lostAt = null, holdUntil = null;
  let job = null, view = null, lastRes = null;
  let deleteT = null, noticeAt = null, deletePage = 0, delSeg = null;
  let carry = [];                    // the restored copy's newest writes, shown on the leader after it takes over
  let drillAt = 0, plan = [];
  let pageT = 0;

  function modelCfg(extra = {}) {
    return { snap: Number(cfg.snap), archive: cfg.archive, gapAt: cfg.gapAt, deleteAt: null, ...extra };
  }
  function restart(from = LIVE_FROM) {
    runSeed = seedN; seedN = (seedN * 7 + 3) % 9973 + 1;
    runOpts = { start: -DAY, span: SPAN, zero: 0 };          // W1 is the first write after midnight
    model = makeSim(modelCfg({ gapAt: cfg.gapAt ?? from + 2 }), runSeed, runOpts);
    clock = prev = from;
    phase = "run"; lostAt = holdUntil = null;
    job = null; view = null; lastRes = null; deleteT = noticeAt = delSeg = null; carry = [];
    drillAt = model.drills.findIndex((d) => d.at > clock);
    clearFlights();
    paint(); showStats();
  }
  // after a lost database: the restored copy takes over, and a new run carries on from it
  function takeOver() {
    const top = view && view.upN !== null ? view.upN : 0;
    const maxN = model.writes[Math.max(0, model.countTo(lostAt) - 1)]?.n ?? top;
    const s0 = model.snaps.filter((x) => x.e <= lostAt).length + Number(model.snaps[0].name.slice(1));
    carry = view ? view.rows.filter((r) => !r.dash).slice(-3).map((r) => ({ label: r.label })) : [];
    runSeed = seedN; seedN = (seedN * 7 + 3) % 9973 + 1;
    runOpts = { start: clock, span: SPAN, zero: clock, nAtZero: maxN + 1, s0 };
    model = makeSim(modelCfg({ gapAt: 1e9 }), runSeed, runOpts);
    phase = "run"; lostAt = holdUntil = null; deleteT = noticeAt = null;
    drillAt = model.drills.findIndex((d) => d.at > clock);
    say(6, T("the restored copy takes over as the leader · a new replica follows it", "la copia restaurada toma el mando como líder · una réplica nueva la sigue"));
  }

  // ---------- narration ----------
  let saidAt = -9, saidRank = 0, held = null;
  const holdFor = (rank) => (rank >= 5 ? 3 : 1.4);
  function say(rank, text) {
    const wall = performance.now() / 1000;
    if (rank < saidRank && wall - saidAt < holdFor(saidRank)) { if (!held || rank >= held.rank) held = { rank, text }; return; }
    held = null; saidRank = rank; saidAt = wall;
    root.figure.say(L(text));
  }
  function sayHeld() {
    if (held && performance.now() / 1000 - saidAt >= holdFor(saidRank)) { const h = held; held = null; saidRank = -1; say(h.rank, h.text); }
  }
  const int = (x) => Math.round(x).toLocaleString("en");
  const writesText = (n) => (n === 1 ? T("1 write", "1 escritura") : T(int(n) + " writes", int(n) + " escrituras"));
  const range = (g) => { const a = model.writes[g.i0], b = model.writes[g.i1]; return a === b ? name(a) : name(a) + "–" + name(b); };

  // events between the last frame and this one
  function narrate() {
    const lim = phase === "down" ? lostAt : clock;
    for (const x of model.snaps) {
      if (x.s > prev && x.s <= lim && !(x.extra && x.s === model.start)) say(1, T("snapshot " + x.name + " started · it reads the whole database", "empezó la instantánea " + x.name + " · lee la base de datos entera"));
      if (x.e > prev && x.e <= lim && x.e > model.start) {
        say(2, T(x.name + " is on the shelf · it holds every write up to " + clockText(x.e), x.name + " está en el estante · guarda cada escritura hasta las " + clockText(x.e)));
        if (!job || job.kind !== "seed" || job.from !== "shelf") fly("snap", G.LEADER_TOP, G.BACK_SLOTS[G.BACK_SLOTS.length - 1], x.name, clockText(x.e), false, "snap" + x.name);
      }
    }
    const g = model.gapSeg;
    if (g && g.close + 0.15 > prev && g.close + 0.15 <= lim) say(5, T("the segment with " + range(g) + " never reached the archive · its upload said OK", "el segmento con " + range(g) + " nunca llegó al archivo · su subida dijo OK"));
    // the newest segment that landed: it flies from the pad to the shelf
    if (model.cfg.archive !== "off") {
      const k = lastSegBy(lim);
      const s = k >= 0 ? model.segs[k] : null;
      // only when segments land slower than one a second of page time, so the flying crate is the newest
      if (s && s.lands > prev && pace() <= 1.2 && !flights.some((f) => f.kind === "seg")) fly("seg", G.OPEN_AT, G.ARCH_SLOTS[G.ARCH_SLOTS.length - 1], name(model.writes[s.i1]), "", s.del, "seg" + s.k);
    }
  }

  // ---------- flying crates ----------
  const flights = [];
  function fly(kind, from, to, label, sub, lit, key) {
    if (WB.still.matches || flights.length > 3) return;
    const g = document.createElementNS(NS, "g");
    g.innerHTML = kind === "snap" ? FLY_SNAP : FLY_SEG;
    const lab = g.querySelector("[data-label]"), s = g.querySelector("[data-sub]");
    setText(lab, label); if (s) setText(s, sub); else fit(lab, label);
    setLit(g, lit);
    flyLayer.appendChild(g);
    flights.push({ g, kind, from, to, t: 0, dur: 0.6, key });
    place(flights[flights.length - 1]);
  }
  function place(f) {
    const u = smoothstep(clamp(f.t / f.dur));
    const p = [lerp(f.from[0], f.to[0], u), lerp(f.from[1], f.to[1], u), lerp(f.from[2], f.to[2], u) + Math.sin(Math.PI * u) * 14];
    f.g.setAttribute("transform", translateAlong(P, p));
  }
  function stepFlights(dt) {
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.t += dt;
      if (f.t >= f.dur) { f.g.remove(); flights.splice(i, 1); } else place(f);
    }
  }
  function clearFlights() { while (flights.length) flights.pop().g.remove(); }
  const flying = (key) => flights.some((f) => f.key === key);

  // ---------- what the shelves hold ----------
  // the index of the newest segment that had landed (or, if missing, would have) by t
  function lastSegBy(t) {
    const segs = model.segs;
    let lo = 0, hi = segs.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (segs[m].close <= t) lo = m + 1; else hi = m; }
    let k = lo - 1;
    while (k >= 0 && !segs[k].missing && segs[k].lands > t) k--;
    return k;
  }

  // ---------- the station ----------
  function startJob(j) {
    job = { ...j, startedAt: clock, said: false };
    if (j.snap && !(j.kind === "seed" && j.from === "leader")) {
      const idx = shelfIndex(j.snap);
      fly("snap", idx >= 0 ? G.BACK_SLOTS[idx] : G.BACK_SLOTS[0], [G.PAD_AT[0], G.PAD_AT[1], G.PAD_AT[2] + 0.8], j.snap.name, clockText(j.snap.e), false, "pad");
    }
  }
  function shelfIndex(snap) {
    const lim = phase === "down" ? lostAt : clock;
    const on = model.snaps.filter((x) => x.e <= lim);
    const shown = on.slice(-G.BACK_SLOTS.length);
    const i = shown.indexOf(snap);
    return i < 0 ? -1 : i + (G.BACK_SLOTS.length - shown.length);
  }
  // the restored copy at `e` minutes into a job: how far it has got (index of its newest write)
  function progress(j, e) {
    const W = model.writes;
    if (j.kind === "seed" && j.from === "leader") {
      if (e < j.copy) return -1;
      const a = model.countTo(j.t0) - 1, b = model.countTo(j.t0 + j.total) - 1;
      return Math.round(lerp(a, b, clamp((e - j.copy) / Math.max(1e-6, j.total - j.copy))));
    }
    const snap = j.snap;
    if (e < j.copy) return -1;
    const tau = snap.e + (e - j.copy) * REPLAY_X;
    let up = Math.min(model.countTo(tau) - 1, j.r ? j.r.up : Infinity);
    up = Math.max(up, snap.up);
    if (j.kind === "seed") up = Math.min(model.countTo(Math.min(tau, clock)) - 1, model.countTo(clock) - 1);
    return up;
  }
  function rowsFor(up, dashW) {
    const W = model.writes, rows = [];
    for (let i = Math.max(0, up - 3); i <= up; i++) if (W[i] && W[i].n >= 1) rows.push({ label: name(W[i]), lit: !!W[i].del });
    if (dashW && dashW.n >= 1) rows.push({ label: name(dashW), dash: true });
    return rows;
  }
  function finishJob() {
    const j = job, W = model.writes;
    job = null;
    let up, lostN = 0, dashW = null;
    if (j.kind === "seed") { up = model.countTo(clock) - 1; }
    else {
      up = j.r.up; lostN = j.r.lostN;
      // the first write the copy doesn't have: the bad DELETE, the first write lost, or where a drill's replay stopped
      const until = j.why === "delete" ? deleteT : j.r.target, next = W[up + 1];
      dashW = next && next.t <= until ? next : null;
    }
    const rows = rowsFor(up, dashW);
    view = { kind: j.kind, rows, upN: up >= 0 && W[up] ? W[up].n : null, lostN, took: clock - j.t0, pad: j.snap && !(j.kind === "seed" && j.from === "leader") ? { name: j.snap.name, sub: clockText(j.snap.e) } : null };
    lastRes = { up: view.upN, lost: lostN, took: view.took };
    const upName = view.upN ? "W" + view.upN : "–";
    if (j.kind === "drill") {
      if (j.found) say(6, T("drill: replay stopped at the gap after " + upName + " · taking a new snapshot now", "simulacro: la reproducción se detuvo en el hueco tras " + upName + " · se toma una instantánea nueva ya"));
      else say(3, T("drill OK: " + j.snap.name + " and the log replayed to " + clockText(j.r.target), "simulacro OK: " + j.snap.name + " y el log reproducidos hasta las " + clockText(j.r.target)));
    } else if (j.kind === "seed") {
      const gb = j.s.leaderGB, amount = gb >= 1 ? int(gb) + " GB" : int(gb * 1024) + " MB";
      say(6, T("new replica ready in " + dur(view.took) + " · it read " + amount + " from the leader", "réplica nueva lista en " + dur(view.took) + " · leyó " + amount + " del líder"));
    } else if (j.why === "delete") {
      const back = model.afterDelete(j.r), pctBack = (back.rowsBack >= 0.9995 ? "100" : back.rowsBack >= 0.1 ? (100 * back.rowsBack).toFixed(1) : String(Math.round(100 * back.rowsBack))) + "%";
      if (j.r.stop === "gap") say(8, T("the replay stopped at the gap: up to " + upName + " · " + pctBack + " of the orders back, " + int(back.missing) + " earlier writes missing", "la reproducción se detuvo en el hueco: hasta " + upName + " · " + pctBack + " de los pedidos de vuelta, faltan " + int(back.missing) + " escrituras anteriores"));
      else if (back.missing) say(8, T("restored up to " + upName + ", the snapshot alone · " + pctBack + " of the orders back · the " + int(back.missing) + " writes since it are missing", "restaurada hasta " + upName + ", solo la instantánea · " + pctBack + " de los pedidos de vuelta · faltan las " + int(back.missing) + " escrituras desde ella"));
      else say(8, T("restored up to " + upName + " · " + (dashW ? name(dashW) + " was the bad DELETE · " : "") + pctBack + " of the orders back, beside the leader", "restaurada hasta " + upName + " · " + (dashW ? name(dashW) + " fue el DELETE malo · " : "") + pctBack + " de los pedidos de vuelta, junto al líder"));
    } else {
      const what = j.r.stop === "gap" ? T("the replay stopped at the gap · ", "la reproducción se detuvo en el hueco · ") : T("", "");
      const lost = lostN ? writesText(lostN) : T("no writes", "ninguna escritura");
      const ago = lostN ? " (" + dur(j.r.lostMin) + ")" : "";
      say(8, T(what.en + "back up to " + upName + " · " + lost.en + " lost" + ago + " · took " + dur(view.took), what.es + "recuperada hasta " + upName + " · " + lost.es + " perdidas" + ago + " · tardó " + dur(view.took)));
      holdUntil = pageT + HOLD;
    }
    showStats();
  }

  // ---------- painting ----------
  function paint() {
    narrate();
    sayHeld();
    const W = model.writes, lim = phase === "down" ? lostAt : clock;
    const down = phase === "down";
    WB.pose(svg, "leader-sign", down ? "down" : "up");
    WB.pose(svg, "replica-sign", down ? "down" : "up");
    // the leader's and the replica's newest writes
    const c = model.countTo(clock), newest = [];
    for (let i = Math.max(0, c - 4); i < c; i++) if (W[i].n >= 1) newest.push(W[i]);
    if (down) { fillRow(slots.leader, []); fillRow(slots.replica, []); }
    else {
      const lead = [...carry, ...newest.map((w) => ({ label: name(w), lit: !!w.del }))];
      fillRow(slots.leader, lead);
      fillRow(slots.replica, [...carry, ...newest.map((w) => ({ label: name(w), lit: !!w.del, dash: w.t + w.lag > clock }))]);
    }
    // the open segment, on the pad
    const last = c ? W[c - 1] : null, openSeg = last && last.seg !== undefined ? model.segs[last.seg] : null;
    if (!down && openSeg && openSeg.close > clock && W[openSeg.i0].t <= clock) {
      let del = false;
      for (let i = openSeg.i0; i < c; i++) if (W[i].del) del = true;
      setCrate(openC, true, name(last), "", del);
    } else setCrate(openC, false);
    // the archive
    const off = model.cfg.archive === "off";
    show(offEl, off);
    if (off) { arch.forEach((x) => setCrate(x, false)); archGap.forEach((x) => show(x, false)); setText(more.arch, ""); }
    else {
      const k = lastSegBy(lim), n = arch.length;
      for (let i = 0; i < n; i++) {
        const s = model.segs[k - (n - 1 - i)];
        if (!s || s.close <= model.start || flying("seg" + s.k)) { setCrate(arch[i], false); show(archGap[i], false); continue; }
        show(archGap[i], s.missing);
        setCrate(arch[i], !s.missing, name(W[s.i1]), "", s.del);
      }
      const older = Math.max(0, k + 1 - n);
      setText(more.arch, older ? "+" + int(older) : "");
    }
    const g = model.gapSeg;
    const gapOn = !!g && g.close + 0.15 <= lim;
    show(gapEl, gapOn);
    if (gapOn) setText(gapLabel, L("GAP: ", "HUECO: ") + range(g));
    // the backups shelf
    {
      const on = model.snaps.filter((x) => x.e <= lim), n = backs.length, shown = on.slice(-n);
      backs.forEach((b, i) => {
        const x = shown[i - (n - shown.length)];
        setCrate(b, !!x && !flying("snap" + x.name), x ? x.name : "", x ? clockText(x.e) : "");
      });
      setText(more.back, on.length > n ? "+" + (on.length - n) : "");
    }
    paintStation();
    // the clock and the leader's load
    const now = clockText(clock);
    counters.hh.set(Number(now.slice(0, 2))); counters.mm.set(Number(now.slice(3)));
    let lv = down ? 0 : 0.14 + 0.03 * Math.sin(pageT * 3.1);
    if (!down && model.snaps.some((x) => x.s <= clock && clock < x.e && x.s > model.start)) lv += 0.3;
    if (job && job.kind === "seed") {
      const e = clock - job.t0;
      if (job.from === "leader" && e < job.copy) lv += 0.55;
      else if (e > job.total * 0.85) lv += 0.08;
    }
    load.set(lv);
  }
  function paintStation() {
    const W = model.writes;
    if (job) {
      WB.pose(svg, "station-sign", job.kind);
      const e = clock - job.t0, up = progress(job, e);
      const fromShelf = job.snap && !(job.kind === "seed" && job.from === "leader");
      setCrate(padC, fromShelf && !flying("pad"), fromShelf ? job.snap.name : "", fromShelf ? clockText(job.snap.e) : "");
      const nextW = up >= -1 ? W[up + 1] : null;
      const replaying = fromShelf && e >= job.copy && nextW && nextW.seg !== undefined && nextW.t <= clock;
      setCrate(trayC, !!replaying, replaying ? name(W[model.segs[nextW.seg].i1]) : "", "", replaying && model.segs[nextW.seg].del);
      fillRow(slots.station, up >= 0 ? rowsFor(up, nextW && nextW.t <= clock ? nextW : null) : []);
      counters.upto.setClamped(up >= 0 && W[up] ? Math.max(0, W[up].n) : 0);
      counters.lost.set(0);
      counters.took.setClamped(Math.round(e));
      if (!job.said && e >= job.copy && fromShelf) {
        job.said = true;
        const span = (job.r ? job.r.point : clock) - job.snap.e;
        if (span > 1) say(3, T("copied " + job.snap.name + " back · replaying " + dur(span) + " of log", job.snap.name + " copiada de vuelta · reproduciendo " + dur(span) + " de log"));
      }
      return;
    }
    if (view) {
      WB.pose(svg, "station-sign", view.kind);
      setCrate(padC, !!view.pad, view.pad ? view.pad.name : "", view.pad ? view.pad.sub : "");
      setCrate(trayC, false);
      fillRow(slots.station, view.rows);
      counters.upto.setClamped(view.upN ?? 0);
      counters.lost.setClamped(view.lostN);
      counters.took.setClamped(Math.round(view.took));
      return;
    }
    WB.pose(svg, "station-sign", "restore");
    setCrate(padC, false); setCrate(trayC, false);
    fillRow(slots.station, []);
    counters.upto.set(0); counters.lost.set(0); counters.took.set(0);
  }

  // ---------- stats ----------
  const tb = (gb) => { const x = gb / 1000; return (x < 10 ? x.toFixed(1) : String(Math.round(x))) + " TB"; };
  function showStats() {
    if (phase === "down") { root.stat("risk", "–"); root.stat("rto", "–"); }
    else {
      const r = model.restore(clock, clock);
      root.stat("risk", r.lostN ? dur(r.lostMin) : L(T("nothing", "nada")));      // the writes since the last one the restore would get back
      root.stat("rto", dur(r.total));
    }
    root.stat("store", tb(model.storage.gb));
    root.stat("upto", lastRes && lastRes.up ? "W" + lastRes.up : "–");
    root.stat("lost", lastRes ? int(lastRes.lost) : "–");
    root.stat("took", lastRes ? dur(lastRes.took) : "–");
  }

  // ---------- the loop ----------
  function pace() {
    let v = Number(cfg.speed);
    if (job) v = Math.max(v, job.total / JOB_SECS);
    // after the bad DELETE: normal speed until its segment is in the archive (and at least 1.5 s), then on to the notice
    else if (noticeAt !== null && pageT - deletePage > 1.5 && !(delSeg && delSeg.lands > clock)) v = Math.max(v, NOTICE / 1.5);
    return v;
  }
  let statTimer = 0;
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    pageT += dt;
    stepFlights(dt);
    if (holdUntil !== null) {
      if (pageT >= holdUntil) takeOver();
      else { paint(); return; }
    }
    prev = clock;
    clock += dt * pace();
    if (job && clock >= job.t0 + job.total) { clock = Math.max(prev, job.t0 + job.total); finishJob(); }
    while (plan.length && clock >= plan[0][1]) runPlan(plan.shift());
    if (noticeAt !== null && clock >= noticeAt && !job && phase === "run") {
      noticeAt = null;
      const r = model.restore(deleteT - 1 / 60, clock);
      const how = model.cfg.archive === "off" ? T(" (no log archived)", " (sin log archivado)") : T(" + the log to " + clockText(deleteT - 1 / 60) + ":59", " + el log hasta las " + clockText(deleteT - 1 / 60) + ":59");
      say(7, T(NOTICE + " minutes later someone notices · restoring " + r.snap.name + how.en + " beside the leader", NOTICE + " minutos después alguien lo nota · se restaura " + r.snap.name + how.es + " junto al líder"));
      startJob({ kind: "restore", why: "delete", r, t0: clock, copy: r.copy, total: r.total, snap: r.snap });
    }
    if (model.cfg.archive === "drill" && drillAt >= 0 && drillAt < model.drills.length && clock >= model.drills[drillAt].at) {
      const d = model.drills[drillAt++];
      if (!job && phase === "run" && noticeAt === null) {
        say(2, T("drill: restoring " + d.r.snap.name + " on a spare machine and replaying the archive", "simulacro: se restaura " + d.r.snap.name + " en una máquina aparte y se reproduce el archivo"));
        startJob({ kind: "drill", r: d.r, t0: clock, copy: d.r.copy, total: d.r.total, snap: d.r.snap, found: d.found });
      }
    }
    if (clock > model.end - 120) { restart(); say(9, T("a new run starts", "empieza una ejecución nueva")); return; }
    paint();
    statTimer += dt; if (statTimer > 0.25) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  pause.bind(loop);

  // ---------- the panel ----------
  const wake = () => { if (loop.paused) loop.setPaused(false); };
  const busy = () => say(9, T("the station is busy · wait for it to finish", "la estación está ocupada · espera a que termine"));
  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = name === "snap" ? Number(raw) : String(raw);
    if (name === "seed") return;           // affects only the next new replica
    if (!quiet) { plan = []; cfg.gapAt = null; restart(); say(9, T("settings applied · run restarted", "ajustes aplicados · ejecución reiniciada")); }
  }
  root.on("change", (name, value) => set(name, value));
  const actions = {
    delete: () => {
      if (phase !== "run" || holdUntil !== null) return busy();
      if (deleteT !== null) return say(9, T("one bad DELETE per run · Start over for another", "un DELETE malo por ejecución · Empezar de nuevo para otro"));
      deleteT = clock; noticeAt = clock + NOTICE; deletePage = pageT;
      model = makeSim({ ...model.cfg, deleteAt: clock }, runSeed, runOpts);
      const w = model.writes[model.countTo(clock) - 1];
      delSeg = model.cfg.archive === "off" ? null : model.segs[w.seg];
      say(6, T(name(w) + " is a bad DELETE: every order is gone · the replica applies it " + Math.round(w.lag * 60) + " s later", name(w) + " es un DELETE malo: se borraron todos los pedidos · la réplica lo aplica " + Math.round(w.lag * 60) + " s después"));
      paint();
    },
    lose: () => {
      if (phase !== "run" || holdUntil !== null) return busy();
      if (job && job.kind !== "drill") return busy();
      phase = "down"; lostAt = clock; noticeAt = null;
      const r = model.restore(clock, clock);
      const how = model.cfg.archive === "off" ? T(", the only copy left", ", la única copia que queda") : T(" + the archived log", " + el log archivado");
      say(7, T(clockText(clock) + ": the leader and its replica are lost · restoring " + r.snap.name + how.en, clockText(clock) + ": se pierden el líder y su réplica · se restaura " + r.snap.name + how.es));
      job = null;
      startJob({ kind: "restore", why: "loss", r, t0: clock, copy: r.copy, total: r.total, snap: r.snap });
      paint(); showStats();
    },
    seed: () => {
      if (phase !== "run" || holdUntil !== null) return busy();
      if (job && job.kind !== "drill") return busy();
      job = null;
      const s = cfg.seed === "leader" ? model.seedFromLeader(clock) : model.seedFromShelf(clock);
      if (cfg.seed === "leader") say(4, T("new replica: copying the whole database from the leader", "réplica nueva: se copia la base de datos entera del líder"));
      else say(4, T("new replica: " + s.r.snap.name + " from the shelf, then the archive, then the last bit from the leader", "réplica nueva: " + s.r.snap.name + " del estante, luego el archivo, luego lo último del líder"));
      startJob({ kind: "seed", from: cfg.seed, s, r: s.r, t0: clock, copy: s.copy, total: s.total, snap: s.r ? s.r.snap : null });
      paint();
    },
    reset: () => { plan = []; cfg.gapAt = null; restart(); say(9, T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => { if (actions[name]) { actions[name](); wake(); } });

  // ---------- "Watch it on the machine": an experiment's settings, a start time and what happens when ----------
  function runPlan([what, , to]) {
    if (what === "jump") { prev = clock = to; drillAt = model.drills.findIndex((d) => d.at > clock); clearFlights(); say(4, T("later that day: " + clockText(to), "más tarde ese día: " + clockText(to))); return; }
    actions[what]?.();
  }
  root.on("watch", (w) => {
    for (const key of ["snap", "archive", "seed"]) if (w[key] !== undefined) set(key, w[key], true);
    set("speed", w.speed ?? 1, true);
    cfg.gapAt = w.gapAt ?? null;
    restart(w.from ?? LIVE_FROM);
    plan = (w.plan || []).map((x) => [...x]);
    say(9, T("experiment's settings applied · run restarted at " + clockText(clock), "ajustes del experimento aplicados · ejecución reiniciada a las " + clockText(clock)));
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
  say(0, T("the leader takes writes · each minute a segment of its log goes to the archive", "el líder recibe escrituras · cada minuto un segmento de su log va al archivo"));
}

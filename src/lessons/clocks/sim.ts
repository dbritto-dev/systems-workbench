// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// Two offices edit one shared record at a records desk. Event-driven and seeded, shared by the live figure and the
// experiments. Times are milliseconds of real time (the figure plays them in slow motion).
//
// Each office runs one edit at a time, read-modify-write: its courier fetches a copy of the record (GET), the office
// adds one line to it (the edit), and the courier carries the whole new record back to the desk, stamped. The desk
// answers OK either way. The desk resolves what it receives by the rule:
//
// cfg.rule
//   "lww"      last write wins by wall clock: the stamp is the writer's clock reading when it sends; the desk keeps the
//              record with the highest stamp and quietly drops the other
//   "lamport"  last write wins by Lamport clock: each office keeps a counter, raises it to the highest it has read and
//              adds one per edit; ties go to B (the office letter breaks them)
//   "vector"   version vectors: each record carries one counter per office; the desk replaces only a record the new
//              one has seen (its vector is ≥ in every place) and keeps concurrent ones side by side as siblings; the
//              next office to read siblings merges them (keeps every line) before it edits
// cfg.clocks (wall clocks only matter to "lww")
//   "exact"    both clocks read true time
//   "ntp"      each clock is off by a fixed amount within ±NTP_ERR (drawn per run): synced, not exact
//   "behind"   A synced as above, B not syncing: BEHIND ms slow
//   "step"     A drifted FAST ms fast; at stepAt NTP steps it back to within ±NTP_ERR (B synced)
//
// The record is a list of lines; every edit adds one line, so a lost edit is a line that is missing at the end.

import { rng } from "../../lib/random";
import { minHeap } from "../../lib/events";
import { averageOver } from "../../lib/stats";

export const LEG = [0.5, 1];        // a courier's trip between an office and the desk, one way: 0.5–1.5 ms
export const THINK = [0.5, 1.5];    // the office works on its copy: 0.5–2 ms
export const IDLE = 20;             // mean ms between one edit's OK and the next edit's GET (exponential)
export const NTP_ERR = 5;           // NTP: each clock within ±5 ms of true time
export const BEHIND = 50;           // B's clock when it isn't syncing
export const FAST = 150;            // A's clock before the step
export const OFFICES = ["A", "B"];
export const EPOCH = 1000;          // clocks read ms since an arbitrary zero, so every reading starts at four digits
export const DEFAULTS = { rule: "lww", clocks: "ntp", stepAt: 1000 };

export function makeSim(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rWork = rng(seed * 2654435761 + 17), rClock = rng(seed * 40503 + 101);
  const events = minHeap((a, b) => a.t < b.t || (a.t === b.t && a.n < b.n));
  let n = 0, now = 0, stopAt = Infinity;
  const at = (t, k, x) => events.push({ t, k, x, n: n++ });
  const leg = () => LEG[0] + LEG[1] * rWork();

  // ---------- clocks ----------
  const base = [(2 * rClock() - 1) * NTP_ERR, (2 * rClock() - 1) * NTP_ERR];
  function offset(i, t) {
    if (cfg.clocks === "exact") return 0;
    if (cfg.clocks === "behind" && i === 1) return -BEHIND;
    if (cfg.clocks === "step" && i === 0 && t < cfg.stepAt) return FAST + base[0];
    return base[i];
  }
  const wall = (i, t) => EPOCH + t + offset(i, t);

  // ---------- the record and the offices ----------
  const writes = [];          // every edit: { id, office, sent, arrive, done, key, label, vv, items, base, fate }
  const reads = [];           // every GET
  const log = [];             // what the live figure narrates
  const st = { edits: 0, older: 0, conc: 0, siblings: 0, merges: 0, perOffice: [0, 0] };
  // lww / lamport: one record. key orders it; id -1 is the empty record every office starts from.
  let rec = { items: [], key: -Infinity, id: -1, office: -1, label: "" };
  // vector: a list of siblings, each { items, vv, id, office, label }
  let sibs = [];
  const offices = OFFICES.map((name, i) => ({ i, name, phase: "idle", trip: null, copy: null, lam: 0, ctx: [0, 0], base: -1, nextAt: 0, wake: null }));

  const lamKey = (c, i) => c * 2 + i;
  const vvLabel = (v) => v[0] + "," + v[1];
  const leq = (a, b) => a[0] <= b[0] && a[1] <= b[1];

  // Is write sid one this write's writer had read (directly or through the edits it read)?
  function seen(sid, w) {
    if (sid < 0) return true;
    for (let x = w.base; x !== null && x >= sid; x = x >= 0 ? writes[x].base : null) if (x === sid) return true;
    return false;
  }

  function start(o, t) {
    if (t >= stopAt) { o.phase = "done"; return; }
    o.phase = "read";
    const r = { kind: "read", office: o.i, sent: t, arrive: t + leg(), done: 0, snap: null };
    r.done = r.arrive + leg();
    reads.push(r); o.trip = r;
    at(r.arrive, "readAt", r); at(r.done, "readBack", r);
  }

  function onReadAt(t, r) {
    r.snap = cfg.rule === "vector" ? sibs.slice() : rec;
  }

  function onReadBack(t, r) {
    const o = offices[r.office];
    o.phase = "think"; o.trip = null;
    if (cfg.rule === "vector") {
      const s = r.snap;
      if (s.length > 1) {
        const seenItems = new Set();
        for (const x of s) for (const it of x.items) seenItems.add(it);
        o.copy = { items: [...seenItems] };
        o.ctx = [Math.max(...s.map((x) => x.vv[0])), Math.max(...s.map((x) => x.vv[1]))];
        st.merges++;
        log.push({ t, type: "merge", office: o.i, n: s.length });
      } else {
        o.copy = { items: s.length ? s[0].items : [] };
        o.ctx = s.length ? s[0].vv.slice() : [0, 0];
      }
      o.base = s.length ? Math.max(...s.map((x) => x.id)) : -1;
    } else {
      o.copy = { items: r.snap.items };
      o.base = r.snap.id;
      if (cfg.rule === "lamport" && r.snap.id >= 0) o.lam = Math.max(o.lam, Math.floor(r.snap.key / 2));
    }
    o.readKey = r.snap;
    at(t + THINK[0] + THINK[1] * rWork(), "send", o);
  }

  function onSend(t, o) {
    const id = writes.length;
    const w = { kind: "write", id, office: o.i, sent: t, arrive: 0, done: 0, items: [...o.copy.items, id], base: o.base, fate: "flight", key: 0, label: "", vv: null, wall: wall(o.i, t) };
    w.arrive = t + leg(); w.done = w.arrive + leg();
    if (cfg.rule === "lww") { w.key = w.wall; w.label = w.wall.toFixed(1); }
    else if (cfg.rule === "lamport") { o.lam += 1; w.key = lamKey(o.lam, o.i); w.label = String(o.lam); }
    else { w.vv = o.ctx.slice(); w.vv[o.i] += 1; w.label = vvLabel(w.vv); }
    writes.push(w); st.edits++; st.perOffice[o.i]++;
    o.phase = "write"; o.trip = w; o.copy = null;
    at(w.arrive, "writeAt", w); at(w.done, "ack", w);
    log.push({ t, type: "send", w });
  }

  function onWriteAt(t, w) {
    if (cfg.rule === "vector") {
      const keep = sibs.filter((s) => !leq(s.vv, w.vv));
      if (keep.length) { w.fate = "sibling"; st.siblings++; w.with = keep.map((s) => s.id); log.push({ t, type: "sibling", w }); }
      else { w.fate = "won"; log.push({ t, type: "won", w }); }
      sibs = [...keep, { items: w.items, vv: w.vv, id: w.id, office: w.office, label: w.label }];
      return;
    }
    const s = rec;
    if (w.key > s.key) {
      if (!seen(s.id, w)) { w.fate = "over"; w.over = s.id; writes[s.id].overBy = w.id; st.conc++; log.push({ t, type: "over", w, s }); }
      else { w.fate = "won"; log.push({ t, type: "won", w }); }
      rec = { items: w.items, key: w.key, id: w.id, office: w.office, label: w.label };
    } else {
      w.lostTo = s.id;
      if (seen(s.id, w)) { w.fate = "older"; st.older++; log.push({ t, type: "older", w, s }); }
      else { w.fate = "conc"; st.conc++; log.push({ t, type: "conc", w, s }); }
    }
  }

  function onAck(t, w) {
    const o = offices[w.office];
    o.phase = "idle"; o.trip = null;
    o.nextAt = t + Math.max(0.5, -Math.log(1 - rWork()) * IDLE);
    o.wake = { t: o.nextAt, n: n };
    at(o.nextAt, "start", { o, token: o.wake });
  }

  for (const o of offices) { o.nextAt = 0.3 + 4 * rWork(); o.wake = { t: o.nextAt }; at(o.nextAt, "start", { o, token: o.wake }); }

  function step(e) {
    now = e.t;
    if (e.k === "start") { if (e.x.token === e.x.o.wake && e.x.o.phase === "idle") start(e.x.o, e.t); }
    else if (e.k === "readAt") onReadAt(e.t, e.x);
    else if (e.k === "readBack") onReadBack(e.t, e.x);
    else if (e.k === "send") onSend(e.t, e.x);
    else if (e.k === "writeAt") onWriteAt(e.t, e.x);
    else if (e.k === "ack") onAck(e.t, e.x);
  }
  function runTo(T) {
    for (;;) {
      const e = events.peek();
      if (!e || e.t > T) break;
      events.pop();
      step(e);
    }
    now = Math.max(now, T);
  }
  /** Stop starting new edits at T and run until everything in flight has landed. */
  function finish(T) { stopAt = T; runTo(T); runTo(Infinity); }

  // Lines in the record now (vector: every sibling's lines, as the next reader would merge them).
  function lines() {
    if (cfg.rule !== "vector") return rec.items;
    const s = new Set();
    for (const x of sibs) for (const it of x.items) s.add(it);
    return [...s];
  }
  // Edits still somewhere: in the record, in a copy an office is working on, or in a write in flight. Any other edit
  // is gone for good.
  function alive() {
    const set = new Set(lines());
    for (const o of offices) {
      if (o.copy) for (const it of o.copy.items) set.add(it);
      if (o.trip && o.trip.kind === "write" && o.trip.fate === "flight") for (const it of o.trip.items) set.add(it);
    }
    return set;
  }
  const lostNow = () => writes.length - alive().size;

  return {
    cfg, writes, reads, log, st, offices, runTo, finish, lines, alive, lostNow, offset, wall,
    /** Start an edit at office i now, if it is idle. */
    poke(i, t) {
      runTo(t);
      const o = offices[i];
      if (o.phase !== "idle") return false;
      o.wake = { t };
      at(t, "start", { o, token: o.wake });
      runTo(t);
      return true;
    },
    get rec() { return rec; },
    get sibs() { return sibs; },
    get now() { return now; },
  };
}

// ---------- experiments: headless runs, averaged over seeds ----------
// Each run draws its own clock offsets, so the runs are many and short.
export const SEEDS = Array.from({ length: 32 }, (_, i) => 7 + 12 * i);
export const RUN_MS = 3000;
const avg = (fn) => averageOver(SEEDS, fn);
function run(cfg, seed, ms = RUN_MS) { const m = makeSim(cfg, seed); m.finish(ms); return m; }
function summary(m) {
  const kept = new Set(m.lines());
  const edits = m.writes.length;
  const keptBy = [0, 1].map((i) => { const mine = m.writes.filter((w) => w.office === i); return mine.length ? mine.filter((w) => kept.has(w.id)).length / mine.length : 0; });
  return {
    edits,
    lost: (100 * (edits - kept.size)) / edits,
    older: (100 * m.st.older) / edits,
    conc: (100 * m.st.conc) / edits,
    siblings: (100 * m.st.siblings) / edits,
    merges: (100 * m.st.merges) / edits,
    keptA: keptBy[0], keptB: keptBy[1],
  };
}

// 1. LWW with exact clocks vs NTP-synced clocks: edits lost to an older edit their writer had already read.
export function ntpRun() {
  return { exact: avg((s) => summary(run({ rule: "lww", clocks: "exact" }, s))), ntp: avg((s) => summary(run({ rule: "lww", clocks: "ntp" }, s))) };
}

// 2. B's clock stops syncing and runs 50 ms slow: whose edits stay?
export function behindRun() {
  return { ntp: avg((s) => summary(run({ rule: "lww", clocks: "ntp" }, s))), behind: avg((s) => summary(run({ rule: "lww", clocks: "behind" }, s))) };
}

// 3. A's clock, 150 ms fast, is stepped back: edits made in the FAST ms after the step vs the FAST ms before.
export const STEP_AT = 1500;
export function stepRun() {
  const one = (rule) => avg((s) => {
    const m = run({ rule, clocks: "step", stepAt: STEP_AT }, s);
    const kept = new Set(m.lines());
    const share = (f) => { const xs = m.writes.filter(f); return xs.length ? xs.filter((w) => kept.has(w.id)).length / xs.length : 1; };
    const before = (w) => w.sent >= STEP_AT - FAST && w.sent < STEP_AT, after = (w) => w.sent >= STEP_AT && w.sent < STEP_AT + FAST;
    const late = (w) => w.sent >= STEP_AT + FAST + 20 && w.sent < STEP_AT + 2 * FAST + 20;
    return {
      aBefore: share((w) => w.office === 0 && before(w)), bBefore: share((w) => w.office === 1 && before(w)),
      aAfter: share((w) => w.office === 0 && after(w)), bAfter: share((w) => w.office === 1 && after(w)),
      allAfter: share(after), allLate: share(late),
    };
  });
  return { lww: one("lww"), lamport: one("lamport") };
}

// 4. Lamport clocks instead of wall clocks (NTP-synced, and exact for reference).
export function lamportRun() {
  return {
    ntp: avg((s) => summary(run({ rule: "lww", clocks: "ntp" }, s))),
    exact: avg((s) => summary(run({ rule: "lww", clocks: "exact" }, s))),
    lamport: avg((s) => summary(run({ rule: "lamport", clocks: "ntp" }, s))),
  };
}

// 5. Version vectors with siblings instead of Lamport clocks.
export function vectorRun() {
  return { lamport: avg((s) => summary(run({ rule: "lamport", clocks: "ntp" }, s))), vector: avg((s) => summary(run({ rule: "vector", clocks: "ntp" }, s))) };
}

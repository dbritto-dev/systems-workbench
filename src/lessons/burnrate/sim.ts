// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// A service with a 99.9% availability SLO over 30 days, watched by two alarms. Minute by minute, seeded, shared by the
// live figure and the experiments.
//
// Every minute RPM requests arrive. A share of them fails: a small background rate, short harmless blips (a restart,
// a deploy hiccup) and whatever fault is switched on (a slow leak, a partial outage, a full outage). The error budget
// is the 0.1% of requests the SLO allows to fail over 30 days; every failure drains it.
//
//   static alarm      error rate over the last 5 minutes above 1%, optionally only once that has held for `staticFor`
//                     minutes (a Prometheus `for:` clause).
//   burn-rate alarm   burn rate = error rate ÷ 0.1%: 1× spends the budget in exactly 30 days. Three tiers (Google SRE
//                     Workbook, "Alerting on SLOs"): 14.4× over 1 h and 6× over 6 h page, 1× over 3 days opens a
//                     ticket. With `multi`, each tier also needs its short window (1/12 of the long one) above the
//                     same burn rate.
//
// Time before the run counts as clean (no failures): the first window of a run is as full of requests as any other.
// Alarms are checked at the end of every minute.

import { rngMixed } from "../../lib/random";
import { averageOver } from "../../lib/stats";

export const SLO = 0.999;
export const BUDGET = 1 - SLO;                 // the share of requests allowed to fail
export const RPM = 1000;                       // requests a minute, steady (illustrative)
export const HOUR = 60, DAY = 1440, PERIOD = 30 * DAY;
export const BUDGET_ERRORS = BUDGET * RPM * PERIOD;   // 43,200 failed requests in 30 days
export const BASE = 0.0002;                    // background failures, 0.02%: a burn rate of 0.2
export const BLIP = { perDay: 1.5, mins: [1, 3], rate: [0.03, 0.08] };   // 1.5 a day, 1–3 min at 3–8% failing
export const STATIC = { window: 5, threshold: 0.01 };
export const TIERS = [
  { burn: 14.4, long: HOUR, short: 5, page: true },
  { burn: 6, long: 6 * HOUR, short: 30, page: true },
  { burn: 1, long: 3 * DAY, short: 6 * HOUR, page: false },
];
export const FAULTS = { none: 0, leak: 0.002, partial: 0.008, outage: 1 };
export const DEFAULTS = { blips: true, staticFor: 0, multi: true, faults: [] };

// A Poisson draw for small means, a normal approximation of the binomial above that.
function failures(r, p) {
  if (p >= 1) return RPM;
  const mean = RPM * p;
  if (mean < 30) {
    const lim = Math.exp(-mean);
    let k = 0, q = r();
    while (q > lim) { k++; q *= r(); }
    return Math.min(RPM, k);
  }
  const u = Math.max(1e-12, r()), v = r();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(0, Math.min(RPM, Math.round(mean + z * Math.sqrt(mean * (1 - p)))));
}

export function makeSim(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rBlip = rngMixed(seed * 7919 + 1), rErr = rngMixed(seed * 104729 + 3);
  const faults = cfg.faults.map(([from, to, rate]) => ({ from, to, rate }));
  const cum = [0];                             // cum[m]: failures in minutes 0..m-1
  const rate = [];                             // the share failing in each minute (what the service did)
  let t = 0;                                   // minutes simulated
  let blip = null;
  const gap = () => -Math.log(1 - rBlip()) * DAY / BLIP.perDay;
  let nextBlip = cfg.blips ? gap() : Infinity;
  let condSince = -1;
  const st = { staticOn: false, tiers: [false, false, false], page: false, ticket: false, staticPages: 0, pages: 0, tickets: 0, blips: 0 };
  const log = [];                              // { t, type, … }: what the live figure narrates and the runs measure

  const errorsIn = (w, at = t) => cum[at] - cum[Math.max(0, at - w)];
  const ratio = (w, at = t) => errorsIn(w, at) / (RPM * w);
  const burn = (w, at = t) => ratio(w, at) / BUDGET;
  const faultAt = (m) => faults.reduce((s, f) => (m >= f.from && m < f.to ? s + f.rate : s), 0);

  function step() {
    const m = t;
    if (!blip && m >= nextBlip) {
      const len = BLIP.mins[0] + Math.floor(rBlip() * (BLIP.mins[1] - BLIP.mins[0] + 1));
      blip = { from: m, to: m + len, rate: BLIP.rate[0] + rBlip() * (BLIP.rate[1] - BLIP.rate[0]) };
      st.blips++;
      log.push({ t: m, type: "blip", mins: len, rate: blip.rate });
    }
    const p = Math.min(1, BASE + (blip ? blip.rate : 0) + faultAt(m));
    const e = failures(rErr, p);
    rate.push(e / RPM);
    cum.push(cum[m] + e);
    t = m + 1;
    if (blip && t >= blip.to) { blip = null; nextBlip = cfg.blips ? t + gap() : Infinity; }
    // the alarms, at the end of the minute
    const cond = ratio(STATIC.window) > STATIC.threshold;
    if (cond && condSince < 0) condSince = m;
    if (!cond) condSince = -1;
    const on = cond && m - condSince >= cfg.staticFor;
    if (on && !st.staticOn) { st.staticPages++; log.push({ t: m, type: "static" }); }
    if (!on && st.staticOn) log.push({ t: m, type: "static-off" });
    st.staticOn = on;
    TIERS.forEach((tier, i) => { st.tiers[i] = burn(tier.long) > tier.burn && (!cfg.multi || burn(tier.short) > tier.burn); });
    const page = st.tiers[0] || st.tiers[1], ticket = st.tiers[2];
    if (page && !st.page) { st.pages++; log.push({ t: m, type: "page", tier: st.tiers[0] ? 0 : 1 }); }
    if (!page && st.page) log.push({ t: m, type: "page-off" });
    if (ticket && !st.ticket) { st.tickets++; log.push({ t: m, type: "ticket" }); }
    if (!ticket && st.ticket) log.push({ t: m, type: "ticket-off" });
    st.page = page; st.ticket = ticket;
  }

  return {
    cfg, st, log, rate,
    get t() { return t; },
    get blip() { return blip; },
    fault: () => faultAt(t),
    runTo(m) { while (t < m) step(); },
    errorsIn, ratio, burn,
    /** Share of the 30-day budget spent: failures in the last 30 days ÷ 43,200. */
    used: (at = t) => errorsIn(PERIOD, at) / BUDGET_ERRORS,
    /** From now on, the fault fails `share` of requests (0 ends it). Faults added with addFault() keep running. */
    setFault(share) {
      for (const f of faults) if (!f.timed && f.to > t) f.to = t;
      if (share > 0) faults.push({ from: t, to: Infinity, rate: share });
    },
    /** A fault that fails `share` of requests for the next `mins` minutes. */
    addFault(share, mins) { faults.push({ from: t, to: t + mins, rate: share, timed: true }); },
    /** A blip now (3 minutes at 6%) unless one is running. */
    blipNow() {
      if (blip) return false;
      blip = { from: t, to: t + 3, rate: 0.06 };
      st.blips++;
      log.push({ t, type: "blip", mins: 3, rate: 0.06 });
      return true;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The experiments: eight seeds each.
export const SEEDS = [3, 7, 11, 19, 23, 31, 43, 59];
const firstAfter = (m, type, from) => m.log.find((e) => e.type === type && e.t >= from);

/** A month of blips and nothing else: how often each alarm pages, and how much budget the month used. */
export function blipsRun() {
  return averageOver(SEEDS, (seed) => {
    const m = makeSim({}, seed);
    m.runTo(PERIOD);
    return { blips: m.st.blips, staticPages: m.st.staticPages, pages: m.st.pages, tickets: m.st.tickets, used: m.used() };
  });
}

/** A slow leak: 0.2% failing from day 1, no blips. When does each alarm notice, and when is the budget gone? */
export const LEAK_FROM = DAY;
export function leakRun() {
  return averageOver(SEEDS, (seed) => {
    const m = makeSim({ blips: false, faults: [[LEAK_FROM, Infinity, FAULTS.leak]] }, seed);
    m.runTo(PERIOD);
    const ticket = firstAfter(m, "ticket", LEAK_FROM);
    let empty = PERIOD;
    for (let at = LEAK_FROM; at <= PERIOD; at += 10) if (m.used(at) >= 1) { empty = at; break; }
    return { staticPages: m.st.staticPages, pages: m.st.pages, ticketH: ticket ? (ticket.t + 1 - LEAK_FROM) / HOUR : NaN, usedAtTicket: ticket ? m.used(ticket.t + 1) : NaN, emptyDay: empty / DAY };
  });
}

/** Quiet the static alarm with "for 30 min", then a full outage on day 10. */
export const OUTAGE_AT = 10 * DAY + 10 * HOUR;
export function holdRun() {
  return averageOver(SEEDS, (seed) => {
    const quiet = makeSim({ staticFor: 30 }, seed);
    quiet.runTo(PERIOD);
    const loud = makeSim({ staticFor: 0 }, seed);
    loud.runTo(PERIOD);
    const m = makeSim({ staticFor: 30, faults: [[OUTAGE_AT, OUTAGE_AT + 2 * HOUR, FAULTS.outage]] }, seed);
    m.runTo(OUTAGE_AT + 3 * HOUR);
    const spent = (e) => (m.errorsIn(e.t + 1 - OUTAGE_AT, e.t + 1)) / BUDGET_ERRORS;
    const s = firstAfter(m, "static", OUTAGE_AT), b = firstAfter(m, "page", OUTAGE_AT);
    return { quietPages: quiet.st.staticPages, loudPages: loud.st.staticPages, staticMin: s.t + 1 - OUTAGE_AT, staticSpent: spent(s), burnMin: b.t + 1 - OUTAGE_AT, burnSpent: spent(b) };
  });
}

/** A partial outage: 0.8% failing (about 8× the budget's pace) from day 1, no blips. */
export const PARTIAL_FROM = DAY;
export function partialRun() {
  return averageOver(SEEDS, (seed) => {
    const m = makeSim({ blips: false, faults: [[PARTIAL_FROM, Infinity, FAULTS.partial]] }, seed);
    m.runTo(PARTIAL_FROM + 2 * DAY);
    const page = firstAfter(m, "page", PARTIAL_FROM);
    const burnNow = m.burn(6 * HOUR);
    return { staticPages: m.st.staticPages, pageH: page ? (page.t + 1 - PARTIAL_FROM) / HOUR : NaN, tier: page ? page.tier : NaN, spentAtPage: page ? m.errorsIn(page.t + 1 - PARTIAL_FROM, page.t + 1) / BUDGET_ERRORS : NaN, burn: burnNow, lastsDays: 30 / burnNow };
  });
}

/** A 10-minute full outage, then fixed: how long does each alarm keep paging after the fix? No blips. */
export const RESET_AT = 5 * DAY + 12 * HOUR, RESET_LEN = 10;
export function resetRun() {
  const one = (multi) => averageOver(SEEDS, (seed) => {
    const m = makeSim({ blips: false, multi, faults: [[RESET_AT, RESET_AT + RESET_LEN, FAULTS.outage]] }, seed);
    m.runTo(RESET_AT + 4 * DAY);
    const fix = RESET_AT + RESET_LEN;
    const on = firstAfter(m, "page", RESET_AT), off = firstAfter(m, "page-off", fix), soff = firstAfter(m, "static-off", fix), toff = firstAfter(m, "ticket-off", fix);
    return { pageMin: on.t + 1 - RESET_AT, offMin: off.t + 1 - fix, staticOff: soff.t + 1 - fix, ticketOffH: toff ? (toff.t + 1 - fix) / HOUR : NaN, spent: m.errorsIn(RESET_LEN, fix) / BUDGET_ERRORS };
  });
  return { multi: one(true), long: one(false) };
}

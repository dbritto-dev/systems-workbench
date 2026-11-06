// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// A festival gate that checks wristbands by their stamp. Event-driven and seeded, shared by the live figure and the
// experiments. Times are minutes since the user logged in (the figure starts its clock at 09:00).
//
// The box office (the auth server) signs wristbands (access tokens: an id, the user's token version, an expiry) and,
// with refresh on, hands out a refresh pass (a refresh token). The gate (an API) checks each wristband it is shown: a
// genuine stamp (every copy has one) and an expiry later than its clock. It can also look the wristband's id up on a
// deny list, or compare its version with the user's current version. The box office keeps state: it knows every
// refresh pass it handed out (by family) and can revoke them; the gate keeps none unless told to look something up.
//
// One round: the user logs in, then walks to the gate every few minutes. When their wristband has expired they go
// to the box office first: a refresh (with a pass), or a fresh login (without one, or when the pass is refused). At a
// random moment a thief copies what the user carries (the wristband, or the wristband and the pass) and starts
// trying the gate every couple of minutes. A few minutes later the user logs out, or resets their password from
// another device, or nobody notices. The thief keeps trying until the gate turns them away and the box office
// refuses their pass.
//
// cfg:
//   ttl      wristband (access token) lifetime, minutes
//   refresh  "off"     no refresh pass: an expired wristband means logging in again
//            "reuse"   a reusable refresh pass: shown again and again, it stays good until revoked
//            "rotate"  rotation with reuse detection: every refresh hands back a new pass and retires the old one;
//                      a retired pass shown again revokes the whole family (the user's pass and any copy)
//   check    "stamp"   signature and expiry only (stateless)
//            "deny"    also look the wristband's id up on the deny list (one lookup per request)
//            "version" also compare the wristband's version with the user's current version (one lookup per request)
//   steal    "band" | "both" (wristband and refresh pass) | "none"
//   revoke   "logout"  the user logs out: the box office revokes the family of the pass they hand in, the deny list
//                      gets the id of the wristband they hold, the user's version goes up by one
//            "reset"   the user resets their password from another device: the box office revokes every pass of the
//                      user and the version goes up; the deny list gets nothing (nobody handed in a wristband)
//            "none"    nobody notices
//   theftAt, revokeAfter, horizon: when the thief strikes (minutes after login; at the user's next gate visit), how
//            long until the revocation, and when the round ends

import { rngMixed } from "../../lib/random";
import { minHeap } from "../../lib/events";
import { mean } from "../../lib/stats";

// Walking times, in model minutes (a festival crowd is slow): what the figure plays.
export const WALK = { gate: 0.35, office: 0.45, officeToGate: 0.5, inside: 0.3, back: 0.45, exit: 0.6 };
export const USER_GAP = [1.2, 1.8];      // rest between trips: 1.2 min plus an exponential of mean 1.8 (a visit about every 4 min)
export const THIEF_GAP = [0.6, 0.8];     // rest between the thief's tries: 0.6 to 1.4 min (a try about every 2 min)
/** A model minute as a clock time: the round starts at 09:00. */
export const hhmm = (min) => { const m = Math.floor(540 + min); return String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
export const DEFAULTS = { ttl: 60, refresh: "rotate", check: "stamp", steal: "band", revoke: "logout", theftAt: 20, revokeAfter: 8, horizon: 480 };

export function makeFestival(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const r = rngMixed(seed * 7919 + 13);
  const events = minHeap((a, b) => a.t < b.t || (a.t === b.t && a.n < b.n));
  let n = 0, now = 0;
  const at = (t, k, x) => events.push({ t, k, x, n: n++ });

  const st = { logins: 0, forced: 0, refreshes: 0, refused: 0, reuse: 0, lookups: 0, requests: 0, userIn: 0, thiefIn: 0, thiefAfter: 0, lastThief: -1, lastAfter: -1, thiefTries: 0, denyMax: 0, theftT: -1, revokeT: -1, lockedT: -1 };
  const log = [];                  // what the live figure narrates
  const trips = [];                // every walk, for the figure: { who, depart, office, gate, inside, back, ... }
  const families = [];             // refresh-pass families: { id, revoked, current }
  const deny = new Map();          // band id -> its expiry (an entry is dropped once the band has expired anyway)
  let bandN = 0, passN = 0, userVer = 1;
  const user = { band: null, pass: null, active: true, at: "spot" };
  const thief = { band: null, pass: null, active: false, dead: false };

  const sign = (t) => ({ id: ++bandN, ver: userVer, iat: t, exp: t + cfg.ttl });
  const newPass = (fam) => { const p = { id: ++passN, fam }; fam.current = p; return p; };
  function login(t, forced) {
    const fam = { id: families.length + 1, revoked: false, current: null };
    families.push(fam);
    user.pass = cfg.refresh === "off" ? null : newPass(fam);
    user.band = sign(t);
    st.logins++; if (forced) st.forced++;
    log.push({ t, type: "login", forced, band: user.band });
  }

  // The box office: a pass in, a new wristband out (and a new pass, with rotation), or a refusal.
  function refresh(t, holder, who) {
    const pass = holder.pass;
    if (!pass) return false;
    const fam = pass.fam;
    if (fam.revoked) { st.refused++; log.push({ t, type: "refused", who, why: "revoked" }); return false; }
    if (cfg.refresh === "rotate") {
      if (pass !== fam.current) {
        fam.revoked = true; st.reuse++; st.refused++;
        log.push({ t, type: "reuse", who, fam: fam.id });
        return false;
      }
      holder.pass = newPass(fam);
    }
    holder.band = sign(t);
    st.refreshes++;
    log.push({ t, type: "refresh", who, band: holder.band });
    return true;
  }

  // The gate: stamp and expiry, then the lookup it is configured for.
  function check(t, band) {
    st.requests++;
    if (!band || band.exp <= t) return "expired";
    if (cfg.check === "deny") {
      st.lookups++;
      for (const [id, exp] of deny) if (exp <= t) deny.delete(id);
      if (deny.has(band.id)) return "denied";
    } else if (cfg.check === "version") {
      st.lookups++;
      if (band.ver !== userVer) return "version";
    }
    return "ok";
  }

  const userGap = () => USER_GAP[0] - Math.log(1 - r()) * USER_GAP[1];
  const thiefGap = () => THIEF_GAP[0] + THIEF_GAP[1] * r();

  // ---------- the user ----------
  function userDepart(t) {
    if (!user.active) return;
    const trip = { who: "user", depart: t, office: null, gate: 0, inside: 0, back: 0, ok: false, why: "" };
    trips.push(trip);
    let g = t + WALK.gate;
    if (user.band.exp <= t + WALK.gate) {
      // the wristband has run out: the box office first
      trip.office = t + WALK.office;
      g = trip.office + WALK.officeToGate;
      at(trip.office, "userOffice", trip);
    }
    trip.gate = g;
    at(g, "userGate", trip);
  }
  function userOffice(t, trip) {
    if (!user.active) return;
    const ok = cfg.refresh !== "off" && refresh(t, user, "user");
    trip.refreshed = ok;
    if (!ok) { login(t, cfg.refresh !== "off"); trip.login = true; }
  }
  function userGate(t, trip) {
    if (!user.active) { trip.ok = false; trip.why = "gone"; trip.back = t; return; }
    const why = check(t, user.band);
    trip.ok = why === "ok"; trip.why = why; trip.band = user.band;
    if (trip.ok) st.userIn++;
    trip.inside = trip.ok ? t + WALK.inside : t;
    trip.back = trip.inside + WALK.back;
    log.push({ t, type: "gate", who: "user", ok: trip.ok, why, band: user.band });
    // the thief copies what the user carries at the first gate visit after theftAt
    if (cfg.steal !== "none" && st.theftT < 0 && t >= cfg.theftAt && trip.ok) {
      st.theftT = t;
      thief.active = true;
      thief.band = user.band;
      thief.pass = cfg.steal === "both" ? user.pass : null;
      log.push({ t, type: "theft", band: thief.band, pass: !!thief.pass });
      at(t + 0.5, "thiefDepart");
      if (cfg.revoke !== "none") at(t + cfg.revokeAfter, "revoke");
    }
    at(trip.back + userGap(), "userDepart");
  }

  // ---------- the thief ----------
  function thiefDepart(t) {
    if (!thief.active) return;
    const trip = { who: "thief", depart: t, office: null, gate: 0, inside: 0, back: 0, ok: false, why: "" };
    trips.push(trip);
    let g = t + WALK.gate;
    if (thief.dead || thief.band.exp <= t + WALK.gate) {
      if (!thief.pass) { lockOut(t, trip, "expired"); return; }
      trip.office = t + WALK.office;
      g = trip.office + WALK.officeToGate;
      at(trip.office, "thiefOffice", trip);
    }
    trip.gate = g;
    at(g, "thiefGate", trip);
  }
  function thiefOffice(t, trip) {
    if (!thief.active) return;
    const ok = refresh(t, thief, "thief");
    trip.refreshed = ok;
    if (ok) thief.dead = false;
    if (!ok) { trip.refusedAt = t; trip.gate = t; trip.why = "refused"; trip.back = t + WALK.officeToGate; thief.active = false; st.lockedT = t; log.push({ t, type: "locked", why: "refused" }); }
  }
  function lockOut(t, trip, why) {
    trip.gate = t; trip.why = why; trip.back = t; trip.none = true;
    thief.active = false; st.lockedT = t;
    log.push({ t, type: "locked", why });
  }
  function thiefGate(t, trip) {
    if (!thief.active) return;
    st.thiefTries++;
    const why = check(t, thief.band);
    trip.ok = why === "ok"; trip.why = why; trip.band = thief.band;
    trip.inside = trip.ok ? t + WALK.inside : t;
    trip.back = trip.inside + WALK.back;
    log.push({ t, type: "gate", who: "thief", ok: trip.ok, why, band: thief.band, after: st.revokeT >= 0 });
    if (trip.ok) {
      st.thiefIn++; st.lastThief = t;
      if (st.revokeT >= 0) { st.thiefAfter++; st.lastAfter = t; }
    } else if (!thief.pass) {
      // turned away with nothing else to try
      thief.active = false; st.lockedT = t;
      log.push({ t, type: "locked", why });
      return;
    } else thief.dead = true;   // turned away, pass in hand: the next trip goes by the box office
    at(trip.back + thiefGap(), "thiefDepart");
  }

  // ---------- revocation ----------
  function revoke(t) {
    // one revocation per round: a button press and the scheduled one can't both happen
    if (st.revokeT >= 0) return;
    st.revokeT = t;
    let denied = false;
    if (cfg.revoke === "logout") {
      if (user.pass) user.pass.fam.revoked = true;
      if (cfg.check === "deny" && user.band && user.band.exp > t) { deny.set(user.band.id, user.band.exp); st.denyMax = Math.max(st.denyMax, deny.size); denied = true; }
    } else if (cfg.revoke === "reset") {
      for (const f of families) f.revoked = true;
    }
    if (cfg.check === "version") userVer++;
    user.active = false;
    log.push({ t, type: "revoke", how: cfg.revoke, band: user.band, ver: userVer, denied });
  }

  function step(e) {
    now = e.t;
    switch (e.k) {
      case "userDepart": userDepart(e.t); break;
      case "userOffice": userOffice(e.t, e.x); break;
      case "userGate": userGate(e.t, e.x); break;
      case "thiefDepart": thiefDepart(e.t); break;
      case "thiefOffice": thiefOffice(e.t, e.x); break;
      case "thiefGate": thiefGate(e.t, e.x); break;
      case "revoke": revoke(e.t); break;
    }
  }
  function runTo(T) {
    for (;;) {
      const e = events.peek();
      if (!e || e.t > T) break;
      events.pop();
      step(e);
    }
    now = T;
  }

  login(0, false);
  at(0.2, "userDepart");

  return {
    cfg, st, log, trips, user, thief, deny, runTo,
    get now() { return now; },
    get userVer() { return userVer; },
    /** The visitor's buttons: steal now (at the user's next gate visit), revoke now. */
    stealNow(t) { if (st.theftT < 0) cfg.theftAt = t; },
    revokeNow(t, how) { if (st.revokeT >= 0 || !user.active) return false; cfg.revoke = how; at(t, "revoke"); return true; },
    get done() { return !user.active && !thief.active && st.revokeT >= 0; },
  };
}

// ---------- experiments: headless rounds, averaged over seeds ----------
export const ROUNDS = 400;
export const SEEDS = Array.from({ length: ROUNDS }, (_, i) => i + 1);
// Each round: the theft at a random minute 10 to 130 after login, the revocation 2 to 20 minutes after it.
export const THEFT = [10, 120];
export const NOTICE = [2, 18];
export const DAY = 480;

function scenario(seed) {
  const r = rngMixed(seed * 104729 + 7);
  return { theftAt: THEFT[0] + THEFT[1] * r(), revokeAfter: NOTICE[0] + NOTICE[1] * r() };
}
function round(cfg, seed, horizon) {
  const sc = scenario(seed);
  const m = makeFestival({ ...cfg, ...sc }, seed);
  m.runTo(horizon ?? sc.theftAt + sc.revokeAfter + cfg.ttl + 60);
  return m;
}
// After the revocation: how long the stolen wristband kept opening the gate, and how many times it did.
function afterRevoke(cfg) {
  const ms = SEEDS.map((s) => round(cfg, s));
  const win = ms.map((m) => (m.st.lastAfter >= 0 ? m.st.lastAfter - m.st.revokeT : 0));
  const life = ms.map((m) => (m.st.lastThief >= 0 ? m.st.lastThief - m.st.theftT : 0));
  return {
    window: mean(win), max: Math.max(...win), share: mean(win.map((w) => (w > 0 ? 1 : 0))), life: mean(life),
    entries: mean(ms.map((m) => m.st.thiefAfter)),
    lookups: mean(ms.map((m) => m.st.lookups)), requests: mean(ms.map((m) => m.st.requests)),
    denyMax: Math.max(...ms.map((m) => m.st.denyMax)),
  };
}
// A day of the user alone: box-office visits per hour.
function day(cfg) {
  const ms = SEEDS.slice(0, 100).map((s) => { const m = makeFestival({ ...cfg, steal: "none", revoke: "none" }, s); m.runTo(DAY); return m; });
  return { refreshes: mean(ms.map((m) => m.st.refreshes)) / (DAY / 60), logins: mean(ms.map((m) => m.st.logins - 1)) / (DAY / 60), visits: mean(ms.map((m) => m.st.requests)) / (DAY / 60) };
}

// 1. Logging out with a stateless gate: the copy taken before the logout.
export function logoutRun() {
  return { stamp: afterRevoke({ ttl: 60, refresh: "rotate", check: "stamp", steal: "band", revoke: "logout" }) };
}
// 2. Shorter wristbands, with refresh passes: the window, and the box office's work.
export function ttlRun() {
  const one = (ttl) => ({ ...afterRevoke({ ttl, refresh: "rotate", check: "stamp", steal: "band", revoke: "logout" }), ...day({ ttl, refresh: "rotate", check: "stamp" }) });
  return { long: one(60), short: one(5) };
}
// 3. The thief copies the pass too and nobody notices: how long they stay in, over the day.
export function rotateRun() {
  const one = (refresh) => {
    const ms = SEEDS.map((s) => round({ ttl: 5, refresh, check: "stamp", steal: "both", revoke: "none" }, s, DAY));
    const inside = ms.map((m) => (m.st.lastThief >= 0 ? m.st.lastThief - m.st.theftT : 0));
    return { inside: mean(inside), max: Math.max(...inside), allDay: mean(ms.map((m) => (m.thief.active ? 1 : 0))), forced: mean(ms.map((m) => m.st.forced)), reuse: mean(ms.map((m) => m.st.reuse)), left: mean(ms.map((m) => DAY - m.st.theftT)) };
  };
  return { reuse: one("reuse"), rotate: one("rotate") };
}
// 4. A deny list the gate checks on every request.
export function denyRun() {
  const one = (check) => afterRevoke({ ttl: 60, refresh: "rotate", check, steal: "band", revoke: "logout" });
  return { stamp: one("stamp"), deny: one("deny") };
}
// 5. A password reset from another device: deny list vs a per-user token version.
export function resetRun() {
  const one = (check) => afterRevoke({ ttl: 60, refresh: "rotate", check, steal: "band", revoke: "reset" });
  return { deny: one("deny"), version: one("version") };
}

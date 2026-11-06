// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// Password hashing: a stolen table of hashes, a cracking rig that guesses against it, and the login desk that pays the
// same price per login. Seeded, shared by the live figure and the experiments.
//
// Every number for speed is an illustrative, rounded order of magnitude, not a benchmark:
//   rig     guesses per second on one high-end GPU
//   server  seconds of one server core per hash (one login = one hash)
// The work factor multiplies the cost of every hash, the attacker's and yours alike (bcrypt cost +2 = ×4; for PBKDF2 and
// Argon2id, 4× the iterations or passes). SHA-256 has no work factor.
//
// Users and their passwords. The attacker guesses in the order that cracks the most accounts first: the most common
// passwords, then patterns (a word plus digits, a name and a year), then brute force. A password's guess number is how
// many guesses that order takes to reach it. "people" is a made-up mix shaped like published leaks:
//   30%  from a list of the million most common passwords, each rank about as likely as all the ranks after it up to
//        twice its number (log-uniform: "123456" is about 5% of these, rank 100 about 0.05%)
//   40%  patterns: guess numbers spread evenly on a log scale from a million to a trillion (10^6 to 10^12)
//   30%  strong ones: 10^12 to 10^20 (long random strings, passphrases)
// "rand8", "rand12": every user has a random password of that length; the attacker brute-forces that whole space.
//
// Salt: with a per-user salt, each guess must be hashed once per user still standing, so reaching guess number g costs
// the sum over users of min(g, their guess number). Without salt one hash of a guess is compared with every row at
// once, and users with the same password have the same hash.

import { rng, fnv1a } from "../../lib/random";
import { averageOver } from "../../lib/stats";

export const HASHES = {
  sha256: { rig: 1e10, server: 1e-6, work: false },
  pbkdf2: { rig: 1e4, server: 0.1, work: true },      // 600,000 iterations of HMAC-SHA-256
  bcrypt: { rig: 5e3, server: 0.05, work: true },     // cost 10
  argon2id: { rig: 1e3, server: 0.03, work: true },   // 19 MiB of memory, 2 passes
};
export const WORKS = [1, 4, 16];
export const POLICY = { rand8: 94 ** 8, rand12: 26 ** 12 };
export const N = 1000;
export const CORES = 4;
export const YEAR = 365.25 * 86400;
export const DAY = 86400;
export const COMMON = ["123456", "password", "123456789", "12345678", "qwerty", "111111", "12345", "abc123", "iloveyou", "dragon"];

export const rigRate = (hash, work = 1) => HASHES[hash].rig / (HASHES[hash].work ? work : 1);
export const hashSecs = (hash, work = 1) => HASHES[hash].server * (HASHES[hash].work ? work : 1);

/** One user's password: its guess number and an identity (equal identities = the same password). */
function pick(r, policy, i) {
  if (policy === "rand8" || policy === "rand12") return { g: Math.max(1, r() * POLICY[policy]), id: "u" + i, kind: "random" };
  const u = r();
  if (u < 0.3) { const g = Math.floor(1e6 ** r()); return { g, id: "p" + g, kind: "common" }; }
  if (u < 0.7) return { g: 10 ** (6 + 6 * r()), id: "u" + i, kind: "pattern" };
  return { g: 10 ** (12 + 8 * r()), id: "u" + i, kind: "strong" };
}

const hex = (h, n) => (h >>> 0).toString(16).toUpperCase().padStart(8, "0").slice(0, n);

/** A table of n users; cfg: { hash, work, salt, policy }. Each user gets the attacker time at which it falls. */
export function makeTable(cfg, seed = 1, n = N) {
  const r = rng(seed * 2654435761 + 7);
  const users = [];
  for (let i = 0; i < n; i++) {
    const p = pick(r, cfg.policy, i);
    const salt = Math.floor(r() * 4294967296);
    const input = p.id + (cfg.salt ? ":" + salt : "");
    users.push({ i, ...p, salt, input, hash: hex(fnv1a(input), 4), saltText: hex(salt, 2), t: 0 });
  }
  const rate = rigRate(cfg.hash, cfg.work);
  // users by guess number, and the sum of the guess numbers before each (to turn hashes into guess depth)
  const order = [...users].sort((a, b) => a.g - b.g);
  const before = [];
  if (cfg.salt) {
    // sweep guess numbers in order; each guess is hashed once for every user not yet cracked
    let sum = 0;
    order.forEach((u, k) => { before.push(sum); u.t = (sum + (n - k) * u.g) / rate; sum += u.g; });
  } else for (const u of users) u.t = u.g / rate;
  const times = users.map((u) => u.t).sort((a, b) => a - b);
  // rows whose hash is the same as another row's (only possible without salt: same password, same hash)
  const count = new Map();
  for (const u of users) count.set(u.input, (count.get(u.input) || 0) + 1);
  const shared = users.filter((u) => count.get(u.input) > 1).length;
  return { cfg, users, times, rate, shared, order, before };
}

export const crackedBy = (table, T) => { let lo = 0, hi = table.times.length; while (lo < hi) { const m = (lo + hi) >> 1; if (table.times[m] <= T) lo = m + 1; else hi = m; } return lo; };
export const halfTime = (table) => table.times[Math.floor(table.times.length / 2)];
/** How far down the guess list the rig has got after T seconds: its hashes so far without a salt, fewer with one
 *  (each guess is hashed once for every row still standing, so k rows cracked leaves n - k hashes per guess). */
export function guessesBy(table, T) {
  const H = T * table.rate;
  if (!table.cfg.salt) return H;
  const n = table.users.length, k = crackedBy(table, T);
  if (k >= n) return table.order[n - 1].g;
  return (H - table.before[k]) / (n - k);
}

/** The eight rows the vault shows: the first pair of users with the same password, then six spread from the weakest
 *  password to the strongest (by guess number). */
export function shownRows(table) {
  const byId = new Map();
  let pair = null;
  for (const u of table.users) {
    if (u.kind !== "common") continue;
    if (byId.has(u.id)) { pair = [byId.get(u.id), u]; break; }
    byId.set(u.id, u);
  }
  const taken = new Set(pair ? pair.map((u) => u.i) : []);
  const sorted = [...table.users].sort((a, b) => a.g - b.g).filter((u) => !taken.has(u.i));
  const want = 8 - taken.size;
  const rest = [];
  for (let k = 0; k < want; k++) rest.push(sorted[Math.min(sorted.length - 1, Math.floor(((k + 0.5) / want) * sorted.length))]);
  // letters in the order of the rows' positions in the table
  return [...(pair || []), ...rest].sort((a, b) => a.i - b.i);
}

/** What a cracked row's password looks like in the readout. */
export function passwordText(u) {
  if (u.kind === "common") return u.g <= COMMON.length ? { en: '"' + COMMON[u.g - 1] + '"', es: '"' + COMMON[u.g - 1] + '"' } : { en: "common password no. " + Math.round(u.g).toLocaleString("en"), es: "contraseña común n.º " + Math.round(u.g).toLocaleString("en") };
  if (u.kind === "pattern") return { en: "a word-and-digits pattern", es: "un patrón de palabra y dígitos" };
  if (u.kind === "strong") return { en: "a long, rare password", es: "una contraseña larga y rara" };
  return { en: "a random password", es: "una contraseña aleatoria" };
}

// ---------- durations, in words ----------
const UNITS = [[YEAR, "year", "years", "año", "años"], [DAY, "day", "days", "día", "días"], [3600, "hour", "hours", "hora", "horas"], [60, "minute", "minutes", "minuto", "minutos"], [1, "second", "seconds", "segundo", "segundos"]];
function num(x) {
  const v = x < 10 ? Math.round(x * 10) / 10 : Math.round(x);
  return v >= 1000 ? v.toLocaleString("en") : String(v);
}
/** A duration for the cards: "53 seconds", "3.4 years", "110 years", "20 million years", "8 ms". */
export function dur(s) {
  if (s < 1) {
    if (s < 1e-3) return { en: "under a millisecond", es: "menos de un milisegundo" };
    const ms = num(s * 1000);
    return { en: ms + " ms", es: ms + " ms" };
  }
  if (s >= 1e6 * YEAR) {
    const m = num(s / YEAR / 1e6);
    return { en: m + " million years", es: m + " millones de años" };
  }
  for (const [u, one, many, uno, varios] of UNITS) {
    if (s >= u) {
      const v = num(s / u), single = v === "1";
      return { en: v + " " + (single ? one : many), es: v + " " + (single ? uno : varios) };
    }
  }
}

// ---------- the login desk: logins queue for the server's cores ----------
// Poisson arrivals at `rate` a second; each login is one hash on one of `cores` cores, first come first served.
export function makeServer(cfg, seed = 1) {
  const r = rng(seed * 40503 + 11);
  const cores = Array.from({ length: cfg.cores || CORES }, () => ({ busy: null, until: 0 }));
  const line = [];
  const log = [];
  let t = 0, next = -Math.log(1 - r()) / cfg.rate, id = 0;
  const st = { arrived: 0, served: 0, busyTime: 0, waits: [] };
  const svc = () => cfg.hashSecs * (0.9 + 0.2 * r());
  function startFree(at) {
    for (const c of cores) {
      if (c.busy || !line.length) continue;
      const L = line.shift();
      c.busy = L; L.start = at; c.until = at + svc();
      log.push({ t: at, type: "start", id: L.id });
    }
  }
  function runTo(until) {
    for (;;) {
      let when = next, who = null;
      for (const c of cores) if (c.busy && c.until < when) { when = c.until; who = c; }
      if (when > until) break;
      // core time used up to this event
      for (const c of cores) if (c.busy) st.busyTime += when - t;
      t = when;
      if (who) {
        const L = who.busy;
        L.done = t; who.busy = null; st.served++;
        st.waits.push([L.born, L.done - L.born]);
        log.push({ t, type: "done", id: L.id, user: L.user, core: cores.indexOf(who), total: L.done - L.born });
      } else {
        line.push({ id: ++id, born: t, user: Math.floor(r() * 8) });
        st.arrived++;
        next = t + -Math.log(1 - r()) / cfg.rate;
      }
      startFree(t);
    }
    for (const c of cores) if (c.busy) st.busyTime += until - t;
    t = until;
  }
  // n logins at once (a burst), at time `at`
  function burst(at, n) {
    runTo(at);
    for (let i = 0; i < n; i++) { line.push({ id: ++id, born: at, user: Math.floor(r() * 8) }); st.arrived++; }
    startFree(at);
  }
  return { cfg, cores, line, log, st, runTo, burst, get t() { return t; } };
}

// ---------- experiments: headless runs averaged over seeds ----------
const SEEDS = [11, 23, 37, 41, 59, 67, 73, 89];
const avg = (fn) => averageOver(SEEDS, fn);
const table = (cfg) => (seed) => makeTable({ work: 1, salt: true, policy: "people", ...cfg }, seed);

// 1. Fast vs slow: how long until half of a salted table of 1,000 falls, on one GPU.
export function fastRun() {
  const half = (hash) => avg((seed) => { const tb = table({ hash })(seed); return { half: halfTime(tb), day: crackedBy(tb, DAY) / N }; });
  return { sha: half("sha256"), bcrypt: half("bcrypt"), argon: half("argon2id"), rates: { sha: rigRate("sha256"), bcrypt: rigRate("bcrypt"), argon: rigRate("argon2id") } };
}

// 2. Salt: PBKDF2 with a per-user salt vs no salt.
export function saltRun() {
  const run = (salt) => avg((seed) => { const tb = table({ hash: "pbkdf2", salt })(seed); return { half: halfTime(tb), shared: tb.shared, day: crackedBy(tb, DAY) / N }; });
  const off = run(false), on = run(true);
  return { off, on, ratio: on.half / off.half };
}

// 3. Work factor ×1, ×4, ×16 on bcrypt: what a 30-day attack cracks, and what one login costs.
export function workRun() {
  const run = (work) => avg((seed) => { const tb = table({ hash: "bcrypt", work })(seed); return { month: crackedBy(tb, 30 * DAY) / N, hour: crackedBy(tb, 3600) / N, common: tb.users.filter((u) => u.kind === "common").length / N, login: hashSecs("bcrypt", work) }; });
  return { w1: run(1), w4: run(4), w16: run(16) };
}

// 4. A login spike on 4 cores with bcrypt (cost 10): 20 logins a second vs 200, for a minute.
export function spikeRun() {
  const run = (rate, hash = "bcrypt") => avg((seed) => {
    const s = makeServer({ rate, hashSecs: hashSecs(hash), cores: CORES }, seed);
    s.runTo(60);
    const late = s.st.waits.filter(([born]) => born >= 50).map(([, w]) => w);
    // a login arriving at the one-minute mark waits for everyone in line ahead of it
    const lineAt60 = s.line.length;
    const wait60 = lineAt60 * hashSecs(hash) / CORES + hashSecs(hash);
    return { cpu: s.st.busyTime / (60 * CORES), served: s.st.served / 60, line: lineAt60, late: late.length ? late.reduce((a, b) => a + b, 0) / late.length : wait60, wait60 };
  });
  return { calm: run(20), spike: run(200), sha: run(200, "sha256"), capacity: CORES / hashSecs("bcrypt") };
}

// 5. Random passwords, SHA-256 with salt: 8 characters from all 94 printable vs 12 lowercase letters.
export function lengthRun() {
  const run = (policy) => avg((seed) => { const tb = table({ hash: "sha256", policy })(seed); return { half: halfTime(tb), one: POLICY[policy] / 2 / rigRate("sha256") }; });
  return { r8: run("rand8"), r12: run("rand12") };
}

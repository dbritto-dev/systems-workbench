// Shared model for the figure and the experiments. Time is in seconds of figure time.
// Each train is one request (a customer order) from one of 100 users.
export const RATE = 1.2;          // trains per second on the main line
export const NOISE = 0.001;       // background failure rate of both versions (timeouts, flaky networks)
export const USERS = 100;
export const INTERVAL = 180;      // the rollback arm checks the canary every 3 minutes
export const BUILDS = {
  good: { err: 0, wrong: 0 },
  bad: { err: 0.2, wrong: 0 },      // 1 in 5 orders fails
  rare: { err: 0.005, wrong: 0 },   // 1 in 200 orders fails
  silent: { err: 0, wrong: 0.3 },   // no failures, but 3 in 10 orders get the wrong price
};
export const RULES = {
  tight: { threshold: 0.0015, minFailures: 1 },
  normal: { threshold: 0.004, minFailures: 3 },
  loose: { threshold: 0.02, minFailures: 5 },
};
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
// Sticky routing: every user has a fixed bucket 0..99; buckets below the canary % go to the new track.
export const bucketOf = (user) => (user * 37 + 11) % 100;

export function newDeploy({ pct = 5, build = "good", auto = true, rule = "normal", routing = "random", check = "errors" } = {}) {
  return {
    pct, build, auto, rule, routing, check,
    t: 0, nextArrival: null, nextCheck: INTERVAL,
    decision: "watching", decidedAt: null,
    old: { req: 0, err: 0 }, nw: { req: 0, err: 0, wrong: 0 },
    hitAtDecision: null, seen: new Uint8Array(USERS + 1), mixed: 0, active: 0,
  };
}
export const canaryFailures = (d) => d.nw.err + (d.check === "price" ? d.nw.wrong : 0);
export const canaryRate = (d) => (d.nw.req ? canaryFailures(d) / d.nw.req : 0);
export const hitCount = (d) => d.nw.err + d.nw.wrong;

function request(d, random) {
  const user = 1 + Math.floor(random() * USERS);
  const canary = d.routing === "sticky" ? bucketOf(user) < d.pct : random() * 100 < d.pct;
  const before = d.seen[user];
  d.seen[user] |= canary ? 2 : 1;
  if (!before) d.active++;
  if (before !== 3 && d.seen[user] === 3) d.mixed++;
  if (!canary) {
    const failed = random() < NOISE;
    d.old.req++; if (failed) d.old.err++;
    return { user, canary, failed, wrong: false };
  }
  const bug = BUILDS[d.build];
  const failed = random() < NOISE + bug.err;
  const wrong = !failed && random() < bug.wrong;
  d.nw.req++; if (failed) d.nw.err++; if (wrong) d.nw.wrong++;
  return { user, canary, failed, wrong };
}

export function decide(d, decision) {
  if (d.decision !== "watching") return;
  d.decision = decision; d.decidedAt = d.t; d.hitAtDecision = hitCount(d);
  d.pct = decision === "promoted" ? 100 : 0;
}

// The rollback arm: at every check, enough failures AND a failure rate above the threshold.
function check(d) {
  if (!d.auto || d.decision !== "watching" || d.pct === 0) return false;
  const rule = RULES[d.rule];
  const fails = canaryFailures(d);
  if (fails >= rule.minFailures && fails / Math.max(1, d.nw.req) > rule.threshold) { decide(d, "rolled back"); return true; }
  return false;
}

// Move the deploy forward by dt seconds. onRequest/onEvent are optional (the figure uses them).
export function advance(d, dt, random, onRequest, onEvent) {
  const end = d.t + dt;
  if (d.nextArrival === null) d.nextArrival = d.t - Math.log(1 - random()) / RATE;
  while (true) {
    const next = Math.min(d.nextArrival, d.nextCheck);
    if (next > end) break;
    d.t = next;
    if (next === d.nextCheck) {
      d.nextCheck += INTERVAL;
      if (check(d) && onEvent) onEvent("rolled back");
    } else {
      const r = request(d, random);
      if (onRequest) onRequest(r);
      d.nextArrival = d.t - Math.log(1 - random()) / RATE;
    }
  }
  d.t = end;
}

// Headless run used by the experiments. promoteAt: a person promotes the canary at that time if it is still being watched.
export function runDeploy({ seed = 1, duration = 3600, promoteAt = null, stopAtDecision = false, ...options }) {
  const random = rng(seed);
  const d = newDeploy(options);
  const step = 30;
  while (d.t < duration) {
    if (promoteAt !== null && d.t >= promoteAt && d.decision === "watching") decide(d, "promoted");
    advance(d, Math.min(step, duration - d.t), random);
    if (stopAtDecision && d.decision !== "watching") break;
  }
  return d;
}

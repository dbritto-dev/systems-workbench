// Shared model for the figure and the experiments. Time is counted in gossip rounds.
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

const randomPeer = (random, n, i) => { let j = Math.floor(random() * (n - 1)); if (j >= i) j++; return j; };
const delayOf = (random, slow) => (slow > 0 && random() < slow ? 1 + Math.floor(random() * 3) : 0);

// One rumour spreading through n houses. Each round, a house that knows it (push) tells `fanout`
// random houses; in pull, every house asks `fanout` random houses and hears it if they know;
// push-pull does both in one exchange. Messages can be lost (`loss`) or arrive late (`slow`).
// mode: "push" | "pull" | "push-pull"
export function makeSpread({ n, fanout = 1, mode = "push", loss = 0, slow = 0, alive = null, start = 0 }, seed = 7) {
  const random = rng(seed);
  const live = alive ? alive.slice() : new Array(n).fill(true);
  const knows = new Uint8Array(n);
  knows[start] = 1;
  const late = [];
  let round = 0, messages = 0;
  const liveCount = () => live.reduce((s, a) => s + (a ? 1 : 0), 0);
  const knownCount = () => { let c = 0; for (let i = 0; i < n; i++) if (live[i] && knows[i]) c++; return c; };
  function deliver(to, events, ev) { if (live[to] && !knows[to]) { knows[to] = 2; ev.informs = true; } events.push(ev); }
  function step() {
    round++;
    const before = knows.slice();
    const events = [];
    for (let k = late.length - 1; k >= 0; k--) if (late[k].at <= round) { const m = late.splice(k, 1)[0]; deliver(m.to, events, { ...m.ev, arrives: true }); }
    const send = (from, to, carries) => {
      messages++;
      if (random() < loss) { if (carries) events.push({ from, to, lost: true }); return; }
      const d = delayOf(random, slow);
      if (!carries) return;
      const ev = { from, to, delay: d };
      if (d > 0) { late.push({ at: round + d, to, ev }); events.push({ from, to, delay: d, slow: true }); }
      else deliver(to, events, ev);
    };
    for (let i = 0; i < n; i++) {
      if (!live[i]) continue;
      const pushes = mode !== "pull" && before[i];
      const pulls = mode !== "push";
      if (!pushes && !pulls) continue;
      for (let f = 0; f < fanout; f++) {
        const j = randomPeer(random, n, i);
        if (mode === "push") { send(i, j, true); continue; }
        // pull and push-pull: i contacts j; the request itself is one message
        messages++;
        if (random() < loss) continue;
        if (!live[j]) continue;
        if (mode === "push-pull" && before[i] && !before[j]) { const d = delayOf(random, slow); const ev = { from: i, to: j, delay: d }; if (d > 0) { late.push({ at: round + d, to: j, ev }); events.push({ ...ev, slow: true }); } else deliver(j, events, ev); }
        if (before[j]) send(j, i, true);
      }
    }
    for (let i = 0; i < n; i++) if (knows[i] === 2) knows[i] = 1;
    return events;
  }
  const done = () => knownCount() >= liveCount();
  return { step, done, knows, live, get round() { return round; }, get messages() { return messages; }, knownCount, liveCount };
}

// Run one rumour to the end (or `cap` rounds). curve[r] = share of live houses that know after round r.
export function spreadRun(opts, seed = 7, cap = 400) {
  const s = makeSpread(opts, seed);
  const curve = [s.knownCount() / s.liveCount()];
  while (!s.done() && s.round < cap) { s.step(); curve.push(s.knownCount() / s.liveCount()); }
  const ninety = curve.findIndex((c) => c >= 0.9);
  return { rounds: s.round, messages: s.messages, curve, tail: s.round - ninety, reachedAll: s.done() };
}

export function spreadAverage(opts, seeds = 40) {
  let rounds = 0, messages = 0, tail = 0, worst = 0, reached = 0;
  for (let k = 1; k <= seeds; k++) { const r = spreadRun(opts, k * 7919); rounds += r.rounds; messages += r.messages; tail += r.tail; worst = Math.max(worst, r.rounds); reached += r.reachedAll ? 1 : 0; }
  return { rounds: rounds / seeds, messages: messages / seeds, tail: tail / seeds, worst, reached: reached / seeds };
}

// Membership by gossip: every round each live house bumps its own heartbeat and sends its whole
// heartbeat table to `fanout` random houses, which keep the newest value they have seen for each house.
// A house silent for more than timeout/2 rounds is "suspected"; for more than `timeout` rounds, "dead".
export function makeMembership({ n, fanout = 2, loss = 0, slow = 0, timeout = 8 }, seed = 7) {
  const random = rng(seed);
  const alive = new Array(n).fill(true);
  const beat = Array.from({ length: n }, () => new Float64Array(n));
  const seen = Array.from({ length: n }, () => new Float64Array(n));
  const inflight = [];
  let round = 0;
  const cfg = { fanout, loss, slow, timeout };
  function step() {
    round++;
    for (let i = 0; i < n; i++) if (alive[i]) { beat[i][i] = round; seen[i][i] = round; }
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      for (let f = 0; f < cfg.fanout; f++) {
        const j = randomPeer(random, n, i);
        if (random() < cfg.loss) continue;
        inflight.push({ at: round + delayOf(random, cfg.slow), to: j, table: beat[i].slice() });
      }
    }
    for (let k = inflight.length - 1; k >= 0; k--) {
      const m = inflight[k];
      if (m.at > round) continue;
      inflight.splice(k, 1);
      if (!alive[m.to]) continue;
      const mine = beat[m.to], when = seen[m.to];
      for (let x = 0; x < n; x++) if (m.table[x] > mine[x]) { mine[x] = m.table[x]; when[x] = round; }
    }
  }
  function view(i, j) {
    if (i === j) return "alive";
    const age = round - seen[i][j];
    return age > cfg.timeout ? "dead" : age > cfg.timeout / 2 ? "suspected" : "alive";
  }
  return { step, view, alive, cfg, get round() { return round; } };
}

// Failure detection trade-off: false alarms on healthy houses, and how long a real failure takes to be noticed.
export function detectionRun({ n = 40, fanout = 2, slow = 0.3, loss = 0, timeout = 8 }, seed = 7) {
  const healthy = makeMembership({ n, fanout, slow, loss, timeout }, seed);
  const wronged = new Set();
  for (let r = 0; r < 120; r++) {
    healthy.step();
    if (r < 10) continue;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && healthy.view(i, j) === "dead") wronged.add(j);
  }
  const m = makeMembership({ n, fanout, slow, loss, timeout }, seed + 1);
  for (let r = 0; r < 30; r++) m.step();
  const victim = 1;
  m.alive[victim] = false;
  let detected = null;
  for (let r = 1; r <= 200 && detected === null; r++) {
    m.step();
    let all = true;
    for (let i = 0; i < n; i++) if (m.alive[i] && m.view(i, victim) !== "dead") { all = false; break; }
    if (all) detected = r;
  }
  return { falseDead: wronged.size, detect: detected ?? 200 };
}

export function detectionAverage(opts, seeds = 12) {
  let falseDead = 0, detect = 0;
  for (let k = 1; k <= seeds; k++) { const r = detectionRun(opts, k * 104729); falseDead += r.falseDead; detect += r.detect; }
  return { falseDead: falseDead / seeds, detect: detect / seeds };
}

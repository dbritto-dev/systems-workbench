// Shared model for the figure and the experiments: five shops (pods) on a street, one warehouse (the database).
// Times in seconds. The figure and every experiment step this same model.
export const SHOPS = 5;
export const DT = 0.1;
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function poisson(random, mean) {
  if (mean <= 0) return 0;
  if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())));
  const L = Math.exp(-mean); let k = 0, p = 1;
  do { k++; p *= random(); } while (p > L);
  return k - 1;
}

// readiness / liveness: "off" | "shop" | "deps" (the shop and the warehouse).
export const DEFAULTS = {
  load: 0.5,            // share of the street's total capacity
  capacity: 20,         // requests per second one shop serves
  readiness: "shop",
  liveness: "shop",
  timeout: 5,           // liveness probe timeout, seconds
  threshold: 3,         // consecutive failures before a restart
  period: 3,            // seconds between probes
  initialDelay: 10,     // liveness waits this long after the container starts (no startup probe)
  startupProbe: false,
  startupBudget: 120,   // a startup probe gives up after this long
  boot: 12,             // seconds until the process answers at all
  warm: 10,             // seconds stocking shelves (caches, connections) before it can serve
  restartDelay: 2,      // tearing down and starting the container again
  backoffBase: 10,      // CrashLoopBackOff: 10, 20, 40, 80 s between repeated restarts
  backoffMax: 80,
  clientTimeout: 8,     // a customer gives up after waiting this long in a queue
};

export function makeSim(options = {}, seed = 7) {
  const cfg = { ...DEFAULTS, ...options };
  const random = rng(seed);
  const shops = Array.from({ length: SHOPS }, (_, i) => ({
    i, phase: "run", phaseT: 0, backlog: 0, fails: 0, restarts: 0, inRow: 0, runFor: 999,
    started: true, nextProbe: 0.6 * i + 0.3, ready: true, lastWait: 0, checkFailed: false, lastProbe: -1,
  }));
  const sim = { cfg, shops, t: 0, warehouseUp: true, warehouseUntil: 0, random,
    totals: { arrived: 0, served: 0, errors: 0, restarts: 0 }, events: [], series: [], lastDisruption: null, recovered: null };
  const say = (text, shop) => { sim.events.push({ t: sim.t, text, shop }); if (sim.events.length > 50) sim.events.shift(); };
  const running = (s) => s.phase === "boot" || s.phase === "warm" || s.phase === "run" || s.phase === "dead";
  const responds = (s) => s.phase === "warm" || s.phase === "run";
  const wait = (s) => s.backlog / cfg.capacity + 0.05;

  function startContainer(s) { s.phase = "boot"; s.phaseT = 0; s.fails = 0; s.started = !cfg.startupProbe; s.nextProbe = sim.t + cfg.period; s.backlog = 0; s.ready = false; }
  function restart(s, why) {
    sim.totals.errors += Math.round(s.backlog); s.backlog = 0;
    s.restarts++; sim.totals.restarts++; s.inRow++;
    const backoff = s.inRow > 1 ? Math.min(cfg.backoffBase * 2 ** (s.inRow - 2), cfg.backoffMax) : 0;
    s.phase = "down"; s.phaseT = 0; s.downFor = cfg.restartDelay + backoff; s.ready = false; s.fails = 0;
    say("shop " + (s.i + 1) + " · " + why + (backoff ? " · back-off " + backoff + " s" : ""), s.i);
  }
  sim.restartShop = (i, why = "restarted by a deploy") => { const s = shops[i]; s.inRow = 0; restart(s, why); s.inRow = 0; s.restarts--; sim.totals.restarts--; sim.disrupt(); };
  sim.deadlock = (i) => { const s = shops[i]; if (s.phase === "run" || s.phase === "warm") { s.phase = "dead"; s.phaseT = 0; say("shop " + (i + 1) + " · stuck: answers nothing", i); sim.disrupt(); } };
  sim.blip = (seconds = 30) => { sim.warehouseUp = false; sim.warehouseUntil = sim.t + seconds; say("warehouse down for " + seconds + " s"); sim.disrupt(); };
  sim.disrupt = () => { sim.lastDisruption = sim.t; sim.recovered = null; };

  function probe(s) {
    s.lastProbe = sim.t;
    const answered = responds(s) && wait(s) <= cfg.timeout;
    s.lastWait = wait(s);
    // Startup probe: liveness and readiness wait until the process answers once.
    if (!s.started) {
      if (answered) { s.started = true; say("shop " + (s.i + 1) + " · startup probe passed", s.i); }
      else if (s.phaseT > cfg.startupBudget && s.phase === "boot") restart(s, "startup probe gave up");
      return;
    }
    // Liveness.
    const sinceStart = s.containerAge;
    if (cfg.liveness !== "off" && (cfg.startupProbe || sinceStart >= cfg.initialDelay)) {
      const alive = answered && (cfg.liveness !== "deps" || sim.warehouseUp);
      s.checkFailed = !alive;
      if (alive) s.fails = 0;
      else if (++s.fails >= cfg.threshold) { restart(s, "liveness failed " + s.fails + "× · restarting"); return; }
    } else s.checkFailed = false;
  }

  function readiness(s) {
    if (!running(s)) return false;
    if (cfg.readiness === "off") return true;                 // no probe: in rotation as soon as the container runs
    if (!s.started) return false;
    const answered = responds(s) && s.phase === "run" && s.lastWait <= cfg.timeout + 2;
    return answered && (cfg.readiness !== "deps" || sim.warehouseUp);
  }

  sim.step = () => {
    const dt = DT;
    sim.t += dt;
    if (!sim.warehouseUp && sim.t >= sim.warehouseUntil) { sim.warehouseUp = true; say("warehouse back"); }
    for (const s of shops) {
      s.phaseT += dt;
      if (running(s)) s.containerAge = (s.containerAge || 0) + dt; else s.containerAge = 0;
      if (s.phase === "down" && s.phaseT >= s.downFor) { startContainer(s); s.containerAge = 0; }
      if (s.phase === "boot" && s.phaseT >= cfg.boot) { s.phase = "warm"; s.phaseT = 0; }
      if (s.phase === "warm" && s.phaseT >= cfg.warm) { s.phase = "run"; s.phaseT = 0; say("shop " + (s.i + 1) + " · stocked and running", s.i); }
      if (s.phase === "run") { s.runFor = (s.runFor || 0) + dt; if (s.runFor > 60) s.inRow = 0; } else s.runFor = 0;
      if (running(s) && sim.t >= s.nextProbe) { s.nextProbe += cfg.period; probe(s); }
      // Readiness is probed on the same period; between probes the endpoint list keeps its last answer.
      if (s.readyAt === undefined || sim.t >= s.readyAt) { s.ready = readiness(s); s.readyAt = sim.t + (cfg.readiness === "off" ? 0 : cfg.period); }
      if (!running(s)) s.ready = false;
    }
    // Customers: the warden sends each one to a shop on the endpoint list.
    const endpoints = shops.filter((s) => s.ready);
    const arrivals = poisson(random, cfg.load * SHOPS * cfg.capacity * dt);
    sim.totals.arrived += arrivals;
    const share = new Array(SHOPS).fill(0);
    sim.noEndpoint = !endpoints.length;
    if (endpoints.length) for (let n = 0; n < arrivals; n++) share[endpoints[Math.floor(random() * endpoints.length)].i]++;
    let served = 0, errors = endpoints.length ? 0 : arrivals;
    for (const s of shops) {
      const a = share[s.i];
      if (s.phase !== "run") { errors += a; continue; }              // booting, stocking, stuck: the customer fails
      if (!sim.warehouseUp) { errors += a + Math.round(s.backlog); s.backlog = 0; continue; } // every order needs the warehouse
      s.backlog += a;
      const done = Math.min(s.backlog, cfg.capacity * dt);
      s.backlog -= done; served += done;
      const limit = cfg.capacity * cfg.clientTimeout;
      if (s.backlog > limit) { errors += s.backlog - limit; s.backlog = limit; }
    }
    sim.totals.served += served; sim.totals.errors += errors;
    sim.lastTick = { arrivals, served, errors };
    const allReady = shops.every((s) => s.phase === "run" && s.ready) && sim.warehouseUp;
    if (sim.lastDisruption !== null && sim.recovered === null && allReady && sim.t > sim.lastDisruption + 1) sim.recovered = sim.t;
    sim.series.push(allReady ? 1 : 0);
  };
  sim.runTo = (T) => { while (sim.t < T - 1e-9) sim.step(); };
  sim.readyCount = () => shops.filter((s) => s.ready && s.phase === "run").length;
  return sim;
}

// A scripted run for the experiments: events [[t, fn(sim)]], measured over [0, to].
export function scenario(options, events, to, seed) {
  const sim = makeSim(options, seed);
  const queue = [...events].sort((a, b) => a[0] - b[0]);
  const marks = {};
  while (sim.t < to - 1e-9) {
    while (queue.length && queue[0][0] <= sim.t + 1e-9) queue.shift()[1](sim, marks);
    sim.step();
  }
  return { sim, marks, totals: sim.totals };
}

export function average(fn, seeds = [3, 5, 7, 11]) {
  const runs = seeds.map(fn);
  const keys = Object.keys(runs[0]);
  return Object.fromEntries(keys.map((k) => [k, runs.reduce((s, r) => s + r[k], 0) / runs.length]));
}

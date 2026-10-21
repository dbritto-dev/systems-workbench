// Shared model for the figure and the experiments. Times are in seconds of figure time.
// A ticket office: one window with a few service slots. A fixed crowd of regular clients
// comes back again and again; a trigger sends a rush of one-off visitors at once.
// Every attempt is a ticket in the line. A client that times out walks away and leaves
// its ticket behind: the window still serves it later (wasted work).
export const DEFAULTS = {
  regulars: 17,     // clients who keep coming back
  rush: 16,         // one-off visitors the trigger sends at once
  slots: 3,         // service slots at the window
  service: 1.0,     // mean seconds to serve one ticket (0.7 to 1.3)
  think: 8,         // mean seconds a regular stays away between requests
  timeout: 3,       // seconds a client waits for an answer before giving up on that attempt
  retries: 3,       // retries per layer
  backoff: "none",  // "none" | "exp"
  base: 2,          // first backoff delay
  cap: 16,          // longest backoff delay
  jitter: false,    // jitter: wait a random time around the backoff delay instead of exactly it
  layers: 1,        // how many layers of the stack retry on their own
  budget: false,    // retry budget: retries may be at most ~10% of new requests
  dt: 0.05,
};
export const BUDGET = { perRequest: 0.1, max: 4 };

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export function backoffDelay(cfg, n, random) {
  if (cfg.backoff !== "exp") return 0;
  const full = Math.min(cfg.cap, cfg.base * Math.pow(2, n - 1));
  // Jitter spreads each wait over half to one and a half times the delay, so the average wait stays the same.
  return cfg.jitter ? full * (0.5 + random()) : full;
}

// The whole office. step(dt) advances it; the figure reads clients, tickets, queue and slots.
export function createOffice(options = {}, seed = 7) {
  const cfg = { ...DEFAULTS, ...options };
  const random = rng(seed);
  const o = {
    cfg, random, t: 0, nextTicket: 1, nextClient: 1,
    clients: [], tickets: new Map(), queue: [], slots: new Array(cfg.slots).fill(null),
    tokens: BUDGET.max, slowUntil: -1,
    counts: { requests: 0, attempts: 0, served: 0, goodput: 0, wasted: 0, timeouts: 0, failed: 0, retries: 0, budgetDenied: 0 },
    bins: [], // per whole second: { attempts, goodput, wasted, timeouts, queue }
    events: [], // recent events for the figure: { t, kind, client, ticket }
    triggerAt: null,
  };
  const exp = (mean) => -Math.log(1 - random()) * mean;
  const bin = () => { const i = Math.floor(o.t); while (o.bins.length <= i) o.bins.push({ attempts: 0, goodput: 0, wasted: 0, timeouts: 0, queue: 0 }); return o.bins[i]; };
  const emit = (kind, client, ticket) => { o.events.push({ t: o.t, kind, client: client && client.id, ticket }); if (o.events.length > 400) o.events.splice(0, 200); };

  function addClient(kind) {
    const c = { id: o.nextClient++, kind, phase: "away", until: 0, ticket: null, sent: 0, used: new Array(cfg.layers).fill(0), backoff: 0, benchFrom: 0, gone: false };
    o.clients.push(c);
    return c;
  }
  function attempt(c) {
    const id = o.nextTicket++;
    o.tickets.set(id, { id, client: c.id, joined: o.t, abandoned: false, end: 0 });
    o.queue.push(id);
    c.ticket = id; c.sent = o.t; c.phase = "waiting";
    o.counts.attempts++; bin().attempts++;
    emit("attempt", c, id);
  }
  function newRequest(c) {
    c.used = new Array(cfg.layers).fill(0);
    o.counts.requests++;
    if (cfg.budget) o.tokens = Math.min(BUDGET.max, o.tokens + BUDGET.perRequest);
    attempt(c);
  }
  function done(c, ok) {
    c.ticket = null;
    if (!ok) { o.counts.failed++; emit("failed", c); }
    if (c.kind === "visitor") { c.phase = "leaving"; c.until = o.t + 1.2; c.gone = true; return; }
    c.phase = "away"; c.until = o.t + exp(cfg.think);
  }
  function giveUp(c) {
    // This attempt failed. Find the lowest layer that may still retry.
    for (let l = 0; l < cfg.layers; l++) {
      if (c.used[l] < cfg.retries) {
        if (cfg.budget) {
          if (o.tokens < 1) { o.counts.budgetDenied++; done(c, false); return; }
          o.tokens -= 1;
        }
        c.used[l]++;
        for (let j = 0; j < l; j++) c.used[j] = 0;
        o.counts.retries++;
        const delay = backoffDelay(cfg, c.used[l], random);
        if (delay <= 1e-6) { attempt(c); return; }
        c.phase = "bench"; c.until = o.t + delay; c.backoff = delay; c.benchFrom = o.t;
        emit("bench", c);
        return;
      }
    }
    done(c, false);
  }

  for (let i = 0; i < cfg.regulars; i++) { const c = addClient("regular"); c.until = random() * cfg.think * 1.5; }

  o.trigger = () => {
    o.triggerAt = o.t;
    for (let i = 0; i < cfg.rush; i++) { const c = addClient("visitor"); newRequest(c); }
    emit("trigger");
  };
  o.setConfig = (patch) => {
    Object.assign(cfg, patch);
    if ("slots" in patch) { while (o.slots.length < cfg.slots) o.slots.push(null); }
    if ("layers" in patch) o.clients.forEach((c) => { c.used = new Array(cfg.layers).fill(0); });
  };

  o.step = (dt = cfg.dt) => {
    o.t += dt;
    const byId = (id) => o.clients.find((c) => c.id === id);
    // Finish service.
    o.slots.forEach((id, i) => {
      if (id === null) return;
      const ticket = o.tickets.get(id);
      if (o.t < ticket.end) return;
      o.slots[i] = null; o.counts.served++;
      if (ticket.abandoned) { o.counts.wasted++; bin().wasted++; emit("wasted", null, id); }
      else { const c = byId(ticket.client); o.counts.goodput++; bin().goodput++; emit("served", c, id); done(c, true); }
      o.tickets.delete(id);
    });
    // Fill free slots from the head of the line.
    for (let i = 0; i < cfg.slots; i++) {
      if (o.slots[i] !== null || !o.queue.length) continue;
      const id = o.queue.shift();
      const ticket = o.tickets.get(id);
      ticket.start = o.t; ticket.end = o.t + cfg.service * (0.7 + 0.6 * random());
      o.slots[i] = id;
    }
    // Timeouts, backoff and returns.
    for (const c of o.clients) {
      if (c.phase === "waiting" && o.t - c.sent >= cfg.timeout) {
        const ticket = o.tickets.get(c.ticket);
        if (ticket) ticket.abandoned = true;
        o.counts.timeouts++; bin().timeouts++;
        emit("timeout", c, c.ticket);
        c.ticket = null;
        giveUp(c);
      } else if (c.phase === "bench" && o.t >= c.until) {
        attempt(c);
      } else if (c.phase === "away" && o.t >= c.until) {
        newRequest(c);
      }
    }
    o.clients = o.clients.filter((c) => !(c.phase === "leaving" && o.t >= c.until));
    const b = bin(); b.queue = Math.max(b.queue, o.queue.length);
  };
  return o;
}

// Measure one run: warm up, trigger, watch. Returns numbers for the experiments.
export function runHeadless(options = {}, seed = 7, { warm = 40, after = 120, trigger = true } = {}) {
  const o = createOffice(options, seed);
  const dt = o.cfg.dt;
  while (o.t < warm) o.step(dt);
  const before = { ...o.counts };
  if (trigger) o.trigger();
  const t0 = o.t;
  while (o.t < t0 + after) o.step(dt);
  const delta = Object.fromEntries(Object.keys(o.counts).map((k) => [k, o.counts[k] - before[k]]));
  const bins = o.bins.slice(Math.floor(t0), Math.floor(t0 + after));
  const baseBins = o.bins.slice(10, Math.floor(warm));
  const baseline = baseBins.reduce((s, b) => s + b.attempts, 0) / baseBins.length;
  let lastTimeout = -1;
  bins.forEach((b, i) => { if (b.timeouts) lastTimeout = i; });
  const recovered = lastTimeout < after - 20;
  return {
    baseline,
    peak: Math.max(...bins.slice(2).map((b) => b.attempts)),
    peakQueue: Math.max(...bins.map((b) => b.queue)),
    recovery: lastTimeout < 0 ? 0 : lastTimeout + 1,
    recovered,
    attemptsPerRequest: delta.requests ? delta.attempts / delta.requests : 0,
    goodputShare: delta.served ? delta.goodput / delta.served : 0,
    goodputRate: delta.goodput / after,
    wasted: delta.wasted, failed: delta.failed, timeouts: delta.timeouts, attempts: delta.attempts, requests: delta.requests,
    load: delta.attempts / after,
    series: bins.map((b) => b.attempts),
  };
}

export function average(options, seeds = [3, 5, 7, 11, 13, 17], run = {}) {
  const runs = seeds.map((seed) => runHeadless(options, seed, run));
  const mean = (f) => runs.reduce((s, r) => s + f(r), 0) / runs.length;
  return {
    runs,
    peak: mean((r) => r.peak), recovery: mean((r) => r.recovery), recoveredShare: mean((r) => (r.recovered ? 1 : 0)),
    attemptsPerRequest: mean((r) => r.attemptsPerRequest), goodputShare: mean((r) => r.goodputShare), goodputRate: mean((r) => r.goodputRate),
    load: mean((r) => r.load), baseline: mean((r) => r.baseline), failed: mean((r) => r.failed), wasted: mean((r) => r.wasted),
  };
}

// Shared model for the figure and the experiments: a stream of events (scroll positions, drag
// positions or clicks) passing a gate that decides which ones reach the handler.
// Times are seconds of real (page) time; the figure plays them in slow motion.
export const TRAVEL = 0.05;   // an event ball rolls this long from the hopper to the gate
export const ROLL = 0.035;    // from the gate down to the handler press
export const FALL = 0.03;     // from the gate or the ledge into the discard bin

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// ---------- the gate ----------
// cfg: { mode: "off" | "throttle" | "debounce" | "queue", wait (s), leading, trailing }
// Feed events in time order with event(t, v); advance(t) fires any timer due by t.
// Every event gets a fate: { t, v, ledge (waited before the gate), out (when it left the gate or ledge), call (reached the handler) }.
export function makeGate(cfg) {
  const wait = cfg.wait;
  const g = {
    cfg, events: [], calls: [], segs: [], queue: [], drops: [],
    pending: -1, timerEnd: null, handled: null, worked: 0,
  };
  const call = (i, T) => {
    const e = g.events[i];
    e.out = T; e.call = true;
    g.calls.push({ t: T, i });
    g.handled = i;
    g.worked++;
  };
  const drop = (i, T) => { const e = g.events[i]; e.out = T; e.call = false; g.drops.push(T); };
  const startWindow = (T) => { g.timerEnd = T + wait; g.segs.push([T, T + wait]); };

  function fire(T) {
    const m = cfg.mode;
    if (m === "throttle") {
      if (cfg.trailing && g.pending >= 0) { const i = g.pending; g.pending = -1; call(i, T); startWindow(T); }
      else { if (g.pending >= 0) drop(g.pending, T); g.pending = -1; g.timerEnd = null; }
    } else if (m === "debounce") {
      const i = g.pending; g.pending = -1; g.timerEnd = null;
      if (i >= 0) call(i, T);
    } else if (m === "queue") {
      if (g.queue.length) { call(g.queue.shift(), T); startWindow(T); }
      else g.timerEnd = null;
    }
  }
  g.advance = (t) => { while (g.timerEnd !== null && g.timerEnd <= t) fire(g.timerEnd); };
  g.event = (t, v) => {
    g.advance(t);
    const i = g.events.length;
    const e = { t, v, ledge: false, out: null, call: null };
    g.events.push(e);
    const m = cfg.mode;
    if (m === "off") { call(i, t); return i; }
    if (m === "debounce") {
      if (g.pending >= 0) drop(g.pending, t);
      if (g.segs.length && g.timerEnd !== null) g.segs[g.segs.length - 1][1] = t;   // the timer is wound back
      g.pending = i; e.ledge = true; startWindow(t);
      return i;
    }
    if (m === "queue") {
      if (g.timerEnd === null && !g.queue.length) { call(i, t); startWindow(t); }
      else { e.ledge = true; g.queue.push(i); }
      return i;
    }
    // throttle
    if (g.timerEnd === null) {
      if (cfg.leading) { call(i, t); startWindow(t); }
      else { g.pending = i; e.ledge = true; startWindow(t); }
    } else if (cfg.trailing) {
      if (g.pending >= 0) drop(g.pending, t);
      g.pending = i; e.ledge = true;
    } else drop(i, t);
    return i;
  };
  // The value the handler has acted on: the last handled event's value (positions), or the number of calls (clicks).
  g.finish = () => { while (g.timerEnd !== null) fire(g.timerEnd); };
  return g;
}

// ---------- input streams ----------
// kind: "scroll" (bursts of scrolling with pauses), "drag" (3 s steady drags), "clicks" (bursts of fast clicks).
// rate: events per second while moving. Returns { next(), bursts: [[start, end]] } producing { t, v } in time order.
export function makeStream(kind, seed = 7, { rate = 60, start = 0.2 } = {}) {
  const random = rng(seed * 7919 + 13);
  let t = start, v = kind === "clicks" ? 0 : 300, burstEnd = 0, inBurst = false, dir = 1, clicks = 0;
  const bursts = [];
  const s = { bursts, kind };
  function beginBurst() {
    if (kind === "drag") burstEnd = t + 3;
    else if (kind === "clicks") { clicks = 3 + Math.floor(random() * 4); burstEnd = Infinity; }
    else burstEnd = t + 0.6 + random() * 1.0;
    dir = v > 650 ? -1 : v < 350 ? 1 : random() < 0.5 ? -1 : 1;
    bursts.push([t, t]);
    inBurst = true;
  }
  s.next = () => {
    if (!inBurst) beginBurst();
    const e = { t, v: 0 };
    if (kind === "clicks") { v += 1; e.v = v; }
    else { v = Math.max(0, Math.min(1000, v + dir * (4 + random() * 5) * (60 / rate))); e.v = v; }
    bursts[bursts.length - 1][1] = t;
    // Schedule the next event.
    if (kind === "clicks") {
      clicks--;
      if (clicks > 0) t += 0.13 + random() * 0.09;
      else { inBurst = false; t += 1.0 + random() * 0.8; }
    } else {
      const step = (1 / rate) * (0.85 + random() * 0.3);
      if (t + step > burstEnd) { inBurst = false; t += kind === "drag" ? 1.4 : 0.5 + random() * 0.9; }
      else t += step;
    }
    return e;
  };
  return s;
}

// ---------- a whole run ----------
export function run({ kind = "scroll", rate = 60, mode = "throttle", wait = 0.1, leading = true, trailing = true, duration = 20, cost = 0.006 }, seed = 7) {
  const stream = makeStream(kind, seed, { rate });
  const gate = makeGate({ mode, wait, leading, trailing });
  for (let e = stream.next(); e.t < duration; e = stream.next()) gate.event(e.t, e.v);
  gate.finish();
  const ev = gate.events, n = ev.length, calls = gate.calls.length;
  // Each burst ends at the last event actually fed in (the stream may have planned past the end of the run).
  const bursts = stream.bursts.filter(([a]) => a < duration).map(([a], k, all) => {
    const nextStart = k + 1 < all.length ? all[k + 1][0] : Infinity;
    let b = a;
    for (const e of ev) if (e.t >= a && e.t < nextStart) b = e.t;
    return [a, b];
  });
  const moving = bursts.reduce((s, [a, b]) => s + Math.max(b - a, 1 / rate), 0);
  // For positions, an event is covered when the handler acts on it or on any newer event; its lag is how long that took.
  const lags = [];
  let c = 0;
  for (let i = 0; i < n; i++) {
    while (c < gate.calls.length && gate.calls[c].i < i) c++;
    lags.push(c < gate.calls.length ? gate.calls[c].t - ev[i].t : Infinity);
  }
  const finite = lags.filter(Number.isFinite);
  // Bursts whose final event (where the user stopped) reached the handler before the next burst began.
  let finalHandled = 0, burstIdx = 0;
  const lastOf = bursts.map(([, b]) => ev.findIndex((e) => e.t === b));
  bursts.forEach(([, b], k) => {
    const i = lastOf[k];
    const nextStart = k + 1 < bursts.length ? bursts[k + 1][0] : Infinity;
    if (i >= 0 && ev[i].call && ev[i].out < nextStart) finalHandled++;
    burstIdx++;
  });
  // Updates while the input was moving (calls between the first and last event of a burst, inclusive).
  const during = gate.calls.filter(({ t }) => bursts.some(([a, b]) => t >= a && t <= b + 1e-9)).length;
  const delays = ev.filter((e) => e.call).map((e) => e.out - e.t);
  return {
    n, calls, dropped: ev.filter((e) => e.call === false).length,
    callsPerSec: calls / moving, eventsPerSec: n / moving,
    workPerSec: (calls * cost) / moving,       // seconds of handler work per second of input
    maxLag: finite.length ? Math.max(...finite) : 0, meanLag: finite.length ? finite.reduce((a, b) => a + b, 0) / finite.length : 0,
    finalHandled: bursts.length ? finalHandled / bursts.length : 1, bursts: bursts.length,
    during, duringPerBurst: during / Math.max(1, bursts.length),
    maxDelay: delays.length ? Math.max(...delays) : 0,
  };
}

// Average a run over several seeds.
export function avg(cfg, seeds = 8) {
  const rs = Array.from({ length: seeds }, (_, s) => run(cfg, s + 1));
  const out = {};
  for (const key of Object.keys(rs[0])) out[key] = rs.reduce((a, r) => a + r[key], 0) / rs.length;
  return out;
}

// Debounce model, shared by the live figure and the experiments. Seeded and deterministic.
// Events arrive from an input script (typing, a held key or scroll, double clicks). A debouncer decides
// which events become requests; the server answers each request after a latency; the screen shows
// whatever answer arrives last (the naive rule), unless earlier requests were cancelled.
//   mode "none":     every event is a request
//   mode "trailing": wait until no event for `wait` s, then send once (the latest text); maxWait caps the wait
//   mode "leading":  send on the first event, ignore events until `wait` s of quiet

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const QUERIES = ["distributed systems", "debounce", "event loop", "react hooks", "rate limiter", "kafka offsets", "search box", "idempotency"];

// Input scripts: a generator of { t, text, session, last } plus a list of sessions.
function makeInput(kind, rnd, sessions) {
  let t = 0.4, q = 0, i = 0, n = 0, inSession = null;
  const begin = (final) => { inSession = { start: t, end: t, final, keys: 0, requests: 0, shownAt: null, firstSend: null }; sessions.push(inSession); };
  if (kind === "typing") {
    return () => {
      const query = QUERIES[q % QUERIES.length];
      if (i === 0) begin(query);
      const text = query.slice(0, i + 1);
      const ev = { t, text, session: inSession, last: i === query.length - 1 };
      inSession.end = t; inSession.keys++;
      const ch = query[i];
      i++;
      if (i >= query.length) { i = 0; q++; t += 2.4 + 0.8 * rnd(); }
      else t += 0.09 + 0.17 * rnd() + (ch === " " ? 0.35 + 0.35 * rnd() : 0) + (rnd() < 0.08 ? 0.25 + 0.3 * rnd() : 0);
      return ev;
    };
  }
  if (kind === "hold") {
    // A held key, a scroll or a resize: an event every 50 ms for 5 s, then 2 s of quiet.
    return () => {
      if (i === 0) begin("");
      n++;
      const text = "y " + n * 40;
      inSession.final = text;
      const ev = { t, text, session: inSession, last: i === 99 };
      inSession.end = t; inSession.keys++;
      i++;
      if (i >= 100) { i = 0; t += 2 + 0.05; } else t += 0.05;
      return ev;
    };
  }
  // "clicks": an impatient double click on a submit button, then a pause.
  return () => {
    if (i === 0) { q++; begin("order " + q); }
    const ev = { t, text: "order " + q, session: inSession, last: i === 1 };
    inSession.end = t; inSession.keys++;
    i++;
    if (i >= 2) { i = 0; t += 2.4 + 0.8 * rnd(); } else t += 0.11 + 0.1 * rnd();
    return ev;
  };
}

export function makeSim({ mode = "trailing", wait = 0.3, maxWait = 0, input = "typing", latency = "variable", cancel = false } = {}, seed = 1) {
  const rnd = rng(seed);
  const lat = rng(seed * 7919 + 13);
  const sessions = [];
  const next = makeInput(input, rnd, sessions);
  const events = [];     // { t, text, fate: "board" | "sent" | "ignored" | "stairs", req }
  const requests = [];   // { id, t, text, keys, lat, done, status: "flight" | "shown" | "cancelled" }
  let upcoming = input === "live" ? null : next();
  let pending = null;    // trailing: { first, last, keys, text, events }
  let quietUntil = -Infinity;  // leading: ignore events until this time
  let now = 0;
  const screen = { text: "", id: -1, maxId: -1, staleShown: 0, typed: "", backAt: -9 };
  const live = [];       // events fed by the visitor

  // Steady: about 0.2 s every time. Variable: usually 0.1-0.45 s, but one request in six hits a slow path (1-2.5 s).
  const latencyOf = () => { if (latency === "steady") return 0.18 + 0.06 * lat(); const base = 0.08 + 0.37 * lat(); return lat() < 1 / 6 ? base + 0.9 + 1.5 * lat() : base; };

  function send(t, text, keys, session) {
    if (cancel) for (const r of requests) if (r.status === "flight") { r.status = "cancelled"; r.cancelledAt = t; }
    const L = latencyOf();
    const r = { id: requests.length, t, text, keys, lat: L, done: t + L, status: "flight", session };
    requests.push(r);
    if (session) { session.requests++; if (session.firstSend === null) session.firstSend = t; }
    return r;
  }
  const fireAt = () => pending ? Math.min(pending.last + wait, maxWait > 0 ? pending.first + maxWait : Infinity) : Infinity;

  function onEvent(ev) {
    const e = { t: ev.t, text: ev.text, fate: "sent", req: null, session: ev.session };
    events.push(e);
    screen.typed = ev.text;
    if (mode === "none") { e.fate = "stairs"; e.req = send(ev.t, ev.text, 1, ev.session); }
    else if (mode === "leading") {
      if (ev.t >= quietUntil) { e.fate = "sent"; e.req = send(ev.t, ev.text, 1, ev.session); }
      else e.fate = "ignored";
      quietUntil = ev.t + wait;
    } else {
      e.fate = "board";
      if (!pending) pending = { first: ev.t, last: ev.t, keys: 0, text: "", events: [], session: ev.session };
      pending.last = ev.t; pending.keys++; pending.text = ev.text; pending.events.push(e); pending.session = ev.session;
    }
  }
  function fire(t) {
    const r = send(t, pending.text, pending.keys, pending.session);
    for (const e of pending.events) e.req = r;
    pending = null;
  }
  function respond(r) {
    r.status = "shown";
    if (r.id < screen.maxId) { screen.staleShown++; screen.backAt = r.done; }
    screen.text = r.text; screen.id = r.id; screen.maxId = Math.max(screen.maxId, r.id);
    const s = r.session;
    if (s && s.shownAt === null && r.text === s.final && r.done >= s.end) s.shownAt = r.done;
  }
  let flightFrom = 0;   // requests before this index are settled
  function nextResponse() {
    let best = null;
    for (let i = flightFrom; i < requests.length; i++) { const r = requests[i]; if (r.status === "flight" && (!best || r.done < best.done)) best = r; }
    while (flightFrom < requests.length && requests[flightFrom].status !== "flight") flightFrom++;
    return best;
  }

  function runTo(T) {
    for (;;) {
      const te = upcoming ? upcoming.t : Infinity;
      const tl = live.length ? live[0].t : Infinity;
      const tf = fireAt();
      const rr = nextResponse();
      const tr = rr ? rr.done : Infinity;
      const t = Math.min(te, tl, tf, tr);
      if (t > T) break;
      if (t === tr) respond(rr);
      else if (t === tf) fire(tf);
      else if (t === tl) onEvent(live.shift());
      else { onEvent(upcoming); upcoming = next(); }
    }
    now = T;
  }

  return {
    runTo,
    feed(t, text) { live.push({ t, text, session: null, last: false }); },
    events, requests, sessions, screen,
    get now() { return now; },
    get pending() { return pending; },
    get fireAt() { return fireAt(); },
    get quietUntil() { return quietUntil; },
    get upcoming() { return upcoming; },
    cfg: { mode, wait, maxWait, input, latency, cancel },
  };
}

// ---------- measurements for the experiments ----------
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

// Run one configuration for `seconds` and summarise it; sessions still in progress at the end are left out.
export function measure(cfg, seconds = 120, seed = 1) {
  const m = makeSim(cfg, seed);
  m.runTo(seconds);
  const closed = m.sessions.filter((s, i) => i < m.sessions.length - 1 && m.sessions[i + 1].start + 0.01 < seconds);
  // A session ends wrong when the screen does not show its final text at the moment the next one starts.
  let wrong = 0;
  const lags = [];
  let never = 0;
  closed.forEach((s, i) => {
    const nextStart = m.sessions[i + 1].start;
    const shownBy = m.requests.filter((r) => r.status === "shown" && r.done < nextStart).sort((a, b) => a.done - b.done);
    const last = shownBy[shownBy.length - 1];
    if (!last || last.text !== s.final) wrong++;
    if (s.shownAt !== null && s.shownAt < nextStart) lags.push(s.shownAt - s.end); else never++;
  });
  const reqIn = (s, i) => m.requests.filter((r) => r.t >= s.start && r.t < m.sessions[i + 1].start).length;
  const keys = closed.reduce((a, s) => a + s.keys, 0);
  const reqs = closed.reduce((a, s, i) => a + reqIn(s, i), 0);
  const first = closed.map((s) => (s.firstSend === null ? Infinity : s.firstSend - s.start));
  const during = closed.map((s, i) => m.requests.filter((r) => r.t >= s.start && r.t <= s.end).length);
  return {
    sessions: closed.length, keys, requests: reqs,
    perSession: reqs / Math.max(1, closed.length), keysPerSession: keys / Math.max(1, closed.length),
    lag: mean(lags), never, wrong, wrongShare: wrong / Math.max(1, closed.length),
    stale: m.screen.staleShown, staleShare: m.screen.staleShown / Math.max(1, closed.length),
    cancelled: m.requests.filter((r) => r.status === "cancelled").length,
    firstSend: mean(first.filter(Number.isFinite)), noSendDuring: during.filter((d) => d === 0).length / Math.max(1, closed.length),
    sentDuring: mean(during),
  };
}

// Average a measurement over several seeds.
export function averaged(cfg, seconds = 120, seeds = [3, 5, 7, 11, 13, 17]) {
  const runs = seeds.map((s) => measure(cfg, seconds, s));
  const out = {};
  for (const key of Object.keys(runs[0])) {
    const vals = runs.map((r) => r[key]).filter((v) => Number.isFinite(v));
    out[key] = vals.length ? mean(vals) : NaN;
  }
  return out;
}

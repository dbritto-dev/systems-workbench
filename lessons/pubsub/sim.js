// Shared pub/sub model for the figure and the experiments. Times are in seconds of figure time.
// One press publishes a message every T.interval into the hub. The hub sends one copy down every
// subscribed tube at the same moment; all copies arrive T.tube later, whatever the number of tubes.
// Each station takes cards from its own tray at its own pace.
export const T = { interval: 1.2, press: 0.3, tube: 0.6, take: 0.15, work: 0.4, slowWork: 2.0, ack: 0.2, crash: 0.35 };
export const STATIONS = 5;
export const STATION_X = [-80, -30, 20, 70, 120];
export const OFFLINE_STATION = 2;
export const SLOW_STATION = 2;
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export function createModel(options = {}, seed = 7) {
  const cfg = { subs: 3, slow: false, offline: false, durable: true, crash: 0, idempotent: false, shared: false, ...options };
  return {
    cfg, t: 0, random: rng(seed), nextPub: 0.2, press: null, inflight: [],
    published: 0, msgs: new Map(), queues: Array.from({ length: STATIONS }, () => []), rrNext: 0, log: null,
    stations: Array.from({ length: STATIONS }, () => ({ busy: null, online: true, handled: 0, effects: 0, seen: new Set(), done: new Set(), delivered: 0, lost: 0, delays: [], maxBacklog: 0 })),
  };
}
const emit = (m, e) => { if (m.log) m.log.push(e); };
export const queueOf = (m, i) => (m.cfg.shared && i === 1 ? 0 : i);
export const active = (m, i) => i < m.cfg.subs;
// Does the subscription behind queue q exist right now? A non-durable subscription vanishes while its station is offline.
export function subscribed(m, q) {
  if (!active(m, q) || (m.cfg.shared && q === 1)) return false;
  return m.stations[q].online || m.cfg.durable;
}
export function setOffline(m, on) {
  m.cfg.offline = on;
  const s = m.stations[OFFLINE_STATION];
  s.online = !on;
  if (on && s.busy) { m.queues[OFFLINE_STATION].unshift({ id: s.busy.id, tries: s.busy.tries }); s.busy = null; }
  if (on && !m.cfg.durable) dropSubscription(m, OFFLINE_STATION);
}
export function setDurable(m, on) {
  m.cfg.durable = on;
  if (!on && !m.stations[OFFLINE_STATION].online) dropSubscription(m, OFFLINE_STATION);
}
function dropSubscription(m, q) {
  const n = m.queues[q].length;
  if (n) { m.stations[q].lost += n; m.queues[q].length = 0; emit(m, { type: "dropped", q, n }); }
}
function deliver(m, q, id) {
  if (subscribed(m, q)) {
    m.queues[q].push({ id, tries: 0 });
    m.stations[q].delivered++;
    const s = m.stations[q];
    s.maxBacklog = Math.max(s.maxBacklog, m.queues[q].length);
    emit(m, { type: "drop", q, id });
  } else if (active(m, q) && !(m.cfg.shared && q === 1)) {
    m.stations[q].lost++;
    emit(m, { type: "lost", q, id });
  }
}
export function step(m, dt) {
  m.t += dt;
  // Publisher: never waits for anyone.
  if (!m.press && m.t >= m.nextPub) { m.press = { t: 0 }; m.nextPub += T.interval; emit(m, { type: "press" }); }
  if (m.press) {
    m.press.t += dt;
    if (m.press.t >= T.press) {
      m.press = null;
      const id = ++m.published;
      m.msgs.set(id, m.t);
      m.inflight.push({ id, t: 0 });
      emit(m, { type: "publish", id });
    }
  }
  // Broker: every copy of a message travels its own tube in parallel and arrives at the same moment.
  m.inflight = m.inflight.filter((f) => {
    f.t += dt;
    if (f.t < T.tube) return true;
    for (let q = 0; q < STATIONS; q++) deliver(m, q, f.id);
    return false;
  });
  // Stations.
  for (let i = 0; i < STATIONS; i++) {
    const s = m.stations[i];
    if (!active(m, i) || !s.online) continue;
    const q = queueOf(m, i);
    if (!s.busy) {
      if (!m.queues[q].length) continue;
      if (m.cfg.shared && q === 0) {
        const other = m.stations[1 - i];
        if (m.rrNext !== i && !other.busy && other.online) continue;
        m.rrNext = 1 - i;
      }
      const card = m.queues[q].shift();
      s.busy = { id: card.id, tries: card.tries, phase: "take", t: 0, dur: T.take, q };
      emit(m, { type: "take", i, id: card.id });
      continue;
    }
    const b = s.busy;
    b.t += dt;
    if (b.t < b.dur) continue;
    if (b.phase === "take") { Object.assign(b, { phase: "work", t: 0, dur: m.cfg.slow && i === SLOW_STATION ? T.slowWork : T.work }); continue; }
    if (b.phase === "work") {
      s.handled++;
      if (!m.cfg.idempotent || !s.seen.has(b.id)) s.effects++;
      if (s.seen.has(b.id)) emit(m, { type: "duplicate", i, id: b.id });
      s.seen.add(b.id);
      if (m.random() < m.cfg.crash) { Object.assign(b, { phase: "crash", t: 0, dur: T.crash }); emit(m, { type: "crash", i, id: b.id }); }
      else Object.assign(b, { phase: "ack", t: 0, dur: T.ack });
      continue;
    }
    if (b.phase === "crash") { m.queues[b.q].unshift({ id: b.id, tries: b.tries + 1 }); s.busy = null; continue; }
    if (b.phase === "ack") { s.done.add(b.id); s.delays.push(m.t - m.msgs.get(b.id)); s.busy = null; emit(m, { type: "ack", i, id: b.id }); }
  }
}
// Run the model headless for `seconds`. events: [{ at, run(m) }]
export function runHeadless(options = {}, { seconds = 120, seed = 7, events = [], dt = 0.02 } = {}) {
  const m = createModel(options, seed);
  const todo = [...events].sort((a, b) => a.at - b.at);
  while (m.t < seconds) {
    while (todo.length && todo[0].at <= m.t) todo.shift().run(m);
    step(m, dt);
  }
  return m;
}
export function averageOf(options, settings, measure, seeds = [3, 5, 7, 11, 13, 17]) {
  const values = seeds.map((seed) => measure(runHeadless(options, { ...settings, seed })));
  return values[0] && typeof values[0] === "object"
    ? Object.fromEntries(Object.keys(values[0]).map((k) => [k, values.reduce((s, v) => s + v[k], 0) / values.length]))
    : values.reduce((s, v) => s + v, 0) / values.length;
}
export const meanOf = (list) => (list.length ? list.reduce((s, v) => s + v, 0) / list.length : 0);
// What a publisher would spend per message if it called every subscriber itself and waited.
export const directCallTime = (subs) => T.press + subs * (T.take + T.work + T.ack);

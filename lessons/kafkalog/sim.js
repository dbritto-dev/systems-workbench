// Shared model for the rail-yard figure and the experiments. Times in seconds.
// A topic has P partitions (tracks). Each partition is an append-only log: records get offsets 0, 1, 2 …
// A consumer group of C consumers splits the partitions between them; the group remembers, per partition,
// the committed offset (the bookmark): the next record the group still has to read.
export const KEYS = ["A", "B", "C", "D", "E", "F"];
export const BATCH = 5;        // records a consumer takes per poll
export const PROCESS = 0.5;    // seconds to process one record (±20%)
export const RESTART = 2;      // seconds a crashed consumer is down
export const HOT_SHARE = 0.7;  // share of records with the hot key "A"
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// Which track a key goes to: a fixed hash, so the same key always lands on the same track.
export const partitionOfKey = (key, partitions) => (key * 5 + 1) % partitions;

// Partitions owned by consumer i: p % C == i. With more consumers than partitions the extra ones own nothing.
export const ownedBy = (i, consumers, partitions) => Array.from({ length: partitions }, (_, p) => p).filter((p) => p % consumers === i);

// cfg: { partitions, consumers, keying: "random"|"key"|"hot", commit: "after"|"before", rate (records/s), retention (s, 0 = keep all) }
export function makeSim(cfg, seed = 7) {
  const random = rng(seed);
  const P = cfg.partitions, C = cfg.consumers;
  const s = {
    t: 0, cfg: { ...cfg },
    logs: Array.from({ length: P }, () => ({ records: [], start: 0 })),
    committed: new Array(P).fill(0),
    position: new Array(P).fill(0),
    consumers: Array.from({ length: C }, (_, i) => ({ id: i, parts: ownedBy(i, C, P), rr: 0, batch: null, current: null, down: 0, crashPending: false, crashes: 0 })),
    seq: new Array(KEYS.length).fill(0),
    lastSeq: new Array(KEYS.length).fill(-1),
    truth: new Array(KEYS.length).fill(0),
    model: new Array(KEYS.length).fill(0),
    produced: 0, processed: 0, firstReads: 0, duplicates: 0, outOfOrder: 0, crashes: 0,
    lastProduced: null, events: [],
  };
  let nextArrival = cfg.rate > 0 ? -Math.log(1 - random()) / cfg.rate : Infinity;

  const pickKey = () => {
    if (cfg.keying === "hot") return random() < HOT_SHARE ? 0 : 1 + Math.floor(random() * (KEYS.length - 1));
    return Math.floor(random() * KEYS.length);
  };
  function produce() {
    const key = pickKey();
    const p = cfg.keying === "random" ? Math.floor(random() * P) : partitionOfKey(key, P);
    const log = s.logs[p];
    const value = 1 + Math.floor(random() * 9);
    const rec = { offset: log.records.length, key, seq: s.seq[key]++, value, t: s.t, reads: 0 };
    log.records.push(rec);
    s.truth[key] += value;
    s.produced++;
    s.lastProduced = { p, offset: rec.offset };
  }
  function read(rec) {
    rec.reads++;
    s.processed++;
    s.model[rec.key] += rec.value;
    if (rec.reads === 1) {
      s.firstReads++;
      if (s.lastSeq[rec.key] > rec.seq) s.outOfOrder++;
      s.lastSeq[rec.key] = Math.max(s.lastSeq[rec.key], rec.seq);
    } else s.duplicates++;
  }
  function crash(c) {
    c.current = null; c.batch = null; c.down = RESTART; c.crashPending = false; c.crashes++; s.crashes++;
    for (const p of c.parts) s.position[p] = s.committed[p];
    s.events.push({ t: s.t, type: "crash", consumer: c.id });
  }
  function startRecord(c) {
    const b = c.batch;
    c.current = { p: b.p, offset: b.from + b.k, done: s.t + PROCESS * (0.8 + 0.4 * random()) };
  }
  function poll(c) {
    const n = c.parts.length;
    for (let i = 0; i < n; i++) {
      const p = c.parts[(c.rr + i) % n];
      const log = s.logs[p];
      if (s.position[p] < log.start) s.position[p] = log.start;
      const available = log.records.length - s.position[p];
      if (available <= 0) continue;
      c.rr = (c.rr + i + 1) % n;
      const take = Math.min(BATCH, available);
      c.batch = { p, from: s.position[p], n: take, k: 0 };
      s.position[p] += take;
      if (cfg.commit === "before") s.committed[p] = s.position[p];
      startRecord(c);
      return;
    }
  }
  function tickConsumer(c) {
    if (c.down > 0) {
      c.down -= H;
      if (c.down <= 0) { c.down = 0; for (const p of c.parts) s.position[p] = s.committed[p]; s.events.push({ t: s.t, type: "restart", consumer: c.id }); }
      return;
    }
    if (c.current && s.t >= c.current.done) {
      const b = c.batch;
      read(s.logs[b.p].records[c.current.offset]);
      c.current = null;
      b.k++;
      if (c.crashPending && b.k >= 1 && b.k < b.n) { crash(c); return; }
      if (b.k >= b.n) {
        if (cfg.commit === "after") s.committed[b.p] = Math.max(s.committed[b.p], b.from + b.n);
        c.batch = null;
      } else startRecord(c);
    }
    if (!c.current && !c.batch) poll(c);
  }
  const H = 0.01;
  function tick() {
    s.t += H;
    while (s.t >= nextArrival) { produce(); nextArrival += -Math.log(1 - random()) / cfg.rate; }
    if (cfg.retention > 0) {
      for (let p = 0; p < P; p++) {
        const log = s.logs[p];
        while (log.start < log.records.length && log.records[log.start].t < s.t - cfg.retention) log.start++;
        if (s.committed[p] < log.start) s.committed[p] = log.start;
      }
    }
    for (const c of s.consumers) tickConsumer(c);
  }
  s.step = (dt) => { const end = s.t + dt; while (s.t + H <= end + 1e-9) tick(); };
  s.runTo = (t) => s.step(t - s.t);
  s.requestCrash = (i) => { const c = s.consumers[i]; if (c && c.down === 0 && c.parts.length) c.crashPending = true; };
  s.setRetention = (r) => { cfg.retention = r; s.cfg.retention = r; };
  s.setRate = (r) => { cfg.rate = r; s.cfg.rate = r; nextArrival = r > 0 ? s.t - Math.log(1 - random()) / r : Infinity; };
  // Rebuild the read model from the oldest record the log still keeps.
  s.rewind = () => {
    s.model.fill(0);
    for (let p = 0; p < P; p++) {
      const log = s.logs[p];
      for (let i = log.start; i < log.records.length; i++) log.records[i].reads = 0;
      s.committed[p] = s.position[p] = log.start;
    }
    for (const c of s.consumers) { c.batch = null; c.current = null; }
    s.events.push({ t: s.t, type: "rewind" });
  };
  s.lag = (p) => s.logs[p].records.length - s.committed[p];
  s.totalLag = () => s.logs.reduce((sum, _, p) => sum + s.lag(p), 0);
  s.lost = () => {
    let n = 0;
    s.logs.forEach((log, p) => { for (let i = 0; i < Math.min(s.committed[p], log.records.length); i++) if (log.records[i].reads === 0) n++; });
    return n;
  };
  s.idle = () => s.consumers.filter((c) => c.parts.length === 0).length;
  s.correctKeys = () => s.model.filter((v, i) => v === s.truth[i]).length;
  return s;
}

// ---------- headless experiments (averaged over seeds) ----------
export const SEEDS = [3, 5, 7, 11, 13, 17];
export const BASE = { partitions: 3, consumers: 3, keying: "key", commit: "after", rate: 4, retention: 0 };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function orderRun(keying) {
  const shares = SEEDS.map((seed) => { const s = makeSim({ ...BASE, keying }, seed); s.runTo(120); return s.firstReads ? s.outOfOrder / s.firstReads : 0; });
  return mean(shares);
}
export function crashRun(commit) {
  const runs = SEEDS.map((seed) => {
    const s = makeSim({ ...BASE, commit }, seed);
    for (let t = 5; t < 120; t += 10) { s.runTo(t); s.requestCrash(0); }
    s.runTo(130);
    return { duplicates: s.duplicates, lost: s.lost(), crashes: s.crashes };
  });
  return { duplicates: mean(runs.map((r) => r.duplicates)), lost: mean(runs.map((r) => r.lost)), crashes: mean(runs.map((r) => r.crashes)) };
}
export function groupRun(consumers) {
  const runs = SEEDS.map((seed) => { const s = makeSim({ ...BASE, consumers, rate: 8 }, seed); s.runTo(60); const before = s.processed; s.runTo(120); return { perMinute: s.processed - before, idle: s.idle(), lag: s.totalLag() }; });
  return { perMinute: mean(runs.map((r) => r.perMinute)), idle: mean(runs.map((r) => r.idle)), lag: mean(runs.map((r) => r.lag)) };
}
export function hotRun(keying) {
  const runs = SEEDS.map((seed) => { const s = makeSim({ ...BASE, keying }, seed); s.runTo(60); return s.logs.map((_, p) => s.lag(p)); });
  return [0, 1, 2].map((p) => mean(runs.map((r) => r[p])));
}
export function replayRun(retention) {
  const runs = SEEDS.map((seed) => {
    const s = makeSim({ ...BASE, retention }, seed);
    s.runTo(90);
    s.setRate(0);
    s.setRetention(0);
    s.rewind();
    const kept = s.logs.reduce((n, log) => n + log.records.length - log.start, 0);
    const from = s.t;
    while ((s.totalLag() > 0 || s.consumers.some((c) => c.batch)) && s.t < from + 300) s.step(1);
    return { correct: s.correctKeys(), kept, produced: s.produced, seconds: s.t - from };
  });
  return { correct: mean(runs.map((r) => r.correct)), kept: mean(runs.map((r) => r.kept)), produced: mean(runs.map((r) => r.produced)), seconds: mean(runs.map((r) => r.seconds)) };
}

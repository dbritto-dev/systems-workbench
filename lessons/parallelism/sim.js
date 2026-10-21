// Shared model for the figure and the experiments: a workshop that runs one job at a time.
// The foreman hands out chunks of the job one by one, workers at benches (cores) work on them at the
// same time, and the packing station merges every chunk and does the serial part of the job alone.
// Times are seconds of figure time; one worker alone needs about 16 s for a big job.
export const PAR = {
  BIG: 16, TINY: 0.3,
  DISPATCH: 0.02,     // foreman's time to hand out one chunk
  MERGE: 0.02,        // packing station's time to merge one chunk back in
  SWITCH_EFF: 0.9,    // a bench shared by several workers loses 10% to switching between them
  TOOL_SHARE: 0.4,    // with the shared tool on, the last 40% of every chunk needs the one tool
  JITTER: 0.08,       // chunks of an even split still differ by up to ±8%
  HOT: 3.4,           // uneven data: the first eighth of the job is 3.4× as dense as average
  DT: 0.005,
  SEEDS: [3, 5, 7, 11, 13, 17],
};

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export function jobWork(cfg) { return cfg.job === "tiny" ? PAR.TINY : PAR.BIG; }

// Share of the job's parallel work in each chunk. Uneven data packs a third of the work into the first eighth.
export function chunkWeights(cfg) {
  const C = cfg.chunks;
  if (cfg.data !== "uneven") return Array(C).fill(1 / C);
  const hot = PAR.HOT, rest = (1 - hot / 8) / (7 / 8);
  const density = (x) => (x < 1 / 8 ? hot : rest);
  const out = [];
  for (let i = 0; i < C; i++) {
    const a = i / C, b = (i + 1) / C, n = 64;
    let w = 0;
    for (let j = 0; j < n; j++) w += density(a + ((j + 0.5) / n) * (b - a)) * ((b - a) / n);
    out.push(w);
  }
  return out;
}

export function amdahl(serial, workers, cores) { const n = Math.min(workers, cores); return 1 / (serial + (1 - serial) / n); }

export function makeShop(cfg, seed = 1) {
  const random = rng(seed);
  const shop = {
    cfg: { ...cfg }, t: 0, jobsDone: 0, times: [], lastTime: null,
    workers: Array.from({ length: cfg.workers }, (_, i) => ({ id: i, bench: i % cfg.cores, chunk: null, waiting: false, holding: false })),
    benchBusy: Array(cfg.cores).fill(0), benchRunning: Array(cfg.cores).fill(0), busyTime: 0, toolWaitTime: 0,
  };
  function startJob() {
    const W = jobWork(shop.cfg), par = W * (1 - shop.cfg.serial), share = shop.cfg.tool ? PAR.TOOL_SHARE : 0;
    shop.jobStart = shop.t;
    shop.chunks = chunkWeights(shop.cfg).map((w, id) => {
      const size = par * w * (1 + PAR.JITTER * (2 * random() - 1));
      return { id, size, free: size * (1 - share), tool: size * share, worker: null, done: false };
    });
    shop.dispatched = 0; shop.nextDispatch = PAR.DISPATCH; shop.ready = [];
    shop.toolQueue = []; shop.toolHolder = null;
    shop.phase = "work"; shop.mergeLeft = shop.chunks.length * PAR.MERGE; shop.packLeft = W * shop.cfg.serial;
    shop.doneCount = 0;
  }
  function finishChunk(w) {
    w.chunk.done = true; shop.doneCount++;
    w.chunk = null; w.holding = false; w.waiting = false;
  }
  function grantTool() {
    if (shop.toolHolder === null && shop.toolQueue.length) {
      const w = shop.toolQueue.shift();
      w.waiting = false; w.holding = true; shop.toolHolder = w.id;
    }
  }
  function step(dt) {
    shop.t += dt;
    if (shop.phase === "work") {
      shop.nextDispatch -= dt;
      while (shop.nextDispatch <= 0 && shop.dispatched < shop.chunks.length) {
        shop.ready.push(shop.chunks[shop.dispatched++]);
        shop.nextDispatch += PAR.DISPATCH;
      }
      for (const w of shop.workers) if (!w.chunk && shop.ready.length) { w.chunk = shop.ready.shift(); w.chunk.worker = w.id; }
      const runnable = Array(shop.cfg.cores).fill(0);
      for (const w of shop.workers) if (w.chunk && !w.waiting) runnable[w.bench]++;
      shop.benchRunning = runnable;
      let busy = 0;
      for (let b = 0; b < shop.cfg.cores; b++) if (runnable[b]) { busy++; shop.benchBusy[b] += dt; }
      shop.busyTime += (busy / shop.cfg.cores) * dt;
      for (const w of shop.workers) {
        if (!w.chunk) continue;
        if (w.waiting) { shop.toolWaitTime += dt; continue; }
        const k = runnable[w.bench];
        let amount = dt * (k > 1 ? PAR.SWITCH_EFF / k : 1);
        if (w.chunk.free > 0) {
          const used = Math.min(amount, w.chunk.free);
          w.chunk.free -= used;
          if (w.chunk.free <= 1e-12) {
            w.chunk.free = 0;
            if (w.chunk.tool > 0) { w.waiting = true; shop.toolQueue.push(w); grantTool(); }
            else finishChunk(w);
          }
        } else if (w.holding) {
          w.chunk.tool -= amount;
          if (w.chunk.tool <= 1e-12) { w.chunk.tool = 0; shop.toolHolder = null; finishChunk(w); grantTool(); }
        }
      }
      if (shop.dispatched === shop.chunks.length && shop.doneCount === shop.chunks.length) shop.phase = "merge";
    } else if (shop.phase === "merge") {
      shop.benchRunning = Array(shop.cfg.cores).fill(0);
      shop.mergeLeft -= dt;
      if (shop.mergeLeft <= 0) shop.phase = "pack";
    } else if (shop.phase === "pack") {
      shop.packLeft -= dt;
      if (shop.packLeft <= 0) {
        shop.lastTime = shop.t - shop.jobStart;
        shop.times.push(shop.lastTime); shop.jobsDone++;
        startJob();
      }
    }
  }
  shop.step = step;
  shop.runTo = (t) => { while (shop.t < t - 1e-9) step(Math.min(PAR.DT, t - shop.t)); };
  startJob();
  return shop;
}

// Time for one job, averaged over the seeds.
export function jobTime(cfg) {
  let sum = 0;
  for (const seed of PAR.SEEDS) {
    const shop = makeShop(cfg, seed);
    while (shop.jobsDone < 1 && shop.t < 200) shop.step(PAR.DT);
    sum += shop.times[0];
  }
  return sum / PAR.SEEDS.length;
}

export function speedup(cfg) { return jobTime({ ...cfg, workers: 1 }) / jobTime(cfg); }

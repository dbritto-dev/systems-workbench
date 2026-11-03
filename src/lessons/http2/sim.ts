// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// One page's files loaded from one origin over HTTP/1.1 or HTTP/2. Times in milliseconds. Seeded and event-driven,
// shared by the live figure (live.ts) and the experiments (page.ts, at build time).
//
// What the model keeps:
//   - a connection costs two round trips before its first request: TCP's handshake, then TLS 1.3's;
//   - HTTP/1.1: up to `conns` connections, each carrying one request at a time (no pipelining); the browser's
//     waiting files go to whichever connection frees up first;
//   - HTTP/2: one connection; every request goes out at once as its own stream, and the server interleaves the
//     streams' data, a packet at a time, round robin;
//   - one shared bottleneck link (the bandwidth): every connection's packets leave the server through it one at a
//     time, then take half a round trip to reach the browser; an ack takes the other half back;
//   - TCP per connection: packets numbered in order; the browser hands data on only in order, so a packet that
//     arrives after a gap waits until the gap is filled; a congestion window that starts at 10 packets and grows by
//     one per ack (slow start), halves on a loss, then grows by about one per round trip;
//   - loss: each data packet is lost with probability `loss`. The server notices about a round trip later when later
//     packets on that connection get through (three or more), or after two round trips when none do, and sends it
//     again.
//   - the page's HTML has just come in over the first connection, which stays open: the files are known at t = 0, and
//     every other connection still has to be opened.
// What it leaves out: DNS, the HTML document's own download,
// request and ack loss, server work other than one optional slow response, header sizes, priorities, the receive
// window (the congestion window is capped instead), and TCP's finer timers.
import { mulberry32 } from "../../lib/random";
import { minHeap } from "../../lib/events";
import { averageOver } from "../../lib/stats";

export const PACKET_BYTES = 1500;
export const INITIAL_WINDOW = 10;    // packets (the common default, RFC 6928)
export const MAX_WINDOW = 64;        // packets: the cap that stands in for the receive window
export const MAX_STREAMS = 100;      // concurrent HTTP/2 streams (a common server setting)
export const SLOW_FILE = 2;          // the file that can be slow (the third one the page asks for)
export const MAX_SIZE = 7;           // a file is 1 to 7 packets (1.5 to 10.5 KB)

export const DEFAULTS = { proto: "h1", files: 40, rtt: 100, mbps: 10, loss: 0, conns: 6, slow: 0 };

export const txOf = (mbps) => (PACKET_BYTES * 8) / (mbps * 1000);   // ms to put one packet on the link

/** The page: file sizes in packets, the same for a seed whatever the protocol. */
export function pageOf(n, seed) {
  const r = mulberry32(seed * 2654435761);
  return Array.from({ length: n }, () => 1 + Math.floor(r() * MAX_SIZE));
}

export function makeLoad(cfgIn, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const h2 = cfg.proto === "h2";
  const rtt = cfg.rtt, half = rtt / 2, tx = txOf(cfg.mbps);
  const lossRnd = mulberry32(seed * 40503 + 17);
  const files = pageOf(cfg.files, seed).map((size, id) => ({
    id, size, got: 0, think: id === SLOW_FILE ? cfg.slow : 0, conn: -1, requested: -1, ready: -1, done: -1, next: 0,
  }));
  const nConns = h2 ? 1 : Math.min(cfg.conns, files.length);
  const conns = Array.from({ length: nConns }, (_, id) => ({
    id, open: false, readyAt: id === 0 ? 0 : 2 * rtt, cwnd: INITIAL_WINDOW, ssthresh: Infinity, inflight: 0, seq: 0, expect: 0,
    held: new Map(), retx: [], file: null, streams: [], rr: 0, lastCut: -Infinity, sentAt: [], fileOf: [],
  }));
  const heap = minHeap((a, b) => a.t < b.t || (a.t === b.t && a.n < b.n));
  let n = 0;
  const at = (t, kind, data) => heap.push({ t, n: n++, kind, ...data });
  const link = { free: 0, busy: 0 };
  const packets = [];                 // every packet put on the link, for the figure
  const log = [];                     // what happened, for the figure's readout
  const st = { done: 0, loadTime: -1, handshakes: nConns, resent: 0, held: 0, heldMax: 0, heldOther: 0, stallMs: 0, requests: 0 };
  let waiting = 0;                    // HTTP/1.1: index of the next file nobody has asked for yet
  let forceDrop = false;
  let now = 0;

  for (const c of conns) at(c.readyAt, "open", { c });

  function request(c, f, t) {
    f.conn = c.id; f.requested = t; st.requests++;
    if (!h2) c.file = f;
    at(t + half, "request", { f });
  }

  function nextPacket(c) {
    if (c.retx.length) return c.retx.shift();
    if (!h2) {
      const f = c.file;
      if (!f || f.ready < 0 || f.next >= f.size) return null;
      return { file: f.id, part: f.next++, seq: c.seq++ };
    }
    // HTTP/2: round robin over the streams the server has data for.
    for (let k = 0; k < c.streams.length; k++) {
      const i = (c.rr + k) % c.streams.length, f = c.streams[i];
      if (f.next < f.size) {
        c.rr = (i + 1) % c.streams.length;
        const p = { file: f.id, part: f.next++, seq: c.seq++ };
        if (f.next >= f.size) { c.streams.splice(i, 1); if (c.rr > i) c.rr--; if (c.rr >= c.streams.length) c.rr = 0; }
        return p;
      }
    }
    return null;
  }

  function pump(c, t) {
    while (c.inflight < Math.floor(c.cwnd)) {
      const p = nextPacket(c);
      if (!p) return;
      c.inflight++;
      const start = Math.max(t, link.free);
      link.free = start + tx; link.busy += tx;
      const lost = forceDrop || lossRnd() < cfg.loss;
      if (forceDrop) forceDrop = false;
      const pkt = { conn: c.id, file: p.file, part: p.part, seq: p.seq, resent: !!p.resent, queued: t, depart: start + tx, arrive: start + tx + half, lost, delivered: -1 };
      packets.push(pkt);
      c.sentAt[p.seq] = start; c.fileOf[p.seq] = p.file;
      if (lost) { at(pkt.arrive + half + 3 * tx, "detect", { c, pkt }); log.push({ t: pkt.depart + half / 2, type: "lost", pkt }); }
      else at(pkt.arrive, "arrive", { c, pkt });
    }
  }

  function deliver(c, pkt, t) {
    pkt.delivered = t;
    const f = files[pkt.file];
    f.got++;
    if (f.got === f.size) {
      f.done = t; st.done++;
      log.push({ t, type: "done", f });
      if (st.done === files.length) { st.loadTime = t; log.push({ t, type: "loaded" }); }
      if (!h2) { c.file = null; if (waiting < files.length) request(c, files[waiting++], t); }
      else if (waiting < files.length) request(c, files[waiting++], t);
    }
  }

  function handle(e) {
    const t = e.t;
    if (e.kind === "open") {
      const c = e.c; c.open = true;
      log.push({ t, type: "open", c: c.id });
      if (h2) { while (waiting < files.length && waiting < MAX_STREAMS) request(c, files[waiting++], t); }
      else if (waiting < files.length) request(c, files[waiting++], t);
    } else if (e.kind === "request") {
      const f = e.f;
      if (f.think > 0) log.push({ t, type: "think", f });
      at(t + f.think, "ready", { f });
    } else if (e.kind === "ready") {
      const f = e.f, c = conns[f.conn];
      f.ready = t;
      if (h2) c.streams.push(f);
      pump(c, t);
    } else if (e.kind === "arrive") {
      const c = e.c, pkt = e.pkt;
      at(t + half, "ack", { c });
      if (pkt.seq === c.expect) {
        deliver(c, pkt, t); c.expect++;
        while (c.held.has(c.expect)) { const h = c.held.get(c.expect); c.held.delete(c.expect); st.held--; st.stallMs += t - h.arrive; deliver(c, h, t); c.expect++; }
      } else if (pkt.seq > c.expect) {
        c.held.set(pkt.seq, pkt); st.held++; st.heldMax = Math.max(st.heldMax, st.held);
        if (pkt.file !== c.fileOf[c.expect]) st.heldOther++;   // another file's data, stuck behind this file's gap
      }
    } else if (e.kind === "ack") {
      const c = e.c;
      c.inflight--;
      c.cwnd = Math.min(MAX_WINDOW, c.cwnd < c.ssthresh ? c.cwnd + 1 : c.cwnd + 1 / c.cwnd);
      pump(c, t);
    } else if (e.kind === "detect") {
      const c = e.c, pkt = e.pkt;
      // Three later packets on this connection: their duplicate acks tell the server now. Otherwise it waits for
      // its tail-loss probe, about two round trips after it sent the packet.
      const later = c.seq - pkt.seq - 1;
      if (later >= 3) at(t, "resend", { c, pkt });
      else at(Math.max(t, c.sentAt[pkt.seq] + 2 * rtt), "resend", { c, pkt });
    } else if (e.kind === "resend") {
      const c = e.c, pkt = e.pkt;
      c.inflight--;
      if (t - c.lastCut > rtt) { c.ssthresh = Math.max(2, c.cwnd / 2); c.cwnd = c.ssthresh; c.lastCut = t; }
      c.retx.push({ file: pkt.file, part: pkt.part, seq: pkt.seq, resent: true });
      st.resent++;
      log.push({ t, type: "resend", pkt });
      pump(c, t);
    }
  }

  return {
    cfg, files, conns, packets, log, st, link, tx, half,
    get now() { return now; },
    get waiting() { return h2 ? 0 : files.length - waiting; },
    /** Lose the next packet the server sends (the figure's "Drop a packet"). */
    drop() { forceDrop = true; },
    runTo(T) {
      while (heap.size && heap.peek().t <= T) handle(heap.pop());
      now = T;
    },
    /** Run until the last file is in (or a safety limit). */
    finish(limit = 120000) {
      while (heap.size && st.loadTime < 0 && heap.peek().t <= limit) handle(heap.pop());
      now = st.loadTime;
      return st.loadTime;
    },
  };
}

/** One load, summed up. */
export function loadOnce(cfg, seed) {
  const m = makeLoad(cfg, seed);
  const total = m.finish();
  const others = Math.max(...m.files.filter((f) => f.id !== SLOW_FILE).map((f) => f.done));
  return { load: total, others, resent: m.st.resent, heldOther: m.st.heldOther, stallMs: m.st.stallMs, busy: m.link.busy / total, handshakes: m.st.handshakes };
}

export const SEEDS = Array.from({ length: 24 }, (_, i) => 101 + i * 7);
export const average = (cfg, seeds = SEEDS) => averageOver(seeds, (seed) => loadOnce(cfg, seed));

// ---------- experiments (run at build time; the page shows the results) ----------
const BASE = { ...DEFAULTS };
export function experimentResults() {
  const h1 = { ...BASE, proto: "h1" }, h2 = { ...BASE, proto: "h2" };
  return {
    many: { h1: average(h1), h2: average(h2) },
    rtt: {
      base: average(h1), bw: average({ ...h1, mbps: 50 }), near: average({ ...h1, rtt: 20 }),
      h2base: average(h2), h2bw: average({ ...h2, mbps: 50 }), h2near: average({ ...h2, rtt: 20 }),
    },
    slow: {
      h1: average(h1), h1s: average({ ...h1, slow: 1000 }), h2: average(h2), h2s: average({ ...h2, slow: 1000 }),
    },
    loss: {
      h1: average(h1), h1l: average({ ...h1, loss: 0.02 }), h1x: average({ ...h1, loss: 0.05 }),
      h2: average(h2), h2l: average({ ...h2, loss: 0.02 }), h2x: average({ ...h2, loss: 0.05 }),
    },
    shard: { h1: average(h1), h18: average({ ...h1, conns: 18 }), h2: average(h2), h18l: average({ ...h1, conns: 18, loss: 0.02 }), h2l: average({ ...h2, loss: 0.02 }) },
  };
}

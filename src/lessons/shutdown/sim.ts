// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// One pod (B) of a service with three pods, being shut down the way Kubernetes does it. Event-driven and seeded,
// shared by the live figure and the experiments. Times are seconds; the numbers are illustrative and round.
//
// A doorman (the routers: kube-proxy, an ingress, a load balancer) sends each new connection to one of the pods on
// his list, at random; B gets a third of them. A request reaches the pod WALK seconds after the doorman routed it.
// When B is deleted, two things start at once and nobody waits for the other:
//   - the control plane takes B off its endpoint list, and the news reaches the doorman ROUTER[router] seconds
//     later (a random time in that range); until then he keeps sending B a third of the new connections;
//   - the kubelet runs B's preStop hook (a sleep of cfg.preStop seconds; the app doesn't know and keeps serving),
//     then sends SIGTERM. At cfg.grace seconds after the delete, whatever is still running gets SIGKILL.
// On SIGTERM the app does one of:
//   "exit"  exit at once: every request in progress is cut, and nothing listens any more;
//   "stop"  stop accepting new connections and finish what's in progress, exiting when no connection is left open;
//   "drain" the same, and also close its keep-alive connections: idle ones at once, busy ones after their current
//           response (Connection: close in HTTP/1.1, GOAWAY in HTTP/2), so their clients reconnect elsewhere.
// A connection that reaches B while nothing listens is refused.
//
// cfg.conns: "new"  every request opens a new connection, so the doorman routes each one;
//            "keep" clients keep connections open and send request after request on them (keep-alive): B starts
//                   with REGULARS such connections, and the doorman only sees a client again when it reconnects.
// cfg.work:  "short"   every request takes SHORT seconds;
//            "exports" also, one request in ten is an export that takes EXPORT.len seconds.
// cfg.auto:  the live machine's rolling deploy: B is deleted at cfg.firstAt, and then OPEN_FOR seconds after each
//            replacement is back on the doorman's list; a replacement starts once B is gone.

import { rng } from "../../lib/random";
import { averageOver } from "../../lib/stats";

export const PODS = 3;                        // pods in the service; the doorman spreads new connections over them
export const RATE = 1.5;                      // new connections a second the doorman sends B while it is on his list
export const SHORT = [1, 4];                  // seconds a request takes (2.5 s on average)
export const EXPORT = { share: 0.1, len: [10, 50] };
export const THINK = 0.6;                     // mean seconds a keep-alive client waits before its next request
export const REGULARS = 3;                    // keep-alive connections a pod holds
export const WALK = 1;                        // seconds from the doorman to the pod
export const ROUTER = { fast: [1, 3.5], slow: [4, 12] };
export const SPOTS = 14;                      // places in the shop (spots 0, 2, 4 are the keep-alive regulars')
export const REG_SPOTS = [0, 2, 4];
export const REPLACE = { gap: 2, start: 3 };  // the replacement pod: starts this long after B is gone, ready after
export const OPEN_FOR = 9;
export const DEFAULTS = { onTerm: "stop", preStop: 0, grace: 30, work: "short", conns: "new", router: "fast", auto: false };

export function makeSim(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rArr = rng(seed * 2654435761 + 17), rLen = rng(seed * 40503 + 5), rNet = rng(seed * 9973 + 101);
  let t = 0, nextId = 1;
  const exp = (r, rate) => -Math.log(1 - r()) / rate;
  const uni = (r, [a, b]) => a + (b - a) * r();

  // the pod: open → prestop (deleted, preStop sleep running) → draining (after SIGTERM) → gone → starting → open
  let phase = "open", listening = true, autoAt = cfg.firstAt ?? OPEN_FOR;
  let routed = true;                          // B is on the doorman's list
  let listed = true;                          // B is on the control plane's endpoint list
  let news = null;                            // { kind: "remove" | "add", sent, at }: the update on its way to the doorman
  const inflight = [];                        // { id, start, end, long, spot, reg }
  const regs = [];                            // keep-alive connections open to B: { id, spot, req, next, closing }
  const away = [];                            // clients whose connection to B was closed: { id, next } (keep mode)
  const walking = [];                         // routed to B, on the way: { id, at, routedAt, reg, client }
  let sd = null;                              // the current (or last) shutdown
  const shutdowns = [];
  const log = [];
  const st = { served: 0, refused: 0, cut: 0, elsewhere: 0 };
  let nextArrival = cfg.conns === "new" ? exp(rArr, RATE * PODS) : Infinity;
  let nextClient = 1000;

  const freeSpot = (avoidRegs) => {
    const used = new Set([...inflight.map((r) => r.spot), ...regs.map((g) => g.spot), ...walking.map((w) => w.spot)]);
    for (let s = 0; s < SPOTS; s++) if (!used.has(s) && !(avoidRegs && REG_SPOTS.includes(s))) return s;
    return -1;
  };
  const regSpot = () => {
    const used = new Set([...regs.map((g) => g.spot), ...walking.filter((w) => w.client != null).map((w) => w.spot)]);
    return REG_SPOTS.find((s) => !used.has(s)) ?? -1;
  };
  const length = () => (cfg.work === "exports" && rLen() < EXPORT.share ? { len: uni(rLen, EXPORT.len), long: true } : { len: uni(rLen, SHORT), long: false });

  function startReq(at, spot, reg) {
    const { len, long } = length();
    const req = { id: nextId++, start: at, end: at + len, long, spot, reg: reg ? reg.id : null };
    inflight.push(req);
    if (reg) reg.req = req;
    log.push({ t: at, type: "start", req });
    return req;
  }

  // the doorman routes one new connection: to B with a third of the chance while B is on his list
  function route(at, client = null) {
    const toB = routed && rArr() < 1 / PODS;
    if (!toB) { st.elsewhere++; log.push({ t: at, type: "elsewhere", client }); if (client != null) log.push({ t: at, type: "moved", client }); return; }
    const spot = client != null ? regSpot() : freeSpot(cfg.conns === "keep");
    const w = { id: nextId++, at: at + WALK, routedAt: at, client, spot };
    walking.push(w);
    log.push({ t: at, type: "routed", w });
  }

  function reachDoor(w) {
    walking.splice(walking.indexOf(w), 1);
    if (!listening) {
      st.refused++; if (sd) sd.refused++;
      log.push({ t: w.at, type: "refused", w });
      if (w.client != null) away.push({ id: w.client, next: w.at + exp(rNet, 1 / THINK) });
      return;
    }
    if (w.client != null) {
      const reg = { id: w.client, spot: w.spot, req: null, next: Infinity, closing: false };
      regs.push(reg);
      log.push({ t: w.at, type: "joined", reg });
      startReq(w.at, w.spot, reg).w = w.id;
    } else startReq(w.at, w.spot, null).w = w.id;
  }

  function leave(reg, at, why) {
    regs.splice(regs.indexOf(reg), 1);
    log.push({ t: at, type: "left", reg, why });
    away.push({ id: reg.id, next: at + exp(rNet, 1 / THINK) });
  }

  function finish(req) {
    inflight.splice(inflight.indexOf(req), 1);
    st.served++; if (sd) sd.served++;
    log.push({ t: req.end, type: "done", req });
    const reg = req.reg != null ? regs.find((g) => g.id === req.reg) : null;
    if (reg) {
      reg.req = null;
      if (reg.closing) leave(reg, req.end, "closed");
      else reg.next = req.end + exp(rNet, 1 / THINK);
    }
    maybeExit(req.end);
  }

  function cutAll(at, why) {
    for (const req of inflight.splice(0)) {
      st.cut++; if (sd) { sd.cut++; if (why === "kill") sd.killed++; if (req.long) sd.exportsCut++; }
      log.push({ t: at, type: "cut", req, why });
    }
    for (const reg of [...regs]) leave(reg, at, "reset");
  }

  function gone(at, why) {
    phase = "gone"; listening = false;
    if (sd) { sd.gone = at; sd.how = why; }
    log.push({ t: at, type: "gone", why });
    if (cfg.auto) { replaceAt = at + REPLACE.gap; }
  }

  function maybeExit(at) {
    if (phase !== "draining" || cfg.onTerm === "exit") return;
    if (inflight.length || regs.length) return;
    gone(at, "exit");
  }

  function sigterm(at) {
    phase = "draining";
    if (sd) sd.term = at;
    log.push({ t: at, type: "sigterm" });
    if (cfg.onTerm === "exit") { listening = false; cutAll(at, "exit"); gone(at, "exit"); return; }
    listening = false;
    if (cfg.onTerm === "drain") for (const reg of [...regs]) { if (!reg.req) leave(reg, at, "closed"); else reg.closing = true; }
    maybeExit(at);
  }

  function sigkill(at) {
    if (phase === "gone" || phase === "starting" || phase === "open") return;
    log.push({ t: at, type: "sigkill" });
    if (sd) sd.killedAt = at;
    cutAll(at, "kill");
    gone(at, "kill");
  }

  // ---------- the delete, and the replacement ----------
  let termAt = Infinity, killAt = Infinity, replaceAt = Infinity, readyAt = Infinity;
  function remove(at) {
    if (phase !== "open") return false;
    const d = uni(rNet, ROUTER[cfg.router]);
    phase = "prestop"; listed = false;
    news = { kind: "remove", sent: at, at: at + d };
    sd = { t0: at, d, term: null, gone: null, how: "", served: 0, refused: 0, cut: 0, killed: 0, exportsCut: 0, inflight: inflight.length, exports: inflight.filter((r) => r.long).length, killedAt: null };
    shutdowns.push(sd);
    termAt = at + cfg.preStop; killAt = at + cfg.grace;
    log.push({ t: at, type: "delete", d });
    if (cfg.preStop === 0) { termAt = Infinity; sigterm(at); }
    return true;
  }
  function replace(at) {
    phase = "starting"; replaceAt = Infinity; readyAt = at + REPLACE.start;
    log.push({ t: at, type: "starting" });
  }
  function ready(at) {
    phase = "open"; listening = true; listed = true; readyAt = Infinity;
    news = { kind: "add", sent: at, at: at + uni(rNet, ROUTER[cfg.router]) };
    log.push({ t: at, type: "ready" });
  }

  // keep-alive mode: B starts with its regulars already connected and busy
  if (cfg.conns === "keep") for (let i = 0; i < REGULARS; i++) {
    const reg = { id: nextClient++, spot: REG_SPOTS[i], req: null, next: exp(rNet, 1 / THINK), closing: false };
    regs.push(reg);
  }

  function next() {
    let when = Infinity, what = null, who = null;
    const consider = (at, w, x = null) => { if (at < when) { when = at; what = w; who = x; } };
    consider(nextArrival, "arrive");
    for (const w of walking) consider(w.at, "door", w);
    for (const r of inflight) consider(r.end, "done", r);
    for (const g of regs) if (!g.req && !g.closing) consider(g.next, "regreq", g);
    for (const a of away) consider(a.next, "reconnect", a);
    if (news) consider(news.at, "news");
    consider(termAt, "term");
    consider(killAt, "kill");
    consider(replaceAt, "replace");
    consider(readyAt, "ready");
    if (cfg.auto && phase === "open" && routed) consider(autoAt, "auto");
    return { when, what, who };
  }

  function runTo(until) {
    for (;;) {
      const e = next();
      if (e.when > until) break;
      t = e.when;
      switch (e.what) {
        case "arrive": route(t); nextArrival = t + exp(rArr, RATE * PODS); break;
        case "door": reachDoor(e.who); break;
        case "done": finish(e.who); break;
        case "regreq": startReq(t, e.who.spot, e.who); break;
        case "reconnect": away.splice(away.indexOf(e.who), 1); route(t, e.who.id); break;
        case "news":
          routed = news.kind === "add";
          if (news.kind === "remove" && sd) sd.knew = t;
          log.push({ t, type: "news", kind: news.kind });
          if (routed) {
            autoAt = t + OPEN_FOR;
            // the clients' pools open connections to the new pod
            if (cfg.conns === "keep") for (let i = 0; i < REGULARS; i++) {
              const spot = regSpot();
              const w = { id: nextId++, at: t + WALK + 0.4 * i, routedAt: t + 0.4 * i, client: nextClient++, spot };
              walking.push(w); log.push({ t, type: "routed", w });
            }
          }
          news = null;
          break;
        case "term": termAt = Infinity; sigterm(t); break;
        case "kill": killAt = Infinity; sigkill(t); break;
        case "replace": replace(t); break;
        case "ready": ready(t); break;
        case "auto": remove(t); break;
      }
    }
    t = until;
  }

  return {
    cfg, inflight, regs, walking, log, st, shutdowns, runTo,
    remove: (at) => { runTo(at); return remove(at); },
    get t() { return t; },
    get phase() { return phase; },
    get listening() { return listening; },
    get routed() { return routed; },
    get listed() { return listed; },
    get news() { return news; },
    get sd() { return sd; },
  };
}

// ---------- experiments: one shutdown per seed, averaged ----------
export const SEEDS = [3, 7, 11, 19, 23, 31, 43, 59, 67, 71, 79, 83, 97, 101, 113, 127];
const avg = (fn) => averageOver(SEEDS, fn);

/** Delete B after a warm-up and follow the shutdown to its end. */
export function shutdownRun(cfg) {
  return avg((seed) => {
    const warm = cfg.work === "exports" ? 80 : 25;
    const m = makeSim(cfg, seed);
    m.runTo(warm);
    m.remove(warm);
    m.runTo(warm + (cfg.grace ?? DEFAULTS.grace) + 20);
    const s = m.sd;
    return { refused: s.refused, cut: s.cut, killed: s.killed, served: s.served, took: s.gone - s.t0, d: s.d, inflight: s.inflight, exports: s.exports, exportsCut: s.exportsCut, failed: s.refused + s.cut, killedRun: s.killedAt != null ? 1 : 0 };
  });
}

export const BASE = { onTerm: "stop", preStop: 0, grace: 30, work: "short", conns: "new", router: "fast" };
export const runExit = () => ({ exit: shutdownRun({ ...BASE, onTerm: "exit" }), stop: shutdownRun(BASE) });
export const runSleep = () => ({ none: shutdownRun(BASE), five: shutdownRun({ ...BASE, preStop: 5 }) });
export const runSlow = () => ({ fast: shutdownRun({ ...BASE, preStop: 5 }), five: shutdownRun({ ...BASE, preStop: 5, router: "slow" }), fifteen: shutdownRun({ ...BASE, preStop: 15, router: "slow" }) });
export const runGrace = () => ({ g30: shutdownRun({ ...BASE, preStop: 15, work: "exports" }), g60: shutdownRun({ ...BASE, preStop: 15, work: "exports", grace: 60 }) });
export const runKeep = () => ({ stop: shutdownRun({ ...BASE, preStop: 5, conns: "keep" }), drain: shutdownRun({ ...BASE, preStop: 5, conns: "keep", onTerm: "drain" }), fresh: shutdownRun({ ...BASE, preStop: 5 }) });

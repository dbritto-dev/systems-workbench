// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// One page load, as a discrete-event model. A profile page needs four pieces of data: the user (the header), their
// posts, the viewer's notifications (the sidebar) and the comments under the posts. How the page asks for them decides
// which requests wait for which:
//
//   mode "render"    fetch on render: each component fetches its own data after it renders. App fetches /user and
//                    renders the layout when it lands; Posts and Sidebar mount then and fetch /posts and /notifs;
//                    Comments mounts when the posts render and fetches /comments.
//        "parallel"  App starts /user, /posts and /notifs together when it mounts; each part renders when its data
//                    lands. Comments still mounts with the posts and fetches then.
//        "loader"    a route loader starts every request the page needs before anything renders, and starts
//                    /comments the moment /posts lands (it needs the post ids). With a lazy chunk, the loader starts
//                    its download at the same time.
//        "bff"       one request, /page, to a backend for frontend that calls the services itself (2 ms away) and
//                    returns everything nested in one response.
//   split  "bundle"  Comments is in main.js; "lazy": it is its own chunk, comments.js, loaded when first needed.
//   start  "first"   a first visit: HTML, then main.js, then the app runs. "click": a click on a link in an app that is
//                    already running. "hover": the same click, with the pointer resting on the link HOVER ms first.
//   rtt              the round trip between the browser and the server, in ms.
//   servers          "normal"; "fast": every API answers in half the time; "slow": /notifs takes about 800 ms.
//
// Every request costs a round trip plus its server time plus its bytes over the link. One HTTP/2 connection is open
// already, so requests in flight don't wait for each other, and transfers don't share bandwidth (the bytes here are
// small next to the round trips). The main thread runs one task at a time: running JavaScript, and a render after
// each piece of data lands. Times are ms from the start (the first request, or the click).

import { rngMixed, normal } from "../../lib/random";
import { minHeap } from "../../lib/events";
import { averageOver } from "../../lib/stats";

export const LANES = ["html", "main", "chunk", "user", "posts", "notifs", "comments", "page"];
export const NAMES = { html: "HTML", main: "main.js", chunk: "comments.js", user: "/user", posts: "/posts", notifs: "/notifs", comments: "/comments", page: "/page" };
export const API = ["user", "posts", "notifs", "comments"];
export const PARTS = ["user", "posts", "notifs", "comments"];

export const KB = { html: 18, main: 260, mainSplit: 220, chunk: 40, user: 1, posts: 30, notifs: 6, comments: 18 };
KB.page = KB.user + KB.posts + KB.notifs + KB.comments;
export const SERVER = { html: 30, main: 5, chunk: 5, user: 40, posts: 90, notifs: 60, comments: 70 };   // median ms
export const SLOW_NOTIFS = 800;
export const BW = 2.5;              // KB per ms: 20 Mbit/s
export const EXEC_PER_KB = 0.35;    // ms of parsing and running per KB of JavaScript
export const RENDER = 12;           // ms for a render and commit
export const INNER_RTT = 2;         // ms between the backend for frontend and the services
export const BFF_OWN = 10;          // ms of the backend for frontend's own work
export const HOVER = 250;           // ms the pointer rests on the link before the click
export const DEFAULTS = { mode: "render", split: "bundle", start: "first", rtt: 150, servers: "normal" };

// The server times of one load, drawn in a fixed order so every configuration with the same seed meets the same
// servers (a fair comparison): log-normal around the median, ±30% typical.
export function serverTimes(seed, servers = "normal") {
  const r = rngMixed(seed);
  const out = {};
  for (const k of ["html", "main", "chunk", "user", "posts", "notifs", "comments"]) {
    const jitter = Math.exp(0.3 * normal(r));
    let ms = SERVER[k] * jitter;
    if (servers === "fast" && API.includes(k)) ms *= 0.5;
    if (servers === "slow" && k === "notifs") ms = SLOW_NOTIFS * jitter;
    out[k] = ms;
  }
  return out;
}

export function makeLoad(cfgIn = {}, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const R = cfg.rtt, lazy = cfg.split === "lazy", mode = cfg.mode;
  const srv = serverTimes(seed, cfg.servers);
  const q = minHeap((a, b) => a.t < b.t || (a.t === b.t && a.n < b.n));
  let n = 0;
  const at = (t, fn) => q.push({ t, n: n++, fn });

  // ---------- the network ----------
  const reqs = {};
  // A request: out to the server (half a round trip), the server's time, back with its bytes.
  function request(t, name, depth, why) {
    if (reqs[name]) return reqs[name];
    const kb = name === "main" ? (lazy ? KB.mainSplit : KB.main) : KB[name];
    const r = { name, t0: t, depth, why, kb, waiters: [], done: false, inner: [] };
    r.arrive = t + R / 2;
    if (name === "page") {
      // The backend for frontend fans out to the services: /user, /posts and /notifs at once, /comments once /posts
      // has answered. Each call is a short hop inside the data center.
      const call = (svc, from) => { const c = { name: svc, t0: from, t1: from + INNER_RTT + srv[svc] }; r.inner.push(c); return c; };
      const u = call("user", r.arrive), p = call("posts", r.arrive), no = call("notifs", r.arrive), c = call("comments", p.t1);
      r.leave = Math.max(u.t1, no.t1, c.t1) + BFF_OWN;
    } else r.leave = r.arrive + srv[name];
    r.t1 = r.leave + R / 2 + kb / BW;
    reqs[name] = r;
    at(r.t1, () => { r.done = true; for (const w of r.waiters) w(r.t1, r.depth); });
    return r;
  }
  const when = (r, fn) => { if (r.done) fn(r.t1, r.depth); else r.waiters.push(fn); };

  // ---------- the main thread: one task at a time ----------
  const cpu = [];
  let free = -Infinity;
  function task(t, what, ms, depth, then) {
    const t0 = Math.max(t, free), c = { what, t0, t1: t0 + ms, depth };
    free = c.t1;
    cpu.push(c);
    at(c.t1, () => then && then(c.t1, depth));
    return c;
  }

  // ---------- what shows on screen ----------
  const shown = {};
  const show = (parts, t, depth) => { for (const p of parts) if (!shown[p]) shown[p] = { t, depth }; };
  const ready = (count, fn) => { let left = count, tt = 0, dd = 0; return (t, d) => { tt = Math.max(tt, t); dd = Math.max(dd, d); if (--left === 0) fn(tt, dd); }; };

  // Comments can render once their code has run (main.js, or comments.js) and their data is in.
  let chunkRun = null;            // the comments.js run, once it has happened: { t, depth }
  const chunkWaiters = [];
  function loadChunk(t, depth) {
    const r = request(t, "chunk", depth + 1, "lazy");
    when(r, (t1, d) => task(t1, "run comments.js", KB.chunk * EXEC_PER_KB, d, (t2, d2) => { chunkRun = { t: t2, depth: d2 }; for (const w of chunkWaiters) w(t2, d2); }));
  }
  const afterChunk = (fn) => { if (chunkRun) fn(chunkRun.t, chunkRun.depth); else chunkWaiters.push(fn); };

  // A component that fetches on render: when it mounts, it fetches; when the data lands, it renders.
  function renderPart(part, t, depth) { task(t, "render " + part, RENDER, depth, (t1, d) => show([part], t1, d)); }

  // Comments, in the fetch-on-render modes: they mount when the posts render.
  function mountComments(t, depth) {
    const go = (t1, d) => when(request(t1, "comments", d + 1, "render"), (t2, d2) => renderPart("comments", t2, d2));
    if (!lazy) go(t, depth);
    else {
      // React.lazy: the chunk is requested when Comments first renders; the component renders (and fetches) after it runs.
      loadChunk(t, depth);
      afterChunk((t1, d) => task(t1, "render Comments", RENDER, d, go));
    }
  }

  function fetchOnRender(t, depth) {
    task(t, "render App", RENDER, depth, (t1, d) => {
      const user = request(t1, "user", d + 1, "render");
      if (mode === "render") {
        when(user, (t2, d2) => task(t2, "render user", RENDER, d2, (t3, d3) => {
          show(["user"], t3, d3);
          // Posts and Sidebar mount in that render and fetch now.
          when(request(t3, "posts", d3 + 1, "render"), (t4, d4) => task(t4, "render posts", RENDER, d4, (t5, d5) => { show(["posts"], t5, d5); mountComments(t5, d5); }));
          when(request(t3, "notifs", d3 + 1, "render"), (t4, d4) => renderPart("notifs", t4, d4));
        }));
      } else {
        // parallel: App starts all three at mount.
        when(user, (t2, d2) => renderPart("user", t2, d2));
        when(request(t1, "posts", d + 1, "app"), (t2, d2) => task(t2, "render posts", RENDER, d2, (t3, d3) => { show(["posts"], t3, d3); mountComments(t3, d3); }));
        when(request(t1, "notifs", d + 1, "app"), (t2, d2) => renderPart("notifs", t2, d2));
      }
    });
  }

  // The route loader (or the one /page request) starts at `t`; nothing renders before `click`.
  function loader(t, depth, click) {
    if (lazy) loadChunk(t, depth);
    const comments = (t1, d) => {
      if (!lazy) task(Math.max(t1, click), "render comments", RENDER, d, (t2, d2) => show(["comments"], t2, d2));
      else afterChunk((t2, d2) => task(Math.max(t1, t2, click), "render comments", RENDER, Math.max(d, d2), (t3, d3) => show(["comments"], t3, d3)));
    };
    if (mode === "bff") {
      when(request(t, "page", depth + 1, "loader"), (t1, d) => {
        task(Math.max(t1, click), "render page", 2 * RENDER, d, (t2, d2) => { show(["user", "posts", "notifs"], t2, d2); if (!lazy) show(["comments"], t2, d2); else comments(t2, d2); });
      });
      return;
    }
    for (const part of ["user", "notifs"]) when(request(t, part, depth + 1, "loader"), (t1, d) => task(Math.max(t1, click), "render " + part, RENDER, d, (t2, d2) => show([part], t2, d2)));
    const posts = request(t, "posts", depth + 1, "loader");
    when(posts, (t1, d) => {
      // The loader asks for the comments the moment the post ids arrive, while the posts render.
      const both = ready(2, (tt, dd) => comments(tt, dd));
      task(Math.max(t1, click), "render posts", RENDER, d, (t2, d2) => { show(["posts"], t2, d2); both(t2, d2); });
      when(request(t1, "comments", d + 1, "loader"), both);
    });
  }

  function startApp(t, depth) {
    if (mode === "loader" || mode === "bff") { loader(t, depth, t); task(t, "render shell", RENDER, depth); }
    else fetchOnRender(t, depth);
  }

  if (cfg.start === "first") {
    when(request(0, "html", 1, "visit"), (t1, d) => {
      when(request(t1, "main", d + 1, "html"), (t2, d2) => task(t2, "run main.js", (lazy ? KB.mainSplit : KB.main) * EXEC_PER_KB, d2, startApp));
    });
  } else if (cfg.start === "hover" && (mode === "loader" || mode === "bff")) {
    // Prefetch on hover: the router knows the route's loader, so it starts it when the pointer rests on the link.
    loader(-HOVER, 0, 0);
    at(0, () => task(0, "render shell", RENDER, 0));
  } else {
    // A click (or a hover the components can't use: their requests are inside components that haven't rendered).
    startApp(0, 0);
  }

  for (let guard = 0; q.size && guard < 10000; guard++) { const e = q.pop(); e.fn(); }

  const all = Math.max(...PARTS.map((p) => shown[p].t));
  const list = LANES.filter((k) => reqs[k]).map((k) => reqs[k]);
  // The most requests in flight at once.
  let flight = 0;
  for (const r of list) flight = Math.max(flight, list.filter((o) => o.t0 <= r.t0 && o.t1 > r.t0).length);
  return {
    cfg, srv, reqs, cpu, shown, all, flight,
    t0: cfg.start === "hover" ? -HOVER : 0,
    chain: Math.max(...PARTS.map((p) => shown[p].depth)),
    requests: list.length,
    kb: list.reduce((s, r) => s + r.kb, 0),
  };
}

// ---------- measuring ----------
export const SEEDS = [3, 7, 11, 19, 23, 31, 43, 47, 59, 61, 71, 83];
export function measure(cfg) {
  return averageOver(SEEDS, (seed) => {
    const m = makeLoad(cfg, seed);
    return { user: m.shown.user.t, posts: m.shown.posts.t, notifs: m.shown.notifs.t, comments: m.shown.comments.t, all: m.all, chain: m.chain, requests: m.requests, kb: m.kb, flight: m.flight };
  });
}

// The experiments, all at a 150 ms round trip.
export const RTT = 150;
export function experimentResults() {
  const base = { rtt: RTT, start: "first", split: "bundle", servers: "normal" };
  return {
    faster: { normal: measure({ ...base, mode: "render" }), fast: measure({ ...base, mode: "render", servers: "fast" }) },
    parallel: { render: measure({ ...base, mode: "render" }), parallel: measure({ ...base, mode: "parallel" }), loader: measure({ ...base, mode: "loader" }) },
    split: {
      bundle: measure({ ...base, mode: "render" }), lazy: measure({ ...base, mode: "render", split: "lazy" }),
      loaderBundle: measure({ ...base, mode: "loader" }), loaderLazy: measure({ ...base, mode: "loader", split: "lazy" }),
    },
    prefetch: {
      click: measure({ ...base, mode: "loader", start: "click" }), hover: measure({ ...base, mode: "loader", start: "hover" }),
      renderClick: measure({ ...base, mode: "render", start: "click" }), renderHover: measure({ ...base, mode: "render", start: "hover" }),
    },
    bff: {
      loader: measure({ ...base, mode: "loader" }), bff: measure({ ...base, mode: "bff" }),
      loaderSlow: measure({ ...base, mode: "loader", servers: "slow" }), bffSlow: measure({ ...base, mode: "bff", servers: "slow" }),
    },
  };
}

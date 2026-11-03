// @ts-nocheck: live code ported as-is; shared helpers come from src/runtime and src/lib.
// The count room in the browser: plans the clerk's walk over the ballots, flies a token per vote into its tube,
// keeps the standings, and answers the controls. mount() gets the build-time data from page.ts (geometry, part
// drawings) and root, the <wb-lesson>.
import { translateAlong, solidSvg, cylinder } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L as tr } from "../../runtime/wb";
import { playPause } from "../../runtime/dom";
import { lerpVec, smoothstep } from "../../lib/tween";
import { QUERY, JUDGES, countOrder, pointsOf, rrfShare } from "./sim";

export default function mount({ P, G, CLERK_SVG, FLIGHT_SVG }, root) {
  const NAME_ES = { keyword: "PALABRAS", meaning: "SIGNIFICADO", clicks: "CLICS" };            // as on the ballot boards
  const LIST_ES = { keyword: "palabras clave", meaning: "significado", clicks: "clics" };
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const say = (text) => root.figure.say(text);
  const NS = "http://www.w3.org/2000/svg";

  // the clerk: a pooled group moved with translateAlong
  const clerk = document.createElementNS(NS, "g");
  clerk.innerHTML = CLERK_SVG;
  q('[data-layer="clerk"]').appendChild(clerk);
  const flight = document.createElementNS(NS, "g");
  flight.innerHTML = FLIGHT_SVG;
  q('[data-layer="flight"]').appendChild(flight);

  const counters = Object.fromEntries(G.DOC_IDS.map((id) => [id, WB.counter(svg, "pts-" + id, P)]));
  const stacks = Object.fromEntries(G.DOC_IDS.map((id) => [id, q('[data-stack="' + id + '"]')]));
  const caps = Object.fromEntries(G.DOC_IDS.map((id) => [id, q('[data-cap="' + id + '"]')]));
  const kDial = WB.dial(svg, "k", P);
  const judgeEl = Object.fromEntries(JUDGES.map((j) => [j, q('[data-judge="' + j + '"]')]));
  const weightText = Object.fromEntries(JUDGES.map((j) => [j, q('[data-weight="' + j + '"]')]));
  const modeSolid = q("[data-mode] .iso-solid"), modeText = q("[data-mode-text]");
  const places = [1, 2, 3, 4, 5].map((p) => ({ solid: q('[data-place="' + p + '"] .iso-solid'), id: q('[data-place-id="' + p + '"]'), pts: q('[data-place-pts="' + p + '"]') }));
  const cardEl = (j, r) => q('[data-card="' + j + "-" + r + '"]');
  const cardSolid = (j, r) => q('[data-card="' + j + "-" + r + '"] .iso-solid');

  const cfg = { mode: "rrf", k: 60, judges: 2, weight: 1, depth: 8, speed: 1 };
  const WALK = 120, PICK = 0.35, FLY = 0.85, HOLD = 5;
  let plan, clock, shown = {};

  function use() { return cfg.judges === 3 ? JUDGES : JUDGES.slice(0, 2); }
  function weightOf(j) { return j === "clicks" ? cfg.weight : 1; }

  // the schedule: walk to the ballot, pick the card, fly the token to its tube
  function makePlan() {
    const votes = countOrder(QUERY.lists, { depth: cfg.depth, use: use() }).map((v) => ({ ...v, w: weightOf(v.list), pts: pointsOf(v, { k: cfg.k, mode: cfg.mode, w: weightOf(v.list) }), add: cfg.mode === "raw" ? weightOf(v.list) * v.raw : rrfShare(v.rank, cfg.k, weightOf(v.list)) }));
    let t = 0, pos = G.AT.home;
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    for (const v of votes) {
      const ballot = G.AT.ballot[v.list];
      v.t0 = t; v.from = pos; v.ballot = ballot;
      v.t1 = t + dist(pos, ballot) / WALK; v.t2 = v.t1 + PICK; v.t4 = v.t2 + FLY;
      v.src = G.CARD_AT[v.list + v.rank];
      v.dst = [G.TUBE_X[G.DOC_IDS.indexOf(v.id)], G.TUBE_Y, 0];
      t = v.t4; pos = ballot;
    }
    return { votes, end: t };
  }

  function restart(at) {
    plan = makePlan();
    clock = at ?? plan.end * 0.55;
    shown = {};
    for (const j of JUDGES) {
      judgeEl[j].toggleAttribute("data-off", !use().includes(j));
      for (let r = 1; r <= G.SLOTS; r++) q('[data-slot="' + j + "-" + r + '"]').toggleAttribute("data-hidden", r > cfg.depth);
    }
    modeSolid.toggleAttribute("data-lit", cfg.mode === "raw");
    plaques();
    kDial.set(Math.log10(cfg.k) / 3);
    paint();
  }

  // the words on the weight and mode plaques
  function plaques() {
    for (const j of JUDGES) weightText[j].textContent = use().includes(j) ? "×" + weightOf(j) : tr("off", "fuera");
    modeText.textContent = cfg.mode === "raw" ? tr("raw scores added", "puntajes sumados") : tr("1 / (k + rank)", "1 / (k + puesto)");
  }

  const fmtScore = (x) => cfg.mode === "raw" ? x.toFixed(1) : x.toFixed(5);

  function tokenSvg(tx, z, h, tone, lit) {
    return solidSvg(cylinder(tx, G.TUBE_Y, G.COL.r, z, Math.max(0.35, h), P, 24, Math.min(0.3, h / 4)), { tone, crease: "lo", lit });
  }

  function paint() {
    const votes = plan.votes;
    const t = Math.min(clock, plan.end);
    const done = votes.filter((v) => v.t4 <= t);
    const cur = votes.find((v) => v.t4 > t) || null;
    const perDone = {};
    for (const v of done) perDone[v.id] = (perDone[v.id] || 0) + v.pts;

    // the clerk walks the ballots; once a card is picked, its token flies in an arc to the tube
    let pos = G.AT.home;
    if (cur) pos = t < cur.t1 ? lerpVec(cur.from, cur.ballot, (t - cur.t0) / Math.max(1e-6, cur.t1 - cur.t0)) : cur.ballot;
    else if (votes.length) pos = votes[votes.length - 1].ballot;
    clerk.setAttribute("transform", translateAlong(P, pos));
    if (cur && t >= cur.t2) {
      const f = Math.min(1, (t - cur.t2) / FLY), e = smoothstep(f);
      const stackTop = G.COL.z0 + Math.min(G.COL.top - G.COL.z0, (perDone[cur.id] || 0) * G.SCALE);
      const x = cur.src[0] + (cur.dst[0] - cur.src[0]) * e, y = cur.src[1] + (cur.dst[1] - cur.src[1]) * e;
      const z = cur.src[2] + (stackTop - cur.src[2]) * e + Math.sin(Math.PI * f) * 26;
      flight.setAttribute("transform", translateAlong(P, [x, y, z]));
      flight.style.display = "";
    } else flight.style.display = "none";

    // ballot cards: counted ones fade, the one in hand is lit
    for (const j of JUDGES) for (let r = 1; r <= G.SLOTS; r++) {
      const counted = done.some((v) => v.list === j && v.rank === r);
      const now = cur && cur.list === j && cur.rank === r && t >= cur.t1;
      const key = j + r, state = now ? "lit" : counted ? "done" : "wait";
      if (shown[key] !== state) { shown[key] = state; cardEl(j, r).toggleAttribute("data-counted", state === "done"); cardSolid(j, r).toggleAttribute("data-lit", state === "lit"); }
    }

    // tubes: one token per counted vote, newest lit for a moment
    const per = Object.fromEntries(G.DOC_IDS.map((id) => [id, []]));
    for (const v of done) per[v.id].push(v);
    for (const id of G.DOC_IDS) {
      const vs = per[id], last = vs[vs.length - 1];
      const fresh = last && t - last.t4 < 0.8;
      const key = "s" + id, sig = vs.length + (fresh ? "*" : "") + cfg.mode + cfg.k;
      if (shown[key] === sig) continue;
      shown[key] = sig;
      const tx = G.TUBE_X[G.DOC_IDS.indexOf(id)];
      let z = G.COL.z0, html = "", over = false;
      vs.forEach((v, n) => {
        let h = v.pts * G.SCALE;
        if (z + h > G.COL.top) { h = G.COL.top - z; over = true; }
        if (h > 0.05) html += tokenSvg(tx, z, h, G.JUDGE_TONE[v.list], fresh && n === vs.length - 1);
        z += h;
      });
      stacks[id].innerHTML = html;
      caps[id].style.display = over ? "" : "none";
      counters[id].set(Math.round(vs.reduce((a, v) => a + v.pts, 0)));
    }

    // standings over what has been counted so far
    const tally = new Map();
    for (const v of done) { const e = tally.get(v.id) || { id: v.id, score: 0, pts: 0, best: 99 }; e.score += v.add; e.pts += v.pts; e.best = Math.min(e.best, v.rank); tally.set(v.id, e); }
    const order = [...tally.values()].sort((a, b) => b.score - a.score || a.best - b.best || Number(a.id.slice(1)) - Number(b.id.slice(1)));
    places.forEach((p, i) => {
      const e = order[i], txt = e ? e.id : "–", pts = e ? Math.round(e.pts) + " pts" : "";
      if (p.id.textContent !== txt) p.id.textContent = txt;
      if (p.pts.textContent !== pts) p.pts.textContent = pts;
      p.solid.toggleAttribute("data-lit", i === 0 && !!e);
    });

    // stats and readout
    stat("counted", done.length + " / " + votes.length);
    stat("leader", order[0] ? order[0].id : "–");
    stat("score", order[0] ? fmtScore(order[0].score) : "–");
    stat("rel", order.slice(0, 5).filter((e) => QUERY.docs[e.id].rel > 0).length + tr(" of ", " de ") + Math.min(5, order.length));
    stat("first", cfg.mode === "raw" ? tr("its own score", "su propio puntaje") : "1/" + (cfg.k + 1) + " = " + (1 / (cfg.k + 1)).toFixed(4));
    stat("eighth", cfg.mode === "raw" ? "–" : Math.round(100 * (cfg.k + 1) / (cfg.k + 8)) + "%");
    if (cur && t >= cur.t1) {
      const name = tr(cur.list.toUpperCase(), NAME_ES[cur.list]);
      const rawShown = cur.list === "meaning" ? cur.raw.toFixed(2) : cur.raw;
      const share = (cur.w !== 1 ? cur.w + " × " : "") + "1/(" + cfg.k + " + " + cur.rank + ") = " + cur.add.toFixed(5);
      const worth = cfg.mode === "raw" ? tr("adds its raw score " + rawShown, "suma su puntaje crudo " + rawShown) : tr("adds ", "suma ") + share;
      say(name + " #" + cur.rank + " · " + cur.id + " “" + QUERY.docs[cur.id].title + "” · " + worth);
    } else if (!cur) say(tr("count done · " + (order[0] ? order[0].id + " leads with " + fmtScore(order[0].score) : "") + " · counting again shortly",
      "conteo terminado · " + (order[0] ? order[0].id + " lidera con " + fmtScore(order[0].score) : "") + " · se vuelve a contar en un momento"));
    else say(tr("walking to the " + cur.list + " ballot for rank " + cur.rank, "caminando a la boleta de " + LIST_ES[cur.list] + " para el puesto " + cur.rank));
  }
  const stat = (key, value) => root.stat(key, value);

  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; if (clock > plan.end + HOLD) restart(0); else paint(); }, onPause: pause.onPause });
  pause.bind(loop);

  function set(name, raw, quiet) {
    root.press(name, raw);
    if (name === "speed") { cfg.speed = Number(raw); return; }
    cfg[name] = ["k", "judges", "weight", "depth"].includes(name) ? Number(raw) : raw;
    if (!quiet) restart(0);
  }
  root.on("change", (name, value) => set(name, value));
  const actions = {
    finish: () => { clock = plan.end; paint(); },
    reset: () => { restart(0); if (loop.paused) loop.setPaused(false); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine": an experiment's settings ----------
  root.on("watch", (w) => {
    for (const name of ["mode", "k", "judges", "weight", "depth"]) set(name, String(w[name]), true);
    restart(0);
    if (loop.paused) loop.setPaused(false);
  });

  loop.setPaused(loop.paused);
  restart();
}

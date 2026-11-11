// @ts-nocheck: live code in the style of the other lessons; shared helpers come from src/runtime and src/lib.
// The GitOps machine in the browser: runs the model, walks the reconciler along its aisle, stands the pods on WEB,
// lights what differs from git, and answers the controls. mount() gets the build-time data from page.ts (projection,
// geometry, the drawings of the moving parts) and root, the <wb-lesson>.
import { translateAlong, depthOf } from "../../../workbench/vendor-anatomy/kit/iso-kit.mjs";
import * as WB from "../../runtime/wb";
import { L, T } from "../../runtime/wb";
import { show, setText, setLit, playPause } from "../../runtime/dom";
import { makeSim, CAP } from "./sim";

export default function mount({ P, G, WALKER, WALKER_SYNC, POD_READY, POD_START }, root) {
  const { stage, svg } = root.figure;
  const q = (s) => svg.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const counters = Object.fromEntries(["rev", "has", "next", "syncs", "undone", "version", "replicas", "limit", "jobs", "wants", "failed"].map((n) => [n, WB.counter(svg, n, P)]));
  const load = WB.meter(svg, "load", P);
  const litc = Object.fromEntries(["version", "replicas", "limit"].map((n) => [n, q(`[data-litc="${n}"]`)]));
  const cards = Object.fromEntries(["web", "config", "worker"].map((n) => [n, { g: q(`[data-card="${n}"]`), pin: q(`[data-pin="${n}"]`), text: q(`[data-card-text="${n}"]`) }]));
  const outsync = q("[data-outsync]");
  const switches = { selfHeal: q('[data-switch="selfHeal"]'), prune: q('[data-switch="prune"]') };
  const hookWire = q("[data-hook-wire]");
  const bell = { on: q('[data-bell="on"]'), off: q('[data-bell="off"]') };
  const lampEl = { on: q('[data-lamp="on"]'), off: q('[data-lamp="off"]') };
  const workerEl = q("[data-worker]"), workerGone = q("[data-worker-gone]");
  const people = { dev: q("[data-dev]"), eng: q("[data-eng]") };
  const walkLayer = q('[data-layer="walk"]'), podLayer = q('[data-layer="pods"]');

  // ---------- the walker ----------
  const walker = document.createElementNS(NS, "g");
  walker.innerHTML = `<g data-w="off">${WALKER}</g><g data-w="on" style="display:none">${WALKER_SYNC}</g>`;
  const wOff = walker.querySelector('[data-w="off"]'), wOn = walker.querySelector('[data-w="on"]');
  walkLayer.appendChild(walker);

  // ---------- pods: one pooled element per pod, each in its own slot ----------
  const podEls = new Map(), slotOf = new Map(), free = [];
  function podEl() {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = `<g data-h="ready">${POD_READY}</g><g data-h="start">${POD_START}</g>`;
    return { g, ready: g.querySelector('[data-h="ready"]'), start: g.querySelector('[data-h="start"]'), texts: [...g.querySelectorAll("[data-pod-text]")], state: null, label: null, lit: null };
  }

  // ---------- settings and the run ----------
  const cfg = { selfHeal: "on", prune: "on", poll: "poll", replicas: "hpa", traffic: "normal", speed: 4 };
  let m, clock, logAt, seed = 3, saidAt = -9, saidRank = 0, held = null, jump = null;
  const flash = { dev: -9, eng: -9 };
  const simCfg = () => ({ selfHeal: cfg.selfHeal === "on", prune: cfg.prune === "on", poll: cfg.poll, replicas: cfg.replicas, traffic: cfg.traffic });

  function restart(watch) {
    for (const [, e] of podEls) { e.g.remove(); free.push(e); }
    podEls.clear(); slotOf.clear();
    if (watch) m = makeSim({ ...simCfg(), ...watch.sim }, seed, watch.script);
    else m = makeSim({ ...simCfg(), auto: true }, seed);
    seed = (seed * 7 + 3) % 9973 + 1;
    clock = watch?.from ?? 0;
    m.runTo(clock);
    logAt = m.log.length; saidAt = -9; saidRank = 0; held = null; flash.dev = flash.eng = -9;
    jump = watch?.jump ?? null;
    paint();
    showStats();
  }

  // ---------- narration ----------
  function say(rank, text) {
    const wall = performance.now() / 1000;
    if (rank < saidRank && wall - saidAt < 1.4) { if (!held || rank >= held.rank) held = { rank, text }; return; }
    held = null; saidRank = rank; saidAt = wall;
    root.figure.say(L(text));
  }
  function sayHeld() { if (held && performance.now() / 1000 - saidAt >= 1.4) { const h = held; held = null; saidRank = -1; say(h.rank, h.text); } }
  const webText = (s) => "v" + s.image + " ×" + s.replicas;
  function narrate() {
    for (; logAt < m.log.length; logAt++) {
      const e = m.log[logAt];
      if (e.t > clock) break;
      const rev = e.rev;
      switch (e.type) {
        case "commit":
          flash.dev = e.t;
          if (e.what === "release") say(3, T("merged rev " + rev + " · web v" + e.spec.image + " · git is ahead", "se fusionó la rev " + rev + " · web v" + e.spec.image + " · git va adelante"));
          else if (e.what === "revert") say(3, T("rev " + rev + " reverts web to v" + e.spec.image + " in git", "la rev " + rev + " revierte web a v" + e.spec.image + " en git"));
          else if (e.what === "remove") say(3, T("rev " + rev + " removes the worker from git", "la rev " + rev + " quita el worker de git"));
          else if (e.what === "restore") say(3, T("rev " + rev + " puts the worker back in git", "la rev " + rev + " vuelve a poner el worker en git"));
          else if (e.what === "replicas") say(3, e.spec.replicas === null ? T("rev " + rev + " leaves replicas to the HPA", "la rev " + rev + " deja las réplicas al HPA") : T("rev " + rev + " sets replicas: 3 in git", "la rev " + rev + " fija replicas: 3 en git"));
          break;
        case "fetch":
          if (e.why === "hook") say(2, T("webhook · the reconciler reads git now", "webhook · el reconciliador lee git ya"));
          else say(1, T("timer · the reconciler walks over to read git", "temporizador · el reconciliador va a leer git"));
          break;
        case "read": {
          const d = m.diff(), pruneOnly = d.length && d.every((x) => x === "prune");
          if (pruneOnly && !m.cfg.prune) say(4, T("rev " + rev + " · worker not in git · prune off: it keeps running", "rev " + rev + " · el worker no está en git · sin prune: sigue corriendo"));
          else if (e.fresh) say(3, T("read rev " + rev + " · comparing with the cluster", "leyó la rev " + rev + " · compara con el clúster"));
          else if (d.length && !m.cfg.selfHeal) say(3, T("read rev " + rev + " · nothing new · drift stays: self-heal off", "leyó la rev " + rev + " · nada nuevo · la deriva sigue: sin self-heal"));
          else say(0, T("read rev " + rev + " · nothing new", "leyó la rev " + rev + " · nada nuevo"));
          break;
        }
        case "sync":
          if (e.why === "heal") say(4, T("self-heal · walking to put git's value back", "self-heal · va a poner el valor de git"));
          else if (e.why === "manual") say(3, T("sync · applying rev " + rev, "sync · aplica la rev " + rev));
          else say(3, T("automated sync · applying rev " + rev, "sync automático · aplica la rev " + rev));
          break;
        case "apply":
          if (e.what === "web") {
            if (e.from.image !== e.to.image) say(4, T("web → v" + e.to.image + " · pods roll over", "web → v" + e.to.image + " · los pods se reemplazan"));
            else if (e.to.replicas < e.from.replicas) say(5, T("replicas " + e.from.replicas + " → " + e.to.replicas + " · git says " + e.to.replicas + " · pods killed", "réplicas " + e.from.replicas + " → " + e.to.replicas + " · git dice " + e.to.replicas + " · pods eliminados"));
            else say(3, T("replicas → " + e.to.replicas, "réplicas → " + e.to.replicas));
          } else if (e.what === "worker") say(3, T("the worker runs again", "el worker vuelve a correr"));
          else say(3, T("config → " + e.to, "config → " + e.to));
          break;
        case "hotfixGone":
          if (e.why === "heal") say(5, T("self-heal undid the hotfix · LIMIT " + e.from + " → " + e.to, "self-heal deshizo el hotfix · LÍMITE " + e.from + " → " + e.to));
          else say(5, T("the sync put LIMIT back to " + e.to + " · the hotfix is gone", "el sync volvió el LÍMITE a " + e.to + " · el hotfix se perdió"));
          break;
        case "hotfix":
          flash.eng = e.t;
          if (m.cfg.selfHeal) say(4, T("kubectl edit · LIMIT " + e.from + " → " + e.to + " · out of sync", "kubectl edit · LÍMITE " + e.from + " → " + e.to + " · desincronizada"));
          else say(4, T("kubectl edit · LIMIT " + e.to + " · self-heal off: it stays", "kubectl edit · LÍMITE " + e.to + " · sin self-heal: se queda"));
          break;
        case "undo":
          flash.eng = e.t;
          say(5, T("kubectl rollout undo · web back to v" + e.to + " in the cluster", "kubectl rollout undo · web vuelve a v" + e.to + " en el clúster"));
          break;
        case "hpa":
          if (m.desired().replicas !== null && e.to > e.from) say(4, T("HPA: replicas " + e.from + " → " + e.to + " · git says " + m.desired().replicas, "HPA: réplicas " + e.from + " → " + e.to + " · git dice " + m.desired().replicas));
          else say(2, T("HPA: replicas " + e.from + " → " + e.to, "HPA: réplicas " + e.from + " → " + e.to));
          break;
        case "backoff": { const s = Math.round(e.until - e.t); say(3, T("self-heal backs off · next try in " + s + " s", "self-heal espera · próximo intento en " + s + " s")); break; }
        case "pruned": say(5, T("pruned the worker git no longer has", "se podó (prune) el worker que git ya no tiene")); break;
        case "traffic": say(2, e.level === "high" ? T("traffic doubles · the HPA will ask for more pods", "el tráfico se duplica · el HPA pedirá más pods") : T("traffic back to normal", "el tráfico vuelve a lo normal")); break;
        case "nothing": say(2, T("sync · nothing to change", "sync · nada que cambiar")); break;
      }
    }
    if (logAt > 4000) { m.log.splice(0, logAt); logAt = 0; }
  }

  // ---------- painting ----------
  function paint() {
    narrate();
    sayHeld();
    const head = m.head().spec, want = m.desired(), live = m.live;
    const d = m.diff();

    // git's wall: the head revision and the cards; a card lights while git is ahead of what the reconciler has read
    counters.rev.set(m.head().rev % 100);
    setText(cards.web.text, "v" + head.image + " " + (head.replicas === null ? "HPA" : "×" + head.replicas));
    setText(cards.config.text, head.config);
    setLit(cards.web.g, head.image !== want.image || head.replicas !== want.replicas);
    setLit(cards.config.g, head.config !== want.config);
    show(cards.worker.pin, head.worker);
    setLit(cards.worker.g, head.worker !== want.worker);

    // the booth
    counters.has.set(m.git[m.R.has].rev % 100);
    counters.next.setClamped(Math.ceil(Math.max(0, m.R.nextCheck - clock)));
    counters.syncs.setClamped(m.st.syncs);
    counters.undone.setClamped(m.st.undone);
    setLit(outsync, d.length > 0);
    switches.selfHeal.setAttribute("transform", m.cfg.selfHeal ? translateAlong(P, [G.SWITCH.travel, 0, 0]) : "");
    switches.prune.setAttribute("transform", m.cfg.prune ? translateAlong(P, [G.SWITCH.travel, 0, 0]) : "");
    show(hookWire, m.cfg.poll === "hook");
    const ringing = m.R.task && m.R.task.kind === "fetch" && m.R.task.why === "hook";
    show(bell.on, !!ringing); show(bell.off, !ringing);

    // the HPA
    const ready = m.pods.filter(m.isReady).length;
    counters.wants.set(m.H.wants);
    counters.failed.setClamped(m.st.failed);
    load.set(ready ? Math.min(1, m.load / (ready * CAP) / 1.5) : 1);

    // the floor
    counters.version.set(live.image);
    counters.replicas.set(live.replicas);
    counters.limit.set(live.config);
    setLit(litc.version, live.image !== want.image);
    setLit(litc.replicas, want.replicas !== null && live.replicas !== want.replicas);
    setLit(litc.limit, live.config !== want.config);
    show(workerEl, live.worker); show(workerGone, !live.worker);
    counters.jobs.set(Math.floor(m.st.jobs) % 1000);
    const orphan = live.worker && !want.worker;
    show(lampEl.on, orphan); show(lampEl.off, !orphan);

    // people: whoever acts holds a slip (lit is kept for what differs from git)
    const dev = clock - flash.dev < 1.6, eng = clock - flash.eng < 1.6;
    for (const [key, on] of [["dev", dev], ["eng", eng]]) {
      show(people[key].querySelector('[data-person="on"]'), on);
      show(people[key].querySelector('[data-person="off"]'), !on);
    }

    // the walker
    const w = m.walker(clock);
    walker.setAttribute("transform", translateAlong(P, [w.x, G.AISLE_Y, 0]));
    show(wOn, w.syncing); show(wOff, !w.syncing);

    // pods
    const seen = new Set();
    for (const p of m.pods) {
      seen.add(p.id);
      let e = podEls.get(p.id);
      if (!e) {
        const used = new Set(slotOf.values());
        const slot = G.SLOTS.findIndex((_, i) => !used.has(i));
        if (slot < 0) continue;
        e = free.pop() || podEl();
        e.state = e.label = e.lit = null;
        slotOf.set(p.id, slot); podEls.set(p.id, e);
        const [x, y] = G.SLOTS[slot];
        e.g.setAttribute("transform", translateAlong(P, [x, y, G.WEB_H]));
        // painter's order: far pods first
        e.g.__d = depthOf([x, y, 0], P);
        podLayer.appendChild(e.g);
        [...podLayer.children].sort((a, b) => a.__d - b.__d).forEach((k) => podLayer.appendChild(k));
      }
      const state = m.isReady(p) ? "ready" : "start";
      if (e.state !== state) { e.state = state; show(e.ready, state === "ready"); show(e.start, state === "start"); }
      const label = "v" + p.image;
      if (e.label !== label) { e.label = label; e.texts.forEach((x) => setText(x, label)); }
      const lit = p.image !== want.image;
      if (e.lit !== lit) { e.lit = lit; setLit(e.g, lit); }
    }
    for (const [id, e] of podEls) if (!seen.has(id)) { e.g.remove(); free.push(e); podEls.delete(id); slotOf.delete(id); }
  }

  // ---------- stats ----------
  let outSince = null;
  function showStats() {
    const d = m.diff();
    if (d.length) outSince ??= clock; else outSince = null;
    root.stat("rev", m.head().rev + " → " + m.git[m.R.has].rev);
    root.stat("out", outSince === null ? L("in sync", "sincronizada") : Math.round(clock - outSince) + " s");
    root.stat("syncs", m.st.syncs);
    root.stat("undone", m.st.undone);
    root.stat("pods", m.pods.filter(m.isReady).length + " / " + m.live.replicas);
    root.stat("failed", Math.floor(m.st.failed));
  }

  // ---------- the loop ----------
  let statTimer = 0;
  const pause = playPause(root);
  const loop = WB.loop({ stage, step: (dt) => {
    clock += dt * cfg.speed;
    // a Watch can skip a quiet stretch: run the model through it, drop its narration, and say how far it went
    // (to: a fixed time; toCheck: up to that many seconds before the timer's own next look, so its wait stays real)
    if (jump && clock >= jump.at) {
      const to = jump.toCheck ? m.R.nextCheck - jump.toCheck : jump.to;
      if (to > clock) {
        clock = to; m.runTo(clock);
        if (jump.nextCheck) m.R.nextCheck = jump.nextCheck;     // the timer's next look, staged just after the merge
        logAt = m.log.length; held = null;
        const secs = String(Math.round(m.R.nextCheck - (jump.since ?? 0)));
        say(9, T(jump.say.en.replace("{s}", secs), jump.say.es.replace("{s}", secs)));
      }
      jump = null;
    }
    m.runTo(clock);
    paint();
    statTimer += dt; if (statTimer > 0.2) { statTimer = 0; showStats(); }
  }, onPause: pause.onPause });
  pause.bind(loop);
  const wake = () => { if (loop.paused) loop.setPaused(false); };

  // The settings change the running machine (no restart): the switches and the git check act at once; replicas is a
  // commit to git; traffic changes the load.
  function set(name, raw, quiet) {
    root.press(name, raw);
    cfg[name] = name === "speed" ? Number(raw) : String(raw);
    if (quiet || name === "speed") return;
    if (name === "selfHeal") { m.cfg.selfHeal = raw === "on"; say(6, raw === "on" ? T("self-heal on · live drift gets undone", "self-heal activado · se deshace la deriva en vivo") : T("self-heal off · live edits stay until a sync", "self-heal apagado · las ediciones en vivo quedan hasta un sync")); }
    if (name === "prune") { m.cfg.prune = raw === "on"; say(6, raw === "on" ? T("prune on · syncs delete what git dropped", "prune activado · los syncs borran lo que git quitó") : T("prune off · syncs leave what git dropped", "prune apagado · los syncs dejan lo que git quitó")); }
    if (name === "poll") { m.cfg.poll = String(raw); say(6, raw === "hook" ? T("webhook on · a merge rings the bell", "webhook activado · una fusión toca la campana") : T("no webhook · git is read on the timer", "sin webhook · git se lee con el temporizador")); }
    if (name === "replicas") m.actions.setReplicas({ replicas: raw === "git" ? 3 : null });
    if (name === "traffic") m.actions.traffic({ level: String(raw) });
    paint(); showStats(); wake();
  }
  root.on("change", (name, value) => set(name, value));
  const relabel = () => root.relabel("worker", m.head().spec.worker ? L("Remove the worker in git", "Quitar el worker de git") : L("Put the worker back in git", "Volver a poner el worker"));
  const now = (fn) => { fn(); m.runTo(clock + 0.01); paint(); showStats(); relabel(); wake(); };
  const actions = {
    release: () => now(() => m.actions.release()),
    hotfix: () => now(() => m.actions.hotfix()),
    worker: () => now(() => (m.head().spec.worker ? m.actions.removeWorker() : m.actions.restoreWorker())),
    sync: () => now(() => m.actions.sync()),
    reset: () => { restart(); relabel(); say(9, T("started over", "empezó de nuevo")); },
  };
  root.on("action", (name) => actions[name]?.());

  // ---------- "Watch it on the machine" ----------
  root.on("watch", (w) => {
    for (const key of ["selfHeal", "prune", "poll", "replicas", "traffic"]) set(key, w.set[key], true);
    set("speed", w.speed, true);
    restart(w);
    relabel();
    say(9, T(w.say.en, w.say.es));
    wake();
  });

  loop.setPaused(loop.paused);
  restart();
}

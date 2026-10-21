// Browser helpers every lesson page shares, under one name (WB) so they never clash with a lesson's own code.
// Inlined after the kit (kitScript), so `iso` and `pathOf` are available here.
const WB = (() => {
  const faceRectY = (P, x0, x1, y, z0, z1) => pathOf([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]].map((p) => iso(p, P)), true);
  const faceRectX = (P, x, y0, y1, z0, z1) => pathOf([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]].map((p) => iso(p, P)), true);
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  /*@digits*/
  const geoOf = (el) => JSON.parse(el.getAttribute("data-geo"));

  // Live parts drawn by parts.mjs. Each finds its element by name inside root (the figure's svg).
  // counter: a digitCounter; set(v) redraws only the wheels whose digit changed.
  function counter(root, name, P) {
    const el = root.querySelector('[data-counter="' + name + '"]');
    const g = geoOf(el), wheels = [...el.querySelectorAll("[data-wheel]")], shown = [];
    return { el, set(v) { digitsOf(v, g.cells.length).forEach((d, j) => { if (shown[j] !== d) { shown[j] = d; wheels[j].setAttribute("d", digitPath(iso, P, g.cells[j], d, g.face)); } }); } };
  }
  // dial: the needle of a dial; set(frac) turns it to that share of its sweep.
  function dial(root, name, P) {
    const el = root.querySelector('[data-dial="' + name + '"]'), g = geoOf(el);
    return { el, set(frac) {
      const a = g.from + Math.max(0, Math.min(1, frac)) * g.span, sx = Math.sin(a), sy = -Math.cos(a);
      el.setAttribute("d", pathOf([iso([g.x - sx * g.r * 0.22, g.y - sy * g.r * 0.22, g.z], P), iso([g.x + sx * g.r, g.y + sy * g.r, g.z], P)]));
    } };
  }
  // meter: the needle of a half-round meter; set(frac) swings it from left (0) to right (1).
  function meter(root, name, P) {
    const el = root.querySelector('[data-meter="' + name + '"]'), g = geoOf(el);
    return { el, set(frac) {
      const a = Math.PI * (1 - Math.max(0, Math.min(1, frac)));
      el.setAttribute("d", pathOf([iso(facePoint(g.face, g, 0, 0), P), iso(facePoint(g.face, g, Math.cos(a) * g.r, Math.sin(a) * g.r), P)]));
    } };
  }
  // pose: show one drawing of a variants() group and hide the others.
  function pose(root, name, key) {
    const el = root.querySelector('[data-variants="' + name + '"]');
    el.querySelectorAll(":scope > [data-variant]").forEach((v) => { if (v.dataset.variant === key) v.removeAttribute("data-off"); else v.setAttribute("data-off", ""); });
  }

  // Frame loop that runs only while the figure is on screen and not paused.
  // step(dt) gets real seconds (capped); multiply by your own speed inside it.
  function loop({ stage, step, paused = still.matches, maxDt = 1 / 20, onPause }) {
    let frame = 0, last = 0, visible = false, isPaused = paused;
    const tick = (t) => {
      const dt = last ? Math.min((t - last) / 1000, maxDt) : 1 / 60;
      last = t;
      if (!isPaused) step(dt);
      frame = visible && !isPaused ? requestAnimationFrame(tick) : 0;
    };
    const run = () => { if (!frame && visible && !isPaused) { last = 0; frame = requestAnimationFrame(tick); } };
    new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; run(); }, { rootMargin: "80px 0px" }).observe(stage);
    const api = {
      get paused() { return isPaused; },
      setPaused(on) { isPaused = on; onPause && onPause(on); run(); },
      toggle() { api.setPaused(!isPaused); },
      run,
    };
    return api;
  }

  // Segmented controls: <button data-set="name" data-value="v">. pressSeg marks the chosen one.
  function pressSeg(name, value) {
    document.querySelectorAll('[data-set="' + name + '"]').forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === String(value))));
  }
  function onSegments(handler) {
    document.querySelectorAll("[data-set]").forEach((b) => b.addEventListener("click", () => handler(b.dataset.set, b.dataset.value, b)));
  }

  // Experiment cards: pick a prediction, run, show the verdict and bars.
  // runs[id]() returns { verdict, bars: [[label, share 0..1, text, isAfter?], ...] }; watch(exp) puts the figure in that state.
  function experiments({ list, runs, watch, scrollTo = "machine" }) {
    document.querySelectorAll("[data-exp]").forEach((card) => {
      const exp = list.find((e) => e.id === card.dataset.exp);
      const runBtn = card.querySelector("[data-run]");
      const choices = [...card.querySelectorAll("[data-choice]")];
      let picked = null;
      choices.forEach((c) => c.addEventListener("click", () => {
        if (card.hasAttribute("data-done")) return;
        picked = Number(c.dataset.choice);
        choices.forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
        runBtn.disabled = false; runBtn.textContent = "Run the experiment";
      }));
      runBtn.addEventListener("click", () => {
        if (picked === null) return;
        const out = runs[exp.id]();
        const right = picked === exp.answer;
        choices.forEach((x, j) => { x.disabled = true; if (j === exp.answer) x.dataset.verdict = "right"; else if (j === picked) x.dataset.verdict = "wrong"; });
        card.querySelector("[data-outcome]").textContent = (right ? "Your prediction held. " : "Not what you predicted. ") + out.verdict;
        card.querySelector("[data-bars]").innerHTML = out.bars.map(([label, share, text, after]) => '<div class="bar"' + (after ? " data-after" : "") + "><span>" + label + '</span><span class="track"><span class="fill" style="width:0"></span></span><b>' + text + "</b></div>").join("");
        card.setAttribute("data-done", "");
        runBtn.disabled = true; runBtn.textContent = "Done";
        requestAnimationFrame(() => requestAnimationFrame(() => card.querySelectorAll(".fill").forEach((f, i) => { f.style.width = Math.max(1, Math.round(100 * out.bars[i][1])) + "%"; })));
      });
      const watchBtn = card.querySelector("[data-watch]");
      if (watchBtn && watch) watchBtn.addEventListener("click", () => {
        watch(exp);
        const target = document.getElementById(scrollTo);
        if (target) target.scrollIntoView({ behavior: still.matches ? "auto" : "smooth" });
      });
    });
  }

  return { faceRectY, faceRectX, still, loop, pressSeg, onSegments, experiments, counter, dial, meter, pose, digitsOf };
})();

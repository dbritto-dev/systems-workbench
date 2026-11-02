// Loads a lesson's live code (its model and animation) when it's needed: as the machine or the experiments come
// near the screen, or on the first interaction. Each lesson is its own chunk; the shared runtime (kit + WB) is one
// chunk that every lesson reuses from the browser cache.
// Ported lessons export mount(data) from src/lessons/<slug>/live.ts; the rest run on import (src/generated/live/).
const native = import.meta.glob<{ default: (data: unknown) => void }>("../lessons/*/live.ts");
const legacy = import.meta.glob("../generated/live/*.js");

export function loadLive() {
  const marker = document.querySelector<HTMLElement>("[data-live]");
  const slug = marker?.dataset.live;
  if (!slug) return;
  const mount = native[`../lessons/${slug}/live.ts`];
  const load = mount
    ? () => mount().then((m) => m.default(JSON.parse(document.querySelector("[data-lesson-data]")?.textContent || "{}")))
    : legacy[`../generated/live/${slug}.js`];
  if (!load) return;
  let started = false;
  const events = ["pointerdown", "keydown", "focusin"] as const;
  const start = () => {
    if (started) return;
    started = true;
    io.disconnect();
    events.forEach((e) => removeEventListener(e, start, true));
    load().catch((err) => console.error("lesson code failed to load", err));
  };
  const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) start(); }, { rootMargin: "600px 0px" });
  document.querySelectorAll(".iso-stage, .panel, .exp").forEach((n) => io.observe(n));
  events.forEach((e) => addEventListener(e, start, true));
}
